/**
 * Interfaccia di «Cielo di Terra»: API pubblica del modulo.
 *
 * Uso tipico:
 *   const ui = new InterfacciaGioco(document.getElementById('app')!);
 *   ui.on('catturaInput', (preso) => preso ? document.exitPointerLock() : null);
 *   ui.titolo.show({ puoiContinuare: true, salvataggio: 'Giorno 3 · Corbella' });
 *   ui.titolo.on('continua', () => { ui.titolo.hide(); … });
 */
export { InterfacciaGioco, type OpzioniInterfaccia, type EventiInterfaccia } from './interfaccia';
export { creaRadice, applicaImpostazioniVisive, annuncia } from './radice';
export { caricaCaratteri, FAMIGLIE_CARATTERI } from './stile/caratteri';

export { Emettitore, type Ascoltatore } from './core/emettitore';
export { Componente, type EventiBase, type OpzioniComponente } from './core/componente';
export { analizzaTesto, testoSemplice, nodiTesto, paragrafi, type PezzoTesto } from './core/testo';

export {
  StoreImpostazioni,
  impostazioniPredefinite,
  validaValore,
  SCALE_TESTO,
  VELOCITA_CARATTERI,
  LIMITI,
  type Impostazioni,
  type ChiaveImpostazione,
  type CambioImpostazione,
  type EventiImpostazioni,
  type DimensioneTesto,
  type VelocitaTesto,
  type Calligrafia,
  type OpzioniStore,
  type ArchivioChiaveValore,
} from './impostazioni/store';

export { SchermataTitolo, type DatiTitolo, type EventiTitolo } from './componenti/titolo';
export { MenuPausa, type DatiPausa, type EventiPausa } from './componenti/pausa';
export { PannelloImpostazioni, SEZIONI_IMPOSTAZIONI, type EventiPannelloImpostazioni } from './componenti/impostazioni';
export {
  FinestraDialogo,
  type BattutaDialogo,
  type RispostaDialogo,
  type VoceStorico,
  type EventiDialogo,
  type OpzioniDialogo,
} from './componenti/dialogo';
export { LettoreCarte, type Carta, type PaginaCarta, type TipoCarta, type EventiLettore } from './componenti/lettore';
export {
  Taccuino,
  type DatiTaccuino,
  type PistaTaccuino,
  type IndizioTaccuino,
  type NotaTaccuino,
  type ManoTaccuino,
  type ParolaTaccuino,
  type ProverbioTaccuino,
  type LeggendaTaccuino,
  type RespiroTaccuino,
  type SchedaTaccuino,
  type VociViste,
  type EventiTaccuino,
} from './componenti/taccuino';
export { PiantaVerbano, type EventiPianta, type OpzioniPianta } from './componenti/pianta';
export {
  Indicazioni,
  type AzioneContestuale,
  type Sottotitolo,
  type DirezioneSuono,
  type StatoSquadro,
  type OpzioniNotifica,
  type EventiIndicazioni,
} from './componenti/indicazioni';
export { Crediti, CREDITI_PREDEFINITI, type DatiCrediti, type SezioneCrediti, type EventiCrediti } from './componenti/crediti';
export { SchermataCaricamento, PROVERBI_PREDEFINITI, type DatiCaricamento, type EventiCaricamento } from './componenti/caricamento';

export {
  ModelloPianta,
  GRIGLIA_PREDEFINITA,
  CODICE_STATO,
  CODICE_SALUTE,
  CODICE_TERRENO,
  type DatiPianta,
  type GrigliaPianta,
  type ParticellaPianta,
  type CaposaldoPianta,
  type LuogoPianta,
  type PosizionePianta,
  type StatoParticella,
  type SaluteParticella,
  type TerrenoParticella,
  type TipoCaposaldo,
} from './pianta/modello';
export {
  FASCE_VERBANO,
  LUNGHEZZA_Z,
  RAGGIO,
  CIRCONFERENZA,
  METRI_PER_GRADO,
  normalizzaGradi,
  type FasciaPianta,
  type TipoFascia,
  type Vista,
} from './pianta/geometria';

export {
  separaNote,
  staccaFirma,
  tipoCartaPer,
  cartaDaTesto,
  librettoDaTesti,
  cartaDaLeggenda,
  taccuinoDaContenuti,
  terrenoDaTipo,
  grigliaDaParticelle,
  capisaldiDaContenuti,
  latiDaContenuti,
  luoghiDaContenuti,
  aspettoDaPersonaggio,
  battutaDaNodo,
  TIPI_LUOGO_SULLA_PIANTA,
  type VoceTestiJson,
  type TaccuinoJson,
  type StatoTaccuino,
  type ParticellaFadeJson,
  type CaposaldoJson,
  type PersonaggioJson,
  type DialogoJson,
  type RispostaJson,
} from './adattatori';
export type { LatoPianta, ResocontoPianta } from './pianta/modello';
export { nomeCatastale } from './pianta/modello';
export { fattoreCoriolisCorpo, type CoriolisCorpo, type Capovolgimento, type DondolioVisivo, type ModoAzioni } from './impostazioni/store';
