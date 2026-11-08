import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { WebSocketServer, WebSocket } from 'ws'
import {
  normalizeTailnetOrigin,
  normalizeLanAddress,
  type LocalChatCall,
  type LocalChatResult,
} from '../../shared/local-chat-api'
import { BROWSER_COOKIE, browserCookie, createBrowserPairing, readBrowserCookie } from './browser-pairing'
import { LOCAL_CHAT_WEB_UI } from './web-ui'
import { createWebChatPresentation } from './presentation'

class RequestError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}
async function readJson(req: IncomingMessage, limit = 65536) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new RequestError(415, 'Use application/json')
  let size = 0
  const chunks: Uint8Array[] = []
  const stream = req as IncomingMessage & { iterator(options: { destroyOnReturn: boolean }): AsyncIterable<Uint8Array> }
  for await (const chunk of stream.iterator({ destroyOnReturn: false })) {
    size += chunk.byteLength
    if (size > limit) {
      req.resume()
      throw new RequestError(413, 'Message body too large')
    }
    chunks.push(new Uint8Array(chunk))
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new RequestError(400, 'Invalid JSON')
  }
}

type Dispatch = (call: LocalChatCall) => Promise<LocalChatResult>
export async function startLocalChatApi(options: {
  port: number
  token: string
  dispatch: Dispatch
  publicOrigin?: string
  lanAddress?: string
}) {
  if (options.token.length < 32) throw new Error('The API token must have at least 32 characters.')
  let currentToken = options.token
  const publicOrigin = normalizeTailnetOrigin(options.publicOrigin)
  const lanAddress = normalizeLanAddress(options.lanAddress)
  const lanOrigin = lanAddress ? `http://${lanAddress}:${options.port}` : undefined
  const publicHost = publicOrigin ? new URL(publicOrigin).host : undefined
  const pairing = createBrowserPairing(() => currentToken)
  const browserAuthorized = (req: IncomingMessage) => pairing.valid(readBrowserCookie(req.headers.cookie))
  const secureCookie = (req: IncomingMessage) => Boolean(publicHost && req.headers.host === publicHost)

  const present = createWebChatPresentation()
  const authorized = (candidate: string) => {
    const a = new TextEncoder().encode(candidate),
      b = new TextEncoder().encode(currentToken)
    return a.length === b.length && timingSafeEqual(a, b)
  }
  const hostAllowed = (req: IncomingMessage) => {
    const host = req.headers.host || ''
    return (
      !req.headers['tailscale-funnel-request'] &&
      (host === `127.0.0.1:${port}` ||
        host === `localhost:${port}` ||
        Boolean(publicHost && host === publicHost) ||
        Boolean(lanAddress && host === `${lanAddress}:${port}`))
    )
  }
  const originAllowed = (req: IncomingMessage) =>
    !req.headers.origin ||
    req.headers.origin === `http://127.0.0.1:${port}` ||
    req.headers.origin === `http://localhost:${port}` ||
    Boolean(publicOrigin && req.headers.origin === publicOrigin) ||
    Boolean(lanOrigin && req.headers.origin === lanOrigin)
  const reply = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
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
            "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; media-src 'self' blob:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
        })
        res.end(LOCAL_CHAT_WEB_UI)
        return
      }
      if (req.method === 'POST' && url.pathname === '/api/pair') {
        const body = await readJson(req, 2048)
        const remembered = body?.remember === true
        const credential =
          typeof body?.code === 'string' && body.code.length <= 100 ? pairing.redeem(body.code, remembered) : undefined
        if (!credential) {
          reply(res, 401, { error: 'Pairing code expired or already used. Create a new code in Desktop.' })
          return
        }
        res.setHeader('Set-Cookie', browserCookie(credential, remembered, secureCookie(req)))
        reply(res, 200, { paired: true })
        return
      }
      if (req.method === 'POST' && url.pathname === '/api/logout') {
        res.setHeader(
          'Set-Cookie',
          `${BROWSER_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureCookie(req) ? '; Secure' : ''}`
        )
        reply(res, 200, { signedOut: true })
        return
      }
      if (!authorized(req.headers.authorization?.replace(/^Bearer /i, '') || '') && !browserAuthorized(req)) {
        reply(res, 401, { error: 'Bearer token required' })
        return
      }
      if (req.method === 'POST' && url.pathname === '/api/session') {
        const body = await readJson(req, 2048)
        const remembered = body?.remember === true
        res.setHeader('Set-Cookie', browserCookie(pairing.issue(remembered), remembered, secureCookie(req)))
        reply(res, 200, { paired: true })
        return
      }
      let call: LocalChatCall
      const match = /^\/api\/chats\/([^/]+)(\/messages)?$/.exec(url.pathname)
      const speechMatch = /^\/api\/chats\/([^/]+)\/messages\/([^/]+)\/speech$/.exec(url.pathname)
      if (req.method === 'POST' && url.pathname === '/api/voice/asr') {
        // Raw capture from a browser voice frontend: WAV bytes as base64
        // (~4.3MB per 10s at 16kHz mono; capped at 12MB decoded).
        const input: unknown = await readJson(req, 17 * 1024 * 1024)
        const audio = (input as { audio?: unknown } | null)?.audio
        if (typeof audio !== 'string' || !audio.length) {
          reply(res, 400, { error: 'audio must be base64 WAV bytes' })
          return
        }
        call = { action: 'asr', content: audio }
      } else if (req.method === 'POST' && url.pathname === '/api/voice/speak') {
        const input: unknown = await readJson(req, 16 * 1024)
        const text = (input as { text?: unknown } | null)?.text
        if (typeof text !== 'string' || !text.trim() || text.length > 4000) {
          reply(res, 400, { error: 'text must be non-empty (max 4000 characters)' })
          return
        }
        call = { action: 'speak', content: text }
      } else if (req.method === 'POST' && url.pathname === '/api/voice/note') {
        const input: unknown = await readJson(req, 1024)
        const msg = (input as { msg?: unknown } | null)?.msg
        if (typeof msg !== 'string' || !msg.trim()) {
          reply(res, 400, { error: 'msg required' })
          return
        }
        call = { action: 'voice-note', content: msg }
      } else if (req.method === 'POST' && speechMatch) {
        await readJson(req, 2048)
        call = {action:'speech',chatId:decodeURIComponent(speechMatch[1]),messageId:decodeURIComponent(speechMatch[2])}
      } else if (req.method === 'POST' && url.pathname === '/api/chats') {
        if (Number(req.headers['content-length'] || 0) > 0 || req.headers['transfer-encoding'])
          await readJson(req, 1024)
        call = { action: 'create' }
      } else if (req.method === 'GET' && url.pathname === '/api/chats') call = { action: 'list' }
      else if (req.method === 'GET' && match && !match[2])
        call = { action: 'read', chatId: decodeURIComponent(match[1]) }
      else if (req.method === 'POST' && match?.[2]) {
        const input: unknown = await readJson(req)
        const content = (input as { content?: unknown } | null)?.content
        if (typeof content !== 'string' || !content.trim() || content.length > 60000) {
          reply(res, 400, { error: 'content must be non-empty text (max 60000 characters)' })
          return
        }
        // Optional per-send thinking level (voice clients). Unknown values are
        // rejected instead of ignored: silently dropping a caller's chosen
        // reasoning budget is exactly the confusion this field exists to end.
        const rawEffort = (input as { thinkingEffort?: unknown } | null)?.thinkingEffort
        if (
          rawEffort !== undefined &&
          rawEffort !== null &&
          !['off', 'low', 'medium', 'high'].includes(String(rawEffort))
        ) {
          reply(res, 400, { error: 'thinkingEffort must be off, low, medium or high' })
          return
        }
        const thinkingEffort =
          rawEffort === undefined || rawEffort === null
            ? undefined
            : (String(rawEffort) as 'off' | 'low' | 'medium' | 'high')
        call = { action: 'send', chatId: decodeURIComponent(match[1]), content, ...(thinkingEffort ? { thinkingEffort } : {}) }
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
      if (call.action === 'speech' && result.status === 200) {
        const audio = result.body as {audioBase64?: unknown;contentType?: unknown}
        if (typeof audio?.audioBase64 !== 'string' || !audio.audioBase64.length || audio.audioBase64.length > 12 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(audio.audioBase64)) {
          reply(res, 502, {error:'Desktop returned invalid speech audio'})
          return
        }
        const buffer = Buffer.from(audio.audioBase64, 'base64')
        if (buffer.length > 8 * 1024 * 1024) {reply(res,502,{error:'Speech audio is too large'});return}
        res.writeHead(200, {'Content-Type':'audio/mpeg','Content-Length':buffer.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})
        res.end(buffer)
        return
      }
      const output = call.action === 'read' && url.searchParams.get('view') === 'web' ? present(result) : result
      reply(res, output.status, output.body)
    } catch (error) {
      if (error instanceof RequestError && !res.headersSent) {
        reply(res, error.status, { error: error.message })
        return
      }
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
      (!authorized(token) && !browserAuthorized(req)) ||
      sockets.clients.size >= 8
    ) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
      return
    }
    sockets.handleUpgrade(req, socket, head, (ws) => sockets.emit('connection', ws))
  })
  sockets.on('connection', (ws) => {
    let chatId: string | undefined
    let browserView = false
    let busy = false
    let previous = ''
    // Liveness: unanswered pings mean the peer is gone (mobile NAT drops idle
    // sockets invisibly - the server would otherwise keep "sending" into a
    // black hole and the page would only notice via its own watchdog).
    let pongSeen = true
    ws.on('pong', () => { pongSeen = true })
    const heartbeat = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return
      if (!pongSeen) {
        ws.terminate()
        return
      }
      pongSeen = false
      ws.ping()
    }, 10000)
    ws.on('error', () => undefined)
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        if (message.type !== 'subscribe' || typeof message.chatId !== 'string' || message.chatId.length > 200)
          throw new Error()
        chatId = message.chatId
        browserView = message.view === 'web'
        previous = ''
      } catch {
        ws.close(1008, 'Send a subscribe message with chatId')
      }
    })
    const timer = setInterval(async () => {
      if (busy || !chatId || ws.readyState !== WebSocket.OPEN) return
      busy = true
      try {
        const raw = await options.dispatch({ action: 'read', chatId, limit: 100 })
        const result = browserView ? present(raw) : raw
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
    ws.once('close', () => { clearInterval(timer); clearInterval(heartbeat) })
  })
  const lanServer = lanAddress
    ? createServer(server.listeners('request')[0] as import('node:http').RequestListener)
    : undefined
  if (lanServer) {
    lanServer.requestTimeout = server.requestTimeout
    lanServer.headersTimeout = server.headersTimeout
    lanServer.on('upgrade', server.listeners('upgrade')[0] as never)
  }
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (address && typeof address !== 'string') port = address.port
  if (lanServer) {
    try {
      await new Promise<void>((resolve, reject) => {
        lanServer.once('error', reject)
        lanServer.listen(port, lanAddress, resolve)
      })
    } catch (error) {
      server.close()
      sockets.close()
      throw error
    }
  }
  return {
    port,
    httpServer: server,
    createPairing: (scope?: string) => {
      return pairing.create(scope)
    },
    events: sockets,
    setToken: (token: string) => {
      if (token.length < 32) throw new Error('The API token must have at least 32 characters.')
      currentToken = token
      pairing.cancel()
      for (const ws of sockets.clients) ws.terminate()
      server.closeAllConnections()
      lanServer?.closeAllConnections()
    },
    close: async () => {
      for (const ws of sockets.clients) ws.terminate()
      sockets.close()
      server.closeAllConnections()
      lanServer?.closeAllConnections()
      await Promise.all([
        new Promise<void>((resolve) => server.close(() => resolve())),
        ...(lanServer ? [new Promise<void>((resolve) => lanServer.close(() => resolve()))] : []),
      ])
    },
  }
}
