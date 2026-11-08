import { expect, it } from 'vitest'
import { getHomeWelcomeCardMode } from './homeWelcomeCard'
it.each([false, true])('never restores account or upgrade welcomes with saved login %s', (isLoggedIn) => {
  expect(getHomeWelcomeCardMode({ providerCount: 0, isLoggedIn, hasLicense: false, hasExpiredLicense: true })).toBe(
    'none'
  )
})
