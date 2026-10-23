@echo off
cd /d "%~dp0"

rem MAX uses Russian Trusted Root CA (absent in bun's bundled CA list).
rem certs/max-ca-bundle.pem is loaded via NODE_EXTRA_CA_CERTS - nothing installed on the system.
set "NODE_EXTRA_CA_CERTS=%~dp0certs\max-ca-bundle.pem"

where bun >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Bun not found. Install it from https://bun.sh
    pause
    exit /b 1
)

if not exist .env (
    echo [ERROR] .env file not found. Copy .env.example to .env and set BOT_TOKEN.
    pause
    exit /b 1
)

if not exist node_modules (
    echo Installing dependencies...
    bun install
)

echo Starting bot...
bun run src/bot.ts
pause
