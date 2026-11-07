import type { Message } from '@shared/types'
import { settingsStore } from '@/stores/settingsStore'
import { desktopDirectRequestFromWindow } from '@/utils/desktop-direct-request'
import { responseSpeechText, synthesizeSpeech } from './text-to-speech'
import { rewriteForSpeech } from './speech-rewrite'

let busy = false
/** Same synthesis and normalization as Desktop; audio is returned, never played here. */
export async function synthesizeWebReply(message: Message, sessionId?: string) {
  const settings = settingsStore.getState().getSettings().textToSpeech
  if (!settings?.enabled) throw new Error('Enable Read aloud in Desktop Settings > Default Models first.')
  const text = responseSpeechText(message)
  if (!text) throw new Error('This reply has no text to read.')
  if (text.length > 20000) throw new Error('This reply is too long to read in one request.')
  if (busy) throw new Error('Another speech request is still being prepared. Try again shortly.')
  busy = true
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 110000)
  try {
    const request: typeof fetch = (url, init) => desktopDirectRequestFromWindow(
      String(url), 'POST', new Headers(init?.headers), init?.body, init?.signal ?? undefined
    )
    const spoken = await rewriteForSpeech(text, settings, sessionId, controller.signal)
    const blob = await synthesizeSpeech(spoken, settings, request, controller.signal)
    if (blob.size > 8 * 1024 * 1024) throw new Error('Speech audio exceeds the browser playback limit.')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let binary = ''
    for (let i=0;i<bytes.length;i+=32768) binary += String.fromCharCode(...bytes.subarray(i,i+32768))
    return {audioBase64:btoa(binary),contentType:'audio/mpeg'}
  } finally {
    clearTimeout(timer)
    busy = false
  }
}
