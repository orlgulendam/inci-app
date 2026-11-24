// scripts/marketing/build-videos.js
// Pazarlama videolarını üretir:
//   1) INCI-tanitim.mp4          - ekran görüntülerinden geçişli slayt videosu
//   2) INCI-maskot-konusuyor.mp4 - animasyonlu konuşan maskot
//
// Ön koşul: önce kareler üretilmeli
//   powershell -ExecutionPolicy Bypass -File scripts/marketing/make-slides.ps1
//   powershell -ExecutionPolicy Bypass -File scripts/marketing/make-mascot-frames.ps1
//
// Kullanım:
//   node scripts/marketing/build-videos.js            (ikisini de üretir)
//   node scripts/marketing/build-videos.js slides     (sadece slayt videosu)
//   node scripts/marketing/build-videos.js mascot     (sadece maskot videosu)

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const BUILD = path.join(ROOT, "docs", ".build");
const DOCS = path.join(ROOT, "docs");

const FPS = 30;
const HOLD = 2.6;  // slayt ekranda kalma süresi (sn)
const FADE = 0.55; // geçiş süresi (sn)

function findFfmpeg() {
  // PATH üzerinde mi?
  for (const cmd of ["ffmpeg", "ffmpeg.exe"]) {
    try {
      execFileSync(cmd, ["-version"], { stdio: "ignore" });
      return cmd;
    } catch (_) { /* dene */ }
  }
  // winget kurulumu
  const base = path.join(
    process.env.LOCALAPPDATA || "",
    "Microsoft", "WinGet", "Packages"
  );
  if (fs.existsSync(base)) {
    for (const d of fs.readdirSync(base)) {
      if (!d.startsWith("Gyan.FFmpeg")) continue;
      const stack = [path.join(base, d)];
      while (stack.length) {
        const cur = stack.pop();
        for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
          const p = path.join(cur, e.name);
          if (e.isDirectory()) stack.push(p);
          else if (e.name.toLowerCase() === "ffmpeg.exe") return p;
        }
      }
    }
  }
  return null;
}

const FFMPEG = findFfmpeg();
if (!FFMPEG) {
  console.error("ffmpeg bulunamadı. Kurmak için:  winget install --id Gyan.FFmpeg -e");
  process.exit(1);
}

function run(args, label) {
  console.log(`${label} kodlanıyor...`);
  try {
    execFileSync(FFMPEG, args, { stdio: ["ignore", "ignore", "pipe"], maxBuffer: 1 << 26 });
  } catch (e) {
    console.error("FFMPEG HATASI:\n" + (e.stderr || Buffer.alloc(0)).toString().slice(-2500));
    process.exit(1);
  }
}

function buildSlideshow() {
  const dir = path.join(BUILD, "slides");
  if (!fs.existsSync(dir)) {
    console.error("Slaytlar yok. Önce: powershell -ExecutionPolicy Bypass -File scripts/marketing/make-slides.ps1");
    return;
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".png")).sort();
  if (files.length < 2) { console.error("En az 2 slayt gerekli."); return; }

  const out = path.join(DOCS, "INCI-tanitim.mp4");
  const args = [];
  const SEG = HOLD + FADE;
  for (const f of files) args.push("-loop", "1", "-t", String(SEG), "-i", path.join(dir, f));

  const parts = files.map((_, i) =>
    `[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,` +
    `pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0xfdf2f6,setsar=1,fps=${FPS}[s${i}]`);

  let prev = "s0";
  for (let i = 1; i < files.length; i++) {
    const outLabel = (i === files.length - 1) ? "vout" : `x${i}`;
    parts.push(`[${prev}][s${i}]xfade=transition=fade:duration=${FADE}:offset=${(HOLD * i).toFixed(2)}[${outLabel}]`);
    prev = outLabel;
  }

  args.push("-filter_complex", parts.join(";"), "-map", "[vout]",
    "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-crf", "20", "-preset", "medium", "-movflags", "+faststart", "-r", String(FPS), "-y", out);

  run(args, `Slayt videosu (${files.length} slayt, ~${(HOLD * files.length + FADE).toFixed(1)} sn)`);
  console.log("  -> " + out + "  " + (fs.statSync(out).size / 1024 / 1024).toFixed(2) + " MB");
}

function buildMascot() {
  const dir = path.join(BUILD, "frames");
  if (!fs.existsSync(dir) || fs.readdirSync(dir).filter(f => f.endsWith(".png")).length === 0) {
    console.error("Kareler yok. Önce: powershell -ExecutionPolicy Bypass -File scripts/marketing/make-mascot-frames.ps1");
    return;
  }
  const out = path.join(DOCS, "INCI-maskot-konusuyor.mp4");
  run([
    "-framerate", String(FPS), "-i", path.join(dir, "f%05d.png"),
    "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-crf", "20", "-preset", "medium", "-movflags", "+faststart", "-r", String(FPS), "-y", out
  ], "Maskot videosu");
  console.log("  -> " + out + "  " + (fs.statSync(out).size / 1024 / 1024).toFixed(2) + " MB");
}

const which = (process.argv[2] || "all").toLowerCase();
console.log("ffmpeg: " + FFMPEG + "\n");
if (which === "all" || which === "slides") buildSlideshow();
if (which === "all" || which === "mascot") buildMascot();
