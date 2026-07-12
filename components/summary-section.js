import { ReactiveElement, euros } from '../js/utils.js';

class SummarySection extends ReactiveElement {
  build() {
    this.innerHTML = `<div id="ss-inner"></div>`;
  }
  update(data) {
    if (data.empty) { this.$('#ss-inner').innerHTML = ''; return; }
    this.$('#ss-inner').innerHTML = `
      <div class="ledger-card summary-card">
        <h2 class="font-display">Resum</h2>
        <div class="summary-row"><span class="k">Total gastat</span><span class="v font-mono">${euros(data.totalCents / 100)}</span></div>
        <div class="summary-row"><span class="k">Persones representades</span><span class="v font-mono">${data.totalUnits}</span></div>
        <div class="summary-row"><span class="k">Nombre de despeses</span><span class="v font-mono">${data.expenseCount}</span></div>
      </div>`;
  }
}
customElements.define('summary-section', SummarySection);
