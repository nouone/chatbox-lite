# Continue a desktop chat on your phone

CBL must remain open on your desktop. Your phone can continue existing conversations or start one with New chat. Model configuration, files, knowledge, tools and approvals stay on Desktop. The browser uses the same Send controller and saved chats.

## Desktop setup

1. Open Settings → Advanced → Local chat API. Enable it. Use port **8088**, or another available port. A secure API token is generated automatically.
2. For home-network access, enter your desktop's **static private IPv4 address** in Static LAN IP and click Apply address. This must be an IP actually assigned to the PC, such as 192.168.1.100. Prefer a router DHCP reservation so it remains stable. Leaving the field empty keeps LAN access off. CBL binds that address explicitly in addition to localhost; it does not bind all interfaces.
3. For access from outside your home, use Tailscale Serve as below. Paste its HTTPS address into Tailscale HTTPS address and click Apply address. The app never starts Serve or changes Tailscale itself.
4. The settings page automatically displays QR codes for the configured addresses: **Local network** and **Tailscale — home or away**. The links are shown there too. Refresh phone QR codes replaces the outstanding one-use codes.

## Tailscale setup

Connect Tailscale on both devices. With CBL listening on 8088, run in PowerShell on the desktop:

```powershell
tailscale serve --bg --https=8443 http://127.0.0.1:8088
tailscale serve status
$tailnetHost = (tailscale status --json | ConvertFrom-Json).Self.DNSName.TrimEnd('.')
$phoneAddress = "https://${tailnetHost}:8443"
$phoneAddress | Set-Clipboard
Write-Host $phoneAddress
```

If your CBL port differs, use that backend port. If Serve already uses HTTPS port 8443 for another application, choose a different unused Serve HTTPS port. This command adds/updates that Serve listener; it is not needed for plain LAN access. Follow Tailscale's HTTPS setup prompt if your tailnet has not enabled HTTPS yet. Paste the resulting address into CBL's Tailscale HTTPS address field. Use Serve, not public Funnel; CBL rejects Funnel-marked requests.

CBL allows only the exact saved Tailscale host and origin. It supports HTTPS/WSS through Serve, which preserves the incoming Host header. Requests do not gain access from Tailscale identity headers alone: browser pairing or the API token is still required.

## Pair the phone

Scan the desired QR code using the phone's camera. On the phone, tap **Pair with Desktop**. Leave **Remember this device for 30 days** checked if you want to reconnect without a key. Uncheck it for a browser-session cookie with a 12-hour server-side maximum. The one-use pairing code expires after five minutes and is removed from the browser URL immediately; it is not the desktop API key.

Select a conversation and continue it. On the same LAN, use the Local network QR. At home or away, use Tailscale while it is connected on both devices. The Tailscale link uses HTTPS; the plain LAN link uses HTTP and is intended for your trusted local network. Windows Firewall may need to permit the chosen application/port on your private network; CBL does not change firewall rules automatically.

## Revoke or disconnect

- **Forget this device** on the browser login panel clears that browser's stored connection.
- **Generate new token** in Desktop invalidates old API tokens, all remembered browser credentials and outstanding QR codes, and disconnects existing browser streams. New QR codes appear automatically when an address is configured.
- Disable the API to close both listeners. Clear the Static LAN IP and apply to disable only the LAN listener. Tailscale Serve configuration remains under your control; to stop the example Serve listener, run `tailscale serve --https=8443 off`.

Browser credentials are signed, expire server-side and are stored in HttpOnly, SameSite cookies; HTTPS connections also use Secure cookies. No primary API token is stored in phone localStorage or included in the QR. Remembered credentials survive CBL restarts while the same API token is retained. Explicit CBL_API_* environment variables still override saved settings at launch; clear those old test variables when using the Settings controls.

## Scope of verification

Automated tests exercise pairing expiry/replay, cookie authentication, origin checks, rotation/revocation, browser message rendering and shared desktop message dispatch. Real phone/Tailscale routing and Windows Firewall configuration require testing on your devices; they were not configured or live-tested by this source build.

References: [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve), [CLI and flags](https://tailscale.com/docs/reference/tailscale-cli/serve), [reverse-proxy source](https://github.com/tailscale/tailscale/blob/main/ipn/ipnlocal/serve.go).

## Reconnecting

The browser retries ordinary connection loss using remembered pairing. If pairing expires, scan a fresh Desktop QR. Rotating the API token signs out all devices. Provider-reported processing and generation speeds appear when available; missing speeds are not estimated.

## iPhone dictation and playback

Use the microphone on the iPhone keyboard to dictate into the message box, then review and Send. Lite does not add a second recorder or upload keyboard dictation audio itself; keyboard dictation follows your iPhone settings.

Completed assistant replies have a Read aloud button. Enable Read aloud in Desktop Default Models and start your configured Kokoro/OpenAI-compatible speech service. The phone requests audio through the authenticated Lite server; the speech URL, model, voice, speed and API key stay on Desktop. The same Desktop speech text normalization is used. No separate chat client or speech-provider configuration is required on the phone.

If Safari does not start playback after preparation, tap Play on the audio controls. Stop reading cancels/release playback, and changing chats or forgetting the device releases its audio. Web-originated replies suppress Desktop auto-read even when that chat is visible and Desktop's auto-read toggle is On. Normal Desktop sends retain their auto-read behavior. This does not stop speech that was already playing from a separate Desktop action.

Speech requires an authenticated paired browser or API token and uses POST /api/chats/:id/messages/:messageId/speech. It reads only a completed saved assistant reply. Requests are limited to 20,000 spoken characters and 8 MiB audio, with one synthesis in flight on Desktop. Use your Tailscale HTTPS page on iPhone; Desktop and the speech service must remain running. Closing/cancelling the phone request stops phone playback; synthesis already started on Desktop may finish silently.
