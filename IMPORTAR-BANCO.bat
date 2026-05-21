@echo off
setlocal EnableExtensions
title Amazon Polpas - Importar banco

set "RAIZ=%~dp0"
set "SQL=%RAIZ%files\amazon_polpas_banco.sql"

echo.
echo  ============================================
echo   AMAZON POLPAS - Importar banco PostgreSQL
echo  ============================================
echo.

if not exist "%SQL%" (
    echo  [ERRO] SQL nao encontrado:
    echo  %SQL%
    pause
    exit /b 1
)

set /p DB_PASS=Digite a senha do usuario postgres: 
if "%DB_PASS%"=="" (
    echo  Senha vazia.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%RAIZ%scripts\importar-banco.ps1" -SqlFile "%SQL%" -DbPass "%DB_PASS%"
if errorlevel 1 (
    echo.
    echo  --------------------------------------------
    echo  PostgreSQL nao instalado?
    echo  Execute: INSTALAR-POSTGRESQL.bat
    echo  Ou leia: IMPORTAR-BANCO-PGADMIN.txt
    echo  --------------------------------------------
    pause
    exit /b 1
)

echo.
echo  Usuarios de teste:
echo    joao@amazonpolpas.com.br / Admin@2025
echo.
echo  Proximo passo: INICIAR-SISTEMA.bat
echo.
pause
