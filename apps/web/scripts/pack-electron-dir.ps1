$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputDir = "dist/pack-$timestamp"

Write-Host "Packing desktop app to $outputDir"

npx electron-builder --win --dir --config.directories.output=$outputDir
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host "Packed successfully."
Write-Host "Run: apps/web/$outputDir/win-unpacked/AutoMemoriesDoll.exe"
