/** Aiuti per i test della campagna: contenuti veri, salvataggi vuoti, notti simulate. */
import type { CampaignState, ContentDB, Knowledge, LaceState, LevelDef, NightOutcome, SaveData } from '../../../src/core/types';
import { loadContent } from '../../../src/content/loader';
import { defaultKnowledge, defaultSaveData } from '../../../src/core/save/defaults';
import { simulateNight, precomputedRows } from '../../../src/campaign/simulate';
import { currentNightParams } from '../../../src/campaign/flow';
import type { CampaignStateX } from '../../../src/campaign/types';

let cached: ContentDB | null = null;
export function db(): ContentDB {
  cached ??= loadContent();
  return cached;
}

export function emptySave(): SaveData {
  return defaultSaveData('test');
}

export function emptyState(over: Partial<CampaignStateX> = {}): CampaignStateX {
  return {
    dayIndex: 0,
    levelId: 'g00',
    phase: 'sera',
    flags: {},
    memoria: {},
    evening: null,
    lastOutcome: null,
    shownLines: [],
    endingsSeen: [],
    history: {},
    snapshots: {},
    ...over,
  };
}

export function emptyKnowledge(over: Partial<Knowledge> = {}): Knowledge {
  return { ...defaultKnowledge(), ...over };
}

/** Stato del merletto minimo (per i test della memoria). */
export function lace(hour: number, pos: string[], holders: Record<string, string[]> = {}): LaceState {
  return { hour, pos, offboard: [], holders, delivered: [], knotted: [], pozzo: { secrets: 0, overflowing: false }, usedMatassa: 0, met: [], metOver: [] };
}

/** Livello sintetico con i fili dati. */
export function syntheticLevel(id: string, threads: string[], rules: LevelDef['rules'] = ['incrocio', 'nome']): LevelDef {
  return {
    id,
    kind: 'storia',
    act: 2,
    titleKey: 'x',
    columns: (['molo', 'forno', 'piazza', 'chiesa', 'farmacia', 'faro'] as const).slice(0, Math.max(3, Math.min(6, threads.length))),
    startHour: 6,
    endHour: 8,
    threads: threads.map((t) => ({ id: t, kind: t.startsWith('lino') ? 'lino' : 'persona', ...(t.startsWith('lino') ? {} : { character: t as never }) })),
    initial: threads.slice(0, Math.max(3, Math.min(6, threads.length))),
    beads: [],
    rules,
    quirks: [],
    pins: [],
    matassa: 5,
  };
}

/** Gioca la notte della campagna in corso con la soluzione precalcolata (come autoplay). */
export function playNight(d: SaveData, content: ContentDB = db()): NightOutcome {
  const p = currentNightParams(d, content);
  if (!p) throw new Error('nessuna notte');
  const computed = content.computed.get(p.level.id) ?? null;
  const rows = precomputedRows(computed, p.accepted.map((a) => a.noteId)) ?? [];
  let o = simulateNight(p, rows, computed, content.balance);
  if (!o) o = simulateNight(p, computed?.base.rows ?? [], computed, content.balance);
  if (!o) throw new Error(`notte ${p.level.id} non simulabile`);
  return o;
}

export function asState(d: SaveData): CampaignState {
  if (!d.campaign) throw new Error('nessuna campagna');
  return d.campaign;
}
