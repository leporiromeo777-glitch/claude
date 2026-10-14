/**
 * Selezione delle vignette dell'alba (GDD 5.9) con contenuti sintetici: priorità,
 * alternanza dei personaggi, regola dei 3 giorni (salvo priorità ≥ 80), massimo 3.
 * Più le candidate dei contenuti veri e le varianti per chi ha dimenticato Ada.
 */
import { describe, expect, it } from 'vitest';
import type { CharacterId, NightOutcome } from '../../../src/core/types';
import { buildDawn, dawnCandidates, resolveForgotten, selectDawn, type DawnCandidate } from '../../../src/campaign/dawn';
import type { VignetteView } from '../../../src/campaign/types';
import { db, emptyKnowledge, emptyState } from './helpers';

let order = 0;
function cand(id: string, who: CharacterId | null, priority: number, rank = 0): DawnCandidate {
  const view: VignetteView = {
    id,
    priority,
    background: 'dio/piazza/giorno',
    figures: who ? [{ character: who, pose: 'ferma', x: 0.5 }] : [],
    lines: [{ speaker: who ?? 'narratore', textKey: `t.${id}` }],
    who,
  };
  return { view, priority, rank, order: order++ };
}

const ids = (v: VignetteView[]): string[] => v.map((x) => x.id);

describe("selezione dell'alba", () => {
  it('ordina per priorità e ne prende al massimo 3', () => {
    const c = [cand('gen', 'gino', 10), cand('storia', 'marta', 100), cand('ok', 'teresa', 60), cand('ko', 'piero', 80), cand('quirk', 'nina', 50)];
    expect(ids(selectDawn(c, [], 5))).toEqual(['storia', 'ko', 'ok']);
  });

  it('a parità di priorità: prima le scritte, poi gli eventi, poi la riserva, poi l\'ordine', () => {
    const c = [cand('riserva', 'gino', 10, 2), cand('evento', 'nina', 10, 1), cand('scritta', 'zeno', 10, 0), cand('scritta2', 'bepi', 10, 0)];
    expect(ids(selectDawn(c, [], 5))).toEqual(['scritta', 'scritta2', 'evento']);
  });

  it('niente stesso personaggio due volte di seguito', () => {
    const c = [cand('a1', 'marta', 100), cand('a2', 'marta', 90), cand('b', 'teresa', 60), cand('a3', 'marta', 50)];
    expect(ids(selectDawn(c, [], 5))).toEqual(['a1', 'b', 'a3']);
  });

  it('la narrazione senza personaggio non blocca l\'alternanza', () => {
    const c = [cand('n1', null, 100), cand('n2', null, 90), cand('m', 'marta', 60)];
    expect(ids(selectDawn(c, [], 5))).toEqual(['n1', 'n2', 'm']);
  });

  it('regola dei 3 giorni: scartate le già mostrate, salvo priorità ≥ 80', () => {
    const c = [cand('vecchia', 'gino', 60), cand('importante', 'marta', 80), cand('nuova', 'nina', 10), cand('lontana', 'zeno', 10)];
    const shown = [
      { id: 'vecchia', day: 4 },
      { id: 'importante', day: 5 },
      { id: 'lontana', day: 1 },
    ];
    expect(ids(selectDawn(c, shown, 6))).toEqual(['importante', 'nuova', 'lontana']);
    // Quattro giorni dopo torna disponibile.
    expect(ids(selectDawn(c, shown, 8))).toEqual(['importante', 'vecchia', 'nuova']);
  });

  it('nessuna candidata: alba vuota', () => {
    expect(selectDawn([], [], 3)).toEqual([]);
  });
});

describe('alba con i contenuti veri', () => {
  it('il prologo mostra le tre vignette del GDD 9', () => {
    const level = db().levels.get('g00');
    if (!level) throw new Error('g00');
    const v = buildDawn({ level, outcome: null, state: emptyState(), knowledge: emptyKnowledge(), db: db() }, 0);
    expect(ids(v)).toEqual(['g00.alba.marta', 'g00.alba.teresa', 'g00.alba.piero']);
  });

  it('le vignette con when seguono gli esiti, e le battute seguono gli eventi della notte', () => {
    const level = db().levels.get('g01');
    if (!level) throw new Error('g01');
    const state = emptyState({
      dayIndex: 1,
      history: {
        g01: { levelId: 'g01', rows: [], requests: [{ noteId: 'g01.marta', status: 'fallita' }], metrics: { incroci: 0, minIncroci: null, quiete: 0, simmetria: false, filoDOro: false }, spartito: '', at: '' },
      },
    });
    const outcome: NightOutcome = {
      origin: 'campagna', levelId: 'g01', rows: [], timeline: [{ hour: 6, pos: [...level.initial], offboard: [], holders: {}, delivered: [], knotted: [], pozzo: { secrets: 0, overflowing: false }, usedMatassa: 0, met: [], metOver: [] }],
      events: [[{ k: 'incontro', a: 'gino', b: 'marta', over: 'gino', pair: 0 }]], goals: [], requests: [], dropped: [],
      metrics: { incroci: 1, minIncroci: null, quiete: 0, simmetria: false, filoDOro: false }, spartito: '', hintsUsed: 0, fantasmaUsed: false, discoveredQuirks: [], nomeOn: null,
    };
    const cands = dawnCandidates({ level, outcome, state, knowledge: emptyKnowledge(), db: db() });
    const all = cands.map((c) => c.view.id);
    expect(all).toContain('g01.alba.bagnato');
    expect(all).not.toContain('g01.alba.brava');
    expect(all).toContain('line:gino.incontro.1');
    expect(all).toContain('line:marta.incontro.1');
    expect(all.some((x) => x.startsWith('line:') && x.includes('riserva'))).toBe(true);
    // Le battute generiche non entrano finché ci sono vignette scritte più importanti.
    const pick = selectDawn(cands, [], 1);
    expect(pick[0]?.id).toBe('g01.alba.bambina');
    expect(pick.length).toBe(3);
  });

  it('chi ha dimenticato Ada: variante del testo e Ada di legno grezzo', () => {
    const v: VignetteView = {
      id: 'x', priority: 60, background: 'dio/farmacia/giorno',
      figures: [{ character: 'ada', pose: 'ferma', x: 0.3 }, { character: 'lunardi', pose: 'porge', x: 0.7 }],
      lines: [{ speaker: 'lunardi', textKey: 'a', forgetKey: 'a.d' }, { speaker: 'narratore', textKey: 'b', forgetKey: 'b.d' }],
    };
    const forgot = resolveForgotten(v, emptyState({ memoria: { lunardi: 0 } }));
    expect(forgot.grezza).toBe(true);
    expect(forgot.lines.map((l) => l.textKey)).toEqual(['a.d', 'b']);
    const remembers = resolveForgotten(v, emptyState({ memoria: { lunardi: 2 } }));
    expect(remembers.grezza).toBe(false);
    expect(remembers.lines.map((l) => l.textKey)).toEqual(['a', 'b']);
  });
});
