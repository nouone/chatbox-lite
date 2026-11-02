# Chatbox Lite

Based on upstream chatboxai/chatbox commit d17455c5ca8fd3ff44385c6d4d2118599e4c970f.

This baseline consolidates the final source from C:\src\chatbox-strata after the accepted patches and rollbacks. Do not apply the old incremental patches on top of it.

Included: custom-provider Strata thinking controls; provider-reported engine speed for new compatible replies; Kokoro read-aloud, auto-read, playback speed and speech-friendly text; local whisper.cpp microphone dictation and voice level bars; adjacent Send arrow; independent sidebar font size; local-interface account/welcome hiding; removal of Sentry, Google Analytics and Plausible transports and script loads; scrolling follow/reload fixes and the accepted native resize observer; warm sidebar/theme surfaces and borderless sidebar/title-bar join with the rounded content corner retained. Windows packaging includes the local dependency-verification adjustment and removal of the private signing hook.

Use Node 22.13+ (below 23) and pnpm 10.17+. Install dependencies with `pnpm install --frozen-lockfile`. For development set `$env:DEV_PORT = '5173'` and run `pnpm run dev`. Build with `pnpm run build`. Building source does not update an installed executable.

For microphone assets, run `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-local-speech.ps1`. It downloads whisper.cpp and the English base model; these binary assets are intentionally excluded from Git. Kokoro must be running separately; set `AUDIO_TTS_OPENAI_API_BASE_URL=http://localhost:8880` before starting Chatbox, or use its speech settings.

For a local Windows installer, retain your existing packaging procedure. The output scripts/electron-builder configuration in this tree do not include private signing credentials. Keep a separate application identity/install location to avoid replacing stock Chatbox. Chat history, API credentials, installed program files and personal settings are not part of this source baseline.

The app can still connect to configured providers, speech servers and normal update/remote-config services; removing analytics does not make every app feature offline. Keep automatic updates from replacing this custom build with stock upstream.

Before upstream upgrades, create a branch, commit your current changes and back up Chatbox data. Review upstream changes against the local baseline; do not blindly replay old patches. The supplied consolidated patch is for the exact upstream base above. The incremental Git bundle requires that base commit to be present.


## Features

- Custom OpenAI-compatible AI endpoints, including optional Strata-specific thinking controls.
- Microphone dictation with local whisper.cpp transcription, voice level bars and nearby Send arrow.
- Audio read-aloud and automatic reply reading through a Kokoro/OpenAI-compatible speech service.
- Kokoro voice selection and adjustable reading speed. Voice quality depends on the configured speech server/model; there is no extra client-side HQ switch.
- Tavily web search through Chatbox's existing provider configuration. This baseline does not add a search-loop cap.
- Independent sidebar text size, warm theme surfaces and the accepted rounded, borderless navigation join.
- Built-in Sentry, Google Analytics and Plausible reporting removed; account/welcome prompts hidden in the default local interface.

## Chatbox Lite packaging

Use `electron-builder.lite.yml` for the distinct Chatbox Lite application identity. After `pnpm run build`, run `pnpm exec electron-builder --config electron-builder.lite.yml --win nsis --x64 --publish never`. This packaging configuration is supplied but the installer was not generated in this validation run. Export your chats from the existing app and import them into Lite if its separate profile is empty.


## Restore the account, upgrade and welcome screens

Lite hides these screens by default with `CHATBOX_LOCAL_UI=1`. To show them again during development:

```powershell
$env:CHATBOX_LOCAL_UI = '0'
$env:DEV_PORT = '5173'
pnpm run dev
```

This restores the Account/settings group, account/upgrade controls guarded by the local-interface flag, and account/login welcome cards. It changes visibility; it does not grant paid features or alter subscription checks. Provider configuration remains available in either mode.

For an installed Lite app, set the flag before compiling and packaging, then reinstall:

```powershell
$env:CHATBOX_LOCAL_UI = '0'
pnpm run build
pnpm exec electron-builder --config electron-builder.lite.yml --win nsis --x64 --publish never
```

Setting an environment variable after an installer was built will not change that installed app: this flag is embedded into the renderer at build time. To return to the streamlined interface, set `$env:CHATBOX_LOCAL_UI = '1'` and restart development or rebuild/reinstall. The flag does not restore the removed analytics integrations.
