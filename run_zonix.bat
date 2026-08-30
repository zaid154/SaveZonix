@echo off
title Zonix - Ultra High-Speed Video Downloader Web Dashboard
color 0B
echo ---------------------------------------------------------
echo   ZONIX - Ultra High-Speed Video Downloader Web Server
echo ---------------------------------------------------------
echo Starting web server at http://localhost:5000 ...
cd /d "%~dp0"
dotnet run
pause
