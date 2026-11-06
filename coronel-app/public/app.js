// App Coronel: interfaccia per clienti e amministratore.
"use strict";

const $ = s => document.querySelector(s);
const app = $("#app"), nav = $("#nav"), navIn = $("#nav-in");
const S = { token: null, user: null, stamps: null, cfg: null, route: "home", adminTab: "oggi", bk: {}, adminDay: null };
try { S.token = localStorage.getItem("coronel_token"); } catch (e) {}

// ---------- Icone ----------
const I = {
  star: '<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7.3L12 17.8 5.8 21.5l1.6-7.3L2 9.5l7.1-.6z"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="3"/><circle cx="8" cy="12" r="2"/><circle cx="14" cy="12" r="2"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  admin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/></svg>',
  scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/></svg>',
  gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8S10 3 7.5 4 9 8 12 8zm0 0s2-5 4.5-4S15 8 12 8z"/></svg>',
};
const logo = (size = 14) => `<span class="logo" style="font-size:${size}px"><span class="co">C<span class="o">O${I.star}</span></span><span class="ro">ro</span><span class="nel">NEL</span></span>`;

// ---------- Utilità ----------
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DAYS = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const DAYS_L = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const wd = d => new Date(d + "T12:00:00Z").getUTCDay();
const addDays = (d, n) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const fmtDate = d => { const x = new Date(d + "T12:00:00Z"); return `${DAYS_L[x.getUTCDay()]} ${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]}`; };
const fmtShort = iso => { const x = new Date(iso); return `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`; };
const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toHHMM = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const svcName = id => (S.cfg?.services.find(s => s.id === id) || {}).name || id || "";
const REASONS = { visita: "Visita", bonus: "Timbro bonus", premio: "Premio riscattato", manuale: "Correzione" };
function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 2600); }

async function api(action, body = {}) {
  const res = await fetch("/api/" + action, {
    method: "POST",
    headers: { "content-type": "application/json", ...(S.token ? { authorization: "Bearer " + S.token } : {}) },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (res.status === 401 && S.token && !["login", "signup"].includes(action)) { logout(); throw new Error("Sessione scaduta, accedi di nuovo"); }
  if (!res.ok) throw new Error(data.error || "Errore di rete, riprova");
  return data;
}
function setToken(t) { S.token = t; try { t ? localStorage.setItem("coronel_token", t) : localStorage.removeItem("coronel_token"); } catch (e) {} }
function logout() { setToken(null); S.user = null; S.stamps = null; render(); }

// QR come SVG (qrcode-generator, caricato solo quando serve)
function loadScript(src) {
  return new Promise((ok, ko) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => ko(new Error("Connessione assente: riprova")); document.head.appendChild(s); });
}
async function qrSvg(text) {
  if (!window.qrcode) await loadScript("https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js");
  const q = qrcode(0, "M"); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
}
// Riempie i riquadri [data-qr] con il QR del loro testo
function fillQR(root) {
  root.querySelectorAll("[data-qr]").forEach(async el => {
    try { el.innerHTML = await qrSvg(el.dataset.qr); } catch (e) { el.innerHTML = `<p style="color:#111;text-align:center">${esc(e.message)}</p>`; }
  });
}

// Finestra dal basso
function sheet(html, onOpen) {
  const bg = document.createElement("div");
  bg.className = "sheet-bg";
  bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}<button class="btn btn-ghost btn-block" data-close style="margin-top:14px">Chiudi</button></div>`;
  const close = () => { bg.dispatchEvent(new Event("closed")); bg.remove(); };
  bg.addEventListener("click", e => { if (e.target === bg || e.target.closest("[data-close]")) close(); });
  document.body.appendChild(bg);
  if (onOpen) onOpen(bg.querySelector(".sheet"), close, bg);
  return close;
}

// Scanner QR con la fotocamera (jsQR caricato solo quando serve)
async function loadJsQR() {
  if (!window.jsQR) await loadScript("https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js");
}
function openScanner(title, onCode) {
  let stream = null, raf = 0, done = false;
  const stop = () => { done = true; cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(t => t.stop()); };
  const close = sheet(`<div class="kicker">Scanner</div><h2>${esc(title)}</h2>
    <div class="scanner"><video playsinline muted></video></div>
    <p class="sub" id="scan-msg">Inquadra il codice QR.</p>
    <details style="margin-top:10px"><summary class="sub">Non riesci a scansionare? Inserisci il codice</summary>
      <div class="field" style="margin-top:10px"><input id="scan-manual" placeholder="Codice"></div>
      <button class="btn btn-ghost btn-sm" id="scan-go">Conferma codice</button></details>`, async (el, closeFn, bg) => {
    bg.addEventListener("closed", stop);
    const finish = code => { if (done) return; stop(); closeFn(); onCode(code); };
    el.querySelector("#scan-go").onclick = () => { const v = el.querySelector("#scan-manual").value.trim(); if (v) finish(v); };
    const video = el.querySelector("video"), msg = el.querySelector("#scan-msg");
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      if (done) return stop();
      video.srcObject = stream; await video.play();
      const detector = "BarcodeDetector" in window ? new BarcodeDetector({ formats: ["qr_code"] }) : null;
      if (!detector) await loadJsQR();
      const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d", { willReadFrequently: true });
      const tick = async () => {
        if (done) return;
        if (video.readyState >= 2) {
          try {
            if (detector) {
              const codes = await detector.detect(video);
              if (codes[0]) return finish(codes[0].rawValue);
            } else {
              canvas.width = video.videoWidth; canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0);
              const r = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
              if (r && r.data) return finish(r.data);
            }
          } catch (e) {}
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      msg.textContent = "Non riesco ad aprire la fotocamera: consenti l'accesso alla fotocamera oppure inserisci il codice a mano.";
    }
  });
  return close;
}

// ---------- Navigazione ----------
function go(route) { S.route = route; render(); scrollTo(0, 0); }
function renderNav() {
  if (!S.user) { nav.classList.add("hidden"); return; }
  const items = [["home", "Home", I.home], ["prenota", "Prenota", I.cal], ["tessera", "Tessera", I.card], ["profilo", "Profilo", I.user]];
  if (S.user.isAdmin) items.push(["admin", "Admin", I.admin]);
  navIn.innerHTML = items.map(([r, l, ic]) => `<button data-go="${r}" class="${S.route === r ? "on" : ""}" aria-label="${l}">${ic}<span>${l}</span></button>`).join("");
  nav.classList.remove("hidden");
}
navIn.addEventListener("click", e => { const b = e.target.closest("[data-go]"); if (b) go(b.dataset.go); });

function pageTop(title) {
  const lv = S.stamps?.level;
  return `<div class="top">${logo(14)}<div class="top-right">${lv ? `<span class="pill lvl-${lv.id}">★ ${esc(lv.name)}</span>` : ""}</div></div>${title || ""}`;
}

async function render() {
  renderNav();
  if (!S.cfg) { try { S.cfg = await api("config"); } catch (e) { app.innerHTML = `<div class="loading">${esc(e.message)}</div>`; return; } }
  if (S.token && !S.user) {
    try { const r = await api("me"); S.user = r.user; S.stamps = r.stamps; renderNav(); }
    catch (e) { setToken(null); }
  }
  if (!S.user) return renderAuth("login");
  const views = { home: viewHome, prenota: viewBook, tessera: viewCard, profilo: viewProfile, admin: viewAdmin };
  (views[S.route] || viewHome)();
}
async function refreshMe() { const r = await api("me"); S.user = r.user; S.stamps = r.stamps; }

// ---------- Accesso ----------
function renderAuth(mode) {
  nav.classList.add("hidden");
  const signup = mode === "signup";
  app.innerHTML = `<div class="auth">
    ${logo(44)}
    <div class="kicker">${signup ? "Crea il tuo account" : "Bentornato"}</div>
    <h1>${signup ? "Entra nel<br>club Coronel" : "Accedi"}</h1>
    <p class="sub" style="margin-bottom:22px">${signup ? "Raccogli un timbro a ogni visita: al 10° il taglio è omaggio." : "Prenota, controlla i tuoi timbri e i tuoi premi."}</p>
    <form id="auth-form" novalidate>
      ${signup ? `<label class="field"><span>Nome e cognome</span><input name="name" autocomplete="name" required></label>
      <label class="field"><span>Telefono (facoltativo)</span><input name="phone" type="tel" autocomplete="tel"></label>` : ""}
      <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
      <label class="field"><span>Password${signup ? " (almeno 8 caratteri)" : ""}</span><input name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" required></label>
      <p class="msg" id="auth-msg"></p>
      <button class="btn btn-red btn-block" type="submit">${signup ? "Crea account" : "Accedi"}</button>
    </form>
    <p class="switch">${signup ? `Hai già un account? <button data-mode="login">Accedi</button>` : `Non hai un account? <button data-mode="signup">Registrati</button>`}</p>
    ${signup ? "" : `<p class="switch" style="margin-top:8px">Password dimenticata? <a href="https://ig.me/m/_coro.nel" target="_blank" rel="noopener">Scrivi a Coronel</a></p>`}
  </div>`;
  app.querySelector("[data-mode]").onclick = e => renderAuth(e.target.dataset.mode);
  $("#auth-form").onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target)), msg = $("#auth-msg"), btn = e.target.querySelector("button");
    btn.disabled = true; msg.className = "msg"; msg.textContent = "";
    try {
      const r = await api(signup ? "signup" : "login", f);
      setToken(r.token); S.user = r.user; await refreshMe(); S.route = "home"; render();
      if (signup) toast("Benvenuto da Coronel!");
    } catch (err) { msg.className = "msg err"; msg.textContent = err.message; btn.disabled = false; }
  };
}

// ---------- Home ----------
function nextDiscount() {
  const entries = Object.entries(S.cfg.discounts || {});
  return entries.length ? { date: entries[0][0], ...entries[0][1] } : null;
}
async function viewHome() {
  const st = S.stamps, first = S.user.name.split(" ")[0], disc = nextDiscount();
  app.innerHTML = `${pageTop(`<h1>Ciao, ${esc(first)}</h1><p class="sub">Il tuo prossimo taglio ti aspetta.</p>`)}
    ${disc ? `<div class="banner">${esc(disc.label)} · -${disc.percent}%<small>${fmtDate(disc.date)}: prenota quel giorno per lo sconto</small></div>` : ""}
    <div class="card" style="margin-top:14px">
      <div class="row"><div><div class="kicker">La tua tessera</div><strong style="font-size:22px">${st.onCard}/${st.card} timbri</strong></div>
      <button class="btn btn-ghost btn-sm" data-go="tessera">Vedi</button></div>
      <div class="stamps" style="margin-bottom:0">${Array.from({ length: st.card }, (_, i) => `<span class="stamp ${i < st.onCard ? "on" : ""} ${i === st.card - 1 ? "prize" : ""}">${I.star}</span>`).join("")}</div>
      ${st.rewards ? `<div class="reward">🎉 Hai ${st.rewards} ${st.rewards > 1 ? "premi" : "premio"}: ${esc(st.reward)}. Mostra il tuo QR in studio.</div>` : ""}
    </div>
    <div class="actions">
      <button class="action" data-go="prenota">${I.cal}Prenota</button>
      <button class="action" id="h-qr">${I.qr}Il mio QR</button>
      <button class="action" id="h-scan">${I.scan}Scansiona</button>
    </div>
    <h2>Prossimo appuntamento</h2><div id="h-next"><div class="empty">Caricamento…</div></div>
    <h2>Servizi</h2><div class="list">${S.cfg.services.map(s => `<button class="item" data-book="${s.id}"><div class="grow"><strong>${esc(s.name)}</strong><small>${s.min} min</small></div><div class="end">${s.price}€</div></button>`).join("")}</div>`;
  bindCommon();
  app.querySelectorAll("[data-book]").forEach(b => b.onclick = () => { S.bk = { service: b.dataset.book }; go("prenota"); });
  try {
    const { bookings } = await api("my-bookings");
    const today = S.cfg.today;
    const next = bookings.filter(b => ["richiesta", "confermata"].includes(b.status) && b.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
    $("#h-next").innerHTML = next ? bookingItem(next, true) : `<div class="card empty">Nessun appuntamento. <button class="btn btn-red btn-sm" data-go="prenota" style="margin-left:8px">Prenota ora</button></div>`;
    bindCommon();
  } catch (e) { $("#h-next").innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
function bindCommon() {
  app.querySelectorAll("[data-go]").forEach(b => b.onclick = () => go(b.dataset.go));
  const q = $("#h-qr"); if (q) q.onclick = showMyQR;
  const s = $("#h-scan"); if (s) s.onclick = scanShop;
  app.querySelectorAll("[data-cancel]").forEach(b => b.onclick = () => cancelBooking(b.dataset.cancel));
}
function bookingItem(b, cancellable) {
  const final = b.discount ? Math.round(b.price * (100 - b.discount) / 100) : b.price;
  return `<div class="item"><div class="grow"><strong>${esc(b.serviceName)}</strong>
    <small>${fmtDate(b.date)} · ${b.time}${b.discount ? ` · sconto ${b.discount}%` : ""}</small></div>
    <div class="end"><span class="badge st-${b.status}">${b.status}</span><br><small>${final}€</small>
    ${cancellable && ["richiesta", "confermata"].includes(b.status) ? `<br><button class="btn btn-ghost btn-sm" style="margin-top:6px" data-cancel="${b.id}">Annulla</button>` : ""}</div></div>`;
}
async function cancelBooking(id) {
  if (!confirm("Vuoi annullare questa prenotazione?")) return;
  try { await api("cancel-booking", { id }); toast("Prenotazione annullata"); render(); } catch (e) { toast(e.message); }
}
function showMyQR() {
  sheet(`<div class="kicker">Il mio codice</div><h2>Mostralo in studio</h2>
    <p class="sub">Coronel lo scansiona dopo il servizio e il timbro arriva sulla tua tessera.</p>
    <div class="qrbox" data-qr="CORONEL:${esc(S.user.qr)}"><div class="spin"></div></div>
    <p class="sub" style="text-align:center">${esc(S.user.name)} · ${S.stamps.onCard}/${S.stamps.card} timbri</p>`, el => fillQR(el));
}
function scanShop() {
  openScanner("QR del negozio", async code => {
    try {
      const r = await api("claim", { code });
      S.stamps = r.stamps;
      toast(r.bonus ? "Timbro aggiunto + timbro bonus!" : "Timbro aggiunto!");
      go("tessera");
    } catch (e) { toast(e.message); }
  });
}

// ---------- Prenota ----------
function freeTimes(date, minutes, busy) {
  const h = S.cfg.hours[wd(date)]; if (!h) return [];
  const step = S.cfg.slot, out = [];
  const nowMin = (() => { const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()); return +p.find(x => x.type === "hour").value * 60 + +p.find(x => x.type === "minute").value; })();
  for (let t = h[0] * 60; t + minutes <= h[1] * 60; t += step) {
    if (date === S.cfg.today && t <= nowMin + 30) continue;
    let ok = true;
    for (let u = t; u < t + minutes; u += step) if (busy.includes(toHHMM(u).replace(":", ""))) { ok = false; break; }
    if (ok) out.push(toHHMM(t));
  }
  return out;
}
async function viewBook() {
  const bk = S.bk;
  const days = [];
  for (let i = 0; i <= S.cfg.bookDays && days.length < 24; i++) {
    const d = addDays(S.cfg.today, i);
    if (S.cfg.hours[wd(d)] && !S.cfg.closures[d]) days.push(d);
  }
  if (bk.date && !days.includes(bk.date)) bk.date = null;
  const svc = S.cfg.services.find(s => s.id === bk.service);
  app.innerHTML = `${pageTop(`<h1>Prenota</h1><p class="sub">Scegli servizio, giorno e orario. Coronel conferma la prenotazione.</p>`)}
    <h2>1 · Servizio</h2>
    <div class="list">${S.cfg.services.map(s => `<button class="item ${bk.service === s.id ? "sel" : ""}" data-svc="${s.id}"><div class="grow"><strong>${esc(s.name)}</strong><small>${s.min} min</small></div><div class="end">${s.price}€</div></button>`).join("")}</div>
    <div id="bk-rest"></div>
    <h2>I miei appuntamenti</h2><div class="list" id="bk-mine"><div class="empty">Caricamento…</div></div>`;
  app.querySelectorAll("[data-svc]").forEach(b => b.onclick = () => { bk.service = b.dataset.svc; bk.time = null; viewBook(); });
  const rest = $("#bk-rest");
  if (svc) {
    rest.innerHTML = `<h2>2 · Giorno</h2><div class="days">${days.map(d => { const x = new Date(d + "T12:00:00Z"); const disc = S.cfg.discounts[d];
      return `<button class="day ${bk.date === d ? "sel" : ""}" data-day="${d}">${disc ? `<span class="tag">-${disc.percent}%</span>` : ""}<small>${DAYS[x.getUTCDay()]}</small><b>${x.getUTCDate()}</b><small>${MONTHS[x.getUTCMonth()]}</small></button>`; }).join("")}</div>
      <div id="bk-times"></div>`;
    rest.querySelectorAll("[data-day]").forEach(b => b.onclick = () => { bk.date = b.dataset.day; bk.time = null; viewBook(); });
    if (bk.date) {
      const box = $("#bk-times");
      box.innerHTML = `<h2>3 · Orario</h2><div class="empty"><div class="spin" style="margin:auto"></div></div>`;
      try {
        const { busy } = await api("busy", { date: bk.date });
        const times = freeTimes(bk.date, svc.min, busy);
        const disc = S.cfg.discounts[bk.date];
        const price = disc ? Math.round(svc.price * (100 - disc.percent) / 100) : svc.price;
        box.innerHTML = `<h2>3 · Orario</h2>${times.length ? `<div class="times">${times.map(t => `<button class="time ${bk.time === t ? "sel" : ""}" data-time="${t}">${t}</button>`).join("")}</div>` : `<div class="card empty">Nessun orario libero questo giorno. Prova un altro giorno.</div>`}
          ${bk.time ? `<div class="card" style="margin-top:16px"><div class="kicker">Riepilogo</div>
            <p style="margin:8px 0"><strong>${esc(svc.name)}</strong> · ${svc.min} min<br>${fmtDate(bk.date)} alle ${bk.time}</p>
            <p><strong style="font-size:22px">${price}€</strong>${disc ? ` <small class="sub"><s>${svc.price}€</s> · ${esc(disc.label)}</small>` : ""}</p>
            <label class="field" style="margin-top:12px"><span>Nota (facoltativa)</span><input id="bk-note" maxlength="300" placeholder="Es. prima volta, richieste particolari"></label>
            <p class="msg" id="bk-msg"></p>
            <button class="btn btn-red btn-block" id="bk-go">Invia prenotazione</button></div>` : ""}`;
        box.querySelectorAll("[data-time]").forEach(b => b.onclick = () => { bk.time = b.dataset.time; viewBook(); });
        const goBtn = $("#bk-go");
        if (goBtn) goBtn.onclick = async () => {
          goBtn.disabled = true;
          try {
            await api("book", { service: bk.service, date: bk.date, time: bk.time, note: $("#bk-note").value });
            S.bk = {}; toast("Prenotazione inviata! Riceverai la conferma qui nell'app."); viewBook();
          } catch (e) { $("#bk-msg").className = "msg err"; $("#bk-msg").textContent = e.message; goBtn.disabled = false; if (/preso/.test(e.message)) { bk.time = null; setTimeout(viewBook, 1200); } }
        };
        if (bk.time) $("#bk-go").scrollIntoView({ block: "center", behavior: "smooth" });
      } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    }
  }
  try {
    const { bookings } = await api("my-bookings");
    $("#bk-mine").innerHTML = bookings.length ? bookings.slice(0, 15).map(b => bookingItem(b, b.date >= S.cfg.today)).join("") : `<div class="empty">Non hai ancora prenotazioni.</div>`;
    bindCommon();
  } catch (e) { $("#bk-mine").innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

// ---------- Tessera ----------
async function viewCard() {
  try { await refreshMe(); } catch (e) {}
  const st = S.stamps;
  app.innerHTML = `${pageTop(`<h1>La mia tessera</h1><p class="sub">Un timbro a ogni visita. Al ${st.card}° timbro: ${esc(st.reward)}.</p>`)}
    <div class="stampcard lvl-${st.level.id}" style="margin-top:14px">
      <div class="row"><div>${logo(12)}</div><span class="pill lvl-${st.level.id}">★ ${esc(st.level.name)}</span></div>
      <div class="stamps">${Array.from({ length: st.card }, (_, i) => `<span class="stamp ${i < st.onCard ? "on" : ""} ${i === st.card - 1 ? "prize" : ""}">${I.star}</span>`).join("")}</div>
      <div class="row"><strong>${st.onCard}/${st.card} timbri</strong><small>${esc(S.user.name)}</small></div>
      ${st.rewards ? `<div class="reward">🎉 ${st.rewards} ${st.rewards > 1 ? "premi disponibili" : "premio disponibile"}: ${esc(st.reward)}</div>` : ""}
    </div>
    <div class="grid2" style="margin-top:12px">
      <button class="btn btn-red" id="h-qr">${I.qr} Il mio QR</button>
      <button class="btn btn-ghost" id="h-scan">${I.scan} Scansiona</button>
    </div>
    <h2>Il tuo livello</h2>
    <div class="card">
      <p><strong>${esc(st.level.name)}</strong> · ${st.visits} ${st.visits === 1 ? "visita" : "visite"} negli ultimi 12 mesi</p>
      <p class="sub" style="margin-top:6px">${st.level.bonusEvery ? `Vantaggio: un timbro bonus ogni ${st.level.bonusEvery} visite.` : "Sali di livello per avere timbri bonus."}
      ${st.nextLevel ? ` Ti mancano <strong>${st.nextLevel.missing}</strong> visite per diventare ${esc(st.nextLevel.name)}.` : " Sei al livello più alto!"}</p>
      <div class="grid2" style="margin-top:12px;grid-template-columns:repeat(4,1fr);gap:6px">
        ${S.cfg.levels.map(l => `<div class="stat card" style="padding:10px 4px"><b style="font-size:15px" class="lvl-${l.id}">${esc(l.name)}</b><small>${l.from}+ visite</small></div>`).join("")}
      </div>
      <p class="sub" style="margin-top:10px;font-size:13px">Gold: +1 timbro bonus ogni 5 visite · Black: +1 timbro bonus ogni 3 visite.</p>
    </div>
    <h2>Storico</h2>
    <div class="card">${st.history.length ? `<ul class="history">${st.history.map(h => `<li><span>${REASONS[h.reason] || h.reason}${h.service ? " · " + esc(svcName(h.service)) : ""}<br><small class="sub">${fmtShort(h.at)}</small></span><span class="${h.delta > 0 ? "plus" : "minus"}">${h.delta > 0 ? "+" : ""}${h.delta}</span></li>`).join("")}</ul>` : `<div class="empty">Ancora nessun timbro: il primo arriva alla prossima visita.</div>`}</div>`;
  bindCommon();
}

// ---------- Profilo ----------
async function viewProfile() {
  app.innerHTML = `${pageTop(`<h1>Profilo</h1>`)}
    <div class="card"><form id="pf" novalidate>
      <label class="field"><span>Nome</span><input name="name" value="${esc(S.user.name)}"></label>
      <label class="field"><span>Telefono</span><input name="phone" type="tel" value="${esc(S.user.phone)}"></label>
      <label class="field"><span>Email</span><input value="${esc(S.user.email)}" disabled></label>
      <details><summary class="sub" style="margin-bottom:12px">Cambia password</summary>
        <label class="field"><span>Password attuale</span><input name="password" type="password" autocomplete="current-password"></label>
        <label class="field"><span>Nuova password</span><input name="newPassword" type="password" autocomplete="new-password"></label>
      </details>
      <p class="msg" id="pf-msg"></p>
      <button class="btn btn-red btn-block">Salva</button></form></div>
    <h2>Buoni regalo</h2>
    <div class="card"><p class="sub">Regala un momento da Coronel: scegli l'importo, Coronel attiva il buono e ti dà il codice da regalare.</p>
      <button class="btn btn-ghost btn-block" id="v-new" style="margin-top:12px">${I.gift} Richiedi un buono regalo</button></div>
    <div class="list" id="v-list" style="margin-top:10px"></div>
    <h2>Contatti</h2>
    <div class="card"><p><strong>Coronel</strong><br>Via Luigi Canonica 7, 6950 Tesserete</p>
      <p class="sub" style="margin-top:6px">Mar–Ven 9–19 · Sab 9–18 · Dom–Lun chiuso</p>
      <div class="grid2" style="margin-top:12px"><a class="btn btn-ghost btn-sm" href="https://ig.me/m/_coro.nel" target="_blank" rel="noopener">Instagram</a><a class="btn btn-ghost btn-sm" href="https://coronel-studio.netlify.app" target="_blank" rel="noopener">Sito web</a></div></div>
    <button class="btn btn-ghost btn-block" id="logout" style="margin-top:22px">Esci</button>
    <button class="btn btn-block" id="del-acc" style="margin-top:8px;color:#ff8787;font-size:13px">Elimina il mio account</button>`;
  $("#pf").onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target)), msg = $("#pf-msg");
    if (!f.newPassword) { delete f.password; delete f.newPassword; }
    try { const r = await api("update-profile", f); S.user = r.user; msg.className = "msg ok"; msg.textContent = "Salvato"; e.target.reset(); viewProfile(); toast("Profilo aggiornato"); }
    catch (err) { msg.className = "msg err"; msg.textContent = err.message; }
  };
  $("#logout").onclick = logout;
  $("#del-acc").onclick = () => sheet(`<div class="kicker">Attenzione</div><h2>Elimina account</h2>
    <p class="sub">Verranno cancellati il tuo profilo, i timbri e le prenotazioni future. L'operazione non si può annullare.</p>
    <label class="field" style="margin-top:14px"><span>Conferma con la tua password</span><input id="del-pw" type="password" autocomplete="current-password"></label>
    <p class="msg" id="del-msg"></p><button class="btn btn-red btn-block" id="del-go">Elimina definitivamente</button>`, (el, close) => {
      el.querySelector("#del-go").onclick = async () => {
        try { await api("delete-account", { password: el.querySelector("#del-pw").value }); close(); toast("Account eliminato"); logout(); }
        catch (err) { el.querySelector("#del-msg").className = "msg err"; el.querySelector("#del-msg").textContent = err.message; }
      };
    });
  $("#v-new").onclick = () => sheet(`<div class="kicker">Buono regalo</div><h2>Richiedi un buono</h2>
    <form id="vf" novalidate>
      <label class="field"><span>Importo (€)</span><input name="amount" type="number" min="10" max="500" step="5" value="50" inputmode="numeric"></label>
      <label class="field"><span>Per chi è? (facoltativo)</span><input name="recipient" maxlength="60"></label>
      <label class="field"><span>Messaggio (facoltativo)</span><textarea name="message" rows="3" maxlength="200"></textarea></label>
      <p class="msg" id="vf-msg"></p>
      <button class="btn btn-red btn-block">Invia richiesta</button></form>
    <p class="sub" style="margin-top:10px;font-size:13px">Il pagamento si fa in studio: dopo, Coronel attiva il buono e qui compare il codice.</p>`, (el, close) => {
      el.querySelector("#vf").onsubmit = async e => {
        e.preventDefault();
        try { await api("request-voucher", Object.fromEntries(new FormData(e.target))); close(); toast("Richiesta inviata"); viewProfile(); }
        catch (err) { el.querySelector("#vf-msg").className = "msg err"; el.querySelector("#vf-msg").textContent = err.message; }
      };
    });
  try {
    const { vouchers } = await api("my-vouchers");
    $("#v-list").innerHTML = vouchers.map(v => `<div class="item"><div class="grow"><strong>Buono ${v.amount}€</strong><small>${v.recipient ? "Per " + esc(v.recipient) + " · " : ""}${fmtShort(v.createdAt)}${v.code ? ` · codice <b>${esc(v.code)}</b>` : ""}</small></div><span class="badge st-${v.status}">${v.status}</span></div>`).join("");
  } catch (e) {}
}

// ---------- Admin ----------
const ADMIN_TABS = [["oggi", "Prenotazioni"], ["scanner", "Scansiona cliente"], ["qr", "QR negozio"], ["clienti", "Clienti"], ["calendario", "Sconti e chiusure"], ["buoni", "Buoni"]];
function viewAdmin() {
  if (!S.user.isAdmin) return go("home");
  app.innerHTML = `${pageTop(`<div class="kicker">Area riservata</div><h1>Admin</h1>`)}
    <div class="tabs">${ADMIN_TABS.map(([k, l]) => `<button class="tab ${S.adminTab === k ? "on" : ""}" data-tab="${k}">${l}</button>`).join("")}</div>
    <div id="adm"><div class="empty"><div class="spin" style="margin:auto"></div></div></div>`;
  app.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { S.adminTab = b.dataset.tab; viewAdmin(); });
  ({ oggi: admBookings, scanner: admScanner, qr: admQR, clienti: admClients, calendario: admCalendar, buoni: admVouchers })[S.adminTab]();
}
const adm = () => $("#adm");

async function admBookings() {
  const day = S.adminDay || S.cfg.today;
  try {
    const [{ bookings: pending }, { bookings }] = await Promise.all([api("admin/pending"), api("admin/bookings", { from: day, days: 1 })]);
    const card = b => `<div class="card"><div class="row"><div><strong>${b.time} · ${esc(b.serviceName)}</strong><br>
      <small class="sub">${esc(b.userName)}${b.userPhone ? " · " + esc(b.userPhone) : ""} · ${fmtDate(b.date)}${b.discount ? ` · -${b.discount}%` : ""}</small>
      ${b.note ? `<br><small>“${esc(b.note)}”</small>` : ""}</div><span class="badge st-${b.status}">${b.status}</span></div>
      <div class="grid2" style="margin-top:12px">
        ${b.status === "richiesta" ? `<button class="btn btn-ok btn-sm" data-st="confermata" data-id="${b.id}">Conferma</button><button class="btn btn-ghost btn-sm" data-st="rifiutata" data-id="${b.id}">Rifiuta</button>` : ""}
        ${b.status === "confermata" ? `<button class="btn btn-red btn-sm" data-st="completata" data-id="${b.id}">Fatto · +timbro</button><button class="btn btn-ghost btn-sm" data-st="annullata" data-id="${b.id}">Annulla</button>` : ""}
      </div></div>`;
    adm().innerHTML = `${pending.length ? `<h2>Da confermare (${pending.length})</h2>${pending.map(card).join("")}` : ""}
      <h2>Agenda</h2>
      <div class="row card" style="padding:10px"><button class="btn btn-ghost btn-sm" data-dd="-1">‹</button><strong>${fmtDate(day)}</strong><button class="btn btn-ghost btn-sm" data-dd="1">›</button></div>
      <div style="margin-top:12px">${bookings.length ? bookings.map(card).join("") : `<div class="card empty">Nessuna prenotazione in questo giorno.</div>`}</div>`;
    adm().querySelectorAll("[data-dd]").forEach(b => b.onclick = () => { S.adminDay = addDays(day, +b.dataset.dd); admBookings(); });
    adm().querySelectorAll("[data-st]").forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { const r = await api("admin/booking-status", { id: b.dataset.id, status: b.dataset.st }); toast(b.dataset.st === "completata" ? (r.bonus ? "Timbro + bonus aggiunti" : "Timbro aggiunto") : "Prenotazione " + b.dataset.st); admBookings(); }
      catch (e) { toast(e.message); b.disabled = false; }
    });
  } catch (e) { adm().innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

function clientPanel(c, st, after) {
  return `<div class="card"><div class="row"><div><strong style="font-size:18px">${esc(c.name)}</strong><br><small class="sub">${esc(c.email)}${c.phone ? " · " + esc(c.phone) : ""}</small></div><span class="pill lvl-${st.level.id}">★ ${esc(st.level.name)}</span></div>
    <div class="stamps">${Array.from({ length: st.card }, (_, i) => `<span class="stamp ${i < st.onCard ? "on" : ""} ${i === st.card - 1 ? "prize" : ""}">${I.star}</span>`).join("")}</div>
    <p><strong>${st.onCard}/${st.card}</strong> timbri · ${st.visits} visite in 12 mesi${st.rewards ? ` · <span class="plus">${st.rewards} premi da riscattare</span>` : ""}</p>
    <label class="field" style="margin-top:14px"><span>Servizio fatto</span><select id="cp-svc">${S.cfg.services.map(s => `<option value="${s.id}">${esc(s.name)} · ${s.price}€</option>`).join("")}</select></label>
    <button class="btn btn-red btn-block" id="cp-award">+1 timbro per questa visita</button>
    ${st.rewards ? `<button class="btn btn-ok btn-block" id="cp-redeem" style="margin-top:8px">Riscatta premio: ${esc(st.reward)}</button>` : ""}
    <details style="margin-top:14px"><summary class="sub">Altre azioni</summary>
      <div class="grid2" style="margin-top:10px"><button class="btn btn-ghost btn-sm" data-adj="1">+1 correzione</button><button class="btn btn-ghost btn-sm" data-adj="-1">−1 correzione</button></div>
      <button class="btn btn-ghost btn-sm btn-block" id="cp-pass" style="margin-top:8px">Imposta nuova password</button>
    </details></div>`;
}
function bindClientPanel(root, c, refresh) {
  root.querySelector("#cp-award").onclick = async e => {
    e.target.disabled = true;
    try { const r = await api("admin/award", { userId: c.id, service: root.querySelector("#cp-svc").value }); toast(r.bonus ? "Timbro + bonus aggiunti!" : "Timbro aggiunto!"); refresh(r.stamps); }
    catch (err) { toast(err.message); e.target.disabled = false; }
  };
  const rd = root.querySelector("#cp-redeem");
  if (rd) rd.onclick = async () => { if (!confirm("Confermi il premio per " + c.name + "?")) return; try { const r = await api("admin/redeem", { userId: c.id }); toast("Premio riscattato"); refresh(r.stamps); } catch (err) { toast(err.message); } };
  root.querySelectorAll("[data-adj]").forEach(b => b.onclick = async () => { try { const r = await api("admin/adjust", { userId: c.id, delta: +b.dataset.adj }); toast("Corretto"); refresh(r.stamps); } catch (err) { toast(err.message); } });
  root.querySelector("#cp-pass").onclick = async () => {
    const p = prompt("Nuova password per " + c.name + " (almeno 8 caratteri):");
    if (!p) return;
    try { await api("admin/reset-password", { userId: c.id, password: p }); toast("Password aggiornata: comunicala al cliente"); } catch (err) { toast(err.message); }
  };
}
function admScanner() {
  adm().innerHTML = `<div class="card"><p class="sub">Scansiona il QR che il cliente mostra nella sua app, scegli il servizio e aggiungi il timbro.</p>
    <button class="btn btn-red btn-block" id="sc-go" style="margin-top:12px">${I.scan} Apri la fotocamera</button></div><div id="sc-res" style="margin-top:12px"></div>`;
  $("#sc-go").onclick = () => openScanner("QR del cliente", async code => {
    try {
      const r = await api("admin/scan", { qr: code });
      const show = st => { $("#sc-res").innerHTML = clientPanel(r.client, st); bindClientPanel($("#sc-res"), r.client, show); };
      show(r.stamps);
    } catch (e) { toast(e.message); }
  });
}
function admQR() {
  adm().innerHTML = `<div class="card"><p class="sub">Genera un QR valido una sola volta per 5 minuti: il cliente lo scansiona con l'app e riceve il timbro.</p>
    <label class="field" style="margin-top:12px"><span>Servizio fatto</span><select id="qr-svc">${S.cfg.services.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></label>
    <button class="btn btn-red btn-block" id="qr-go">${I.qr} Genera QR</button></div><div id="qr-res"></div>`;
  $("#qr-go").onclick = async () => {
    try {
      const r = await api("admin/claim-create", { service: $("#qr-svc").value });
      const box = $("#qr-res");
      box.innerHTML = `<div class="card" style="margin-top:12px;text-align:center"><strong>${esc(r.service.name)}</strong><div class="qrbox" data-qr="${esc(r.code)}"><div class="spin"></div></div>
        <p class="sub" id="qr-state">Valido ancora <b id="qr-left">5:00</b></p><p class="sub" style="font-size:12px;margin-top:6px">Codice manuale: ${esc(r.code.replace("CORONEL-CLAIM:", ""))}</p></div>`;
      fillQR(box);
      const end = Date.parse(r.expiresAt);
      clearInterval(admQR.t);
      admQR.t = setInterval(async () => {
        if (!document.body.contains(box)) return clearInterval(admQR.t);
        const left = Math.max(0, Math.round((end - Date.now()) / 1000));
        const el = $("#qr-left"); if (el) el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
        if (left % 3 === 0) {
          try { const s = await api("admin/claim-status", { code: r.code }); if (s.used) { clearInterval(admQR.t); $("#qr-state").innerHTML = `<span class="plus">✓ Usato da ${esc(s.by)}</span>`; toast("Timbro assegnato a " + s.by); } } catch (e) {}
        }
        if (!left) { clearInterval(admQR.t); $("#qr-state").textContent = "QR scaduto: generane uno nuovo."; }
      }, 1000);
    } catch (e) { toast(e.message); }
  };
}
async function admClients(q = "") {
  try {
    const { clients, total } = await api("admin/clients", { q });
    adm().innerHTML = `<div class="field"><input id="cl-q" placeholder="Cerca per nome, email o telefono" value="${esc(q)}"></div>
      <p class="sub" style="margin-bottom:10px">${total} clienti registrati</p>
      <div class="list">${clients.map(c => `<button class="item" data-cl="${c.id}"><div class="grow"><strong>${esc(c.name)}${c.isAdmin ? " · admin" : ""}</strong><small>${esc(c.email)}${c.phone ? " · " + esc(c.phone) : ""}</small></div><div class="end">›</div></button>`).join("") || `<div class="empty">Nessun cliente trovato.</div>`}</div>`;
    const inp = $("#cl-q");
    inp.oninput = () => { clearTimeout(admClients.t); admClients.t = setTimeout(() => admClients(inp.value).then(() => { const i = $("#cl-q"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }), 350); };
    adm().querySelectorAll("[data-cl]").forEach(b => b.onclick = async () => {
      try {
        const r = await api("admin/client", { id: b.dataset.cl });
        sheet(`<div id="cl-panel"></div><h2>Ultime prenotazioni</h2><div class="list">${r.bookings.map(x => bookingItem(x, false)).join("") || `<div class="empty">Nessuna prenotazione.</div>`}</div>`, el => {
          const root = el.querySelector("#cl-panel");
          const show = st => { root.innerHTML = clientPanel(r.client, st); bindClientPanel(root, r.client, show); };
          show(r.stamps);
        });
      } catch (e) { toast(e.message); }
    });
  } catch (e) { adm().innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
async function admCalendar() {
  try { S.cfg = { ...S.cfg, ...(await api("config")) }; } catch (e) {}
  const d = S.cfg.discounts, c = S.cfg.closures;
  adm().innerHTML = `<h2>Giorni di sconto</h2>
    <div class="card"><form id="df" class="grid2" novalidate>
      <label class="field"><span>Giorno</span><input name="date" type="date" min="${S.cfg.today}" required></label>
      <label class="field"><span>Sconto %</span><input name="percent" type="number" min="5" max="70" value="20"></label>
      <label class="field" style="grid-column:1/-1"><span>Nome (facoltativo)</span><input name="label" placeholder="Es. Martedì studenti"></label>
      <button class="btn btn-red" style="grid-column:1/-1">Aggiungi sconto</button></form></div>
    <div class="list" style="margin-top:10px">${Object.entries(d).map(([day, v]) => `<div class="item"><div class="grow"><strong>-${v.percent}% · ${esc(v.label)}</strong><small>${fmtDate(day)}</small></div><button class="btn btn-ghost btn-sm" data-ddel="${day}">Elimina</button></div>`).join("") || `<div class="empty">Nessuno sconto in programma.</div>`}</div>
    <h2>Chiusure straordinarie</h2>
    <div class="card"><form id="cf" class="grid2" novalidate>
      <label class="field"><span>Giorno</span><input name="date" type="date" min="${S.cfg.today}" required></label>
      <label class="field"><span>Motivo</span><input name="label" placeholder="Ferie, festivo…"></label>
      <button class="btn btn-ghost" style="grid-column:1/-1">Aggiungi chiusura</button></form></div>
    <div class="list" style="margin-top:10px">${Object.entries(c).map(([day, v]) => `<div class="item"><div class="grow"><strong>${esc(v.label)}</strong><small>${fmtDate(day)}</small></div><button class="btn btn-ghost btn-sm" data-cdel="${day}">Elimina</button></div>`).join("") || `<div class="empty">Nessuna chiusura in programma.</div>`}</div>`;
  const save = async (action, body) => { try { const r = await api(action, body); S.cfg = { ...S.cfg, discounts: r.discounts, closures: r.closures }; toast("Salvato"); admCalendar(); } catch (e) { toast(e.message); } };
  $("#df").onsubmit = e => { e.preventDefault(); save("admin/discount-set", Object.fromEntries(new FormData(e.target))); };
  $("#cf").onsubmit = e => { e.preventDefault(); save("admin/closure-set", Object.fromEntries(new FormData(e.target))); };
  adm().querySelectorAll("[data-ddel]").forEach(b => b.onclick = () => save("admin/discount-del", { date: b.dataset.ddel }));
  adm().querySelectorAll("[data-cdel]").forEach(b => b.onclick = () => save("admin/closure-del", { date: b.dataset.cdel }));
}
async function admVouchers() {
  try {
    const { vouchers } = await api("admin/vouchers");
    adm().innerHTML = `<div class="list">${vouchers.map(v => `<div class="card"><div class="row"><div><strong>Buono ${v.amount}€</strong><br><small class="sub">da ${esc(v.userName)}${v.recipient ? " · per " + esc(v.recipient) : ""} · ${fmtShort(v.createdAt)}</small>
      ${v.message ? `<br><small>“${esc(v.message)}”</small>` : ""}${v.code ? `<br><small>Codice: <b>${esc(v.code)}</b></small>` : ""}</div><span class="badge st-${v.status}">${v.status}</span></div>
      <div class="grid2" style="margin-top:12px">
        ${v.status === "richiesto" ? `<button class="btn btn-ok btn-sm" data-vs="attivo" data-id="${v.id}">Pagato · attiva</button><button class="btn btn-ghost btn-sm" data-vs="annullato" data-id="${v.id}">Annulla</button>` : ""}
        ${v.status === "attivo" ? `<button class="btn btn-red btn-sm" data-vs="usato" data-id="${v.id}">Segna come usato</button>` : ""}
      </div></div>`).join("") || `<div class="card empty">Nessuna richiesta di buono.</div>`}</div>`;
    adm().querySelectorAll("[data-vs]").forEach(b => b.onclick = async () => { try { await api("admin/voucher-status", { id: b.dataset.id, status: b.dataset.vs }); toast("Aggiornato"); admVouchers(); } catch (e) { toast(e.message); } });
  } catch (e) { adm().innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

// ---------- Avvio ----------
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
render();
