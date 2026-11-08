import { execFile } from 'node:child_process'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { validateDictationWav } from '../shared/local-speech'

const execute = promisify(execFile)
export type SpeechRunner = (executable: string, args: string[], signal?: AbortSignal) => Promise<void>

export class LocalSpeechTranscriber {
  private busy = false
  constructor(
    private assetsDirectory: string,
    private run: SpeechRunner = async (executable, args, signal) => {
      await execute(executable, args, { windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024, signal })
    }
  ) {}
  private get executable() {
    return path.join(this.assetsDirectory, process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli')
  }
  private get model() {
    return path.join(this.assetsDirectory, 'ggml-base.en.bin')
  }
  async ready() {
    try {
      await Promise.all([access(this.executable), access(this.model)])
      return true
    } catch {
      return false
    }
  }
  async transcribe(audio: ArrayBuffer, signal?: AbortSignal): Promise<string> {
    validateDictationWav(audio)
    if (this.busy) throw new Error('Another dictation is still being transcribed.')
    this.busy = true
    let directory: string | undefined
    try {
      if (!(await this.ready()))
        throw new Error('Local dictation is not installed yet. Follow the local voice setup guide.')
      directory = await mkdtemp(path.join(tmpdir(), 'chatbox-dictation-'))
      const input = path.join(directory, 'recording.wav')
      const output = path.join(directory, 'transcript')
      await writeFile(input, new Uint8Array(audio))
      if (signal?.aborted) throw new Error('Dictation cancelled.')
      await this.run(
        this.executable,
        ['-m', this.model, '-f', input, '-l', 'en', '-ng', '-nt', '-otxt', '-of', output],
        signal
      )
      return (await readFile(`${output}.txt`, 'utf8')).replace(/^\uFEFF/, '').trim()
    } finally {
      // mkdtemp creates this exact directory immediately under the OS temporary root.
      try {
        if (directory && path.dirname(directory) === path.resolve(tmpdir()))
          await rm(directory, { recursive: true, force: true })
      } finally {
        this.busy = false
      }
    }
  }
}
