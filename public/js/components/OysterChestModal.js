// public/js/components/OysterChestModal.js - 7 Günlük İnci İstiridyesi Sandığı Modalı
import { routineService } from "../services/routineService.js";
import { store } from "../state/store.js";
import { toast } from "./Toast.js";

export class OysterChestModal {
  constructor(onClaimed = null) {
    this.onClaimed = onClaimed;
    this.modalEl = null;
  }

  show(streakCount = 7) {
    this.close();

    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.65);
      backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center;
      z-index: 10000; padding: var(--space-4);
    `;

    overlay.innerHTML = `
      <div class="card" style="max-width: 420px; width: 100%; text-align: center; border: 2px solid var(--color-primary-light); background: linear-gradient(180deg, #FFF0F4 0%, #FFFFFF 100%); box-shadow: 0 20px 40px rgba(229,72,107,0.25); animation: scaleUp 0.3s ease-out; position: relative; overflow: hidden;">
        <button id="closeChestBtn" style="position: absolute; top: 12px; right: 12px; background: none; border: none; font-size: 20px; cursor: pointer; color: var(--color-text-muted);">&times;</button>

        <div style="margin-top: var(--space-2);">
          <span class="badge" style="background: var(--color-primary); color: white; padding: 4px 12px; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">
            ${streakCount} Günlük Seri Kilometre Taşı! 🔥
          </span>
        </div>

        <div id="chestVisualContainer" style="margin: var(--space-4) 0; position: relative;">
          <img id="chestImage" src="/assets/mascot/inci_mascot_shell.jpg" alt="İstiridye Sandığı" style="width: 140px; height: 140px; object-fit: contain; border-radius: 50%; box-shadow: 0 10px 25px rgba(229,72,107,0.3); transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); animation: floatPulse 2.5s infinite ease-in-out;" />
          <div id="pearlGlow" style="display: none; font-size: 48px; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); animation: pearlSparkle 1.2s ease-out forwards;">
            ✨🔮✨
          </div>
        </div>

        <h3 id="chestTitle" style="color: var(--color-primary-dark); font-size: 20px; margin-bottom: var(--space-2);">
          Gizemli İnci İstiridyesi! 🦪
        </h3>
        <p id="chestDesc" style="font-size: 13px; color: var(--color-text-muted); line-height: 1.5; margin-bottom: var(--space-4);">
          Tebrikler! ${streakCount} gündür cilt bakımını aksatmadın. İstiridyeni aç ve derin denizlerden çıkan sürpriz İncileri topla!
        </p>

        <div id="chestActionArea">
          <button id="claimChestBtn" class="btn btn-primary" style="width: 100%; font-size: 15px; padding: var(--space-3); font-weight: 700; box-shadow: 0 4px 14px rgba(229,72,107,0.4);">
            İstiridyeyi Aç! ✨
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.modalEl = overlay;

    overlay.querySelector("#closeChestBtn").onclick = () => this.close();
    overlay.querySelector("#claimChestBtn").onclick = () => this.claimReward(overlay);
  }

  async claimReward(overlay) {
    const claimBtn = overlay.querySelector("#claimChestBtn");
    const chestImg = overlay.querySelector("#chestImage");
    const pearlGlow = overlay.querySelector("#pearlGlow");
    const title = overlay.querySelector("#chestTitle");
    const desc = overlay.querySelector("#chestDesc");
    const actionArea = overlay.querySelector("#chestActionArea");

    claimBtn.disabled = true;
    claimBtn.textContent = "İstiridye Açılıyor...";
    chestImg.style.transform = "scale(1.15) rotate(-5deg)";

    try {
      const response = await routineService.claimOysterChest();
      const loot = response.data;

      // Animasyon patlaması
      chestImg.style.transform = "scale(1.2) rotate(5deg)";
      pearlGlow.style.display = "block";

      // Titreşim (mobil haptic feedback)
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 150]);
      }

      setTimeout(() => {
        title.innerHTML = `🎉 +${loot.pointsAwarded} İnci Kazandın! 🦪`;
        title.style.color = "var(--color-primary)";

        desc.innerHTML = `
          <div style="background: #FFF; border: 1px dashed var(--color-primary-light); padding: var(--space-3); border-radius: var(--radius-md); margin-top: var(--space-2);">
            <div style="font-size: 28px; margin-bottom: 4px;">🏆</div>
            <strong>Yeni Rozet Açıldı:</strong><br/>
            <span style="color: var(--color-primary); font-weight: 700; font-size: 15px;">${loot.earnedBadge || "Haftalık Cilt Disiplini"}</span>
            <p style="margin: 6px 0 0; font-size: 12px; color: var(--color-text-muted);">Toplam Puanın: <strong>${loot.totalPoints} İnci</strong></p>
          </div>
        `;

        actionArea.innerHTML = `
          <button id="congratsBtn" class="btn btn-outline" style="width: 100%; font-weight: 700;">
            Harika! Kapat
          </button>
        `;

        // Store'daki kullanıcı puanı ve rozetlerini anında senkronize et
        const currentUser = store.getState().user;
        if (currentUser) {
          currentUser.points = loot.totalPoints;
          currentUser.badges = loot.allBadges || currentUser.badges;
          store.setState({ user: currentUser });
        }

        toast.success(`Tebrikler! +${loot.pointsAwarded} İnci hesabına yüklendi.`);

        overlay.querySelector("#congratsBtn").onclick = () => {
          this.close();
          if (this.onClaimed) this.onClaimed(loot);
        };
      }, 700);
    } catch (err) {
      claimBtn.disabled = false;
      claimBtn.textContent = "Tekrar Dene";
      toast.error(err.message || "İstiridye açılırken bir hata oluştu.");
    }
  }

  close() {
    if (this.modalEl && this.modalEl.parentNode) {
      this.modalEl.parentNode.removeChild(this.modalEl);
      this.modalEl = null;
    }
  }
}
