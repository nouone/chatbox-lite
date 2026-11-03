import { afterEach, expect, it, vi } from 'vitest'
import { browserCookie, createBrowserPairing } from './browser-pairing'
import { normalizeLanAddress, normalizeTailnetOrigin } from '../../shared/local-chat-api'
afterEach(() => vi.useRealTimers())
it('pairs two independently usable QR codes without exposing the API key, and rejects replay, tampering and rotation', () => {
  let root = 'private-root-token'.repeat(4)
  const pairs = createBrowserPairing(() => root)
  const lan = pairs.create('lan'),
    tailnet = pairs.create('tailnet')
  expect(lan.code).not.toContain(root)
  const cookie = pairs.redeem(lan.code, true)!
  expect(pairs.valid(cookie)).toBe(true)
  expect(pairs.redeem(lan.code, true)).toBeUndefined()
  expect(pairs.redeem(tailnet.code, true)).toBeTruthy()
  expect(pairs.valid(cookie + 'x')).toBe(false)
  expect(browserCookie(cookie, true, true)).toContain('HttpOnly; SameSite=Strict; Secure; Max-Age=2592000')
  root = 'rotated-token'.repeat(5)
  expect(pairs.valid(cookie)).toBe(false)
})
it('expires pairing codes after five minutes and remembered sessions after thirty days', () => {
  vi.useFakeTimers()
  const pairs = createBrowserPairing(() => 'a'.repeat(64))
  const pair = pairs.create()
  const cookie = pairs.issue(true)
  vi.advanceTimersByTime(5 * 60 * 1000)
  expect(pairs.redeem(pair.code, true)).toBeUndefined()
  vi.advanceTimersByTime(30 * 24 * 60 * 60 * 1000)
  expect(pairs.valid(cookie)).toBe(false)
})
it('accepts only explicit private LAN addresses and exact Tailscale HTTPS origins', () => {
  expect(normalizeLanAddress('192.168.1.12')).toBe('192.168.1.12')
  expect(normalizeTailnetOrigin('https://pc.example.ts.net:8443/')).toBe('https://pc.example.ts.net:8443')
  for (const address of ['0.0.0.0', '8.8.8.8', '192.168.1.999', 'http://192.168.1.1'])
    expect(() => normalizeLanAddress(address)).toThrow()
  for (const origin of [
    'https://example.com',
    'http://pc.example.ts.net',
    'https://pc.example.ts.net/extra',
    'https://x:secret@pc.example.ts.net',
  ])
    expect(() => normalizeTailnetOrigin(origin)).toThrow()
})
