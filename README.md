# Chatbox Lite

An independent, streamlined derivative of [Chatbox](https://github.com/chatboxai/chatbox), focused on custom AI endpoints and local voice. Distributed under GPLv3; upstream authors and license are retained.

## What this version adds

- **Custom AI endpoints:** OpenAI-compatible provider support, optional Strata Off/Low/Medium/High thinking controls, and provider-reported generation speed when supplied by the server.
- **Local Whisper microphone input:** whisper.cpp transcription, recording level animation, Stop-to-transcribe, and a nearby Send arrow. Transcription becomes an editable draft.
- **Kokoro audio playback:** read responses aloud, automatically read completed replies, select a voice, and adjust speed. Speech normalization expands common dates, units, abbreviations, compass directions, and Bible references while omitting URLs and code. Voice quality depends on the speech server and model; there is no separate client HQ switch.
- **Tavily search:** retains Chatbox's Tavily configuration and web search support. No additional search-loop limit is introduced.
- **Interface improvements:** independent sidebar font size, theme-aware chat icons, warm theme surfaces, the smiley application icon, nearby Send arrow, and streaming scroll-follow fixes.
- **A quieter default interface:** account and upgrade screens hidden. Restore them instantly with **Settings > Appearance > Show account and upgrade features**. The preference is saved; no environment variable or rebuild is required. Original welcome-card eligibility and subscription checks still apply.
- **Analytics removed:** Sentry reporting, Google Analytics, and Plausible scripts/transports are removed. Restoring account screens does not restore analytics. Providers, speech servers, updates, and remote configuration may still use the network.
- **Local help:** the sidebar Help button opens About with Lite features and voice setup, rather than the original guide chatbot. Upstream credits and GPL links remain available.
- **Windows packaging fixes:** explicit package registry, local production dependency verification, and a separate Lite installer identity without private signing credentials.

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
5. Change sidebar text size and theme. Toggle account features on and off in Appearance; check settings navigation and eligible welcome cards, then restart to confirm the preference is saved.
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
