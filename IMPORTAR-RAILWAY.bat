@echo off
setlocal EnableExtensions
title Amazon Polpas - Importar banco no Railway

set "RAIZ=%~dp0"
cd /d "%RAIZ%"

echo.
echo  ============================================
echo   IMPORTAR BANCO NO RAILWAY (forma direta)
echo  ============================================
echo.
echo  Antes: copie a URL no Railway
echo    Postgres -^> Connect -^> Public Network
echo    (postgresql://postgres:...@...railway.app:.../railway)
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%RAIZ%scripts\importar-railway.ps1"
echo.
pause
