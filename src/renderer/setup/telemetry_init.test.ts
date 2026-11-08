// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'

const spies = vi.hoisted(() => ({ init: vi.fn(), subscribe: vi.fn(), platform: vi.fn() }))
vi.mock('@sentry/react', () => ({ init: spies.init }))
vi.mock('@/stores/settingsStore', () => ({
  initSettingsStore: async () => ({ allowReportingAndTracking: true }),
  settingsStore: { getState: () => ({ allowReportingAndTracking: true }), subscribe: spies.subscribe },
}))
vi.mock('@/platform', () => ({ default: { initTracking: spies.platform, trackingEvent: spies.platform } }))

it('never initializes telemetry even with persisted consent and an available tracker', async () => {
  const plausible = vi.fn()
  window.plausible = plausible
  const navigation = vi.fn()
  const { initSentry } = await import('./sentry_init')
  const { initGoogleAnalyticsTracking } = await import('./ga_init')
  const { initPlausibleTracking } = await import('./plausible_init')
  expect(await initSentry()).toBe(false)
  await initGoogleAnalyticsTracking()
  await initPlausibleTracking(navigation)
  expect(spies.init).not.toHaveBeenCalled()
  expect(spies.subscribe).not.toHaveBeenCalled()
  expect(spies.platform).not.toHaveBeenCalled()
  expect(plausible).not.toHaveBeenCalled()
  expect(navigation).not.toHaveBeenCalled()
  delete window.plausible
})
