@echo off
setlocal EnableExtensions

cd /d "%~dp0"

echo.
echo === Certificate Fraud Detection — stopping ===
echo.
docker compose down
echo.
echo Containers stopped.
