import path from 'node:path'
import { app } from 'electron'
import type { SkillInfo } from '@shared/types/skills'

/** Keep the old path for compatibility; Lite never seeds or loads this directory. */
export function getBuiltinSkillsDir(): string {
  return path.join(app.getPath('userData'), 'builtin-skills')
}
export function ensureBuiltinSeeded(): void {}
export async function syncBuiltinSkills(_lang?: string): Promise<boolean> {
  return false
}
export function discoverBuiltinSkills(): SkillInfo[] {
  return []
}
