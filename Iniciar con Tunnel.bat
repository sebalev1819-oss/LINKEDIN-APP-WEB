@echo off
title LinkedIn Manager + Cloudflare Tunnel
color 0A
setlocal enabledelayedexpansion

set "BACKEND=C:\Users\slevin\LINKEDIN-APP-WEB\backend"
set "LOGFILE=%TEMP%\cloudflared-linkedin.log"

echo.
echo  ==========================================
echo   LinkedIn Manager + Tunnel HTTPS
echo  ==========================================
echo.

:: ── 1. Node.js ────────────────────────────────────────────────────
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo  [ERROR] Node.js no instalado. https://nodejs.org
    pause & exit /b 1
)

:: ── 2. cloudflared ────────────────────────────────────────────────
where cloudflared >nul 2>nul
if %errorlevel% neq 0 (
    echo  [INFO] cloudflared no encontrado. Instalando via winget...
    winget install --id Cloudflare.cloudflared -e --silent --accept-source-agreements --accept-package-agreements
    if !errorlevel! neq 0 (
        color 0C
        echo.
        echo  [ERROR] No se pudo instalar cloudflared via winget.
        echo  Descarga manual: https://github.com/cloudflare/cloudflared/releases
        echo  Buscar: cloudflared-windows-amd64.exe
        echo  Copiar a: C:\Windows\System32\cloudflared.exe
        pause & exit /b 1
    )
    echo  [OK] cloudflared instalado. Abri una terminal nueva y re-ejecuta este .bat
    pause & exit /b 0
)
echo  [OK] cloudflared presente

:: ── 3. Backend ────────────────────────────────────────────────────
if not exist "%BACKEND%\node_modules\" (
    echo  [INFO] Instalando dependencias del backend...
    cd /d "%BACKEND%" && npm install
    if !errorlevel! neq 0 ( color 0C & echo  [ERROR] npm install fallo & pause & exit /b 1 )
)
echo  [OK] Dependencias backend listas

:: ── 4. Liberar puerto 8000 ────────────────────────────────────────
netstat -ano | findstr ":8000 " >nul 2>nul
if %errorlevel% equ 0 (
    echo  [INFO] Cerrando proceso anterior en puerto 8000...
    for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8000 "') do taskkill /PID %%p /F >nul 2>nul
    timeout /t 1 /nobreak >nul
)

:: ── 5. Arrancar backend en nueva ventana ──────────────────────────
echo  [OK] Arrancando backend en http://localhost:8000
start "LinkedIn Backend" cmd /k "cd /d %BACKEND% && node server.js"
timeout /t 4 /nobreak >nul

:: ── 6. Arrancar cloudflared y capturar URL ────────────────────────
echo  [OK] Abriendo tunel HTTPS...
if exist "%LOGFILE%" del "%LOGFILE%"
start "Cloudflare Tunnel" cmd /k "cloudflared tunnel --url http://localhost:8000 --logfile %LOGFILE%"

:: Esperar a que aparezca la URL en el log
echo  [INFO] Esperando URL publica (puede tardar 10-30 seg)...
set "PUBURL="
for /l %%i in (1,1,30) do (
    timeout /t 1 /nobreak >nul
    if exist "%LOGFILE%" (
        for /f "tokens=*" %%L in ('findstr /C:"trycloudflare.com" "%LOGFILE%" 2^>nul') do (
            set "line=%%L"
            for %%W in (!line!) do (
                echo %%W | findstr /C:"https://" | findstr /C:".trycloudflare.com" >nul && set "PUBURL=%%W"
            )
        )
        if defined PUBURL goto :found
    )
)

:found
echo.
echo  ==========================================
if defined PUBURL (
    color 0A
    echo   TUNEL ACTIVO
    echo  ==========================================
    echo.
    echo   URL publica: !PUBURL!
    echo.
    echo   1. Abri https://linkedin-manager-selmi.netlify.app
    echo   2. F12 -^> Console -^> pega esto:
    echo.
    echo      localStorage.setItem('apiBase','!PUBURL!/api'); location.reload();
    echo.
    echo  Copiando la URL al portapapeles...
    echo !PUBURL!/api | clip
    echo  [OK] !PUBURL!/api copiado al portapapeles
) else (
    color 0E
    echo   No se pudo extraer la URL del log.
    echo   Mirala manualmente en la ventana "Cloudflare Tunnel"
    echo   Busca: https://xxxxx.trycloudflare.com
)
echo  ==========================================
echo.
echo  Para detener todo: cerra las dos ventanas (Backend + Tunnel)
echo.
pause
