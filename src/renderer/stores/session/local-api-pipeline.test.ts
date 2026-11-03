import type { Message, Session } from '@shared/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  repoHeader: vi.fn(),
  repoHistory: vi.fn(),
  insertMessage: vi.fn(),
  insertMessages: vi.fn(),
  generate: vi.fn(),
  compaction: vi.fn(),
  platform: { type: 'desktop', isDesktopLike: true },
  settings: { provider: 'custom-existing-endpoint', modelId: 'configured-model' },
}))
vi.mock('@/app/renderer-application', () => ({
  rendererApplication: {
    generationRuntime: { getLiveMessage: () => undefined },
    sessions: {
      getSessionHeader: mocks.repoHeader,
      readSessionTranscriptWindow: mocks.repoHistory,
      insertMessage: mocks.insertMessage,
      insertMessages: mocks.insertMessages,
    },
    sessionQueryBridge: { getSession: mocks.getSession },
  },
}))
vi.mock('@/platform', () => ({ default: mocks.platform }))
vi.mock('@/lib/utils', () => ({ getLogger: () => ({ error: vi.fn(), warn: vi.fn() }) }))
vi.mock('@/adapters', () => ({ createModel: vi.fn().mockResolvedValue({}) }))
vi.mock('@/packages/context-management', () => ({ runCompactionWithUIState: mocks.compaction }))
vi.mock('@/packages/model-setting-utils', () => ({ getModelDisplayName: vi.fn() }))
vi.mock('@/packages/token', () => ({ estimateTokensFromMessages: vi.fn().mockReturnValue(1) }))
vi.mock('@/utils/sentry', () => ({ reportError: vi.fn() }))
vi.mock('./session-settings', () => ({
  getSessionHeader: mocks.getSession,
  getSessionSettings: vi.fn().mockResolvedValue(mocks.settings),
  getSessionTokenModel: vi.fn().mockReturnValue('deepseek'),
}))
vi.mock('./agent-mode', () => ({ getSessionAgentModeEntry: () => ({ value: 'off' }) }))
vi.mock('./generation', () => ({ _generateWithoutSessionLock: mocks.generate }))
vi.mock('../sessionActivityStore', () => ({ markSessionReplyFailed: vi.fn(), isSessionGenerating: () => false }))
vi.mock('../sessionAttachmentRagIndexing', () => ({ ensureMessageFileSessionAttachment: vi.fn() }))
vi.mock('../settingActions', () => ({ isPro: () => false, getRemoteConfig: vi.fn().mockResolvedValue({}) }))
vi.mock('../settingsStore', () => ({ settingsStore: { getState: () => ({ getSettings: () => mocks.settings }) } }))
vi.mock('./utils', () => ({ getSessionWebBrowsing: () => false }))

vi.mock('./action-guard', () => ({
  guardSessionAction: async () => true,
  getSessionLockStateNow: async () => ({
    generatingReplyCount: 0,
    anyReplyGenerating: false,
    compactionRunning: false,
    awaitingPauseDecision: false,
  }),
}))
import { handleLocalChatCall } from '@/packages/local-chat-api'
import { createMessage } from '@shared/types'

it('runs an API turn through the real desktop send controller and reads the same stored turn', async () => {
  const records: Message[] = [createMessage('user', 'Earlier desktop conversation context')]
  const session = { id: 'existing-chat', name: 'Existing chat', type: 'chat', settings: mocks.settings }
  mocks.getSession.mockResolvedValue(session)
  mocks.repoHeader.mockImplementation(async () => ({ header: session, revision: records.length }))
  mocks.repoHistory.mockImplementation(async () => ({
    messages: records.map((message) => ({ message, threadId: 'existing-thread' })),
    older: null,
  }))
  mocks.insertMessage.mockImplementation(async (id: string, message: Message) => {
    expect(id).toBe(session.id)
    records.push({ ...message })
  })
  mocks.compaction.mockResolvedValue({ status: 'skipped' })
  // Only the external generation seam is deterministic; the production Send controller is not mocked.
  mocks.generate.mockImplementation(async (id: string, message: Message) => {
    expect(id).toBe(session.id)
    const saved = records.find((row) => row.id === message.id)!
    saved.contentParts = [{ type: 'text', text: 'Deterministic generation proof' }]
    saved.generating = false
  })
  const accepted = await handleLocalChatCall({ action: 'send', chatId: session.id, content: 'New API question' })
  expect(accepted.status).toBe(202)
  await vi.waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(1))
  await vi.waitFor(async () => {
    const read = await handleLocalChatCall({ action: 'read', chatId: session.id })
    expect(read.body).toMatchObject({
      id: session.id,
      generating: false,
      messages: [
        { text: 'Earlier desktop conversation context' },
        { role: 'user', text: 'New API question' },
        { role: 'assistant', text: 'Deterministic generation proof', generating: false },
      ],
    })
  })
  expect(mocks.insertMessage).toHaveBeenCalledTimes(2)
  expect(mocks.generate).toHaveBeenCalledWith(session.id, expect.objectContaining({ role: 'assistant' }), {
    operationType: 'send_message',
  })
})
