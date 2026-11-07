import { useSyncExternalStore } from 'react'
import type { Message, Settings } from '@shared/types'
import { visibleContentParts } from '@shared/utils/message'

export const DEFAULT_TTS_BASE_URL = process.env.AUDIO_TTS_OPENAI_API_BASE_URL || 'http://localhost:8880'
export type SpeechSettings = NonNullable<Settings['textToSpeech']>

// Expand only explicit measurement suffixes. Case matters for storage (MB versus Mb),
// and ambiguous abbreviations such as "in" and bare "m" are deliberately omitted.
const SPEECH_UNITS: Record<string, readonly [string, string]> = {
  '%': ['percent', 'percent'],
  'km/h': ['kilometer per hour', 'kilometers per hour'],
  kph: ['kilometer per hour', 'kilometers per hour'],
  mph: ['mile per hour', 'miles per hour'],
  MPH: ['mile per hour', 'miles per hour'],
  KPH: ['kilometer per hour', 'kilometers per hour'],
  'm/s': ['meter per second', 'meters per second'],
  km: ['kilometer', 'kilometers'],
  cm: ['centimeter', 'centimeters'],
  mm: ['millimeter', 'millimeters'],
  mi: ['mile', 'miles'],
  ft: ['foot', 'feet'],
  kg: ['kilogram', 'kilograms'],
  mg: ['milligram', 'milligrams'],
  g: ['gram', 'grams'],
  lb: ['pound', 'pounds'],
  lbs: ['pound', 'pounds'],
  oz: ['ounce', 'ounces'],
  ml: ['milliliter', 'milliliters'],
  mL: ['milliliter', 'milliliters'],
  L: ['liter', 'liters'],
  gal: ['gallon', 'gallons'],
  ms: ['millisecond', 'milliseconds'],
  s: ['second', 'seconds'],
  sec: ['second', 'seconds'],
  secs: ['second', 'seconds'],
  min: ['minute', 'minutes'],
  mins: ['minute', 'minutes'],
  hr: ['hour', 'hours'],
  hrs: ['hour', 'hours'],
  KB: ['kilobyte', 'kilobytes'],
  MB: ['megabyte', 'megabytes'],
  GB: ['gigabyte', 'gigabytes'],
  TB: ['terabyte', 'terabytes'],
  'MB/s': ['megabyte per second', 'megabytes per second'],
  Mbps: ['megabit per second', 'megabits per second'],
  Gbps: ['gigabit per second', 'gigabits per second'],
  Hz: ['hertz', 'hertz'],
  MHz: ['megahertz', 'megahertz'],
  GHz: ['gigahertz', 'gigahertz'],
  W: ['watt', 'watts'],
  kW: ['kilowatt', 'kilowatts'],
  kWh: ['kilowatt hour', 'kilowatt hours'],
  V: ['volt', 'volts'],
  '°': ['degree', 'degrees'],
}
const speechUnitPattern = new RegExp(
  `(?<![\\w./:])([+\\-−]?(?:\\d+(?:,\\d{3})*(?:\\.\\d+)?|\\.\\d+))[ \\t]*(${Object.keys(SPEECH_UNITS)
    .sort((a, b) => b.length - a.length)
    .map((unit) => unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})(?![\\w/])`,
  'g'
)

function expandSpeechMeasurements(text: string): string {
  return text
    .replace(/(?<![\w./:])(\d+(?:\.\d+)?)[ \t]*[–—-][ \t]*(\d+(?:\.\d+)?)[ \t]*(mph|kph|km\/h|m\/s)\b/gi, '$1 to $2 $3')
    .replace(speechUnitPattern, (_match, value: string, unit: string) => {
      const number = Number(value.replaceAll(',', '').replace('−', '-'))
      const name = SPEECH_UNITS[unit][Math.abs(number) === 1 ? 0 : 1]
      return `${value.replace(/^[-−]/, 'minus ').replace(/^\+/, 'plus ')} ${name}`
    })
    .replace(
      /(?<![\w/])([$£€])[ \t]*(\d+(?:,\d{3})*)(?:\.(\d{1,2}))?(?![\w.])/g,
      (_match, symbol: string, whole: string, fraction?: string) => {
        const units =
          symbol === '$'
            ? ['dollar', 'dollars', 'cent', 'cents']
            : symbol === '£'
              ? ['pound', 'pounds', 'penny', 'pence']
              : ['euro', 'euros', 'cent', 'cents']
        const major = Number(whole.replaceAll(',', ''))
        const minor = Number((fraction || '').padEnd(2, '0'))
        const amount = `${whole} ${units[major === 1 ? 0 : 1]}`
        return minor ? `${amount} and ${minor} ${units[minor === 1 ? 2 : 3]}` : amount
      }
    )
}

const DAY_NAMES: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  tues: 'Tuesday',
  wed: 'Wednesday',
  weds: 'Wednesday',
  thu: 'Thursday',
  thur: 'Thursday',
  thurs: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}
const MONTH_NAMES: Record<string, string> = {
  jan: 'January',
  feb: 'February',
  mar: 'March',
  apr: 'April',
  may: 'May',
  jun: 'June',
  jul: 'July',
  aug: 'August',
  sep: 'September',
  oct: 'October',
  nov: 'November',
  dec: 'December',
}
const ORDINAL_DAYS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
  'thirteenth',
  'fourteenth',
  'fifteenth',
  'sixteenth',
  'seventeenth',
  'eighteenth',
  'nineteenth',
  'twentieth',
  'twenty-first',
  'twenty-second',
  'twenty-third',
  'twenty-fourth',
  'twenty-fifth',
  'twenty-sixth',
  'twenty-seventh',
  'twenty-eighth',
  'twenty-ninth',
  'thirtieth',
  'thirty-first',
]
const BIBLE_BOOKS: Record<string, string> = {
  Genesis: 'Genesis',
  Gen: 'Genesis',
  Exodus: 'Exodus',
  Exod: 'Exodus',
  Leviticus: 'Leviticus',
  Lev: 'Leviticus',
  Numbers: 'Numbers',
  Num: 'Numbers',
  Deuteronomy: 'Deuteronomy',
  Deut: 'Deuteronomy',
  Joshua: 'Joshua',
  Josh: 'Joshua',
  Judges: 'Judges',
  Judg: 'Judges',
  Ruth: 'Ruth',
  Samuel: 'Samuel',
  Kings: 'Kings',
  Chronicles: 'Chronicles',
  Ezra: 'Ezra',
  Nehemiah: 'Nehemiah',
  Esther: 'Esther',
  Job: 'Job',
  Psalms: 'Psalms',
  Psalm: 'Psalm',
  Ps: 'Psalm',
  Proverbs: 'Proverbs',
  Prov: 'Proverbs',
  Ecclesiastes: 'Ecclesiastes',
  Eccl: 'Ecclesiastes',
  'Song of Solomon': 'Song of Solomon',
  Isaiah: 'Isaiah',
  Isa: 'Isaiah',
  Jeremiah: 'Jeremiah',
  Jer: 'Jeremiah',
  Lamentations: 'Lamentations',
  Ezekiel: 'Ezekiel',
  Daniel: 'Daniel',
  Dan: 'Daniel',
  Hosea: 'Hosea',
  Joel: 'Joel',
  Amos: 'Amos',
  Obadiah: 'Obadiah',
  Jonah: 'Jonah',
  Micah: 'Micah',
  Nahum: 'Nahum',
  Habakkuk: 'Habakkuk',
  Zephaniah: 'Zephaniah',
  Haggai: 'Haggai',
  Zechariah: 'Zechariah',
  Malachi: 'Malachi',
  Matthew: 'Matthew',
  Matt: 'Matthew',
  Mark: 'Mark',
  Luke: 'Luke',
  John: 'John',
  Jn: 'John',
  Acts: 'Acts',
  Romans: 'Romans',
  Rom: 'Romans',
  Corinthians: 'Corinthians',
  Cor: 'Corinthians',
  Galatians: 'Galatians',
  Gal: 'Galatians',
  Ephesians: 'Ephesians',
  Eph: 'Ephesians',
  Philippians: 'Philippians',
  Phil: 'Philippians',
  Colossians: 'Colossians',
  Col: 'Colossians',
  Thessalonians: 'Thessalonians',
  Thess: 'Thessalonians',
  Timothy: 'Timothy',
  Tim: 'Timothy',
  Titus: 'Titus',
  Philemon: 'Philemon',
  Hebrews: 'Hebrews',
  Heb: 'Hebrews',
  James: 'James',
  Jas: 'James',
  Peter: 'Peter',
  Pet: 'Peter',
  Jude: 'Jude',
  Revelation: 'Revelation',
  Rev: 'Revelation',
}
const bibleReferencePattern = new RegExp(
  `\\b(?:([1-3])[ \\t]+)?(${Object.keys(BIBLE_BOOKS)
    .sort((a, b) => b.length - a.length)
    .join('|')})\\.?[ \\t]*(\\d{1,3}):(\\d{1,3})(?:[–-](\\d{1,3}))?\\b`,
  'g'
)

const WIND_DIRECTIONS: Record<string, string> = {
  N: 'north',
  NNE: 'north northeast',
  NE: 'northeast',
  ENE: 'east northeast',
  E: 'east',
  ESE: 'east southeast',
  SE: 'southeast',
  SSE: 'south southeast',
  S: 'south',
  SSW: 'south southwest',
  SW: 'southwest',
  WSW: 'west southwest',
  W: 'west',
  WNW: 'west northwest',
  NW: 'northwest',
  NNW: 'north northwest',
}

function expandSpeechAbbreviations(text: string): string {
  return text
    .replace(
      /\b(winds?(?:[ \t]+(?:direction|from|coming[ \t]+from))?(?:[ \t]+the)?[ \t]*:?[ \t]+)(NNE|ENE|ESE|SSE|SSW|WSW|WNW|NNW|NE|SE|SW|NW|N|E|S|W)\b/gi,
      (_match, prefix: string, direction: string) => `${prefix}${WIND_DIRECTIONS[direction.toUpperCase()]}`
    )
    .replace(
      /\b(Mon|Tues?|Weds?|Thu|Thur|Thurs|Fri|Sat|Sun)\b\.?/g,
      (day) => DAY_NAMES[day.replace('.', '').toLowerCase()]
    )
    .replace(
      /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?[ \t]+(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\b(?!\.\d)/g,
      (_match, month: string, day: string) =>
        `${MONTH_NAMES[month.slice(0, 3).toLowerCase()]} ${ORDINAL_DAYS[Number(day) - 1]}`
    )
    .replace(/(?<![\w/:])\b(mph|kph|km\/h|m\/s)\b/gi, (unit) => SPEECH_UNITS[unit.toLowerCase()][1])
    .replace(
      /\b(Dr|Mr|Mrs|Ms|Prof)\.(?=[ \t]+[A-Z])/g,
      (_match, title: string) =>
        ({ Dr: 'Doctor', Mr: 'Mister', Mrs: 'Missus', Ms: 'Miz', Prof: 'Professor' })[title as 'Dr']
    )
    .replace(/\be\.g\./g, 'for example')
    .replace(/\bi\.e\./g, 'that is')
    .replace(/\betc\./g, 'and so on')
    .replace(
      bibleReferencePattern,
      (_match, prefix: string | undefined, book: string, chapter: string, verse: string, last: string | undefined) =>
        `${prefix ? `${['First', 'Second', 'Third'][Number(prefix) - 1]} ` : ''}${BIBLE_BOOKS[book]} chapter ${chapter}, ${last ? 'verses' : 'verse'} ${verse}${last ? ` through ${last}` : ''}`
    )
}

export function speechEndpoint(baseUrl: string): string {
  const url = new URL(baseUrl.trim())
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Use an HTTP or HTTPS speech server URL without credentials or query parameters.')
  }
  const path = url.pathname.replace(/\/+$/, '')
  url.pathname = path.endsWith('/audio/speech') ? path : `${path}${path.endsWith('/v1') ? '' : '/v1'}/audio/speech`
  return url.toString()
}

export function responseSpeechText(message: Message): string {
  const text = visibleContentParts(message.contentParts || [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .replace(/```[^\n]*\n[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<?(?:https?:\/\/|www\.)[^\s<>]+>?/gi, '')
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s*|[-*+]\s+)/gm, '')
    .replace(/[`*_~]/g, '')
    .replace(
      /(?<![\w.])([+\-−]?\d+(?:\.\d+)?)\s*(?:°\s*|degrees?\s+)?([FC])\b/gi,
      (_match, value: string, unit: string) => {
        const spokenValue = value.replace(/^[-−]/, 'minus ').replace(/^\+/, 'plus ')
        const degree = Math.abs(Number(value.replace('−', '-'))) === 1 ? 'degree' : 'degrees'
        return `${spokenValue} ${degree} ${unit.toUpperCase() === 'F' ? 'Fahrenheit' : 'Celsius'}`
      }
    )
    .trim()
  return expandSpeechAbbreviations(expandSpeechMeasurements(text))
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export async function synthesizeSpeech(
  text: string,
  settings: SpeechSettings,
  request: typeof fetch,
  signal: AbortSignal
): Promise<Blob> {
  const headers = new Headers({ 'Content-Type': 'application/json', Accept: 'audio/mpeg' })
  if (settings.apiKey?.trim()) headers.set('Authorization', `Bearer ${settings.apiKey.trim()}`)
  const response = await request(speechEndpoint(settings.apiBaseUrl?.trim() || DEFAULT_TTS_BASE_URL), {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify({
      model: settings.model?.trim() || 'kokoro',
      voice: settings.voice?.trim() || 'af_heart',
      input: text,
      response_format: 'mp3',
      speed:
        settings.speed !== undefined && Number.isFinite(settings.speed) && settings.speed >= 0.25 && settings.speed <= 4
          ? settings.speed
          : 1,
    }),
  })
  if (!response.ok) throw new Error(`Speech server returned HTTP ${response.status}.`)
  const blob = await response.blob()
  if (!blob.size || (!blob.type.startsWith('audio/') && !blob.type.startsWith('application/octet-stream'))) {
    throw new Error('The speech server did not return audio.')
  }
  return blob
}

type PlaybackState = { id?: string; loading: boolean }
type AudioPlayer = Pick<HTMLAudioElement, 'play' | 'pause' | 'src' | 'onended' | 'onerror'>

/** One player across all replies; cancellation also guards against late network responses. */
export class ResponseSpeechPlayer {
  private state: PlaybackState = { loading: false }
  private listeners = new Set<() => void>()
  private controller?: AbortController
  private audio?: AudioPlayer
  private url?: string

  constructor(private createAudio: (url: string) => AudioPlayer = (url) => new Audio(url)) {}

  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private update(state: PlaybackState) {
    this.state = state
    for (const listener of this.listeners) listener()
  }
  stop = () => {
    this.controller?.abort()
    this.controller = undefined
    if (this.audio) {
      this.audio.onended = null
      this.audio.onerror = null
      this.audio.pause()
      this.audio.src = ''
      this.audio = undefined
    }
    if (this.url) URL.revokeObjectURL(this.url)
    this.url = undefined
    this.update({ loading: false })
  }
  async play(id: string, synthesize: (signal: AbortSignal) => Promise<Blob>, onError: (error: Error) => void) {
    this.stop()
    const controller = new AbortController()
    this.controller = controller
    this.update({ id, loading: true })
    try {
      const blob = await synthesize(controller.signal)
      if (controller.signal.aborted) return
      this.url = URL.createObjectURL(blob)
      const audio = this.createAudio(this.url)
      this.audio = audio
      audio.onended = this.stop
      audio.onerror = () => {
        this.stop()
        onError(new Error('Could not play the speech audio.'))
      }
      await audio.play()
      if (!controller.signal.aborted) this.update({ id, loading: false })
    } catch (error) {
      if (controller.signal.aborted) return
      this.stop()
      onError(error instanceof Error ? error : new Error('Speech playback failed.'))
    }
  }
}

export const responseSpeechPlayer = new ResponseSpeechPlayer()

// Whether this reply's audio is loading or playing. The message action bar
// uses it to stay visible while speech is still processing, so the stop
// control and its spinner don't vanish the moment the pointer leaves.
export function useReplySpeechActive(playbackId: string): boolean {
  return useSyncExternalStore(
    responseSpeechPlayer.subscribe,
    () => responseSpeechPlayer.getSnapshot().id === playbackId
  )
}
const speechInputs = new Set<symbol>()
export function beginSpeechInput() {
  const token = Symbol('microphone')
  speechInputs.add(token)
  responseSpeechPlayer.stop()
  return () => {
    speechInputs.delete(token)
  }
}
export function isSpeechInputActive() {
  return speechInputs.size > 0
}
