// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core'
import { LOCAL_SPEECH_CHANNELS } from '@shared/local-speech'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@/test-utils'
import MicrophoneButton from './MicrophoneButton'

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), decode: vi.fn(), release: vi.fn(), toast: vi.fn() }))
vi.mock('@/platform', () => ({ default: { type: 'desktop' } }))
vi.mock('@/packages/microphone', () => ({ recordingToWav: mocks.decode }))
vi.mock('@/packages/text-to-speech', () => ({ beginSpeechInput: () => mocks.release }))
vi.mock('@/stores/toastActions', () => ({ add: mocks.toast }))
vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({ t: (key: string) => key }),
}))

let stopTracks: ReturnType<typeof vi.fn>
let getMicrophone: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.clearAllMocks()
  stopTracks = vi.fn()
  getMicrophone = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTracks }] })
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: getMicrophone } })
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: { invoke: mocks.invoke } })
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  mocks.invoke.mockImplementation((channel) =>
    Promise.resolve(channel === LOCAL_SPEECH_CHANNELS.status ? true : 'Hello world.')
  )
  mocks.decode.mockResolvedValue(new ArrayBuffer(48))
  vi.stubGlobal(
    'MediaRecorder',
    class {
      state = 'inactive'
      mimeType = 'audio/webm'
      onstop?: () => void
      ondataavailable?: (event: { data: Blob }) => void
      onerror?: () => void
      start() {
        this.state = 'recording'
      }
      stop() {
        this.state = 'inactive'
        this.ondataavailable?.({ data: new Blob(['voice']) })
        this.onstop?.()
      }
    }
  )
})
afterEach(() => vi.unstubAllGlobals())
function mount(onTranscript = vi.fn(), onSend?: () => void, sendDisabled = false) {
  return {
    onTranscript,
    ...render(
      <MantineProvider>
        <MicrophoneButton iconSize={20} onTranscript={onTranscript} onSend={onSend} sendDisabled={sendDisabled} />
      </MantineProvider>
    ),
  }
}
it('records only after a click, stops the microphone, and returns a draft transcript', async () => {
  const { onTranscript } = mount()
  expect(getMicrophone).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Dictate message' }))
  const stop = await screen.findByRole('button', { name: 'Stop dictation' })
  expect(screen.getByRole('status').textContent).toBe('0:00')
  expect(screen.getByRole('img', { name: 'Microphone input level' })).toBeTruthy()
  fireEvent.click(stop)
  await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('Hello world.'))
  expect(getMicrophone).toHaveBeenCalledWith({ audio: { channelCount: 1, echoCancellation: true }, video: false })
  expect(stopTracks).toHaveBeenCalled()
  expect(mocks.release).toHaveBeenCalled()
})
it('does not request microphone permission before local resources are installed', async () => {
  mocks.invoke.mockResolvedValue(false)
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Dictate message' }))
  await waitFor(() => expect(mocks.toast).toHaveBeenCalled())
  expect(getMicrophone).not.toHaveBeenCalled()
})
it('stops recording and discards the clip when the conversation is unmounted', async () => {
  const { unmount, onTranscript } = mount()
  fireEvent.click(screen.getByRole('button', { name: 'Dictate message' }))
  await screen.findByRole('button', { name: 'Stop dictation' })
  unmount()
  expect(stopTracks).toHaveBeenCalled()
  expect(onTranscript).not.toHaveBeenCalled()
  expect(mocks.invoke).toHaveBeenCalledTimes(1)
})

it('sends only on an explicit click, and blocks sending until transcription finishes', async () => {
  const onSend = vi.fn()
  let resolveTranscript!: (value: string) => void
  mocks.invoke.mockImplementation((channel) =>
    channel === LOCAL_SPEECH_CHANNELS.status
      ? Promise.resolve(true)
      : new Promise<string>((resolve) => {
          resolveTranscript = resolve
        })
  )
  const { onTranscript } = mount(vi.fn(), onSend)
  const send = () => screen.getByRole('button', { name: 'Send message' }) as HTMLButtonElement
  fireEvent.click(screen.getByRole('button', { name: 'Dictate message' }))
  const stop = await screen.findByRole('button', { name: 'Stop dictation' })
  expect(send().disabled).toBe(true)
  fireEvent.click(send())
  expect(onSend).not.toHaveBeenCalled()
  fireEvent.click(stop)
  await waitFor(() => expect(resolveTranscript).toBeTypeOf('function'))
  expect(send().disabled).toBe(true)
  resolveTranscript('Ready to post.')
  await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('Ready to post.'))
  await waitFor(() => expect(send().disabled).toBe(false))
  expect(onSend).not.toHaveBeenCalled()
  fireEvent.click(send())
  expect(onSend).toHaveBeenCalledOnce()
})
it('respects the message composer send block', () => {
  const onSend = vi.fn()
  mount(vi.fn(), onSend, true)
  const send = () => screen.getByRole('button', { name: 'Send message' }) as HTMLButtonElement
  expect(send().disabled).toBe(true)
  fireEvent.click(send())
  expect(onSend).not.toHaveBeenCalled()
})
