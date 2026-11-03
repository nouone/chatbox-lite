import { randomBytes } from 'node:crypto'
import type { LocalApiStatus } from '../../shared/local-chat-api'

type Preferences = { enabled: boolean; port: number }
type RunningServer = { close: () => Promise<void>; setToken: (token: string) => void }

/** Serializes settings changes so rapid toggles cannot leave multiple listeners running. */
export function createLocalApiManager(options: {
  preferences: Preferences
  token: string
  savePreferences: (value: Preferences) => void
  saveToken: (value: string) => void
  start: (port: number, token: string) => Promise<RunningServer>
}) {
  let preferences = { ...options.preferences }
  let token = options.token
  let server: RunningServer | undefined
  let error: string | undefined
  let queue: Promise<unknown> = Promise.resolve()
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(operation)
    queue = result.catch(() => undefined)
    return result
  }
  const status = (): LocalApiStatus => ({
    ...preferences,
    running: Boolean(server),
    hasToken: token.length >= 32,
    url: `http://127.0.0.1:${preferences.port}`,
    ...(error ? { error } : {}),
  })
  const rotate = () => {
    const next = randomBytes(32).toString('hex')
    options.saveToken(next)
    token = next
    server?.setToken(token)
  }
  const configure = (next: Preferences, persist = true) =>
    enqueue(async () => {
      if (typeof next?.enabled !== 'boolean' || !Number.isInteger(next.port) || next.port < 1 || next.port > 65535)
        throw new Error('Use a port from 1 to 65535.')
      if (persist) options.savePreferences(next)
      if (server && (!next.enabled || next.port !== preferences.port)) {
        await server.close()
        server = undefined
      }
      preferences = { enabled: next.enabled, port: next.port }
      error = undefined
      if (next.enabled && !server) {
        try {
          if (token.length < 32) rotate()
          server = await options.start(next.port, token)
        } catch (cause) {
          const code = (cause as NodeJS.ErrnoException)?.code
          error =
            code === 'EADDRINUSE'
              ? `Port ${next.port} is already in use. Choose another port and apply it.`
              : code === 'EACCES'
                ? `Windows denied access to port ${next.port}. Choose another port.`
                : 'Could not start the local API. Check the application logs.'
        }
      }
      return status()
    })
  return {
    status,
    configure,
    start: () => configure(preferences, false),
    rotateToken: () =>
      enqueue(async () => {
        rotate()
        return status()
      }),
    getToken: () => token,
    close: () =>
      enqueue(async () => {
        await server?.close()
        server = undefined
      }),
  }
}
