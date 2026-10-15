/**
 * Suite `audio` (ARCHITETTURA 11 e 15.2, GDD 13.6 e 17):
 *  - prima del primo gesto l'audio è bloccato; dopo il primo tocco (o clic)
 *    `audio.state() === 'running'`; nascondendo la pagina → 'suspended', poi di nuovo
 *    'running';
 *  - il log dei suoni della prima riga del prologo vero, giocata con il puntatore:
 *    incrocio (marta/teresa), ora fissata, campana (ore 6, stonatura 1), segreto;
 *  - «Tocca per continuare» dopo un'interruzione del sistema;
 *  - `mute(on)` e didascalie tradotte; nessun file audio scaricato (tutto sintetizzato).
 */
import type { Page } from '@playwright/test';
import { call, expect, onlyProjects, PLAY_PROJECTS, test, waitNight } from './helpers/game';
import { dragSpindle, pointerOf, pressFix, tap } from './helpers/pointer';

const AUDIO_FILE = /\.(mp3|ogg|oga|wav|m4a|aac|flac|opus|weba|caf)(\?|$)/i;

interface LogEntry {
  id: string;
  t: number;
  detail?: string;
}

async function setHidden(page: Page, hidden: boolean): Promise<void> {
  await page.evaluate((h) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

const audioState = (page: Page): Promise<string> => call<string>(page, 'audio.state');

test.describe('audio', () => {
  test.beforeEach(({}, testInfo) => onlyProjects(testInfo, ...PLAY_PROJECTS));

  test('primo tocco → running; pagina nascosta → suspended; di nuovo visibile → running', async ({ game }, testInfo) => {
    const { page } = game;
    expect(await audioState(page), 'prima di un gesto il contesto non parte').toBe('locked');
    const vp = await call<{ cssW: number; cssH: number }>(page, 'core.viewport');
    // Un tocco sul quadro del titolo (non su un pulsante).
    await tap(page, pointerOf(testInfo), { x: Math.round(vp.cssW / 2), y: Math.round(vp.cssH * 0.45) });
    await expect.poll(() => audioState(page), { timeout: 5_000 }).toBe('running');
    await setHidden(page, true);
    await expect.poll(() => audioState(page)).toBe('suspended');
    await setHidden(page, false);
    await expect.poll(() => audioState(page), { timeout: 5_000 }).toBe('running');
    // Niente file audio: tutto è sintetizzato (GDD 13).
    const files = game.net.all.filter((r) => AUDIO_FILE.test(r.url) || r.type === 'media');
    expect(files, 'nessun file audio scaricato').toEqual([]);
    game.expectClean();
  });

  test('il log della prima riga del prologo: incrocio, ora fissata, campana, segreto', async ({ game }, testInfo) => {
    const { page } = game;
    const kind = pointerOf(testInfo);
    // Come un giocatore: l'audio si sblocca col primo tocco al titolo («Tocca per iniziare»),
    // prima della notte; il primo trascinamento non paga anche il pre-render dei suoni.
    const vp = await call<{ cssW: number; cssH: number }>(page, 'core.viewport');
    await tap(page, kind, { x: Math.round(vp.cssW / 2), y: Math.round(vp.cssH * 0.45) });
    await expect.poll(() => audioState(page), { timeout: 5_000 }).toBe('running');
    await call(page, 'campaign.newGame');
    await call(page, 'campaign.goto', 'g00', 'notte');
    expect(await waitNight(page)).toBe(true);
    await page.waitForTimeout(500);
    await dragSpindle(page, kind, 1, 0);
    expect((await call<{ draft: unknown[] }>(page, 'night.state')).draft, 'Marta su Teresa').toEqual([{ pair: 0, over: 'R' }]);
    const before = (await call<LogEntry[]>(page, 'audio.log')).length;
    await pressFix(page, kind);
    await expect.poll(async () => (await call<{ hour: number }>(page, 'night.state')).hour).toBe(7);
    const log = (await call<LogEntry[]>(page, 'audio.log')).slice(Math.max(0, before - 4));
    const seq = log.map((e) => `${e.id}${e.detail ? `(${e.detail})` : ''}`);
    await testInfo.attach('log-prima-riga.txt', { body: seq.join('\n'), contentType: 'text/plain' });
    const expected = ['incrocio(marta/teresa)', 'ora_fissata', 'campana(ore 6 s=1)', 'segreto'];
    // In quest'ordine (altri suoni possono stare in mezzo, per esempio la presa del fuso).
    let k = 0;
    for (const s of seq) if (k < expected.length && (s === expected[k] || (expected[k] === 'segreto' && s.startsWith('segreto')))) k++;
    expect(k, `sequenza attesa ${expected.join(' → ')} in ${seq.join(' → ')}`).toBe(expected.length);
    game.expectClean();
  });

  test('«Tocca per continuare» dopo un’interruzione, mute e didascalie', async ({ game }, testInfo) => {
    const { page } = game;
    const vp = await call<{ cssW: number; cssH: number }>(page, 'core.viewport');
    await tap(page, pointerOf(testInfo), { x: Math.round(vp.cssW / 2), y: Math.round(vp.cssH * 0.45) });
    await expect.poll(() => audioState(page), { timeout: 5_000 }).toBe('running');
    await call(page, 'audio.interrupt');
    const overlay = page.locator('[data-test="audio-tocca"]');
    await expect(overlay, 'compare «Tocca per continuare»').toBeVisible();
    await expect(overlay).toContainText('Tocca per continuare');
    if (pointerOf(testInfo) === 'touch') await overlay.tap();
    else await overlay.click();
    await expect(overlay).toHaveCount(0);
    await expect.poll(() => audioState(page)).toBe('running');
    // mute(on) zittisce tutto senza fermare il contesto.
    expect(await call(page, 'audio.mute', true)).toBe(true);
    expect((await call<{ muted: boolean; state: string }>(page, 'audio.stats')).muted).toBe(true);
    expect(await call(page, 'audio.mute', false)).toBe(false);
    // Didascalie (GDD 14): la campana delle 9 si legge, tradotta.
    await call(page, 'core.setSettings', { captions: true });
    await call(page, 'audio.bell', 9, 1);
    const caption = page.locator('[data-test="caption"]').last();
    await expect(caption).toBeVisible();
    const text = (await caption.textContent()) ?? '';
    expect(text).toContain('9');
    expect(text).not.toMatch(/audio\./);
    game.expectClean();
  });
});
