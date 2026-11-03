// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core'
import type { Settings } from '@shared/types'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createAutoReadCompletionHandler } from '@/packages/auto-read-reply'
import { responseSpeechPlayer } from '@/packages/text-to-speech'
import { fireEvent, render, screen, waitFor } from '@/test-utils'
import ReadAloudButton from './ReadAloudButton'
import { SpeechSettings } from '@/components/settings/SpeechSettings'

const state = vi.hoisted(() => ({ textToSpeech: { enabled: true } as Settings['textToSpeech'] | undefined }))
const synthesize = vi.hoisted(() => vi.fn())
vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: (select: (value: typeof state) => unknown) => select(state),
}))
vi.mock('@/platform', () => ({ default: { type: 'web' } }))
vi.mock('@/stores/toastActions', () => ({ add: vi.fn() }))
vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@/packages/text-to-speech', async (original) => ({
  ...(await original<typeof import('@/packages/text-to-speech')>()),
  synthesizeSpeech: synthesize,
}))

beforeEach(() => {
  responseSpeechPlayer.stop()
  state.textToSpeech = { enabled: true }
  synthesize.mockReset().mockResolvedValue(new Blob(['audio'], { type: 'audio/mpeg' }))
  vi.stubGlobal(
    'Audio',
    class {
      play = vi.fn(() => Promise.resolve())
      pause = vi.fn()
      src = ''
      onended = null
      onerror = null
    }
  )
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:test') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
})
afterEach(() => {
  responseSpeechPlayer.stop()
  vi.unstubAllGlobals()
})

const message = { id: 'one', role: 'assistant' as const, contentParts: [{ type: 'text' as const, text: 'Hello' }] }

it('tests the configured voice and speed from Settings and lets the sample be stopped', async () => {
  state.textToSpeech = {
    enabled: true,
    apiBaseUrl: 'http://localhost:8880',
    model: 'kokoro',
    voice: 'af_heart',
    speed: 1.1,
  }
  render(
    <MantineProvider>
      <SpeechSettings />
    </MantineProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Test voice' }))
  await waitFor(() =>
    expect(synthesize).toHaveBeenCalledWith(
      expect.stringContaining('selected voice'),
      expect.objectContaining({ apiBaseUrl: 'http://localhost:8880', voice: 'af_heart', speed: 1.1 }),
      expect.any(Function),
      expect.any(AbortSignal)
    )
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Stop test' }))
  expect(responseSpeechPlayer.getSnapshot().id).toBeUndefined()
})
function mount() {
  return render(
    <MantineProvider>
      <ReadAloudButton message={message} playbackId="chat:one" />
    </MantineProvider>
  )
}

it('hides read aloud until explicitly enabled', () => {
  state.textToSpeech = undefined
  mount()
  expect(screen.queryByRole('button', { name: 'Read aloud' })).toBeNull()
  expect(synthesize).not.toHaveBeenCalled()
})
it('starts on click and survives transcript row replacement', async () => {
  const view = mount()
  fireEvent.click(screen.getByRole('button', { name: 'Read aloud' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Stop reading' })).toBeTruthy())
  expect(synthesize).toHaveBeenCalledWith('Hello', { enabled: true }, expect.any(Function), expect.any(AbortSignal))
  view.unmount()
  expect(responseSpeechPlayer.getSnapshot().id).toBe('chat:one')
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Stop reading' }))
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')
})
it('can cancel while speech is being generated', async () => {
  synthesize.mockImplementation(() => new Promise(() => {}))
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Read aloud' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Stop reading' }))
  expect(synthesize.mock.calls[0][3].aborted).toBe(true)
  expect(screen.getByRole('button', { name: 'Read aloud' })).toBeTruthy()
})

it('starts from generation completion without a mounted message row', async () => {
  state.textToSpeech = { enabled: true, autoRead: true }
  const completed = createAutoReadCompletionHandler({
    getSettings: () => state.textToSpeech,
    isOnScreen: () => true,
    isInputActive: () => false,
    request: vi.fn(),
    player: responseSpeechPlayer,
    onError: vi.fn(),
  })
  await completed('chat', { ...message, generating: false, finishReason: 'stop' })
  expect(synthesize).toHaveBeenCalledOnce()
  expect(responseSpeechPlayer.getSnapshot().id).toBe('chat:one')
  const view = mount()
  expect(screen.getByRole('button', { name: 'Stop reading' })).toBeTruthy()
  view.unmount()
  expect(responseSpeechPlayer.getSnapshot().id).toBe('chat:one')
})
