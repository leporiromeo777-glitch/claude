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

  it('gli esempi normativi di ARCHITETTURA 14 sono validi (nessun falso positivo)', () => {
    // 14.1: il prologo, alla lettera.
    const g00 = {
      id: 'g00', kind: 'storia', act: 0, titleKey: 'atto1.g00.titolo',
      columns: ['forno', 'piazza', 'chiesa'], startHour: 5, endHour: 9,
      threads: [
        { id: 'teresa', kind: 'persona', character: 'teresa' },
        { id: 'marta', kind: 'persona', character: 'marta' },
        { id: 'piero', kind: 'persona', character: 'piero' },
      ],
      initial: ['teresa', 'marta', 'piero'],
      beads: [{ id: 'L1', type: 'lettera', holder: 'teresa', to: 'piero', labelKey: 'atto1.g00.perline.L1' }],
      rules: ['incrocio', 'spillo', 'lettera'],
      quirks: ['martaNoSotto', 'teresaLegge', 'pieroPozzo'],
      pins: [
        { thread: 'marta', place: 'forno', hour: 6 },
        { thread: 'teresa', place: 'forno', hour: 9 },
        { thread: 'piero', place: 'chiesa', hour: 9 },
      ],
      goals: [{ t: 'consegnata', bead: 'L1', by: 9 }],
      matassa: 6,
      dawn: { candidates: [
        { id: 'g00.alba.marta', priority: 100, background: 'dio/forno/alba',
          figures: [{ character: 'marta', pose: 'porge', x: 0.5 }],
          lines: [{ speaker: 'marta', textKey: 'atto1.g00.alba.marta' }] },
      ] },
      hintKeys: { spinta: 'atto1.g00.hint.spinta' },
      tutorial: [
        { k: 'mano', hour: 6, pair: 0, over: 'R' },
        { k: 'pulsa', target: 'fissa', hour: 6 },
        { k: 'margine', when: 'versoSbagliato', textKey: 'atto1.g00.margine.sopraDa', hour: 7 },
      ],
    };
    // Un g03 minimo che ospita il bigliettino di 14.2.
    const g03 = {
      ...g00, id: 'g03', titleKey: 'atto1.g03.titolo', columns: ['molo', 'forno', 'piazza', 'chiesa'],
      threads: [...g00.threads, { id: 'nina', kind: 'persona', character: 'nina' }],
      initial: ['nina', 'teresa', 'marta', 'piero'], notes: ['g03.nina'], dawn: undefined, tutorial: undefined,
    };
    // 14.2
    const nota = {
      id: 'g03.nina', day: 'g03', author: 'nina', textKey: 'atto1.g03.nina.testo',
      request: { t: 'parte', who: 'nina', hour: 9 },
      replies: [
        { id: 'R1', textKey: 'atto1.g03.nina.r1', effects: [{ setFlag: 'ninaDillo', value: true }] },
        { id: 'R2', textKey: 'atto1.g03.nina.r2', effects: [{ setFlag: 'ninaVai', value: true }] },
      ],
      onOk: [{ setFlag: 'ninaEsame', value: true }, { desire: 'nina' }],
      onFail: [{ diary: 'persone.nina.esamePerso' }],
      onIgnore: [{ desire: 'nina' }],
    };
    // 14.3
    const diario = [
      { id: 'persone.marta.noSotto', section: 'persone', character: 'marta', textKey: 'atto1.diario.marta.noSotto', source: 'visto', unlock: { knows: 'quirk', id: 'martaNoSotto' } },
      { id: 'persone.nina.esamePerso', section: 'persone', character: 'nina', textKey: 'atto1.diario.nina.esamePerso', unlock: { failed: 'g03.nina' } },
    ];
    const battute = [
      { id: 'marta.nodo.teresa.1', character: 'marta', event: 'nodo', with: 'teresa', textKey: 'comune.battute.marta.nodo.1', forgetKey: 'comune.battute.marta.nodo.1d', priority: 10 },
    ];
    // 14.4 (stessi campi per i quattro personaggi usati)
    const personaggi = ['teresa', 'marta', 'piero', 'nina'].map((id) => ({
      id, nameKey: `comune.pers.${id}.nome`, roleKey: `comune.pers.${id}.ruolo`,
      color: '#2F5DA8', pattern: 'righe', icon: 'busta', noteHz: 440.0,
      voice: { pitch: 260, rate: 11, formantShift: 0, noise: 0 },
      hand: { font: 'caveat', ink: '#24407A', paper: '#DCE6EE', slantDeg: -2, sizeScale: 1 },
      quirks: [], desireKey: `comune.pers.${id}.desiderio`, likes: ['festa', 'messa'],
    }));
    // 14.5 (finali che puntano a livelli esistenti in questo mondo minimo)
    const campagna = {
      choiceDay: 'g03',
      finals: { merlettaia: 'g00', seppia: 'g00', chiuso: 'g00', aperto: 'g00' },
      days: [
        { id: 'g00', act: 0, pins: 0, stonatura: 1, objectAfter: 'merletto_avorio' },
        { id: 'g03', act: 1, pins: 2, stonatura: 1, objectAfter: 'lettera_L3' },
      ],
    };
    const { db } = buildContentDB({
      './levels/g00.json': g00,
      './levels/g03.json': JSON.parse(JSON.stringify(g03)) as unknown,
      './notes.atto1.json': [nota],
      './diary.atto1.json': diario,
      './lines.json': battute,
      './characters.json': personaggi,
      './campaign.json': campagna,
    });
    expect(validateContent(db)).toEqual([]);
  });

  it('i contenuti reali presenti nel repository si caricano', () => {
    const db = loadContent();
    expect(db.balance.memoria.max).toBe(3);
    expect(Array.isArray(db.lines)).toBe(true);
  });
});
