import { expect, it } from 'vitest'
import { ModelProviderEnum } from './types'
import { hasLiteModelSelection, requireLiteModelSelection, selectNewLiteChatModel } from './lite-model-selection'
import { chatSessionSettings } from './defaults'

it('leaves new chat defaults unselected instead of selecting the vendor', () => {
  expect(chatSessionSettings().provider).toBeUndefined()
  expect(chatSessionSettings().modelId).toBeUndefined()
})
it('blocks missing and legacy vendor selections before model construction', () => {
  for (const settings of [{}, {provider:'custom'}, {provider:'custom',modelId:' '}, {provider:ModelProviderEnum.ChatboxAI,modelId:'chatboxai-4'}]) {
    expect(hasLiteModelSelection(settings)).toBe(false)
    expect(() => requireLiteModelSelection(settings)).toThrow('Select a chat model')
  }
  expect(() => requireLiteModelSelection({provider:'custom-endpoint',modelId:'my-chat'})).not.toThrow()
})
it('uses explicit non-vendor defaults or the last used chat model without guessing another model', () => {
  const custom = {provider:'custom-endpoint',modelId:'my-chat'}
  const last = {provider:'other',modelId:'other-chat'}
  const vendor = {provider:ModelProviderEnum.ChatboxAI,modelId:'chatboxai-4'}
  expect(selectNewLiteChatModel(custom,last)).toEqual(custom)
  expect(selectNewLiteChatModel(vendor,last)).toEqual(last)
  expect(selectNewLiteChatModel(undefined, vendor)).toBeUndefined()
  expect(selectNewLiteChatModel(undefined,undefined)).toBeUndefined()
})
