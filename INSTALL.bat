@echo off
setlocal enabledelayedexpansion
title JWS Forms - Setup
cd /d "%~dp0"

echo.
echo   ================================================
echo      JWS Forms  -  Setup
echo   ================================================
echo.
echo   Folder: %CD%
echo.

set MISSING=0

REM ---------------------------------------------------------------- Node.js
where node >nul 2>&1
if errorlevel 1 (
  echo   [ X ]  Node.js is not installed.
  echo          Download the LTS installer from https://nodejs.org
  echo          Accept the defaults, then run this file again.
  set MISSING=1
) else (
  for /f "delims=" %%v in ('node -v') do set NODEV=%%v
  echo   [ OK ]  Node.js !NODEV!
)

REM ------------------------------------------------------------------- Rust
where cargo >nul 2>&1
if errorlevel 1 (
  echo   [ X ]  Rust is not installed.
  echo          Download rustup-init.exe from https://rustup.rs
  echo          Accept the defaults, then CLOSE this window, open a new one
  echo          and run this file again ^(Rust needs a fresh terminal^).
  set MISSING=1
) else (
  for /f "delims=" %%v in ('cargo -V') do set CARGOV=%%v
  echo   [ OK ]  !CARGOV!
)

REM ----------------------------------------------------- MSVC linker (link.exe)
where link.exe >nul 2>&1
if errorlevel 1 (
  echo   [ ? ]  The Microsoft C++ build tools were not found on the PATH.
  echo          They are still probably installed - this check only sees them
  echo          inside a "Developer Command Prompt". If the build later fails
  echo          with "link.exe not found", install them:
  echo            https://visualstudio.microsoft.com/visual-cpp-build-tools/
  echo          and tick "Desktop development with C++".
) else (
  echo   [ OK ]  Microsoft C++ build tools
)

echo.
if "%MISSING%"=="1" (
  echo   Install the missing items above, then run this file again.
  echo.
  pause
  exit /b 1
)

REM --------------------------------------------------------- npm install
echo   ------------------------------------------------
echo   Installing the app's dependencies...
echo   ^(first run takes a few minutes^)
echo   ------------------------------------------------
echo.
call npm install
if errorlevel 1 (
  echo.
  echo   Dependency install failed. Check your internet connection
  echo   and run this file again.
  echo.
  pause
  exit /b 1
)

echo.
echo   ================================================
echo      Ready. What would you like to do?
echo   ================================================
echo.
echo     [1]  Open the app now  ^(development mode^)
echo     [2]  Build the Windows installer .exe
echo     [3]  Nothing - exit
echo.
set /p CHOICE="   Type 1, 2 or 3 and press Enter: "

if "%CHOICE%"=="1" (
  echo.
  echo   Starting JWS Forms. The first launch compiles Rust and can take
  echo   5-15 minutes. Later launches are seconds. Keep this window open
  echo   while the app is running - closing it closes the app.
  echo.
  call npm run app
  goto :done
)

if "%CHOICE%"=="2" (
  REM The updater signing key lives one folder up, outside the git repo so it
  REM can never be committed by accident. Without it the release build stops
  REM with a signing error.
  set "KEYFILE=%~dp0..\jws-forms-updater.key"
  if exist "%~dp0..\jws-forms-updater.key" (
    set "TAURI_SIGNING_PRIVATE_KEY=%~dp0..\jws-forms-updater.key"
    set "TAURI_SIGNING_PRIVATE_KEY_PASSWORD="
    echo   [ OK ]  Updater signing key found.
  ) else (
    echo   [ X ]  jws-forms-updater.key is missing from the JWS FORMS folder.
    echo          The build will fail without it. Ask Claude for a new key.
    echo.
    pause
    exit /b 1
  )
  echo.
  echo   Building the installer. This compiles everything in release mode
  echo   and takes 20-40 minutes the first time.
  echo.
  call npm run release
  if errorlevel 1 (
    echo.
    echo   Build failed - see the messages above.
    echo.
    pause
    exit /b 1
  )
  echo.
  echo   ================================================
  echo      Done. Your installer is here:
  echo   ================================================
  echo.
  echo   %CD%\src-tauri\target\release\bundle\nsis\
  echo.
  echo   Opening that folder...
  start "" "%CD%\src-tauri\target\release\bundle\nsis"
  goto :done
)

:done
echo.
pause
