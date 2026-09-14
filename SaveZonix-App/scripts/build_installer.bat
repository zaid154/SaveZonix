@echo off
title SaveZonix - 1-Click Latest Installer Builder
color 0A
echo =========================================================
echo    SaveZonix - Building Latest Release and Setup Installer
echo =========================================================
echo.

set "APP_DIR=%~dp0.."
set "ISCC_PATH=C:\Users\user\AppData\Local\Programs\Inno Setup 6\ISCC.exe"

if not exist "%ISCC_PATH%" set "ISCC_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"

echo [1/3] Publishing latest Release build (win-x64 self-contained)...
cd /d "%APP_DIR%"
dotnet publish -c Release -r win-x64 --self-contained true
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Dotnet publish failed. Please check build errors above.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] Ensuring ffmpeg.exe is bundled in publish directory...
if exist "%APP_DIR%\ffmpeg.exe" (
    copy /y "%APP_DIR%\ffmpeg.exe" "%APP_DIR%\bin\Release\net10.0\win-x64\publish\ffmpeg.exe" >nul
)

echo.
echo [3/3] Compiling 1-File Windows Setup (Inno Setup)...
"%ISCC_PATH%" "%APP_DIR%\installer\installer.iss"
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Installer compilation failed.
    pause
    exit /b %errorlevel%
)

echo.
echo =========================================================
echo  SUCCESS! Your latest SaveZonix-Setup.exe is ready!
echo  Folder: %APP_DIR%\installer
echo =========================================================
echo.
explorer "%APP_DIR%\installer"
