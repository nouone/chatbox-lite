import type { Plausible } from '@/analytics/plausible'
declare global {
  interface Window {
    plausible?: Plausible
  }
}
// Preserve callers without collecting or transmitting events.
export function trackEvent(_event: string, _props: Record<string, unknown> = {}): void {}
