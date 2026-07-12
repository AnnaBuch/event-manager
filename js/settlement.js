/* =========================================================================
   CÀLCUL DEL REPARTIMENT
   Cada despesa es divideix, entre els participants seleccionats en ella,
   proporcionalment al nombre de persones que representa cadascú.
   ========================================================================= */

export function computeSettlement(participants, expenses) {
  const totalCents = expenses.reduce((s, e) => s + Math.round(e.amount * 100), 0);
  const totalUnits = participants.reduce((s, p) => s + p.familySize, 0);

  const paidCents = {};
  const owedCents = {};
  participants.forEach(p => { paidCents[p.id] = 0; owedCents[p.id] = 0; });

  expenses.forEach(e => {
    const amtCents = Math.round(e.amount * 100);
    if (Object.prototype.hasOwnProperty.call(paidCents, e.payerId)) {
      paidCents[e.payerId] += amtCents;
    }
    const includedIds = participants
      .filter(p => (e.participantIds || []).includes(p.id))
      .map(p => p.id);
    const unitsSum = includedIds.reduce((s, id) => {
      const p = participants.find(pp => pp.id === id);
      return s + (p ? p.familySize : 0);
    }, 0);
    if (unitsSum <= 0) return;
    let distributed = 0;
    includedIds.forEach((id, idx) => {
      const p = participants.find(pp => pp.id === id);
      let share;
      if (idx === includedIds.length - 1) {
        share = amtCents - distributed;
      } else {
        share = Math.round(amtCents * (p.familySize / unitsSum));
      }
      distributed += share;
      owedCents[id] += share;
    });
  });

  const balances = participants.map(p => ({
    id: p.id, name: p.name,
    balanceCents: (paidCents[p.id] || 0) - (owedCents[p.id] || 0)
  }));
  const creditors = balances.filter(b => b.balanceCents > 0.5).map(b => ({ ...b })).sort((a, b) => b.balanceCents - a.balanceCents);
  const debtors = balances.filter(b => b.balanceCents < -0.5).map(b => ({ ...b })).sort((a, b) => a.balanceCents - b.balanceCents);
  const transactions = [];
  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci], d = debtors[di];
    const amount = Math.min(c.balanceCents, -d.balanceCents);
    if (amount > 0.5) transactions.push({ from: d.name, to: c.name, cents: amount });
    c.balanceCents -= amount; d.balanceCents += amount;
    if (c.balanceCents < 0.5) ci++;
    if (d.balanceCents > -0.5) di++;
  }
  return { transactions, totalCents, totalUnits, paidCents, owedCents };
}
