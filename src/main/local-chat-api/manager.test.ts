import { expect, it, vi } from 'vitest'
import { createLocalApiManager } from './manager'

function setup(token = '') {
  const server = { close: vi.fn().mockResolvedValue(undefined), setToken: vi.fn() }
  const options = {
    preferences: { enabled: false, port: 8085 },
    token,
    savePreferences: vi.fn(),
    saveToken: vi.fn(),
    start: vi.fn().mockResolvedValue(server),
  }
  return { manager: createLocalApiManager(options), options, server }
}

it('creates separate LAN and Tailscale pairing links without embedding the API token', async () => {
  const root = 'root-token'.repeat(8)
  const createPairing = vi.fn((scope?: string) => ({ code: `one-use-${scope}`, expiresAt: Date.now() + 300000 }))
  const options = {
    preferences: { enabled: false, port: 8088 },
    token: root,
    savePreferences: vi.fn(),
    saveToken: vi.fn(),
    start: vi.fn().mockResolvedValue({ close: vi.fn(), setToken: vi.fn(), createPairing }),
  }
  const manager = createLocalApiManager(options)
  await manager.configure({
    enabled: true,
    port: 8088,
    publicOrigin: 'https://pc.example.ts.net:8443',
    lanAddress: '192.168.1.10',
  })
  const links = await manager.pairPhone()
  expect(links.tailnet?.url).toBe('https://pc.example.ts.net:8443/#pair=one-use-tailnet')
  expect(links.lan?.url).toBe('http://192.168.1.10:8088/#pair=one-use-lan')
  expect(JSON.stringify(links)).not.toContain(root)
  expect(options.start).toHaveBeenCalledWith(8088, root, 'https://pc.example.ts.net:8443', '192.168.1.10')
})

it('stays off by default, generates and saves a strong token on enable, and stops on disable', async () => {
  const { manager, options, server } = setup()
  await manager.start()
  expect(options.start).not.toHaveBeenCalled()
  expect(options.saveToken).not.toHaveBeenCalled()
  expect(await manager.configure({ enabled: true, port: 8087 })).toMatchObject({
    running: true,
    port: 8087,
    hasToken: true,
  })
  expect(manager.getToken()).toMatch(/^[a-f0-9]{64}$/)
  expect(options.saveToken).toHaveBeenCalledWith(manager.getToken())
  expect(options.start).toHaveBeenCalledWith(8087, manager.getToken(), undefined, undefined)
  expect(manager.status()).not.toHaveProperty('token')
  await manager.configure({ enabled: false, port: 8087 })
  expect(server.close).toHaveBeenCalledOnce()
  expect(manager.status().running).toBe(false)
})

it('rotates active credentials and saves them before revoking the old token', async () => {
  const old = 'old-secret'.repeat(8)
  const { manager, options, server } = setup(old)
  await manager.configure({ enabled: true, port: 8085 })
  await manager.rotateToken()
  expect(manager.getToken()).not.toBe(old)
  expect(options.saveToken).toHaveBeenCalledWith(manager.getToken())
  expect(server.setToken).toHaveBeenCalledWith(manager.getToken())
  expect(options.saveToken.mock.invocationCallOrder[0]).toBeLessThan(server.setToken.mock.invocationCallOrder[0])
})

it('reports port conflicts without pretending to run and can retry another port', async () => {
  const { manager, options } = setup()
  options.start.mockRejectedValueOnce(Object.assign(new Error('busy'), { code: 'EADDRINUSE' }))
  expect(await manager.configure({ enabled: true, port: 8085 })).toMatchObject({
    running: false,
    error: expect.stringContaining('already in use'),
  })
  expect(await manager.configure({ enabled: true, port: 8087 })).toMatchObject({ running: true, port: 8087 })
  expect(manager.status().error).toBeUndefined()
})

it('serializes overlapping changes and rejects invalid settings before changing the listener', async () => {
  const { manager, server } = setup()
  await Promise.all([
    manager.configure({ enabled: true, port: 8085 }),
    manager.configure({ enabled: true, port: 8087 }),
    manager.configure({ enabled: false, port: 8087 }),
  ])
  expect(server.close).toHaveBeenCalledTimes(2)
  expect(manager.status()).toMatchObject({ enabled: false, running: false, port: 8087 })
  await expect(manager.configure({ enabled: true, port: 0 })).rejects.toThrow('port')
  expect(manager.status().port).toBe(8087)
})
