param(
    [string]$SqlFile,
    [string]$DbPass
)

$ErrorActionPreference = 'Stop'

function Find-Psql {
    $cmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $roots = @(
        "${env:ProgramFiles}\PostgreSQL",
        "${env:ProgramFiles(x86)}\PostgreSQL"
    )

    foreach ($root in $roots) {
        if (-not (Test-Path $root)) { continue }
        Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
            ForEach-Object {
                $exe = Join-Path $_.FullName 'bin\psql.exe'
                if (Test-Path $exe) { return $exe }
            }
    }

    return $null
}

$psql = Find-Psql
if (-not $psql) {
    Write-Host ''
    Write-Host ' [ERRO] PostgreSQL nao encontrado neste computador.' -ForegroundColor Red
    Write-Host ''
    Write-Host ' Voce precisa INSTALAR o PostgreSQL antes do passo 3:'
    Write-Host '   1. Execute: INSTALAR-POSTGRESQL.bat'
    Write-Host '   2. Depois execute: IMPORTAR-BANCO.bat novamente'
    Write-Host ''
    exit 1
}

Write-Host " Usando: $psql"
$env:PGPASSWORD = $DbPass

& $psql -U postgres -h localhost -p 5432 -tc "SELECT 1 FROM pg_database WHERE datname = 'amazon_polpas'" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host ' [ERRO] Nao conectou no PostgreSQL. Verifique:' -ForegroundColor Red
    Write-Host '   - Servico PostgreSQL esta rodando?'
    Write-Host '   - Senha do usuario postgres esta correta?'
    exit 1
}

$exists = & $psql -U postgres -h localhost -p 5432 -tc "SELECT 1 FROM pg_database WHERE datname = 'amazon_polpas'"
if ($exists -notmatch '1') {
    Write-Host ' Criando banco amazon_polpas...'
    & $psql -U postgres -h localhost -p 5432 -c 'CREATE DATABASE amazon_polpas;'
    if ($LASTEXITCODE -ne 0) {
        Write-Host ' [ERRO] Nao foi possivel criar o banco.' -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host ' Banco amazon_polpas ja existe.'
}

Write-Host ' Importando tabelas (aguarde)...'
& $psql -U postgres -h localhost -p 5432 -d amazon_polpas -f $SqlFile
if ($LASTEXITCODE -ne 0) {
    Write-Host ' [ERRO] Falha na importacao do SQL.' -ForegroundColor Red
    Write-Host ' Se ja importou antes, pode ignorar erros de "ja existe".'
    exit 1
}

Write-Host ''
Write-Host ' Banco importado com sucesso!' -ForegroundColor Green
exit 0
