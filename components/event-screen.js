import { ReactiveElement } from '../js/utils.js';
import { computeSettlement } from '../js/settlement.js';

class EventScreen extends ReactiveElement {
  build() {
    this.innerHTML = `
      <div class="screen">
        <event-header></event-header>
        <div id="es-top-slot"></div>
        <participants-section></participants-section>
        <expenses-section></expenses-section>
        <div id="es-bottom-slot"></div>
        <event-footer></event-footer>
      </div>`;

    this._header = this.$('event-header');
    this._participants = this.$('participants-section');
    this._expenses = this.$('expenses-section');
    this._footer = this.$('event-footer');
    this._topSlot = this.$('#es-top-slot');
    this._bottomSlot = this.$('#es-bottom-slot');

    this._summary = document.createElement('summary-section');
    this._settlement = document.createElement('settlement-section');
  }

  update(data) {
    const participants = data.participants || [];
    const expenses = data.expenses || [];
    const s = computeSettlement(participants, expenses);
    const hasData = participants.length > 0 || expenses.length > 0;

    const shareUrl = window.location.origin + window.location.pathname + '?sala=' + encodeURIComponent(data.code || '');
    this._header.data = {
      eventName: data.eventName, code: data.code, closed: data.closed,
      connected: data.connected, shareUrl: shareUrl
    };

    this._participants.data = {
      participants: participants, myParticipantId: data.myParticipantId, closed: data.closed,
      paidCents: s.paidCents, accordionOpen: data.participantsAccordionOpen,
      showAddParticipant: data.showAddParticipant,
      savingParticipant: data.savingParticipant, addParticipantError: data.addParticipantError
    };

    this._expenses.data = {
      expenses: expenses, participants: participants, closed: data.closed,
      showExpenseForm: data.showExpenseForm, editingExpenseId: data.editingExpenseId,
      accordionOpen: data.expensesAccordionOpen, myParticipantId: data.myParticipantId,
      savingExpense: data.savingExpense, expenseError: data.expenseError
    };

    this._summary.data = hasData
      ? { empty: false, totalCents: s.totalCents, totalUnits: s.totalUnits, expenseCount: expenses.length }
      : { empty: true };
    this._settlement.data = hasData
      ? { empty: false, transactions: s.transactions, closed: data.closed }
      : { empty: true };

    // El repartiment/resum es mostra a dalt de tot quan la trobada està
    // tancada, i després de les despeses mentre encara està oberta.
    const targetSlot = data.closed ? this._topSlot : this._bottomSlot;
    targetSlot.appendChild(this._summary);
    targetSlot.appendChild(this._settlement);

    this._footer.data = { closed: data.closed };
  }
}
customElements.define('event-screen', EventScreen);
