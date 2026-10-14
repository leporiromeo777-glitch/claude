/**
 * Generatore procedurale (GDD 8.3-8.4, ARCHITETTURA 5.2): Merletto del giorno
 * e Merletto libero.
 *
 * Per k = 0…499 si prova il seme `seed#k` (generatore `rngFromSeed`): si
 * dispongono colonne, cast (con le sue stranezze) e lino, si scelgono perline e
 * obiettivi secondo la regola, si calcola il minimo con il solver e si applica
 * il filtro di qualità:
 *   1. risolvibile;
 *   2. minimo nell'intervallo (5 colonne: 6-12; 6 colonne: 8-14; 4 colonne: 4-9;
 *      con meno righe del formato standard l'intervallo scende di conseguenza);
 *   3. al massimo 12 soluzioni ottime distinte;
 *   4. il giocatore avido (bot.ts) non lo risolve con la matassa della giornata;
 *   5. la regola serve davvero: la soluzione ottima calcolata senza la regola
 *      non è valida con la regola (o senza la regola non c'è soluzione).
 * Matassa = minimo + 1 (minimo esatto con il grado "Matassa esatta").
 * Se nessun seme passa: per il Merletto del giorno la lista di riserva
 * precalcolata (`data/daily-fallback.json`, indicizzata col giorno dell'anno),
 * altrimenti il candidato risolvibile arrivato più avanti nel filtro (segnalato
 * con `fromFallback`).
 *
 * Gradi (GDD 8.4): matassaEsatta (matassa = minimo), nodoInPiu (una coppia in
 * rancore in più), neroInPiu (un filo nero in più, o un secondo filo da seguire
 * se c'è già), notteCorta (2 righe in meno). senzaDisfa e spilliVelati sono
 * regole d'interfaccia e non cambiano il livello.
 *
 * Deterministico: stesso seme e stessa versione danno lo stesso livello (niente
 * tempo né Math.random; i limiti del solver sono in stati, non in millisecondi).
 */
import type {
  BeadDef,
  CharacterId,
  Condition,
  EdgeEvent,
  GradoId,
  LevelDef,
  PinDef,
  PlaceId,
  QuirkId,
  RuleId,
  ThreadDef,
  ThreadId,
  TideDef,
} from '../core/types';
import { PLACE_ORDER } from '../core/types';
import type { Rng } from '../core/rng';
import { intBetween, pick, rngFromSeed, shuffle } from '../core/rng';
import { createContext } from './context';
import { solveInternal } from './solver';
import { greedyPlay } from './bot';
import { simulateAndEvaluate } from './simulate';
import { dayOfYear, isDateSeed } from './daily';
import fallbackData from './data/daily-fallback.json';

export interface GenSpec {
  seed: string;
  columns: 4 | 5 | 6;
  rows: number;
  rule: RuleId;
  gradi: GradoId[];
  difficulty: 'piccolo' | 'medio' | 'grande';
}

export interface GenResult {
  level: LevelDef;
  min: number;
  optimalCount: number;
  tries: number;
  seedUsed: string;
  fromFallback: boolean;
}

/** Versione del generatore: cambia quando cambia il modo di costruire i livelli. */
export const GENERATOR_VERSION = 2;
export const GEN_TRIES = 500;
const GEN_MAX_STATES = 30_000;
const MAX_OPTIMAL = 12;

const CAST: readonly CharacterId[] = ['teresa', 'marta', 'piero', 'gino', 'bepi', 'nina', 'zeno', 'lunardi'];
const QUIRK_OF: Partial<Record<CharacterId, QuirkId>> = {
  teresa: 'teresaLegge',
  piero: 'pieroPozzo',
  gino: 'ginoCorre',
  nina: 'ninaCuriosa',
  zeno: 'zenoFaro',
  lunardi: 'lunardiCura',
};

/** Chiavi i18n dei livelli generati (namespace del tombolo). */
export const GEN_KEYS = {
  titoloGiornaliero: 'tombolo.generato.giornaliero',
  titoloLibero: 'tombolo.generato.libero',
  lettera: 'tombolo.generato.lettera',
  voce: 'tombolo.generato.voce',
  segreto: 'tombolo.generato.segreto',
  febbre: 'tombolo.generato.febbre',
  marinaio: 'tombolo.generato.marinaio',
} as const;

/** Intervallo del minimo di incroci ammesso dal filtro di qualità. */
export function minRange(columns: number, rows: number): [number, number] {
  const base: Record<number, [number, number, number]> = { 4: [4, 9, 6], 5: [6, 12, 7], 6: [8, 14, 8] };
  const b = base[columns] ?? [6, 12, 7];
  const shift = b[2] - rows;
  return [Math.max(3, b[0] - Math.max(0, shift)), Math.max(4, b[1] - Math.max(0, shift))];
}

/** Righe effettive (Notte corta: 2 in meno, almeno 4). */
export function effectiveRows(spec: GenSpec): number {
  return spec.gradi.includes('notteCorta') ? Math.max(4, spec.rows - 2) : spec.rows;
}

interface Built {
  level: LevelDef;
  goals: Condition[];
}

/** Costruisce un livello candidato dal generatore casuale (nessun controllo di qualità). */
export function buildCandidate(spec: GenSpec, seedK: string): Built {
  const rng: Rng = rngFromSeed(seedK);
  const W = spec.columns;
  const rows = effectiveRows(spec);
  const rule = spec.rule;

  // Colonne: Molo e Faro restano sempre (bordi, Zeno); si tolgono luoghi di mezzo.
  const middle: PlaceId[] = ['forno', 'piazza', 'chiesa', 'farmacia'];
  const drop = shuffle(middle, rng).slice(0, 6 - W);
  const columns = PLACE_ORDER.filter((p) => !drop.includes(p));
  const startHour = intBetween(rng, 6, 8);
  const endHour = startHour + rows;
  const faroCol = columns.indexOf('faro');

  // Cast: personaggi con nome più un lino.
  const required: CharacterId[] = [];
  if (rule === 'segreto') required.push('piero');
  if (rule === 'febbre' && rng() < 0.6) required.push('lunardi');
  const nLino = 1;
  const others = shuffle(CAST.filter((c) => !required.includes(c)), rng);
  const cast = [...required, ...others].slice(0, W - nLino);
  const threads: ThreadDef[] = cast.map((c) => ({ id: c, kind: 'persona', character: c }));
  threads.push({ id: 'lino1', kind: 'lino' });
  let initial: ThreadId[] = shuffle([...cast, 'lino1'], rng);
  if (rule === 'molo') {
    // Il lino aspetta il vaporetto al Molo.
    initial = ['lino1', ...initial.filter((t) => t !== 'lino1')];
  }
  const zi = initial.indexOf('zeno');
  if (zi >= 0 && Math.abs(zi - faroCol) > 2) {
    const target = faroCol;
    const tmp = initial[target] as ThreadId;
    initial[target] = 'zeno';
    initial[zi] = tmp;
  }
  const quirks: QuirkId[] = [];
  for (const c of cast) {
    const q = QUIRK_OF[c];
    if (q) quirks.push(q);
  }
  if (cast.includes('marta') && cast.includes('teresa')) quirks.unshift('martaNoSotto');

  const level: LevelDef = {
    id: isDateSeed(spec.seed) ? `day-${spec.seed}` : `lib-${spec.seed}`,
    kind: isDateSeed(spec.seed) ? 'giornaliero' : 'libero',
    act: 0,
    titleKey: isDateSeed(spec.seed) ? GEN_KEYS.titoloGiornaliero : GEN_KEYS.titoloLibero,
    columns,
    startHour,
    endHour,
    threads,
    initial,
    beads: [],
    rules: ['incrocio', 'spillo', 'lettera', 'matassa'],
    quirks,
    pins: [],
    goals: [],
    matassa: 0,
    musicSeed: seedK,
  };
  if (!level.rules.includes(rule)) level.rules.push(rule);
  const goals: Condition[] = [];
  const named = (): ThreadId[] => level.initial.filter((t) => t !== 'lino1' && cast.includes(t as CharacterId));
  const colOf = (t: ThreadId): number => level.initial.indexOf(t);
  const beads: BeadDef[] = [];

  // Una coppia (a, b) di fili con nome lontani almeno `d` colonne.
  const farPair = (d: number, exclude: ThreadId[] = []): [ThreadId, ThreadId] | null => {
    const list = named().filter((t) => !exclude.includes(t));
    const pairs: [ThreadId, ThreadId][] = [];
    for (const a of list) for (const b of list) if (a !== b && Math.abs(colOf(a) - colOf(b)) >= d) pairs.push([a, b]);
    return pairs.length > 0 ? pick(pairs, rng) : null;
  };
  const letter = (id: string, holder: ThreadId, to: ThreadId, minBy: number): void => {
    beads.push({ id, type: 'lettera', holder, to, labelKey: GEN_KEYS.lettera });
    const by = intBetween(rng, Math.min(endHour, minBy), endHour);
    goals.push({ t: 'consegnata', bead: id, by });
  };

  // ───── Regola del giorno ─────
  switch (rule) {
    case 'voce': {
      const v = pick(named(), rng);
      beads.push({ id: 'voce:chiacchiera', type: 'voce', holders: [v], labelKey: GEN_KEYS.voce });
      const near = named().filter((t) => t !== v && Math.abs(colOf(t) - colOf(v)) <= 2);
      const far = named().filter((t) => Math.abs(colOf(t) - colOf(v)) >= 3);
      if (rng() < 0.5 && near.length > 0) goals.push({ t: 'nonHa', who: pick(near, rng), bead: 'voce:chiacchiera' });
      else if (far.length > 0) goals.push({ t: 'ha', who: pick(far, rng), bead: 'voce:chiacchiera', by: intBetween(rng, startHour + 3, endHour) });
      else goals.push({ t: 'nonHa', who: pick(named().filter((t) => t !== v), rng), bead: 'voce:chiacchiera' });
      break;
    }
    case 'segreto': {
      const holders = named().filter((t) => t !== 'piero');
      const s = pick(holders, rng);
      beads.push({ id: 'segreto:confidenza', type: 'segreto', holders: [s], labelKey: GEN_KEYS.segreto });
      const targets = named().filter((t) => t !== s && t !== 'piero' && Math.abs(colOf(t) - colOf(s)) >= 2);
      if (targets.length > 0) goals.push({ t: 'ha', who: pick(targets, rng), bead: 'segreto:confidenza', by: intBetween(rng, startHour + 3, endHour) });
      const keep = named().filter((t) => t !== s && t !== 'piero' && !goals.some((g) => g.t === 'ha' && g.who === t));
      if (keep.length > 0) goals.push({ t: 'nonHa', who: pick(keep, rng), bead: 'segreto:confidenza' });
      break;
    }
    case 'molo': {
      const eh = intBetween(rng, startHour + 2, Math.max(startHour + 2, endHour - 3));
      level.threads.push({ id: 'marinaio', kind: 'lino', labelKey: GEN_KEYS.marinaio });
      const to = pick(named().filter((t) => colOf(t) >= 2), rng);
      beads.push({ id: 'Lm', type: 'lettera', holder: 'marinaio', to, labelKey: GEN_KEYS.lettera });
      goals.push({ t: 'consegnata', bead: 'Lm', by: intBetween(rng, Math.min(endHour, eh + 2), endHour) });
      const edges: EdgeEvent[] = [{ hour: eh, side: 'molo', kind: 'vaporetto', enters: 'marinaio' }];
      level.edges = edges;
      break;
    }
    case 'febbre': {
      const pool = named().filter((t) => t !== 'lunardi');
      const sick = pick(pool, rng);
      beads.push({ id: 'febbre', type: 'febbre', holders: [sick], labelKey: GEN_KEYS.febbre });
      const healthy = pool.filter((t) => t !== sick && Math.abs(colOf(t) - colOf(sick)) <= 2);
      if (cast.includes('lunardi') && rng() < 0.5) goals.push({ t: 'sano', who: sick });
      else if (healthy.length > 0) goals.push({ t: 'nonHa', who: pick(healthy, rng), bead: 'febbre' });
      else goals.push({ t: 'sano', who: pick(pool.filter((t) => t !== sick), rng) });
      break;
    }
    case 'rancore': {
      const pair = cast.includes('teresa') && cast.includes('marta') ? (['teresa', 'marta'] as [ThreadId, ThreadId]) : farPair(1);
      if (pair) {
        level.rancor = [pair];
        // La lettera va dall'uno all'altro: incrociandosi non si parlano, serve un tramite.
        letter('Lr', pair[0], pair[1], startHour + 3);
      }
      break;
    }
    case 'marea': {
      const flood = shuffle(columns.filter((p) => p !== 'molo' && p !== 'faro'), rng).slice(0, rng() < 0.5 ? 1 : 2);
      const from = intBetween(rng, startHour + 2, Math.max(startHour + 2, endHour - 3));
      const tide: TideDef[] = [{ from, to: Math.min(endHour, from + intBetween(rng, 1, 2)), places: flood }];
      level.tide = tide;
      break;
    }
    case 'nero': {
      const follow = pick(named(), rng);
      level.threads.push({ id: 'livia', kind: 'nero', character: 'livia' });
      level.nero = { thread: 'livia', enter: { hour: intBetween(rng, startHour + 1, startHour + 3), side: rng() < 0.5 ? 'faro' : 'molo' }, agenda: [{ follow }] };
      break;
    }
    default:
      break;
  }

  // ───── Obiettivi comuni ─────
  // 1-2 lettere da consegnare entro un'ora.
  const nLetters = (spec.difficulty === 'grande' ? 2 : 1) + (rng() < 0.35 ? 1 : 0) - (beads.some((b) => b.type === 'lettera') ? 1 : 0);
  for (let i = 0; i < Math.min(2, nLetters); i++) {
    const p = farPair(2, beads.filter((b) => b.type === 'lettera').map((b) => b.holder as ThreadId));
    if (!p) break;
    const d = Math.abs(colOf(p[0]) - colOf(p[1]));
    letter(`L${i + 1}`, p[0], p[1], startHour + Math.floor(d / 2) + 2);
  }
  // Un vincolo nonHa o nonIncontra (se la regola non ne ha già messo uno).
  if (!goals.some((g) => g.t === 'nonHa' || g.t === 'nonIncontra')) {
    const p = farPair(1);
    if (p) goals.push({ t: 'nonIncontra', a: p[0], b: p[1] });
  }
  // Un presso o un incontra.
  if (rng() < 0.5) {
    const who = pick(named(), rng);
    const c0 = colOf(who);
    const targets = columns.map((_, i) => i).filter((i) => Math.abs(i - c0) >= 2);
    const tc = targets.length > 0 ? pick(targets, rng) : (c0 + 1) % W;
    const hour = intBetween(rng, Math.min(endHour, startHour + Math.abs(tc - c0) + 1), endHour);
    goals.push({ t: 'presso', who, place: columns[tc] as PlaceId, hour });
  } else {
    const p = farPair(3) ?? farPair(2);
    if (p) goals.push({ t: 'incontra', a: p[0], b: p[1], from: startHour + 1, to: intBetween(rng, Math.min(endHour, startHour + 3), endHour) });
  }
  // 1-2 spilli d'ottone.
  const pins: PinDef[] = [];
  const nPins = rng() < 0.5 ? 1 : 2;
  const pinned = new Set<ThreadId>();
  for (let i = 0; i < nPins; i++) {
    const cand = named().filter((t) => !pinned.has(t) && !(rule === 'molo' && colOf(t) === 0));
    if (cand.length === 0) break;
    const t = pick(cand, rng);
    pinned.add(t);
    const hour = intBetween(rng, startHour + 1, endHour);
    const c0 = colOf(t);
    const reach = hour - startHour;
    const opts = columns.map((_, i2) => i2).filter((i2) => Math.abs(i2 - c0) <= Math.min(2, reach));
    const tc = pick(opts, rng);
    pins.push({ thread: t, place: columns[tc] as PlaceId, hour });
  }
  level.pins = pins;
  level.beads = beads;

  // ───── Gradi ─────
  if (spec.gradi.includes('nodoInPiu')) {
    const used = new Set((level.rancor ?? []).flat());
    const list = named().filter((t) => !used.has(t));
    if (list.length >= 2) {
      const a = list[0] as ThreadId;
      const b = list[1] as ThreadId;
      level.rancor = [...(level.rancor ?? []), [a, b]];
      if (!level.rules.includes('rancore')) level.rules.push('rancore');
    }
  }
  if (spec.gradi.includes('neroInPiu')) {
    if (!level.nero) {
      level.threads.push({ id: 'livia', kind: 'nero', character: 'livia' });
      level.nero = { thread: 'livia', enter: { hour: Math.min(endHour - 1, startHour + 2), side: 'faro' }, agenda: [{ follow: pick(named(), rng) }] };
      if (!level.rules.includes('nero')) level.rules.push('nero');
    } else {
      const next = named().find((t) => !level.nero?.agenda.some((a) => 'follow' in a && a.follow === t));
      if (next) level.nero.agenda.push({ follow: next });
    }
  }
  level.goals = goals;
  return { level, goals };
}

interface Verdict {
  ok: boolean;
  solvable: boolean;
  min: number;
  optimalCount: number;
  /**
   * Fin dove è arrivato il filtro: 0 irrisolvibile, 1 minimo fuori dall'intervallo,
   * 2 troppe soluzioni ottime, 3 il giocatore avido ce la fa, 4 la regola non serve,
   * 5 superato. Serve a scegliere il candidato migliore se nessuno passa.
   */
  stage: number;
}

/** Filtro di qualità (GDD 8.3). Imposta la matassa del livello se passa. */
export function qualityCheck(spec: GenSpec, built: Built): Verdict {
  const { level, goals } = built;
  const ctx = createContext(level, {});
  const [lo, hi] = minRange(spec.columns, effectiveRows(spec));
  const r = solveInternal({ level, ctx, goals, matassa: hi, countOptimal: true, maxStates: GEN_MAX_STATES });
  if (r.status !== 'ok' || r.incroci === undefined) return { ok: false, solvable: false, min: -1, optimalCount: 0, stage: 0 };
  const min = r.incroci;
  const count = r.optimalCount ?? 0;
  const fail = (stage: number): Verdict => ({ ok: false, solvable: true, min, optimalCount: count, stage });
  if (min < lo) return fail(1);
  if (count > MAX_OPTIMAL) return fail(2);
  const matassa = min + (spec.gradi.includes('matassaEsatta') ? 0 : 1);
  if (greedyPlay(level, ctx, goals, matassa).solved) return fail(3);
  // La regola del giorno serve davvero?
  const without = solveInternal({ level, ctx, goals, matassa: hi, maxStates: GEN_MAX_STATES }, { disable: [spec.rule] });
  if (without.status === 'limite') return fail(4);
  if (without.status === 'ok' && without.rows) {
    const check: LevelDef = { ...level, matassa: hi };
    const sim = simulateAndEvaluate(check, ctx, without.rows, goals);
    if (sim.allOk && (without.incroci ?? 0) >= min) return fail(4);
  }
  level.matassa = matassa;
  return { ok: true, solvable: true, min, optimalCount: count, stage: 5 };
}

interface FallbackEntry {
  rule: RuleId;
  columns: number;
  rows: number;
  seed: string;
}

function fallbackEntries(): FallbackEntry[] {
  const d = fallbackData as unknown as { entries?: FallbackEntry[] };
  return Array.isArray(d.entries) ? d.entries : [];
}

/** Livello da un seme di riserva già verificato (stessa regola e dimensioni del giorno). */
function fromFallback(spec: GenSpec, tries: number): GenResult | null {
  if (!isDateSeed(spec.seed)) return null;
  const list = fallbackEntries().filter((e) => e.rule === spec.rule && e.columns === spec.columns && e.rows === spec.rows);
  if (list.length === 0) return null;
  const e = list[dayOfYear(spec.seed) % list.length] as FallbackEntry;
  const built = buildCandidate({ ...spec, gradi: [] }, e.seed);
  const v = qualityCheck({ ...spec, gradi: [] }, built);
  if (!v.solvable) return null;
  if (!v.ok) {
    const ctx = createContext(built.level, {});
    const r = solveInternal({ level: built.level, ctx, goals: built.goals, matassa: 40, countOptimal: true });
    if (r.status !== 'ok' || r.incroci === undefined) return null;
    built.level.matassa = r.incroci + 1;
    return finish(spec, built, r.incroci, r.optimalCount ?? 0, tries, e.seed, true);
  }
  return finish(spec, built, v.min, v.optimalCount, tries, e.seed, true);
}

function finish(spec: GenSpec, built: Built, min: number, optimalCount: number, tries: number, seedUsed: string, fallback: boolean): GenResult {
  const level = built.level;
  level.id = isDateSeed(spec.seed) ? `day-${spec.seed}` : `lib-${spec.seed}${spec.gradi.length ? `~${[...spec.gradi].sort().join('+')}` : ''}`;
  return { level, min, optimalCount, tries, seedUsed, fromFallback: fallback };
}

/** Genera il livello per la specifica (deterministico). */
export function generate(spec: GenSpec): GenResult {
  // Se nessun seme passa il filtro: il candidato che è arrivato più avanti nel filtro
  // (a parità, il primo trovato), così il ripiego è comunque un buon merletto.
  let best: { built: Built; min: number; count: number; seed: string; stage: number } | null = null;
  for (let k = 0; k < GEN_TRIES; k++) {
    const seedK = `${spec.seed}#${k}`;
    const built = buildCandidate(spec, seedK);
    const v = qualityCheck(spec, built);
    if (v.ok) return finish(spec, built, v.min, v.optimalCount, k + 1, seedK, false);
    if (v.solvable && (!best || v.stage > best.stage)) best = { built, min: v.min, count: v.optimalCount, seed: seedK, stage: v.stage };
  }
  const fb = fromFallback(spec, GEN_TRIES);
  if (fb) return fb;
  if (best) {
    best.built.level.matassa = best.min + (spec.gradi.includes('matassaEsatta') ? 0 : 1);
    return finish(spec, best.built, best.min, best.count, GEN_TRIES, best.seed, true);
  }
  throw new Error(`generate: no solvable level for seed "${spec.seed}"`);
}

export type { Built as GeneratedCandidate };
