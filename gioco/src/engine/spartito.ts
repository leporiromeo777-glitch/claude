/**
 * Spartito (ARCHITETTURA 14.6, GDD 8.5): il merletto come stringa corta.
 *
 *   TRAMA1-<modo><riferimento>[~<gradi>]-<righe>-<controllo>
 *
 * - modo: S (storia, riferimento = id del livello), G (giornaliero, AAAAMMGG),
 *   L (libero, seme in base 36);
 * - gradi: iniziali separate da '+' (me, sd, sv, ni, np, nc);
 * - righe: una per ora giocabile, separate da '.'; riga vuota '_'; ogni incrocio
 *   è una lettera a…l = coppia*2 + (verso R ? 1 : 0), in ordine di coppia; gli
 *   incroci forzati non si scrivono;
 * - controllo: FNV-1a a 32 bit dei campi precedenti (tutta la stringa prima
 *   dell'ultimo '-'), due cifre in base 36: prima h mod 36, poi ⌊h/36⌋ mod 36
 *   (così l'esempio del GDD `TRAMA1-G20261014-b._.ad.c-7k` è valido).
 *
 * Le ore non sono nello spartito: `decodeSpartito` restituisce righe con `hour`
 * = 1, 2, 3… (numero di riga); `spartitoRows(level, s)` le porta alle ore vere.
 */
import type { GradoId, LevelDef, RowMoves } from '../core/types';
import { fnv1a32 } from './hash';

export interface Spartito {
  mode: 'S' | 'G' | 'L';
  ref: string;
  gradi?: GradoId[];
  rows: RowMoves[];
}

const PREFIX = 'TRAMA1';

export const GRADO_CODES: Record<GradoId, string> = {
  matassaEsatta: 'me',
  senzaDisfa: 'sd',
  spilliVelati: 'sv',
  nodoInPiu: 'ni',
  neroInPiu: 'np',
  notteCorta: 'nc',
};
const GRADO_ORDER: GradoId[] = ['matassaEsatta', 'senzaDisfa', 'spilliVelati', 'nodoInPiu', 'neroInPiu', 'notteCorta'];
const CODE_GRADO = new Map<string, GradoId>(GRADO_ORDER.map((g) => [GRADO_CODES[g], g]));

function control(body: string): string {
  const h = fnv1a32(body);
  return (h % 36).toString(36) + (Math.floor(h / 36) % 36).toString(36);
}

function validRef(mode: Spartito['mode'], ref: string): boolean {
  if (mode === 'G') return /^\d{8}$/.test(ref);
  if (mode === 'L') return /^[0-9a-z]+$/.test(ref);
  return /^[A-Za-z0-9_]+$/.test(ref);
}

export function encodeSpartito(s: Spartito): string {
  if (!validRef(s.mode, s.ref)) throw new Error(`spartito: invalid reference "${s.ref}" for mode ${s.mode}`);
  const gradi = s.gradi && s.gradi.length > 0 ? `~${GRADO_ORDER.filter((g) => s.gradi?.includes(g)).map((g) => GRADO_CODES[g]).join('+')}` : '';
  const rows = s.rows
    .map((r) => {
      const cs = r.crossings.filter((c) => !c.forced).sort((a, b) => a.pair - b.pair);
      if (cs.length === 0) return '_';
      return cs
        .map((c) => {
          if (!Number.isInteger(c.pair) || c.pair < 0 || c.pair > 5) throw new Error(`spartito: pair ${c.pair} out of range`);
          return String.fromCharCode(97 + c.pair * 2 + (c.over === 'R' ? 1 : 0));
        })
        .join('');
    })
    .join('.');
  const body = `${PREFIX}-${s.mode}${s.ref}${gradi}-${rows.length > 0 ? rows : ''}`;
  return `${body}-${control(body)}`;
}

/** Decodifica; null se il formato non torna o il controllo non corrisponde (carattere alterato). */
export function decodeSpartito(str: string): Spartito | null {
  const t = str.trim();
  const last = t.lastIndexOf('-');
  if (last < 0) return null;
  const body = t.slice(0, last);
  const ctl = t.slice(last + 1);
  if (!/^[0-9a-z]{2}$/.test(ctl) || control(body) !== ctl) return null;
  const parts = body.split('-');
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const head = parts[1] as string;
  const rowsStr = parts[2] as string;
  const mode = head[0];
  if (mode !== 'S' && mode !== 'G' && mode !== 'L') return null;
  let ref = head.slice(1);
  let gradi: GradoId[] | undefined;
  const tilde = ref.indexOf('~');
  if (tilde >= 0) {
    const codes = ref.slice(tilde + 1).split('+');
    ref = ref.slice(0, tilde);
    gradi = [];
    for (const c of codes) {
      const g = CODE_GRADO.get(c);
      if (!g || gradi.includes(g)) return null;
      gradi.push(g);
    }
  }
  if (!validRef(mode, ref)) return null;
  const rows: RowMoves[] = [];
  if (rowsStr.length > 0) {
    const list = rowsStr.split('.');
    for (let i = 0; i < list.length; i++) {
      const r = list[i] as string;
      const crossings: RowMoves['crossings'] = [];
      if (r !== '_') {
        if (r.length === 0) return null;
        let lastPair = -1;
        for (const ch of r) {
          const v = ch.charCodeAt(0) - 97;
          if (v < 0 || v > 11) return null;
          const pair = v >> 1;
          if (pair <= lastPair) return null;
          lastPair = pair;
          crossings.push({ pair, over: v & 1 ? 'R' : 'L' });
        }
      }
      rows.push({ hour: i + 1, crossings });
    }
  }
  const out: Spartito = { mode, ref, rows };
  if (gradi) out.gradi = gradi;
  return out;
}

/** Righe di uno spartito con le ore vere del livello (startHour+1, startHour+2, …). */
export function spartitoRows(level: LevelDef, s: Pick<Spartito, 'rows'>): RowMoves[] {
  return s.rows.map((r, i) => ({ hour: level.startHour + 1 + i, crossings: r.crossings.map((c) => ({ ...c })) }));
}

/** Riferimento di un livello per lo spartito: id per la storia, data senza trattini, seme in base 36. */
export function spartitoRef(mode: Spartito['mode'], idOrDateOrSeed: string | number): string {
  if (mode === 'G') return String(idOrDateOrSeed).replace(/-/g, '');
  if (mode === 'L') return typeof idOrDateOrSeed === 'number' ? Math.abs(Math.floor(idOrDateOrSeed)).toString(36) : String(idOrDateOrSeed).toLowerCase();
  return String(idOrDateOrSeed);
}
