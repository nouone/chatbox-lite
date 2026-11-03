import { ModelProviderEnum, type SessionSettings } from './types'

export const SELECT_CHAT_MODEL_MESSAGE =
  'Select a chat model in this conversation before sending. Add your provider in Settings > Model Providers if needed.'

export function hasLiteModelSelection(settings: Pick<SessionSettings, 'provider' | 'modelId'> | undefined): boolean {
  return Boolean(settings?.provider?.trim() && settings.provider !== ModelProviderEnum.ChatboxAI && settings.modelId?.trim())
}

export function requireLiteModelSelection(settings: Pick<SessionSettings, 'provider' | 'modelId'>): void {
  if (!hasLiteModelSelection(settings)) throw new Error(SELECT_CHAT_MODEL_MESSAGE)
}

export function selectNewLiteChatModel(
  preferred: Pick<SessionSettings, 'provider' | 'modelId'> | undefined,
  lastUsed: Pick<SessionSettings, 'provider' | 'modelId'> | undefined
): Pick<SessionSettings, 'provider' | 'modelId'> | undefined {
  return [preferred, lastUsed].find(hasLiteModelSelection)
}
