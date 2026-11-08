// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, render } from '@/test-utils'
import MicrophoneWaveform from './MicrophoneWaveform'

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({ t: (key: string) => key }),
}))
afterEach(() => vi.unstubAllGlobals())

it('responds to real analyser levels and closes only its own audio tap', () => {
  let callback!: FrameRequestCallback
  const close = vi.fn(() => Promise.resolve())
  const disconnect = vi.fn()
  const stopTrack = vi.fn()
  let volume = 0
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((fn) => {
      callback = fn
      return 1
    })
  )
  const cancel = vi.fn()
  vi.stubGlobal('cancelAnimationFrame', cancel)
  vi.stubGlobal(
    'AudioContext',
    class {
      state = 'running'
      close = close
      resume() {
        return Promise.resolve()
      }
      createAnalyser() {
        return { frequencyBinCount: 128, getByteFrequencyData: (data: Uint8Array) => data.fill(volume), disconnect }
      }
      createMediaStreamSource() {
        return { connect: vi.fn(), disconnect }
      }
    }
  )
  const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream
  const view = render(<MicrophoneWaveform stream={stream} />)
  act(() => callback(0))
  expect(view.container.querySelector('[data-mic-level]')?.getAttribute('data-mic-level')).toBe('0.00')
  volume = 255
  act(() => callback(50))
  expect(view.container.querySelectorAll('[data-mic-level]')).toHaveLength(9)
  expect(Number(view.container.querySelector('[data-mic-level]')?.getAttribute('data-mic-level'))).toBeGreaterThan(0.5)
  view.unmount()
  expect(cancel).toHaveBeenCalled()
  expect(close).toHaveBeenCalledOnce()
  expect(stopTrack).not.toHaveBeenCalled()
})

it('renders without an audio analyser so metering cannot prevent dictation', () => {
  vi.stubGlobal('AudioContext', undefined)
  const view = render(<MicrophoneWaveform stream={{} as MediaStream} />)
  expect(view.getByRole('img', { name: 'Microphone input level' })).toBeTruthy()
})
