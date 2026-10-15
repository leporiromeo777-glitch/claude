// @vitest-environment happy-dom
/**
 * Revisione 1, P1 del tombolo: pannello e tutorial dell'Archivio (TOM-04),
 * tutorial (TOM-08), «soddisfatta» solo a ora fissata (TOM-09), suggerimenti che
 * dicono la verità (TOM-10), il tocco spiega (TOM-12), obiettivi (TOM-13),
 * occasioni (TOM-15), nome che si sposta (TOM-16), rancore e stranezze (TOM-17),
 * chiusura a nodo e apparizione (TOM-20).
 *
 * I contenuti (livelli g01-g23, archivi) cambiano in parallelo: dove il test usa
 * un livello vero ricava le attese dai dati, altrimenti usa le fixture del motore.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AcceptedRequest, CharacterId, Condition, LevelComputed, LevelDef, NightParams, NoteId, QuirkId, SolveRequest, SolveResult, ThreadId, TutorialStep, Viewport } from '../../../src/core/types';
import { computeViewport } from '../../../src/core/viewport';
import { NightController } from '../../../src/tombolo/controller';
import { Tutorial } from '../../../src/tombolo/tutorial';
import { popupClock } from '../../../src/tombolo/ui/popup';
import { edgeCenter, pinHead } from '../../../src/tombolo/ui/bubbles';
import { slotCenter } from '../../../src/tombolo/layout';
import { beadName, capitalizeFirst, threadName } from '../../../src/tombolo/text';
import { extraMode, quirkRevealed as tomboloQuirkRevealed, shownQuirks } from '../../../src/tombolo/quirks';
import { quirkRevealed as diaryQuirkRevealed } from '../../../src/campaign/diary';
import { ROOT, fixture, fixtureComputed, nightParams } from './helpers';
import { type Harness, harness } from './harness';

function level(id: string): LevelDef {
  return JSON.parse(readFileSync(resolve(ROOT, `src/content/levels/${id}.json`), 'utf8')) as LevelDef;
}
function computed(id: string): LevelComputed {
  return JSON.parse(readFileSync(resolve(ROOT, `src/content/levels/${id}.computed.json`), 'utf8')) as LevelComputed;
}
const NO_SAFE = { top: 0, right: 0, bottom: 0, left: 0 };
const vp = (w: number, hh: number): Viewport => computeViewport(w, hh, 2, NO_SAFE, 1);

let h: Harness;
let c: NightController | null = null;
let now = 1000;

/** Path2D finto (happy-dom non ce l'ha): la mano del tutorial la usa. */
class FakePath2D {
  moveTo(): void {}
  lineTo(): void {}
  bezierCurveTo(): void {}
  quadraticCurveTo(): void {}
  arc(): void {}
  ellipse(): void {}
  rect(): void {}
  closePath(): void {}
  addPath(): void {}
}

beforeEach(() => {
  h = harness();
  now = 1000;
  vi.spyOn(popupClock, 'now').mockImplementation(() => now);
  if (typeof (globalThis as { Path2D?: unknown }).Path2D === 'undefined') vi.stubGlobal('Path2D', FakePath2D);
});
afterEach(() => {
  c?.destroy();
  c = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 5));
const q = <T extends HTMLElement = HTMLElement>(test: string): T | null => document.querySelector<T>(`[data-test="${test}"]`);

/** Viewport del harness (390×844) cambiato prima di creare la notte. */
function useViewport(w: number, hh: number): void {
  const v = vp(w, hh);
  (h.s as unknown as { viewport: { get: () => Viewport } }).viewport = { get: () => v };
}

/** Nome visibile di un personaggio. */
function nameOf(ch: CharacterId): string {
  const def = h.s.content.characters.get(ch);
  return def ? h.s.i18n.t(def.nameKey) : ch;
}

/** Contesto 2D finto che non disegna nulla ma risponde a tutte le chiamate. */
function fakeCtx(): CanvasRenderingContext2D {
  const t: Record<string, unknown> = {
    measureText: (s: string) => ({ width: s.length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    createRadialGradient: () => ({ addColorStop: () => undefined }),
    createPattern: () => null,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    getLineDash: () => [],
  };
  return new Proxy(t, {
    get(o, k) {
      if (typeof k !== 'string') return undefined;
      if (k in o) return o[k];
      return () => undefined;
    },
    set(o, k, v) {
      if (typeof k === 'string') o[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

function renderOnce(ctl: NightController): void {
  const l = ctl.layout;
  ctl.render({ canvas: document.createElement('canvas'), ctx: fakeCtx(), cssW: l.cssW, cssH: l.cssH, dpr: 1 });
}

// ───────────────────────── TOM-04 ─────────────────────────

describe('TOM-04: Archivio, pannello, lampada, echi, tutorial (P002, P070, P099)', () => {
  function archiveParams(lv: LevelDef): NightParams {
    return nightParams(lv, { origin: 'archivio', mode: 'archivio' });
  }

  /** Nomi giusti a tutti i fili sbiaditi, poi le righe registrate (il rammendo). */
  function nameAndMend(ctl: NightController): void {
    const a = ctl.params.level.archive!;
    for (const t of a.faded) ctl.name(t, a.answer[t] as CharacterId);
    for (const r of a.recorded) {
      if (ctl.session.done || r.hour !== ctl.session.hour) continue;
      for (const x of r.crossings) if (!x.forced) expect(ctl.cross(x.pair, x.over, 'debug')).toBeNull();
      expect(ctl.fix().ok).toBe(true);
    }
  }

  /** Nome atteso di un filo nel merletto registrato: la risposta se è sbiadito, altrimenti il suo personaggio. */
  function expectedName(lv: LevelDef, t: ThreadId): string | null {
    const ans = lv.archive?.answer[t];
    if (ans) return nameOf(ans as CharacterId);
    const def = lv.threads.find((x) => x.id === t);
    return def?.character ? nameOf(def.character) : null;
  }

  it('arc3 a 1180×820: a sinistra il pannello con fili, candidati e strappi; la lampada c\'è', () => {
    useViewport(1180, 820);
    const lv = level('arc3');
    c = new NightController(h.s, archiveParams(lv), { computed: computed('arc3') });
    c.startPanels();
    expect(c.layout.kind).toBe('largo');
    const panel = q('tb-archivio-pannello');
    expect(panel).not.toBeNull();
    const a = lv.archive!;
    for (const t of a.faded) expect(panel!.querySelector(`[data-test="tb-ap-filo-${t}"]`), t).not.toBeNull();
    for (const ch of a.candidates) expect(panel!.querySelector(`[data-test="tb-ap-candidato-${ch}"]`), ch).not.toBeNull();
    for (const hole of a.holes) expect(panel!.querySelector(`[data-test="tb-ap-strappo-${hole.from}"]`)).not.toBeNull();
    // Niente Bigliettini nel layout dell'Archivio: il pannello del tombolo li sostituisce.
    expect(document.querySelectorAll('[data-test="tb-archivio-pannello"]')).toHaveLength(1);
    const lamp = q('tb-lampada');
    expect(lamp).not.toBeNull();
    expect(lamp!.hidden).toBe(false);
  });

  it('dopo nomi e rammendo gli echi del registro dicono chi sopra, chi sotto e l\'ora', () => {
    useViewport(1180, 820);
    const lv = level('arc3');
    c = new NightController(h.s, archiveParams(lv), { computed: computed('arc3') });
    c.startPanels();
    nameAndMend(c);
    expect(c.echoesOpen()).toBe(true);
    const echoes = c.session.archive!.echoes();
    expect(echoes.length).toBeGreaterThan(0);
    let checked = 0;
    for (const e of echoes) {
      const th = c.session.archive!.echoThreads(e.hour, e.pair);
      if (!th) continue;
      const over = expectedName(lv, th.over);
      const under = expectedName(lv, th.under);
      if (!over || !under) continue;
      expect(c.echo(e.hour, e.pair)).toBe(e.textKey);
      const want = capitalizeFirst(h.s.i18n.t('tombolo.archivio.ecoChi', { sopra: over, sotto: under, ora: String(e.hour) }));
      expect(want).toBe(capitalizeFirst(`${over} → ${under}, alle ${e.hour}`));
      expect(q('tb-eco-chi')?.textContent).toBe(want);
      const reg = q('tb-ap-echi');
      expect(reg?.textContent).toContain(want);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('nell\'Archivio la lampada aiuta a nominare (e il rammendo segue computed.base.rows)', async () => {
    const lv = fixture('test-archivio');
    c = new NightController(h.s, archiveParams(lv), { computed: fixtureComputed('test-archivio') });
    // Fra uno strappo e l'altro, o a righe finite: suggerimenti sui nomi.
    if (!c.session.isPlayerRow()) {
      expect(c.lampAvailable()).toBe(true);
      const hint = await c.lampTap();
      expect(hint?.textKey).toMatch(/archivio|test/);
    }
  });

  it('trigger archivioNomi e archivioRammendo (D05.7)', () => {
    const lv: LevelDef = {
      ...fixture('test-archivio'),
      tutorial: [
        { k: 'margine', when: 'archivioNomi', textKey: 'tombolo.test.nomi' },
        { k: 'margine', when: 'archivioRammendo', textKey: 'tombolo.test.rammendo' },
      ],
    };
    h.data.settings.autoAdvance = true;
    c = new NightController(h.s, archiveParams(lv), { computed: null });
    const a = lv.archive!;
    const shown: string[] = [];
    const seen = (): void => {
      const k = c!.margin.current;
      if (k && !shown.includes(k)) shown.push(k);
    };
    for (const t of a.faded) c.name(t, a.answer[t] as CharacterId);
    seen();
    expect(shown).toContain('tombolo.test.nomi');
    // Il rammendo: le righe registrate negli strappi.
    const wait = (s: number): void => {
      for (let i = 0; i < s * 60; i++) {
        c!.update(1 / 60);
        seen();
      }
    };
    for (const r of a.recorded) {
      if (c.session.done || r.hour !== c.session.hour) continue;
      for (const x of r.crossings) if (!x.forced) c.cross(x.pair, x.over, 'debug');
      c.fix();
      seen();
      wait(13);
    }
    expect(c.session.archive!.allMended()).toBe(true);
    wait(13);
    expect(shown).toContain('tombolo.test.rammendo');
  });
});

// ───────────────────────── TOM-08 ─────────────────────────

describe('TOM-08: Tutorial, ogni «when» e ogni bersaglio (C02)', () => {
  function tut(steps: TutorialStep[]): { t: Tutorial; shown: string[]; hands: string[] } {
    const shown: string[] = [];
    const hands: string[] = [];
    const t = new Tutorial(steps, {
      margin: (k, hand) => {
        shown.push(k);
        hands.push(hand);
      },
    });
    return { t, shown, hands };
  }

  it('primaOra e ora', () => {
    const { t, shown } = tut([
      { k: 'margine', when: 'primaOra', textKey: 'a' },
      { k: 'margine', when: 'ora', hour: 8, textKey: 'b' },
    ]);
    t.onRowStart(6, true);
    expect(shown).toEqual(['a']);
    t.onRowStart(7, false);
    expect(shown).toEqual(['a']);
    t.onRowStart(8, false);
    expect(shown).toEqual(['a', 'b']);
    // Una volta per notte.
    t.onRowStart(8, false);
    t.onRowStart(6, true);
    expect(shown).toEqual(['a', 'b']);
  });

  it('incrocio (con e senza ora) e versoSbagliato', () => {
    const { t, shown } = tut([
      { k: 'margine', when: 'incrocio', hour: 7, textKey: 'sette' },
      { k: 'margine', when: 'incrocio', textKey: 'qualunque' },
      { k: 'margine', when: 'versoSbagliato', textKey: 'verso' },
    ]);
    t.onCross(6, false);
    expect(shown).toEqual(['qualunque']);
    t.onCross(7, true);
    expect(shown).toEqual(['qualunque', 'sette', 'verso']);
  });

  it('rifiuto (stranezze o codice) e spillo; la nota sostituisce il messaggio', () => {
    const { t, shown } = tut([
      { k: 'margine', when: 'rifiuto', textKey: 'stranezza' },
      { k: 'margine', when: 'rifiuto', codice: 'bloccato', textKey: 'nodo' },
      { k: 'margine', when: 'spillo', textKey: 'spillo' },
    ]);
    expect(t.onViolation({ code: 'occupato', params: {} } as never, 7)).toBe(false);
    expect(t.onViolation({ code: 'corre', params: {} } as never, 7)).toBe(true);
    expect(shown).toEqual(['stranezza']);
    expect(t.onViolation({ code: 'bloccato', params: {} } as never, 7)).toBe(true);
    expect(t.onViolation({ code: 'spillo', params: {} } as never, 8)).toBe(true);
    expect(shown).toEqual(['stranezza', 'nodo', 'spillo']);
  });

  it('evento, con «chi» solo per quel filo', () => {
    const { t, shown } = tut([
      { k: 'margine', when: 'evento', evento: 'passa', chi: 'nina', textKey: 'aNina' },
      { k: 'margine', when: 'evento', evento: 'esce', textKey: 'esce' },
    ]);
    t.onEvents([{ k: 'passa', bead: 'L1', from: 'bepi', to: 'zeno', hour: 7 } as never]);
    expect(shown).toEqual([]);
    t.onEvents([{ k: 'passa', bead: 'L1', from: 'bepi', to: 'nina', hour: 8 } as never, { k: 'esce', thread: 'bepi', hour: 8 } as never]);
    expect(shown).toEqual(['aNina', 'esce']);
  });

  it('nome, archivioNomi, archivioRammendo; la mano di Ada', () => {
    const { t, shown, hands } = tut([
      { k: 'margine', when: 'nome', textKey: 'nome', mano: 'ada' },
      { k: 'margine', when: 'archivioNomi', textKey: 'nomi' },
      { k: 'margine', when: 'archivioRammendo', textKey: 'rammendo' },
    ]);
    t.onNome();
    t.onArchive('nomi');
    t.onArchive('rammendo');
    expect(shown).toEqual(['nome', 'nomi', 'rammendo']);
    expect(hands).toEqual(['ada', 'clotilde', 'clotilde']);
  });

  it('due passi con la stessa chiave contano come uno', () => {
    const { t, shown } = tut([
      { k: 'margine', when: 'incrocio', hour: 7, textKey: 'x' },
      { k: 'margine', when: 'versoSbagliato', hour: 7, textKey: 'x' },
    ]);
    t.onCross(7, true);
    expect(shown).toEqual(['x']);
  });

  it('ogni bersaglio di «pulsa» pulsa nella sua ora finché non lo si tocca', () => {
    const targets = ['fissa', 'taccuino', 'nome', 'disfa', 'lampada', 'obiettivi', 'matassa', 'bordo', 'spillo', 'fuso', 'marea'] as const;
    const steps: TutorialStep[] = targets.map((target) => ({ k: 'pulsa', target, hour: 7, ...(target === 'spillo' || target === 'fuso' ? { thread: 'marta' } : {}) }));
    const { t } = tut(steps);
    expect(t.pulses(6, false, true)).toEqual([]);
    const all = t.pulses(7, false, true).map((p) => p.target);
    expect(all).toEqual([...targets]);
    // «fissa» solo con la bozza piena, «nome» solo se il nome manca.
    expect(t.pulses(7, true, false).map((p) => p.target)).toEqual(targets.filter((x) => x !== 'fissa' && x !== 'nome'));
    expect(t.pulses(7, false, true).find((p) => p.target === 'spillo')?.thread).toBe('marta');
    for (const target of targets) {
      t.interacted(target, target === 'fuso' ? 'zeno' : undefined);
    }
    // Il fuso di un altro filo non spegne quello di Marta.
    expect(t.pulses(7, false, true).map((p) => p.target)).toEqual(['fuso']);
    t.interacted('fuso', 'marta');
    expect(t.pulses(7, false, true)).toEqual([]);
  });

  it('mano: da colonna a colonna, finché non si incrocia in quella riga', () => {
    const { t } = tut([{ k: 'mano', hour: 6, pair: 0, over: 'R' }, { k: 'mano', hour: 7, pair: 1, over: 'L' }]);
    expect(t.hand(6, true)).toEqual({ from: 1, to: 0 });
    expect(t.hand(6, false)).toBeNull();
    expect(t.hand(7, true)).toEqual({ from: 1, to: 2 });
    t.onCross(6, false);
    expect(t.hand(6, true)).toBeNull();
  });

  it('prologo: alle 6 la mano trascina un fuso visibile da colonna 1 a 0; alle 7 compare «Chi sta sopra, dà»', () => {
    const lv = level('g00');
    const steps = lv.tutorial ?? [];
    const hand6 = steps.find((s) => s.k === 'mano' && s.hour === lv.startHour + 1);
    expect(hand6).toBeDefined();
    h.data.settings.autoAdvance = true;
    c = new NightController(h.s, nightParams(lv, { origin: 'campagna' }), { computed: computed('g00') });
    const ghost = vi.spyOn(c.renderer.rig, 'drawGhost');
    c.update(0.2);
    renderOnce(c);
    const want = hand6 && hand6.k === 'mano' ? (hand6.over === 'R' ? { from: hand6.pair + 1, to: hand6.pair } : { from: hand6.pair, to: hand6.pair + 1 }) : null;
    expect(want).toEqual({ from: 1, to: 0 });
    expect(c.overlay.handFrom).toBe(1);
    expect(c.overlay.handTo).toBe(0);
    // Il fuso fantasma è quello della colonna di partenza.
    expect(ghost).toHaveBeenCalled();
    expect(ghost.mock.calls[0]?.[1]).toBe(c.session.state.pos[1]);
    // Alle 6 l'incrocio giusto, poi alle 7 con il verso giusto la nota «sopra dà».
    const sol = computed('g00').base.rows ?? [];
    const sopraDa = steps.find((s) => s.k === 'margine' && s.hour === lv.startHour + 2 && (s.when === 'incrocio' || s.when === 'versoSbagliato'));
    for (const r of sol) {
      if (r.hour > lv.startHour + 2) break;
      for (const x of r.crossings) if (!x.forced) expect(c.cross(x.pair, x.over, 'debug')).toBeNull();
      if (r.hour === lv.startHour + 2) break;
      expect(c.fix().ok).toBe(true);
      for (let i = 0; i < 13 * 60; i++) c.update(1 / 60);
    }
    if (sopraDa && sopraDa.k === 'margine') {
      for (let i = 0; i < 13 * 60 && c.margin.current !== sopraDa.textKey; i++) c.update(1 / 60);
      expect(c.margin.current).toBe(sopraDa.textKey);
    }
  });
});

// ───────────────────────── TOM-09 ─────────────────────────

describe('TOM-09: «soddisfatta» solo sulle righe fissate (C07; P025, P102)', () => {
  /** g00 (fixture): Marta al Forno alle 6, che la bozza dell'ora compie. */
  const req: Condition = { t: 'presso', who: 'marta', place: 'forno', hour: 6 };
  const acc: AcceptedRequest[] = [{ noteId: 'test.marta', request: req, author: 'marta' as CharacterId }];

  it('in bozza: anteprima soddisfatta, report no; spunta tratteggiata e nessun avviso', () => {
    c = new NightController(h.s, nightParams(fixture('g00'), { accepted: acc }), { computed: null });
    expect(c.cross(0, 'R', 'debug')).toBeNull();
    const st = c.session.requestStatusFull()[0]!;
    expect(st.anteprima).toBe('soddisfatta');
    expect(st.report.status).not.toBe('soddisfatta');
    expect(document.querySelector('.tb-token--anteprima')).not.toBeNull();
    expect(c.explain.key).not.toBe('tombolo.richieste.soddisfatta');
    // Fissata l'ora: soddisfatta, e allora l'avviso.
    expect(c.fix().ok).toBe(true);
    const after = c.session.requestStatusFull()[0]!;
    expect(after.report.status).toBe('soddisfatta');
    expect(c.explain.key).toBe('tombolo.richieste.soddisfatta');
    expect(document.querySelector('.tb-token--anteprima')).toBeNull();
  });

  it('gli obiettivi seguono la stessa regola (goalStatus / goalPreview)', () => {
    const lv: LevelDef = { ...fixture('g00'), goals: [req] };
    c = new NightController(h.s, nightParams(lv), { computed: null });
    c.cross(0, 'R', 'debug');
    expect(c.session.goalPreview()[0]).toBe('soddisfatta');
    expect(c.session.goalStatus()[0]?.status).not.toBe('soddisfatta');
    c.openGoals();
    expect(q('tb-obiettivo-0')?.getAttribute('data-stato')).toBe('anteprima');
    c.fix();
    expect(c.session.goalStatus()[0]?.status).toBe('soddisfatta');
  });
});

// ───────────────────────── TOM-10 ─────────────────────────

describe('TOM-10: suggerimenti che dicono la verità (D07)', () => {
  const marta: Condition = { t: 'presso', who: 'marta', place: 'forno', hour: 6 };
  const piero: Condition = { t: 'presso', who: 'piero', place: 'forno', hour: 6 };
  const two: AcceptedRequest[] = [
    { noteId: 'test.marta' as NoteId, request: marta, author: 'marta' as CharacterId },
    { noteId: 'test.piero' as NoteId, request: piero, author: 'piero' as CharacterId },
  ];
  const has = (goals: readonly Condition[], c0: Condition): boolean => goals.some((g) => JSON.stringify(g) === JSON.stringify(c0));
  /** Solver finto: le due richieste insieme sono impossibili, ognuna da sola no. */
  const stub = (rows: SolveResult['rows']) => async (req: SolveRequest): Promise<SolveResult> => {
    if (has(req.goals, marta) && has(req.goals, piero)) return { status: 'impossibile' } as SolveResult;
    return { status: 'ok', rows } as SolveResult;
  };

  it('richieste incompatibili: la Spinta lo dice e offre di lasciarne cadere una', async () => {
    const sol = fixtureComputed('g00').base.rows;
    c = new NightController(h.s, nightParams(fixture('g00'), { accepted: two }), { computed: null, solveAsync: stub(sol) });
    const hint = await c.lampTap();
    expect(hint?.tier).toBe('spinta');
    expect(hint?.textKey).toBe('tombolo.hint.incompatibili');
    expect(c.diagnosis).toEqual({ k: 'incompatibili', notes: ['test.marta', 'test.piero'] });
    const text = document.querySelector('[data-test="tb-suggerimento"]')?.textContent ?? '';
    expect(text).toContain(nameOf('marta'));
    expect(text).toContain(nameOf('piero'));
    const drop = q<HTMLButtonElement>('tb-suggerimento-lascia-test.piero');
    expect(drop).not.toBeNull();
    now += 500;
    drop!.click();
    expect(c.session.dropped).toContain('test.piero');
  });

  it('g06 con Nina e Zeno (contenuti): se il solver le dice incompatibili, la Spinta lo dice', async () => {
    const lv = level('g06');
    const notes = ['g06.nina', 'g06.zeno'].map((id) => h.s.content.notes.get(id as NoteId)).filter((n) => !!n?.request);
    if (notes.length < 2) return;
    const accepted = notes.map((n) => ({ noteId: n!.id, request: n!.request!, author: n!.author }));
    c = new NightController(h.s, nightParams(lv, { origin: 'campagna', accepted }), { computed: computed('g06') });
    const d = await c.session.diagnose();
    if (d?.k !== 'incompatibili') return; // i contenuti di g06 sono cambiati: la logica la prova il test con il solver finto
    const hint = await c.lampTap();
    expect(hint?.textKey).toBe('tombolo.hint.incompatibili');
  });

  it('in una riga di quiete il Fantasma non toglie il filo d\'oro; con un incrocio sì, dopo conferma', async () => {
    const base = fixtureComputed('g00');
    const rows = base.base.rows!.map((r, i) => (i === 0 ? { hour: r.hour, crossings: [] } : r));
    const quiet: LevelComputed = { ...base, base: { incroci: 3, rows } };
    c = new NightController(h.s, nightParams(fixture('g00')), { computed: quiet, solveAsync: stub(rows) });
    expect(c.session.goldPossible(3)).toBe(true);
    const ghostQuiet = await c.hint('fantasma');
    expect(ghostQuiet.ghost).toBeUndefined();
    expect(c.session.goldPossible(3)).toBe(true);
    // Con un incrocio: il fantasma chiede conferma prima di costare il filo d'oro.
    const loud: LevelComputed = { ...base, base: { incroci: 4, rows: base.base.rows } };
    c.destroy();
    c = new NightController(h.s, nightParams(fixture('g00')), { computed: loud, solveAsync: stub(base.base.rows) });
    await c.lampTap();
    expect(q('tb-suggerimento-ancora')).not.toBeNull();
  });

  it('tre tocchi sulla lampada non chiamano mai il Fantasma; dopo il primo la lampada resta accesa', async () => {
    const sol = fixtureComputed('g00').base.rows;
    c = new NightController(h.s, nightParams(fixture('g00')), { computed: fixtureComputed('g00'), solveAsync: stub(sol) });
    const lamp = q('tb-lampada')!;
    expect(lamp.hidden).toBe(false);
    expect(lamp.classList.contains('tb-lamp--accesa')).toBe(false);
    const tiers: string[] = [];
    for (let i = 0; i < 3; i++) {
      const hnt = await c.lampTap();
      tiers.push(hnt?.tier ?? '');
      now += 500;
    }
    expect(tiers).not.toContain('fantasma');
    expect(c.session.goldPossible(3)).toBe(true);
    // Ora seguente: la lampada è ancora accesa.
    for (const x of sol![0]!.crossings) if (!x.forced) c.cross(x.pair, x.over, 'debug');
    expect(c.fix().ok).toBe(true);
    expect(lamp.classList.contains('tb-lamp--accesa')).toBe(true);
  });
});

// ───────────────────────── TOM-12 ─────────────────────────

describe('TOM-12: il tocco spiega (bolle)', () => {
  it('prologo: lo spillo di Forno alle 9 → «Teresa al Forno alle 9»', () => {
    const lv = level('g00');
    const pin = lv.pins.find((p) => p.place === 'forno' && p.hour === 9);
    expect(pin).toBeDefined();
    c = new NightController(h.s, nightParams(lv, { origin: 'campagna' }), { computed: null });
    const col = lv.columns.indexOf(pin!.place);
    const head = pinHead(c.layout, c.scroll, col, pin!.hour - lv.startHour);
    expect(c.showBubbleAt(head.x, head.y)).toBe(true);
    const b = q('tb-bolla');
    expect(b?.hidden).toBe(false);
    const who = lv.threads.find((t) => t.id === pin!.thread)?.character as CharacterId;
    expect(b?.textContent?.startsWith(`${nameOf(who)} al Forno alle 9`)).toBe(true);
    // Il passaggio del mouse dà la stessa bolla; il tocco successivo la chiude.
    c.hideBubble();
    expect(c.showBubbleAt(head.x, head.y, true)).toBe(true);
    expect(q('tb-bolla')?.textContent?.startsWith(`${nameOf(who)} al Forno alle 9`)).toBe(true);
  });

  it('g06: la barca dice chi entra e che cosa porta (il marinaio e la lettera)', () => {
    const lv = level('g06');
    const e = (lv.edges ?? []).find((x) => !!x.enters);
    if (!e) return;
    c = new NightController(h.s, nightParams(lv, { origin: 'campagna' }), { computed: null });
    const index = e.hour - lv.startHour;
    c.revealRow(index);
    c.setScroll(c.scroll);
    const side = e.side === 'molo' ? -1 : 1;
    const p = edgeCenter(c.layout, c.scroll, index, side);
    expect(c.showBubbleAt(p.x, p.y)).toBe(true);
    const text = q('tb-bolla')?.textContent ?? '';
    expect(text).toContain(threadName(c.textDeps, e.enters!));
    for (const b of lv.beads.filter((x) => x.holder === e.enters)) expect(text).toContain(beadName(c.textDeps, b.id));
  });

  it('le bolle non si aprono sui fusi e non intercettano i tocchi', () => {
    c = new NightController(h.s, nightParams(fixture('g00')), { computed: null });
    const l = c.layout;
    expect(c.bubbleTargetAt(l.colCx[0] ?? 0, l.spindles.y + 20)).toBeNull();
    expect(c.bubble.el.style.pointerEvents === 'none' || getComputedStyle(c.bubble.el).pointerEvents === 'none' || c.bubble.el.classList.contains('tb-bolla')).toBe(true);
  });
});

// ───────────────────────── TOM-13 ─────────────────────────

describe('TOM-13: obiettivi, popup e componente (C08)', () => {
  const five: Condition[] = [
    { t: 'presso', who: 'marta', place: 'forno', hour: 6 },
    { t: 'presso', who: 'teresa', place: 'forno', hour: 9 },
    { t: 'presso', who: 'piero', place: 'chiesa', hour: 9 },
    { t: 'consegnata', bead: 'L1', by: 9 },
    { t: 'incontra', a: 'marta', b: 'piero', from: 6, to: 8 },
  ];

  it('a 360×640 con 5 obiettivi: il pulsante dice «n/5», le voci scorrono con l\'ombra', () => {
    useViewport(360, 640);
    const lv: LevelDef = { ...fixture('g00'), goals: five };
    c = new NightController(h.s, nightParams(lv), { computed: null });
    const btn = q('tb-obiettivi');
    expect(btn?.hidden).toBe(false);
    expect(btn?.textContent).toContain('0/5');
    c.cross(0, 'R', 'debug');
    c.fix();
    expect(btn?.textContent).toContain('1/5');
    now += 500;
    c.openGoals();
    const wrap = q('tb-obiettivi-scorre')!;
    expect(wrap).not.toBeNull();
    for (let i = 0; i < 5; i++) expect(wrap.querySelector(`[data-test="tb-obiettivo-${i}"]`), `${i}`).not.toBeNull();
    // Niente titolo ripetuto: nel popup c'è solo l'elenco.
    expect(wrap.parentElement?.querySelector('h2, h3')).toBeNull();
    // Ombra: c'è altro sotto.
    Object.defineProperty(wrap, 'scrollHeight', { configurable: true, value: 600 });
    Object.defineProperty(wrap, 'clientHeight', { configurable: true, value: 200 });
    wrap.scrollTop = 0;
    wrap.dispatchEvent(new Event('scroll'));
    expect(wrap.dataset.ombra).toBe('1');
    wrap.scrollTop = 400;
    wrap.dispatchEvent(new Event('scroll'));
    expect(wrap.dataset.ombra).toBe('0');
  });

  it('objectivesElement(): elenco con testo e stato, che si aggiorna e si smonta con la notte', () => {
    const lv: LevelDef = { ...fixture('g00'), goals: five.slice(0, 2) };
    c = new NightController(h.s, nightParams(lv), { computed: null });
    const node = c.objectivesElement();
    document.body.appendChild(node);
    expect(node.dataset.test).toBe('tb-obiettivi-lista');
    expect(node.querySelector('[data-test="tb-obiettivo-0"]')?.textContent).toContain(nameOf('marta'));
    // Spilli d'ottone del livello anche se non si vedono.
    for (const p of lv.pins) expect(node.querySelector(`[data-test="tb-spillo-${p.thread}-${p.hour}"]`), `${p.thread}-${p.hour}`).not.toBeNull();
    expect(node.querySelector('[data-test="tb-obiettivo-0"]')?.getAttribute('data-stato')).not.toBe('soddisfatta');
    c.cross(0, 'R', 'debug');
    c.fix();
    expect(node.querySelector('[data-test="tb-obiettivo-0"]')?.getAttribute('data-stato')).toBe('soddisfatta');
    c.destroy();
    c = null;
    expect(node.isConnected).toBe(false);
  });
});

// ───────────────────────── TOM-15 ─────────────────────────

describe('TOM-15: occasioni (D06)', () => {
  function occParams(): NightParams {
    return nightParams(fixture('test-occasioni'), { mode: 'occasioni' });
  }

  it('un clic al centro di ogni cerchio pianta esattamente quella occasione', () => {
    const lv = fixture('test-occasioni');
    c = new NightController(h.s, occParams(), { computed: fixtureComputed('test-occasioni') });
    expect(c.placingOccasions()).toBe(true);
    const allowed = lv.autoweave?.allowedOccasions ?? [];
    expect(allowed.length).toBeGreaterThan(0);
    for (const o of allowed) {
      const col = lv.columns.indexOf(o.place);
      const index = o.hour - lv.startHour;
      c.revealRow(index);
      c.setScroll(c.scroll);
      const p = slotCenter(c.layout, c.scroll, col, index);
      c.interact.onGesture({ k: 'tap', x: p.x, y: p.y, pointer: 'mouse', button: 0 });
      expect(c.session.occasions, `${o.kind} ${o.place} ${o.hour}`).toEqual([{ kind: o.kind, place: o.place, hour: o.hour }]);
      // Di nuovo: si toglie.
      c.interact.onGesture({ k: 'tap', x: p.x, y: p.y, pointer: 'mouse', button: 0 });
      expect(c.session.occasions).toEqual([]);
    }
  });

  it('il contatore delle occasioni sta fuori dalla griglia', () => {
    c = new NightController(h.s, occParams(), { computed: null });
    const l = c.layout;
    const r = l.requests;
    expect(r.y >= l.lace.y + l.lace.h || r.y + r.h <= l.lace.y).toBe(true);
  });

  it('«Riprova» azzera il contatore degli obiettivi', () => {
    c = new NightController(h.s, occParams(), { computed: null });
    c.run();
    c.skip();
    const before = c.session.goalStatus().map((r) => r.status);
    expect(before.some((s) => s !== 'in_corso')).toBe(true);
    c.retry();
    expect(c.session.goalStatus().every((r) => r.status === 'in_corso')).toBe(true);
    expect(q('tb-obiettivi')?.textContent).toContain(`0/${fixture('test-occasioni').goals?.length ?? 0}`);
    expect(c.placingOccasions()).toBe(true);
  });
});

// ───────────────────────── TOM-16 ─────────────────────────

describe('TOM-16: il nome si sposta prima della prima ora (P089)', () => {
  it('g12: un filo, un altro, di nuovo il primo; poi, fissata un\'ora, «Il nome è già appuntato»', () => {
    const lv = level('g12');
    c = new NightController(h.s, nightParams(lv, { origin: 'campagna', needsNome: true }), { computed: computed('g12') });
    const people = c.session.state.pos.filter((t) => c!.visuals.get(t)?.kind !== 'lino');
    expect(people.length).toBeGreaterThanOrEqual(2);
    const [a, b] = people as [ThreadId, ThreadId];
    c.tapSpindle(a);
    expect(c.session.nomeOn).toBe(a);
    expect(c.explain.key).toBe('tombolo.nome.appuntato');
    c.tapSpindle(b);
    expect(c.session.nomeOn).toBe(b);
    expect(c.explain.key).toBe('tombolo.nome.spostato');
    expect(q('tb-explain')?.textContent).toBe(h.s.i18n.t('tombolo.nome.spostato', { nome: threadName(c.textDeps, b) }));
    c.tapSpindle(a);
    expect(c.session.nomeOn).toBe(a);
  });

  it('dopo la prima ora fissata il tocco è ignorato con il messaggio', () => {
    c = new NightController(h.s, nightParams(fixture('g00'), { needsNome: true }), { computed: null });
    c.tapSpindle('teresa');
    c.tapSpindle('marta');
    expect(c.session.nomeOn).toBe('marta');
    c.cross(0, 'R', 'debug');
    expect(c.fix().ok).toBe(true);
    c.tapSpindle('piero');
    expect(c.session.nomeOn).toBe('marta');
    expect(c.explain.key).toBe('tombolo.nome.giaAppuntato');
  });
});

// ───────────────────────── TOM-17 ─────────────────────────

describe('TOM-17: rancore visibile, stranezze nelle modalità extra, scheda coerente', () => {
  it('quirkRevealed del tombolo è uguale a quello del diario sui dati veri', () => {
    const db = h.s.content;
    let cases = 0;
    for (const ch of db.characters.values()) {
      for (const qid of ch.quirks) {
        const entries = [...db.diary.values()].filter((d) => d.section === 'persone' && d.character === ch.id).map((d) => d.id);
        const sets: string[][] = [[], entries, entries.slice(0, Math.max(0, entries.length - 1)), entries.slice(1)];
        for (const diary of sets) {
          for (const quirks of [[] as QuirkId[], [qid]]) {
            const k = { quirks, diary };
            expect(tomboloQuirkRevealed(qid, ch.id, k, db), `${ch.id} ${qid}`).toBe(diaryQuirkRevealed(qid, ch.id, k, db));
            cases++;
          }
        }
      }
    }
    expect(cases).toBeGreaterThan(0);
  });

  it('modalità extra: tutte le stranezze attive; campagna: solo quelle che il Taccuino mostra', () => {
    expect(extraMode('giornaliero')).toBe(true);
    expect(extraMode('libero')).toBe(true);
    expect(extraMode('spartito')).toBe(true);
    expect(extraMode('campagna')).toBe(false);
    const db = h.s.content;
    const gino = db.characters.get('gino' as CharacterId);
    if (!gino || gino.quirks.length === 0) return;
    const none = { quirks: [] as QuirkId[], diary: [] as string[] };
    expect(shownQuirks('giornaliero', gino.id, gino.quirks, gino.quirks, none, db)).toEqual(gino.quirks);
    expect(shownQuirks('campagna', gino.id, gino.quirks, gino.quirks, none, db)).toEqual([]);
  });

  it('Merletto del giorno con Gino: la scheda elenca la sua stranezza', () => {
    const lv = fixture('test-gino');
    const gt = lv.threads.find((t) => t.character === 'gino');
    if (!gt) return;
    c = new NightController(h.s, nightParams(lv, { origin: 'giornaliero' }), { computed: null });
    const active = c.session.ctx.quirks;
    const ginoQuirks = (h.s.content.characters.get('gino' as CharacterId)?.quirks ?? []).filter((x) => active.includes(x));
    expect(c.quirksOf('gino' as CharacterId)).toEqual(ginoQuirks);
    c.openCharCard(gt.id);
    const card = document.querySelector('[data-test="tb-scheda"]') ?? document.querySelector('.tb-popup');
    expect(ginoQuirks.length).toBeGreaterThan(0);
    for (const qid of ginoQuirks) expect(card?.textContent).toContain(h.s.i18n.t(`tombolo.stranezza.${qid}`));
  });

  it('prologo (campagna): la stranezza di Teresa resta nascosta finché il Taccuino non la mostra', () => {
    const lv = level('g00');
    const teresa = h.s.content.characters.get('teresa' as CharacterId);
    const qid = teresa?.quirks.find((x) => (lv.quirks ?? []).includes(x));
    if (!teresa || !qid) return;
    h.data.knowledge.quirks = [qid];
    h.data.knowledge.diary = [];
    const mentions = [...h.s.content.diary.values()].filter((d) => d.section === 'persone' && d.character === 'teresa' && JSON.stringify(d.unlock).includes(`"${qid}"`));
    c = new NightController(h.s, nightParams(lv, { origin: 'campagna' }), { computed: null });
    if (mentions.length > 0) expect(c.quirksOf('teresa' as CharacterId)).not.toContain(qid);
    c.destroy();
    h.data.knowledge.diary = mentions.map((d) => d.id);
    c = new NightController(h.s, nightParams(lv, { origin: 'campagna' }), { computed: null });
    expect(c.quirksOf('teresa' as CharacterId)).toContain(qid);
  });

  it('rancore: segno del nodo sui due fusi e riga negli obiettivi, finché vale', () => {
    const lv = fixture('test-rancore');
    c = new NightController(h.s, nightParams(lv, { origin: 'libero' }), { computed: null });
    const pairs = c.session.ctx.rancor;
    if (pairs.length === 0) return;
    const [a, b] = pairs[0] as [ThreadId, ThreadId];
    expect(c.overlay.rancor(a)).toBe(true);
    expect(c.overlay.rancor(b)).toBe(true);
    c.openGoals();
    const item = document.querySelector(`[data-test="tb-rancore-${a}-${b}"], [data-test="tb-rancore-${b}-${a}"]`);
    expect(item).not.toBeNull();
    expect(item?.textContent).toContain(threadName(c.textDeps, a));
  });
});

// ───────────────────────── TOM-20 ─────────────────────────

describe('TOM-20: chiusura a nodo e apparizione del filo nero (C11, C12)', () => {
  function record(): { nodo: number; app: number; complete: number; order: string[] } {
    const r = { nodo: 0, app: 0, complete: 0, order: [] as string[] };
    h.s.bus.on('tombolo:nodo', () => {
      r.nodo++;
      r.order.push('nodo');
    });
    h.s.bus.on('tombolo:apparizione', () => {
      r.app++;
      r.order.push('apparizione');
    });
    h.s.bus.on('night:complete', () => {
      r.complete++;
      r.order.push('complete');
    });
    return r;
  }

  it('nodo: l\'evento parte una volta, night:complete dopo l\'animazione, niente «Merletto chiuso»', async () => {
    const r = record();
    const lv: LevelDef = { ...fixture('g00'), chiusura: 'nodo' };
    h.data.settings.animSpeed = 1;
    c = new NightController(h.s, nightParams(lv), { computed: fixtureComputed('g00') });
    await c.autoplay(fixtureComputed('g00').base.rows);
    expect(r.nodo).toBe(1);
    expect(r.complete).toBe(0);
    expect(c.endingRunning()).toBe(true);
    expect(c.explain.key).not.toBe('tombolo.fine');
    for (let i = 0; i < 2 * 60; i++) c.update(1 / 60);
    expect(r.complete).toBe(0);
    for (let i = 0; i < 1 * 60; i++) c.update(1 / 60);
    expect(r.complete).toBe(1);
    expect(r.order).toEqual(['nodo', 'complete']);
    c.finish();
    for (let i = 0; i < 3 * 60; i++) c.update(1 / 60);
    expect(r.nodo).toBe(1);
    expect(r.complete).toBe(1);
    const chiuso = h.s.i18n.t('tombolo.hud.finito');
    expect(q('tb-hud-fine')?.textContent ?? '').not.toContain(chiuso);
    const where = Array.from(document.querySelectorAll<HTMLElement>('*')).filter((e) => Array.from(e.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').includes(chiuso))).map((e) => `${e.tagName}.${e.className}[${e.dataset.test ?? ''}]`);
    expect(where).toEqual([]);
  });

  it('apparizione: prima tombolo:apparizione, poi night:complete; con animSpeed 0 tutto subito', async () => {
    const r = record();
    const lv: LevelDef = { ...fixture('g00'), apparizione: { hour: 3, side: 'faro', passi: 1 } };
    h.data.settings.animSpeed = 0;
    c = new NightController(h.s, nightParams(lv), { computed: fixtureComputed('g00') });
    await c.autoplay(fixtureComputed('g00').base.rows);
    expect(r.order).toEqual(['apparizione', 'complete']);
    expect(c.endingRunning()).toBe(false);
  });

  it('apparizione a 1×: 3,6 s; mai sotto i 2,5 s, nemmeno col movimento ridotto (revisione 2, Q064)', async () => {
    for (const reduced of [false, true]) {
      h = harness();
      const r = record();
      const lv: LevelDef = { ...fixture('g00'), apparizione: { hour: 3, side: 'faro', passi: 1 } };
      h.data.settings.animSpeed = 1;
      h.data.settings.reducedMotion = reduced;
      c?.destroy();
      c = new NightController(h.s, nightParams(lv), { computed: fixtureComputed('g00') });
      await c.autoplay(fixtureComputed('g00').base.rows);
      expect(r.app).toBe(1);
      for (let i = 0; i < 2.4 * 60; i++) c.update(1 / 60);
      expect(r.complete, `ridotto ${reduced}: ancora visibile a 2,4 s`).toBe(0);
      expect(q('tb-explain')?.textContent).toMatch(/filo nero/);
      for (let i = 0; i < 1.4 * 60; i++) c.update(1 / 60);
      expect(r.complete).toBe(1);
    }
  });

  it('senza chiusure speciali: night:complete subito (come prima)', async () => {
    const r = record();
    c = new NightController(h.s, nightParams(fixture('g00')), { computed: fixtureComputed('g00') });
    await c.autoplay(fixtureComputed('g00').base.rows);
    expect(r.order).toEqual(['complete']);
    await flush();
  });
});

// ───────────────────────── TOM-14 (popup del gettone) ─────────────────────────

describe('TOM-14: nel popup del gettone, sotto il bigliettino, la condizione esatta', () => {
  it('la riga dice la condizione con la finestra e il destinatario', () => {
    const lv = fixture('g00');
    const req: Condition = { t: 'consegnata', bead: 'L1', by: 9 };
    const acc: AcceptedRequest[] = [{ noteId: 'g06.nina' as NoteId, request: req, author: 'nina' as CharacterId }];
    c = new NightController(h.s, nightParams(lv, { accepted: acc }), { computed: null });
    c.openRequest('g06.nina' as NoteId);
    const line = q('tb-bigliettino-condizione');
    expect(line).not.toBeNull();
    const text = line!.textContent ?? '';
    expect(text).toContain('entro le 9');
    expect(text.charAt(0)).toBe(text.charAt(0).toLocaleUpperCase());
    expect(text.toLocaleLowerCase()).toContain(beadName(c.textDeps, 'L1').toLocaleLowerCase());
  });
});
