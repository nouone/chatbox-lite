import { MessageSchema } from '../../types/session'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createInitialState, processStreamChunk } from '@chatbox/core/generation'
import { streamText } from 'ai'
import { expect, it, vi } from 'vitest'
import { engineTimingExtractor, mergeEngineTiming } from './engine-timing'

it('keeps the reported rate exactly and weights multiple steps by decode duration', () => {
  const first = mergeEngineTiming(undefined, { chatboxEngineTiming: { tokensPerSecond: 68.1, decodeMs: 1000 } })
  expect(first?.engineOutputTokensPerSecond).toBe(68.1)
  const next = mergeEngineTiming(first, { chatboxEngineTiming: { tokensPerSecond: 100, decodeMs: 3000 } })
  expect(next?.engineOutputTokensPerSecond).toBeCloseTo(92.025)
  expect(mergeEngineTiming(next, undefined)).toBe(next)
})
it.each([0, -1, NaN, Infinity, '80'])('ignores invalid timing rate %s', async (rate) => {
  expect(
    await engineTimingExtractor.extractMetadata({
      parsedBody: { timings: { predicted_per_second: rate, predicted_ms: 1000 } },
    })
  ).toBeUndefined()
})
it('isolates timing state between requests and supports non-streaming responses', async () => {
  const a = engineTimingExtractor.createStreamExtractor()
  const b = engineTimingExtractor.createStreamExtractor()
  const body = { timings: { predicted_per_second: 68.1, predicted_ms: 1234 } }
  a.processChunk(body)
  a.processChunk({ choices: [] })
  expect(a.buildMetadata()).toEqual(await engineTimingExtractor.extractMetadata({ parsedBody: body }))
  expect(b.buildMetadata()).toBeUndefined()
})
it('carries final SSE timings through the actual SDK and stream processor into persisted usage', async () => {
  const frames = [
    { choices: [{ index: 0, delta: { role: 'assistant', content: 'Hello' }, finish_reason: null }] },
    {
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      usage: { prompt_tokens: 200, completion_tokens: 10, total_tokens: 210 },
      timings: { predicted_per_second: 68.1, predicted_ms: 146.8 },
    },
  ]
  const provider = createOpenAICompatible({
    name: 'test',
    baseURL: 'http://test/v1',
    metadataExtractor: engineTimingExtractor,
    fetch: vi.fn(
      async () =>
        new Response(frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join('') + 'data: [DONE]\n\n', {
          headers: { 'content-type': 'text/event-stream' },
        })
    ),
  })
  const result = streamText({ model: provider('test'), prompt: 'test' })
  let state = createInitialState()
  for await (const chunk of result.stream)
    state = (await processStreamChunk(chunk, state, { onFileReceived: vi.fn() })).state
  expect(state.usage?.outputTokens).toBe(10)
  expect(state.usage?.engineOutputTokensPerSecond).toBe(68.1)
  expect(state.finishReason).toBe('stop')
})

it('preserves engine timing through saved-message validation', () => {
  const saved = MessageSchema.parse({
    id: 'reply',
    role: 'assistant',
    contentParts: [],
    usage: { totalTokens: 210, engineOutputTokensPerSecond: 68.1, engineDecodeMs: 146.8 },
  })
  expect(saved.usage?.engineOutputTokensPerSecond).toBe(68.1)
})
