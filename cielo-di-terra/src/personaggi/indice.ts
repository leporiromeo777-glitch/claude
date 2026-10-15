/**
 * L'indice dei personaggi generati (public/personaggi/indice.json, scritto da tools/personaggi/indice.py):
 * quali GLB ci sono, quanto sono alti, con quali indicazioni per l'animatore.
 *
 *   const indice = await caricaIndice('./personaggi/');
 *   const voce = indice.personaggi.find((p) => p.id === 'togna');
 *   const m = await caricaPersonaggio(urlPersonaggio(voce, './personaggi/'), opzioniDaIndice(voce, { colore: 'grezzo' }));
 *   m.update(dt, { curvo: voce.curvo, ...stato });
 */
import type { NomeOsso } from './ossa';
import type { OpzioniCaricamento } from './carica';

export type VoltoPersonaggio = 'velo' | 'maschera' | 'scoperto';

export interface VoceIndice {
  /** id del personaggio (come in content/personaggi.json; i generici: velata_donna, velato_gerla, velato_maschera, velato_cappuccio) */
  readonly id: string;
  /** file GLB, relativo alla cartella dell'indice */
  readonly file: string;
  /** livello di dettaglio basso: nello stesso file, SkinnedMesh «lod1» */
  readonly lod1: { readonly file: string; readonly mesh: 'lod1'; readonly triangoli: number };
  readonly lod0: { readonly mesh: 'lod0'; readonly triangoli: number };
  /** altezza in metri (cima della testa o del cappello) */
  readonly altezza: number;
  /** le 17 ossa (uguali per tutti, vedi NOMI_OSSA) */
  readonly ossa: readonly NomeOsso[];
  readonly kb: number;
  readonly generatore: string;
  readonly proporzioni: 'adulto' | 'bambino';
  readonly volto: VoltoPersonaggio;
  /** veste lunga: passo più corto (OpzioniAnimatore.gonna) */
  readonly gonna: boolean;
  /** gradi delle braccia a riposo dalla verticale (OpzioniAnimatore.apertura) */
  readonly apertura: number;
  /** postura di riposo 0..1 (StatoPersonaggio.curvo) */
  readonly curvo: number;
  /** oggetti di scena procedurali da attaccare alle ossa, «nome@osso» (non sono nel modello) */
  readonly oggetti: readonly string[];
  readonly note: string;
}

export interface IndicePersonaggi {
  readonly versione: number;
  readonly unita: string;
  readonly orientamento: string;
  readonly ossa: readonly NomeOsso[];
  readonly totale_kb: number;
  readonly personaggi: readonly VoceIndice[];
}

/** Scarica l'indice (cartella con la barra finale, per esempio './personaggi/'). */
export async function caricaIndice(cartella = './personaggi/'): Promise<IndicePersonaggi> {
  const r = await fetch(`${cartella}indice.json`);
  if (!r.ok) throw new Error(`indice dei personaggi: ${r.status}`);
  return (await r.json()) as IndicePersonaggi;
}

/** URL del GLB di una voce. */
export function urlPersonaggio(voce: VoceIndice, cartella = './personaggi/'): string {
  return `${cartella}${voce.file}`;
}

/** Opzioni di caricaPersonaggio() dalle indicazioni dell'indice (gonna, apertura), più le proprie. */
export function opzioniDaIndice(voce: VoceIndice, altre: OpzioniCaricamento = {}): OpzioniCaricamento {
  return { gonna: voce.gonna, apertura: voce.apertura, ...altre };
}
