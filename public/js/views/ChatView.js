// public/js/views/ChatView.js - Yapay Zeka Dermokozmetik Danışmanlık Sohbeti (SRP)
import { chatService } from "../services/chatService.js";
import { toast } from "../components/Toast.js";

export class ChatView {
  constructor(container) {
    this.container = container;
    this.messages = [
      {
        role: "model",
        text: "Merhaba! Ben INCI Engine yapay zeka dermokozmetik danışmanınızım. Cilt tipinize ve alerjenlerinize göre ürün içeriklerini değerlendirebilir, içerik sorularınızı yanıtlayabilirim. Bugün hangi ürünü veya içeriği incelemek istersiniz?"
      }
    ];
    this.isTyping = false;
  }

  render() {
    this.container.innerHTML = "";

    const card = document.createElement("div");
    card.className = "card";
    card.style.maxWidth = "780px";
    card.style.margin = "var(--space-4) auto";

    const header = document.createElement("div");
    header.className = "card-header";
    header.innerHTML = `
      <div>
        <h2 class="card-title">✨ AI Dermokozmetik Asistanı</h2>
        <span class="form-hint">Cilt profilinizle uyumlu kişiselleştirilmiş danışman</span>
      </div>
      <span class="badge badge-info">Gemini Flash</span>
    `;
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "card-body";
    body.style.padding = "0";

    const chatWindow = document.createElement("div");
    chatWindow.className = "chat-window";

    this.messagesContainer = document.createElement("div");
    this.messagesContainer.className = "chat-messages";
    chatWindow.appendChild(this.messagesContainer);

    // Giriş Çubuğu
    const inputBar = document.createElement("form");
    inputBar.className = "chat-input-bar";
    inputBar.onsubmit = (e) => {
      e.preventDefault();
      this.handleSend();
    };

    this.inputField = document.createElement("input");
    this.inputField.className = "form-input";
    this.inputField.placeholder = "Ürün içeriği veya cilt bakım sorunuzu buraya yazın...";
    this.inputField.setAttribute("aria-label", "Mesajınız");
    inputBar.appendChild(this.inputField);

    this.sendBtn = document.createElement("button");
    this.sendBtn.type = "submit";
    this.sendBtn.className = "btn btn-primary";
    this.sendBtn.textContent = "Gönder";
    inputBar.appendChild(this.sendBtn);

    chatWindow.appendChild(inputBar);
    body.appendChild(chatWindow);

    // Sabit Tıbbi Uyarı
    const disclaimer = document.createElement("div");
    disclaimer.className = "medical-disclaimer-banner";
    disclaimer.style.margin = "var(--space-3)";
    disclaimer.innerHTML = `<span><strong>Bilgilendirme:</strong> Yapay zeka asistanının yanıtları genel dermokozmetik literatürüne dayanır, tıbbi teşhis ve tedavi yerine geçmez. Dermatoloğunuza danışınız.</span>`;
    body.appendChild(disclaimer);

    card.appendChild(body);
    this.container.appendChild(card);

    this.renderMessages();
  }

  renderMessages() {
    this.messagesContainer.innerHTML = "";

    for (const msg of this.messages) {
      const bubble = document.createElement("div");
      bubble.className = `chat-bubble ${msg.role === "user" ? "chat-user" : "chat-bot"}`;
      // XSS Güvenliği: textContent kullanılır
      bubble.textContent = msg.text;
      this.messagesContainer.appendChild(bubble);

      // Takip önerileri (suggestions) varsa çip olarak render et
      if (msg.suggestions && msg.suggestions.length > 0) {
        const suggBox = document.createElement("div");
        suggBox.className = "chat-suggestions";
        for (const sug of msg.suggestions) {
          const chip = document.createElement("span");
          chip.className = "chat-suggestion-chip";
          chip.textContent = sug;
          chip.onclick = () => {
            this.inputField.value = sug;
            this.handleSend();
          };
          suggBox.appendChild(chip);
        }
        this.messagesContainer.appendChild(suggBox);
      }
    }

    if (this.isTyping) {
      const typing = document.createElement("div");
      typing.className = "chat-bubble chat-bot";
      typing.style.fontStyle = "italic";
      typing.style.color = "var(--color-text-subtle)";
      typing.textContent = "Asistan düşünüyor...";
      this.messagesContainer.appendChild(typing);
    }

    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  async handleSend() {
    const text = this.inputField.value.trim();
    if (!text || this.isTyping) return;

    this.inputField.value = "";
    this.messages.push({ role: "user", text });
    this.isTyping = true;
    this.renderMessages();

    try {
      const res = await chatService.sendMessage({
        message: text,
        history: this.messages.map(m => ({ role: m.role, message: m.text }))
      });

      this.isTyping = false;
      this.messages.push({
        role: "model",
        text: res.reply,
        suggestions: res.suggestions || []
      });
      this.renderMessages();
    } catch (err) {
      this.isTyping = false;
      this.messages.push({
        role: "model",
        text: `Üzgünüm, sorunuzu işlerken bir hata meydana geldi: ${err.message}`
      });
      this.renderMessages();
      toast.error(err.message);
    }
  }
}
