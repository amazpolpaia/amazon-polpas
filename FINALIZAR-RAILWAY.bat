@echo off
setlocal EnableExtensions
title Amazon Polpas - Só usuarios Igor/Joao no Railway

set "RAIZ=%~dp0"
cd /d "%RAIZ%"

echo.
echo  Atualiza SOMENTE usuarios (Joao + Igor) no Postgres da nuvem.
echo  Cole a URL: Postgres -^> Connect -^> Public Network
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%RAIZ%scripts\importar-railway.ps1" -SomenteFinalizar
echo.
pause
