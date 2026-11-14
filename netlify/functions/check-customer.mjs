// Dice solo se un cliente è "di ritorno" (almeno una corsa completata), per sbloccare
// il pagamento con fattura. Non restituisce mai dati delle prenotazioni.
//
// Privacy: anche un semplice sì/no rivela chi è nostro cliente, quindi
//  - servono email E telefono della stessa corsa completata: con una lista di sole
//    email non si scopre nulla;
//  - Netlify limita le richieste a 10 al minuto per IP (vedi config in fondo);
//  - prenota.html chiama la funzione solo quando si apre lo step del pagamento,
//    con i contatti già compilati.
import { findBookingsByEmail } from '../lib/firebase.mjs';

const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

// Lo stesso numero si scrive in tanti modi (+41 79 123 45 67, 079 123 45 67, 0041791234567):
// si confrontano solo le cifre, e solo le ultime 9 (il numero senza prefisso internazionale
// né lo 0 iniziale). Un numero più corto si confronta per intero, purché abbia almeno 7 cifre.
const digits = (s) => String(s || '').replace(/\D/g, '');
function samePhone(a, b) {
  a = digits(a); b = digits(b);
  if (a.length < 7 || b.length < 7) return false;
  const n = Math.min(9, a.length, b.length);
  return a.slice(-n) === b.slice(-n);
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  let email = '', phone = '';
  try {
    const body = await req.json();
    email = String(body.email || '').trim().toLowerCase();
    phone = String(body.phone || '');
  } catch { /* corpo non valido: trattato come cliente nuovo */ }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || digits(phone).length < 7) return json(200, { returning: false });
  try {
    const rows = Object.values((await findBookingsByEmail(email)) || {});
    const returning = rows.some((r) => r && r.status === 'completata' && samePhone(r.phone, phone));
    return json(200, { returning });
  } catch (e) {
    console.error(e);
    return json(200, { returning: false });
  }
};

// Rate limiting di Netlify: oltre 10 richieste in 60 secondi dallo stesso IP la funzione
// non viene nemmeno eseguita e Netlify risponde 429 (può servire fino a 10 secondi perché
// il blocco scatti). Un cliente vero fa 1-2 verifiche per prenotazione.
// - Per le funzioni il limite si scrive qui, non in netlify.toml, e richiede un `path`
//   personalizzato: con il path la funzione NON risponde più su
//   /.netlify/functions/check-customer, quindi il limite non si può aggirare da lì.
//   prenota.html chiama /api/check-customer.
// - Il piano Personal ammette al massimo 2 regole di rate limiting nel codice per sito:
//   una è la regola /* in netlify.toml, l'altra è questa. Per aggiungerne una nuova
//   bisogna toglierne una delle due (oppure usare le regole dall'interfaccia di Netlify).
// Docs: https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/
export const config = {
  path: '/api/check-customer',
  rateLimit: {
    windowLimit: 10,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
};
