/**
 * Suite `i18n` (ARCHITETTURA 10 e 15.2, GDD 16 e 17): nessuna chiave mancante.
 *  - in inglese, nessuna chiave dei namespace L1 (interfaccia: core, ui, tombolo,
 *    campaign, audio, comune) manca rispetto all'italiano; la storia inglese (atto1-3,
 *    finali, L2) è stata tradotta e si controlla a parte;
 *  - dopo un giro completo delle schermate in italiano e in inglese, nessuna chiave
 *    chiesta a runtime manca (`core.missingKeys(locale)` conta anche quelle);
 *  - nessun testo visibile è una chiave non tradotta e `<html lang>` segue la lingua.
 */
import { auditLayout } from './helpers/audit';
import { call, expect, onlyProjects, test } from './helpers/game';
import { TOUR } from './helpers/tour';

const L1 = ['core', 'ui', 'tombolo', 'campaign', 'audio', 'comune'];
const L2_STORY = ['atto1', 'atto2', 'atto3', 'finali'];
const ns = (key: string): string => key.split('.')[0] ?? '';

test.describe('i18n', () => {
  test.beforeEach(({}, testInfo) => onlyProjects(testInfo, 'desktop'));

  test('inglese: nessuna chiave mancante nei namespace L1 (e nella storia tradotta)', async ({ game }) => {
    const { page } = game;
    const missing = await call<string[]>(page, 'core.missingKeys', 'en');
    expect(missing.filter((k) => L1.includes(ns(k))), 'chiavi L1 mancanti in inglese').toEqual([]);
    expect.soft(missing.filter((k) => L2_STORY.includes(ns(k))), 'storia inglese (L2): chiavi mancanti').toEqual([]);
    expect(missing.filter((k) => !L1.includes(ns(k)) && !L2_STORY.includes(ns(k))), 'chiavi di altri namespace mancanti in inglese').toEqual([]);
    expect(await call<string[]>(page, 'core.missingKeys', 'it'), 'italiano completo').toEqual([]);
    game.expectClean();
  });

  for (const locale of ['it', 'en'] as const) {
    test(`giro di tutte le schermate in ${locale === 'it' ? 'italiano' : 'inglese'}: nessuna chiave chiesta e mancante`, async ({ game }) => {
      test.setTimeout(4 * 60_000);
      const { page } = game;
      await call(page, 'core.setSettings', { animSpeed: 0, locale });
      await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe(locale);
      const raw: string[] = [];
      for (const step of TOUR) {
        await test.step(step.id, async () => {
          await step.run(page);
          const keys = (await auditLayout(page)).filter((p) => p.kind === 'chiave');
          raw.push(...keys.map((k) => `${step.id}: ${k.what} «${k.detail}»`));
        });
      }
      expect(raw, 'testi visibili che sono chiavi non tradotte').toEqual([]);
      const missing = await call<string[]>(page, 'core.missingKeys', locale);
      expect(missing, `chiavi chieste a runtime e mancanti (${locale})`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.lang)).toBe(locale);
      game.expectClean();
    });
  }
});
