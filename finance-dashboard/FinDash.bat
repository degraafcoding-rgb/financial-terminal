@echo off
echo Starting FinDash...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\ander\.gemini\antigravity\scratch\finance-dashboard\launch-findash.ps1"
echo.
echo [!] PowerShell exited with code: %ERRORLEVEL%
pause
