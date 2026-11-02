import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getHomeWelcomeCardMode } from './homeWelcomeCard'

describe('getHomeWelcomeCardMode', () => {
  beforeEach(() => vi.stubEnv('CHATBOX_LOCAL_UI', '0'))
  afterEach(() => vi.unstubAllEnvs())
  it('hides login and account welcome prompts in the local interface', () => {
    vi.stubEnv('CHATBOX_LOCAL_UI', '1')
    expect(
      getHomeWelcomeCardMode({ providerCount: 0, isLoggedIn: false, hasLicense: false, hasExpiredLicense: false })
    ).toBe('none')
    expect(
      getHomeWelcomeCardMode({ providerCount: 0, isLoggedIn: true, hasLicense: false, hasExpiredLicense: true })
    ).toBe('none')
  })
  it('returns "none" when providerCount > 0', () => {
    expect(
      getHomeWelcomeCardMode({
        providerCount: 1,
        isLoggedIn: false,
        hasLicense: false,
        hasExpiredLicense: false,
      })
    ).toBe('none')
  })

  it('returns "none" when hasLicense is true (even if not logged in)', () => {
    expect(
      getHomeWelcomeCardMode({
        providerCount: 0,
        isLoggedIn: false,
        hasLicense: true,
        hasExpiredLicense: false,
      })
    ).toBe('none')
  })

  it('returns "no-license" when logged in but no license and no providers', () => {
    expect(
      getHomeWelcomeCardMode({
        providerCount: 0,
        isLoggedIn: true,
        hasLicense: false,
        hasExpiredLicense: false,
      })
    ).toBe('no-license')
  })

  it('returns "expired-license" when logged in, no license, and hasExpiredLicense is true', () => {
    expect(
      getHomeWelcomeCardMode({
        providerCount: 0,
        isLoggedIn: true,
        hasLicense: false,
        hasExpiredLicense: true,
      })
    ).toBe('expired-license')
  })

  it('returns "login" when not logged in, no license, no providers', () => {
    expect(
      getHomeWelcomeCardMode({
        providerCount: 0,
        isLoggedIn: false,
        hasLicense: false,
        hasExpiredLicense: false,
      })
    ).toBe('login')
  })

  it('returns "none" during store review even when login card would otherwise show', () => {
    expect(
      getHomeWelcomeCardMode({
        providerCount: 0,
        isLoggedIn: false,
        hasLicense: false,
        hasExpiredLicense: false,
        hideForStoreReview: true,
      })
    ).toBe('none')
  })
})
