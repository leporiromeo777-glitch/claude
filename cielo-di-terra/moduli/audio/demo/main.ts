/**
 * Pagina demo del modulo audio: cursori per il mondo, mixer, un tasto per ogni suono
 * e una lettura dei parametri che il motore ricava dallo stato.
 */
import {
  AudioEngine,
  NOMI_BUS,
  costanti,
  descrizioneZona,
  posizioneCilindrica,
  zonaDaTheta,
  type EventoAudio,
  type NomeBus,
  type StatoAudio,
  type Superficie,
  type Vec3,
} from '../src/index';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`manca #${id}`);
  return el as T;
};
const cursore = (id: string): HTMLInputElement => $<HTMLInputElement>(id);
const valore = (id: string): number => Number(cursore(id).value);
const spunta = (id: string): boolean => cursore(id).checked;

const SAN_VIGILIO = costanti.CAMPANILE_SAN_VIGILIO;
const motore = new AudioEngine();

// ---------------------------------------------------------------------------
// Geometria
// ---------------------------------------------------------------------------

/** Il mondo della demo è piatto: l'altezza dal suolo coincide con h dal fondo dello scafo. */
function posizioneDa(thetaGradi: number, z: number, altezza: number): Vec3 {
  return posizioneCilindrica(thetaGradi, z, altezza);
}

/** Direzione dello sguardo nella terna locale del motore (est = verso della rotazione, nord = +z). */
function sguardo(thetaGradi: number): Vec3 {
  const a = (thetaGradi * Math.PI) / 180;
  switch ((document.getElementById('sguardo') as HTMLSelectElement).value) {
    case 'sud':
      return { x: 0, y: 0, z: -1 };
    case 'est':
      return { x: -Math.cos(a), y: Math.sin(a), z: 0 };
    case 'ovest':
      return { x: Math.cos(a), y: -Math.sin(a), z: 0 };
    default:
      return { x: 0, y: 0, z: 1 };
  }
}

function statoCorrente(): StatoAudio {
  const theta = valore('theta');
  const z = valore('z');
  const altezza = valore('altezza');
  const s: StatoAudio = {
    posizione: posizioneDa(theta, z, altezza),
    altezza,
    avanti: sguardo(theta),
    velocita: valore('velocita'),
    ora: valore('ora'),
    inVolo: spunta('volo'),
    fadeVicine: valore('fade'),
  };
  if (!spunta('lagoAuto')) s.distanzaLago = valore('lago');
  return s;
}

// ---------------------------------------------------------------------------
// Uscite dei cursori
// ---------------------------------------------------------------------------

function oraTesto(h: number): string {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h - Math.floor(h)) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function aggiornaUscite(): void {
  $('oraV').textContent = oraTesto(valore('ora'));
  $('altezzaV').textContent = `${valore('altezza').toFixed(0)} m`;
  $('velocitaV').textContent = `${valore('velocita').toFixed(1)} m/s`;
  $('thetaV').textContent = `${valore('theta').toFixed(1)}°`;
  $('zV').textContent = `${valore('z').toFixed(0)} m`;
  $('lagoV').textContent = spunta('lagoAuto') ? 'stimata' : `${valore('lago').toFixed(0)} m`;
  $('fadeV').textContent = valore('fade').toFixed(2);
  const zona = descrizioneZona(zonaDaTheta(valore('theta')));
  $('zonaNome').textContent = zona.nome;
  cursore('lago').disabled = spunta('lagoAuto');
}

for (const id of ['ora', 'altezza', 'velocita', 'theta', 'z', 'lago', 'fade', 'lagoAuto']) {
  cursore(id).addEventListener('input', aggiornaUscite);
}

// ---------------------------------------------------------------------------
// Luoghi pronti
// ---------------------------------------------------------------------------

interface Luogo {
  nome: string;
  valori: Record<string, number>;
  volo?: boolean;
  lagoAuto?: boolean;
}

const LUOGHI: Luogo[] = [
  { nome: 'Corbella a mezzogiorno', valori: { ora: 12, altezza: 1.7, velocita: 1.4, theta: 36.4, z: 1032, fade: 0 } },
  { nome: 'Alba nelle Selve', valori: { ora: 5.3, altezza: 1.7, velocita: 0, theta: 60, z: 1300, fade: 0 } },
  { nome: 'Notte delle Fade', valori: { ora: 23, altezza: 1.7, velocita: 0, theta: 40, z: 1100, fade: 1 } },
  { nome: 'Sulla Finestra dei Ponti', valori: { ora: 15, altezza: 1.7, velocita: 1, theta: 105, z: 1500, fade: 0 } },
  { nome: 'Riva del Verbanetto', valori: { ora: 16, altezza: 1.7, velocita: 0, theta: 160, z: 1400, fade: 0, lago: 3 }, lagoAuto: false },
  { nome: 'Ai piedi del Sordo', valori: { ora: 11, altezza: 1.7, velocita: 0, theta: 280, z: 2950, fade: 0 } },
  { nome: 'Planata alta', valori: { ora: 14, altezza: 260, velocita: 22, theta: 70, z: 900, fade: 0 }, volo: true },
  { nome: 'Brace sulla Valle 3', valori: { ora: 1.5, altezza: 1.7, velocita: 0, theta: 260, z: 1800, fade: 0.2 } },
];

for (const l of LUOGHI) {
  const b = document.createElement('button');
  b.className = 'chip';
  b.textContent = l.nome;
  b.addEventListener('click', () => {
    for (const [k, v] of Object.entries(l.valori)) cursore(k).value = String(v);
    cursore('volo').checked = l.volo === true;
    cursore('lagoAuto').checked = l.lagoAuto !== false;
    if (l.volo) motore.evento({ tipo: 'velo-apri' });
    aggiornaUscite();
  });
  $('luoghi').appendChild(b);
}

cursore('volo').addEventListener('change', () => motore.evento({ tipo: spunta('volo') ? 'velo-apri' : 'velo-chiudi' }));
cursore('campanile').addEventListener('change', () =>
  motore.impostaCampanile(posizioneDa(SAN_VIGILIO.theta, SAN_VIGILIO.z, SAN_VIGILIO.altezza), spunta('campanile')),
);

// ---------------------------------------------------------------------------
// Mixer
// ---------------------------------------------------------------------------

const NOMI_MIXER: Record<NomeBus, string> = {
  generale: 'Generale',
  ambiente: 'Ambiente',
  effetti: 'Effetti',
  voci: 'Voci',
  musica: 'Musica',
};

for (const bus of NOMI_BUS) {
  const riga = document.createElement('div');
  riga.className = 'cursore';
  const id = `bus-${bus}`;
  riga.innerHTML = `<label for="${id}">${NOMI_MIXER[bus]}</label><input id="${id}" type="range" min="0" max="1" step="0.01" /><output></output>`;
  const input = riga.querySelector('input') as HTMLInputElement;
  const out = riga.querySelector('output') as HTMLOutputElement;
  input.value = String(motore.volume(bus));
  const mostra = (): void => {
    const v = Number(input.value);
    out.textContent = v <= 0 ? '−∞ dB' : `${(20 * Math.log10(v * v)).toFixed(1)} dB`;
  };
  input.addEventListener('input', () => {
    motore.impostaVolume(bus, Number(input.value));
    mostra();
  });
  mostra();
  $('mixer').appendChild(riga);
}

cursore('muto').addEventListener('change', () => motore.impostaMuto(spunta('muto')));
$('pausa').addEventListener('click', () => {
  if (motore.stato === 'in-pausa') void motore.riprendi();
  else motore.pausa();
});

// ---------------------------------------------------------------------------
// Tasti dei suoni
// ---------------------------------------------------------------------------

interface Tasto {
  testo: string;
  evento: () => EventoAudio | null;
  colore?: string;
}

const superficie = (): Superficie => ($('superficie') as HTMLSelectElement).value as Superficie;

const GRUPPI: { titolo: string; colore: string; tasti: Tasto[] }[] = [
  {
    titolo: 'Passi',
    colore: 'var(--salvia)',
    tasti: (['erba', 'pietra', 'legno', 'ghiaia'] as const).map((s) => ({
      testo: s,
      evento: () => ({ tipo: 'passo', superficie: s, forza: 0.75 }),
    })),
  },
  {
    titolo: 'Corpo',
    colore: 'var(--gneiss)',
    tasti: [
      { testo: 'salto', evento: () => ({ tipo: 'salto', superficie: superficie() }) },
      { testo: 'atterraggio leggero', evento: () => ({ tipo: 'atterraggio', superficie: superficie(), velocita: 4 }) },
      { testo: 'atterraggio pesante', evento: () => ({ tipo: 'atterraggio', superficie: superficie(), velocita: 13 }) },
    ],
  },
  {
    titolo: 'Il Velo',
    colore: 'var(--giada)',
    tasti: [
      { testo: 'apri', evento: () => ({ tipo: 'velo-apri' }) },
      { testo: 'chiudi', evento: () => ({ tipo: 'velo-chiudi' }) },
    ],
  },
  {
    titolo: 'Il rilievo',
    colore: 'var(--ocra)',
    tasti: [
      { testo: 'squadro sul caposaldo', evento: () => ({ tipo: 'squadro-pianta' }) },
      { testo: 'bolla livellata', evento: () => ({ tipo: 'bolla-livellata' }) },
      { testo: 'inchiostro che si spande', evento: () => ({ tipo: 'inchiostro', ampiezza: 0.8 }) },
      { testo: 'pagina avanti', evento: () => ({ tipo: 'pagina', verso: 'avanti' }) },
      { testo: 'pagina indietro', evento: () => ({ tipo: 'pagina', verso: 'indietro' }) },
    ],
  },
  {
    titolo: 'La notte e le api',
    colore: 'var(--rame)',
    tasti: [
      { testo: 'Fade · carillon', evento: () => ({ tipo: 'fade', varieta: 'carillon', posizione: vicino(8) }) },
      { testo: 'Fade · ronzio', evento: () => ({ tipo: 'fade', varieta: 'ronzio', posizione: vicino(6) }) },
      { testo: 'Fade · pietra posata', evento: () => ({ tipo: 'fade', varieta: 'pietra', posizione: vicino(5) }) },
      { testo: 'api di rame', evento: () => ({ tipo: 'api', durata: 4 }) },
    ],
  },
  {
    titolo: 'San Vigilio',
    colore: 'var(--vermiglio)',
    tasti: [
      { testo: 'batte le ore', evento: () => ({ tipo: 'campane', modo: 'ore', ore: Math.floor(valore('ora')) % 12 || 12 }) },
      { testo: 'un rintocco', evento: () => ({ tipo: 'campane', modo: 'rintocco' }) },
      { testo: 'a festa', evento: () => ({ tipo: 'campane', modo: 'festa' }) },
    ],
  },
  {
    titolo: 'La Linea',
    colore: 'var(--ocra)',
    tasti: [{ testo: 'accensione (miccia)', evento: () => ({ tipo: 'accensione-linea' }) }],
  },
  {
    titolo: 'Interfaccia',
    colore: 'var(--matita)',
    tasti: (['clic', 'sopra', 'conferma', 'annulla', 'apri', 'chiudi'] as const).map((v) => ({
      testo: v,
      evento: () => ({ tipo: 'interfaccia', varieta: v }),
    })),
  },
  {
    titolo: 'Musica',
    colore: 'var(--castagna)',
    tasti: [
      { testo: 'alba', evento: () => ({ tipo: 'tema', tema: 'alba' }) },
      { testo: 'primo volo', evento: () => ({ tipo: 'tema', tema: 'primo-volo' }) },
      { testo: 'primo rilievo', evento: () => ({ tipo: 'tema', tema: 'primo-rilievo' }) },
      { testo: 'notte delle Fade', evento: () => ({ tipo: 'tema', tema: 'notte-fade' }) },
      {
        testo: 'ferma la musica',
        evento: () => {
          motore.fermaMusica();
          return null;
        },
      },
    ],
  },
];

/** Un punto a qualche metro, davanti e un po' di lato, per i suoni posizionati. */
function vicino(d: number): Vec3 {
  const lato = Math.random() < 0.5 ? -1 : 1;
  return posizioneDa(valore('theta') + (lato * d * 0.6 * 180) / (Math.PI * costanti.RAGGIO_INTERNO), valore('z') + d, 0.3);
}

for (const g of GRUPPI) {
  const gruppo = document.createElement('div');
  gruppo.className = 'gruppo';
  gruppo.innerHTML = `<h3>${g.titolo}</h3><div class="tasti"></div>`;
  const tasti = gruppo.querySelector('.tasti') as HTMLDivElement;
  for (const t of g.tasti) {
    const b = document.createElement('button');
    b.className = 'tasto';
    b.style.setProperty('--colore', t.colore ?? g.colore);
    b.textContent = t.testo;
    b.addEventListener('click', async () => {
      if (motore.stato === 'spento') await avvia();
      const e = t.evento();
      if (!e) return;
      if (e.tipo === 'tema') {
        const ok = motore.suonaTema(e.tema, { forza: true });
        b.classList.toggle('vivo', ok);
        setTimeout(() => b.classList.remove('vivo'), 1500);
        return;
      }
      const durata = motore.evento(e);
      b.classList.add('vivo');
      setTimeout(() => b.classList.remove('vivo'), Math.max(200, durata * 1000));
    });
    if (t.testo === 'sopra') b.addEventListener('pointerenter', () => motore.evento({ tipo: 'interfaccia', varieta: 'sopra' }));
    tasti.appendChild(b);
  }
  $('effetti').appendChild(gruppo);
}

// ---------------------------------------------------------------------------
// Lettura dei parametri
// ---------------------------------------------------------------------------

const VOCI_LETTURA: [string, string, (p: NonNullable<typeof motore.parametri>) => number | string, boolean][] = [
  ['zona', 'Zona', (p) => descrizioneZona(p.zona).nome, false],
  ['luce', 'Luce della Linea', (p) => p.linea.luce, true],
  ['vento', 'Vento', (p) => p.vento.intensita / 1.25, true],
  ['volo', 'Fruscio del Velo', (p) => p.volo.guadagno / 0.25, true],
  ['uccelli', 'Uccelli', (p) => p.fauna.uccelli, true],
  ['grilli', 'Grilli', (p) => p.fauna.grilli, true],
  ['finestra', 'Sopra una Finestra', (p) => p.pesoFinestra, true],
  ['lago', 'Acqua del lago', (p) => p.pesoLago, true],
  ['sordo', 'Rombo del Sordo', (p) => p.pesoSordo, true],
  ['notte', 'Notte', (p) => p.notte, true],
  ['ronzio', 'Ronzio (Hz)', (p) => p.linea.frequenza.toFixed(1), false],
  ['tema', 'Tema in corso', () => motore.temaInCorso ?? '—', false],
];

const celle = new Map<string, { dd: HTMLElement; barra: HTMLElement | null }>();
for (const [id, nome, , barra] of VOCI_LETTURA) {
  const d = document.createElement('div');
  d.innerHTML = `<dt>${nome}</dt><dd>—</dd>${barra ? '<div class="barra"><i></i></div>' : ''}`;
  $('lettura').appendChild(d);
  celle.set(id, { dd: d.querySelector('dd') as HTMLElement, barra: d.querySelector('.barra > i') });
}

function aggiornaLettura(): void {
  const p = motore.parametri;
  if (!p) return;
  for (const [id, , f] of VOCI_LETTURA) {
    const c = celle.get(id);
    if (!c) continue;
    const v = f(p);
    if (typeof v === 'number') {
      c.dd.textContent = v.toFixed(2);
      if (c.barra) c.barra.style.width = `${Math.max(0, Math.min(1, v)) * 100}%`;
    } else c.dd.textContent = v;
  }
}

// ---------------------------------------------------------------------------
// Misuratore
// ---------------------------------------------------------------------------

const tela = $<HTMLCanvasElement>('spettro');
const g2 = tela.getContext('2d') as CanvasRenderingContext2D;
let datiFreq: Float32Array<ArrayBuffer> | null = null;
let datiTempo: Float32Array<ArrayBuffer> | null = null;
let piccoTenuto = 0;

function coloreVar(nome: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim() || '#888';
}

function disegnaMisuratore(): void {
  const an = motore.analizzatoreUscita;
  const w = tela.width;
  const h = tela.height;
  g2.clearRect(0, 0, w, h);
  if (!an) return;
  if (!datiFreq || datiFreq.length !== an.frequencyBinCount) datiFreq = new Float32Array(an.frequencyBinCount);
  if (!datiTempo || datiTempo.length !== an.fftSize) datiTempo = new Float32Array(an.fftSize);
  an.getFloatFrequencyData(datiFreq);
  an.getFloatTimeDomainData(datiTempo);
  const sr = an.context.sampleRate;
  const barre = 72;
  const fMin = 30;
  const fMax = 16000;
  const larg = w / barre;
  const grad = g2.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0, coloreVar('--giada'));
  grad.addColorStop(0.6, coloreVar('--ocra'));
  grad.addColorStop(1, coloreVar('--vermiglio'));
  g2.fillStyle = grad;
  for (let i = 0; i < barre; i++) {
    const f0 = fMin * Math.pow(fMax / fMin, i / barre);
    const f1 = fMin * Math.pow(fMax / fMin, (i + 1) / barre);
    const b0 = Math.floor((f0 / (sr / 2)) * datiFreq.length);
    const b1 = Math.max(b0 + 1, Math.floor((f1 / (sr / 2)) * datiFreq.length));
    let m = -Infinity;
    for (let b = b0; b < b1 && b < datiFreq.length; b++) m = Math.max(m, datiFreq[b] as number);
    const v = Math.max(0, Math.min(1, (m + 100) / 75));
    const bh = v * (h - 6);
    g2.globalAlpha = 0.85;
    g2.fillRect(i * larg + 1, h - bh, larg - 2, bh);
  }
  g2.globalAlpha = 1;
  let p = 0;
  for (const x of datiTempo) p = Math.max(p, Math.abs(x));
  piccoTenuto = Math.max(p, piccoTenuto * 0.96);
  const db = piccoTenuto > 0 ? 20 * Math.log10(piccoTenuto) : -Infinity;
  $('piccoV').textContent = Number.isFinite(db) ? `picco ${db.toFixed(1)} dBFS` : '— dB';
  $('livello').style.width = `${Math.max(0, Math.min(1, (db + 60) / 60)) * 100}%`;
}

// ---------------------------------------------------------------------------
// Avvio e ciclo
// ---------------------------------------------------------------------------

function mostraStato(): void {
  $('led').className = `led ${motore.stato}`;
  const testi: Record<string, string> = { spento: 'spento', attivo: 'attivo', 'in-pausa': 'in pausa', distrutto: 'chiuso' };
  $('testoStato').textContent = testi[motore.stato] ?? motore.stato;
  $('pausa').textContent = motore.stato === 'in-pausa' ? 'Riprendi' : 'Pausa';
  ($('avvia') as HTMLButtonElement).disabled = motore.stato !== 'spento';
  ($('avvia') as HTMLButtonElement).textContent = motore.stato === 'spento' ? 'Avvia l’audio' : 'Audio avviato';
}

async function avvia(): Promise<void> {
  await motore.avvia();
  motore.precarica();
  mostraStato();
}

$('avvia').addEventListener('click', () => void avvia());

let ultimo = performance.now();
let distanzaPassi = 0;
let lettura = 0;

function ciclo(ora: number): void {
  const dt = Math.min(0.1, (ora - ultimo) / 1000);
  ultimo = ora;
  if (spunta('scorre')) {
    const ritmo = Number(($('ritmo') as HTMLSelectElement).value);
    const nuova = (valore('ora') + (dt * ritmo) / costanti.SECONDI_REALI_PER_ORA) % 24;
    cursore('ora').value = String(nuova);
    $('oraV').textContent = oraTesto(nuova);
  }
  if (motore.stato === 'attivo') {
    motore.aggiorna(statoCorrente(), dt);
    // passi automatici: uno ogni 0,75 m a passo, 1,1 m di corsa
    const v = valore('velocita');
    if (spunta('autopassi') && !spunta('volo') && valore('altezza') < 3 && v > 0.2) {
      const corsa = v > 4;
      distanzaPassi += v * dt;
      const lunghezzaPasso = corsa ? 1.1 : 0.75;
      if (distanzaPassi >= lunghezzaPasso) {
        distanzaPassi = 0;
        motore.evento({ tipo: 'passo', superficie: superficie(), forza: corsa ? 1 : 0.6 });
      }
    }
  }
  lettura += dt;
  if (lettura > 0.1) {
    lettura = 0;
    aggiornaLettura();
    mostraStato();
  }
  disegnaMisuratore();
  requestAnimationFrame(ciclo);
}

aggiornaUscite();
mostraStato();
requestAnimationFrame(ciclo);
