import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetStoreBlob = vi.fn()
const mockSetStoreBlob = vi.fn()
const mockTransformFullResponse = vi.fn((raw: unknown) => raw)

vi.mock('@/platform', () => ({
  default: {
    getStoreBlob: mockGetStoreBlob,
    setStoreBlob: mockSetStoreBlob,
  },
}))

vi.mock('@shared/model-registry/enrich', () => ({
  setRuntimeRegistry: vi.fn(),
}))

vi.mock('@shared/model-registry/transform', () => ({
  transformFullResponse: mockTransformFullResponse,
}))

vi.mock('@shared/model-registry/snapshot.generated', () => ({
  MODELS_DEV_SNAPSHOT: {
    openai: {
      'snapshot-model': {
        modelId: 'snapshot-model',
        type: 'chat',
        capabilities: [],
        contextWindow: 111_000,
        maxOutput: 4_096,
      },
    },
  },
}))

function cachedModel(modelId: string, contextWindow: number) {
  return {
    modelId,
    type: 'chat' as const,
    capabilities: ['tool_use'],
    contextWindow,
    maxOutput: 8_192,
  }
}

function blobCache(data: unknown, ageMs: number) {
  return JSON.stringify({
    data,
    timestamp: Date.now() - ageMs,
  })
}

describe('Lite local model catalog', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })
  it.each([0, 24 * 60 * 60 * 1000 * 365])('keeps the local cache at age %s without refreshing online', async (age) => {
    const data = { openai: { 'cached-model': cachedModel('cached-model', 222_000) } }
    mockGetStoreBlob.mockResolvedValue(blobCache(data, age))
    const registry = await import('./fetch')
    await registry.prefetchModelRegistry()
    expect(await registry.getRegistry()).toMatchObject(data)
    expect(await registry.forceRefreshRegistry()).toMatchObject(data)
    expect(registry.requestUnknownModelRegistryRefresh()).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('uses the bundled snapshot on a new installation, including explicit refresh', async () => {
    mockGetStoreBlob.mockResolvedValue(null)
    const registry = await import('./fetch')
    await registry.prefetchModelRegistry()
    expect((await registry.getRegistry()).openai['snapshot-model'].contextWindow).toBe(111_000)
    await registry.forceRefreshRegistry()
    expect(registry.requestUnknownModelRegistryRefresh()).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    expect(mockSetStoreBlob).not.toHaveBeenCalled()
  })
})
