# FinDash Launcher - starts backend + frontend and opens browser
$ErrorActionPreference = 'Continue'
$Root    = "C:\Users\ander\.gemini\antigravity\scratch\finance-dashboard"
$Backend = "$Root\backend"

# -- Kill anything already on our ports ---------------------------------------
foreach ($port in @(3002, 8081)) {
  $matches = netstat -ano | Select-String ":$port\s.*LISTENING"
  if ($matches) {
    foreach ($m in $matches) {
      $procId = $m.ToString() -replace '.*\s+(\d+)$', '$1'
      if ($procId -match '^\d+$') { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue }
    }
  }
}

# -- Start backend in a minimized window --------------------------------------
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodePath) {
  $nodePath = "$env:ProgramFiles\nodejs\node.exe"
}

Start-Process powershell -ArgumentList `
  "-NoProfile -WindowStyle Minimized -Command `"Set-Location '$Backend'; & '$nodePath' server.js`"" `
  -WindowStyle Minimized

# -- Start frontend in a minimized window -------------------------------------
Start-Process powershell -ArgumentList `
  "-NoProfile -WindowStyle Minimized -Command `"& '$Root\serve-finance.ps1'`"" `
  -WindowStyle Minimized

# -- Wait for services to be ready --------------------------------------------
Write-Host "Starting FinDash services..." -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 15; $i++) {
  Start-Sleep -Milliseconds 600
  try {
    $r = Invoke-WebRequest "http://localhost:8081" -UseBasicParsing -TimeoutSec 1
    if ($r.StatusCode -eq 200) { $ready = $true; break }
  } catch {}
}
if (-not $ready) { Write-Host "  (Frontend taking longer than usual - continuing anyway)" -ForegroundColor Yellow }

# -- Open browser --------------------------------------------------------------
Write-Host "Opening browser..." -ForegroundColor Green
Start-Process "http://localhost:8081"

# -- Keep window open ----------------------------------------------------------
Write-Host ""
Write-Host "  ======================================" -ForegroundColor DarkCyan
Write-Host "      FinDash Financial Terminal LIVE   " -ForegroundColor Cyan
Write-Host "      http://localhost:8081             " -ForegroundColor Green
Write-Host "      Close this window to stop.        " -ForegroundColor Gray
Write-Host "  ======================================" -ForegroundColor DarkCyan
Write-Host ""

while ($true) { Start-Sleep -Seconds 1 }
