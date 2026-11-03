# One-time Windows x64 resource setup; no Python or server is used during dictation.
$ErrorActionPreference = 'Stop'
$speechProjectRoot = Split-Path -Parent $PSScriptRoot
$speechAssets = Join-Path $speechProjectRoot 'assets/whisper'
$speechDownload = Join-Path $speechProjectRoot '.local-speech-download'
if (-not (Get-Command hf -ErrorAction SilentlyContinue)) {
  throw 'Install the Hugging Face CLI first: python -m pip install --upgrade huggingface_hub. Then open a new PowerShell window.'
}
New-Item -ItemType Directory -Force $speechAssets, $speechDownload | Out-Null
$speechZip = Join-Path $speechDownload 'whisper-bin-x64-v1.7.6.zip'
Invoke-WebRequest -Uri 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.7.6/whisper-bin-x64.zip' -OutFile $speechZip
$speechHash = (Get-FileHash -LiteralPath $speechZip -Algorithm SHA256).Hash
if ($speechHash -ne '0d2eca299c248f965bd0341bcb219db4b433c7f0c0ce2200d4df85765e8156a9') {
  throw 'The Whisper runtime download failed its published SHA256 verification.'
}
$speechExtract = Join-Path $speechDownload 'runtime-v1.7.6'
Expand-Archive -LiteralPath $speechZip -DestinationPath $speechExtract -Force
$speechExe = @(Get-ChildItem -LiteralPath $speechExtract -Filter whisper-cli.exe -File -Recurse)
if ($speechExe.Count -ne 1) { throw 'The runtime archive does not contain exactly one whisper-cli.exe.' }
Copy-Item -LiteralPath $speechExe[0].FullName -Destination (Join-Path $speechAssets 'whisper-cli.exe')
Get-ChildItem -LiteralPath $speechExtract -Filter '*.dll' -File -Recurse | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $speechAssets $_.Name)
}
& hf download ggerganov/whisper.cpp ggml-base.en.bin --local-dir $speechAssets
if ($LASTEXITCODE -ne 0) { throw 'The English speech model download failed.' }
if ((Get-FileHash -LiteralPath (Join-Path $speechAssets 'ggml-base.en.bin') -Algorithm SHA256).Hash -ne 'a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002') { throw 'The Whisper model failed SHA256 verification.' }
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/ggml-org/whisper.cpp/v1.7.6/LICENSE' -OutFile (Join-Path $speechAssets 'LICENSE-whisper.cpp.txt')
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/openai/whisper/main/LICENSE' -OutFile (Join-Path $speechAssets 'LICENSE-Whisper-model.txt')
Write-Output 'Local dictation resources are ready. Restart Chatbox, or rebuild the installer to bundle them.'
