/* =========================================================================
   DIÀLEG DE CONFIRMACIÓ GENÈRIC (Shoelace)
   Per a accions que no es poden desfer fàcilment, com eliminar una despesa
   o tancar la trobada. S'exposa com una simple funció perquè qualsevol part
   de l'app la pugui cridar sense haver de gestionar cap component ella
   mateixa.
   ========================================================================= */
import { escapeHtml } from '../js/utils.js';

export function showConfirmDialog({ title, message, confirmLabel, cancelLabel, danger }, onConfirm) {
  const dialog = document.createElement('sl-dialog');
  dialog.label = title || '';
  dialog.innerHTML = `
    <p>${escapeHtml(message || '')}</p>
    <sl-button slot="footer" class="confirm-cancel-btn">${escapeHtml(cancelLabel || 'Cancel·la')}</sl-button>
    <sl-button slot="footer" variant="${danger ? 'danger' : 'primary'}" class="confirm-ok-btn">${escapeHtml(confirmLabel || 'Confirma')}</sl-button>
  `;
  document.body.appendChild(dialog);

  function close() {
    dialog.hide();
  }
  dialog.addEventListener('sl-after-hide', () => dialog.remove());
  dialog.querySelector('.confirm-cancel-btn').addEventListener('click', close);
  dialog.querySelector('.confirm-ok-btn').addEventListener('click', () => {
    close();
    onConfirm();
  });
  dialog.show();
}
