import type { getHomeWelcomeCardMode as resolveMode, HomeWelcomeCardMode } from '@chatbox/core/application/settings'
export type { HomeWelcomeCardMode } from '@chatbox/core/application/settings'

/** Vendor account/welcome screens are not part of Chatbox Lite. */
export function getHomeWelcomeCardMode(_params: Parameters<typeof resolveMode>[0]): HomeWelcomeCardMode {
  return 'none'
}
