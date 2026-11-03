import { expect, it } from 'vitest'
import { builtinSkills } from './index'
it('does not ship any bundled skills in Lite', () => {
  expect(builtinSkills).toEqual([])
})
