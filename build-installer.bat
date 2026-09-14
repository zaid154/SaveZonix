@echo off
title SaveZonix - 1-Click Build Setup EXE
color 0B
cd /d "%~dp0"

echo ========================================================
echo    SaveZonix - Building Production Setup Installer
echo ========================================================
echo Current Directory: %CD%
echo.

echo [1/2] Publishing C# App (win-x64)...
dotnet publish "%~dp0SaveZonix-App\Zonix.csproj" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -o "%~dp0SaveZonix-App\bin\Release\net10.0\win-x64\publish"
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
if exist "%~dp0SaveZonix-App\installer\SaveZonix-Setup-v2.5.1.exe" (
    del /f /q "%~dp0SaveZonix-App\installer\SaveZonix-Setup-v2.5.1.exe" >nul 2>&1
    timeout /t 1 /nobreak >nul
)

set "ISCC=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"
if not exist "%ISCC%" (
    set "ISCC=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
)
if not exist "%ISCC%" (
    set "ISCC=C:\Program Files\Inno Setup 6\ISCC.exe"
)

"%ISCC%" "%~dp0SaveZonix-App\installer\installer.iss"
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo [ERROR] Inno Setup compilation failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================================
echo   SUCCESS! Setup EXE is ready in:
echo   SaveZonix-App\installer\SaveZonix-Setup-v2.5.1.exe
echo ========================================================
echo.
pause
