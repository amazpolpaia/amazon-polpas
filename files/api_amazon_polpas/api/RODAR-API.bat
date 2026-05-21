@echo off
cd /d "%~dp0"
title Amazon Polpas API - NAO FECHE ESTA JANELA
echo.
echo  Iniciando API Amazon Polpas...
echo  Pasta: %CD%
echo.
npm run dev
echo.
echo  API encerrada. Pressione uma tecla para fechar.
pause >nul
