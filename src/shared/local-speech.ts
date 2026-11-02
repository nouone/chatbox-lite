export const LOCAL_SPEECH_CHANNELS = { status: 'local-speech:status', transcribe: 'local-speech:transcribe' } as const
export const LOCAL_SPEECH_SAMPLE_RATE = 16000
export const LOCAL_SPEECH_MAX_SECONDS = 60

/** The renderer sends a fixed, mono PCM WAV rather than arbitrary files or process arguments. */
export function encodeDictationWav(samples: Float32Array): ArrayBuffer {
  if (!samples.length || samples.length > LOCAL_SPEECH_SAMPLE_RATE * LOCAL_SPEECH_MAX_SECONDS) {
    throw new Error('Record between a fraction of a second and 60 seconds of speech.')
  }
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  write(0, 'RIFF')
  view.setUint32(4, buffer.byteLength - 8, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, LOCAL_SPEECH_SAMPLE_RATE, true)
  view.setUint32(28, LOCAL_SPEECH_SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const sample = Number.isFinite(samples[i]) ? Math.max(-1, Math.min(1, samples[i])) : 0
    view.setInt16(44 + i * 2, sample * (sample < 0 ? 32768 : 32767), true)
  }
  return buffer
}

export function validateDictationWav(buffer: ArrayBuffer): void {
  if (
    !(buffer instanceof ArrayBuffer) ||
    buffer.byteLength <= 44 ||
    buffer.byteLength > 44 + LOCAL_SPEECH_SAMPLE_RATE * LOCAL_SPEECH_MAX_SECONDS * 2
  ) {
    throw new Error('Invalid dictation audio length.')
  }
  const view = new DataView(buffer)
  const text = (offset: number, length: number) => String.fromCharCode(...new Uint8Array(buffer, offset, length))
  if (
    text(0, 4) !== 'RIFF' ||
    text(8, 4) !== 'WAVE' ||
    text(12, 4) !== 'fmt ' ||
    text(36, 4) !== 'data' ||
    view.getUint32(4, true) !== buffer.byteLength - 8 ||
    view.getUint32(16, true) !== 16 ||
    view.getUint16(20, true) !== 1 ||
    view.getUint16(22, true) !== 1 ||
    view.getUint32(24, true) !== LOCAL_SPEECH_SAMPLE_RATE ||
    view.getUint32(28, true) !== LOCAL_SPEECH_SAMPLE_RATE * 2 ||
    view.getUint16(32, true) !== 2 ||
    view.getUint16(34, true) !== 16 ||
    view.getUint32(40, true) !== buffer.byteLength - 44 ||
    (buffer.byteLength - 44) % 2 !== 0
  ) {
    throw new Error('Dictation requires mono, 16 kHz, 16-bit PCM WAV audio.')
  }
}
