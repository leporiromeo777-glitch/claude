/**
 * Suite `salvataggio` (ARCHITETTURA 9 e 15.2, GDD 17):
 *  - ricarica a metà notte → «Continua» dal titolo riprende alla stessa riga, con la
 *    stessa bozza e le stesse richieste lasciate cadere;
 *  - `visibilitychange` (pagina nascosta) scrive subito, senza aspettare i 2 s;
 *  - esporta e importa dalle Impostazioni: salvataggio identico (tranne writtenAt);
 *  - slot corrotto → si usa l'altro (con un avviso); tutti e due corrotti → si riparte
 *    da zero con un avviso, senza errori.
 */
import type { Page } from '@playwright/test';
import { call, expect, nightState, onlyProjects, PLAY_PROJECTS, reload, test, until, waitNight, waitScene, type Rec } from './helpers/game';
import { pointerOf, tapTest } from './helpers/pointer';

const KEYS = { a: 'trama.v1.a', b: 'trama.v1.b', ultimo: 'trama.v1.ultimo' } as const;

interface Stored {
  ultimo: string | null;
  a: string | null;
  b: string | null;
}

async function stored(page: Page): Promise<Stored> {
  return page.evaluate((k) => ({ ultimo: localStorage.getItem(k.ultimo), a: localStorage.getItem(k.a), b: localStorage.getItem(k.b) }), KEYS);
}

/** I dati dello slot più recente, letti direttamente dallo storage del browser. */
async function latestData(page: Page): Promise<Rec | null> {
  const s = await stored(page);
  const raw = s.ultimo === 'a' ? s.a : s.ultimo === 'b' ? s.b : null;
  if (!raw) return null;
  return (JSON.parse(raw) as { data: Rec }).data;
}

/**
 * Scrive lo storage all'inizio del prossimo caricamento, prima del codice del gioco
 * (una volta sola per `tag`).
 */
async function storageOnNextLoad(page: Page, tag: string, values: Record<string, string>): Promise<void> {
  await page.addInitScript(
    ({ t, v }) => {
      const mark = `qa-storage-${t}`;
      if (sessionStorage.getItem(mark)) return;
      sessionStorage.setItem(mark, '1');
      for (const [k, x] of Object.entries(v)) localStorage.setItem(k, x);
    },
    { t: tag, v: values },
  );
}

/** Simula la pagina nascosta o di nuovo visibile (come quando si cambia app). */
async function setHidden(page: Page, hidden: boolean): Promise<void> {
  await page.evaluate((h) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

/** Notte di g01 della campagna con due richieste, due ore fissate e una bozza. */
async function midNight(page: Page): Promise<void> {
  await call(page, 'campaign.newGame');
  await call(page, 'campaign.goto', 'g01', 'sera');
  await waitScene(page, 'sera');
  await call(page, 'campaign.objectSeen');
  expect((await call<{ ok: boolean }>(page, 'campaign.accept', ['g01.marta', 'g01.piero'])).ok).toBe(true);
  await call(page, 'campaign.toNight');
  expect(await waitNight(page)).toBe(true);
  const sol = await call<{ rows: { crossings: { pair: number; over: 'L' | 'R'; forced?: boolean }[] }[] }>(page, 'engine.solve', 'g01', ['g01.marta', 'g01.piero']);
  for (const r of sol.rows.slice(0, 2)) {
    for (const c of r.crossings) if (!c.forced) await call(page, 'night.cross', c.pair, c.over);
    expect((await call<{ ok: boolean }>(page, 'night.fix')).ok).toBe(true);
  }
  const third = sol.rows[2]?.crossings.find((c) => !c.forced);
  if (third) await call(page, 'night.cross', third.pair, third.over);
}

test.describe('salvataggio', () => {
  test.beforeEach(({}, testInfo) => onlyProjects(testInfo, ...PLAY_PROJECTS));

  test('ricarica a metà notte: «Continua» riprende alla stessa riga', async ({ game }, testInfo) => {
    const { page } = game;
    await midNight(page);
    await call(page, 'night.drop', 'g01.piero');
    const before = await nightState(page);
    expect(before.draft.length, 'una bozza a metà riga').toBeGreaterThan(0);
    // Nessun flush esplicito: contano l'autosalvataggio e il pagehide del ricaricamento.
    await reload(page);
    expect(await call(page, 'core.scene')).toBe('titolo');
    expect(await call(page, 'campaign.phase')).toBe('notte');
    expect(await tapTest(page, pointerOf(testInfo), 'sc-titolo-continua'), '«Continua» nel titolo').toBe(true);
    expect(await waitNight(page)).toBe(true);
    const after = await nightState(page);
    expect(after.levelId).toBe('g01');
    expect(after.hour, 'stessa riga').toBe(before.hour);
    expect(after.rows, 'stesse ore fissate').toEqual(before.rows);
    expect(after.draft, 'stessa bozza').toEqual(before.draft);
    expect(after.dropped, 'stesse richieste lasciate cadere').toEqual(['g01.piero']);
    expect(after.positions).toEqual(before.positions);
    game.expectClean();
  });

  test('la pagina nascosta (visibilitychange) salva subito', async ({ game }) => {
    const { page } = game;
    await midNight(page);
    await call(page, 'core.flush');
    const s0 = await nightState(page);
    // Un cambio della bozza: il salvataggio normale è raggruppato (al più uno ogni 2 s).
    await call(page, 'night.undo');
    const s1 = await nightState(page);
    expect(s1.draft.length).toBe(s0.draft.length - 1);
    const t0 = Date.now();
    await setHidden(page, true);
    const ok = await until(page, async () => {
      const d = await latestData(page);
      const night = d?.night as { resume?: { draft: unknown[] } } | null | undefined;
      return JSON.stringify(night?.resume?.draft) === JSON.stringify(s1.draft);
    }, 1_500, 25);
    const ms = Date.now() - t0;
    expect(ok, `bozza scritta nello storage dopo la pagina nascosta (${ms} ms)`).toBe(true);
    expect(ms, 'scrittura immediata, non raggruppata').toBeLessThan(1_500);
    const events = (await call<Rec[]>(page, 'core.events', 30)).map((e) => e.k);
    expect(events).toContain('app:pause');
    expect(events).toContain('save:written');
    expect(await call(page, 'core.time.paused'), 'il ciclo si ferma in background').toBe(true);
    await setHidden(page, false);
    await expect.poll(() => call(page, 'core.time.paused')).toBe(false);
    game.expectClean();
  });

  test('esporta e importa dalle Impostazioni: salvataggio identico', async ({ game }, testInfo) => {
    const { page } = game;
    const kind = pointerOf(testInfo);
    await call(page, 'campaign.newGame');
    await call(page, 'campaign.goto', 'g03', 'sera');
    await call(page, 'ui.unlock', 'all');
    await call(page, 'core.setSettings', { captions: true, textScale: 1.1 });
    await call(page, 'core.flush');
    await call(page, 'ui.open', 'impostazioni');
    expect(await waitScene(page, 'impostazioni')).toBe(true);
    const exp = page.locator('[data-test="sc-impostazioni-esporta"]');
    await exp.scrollIntoViewIfNeeded();
    expect(await tapTest(page, kind, 'sc-impostazioni-esporta')).toBe(true);
    const exported = await page.locator('[data-test="sc-impostazioni-esporta-testo"]').inputValue();
    expect(exported.startsWith('TRAMA-SAVE-1:'), 'stringa di esportazione').toBe(true);
    const snapshot = await call<Rec>(page, 'core.save');
    // Si cambia tutto: un'altra storia, altre impostazioni.
    await call(page, 'core.setSettings', { captions: false, textScale: 1.3 });
    await call(page, 'campaign.goto', 'g07', 'sera');
    await call(page, 'ui.open', 'impostazioni');
    await waitScene(page, 'impostazioni');
    await page.locator('[data-test="sc-impostazioni-importa"]').scrollIntoViewIfNeeded();
    expect(await tapTest(page, kind, 'sc-impostazioni-importa')).toBe(true);
    await page.locator('[data-test="sc-impostazioni-importa-testo"]').fill(exported);
    expect(await tapTest(page, kind, 'sc-impostazioni-importa-ok')).toBe(true);
    await expect(page.locator('[data-test="confirm"]'), 'l’importazione chiede conferma').toBeVisible();
    expect(await tapTest(page, kind, 'confirm-ok')).toBe(true);
    await expect.poll(async () => ((await call<{ campaign: { levelId: string } | null }>(page, 'core.save')).campaign?.levelId ?? null)).toBe('g03');
    const restored = await call<Rec>(page, 'core.save');
    const strip = (d: Rec): string => JSON.stringify({ ...d, writtenAt: '' });
    expect(strip(restored), 'identico tranne writtenAt').toBe(strip(snapshot));
    // Una stringa rovinata si rifiuta con una spiegazione.
    const bad = await call<{ ok: boolean; error?: string }>(page, 'core.importSave', exported.slice(0, -6) + 'AAAAAA');
    expect(bad.ok).toBe(false);
    game.expectClean();
  });

  test('slot corrotto: si carica l’altro; tutti e due corrotti: si riparte da zero', async ({ game }) => {
    const { page } = game;
    // Due scritture: textScale 1.1 nello slot X, poi 1.2 nello slot Y (il più recente).
    await call(page, 'core.setSettings', { textScale: 1.1 });
    await call(page, 'core.flush');
    await page.waitForTimeout(30);
    await call(page, 'core.setSettings', { textScale: 1.2 });
    await call(page, 'core.flush');
    const s = await stored(page);
    expect(s.ultimo === 'a' || s.ultimo === 'b').toBe(true);
    expect(s.a && s.b, 'tutti e due gli slot scritti').toBeTruthy();
    const latest = s.ultimo as 'a' | 'b';
    const other = latest === 'a' ? 'b' : 'a';
    const good = latest === 'a' ? s.b! : s.a!;
    const recent = latest === 'a' ? s.a! : s.b!;
    expect(good).toContain('"textScale":1.1');
    // Un byte cambiato nel mezzo dello slot più recente: il checksum non torna. Lo storage
    // si scrive prima che parta il gioco della pagina successiva (lo scaricamento della
    // pagina di adesso salva ancora, e riscriverebbe uno slot).
    const corrupted = recent.replace('"textScale":1.2', '"textScale":1.4');
    await storageOnNextLoad(page, 'slot-corrotto', { [KEYS[other]]: good, [KEYS[latest]]: corrupted, [KEYS.ultimo]: latest });
    await reload(page);
    const settings = (await call<{ settings: { textScale: number } }>(page, 'core.save')).settings;
    expect(settings.textScale, 'caricato lo slot buono (quello prima)').toBe(1.1);
    await expect(page.locator('[data-test="toast"][data-kind="warn"]'), 'avviso del salvataggio recuperato').toBeVisible();

    // Tutti e due corrotti: dati nuovi, un avviso, nessun errore.
    await storageOnNextLoad(page, 'tutti-corrotti', { [KEYS.a]: '{"v":1,"sum":"00000000","data":{}}', [KEYS.b]: 'non è json', [KEYS.ultimo]: 'a' });
    await reload(page);
    const fresh = await call<{ campaign: unknown; settings: { textScale: number } }>(page, 'core.save');
    expect(fresh.campaign).toBeNull();
    expect(fresh.settings.textScale).toBe(1);
    await expect(page.locator('[data-test="toast"][data-kind="warn"]')).toBeVisible();
    expect(await call(page, 'core.scene')).toBe('titolo');
    game.expectClean();
  });
});
