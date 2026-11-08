import type { Message } from '@shared/types'
import { expect, it, vi } from 'vitest'
vi.mock('@/stores/session', () => ({ isSuccessfulAssistantReply: () => true }))
import { getMessageTokenDisplay } from './message-token-display'
it('counts generation steps from content part indices and hides single-step replies', () => {
  const workMode = {
    finishReason: 'stop',
    generationDuration: 184500,
    usage: { totalTokens: 6786786, outputTokens: 900, cachedInputTokens: 6298209 },
    contentParts: [
      { type: 'text', text: 'a', stepIndex: 0 },
      { type: 'tool_call', toolCallId: 't1', toolName: 'exec', args: {}, stepIndex: 5 },
      { type: 'text', text: 'b', stepIndex: 17 },
    ],
  } as unknown as Message
  const display = getMessageTokenDisplay(workMode)
  expect(display?.stepCount).toBe(18)
  const simple = {
    finishReason: 'stop',
    generationDuration: 3000,
    usage: { totalTokens: 1000, outputTokens: 100 },
    contentParts: [{ type: 'text', text: 'hi', stepIndex: 0 }],
  } as unknown as Message
  expect(getMessageTokenDisplay(simple)?.stepCount).toBeUndefined()
})
it('prefers reported speed while preserving the elapsed-time fallback for other providers', () => {
  const message = {
    finishReason: 'stop',
    generationDuration: 3000,
    usage: { totalTokens: 1000, outputTokens: 100 },
  } as Message
  expect(getMessageTokenDisplay(message)?.outputTokensPerSecond).toBeCloseTo(100 / 3)
  message.usage!.engineOutputTokensPerSecond = 68.1
  expect(getMessageTokenDisplay(message)?.outputTokensPerSecond).toBe(68.1)
  expect(getMessageTokenDisplay(message)?.engineSpeed).toBe(true)
})
