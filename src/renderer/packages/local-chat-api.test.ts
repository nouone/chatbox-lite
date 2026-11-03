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
}))
vi.mock('@/app/renderer-application', () => ({
  rendererApplication: {
    generationRuntime: { getLiveMessage: mocks.live },
    sessions: {
      readSessionMessages:mocks.messages,
      listSessionsMetaPage: mocks.list,
      getSessionHeader: mocks.header,
      readSessionTranscriptWindow: mocks.history,
    },
  },
}))
vi.mock('./local-chat-speech', () => ({synthesizeWebReply:mocks.speech}))
vi.mock('@/stores/session/crud', () => ({ createEmpty: mocks.create }))
vi.mock('@/stores/session/messages', () => ({ submitNewUserMessage: mocks.send }))
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
  expect(mocks.speech).toHaveBeenCalledWith(message)
  mocks.messages.mockResolvedValue({messages:[{...message,generating:true}]})
  expect((await handleLocalChatCall({action:'speech',chatId:'chat',messageId:'reply'})).status).toBe(409)
})
it('marks web sends so Desktop auto-read stays silent', async () => {
  await handleLocalChatCall({action:'send',chatId:'chat',content:'Hello from phone'})
  expect(mocks.send).toHaveBeenCalledWith('chat',expect.objectContaining({newUserMsg:expect.objectContaining({suppressDesktopAutoRead:true})}))
})
