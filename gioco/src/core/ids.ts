/**
 * Elenchi a runtime degli identificatori di types.ts, con un controllo di
 * esaustività a tempo di compilazione: se in types.ts si aggiunge un valore e
 * qui no, il typecheck fallisce. Servono alla validazione dei contenuti e a chi
 * deve iterare sugli identificatori (impostazioni, debug, test).
 */
import type {
  ActionId,
  BeadType,
  CharacterId,
  EndingId,
  GradoId,
  HapticKind,
  LaceEventKind,
  OccasionKind,
  QuirkId,
  RuleId,
  SceneId,
  ThreadKind,
  ThreadPattern,
} from './types';

type Exhaustive<All, Listed> = [Exclude<All, Listed>] extends [never] ? true : false;
function assertExhaustive<T extends true>(_: T): void {
  /* solo controllo di tipo */
}

export const CHARACTER_IDS = [
  'teresa', 'marta', 'piero', 'gino', 'bepi', 'nina', 'zeno', 'lunardi',
  'livia', 'ada', 'clotilde',
  'ernesto', 'anselmo', 'aldo', 'bortolo', 'arianna',
] as const satisfies readonly CharacterId[];
assertExhaustive<Exhaustive<CharacterId, (typeof CHARACTER_IDS)[number]>>(true);

/** Gli 8 personaggi del cast con desideri (GDD 6.6). */
export const CAST_IDS = ['teresa', 'marta', 'piero', 'gino', 'bepi', 'nina', 'zeno', 'lunardi'] as const satisfies readonly CharacterId[];

export const THREAD_KINDS = ['persona', 'lino', 'nero', 'avorio'] as const satisfies readonly ThreadKind[];
assertExhaustive<Exhaustive<ThreadKind, (typeof THREAD_KINDS)[number]>>(true);

export const BEAD_TYPES = ['lettera', 'voce', 'segreto', 'febbre', 'nome'] as const satisfies readonly BeadType[];
assertExhaustive<Exhaustive<BeadType, (typeof BEAD_TYPES)[number]>>(true);

export const RULE_IDS = [
  'incrocio', 'spillo', 'lettera', 'voce', 'matassa', 'molo', 'segreto',
  'febbre', 'rancore', 'nome', 'nero', 'marea', 'occasioni',
] as const satisfies readonly RuleId[];
assertExhaustive<Exhaustive<RuleId, (typeof RULE_IDS)[number]>>(true);

export const QUIRK_IDS = [
  'martaNoSotto', 'teresaLegge', 'pieroPozzo', 'pieroTrabocca',
  'ginoCorre', 'ninaCuriosa', 'zenoFaro', 'lunardiCura',
] as const satisfies readonly QuirkId[];
assertExhaustive<Exhaustive<QuirkId, (typeof QUIRK_IDS)[number]>>(true);

export const ENDING_IDS = ['merlettaia', 'seppia', 'chiuso', 'aperto'] as const satisfies readonly EndingId[];
assertExhaustive<Exhaustive<EndingId, (typeof ENDING_IDS)[number]>>(true);

export const OCCASION_KINDS = ['pane', 'festa', 'messa', 'lanterna', 'vaporetto'] as const satisfies readonly OccasionKind[];
assertExhaustive<Exhaustive<OccasionKind, (typeof OCCASION_KINDS)[number]>>(true);

export const GRADO_IDS = ['matassaEsatta', 'senzaDisfa', 'spilliVelati', 'nodoInPiu', 'neroInPiu', 'notteCorta'] as const satisfies readonly GradoId[];
assertExhaustive<Exhaustive<GradoId, (typeof GRADO_IDS)[number]>>(true);

export const LACE_EVENT_KINDS = [
  'incontro', 'passa', 'copia', 'consegna', 'legge', 'contagio', 'cura',
  'nodo', 'esce', 'entra', 'trabocca', 'stranezza', 'nero',
] as const satisfies readonly LaceEventKind[];
assertExhaustive<Exhaustive<LaceEventKind, (typeof LACE_EVENT_KINDS)[number]>>(true);

export const THREAD_PATTERNS = [
  'righe', 'puntini', 'doppio', 'onde', 'zigzag', 'tratteggio',
  'catenella', 'croce', 'lucido', 'perlato', 'liscio', 'nessuno',
] as const satisfies readonly ThreadPattern[];
assertExhaustive<Exhaustive<ThreadPattern, (typeof THREAD_PATTERNS)[number]>>(true);

export const SCENE_IDS = [
  'boot', 'titolo', 'sera', 'tombolo', 'alba', 'bilancio', 'archivio',
  'telaio', 'giornaliero', 'libero', 'impostazioni', 'crediti', 'finale',
] as const satisfies readonly SceneId[];
assertExhaustive<Exhaustive<SceneId, (typeof SCENE_IDS)[number]>>(true);

export const ACTION_IDS = [
  'confirm', 'back', 'pause', 'undo', 'fixHour', 'notebook', 'hint', 'name',
  'left', 'right', 'up', 'down', 'pageUp', 'pageDown',
  'crossL', 'crossR', 'flip', 'select', 'skip', 'auto', 'tab',
] as const satisfies readonly ActionId[];
assertExhaustive<Exhaustive<ActionId, (typeof ACTION_IDS)[number]>>(true);

export const HAPTIC_KINDS = ['leggero', 'medio', 'successo', 'rifiuto'] as const satisfies readonly HapticKind[];
assertExhaustive<Exhaustive<HapticKind, (typeof HAPTIC_KINDS)[number]>>(true);

export function isOneOf<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (list as readonly string[]).includes(v);
}
