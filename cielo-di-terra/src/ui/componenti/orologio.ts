import { Componente } from '../core/componente';
import { h, s } from '../core/dom';
import './orologio.css';

/** Che cosa mostra l'orologio: l'ora della storia (la fonte unica è `OrologioStoria` della regia). */
export interface DatiOrologio {
  /** Giorno di gioco (dal 1). */
  giorno: number;
  /** Ora del giorno, decimale (0-24). */
  ore: number;
  /** Durante «Aspetta fino a»: l'ora del giorno a cui si arriva (le cifre corrono); null fuori dall'attesa. */
  verso?: number | null;
}

export interface OpzioniOrologio {
  /** L'impostazione «Orologio a schermo» (predefinita: acceso). */
  attivo?: () => boolean;
}

/** Notte di gioco: 21:00-05:30 (GDD §2.3; come `eNotte` della regia). */
const INIZIO_NOTTE = 21;
const FINE_NOTTE = 5.5;

/** «HH:MM» da ore decimali (i minuti troncati: le cifre girano come su un orologio vero). */
export function testoOrologio(ore: number): string {
  const m = Math.floor((((ore % 24) + 24) % 24) * 60 + 1e-6) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function eNotteOrologio(ore: number): boolean {
  const o = ((ore % 24) + 24) % 24;
  return o >= INIZIO_NOTTE || o < FINE_NOTTE;
}

/**
 * Dove sta l'astro sull'arco del quadrante (0 = all'orizzonte a sinistra, 1 = a destra): il sole
 * dalle 05:30 alle 21:00, la luna dalle 21:00 alle 05:30.
 */
export function arcoAstro(ore: number): number {
  const o = ((ore % 24) + 24) % 24;
  if (!eNotteOrologio(o)) return (o - FINE_NOTTE) / (INIZIO_NOTTE - FINE_NOTTE);
  return (((o - INIZIO_NOTTE + 24) % 24) / (24 - INIZIO_NOTTE + FINE_NOTTE));
}

/** Il cielo del quadrante (alto, orizzonte) lungo il giorno: acquerelli spenti, la notte blu inchiostro. */
const CIELI: readonly [number, string, string][] = [
  [0, '#141a33', '#232b4c'],
  [5.0, '#1a2140', '#2c3456'],
  [5.6, '#4c5d8e', '#d39478'],
  [6.6, '#84a4c4', '#efc79c'],
  [8.0, '#8bb2cf', '#e2eae2'],
  [17.6, '#8bb2cf', '#e2eae2'],
  [19.4, '#7a85ad', '#eeb07a'],
  [20.5, '#414a76', '#b8776a'],
  [21.2, '#1a2140', '#2c3456'],
  [24, '#141a33', '#232b4c'],
];

function mescola(a: string, b: string, k: number): string {
  const n = (x: string, i: number): number => parseInt(x.slice(1 + i * 2, 3 + i * 2), 16);
  const c = [0, 1, 2].map((i) => Math.round(n(a, i) + (n(b, i) - n(a, i)) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** I due colori del cielo del quadrante all'ora `ore`. */
export function cieloQuadrante(ore: number): [string, string] {
  const o = ((ore % 24) + 24) % 24;
  for (let i = 1; i < CIELI.length; i++) {
    const [h1, a1, b1] = CIELI[i]!;
    if (o > h1) continue;
    const [h0, a0, b0] = CIELI[i - 1]!;
    const k = h1 > h0 ? (o - h0) / (h1 - h0) : 0;
    return [mescola(a0, a1, k), mescola(b0, b1, k)];
  }
  return [CIELI[0]![1], CIELI[0]![2]];
}

/** Raggio e centro dell'arco dell'astro nel quadrante (unità del viewBox). */
const ARCO_R = 15.5;
const ORIZZONTE = 5;

/**
 * L'orologio a schermo (richiesta dell'utente: «voglio vedere un orologio sullo schermo per sapere
 * che ore sono nel gioco»): in alto a destra un ritaglio di carta con un piccolo quadrante, il
 * sole o la luna sul loro arco sopra le colline, e sotto, a inchiostro, l'ora e il giorno.
 *
 * - di notte il quadrante si fa blu inchiostro, con la luna e le stelle, e la carta più fredda;
 * - durante «Aspetta fino a» le cifre corrono, il sole scivola sull'arco e la seconda riga dice
 *   fino a che ora («fino alle 19:30»);
 * - si legge su ogni cielo (è su carta), non prende il mouse, sparisce sotto le carte, la Pianta,
 *   il Taccuino e la pausa (non sotto i dialoghi: è lontano dalla finestra, in basso);
 * - le notifiche scendono sotto di lui (orologio.css) e il segnalino delle indicazioni lo evita
 *   (`area()`);
 * - l'impostazione «Orologio a schermo» (Aiuti, accesa di serie) lo toglie.
 *
 * Scrive nel DOM solo quando cambia il minuto (o l'attesa): si può chiamare `aggiorna` a ogni
 * fotogramma.
 */
export class OrologioSchermo extends Componente {
  private readonly carta: HTMLDivElement;
  private readonly oraEl: HTMLSpanElement;
  private readonly sottoEl: HTMLSpanElement;
  private readonly sottoTesto: Text;
  private readonly sottoNumero: HTMLSpanElement;
  private readonly astro: SVGGElement;
  private readonly fondo: SVGLinearGradientElement;
  private ultimo = { minuto: -1, giorno: -1, verso: '' as string, notte: null as boolean | null };

  constructor(private readonly opz: OpzioniOrologio = {}) {
    super({ classe: 'ui-orologio', modale: false });
    this.el.setAttribute('aria-hidden', 'false');
    this.fondo = s(
      'linearGradient',
      { id: 'ui-or-cielo', x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: '0.05', class: 'ui-or-cielo-alto' }),
      s('stop', { offset: '0.62', class: 'ui-or-cielo-basso' }),
    );
    // il sole: un disco d'ottone con otto raggi a inchiostro; la luna: una falce di carta
    const raggi = s('g', { class: 'ui-or-raggi' });
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      raggi.append(s('line', { x1: (Math.cos(a) * 5.4).toFixed(2), y1: (Math.sin(a) * 5.4).toFixed(2), x2: (Math.cos(a) * 7.4).toFixed(2), y2: (Math.sin(a) * 7.4).toFixed(2) }));
    }
    this.astro = s(
      'g',
      { class: 'ui-or-astro' },
      s('g', { class: 'ui-or-sole' }, raggi, s('circle', { r: 3.9 })),
      s('path', { class: 'ui-or-luna', d: 'M 1.2 -4.4 A 4.6 4.6 0 1 0 1.2 4.4 A 3.5 3.5 0 1 1 1.2 -4.4 Z' }),
    );
    const stelle = s('g', { class: 'ui-or-stelle' });
    for (const [x, y, r] of [
      [-13, -12, 0.9],
      [-5, -17, 0.7],
      [6, -14, 1],
      [14, -8, 0.7],
      [-17, -3, 0.6],
      [11, -18, 0.6],
      [1, -6, 0.5],
    ] as const) {
      stelle.append(s('circle', { cx: x, cy: y, r }));
    }
    // i segni dell'arco: l'alba, il mezzogiorno (o la mezzanotte), il tramonto
    const segni = s('g', { class: 'ui-or-segni' });
    for (const k of [0.25, 0.5, 0.75]) {
      const a = Math.PI * (1 - k);
      segni.append(s('circle', { cx: (Math.cos(a) * ARCO_R).toFixed(2), cy: (ORIZZONTE - Math.sin(a) * ARCO_R).toFixed(2), r: 0.75 }));
    }
    const quadrante = s(
      'svg',
      { class: 'ui-or-quadrante', viewBox: '-26 -26 52 52', 'aria-hidden': 'true' },
      s('defs', {}, this.fondo, s('clipPath', { id: 'ui-or-disco' }, s('circle', { r: 21.6 }))),
      s(
        'g',
        { 'clip-path': 'url(#ui-or-disco)' },
        s('rect', { class: 'ui-or-cielo', x: -26, y: -26, width: 52, height: 52 }),
        stelle,
        s('path', { class: 'ui-or-arco', d: `M ${-ARCO_R} ${ORIZZONTE} A ${ARCO_R} ${ARCO_R} 0 0 1 ${ARCO_R} ${ORIZZONTE}` }),
        segni,
        this.astro,
        // le colline davanti all'astro: il sole sorge e tramonta dietro di loro
        s('path', { class: 'ui-or-colli-lontani', d: 'M -26 6.5 C -18 1.5, -12 3.5, -6 5.2 S 6 1.6, 12 4.2 S 22 3.4, 26 5.6 L 26 26 L -26 26 Z' }),
        s('path', { class: 'ui-or-colli', d: 'M -26 9.5 C -16 6.2, -8 9.8, 0 8.4 S 14 6, 26 9.8 L 26 26 L -26 26 Z' }),
      ),
      s('circle', { class: 'ui-or-ghiera', r: 22.4 }),
      s('circle', { class: 'ui-or-bordo', r: 21.6 }),
      s('circle', { class: 'ui-or-corsa', r: 24.4, pathLength: 1 }),
    );
    this.oraEl = h('span', { class: 'ui-or-ora' }, '--:--');
    // «giorno 1», «fino alle 19:30»: le parole in maiuscoletto inciso, le cifre in tondo (nell'IM
    // Fell l'1 è una «I» e lo 0 una «o»: «I0:20» non si legge come un orologio)
    this.sottoTesto = document.createTextNode('giorno ');
    this.sottoNumero = h('span', { class: 'ui-or-n' });
    this.sottoEl = h('span', { class: 'ui-or-sotto' }, this.sottoTesto, this.sottoNumero);
    this.carta = h('div', { class: 'ui-or-carta', role: 'group', 'aria-label': 'Ora di gioco' }, quadrante, h('div', { class: 'ui-or-testo' }, this.oraEl, this.sottoEl));
    this.el.append(this.carta);
  }

  /** Mostra il livello (in gioco); sparisce da sé se l'impostazione è spenta. */
  show(): void {
    this.apri();
    this.ridisegna();
  }

  /** Riapplica l'impostazione «Orologio a schermo». */
  ridisegna(): void {
    const attivo = this.opz.attivo?.() ?? true;
    this.el.classList.toggle('ui-orologio--spento', !attivo);
    this.radice?.classList.toggle('ui-con-orologio', attivo && this.visible);
  }

  /** L'orologio si vede adesso (aperto e con l'impostazione accesa)? */
  get attivo(): boolean {
    return this.visible && !this.el.classList.contains('ui-orologio--spento');
  }

  /** L'ora di adesso (si può chiamare a ogni fotogramma: il DOM cambia col minuto). */
  aggiorna(d: DatiOrologio): void {
    const ore = ((d.ore % 24) + 24) % 24;
    const minuto = Math.floor(ore * 60 + 1e-6) % 1440;
    const verso = d.verso === null || d.verso === undefined ? '' : testoOrologio(d.verso);
    const u = this.ultimo;
    if (minuto === u.minuto && d.giorno === u.giorno && verso === u.verso) return;
    if (minuto !== u.minuto) {
      this.oraEl.textContent = testoOrologio(ore);
      const k = arcoAstro(ore);
      const a = Math.PI * (1 - k);
      this.astro.setAttribute('transform', `translate(${(Math.cos(a) * ARCO_R).toFixed(2)} ${(ORIZZONTE - Math.sin(a) * ARCO_R).toFixed(2)})`);
      const [alto, basso] = cieloQuadrante(ore);
      this.carta.style.setProperty('--or-alto', alto);
      this.carta.style.setProperty('--or-basso', basso);
      const notte = eNotteOrologio(ore);
      if (notte !== u.notte) {
        this.el.classList.toggle('ui-orologio--notte', notte);
        u.notte = notte;
      }
    }
    if (d.giorno !== u.giorno || verso !== u.verso) {
      this.sottoTesto.data = verso ? 'fino alle ' : 'giorno ';
      this.sottoNumero.textContent = verso || String(d.giorno);
      this.el.classList.toggle('ui-orologio--corre', !!verso);
      this.carta.setAttribute('aria-label', `Giorno ${d.giorno}, ore ${testoOrologio(ore)}`);
    }
    u.minuto = minuto;
    u.giorno = d.giorno;
    u.verso = verso;
  }

  /** Dove sta l'orologio sullo schermo (px), se si vede: il segnalino delle indicazioni non ci passa sotto. */
  area(): { sinistra: number; destra: number; sotto: number } | null {
    if (!this.attivo) return null;
    const r = this.carta.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? { sinistra: r.left, destra: r.right, sotto: r.bottom } : null;
  }

  protected override quandoMostrato(): void {
    this.ridisegna();
  }

  protected override quandoNascosto(): void {
    this.radice?.classList.remove('ui-con-orologio');
  }
}
