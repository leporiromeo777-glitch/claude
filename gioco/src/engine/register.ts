/**
 * Registrazione del pacchetto motore: API di debug `__GAME__.engine` (ARCHITETTURA 15.1).
 *
 *   level(id)                       LevelDef dei contenuti (o generato/fixture già caricato), null se manca
 *   solve(levelId, noteIds?, opts?) SolveResult con obiettivi + richieste dei bigliettini indicati;
 *                                   opts.nomeOn = filo del nome di Ada; se manca e le condizioni nominano
 *                                   `nome` (regola 'nome'), si prova ogni filo presente e il risultato
 *                                   porta anche `nomeOn` (la scelta migliore, come in levels:check)
 *   computed(levelId)               LevelComputed dei contenuti, null se manca
 *   daily(date)                     GenResult del Merletto del giorno (AAAA-MM-GG)
 *   generate(spec)                  GenResult per una GenSpec
 *   encode(spartito) / decode(str)  spartito
 *   fixture(name)                   carica un livello di prova da src/engine/fixtures (Promise)
 *   version()                       versioni di solver e generatore
 */
import type { Condition, FlagId, FlagValue, LevelDef, LevelId, NoteDef, NoteId, Services, SolveResult, ThreadId } from '../core/types';
import { createContext } from './context';
import { mentionsNome } from './conditions';
import { initialState } from './state';
import { solve, SOLVER_VERSION } from './solver';
import type { GenResult, GenSpec } from './generator';
import { GENERATOR_VERSION, generate } from './generator';
import { dailySpec } from './daily';
import type { Spartito } from './spartito';
import { decodeSpartito, encodeSpartito } from './spartito';

const fixtureFiles = import.meta.glob('./fixtures/*.json', { import: 'default' });

export interface DebugSolveOptions {
  flags?: Record<FlagId, FlagValue>;
  objective?: 'minIncroci' | 'maxQuiete';
  matassa?: number;
  countOptimal?: boolean;
  maxStates?: number;
  /** Filo su cui è appuntato il nome di Ada (GDD 3.11); null = nessuno. Se manca, vedi sopra. */
  nomeOn?: ThreadId | null;
}

export function register(s: Services): void {
  const extra = new Map<LevelId, LevelDef>();
  const extraNotes = new Map<NoteId, NoteDef>();
  const levelOf = (id: LevelId): LevelDef | null => s.content.levels.get(id) ?? extra.get(id) ?? null;
  const noteOf = (id: NoteId): NoteDef | undefined => s.content.notes.get(id) ?? extraNotes.get(id);

  const remember = (r: GenResult): GenResult => {
    extra.set(r.level.id, r.level);
    return r;
  };

  s.debug.register('engine', {
    level: (id: string): LevelDef | null => levelOf(id),
    solve: (levelId: string, noteIds?: NoteId[], opts?: DebugSolveOptions): SolveResult | null => {
      const level = levelOf(levelId);
      if (!level) return null;
      const goals: Condition[] = [...(level.goals ?? [])];
      for (const id of noteIds ?? []) {
        const r = noteOf(id)?.request;
        if (r) goals.push(r);
      }
      const run = (nomeOn: ThreadId | null): SolveResult =>
        solve({
          level,
          ctx: createContext(level, opts?.flags ?? {}, { balance: s.content.balance, nomeOn }),
          goals,
          objective: opts?.objective,
          matassa: opts?.matassa,
          countOptimal: opts?.countOptimal ?? true,
          maxStates: opts?.maxStates,
        });
      if (opts?.nomeOn !== undefined || !level.rules.includes('nome') || !goals.some(mentionsNome)) return run(opts?.nomeOn ?? null);
      // Il nome si appunta su un filo presente all'apertura: si prova ognuno e vale il migliore.
      const pos = initialState(level, createContext(level, opts?.flags ?? {}, { balance: s.content.balance })).pos;
      let best: (SolveResult & { nomeOn: ThreadId }) | null = null;
      let last: SolveResult | null = null;
      for (const t of new Set(pos)) {
        const r = run(t);
        last = r;
        if (r.status !== 'ok') continue;
        const better =
          !best ||
          (opts?.objective === 'maxQuiete' ? (r.quiete ?? -1) > (best.quiete ?? -1) : (r.incroci ?? Infinity) < (best.incroci ?? Infinity));
        if (better) best = { ...r, nomeOn: t };
      }
      return best ?? last;
    },
    computed: (levelId: string) => s.content.computed.get(levelId) ?? null,
    daily: (date: string): GenResult => remember(generate(dailySpec(date))),
    generate: (spec: GenSpec): GenResult => remember(generate(spec)),
    encode: (sp: Spartito): string => encodeSpartito(sp),
    decode: (str: string): Spartito | null => decodeSpartito(str),
    fixture: async (name: string): Promise<LevelDef | null> => {
      const notesLoader = fixtureFiles['./fixtures/notes.fixtures.json'];
      if (notesLoader && extraNotes.size === 0) {
        const notes = (await notesLoader()) as NoteDef[];
        for (const n of notes) extraNotes.set(n.id, n);
      }
      const load = fixtureFiles[`./fixtures/${name}.json`];
      if (!load) return null;
      const lv = (await load()) as LevelDef;
      if (!lv || typeof lv !== 'object' || !('columns' in lv)) return null;
      extra.set(lv.id, lv);
      return lv;
    },
    version: () => ({ solver: SOLVER_VERSION, generator: GENERATOR_VERSION }),
  });
}
