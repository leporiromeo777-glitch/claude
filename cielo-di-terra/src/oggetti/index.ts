/**
 * Libreria di oggetti procedurali di «Cielo di Terra» (modulo `oggetti`).
 * Ogni generatore: crea<Nome>(opzioni con seme) → OggettoProcedurale { gruppo, collider, appoggio, … }.
 */
export type { Collider, Ingombro, OggettoProcedurale, Vec3 } from './tipi';
export { Rng, semeNumerico, type Seme } from './rng';
export { PALETTE, type NomeColore } from './palette';
export {
  impostaMateriali,
  reimpostaMateriali,
  impostaIntensitaLumi,
  leggiIntensitaLumi,
  materiali,
  creaMaterialiPredefiniti,
  aggiungiPennellata,
  creaMappaToni,
  type Canale,
  type SetMateriali,
  type OpzioniMateriali,
} from './materiali';
export { Costruttore, mat, matSegmento, mescola, type OpzioniPezzo, type FnColore } from './costruttore';
export { misura, type Misura } from './misure';
export { istanzia, unisciStatici, unisciGeometrie } from './istanze';
export { aggiungiAColor, adattaAlMotore, type MaterialiMotore } from './integrazione';
export {
  R_CILINDRO,
  L_CILINDRO,
  PERIODO_ROTAZIONE,
  terna,
  puntoCilindro,
  matriceSuperficie,
  posaSulCilindro,
  colliderAlMondo,
  type ColliderMondo,
  type Terna,
} from './cilindro';

export { creaRustico, type OpzioniRustico, type Dettaglio } from './oggetti/rustico';
export { creaCampanile, type OpzioniCampanile } from './oggetti/campanile';
export {
  creaCastagno,
  creaCastagnoMorto,
  creaBotolaCripta,
  type OpzioniCastagno,
  type OpzioniCastagnoMorto,
  type OpzioniBotola,
  type StatoBotola,
  type Stagione,
} from './oggetti/castagno';
export {
  creaMuroSecco,
  creaScaletta,
  creaCancello,
  type OpzioniMuro,
  type OpzioniScaletta,
  type OpzioniCancello,
  type StatoCancello,
} from './oggetti/muri';
export { creaFienile, type OpzioniFienile } from './oggetti/fienile';
export { creaPontile, creaBarca, type OpzioniPontile, type OpzioniBarca, type StatoBarca } from './oggetti/lago';
export {
  creaCaposaldo,
  creaPilastro,
  creaPalina,
  creaCaposaldoDaContenuto,
  testaChiodo,
  aggiungiPalina,
  numero as incidiNumero,
  type OpzioniChiodo,
  type OpzioniPilastro,
  type OpzioniPalina,
  type VoceCaposaldo,
} from './oggetti/caposaldo';
export {
  creaSquadroPrimaPersona,
  creaVeloPrimaPersona,
  PUNTALE_PIANTATO,
  creaLetteraPrimaPersona,
  materialiPrimoPiano,
  VELO,
  type StatoLettera,
  type PosaSquadro,
  type StatoSquadro,
  type OpzioniSquadro,
  type StatoVelo,
  type OpzioniVelo,
} from './oggetti/primaPersona';
export { manoGuanto, manica, posaAngoli, posaAvvolta, matriceMano, COLORI_MANI, type PosaMano, type OpzioniMano } from './oggetti/mani';
export {
  creaAbitante,
  type OpzioniAbitante,
  type StatoAbitante,
  type Copricapo,
  type Corporatura,
  type Postura,
  type Gesto,
} from './oggetti/abitante';
export {
  creaFada,
  creaSciameFade,
  creaSciameApi,
  type OpzioniFada,
  type StatoFada,
  type ModoFada,
  type OpzioniSciameFade,
  type OpzioniSciameApi,
  type StatoApi,
} from './oggetti/fade';
export { creaLanterna, creaLumino, testaLanterna, lanternaPetrolio, type TipoLanterna, type OpzioniLanterna, type StatoLume } from './oggetti/lumi';
export { CATALOGO, type VoceCatalogo } from './catalogo';
