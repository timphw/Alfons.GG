@echo off
rem Alfons.GG Companion starten (liegt im selben Ordner wie alfons-companion.mjs)
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js fehlt - bitte von https://nodejs.org installieren. & pause & exit /b 1)
node alfons-companion.mjs run
pause
