@echo off
title SaveZonix - 1-Click Sync Master Logo
color 0B
cd /d "%~dp0"
echo.
echo Running SaveZonix Master Logo Synchronizer...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0branding\sync-branding.ps1"
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo [ERROR] Logo synchronization failed!
    pause
    exit /b %ERRORLEVEL%
)
echo.
echo All logos, extensions, web assets and Windows icons are updated!
echo.
pause