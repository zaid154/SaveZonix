@echo off
title SaveZonix - 1-Click Build Setup EXE
color 0B
cd /d "%~dp0"

echo ========================================================
echo    SaveZonix - Building Production Setup Installer
echo ========================================================
echo Current Directory: %CD%
if exist "%~dp0SaveZonix-App\wwwroot\app.ico" (
    echo [0/2] Master Brand Assets already in sync. Skipping regeneration...
) else (
    echo [0/2] Synchronizing Master Brand Assets...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0branding\sync-branding.ps1"
    if %ERRORLEVEL% neq 0 (
        color 0C
        echo.
        echo [ERROR] Brand sync failed!
        pause
        exit /b %ERRORLEVEL%
    )
)
echo.

echo [1/2] Publishing C# App (win-x64, optimized)...
dotnet publish "%~dp0SaveZonix-App\Zonix.csproj" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -p:DebugType=None -p:DebugSymbols=false -o "%~dp0SaveZonix-App\bin\Release\net10.0\win-x64\publish"
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo [ERROR] Dotnet publish failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Compiling Setup EXE with Inno Setup...
taskkill /F /IM SaveZonix-Setup* /T >nul 2>&1
taskkill /F /IM Zonix.exe /T >nul 2>&1
taskkill /F /IM ISCC.exe /T >nul 2>&1
timeout /t 1 /nobreak >nul

del /f /q "%~dp0SaveZonix-App\installer\SaveZonix-Setup*.exe" >nul 2>&1

set "BUILD_DIR=%TEMP%\SaveZonix-Build"
if not exist "%BUILD_DIR%" mkdir "%BUILD_DIR%"
del /f /q "%BUILD_DIR%\SaveZonix-Setup*.exe" >nul 2>&1

set "ISCC=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"
if not exist "%ISCC%" (
    set "ISCC=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
)
if not exist "%ISCC%" (
    set "ISCC=C:\Program Files\Inno Setup 6\ISCC.exe"
)

"%ISCC%" /O"%BUILD_DIR%" "%~dp0SaveZonix-App\installer\installer.iss"
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo [ERROR] Inno Setup compilation failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
set "FOUND_INSTALLER="
for %%F in ("%BUILD_DIR%\SaveZonix-Setup*.exe") do (
    set "FOUND_INSTALLER=%%~nxF"
    echo Placing finished installer into SaveZonix-App\installer...
    copy /y "%%F" "%~dp0SaveZonix-App\installer\%%~nxF" >nul
)

if defined FOUND_INSTALLER (
    echo.
    echo ========================================================
    echo   SUCCESS! Setup EXE is ready in:
    echo   SaveZonix-App\installer\%FOUND_INSTALLER%
    echo ========================================================
) else (
    echo [ERROR] Setup EXE not found in %BUILD_DIR%!
    exit /b 1
)

echo.
if not "%1"=="--no-pause" pause
