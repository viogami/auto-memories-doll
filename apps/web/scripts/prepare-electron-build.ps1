$ErrorActionPreference = "Stop"

$processNames = @("AutoMemoriesDoll", "electron")
foreach ($name in $processNames) {
  Get-Process -Name $name -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

$targetDir = Join-Path $PSScriptRoot "..\dist\win-unpacked"
if (-not (Test-Path $targetDir)) {
  exit 0
}

$maxRetries = 8
for ($i = 1; $i -le $maxRetries; $i++) {
  try {
    Remove-Item -Path $targetDir -Recurse -Force
    exit 0
  }
  catch {
    if ($i -eq $maxRetries) {
      throw "Failed to clear $targetDir after $maxRetries retries. Please close running desktop app windows and try again."
    }

    Start-Sleep -Milliseconds 500
    foreach ($name in $processNames) {
      Get-Process -Name $name -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    }
  }
}
