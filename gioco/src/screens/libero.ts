/**
 * Merletto libero (GDD 8.4): semi, dimensioni, regola e gradi.
 *
 * Il seme è una stringa in base 36 (`[0-9a-z]`, ARCHITETTURA 14.6: lo spartito in
 * modo L porta il seme così com'è). La prima lettera dice la dimensione (p
 * piccolo, m medio, g grande), le altre sono libere: così uno spartito `L`
 * basta da solo a ricostruire il livello, senza altri parametri.
 *
 * - dimensione → colonne e righe: piccolo 4×6, medio 5×7 (come il Merletto del
 *   giorno da lunedì a giovedì), grande 6×8 (da venerdì a domenica);
 * - regola: scelta dal seme fra le sette del Merletto del giorno;
 * - gradi (GDD 8.4, uno per punto): tutti passano al generatore, anche Senza
 *   Disfa e Spilli velati che non cambiano il livello ma entrano nel suo id
 *   (`lib-<seme>~<gradi>`), così record e ripresa distinguono le combinazioni.
 *
 * Nessun accesso al DOM né ai servizi: si prova in Node.
 */
import type { GradoId, LevelDef, LevelId, RuleId } from '../core/types';
import type { GenSpec } from '../engine/index';
import { fnv1a32 } from '../engine/index';

export type Dimensione = 'piccolo' | 'medio' | 'grande';

export interface DimensioneDef {
  letter: 'p' | 'm' | 'g';
  columns: 4 | 5 | 6;
  rows: number;
}

export const DIMENSIONI: Readonly<Record<Dimensione, DimensioneDef>> = {
  piccolo: { letter: 'p', columns: 4, rows: 6 },
  medio: { letter: 'm', columns: 5, rows: 7 },
  grande: { letter: 'g', columns: 6, rows: 8 },
};

export const DIMENSIONI_ORDER: readonly Dimensione[] = ['piccolo', 'medio', 'grande'];

/** Regole possibili del Merletto libero (le stesse del Merletto del giorno). */
export const LIBERO_RULES: readonly RuleId[] = ['voce', 'segreto', 'molo', 'febbre', 'rancore', 'marea', 'nero'];

/** Ordine dei gradi nell'interfaccia (GDD 8.4). */
export const GRADI_ORDER: readonly GradoId[] = ['matassaEsatta', 'senzaDisfa', 'spilliVelati', 'nodoInPiu', 'neroInPiu', 'notteCorta'];

/** Gradi che cambiano il livello generato; gli altri sono regole d'interfaccia del tombolo. */
export const GRADI_LIVELLO: readonly GradoId[] = ['matassaEsatta', 'nodoInPiu', 'neroInPiu', 'notteCorta'];

/** Lunghezza massima del seme (lettera della dimensione compresa). */
export const SEED_MAX = 12;
export const SEED_RE = /^[pmg][0-9a-z]{1,11}$/;
const BODY_RE = /^[0-9a-z]{1,11}$/;
const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz';

export function isSeed(s: string): boolean {
  return SEED_RE.test(s);
}

export function dimensioneOf(seed: string): Dimensione | null {
  const c = seed[0];
  for (const d of DIMENSIONI_ORDER) if (DIMENSIONI[d].letter === c) return d;
  return null;
}

/**
 * Seme dal testo scritto dal giocatore. Spazi e trattini si tolgono, le
 * maiuscole diventano minuscole. Un testo che comincia già con la lettera di una
 * dimensione è un seme completo; altrimenti gli si mette davanti la lettera della
 * dimensione scelta. null se restano caratteri fuori dalla base 36.
 */
export function normalizeSeed(input: string, size: Dimensione): string | null {
  const t = input.toLowerCase().replace(/[\s_-]+/g, '');
  if (t.length === 0) return null;
  if (SEED_RE.test(t) && t.length <= SEED_MAX) return t;
  if (BODY_RE.test(t)) return DIMENSIONI[size].letter + t;
  return null;
}

/** Il seme con la dimensione cambiata (stessa parte libera). */
export function withDimensione(seed: string, size: Dimensione): string {
  const body = isSeed(seed) ? seed.slice(1) : seed.replace(/[^0-9a-z]/g, '').slice(0, SEED_MAX - 1) || '0';
  return DIMENSIONI[size].letter + body;
}

/** Seme casuale della dimensione indicata: lettera + 6 cifre in base 36. */
export function randomSeed(size: Dimensione, rnd: () => number = Math.random): string {
  let body = '';
  for (let i = 0; i < 6; i++) body += BASE36[Math.floor(rnd() * 36) % 36];
  return DIMENSIONI[size].letter + body;
}

/** Regola del merletto, decisa dal seme (stabile: dipende solo dal testo del seme). */
export function ruleOfSeed(seed: string): RuleId {
  const i = fnv1a32(`regola:${seed}`) % LIBERO_RULES.length;
  return LIBERO_RULES[i] ?? 'voce';
}

/** Gradi senza doppioni, nell'ordine di GDD 8.4. */
export function normalizeGradi(gradi: readonly GradoId[]): GradoId[] {
  return GRADI_ORDER.filter((g) => gradi.includes(g));
}

/** Specifica del generatore per un seme e dei gradi. */
export function liberoSpec(seed: string, gradi: readonly GradoId[] = []): GenSpec {
  const size = dimensioneOf(seed) ?? 'medio';
  const d = DIMENSIONI[size];
  return { seed, columns: d.columns, rows: d.rows, rule: ruleOfSeed(seed), gradi: normalizeGradi(gradi), difficulty: size };
}

/** Id del livello generato: lo stesso che costruisce il generatore (`lib-<seme>~<gradi ordinati>`). */
export function liberoLevelId(seed: string, gradi: readonly GradoId[] = []): LevelId {
  const g = [...normalizeGradi(gradi)].sort();
  return `lib-${seed}${g.length ? `~${g.join('+')}` : ''}`;
}

/** Seme e gradi da un id `lib-…`; null se l'id non è di un Merletto libero. */
export function parseLiberoId(id: LevelId): { seed: string; gradi: GradoId[] } | null {
  const m = /^lib-([0-9a-z]+)(?:~([A-Za-z+]+))?$/.exec(id);
  if (!m || !m[1] || !isSeed(m[1])) return null;
  const gradi: GradoId[] = [];
  if (m[2]) {
    for (const g of m[2].split('+')) {
      const ok = GRADI_ORDER.find((x) => x === g);
      if (!ok || gradi.includes(ok)) return null;
      gradi.push(ok);
    }
  }
  return { seed: m[1], gradi: normalizeGradi(gradi) };
}

/** Punti dei gradi (GDD 8.4: ogni grado vale 1 punto). */
export function gradiPoints(gradi: readonly GradoId[]): number {
  return normalizeGradi(gradi).length;
}

/** Tutte le combinazioni dei gradi (64), per i test e per l'elenco dei record. */
export function allGradiCombos(list: readonly GradoId[] = GRADI_ORDER): GradoId[][] {
  const out: GradoId[][] = [];
  const n = list.length;
  for (let mask = 0; mask < 1 << n; mask++) out.push(list.filter((_g, i) => (mask >> i) & 1));
  return out;
}

/** Controllo di forma di un livello generato (per i test e per il risolutore). */
export function levelMatchesSpec(level: LevelDef, spec: GenSpec): boolean {
  const rows = spec.gradi.includes('notteCorta') ? Math.max(4, spec.rows - 2) : spec.rows;
  return level.columns.length === spec.columns && level.endHour - level.startHour === rows && level.initial.length === spec.columns;
}
