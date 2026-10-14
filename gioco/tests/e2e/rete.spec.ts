/**
 * Rete (GDD 0 «Offline: sempre», GDD 17, ARCHITETTURA 15.2):
 *  - percorso completo (tutte le schermate, una partita vera fino all'Archivio di g03,
 *    il Merletto del giorno e quello libero) con la rete sorvegliata: nessuna richiesta
 *    esce da localhost; le richieste viste sono tutte dell'origine del gioco;
 *  - dopo il primo caricamento il gioco funziona senza rete: si toglie la connessione
 *    al titolo e si gioca (prologo, alba, sera, notte, Merletto del giorno e libero,
 *    Impostazioni, Crediti) senza errori né risorse mancanti.
 * Le stesse sorveglianze sono attive in tutti gli altri test (helpers/game.ts).
 */
import { playGolden } from './helpers/campaign';
import { call, expect, onlyProjects, test, waitNight, waitScene } from './helpers/game';
import { TOUR, TOUR_DAY } from './helpers/tour';

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

  test('dopo il primo caricamento si gioca senza rete', async ({ game, context }) => {
    test.setTimeout(4 * 60_000);
    const { page } = game;
    await waitScene(page, 'titolo');
    await page.waitForTimeout(1000);
    await context.setOffline(true);
    const failed: string[] = [];
    page.on('requestfailed', (r) => failed.push(`${r.url()} ${r.failure()?.errorText ?? ''}`));
    await call(page, 'core.setSettings', { animSpeed: 0 });
    // Prologo, alba, bilancio, sera di g01 e la sua notte.
    await call(page, 'campaign.newGame');
    expect(await waitScene(page, 'sera')).toBe(true);
    const res = await playGolden(page, { untilLevel: 'g02' });
    expect(res.days.map((d) => d.levelId)).toEqual(['g00', 'g01']);
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
    expect.soft(failed, 'richieste fallite senza rete').toEqual([]);
    await context.setOffline(false);
    game.expectClean();
  });
});
