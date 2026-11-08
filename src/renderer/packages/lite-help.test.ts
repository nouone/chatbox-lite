import { expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ create: vi.fn().mockResolvedValue({ id: 'help-chat' }), navigate: vi.fn() }))
vi.mock('@/app/renderer-application', () => ({ rendererApplication: { sessions: { createSession: mocks.create } } }))
vi.mock('@/stores/sessionHelpers', () => ({
  initEmptyChatSession: () => ({
    name: 'Untitled',
    type: 'chat',
    messages: [],
    settings: { provider: 'my-custom-endpoint', modelId: 'my-model' },
  }),
}))
vi.mock('@/stores/session/crud', () => ({ switchCurrentSession: mocks.navigate }))
import { openLiteHelpChat } from './lite-help'
it('opens a normal persisted help conversation with docs, using the existing model and no automatic send', async () => {
  await openLiteHelpChat()
  const draft = mocks.create.mock.calls[0][0]
  expect(draft.name).toBe('Wao Help')
  expect(draft.settings).toEqual({ provider: 'my-custom-endpoint', modelId: 'my-model' })
  expect(draft.messages[0].role).toBe('system')
  expect(draft.messages[0].contentParts[0].text).toContain('[Attached: README.md]')
  expect(draft.messages[0].contentParts[0].text).toContain('[Attached: LOCAL-CUSTOM-BUILD.md]')
  expect(draft.messages.map((m: { role: string }) => m.role)).toEqual(['system', 'assistant'])
  expect(mocks.navigate).toHaveBeenCalledWith('help-chat')
})
