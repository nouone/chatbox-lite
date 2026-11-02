import type { Message } from '@shared/types'
import { describe, expect, it, vi } from 'vitest'
import { createAutoReadCompletionHandler } from './auto-read-reply'
import type { SpeechSettings } from './text-to-speech'

const message: Message = {
  id: 'reply',
  role: 'assistant',
  generating: false,
  finishReason: 'stop',
  contentParts: [{ type: 'text', text: 'Hello world.' }],
}
function harness() {
  let settings: SpeechSettings = { enabled: true, autoRead: true, apiBaseUrl: 'http://localhost:8880' }
  const request = vi
    .fn<typeof fetch>()
    .mockImplementation(() => Promise.resolve(new Response('audio', { headers: { 'Content-Type': 'audio/mpeg' } })))
  const play = vi.fn(async (_id: string, synthesize: (signal: AbortSignal) => Promise<Blob>) => {
    await synthesize(new AbortController().signal)
  })
  const onError = vi.fn()
  const onScreen = vi.fn((id: string) => id === 'current')
  const isInputActive = vi.fn(() => false)
  const completed = createAutoReadCompletionHandler({
    getSettings: () => settings,
    isOnScreen: onScreen,
    isInputActive,
    request,
    player: { play },
    onError,
  })
  return {
    completed,
    request,
    play,
    onError,
    onScreen,
    isInputActive,
    setSettings: (next: SpeechSettings) => {
      settings = next
    },
  }
}
describe('generation-completion auto-read', () => {
  it('requests speech directly on completion, with no React message component involved', async () => {
    const h = harness()
    await h.completed('current', message)
    expect(h.play).toHaveBeenCalledOnce()
    expect(h.request.mock.calls[0][0]).toBe('http://localhost:8880/v1/audio/speech')
    expect(JSON.parse(String(h.request.mock.calls[0][1]?.body)).input).toBe('Hello world.')
    expect(h.onError).not.toHaveBeenCalled()
  })
  it('ignores duplicate notifications but reads a new generation using the same message id', async () => {
    const h = harness()
    await h.completed('current', message)
    await h.completed('current', message)
    expect(h.play).toHaveBeenCalledOnce()
    await h.completed('current', { ...message, contentParts: [{ type: 'text', text: 'Regenerated answer' }] })
    expect(h.play).toHaveBeenCalledTimes(2)
  })
  it.each([
    { enabled: false, autoRead: true },
    { enabled: true, autoRead: false },
  ])('honors the speech settings %j', async (settings) => {
    const h = harness()
    h.setSettings(settings)
    await h.completed('current', message)
    expect(h.play).not.toHaveBeenCalled()
  })
  it('skips background completions and active dictation', async () => {
    const h = harness()
    await h.completed('background', message)
    h.isInputActive.mockReturnValue(true)
    await h.completed('current', { ...message })
    expect(h.play).not.toHaveBeenCalled()
  })
  it.each(['error', 'canceled', 'tool-call-paused', 'content-filter'])(
    'does not speak a %s completion',
    async (finishReason) => {
      const h = harness()
      await h.completed('current', { ...message, finishReason })
      expect(h.play).not.toHaveBeenCalled()
    }
  )
  it('reports speech request failures without failing the chat completion', async () => {
    const h = harness()
    h.request.mockResolvedValue(new Response('Unavailable', { status: 503 }))
    await expect(h.completed('current', message)).resolves.toBeUndefined()
    expect(h.onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Speech server returned HTTP 503.' }))
  })
})
