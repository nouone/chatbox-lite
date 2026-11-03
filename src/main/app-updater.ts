import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'

/** Lite is updated from its own source/installers; never contact upstream update feeds. */
export class AppUpdater {
  constructor(getWindow: () => BrowserWindow | null) {
    ipcMain.removeHandler('updater:check')
    ipcMain.handle('updater:check', async () => {
      const win = getWindow()
      if (win && !win.isDestroyed()) win.webContents.send('updater:not-available')
      return { started: false }
    })
    ipcMain.removeHandler('install-update')
    ipcMain.handle('install-update', () => undefined)
  }

  async tryUpdate() {
    return null
  }
}
