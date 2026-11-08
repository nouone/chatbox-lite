import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const app = vi.hoisted(() => ({
  commandLine: { getSwitchValue: vi.fn() },
  getPath: vi.fn(),
  setName: vi.fn(),
  setPath: vi.fn(),
}))
vi.mock('electron', () => ({ app }))

describe('Wao profile bootstrap', () => {
  let appData: string

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    appData = mkdtempSync(path.join(os.tmpdir(), 'wao-profile-'))
    app.getPath.mockReturnValue(appData)
    app.commandLine.getSwitchValue.mockReturnValue('')
  })

  afterEach(() => {
    rmSync(appData, { recursive: true, force: true })
  })

  it.each([
    { label: 'fresh install', folders: [], expected: 'Wao' },
    { label: 'legacy profile only', folders: ['xyz.chatboxapp.ce'], expected: 'xyz.chatboxapp.ce' },
    { label: 'renamed profile only', folders: ['Wao'], expected: 'Wao' },
    { label: 'renamed and recreated profiles', folders: ['Wao', 'xyz.chatboxapp.ce'], expected: 'Wao' },
    { label: 'explicit override', folders: ['Wao', 'xyz.chatboxapp.ce'], override: 'isolated', expected: 'isolated' },
  ])('selects the same settings and browser profile for $label', async ({ folders, override, expected }) => {
    for (const folder of folders) {
      mkdirSync(path.join(appData, folder))
      writeFileSync(path.join(appData, folder, 'config.json'), JSON.stringify({ profile: folder }))
    }
    if (override) {
      app.commandLine.getSwitchValue.mockReturnValue(path.join(appData, override))
    }

    await import('./profile')

    const profile = path.join(appData, expected)
    expect(app.setName).toHaveBeenCalledWith('Wao')
    expect(app.setPath.mock.calls).toEqual([
      ['userData', profile],
      ['sessionData', profile],
    ])
    for (const folder of folders) {
      expect(readFileSync(path.join(appData, folder, 'config.json'), 'utf8')).toBe(JSON.stringify({ profile: folder }))
    }
  })
})
