/**
 * Gesti veri (ARCHITETTURA 15.2, suite `prologo`): il mouse di Playwright sui
 * progetti senza tocco, eventi touch del protocollo DevTools (Input.dispatchTouchEvent)
 * sui progetti con `hasTouch`. Chromium li trasforma in eventi pointer di tipo
 * 'touch', gli stessi di un telefono. Le coordinate vengono da `night.layout()`.
 */
import type { Page, TestInfo } from '@playwright/test';
import { call } from './game';

export type PointerKind = 'mouse' | 'touch';

export interface Point {
  x: number;
  y: number;
}

/** Il puntatore del progetto: tocco se il progetto ha `hasTouch`, altrimenti mouse. */
export function pointerOf(testInfo: TestInfo): PointerKind {
  return testInfo.project.use.hasTouch ? 'touch' : 'mouse';
}

/** Rettangoli in px CSS restituiti da `__GAME__.night.layout()`. */
export interface NightLayout {
  kind: 'largo' | 'stretto';
  viewport: { w: number; h: number };
  colW: number;
  rowH: number;
  lace: { x: number; y: number; w: number; h: number };
  center: { x: number; y: number; w: number; h: number };
  spindleBand: { x: number; y: number; w: number; h: number };
  columns: { x: number; w: number; cx: number }[];
  rows: { index: number; hour: number; y: number; h: number; kind: string }[];
  currentRow: { index: number; hour: number; y: number; h: number } | null;
  spindles: { col: number; thread: string; x: number; y: number; w: number; h: number; cx: number; cy: number }[];
  buttons: Record<string, { x: number; y: number; w: number; h: number } | null>;
  tokens: { noteId: string; rect: { x: number; y: number; w: number; h: number } | null }[];
}

export const nightLayout = (page: Page): Promise<NightLayout> => call<NightLayout>(page, 'night.layout');

async function withTouch<T>(page: Page, fn: (send: (type: string, points: Point[]) => Promise<void>) => Promise<T>): Promise<T> {
  const cdp = await page.context().newCDPSession(page);
  try {
    return await fn(async (type, points) => {
      await cdp.send('Input.dispatchTouchEvent', { type: type as 'touchStart', touchPoints: points.map((p) => ({ x: p.x, y: p.y })) });
    });
  } finally {
    await cdp.detach().catch(() => undefined);
  }
}

/** Trascinamento continuo da `from` a `to` (passi da ~16 ms, come un dito vero). */
export async function drag(page: Page, kind: PointerKind, from: Point, to: Point, steps = 14): Promise<void> {
  if (kind === 'mouse') {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
  } else {
    await withTouch(page, async (send) => {
      await send('touchStart', [from]);
      for (let i = 1; i <= steps; i++) {
        await page.waitForTimeout(16);
        await send('touchMove', [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }]);
      }
      await send('touchEnd', []);
    });
  }
  await page.waitForTimeout(250);
}

/** Tocco o clic breve. */
export async function tap(page: Page, kind: PointerKind, p: Point): Promise<void> {
  if (kind === 'mouse') {
    await page.mouse.click(p.x, p.y);
  } else {
    await withTouch(page, async (send) => {
      await send('touchStart', [p]);
      await page.waitForTimeout(40);
      await send('touchEnd', []);
    });
  }
  await page.waitForTimeout(220);
}

/** Pressione lunga (scheda del personaggio). */
export async function longPress(page: Page, kind: PointerKind, p: Point, ms = 700): Promise<void> {
  if (kind === 'mouse') {
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(ms);
    await page.mouse.up();
  } else {
    await withTouch(page, async (send) => {
      await send('touchStart', [p]);
      await page.waitForTimeout(ms);
      await send('touchEnd', []);
    });
  }
  await page.waitForTimeout(220);
}

/** Centro del primo elemento visibile con quel selettore (null se non c'è). */
export async function centerOf(page: Page, selector: string): Promise<Point | null> {
  const loc = page.locator(selector).first();
  if (!(await loc.isVisible().catch(() => false))) return null;
  const r = await loc.boundingBox();
  return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
}

/**
 * Tocca (o clicca) un elemento del DOM per `data-test`, con le attese di Playwright:
 * l'elemento si porta nella vista e deve ricevere davvero il puntatore (non coperto).
 * Restituisce false se in 5 s non è toccabile.
 */
export async function tapTest(page: Page, kind: PointerKind, dataTest: string, timeout = 5_000): Promise<boolean> {
  const loc = page.locator(`[data-test="${dataTest}"]`).first();
  try {
    if (kind === 'touch') await loc.tap({ timeout });
    else await loc.click({ timeout });
  } catch {
    return false;
  }
  await page.waitForTimeout(200);
  return true;
}

/** Trascina il fuso della colonna `fromCol` sopra la colonna `toCol`. */
export async function dragSpindle(page: Page, kind: PointerKind, fromCol: number, toCol: number): Promise<void> {
  const l = await nightLayout(page);
  const a = l.spindles[fromCol];
  const b = l.spindles[toCol];
  if (!a || !b) throw new Error(`fusi ${fromCol}→${toCol} non trovati nel layout`);
  await drag(page, kind, { x: a.cx, y: a.cy }, { x: b.cx, y: a.cy });
}

/** Tocca l'incrocio della coppia `pair` nella riga corrente (rovescia). */
export async function tapCrossing(page: Page, kind: PointerKind, pair: number): Promise<void> {
  const l = await nightLayout(page);
  const r = l.currentRow;
  const a = l.columns[pair];
  const b = l.columns[pair + 1];
  if (!r || !a || !b) throw new Error(`riga corrente o colonne ${pair}/${pair + 1} assenti`);
  await tap(page, kind, { x: (a.cx + b.cx) / 2, y: r.y + r.h / 2 });
}

/**
 * «Fissa l'ora» con il puntatore, al centro del pulsante come farebbe una persona
 * (il pulsante può pulsare per il tutorial: niente attese di «stabilità»).
 */
export async function pressFix(page: Page, kind: PointerKind): Promise<void> {
  const p = await centerOf(page, '[data-test="tb-fissa"]');
  if (!p) throw new Error('pulsante tb-fissa non visibile');
  await tap(page, kind, p);
}
