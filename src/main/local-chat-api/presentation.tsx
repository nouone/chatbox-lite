import { renderToStaticMarkup } from 'react-dom/server'
import { MessageMarkdown } from '../../shared/components/MessageMarkdown'
import type { LocalChatResult } from '../../shared/local-chat-api'

/** Presentation only. The desktop controller still owns messages and generation. */
export function createWebChatPresentation() {
  const cache = new Map<string, { text: string; html: string }>()
  let cachedCharacters = 0
  return (result: LocalChatResult): LocalChatResult => {
    if (result.status !== 200 || !result.body || typeof result.body !== 'object') return result
    const body = result.body as { id?: string; messages?: unknown[] }
    if (!Array.isArray(body.messages)) return result
    return {
      ...result,
      body: {
        ...body,
        messages: body.messages.map((message) => {
          if (!message || typeof message !== 'object') return message
          const item = message as { id?: string; role?: string; text?: string }
          if (item.role !== 'assistant' || typeof item.text !== 'string') return message
          const key = `${body.id}\0${item.id}`
          const previous = cache.get(key)
          let html = previous?.text === item.text ? previous.html : undefined
          if (html === undefined) {
            html =
              item.text.length > 200000
                ? renderToStaticMarkup(<pre>{item.text}</pre>)
                : renderToStaticMarkup(<MessageMarkdown browserView>{item.text}</MessageMarkdown>)
            if (previous) cachedCharacters -= previous.text.length + previous.html.length
            cache.set(key, { text: item.text, html })
            cachedCharacters += item.text.length + html.length
            while (cache.size > 128 || cachedCharacters > 2 * 1024 * 1024) {
              const first = cache.keys().next().value
              if (first === undefined) break
              const entry = cache.get(first)!
              cachedCharacters -= entry.text.length + entry.html.length
              cache.delete(first)
            }
          }
          return { ...message, renderedHtml: html }
        }),
      },
    }
  }
}
