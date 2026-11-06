// API dell'app Coronel: account, timbri, prenotazioni, buoni e funzioni admin.
// I dati stanno in Netlify Blobs. Per evitare sovrascritture tra richieste contemporanee:
//  - ogni timbro è una chiave a sé (registro append-only: il saldo è la somma);
//  - gli orari prenotati si bloccano con `onlyIfNew` (una sola prenotazione per fascia);
//  - email e codici QR monouso si "prenotano" con `onlyIfNew`.
import { getStore } from "@netlify/blobs";
import { createHmac, randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";

const REGION = "eu-central-1";
const store = () => getStore({ name: "coronel", region: REGION, consistency: "strong" });

// ---------- Regole del negozio ----------
const SERVICES = [
  { id: "taglio", name: "Taglio Uomo", price: 32, min: 45 },
  { id: "studente", name: "Taglio studente", price: 25, min: 45 },
  { id: "barba", name: "Barba", price: 15, min: 30 },
  { id: "decolorazione", name: "Decolorazione", price: 80, min: 120 },
  { id: "lavaggio", name: "Lavaggio", price: 5, min: 10 },
];
const HOURS = { 2: [9, 19], 3: [9, 19], 4: [9, 19], 5: [9, 19], 6: [9, 18] }; // giorno → [apertura, chiusura]
const SLOT = 15;            // minuti per fascia
const CARD = 10;            // timbri per un premio
const REWARD = "Taglio Uomo omaggio";
const LEVELS = [            // visite negli ultimi 12 mesi
  { id: "classic", name: "Classic", from: 0, bonusEvery: 0 },
  { id: "silver", name: "Silver", from: 5, bonusEvery: 0 },
  { id: "gold", name: "Gold", from: 12, bonusEvery: 5 },
  { id: "black", name: "Black", from: 24, bonusEvery: 3 },
];
const BOOK_DAYS = 28;       // si prenota fino a 4 settimane avanti
const CLAIM_MINUTES = 5;    // durata QR del negozio
const MAX_OPEN_BOOKINGS = 3;

// ---------- Utilità ----------
const json = (data, status = 200) => Response.json(data, { status });
const fail = (msg, status = 400) => json({ error: msg }, status);
const id = (n = 12) => randomBytes(n).toString("base64url");
const sha = s => createHash("sha256").update(s).digest("hex");
const cleanEmail = e => String(e || "").trim().toLowerCase();
const pad = n => String(n).padStart(2, "0");
const toMin = hhmm => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const toHHMM = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

function zurichNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
}
const weekday = date => new Date(date + "T12:00:00Z").getUTCDay();
const addDays = (date, n) => { const d = new Date(date + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const validDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || "");

// ---------- Password e sessioni ----------
function hashPassword(pw, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(pw, salt, 64).toString("hex") };
}
function checkPassword(pw, user) {
  const a = Buffer.from(scryptSync(pw, user.salt, 64).toString("hex"));
  const b = Buffer.from(user.hash);
  return a.length === b.length && timingSafeEqual(a, b);
}
function secret() {
  const s = Netlify.env.get("APP_SECRET");
  if (!s) throw new Error("APP_SECRET mancante");
  return s;
}
function signToken(uid) {
  const body = Buffer.from(JSON.stringify({ uid, exp: Date.now() + 1000 * 60 * 60 * 24 * 60 })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function readToken(req) {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const [body, sig] = t.split(".");
  if (!body || !sig) return null;
  const good = createHmac("sha256", secret()).update(body).digest("base64url");
  if (sig.length !== good.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try { const p = JSON.parse(Buffer.from(body, "base64url").toString()); return p.exp > Date.now() ? p.uid : null; }
  catch { return null; }
}
const adminEmails = () => (Netlify.env.get("ADMIN_EMAILS") || "").split(",").map(cleanEmail).filter(Boolean);

// ---------- Utenti ----------
const getUser = async uid => uid ? store().get(`u/${uid}`, { type: "json" }) : null;
const saveUser = u => store().setJSON(`u/${u.id}`, u);
const publicUser = u => ({ id: u.id, name: u.name, email: u.email, phone: u.phone || "", isAdmin: !!u.isAdmin, qr: u.qr, createdAt: u.createdAt });

// ---------- Timbri (registro append-only codificato nella chiave) ----------
// chiave: s/<uid>/<ISO>~<rand>~<delta>~<motivo>~<servizio>
async function addStamp(uid, delta, reason, service = "-") {
  const key = `s/${uid}/${new Date().toISOString()}~${id(4)}~${delta}~${reason}~${service || "-"}`;
  await store().set(key, "");
}
async function stampSummary(uid) {
  const { blobs } = await store().list({ prefix: `s/${uid}/` });
  const yearAgo = new Date(Date.now() - 365 * 864e5).toISOString();
  let balance = 0, visits = 0, totalVisits = 0;
  const history = [];
  for (const b of blobs) {
    const [at, , d, reason, service] = b.key.slice(`s/${uid}/`.length).split("~");
    const delta = Number(d) || 0;
    balance += delta;
    if (reason === "visita") { totalVisits++; if (at >= yearAgo) visits++; }
    history.push({ at, delta, reason, service: service === "-" ? null : service });
  }
  history.sort((a, b) => b.at.localeCompare(a.at));
  const level = [...LEVELS].reverse().find(l => visits >= l.from);
  const next = LEVELS[LEVELS.indexOf(level) + 1] || null;
  return {
    balance, visits, totalVisits, card: CARD, reward: REWARD,
    rewards: Math.floor(balance / CARD), onCard: balance % CARD,
    level: { id: level.id, name: level.name, bonusEvery: level.bonusEvery },
    nextLevel: next ? { name: next.name, missing: next.from - visits } : null,
    history: history.slice(0, 40),
  };
}
// Una visita = 1 timbro, più un timbro bonus per Gold (ogni 5 visite) e Black (ogni 3)
async function awardVisit(uid, service) {
  await addStamp(uid, 1, "visita", service);
  const s = await stampSummary(uid);
  if (s.level.bonusEvery && s.totalVisits % s.level.bonusEvery === 0) {
    await addStamp(uid, 1, "bonus", service);
    return { bonus: true, summary: await stampSummary(uid) };
  }
  return { bonus: false, summary: s };
}

// ---------- Calendario ----------
async function listMap(prefix) {
  const st = store();
  const { blobs } = await st.list({ prefix });
  const out = {};
  for (const b of blobs) out[b.key.slice(prefix.length)] = await st.get(b.key, { type: "json" });
  return out;
}
async function calendar() {
  const now = zurichNow();
  const discounts = await listMap("d/"), closures = await listMap("c/");
  const keep = obj => Object.fromEntries(Object.entries(obj).filter(([d]) => d >= now.date).sort());
  return { today: now.date, hours: HOURS, slot: SLOT, bookDays: BOOK_DAYS, discounts: keep(discounts), closures: keep(closures) };
}
function slotsFor(start, minutes) {
  const units = Math.ceil(minutes / SLOT), out = [];
  for (let i = 0; i < units; i++) out.push(toHHMM(start + i * SLOT).replace(":", ""));
  return out;
}

// ---------- Prenotazioni ----------
const getBooking = bid => store().get(`b/${bid}`, { type: "json" });
async function releaseSlots(b) {
  const st = store();
  for (const s of slotsFor(toMin(b.time), b.minutes)) await st.delete(`slot/${b.date}/${s}`);
}
async function setBookingStatus(b, status, by) {
  const st = store();
  const wasActive = ["richiesta", "confermata"].includes(b.status);
  b.status = status; b.updatedAt = new Date().toISOString(); b.updatedBy = by;
  await st.setJSON(`b/${b.id}`, b);
  if (wasActive && ["rifiutata", "annullata"].includes(status)) await releaseSlots(b);
  return b;
}
async function bookingsOfUser(uid) {
  const st = store();
  const { blobs } = await st.list({ prefix: `bu/${uid}/` });
  const out = [];
  for (const x of blobs) { const b = await getBooking(x.key.split("/").pop()); if (b) out.push(b); }
  return out.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}

// ---------- Azioni ----------
async function handle(action, req, body) {
  const st = store();

  // --- pubbliche ---
  if (action === "config") return json({ services: SERVICES, card: CARD, reward: REWARD, levels: LEVELS, ...(await calendar()) });

  if (action === "signup") {
    const email = cleanEmail(body.email), name = String(body.name || "").trim().slice(0, 60);
    const password = String(body.password || ""), phone = String(body.phone || "").trim().slice(0, 30);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Email non valida");
    if (name.length < 2) return fail("Scrivi il tuo nome");
    if (password.length < 8) return fail("La password deve avere almeno 8 caratteri");
    const uid = id(9);
    const { modified } = await st.set(`email/${sha(email)}`, uid, { onlyIfNew: true });
    if (!modified) return fail("Esiste già un account con questa email", 409);
    const user = { id: uid, email, name, phone, ...(() => { const h = hashPassword(password); return { salt: h.salt, hash: h.hash }; })(),
      isAdmin: adminEmails().includes(email), qr: id(12), createdAt: new Date().toISOString() };
    await saveUser(user);
    await st.set(`qr/${user.qr}`, uid);
    return json({ token: signToken(uid), user: publicUser(user) });
  }

  if (action === "login") {
    const email = cleanEmail(body.email);
    const uid = await st.get(`email/${sha(email)}`);
    const user = await getUser(uid);
    if (!user || !checkPassword(String(body.password || ""), user)) {
      await new Promise(r => setTimeout(r, 600));
      return fail("Email o password non corretti", 401);
    }
    if (!user.isAdmin && adminEmails().includes(email)) { user.isAdmin = true; await saveUser(user); }
    return json({ token: signToken(uid), user: publicUser(user) });
  }

  // --- da qui serve il login ---
  const uid = readToken(req);
  const me = await getUser(uid);
  if (!me) return fail("Accedi di nuovo", 401);

  if (action === "me") return json({ user: publicUser(me), stamps: await stampSummary(me.id) });

  if (action === "update-profile") {
    if (body.name) me.name = String(body.name).trim().slice(0, 60);
    if (body.phone !== undefined) me.phone = String(body.phone).trim().slice(0, 30);
    if (body.newPassword) {
      if (!checkPassword(String(body.password || ""), me)) return fail("La password attuale non è corretta", 401);
      if (String(body.newPassword).length < 8) return fail("La nuova password deve avere almeno 8 caratteri");
      Object.assign(me, hashPassword(String(body.newPassword)));
    }
    await saveUser(me);
    return json({ user: publicUser(me) });
  }

  if (action === "delete-account") {
    if (!checkPassword(String(body.password || ""), me)) return fail("Password non corretta", 401);
    // annulla le prenotazioni future e libera gli orari
    for (const b of await bookingsOfUser(me.id)) if (["richiesta", "confermata"].includes(b.status)) await setBookingStatus(b, "annullata", me.id);
    for (const prefix of [`s/${me.id}/`, `bu/${me.id}/`, `vu/${me.id}/`]) {
      const { blobs } = await st.list({ prefix });
      for (const x of blobs) await st.delete(x.key);
    }
    await st.delete(`qr/${me.qr}`);
    await st.delete(`email/${sha(me.email)}`);
    await st.delete(`u/${me.id}`);
    return json({ ok: true });
  }

  if (action === "busy") {
    if (!validDate(body.date)) return fail("Data non valida");
    const { blobs } = await st.list({ prefix: `slot/${body.date}/` });
    return json({ busy: blobs.map(b => b.key.split("/").pop()) });
  }

  if (action === "book") {
    const svc = SERVICES.find(s => s.id === body.service);
    const date = body.date, time = String(body.time || "");
    if (!svc) return fail("Servizio non valido");
    if (!validDate(date) || !/^\d{2}:\d{2}$/.test(time)) return fail("Data o ora non valida");
    const cal = await calendar(), now = zurichNow();
    const hours = HOURS[weekday(date)];
    if (!hours) return fail("Quel giorno siamo chiusi");
    if (cal.closures[date]) return fail("Quel giorno siamo chiusi");
    if (date < now.date || date > addDays(now.date, BOOK_DAYS)) return fail("Puoi prenotare fino a 4 settimane in anticipo");
    const start = toMin(time), end = start + svc.min;
    if (start % SLOT || start < hours[0] * 60 || end > hours[1] * 60) return fail("Orario fuori dagli orari di apertura");
    if (date === now.date && start <= now.min + 30) return fail("Scegli un orario più avanti");
    const open = (await bookingsOfUser(me.id)).filter(b => ["richiesta", "confermata"].includes(b.status) && b.date >= now.date);
    if (open.length >= MAX_OPEN_BOOKINGS) return fail(`Hai già ${MAX_OPEN_BOOKINGS} prenotazioni aperte`);
    const bid = id(8), taken = [];
    for (const s of slotsFor(start, svc.min)) {
      const { modified } = await st.set(`slot/${date}/${s}`, bid, { onlyIfNew: true });
      if (!modified) { for (const t of taken) await st.delete(`slot/${date}/${t}`); return fail("Questo orario è appena stato preso: scegline un altro", 409); }
      taken.push(s);
    }
    const disc = cal.discounts[date] || null;
    const b = { id: bid, userId: me.id, userName: me.name, userPhone: me.phone || "", service: svc.id, serviceName: svc.name,
      minutes: svc.min, price: svc.price, discount: disc ? disc.percent : 0, date, time,
      note: String(body.note || "").slice(0, 300), status: "richiesta", createdAt: new Date().toISOString() };
    await st.setJSON(`b/${bid}`, b);
    await st.set(`bu/${me.id}/${bid}`, "");
    await st.set(`bd/${date}/${time.replace(":", "")}/${bid}`, "");
    return json({ booking: b });
  }

  if (action === "my-bookings") return json({ bookings: await bookingsOfUser(me.id) });

  if (action === "cancel-booking") {
    const b = await getBooking(body.id);
    if (!b || b.userId !== me.id) return fail("Prenotazione non trovata", 404);
    if (!["richiesta", "confermata"].includes(b.status)) return fail("Questa prenotazione non si può annullare");
    return json({ booking: await setBookingStatus(b, "annullata", me.id) });
  }

  if (action === "claim") {
    const code = String(body.code || "").replace(/^CORONEL-CLAIM:/, "");
    const c = await st.get(`cl/${code}`, { type: "json" });
    if (!c) return fail("Codice non valido", 404);
    if (Date.parse(c.expiresAt) < Date.now()) return fail("Codice scaduto: chiedi un nuovo QR");
    const { modified } = await st.set(`clu/${code}`, me.id, { onlyIfNew: true });
    if (!modified) return fail("Questo codice è già stato usato");
    const r = await awardVisit(me.id, c.service);
    return json({ ok: true, bonus: r.bonus, stamps: r.summary });
  }

  if (action === "request-voucher") {
    const amount = Math.round(Number(body.amount));
    if (!(amount >= 10 && amount <= 500)) return fail("Importo tra 10 e 500");
    const v = { id: id(8), userId: me.id, userName: me.name, amount, recipient: String(body.recipient || "").trim().slice(0, 60),
      message: String(body.message || "").trim().slice(0, 200), status: "richiesto", code: null, createdAt: new Date().toISOString() };
    await st.setJSON(`v/${v.id}`, v);
    await st.set(`vu/${me.id}/${v.id}`, "");
    return json({ voucher: v });
  }

  if (action === "my-vouchers") {
    const { blobs } = await st.list({ prefix: `vu/${me.id}/` });
    const out = [];
    for (const x of blobs) { const v = await st.get(`v/${x.key.split("/").pop()}`, { type: "json" }); if (v) out.push(v); }
    return json({ vouchers: out.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  }

  // --- admin ---
  if (!action.startsWith("admin/")) return fail("Azione sconosciuta", 404);
  if (!me.isAdmin) return fail("Solo per l'amministratore", 403);
  const a = action.slice(6);

  if (a === "bookings") {
    const from = validDate(body.from) ? body.from : zurichNow().date;
    const days = Math.min(Math.max(Number(body.days) || 1, 1), 31);
    const out = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(from, i);
      const { blobs } = await st.list({ prefix: `bd/${d}/` });
      for (const x of blobs) { const b = await getBooking(x.key.split("/").pop()); if (b) out.push(b); }
    }
    return json({ bookings: out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)) });
  }
  if (a === "pending") {
    const now = zurichNow(), out = [];
    for (let i = 0; i <= BOOK_DAYS; i++) {
      const { blobs } = await st.list({ prefix: `bd/${addDays(now.date, i)}/` });
      for (const x of blobs) { const b = await getBooking(x.key.split("/").pop()); if (b && b.status === "richiesta") out.push(b); }
    }
    return json({ bookings: out });
  }
  if (a === "booking-status") {
    const b = await getBooking(body.id);
    if (!b) return fail("Prenotazione non trovata", 404);
    const status = body.status;
    if (!["confermata", "rifiutata", "completata", "annullata"].includes(status)) return fail("Stato non valido");
    if (status === "completata") {
      if (b.status === "completata") return fail("Già segnata come fatta");
      const r = await awardVisit(b.userId, b.service);
      await setBookingStatus(b, "completata", me.id);
      return json({ booking: b, bonus: r.bonus, stamps: r.summary });
    }
    return json({ booking: await setBookingStatus(b, status, me.id) });
  }
  if (a === "scan") {
    const token = String(body.qr || "").replace(/^CORONEL:/, "");
    const cuid = await st.get(`qr/${token}`);
    const c = await getUser(cuid);
    if (!c) return fail("QR non riconosciuto", 404);
    return json({ client: publicUser(c), stamps: await stampSummary(c.id) });
  }
  if (a === "client") {
    const c = await getUser(body.id);
    if (!c) return fail("Cliente non trovato", 404);
    return json({ client: publicUser(c), stamps: await stampSummary(c.id), bookings: (await bookingsOfUser(c.id)).slice(0, 10) });
  }
  if (a === "clients") {
    const q = String(body.q || "").trim().toLowerCase();
    const { blobs } = await st.list({ prefix: "u/" });
    const out = [];
    for (const x of blobs) {
      const u = await st.get(x.key, { type: "json" });
      if (u && (!q || u.name.toLowerCase().includes(q) || u.email.includes(q) || (u.phone || "").includes(q))) out.push(publicUser(u));
    }
    return json({ clients: out.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 200), total: blobs.length });
  }
  if (a === "award") {
    const c = await getUser(body.userId);
    if (!c) return fail("Cliente non trovato", 404);
    if (!SERVICES.find(s => s.id === body.service)) return fail("Servizio non valido");
    const r = await awardVisit(c.id, body.service);
    return json({ bonus: r.bonus, stamps: r.summary });
  }
  if (a === "redeem") {
    const s = await stampSummary(body.userId);
    if (s.balance < CARD) return fail("Timbri insufficienti per il premio");
    await addStamp(body.userId, -CARD, "premio");
    return json({ stamps: await stampSummary(body.userId) });
  }
  if (a === "adjust") {
    const delta = Math.round(Number(body.delta));
    if (!delta || Math.abs(delta) > 20) return fail("Correzione tra -20 e +20");
    if (!(await getUser(body.userId))) return fail("Cliente non trovato", 404);
    await addStamp(body.userId, delta, "manuale");
    return json({ stamps: await stampSummary(body.userId) });
  }
  if (a === "claim-create") {
    const svc = SERVICES.find(s => s.id === body.service);
    if (!svc) return fail("Servizio non valido");
    const code = id(10);
    const expiresAt = new Date(Date.now() + CLAIM_MINUTES * 60e3).toISOString();
    await st.setJSON(`cl/${code}`, { service: svc.id, expiresAt, by: me.id });
    return json({ code: `CORONEL-CLAIM:${code}`, expiresAt, service: svc });
  }
  if (a === "claim-status") {
    const code = String(body.code || "").replace(/^CORONEL-CLAIM:/, "");
    const who = await st.get(`clu/${code}`);
    const c = who ? await getUser(who) : null;
    return json({ used: !!who, by: c ? c.name : null });
  }
  if (a === "reset-password") {
    const c = await getUser(body.userId);
    if (!c) return fail("Cliente non trovato", 404);
    const temp = String(body.password || "");
    if (temp.length < 8) return fail("La password deve avere almeno 8 caratteri");
    Object.assign(c, hashPassword(temp));
    await saveUser(c);
    return json({ ok: true });
  }
  if (a === "set-admin") {
    const c = await getUser(body.userId);
    if (!c) return fail("Cliente non trovato", 404);
    if (c.id === me.id && !body.isAdmin) return fail("Non puoi togliere i permessi a te stesso");
    c.isAdmin = !!body.isAdmin; await saveUser(c);
    return json({ client: publicUser(c) });
  }
  if (a === "discount-set") {
    if (!validDate(body.date)) return fail("Data non valida");
    const percent = Math.round(Number(body.percent));
    if (!(percent >= 5 && percent <= 70)) return fail("Sconto tra 5% e 70%");
    await st.setJSON(`d/${body.date}`, { percent, label: String(body.label || "").trim().slice(0, 60) || "Giorno di sconto" });
    return json(await calendar());
  }
  if (a === "discount-del") { await st.delete(`d/${body.date}`); return json(await calendar()); }
  if (a === "closure-set") {
    if (!validDate(body.date)) return fail("Data non valida");
    await st.setJSON(`c/${body.date}`, { label: String(body.label || "").trim().slice(0, 60) || "Chiuso" });
    return json(await calendar());
  }
  if (a === "closure-del") { await st.delete(`c/${body.date}`); return json(await calendar()); }
  if (a === "vouchers") {
    const { blobs } = await st.list({ prefix: "v/" });
    const out = [];
    for (const x of blobs) { const v = await st.get(x.key, { type: "json" }); if (v) out.push(v); }
    return json({ vouchers: out.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  }
  if (a === "voucher-status") {
    const v = await st.get(`v/${body.id}`, { type: "json" });
    if (!v) return fail("Buono non trovato", 404);
    if (!["attivo", "usato", "annullato"].includes(body.status)) return fail("Stato non valido");
    v.status = body.status;
    if (body.status === "attivo" && !v.code) v.code = "CRN-" + randomBytes(3).toString("hex").toUpperCase();
    v.updatedAt = new Date().toISOString();
    await st.setJSON(`v/${v.id}`, v);
    return json({ voucher: v });
  }
  return fail("Azione sconosciuta", 404);
}

export default async (req, context) => {
  const action = (context.params["0"] || new URL(req.url).pathname.replace(/^\/api\//, "")).replace(/\/+$/, "");
  let body = {};
  if (req.method === "POST") { try { body = await req.json(); } catch { body = {}; } }
  try {
    return await handle(action, req, body);
  } catch (e) {
    console.error(action, e);
    return fail("Errore del server, riprova", 500);
  }
};

export const config = { path: "/api/*" };
