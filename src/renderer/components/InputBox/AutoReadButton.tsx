import { ActionIcon } from '@mantine/core'
import { IconVolume, IconVolumeOff } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { AppTooltip } from '@/components/ui/tooltip'
import { responseSpeechPlayer } from '@/packages/text-to-speech'
import { useSettingsStore } from '@/stores/settingsStore'

export default function AutoReadButton({ iconSize }: { iconSize: number }) {
  const { t } = useTranslation()
  const speech = useSettingsStore((state) => state.textToSpeech)
  const setSettings = useSettingsStore((state) => state.setSettings)
  if (!speech?.enabled) return null
  const enabled = speech.autoRead ?? false
  const label = enabled ? t('Auto-read replies: On') : t('Auto-read replies: Off')
  const Icon = enabled ? IconVolume : IconVolumeOff
  return (
    <AppTooltip label={label}>
      <ActionIcon
        variant="subtle"
        color={enabled ? 'chatbox-brand' : 'chatbox-secondary'}
        aria-label={label}
        aria-pressed={enabled}
        onClick={() => {
          if (enabled) responseSpeechPlayer.stop()
          setSettings({ textToSpeech: { ...speech, autoRead: !enabled } })
        }}
      >
        <Icon size={iconSize} />
      </ActionIcon>
    </AppTooltip>
  )
}
