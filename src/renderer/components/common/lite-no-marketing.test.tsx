// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { ChatboxWelcomeCard } from './ChatboxWelcomeCard'
import {
  MobileWebDownloadBanner,
  SidebarDesktopDownloadCard,
  useWebAppDownloadPromptVisible,
} from '../layout/DesktopDownloadReminder'
import { SidebarLowQuotaReminder } from '../layout/LowQuotaReminder'
import { BuiltinServersSection } from '../settings/mcp/BuiltinServersSection'

afterEach(cleanup)
it('never renders account, upgrade, quota or vendor download prompts, including legacy callers', () => {
  const view = render(
    <>
      <ChatboxWelcomeCard mode="login" pageName="chat" />
      <ChatboxWelcomeCard mode="no-license" pageName="chat" />
      <ChatboxWelcomeCard mode="expired-license" pageName="chat" />
      <SidebarLowQuotaReminder />
      <SidebarDesktopDownloadCard />
      <MobileWebDownloadBanner />
      <BuiltinServersSection />
    </>
  )
  expect(view.container.childElementCount).toBe(0)
  expect(useWebAppDownloadPromptVisible()).toBe(false)
})
