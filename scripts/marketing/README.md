# Pazarlama Görselleri ve Videoları

Sosyal medya için dikey (1080x1920) tanıtım videoları üretir.

## Çıktılar

| Dosya | Süre | İçerik |
|---|---|---|
| `docs/INCI-tanitim.mp4` | ~27 sn | Ekran görüntülerinden geçişli slayt videosu |
| `docs/INCI-maskot-konusuyor.mp4` | ~20 sn | Animasyonlu konuşan İnci maskotu |
| `docs/screenshots/*.png` | — | Emülatörden alınmış uygulama ekranları (1080x2400) |

Her ikisi de Instagram Reels / TikTok / Story ölçüsünde, **sessizdir** (müzik veya
seslendirme platformun kendi arayüzünden eklenir).

## Ön koşul

```powershell
winget install --id Gyan.FFmpeg -e
```

`build-videos.js` ffmpeg'i önce PATH üzerinde, bulamazsa winget kurulum
klasöründe arar.

## Kullanım

```powershell
# 1) Slaytları üret (docs/screenshots içindeki PNG'lerden)
powershell -ExecutionPolicy Bypass -File scripts/marketing/make-slides.ps1

# 2) Maskot animasyon karelerini üret
powershell -ExecutionPolicy Bypass -File scripts/marketing/make-mascot-frames.ps1

# 3) Videoları kodla
node scripts/marketing/build-videos.js
```

Tek tek üretmek için: `node scripts/marketing/build-videos.js slides` veya `... mascot`

Ara dosyalar `docs/.build/` altına yazılır ve `.gitignore` ile depo dışında tutulur.

## Metinleri değiştirmek

- **Slayt başlıkları:** `make-slides.ps1` içindeki `$items` dizisi (`b` = başlık, `s` = alt başlık)
- **Maskot replikleri:** `make-mascot-frames.ps1` içindeki `$scenes` dizisi
  - `mode = "talk"` → ağzı açık/kapalı ifadeler arasında geçiş yapar (konuşma efekti)
  - `mode = "static"` → tek ifade + hafif nefes alma animasyonu
  - `a` / `b` → kullanılacak ifadeler: `scan`, `explain`, `concerned`, `joyful`
- **Hız:** `build-videos.js` içindeki `HOLD` (slayt süresi) ve `FADE` (geçiş süresi)

Balon metinleri sığmazsa yazı boyutu otomatik küçülür (46 → 31 pt).

## Maskot ifadeleri

`public/assets/mascot/inci_mascot_modes.jpg` 2x2 bir sprite sayfasıdır;
`make-mascot-frames.ps1` bunu dört ayrı ifadeye böler:

| İfade | Konum | Kullanımı |
|---|---|---|
| `scan` | sol üst | "Analiz ediyorum" — ağız açık, büyüteç |
| `explain` | sağ üst | Ağız kapalı gülümseme — konuşma animasyonunun kapalı karesi |
| `concerned` | sol alt | Endişeli — uyarı repliklerinde |
| `joyful` | sağ alt | Ağız geniş açık — konuşma animasyonunun açık karesi |

## Ekran görüntülerini yenilemek

Emülatörde uygulamayı çalıştırıp `adb shell screencap` ile alınır. Dikkat:

- Em��latörü **yazılım render'ıyla** başlat, aksi halde WebView siyah görünür:
  `emulator -avd Pixel_8 -gpu swiftshader_indirect`
- `adb pull` hedefi ASCII bir yol olmalı; `ü` içeren yola doğrudan çekmek sessizce başarısız olur

## Windows notları

PowerShell 5.1 `.ps1` dosyalarını **UTF-8 BOM olmadan** ANSI varsayar ve Türkçe
karakterler bozulur. Bu klasördeki betikler BOM ile kaydedilmiştir; düzenledikten
sonra BOM'u koruyarak kaydedin.
