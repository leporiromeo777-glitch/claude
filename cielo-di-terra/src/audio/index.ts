/**
 * Modulo audio di «Cielo di Terra»: API pubblica.
 * Tutto il suono è procedurale (Web Audio API): sintesi, rumore filtrato e piccoli
 * campioni generati in codice. Nessun file esterno.
 */
export { AudioEngine, NOMI_STRATI, type OpzioniMotore, type NomeStrato } from './motore';
export { Mixer, VOLUMI_PREDEFINITI, type ImpostazioniMixer } from './mixer';
export * from './tipi';
export {
  calcolaParametriAmbiente,
  coordinateCilindriche,
  posizioneCilindrica,
  suVersoAsse,
  vettoreSicuro,
  zonaDaTheta,
  descrizioneZona,
  pesoFinestra,
  volumeAGuadagno,
  orientamentoAscoltatore,
  parametriVento,
  parametriVolo,
  parametriLinea,
  luceLinea,
  intensitaUccelli,
  intensitaGrilli,
  parametriFauna,
  pesoLago,
  pesoSordo,
  distanzaLagoStimata,
  distanzaSordoStimata,
  attenuazioneValle,
  normalizzaOra,
  haAttraversato,
  type ParametriAmbiente,
  type ParametriVento,
  type ParametriVolo,
  type ParametriLinea,
  type Cilindriche,
} from './mappature';
export * as costanti from './costanti';
export { generaTema, TEMI, type Partitura, type NotaMusicale, type Strumento } from './musica/temi';
export { RegiaMusica, PRIORITA_TEMI, type DecisioneMusica } from './musica/regia';
