param(
    [Parameter(Mandatory = $true)]
    [string]$ApiDir
)

$ErrorActionPreference = 'Stop'
$envFile = Join-Path $ApiDir '.env'

Write-Host ''
Write-Host ' Este assistente cria o arquivo .env da API.'
Write-Host ' Voce precisa da senha do PostgreSQL (usuario postgres).'
Write-Host ''

$dbPass = Read-Host 'Digite a senha do PostgreSQL (postgres)'
if ([string]::IsNullOrWhiteSpace($dbPass)) {
    Write-Host ' [ERRO] Senha nao pode ficar vazia.' -ForegroundColor Red
    exit 1
}

$jwtInput = Read-Host 'Chave secreta para login (Enter = gerar automaticamente)'
if ([string]::IsNullOrWhiteSpace($jwtInput)) {
    $jwtSecret = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
    Write-Host ' Chave gerada automaticamente.'
} else {
    $jwtSecret = $jwtInput
}

$lines = @(
    'DB_HOST=localhost',
    'DB_PORT=5432',
    'DB_NAME=amazon_polpas',
    'DB_USER=postgres',
    "DB_PASSWORD=$dbPass",
    "JWT_SECRET=$jwtSecret",
    'JWT_EXPIRES_IN=8h',
    'PORT=3000',
    'NODE_ENV=development'
)

$lines | Set-Content -Path $envFile -Encoding ASCII
Write-Host ''
Write-Host ' OK - .env criado em:' -ForegroundColor Green
Write-Host $envFile
