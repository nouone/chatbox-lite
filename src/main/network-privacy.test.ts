import type { Session } from 'electron'
import { expect, it, vi } from 'vitest'
import { installSessionPrivacy } from './network-privacy'

it('blocks vendor frames/assets and redirected requests in the Chromium session', () => {
  const onBeforeRequest = vi.fn()
  installSessionPrivacy({ webRequest: { onBeforeRequest } } as unknown as Session)
  const handler = onBeforeRequest.mock.calls[0][0]
  const callback = vi.fn()
  handler({ url: 'https://assets.chatboxai.app/notifications/promo.png' }, callback)
  expect(callback).toHaveBeenLastCalledWith({ cancel: true })
  handler({ url: 'https://api.tavily.com/search' }, callback)
  expect(callback).toHaveBeenLastCalledWith({ cancel: false })
})
