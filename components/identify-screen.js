import { ReactiveElement, icon, escapeHtml } from '../js/utils.js';

class IdentifyScreen extends ReactiveElement {
  build() {
    this._familySize = 1;
    this.innerHTML = `
      <div class="screen">
        <div class="ledger-card identify-card">
          <h2 class="font-display" style="font-size:19px;font-weight:600;margin:0 0 4px;">Qui ets?</h2>
          <p style="font-size:13px;opacity:0.65;margin:0 0 16px;" id="identify-intro"></p>
          <sl-input id="id-name" label="El teu nom" placeholder="p. ex. Tia Montse" style="margin-bottom:14px;"></sl-input>
          <label class="field-label">Persones que representes (tu i, si escau, la teva unitat familiar)</label>
          <div class="stepper">
            <button id="id-minus">${icon('minus', 'currentColor', 18)}</button>
            <div class="val" id="id-family-val">1</div>
            <button id="id-plus">${icon('plus', 'currentColor', 18)}</button>
            <span class="unit">persones</span>
          </div>
          <p class="error-text" id="id-error" style="display:none;margin:0 0 12px;"></p>
          <sl-button id="id-submit" variant="primary" style="width:100%;">Entra a la sala</sl-button>
          <button id="id-back" class="btn-link" style="margin-top:10px;">Torna enrere</button>
        </div>
      </div>`;

    this._introEl = this.$('#identify-intro');
    this._nameInput = this.$('#id-name');
    this._valEl = this.$('#id-family-val');
    this._errorEl = this.$('#id-error');
    this._submitBtn = this.$('#id-submit');

    this.$('#id-minus').onclick = () => { this._familySize = Math.max(1, this._familySize - 1); this._valEl.textContent = this._familySize; };
    this.$('#id-plus').onclick = () => { this._familySize = Math.min(20, this._familySize + 1); this._valEl.textContent = this._familySize; };
    this.$('#id-back').onclick = () => this.emit('identify-back');
    this._submitBtn.addEventListener('click', () => this._submit());
    this._nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') this._submit(); });

    requestAnimationFrame(() => this._nameInput.focus());
  }

  update(data) {
    this._introEl.innerHTML = `T'estàs unint a <b>${escapeHtml(data.eventName || '')}</b>. Digue'ns qui ets per poder anotar el que pagues.`;
    const submitting = !!data.submitting;
    this._submitBtn.loading = submitting;
    this._submitBtn.disabled = submitting;
    this._submitBtn.textContent = submitting ? 'Entrant...' : 'Entra a la sala';
    if (data.error) {
      this._errorEl.textContent = data.error;
      this._errorEl.style.display = '';
    } else {
      this._errorEl.style.display = 'none';
    }
  }

  _submit() {
    const name = (this._nameInput.value || '').trim();
    if (!name) {
      this._errorEl.textContent = 'Cal un nom.';
      this._errorEl.style.display = '';
      return;
    }
    this.emit('identify-submit', { name, familySize: this._familySize });
  }
}
customElements.define('identify-screen', IdentifyScreen);
