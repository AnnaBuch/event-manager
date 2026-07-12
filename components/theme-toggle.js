/* =========================================================================
   SELECTOR DE TEMA (clar / fosc)
   Per defecte segueix el tema del dispositiu (prefers-color-scheme). Si la
   persona fa servir l'interruptor, la seva tria manual es desa i té
   preferència sobre el tema del dispositiu a partir d'aleshores.
   ========================================================================= */
import { icon } from '../js/utils.js';

const STORAGE_KEY = 'familyAccount_theme'; // 'auto' | 'light' | 'dark'
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

function getStoredTheme() {
  try { return localStorage.getItem(STORAGE_KEY) || 'auto'; } catch (e) { return 'auto'; }
}
function storeTheme(theme) {
  try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
}
function effectiveIsDark(theme) {
  return theme === 'dark' || (theme === 'auto' && mediaQuery.matches);
}
export function applyTheme(theme) {
  const dark = effectiveIsDark(theme);
  document.documentElement.classList.toggle('sl-theme-dark', dark);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.dispatchEvent(new CustomEvent('theme-change', { detail: { theme, dark } }));
}

// Aplicar el tema com més aviat millor, abans que es pinti cap component.
let currentTheme = getStoredTheme();
applyTheme(currentTheme);
mediaQuery.addEventListener('change', () => {
  if (currentTheme === 'auto') applyTheme(currentTheme);
});

class ThemeToggle extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <button id="theme-toggle-btn" class="btn-icon theme-toggle-btn" title="Canvia entre tema clar i fosc" aria-label="Canvia de tema">
        <span class="theme-icon-sun">${icon('sun', 'currentColor', 17)}</span>
        <span class="theme-icon-moon">${icon('moon', 'currentColor', 17)}</span>
      </button>`;
    this._btn = this.querySelector('#theme-toggle-btn');
    this._sync();
    this._btn.addEventListener('click', () => {
      currentTheme = effectiveIsDark(currentTheme) ? 'light' : 'dark';
      storeTheme(currentTheme);
      applyTheme(currentTheme);
      this._sync();
    });
  }
  _sync() {
    this.classList.toggle('is-dark', effectiveIsDark(currentTheme));
  }
}
customElements.define('theme-toggle', ThemeToggle);
