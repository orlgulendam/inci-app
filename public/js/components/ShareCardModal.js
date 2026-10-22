// public/js/components/ShareCardModal.js - Instagram / TikTok Story Paylaşım Kartı Üretici (HTML5 Canvas)
import { toast } from "./Toast.js";

export class ShareCardModal {
  constructor() {
    this.modalEl = null;
  }

  show({
    userName = "İnci Kaşifi",
    skinType = "Karma Cilt",
    streakCount = 7,
    points = 120,
    safetyScore = 95,
    freshCount = 5,
    expiredCount = 0
  } = {}) {
    this.close();

    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.7);
      backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center;
      z-index: 10000; padding: var(--space-3);
    `;

    overlay.innerHTML = `
      <div class="card" style="max-width: 440px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; align-items: center; background: #FFF; border-radius: var(--radius-xl); overflow: hidden; padding: var(--space-4); box-shadow: 0 25px 50px rgba(0,0,0,0.3);">
        <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
          <h3 style="margin: 0; font-size: 16px; color: var(--color-primary-dark); font-weight: 700;">
            ✨ Story Paylaşım Kartı
          </h3>
          <button id="closeShareBtn" style="background: none; border: none; font-size: 22px; cursor: pointer; color: var(--color-text-muted);">&times;</button>
        </div>

        <div style="flex: 1; overflow-y: auto; width: 100%; display: flex; justify-content: center; align-items: center; background: #F8F9FA; border-radius: var(--radius-lg); padding: var(--space-2); margin-bottom: var(--space-3);">
          <canvas id="storyCanvas" width="1080" height="1920" style="width: 100%; max-width: 270px; height: auto; border-radius: 16px; box-shadow: 0 10px 25px rgba(229,72,107,0.2);"></canvas>
        </div>

        <div style="width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2);">
          <button id="nativeShareBtn" class="btn btn-primary" style="font-weight: 700; font-size: 13px;">
            📱 Hikayede Paylaş
          </button>
          <button id="downloadImgBtn" class="btn btn-outline" style="font-weight: 700; font-size: 13px;">
            💾 PNG İndir
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.modalEl = overlay;

    const canvas = overlay.querySelector("#storyCanvas");
    this.renderCanvas(canvas, { userName, skinType, streakCount, points, safetyScore, freshCount, expiredCount });

    overlay.querySelector("#closeShareBtn").onclick = () => this.close();
    overlay.querySelector("#downloadImgBtn").onclick = () => this.downloadImage(canvas);
    overlay.querySelector("#nativeShareBtn").onclick = () => this.shareNative(canvas);
  }

  renderCanvas(canvas, data) {
    const ctx = canvas.getContext("2d");
    const W = 1080;
    const H = 1920;

    // 1. Arka Plan Degrade (Dermokozmetik Pembe Tonları)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#FFF0F4");
    bgGrad.addColorStop(0.4, "#FFE4EC");
    bgGrad.addColorStop(0.8, "#FFF5F7");
    bgGrad.addColorStop(1, "#FFD6E3");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // 2. Arka Plan Dekoratif Işıltı Daireleri
    ctx.save();
    ctx.fillStyle = "rgba(229, 72, 107, 0.08)";
    ctx.beginPath();
    ctx.arc(W * 0.85, 300, 250, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W * 0.15, H - 400, 320, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Marka Başlığı ve Logo Alanı
    ctx.textAlign = "center";
    ctx.fillStyle = "#E5486B";
    ctx.font = "bold 56px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("skinbyinci", W / 2, 220);

    ctx.fillStyle = "#8F5E68";
    ctx.font = "500 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("DERMOKOZMETİK İÇERİK ANALİZİ", W / 2, 275);

    // 4. Ana Beyaz Kart (Card Container)
    ctx.save();
    ctx.shadowColor = "rgba(229, 72, 107, 0.18)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 20;
    ctx.fillStyle = "#FFFFFF";
    this.roundRect(ctx, 80, 360, W - 160, 1180, 48);
    ctx.fill();
    ctx.restore();

    // 5. Kullanıcı Bilgisi
    ctx.fillStyle = "#2B1B1E";
    ctx.font = "bold 54px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(data.userName, W / 2, 470);

    // Cilt Tipi Rozeti
    ctx.fillStyle = "#FFE8EE";
    this.roundRect(ctx, W / 2 - 220, 505, 440, 60, 30);
    ctx.fill();

    ctx.fillStyle = "#E5486B";
    ctx.font = "bold 30px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`✨ ${data.skinType.toUpperCase()}`, W / 2, 546);

    // 6. Dairesel Güvenlik Skoru Göstergesi (Donut / Circle)
    const cx = W / 2;
    const cy = 790;
    const radius = 170;

    // Arka plan dairesi
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "#F2E8EB";
    ctx.lineWidth = 26;
    ctx.stroke();

    // İlerleme çemberi
    const progress = Math.max(0, Math.min(1, data.safetyScore / 100));
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.strokeStyle = data.safetyScore >= 80 ? "#2E7D32" : (data.safetyScore >= 50 ? "#ED6C02" : "#D32F2F");
    ctx.lineWidth = 26;
    ctx.lineCap = "round";
    ctx.stroke();

    // Skor Metni
    ctx.fillStyle = "#2B1B1E";
    ctx.font = "bold 100px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`${data.safetyScore}`, cx, cy + 25);

    ctx.fillStyle = "#8F5E68";
    ctx.font = "600 30px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("/ 100 PUAN", cx, cy + 75);

    ctx.fillStyle = "#E5486B";
    ctx.font = "bold 36px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Cilt Bakım Çantası Güvenlik Skoru", cx, 1030);

    // 7. İstatistik Kartları (3'lü kutu)
    const boxY = 1100;
    const boxW = 260;
    const boxH = 150;
    const startX = 130;
    const gap = 30;

    // Kutu 1: Seri (Streak)
    this.drawStatBox(ctx, startX, boxY, boxW, boxH, "🔥 SERİ", `${data.streakCount} Gün`);
    // Kutu 2: İnci Puanı
    this.drawStatBox(ctx, startX + boxW + gap, boxY, boxW, boxH, "🦪 İNCİ", `${data.points}`);
    // Kutu 3: Taze Ürün
    this.drawStatBox(ctx, startX + (boxW + gap) * 2, boxY, boxW, boxH, "🧴 DOLAP", `${data.freshCount} Taze`);

    // 8. Onay & Dermatolojik Mühür
    ctx.fillStyle = "#4B3639";
    ctx.font = "500 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(data.expiredCount === 0 ? "✅ 0 Süresi Geçmiş Ürün - Kusursuz Hijyen" : `⚠️ ${data.expiredCount} Ürünün Süresi Dolmuş!`, cx, 1330);

    ctx.fillStyle = "#8F5E68";
    ctx.font = "400 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("EC No 1223/2009 Kozmetik Regülasyon Standartları Uyumlu", cx, 1380);

    // 9. Alt Viral Çağrı (Call to Action)
    ctx.fillStyle = "#E5486B";
    this.roundRect(ctx, 140, 1620, W - 280, 110, 55);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 36px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Sen de Cilt Çantanı Analiz Et! 📲", W / 2, 1688);

    ctx.fillStyle = "#6F4951";
    ctx.font = "500 30px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("skinbyinci.com | INCI Engine Platformu", W / 2, 1785);
  }

  drawStatBox(ctx, x, y, w, h, label, value) {
    ctx.fillStyle = "#FFF7F9";
    ctx.strokeStyle = "#F8D5DE";
    ctx.lineWidth = 2;
    this.roundRect(ctx, x, y, w, h, 24);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = "#8F5E68";
    ctx.font = "600 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(label, x + w / 2, y + 48);

    ctx.fillStyle = "#E5486B";
    ctx.font = "bold 40px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(value, x + w / 2, y + 105);
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  downloadImage(canvas) {
    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `skinbyinci_cilt_skorum_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Story kartı başarıyla indirildi! Instagram/TikTok'ta paylaşabilirsin.");
  }

  async shareNative(canvas) {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        toast.error("Görsel oluşturulamadı.");
        return;
      }
      const file = new File([blob], "skinbyinci_skor.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "skinbyinci Cilt Bakım Skorum",
            text: "Cilt bakım çantamın güvenlik skoruna bakın! Sen de içeriklerini skinbyinci ile tara!"
          });
          toast.success("Başarıyla paylaşıldı!");
        } catch (err) {
          if (err.name !== "AbortError") {
            toast.info("Paylaşım iptal edildi veya desteklenmiyor.");
          }
        }
      } else {
        // Fallback indirme
        this.downloadImage(canvas);
        toast.info("Cihazınız doğrudan dosya paylaşımını desteklemediği için görsel cihazınıza indirildi.");
      }
    }, "image/png");
  }

  close() {
    if (this.modalEl && this.modalEl.parentNode) {
      this.modalEl.parentNode.removeChild(this.modalEl);
      this.modalEl = null;
    }
  }
}
