Add-Type -AssemblyName System.Drawing

$SHOTS  = Join-Path $PSScriptRoot "..\..\docs\screenshots"
$SLIDES = Join-Path $PSScriptRoot "..\..\docs\.build\slides"
New-Item -ItemType Directory -Force -Path $SLIDES | Out-Null
Get-ChildItem $SLIDES -Filter *.png -ErrorAction SilentlyContinue | Remove-Item -Force

$W = 1080; $H = 1920

function New-Canvas {
    $bmp = New-Object System.Drawing.Bitmap $W, $H
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $rect = New-Object System.Drawing.Rectangle 0, 0, $W, $H
    $c1 = [System.Drawing.ColorTranslator]::FromHtml("#fdf2f6")
    $c2 = [System.Drawing.ColorTranslator]::FromHtml("#f7c6da")
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $c1, $c2, 70.0
    $g.FillRectangle($brush, $rect)
    $brush.Dispose()
    return @{ bmp = $bmp; g = $g }
}

function Add-Text {
    param($g, [string]$text, [int]$y, [int]$size, [string]$hex, [bool]$bold = $true, [int]$maxW = 960)
    $style = if ($bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
    $font = New-Object System.Drawing.Font "Segoe UI", $size, $style
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($hex))
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = [System.Drawing.StringAlignment]::Center
    $layout = New-Object System.Drawing.RectangleF ((($W - $maxW) / 2), $y, $maxW, 420)
    $g.DrawString($text, $font, $brush, $layout, $fmt)
    $font.Dispose(); $brush.Dispose()
}

function Add-Phone {
    param($g, [string]$file, [int]$top, [int]$targetH)
    $img = [System.Drawing.Image]::FromFile($file)
    # DIKKAT: PowerShell degisken adlari buyuk/kucuk harf duyarsizdir.
    # Burada $w kullanmak tuval genisligi $W degiskenini ezip ortalamayi bozuyordu.
    $scale = $targetH / $img.Height
    $imgW = [int]($img.Width * $scale)
    $x = [int](($W - $imgW) / 2)
    $shadow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(45, 120, 28, 59))
    $g.FillRectangle($shadow, ($x + 10), ($top + 12), $imgW, $targetH)
    $shadow.Dispose()
    $g.DrawImage($img, $x, $top, $imgW, $targetH)
    $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml("#eb6899")), 3
    $g.DrawRectangle($pen, $x, $top, $imgW, $targetH)
    $pen.Dispose()
    $img.Dispose()
}

function Save-Slide($o, [string]$name) {
    $o.g.Dispose()
    $o.bmp.Save("$SLIDES\$name", [System.Drawing.Imaging.ImageFormat]::Png)
    $o.bmp.Dispose()
    "  $name"
}

# ---------- 00 AÇILIŞ ----------
$o = New-Canvas
Add-Text $o.g "INCI" 470 150 "#b8325e" $true
Add-Text $o.g "Kozmetik İçerik Analizi" 700 44 "#9c244c" $false
Add-Text $o.g "Cildine ne sürdüğünü" 880 60 "#1e293b" $true
Add-Text $o.g "gerçekten biliyor musun?" 970 60 "#1e293b" $true
Add-Text $o.g "55.000+ ürün   •   30.000+ kimyasal" 1210 36 "#7d1c3b" $false
Add-Text $o.g "EC No 1223/2009 standardına göre" 1275 32 "#7d1c3b" $false
Save-Slide $o "00.png"

# ---------- İÇERİK ----------
$items = @(
  @{ f = "01-ana-ekran.png";                b = "Barkodu tara, fotoğrafını çek";   s = "Saniyeler içinde analiz" },
  @{ f = "02-urun-arama.png";               b = "İsimle de arayabilirsin";          s = "55.000 ürünlük katalog" },
  @{ f = "03-kisisel-analiz.png";           b = "Senin cildine özel uyarı";         s = "Alerjenini üründe yakalar" },
  @{ f = "10-temiz-urun-yuksek-skor.png";   b = "Güvenliyse de söyler";             s = "Sadece uyarı değil, onay da" },
  @{ f = "09-dijital-dolap-skt.png";        b = "Açtığın ürün ne zaman bozulur?";   s = "Dijital dolap • PAO takibi" },
  @{ f = "05-ai-asistan.png";               b = "Takıldığında sor";                 s = "Yapay zekâ cilt asistanı" },
  @{ f = "08-cilt-rutini.png";              b = "Sabah ve akşam rutinin";           s = "Takip et, puan kazan" },
  @{ f = "06-oyunlastirma-inci-serisi.png"; b = "Her gün tara, seriyi büyüt";       s = "İnci topla, sandığı aç" }
)

$i = 1
foreach ($it in $items) {
    $src = Join-Path $SHOTS $it.f
    if (-not (Test-Path $src)) { "  ATLANDI: $($it.f)"; continue }
    $o = New-Canvas
    Add-Text $o.g $it.b 68 50 "#b8325e" $true
    Add-Text $o.g $it.s 148 34 "#7d1c3b" $false
    Add-Phone $o.g $src 232 1480
    Save-Slide $o ("{0:D2}.png" -f $i)
    $i++
}

# ---------- SON ----------
$o = New-Canvas
Add-Text $o.g "INCI" 560 130 "#b8325e" $true
Add-Text $o.g "Cildin için doğru olanı seç" 780 52 "#1e293b" $true
Add-Text $o.g "Yakında App Store ve Google Play'de" 980 36 "#7d1c3b" $false
Save-Slide $o ("{0:D2}.png" -f $i)

""
"Toplam slayt: $((Get-ChildItem $SLIDES -Filter *.png).Count)"
