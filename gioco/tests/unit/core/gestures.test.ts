import { describe, expect, it } from 'vitest';
import type { Gesture } from '../../../src/core/types';
import {
  DRAG_THRESHOLD,
  GestureRecognizer,
  LONGPRESS_MS,
  TAP_MAX_MOVE,
  TAP_MAX_MS,
  type PointerSample,
} from '../../../src/core/gestures';

function setup(): { r: GestureRecognizer; out: Gesture[] } {
  const out: Gesture[] = [];
  return { r: new GestureRecognizer((g) => out.push(g)), out };
}
const P = (x: number, y: number, t: number, extra: Partial<PointerSample> = {}): PointerSample => ({
  id: 1,
  x,
  y,
  t,
  pointer: 'touch',
  button: 0,
  ...extra,
});
const kinds = (out: Gesture[]): string[] => out.map((g) => g.k);

describe('soglie dei gesti', () => {
  it('le costanti sono quelle di ARCHITETTURA 7', () => {
    expect(TAP_MAX_MOVE).toBe(10);
    expect(TAP_MAX_MS).toBe(300);
    expect(LONGPRESS_MS).toBe(500);
    expect(DRAG_THRESHOLD).toBe(8);
  });

  it('tocco breve e fermo → tap con le coordinate di partenza', () => {
    const { r, out } = setup();
    r.down(P(100, 200, 0));
    r.move(P(103, 202, 50));
    r.up(P(103, 202, 120));
    expect(out).toEqual([{ k: 'tap', x: 100, y: 200, pointer: 'touch', button: 0 }]);
  });

  it('tap al limite: 300 ms e 8 px di spostamento', () => {
    const { r, out } = setup();
    r.down(P(0, 0, 0));
    r.move(P(8, 0, 100));
    r.up(P(8, 0, 300));
    expect(kinds(out)).toEqual(['tap']);
  });

  it('oltre 300 ms non è un tap (e prima di 500 ms non è una pressione lunga)', () => {
    const { r, out } = setup();
    r.down(P(0, 0, 0));
    r.tick(200);
    r.up(P(0, 0, 301));
    expect(out).toEqual([]);
  });

  it('pressione lunga dopo 500 ms ferma: niente tap al rilascio', () => {
    const { r, out } = setup();
    r.down(P(50, 60, 1000));
    r.tick(1499);
    expect(out).toEqual([]);
    r.tick(1500);
    expect(out).toEqual([{ k: 'longpress', x: 50, y: 60, pointer: 'touch' }]);
    r.move(P(80, 60, 1600)); // dopo la pressione lunga i movimenti non trascinano
    r.up(P(80, 60, 1700));
    expect(kinds(out)).toEqual(['longpress']);
  });

  it('la pressione lunga ammette un tremolio entro 10 px', () => {
    const { r, out } = setup();
    r.down(P(0, 0, 0));
    r.move(P(5, 5, 100)); // 7 px
    r.tick(520);
    expect(kinds(out)).toEqual(['longpress']);
  });

  it('pressione lunga riconosciuta anche al rilascio se il timer è in ritardo', () => {
    const { r, out } = setup();
    r.down(P(0, 0, 0));
    r.up(P(0, 0, 650));
    expect(kinds(out)).toEqual(['longpress']);
  });

  it('oltre 8 px parte il trascinamento: dragstart, drag…, dragend', () => {
    const { r, out } = setup();
    r.down(P(10, 10, 0));
    r.move(P(15, 10, 16)); // 5 px: ancora niente
    expect(out).toEqual([]);
    r.move(P(19, 10, 32)); // 9 px: dragstart
    r.move(P(40, 14, 48));
    r.up(P(60, 20, 64));
    expect(kinds(out)).toEqual(['dragstart', 'drag', 'dragend']);
    const end = out[2];
    expect(end).toMatchObject({ k: 'dragend', x: 60, y: 20, startX: 10, startY: 10, dx: 50, dy: 10 });
  });

  it('un trascinamento non diventa mai pressione lunga', () => {
    const { r, out } = setup();
    r.down(P(0, 0, 0));
    r.move(P(20, 0, 50));
    r.tick(900);
    r.up(P(20, 0, 950));
    expect(kinds(out)).toEqual(['dragstart', 'dragend']);
  });

  it('pointercancel durante il trascinamento → dragcancel', () => {
    const { r, out } = setup();
    r.down(P(0, 0, 0));
    r.move(P(0, 30, 20));
    r.cancel({ id: 1 });
    expect(kinds(out)).toEqual(['dragstart', 'dragcancel']);
    expect(r.active()).toBe(false);
  });

  it('un solo puntatore: il secondo è ignorato finché il primo non finisce', () => {
    const { r, out } = setup();
    expect(r.down(P(0, 0, 0))).toBe(true);
    expect(r.down(P(100, 100, 10, { id: 2 }))).toBe(false);
    r.move(P(130, 100, 20, { id: 2 }));
    r.up(P(130, 100, 30, { id: 2 }));
    expect(out).toEqual([]);
    r.up(P(0, 0, 40));
    expect(kinds(out)).toEqual(['tap']);
    expect(r.down(P(5, 5, 100, { id: 2 }))).toBe(true);
  });

  it('tasto destro del mouse: solo tap con button 2, niente trascinamento', () => {
    const { r, out } = setup();
    r.down(P(10, 10, 0, { pointer: 'mouse', button: 2 }));
    r.up(P(11, 10, 90, { pointer: 'mouse', button: 2 }));
    expect(out).toEqual([{ k: 'tap', x: 10, y: 10, pointer: 'mouse', button: 2 }]);
    out.length = 0;
    r.down(P(10, 10, 200, { pointer: 'mouse', button: 2 }));
    r.move(P(60, 10, 220, { pointer: 'mouse', button: 2 }));
    r.up(P(60, 10, 240, { pointer: 'mouse', button: 2 }));
    expect(out).toEqual([]);
  });

  it('rotella', () => {
    const { r, out } = setup();
    r.wheel(5, 6, -120);
    expect(out).toEqual([{ k: 'wheel', x: 5, y: 6, dy: -120 }]);
  });
});
