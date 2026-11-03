import { getSessionActionGate } from '@chatbox/core/session/action-gates'
import { getSessionLockStateNow } from '@/stores/session/action-guard'
import type { LocalChatCall, LocalChatResult } from '@shared/local-chat-api'
import { createMessage } from '@shared/types'
import { getMessageText } from '@shared/utils/message'
import { rendererApplication } from '@/app/renderer-application'
import { submitNewUserMessage } from '@/stores/session/messages'
import { isSessionGenerating } from '@/stores/sessionActivityStore'

const pendingChats = new Set<string>()
const errors = new Map<string, string>()

export async function handleLocalChatCall(call: LocalChatCall): Promise<LocalChatResult> {
  const sessions = rendererApplication.sessions
  try {
    if (call.action === 'create') {
      const { createEmpty } = await import('@/stores/session/crud')
      const session = await createEmpty('chat')
      return { status: 201, body: { id: session.id, name: session.name } }
    }
    if (call.action === 'list') {
      const offset = Number(call.cursor || 0)
      if (!Number.isInteger(offset) || offset < 0) return { status: 400, body: { error: 'Invalid chat list cursor' } }
      const page = await sessions.listSessionsMetaPage(offset, call.limit || 50)
      return {
        status: 200,
        body: {
          items: page.items
            .filter((s) => s.type === 'chat' || !s.type)
            .map((s) => ({ id: s.id, name: s.name, type: s.type })),
          nextCursor: page.nextCursor,
          total: page.total,
        },
      }
    }
    if (!call.chatId) return { status: 400, body: { error: 'chatId required' } }
    const source = await sessions.getSessionHeader(call.chatId)
    if (!source) return { status: 404, body: { error: 'Conversation not found' } }
    if (source.header.type && source.header.type !== 'chat')
      return { status: 400, body: { error: 'Only chat conversations are supported' } }
    if (call.action === 'speech') {
      if (!call.messageId || call.messageId.length > 200) return {status:400,body:{error:'messageId required'}}
      const result = await sessions.readSessionMessages({sessionId:call.chatId,messageIds:[call.messageId]})
      const message = result?.messages.find((item) => item.id === call.messageId)
      if (!message || message.role !== 'assistant') return {status:404,body:{error:'Assistant reply not found'}}
      if (message.generating || message.error) return {status:409,body:{error:'Wait for the reply to finish before reading'}}
      const { synthesizeWebReply } = await import('./local-chat-speech')
      return {status:200,body:await synthesizeWebReply(message)}
    }
    if (call.action === 'read') {
      const locks = await getSessionLockStateNow(call.chatId)
      let cursor
      try {
        cursor = call.cursor ? JSON.parse(call.cursor) : undefined
      } catch {
        return { status: 400, body: { error: 'Invalid history cursor' } }
      }
      const page = await sessions.readSessionTranscriptWindow({
        sessionId: call.chatId,
        expectedRevision: cursor?.revision ?? source.revision,
        limit: Math.min(call.limit || 50, 100),
        maxBytes: 2 * 1024 * 1024,
        ...(cursor ? { cursor } : { origin: 'tail' as const }),
      })
      return {
        status: 200,
        body: {
          id: call.chatId,
          name: source.header.name,
          revision: source.revision,
          generating: pendingChats.has(call.chatId) || isSessionGenerating(call.chatId),
          waitingForApproval: locks?.awaitingPauseDecision || false,
          compacting: locks?.compactionRunning || false,
          error: errors.get(call.chatId),
          messages: (page?.messages || [])
            .map((row) => ({
              ...row,
              message:
                rendererApplication.generationRuntime.getLiveMessage(call.chatId!, row.message.id) || row.message,
            }))
            .filter(({ message }) => message.role !== 'system')
            .map(({ message, threadId }) => ({
              id: message.id,
              threadId,
              role: message.role,
              text: getMessageText(message, true, false),
              generating: message.generating,
              error: message.error,
              timestamp: message.timestamp,
              model: message.model,
              thinking: message.generating && message.contentParts?.some((part) => part.type === 'reasoning'),
              performance: {
                inputTokens: message.usage?.inputTokens,
                outputTokens: message.usage?.outputTokens,
                totalTokens: message.usage?.totalTokens,
                cachedTokens: message.usage?.cachedInputTokens,
                generationTokensPerSecond: message.usage?.engineOutputTokensPerSecond,
                processingTokensPerSecond: message.usage?.engineInputTokensPerSecond,
                processedTokens: message.usage?.engineProcessedTokens,
                durationMs: message.generationDuration,
              },
              files: message.files?.map((f) => ({ name: f.name })),
            })),
          nextCursor: page?.older ? JSON.stringify(page.older) : null,
        },
      }
    }
    if (
      call.action !== 'send' ||
      typeof call.content !== 'string' ||
      !call.content.trim() ||
      call.content.length > 60000
    )
      return { status: 400, body: { error: 'Invalid message' } }
    if (pendingChats.has(call.chatId) || isSessionGenerating(call.chatId))
      return { status: 409, body: { error: 'Conversation is already generating' } }
    const locks = await getSessionLockStateNow(call.chatId)
    if (!locks) return { status: 404, body: { error: 'Conversation not found' } }
    const gate = getSessionActionGate('submit-message', locks)
    if (!gate.allowed) return { status: 409, body: { error: `Conversation blocked: ${gate.reason}` } }
    if (pendingChats.has(call.chatId))
      return { status: 409, body: { error: 'Conversation is already processing a message' } }
    const message = createMessage('user', call.content)
    message.suppressDesktopAutoRead = true
    const chatId = call.chatId
    pendingChats.add(chatId)
    errors.delete(chatId)
    // Exactly the controller used by routes/session/$sessionId.tsx's desktop Send handler.
    void submitNewUserMessage(chatId, { newUserMsg: message, needGenerating: true })
      .catch((error: unknown) => {
        errors.set(chatId, error instanceof Error ? error.message : 'Message processing failed')
      })
      .finally(() => {
        pendingChats.delete(chatId)
      })
    return { status: 202, body: { status: 'accepted', chatId, messageId: message.id } }
  } catch (error) {
    return {
      status: 409,
      body: { error: error instanceof Error ? error.message : 'Conversation changed; refresh and try again' },
    }
  }
}

export function initLocalChatApiBridge() {
  if (!window.electronAPI?.onLocalChatApiRequest) return
  return window.electronAPI.onLocalChatApiRequest(handleLocalChatCall)
}
