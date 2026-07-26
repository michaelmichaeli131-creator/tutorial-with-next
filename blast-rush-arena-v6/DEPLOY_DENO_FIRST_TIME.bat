@echo off
setlocal
cd /d "%~dp0"
where deno >nul 2>nul
if errorlevel 1 (
  echo Deno is not installed.
  echo Open PowerShell and run:
  echo   irm https://deno.land/install.ps1 ^| iex
  pause
  exit /b 1
)
echo [1/3] Building client...
call deno task build || goto :fail
echo [2/3] Checking project...
call deno task check || goto :fail
echo [3/3] Opening Deno Deploy setup...
echo You will need to sign in in your browser and choose an Organization and app name.
call deno deploy create .
if errorlevel 1 goto :fail
echo.
echo Initial deployment command completed. Review the HTTPS URL above.
pause
exit /b 0
:fail
echo.
echo Deployment preparation failed. Review the error above.
pause
exit /b 1
