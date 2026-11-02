import { ActionIcon, Group, Loader, Text } from '@mantine/core'
import { LOCAL_SPEECH_CHANNELS, LOCAL_SPEECH_MAX_SECONDS } from '@shared/local-speech'
import { IconMicrophone, IconPlayerStop, IconArrowUp } from '@tabler/icons-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppTooltip } from '@/components/ui/tooltip'
import { recordingToWav } from '@/packages/microphone'
import { beginSpeechInput } from '@/packages/text-to-speech'
import platform from '@/platform'
import * as toast from '@/stores/toastActions'
import MicrophoneWaveform from './MicrophoneWaveform'

export default function MicrophoneButton({
  iconSize,
  onTranscript,
  onSend,
  sendDisabled = false,
}: {
  iconSize: number
  onTranscript: (text: string) => void
  onSend?: () => void
  sendDisabled?: boolean
}) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<'idle' | 'starting' | 'recording' | 'transcribing'>('idle')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  useEffect(() => {
    if (phase !== 'recording') return
    const startedAt = Date.now()
    setElapsedSeconds(0)
    const ticker = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(ticker)
  }, [phase])
  const recorder = useRef<MediaRecorder>()
  const stream = useRef<MediaStream>()
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const mounted = useRef(true)
  const releaseSpeechInput = useRef<() => void>(() => {})
  const release = useCallback(() => {
    clearTimeout(timer.current)
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = undefined
  }, [])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (recorder.current) {
        recorder.current.onstop = null
        recorder.current.ondataavailable = null
        recorder.current.onerror = null
        if (recorder.current.state !== 'inactive') recorder.current.stop()
      }
      release()
      releaseSpeechInput.current()
    }
  }, [release])
  if (platform.type !== 'desktop') return null
  const record = async () => {
    if (phase === 'recording') {
      recorder.current?.stop()
      return
    }
    if (phase !== 'idle') return
    setPhase('starting')
    try {
      if (!(await window.electronAPI.invoke(LOCAL_SPEECH_CHANNELS.status))) {
        throw new Error('Local dictation is not installed yet. Follow the local voice setup guide.')
      }
      if (!mounted.current) return
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
        throw new Error('Microphone recording is unavailable.')
      releaseSpeechInput.current = beginSpeechInput()
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true },
        video: false,
      })
      if (!mounted.current) {
        media.getTracks().forEach((track) => track.stop())
        return
      }
      stream.current = media
      const capture = new MediaRecorder(media)
      recorder.current = capture
      const chunks: Blob[] = []
      capture.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data)
      }
      capture.onstop = async () => {
        release()
        if (!mounted.current) return
        setPhase('transcribing')
        try {
          const wav = await recordingToWav(new Blob(chunks, { type: capture.mimeType }))
          if (!mounted.current) return
          const text: unknown = await window.electronAPI.invoke(LOCAL_SPEECH_CHANNELS.transcribe, wav)
          if (mounted.current && typeof text === 'string' && text.trim()) onTranscript(text)
        } catch (error) {
          if (mounted.current)
            toast.add(`${t('Dictation')}: ${error instanceof Error ? error.message : 'Transcription failed.'}`)
        } finally {
          releaseSpeechInput.current()
          if (mounted.current) setPhase('idle')
        }
      }
      capture.onerror = () => {
        capture.onstop = null
        if (capture.state !== 'inactive') capture.stop()
        release()
        releaseSpeechInput.current()
        if (mounted.current) {
          setPhase('idle')
          toast.add(t('Microphone recording failed.'))
        }
      }
      capture.start()
      setPhase('recording')
      timer.current = setTimeout(() => {
        if (capture.state !== 'inactive') capture.stop()
      }, LOCAL_SPEECH_MAX_SECONDS * 1000)
    } catch (error) {
      release()
      releaseSpeechInput.current()
      if (mounted.current) {
        setPhase('idle')
        toast.add(`${t('Dictation')}: ${error instanceof Error ? error.message : 'Microphone access failed.'}`)
      }
    }
  }
  const label =
    phase === 'recording'
      ? t('Stop dictation')
      : phase === 'transcribing'
        ? t('Transcribing locally')
        : phase === 'starting'
          ? t('Requesting microphone')
          : t('Dictate message')
  return (
    <Group gap={4} wrap="nowrap">
      <AppTooltip label={label}>
        <ActionIcon
          variant="subtle"
          color={phase === 'recording' ? 'red' : 'chatbox-secondary'}
          aria-label={label}
          disabled={phase === 'starting' || phase === 'transcribing'}
          onClick={() => void record()}
        >
          {phase === 'starting' || phase === 'transcribing' ? (
            <Loader size={16} />
          ) : phase === 'recording' ? (
            <IconPlayerStop size={iconSize} />
          ) : (
            <IconMicrophone size={iconSize} />
          )}
        </ActionIcon>
      </AppTooltip>
      {onSend && (
        <AppTooltip label={t('Send message')}>
          <ActionIcon
            variant="filled"
            color="chatbox-brand"
            aria-label={t('Send message') || 'Send message'}
            disabled={sendDisabled || phase !== 'idle'}
            onClick={onSend}
          >
            <IconArrowUp size={iconSize} />
          </ActionIcon>
        </AppTooltip>
      )}
      {phase === 'recording' && <MicrophoneWaveform stream={stream.current} />}
      {phase !== 'idle' && (
        <Text
          role="status"
          aria-live={phase === 'recording' ? 'off' : 'polite'}
          fz="xs"
          c={phase === 'recording' ? 'red' : 'chatbox-secondary'}
          className="whitespace-nowrap"
        >
          {phase === 'recording'
            ? `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}`
            : phase === 'starting'
              ? t('Requesting microphone…')
              : t('Transcribing locally…')}
        </Text>
      )}
    </Group>
  )
}
