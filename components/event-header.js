import { ReactiveElement, icon } from '../js/utils.js';

class EventHeader extends ReactiveElement {
  build() {
    this.innerHTML = `
      <div class="event-name-row">
        <h1 class="font-display" id="eh-name"></h1>
        <span class="closed-badge" id="eh-closed-badge" style="display:none;">${icon('lock', 'currentColor', 13)} Tancada</span>
      </div>
      <div class="code-bar">
        <div>
          <div class="label">Codi de la trobada</div>
          <div class="code font-mono" id="eh-code"></div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <span class="status-dot" id="eh-status-dot"><span class="dot"></span><span id="eh-status-text"></span></span>
          <button id="eh-copy-code" class="btn-icon" title="Copia el codi">${icon('copy', 'currentColor', 17)}</button>
        </div>
      </div>
      <div class="code-bar" style="margin-top:8px;">
        <div style="min-width:0;">
          <div class="label">Enllaç per compartir</div>
          <div class="link-text font-mono" id="eh-link"></div>
        </div>
        <button id="eh-copy-link" class="btn-icon" title="Copia l'enllaç">${icon('copy', 'currentColor', 17)}</button>
      </div>
      <p class="hint-text">Comparteix l'enllaç (per WhatsApp, per exemple) perquè tothom hi entri directament, sense haver de teclejar el codi.</p>`;

    this.$('#eh-copy-code').onclick = () => this.emit('copy-code');
    this.$('#eh-copy-link').onclick = () => this.emit('copy-link', { url: this._shareUrl });
  }

  update(data) {
    this.$('#eh-name').textContent = data.eventName || '';
    this.$('#eh-closed-badge').style.display = data.closed ? '' : 'none';
    this.$('#eh-code').textContent = data.code || '';
    this._shareUrl = data.shareUrl || '';
    this.$('#eh-link').textContent = data.shareUrl || '';
    const statusDot = this.$('#eh-status-dot');
    statusDot.className = `status-dot ${data.connected ? '' : 'offline'}`;
    this.$('#eh-status-text').textContent = data.connected ? 'en directe' : 'sense connexió';
  }
}
customElements.define('event-header', EventHeader);
