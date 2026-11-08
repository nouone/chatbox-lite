import type { Message } from '@shared/types'
import { isSuccessfulAssistantReply } from '@/stores/session'

function isPositiveTokenCount(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0
}

export interface MessageTokenDisplay {
  totalTokens: number
  /** Summed prompt tokens across all steps; the cache share's denominator
   * (totalTokens includes output, which is not part of the cache question). */
  inputTokens?: number
  cachedInputTokens?: number
  engineSpeed?: boolean
  outputTokensPerSecond?: number
  /** Generation steps this reply took; only reported when > 1. */
  stepCount?: number
}

export function getMessageTokenDisplay(message: Message): MessageTokenDisplay | null {
  if (!isSuccessfulAssistantReply(message)) return null

  // A provider-reported total is only presented as consumed after the stream
  // recorded an explicit completion signal. This keeps partial/canceled streams
  // and local estimates from looking like confirmed billing.
  const totalTokens = message.usage?.totalTokens
  if (message.finishReason && isPositiveTokenCount(totalTokens)) {
    const cachedInputTokens = message.usage?.cachedInputTokens
    // End-to-end output throughput, not engine-only decode speed. Never use total
    // usage (which includes prompt/cache tokens) or TTFT as the generation duration.
    const outputTokens = message.usage?.outputTokens
    const duration = message.generationDuration
    const engineSpeed = isPositiveTokenCount(message.usage?.engineOutputTokensPerSecond)
    const outputTokensPerSecond = engineSpeed
      ? message.usage!.engineOutputTokensPerSecond
      : isPositiveTokenCount(outputTokens) && isPositiveTokenCount(duration)
        ? outputTokens / (duration / 1000)
        : undefined
    // Work Mode replies re-send the whole conversation on every step, so
    // totalTokens is the summed cost of ALL steps (field: 6.8M for a 380K
    // chat), not the context size. The step count is what makes that number
    // legible; content parts carry their stepIndex, and the last one plus one
    // is the number of requests this reply took.
    let stepCount: number | undefined
    for (const part of message.contentParts || []) {
      if ('stepIndex' in part && typeof part.stepIndex === 'number' && part.stepIndex >= 0) {
        stepCount = Math.max(stepCount ?? 0, part.stepIndex + 1)
      }
    }
    if (!stepCount || stepCount < 2) stepCount = undefined
    const inputTokens = message.usage?.inputTokens
    return {
      totalTokens,
      ...(isPositiveTokenCount(inputTokens) ? { inputTokens } : {}),
      ...(engineSpeed ? { engineSpeed: true } : {}),
      ...(isPositiveTokenCount(cachedInputTokens) ? { cachedInputTokens } : {}),
      ...(isPositiveTokenCount(outputTokensPerSecond) ? { outputTokensPerSecond } : {}),
      ...(stepCount ? { stepCount } : {}),
    }
  }

  return null
}
