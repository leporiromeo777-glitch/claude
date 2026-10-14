/** Servizi minimi per i test che usano componenti e testo ricco. */
import { createI18n, type I18nSource } from '../../../src/core/i18n';
import { installServices } from '../../../src/core/services';
import { buildContentDB } from '../../../src/content/loader';
import type { Locale } from '../../../src/core/types';

export const TEST_TEXTS: I18nSource[] = [
  {
    locale: 'it',
    ns: 'core',
    path: 'test/it/core.json',
    data: {
      ui: { chiudi: 'Chiudi', ok: 'Va bene', annulla: 'Annulla', pannello: 'Pannello «{id}»', pannelloAssente: 'Non pronto.' },
      prova: { ciao: 'Ciao *mondo*', conta: '{n, plural, one {# filo} other {# fili}}' },
    },
  },
  {
    locale: 'en',
    ns: 'core',
    path: 'test/en/core.json',
    data: {
      ui: { chiudi: 'Close', ok: 'OK', annulla: 'Cancel', pannello: 'Panel “{id}”', pannelloAssente: 'Not ready.' },
      prova: { ciao: 'Hello *world*', conta: '{n, plural, one {# thread} other {# threads}}' },
    },
  },
  { locale: 'it', ns: 'comune', path: 'test/it/comune.json', data: { pers: { teresa: { nome: 'Teresa' } } } },
];

export function installTestServices(locale: Locale = 'it') {
  const i18n = createI18n({ sources: TEST_TEXTS, locale });
  const content = buildContentDB({
    './characters.json': [
      {
        id: 'teresa', nameKey: 'comune.pers.teresa.nome', roleKey: 'x', color: '#2F5DA8', pattern: 'righe', icon: 'busta',
        noteHz: 440, voice: null, hand: null, quirks: [], likes: [],
      },
    ],
  }).db;
  installServices({ i18n, content });
  return { i18n, content };
}
