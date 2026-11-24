Add-Type -AssemblyName System.Drawing
$ROOT   = Join-Path $PSScriptRoot "..\.."
$MASCOT = Join-Path $ROOT "docs\.build\mascot"
$FRAMES = Join-Path $ROOT "docs\.build\frames"
New-Item -ItemType Directory -Force -Path $MASCOT, $FRAMES | Out-Null
Get-ChildItem $FRAMES -Filter *.png -ErrorAction SilentlyContinue | Remove-Item -Force

# ---------- 1) Ifadeleri sprite sayfasindan kirp (etiket satirlari disarida) ----------
$src = [System.Drawing.Image]::FromFile((Join-Path $ROOT "public\assets\mascot\inci_mascot_modes.jpg"))
$cells = @(
  @{ n = "scan";      x = 10;  y = 66;  w = 494; h = 302 },
  @{ n = "explain";   x = 520; y = 66;  w = 494; h = 302 },
  @{ n = "concerned"; x = 10;  y = 420; w = 494; h = 296 },
  @{ n = "joyful";    x = 520; y = 420; w = 494; h = 296 }
)
foreach ($c in $cells) {
    $bmp = New-Object System.Drawing.Bitmap $c.w, $c.h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0,0,$c.w,$c.h),
                 (New-Object System.Drawing.Rectangle $c.x,$c.y,$c.w,$c.h), [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose(); $bmp.Save("$MASCOT\$($c.n).png", [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
}
$src.Dispose()
"ifadeler kirpildi"

$EXP = @{}
foreach ($n in @("scan","explain","concerned","joyful")) { $EXP[$n] = [System.Drawing.Image]::FromFile("$MASCOT\$n.png") }

# ---------- 2) Sahneler ----------
# mode: "talk" = agiz acik/kapali degisimi | "static" = tek ifade + hafif nefes
$scenes = @(
  @{ sec = 3.4; mode = "talk";   a = "explain";   b = "joyful";  l1 = "Merhaba! Ben İnci.";              l2 = "Senin cilt asistanınım." },
  @{ sec = 3.4; mode = "talk";   a = "explain";   b = "joyful";  l1 = "Ürünün barkodunu okut,";          l2 = "ya da fotoğrafını çek." },
  @{ sec = 3.4; mode = "static"; a = "scan";      b = "scan";    l1 = "İçindeki binlerce kimyasalı";     l2 = "saniyeler içinde tararım." },
  @{ sec = 3.4; mode = "static"; a = "concerned"; b = "concerned"; l1 = "Cildine uymayan bir şey varsa"; l2 = "seni hemen uyarırım." },
  @{ sec = 3.2; mode = "talk";   a = "explain";   b = "joyful";  l1 = "Güvenliyse de";                   l2 = "içini rahat ettiririm." },
  @{ sec = 3.2; mode = "talk";   a = "joyful";    b = "explain"; l1 = "Hadi tanışalım!";                 l2 = "INCI" }
)

$W = 1080; $H = 1920; $FPS = 30

# Arka plani bir kez uret
$bg = New-Object System.Drawing.Bitmap $W, $H
$bgG = [System.Drawing.Graphics]::FromImage($bg)
$rect = New-Object System.Drawing.Rectangle 0,0,$W,$H
$br = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect,
      ([System.Drawing.ColorTranslator]::FromHtml("#fdf2f6")),
      ([System.Drawing.ColorTranslator]::FromHtml("#f5bcd4")), 70.0
$bgG.FillRectangle($br, $rect); $br.Dispose(); $bgG.Dispose()

$fontL  = New-Object System.Drawing.Font "Segoe UI", 46, ([System.Drawing.FontStyle]::Bold)
$fmtC   = New-Object System.Drawing.StringFormat
$fmtC.Alignment = [System.Drawing.StringAlignment]::Center
$inkDark = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#7d1c3b"))
$white   = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$penB    = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml("#eb6899")), 5

# Metni tek satirda kalacak sekilde otomatik kucultur (balondan tasmayi onler)
function Add-FitText {
    param($g, [string]$text, [System.Drawing.Brush]$brush, [int]$x, [int]$y, [int]$maxW, [int]$h, $fmt)
    foreach ($size in @(46, 43, 40, 37, 34, 31)) {
        $f = New-Object System.Drawing.Font "Segoe UI", $size, ([System.Drawing.FontStyle]::Bold)
        $m = $g.MeasureString($text, $f)
        if ($m.Width -le $maxW -or $size -eq 31) {
            $r = New-Object System.Drawing.RectangleF $x, $y, $maxW, $h
            $g.DrawString($text, $f, $brush, $r, $fmt)
            $f.Dispose()
            return
        }
        $f.Dispose()
    }
}

function Add-RoundRect($g, $brush, $pen, [int]$x, [int]$y, [int]$w, [int]$h, [int]$r) {
    $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
    $gp.AddArc($x, $y, $r, $r, 180, 90)
    $gp.AddArc(($x + $w - $r), $y, $r, $r, 270, 90)
    $gp.AddArc(($x + $w - $r), ($y + $h - $r), $r, $r, 0, 90)
    $gp.AddArc($x, ($y + $h - $r), $r, $r, 90, 90)
    $gp.CloseFigure()
    if ($brush) { $g.FillPath($brush, $gp) }
    if ($pen)   { $g.DrawPath($pen, $gp) }
    $gp.Dispose()
}

$frame = 0
$sceneIndex = 0
foreach ($sc in $scenes) {
    $n = [int]($sc.sec * $FPS)
    $flip = 0; $hold = 0
    for ($i = 0; $i -lt $n; $i++) {
        $t = $i / $FPS
        $bmp = New-Object System.Drawing.Bitmap $bg
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

        # --- Konusma balonu ---
        $bx = 70; $by = 215; $bw = 940; $bh = 330
        Add-RoundRect $g $white $penB $bx $by $bw $bh 60
        # Balon kuyrugu
        $tail = New-Object System.Drawing.Drawing2D.GraphicsPath
        $tail.AddPolygon(@(
            (New-Object System.Drawing.Point (($W/2 - 46)), ($by + $bh - 6)),
            (New-Object System.Drawing.Point (($W/2 + 46)), ($by + $bh - 6)),
            (New-Object System.Drawing.Point (($W/2 - 6)),  ($by + $bh + 74))
        ))
        $g.FillPath($white, $tail); $tail.Dispose()

        Add-FitText $g $sc.l1 $inkDark ($bx + 40) ($by + 78)  ($bw - 80) 92 $fmtC
        Add-FitText $g $sc.l2 $inkDark ($bx + 40) ($by + 176) ($bw - 80) 92 $fmtC

        # --- Maskot ---
        if ($sc.mode -eq "talk") {
            if ($hold -le 0) { $flip = 1 - $flip; $hold = (Get-Random -Minimum 4 -Maximum 9) }
            $hold--
            $img = if ($flip -eq 1) { $EXP[$sc.b] } else { $EXP[$sc.a] }
            $squash = 1.0
        } else {
            $img = $EXP[$sc.a]
            $squash = 1.0 + 0.012 * [Math]::Sin($t * 2 * [Math]::PI * 2.2)
        }

        $mw = 980
        $mh = [int]($img.Height * ($mw / $img.Width) * $squash)
        $bob = [int](16 * [Math]::Sin($t * 2 * [Math]::PI * 0.55))
        $mx = [int](($W - $mw) / 2)
        $my = 760 + $bob

        $sh = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(38, 120, 28, 59))
        Add-RoundRect $g $sh $null ($mx + 12) ($my + 16) $mw $mh 48
        $sh.Dispose()
        $g.DrawImage($img, $mx, $my, $mw, $mh)

        # --- Alt marka imzasi ---
        $fw = New-Object System.Drawing.Font "Segoe UI", 58, ([System.Drawing.FontStyle]::Bold)
        $fs2 = New-Object System.Drawing.Font "Segoe UI", 27, ([System.Drawing.FontStyle]::Regular)
        $rw = New-Object System.Drawing.RectangleF 0, 1640, $W, 90
        $rs = New-Object System.Drawing.RectangleF 0, 1726, $W, 60
        $g.DrawString("INCI", $fw, $inkDark, $rw, $fmtC)
        $g.DrawString("Kozmetik İçerik Analizi", $fs2, $inkDark, $rs, $fmtC)
        $fw.Dispose(); $fs2.Dispose()

        $g.Dispose()
        $bmp.Save(("{0}\f{1:D5}.png" -f $FRAMES, $frame), [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        $frame++
    }
    $sceneIndex++
    "  sahne $sceneIndex bitti ($frame kare)"
}

foreach ($k in $EXP.Keys) { $EXP[$k].Dispose() }
$bg.Dispose(); $fontL.Dispose(); $inkDark.Dispose(); $white.Dispose(); $penB.Dispose()
""
"toplam kare: $frame  (~$([Math]::Round($frame / $FPS,1)) sn)"
"klasor: $FRAMES"
