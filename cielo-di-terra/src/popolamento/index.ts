/**
 * Popolamento di Corbella (modulo `popolamento`): API pubblica.
 */
export { installaCorbella, type ManigliaCorbella, type ManigliaElemento, type OpzioniCorbella, type StatisticheCorbella } from './corbella';
export { portaPopolamento, ALIAS_SEGNAPOSTO, type PortaCorbella } from './porta';
export type { ManigliaNpc } from './abitanti';
export type { Cripta } from './luoghi/cripta';
export type { Notte } from './notte';
export { rimuoviSegnaposto, liberaCastagni, filtraLumi, dentroCorbella, RIQUADRO_CORBELLA } from './segnaposto';
export type { GiocoCorbella, PuntoInterazione, AzionePunto, PosCil, GestoNpc, PosaNpc } from './tipi';
export type { VoceCollider } from './cantiere';
