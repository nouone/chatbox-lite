# Local desktop chat API and browser access

This is an optional local interface to the running Chatbox Lite desktop application. It is **disabled by default**, binds **127.0.0.1 by default** (optional explicit LAN listener and Tailscale Serve access are configured in Settings), and uses a bearer token. It is not a separate Strata client or chat engine. Keep Desktop running and unlock/approve any normal desktop prompts there.

## Enable in Settings (recommended)

Open **Settings → Advanced → Local chat API**. Leave the port at 8085, or choose another available port such as 8087 and click Apply port. Turn on Enable local chat API. A secure token is generated automatically if needed. Click Copy token, then Open browser and paste it into the page. Tokens are never displayed in the Settings page or embedded in the browser URL.

Generate new token immediately revokes the previous token and disconnects existing browser/WebSocket clients. Copy the replacement and reconnect. The switch and port are saved for the next launch; no restart is needed for changes. Disable the switch to stop listening. A port conflict is shown in Settings instead of silently leaving you connected to another service.

For PowerShell tests, click Copy token in Settings and then, from your source checkout, run:

```powershell
$env:CBL_API_TOKEN = Get-Clipboard
.\scripts\Test-LocalChatApi.ps1 -BaseUrl 'http://127.0.0.1:8087'
```

Use the port shown in Settings. The script checks CBL's identity before sending credentials, bypasses proxies for local requests, and prints the server's actual error response.

## Optional environment launch on port 8085

Close older Desktop/development instances first. In PowerShell from your source checkout, using Node 22:

```powershell
$env:CBL_API_ENABLED = '1'
$env:CBL_API_PORT = '8085'
$env:CBL_API_TOKEN = ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'))
$env:DEV_PORT = '5173'
Start-Process powershell -WorkingDirectory $PWD -ArgumentList '-NoProfile', '-NoExit', '-Command', 'pnpm run dev'
```

The new development window inherits these variables. Keep the original PowerShell window for API commands: it still has the same token. For browser login, read `$env:CBL_API_TOKEN` in that original shell and paste it into the local page, keeping it private. Do not put the token in screenshots, URLs, commits, or shared logs.

For an installed build, set the same variables before launching its executable with `Start-Process`; fully quit an already-running instance first. Rebuild/reinstall the new code before testing an older installed app. Environment variables override saved Settings at startup. To return to the UI settings, clear the three `CBL_API_*` environment variables from your launch shell and restart. To disable the API, switch it off in Settings.

If `CBL_API_TOKEN` is omitted, enabling the API generates/reuses `local-api-token.txt` in its desktop profile. Use Copy token in Settings, or supply the private file's path with `-TokenFile`. Changing the API token does not change provider keys or conversation data.

## Browser interface

Open **http://127.0.0.1:8085/**. Enter the local API token, connect, select an existing conversation, and send a question. The page has no external scripts, keeps manually entered tokens in memory, or uses an HttpOnly browser cookie when you choose Remember this device, and uses the same API and WebSocket as other clients. It currently shows the latest bounded history window; paginated older history is available via HTTP. Create new conversations and manage settings/files/approvals in Desktop.

Use the actual port shown in Settings: if your embedding server/llama-ui already uses 8085, choose **8087** for CBL and open **http://127.0.0.1:8087/**. These are separate services. The browser is a minimal CBL-styled continuation view: existing chats, live replies, and the Send arrow. There is no independent model picker or tool setup. It uses the selected desktop conversation's settings and uses the shared desktop Markdown parser for formatted replies; attachments, advanced previews and management remain in Desktop. Streaming follows the bottom when you are already near it and leaves you in place when you scroll upward.

## First proof using your existing Strata conversation

With Desktop running and the token available in the client shell:

```powershell
# List existing conversations and their IDs:
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Test-LocalChatApi.ps1

# Choose the ID of your existing configured conversation:
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Test-LocalChatApi.ps1 -ChatId 'YOUR-CHAT-ID'
```

Alternatively supply `-TokenFile 'YOUR-PROFILE\local-api-token.txt'`. The script submits a small proof prompt, checks that its message ID appears in the same conversation, waits for a new completed assistant response, and reports provider errors/timeouts rather than claiming success. Inspect the same chat in Desktop, then restart the app and retrieve that conversation again to check persistence across restarts. A 202 response means accepted for processing, not proof that generation succeeded; context compaction, tool approval or an unavailable provider can delay/fail it. **Check the chat before retrying a timed-out send**, to avoid duplicates.

A direct PowerShell call is also possible:

```powershell
$headers = @{ Authorization = "Bearer $env:CBL_API_TOKEN" }
Invoke-RestMethod 'http://127.0.0.1:8085/api/chats' -Headers $headers
Invoke-RestMethod -Method Post 'http://127.0.0.1:8085/api/chats/YOUR-CHAT-ID/messages' -Headers $headers -ContentType 'application/json' -Body '{"content":"Reply with exactly: CBL_API_PROOF_OK"}'
```

## Endpoints

| Endpoint | Behavior |
| --- | --- |
| `GET /api/status` | Public, local-only server identity (`app: chatbox-lite`, `apiVersion: 1`); no credentials, chat data or settings. |
| `GET /api/chats?limit=50&cursor=0` | Active conversation metadata from the desktop repository. Returns `items`, `nextCursor`, `total`. Limits 1–100. |
| `GET /api/chats/:id?limit=50` | Bounded transcript history, message IDs, roles, text, generation/error status, and `nextCursor`. Pass that cursor URL-encoded to retrieve an older page. System prompts and provider credentials are not returned. |
| `POST /api/chats/:id/messages` | JSON `{ "content": "question" }`. Returns 202 with `chatId`, `messageId`. Rejects missing/busy/paused conversations and invalid/oversized text. No new attachment upload or tool-approval endpoint is provided. |
| `WS /api/events` | Authenticate by Bearer header for native clients, or browser subprotocols `['cbl-api', token]`. Send `{ "type": "subscribe", "chatId": "..." }`. Receives changed `chat.snapshot` events at up to four updates per second. |

WebSocket snapshots read the existing renderer generation runtime's live text over the shared persisted history. They do not wait for the normal two-second disk checkpoint and do not generate responses themselves. On disconnect, generation continues in Desktop. Reconnect and fetch history to recover the latest state. There is no durable event-replay log or automatic request retry.

## Architecture and limits

`main/local-chat-api/server.ts` handles HTTP/WebSocket transport. `desktop.ts` sends typed IPC calls through the preload bridge to `renderer/packages/local-chat-api.ts`. Submissions call **`submitNewUserMessage` in `renderer/stores/session/messages.ts`**, the same controller invoked by the desktop conversation Send handler. That controller keeps the normal session lock, context/knowledge, model configuration, tool handling, generation and persistence. No provider endpoint, key, or model client is created by the API.

Local origins/Host headers and bearer credentials are checked; the server does not enable cross-origin access or LAN listening. Tokens are not a substitute for trusting local software. Do not expose this listener through a proxy/tunnel, or publish the token. Vendor network-blocking remains in force.

Automated tests exercise HTTP handlers, authentication, WebSocket snapshot handling, renderer dispatch and the shared Send entry point. **The development environment denied live localhost client connections (`EACCES`), so these results do not claim a live Strata round trip or browser socket verification.** The proof script above is the required live acceptance check on your normal desktop session.

## Phone access

See [LOCAL-PHONE-ACCESS.md](LOCAL-PHONE-ACCESS.md) for the two QR codes, static LAN IP, Tailscale HTTPS link, remembered devices and token revocation. The API remains disabled by default and no LAN/Tailscale address is enabled automatically. Native clients still use bearer tokens. Browser reads add `?view=web` and WebSocket subscriptions add `view: "web"` to request safe shared Markdown presentation; plain API reads remain unchanged.

### Browser/address follow-up (r2)

Apply address is below both the Tailscale and LAN fields and saves both together. Typing alone does not enable a listener. The running address and Open browser prefer the applied LAN address, then Tailscale, then localhost. Open browser creates a separate one-use browser pairing link, so it does not require API-key entry or invalidate QR codes displayed for phones. Reapplying the same address refreshes its QR codes.

## New chats and browser progress

`POST /api/chats` creates a conversation through the desktop New Chat controller. The browser New chat button uses this route. Ordinary connection loss retries with remembered pairing; expired pairing needs a fresh QR. Provider-reported processing and generation speeds appear when supplied, with active reply status.
