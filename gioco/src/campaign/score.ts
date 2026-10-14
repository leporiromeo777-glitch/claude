/**
 * Carillon (GDD 13.2, 10.3): il merletto di una notte suona una riga per battito,
 * ogni incrocio con il bicordo dei due personaggi (sopra, poi sotto); i titoli di coda
 * suonano l'intera partita, un battito per giornata con la nota del personaggio più
 * presente quel giorno.
 */
import type { BalanceDef, CarillonScore, CharacterId, ContentDB, FlagValue, LaceEvent, LevelDef, NightOutcome, RowMoves, ThreadId } from '../core/types';
import { createContext, simulate } from '../engine/index';

export const BEAT_MS = 380;

type Who = CharacterId | 'lino';

export function whoOf(level: LevelDef, t: ThreadId): Who {
  const def = level.threads.find((x) => x.id === t);
  if (!def || def.kind === 'lino') return 'lino';
  return def.character ?? 'lino';
}

/** Spartito musicale dagli eventi di una notte. */
export function scoreFromEvents(level: LevelDef, events: readonly (readonly LaceEvent[])[], beatMs = BEAT_MS): CarillonScore {
  const rows: Who[][][] = events.map((row) => {
    const dyads: Who[][] = [];
    for (const e of row) {
      if (e.k !== 'incontro') continue;
      const under = e.over === e.a ? e.b : e.a;
      dyads.push([whoOf(level, e.over), whoOf(level, under)]);
    }
    return dyads;
  });
  return { beatMs, rows };
}

/** Eventi di righe già decise (si rigiocano col motore). */
export function eventsOfRows(level: LevelDef, rows: readonly RowMoves[], flags: Record<string, FlagValue> = {}, balance?: Pick<BalanceDef, 'traboccoSoglia' | 'nodoRighe'> | null): LaceEvent[][] {
  try {
    const sim = simulate(level, createContext(level, flags, { balance: balance ?? null }), rows);
    if (sim.events.length > 0) return sim.events;
  } catch {
    /* righe non valide: si ricostruiscono gli incroci a mano */
  }
  // Riserva: permutazione semplice dalle posizioni d'apertura (senza bordi).
  const pos = [...level.initial];
  return rows.map((r) => {
    const out: LaceEvent[] = [];
    for (const c of r.crossings) {
      const a = pos[c.pair];
      const b = pos[c.pair + 1];
      if (a === undefined || b === undefined) continue;
      out.push({ k: 'incontro', a, b, over: c.over === 'L' ? a : b, pair: c.pair });
      pos[c.pair] = b;
      pos[c.pair + 1] = a;
    }
    return out;
  });
}

export function scoreFromRows(level: LevelDef, rows: readonly RowMoves[], flags: Record<string, FlagValue> = {}, balance?: Pick<BalanceDef, 'traboccoSoglia' | 'nodoRighe'> | null, beatMs = BEAT_MS): CarillonScore {
  return scoreFromEvents(level, eventsOfRows(level, rows, flags, balance), beatMs);
}

export function scoreFromOutcome(level: LevelDef, outcome: Pick<NightOutcome, 'events' | 'rows'>, beatMs = BEAT_MS): CarillonScore {
  if (outcome.events?.length) return scoreFromEvents(level, outcome.events, beatMs);
  return scoreFromRows(level, outcome.rows, {}, null, beatMs);
}

/** Il personaggio più presente in una notte: chi incrocia di più (a parità, l'ordine dei fili). */
export function mostPresent(level: LevelDef, events: readonly (readonly LaceEvent[])[]): Who {
  const count = new Map<Who, number>();
  for (const row of events) for (const e of row) {
    if (e.k !== 'incontro') continue;
    for (const t of [e.a, e.b]) {
      const w = whoOf(level, t);
      if (w === 'lino') continue;
      count.set(w, (count.get(w) ?? 0) + 1);
    }
  }
  let best: Who = 'lino';
  let n = 0;
  for (const t of level.threads) {
    const w = whoOf(level, t.id);
    const c = count.get(w) ?? 0;
    if (w !== 'lino' && c > n) {
      best = w;
      n = c;
    }
  }
  if (best === 'lino') {
    const first = level.threads.find((t) => t.kind !== 'lino' && t.character);
    if (first?.character) best = first.character;
  }
  return best;
}

/** Il carillon dell'intera partita: un battito per giornata chiusa, nell'ordine della campagna. */
export function gameScore(history: Record<string, { rows: RowMoves[] }>, db: Pick<ContentDB, 'levels' | 'campaign' | 'balance'>, beatMs = BEAT_MS): CarillonScore {
  const ids = [...db.campaign.days.map((d) => d.id), ...Object.values(db.campaign.finals)];
  const rows: Who[][][] = [];
  for (const id of ids) {
    const h = history[id];
    const level = db.levels.get(id);
    if (!h || !level) continue;
    const who = mostPresent(level, eventsOfRows(level, h.rows, {}, db.balance));
    rows.push([[who]]);
  }
  return { beatMs, rows };
}
