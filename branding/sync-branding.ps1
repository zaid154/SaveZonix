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

# Helper function to generate true Windows multi-resolution .ico (DIB + Vista PNG 256)
function Save-MultiResIco {
    param(
        [System.Drawing.Bitmap]$SourceBmp,
        [string]$DestIcoPath,
        [int[]]$Sizes = @(256, 128, 64, 48, 32, 16)
    )
    $destDir = Split-Path $DestIcoPath
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    
    $entries = @()
    foreach ($sz in $Sizes) {
        $resized = New-Object System.Drawing.Bitmap($sz, $sz, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($resized)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.Clear([System.Drawing.Color]::Transparent)
        $g.DrawImage($SourceBmp, 0, 0, $sz, $sz)
        $g.Dispose()

        if ($sz -ge 256) {
            # 256x256 uses standard PNG compression (Vista+)
            $ms = New-Object System.IO.MemoryStream
            $resized.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
            $pngBytes = $ms.ToArray()
            $ms.Dispose()
            $entries += @{
                Width = 0; Height = 0; BitCount = 32; Data = $pngBytes
            }
        } else {
            # <= 128x128 MUST be standard Windows DIB (BITMAPINFOHEADER + BGRA + AND mask)
            # for Windows Shell, Explorer desktop shortcuts, and GDI compatibility
            $ms = New-Object System.IO.MemoryStream
            $bw = New-Object System.IO.BinaryWriter($ms)
            
            # BITMAPINFOHEADER (40 bytes)
            $bw.Write([uint32]40) # biSize
            $bw.Write([int32]$sz)  # biWidth
            $bw.Write([int32]($sz * 2)) # biHeight (double height for image + AND mask in ICO)
            $bw.Write([uint16]1)  # biPlanes
            $bw.Write([uint16]32) # biBitCount (32-bit ARGB)
            $bw.Write([uint32]0)  # biCompression (BI_RGB)
            $bw.Write([uint32]($sz * $sz * 4)) # biSizeImage
            $bw.Write([int32]0)   # biXPelsPerMeter
            $bw.Write([int32]0)   # biYPelsPerMeter
            $bw.Write([uint32]0)  # biClrUsed
            $bw.Write([uint32]0)  # biClrImportant

            # Pixel data (Bottom-Up, BGRA)
            for ($y = $sz - 1; $y -ge 0; $y--) {
                for ($x = 0; $x -lt $sz; $x++) {
                    $pixel = $resized.GetPixel($x, $y)
                    $bw.Write([byte]$pixel.B)
                    $bw.Write([byte]$pixel.G)
                    $bw.Write([byte]$pixel.R)
                    $bw.Write([byte]$pixel.A)
                }
            }

            # AND mask (1bpp, row padded to 32-bit / 4 bytes boundary)
            $andRowBytes = [int][Math]::Ceiling($sz / 32.0) * 4
            $andMask = New-Object byte[] ($andRowBytes * $sz)
            $bw.Write($andMask)

            $bw.Flush()
            $dibBytes = $ms.ToArray()
            $bw.Close()
            $ms.Dispose()

            $entries += @{
                Width = [byte]$sz; Height = [byte]$sz; BitCount = 32; Data = $dibBytes
            }
        }
        $resized.Dispose()
    }

    $fs = [System.IO.File]::Create($DestIcoPath)
    $bw = New-Object System.IO.BinaryWriter($fs)
    
    # ICONDIR
    $bw.Write([uint16]0) # Reserved
    $bw.Write([uint16]1) # Type 1 = Icon
    $bw.Write([uint16]$entries.Count)

    $offset = 6 + (16 * $entries.Count)
    foreach ($e in $entries) {
        $bw.Write([byte]$e.Width)
        $bw.Write([byte]$e.Height)
        $bw.Write([byte]0) # ColorCount
        $bw.Write([byte]0) # Reserved
        $bw.Write([uint16]1) # Planes
        $bw.Write([uint16]$e.BitCount)
        $bw.Write([uint32]$e.Data.Length)
        $bw.Write([uint32]$offset)
        $offset += $e.Data.Length
    }

    foreach ($e in $entries) {
        $bw.Write($e.Data)
    }

    $bw.Flush()
    $bw.Close()
    $fs.Close()
    Write-Host " -> Generated Windows Standard Multi-Resolution Icon: $DestIcoPath" -ForegroundColor Magenta
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
