// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { LOCAL_API_CHANNELS } from '@shared/local-chat-api'
vi.mock('@/platform', () => ({ default: { type: 'desktop' } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
import { LocalChatApiSettings } from './LocalChatApiSettings'
it('applies a typed LAN address and regenerates the QR even when the same address is applied twice', async () => {
  let state = { enabled: true, running: true, port: 8088, url: 'http://127.0.0.1:8088', hasToken: true, lanAddress: '' }
  const invoke = vi.fn(
    async (channel: string, preferences?: { enabled: boolean; port: number; lanAddress: string }) => {
      if (channel === LOCAL_API_CHANNELS.configure) state = { ...state, ...preferences }
      if (channel === LOCAL_API_CHANNELS.pairPhone)
        return { lan: { url: 'http://10.0.0.25:8088/#pair=temporary', expiresAt: Date.now() + 300000 } }
      return state
    }
  )
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: { invoke } })
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  const view = render(
    <MantineProvider>
      <LocalChatApiSettings />
    </MantineProvider>
  )
  await waitFor(() =>
    expect((screen.getByLabelText('Static LAN IP (optional)') as HTMLInputElement).disabled).toBe(false)
  )
  fireEvent.change(screen.getByLabelText('Static LAN IP (optional)'), { target: { value: '10.0.0.25' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apply address' }))
  await waitFor(() => expect(view.container.querySelector('svg[aria-label="lan pairing QR code"]')).not.toBeNull())
  const count = () => invoke.mock.calls.filter((call) => call[0] === LOCAL_API_CHANNELS.pairPhone).length
  const first = count()
  fireEvent.click(screen.getByRole('button', { name: 'Apply address' }))
  await waitFor(() => expect(count()).toBeGreaterThan(first))
  expect(view.container.querySelector('svg[aria-label="lan pairing QR code"]')).not.toBeNull()
})

it('automatically shows both labelled QR codes and the Tailscale link when addresses and a token are ready', async () => {
  const state = {
    enabled: true,
    running: true,
    port: 8088,
    url: 'http://127.0.0.1:8088',
    hasToken: true,
    publicOrigin: 'https://pc.example.ts.net:8443',
    lanAddress: '192.168.1.10',
  }
  const invoke = vi.fn(async (channel: string) =>
    channel === LOCAL_API_CHANNELS.pairPhone
      ? {
          tailnet: { url: state.publicOrigin + '/#pair=one-use-tailnet', expiresAt: Date.now() + 300000 },
          lan: { url: 'http://192.168.1.10:8088/#pair=one-use-lan', expiresAt: Date.now() + 300000 },
        }
      : state
  )
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: { invoke } })
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  const view = render(
    <MantineProvider>
      <LocalChatApiSettings />
    </MantineProvider>
  )
  await waitFor(() => expect(view.container.querySelectorAll('svg[aria-label$="pairing QR code"]').length).toBe(2))
  expect(screen.getByRole('link', { name: state.publicOrigin }).getAttribute('href')).toBe(state.publicOrigin)
  expect(invoke).toHaveBeenCalledWith(LOCAL_API_CHANNELS.pairPhone)
})

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
  expect(invoke).toHaveBeenCalledWith(LOCAL_API_CHANNELS.configure, {
    enabled: true,
    port: 8085,
    publicOrigin: '',
    lanAddress: '',
  })
  fireEvent.click(screen.getByRole('button', { name: 'Copy token' }))
  await screen.findByRole('button', { name: 'Copied' })
  expect(invoke).toHaveBeenCalledWith(LOCAL_API_CHANNELS.copyToken)
  fireEvent.click(screen.getByRole('button', { name: 'Generate new token' }))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith(LOCAL_API_CHANNELS.rotateToken))
  expect(screen.queryByDisplayValue(/[a-f0-9]{64}/)).toBeNull()
})
