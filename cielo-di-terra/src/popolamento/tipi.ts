/**
 * Tipi pubblici del popolamento di Corbella.
 *
 * `GiocoCorbella` è il sottoinsieme di `Game` (src/game.ts) che il popolamento usa: così si può
 * installare anche in un banco di prova senza WebGL (test in Node) passando un oggetto finto.
 */
import type { Camera, Material, Points, Scene, Vector3 } from 'three';
import type { ColliderWorld } from '../world/colliders';
import type { WorldUniforms } from '../render/uniforms';
import type { SkyState } from '../world/sky';
import type { TreeInstance } from '../scene/vegetation';

export interface GiocoCorbella {
  scene: Scene;
  world: { colliders: ColliderWorld };
  lamps: {
    points: Points;
    setLamps(list: Vector3[], sizes?: number[], dirs?: (Vector3 | null)[]): void;
    addLamps(list: Vector3[], sizes?: number[], dirs?: (Vector3 | null)[]): void;
  };
  uniforms?: WorldUniforms;
  materials?: Record<string, Material>;
  vegetation?: { trees: TreeInstance[]; update(cam: Vector3, force?: boolean): void };
  camera?: Camera;
  sky?: SkyState;
  clock?: { hours: number };
  simTime?: number;
  /** passo di simulazione del motore (viene avvolto se `agganciaCiclo`) */
  update?: (dt: number) => void;
  /**
   * sistemi del motore (`Game.sistemi`): il popolamento ci aggiunge un passo di disegno per la luce
   * calda delle Fade sul suolo (dopo che il motore ha scelto i lumi vicini)
   */
  sistemi?: Array<{ render?(frameDt: number): void }>;
}

/** Posizione nel gioco: (z, theta) e quota assoluta h. */
export interface PosCil {
  z: number;
  theta: number;
  h: number;
}

/** Tipi di punto d'interazione (per i suggerimenti «E» dell'integratore). */
export type AzionePunto =
  | 'leggi'
  | 'esamina'
  | 'lente'
  | 'apri'
  | 'entra'
  | 'sali'
  | 'scendi'
  | 'pianta_squadro'
  | 'parla'
  | 'dormi'
  | 'siediti'
  | 'taglia'
  | 'innesta'
  | 'prendi'
  | 'guarda'
  | 'attraversa'
  | 'lancio_velo';

/** Punto d'interazione con nome. */
export interface PuntoInterazione {
  /** id unico, es. 'leggi:targa_p1', 'chiodo:3', 'parla:ottavio', 'apri:botola' */
  id: string;
  azione: AzionePunto;
  /** etichetta breve per il suggerimento (italiano) */
  etichetta: string;
  /** posizione mondo (aggiornata per i personaggi che si muovono) */
  pos: Vector3;
  /** (z, theta, h) della posizione */
  cil: PosCil;
  /** raggio entro cui proporre l'interazione (m) */
  raggio: number;
  /** luogo dei contenuti (luoghi.json) se c'è */
  luogo?: string;
  /** riferimento nei contenuti: id di testi.json, caposaldo cs_N, personaggio, flag… */
  rif?: string;
  /** il punto è attivo (es. un personaggio fuori scena, una variante non presente → false) */
  attivo: boolean;
}

/** Gesti dei personaggi (quelli della libreria più 'seduto' e 'chino'). */
export type GestoNpc = 'nessuno' | 'saluta' | 'indica' | 'mano-al-petto';
export type PosaNpc = 'in-piedi' | 'seduto' | 'chino';
