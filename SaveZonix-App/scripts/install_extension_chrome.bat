@echo off
setlocal enabledelayedexpansion
title SaveZonix - 1-Click Extension Loader

echo =======================================================
echo          SaveZonix 1-Click Browser Extension Loader
echo =======================================================
echo.

:: 1. Locate Extension Directory
set "EXT_DIR=%~dp0..\Extension"
if not exist "%EXT_DIR%\manifest.json" (
    set "EXT_DIR=%~dp0Extension"
)
if not exist "%EXT_DIR%\manifest.json" (
    set "EXT_DIR=%LOCALAPPDATA%\Programs\SaveZonix\Extension"
)

if not exist "%EXT_DIR%\manifest.json" (
    echo [ERROR] Extension folder not found!
    pause
    exit /b 1
)

echo [OK] Extension located at: "%EXT_DIR%"
echo.

:: 2. Find Chrome, Edge or Brave
set "BROWSER_EXE="

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
) else if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_EXE=%LocalAppData%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
) else if exist "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe" (
    set "BROWSER_EXE=%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"
)

if "%BROWSER_EXE%"=="" (
    set "BROWSER_EXE=chrome.exe"
)

echo [OK] Launching Browser with SaveZonix Extension loaded...
start "" "%BROWSER_EXE%" --load-extension="%EXT_DIR%" "http://localhost:5000"

echo [SUCCESS] Done! SaveZonix Extension is now active in your browser.
timeout /t 3 >nul
exit /b 0
