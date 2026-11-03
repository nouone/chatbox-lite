import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { Config, Settings } from '@shared/types'
import type { ModelDependencies } from '@shared/types/adapters'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getModel: vi.fn(), chat: vi.fn() }))
vi.mock('@shared/models', () => ({ getModel: mocks.getModel }))
import { testModelCapabilities } from './model-tester'

const options = {
  providerId: 'local-embedding',
  modelId: 'text-embeddings-inference',
  settings: {} as Settings,
  configs: {} as Config,
  dependencies: {} as ModelDependencies,
}
beforeEach(() => {
  vi.clearAllMocks()
})

it('tests embeddings against /v1/embeddings using the existing provider adapter, without chat probes', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    new Response(
      JSON.stringify({
        data: [{ object: 'embedding', embedding: [0.1, 0.2, 0.3], index: 0 }],
        model: 'text-embeddings-inference',
        usage: { prompt_tokens: 4, total_tokens: 4 },
      }),
      { headers: { 'content-type': 'application/json' } }
    )
  )
  const provider = createOpenAICompatible({
    name: 'local',
    baseURL: 'http://127.0.0.1:8086/v1',
    apiKey: 'local',
    fetch,
  })
  mocks.getModel.mockReturnValue({
    chat: mocks.chat,
    getTextEmbeddingModel: () => provider.embeddingModel(options.modelId),
  })
  const state = await testModelCapabilities({ ...options, modelType: 'embedding' })
  expect(state).toEqual({ testing: false, basicTest: { status: 'success' } })
  expect(fetch).toHaveBeenCalledOnce()
  expect(String(fetch.mock.calls[0][0])).toBe('http://127.0.0.1:8086/v1/embeddings')
  expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({
    model: 'text-embeddings-inference',
    input: ['Embedding connection test.'],
  })
  expect(mocks.chat).not.toHaveBeenCalled()
})

it('reports a real embedding provider failure instead of falling back to a chat request', async () => {
  mocks.getModel.mockReturnValue({
    chat: mocks.chat,
    getTextEmbeddingModel: () => {
      throw new Error('Embedding service unavailable')
    },
  })
  const state = await testModelCapabilities({ ...options, modelType: 'embedding' })
  expect(state.basicTest).toEqual({ status: 'error', error: 'Error: Embedding service unavailable' })
  expect(state.testing).toBe(false)
  expect(mocks.chat).not.toHaveBeenCalled()
})

it('preserves the existing chat, vision and tool tests for chat models', async () => {
  mocks.chat.mockResolvedValue({})
  mocks.getModel.mockReturnValue({ chat: mocks.chat })
  const state = await testModelCapabilities(options)
  expect(mocks.chat).toHaveBeenCalledTimes(3)
  expect(state.basicTest?.status).toBe('success')
  expect(state.visionTest?.status).toBe('success')
  expect(state.toolTest?.status).toBe('success')
})
