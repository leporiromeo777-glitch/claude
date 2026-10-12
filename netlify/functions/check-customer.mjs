// Dice solo se un'email è di un cliente "di ritorno" (almeno una corsa completata),
// per sbloccare il pagamento con fattura. Non restituisce mai dati delle prenotazioni.
import { findBookingsByEmail } from '../lib/firebase.mjs';

const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  let email = '';
  try { email = String((await req.json()).email || '').trim().toLowerCase(); } catch { /* vuota */ }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(200, { returning: false });
  try {
    const rows = Object.values((await findBookingsByEmail(email)) || {});
    const returning = rows.some((r) => r && r.status === 'completata');
    return json(200, { returning });
  } catch (e) {
    console.error(e);
    return json(200, { returning: false });
  }
};
