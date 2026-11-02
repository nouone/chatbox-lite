import { afterEach, expect, it, vi } from 'vitest'
import { trackEvent } from './track'
afterEach(() => vi.unstubAllGlobals())
it('never forwards feature events even when a tracker exists', () => {
  const plausible = vi.fn()
  vi.stubGlobal('window', { plausible })
  trackEvent('generate', { provider: 'private-model' })
  expect(plausible).not.toHaveBeenCalled()
})
