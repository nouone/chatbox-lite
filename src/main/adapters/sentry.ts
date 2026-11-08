import type { SentryAdapter, SentryScope } from '../../shared/utils/sentry_adapter'

// Keep error-handling call sites functional without initializing a remote SDK.
export class MainSentryAdapter implements SentryAdapter {
  captureException(_error: unknown): void {}
  withScope(callback: (scope: SentryScope) => void): void {
    callback({ setTag() {}, setExtra() {} })
  }
}
export const sentry = new MainSentryAdapter()
export async function flushSentry(_timeout: number): Promise<boolean> {
  return true
}
