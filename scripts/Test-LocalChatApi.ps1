param(
  [string]$BaseUrl = 'http://127.0.0.1:8085',
  [string]$Token = $env:WAO_API_TOKEN,
  [string]$TokenFile,
  [string]$ChatId,
  [string]$Message = 'Reply with exactly: WAO_API_PROOF_OK',
  [int]$TimeoutSeconds = 180
)
$ErrorActionPreference = 'Stop'
if ($TokenFile) { $Token = (Get-Content -LiteralPath $TokenFile -Raw).Trim() }
if (-not $Token) { throw 'Set WAO_API_TOKEN or provide -TokenFile. Do not publish this token.' }
$target = [uri]$BaseUrl
if ($target.Scheme -ne 'http' -or $target.Host -notin @('127.0.0.1', 'localhost')) { throw 'Use the local Wao API URL shown in Settings > Advanced.' }
Add-Type -AssemblyName System.Net.Http
function Invoke-WaoApi {
  param([string]$Uri, [hashtable]$Headers = @{}, [string]$Method = 'GET', [string]$ContentType, [byte[]]$Body)
  $handler = [System.Net.Http.HttpClientHandler]::new()
  $handler.UseProxy = $false
  $client = [System.Net.Http.HttpClient]::new($handler)
  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), $Uri)
  try {
    foreach ($key in $Headers.Keys) { $request.Headers.Add($key, [string]$Headers[$key]) }
    if ($null -ne $Body) {
      $request.Content = [System.Net.Http.ByteArrayContent]::new($Body)
      $request.Content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse($ContentType)
    }
    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    try {
      $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
      if (-not $response.IsSuccessStatusCode) { throw ('HTTP ' + [int]$response.StatusCode + ': ' + $text) }
      return ($text | ConvertFrom-Json)
    } finally { $response.Dispose() }
  } finally { $request.Dispose(); $client.Dispose() }
}
$identity = Invoke-WaoApi -Uri "$BaseUrl/api/status"
if ($identity.app -ne 'wao' -or $identity.apiVersion -ne 1) { throw 'This port is not the Wao chat API. Check Settings > Advanced before sending a token.' }
$headers = @{ Authorization = "Bearer $Token" }
if (-not $ChatId) {
  $chats = Invoke-WaoApi -Uri "$BaseUrl/api/chats?limit=100" -Headers $headers
  $chats.items | Select-Object id, name | Format-Table -AutoSize
  Write-Output 'Run again with -ChatId using the ID of your existing Strata/custom-provider conversation.'
  exit 0
}
$chatPath = "$BaseUrl/api/chats/$([uri]::EscapeDataString($ChatId))"
$before = Invoke-WaoApi -Uri "$chatPath`?limit=100" -Headers $headers
if ($before.generating) { throw 'This conversation is busy. Wait for its current response or tool approval.' }
$knownIds = @{}
foreach ($entry in $before.messages) { $knownIds[$entry.id] = $true }
$body = @{ content = $Message } | ConvertTo-Json -Compress
$submitted = Invoke-WaoApi -Method Post -Uri "$chatPath/messages" -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
Write-Output "Accepted by desktop controller: $($submitted.messageId)"
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
do {
  Start-Sleep -Milliseconds 500
  $chat = Invoke-WaoApi -Uri "$chatPath`?limit=100" -Headers $headers
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
