/**
 * Popolamento di Corbella (modulo `popolamento`): API pubblica.
 */
export { installaCorbella, type ManigliaCorbella, type OpzioniCorbella, type StatisticheCorbella } from './corbella';
export { rimuoviSegnaposto, liberaCastagni, filtraLumi, dentroCorbella, RIQUADRO_CORBELLA } from './segnaposto';
export type { GiocoCorbella, PuntoInterazione, AzionePunto, PosCil, GestoNpc, PosaNpc } from './tipi';
export type { VoceCollider } from './cantiere';
