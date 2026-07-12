/* =========================================================================
   UTILITATS COMPARTIDES
   - Formatació (euros, escapeHtml)
   - Icones SVG inline (mateix set que abans, ara com a mòdul reutilitzable)
   - ReactiveElement: classe base minimalista per als components. Cada
     component rep dades via la propietat `.data`, es construeix una sola
     vegada (build) i després només s'actualitza (update) per no perdre el
     focus dels inputs quan arriben dades nnoves (p. ex. per un snapshot de
     Firestore mentre s'està omplint un formulari).
   ========================================================================= */

export function euros(n) {
  return (n || 0).toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

const ICONS = {
  users: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  plus: `<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`,
  minus: `<line x1="5" y1="12" x2="19" y2="12"/>`,
  trash: `<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>`,
  copy: `<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>`,
  check: `<polyline points="20 6 9 17 4 12"/>`,
  arrow: `<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>`,
  x: `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`,
  pencil: `<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>`,
  receipt: `<path d="M4 2h16v20l-3-2-3 2-3-2-3 2-3-2-1 2z"/><path d="M8 7h8M8 11h8M8 15h5"/>`,
  chevron: `<polyline points="6 9 12 15 18 9"/>`,
  lock: `<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>`,
  moon: `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>`
};

export function icon(name, color, size) {
  size = size || 16;
  color = color || 'currentColor';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

export class ReactiveElement extends HTMLElement {
  set data(value) {
    this._data = value || {};
    if (!this._built) {
      this.build();
      this._built = true;
    }
    this.update(this._data);
  }
  get data() {
    return this._data || {};
  }
  // Sobreescriure: construeix el DOM estàtic del component (una sola vegada).
  build() {}
  // Sobreescriure: aplica les dades noves sobre el DOM ja construït.
  update(_data) {}
  emit(type, detail) {
    this.dispatchEvent(new CustomEvent('app-event', {
      detail: Object.assign({ type }, detail || {}),
      bubbles: true,
      composed: true
    }));
  }
  $(sel) { return this.querySelector(sel); }
  $all(sel) { return this.querySelectorAll(sel); }
}
