/**
 * Comportamento da app, non da pagina web (GDD 11.1, 11.4 e 17 «Per la pubblicazione
 * sugli store»: niente selezione del testo, zoom, menu del tocco prolungato, rimbalzo
 * dello scroll). Gli stessi controlli valgono nel WebView di Capacitor, che usa lo
 * stesso CSS e lo stesso codice:
 *  - viewport senza zoom (`user-scalable=no`, `viewport-fit=cover` per la safe area);
 *  - testo non selezionabile (anche con il triplo clic), tranne i campi dove si incolla
 *    o si copia (lo spartito e la stringa di esportazione);
 *  - menu contestuale del browser soppresso (tasto destro, pressione lunga);
 *  - pizzico e doppio tocco non ingrandiscono; la pagina non scorre né rimbalza
 *    trascinando sul tombolo.
 */
import type { Page } from '@playwright/test';
import { call, expect, onlyProjects, PLAY_PROJECTS, test, waitNight, waitScene } from './helpers/game';
import { nightLayout, pointerOf, tapTest } from './helpers/pointer';

/** Registra, dopo il gioco, se i menu contestuali sono stati soppressi. */
async function watchContextMenu(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __qaCtx: boolean[] };
    w.__qaCtx = [];
    // Ascoltatore aggiunto dopo quello del gioco sullo stesso bersaglio: vede l'esito.
    window.addEventListener('contextmenu', (e) => w.__qaCtx.push(e.defaultPrevented));
  });
}

const contextMenus = (page: Page): Promise<boolean[]> => page.evaluate(() => (window as unknown as { __qaCtx: boolean[] }).__qaCtx);

async function touches(page: Page, steps: { type: 'touchStart' | 'touchMove' | 'touchEnd'; points: { x: number; y: number; id?: number }[]; wait?: number }[]): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  try {
    for (const s of steps) {
      await cdp.send('Input.dispatchTouchEvent', { type: s.type, touchPoints: s.points.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i })) });
      await page.waitForTimeout(s.wait ?? 16);
    }
  } finally {
    await cdp.detach().catch(() => undefined);
  }
}

const zoom = (page: Page): Promise<number> => page.evaluate(() => window.visualViewport?.scale ?? 1);
const pageScroll = (page: Page): Promise<number[]> =>
  page.evaluate(() => [window.scrollX, window.scrollY, document.scrollingElement?.scrollTop ?? 0, document.body.scrollTop, document.getElementById('app')?.scrollTop ?? 0]);

test.describe('comportamento da app (GDD 17)', () => {
  test.beforeEach(({}, testInfo) => onlyProjects(testInfo, ...PLAY_PROJECTS));

  test('niente zoom, selezione del testo, menu contestuale né scorrimento della pagina', async ({ game }, testInfo) => {
    const { page } = game;
    const kind = pointerOf(testInfo);

    // ── Viewport e CSS di base ──
    const meta = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(meta ?? '', 'viewport senza zoom').toMatch(/user-scalable=no/);
    expect(meta ?? '', 'viewport fino ai bordi (safe area)').toMatch(/viewport-fit=cover/);
    const css = await page.evaluate(() => {
      const b = getComputedStyle(document.body);
      const h = getComputedStyle(document.documentElement);
      const c = document.getElementById('scene-canvas');
      return {
        bodySelect: b.userSelect,
        bodyOverscroll: b.overscrollBehaviorY,
        htmlOverscroll: h.overscrollBehaviorY,
        canvasTouch: c ? getComputedStyle(c).touchAction : null,
      };
    });
    expect(css, 'testo non selezionabile, nessun rimbalzo, il canvas tiene i gesti').toEqual({ bodySelect: 'none', bodyOverscroll: 'none', htmlOverscroll: 'none', canvasTouch: 'none' });

    // ── Menu contestuale soppresso (tasto destro sul titolo) ──
    await watchContextMenu(page);
    const vp = await call<{ cssW: number; cssH: number }>(page, 'core.viewport');
    await page.mouse.click(Math.round(vp.cssW / 2), Math.round(vp.cssH * 0.3), { button: 'right' });
    await expect.poll(() => contextMenus(page), { message: 'il tasto destro apre un menu contestuale' }).toEqual([true]);

    // ── Triplo clic su un testo dei Crediti: niente selezione ──
    await call(page, 'ui.open', 'crediti');
    expect(await waitScene(page, 'crediti')).toBe(true);
    const para = page.locator('[data-test="sc-crediti"] p, [data-test="sc-crediti"] li').first();
    await para.waitFor({ state: 'visible' });
    const box = await para.boundingBox();
    expect(box, 'un testo nei Crediti').toBeTruthy();
    await page.mouse.click(box!.x + Math.min(20, box!.width / 2), box!.y + box!.height / 2, { clickCount: 3 });
    expect(await page.evaluate(() => window.getSelection()?.toString().trim() ?? ''), 'il triplo clic non seleziona il testo').toBe('');

    // ── La stringa di esportazione invece si può selezionare e copiare ──
    await call(page, 'ui.open', 'impostazioni');
    expect(await waitScene(page, 'impostazioni')).toBe(true);
    await page.locator('[data-test="sc-impostazioni-esporta"]').scrollIntoViewIfNeeded();
    expect(await tapTest(page, kind, 'sc-impostazioni-esporta')).toBe(true);
    const field = page.locator('[data-test="sc-impostazioni-esporta-testo"]');
    await expect(field).toBeVisible();
    expect(await field.evaluate((e) => getComputedStyle(e).userSelect), 'il campo di esportazione è selezionabile').not.toBe('none');

    // ── Nel tombolo: trascinare in verticale non fa scorrere né rimbalzare la pagina ──
    await call(page, 'campaign.newGame');
    await call(page, 'campaign.goto', 'g01', 'notte');
    expect(await waitNight(page)).toBe(true);
    const l = await nightLayout(page);
    const x = l.lace.x + l.lace.w / 2;
    const y0 = l.lace.y + l.lace.h * 0.3;
    const y1 = l.lace.y + l.lace.h * 0.9;
    if (kind === 'touch') {
      await touches(page, [
        { type: 'touchStart', points: [{ x, y: y0 }] },
        ...Array.from({ length: 10 }, (_, i) => ({ type: 'touchMove' as const, points: [{ x, y: y0 + ((y1 - y0) * (i + 1)) / 10 }] })),
        { type: 'touchEnd', points: [] },
      ]);
    } else {
      await page.mouse.move(x, y0);
      await page.mouse.down();
      await page.mouse.move(x, y1, { steps: 10 });
      await page.mouse.up();
      await page.mouse.wheel(0, 600);
    }
    await page.waitForTimeout(300);
    expect(await pageScroll(page), 'la pagina resta ferma').toEqual([0, 0, 0, 0, 0]);

    if (kind === 'touch') {
      // ── Pizzico e doppio tocco: nessun ingrandimento (GDD 11.1) ──
      const cx = l.lace.x + l.lace.w / 2;
      const cy = l.lace.y + l.lace.h / 2;
      await touches(page, [
        { type: 'touchStart', points: [{ x: cx - 20, y: cy, id: 1 }, { x: cx + 20, y: cy, id: 2 }] },
        ...Array.from({ length: 10 }, (_, i) => ({ type: 'touchMove' as const, points: [{ x: cx - 20 - 8 * (i + 1), y: cy, id: 1 }, { x: cx + 20 + 8 * (i + 1), y: cy, id: 2 }] })),
        { type: 'touchEnd', points: [] },
      ]);
      await page.waitForTimeout(300);
      expect(await zoom(page), 'il pizzico non ingrandisce').toBe(1);
      const text = await page.locator('[data-test="tb-hud-titolo"]').boundingBox();
      const p = text ? { x: text.x + 10, y: text.y + text.height / 2 } : { x: cx, y: cy };
      await touches(page, [
        { type: 'touchStart', points: [p], wait: 40 },
        { type: 'touchEnd', points: [], wait: 80 },
        { type: 'touchStart', points: [p], wait: 40 },
        { type: 'touchEnd', points: [], wait: 300 },
      ]);
      expect(await zoom(page), 'il doppio tocco non ingrandisce').toBe(1);
      // Pressione lunga su un testo: se il browser propone il menu, il gioco lo sopprime.
      await touches(page, [
        { type: 'touchStart', points: [p], wait: 1_000 },
        { type: 'touchEnd', points: [], wait: 200 },
      ]);
      expect((await contextMenus(page)).every(Boolean), 'menu del tocco prolungato soppresso').toBe(true);
      expect(await page.evaluate(() => window.getSelection()?.toString().trim() ?? ''), 'la pressione lunga non seleziona il testo').toBe('');
    }
    game.expectClean();
  });
});
