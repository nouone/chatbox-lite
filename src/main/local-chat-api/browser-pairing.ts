import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const BROWSER_COOKIE = 'cbl_browser'
const REMEMBER_SECONDS = 30 * 24 * 60 * 60

function equal(a: string, b: string) {
  const left = new TextEncoder().encode(a),
    right = new TextEncoder().encode(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/** Short-lived pairing codes never expose the desktop API key. Browser cookies are HttpOnly. */
export function createBrowserPairing(getRootToken: () => string) {
  const pendingCodes = new Map<string, { code: string; expiresAt: number; attempts: number }>()
  const signature = (value: string) => createHmac('sha256', getRootToken()).update(value).digest('hex')
  const cookieToken = (remember: boolean) => {
    const age = remember ? REMEMBER_SECONDS : 12 * 60 * 60
    const payload = `${randomBytes(16).toString('hex')}.${Date.now() + age * 1000}`
    return `${payload}.${signature(payload)}`
  }
  return {
    create: (scope = 'default') => {
      const pairing = { code: randomBytes(24).toString('hex'), expiresAt: Date.now() + 5 * 60 * 1000, attempts: 5 }
      pendingCodes.set(scope, pairing)
      return { code: pairing.code, expiresAt: pairing.expiresAt }
    },
    redeem: (code: string, remember: boolean) => {
      for (const [scope, pending] of pendingCodes) {
        if (pending.expiresAt <= Date.now()) {
          pendingCodes.delete(scope)
          continue
        }
        if (equal(code, pending.code)) {
          pendingCodes.delete(scope)
          return cookieToken(remember)
        }
        if (--pending.attempts <= 0) pendingCodes.delete(scope)
      }
      return undefined
    },
    issue: cookieToken,
    valid: (value: string) => {
      const match = /^([a-f0-9]{32})\.(\d{13})\.([a-f0-9]{64})$/.exec(value)
      return Boolean(match && Number(match[2]) > Date.now() && equal(signature(`${match[1]}.${match[2]}`), match[3]))
    },
    cancel: () => {
      pendingCodes.clear()
    },
  }
}

export function browserCookie(value: string, remember: boolean, secure: boolean) {
  return `${BROWSER_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}${remember ? `; Max-Age=${REMEMBER_SECONDS}` : ''}`
}

export function readBrowserCookie(header?: string) {
  return (
    header
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(BROWSER_COOKIE + '='))
      ?.slice(BROWSER_COOKIE.length + 1) || ''
  )
}
