/**
 * Giro di tutte le schermate (GDD 10.3) per le suite `layout` e `i18n`: ogni tappa
 * porta il gioco in uno stato preciso con l'API di debug e aspetta che la scena sia
 * ferma. L'ordine conta (la campagna avanza), il giro parte da un salvataggio vuoto.
 */
import type { Page } from '@playwright/test';
import { call, phase, until, waitNight, waitScene } from './game';

export interface TourStep {
  id: string;
  run(page: Page): Promise<void>;
}

/** Data fissa del Merletto del giorno nei test. */
export const TOUR_DAY = '2026-10-14';

async function settle(page: Page, ms = 350): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(ms);
}

async function visible(page: Page, selector: string, timeout = 8_000): Promise<boolean> {
  return page
    .locator(selector)
    .first()
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false);
}

async function closeOverlays(page: Page): Promise<void> {
  for (let i = 0; i < 4; i++) {
    const open = await call<string[]>(page, 'core.overlays');
    if (open.length === 0) return;
    await call(page, 'core.closeOverlay');
    await page.waitForTimeout(80);
  }
}

/** Accetta i primi bigliettini della sera che il solver sa tessere insieme. */
async function acceptSome(page: Page, n: number): Promise<void> {
  const ev = await call<{ levelId: string; noteIds: string[]; pinsLeft: number } | null>(page, 'campaign.evening');
  if (!ev) return;
  const picked: string[] = [];
  for (const id of ev.noteIds) {
    if (picked.length >= Math.min(n, ev.pinsLeft)) break;
    const r = await call<{ status: string } | null>(page, 'engine.solve', ev.levelId, [...picked, id]);
    if (r?.status === 'ok') picked.push(id);
  }
  if (picked.length) await call(page, 'campaign.accept', picked);
}

export const TOUR: TourStep[] = [
  {
    id: 'titolo-primo-avvio',
    async run(page) {
      await waitScene(page, 'titolo');
      await settle(page, 800);
    },
  },
  {
    id: 'prologo-buio',
    async run(page) {
      await call(page, 'campaign.newGame');
      await waitScene(page, 'sera');
      await visible(page, '[data-test="cp-prologo-buio"]');
      await settle(page);
    },
  },
  {
    id: 'prologo-biglietto',
    async run(page) {
      await page.locator('[data-test="cp-prologo-buio"]').click();
      await visible(page, '[data-test="cp-prologo-biglietto"]');
      await settle(page);
    },
  },
  {
    id: 'tombolo-prologo',
    async run(page) {
      await call(page, 'campaign.goto', 'g00', 'notte');
      await waitNight(page);
      await call(page, 'night.cross', 0, 'R');
      await call(page, 'night.fix');
      await call(page, 'night.cross', 1, 'R');
      await settle(page, 500);
    },
  },
  {
    id: 'pausa',
    async run(page) {
      await call(page, 'core.input.action', 'back');
      await until(page, async () => (await call<string[]>(page, 'core.overlays')).includes('pausa'), 5_000);
      await settle(page);
    },
  },
  {
    id: 'alba',
    async run(page) {
      await closeOverlays(page);
      await call(page, 'campaign.goto', 'g00', 'alba');
      await waitScene(page, 'alba');
      await visible(page, '[data-test="cp-vignetta-salta"]');
      await settle(page, 600);
    },
  },
  {
    id: 'bilancio',
    async run(page) {
      await call(page, 'campaign.goto', 'g02', 'bilancio');
      await waitScene(page, 'bilancio');
      await visible(page, '[data-test="cp-bilancio-continua"]');
      await settle(page);
    },
  },
  {
    id: 'sera-oggetto',
    async run(page) {
      await call(page, 'campaign.goto', 'g05', 'sera');
      await waitScene(page, 'sera');
      await settle(page, 500);
    },
  },
  {
    id: 'sera-bigliettini',
    async run(page) {
      await call(page, 'campaign.objectSeen');
      await visible(page, '[data-test^="cp-bigliettino-"]');
      await settle(page, 500);
    },
  },
  {
    id: 'bigliettino-risposte',
    async run(page) {
      const notes = page.locator('[data-test^="cp-bigliettino-"]');
      const ids = await notes.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.test ?? ''));
      // Un bigliettino con le risposte, se c'è (altrimenti il primo).
      let opened = false;
      for (const id of ids) {
        await page.locator(`[data-test="${id}"]`).click();
        await page.waitForTimeout(150);
        if (await page.locator('[data-test="cp-rispondi"]').isVisible()) {
          await page.locator('[data-test="cp-rispondi"]').click();
          opened = true;
          break;
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
      }
      if (!opened && ids[0]) await page.locator(`[data-test="${ids[0]}"]`).click();
      await settle(page);
    },
  },
  {
    id: 'taccuino',
    async run(page) {
      await page.keyboard.press('Escape');
      await closeOverlays(page);
      await call(page, 'core.openOverlay', 'taccuino', { from: 'sera' });
      await visible(page, '[data-test="cp-taccuino"]');
      await settle(page);
    },
  },
  {
    id: 'tombolo-notte',
    async run(page) {
      await closeOverlays(page);
      await acceptSome(page, 2);
      await call(page, 'campaign.toNight');
      await waitNight(page);
      const sol = await call<{ rows: { crossings: { pair: number; over: 'L' | 'R'; forced?: boolean }[] }[] } | null>(page, 'engine.solve', 'g05', ((await call<{ accepted: string[] } | null>(page, 'campaign.evening'))?.accepted ?? []));
      for (const r of (sol?.rows ?? []).slice(0, 3)) {
        for (const c of r.crossings) if (!c.forced) await call(page, 'night.cross', c.pair, c.over);
        await call(page, 'night.fix');
      }
      await settle(page, 600);
    },
  },
  {
    id: 'sera-atto2',
    async run(page) {
      await call(page, 'campaign.goto', 'g14', 'sera');
      await waitScene(page, 'sera');
      await call(page, 'campaign.objectSeen');
      await visible(page, '[data-test^="cp-bigliettino-"]');
      await settle(page, 500);
    },
  },
  {
    id: 'alba-atto2',
    async run(page) {
      await call(page, 'campaign.goto', 'g14', 'alba');
      await waitScene(page, 'alba');
      await visible(page, '[data-test="cp-vignetta-salta"]');
      await settle(page, 600);
    },
  },
  {
    id: 'archivio-cassapanca',
    async run(page) {
      await call(page, 'campaign.goto', 'arc1', 'archivio');
      await waitScene(page, 'archivio');
      await visible(page, '[data-test="cp-apri-arc1"]');
      await settle(page);
    },
  },
  {
    id: 'archivio-merletto',
    async run(page) {
      await page.locator('[data-test="cp-apri-arc1"]').click();
      await waitNight(page);
      await settle(page, 600);
    },
  },
  {
    id: 'telaio',
    async run(page) {
      await call(page, 'core.goto', 'telaio');
      await waitScene(page, 'telaio');
      await settle(page, 500);
    },
  },
  {
    id: 'scelta',
    async run(page) {
      await call(page, 'campaign.goto', 'g23', 'scelta');
      await waitScene(page, 'sera');
      await call(page, 'campaign.objectSeen');
      await settle(page, 600);
    },
  },
  {
    id: 'scelta-strappata',
    async run(page) {
      const card = page.locator('[data-test="cp-carta-aperto"]');
      if (await card.isVisible().catch(() => false)) await card.click();
      await visible(page, '[data-test="cp-mancanze"]', 3_000);
      await settle(page);
    },
  },
  {
    id: 'finale-epilogo',
    async run(page) {
      await page.keyboard.press('Escape');
      await closeOverlays(page);
      await call(page, 'campaign.choose', 'merlettaia');
      await waitNight(page);
      await call(page, 'night.autoplay');
      await waitScene(page, 'finale', 20_000);
      await until(page, async () => ((await call<{ mode?: string } | null>(page, 'campaign.finale'))?.mode ?? '') === 'epilogo', 15_000);
      await visible(page, '[data-test="cp-vignetta-salta"]');
      await settle(page, 600);
    },
  },
  {
    id: 'titoli-di-coda',
    async run(page) {
      await page.locator('[data-test="cp-vignetta-salta"]').click();
      await until(page, async () => JSON.stringify(await call(page, 'campaign.finale')).includes('titoli'), 15_000);
      await settle(page, 800);
    },
  },
  {
    id: 'giornaliero',
    async run(page) {
      if ((await phase(page)) === 'titoli') await page.locator('[data-test="cp-titoli-fine"]').click().catch(() => undefined);
      await call(page, 'ui.unlock', 'all');
      await call(page, 'ui.setToday', TOUR_DAY);
      await call(page, 'ui.open', 'giornaliero');
      await waitScene(page, 'giornaliero');
      await page.locator('[data-test="sc-giornaliero-tessi"]').waitFor({ state: 'visible', timeout: 15_000 });
      await settle(page, 500);
    },
  },
  {
    id: 'spartito',
    async run(page) {
      await call(page, 'ui.open', 'spartito', { returnTo: 'giornaliero' });
      await visible(page, '[data-test="sc-spartito-campo"]');
      await settle(page);
    },
  },
  {
    id: 'giornaliero-risultato',
    async run(page) {
      await closeOverlays(page);
      await call(page, 'ui.startDaily');
      await waitNight(page);
      await call(page, 'core.time.setSpeed', 8);
      await call(page, 'night.autoplay');
      await waitScene(page, 'giornaliero', 15_000);
      await visible(page, '[data-test="sc-risultato-condividi"]', 10_000);
      await call(page, 'core.time.setSpeed', 1);
      await settle(page, 600);
    },
  },
  {
    id: 'libero',
    async run(page) {
      await call(page, 'ui.open', 'libero');
      await waitScene(page, 'libero');
      await settle(page, 600);
    },
  },
  {
    id: 'impostazioni',
    async run(page) {
      await call(page, 'ui.open', 'impostazioni');
      await waitScene(page, 'impostazioni');
      await settle(page, 400);
    },
  },
  {
    id: 'crediti',
    async run(page) {
      await call(page, 'ui.open', 'crediti');
      await waitScene(page, 'crediti');
      await settle(page, 600);
    },
  },
  {
    id: 'titolo-con-storia',
    async run(page) {
      await call(page, 'ui.open', 'titolo');
      await waitScene(page, 'titolo');
      await settle(page, 800);
    },
  },
];
