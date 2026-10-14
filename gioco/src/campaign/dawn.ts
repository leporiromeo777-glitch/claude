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
 * Selezione (normativa, GDD 5.9 rivisto con D11 e C06):
 * 1. le vignette scritte di priorità ≥ 100 (culmini) escono tutte, nell'ordine dei dati,
 *    anche se parla lo stesso personaggio di seguito; il massimo sale a 4 solo per loro;
 * 2. una vignetta con `dopo: <id>` esce subito dopo quella (se anche la sua `when` è vera);
 *    se quella non è fra le candidate, esce come le altre;
 * 3. poi le altre vignette scritte (80, 60, 50…) per priorità, con le regole di sempre:
 *    niente stesso personaggio di seguito, niente vignette mostrate negli ultimi 3 giorni
 *    (salvo priorità ≥ 80);
 * 4. le battute generiche (eventi e riserva) solo se le scritte sono meno di 2, e mai in
 *    una giornata con un culmine; quelle di riserva solo se non c'è nessuna scritta.
 * Se ne mostrano al massimo 3 (4 con i culmini).
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
/** Con i culmini l'alba può arrivare a 4 vignette (D11). */
export const DAWN_MAX_CULMINI = 4;
/** Priorità da cui una vignetta scritta è un culmine (C06). */
export const PRIORITY_CULMINE = 100;
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
 * Selezione dell'alba (funzione pura, D11). `shown` sono le vignette già mostrate con il
 * giorno (indice della giornata) in cui sono comparse; `day` è la giornata di oggi.
 * Le candidate con `rank` 0 sono le vignette scritte (e il quadro della delusione),
 * 1 le battute sugli eventi, 2 quelle di riserva.
 */
export function selectDawn(cands: readonly DawnCandidate[], shown: readonly { id: string; day: number }[], day: number, max = DAWN_MAX): VignetteView[] {
  const written = cands.filter((c) => c.rank === 0);
  const followers = new Map<string, DawnCandidate[]>();
  for (const c of [...written].sort((a, b) => a.order - b.order)) {
    const anchor = c.view.dopo;
    if (!anchor || anchor === c.view.id) continue;
    const list = followers.get(anchor) ?? [];
    list.push(c);
    followers.set(anchor, list);
  }
  const free = (c: DawnCandidate): boolean => !c.view.dopo || !written.some((w) => w.view.id === c.view.dopo);
  const culmini = written.filter((c) => c.priority >= PRIORITY_CULMINE && free(c)).sort((a, b) => a.order - b.order);
  const chain = (c: DawnCandidate, seen: Set<string>): number => {
    if (seen.has(c.view.id)) return 0;
    seen.add(c.view.id);
    let n = 1;
    for (const f of followers.get(c.view.id) ?? []) n += chain(f, seen);
    return n;
  };
  const counted = new Set<string>();
  const needed = culmini.reduce((n, c) => n + chain(c, counted), 0);
  const cap = Math.max(max, Math.min(DAWN_MAX_CULMINI, needed));
  const out: VignetteView[] = [];
  const ids = new Set<string>();
  let lastWho: CharacterId | null = null;
  const whoOf = (v: VignetteView): CharacterId | null => (v.who === undefined ? vignetteWho(v) : v.who);
  const place = (c: DawnCandidate, limit: number): void => {
    if (out.length >= limit || ids.has(c.view.id)) return;
    out.push(c.view);
    ids.add(c.view.id);
    lastWho = whoOf(c.view);
    for (const f of followers.get(c.view.id) ?? []) place(f, limit);
  };
  const recent = (c: DawnCandidate): boolean => c.priority < DAWN_KEEP_PRIORITY && shown.some((x) => x.id === c.view.id && day - x.day <= DAWN_RECENT_DAYS);
  const byPriority = (a: DawnCandidate, b: DawnCandidate): number => b.priority - a.priority || a.rank - b.rank || a.order - b.order;
  // 1-2. I culmini, tutti, nell'ordine dei dati (con le vignette legate da `dopo`).
  for (const c of culmini) place(c, cap);
  // 3. Le altre vignette scritte, con le regole di sempre.
  for (const c of written.filter((x) => x.priority < PRIORITY_CULMINE && free(x)).sort(byPriority)) {
    if (out.length >= cap) break;
    if (ids.has(c.view.id) || recent(c)) continue;
    const who = whoOf(c.view);
    if (who !== null && who === lastWho) continue;
    place(c, cap);
  }
  // 4. Le battute generiche: solo con meno di 2 scritte e mai con un culmine.
  const writtenShown = out.length;
  if (culmini.length > 0 || writtenShown >= 2) return out;
  const pool = cands.filter((c) => c.rank === 1 || (c.rank >= 2 && writtenShown === 0)).sort(byPriority);
  for (const c of pool) {
    if (out.length >= max) break;
    if (ids.has(c.view.id) || recent(c)) continue;
    const who = whoOf(c.view);
    if (who !== null && who === lastWho) continue;
    place(c, max);
  }
  return out;
}

/**
 * Con un oggetto da consegnare all'alba (C04) la vignetta della consegna, cioè l'ultimo
 * culmine in cui compare chi consegna, chiude l'alba: subito dopo si legge l'oggetto.
 */
export function deliveryLast(views: readonly VignetteView[], by: CharacterId | null | undefined): VignetteView[] {
  if (!by) return [...views];
  let idx = -1;
  views.forEach((v, i) => {
    if (v.priority >= PRIORITY_CULMINE && features(v, by)) idx = i;
  });
  if (idx < 0 || idx === views.length - 1) return [...views];
  const out = views.filter((_, i) => i !== idx);
  const v = views[idx];
  if (v) out.push(v);
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
  /** Chi consegna l'oggetto dell'alba (C04): la sua vignetta chiude l'alba. */
  deliveredBy?: CharacterId | null;
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

/**
 * Le vignette dell'alba di oggi (al massimo 3, 4 con i culmini), già con le varianti di
 * chi ha dimenticato. Con `deliveredBy` la vignetta della consegna va in fondo (C04).
 */
export function buildDawn(input: DawnInput, day: number): VignetteView[] {
  const cands = dawnCandidates(input);
  const picked = deliveryLast(ensureDelivery(selectDawn(cands, input.state.shownLines ?? [], day), cands, input.deliveredBy), input.deliveredBy);
  return picked.map((v) => resolveForgotten(v, input.state, input.db));
}

/** Chi consegna l'oggetto compare nella vignetta (parla o è una figura). */
function features(v: Pick<VignetteView, 'lines' | 'figures'>, by: CharacterId): boolean {
  return v.lines.some((l) => l.speaker === by) || v.figures.some((f) => f.character === by);
}

/**
 * La vignetta della consegna è obbligatoria (C06): se la selezione l'ha lasciata fuori
 * (troppi culmini), prende il posto dell'ultima scelta.
 */
export function ensureDelivery(picked: readonly VignetteView[], cands: readonly DawnCandidate[], by: CharacterId | null | undefined): VignetteView[] {
  if (!by) return [...picked];
  if (picked.some((v) => v.priority >= PRIORITY_CULMINE && features(v, by))) return [...picked];
  const all = cands.filter((c) => c.rank === 0 && c.priority >= PRIORITY_CULMINE && features(c.view, by)).sort((a, b) => a.order - b.order);
  const last = all[all.length - 1];
  if (!last) return [...picked];
  const out = [...picked];
  if (out.length >= DAWN_MAX_CULMINI) out.pop();
  out.push(last.view);
  return out;
}
