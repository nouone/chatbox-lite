import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ chat: vi.fn(), createModel: vi.fn(), header: vi.fn() }))
vi.mock('@/adapters', () => ({
  createModel: (...args: unknown[]) => mocks.createModel(...args),
}))
vi.mock('@/app/renderer-application', () => ({
  rendererApplication: { sessions: { getSessionHeader: mocks.header } },
}))
vi.mock('@/stores/settingsStore', () => ({
  settingsStore: {
    getState: () => ({
      getSettings: () => ({ defaultChatModel: { provider: 'custom-strata', model: 'qwen-next' } }),
    }),
  },
}))
vi.mock('@/stores/lastUsedModelStore', () => ({
  lastUsedModelStore: { getState: () => ({ chat: { provider: 'last-provider', modelId: 'last-model' } }) },
}))
import { rewriteForSpeech, speechRewriteActive } from './speech-rewrite'

const LONG = `Dr. Chen scheduled the 9 a.m. standup for Mon. Jan 5th and noted the forecast: 33 F with winds NNE at 12 mph. ` +
  'The plan: (1) ship the fix, (2) update docs, etc. The budget was $1.2M and the ETA was ~6 weeks.'

beforeEach(() => {
  vi.clearAllMocks()
  // clearAllMocks also drops implementations, so re-arm createModel every test.
  mocks.createModel.mockImplementation(async () => ({ chat: mocks.chat }))
  mocks.header.mockResolvedValue(undefined)
  mocks.chat.mockResolvedValue({ contentParts: [{ type: 'text', text: 'the spoken version' }] })
})

it('skips short texts and explicit opt-out without calling the model', async () => {
  expect(speechRewriteActive({ enabled: true }, 'yes')).toBe(false)
  expect(await rewriteForSpeech('yes', { enabled: true })).toBe('yes')
  expect(await rewriteForSpeech(LONG, { enabled: true, rewrite: false })).toBe(LONG)
  expect(mocks.chat).not.toHaveBeenCalled()
})

it('prefers the chat model over the default when reading that chat', async () => {
  mocks.header.mockResolvedValue({ header: { id: 'c1', settings: { provider: 'custom-chat', modelId: 'chat-model' } } })
  await rewriteForSpeech(LONG + ' sess', { enabled: true }, 'c1')
  expect(mocks.header).toHaveBeenCalledWith('c1')
  expect(mocks.createModel).toHaveBeenCalledWith(expect.objectContaining({ provider: 'custom-chat', modelId: 'chat-model' }))
})

it('falls back to the last used chat model when no default is set', async () => {
  const { settingsStore } = await import('@/stores/settingsStore')
  const original = settingsStore.getState
  try {
    settingsStore.getState = () => ({ getSettings: () => ({}) }) as never
    await rewriteForSpeech(LONG + ' nou', { enabled: true })
    expect(mocks.createModel).toHaveBeenCalledWith(expect.objectContaining({ provider: 'last-provider', modelId: 'last-model' }))
  } finally {
    settingsStore.getState = original
  }
})

it('rewrites long text with thinking pinned to none and caches per text', async () => {
  const out = await rewriteForSpeech(LONG, { enabled: true })
  expect(out).toBe('the spoken version')
  expect(mocks.chat).toHaveBeenCalledOnce()
  const [messages, options] = mocks.chat.mock.calls[0]
  expect(messages[0].role).toBe('system')
  expect(messages[1].content).toBe(LONG)
  expect(options.providerOptions.openaiCompatible.reasoningEffort).toBe('none')
  expect(await rewriteForSpeech(LONG, { enabled: true })).toBe('the spoken version')
  expect(mocks.chat).toHaveBeenCalledOnce()
})

it('falls back to the original text on model failure or a runaway rewrite', async () => {
  mocks.chat.mockRejectedValueOnce(new Error('engine down'))
  expect(await rewriteForSpeech(LONG + ' suffix-a', { enabled: true })).toBe(LONG + ' suffix-a')
  mocks.chat.mockResolvedValueOnce({ contentParts: [{ type: 'text', text: 'x'.repeat(LONG.length * 3) }] })
  expect(await rewriteForSpeech(LONG + ' suffix-b', { enabled: true })).toBe(LONG + ' suffix-b')
})
