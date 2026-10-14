import { describe, expect, it, vi } from 'vitest';
import {
  buildCatalogs,
  createI18n,
  DuplicateNamespaceError,
  flatten,
  formatMessage,
  loadI18nSources,
  sourceFromPath,
  type I18nSource,
} from '../../../src/core/i18n';

const sources: I18nSource[] = [
  {
    locale: 'it',
    ns: 'core',
    path: 'src/i18n/it/core.json',
    data: {
      saluto: 'Ciao {nome}!',
      incroci: '{n, plural, =0 {nessun incrocio} one {# incrocio} other {# incroci}}',
      solo: 'Solo in italiano',
      annidato: { a: { b: 'profondo' } },
      misto: '{n, plural, one {# lettera per {chi}} other {# lettere per {chi}}}',
      genere: '{g, select, f {la merlettaia} m {il merlettaio} other {chi tesse}}',
    },
  },
  {
    locale: 'en',
    ns: 'core',
    path: 'src/i18n/en/core.json',
    data: {
      saluto: 'Hi {nome}!',
      incroci: '{n, plural, =0 {no crossings} one {# crossing} other {# crossings}}',
      annidato: { a: { b: 'deep' } },
    },
  },
  { locale: 'it', ns: 'atto1', path: 'src/content/text/it/atto1.json', data: { 'g03.nina.testo': 'Testo' } },
];

describe('i18n', () => {
  it('appiattisce le chiavi con il namespace', () => {
    const m = new Map<string, string>();
    flatten({ a: { b: 'x', c: ['y', 'z'] } }, 'ns', m);
    expect([...m.entries()]).toEqual([
      ['ns.a.b', 'x'],
      ['ns.a.c.0', 'y'],
      ['ns.a.c.1', 'z'],
    ]);
  });

  it('interpolazione', () => {
    const i = createI18n({ sources, locale: 'it' });
    expect(i.t('core.saluto', { nome: 'Ada' })).toBe('Ciao Ada!');
    expect(i.t('core.saluto')).toBe('Ciao {nome}!');
    expect(i.t('core.annidato.a.b')).toBe('profondo');
    expect(i.t('atto1.g03.nina.testo')).toBe('Testo');
  });

  it('plurali in italiano e in inglese, con =0 e #', () => {
    const it_ = createI18n({ sources, locale: 'it' });
    expect(it_.t('core.incroci', { n: 0 })).toBe('nessun incrocio');
    expect(it_.t('core.incroci', { n: 1 })).toBe('1 incrocio');
    expect(it_.t('core.incroci', { n: 9 })).toBe('9 incroci');
    expect(it_.t('core.misto', { n: 1, chi: 'Nina' })).toBe('1 lettera per Nina');
    expect(it_.t('core.misto', { n: 3, chi: 'Nina' })).toBe('3 lettere per Nina');
    const en = createI18n({ sources, locale: 'en' });
    expect(en.t('core.incroci', { n: 1 })).toBe('1 crossing');
    expect(en.t('core.incroci', { n: 2 })).toBe('2 crossings');
  });

  it('select', () => {
    const i = createI18n({ sources, locale: 'it' });
    expect(i.t('core.genere', { g: 'f' })).toBe('la merlettaia');
    expect(i.t('core.genere', { g: 'x' })).toBe('chi tesse');
  });

  it('riserva: lingua scelta → italiano → chiave', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const en = createI18n({ sources, locale: 'en', dev: true });
    expect(en.t('core.saluto', { nome: 'Ada' })).toBe('Hi Ada!');
    expect(en.t('core.solo')).toBe('Solo in italiano');
    expect(en.t('core.inesistente')).toBe('core.inesistente');
    expect(en.t('core.inesistente')).toBe('core.inesistente');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(en.has('core.solo')).toBe(true);
    expect(en.exists('core.solo', 'en')).toBe(false);
    expect(en.has('core.inesistente')).toBe(false);
  });

  it('missing(): chiavi italiane assenti nella lingua, più quelle chieste e inesistenti', () => {
    const i = createI18n({ sources, locale: 'en' });
    expect(i.missing('en')).toEqual(['atto1.g03.nina.testo', 'core.genere', 'core.misto', 'core.solo']);
    i.t('core.chiesta');
    expect(i.missing()).toContain('core.chiesta');
    expect(i.missing('it')).toEqual([]);
  });

  it('cambio di lingua', () => {
    const onLocaleChange = vi.fn();
    const i = createI18n({ sources, locale: 'it', onLocaleChange });
    i.setLocale('en');
    expect(i.locale()).toBe('en');
    expect(i.t('core.annidato.a.b')).toBe('deep');
    expect(onLocaleChange).toHaveBeenCalledWith('en');
  });

  it('un namespace definito due volte è un errore', () => {
    const dup: I18nSource[] = [
      ...sources,
      { locale: 'it', ns: 'core', path: 'src/content/text/it/core.json', data: { x: 'y' } },
    ];
    expect(() => buildCatalogs(dup)).toThrow(DuplicateNamespaceError);
    // Stesso namespace in lingue diverse va bene.
    expect(() => buildCatalogs(sources)).not.toThrow();
  });

  it('percorsi dei file', () => {
    expect(sourceFromPath('../i18n/it/core.json', {})).toMatchObject({ locale: 'it', ns: 'core' });
    expect(sourceFromPath('../content/text/en/atto1.json', {})).toMatchObject({ locale: 'en', ns: 'atto1' });
    expect(sourceFromPath('../content/levels/g00.json', {})).toBeNull();
  });

  it('formatMessage tollera graffe sbilanciate e parametri mancanti', () => {
    expect(formatMessage('a {b', {}, 'it')).toBe('a {b');
    expect(formatMessage('{x} e {y}', { x: 1 }, 'it')).toBe('1 e {y}');
    expect(formatMessage('{n, plural, other {# volte}}', { n: 'tre' }, 'it')).toBe('# volte');
  });

  it('i file reali del gioco si caricano senza namespace duplicati', () => {
    const real = loadI18nSources();
    expect(real.some((s) => s.ns === 'core' && s.locale === 'it')).toBe(true);
    expect(() => buildCatalogs(real)).not.toThrow();
  });
});
