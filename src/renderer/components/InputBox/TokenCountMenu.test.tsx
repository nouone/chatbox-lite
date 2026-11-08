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
      <TokenCountMenu contextTokens={1000} totalTokens={1100} {...props}>
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

  it('shows only the benchmarking-relevant rows', () => {
    // Field: "what is context messages? and input? why does that even
    // matter?" then "useless for this, strip them". The menu is Total
    // (+footnote) and Model limit; the removed estimate/counter rows must
    // not come back.
    renderMenu({ contextWindow: 262144, onCompressClick: vi.fn() })
    expect(getMenuRow('Total')).toBeTruthy()
    expect(getMenuRow('Model limit').textContent).toContain('262K')
    expect(screen.queryByText('Context:')).toBeNull()
    expect(screen.queryByText('Current input:')).toBeNull()
    expect(screen.queryByText('Context messages:')).toBeNull()
  })

  it('labels a loading context and hides compression until it finishes', () => {
    renderMenu({ isCalculating: true, isContextLoading: true, onCompressClick: vi.fn() })
    expect(screen.getByRole('status', { hidden: true }).textContent).toContain('Loading context...')
    expect(screen.queryByText('Compress Conversation')).toBeNull()
  })

  it('marks an approximate total without showing a loader', () => {
    renderMenu({ isCalculating: false, isTotalApproximate: true })
    expect(getMenuRow('Total').textContent).toContain('Total:~1K')
    expect(getMenuRow('Total').querySelector('.mantine-Loader-root')).toBeNull()
  })
})
