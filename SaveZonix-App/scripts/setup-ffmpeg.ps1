# SaveZonix - FFmpeg Standalone One-Click Installer
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " ⚡ SaveZonix FFmpeg Auto-Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$projectRoot = Split-Path $PSScriptRoot -Parent
$target = Join-Path $projectRoot "ffmpeg.exe"
if (Test-Path $target) {
    Write-Host "✅ ffmpeg.exe is already present in project directory." -ForegroundColor Green
    exit 0
}

Write-Host "⬇️  Downloading official standalone FFmpeg binary..." -ForegroundColor Yellow
$zipPath = Join-Path $projectRoot "ffmpeg_temp.zip"
$url = "https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-win-64.zip"

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing
    Write-Host "📦 Extracting ffmpeg.exe..." -ForegroundColor Yellow
    Expand-Archive -Path $zipPath -DestinationPath $projectRoot -Force
    Remove-Item $zipPath -Force
    Write-Host "✅ FFmpeg installed successfully to: $target" -ForegroundColor Green
} catch {
    Write-Host "❌ Error downloading FFmpeg: $_" -ForegroundColor Red
}
