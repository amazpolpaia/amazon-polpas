param(
    [string]$DatabaseUrl,
    [switch]$SomenteFinalizar
)

$ErrorActionPreference = 'Stop'
$Raiz = Split-Path $PSScriptRoot -Parent
$SqlCompleto = Join-Path $Raiz 'files\amazon_polpas_banco.sql'
$SqlFinalizar = Join-Path $Raiz 'files\api_amazon_polpas\api\sql\RAILWAY-FINALIZAR.sql'

function Find-Psql {
    $cmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    foreach ($root in @("${env:ProgramFiles}\PostgreSQL", "${env:ProgramFiles(x86)}\PostgreSQL")) {
        if (-not (Test-Path $root)) { continue }
        Get-ChildItem $root -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $exe = Join-Path $_.FullName 'bin\psql.exe'
            if (Test-Path $exe) { return $exe }
        }
    }
    return $null
}

Write-Host ''
Write-Host ' ============================================'
Write-Host '  IMPORTAR BANCO NO RAILWAY (direto)'
Write-Host ' ============================================'
Write-Host ''

$psql = Find-Psql
if (-not $psql) {
    Write-Host ' [ERRO] psql nao encontrado.' -ForegroundColor Red
    Write-Host ''
    Write-Host ' Instale o PostgreSQL no PC (so precisa uma vez):'
    Write-Host '   https://www.postgresql.org/download/windows/'
    Write-Host '   Marque "Command Line Tools" na instalacao.'
    Write-Host '   Depois rode IMPORTAR-RAILWAY.bat de novo.'
    Write-Host ''
    exit 1
}

if (-not $DatabaseUrl) {
    Write-Host ' Cole a URL de conexao do Railway:'
    Write-Host '   Postgres -> Connect -> "Public Network" ou DATABASE_URL'
    Write-Host '   Exemplo: postgresql://postgres:senha@host.railway.app:5432/railway'
    Write-Host ''
    $DatabaseUrl = Read-Host 'URL'
}

$DatabaseUrl = $DatabaseUrl.Trim().Trim('"')
if ($DatabaseUrl -notmatch '^postgres') {
    Write-Host ' [ERRO] URL invalida. Deve comecar com postgresql://' -ForegroundColor Red
    exit 1
}

if ($DatabaseUrl -notmatch 'sslmode=') {
    $DatabaseUrl += $(if ($DatabaseUrl -match '\?') { '&' } else { '?' }) + 'sslmode=require'
}

if (-not $SomenteFinalizar) {
    Write-Host ''
    Write-Host ' Conectando e importando banco completo (1-2 min)...'
    Write-Host ''
    & $psql $DatabaseUrl -v ON_ERROR_STOP=0 -f $SqlCompleto 2>&1 | Out-Host
    if ($LASTEXITCODE -gt 1) {
        Write-Host ' [AVISO] Erros "ja existe" sao normais se o banco ja tinha tabelas.' -ForegroundColor Yellow
    }
    Write-Host ''
}

Write-Host ' Ajustando usuarios Igor e Joao...'
& $psql $DatabaseUrl -v ON_ERROR_STOP=1 -f $SqlFinalizar
if ($LASTEXITCODE -ne 0) {
    Write-Host ' [ERRO] Falha ao finalizar usuarios.' -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host ' Pronto! Banco no Railway atualizado.' -ForegroundColor Green
Write-Host ''
Write-Host ' Login no site:'
Write-Host '   igor.queiroz@amazonpolpas.com.br  /  Iqs563160'
Write-Host '   joao@amazonpolpas.com.br          /  Admin@2025'
Write-Host ''
exit 0
