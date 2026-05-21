@echo off
setlocal EnableExtensions
title Amazon Polpas - Iniciar sistema

set "RAIZ=%~dp0"
set "API=%RAIZ%files\api_amazon_polpas\api"
set "HTML=%RAIZ%files\amazon_polpas_app.html"
set "RODAR=%API%\RODAR-API.bat"

echo.
echo  ============================================
echo   AMAZON POLPAS - Iniciar sistema (passo 8)
echo  ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo  [ERRO] Node.js nao encontrado.
    echo  Instale: https://nodejs.org
    pause
    exit /b 1
)

if not exist "%RODAR%" (
    echo  [ERRO] Arquivo RODAR-API.bat nao encontrado.
    pause
    exit /b 1
)

if not exist "%API%\.env" (
    echo  [ERRO] Falta o .env. Execute CONFIGURAR-PRIMEIRA-VEZ.bat
    pause
    exit /b 1
)

if not exist "%API%\node_modules\" (
    echo  Instalando dependencias...
    cd /d "%API%"
    call npm install
)

echo  [1/3] Verificando se a API ja esta rodando...
powershell -NoProfile -Command "try{(Invoke-WebRequest -Uri http://localhost:3000/health -UseBasicParsing -TimeoutSec 3)|Out-Null;exit 0}catch{exit 1}"
if not errorlevel 1 (
    echo  OK - API ja esta ativa.
    goto abrir_tela
)

echo  [2/3] Abrindo janela da API...
echo        IMPORTANTE: nao feche a janela "Amazon Polpas API"
start "Amazon Polpas API" cmd /k call "%RODAR%"

echo  Aguardando API iniciar...
set TENT=0
:aguardar
set /a TENT+=1
echo        tentativa %TENT% de 20...
timeout /t 3 /nobreak >nul
powershell -NoProfile -Command "try{(Invoke-WebRequest -Uri http://localhost:3000/health -UseBasicParsing -TimeoutSec 3)|Out-Null;exit 0}catch{exit 1}"
if not errorlevel 1 goto api_ok
if %TENT% LSS 20 goto aguardar

echo.
echo  [AVISO] API nao respondeu ainda.
echo  Olhe a janela "Amazon Polpas API" - tem erro vermelho?
echo  Causas: senha errada no .env ou banco nao importado.
goto abrir_tela

:api_ok
echo  OK - API funcionando em http://localhost:3000

:abrir_tela
echo.
echo  [3/3] Abrindo tela no navegador...
if not exist "%HTML%" (
    echo  [ERRO] HTML nao encontrado.
    pause
    exit /b 1
)

start "" "%HTML%"
timeout /t 2 /nobreak >nul

echo.
echo  ============================================
echo   Se o navegador NAO abriu:
echo   - Duplo clique em ABRIR-TELA.bat
echo.
echo   URL da API no login: http://localhost:3000
echo   Login: joao@amazonpolpas.com.br
echo   Senha: Admin@2025
echo  ============================================
echo.
pause
