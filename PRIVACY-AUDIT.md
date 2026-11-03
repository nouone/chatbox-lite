# Chatbox Lite: found and removed

Finished November 3 follow-up: knowledge-base creation/editing no longer offers a hosted mode or requests its model configuration. Parser selectors use Local or an explicitly configured service. Optional LAN access binds only an entered private IP; Tailscale Serve uses an exact saved HTTPS origin. Phone QR codes are short-lived pairing codes, not the desktop API token; browser sessions use signed HttpOnly cookies and are revoked by token rotation. Neither network mode starts automatically. These access features are user-authorized connectivity, not reporting. Live phone/routing/firewall operation still requires user-device testing.

November 3 parser follow-up: removed the compute-credit retry dialog, the forced hosted-parser override in the knowledge-base queue and account/upgrade links in file-error guidance. Retries respect the configured knowledge-base parser; legacy hosted-parser values are coerced to Local by the main-process parser router. User-configured MinerU remains opt-in. The separate embedding-model tester now calls the embedding endpoint through the existing adapter, without chat or capability probes.

Audit of the inherited Chatbox source and this Lite branch, November 2, 2026. These are code findings, not claims about motives or historical traffic from a user's machine.

## Removed behavior and source locations

| Behavior found | Lite implementation |
| --- | --- |
| Sentry reports and Google Analytics/Plausible initialization | No-op reporting adapters and setup modules in `src/main/adapters/sentry.ts`, `src/main/analystic-node.ts`, `src/renderer/setup/{sentry,ga,plausible}_init.ts` and `src/renderer/utils/track.ts`. The SDK used for local error boundaries may remain installed; it is not initialized for reporting. |
| Update POST containing UUID, OS and tracking preference | `checkNeedUpdate` in `src/renderer/packages/remote.ts` returns false locally; `src/renderer/hooks/useVersion.ts` reads the installed version without requests or polling. |
| Startup/hourly desktop updater with fallback vendor feed domains | `src/main/app-updater.ts` contains only inert compatibility IPC handlers. It imports no updater client and does not install upstream updates. |
| Remote configuration, promotional dialogs, and notification-history requests | Local defaults/no-content results in `remote.ts`; notification/dialog components removed from the root layout. |
| Free-trial marketing in custom-provider errors and purchase/upgrade quota cards | Trial blocks removed from `GenericMessageError.tsx`; `QuotaExhaustedError.tsx` shows a plain provider-limit error. |
| Automatic license validation and hosted model catalog requests | `useAutoValidate` performs no network request or entitlement grant; the hosted model query is disabled and exposes no saved models. Hosted Chatbox provider entries are filtered out of provider setup and selection. |
| Account/login/upgrade welcome cards and restoration setting | Removed from settings, chat/image layouts, and provider lists. Old account routes redirect to provider configuration. The vendor guide route redirects to Lite help. No environment flag or settings switch restores these screens. Compatibility welcome/quota/download components render nothing. |
| Built-in skill backend manifest sync | `syncBuiltinSkills` in `src/main/skills/builtin-sync.ts` returns without seeding or discovering bundled assets. Old builtin-skills snapshots are ignored; custom skills remain. |
| Background public model catalog refresh | `src/renderer/packages/model-registry/fetch.ts` reads the bundled snapshot/local cache, including for unknown models and refresh calls. Configured-provider model discovery is separate and remains available. |
| Vendor-hosted artifact iframe receiving generated HTML by postMessage | `src/renderer/components/Artifact.tsx` uses a sandboxed local `srcDoc` iframe instead. Explicit preview URLs remain explicit user content. |
| Web CORS relay through the vendor | `src/renderer/utils/request.ts` connects to the provider directly; the desktop direct transport is retained. Web providers must support CORS. |
| Exported HTML loading vendor icons and third-party styling scripts | `src/renderer/lib/format-chat.tsx` uses inline styling and plain attribution. External content inside messages is not rewritten away. |
| Obfuscated vendor-origin redirect code; app-vendor HTTP-Referer headers | Redirect implementation removed from `setup/protect.ts`; attribution headers removed from provider implementations. |
| Vendor/social marketing and update controls in About | Lite features and local help replace them. Upstream source and GPL credits remain. |
| Enabled-looking error-reporting switch and saved consent | Advanced settings explicitly say reporting was removed. Settings parsing forces reporting and auto-update consent off, including old saved true values. Export Logs writes a local file. |

## Additional request protection

`src/shared/network-privacy.ts` rejects known vendor/telemetry destinations before fetch. It is installed at the main and renderer entry points, and enforced in the shared request helper and desktop transport. `src/main/network-privacy.ts` blocks matching Chromium requests, including frames, assets and redirected Chromium requests, in the default and subsequently created Electron sessions.

The list covers Chatbox API/site domains and subdomains, the inherited Midway/Sentry destination, Sentry, Plausible, Google Analytics/Tag Manager, and the legacy license-payment service. Matching uses parsed hostnames, not URL text or country. Provider credentials and requests are not rerouted through a replacement service.

This is not an OS firewall or a promise that arbitrary plugins, subprocesses, provider redirects, remote images, links or executable artifact content cannot contact the network. Only use servers and tools you intend to trust. Setup downloads and package installation also need network access. This audit does not claim packet-capture verification.

## Verification

Automated regression tests cover blocked vendor URLs (including subdomains, URL/Request inputs, case and trailing dots), allowed custom endpoints/local speech/Tavily, transport calls rejected before identifiers are sent, Chromium session cancellation, inert update/install handlers, remote notification/config stubs, local catalog behavior, saved consent normalization, local artifact rendering, vendor-free export wrappers and suppression of saved hosted models. Existing voice, reasoning, scrolling, token-speed and provider-transport suites are also run for the release.

Manual test after installing/restarting the updated Lite build:

1. Open Advanced: verify **Error reporting removed**, no reporting toggle, and local Export Logs.
2. Check About and settings: no vendor/social promotional links, Account group, restore switch, or upstream update control. Old account routes should lead to provider setup.
3. In Developer Tools Network, enable Preserve log and inspect startup, idle, two chat replies and an HTML preview. None should request a vendor API, telemetry endpoint, notification feed or remote artifact host. Main-process traffic needs OS/network tooling to inspect separately; DevTools alone is not a complete traffic audit.
4. Test your configured endpoint, microphone transcription, Kokoro manual/automatic reading, and Tavily. These should retain their intended connections.
5. Update Lite manually from its source or a Lite installer. Building alone does not replace an installed app.

## Optional local web access (November 3)

The new API is disabled unless CBL_API_ENABLED=1. It binds 127.0.0.1, requires a private bearer token, rejects unrelated browser origins/Host headers, and relays requests into the same renderer controller used by Desktop Send. The browser page contains no external scripts. It adds no vendor service and creates no separate AI client. Remote/custom provider requests and normal desktop tool approvals remain part of the existing pipeline. See LOCAL-CHAT-API.md for limits and test status. Live network connections were denied with EACCES in this development environment; real Strata/browser acceptance remains a user-run check.
