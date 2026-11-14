param(
    [string]$SpeechUrl = 'http://localhost:8880',
    [string]$EmbeddingUrl = 'http://localhost:8086/v1',
    [ValidateSet('All', 'Speech', 'Embeddings')][string]$Service = 'All'
)
$ErrorActionPreference = 'Stop'
if ($Service -in @('All', 'Speech')) {
    $audioPath = Join-Path ([IO.Path]::GetTempPath()) ('wao-speech-' + [guid]::NewGuid().ToString('N') + '.mp3')
    $body = @{ model = 'kokoro'; voice = 'af_heart'; input = 'Wao local speech is working.'; speed = 1.1; response_format = 'mp3' } | ConvertTo-Json
    Invoke-WebRequest -UseBasicParsing -Uri ($SpeechUrl.TrimEnd('/') + '/v1/audio/speech') -Method Post -ContentType 'application/json' -Body $body -OutFile $audioPath -TimeoutSec 180
    if ((Get-Item -LiteralPath $audioPath).Length -eq 0) { throw 'Speech service returned an empty file.' }
    Write-Host "Speech sample saved: $audioPath"
}
if ($Service -in @('All', 'Embeddings')) {
    $body = @{ model = 'text-embeddings-inference'; input = @('Wao document embedding test.'); encoding_format = 'float' } | ConvertTo-Json
    $result = Invoke-RestMethod -Uri ($EmbeddingUrl.TrimEnd('/') + '/embeddings') -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 180
    if (-not $result.data -or -not $result.data[0].embedding -or $result.data[0].embedding.Count -lt 1) { throw 'Embedding service returned no vector.' }
    Write-Host ('Embedding test passed; vector dimensions: ' + $result.data[0].embedding.Count)
}
