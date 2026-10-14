import { describe, expect, it } from 'vitest';
import type { Viewport } from '../../../src/core/types';
import { computeViewport } from '../../../src/core/viewport';
import { BAND, COL_MIN, autoScroll, columnAt, computeTomboloLayout, pairAt, rowBottom, rowTop, scrollLimits } from '../../../src/tombolo/layout';

const NO_SAFE = { top: 0, right: 0, bottom: 0, left: 0 };
function vp(w: number, h: number, safe = NO_SAFE): Viewport {
  return computeViewport(w, h, 2, safe, 1);
}

describe('layout del tombolo (GDD 10.2-10.3)', () => {
  it('telefono 390×844: fasce 52/40/36/128/72 e colonne ≥ 52 px', () => {
    const l = computeTomboloLayout(vp(390, 844), 6, 14);
    expect(l.kind).toBe('stretto');
    expect(l.hud.h).toBe(BAND.hud);
    expect(l.header.h).toBe(BAND.header);
    expect(l.requests.h).toBe(BAND.requests);
    expect(l.spindles.h).toBe(BAND.spindles);
    expect(l.actions.h).toBe(BAND.actions);
    expect(l.hud.y).toBe(0);
    expect(l.actions.y + l.actions.h).toBe(844);
    expect(l.lace.y).toBe(92);
    expect(l.lace.y + l.lace.h).toBe(l.requests.y);
    expect(l.colW).toBeGreaterThanOrEqual(COL_MIN);
    expect(l.rowH).toBeGreaterThanOrEqual(40);
    expect(l.rowH).toBeLessThanOrEqual(56);
    expect(l.left).toBeNull();
    expect(l.right).toBeNull();
  });

  it('telefono piccolo 360×640: 6 colonne larghe almeno 52 px', () => {
    const l = computeTomboloLayout(vp(360, 640), 6, 14);
    expect(l.colW).toBeGreaterThanOrEqual(52);
    expect(l.colX[5]! + l.colW).toBeLessThanOrEqual(360);
    expect(l.lace.h).toBe(640 - 52 - 40 - 36 - 128 - 72);
  });

  it('la safe area restringe le fasce', () => {
    const l = computeTomboloLayout(vp(390, 844, { top: 47, right: 0, bottom: 34, left: 0 }), 6, 10);
    expect(l.hud.y).toBe(47);
    expect(l.actions.y + l.actions.h).toBe(844 - 34);
  });

  it('largo 1280×720: Bigliettini 300, tombolo ≤ 640 al centro, Taccuino 320', () => {
    const l = computeTomboloLayout(vp(1280, 720), 6, 14);
    expect(l.kind).toBe('largo');
    expect(l.left).toEqual({ x: 0, y: 0, w: 300, h: 720 });
    expect(l.right).toEqual({ x: 960, y: 0, w: 320, h: 720 });
    expect(l.center.w).toBeLessThanOrEqual(640);
    expect(l.center.x).toBeGreaterThanOrEqual(300);
    expect(l.center.x + l.center.w).toBeLessThanOrEqual(960);
  });

  it('iPad orizzontale 1180×820: ancora tre pannelli', () => {
    const l = computeTomboloLayout(vp(1180, 820), 6, 12);
    expect(l.kind).toBe('largo');
    expect(l.right).not.toBeNull();
    expect(l.rightCollapsed).toBe(false);
  });

  it('larghezze intermedie: il Taccuino a destra si chiude', () => {
    const l = computeTomboloLayout(vp(1000, 800), 6, 12);
    expect(l.kind).toBe('largo');
    expect(l.rightCollapsed).toBe(true);
    expect(l.right).toBeNull();
    expect(l.left).not.toBeNull();
  });

  it('telefono in orizzontale: stretto, centrato, al massimo 520 px', () => {
    const l = computeTomboloLayout(vp(844, 390), 5, 8);
    expect(l.kind).toBe('stretto');
    expect(l.center.w).toBe(520);
    expect(l.center.x).toBe(Math.round((844 - 520) / 2));
  });

  it('tablet verticale: al massimo 720 px', () => {
    const l = computeTomboloLayout(vp(820, 1180), 6, 12);
    expect(l.center.w).toBe(720);
  });

  it('righe, colonne e coppie sotto il dito', () => {
    const l = computeTomboloLayout(vp(390, 844), 3, 4);
    expect(rowTop(l, 0)).toBe(0);
    expect(rowBottom(l, 0)).toBe(l.openH);
    expect(rowTop(l, 2)).toBe(l.openH + l.rowH);
    expect(columnAt(l, l.colCx[1]!)).toBe(1);
    expect(columnAt(l, 0)).toBe(-1);
    expect(pairAt(l, (l.colCx[0]! + l.colCx[1]!) / 2)).toBe(0);
    expect(pairAt(l, (l.colCx[1]! + l.colCx[2]!) / 2)).toBe(1);
  });

  it('scorrimento: merletto corto in alto, lungo con due righe future sotto la corrente', () => {
    const short = computeTomboloLayout(vp(390, 844), 3, 4);
    expect(autoScroll(short, 1)).toBeLessThan(0);
    const long = computeTomboloLayout(vp(360, 640), 6, 14);
    const s = autoScroll(long, 10);
    const curBottomOnScreen = rowBottom(long, 10) - s;
    expect(curBottomOnScreen + 2 * long.rowH).toBeLessThanOrEqual(long.lace.h);
    const lim = scrollLimits(long, 10);
    expect(lim.min).toBeLessThanOrEqual(0);
    expect(lim.max).toBeGreaterThanOrEqual(s);
  });
});
