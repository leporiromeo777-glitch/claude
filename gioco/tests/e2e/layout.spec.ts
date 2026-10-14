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
import { auditLayout, describeProblems, INFO_KINDS, type AuditProblem } from './helpers/audit';
import { campaignDays, playGolden } from './helpers/campaign';
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
const KEY_STEPS = new Set([
  'titolo-primo-avvio',
  'sera-bigliettini',
  'tombolo-notte',
  // Atto II: sera, bigliettino anonimo e alba, dove i testi inglesi sono più lunghi (traduzione-en).
  'sera-atto2',
  'sera-anonimo',
  'alba-atto2',
  'bilancio',
  'taccuino',
  'taccuino-lettere',
  'scelta',
  'impostazioni',
  'giornaliero-risultato',
]);

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
      const info: string[] = [];
      for (const step of TOUR) {
        await test.step(step.id, async () => {
          await step.run(page);
          await shot(page, testInfo, `layout/${testInfo.project.name}/${v.id}/${step.id}`, { reference: v.id === 'base' || KEY_STEPS.has(step.id) });
          const safe = v.safe ? { safeTop: v.safe.top, safeBottom: v.safe.bottom } : {};
          const found = await auditLayout(page, safe);
          problems[step.id] = found.filter((p) => !INFO_KINDS.has(p.kind));
          for (const p of found) if (INFO_KINDS.has(p.kind)) info.push(`${step.id}: ${p.kind} ${p.what} ${p.detail}`);
          // GDD 10.1 e 17 chiedono 48 px: sotto i 48 (ma sopra i 44 della soglia dei test) si annota.
          for (const p of await auditLayout(page, { ...safe, minTarget: 48 })) if (p.kind === 'piccolo') info.push(`${step.id}: sotto 48 px ${p.what} ${p.detail}`);
        });
      }
      for (const [id, list] of Object.entries(problems)) {
        expect.soft(list, `${testInfo.project.name} · ${v.id} · ${id}:\n${describeProblems(list)}`).toEqual([]);
      }
      await testInfo.attach('note-informative.txt', { body: [...new Set(info)].join('\n') || 'nessuna', contentType: 'text/plain' });
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
      // Un foglio con la calligrafia inclinata che esce dalla carta (come una lettera lunga).
      const sheet = document.createElement('div');
      sheet.style.cssText = 'position:absolute;top:160px;left:300px;width:160px;padding:8px;background:#efe4c8';
      const hand = document.createElement('p');
      hand.style.cssText = 'transform:rotate(4deg);transform-origin:left top;font-size:20px;margin:0';
      hand.textContent = 'Cara mia, oggi sul molo c’era un vento che ti avrebbe fatto ridere, e poi ancora vento e vento.';
      sheet.append(hand);
      // Un pulsante coperto da un testo posato sopra.
      const btn = document.createElement('button');
      btn.textContent = 'Appunta';
      btn.style.cssText = 'position:absolute;top:400px;left:300px;width:120px;height:56px';
      const over = document.createElement('div');
      over.textContent = 'testo che copre';
      over.style.cssText = 'position:absolute;top:390px;left:290px;width:160px;height:80px;pointer-events:auto';
      // Una parola spezzata a metà riga.
      const narrow = document.createElement('p');
      narrow.style.cssText = 'position:absolute;top:500px;left:300px;width:60px;word-break:break-all;font-size:17px';
      narrow.textContent = 'Istantanea';
      // Un testo che finisce sotto un pulsante rotondo.
      const under = document.createElement('p');
      under.style.cssText = 'position:absolute;top:580px;left:500px;width:200px;font-size:17px';
      under.textContent = 'Risposto';
      const round = document.createElement('button');
      round.textContent = '≡';
      round.style.cssText = 'position:absolute;top:570px;left:490px;width:56px;height:56px;border-radius:50%';
      box.append(t, b, k, low, sheet, btn, over, narrow, under, round);
      document.getElementById('ui-root')?.appendChild(box);
    });
    const found = await auditLayout(page, { safeTop: 47, safeBottom: 34 });
    const kinds = new Set(found.map((p) => p.kind));
    expect([...kinds].sort(), describeProblems(found, 30)).toEqual(
      expect.arrayContaining(['chiave', 'overflow', 'piccolo', 'safe-area', 'fuori-foglio', 'coperto', 'testo-coperto', 'parola-spezzata']),
    );
  });
});

// ───────── Tutta la carta della storia ─────────

/**
 * Il giro delle schermate mostra un bigliettino e un oggetto; la calligrafia però cambia
 * da personaggio a personaggio (font, inclinazione, scala) e i testi da giornata a
 * giornata. Qui si aprono, sera per sera, l'oggetto o la lettera della laguna, ogni
 * bigliettino e le sue risposte, e si controlla ogni foglio con lo stesso controllo del
 * DOM: il testo inclinato che esce dalla carta o copre i pulsanti si vede solo così.
 */
const PAPER_VARIANTS: { id: string; settings: Record<string, unknown>; projects: string[] }[] = [
  { id: 'base', settings: {}, projects: ['desktop', 'iphone', 'android-piccolo', 'ipad-orizzontale'] },
  { id: 'testo-140', settings: { textScale: 1.4 }, projects: ['desktop', 'android-piccolo'] },
  { id: 'inglese', settings: { locale: 'en' }, projects: ['desktop', 'android-piccolo'] },
];

test.describe('layout: tutta la carta della storia', () => {
  for (const v of PAPER_VARIANTS) {
    test(`oggetti, lettere, bigliettini e risposte di ogni sera (${v.id})`, async ({ game }, testInfo) => {
      onlyProjects(testInfo, ...v.projects);
      test.setTimeout(8 * 60_000);
      const { page } = game;
      await call(page, 'core.setSettings', { animSpeed: 0, ...v.settings });
      await call(page, 'campaign.newGame');
      const problems: string[] = [];
      let sheets = 0;
      const check = async (label: string): Promise<void> => {
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        await page.waitForTimeout(120);
        sheets++;
        const found = (await auditLayout(page)).filter((p) => !INFO_KINDS.has(p.kind));
        if (found.length === 0) return;
        problems.push(...found.map((p) => `${label}: ${p.kind} ${p.what} ${p.detail}`));
        await testInfo.attach(`${label}.jpg`, { body: await page.screenshot({ type: 'jpeg', quality: 70 }), contentType: 'image/jpeg' });
      };
      const closeAll = async (): Promise<void> => {
        for (let i = 0; i < 4 && (await call<string[]>(page, 'core.overlays')).length > 0; i++) await call(page, 'core.closeOverlay');
      };
      for (const day of campaignDays().map((d) => d.id).filter((id) => id !== 'g00')) {
        await test.step(day, async () => {
          await call(page, 'campaign.goto', day, 'sera');
          expect(await waitScene(page, 'sera'), `sera di ${day}`).toBe(true);
          // L'oggetto (o la lettera) della laguna, se c'è.
          const door = page.locator('[data-test="cp-oggetto"]');
          if (await door.isVisible().catch(() => false)) {
            await door.click();
            await page.locator('[data-test="cp-oggetto-dettaglio"]').waitFor({ state: 'visible', timeout: 5_000 });
            await check(`${day}-oggetto`);
            await page.locator('[data-test="cp-oggetto-continua"]').click();
          } else {
            await call(page, 'campaign.objectSeen');
          }
          await closeAll();
          const ev = await call<{ noteIds: string[] } | null>(page, 'campaign.evening');
          await page.locator('[data-test^="cp-bigliettino-"]').first().waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined);
          await check(`${day}-sera`);
          for (const id of ev?.noteIds ?? []) {
            const card = page.locator(`[data-test="cp-bigliettino-${id}"]`);
            if (!(await card.isVisible().catch(() => false))) continue;
            // Un bigliettino che non si apre con un clic al centro è coperto da qualcosa.
            const opened = await card.click({ timeout: 3_000 }).then(() => true, () => false);
            if (!opened) {
              problems.push(`${day}-${id}: il bigliettino non si apre con un clic (coperto da un altro elemento)`);
              await testInfo.attach(`${day}-${id}-coperto.jpg`, { body: await page.screenshot({ type: 'jpeg', quality: 70 }), contentType: 'image/jpeg' });
              await card.click({ force: true });
            }
            await page.locator('[data-test="cp-nota-dettaglio"]').waitFor({ state: 'visible', timeout: 5_000 });
            await check(`${day}-${id}`);
            const reply = page.locator('[data-test="cp-rispondi"]');
            if (await reply.isVisible().catch(() => false)) {
              if (!(await reply.click({ timeout: 3_000 }).then(() => true, () => false))) {
                problems.push(`${day}-${id}: «Rispondi» non si tocca (coperto da un altro elemento)`);
                await reply.click({ force: true });
              }
              await page.locator('[data-test="cp-nota-risposte"]').waitFor({ state: 'visible', timeout: 3_000 }).catch(() => undefined);
              await check(`${day}-${id}-risposte`);
            }
            await closeAll();
          }
        });
      }
      await testInfo.attach('fogli-controllati.txt', { body: `${sheets} fogli\n${problems.join('\n')}`, contentType: 'text/plain' });
      expect(sheets, 'fogli controllati').toBeGreaterThan(60);
      expect(problems, `${testInfo.project.name} · ${v.id}: fogli con problemi`).toEqual([]);
      game.expectClean();
    });
  }
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
