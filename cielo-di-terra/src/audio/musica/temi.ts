/**
 * Temi musicali generativi: brevi, discreti, dal carattere alpino (salterio, fisarmonica,
 * flauto, carillon). Ogni tema è scritto come un piccolo insieme di regole e di frasi
 * possibili; un seme sceglie la variante, gli ornamenti e la piccola umanizzazione.
 * Il generatore è puro: restituisce una partitura di note, che il lettore poi suona.
 */
import type { TemaMusicale } from '../tipi';
import { creaRng, intero, limita, scegli, tra, type Rng } from '../util';

export type Strumento = 'salterio' | 'fisarmonica' | 'flauto' | 'carillon';

export interface NotaMusicale {
  /** Istante d'inizio, secondi dall'inizio del tema. */
  t: number;
  /** Durata in secondi. */
  durata: number;
  /** Nota MIDI (60 = Do4). */
  midi: number;
  /** Intensità 0-1. */
  vel: number;
  strumento: Strumento;
}

export interface Partitura {
  tema: TemaMusicale;
  bpm: number;
  /** Durata totale, code comprese (s). */
  durata: number;
  /** Tonica (MIDI) e modo, per i test. */
  tonica: number;
  modo: readonly number[];
  note: NotaMusicale[];
}

export const MODI = {
  ionico: [0, 2, 4, 5, 7, 9, 11],
  lidio: [0, 2, 4, 6, 7, 9, 11],
  dorico: [0, 2, 3, 5, 7, 9, 10],
} as const;

/** Nota MIDI del grado `g` (0 = tonica; può essere negativo o oltre l'ottava). */
export function grado(tonica: number, modo: readonly number[], g: number): number {
  const ott = Math.floor(g / 7);
  const i = ((g % 7) + 7) % 7;
  return tonica + 12 * ott + (modo[i] as number);
}

/** Estensioni comode degli strumenti (MIDI), usate anche dai test. */
export const ESTENSIONI: Readonly<Record<Strumento, readonly [number, number]>> = {
  salterio: [43, 91],
  fisarmonica: [36, 84],
  flauto: [60, 96],
  carillon: [72, 100],
};

/** Una frase: coppie [grado, durata in battiti]. */
type Frase = readonly (readonly [number, number])[];

/** Raccoglie le note con tempo in battiti e un po' di umanizzazione. */
class Scrittore {
  readonly note: NotaMusicale[] = [];
  readonly b: number;
  constructor(
    readonly rng: Rng,
    readonly bpm: number,
  ) {
    this.b = 60 / bpm;
  }
  nota(battito: number, battiti: number, midi: number, vel: number, strumento: Strumento): void {
    const umano = battito === 0 ? 0 : tra(this.rng, -0.012, 0.012);
    this.note.push({
      t: Math.max(0, battito * this.b + umano),
      durata: Math.max(0.05, battiti * this.b),
      midi: Math.round(midi),
      vel: limita(vel + tra(this.rng, -0.04, 0.04), 0.05, 1),
      strumento,
    });
  }
  /** Scrive una frase a partire da `battito`, con ornamenti di volta (vicini di grado) facoltativi. */
  frase(
    battito: number,
    frase: Frase,
    tonica: number,
    modo: readonly number[],
    vel: number,
    strumento: Strumento,
    pOrnamento: number,
    codaFinale = 1,
  ): number {
    let x = battito;
    frase.forEach(([g, d], i) => {
      const ultima = i === frase.length - 1;
      if (!ultima && d >= 1 && this.rng() < pOrnamento) {
        this.nota(x, d - 0.5, grado(tonica, modo, g), vel, strumento);
        const vicino = g + (this.rng() < 0.5 ? 1 : -1);
        this.nota(x + d - 0.5, 0.5, grado(tonica, modo, vicino), vel * 0.85, strumento);
      } else {
        this.nota(x, d + (ultima ? codaFinale : 0), grado(tonica, modo, g), ultima ? vel * 0.9 : vel, strumento);
      }
      x += d;
    });
    return x;
  }
}

// ---------------------------------------------------------------------------
// Alba: il salterio si accende come la Linea, poi entra il flauto
// ---------------------------------------------------------------------------

const FRASI_ALBA: readonly Frase[] = [
  [[4, 1.5], [5, 0.5], [7, 1], [5, 2], [4, 1], [2, 1], [4, 1], [5, 1], [4, 3]],
  [[2, 1], [4, 1], [5, 1], [7, 2], [5, 1], [4, 1], [2, 0.5], [1, 0.5], [2, 1], [0, 3]],
  [[7, 2], [8, 1], [7, 1], [5, 1], [4, 1], [5, 1.5], [4, 0.5], [2, 1], [4, 3]],
];

function alba(rng: Rng): Partitura {
  const s = new Scrittore(rng, 66);
  const tonica = 62; // Re4
  const modo = MODI.ionico;
  const prog = scegli(rng, [
    [0, 0, 3, 0, 5, 3, 4, 0],
    [0, 3, 0, 4, 5, 3, 0, 0],
    [0, 5, 3, 0, 3, 4, 0, 0],
  ]);
  const basso = tonica - 12;
  prog.forEach((r, bar) => {
    const schema = [r, r + 4, r + 7, r + 9, r + 11, r + 7];
    const presenti = bar === 0 ? [0, 4] : bar === 1 ? [0, 2, 3, 4] : [0, 1, 2, 3, 4, 5];
    for (const i of presenti) {
      if (i !== 0 && bar >= 2 && rng() < 0.15) continue; // discreto: qualche nota tace
      s.nota(bar * 3 + i * 0.5, 2, grado(basso, modo, schema[i] as number), i === 0 ? 0.5 : 0.4, 'salterio');
    }
  });
  s.frase(12, scegli(rng, FRASI_ALBA), tonica + 12, modo, 0.5, 'flauto', 0.2, 1);
  // accordo finale arpeggiato
  [0, 4, 7, 9, 11].forEach((g, i) => s.nota(24 + i * 0.05 / s.b, 4, grado(basso, modo, g), 0.42, 'salterio'));
  return { tema: 'alba', bpm: s.bpm, durata: 24 * s.b + 5, tonica, modo, note: s.note };
}

// ---------------------------------------------------------------------------
// Primo volo: Sol lidio, il quarto grado alzato è la meraviglia
// ---------------------------------------------------------------------------

const FRASI_VOLO: readonly Frase[] = [
  [[4, 1.5], [7, 1.5], [9, 3], [8, 1], [7, 0.5], [6, 1.5], [7, 3], [3, 1.5], [4, 1.5], [4, 3]],
  [[0, 1], [2, 0.5], [4, 1.5], [7, 1.5], [8, 1.5], [9, 2], [8, 1], [7, 1.5], [3, 1.5], [4, 1.5], [2, 1.5], [4, 3]],
  [[7, 3], [9, 1.5], [11, 1.5], [10, 1], [9, 0.5], [7, 1.5], [8, 1.5], [7, 1.5], [3, 1.5], [2, 1.5], [4, 3]],
];

function primoVolo(rng: Rng): Partitura {
  const s = new Scrittore(rng, 80);
  const tonica = 67; // Sol4
  const modo = MODI.lidio;
  const basso = tonica - 12;
  const prog = scegli(rng, [
    [0, 0, 1, 1, 0, 0, 1, 0],
    [0, 1, 0, 1, 5, 1, 0, 0],
  ]);
  prog.forEach((r, bar) => {
    // salterio che dondola sulla quinta vuota
    [r, r + 4, r + 7, r + 4, r + 7, r + 4].forEach((g, i) => {
      if (i !== 0 && rng() < 0.1) return;
      s.nota(bar * 3 + i * 0.5, 1.5, grado(basso, modo, g), i === 0 ? 0.36 : 0.28, 'salterio');
    });
    // fisarmonica: un velo d'accordo legato
    [r, r + 2, r + 4].forEach((g) => s.nota(bar * 3, 3, grado(basso, modo, g), 0.2, 'fisarmonica'));
  });
  s.frase(6, scegli(rng, FRASI_VOLO), tonica, modo, 0.52, 'flauto', 0.15, 1.5);
  [0, 4, 7, 9, 10, 14].forEach((g, i) => s.nota(24 + i * 0.5, 4 - i * 0.3, grado(basso, modo, g), 0.38, 'salterio'));
  return { tema: 'primo-volo', bpm: s.bpm, durata: 27 * s.b + 4, tonica, modo, note: s.note };
}

// ---------------------------------------------------------------------------
// Primo rilievo: un valzerino lento di fisarmonica e una pioggia di salterio
// ---------------------------------------------------------------------------

const FRASI_RILIEVO: readonly Frase[] = [
  [[2, 1], [4, 1], [7, 1], [6, 2], [4, 1], [3, 1], [4, 1], [5, 1], [4, 2], [1, 1], [2, 1], [4, 1], [1, 1], [0, 3]],
  [[4, 1.5], [5, 0.5], [4, 1], [2, 2], [4, 1], [3, 1], [1, 1], [3, 1], [4, 2], [2, 1], [1, 1], [3, 1], [6, 1], [7, 3]],
  [[0, 1], [2, 1], [4, 1], [7, 1.5], [6, 0.5], [4, 1], [5, 1], [4, 1], [3, 1], [2, 2], [4, 1], [1, 1], [6, 1], [4, 1], [7, 3]],
];

function primoRilievo(rng: Rng): Partitura {
  const s = new Scrittore(rng, 96);
  const tonica = 65; // Fa4
  const modo = MODI.ionico;
  const prog = scegli(rng, [
    [0, 0, 4, 4, 4, 0],
    [0, 3, 4, 0, 4, 0],
    [0, 5, 3, 4, 4, 0],
  ]);
  prog.forEach((r, bar) => {
    s.nota(bar * 3, 0.9, grado(tonica - 24, modo, r), 0.34, 'fisarmonica');
    const accordo = r === 4 ? [r + 2, r + 4, r + 6] : [r + 2, r + 4, r + 7];
    for (const beat of [1, 2]) {
      for (const g of accordo) s.nota(bar * 3 + beat, 0.55, grado(tonica - 12, modo, g), 0.18, 'fisarmonica');
    }
  });
  s.frase(0, scegli(rng, FRASI_RILIEVO), tonica, modo, 0.34, 'fisarmonica', 0.12, 0.5);
  // pioggia di salterio sull'ultima battuta
  [0, 2, 4, 7, 9, 11, 14].forEach((g, i) => s.nota(15 + i * 0.25, 3, grado(tonica, modo, g), 0.34 - i * 0.01, 'salterio'));
  return { tema: 'primo-rilievo', bpm: s.bpm, durata: 18 * s.b + 4, tonica, modo, note: s.note };
}

// ---------------------------------------------------------------------------
// Notte delle Fade: La dorico, carillon rado, bordone di fisarmonica, flauto grave
// ---------------------------------------------------------------------------

const FRASI_NOTTE: readonly Frase[] = [
  [[0, 3], [2, 1], [3, 2], [4, 2], [5, 3], [4, 1], [3, 4], [2, 2], [1, 2], [0, 4]],
  [[4, 4], [3, 2], [2, 1], [3, 1], [0, 4], [-1, 2], [0, 2], [2, 3], [3, 1], [0, 4]],
];

const NOTE_CARILLON_NOTTE = [81, 84, 86, 88, 91, 93] as const;

function notteFade(rng: Rng): Partitura {
  const s = new Scrittore(rng, 54);
  const tonica = 57; // La3
  const modo = MODI.dorico;
  // bordone: quinte vuote ogni due battute (La-Mi, poi Sol-Re, poi La-Mi)
  const bordoni: readonly (readonly [number, number])[] = [
    [0, 4],
    [0, 4],
    [-1, 3],
    [0, 4],
  ];
  bordoni.forEach((coppia, i) => {
    for (const g of coppia) s.nota(i * 8, 8, grado(tonica - 12, modo, g), 0.16, 'fisarmonica');
  });
  // carillon: poche note, una passeggiata sulla pentatonica minore
  let k = intero(rng, 0, NOTE_CARILLON_NOTTE.length - 1);
  for (let bar = 0; bar < 8; bar++) {
    const quante = bar >= 6 ? 1 : intero(rng, 2, 4);
    const posizioni = new Set<number>();
    while (posizioni.size < quante) posizioni.add(intero(rng, 0, 7));
    for (const p of [...posizioni].sort((a, b) => a - b)) {
      s.nota(bar * 4 + p * 0.5, 1.5, NOTE_CARILLON_NOTTE[k] as number, tra(rng, 0.3, 0.5), 'carillon');
      k = limita(k + intero(rng, -2, 2), 0, NOTE_CARILLON_NOTTE.length - 1);
    }
  }
  s.nota(31, 3, 81, 0.35, 'carillon');
  s.frase(8, scegli(rng, FRASI_NOTTE), tonica + 12, modo, 0.34, 'flauto', 0.1, 1);
  return { tema: 'notte-fade', bpm: s.bpm, durata: 32 * s.b + 5, tonica, modo, note: s.note };
}

/** Genera la partitura di un tema; lo stesso seme dà sempre la stessa partitura. */
export function generaTema(tema: TemaMusicale, seme: number): Partitura {
  const rng = creaRng(seme);
  let p: Partitura;
  switch (tema) {
    case 'alba':
      p = alba(rng);
      break;
    case 'primo-volo':
      p = primoVolo(rng);
      break;
    case 'primo-rilievo':
      p = primoRilievo(rng);
      break;
    case 'notte-fade':
      p = notteFade(rng);
      break;
  }
  p.note.sort((a, b) => a.t - b.t);
  return p;
}

/** Tutti i temi. */
export const TEMI: readonly TemaMusicale[] = ['alba', 'primo-volo', 'primo-rilievo', 'notte-fade'];
