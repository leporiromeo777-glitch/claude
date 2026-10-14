/**
 * Merletto del giorno (GDD 8.3): date, serie di giorni, record e testo da
 * condividere. Logica pura (niente DOM, niente servizi): si prova in Node.
 *
 * - La data è quella locale `AAAA-MM-GG`; lo stesso giorno dà lo stesso livello
 *   (il generatore è deterministico).
 * - Serie: completare il giorno dopo l'ultimo giorno tessuto allunga la serie,
 *   saltare un giorno la fa ripartire da 1, ritessere lo stesso giorno non la cambia.
 * - Record: per ogni data si tiene il merletto migliore (meno incroci, poi più
 *   ore di quiete, poi la simmetria).
 */
import type { DailyRecord, LaceMetrics, LaceRecord, SaveData } from '../core/types';

/** `AAAA-MM-GG` dell'ora locale. */
export function localDate(now: Date = new Date()): string {
  const y = String(now.getFullYear()).padStart(4, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isIsoDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  const days = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1] ?? 31;
  return d <= days;
}

/** Data `AAAA-MM-GG` → oggetto Date a mezzogiorno locale (niente salti di fuso). */
export function dateObject(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
}

/** Il giorno prima (AAAA-MM-GG). */
export function previousDate(date: string): string {
  const t = dateObject(date);
  t.setDate(t.getDate() - 1);
  return localDate(t);
}

/** «14/10» per il testo da condividere (GDD 8.3). */
export function shortDate(date: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${m[2]}/${m[1]}` : date;
}

/** Riferimento dello spartito in modo G (`AAAAMMGG`) → data. */
export function dateFromRef(ref: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(ref);
  if (!m) return null;
  const d = `${m[1]}-${m[2]}-${m[3]}`;
  return isIsoDate(d) ? d : null;
}

/** Data di un livello del giorno (`day-AAAA-MM-GG`). */
export function dateOfDailyId(id: string): string | null {
  const m = /^day-(\d{4}-\d{2}-\d{2})$/.exec(id);
  return m && m[1] && isIsoDate(m[1]) ? m[1] : null;
}

export function dailyRecordOf(date: string, m: LaceMetrics, min: number, spartito: string): DailyRecord {
  return { date, incroci: m.incroci, min, quiete: m.quiete, simmetria: m.simmetria, spartito };
}

/** b è migliore di a? (meno incroci, poi più quiete, poi la simmetria). */
export function isBetterDaily(a: DailyRecord | undefined, b: DailyRecord): boolean {
  if (!a) return true;
  if (b.incroci !== a.incroci) return b.incroci < a.incroci;
  if (b.quiete !== a.quiete) return b.quiete > a.quiete;
  return b.simmetria && !a.simmetria;
}

export interface StreakState {
  dailyStreak: number;
  lastDaily?: string;
}

/** Serie dopo aver completato `date`. */
export function nextStreak(prev: StreakState, date: string): StreakState {
  const last = prev.lastDaily;
  if (last === date) return { dailyStreak: Math.max(1, prev.dailyStreak), lastDaily: last };
  // Una data più vecchia dell'ultima (orologio spostato indietro) non tocca la serie.
  if (last && date < last) return { dailyStreak: prev.dailyStreak, lastDaily: last };
  if (last && previousDate(date) === last) return { dailyStreak: prev.dailyStreak + 1, lastDaily: date };
  return { dailyStreak: 1, lastDaily: date };
}

/**
 * Serie da mostrare oggi: se l'ultimo giorno tessuto è ieri o oggi la serie è
 * ancora viva; altrimenti è già finita (0), anche se il salvataggio ricorda il valore vecchio.
 */
export function liveStreak(stats: Pick<SaveData['stats'], 'dailyStreak' | 'lastDaily'>, today: string): number {
  const last = stats.lastDaily;
  if (!last) return 0;
  if (last === today || last === previousDate(today)) return stats.dailyStreak;
  return 0;
}

/** Record d'eleganza aggiornato con un merletto nuovo (GDD 8.6). */
export function mergeLaceRecord(prev: LaceRecord | undefined, m: LaceMetrics, spartito: string): { record: LaceRecord; improved: boolean } {
  const better = !prev || prev.minIncroci === null || m.incroci < prev.minIncroci;
  const record: LaceRecord = {
    minIncroci: prev && prev.minIncroci !== null ? Math.min(prev.minIncroci, m.incroci) : m.incroci,
    maxQuiete: prev && prev.maxQuiete !== null ? Math.max(prev.maxQuiete, m.quiete) : m.quiete,
    simmetria: !!prev?.simmetria || m.simmetria,
    filoDOro: !!prev?.filoDOro || m.filoDOro,
  };
  const best = better ? spartito : prev?.bestSpartito;
  if (best) record.bestSpartito = best;
  const improved = !prev || better || (prev.maxQuiete ?? -1) < m.quiete || (!prev.simmetria && m.simmetria) || (!prev.filoDOro && m.filoDOro);
  return { record, improved };
}

/** Parametri della riga da condividere (chiave `ui.condividi.riga`). */
export function shareParams(r: Pick<DailyRecord, 'date' | 'incroci' | 'min' | 'quiete' | 'simmetria'>): Record<string, string | number> {
  return { data: shortDate(r.date), incroci: r.incroci, min: r.min, quiete: r.quiete, simmetria: r.simmetria ? 'si' : 'no' };
}

/** Giorni tessuti in tutto. */
export function dailyCount(daily: SaveData['daily']): number {
  return Object.keys(daily).length;
}
