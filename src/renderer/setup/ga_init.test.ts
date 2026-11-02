import { expect, it, vi } from 'vitest'
const platform = vi.hoisted(() => ({ initTracking: vi.fn(), trackingEvent: vi.fn(), onWindowFocused: vi.fn() }))
vi.mock('@/platform', () => ({ default: platform }))
import { initGoogleAnalyticsTracking } from './ga_init'
it('repeated startup does not install tracking or foreground listeners', async () => {
  await initGoogleAnalyticsTracking()
  await initGoogleAnalyticsTracking()
  expect(platform.initTracking).not.toHaveBeenCalled()
  expect(platform.trackingEvent).not.toHaveBeenCalled()
  expect(platform.onWindowFocused).not.toHaveBeenCalled()
})
