import type { AnalyticsEventParams } from '../shared/analytics'
// Disable the desktop Measurement Protocol transport, including direct IPC calls.
export async function event(_name: string, _params: AnalyticsEventParams = {}): Promise<void> {}
