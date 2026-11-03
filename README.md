# Chatbox Lite

**Bring your own AI endpoint. Use local voice and documents. Continue desktop chats on your phone.**

**Need help? Click Help in the sidebar.** It opens a normal chat with the bundled setup guides attached, using your selected model. Ask about setup, dictation, documents, phone pairing or builds. Nothing is sent automatically. No keys, settings, logs or other chats are attached. The model cannot inspect your computer automatically. Create a new Help chat after updating to attach the latest guides.

Phone users can dictate with the iPhone keyboard and use **Read aloud** on completed replies. Audio plays on the phone using Desktop's configured speech service; web-originated replies do not trigger Desktop auto-read. See [phone voice setup](LOCAL-PHONE-ACCESS.md#iphone-dictation-and-playback).
## Windows downloads
[![Windows Lite installer](https://img.shields.io/github/v/release/nouone/chatbox-lite?label=latest%20release)](https://github.com/nouone/chatbox-lite/releases/latest)

**Download:** [Chatbox Lite for Windows x64](https://github.com/nouone/chatbox-lite/releases/latest) ·
[Direct installer link](https://github.com/nouone/chatbox-lite/releases/latest/download/Chatbox-Lite-0.1.5-Setup.exe)

No spyware, no ads, just clean chat. Local LLMs first (Strada, Ollama, llama.cpp), local Whisper dictation included, phone/desktop chat sync over LAN or Tailscale.

[Published installers](https://github.com/nouone/chatbox-lite/releases) · [Windows test builds](https://github.com/nouone/chatbox-lite/actions/workflows/windows-lite.yml)

For a test build, open a successful Windows Lite installer run and download **Chatbox-Lite-Windows-x64** under Artifacts. Extract it and run its Setup EXE. Published Releases offer direct installer downloads without using Actions.

## Install on Windows

1. Open **Releases** in this fork's GitHub page and download `Chatbox-Lite-<version>-Setup.exe` from the latest published release. Do not choose GitHub's source ZIP unless you intend to build.
2. Run the installer, open Chatbox Lite, and add your endpoint and Chat model under **Settings → Model Providers**.
3. Select that model and start chatting. Click **Help** for the bundled setup guides.

The installer includes local English Whisper dictation. You do not need Node, Python or a compiler to use it. Kokoro read aloud and document embeddings are optional separate services; follow the guides below if you want them. Installers from this workflow are unsigned; SHA256SUMS.txt accompanies each build.

## For contributors: source setup

- **Source bundle:** extract it and follow `START-HERE.md`. A Git bundle is not an installer.
- **Installed app:** configure your own provider and Chat model under Settings → Model Providers, then select it in the conversation.
- **Windows source build:** open PowerShell in the restored folder containing `package.json`. Use Node 22 (`>=22.13`, below 23), then follow [build and test instructions](LOCAL-CUSTOM-BUILD.md). Building source does not update an installed app.

## Setup guides

| What you want | Where to start |
| --- | --- |
| Kokoro read aloud and document embeddings | [Local services and Docker](LOCAL-SERVICES.md) |
| Whisper dictation and Windows packaging | [Build and installation](LOCAL-CUSTOM-BUILD.md) |
| Phone chat over LAN or Tailscale | [Phone pairing](LOCAL-PHONE-ACCESS.md) |
| HTTP/WebSocket access using the desktop engine | [Local API](LOCAL-CHAT-API.md) |
| Removed reporting and vendor connections | [Privacy audit](PRIVACY-AUDIT.md) |

For phone setup, apply LAN/Tailscale addresses using **Apply address below both fields**, scan the corresponding QR and approve pairing on Desktop. Desktop must stay open. Remembered pairing avoids retyping a token; ordinary connection loss retries automatically. If pairing expires, scan a fresh QR. Generating a new API token signs out paired devices.

Before publishing, test an existing chat and a new chat, voice playback, dictation, document retrieval, and a phone message saved back to Desktop. Keep upstream GPL credits and the license. The included Windows Lite installer workflow builds an EXE on demand or for `lite-v*` tags. Tagged builds create a draft GitHub Release for testing before publication. See [release instructions](WINDOWS-RELEASE.md).

An independent, streamlined derivative of [Chatbox](https://github.com/chatboxai/chatbox), focused on custom AI endpoints and local voice. Distributed under GPLv3; upstream authors and license are retained.

## What this version adds

- **Custom AI endpoints:** OpenAI-compatible provider support, optional Strata Off/Low/Medium/High thinking controls, and provider-reported generation speed when supplied by the server.
- **Local Whisper microphone input:** whisper.cpp transcription, recording level animation, Stop-to-transcribe, and a nearby Send arrow. Transcription becomes an editable draft.
- **Kokoro audio playback:** read responses aloud, automatically read completed replies, select a voice, and adjust speed. Defaults are `http://localhost:8880`, model `kokoro`, voice `af_heart`, speed `1.1`; auto-read remains opt-in. Controls now live in **Settings > Default Models**, alongside local Whisper instructions. Speech normalization expands common dates, units, abbreviations, compass directions, and Bible references while omitting URLs and code. Voice quality depends on the speech server and model; there is no separate client HQ switch.
- **Tavily search:** retains Chatbox's Tavily configuration and web search support. No additional search-loop limit is introduced.
- **Interface improvements:** independent sidebar font size, theme-aware chat icons, warm theme surfaces, the smiley application icon, nearby Send arrow, and streaming scroll-follow fixes.
- **No account or upgrade interface:** vendor welcome cards, account/login screens, upgrade/quota prompts, download banners, and the hosted Chatbox provider are removed. There is no restore toggle or environment switch. Custom providers remain available.
- **Analytics removed:** Sentry reporting, Google Analytics, and Plausible scripts/transports are removed. Vendor update checks, remote configuration, promotional notifications and hosted preview requests are also removed. See the audit below.
- **Help chat:** the sidebar Help button opens a normal persisted conversation with the bundled README and setup guide included as context, using your configured chat model. It sends no question automatically and attaches no keys, settings, logs or other chats. About retains Lite features and upstream GPL credits.
- **No bundled skills or MCP presets:** bundled skill seeding/discovery and vendor MCP presets are removed. Old bundled skill snapshots are ignored. Your own skills and custom MCP server configuration remain available.
- **Local web/API access:** opt-in localhost port 8085, authenticated HTTP, WebSocket snapshots and a standalone browser chat page. Submissions use the desktop Send controller and existing saved conversations. See [LOCAL-CHAT-API.md](LOCAL-CHAT-API.md) for enablement and the PowerShell live proof.
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
| Built-in skill manifest/detail synchronization from the vendor | No bundled skills are seeded or discovered; custom skills remain. |
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
3. Run your Kokoro/OpenAI-compatible speech service separately. For a one-command Docker setup for Kokoro and document embeddings, follow [Local services](LOCAL-SERVICES.md). The default speech URL is `http://localhost:8880`; configure it in Default Models or set `AUDIO_TTS_OPENAI_API_BASE_URL` before launching. Test manual reading, voice and speed selection, then Auto-read replies.
4. Configure Tavily if you want web search, and test a search-enabled reply.
5. Change sidebar text size and theme. Confirm there is no Account navigation, restore toggle, hosted Chatbox provider, welcome login/upgrade card, or enabled-looking Error Reporting switch.
6. Open Help: a new chat should contain the local docs as context and keep your selected model. Ask a question; normal provider charges/availability apply. About remains local and retains source/license credits.
7. In Model Providers confirm Grok (xAI), then LM Studio, appear first and Xiaomi/MiMo is absent. Image Creator uses an image-capable model at a configured endpoint; set a custom model type to Image, then choose it under Default Models / Image creation. It does not run an image engine inside Lite.
8. Enable the Local chat API under Settings → Advanced. Generate/copy its token and open the browser there. Follow [LOCAL-CHAT-API.md](LOCAL-CHAT-API.md) for testing. Live Strata and browser socket validation must be done on your normal desktop session; handler tests here do not certify that live round trip.

## Build a Windows installer

Close the development app, then run:

Prepare Whisper using `scripts/setup-local-speech.ps1` **before packaging** if you want microphone dictation in the installer. Its files must be in this checkout's `assets/whisper` directory. The installed app reads its own `resources/assets/whisper`, not the build drive. Rebuilding source alone does not update an installed app.

```powershell
pnpm run build
pnpm exec electron-builder --config electron-builder.lite.yml --win nsis --x64 --publish never
```

Keep the tracked `.npmrc` registry setting. Building does not update an already installed app: install the generated Lite installer from `release/build`. Export/import chats if the separate Lite profile is empty. See [build notes](LOCAL-CUSTOM-BUILD.md) for details. Source checks/builds do not verify microphone hardware, a running speech server, or installer behavior on your machine.

## Fork and upstream changes

### November 3 follow-up

The finished continuation view shares the desktop Markdown parser, with formatted emphasis, lists, links, code and tables. Desktop retains its advanced code/artifact controls. Read aloud settings include Test voice using the configured server/voice/speed. Knowledge-base creation uses configured providers directly and offers no hosted Chatbox AI mode. Document embedding requests use batches of at most 32 inputs, matching the supplied TEI service's default.

Optional phone access supports two labelled one-use QR codes: a static private LAN address and a Tailscale HTTPS address. Pairing can remember a device for 30 days without storing the main API token on it. See [phone access](LOCAL-PHONE-ACCESS.md) for setup, firewall, revocation and test limits. Both modes are opt-in; localhost access remains available.

Embedding models now use an actual embedding request in Test Model, rather than chat/vision/tool probes. Failed document retries use the configured knowledge-base parser; the old compute-credit dialog and forced hosted-parser retry are removed. Existing hosted-parser references fall back to Local, while an explicitly configured MinerU service is retained. File-error guidance links to Document Parser settings instead of account or upgrade pages.

Removed the remaining Wolters Kluwer China and Eastmoney MCP suggestion rows; custom servers and manual/JSON setup remain available. Removed Chatbox AI from the document parser picker and its points/activation copy; Local and the explicitly configured MinerU service remain. Added Delete chat to the chat sidebar context menu, using the existing deletion controller and confirmation flow.

Settings → Advanced now includes local API enable/port controls, secure token generation/rotation, Copy token and Open browser. Token rotation disconnects old browser clients. Fixed API readiness being invalidated by subframe loading, and added a public identity check plus clearer errors to the PowerShell proof script. The browser is a small CBL-styled continuation view for existing and new chats; it uses the desktop conversation's model and tools. It is separate from llama-ui or any other service running on another port. If embeddings/llama-ui already uses 8085, choose 8087 for CBL.

Commit your changes, create your own GitHub repository, and add it as `origin`. Keep the original Chatbox repository as `upstream`. Before importing upstream changes, back up app data, create an update branch, merge and resolve conflicts, then repeat the tests above. Do not apply the old incremental patches over this consolidated version. No fork or release is published automatically.

## Credits and license

Based on upstream Chatbox commit `d17455c5ca8fd3ff44385c6d4d2118599e4c970f`. Thanks to the original Chatbox authors and contributors. This independent derivative is not an official Chatbox release. See [LICENSE](LICENSE) and the [upstream project](https://github.com/chatboxai/chatbox) for the original source, documentation, and contributors.
