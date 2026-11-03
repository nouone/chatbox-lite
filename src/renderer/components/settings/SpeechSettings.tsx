import { NumberInput, PasswordInput, Stack, TextInput, Text } from '@mantine/core'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { SettingSwitchRow, SettingsSection } from './SettingsLayout'
import { DEFAULT_TTS_BASE_URL } from '@/packages/text-to-speech'
import { useSettingsStore } from '@/stores/settingsStore'
export function SpeechSettings() {
  const readAloudId = useId()
  const { t } = useTranslation()
  const { setSettings, ...settings } = useSettingsStore((state) => state)
  return (
    <>
      <SettingsSection title="Microphone / Whisper" description="Transcribe speech locally into an editable draft.">
        <Text size="sm">
          Use the microphone beside the message input, then Stop to transcribe. Run scripts/setup-local-speech.ps1 once
          to install the local English model. No speech-recognition server or API key is needed.
        </Text>
      </SettingsSection>
      <SettingsSection
        title={t('Read aloud')}
        description={t('Read completed replies using Kokoro or an OpenAI-compatible speech server.')}
      >
        <SettingSwitchRow
          id={readAloudId}
          label={t('Enable read aloud')}
          checked={settings.textToSpeech?.enabled ?? false}
          onChange={(enabled) => setSettings({ textToSpeech: { ...settings.textToSpeech, enabled } })}
        />
        {settings.textToSpeech?.enabled && (
          <Stack p="md" gap="sm">
            <TextInput
              label={t('Speech server URL')}
              placeholder={DEFAULT_TTS_BASE_URL}
              value={settings.textToSpeech.apiBaseUrl ?? ''}
              onChange={(event) =>
                setSettings({ textToSpeech: { ...settings.textToSpeech, apiBaseUrl: event.currentTarget.value } })
              }
            />
            <TextInput
              label={t('Speech model')}
              placeholder="kokoro"
              value={settings.textToSpeech.model ?? ''}
              onChange={(event) =>
                setSettings({ textToSpeech: { ...settings.textToSpeech, model: event.currentTarget.value } })
              }
            />
            <TextInput
              label={t('Voice')}
              placeholder="af_heart"
              value={settings.textToSpeech.voice ?? ''}
              onChange={(event) =>
                setSettings({ textToSpeech: { ...settings.textToSpeech, voice: event.currentTarget.value } })
              }
            />
            <PasswordInput
              label={t('Speech API key (optional)')}
              value={settings.textToSpeech.apiKey ?? ''}
              onChange={(event) =>
                setSettings({ textToSpeech: { ...settings.textToSpeech, apiKey: event.currentTarget.value } })
              }
            />
            <NumberInput
              label={t('Speech speed')}
              description={t('1× is normal. Lower is slower; higher is faster.')}
              value={settings.textToSpeech.speed ?? 1}
              min={0.25}
              max={4}
              step={0.05}
              decimalScale={2}
              suffix="×"
              onChange={(value) =>
                setSettings({
                  textToSpeech: { ...settings.textToSpeech, speed: typeof value === 'number' ? value : undefined },
                })
              }
            />
          </Stack>
        )}
      </SettingsSection>
    </>
  )
}
