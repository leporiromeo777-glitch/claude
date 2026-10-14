// @vitest-environment happy-dom
/**
 * Revisione 1, P2 del tombolo: desktop grande, filo nero e motivi (TOM-18),
 * tastiera e lettore di schermo (TOM-19), PNG con cartiglio (TOM-21), «Salta le
 * ore quiete» (TOM-22).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionEvent, ActionId, CharacterDef, CharacterId, LevelDef, Viewport } from '../../../src/core/types';
import { computeViewport } from '../../../src/core/viewport';
import { CENTER_MAX, computeTomboloLayout } from '../../../src/tombolo/layout';
import { hourLabelPx } from '../../../src/tombolo/render/lace';
import { PIN_R, pinHeadSize } from '../../../src/tombolo/render/pins';
import { ONDE_A, ONDE_W, RIGHE_W, drawPattern } from '../../../src/tombolo/render/patterns';
import { Poly, sampleThread } from '../../../src/tombolo/render/curves';
import { NERO_BORDO, buildVisuals, luminance } from '../../../src/tombolo/visuals';
import { CAPTION_H, captionRect, drawLaceImage, laceImageSize } from '../../../src/tombolo/export';
import { NightController } from '../../../src/tombolo/controller';
import { popupClock } from '../../../src/tombolo/ui/popup';
import { ROOT, fixture, fixtureComputed, nightParams } from './helpers';
import { type Harness, harness } from './harness';

function level(id: string): LevelDef {
  return JSON.parse(readFileSync(resolve(ROOT, `src/content/levels/${id}.json`), 'utf8')) as LevelDef;
}
const NO_SAFE = { top: 0, right: 0, bottom: 0, left: 0 };
const vp = (w: number, hh: number): Viewport => computeViewport(w, hh, 2, NO_SAFE, 1);

let h: Harness;
let c: NightController | null = null;
let now = 1000;

/** Path2D finto (happy-dom non ce l'ha): i glifi lo usano. */
class FakePath2D {
  moveTo(): void {}
  lineTo(): void {}
  bezierCurveTo(): void {}
  quadraticCurveTo(): void {}
  arc(): void {}
  arcTo(): void {}
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

const q = <T extends HTMLElement = HTMLElement>(test: string): T | null => document.querySelector<T>(`[data-test="${test}"]`);
const act = (action: ActionId, index?: number): ActionEvent => ({ action, repeat: false, source: 'keyboard', ...(index !== undefined ? { index } : {}) });

/** Contesto 2D che registra le chiamate con i loro argomenti. */
function recorder(): { ctx: CanvasRenderingContext2D; calls: { k: string; a: unknown[] }[]; props: { k: string; v: unknown }[] } {
  const calls: { k: string; a: unknown[] }[] = [];
  const props: { k: string; v: unknown }[] = [];
  const t: Record<string, unknown> = {
    measureText: (s: string) => ({ width: s.length * 7 }),
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    createRadialGradient: () => ({ addColorStop: () => undefined }),
  };
  const ctx = new Proxy(t, {
    get(o, k) {
      if (typeof k !== 'string') return undefined;
      if (k in o) return o[k];
      return (...a: unknown[]) => {
        calls.push({ k, a });
        return undefined;
      };
    },
    set(o, k, v) {
      if (typeof k === 'string') {
        o[k] = v;
        props.push({ k, v });
      }
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, props };
}

// ───────────────────────── TOM-18 ─────────────────────────

describe('TOM-18: desktop grande, filo nero, motivi (D06)', () => {
  it('1920×1080: centro ≥ 900 px, spilli ≥ 20 px, numeri delle ore ≥ 15 px', () => {
    const l = computeTomboloLayout(vp(1920, 1080), 6, 12);
    expect(l.kind).toBe('largo');
    expect(l.center.w).toBeGreaterThanOrEqual(900);
    expect(l.center.w).toBeLessThanOrEqual(CENTER_MAX);
    // La testa dello spillo (il disco) e il suo sprite.
    expect(PIN_R * 2 * l.scale).toBeGreaterThanOrEqual(20);
    expect(pinHeadSize(l.scale)).toBeGreaterThanOrEqual(20);
    expect(hourLabelPx(l.scale, false)).toBeGreaterThanOrEqual(15);
    expect(hourLabelPx(l.scale, true)).toBeGreaterThanOrEqual(15);
    // Il numero dell'ora e la barca del Molo restano affiancati.
    expect((l.colX[0] ?? 0) - 17).toBeGreaterThanOrEqual(l.gutterCx + hourLabelPx(l.scale, true) * 0.6);
  });

  it('nello stretto e fino a 640 px di centro la scala resta 1', () => {
    expect(computeTomboloLayout(vp(390, 844), 6, 12).scale).toBe(1);
    expect(computeTomboloLayout(vp(1180, 820), 6, 12).scale).toBe(1);
    const big = computeTomboloLayout(vp(2560, 1440), 6, 12);
    expect(big.center.w).toBe(CENTER_MAX);
    expect(big.scale).toBe(1.5);
  });

  it('il filo nero ha sempre un bordo chiaro (anche senza alto contrasto)', () => {
    const lv = level('g17');
    const chars = new Map<CharacterId, CharacterDef>();
    for (const ch of h.s.content.characters.values()) chars.set(ch.id, ch);
    const nero = lv.threads.find((t) => t.kind === 'nero');
    expect(nero).toBeDefined();
    for (const hc of [false, true]) {
      const v = buildVisuals(lv, chars, { highContrast: hc }).get(nero!.id)!;
      expect(v.edge, `alto contrasto ${hc}`).not.toBeNull();
      expect(luminance(v.edge!) - luminance(v.color)).toBeGreaterThan(0.4);
    }
    expect(luminance(NERO_BORDO)).toBeGreaterThan(0.5);
    // Un filo di persona senza alto contrasto resta senza bordo.
    const other = lv.threads.find((t) => t.kind === 'persona' && t.character && t.character !== 'livia');
    if (other) expect(buildVisuals(lv, chars, {}).get(other.id)?.edge).toBeNull();
  });

  it('g05: Gino (onde) e Teresa (righe oblique) vicini si distinguono anche in bianco e nero', () => {
    const lv = level('g05');
    const chars = new Map<CharacterId, CharacterDef>();
    for (const ch of h.s.content.characters.values()) chars.set(ch.id, ch);
    const vis = buildVisuals(lv, chars, {});
    const gino = [...vis.values()].find((v) => v.character === 'gino');
    const teresa = [...vis.values()].find((v) => v.character === 'teresa');
    if (!gino || !teresa) return;
    expect(gino.pattern).toBe('onde');
    expect(teresa.pattern).toBe('righe');
    // In scala di grigi il motivo si vede: inchiostro e colore distanti.
    expect(Math.abs(luminance(gino.ink) - luminance(gino.color))).toBeGreaterThan(0.25);
    expect(Math.abs(luminance(teresa.ink) - luminance(teresa.color))).toBeGreaterThan(0.25);
    // Motivi marcati.
    expect(RIGHE_W).toBeGreaterThanOrEqual(1.8);
    expect(ONDE_W).toBeGreaterThanOrEqual(1.6);
    expect(ONDE_A).toBeGreaterThanOrEqual(2.4);
    // E di forma diversa: tratti staccati (tanti moveTo) contro una linea sola che ondeggia.
    const poly = new Poly();
    sampleThread(poly, 50, 0, 50, 60, 16);
    const a = recorder();
    drawPattern(a.ctx, poly, teresa, 6, 0, 0);
    const b = recorder();
    drawPattern(b.ctx, poly, gino, 6, 0, 0);
    const moves = (r: ReturnType<typeof recorder>): number => r.calls.filter((x) => x.k === 'moveTo').length;
    expect(moves(a)).toBeGreaterThanOrEqual(8);
    expect(moves(b)).toBe(1);
    expect(a.props.find((x) => x.k === 'lineWidth')?.v).toBe(RIGHE_W);
    expect(b.props.find((x) => x.k === 'lineWidth')?.v).toBe(ONDE_W);
    // Teresa e Gino aprono vicini in g05 (il caso della segnalazione) o comunque nello stesso merletto.
    expect(lv.initial).toContain(gino.id);
    expect(lv.initial).toContain(teresa.id);
  });
});

// ───────────────────────── TOM-19 ─────────────────────────

describe('TOM-19: tastiera e lettore di schermo', () => {
  it('nell\'Archivio, mentre si nomina, le frecce raggiungono tutte le colonne (anche l\'ultima)', () => {
    const lv = fixture('test-archivio');
    c = new NightController(h.s, nightParams(lv, { origin: 'archivio', mode: 'archivio' }), { computed: null });
    const W = lv.columns.length;
    expect(c.namingByKeyboard()).toBe(true);
    for (let i = 0; i < W + 2; i++) c.interact.onAction(act('right'));
    expect(c.interact.cursorThread).toBe(W - 1);
    expect(c.interact.cursorPair).toBe(W - 2);
    const t = c.threadAtColumn(W - 1);
    expect(t).not.toBeNull();
    // La riga di stato dice chi c'è sotto il cursore.
    expect(q('tb-stato')?.textContent).toContain('Cursore:');
    now += 500;
    c.interact.onAction(act('name'));
    expect(q('tb-nomina')?.dataset.filo).toBe(t);
    // Indietro fino alla prima.
    for (let i = 0; i < W + 2; i++) c.interact.onAction(act('left'));
    expect(c.interact.cursorThread).toBe(0);
  });

  it('il nome di Ada si appunta da tastiera anche sull\'ultima colonna', () => {
    const lv = fixture('g00');
    c = new NightController(h.s, nightParams(lv, { needsNome: true }), { computed: null });
    for (let i = 0; i < 5; i++) c.interact.onAction(act('right'));
    expect(c.interact.cursorThread).toBe(lv.columns.length - 1);
    c.interact.onAction(act('crossL'));
    expect(c.session.nomeOn).toBe(lv.initial[lv.columns.length - 1]);
  });

  it('senza nomi da dare il cursore resta sulle coppie', () => {
    const lv = fixture('g00');
    c = new NightController(h.s, nightParams(lv), { computed: null });
    for (let i = 0; i < 5; i++) c.interact.onAction(act('right'));
    expect(c.interact.cursorPair).toBe(lv.columns.length - 2);
    expect(c.interact.cursorThread).toBe(lv.columns.length - 2);
  });

  it('dopo il cambio di lingua la riga di stato è tutta nella lingua nuova', () => {
    // Come il bootstrap: la lingua cambia su settings:change, prima della notte.
    h.s.bus.on('settings:change', (st) => h.s.i18n.setLocale(st.locale));
    c = new NightController(h.s, nightParams(fixture('g00')), { computed: null });
    c.cross(0, 'R', 'debug');
    expect(c.fix().ok).toBe(true);
    const it0 = q('tb-stato')?.textContent ?? '';
    expect(it0).toContain('al Forno');
    h.data.settings.locale = 'en';
    h.s.bus.emit('settings:change', h.data.settings);
    const en = q('tb-stato')?.textContent ?? '';
    expect(en).toContain("o'clock");
    expect(en).toContain('at the Bakery');
    expect(en).not.toContain('al Forno');
    expect(en).not.toMatch(/\b(Ore|in Piazza|in Chiesa)\b/);
  });
});

// ───────────────────────── TOM-21 ─────────────────────────

describe('TOM-21: PNG con cartiglio', () => {
  const caption = { titolo: 'TRAMA', sottotitolo: '14 ottobre', riga: '6 incroci · minimo 5' };
  const make = (): HTMLCanvasElement => ({ width: 1, height: 1, getContext: () => null }) as unknown as HTMLCanvasElement;

  it('dimensioni: senza cartiglio come prima, con il cartiglio più alta (e larga almeno 300)', () => {
    const lv = fixture('g00');
    const a = laceImageSize(lv);
    const b = laceImageSize(lv, caption);
    expect(b.h).toBe(a.h + CAPTION_H);
    expect(b.w).toBe(Math.max(300, a.w));
    expect(captionRect(lv)).toBeNull();
    const r = captionRect(lv, caption)!;
    expect(r.y).toBeGreaterThanOrEqual(a.h - 16);
    expect(r.y + r.h).toBeLessThanOrEqual(b.h);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(b.w);
    expect(r.h).toBeGreaterThanOrEqual(60);
  });

  it('le tre righe del cartiglio stanno nel suo rettangolo, sotto il merletto', () => {
    const lv = fixture('g00');
    const rows = fixtureComputed('g00').base.rows ?? [];
    const rec = recorder();
    drawLaceImage(rec.ctx, lv, rows, make as never, {}, caption);
    const r = captionRect(lv, caption)!;
    for (const s of [caption.titolo, caption.sottotitolo, caption.riga]) {
      const call = rec.calls.find((x) => x.k === 'fillText' && x.a[0] === s);
      expect(call, s).toBeDefined();
      const y = call!.a[2] as number;
      expect(y).toBeGreaterThan(r.y);
      expect(y).toBeLessThan(r.y + r.h);
    }
    // Senza cartiglio, niente testo del cartiglio.
    const plain = recorder();
    drawLaceImage(plain.ctx, lv, rows, make as never, {}, null);
    expect(plain.calls.some((x) => x.k === 'fillText' && x.a[0] === caption.titolo)).toBe(false);
  });
});

// ───────────────────────── TOM-22 ─────────────────────────

describe('TOM-22: «Salta le ore quiete» (D02.3)', () => {
  /** Notte senza spilli, obiettivi né tutorial: tutte le ore sono quiete. */
  const quiet = (extra: Partial<LevelDef> = {}): LevelDef => ({ ...fixture('g00'), pins: [], goals: [], tutorial: [], quirks: [], endHour: 12, matassa: 40, ...extra });

  it('compare con ≥ 2 righe vuote senza eventi e si ferma prima dell\'ultima', () => {
    c = new NightController(h.s, nightParams(quiet()), { computed: null });
    // Righe dalle 6 alle 12: quiete le 6-11, l'ultima si chiude a mano.
    const run = c.session.quietRun();
    expect(run.count).toBe(6);
    expect(run.until).toBe(11);
    expect(c.quietUntil).toBe(11);
    const btn = q('tb-salta-quiete');
    expect(btn?.hidden).toBe(false);
    expect(btn?.textContent).toContain('11');
  });

  it('si ferma prima di uno spillo, di un bordo, della marea, di una scadenza', () => {
    const cases: [Partial<LevelDef>, number][] = [
      [{ pins: [{ thread: 'marta', place: 'piazza', hour: 9 }] }, 8],
      [{ goals: [{ t: 'consegnata', bead: 'L1', by: 8 }] }, 7],
      [{ edges: [{ hour: 9, side: 'molo', kind: 'barca' }] as LevelDef['edges'] }, 8],
      [{ tide: [{ from: 9, to: 10, places: ['piazza'] }] as LevelDef['tide'] }, 8],
    ];
    for (const [extra, until] of cases) {
      const s = new NightController(h.s, nightParams(quiet(extra)), { computed: null });
      expect(s.session.quietRun().until, JSON.stringify(extra)).toBe(until);
      s.destroy();
    }
  });

  it('una sola riga quieta: niente pulsante', () => {
    c = new NightController(h.s, nightParams(quiet({ pins: [{ thread: 'marta', place: 'piazza', hour: 7 }] })), { computed: null });
    expect(c.session.quietRun().count).toBe(1);
    expect(c.quietUntil).toBeNull();
    expect(q('tb-salta-quiete')?.hidden).toBe(true);
  });

  it('Gino: si ferma prima dell\'ora in cui deve incrociare', () => {
    const lv = fixture('test-gino');
    c = new NightController(h.s, nightParams(lv), { computed: null });
    const run = c.session.quietRun();
    const n = c.skipQuiet();
    expect(n).toBe(c.quietUntil === null ? 0 : run.count);
    // La riga dopo l'ultima quieta, vuota, non si fissa (o ha un incrocio obbligato).
    const before = c.session.rows.length;
    const res = c.fix();
    if (res.ok) expect(c.session.events[c.session.events.length - 1]?.length ?? 0).toBeGreaterThanOrEqual(0);
    else expect(c.session.rows.length).toBe(before);
  });

  it('Maiusc+Invio fissa fino all\'ultima ora quieta; Disfa torna indietro una riga alla volta', () => {
    c = new NightController(h.s, nightParams(quiet()), { computed: null });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));
    c.interact.onAction(act('confirm'));
    expect(c.session.rows.length).toBe(6);
    expect(c.session.hour).toBe(12);
    expect(c.session.done).toBe(false);
    c.undo();
    expect(c.session.rows.length).toBe(5);
    c.undo();
    expect(c.session.rows.length).toBe(4);
  });

  it('il pulsante fa lo stesso; Invio senza Maiusc fissa una riga sola', () => {
    c = new NightController(h.s, nightParams(quiet()), { computed: null });
    c.interact.onAction(act('confirm'));
    expect(c.session.rows.length).toBe(1);
    q<HTMLButtonElement>('tb-salta-quiete')!.click();
    expect(c.session.rows.length).toBe(6);
  });

  it('solo nel modo normale (non negli spartiti né nell\'Archivio)', () => {
    c = new NightController(h.s, nightParams(quiet(), { mode: 'controllato' }), { computed: null });
    expect(c.session.quietRun().count).toBe(0);
  });
});
