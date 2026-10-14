/**
 * Suite `prologo` (ARCHITETTURA 15.2, GDD 3.15 e 9): il prologo della campagna
 * giocato con trascinamenti veri, il mouse sul progetto desktop e il tocco
 * (eventi touch del protocollo DevTools → pointer 'touch') sui telefoni e sull'iPad.
 * Le coordinate dei fusi, delle righe e dei pulsanti vengono da `night.layout()`.
 *
 * Si parte dal titolo al primo avvio («Tocca per iniziare»), si attraversano
 * lo schermo nero e il biglietto della nonna, poi le quattro righe del GDD 3.15:
 *  6  Marta su Teresa (prima Fissa l'ora a vuoto: lo spillo di Marta lo rifiuta);
 *  7  Piero su Teresa → nota a margine «Chi sta sopra, dà», tocco → rovesciato,
 *     la lettera passa a Don Piero (consegnata);
 *  8  Piero / Teresa;
 *  9  Teresa su Marta → «No.» (rifiuto, il fuso rimbalza), poi Marta su Teresa.
 * La notte finisce con 4 incroci, `night:complete` e l'alba.
 */
import { call, expect, nightState, onlyProjects, PLAY_PROJECTS, test, waitNight, waitScene, type Rec } from './helpers/game';
import { dragSpindle, longPress, nightLayout, pointerOf, pressFix, tapCrossing, tapTest } from './helpers/pointer';

test.describe('prologo con gesti veri', () => {
  test.beforeEach(({}, testInfo) => onlyProjects(testInfo, ...PLAY_PROJECTS));

  test('dal titolo all’alba: rifiuto di Marta, rovesciamento, consegna, fine', async ({ game }, testInfo) => {
    const { page } = game;
    const kind = pointerOf(testInfo);

    /**
     * Trascina un fuso e controlla la bozza. Un giocatore trascina appena può: se il
     * gesto va perso (per esempio sotto un avviso che compare in quel momento) il
     * difetto si registra come errore «soft» e si riprova una volta, quando gli
     * avvisi sono spariti, per verificare comunque il resto del prologo.
     */
    const dragChecked = async (label: string, from: number, to: number, expected: { pair: number; over: 'L' | 'R' }[]) => {
      await dragSpindle(page, kind, from, to);
      let st = await nightState(page);
      const toasts = await page.locator('[data-test="toast"]').allInnerTexts();
      expect.soft(st.draft, `${label}: il trascinamento arriva al tombolo al primo colpo (avvisi sopra i fusi: ${JSON.stringify(toasts)})`).toEqual(expected);
      if (JSON.stringify(st.draft) !== JSON.stringify(expected)) {
        await expect(page.locator('[data-test="toast"]')).toHaveCount(0, { timeout: 8_000 });
        if (st.draft.length > 0) await call(page, 'night.undo');
        await dragSpindle(page, kind, from, to);
        st = await nightState(page);
      }
      expect(st.draft, label).toEqual(expected);
      return st;
    };

    // ── Titolo al primo avvio → sera del prologo ──
    await expect.poll(() => call<string>(page, 'core.scene')).toBe('titolo');
    expect(await tapTest(page, kind, 'sc-titolo-nuova'), '«Tocca per iniziare» visibile').toBe(true);
    expect(await waitScene(page, 'sera')).toBe(true);
    await expect(page.locator('[data-test="cp-prologo-buio"]')).toBeVisible();
    expect(await tapTest(page, kind, 'cp-prologo-buio')).toBe(true);
    await expect(page.locator('[data-test="cp-prologo-biglietto"]')).toBeVisible();
    expect(await tapTest(page, kind, 'cp-prologo-tombolo')).toBe(true);
    expect(await waitNight(page), 'il tombolo del prologo si apre').toBe(true);
    let s = await nightState(page);
    expect([s.levelId, s.origin, s.mode, s.hour]).toEqual(['g00', 'campagna', 'normale', 6]);
    expect(s.positions).toEqual(['teresa', 'marta', 'piero']);
    await testInfo.attach('notte-inizio', { body: await page.screenshot(), contentType: 'image/png' });

    // ── Ore 6: Fissa l'ora a vuoto → lo spillo di Marta al Forno non è rispettato ──
    await pressFix(page, kind);
    s = await nightState(page);
    expect(s.message?.key, 'prima violazione in una riga').toBe('tombolo.violazione.spillo');
    expect(s.hour).toBe(6);
    s = await dragChecked('ore 6, Marta su Teresa', 1, 0, [{ pair: 0, over: 'R' }]);
    await pressFix(page, kind);
    s = await nightState(page);
    expect(s.hour, 'ora 6 fissata').toBe(7);
    expect(s.positions).toEqual(['marta', 'teresa', 'piero']);

    // ── Ore 7: verso sbagliato → nota a margine, tocco → rovesciato, consegna ──
    s = await dragChecked('ore 7, Piero su Teresa subito dopo Fissa l’ora', 2, 1, [{ pair: 1, over: 'R' }]);
    expect(s.margin.current, 'nota «Chi sta sopra, dà»').toBe('atto1.g00.margine.sopraDa');
    await expect(page.locator('[data-test="tb-margine"]')).toBeVisible();
    await tapCrossing(page, kind, 1);
    s = await nightState(page);
    expect(s.draft, 'tocco sull’incrocio → Teresa sopra').toEqual([{ pair: 1, over: 'L' }]);
    await pressFix(page, kind);
    s = await nightState(page);
    expect(s.hour).toBe(8);
    const after7 = s.timeline[s.timeline.length - 1];
    expect(after7?.delivered ?? [], 'la lettera di Teresa è consegnata a Don Piero').toContain('L1');
    expect(s.positions).toEqual(['marta', 'piero', 'teresa']);

    // ── Ore 8: Teresa su Piero (verso indifferente) ──
    s = await dragChecked('ore 8, Teresa su Piero', 2, 1, [{ pair: 1, over: 'R' }]);
    await pressFix(page, kind);
    s = await nightState(page);
    expect(s.hour).toBe(9);
    expect(s.positions).toEqual(['marta', 'teresa', 'piero']);

    // ── Ore 9: Teresa su Marta → «No.»; Marta su Teresa sì ──
    await dragSpindle(page, kind, 1, 0);
    s = await nightState(page);
    expect(s.lastViolation?.code, 'rifiuto di Marta').toBe('rifiuto');
    expect(s.draft, 'il fuso rimbalza: nessun incrocio').toEqual([]);
    expect(s.message?.text ?? '').toMatch(/No\./);
    await testInfo.attach('rifiuto-di-marta', { body: await page.screenshot(), contentType: 'image/png' });
    s = await dragChecked('ore 9, Marta su Teresa subito dopo il rifiuto', 0, 1, [{ pair: 0, over: 'L' }]);
    await pressFix(page, kind);

    // ── Fine: 4 incroci, night:complete, alba ──
    await expect.poll(async () => !!(await nightState(page)).completed, { timeout: 10_000 }).toBe(true);
    s = await nightState(page);
    const outcome = s.outcome ?? {};
    expect(outcome.metrics?.incroci, 'incroci del prologo (minimo 4)').toBe(4);
    expect(outcome.goals?.every((g) => g.status === 'soddisfatta'), 'lettera consegnata entro le 9').toBe(true);
    expect(s.positions, 'il merletto si chiude come era cominciato').toEqual(['teresa', 'marta', 'piero']);
    const events = await call<Rec[]>(page, 'core.events', 400);
    expect(events.some((e) => e.k === 'night:complete'), 'evento night:complete').toBe(true);
    expect(await waitScene(page, 'alba', 20_000), 'dopo la notte, l’alba').toBe(true);
    const dawn = await call<{ report: string[] }>(page, 'campaign.dawn');
    expect(dawn.report).toEqual(['g00.alba.marta', 'g00.alba.teresa', 'g00.alba.piero']);
    game.expectClean();
  });

  test('pressione lunga su un fuso apre la scheda del personaggio', async ({ game }, testInfo) => {
    const { page } = game;
    const kind = pointerOf(testInfo);
    await call(page, 'campaign.newGame');
    await call(page, 'campaign.goto', 'g00', 'notte');
    expect(await waitNight(page)).toBe(true);
    const l = await nightLayout(page);
    const marta = l.spindles.find((x) => x.thread === 'marta');
    expect(marta).toBeTruthy();
    await longPress(page, kind, { x: marta!.cx, y: marta!.cy });
    await expect(page.locator('[data-test="tb-scheda"]')).toHaveAttribute('data-filo', 'marta');
    await page.keyboard.press('Escape');
    game.expectClean();
  });
});
