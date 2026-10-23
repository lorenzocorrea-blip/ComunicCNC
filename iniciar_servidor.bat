@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Instale o Node.js LTS em https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\express" (
  echo Dependencias nao instaladas. Execute instalar_dependencias.bat primeiro.
  pause
  exit /b 1
)
node server.js
pause
