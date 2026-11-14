export type LocalChatCall = {
  action: 'list' | 'read' | 'send' | 'create' | 'speech' | 'asr' | 'speak' | 'voice-note'
  messageId?: string
  chatId?: string
  content?: string
  /** Mic-mode send: the reply is only ever heard, so the user message is
   * stored prefixed with a speakable-answer instruction (VOICE_INSTRUCTION
   * in the send handler). One model pass produces speech-ready text; there
   * is no separate rewrite stage. */
  voice?: boolean
  // Per-send thinking level for chats driven by API clients (voice apps). The
  // renderer persists it into the session settings the same way the desktop
  // Thinking Effort selector does, so the next generation in this chat uses it.
  thinkingEffort?: 'off' | 'low' | 'medium' | 'high'
  cursor?: string
  limit?: number
}
export type LocalChatResult = { status: number; body: unknown }
export type LocalChatEnvelope = { id: string; call: LocalChatCall }

export const LOCAL_API_CHANNELS = {
  status: 'wao-api:status',
  configure: 'wao-api:configure',
  rotateToken: 'wao-api:rotate-token',
  copyToken: 'wao-api:copy-token',
  openBrowser: 'wao-api:open-browser',
  pairPhone: 'wao-api:pair-phone',
} as const

export type LocalApiStatus = {
  enabled: boolean
  running: boolean
  port: number
  hasToken: boolean
  url: string
  error?: string
  /** Set when localhost/Tailscale came up but the LAN listener failed (e.g. a
   * saved static IP after the machine moved networks); the API still runs. */
  lanError?: string
  publicOrigin?: string
  lanAddress?: string
}

export type LocalApiPairing = { url: string; expiresAt: number }

export function normalizeTailnetOrigin(value?: string): string | undefined {
  if (!value?.trim()) return undefined
  const url = new URL(value.trim())
  if (
    url.protocol !== 'https:' ||
    !url.hostname.endsWith('.ts.net') ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('Enter the HTTPS .ts.net address printed by Tailscale Serve, without a path.')
  return url.origin
}

export type LocalApiPairingSet = { tailnet?: LocalApiPairing; lan?: LocalApiPairing }
export function normalizeLanAddress(value?: string): string | undefined {
  if (!value?.trim()) return undefined
  const address = value.trim(),
    parts = address.split('.').map(Number)
  if (
    !/^\d{1,3}(\.\d{1,3}){3}$/.test(address) ||
    parts.some((p) => p < 0 || p > 255) ||
    !(
      parts[0] === 10 ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    )
  )
    throw new Error('Enter a private LAN IPv4 address assigned to this computer.')
  return parts.join('.')
}
