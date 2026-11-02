import { ipcMain } from 'electron'
import { LOCAL_SPEECH_CHANNELS } from '../shared/local-speech'
import { LocalSpeechTranscriber } from './local-speech'

export function registerLocalSpeechHandlers(assets: string) {
  const transcriber = new LocalSpeechTranscriber(assets)
  ipcMain.handle(LOCAL_SPEECH_CHANNELS.status, () => transcriber.ready())
  ipcMain.handle(LOCAL_SPEECH_CHANNELS.transcribe, async (event, audio: ArrayBuffer) => {
    const controller = new AbortController()
    const cancel = () => controller.abort()
    event.sender.once('destroyed', cancel)
    try {
      return await transcriber.transcribe(audio, controller.signal)
    } finally {
      if (!event.sender.isDestroyed()) event.sender.removeListener('destroyed', cancel)
    }
  })
}
