@echo off
title LinkedIn Manager
color 0A
setlocal

set "BACKEND=C:\Users\slevin\LINKEDIN-APP-WEB\backend"

echo.
echo  ==========================================
echo   LinkedIn Manager - Iniciando...
echo  ==========================================
echo.

:: ── 1. Node.js ────────────────────────────────────────────────────
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo  [ERROR] Node.js no esta instalado.
    echo  Descargalo en: https://nodejs.org
    echo.
    pause
    exit /b 1
)
for /f "delims=" %%v in ('node --version') do set NODE_VER=%%v
echo  [OK] Node.js %NODE_VER%

:: ── 2. node_modules ───────────────────────────────────────────────
cd /d "%BACKEND%"

if not exist "node_modules\" (
    echo  [INFO] Instalando dependencias (primera vez puede demorar)...
    npm install
    if %errorlevel% neq 0 (
        color 0C
        echo  [ERROR] Fallo npm install.
        pause
        exit /b 1
    )
    echo  [OK] Dependencias instaladas
) else (
    :: Verificar que better-sqlite3 este instalado
    if not exist "node_modules\better-sqlite3\" (
        echo  [INFO] Instalando better-sqlite3...
        npm install better-sqlite3
    )
    echo  [OK] Dependencias listas
)

:: ── 3. Puerto 8000 libre ──────────────────────────────────────────
netstat -ano | findstr ":8000 " >nul 2>nul
if %errorlevel% equ 0 (
    echo  [INFO] Cerrando proceso anterior en puerto 8000...
    for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8000 "') do (
        taskkill /PID %%p /F >nul 2>nul
    )
    timeout /t 1 /nobreak >nul
)

:: ── 4. Arrancar servidor + abrir browser ─────────────────────────
echo.
echo  [OK] Arrancando servidor en http://localhost:8000
echo  [INFO] Presiona Ctrl+C en esta ventana para detenerlo
echo  ==========================================
echo.

start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:8000"

node server.js

echo.
color 0C
echo  [ERROR] El servidor se detuvo. Revisa el mensaje de error arriba.
echo.
pause
