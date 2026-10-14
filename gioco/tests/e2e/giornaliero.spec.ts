/**
 * Suite `giornaliero` (ARCHITETTURA 15.2, GDD 8.2-8.3):
 *  - stessa data → stesso livello (impronta `levelSourceHash`) anche dopo un
 *    ricaricamento e in un altro contesto del browser (un altro «telefono»); un'altra
 *    data dà un altro livello; è lo stesso livello del motore (`engine.daily`);
 *  - «Tessi» dal Merletto del giorno, notte tessuta, testo da condividere nel formato
 *    di GDD 8.3 con i numeri del record, spartito nella seconda riga;
 *  - lo spartito importato dal pannello ritesse lo stesso merletto; un carattere
 *    alterato si rifiuta con una spiegazione.
 */
import type { Browser, Page } from '@playwright/test';
import { call, expect, nightState, onlyProjects, openGame, PLAY_PROJECTS, reload, test, waitNight, waitScene } from './helpers/game';
import { pointerOf, tapTest } from './helpers/pointer';

const DAY = '2026-10-14';
const OTHER_DAY = '2026-10-15';

interface DailyInfo {
  date: string;
  levelId: string;
  hash: string;
  rule: string;
  min: number;
  record: null | { date: string; incroci: number; min: number; quiete: number; simmetria: boolean; spartito: string };
  shareText: string | null;
  streak: number;
}

async function dailyOf(page: Page, date: string): Promise<DailyInfo> {
  await call(page, 'ui.setToday', date);
  return call<DailyInfo>(page, 'ui.daily', date);
}

async function hashInFreshContext(browser: Browser, baseURL: string | undefined, date: string): Promise<string> {
  const ctx = await browser.newContext({ locale: 'en-US', timezoneId: 'America/New_York' });
  try {
    const p = await ctx.newPage();
    await p.goto(baseURL ?? '');
    await openGame(p, { fresh: false });
    return (await dailyOf(p, date)).hash;
  } finally {
    await ctx.close();
  }
}

test.describe('Merletto del giorno', () => {
  test.beforeEach(({}, testInfo) => onlyProjects(testInfo, ...PLAY_PROJECTS));

  test('stessa data, stesso livello: dopo il ricaricamento e su un altro dispositivo', async ({ game, browser, baseURL }) => {
    const { page } = game;
    const d1 = await dailyOf(page, DAY);
    expect(d1.hash).toMatch(/\S{6,}/);
    expect(d1.levelId).toContain('2026-10-14');
    await reload(page);
    const d2 = await dailyOf(page, DAY);
    expect([d2.levelId, d2.hash, d2.rule, d2.min], 'stesso livello dopo il ricaricamento').toEqual([d1.levelId, d1.hash, d1.rule, d1.min]);
    const eng = await call<{ level: { id: string } }>(page, 'engine.daily', DAY);
    expect(eng.level.id, 'lo stesso livello di __GAME__.engine.daily').toBe(d1.levelId);
    expect(await hashInFreshContext(browser, baseURL, DAY), 'stessa impronta in un altro contesto (altro fuso orario e lingua)').toBe(d1.hash);
    const other = await dailyOf(page, OTHER_DAY);
    expect(other.hash, 'un altro giorno, un altro merletto').not.toBe(d1.hash);
    game.expectClean();
  });

  test('tessere il giorno: record, testo da condividere, spartito che ritesse lo stesso merletto', async ({ game }, testInfo) => {
    const { page } = game;
    const kind = pointerOf(testInfo);
    await call(page, 'ui.unlock', 'all');
    const info = await dailyOf(page, DAY);
    await call(page, 'ui.open', 'giornaliero');
    expect(await waitScene(page, 'giornaliero')).toBe(true);
    await expect(page.locator('[data-test="sc-giornaliero-libro"]'), 'pagina del Libro con la regola').toBeVisible();
    await expect(page.locator('[data-test="sc-giornaliero-tessi"]')).toBeEnabled({ timeout: 15_000 });
    expect(await tapTest(page, kind, 'sc-giornaliero-tessi')).toBe(true);
    expect(await waitNight(page)).toBe(true);
    const n0 = await nightState(page);
    expect([n0.levelId, n0.origin]).toEqual([info.levelId, 'giornaliero']);
    await call(page, 'core.time.setSpeed', 8);
    const outcome = await call<{ rows: unknown[]; spartito: string; timeline: { pos: string[] }[] }>(page, 'night.autoplay');
    expect(outcome?.spartito).toMatch(/^TRAMA1-G20261014-/);

    // Testo da condividere (GDD 8.3): riga con i numeri del record, poi lo spartito.
    const share = await call<string>(page, 'ui.share');
    const [line, spartito] = share.split('\n');
    expect(line).toMatch(/^TRAMA \d{2}\/\d{2} · \d+ incroc(io|i) \(min \d+\) · \d+ or[ae] di quiete( · simmetria ✦)?$/);
    const rec = (await call<{ daily: Record<string, DailyInfo['record']> }>(page, 'core.save')).daily[DAY];
    expect(rec, 'DailyRecord salvato').toBeTruthy();
    expect(line).toBe(`TRAMA 14/10 · ${rec!.incroci} ${rec!.incroci === 1 ? 'incrocio' : 'incroci'} (min ${rec!.min}) · ${rec!.quiete} ${rec!.quiete === 1 ? 'ora' : 'ore'} di quiete${rec!.simmetria ? ' · simmetria ✦' : ''}`);
    expect(spartito, 'seconda riga: lo spartito del merletto').toBe(rec!.spartito);
    expect(rec!.min).toBe(info.min);
    expect(await waitScene(page, 'giornaliero', 10_000), 'i risultati nella scena del giorno').toBe(true);
    await expect(page.locator('[data-test="sc-risultato-condividi"]')).toBeVisible();
    await expect(page.locator('[data-test="sc-risultato-immagine"] img')).toBeVisible();
    await call(page, 'core.time.setSpeed', 1);
    const finalPos = outcome.timeline[outcome.timeline.length - 1]?.pos;

    // Lo spartito reimportato dal pannello ritesse lo stesso merletto.
    await reload(page);
    await call(page, 'ui.setToday', DAY);
    await call(page, 'ui.open', 'giornaliero');
    await waitScene(page, 'giornaliero');
    await expect(page.locator('[data-test="sc-giornaliero-tessi"]')).toBeEnabled({ timeout: 15_000 });
    expect(await tapTest(page, kind, 'sc-giornaliero-importa')).toBe(true);
    await page.locator('[data-test="sc-spartito-campo"]').fill(rec!.spartito);
    expect(await tapTest(page, kind, 'sc-spartito-tessi')).toBe(true);
    expect(await waitNight(page)).toBe(true);
    expect((await nightState(page)).mode, 'lo spartito si ritesse da solo').toBe('replay');
    await call(page, 'night.skip');
    await expect.poll(async () => (await nightState(page)).completed || (await call(page, 'core.scene')) !== 'tombolo').toBe(true);
    const r = await call<{ spartito: string; metrics: { incroci: number } } | null>(page, 'ui.result', 'spartito');
    expect(r?.spartito, 'stesso spartito').toBe(rec!.spartito);
    expect(r?.metrics.incroci, 'stessa eleganza').toBe(rec!.incroci);
    const replayPos = (await call<{ timeline?: { pos: string[] }[] } | null>(page, 'night.outcome'))?.timeline?.at(-1)?.pos;
    if (replayPos) expect(replayPos, 'stesse posizioni finali').toEqual(finalPos);
    // Un carattere alterato si rifiuta.
    const last = rec!.spartito.slice(-1);
    const bad = await call<{ ok: boolean; errorKey?: string }>(page, 'ui.checkSpartito', rec!.spartito.slice(0, -1) + (last === 'a' ? 'b' : 'a'));
    expect([bad.ok, bad.errorKey]).toEqual([false, 'ui.spartito.errore.formato']);
    game.expectClean();
  });
});
