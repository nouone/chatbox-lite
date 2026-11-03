import { Alert, Button, Group, NumberInput, Stack, Text } from '@mantine/core'
import { LOCAL_API_CHANNELS, type LocalApiStatus } from '@shared/local-chat-api'
import { useEffect, useState } from 'react'
import platform from '@/platform'
import { SettingsSection, SettingSwitchRow } from './SettingsLayout'

export function LocalChatApiSettings() {
  const [state, setState] = useState<LocalApiStatus>()
  const [port, setPort] = useState<number | string>(8085)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const available = platform.type === 'desktop' && Boolean(window.electronAPI)
  useEffect(() => {
    if (!available) return
    let mounted = true
    window.electronAPI
      .invoke(LOCAL_API_CHANNELS.status)
      .then((result: LocalApiStatus) => {
        if (mounted) {
          setState(result)
          setPort(result.port)
        }
      })
      .catch(() => {
        if (mounted) setError('Could not read local API settings.')
      })
    return () => {
      mounted = false
    }
  }, [available])
  if (!available) return null
  const run = async (operation: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setError('')
    setCopied(false)
    try {
      await operation()
    } catch {
      setError('Could not change the local API settings. Check the application logs.')
    } finally {
      setBusy(false)
    }
  }
  const configure = (enabled: boolean) =>
    run(async () => {
      const result: LocalApiStatus = await window.electronAPI.invoke(LOCAL_API_CHANNELS.configure, {
        enabled,
        port: Number(port),
      })
      setState(result)
    })
  return (
    <SettingsSection
      title="Local chat API"
      description="Use your desktop chats in a browser or local client. CBL must remain open. Access is limited to this computer and requires a token."
    >
      <SettingSwitchRow
        id="local-chat-api"
        label="Enable local chat API"
        checked={state?.enabled ?? false}
        disabled={busy || !state}
        onChange={(enabled) => {
          void configure(enabled)
        }}
      />
      <Stack p="md" gap="sm">
        <Group align="end">
          <NumberInput
            label="API port"
            min={1}
            max={65535}
            allowDecimal={false}
            value={port}
            onChange={setPort}
            disabled={busy || !state}
          />
          <Button
            variant="default"
            disabled={busy || !state}
            onClick={() => {
              void configure(state?.enabled ?? false)
            }}
          >
            Apply port
          </Button>
        </Group>
        <Text size="sm">{state?.running ? `Running at ${state.url}` : 'Stopped'}</Text>
        {(error || state?.error) && (
          <Alert color="red" role="alert">
            {error || state?.error}
          </Alert>
        )}
        <Text size="sm">
          A token grants access to your chats and can send messages using your configured models. Generate a new token
          to revoke the old one and disconnect browser clients.
        </Text>
        <Group>
          <Button
            variant="default"
            disabled={busy || !state}
            onClick={() => {
              void run(async () => {
                setState(await window.electronAPI.invoke(LOCAL_API_CHANNELS.rotateToken))
              })
            }}
          >
            {state?.hasToken ? 'Generate new token' : 'Generate token'}
          </Button>
          <Button
            variant="default"
            disabled={busy || !state?.hasToken}
            onClick={() => {
              void run(async () => {
                await window.electronAPI.invoke(LOCAL_API_CHANNELS.copyToken)
                setCopied(true)
              })
            }}
          >
            {copied ? 'Copied' : 'Copy token'}
          </Button>
          <Button
            disabled={busy || !state?.running}
            onClick={() => {
              void run(async () => {
                await window.electronAPI.invoke(LOCAL_API_CHANNELS.openBrowser)
              })
            }}
          >
            Open browser
          </Button>
        </Group>
        <Text size="xs" c="dimmed">
          Settings and tokens are saved in this app's profile. Environment variables, if set, override saved settings at
          launch. Treat the clipboard token as a password.
        </Text>
      </Stack>
    </SettingsSection>
  )
}
