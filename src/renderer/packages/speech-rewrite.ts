import type { ModelMessage } from 'ai'
import { settingsStore } from '@/stores/settingsStore'

// Model pass before the TTS server: the chat model rewrites a reply for the
// ear (expand symbols and abbreviations, narrate lists and tables, drop
// punctuation the voice would stumble on). The regex layer in
// text-to-speech.ts stays as the floor and as the fallback: this call is
// best-effort. Thinking is pinned to none per request - a rewrite must not
// pay for (or hide its work inside) reasoning tokens.
const REWRITE_PROMPT =
  'You prepare text for text-to-speech. Rewrite the user text so it sounds natural when read aloud. ' +
  'Say numbers, units, symbols, dates and abbreviations in words ("87 F" becomes "87 degrees Fahrenheit", "Dr." becomes "Doctor", "~" becomes "about"). ' +
  'Narrate lists and tables as short spoken sentences. ' +
  'Keep every fact and the same order. No markdown, no emoji, no parentheses, no headings, no commentary, no greeting, and never mention the rewrite. ' +
  'Output only the rewritten text.'

// Below this the regex layer is enough and an extra model round trip is pure
// latency in front of the first spoken word.
const MIN_CHARS = 80

// A rewrite is a pure function of the text; re-clicks, auto-read retries and
// browser speech requests must not pay for it twice.
const cache = new Map<string, string>()
const CACHE_MAX = 64

export type SpeechRewriteEligibility = { enabled?: boolean; rewrite?: boolean }

export function speechRewriteActive(settings: SpeechRewriteEligibility | undefined, text: string): boolean {
  return !!settings?.enabled && settings.rewrite !== false && text.length >= MIN_CHARS
}

export async function rewriteForSpeech(
  text: string,
  settings: SpeechRewriteEligibility | undefined,
  signal?: AbortSignal,
): Promise<string> {
  if (!speechRewriteActive(settings, text)) return text
  const key = `${text.length}:${text.slice(0, 220)}:${text.slice(-220)}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached
  try {
    const { createModel } = await import('@/adapters')
    const globalSettings = settingsStore.getState().getSettings()
    const chatModel = globalSettings.defaultChatModel
    if (!chatModel?.provider || !chatModel?.model) return text
    const model = await createModel({
      ...globalSettings,
      provider: chatModel.provider as never,
      modelId: chatModel.model,
    })
    const messages: ModelMessage[] = [
      { role: 'system', content: REWRITE_PROMPT },
      { role: 'user', content: text },
    ]
    const timeout = AbortSignal.timeout(20000)
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
    const result = await model.chat(messages, {
      signal: combined,
      providerOptions: { openaiCompatible: { reasoningEffort: 'none' } },
    })
    const rewritten = (result.contentParts || [])
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('')
      .trim()
    // Guard against a chatty rewrite: it must stay near the input size and
    // never come back empty or fenced.
    if (!rewritten || rewritten.startsWith('```') || rewritten.length > text.length * 1.6) return text
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
    cache.set(key, rewritten)
    return rewritten
  } catch {
    // Rewriting is optional polish; the regex-normalized text always speaks.
    return text
  }
}
