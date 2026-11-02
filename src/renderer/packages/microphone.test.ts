import { expect, it } from 'vitest'
import { appendDictation } from './microphone'

it('appends dictation to the live draft without sending or replacing it', () => {
  expect(appendDictation('Existing draft', ' Hello world. ')).toBe('Existing draft Hello world.')
  expect(appendDictation('Existing draft\n', 'Hello')).toBe('Existing draft\nHello')
  expect(appendDictation('', 'Hello')).toBe('Hello')
  expect(appendDictation('Keep this', '  ')).toBe('Keep this')
})
