import { encodeDictationWav, LOCAL_SPEECH_MAX_SECONDS, LOCAL_SPEECH_SAMPLE_RATE } from '@shared/local-speech'

export async function recordingToWav(recording: Blob): Promise<ArrayBuffer> {
  const context = new AudioContext()
  try {
    const decoded = await context.decodeAudioData(await recording.arrayBuffer())
    if (!decoded.duration || decoded.duration > LOCAL_SPEECH_MAX_SECONDS + 1)
      throw new Error('Dictation is limited to 60 seconds.')
    const offline = new OfflineAudioContext(
      1,
      Math.min(
        Math.ceil(decoded.duration * LOCAL_SPEECH_SAMPLE_RATE),
        LOCAL_SPEECH_MAX_SECONDS * LOCAL_SPEECH_SAMPLE_RATE
      ),
      LOCAL_SPEECH_SAMPLE_RATE
    )
    const source = offline.createBufferSource()
    source.buffer = decoded
    source.connect(offline.destination)
    source.start()
    const mono = await offline.startRendering()
    return encodeDictationWav(mono.getChannelData(0))
  } finally {
    await context.close()
  }
}

export function appendDictation(draft: string, transcript: string): string {
  const text = transcript.trim()
  if (!text) return draft
  return `${draft}${draft && !/\s$/.test(draft) ? ' ' : ''}${text}`
}
