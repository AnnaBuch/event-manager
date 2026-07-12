import { ReactiveElement, icon, escapeHtml, euros } from '../js/utils.js';

class SettlementSection extends ReactiveElement {
  build() {
    this.innerHTML = `<div id="st-inner"></div>`;
  }
  update(data) {
    if (data.empty) { this.$('#st-inner').innerHTML = ''; return; }
    const transactions = data.transactions || [];
    this.$('#st-inner').innerHTML = `
      <div>
        <h2 class="font-display" style="font-size:17px;font-weight:600;margin:18px 0 10px;">${data.closed ? 'Repartiment' : 'Repartiment provisional'}</h2>
        ${transactions.length === 0
          ? `<div class="ledger-card empty-state"><p>Tothom ha pagat la seva part justa. Res a repartir! ✅</p></div>`
          : transactions.map(t => `
              <div class="ledger-card txn-row">
                <div class="txn-names">
                  <span class="from">${escapeHtml(t.from)}</span>
                  ${icon('arrow', 'currentColor', 15)}
                  <span class="to">${escapeHtml(t.to)}</span>
                </div>
                <div class="txn-amount font-mono">${euros(t.cents / 100)}</div>
              </div>`).join('')
        }
      </div>`;
  }
}
customElements.define('settlement-section', SettlementSection);
