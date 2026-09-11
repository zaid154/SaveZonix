@echo off
echo ==========================================
echo  SaveZonix FFmpeg Auto-Setup
echo ==========================================
if exist ffmpeg.exe (
    echo [OK] ffmpeg.exe is already present.
    goto end
)
echo [*] Downloading FFmpeg binary...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-win-64.zip' -OutFile 'ffmpeg.zip' -UseBasicParsing; Expand-Archive -Path 'ffmpeg.zip' -DestinationPath '.' -Force; Remove-Item 'ffmpeg.zip' -Force"
if exist ffmpeg.exe (
    echo [SUCCESS] ffmpeg.exe installed successfully!
) else (
    echo [ERROR] Could not install ffmpeg.exe automatically.
)
:end
pause
