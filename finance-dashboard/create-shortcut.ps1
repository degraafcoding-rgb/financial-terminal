$shell = New-Object -ComObject WScript.Shell
$desktop = [System.Environment]::GetFolderPath('Desktop')
$lnk = $shell.CreateShortcut("$desktop\FinDash.lnk")
$lnk.TargetPath = 'C:\Users\ander\.gemini\antigravity\scratch\finance-dashboard\FinDash.bat'
$lnk.WorkingDirectory = 'C:\Users\ander\.gemini\antigravity\scratch\finance-dashboard'
$lnk.Description = 'Launch FinDash Financial Terminal'
$lnk.IconLocation = '%SystemRoot%\System32\shell32.dll,13'
$lnk.Save()
Write-Host 'Desktop shortcut created!' -ForegroundColor Green
