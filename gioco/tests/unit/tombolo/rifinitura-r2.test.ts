// @vitest-environment happy-dom
/**
 * Rifinitura della revisione 2 (residui dei verificatori, tombolo):
 * - Q005: «1 braccio usato» al singolare nella matassa letta dai lettori di schermo;
 * - Q022 nella scheda del personaggio: chi ha stranezze note che stanotte non
 *   contano non è «senza stranezze note».
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createI18n, type I18nSource } from '../../../src/core/i18n';
import type { ContentDB, DiaryEntryDef } from '../../../src/core/types';
import { dormantQuirks, shownQuirks } from '../../../src/tombolo/quirks';
import { charCard } from '../../../src/tombolo/ui/charcard';
import { ROOT } from './helpers';

const src = (locale: 'it' | 'en'): I18nSource => ({
  locale,
  ns: 'tombolo',
  path: `src/i18n/${locale}/tombolo.json`,
  data: JSON.parse(readFileSync(resolve(ROOT, `src/i18n/${locale}/tombolo.json`), 'utf8')) as unknown,
});

describe('Rifinitura R2: matassa e scheda', () => {
  it('Q005: la matassa dice «1 braccio usato» e «3 braccia usate»', () => {
    const i18n = createI18n({ sources: [src('it'), src('en')], locale: 'it' });
    expect(i18n.t('tombolo.hud.matassaAria', { usata: 1, totale: 12 })).toBe('Matassa: 1 braccio usato su 12');
    expect(i18n.t('tombolo.hud.matassaAria', { usata: 3, totale: 12 })).toBe('Matassa: 3 braccia usate su 12');
    expect(i18n.t('tombolo.hud.matassaAria', { usata: 0, totale: 12 })).toBe('Matassa: 0 braccia usate su 12');
    i18n.setLocale('en');
    expect(i18n.t('tombolo.hud.matassaAria', { usata: 1, totale: 12 })).toBe('Thread: 1 of 12 lengths used');
    expect(i18n.t('tombolo.scheda.nessunaStranezzaStanotte')).toBe('No known quirk that matters tonight.');
  });

  it('stranezze dormienti: nella storia solo quelle già nel Taccuino, nelle modalità extra tutte quelle non attive', () => {
    const diary: Pick<ContentDB, 'diary'> = {
      diary: new Map<string, DiaryEntryDef>([
        ['persone.gino.corre', { id: 'persone.gino.corre', section: 'persone', character: 'gino', textKey: 'x', unlock: { knows: 'quirk', id: 'ginoCorre' } }],
      ]),
    };
    const known = { quirks: ['ginoCorre'] as never[], diary: ['persone.gino.corre'] };
    const unknown = { quirks: [] as never[], diary: [] };
    // Stanotte la stranezza di Gino non conta (non è fra quelle attive del livello).
    expect(shownQuirks('campagna', 'gino', ['ginoCorre'], [], known, diary)).toEqual([]);
    expect(dormantQuirks('campagna', 'gino', ['ginoCorre'], [], known, diary)).toEqual(['ginoCorre']);
    expect(dormantQuirks('campagna', 'gino', ['ginoCorre'], [], unknown, diary)).toEqual([]);
    expect(dormantQuirks('giornaliero', 'gino', ['ginoCorre'], [], unknown, diary)).toEqual(['ginoCorre']);
    // Attiva: non è dormiente.
    expect(dormantQuirks('giornaliero', 'gino', ['ginoCorre'], ['ginoCorre'], unknown, diary)).toEqual([]);
  });

  it('Q022 nella scheda: con stranezze note che stanotte non contano dice «Nessuna stranezza nota che conti stanotte.»', () => {
    const base = { thread: 'gino', nameText: 'Gino', roleKey: null, color: '#c33', icon: null, kind: 'persona' as const, quirks: [], desireKey: null, memoria: null };
    const sleepy = charCard({ ...base, dormant: 1 });
    const none = charCard({ ...base, dormant: 0 });
    const q = (n: HTMLElement) => n.querySelector<HTMLElement>('[data-test="tb-scheda-nessuna"]');
    expect(q(sleepy)?.dataset.stanotte).toBe('1');
    expect(q(sleepy)?.querySelector('[data-i18n]')?.getAttribute('data-i18n')).toBe('tombolo.scheda.nessunaStranezzaStanotte');
    expect(q(none)?.dataset.stanotte).toBe('0');
    expect(q(none)?.querySelector('[data-i18n]')?.getAttribute('data-i18n')).toBe('tombolo.scheda.nessunaStranezza');
    // Con una stranezza attiva la riga «nessuna» non c'è.
    expect(q(charCard({ ...base, quirks: ['ginoCorre'], dormant: 0 }))).toBeNull();
  });
});
