param([Parameter(Mandatory=$true)][string]$Version)
$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^\d+\.\d+\.\d+(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$') { throw 'Use a semantic version such as 1.24.1 or 1.24.1-beta.1.' }
$env:Wao_RELEASE_VERSION = $Version
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
  node -e "const fs=require('fs');for(const file of ['release/app/package.json','release/app/package-lock.json']){const data=JSON.parse(fs.readFileSync(file,'utf8'));data.version=process.env.Wao_RELEASE_VERSION;if(data.packages?.[''])data.packages[''].version=data.version;fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n')}"
  if ($LASTEXITCODE -ne 0) { throw 'Version update failed.' }
} finally { Pop-Location; Remove-Item Env:Wao_RELEASE_VERSION }
