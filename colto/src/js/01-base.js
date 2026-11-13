// Dati, utilità e memoria locale.
const DATI = JSON.parse(document.getElementById('dati').textContent);
const CATEGORIE = DATI.categorie;
const CAT = Object.fromEntries(CATEGORIE.map((c) => [c.id, c]));
const VIDEO = DATI.video;
const PER_ID = new Map(VIDEO.map((v) => [v.id, v]));

const $ = (sel, radice = document) => radice.querySelector(sel);
const $$ = (sel, radice = document) => [...radice.querySelectorAll(sel)];

function crea(tag, classe, html) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (html != null) e.innerHTML = html;
  return e;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Numero da stringa (FNV-1a) e generatore casuale ripetibile (mulberry32).
function seme(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function casuale(s) {
  let a = s >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function mescola(lista, rnd) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Numeri: spazio sottile per le migliaia, virgola per i decimali.
function formatta(n, decimali = 0) {
  const [int, dec] = Math.abs(n).toFixed(decimali).split('.');
  const gruppi = int.length > 4 ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : int;
  return (n < 0 ? '−' : '') + gruppi + (dec ? ',' + dec : '');
}
function compatta(v) {
  if (v >= 1e9) return formatta(v / 1e9, v % 1e9 ? 1 : 0) + ' mld';
  if (v >= 1e6) return formatta(v / 1e6, v % 1e6 ? 1 : 0) + ' mln';
  if (Number.isInteger(v)) return formatta(v);
  return formatta(v, v < 10 ? 2 : 1).replace(/,?0+$/, '');
}

const tipografia = (s) => String(s).replace(/'/g, '’').replace(/\.\.\./g, '…');
const senzaSegni = (s) => String(s || '').replace(/==/g, '');
const lunghezza = (s) => senzaSegni(s).length;

// «testo con ==parole evidenziate==» → HTML
function segmenti(testo) {
  return tipografia(testo).split('==').map((t, i) => ({ t, m: i % 2 === 1 })).filter((p) => p.t);
}
function htmlTesto(testo) {
  return segmenti(testo).map((p) => (p.m ? `<mark>${esc(p.t)}</mark>` : esc(p.t))).join('');
}
function htmlParole(testo, passo = 70, inizio = 0) {
  let k = 0;
  return segmenti(testo).map((p) => {
    const parole = p.t.split(/(\s+)/).map((w) => (!w || /^\s+$/.test(w) ? w : `<span class="p" style="--d:${inizio + k++ * passo}ms">${esc(w)}</span>`)).join('');
    return p.m ? `<mark style="--d:${inizio + k * passo + 150}ms">${parole}</mark>` : parole;
  }).join('');
}

const oggi = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Memoria nel browser: se non è disponibile l'app funziona lo stesso, senza ricordare.
const CHIAVE = 'colto:v1';
const memoria = { piaciuti: {}, salvati: {}, visti: {}, giorni: [], voce: false, guida: 0 };
try {
  const grezzo = localStorage.getItem(CHIAVE);
  if (grezzo) Object.assign(memoria, JSON.parse(grezzo));
} catch (e) { /* memoria non disponibile */ }
function ricorda() {
  try { localStorage.setItem(CHIAVE, JSON.stringify(memoria)); } catch (e) { /* idem */ }
}

function segnaVisto(id) {
  if (!memoria.visti[id]) memoria.visti[id] = Date.now();
  const g = oggi();
  if (!memoria.giorni.includes(g)) memoria.giorni = [...memoria.giorni.slice(-400), g];
  ricorda();
}
function giorniDiFila() {
  const set = new Set(memoria.giorni);
  const d = new Date();
  const chiave = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  if (!set.has(chiave(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(chiave(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function vistiOggi() {
  const inizio = new Date(); inizio.setHours(0, 0, 0, 0);
  return Object.values(memoria.visti).filter((t) => t >= inizio.getTime()).length;
}

const ICONE = {
  cuore: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
  segnalibro: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z"/></svg>',
  condividi: '<svg viewBox="0 0 24 24" aria-hidden="true" class="tratto"><path d="M12 15V4m0 0L8 8m4-4l4 4M5 12v7h14v-7"/></svg>',
  voce: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h3l5 4V6L7 10H4z"/><path class="tratto" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
  muto: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h3l5 4V6L7 10H4z"/><path class="tratto" d="M16 9.5l5 5m0-5l-5 5"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  cerca: '<svg viewBox="0 0 24 24" aria-hidden="true" class="tratto"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  chiudi: '<svg viewBox="0 0 24 24" aria-hidden="true" class="tratto"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  giu: '<svg viewBox="0 0 24 24" aria-hidden="true" class="tratto"><path d="M6 9l6 6 6-6"/></svg>',
  su: '<svg viewBox="0 0 24 24" aria-hidden="true" class="tratto"><path d="M6 15l6-6 6 6"/></svg>',
  spunta: '<svg viewBox="0 0 24 24" aria-hidden="true" class="tratto"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};
