/**
 * Suite `archivio` (ARCHITETTURA 15.2, GDD 5.3): il primo merletto d'Archivio (arc1,
 * 1936) aperto dalla cassapanca della campagna.
 *  - nominare: un tocco su un fuso sbiadito apre la scelta dei nomi; la conferma
 *    scatta solo con 3 nomi giusti (2 giusti + 1 sbagliato non confermano);
 *  - rammendare: lo strappo (10-11) si chiude solo se lo stato coincide con quello
 *    registrato; un rammendo sbagliato si rifiuta con una spiegazione;
 *  - eco: a merletto nominato e rammendato, un tocco su un incrocio registrato fa
 *    parlare l'eco; «Chiudi il merletto» porta alla rivelazione e alla conoscenza
 *    (arc1 rammendato, domanda «Marta e Teresa» chiusa).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { call, expect, nightState, onlyProjects, PLAY_PROJECTS, test, until, waitNight, waitScene } from './helpers/game';
import { nightLayout, pointerOf, tap, tapTest } from './helpers/pointer';

interface ArchiveDef {
  faded: string[];
  candidates: string[];
  answer: Record<string, string>;
  holes: { from: number; to: number }[];
  recorded: { hour: number; crossings: { pair: number; over: 'L' | 'R' }[] }[];
  echoes: { hour: number; pair: number; textKey: string }[];
}
const ARC1 = JSON.parse(readFileSync(fileURLToPath(new URL('../../src/content/levels/arc1.json', import.meta.url)), 'utf8')) as { startHour: number; archive: ArchiveDef };

test.describe('Archivio: nominare, rammendare, eco', () => {
  test.beforeEach(({}, testInfo) => onlyProjects(testInfo, ...PLAY_PROJECTS));

  test('arc1 dalla cassapanca fino alla rivelazione', async ({ game }, testInfo) => {
    const { page } = game;
    const kind = pointerOf(testInfo);
    const a = ARC1.archive;
    await call(page, 'core.setSettings', { animSpeed: 0 });
    await call(page, 'campaign.newGame');
    await call(page, 'campaign.goto', 'arc1', 'archivio');
    expect(await waitScene(page, 'archivio')).toBe(true);
    await expect(page.locator('[data-test="cp-apri-arc1"]'), 'il rotolo nella cassapanca').toBeVisible();
    expect(await tapTest(page, kind, 'cp-apri-arc1'), 'il rotolo di arc1 nella cassapanca').toBe(true);
    expect(await waitNight(page)).toBe(true);
    let s = await nightState(page);
    expect([s.levelId, s.mode, s.origin]).toEqual(['arc1', 'archivio', 'archivio']);
    const hole = a.holes[0]!;
    expect(s.hour, 'si riparte dallo strappo').toBe(hole.from);

    // ── Nominare: tocco sul fuso sbiadito → scelta; 2 giusti + 1 sbagliato non confermano ──
    const [f1, f2, f3, f4] = a.faded as [string, string, string, string];
    const l = await nightLayout(page);
    const sp = l.spindles.find((x) => x.thread === f1);
    expect(sp, `fuso di ${f1} visibile`).toBeTruthy();
    const picker = page.locator('[data-test="tb-nomina"]');
    const tapSpindle = async (): Promise<void> => {
      await tap(page, kind, { x: sp!.cx, y: sp!.cy });
      const toasts = await page.locator('[data-test="toast"]').allInnerTexts();
      const named = (await nightState(page)).archive?.names[f1] ?? null;
      // Su un telefono il tocco che apre la scelta non deve anche scegliere: il click di
      // compatibilità che segue il touchend cade sul pulsante comparso sotto il dito.
      expect.soft(named, `il tocco che apre la scelta dei nomi non sceglie già un nome (click fantasma su ${String(named)})`).toBeNull();
      if (named) await call(page, 'night.name', f1, null);
      expect.soft(await picker.isVisible(), `la scelta dei nomi resta aperta dopo il tocco (avvisi sopra i fusi: ${JSON.stringify(toasts)})`).toBe(true);
    };
    await tapSpindle();
    if (!(await picker.isVisible()) && (await page.locator('[data-test="toast"]').count()) > 0) {
      await expect(page.locator('[data-test="toast"]')).toHaveCount(0, { timeout: 8_000 });
      await tapSpindle();
    }
    if (await picker.isVisible()) expect(await tapTest(page, kind, `tb-nomina-${a.answer[f1]}`)).toBe(true);
    else await call(page, 'night.name', f1, a.answer[f1]);
    expect((await nightState(page)).archive?.names[f1], `${f1} nominato`).toBe(a.answer[f1]);
    const wrong = a.candidates.find((c) => c !== a.answer[f2] && !Object.values(a.answer).includes(c)) ?? 'clotilde';
    await call(page, 'night.name', f2, wrong);
    await call(page, 'night.name', f3, a.answer[f3]);
    s = await nightState(page);
    expect(s.archive?.counter.correct, 'due nomi giusti').toBe(2);
    expect(s.archive?.confirmed, 'con 2 giusti e 1 sbagliato nessuna conferma').toEqual([]);
    // Il contatore si legge nella striscia (GDD 10.3). Dalla revisione 1 dice i nomi dati
    // («Nomi dati: 3 di 4») invece dei giusti, per non svelare subito quale è sbagliato.
    await expect(page.locator('[data-test="tb-req-info"]'), 'contatore dei nomi nella striscia').toHaveText(/\d+\s*(\/|di|of)\s*\d+/);
    await call(page, 'night.name', f2, a.answer[f2]);
    s = await nightState(page);
    expect(s.archive?.confirmed.length, 'con 3 giusti la conferma scatta').toBe(3);
    await call(page, 'night.name', f4, a.answer[f4]);
    s = await nightState(page);
    expect(s.archive?.named, 'tutti nominati').toBe(true);

    // ── Rammendare: uno sbagliato si rifiuta, quello registrato si accetta ──
    // Rammendo sbagliato ma lecito (spilli rispettati): alle 10 il secondo incrocio con
    // il verso rovesciato; alle 11 quello registrato. Lo stato a fine strappo non coincide.
    const rows = a.recorded.filter((r) => r.hour >= hole.from && r.hour <= hole.to);
    const [first, ...rest] = rows;
    expect(first && rest.length > 0, 'lo strappo copre almeno due ore').toBeTruthy();
    const flipped = first!.crossings.map((c, i) => (i === first!.crossings.length - 1 ? { pair: c.pair, over: c.over === 'L' ? 'R' : 'L' } : c));
    for (const c of flipped) await call(page, 'night.cross', c.pair, c.over);
    expect((await call<{ ok: boolean }>(page, 'night.fix')).ok, `rammendo lecito delle ${first!.hour}`).toBe(true);
    for (const r of rest) {
      for (const c of r.crossings) await call(page, 'night.cross', c.pair, c.over);
      const res = await call<{ ok: boolean }>(page, 'night.fix');
      if (r.hour === hole.to) expect(res.ok, 'a fine strappo lo stato non coincide: rifiuto').toBe(false);
      else expect(res.ok).toBe(true);
    }
    s = await nightState(page);
    expect(s.message?.key, 'spiegazione del rifiuto').toBe('tombolo.archivio.nonCoincide');
    for (let i = 0; i < 12; i++) {
      s = await nightState(page);
      if (s.hour === hole.from && s.draft.length === 0) break;
      await call(page, 'night.undo');
    }
    expect([s.hour, s.draft], 'Disfa riporta all’inizio dello strappo').toEqual([hole.from, []]);
    for (const r of rows) {
      for (const c of r.crossings) expect(await call(page, 'night.cross', c.pair, c.over), `incrocio ${r.hour}:${c.pair}${c.over}`).toBeNull();
      const res = await call<{ ok: boolean } | null>(page, 'night.fix');
      expect(res?.ok, `rammendo delle ${r.hour}`).toBe(true);
    }
    s = await nightState(page);
    expect(s.archive?.mended, 'strappo rammendato').toBe(true);

    // ── Eco: tocco su un incrocio registrato ──
    const echo = a.echoes[0]!;
    const l2 = await nightLayout(page);
    const row = l2.rows.find((r) => r.hour === echo.hour);
    const c0 = l2.columns[echo.pair];
    const c1 = l2.columns[echo.pair + 1];
    expect(row && c0 && c1, `riga delle ${echo.hour} visibile`).toBeTruthy();
    await tap(page, kind, { x: (c0!.cx + c1!.cx) / 2, y: row!.y + row!.h / 2 });
    await expect(page.locator('[data-test="tb-eco"]'), 'l’eco parla al tocco').toBeVisible();
    await testInfo.attach('eco', { body: await page.screenshot(), contentType: 'image/png' });
    await page.keyboard.press('Escape');
    expect(await call(page, 'night.echo', echo.hour, echo.pair)).toBe(echo.textKey);
    await page.keyboard.press('Escape');

    // ── Chiudi il merletto (il pulsante grande, GDD 10.3) → rivelazione e conoscenza ──
    if ((await call<string[]>(page, 'core.overlays')).length > 0) await call(page, 'core.closeOverlay');
    await expect(page.locator('[data-test="tb-eco"]')).toHaveCount(0);
    const main = page.locator('[data-test="tb-fissa"]');
    await expect(main, '«Fissa l’ora» diventa «Chiudi il merletto»').toContainText('Chiudi il merletto');
    if (kind === 'touch') await main.tap();
    else await main.click();
    expect(await until(page, async () => !!(await nightState(page)).completed || (await call<string>(page, 'core.scene')) === 'archivio')).toBe(true);
    expect(await waitScene(page, 'archivio', 20_000)).toBe(true);
    const k = await call<{ archive: Record<string, string>; questions: Record<string, string> }>(page, 'campaign.knowledge');
    expect(k.archive.arc1).toBe('rammendato');
    expect(k.questions.martaTeresa).toBe('risolta');
    game.expectClean();
  });
});
