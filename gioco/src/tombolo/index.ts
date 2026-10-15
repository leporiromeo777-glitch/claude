/**
 * API pubblica del pacchetto tombolo per gli altri pacchetti (campagna,
 * schermate): si naviga con `scenes.go('tombolo', NightParams)` e si ascolta
 * `night:complete` sul bus; qui ci sono gli aiuti per riprendere la notte,
 * ritessere uno spartito e generare il PNG del merletto.
 */
import { activeNight } from './active';

export { renderLacePng, drawLaceImage, laceImageSize } from './export';
export type { LaceCaption } from './export';
export { resumeNight, resumeParams, resolveLevel, resolveComputed, registerLevelResolver, rememberLevel, paramsForSave } from './resume';
export { replayParams, spartitoParams, replayStepMs, RIPASSA_TOTAL_MS } from './modes/replay';
export { activeNight, nightHooks, setNightHooks } from './active';
export type { NightHooks } from './active';
export { isNightParams } from './TomboloScene';
export type { NightSession, RequestStatus } from './session';

/**
 * Elenco degli obiettivi della notte in corso (C08) per il pannello della
 * campagna: obiettivi obbligatori con il testo completo e lo stato, spilli
 * d'ottone, coppie in rancore, obiettivi generati delle modalità extra, fili da
 * nominare nell'Archivio. Si aggiorna da solo su `night:row`, `night:undo` e
 * `night:cross` e si smonta quando la notte finisce. null senza una notte attiva.
 * `data-test`: `tb-obiettivi-lista`, `tb-obiettivo-<i>`, `tb-spillo-<thread>-<ora>`,
 * `tb-rancore-<a>-<b>`, `tb-sbiadito-<thread>`.
 */
export function objectivesElement(opts?: { compact?: boolean }): HTMLElement | null {
  const c = activeNight();
  return c ? c.objectivesElement(opts ?? {}) : null;
}
