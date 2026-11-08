import type { Session } from 'electron'
import { isBlockedVendorUrl } from '../shared/network-privacy'

/** Covers Chromium fetch, XHR, assets, frames and WebSockets, including redirects. */
export function installSessionPrivacy(session: Session): void {
  session.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: isBlockedVendorUrl(details.url) })
  })
}
