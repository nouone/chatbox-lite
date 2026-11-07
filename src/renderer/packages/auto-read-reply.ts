import { isSuccessfulAssistantReply } from '@chatbox/core/session/message-success'
import type { Message } from '@shared/types'
import { type ResponseSpeechPlayer, responseSpeechText, type SpeechSettings, synthesizeSpeech } from './text-to-speech'
import { rewriteForSpeech } from './speech-rewrite'

interface AutoReadDependencies {
  getSettings(): SpeechSettings | undefined
  isOnScreen(sessionId: string): boolean
  isInputActive(): boolean
  request: typeof fetch
  player: Pick<ResponseSpeechPlayer, 'play'>
  onError(error: Error): void
}

/** Called once by the generation host after persistence, never by transcript rendering. */
export function createAutoReadCompletionHandler(dependencies: AutoReadDependencies) {
  const seen = new WeakSet<Message>()
  return async (sessionId: string, message: Message) => {
    if (seen.has(message)) return
    seen.add(message)
    const settings = dependencies.getSettings()
    if (
      message.suppressDesktopAutoRead ||
      !settings?.enabled ||
      !settings.autoRead ||
      !dependencies.isOnScreen(sessionId) ||
      dependencies.isInputActive() ||
      !isSuccessfulAssistantReply(message)
    )
      return
    const text = responseSpeechText(message)
    if (!text) return
    try {
      await dependencies.player.play(
        `${sessionId}:${message.id}`,
        async (signal) => {
          const spoken = await rewriteForSpeech(text, settings, sessionId, signal)
          return synthesizeSpeech(spoken, settings, dependencies.request, signal)
        },
        dependencies.onError
      )
    } catch (error) {
      dependencies.onError(error instanceof Error ? error : new Error('Automatic read-aloud failed.'))
    }
  }
}
