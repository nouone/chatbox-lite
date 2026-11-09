import { SettingsSchema } from '@shared/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResponseSpeechPlayer, responseSpeechText, speechEndpoint, synthesizeSpeech } from './text-to-speech'

afterEach(() => vi.restoreAllMocks())

describe('OpenAI-compatible speech', () => {
  it.each([
    'http://localhost:8880',
    'http://localhost:8880/',
    'http://localhost:8880/v1',
    'http://localhost:8880/v1/',
    'http://localhost:8880/v1/audio/speech',
  ])('normalizes %s to the Kokoro endpoint', (base) => {
    expect(speechEndpoint(base)).toBe('http://localhost:8880/v1/audio/speech')
  })
  it('preserves reverse proxy prefixes and rejects invalid URLs', () => {
    expect(speechEndpoint('https://example.com/kokoro/v1')).toBe('https://example.com/kokoro/v1/audio/speech')
    for (const url of [
      'file:///a',
      'ftp://example.com',
      'http://key:secret@example.com',
      'http://localhost?key=secret',
    ]) {
      expect(() => speechEndpoint(url)).toThrow()
    }
  })
  it('sends Kokoro defaults, keeps binary audio, and supports optional authentication', async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { 'Content-Type': 'audio/mpeg' },
        })
      )
    )
    const signal = new AbortController().signal
    const blob = await synthesizeSpeech('Hello', { apiBaseUrl: 'http://localhost:8880' }, request, signal)
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
    const [url, init] = request.mock.calls[0]
    expect(url).toBe('http://localhost:8880/v1/audio/speech')
    expect(init?.signal).toBe(signal)
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).has('Authorization')).toBe(false)
    expect(JSON.parse(String(init?.body))).toEqual({
      model: 'kokoro',
      voice: 'af_heart',
      input: 'Hello',
      response_format: 'mp3',
      speed: 1,
    })
    await synthesizeSpeech('Hi', { model: 'custom', voice: 'bf_emma', apiKey: 'secret' }, request, signal)
    const other = request.mock.calls[1][1]
    expect(new Headers(other?.headers).get('Authorization')).toBe('Bearer secret')
    expect(JSON.parse(String(other?.body))).toMatchObject({ model: 'custom', voice: 'bf_emma' })
  })
  it('reports HTTP errors and rejects non-audio payloads', async () => {
    const request = vi.fn<typeof fetch>()
    request.mockResolvedValueOnce(new Response('bad', { status: 503 }))
    await expect(synthesizeSpeech('Hi', {}, request, new AbortController().signal)).rejects.toThrow('HTTP 503')
    request.mockResolvedValueOnce(new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
    await expect(synthesizeSpeech('Hi', {}, request, new AbortController().signal)).rejects.toThrow(
      'did not return audio'
    )
  })
  it('reads response text without reasoning, protocol-only text, images or tools', () => {
    expect(
      responseSpeechText({
        id: '1',
        role: 'assistant',
        contentParts: [
          { type: 'reasoning', text: 'Private thoughts' },
          { type: 'text', text: 'Hidden', protocolOnly: true },
          { type: 'text', text: '# Hello **world**\n[Example](https://example.com)\n```js\nsecret()\n```' },
        ],
      })
    ).toBe('Hello world\nExample')
  })
  it.each([
    ['It is 64°F today.', 'It is 64 degrees Fahrenheit today.'],
    ['64 ° F', '64 degrees Fahrenheit'],
    ['64F', '64 degrees Fahrenheit'],
    ['64 degrees F', '64 degrees Fahrenheit'],
    ['1°F', '1 degree Fahrenheit'],
    ['-1°C', 'minus 1 degree Celsius'],
    ['−5°C', 'minus 5 degrees Celsius'],
    ['+5 C', 'plus 5 degrees Celsius'],
    ['18.5°C', '18.5 degrees Celsius'],
    ['**64°F**', '64 degrees Fahrenheit'],
    ['A64F, F-16, 64GB and 64 degrees Fahrenheit', 'A64F, F-16, 64 gigabytes and 64 degrees Fahrenheit'],
  ])('speaks temperature units in %s', (input, expected) => {
    const message = {
      id: 'temperature',
      role: 'assistant' as const,
      contentParts: [{ type: 'text' as const, text: input }],
    }
    expect(responseSpeechText(message)).toBe(expected)
    expect(message.contentParts[0].text).toBe(input)
  })
  it.each([
    ['Humidity is 64%.', 'Humidity is 64 percent.'],
    ['Wind: 12 mph and 1 mph.', 'Wind: 12 miles per hour and 1 mile per hour.'],
    ['80 km/h or 80kph', '80 kilometers per hour or 80 kilometers per hour'],
    ['3 m/s', '3 meters per second'],
    ['5km, 1mi, 3ft, 1ft', '5 kilometers, 1 mile, 3 feet, 1 foot'],
    ['2 cm and 10mm', '2 centimeters and 10 millimeters'],
    ['1kg, 2kg, 5mg, 2g, 3lbs, 1oz', '1 kilogram, 2 kilograms, 5 milligrams, 2 grams, 3 pounds, 1 ounce'],
    ['250mL, 2L, 1gal', '250 milliliters, 2 liters, 1 gallon'],
    ['2hrs, 1min, 30s, 5ms', '2 hours, 1 minute, 30 seconds, 5 milliseconds'],
    ['16GB, 1TB, 500MB/s, 100Mbps', '16 gigabytes, 1 terabyte, 500 megabytes per second, 100 megabits per second'],
    ['3.5GHz, 60Hz, 2kWh, 120V', '3.5 gigahertz, 60 hertz, 2 kilowatt hours, 120 volts'],
    ['A 90° angle', 'A 90 degrees angle'],
    ['.5kg and −2kg', '.5 kilograms and minus 2 kilograms'],
    [
      '$12.50, $1.01, $5, $1,200.05',
      '12 dollars and 50 cents, 1 dollar and 1 cent, 5 dollars, 1,200 dollars and 5 cents',
    ],
    ['£1.01 and €2.50', '1 pound and 1 penny and 2 euros and 50 cents'],
    ['2m, 3 in a row, RTX5090, A64F, 10Mbit, 16Mb', '2m, 3 in a row, RTX5090, A64F, 10Mbit, 16Mb'],
    ['https://example.com/16GB and /tmp/5kg', 'and /tmp/5kg'],
  ])('expands common units in %s', (input, expected) => {
    const message = { id: 'units', role: 'assistant' as const, contentParts: [{ type: 'text' as const, text: input }] }
    expect(responseSpeechText(message)).toBe(expected)
    expect(message.contentParts[0].text).toBe(input)
  })
  it.each([
    ['Mon, Nov 2', 'Monday, November second'],
    ['Tue., Jan 1st and Thurs, Sept 21', 'Tuesday, January first and Thursday, September twenty-first'],
    ['mph, kph, km/h', 'miles per hour, kilometers per hour, kilometers per hour'],
    ['Dr. Smith, Mr. Jones and Prof. Brown', 'Doctor Smith, Mister Jones and Professor Brown'],
    ['John 13:4', 'John chapter 13, verse 4'],
    ['Jn. 13:4-7', 'John chapter 13, verses 4 through 7'],
    ['1 John 4:8', 'First John chapter 4, verse 8'],
    ['2 Corinthians 5:7', 'Second Corinthians chapter 5, verse 7'],
    ['Psalm 23:1 and Gen 1:1', 'Psalm chapter 23, verse 1 and Genesis chapter 1, verse 1'],
    ['At 13:04, version 13:4 is unchanged.', 'At 13:04, version 13:4 is unchanged.'],
    ['See https://example.com/a and www.example.com', 'See and'],
    ['Read [the article](https://example.com) or <https://example.com>', 'Read the article or'],
  ])('normalizes abbreviations and links in %s', (input, expected) => {
    expect(responseSpeechText({ id: 'speech', role: 'assistant', contentParts: [{ type: 'text', text: input }] })).toBe(
      expected
    )
  })
  it.each([0.25, 0.85, 1, 1.5, 4])('sends the selected speech speed %s', async (speed) => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('audio', { headers: { 'Content-Type': 'audio/mpeg' } }))
    await synthesizeSpeech('Hello', { speed }, request, new AbortController().signal)
    expect(JSON.parse(String(request.mock.calls[0][1]?.body)).speed).toBe(speed)
    expect(SettingsSchema.pick({ textToSpeech: true }).parse({ textToSpeech: { speed } }).textToSpeech?.speed).toBe(
      speed
    )
  })
  it.each([
    ['wind S 5–10 mph', 'wind south 5 to 10 miles per hour'],
    ['Wind: NW 10-15 MPH', 'Wind: northwest 10 to 15 miles per hour'],
    ['Winds from the SSE at 1 mph', 'Winds from the south southeast at 1 mile per hour'],
    ['Wind direction: ESE', 'Wind direction: east southeast'],
    ['Wind N 5 mph, then wind W 10 mph', 'Wind north 5 miles per hour, then wind west 10 miles per hour'],
    ['John S. Smith at 5 S Street', 'John S. Smith at 5 S Street'],
    ['5–10 mph and 10—20 kph', '5 to 10 miles per hour and 10 to 20 kilometers per hour'],
  ])('speaks wind directions and speed ranges in %s', (input, expected) => {
    expect(responseSpeechText({ id: 'wind', role: 'assistant', contentParts: [{ type: 'text', text: input }] })).toBe(
      expected
    )
  })
  it('defaults missing speech configuration to Kokoro while preserving explicit older settings', () => {
    const schema = SettingsSchema.pick({ textToSpeech: true })
    expect(schema.parse({}).textToSpeech).toEqual({
      enabled: true,
      apiBaseUrl: 'http://localhost:8880',
      model: 'kokoro',
      voice: 'af_heart',
      speed: 1.1,
      autoRead: false,
    })
    const settings = { enabled: true, apiBaseUrl: 'http://localhost:8880', model: 'kokoro', voice: 'af_heart' }
    expect(schema.parse({ textToSpeech: settings }).textToSpeech).toEqual(settings)
  })
})

describe('response audio lifecycle', () => {
  function harness() {
    const audio = { play: vi.fn(() => Promise.resolve()), pause: vi.fn(), src: '', onended: null, onerror: null }
    const createAudio = vi.fn(() => audio)
    const player = new ResponseSpeechPlayer(createAudio)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    return { audio, createAudio, player, revoke }
  }
  it('plays audio and frees it on stop', async () => {
    const { player, audio, revoke } = harness()
    await player.play('one', () => Promise.resolve(new Blob(['audio'])), vi.fn())
    expect(player.getSnapshot()).toEqual({ id: 'one', loading: false })
    expect(audio.play).toHaveBeenCalledOnce()
    player.stop()
    expect(audio.pause).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledWith('blob:test')
    expect(player.getSnapshot().id).toBeUndefined()
  })
  it('cancels the previous request and ignores its late audio', async () => {
    const { player, createAudio } = harness()
    let resolve!: (blob: Blob) => void
    let signal!: AbortSignal
    const first = player.play(
      'one',
      (value) => {
        signal = value
        return new Promise((done) => {
          resolve = done
        })
      },
      vi.fn()
    )
    expect(player.getSnapshot()).toEqual({ id: 'one', loading: true })
    await player.play('two', () => Promise.resolve(new Blob(['two'])), vi.fn())
    expect(signal.aborted).toBe(true)
    resolve(new Blob(['late']))
    await first
    expect(createAudio).toHaveBeenCalledOnce()
    expect(player.getSnapshot().id).toBe('two')
    player.stop()
  })
  it('cleans up and reports browser playback failures', async () => {
    const { player, audio, revoke } = harness()
    audio.play.mockRejectedValueOnce(new Error('Audio blocked'))
    const error = vi.fn()
    await player.play('one', () => Promise.resolve(new Blob(['audio'])), error)
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: 'Audio blocked' }))
    expect(revoke).toHaveBeenCalledOnce()
    expect(player.getSnapshot().id).toBeUndefined()
  })
})
