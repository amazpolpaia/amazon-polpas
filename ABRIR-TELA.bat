@echo off
set "HTML=%~dp0files\amazon_polpas_app.html"
if not exist "%HTML%" (
    echo Arquivo nao encontrado.
    pause
    exit /b 1
)
echo Abrindo: %HTML%
start "" "%HTML%"
timeout /t 1 /nobreak >nul
echo.
echo Se nao abriu, copie este caminho no navegador:
echo %HTML%
pause
