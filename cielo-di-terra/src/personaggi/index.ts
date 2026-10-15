/**
 * Personaggi generati (Higgsfield → Blender → GLB skinned): caricamento e animazione procedurale.
 * La pipeline che produce i GLB è in tools/personaggi/ (vedi docs/personaggi/PIPELINE.md); l'elenco dei
 * modelli pronti è public/personaggi/indice.json (indice.ts).
 * Non è ancora collegata al popolamento (src/popolamento/abitanti.ts): vedi PIPELINE.md, «Come si collega».
 */
export { NOMI_OSSA, PADRE, type NomeOsso } from './ossa';
export { AnimatorePersonaggio, type GestoPersonaggio, type OpzioniAnimatore, type PosaBraccia, type StatoPersonaggio } from './animatore';
export { caricaPersonaggio, scaricaPersonaggio, type ModelloPersonaggio, type OpzioniCaricamento, type StileMateriale } from './carica';
export { caricaIndice, opzioniDaIndice, urlPersonaggio, type IndicePersonaggi, type VoceIndice, type VoltoPersonaggio } from './indice';
export { attaccaOggetto, leggiOggetto, type NomeOggetto } from './oggetti';
