@echo off
title Smart Bus ICTU - Dev Server (Localhost)
cd /d "%~dp0"
echo ==========================================================
echo   SMART BUS TICKETING SYSTEM - ICTU
echo   Khoi dong song song Backend (3001) + Frontend (3000)
echo ==========================================================
node scripts/start-dev.mjs
pause
