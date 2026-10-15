/**
 * Suite `collaudo` (collaudo finale dopo la rifinitura della revisione 2): le correzioni
 * fatte durante il collaudo, provate nel gioco vero.
 *  - Testata dell'alba («IL GIORNO ACCADE · titolo») e della rivelazione d'Archivio: era
 *    ottone senza fondo sopra il diorama; sulla Piazza al sole di g06 (la schermata per
 *    gli store) il contrasto era 1,1:1. Ora sta su una fascia scura come il titolo del
 *    prologo (CAM-10): l'ottone e il titolo devono restare ≥ 4,5:1 (GDD 14) anche se sotto
 *    la fascia ci fosse un fondo bianco, la fascia non esce dallo schermo e non tocca la
 *    vignetta, e il controllo del layout non trova problemi.
 */
import type { Page } from '@playwright/test';
import { auditLayout, describeProblems, INFO_KINDS } from './helpers/audit';
import { call, expect, onlyProjects, PLAY_PROJECTS, test, waitScene } from './helpers/game';

interface HeaderMeasure {
  band: string;
  texts: { text: string; color: string }[];
  box: { left: number; right: number; top: number; bottom: number };
  vignette: { top: number } | null;
  viewport: { width: number };
}

type Rgba = [number, number, number, number];

function parseColor(css: string): Rgba {
  const m = /rgba?\(([^)]+)\)/.exec(css);
  if (!m) throw new Error(`colore non leggibile: ${css}`);
  const [r = 0, g = 0, b = 0, a = 1] = (m[1] ?? '').split(/[ ,/]+/).filter(Boolean).map(Number);
  return [r, g, b, a];
}

/** Il colore `top` (con la sua trasparenza) sopra il colore pieno `under`. */
function over(top: Rgba, under: [number, number, number]): [number, number, number] {
  const [r, g, b, a] = top;
  return [r * a + under[0] * (1 - a), g * a + under[1] * (1 - a), b * a + under[2] * (1 - a)];
}

function luminance([r, g, b]: [number, number, number]): number {
  const ch = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

async function measureHeader(page: Page): Promise<HeaderMeasure> {
  return page.evaluate(() => {
    const head = document.querySelector<HTMLElement>('.cp-alba-testa');
    if (!head) throw new Error('nessuna testata .cp-alba-testa');
    const r = head.getBoundingClientRect();
    const texts = [...head.children].map((c) => ({ text: (c.textContent ?? '').trim(), color: getComputedStyle(c).color }));
    const box = document.querySelector('.cp-vignetta-box')?.getBoundingClientRect();
    return {
      band: getComputedStyle(head).backgroundColor,
      texts,
      box: { left: r.left, right: r.right, top: r.top, bottom: r.bottom },
      vignette: box ? { top: box.top } : null,
      viewport: { width: window.innerWidth },
    };
  });
}

test.describe('collaudo finale', () => {
  for (const hc of [false, true]) {
    test(`testata dell'alba leggibile sopra un diorama chiaro${hc ? ' (alto contrasto)' : ''}`, async ({ game }, testInfo) => {
      onlyProjects(testInfo, ...PLAY_PROJECTS);
      const { page } = game;
      await call(page, 'core.setSettings', { animSpeed: 0, highContrast: hc });
      await call(page, 'campaign.newGame');
      // g06: la Piazza di giorno, il diorama più chiaro (la schermata «alba» per gli store).
      await call(page, 'campaign.goto', 'g06', 'alba');
      expect(await waitScene(page, 'alba')).toBe(true);
      await page.locator('.cp-alba-testa').waitFor({ state: 'visible' });
      await page.locator('[data-test="cp-vignetta-avanti"]').waitFor({ state: 'visible' });
      const m = await measureHeader(page);
      const band = parseColor(m.band);
      expect(band[3], `la testata ha una fascia quasi opaca (${m.band})`).toBeGreaterThanOrEqual(0.8);
      expect(m.texts.length, '«Il giorno accade» e il titolo della giornata').toBe(2);
      // Il caso peggiore: sotto la fascia un diorama bianco.
      const worst = over(band, [255, 255, 255]);
      for (const t of m.texts) {
        const c = parseColor(t.color);
        const ratio = contrast(over(c, worst), worst);
        expect(ratio, `«${t.text}» (${t.color}) sulla fascia sopra un fondo bianco: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
      expect(m.box.left, 'la fascia non esce a sinistra').toBeGreaterThanOrEqual(0);
      expect(m.box.right, 'la fascia non esce a destra').toBeLessThanOrEqual(m.viewport.width);
      if (m.vignette) expect(m.box.bottom, 'la fascia non tocca la vignetta').toBeLessThan(m.vignette.top);
      const problems = (await auditLayout(page)).filter((p) => !INFO_KINDS.has(p.kind));
      expect(problems, describeProblems(problems)).toEqual([]);
      game.expectClean();
    });
  }
});
