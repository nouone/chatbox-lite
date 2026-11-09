import { ActionIcon, Loader } from '@mantine/core'
import type { Message } from '@shared/types'
import { IconPlayerStop, IconVolume } from '@tabler/icons-react'
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { AppTooltip } from '@/components/ui/tooltip'
import {
  isSpeechInputActive,
  responseSpeechPlayer as player,
  responseSpeechText,
  synthesizeSpeech,
} from '@/packages/text-to-speech'
import platform from '@/platform'
import { useSettingsStore } from '@/stores/settingsStore'
import * as toast from '@/stores/toastActions'
import { desktopDirectRequestFromWindow } from '@/utils/desktop-direct-request'

/** Manual playback state only; automatic speech is driven by generation completion. */
export function useReplySpeech(message: Message, playbackId: string) {
  const { t } = useTranslation()
  const settings = useSettingsStore((state) => state.textToSpeech)
  const state = useSyncExternalStore(player.subscribe, player.getSnapshot)
  const active = state.id === playbackId
  const text = responseSpeechText(message)
  useEffect(() => {
    if (!settings?.enabled && player.getSnapshot().id === playbackId) player.stop()
  }, [settings?.enabled, playbackId])
  const startReading = useCallback(() => {
    if (!settings?.enabled || !text || isSpeechInputActive()) return
    const request: typeof fetch =
      platform.type === 'desktop'
        ? (url, init) =>
            desktopDirectRequestFromWindow(
              String(url),
              'POST',
              new Headers(init?.headers),
              init?.body,
              init?.signal ?? undefined
            )
        : fetch
    void player.play(
      playbackId,
      // Manual Read aloud is non-mic: the listener can see the reply, so it is
      // spoken as written (normalization only). The model rewrite belongs to
      // voice mode (local-chat-speech synthesizeSpeechText).
      async (signal) => synthesizeSpeech(text, settings, request, signal),
      (error) => {
        toast.add(`${t('Read aloud')}: ${error.message}`)
      }
    )
  }, [settings, text, playbackId, t])
  return { active, loading: state.loading, enabled: settings?.enabled, text, startReading }
}

export default function ReadAloudButton({ message, playbackId }: { message: Message; playbackId: string }) {
  const { t } = useTranslation()
  const { active, loading, enabled, text, startReading } = useReplySpeech(message, playbackId)
  if (!enabled || !text || message.generating) return null
  const label = active ? t('Stop reading') : t('Read aloud')
  const onClick = () => {
    if (active) player.stop()
    else startReading()
  }
  return (
    <AppTooltip label={label}>
      <ActionIcon variant="subtle" color="chatbox-secondary" aria-label={label} onClick={onClick}>
        {active && loading ? <Loader size={16} /> : active ? <IconPlayerStop size={18} /> : <IconVolume size={18} />}
      </ActionIcon>
    </AppTooltip>
  )
}
