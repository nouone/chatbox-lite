import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  count: 34,
  chunks: Array.from({ length: 83 }, (_, i) => ({ text: `chunk-${i}` })),
  upsert: vi.fn(),
  execute: vi.fn(),
  model: undefined as unknown,
}))
vi.mock('node:timers/promises', () => ({ setTimeout: async () => undefined }))
vi.mock('@mastra/rag', () => ({ MDocument: { fromText: () => ({ chunk: async () => mocks.chunks }) } }))
vi.mock('../util', () => ({ getLogger: () => ({ debug: vi.fn(), info: vi.fn(), error: vi.fn() }) }))
vi.mock('../adapters/sentry', () => ({ sentry: { withScope: vi.fn() } }))
vi.mock('./db', () => ({
  getDatabase: () => ({ execute: mocks.execute }),
  getVectorStore: () => ({ createIndex: vi.fn(), upsert: mocks.upsert }),
  checkProcessingTimeouts: vi.fn(),
}))
vi.mock('./model-providers', () => ({ getEmbeddingProvider: async () => mocks.model, getRerankProvider: vi.fn() }))
vi.mock('./parsers', () => ({
  parseFileWithRouter: async () => ({ content: 'document text', parserUsed: 'local' }),
  getEffectiveParserConfig: () => ({ type: 'local' }),
}))
import { processFileWithMastra } from './file-loaders'
it('resumes document ingestion with real SDK requests limited to 32 inputs and preserves chunk order/checkpoints', async () => {
  const sizes: number[] = []
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (_url, init) => {
    const inputs = JSON.parse(String(init?.body)).input as string[]
    sizes.push(inputs.length)
    if (inputs.length > 32) return new Response('batch too large', { status: 413 })
    return new Response(
      JSON.stringify({
        data: inputs.map((_, index) => ({ index, embedding: [0.1, 0.2, 0.3] })),
        usage: { prompt_tokens: inputs.length, total_tokens: inputs.length },
      }),
      { headers: { 'content-type': 'application/json' } }
    )
  })
  mocks.model = createOpenAICompatible({ name: 'local', baseURL: 'http://127.0.0.1:8086/v1', fetch }).embeddingModel(
    'text-embeddings-inference'
  )
  mocks.execute.mockImplementation(async (query: string | { sql: string; args: unknown[] }) => {
    if (typeof query === 'string' && query.includes('SELECT chunk_count'))
      return { rows: [{ chunk_count: mocks.count, total_chunks: 83, status: 'pending' }] }
    if (typeof query === 'string' && query.includes('SELECT status')) return { rows: [{ status: 'processing' }] }
    if (typeof query !== 'string' && query.sql.includes('SET chunk_count = ?')) mocks.count = query.args[0] as number
    return { rows: [] }
  })
  await processFileWithMastra('file.txt', { fileId: 7, filename: 'file.txt', mimeType: 'text/plain' }, 2, {
    type: 'local',
  })
  expect(sizes).toEqual([1, 32, 17])
  const indexes = mocks.upsert.mock.calls.flatMap((call) =>
    call[0].metadata.map((entry: { chunkIndex: number }) => entry.chunkIndex)
  )
  expect(indexes).toEqual(Array.from({ length: 49 }, (_, i) => i + 34))
  expect(mocks.count).toBe(83)
})
