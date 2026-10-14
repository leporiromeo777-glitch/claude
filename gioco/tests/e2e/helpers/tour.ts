/**
 * Giro di tutte le schermate (GDD 10.3) per le suite `layout` e `i18n`: ogni tappa
 * porta il gioco in uno stato preciso con l'API di debug e aspetta che la scena sia
 * ferma. L'ordine conta (la campagna avanza), il giro parte da un salvataggio vuoto.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { RULE_IDS } from '../../../src/core/ids';
import { CAST, contentNotes } from './campaign';
import { call, phase, until, waitNight, waitScene } from './game';

export interface TourStep {
  id: string;
  run(page: Page): Promise<void>;
}

/** Data fissa del Merletto del giorno nei test. */
export const TOUR_DAY = '2026-10-14';

async function settle(page: Page, ms = 350): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(ms);
}

async function visible(page: Page, selector: string, timeout = 8_000): Promise<boolean> {
  return page
    .locator(selector)
    .first()
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false);
}

async function closeOverlays(page: Page): Promise<void> {
  for (let i = 0; i < 4; i++) {
    const open = await call<string[]>(page, 'core.overlays');
    if (open.length === 0) return;
    await call(page, 'core.closeOverlay');
    await page.waitForTimeout(80);
  }
}

/** Chiude le schede del tombolo (suggerimento, personaggio, eco) senza aprire la Pausa. */
async function closeNightPopups(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) {
    const open = await page.locator('[data-test="tb-suggerimento"], [data-test="tb-scheda"], [data-test="tb-eco"]').first().isVisible().catch(() => false);
    if (!open) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
  }
}

/** Le schede del Taccuino oltre a quella iniziale (GDD 10.3). */
const TACCUINO_TABS = ['persone', 'libro', 'domande', 'lettere', 'archivio'] as const;

/** Autore dimenticato per il bigliettino anonimo, con la memoria da rimettere. */
let forgotten: { who: string; memoria: number } | null = null;

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const readJson = <T>(rel: string): T => JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as T;

/** Il Taccuino di chi ha giocato a lungo: tutto quello che i contenuti possono far conoscere. */
async function learnEverything(page: Page): Promise<void> {
  const chars = readJson<{ id: string; quirks?: string[] }[]>('src/content/characters.json');
  for (const q of chars.flatMap((c) => c.quirks ?? [])) await call(page, 'campaign.learn', 'quirk', q);
  for (const c of CAST) await call(page, 'campaign.learn', 'desire', c);
  const letters = [...readJson<{ id: string }[]>('src/content/lettere.atto1.json'), ...readJson<{ id: string }[]>('src/content/lettere.atto23.json')];
  for (const l of letters) await call(page, 'campaign.learn', 'letter', l.id);
  const questions = Object.keys(readJson<{ domande?: Record<string, unknown> }>('src/content/text/it/comune.json').domande ?? {});
  for (const [i, q] of questions.entries()) await call(page, 'campaign.learn', 'question', q, i % 2 === 0 ? 'risolta' : 'aperta');
  // Le pagine del Libro si aprono con le regole conosciute (book.json, `unlock`).
  const rules = new Set(readJson<{ rule: string }[]>('src/content/book.json').map((p) => p.rule));
  for (const r of RULE_IDS) if (rules.has(r)) await call(page, 'campaign.learn', 'rule', r);
  await call(page, 'campaign.learn', 'archive', 'arc1', 'rammendato');
  await call(page, 'campaign.learn', 'archive', 'arc2', 'nuovo');
}

/** Accetta i primi bigliettini della sera che il solver sa tessere insieme. */
async function acceptSome(page: Page, n: number): Promise<void> {
  const ev = await call<{ levelId: string; noteIds: string[]; pinsLeft: number } | null>(page, 'campaign.evening');
  if (!ev) return;
  const picked: string[] = [];
  for (const id of ev.noteIds) {
    if (picked.length >= Math.min(n, ev.pinsLeft)) break;
    const r = await call<{ status: string } | null>(page, 'engine.solve', ev.levelId, [...picked, id]);
    if (r?.status === 'ok') picked.push(id);
  }
  if (picked.length) await call(page, 'campaign.accept', picked);
}

export const TOUR: TourStep[] = [
  {
    id: 'titolo-primo-avvio',
    async run(page) {
      await waitScene(page, 'titolo');
      await settle(page, 800);
    },
  },
  {
    id: 'prologo-buio',
    async run(page) {
      await call(page, 'campaign.newGame');
      await waitScene(page, 'sera');
      await visible(page, '[data-test="cp-prologo-buio"]');
      await settle(page);
    },
  },
  {
    id: 'prologo-biglietto',
    async run(page) {
      await page.locator('[data-test="cp-prologo-buio"]').click();
      await visible(page, '[data-test="cp-prologo-biglietto"]');
      await settle(page);
    },
  },
  {
    id: 'tombolo-prologo',
    async run(page) {
      await call(page, 'campaign.goto', 'g00', 'notte');
      await waitNight(page);
      await call(page, 'night.cross', 0, 'R');
      await call(page, 'night.fix');
      await call(page, 'night.cross', 1, 'R');
      await settle(page, 500);
    },
  },
  {
    id: 'pausa',
    async run(page) {
      await call(page, 'core.input.action', 'back');
      await until(page, async () => (await call<string[]>(page, 'core.overlays')).includes('pausa'), 5_000);
      await settle(page);
    },
  },
  {
    id: 'alba',
    async run(page) {
      await closeOverlays(page);
      await call(page, 'campaign.goto', 'g00', 'alba');
      await waitScene(page, 'alba');
      await visible(page, '[data-test="cp-vignetta-salta"]');
      await settle(page, 600);
    },
  },
  {
    id: 'bilancio',
    async run(page) {
      await call(page, 'campaign.goto', 'g02', 'bilancio');
      await waitScene(page, 'bilancio');
      await visible(page, '[data-test="cp-bilancio-continua"]');
      await settle(page);
    },
  },
  {
    id: 'sera-oggetto',
    async run(page) {
      await call(page, 'campaign.goto', 'g05', 'sera');
      await waitScene(page, 'sera');
      await settle(page, 500);
    },
  },
  {
    id: 'sera-bigliettini',
    async run(page) {
      await call(page, 'campaign.objectSeen');
      await visible(page, '[data-test^="cp-bigliettino-"]');
      await settle(page, 500);
    },
  },
  {
    id: 'bigliettino-risposte',
    async run(page) {
      const notes = page.locator('[data-test^="cp-bigliettino-"]');
      const ids = await notes.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.test ?? ''));
      // Un bigliettino con le risposte, se c'è (altrimenti il primo).
      let opened = false;
      for (const id of ids) {
        await page.locator(`[data-test="${id}"]`).click();
        await page.waitForTimeout(150);
        if (await page.locator('[data-test="cp-rispondi"]').isVisible()) {
          await page.locator('[data-test="cp-rispondi"]').click();
          opened = true;
          break;
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
      }
      if (!opened && ids[0]) await page.locator(`[data-test="${ids[0]}"]`).click();
      await settle(page);
    },
  },
  {
    id: 'taccuino',
    async run(page) {
      await page.keyboard.press('Escape');
      await closeOverlays(page);
      await call(page, 'core.openOverlay', 'taccuino', { from: 'sera' });
      await visible(page, '[data-test="cp-taccuino"]');
      await settle(page);
    },
  },
  {
    id: 'sera-conferma',
    async run(page) {
      await closeOverlays(page);
      // «Al tombolo» con bigliettini non decisi: finestra di conferma (GDD 10.3), pulsante
      // sicuro a sinistra. Si tocca solo se la conferma ci sarà davvero (altrimenti si
      // partirebbe per la notte).
      const ev = await call<{ undecided: string[] } | null>(page, 'campaign.evening');
      if ((ev?.undecided.length ?? 0) > 0) {
        await page.locator('[data-test="cp-al-tombolo"]').click();
        await visible(page, '[data-test="confirm"]', 3_000);
      }
      await settle(page);
    },
  },
  {
    id: 'tombolo-notte',
    async run(page) {
      const cancel = page.locator('[data-test="confirm-annulla"]');
      if (await cancel.isVisible().catch(() => false)) await cancel.click();
      await closeOverlays(page);
      await acceptSome(page, 2);
      await call(page, 'campaign.toNight');
      await waitNight(page);
      const sol = await call<{ rows: { crossings: { pair: number; over: 'L' | 'R'; forced?: boolean }[] }[] } | null>(page, 'engine.solve', 'g05', ((await call<{ accepted: string[] } | null>(page, 'campaign.evening'))?.accepted ?? []));
      for (const r of (sol?.rows ?? []).slice(0, 3)) {
        for (const c of r.crossings) if (!c.forced) await call(page, 'night.cross', c.pair, c.over);
        await call(page, 'night.fix');
      }
      await settle(page, 600);
    },
  },
  {
    id: 'tombolo-suggerimento',
    async run(page) {
      // La lampada: secondo gradino (Indizio), una frase sulla scheda (GDD 14).
      await call(page, 'night.hint', 'indizio');
      await visible(page, '[data-test="tb-suggerimento"]', 5_000);
      await settle(page, 400);
    },
  },
  {
    id: 'tombolo-riavvolgi',
    async run(page) {
      await closeNightPopups(page);
      // Tocco su una riga passata: anteprima con la barra «Riavvolgi fino a qui / Annulla».
      const st = await call<{ rows: { hour: number }[] }>(page, 'night.state');
      const hour = st.rows[0]?.hour;
      if (hour !== undefined) await call(page, 'night.previewRewind', hour);
      await visible(page, '[data-test="tb-riavvolgi"]', 3_000);
      await settle(page, 400);
    },
  },
  {
    id: 'tombolo-scheda',
    async run(page) {
      const cancel = page.locator('[data-test="tb-riavvolgi-annulla"]');
      if (await cancel.isVisible().catch(() => false)) await cancel.click();
      await closeNightPopups(page);
      // Scheda del personaggio: tasto destro sul fuso (GDD 11.2), come la pressione lunga.
      const l = await call<{ spindles: { cx: number; cy: number }[] }>(page, 'night.layout');
      const sp = l.spindles[1] ?? l.spindles[0];
      if (sp) await page.mouse.click(sp.cx, sp.cy, { button: 'right' });
      await visible(page, '[data-test="tb-scheda"]', 3_000);
      await settle(page, 400);
    },
  },
  {
    id: 'sera-atto2',
    async run(page) {
      await closeNightPopups(page);
      await call(page, 'campaign.goto', 'g14', 'sera');
      await waitScene(page, 'sera');
      await call(page, 'campaign.objectSeen');
      await visible(page, '[data-test^="cp-bigliettino-"]');
      await settle(page, 500);
    },
  },
  {
    id: 'sera-anonimo',
    async run(page) {
      // Chi ha dimenticato Ada scrive senza firma: prima di appuntare, «Chi l'ha scritto?»
      // con la fila dei ritratti (GDD 3.11, 4.2, 10.3). La memoria torna come prima dopo.
      const ev = await call<{ noteIds: string[] } | null>(page, 'campaign.evening');
      const notes = contentNotes();
      const author = (ev?.noteIds ?? []).map((id) => notes.get(id)?.author).find((a): a is string => !!a && (CAST as readonly string[]).includes(a));
      if (!author) return;
      const before = (await call<{ memoria: Record<string, number> }>(page, 'campaign.state')).memoria[author] ?? 3;
      forgotten = { who: author, memoria: before };
      await call(page, 'campaign.setMemoria', author, 0);
      await call(page, 'campaign.goto', 'g14', 'sera');
      await waitScene(page, 'sera');
      await call(page, 'campaign.objectSeen');
      const anon = (await call<{ anonymous: string[] } | null>(page, 'campaign.evening'))?.anonymous[0];
      if (anon) {
        await page.locator(`[data-test="cp-bigliettino-${anon}"]`).click();
        await visible(page, '[data-test="cp-nota-chi"]', 3_000);
      }
      await settle(page, 500);
    },
  },
  ...TACCUINO_TABS.map(
    (tab, i): TourStep => ({
      id: `taccuino-${tab}`,
      async run(page) {
        if (i === 0) {
          await page.keyboard.press('Escape');
          await closeOverlays(page);
          // Un Taccuino pieno (stranezze, desideri, lettere, domande, regole, un Archivio):
          // le schede più lunghe sono quelle che possono far uscire il testo.
          await learnEverything(page);
          await call(page, 'core.openOverlay', 'taccuino', { from: 'sera' });
          await visible(page, '[data-overlay="taccuino"]');
        }
        const t = page.locator(`[data-overlay="taccuino"] [data-test="cp-taccuino-scheda-${tab}"]`).first();
        if (await t.isVisible().catch(() => false)) await t.click();
        await settle(page, 400);
      },
    }),
  ),
  {
    id: 'alba-atto2',
    async run(page) {
      await closeOverlays(page);
      if (forgotten) {
        await call(page, 'campaign.setMemoria', forgotten.who, forgotten.memoria);
        forgotten = null;
      }
      await call(page, 'campaign.goto', 'g14', 'alba');
      await waitScene(page, 'alba');
      await visible(page, '[data-test="cp-vignetta-salta"]');
      await settle(page, 600);
    },
  },
  {
    id: 'tombolo-nome',
    async run(page) {
      // Da g12, prima della prima riga: «Appunta il tuo nome» (GDD 10.3, regola del nome).
      await call(page, 'campaign.goto', 'g12', 'notte');
      await waitNight(page);
      await visible(page, '[data-test="tb-nome-prompt"]', 5_000);
      await settle(page, 500);
    },
  },
  {
    id: 'archivio-cassapanca',
    async run(page) {
      await call(page, 'campaign.goto', 'arc1', 'archivio');
      await waitScene(page, 'archivio');
      await visible(page, '[data-test="cp-apri-arc1"]');
      await settle(page);
    },
  },
  {
    id: 'archivio-merletto',
    async run(page) {
      await page.locator('[data-test="cp-apri-arc1"]').click();
      await waitNight(page);
      await settle(page, 600);
    },
  },
  {
    id: 'telaio',
    async run(page) {
      await call(page, 'core.goto', 'telaio');
      await waitScene(page, 'telaio');
      await settle(page, 500);
    },
  },
  {
    id: 'telaio-nodo',
    async run(page) {
      // Un nodo aperto: Rigioca, Riprendi da qui, Riascolta (GDD 8.2, 10.3).
      const head = page.locator('[data-test^="cp-nodo-apri-"]:not([disabled])').first();
      if (await head.isVisible().catch(() => false)) {
        await head.click();
        await visible(page, '[data-test^="cp-nodo-azioni-"]', 3_000);
      }
      await settle(page);
    },
  },
  {
    id: 'scelta',
    async run(page) {
      await call(page, 'campaign.goto', 'g23', 'scelta');
      await waitScene(page, 'sera');
      await call(page, 'campaign.objectSeen');
      await settle(page, 600);
    },
  },
  {
    id: 'scelta-strappata',
    async run(page) {
      const card = page.locator('[data-test="cp-carta-aperto"]');
      if (await card.isVisible().catch(() => false)) await card.click();
      await visible(page, '[data-test="cp-mancanze"]', 3_000);
      await settle(page);
    },
  },
  {
    id: 'finale-epilogo',
    async run(page) {
      await page.keyboard.press('Escape');
      await closeOverlays(page);
      await call(page, 'campaign.choose', 'merlettaia');
      await waitNight(page);
      await call(page, 'night.autoplay');
      await waitScene(page, 'finale', 20_000);
      await until(page, async () => ((await call<{ mode?: string } | null>(page, 'campaign.finale'))?.mode ?? '') === 'epilogo', 15_000);
      await visible(page, '[data-test="cp-vignetta-salta"]');
      await settle(page, 600);
    },
  },
  {
    id: 'titoli-di-coda',
    async run(page) {
      await page.locator('[data-test="cp-vignetta-salta"]').click();
      await until(page, async () => JSON.stringify(await call(page, 'campaign.finale')).includes('titoli'), 15_000);
      await settle(page, 800);
    },
  },
  {
    id: 'giornaliero',
    async run(page) {
      if ((await phase(page)) === 'titoli') await page.locator('[data-test="cp-titoli-fine"]').click().catch(() => undefined);
      await call(page, 'ui.unlock', 'all');
      await call(page, 'ui.setToday', TOUR_DAY);
      await call(page, 'ui.open', 'giornaliero');
      await waitScene(page, 'giornaliero');
      await page.locator('[data-test="sc-giornaliero-tessi"]').waitFor({ state: 'visible', timeout: 15_000 });
      await settle(page, 500);
    },
  },
  {
    id: 'spartito',
    async run(page) {
      await call(page, 'ui.open', 'spartito', { returnTo: 'giornaliero' });
      await visible(page, '[data-test="sc-spartito-campo"]');
      await settle(page);
    },
  },
  {
    id: 'giornaliero-risultato',
    async run(page) {
      await closeOverlays(page);
      await call(page, 'ui.startDaily');
      await waitNight(page);
      await call(page, 'core.time.setSpeed', 8);
      await call(page, 'night.autoplay');
      await waitScene(page, 'giornaliero', 15_000);
      await visible(page, '[data-test="sc-risultato-condividi"]', 10_000);
      await call(page, 'core.time.setSpeed', 1);
      await settle(page, 600);
    },
  },
  {
    id: 'libero',
    async run(page) {
      await call(page, 'ui.open', 'libero');
      await waitScene(page, 'libero');
      await settle(page, 600);
    },
  },
  {
    id: 'impostazioni',
    async run(page) {
      await call(page, 'ui.open', 'impostazioni');
      await waitScene(page, 'impostazioni');
      await settle(page, 400);
    },
  },
  {
    id: 'crediti',
    async run(page) {
      await call(page, 'ui.open', 'crediti');
      await waitScene(page, 'crediti');
      await settle(page, 600);
    },
  },
  {
    id: 'audio-tocca',
    async run(page) {
      // «Tocca per continuare» quando il contesto audio si ferma (iOS dopo una chiamata, GDD 10.3).
      await call(page, 'ui.open', 'titolo');
      await waitScene(page, 'titolo');
      if ((await call<string>(page, 'audio.state')) !== 'running') {
        const vp = await call<{ cssW: number; cssH: number }>(page, 'core.viewport');
        await page.mouse.click(Math.round(vp.cssW / 2), Math.round(vp.cssH * 0.3));
        await until(page, async () => (await call<string>(page, 'audio.state')) === 'running', 3_000);
      }
      await call(page, 'audio.interrupt');
      await visible(page, '[data-test="audio-tocca"]', 3_000);
      await settle(page);
    },
  },
  {
    id: 'titolo-con-storia',
    async run(page) {
      const resume = page.locator('[data-test="audio-tocca"]');
      if (await resume.isVisible().catch(() => false)) await resume.click();
      await call(page, 'ui.open', 'titolo');
      await waitScene(page, 'titolo');
      await settle(page, 800);
    },
  },
];
