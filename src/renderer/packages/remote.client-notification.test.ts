import { beforeEach, describe, expect, it, vi } from 'vitest'

const ofetchMock = vi.hoisted(() => vi.fn())

vi.mock('ofetch', () => ({ ofetch: ofetchMock }))
vi.mock('@/platform', () => ({
  default: {
    type: 'web',
    getPlatform: vi.fn().mockResolvedValue('web'),
    getVersion: vi.fn().mockResolvedValue('web'),
  },
}))
vi.mock('@/stores/authInfoStore', () => ({
  authInfoStore: {
    getState: () => ({ getTokens: () => null }),
  },
}))

import { getNextClientNotification } from './remote'

describe('getNextClientNotification', () => {
  beforeEach(() => ofetchMock.mockReset())
  it('never sends locale or notification history to the vendor', async () => {
    expect(await getNextClientNotification({ locale: 'en', displayed_batch_ids: ['private-history'] })).toBeNull()
    expect(ofetchMock).not.toHaveBeenCalled()
  })
})
