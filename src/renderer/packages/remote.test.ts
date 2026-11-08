import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildChatboxAIGroupViews } from '@/components/ModelSelectorV2/chatboxCatalog'
import { getChatboxAIModelList, getModelManifest, uploadAndCreateUserFile, uploadAndParseUserFile } from './remote'

const { afetch, upload, setBlob } = vi.hoisted(() => ({ afetch: vi.fn(), upload: vi.fn(), setBlob: vi.fn() }))

vi.mock('@shared/request/request', () => ({ createAfetch: () => afetch, uploadFile: upload }))
vi.mock('@shared/request/chatboxai_pool', () => ({ getChatboxAPIOrigin: () => 'https://example.test' }))
vi.mock('@/lib/utils', () => ({ getLogger: () => ({ error: vi.fn() }) }))
vi.mock('@/platform', () => ({
  default: {
    type: 'web',
    getPlatform: async () => 'web',
    getVersion: async () => 'test',
    setStoreBlob: setBlob,
  },
}))
vi.mock('@/stores/authInfoStore', () => ({ authInfoStore: {} }))
vi.mock('@/variables', () => ({ CHATBOX_BUILD_CHANNEL: 'test', USE_BETA_CHATBOX: false, USE_LOCAL_CHATBOX: false }))
vi.mock('./navigator', () => ({ getOS: () => 'Unknown' }))

import { checkNeedUpdate, getRemoteConfig, getDialogConfig, getNextClientNotification } from './remote'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Lite vendor service removal', () => {
  it('does not request updates, remote configuration or promotional content', async () => {
    expect(await checkNeedUpdate('1.24.0', 'win32', {} as never, {} as never)).toBe(false)
    expect(await getRemoteConfig('setting_chatboxai_first')).toEqual({ setting_chatboxai_first: false })
    expect(await getDialogConfig({ uuid: 'private-device-id', language: 'en', version: '1.24.0' })).toBeNull()
    expect(await getNextClientNotification({ locale: 'en', displayed_batch_ids: [] })).toBeNull()
    expect(afetch).not.toHaveBeenCalled()
  })

  it('rejects vendor catalogs and uploads before a transport or blob write', async () => {
    await expect(getModelManifest({ aiProvider: 'chatbox-ai' })).rejects.toThrow('disabled')
    await expect(getChatboxAIModelList({})).rejects.toThrow('disabled')
    await expect(uploadAndCreateUserFile('key', new File(['private'], 'private.txt'))).rejects.toThrow('disabled')
    await expect(
      uploadAndParseUserFile('key', new File(['private'], 'private.txt'), new AbortController().signal)
    ).rejects.toThrow('disabled')
    expect(afetch).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
    expect(setBlob).not.toHaveBeenCalled()
  })
})
