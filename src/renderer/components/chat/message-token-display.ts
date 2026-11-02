import type { Message } from '@shared/types'
import { isSuccessfulAssistantReply } from '@/stores/session'

function isPositiveTokenCount(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0
}

export interface MessageTokenDisplay {
  totalTokens: number
  cachedInputTokens?: number
  engineSpeed?: boolean
  outputTokensPerSecond?: number
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
    return {
      totalTokens,
      ...(engineSpeed ? { engineSpeed: true } : {}),
      ...(isPositiveTokenCount(cachedInputTokens) ? { cachedInputTokens } : {}),
      ...(isPositiveTokenCount(outputTokensPerSecond) ? { outputTokensPerSecond } : {}),
    }
  }

  return null
}
