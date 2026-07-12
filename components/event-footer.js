import { ReactiveElement, icon } from '../js/utils.js';

class EventFooter extends ReactiveElement {
  build() {
    this.innerHTML = `
      <div id="ef-action-container"></div>
      <sl-button id="ef-leave" variant="text" size="small" style="align-self:center;">Surt d'aquesta trobada</sl-button>`;
    this.$('#ef-leave').addEventListener('click', () => this.emit('leave'));
  }
  update(data) {
    const container = this.$('#ef-action-container');
    if (data.closed) {
      container.innerHTML = `<sl-button id="ef-reopen" variant="default" outline style="border-color:var(--sage);color:var(--sage);width:100%;">${icon('check', 'currentColor', 16)} Reobre la trobada</sl-button>`;
      this.$('#ef-reopen').addEventListener('click', () => this.emit('reopen-event'));
    } else {
      container.innerHTML = `<sl-button id="ef-close" variant="danger" outline style="width:100%;">${icon('lock', 'currentColor', 16)} Tanca la trobada</sl-button>`;
      this.$('#ef-close').addEventListener('click', () => this.emit('close-event-request'));
    }
  }
}
customElements.define('event-footer', EventFooter);
