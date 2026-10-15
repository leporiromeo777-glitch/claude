/**
 * Lettura tipizzata dei contenuti della Fase 1 (cartella `content/` del gioco).
 *
 * Solo lettura: il popolamento non modifica i file. Le quote `altezza` dei contenuti sono
 * state calcolate su una versione precedente del terreno: per posare gli oggetti si usano
 * (z, theta) dei contenuti e la quota VERA del suolo (`groundHeight` del motore); l'altezza
 * dei contenuti serve solo per gli oggetti sollevati (la cella campanaria è 24 m sopra il suolo
 * del campanile) e, per i luoghi di tipo «interno», come profondità sotto il suolo.
 */
import luoghiJson from '../../../content/luoghi.json';
import capisaldiJson from '../../../content/capisaldi.json';
import personaggiJson from '../../../content/personaggi.json';
import fadeJson from '../../../content/fade_fase1.json';
import testiJson from '../../../content/testi.json';

export interface Luogo {
  id: string;
  nome: string;
  z: number;
  theta: number;
  altezza: number;
  descrizione: string;
  raggio: number;
  tipo: string;
  zona: string;
  cella: number | null;
}

export interface CaposaldoRete {
  id: string;
  numero: number;
  tipo: 'pilastro' | 'chiodo' | string;
  nome: string;
  luogo: string;
  z: number;
  theta: number;
  altezza: number;
  altezza_segnale: number;
  cella: number;
  visibile_da: string[];
  non_visibile_da: Array<{ id: string; motivo: string }>;
  note: string;
  stato_iniziale: string;
}

export interface CaposaldoLontano {
  id: string;
  numero: number;
  nome: string;
  z: number;
  theta: number;
  altezza: number;
  valle: string;
  lume: 'permanente' | 'Ottavio' | 'nessuno' | string;
  lume_descrizione: string;
  ore: string;
  note: string;
}

export interface Lato {
  id: string;
  a: string;
  b: string;
  lunghezza: number;
  chiudibile: boolean;
  particelle: number[];
}

export interface PosizionePersonaggio {
  fase: string;
  luogo: string;
  dalle?: string;
  alle?: string;
  nota?: string;
  condizione?: string;
}

export interface Personaggio {
  id: string;
  nome: string;
  ruolo: string;
  come_appare: { velo: string; maschera: string; postura: string; colori: string };
  voce: string;
  posizioni: PosizionePersonaggio[];
  gruppo?: string;
  note?: string;
}

export interface VarianteMobile {
  id: string;
  descrizione: string;
  pezzi: string[];
}

export interface ElementoMobile {
  id: string;
  nome: string;
  particelle: number[];
  trama: boolean;
  varianti: VarianteMobile[];
  variante_iniziale: string;
  ora_fade: string;
  stadi?: string[];
  cicli_del_giorno: Array<{ ora: string; chi: string; da: string; a: string; testo: string }>;
  via_necessaria: boolean;
  alternativa?: string;
  legato_a?: string;
  note: string;
}

export interface PassaggioFade {
  ora: string;
  dove: string;
  elemento?: string | string[];
  durata_min?: number;
  che_cosa: string;
}

export interface Particella {
  id: number;
  iz: number;
  itheta: number;
  centro: { z: number; theta: number; altezza: number };
  tipo: string;
  nomi: string[];
  hub: boolean;
  rifugio: boolean;
  mobile: boolean;
  elemento: string | null;
}

export const PARTICELLE: readonly Particella[] = (fadeJson as unknown as { particelle: Particella[] }).particelle;

export const LUOGHI: readonly Luogo[] = luoghiJson as Luogo[];
export const RETE: readonly CaposaldoRete[] = (capisaldiJson as unknown as { rete_corbella: CaposaldoRete[] }).rete_corbella;
export const LONTANI: readonly CaposaldoLontano[] = (capisaldiJson as unknown as { lontani_di_notte: CaposaldoLontano[] }).lontani_di_notte;
export const LATI: readonly Lato[] = (capisaldiJson as unknown as { lati: Lato[] }).lati;
export const PERSONAGGI: readonly Personaggio[] = personaggiJson as Personaggio[];
export const ELEMENTI_MOBILI: readonly ElementoMobile[] = (fadeJson as unknown as { elementi_mobili: ElementoMobile[] }).elementi_mobili;
export const GIRO_FADE: readonly PassaggioFade[] = (fadeJson as unknown as { giro_corbella: PassaggioFade[] }).giro_corbella;

type Testi = Record<string, Record<string, { titolo?: string; testo?: string; supporto?: string }>>;
export const TESTI = testiJson as unknown as Testi;

const perId = new Map(LUOGHI.map((l) => [l.id, l]));

/** Luogo per id (eccezione se manca: i contenuti sono la fonte unica). */
export function luogo(id: string): Luogo {
  const l = perId.get(id);
  if (!l) throw new Error(`popolamento: luogo sconosciuto «${id}»`);
  return l;
}

export function luogoOpz(id: string): Luogo | undefined {
  return perId.get(id);
}

/** Caposaldo (rete o lontano) per id `cs_N`. */
export function caposaldo(id: string): CaposaldoRete | CaposaldoLontano | undefined {
  return RETE.find((c) => c.id === id) ?? LONTANI.find((c) => c.id === id);
}

/** Id del testo (cartellini, scritte, lettere…) se esiste in testi.json. */
export function testoEsiste(id: string): boolean {
  return Object.values(TESTI).some((sez) => typeof sez === 'object' && sez !== null && id in sez);
}

/** "HH:MM" -> ore decimali (NaN se non è un orario). */
export function ore(s: string | undefined): number {
  if (!s) return Number.NaN;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return Number.NaN;
  return Number(m[1]) + Number(m[2]) / 60;
}
