@echo off
setlocal
cd /d "%~dp0"
title billingapp
set PORT=3000

netstat -ano | findstr ":3000" >nul 2>nul
if not errorlevel 1 set PORT=3100

echo.
echo Starte billingapp...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js wurde nicht gefunden.
  echo Bitte zuerst Node.js installieren: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\express\package.json" (
  echo Installiere benoetigte Pakete...
  call npm install
  if errorlevel 1 (
    echo.
    echo Installation fehlgeschlagen.
    pause
    exit /b 1
  )
)

echo Die App ist gleich im Browser erreichbar:
echo - http://localhost:%PORT%
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$port = $env:PORT; $ips = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue ^| Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254*' } ^| Select-Object -ExpandProperty IPAddress -Unique); foreach ($ip in $ips) { Write-Output ('- http://{0}:{1}' -f $ip, $port) }"`) do echo %%I
echo.
echo Fuer das Smartphone bitte das Handy im selben WLAN verwenden.
echo Dieses Fenster offen lassen, solange die App laufen soll.
echo.

start "" http://localhost:%PORT%
call npm start

echo.
echo billingapp wurde beendet.
pause
