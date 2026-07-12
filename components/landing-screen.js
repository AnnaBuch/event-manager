import { ReactiveElement } from '../js/utils.js';

class LandingScreen extends ReactiveElement {
  build() {
    this.innerHTML = `
      <div class="screen">
        <div class="ledger-card" style="padding:20px 20px 20px 26px;">
          <h2 class="font-display" style="font-size:18px;font-weight:600;margin:0 0 4px;">Uneix-te a una trobada</h2>
          <p style="font-size:13px;opacity:0.65;margin:0 0 14px;">Introdueix el codi que t'han passat.</p>
          <div style="display:flex;gap:8px;align-items:flex-end;">
            <sl-input id="join-input" placeholder="p.ex. DINAR-482" class="font-mono" style="flex:1;"></sl-input>
            <sl-button id="join-btn" variant="default" style="white-space:nowrap;">Entra</sl-button>
          </div>
        </div>
        <div class="divider-row"><div class="line"></div><span>o bé</span><div class="line"></div></div>
        <div class="ledger-card" style="padding:20px 20px 20px 26px;">
          <h2 class="font-display" style="font-size:18px;font-weight:600;margin:0 0 4px;">Crea una trobada nova</h2>
          <p style="font-size:13px;opacity:0.65;margin:0 0 14px;">Posa-li un nom, p. ex. "Dinar de Nadal".</p>
          <div style="display:flex;gap:8px;align-items:flex-end;">
            <sl-input id="create-name-input" placeholder="Nom de la trobada" style="flex:1;"></sl-input>
            <sl-button id="create-btn" variant="primary" style="white-space:nowrap;">Crea</sl-button>
          </div>
        </div>
        <p class="error-text" id="landing-error" style="text-align:center;display:none;"></p>
      </div>`;

    this._joinInput = this.$('#join-input');
    this._createInput = this.$('#create-name-input');
    this._joinBtn = this.$('#join-btn');
    this._createBtn = this.$('#create-btn');
    this._errorEl = this.$('#landing-error');

    this._joinBtn.addEventListener('click', () => this._submitJoin());
    this._createBtn.addEventListener('click', () => this._submitCreate());
    this._joinInput.addEventListener('keydown', e => { if (e.key === 'Enter') this._submitJoin(); });
    this._createInput.addEventListener('keydown', e => { if (e.key === 'Enter') this._submitCreate(); });
  }

  update(data) {
    const loading = !!data.loading;
    this._joinBtn.loading = loading;
    this._createBtn.loading = loading;
    this._joinBtn.disabled = loading;
    this._createBtn.disabled = loading;
    if (data.error) {
      this._errorEl.textContent = data.error;
      this._errorEl.style.display = '';
    } else {
      this._errorEl.style.display = 'none';
    }
  }

  _submitJoin() {
    const code = (this._joinInput.value || '').trim();
    if (!code) return;
    this.emit('join', { code });
  }
  _submitCreate() {
    const name = (this._createInput.value || '').trim();
    this.emit('create', { name });
  }
}
customElements.define('landing-screen', LandingScreen);
