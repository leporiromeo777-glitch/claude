import { describe, expect, it } from 'vitest';
import { clampDpr, computeLayout, computeViewport, parsePx, sameViewport } from '../../../src/core/viewport';

describe('viewport', () => {
  it('layout largo se cssW ≥ 900 e rapporto ≥ 1,15', () => {
    expect(computeLayout(1280, 720)).toBe('largo');
    expect(computeLayout(1180, 820)).toBe('largo');
    expect(computeLayout(900, 782)).toBe('largo');
    expect(computeLayout(900, 784)).toBe('stretto');
    expect(computeLayout(899, 400)).toBe('stretto');
    expect(computeLayout(390, 844)).toBe('stretto');
    expect(computeLayout(1024, 1366)).toBe('stretto');
  });

  it('dpr limitato a 2', () => {
    expect(clampDpr(3)).toBe(2);
    expect(clampDpr(1.5)).toBe(1.5);
    expect(clampDpr(undefined)).toBe(1);
    expect(clampDpr(Number.NaN)).toBe(1);
  });

  it('valori in px della safe area', () => {
    expect(parsePx('47px')).toBe(47);
    expect(parsePx('34.5px')).toBe(34.5);
    expect(parsePx('')).toBe(0);
    expect(parsePx('auto')).toBe(0);
  });

  it('computeViewport e confronto', () => {
    const safe = { top: 47, right: 0, bottom: 34, left: 0 };
    const a = computeViewport(390.4, 844, 3, safe, 1.2);
    expect(a).toEqual({ cssW: 390, cssH: 844, dpr: 2, safe, orientation: 'portrait', layout: 'stretto', textScale: 1.2 });
    expect(sameViewport(a, computeViewport(390, 844, 3, { ...safe }, 1.2))).toBe(true);
    expect(sameViewport(a, computeViewport(390, 844, 3, { ...safe, top: 0 }, 1.2))).toBe(false);
    expect(computeViewport(844, 390, 2, safe, 1).orientation).toBe('landscape');
  });
});
