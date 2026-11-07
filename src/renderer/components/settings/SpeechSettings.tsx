import { Button, Loader, NumberInput, PasswordInput, Stack, TextInput, Text } from '@mantine/core'
import { createMessage } from '@shared/types'
import { IconPlayerStop, IconVolume } from '@tabler/icons-react'
import { useEffect, useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { SettingSwitchRow, SettingsSection } from './SettingsLayout'
import { DEFAULT_TTS_BASE_URL, responseSpeechPlayer } from '@/packages/text-to-speech'
import { useReplySpeech } from '@/components/chat/ReadAloudButton'
import { useSettingsStore } from '@/stores/settingsStore'
export function SpeechSettings() {
  const readAloudId = useId()
  const rewriteId = useId()
  const { t } = useTranslation()
  const { setSettings, ...settings } = useSettingsStore((state) => state)
  const playbackId = `voice-test-${readAloudId}`
  const sample = useMemo(
    () => createMessage('assistant', 'Hello. This is your selected voice and speaking speed in Chatbox Lite.'),
    []
  )
  const { active, loading, startReading } = useReplySpeech(sample, playbackId)
  useEffect(
    () => () => {
      if (responseSpeechPlayer.getSnapshot().id === playbackId) responseSpeechPlayer.stop()
    },
    [playbackId]
  )
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
            <SettingSwitchRow
              id={rewriteId}
              label={t('Rewrite with the chat model first')}
              description={t(
                'Before speaking, ask the chat model to rewrite the reply for listening: numbers, units and abbreviations in words, lists narrated as sentences. No thinking; on failure the reply is read as written.'
              )}
              checked={settings.textToSpeech.rewrite !== false}
              onChange={(rewrite) => setSettings({ textToSpeech: { ...settings.textToSpeech, rewrite } })}
            />
            <Button
              variant="light"
              style={{ alignSelf: 'flex-start' }}
              leftSection={
                active && loading ? (
                  <Loader size={16} />
                ) : active ? (
                  <IconPlayerStop size={16} />
                ) : (
                  <IconVolume size={16} />
                )
              }
              onClick={() => (active ? responseSpeechPlayer.stop() : startReading())}
            >
              {active ? t('Stop test') : t('Test voice')}
            </Button>
          </Stack>
        )}
      </SettingsSection>
    </>
  )
}
