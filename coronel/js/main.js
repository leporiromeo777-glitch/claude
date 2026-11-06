// Coronel: codice comune a tutte le pagine.
// Ogni blocco si attiva solo se la pagina contiene gli elementi che gli servono.

// Link di prenotazione: incollare qui l'URL completo (con ?studio=...) dalla bio Instagram.
const BOOKING_URL = "https://elegance-style-75db0663.base44.app/PrenotazioneCliente";

const SERVICES = [
  { id: "taglio",        name: "Taglio Uomo",     price: 32, min: 45,  popular: true, alt: "Taglio uomo con sfumatura" },
  { id: "studente",      name: "Taglio studente", price: 25, min: 45,  alt: "Taglio per studenti" },
  { id: "barba",         name: "Barba",           price: 15, min: 30,  alt: "Rifinitura della barba" },
  { id: "decolorazione", name: "Decolorazione",   price: 80, min: 120, alt: "Decolorazione dei capelli" },
  { id: "lavaggio",      name: "Lavaggio",        price: 5,  min: 10,  alt: "Lavaggio dei capelli" },
];

// Orari (ora di Zurigo): giorno della settimana → [apertura, chiusura]
const HOURS = { 2: [9, 19], 3: [9, 19], 4: [9, 19], 5: [9, 19], 6: [9, 18] };

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(pointer: fine)").matches;
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const page = document.body.dataset.page;

// ---------- Logo ----------
const tpl = $("#logo-tpl");
$$("[data-logo]").forEach(el => el.appendChild(tpl.content.cloneNode(true)));

// ---------- Link di prenotazione ----------
$$("[data-book]").forEach(a => { a.href = BOOKING_URL; a.target = "_blank"; a.rel = "noopener"; });

// ---------- Menu: pagina attiva e menu su telefono ----------
$$("[data-nav]").forEach(a => a.classList.toggle("active", a.dataset.nav === page));
const burger = $("#burger");
function setMenu(open) {
  document.body.classList.toggle("menu-open", open);
  burger.setAttribute("aria-expanded", open);
  burger.setAttribute("aria-label", open ? "Chiudi il menu" : "Apri il menu");
}
burger.addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open")));
addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });

// ---------- Listino (pagina Servizi) ----------
const servicesEl = $("#services");
const selected = new Set();
const summary = $("#summary"), mobileBook = $("#mobile-book");
let hsActive = false, hsShift = 0, updateHS = () => {};

if (servicesEl) {
  const plus = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  servicesEl.innerHTML = SERVICES.map((s, i) => `
    <button class="svc reveal" type="button" data-id="${s.id}" aria-pressed="false" style="--d:${(i % 3) * 0.1}s">
      <div class="svc-img">
        ${s.popular ? '<span class="badge">Più richiesto</span>' : ""}
        <span class="price">${s.price}€</span>
        <img src="img/${s.id}.webp" alt="${s.alt}" width="896" height="1120" loading="lazy">
      </div>
      <div class="svc-body"><h3>${s.name}</h3><span class="dur">${s.min} min</span></div>
      <span class="svc-add"><span class="add-label">Aggiungi</span><span class="plus">${plus}</span></span>
    </button>`).join("");
  $("#dots").innerHTML = SERVICES.map(() => "<i></i>").join("");

  let shownPrice = 0, shownMin = 0;
  const countTo = (el, from, to, suffix) => {
    if (reduced || from === to) { el.textContent = to + suffix; return; }
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / 500), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (to - from) * e) + suffix;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const renderSummary = () => {
    const items = SERVICES.filter(s => selected.has(s.id));
    const price = items.reduce((a, s) => a + s.price, 0), min = items.reduce((a, s) => a + s.min, 0);
    countTo($("#sum-price"), shownPrice, price, "€");
    countTo($("#sum-time"), shownMin, min, " min");
    shownPrice = price; shownMin = min;
    $("#sum-list").textContent = items.map(s => s.name).join(" + ");
    summary.classList.toggle("show", items.length > 0);
    updateMobileBook();
  };
  const setCard = (card, on) => {
    card.classList.toggle("selected", on);
    card.setAttribute("aria-pressed", on);
    card.querySelector(".add-label").textContent = on ? "Aggiunto" : "Aggiungi";
  };
  servicesEl.addEventListener("click", e => {
    const card = e.target.closest(".svc"); if (!card) return;
    const id = card.dataset.id;
    selected.has(id) ? selected.delete(id) : selected.add(id);
    setCard(card, selected.has(id));
    renderSummary();
  });
  $("#sum-clear").addEventListener("click", () => { selected.clear(); $$(".svc").forEach(c => setCard(c, false)); renderSummary(); });

  // Su telefono: scendendo, la sezione resta ferma e le card scorrono verso destra
  // (1 pixel in verticale = 1 pixel in orizzontale); finite le card, la pagina riprende a scendere.
  const dots = $$("#dots i"), hsOuter = $("#hs-outer"), hsSticky = $("#hs-sticky");
  const mobileMQ = matchMedia("(max-width: 600px)");
  const setDot = i => dots.forEach((d, k) => d.classList.toggle("on", k === i));
  const layoutHS = () => {
    document.documentElement.classList.remove("hs-on");
    hsOuter.style.height = ""; servicesEl.style.removeProperty("--hx"); hsActive = false;
    if (!mobileMQ.matches || reduced) return;
    document.documentElement.classList.add("hs-on");
    const last = servicesEl.lastElementChild;
    hsShift = Math.max(0, last.offsetLeft + last.offsetWidth + 16 - servicesEl.clientWidth);
    const content = hsSticky.firstElementChild.offsetHeight + 160;
    // Se lo schermo è troppo basso per contenere la sezione, resta il carosello normale
    if (!hsShift || content > hsSticky.offsetHeight) { document.documentElement.classList.remove("hs-on"); return; }
    hsOuter.style.height = hsSticky.offsetHeight + hsShift + "px";
    hsActive = true; updateHS();
  };
  updateHS = () => {
    if (!hsActive) return;
    const k = Math.min(1, Math.max(0, -hsOuter.getBoundingClientRect().top / hsShift));
    servicesEl.style.setProperty("--hx", (-k * hsShift).toFixed(1) + "px");
    setDot(Math.round(k * (SERVICES.length - 1)));
  };
  servicesEl.addEventListener("scroll", () => {
    if (hsActive) return;
    const mid = servicesEl.scrollLeft + servicesEl.clientWidth / 2;
    let best = 0, bestD = Infinity;
    [...servicesEl.children].forEach((c, i) => { const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (d < bestD) { bestD = d; best = i; } });
    setDot(best);
  }, { passive: true });
  setDot(0);
  layoutHS();
  addEventListener("resize", layoutHS);
  addEventListener("load", layoutHS);
}

// Barra "Prenota" su telefono: nella home compare dopo l'hero; sparisce quando c'è il riepilogo
function updateMobileBook() {
  if (!mobileBook) return;
  const early = page === "home" && scrollY < innerHeight * 0.7;
  mobileBook.classList.toggle("away", early || selected.size > 0);
}

// ---------- Titolo con parola che ruota (home) ----------
const rotator = $("#rotator");
if (rotator && !reduced) {
  const rot = [...rotator.children];
  let ri = 0;
  setInterval(() => {
    const cur = rot[ri]; ri = (ri + 1) % rot.length; const next = rot[ri];
    cur.classList.add("out"); cur.classList.remove("cur");
    next.classList.remove("out"); next.classList.add("cur");
    setTimeout(() => cur.classList.remove("out"), 700);
  }, 2600);
}

// ---------- Citazione che si "accende" parola per parola (studio) ----------
const quote = $("#chile-quote");
let words = [];
if (quote) {
  quote.innerHTML = quote.innerHTML.replace(/(<em>.*?<\/em>|[^\s<]+)/g, '<span class="word">$1</span>');
  words = [...quote.querySelectorAll(".word")];
}
function litWords() {
  if (!quote) return;
  const r = quote.getBoundingClientRect();
  const k = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (innerHeight * 0.5)));
  const n = Math.round(k * words.length);
  words.forEach((w, i) => w.classList.toggle("lit", i < n));
}

// ---------- Scroll: barra di avanzamento, menu, striscia, profondità ----------
const nav = $("#nav"), progress = $("#progress"), marquee = $("#marquee");
const parallaxEls = [...$$("[data-parallax]")];
let lastY = scrollY, velocity = 0, mqX = 0, ticking = false;
function onScroll() {
  const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
  progress.style.setProperty("--p", max > 0 ? y / max : 0);
  nav.classList.toggle("scrolled", y > 20);
  nav.classList.toggle("hidden", y > lastY && y > 500 && !(summary && summary.classList.contains("show")));
  velocity += (y - lastY) * 0.15;
  lastY = y;
  if (!reduced) parallaxEls.forEach(el => {
    const r = el.parentElement.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    el.style.setProperty("--py", (-(r.top + r.height / 2 - innerHeight / 2) * parseFloat(el.dataset.parallax)).toFixed(1) + "px");
  });
  litWords(); updateHS(); updateMobileBook();
  ticking = false;
}
addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
onScroll();

if (marquee && !reduced) (function loop() {
  velocity *= 0.9;
  mqX -= 0.6 + Math.abs(velocity) * 0.4;
  const half = marquee.scrollWidth / 2;
  if (-mqX >= half) mqX += half;
  marquee.style.transform = `translateX(${mqX}px) skewX(${Math.max(-12, Math.min(12, -velocity * 0.6))}deg)`;
  requestAnimationFrame(loop);
})();

// ---------- Animazioni all'ingresso ----------
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
}, { threshold: .15 });
$$(".reveal, [data-reveal]").forEach(el => io.observe(el));

// ---------- Effetti col mouse ----------
if (finePointer && !reduced) {
  const hero = $("#hero"), badge = $("#badge");
  if (hero && badge) {
    hero.addEventListener("mousemove", e => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty("--mx", (e.clientX - r.left) + "px");
      hero.style.setProperty("--my", (e.clientY - r.top) + "px");
      const b = badge.getBoundingClientRect();
      badge.style.setProperty("--ry", ((e.clientX - (b.left + b.width / 2)) / innerWidth * 30).toFixed(2) + "deg");
      badge.style.setProperty("--rx", (-(e.clientY - (b.top + b.height / 2)) / innerHeight * 30).toFixed(2) + "deg");
    });
    hero.addEventListener("mouseleave", () => { badge.style.setProperty("--rx", "0deg"); badge.style.setProperty("--ry", "0deg"); });
  }
  $$(".svc").forEach(card => {
    card.addEventListener("mousemove", e => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.setProperty("--mx", px * 100 + "%");
      card.style.setProperty("--my", py * 100 + "%");
      card.style.setProperty("--ry", ((px - .5) * 10).toFixed(2) + "deg");
      card.style.setProperty("--rx", ((.5 - py) * 10).toFixed(2) + "deg");
    });
    card.addEventListener("mouseleave", () => { card.style.setProperty("--rx", "0deg"); card.style.setProperty("--ry", "0deg"); });
  });
  $$(".magnetic").forEach(btn => {
    btn.addEventListener("mousemove", e => {
      const r = btn.getBoundingClientRect();
      btn.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .25}px, ${(e.clientY - r.top - r.height / 2) * .35}px)`;
    });
    btn.addEventListener("mouseleave", () => { btn.style.transform = ""; });
  });
  const cta = $("#cta");
  if (cta) cta.addEventListener("mousemove", e => {
    const r = cta.getBoundingClientRect();
    cta.style.setProperty("--mx", (e.clientX - r.left) + "px");
    cta.style.setProperty("--my", (e.clientY - r.top) + "px");
  });
}

// ---------- Copia indirizzo (orari) ----------
const copyBtn = $("#copy-addr");
if (copyBtn) copyBtn.addEventListener("click", async () => {
  try { await navigator.clipboard.writeText("Via Luigi Canonica 7, 6950 Tesserete"); copyBtn.textContent = "Copiato ✓"; copyBtn.classList.add("copy-ok"); }
  catch { copyBtn.textContent = "Via Luigi Canonica 7"; }
  setTimeout(() => { copyBtn.textContent = "Copia indirizzo"; copyBtn.classList.remove("copy-ok"); }, 2000);
});

// ---------- Aperto/chiuso in tempo reale (ora di Zurigo) ----------
const DAY_NAMES = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const pad = n => String(n).padStart(2, "0");
const fmtLeft = h => { const m = Math.round(h * 60); return m >= 60 ? `${Math.floor(m / 60)} h ${pad(m % 60)} min` : `${m} min`; };
const setText = (sel, t) => { const el = $(sel); if (el) el.textContent = t; };
function updateStatus() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const get = t => parts.find(p => p.type === t).value;
  const day = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(get("weekday")), h = +get("hour") + +get("minute") / 60;
  const today = HOURS[day];
  $$("#hours li").forEach(li => li.classList.toggle("today", +li.dataset.day === day));
  let open = false, short, title, sub, pct = 0;
  if (today && h >= today[0] && h < today[1]) {
    open = true; title = "Aperto ora";
    short = `Aperto ora · chiude alle ${today[1]}:00`;
    sub = `Chiude tra ${fmtLeft(today[1] - h)}`;
    pct = (h - today[0]) / (today[1] - today[0]) * 100;
  } else if (today && h < today[0]) {
    title = "Chiuso";
    short = `Chiuso · apre oggi alle ${pad(today[0])}:00`;
    sub = `Apre tra ${fmtLeft(today[0] - h)}`;
  } else {
    for (let i = 1; i <= 7; i++) {
      const d = (day + i) % 7;
      if (HOURS[d]) {
        const when = i === 1 ? "domani" : DAY_NAMES[d];
        title = "Chiuso";
        short = `Chiuso · riapre ${when} alle ${pad(HOURS[d][0])}:00`;
        sub = `Riapre ${when} alle ${pad(HOURS[d][0])}:00`;
        pct = today ? 100 : 0;
        break;
      }
    }
  }
  ["#status-dot", "#live-dot"].forEach(s => { const el = $(s); if (el) el.className = "dot " + (open ? "open" : "closed"); });
  setText("#status-text", short); setText("#live-title", title); setText("#live-sub", sub);
  const bar = $("#daybar"); if (bar) bar.style.width = pct + "%";
}
updateStatus();
setInterval(updateStatus, 30000);

// ---------- Modulo "Proponi una collaborazione" (pagina Collaborazioni) ----------
// Non c'è un server: il modulo prepara il messaggio, lo copia negli appunti
// e apre la chat Instagram di @_coro.nel, dove basta incollarlo e inviarlo.
const collabForm = $("#collab-form");
if (collabForm) {
  const IG_DM = "https://ig.me/m/_coro.nel";
  const msg = $("#collab-msg");
  const copySync = text => {
    // copia immediata (dentro il clic), così funziona anche prima di aprire la nuova scheda
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) {}
    ta.remove();
    return ok;
  };
  collabForm.addEventListener("submit", e => {
    e.preventDefault();
    const data = new FormData(collabForm);
    const nome = (data.get("nome") || "").trim(), idea = (data.get("idea") || "").trim();
    const contatto = (data.get("contatto") || "").trim(), tipo = data.get("tipo");
    collabForm.querySelectorAll(".field").forEach(f => f.classList.remove("invalid"));
    if (!nome || !idea) {
      if (!nome) collabForm.elements.nome.closest(".field").classList.add("invalid");
      if (!idea) collabForm.elements.idea.closest(".field").classList.add("invalid");
      msg.className = "form-msg err";
      msg.textContent = "Scrivi il tuo nome/brand e la tua idea.";
      return;
    }
    const text = [
      "Ciao Coronel! Vorrei proporre una collaborazione.",
      `Nome / brand: ${nome}`,
      `Tipo: ${tipo}`,
      `Idea: ${idea}`,
      contatto ? `Contatto: ${contatto}` : "",
    ].filter(Boolean).join("\n");
    let copied = copySync(text);
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => {}, () => {});
    window.open(IG_DM, "_blank", "noopener");
    msg.className = "form-msg ok";
    msg.textContent = copied
      ? "Messaggio copiato! Si è aperta la chat Instagram di @_coro.nel: incollalo e invia."
      : "Si è aperta la chat Instagram di @_coro.nel: scrivi lì la tua proposta.";
  });
}
