param(
  [string]$BaseUrl = 'http://127.0.0.1:8085',
  [string]$Token = $env:CBL_API_TOKEN,
  [string]$TokenFile,
  [string]$ChatId,
  [string]$Message = 'Reply with exactly: CBL_API_PROOF_OK',
  [int]$TimeoutSeconds = 180
)
$ErrorActionPreference = 'Stop'
if ($TokenFile) { $Token = (Get-Content -LiteralPath $TokenFile -Raw).Trim() }
if (-not $Token) { throw 'Set CBL_API_TOKEN or provide -TokenFile. Do not publish this token.' }
$headers = @{ Authorization = "Bearer $Token" }
if (-not $ChatId) {
  $chats = Invoke-RestMethod -Uri "$BaseUrl/api/chats?limit=100" -Headers $headers
  $chats.items | Select-Object id, name | Format-Table -AutoSize
  Write-Output 'Run again with -ChatId using the ID of your existing Strata/custom-provider conversation.'
  exit 0
}
$chatPath = "$BaseUrl/api/chats/$([uri]::EscapeDataString($ChatId))"
$before = Invoke-RestMethod -Uri "$chatPath`?limit=100" -Headers $headers
if ($before.generating) { throw 'This conversation is busy. Wait for its current response or tool approval.' }
$knownIds = @{}
foreach ($entry in $before.messages) { $knownIds[$entry.id] = $true }
$body = @{ content = $Message } | ConvertTo-Json -Compress
$submitted = Invoke-RestMethod -Method Post -Uri "$chatPath/messages" -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
Write-Output "Accepted by desktop controller: $($submitted.messageId)"
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
do {
  Start-Sleep -Milliseconds 500
  $chat = Invoke-RestMethod -Uri "$chatPath`?limit=100" -Headers $headers
  if ($chat.error) { throw $chat.error }
  $savedUser = @($chat.messages | Where-Object { $_.id -eq $submitted.messageId })
  $answers = @($chat.messages | Where-Object { $_.role -eq 'assistant' -and -not $knownIds.ContainsKey($_.id) })
  $failed = @($answers | Where-Object { $_.error })
  if ($failed.Count) { throw "Provider returned an error: $($failed[-1].error)" }
  if ($savedUser.Count -and $answers.Count -and -not $chat.generating -and -not $chat.waitingForApproval -and -not $answers[-1].generating -and $answers[-1].text) {
    Write-Output "PASS: user message and completed response read from the same desktop conversation ($ChatId)."
    Write-Output "Response: $($answers[-1].text)"
    Write-Output 'Open this conversation in Desktop to confirm the same turn is visible. Restart Desktop and read it again to check persistence across restarts.'
    exit 0
  }
} while ((Get-Date) -lt $deadline)
throw 'Timed out. The message may still be running or awaiting approval in Desktop. Check the conversation before resubmitting.'
