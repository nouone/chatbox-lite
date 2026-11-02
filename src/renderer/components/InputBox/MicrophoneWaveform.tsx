import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const BANDS = [1, 2, 3, 5, 8, 12, 18, 28, 43, 64]

/** A read-only audio tap: it never plays audio or stops the recorder's tracks. */
export default function MicrophoneWaveform({ stream }: { stream?: MediaStream }) {
  const { t } = useTranslation()
  const [levels, setLevels] = useState<number[]>(() => Array(9).fill(0))
  useEffect(() => {
    if (!stream || typeof AudioContext === 'undefined') return
    let context: AudioContext | undefined
    let source: MediaStreamAudioSourceNode | undefined
    let analyser: AnalyserNode | undefined
    let frame: number | undefined
    let disposed = false
    const cleanup = () => {
      disposed = true
      if (frame !== undefined) cancelAnimationFrame(frame)
      source?.disconnect()
      analyser?.disconnect()
      if (context && context.state !== 'closed') void context.close().catch(() => {})
    }
    try {
      context = new AudioContext()
      analyser = context.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.65
      source = context.createMediaStreamSource(stream)
      source.connect(analyser)
      void context.resume().catch(() => {})
      const data = new Uint8Array(analyser.frequencyBinCount)
      let lastSample = -Infinity
      const sample = (time: number) => {
        if (disposed || !analyser) return
        if (time - lastSample >= 40) {
          lastSample = time
          analyser.getByteFrequencyData(data)
          const next = BANDS.slice(0, -1).map((start, index) => {
            const end = BANDS[index + 1]
            let sum = 0
            for (let bin = start; bin < end; bin++) sum += data[bin] || 0
            return Math.min(1, sum / ((end - start) * 255))
          })
          setLevels((previous) => next.map((level, index) => previous[index] * 0.3 + level * 0.7))
        }
        frame = requestAnimationFrame(sample)
      }
      frame = requestAnimationFrame(sample)
    } catch {
      // Metering is optional; failure must not interrupt microphone recording.
      cleanup()
    }
    return cleanup
  }, [stream])
  return (
    <span
      role="img"
      aria-label={t('Microphone input level') || 'Microphone input level'}
      className="inline-flex items-center gap-[2px] text-red-500"
      style={{ height: 20 }}
    >
      {levels.map((level, index) => (
        <span
          key={BANDS[index]}
          aria-hidden="true"
          data-mic-level={level.toFixed(2)}
          className="rounded-full bg-current transition-[height] duration-75 ease-linear motion-reduce:transition-none"
          style={{ width: 3, height: 2 + level * 16 }}
        />
      ))}
    </span>
  )
}
