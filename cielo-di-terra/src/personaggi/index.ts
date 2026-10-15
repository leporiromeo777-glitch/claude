/**
 * Personaggi generati (Higgsfield → Blender → GLB skinned): caricamento e animazione procedurale.
 * La pipeline che produce i GLB è in tools/personaggi/ (vedi docs/personaggi/PIPELINE.md).
 * Nella fase pilota non è ancora collegata al popolamento (src/popolamento/abitanti.ts).
 */
export { NOMI_OSSA, PADRE, type NomeOsso } from './ossa';
export { AnimatorePersonaggio, type GestoPersonaggio, type OpzioniAnimatore, type PosaBraccia, type StatoPersonaggio } from './animatore';
export { caricaPersonaggio, scaricaPersonaggio, type ModelloPersonaggio, type OpzioniCaricamento, type StileMateriale } from './carica';
