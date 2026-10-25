@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 22 LTS is required. Install it from nodejs.org and restart this script.& pause& exit /b 1)
where cargo >nul 2>nul || (echo Rust stable and Visual Studio C++ build tools are required for a source checkout.& echo Install the official tools first, or use a packaged Windows build.& pause& exit /b 1)
node scripts/start.mjs
if errorlevel 1 pause
