/**
 * La visibilità: «linea libera?» fra due punti.
 *
 * Il catasto non conosce il terreno né i collisori: la visibilità la fornisce il gioco con
 * una funzione (un raycast sul terreno e sui collider, vedi README). Per i test e come
 * ripiego c'è `visibilitaDaTabella`, che usa la tabella `visibile_da` / `non_visibile_da`
 * di capisaldi.json. Qui stanno anche i lumi lontani (ore di accensione, Collare).
 */
import { caposaldoDef } from './regole';
import { dentroIntervalloMinuti, formattaOra } from './tempo';
import type { DefCaposaldo, RegoleCatasto } from './tipi';

/** Un punto da cui o verso cui si mira. `id` c'è quando il punto è un caposaldo. */
export interface PuntoMira {
  id?: string;
  z: number;
  theta: number;
  /** Quota del caposaldo (o del punto) sopra il fondo. */
  altezza: number;
  /** Altezza del segnale da collimare sopra il punto (palina, disco); 0 per un chiodo. */
  altezzaSegnale?: number;
}

export interface ContestoVisibilita {
  scopo: 'lato' | 'lume' | 'appunto' | 'triangolo' | 'stazione_libera';
  /** Ora di gioco in minuti dalla mezzanotte. */
  ora: number;
}

/** true / false, oppure un esito con il motivo leggibile («Il tasso del sagrato copre la cella»). */
export type EsitoVisibilita = boolean | { libera: boolean; motivo?: string };

/** La funzione «linea libera?» che il gioco passa al catasto. */
export type FunzioneVisibilita = (da: PuntoMira, a: PuntoMira, contesto: ContestoVisibilita) => EsitoVisibilita;

export function normalizzaEsito(e: EsitoVisibilita): { libera: boolean; motivo: string | null } {
  if (typeof e === 'boolean') return { libera: e, motivo: null };
  return { libera: !!e.libera, motivo: e.motivo ?? null };
}

export const MOTIVO_COPERTO = 'Da qui non si vede: qualcosa copre la mira.';

/**
 * Visibilità dalla tabella dei contenuti: `a` si vede da `da` se `da` è in `a.visibile_da`
 * (o viceversa, la tabella è simmetrica); `non_visibile_da` dà il motivo leggibile.
 * Per i punti che non sono capisaldi la tabella non sa rispondere: serve il raycast del gioco.
 */
export function visibilitaDaTabella(regole: RegoleCatasto, nuovi: Readonly<Record<string, DefCaposaldo>> = {}): FunzioneVisibilita {
  return (da, a) => {
    if (!da.id || !a.id) {
      return { libera: false, motivo: 'La tabella di visibilità conosce solo i capisaldi: per un punto libero serve il raycast del gioco.' };
    }
    const A = caposaldoDef(regole, nuovi, a.id);
    const D = caposaldoDef(regole, nuovi, da.id);
    const blocco = A?.nonVisibileDa.find((n) => n.id === da.id) ?? D?.nonVisibileDa.find((n) => n.id === a.id);
    if (blocco) return { libera: false, motivo: blocco.motivo || MOTIVO_COPERTO };
    if (A?.visibileDa.includes(da.id) || D?.visibileDa.includes(a.id)) return true;
    return { libera: false, motivo: MOTIVO_COPERTO };
  };
}

/** Il punto da collimare di un caposaldo (il segnale sopra il bronzo o l'ottone). */
export function puntoDi(c: DefCaposaldo): PuntoMira {
  return { id: c.id, z: c.z, theta: c.theta, altezza: c.altezza, altezzaSegnale: c.altezzaSegnale };
}

/** «Pilastro 14», «chiodo 7», «Caposaldo Zero», «chiodo E1». */
export function nomeBreve(c: DefCaposaldo): string {
  if (c.tipo === 'zero') return 'Caposaldo Zero';
  if (c.tipo === 'pilastro') return `Pilastro ${c.etichetta}`;
  return `chiodo ${c.etichetta}`;
}

/** Con la maiuscola, per l'inizio di una frase. */
export function nomeBreveMaiuscolo(c: DefCaposaldo): string {
  const n = nomeBreve(c);
  return n.charAt(0).toUpperCase() + n.slice(1);
}

export interface EsitoLume {
  acceso: boolean;
  codice?: 'buio' | 'collare';
  motivo?: string;
}

/**
 * Il lume di un pilastro lontano si vede a quest'ora? (capisaldi.json → lontani_di_notte:
 * `lume` permanente o di Ottavio, `ore`, `collare`).
 */
export function lumeVisibile(c: DefCaposaldo, ora: number, lumiDiOttavio: readonly string[] = []): EsitoLume {
  const nome = nomeBreveMaiuscolo(c);
  const l = c.lume;
  if (!l || l.tipo === 'nessuno' || !l.ore) return { acceso: false, codice: 'buio', motivo: `${nome} non ha un lume: di notte non si vede.` };
  if (l.tipo === 'ottavio' && !lumiDiOttavio.includes(c.id)) {
    return { acceso: false, codice: 'buio', motivo: `${nome} è buio: serve il lume di mira di Ottavio.` };
  }
  if (l.tipo === 'permanente' && !dentroIntervalloMinuti(ora, l.ore)) {
    return { acceso: false, codice: 'buio', motivo: `Il lume di ${nome.charAt(0).toLowerCase()}${nome.slice(1)} a quest'ora è spento.` };
  }
  for (const iv of l.collare) {
    if (dentroIntervalloMinuti(ora, iv)) {
      return { acceso: false, codice: 'collare', motivo: `Il Collare copre ${nomeBreve(c)} fino alle ${formattaOra(iv[1])}.` };
    }
  }
  return { acceso: true };
}

/** Verifica la linea libera con la funzione del gioco o, in sua assenza, con la tabella. */
export function lineaLiberaFra(
  regole: RegoleCatasto,
  nuovi: Readonly<Record<string, DefCaposaldo>>,
  fn: FunzioneVisibilita | undefined,
  da: PuntoMira,
  a: PuntoMira,
  contesto: ContestoVisibilita,
): { libera: boolean; motivo: string | null } {
  const f = fn ?? visibilitaDaTabella(regole, nuovi);
  return normalizzaEsito(f(da, a, contesto));
}

/** Il caposaldo per id (contenuti o chiodi nuovi), con un errore leggibile. */
export function trovaCaposaldo(regole: RegoleCatasto, nuovi: Readonly<Record<string, DefCaposaldo>>, id: string): DefCaposaldo | undefined {
  return caposaldoDef(regole, nuovi, id);
}
