import type { MetadataExtractor } from '@ai-sdk/openai-compatible'
import type { MessageUsage } from '../../types/session'

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}
function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}
function extract(value: unknown) {
  const timings = record(record(value)?.timings)
  const rate = timings?.predicted_per_second,
    ms = timings?.predicted_ms
  const promptRate = timings?.prompt_per_second,
    promptMs = timings?.prompt_ms,
    promptTokens = timings?.prompt_n
  const output = positive(rate) && positive(ms) ? { tokensPerSecond: rate, decodeMs: ms } : {}
  const input =
    positive(promptRate) && positive(promptMs)
      ? {
          promptTokensPerSecond: promptRate,
          promptMs,
          ...(typeof promptTokens === 'number' && Number.isFinite(promptTokens) && promptTokens >= 0
            ? { promptTokens }
            : {}),
        }
      : {}
  return Object.keys(output).length || Object.keys(input).length
    ? { chatboxEngineTiming: { ...output, ...input } }
    : undefined
}

// The SDK exposes the raw JSON here before its normal response schema drops
// llama.cpp-compatible timing fields. State belongs to one HTTP response.
export const engineTimingExtractor: MetadataExtractor = {
  extractMetadata: async ({ parsedBody }) => extract(parsedBody),
  createStreamExtractor: () => {
    let metadata: ReturnType<typeof extract>
    return {
      processChunk(value) {
        const next = extract(value)
        if (next) metadata = { chatboxEngineTiming: { ...metadata?.chatboxEngineTiming, ...next.chatboxEngineTiming } }
      },
      buildMetadata: () => metadata,
    }
  },
}

export function mergeEngineTiming(usage: MessageUsage | undefined, metadata: unknown): MessageUsage | undefined {
  const timing = record(record(metadata)?.chatboxEngineTiming)
  const rate = timing?.tokensPerSecond
  const ms = timing?.decodeMs
  const promptRate = timing?.promptTokensPerSecond,
    promptMs = timing?.promptMs
  if ((!positive(rate) || !positive(ms)) && (!positive(promptRate) || !positive(promptMs))) return usage
  const result: MessageUsage = { ...usage }
  if (positive(rate) && positive(ms)) {
    const previousMs = usage?.engineDecodeMs ?? 0,
      previousRate = usage?.engineOutputTokensPerSecond ?? 0
    result.engineDecodeMs = previousMs + ms
    result.engineOutputTokensPerSecond =
      previousMs > 0 ? (previousRate * previousMs + rate * ms) / (previousMs + ms) : rate
  }
  if (positive(promptRate) && positive(promptMs)) {
    const previousMs = usage?.enginePromptMs ?? 0,
      previousRate = usage?.engineInputTokensPerSecond ?? 0
    result.enginePromptMs = previousMs + promptMs
    result.engineInputTokensPerSecond =
      previousMs > 0 ? (previousRate * previousMs + promptRate * promptMs) / (previousMs + promptMs) : promptRate
    if (typeof timing?.promptTokens === 'number' && Number.isFinite(timing.promptTokens) && timing.promptTokens >= 0)
      result.engineProcessedTokens = (usage?.engineProcessedTokens ?? 0) + timing.promptTokens
  }
  return result
}
