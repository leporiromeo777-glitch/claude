/**
 * La campagna giocata dai test (suite `campagna`, `prestazioni`, `layout`).
 *
 * Il «percorso d'oro» (ARCHITETTURA 15.2, GDD 17) è giocato come lo giocherebbe chi
 * conosce la storia: ogni sera si legge l'oggetto, si risponde ai bigliettini con la
 * risposta che svela un desiderio, si appuntano le richieste che portano al finale
 * vero (lettere di Livia liberate, Marta e Teresa riconciliate, desideri) purché
 * insieme siano risolvibili; di notte il tombolo tesse da solo la soluzione
 * (`night.autoplay()`); le albe si saltano; gli Archivi si aprono dalla cassapanca e
 * si rammendano. Le scelte vengono dai dati dei contenuti (src/content/notes.*.json),
 * letti qui in Node: nessuna scorciatoia sui flag.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { call, phase, scene, until, waitNight, waitScene, type Rec } from './game';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

interface Effect {
  setFlag?: string;
  value?: unknown;
  desire?: string;
  question?: string;
  state?: string;
  diary?: string;
  addFlag?: string;
}

export interface NoteData {
  id: string;
  day: string;
  author: string;
  request?: unknown;
  replies?: { id: 'R1' | 'R2'; effects?: Effect[] }[];
  onOk?: Effect[];
  onFail?: Effect[];
  onIgnore?: Effect[];
}

export interface CampaignDay {
  id: string;
  archiveAfter?: string;
}

let notesCache: Map<string, NoteData> | null = null;

/** Tutti i bigliettini dei contenuti (atti I, II e III). */
export function contentNotes(): Map<string, NoteData> {
  if (notesCache) return notesCache;
  const dir = join(ROOT, 'src/content');
  const map = new Map<string, NoteData>();
  for (const f of readdirSync(dir).filter((x) => /^notes\..+\.json$/.test(x)).sort()) {
    for (const n of JSON.parse(readFileSync(join(dir, f), 'utf8')) as NoteData[]) map.set(n.id, n);
  }
  notesCache = map;
  return map;
}

export function campaignDays(): CampaignDay[] {
  return (JSON.parse(readFileSync(join(ROOT, 'src/content/campaign.json'), 'utf8')) as { days: CampaignDay[] }).days;
}

/** Gli otto del cast i cui desideri servono al finale vero (GDD 6.6). */
export const CAST = ['teresa', 'marta', 'piero', 'gino', 'bepi', 'nina', 'zeno', 'lunardi'] as const;

interface Evening {
  levelId: string;
  noteIds: string[];
  accepted: string[];
  pinsLeft: number;
  anonymous: string[];
  objectSeen: boolean;
}

interface Knowledge {
  desires: string[];
  diary: string[];
  archive: Record<string, string>;
  questions: Record<string, string>;
}

const hasGoodFlag = (effects: Effect[] | undefined, flag: string, value: unknown): boolean => (effects ?? []).some((e) => e.setFlag === flag && e.value === value);

/** Quanto conviene appuntare un bigliettino sulla strada del finale vero. */
export function noteScore(n: NoteData, knownDesires: ReadonlySet<string>): number {
  if (!n.request) return -1;
  let s = 5;
  if (hasGoodFlag(n.onOk, 'lettereLivia', 'liberate')) s += 1000;
  if (hasGoodFlag(n.onOk, 'riconciliate', true)) s += 1000;
  if ((n.onIgnore ?? []).some((e) => e.setFlag === 'lettereLivia')) s += 500;
  for (const e of n.onOk ?? []) {
    if (e.desire && !knownDesires.has(e.desire)) s += 200;
    if (e.question) s += 20;
    if (e.setFlag) s += 2;
  }
  return s;
}

/** La risposta che svela un desiderio ancora ignoto (altrimenti null: non si risponde). */
export function bestReply(n: NoteData, knownDesires: ReadonlySet<string>): 'R1' | 'R2' | null {
  for (const r of n.replies ?? []) if ((r.effects ?? []).some((e) => e.desire && !knownDesires.has(e.desire))) return r.id;
  return null;
}

export interface DayLog {
  levelId: string;
  accepted: string[];
  replies: Record<string, string>;
  requests: { noteId: string; status: string }[];
}

export interface RowMovesLite {
  hour?: number;
  crossings: { pair: number; over: 'L' | 'R'; forced?: boolean }[];
}

interface ComputedLite {
  base?: { incroci: number | null; rows?: RowMovesLite[] };
  perNote?: Record<string, { incroci: number | null; rows?: RowMovesLite[] } | undefined>;
  combos?: { notes: string[]; incroci: number | null; rows?: RowMovesLite[] }[];
}

/**
 * La soluzione precalcolata (`.computed.json` di `npm run levels:check`, la stessa che usano
 * l'autoplay e i suggerimenti quando il Worker non fa in tempo) per un insieme di
 * bigliettini: `undefined` se non è stata calcolata, `null` se è impossibile.
 */
export async function precomputed(page: Page, levelId: string, noteIds: readonly string[]): Promise<RowMovesLite[] | null | undefined> {
  const c = await call<ComputedLite | null>(page, 'engine.computed', levelId);
  if (!c) return undefined;
  const pick = (r: { incroci: number | null; rows?: RowMovesLite[] } | undefined): RowMovesLite[] | null | undefined => (r === undefined ? undefined : r.incroci === null || r.incroci === undefined ? null : (r.rows ?? []));
  if (noteIds.length === 0) return pick(c.base);
  if (noteIds.length === 1) return pick(c.perNote?.[noteIds[0]!]);
  const key = [...noteIds].sort().join('|');
  return pick(c.combos?.find((x) => [...x.notes].sort().join('|') === key));
}

/**
 * Le righe di una soluzione: prima quella precalcolata, poi il solver nel browser
 * (`engine.solve`, che sui livelli grandi può fermarsi al limite: allora null).
 */
export async function solutionRows(page: Page, levelId: string, noteIds: readonly string[], flags?: Record<string, unknown>): Promise<RowMovesLite[] | null> {
  const pre = await precomputed(page, levelId, noteIds);
  if (pre !== undefined) return pre;
  const r = await call<{ status: string; rows?: RowMovesLite[] } | null>(page, 'engine.solve', levelId, [...noteIds], flags ? { flags } : {});
  return r?.status === 'ok' ? (r.rows ?? []) : null;
}

/**
 * Dopo la notte di un finale: il merletto finito resta sullo schermo con «Continua»
 * (`cp-finale-continua`, tranne il merletto chiuso che passa subito); poi la scena del finale.
 */
export async function toFinale(page: Page, ms = 20_000): Promise<boolean> {
  const cont = page.locator('[data-test="cp-finale-continua"]');
  const ready = await until(page, async () => (await scene(page)) === 'finale' || (await cont.isVisible().catch(() => false)), ms);
  if (!ready) return false;
  if ((await scene(page)) !== 'finale') await cont.click();
  return waitScene(page, 'finale', ms);
}

/** Sera: oggetto, risposte, spilli. Restituisce le scelte fatte. */
export async function planEvening(page: Page): Promise<Omit<DayLog, 'requests'>> {
  const notes = contentNotes();
  await call(page, 'campaign.objectSeen');
  const ev = await call<Evening>(page, 'campaign.evening');
  const state = await call<{ levelId: string; flags: Record<string, unknown> }>(page, 'campaign.state');
  const known = new Set((await call<Knowledge>(page, 'campaign.knowledge')).desires);
  const replies: Record<string, string> = {};
  for (const id of ev.noteIds) {
    const n = notes.get(id);
    if (!n) continue;
    const r = bestReply(n, known);
    if (!r) continue;
    const res = await call<{ ok: boolean }>(page, 'campaign.reply', id, r);
    if (res.ok) {
      replies[id] = r;
      for (const e of n.replies?.find((x) => x.id === r)?.effects ?? []) if (e.desire) known.add(e.desire);
    }
  }
  const candidates = ev.noteIds
    .map((id) => notes.get(id))
    .filter((n): n is NoteData => !!n && !!n.request)
    .sort((a, b) => noteScore(b, known) - noteScore(a, known));
  // La combinazione migliore che il solver sa tessere entro la matassa.
  let pick = candidates.slice(0, Math.max(0, ev.pinsLeft)).map((n) => n.id);
  const solvable = async (ids: string[]): Promise<boolean> => (ids.length === 0 ? true : (await solutionRows(page, state.levelId, ids, state.flags)) !== null);
  if (!(await solvable(pick))) {
    let best: string[] = [];
    const pool = candidates.map((n) => n.id);
    for (let i = 0; i < pool.length && best.length < ev.pinsLeft; i++) {
      const id = pool[i];
      if (id && (await solvable([...best, id]))) best = [...best, id];
    }
    pick = best;
  }
  if (pick.length > 0) {
    const guesses: Record<string, string> = {};
    for (const id of pick) if (ev.anonymous.includes(id)) guesses[id] = notes.get(id)?.author ?? '';
    await call(page, 'campaign.accept', pick, guesses);
  }
  return { levelId: ev.levelId, accepted: pick, replies };
}

/** La notte della campagna con il tombolo vero: attesa, autoplay, fine. */
export async function playNight(page: Page): Promise<boolean> {
  if (!(await waitNight(page))) return false;
  await call(page, 'night.autoplay');
  return until(page, async () => (await phase(page)) !== 'notte', 20_000);
}

/** Un merletto d'Archivio aperto dalla cassapanca e rammendato. */
export async function playArchive(page: Page, archiveId: string): Promise<boolean> {
  await waitScene(page, 'archivio');
  const btn = page.locator(`[data-test="cp-apri-${archiveId}"]`);
  if (await btn.isVisible().catch(() => false)) await btn.click();
  else await call(page, 'campaign.archive', archiveId);
  if (!(await waitNight(page))) return false;
  await call(page, 'night.autoplay');
  await until(page, async () => (await scene(page)) === 'archivio', 20_000);
  const k = await call<Knowledge>(page, 'campaign.knowledge');
  return k.archive[archiveId] === 'rammendato';
}

export interface GoldenResult {
  days: DayLog[];
  archives: Record<string, boolean>;
  reached: boolean;
}

/**
 * Dalla sera in corso fino alla scelta di g23 (o fino a `untilLevel`, alla sua sera).
 * `onDay` è chiamato dopo ogni notte (per esempio per misurare la memoria).
 */
export async function playGolden(page: Page, opts: { untilLevel?: string; maxDays?: number; onDay?: (d: DayLog) => Promise<void> } = {}): Promise<GoldenResult> {
  const days = campaignDays();
  const result: GoldenResult = { days: [], archives: {}, reached: false };
  let played = 0;
  for (let guard = 0; guard < 200; guard++) {
    const ph = await phase(page);
    const st = await call<{ levelId: string } | null>(page, 'campaign.state');
    if (ph === 'scelta' || ph === null) break;
    if (opts.untilLevel && ph === 'sera' && st?.levelId === opts.untilLevel) break;
    if (opts.maxDays !== undefined && played >= opts.maxDays && ph === 'sera') break;
    if (ph === 'sera') {
      await waitScene(page, 'sera');
      const plan = await planEvening(page);
      await call(page, 'campaign.toNight');
      if (!(await playNight(page))) throw new Error(`notte di ${plan.levelId} non conclusa`);
      const report = await call<{ requests: { noteId: string; status: string }[] } | null>(page, 'campaign.report');
      const log: DayLog = { ...plan, requests: (report?.requests ?? []).map((r) => ({ noteId: r.noteId, status: r.status })) };
      result.days.push(log);
      played++;
      if (opts.onDay) await opts.onDay(log);
    } else if (ph === 'notte') {
      await playNight(page);
    } else if (ph === 'alba') {
      await waitScene(page, 'alba');
      await call(page, 'campaign.skipDawn');
      await until(page, async () => (await phase(page)) !== 'alba');
    } else if (ph === 'bilancio') {
      await waitScene(page, 'bilancio');
      await call(page, 'campaign.next');
      await until(page, async () => (await phase(page)) !== 'bilancio');
    } else if (ph === 'archivio') {
      const arc = days.find((d) => d.id === st?.levelId)?.archiveAfter ?? (await call<Rec | null>(page, 'campaign.state'))?.archiveOpen;
      if (typeof arc === 'string' && result.archives[arc] === undefined) {
        result.archives[arc] = await playArchive(page, arc);
        const sk = page.locator('[data-test="cp-vignetta-salta"]');
        if (await sk.isVisible().catch(() => false)) await sk.click();
      }
      await call(page, 'campaign.next');
      await until(page, async () => (await phase(page)) !== 'archivio');
    } else {
      throw new Error(`fase inattesa della campagna: ${ph}`);
    }
  }
  const final = await call<{ phase: string; levelId: string } | null>(page, 'campaign.state');
  result.reached = final?.phase === 'scelta' && final.levelId === 'g23';
  return result;
}
