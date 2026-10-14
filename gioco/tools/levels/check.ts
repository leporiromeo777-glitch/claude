/**
 * `npm run levels:check` (ARCHITETTURA 15.2): verifica dei livelli con il solver
 * e scrittura dei `<id>.computed.json`.
 *
 * Per ogni livello di `src/content/levels` (o di `--dir <cartella>`):
 * - base (solo obiettivi obbligatori) risolvibile entro la matassa;
 * - ogni bigliettino con richiesta, da solo;
 * - tutte le combinazioni di `pins` bigliettini (spilli rossi della sera:
 *   campaign.json, poi balance.json, poi 2);
 * - un bigliettino o una combinazione impossibile (o oltre la matassa) è un
 *   errore, salvo che sia marcato `voluta`: il segno vive nel `.computed.json`
 *   (campo `voluta` della combinazione; per un bigliettino da solo, una
 *   combinazione con quel solo bigliettino) e si conserva da un'esecuzione
 *   all'altra; si aggiunge con `--voluta <livello>:<nota>+<nota>`;
 * - matassa ≥ minimo della combinazione designata (la più cara fra le
 *   combinazioni possibili non marcate `voluta`, o il bigliettino più caro, o la base);
 *   `matassaSuggerita` = quel minimo + margine dell'atto (atto 0: 2; atti 1-3: balance.json);
 * - livelli con occasioni (`autoweave.occasionSlots` e `allowedOccasions`):
 *   tutti i sottoinsiemi con al massimo `occasionSlots` occasioni → `occasionsSolution`
 *   (il più piccolo valido) e `occasionsSolutions` (quanti, fra 1 e 20);
 * - Archivio: il merletto registrato si riapplica senza violazioni e ogni
 *   strappo si può rammendare entro la matassa;
 * - scrive `<id>.computed.json` con `sourceHash` e `SOLVER_VERSION`.
 *
 * Opzioni: --dir <cartella>, --report (tabella), --only <id,id>, --no-write,
 * --voluta <livello>:<nota>+<nota> (ripetibile). Con `npm run levels:check --dir X`
 * npm passa la cartella come variabile npm_config_dir: si legge anche quella.
 * Codice d'uscita 1 se c'è almeno un errore.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Condition, ContentDB, Crossing, LaceState, LevelComputed, LevelDef, NoteId, OccasionDef, RowMoves } from '../../src/core/types';
import { buildContentDB } from '../../src/content/loader';
import { SOLVER_VERSION, applyRow, createContext, levelSourceHashFromDB, sameLace, simulate, solve } from '../../src/engine/index';
import type { LevelReportRow } from './report';
import { formatReport } from './report';

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = resolve(TOOL_DIR, '../../src/content/levels');
const META = /^(notes\..+|campaign|balance)\.json$/;

export interface CheckOptions {
  dir?: string;
  report?: boolean;
  write?: boolean;
  voluta?: string[];
  only?: string[];
  log?: (line: string) => void;
}

export interface LevelCheck {
  id: string;
  file: string;
  computed: LevelComputed | null;
  errors: string[];
  warnings: string[];
  row: LevelReportRow;
}

export interface CheckResult {
  levels: LevelCheck[];
  errors: number;
  report: string;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function isLevel(v: unknown): v is LevelDef {
  return !!v && typeof v === 'object' && !Array.isArray(v) && 'columns' in v && 'threads' in v && 'id' in v;
}

/** Livelli e metadati (bigliettini, campagna, bilanciamento) della cartella e della cartella madre. */
function loadDir(dir: string): { db: ContentDB; files: Map<string, string>; problems: string[] } {
  const files: Record<string, unknown> = {};
  const levelFiles = new Map<string, string>();
  const problems: string[] = [];
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith('.json') || f.endsWith('.computed.json')) continue;
    const path = join(dir, f);
    let data: unknown;
    try {
      data = readJson(path);
    } catch (err) {
      problems.push(`${f}: [forma] invalid JSON (${err instanceof Error ? err.message : String(err)})`);
      continue;
    }
    if (META.test(f)) files[`./${f}`] = data;
    else if (isLevel(data)) {
      files[`./levels/${f}`] = data;
      levelFiles.set(data.id, path);
    }
  }
  const parent = dirname(dir);
  for (const f of existsSync(parent) ? readdirSync(parent).sort() : []) {
    if (!META.test(f) || files[`./${f}`] !== undefined) continue;
    try {
      files[`./${f}`] = readJson(join(parent, f));
    } catch {
      problems.push(`${f}: [forma] invalid JSON`);
    }
  }
  const { db, problems: p2 } = buildContentDB(files);
  return { db, files: levelFiles, problems: [...problems, ...p2] };
}

function comboKey(notes: readonly NoteId[]): string {
  return [...notes].sort().join('+');
}

function* subsets<T>(list: readonly T[], k: number, start = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length === k) {
    yield [...acc];
    return;
  }
  for (let i = start; i < list.length; i++) {
    acc.push(list[i] as T);
    yield* subsets(list, k, i + 1, acc);
    acc.pop();
  }
}

function slackFor(db: ContentDB, act: number): number {
  if (act === 1 || act === 2 || act === 3) return db.balance.acts[String(act) as '1' | '2' | '3']?.slack ?? 2;
  return 2;
}

/** Tutte le righe possibili (accoppiamenti × versi) per W colonne. */
function allRows(W: number): Crossing[][] {
  const out: Crossing[][] = [];
  for (let mask = 0; mask < 1 << (W - 1); mask++) {
    if (mask & (mask << 1)) continue;
    const pairs: number[] = [];
    for (let p = 0; p < W - 1; p++) if (mask & (1 << p)) pairs.push(p);
    for (let v = 0; v < 1 << pairs.length; v++) out.push(pairs.map((p, i) => ({ pair: p, over: v & (1 << i) ? 'R' : 'L' })));
  }
  return out;
}

/** Archivio: riapplica il merletto registrato e conta i rammendi possibili di ogni strappo. */
function checkArchive(level: LevelDef, errors: string[], warnings: string[]): void {
  const a = level.archive;
  if (!a) return;
  const ctx = createContext(level, {});
  const where = `levels/${level.id}`;
  if (level.autoweave) {
    warnings.push(`${where}: [archive] autoweave archive: recorded lace not replayed (the mending is done with occasions)`);
    return;
  }
  // Il merletto originale non ha il limite della matassa del rammendo.
  const sim = simulate({ ...level, matassa: Number.MAX_SAFE_INTEGER }, ctx, a.recorded);
  if (!sim.ok) {
    const f = sim.failedAt;
    errors.push(`${where}: [archive] recorded lace refused at hour ${f?.hour ?? '?'}: ${(f?.violations ?? []).map((v) => v.code).join(', ')}`);
    return;
  }
  for (const hole of a.holes) {
    const i0 = hole.from - level.startHour - 1;
    const i1 = hole.to - level.startHour - 1;
    const before = sim.timeline[i0] as LaceState;
    const target = sim.timeline[i1 + 1] as LaceState;
    if (!before || !target) {
      errors.push(`${where}: [archive] hole ${hole.from}-${hole.to} outside the day`);
      continue;
    }
    const original = a.recorded.slice(i0, i1 + 1).reduce((n, r) => n + r.crossings.filter((c) => !c.forced).length, 0);
    const rows = allRows(level.columns.length);
    let found = 0;
    const walk = (s: LaceState, depth: number): void => {
      if (found > 999) return;
      if (s.hour === hole.to) {
        if (sameLace(s, target)) found++;
        return;
      }
      for (const r of rows) {
        const res = applyRow(level, s, r, ctx);
        if (res.ok) walk(res.state, depth + 1);
      }
    };
    walk({ ...before, usedMatassa: 0 }, 0);
    if (found === 0) errors.push(`${where}: [archive] hole ${hole.from}-${hole.to} cannot be mended`);
    if (level.matassa < original) warnings.push(`${where}: [archive] matassa ${level.matassa} is less than the original crossings in the hole (${original})`);
  }
}

/** Livelli con occasioni: sottoinsiemi di allowedOccasions con al massimo occasionSlots elementi. */
function checkOccasions(level: LevelDef, goals: Condition[], errors: string[]): { solution?: OccasionDef[]; count?: number; states: number } {
  const aw = level.autoweave;
  if (!aw?.occasionSlots || !aw.allowedOccasions) return { states: 0 };
  const where = `levels/${level.id}`;
  const allowed = aw.allowedOccasions;
  let count = 0;
  let solution: OccasionDef[] | undefined;
  let states = 0;
  for (let k = 0; k <= Math.min(aw.occasionSlots, allowed.length); k++) {
    for (const sub of subsets(allowed, k)) {
      const ctx = createContext(level, {}, { occasions: sub });
      const r = solve({ level, ctx, goals, matassa: Number.MAX_SAFE_INTEGER });
      states += r.states;
      if (r.status === 'ok') {
        count++;
        if (!solution) solution = sub.map((o) => ({ ...o }));
      }
    }
  }
  if (count < 1) errors.push(`${where}: [occasions] no set of at most ${aw.occasionSlots} occasions satisfies the goals`);
  else if (count > 20) errors.push(`${where}: [occasions] ${count} valid sets of occasions (at most 20: the puzzle is trivial)`);
  return { solution, count, states };
}

export function checkLevel(level: LevelDef, db: ContentDB, voluta: Set<string>, file: string): LevelCheck {
  const t0 = performance.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  const where = `levels/${level.id}`;
  const goals = level.goals ?? [];
  // Livelli con occasioni: la base è la giornata con l'insieme minimo di occasioni.
  const occ = checkOccasions(level, goals, errors);
  const ctx = createContext(level, {}, occ.solution ? { occasions: occ.solution } : undefined);
  const W = level.columns.length;
  const rows = level.endHour - level.startHour;
  const cap = rows * Math.floor(W / 2);
  let states = occ.states;
  let maxStates = 0;

  type Out = { incroci: number | null; trueMin: number | null; rows?: RowMoves[] };
  const solveWith = (extra: Condition[]): Out => {
    const r = solve({ level, ctx, goals: [...goals, ...extra] });
    states += r.states;
    maxStates = Math.max(maxStates, r.states);
    if (r.status === 'limite') warnings.push(`${where}: [solver] state limit reached (${r.states} states)`);
    if (r.status === 'ok' && r.incroci !== undefined) return { incroci: r.incroci, trueMin: r.incroci, rows: r.rows };
    // Impossibile entro la matassa: si cerca il minimo vero (per la matassa suggerita).
    const r2 = solve({ level, ctx, goals: [...goals, ...extra], matassa: Math.max(cap, level.matassa + 1) });
    states += r2.states;
    maxStates = Math.max(maxStates, r2.states);
    return { incroci: null, trueMin: r2.status === 'ok' && r2.incroci !== undefined ? r2.incroci : null };
  };

  const report: LevelReportRow = {
    id: level.id,
    base: null,
    notes: [],
    combos: [],
    matassa: level.matassa,
    suggerita: null,
    quieteMax: null,
    occasions: null,
    states: 0,
    maxStates: 0,
    ms: 0,
    errors: 0,
    warnings: 0,
  };
  const done = (computed: LevelComputed | null): LevelCheck => {
    report.states = states;
    report.maxStates = maxStates;
    report.ms = performance.now() - t0;
    report.errors = errors.length;
    report.warnings = warnings.length;
    return { id: level.id, file, computed, errors, warnings, row: report };
  };

  const base = solveWith([]);
  report.base = base.incroci;
  if (base.incroci === null) {
    errors.push(
      base.trueMin === null
        ? `${where}: [base] the day cannot be solved even without requests`
        : `${where}: [base] the day needs ${base.trueMin} crossings but matassa is ${level.matassa}`,
    );
    return done(null);
  }

  checkArchive(level, errors, warnings);
  report.occasions = occ.count ?? null;

  // Bigliettini con richiesta.
  const notes = (level.notes ?? []).map((id) => db.notes.get(id)).filter((n): n is NonNullable<typeof n> => !!n);
  for (const id of level.notes ?? []) if (!db.notes.has(id)) errors.push(`${where}: [notes] note "${id}" not found`);
  const withReq = notes.filter((n) => n.request !== undefined);
  const perNote: LevelComputed['perNote'] = {};
  const combos: LevelComputed['combos'] = [];
  let designated = base.incroci;
  for (const n of withReq) {
    const r = solveWith([n.request as Condition]);
    const isVoluta = voluta.has(comboKey([n.id]));
    perNote[n.id] = r.incroci === null ? { incroci: null } : { incroci: r.incroci, rows: r.rows };
    report.notes.push({ id: n.id, incroci: r.incroci, voluta: isVoluta });
    if (r.incroci === null) {
      if (isVoluta) combos.push({ notes: [n.id], incroci: null, voluta: true });
      else
        errors.push(
          r.trueMin === null
            ? `${where}: [notes] request of "${n.id}" is impossible (mark it voluta if intended)`
            : `${where}: [notes] request of "${n.id}" needs ${r.trueMin} crossings, matassa is ${level.matassa}`,
        );
    } else if (!isVoluta) designated = Math.max(designated, r.incroci);
    if (r.trueMin !== null && r.incroci === null && !isVoluta) designated = Math.max(designated, r.trueMin);
  }
  const pins = Math.min(withReq.length, Math.max(1, db.campaign.days.find((d) => d.id === level.id)?.pins ?? pinsFallback(db, level)));
  if (pins >= 2) {
    for (const sub of subsets(withReq, pins)) {
      const ids = sub.map((n) => n.id);
      const isVoluta = voluta.has(comboKey(ids));
      const r = solveWith(sub.map((n) => n.request as Condition));
      const entry: LevelComputed['combos'][number] = { notes: ids, incroci: r.incroci };
      if (r.rows) entry.rows = r.rows;
      if (isVoluta) entry.voluta = true;
      combos.push(entry);
      report.combos.push({ notes: ids, incroci: r.incroci, voluta: isVoluta });
      if (r.incroci === null && !isVoluta) {
        errors.push(
          r.trueMin === null
            ? `${where}: [combos] ${ids.join(' + ')} is impossible and not marked voluta`
            : `${where}: [combos] ${ids.join(' + ')} needs ${r.trueMin} crossings, matassa is ${level.matassa} (not marked voluta)`,
        );
        if (r.trueMin !== null) designated = Math.max(designated, r.trueMin);
      }
      if (r.incroci !== null && !isVoluta) designated = Math.max(designated, r.incroci);
    }
  }
  if (level.matassa < designated) errors.push(`${where}: [matassa] matassa ${level.matassa} is below the designated minimum ${designated}`);
  const suggested = designated + slackFor(db, level.act);
  report.suggerita = suggested;

  const q = solve({ level, ctx, goals, objective: 'maxQuiete' });
  states += q.states;
  maxStates = Math.max(maxStates, q.states);
  report.quieteMax = q.quiete ?? null;

  const computed: LevelComputed = {
    levelId: level.id,
    sourceHash: levelSourceHashFromDB(db, level.id) ?? '',
    solverVersion: SOLVER_VERSION,
    base: { incroci: base.incroci, rows: base.rows ?? [] },
    perNote,
    combos,
    matassaSuggerita: suggested,
    quieteMax: q.quiete ?? 0,
  };
  if (occ.solution) computed.occasionsSolution = occ.solution;
  if (occ.count !== undefined) computed.occasionsSolutions = occ.count;
  return done(computed);
}

function pinsFallback(db: ContentDB, level: LevelDef): number {
  if (level.act === 1 || level.act === 2 || level.act === 3) return db.balance.acts[String(level.act) as '1' | '2' | '3']?.pins ?? 2;
  return 2;
}

/** Segni `voluta` già presenti nel computed (combinazioni marcate). */
function previousVoluta(path: string): Set<string> {
  const out = new Set<string>();
  if (!existsSync(path)) return out;
  try {
    const c = readJson(path) as Partial<LevelComputed>;
    for (const x of c.combos ?? []) if (x.voluta) out.add(comboKey(x.notes));
  } catch {
    /* computed illeggibile: si rigenera */
  }
  return out;
}

export function runCheck(opts: CheckOptions = {}): CheckResult {
  const log = opts.log ?? ((s: string) => console.log(s));
  const dir = resolve(opts.dir ?? DEFAULT_DIR);
  if (!existsSync(dir)) {
    // Senza --dir e senza ancora contenuti non c'è niente da verificare; una cartella indicata e assente è un errore.
    log(opts.dir ? `levels:check: directory not found: ${dir}` : `levels:check: no levels yet (${dir} does not exist)`);
    return { levels: [], errors: opts.dir ? 1 : 0, report: '' };
  }
  const { db, files, problems } = loadDir(dir);
  let errors = 0;
  for (const p of problems) {
    log(`✗ ${p}`);
    errors++;
  }
  const levels: LevelCheck[] = [];
  const ids = [...db.levels.keys()].sort().filter((id) => !opts.only || opts.only.includes(id));
  const cliVoluta = opts.voluta ?? [];
  for (const id of ids) {
    const level = db.levels.get(id) as LevelDef;
    const file = files.get(id) ?? join(dir, `${id}.json`);
    const computedPath = join(dir, `${id}.computed.json`);
    const voluta = previousVoluta(computedPath);
    for (const v of cliVoluta) {
      const [lv, list] = v.includes(':') ? (v.split(':', 2) as [string, string]) : [null, v];
      if (lv !== null && lv !== id) continue;
      const notes = list.split('+').map((s) => s.trim()).filter(Boolean);
      if (lv === null && !notes.every((n) => (level.notes ?? []).includes(n))) continue;
      voluta.add(comboKey(notes));
    }
    const res = checkLevel(level, db, voluta, file);
    levels.push(res);
    for (const w of res.warnings) log(`! ${w}`);
    for (const e of res.errors) log(`✗ ${e}`);
    errors += res.errors.length;
    if (res.computed && opts.write !== false) writeFileSync(computedPath, `${JSON.stringify(res.computed, null, 2)}\n`);
    log(`${res.errors.length === 0 ? '✓' : '✗'} ${id} (${basename(file)}): base ${res.row.base ?? '—'}, ${res.row.states} states, ${Math.round(res.row.ms)} ms`);
  }
  const report = formatReport(levels.map((l) => l.row));
  if (opts.report) log(`\n${report}`);
  log(errors === 0 ? `levels:check: ${levels.length} levels OK` : `levels:check: ${errors} error(s)`);
  return { levels, errors, report };
}

function parseArgs(argv: string[]): CheckOptions {
  const opts: CheckOptions = { voluta: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    const next = (): string | undefined => argv[++i];
    if (a === '--dir') opts.dir = next();
    else if (a.startsWith('--dir=')) opts.dir = a.slice(6);
    else if (a === '--report') opts.report = true;
    else if (a === '--no-write') opts.write = false;
    else if (a === '--voluta') {
      const v = next();
      if (v) opts.voluta?.push(v);
    } else if (a.startsWith('--voluta=')) opts.voluta?.push(a.slice(9));
    else if (a === '--only') opts.only = (next() ?? '').split(',').filter(Boolean);
    else if (a.startsWith('--only=')) opts.only = a.slice(7).split(',').filter(Boolean);
    else if (!a.startsWith('-') && !opts.dir) opts.dir = a; // `npm run levels:check --dir X` passa X come argomento
  }
  // npm run levels:check --dir X --report: npm trasforma le opzioni in variabili npm_config_*.
  const env = process.env;
  if (!opts.dir && env.npm_config_dir && env.npm_config_dir !== 'true') opts.dir = env.npm_config_dir;
  if (!opts.report && env.npm_config_report !== undefined && env.npm_config_report !== '' && env.npm_config_report !== 'false') opts.report = true;
  return opts;
}

function isMain(): boolean {
  const entry = process.argv[1];
  return !!entry && resolve(entry) === fileURLToPath(import.meta.url);
}

if (isMain()) {
  const res = runCheck(parseArgs(process.argv.slice(2)));
  process.exitCode = res.errors > 0 ? 1 : 0;
}
