import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { WebSocketServer, WebSocket } from 'ws'
import type { LocalChatCall, LocalChatResult } from '../../shared/local-chat-api'
import { LOCAL_CHAT_WEB_UI } from './web-ui'

type Dispatch = (call: LocalChatCall) => Promise<LocalChatResult>
export async function startLocalChatApi(options: { port: number; token: string; dispatch: Dispatch }) {
  if (options.token.length < 32) throw new Error('The API token must have at least 32 characters.')
  let currentToken = options.token
  const authorized = (candidate: string) => {
    const a = new TextEncoder().encode(candidate),
      b = new TextEncoder().encode(currentToken)
    return a.length === b.length && timingSafeEqual(a, b)
  }
  const hostAllowed = (req: IncomingMessage) => {
    const host = req.headers.host || ''
    return host === `127.0.0.1:${port}` || host === `localhost:${port}`
  }
  const originAllowed = (req: IncomingMessage) =>
    !req.headers.origin ||
    req.headers.origin === `http://127.0.0.1:${port}` ||
    req.headers.origin === `http://localhost:${port}`
  const reply = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    res.end(JSON.stringify(body))
  }
  let port = options.port
  const server = createServer(async (req, res) => {
    try {
      if (!hostAllowed(req) || !originAllowed(req)) {
        reply(res, 403, { error: 'Origin or Host rejected' })
        return
      }
      const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
      if (req.method === 'GET' && url.pathname === '/api/status') {
        reply(res, 200, { app: 'chatbox-lite', apiVersion: 1 })
        return
      }
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Security-Policy':
            "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
        })
        res.end(LOCAL_CHAT_WEB_UI)
        return
      }
      if (!authorized(req.headers.authorization?.replace(/^Bearer /i, '') || '')) {
        reply(res, 401, { error: 'Bearer token required' })
        return
      }
      let call: LocalChatCall
      const match = /^\/api\/chats\/([^/]+)(\/messages)?$/.exec(url.pathname)
      if (req.method === 'GET' && url.pathname === '/api/chats') call = { action: 'list' }
      else if (req.method === 'GET' && match && !match[2])
        call = { action: 'read', chatId: decodeURIComponent(match[1]) }
      else if (req.method === 'POST' && match?.[2]) {
        if (!req.headers['content-type']?.startsWith('application/json')) {
          reply(res, 415, { error: 'Use application/json' })
          return
        }
        let size = 0
        const chunks: Uint8Array[] = []
        // Node 22 supports iterator(); the older Electron Node typings omit it.
        const bodyStream = req as IncomingMessage & {
          iterator(options: { destroyOnReturn: boolean }): AsyncIterable<Uint8Array>
        }
        for await (const chunk of bodyStream.iterator({ destroyOnReturn: false })) {
          size += Buffer.byteLength(chunk)
          if (size > 65536) {
            req.resume()
            reply(res, 413, { error: 'Message body too large' })
            return
          }
          chunks.push(new Uint8Array(chunk))
        }
        let input: unknown
        try {
          input = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        } catch {
          reply(res, 400, { error: 'Invalid JSON' })
          return
        }
        const content = (input as { content?: unknown } | null)?.content
        if (typeof content !== 'string' || !content.trim() || content.length > 60000) {
          reply(res, 400, { error: 'content must be non-empty text (max 60000 characters)' })
          return
        }
        call = { action: 'send', chatId: decodeURIComponent(match[1]), content }
      } else {
        reply(res, 404, { error: 'Route not found' })
        return
      }
      if (url.searchParams.has('cursor')) call.cursor = url.searchParams.get('cursor') || undefined
      const limit = Number(url.searchParams.get('limit') || 50)
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        reply(res, 400, { error: 'limit must be 1 to 100' })
        return
      }
      call.limit = limit
      const result = await options.dispatch(call)
      reply(res, result.status, result.body)
    } catch {
      if (!res.headersSent) reply(res, 503, { error: 'Desktop chat controller unavailable' })
    }
  })
  server.requestTimeout = 15000
  server.headersTimeout = 10000
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 4096, handleProtocols: () => 'cbl-api' })
  server.on('upgrade', (req, socket, head) => {
    const protocols = String(req.headers['sec-websocket-protocol'] || '')
      .split(',')
      .map((v) => v.trim())
    const token =
      req.headers.authorization?.replace(/^Bearer /i, '') || (protocols[0] === 'cbl-api' ? protocols[1] : '') || ''
    if (
      req.url !== '/api/events' ||
      !hostAllowed(req) ||
      !originAllowed(req) ||
      !authorized(token) ||
      sockets.clients.size >= 8
    ) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
      return
    }
    sockets.handleUpgrade(req, socket, head, (ws) => sockets.emit('connection', ws))
  })
  sockets.on('connection', (ws) => {
    let chatId: string | undefined
    let busy = false
    let previous = ''
    ws.on('error', () => undefined)
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        if (message.type !== 'subscribe' || typeof message.chatId !== 'string' || message.chatId.length > 200)
          throw new Error()
        chatId = message.chatId
        previous = ''
      } catch {
        ws.close(1008, 'Send a subscribe message with chatId')
      }
    })
    const timer = setInterval(async () => {
      if (busy || !chatId || ws.readyState !== WebSocket.OPEN) return
      busy = true
      try {
        const result = await options.dispatch({ action: 'read', chatId, limit: 100 })
        const snapshot = JSON.stringify({ type: 'chat.snapshot', status: result.status, chat: result.body })
        if (snapshot !== previous && ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 2 * 1024 * 1024) {
          ws.send(snapshot)
          previous = snapshot
        }
      } catch {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'error', error: 'Desktop unavailable' }))
      } finally {
        busy = false
      }
    }, 250)
    ws.once('close', () => clearInterval(timer))
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (address && typeof address !== 'string') port = address.port
  return {
    port,
    httpServer: server,
    events: sockets,
    setToken: (token: string) => {
      if (token.length < 32) throw new Error('The API token must have at least 32 characters.')
      currentToken = token
      for (const ws of sockets.clients) ws.terminate()
      server.closeAllConnections()
    },
    close: async () => {
      for (const ws of sockets.clients) ws.terminate()
      sockets.close()
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }
}
