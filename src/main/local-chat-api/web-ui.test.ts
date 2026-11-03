// @vitest-environment jsdom
import { fireEvent, waitFor } from '@testing-library/dom'
import { expect, it, vi } from 'vitest'
import { LOCAL_CHAT_WEB_UI } from './web-ui'

async function setup() {
  document.body.innerHTML = LOCAL_CHAT_WEB_UI.split('<body>')[1].split('<script>')[0]
  const history = {
    id: 'existing-chat',
    messages: [{ id: 'a', role: 'assistant', text: '<img src=x onerror=alert(1)>' }],
    generating: false,
  }
  let paired = false
  const fetch = vi.fn(
    async (url: string, options?: { method?: string; body?: string; headers?: Record<string, string> }) => {
      if (url === '/api/session' && options?.headers?.Authorization) paired = true
      if (!options?.headers?.Authorization && !paired)
        return { ok: false, json: async () => ({ error: 'Bearer token required' }) }
      return {
        ok: true,
        json: async () =>
          url.startsWith('/api/chats?')
            ? { items: [{ id: 'existing-chat', name: 'Desktop chat' }], nextCursor: null }
            : options?.method === 'POST'
              ? { messageId: 'new-message' }
              : history,
      }
    }
  )
  const sockets: FakeSocket[] = []
  class FakeSocket {
    onopen?: () => void
    onclose?: () => void
    onmessage?: (event: { data: string }) => void
    send = vi.fn()
    close = vi.fn()
    constructor() {
      sockets.push(this)
    }
  }
  const frame = vi.fn((callback: () => void) => callback())
  const script = LOCAL_CHAT_WEB_UI.match(/<script>([\s\S]*)<\/script>/)![1]
  new Function('document', 'fetch', 'WebSocket', 'requestAnimationFrame', script)(document, fetch, FakeSocket, frame)
  fireEvent.input(document.getElementById('token')!, { target: { value: 'private-test-token' } })
  fireEvent.submit(document.getElementById('connect-form')!)
  await waitFor(() => expect(document.getElementById('login')!.hidden).toBe(true))
  return { fetch, sockets, frame }
}

it('continues the selected desktop chat, renders response text safely, and sends no model configuration', async () => {
  const { fetch, sockets } = await setup()
  expect(document.getElementById('title')!.textContent).toBe('Desktop chat')
  expect(document.querySelector('#messages img')).toBeNull()
  expect(document.querySelector('.bubble')!.textContent).toContain('<img')
  sockets[0].onopen!()
  expect(sockets[0].send).toHaveBeenCalledWith(
    JSON.stringify({ type: 'subscribe', chatId: 'existing-chat', view: 'web' })
  )
  fireEvent.input(document.getElementById('content')!, { target: { value: 'Continue our desktop conversation' } })
  fireEvent.submit(document.getElementById('composer')!)
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/api/chats/existing-chat/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ content: 'Continue our desktop conversation' }),
      })
    )
  )
  expect(document.querySelectorAll('select').length).toBe(1) // Conversation choice only; no separate model picker.
})

it('updates a streamed message in place and follows only when already near the bottom', async () => {
  const { sockets, frame } = await setup()
  const area = document.getElementById('messages')!
  Object.defineProperty(area, 'scrollHeight', { configurable: true, value: 1000 })
  Object.defineProperty(area, 'clientHeight', { configurable: true, value: 400 })
  area.scrollTop = 0
  const originalBubble = document.querySelector('.bubble')
  frame.mockClear()
  const update = (text: string) =>
    sockets[0].onmessage!({
      data: JSON.stringify({
        type: 'chat.snapshot',
        status: 200,
        chat: {
          id: 'existing-chat',
          generating: true,
          messages: [{ id: 'a', role: 'assistant', text }],
        },
      }),
    })
  update('A partial reply')
  expect(document.querySelector('.bubble')).toBe(originalBubble)
  expect(originalBubble!.textContent).toBe('A partial reply')
  expect(frame).not.toHaveBeenCalled()
  area.scrollTop = 600
  update('A longer partial reply')
  expect(frame).toHaveBeenCalledOnce()
})
