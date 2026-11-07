import { describe, expect, it, vi } from 'vitest'

vi.mock('@/app/renderer-application', () => ({
  rendererApplication: { sessions: { readSessionTranscriptWindow: vi.fn() } },
}))
import { calibrateContextTokens, findEngineContextAnchor } from './engine-context-anchor'
import type { Message } from '@shared/types'

const msg = (role: string, text: string, extra: Partial<Message> = {}): Message =>
  ({ id: `${role}-${text.length}`, role, contentParts: [{ type: 'text', text }], ...extra }) as Message

const LONG_TEXT = 'x '.repeat(400)

describe('findEngineContextAnchor', () => {
  it('picks the last completed assistant reply with an engine prompt measurement', () => {
    const messages = [
      msg('user', 'q1'),
      msg('assistant', 'a1', { usage: { inputTokens: 1000 } }),
      msg('user', 'q2'),
      msg('assistant', 'a2', { usage: { inputTokens: 2000 } }),
      msg('user', 'q3'),
    ]
    const anchor = findEngineContextAnchor(messages, 'm1')
    expect(anchor?.index).toBe(3)
    expect(anchor?.inputTokens).toBe(2000)
  })

  it('skips generating replies, missing usage and other-model replies', () => {
    const messages = [
      msg('assistant', 'old', { usage: { inputTokens: 900 }, modelId: 'other-model' }),
      msg('assistant', 'mid', { usage: { inputTokens: 1500 }, generating: true }),
      msg('assistant', 'plain', {}),
      msg('assistant', 'good', { usage: { inputTokens: 3000 }, modelId: 'm1' }),
    ]
    const anchor = findEngineContextAnchor(messages, 'm1')
    expect(anchor?.index).toBe(3)
    expect(anchor?.inputTokens).toBe(3000)
  })

  it('prefers the last-step prompt over the multi-step loop total', () => {
    // Work Mode replies store inputTokens as the sum across steps (field:
    // 4.13M stored where the monitor showed 377K); the anchor must use the
    // final step's size when the reply carries one.
    const messages = [
      msg('assistant', 'worky', { usage: { inputTokens: 4132732, lastStepInputTokens: 377021 } }),
    ]
    const anchor = findEngineContextAnchor(messages, 'm1')
    expect(anchor?.inputTokens).toBe(377021)
  })

  it('returns null when nothing is measured', () => {
    expect(findEngineContextAnchor([msg('user', 'q'), msg('assistant', 'a')], 'm1')).toBeNull()
  })
})

describe('calibrateContextTokens', () => {
  it('anchors on the engine number and only estimates the tail after it', () => {
    const anchorMsg = msg('assistant', LONG_TEXT, { usage: { inputTokens: 10000 } })
    const messages = [msg('user', 'older question that the anchor already includes'), anchorMsg, msg('user', 'new') ]
    const result = calibrateContextTokens({
      messages,
      model: { provider: 'custom-strata', modelId: 'qwen' },
      anchor: { index: 1, inputTokens: 10000 },
      estimatedTokens: 13000,
      pendingTokens: 50,
    })
    expect(result.calibrated).toBe(true)
    // The anchor's own text plus the new user turn are added on top of the
    // engine measurement; the older history is NOT re-estimated. The raw
    // estimate (13000) overshoots the whole history by the tokenizer gap.
    expect(result.tokens).toBeGreaterThan(10000)
    expect(result.tokens).toBeLessThan(13000)
    // The tail (anchor text + short new turn + draft) is small next to the
    // engine measurement, so the calibrated total stays near 10000.
    expect(result.tokens).toBeLessThan(10000 + 1200)
  })

  it('falls back to the raw estimate without an anchor', () => {
    const result = calibrateContextTokens({
      messages: [msg('user', 'q')],
      anchor: null,
      estimatedTokens: 777,
    })
    expect(result).toEqual({ tokens: 777, calibrated: false })
  })

  it('rejects a cumulative engine measurement (anchor far above the estimate)', () => {
    // Field case: lamina's running-total usage recorded 2.9M "prompt tokens"
    // on a chat whose real context estimate was ~333K; trusting it made the
    // badge read 1110%. The AI SDK sums usage across agent-loop steps, so
    // sums sit at 2x+ the estimate while tokenizer disagreement is ~1.5x
    // at most - the ratio is the discriminator, not the window.
    const messages = [msg('assistant', LONG_TEXT, { usage: { inputTokens: 2909841 } })]
    const result = calibrateContextTokens({
      messages,
      model: { provider: 'custom-strata', modelId: 'qwen' },
      anchor: { index: 0, inputTokens: 2909841 },
      estimatedTokens: 333000,
    })
    expect(result).toEqual({ tokens: 333000, calibrated: false })
  })

  it('accepts a genuine large prompt at the window edge (521K field case)', () => {
    // The window-cap guard used to reject these: a Work Mode chat grew past
    // a 524K window, the engine honestly measured 521K+, and the badge fell
    // back to the estimate and read "wrong" while benchmarking. A measurement
    // consistent with the estimate is real regardless of the window.
    const messages = [msg('assistant', LONG_TEXT, { usage: { inputTokens: 521000 } })]
    const result = calibrateContextTokens({
      messages,
      model: { provider: 'custom-strata', modelId: 'qwen' },
      anchor: { index: 0, inputTokens: 521000 },
      estimatedTokens: 520000,
    })
    expect(result.calibrated).toBe(true)
    expect(result.tokens).toBeGreaterThanOrEqual(521000)
  })

  it('never reports below the engine measurement itself', () => {
    const messages = [msg('assistant', 'tiny', { usage: { inputTokens: 5000 } })]
    const result = calibrateContextTokens({
      messages,
      model: { provider: 'custom-strata', modelId: 'qwen' },
      anchor: { index: 0, inputTokens: 5000 },
      // A plausible under-estimate (not an order of magnitude off) is
      // corrected upward to the measurement plus the reply's own tail.
      estimatedTokens: 4500,
    })
    expect(result.calibrated).toBe(true)
    expect(result.tokens).toBeGreaterThanOrEqual(5000)
    expect(result.tokens).toBeLessThan(5010)
  })
})
