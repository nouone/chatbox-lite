/** Vendor services and telemetry are unavailable in Lite, regardless of saved consent. */
const blockedDomains = [
  'chatboxai.app',
  'chatboxai.com',
  'chatboxapp.xyz',
  'ai-chatbox.com',
  'midway.run',
  'sentry.io',
  'plausible.io',
  'google-analytics.com',
  'googletagmanager.com',
  'lemonsqueezy.com',
]

export function isBlockedVendorUrl(input: string | URL): boolean {
  try {
    const host = new URL(input).hostname.toLowerCase().replace(/\.+$/, '')
    return blockedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`))
  } catch {
    return false
  }
}

export function assertAllowedNetworkUrl(input: string | URL): void {
  if (isBlockedVendorUrl(input)) throw new Error('Vendor services and telemetry are disabled in Chatbox Lite.')
}

/** Install before importing clients that capture global fetch. Provider requests pass through. */
export function installPrivateFetch(target: Pick<typeof globalThis, 'fetch'>): void {
  const original = target.fetch
  if (!original) return
  target.fetch = (input, init) => {
    const url = typeof input === 'string' || input instanceof URL ? input : input.url
    if (isBlockedVendorUrl(url)) {
      return Promise.reject(new Error('Vendor services and telemetry are disabled in Chatbox Lite.'))
    }
    return original.call(target, input, init)
  }
}
