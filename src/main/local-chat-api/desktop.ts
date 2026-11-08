import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { app, clipboard, ipcMain, shell, type BrowserWindow } from 'electron'
import { LOCAL_API_CHANNELS } from '../../shared/local-chat-api'
import type { LocalChatCall, LocalChatResult } from '../../shared/local-chat-api'
import { startLocalChatApi } from './server'
import { createLocalApiManager } from './manager'

/** IPC transports commands only; all chat state and generation stay in the renderer. */
export function registerLocalChatApi(getWindow: () => BrowserWindow | null) {
  let ready = false
  const pending = new Map<string, { resolve: (value: LocalChatResult) => void; timer: ReturnType<typeof setTimeout> }>()
  ipcMain.on('lite-api:ready', (event) => {
    if (event.sender === getWindow()?.webContents && event.senderFrame === getWindow()?.webContents.mainFrame) {
      ready = true
      console.info('[Lite API] Desktop controller ready')
    }
  })
  ipcMain.on('lite-api:response', (event, id: string, result: LocalChatResult) => {
    if (event.sender !== getWindow()?.webContents || event.senderFrame !== getWindow()?.webContents.mainFrame) return
    const request = pending.get(id)
    if (!request) return
    clearTimeout(request.timer)
    pending.delete(id)
    request.resolve(result)
  })
  const dispatch = (call: LocalChatCall) =>
    new Promise<LocalChatResult>((resolve) => {
      const window = getWindow()
      if (!ready || !window || window.isDestroyed()) {
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
      }, call.action === 'speech' ? 120000 : 15000)
      pending.set(id, { resolve, timer })
      window.webContents.send('lite-api:request', { id, call })
    })
  const profile = app.getPath('userData')
  const tokenPath = path.join(profile, 'local-api-token.txt')
  const preferencesPath = path.join(profile, 'local-api-settings.json')
  let saved: { enabled?: boolean; port?: number; publicOrigin?: string; lanAddress?: string } = {}
  let token = process.env.CBL_API_TOKEN || ''
  try {
    saved = JSON.parse(fs.readFileSync(preferencesPath, 'utf8')) || {}
  } catch {}
  if (!token) {
    try {
      token = fs.readFileSync(tokenPath, 'utf8').trim()
    } catch {}
  }
  const writePrivateFile = (target: string, value: string) => {
    const temporary = target + '.tmp'
    fs.writeFileSync(temporary, value, { mode: 0o600 })
    fs.renameSync(temporary, target)
  }
  const manager = createLocalApiManager({
    preferences: {
      enabled: process.env.CBL_API_ENABLED === undefined ? saved.enabled === true : process.env.CBL_API_ENABLED === '1',
      port: Number(process.env.CBL_API_PORT || (Number.isInteger(saved.port) ? saved.port : 8085)),
      ...(typeof saved.publicOrigin === 'string' ? { publicOrigin: saved.publicOrigin } : {}),
      ...(typeof saved.lanAddress === 'string' ? { lanAddress: saved.lanAddress } : {}),
    },
    token,
    saveToken: (value) => writePrivateFile(tokenPath, value),
    savePreferences: (value) => writePrivateFile(preferencesPath, JSON.stringify(value)),
    start: async (port, activeToken, publicOrigin, lanAddress) => {
      const server = await startLocalChatApi({
        port,
        token: activeToken,
        dispatch,
        publicOrigin,
        lanAddress,
        // The snapshot poll loop must not stack reads onto an already-busy
        // renderer: during generation its main thread is rendering the stream,
        // and 4 polls/second of a 100-message window competed with it (field:
        // web page updates arrived in bursts and dragged the desktop).
        rendererBusy: () => pending.size >= 8,
      })
      console.info(`[Lite API] http://127.0.0.1:${server.port}`)
      return server
    },
  })
  const assertMainFrame = (event: Electron.IpcMainInvokeEvent) => {
    const window = getWindow()
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame)
      throw new Error('Local API settings are available only in the desktop window.')
  }
  ipcMain.handle(LOCAL_API_CHANNELS.status, (event) => {
    assertMainFrame(event)
    return manager.status()
  })
  ipcMain.handle(LOCAL_API_CHANNELS.configure, (event, preferences) => {
    assertMainFrame(event)
    return manager.configure(preferences)
  })
  ipcMain.handle(LOCAL_API_CHANNELS.rotateToken, (event) => {
    assertMainFrame(event)
    return manager.rotateToken()
  })
  ipcMain.handle(LOCAL_API_CHANNELS.copyToken, (event) => {
    assertMainFrame(event)
    const value = manager.getToken()
    if (value.length < 32) throw new Error('Generate a token first.')
    clipboard.writeText(value)
  })
  ipcMain.handle(LOCAL_API_CHANNELS.openBrowser, async (event) => {
    assertMainFrame(event)
    return shell.openExternal(await manager.browserUrl())
  })
  ipcMain.handle(LOCAL_API_CHANNELS.pairPhone, (event) => {
    assertMainFrame(event)
    return manager.pairPhone()
  })
  app.once('before-quit', () => {
    void manager.close()
  })
  return async () => {
    getWindow()?.webContents.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => {
      // Iframes and hash navigation must not invalidate the initialized chat controller.
      if (isMainFrame && !isInPlace) ready = false
    })
    const state = await manager.start()
    if (state.error) console.error('[Lite API]', state.error)
    return state
  }
}
