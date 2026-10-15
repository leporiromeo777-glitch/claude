/**
 * Salvataggio del catasto: un blob JSON versionato con un controllo d'integrità.
 *
 * Il blob contiene tutto lo stato (particelle, elementi, capisaldi, lati, triangoli, ancore,
 * mosse, contatori, l'ultima notte con il suo resoconto, l'eventuale notte in corso).
 * Le regole non si salvano: al caricamento, se si passano le regole, lo stato viene
 * riconciliato con i contenuti correnti (elementi nuovi o tolti, varianti rinominate).
 */
import { idValido } from './griglia';
import { statoIniziale } from './stato';
import type { RegoleCatasto, StatoCatasto } from './tipi';

export const FORMATO_SALVATAGGIO = 'cielo-di-terra/catasto';
export const VERSIONE_SALVATAGGIO = 1;

export interface BlobCatasto {
  formato: typeof FORMATO_SALVATAGGIO;
  versione: number;
  /** FNV-1a a 32 bit del JSON dello stato, in esadecimale. */
  controllo: string;
  stato: StatoCatasto;
}

export class ErroreSalvataggio extends Error {
  constructor(messaggio: string) {
    super(messaggio);
    this.name = 'ErroreSalvataggio';
  }
}

/** FNV-1a a 32 bit. */
export function impronta(testo: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < testo.length; i++) {
    h ^= testo.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function salvaCatasto(stato: StatoCatasto): BlobCatasto {
  const copia = structuredClone(stato);
  return { formato: FORMATO_SALVATAGGIO, versione: VERSIONE_SALVATAGGIO, controllo: impronta(JSON.stringify(copia)), stato: copia };
}

export function serializzaCatasto(stato: StatoCatasto): string {
  return JSON.stringify(salvaCatasto(stato));
}

/** Migrazioni da una versione alla successiva (per ora c'è solo la 1). */
const MIGRAZIONI: Record<number, (stato: Record<string, unknown>) => Record<string, unknown>> = {};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function verificaForma(s: Record<string, unknown>): void {
  const campi: [string, (v: unknown) => boolean][] = [
    ['giorno', (v) => typeof v === 'number'],
    ['nottiPassate', (v) => typeof v === 'number'],
    ['particelle', isObj],
    ['elementi', isObj],
    ['capisaldi', isObj],
    ['capisaldiNuovi', isObj],
    ['lati', isObj],
    ['triangoli', isObj],
    ['ancore', isObj],
    ['mosse', isObj],
    ['contatori', isObj],
    ['rilieviFatti', (v) => typeof v === 'number'],
    ['fogliRilevati', Array.isArray],
    ['lumiAppuntati', Array.isArray],
  ];
  for (const [k, ok] of campi) if (!ok(s[k])) throw new ErroreSalvataggio(`Salvataggio del catasto danneggiato: campo «${k}» mancante o non valido.`);
}

export interface OpzioniCaricamento {
  /** Accetta un controllo d'integrità sbagliato (con un avviso) invece di rifiutare il blob. */
  tollerante?: boolean;
}

/**
 * Ripristina lo stato da un blob (oggetto o testo JSON). Con le regole riconcilia lo stato con
 * i contenuti correnti e raccoglie gli avvisi. Lancia `ErroreSalvataggio` se il blob non è
 * del catasto, è di una versione futura o è danneggiato.
 */
export function caricaCatasto(
  blob: unknown,
  regole?: RegoleCatasto,
  opzioni: OpzioniCaricamento = {},
): { stato: StatoCatasto; avvisi: string[] } {
  const avvisi: string[] = [];
  let b: unknown = blob;
  if (typeof b === 'string') {
    try {
      b = JSON.parse(b);
    } catch {
      throw new ErroreSalvataggio('Il salvataggio del catasto non è JSON valido.');
    }
  }
  if (!isObj(b) || b.formato !== FORMATO_SALVATAGGIO) throw new ErroreSalvataggio('Questo non è un salvataggio del catasto.');
  const versione = typeof b.versione === 'number' ? b.versione : NaN;
  if (!Number.isInteger(versione) || versione < 1) throw new ErroreSalvataggio('Versione del salvataggio non valida.');
  if (versione > VERSIONE_SALVATAGGIO) throw new ErroreSalvataggio(`Il salvataggio è della versione ${versione}, più nuova di questo gioco (${VERSIONE_SALVATAGGIO}).`);
  if (!isObj(b.stato)) throw new ErroreSalvataggio('Salvataggio del catasto senza stato.');
  if (typeof b.controllo === 'string' && impronta(JSON.stringify(b.stato)) !== b.controllo) {
    if (!opzioni.tollerante) throw new ErroreSalvataggio('Il controllo del salvataggio non torna: il file è stato modificato o è danneggiato.');
    avvisi.push('Controllo del salvataggio non corrispondente: caricato lo stesso.');
  }
  let s = structuredClone(b.stato);
  for (let v = versione; v < VERSIONE_SALVATAGGIO; v++) {
    const m = MIGRAZIONI[v];
    if (!m) throw new ErroreSalvataggio(`Manca la migrazione dalla versione ${v}.`);
    s = m(s);
  }
  verificaForma(s);
  const stato = { ...s, versione: 1 } as unknown as StatoCatasto;
  if (!('ultimaNotte' in stato)) (stato as { ultimaNotte: null }).ultimaNotte = null;
  if (!('notteInCorso' in stato)) (stato as { notteInCorso: null }).notteInCorso = null;

  for (const k of Object.keys(stato.particelle)) {
    if (!idValido(Number(k))) {
      avvisi.push(`Particella ${k} non valida: tolta.`);
      delete stato.particelle[k];
    }
  }
  if (regole) {
    const base = statoIniziale(regole);
    for (const [id, e] of Object.entries(stato.elementi)) {
      const def = regole.elementi.get(id);
      if (!def) {
        avvisi.push(`L'elemento ${id} non c'è più nei contenuti: tolto.`);
        delete stato.elementi[id];
      } else if (!def.varianti.some((v) => v.id === e.variante)) {
        avvisi.push(`${def.nome}: la variante «${e.variante}» non esiste più, torna a «${def.varianteIniziale}».`);
        e.variante = def.varianteIniziale;
      }
    }
    for (const [id, e] of Object.entries(base.elementi)) {
      if (!stato.elementi[id]) {
        avvisi.push(`Elemento nuovo nei contenuti: ${id}.`);
        stato.elementi[id] = e;
      }
    }
    for (const [id, c] of Object.entries(base.capisaldi)) if (!stato.capisaldi[id]) stato.capisaldi[id] = c;
    for (const id of Object.keys(stato.capisaldi)) {
      if (!regole.capisaldi.has(id) && !stato.capisaldiNuovi[id]) avvisi.push(`Caposaldo ${id} sconosciuto ai contenuti: tenuto.`);
    }
    for (const [id, a] of Object.entries(base.ancore)) if (!stato.ancore[id]) stato.ancore[id] = a;
  }
  return { stato, avvisi };
}

export function deserializzaCatasto(testo: string, regole?: RegoleCatasto, opzioni?: OpzioniCaricamento): { stato: StatoCatasto; avvisi: string[] } {
  return caricaCatasto(testo, regole, opzioni);
}
