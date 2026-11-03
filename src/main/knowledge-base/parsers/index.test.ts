import { expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  local: vi.fn().mockResolvedValue('local document text'),
  remote: vi.fn().mockResolvedValue('custom document text'),
}))
vi.mock('../../util', () => ({ getLogger: () => ({ debug: vi.fn(), warn: vi.fn() }) }))
vi.mock('./local-parser', () => ({
  LocalParser: class {
    type = 'local'
    parse = mocks.local
  },
}))
vi.mock('./mineru-parser', () => ({
  MineruParser: class {
    type = 'mineru'
    parse = mocks.remote
  },
  testMineruConnection: vi.fn(),
}))
import { createParser, getEffectiveParserConfig, parseFileWithRouter } from './index'

it('maps stored hosted-parser settings to local parsing without creating a hosted parser', async () => {
  expect(getEffectiveParserConfig({ type: 'chatbox-ai' })).toEqual({ type: 'local' })
  expect(getEffectiveParserConfig(undefined, { type: 'chatbox-ai' })).toEqual({ type: 'local' })
  expect(createParser({ type: 'chatbox-ai' }).type).toBe('local')
  const result = await parseFileWithRouter(
    'document.pdf',
    { fileId: 1, filename: 'document.pdf', mimeType: 'application/pdf' },
    { type: 'chatbox-ai' }
  )
  expect(result).toEqual({ content: 'local document text', parserUsed: 'local' })
  expect(mocks.remote).not.toHaveBeenCalled()
})

it('retains an explicitly configured custom parser and rejects missing credentials', () => {
  const configured = { type: 'mineru' as const, mineru: { apiToken: 'user-configured-key' } }
  expect(getEffectiveParserConfig(configured)).toEqual(configured)
  expect(createParser(configured).type).toBe('mineru')
  expect(() => createParser({ type: 'mineru' })).toThrow('API token is required')
})
