/**
 * L'ora di gioco. Il modulo accetta sia i numeri della narrativa (23.5 = 23:30) sia le
 * stringhe dei contenuti ("23:20", "00:30"); internamente lavora in minuti dalla
 * mezzanotte, e per la notte in minuti dal mezzogiorno, così 21:00 < 23:20 < 00:30 < 05:30.
 */
import { ORARI } from './costanti';

/** Un'ora di gioco: numero di ore (0 ≤ ora < 24, anche frazionario) o stringa «HH:MM». */
export type Ora = number | string;

export type FaseDelGiorno = 'notte' | 'alba' | 'giorno' | 'brace';

/** Intervallo semiaperto [da, a) in minuti dalla mezzanotte; se da > a passa la mezzanotte. */
export type Intervallo = readonly [number, number];

const RE_ORA = /^\s*(\d{1,2})(?::(\d{2}))?\s*$/;

/** Minuti dalla mezzanotte, in [0, 1440). Lancia un errore se l'ora non si legge. */
export function minuti(ora: Ora): number {
  if (typeof ora === 'number') {
    if (!Number.isFinite(ora)) throw new Error(`Ora non valida: ${ora}`);
    const m = Math.round(ora * 60);
    return ((m % 1440) + 1440) % 1440;
  }
  const r = RE_ORA.exec(ora);
  if (!r) throw new Error(`Ora non valida: «${ora}»`);
  const h = Number(r[1]);
  const mm = r[2] ? Number(r[2]) : 0;
  if (h > 24 || mm > 59) throw new Error(`Ora non valida: «${ora}»`);
  return (h * 60 + mm) % 1440;
}

/** «HH:MM» da minuti dalla mezzanotte. */
export function formattaOra(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Minuti dal mezzogiorno: ordina le ore di una notte (21:00 → 540, 00:30 → 750, 05:30 → 1050). */
export function minutiNotte(ora: Ora): number {
  return (minuti(ora) - 720 + 1440) % 1440;
}

export function dentroIntervallo(ora: Ora, intervallo: Intervallo): boolean {
  const m = minuti(ora);
  const [da, a] = intervallo;
  if (da === a) return false;
  return da < a ? m >= da && m < a : m >= da || m < a;
}

/** Fase del giorno (GDD §2.3): notte 21:00-05:30, alba 05:30-06:30, giorno 06:30-19:30, brace 19:30-21:00. */
export function faseDelGiorno(ora: Ora): FaseDelGiorno {
  const m = minuti(ora);
  if (m >= ORARI.notte || m < ORARI.alba) return 'notte';
  if (m < ORARI.giornoPieno) return 'alba';
  if (m < ORARI.brace) return 'giorno';
  return 'brace';
}

/** La Linea è accesa dall'alba alla brace: di giorno abbaglia chi mira vicino all'asse. */
export function lineaAccesa(ora: Ora): boolean {
  const f = faseDelGiorno(ora);
  return f === 'alba' || f === 'giorno';
}

/** Legge «20:00-05:30» in un intervallo; null se il testo non contiene due ore. */
export function leggiIntervallo(testo: string | null | undefined): Intervallo | null {
  if (!testo) return null;
  const ore = [...testo.matchAll(/(\d{1,2}):(\d{2})/g)];
  if (ore.length < 2) return null;
  return [minuti(`${ore[0]![1]}:${ore[0]![2]}`), minuti(`${ore[1]![1]}:${ore[1]![2]}`)];
}

/**
 * Le ore in cui il Collare copre un pilastro, dai testi di capisaldi.json
 * («coperto dal Collare fra le 01:00 e le 01:40», «dentro il Collare dalle 02:00 alle 02:40»,
 * «mai coperto»). Restituisce gli intervalli trovati (vuoto = mai coperto).
 */
export function leggiCollare(testo: string | null | undefined): Intervallo[] {
  if (!testo) return [];
  const ore = [...testo.matchAll(/(\d{1,2}):(\d{2})/g)].map((r) => minuti(`${r[1]}:${r[2]}`));
  const out: Intervallo[] = [];
  for (let i = 0; i + 1 < ore.length; i += 2) out.push([ore[i]!, ore[i + 1]!]);
  return out;
}
