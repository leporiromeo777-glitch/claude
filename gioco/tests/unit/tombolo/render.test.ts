import { describe, expect, it } from 'vitest';
import type { CharacterDef, CharacterId, ThreadPattern } from '../../../src/core/types';
import { THREAD_PATTERNS } from '../../../src/core/ids';
import { buildRowShape, SEG_OVER, SEG_UNDER, SEG_STRAIGHT, drawRow } from '../../../src/tombolo/render/threads';
import { drawThread } from '../../../src/tombolo/render/patterns';
import { Poly, sampleThread, pointAt, newPoint } from '../../../src/tombolo/render/curves';
import { StripCache } from '../../../src/tombolo/render/cache';
import { SpindleRig, SPRING_C, SPRING_K } from '../../../src/tombolo/render/spindles';
import { FlightPool } from '../../../src/tombolo/render/beads';
import { velvetNoise } from '../../../src/tombolo/render/velvet';
import { buildLaceModel, stacksOf, beadTypesOf, pressoOf } from '../../../src/tombolo/render/model';
import { buildVisuals, shade, visualOf, type ThreadVisual } from '../../../src/tombolo/visuals';
import { Session } from '../../../src/tombolo/session';
import { fixture, nightParams } from './helpers';

/** Contesto 2D finto che registra le chiamate (niente canvas in Node). */
function recorder(): { ctx: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(t, k) {
      if (typeof k !== 'string') return undefined;
      if (k in t) return t[k];
      return (...args: unknown[]) => {
        calls.push(k);
        void args;
        return undefined;
      };
    },
    set(t, k, v) {
      if (typeof k === 'string') {
        t[k] = v;
        calls.push(`${k}=${String(v)}`);
      }
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const CHARS = new Map<CharacterId, CharacterDef>();

function visual(pattern: ThreadPattern): ThreadVisual {
  return {
    id: 'x',
    kind: 'persona',
    character: null,
    color: '#2F5DA8',
    light: '#8FA6D9',
    dark: '#1A2F55',
    ink: '#FFFFFF',
    pattern,
    width: pattern === 'nessuno' ? 3.5 : 6,
    icon: null,
    spindle: 'fuso/lino',
    faded: false,
    edge: null,
  };
}

describe('forme delle righe', () => {
  it('incrocio: sopra, sotto, dritti', () => {
    const shape = buildRowShape(1, 6, ['teresa', 'marta', 'piero'], [{ pair: 0, over: 'R' }], ['marta', 'teresa', 'piero'], [], [], new Map(), false);
    const byThread = Object.fromEntries(shape.segs.map((s) => [s.thread, s]));
    expect(byThread.marta).toMatchObject({ from: 1, to: 0, role: SEG_OVER });
    expect(byThread.teresa).toMatchObject({ from: 0, to: 1, role: SEG_UNDER });
    expect(byThread.piero).toMatchObject({ from: 2, to: 2, role: SEG_STRAIGHT });
  });

  it('bordo: chi esce dal Molo e chi entra', () => {
    const shape = buildRowShape(2, 8, ['lino1', 'marta'], [], ['marinaio', 'marta'], [], [], new Map(), false);
    expect(shape.segs.find((s) => s.thread === 'lino1')?.exit).toBe(-1);
    expect(shape.segs.find((s) => s.thread === 'marinaio')?.enter).toBe(-1);
  });

  it('nodo del rancore e segni delle perline passate', () => {
    const types = new Map([['L1', 'lettera' as const]]);
    const shape = buildRowShape(
      1,
      7,
      ['teresa', 'marta'],
      [{ pair: 0, over: 'L' }],
      ['marta', 'teresa'],
      [
        { k: 'nodo', a: 'marta', b: 'teresa' },
        { k: 'passa', bead: 'L1', from: 'teresa', to: 'marta' },
      ],
      [],
      types,
      false,
    );
    expect(shape.crossings[0]?.knot).toBe(true);
    expect(shape.marks).toEqual([{ pair: 0, type: 'lettera', toLeft: false }]);
  });

  it('incroci forzati annunciati: fantasma', () => {
    const shape = buildRowShape(1, 9, ['a', 'livia'], [{ pair: 0, over: 'R', forced: true }], ['livia', 'a'], [], [], new Map(), true);
    expect(shape.segs.every((s) => s.ghost)).toBe(true);
  });

  it('una riga si disegna senza errori, con l\'interruzione sotto l\'incrocio', () => {
    const { ctx, calls } = recorder();
    const vis = new Map<string, ThreadVisual>();
    const shape = buildRowShape(1, 6, ['teresa', 'marta'], [{ pair: 0, over: 'R' }], ['marta', 'teresa'], [], [], new Map(), false);
    drawRow(ctx, shape, { colCx: [50, 110], colW: 60, left: 20, right: 140 }, 0, 50, vis, { gap: '#1C2233', time: 0, ghostAlpha: 0.5, marks: true });
    expect(calls.filter((c) => c === 'stroke').length).toBeGreaterThan(4);
    expect(calls).toContain('bezierCurveTo');
  });
});

describe('i 12 motivi', () => {
  it('ogni motivo lascia una traccia diversa', () => {
    const p = new Poly();
    sampleThread(p, 0, 0, 0, 120, 16);
    const sig = new Map<string, ThreadPattern>();
    for (const pat of THREAD_PATTERNS) {
      const { ctx, calls } = recorder();
      drawThread(ctx, p, visual(pat), 0, 0);
      const widths = [...new Set(calls.filter((c) => c.startsWith('lineWidth=')))].sort().join(',');
      const key = `${calls.length}|${calls.filter((c) => c === 'arc').length}|${calls.filter((c) => c === 'ellipse').length}|${calls.filter((c) => c === 'lineTo').length}|${calls.filter((c) => c === 'setLineDash').length}|${widths}`;
      expect(sig.has(key), `${pat} uguale a ${sig.get(key)}`).toBe(false);
      sig.set(key, pat);
    }
    expect(sig.size).toBe(12);
  });

  it('i colori dei fili vengono dai personaggi; i lino sono sottili e senza icona', () => {
    const lv = fixture('test-motivi');
    const chars = new Map<CharacterId, CharacterDef>([
      ['teresa', { id: 'teresa', nameKey: 'n', roleKey: 'r', color: '#2F5DA8', pattern: 'righe', icon: 'busta', noteHz: 440, voice: null, hand: null, quirks: [], likes: [] }],
    ]);
    const v = buildVisuals(lv, chars);
    expect(v.get('teresa')).toMatchObject({ color: '#2F5DA8', pattern: 'righe', icon: 'busta', width: 6 });
    expect(v.get('lino1')).toMatchObject({ pattern: 'nessuno', icon: null, width: 3.5 });
    expect(visualOf(v, 'lino9').kind).toBe('lino');
    expect(shade('#000000', 1)).toBe('#ffffff');
  });

  it('fili sbiaditi dell\'Archivio: grigi e senza icona finché non si nominano', () => {
    const lv = fixture('test-archivio');
    const v = buildVisuals(lv, CHARS, { faded: (id) => id !== 'f1', confirmedAs: (id) => (id === 'f1' ? 'marta' : null) });
    expect(v.get('f2')?.faded).toBe(true);
    expect(v.get('f2')?.icon).toBeNull();
    expect(v.get('f1')?.character).toBe('marta');
  });
});

describe('curve, perline, fusi, velluto', () => {
  it('punti lungo la curva', () => {
    const p = new Poly();
    sampleThread(p, 10, 0, 10, 100);
    expect(p.total()).toBeCloseTo(100, 0);
    const q = pointAt(p, 50, newPoint());
    expect(q.x).toBeCloseTo(10);
    expect(q.y).toBeCloseTo(50, 0);
  });

  it('pendolo a molla: rigidità 40, smorzamento 6, si ferma', () => {
    expect(SPRING_K).toBe(40);
    expect(SPRING_C).toBe(6);
    const rig = new SpindleRig();
    rig.assign(['a', 'b'], [10, 70], 0, null, new Map());
    rig.kick('a', 2);
    rig.update(1 / 60, 1);
    expect(Math.abs(rig.get('a')!.angle)).toBeGreaterThan(0);
    for (let i = 0; i < 600; i++) rig.update(1 / 60, 1);
    expect(Math.abs(rig.get('a')!.angle)).toBeLessThan(0.001);
  });

  it('scambio di colonna animato; istantaneo con il movimento ridotto', () => {
    const rig = new SpindleRig();
    rig.assign(['a', 'b'], [10, 70], 0, null, new Map());
    rig.assign(['b', 'a'], [10, 70], 0.25, null, new Map());
    rig.update(0.1, 1);
    const x = rig.get('a')!.x;
    expect(x).toBeGreaterThan(10);
    expect(x).toBeLessThan(70);
    for (let i = 0; i < 30; i++) rig.update(1 / 60, 1);
    expect(rig.get('a')!.x).toBe(70);
    const r2 = new SpindleRig();
    r2.reduced = true;
    r2.assign(['a', 'b'], [10, 70], 0, null, new Map());
    r2.assign(['b', 'a'], [10, 70], 0.25, null, new Map());
    expect(r2.get('a')!.x).toBe(70);
  });

  it('perline in volo per 350 ms', () => {
    const f = new FlightPool(4);
    f.launch('lettera', 'L1', 'piero', true, 0, 0, 0, 40, 0.35, 30);
    expect(f.flying('piero', 'L1')).toBe(true);
    f.update(0.2);
    expect(f.any()).toBe(true);
    f.update(0.2);
    expect(f.any()).toBe(false);
  });

  it('velluto deterministico, valori fra 0 e 1', () => {
    const a = velvetNoise();
    const b = velvetNoise();
    expect(a.length).toBe(256 * 256);
    expect(a[1234]).toBe(b[1234]);
    for (let i = 0; i < a.length; i += 997) {
      expect(a[i]!).toBeGreaterThanOrEqual(0);
      expect(a[i]!).toBeLessThanOrEqual(1);
    }
  });
});

describe('cache delle righe fissate (strisce da 8)', () => {
  function fakeCanvasMaker(): (w: number, h: number) => HTMLCanvasElement {
    return (w, h) => {
      const { ctx } = recorder();
      return { width: w, height: h, getContext: () => ctx } as unknown as HTMLCanvasElement;
    };
  }

  it('ridisegna solo quando cambiano le righe, e in fondo solo le nuove', () => {
    const cache = new StripCache(fakeCanvasMaker());
    cache.configure(300, 2, 40, 24, 14);
    const { ctx } = recorder();
    const painted: [number, number][] = [];
    const paint = (_c: CanvasRenderingContext2D, from: number, to: number): void => {
      painted.push([from, to]);
    };
    cache.draw(ctx, 0, 0, 0, 2000, ['a', 'b'], paint);
    expect(painted).toEqual([[0, 2]]);
    cache.draw(ctx, 0, 0, 0, 2000, ['a', 'b'], paint);
    expect(painted).toHaveLength(1);
    cache.draw(ctx, 0, 0, 0, 2000, ['a', 'b', 'c'], paint);
    expect(painted[1]).toEqual([2, 3]);
    cache.draw(ctx, 0, 0, 0, 2000, ['a', 'x'], paint);
    expect(painted[2]).toEqual([0, 2]);
    const many = Array.from({ length: 12 }, (_, i) => `r${i}`);
    cache.draw(ctx, 0, 0, 0, 2000, many, paint);
    expect(painted.slice(3)).toEqual([
      [0, 8],
      [8, 12],
    ]);
  });
});

describe('modello di disegno', () => {
  it('spilli: acceso quando il filo c\'è, irraggiungibile in rosso con l\'ora', () => {
    const lv = fixture('g00');
    const s = new Session(nightParams(lv));
    const vis = buildVisuals(lv, CHARS);
    let m = buildLaceModel({ session: s, visuals: vis, visualsVersion: 0, gradi: [], placingOccasions: false, echoesOpen: false }, null);
    expect(m.pins.find((p) => p.index === 1)?.state).toBe('normale');
    s.propose({ pair: 0, over: 'R' });
    m = buildLaceModel({ session: s, visuals: vis, visualsVersion: 0, gradi: [], placingOccasions: false, echoesOpen: false }, m);
    expect(m.pins.find((p) => p.index === 1)?.state).toBe('acceso');
    expect(m.liveShape?.crossings).toHaveLength(1);
    // Spilli velati: si vedono solo 2 ore prima.
    const hidden = buildLaceModel({ session: s, visuals: vis, visualsVersion: 0, gradi: ['spilliVelati'], placingOccasions: false, echoesOpen: false }, null);
    expect(hidden.pins.some((p) => p.index === 4)).toBe(false);
    // Irraggiungibile: Don Piero lontano dalla Chiesa a un'ora dalle 9.
    const t = new Session(nightParams(lv));
    t.propose({ pair: 0, over: 'R' });
    t.fix();
    t.propose({ pair: 1, over: 'L' });
    t.fix();
    t.propose({ pair: 0, over: 'L' });
    t.fix();
    const mt = buildLaceModel({ session: t, visuals: vis, visualsVersion: 0, gradi: [], placingOccasions: false, echoesOpen: false }, null);
    const piero = mt.pins.find((p) => p.index === 4 && p.col === 2);
    expect(piero?.state).toBe('irraggiungibile');
    expect(piero?.label).toBe('9');
  });

  it('firme a catena: cambia una riga, cambiano le seguenti', () => {
    const lv = fixture('g00');
    const vis = buildVisuals(lv, CHARS);
    const a = new Session(nightParams(lv));
    a.propose({ pair: 0, over: 'R' });
    a.fix();
    a.fix();
    const b = new Session(nightParams(lv));
    b.propose({ pair: 0, over: 'L' });
    b.fix();
    b.fix();
    const ma = buildLaceModel({ session: a, visuals: vis, visualsVersion: 0, gradi: [], placingOccasions: false, echoesOpen: false }, null);
    const mb = buildLaceModel({ session: b, visuals: vis, visualsVersion: 0, gradi: [], placingOccasions: false, echoesOpen: false }, null);
    expect(ma.rowSigs[0]).toBe(mb.rowSigs[0]);
    expect(ma.rowSigs[1]).not.toBe(mb.rowSigs[1]);
    expect(ma.rowSigs[2]).not.toBe(mb.rowSigs[2]);
  });

  it('pile di perline per filo, nell\'ordine lettera, voce, segreto, febbre, nome', () => {
    const lv = fixture('g00');
    const st = new Session(nightParams(lv)).preview().state;
    const stacks = stacksOf(st, beadTypesOf(lv));
    expect(stacks[0]?.thread).toBe('teresa');
    expect(stacks[0]?.beads.map((b) => b.type)).toEqual(['lettera', 'segreto']);
  });

  it('spilli rossi dalle richieste "presso"', () => {
    expect(pressoOf({ t: 'tutti', of: [{ t: 'presso', who: 'nina', place: 'molo', hour: 9 }, { t: 'sano', who: 'nina' }] })).toEqual([{ who: 'nina', place: 'molo', hour: 9 }]);
  });
});
