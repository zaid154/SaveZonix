@echo off
title SaveZonix - Database Reset and Fresh Seed
color 0A
echo =========================================================
echo    SaveZonix - Resetting and Seeding Fresh Database
echo =========================================================
echo.
echo Wiping old data and inserting fresh seed data...
echo.
cd /d "%~dp0"
dotnet run --seed-reset
pause
