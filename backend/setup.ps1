# LinkedIn Manager Backend — Setup & Launch
# Ejecutar con: powershell -ExecutionPolicy Bypass -File setup.ps1

$ErrorActionPreference = "Stop"
$BackendDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LinkedIn Manager Backend Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Ir al directorio backend
Set-Location $BackendDir

# Limpiar node_modules viejos si existen (para evitar error EPERM)
if (Test-Path "node_modules") {
    Write-Host "[0/3] Limpiando instalacion anterior..." -ForegroundColor Gray
    Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
    if (Test-Path "package-lock.json") { Remove-Item -Force "package-lock.json" -ErrorAction SilentlyContinue }
    Write-Host "OK - Limpieza completada" -ForegroundColor Green
    Write-Host ""
}

# 1. Instalar dependencias npm
Write-Host "[1/3] Instalando dependencias npm..." -ForegroundColor Yellow
Write-Host "      (sin compilacion nativa - Node:sqlite built-in)" -ForegroundColor Gray
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR en npm install. Codigo: $LASTEXITCODE" -ForegroundColor Red
    exit 1
}
Write-Host "OK - Dependencias instaladas" -ForegroundColor Green
Write-Host ""

# 2. Instalar Chromium para Playwright
Write-Host "[2/3] Instalando Chromium para Playwright..." -ForegroundColor Yellow
Write-Host "      (descarga ~130MB, puede tardar unos minutos)" -ForegroundColor Gray
npx playwright install chromium
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR instalando Chromium" -ForegroundColor Red
    exit 1
}
Write-Host "OK - Chromium instalado" -ForegroundColor Green
Write-Host ""

# 3. Verificar .env
if (-Not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "AVISO: .env creado desde .env.example" -ForegroundColor Magenta
    Write-Host ""
}

# 4. Arrancar el servidor
Write-Host "[3/3] Arrancando servidor..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  >> Frontend + API: http://localhost:8000" -ForegroundColor Cyan
Write-Host "  >> Health check:   http://localhost:8000/api/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Ctrl+C para detener." -ForegroundColor Gray
Write-Host ""

npm run dev
