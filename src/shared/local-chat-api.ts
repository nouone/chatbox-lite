export type LocalChatCall = {
  action: 'list' | 'read' | 'send'
  chatId?: string
  content?: string
  cursor?: string
  limit?: number
}
export type LocalChatResult = { status: number; body: unknown }
export type LocalChatEnvelope = { id: string; call: LocalChatCall }

export const LOCAL_API_CHANNELS = {
  status: 'lite-api:status',
  configure: 'lite-api:configure',
  rotateToken: 'lite-api:rotate-token',
  copyToken: 'lite-api:copy-token',
  openBrowser: 'lite-api:open-browser',
} as const

export type LocalApiStatus = {
  enabled: boolean
  running: boolean
  port: number
  hasToken: boolean
  url: string
  error?: string
}
