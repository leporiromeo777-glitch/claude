/**
 * Condizioni ed effetti di storia (ARCHITETTURA 4): ogni variante di StoryCond e di Effect.
 */
import { describe, expect, it } from 'vitest';
import type { NightOutcome, StoryCond } from '../../../src/core/types';
import { applyEffects, evalStory, memoriaOf } from '../../../src/campaign/story';
import type { DayResultX } from '../../../src/campaign/types';
import { db, emptyKnowledge, emptyState } from './helpers';

function outcomeWith(events: NightOutcome['events']): NightOutcome {
  return {
    origin: 'campagna', levelId: 'g00', rows: [], timeline: [], events, goals: [], requests: [], dropped: [],
    metrics: { incroci: 0, minIncroci: null, quiete: 0, simmetria: false, filoDOro: false }, spartito: '', hintsUsed: 0,
    fantasmaUsed: false, discoveredQuirks: [], nomeOn: null,
  };
}

function day(over: Partial<DayResultX>): DayResultX {
  return { levelId: 'g01', rows: [], requests: [], metrics: { incroci: 0, minIncroci: null, quiete: 0, simmetria: false, filoDOro: false }, spartito: '', at: '', ...over };
}

describe('evalStory: ogni variante', () => {
  it('flag: acceso, eq booleano/stringa/numero, gte, lte', () => {
    const s = emptyState({ flags: { a: true, b: 'sì', c: 'parte', n: 3, z: 0 } });
    const k = emptyKnowledge();
    expect(evalStory({ flag: 'a' }, s, k)).toBe(true);
    expect(evalStory({ flag: 'b' }, s, k)).toBe(true);
    expect(evalStory({ flag: 'mancante' }, s, k)).toBe(false);
    expect(evalStory({ flag: 'z' }, s, k)).toBe(false);
    expect(evalStory({ flag: 'a', eq: true }, s, k)).toBe(true);
    expect(evalStory({ flag: 'mancante', eq: false }, s, k)).toBe(true);
    expect(evalStory({ flag: 'mancante', eq: true }, s, k)).toBe(false);
    expect(evalStory({ flag: 'c', eq: 'parte' }, s, k)).toBe(true);
    expect(evalStory({ flag: 'c', eq: 'resta' }, s, k)).toBe(false);
    expect(evalStory({ flag: 'n', eq: 3 }, s, k)).toBe(true);
    expect(evalStory({ flag: 'n', gte: 3 }, s, k)).toBe(true);
    expect(evalStory({ flag: 'n', gte: 4 }, s, k)).toBe(false);
    expect(evalStory({ flag: 'n', lte: 3 }, s, k)).toBe(true);
    expect(evalStory({ flag: 'n', lte: 2 }, s, k)).toBe(false);
    expect(evalStory({ flag: 'mancante', lte: 0 }, s, k)).toBe(true);
    expect(evalStory({ flag: 'c', gte: 1 }, s, k)).toBe(false);
  });

  it('ok, failed, accepted, ignored, reply: dalla storia e dalla sera in corso', () => {
    const s = emptyState({
      history: {
        g01: day({
          requests: [
            { noteId: 'g01.marta', status: 'soddisfatta' },
            { noteId: 'g01.gino', status: 'fallita' },
          ],
          accepted: [{ noteId: 'g01.marta' }, { noteId: 'g01.gino' }],
          ignored: ['g01.piero'],
          replies: { 'g01.gino': 'R2' },
        }),
      },
      evening: { noteIds: ['g02.teresa', 'g02.gino'], accepted: [{ noteId: 'g02.gino' }], replies: { 'g02.teresa': 'R1' }, ignored: ['g02.teresa'], objectSeen: true },
    });
    const k = emptyKnowledge();
    expect(evalStory({ ok: 'g01.marta' }, s, k)).toBe(true);
    expect(evalStory({ ok: 'g01.gino' }, s, k)).toBe(false);
    expect(evalStory({ failed: 'g01.gino' }, s, k)).toBe(true);
    expect(evalStory({ failed: 'g01.marta' }, s, k)).toBe(false);
    expect(evalStory({ failed: 'g01.piero' }, s, k)).toBe(false);
    expect(evalStory({ accepted: 'g01.marta' }, s, k)).toBe(true);
    expect(evalStory({ accepted: 'g02.gino' }, s, k)).toBe(true);
    expect(evalStory({ accepted: 'g01.piero' }, s, k)).toBe(false);
    expect(evalStory({ ignored: 'g01.piero' }, s, k)).toBe(true);
    expect(evalStory({ ignored: 'g02.teresa' }, s, k)).toBe(true);
    expect(evalStory({ ignored: 'g01.marta' }, s, k)).toBe(false);
    expect(evalStory({ reply: 'g01.gino', is: 'R2' }, s, k)).toBe(true);
    expect(evalStory({ reply: 'g01.gino', is: 'R1' }, s, k)).toBe(false);
    expect(evalStory({ reply: 'g02.teresa', is: 'R1' }, s, k)).toBe(true);
    expect(evalStory({ reply: 'g02.gino', is: 'R1' }, s, k)).toBe(false);
  });

  it("event: nell'ultima notte, con fili, personaggi e stranezza", () => {
    const s = emptyState({
      lastOutcome: outcomeWith([
        [{ k: 'incontro', a: 'teresa', b: 'marta', over: 'marta', pair: 0 }],
        [
          { k: 'nodo', a: 'marta', b: 'teresa' },
          { k: 'stranezza', quirk: 'teresaLegge', thread: 'teresa' },
        ],
      ]),
    });
    const k = emptyKnowledge();
    const c = (x: StoryCond): boolean => evalStory(x, s, k, { db: db() });
    expect(c({ event: 'nodo' })).toBe(true);
    expect(c({ event: 'nodo', a: 'teresa', b: 'marta' })).toBe(true);
    expect(c({ event: 'nodo', a: 'teresa', b: 'teresa' })).toBe(false);
    expect(c({ event: 'incontro', a: 'marta' })).toBe(true);
    expect(c({ event: 'incontro', b: 'piero' })).toBe(false);
    expect(c({ event: 'cura' })).toBe(false);
    expect(c({ event: 'stranezza', quirk: 'teresaLegge' })).toBe(true);
    expect(c({ event: 'stranezza', quirk: 'ninaCuriosa' })).toBe(false);
    expect(evalStory({ event: 'nodo' }, emptyState(), k)).toBe(false);
  });

  it('knows: stranezza, voce, desiderio, regola, archivio', () => {
    const s = emptyState();
    const k = emptyKnowledge({ quirks: ['martaNoSotto'], diary: ['libro.incrocio'], desires: ['nina'], rules: ['voce'], archive: { arc1: 'nuovo' } });
    expect(evalStory({ knows: 'quirk', id: 'martaNoSotto' }, s, k)).toBe(true);
    expect(evalStory({ knows: 'quirk', id: 'ginoCorre' }, s, k)).toBe(false);
    expect(evalStory({ knows: 'diary', id: 'libro.incrocio' }, s, k)).toBe(true);
    expect(evalStory({ knows: 'diary', id: 'x' }, s, k)).toBe(false);
    expect(evalStory({ knows: 'desire', id: 'nina' }, s, k)).toBe(true);
    expect(evalStory({ knows: 'desire', id: 'zeno' }, s, k)).toBe(false);
    expect(evalStory({ knows: 'rule', id: 'voce' }, s, k)).toBe(true);
    expect(evalStory({ knows: 'rule', id: 'febbre' }, s, k)).toBe(false);
    expect(evalStory({ knows: 'archive', id: 'arc1' }, s, k)).toBe(true);
    expect(evalStory({ knows: 'archive', id: 'arc2' }, s, k)).toBe(false);
  });

  it('memoria: gte, lte e valori iniziali prima di g12 (3, Lunardi 1)', () => {
    const s = emptyState({ memoria: { zeno: 0, teresa: 2 } });
    const k = emptyKnowledge();
    expect(evalStory({ memoria: 'zeno', gte: 1 }, s, k)).toBe(false);
    expect(evalStory({ memoria: 'zeno', lte: 0 }, s, k)).toBe(true);
    expect(evalStory({ memoria: 'teresa', gte: 2, lte: 2 }, s, k)).toBe(true);
    const fresh = emptyState();
    expect(memoriaOf(fresh, 'marta')).toBe(3);
    expect(memoriaOf(fresh, 'lunardi')).toBe(1);
    expect(evalStory({ memoria: 'lunardi', lte: 1 }, fresh, k)).toBe(true);
  });

  it('done: giornata chiusa, Archivio rammendato (non solo nominato)', () => {
    const s = emptyState({ history: { g00: day({ levelId: 'g00' }), fin_chiuso: day({ levelId: 'fin_chiuso' }) } });
    const k = emptyKnowledge({ archive: { arc1: 'rammendato', arc2: 'nominato' } });
    expect(evalStory({ done: 'g00' }, s, k)).toBe(true);
    expect(evalStory({ done: 'g01' }, s, k)).toBe(false);
    expect(evalStory({ done: 'fin_chiuso' }, s, k)).toBe(true);
    expect(evalStory({ done: 'arc1' }, s, k)).toBe(true);
    expect(evalStory({ done: 'arc2' }, s, k)).toBe(false);
  });

  it('all, any, not', () => {
    const s = emptyState({ flags: { a: true } });
    const k = emptyKnowledge();
    expect(evalStory({ all: [{ flag: 'a' }, { not: { flag: 'b' } }] }, s, k)).toBe(true);
    expect(evalStory({ all: [{ flag: 'a' }, { flag: 'b' }] }, s, k)).toBe(false);
    expect(evalStory({ any: [{ flag: 'b' }, { flag: 'a' }] }, s, k)).toBe(true);
    expect(evalStory({ any: [] }, s, k)).toBe(false);
    expect(evalStory({ all: [] }, s, k)).toBe(true);
    expect(evalStory({ not: { flag: 'a' } }, s, k)).toBe(false);
  });
});

describe('applyEffects: ogni variante', () => {
  it('setFlag, addFlag, diary (con domande), desire, question, memoria, unlock, object', () => {
    const s = emptyState({ flags: { n: 2 }, memoria: { zeno: 3, lunardi: 1 } });
    const k = emptyKnowledge();
    const log = applyEffects(
      [
        { setFlag: 'nina', value: 'parte' },
        { addFlag: 'n', by: 3 },
        { addFlag: 'nuovo', by: 1 },
        { diary: 'domande.avorio.apre' },
        { diary: 'domande.avorio.apre' },
        { desire: 'gino' },
        { desire: 'gino' },
        { question: 'pozzo', state: 'aperta' },
        { question: 'chiL', state: 'risolta' },
        { question: 'chiL', state: 'aperta' },
        { memoria: 'zeno', by: 1 },
        { memoria: 'lunardi', by: -3 },
        { memoria: 'marta', by: -1 },
        { unlock: 'archive', id: 'arc1' },
        { unlock: 'mode', id: 'daily' },
        { unlock: 'cosmetic', id: 'stile_1' },
        { object: 'fuso_faro' },
      ],
      s,
      k,
      { db: db() },
    );
    expect(s.flags['nina']).toBe('parte');
    expect(s.flags['n']).toBe(5);
    expect(s.flags['nuovo']).toBe(1);
    expect(k.diary).toEqual(['domande.avorio.apre']);
    expect(k.questions['avorio']).toBe('aperta');
    expect(k.desires).toEqual(['gino']);
    expect(k.questions['pozzo']).toBe('aperta');
    expect(k.questions['chiL']).toBe('risolta');
    expect(s.memoria['zeno']).toBe(3);
    expect(s.memoria['lunardi']).toBe(0);
    expect(s.memoria['marta']).toBe(2);
    expect(k.archive['arc1']).toBe('nuovo');
    expect(k.objects).toEqual(['fuso_faro']);
    expect(log.diary).toEqual(['domande.avorio.apre']);
    expect(log.desires).toEqual(['gino']);
    expect(log.unlocks.map((u) => u.kind)).toEqual(['archive', 'mode', 'cosmetic']);
    expect(log.memoria).toEqual([
      { character: 'zeno', before: 3, after: 3 },
      { character: 'lunardi', before: 1, after: 0 },
      { character: 'marta', before: 3, after: 2 },
    ]);
  });

  it('una voce che chiude una domanda la risolve', () => {
    const s = emptyState();
    const k = emptyKnowledge({ questions: { avorio: 'aperta' } });
    applyEffects([{ diary: 'domande.avorio.risposta' }], s, k, { db: db() });
    expect(k.questions['avorio']).toBe('risolta');
  });
});
