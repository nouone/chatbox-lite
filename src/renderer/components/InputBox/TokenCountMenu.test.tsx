// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TokenCountMenu from './TokenCountMenu'

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@/hooks/useScreenChange', () => ({
  useIsSmallScreen: () => false,
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn(
    (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })
  ),
})

function renderMenu(props: Partial<React.ComponentProps<typeof TokenCountMenu>> = {}) {
  return render(
    <MantineProvider>
      <TokenCountMenu
        currentInputTokens={100}
        contextTokens={1000}
        totalTokens={1100}
        totalContextMessages={3}
        {...props}
      >
        <button type="button">Tokens</button>
      </TokenCountMenu>
    </MantineProvider>
  )
}

function getMenuRow(label: string): HTMLElement {
  const labelElement = screen.getByText(`${label}:`)
  const row = labelElement.parentElement
  if (!row) throw new Error(`Missing ${label} row`)
  return row
}

describe('TokenCountMenu', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows engine-anchored totals and the measurement footnote', () => {
    renderMenu({ engineCalibrated: true })
    expect(getMenuRow('Total').textContent).toContain('Total:1K')
    expect(screen.getByText('Measured by the engine, plus an estimate for the newest turns.')).toBeTruthy()
  })

  it('hides the measurement footnote for raw estimates', () => {
    renderMenu()
    expect(screen.queryByText('Measured by the engine, plus an estimate for the newest turns.')).toBeNull()
  })

  it('never shows the removed cl100k Context estimate row', () => {
    // The Context row was deleted (field: "Context ~548K" beside
    // "Total ~434K measured" confused benchmarking; the estimate is a second,
    // worse ruler and Total already falls back to it).
    renderMenu({ isCalculating: true, isContextCalculating: true, pendingContextMessages: 1 })
    expect(screen.queryByText('Context:')).toBeNull()
    expect(getMenuRow('Total').querySelector('.mantine-Loader-root')).not.toBeNull()
  })

  it('labels a loading context and hides message counts and compression', () => {
    renderMenu({
      isCalculating: true,
      isContextCalculating: true,
      isContextLoading: true,
      pendingContextMessages: 1,
      currentMessageCount: 3,
      maxContextMessageCount: 100,
      onCompressClick: vi.fn(),
    })
    expect(screen.getByRole('status', { hidden: true }).textContent).toContain('Loading context...')
    expect(screen.queryByText('Context messages:')).toBeNull()
    expect(screen.queryByText('Compress Conversation')).toBeNull()
  })

  it('keeps failed draft estimates marked approximate without showing a loader', () => {
    renderMenu({
      isCalculating: false,
      isCurrentInputApproximate: true,
      isTotalApproximate: true,
      isContextCalculating: false,
      pendingContextMessages: 0,
    })
    expect(getMenuRow('Current input').textContent).toContain('Current input:~100')
    expect(getMenuRow('Total').textContent).toContain('Total:~1K')
    expect(getMenuRow('Total').querySelector('.mantine-Loader-root')).toBeNull()
  })
})
