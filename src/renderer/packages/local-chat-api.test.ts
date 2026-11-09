import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  header: vi.fn(),
  history: vi.fn(),
  send: vi.fn(),
  busy: vi.fn(),
  live: vi.fn(),
  messages: vi.fn(),
  speech: vi.fn(),
  updateHeader: vi.fn(),
}))
vi.mock('@/app/renderer-application', () => ({
  rendererApplication: {
    generationRuntime: { getLiveMessage: mocks.live },
    sessions: {
      readSessionMessages:mocks.messages,
      listSessionsMetaPage: mocks.list,
      getSessionHeader: mocks.header,
      readSessionTranscriptWindow: mocks.history,
      updateSessionHeader: mocks.updateHeader,
    },
  },
}))
vi.mock('./local-chat-speech', () => ({ synthesizeWebReply: (...args: unknown[]) => mocks.speech(...args) }))
vi.mock('@/stores/session/crud', () => ({ createEmpty: mocks.create }))
vi.mock('@/stores/session/messages', () => ({ submitNewUserMessage: mocks.send }))
vi.mock('@/stores/settingsStore', () => ({
  settingsStore: {
    getState: () => ({
      customProviders: [
        {
          id: 'custom-strata',
          models: [{ modelId: 'qwen-next', type: 'chat', reasoningControl: 'strata' }],
        },
      ],
      getSettings: () => ({}),
    }),
  },
}))
vi.mock('@/stores/sessionActivityStore', () => ({ isSessionGenerating: mocks.busy }))
vi.mock('@/stores/session/action-guard', () => ({
  getSessionLockStateNow: async () => ({
    generatingReplyCount: 0,
    anyReplyGenerating: false,
    compactionRunning: false,
    awaitingPauseDecision: false,
  }),
}))
import { handleLocalChatCall } from './local-chat-api'
it('creates a new chat through the same desktop New Chat controller', async () => {
  mocks.create.mockResolvedValueOnce({ id: 'new-desktop-chat', name: 'New chat' })
  const result = await handleLocalChatCall({ action: 'create' })
  expect(result).toEqual({ status: 201, body: { id: 'new-desktop-chat', name: 'New chat' } })
  expect(mocks.create).toHaveBeenCalledWith('chat')
  expect(mocks.send).not.toHaveBeenCalled()
})
beforeEach(() => {
  vi.clearAllMocks()
  mocks.busy.mockReturnValue(false)
  mocks.live.mockReturnValue(undefined)
  mocks.header.mockResolvedValue({ header: { id: 'chat', name: 'Desktop conversation', type: 'chat' }, revision: 5 })
  mocks.send.mockResolvedValue(undefined)
})
it('uses exactly the desktop Send controller and preserves the existing conversation ID', async () => {
  const result = await handleLocalChatCall({ action: 'send', chatId: 'chat', content: 'Question about my documents' })
  expect(result.status).toBe(202)
  expect(mocks.send).toHaveBeenCalledOnce()
  expect(mocks.send).toHaveBeenCalledWith(
    'chat',
    expect.objectContaining({
      needGenerating: true,
      newUserMsg: expect.objectContaining({
        role: 'user',
        contentParts: [{ type: 'text', text: 'Question about my documents' }],
      }),
    })
  )
})
it('rejects busy and missing chats without submitting or constructing a second client', async () => {
  mocks.busy.mockReturnValue(true)
  expect((await handleLocalChatCall({ action: 'send', chatId: 'busy', content: 'hello' })).status).toBe(409)
  mocks.header.mockResolvedValueOnce(null)
  expect((await handleLocalChatCall({ action: 'read', chatId: 'missing' })).status).toBe(404)
  expect(mocks.send).not.toHaveBeenCalled()
})
it('reads history from the shared session repository, including partial assistant text', async () => {
  mocks.history.mockResolvedValueOnce({
    messages: [
      {
        threadId: 'thread',
        message: {
          id: 'reply',
          role: 'assistant',
          contentParts: [{ type: 'text', text: 'partial reply' }],
          generating: true,
        },
      },
    ],
    older: null,
  })
  const result = await handleLocalChatCall({ action: 'read', chatId: 'chat', limit: 50 })
  expect(result.status).toBe(200)
  expect(mocks.history).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'chat', expectedRevision: 5 }))
  expect(result.body).toMatchObject({
    id: 'chat',
    messages: [{ id: 'reply', text: 'partial reply', generating: true }],
  })
})

it('overlays live engine text so streaming does not wait for the persistence checkpoint', async () => {
  mocks.history.mockResolvedValueOnce({
    messages: [
      {
        threadId: 'thread',
        message: { id: 'reply', role: 'assistant', contentParts: [{ type: 'text', text: '' }], generating: true },
      },
    ],
  })
  mocks.live.mockReturnValueOnce({
    id: 'reply',
    role: 'assistant',
    contentParts: [{ type: 'text', text: 'live token stream' }],
    generating: true,
  })
  const result = await handleLocalChatCall({ action: 'read', chatId: 'chat' })
  expect(result.body).toMatchObject({ messages: [{ text: 'live token stream' }] })
})

it('synthesizes only a saved completed assistant reply without exposing speech configuration', async () => {
  const message = {id:'reply',role:'assistant',contentParts:[{type:'text',text:'Hello'}]}
  mocks.messages.mockResolvedValue({messages:[message]})
  mocks.speech.mockResolvedValue({audioBase64:'YXVkaW8=',contentType:'audio/mpeg'})
  const result = await handleLocalChatCall({action:'speech',chatId:'chat',messageId:'reply'})
  expect(result).toEqual({status:200,body:{audioBase64:'YXVkaW8=',contentType:'audio/mpeg'}})
  expect(mocks.messages).toHaveBeenCalledWith({sessionId:'chat',messageIds:['reply']})
  expect(mocks.speech).toHaveBeenCalledWith(message, 'chat')
  mocks.messages.mockResolvedValue({messages:[{...message,generating:true}]})
  expect((await handleLocalChatCall({action:'speech',chatId:'chat',messageId:'reply'})).status).toBe(409)
})
it('marks web sends so Desktop auto-read stays silent', async () => {
  await handleLocalChatCall({action:'send',chatId:'chat',content:'Hello from phone'})
  expect(mocks.send).toHaveBeenCalledWith('chat',expect.objectContaining({newUserMsg:expect.objectContaining({suppressDesktopAutoRead:true})}))
})
it('persists a thinkingEffort into the conversation settings before submitting', async () => {
  let patched: { settings?: Record<string, unknown> } | undefined
  mocks.updateHeader.mockImplementation(async (_id: string, updater: (s: unknown) => unknown) => {
    patched = updater({ id: 'chat', settings: { provider: 'custom-strata', modelId: 'qwen-next' } }) as never
    return patched
  })
  const result = await handleLocalChatCall({ action: 'send', chatId: 'chat', content: 'Go on', thinkingEffort: 'off' })
  expect(result.status).toBe(202)
  expect(mocks.updateHeader).toHaveBeenCalledOnce()
  const byModel = patched?.settings?.providerOptionsByModel as Record<string, { openaiCompatible?: { reasoningEffort?: string } }> | undefined
  expect(byModel?.['custom-strata:qwen-next']?.openaiCompatible?.reasoningEffort).toBe('none')
  expect(mocks.send).toHaveBeenCalledOnce()
})
it('sends without touching settings when no thinkingEffort is given', async () => {
  await handleLocalChatCall({ action: 'send', chatId: 'chat', content: 'Plain' })
  expect(mocks.updateHeader).not.toHaveBeenCalled()
  expect(mocks.send).toHaveBeenCalledOnce()
})
it('stores the speakable-answer instruction on voice sends and leaves text sends verbatim', async () => {
  mocks.history.mockResolvedValue({ messages: [], older: null })
  await handleLocalChatCall({ action: 'send', chatId: 'chat', content: 'What is Nov 8?' })
  const plain = mocks.send.mock.calls[0][1].newUserMsg as { contentParts: { text: string }[] }
  expect(plain.contentParts[0].text).toBe('What is Nov 8?')
  mocks.send.mockClear()
  await handleLocalChatCall({ action: 'send', chatId: 'chat', content: 'What is Nov 8?', voice: true })
  const voiced = mocks.send.mock.calls[0][1].newUserMsg as { contentParts: { text: string }[] }
  expect(voiced.contentParts[0].text).toContain('voice interface')
  expect(voiced.contentParts[0].text.endsWith('\n\nWhat is Nov 8?')).toBe(true)
})
it('sends the voice instruction once per thread: later voice turns stay verbatim', async () => {
  // Thread already carries a voice-styled user message (first send of the session).
  mocks.history.mockResolvedValue({
    messages: [
      {
        threadId: 'thread',
        message: {
          id: 'first',
          role: 'user',
          contentParts: [{ type: 'text', text: 'You are responding through a voice interface.\n\nWhat time is it?' }],
        },
      },
      { threadId: 'thread', message: { id: 'reply', role: 'assistant', contentParts: [{ type: 'text', text: 'Three pm.' }] } },
    ],
    older: null,
  })
  await handleLocalChatCall({ action: 'send', chatId: 'chat', content: 'Say again.', voice: true })
  const repeat = mocks.send.mock.calls[0][1].newUserMsg as { contentParts: { text: string }[] }
  expect(repeat.contentParts[0].text).toBe('Say again.')
})
it('re-adds the voice instruction after history compaction drops it', async () => {
  // Compacted thread: the marker message is gone, style must be re-armed.
  mocks.history.mockResolvedValue({
    messages: [{ threadId: 'thread', message: { id: 'summary', role: 'user', contentParts: [{ type: 'text', text: 'Earlier we discussed the weather.' }] } }],
    older: null,
  })
  await handleLocalChatCall({ action: 'send', chatId: 'chat', content: 'And tomorrow?', voice: true })
  const reAdd = mocks.send.mock.calls[0][1].newUserMsg as { contentParts: { text: string }[] }
  expect(reAdd.contentParts[0].text).toContain('voice interface')
})
it('re-reads a stale cursor page once against the current revision', async () => {
  // The page cursor pins the revision it was cut at; a desktop send bumps it.
  // Load-older must re-stamp the cursor and retry, not surface "changed".
  const cursor = {
    sessionId: 'chat',
    revision: 4,
    threadId: 'thread',
    threadOrder: 0,
    messageId: 'anchor',
    direction: 'before',
    limit: 50,
    maxBytes: 2 * 1024 * 1024,
    scope: 'transcript',
  }
  mocks.history
    .mockRejectedValueOnce(new Error('Conversation changed; refresh and try again'))
    .mockResolvedValueOnce({
      messages: [{ threadId: 'thread', message: { id: 'older', role: 'user', contentParts: [{ type: 'text', text: 'older page' }] } }],
      older: null,
    })
  const result = await handleLocalChatCall({ action: 'read', chatId: 'chat', cursor: JSON.stringify(cursor), limit: 50 })
  expect(result.status).toBe(200)
  expect(result.body).toMatchObject({ messages: [{ id: 'older', text: 'older page' }] })
  expect(mocks.history).toHaveBeenCalledTimes(2)
  expect(mocks.history).toHaveBeenLastCalledWith(
    expect.objectContaining({
      expectedRevision: 5,
      cursor: expect.objectContaining({ revision: 5, messageId: 'anchor' }),
    })
  )
})
it('does not retry a cursor read when the revision did not actually move', async () => {
  const cursor = {
    sessionId: 'chat',
    revision: 5,
    threadId: 'thread',
    threadOrder: 0,
    messageId: 'anchor',
    direction: 'before',
    limit: 50,
    maxBytes: 2 * 1024 * 1024,
    scope: 'transcript',
  }
  mocks.history.mockRejectedValueOnce(new Error('Conversation changed; refresh and try again'))
  const result = await handleLocalChatCall({ action: 'read', chatId: 'chat', cursor: JSON.stringify(cursor), limit: 50 })
  expect(result.status).toBe(409)
  expect(mocks.history).toHaveBeenCalledOnce()
})
