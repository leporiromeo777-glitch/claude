/**
 * Casi tabellari delle regole (GDD 3.4-3.11): per ogni riga delle tabelle del
 * GDD, stato prima, incroci, stato atteso, eventi attesi.
 */
import { describe, expect, it } from 'vitest';
import type { Crossing, FlagValue, LaceState, LevelDef, QuirkId, RowResult } from '../../../src/core/types';
import { applyRow, createContext, initialState, memoriaAfterDay } from '../../../src/engine/index';
import { F, L, N, S, V, ev, mk } from './helpers';

const c = (pair: number, over: 'L' | 'R'): Crossing => ({ pair, over });

interface Expect {
  ok?: boolean;
  pos?: string[];
  holders?: Record<string, string[]>;
  delivered?: string[];
  knotted?: string[];
  offboard?: string[];
  events?: string[];
  noEvents?: string[];
  violations?: string[];
  quirk?: QuirkId;
  pozzo?: { secrets: number; overflowing: boolean };
  usedMatassa?: number;
  unchanged?: boolean;
}

interface Case {
  name: string;
  level: LevelDef;
  flags?: Record<string, FlagValue>;
  nomeOn?: string;
  setup?: Crossing[][];
  state?: (s: LaceState) => LaceState;
  draft: Crossing[];
  expect: Expect;
  check?: (r: RowResult, before: LaceState) => void;
}

const nero = (follow: string[], hour = 6, side: 'molo' | 'faro' = 'faro'): Partial<LevelDef> => ({
  rules: ['incrocio', 'nero'],
  nero: { thread: 'livia', enter: { hour, side }, agenda: follow.map((f) => ({ follow: f })) },
});

const CASES: Case[] = [
  // ───── 3.4 Ordine di risoluzione ─────
  {
    name: '3.4.1 blocchi: un filo annodato non incrocia nella riga dopo',
    level: mk({ initial: ['gino', 'marta', 'piero'] }),
    state: (s) => ({ ...s, knotted: ['marta'] }),
    draft: [c(0, 'L')],
    expect: { ok: false, violations: ['bloccato'], unchanged: true },
  },
  {
    name: '3.4.1 blocchi: un filo in una colonna allagata non incrocia',
    level: mk({ initial: ['bepi', 'nina', 'marta'], tide: [{ from: 7, to: 7, places: ['forno'] }] }),
    draft: [c(0, 'L')],
    expect: { ok: false, violations: ['bloccato'] },
  },
  {
    name: '3.4.1 coppie adiacenti nella stessa riga: rifiutate (disgiunto)',
    level: mk({ initial: ['nina', 'marta', 'piero'] }),
    draft: [c(0, 'L'), c(1, 'L')],
    expect: { ok: false, violations: ['disgiunto'] },
  },
  {
    name: '3.4.2 incroci forzati: la coppia del filo nero è occupata',
    level: mk({ initial: ['nina', 'marta', 'zeno', 'livia'], kinds: { livia: 'nero' }, ...nero(['zeno']) }),
    draft: [c(1, 'L')],
    expect: { ok: false, violations: ['occupato'] },
  },
  {
    name: '3.4.2 incroci forzati: il giocatore non rovescia l\'incrocio del filo nero',
    level: mk({ initial: ['nina', 'marta', 'zeno', 'livia'], kinds: { livia: 'nero' }, ...nero(['zeno']) }),
    draft: [c(2, 'L')],
    expect: { ok: false, violations: ['forzato'] },
  },
  {
    name: '3.4.2 incroci forzati: ripetere l\'incrocio annunciato non cambia nulla',
    level: mk({ initial: ['nina', 'marta', 'zeno', 'livia'], kinds: { livia: 'nero' }, ...nero(['zeno']) }),
    draft: [c(2, 'R')],
    expect: { ok: true, pos: ['nina', 'marta', 'livia', 'zeno'], usedMatassa: 0 },
  },
  {
    name: '3.4.3 validità: matassa finita, la riga non si fissa',
    level: mk({ initial: ['nina', 'marta', 'piero'], matassa: 1 }),
    state: (s) => ({ ...s, usedMatassa: 1 }),
    draft: [c(0, 'L')],
    expect: { ok: false, violations: ['matassa'], unchanged: true },
  },
  {
    name: '3.4.3 validità: spillo d\'ottone di quest\'ora non rispettato',
    level: mk({ initial: ['nina', 'marta', 'piero'], pins: [{ thread: 'marta', place: 'molo', hour: 7 }] }),
    draft: [],
    expect: { ok: false, violations: ['spillo'] },
  },
  {
    name: '3.4.3 validità: lo spillo si controlla dopo lo scambio',
    level: mk({ initial: ['nina', 'marta', 'piero'], pins: [{ thread: 'marta', place: 'molo', hour: 7 }] }),
    draft: [c(0, 'R')],
    expect: { ok: true, pos: ['marta', 'nina', 'piero'] },
  },
  {
    name: '3.4.3 validità: prima lo spillo, poi Gino',
    level: mk({ initial: ['gino', 'marta', 'piero'], quirks: ['ginoCorre'], pins: [{ thread: 'piero', place: 'molo', hour: 9 }, { thread: 'marta', place: 'molo', hour: 7 }] }),
    draft: [],
    expect: { ok: false, violations: ['spillo', 'corre'] },
  },
  {
    name: '3.4.5 scambio: i due fili si scambiano di colonna',
    level: mk({ initial: ['nina', 'marta', 'piero'] }),
    draft: [c(1, 'L')],
    expect: { ok: true, pos: ['nina', 'piero', 'marta'], events: ['incontro:marta'] },
  },
  {
    name: '3.4.6 bordi dopo lo scambio: chi arriva al Molo con l\'incrocio esce',
    level: mk({ initial: ['nina', 'bepi', 'marta'], extra: ['lino1'], edges: [{ hour: 7, side: 'molo', kind: 'barca' }] }),
    draft: [c(0, 'L')],
    expect: { ok: true, pos: ['lino1', 'nina', 'marta'], offboard: ['bepi'], events: ['esce:bepi', 'entra:lino1'] },
  },
  {
    name: '3.4.7 fine riga: Teresa legge la lettera appena ricevuta',
    level: mk({ initial: ['nina', 'teresa', 'piero'], quirks: ['teresaLegge'], beads: [L('L1', 'nina', 'piero')] }),
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { L1: ['teresa'], 'letta:L1': ['teresa'] }, events: ['passa:L1:nina>teresa', 'legge:L1:teresa'] },
  },
  {
    name: '3.4.8 annuncio: entrato il filo nero, la sua mossa della riga dopo è annunciata',
    level: mk({ initial: ['nina', 'marta', 'lino1'], extra: ['livia'], kinds: { livia: 'nero' }, ...nero(['nina'], 7) }),
    draft: [],
    expect: { ok: true, pos: ['nina', 'marta', 'livia'], offboard: ['lino1'], events: ['esce:lino1', 'entra:livia', 'nero:livia:1'] },
  },

  // ───── 3.5 Perline ─────
  {
    name: '3.5 lettera: chi sta sopra dà',
    level: mk({ initial: ['teresa', 'nina', 'piero'], beads: [L('L1', 'teresa', 'piero')] }),
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { L1: ['nina'] }, events: ['passa:L1:teresa>nina'], delivered: [] },
  },
  {
    name: '3.5 lettera: chi sta sotto non dà',
    level: mk({ initial: ['teresa', 'nina', 'piero'], beads: [L('L1', 'teresa', 'piero')] }),
    draft: [c(0, 'R')],
    expect: { ok: true, holders: { L1: ['teresa'] }, noEvents: ['passa:L1:teresa>nina'] },
  },
  {
    name: '3.5 lettera: al destinatario è consegnata',
    level: mk({ initial: ['teresa', 'piero', 'nina'], beads: [L('L1', 'teresa', 'piero')] }),
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { L1: ['piero'] }, delivered: ['L1'], events: ['consegna:L1>piero'] },
  },
  {
    name: '3.5 lettera: consegnata resta bloccata al destinatario',
    level: mk({ initial: ['teresa', 'piero', 'nina'], beads: [L('L1', 'teresa', 'piero')] }),
    setup: [[c(0, 'L')]],
    draft: [c(0, 'L')],
    expect: { ok: true, pos: ['teresa', 'piero', 'nina'], holders: { L1: ['piero'] }, delivered: ['L1'], noEvents: ['passa:L1:piero>teresa'] },
  },
  {
    name: '3.5 lettera: già in mano al destinatario all\'apertura è consegnata',
    level: mk({ initial: ['piero', 'nina'], beads: [L('L1', 'piero', 'piero')] }),
    draft: [c(0, 'L')],
    expect: { ok: true, delivered: ['L1'], holders: { L1: ['piero'] } },
  },
  {
    name: '3.5 voce: da sopra a sotto',
    level: mk({ initial: ['nina', 'marta'], beads: [V('voce:x', ['nina'])] }),
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { 'voce:x': ['nina', 'marta'] }, events: ['copia:voce:x:nina>marta'] },
  },
  {
    name: '3.5 voce: anche da sotto a sopra («La voce non ha verso»)',
    level: mk({ initial: ['nina', 'marta'], beads: [V('voce:x', ['nina'])] }),
    draft: [c(0, 'R')],
    expect: { ok: true, holders: { 'voce:x': ['nina', 'marta'] }, events: ['copia:voce:x:nina>marta'] },
  },
  {
    name: '3.5 voce: alla fine tutti e due hanno le voci di tutti e due',
    level: mk({ initial: ['nina', 'marta'], beads: [V('voce:a', ['nina']), V('voce:b', ['marta'])] }),
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { 'voce:a': ['nina', 'marta'], 'voce:b': ['nina', 'marta'] } },
  },
  {
    name: '3.5 segreto: scende soltanto, e chi lo dà lo tiene',
    level: mk({ initial: ['nina', 'marta'], beads: [S('segreto:x', ['nina'])] }),
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { 'segreto:x': ['nina', 'marta'] } },
  },
  {
    name: '3.5 segreto: non sale da sotto a sopra',
    level: mk({ initial: ['nina', 'marta'], beads: [S('segreto:x', ['marta'])] }),
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { 'segreto:x': ['marta'] }, noEvents: ['copia:segreto:x:marta>nina'] },
  },
  {
    name: '3.5 febbre: il malato sopra contagia',
    level: mk({ initial: ['nina', 'marta'], beads: [F(['nina'])] }),
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { febbre: ['nina', 'marta'] }, events: ['contagio:nina>marta'] },
  },
  {
    name: '3.5 febbre: anche il malato sotto contagia («La febbre non chiede permesso»)',
    level: mk({ initial: ['nina', 'marta'], beads: [F(['marta'])] }),
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { febbre: ['nina', 'marta'] }, events: ['contagio:marta>nina'] },
  },
  {
    name: '3.5 nome: come la voce, anche da sotto',
    level: mk({ initial: ['nina', 'marta'], beads: [N(['marta'])] }),
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { nome: ['nina', 'marta'] } },
  },
  {
    name: '3.5 pozzo: la lettera ricevuta resta custodita, da sopra non la dà',
    level: mk({ initial: ['teresa', 'piero', 'nina'], quirks: ['pieroPozzo'], beads: [L('L1', 'teresa', 'nina')] }),
    setup: [[c(0, 'L')]],
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { L1: ['piero'] }, delivered: [], events: ['stranezza:pieroPozzo'] },
  },
  {
    name: '3.5 pozzo: non dà voci da sopra',
    level: mk({ initial: ['piero', 'marta'], quirks: ['pieroPozzo'], beads: [V('voce:x', ['piero'])] }),
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { 'voce:x': ['piero'] }, events: ['stranezza:pieroPozzo'] },
  },
  {
    name: '3.5 pozzo: non dà voci nemmeno da sotto',
    level: mk({ initial: ['piero', 'marta'], quirks: ['pieroPozzo'], beads: [V('voce:x', ['piero'])] }),
    draft: [c(0, 'R')],
    expect: { ok: true, holders: { 'voce:x': ['piero'] } },
  },
  {
    name: '3.5 pozzo: riceve le voci di tutti',
    level: mk({ initial: ['piero', 'marta'], quirks: ['pieroPozzo'], beads: [V('voce:x', ['marta'])] }),
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { 'voce:x': ['piero', 'marta'] } },
  },
  {
    name: '3.5 pozzo: non dà segreti',
    level: mk({ initial: ['piero', 'marta'], quirks: ['pieroPozzo'], beads: [S('segreto:x', ['piero'])] }),
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { 'segreto:x': ['piero'] } },
  },
  {
    name: '3.5 pozzo: non dà il nome di Ada',
    level: mk({ initial: ['piero', 'marta'], quirks: ['pieroPozzo'], beads: [N(['piero'])] }),
    draft: [c(0, 'R')],
    expect: { ok: true, holders: { nome: ['piero'] } },
  },
  {
    name: '3.5 pozzo: la febbre invece passa anche da lui',
    level: mk({ initial: ['piero', 'marta'], quirks: ['pieroPozzo'], beads: [F(['piero'])] }),
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { febbre: ['piero', 'marta'] } },
  },
  {
    name: '3.5 lino: non riceve lettere',
    level: mk({ initial: ['teresa', 'lino1', 'nina'], beads: [L('L1', 'teresa', 'nina')] }),
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { L1: ['teresa'] } },
  },
  {
    name: '3.5 lino: non riceve segreti',
    level: mk({ initial: ['teresa', 'lino1'], beads: [S('segreto:x', ['teresa'])] }),
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { 'segreto:x': ['teresa'] } },
  },
  {
    name: '3.5 lino: prende e passa le voci',
    level: mk({ initial: ['teresa', 'lino1'], beads: [V('voce:x', ['lino1'])] }),
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { 'voce:x': ['teresa', 'lino1'] } },
  },
  {
    name: '3.5 lino: prende la febbre e il nome',
    level: mk({ initial: ['teresa', 'lino1'], beads: [F(['teresa']), N(['teresa'])] }),
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { febbre: ['teresa', 'lino1'], nome: ['teresa', 'lino1'] } },
  },
  {
    name: '3.5 lino: se entra con una lettera la può consegnare',
    level: mk({ initial: ['lino1', 'nina'], beads: [L('L1', 'lino1', 'nina')] }),
    draft: [c(0, 'L')],
    expect: { ok: true, delivered: ['L1'], holders: { L1: ['nina'] } },
  },
  {
    name: '3.5 letta: il segreto di lettura scende come gli altri',
    level: mk({ initial: ['teresa', 'nina', 'marta'], quirks: ['teresaLegge'], beads: [L('L1', 'teresa', 'marta')] }),
    setup: [[]],
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { 'letta:L1': ['teresa', 'nina'], L1: ['nina'] } },
  },
  {
    name: '3.5 le perline non si consumano: la voce resta a tutti',
    level: mk({ initial: ['nina', 'marta', 'piero'], beads: [V('voce:x', ['nina'])] }),
    setup: [[c(0, 'L')]],
    draft: [c(1, 'L')],
    expect: { ok: true, holders: { 'voce:x': ['nina', 'marta', 'piero'] } },
  },

  // ───── 3.6 Stranezze ─────
  {
    name: '3.6 martaNoSotto: Marta sotto Teresa è rifiutato («No.»)',
    level: mk({ initial: ['teresa', 'marta'], quirks: ['martaNoSotto'] }),
    draft: [c(0, 'L')],
    expect: { ok: false, violations: ['rifiuto'], quirk: 'martaNoSotto' },
  },
  {
    name: '3.6 martaNoSotto: Marta sopra Teresa va bene',
    level: mk({ initial: ['teresa', 'marta'], quirks: ['martaNoSotto'] }),
    draft: [c(0, 'R')],
    expect: { ok: true, pos: ['marta', 'teresa'] },
  },
  {
    name: '3.6 martaNoSotto: tolto dalla riconciliazione',
    level: mk({ initial: ['teresa', 'marta'], quirks: ['martaNoSotto'] }),
    flags: { riconciliate: true },
    draft: [c(0, 'L')],
    expect: { ok: true, pos: ['marta', 'teresa'] },
  },
  {
    name: '3.6 teresaLegge: a fine riga legge la lettera in viaggio che tiene',
    level: mk({ initial: ['teresa', 'nina'], quirks: ['teresaLegge'], beads: [L('L1', 'teresa', 'nina')] }),
    draft: [],
    expect: { ok: true, holders: { 'letta:L1': ['teresa'] }, events: ['legge:L1:teresa', 'stranezza:teresaLegge'] },
  },
  {
    name: '3.6 teresaLegge: non legge le lettere indirizzate a lei',
    level: mk({ initial: ['nina', 'teresa'], quirks: ['teresaLegge'], beads: [L('L1', 'nina', 'teresa')] }),
    draft: [c(0, 'L')],
    expect: { ok: true, delivered: ['L1'], noEvents: ['legge:L1:teresa'] },
  },
  {
    name: '3.6 teresaLegge: tolto dalla riconciliazione',
    level: mk({ initial: ['teresa', 'nina'], quirks: ['teresaLegge'], beads: [L('L1', 'teresa', 'nina')] }),
    flags: { riconciliate: true },
    draft: [],
    expect: { ok: true, noEvents: ['legge:L1:teresa'] },
    check: (r) => expect(r.state.holders['letta:L1'] ?? []).toEqual([]),
  },
  {
    name: '3.6 pieroTrabocca: con 3 segreti a fine riga il pozzo trabocca',
    level: mk({ initial: ['nina', 'piero'], quirks: ['pieroPozzo', 'pieroTrabocca'], beads: [S('s1', ['nina']), S('s2', ['nina']), S('s3', ['nina'])] }),
    draft: [c(0, 'L')],
    expect: { ok: true, pozzo: { secrets: 3, overflowing: true }, events: ['trabocca:piero', 'stranezza:pieroTrabocca'] },
  },
  {
    name: '3.6 pieroTrabocca: con 2 segreti non trabocca',
    level: mk({ initial: ['nina', 'piero'], quirks: ['pieroPozzo', 'pieroTrabocca'], beads: [S('s1', ['nina']), S('s2', ['nina'])] }),
    draft: [c(0, 'L')],
    expect: { ok: true, pozzo: { secrets: 2, overflowing: false }, noEvents: ['trabocca:piero'] },
  },
  {
    name: '3.6 pieroTrabocca: al prossimo incrocio da sopra dà tutto, lettere comprese, poi riparte da zero',
    level: mk({
      initial: ['zeno', 'nina', 'piero'],
      quirks: ['pieroPozzo', 'pieroTrabocca'],
      beads: [S('s1', ['nina']), S('s2', ['nina']), S('s3', ['nina']), L('L1', 'piero', 'zeno')],
    }),
    setup: [[c(1, 'L')]],
    draft: [c(0, 'R')],
    expect: {
      ok: true,
      pos: ['piero', 'zeno', 'nina'],
      delivered: ['L1'],
      holders: { L1: ['zeno'], s1: ['zeno', 'nina', 'piero'] },
      pozzo: { secrets: 0, overflowing: false },
      events: ['passa:L1:piero>zeno', 'consegna:L1>zeno', 'copia:s1:piero>zeno'],
    },
  },
  {
    name: '3.6 ginoCorre: se può incrociare deve farlo («Gino non sta fermo!»)',
    level: mk({ initial: ['gino', 'marta', 'piero'], quirks: ['ginoCorre'] }),
    draft: [],
    expect: { ok: false, violations: ['corre'], quirk: 'ginoCorre' },
  },
  {
    name: '3.6 ginoCorre: anche con un solo vicino libero',
    level: mk({ initial: ['marta', 'gino', 'piero'], quirks: ['ginoCorre'] }),
    state: (s) => ({ ...s, knotted: ['marta'] }),
    draft: [],
    expect: { ok: false, violations: ['corre'] },
  },
  {
    name: '3.6 ginoCorre: anche se il giocatore usa il suo unico vicino in un altro incrocio',
    level: mk({ initial: ['gino', 'marta', 'piero'], quirks: ['ginoCorre'] }),
    draft: [c(1, 'L')],
    expect: { ok: false, violations: ['corre'] },
  },
  {
    name: '3.6 ginoCorre: bloccato da un nodo non deve correre',
    level: mk({ initial: ['gino', 'marta', 'piero'], quirks: ['ginoCorre'] }),
    state: (s) => ({ ...s, knotted: ['gino'] }),
    draft: [],
    expect: { ok: true },
  },
  {
    name: '3.6 ginoCorre: con tutti e due i vicini bloccati non deve correre',
    level: mk({ initial: ['marta', 'gino', 'piero'], quirks: ['ginoCorre'] }),
    state: (s) => ({ ...s, knotted: ['marta', 'piero'] }),
    draft: [],
    expect: { ok: true },
  },
  {
    name: '3.6 ginoCorre: l\'incrocio forzato del filo nero vale',
    level: mk({ initial: ['livia', 'gino', 'marta'], kinds: { livia: 'nero' }, quirks: ['ginoCorre'], ...nero(['marta']) }),
    draft: [],
    expect: { ok: true, pos: ['gino', 'livia', 'marta'] },
  },
  {
    name: '3.6 ginoCorre: la matassa finita non lo ferma (la riga non si fissa: si disfa)',
    level: mk({ initial: ['gino', 'marta', 'piero'], quirks: ['ginoCorre'], matassa: 2 }),
    state: (s) => ({ ...s, usedMatassa: 2 }),
    draft: [],
    expect: { ok: false, violations: ['corre'] },
  },
  {
    name: '3.6 ginoCorre: incrociando va bene',
    level: mk({ initial: ['gino', 'marta', 'piero'], quirks: ['ginoCorre'] }),
    draft: [c(0, 'L')],
    expect: { ok: true, pos: ['marta', 'gino', 'piero'] },
  },
  {
    name: '3.6 ninaCuriosa: da sopra prende anche i segreti di chi sta sotto',
    level: mk({ initial: ['nina', 'marta'], quirks: ['ninaCuriosa'], beads: [S('segreto:x', ['marta'])] }),
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { 'segreto:x': ['nina', 'marta'] }, events: ['copia:segreto:x:marta>nina', 'stranezza:ninaCuriosa'] },
  },
  {
    name: '3.6 ninaCuriosa: non dal pozzo',
    level: mk({ initial: ['nina', 'piero'], quirks: ['ninaCuriosa', 'pieroPozzo'], beads: [S('segreto:x', ['piero'])] }),
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { 'segreto:x': ['piero'] } },
  },
  {
    name: '3.6 ninaCuriosa: da sotto è una ragazza come le altre',
    level: mk({ initial: ['marta', 'nina'], quirks: ['ninaCuriosa'], beads: [S('segreto:x', ['nina'])] }),
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { 'segreto:x': ['nina'] } },
  },
  {
    name: '3.6 zenoFaro: un incrocio che lo porta a più di 2 colonne dal Faro è rifiutato',
    level: mk({ initial: ['marta', 'nina', 'bepi', 'zeno', 'teresa', 'piero'], quirks: ['zenoFaro'] }),
    draft: [c(2, 'L')],
    expect: { ok: false, violations: ['faro'], quirk: 'zenoFaro' },
  },
  {
    name: '3.6 zenoFaro: entro 2 colonne si muove',
    level: mk({ initial: ['marta', 'nina', 'bepi', 'zeno', 'teresa', 'piero'], quirks: ['zenoFaro'] }),
    draft: [c(3, 'L')],
    expect: { ok: true, pos: ['marta', 'nina', 'bepi', 'teresa', 'zeno', 'piero'] },
  },
  {
    name: '3.6 zenoFaro: senza il Faro vale l\'ultima colonna',
    level: mk({ initial: ['marta', 'zeno', 'nina', 'bepi'], columns: ['molo', 'forno', 'piazza', 'chiesa'], quirks: ['zenoFaro'] }),
    draft: [c(0, 'R')],
    expect: { ok: false, violations: ['faro'] },
  },
  {
    name: '3.6 lunardiCura: sopra a un malato lo cura (la cura vince sul contagio)',
    level: mk({ initial: ['lunardi', 'gino'], quirks: ['lunardiCura'], beads: [F(['gino'])] }),
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { febbre: [] }, events: ['cura:gino<lunardi', 'stranezza:lunardiCura'], noEvents: ['contagio:gino>lunardi'] },
  },
  {
    name: '3.6 lunardiCura: sotto non cura e non si ammala',
    level: mk({ initial: ['lunardi', 'gino'], quirks: ['lunardiCura'], beads: [F(['gino'])] }),
    draft: [c(0, 'R')],
    expect: { ok: true, holders: { febbre: ['gino'] }, noEvents: ['contagio:gino>lunardi', 'cura:gino<lunardi'] },
  },
  {
    name: '3.6 lunardiCura: Lunardi non è mai malato, nemmeno all\'apertura',
    level: mk({ initial: ['lunardi', 'gino', 'nina'], quirks: ['lunardiCura'], beads: [F(['lunardi', 'gino'])] }),
    draft: [],
    expect: { ok: true, holders: { febbre: ['gino'] } },
  },

  // ───── 3.7 Matassa ─────
  {
    name: '3.7 matassa: ogni incrocio del giocatore costa un braccio',
    level: mk({ initial: ['nina', 'marta', 'piero', 'bepi'] }),
    draft: [c(0, 'L'), c(2, 'R')],
    expect: { ok: true, usedMatassa: 2, pos: ['marta', 'nina', 'bepi', 'piero'] },
  },

  // ───── 3.8 Bordi, rancore, marea ─────
  {
    name: '3.8 Molo: chi è al Molo esce con le sue perline, chi arriva entra con le sue',
    level: mk({
      initial: ['bepi', 'nina', 'marta'],
      extra: ['marinaio'],
      edges: [{ hour: 7, side: 'molo', kind: 'vaporetto', enters: 'marinaio' }],
      beads: [L('L1', 'marinaio', 'nina'), V('voce:rete', ['bepi'])],
    }),
    draft: [],
    expect: { ok: true, pos: ['marinaio', 'nina', 'marta'], offboard: ['bepi'], holders: { L1: ['marinaio'], 'voce:rete': ['bepi'] }, events: ['esce:bepi', 'entra:marinaio'] },
  },
  {
    name: '3.8 Faro: il bordo del Faro è l\'ultima colonna',
    level: mk({ initial: ['nina', 'marta', 'zeno'], extra: ['lino1'], edges: [{ hour: 7, side: 'faro', kind: 'secca' }] }),
    draft: [],
    expect: { ok: true, pos: ['nina', 'marta', 'lino1'], offboard: ['zeno'] },
  },
  {
    name: '3.8 bordo senza nome: entra un nuovo filo di lino',
    level: mk({ initial: ['nina', 'marta'], edges: [{ hour: 7, side: 'molo', kind: 'barca' }] }),
    draft: [],
    expect: { ok: true, pos: ['lino1', 'marta'], offboard: ['nina'] },
  },
  {
    name: '3.8 bordo: un evento lo fa rientrare per nome',
    level: mk({
      initial: ['bepi', 'nina', 'marta'],
      extra: ['lino1'],
      edges: [
        { hour: 7, side: 'molo', kind: 'barca' },
        { hour: 8, side: 'molo', kind: 'barca', enters: 'bepi' },
      ],
    }),
    setup: [[]],
    draft: [],
    expect: { ok: true, pos: ['bepi', 'nina', 'marta'], offboard: ['lino1'] },
  },
  {
    name: '3.8 rancore: nessun passaggio, un nodo, tutti e due bloccati nella riga dopo',
    level: mk({ initial: ['nina', 'bepi', 'marta'], rancor: [['nina', 'bepi']], beads: [V('voce:x', ['nina']), F(['bepi'])] }),
    draft: [c(0, 'L')],
    expect: { ok: true, pos: ['bepi', 'nina', 'marta'], holders: { 'voce:x': ['nina'], febbre: ['bepi'] }, knotted: ['nina', 'bepi'], events: ['nodo:bepi,nina'] },
  },
  {
    name: '3.8 rancore: il nodo blocca la riga dopo',
    level: mk({ initial: ['nina', 'bepi', 'marta'], rancor: [['nina', 'bepi']] }),
    setup: [[c(0, 'L')]],
    draft: [c(1, 'L')],
    expect: { ok: false, violations: ['bloccato'] },
  },
  {
    name: '3.8 rancore: dopo una riga il nodo si scioglie',
    level: mk({ initial: ['nina', 'bepi', 'marta'], rancor: [['nina', 'bepi']] }),
    setup: [[c(0, 'L')], []],
    draft: [c(1, 'L')],
    expect: { ok: true, knotted: [] },
  },
  {
    name: '3.8 rancore con martaNoSotto: si incrociano solo con Marta sopra, e anche così si annodano',
    level: mk({ initial: ['teresa', 'marta'], quirks: ['martaNoSotto'], rancor: [['teresa', 'marta']] }),
    draft: [c(0, 'R')],
    expect: { ok: true, knotted: ['teresa', 'marta'], events: ['nodo:marta,teresa'] },
  },
  {
    name: '3.8 marea: finita l\'acqua alta i fili sono di nuovo liberi',
    level: mk({ initial: ['bepi', 'nina', 'marta'], tide: [{ from: 7, to: 7, places: ['forno'] }] }),
    setup: [[]],
    draft: [c(0, 'L')],
    expect: { ok: true, pos: ['nina', 'bepi', 'marta'] },
  },
  {
    name: '3.8 marea: le colonne non allagate restano libere',
    level: mk({ initial: ['bepi', 'nina', 'marta', 'piero'], tide: [{ from: 7, to: 9, places: ['chiesa'] }] }),
    draft: [c(0, 'L')],
    expect: { ok: true },
  },
  {
    name: '3.8 marea: con l\'acqua alta al Molo nessuno entra né esce',
    level: mk({ initial: ['bepi', 'nina', 'marta'], extra: ['lino1'], tide: [{ from: 7, to: 7, places: ['molo'] }], edges: [{ hour: 7, side: 'molo', kind: 'barca' }] }),
    draft: [],
    expect: { ok: true, pos: ['bepi', 'nina', 'marta'], offboard: [] },
  },

  // ───── 3.9 Filo nero ─────
  {
    name: '3.9 filo nero: si muove di una colonna verso chi segue, sempre sopra',
    level: mk({ initial: ['nina', 'marta', 'livia'], kinds: { livia: 'nero' }, ...nero(['nina']) }),
    draft: [],
    expect: { ok: true, pos: ['nina', 'livia', 'marta'], events: ['incontro:livia'], usedMatassa: 0 },
  },
  {
    name: '3.9 filo nero: se il vicino è bloccato aspetta',
    level: mk({ initial: ['nina', 'marta', 'livia'], kinds: { livia: 'nero' }, ...nero(['nina']) }),
    state: (s) => ({ ...s, knotted: ['marta'] }),
    draft: [],
    expect: { ok: true, pos: ['nina', 'marta', 'livia'] },
  },
  {
    name: '3.9 filo nero: incrociato chi seguiva, passa all\'obiettivo dopo (annunciato)',
    level: mk({ initial: ['nina', 'livia', 'marta'], kinds: { livia: 'nero' }, ...nero(['nina', 'marta']) }),
    draft: [],
    expect: { ok: true, pos: ['livia', 'nina', 'marta'], events: ['nero:livia:0'] },
  },
  {
    name: '3.9 filo nero: dà lettere e voci come chi sta sopra',
    level: mk({ initial: ['nina', 'livia'], kinds: { livia: 'nero' }, ...nero(['nina']), beads: [V('voce:sciallo', ['livia']), L('L1', 'livia', 'nina')] }),
    draft: [],
    expect: { ok: true, holders: { 'voce:sciallo': ['nina', 'livia'], L1: ['nina'] }, delivered: ['L1'] },
  },
  {
    name: '3.9 filo nero: il giocatore non lo può trascinare',
    level: mk({ initial: ['nina', 'marta', 'livia', 'bepi'], kinds: { livia: 'nero' }, ...nero(['nina']) }),
    state: (s) => ({ ...s, knotted: ['marta'] }),
    draft: [c(2, 'L')],
    expect: { ok: false, violations: ['forzato'] },
  },

  // ───── 3.11 Nome di Ada ─────
  {
    name: '3.11 nome: appuntato sul filo scelto prima di tessere',
    level: mk({ initial: ['nina', 'marta', 'piero'], rules: ['incrocio', 'nome'] }),
    nomeOn: 'marta',
    draft: [],
    expect: { ok: true, holders: { nome: ['marta'] } },
  },
  {
    name: '3.11 nome: si diffonde come una voce',
    level: mk({ initial: ['nina', 'marta', 'piero'], rules: ['incrocio', 'nome'] }),
    nomeOn: 'marta',
    draft: [c(0, 'L')],
    expect: { ok: true, holders: { nome: ['nina', 'marta'] } },
  },
  {
    name: '3.11 nome: il pozzo lo riceve ma non lo dà',
    level: mk({ initial: ['marta', 'nina', 'piero', 'bepi'], rules: ['incrocio', 'nome'], quirks: ['pieroPozzo'] }),
    nomeOn: 'nina',
    setup: [[c(1, 'L')]],
    draft: [c(0, 'R')],
    expect: { ok: true, pos: ['piero', 'marta', 'nina', 'bepi'], holders: { nome: ['nina', 'piero'] } },
  },
];

function sorted(list: readonly string[] | undefined): string[] {
  return [...(list ?? [])].sort();
}

describe('regole: casi tabellari (GDD 3.4-3.11)', () => {
  it('almeno 60 casi', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(60);
  });

  it.each(CASES.map((k) => [k.name, k] as const))('%s', (_name, k) => {
    const ctx = createContext(k.level, k.flags ?? {}, { nomeOn: k.nomeOn ?? null });
    let s = initialState(k.level, ctx);
    for (const row of k.setup ?? []) {
      const r = applyRow(k.level, s, row, ctx);
      expect(r.violations).toEqual([]);
      expect(r.ok).toBe(true);
      s = r.state;
    }
    if (k.state) s = k.state(s);
    const before = JSON.parse(JSON.stringify(s)) as LaceState;
    const r = applyRow(k.level, s, k.draft, ctx);
    const e = k.expect;
    if (e.violations) expect(r.violations.map((v) => v.code)).toEqual(e.violations);
    if (e.ok !== undefined) expect(r.ok).toBe(e.ok);
    if (e.quirk) expect(r.violations[0]?.quirk).toBe(e.quirk);
    if (e.unchanged) expect(r.state).toEqual(before);
    if (e.pos) expect(r.state.pos).toEqual(e.pos);
    for (const [b, list] of Object.entries(e.holders ?? {})) expect(sorted(r.state.holders[b])).toEqual(sorted(list));
    if (e.delivered) expect(sorted(r.state.delivered)).toEqual(sorted(e.delivered));
    if (e.knotted) expect(sorted(r.state.knotted)).toEqual(sorted(e.knotted));
    if (e.offboard) expect(sorted(r.state.offboard.map((o) => o.thread))).toEqual(sorted(e.offboard));
    if (e.pozzo) expect(r.state.pozzo).toEqual(e.pozzo);
    if (e.usedMatassa !== undefined) expect(r.state.usedMatassa).toBe(e.usedMatassa);
    const evs = r.events.map(ev);
    for (const x of e.events ?? []) expect(evs).toContain(x);
    for (const x of e.noEvents ?? []) expect(evs).not.toContain(x);
    k.check?.(r, before);
  });
});

describe('memoria di Ada (GDD 3.11)', () => {
  it('+1 a chi ha il nome, −1 a chi era nel merletto senza, invariato per chi non c\'era', () => {
    const level = mk({ initial: ['nina', 'marta', 'piero'], extra: ['bepi'], rules: ['incrocio', 'nome'] });
    const ctx = createContext(level, {}, { nomeOn: 'nina' });
    let s = initialState(level, ctx);
    const timeline = [s];
    for (const row of [[c(0, 'L')], [], [], []]) {
      const r = applyRow(level, s, row, ctx);
      expect(r.ok).toBe(true);
      s = r.state;
      timeline.push(s);
    }
    const out = memoriaAfterDay(level, timeline, { nina: 3, marta: 0, piero: 1, bepi: 2 });
    expect(out).toEqual({ nina: 3, marta: 1, piero: 0, bepi: 2 });
  });
});
