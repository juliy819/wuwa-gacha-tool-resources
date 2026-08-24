$ErrorActionPreference = 'Stop'
$env:CREATE_ARCHIVE = '1'
node scripts/build.mjs local
if (-not (Test-Path resource-pack-local.zip)) { throw 'archive not generated' }
if (Test-Path verify-unpacked) { Remove-Item -LiteralPath verify-unpacked -Recurse -Force }
Expand-Archive -Path resource-pack-local.zip -DestinationPath verify-unpacked -Force
$catalog = Get-Content verify-unpacked\resource-pack\catalog.json -Raw -Encoding UTF8 | ConvertFrom-Json
if ($catalog.resources.Count -lt 100) { throw 'resource catalog unexpectedly small' }
$icons = @(Get-ChildItem verify-unpacked\resource-pack\icons -File)
if ($icons.Count -lt 100) { throw 'icon snapshot unexpectedly small' }
if ($icons.Count -ne @($catalog.icons.PSObject.Properties).Count) { throw 'catalog and icon file counts differ' }
foreach ($entry in $catalog.icons.PSObject.Properties) {
  if ($entry.Value -ne "$($entry.Name).webp") { throw "unsafe icon path for $($entry.Name)" }
  if (-not (Test-Path -LiteralPath (Join-Path verify-unpacked\resource-pack\icons $entry.Value))) { throw "missing icon $($entry.Name)" }
}
Write-Output "verified resources=$($catalog.resources.Count) icons=$($icons.Count) archive=$((Get-Item resource-pack-local.zip).Length)"
