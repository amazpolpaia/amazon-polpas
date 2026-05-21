@echo off
setlocal EnableExtensions
title Amazon Polpas - Instalar PostgreSQL

echo.
echo  ============================================
echo   INSTALAR PostgreSQL (necessario no passo 3)
echo  ============================================
echo.
echo  O passo 3 precisa do PostgreSQL instalado.
echo  Ele guarda os dados do sistema (fornecedores, lotes, etc).
echo.
echo  PASSO A PASSO:
echo.
echo  1. Vou abrir o site de download no navegador.
echo  2. Baixe "PostgreSQL" para Windows (versao 16 ou 17).
echo  3. Execute o instalador e clique Next em tudo.
echo  4. IMPORTANTE: anote a senha que voce criar para o usuario "postgres".
echo  5. Deixe a porta 5432 (padrao).
echo  6. No final, pode desmarcar "Stack Builder" se aparecer.
echo  7. Apos instalar, execute de novo: IMPORTAR-BANCO.bat
echo.
echo  ALTERNATIVA (sem linha de comando):
echo  Abra o arquivo IMPORTAR-BANCO-PGADMIN.txt nesta pasta.
echo.
pause
start https://www.postgresql.org/download/windows/
echo.
echo  Site aberto. Apos instalar, feche esta janela e rode IMPORTAR-BANCO.bat
pause
