import { ReactiveElement, icon, escapeHtml, euros } from '../js/utils.js';

class ParticipantsSection extends ReactiveElement {
  build() {
    this.innerHTML = `
      <div>
        <div class="section-head accordion-head" id="ps-head">
        <span style="display:flex;align-items:center;gap:6px;">
        <h2 class="font-display">Participants</h2>
        <div id="ps-add-container"></div>
        </span>
          <button id="ps-toggle" class="accordion-toggle-btn" title="Mostra o amaga els participants">${icon('chevron', 'currentColor', 18)}</button>
        </div>
        <div id="ps-list"></div>
      </div>`;

    this._headEl = this.$('#ps-head');
    this._toggleBtn = this.$('#ps-toggle');
    this._listEl = this.$('#ps-list');
    this._addContainer = this.$('#ps-add-container');
    this._addFormBuiltFor = null; // 'form' | 'toggle' | null

    this._headEl.onclick = () => this.emit('toggle-participants-accordion');
  }

  update(data) {
    const open = !!data.accordionOpen;
    this._listEl.style.display = open ? '' : 'none';
    this._toggleBtn.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';

    this._renderList(data);
    this._renderAddForm(data);
  }

  _renderList(data) {
    const { participants, myParticipantId, closed, paidCents } = data;
    if (!participants || participants.length === 0) {
      this._listEl.innerHTML = `<div class="ledger-card empty-state"><p>Encara no hi ha participants. Identifica't o afegeix-ne un! 🎉</p></div>`;
      return;
    }
    this._listEl.innerHTML = participants.map(p => `
      <div class="ledger-card participant-row">
        <div style="min-width:0;">
          <div class="pname">${escapeHtml(p.name)}${p.id === myParticipantId ? ' <span class="me-badge">tu</span>' : ''}</div>
          <div class="pfamily">${icon('users', 'currentColor', 12)} ${p.familySize} ${p.familySize === 1 ? 'persona' : 'persones'}</div>
        </div>
        <div class="prow-right">
          <div class="pamount font-mono">${euros(((paidCents && paidCents[p.id]) || 0) / 100)}</div>
          ${!closed ? `<button class="del-btn" data-id="${p.id}" title="Elimina participant">${icon('trash', 'currentColor', 16)}</button>` : ''}
        </div>
      </div>`).join('');
    this._listEl.querySelectorAll('.del-btn').forEach(btn => {
      btn.onclick = () => this.emit('delete-participant', { id: btn.getAttribute('data-id') });
    });
  }

  _renderAddForm(data) {
    if (data.closed) {
      if (this._addFormBuiltFor !== null) { this._addContainer.innerHTML = ''; this._addFormBuiltFor = null; }
      return;
    }
    const wantForm = !!data.showAddParticipant;
    const key = wantForm ? 'form' : 'toggle';
    if (this._addFormBuiltFor === key) {
      if (wantForm) this._syncAddFormErrors(data);
      return;
    }
    this._addFormBuiltFor = key;

    if (!wantForm) {
      this._addContainer.innerHTML = `<button id="ps-show-add" class="add-toggle"">${icon('plus', 'currentColor', 16)} Afegeix un participant que no hi és</button>`;
      this.$('#ps-show-add').onclick = () => this.emit('show-add-participant-form');
      return;
    }

    this._addContainer.innerHTML = `
      <div class="ledger-card form-card">
        <div class="form-head">
          <h3 class="font-display">Afegeix un participant</h3>
          <button id="ap-close" class="close-form">${icon('x', 'currentColor', 18)}</button>
        </div>
        <sl-input id="ap-name" label="Nom" placeholder="p. ex. Avi Josep" style="margin-bottom:14px;"></sl-input>
        <label class="field-label">Persones que representa</label>
        <div class="stepper">
          <button id="ap-minus">${icon('minus', 'currentColor', 18)}</button>
          <div class="val" id="ap-family-val">1</div>
          <button id="ap-plus">${icon('plus', 'currentColor', 18)}</button>
          <span class="unit">persones</span>
        </div>
        <p class="hint-text" style="margin:0 0 14px;">Se l'afegirà automàticament a totes les despeses ja creades.</p>
        <p class="error-text" id="ap-error" style="display:none;margin:0 0 12px;"></p>
        <sl-button id="ap-submit" variant="primary" style="width:100%;">Afegeix el participant</sl-button>
      </div>`;

    let familySize = 1;
    const valEl = this.$('#ap-family-val');
    this.$('#ap-minus').onclick = () => { familySize = Math.max(1, familySize - 1); valEl.textContent = familySize; };
    this.$('#ap-plus').onclick = () => { familySize = Math.min(20, familySize + 1); valEl.textContent = familySize; };
    this.$('#ap-close').onclick = () => this.emit('close-add-participant-form');

    const nameInput = this.$('#ap-name');
    const errEl = this.$('#ap-error');
    const submitBtn = this.$('#ap-submit');
    submitBtn.addEventListener('click', () => {
      const name = (nameInput.value || '').trim();
      if (!name) { errEl.textContent = 'Cal un nom.'; errEl.style.display = ''; return; }
      errEl.style.display = 'none';
      this.emit('add-participant-submit', { name, familySize });
    });
    this._apErrEl = errEl;
    this._apSubmitBtn = submitBtn;
  }

  _syncAddFormErrors(data) {
    if (!this._apSubmitBtn) return;
    const saving = !!data.savingParticipant;
    this._apSubmitBtn.loading = saving;
    this._apSubmitBtn.disabled = saving;
    if (data.addParticipantError) {
      this._apErrEl.textContent = data.addParticipantError;
      this._apErrEl.style.display = '';
    }
  }
}
customElements.define('participants-section', ParticipantsSection);
