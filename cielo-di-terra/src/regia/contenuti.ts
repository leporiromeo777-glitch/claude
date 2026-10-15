/**
 * I contenuti della Fase 1 (content/*.json) caricati una volta e indicizzati per la regia.
 *
 * Qui non c'è logica di gioco: solo tipi larghi (i JSON del design possono crescere) e
 * piccoli indici (luogo per id, testo per id in qualunque sezione, capisaldi, elementi mobili).
 */
import capisaldiJson from '../../content/capisaldi.json';
import dialoghiJson from '../../content/dialoghi.json';
import fadeJson from '../../content/fade_fase1.json';
import luoghiJson from '../../content/luoghi.json';
import missioniJson from '../../content/missioni.json';
import personaggiJson from '../../content/personaggi.json';
import taccuinoJson from '../../content/taccuino.json';
import testiJson from '../../content/testi.json';

export interface Luogo {
  id: string;
  nome: string;
  z: number;
  theta: number;
  altezza: number;
  raggio: number;
  tipo: string;
  zona?: string;
  cella?: number | null;
  descrizione?: string;
}

export interface Personaggio {
  id: string;
  nome: string;
  ruolo?: string;
  come_appare?: Record<string, string> | string;
  voce?: unknown;
  posizioni?: { fase: string; luogo: string; dalle?: string; alle?: string; nota?: string; condizione?: string }[];
  gruppo?: string;
}

export interface Caposaldo {
  id: string;
  numero: number;
  tipo: 'pilastro' | 'chiodo' | string;
  nome: string;
  luogo?: string;
  z: number;
  theta: number;
  altezza: number;
  altezza_segnale?: number;
  cella?: number;
  visibile_da?: string[];
  non_visibile_da?: { id: string; motivo: string }[];
  monografia?: string;
  note?: string;
}

export interface Lato {
  id: string;
  a: string;
  b: string;
  lunghezza: number;
  chiudibile: boolean;
  quando?: string;
  nota?: string;
  particelle: number[];
}

export interface CaposaldoLontano {
  id: string;
  numero: number;
  nome: string;
  z: number;
  theta: number;
  altezza: number;
  valle?: string;
  lume: string;
  lume_descrizione?: string;
  ore?: string;
  attivo_fase1?: boolean;
}

export interface VoceTesto {
  titolo?: string;
  supporto?: string;
  testo?: string;
  schizzo?: string;
  nota_2322?: string;
  traduzione?: string;
  quadri?: { figure?: string; testo: string }[];
  condizione?: string;
  alla_fine?: string[];
  chiusura?: string;
}

export interface Battuta {
  chi: string;
  testo: string;
  risposta_elvira?: string;
  replica?: string;
  quando?: string;
}

export interface ElementoMobile {
  id: string;
  nome: string;
  particelle: number[];
  varianti: { id: string; descrizione?: string; pezzi?: string[] }[];
  variante_iniziale: string;
  ora_fade?: string;
  stadi?: string[];
  cicli_del_giorno?: { ora: string; chi: string; da: string; a: string; testo?: string }[];
  via_necessaria?: boolean;
  alternativa?: string;
}

export interface PassaggioNotte {
  ora: string;
  evento?: string;
  elemento?: string;
  particelle?: number[];
  da?: string;
  a?: string;
  motivo?: string;
  se?: string;
}

export interface Notte {
  notte: number;
  giorno: number;
  inizio: string;
  fine: string;
  giro: PassaggioNotte[];
  pesarina?: { ora: string; flag?: string };
}

export interface ParticellaArea {
  id: number;
  catasto?: string;
  iz: number;
  itheta: number;
  centro: { z: number; theta: number; altezza: number };
  tipo?: string;
  nomi?: string[];
  hub?: boolean;
  rifugio?: boolean;
  mobile?: boolean;
  elemento?: string | null;
  stato_iniziale?: string;
  rilevata_da?: string | null;
}

export const LUOGHI = luoghiJson as unknown as Luogo[];
export const PERSONAGGI = personaggiJson as unknown as Personaggio[];
export const DIALOGHI = dialoghiJson as unknown as Record<string, { personaggio: string; nodi: { id: string; testo: string; didascalia?: string; chi?: string }[] }>;
export const MISSIONI = missioniJson as unknown;
export const TACCUINO = taccuinoJson as unknown as Record<string, unknown>;
export const TESTI = testiJson as unknown as Record<string, unknown>;

const cap = capisaldiJson as unknown as { rete_corbella: Caposaldo[]; lati: Lato[]; lontani_di_notte: CaposaldoLontano[]; regole: Record<string, unknown> };
export const CAPISALDI = cap.rete_corbella;
export const LATI = cap.lati;
export const LONTANI = cap.lontani_di_notte;
export const CAPISALDI_JSON = capisaldiJson as unknown as Record<string, unknown>;

const fade = fadeJson as unknown as {
  elementi_mobili: ElementoMobile[];
  notti: Notte[];
  giro_corbella: { ora: string; dove: string; elemento?: string | string[]; che_cosa: string }[];
  resoconto_del_mattino: { titolo: string; righe: Record<string, string> };
  inventario_corbella: { particelle: number[] };
  particelle: ParticellaArea[];
};
export const ELEMENTI_MOBILI = fade.elementi_mobili;
export const NOTTI = fade.notti;
export const GIRO_CORBELLA = fade.giro_corbella;
export const RESOCONTO = fade.resoconto_del_mattino;
export const INVENTARIO_CORBELLA = fade.inventario_corbella.particelle;
export const PARTICELLE_AREA = fade.particelle;

/** Contenuti per il motore della storia (narrativa). */
export const CONTENUTI_NARRATIVA = { missioni: missioniJson, dialoghi: dialoghiJson, taccuino: taccuinoJson, testi: testiJson };

const luoghiPerId = new Map(LUOGHI.map((l) => [l.id, l]));
export function luogo(id: string): Luogo | undefined {
  return luoghiPerId.get(id);
}

const personaggiPerId = new Map(PERSONAGGI.map((p) => [p.id, p]));
export function personaggio(id: string): Personaggio | undefined {
  return personaggiPerId.get(id);
}

const capisaldiPerId = new Map(CAPISALDI.map((c) => [c.id, c]));
export function caposaldo(id: string): Caposaldo | undefined {
  return capisaldiPerId.get(id);
}

/** Cerca una voce di testi.json per id, in qualunque sezione (come vuole la `_nota` del file). */
export function testo(id: string): { sezione: string; voce: VoceTesto } | null {
  for (const [sezione, v] of Object.entries(TESTI)) {
    if (sezione.startsWith('_') || !v || typeof v !== 'object' || Array.isArray(v)) continue;
    const voce = (v as Record<string, unknown>)[id];
    if (voce && typeof voce === 'object') return { sezione, voce: voce as VoceTesto };
  }
  return null;
}

export function battuta(id: string): Battuta | null {
  const b = (TESTI['battute'] as Record<string, Battuta> | undefined)?.[id];
  return b ?? null;
}

export function suggerimento(id: string): string | null {
  return (TESTI['suggerimenti'] as Record<string, string> | undefined)?.[id] ?? null;
}

export function elementoMobile(id: string): ElementoMobile | undefined {
  return ELEMENTI_MOBILI.find((e) => e.id === id);
}

/** «HH:MM» → ore decimali. */
export function oreDa(testo: string): number {
  const m = /^(\d{1,2})(?::(\d{2}))?/.exec(testo.trim());
  if (!m) return Number.NaN;
  return Number(m[1]) + Number(m[2] ?? 0) / 60;
}

/** Ore decimali → «HH:MM». */
export function testoOra(ore: number): string {
  const h = ((ore % 24) + 24) % 24;
  let hh = Math.floor(h);
  let mm = Math.round((h - hh) * 60);
  if (mm === 60) {
    mm = 0;
    hh = (hh + 1) % 24;
  }
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Che cosa copre, secondo i contenuti, il segnale di `mira` visto da `stazione`
 * («il tasso del sagrato», «la tettoia di piode del lavatoio»), o null se nulla lo copre.
 */
export function ostacoloFra(stazione: string | null, mira: string): string | null {
  if (!stazione) return null;
  const n = caposaldo(mira)?.non_visibile_da?.find((x) => x.id === stazione);
  if (!n) return null;
  const chi = (n.motivo.split(/\s+copre\b/)[0] ?? '').split(',')[0]?.trim() ?? '';
  return chi ? chi.charAt(0).toLowerCase() + chi.slice(1) : 'qualcosa';
}
