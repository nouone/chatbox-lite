import { expect, it, vi } from 'vitest'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
vi.mock('electron', () => ({
  ipcMain: {
    removeHandler: (key: string) => handlers.delete(key),
    handle: (key: string, handler: (...args: unknown[]) => unknown) => handlers.set(key, handler),
  },
}))
import { AppUpdater } from './app-updater'

it('never requests or installs an upstream update, even when invoked manually', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const send = vi.fn()
  const updater = new AppUpdater(() => ({ isDestroyed: () => false, webContents: { send } }) as never)
  expect(await updater.tryUpdate()).toBeNull()
  expect(await handlers.get('updater:check')?.()).toEqual({ started: false })
  handlers.get('install-update')?.()
  expect(send).toHaveBeenCalledWith('updater:not-available')
  expect(fetch).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
})
