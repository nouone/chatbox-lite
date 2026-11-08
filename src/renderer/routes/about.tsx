import { Anchor, Container, Divider, Flex, Image, Stack, Text, Title } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import Page from '@/components/layout/Page'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import useVersion from '@/hooks/useVersion'
import { BUILD_INFO } from '../buildInfo'
import iconPNG from '@/static/icon.png'

export const Route = createFileRoute('/about')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const version = useVersion()
  const isSmallScreen = useIsSmallScreen()

  return (
    <Page title={t('About')}>
      <Container size="md" p={0}>
        <Stack gap="xxl" px={isSmallScreen ? 'sm' : 'md'} py={isSmallScreen ? 'xl' : 'md'}>
          <Flex gap="xxl" p="md" className="rounded-lg bg-chatbox-background-secondary">
            <Image h={100} w={100} mah={'20vw'} maw={'20vw'} src={iconPNG} />
            <Stack flex={1} gap="xxs">
              <Flex justify="space-between" align="center" wrap="wrap" gap={isSmallScreen ? 'xs' : 'sm'} rowGap="xs">
                <Title order={5} lh={1.5} lineClamp={1} title={`Wao v${version.version}`}>
                  Wao {/\d/.test(version.version) ? `(v${version.version})` : ''}
                </Title>

                <Text size="sm">Manual Wao updates only</Text>
              </Flex>
              <Text>Custom AI endpoints, local voice, and a streamlined interface.</Text>
              <Text c="chatbox-tertiary">
                Independent community edition based on Chatbox. Wao build #{BUILD_INFO.n} ({BUILD_INFO.at}, {BUILD_INFO.hash}).
              </Text>
            </Stack>
          </Flex>

          <Stack gap="sm">
            <Title order={3}>Included in Wao</Title>
            <Text>Local Whisper microphone transcription, a recording meter, and a nearby Send button.</Text>
            <Text>
              Kokoro read-aloud with automatic reply reading, voice selection, adjustable speed, and speech-friendly
              text.
            </Text>
            <Text>
              Custom OpenAI-compatible endpoints, optional Strata thinking controls, provider-reported token speed, and
              Tavily web search support.
            </Text>
            <Text>Independent sidebar text size, theme-aware icons, and improved reply scrolling.</Text>
            <Text>Sentry, Google Analytics, and Plausible reporting removed. Account and upgrade screens removed.</Text>
            <Divider />
            <Text>
              Optional authenticated localhost API and browser chat use the same desktop conversation pipeline. Bundled
              skills and MCP presets are removed; custom skills and servers remain.
            </Text>
            <Title order={3}>Help and setup</Title>
            <Text>
              Microphone: run scripts/setup-local-speech.ps1 from the source folder to install whisper.cpp and its
              English model. Click the microphone to record, then Stop to transcribe into your draft. Review it and
              press Send.
            </Text>
            <Text>
              Read-aloud: start your Kokoro OpenAI-compatible speech server (default http://localhost:8880). Choose a
              voice and speed under Settings / Default Models. Enable Auto-read replies beside the input to read
              completed replies automatically.
            </Text>
            <Text>
              Appearance includes independent sidebar text size and theme controls. Vendor account, login, welcome and
              upgrade screens are removed permanently; there is no restore switch.
            </Text>
            <Text>
              See README.md and LOCAL-CUSTOM-BUILD.md in the source for installation, testing, and Windows packaging.
              Only configured providers, speech/search services and content you choose to open need network access.
              Vendor update checks and remote configuration are removed.
            </Text>
            <Divider />
            <Text>
              Wao is an independent derivative of Chatbox by its upstream contributors, distributed under
              GPLv3.
            </Text>
            <Anchor href="https://github.com/chatboxai/chatbox" target="_blank">
              Upstream Chatbox source and contributors
            </Anchor>
            <Anchor href="https://github.com/chatboxai/chatbox/blob/main/LICENSE" target="_blank">
              GNU GPLv3 license
            </Anchor>
          </Stack>
        </Stack>
      </Container>
    </Page>
  )
}
