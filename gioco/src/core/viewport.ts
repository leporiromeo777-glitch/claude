/**
 * Dimensioni, DPR, safe area e disposizione (ARCHITETTURA 8, GDD 10.2).
 *
 * - dpr = min(devicePixelRatio, 2).
 * - Safe area letta da un `<div id="safe-probe">` invisibile il cui padding vale
 *   `max(env(safe-area-inset-*), var(--safe-area-inset-*))`: così funzionano sia
 *   le safe area vere (iOS, Android recenti) sia le variabili che SystemBars di
 *   Capacitor inietta sulle WebView vecchie, e i test possono simularle.
 *   Nota: env() con valore di riserva non basta, perché sui browser che
 *   definiscono la variabile (anche a 0) la riserva non si usa mai.
 * - Layout 'largo' se cssW ≥ 900 e cssW/cssH ≥ 1,15; altrimenti 'stretto'.
 * - Aggiornamento su ResizeObserver, visualViewport.resize, orientationchange e
 *   sui cambi di stile di <html> (variabili della safe area, dimensione del testo),
 *   con un debounce di 50 ms; emette 'viewport:change' solo se qualcosa cambia.
 */
import type { SafeArea, Viewport } from './types';

export const LARGO_MIN_WIDTH = 900;
export const LARGO_MIN_RATIO = 1.15;
export const MAX_DPR = 2;
export const VIEWPORT_DEBOUNCE_MS = 50;

export function computeLayout(cssW: number, cssH: number): Viewport['layout'] {
  return cssW >= LARGO_MIN_WIDTH && cssH > 0 && cssW / cssH >= LARGO_MIN_RATIO ? 'largo' : 'stretto';
}

export function clampDpr(dpr: number | undefined): number {
  const d = typeof dpr === 'number' && Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  return Math.min(d, MAX_DPR);
}

/** "47px" → 47; valori non validi → 0. */
export function parsePx(v: string | null | undefined): number {
  const n = Number.parseFloat(v ?? '');
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

export function readSafeArea(probe: HTMLElement | null, win: Window | null): SafeArea {
  if (!probe || !win) return { top: 0, right: 0, bottom: 0, left: 0 };
  const cs = win.getComputedStyle(probe);
  return {
    top: parsePx(cs.paddingTop),
    right: parsePx(cs.paddingRight),
    bottom: parsePx(cs.paddingBottom),
    left: parsePx(cs.paddingLeft),
  };
}

export function computeViewport(
  cssW: number,
  cssH: number,
  dpr: number | undefined,
  safe: SafeArea,
  textScale: number,
): Viewport {
  const w = Math.max(0, Math.round(cssW));
  const h = Math.max(0, Math.round(cssH));
  return {
    cssW: w,
    cssH: h,
    dpr: clampDpr(dpr),
    safe,
    orientation: w > h ? 'landscape' : 'portrait',
    layout: computeLayout(w, h),
    textScale,
  };
}

export function sameViewport(a: Viewport, b: Viewport): boolean {
  return (
    a.cssW === b.cssW &&
    a.cssH === b.cssH &&
    a.dpr === b.dpr &&
    a.orientation === b.orientation &&
    a.layout === b.layout &&
    a.textScale === b.textScale &&
    a.safe.top === b.safe.top &&
    a.safe.right === b.safe.right &&
    a.safe.bottom === b.safe.bottom &&
    a.safe.left === b.safe.left
  );
}

export interface ViewportDeps {
  win: Window;
  container: HTMLElement;
  probe: HTMLElement | null;
  textScale: () => number;
  onChange: (vp: Viewport) => void;
}

export interface ViewportService {
  get(): Viewport;
  /** Rilegge subito dimensioni e safe area; restituisce il nuovo viewport. */
  refresh(): Viewport;
  destroy(): void;
}

export function createViewport(deps: ViewportDeps): ViewportService {
  const { win, container, probe } = deps;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function measure(): Viewport {
    const r = container.getBoundingClientRect();
    const w = r.width || win.innerWidth;
    const h = r.height || win.innerHeight;
    return computeViewport(w, h, win.devicePixelRatio, readSafeArea(probe, win), deps.textScale());
  }

  let current = measure();

  function refresh(): Viewport {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    const next = measure();
    if (!sameViewport(next, current)) {
      current = next;
      deps.onChange(current);
    }
    return current;
  }

  function schedule(): void {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      refresh();
    }, VIEWPORT_DEBOUNCE_MS);
  }

  const cleanups: (() => void)[] = [];
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(schedule);
    ro.observe(container);
    cleanups.push(() => ro.disconnect());
  }
  win.addEventListener('resize', schedule);
  win.addEventListener('orientationchange', schedule);
  cleanups.push(() => {
    win.removeEventListener('resize', schedule);
    win.removeEventListener('orientationchange', schedule);
  });
  const vv = win.visualViewport;
  if (vv) {
    vv.addEventListener('resize', schedule);
    cleanups.push(() => vv.removeEventListener('resize', schedule));
  }
  if (typeof MutationObserver !== 'undefined') {
    // Le variabili --safe-area-inset-* (SystemBars, test) e --text-scale stanno su <html>.
    const mo = new MutationObserver(schedule);
    mo.observe(win.document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    cleanups.push(() => mo.disconnect());
  }

  return {
    get: () => current,
    refresh,
    destroy() {
      if (timer !== null) clearTimeout(timer);
      for (const c of cleanups.splice(0)) c();
    },
  };
}
