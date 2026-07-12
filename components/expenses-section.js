import { ReactiveElement, icon, escapeHtml, euros } from '../js/utils.js';

class ExpensesSection extends ReactiveElement {
  build() {
    this.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px;">
        <div class="section-head" id="es-head">
          <h2 class="font-display">Despeses</h2>
          <button id="es-toggle" class="accordion-toggle-btn" style="display:none;" title="Mostra o amaga les despeses">${icon('chevron', 'currentColor', 18)}</button>
        </div>
        <sl-button id="es-add-btn" variant="warning" class="btn-add-expense-wrap" style="display:none;width:100%;margin-bottom:4px;">
          ${icon('plus', 'currentColor', 19)} Afegeix una despesa
        </sl-button>
        <div id="es-form-container"></div>
        <div id="es-list"></div>
      </div>`;

    this._headEl = this.$('#es-head');
    this._toggleBtn = this.$('#es-toggle');
    this._addBtn = this.$('#es-add-btn');
    this._formContainer = this.$('#es-form-container');
    this._listEl = this.$('#es-list');
    this._formBuiltKey = null;

    this._addBtn.addEventListener('click', () => this.emit('open-add-expense-form'));
  }

  update(data) {
    const closed = !!data.closed;
    this._headEl.classList.toggle('accordion-head', closed);
    this._headEl.onclick = closed ? () => this.emit('toggle-expenses-accordion') : null;
    this._toggleBtn.style.display = closed ? '' : 'none';
    this._addBtn.style.display = closed ? 'none' : '';

    const open = closed ? !!data.accordionOpen : true;
    this._listEl.style.display = open ? '' : 'none';
    this._toggleBtn.style.transform = data.accordionOpen ? 'rotate(180deg)' : 'rotate(0deg)';

    this._renderList(data);
    this._renderForm(data);
  }

  _renderList(data) {
    const { expenses, participants, closed } = data;
    if (!expenses || expenses.length === 0) {
      this._listEl.innerHTML = `<div class="ledger-card empty-state"><p>Encara no hi ha cap despesa apuntada.</p></div>`;
      return;
    }
    const order = [];
    expenses.forEach(e => { if (!order.includes(e.payerId)) order.push(e.payerId); });

    this._listEl.innerHTML = order.map(payerId => {
      const payer = participants.find(p => p.id === payerId);
      const payerName = payer ? payer.name : 'Participant eliminat';
      const payerExpenses = expenses.filter(e => e.payerId === payerId);
      const groupTotal = payerExpenses.reduce((s, e) => s + e.amount, 0);
      const rows = payerExpenses.map(e => {
        const includedNames = participants.filter(p => (e.participantIds || []).includes(p.id)).map(p => p.name);
        const splitNote = includedNames.length === participants.length
          ? 'entre tothom'
          : (includedNames.length === 0 ? 'sense repartir' : `entre ${includedNames.length} persones`);
        return `
          <div class="expense-row" data-id="${e.id}">
            <div style="min-width:0;">
              <div class="expense-concept">${escapeHtml(e.concept)}</div>
              <div class="expense-split-note">${icon('receipt', 'currentColor', 12)} ${splitNote}</div>
            </div>
            <div class="prow-right">
              <div class="pamount font-mono">${euros(e.amount)}</div>
              ${!closed ? `<button class="edit-expense-btn" data-id="${e.id}" title="Edita">${icon('pencil', 'currentColor', 14)} Edita</button>` : ''}
            </div>
          </div>`;
      }).join('');
      return `
        <div class="ledger-card payer-group">
          <div class="payer-group-head">
            <span class="payer-group-name">${escapeHtml(payerName)}</span>
            <span class="payer-group-total font-mono">${euros(groupTotal)}</span>
          </div>
          ${rows}
        </div>`;
    }).join('');

    if (!closed) {
      this._listEl.querySelectorAll('.edit-expense-btn').forEach(btn => {
        btn.onclick = () => this.emit('edit-expense', { id: btn.getAttribute('data-id') });
      });
    }
  }

  _renderForm(data) {
    if (data.closed || !data.showExpenseForm) {
      if (this._formBuiltKey !== null) { this._formContainer.innerHTML = ''; this._formBuiltKey = null; }
      return;
    }
    const editing = (data.expenses || []).find(e => e.id === data.editingExpenseId) || null;
    const key = editing ? `edit:${editing.id}` : 'new';
    if (this._formBuiltKey === key) {
      this._syncFormStatus(data);
      return;
    }
    this._formBuiltKey = key;

    const participants = data.participants || [];
    const defaultPayer = editing ? editing.payerId : (data.myParticipantId || (participants[0] && participants[0].id) || '');
    const defaultSelected = editing ? (editing.participantIds || []) : participants.map(p => p.id);

    const payerOptions = participants.map(p =>
      `<sl-option value="${p.id}">${escapeHtml(p.name)}</sl-option>`
    ).join('');

    const checklist = participants.map(p => `
      <sl-checkbox data-pid="${p.id}" ${defaultSelected.includes(p.id) ? 'checked' : ''}>
        ${escapeHtml(p.name)} <span class="checkbox-item-units">(${p.familySize} ${p.familySize === 1 ? 'persona' : 'persones'})</span>
      </sl-checkbox>`).join('');

    this._formContainer.innerHTML = `
      <div class="ledger-card form-card">
        <div class="form-head">
          <h3 class="font-display">${editing ? 'Edita la despesa' : 'Nova despesa'}</h3>
          <button id="ef-close" class="close-form">${icon('x', 'currentColor', 18)}</button>
        </div>
        <sl-select id="ef-payer" label="Qui ha pagat" value="${defaultPayer}" style="margin-bottom:14px;">${payerOptions}</sl-select>
        <sl-input id="ef-concept" label="Concepte" placeholder="p. ex. Supermercat, benzina..." value="${editing ? escapeHtml(editing.concept) : ''}" style="margin-bottom:14px;"></sl-input>
        <sl-input id="ef-amount" label="Preu (€)" inputmode="decimal" placeholder="0,00" value="${editing ? String(editing.amount).replace('.', ',') : ''}" style="margin-bottom:16px;"></sl-input>
        <label class="field-label">Qui ha de pagar aquesta despesa</label>
        <p class="hint-text" style="margin:-2px 0 8px;">Desmarca qui no hi ha de participar.</p>
        <div class="checkbox-list" id="ef-checklist">${checklist || '<p class="hint-text" style="margin:0;">Encara no hi ha participants.</p>'}</div>
        <p class="error-text" id="ef-error" style="display:none;margin:8px 0 0;"></p>
        <div style="display:flex;gap:8px;margin-top:16px;">
          ${editing ? `<sl-button id="ef-delete" variant="danger" outline style="flex:1;">${icon('trash', 'currentColor', 16)} Elimina</sl-button>` : ''}
          <sl-button id="ef-submit" variant="primary" style="flex:2;">${editing ? 'Desa els canvis' : 'Afegeix la despesa'}</sl-button>
        </div>
      </div>`;

    this._efErrorEl = this.$('#ef-error');
    this._efSubmitBtn = this.$('#ef-submit');
    this._efDeleteBtn = this.$('#ef-delete');

    this.$('#ef-close').onclick = () => this.emit('close-expense-form');
    if (this._efDeleteBtn) {
      this._efDeleteBtn.addEventListener('click', () => this.emit('delete-expense-request', { id: editing.id, concept: editing.concept, amount: editing.amount }));
    }
    this._efSubmitBtn.addEventListener('click', () => {
      const payerId = this.$('#ef-payer').value;
      const concept = (this.$('#ef-concept').value || '').trim();
      const amountRaw = (this.$('#ef-amount').value || '').replace(',', '.');
      const amt = parseFloat(amountRaw);
      const checked = Array.from(this.$all('#ef-checklist sl-checkbox')).filter(cb => cb.checked).map(cb => cb.getAttribute('data-pid'));

      if (!payerId) return this._formError('Cal seleccionar qui ha pagat.');
      if (!concept) return this._formError('Cal un concepte.');
      if (isNaN(amt) || amt < 0) return this._formError('Introdueix un import vàlid.');
      if (checked.length === 0) return this._formError('Selecciona qui ha de pagar aquesta despesa.');
      this._efErrorEl.style.display = 'none';

      this.emit('save-expense', {
        id: editing ? editing.id : null,
        payerId, concept, amount: amt, participantIds: checked
      });
    });
  }

  _formError(msg) {
    this._efErrorEl.textContent = msg;
    this._efErrorEl.style.display = '';
  }

  _syncFormStatus(data) {
    if (!this._efSubmitBtn) return;
    const saving = !!data.savingExpense;
    this._efSubmitBtn.loading = saving;
    this._efSubmitBtn.disabled = saving;
    if (this._efDeleteBtn) this._efDeleteBtn.disabled = saving;
    if (data.expenseError) this._formError(data.expenseError);
  }
}
customElements.define('expenses-section', ExpensesSection);
