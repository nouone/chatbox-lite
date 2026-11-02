import { afterEach, expect, it, vi } from 'vitest'
const ofetch = vi.hoisted(() => vi.fn())
vi.mock('ofetch', () => ({ ofetch }))
import { event } from './analystic-node'
import { sentry, flushSentry } from './adapters/sentry'
afterEach(() => vi.unstubAllGlobals())
it('direct desktop analytics calls and error reports never use the network', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  await event('app_open', { session_id: 123 })
  const handled = vi.fn()
  sentry.withScope((scope) => {
    scope.setTag('private', 'value')
    scope.setExtra('secret', 'value')
    handled()
  })
  sentry.captureException(new Error('private failure'))
  expect(await flushSentry(100)).toBe(true)
  expect(handled).toHaveBeenCalledOnce()
  expect(fetch).not.toHaveBeenCalled()
  expect(ofetch).not.toHaveBeenCalled()
})
