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

  it('never reports below the engine measurement itself', () => {
    const messages = [msg('assistant', 'tiny', { usage: { inputTokens: 5000 } })]
    const result = calibrateContextTokens({
      messages,
      model: { provider: 'custom-strata', modelId: 'qwen' },
      anchor: { index: 0, inputTokens: 5000 },
      estimatedTokens: 100,
    })
    // The raw estimate (100) would hide the real size; the anchor measurement
    // plus the reply's own tail wins, and the floor keeps it >= 5000.
    expect(result.tokens).toBeGreaterThanOrEqual(5000)
    expect(result.tokens).toBeLessThan(5010)
  })
})
