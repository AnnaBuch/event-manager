/* =========================================================================
   APP.JS — només lògica de funcionament
   No conté cap tros d'HTML: només l'estat de l'aplicació, el "router" que
   munta la pantalla adequada dins de #root, i els handlers que responen als
   esdeveniments ('app-event') que disparen els components.
   ========================================================================= */

import * as fb from '../js/firebase-service.js';
import { euros } from '../js/utils.js';

// Registra tots els components (custom elements) que l'app necessita.
import '../components/setup-needed.js';
import '../components/landing-screen.js';
import '../components/identify-screen.js';
import '../components/event-header.js';
import '../components/participants-section.js';
import '../components/expenses-section.js';
import '../components/summary-section.js';
import '../components/settlement-section.js';
import '../components/event-footer.js';
import '../components/event-screen.js';
import { showConfirmDialog } from '../components/confirm-dialog.js';

const root = document.getElementById('root');

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
  showAddParticipant: false,
  showExpenseForm: false,
  editingExpenseId: null,
  connected: true,
  closed: false,
  expensesAccordionOpen: false,
  participantsAccordionOpen: true,
  identifySubmitting: false,
  identifyError: '',
  savingParticipant: false,
  addParticipantError: '',
  savingExpense: false,
  expenseError: ''
};

let unsubParticipants = null;
let unsubExpenses = null;
let unsubEventMeta = null;

function setState(patch) {
  Object.assign(state, patch);
  render();
}

/* -------------------------------------------------------------------------
   Router: munta la pantalla adequada dins de #root
   ------------------------------------------------------------------------- */
let currentTag = null;
let currentEl = null;

function mountScreen(tag, data) {
  if (currentTag !== tag) {
    root.innerHTML = '';
    currentEl = document.createElement(tag);
    root.appendChild(currentEl);
    currentTag = tag;
  }
  currentEl.data = data;
}

function render() {
  if (!fb.firebaseReady) { mountScreen('setup-needed', {}); return; }

  if (state.screen === 'landing') {
    mountScreen('landing-screen', { loading: state.loading, error: state.error });
  } else if (state.screen === 'identify') {
    mountScreen('identify-screen', {
      eventName: state.eventName,
      submitting: state.identifySubmitting,
      error: state.identifyError
    });
  } else {
    mountScreen('event-screen', {
      eventName: state.eventName,
      code: state.code,
      closed: state.closed,
      connected: state.connected,
      participants: state.participants,
      expenses: state.expenses,
      myParticipantId: state.myParticipantId,
      showAddParticipant: state.showAddParticipant,
      showExpenseForm: state.showExpenseForm,
      editingExpenseId: state.editingExpenseId,
      participantsAccordionOpen: state.participantsAccordionOpen,
      expensesAccordionOpen: state.expensesAccordionOpen,
      savingParticipant: state.savingParticipant,
      addParticipantError: state.addParticipantError,
      savingExpense: state.savingExpense,
      expenseError: state.expenseError
    });
  }
}

/* -------------------------------------------------------------------------
   Un únic listener per a tots els esdeveniments que disparen els components
   ------------------------------------------------------------------------- */
root.addEventListener('app-event', e => handleAppEvent(e.detail));

async function handleAppEvent(detail) {
  switch (detail.type) {
    case 'join': return handleJoin(detail.code);
    case 'create': return handleCreate(detail.name);

    case 'identify-back': return setState({ screen: 'landing', code: null });
    case 'identify-submit': return handleIdentifySubmit(detail.name, detail.familySize);

    case 'copy-code': return handleCopy();
    case 'copy-link': return handleCopyLink(detail.url);
    case 'leave': return handleLeave();

    case 'toggle-participants-accordion':
      return setState({ participantsAccordionOpen: !state.participantsAccordionOpen });
    case 'show-add-participant-form':
      return setState({ showAddParticipant: true, addParticipantError: '' });
    case 'close-add-participant-form':
      return setState({ showAddParticipant: false });
    case 'add-participant-submit':
      return handleAddParticipantSubmit(detail.name, detail.familySize);
    case 'delete-participant':
      return handleDeleteParticipant(detail.id);

    case 'toggle-expenses-accordion':
      return setState({ expensesAccordionOpen: !state.expensesAccordionOpen });
    case 'open-add-expense-form':
      return setState({ showExpenseForm: true, editingExpenseId: null, expenseError: '' });
    case 'close-expense-form':
      return setState({ showExpenseForm: false, editingExpenseId: null });
    case 'edit-expense':
      return setState({ showExpenseForm: true, editingExpenseId: detail.id, expenseError: '' });
    case 'save-expense':
      return handleSaveExpense(detail);
    case 'delete-expense-request':
      return handleDeleteExpenseRequest(detail);

    case 'close-event-request':
      return handleCloseEventRequest();
    case 'reopen-event':
      return handleReopenEvent();

    default:
      console.warn('Esdeveniment desconegut:', detail.type);
  }
}

/* -------------------------------------------------------------------------
   Landing: entrar o crear una trobada
   ------------------------------------------------------------------------- */
async function handleCreate(typedName) {
  const finalName = (typedName || '').trim() || 'Trobada familiar';
  setState({ error: '', loading: true });
  try {
    const newCode = await fb.createEvent(finalName);
    await enterCodeFlow(newCode, finalName);
  } catch (e) {
    setState({ loading: false, error: "No s'ha pogut crear la trobada. Torna-ho a provar." });
  }
}

async function handleJoin(rawCode) {
  const trimmed = (rawCode || '').trim().toUpperCase();
  if (!trimmed) return;
  setState({ error: '', loading: true });
  try {
    const ev = await fb.fetchEvent(trimmed);
    if (!ev) {
      setState({ loading: false, error: "No s'ha trobat cap trobada amb aquest codi. Revisa-ho amb qui te l'ha donat." });
      return;
    }
    await enterCodeFlow(trimmed, ev.name || 'Trobada familiar');
  } catch (e) {
    setState({ loading: false, error: "No s'ha trobat cap trobada amb aquest codi. Revisa-ho amb qui te l'ha donat." });
  }
}

// Un cop el codi és vàlid: si ja ens vam identificar abans en aquest
// dispositiu, hi entrem directament. Si no, mostrem la pantalla d'identificació.
async function enterCodeFlow(code, eventName) {
  state.code = code;
  state.eventName = eventName;
  const saved = fb.loadIdentity(code);
  if (saved && saved.id) {
    try {
      const participant = await fb.fetchParticipant(code, saved.id);
      if (participant) {
        state.myParticipantId = saved.id;
        state.myName = participant.name;
        state.loading = false;
        state.screen = 'event';
        subscribeToRoom(code);
        render();
        return;
      }
    } catch (e) { /* si falla, seguim cap a identificació */ }
  }
  state.loading = false;
  state.screen = 'identify';
  render();
}

/* -------------------------------------------------------------------------
   Identificació
   ------------------------------------------------------------------------- */
async function handleIdentifySubmit(name, familySize) {
  setState({ identifySubmitting: true, identifyError: '' });
  try {
    const id = await fb.addParticipant(state.code, name, familySize);
    fb.saveIdentity(state.code, id, name);
    state.myParticipantId = id;
    state.myName = name;
    state.identifySubmitting = false;
    state.screen = 'event';
    subscribeToRoom(state.code);
    render();
  } catch (e) {
    console.error("Error en identificar-se:", e);
    setState({ identifySubmitting: false, identifyError: "No s'ha pogut entrar. Torna-ho a provar." });
  }
}

/* -------------------------------------------------------------------------
   Subscripcions en temps real a la sala
   ------------------------------------------------------------------------- */
function subscribeToRoom(code) {
  if (unsubParticipants) unsubParticipants();
  if (unsubExpenses) unsubExpenses();
  if (unsubEventMeta) unsubEventMeta();

  unsubEventMeta = fb.subscribeEventMeta(code, data => {
    const wasClosed = state.closed;
    state.closed = !!data.closed;
    state.eventName = data.name || state.eventName;
    if (wasClosed !== state.closed) {
      state.expensesAccordionOpen = false;
    }
    if (state.screen === 'event') render();
  });

  unsubParticipants = fb.subscribeParticipants(code, list => {
    state.participants = list;
    state.connected = true;
    render();
  }, () => { state.connected = false; render(); });

  unsubExpenses = fb.subscribeExpenses(code, list => {
    state.expenses = list;
    state.connected = true;
    render();
  }, () => { state.connected = false; render(); });
}

/* -------------------------------------------------------------------------
   Capçalera de l'esdeveniment: copiar codi/enllaç, tancar/reobrir, sortir
   ------------------------------------------------------------------------- */
function handleCopy() {
  try { navigator.clipboard.writeText(state.code); } catch (e) {}
}
function handleCopyLink(url) {
  try { navigator.clipboard.writeText(url); } catch (e) {}
}

function handleCloseEventRequest() {
  showConfirmDialog({
    title: 'Tancar la trobada?',
    message: "Es mostrarà el repartiment a dalt de tot i no es podran afegir ni editar despeses o participants fins que la reobris.",
    confirmLabel: 'Tanca la trobada',
    danger: true
  }, async () => {
    try { await fb.closeEvent(state.code); }
    catch (e) { console.error("No s'ha pogut tancar la trobada:", e); }
  });
}

async function handleReopenEvent() {
  try { await fb.reopenEvent(state.code); }
  catch (e) { console.error("No s'ha pogut reobrir la trobada:", e); }
}

function handleLeave() {
  if (unsubParticipants) { unsubParticipants(); unsubParticipants = null; }
  if (unsubExpenses) { unsubExpenses(); unsubExpenses = null; }
  if (unsubEventMeta) { unsubEventMeta(); unsubEventMeta = null; }
  state = {
    ...state, screen: 'landing', code: null, participants: [], expenses: [], myParticipantId: null,
    myName: '', error: '', showAddParticipant: false, showExpenseForm: false, editingExpenseId: null,
    closed: false, expensesAccordionOpen: false
  };
  render();
}

/* -------------------------------------------------------------------------
   Participants
   ------------------------------------------------------------------------- */
async function handleAddParticipantSubmit(name, familySize) {
  setState({ savingParticipant: true, addParticipantError: '' });
  try {
    await fb.addParticipant(state.code, name, familySize);
    setState({ savingParticipant: false, showAddParticipant: false });
  } catch (e) {
    setState({ savingParticipant: false, addParticipantError: "No s'ha pogut desar. Torna-ho a provar." });
  }
}

async function handleDeleteParticipant(id) {
  try {
    await fb.deleteParticipant(state.code, id);
    if (id === state.myParticipantId) {
      state.myParticipantId = null;
      fb.clearIdentity(state.code);
    }
  } catch (e) {
    console.error("No s'ha pogut eliminar el participant:", e);
  }
}

/* -------------------------------------------------------------------------
   Despeses
   ------------------------------------------------------------------------- */
async function handleSaveExpense(detail) {
  setState({ savingExpense: true, expenseError: '' });
  try {
    await fb.saveExpense(state.code, detail);
    setState({ savingExpense: false, showExpenseForm: false, editingExpenseId: null });
  } catch (e) {
    setState({ savingExpense: false, expenseError: "No s'ha pogut desar. Torna-ho a provar." });
  }
}

function handleDeleteExpenseRequest(detail) {
  showConfirmDialog({
    title: 'Eliminar aquesta despesa?',
    message: `"${detail.concept}" (${euros(detail.amount)}) s'eliminarà i deixarà de comptar en el repartiment. Aquesta acció no es pot desfer.`,
    confirmLabel: 'Elimina la despesa',
    danger: true
  }, async () => {
    try {
      await fb.deleteExpense(state.code, detail.id);
      setState({ showExpenseForm: false, editingExpenseId: null });
    } catch (e) {
      setState({ expenseError: "No s'ha pogut eliminar. Torna-ho a provar." });
    }
  });
}

/* -------------------------------------------------------------------------
   Arrencada. Si l'URL porta un ?sala=CODI (enllaç compartit), hi entrem
   directament sense passar per la pantalla d'introduir el codi.
   ------------------------------------------------------------------------- */
async function init() {
  if (!fb.firebaseReady) { render(); return; }
  const params = new URLSearchParams(window.location.search);
  const urlCode = (params.get('sala') || '').trim().toUpperCase();
  if (urlCode) {
    state.loading = true;
    render();
    try {
      const ev = await fb.fetchEvent(urlCode);
      if (ev) {
        await enterCodeFlow(urlCode, ev.name || 'Trobada familiar');
        return;
      }
    } catch (e) { /* seguim cap a la pantalla normal */ }
    state.loading = false;
    state.error = "Aquest enllaç no és vàlid o la trobada ja no existeix.";
    render();
    return;
  }
  render();
}

init();
