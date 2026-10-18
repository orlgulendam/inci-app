// public/js/views/AdminView.js - Yönetici Paneli Görünümü (SRP & Admin Only)
import { adminService } from "../services/adminService.js";
import { toast } from "../components/Toast.js";

export class AdminView {
  constructor(container) {
    this.container = container;
    this.activeTab = "users"; // "users" | "scans"
    this.users = [];
    this.scanLogs = [];
    this.searchQuery = "";
  }

  async render() {
    this.container.innerHTML = "";

    const card = document.createElement("div");
    card.className = "card";
    card.style.maxWidth = "880px";
    card.style.margin = "var(--space-4) auto";

    const header = document.createElement("div");
    header.className = "card-header";
    header.innerHTML = `
      <div>
        <h2 class="card-title">🛡️ Sistem Yönetim Paneli</h2>
        <span class="form-hint">Kullanıcı veritabanı ve tarama kayıtları</span>
      </div>
      <span class="badge badge-danger">Yönetici</span>
    `;
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "card-body";

    // Sekmeler
    const tabRow = document.createElement("div");
    tabRow.style.display = "flex";
    tabRow.style.gap = "var(--space-2)";
    tabRow.style.marginBottom = "var(--space-4)";

    const userTabBtn = document.createElement("button");
    userTabBtn.className = `btn btn-sm ${this.activeTab === "users" ? "btn-primary" : "btn-outline"}`;
    userTabBtn.textContent = "👥 Kullanıcılar";
    userTabBtn.onclick = () => { this.activeTab = "users"; this.loadData(); };
    tabRow.appendChild(userTabBtn);

    const scanTabBtn = document.createElement("button");
    scanTabBtn.className = `btn btn-sm ${this.activeTab === "scans" ? "btn-primary" : "btn-outline"}`;
    scanTabBtn.textContent = "📊 Tarama Logları";
    scanTabBtn.onclick = () => { this.activeTab = "scans"; this.loadData(); };
    tabRow.appendChild(scanTabBtn);

    body.appendChild(tabRow);

    // İçerik Alanı
    this.tabContent = document.createElement("div");
    body.appendChild(this.tabContent);

    card.appendChild(body);
    this.container.appendChild(card);

    await this.loadData();
  }

  async loadData() {
    this.tabContent.innerHTML = `<div class="skeleton skeleton-block"></div>`;

    if (this.activeTab === "users") {
      try {
        const res = await adminService.listUsers({ search: this.searchQuery });
        this.renderUsersTable(res.data || []);
      } catch (err) {
        this.tabContent.innerHTML = `<p style="color:var(--color-danger)">Veri yüklenemedi: ${err.message}</p>`;
      }
    } else {
      try {
        const res = await adminService.listScanLogs();
        this.renderScansTable(res.data || []);
      } catch (err) {
        this.tabContent.innerHTML = `<p style="color:var(--color-danger)">Veri yüklenemedi: ${err.message}</p>`;
      }
    }
  }

  renderUsersTable(users) {
    this.tabContent.innerHTML = "";

    // Arama Kutusu
    const searchBar = document.createElement("div");
    searchBar.style.display = "flex";
    searchBar.style.gap = "var(--space-2)";
    searchBar.style.marginBottom = "var(--space-3)";

    const input = document.createElement("input");
    input.className = "form-input";
    input.placeholder = "E-posta veya ada göre ara...";
    input.value = this.searchQuery;
    searchBar.appendChild(input);

    const btn = document.createElement("button");
    btn.className = "btn btn-secondary";
    btn.textContent = "Ara";
    btn.onclick = () => {
      this.searchQuery = input.value.trim();
      this.loadData();
    };
    searchBar.appendChild(btn);
    this.tabContent.appendChild(searchBar);

    if (users.length === 0) {
      this.tabContent.innerHTML += `<p class="form-hint">Kullanıcı bulunamadı.</p>`;
      return;
    }

    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.fontSize = "var(--font-size-sm)";

    table.innerHTML = `
      <thead>
        <tr style="border-bottom: 2px solid var(--color-border); text-align: left;">
          <th style="padding: 8px;">Ad Soyad</th>
          <th style="padding: 8px;">E-posta</th>
          <th style="padding: 8px;">Rol</th>
          <th style="padding: 8px;">Durum</th>
          <th style="padding: 8px;">Puan</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(u => `
          <tr style="border-bottom: 1px solid var(--color-border-subtle);">
            <td style="padding: 8px;">${u.firstName || "-"} ${u.lastName || ""}</td>
            <td style="padding: 8px;">${u.email}</td>
            <td style="padding: 8px;"><span class="badge ${u.role === 'admin' ? 'badge-danger' : 'badge-info'}">${u.role}</span></td>
            <td style="padding: 8px;">${u.isEmailVerified ? '✅ Doğrulanmış' : '⏳ Bekliyor'}</td>
            <td style="padding: 8px;">${u.points || 0}</td>
          </tr>
        `).join("")}
      </tbody>
    `;
    this.tabContent.appendChild(table);
  }

  renderScansTable(scans) {
    this.tabContent.innerHTML = "";

    if (scans.length === 0) {
      this.tabContent.innerHTML = `<p class="form-hint">Henüz kaydedilmiş tarama logu bulunmuyor.</p>`;
      return;
    }

    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.fontSize = "var(--font-size-sm)";

    table.innerHTML = `
      <thead>
        <tr style="border-bottom: 2px solid var(--color-border); text-align: left;">
          <th style="padding: 8px;">Barkod</th>
          <th style="padding: 8px;">Uyumluluk Skoru</th>
          <th style="padding: 8px;">Kullanıcı ID</th>
          <th style="padding: 8px;">Tarih</th>
        </tr>
      </thead>
      <tbody>
        ${scans.map(s => `
          <tr style="border-bottom: 1px solid var(--color-border-subtle);">
            <td style="padding: 8px; font-family:monospace;">${s.barcode}</td>
            <td style="padding: 8px;">%${s.compatibilityScore || 0}</td>
            <td style="padding: 8px; font-size:11px; color:#64748b;">${s.userId || "Anonim"}</td>
            <td style="padding: 8px;">${new Date(s.scannedAt).toLocaleString("tr-TR")}</td>
          </tr>
        `).join("")}
      </tbody>
    `;
    this.tabContent.appendChild(table);
  }
}
