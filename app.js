/* =========================================================================
   CONFIGURACIÓ DE FIREBASE
   ========================================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyBaxqUSBYfJilL6ka92Z7q39p2loyERkZI",
  authDomain: "gestor-esdeveniments.firebaseapp.com",
  projectId: "gestor-esdeveniments",
  storageBucket: "gestor-esdeveniments.firebasestorage.app",
  messagingSenderId: "421351349259",
  appId: "1:421351349259:web:322d8552f50e224c113b0e"
};
/* ========================================================================= */

const root = document.getElementById('root');

// Codi de sala: totalment aleatori (lletres+números), sense relació amb el
// nom de la trobada. S'eviten caràcters ambigus (0/O, 1/I) per llegir-lo bé.
function generateCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i=0;i<8;i++){ s += chars.charAt(Math.floor(Math.random()*chars.length)); }
  return s.slice(0,4) + '-' + s.slice(4);
}

let db = null;
let firebaseReady = false;
try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY_HERE") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    firebaseReady = true;
  }
} catch (e) {
  firebaseReady = false;
}

let state = {
  screen: 'landing', // landing | identify | event
  code: null,
  eventName: '',
  participants: [],
  expenses: [],
  myParticipantId: null,
  myName: '',
  error: '',
  loading: false,
  copied: false,
  showAddParticipant: false,
  showExpenseForm: false,
  editingExpenseId: null,
  saving: false,
  connected: true,
  closed: false,
  expensesAccordionOpen: false,
  participantsAccordionOpen: true,
};
let unsubParticipants = null;
let unsubExpenses = null;
let unsubEventMeta = null;

function euros(n){
  return (n||0).toLocaleString('ca-ES',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €';
}
function icon(name, color, size){
  size = size || 16; color = color || 'currentColor';
  const icons = {
    users: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
    plus: `<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`,
    minus: `<line x1="5" y1="12" x2="19" y2="12"/>`,
    trash: `<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>`,
    copy: `<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>`,
    check: `<polyline points="20 6 9 17 4 12"/>`,
    arrow: `<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>`,
    x: `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`,
    party: `<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-1.16-.58a2 2 0 0 0-1.8 0L17 13"/><path d="m11 2 .58 1.15a2 2 0 0 0 1.8 1.02l1.62-.4"/><path d="M22 13a17.5 17.5 0 0 0-10 5"/>`,
    pencil: `<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>`,
    receipt: `<path d="M4 2h16v20l-3-2-3 2-3-2-3 2-3-2-1 2z"/><path d="M8 7h8M8 11h8M8 15h5"/>`,
    chevron: `<polyline points="6 9 12 15 18 9"/>`,
    lock: `<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[name]||''}</svg>`;
}

/* -------------------------------------------------------------------------
   Persistència local de la identitat (per no haver de tornar a identificar-se
   cada vegada que s'obre l'app en aquest dispositiu/navegador)
   ------------------------------------------------------------------------- */
function identityKey(code){ return `familyAccount_identity_${code}`; }
function saveIdentity(code, id, name){
  try{ localStorage.setItem(identityKey(code), JSON.stringify({id,name})); }catch(e){}
}
function loadIdentity(code){
  try{
    const raw = localStorage.getItem(identityKey(code));
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}

/* -------------------------------------------------------------------------
   Càlcul del repartiment.
   Cada despesa es divideix, entre els participants seleccionats en ella,
   proporcionalment al nombre de persones que representa cadascú.
   ------------------------------------------------------------------------- */
function computeSettlement(participants, expenses){
  const totalCents = expenses.reduce((s,e)=>s+Math.round(e.amount*100),0);
  const totalUnits = participants.reduce((s,p)=>s+p.familySize,0);

  const paidCents = {}; const owedCents = {};
  participants.forEach(p=>{ paidCents[p.id]=0; owedCents[p.id]=0; });

  expenses.forEach(e=>{
    const amtCents = Math.round(e.amount*100);
    if (Object.prototype.hasOwnProperty.call(paidCents, e.payerId)){
      paidCents[e.payerId] += amtCents;
    }
    const includedIds = participants
      .filter(p => (e.participantIds||[]).includes(p.id))
      .map(p=>p.id);
    const unitsSum = includedIds.reduce((s,id)=>{
      const p = participants.find(pp=>pp.id===id);
      return s + (p ? p.familySize : 0);
    }, 0);
    if (unitsSum <= 0) return;
    let distributed = 0;
    includedIds.forEach((id, idx)=>{
      const p = participants.find(pp=>pp.id===id);
      let share;
      if (idx === includedIds.length-1){
        share = amtCents - distributed;
      } else {
        share = Math.round(amtCents * (p.familySize/unitsSum));
      }
      distributed += share;
      owedCents[id] += share;
    });
  });

  const balances = participants.map(p=>({
    id: p.id, name: p.name,
    balanceCents: (paidCents[p.id]||0) - (owedCents[p.id]||0)
  }));
  const creditors = balances.filter(b=>b.balanceCents>0.5).map(b=>({...b})).sort((a,b)=>b.balanceCents-a.balanceCents);
  const debtors = balances.filter(b=>b.balanceCents<-0.5).map(b=>({...b})).sort((a,b)=>a.balanceCents-b.balanceCents);
  const transactions=[];
  let ci=0, di=0;
  while(ci<creditors.length && di<debtors.length){
    const c=creditors[ci], d=debtors[di];
    const amount = Math.min(c.balanceCents, -d.balanceCents);
    if (amount>0.5) transactions.push({from:d.name, to:c.name, cents:amount});
    c.balanceCents -= amount; d.balanceCents += amount;
    if (c.balanceCents<0.5) ci++;
    if (d.balanceCents>-0.5) di++;
  }
  return {transactions, totalCents, totalUnits, paidCents, owedCents};
}

/* -------------------------------------------------------------------------
   Diàleg de confirmació genèric (per a accions que no es poden desfer
   fàcilment, com eliminar una despesa o tancar la trobada)
   ------------------------------------------------------------------------- */
function showConfirmDialog({title, message, confirmLabel, cancelLabel, danger}, onConfirm){
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-dialog">
      <h3 class="font-display">${escapeHtml(title||'')}</h3>
      <p>${escapeHtml(message||'')}</p>
      <div class="confirm-actions">
        <button class="btn-outline confirm-cancel-btn">${escapeHtml(cancelLabel||'Cancel·la')}</button>
        <button class="btn-primary confirm-ok-btn ${danger?'btn-danger':''}">${escapeHtml(confirmLabel||'Confirma')}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  function close(){ overlay.remove(); }
  overlay.addEventListener('click', e=>{ if (e.target===overlay) close(); });
  overlay.querySelector('.confirm-cancel-btn').onclick = close;
  overlay.querySelector('.confirm-ok-btn').onclick = ()=>{ close(); onConfirm(); };
}

/* ========================================================================= */

function render(){
  if (!firebaseReady){ renderSetupNeeded(); return; }
  if (state.screen === 'landing') renderLanding();
  else if (state.screen === 'identify') renderIdentify();
  else renderEvent();
}

function renderSetupNeeded(){
  root.innerHTML = `
    <div class="setup-box">
      <h2>Cal connectar una base de dades gratuïta</h2>
      <p>Aquesta app necessita un projecte de <b>Firebase</b> (gratuït) perquè totes les persones puguin veure i afegir dades a la mateixa trobada des de qualsevol dispositiu.</p>
      <p>Obre l'arxiu <code>index.html</code>, busca la secció <code>firebaseConfig</code> a l'inici del <code>&lt;script&gt;</code>, i substitueix-la per la configuració del teu projecte de Firebase. Un cop fet, torna a pujar l'arxiu al teu hosting.</p>
    </div>`;
}

function renderLanding(){
  root.innerHTML = `
    <div class="screen">
      <div class="ledger-card" style="padding:20px 20px 20px 26px;">
        <h2 class="font-display" style="font-size:18px;font-weight:600;margin:0 0 4px;">Uneix-te a una trobada</h2>
        <p style="font-size:13px;opacity:0.65;margin:0 0 14px;">Introdueix el codi que t'han passat.</p>
        <div style="display:flex;gap:8px;">
          <input id="join-input" type="text" placeholder="p.ex. DINAR-482" class="font-mono" style="flex:1;">
          <button id="join-btn" class="btn-primary" style="width:auto;padding:12px 18px;white-space:nowrap;" ${state.loading?'disabled':''}>Entra</button>
        </div>
      </div>
      <div class="divider-row"><div class="line"></div><span>o bé</span><div class="line"></div></div>
      <div class="ledger-card" style="padding:20px 20px 20px 26px;">
        <h2 class="font-display" style="font-size:18px;font-weight:600;margin:0 0 4px;">Crea una trobada nova</h2>
        <p style="font-size:13px;opacity:0.65;margin:0 0 14px;">Posa-li un nom, p. ex. "Dinar de Nadal".</p>
        <div style="display:flex;gap:8px;">
          <input id="create-name-input" type="text" placeholder="Nom de la trobada" style="flex:1;">
          <button id="create-btn" class="btn-primary" style="width:auto;padding:12px 18px;white-space:nowrap;" ${state.loading?'disabled':''}>Crea</button>
        </div>
      </div>
      ${state.error ? `<p class="error-text" style="text-align:center;">${state.error}</p>` : ''}
    </div>`;

  document.getElementById('create-btn').onclick = handleCreate;
  document.getElementById('join-btn').onclick = handleJoin;
  const joinInput = document.getElementById('join-input');
  joinInput.addEventListener('keydown', e=>{ if (e.key==='Enter') handleJoin(); });
  const createInput = document.getElementById('create-name-input');
  createInput.addEventListener('keydown', e=>{ if (e.key==='Enter') handleCreate(); });
}

async function handleCreate(){
  const nameInput = document.getElementById('create-name-input');
  const typedName = (nameInput && nameInput.value || '').trim();
  const finalName = typedName || 'Trobada familiar';
  state.error=''; state.loading=true; render();
  try{
    let newCode = generateCode();
    const existing = await db.collection('events').doc(newCode).get();
    if (existing.exists) newCode = generateCode();
    await db.collection('events').doc(newCode).set({ name: finalName, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    await enterCodeFlow(newCode, finalName);
  }catch(e){
    state.loading=false;
    state.error = "No s'ha pogut crear la trobada. Torna-ho a provar.";
    render();
  }
}

async function handleJoin(){
  const input = document.getElementById('join-input');
  const trimmed = (input.value||'').trim().toUpperCase();
  if (!trimmed) return;
  state.error=''; state.loading=true; render();
  try{
    const docSnap = await db.collection('events').doc(trimmed).get();
    if (!docSnap.exists){
      state.loading=false;
      state.error = "No s'ha trobat cap trobada amb aquest codi. Revisa-ho amb qui te l'ha donat.";
      render();
      return;
    }
    await enterCodeFlow(trimmed, docSnap.data().name || 'Trobada familiar');
  }catch(e){
    state.loading=false;
    state.error = "No s'ha trobat cap trobada amb aquest codi. Revisa-ho amb qui te l'ha donat.";
    render();
  }
}

// Un cop el codi és vàlid: si ja ens vam identificar abans en aquest
// dispositiu, hi entrem directament. Si no, mostrem la pantalla d'identificació.
async function enterCodeFlow(code, eventName){
  state.code = code;
  state.eventName = eventName;
  const saved = loadIdentity(code);
  if (saved && saved.id){
    try{
      const snap = await db.collection('events').doc(code).collection('participants').doc(saved.id).get();
      if (snap.exists){
        state.myParticipantId = saved.id;
        state.myName = snap.data().name;
        state.loading = false;
        state.screen = 'event';
        subscribeToRoom(code);
        render();
        return;
      }
    }catch(e){ /* si falla, seguim cap a identificació */ }
  }
  state.loading = false;
  state.screen = 'identify';
  render();
}

function renderIdentify(){
  root.innerHTML = `
    <div class="screen">
      <div class="ledger-card identify-card">
        <h2 class="font-display" style="font-size:19px;font-weight:600;margin:0 0 4px;">Qui ets?</h2>
        <p style="font-size:13px;opacity:0.65;margin:0 0 16px;">T'estàs unint a <b>${escapeHtml(state.eventName)}</b>. Digue'ns qui ets per poder anotar el que pagues.</p>
        <label class="field-label">El teu nom</label>
        <input id="id-name" type="text" placeholder="p. ex. Tia Montse" style="margin-bottom:14px;">
        <label class="field-label">Persones que representes (tu i, si escau, la teva unitat familiar)</label>
        <div class="stepper">
          <button id="id-minus">${icon('minus','#1F3A3D',18)}</button>
          <div class="val" id="id-family-val">1</div>
          <button id="id-plus">${icon('plus','#1F3A3D',18)}</button>
          <span class="unit">persones</span>
        </div>
        <div id="id-error"></div>
        <button id="id-submit" class="btn-primary">Entra a la sala</button>
        <button id="id-back" class="btn-link" style="margin-top:10px;">Torna enrere</button>
      </div>
    </div>`;

  let familySize = 1;
  const valEl = document.getElementById('id-family-val');
  document.getElementById('id-minus').onclick = ()=>{ familySize = Math.max(1, familySize-1); valEl.textContent = familySize; };
  document.getElementById('id-plus').onclick = ()=>{ familySize = Math.min(20, familySize+1); valEl.textContent = familySize; };
  document.getElementById('id-back').onclick = ()=>{ state.screen='landing'; state.code=null; render(); };

  const nameInput = document.getElementById('id-name');
  nameInput.focus();
  nameInput.addEventListener('keydown', e=>{ if (e.key==='Enter') submitIdentify(); });
  document.getElementById('id-submit').onclick = submitIdentify;

  async function submitIdentify(){
    const nameVal = nameInput.value.trim();
    const errEl = document.getElementById('id-error');
    if (!nameVal){ errEl.innerHTML = `<p class="error-text" style="margin:0 0 12px;">Cal un nom.</p>`; return; }
    errEl.innerHTML = '';
    const btn = document.getElementById('id-submit');
    btn.disabled = true; btn.textContent = 'Entrant...';
    try{
      const id = await addParticipant(state.code, nameVal, familySize);
      state.myParticipantId = id;
      state.myName = nameVal;
      saveIdentity(state.code, id, nameVal);
      state.screen = 'event';
      subscribeToRoom(state.code);
      render();
    }catch(e){
      console.error("Error en identificar-se:", e);
      errEl.innerHTML = `<p class="error-text" style="margin:0 0 12px;">No s'ha pogut entrar. Torna-ho a provar.</p>`;
      btn.disabled = false; btn.textContent = 'Entra a la sala';
    }
  }
}

// Crea un participant nou i l'afegeix automàticament a totes les despeses
// ja existents de la trobada (perquè hi pugui participar en el repartiment).
async function addParticipant(code, name, familySize){
  const eventRef = db.collection('events').doc(code);
  // Aquesta escriptura és la que compta de veritat: crear el participant.
  // Si falla, sí que volem que l'usuari vegi l'error i pugui reintentar-ho.
  const participantRef = await eventRef.collection('participants').add({
    name, familySize, createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  // Enganxar el nou participant a les despeses existents és un extra: si
  // falla (p. ex. per regles de seguretat pendents d'actualitzar a Firestore),
  // no volem que bloquegi l'entrada a la sala. Ho intentem però no petem.
  try{
    const expensesSnap = await eventRef.collection('expenses').get();
    if (!expensesSnap.empty){
      const batch = db.batch();
      expensesSnap.forEach(doc=>{
        const data = doc.data();
        const ids = data.participantIds || [];
        if (!ids.includes(participantRef.id)){
          batch.update(doc.ref, { participantIds: [...ids, participantRef.id] });
        }
      });
      await batch.commit();
    }
  }catch(e){
    console.warn("No s'ha pogut afegir el nou participant a les despeses existents (revisa les regles de Firestore per a la col·lecció 'expenses'):", e);
  }
  return participantRef.id;
}

function subscribeToRoom(code){
  if (unsubParticipants) unsubParticipants();
  if (unsubExpenses) unsubExpenses();
  if (unsubEventMeta) unsubEventMeta();
  unsubEventMeta = db.collection('events').doc(code)
    .onSnapshot(docSnap=>{
      if (!docSnap.exists) return;
      const data = docSnap.data();
      const wasClosed = state.closed;
      state.closed = !!data.closed;
      state.eventName = data.name || state.eventName;
      if (wasClosed !== state.closed){
        state.expensesAccordionOpen = false;
        if (state.screen === 'event') renderEvent();
      }
    });
  unsubParticipants = db.collection('events').doc(code).collection('participants')
    .orderBy('createdAt','asc')
    .onSnapshot(snapshot=>{
      state.participants = snapshot.docs.map(d=>({id:d.id, ...d.data()}));
      state.connected = true;
      renderDynamicSections();
    }, err=>{
      state.connected = false;
      renderDynamicSections();
    });
  unsubExpenses = db.collection('events').doc(code).collection('expenses')
    .orderBy('createdAt','asc')
    .onSnapshot(snapshot=>{
      state.expenses = snapshot.docs.map(d=>({id:d.id, ...d.data()}));
      state.connected = true;
      renderDynamicSections();
    }, err=>{
      state.connected = false;
      renderDynamicSections();
    });
}

function renderEvent(){
  const shareUrl = buildShareUrl(state.code);

  const headerHtml = `
      <div class="event-name-row">
        <h1 class="font-display">${escapeHtml(state.eventName)}</h1>
        ${state.closed ? `<span class="closed-badge" title="La trobada està tancada">${icon('lock','#A8462F',13)} Tancada</span>` : ''}
      </div>
      <div class="code-bar">
        <div>
          <div class="label">Codi de la trobada</div>
          <div class="code font-mono">${state.code}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <span class="status-dot ${state.connected?'':'offline'}" id="status-dot"><span class="dot"></span>${state.connected?'en directe':'sense connexió'}</span>
          <button id="copy-btn" class="btn-icon" title="Copia el codi">${icon('copy','#1F3A3D',17)}</button>
        </div>
      </div>
      <div class="code-bar" style="margin-top:8px;">
        <div style="min-width:0;">
          <div class="label">Enllaç per compartir</div>
          <div class="link-text font-mono">${escapeHtml(shareUrl)}</div>
        </div>
        <button id="copy-link-btn" class="btn-icon" title="Copia l'enllaç">${icon('copy','#1F3A3D',17)}</button>
      </div>
      <p class="hint-text">Comparteix l'enllaç (per WhatsApp, per exemple) perquè tothom hi entri directament, sense haver de teclejar el codi.</p>`;

  const participantsSectionHtml = `
      <div>
        <div class="section-head accordion-head" id="participants-section-head">
          <h2 class="font-display">Participants</h2>
          <button id="participants-accordion-toggle" class="accordion-toggle-btn" title="Mostra o amaga els participants">${icon('chevron','#1F3A3D',18)}</button>
        </div>
        <div id="participants-list"></div>
        <div id="add-participant-container"></div>
      </div>`;

  const expensesSectionHtml = `
      <div>
        <div class="section-head ${state.closed ? 'accordion-head' : ''}" id="expenses-section-head">
          <h2 class="font-display">Despeses</h2>
          ${state.closed ? `<button id="expenses-accordion-toggle" class="accordion-toggle-btn" title="Mostra o amaga les despeses">${icon('chevron','#1F3A3D',18)}</button>` : ''}
        </div>
        ${!state.closed ? `<button id="add-expense-btn" class="btn-add-expense">${icon('plus','#FBF7EC',19)} Afegeix una despesa</button>` : ''}
        <div id="expense-form-container"></div>
        <div id="expenses-list"></div>
      </div>`;

  const summarySettlementHtml = `
      <div id="summary-container"></div>
      <div id="settlement-container"></div>`;

  const closeReopenHtml = state.closed
    ? `<button id="reopen-event-btn" class="btn-outline" style="border-color:var(--sage);color:var(--sage);">${icon('check','#4F7355',16)} Reobre la trobada</button>`
    : `<button id="close-event-btn" class="btn-outline" style="border-color:var(--rust);color:var(--rust);">${icon('lock','#A8462F',16)} Tanca la trobada</button>`;

  root.innerHTML = `
    <div class="screen">
      ${headerHtml}
      ${state.closed ? summarySettlementHtml : ''}
      ${participantsSectionHtml}
      ${expensesSectionHtml}
      ${!state.closed ? summarySettlementHtml : ''}
      ${closeReopenHtml}
      <button id="leave-btn" class="btn-link" style="align-self:center;">Surt d'aquesta trobada</button>
    </div>`;

  document.getElementById('copy-btn').onclick = handleCopy;
  document.getElementById('copy-link-btn').onclick = ()=> handleCopyLink(shareUrl);
  document.getElementById('leave-btn').onclick = handleLeave;

  // Accordió de participants: sempre plegable, tant si la trobada està
  // oberta com tancada.
  const participantsHead = document.getElementById('participants-section-head');
  const participantsToggleBtn = document.getElementById('participants-accordion-toggle');
  const participantsListEl = document.getElementById('participants-list');
  const addParticipantEl = document.getElementById('add-participant-container');
  const applyParticipantsAccordionState = ()=>{
    const open = state.participantsAccordionOpen;
    participantsListEl.style.display = open ? '' : 'none';
    if (addParticipantEl) addParticipantEl.style.display = open ? '' : 'none';
    participantsToggleBtn.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
  };
  applyParticipantsAccordionState();
  participantsHead.onclick = ()=>{ state.participantsAccordionOpen = !state.participantsAccordionOpen; applyParticipantsAccordionState(); };

  if (state.closed){
    document.getElementById('reopen-event-btn').onclick = handleReopenEvent;
    const head = document.getElementById('expenses-section-head');
    const toggleBtn = document.getElementById('expenses-accordion-toggle');
    const listEl = document.getElementById('expenses-list');
    const applyAccordionState = ()=>{
      listEl.style.display = state.expensesAccordionOpen ? '' : 'none';
      toggleBtn.style.transform = state.expensesAccordionOpen ? 'rotate(180deg)' : 'rotate(0deg)';
    };
    applyAccordionState();
    head.onclick = ()=>{ state.expensesAccordionOpen = !state.expensesAccordionOpen; applyAccordionState(); };
  } else {
    document.getElementById('close-event-btn').onclick = handleCloseEvent;
    document.getElementById('add-expense-btn').onclick = ()=>{
      state.editingExpenseId = null;
      state.showExpenseForm = true;
      renderExpenseForm();
    };
  }

  renderAddParticipantForm();
  renderExpenseForm();
  renderDynamicSections();
}

function handleCloseEvent(){
  showConfirmDialog({
    title: 'Tancar la trobada?',
    message: "Es mostrarà el repartiment a dalt de tot i no es podran afegir ni editar despeses o participants fins que la reobris.",
    confirmLabel: 'Tanca la trobada',
    danger: true
  }, async ()=>{
    try{
      await db.collection('events').doc(state.code).update({ closed: true });
    }catch(e){
      console.error("No s'ha pogut tancar la trobada:", e);
    }
  });
}

async function handleReopenEvent(){
  try{
    await db.collection('events').doc(state.code).update({ closed: false });
  }catch(e){
    console.error("No s'ha pogut reobrir la trobada:", e);
  }
}

// Construeix un enllaç directe a la sala (paràmetre ?sala=CODI a l'URL
// actual) perquè es pugui compartir sense haver de teclejar el codi.
// Nota: un subdomini diferent per sala requeriria configuració de DNS i
// hosting a nivell de servidor; aquest enllaç aconsegueix el mateix efecte
// (entrar-hi directament amb un clic) sense necessitar-ho.
function buildShareUrl(code){
  return `${window.location.origin}${window.location.pathname}?sala=${encodeURIComponent(code)}`;
}

function handleCopyLink(url){
  try{
    navigator.clipboard.writeText(url);
  }catch(e){}
}

function handleCopy(){
  try{
    navigator.clipboard.writeText(state.code);
  }catch(e){}
}

function handleLeave(){
  if (unsubParticipants) { unsubParticipants(); unsubParticipants=null; }
  if (unsubExpenses) { unsubExpenses(); unsubExpenses=null; }
  if (unsubEventMeta) { unsubEventMeta(); unsubEventMeta=null; }
  state = {...state, screen:'landing', code:null, participants:[], expenses:[], myParticipantId:null,
    myName:'', error:'', showAddParticipant:false, showExpenseForm:false, editingExpenseId:null,
    closed:false, expensesAccordionOpen:false};
  render();
}

/* -------------------------------------------------------------------------
   Afegir participant (algú que no pot entrar-hi però ha de pagar igualment)
   ------------------------------------------------------------------------- */
function renderAddParticipantForm(){
  const container = document.getElementById('add-participant-container');
  if (!container) return;
  if (state.closed){ container.innerHTML=''; return; }
  if (!state.showAddParticipant){
    container.innerHTML = `<button id="show-add-participant" class="add-toggle" style="margin-bottom:6px;">${icon('plus','#C0821E',16)} Afegeix un participant que no hi és</button>`;
    document.getElementById('show-add-participant').onclick = ()=>{ state.showAddParticipant=true; renderAddParticipantForm(); };
    return;
  }
  container.innerHTML = `
    <div class="ledger-card form-card">
      <div class="form-head">
        <h3 class="font-display">Afegeix un participant</h3>
        <button id="close-add-participant" class="close-form">${icon('x','#1F3A3D',18)}</button>
      </div>
      <label class="field-label">Nom</label>
      <input id="ap-name" type="text" placeholder="p. ex. Avi Josep" style="margin-bottom:14px;">
      <label class="field-label">Persones que representa</label>
      <div class="stepper">
        <button id="ap-minus">${icon('minus','#1F3A3D',18)}</button>
        <div class="val" id="ap-family-val">1</div>
        <button id="ap-plus">${icon('plus','#1F3A3D',18)}</button>
        <span class="unit">persones</span>
      </div>
      <p class="hint-text" style="margin:0 0 14px;">Se l'afegirà automàticament a totes les despeses ja creades.</p>
      <div id="ap-error"></div>
      <button id="ap-submit" class="btn-primary">Afegeix el participant</button>
    </div>`;

  let familySize = 1;
  const valEl = document.getElementById('ap-family-val');
  document.getElementById('ap-minus').onclick = ()=>{ familySize = Math.max(1, familySize-1); valEl.textContent = familySize; };
  document.getElementById('ap-plus').onclick = ()=>{ familySize = Math.min(20, familySize+1); valEl.textContent = familySize; };
  document.getElementById('close-add-participant').onclick = ()=>{ state.showAddParticipant=false; renderAddParticipantForm(); };

  document.getElementById('ap-submit').onclick = async ()=>{
    const nameVal = document.getElementById('ap-name').value.trim();
    const errEl = document.getElementById('ap-error');
    if (!nameVal){ errEl.innerHTML = `<p class="error-text" style="margin:0 0 12px;">Cal un nom.</p>`; return; }
    errEl.innerHTML='';
    const btn = document.getElementById('ap-submit');
    btn.disabled = true; btn.textContent = 'Desant...';
    try{
      await addParticipant(state.code, nameVal, familySize);
      state.showAddParticipant = false;
      renderAddParticipantForm();
    }catch(e){
      errEl.innerHTML = `<p class="error-text" style="margin:0 0 12px;">No s'ha pogut desar. Torna-ho a provar.</p>`;
      btn.disabled=false; btn.textContent='Afegeix el participant';
    }
  };
}

async function deleteParticipant(id){
  try{
    const eventRef = db.collection('events').doc(state.code);
    await eventRef.collection('participants').doc(id).delete();
    try{
      const expensesSnap = await eventRef.collection('expenses').get();
      if (!expensesSnap.empty){
        const batch = db.batch();
        expensesSnap.forEach(doc=>{
          const data = doc.data();
          const ids = (data.participantIds||[]).filter(pid=>pid!==id);
          if (ids.length !== (data.participantIds||[]).length){
            batch.update(doc.ref, { participantIds: ids });
          }
        });
        await batch.commit();
      }
    }catch(e){
      console.warn("No s'ha pogut netejar el participant eliminat de les despeses existents:", e);
    }
    if (id === state.myParticipantId){
      state.myParticipantId = null;
      try{ localStorage.removeItem(identityKey(state.code)); }catch(e){}
    }
  }catch(e){
    console.error("No s'ha pogut eliminar el participant:", e);
  }
}

/* -------------------------------------------------------------------------
   Formulari de despesa (crear / editar)
   ------------------------------------------------------------------------- */
function renderExpenseForm(){
  const container = document.getElementById('expense-form-container');
  if (!container) return;
  if (!state.showExpenseForm){ container.innerHTML=''; return; }

  const editing = state.expenses.find(e=>e.id===state.editingExpenseId) || null;
  const defaultPayer = editing ? editing.payerId : (state.myParticipantId || (state.participants[0] && state.participants[0].id) || '');
  const defaultSelected = editing ? (editing.participantIds||[]) : state.participants.map(p=>p.id);

  const payerOptions = state.participants.map(p=>
    `<option value="${p.id}" ${p.id===defaultPayer?'selected':''}>${escapeHtml(p.name)}</option>`
  ).join('');

  const checklist = state.participants.map(p=>`
    <label class="checkbox-item">
      <input type="checkbox" data-pid="${p.id}" ${defaultSelected.includes(p.id)?'checked':''}>
      <span>${escapeHtml(p.name)} <span class="checkbox-item-units">(${p.familySize} ${p.familySize===1?'persona':'persones'})</span></span>
    </label>`).join('');

  container.innerHTML = `
    <div class="ledger-card form-card">
      <div class="form-head">
        <h3 class="font-display">${editing ? 'Edita la despesa' : 'Nova despesa'}</h3>
        <button id="close-expense-form" class="close-form">${icon('x','#1F3A3D',18)}</button>
      </div>
      <label class="field-label">Qui ha pagat</label>
      <select id="e-payer" style="margin-bottom:14px;">${payerOptions}</select>
      <label class="field-label">Concepte</label>
      <input id="e-concept" type="text" placeholder="p. ex. Supermercat, benzina..." value="${editing?escapeHtml(editing.concept):''}" style="margin-bottom:14px;">
      <label class="field-label">Preu (€)</label>
      <input id="e-amount" type="text" inputmode="decimal" placeholder="0,00" value="${editing?String(editing.amount).replace('.',','):''}" style="margin-bottom:16px;">
      <label class="field-label">Qui ha de pagar aquesta despesa</label>
      <p class="hint-text" style="margin:-2px 0 8px;">Desmarca qui no hi ha de participar.</p>
      <div class="checkbox-list" id="e-checklist">${checklist || '<p class="hint-text" style="margin:0;">Encara no hi ha participants.</p>'}</div>
      <div id="e-error"></div>
      <div style="display:flex;gap:8px;margin-top:16px;">
        ${editing ? `<button id="e-delete" class="btn-outline" style="border-color:#A8462F;flex:1;">${icon('trash','#A8462F',16)} Elimina</button>` : ''}
        <button id="e-submit" class="btn-primary" style="flex:2;">${editing ? 'Desa els canvis' : 'Afegeix la despesa'}</button>
      </div>
    </div>`;

  document.getElementById('close-expense-form').onclick = ()=>{
    state.showExpenseForm=false; state.editingExpenseId=null; renderExpenseForm();
  };

  if (editing){
    document.getElementById('e-delete').onclick = ()=>{
      showConfirmDialog({
        title: 'Eliminar aquesta despesa?',
        message: `"${editing.concept}" (${euros(editing.amount)}) s'eliminarà i deixarà de comptar en el repartiment. Aquesta acció no es pot desfer.`,
        confirmLabel: 'Elimina la despesa',
        danger: true
      }, async ()=>{
        const btn = document.getElementById('e-delete');
        if (btn) btn.disabled = true;
        try{
          await db.collection('events').doc(state.code).collection('expenses').doc(editing.id).delete();
          state.showExpenseForm=false; state.editingExpenseId=null; renderExpenseForm();
        }catch(e){
          if (btn) btn.disabled = false;
          const errEl2 = document.getElementById('e-error');
          if (errEl2) errEl2.innerHTML = `<p class="error-text" style="margin:8px 0 0;">No s'ha pogut eliminar. Torna-ho a provar.</p>`;
        }
      });
    };
  }

  document.getElementById('e-submit').onclick = async ()=>{
    const payerId = document.getElementById('e-payer').value;
    const concept = document.getElementById('e-concept').value.trim();
    const amountRaw = document.getElementById('e-amount').value.replace(',', '.');
    const amt = parseFloat(amountRaw);
    const checked = Array.from(document.querySelectorAll('#e-checklist input[type=checkbox]:checked')).map(cb=>cb.getAttribute('data-pid'));
    const errEl = document.getElementById('e-error');

    if (!payerId){ errEl.innerHTML = `<p class="error-text" style="margin:8px 0 0;">Cal seleccionar qui ha pagat.</p>`; return; }
    if (!concept){ errEl.innerHTML = `<p class="error-text" style="margin:8px 0 0;">Cal un concepte.</p>`; return; }
    if (isNaN(amt) || amt<0){ errEl.innerHTML = `<p class="error-text" style="margin:8px 0 0;">Introdueix un import vàlid.</p>`; return; }
    if (checked.length===0){ errEl.innerHTML = `<p class="error-text" style="margin:8px 0 0;">Selecciona qui ha de pagar aquesta despesa.</p>`; return; }
    errEl.innerHTML='';

    const submitBtn = document.getElementById('e-submit');
    submitBtn.disabled = true; submitBtn.textContent = 'Desant...';
    try{
      const data = { payerId, concept, amount: amt, participantIds: checked };
      if (editing){
        await db.collection('events').doc(state.code).collection('expenses').doc(editing.id).update(data);
      } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('events').doc(state.code).collection('expenses').add(data);
      }
      state.showExpenseForm=false; state.editingExpenseId=null; renderExpenseForm();
    }catch(e){
      errEl.innerHTML = `<p class="error-text" style="margin:8px 0 0;">No s'ha pogut desar. Torna-ho a provar.</p>`;
      submitBtn.disabled=false; submitBtn.textContent = editing ? 'Desa els canvis' : 'Afegeix la despesa';
    }
  };
}

function openEditExpense(id){
  state.editingExpenseId = id;
  state.showExpenseForm = true;
  renderExpenseForm();
  const formEl = document.getElementById('expense-form-container');
  if (formEl) formEl.scrollIntoView({behavior:'smooth', block:'start'});
}

/* -------------------------------------------------------------------------
   Llistats dinàmics: participants, despeses (agrupades per qui paga), resum
   ------------------------------------------------------------------------- */
function renderDynamicSections(){
  const participantsEl = document.getElementById('participants-list');
  const expensesEl = document.getElementById('expenses-list');
  const summaryEl = document.getElementById('summary-container');
  const settlementEl = document.getElementById('settlement-container');
  const statusEl = document.getElementById('status-dot');
  if (statusEl) statusEl.className = `status-dot ${state.connected?'':'offline'}`;
  if (!participantsEl) return;

  const participants = state.participants;
  const expenses = state.expenses;
  const s = computeSettlement(participants, expenses);

  // --- Participants ---
  if (participants.length === 0){
    participantsEl.innerHTML = `<div class="ledger-card empty-state"><p>Encara no hi ha participants. Identifica't o afegeix-ne un! 🎉</p></div>`;
  } else {
    participantsEl.innerHTML = participants.map(p => `
      <div class="ledger-card participant-row">
        <div style="min-width:0;">
          <div class="pname">${escapeHtml(p.name)}${p.id===state.myParticipantId?' <span class="me-badge">tu</span>':''}</div>
          <div class="pfamily">${icon('users','currentColor',12)} ${p.familySize} ${p.familySize===1?'persona':'persones'}</div>
        </div>
        <div class="prow-right">
          <div class="pamount font-mono">${euros((s.paidCents[p.id]||0)/100)}</div>
          ${!state.closed ? `<button class="del-btn" data-id="${p.id}" title="Elimina participant">${icon('trash','#A8462F',16)}</button>` : ''}
        </div>
      </div>`).join('');
    participantsEl.querySelectorAll('.del-btn').forEach(btn=>{
      btn.onclick = ()=> deleteParticipant(btn.getAttribute('data-id'));
    });
  }

  // --- Despeses, agrupades per qui paga ---
  if (!expensesEl) { /* no-op */ }
  else if (expenses.length === 0){
    expensesEl.innerHTML = `<div class="ledger-card empty-state"><p>Encara no hi ha cap despesa apuntada.</p></div>`;
  } else {
    const order = []; // ordre d'aparició dels pagadors
    expenses.forEach(e=>{ if (!order.includes(e.payerId)) order.push(e.payerId); });

    expensesEl.innerHTML = order.map(payerId=>{
      const payer = participants.find(p=>p.id===payerId);
      const payerName = payer ? payer.name : 'Participant eliminat';
      const payerExpenses = expenses.filter(e=>e.payerId===payerId);
      const groupTotal = payerExpenses.reduce((s,e)=>s+e.amount,0);
      const rows = payerExpenses.map(e=>{
        const includedNames = participants.filter(p=>(e.participantIds||[]).includes(p.id)).map(p=>p.name);
        const splitNote = includedNames.length === participants.length
          ? 'entre tothom'
          : (includedNames.length===0 ? 'sense repartir' : `entre ${includedNames.length} persones`);
        return `
          <div class="expense-row" data-id="${e.id}">
            <div style="min-width:0;">
              <div class="expense-concept">${escapeHtml(e.concept)}</div>
              <div class="expense-split-note">${icon('receipt','currentColor',12)} ${splitNote}</div>
            </div>
            <div class="prow-right">
              <div class="pamount font-mono">${euros(e.amount)}</div>
              ${!state.closed ? `<button class="edit-expense-btn" data-id="${e.id}" title="Edita">${icon('pencil','#1F3A3D',14)} Edita</button>` : ''}
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

    if (!state.closed){
      expensesEl.querySelectorAll('.edit-expense-btn').forEach(btn=>{
        btn.onclick = ()=> openEditExpense(btn.getAttribute('data-id'));
      });
    }
  }

  if (participants.length === 0 && expenses.length === 0){
    summaryEl.innerHTML=''; settlementEl.innerHTML='';
    return;
  }

  summaryEl.innerHTML = `
    <div class="ledger-card summary-card">
      <h2 class="font-display">Resum</h2>
      <div class="summary-row"><span class="k">Total gastat</span><span class="v font-mono">${euros(s.totalCents/100)}</span></div>
      <div class="summary-row"><span class="k">Persones representades</span><span class="v font-mono">${s.totalUnits}</span></div>
      <div class="summary-row"><span class="k">Nombre de despeses</span><span class="v font-mono">${expenses.length}</span></div>
    </div>`;

  settlementEl.innerHTML = `
    <div>
      <h2 class="font-display" style="font-size:17px;font-weight:600;margin:18px 0 10px;">${state.closed ? 'Repartiment' : 'Repartiment provisional'}</h2>
      ${ s.transactions.length===0
        ? `<div class="ledger-card empty-state"><p>Tothom ha pagat la seva part justa. Res a repartir! ✅</p></div>`
        : s.transactions.map(t=>`
            <div class="ledger-card txn-row">
              <div class="txn-names">
                <span class="from">${escapeHtml(t.from)}</span>
                ${icon('arrow','currentColor',15)}
                <span class="to">${escapeHtml(t.to)}</span>
              </div>
              <div class="txn-amount font-mono">${euros(t.cents/100)}</div>
            </div>`).join('')
      }
    </div>`;
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// En carregar la pàgina, si l'URL porta un ?sala=CODI (enllaç compartit),
// hi entrem directament sense passar per la pantalla d'introduir el codi.
async function init(){
  if (!firebaseReady){ render(); return; }
  const params = new URLSearchParams(window.location.search);
  const urlCode = (params.get('sala')||'').trim().toUpperCase();
  if (urlCode){
    state.loading = true;
    render();
    try{
      const docSnap = await db.collection('events').doc(urlCode).get();
      if (docSnap.exists){
        await enterCodeFlow(urlCode, docSnap.data().name || 'Trobada familiar');
        return;
      }
    }catch(e){ /* seguim cap a la pantalla normal */ }
    state.loading = false;
    state.error = "Aquest enllaç no és vàlid o la trobada ja no existeix.";
    render();
    return;
  }
  render();
}

init();
