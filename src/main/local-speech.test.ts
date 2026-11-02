import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeDictationWav } from '../shared/local-speech'
import { LocalSpeechTranscriber } from './local-speech'

describe('bundled local dictation', () => {
  let assets: string
  beforeEach(async () => {
    assets = await mkdtemp(path.join(tmpdir(), 'chatbox-speech-test-'))
    await writeFile(path.join(assets, process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'), '')
    await writeFile(path.join(assets, 'ggml-base.en.bin'), '')
  })
  afterEach(async () => {
    await rm(assets, { recursive: true, force: true })
  })
  it('runs fixed CPU transcription arguments and removes the temporary recording', async () => {
    let recording = ''
    const runner = vi.fn(async (executable: string, args: string[]) => {
      expect(executable).toContain(assets)
      expect(args).toContain('-ng')
      expect(args.slice(0, 2)).toEqual(['-m', path.join(assets, 'ggml-base.en.bin')])
      recording = args[args.indexOf('-f') + 1]
      expect((await readFile(recording)).byteLength).toBe(48)
      await writeFile(`${args[args.indexOf('-of') + 1]}.txt`, '\uFEFFHello world.\n')
    })
    const service = new LocalSpeechTranscriber(assets, runner)
    expect(await service.ready()).toBe(true)
    expect(await service.transcribe(encodeDictationWav(new Float32Array([0, 0])))).toBe('Hello world.')
    expect(runner).toHaveBeenCalledOnce()
    await expect(access(recording)).rejects.toThrow()
  })
  it('rejects missing resources and never runs arbitrary input', async () => {
    const runner = vi.fn()
    const service = new LocalSpeechTranscriber(path.join(assets, 'missing'), runner)
    expect(await service.ready()).toBe(false)
    await expect(service.transcribe(encodeDictationWav(new Float32Array([0])))).rejects.toThrow('not installed')
    await expect(service.transcribe(new ArrayBuffer(50))).rejects.toThrow()
    expect(runner).not.toHaveBeenCalled()
  })
  it('rejects concurrent jobs and releases the lock after failure', async () => {
    let reject!: (error: Error) => void
    const runner = vi.fn(
      () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail
        })
    )
    const service = new LocalSpeechTranscriber(assets, runner)
    const wav = encodeDictationWav(new Float32Array([0]))
    const pending = service.transcribe(wav)
    const failed = expect(pending).rejects.toThrow('Engine failed')
    await vi.waitFor(() => expect(runner).toHaveBeenCalledOnce())
    await expect(service.transcribe(wav)).rejects.toThrow('Another dictation')
    reject(new Error('Engine failed'))
    await failed
    runner.mockRejectedValueOnce(new Error('Second engine failure'))
    await expect(service.transcribe(wav)).rejects.toThrow('Second engine failure')
  })
})
