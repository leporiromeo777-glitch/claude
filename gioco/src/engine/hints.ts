/**
 * Suggerimenti a tre gradini (GDD 14), derivati dalla soluzione. Revisione 2
 * (R2-D1): i suggerimenti non mentono mai.
 * - spinta: evidenzia l'obiettivo più urgente (spillo d'ottone o richiesta) con
 *   la frase della nonna del livello (`hintKeys.spinta`, finché la giornata non
 *   ha superato il primo evento di cui parla: Q076) o una generica; con «Spilli
 *   velati» guarda solo gli spilli già visibili (Q062);
 * - indizio: confronta la bozza con la riga della soluzione. Se coincide, «Quest'ora
 *   va bene: fissala»; altrimenti nomina il primo incrocio (da sinistra) mancante,
 *   rovesciato o di troppo, e dice se nella riga ce n'è ancora da sistemare;
 * - fantasma: TUTTI gli incroci del giocatore della riga corrente (`ghosts`;
 *   `ghost` è il primo, per chi ne legge uno solo).
 *
 * `solution` sono le righe di una soluzione completa (dalla prima ora). Se non
 * c'è, o se non comincia con le righe già fissate, si risolve dallo stato
 * corrente con il solver sincrono e un limite di stati da browser; se da qui
 * non si arriva il suggerimento lo dice, se il solver si ferma al limite di
 * stati si dà il suggerimento generico.
 */
import type { Condition, Crossing, GradoId, Hint, HintTier, Hour, LaceState, LevelDef, RowMoves, RunContext } from '../core/types';
import { solve } from './solver';
import { evaluate } from './conditions';
import { HINT_KEYS } from './keys';
import { simulate } from './simulate';

export interface HintArgs {
  level: LevelDef;
  ctx: RunContext;
  timeline: LaceState[];
  rows: RowMoves[];
  goals: Condition[];
  tier: HintTier;
  solution?: RowMoves[];
  /**
   * Bozza della riga corrente (R2-D1): l'Indizio la confronta con la riga della
   * soluzione. Senza, la bozza è vuota.
   */
  draft?: readonly Crossing[];
  /** Gradi della notte: con «Spilli velati» la Spinta nomina solo gli spilli visibili (Q062). */
  gradi?: readonly GradoId[];
}

/** Suggerimento del motore: il Fantasma porta tutti gli incroci della riga. */
export interface RowHint extends Hint {
  /** Fantasma: tutti gli incroci del giocatore della riga corrente, da sinistra (R2-D1, Q041). */
  ghosts?: Crossing[];
  /** Fantasma: incroci della bozza che la riga giusta non ha (vanno sciolti). */
  extra?: Crossing[];
}

/** Con «Spilli velati» uno spillo si vede solo fino a due ore prima (come il disegno del tombolo). */
export const VEILED_PIN_AHEAD = 2;

const HINT_MAX_STATES = 60_000;

function samePlayerRow(a: RowMoves | undefined, b: RowMoves | undefined): boolean {
  if (!a || !b) return false;
  const k = (r: RowMoves): string =>
    r.crossings
      .filter((c) => !c.forced)
      .map((c) => `${c.pair}${c.over}`)
      .sort()
      .join(',');
  return k(a) === k(b);
}

/**
 * Una soluzione valida dallo stato corrente (righe complete dalla prima ora), o
 * null. Con `why` si sa se manca perché da qui non si arriva ('impossibile') o
 * perché il solver si è fermato al limite di stati ('limite').
 */
export function solutionFrom(args: Omit<HintArgs, 'tier'>, why?: { status: 'impossibile' | 'limite' }): RowMoves[] | null {
  const { level, rows, solution } = args;
  if (solution && solution.length === level.endHour - level.startHour && rows.every((r, i) => samePlayerRow(r, solution[i]))) return solution;
  const state = args.timeline[args.timeline.length - 1];
  if (!state) return null;
  const res = solve({ level, ctx: args.ctx, goals: args.goals, from: { state, rowsDone: rows }, maxStates: HINT_MAX_STATES });
  if (res.status === 'ok' && res.rows) return res.rows;
  if (why) why.status = res.status === 'limite' ? 'limite' : 'impossibile';
  return null;
}

function threadsOf(state: LaceState, c: Crossing): { sopra: string; sotto: string } {
  const L = state.pos[c.pair] ?? '';
  const R = state.pos[c.pair + 1] ?? '';
  return c.over === 'R' ? { sopra: R, sotto: L } : { sopra: L, sotto: R };
}

/**
 * Ultima ora in cui la frase della nonna del livello (`hintKeys.spinta`) vale
 * ancora (Q076): le frasi parlano del primo evento della giornata («Alle otto
 * Bepi esce in barca», «il vaporetto delle nove», «dalle dieci all'una…»).
 * Passato quell'evento (barca o vaporetto, ingresso del filo nero, fine
 * dell'acqua alta) la Spinta usa le frasi generiche. Senza eventi: sempre.
 */
export function spintaCustomUntil(level: LevelDef): Hour {
  let until = Number.POSITIVE_INFINITY;
  for (const e of level.edges ?? []) until = Math.min(until, e.hour);
  if (level.nero) until = Math.min(until, level.nero.enter.hour);
  for (const t of level.tide ?? []) until = Math.min(until, t.to);
  return until;
}

function spinta(args: HintArgs, state: LaceState): Hint {
  const { level } = args;
  const row = state.hour + 1;
  const custom = level.hintKeys?.spinta && row <= spintaCustomUntil(level) ? level.hintKeys.spinta : undefined;
  // Con «Spilli velati» solo gli spilli che il tombolo mostra già (Q062).
  const veiled = (args.gradi ?? []).includes('spilliVelati');
  // Spillo d'ottone più vicino nel tempo che non è ancora al suo posto.
  const pins = [...level.pins].filter((p) => p.hour >= row && (!veiled || p.hour <= row + VEILED_PIN_AHEAD)).sort((a, b) => a.hour - b.hour);
  for (const p of pins) {
    const col = level.columns.indexOf(p.place);
    if (state.pos[col] === p.thread) continue;
    return { tier: 'spinta', textKey: custom ?? HINT_KEYS.spintaSpillo, params: { chi: p.thread, luogo: p.place, ora: p.hour }, highlight: { hour: p.hour, column: col, pin: { ...p } } };
  }
  // Richiesta a rischio o ancora da fare, con l'ora più vicina.
  if (args.goals.length > 0) {
    const sim = simulate(level, args.ctx, args.rows);
    const timeline = sim.ok ? sim.timeline : args.timeline;
    const reports = evaluate(level, timeline, sim.ok ? sim.events : [], args.goals, args.ctx, false);
    let bestHour = Number.POSITIVE_INFINITY;
    reports.forEach((r, i) => {
      if (r.status === 'soddisfatta' || r.status === 'fallita') return;
      const h = deadline(args.goals[i] as Condition, level);
      if (r.status === 'a_rischio') bestHour = Math.min(bestHour, row);
      else bestHour = Math.min(bestHour, Math.max(row, h));
    });
    if (Number.isFinite(bestHour)) return { tier: 'spinta', textKey: custom ?? HINT_KEYS.spintaRichiesta, params: { ora: bestHour }, highlight: { hour: bestHour } };
  }
  return { tier: 'spinta', textKey: custom ?? HINT_KEYS.spintaGenerico, highlight: { hour: row } };
}

/** Ora entro cui una condizione si decide (per la spinta). */
function deadline(c: Condition, level: LevelDef): number {
  switch (c.t) {
    case 'presso':
    case 'esceCon':
      return c.hour;
    case 'maiPresso':
      return c.from;
    case 'incontra':
    case 'nonIncontra':
    case 'sopra':
      return c.to ?? level.endHour;
    case 'consegnata':
    case 'ha':
      return c.by ?? level.endHour;
    case 'parte':
      return c.hour ?? level.endHour;
    case 'tutti':
    case 'almeno':
      return Math.min(...c.of.map((x) => deadline(x, level)));
    case 'non':
      return deadline(c.c, level);
    default:
      return level.endHour;
  }
}

/** Incroci del giocatore di una riga, per coppia (gli incroci forzati non sono suoi). */
function byPair(list: readonly Crossing[]): Map<number, Crossing> {
  const m = new Map<number, Crossing>();
  for (const c of list) if (!c.forced) m.set(c.pair, { pair: c.pair, over: c.over });
  return m;
}

/** Differenza fra la bozza e la riga della soluzione, coppia per coppia da sinistra. */
export type RowDiff =
  | { k: 'manca'; c: Crossing }
  | { k: 'verso'; c: Crossing }
  | { k: 'troppo'; c: Crossing };

export function rowDiffs(draft: readonly Crossing[], solRow: readonly Crossing[]): RowDiff[] {
  const d = byPair(draft);
  const s = byPair(solRow);
  const pairs = [...new Set([...d.keys(), ...s.keys()])].sort((a, b) => a - b);
  const out: RowDiff[] = [];
  for (const p of pairs) {
    const a = d.get(p);
    const b = s.get(p);
    if (a && b) {
      if (a.over !== b.over) out.push({ k: 'verso', c: b });
    } else if (b) out.push({ k: 'manca', c: b });
    else if (a) out.push({ k: 'troppo', c: a });
  }
  return out;
}

export function hintFor(args: HintArgs): RowHint {
  const state = args.timeline[args.timeline.length - 1];
  const row = (state?.hour ?? args.level.startHour) + 1;
  if (!state || row > args.level.endHour) return { tier: args.tier, textKey: HINT_KEYS.spintaGenerico };
  if (args.tier === 'spinta') return spinta(args, state);
  const why: { status: 'impossibile' | 'limite' } = { status: 'impossibile' };
  const sol = solutionFrom(args, why);
  if (!sol) {
    if (args.tier === 'indizio' && args.level.hintKeys?.indizio) return { tier: args.tier, textKey: args.level.hintKeys.indizio };
    // Limite di stati: non si sa se da qui si arriva, quindi il suggerimento generico (ARCHITETTURA 5.2).
    if (why.status === 'limite') return { tier: args.tier, textKey: args.level.hintKeys?.spinta ?? HINT_KEYS.spintaGenerico, highlight: { hour: row } };
    return { tier: args.tier, textKey: HINT_KEYS.impossibile };
  }
  const idx = row - args.level.startHour - 1;
  const solRow = (sol[idx]?.crossings ?? []).filter((c) => !c.forced).map((c) => ({ pair: c.pair, over: c.over }) as Crossing).sort((a, b) => a.pair - b.pair);
  const draft = (args.draft ?? []).filter((c) => !c.forced);
  const diffs = rowDiffs(draft, solRow);
  if (args.tier === 'fantasma') {
    // Tutti gli incroci della riga (R2-D1). Se la bozza è già la riga giusta non c'è niente da mostrare.
    if (solRow.length === 0) return { tier: 'fantasma', textKey: HINT_KEYS.fantasmaQuiete, params: { ora: row }, highlight: { hour: row } };
    if (diffs.length === 0) return { tier: 'fantasma', textKey: HINT_KEYS.fantasmaVa, params: { ora: row }, highlight: { hour: row } };
    const params: Record<string, string | number> = { ora: row };
    solRow.forEach((c, i) => {
      const t = threadsOf(state, c);
      const n = i === 0 ? '' : String(i + 1);
      params[`sopra${n}`] = t.sopra;
      params[`sotto${n}`] = t.sotto;
    });
    const first = solRow[0] as Crossing;
    const key = solRow.length === 1 ? HINT_KEYS.fantasma : solRow.length === 2 ? HINT_KEYS.fantasmaDue : HINT_KEYS.fantasmaTre;
    const out: RowHint = { tier: 'fantasma', textKey: key, params, highlight: { hour: row, column: first.pair }, ghost: { ...first }, ghosts: solRow.map((c) => ({ ...c })) };
    const extra = diffs.filter((x) => x.k === 'troppo').map((x) => ({ ...x.c }));
    if (extra.length > 0) out.extra = extra;
    return out;
  }
  // Indizio: la bozza confrontata con la riga della soluzione (R2-D1, Q025, Q041).
  if (diffs.length === 0) {
    if (solRow.length === 0) return { tier: 'indizio', textKey: HINT_KEYS.indizioQuiete, params: { ora: row }, highlight: { hour: row } };
    return { tier: 'indizio', textKey: HINT_KEYS.indizioVa, params: { ora: row }, highlight: { hour: row } };
  }
  const d = diffs[0] as RowDiff;
  const t = threadsOf(state, d.c);
  const altri = diffs.length - 1;
  const highlight = { hour: row, column: d.c.pair };
  if (d.k === 'troppo') return { tier: 'indizio', textKey: HINT_KEYS.indizioTroppo, params: { ora: row, a: t.sopra, b: t.sotto, altri }, highlight };
  if (d.k === 'verso') return { tier: 'indizio', textKey: HINT_KEYS.indizioVerso, params: { ora: row, sopra: t.sopra, sotto: t.sotto, altri }, highlight };
  return { tier: 'indizio', textKey: altri > 0 ? HINT_KEYS.indizioSopraAltri : HINT_KEYS.indizioSopra, params: altri > 0 ? { ora: row, sopra: t.sopra, sotto: t.sotto, altri } : { ora: row, sopra: t.sopra, sotto: t.sotto }, highlight };
}
