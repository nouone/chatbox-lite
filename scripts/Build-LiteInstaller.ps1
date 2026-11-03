# Run pnpm run build first. This script intentionally fails if dictation is missing.
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
  $required = @('whisper-cli.exe','whisper.dll','ggml.dll','ggml-base.dll','ggml-cpu.dll','ggml-base.en.bin','LICENSE-whisper.cpp.txt','LICENSE-Whisper-model.txt')
  foreach ($name in $required) {
    if (-not (Test-Path -LiteralPath "assets/whisper/$name")) { throw "Missing dictation resource: $name. Run scripts/setup-local-speech.ps1 first." }
  }
  if ((Get-FileHash assets/whisper/ggml-base.en.bin -Algorithm SHA256).Hash -ne 'a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002') { throw 'Whisper model checksum mismatch.' }
  pnpm exec electron-builder --config electron-builder.lite.yml --win nsis --x64 --publish never
  if ($LASTEXITCODE -ne 0) { throw 'Installer build failed.' }
  foreach ($name in $required) {
    $packed = "release/build/win-unpacked/resources/assets/whisper/$name"
    if (-not (Test-Path -LiteralPath $packed)) { throw "Installer omitted dictation resource: $name" }
    if ((Get-FileHash -LiteralPath $packed).Hash -ne (Get-FileHash -LiteralPath "assets/whisper/$name").Hash) { throw "Packaged dictation resource changed: $name" }
  }
  $version = (Get-Content release/app/package.json -Raw | ConvertFrom-Json).version
  $installer = "release/build/Chatbox-Lite-$version-x64-Setup.exe"
  if (-not (Test-Path -LiteralPath $installer)) { throw 'Expected installer was not produced.' }
  $hash = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant()
  "$hash  $(Split-Path -Leaf $installer)" | Set-Content release/build/SHA256SUMS.txt -Encoding ascii
  Write-Host "Ready: $installer"
} finally { Pop-Location }
