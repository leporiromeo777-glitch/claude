/**
 * Suite `layout` (ARCHITETTURA 8 e 15.2, GDD 10, 14 e 17).
 *
 * 1. Giro di tutte le schermate (helpers/tour.ts) su ognuno dei 5 progetti, in cinque
 *    varianti: base, testo al 140%, alto contrasto, inglese, safe area simulata 47/34 px.
 *    In ogni tappa: screenshot di riferimento (tests/e2e/__screenshots__/layout/…) e
 *    controllo del DOM (helpers/audit.ts): nessun testo fuori dal contenitore, bersagli
 *    ≥ 44 px, nessuna chiave non tradotta, niente nella fascia riservata al sistema.
 * 2. Simulazione del daltonismo (deuteranopia, protanopia, tritanopia, matrici di
 *    Machado 2009): i fili del merletto restano distinguibili anche senza colore
 *    (motivo e icona, GDD 14).
 * 3. Schermate alle misure degli store (iPhone 6,9", iPad 13", Android 1080×1920) in
 *    tests/e2e/__screenshots__/store/.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, Page, TestInfo } from '@playwright/test';
import { describeProblems, auditLayout, type AuditProblem } from './helpers/audit';
import { playGolden } from './helpers/campaign';
import { call, captureErrors, expect, guardNetwork, nightState, onlyProjects, openGame, test, until, waitNight, waitScene } from './helpers/game';
import { nightLayout } from './helpers/pointer';
import { keepImage, shot } from './helpers/shots';
import { TOUR, TOUR_DAY } from './helpers/tour';

interface Variant {
  id: string;
  settings: Record<string, unknown>;
  safe?: { top: number; bottom: number };
}

/**
 * Nel repository restano tutte le tappe della variante base e, per le altre varianti,
 * le schermate più dense di testo e di comandi (le altre si allegano solo al rapporto,
 * per non riempire il repository di immagini).
 */
const KEY_STEPS = new Set(['titolo-primo-avvio', 'sera-bigliettini', 'tombolo-notte', 'alba-atto2', 'bilancio', 'taccuino', 'scelta', 'impostazioni', 'giornaliero-risultato']);

const VARIANTS: Variant[] = [
  { id: 'base', settings: {} },
  { id: 'testo-140', settings: { textScale: 1.4 } },
  { id: 'alto-contrasto', settings: { highContrast: true } },
  { id: 'inglese', settings: { locale: 'en' } },
  { id: 'safe-area', settings: {}, safe: { top: 47, bottom: 34 } },
];

test.describe('layout: tutte le schermate', () => {
  for (const v of VARIANTS) {
    test(`giro delle schermate (${v.id})`, async ({ game }, testInfo) => {
      test.setTimeout(6 * 60_000);
      const { page } = game;
      // Animazioni istantanee: le schermate si fotografano già ferme.
      await call(page, 'core.setSettings', { animSpeed: 0, ...v.settings });
      if (v.safe) {
        await page.evaluate((s) => {
          document.documentElement.style.setProperty('--safe-area-inset-top', `${s.top}px`);
          document.documentElement.style.setProperty('--safe-area-inset-bottom', `${s.bottom}px`);
        }, v.safe);
        await expect
          .poll(async () => {
            const sa = (await call<{ safe: { top: number; bottom: number } }>(page, 'core.viewport')).safe;
            return { top: sa.top, bottom: sa.bottom };
          })
          .toEqual(v.safe);
      }
      const problems: Record<string, AuditProblem[]> = {};
      for (const step of TOUR) {
        await test.step(step.id, async () => {
          await step.run(page);
          await shot(page, testInfo, `layout/${testInfo.project.name}/${v.id}/${step.id}`, { reference: v.id === 'base' || KEY_STEPS.has(step.id) });
          problems[step.id] = await auditLayout(page, v.safe ? { safeTop: v.safe.top, safeBottom: v.safe.bottom } : {});
        });
      }
      for (const [id, list] of Object.entries(problems)) {
        expect.soft(list, `${testInfo.project.name} · ${v.id} · ${id}:\n${describeProblems(list)}`).toEqual([]);
      }
      // Nessuna chiave chiesta e mancante nella lingua del giro.
      const locale = (v.settings.locale as string | undefined) ?? 'it';
      const missing = await call<string[]>(page, 'core.missingKeys', locale);
      expect.soft(missing, `chiavi mancanti (${locale})`).toEqual([]);
      game.expectClean();
    });
  }

  test('il controllo vede davvero un testo che esce e un bersaglio piccolo', async ({ game }, testInfo) => {
    onlyProjects(testInfo, 'desktop');
    const { page } = game;
    await page.evaluate(() => {
      const box = document.createElement('div');
      box.dataset.test = 'qa-sonda';
      box.style.cssText = 'position:absolute;top:100px;left:10px';
      const t = document.createElement('p');
      t.style.cssText = 'width:40px;overflow:hidden;white-space:nowrap';
      t.textContent = 'parolalunghissimasenzaspazi';
      const b = document.createElement('button');
      b.style.cssText = 'width:20px;height:20px';
      const k = document.createElement('span');
      k.style.display = 'block';
      k.textContent = 'ui.titolo.inesistente';
      const low = document.createElement('button');
      low.textContent = 'basso';
      low.style.cssText = 'position:fixed;bottom:2px;left:100px;width:60px;height:48px';
      box.append(t, b, k, low);
      document.getElementById('ui-root')?.appendChild(box);
    });
    const found = await auditLayout(page, { safeTop: 47, safeBottom: 34 });
    const kinds = new Set(found.filter((p) => p.what.includes('qa-sonda') || p.what.startsWith('p') || p.what.startsWith('button') || p.what.startsWith('span')).map((p) => p.kind));
    expect([...kinds].sort()).toEqual(expect.arrayContaining(['chiave', 'overflow', 'piccolo', 'safe-area']));
  });
});

// ───────── Daltonismo ─────────

/** Matrici di Machado, Oliveira e Fernandes (2009), severità piena, in RGB lineare. */
const CVD: Record<string, number[]> = {
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};

/** sRGB (0-255) → colore visto con la matrice `m` (o lo stesso colore senza). */
function simulateColor(rgb: [number, number, number], m: number[] | null): [number, number, number] {
  const lin = (v: number): number => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = rgb.map(lin) as [number, number, number];
  if (!m) return [r, g, b];
  const c = (x: number): number => Math.max(0, Math.min(1, x));
  return [c(m[0]! * r + m[1]! * g + m[2]! * b), c(m[3]! * r + m[4]! * g + m[5]! * b), c(m[6]! * r + m[7]! * g + m[8]! * b)];
}

/** RGB lineare → CIELAB (D65). */
function toLab([r, g, b]: [number, number, number]): [number, number, number] {
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Differenza di colore (ΔE 1976) fra due colori visti con la stessa simulazione. */
function deltaE(a: string, b: string, m: number[] | null): number {
  const la = toLab(simulateColor(hex(a), m));
  const lb = toLab(simulateColor(hex(b), m));
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

/** Sotto questa differenza due colori si confondono sui fili sottili del merletto. */
const CONFUSABLE_DE = 20;

const CONTENT = fileURLToPath(new URL('../../src/content/', import.meta.url));

test.describe('layout: daltonismo', () => {
  test('in ogni livello due fili che si confondono di colore hanno motivo e icona diversi', async ({}, testInfo) => {
    onlyProjects(testInfo, 'desktop');
    const chars = new Map((JSON.parse(readFileSync(join(CONTENT, 'characters.json'), 'utf8')) as { id: string; color: string; pattern: string; icon: string }[]).map((c) => [c.id, c]));
    const problems: string[] = [];
    const twins: string[] = [];
    const report: string[] = [];
    for (const f of readdirSync(join(CONTENT, 'levels')).filter((x) => x.endsWith('.json') && !x.endsWith('.computed.json')).sort()) {
      const lv = JSON.parse(readFileSync(join(CONTENT, 'levels', f), 'utf8')) as { id: string; threads: { id: string; character?: string }[] };
      const cs = [...new Set(lv.threads.map((t) => t.character).filter((c): c is string => !!c && chars.has(c)))];
      for (let i = 0; i < cs.length; i++) {
        for (let j = i + 1; j < cs.length; j++) {
          const a = chars.get(cs[i]!)!;
          const b = chars.get(cs[j]!)!;
          const same = [a.pattern === b.pattern ? `motivo «${a.pattern}»` : '', a.icon === b.icon ? `icona «${a.icon}»` : ''].filter(Boolean);
          if (same.length === 2) twins.push(`${lv.id}: ${a.id} e ${b.id} hanno lo stesso motivo «${a.pattern}» e la stessa icona «${a.icon}» (resta solo il colore)`);
          for (const [sim, m] of [...Object.entries(CVD), ['monocromia', null] as const]) {
            const d = m === null ? Math.abs(toLab(simulateColor(hex(a.color), null))[0] - toLab(simulateColor(hex(b.color), null))[0]) : deltaE(a.color, b.color, m);
            if (d >= CONFUSABLE_DE) continue;
            report.push(`${lv.id} ${a.id}/${b.id} ${sim} ΔE ${d.toFixed(1)}${same.length ? ` stesso ${same.join(' e ')}` : ''}`);
            // GDD 14 nomina deuteranopia, protanopia e tritanopia; la monocromia è solo nel rapporto.
            if (same.length && m !== null) problems.push(`${lv.id}: ${a.id} e ${b.id} si confondono con ${sim} (ΔE ${d.toFixed(1)}) e hanno lo stesso ${same.join(' e la stessa ')}`);
          }
        }
      }
    }
    expect.soft(twins, 'GDD 14: nello stesso merletto due fili non hanno mai lo stesso motivo e la stessa icona').toEqual([]);
    await testInfo.attach('coppie-confondibili.txt', { body: report.join('\n'), contentType: 'text/plain' });
    expect(problems, 'GDD 14: ogni filo si distingue per colore, motivo e icona').toEqual([]);
  });

  test('screenshot del merletto con deuteranopia, protanopia, tritanopia e in bianco e nero', async ({ game }, testInfo: TestInfo) => {
    onlyProjects(testInfo, 'desktop', 'iphone');
    const { page } = game;
    await call(page, 'core.setSettings', { animSpeed: 0 });
    const lab = await page.context().newPage();
    try {
      for (const target of [{ id: 'motivi', fixture: 'test-motivi' }, { id: 'g14', level: 'g14' }] as const) {
        // Tutto il merletto tranne l'ultima riga: la notte resta aperta, i motivi si vedono.
        const levelId = 'fixture' in target ? target.fixture : target.level;
        if ('fixture' in target) await call(page, 'engine.fixture', target.fixture);
        const sol = await call<{ rows: unknown[] }>(page, 'engine.solve', levelId);
        await call(page, 'night.start', 'fixture' in target ? { fixture: target.fixture } : { level: target.level, origin: 'campagna' });
        expect(await waitNight(page)).toBe(true);
        await call(page, 'night.autoplay', sol.rows.slice(0, -1));
        await page.waitForTimeout(3200);
        expect((await nightState(page)).active, 'la notte resta aperta').toBe(true);
        const png = await page.screenshot({ type: 'png', scale: 'css', animations: 'disabled' });
        await keepImage(testInfo, `layout/${testInfo.project.name}/daltonismo/${target.id}-normale.jpg`, await page.screenshot({ type: 'jpeg', quality: 80, scale: 'css', animations: 'disabled' }), 'image/jpeg');
        for (const [id, m] of [...Object.entries(CVD), ['monocromia', null] as const]) {
          const b64 = await lab.evaluate(
            async ({ src, mat }) => {
              const img = new Image();
              img.src = `data:image/png;base64,${src}`;
              await img.decode();
              const c = document.createElement('canvas');
              c.width = img.naturalWidth;
              c.height = img.naturalHeight;
              const g = c.getContext('2d', { willReadFrequently: true })!;
              g.drawImage(img, 0, 0);
              const d = g.getImageData(0, 0, c.width, c.height);
              const px = d.data;
              const lin = (v: number): number => {
                const s = v / 255;
                return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
              };
              const enc = (v: number): number => {
                const x = Math.max(0, Math.min(1, v));
                return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055));
              };
              for (let i = 0; i < px.length; i += 4) {
                const r = lin(px[i]!);
                const gg = lin(px[i + 1]!);
                const b = lin(px[i + 2]!);
                if (mat) {
                  px[i] = enc(mat[0]! * r + mat[1]! * gg + mat[2]! * b);
                  px[i + 1] = enc(mat[3]! * r + mat[4]! * gg + mat[5]! * b);
                  px[i + 2] = enc(mat[6]! * r + mat[7]! * gg + mat[8]! * b);
                } else {
                  const y = enc(0.2126 * r + 0.7152 * gg + 0.0722 * b);
                  px[i] = y;
                  px[i + 1] = y;
                  px[i + 2] = y;
                }
              }
              g.putImageData(d, 0, 0);
              return c.toDataURL('image/jpeg', 0.8).split(',')[1] ?? '';
            },
            { src: png.toString('base64'), mat: m },
          );
          await keepImage(testInfo, `layout/${testInfo.project.name}/daltonismo/${target.id}-${id}.jpg`, Buffer.from(b64, 'base64'), 'image/jpeg');
        }
      }
    } finally {
      await lab.close();
    }
    game.expectClean();
  });
});

// ───────── Schermate per gli store ─────────

interface StoreDevice {
  id: string;
  viewport: { width: number; height: number };
  dpr: number;
  mobile: boolean;
}

/** Misure delle schede: App Store iPhone 6,9" e iPad 13", Google Play telefono. */
const STORE_DEVICES: StoreDevice[] = [
  { id: 'iphone-6.9-1290x2796', viewport: { width: 430, height: 932 }, dpr: 3, mobile: true },
  { id: 'ipad-13-2064x2752', viewport: { width: 1032, height: 1376 }, dpr: 2, mobile: true },
  { id: 'android-1080x1920', viewport: { width: 360, height: 640 }, dpr: 3, mobile: true },
];

async function storePage(browser: Browser, baseURL: string | undefined, d: StoreDevice): Promise<{ page: Page; errors: string[]; external: string[] }> {
  const ctx = await browser.newContext({ baseURL, viewport: d.viewport, deviceScaleFactor: d.dpr, isMobile: d.mobile, hasTouch: d.mobile, locale: 'it-IT', colorScheme: 'dark' });
  const net = await guardNetwork(ctx);
  const page = await ctx.newPage();
  const errors = captureErrors(page);
  await openGame(page, { fresh: true });
  return { page, errors, external: net.external };
}

test.describe('layout: schermate per gli store', () => {
  for (const d of STORE_DEVICES) {
    test(`store ${d.id}`, async ({ browser, baseURL }, testInfo) => {
      onlyProjects(testInfo, 'desktop');
      test.setTimeout(5 * 60_000);
      const { page, errors, external } = await storePage(browser, baseURL, d);
      const snap = async (name: string): Promise<void> => test.step(`schermata ${name}`, async () => {
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        // Niente avvisi di passaggio nelle schermate delle schede.
        await expect(page.locator('[data-test="toast"]')).toHaveCount(0, { timeout: 10_000 });
        await page.waitForTimeout(700);
        const body = await page.screenshot({ type: 'jpeg', quality: 90, scale: 'device', animations: 'disabled', caret: 'hide' });
        await keepImage(testInfo, `store/${d.id}/${name}.jpg`, body, 'image/jpeg');
      });
      try {
        // 1. Il titolo al primo avvio.
        await waitScene(page, 'titolo');
        await page.waitForTimeout(1500);
        await snap('1-titolo');
        // 3. Una partita vera fino a g06: l'alba con una vignetta e i personaggi.
        await call(page, 'core.setSettings', { animSpeed: 0 });
        await call(page, 'campaign.newGame');
        await waitScene(page, 'sera');
        await test.step('partita fino a g06', () => playGolden(page, { untilLevel: 'g06' }));
        await call(page, 'campaign.objectSeen');
        await call(page, 'campaign.accept', ['g06.nina', 'g06.marta']);
        await call(page, 'campaign.toNight');
        expect(await waitNight(page)).toBe(true);
        await call(page, 'night.autoplay');
        expect(await waitScene(page, 'alba', 20_000)).toBe(true);
        await call(page, 'core.setSettings', { animSpeed: 1 });
        // La prima vignetta di quest'alba con i personaggi (le figure sono disegnate sul canvas).
        const g06 = JSON.parse(readFileSync(join(CONTENT, 'levels', 'g06.json'), 'utf8')) as { dawn?: { candidates: { id: string; figures: unknown[] }[] } };
        const withFigures = new Set((g06.dawn?.candidates ?? []).filter((c) => c.figures.length > 0).map((c) => c.id));
        const dawnInfo = await call<{ report: string[] }>(page, 'campaign.dawn');
        const target = Math.max(0, dawnInfo.report.findIndex((id) => withFigures.has(id)));
        const next = page.locator('[data-test="cp-vignetta-avanti"]');
        await next.waitFor({ state: 'visible' });
        for (let i = 0; i < 12; i++) {
          const pos = (await call<{ position: { vignette: number } | null }>(page, 'campaign.dawn')).position;
          if (!pos || pos.vignette >= target) break;
          await next.click({ timeout: 3_000 });
          await page.waitForTimeout(500);
        }
        await page.waitForTimeout(1200);
        await snap('3-alba-vignetta');
        // 4. Il Taccuino dopo otto giornate.
        await call(page, 'core.setSettings', { animSpeed: 0 });
        await test.step('partita fino a g09', () => playGolden(page, { untilLevel: 'g09' }));
        await waitScene(page, 'sera');
        await call(page, 'core.openOverlay', 'taccuino', { from: 'sera' });
        await page.locator('[data-test="cp-taccuino"]').first().waitFor({ state: 'visible' });
        await snap('4-taccuino');
        await call(page, 'core.closeOverlay');
        // 2. Il tombolo a metà notte, con le lettere del fascio in viaggio (g16).
        await call(page, 'campaign.goto', 'g16', 'sera');
        await waitScene(page, 'sera');
        await call(page, 'campaign.objectSeen');
        const notes = ['g16.zeno', 'g16.teresa'];
        await call(page, 'campaign.accept', notes);
        await call(page, 'campaign.toNight');
        expect(await waitNight(page)).toBe(true);
        const sol = await call<{ nomeOn?: string; rows: { crossings: { pair: number; over: 'L' | 'R'; forced?: boolean }[] }[] }>(page, 'engine.solve', 'g16', notes, { flags: (await call<{ flags: Record<string, unknown> }>(page, 'campaign.state')).flags });
        // g16 ha la regola del nome: prima si appunta il nome di Ada (dove dice la soluzione, o sul primo filo).
        await call(page, 'night.setNome', sol.nomeOn ?? (await nightState(page)).positions[0]);
        for (const r of sol.rows.slice(0, Math.ceil(sol.rows.length * 0.6))) {
          for (const c of r.crossings) if (!c.forced) await call(page, 'night.cross', c.pair, c.over);
          expect((await call<{ ok: boolean }>(page, 'night.fix')).ok, 'riga della soluzione accettata').toBe(true);
        }
        await call(page, 'core.setSettings', { animSpeed: 1 });
        await snap('2-tombolo-notte');
        // La notte si finisce (niente notte a metà che chieda conferma al Merletto del giorno).
        await call(page, 'core.setSettings', { animSpeed: 0 });
        await call(page, 'night.autoplay');
        await until(page, async () => (await call<string | null>(page, 'campaign.phase')) !== 'notte');
        await call(page, 'core.goto', 'titolo');
        // 5. Il Merletto del giorno: il foglio dei risultati con il merletto.
        await call(page, 'ui.setToday', TOUR_DAY);
        await call(page, 'ui.startDaily');
        expect(await waitNight(page)).toBe(true);
        await call(page, 'night.autoplay');
        expect(await waitScene(page, 'giornaliero', 15_000)).toBe(true);
        await page.locator('[data-test="sc-risultato-immagine"] img').waitFor({ state: 'visible' });
        await until(page, async () => page.locator('[data-test="sc-risultato-immagine"] img').evaluate((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0));
        await snap('5-merletto-del-giorno');
        expect((await nightState(page)).active).toBe(false);
        expect(errors, 'errori in console').toEqual([]);
        expect(external, 'richieste fuori da localhost').toEqual([]);
      } finally {
        await page.context().close();
      }
    });
  }
});
