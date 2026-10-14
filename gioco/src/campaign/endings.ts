/**
 * La scelta (sera di g23) e i finali (GDD 6.6).
 *
 * - Quattro biglietti e un solo spillo: i bigliettini di g23 con il campo `ending`,
 *   filtrati con `availableIf` (A è di Zeno, o di Don Piero se Zeno ha memoria 0).
 * - D (il finale vero) si può appuntare solo con i requisiti di `EndingDef.requires`;
 *   altrimenti il biglietto è strappato e dice che cosa manca: ogni voce di
 *   `EndingDef.missing` ha come `cond` il requisito e il suo testo si mostra quando è falso.
 * - Il merletto chiuso (C) non conta come finale: riporta alla sera di g23.
 * - Epiloghi: le vignette di `EndingDef.epilogue` con `when` vera, nell'ordine del file.
 */
import type { CampaignState, ContentDB, EndingDef, EndingId, Knowledge, LevelDef, NoteDef } from '../core/types';
import { evalStory } from './story';
import { eveningNotes } from './evening';
import { resolveForgotten, toView } from './dawn';
import type { VignetteView } from './types';

type Db = Pick<ContentDB, 'levels' | 'notes' | 'diary' | 'balance' | 'endings' | 'campaign' | 'letters'>;

export interface Requirements {
  ok: boolean;
  /** Testi delle mancanze (chiavi dei contenuti), nell'ordine dei dati. */
  missing: string[];
}

/** Requisiti di un finale: veri se non ci sono, altrimenti `requires` e le mancanze. */
export function endingRequirements(ending: EndingId, s: CampaignState, k: Knowledge, db: Pick<ContentDB, 'endings' | 'levels' | 'diary' | 'balance'>): Requirements {
  const def = db.endings.get(ending);
  if (!def) return { ok: false, missing: [] };
  const o = { db };
  const missing: string[] = [];
  for (const m of def.missing ?? []) {
    let holds = false;
    try {
      holds = evalStory(m.cond, s, k, o);
    } catch {
      holds = false;
    }
    if (!holds) missing.push(m.textKey);
  }
  let ok = true;
  if (def.requires) {
    try {
      ok = evalStory(def.requires, s, k, o);
    } catch {
      ok = false;
    }
  } else ok = missing.length === 0;
  return { ok, missing: ok ? [] : missing };
}

export interface ChoiceCard {
  note: NoteDef;
  ending: EndingId;
  available: boolean;
  missing: string[];
}

/** Le carte della scelta con la loro disponibilità. */
export function choiceCards(choiceLevel: LevelDef, s: CampaignState, k: Knowledge, db: Db): ChoiceCard[] {
  return eveningNotes(choiceLevel, s, k, db, 'scelta')
    .filter((n): n is NoteDef & { ending: EndingId } => !!n.ending)
    .map((n) => {
      const r = endingRequirements(n.ending, s, k, db);
      return { note: n, ending: n.ending, available: r.ok, missing: r.missing };
    });
}

export function finalLevelId(ending: EndingId, db: Pick<ContentDB, 'campaign'>): string {
  return db.campaign.finals[ending];
}

export function endingOfLevel(levelId: string, db: Pick<ContentDB, 'campaign'>): EndingId | null {
  for (const [e, id] of Object.entries(db.campaign.finals) as [EndingId, string][]) if (id === levelId) return e;
  return null;
}

export function countsAsEnding(ending: EndingId, db: Pick<ContentDB, 'endings'>): boolean {
  const def: EndingDef | undefined = db.endings.get(ending);
  return def ? def.countsAsEnding : ending !== 'chiuso';
}

/** Vignette dell'epilogo (filtrate con `when`, nell'ordine del file). */
export function epilogueOf(ending: EndingId, s: CampaignState, k: Knowledge, db: Pick<ContentDB, 'endings' | 'levels' | 'diary' | 'balance'>): VignetteView[] {
  const def = db.endings.get(ending);
  if (!def) return [];
  const o = { db };
  return def.epilogue
    .filter((v) => {
      try {
        return !v.when || evalStory(v.when, s, k, o);
      } catch {
        return false;
      }
    })
    .map((v) => resolveForgotten(toView(v), s, db));
}
