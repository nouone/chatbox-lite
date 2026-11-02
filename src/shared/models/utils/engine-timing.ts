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
  const rate = timings?.predicted_per_second
  const ms = timings?.predicted_ms
  return positive(rate) && positive(ms) ? { chatboxEngineTiming: { tokensPerSecond: rate, decodeMs: ms } } : undefined
}

// The SDK exposes the raw JSON here before its normal response schema drops
// llama.cpp-compatible timing fields. State belongs to one HTTP response.
export const engineTimingExtractor: MetadataExtractor = {
  extractMetadata: async ({ parsedBody }) => extract(parsedBody),
  createStreamExtractor: () => {
    let metadata: ReturnType<typeof extract>
    return {
      processChunk(value) {
        metadata = extract(value) ?? metadata
      },
      buildMetadata: () => metadata,
    }
  },
}

export function mergeEngineTiming(usage: MessageUsage | undefined, metadata: unknown): MessageUsage | undefined {
  const timing = record(record(metadata)?.chatboxEngineTiming)
  const rate = timing?.tokensPerSecond
  const ms = timing?.decodeMs
  if (!positive(rate) || !positive(ms)) return usage
  const previousMs = usage?.engineDecodeMs ?? 0
  const previousRate = usage?.engineOutputTokensPerSecond ?? 0
  return {
    ...usage,
    engineDecodeMs: previousMs + ms,
    engineOutputTokensPerSecond: previousMs > 0 ? (previousRate * previousMs + rate * ms) / (previousMs + ms) : rate,
  }
}
