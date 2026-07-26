@echo off
setlocal
cd /d "%~dp0"
where deno >nul 2>nul || (echo Install Deno first: irm https://deno.land/install.ps1 ^| iex & pause & exit /b 1)
start "Blast Rush Arena Dev Server" cmd /k "cd /d \"%~dp0\" && deno task dev"
timeout /t 2 /nobreak >nul
start "" "http://localhost:8000"
