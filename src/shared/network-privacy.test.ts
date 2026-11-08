import { describe, expect, it, vi } from 'vitest'
import { assertAllowedNetworkUrl, installPrivateFetch, isBlockedVendorUrl } from './network-privacy'

describe('Lite network privacy', () => {
  it.each([
    'https://api.chatboxai.app/api/remote_config',
    'https://api.ai-chatbox.com/api/api_origins',
    'https://api.chatboxapp.xyz/api/auto_upgrade',
    'https://api.chatboxai.com',
    'https://sentry.midway.run/api/697/envelope/',
    'https://o123.ingest.sentry.io',
    'https://plausible.io/api/event',
    'https://www.googletagmanager.com/gtag/js',
    'https://region1.google-analytics.com/g/collect',
    'https://ARTIFACT-PREVIEW.CHATBOXAI.APP./preview',
    'wss://api.chatboxai.app/socket',
  ])('blocks vendor/telemetry destination %s', (url) => {
    expect(isBlockedVendorUrl(url)).toBe(true)
    expect(() => assertAllowedNetworkUrl(url)).toThrow('disabled')
  })

  it.each([
    'http://localhost:8880/v1/audio/speech',
    'http://127.0.0.1:8080/v1/chat/completions',
    'https://api.tavily.com/search',
    'https://api.openai.com/v1/chat/completions',
    'https://my-custom-endpoint.example/v1',
    'https://github.com/chatboxai/chatbox',
    'https://chatboxai.app.example.net/v1',
    'https://chatboxai.app@provider.example/v1',
  ])('preserves provider, local speech, search and credit URLs %s', (url) => {
    expect(isBlockedVendorUrl(url)).toBe(false)
  })

  it('rejects before calling the transport, including Request and URL inputs', async () => {
    const transport = vi.fn().mockResolvedValue(new Response('ok'))
    const target = { fetch: transport as typeof fetch }
    installPrivateFetch(target)
    for (const input of [
      'https://api.chatboxai.app',
      new URL('https://sentry.midway.run'),
      new Request('https://api.chatboxai.app'),
    ]) {
      await expect(target.fetch(input)).rejects.toThrow('disabled')
    }
    expect(transport).not.toHaveBeenCalled()
    const options = { method: 'POST', body: 'private provider request' }
    await target.fetch('http://localhost:8880/v1/audio/speech', options)
    expect(transport).toHaveBeenCalledExactlyOnceWith('http://localhost:8880/v1/audio/speech', options)
  })
})
