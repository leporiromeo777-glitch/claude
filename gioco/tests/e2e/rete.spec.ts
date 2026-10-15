/**
 * Rete (GDD 0 «Offline: sempre», GDD 17, ARCHITETTURA 15.2):
 *  - percorso completo (tutte le schermate, una partita vera fino all'Archivio di g03,
 *    il Merletto del giorno e quello libero) con la rete sorvegliata: nessuna richiesta
 *    esce da localhost; le richieste viste sono tutte dell'origine del gioco;
 *  - dopo il primo caricamento il gioco funziona senza rete (service worker della
 *    revisione 1, SCH-08): la build si serve da un server tutto per il test, che si
 *    ferma al titolo; si gioca nella stessa pagina (prologo, alba, sera, notte), poi si
 *    ricarica la pagina senza server e si gioca ancora (sera e notte, Merletto del giorno
 *    e libero, Impostazioni, Crediti) senza errori, risorse o font mancanti.
 * Le stesse sorveglianze sono attive in tutti gli altri test (helpers/game.ts).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview, type PreviewServer } from 'vite';
import { playGolden } from './helpers/campaign';
import { call, captureErrors, expect, guardNetwork, onlyProjects, ready, test, waitNight, waitScene } from './helpers/game';
import { TOUR, TOUR_DAY } from './helpers/tour';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
/** La build servita (la stessa di playwright.config.ts o quella indicata con E2E_DIST). */
const DIST = process.env.E2E_DIST ?? join(ROOT, 'dist');
const BASE_PORT = Number(process.env.E2E_PORT ?? 4173);

/**
 * Un server della build solo per un test, sulla prima porta libera fra E2E_PORT+1 e
 * E2E_PORT+9 (i due progetti girano in parallelo), da fermare a metà del test.
 */
async function ownServer(): Promise<{ server: PreviewServer; origin: string }> {
  let last: unknown = null;
  for (let port = BASE_PORT + 1; port <= BASE_PORT + 9; port++) {
    try {
      const server = await preview({ configFile: false, root: ROOT, logLevel: 'silent', build: { outDir: DIST }, preview: { port, strictPort: true, host: '127.0.0.1' } });
      return { server, origin: `http://localhost:${port}` };
    } catch (e) {
      last = e;
    }
  }
  throw new Error(`nessuna porta libera fra ${BASE_PORT + 1} e ${BASE_PORT + 9}: ${String(last)}`);
}

test.describe('rete', () => {
  test.beforeEach(({}, testInfo) => onlyProjects(testInfo, 'desktop', 'iphone'));

  test('percorso completo: nessuna richiesta esce da localhost', async ({ game, baseURL }) => {
    test.setTimeout(6 * 60_000);
    const { page } = game;
    await call(page, 'core.setSettings', { animSpeed: 0 });
    for (const step of TOUR) await test.step(step.id, () => step.run(page));
    // Una partita vera dall'inizio fino alla sera di g04 (Archivio compreso).
    await call(page, 'campaign.newGame');
    await waitScene(page, 'sera');
    const res = await playGolden(page, { untilLevel: 'g04' });
    expect(res.archives.arc1, 'Archivio di g03 rammendato').toBe(true);
    await call(page, 'ui.startLibero', { seed: 'm7rete' });
    expect(await waitNight(page)).toBe(true);
    await call(page, 'night.autoplay');
    await waitScene(page, 'libero', 15_000);
    const origin = new URL(baseURL ?? page.url()).origin;
    const foreign = game.net.all.filter((r) => new URL(r.url).origin !== origin).map((r) => r.url);
    expect(game.net.all.length, 'richieste viste').toBeGreaterThan(5);
    expect(foreign, 'richieste fuori dall’origine del gioco').toEqual([]);
    game.expectClean();
  });

  test('dopo il primo caricamento si gioca e si ricarica a server fermo (service worker)', async ({ page, context }) => {
    test.skip(!existsSync(join(DIST, 'index.html')), `nessuna build in ${DIST} (E2E_DIST)`);
    test.setTimeout(4 * 60_000);
    // Con il service worker della revisione 1 (SCH-08) `context.setOffline` non basta più: il
    // browser di Playwright lo applica alla pagina ma non alle richieste del worker, che
    // arrivano ancora al server. Si serve la build da un server tutto per questo test e lo
    // si ferma davvero dopo il primo caricamento, come chi gioca in aereo.
    const net = await guardNetwork(context);
    const errors = captureErrors(page);
    const failed: string[] = [];
    page.on('requestfailed', (r) => failed.push(`${r.url()} ${r.failure()?.errorText ?? ''}`));
    const own = await ownServer();
    let stopped = false;
    try {
      await page.goto(`${own.origin}/?debug=1`);
      await ready(page);
      expect(await waitScene(page, 'titolo')).toBe(true);
      await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
      await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? ''), { timeout: 20_000, message: 'il service worker controlla la pagina' }).toMatch(/sw\.js\?v=/);
      await own.server.close();
      stopped = true;
      await context.setOffline(true);
      // Sonda: un indirizzo nuovo non arriva più da nessuna parte (il server è fermo davvero).
      const before = { errors: errors.length, failed: failed.length };
      const probe = await page.evaluate(() => fetch(`qa-sonda-rete-${Date.now()}.txt`).then((r) => `risposta ${r.status}`, () => 'errore'));
      expect(probe, 'senza server una richiesta nuova fallisce').toBe('errore');
      errors.splice(before.errors);
      failed.splice(before.failed);
      await call(page, 'core.setSettings', { animSpeed: 0 });

      // 1. Nella stessa pagina: prologo, alba, bilancio, sera e notte di g01.
      await call(page, 'campaign.newGame');
      expect(await waitScene(page, 'sera')).toBe(true);
      const res = await playGolden(page, { untilLevel: 'g02' });
      expect(res.days.map((d) => d.levelId)).toEqual(['g00', 'g01']);

      // 2. Ricarica senza server: la pagina, i chunk, i font e gli asset vengono dalla cache.
      const resp = await page.reload();
      expect(resp?.fromServiceWorker(), 'la pagina ricaricata viene dal service worker').toBe(true);
      await ready(page);
      expect(await waitScene(page, 'titolo'), 'il titolo dopo la ricarica senza rete').toBe(true);
      expect(await call(page, 'campaign.phase'), 'il salvataggio c’è ancora').toBe('sera');
      await call(page, 'core.setSettings', { animSpeed: 0 });
      await page.locator('[data-test="sc-titolo-continua"]').click();
      expect(await waitScene(page, 'sera'), '«Continua» riapre la sera di g02').toBe(true);
      const res2 = await playGolden(page, { untilLevel: 'g03' });
      expect(res2.days.map((d) => d.levelId), 'la notte di g02 dopo la ricarica').toEqual(['g02']);
      // Merletto del giorno (generato nel Worker) e libero.
      await call(page, 'ui.unlock', 'all');
      await call(page, 'ui.setToday', TOUR_DAY);
      await call(page, 'ui.startDaily');
      expect(await waitNight(page), 'Merletto del giorno offline').toBe(true);
      await call(page, 'night.autoplay');
      expect(await waitScene(page, 'giornaliero', 15_000)).toBe(true);
      await call(page, 'ui.startLibero', { seed: 'g4off' });
      expect(await waitNight(page), 'Merletto libero offline').toBe(true);
      for (const s of ['impostazioni', 'crediti', 'titolo'] as const) {
        await call(page, 'ui.open', s);
        expect(await waitScene(page, s)).toBe(true);
      }
      expect.soft(await call<string[]>(page, 'core.missingAssets'), 'nessun asset mancante').toEqual([]);
      const badFonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'error').map((f) => `${f.family} ${f.weight}`));
      expect.soft(badFonts, 'nessun font mancante').toEqual([]);
      expect.soft(failed, 'richieste fallite senza rete').toEqual([]);
      expect(errors, 'errori in console').toEqual([]);
      expect(net.external, 'richieste fuori da localhost').toEqual([]);
    } finally {
      if (!stopped) await own.server.close();
      await context.setOffline(false);
    }
  });
});
