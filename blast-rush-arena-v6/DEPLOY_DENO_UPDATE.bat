@echo off
setlocal
cd /d "%~dp0"
where deno >nul 2>nul || (echo Install Deno first. & pause & exit /b 1)
call deno task check || goto :fail
call deno task test || goto :fail
call deno deploy --prod
if errorlevel 1 goto :fail
echo Production deployment completed.
pause
exit /b 0
:fail
echo Deployment failed. Review the error above.
pause
exit /b 1
