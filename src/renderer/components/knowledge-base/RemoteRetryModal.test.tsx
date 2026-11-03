// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core'
import type { KnowledgeBaseFile } from '@shared/types'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ retry: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/platform', () => ({ default: { getKnowledgeBaseController: () => ({ retryFile: mocks.retry }) } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/components/layout/Overlay', () => ({
  Modal: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      {title}
      {children}
    </div>
  ),
}))
vi.mock('@/components/ui/tooltip', () => ({ AppTooltip: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('@/packages/toast', () => ({ toastError: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))
import { RemoteRetryModal } from './RemoteRetryModal'

it('retries through the configured parser without setting the legacy hosted-parser flag or offering credits', async () => {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  const failedFiles = [
    { id: 4, filename: 'icon.svg', file_size: 100, error: 'chatbox_ai_parser_failed', parsed_remotely: 0 },
  ] as KnowledgeBaseFile[]
  render(
    <MantineProvider>
      <RemoteRetryModal opened onClose={vi.fn()} failedFiles={failedFiles} onSuccess={vi.fn()} />
    </MantineProvider>
  )
  expect(screen.getByText('Retry failed files')).toBeTruthy()
  expect(screen.queryByText(/compute credits|Sign in needed/i)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /^Retry$/ }))
  await waitFor(() => expect(mocks.retry).toHaveBeenCalledWith(4, false))
})
