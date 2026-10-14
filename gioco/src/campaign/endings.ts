/**
 * La scelta (sera di g23) e i finali (GDD 6.6).
 *
 * - Quattro biglietti e un solo spillo: i bigliettini di g23 con il campo `ending`,
 *   filtrati con `availableIf` (A è di Zeno, o di Don Piero se Zeno ha memoria 0).
 * - D (il finale vero) si può appuntare solo con i requisiti di `EndingDef.requires`;
 *   altrimenti il biglietto è strappato e dice che cosa manca: ogni voce di
 *   `EndingDef.missing` ha come `cond` il requisito e il suo testo si mostra quando è falso.
 * - Il merletto chiuso (C) non conta come finale: riporta alla sera di g23. Dopo averlo
 *   tessuto una volta il suo biglietto resta piegato e non si riappunta (D14).
 * - Epiloghi: le vignette di `EndingDef.epilogue` con `when` vera, nell'ordine del file.
 */
import type { CampaignState, ContentDB, EndingDef, EndingId, Knowledge, LevelDef, NoteDef, OccasionDef } from '../core/types';
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
  /** Il biglietto del merletto chiuso dopo averlo tessuto: piegato, non si riappunta. */
  folded: boolean;
}

/** Le carte della scelta con la loro disponibilità. */
export function choiceCards(choiceLevel: LevelDef, s: CampaignState, k: Knowledge, db: Db): ChoiceCard[] {
  return eveningNotes(choiceLevel, s, k, db, 'scelta')
    .filter((n): n is NoteDef & { ending: EndingId } => !!n.ending)
    .map((n) => {
      const folded = !countsAsEnding(n.ending, db) && !!s.history?.[finalLevelId(n.ending, db)];
      if (folded) return { note: n, ending: n.ending, available: false, missing: [], folded };
      const r = endingRequirements(n.ending, s, k, db);
      return { note: n, ending: n.ending, available: r.ok, missing: r.missing, folded };
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

// ───────── {occasioni} negli epiloghi (C04, CAM-12) ─────────

type Tr = (key: string, params?: Record<string, string | number>) => string;

/** L'ora di un'occasione nelle tre forme dei testi: «17», «alle 17», «delle 17» (12: mezzogiorno). */
export function occasionHour(hour: number, t: Tr): { h: string; ora: string; delle: string } {
  const noon = hour === 12;
  const h = noon ? t('campaign.occasione.ora.mezzogiorno') : t('campaign.occasione.ora.h', { h: hour, h12: ((hour + 11) % 12) + 1, ampm: hour < 12 ? 'am' : 'pm' });
  return {
    h,
    ora: noon ? t('campaign.occasione.ora.aMezzogiorno') : t('campaign.occasione.ora.alle', { h }),
    delle: noon ? t('campaign.occasione.ora.diMezzogiorno') : t('campaign.occasione.ora.delle', { h }),
  };
}

/**
 * Il parametro `{occasioni}` degli epiloghi: le occasioni piantate nella notte del finale,
 * ordinate per ora, ciascuna con `campaign.occasione.<kind>` (`{presso}`, `{ora}`, `{delle}`,
 * `{h}`), unite con virgole ed «e». Vuoto se non ce ne sono.
 */
export function formatOccasions(occ: readonly OccasionDef[], t: Tr): string {
  const sorted = [...occ].sort((a, b) => a.hour - b.hour || a.place.localeCompare(b.place));
  const parts = sorted.map((o) => t(`campaign.occasione.${o.kind}`, { presso: t(`campaign.presso.${o.place}`), ...occasionHour(o.hour, t) }));
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(t('campaign.occasione.virgola'))}${t('campaign.occasione.e')}${parts[parts.length - 1] ?? ''}`;
}

/** Le vignette dell'epilogo con il parametro `{occasioni}` su ogni riga (C04). */
export function withOccasions(views: readonly VignetteView[], occasioni: string): VignetteView[] {
  return views.map((v) => ({ ...v, lines: v.lines.map((l) => ({ ...l, params: { ...(l.params ?? {}), occasioni } })) }));
}
