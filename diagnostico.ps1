Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  LinkedIn Manager - Diagnóstico" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

$backendPath = "C:\Users\slevin\projects\linkedin-manager\backend"

# 1. Node.js
Write-Host "[1] Verificando Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    Write-Host "    OK: Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "    ERROR: Node.js no encontrado!" -ForegroundColor Red
}

# 2. npm modules
Write-Host "[2] Verificando node_modules..." -ForegroundColor Yellow
if (Test-Path "$backendPath\node_modules") {
    Write-Host "    OK: node_modules existe" -ForegroundColor Green
} else {
    Write-Host "    ERROR: node_modules no existe. Correr: npm install" -ForegroundColor Red
}

# 3. better-sqlite3 (dependencia faltante frecuente)
Write-Host "[3] Verificando better-sqlite3..." -ForegroundColor Yellow
if (Test-Path "$backendPath\node_modules\better-sqlite3") {
    Write-Host "    OK: better-sqlite3 instalado" -ForegroundColor Green
} else {
    Write-Host "    FALTA: better-sqlite3 no encontrado en node_modules" -ForegroundColor Red
    Write-Host "    Solucion: cd backend && npm install better-sqlite3" -ForegroundColor Yellow
}

# 4. Playwright browsers
Write-Host "[4] Verificando Playwright browsers..." -ForegroundColor Yellow
$playwrightCache = "$env:LOCALAPPDATA\ms-playwright"
if (Test-Path $playwrightCache) {
    $browsers = Get-ChildItem $playwrightCache -Directory | Select-Object -ExpandProperty Name
    Write-Host "    OK: Browsers instalados: $($browsers -join ', ')" -ForegroundColor Green
} else {
    Write-Host "    FALTA: Playwright browsers no instalados" -ForegroundColor Red
    Write-Host "    Solucion: cd backend && npx playwright install chromium" -ForegroundColor Yellow
}

# 5. .env file
Write-Host "[5] Verificando .env..." -ForegroundColor Yellow
if (Test-Path "$backendPath\.env") {
    Write-Host "    OK: .env existe" -ForegroundColor Green
} else {
    Write-Host "    ERROR: .env no existe. Copiar desde .env.example" -ForegroundColor Red
}

# 6. Puerto 8000 libre
Write-Host "[6] Verificando puerto 8000..." -ForegroundColor Yellow
$portInUse = netstat -ano | Select-String ":8000 "
if ($portInUse) {
    Write-Host "    OCUPADO: El puerto 8000 ya está en uso!" -ForegroundColor Red
    Write-Host "    $portInUse" -ForegroundColor Red
} else {
    Write-Host "    OK: Puerto 8000 libre" -ForegroundColor Green
}

# 7. Intentar arrancar el servidor y capturar el error
Write-Host ""
Write-Host "[7] Intentando arrancar el servidor (5 segundos)..." -ForegroundColor Yellow
Write-Host "    Si hay error, se mostrará aquí:" -ForegroundColor Gray
Write-Host ""

$job = Start-Job -ScriptBlock {
    Set-Location "C:\Users\slevin\projects\linkedin-manager\backend"
    node server.js 2>&1
}

Start-Sleep -Seconds 5
$output = Receive-Job $job
Stop-Job $job
Remove-Job $job

if ($output) {
    Write-Host $output -ForegroundColor White
} else {
    Write-Host "    (sin salida)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Diagnóstico completo" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Presiona Enter para salir"
