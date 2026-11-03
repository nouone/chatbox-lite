import { Readable } from 'node:stream'
import { EventEmitter } from 'node:events'
import { afterEach, expect, it, vi } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { startLocalChatApi } from './server'
const token = 'test-only-token-'.repeat(4)
const running: Awaited<ReturnType<typeof startLocalChatApi>>[] = []
afterEach(async () => {
  vi.useRealTimers()
  for (const server of running.splice(0)) await server.close()
})
async function setup() {
  const dispatch = vi.fn().mockResolvedValue({ status: 200, body: { items: [] } })
  const server = await startLocalChatApi({ port: 0, token, dispatch })
  running.push(server)
  const request = (
    url: string,
    options: { method?: string; headers?: Record<string, string>; body?: string; auth?: boolean } = {}
  ) =>
    new Promise<{ status: number; body: string; headers: Record<string, string> }>((resolve) => {
      const req = Readable.from(options.body ? [Buffer.from(options.body)] : []) as IncomingMessage
      Object.assign(req, {
        url,
        method: options.method || 'GET',
        headers: {
          host: '127.0.0.1:' + server.port,
          ...(options.auth === false ? {} : { authorization: 'Bearer ' + token }),
          ...options.headers,
        },
      })
      let status = 0
      let headers = {}
      const res = {
        headersSent: false,
        writeHead: (s: number, h: Record<string, string>) => {
          status = s
          headers = h
          res.headersSent = true
        },
        end: (body: string) => resolve({ status, body, headers }),
      }
      server.httpServer.emit('request', req, res as unknown as ServerResponse)
    })
  return { server, dispatch, request }
}
it('rejects missing credentials, hostile origins and Host headers before dispatch', async () => {
  const { request, dispatch } = await setup()
  expect((await request('/api/chats', { auth: false })).status).toBe(401)
  expect((await request('/api/chats', { headers: { origin: 'https://hostile.example' } })).status).toBe(403)
  expect((await request('/api/chats', { headers: { host: 'hostile.example' } })).status).toBe(403)
  expect(dispatch).not.toHaveBeenCalled()
})
it('routes list/history/send to the same renderer boundary', async () => {
  const { request, dispatch } = await setup()
  await request('/api/chats?limit=20&cursor=2')
  expect(dispatch).toHaveBeenLastCalledWith({ action: 'list', limit: 20, cursor: '2' })
  await request('/api/chats/chat-id')
  expect(dispatch).toHaveBeenLastCalledWith({ action: 'read', limit: 50, chatId: 'chat-id' })
  dispatch.mockResolvedValueOnce({ status: 202, body: { status: 'accepted' } })
  const response = await request('/api/chats/chat-id/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: 'my question' }),
  })
  expect(response.status).toBe(202)
  expect(dispatch).toHaveBeenLastCalledWith({ action: 'send', chatId: 'chat-id', content: 'my question', limit: 50 })
})
it('validates JSON, text, body size and pagination before invoking desktop', async () => {
  const { request, dispatch } = await setup()
  for (const body of ['{broken', '{}', '{"content":" "}', JSON.stringify({ content: 'x'.repeat(60001) })])
    expect(
      (
        await request('/api/chats/id/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        })
      ).status
    ).toBe(400)
  expect(
    (
      await request('/api/chats/id/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'x'.repeat(70000),
      })
    ).status
  ).toBe(413)
  expect((await request('/api/chats?limit=0')).status).toBe(400)
  expect(dispatch).not.toHaveBeenCalled()
})
it('serves a standalone browser page with no embedded token or external script', async () => {
  const { request } = await setup()
  const r = await request('/', { auth: false })
  expect(r.status).toBe(200)
  expect(r.body).toContain('Chatbox Lite Web')
  expect(r.body).not.toContain(token)
  expect(r.body).not.toMatch(/<script[^>]+src=/)
  expect(r.headers['Content-Security-Policy']).toContain("connect-src 'self'")
})
it('rejects WebSocket upgrades without authentication', async () => {
  const { server, dispatch } = await setup()
  const end = vi.fn()
  server.httpServer.emit(
    'upgrade',
    { url: '/api/events', headers: { host: '127.0.0.1:' + server.port } },
    { end },
    Buffer.alloc(0)
  )
  expect(end).toHaveBeenCalledWith(expect.stringContaining('403 Forbidden'))
  expect(dispatch).not.toHaveBeenCalled()
})
it('publishes snapshots from the renderer repository on authenticated subscriptions', async () => {
  const { server, dispatch } = await setup()
  vi.useFakeTimers()
  dispatch.mockResolvedValue({
    status: 200,
    body: { id: 'desktop-chat', messages: [{ role: 'assistant', text: 'partial reply' }] },
  })
  const socket = Object.assign(new EventEmitter(), { readyState: 1, bufferedAmount: 0, send: vi.fn(), close: vi.fn() })
  server.events.emit('connection', socket)
  socket.emit('message', JSON.stringify({ type: 'subscribe', chatId: 'desktop-chat' }))
  await vi.advanceTimersByTimeAsync(250)
  expect(dispatch).toHaveBeenCalledWith({ action: 'read', chatId: 'desktop-chat', limit: 100 })
  expect(JSON.parse(socket.send.mock.calls[0][0])).toMatchObject({
    type: 'chat.snapshot',
    chat: { id: 'desktop-chat' },
  })
  socket.emit('close')
})
