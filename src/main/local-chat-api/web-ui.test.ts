// @vitest-environment jsdom
import { fireEvent, waitFor } from '@testing-library/dom'
import { expect, it, vi } from 'vitest'
import { LOCAL_CHAT_WEB_UI } from './web-ui'

type ChatSnapshot = {
  id: string
  revision: number
  messages: { id: string; role: string; text: string }[]
}

async function setup(readChat?: (url: string) => Promise<ChatSnapshot>) {
  document.body.innerHTML = LOCAL_CHAT_WEB_UI.split('<body>')[1].split('<script>')[0]
  const history = {
    id: 'existing-chat',
    messages: [{ id: 'a', role: 'assistant', text: '<img src=x onerror=alert(1)>' }],
    generating: false,
  }
  let paired = false
  const chats = [{ id: 'existing-chat', name: 'Desktop chat' }]
  if (readChat) chats.push({ id: 'other-chat', name: 'Other chat' })
  const fetch = vi.fn(
    async (url: string, options?: { method?: string; body?: string; headers?: Record<string, string> }) => {
      if (url.endsWith('/speech') && options?.method === 'POST') return {ok:true,blob:async()=>new Blob(['audio'],{type:'audio/mpeg'})}
      if (url === '/api/chats' && options?.method === 'POST') {
        const chat = { id: 'new-chat', name: 'New chat' }
        chats.unshift(chat)
        return { ok: true, json: async () => chat }
      }
      if (url === '/api/session' && options?.headers?.Authorization) paired = true
      if (!options?.headers?.Authorization && !paired)
        return { ok: false, json: async () => ({ error: 'Bearer token required' }) }
      return {
        ok: true,
        json: async () =>
          url.startsWith('/api/chats?')
            ? { items: chats, nextCursor: null }
            : options?.method === 'POST'
              ? { messageId: 'new-message' }
              : readChat ? await readChat(url) : history,
      }
    }
  )
  const sockets: FakeSocket[] = []
  class FakeSocket {
    onopen?: () => void
    onclose?: () => void
    onmessage?: (event: { data: string }) => void
    send = vi.fn()
    close = vi.fn()
    constructor() {
      sockets.push(this)
    }
  }
  const frame = vi.fn((callback: () => void) => callback())
  const script = LOCAL_CHAT_WEB_UI.match(/<script>([\s\S]*)<\/script>/)![1]
  const timers: (() => unknown)[] = []
  const timeout = vi.fn((callback: () => unknown) => {
    timers.push(callback)
    return timers.length
  })
  new Function('document', 'fetch', 'WebSocket', 'requestAnimationFrame', 'setTimeout', 'clearTimeout', script)(
    document,
    fetch,
    FakeSocket,
    frame,
    timeout,
    vi.fn()
  )
  fireEvent.input(document.getElementById('token')!, { target: { value: 'private-test-token' } })
  fireEvent.submit(document.getElementById('connect-form')!)
  await waitFor(() => expect(document.getElementById('login')!.hidden).toBe(true))
  return { fetch, sockets, frame, timers }
}

it('continues the selected desktop chat, renders response text safely, and sends no model configuration', async () => {
  const { fetch, sockets } = await setup()
  expect(document.getElementById('title')!.textContent).toBe('Desktop chat')
  expect(document.querySelector('#messages img')).toBeNull()
  expect(document.querySelector('.bubble')!.textContent).toContain('<img')
  sockets[0].onopen!()
  expect(sockets[0].send).toHaveBeenCalledWith(
    JSON.stringify({ type: 'subscribe', chatId: 'existing-chat', view: 'web' })
  )
  fireEvent.input(document.getElementById('content')!, { target: { value: 'Continue our desktop conversation' } })
  fireEvent.submit(document.getElementById('composer')!)
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/api/chats/existing-chat/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ content: 'Continue our desktop conversation' }),
      })
    )
  )
  expect(document.querySelectorAll('select').length).toBe(1) // Conversation picker only; voice mode uses segmented tap controls, still no model picker.
})

function snapshot(revision: number, ...messages: string[]): ChatSnapshot {
  return {
    id: 'existing-chat',
    revision,
    messages: messages.map((id) => ({ id, role: 'assistant', text: id })),
  }
}

function renderedReplies() {
  return Array.from(document.querySelectorAll('#messages .message-content'), (node) => node.textContent)
}

it('keeps the newest reply at the bottom when the live window adds older history', async () => {
  const { fetch, sockets } = await setup(async () => snapshot(20, 'newest'))
  expect(fetch).toHaveBeenCalledWith('/api/chats/existing-chat?view=web&limit=100', expect.anything())
  expect(renderedReplies()).toEqual(['newest'])

  const update = (chat: ChatSnapshot) => sockets[0].onmessage!({
    data: JSON.stringify({ type: 'chat.snapshot', status: 200, chat }),
  })
  update(snapshot(20, 'older', 'newest'))
  expect(renderedReplies()).toEqual(['older', 'newest'])

  update(snapshot(19, 'older'))
  expect(renderedReplies()).toEqual(['older', 'newest'])
})

it('ignores an outstanding refresh from a previous visit to the same conversation', async () => {
  let current = snapshot(19, 'older')
  let pending: Promise<ChatSnapshot> | undefined
  const { timers } = await setup(async (url) =>
    url.includes('other-chat') ? { ...snapshot(1), id: 'other-chat' } : pending ?? current
  )
  expect(renderedReplies()).toEqual(['older'])

  let release!: (chat: ChatSnapshot) => void
  pending = new Promise((resolve) => { release = resolve })
  timers.at(-1)!()
  pending = undefined
  current = snapshot(20, 'older', 'newest')

  const picker = document.getElementById('mobile-chats')!
  fireEvent.change(picker, { target: { value: 'other-chat' } })
  await waitFor(() => expect(document.getElementById('status')!.textContent).toBe('Connected to Desktop'))
  fireEvent.change(picker, { target: { value: 'existing-chat' } })
  await waitFor(() => expect(renderedReplies()).toEqual(['older', 'newest']))

  release(snapshot(20, 'older'))
  // Drain the pending fetch and JSON promises before checking the rendered result.
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(renderedReplies()).toEqual(['older', 'newest'])
})

it('keeps a live update when an earlier refresh returns at the same revision', async () => {
  let response = Promise.resolve(snapshot(20, 'older'))
  const { sockets, timers } = await setup(() => response)
  let release!: (chat: ChatSnapshot) => void
  response = new Promise((resolve) => { release = resolve })
  timers.at(-1)!()

  sockets[0].onmessage!({
    data: JSON.stringify({ type: 'chat.snapshot', status: 200, chat: snapshot(20, 'older', 'newest') }),
  })
  release(snapshot(20, 'older'))
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(renderedReplies()).toEqual(['older', 'newest'])
})

it('reconnects a remembered browser after a closed stream without asking for its token', async () => {
  const { sockets, timers } = await setup()
  expect((document.getElementById('token') as HTMLInputElement).value).toBe('')
  sockets[0].onclose!()
  expect(document.getElementById('status')!.textContent).toContain('Reconnecting')
  await timers[timers.length - 1]()
  await waitFor(() => expect(sockets.length).toBe(2))
  expect(document.getElementById('login')!.hidden).toBe(true)
})

it('requests a new desktop chat through the API and displays reported processing/generation rates', async () => {
  const { fetch, sockets } = await setup()
  fireEvent.click(document.getElementById('new-chat')!)
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith('/api/chats', expect.objectContaining({ method: 'POST', body: '{}' }))
  )
  await waitFor(() => expect(document.getElementById('title')!.textContent).toBe('New chat'))
  await waitFor(()=>expect(sockets.length).toBe(2))
  sockets[sockets.length - 1].onmessage!({
    data: JSON.stringify({
      type: 'chat.snapshot',
      status: 200,
      chat: {
        id: 'new-chat',
        messages: [
          {
            id: 'reply',
            role: 'assistant',
            text: 'Done',
            performance: { totalTokens: 210, processingTokensPerSecond: 500, generationTokensPerSecond: 68.1 },
          },
        ],
      },
    }),
  })
  expect(document.querySelector('.message-meta')!.textContent).toContain('210 tokens')
  expect(document.querySelector('.message-meta')!.textContent).toContain('68 t/s')
})

it('updates a streamed message in place and follows only when already near the bottom', async () => {
  const { sockets, frame } = await setup()
  const area = document.getElementById('messages')!
  Object.defineProperty(area, 'scrollHeight', { configurable: true, value: 1000 })
  Object.defineProperty(area, 'clientHeight', { configurable: true, value: 400 })
  area.scrollTop = 0
  const originalBubble = document.querySelector('.bubble')
  frame.mockClear()
  const update = (text: string) =>
    sockets[0].onmessage!({
      data: JSON.stringify({
        type: 'chat.snapshot',
        status: 200,
        chat: {
          id: 'existing-chat',
          generating: true,
          messages: [{ id: 'a', role: 'assistant', text }],
        },
      }),
    })
  update('A partial reply')
  expect(document.querySelector('.bubble')).toBe(originalBubble)
  expect(originalBubble!.textContent).toBe('A partial reply')
  expect(frame).not.toHaveBeenCalled()
  area.scrollTop = 600
  update('A longer partial reply')
  expect(frame).toHaveBeenCalledOnce()
})

it('shows reply dots while waiting and streaming, then clears them on completion, failure and disconnect', async () => {
  const { sockets } = await setup()
  const update = (chat: Record<string, unknown>) => sockets[0].onmessage!({data:JSON.stringify({type:'chat.snapshot',status:200,chat:{id:'existing-chat',...chat}})})
  const activeDots = () => Array.from(document.querySelectorAll<HTMLElement>('.reply-dots')).filter(d => !d.hidden && !d.closest('[hidden]'))
  update({generating:true,messages:[{id:'user',role:'user',text:'ping'}]})
  expect(activeDots()).toHaveLength(1)
  expect(activeDots()[0].children).toHaveLength(3)
  update({generating:true,messages:[{id:'reply',role:'assistant',text:'Partial',generating:true}]})
  expect(activeDots()).toHaveLength(1)
  expect(document.querySelector('.message-content')!.textContent).toBe('Partial')
  update({generating:false,messages:[{id:'reply',role:'assistant',text:'Done',generating:false}]})
  expect(activeDots()).toHaveLength(0)
  update({generating:true,error:'Provider failed',messages:[]})
  expect(activeDots()).toHaveLength(0)
  update({generating:true,waitingForApproval:true,messages:[]})
  expect(activeDots()).toHaveLength(0)
  update({generating:true,messages:[]})
  expect(activeDots()).toHaveLength(1)
  sockets[0].onclose!()
  expect(activeDots()).toHaveLength(0)
})

it('offers phone audio controls when Safari requires a second playback tap, and releases audio on chat changes',async()=>{
  Object.defineProperty(URL,'createObjectURL',{configurable:true,value:vi.fn(()=> 'blob:phone-speech')})
  Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:vi.fn()})
  const play=vi.spyOn(HTMLMediaElement.prototype,'play').mockRejectedValue(new Error('NotAllowedError'))
  const pause=vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{})
  const {fetch}=await setup()
  fireEvent.click(document.querySelector('.message-actions button')!)
  await waitFor(()=>expect(fetch).toHaveBeenCalledWith('/api/chats/existing-chat/messages/a/speech',expect.objectContaining({method:'POST',credentials:'same-origin',body:'{}'})))
  await waitFor(()=>expect(document.querySelector<HTMLAudioElement>('audio')!.hidden).toBe(false))
  expect(document.querySelector<HTMLAudioElement>('audio')!.controls).toBe(true)
  expect(document.getElementById('status')!.textContent).toContain('Tap Play')
  fireEvent.click(document.getElementById('refresh')!)
  await waitFor(()=>expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:phone-speech'))
  expect(pause).toHaveBeenCalled()
  play.mockRestore();pause.mockRestore()
})
it('keeps the voice overlay TTS element control-free and inline-playable',async()=>{
  await setup()
  const voiceAudio=document.getElementById('voice-audio')!
  // iOS drew native controls over the voice UI (above Voice Settings): the
  // attribute must stay gone, the element hidden, and playback inline.
  expect(voiceAudio.hasAttribute('controls')).toBe(false)
  expect(voiceAudio.controls).toBe(false)
  expect(voiceAudio.hidden).toBe(true)
  expect(voiceAudio.hasAttribute('playsinline')).toBe(true)
  expect(voiceAudio.getAttribute('webkit-playsinline')).toBe('')
})
