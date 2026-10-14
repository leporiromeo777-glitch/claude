/**
 * L'alba: "il giorno accade" (GDD 4.2, 5.9).
 *
 * Candidate:
 * - le vignette scritte per la giornata (`level.dawn.candidates`) con `when` vera;
 * - le battute generiche (`lines.json`) dei personaggi coinvolti negli eventi dell'ultima
 *   notte (incontro, consegna, voce copiata, segreto letto, stranezza, nodo, cura), più
 *   quelle "di riserva" dei personaggi presenti;
 * - il quadro del fallimento per un bigliettino anonimo attribuito alla persona sbagliata.
 *
 * Selezione (normativa): candidate valide ordinate per priorità (storia 100, richiesta
 * fallita 80, soddisfatta 60, stranezza 50, generica 10; a parità prima le scritte, poi
 * le battute sugli eventi, poi quelle di riserva, poi l'ordine dei dati); si scarta una
 * vignetta dello stesso personaggio della precedente e una già mostrata negli ultimi
 * 3 giorni (salvo priorità ≥ 80). Se ne mostrano al massimo 3.
 */
import type {
  CampaignState,
  CharacterId,
  ContentDB,
  Hour,
  Knowledge,
  LaceEvent,
  LevelDef,
  LineDef,
  NightOutcome,
  PlaceId,
  ThreadId,
  VignetteDef,
} from '../core/types';
import { evalStory } from './story';
import { hasForgotten } from './memoria';
import type { VignetteView } from './types';

export const DAWN_MAX = 3;
export const DAWN_RECENT_DAYS = 3;
export const DAWN_KEEP_PRIORITY = 80;
/** Priorità del quadro del fallimento costruito dalla campagna (autore sbagliato). */
export const PRIORITY_FAILED = 80;
export const PRIORITY_GENERIC = 10;

/** Personaggi che hanno una figurina (GDD 12.5); gli altri usano quella anonima. */
export const FIGURINE_IDS: readonly CharacterId[] = ['teresa', 'marta', 'piero', 'gino', 'bepi', 'nina', 'zeno', 'lunardi', 'livia', 'ada'];

export interface DawnCandidate {
  view: VignetteView;
  priority: number;
  /** 0 = scritta per la giornata, 1 = battuta su un evento, 2 = battuta di riserva. */
  rank: number;
  order: number;
}

/** Personaggio principale di una vignetta: il primo che parla, o la prima figura. */
export function vignetteWho(v: Pick<VignetteDef, 'lines' | 'figures'>): CharacterId | null {
  for (const l of v.lines) if (l.speaker !== 'narratore') return l.speaker;
  const f = v.figures.find((x) => x.character !== 'ada') ?? v.figures[0];
  return f?.character ?? null;
}

export function toView(v: VignetteDef): VignetteView {
  return { ...v, figures: v.figures.map((f) => ({ ...f })), lines: v.lines.map((l) => ({ ...l })), who: vignetteWho(v) };
}

/**
 * Selezione dell'alba (funzione pura). `shown` sono le vignette già mostrate con il
 * giorno (indice della giornata) in cui sono comparse; `day` è la giornata di oggi.
 */
export function selectDawn(cands: readonly DawnCandidate[], shown: readonly { id: string; day: number }[], day: number, max = DAWN_MAX): VignetteView[] {
  const sorted = [...cands].sort((a, b) => b.priority - a.priority || a.rank - b.rank || a.order - b.order);
  const out: VignetteView[] = [];
  const ids = new Set<string>();
  let lastWho: CharacterId | null = null;
  for (const c of sorted) {
    if (out.length >= max) break;
    const v = c.view;
    if (ids.has(v.id)) continue;
    if (c.priority < DAWN_KEEP_PRIORITY && shown.some((x) => x.id === v.id && day - x.day <= DAWN_RECENT_DAYS)) continue;
    const who = v.who === undefined ? vignetteWho(v) : v.who;
    if (who !== null && who === lastWho) continue;
    out.push(v);
    ids.add(v.id);
    lastWho = who;
  }
  return out;
}

// ───────── Candidate ─────────

type Db = Pick<ContentDB, 'levels' | 'lines' | 'characters' | 'diary' | 'balance' | 'notes'>;

function characterOf(level: LevelDef, t: ThreadId): CharacterId | null {
  const def = level.threads.find((x) => x.id === t);
  if (def) return def.kind === 'lino' ? null : (def.character ?? null);
  return null;
}

function lightFor(hour: Hour): 'alba' | 'giorno' | 'notte' {
  if (hour <= 7) return 'alba';
  if (hour >= 19) return 'notte';
  return 'giorno';
}

/** Luogo di un filo a una certa riga della notte (o dove ha finito la giornata). */
function placeAt(level: LevelDef, outcome: NightOutcome, t: ThreadId, row: number): PlaceId {
  const st = outcome.timeline[Math.min(row + 1, outcome.timeline.length - 1)] ?? outcome.timeline[outcome.timeline.length - 1];
  const col = st ? st.pos.indexOf(t) : -1;
  if (col >= 0) return level.columns[col] ?? level.columns[0] ?? 'piazza';
  const last = outcome.timeline[outcome.timeline.length - 1];
  const c2 = last ? last.pos.indexOf(t) : -1;
  return level.columns[c2 >= 0 ? c2 : 0] ?? 'piazza';
}

interface Involvement {
  row: number;
  other: CharacterId | null;
}

/** Dove (riga) e con chi un personaggio è coinvolto in un evento del tipo della battuta. */
function involvement(line: LineDef, level: LevelDef, outcome: NightOutcome, db: Db): Involvement | null {
  const me = line.character;
  const ch = (t: ThreadId): CharacterId | null => characterOf(level, t);
  const rows = outcome.events ?? [];
  for (let r = 0; r < rows.length; r++) {
    const evs = rows[r] ?? [];
    for (const e of evs) {
      const hit = matchEvent(line.event, e, me, evs, ch);
      if (!hit) continue;
      if (line.with && hit.other !== line.with) continue;
      return { row: r, other: hit.other };
    }
  }
  if (line.event === 'stranezza') {
    const quirks = db.characters.get(me)?.quirks ?? [];
    if (outcome.discoveredQuirks?.some((q) => quirks.includes(q)) && !line.with) return { row: Math.max(0, rows.length - 1), other: null };
    // Il «No.» di Marta sotto Teresa è un rifiuto, non un evento della notte: vale la scoperta.
    if (line.with && outcome.discoveredQuirks?.some((q) => quirks.includes(q))) {
      const present = level.threads.some((t) => t.character === line.with);
      if (present) return { row: Math.max(0, rows.length - 1), other: line.with };
    }
  }
  return null;
}

function matchEvent(kind: LineDef['event'], e: LaceEvent, me: CharacterId, row: readonly LaceEvent[], ch: (t: ThreadId) => CharacterId | null): { other: CharacterId | null } | null {
  switch (kind) {
    case 'incontro':
      if (e.k !== 'incontro') return null;
      if (ch(e.a) === me) return { other: ch(e.b) };
      if (ch(e.b) === me) return { other: ch(e.a) };
      return null;
    case 'nodo':
      if (e.k !== 'nodo') return null;
      if (ch(e.a) === me) return { other: ch(e.b) };
      if (ch(e.b) === me) return { other: ch(e.a) };
      return null;
    case 'consegna': {
      if (e.k !== 'consegna') return null;
      if (ch(e.to) === me) return { other: null };
      const p = row.find((x) => x.k === 'passa' && x.bead === e.bead && x.to === e.to);
      if (p && p.k === 'passa' && ch(p.from) === me) return { other: ch(e.to) };
      return null;
    }
    case 'copia':
      if (e.k !== 'copia') return null;
      if (ch(e.from) === me) return { other: ch(e.to) };
      if (ch(e.to) === me) return { other: ch(e.from) };
      return null;
    case 'legge':
      if (e.k !== 'legge') return null;
      return ch(e.who) === me ? { other: null } : null;
    case 'cura':
      if (e.k !== 'cura') return null;
      if (ch(e.who) === me) return { other: ch(e.by) };
      if (ch(e.by) === me) return { other: ch(e.who) };
      return null;
    case 'stranezza':
      if (e.k !== 'stranezza') return null;
      return ch(e.thread) === me ? { other: null } : null;
    default:
      return null;
  }
}

function lineView(line: LineDef, level: LevelDef, outcome: NightOutcome | null, inv: Involvement | null): VignetteView {
  const me = line.character;
  const thread = level.threads.find((t) => t.character === me)?.id ?? me;
  const row = inv?.row ?? Math.max(0, (outcome?.events?.length ?? 1) - 1);
  const place = outcome ? placeAt(level, outcome, thread, row) : (level.columns[0] ?? 'piazza');
  const hour = level.startHour + row + 1;
  const partner = inv?.other && inv.other !== me && FIGURINE_IDS.includes(inv.other) && line.with ? inv.other : null;
  const figures: VignetteView['figures'] = partner
    ? [
        { character: me, pose: 'ferma', x: 0.36 },
        { character: partner, pose: 'ferma', x: 0.64, flip: true },
      ]
    : [{ character: me, pose: line.event === 'consegna' ? 'porge' : 'ferma', x: 0.5 }];
  const l: VignetteView['lines'][number] = { speaker: me, textKey: line.textKey };
  if (line.forgetKey) l.forgetKey = line.forgetKey;
  return { id: `line:${line.id}`, priority: line.priority ?? PRIORITY_GENERIC, background: `dio/${place}/${lightFor(hour)}`, figures, lines: [l], who: me };
}

export interface DawnInput {
  level: LevelDef;
  outcome: NightOutcome | null;
  state: CampaignState;
  knowledge: Knowledge;
  db: Db;
  /** Bigliettini anonimi attribuiti alla persona sbagliata: il vero autore resta deluso. */
  wrongGuesses?: { noteId: string; author: CharacterId; guess: CharacterId }[];
}

/** Tutte le candidate valide della giornata. */
export function dawnCandidates(input: DawnInput): DawnCandidate[] {
  const { level, outcome, state, knowledge, db } = input;
  const o = { db };
  const out: DawnCandidate[] = [];
  let order = 0;
  for (const v of level.dawn?.candidates ?? []) {
    let ok = true;
    try {
      ok = !v.when || evalStory(v.when, state, knowledge, o);
    } catch {
      ok = false;
    }
    if (ok) out.push({ view: toView(v), priority: v.priority, rank: 0, order: order++ });
  }
  for (const w of input.wrongGuesses ?? []) {
    const thread = level.threads.find((t) => t.character === w.author)?.id ?? w.author;
    const place = outcome ? placeAt(level, outcome, thread, Math.max(0, outcome.events.length - 1)) : (level.columns[0] ?? 'piazza');
    out.push({
      view: {
        id: `delusione:${w.noteId}`,
        priority: PRIORITY_FAILED,
        background: `dio/${place}/giorno`,
        figures: [{ character: w.author, pose: 'ferma', x: 0.5 }],
        lines: [{ speaker: 'narratore', textKey: 'campaign.alba.delusione', params: { autore: `[[${w.author}]]`, indovinato: `[[${w.guess}]]` } }],
        who: w.author,
      },
      priority: PRIORITY_FAILED,
      rank: 0,
      order: order++,
    });
  }
  const present = new Set<CharacterId>();
  for (const t of level.threads) if (t.kind !== 'lino' && t.character) present.add(t.character);
  for (const line of db.lines) {
    if (!present.has(line.character)) continue;
    let ok = true;
    try {
      ok = !line.when || evalStory(line.when, state, knowledge, o);
    } catch {
      ok = false;
    }
    if (!ok) continue;
    if (line.event === 'riserva') {
      out.push({ view: lineView(line, level, outcome, null), priority: line.priority ?? PRIORITY_GENERIC, rank: 2, order: order++ });
      continue;
    }
    if (!outcome) continue;
    const inv = involvement(line, level, outcome, db);
    if (!inv) continue;
    out.push({ view: lineView(line, level, outcome, inv), priority: line.priority ?? PRIORITY_GENERIC, rank: 1, order: order++ });
  }
  return out;
}

/**
 * Applica le varianti per chi ha dimenticato Ada: testo `forgetKey` per chi parla e
 * figurina di Ada grezza se qualcuno nella vignetta l'ha dimenticata.
 */
export function resolveForgotten(v: VignetteView, state: Pick<CampaignState, 'memoria'>, db?: Pick<ContentDB, 'balance'>): VignetteView {
  const m = db?.balance?.memoria;
  const forgot = (c: CharacterId): boolean => hasForgotten(state, c, m);
  const lines = v.lines.map((l) => {
    if (l.speaker !== 'narratore' && l.forgetKey && forgot(l.speaker)) return { ...l, textKey: l.forgetKey };
    return { ...l };
  });
  const others = new Set<CharacterId>();
  for (const f of v.figures) if (f.character !== 'ada') others.add(f.character);
  for (const l of v.lines) if (l.speaker !== 'narratore' && l.speaker !== 'ada') others.add(l.speaker);
  const grezza = v.figures.some((f) => f.character === 'ada') && [...others].some(forgot);
  return { ...v, lines, grezza };
}

/** Le vignette dell'alba di oggi (al massimo 3), già con le varianti di chi ha dimenticato. */
export function buildDawn(input: DawnInput, day: number): VignetteView[] {
  const picked = selectDawn(dawnCandidates(input), input.state.shownLines ?? [], day);
  return picked.map((v) => resolveForgotten(v, input.state, input.db));
}
