export type PlausibleNavigationSubscriber = (onResolved: (hrefChanged: boolean) => void) => void

// No analytics scripts, navigation subscriptions, or event queue in this build.
export async function initPlausibleTracking(_subscribe?: PlausibleNavigationSubscriber): Promise<void> {}
