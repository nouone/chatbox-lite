import type { Message } from '@shared/types'
import { expect, it, vi } from 'vitest'
vi.mock('@/stores/session', () => ({ isSuccessfulAssistantReply: () => true }))
import { getMessageTokenDisplay } from './message-token-display'
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
