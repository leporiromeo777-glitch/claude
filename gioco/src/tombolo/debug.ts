/**
 * `__GAME__.night` (ARCHITETTURA 15.1): stato della notte e comandi, gli stessi
 * dei gesti e dei tasti, più `layout()` con i rettangoli in px CSS (fusi, righe,
 * pulsanti) per trascinare davvero nei test.
 *
 *   state()                 righe, bozza, ora, timeline, richieste e loro stato, messaggi
 *   cross(pair, over)       incrocio nella riga corrente (Violation o null)
 *   flip(pair) remove(pair) fix() undo() rewind(hour) setNome(thread) drop(noteId)
 *   autoplay(rows?, ms?)    righe date o soluzione per le richieste accettate
 *   hint(tier)              suggerimento (Promise)
 *   name(thread, ch)        Archivio: nome di un filo sbiadito
 *   occasions(list) run()   occasioni e "Lascia accadere"
 *   move(dir)               filo controllato (−1, 0, 1 o 'left' | 'stay' | 'right')
 *   layout()                rettangoli in px CSS
 * In più: start(opts), resume(), echo(hour, pair), close(), skip(), retry(),
 *   outcome(), png(levelId?, rows?).
 */
import type { AcceptedRequest, CharacterId, Condition, GradoId, HintTier, LevelDef, NightOrigin, NightParams, NoteDef, OccasionDef, RowMoves, Services, Side } from '../core/types';
import { activeNight } from './active';
import { resolveLevel, resumeNight } from './resume';
import { spartitoParams } from './modes/replay';
import { defaultMode } from './modes/autoweave';
import { renderLacePng } from './export';
import { rowBottom, rowTop } from './layout';
import { threadName } from './text';

const fixtureNotes = import.meta.glob('../engine/fixtures/notes.fixtures.json', { import: 'default' });
const fixtureFiles = import.meta.glob('../engine/fixtures/*.json', { import: 'default' });

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function domBox(node: Element | null): Box | null {
  if (!node || !(node as HTMLElement).isConnected || (node as HTMLElement).hidden) return null;
  const r = node.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
}

export interface StartOptions {
  level?: string | LevelDef;
  /** Livello di prova del motore (src/engine/fixtures/<nome>.json), anche se i contenuti hanno lo stesso id. */
  fixture?: string;
  mode?: NightParams['mode'];
  origin?: NightOrigin;
  accepted?: (string | AcceptedRequest)[];
  flags?: NightParams['flags'];
  goals?: Condition[];
  needsNome?: boolean;
  gradi?: GradoId[];
  replay?: RowMoves[] | string;
  replaySpeedMs?: number;
}

async function noteById(s: Services, id: string): Promise<NoteDef | null> {
  const n = s.content.notes.get(id);
  if (n) return n;
  const load = fixtureNotes['../engine/fixtures/notes.fixtures.json'];
  if (!load) return null;
  const list = (await load()) as NoteDef[];
  return list.find((x) => x.id === id) ?? null;
}

/** NightParams da opzioni semplici (debug e test). */
export async function buildParams(s: Services, o: StartOptions): Promise<NightParams | null> {
  let level: LevelDef | null = null;
  if (o.fixture) {
    const load = fixtureFiles[`../engine/fixtures/${o.fixture}.json`];
    level = load ? ((await load()) as LevelDef) : null;
  } else if (typeof o.level === 'string') level = await resolveLevel(s, o.level);
  else level = o.level ?? null;
  if (!level || !Array.isArray(level.columns)) return null;
  const accepted: AcceptedRequest[] = [];
  for (const a of o.accepted ?? []) {
    if (typeof a !== 'string') {
      accepted.push(a);
      continue;
    }
    const n = await noteById(s, a);
    if (n?.request) accepted.push({ noteId: n.id, request: n.request, author: n.author });
  }
  if (typeof o.replay === 'string') {
    const p = spartitoParams(o.replay, level, { origin: o.origin ?? 'spartito', flags: o.flags ?? {}, ...(o.replaySpeedMs !== undefined ? { speedMs: o.replaySpeedMs } : {}) });
    return p;
  }
  const p: NightParams = {
    origin: o.origin ?? (level.kind === 'archivio' ? 'archivio' : level.kind === 'giornaliero' ? 'giornaliero' : 'libero'),
    mode: o.mode ?? (o.replay ? 'replay' : defaultMode(level)),
    level,
    flags: o.flags ?? {},
    accepted,
    goals: o.goals ?? [...(level.goals ?? [])],
    needsNome: !!o.needsNome,
  };
  if (o.gradi) p.gradi = o.gradi;
  if (o.replay) p.replay = o.replay;
  if (o.replaySpeedMs !== undefined) p.replaySpeedMs = o.replaySpeedMs;
  return p;
}

function dirOf(d: unknown): -1 | 0 | 1 {
  if (d === 'left' || d === 'L' || d === -1) return -1;
  if (d === 'right' || d === 'R' || d === 1) return 1;
  return 0;
}

export function registerNightDebug(s: Services): void {
  const need = () => activeNight();

  const state = (): unknown => {
    const c = need();
    if (!c) return { active: false, scene: s.scenes.current() };
    const se = c.session;
    const td = { i18n: s.i18n, content: s.content, level: se.level };
    const a = se.archive;
    return {
      active: true,
      levelId: se.level.id,
      mode: se.mode,
      origin: c.params.origin,
      hour: se.hour,
      done: se.done,
      completed: !!c.completed,
      rows: se.rows,
      draft: se.draft,
      forced: se.forced(),
      timeline: se.timeline,
      positions: se.state.pos,
      preview: se.done ? se.state.pos : se.preview().state.pos,
      requests: se.requestStatusFull().map((r) => ({ noteId: r.noteId, status: r.report.status, reasonKey: r.report.reasonKey ?? null, dropped: r.dropped })),
      goals: se.goalStatus(),
      dropped: se.dropped,
      nomeOn: se.nomeOn,
      needsNome: se.needsNome,
      matassa: se.matassa(),
      hintsUsed: se.hintsUsed,
      fantasmaUsed: se.fantasmaUsed,
      discoveredQuirks: se.discoveredQuirks,
      lastViolation: c.lastViolation,
      message: c.explain.key ? { key: c.explain.key, text: s.i18n.t(c.explain.key, c.explain.params) } : null,
      margin: { current: c.margin.current, shown: c.margin.shown },
      status: c.status.value,
      lastHint: c.lastHint,
      previewRow: c.previewRow,
      occasions: se.occasions,
      archive: a
        ? {
            names: a.names(),
            confirmed: a.confirmedList(),
            counter: a.counter(),
            named: a.allNamed(),
            mended: a.allMended(),
            holes: a.holes(),
            labels: Object.fromEntries(a.faded().map((t) => [t, threadName({ ...td, override: (id) => (a.isFaded(id) ? s.i18n.t('tombolo.filo.sbiaditoN', { n: (c.params.level.archive?.faded.indexOf(id) ?? 0) + 1 }) : null) }, t)])),
          }
        : null,
      outcome: c.completed,
      layout: c.layout.kind,
    };
  };

  const layout = (): unknown => {
    const c = need();
    if (!c) return null;
    const l = c.layout;
    const se = c.session;
    const start = se.level.startHour;
    const rows: { index: number; hour: number; y: number; h: number; kind: string }[] = [];
    for (let i = 0; i <= l.rows; i++) {
      const y = l.lace.y - c.scroll + rowTop(l, i);
      const h = rowBottom(l, i) - rowTop(l, i);
      if (y + h < l.lace.y || y > l.lace.y + l.lace.h) continue;
      rows.push({ index: i, hour: start + i, y: Math.round(y), h, kind: i === 0 ? 'apertura' : i < c.model.current ? 'fissata' : i === c.model.current ? 'corrente' : 'futura' });
    }
    const rig = c.renderer.rig;
    const spindles = c.model.hangPos.map((t, col) => {
      const st = rig.get(t);
      const x = st ? rig.xOf(st) : (l.colCx[col] ?? 0);
      return { col, thread: t, x: Math.round(l.colX[col] ?? 0), y: l.spindles.y, w: Math.round(l.colW), h: l.spindles.h, cx: Math.round(x), cy: Math.round(l.spindles.y + l.spindles.h / 2) };
    });
    const q = (sel: string): Box | null => domBox(c.root.querySelector(sel));
    const tokens = Array.from(c.root.querySelectorAll<HTMLElement>('[data-test^="tb-richiesta-"]')).map((e) => ({ noteId: (e.dataset.test ?? '').replace('tb-richiesta-', ''), rect: domBox(e) }));
    return {
      kind: l.kind,
      viewport: { w: l.cssW, h: l.cssH },
      center: l.center,
      left: l.left,
      right: l.right,
      rightCollapsed: l.rightCollapsed,
      hud: l.hud,
      header: l.header,
      lace: l.lace,
      requests: l.requests,
      spindleBand: l.spindles,
      actions: l.actions,
      lamp: l.lamp,
      colW: l.colW,
      rowH: l.rowH,
      scroll: Math.round(c.scroll),
      columns: l.colX.map((x, i) => ({ x: Math.round(x), w: Math.round(l.colW), cx: Math.round(l.colCx[i] ?? 0) })),
      rows,
      currentRow: rows.find((r) => r.kind === 'corrente') ?? null,
      spindles,
      buttons: {
        menu: q('[data-test="tb-menu"]'),
        undo: q('[data-test="tb-disfa"]'),
        fix: q('[data-test="tb-fissa"]'),
        notebook: q('[data-test="tb-taccuino"]'),
        lamp: q('[data-test="tb-lampada"]'),
        rewind: q('[data-test="tb-riavvolgi-qui"]'),
        rewindCancel: q('[data-test="tb-riavvolgi-annulla"]'),
      },
      tokens,
      panels: { left: q('[data-test="tb-pannello-sinistro"]'), right: q('[data-test="tb-pannello-destro"]') },
    };
  };

  s.debug.register('night', {
    state,
    layout,
    cross: (pair: number, over: Side) => need()?.cross(pair, over === 'R' ? 'R' : 'L', 'debug') ?? null,
    flip: (pair: number) => need()?.flipCrossing(pair) ?? null,
    remove: (pair: number) => {
      need()?.removeCrossing(pair);
      return state();
    },
    fix: () => need()?.fix() ?? null,
    main: () => {
      need()?.mainAction();
      return state();
    },
    undo: () => {
      need()?.undo();
      return state();
    },
    rewind: (hour: number) => need()?.rewind(hour) ?? false,
    previewRewind: (hour: number) => {
      const c = need();
      if (!c) return false;
      c.previewRewind(hour - c.session.level.startHour);
      return true;
    },
    setNome: (thread: string) => {
      need()?.setNome(thread);
      return need()?.session.nomeOn ?? null;
    },
    drop: (noteId: string) => {
      need()?.drop(noteId);
      return need()?.session.dropped ?? [];
    },
    autoplay: async (rows?: RowMoves[], msPerRow?: number) => {
      const c = need();
      if (!c) return null;
      return c.autoplay(rows, msPerRow ?? 0);
    },
    hint: async (tier?: HintTier) => {
      const c = need();
      if (!c) return null;
      return tier ? c.hint(tier) : c.nextHint();
    },
    name: (thread: string, character: string | null) => need()?.name(thread, character as CharacterId | null) ?? null,
    occasions: (list: OccasionDef[]) => need()?.setOccasions(list) ?? [],
    run: () => {
      need()?.run();
      return state();
    },
    skip: () => {
      need()?.skip();
      return state();
    },
    retry: () => {
      need()?.retry();
      return state();
    },
    move: (dir: unknown) => need()?.move(dirOf(dir)) ?? null,
    echo: (hour: number, pair: number) => need()?.echo(hour, pair) ?? null,
    close: () => need()?.finish() ?? null,
    outcome: () => need()?.completed ?? null,
    start: async (o: StartOptions) => {
      const p = await buildParams(s, o);
      if (!p) return { active: false, error: 'level' };
      await s.scenes.go('tombolo', p, { transition: 'none' });
      return state();
    },
    resume: async () => {
      const ok = await resumeNight(s);
      return ok;
    },
    png: async (levelId?: string, rows?: RowMoves[]) => {
      const c = need();
      const level = levelId ? await resolveLevel(s, levelId) : (c?.session.level ?? null);
      if (!level) return null;
      const blob = await renderLacePng(level, rows ?? c?.session.rows ?? [], c && c.session.level.id === level.id ? c.session.runFlags : {});
      return { type: blob.type, bytes: blob.size };
    },
  });
}
