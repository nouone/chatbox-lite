import type { SkillMetadata } from '@shared/types/skills'
export interface BuiltinSeed {
  metadata: SkillMetadata
  body: string
  version: number
}

export const builtinSkills: BuiltinSeed[] = []
