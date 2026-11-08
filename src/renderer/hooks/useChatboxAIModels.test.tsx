// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import useChatboxAIModels from './useChatboxAIModels'

const mocks = vi.hoisted(() => ({ manifest: vi.fn(), catalog: vi.fn(), save: vi.fn() }))
vi.mock('@/packages/remote', () => ({ getModelManifest: mocks.manifest, getChatboxAIModelList: mocks.catalog }))
vi.mock('@/stores/settingsStore', () => ({
  useLanguage: () => 'en',
  useSettingsStore: (selector: (s: { licenseKey: string }) => unknown) => selector({ licenseKey: 'old-saved-key' }),
  useProviderSettings: () => ({
    providerSettings: { models: [{ modelId: 'old-hosted-model' }] },
    setProviderSettings: mocks.save,
  }),
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
it('does not load or expose hosted models even with a saved account and cached catalog', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['chatbox-ai-models', 'en', 'old-saved-key'], {
    models: [{ modelId: 'old-hosted-model' }],
    imageModels: [],
    modelList: { provider: { id: 'chatbox-ai' } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
  const { result } = renderHook(() => useChatboxAIModels(), { wrapper })
  expect(result.current.chatboxAIModels).toEqual([])
  expect(result.current.allChatboxAIModels).toEqual([])
  expect(result.current.chatboxAIImageModels).toEqual([])
  expect(result.current.chatboxAIModelList).toBeNull()
  expect(mocks.manifest).not.toHaveBeenCalled()
  expect(mocks.catalog).not.toHaveBeenCalled()
  client.clear()
})
