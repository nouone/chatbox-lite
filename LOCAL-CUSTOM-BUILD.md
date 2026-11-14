# Wao build and installation

Based on upstream chatboxai/chatbox commit d17455c5ca8fd3ff44385c6d4d2118599e4c970f. The public history is a single consolidated v1.0.0 commit; the full pre-derivative history lives on the `archive/chatbox-lite-history` branch.

Wao is a desktop Electron app plus an optional local web/API front end. Included: custom-provider Strata thinking controls; provider-reported engine speed; Kokoro read-aloud, auto-read and playback speed; local whisper.cpp microphone dictation with level bars; phone voice mode over the local API; a standalone browser continuation page with WebSocket sync; independent sidebar font size; warm theme surfaces; and removal of Sentry, Google Analytics and Plausible transports, vendor update checks, remote configuration, promotional dialogs and hosted previews.

## Requirements and source build

Use Node **22.13+ (below 23)** and pnpm **10.17+**. Do not bypass the engine check. For fnm in PowerShell, initialize and switch the shell first:

```powershell
fnm env --shell powershell | Out-String | Invoke-Expression
fnm install 22.21.1
fnm use 22.21.1
node --version
pnpm install --frozen-lockfile
pnpm run check
```

For development set `$env:DEV_PORT = '5173'` and run `pnpm run dev`. Build the bundles with `pnpm run build`. Building source does not update an installed executable.

## Microphone assets

Run `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-local-speech.ps1`. It downloads whisper.cpp and the English base model into `assets/whisper`; these binary assets are intentionally excluded from Git. Packaging embeds whatever is in `assets/whisper` at build time, and the installed app reads its own `resources/assets/whisper`, so prepare the assets in the same checkout that builds the installer. Kokoro must run separately: set `AUDIO_TTS_OPENAI_API_BASE_URL=http://localhost:8880` before starting Wao, or use its speech settings (see LOCAL-SERVICES.md).

## Packaging

Use `electron-builder.wao.yml` for the Wao application identity (`appId local.wao`, product name Wao, artifact `Wao-<version>-x64-Setup.exe`, publisher "Wao Contributors"). After `pnpm run build`:

```powershell
pnpm exec electron-builder --config electron-builder.wao.yml --win nsis --x64 --publish never
```

The installer is unsigned; `SHA256SUMS.txt` accompanies scripted builds. The NSIS install GUID derives from the appId, so Wao has its own install path and uninstall entry. The app profile is `%APPDATA%\Wao`, established by the main-process bootstrap before any store loads. Export your chats from an older app and import them if the Wao profile is empty.

The tracked root `.npmrc` includes `registry=https://registry.npmjs.org/`. The beforePack hook requires an explicit default registry to install production dependencies in `release/app`; a user/global npm setting alone does not satisfy that hook. Keep this line in the repository. If you intentionally use another package registry, replace the value with that approved registry URL.

The scripted local build entry point is `scripts/Build-WaoInstaller.ps1` (version stamp via `scripts/Set-WaoReleaseVersion.ps1`, regression gate, bundle, package, checksum); the GitHub workflow `.github/workflows/windows.yml` uses the same scripts. See WINDOWS-RELEASE.md.

## Application identity and icon

The app icon is the gray smiley (`assets/icon.svg`); SVG, PNG and ICO exports use the same artwork, and the macOS ICNS is structurally validated but untested on macOS. The empty chat-list bubble follows the live theme accent; custom avatars are retained. Stable internal wire identifiers deliberately survive the rename: the package name `xyz.chatboxapp.ce`, the `cbl-api` WebSocket subprotocol, `lite-api:*` IPC channels and the `cbl.chat` browser storage key. Changing them would break pairings and stored state for no user-visible gain.

## Account and upgrade screens removed

Account/login/upgrade welcomes, hosted Chatbox provider selection and promotional banners are removed permanently. There is no environment variable or restore toggle. Old account URLs lead to custom-provider setup and the guide URL leads to local Help/About. Vendor account services are unavailable; Wao does not unlock paid features.

## Voice pipeline notes

Desktop dictation: whisper.cpp runs in-process, and the transcription becomes an editable draft beside the Send arrow. Phone voice mode: the browser page captures audio, Desktop transcribes it and sends it in one pass; there is no model rewrite stage. Replies are spoken through the configured Kokoro/OpenAI-compatible service after a deterministic text normalizer expands common dates, units and compass directions and omits URLs and code. The short speaking-style instruction is prepended to the first voice send of a conversation only; later voice turns carry bare text, and compaction re-arms it if it scrolls out.

## Upstream changes

Vendor background updates, remote configuration, license checks, promotional notifications and hosted artifact previews are removed. Updates are manual. Configured providers, speech/search services, MCP servers and content you open may use the network. See README.md and PRIVACY-AUDIT.md for the audit and limits.

Before importing upstream changes, create a branch, commit your current changes and back up app data (`%APPDATA%\Wao`). Review upstream changes against the local baseline; do not blindly replay old patches. Provider catalog: Grok (xAI) and LM Studio lead the picker; Xiaomi/MiMo is omitted from the picker without deleting saved data. Help opens a new normal chat with the bundled README and setup guides as context, retaining the current/default custom chat model; no request is sent automatically, and API keys, settings, logs and other conversations are not attached.
