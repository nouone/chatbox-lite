import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiError, ChatboxAIAPIError } from '../models/errors'
import { createAfetch, createAuthenticatedAfetch, uploadFile } from './request'

const platformInfo = {
  type: 'desktop',
  platform: 'darwin',
  os: 'macos',
  version: '1.0.0',
}

describe('createAfetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('blocks vendor requests before sending identifiers or credentials', async () => {
    const fetchMock = vi.fn()
    const afetch = createAfetch(platformInfo, fetchMock)
    await expect(
      afetch('https://api.chatboxai.app/api/profile', { headers: { Authorization: 'private' } }, { retry: 3 })
    ).rejects.toThrow('disabled')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('preserves custom-provider headers without app identity metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'))
    const afetch = createAfetch(platformInfo, fetchMock)
    const init = { headers: { Authorization: 'Bearer private' } }
    await afetch('https://provider.example/v1/chat', init)
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('https://provider.example/v1/chat', init)
  })

  it.each([
    { codeName: 'token_quota_exhausted', status: 429, clientCode: 10004 },
    { codeName: 'license_downgraded', status: 409, clientCode: 20047 },
  ])('parses $codeName from HTTP $status and preserves the request id', async ({ codeName, status, clientCode }) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: codeName,
              request_id: 'req-from-body',
            },
          }),
          { status }
        )
      )
    )

    const afetch = createAfetch(platformInfo)

    await expect(
      afetch('https://provider.example/v1/chat/completions', {}, { parseChatboxRemoteError: true })
    ).rejects.toMatchObject({
      code: clientCode,
      requestId: 'req-from-body',
    } satisfies Partial<ChatboxAIAPIError>)
  })

  it('stores request id from response headers on generic API errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'not_a_real_code', request_id: 'req-from-body' } }), {
          status: 500,
          headers: { 'x-request-id': 'req-from-header' },
        })
      )
    )

    const afetch = createAfetch(platformInfo)

    await expect(
      afetch('https://provider.example/v1/chat/completions', {}, { parseChatboxRemoteError: true })
    ).rejects.toMatchObject({
      code: 10001,
      statusCode: 500,
      requestId: 'req-from-header',
    } satisfies Partial<ApiError>)
  })

  it('does not retry when the account is unavailable', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'account_unavailable',
            title: 'Unable to Sign In',
            detail:
              "We can't sign you in to this account. If you believe this is a mistake, please contact hi@chatboxai.com.",
          },
        }),
        { status: 403 }
      )
    )
    const afetch = createAfetch(platformInfo, fetchMock)

    await expect(
      afetch(
        'https://provider.example/auth/login_or_signup_with_email_code',
        {},
        {
          parseChatboxRemoteError: true,
          retry: 3,
        }
      )
    ).rejects.toMatchObject({
      code: 10001,
      statusCode: 403,
    } satisfies Partial<ApiError>)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry or clear tokens for an authenticated account-unavailable response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'account_unavailable' } }), {
        status: 403,
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const clearTokens = vi.fn()
    const afetch = createAuthenticatedAfetch({
      platformInfo,
      getTokens: vi.fn().mockResolvedValue({ accessToken: 'access-token', refreshToken: 'refresh-token' }),
      refreshTokens: vi.fn().mockResolvedValue({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' }),
      clearTokens,
    })

    await expect(
      afetch(
        'https://provider.example/auth/web_auth_token/generate',
        {},
        {
          parseChatboxRemoteError: true,
          retry: 3,
        }
      )
    ).rejects.toMatchObject({
      code: 10001,
      statusCode: 403,
    } satisfies Partial<ApiError>)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(clearTokens).not.toHaveBeenCalled()
  })

  it('recognizes a structural AbortError without depending on DOMException', async () => {
    const abortError = Object.assign(new Error('cancelled'), { name: 'AbortError' })
    const fetchMock = vi.fn().mockRejectedValue(abortError)
    const afetch = createAfetch(platformInfo, fetchMock)

    await expect(afetch('https://example.com', {}, { retry: 3 })).rejects.toBe(abortError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('raw file upload cancellation', () => {
  afterEach(() => vi.unstubAllGlobals())
  class UploadRequest {
    static current: UploadRequest
    upload = { onprogress: () => undefined }
    status = 200
    onload = () => undefined
    onerror = () => undefined
    onabort = () => undefined
    open = vi.fn()
    send = vi.fn()
    abort = vi.fn(() => this.onabort())
    getResponseHeader = () => 'fixture-etag'
    constructor() {
      UploadRequest.current = this
    }
  }

  it('aborts the active XHR and rejects instead of waiting indefinitely', async () => {
    vi.stubGlobal('DOMException', undefined)
    vi.stubGlobal('XMLHttpRequest', UploadRequest)
    const controller = new AbortController()
    const upload = uploadFile(new File(['fixture'], 'report.doc'), 'https://upload.test/file', controller.signal)
    const rejected = expect(upload).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await rejected
    expect(UploadRequest.current.abort).toHaveBeenCalledOnce()
  })

  it('does not create an XHR for an already canceled upload', async () => {
    vi.stubGlobal('DOMException', undefined)
    const request = vi.fn()
    vi.stubGlobal('XMLHttpRequest', request)
    const controller = new AbortController()
    controller.abort()
    await expect(
      uploadFile(new File(['fixture'], 'report.doc'), 'https://upload.test/file', controller.signal)
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(request).not.toHaveBeenCalled()
  })

  it('removes cancellation listeners after successful upload', async () => {
    vi.stubGlobal('XMLHttpRequest', UploadRequest)
    const controller = new AbortController()
    const result = uploadFile(new File(['fixture'], 'report.doc'), 'https://upload.test/file', controller.signal)
    UploadRequest.current.onload()
    expect(await result).toMatchObject({ ETag: 'fixture-etag' })
    controller.abort()
    expect(UploadRequest.current.abort).not.toHaveBeenCalled()
  })
})
