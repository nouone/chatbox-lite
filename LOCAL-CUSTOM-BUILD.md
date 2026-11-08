# Wao

Based on upstream chatboxai/chatbox commit d17455c5ca8fd3ff44385c6d4d2118599e4c970f.

This baseline consolidates the final source from C:\src\chatbox-strata after the accepted patches and rollbacks. Do not apply the old incremental patches on top of it.

Included: custom-provider Strata thinking controls; provider-reported engine speed for new compatible replies; Kokoro read-aloud, auto-read, playback speed and speech-friendly text; local whisper.cpp microphone dictation and voice level bars; adjacent Send arrow; independent sidebar font size; local-interface account/welcome hiding; removal of Sentry, Google Analytics and Plausible transports and script loads; scrolling follow/reload fixes and the accepted native resize observer; warm sidebar/theme surfaces and borderless sidebar/title-bar join with the rounded content corner retained. Windows packaging includes the local dependency-verification adjustment and removal of the private signing hook.

Use Node 22.13+ (below 23) and pnpm 10.17+. Install dependencies with `pnpm install --frozen-lockfile`. For development set `$env:DEV_PORT = '5173'` and run `pnpm run dev`. Build with `pnpm run build`. Building source does not update an installed executable.

For microphone assets, run `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-local-speech.ps1`. It downloads whisper.cpp and the English base model; these binary assets are intentionally excluded from Git. Kokoro must be running separately; set `AUDIO_TTS_OPENAI_API_BASE_URL=http://localhost:8880` before starting Chatbox, or use its speech settings.

For a local Windows installer, retain your existing packaging procedure. The output scripts/electron-builder configuration in this tree do not include private signing credentials. Keep a separate application identity/install location to avoid replacing stock Chatbox. Chat history, API credentials, installed program files and personal settings are not part of this source baseline.

Vendor background updates, remote configuration, license checks, promotional notifications and hosted artifact previews are removed. Updates are manual. Configured providers, speech/search services, MCP servers and content you open may use the network. See README.md and PRIVACY-AUDIT.md for the audit and limits.

Before upstream upgrades, create a branch, commit your current changes and back up Chatbox data. Review upstream changes against the local baseline; do not blindly replay old patches. The supplied consolidated patch is for the exact upstream base above. The incremental Git bundle requires that base commit to be present.


## Features

- Custom OpenAI-compatible AI endpoints, including optional Strata-specific thinking controls.
- Microphone dictation with local whisper.cpp transcription, voice level bars and nearby Send arrow.
- Audio read-aloud and automatic reply reading through a Kokoro/OpenAI-compatible speech service.
- Kokoro voice selection and adjustable reading speed. Voice quality depends on the configured speech server/model; there is no extra client-side HQ switch.
- Tavily web search through Chatbox's existing provider configuration. This baseline does not add a search-loop cap.
- Independent sidebar text size, warm theme surfaces and the accepted rounded, borderless navigation join.
- Built-in Sentry, Google Analytics and Plausible reporting removed; account/welcome prompts hidden in the default local interface.

## Wao packaging

Use `electron-builder.lite.yml` for the distinct Wao application identity. After `pnpm run build`, run `pnpm exec electron-builder --config electron-builder.lite.yml --win nsis --x64 --publish never`. This packaging configuration is supplied but the installer was not generated in this validation run. Export your chats from the existing app and import them into Lite if its separate profile is empty.


## Account and upgrade screens removed

Account/login/upgrade welcomes, hosted Chatbox provider selection and promotional banners are removed permanently. There is no environment variable or restore toggle. Old account URLs lead to custom-provider setup and the guide URL leads to local Help/About. Vendor account services are unavailable; Wao does not unlock paid features.

## Application icon

The current app icon is the supplied gray chatbox-smiley.svg, with the eyes and mouth shifted upward by two SVG units and a tight canvas. It replaces the earlier neon concepts. The plain, empty chat-list bubble follows the live theme accent; custom avatars are retained. SVG, PNG and ICO exports use the same current smiley artwork. macOS ICNS is structurally validated but has not been tested on macOS.

## Packaging registry

The tracked root `.npmrc` includes `registry=https://registry.npmjs.org/`. The beforePack hook requires an explicit default registry to install production dependencies in `release/app`; a user/global npm setting alone does not satisfy that hook. Keep this line in the repository. If you intentionally use another package registry, replace the value with that approved registry URL.

Do not bypass the Node engine check: use Node 22.13+ below 23. For fnm in PowerShell, initialize and switch the shell before installing dependencies:

```powershell
fnm env --shell powershell | Out-String | Invoke-Expression
fnm install 22.21.1
fnm use 22.21.1
node --version
```

## November 3: local help, speech defaults and optional web access

Kokoro defaults to http://localhost:8880, kokoro, af_heart, 1.1x. Existing explicit speech preferences are retained. Speech controls moved from Chat to Default Models and replace the old unavailable placeholder; Whisper dictation setup is described there. Auto-read remains opt-in.

Bundled skill seeds/discovery and built-in MCP presets are removed. Existing custom skills and custom MCP servers remain. Grok (xAI) and LM Studio lead the provider picker; Xiaomi/MiMo is omitted from that picker without deleting saved data. Image Creator calls your configured image endpoint; it does not contain a local image inference engine.

Help opens a new normal chat with the bundled README and build notes as context, retaining the current/default custom chat model. No request is sent automatically. API keys, settings, logs and other conversations are not attached. Questions subsequently go to your chosen provider.

See LOCAL-CHAT-API.md for authenticated localhost API/browser access, its shared desktop pipeline, and scripts/Test-LocalChatApi.ps1 for live acceptance testing with an existing Strata conversation.
