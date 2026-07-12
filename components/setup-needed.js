import { ReactiveElement } from '../js/utils.js';

class SetupNeeded extends ReactiveElement {
  build() {
    this.innerHTML = `
      <div class="setup-box">
        <h2>Cal connectar una base de dades gratuïta</h2>
        <p>Aquesta app necessita un projecte de <b>Firebase</b> (gratuït) perquè totes les persones puguin veure i afegir dades a la mateixa trobada des de qualsevol dispositiu.</p>
        <p>Obre l'arxiu <code>js/firebase-service.js</code>, busca la secció <code>firebaseConfig</code> a l'inici, i substitueix-la per la configuració del teu projecte de Firebase. Un cop fet, torna a pujar l'arxiu al teu hosting.</p>
      </div>`;
  }
}
customElements.define('setup-needed', SetupNeeded);
