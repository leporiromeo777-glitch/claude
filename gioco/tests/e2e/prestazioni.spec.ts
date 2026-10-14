/**
 * Suite `prestazioni` (ARCHITETTURA 15.2 e 16, GDD 17), sul progetto `desktop`:
 *  - trascinamento continuo nel tombolo a 6 colonne (fixture test-grande, 6×14): il
 *    p95 del tempo di JavaScript per fotogramma misurato in pagina (`core.perf()`,
 *    update + render) resta sotto gli 8 ms. Il trascinamento dura più di 3 s, così gli
 *    ultimi 240 campioni di `perf()` sono tutti fotogrammi di trascinamento;
 *  - heap JS sotto i 150 MB dopo 10 giornate della campagna in autoplay (dopo una
 *    raccolta dei rifiuti, letto dal protocollo DevTools);
 *  - budget della build (ARCHITETTURA 16): JavaScript ≤ 450 KB gzip, worker del solver
 *    ≤ 60 KB gzip, CSS ≤ 40 KB, font ≤ 400 KB, asset ≤ 6 MB, atlas `core` ≤ 3 MB. La
 *    cartella della build si indica con E2E_DIST (predefinita: dist/).
 * Le misure nel container non dicono nulla dei telefoni veri (ARCHITETTURA 15.2).
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { playGolden } from './helpers/campaign';
import { call, expect, onlyProjects, test, waitNight, waitScene } from './helpers/game';
import { nightLayout } from './helpers/pointer';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DIST = process.env.E2E_DIST ?? join(ROOT, 'dist');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

test.describe('prestazioni', () => {
  test.beforeEach(({}, testInfo) => onlyProjects(testInfo, 'desktop'));

  test('trascinamento continuo su 6 colonne: p95 < 8 ms per fotogramma', async ({ game }, testInfo) => {
    const { page } = game;
    await call(page, 'night.start', { fixture: 'test-grande' });
    expect(await waitNight(page)).toBe(true);
    const l = await nightLayout(page);
    expect(l.columns.length, 'tombolo a 6 colonne').toBe(6);
    await page.waitForTimeout(500);
    const a = l.spindles[2]!;
    const b = l.spindles[3]!;
    await page.mouse.move(a.cx, a.cy);
    await page.mouse.down();
    const t0 = Date.now();
    const f0 = (await call<{ frames: number }>(page, 'core.perf')).frames;
    let i = 0;
    // Avanti e indietro oltre la colonna vicina: incroci che si fanno e si disfano.
    while (Date.now() - t0 < 4_500) {
      const k = (Math.sin(i / 9) + 1) / 2;
      await page.mouse.move(a.cx + (b.cx - a.cx) * k * 1.4 - (b.cx - a.cx) * 0.2, a.cy + Math.sin(i / 5) * 6);
      await page.waitForTimeout(8);
      i++;
    }
    const perf = await call<{ fps: number; p50: number; p95: number; max: number; frames: number }>(page, 'core.perf');
    await page.mouse.up();
    const perfOut = testInfo.outputPath('perf.json');
    writeFileSync(perfOut, JSON.stringify({ ...perf, moves: i, framesDuringDrag: perf.frames - f0 }, null, 2));
    await testInfo.attach('perf.json', { path: perfOut, contentType: 'application/json' });
    expect(perf.frames - f0, 'fotogrammi disegnati durante il trascinamento').toBeGreaterThan(150);
    expect(perf.p95, `p95 del tempo per fotogramma (${JSON.stringify(perf)})`).toBeLessThan(8);
    game.expectClean();
  });

  test('heap JS < 150 MB dopo 10 giornate in autoplay', async ({ game }, testInfo) => {
    test.setTimeout(5 * 60_000);
    const { page } = game;
    await call(page, 'core.setSettings', { animSpeed: 0 });
    await call(page, 'campaign.newGame');
    expect(await waitScene(page, 'sera')).toBe(true);
    const res = await playGolden(page, { maxDays: 10 });
    expect(res.days.length, '10 giornate giocate').toBeGreaterThanOrEqual(10);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('HeapProfiler.enable');
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = (await cdp.send('Runtime.getHeapUsage')) as { usedSize: number; totalSize: number };
    await cdp.detach();
    const mb = heap.usedSize / (1024 * 1024);
    const heapOut = testInfo.outputPath('heap.json');
    writeFileSync(heapOut, JSON.stringify({ usedMB: Math.round(mb * 10) / 10, totalMB: Math.round((heap.totalSize / 1048576) * 10) / 10, days: res.days.map((d) => d.levelId) }, null, 2));
    await testInfo.attach('heap.json', { path: heapOut, contentType: 'application/json' });
    expect(mb, 'heap JS usato dopo 10 giornate (MB)').toBeLessThan(150);
    game.expectClean();
  });

  test('budget della build: JavaScript, worker, CSS, font, asset', async ({}, testInfo) => {
    test.skip(!existsSync(join(DIST, 'index.html')), `nessuna build in ${DIST} (E2E_DIST)`);
    const files = walk(DIST);
    const rel = (p: string): string => relative(DIST, p);
    const gz = (p: string): number => gzipSync(readFileSync(p), { level: 9 }).length;
    const js = files.filter((f) => f.endsWith('.js'));
    const worker = js.filter((f) => /worker/i.test(rel(f)));
    const css = files.filter((f) => f.endsWith('.css'));
    const fonts = files.filter((f) => /\.woff2$/.test(f));
    const assets = files.filter((f) => rel(f).startsWith('assets/') && /\.(png|webp|jpg|jpeg|avif|json)$/.test(f) && !/\.(js|css)$/.test(f));
    const atlas = assets.filter((f) => rel(f).startsWith('assets/atlas/'));
    const sum = (list: string[], size: (p: string) => number): number => list.reduce((n, f) => n + size(f), 0);
    const kb = (n: number): number => Math.round(n / 102.4) / 10;
    const report = {
      jsGzipKB: kb(sum(js, gz)),
      workerGzipKB: kb(sum(worker, gz)),
      cssKB: kb(sum(css, (f) => statSync(f).size)),
      cssGzipKB: kb(sum(css, gz)),
      fontsWoff2KB: kb(sum(fonts, (f) => statSync(f).size)),
      assetsMB: Math.round((sum(assets, (f) => statSync(f).size) / 1048576) * 100) / 100,
      atlasMB: Math.round((sum(atlas, (f) => statSync(f).size) / 1048576) * 100) / 100,
      files: { js: js.length, css: css.length, fonts: fonts.length, assets: assets.length },
    };
    const out = testInfo.outputPath('budget.json');
    writeFileSync(out, JSON.stringify(report, null, 2));
    await testInfo.attach('budget.json', { path: out, contentType: 'application/json' });
    expect.soft(report.jsGzipKB, 'JavaScript ≤ 450 KB gzip').toBeLessThanOrEqual(450);
    expect.soft(report.workerGzipKB, 'worker del solver ≤ 60 KB gzip').toBeLessThanOrEqual(60);
    // ARCHITETTURA 16 dà il JavaScript «gzip» e il CSS senza dirlo: si misura come il
    // JavaScript, cioè quello che viaggia in rete (il peso senza compressione è nel rapporto).
    expect.soft(report.cssGzipKB, `CSS ≤ 40 KB (gzip; senza compressione ${report.cssKB} KB)`).toBeLessThanOrEqual(40);
    expect.soft(report.fontsWoff2KB, 'font ≤ 400 KB').toBeLessThanOrEqual(400);
    expect.soft(report.assetsMB, 'asset ≤ 6 MB').toBeLessThanOrEqual(6);
    expect.soft(report.atlasMB, 'atlas core ≤ 3 MB').toBeLessThanOrEqual(3);
  });
});
