# ==============================================================================
# SaveZonix - Single Source of Truth Brand Asset Sync Engine
# Master File: branding\logo.png
# ==============================================================================
$ErrorActionPreference = "Stop"
$rootDir = (Resolve-Path "$PSScriptRoot\..").Path
$masterLogo = Join-Path $rootDir "branding\logo.png"

if (-not (Test-Path $masterLogo)) {
    Write-Error "[BrandSync] Master logo not found at: $masterLogo"
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  SaveZonix - Syncing Master Brand Logo Across App & Web  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Master Asset: $masterLogo"

Add-Type -AssemblyName System.Drawing

$masterBmp = [System.Drawing.Bitmap]::FromFile($masterLogo)

# Helper function to resize and save as PNG
function Save-ResizedPng {
    param(
        [System.Drawing.Bitmap]$SourceBmp,
        [int]$Width,
        [int]$Height,
        [string]$DestPath
    )
    $destDir = Split-Path $DestPath
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    
    $resized = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($SourceBmp, 0, 0, $Width, $Height)
    $g.Dispose()
    
    $resized.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $resized.Dispose()
    Write-Host " -> Saved: $DestPath ($Width x $Height)" -ForegroundColor Green
}

# Helper function to generate modern multi-resolution Windows .ico
function Save-MultiResIco {
    param(
        [System.Drawing.Bitmap]$SourceBmp,
        [string]$DestIcoPath,
        [int[]]$Sizes = @(256, 128, 64, 48, 32, 16)
    )
    $destDir = Split-Path $DestIcoPath
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    
    $pngStreams = @()
    foreach ($sz in $Sizes) {
        $resized = New-Object System.Drawing.Bitmap($sz, $sz, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($resized)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.Clear([System.Drawing.Color]::Transparent)
        $g.DrawImage($SourceBmp, 0, 0, $sz, $sz)
        $g.Dispose()
        
        $ms = New-Object System.IO.MemoryStream
        $resized.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $resized.Dispose()
        $pngStreams += @{ Size = $sz; Bytes = $ms.ToArray() }
        $ms.Dispose()
    }
    
    $fs = [System.IO.File]::Create($DestIcoPath)
    $bw = New-Object System.IO.BinaryWriter($fs)
    
    # ICONDIR
    $bw.Write([uint16]0) # Reserved
    $bw.Write([uint16]1) # Type 1 = Icon
    $bw.Write([uint16]$pngStreams.Count) # Count
    
    $offset = 6 + (16 * $pngStreams.Count)
    foreach ($entry in $pngStreams) {
        $wByte = if ($entry.Size -ge 256) { [byte]0 } else { [byte]$entry.Size }
        $hByte = if ($entry.Size -ge 256) { [byte]0 } else { [byte]$entry.Size }
        $bw.Write($wByte) # Width
        $bw.Write($hByte) # Height
        $bw.Write([byte]0) # ColorCount
        $bw.Write([byte]0) # Reserved
        $bw.Write([uint16]1) # Planes
        $bw.Write([uint16]32) # BitCount
        $bw.Write([uint32]$entry.Bytes.Length) # BytesInRes
        $bw.Write([uint32]$offset) # ImageOffset
        $offset += $entry.Bytes.Length
    }
    
    foreach ($entry in $pngStreams) {
        $bw.Write($entry.Bytes)
    }
    
    $bw.Flush()
    $bw.Close()
    $fs.Close()
    Write-Host " -> Generated Windows Multi-Resolution Icon: $DestIcoPath" -ForegroundColor Magenta
}

Write-Host "`n[1/5] Updating Desktop App Assets..." -ForegroundColor Yellow
Save-ResizedPng -SourceBmp $masterBmp -Width 512 -Height 512 -DestPath "$rootDir\SaveZonix-App\wwwroot\assets\logo.png"
Save-MultiResIco -SourceBmp $masterBmp -DestIcoPath "$rootDir\SaveZonix-App\wwwroot\app.ico"
Save-MultiResIco -SourceBmp $masterBmp -DestIcoPath "$rootDir\SaveZonix-App\wwwroot\favicon.ico"

# Clean stale pre-compressed .gz / .br files so web server never serves old cached icons
$staleIcons = Get-ChildItem -Path "$rootDir\SaveZonix-App" -Recurse -Include "favicon.ico.gz","favicon.ico.br","app.ico.gz","app.ico.br" -ErrorAction SilentlyContinue
foreach ($stale in $staleIcons) {
    Remove-Item $stale.FullName -Force -ErrorAction SilentlyContinue
    Write-Host " -> Cleaned stale compressed file: $($stale.FullName.Replace($rootDir, ''))" -ForegroundColor DarkGray
}

Write-Host "`n[2/5] Updating Web Portal Assets..." -ForegroundColor Yellow
Save-ResizedPng -SourceBmp $masterBmp -Width 512 -Height 512 -DestPath "$rootDir\SaveZonix-Web\client\public\logo.png"
Save-MultiResIco -SourceBmp $masterBmp -DestIcoPath "$rootDir\SaveZonix-Web\client\public\favicon.ico"
if (Test-Path "$rootDir\SaveZonix-Web\client\dist") {
    Save-ResizedPng -SourceBmp $masterBmp -Width 512 -Height 512 -DestPath "$rootDir\SaveZonix-Web\client\dist\logo.png"
    Copy-Item "$rootDir\SaveZonix-Web\client\public\favicon.ico" "$rootDir\SaveZonix-Web\client\dist\favicon.ico" -Force -ErrorAction SilentlyContinue
}

Write-Host "`n[3/5] Updating Chrome Extension Assets..." -ForegroundColor Yellow
Save-ResizedPng -SourceBmp $masterBmp -Width 512 -Height 512 -DestPath "$rootDir\SaveZonix-App\Extension\assets\logo.png"
Save-ResizedPng -SourceBmp $masterBmp -Width 16 -Height 16 -DestPath "$rootDir\SaveZonix-App\Extension\icons\icon16.png"
Save-ResizedPng -SourceBmp $masterBmp -Width 48 -Height 48 -DestPath "$rootDir\SaveZonix-App\Extension\icons\icon48.png"
Save-ResizedPng -SourceBmp $masterBmp -Width 128 -Height 128 -DestPath "$rootDir\SaveZonix-App\Extension\icons\icon128.png"

Write-Host "`n[4/5] Updating Pre-compiled Output Caches & Installed App..." -ForegroundColor Yellow
$extraTargets = @(
    "$rootDir\SaveZonix-App\bin\Release\net10.0\win-x64\publish\wwwroot\assets\logo.png",
    "$rootDir\SaveZonix-App\bin\Release\net10.0\win-x64\publish\wwwroot\app.ico",
    "$rootDir\SaveZonix-App\bin\Release\net10.0\win-x64\publish\wwwroot\favicon.ico"
)
foreach ($target in $extraTargets) {
    if (Test-Path (Split-Path $target)) {
        if ($target.EndsWith("favicon.ico")) {
            Copy-Item "$rootDir\SaveZonix-App\wwwroot\favicon.ico" $target -Force
        } elseif ($target.EndsWith("app.ico")) {
            Copy-Item "$rootDir\SaveZonix-App\wwwroot\app.ico" $target -Force
        } else {
            Copy-Item "$rootDir\SaveZonix-App\wwwroot\assets\logo.png" $target -Force
        }
        Write-Host " -> Synchronized: $target" -ForegroundColor Gray
    }
}

# If user has the installed application on their system, sync it directly too
$installedWwwroot = "$env:LOCALAPPDATA\Programs\SaveZonix\wwwroot"
if (Test-Path $installedWwwroot) {
    Copy-Item "$rootDir\SaveZonix-App\wwwroot\app.ico" "$installedWwwroot\app.ico" -Force
    Copy-Item "$rootDir\SaveZonix-App\wwwroot\favicon.ico" "$installedWwwroot\favicon.ico" -Force
    if (Test-Path "$installedWwwroot\assets") {
        Copy-Item "$rootDir\SaveZonix-App\wwwroot\assets\logo.png" "$installedWwwroot\assets\logo.png" -Force
    }
    Remove-Item "$installedWwwroot\favicon.ico.gz" -Force -ErrorAction SilentlyContinue
    Remove-Item "$installedWwwroot\favicon.ico.br" -Force -ErrorAction SilentlyContinue
    Remove-Item "$installedWwwroot\app.ico.gz" -Force -ErrorAction SilentlyContinue
    Remove-Item "$installedWwwroot\app.ico.br" -Force -ErrorAction SilentlyContinue
    Write-Host " -> Synchronized directly into installed app at: $installedWwwroot" -ForegroundColor Green
}

Write-Host "`n[5/5] Updating Desktop Shortcut & Refreshing Windows Icon Cache..." -ForegroundColor Yellow
try {
    $desktop = [Environment]::GetFolderPath("Desktop")
    $wsh = New-Object -ComObject WScript.Shell
    $shortcuts = Get-ChildItem -Path $desktop -Filter "*SaveZonix*.lnk" -ErrorAction SilentlyContinue
    foreach ($sc in $shortcuts) {
        $link = $wsh.CreateShortcut($sc.FullName)
        if (Test-Path "$installedWwwroot\app.ico") {
            $link.IconLocation = "$installedWwwroot\app.ico,0"
            $link.Save()
            Write-Host " -> Updated Desktop Shortcut Icon: $($sc.Name)" -ForegroundColor Green
        }
    }
    # Tell Windows to repaint icons
    Start-Process "ie4uinit.exe" -ArgumentList "-show" -NoNewWindow -Wait
    Write-Host " -> Windows Icon Cache notification dispatched." -ForegroundColor Green
} catch {
    Write-Host " -> Notice: Shortcut update skipped ($($_.Message))" -ForegroundColor DarkGray
}

$masterBmp.Dispose()

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "  SUCCESS! Brand Assets Synchronized Across All Targets!" -ForegroundColor Cyan
Write-Host "==========================================================`n" -ForegroundColor Cyan
