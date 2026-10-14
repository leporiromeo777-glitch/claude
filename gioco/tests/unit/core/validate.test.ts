import { describe, expect, it } from 'vitest';
import type { LevelDef, NoteDef } from '../../../src/core/types';
import { buildContentDB, loadContent } from '../../../src/content/loader';
import { errorClass, validateContent } from '../../../src/content/validate';
import { VALID_KEYS, validFiles } from './fixtures/content';

const hasKey = (k: string): boolean => VALID_KEYS.has(k);

function run(mutate?: (files: Record<string, unknown>) => void): string[] {
  const files = validFiles();
  mutate?.(files);
  const { db } = buildContentDB(files);
  return validateContent(db, { hasKey });
}
const level = (f: Record<string, unknown>): LevelDef => f['./levels/g00.json'] as LevelDef;
const classes = (errs: string[]): string[] => [...new Set(errs.map((e) => errorClass(e) ?? '?'))].sort();

describe('validateContent', () => {
  it('il mondo di prova è valido', () => {
    expect(run()).toEqual([]);
  });

  it('un database vuoto è valido (i contenuti arrivano dagli altri pacchetti)', () => {
    expect(validateContent(buildContentDB({}).db)).toEqual([]);
  });

  it('riferimenti mancanti: bigliettino, personaggio, destinatario, voce di Taccuino', () => {
    const errs = run((f) => {
      level(f).notes = ['g00.marta', 'g00.nessuno'];
      level(f).beads[0]!.to = 'nina';
      (f['./notes.atto1.json'] as NoteDef[])[0]!.author = 'zeno';
      (f['./notes.atto1.json'] as NoteDef[])[0]!.onOk = [{ diary: 'persone.inventata' }];
    });
    expect(errs.some((e) => e.includes('[ref]') && e.includes('g00.nessuno'))).toBe(true);
    expect(errs.some((e) => e.includes('[ref]') && e.includes('"nina"'))).toBe(true);
    expect(errs.some((e) => e.includes('[ref]') && e.includes('"zeno"'))).toBe(true);
    expect(errs.some((e) => e.includes('[ref]') && e.includes('persone.inventata'))).toBe(true);
  });

  it('colonne fuori ordine, ripetute o troppe poche', () => {
    expect(classes(run((f) => (level(f).columns = ['piazza', 'forno', 'chiesa'])))).toContain('colonne');
    expect(classes(run((f) => (level(f).columns = ['forno', 'forno', 'chiesa'])))).toContain('colonne');
    const few = run((f) => {
      level(f).columns = ['forno', 'piazza'];
      level(f).initial = ['teresa', 'marta'];
    });
    expect(few.some((e) => e.includes('[colonne]') && e.includes('2 columns'))).toBe(true);
  });

  it('initial di lunghezza sbagliata o con fili sconosciuti', () => {
    const errs = run((f) => (level(f).initial = ['teresa', 'marta']));
    expect(errs.some((e) => e.includes('[initial]') && e.includes('2 threads but there are 3 columns'))).toBe(true);
    const errs2 = run((f) => (level(f).initial = ['teresa', 'marta', 'lino9']));
    expect(errs2.some((e) => e.includes('[initial]') && e.includes('lino9'))).toBe(true);
  });

  it('chiavi i18n mancanti in italiano', () => {
    const errs = run((f) => (level(f).titleKey = 'atto1.g00.titoloSbagliato'));
    expect(errs).toEqual(['levels/g00: [i18n] titleKey "atto1.g00.titoloSbagliato" missing in Italian']);
  });

  it('fili e perline citati nelle condizioni', () => {
    const errs = run((f) => {
      level(f).goals = [
        { t: 'consegnata', bead: 'L9', by: 9 },
        { t: 'incontra', a: 'teresa', b: 'gino' },
        { t: 'ha', who: 'piero', bead: 'letta:L1' }, // valida: segreto di lettura di una lettera del livello
        { t: 'presso', who: 'marta', place: 'faro', hour: 7 }, // il Faro non è una colonna
      ];
      (f['./notes.atto1.json'] as NoteDef[])[0]!.request = { t: 'nonHa', who: 'nina', bead: 'L1' };
    });
    expect(errs.filter((e) => e.includes('[condizione]'))).toHaveLength(4);
    expect(errs.some((e) => e.includes('"L9"'))).toBe(true);
    expect(errs.some((e) => e.includes('"gino"'))).toBe(true);
    expect(errs.some((e) => e.includes('"faro"'))).toBe(true);
    expect(errs.some((e) => e.startsWith('notes/g00.marta') && e.includes('"nina"'))).toBe(true);
  });

  it('ore fuori dalla giornata', () => {
    const errs = run((f) => {
      level(f).pins[0]!.hour = 12;
      level(f).endHour = 25;
    });
    expect(classes(errs)).toContain('ore');
    const long = run((f) => {
      level(f).startHour = 2;
      level(f).endHour = 20;
    });
    expect(long.some((e) => e.includes('[ore]') && e.includes('18 rows'))).toBe(true);
  });

  it('tipi sconosciuti e id duplicati', () => {
    const errs = run((f) => {
      level(f).rules.push('magia' as never);
      level(f).threads.push({ id: 'marta', kind: 'persona', character: 'marta' });
      level(f).beads[0]!.type = 'sasso' as never;
    });
    expect(classes(errs)).toEqual(expect.arrayContaining(['tipo', 'duplicato']));
  });

  it('il loader segnala file con id diverso dal nome e forme sbagliate', () => {
    const errs = run((f) => {
      f['./levels/g01.json'] = { ...(f['./levels/g00.json'] as object), id: 'g99' };
      f['./places.json'] = { not: 'an array' };
    });
    expect(errs.some((e) => e.startsWith('levels/g01.json: [id]'))).toBe(true);
    expect(errs.some((e) => e.startsWith('places.json: [forma]'))).toBe(true);
  });

  it('rileva almeno 5 classi di errore diverse', () => {
    const errs = run((f) => {
      level(f).notes = ['g00.nessuno'];
      level(f).columns = ['chiesa', 'forno', 'piazza'];
      level(f).initial = ['teresa'];
      level(f).titleKey = 'manca';
      level(f).goals = [{ t: 'ha', who: 'gino', bead: 'L1' }];
      level(f).pins[0]!.hour = 3;
      level(f).quirks.push('volare' as never);
    });
    const found = classes(errs);
    for (const c of ['ref', 'colonne', 'initial', 'i18n', 'condizione', 'ore', 'tipo']) expect(found).toContain(c);
    expect(found.length).toBeGreaterThanOrEqual(5);
  });

  it('condizioni di storia ed effetti', () => {
    const errs = run((f) => {
      const n = (f['./notes.atto1.json'] as NoteDef[])[0]!;
      n.availableIf = { all: [{ ok: 'g77.x' }, { knows: 'quirk', id: 'nessuna' }, { memoria: 'pippo' as never }] };
      n.onFail = [{ teleport: true } as never];
    });
    expect(errs.filter((e) => e.includes('[ref]'))).toHaveLength(3);
    expect(errs.some((e) => e.includes('[effetto]'))).toBe(true);
  });

  it('i contenuti reali presenti nel repository si caricano', () => {
    const db = loadContent();
    expect(db.balance.memoria.max).toBe(3);
    expect(Array.isArray(db.lines)).toBe(true);
  });
});
