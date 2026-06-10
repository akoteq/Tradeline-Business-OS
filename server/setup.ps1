# setup.ps1 — Run this once after PostgreSQL is installed
# It creates the database, generates Prisma types, runs migrations, and seeds data.

$ErrorActionPreference = "Stop"

Write-Host "`n=== Tradeline/BAPX Database Setup ===" -ForegroundColor Cyan

# Find psql
$pgBin = "C:\Program Files\PostgreSQL\17\bin"
$psql = Join-Path $pgBin "psql.exe"
if (-not (Test-Path $psql)) {
    # Try version 16
    $psql = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
}
if (-not (Test-Path $psql)) {
    Write-Error "Cannot find psql.exe. Make sure PostgreSQL is installed."
    exit 1
}

Write-Host "`n1. Creating database..." -ForegroundColor Yellow

# Create the database (ignore error if already exists)
$env:PGPASSWORD = "postgres"
& $psql -U postgres -c "CREATE DATABASE tradeline_bapx;" 2>&1 | Out-Null
Write-Host "   Database 'tradeline_bapx' ready." -ForegroundColor Green

# 2. Write .env if it doesn't exist or update DATABASE_URL
Write-Host "`n2. Checking .env..." -ForegroundColor Yellow
$envPath = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envPath)) {
    @"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tradeline_bapx"
PORT=4000
CLIENT_URL=http://localhost:3000
NODE_ENV=development
"@ | Out-File -FilePath $envPath -Encoding utf8
    Write-Host "   Created .env" -ForegroundColor Green
} else {
    Write-Host "   .env exists" -ForegroundColor Green
}

# 3. Generate Prisma client
Write-Host "`n3. Generating Prisma client..." -ForegroundColor Yellow
pnpm prisma generate
Write-Host "   Done" -ForegroundColor Green

# 4. Run migrations
Write-Host "`n4. Running database migrations..." -ForegroundColor Yellow
pnpm prisma migrate dev --name init
Write-Host "   Done" -ForegroundColor Green

# 5. Seed data
Write-Host "`n5. Seeding data from Excel files..." -ForegroundColor Yellow
pnpm db:seed
Write-Host "   Done" -ForegroundColor Green

Write-Host "`n=== Setup complete! ===" -ForegroundColor Cyan
Write-Host "Run 'pnpm dev' from the project root to start both servers.`n" -ForegroundColor White
