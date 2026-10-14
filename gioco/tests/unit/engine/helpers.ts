/**
 * Aiuti per i test del motore: livelli in miniatura, perline, formattazione
 * degli eventi, caricamento delle fixture.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BeadDef, Condition, LaceEvent, LevelDef, NoteDef, PlaceId, ThreadDef, ThreadKind } from '../../../src/core/types';
import { PLACE_ORDER } from '../../../src/core/types';

export const ROOT = resolve(__dirname, '../../..');
export const FIXTURES = resolve(ROOT, 'src/engine/fixtures');

export function fixture(name: string): LevelDef {
  return JSON.parse(readFileSync(resolve(FIXTURES, `${name}.json`), 'utf8')) as LevelDef;
}

export function fixtureNotes(): NoteDef[] {
  return JSON.parse(readFileSync(resolve(FIXTURES, 'notes.fixtures.json'), 'utf8')) as NoteDef[];
}

export function noteRequest(id: string): Condition {
  const n = fixtureNotes().find((x) => x.id === id);
  if (!n?.request) throw new Error(`note ${id} without request`);
  return n.request;
}

const LINO_NAMES = new Set(['marinaio', 'barcaiolo', 'passante']);
const CHARS = new Set(['teresa', 'marta', 'piero', 'gino', 'bepi', 'nina', 'zeno', 'lunardi', 'livia', 'ada', 'clotilde']);

function threadDef(id: string, kinds: Record<string, ThreadKind>): ThreadDef {
  const kind: ThreadKind = kinds[id] ?? (id.startsWith('lino') || LINO_NAMES.has(id) ? 'lino' : 'persona');
  if (kind === 'lino') return { id, kind };
  return CHARS.has(id) ? { id, kind, character: id as ThreadDef['character'] } : { id, kind, labelKey: `test.${id}` };
}

export interface MiniSpec extends Partial<Omit<LevelDef, 'threads' | 'initial'>> {
  initial: string[];
  extra?: string[];
  kinds?: Record<string, ThreadKind>;
}

/** Livello in miniatura: colonne = primi luoghi di PLACE_ORDER (o `columns`), ore 6→10, matassa 10. */
export function mk(spec: MiniSpec): LevelDef {
  const { initial, extra = [], kinds = {}, ...rest } = spec;
  const W = initial.length;
  const columns: PlaceId[] = rest.columns ?? PLACE_ORDER.slice(0, W);
  return {
    id: rest.id ?? 'mini',
    kind: rest.kind ?? 'test',
    act: rest.act ?? 1,
    titleKey: 'test.titolo',
    startHour: 6,
    endHour: 10,
    beads: [],
    rules: ['incrocio'],
    quirks: [],
    pins: [],
    matassa: 10,
    ...rest,
    columns,
    threads: [...initial, ...extra].map((id) => threadDef(id, kinds)),
    initial,
  };
}

export const L = (id: string, holder: string, to: string): BeadDef => ({ id, type: 'lettera', holder, to, labelKey: `test.${id}` });
export const V = (id: string, holders: string[]): BeadDef => ({ id, type: 'voce', holders, labelKey: `test.${id}` });
export const S = (id: string, holders: string[]): BeadDef => ({ id, type: 'segreto', holders, labelKey: `test.${id}` });
export const F = (holders: string[]): BeadDef => ({ id: 'febbre', type: 'febbre', holders, labelKey: 'test.febbre' });
export const N = (holders: string[]): BeadDef => ({ id: 'nome', type: 'nome', holders, labelKey: 'test.nome' });

/** Evento in forma corta, per confronti leggibili. */
export function ev(e: LaceEvent): string {
  switch (e.k) {
    case 'incontro':
      return `incontro:${e.over}`;
    case 'passa':
      return `passa:${e.bead}:${e.from}>${e.to}`;
    case 'copia':
      return `copia:${e.bead}:${e.from}>${e.to}`;
    case 'consegna':
      return `consegna:${e.bead}>${e.to}`;
    case 'legge':
      return `legge:${e.letter}:${e.who}`;
    case 'contagio':
      return `contagio:${e.from}>${e.to}`;
    case 'cura':
      return `cura:${e.who}<${e.by}`;
    case 'nodo':
      return `nodo:${[e.a, e.b].sort().join(',')}`;
    case 'esce':
      return `esce:${e.thread}`;
    case 'entra':
      return `entra:${e.thread}`;
    case 'trabocca':
      return `trabocca:${e.who}`;
    case 'stranezza':
      return `stranezza:${e.quirk}`;
    case 'nero':
      return `nero:${e.thread}:${e.pair}`;
  }
}
