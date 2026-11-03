import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { loggerWarn, userDataRoot } = vi.hoisted(() => ({
  loggerWarn: vi.fn(),
  userDataRoot: { current: '' },
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => userDataRoot.current),
  },
}))

vi.mock('../util', () => ({
  getLogger: () => ({
    warn: loggerWarn,
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

vi.mock('./builtin', () => ({
  builtinSkills: [{ metadata: { name: 'local-help', description: 'Local help' }, body: 'local content', version: 1 }],
}))

import { getBuiltinSkillsDir, syncBuiltinSkills } from './builtin-sync'

describe('syncBuiltinSkills', () => {
  beforeEach(() => {
    userDataRoot.current = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbox-builtin-skills-'))
    loggerWarn.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fs.rmSync(userDataRoot.current, { recursive: true, force: true })
  })

  it('uses bundled skills and never checks a vendor manifest', async () => {
    const transport = vi.fn()
    vi.stubGlobal('fetch', transport)
    expect(await syncBuiltinSkills('en')).toBe(false)
    expect(await syncBuiltinSkills('zh')).toBe(false)
    expect(transport).not.toHaveBeenCalled()
    expect(fs.existsSync(path.join(getBuiltinSkillsDir(), 'manifest.json'))).toBe(true)
  })
})
