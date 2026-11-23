$ErrorActionPreference = 'Stop'
$wcAppRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $wcAppRoot
node tools/preview-work-center.mjs
