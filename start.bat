@echo off
setlocal EnableExtensions

cd /d "%~dp0"

echo.
echo === Certificate Fraud Detection — starting ===
echo.

if not exist "backend\.env" (
  echo [setup] backend\.env missing — copying from backend\.env.example
  copy /Y "backend\.env.example" "backend\.env" >nul
  echo [setup] Edit backend\.env and add your API keys before verifying documents.
)

if not exist "frontend\.env" (
  echo [setup] frontend\.env missing — copying from frontend\.env.example
  copy /Y "frontend\.env.example" "frontend\.env" >nul
)

echo [docker] docker compose up --build
echo.
docker compose up --build
