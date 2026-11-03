export type LocalChatCall = {
  action: 'list' | 'read' | 'send'
  chatId?: string
  content?: string
  cursor?: string
  limit?: number
}
export type LocalChatResult = { status: number; body: unknown }
export type LocalChatEnvelope = { id: string; call: LocalChatCall }
