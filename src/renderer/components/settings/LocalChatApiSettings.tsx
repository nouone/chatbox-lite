import { Alert, Button, Group, NumberInput, Stack, Text, TextInput } from '@mantine/core'
import { QRCodeSVG } from '@rc-component/qrcode'
import { LOCAL_API_CHANNELS, type LocalApiStatus, type LocalApiPairingSet } from '@shared/local-chat-api'
import { useEffect, useState } from 'react'
import platform from '@/platform'
import { SettingsSection, SettingSwitchRow } from './SettingsLayout'

export function LocalChatApiSettings() {
  const [state, setState] = useState<LocalApiStatus>()
  const [port, setPort] = useState<number | string>(8085)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [publicOrigin, setPublicOrigin] = useState('')
  const [lanAddress, setLanAddress] = useState('')
  const [pairEpoch, setPairEpoch] = useState(0)
  const [pairing, setPairing] = useState<LocalApiPairingSet>()
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
          setPublicOrigin(result.publicOrigin ?? '')
          setLanAddress(result.lanAddress ?? '')
        }
      })
      .catch(() => {
        if (mounted) setError('Could not read local API settings.')
      })
    return () => {
      mounted = false
    }
  }, [available])
  useEffect(() => {
    if (!available || !state?.running || !state.hasToken || (!state.publicOrigin && !state.lanAddress)) {
      setPairing(undefined)
      return
    }
    let mounted = true
    window.electronAPI
      .invoke(LOCAL_API_CHANNELS.pairPhone)
      .then((result: LocalApiPairingSet) => {
        if (mounted) setPairing(result)
      })
      .catch(() => {
        if (mounted) setError('Could not create pairing codes.')
      })
    return () => {
      mounted = false
    }
  }, [available, state?.running, state?.hasToken, state?.port, state?.publicOrigin, state?.lanAddress, pairEpoch])
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
        publicOrigin,
        lanAddress,
      })
      setState(result)
      setPairing(undefined)
      setPairEpoch((value) => value + 1)
    })
  return (
    <SettingsSection
      title="Local chat API"
      description="Continue your desktop chats in a browser. Wao must remain open. The listener stays on this computer; optional Tailscale Serve access uses HTTPS and browser pairing."
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
        <TextInput
          label="Tailscale HTTPS address (optional)"
          placeholder="https://your-pc.your-tailnet.ts.net:8443"
          description="Paste the private address printed by Tailscale Serve. Leave empty for access on this computer only."
          value={publicOrigin}
          onChange={(event) => setPublicOrigin(event.currentTarget.value)}
          disabled={busy || !state}
        />
        <TextInput
          label="Static LAN IP (optional)"
          placeholder="192.168.1.100"
          value={lanAddress}
          description="To enable local-network access, enter an IPv4 address assigned to this PC and click Apply address. Leave empty to keep LAN access off."
          onChange={(event) => setLanAddress(event.currentTarget.value)}
          disabled={busy || !state}
        />
        <Group>
          <Button
            variant="default"
            disabled={busy || !state}
            onClick={() => {
              void configure(state?.enabled ?? false)
            }}
          >
            Apply address
          </Button>
          <Button
            variant="light"
            disabled={busy || !state?.running || (!state?.publicOrigin && !state?.lanAddress)}
            onClick={() => {
              void run(async () => {
                setPairing(await window.electronAPI.invoke(LOCAL_API_CHANNELS.pairPhone))
              })
            }}
          >
            Refresh phone QR codes
          </Button>
        </Group>
        {state?.publicOrigin && (
          <Text size="sm">
            Tailscale:{' '}
            <a href={state.publicOrigin} target="_blank" rel="noreferrer">
              {state.publicOrigin}
            </a>
          </Text>
        )}
        {state?.lanAddress && (
          <Text size="sm">
            Local network:{' '}
            <a
              href={`http://${state.lanAddress}:${state.port}`}
              target="_blank"
              rel="noreferrer"
            >{`http://${state.lanAddress}:${state.port}`}</a>
          </Text>
        )}
        {pairing && (
          <Group align="flex-start" gap="xl">
            {Object.entries(pairing).map(
              ([kind, pair]) =>
                pair && (
                  <Stack key={kind} gap="xs" align="flex-start" maw={260}>
                    <Text fw={600}>{kind === 'lan' ? 'Local network' : 'Tailscale — home or away'}</Text>
                    <QRCodeSVG
                      aria-label={`${kind} pairing QR code`}
                      value={pair.url}
                      size={200}
                      marginSize={4}
                      bgColor="#ffffff"
                      fgColor="#202020"
                    />
                    <Text size="sm">
                      One use, expires in five minutes.{' '}
                      {kind === 'lan' ? 'Use on the same local network.' : 'Connect Tailscale on the phone first.'}
                    </Text>
                    <Button
                      variant="subtle"
                      onClick={() => {
                        void navigator.clipboard.writeText(pair.url)
                      }}
                    >
                      Copy pairing link
                    </Button>
                  </Stack>
                )
            )}
          </Group>
        )}
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
                setPairing(undefined)
                setPairEpoch((value) => value + 1)
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
          launch. Treat the clipboard token as a password. Generate new token also signs out paired browsers and phones.
        </Text>
      </Stack>
    </SettingsSection>
  )
}
