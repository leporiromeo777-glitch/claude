/**
 * Personaggi generati (Higgsfield → Blender → GLB skinned): caricamento, materiale del mondo e
 * animazione procedurale. La pipeline che produce i GLB è in tools/personaggi/ (docs/personaggi/PIPELINE.md);
 * l'elenco dei modelli pronti è public/personaggi/indice.json (indice.ts, schede.ts); come il modulo è
 * collegato al gioco è in docs/personaggi/MODULO.md e docs/personaggi/INTEGRAZIONE.md.
 *
 * Per il gioco:
 *   collegaMotorePersonaggi({ uniforms, camera })    // materiale del mondo, livelli di dettaglio
 *   await precaricaPersonaggi(onProgress)            // una volta, prima di costruire Corbella
 *   creaPersonaggio(chi, opz) ?? creaAbitante(opz)   // stessa interfaccia della figura procedurale
 */
export { NOMI_OSSA, PADRE, type NomeOsso } from './ossa';
export {
  AnimatorePersonaggio,
  carattereDa,
  type Carattere,
  type GestoPersonaggio,
  type OpzioniAnimatore,
  type PosaBraccia,
  type PosaCorpo,
  type StatoPersonaggio,
} from './animatore';
export {
  GENERICI,
  MODELLI_SENZA_INDICE,
  SCHEDE,
  derivaProcedurale,
  genericoPer,
  leggiIndice,
  posturaAnimatore,
  scegliModello,
  type SchedaModello,
  type VoceModello,
} from './schede';
export {
  cartellaPersonaggi,
  collegaMotorePersonaggi,
  impostaDistanzePersonaggi,
  personaggiDisponibili,
  precaricaPersonaggi,
  preparaPrototipo,
  prototipo,
  registraPrototipo,
  svuotaPersonaggi,
  type DistanzePersonaggi,
  type EsitoPrecarica,
  type OpzioniPrecarica,
  type PrototipoPersonaggio,
} from './precarica';
export { creaPersonaggio, livelloPersonaggio, type StatoPersonaggioGioco } from './fabbrica';
export { PEZZI_COMUNI, RIEMPIMENTO, creaMaterialeMondo, creaMaterialePersonaggio, creaMaterialeToon } from './materiale';
export { caricaPersonaggio, scaricaPersonaggio, type ModelloPersonaggio, type OpzioniCaricamento, type StileMateriale } from './carica';
export { caricaIndice, opzioniDaIndice, urlPersonaggio, type IndicePersonaggi, type VoceIndice, type VoltoPersonaggio } from './indice';
export { attaccaOggetto, leggiOggetto, type NomeOggetto } from './oggetti';
