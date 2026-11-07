import { Flex, Loader, Menu, Switch, Text } from '@mantine/core'
import { TestId } from '@shared/automation/testids'
import { formatNumber } from '@shared/utils'
import { IconFileZip } from '@tabler/icons-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { AppTooltip as Tooltip } from '@/components/ui/tooltip'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { ScalableIcon } from '../common/ScalableIcon'

type Props = {
  contextTokens: number
  totalTokens: number
  isCalculating?: boolean
  isTotalApproximate?: boolean
  isContextLoading?: boolean
  contextWindow?: number
  /** The total is anchored to the engine's exact last-request measurement. */
  engineCalibrated?: boolean
  children?: React.ReactNode
  onCompressClick?: () => void
  // Auto-compaction props
  autoCompactionEnabled?: boolean
  isCompacting?: boolean
  contextWindowKnown?: boolean
  onAutoCompactionChange?: (enabled: boolean) => void
}

const TokenCountMenu: FC<Props> = ({
  contextTokens,
  totalTokens,
  isCalculating = false,
  isTotalApproximate = isCalculating,
  isContextLoading = false,
  contextWindow,
  engineCalibrated = false,
  children,
  onCompressClick,
  autoCompactionEnabled,
  isCompacting,
  contextWindowKnown = true,
  onAutoCompactionChange,
}) => {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()

  const autoCompactionToggle = onAutoCompactionChange !== undefined && (
    <Menu.Item closeMenuOnClick={false} style={{ cursor: 'default' }}>
      <Flex justify="space-between" align="center" gap="xs">
        <Flex align="center" gap="xs">
          <Text size="sm">{t('Auto Compaction')}</Text>
          <Text size="xs" c="dimmed">
            ({t('This session')})
          </Text>
        </Flex>
        {isCompacting ? (
          <Flex align="center" gap="xs">
            <Loader size="xs" />
            <Text size="xs" c="dimmed">
              {t('Compacting...')}
            </Text>
          </Flex>
        ) : (
          <Tooltip
            label={t('Context window unknown for this model')}
            disabled={contextWindowKnown}
            withArrow
            position="top"
          >
            {/* Unknown-window models now compact against a fallback window, so the
                toggle stays usable; the tooltip still surfaces that the window is unknown. */}
            <Switch
              size="xs"
              checked={autoCompactionEnabled}
              disabled={isCompacting}
              onChange={(e) => onAutoCompactionChange(e.currentTarget.checked)}
            />
          </Tooltip>
        )}
      </Flex>
    </Menu.Item>
  )

  return (
    <Menu
      trigger={isSmallScreen ? 'click' : 'hover'}
      openDelay={100}
      closeDelay={100}
      position="top"
      shadow="md"
      keepMounted
      transitionProps={{
        transition: 'pop',
        duration: 200,
      }}
    >
      <Menu.Target>{children}</Menu.Target>
      <Menu.Dropdown className="min-w-56">
        <Flex justify="space-between" align="center" px="xs" pt="xs" pb="4">
          <Text size="sm" fw={600}>
            {t('Estimated Token Usage')}
          </Text>
        </Flex>

        {isContextLoading && (
          <Text size="xs" c="dimmed" px="xs" pb="xs" role="status">
            {t('Loading context... Estimates include loaded messages only.')}
          </Text>
        )}

        {/* "Current input" (draft size) and "Context messages" (message
            count) rows were removed alongside the cl100k "Context" estimate
            (field: "useless for this, strip them" - benchmarking reads one
            number: the engine-measured Total vs the model limit). The
            compress action still keys off contextTokens internally. */}

        <Menu.Divider />

        <Menu.Item disabled style={{ cursor: 'default' }}>
          <Flex justify="space-between" align="center" gap="xs">
            <Text size="sm" fw={600}>
              {t('Total')}:
            </Text>
            <Flex align="center" gap="xs">
              {isCalculating && <Loader size="xs" />}
              <Text size="sm" fw={600}>
                {isTotalApproximate ? '~' : ''}
                {formatNumber(totalTokens)}
              </Text>
            </Flex>
          </Flex>
          {engineCalibrated && (
            <Text size="xs" c="dimmed" pt="2">
              {t('Measured by the engine, plus an estimate for the newest turns.')}
            </Text>
          )}
        </Menu.Item>

        {contextWindow && (
          <Menu.Item disabled style={{ cursor: 'default' }}>
            <Flex justify="space-between" align="center" gap="xs">
              <Text size="sm">{t('Model limit')}:</Text>
              <Text size="sm" fw={500}>
                {formatNumber(contextWindow)}
              </Text>
            </Flex>
          </Menu.Item>
        )}

        {autoCompactionToggle && (
          <>
            <Menu.Divider />
            {autoCompactionToggle}
          </>
        )}

        {!isContextLoading && onCompressClick && contextTokens > 0 && (
          <>
            <Menu.Divider />
            <Menu.Item
              data-testid={TestId.chat.compressConversation}
              leftSection={<ScalableIcon icon={IconFileZip} size={16} />}
              onClick={onCompressClick}
              color="chatbox-brand"
            >
              {t('Compress Conversation')}
            </Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  )
}

export default TokenCountMenu
