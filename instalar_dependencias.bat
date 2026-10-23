@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==========================================
echo   COMUNICCNC - INSTALANDO DEPENDENCIAS
echo ==========================================
where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js nao encontrado. Instale o Node.js LTS em https://nodejs.org/
  pause
  exit /b 1
)
node --version
npm --version
npm install
if errorlevel 1 (
  echo ERRO ao instalar. Confira a internet e as mensagens acima.
  pause
  exit /b 1
)
echo.
echo Dependencias instaladas com sucesso.
pause
