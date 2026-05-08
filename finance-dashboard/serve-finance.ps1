# serve-finance.ps1 — Static file server for finance-dashboard frontend
$Port    = 8081
$RootDir = Resolve-Path "$PSScriptRoot\frontend"
$Url     = "http://localhost:$Port/"

$MimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($Url)
$listener.Start()

Write-Host ""
Write-Host "  FinDash frontend running!" -ForegroundColor Cyan
Write-Host "  Open: $Url" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

# Browser is opened by launch-findash.ps1 after readiness check

try {
  while ($listener.IsListening) {
    $ctx  = $listener.GetContext()
    $req  = $ctx.Request
    $resp = $ctx.Response
    $local = $req.Url.LocalPath.TrimStart('/')
    if ($local -eq '') { $local = 'index.html' }
    $path = Join-Path $RootDir $local
    if (Test-Path $path -PathType Leaf) {
      $ext  = [IO.Path]::GetExtension($path)
      $mime = if ($MimeTypes[$ext]) { $MimeTypes[$ext] } else { 'application/octet-stream' }
      $bytes = [IO.File]::ReadAllBytes($path)
      $resp.ContentType = $mime
      $resp.ContentLength64 = $bytes.Length
      $resp.StatusCode = 200
      $resp.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $resp.StatusCode = 404
      $msg = [Text.Encoding]::UTF8.GetBytes("404 Not Found")
      $resp.OutputStream.Write($msg, 0, $msg.Length)
    }
    $resp.OutputStream.Close()
  }
} finally {
  $listener.Stop()
}
