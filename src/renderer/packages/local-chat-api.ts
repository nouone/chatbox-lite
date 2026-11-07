import { getSessionActionGate } from '@chatbox/core/session/action-gates'
import { getSessionLockStateNow } from '@/stores/session/action-guard'
import type { LocalChatCall, LocalChatResult } from '@shared/local-chat-api'
import { createMessage } from '@shared/types'
import { getMessageText } from '@shared/utils/message'
import { rendererApplication } from '@/app/renderer-application'
import { getLogger } from '@/lib/utils'
import { settingsStore } from '@/stores/settingsStore'
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
    if (call.action === 'asr') {
      // Voice frontend audio (WAV bytes as base64) -> configured ASR server.
      // desktopDirectRequest bypass CORS like read-aloud does for Kokoro.
      const asrUrl = settingsStore.getState().getSettings().textToSpeech?.asrUrl?.trim()
      if (!asrUrl) return { status: 409, body: { error: 'Set a transcription server URL in Desktop Settings > Default Models first.' } }
      if (!call.content || call.content.length > 12 * 1024 * 1024) return { status: 400, body: { error: 'Invalid audio payload' } }
      const { desktopDirectRequestFromWindow } = await import('@/utils/desktop-direct-request')
      try {
        const binary = atob(call.content)
        const audio = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) audio[i] = binary.charCodeAt(i)
        const asrKey = settingsStore.getState().getSettings().textToSpeech?.asrKey?.trim()
        const response = await desktopDirectRequestFromWindow(
          asrUrl.replace(/\/+$/, '') + '/v1/audio/transcriptions/raw',
          'POST',
          new Headers({ 'Content-Type': 'audio/wav', ...(asrKey ? { Authorization: `Bearer ${asrKey}` } : {}) }),
          audio,
          AbortSignal.timeout(30000)
        )
        if (!response.ok) return { status: 502, body: { error: `Transcription server returned HTTP ${response.status}.` } }
        const parsed = (await response.json()) as { text?: unknown }
        if (typeof parsed.text !== 'string') return { status: 502, body: { error: 'Transcription server returned no text.' } }
        return { status: 200, body: { text: parsed.text.trim() } }
      } catch (error) {
        return { status: 502, body: { error: error instanceof Error ? error.message : 'Transcription failed.' } }
      }
    }
    if (call.action === 'speak') {
      // Voice frontend sentence pipelining: synthesize free text with the
      // configured read-aloud voice (same rewrite + normalization as replies).
      const text = typeof call.content === 'string' ? call.content.trim() : ''
      if (!text) return { status: 400, body: { error: 'content required' } }
      if (text.length > 4000) return { status: 400, body: { error: 'Sentence too long to speak in one request.' } }
      try {
        const { synthesizeSpeechText } = await import('./local-chat-speech')
        const blob = await synthesizeSpeechText(text, AbortSignal.timeout(60000))
        if (blob.size > 8 * 1024 * 1024) return { status: 502, body: { error: 'Speech audio exceeds the playback limit.' } }
        const bytes = new Uint8Array(await blob.arrayBuffer())
        let encoded = ''
        for (let i = 0; i < bytes.length; i += 32768) encoded += String.fromCharCode(...bytes.subarray(i, i + 32768))
        return { status: 200, body: { audioBase64: btoa(encoded), contentType: blob.type || 'audio/mpeg' } }
      } catch (error) {
        return { status: 502, body: { error: error instanceof Error ? error.message : 'Speech synthesis failed.' } }
      }
    }
    if (call.action === 'voice-note') {
      // Decision-mirror log lines from the voice frontend: one line per call,
      // prefixed voice: so field logs stay greppable from the desktop app.
      const msg = typeof call.content === 'string' ? call.content.slice(0, 200) : ''
      if (msg) getLogger('voice').info(`page: ${msg}`)
      return { status: 200, body: { ok: true } }
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
      return {status:200,body:await synthesizeWebReply(message, call.chatId)}
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
    if (call.thinkingEffort) {
      try {
        await applyThinkingEffort(chatId, call.thinkingEffort)
      } catch (error) {
        return {
          status: 500,
          body: { error: error instanceof Error ? `thinkingEffort failed: ${error.message}` : 'thinkingEffort could not be applied' },
        }
      }
    }
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

// Persist the caller's per-send thinking level the same way the desktop
// Thinking Effort selector does: build the provider options for the
// conversation's model with the shared level helper (capability-gated, and
// off maps to the provider's explicit none), then write them into the
// session header settings where the generation service resolves them.
async function applyThinkingEffort(sessionId: string, level: 'off' | 'low' | 'medium' | 'high') {
  const { getReasoningProviderOptions, resolveReasoningProviderOptions, setReasoningProviderOptionsForModel } =
    await import('@shared/utils/reasoning-control')
  const { settingsStore } = await import('@/stores/settingsStore')
  await rendererApplication.sessions.updateSessionHeader(sessionId, (session) => {
    if (!session) throw new Error('Session not found')
    const settings = session.settings || {}
    const store = settingsStore.getState()
    const defaults = store.getSettings()
    const providerId = settings.provider || defaults.defaultChatModel?.provider
    const modelId = settings.modelId || defaults.defaultChatModel?.model
    if (!providerId || !modelId) throw new Error('No chat model is selected for this conversation')
    // Custom-provider lookup mirroring modals/ModelEdit.tsx (the surface where
    // the "Strata Thinking control" flag lives); a missing entry is not an
    // error: the capability check below then no-ops and the send proceeds.
    // Models sit on provider.models or provider.defaultSettings.models, the
    // same dual shape ReasoningControlButton accepts.
    const providerInfo = (store.customProviders || []).find((item) => item.id === providerId) as
      | { models?: { modelId: string }[]; defaultSettings?: { models?: { modelId: string }[] } }
      | undefined
    const modelList = providerInfo?.models || providerInfo?.defaultSettings?.models
    const modelInfo = modelList?.find((item) => item.modelId === modelId) || null
    const previous = resolveReasoningProviderOptions(settings, providerId, modelId)
    const next = getReasoningProviderOptions(providerId as never, modelInfo as never, level, previous)
    return {
      ...session,
      settings: {
        ...settings,
        ...setReasoningProviderOptionsForModel(settings, providerId, modelId, next),
      },
    }
  })
}
