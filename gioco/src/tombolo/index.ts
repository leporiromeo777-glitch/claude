/**
 * API pubblica del pacchetto tombolo per gli altri pacchetti (campagna,
 * schermate): si naviga con `scenes.go('tombolo', NightParams)` e si ascolta
 * `night:complete` sul bus; qui ci sono gli aiuti per riprendere la notte,
 * ritessere uno spartito e generare il PNG del merletto.
 */
export { renderLacePng, drawLaceImage, laceImageSize } from './export';
export { resumeNight, resumeParams, resolveLevel, resolveComputed, registerLevelResolver, rememberLevel, paramsForSave } from './resume';
export { replayParams, spartitoParams, replayStepMs, RIPASSA_TOTAL_MS } from './modes/replay';
export { activeNight } from './active';
export { isNightParams } from './TomboloScene';
export type { NightSession } from './session';
