// Accesso al Realtime Database (stesso progetto usato da prenota/bacheca) via REST.
// Se sono impostate FIREBASE_SERVER_EMAIL e FIREBASE_SERVER_PASSWORD, la funzione
// accede come utente Firebase dedicato al server (serve se le regole richiedono login).
const DB = 'https://jf-limo-tracking-default-rtdb.europe-west1.firebasedatabase.app';
const API_KEY = 'AIzaSyBsCmhE88nTzMuLYYYpj0VcvXCjPkrgm4U'; // chiave pubblica web, la stessa delle pagine

let cached = null; // { token, exp }

async function authQuery() {
  const email = process.env.FIREBASE_SERVER_EMAIL, password = process.env.FIREBASE_SERVER_PASSWORD;
  if (!email || !password) return '';
  if (cached && cached.exp > Date.now() + 60_000) return `auth=${cached.token}`;
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(`Firebase login ${res.status}`);
  cached = { token: d.idToken, exp: Date.now() + (parseInt(d.expiresIn, 10) || 3600) * 1000 };
  return `auth=${cached.token}`;
}

async function call(method, path, body, query = '') {
  const a = await authQuery();
  const qs = [query, a].filter(Boolean).join('&');
  const res = await fetch(`${DB}/${path}.json${qs ? '?' + qs : ''}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Firebase ${method} ${path} ${res.status}: ${JSON.stringify(d)}`);
  return d;
}

export const getBooking = (trip) => call('GET', `bookings/${trip}`);
export const updateBooking = (trip, fields) => call('PATCH', `bookings/${trip}`, fields);
// Le regole non hanno ".indexOn": ["email"]: se la query filtrata viene rifiutata,
// si leggono tutte le prenotazioni e si filtra qui (il database è piccolo).
export async function findBookingsByEmail(email) {
  try {
    return await call('GET', 'bookings', null, `orderBy=${encodeURIComponent('"email"')}&equalTo=${encodeURIComponent(JSON.stringify(email))}`);
  } catch (e) {
    if (!/Index not defined/i.test(String(e.message))) throw e;
    const all = (await call('GET', 'bookings')) || {};
    return Object.fromEntries(Object.entries(all).filter(([, b]) => b && String(b.email || '').trim().toLowerCase() === email));
  }
}
