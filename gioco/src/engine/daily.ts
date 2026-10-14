/**
 * Merletto del giorno (GDD 8.3): uguale per tutti, calcolato dalla data locale
 * `AAAA-MM-GG`, offline.
 *
 * - Regola del giorno per giorno della settimana: lunedì voce, martedì segreto
 *   (e pozzo), mercoledì Molo, giovedì febbre, venerdì nodo (rancore), sabato
 *   marea, domenica filo nero.
 * - Dimensioni: lunedì-giovedì 5 colonne e 7 righe; venerdì-domenica 6 e 8.
 * - Il seme è la data; il generatore prova `data#0 … data#499`.
 *
 * Il calcolo del giorno della settimana è aritmetico (nessun Date).
 */
import type { RuleId } from '../core/types';
import type { GenSpec } from './generator';

/** Regola per giorno della settimana (0 = domenica). */
export const DAILY_RULES: readonly RuleId[] = ['nero', 'voce', 'segreto', 'molo', 'febbre', 'rancore', 'marea'];

export function parseDate(date: string): { y: number; m: number; d: number } | null {
  const mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!mt) return null;
  const y = Number(mt[1]);
  const m = Number(mt[2]);
  const d = Number(mt[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

function leap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y: number, m: number): number {
  return [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] ?? 30;
}

/** Giorni dal 1970-01-01 (algoritmo dei giorni civili). */
export function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const mp = (m + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Giorno della settimana, 0 = domenica … 6 = sabato. */
export function weekday(date: string): number {
  const p = parseDate(date);
  if (!p) throw new Error(`daily: invalid date "${date}"`);
  const days = daysFromCivil(p.y, p.m, p.d);
  return (((days + 4) % 7) + 7) % 7; // 1970-01-01 era un giovedì
}

/** Giorno dell'anno, da 1. */
export function dayOfYear(date: string): number {
  const p = parseDate(date);
  if (!p) throw new Error(`daily: invalid date "${date}"`);
  return daysFromCivil(p.y, p.m, p.d) - daysFromCivil(p.y, 1, 1) + 1;
}

/** La data successiva (AAAA-MM-GG). */
export function nextDate(date: string): string {
  const p = parseDate(date);
  if (!p) throw new Error(`daily: invalid date "${date}"`);
  let { y, m, d } = p;
  d++;
  if (d > daysInMonth(y, m)) {
    d = 1;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function isDateSeed(seed: string): boolean {
  return parseDate(seed) !== null;
}

/** Specifica del Merletto del giorno per una data. */
export function dailySpec(date: string): GenSpec {
  const wd = weekday(date);
  const big = wd === 5 || wd === 6 || wd === 0;
  return {
    seed: date,
    columns: big ? 6 : 5,
    rows: big ? 8 : 7,
    rule: DAILY_RULES[wd] as RuleId,
    gradi: [],
    difficulty: 'medio',
  };
}

/** Id del livello del giorno. */
export function dailyLevelId(date: string): string {
  return `day-${date}`;
}
