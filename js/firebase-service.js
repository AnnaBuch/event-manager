/* =========================================================================
   SERVEI DE DADES (Firebase / Firestore + identitat local)
   Tota la comunicació amb Firestore viu aquí. app.js només crida aquestes
   funcions; no sap res de com es desen o llegeixen les dades.
   ========================================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyBaxqUSBYfJilL6ka92Z7q39p2loyERkZI",
  authDomain: "gestor-esdeveniments.firebaseapp.com",
  projectId: "gestor-esdeveniments",
  storageBucket: "gestor-esdeveniments.firebasestorage.app",
  messagingSenderId: "421351349259",
  appId: "1:421351349259:web:322d8552f50e224c113b0e"
};

export let firebaseReady = false;
let db = null;

try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY_HERE") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    firebaseReady = true;
  }
} catch (e) {
  firebaseReady = false;
}

// Codi de sala: totalment aleatori (lletres+números), sense relació amb el
// nom de la trobada. S'eviten caràcters ambigus (0/O, 1/I) per llegir-lo bé.
export function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) { s += chars.charAt(Math.floor(Math.random() * chars.length)); }
  return s.slice(0, 4) + '-' + s.slice(4);
}

/* -------------------------------------------------------------------------
   Persistència local de la identitat (per no haver de tornar a identificar-se
   cada vegada que s'obre l'app en aquest dispositiu/navegador)
   ------------------------------------------------------------------------- */
function identityKey(code) { return `familyAccount_identity_${code}`; }

export function saveIdentity(code, id, name) {
  try { localStorage.setItem(identityKey(code), JSON.stringify({ id, name })); } catch (e) {}
}
export function loadIdentity(code) {
  try {
    const raw = localStorage.getItem(identityKey(code));
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
export function clearIdentity(code) {
  try { localStorage.removeItem(identityKey(code)); } catch (e) {}
}

/* -------------------------------------------------------------------------
   Esdeveniments (trobades)
   ------------------------------------------------------------------------- */
export async function fetchEvent(code) {
  const snap = await db.collection('events').doc(code).get();
  return snap.exists ? { code, ...snap.data() } : null;
}

export async function createEvent(name) {
  let newCode = generateCode();
  const existing = await db.collection('events').doc(newCode).get();
  if (existing.exists) newCode = generateCode();
  await db.collection('events').doc(newCode).set({
    name, createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return newCode;
}

export async function fetchParticipant(code, id) {
  const snap = await db.collection('events').doc(code).collection('participants').doc(id).get();
  return snap.exists ? { id, ...snap.data() } : null;
}

export function subscribeEventMeta(code, onData) {
  return db.collection('events').doc(code).onSnapshot(docSnap => {
    if (!docSnap.exists) return;
    onData(docSnap.data());
  });
}

export function subscribeParticipants(code, onData, onError) {
  return db.collection('events').doc(code).collection('participants')
    .orderBy('createdAt', 'asc')
    .onSnapshot(snapshot => {
      onData(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, onError);
}

export function subscribeExpenses(code, onData, onError) {
  return db.collection('events').doc(code).collection('expenses')
    .orderBy('createdAt', 'asc')
    .onSnapshot(snapshot => {
      onData(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, onError);
}

export async function closeEvent(code) {
  await db.collection('events').doc(code).update({ closed: true });
}
export async function reopenEvent(code) {
  await db.collection('events').doc(code).update({ closed: false });
}

/* -------------------------------------------------------------------------
   Participants
   ------------------------------------------------------------------------- */

// Crea un participant nou i l'afegeix automàticament a totes les despeses
// ja existents de la trobada (perquè hi pugui participar en el repartiment).
export async function addParticipant(code, name, familySize) {
  const eventRef = db.collection('events').doc(code);
  const participantRef = await eventRef.collection('participants').add({
    name, familySize, createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  try {
    const expensesSnap = await eventRef.collection('expenses').get();
    if (!expensesSnap.empty) {
      const batch = db.batch();
      expensesSnap.forEach(doc => {
        const data = doc.data();
        const ids = data.participantIds || [];
        if (!ids.includes(participantRef.id)) {
          batch.update(doc.ref, { participantIds: [...ids, participantRef.id] });
        }
      });
      await batch.commit();
    }
  } catch (e) {
    console.warn("No s'ha pogut afegir el nou participant a les despeses existents (revisa les regles de Firestore per a la col·lecció 'expenses'):", e);
  }
  return participantRef.id;
}

export async function deleteParticipant(code, id) {
  const eventRef = db.collection('events').doc(code);
  await eventRef.collection('participants').doc(id).delete();
  try {
    const expensesSnap = await eventRef.collection('expenses').get();
    if (!expensesSnap.empty) {
      const batch = db.batch();
      expensesSnap.forEach(doc => {
        const data = doc.data();
        const ids = (data.participantIds || []).filter(pid => pid !== id);
        if (ids.length !== (data.participantIds || []).length) {
          batch.update(doc.ref, { participantIds: ids });
        }
      });
      await batch.commit();
    }
  } catch (e) {
    console.warn("No s'ha pogut netejar el participant eliminat de les despeses existents:", e);
  }
}

/* -------------------------------------------------------------------------
   Despeses
   ------------------------------------------------------------------------- */
export async function saveExpense(code, { id, payerId, concept, amount, participantIds }) {
  const data = { payerId, concept, amount, participantIds };
  if (id) {
    await db.collection('events').doc(code).collection('expenses').doc(id).update(data);
  } else {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('events').doc(code).collection('expenses').add(data);
  }
}

export async function deleteExpense(code, id) {
  await db.collection('events').doc(code).collection('expenses').doc(id).delete();
}
