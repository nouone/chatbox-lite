import { describe, expect, it } from 'vitest'
import { encodeDictationWav, validateDictationWav } from './local-speech'

describe('dictation WAV boundary', () => {
  it('encodes a mono 16 kHz PCM WAV and clips samples', () => {
    const wav = encodeDictationWav(new Float32Array([-2, -0.5, 0, 0.5, 2, Number.NaN]))
    expect(() => validateDictationWav(wav)).not.toThrow()
    const data = new DataView(wav)
    expect(data.getUint32(24, true)).toBe(16000)
    expect(data.getUint16(22, true)).toBe(1)
    expect(data.getInt16(44, true)).toBe(-32768)
    expect(data.getInt16(52, true)).toBe(32767)
    expect(data.getInt16(54, true)).toBe(0)
  })
  it('rejects empty, oversized and malformed audio', () => {
    expect(() => encodeDictationWav(new Float32Array())).toThrow()
    expect(() => encodeDictationWav(new Float32Array(16000 * 61))).toThrow()
    expect(() => validateDictationWav(new ArrayBuffer(100))).toThrow()
    const wav = encodeDictationWav(new Float32Array([0, 0]))
    new DataView(wav).setUint32(24, 48000, true)
    expect(() => validateDictationWav(wav)).toThrow('16 kHz')
  })
})
