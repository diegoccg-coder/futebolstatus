@echo off
chcp 65001 >nul
title Pelada - servidor local
cd /d "%~dp0"

if not exist "node_modules\" (
  echo [1/2] Instalando dependencias ^(npm install^)...
  call npm install
  if errorlevel 1 (
    echo.
    echo Erro ao instalar. Verifique se o Node.js esta instalado: https://nodejs.org
    pause
    exit /b 1
  )
)

echo.
echo [2/2] Abrindo o aplicativo em http://localhost:3000
echo Feche esta janela ou pressione Ctrl+C para parar o servidor.
echo.
call npm run dev

pause
