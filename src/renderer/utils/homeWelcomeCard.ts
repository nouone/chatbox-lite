import { getHomeWelcomeCardMode as resolveMode } from '@chatbox/core/application/settings'
import { isLocalInterface } from './local-interface'

export type { HomeWelcomeCardMode } from '@chatbox/core/application/settings'

export function getHomeWelcomeCardMode(params: Parameters<typeof resolveMode>[0] & { showAccountFeatures?: boolean }) {
  return isLocalInterface(params.showAccountFeatures) ? 'none' : resolveMode(params)
}
