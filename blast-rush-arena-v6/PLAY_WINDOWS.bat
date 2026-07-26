@echo off
setlocal
cd /d "%~dp0"
where deno >nul 2>nul
if errorlevel 1 (
  echo.
  echo Deno is not installed.
  echo Install it with this PowerShell command:
  echo   irm https://deno.land/install.ps1 ^| iex
  echo.
  echo Then close this window, open a new terminal, and run PLAY_WINDOWS.bat again.
  pause
  exit /b 1
)
start "Blast Rush Arena Server" cmd /k "cd /d \"%~dp0\" && deno task start"
timeout /t 2 /nobreak >nul
start "" "http://localhost:8000"
echo Blast Rush Arena is opening at http://localhost:8000
exit /b 0
