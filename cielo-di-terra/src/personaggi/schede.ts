/**
 * Le schede dei tredici modelli della Fase 1 (docs/personaggi/BIBBIA.md) e la scelta del modello per un
 * abitante del popolamento: per i personaggi con un nome il modello è il loro (`ottavio`, `togna`…), per
 * i dodici velati di Corbella (`velato_1` … `velato_12`) uno dei quattro generici, scelto dal copricapo
 * e dagli oggetti delle opzioni procedurali (`OpzioniAbitante`).
 *
 * Tutto qui gira anche in Node (niente WebGL): lo usano i test.
 */
import type { OpzioniAbitante, Postura } from '../oggetti/oggetti/abitante';
import { Rng, semeNumerico } from '../oggetti/rng';
import type { PosaBraccia } from './animatore';

export interface SchedaModello {
  /** id del modello = nome del file (public/personaggi/<id>.glb) */
  readonly id: string;
  /** altezza della Bibbia (m); il GLB è già scalato così */
  readonly altezza: number;
  /** veste o gonna lunga: passo più corto, l'orlo ondeggia */
  readonly gonna: boolean;
  /** apertura delle braccia a riposo (gradi dalla verticale), abbastanza da non entrare nei fianchi */
  readonly apertura: number;
  /** uno dei quattro velati generici (si colora e si scala in varianti) */
  readonly generico: boolean;
  /** bambino: passo e respiro più rapidi */
  readonly bambino?: boolean;
}

/** I tredici modelli della Fase 1, con i valori della Bibbia (l'indice dei file può correggerli). */
export const SCHEDE: Readonly<Record<string, SchedaModello>> = {
  ottavio: { id: 'ottavio', altezza: 1.74, gonna: false, apertura: 8, generico: false },
  togna: { id: 'togna', altezza: 1.62, gonna: true, apertura: 11, generico: false },
  bortolo: { id: 'bortolo', altezza: 1.8, gonna: false, apertura: 12, generico: false },
  pina: { id: 'pina', altezza: 1.5, gonna: true, apertura: 10, generico: false },
  annunciata: { id: 'annunciata', altezza: 1.55, gonna: true, apertura: 10, generico: false },
  nando: { id: 'nando', altezza: 1.76, gonna: false, apertura: 9, generico: false },
  clelia: { id: 'clelia', altezza: 1.68, gonna: true, apertura: 8, generico: false },
  lisa: { id: 'lisa', altezza: 1.3, gonna: true, apertura: 9, generico: false, bambino: true },
  gioanin: { id: 'gioanin', altezza: 1.12, gonna: false, apertura: 10, generico: false, bambino: true },
  velata_donna: { id: 'velata_donna', altezza: 1.63, gonna: true, apertura: 10, generico: true },
  velato_gerla: { id: 'velato_gerla', altezza: 1.75, gonna: false, apertura: 11, generico: true },
  velato_maschera: { id: 'velato_maschera', altezza: 1.6, gonna: false, apertura: 10, generico: true },
  velato_cappuccio: { id: 'velato_cappuccio', altezza: 1.7, gonna: true, apertura: 12, generico: true },
};

/** I quattro generici, nell'ordine in cui si ripiega quando quello preferito manca. */
export const GENERICI = ['velata_donna', 'velato_gerla', 'velato_maschera', 'velato_cappuccio'] as const;
export type IdGenerico = (typeof GENERICI)[number];

/** Gli abitanti di gruppo del popolamento (`velato_N`, `velati_corbella`). */
export function eVelatoGenerico(chi: string): boolean {
  return /^velat[oi]_/.test(chi) && !(chi in SCHEDE);
}

/**
 * Il generico più adatto alle opzioni procedurali di un velato:
 * gerla o cappello di feltro → `velato_gerla`; maschera di castagno o bastone → `velato_maschera`;
 * cappuccio o velo da apicoltore → `velato_cappuccio`; velo di garza → `velata_donna`.
 * Senza copricapo decide il seme, come fa `creaAbitante`.
 */
export function genericoPer(opz: OpzioniAbitante): IdGenerico {
  if (opz.gerla) return 'velato_gerla';
  const copr = opz.copricapo ?? derivaProcedurale(opz).copricapo;
  switch (copr) {
    case 'cappello':
      return 'velato_gerla';
    case 'maschera':
    case 'maschera-liscia':
      return 'velato_maschera';
    case 'cappuccio':
    case 'apicoltore':
      return 'velato_cappuccio';
    default:
      return opz.bastone ? 'velato_maschera' : 'velata_donna';
  }
}

/**
 * Quale modello usare per l'abitante `chi` con le opzioni `opz`, fra quelli `disponibili`
 * (caricati). null = nessuno: chi chiama usa la figura procedurale.
 * - un id che ha un modello suo (`togna`, `nando`, anche `la_madre` se un giorno ci sarà) → quello;
 * - un velato generico → il generico adatto; se manca, il primo generico caricato nell'ordine di GENERICI
 *   (meglio un velato nuovo con la sagoma sbagliata che una figura a blocchi accanto ai modelli nuovi).
 */
export function scegliModello(chi: string, opz: OpzioniAbitante, disponibili: ReadonlySet<string>): string | null {
  if (disponibili.has(chi)) return chi;
  if (chi in SCHEDE) return null; // ha un modello suo, non ancora caricato
  if (!eVelatoGenerico(chi)) return null;
  const preferito = genericoPer(opz);
  if (disponibili.has(preferito)) return preferito;
  for (const g of GENERICI) if (disponibili.has(g)) return g;
  return null;
}

/** Larghezza per corporatura, la stessa di `creaAbitante` (raggio del collider = 0,3 · l). */
const LARGHEZZA: Record<NonNullable<OpzioniAbitante['corporatura']>, number> = {
  esile: 0.86,
  media: 1.0,
  robusta: 1.2,
  anziana: 0.98,
  bambino: 0.75,
};

export interface DerivatoProcedurale {
  corporatura: NonNullable<OpzioniAbitante['corporatura']>;
  copricapo: NonNullable<OpzioniAbitante['copricapo']>;
  postura: Postura;
  /** raggio del cilindro collider della figura procedurale (m) */
  raggio: number;
}

/**
 * Ripete le scelte casuali di `creaAbitante` (stesso seme, stessa sequenza): corporatura, copricapo,
 * postura e raggio del collider. Così un velato con il modello nuovo sta come stava la sua figura
 * procedurale e ha lo stesso ingombro per la fisica.
 */
export function derivaProcedurale(opz: OpzioniAbitante): DerivatoProcedurale {
  const rng = new Rng(semeNumerico(opz.seme ?? 'abitante'));
  const corporatura = opz.corporatura ?? rng.scegli(['esile', 'media', 'media', 'robusta', 'anziana'] as const);
  rng.centrato(0.04); // la variazione d'altezza delle proporzioni
  const copricapo = opz.copricapo ?? rng.scegli(['velo', 'velo', 'maschera', 'cappuccio', 'cappello', 'apicoltore'] as const);
  const postura: Postura = opz.postura ?? (corporatura === 'anziana' ? 'curva' : rng.scegli(['eretta', 'eretta', 'mani-giunte', 'braccia-conserte', 'mani-dietro'] as const));
  return { corporatura, copricapo, postura, raggio: 0.3 * LARGHEZZA[corporatura] };
}

/** La postura procedurale tradotta per l'animatore: quanto curvo e che posa delle braccia. */
export function posturaAnimatore(postura: Postura, corporatura?: OpzioniAbitante['corporatura']): { curvo: number; braccia: PosaBraccia } {
  switch (postura) {
    case 'curva':
      return { curvo: corporatura === 'anziana' ? 0.75 : 0.6, braccia: 'libere' };
    case 'mani-giunte':
    case 'braccia-conserte':
    case 'mani-dietro':
      return { curvo: corporatura === 'anziana' ? 0.35 : 0, braccia: postura };
    default:
      return { curvo: corporatura === 'anziana' ? 0.3 : 0, braccia: 'libere' };
  }
}

// --------------------------------------------------------------------- indice dei file

/** Una voce dell'indice dei modelli (public/personaggi/indice.json). */
export interface VoceIndice {
  id: string;
  /** nome del file relativo alla cartella personaggi/ (predefinito `<id>.glb`) */
  file: string;
  altezza?: number;
  gonna?: boolean;
  apertura?: number;
}

/**
 * Legge l'indice dei modelli, tollerante sulla forma (lo scrive la pipeline degli asset):
 * - `["togna", "nando"]`
 * - `{ "personaggi": ["togna", …] }`
 * - `{ "personaggi": [{ "id": "togna", "file": "togna.glb", "altezza": 1.62, "gonna": 0.09 }, …] }`
 * - `{ "personaggi": { "togna": { … } } }` oppure `{ "togna": { … }, … }`
 * `gonna` può essere un booleano o la quota dell'orlo (numero = sì, null = no); le chiavi che
 * cominciano con `_` sono commenti. Le voci senza id valido si scartano.
 */
export function leggiIndice(json: unknown): VoceIndice[] {
  const out: VoceIndice[] = [];
  const voce = (id: unknown, v: unknown) => {
    if (typeof id !== 'string' || !/^[a-z0-9_-]+$/i.test(id) || id.startsWith('_')) return;
    const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
    const file = [o['file'], o['glb'], o['url']].find((x): x is string => typeof x === 'string' && x.length > 0);
    const r: VoceIndice = { id, file: file ? file.replace(/^.*personaggi\//, '') : `${id}.glb` };
    if (typeof o['altezza'] === 'number' && o['altezza'] > 0.3 && o['altezza'] < 3) r.altezza = o['altezza'];
    if (typeof o['gonna'] === 'boolean') r.gonna = o['gonna'];
    else if (typeof o['gonna'] === 'number') r.gonna = true;
    else if (o['gonna'] === null) r.gonna = false;
    if (typeof o['apertura'] === 'number') r.apertura = o['apertura'];
    out.push(r);
  };
  const lista = (x: unknown): boolean => {
    if (Array.isArray(x)) {
      for (const e of x) {
        if (typeof e === 'string') voce(e, null);
        else if (e && typeof e === 'object') voce((e as Record<string, unknown>)['id'], e);
      }
      return true;
    }
    if (x && typeof x === 'object') {
      for (const [k, v] of Object.entries(x as Record<string, unknown>)) if (!k.startsWith('_') && (v === null || typeof v === 'object')) voce(k, v);
      return true;
    }
    return false;
  };
  if (Array.isArray(json)) lista(json);
  else if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>;
    const interni = o['personaggi'] ?? o['modelli'];
    if (!lista(interni ?? null) || interni === undefined) lista(o);
  }
  // un id una volta sola (vince la prima voce)
  const visti = new Set<string>();
  return out.filter((v) => (visti.has(v.id) ? false : (visti.add(v.id), true)));
}

/** I modelli che il repository contiene già (il pilota), usati se manca l'indice. */
export const MODELLI_SENZA_INDICE: readonly string[] = ['togna', 'nando'];
