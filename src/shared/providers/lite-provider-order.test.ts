import './builtin-registration'
import { expect, it } from 'vitest'
import { SystemProviders } from '../defaults'
import { ModelProviderEnum } from '../types'
it('puts Grok and LM Studio first and excludes Xiaomi/MiMo from the picker catalog', () => {
  const providers = SystemProviders()
  expect(providers.slice(0, 2).map((p) => p.id)).toEqual([ModelProviderEnum.XAI, ModelProviderEnum.LMStudio])
  expect(providers[0].name).toBe('Grok (xAI)')
  expect(providers.some((p) => /xiaomi|mimo/i.test(p.id + ' ' + p.name))).toBe(false)
})
