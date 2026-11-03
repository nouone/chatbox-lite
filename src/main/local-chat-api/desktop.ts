import { randomBytes, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { app, ipcMain, type BrowserWindow } from 'electron'
import type { LocalChatCall, LocalChatResult } from '../../shared/local-chat-api'
import { startLocalChatApi } from './server'

/** IPC transports commands only; all chat state and generation stay in the renderer. */
export function registerLocalChatApi(getWindow: () => BrowserWindow | null) {
  if (process.env.CBL_API_ENABLED !== '1') return
  let ready = false
  const pending = new Map<string, { resolve: (value: LocalChatResult) => void; timer: ReturnType<typeof setTimeout> }>()
  ipcMain.on('lite-api:ready', (event) => {
    if (event.sender === getWindow()?.webContents) {
      ready = true
      console.info('[Lite API] Desktop controller ready')
    }
  })
  ipcMain.on('lite-api:response', (event, id: string, result: LocalChatResult) => {
    if (event.sender !== getWindow()?.webContents) return
    const request = pending.get(id)
    if (!request) return
    clearTimeout(request.timer)
    pending.delete(id)
    request.resolve(result)
  })
  const dispatch = (call: LocalChatCall) =>
    new Promise<LocalChatResult>((resolve) => {
      const window = getWindow()
      if (!ready || !window || window.isDestroyed() || window.webContents.isLoading()) {
        resolve({ status: 503, body: { error: 'Desktop chat controller is not ready' } })
        return
      }
      if (pending.size >= 32) {
        resolve({ status: 429, body: { error: 'Too many pending API requests' } })
        return
      }
      const id = randomUUID()
      const timer = setTimeout(() => {
        pending.delete(id)
        resolve({
          status: 504,
          body: { error: 'Desktop request timed out; check conversation before retrying a send' },
        })
      }, 15000)
      pending.set(id, { resolve, timer })
      window.webContents.send('lite-api:request', { id, call })
    })
  return async () => {
    const port = Number(process.env.CBL_API_PORT || 8085)
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('CBL_API_PORT must be 1 to 65535')
    const tokenPath = path.join(app.getPath('userData'), 'local-api-token.txt')
    let token = process.env.CBL_API_TOKEN || ''
    if (!token) {
      try {
        token = fs.readFileSync(tokenPath, 'utf8').trim()
      } catch {}
      if (token.length < 32) {
        token = randomBytes(32).toString('hex')
        fs.writeFileSync(tokenPath, token, { mode: 0o600 })
      }
    }
    const server = await startLocalChatApi({ port, token, dispatch })
    console.info(
      `[Lite API] http://127.0.0.1:${server.port} (token ${process.env.CBL_API_TOKEN ? 'supplied by environment' : 'file: ' + tokenPath})`
    )
    getWindow()?.webContents.on('did-start-loading', () => {
      ready = false
    })
    app.once('before-quit', () => {
      void server.close()
    })
    return server
  }
}
