# scripts/generate_android_icons.ps1 - Android İkon ve Açılış Ekranı (Splash Screen) Oluşturucu
Add-Type -AssemblyName System.Drawing

$sourcePath = "public/assets/mascot/inci_mascot_shell.jpg"
if (-not (Test-Path $sourcePath)) {
    Write-Error "Kaynak maskot görseli bulunamadı: $sourcePath"
    exit 1
}

$sourceImg = [System.Drawing.Image]::FromFile((Resolve-Path $sourcePath).Path)

# 1. Launcher İkon Boyutları
$iconSizes = @{
    "android/app/src/main/res/mipmap-mdpi" = 48
    "android/app/src/main/res/mipmap-hdpi" = 72
    "android/app/src/main/res/mipmap-xhdpi" = 96
    "android/app/src/main/res/mipmap-xxhdpi" = 144
    "android/app/src/main/res/mipmap-xxxhdpi" = 192
}

# 2. Foreground İkon Boyutları
$fgSizes = @{
    "android/app/src/main/res/mipmap-mdpi" = 108
    "android/app/src/main/res/mipmap-hdpi" = 162
    "android/app/src/main/res/mipmap-xhdpi" = 216
    "android/app/src/main/res/mipmap-xxhdpi" = 324
    "android/app/src/main/res/mipmap-xxxhdpi" = 432
}

# 3. Splash Dikey (Portrait) Boyutları
$portSplashSizes = @{
    "android/app/src/main/res/drawable-port-mdpi" = @{ Width = 320; Height = 480 }
    "android/app/src/main/res/drawable-port-hdpi" = @{ Width = 480; Height = 800 }
    "android/app/src/main/res/drawable-port-xhdpi" = @{ Width = 720; Height = 1280 }
    "android/app/src/main/res/drawable-port-xxhdpi" = @{ Width = 960; Height = 1600 }
    "android/app/src/main/res/drawable-port-xxxhdpi" = @{ Width = 1280; Height = 1920 }
}

# 4. Splash Yatay (Landscape) Boyutları
$landSplashSizes = @{
    "android/app/src/main/res/drawable-land-mdpi" = @{ Width = 480; Height = 320 }
    "android/app/src/main/res/drawable-land-hdpi" = @{ Width = 800; Height = 480 }
    "android/app/src/main/res/drawable-land-xhdpi" = @{ Width = 1280; Height = 720 }
    "android/app/src/main/res/drawable-land-xxhdpi" = @{ Width = 1600; Height = 960 }
    "android/app/src/main/res/drawable-land-xxxhdpi" = @{ Width = 1920; Height = 1280 }
}

function Resize-SquareIcon($src, $targetDir, $fileName, $size, $isRound = $false) {
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    }
    $targetPath = Join-Path $targetDir $fileName

    $destBmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($isRound) {
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddEllipse(0, 0, $size, $size)
        $g.SetClip($path)
    }

    $g.DrawImage($src, 0, 0, $size, $size)
    $g.Dispose()

    $destBmp.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Dispose()
    Write-Host "Üretildi: $targetPath ($size x $size)"
}

function Generate-Splash($src, $targetDir, $w, $h) {
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    }
    $targetPath = Join-Path $targetDir "splash.png"

    $destBmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

    # Pudra pembe arka plan (#FCF1F5)
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(252, 241, 245))
    $g.FillRectangle($bgBrush, 0, 0, $w, $h)
    $bgBrush.Dispose()

    # Ortaya maskotu yerleştir (Genişliğin yaklaşık %55'i)
    $mascotSize = [int]($w * 0.55)
    if ($mascotSize -gt ($h * 0.45)) {
        $mascotSize = [int]($h * 0.45)
    }

    $posX = [int](($w - $mascotSize) / 2)
    $posY = [int](($h - $mascotSize) / 2 - ($h * 0.05))

    $g.DrawImage($src, $posX, $posY, $mascotSize, $mascotSize)

    # Altına skinbyinci marka yazısı çiz
    $fontSize = [int]($w * 0.065)
    if ($fontSize -lt 18) { $fontSize = 18 }
    if ($fontSize -gt 42) { $fontSize = 42 }

    $font = New-Object System.Drawing.Font("Arial", $fontSize, [System.Drawing.FontStyle]::Bold)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(184, 50, 94))
    $stringFormat = New-Object System.Drawing.StringFormat
    $stringFormat.Alignment = [System.Drawing.StringAlignment]::Center

    $textRect = New-Object System.Drawing.RectangleF(0, ($posY + $mascotSize + ($h * 0.02)), $w, ($fontSize * 2))
    $g.DrawString("skinbyinci", $font, $textBrush, $textRect, $stringFormat)

    $font.Dispose()
    $textBrush.Dispose()
    $stringFormat.Dispose()
    $g.Dispose()

    $destBmp.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Dispose()
    Write-Host "Splash üretildi: $targetPath ($w x $h)"
}

Write-Host "Android Launcher ve Round İkonları Üretiliyor..."
foreach ($dir in $iconSizes.Keys) {
    $s = $iconSizes[$dir]
    Resize-SquareIcon $sourceImg $dir "ic_launcher.png" $s $false
    Resize-SquareIcon $sourceImg $dir "ic_launcher_round.png" $s $true
}

Write-Host "Android Foreground İkonları Üretiliyor..."
foreach ($dir in $fgSizes.Keys) {
    $s = $fgSizes[$dir]
    Resize-SquareIcon $sourceImg $dir "ic_launcher_foreground.png" $s $false
}

Write-Host "Android Dikey Açılış Ekranları (Splash Screen) Üretiliyor..."
foreach ($dir in $portSplashSizes.Keys) {
    $w = $portSplashSizes[$dir].Width
    $h = $portSplashSizes[$dir].Height
    Generate-Splash $sourceImg $dir $w $h
}

Write-Host "Android Yatay Açılış Ekranları Üretiliyor..."
foreach ($dir in $landSplashSizes.Keys) {
    $w = $landSplashSizes[$dir].Width
    $h = $landSplashSizes[$dir].Height
    Generate-Splash $sourceImg $dir $w $h
}

# Standart tek drawable/splash.png (Varsayılan yedek)
Generate-Splash $sourceImg "android/app/src/main/res/drawable" 720 1280

# Web PWA & App Store için 512x512 ve 1024x1024 ikon üret
Resize-SquareIcon $sourceImg "public/assets" "icon-512.png" 512 $false
Resize-SquareIcon $sourceImg "public/assets" "icon-1024.png" 1024 $false

$sourceImg.Dispose()
Write-Host "Tüm ikonlar ve açılış ekranları başarıyla üretildi!"
