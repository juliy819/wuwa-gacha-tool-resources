$ErrorActionPreference = 'Stop'
$env:CREATE_ARCHIVE = '1'
node scripts/build.mjs local
if (-not (Test-Path resource-pack-local.zip)) { throw 'archive not generated' }
Expand-Archive -Path resource-pack-local.zip -DestinationPath verify-unpacked -Force
$catalog = Get-Content verify-unpacked\resource-pack\catalog.json -Raw | ConvertFrom-Json
if ($catalog.resources.Count -lt 100) { throw 'resource catalog unexpectedly small' }
$icons = @(Get-ChildItem verify-unpacked\resource-pack\icons -File)
if ($icons.Count -lt 100) { throw 'icon snapshot unexpectedly small' }
Write-Output "verified resources=$($catalog.resources.Count) icons=$($icons.Count) archive=$((Get-Item resource-pack-local.zip).Length)"
