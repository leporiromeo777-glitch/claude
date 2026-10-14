/**
 * Suite `campagna` (ARCHITETTURA 15.2, GDD 6.6, 7 e 17): il percorso d'oro dalla g00
 * alla g23 con `campaign.*` e `night.autoplay()` (vedi helpers/campaign.ts), poi
 * ognuno dei quattro finali:
 *  - C, il merletto chiuso (falso), riporta alla sera di g23 e lascia la voce
 *    «Il punto di Clotilde»; non conta come finale;
 *  - D, il merletto aperto (vero), con i requisiti raggiunti giocando: lettere di
 *    Livia liberate, Marta e Teresa riconciliate, 8 desideri su 8, almeno 4
 *    personaggi con memoria ≥ 1 a fine g22; sblocca la Tovaglia;
 *  - A, la merlettaia, e B, il filo di seppia, dalla sera di g23.
 * Tutto il percorso gira con la rete sorvegliata: nessuna richiesta esce da localhost.
 */
import { writeFileSync } from 'node:fs';
import { CAST, playGolden, type GoldenResult } from './helpers/campaign';
import { call, expect, onlyProjects, phase, scene, test, until, waitNight, waitScene, type Rec } from './helpers/game';

interface CampaignState {
  phase: string;
  levelId: string;
  flags: Record<string, unknown>;
  memoria: Record<string, number>;
  history: Record<string, unknown>;
  endingsSeen: string[];
}
interface Knowledge {
  desires: string[];
  diary: string[];
  archive: Record<string, string>;
  questions: Record<string, string>;
}
interface Card {
  ending: string;
  available: boolean;
  missing: unknown[];
}

const ARCHIVES = ['arc1', 'arc2', 'arc3', 'arc4', 'arc5', 'arc6'];

test.describe('campagna: percorso d’oro e i quattro finali', () => {
  test.beforeEach(({}, testInfo) => onlyProjects(testInfo, 'desktop', 'iphone'));

  test('dalla g00 alla scelta di g23, poi C, D, A e B; nessuna richiesta fuori da localhost', async ({ game }, testInfo) => {
    test.setTimeout(15 * 60_000);
    const { page } = game;
    // Animazioni istantanee: la regia aspetta meno fra notte e alba, la logica è la stessa.
    await call(page, 'core.setSettings', { animSpeed: 0 });
    await call(page, 'campaign.newGame');
    expect(await waitScene(page, 'sera')).toBe(true);

    // ── Percorso d'oro ──
    let memoriaG22: Record<string, number> = {};
    const golden: GoldenResult = await playGolden(page, {
      onDay: async (d) => {
        if (d.levelId === 'g22') memoriaG22 = (await call<CampaignState>(page, 'campaign.state')).memoria;
      },
    });
    const logPath = testInfo.outputPath('percorso-d-oro.json');
    writeFileSync(logPath, JSON.stringify(golden, null, 2));
    await testInfo.attach('percorso-d-oro.json', { path: logPath, contentType: 'application/json' });
    expect(golden.reached, 'si arriva alla scelta di g23').toBe(true);
    const st = await call<CampaignState>(page, 'campaign.state');
    expect(Object.keys(st.history).sort(), '24 giornate nella storia').toHaveLength(24);
    // Ogni richiesta appuntata (con una soluzione nota al solver) riesce con la soluzione tessuta dall'autoplay.
    const failed = golden.days.flatMap((d) => d.requests.filter((r) => d.accepted.includes(r.noteId) && r.status !== 'soddisfatta').map((r) => `${d.levelId}:${r.noteId}=${r.status}`));
    expect.soft(failed, 'richieste appuntate e tessute dalla soluzione ma non riuscite').toEqual([]);
    // Gli Archivi si rammendano tutti.
    for (const a of ARCHIVES) expect.soft(golden.archives[a], `Archivio ${a} rammendato`).toBe(true);
    const k = await call<Knowledge>(page, 'campaign.knowledge');
    for (const a of ARCHIVES) expect.soft(k.archive[a], `conoscenza: ${a}`).toBe('rammendato');

    // ── Flag, conoscenza e requisiti del finale vero (GDD 6.6) ──
    expect.soft(st.flags.lettereLivia, 'lettere di Livia liberate (g16.zeno)').toBe('liberate');
    expect.soft(st.flags.riconciliate, 'Marta e Teresa riconciliate (g18.teresa)').toBe(true);
    expect.soft([...k.desires].filter((d) => (CAST as readonly string[]).includes(d)).sort(), '8 desideri su 8 nel Taccuino').toEqual([...CAST].sort());
    const remembering = CAST.filter((c) => (memoriaG22[c] ?? 0) >= 1);
    expect.soft(remembering.length, `memoria ≥ 1 a fine g22 (${JSON.stringify(memoriaG22)})`).toBeGreaterThanOrEqual(4);
    const req = await call<{ ok: boolean; missing: unknown[] }>(page, 'campaign.requirements', 'aperto');
    expect.soft(req, 'requisiti del finale vero raggiunti giocando').toEqual({ ok: true, missing: [] });
    const cards = await call<Card[]>(page, 'campaign.cards');
    expect(cards.map((c) => c.ending).sort(), 'quattro biglietti, uno spillo').toEqual(['aperto', 'chiuso', 'merlettaia', 'seppia']);

    // ── C: il merletto chiuso torna alla sera di g23 ──
    expect((await call<Rec>(page, 'campaign.choose', 'chiuso')).ok).toBe(true);
    expect(await waitNight(page)).toBe(true);
    expect((await call<Rec>(page, 'night.state')).levelId).toBe('fin_chiuso');
    await call(page, 'night.autoplay');
    expect(await waitScene(page, 'finale', 20_000)).toBe(true);
    await until(page, async () => (await page.locator('[data-test="cp-vignetta-salta"]').isVisible()) || (await scene(page)) !== 'finale', 15_000);
    if (await page.locator('[data-test="cp-vignetta-salta"]').isVisible()) await page.locator('[data-test="cp-vignetta-salta"]').click();
    expect(await waitScene(page, 'sera', 20_000), 'C riporta alla sera').toBe(true);
    const sc = await call<CampaignState>(page, 'campaign.state');
    expect([sc.phase, sc.levelId], 'C: di nuovo la scelta di g23').toEqual(['scelta', 'g23']);
    expect(sc.endingsSeen, 'C non conta come finale').toEqual([]);
    expect((await call<Knowledge>(page, 'campaign.knowledge')).diary).toContain('domande.chiuso.punto');

    // ── D, A, B: epilogo, titoli di coda col carillon, fine ──
    for (const ending of ['aperto', 'merlettaia', 'seppia'] as const) {
      if ((await phase(page)) !== 'scelta') {
        await call(page, 'campaign.goto', 'g23', 'scelta');
        expect(await waitScene(page, 'sera')).toBe(true);
      }
      if (ending === 'aperto') {
        const now = await call<{ ok: boolean; missing: unknown[] }>(page, 'campaign.requirements', 'aperto');
        if (!now.ok) {
          // Il difetto è già registrato sopra: si completano i requisiti per provare comunque il finale.
          await call(page, 'campaign.setFlag', 'lettereLivia', 'liberate');
          await call(page, 'campaign.setFlag', 'riconciliate', true);
          for (const c of CAST) await call(page, 'campaign.learn', 'desire', c);
          for (const c of CAST.slice(0, 4)) await call(page, 'campaign.setMemoria', c, 2);
        }
      }
      const r = await call<Rec>(page, 'campaign.choose', ending);
      expect(r.ok, `scelta ${ending}`).toBe(true);
      expect(await waitNight(page)).toBe(true);
      const lv = (await call<Rec>(page, 'night.state')).levelId;
      expect(lv).toBe(`fin_${ending}`);
      await call(page, 'night.autoplay');
      expect(await waitScene(page, 'finale', 20_000), `${ending}: scena finale`).toBe(true);
      await until(page, async () => ((await call<Rec | null>(page, 'campaign.finale'))?.mode ?? null) === 'epilogo', 15_000);
      const fin = await call<Rec | null>(page, 'campaign.finale');
      expect([fin?.mode, fin?.ending], `${ending}: epilogo`).toEqual(['epilogo', ending]);
      await page.locator('[data-test="cp-vignetta-salta"]').click();
      await until(page, async () => JSON.stringify(await call(page, 'campaign.finale')).includes('titoli'), 15_000);
      await expect(page.locator('[data-test="cp-titoli"]'), `${ending}: titoli di coda`).toBeVisible();
      const log = await call<{ id: string }[]>(page, 'audio.log');
      expect(log.some((x) => String(x.id).includes('carillon')), `${ending}: carillon dei titoli`).toBe(true);
      await page.locator('[data-test="cp-titoli-fine"]').click();
      await expect.poll(() => phase(page)).toBe('fine');
      const seen = (await call<CampaignState>(page, 'campaign.state')).endingsSeen;
      expect(seen, `${ending} tra gli epiloghi visti`).toContain(ending);
      if (ending === 'aperto') {
        const save = await call<{ unlocks: Record<string, unknown> }>(page, 'core.save');
        expect(save.unlocks.tovaglia, 'finale vero: Tovaglia sbloccata').toBe(true);
      }
    }
    // Sblocchi della campagna (GDD 7).
    const unlocks = (await call<{ unlocks: Record<string, unknown> }>(page, 'core.save')).unlocks;
    expect([unlocks.daily, unlocks.libero, unlocks.gradi]).toEqual([true, true, true]);
    game.expectClean();
  });
});
