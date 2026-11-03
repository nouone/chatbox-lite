import { beforeEach, expect, it, vi } from 'vitest'
import type { Message } from '@shared/types'
const mocks = vi.hoisted(() => ({
  settings: {enabled:true,apiBaseUrl:'http://localhost:8880',apiKey:'desktop-only-key',model:'kokoro',voice:'af_heart',speed:1.1},
  request:vi.fn(),
}))
vi.mock('@/stores/settingsStore',()=>({settingsStore:{getState:()=>({getSettings:()=>({textToSpeech:mocks.settings})})}}))
vi.mock('@/utils/desktop-direct-request',()=>({desktopDirectRequestFromWindow:mocks.request}))
import { synthesizeWebReply } from './local-chat-speech'
import { responseSpeechPlayer } from './text-to-speech'
const message:Message = {id:'reply',role:'assistant',contentParts:[{type:'text',text:'Hello **world**. https://example.com'}]}
beforeEach(()=>{
  mocks.settings.enabled=true
  mocks.request.mockReset().mockResolvedValue(new Response('audio',{headers:{'Content-Type':'audio/mpeg'}}))
})
it('reuses Desktop normalization, model, voice and speed but returns audio without playing on Desktop or returning credentials',async()=>{
  const play=vi.spyOn(responseSpeechPlayer,'play')
  const result=await synthesizeWebReply(message)
  expect(mocks.request.mock.calls[0][0]).toBe('http://localhost:8880/v1/audio/speech')
  const headers=mocks.request.mock.calls[0][2] as Headers
  expect(headers.get('Authorization')).toBe('Bearer desktop-only-key')
  const body=JSON.parse(String(mocks.request.mock.calls[0][3]))
  expect(body).toMatchObject({model:'kokoro',voice:'af_heart',speed:1.1,response_format:'mp3'})
  expect(body.input).toContain('Hello world.')
  expect(body.input).not.toContain('https://')
  expect(result).toEqual({audioBase64:btoa('audio'),contentType:'audio/mpeg'})
  expect(JSON.stringify(result)).not.toContain('desktop-only-key')
  expect(play).not.toHaveBeenCalled()
  play.mockRestore()
})
it('requires Desktop read-aloud configuration and reports server failures without playback',async()=>{
  mocks.settings.enabled=false
  await expect(synthesizeWebReply(message)).rejects.toThrow('Enable Read aloud')
  expect(mocks.request).not.toHaveBeenCalled()
  mocks.settings.enabled=true
  mocks.request.mockResolvedValue(new Response('unavailable',{status:503}))
  await expect(synthesizeWebReply(message)).rejects.toThrow('Speech server returned HTTP 503')
})
