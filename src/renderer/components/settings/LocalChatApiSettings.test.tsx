// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { LOCAL_API_CHANNELS } from '@shared/local-chat-api'
vi.mock('@/platform', () => ({ default: { type: 'desktop' } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
import { LocalChatApiSettings } from './LocalChatApiSettings'

it('enables the saved local API, copies through main, and rotates credentials without rendering the secret', async () => {
  let state = { enabled: false, running: false, port: 8085, url: 'http://127.0.0.1:8085', hasToken: false }
  const invoke = vi.fn(async (channel: string, preferences?: { enabled: boolean; port: number }) => {
    if (channel === LOCAL_API_CHANNELS.configure) state = { ...state, ...preferences, running: true, hasToken: true }
    return state
  })
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: { invoke } })
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  render(
    <MantineProvider>
      <LocalChatApiSettings />
    </MantineProvider>
  )
  const toggle = await screen.findByRole('switch', { name: 'Enable local chat API' })
  await waitFor(() => expect((toggle as HTMLInputElement).disabled).toBe(false))
  fireEvent.click(toggle)
  await screen.findByText('Running at http://127.0.0.1:8085')
  expect(invoke).toHaveBeenCalledWith(LOCAL_API_CHANNELS.configure, { enabled: true, port: 8085 })
  fireEvent.click(screen.getByRole('button', { name: 'Copy token' }))
  await screen.findByRole('button', { name: 'Copied' })
  expect(invoke).toHaveBeenCalledWith(LOCAL_API_CHANNELS.copyToken)
  fireEvent.click(screen.getByRole('button', { name: 'Generate new token' }))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith(LOCAL_API_CHANNELS.rotateToken))
  expect(screen.queryByDisplayValue(/[a-f0-9]{64}/)).toBeNull()
})
