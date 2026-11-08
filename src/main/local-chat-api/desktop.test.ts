import { EventEmitter } from 'node:events'
import type { BrowserWindow } from 'electron'
import { beforeEach, expect, it, vi } from 'vitest'
import { LOCAL_API_CHANNELS } from '../../shared/local-chat-api'

const mocks = vi.hoisted(() => ({
  on: vi.fn(),
  handle: vi.fn(),
  once: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  start: vi.fn(),
  copy: vi.fn(),
  open: vi.fn(),
}))
vi.mock('electron', () => ({
  app: { getPath: () => 'test-profile', once: mocks.once },
  ipcMain: { on: mocks.on, handle: mocks.handle },
  clipboard: { writeText: mocks.copy },
  shell: { openExternal: mocks.open },
}))
vi.mock('node:fs', () => ({
  default: {
    readFileSync: () => {
      throw new Error('No saved settings')
    },
    writeFileSync: mocks.writeFileSync,
    renameSync: mocks.renameSync,
  },
}))
vi.mock('./server', () => ({ startLocalChatApi: mocks.start }))
import { registerLocalChatApi } from './desktop'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('Wao_API_ENABLED', '')
  vi.stubEnv('Wao_API_TOKEN', '')
  vi.stubEnv('Wao_API_PORT', '')
  mocks.start.mockResolvedValue({ close: vi.fn(), setToken: vi.fn() })
})

async function setup() {
  const contents = Object.assign(new EventEmitter(), {
    mainFrame: {},
    isLoading: vi.fn(() => true),
    send: vi.fn(),
  })
  const window = { webContents: contents, isDestroyed: () => false } as unknown as BrowserWindow
  const start = registerLocalChatApi(() => window)
  await start()
  const handler = (channel: string) => mocks.handle.mock.calls.find((call) => call[0] === channel)![1]
  const listener = (channel: string) => mocks.on.mock.calls.find((call) => call[0] === channel)![1]
  const event = { sender: contents, senderFrame: contents.mainFrame }
  await handler(LOCAL_API_CHANNELS.configure)(event, { enabled: true, port: 8087 })
  return { contents, handler, listener, event, dispatch: mocks.start.mock.calls[0][0].dispatch }
}

it('keeps an initialized controller ready during iframe loading and resets it on real page navigation', async () => {
  const { contents, listener, event, dispatch } = await setup()
  expect(await dispatch({ action: 'list' })).toMatchObject({ status: 503 })
  listener('lite-api:ready')(event)
  contents.send.mockImplementation((_channel, envelope) => {
    listener('lite-api:response')(event, envelope.id, { status: 200, body: { items: [] } })
  })
  contents.emit('did-start-navigation', {}, 'about:blank', false, false)
  expect(await dispatch({ action: 'list' })).toMatchObject({ status: 200 })
  contents.emit('did-start-navigation', {}, '#/session/a', true, true)
  expect(await dispatch({ action: 'list' })).toMatchObject({ status: 200 })
  contents.emit('did-start-navigation', {}, 'file:///index.html', false, true)
  expect(await dispatch({ action: 'list' })).toMatchObject({ status: 503 })
  listener('lite-api:ready')(event)
  expect(await dispatch({ action: 'list' })).toMatchObject({ status: 200 })
})

it('allows token copying only from the desktop main frame, not an embedded frame', async () => {
  const { contents, handler, event } = await setup()
  const copy = handler(LOCAL_API_CHANNELS.copyToken)
  expect(() => copy({ sender: contents, senderFrame: {} })).toThrow('desktop window')
  expect(mocks.copy).not.toHaveBeenCalled()
  copy(event)
  expect(mocks.copy).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/))
})
