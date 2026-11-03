# Chatbox Lite

An independent, streamlined derivative of [Chatbox](https://github.com/chatboxai/chatbox), focused on custom AI endpoints and local voice. Distributed under GPLv3; upstream authors and license are retained.

## What this version adds

- **Custom AI endpoints:** OpenAI-compatible provider support, optional Strata Off/Low/Medium/High thinking controls, and provider-reported generation speed when supplied by the server.
- **Local Whisper microphone input:** whisper.cpp transcription, recording level animation, Stop-to-transcribe, and a nearby Send arrow. Transcription becomes an editable draft.
- **Kokoro audio playback:** read responses aloud, automatically read completed replies, select a voice, and adjust speed. Speech normalization expands common dates, units, abbreviations, compass directions, and Bible references while omitting URLs and code. Voice quality depends on the speech server and model; there is no separate client HQ switch.
- **Tavily search:** retains Chatbox's Tavily configuration and web search support. No additional search-loop limit is introduced.
- **Interface improvements:** independent sidebar font size, theme-aware chat icons, warm theme surfaces, the smiley application icon, nearby Send arrow, and streaming scroll-follow fixes.
- **No account or upgrade interface:** vendor welcome cards, account/login screens, upgrade/quota prompts, download banners, and the hosted Chatbox provider are removed. There is no restore toggle or environment switch. Custom providers remain available.
- **Analytics removed:** Sentry reporting, Google Analytics, and Plausible scripts/transports are removed. Vendor update checks, remote configuration, promotional notifications and hosted preview requests are also removed. See the audit below.
- **Local help:** the sidebar Help button opens About with Lite features and voice setup, rather than the original guide chatbot. Upstream credits and GPL links remain available.
- **Windows packaging fixes:** explicit package registry, local production dependency verification, and a separate Lite installer identity and Chatbox Lite Contributors publisher metadata, without private signing credentials. This metadata does not make an unsigned installer signed.

## Found and removed: privacy audit

The following behaviors were found in the inherited source and removed or disabled in Lite. This records observed code behavior; it does not infer anyone's motives.

| Found in inherited source | Removed or replaced in Lite |
| --- | --- |
| Sentry error reports, including a `sentry.midway.run` destination; Google Analytics and Plausible tracking | Reporting initialization, scripts and event transports disabled. The old enabled-looking Error Reporting switch is replaced by **Error reporting removed**. Old saved consent cannot re-enable reporting. |
| Renderer update POST to `/chatbox_need_update/<version>` containing a device UUID, OS and reporting preference | Request removed; installed version is read locally. |
| Desktop update feed checks at startup and hourly, trying multiple Chatbox API domains | No feed checks, automatic downloads or upstream installer execution. Lite updates manually from source or its own installer. |
| Startup `/api/remote_config/setting_chatboxai_first` requests | Local defaults replace vendor configuration. |
| `/api/dialog_config` and `/api/client_notifications/next` requests, including device/language/version or displayed-notification history | Remote promotional dialogs and notifications no longer mount or fetch. |
| Free-trial ads attached to custom-provider errors and vendor quota purchase cards | Removed. Errors explain the provider failure without upgrade or purchase actions. |
| Automatic saved-license validation | No background vendor license calls. Hosted account, subscription, cloud parsing and vendor model services remain unavailable; paid features are not unlocked. |
| Built-in skill manifest/detail synchronization from the vendor | Bundled local skills retained; remote sync disabled. |
| Automatic `models.dev` catalog downloads at startup or on unknown model IDs | Bundled snapshot and local cache only. Fetching models from your configured provider is preserved. |
| Generated artifact HTML posted to `artifact-preview.chatboxai.app` in an iframe | Sandboxed local `srcDoc` preview; no vendor frame receives the code. |
| Vendor CORS proxy for web provider requests | Direct provider requests. Browser builds need provider CORS support; Desktop keeps its direct transport. |
| Remote vendor icon assets and third-party styling scripts in exported HTML | Local inline styling and plain Lite attribution. Message content itself can still contain external links/images. |
| Account/login/upgrade welcomes, hosted provider selector, restore toggle, RedNote, WeChat, vendor marketing links and upstream update controls | Lite features, local help, manual-update information, and upstream GitHub/GPL credits. |
| Dormant obfuscated vendor-origin redirect code; vendor referrer attribution headers | Redirect code and app-vendor HTTP-Referer headers removed. |

A shared fetch guard and Electron session request guard additionally block the known vendor/telemetry domains and their subdomains. There is no setting to restore vendor contacts. This is application behavior and source/test verification, not an operating-system firewall or a packet-capture certification.

**Connections you choose are preserved:** custom AI endpoints, local Whisper, Kokoro, Tavily and other explicitly configured services. Configured MCP servers, remote images, links, and code you run can make their own network requests. Downloading dependencies and speech assets during setup also requires network access. Logs are retained locally; **Export Logs** saves a file instead of uploading it.

See [PRIVACY-AUDIT.md](PRIVACY-AUDIT.md) for source locations and verification steps.

## Windows setup and test

Use your actual checkout directory on any drive. Node must be **22.13 or newer, below 23**; pnpm must be **10.17 or newer**. With fnm in PowerShell:

```powershell
cd E:\Temp\chatbox-lite
fnm env --shell powershell | Out-String | Invoke-Expression
fnm install 22.21.1
fnm use 22.21.1
node --version
pnpm install --frozen-lockfile
pnpm run check
$env:DEV_PORT = '5173'
pnpm run dev
```

1. Configure your custom provider and send two consecutive replies. Confirm scrolling follows streamed text and pauses when you deliberately scroll upward.
2. With the `hf` command available, run `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-local-speech.ps1` from the checkout to install whisper.cpp and its English model. The script explains how to install the download tool if missing. Record with the microphone, stop, review the transcription, and send it.
3. Run your Kokoro/OpenAI-compatible speech service separately. The default URL is `http://localhost:8880`; configure the speech settings or set `AUDIO_TTS_OPENAI_API_BASE_URL` before launching. Test manual reading, voice and speed selection, then Auto-read replies.
4. Configure Tavily if you want web search, and test a search-enabled reply.
5. Change sidebar text size and theme. Confirm there is no Account navigation, restore toggle, hosted Chatbox provider, welcome login/upgrade card, or enabled-looking Error Reporting switch.
6. Open Help and About. Confirm Lite branding, Whisper/Kokoro instructions, and upstream license credits.

## Build a Windows installer

Close the development app, then run:

```powershell
pnpm run build
pnpm exec electron-builder --config electron-builder.lite.yml --win nsis --x64 --publish never
```

Keep the tracked `.npmrc` registry setting. Building does not update an already installed app: install the generated Lite installer from `release/build`. Export/import chats if the separate Lite profile is empty. See [build notes](LOCAL-CUSTOM-BUILD.md) for details. Source checks/builds do not verify microphone hardware, a running speech server, or installer behavior on your machine.

## Fork and upstream changes

Commit your changes, create your own GitHub repository, and add it as `origin`. Keep the original Chatbox repository as `upstream`. Before importing upstream changes, back up app data, create an update branch, merge and resolve conflicts, then repeat the tests above. Do not apply the old incremental patches over this consolidated version. No fork or release is published automatically.

## Credits and license

Based on upstream Chatbox commit `d17455c5ca8fd3ff44385c6d4d2118599e4c970f`. Thanks to the original Chatbox authors and contributors. This independent derivative is not an official Chatbox release. See [LICENSE](LICENSE) and the [upstream project](https://github.com/chatboxai/chatbox) for the original source, documentation, and contributors.
