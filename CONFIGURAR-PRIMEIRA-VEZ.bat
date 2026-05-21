@echo off
setlocal EnableExtensions
title Amazon Polpas - Configuracao inicial

set "RAIZ=%~dp0"
set "API=%RAIZ%files\api_amazon_polpas\api"

echo.
echo  ============================================
echo   AMAZON POLPAS - Configuracao inicial
echo  ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo  [ERRO] Instale o Node.js: https://nodejs.org
    pause
    exit /b 1
)

if not exist "%API%\.env.example" (
    echo  [ERRO] Pasta da API nao encontrada.
    echo  Caminho esperado:
    echo  %API%
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%RAIZ%scripts\configurar-env.ps1" -ApiDir "%API%"
if errorlevel 1 (
    pause
    exit /b 1
)

echo.
echo  Instalando dependencias da API...
cd /d "%API%"
call npm install
if errorlevel 1 (
    echo  [ERRO] Falha no npm install.
    pause
    exit /b 1
)

echo.
echo  Proximo passo: IMPORTAR-BANCO.bat
echo  Depois: INICIAR-SISTEMA.bat
echo.
pause
