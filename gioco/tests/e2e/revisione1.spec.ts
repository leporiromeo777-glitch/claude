/**
 * Suite `revisione1` (docs/REVISIONE-1.md): le correzioni principali della revisione 1
 * provate nel gioco vero, con i gesti del progetto (mouse o tocco), dove i test
 * unitari dei pacchetti non arrivano.
 *  - D05.1, C10, CAM-01: «Lascia per ora» nella Pausa dell'Archivio riporta alla
 *    cassapanca, «Più tardi» alla sera dopo; «Rileggi» apre il merletto rammendato in
 *    sola lettura, con i nomi giusti.
 *  - D05.3, D05.5, TOM-01: la scelta dei nomi non tradisce il dito (niente click
 *    fantasma, 350 ms di guardia, lontano dal punto toccato, altezza fissa con «Togli
 *    il nome»), niente nomi doppi.
 *  - D01, C01, C13, D04: la regola nuova di Gino (non sta fermo due ore di fila) con il
 *    messaggio che nomina il vicino, la nota a margine e nessun avviso a banner.
 *  - D06, D16, D07.1, TOM-05, TOM-11: l'HUD dice «Ore 7 · fino alle N» a lettere intere e
 *    non più piccole di 15 px × scala del testo; la lampada si vede dall'inizio.
 *  - D04, TOM-07: la nota a margine non copre la riga corrente, gli spilli, i fusi e le
 *    azioni; un tocco la chiude senza toccare l'incrocio sotto.
 *  - D06, TOM-12: un tocco su uno spillo spiega («Teresa al Forno alle 9…»).
 *  - D15, C17, CAM-02: la calligrafia inclina il foglio (al più ±3°), il testo resta nel
 *    foglio e non prende i tocchi, «Appunta», «Rispondi» e «Lascia» rispondono (Bepi 8°,
 *    Gino −7°, Zeno −9° nei dati).
 *  - D16, P116: Esc nella sera senza pannelli chiede «Tornare al titolo?».
 *  - D03, TOM-08: alle 7 del prologo «Chi sta sopra, dà» compare anche col verso giusto.
 *  - D07, TOM-10: la lampada si vede subito, il tocco riapre il gradino già mostrato e non
 *    chiama mai il Fantasma, il Fantasma chiede conferma, dopo il primo uso resta accesa.
 *  - D05.2: all'apertura di un Archivio nessun avviso dice chi è un filo sbiadito.
 * L'offline con il service worker (SCH-08) è in rete.spec.ts.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { dismissActCard, solutionRows } from './helpers/campaign';
import { call, expect, nightState, onlyProjects, PLAY_PROJECTS, test, until, waitNight, waitScene } from './helpers/game';
import { nightLayout, pointerOf, tap, tapTest, type Point } from './helpers/pointer';

interface ArchiveDef {
  faded: string[];
  candidates: string[];
  answer: Record<string, string>;
}
const ARC1 = JSON.parse(readFileSync(fileURLToPath(new URL('../../src/content/levels/arc1.json', import.meta.url)), 'utf8')) as { archive: ArchiveDef };

interface Knowledge {
  archive: Record<string, string>;
}
interface CampaignState {
  phase: string;
  levelId: string;
}
interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const campaignState = (page: Page): Promise<CampaignState> => call<CampaignState>(page, 'campaign.state');

/** Due rettangoli si sovrappongono (con un margine di tolleranza in px). */
function overlaps(a: Box, b: Box, tol = 1): boolean {
  return a.x + a.width - tol > b.x && b.x + b.width - tol > a.x && a.y + a.height - tol > b.y && b.y + b.height - tol > a.y;
}

const inside = (p: Point, b: Box): boolean => p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;

/**
 * arc1 aperto dalla cassapanca nella fase d'Archivio della campagna, come un giocatore:
 * il bilancio di g03, «Continua», la cassapanca con il rotolo nuovo.
 */
async function openArc1(page: Page, kind: 'mouse' | 'touch'): Promise<void> {
  await call(page, 'core.setSettings', { animSpeed: 0 });
  await call(page, 'campaign.newGame');
  await call(page, 'campaign.goto', 'g03', 'bilancio');
  expect(await waitScene(page, 'bilancio')).toBe(true);
  await call(page, 'campaign.next');
  expect(await waitScene(page, 'archivio'), 'dopo il bilancio di g03, la cassapanca').toBe(true);
  expect(await campaignState(page)).toMatchObject({ phase: 'archivio', levelId: 'g03' });
  expect(await tapTest(page, kind, 'cp-apri-arc1'), 'il rotolo di arc1 nella cassapanca').toBe(true);
  expect(await waitNight(page)).toBe(true);
}

test.describe('revisione 1: Archivio', () => {
  test.beforeEach(({}, testInfo) => onlyProjects(testInfo, ...PLAY_PROJECTS));

  test('«Lascia per ora» torna alla cassapanca, «Più tardi» alla sera dopo; «Rileggi» in sola lettura', async ({ game }, testInfo) => {
    const { page } = game;
    const kind = pointerOf(testInfo);
    const a = ARC1.archive;
    await openArc1(page, kind);
    expect((await campaignState(page)).phase, 'fase d’Archivio dopo il bilancio di g03').toBe('archivio');
    // Tre nomi giusti si confermano, poi si lascia l'Archivio a metà.
    for (const f of a.faded.slice(0, 3)) await call(page, 'night.name', f, a.answer[f]);
    expect((await nightState(page)).archive?.confirmed.length, 'tre nomi giusti confermati').toBe(3);
    expect(await tapTest(page, kind, 'tb-menu'), 'il menu del tombolo apre la Pausa').toBe(true);
    await expect(page.locator('[data-test="sc-pausa-lascia"]'), '«Lascia per ora» nella Pausa dell’Archivio').toBeVisible();
    await expect(page.locator('[data-test="sc-pausa-lascia"]')).toContainText('Lascia per ora');
    expect(await tapTest(page, kind, 'sc-pausa-lascia')).toBe(true);
    expect(await waitScene(page, 'archivio'), 'di nuovo la cassapanca').toBe(true);
    await expect(page.locator('[data-test="cp-apri-arc1"]'), 'arc1 si può ancora aprire').toBeVisible();
    await expect(page.locator('[data-test="cp-apri-arc1"]')).toContainText('Apri');
    expect((await call<{ night: unknown }>(page, 'core.save')).night, 'la notte d’Archivio lasciata non resta nel salvataggio').toBeNull();
    expect((await call<Knowledge>(page, 'campaign.knowledge')).archive.arc1, 'l’Archivio non è rammendato').not.toBe('rammendato');
    const later = page.locator('[data-test="cp-archivio-chiudi"]');
    await expect(later, '«Più tardi» nella fase d’Archivio').toContainText('Più tardi');
    expect(await tapTest(page, kind, 'cp-archivio-chiudi')).toBe(true);
    await expect.poll(async () => { const s = await campaignState(page); return [s.phase, s.levelId]; }, { message: '«Più tardi» porta alla sera di g04' }).toEqual(['sera', 'g04']);
    expect(await waitScene(page, 'sera')).toBe(true);

    // arc1 rammendato: il rotolo dice «Rileggi» e apre il merletto in sola lettura con i nomi giusti.
    await call(page, 'campaign.goto', 'arc1', 'archivio');
    expect(await waitScene(page, 'archivio')).toBe(true);
    expect(await tapTest(page, kind, 'cp-apri-arc1')).toBe(true);
    expect(await waitNight(page)).toBe(true);
    await call(page, 'night.autoplay');
    expect(await waitScene(page, 'archivio', 20_000)).toBe(true);
    expect((await call<Knowledge>(page, 'campaign.knowledge')).archive.arc1).toBe('rammendato');
    const skip = page.locator('[data-test="cp-vignetta-salta"]');
    if (await skip.isVisible().catch(() => false)) await skip.click();
    expect(await tapTest(page, kind, 'cp-archivio-cassapanca'), '«Alla cassapanca» dopo l’esito').toBe(true);
    await expect(page.locator('[data-test="cp-apri-arc1"]'), 'il rotolo rammendato si rilegge').toContainText('Rileggi');
    await expect(page.locator('[data-test="cp-rifai-arc1"]'), 'e si può rifare da capo').toBeVisible();
    expect(await tapTest(page, kind, 'cp-apri-arc1')).toBe(true);
    expect(await waitNight(page)).toBe(true);
    const s = await nightState(page);
    expect([s.levelId, s.mode], '«Rileggi»: il merletto si ritesse da solo').toEqual(['arc1', 'replay']);
    await expect.poll(async () => (await nightState(page)).completed, { message: 'il merletto rammendato si ritesse fino in fondo' }).toBe(true);
    // I fili non sono più sbiaditi: hanno il nome (e il colore) del loro personaggio.
    const status = (await page.locator('[data-test="tb-stato"]').textContent()) ?? '';
    expect(status, '«Rileggi» senza fili sbiaditi').not.toMatch(/sbiadit/i);
    for (const who of ['Marta', 'Teresa', 'Anselmo']) expect(status, `«Rileggi»: ${who} nel merletto`).toContain(who);
    await expect(page.locator('[data-test="cp-rileggi-chiudi"]'), '«Alla cassapanca» sotto il merletto riletto').toBeVisible();
    expect((await call<Knowledge>(page, 'campaign.knowledge')).archive.arc1, 'rileggere non cambia l’Archivio').toBe('rammendato');
    game.expectClean();
  });

  test('nessun avviso dice chi è un filo sbiadito prima che lo si nomini', async ({ game }, testInfo) => {
    // D05.2: i nomi si trovano alla maniera di Obra Dinn, il gioco non regala informazioni.
    // All'apertura di arc1 le righe registrate si ritessono da sole: se un filo sbiadito
    // mostra una stranezza, l'avviso del Taccuino non deve dire di chi è.
    onlyProjects(testInfo, 'desktop', 'iphone');
    const { page } = game;
    const kind = pointerOf(testInfo);
    const a = ARC1.archive;
    // I nomi dei candidati come si scrivono negli avvisi («Teresa», «Don Anselmo»…).
    const labels = a.candidates.map((c) => c.charAt(0).toUpperCase() + c.slice(1));
    await openArc1(page, kind);
    const seen = new Set<string>();
    for (let i = 0; i < 16; i++) {
      for (const t of await page.locator('[data-test="toast"]').allInnerTexts()) seen.add(t);
      await page.waitForTimeout(250);
    }
    const st = await nightState(page);
    expect(Object.values(st.archive?.names ?? {}).filter(Boolean), 'nessun filo ancora nominato').toEqual([]);
    const spoilers = [...seen].filter((t) => labels.some((n) => t.includes(n)));
    expect(spoilers, `avvisi che nominano un candidato mentre i fili sono ancora sbiaditi (${labels.join(', ')})`).toEqual([]);
    game.expectClean();
  });

  test('la scelta dei nomi non tradisce il dito e non ammette nomi doppi', async ({ game }, testInfo) => {
    const { page } = game;
    const kind = pointerOf(testInfo);
    const a = ARC1.archive;
    const [f1, f2] = a.faded as [string, string];
    await openArc1(page, kind);
    const l = await nightLayout(page);
    const sp = l.spindles.find((x) => x.thread === f1);
    expect(sp, `fuso sbiadito di ${f1}`).toBeTruthy();
    const at: Point = { x: sp!.cx, y: sp!.cy };
    // Un clic che arriva appena la scheda compare (come il click di compatibilità di un tocco,
    // o un secondo tocco nervoso) cade su un nome: nei primi 350 ms si ignora (D05.5).
    await page.evaluate(() => {
      const w = window as unknown as { __qaGuard: { clicked: string | null } };
      w.__qaGuard = { clicked: null };
      const obs = new MutationObserver(() => {
        const b = document.querySelector<HTMLElement>('[data-test="tb-nomina"] button[data-test^="tb-nomina-"]:not([data-test="tb-nomina-togli"])');
        if (!b || w.__qaGuard.clicked) return;
        w.__qaGuard.clicked = b.dataset.test ?? '?';
        obs.disconnect();
        b.click();
      });
      obs.observe(document.body, { childList: true, subtree: true });
    });
    await tap(page, kind, at);
    const picker = page.locator('[data-test="tb-nomina"]');
    // Primo colpo (come nel prologo): un tocco che va perso è un difetto, si riprova una volta
    // per verificare comunque il resto.
    const first = await picker.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true, () => false);
    expect.soft(first, 'il primo tocco sul fuso sbiadito apre la scelta dei nomi').toBe(true);
    if (!first) await tap(page, kind, at);
    await expect(picker, 'il tocco sul fuso sbiadito apre la scelta dei nomi').toBeVisible();
    const clicked = await page.evaluate(() => (window as unknown as { __qaGuard: { clicked: string | null } }).__qaGuard.clicked);
    expect(clicked, 'la sonda ha cliccato un nome appena aperta la scelta').not.toBeNull();
    let st = await nightState(page);
    expect(st.archive?.names[f1] ?? null, `nessun nome scelto dal tocco che apre né dal clic dentro i 350 ms (${clicked})`).toBeNull();
    const box = (await page.locator('[data-test="tb-popup-nomina"]').boundingBox()) ?? (await picker.boundingBox());
    expect(box).toBeTruthy();
    expect(inside(at, box!), `la scelta si apre lontano dal punto toccato (${JSON.stringify(at)} in ${JSON.stringify(box)})`).toBe(false);
    await expect(page.locator('[data-test="tb-nomina-dati"]'), 'nessun contatore dei giusti: «Nomi dati»').toContainText('Nomi dati: 0 di 4');
    const off = page.locator('[data-test="tb-nomina-togli"]');
    await expect(off, '«Togli il nome» c’è sempre (altezza fissa)').toBeVisible();
    await expect(off, 'disattivato se il filo non ha un nome').toBeDisabled();
    const h0 = (await picker.boundingBox())?.height ?? 0;
    await page.waitForTimeout(400);
    expect(await tapTest(page, kind, `tb-nomina-${a.answer[f1]}`), 'passata la guardia il nome si sceglie').toBe(true);
    st = await nightState(page);
    expect(st.archive?.names[f1], `${f1} nominato`).toBe(a.answer[f1]);
    // Di nuovo sullo stesso fuso: la scheda ha la stessa altezza, «Togli il nome» ora è attivo.
    await expect(picker).toHaveCount(0);
    await tap(page, kind, at);
    await expect(picker).toBeVisible();
    await expect(off).toBeEnabled();
    expect(Math.abs(((await picker.boundingBox())?.height ?? 0) - h0), 'altezza fissa della scelta dei nomi').toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');
    await expect(picker).toHaveCount(0);
    // Niente nomi doppi: lo stesso nome dato a un altro filo si sposta (D05.3).
    await call(page, 'night.name', f2, a.answer[f1]);
    st = await nightState(page);
    expect([st.archive?.names[f1] ?? null, st.archive?.names[f2] ?? null], 'il nome passa al filo nuovo').toEqual([null, a.answer[f1]]);
    expect(st.message?.key, 'messaggio dello spostamento').toBe('tombolo.archivio.spostato');
    game.expectClean();
  });
});

test.describe('revisione 1: tombolo', () => {
  test('regola di Gino: non sta fermo due ore di fila; il messaggio nomina il vicino', async ({ game }, testInfo) => {
    onlyProjects(testInfo, 'desktop', 'iphone');
    const { page } = game;
    await call(page, 'core.setSettings', { animSpeed: 0 });
    await call(page, 'campaign.newGame');
    await call(page, 'campaign.goto', 'g01', 'notte');
    expect(await waitNight(page)).toBe(true);
    let s = await nightState(page);
    expect([s.hour, s.positions], 'g01: Gino fra Marta e Don Piero').toEqual([7, ['teresa', 'marta', 'gino', 'piero']]);
    // Ore 7: all'apertura Gino conta come appena mosso, la riga ferma passa (C01).
    expect((await call<{ ok: boolean }>(page, 'night.fix')).ok, 'ore 7: la prima riga ferma di Gino è lecita').toBe(true);
    // Ore 8: Teresa deve essere al Forno (Marta sopra, perché Marta non passa sotto);
    // Gino è stato fermo un'ora e Marta, impegnata con Teresa, conta come libera.
    expect(await call(page, 'night.cross', 0, 'R')).toBeNull();
    await page.waitForTimeout(300);
    const toastsBefore = await page.locator('[data-test="toast"]').allInnerTexts();
    const r8 = await call<{ ok: boolean; violations: { code: string; params?: Record<string, unknown> }[] }>(page, 'night.fix');
    expect(r8.ok, 'ore 8: seconda riga ferma di Gino rifiutata').toBe(false);
    expect(r8.violations[0]?.code).toBe('corre');
    expect(r8.violations[0]?.params?.vicino, 'il primo vicino libero da sinistra, anche se impegnato in un altro incrocio').toBe('marta');
    s = await nightState(page);
    expect(s.message?.key).toBe('tombolo.violazione.corre');
    expect(s.message?.text ?? '', 'il messaggio nomina Gino e il vicino').toMatch(/Gino.*fermo.*(Marta)/);
    expect(s.margin.shown, 'la nota a margine della regola nuova (prima notte di Gino)').toContain('atto1.g01.margine.gino');
    // Un solo messaggio per violazione: la riga di motivo sotto «Fissa l'ora», niente avviso a
    // banner (D04: «I rifiuti di riga non producono mai un avviso a banner»).
    await page.waitForTimeout(400);
    const toastsAfter = (await page.locator('[data-test="toast"]').allInnerTexts()).filter((t) => !toastsBefore.includes(t));
    expect.soft(toastsAfter, 'nessun avviso a banner nato dalla riga rifiutata (D04)').toEqual([]);
    // Gino incrocia con Don Piero: la riga passa.
    expect(await call(page, 'night.cross', 2, 'L')).toBeNull();
    expect((await call<{ ok: boolean }>(page, 'night.fix')).ok, 'ore 8 con Gino che incrocia').toBe(true);
    s = await nightState(page);
    expect(s.positions).toEqual(['marta', 'teresa', 'piero', 'gino']);
    // Ore 9: dopo un incrocio Gino può stare fermo (Teresa torna al Molo, Marta sopra).
    expect(await call(page, 'night.cross', 0, 'L')).toBeNull();
    expect((await call<{ ok: boolean }>(page, 'night.fix')).ok, 'ore 9: Gino fermo dopo un incrocio è lecito').toBe(true);
    // Ore 10: di nuovo fermo dopo un'ora ferma → rifiuto, con Don Piero come vicino.
    const r10 = await call<{ ok: boolean; violations: { code: string; params?: Record<string, unknown> }[] }>(page, 'night.fix');
    expect([r10.ok, r10.violations[0]?.code, r10.violations[0]?.params?.vicino], 'ore 10: seconda riga ferma rifiutata').toEqual([false, 'corre', 'piero']);
    expect((await nightState(page)).message?.text ?? '').toMatch(/Don Piero/);
    game.expectClean();
  });

  test('prologo: alle 7 «Chi sta sopra, dà» compare anche a chi incrocia nel verso giusto', async ({ game }, testInfo) => {
    onlyProjects(testInfo, 'desktop', 'iphone');
    const { page } = game;
    await call(page, 'core.setSettings', { animSpeed: 0 });
    await call(page, 'campaign.newGame');
    await call(page, 'campaign.goto', 'g00', 'notte');
    expect(await waitNight(page)).toBe(true);
    expect(await call(page, 'night.cross', 0, 'R')).toBeNull();
    await expect.poll(async () => (await nightState(page)).margin.shown, { message: 'ore 6: la nota dello spillo al primo incrocio' }).toContain('atto1.g00.margine.spillo');
    expect((await call<{ ok: boolean }>(page, 'night.fix')).ok).toBe(true);
    // Ore 7: Teresa sopra Don Piero, il verso giusto (la lettera passa a lui).
    expect(await call(page, 'night.cross', 1, 'L')).toBeNull();
    await expect
      .poll(async () => (await nightState(page)).margin.shown, { timeout: 15_000, message: 'ore 7: «Chi sta sopra, dà» al primo incrocio, qualunque sia il verso (D03, TOM-08)' })
      .toContain('atto1.g00.margine.sopraDa');
    await expect(page.locator('[data-test="tb-nota-margine"]')).toContainText(/sopra/i);
    expect((await nightState(page)).draft, 'la nota non cambia l’incrocio').toEqual([{ pair: 1, over: 'L' }]);
    game.expectClean();
  });

  test('la lampada: si vede subito, riapre il gradino già mostrato, il Fantasma chiede conferma, resta accesa', async ({ game }, testInfo) => {
    onlyProjects(testInfo, ...PLAY_PROJECTS);
    const { page } = game;
    const kind = pointerOf(testInfo);
    await call(page, 'core.setSettings', { animSpeed: 0 });
    await call(page, 'campaign.newGame');
    await call(page, 'campaign.goto', 'g02', 'notte');
    expect(await waitNight(page)).toBe(true);
    const lamp = page.locator('[data-test="tb-lampada"]');
    const card = page.locator('[data-test="tb-suggerimento"]');
    await expect(lamp, 'la lampada si vede dall’inizio, tenue (D07.1)').toBeVisible();
    // Si va (con la soluzione) alla prima riga in cui serve un incrocio: lì il Fantasma costa il
    // filo d'oro (su una riga di quiete è gratuito e non chiede conferma, D07.4).
    const rows = await solutionRows(page, 'g02', []);
    expect(rows, 'una soluzione di g02').not.toBeNull();
    const k = rows!.findIndex((r) => r.crossings.some((c) => !c.forced));
    expect(k, 'una riga con un incrocio nella soluzione').toBeGreaterThanOrEqual(0);
    if (k > 0) {
      await call(page, 'night.autoplay', rows!.slice(0, k));
      await expect.poll(async () => (await nightState(page)).rows.length).toBe(k);
    }
    /** Apre la scheda dalla lampada e aspetta come una persona (i primi 350 ms la scheda ignora i tocchi). */
    const openLamp = async (label: string): Promise<void> => {
      expect(await tapTest(page, kind, 'tb-lampada'), label).toBe(true);
      await expect(card, `${label}: la scheda del suggerimento`).toBeVisible();
      await page.waitForTimeout(450);
    };
    const close = async (): Promise<void> => {
      await page.keyboard.press('Escape');
      await expect(card).toHaveCount(0);
    };
    // Tre tocchi sulla lampada: sempre la Spinta, mai il Fantasma (P103).
    for (let i = 1; i <= 3; i++) {
      await openLamp(`tocco ${i} sulla lampada`);
      await expect(card, `tocco ${i}: il tocco sulla lampada non sale di gradino`).toHaveAttribute('data-gradino', 'spinta');
      await close();
    }
    expect((await nightState(page)).fantasmaUsed, 'nessun Fantasma dai tocchi sulla lampada').toBe(false);
    // Si sale solo con i pulsanti della scheda; il tocco riapre il gradino più alto già visto.
    await openLamp('lampada');
    expect(await tapTest(page, kind, 'tb-suggerimento-ancora'), '«Dammi un indizio»').toBe(true);
    await expect(card).toHaveAttribute('data-gradino', 'indizio');
    await close();
    await openLamp('lampada dopo l’Indizio');
    await expect(card, 'la lampada riapre l’Indizio già mostrato in questa riga (D07.2)').toHaveAttribute('data-gradino', 'indizio');
    // Il Fantasma, con il filo d'oro ancora possibile, chiede conferma (D07.3).
    expect(await tapTest(page, kind, 'tb-suggerimento-ancora'), '«Mostrami l’incrocio»').toBe(true);
    await expect(card, 'conferma prima del Fantasma').toHaveAttribute('data-gradino', 'conferma');
    await expect(page.locator('[data-test="tb-fantasma-conferma"]'), 'il pulsante dice che si perde il filo d’oro').toContainText(/filo d.oro/);
    await page.waitForTimeout(450);
    expect(await tapTest(page, kind, 'tb-fantasma-annulla')).toBe(true);
    await expect(card).toHaveCount(0);
    expect((await nightState(page)).fantasmaUsed, 'annullando, il filo d’oro resta possibile').toBe(false);
    // Dopo il primo suggerimento la lampada resta accesa anche nelle ore dopo (D07.1, P101).
    await expect(lamp).toHaveClass(/tb-lamp--accesa/);
    for (const c of rows![k]!.crossings.filter((x) => !x.forced)) expect(await call(page, 'night.cross', c.pair, c.over)).toBeNull();
    expect((await call<{ ok: boolean }>(page, 'night.fix')).ok, 'la riga della soluzione').toBe(true);
    await expect(lamp, 'la lampada resta accesa all’ora dopo').toHaveClass(/tb-lamp--accesa/);
    game.expectClean();
  });

  for (const scale of [1, 1.4]) {
    test(`HUD «Ore N · fino alle N» a lettere intere e lampada visibile (testo ${Math.round(scale * 100)}%)`, async ({ game }, testInfo) => {
      onlyProjects(testInfo, ...PLAY_PROJECTS);
      const { page } = game;
      await call(page, 'core.setSettings', { animSpeed: 0, textScale: scale });
      await call(page, 'campaign.newGame');
      const check = async (label: string, hour: RegExp, end: RegExp): Promise<void> => {
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        await expect(page.locator('[data-test="tb-hud-ora"]'), `${label}: ora corrente`).toHaveText(hour);
        await expect(page.locator('[data-test="tb-hud-fine"]'), `${label}: ora di fine sempre visibile (D06)`).toHaveText(end);
        await expect(page.locator('[data-test="tb-hud-fine"]')).toBeVisible();
        const m = await page.evaluate(() =>
          ['tb-hud-ora', 'tb-hud-fine'].map((t) => {
            const e = document.querySelector<HTMLElement>(`[data-test="${t}"]`)!;
            const r = e.getBoundingClientRect();
            const cs = getComputedStyle(e);
            return { t, font: parseFloat(cs.fontSize), cut: e.scrollWidth > e.clientWidth + 1 || cs.textOverflow === 'ellipsis', left: r.left, right: r.right, vw: window.innerWidth };
          }),
        );
        for (const x of m) {
          expect(x.font, `${label}: ${x.t} non sotto 15 px × ${scale} (D16)`).toBeGreaterThanOrEqual(15 * scale - 0.5);
          expect(x.cut, `${label}: ${x.t} non troncato`).toBe(false);
          expect(x.left >= 0 && x.right <= x.vw, `${label}: ${x.t} dentro lo schermo`).toBe(true);
        }
        await expect(page.locator('[data-test="tb-lampada"]'), `${label}: la lampada si vede dall’inizio (D07.1)`).toBeVisible();
      };
      await call(page, 'campaign.goto', 'g00', 'notte');
      expect(await waitNight(page)).toBe(true);
      await check('prologo', /^Ore 6$/, /^fino alle 9$/);
      await call(page, 'night.cross', 0, 'R');
      expect((await call<{ ok: boolean }>(page, 'night.fix')).ok).toBe(true);
      await check('prologo dopo un’ora', /^Ore 7$/, /^fino alle 9$/);
      await call(page, 'campaign.goto', 'g13', 'notte');
      expect(await waitNight(page)).toBe(true);
      await check('g13, la notte più lunga', /^Ore 7$/, /^fino alle 20$/);
      game.expectClean();
    });
  }

  test('la nota a margine non copre la riga, gli spilli e i fusi; un tocco la chiude senza toccare l’incrocio sotto', async ({ game }, testInfo) => {
    onlyProjects(testInfo, ...PLAY_PROJECTS);
    const { page } = game;
    const kind = pointerOf(testInfo);
    await call(page, 'core.setSettings', { animSpeed: 0 });
    await call(page, 'campaign.newGame');
    await call(page, 'campaign.goto', 'g01', 'notte');
    expect(await waitNight(page)).toBe(true);
    expect((await call<{ ok: boolean }>(page, 'night.fix')).ok).toBe(true);
    // Alle 8 la nota della regola di Gino (passo `margine` `ora` 8 di g01).
    const note = page.locator('[data-test="tb-margine"]');
    await expect(note, 'nota a margine delle 8').toBeVisible();
    expect((await nightState(page)).margin.current).toBe('atto1.g01.margine.gino');
    // Un incrocio in bozza nella riga corrente (Teresa e Marta, Marta sopra).
    expect(await call(page, 'night.cross', 0, 'R')).toBeNull();
    await page.waitForTimeout(200);
    const nb = await note.boundingBox();
    expect(nb).toBeTruthy();
    const l = await call<{
      lace: { x: number; y: number; w: number; h: number };
      spindleBand: { x: number; y: number; w: number; h: number };
      actions: { x: number; y: number; w: number; h: number } | null;
      rows: { index: number; hour: number; y: number; h: number; kind: string }[];
      pins: { hour: number; x: number; y: number }[];
    }>(page, 'night.layout');
    const cur = l.rows.find((r) => r.kind === 'corrente');
    expect(cur, 'riga corrente nel layout').toBeTruthy();
    const forbidden: { what: string; box: Box }[] = [];
    for (const r of l.rows.filter((x) => x.index >= cur!.index && x.index <= cur!.index + 2)) forbidden.push({ what: `riga delle ${r.hour}`, box: { x: l.lace.x, y: r.y, width: l.lace.w, height: r.h } });
    for (const p of l.pins.filter((x) => x.hour >= cur!.hour)) forbidden.push({ what: `spillo delle ${p.hour}`, box: { x: p.x - 10, y: p.y - 10, width: 20, height: 20 } });
    forbidden.push({ what: 'fascia dei fusi', box: { x: l.spindleBand.x, y: l.spindleBand.y, width: l.spindleBand.w, height: l.spindleBand.h } });
    if (l.actions) forbidden.push({ what: 'barra delle azioni', box: { x: l.actions.x, y: l.actions.y, width: l.actions.w, height: l.actions.h } });
    const hits = forbidden.filter((f) => overlaps(nb!, f.box)).map((f) => `${f.what} ${JSON.stringify(f.box)}`);
    expect(hits, `la nota ${JSON.stringify(nb)} non copre il gioco (D04)`).toEqual([]);
    // Un tocco sulla nota la chiude e non passa sotto.
    await tap(page, kind, { x: nb!.x + nb!.width / 2, y: nb!.y + nb!.height / 2 });
    await expect(note, 'un tocco chiude la nota').toBeHidden();
    const s = await nightState(page);
    expect(s.draft, 'l’incrocio in bozza non cambia').toEqual([{ pair: 0, over: 'R' }]);
    expect(s.hour).toBe(8);
    game.expectClean();
  });

  test('un tocco su uno spillo d’ottone spiega di chi è, dove e quando', async ({ game }, testInfo) => {
    onlyProjects(testInfo, ...PLAY_PROJECTS);
    const { page } = game;
    const kind = pointerOf(testInfo);
    await call(page, 'core.setSettings', { animSpeed: 0 });
    await call(page, 'campaign.newGame');
    await call(page, 'campaign.goto', 'g00', 'notte');
    expect(await waitNight(page)).toBe(true);
    await page.waitForTimeout(300);
    const l = await call<{ pins: { kind: string; col: number; hour: number; x: number; y: number }[] }>(page, 'night.layout');
    // Prologo: Teresa al Forno (colonna 0) alle 9.
    const pin = l.pins.find((p) => p.hour === 9 && p.col === 0);
    expect(pin, 'lo spillo del Forno alle 9 nel layout').toBeTruthy();
    await tap(page, kind, { x: pin!.x, y: pin!.y });
    const bubble = page.locator('[data-test="tb-bolla"]');
    await expect(bubble, 'la bolla del tocco').toBeVisible();
    await expect(bubble).toContainText('Teresa al Forno alle 9');
    const s = await nightState(page);
    expect([s.hour, s.draft], 'il tocco sullo spillo non tocca il merletto').toEqual([6, []]);
    // Il tocco successivo (fuori dal merletto, sull'HUD) la chiude.
    const hud = await page.locator('[data-test="tb-hud"]').boundingBox();
    await tap(page, kind, { x: hud!.x + 12, y: hud!.y + hud!.height / 2 });
    await expect(bubble, 'il tocco successivo chiude la bolla').toBeHidden();
    game.expectClean();
  });
});

test.describe('revisione 1: la carta', () => {
  test.beforeEach(({}, testInfo) => onlyProjects(testInfo, ...PLAY_PROJECTS));

  /** Bigliettini con la calligrafia più inclinata nei dati (characters.json): Gino −7°, Bepi 8°, Zeno −9°. */
  const NOTES = [
    { day: 'g01', id: 'g01.gino', sign: -1 },
    { day: 'g10', id: 'g10.bepi', sign: 1 },
    { day: 'g14', id: 'g14.zeno', sign: -1 },
  ];

  test('calligrafia: il foglio si inclina al più di 3°, il testo resta nel foglio e i pulsanti rispondono', async ({ game }, testInfo) => {
    const { page } = game;
    await call(page, 'core.setSettings', { animSpeed: 0 });
    await call(page, 'campaign.newGame');
    const sizes = testInfo.project.name === 'desktop' ? [null, { width: 1440, height: 900 }] : [null];
    for (const size of sizes) {
      if (size) await page.setViewportSize(size);
      const vp = page.viewportSize();
      for (const n of NOTES) {
        await test.step(`${n.id} a ${vp?.width}×${vp?.height}`, async () => {
          await call(page, 'campaign.goto', n.day, 'sera');
          expect(await waitScene(page, 'sera')).toBe(true);
          await dismissActCard(page);
          await call(page, 'campaign.objectSeen');
          for (let i = 0; i < 4 && (await call<string[]>(page, 'core.overlays')).length > 0; i++) await call(page, 'core.closeOverlay');
          const card = page.locator(`[data-test="cp-bigliettino-${n.id}"]`);
          await card.click();
          const detail = page.locator('[data-test="cp-nota-dettaglio"]');
          await expect(detail).toBeVisible();
          await page.evaluate(() => document.fonts.ready.then(() => undefined));
          const m = await detail.evaluate((root) => {
            const paper = root.querySelector<HTMLElement>('.core-carta--mano');
            if (!paper) return null;
            const mt = getComputedStyle(paper).transform;
            const v = mt.startsWith('matrix(') ? mt.slice(7, -1).split(',').map(Number) : [1, 0];
            const angle = (Math.atan2(v[1] ?? 0, v[0] ?? 1) * 180) / Math.PI;
            const text = paper.querySelector<HTMLElement>('.core-carta-testo');
            const tcs = text ? getComputedStyle(text) : null;
            const pr = paper.getBoundingClientRect();
            const scrolls = paper.scrollHeight > paper.clientHeight + 1;
            const out: string[] = [];
            if (text) {
              const range = document.createRange();
              range.selectNodeContents(text);
              for (const r of Array.from(range.getClientRects())) {
                if (r.width === 0 || r.height === 0) continue;
                const xOut = r.left < pr.left - 1 || r.right > pr.right + 1;
                const yOut = !scrolls && (r.top < pr.top - 1 || r.bottom > pr.bottom + 1);
                if (xOut || yOut) out.push(`${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)} fuori da ${Math.round(pr.left)},${Math.round(pr.top)} ${Math.round(pr.width)}×${Math.round(pr.height)}`);
              }
            }
            const buttons: { t: string; inPaper: boolean; hit: boolean; what: string }[] = [];
            for (const t of ['cp-appunta', 'cp-rispondi', 'cp-lascia']) {
              const b = root.querySelector<HTMLElement>(`[data-test="${t}"]`);
              if (!b) continue;
              b.scrollIntoView({ block: 'center' });
              const r = b.getBoundingClientRect();
              const hitEl = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
              buttons.push({ t, inPaper: paper.contains(b), hit: !!hitEl && (hitEl === b || b.contains(hitEl)), what: hitEl ? `${hitEl.tagName.toLowerCase()}.${(hitEl as HTMLElement).className}` : 'nulla' });
            }
            return { angle, transform: tcs?.transform ?? null, events: tcs?.pointerEvents ?? null, out, buttons };
          });
          expect(m, `${n.id}: il bigliettino è scritto a mano (.core-carta--mano)`).not.toBeNull();
          expect(Math.abs(m!.angle), `${n.id}: inclinazione del foglio ${m!.angle.toFixed(2)}° (C17: al più ±3°)`).toBeLessThanOrEqual(3.05);
          expect(Math.sign(Math.round(m!.angle * 10)), `${n.id}: il verso dell'inclinazione segue la mano`).toBe(n.sign);
          expect([m!.transform, m!.events], `${n.id}: il testo non ha trasformazioni proprie e non prende i tocchi`).toEqual(['none', 'none']);
          expect(m!.out, `${n.id}: il testo resta nel foglio`).toEqual([]);
          expect(m!.buttons.map((b) => b.t).sort(), `${n.id}: Appunta, Rispondi e Lascia`).toEqual(['cp-appunta', 'cp-lascia', 'cp-rispondi']);
          for (const b of m!.buttons) {
            expect(b.inPaper, `${n.id}: ${b.t} fuori dal foglio (C17)`).toBe(false);
            expect(b.hit, `${n.id}: al centro di ${b.t} il tocco arriva al pulsante (trovato ${b.what})`).toBe(true);
          }
          // «Rispondi» si tocca davvero e apre le risposte.
          await page.locator('[data-test="cp-rispondi"]').click({ timeout: 3_000 });
          await expect(page.locator('[data-test="cp-nota-risposte"]'), `${n.id}: le risposte`).toBeVisible();
          for (let i = 0; i < 4 && (await call<string[]>(page, 'core.overlays')).length > 0; i++) await call(page, 'core.closeOverlay');
        });
      }
    }
    game.expectClean();
  });

  test('Esc nella sera senza pannelli aperti chiede «Tornare al titolo?»', async ({ game }, testInfo) => {
    const { page } = game;
    const kind = pointerOf(testInfo);
    await call(page, 'core.setSettings', { animSpeed: 0 });
    await call(page, 'campaign.newGame');
    await call(page, 'campaign.goto', 'g02', 'sera');
    expect(await waitScene(page, 'sera')).toBe(true);
    await call(page, 'campaign.objectSeen');
    for (let i = 0; i < 4 && (await call<string[]>(page, 'core.overlays')).length > 0; i++) await call(page, 'core.closeOverlay');
    await page.waitForTimeout(200);
    await call(page, 'core.input.action', 'back');
    const ask = page.locator('[data-test="cp-sera-esci-conferma"], [data-test="confirm"]').first();
    await expect(ask, 'Indietro nella sera chiede conferma (P116)').toBeVisible();
    await expect(ask).toContainText('titolo');
    expect(await tapTest(page, kind, 'confirm-annulla'), 'si resta nella sera').toBe(true);
    expect(await until(page, async () => (await call<string>(page, 'core.scene')) === 'sera', 2_000)).toBe(true);
    expect((await campaignState(page)).phase).toBe('sera');
    game.expectClean();
  });
});
