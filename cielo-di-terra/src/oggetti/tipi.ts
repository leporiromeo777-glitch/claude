/**
 * Tipi comuni della libreria di oggetti procedurali.
 *
 * Convenzioni:
 * - Tutte le misure sono in metri, nelle coordinate LOCALI dell'oggetto.
 * - «Su» è +Y (verso l'asse del cilindro, una volta posato); il suolo è il piano y = 0.
 * - Il «davanti» di un oggetto (porta di un rustico, prua della barca, viso di un abitante) guarda +Z,
 *   salvo dove indicato.
 */
import type * as THREE from 'three';

/** Terna di numeri in coordinate locali. */
export type Vec3 = [number, number, number];

/**
 * Collider semplice in coordinate locali dell'oggetto.
 * - `box`: parallelepipedo con centro e semiassi, ruotato solo attorno a Y (rotY in radianti).
 * - `cilindro`: cilindro verticale (asse parallelo a Y) con il centro della base, il raggio e l'altezza.
 *
 * `tag` suggerisce al motore come trattarlo: 'muro', 'tetto', 'calpestabile', 'arrampicabile',
 * 'tronco', 'acqua', 'porta', 'botola', 'caposaldo', 'personaggio' …
 */
export type Collider =
  | { tipo: 'box'; centro: Vec3; mezze: Vec3; rotY?: number; tag?: string }
  | { tipo: 'cilindro'; base: Vec3; raggio: number; altezza: number; tag?: string };

/**
 * Porta di un oggetto, in coordinate locali (migliorie «porte»): dove e come si entra. Serve alle
 * verifiche (soglia sul suolo, spazio libero davanti, niente muri sopra il battente) e a chi posa
 * l'oggetto nel paese (un annesso non deve coprire la porta di una casa).
 */
export interface PortaOggetto {
  /** nome della porta nell'oggetto: 'porta', 'scala', 'lobbia', 'portale'… */
  nome: string;
  /** centro della soglia sul filo esterno del muro (la sua y è la quota della soglia) */
  centro: THREE.Vector3;
  /** normale orizzontale, verso fuori */
  normale: THREE.Vector3;
  larghezza: number;
  altezza: number;
  /** dove sta la faccia del battente rispetto al filo del muro, lungo la normale (negativo = incassato) */
  battente: number;
  /** su che cosa poggia la soglia, fuori: il suolo, il pianerottolo di una scala, una lobbia */
  appoggio: 'suolo' | 'scala' | 'balcone';
}

/** Ingombro grossolano, utile per culling, distanze di LOD e piazzamento. */
export interface Ingombro {
  /** raggio orizzontale massimo dal punto d'appoggio */
  raggio: number;
  /** altezza massima sopra il suolo */
  altezza: number;
  /** quanto la geometria scende sotto y = 0 per coprire i pendii (fondazione, pali, radici) */
  interrata: number;
}

/**
 * Risultato di ogni generatore.
 * `S` è il tipo dello stato passato a `update` (per gli oggetti animati).
 */
export interface OggettoProcedurale<S = undefined> {
  /** nome del generatore, es. 'rustico' */
  nome: string;
  /** seme usato (stesse opzioni + stesso seme = stessa geometria) */
  seme: number;
  /** la radice da aggiungere alla scena; y = 0 è il suolo */
  gruppo: THREE.Group;
  /** collider in coordinate locali del gruppo */
  collider: Collider[];
  /** punto d'appoggio al suolo (coordinate locali; di norma l'origine) */
  appoggio: THREE.Vector3;
  ingombro: Ingombro;
  /** punti notevoli in coordinate locali (porta, chiodo del caposaldo, cima della palina, lume…) */
  punti: Record<string, THREE.Vector3>;
  /** le porte dell'oggetto (coordinate locali), se ne ha */
  porte?: PortaOggetto[];
  /**
   * animazione procedurale (solo per gli oggetti animati). Dichiarata come metodo così che un
   * OggettoProcedurale<StatoX> si possa mettere in una lista di OggettoProcedurale<unknown>.
   */
  update?(dt: number, stato?: S): void;
  /** libera geometrie (i materiali sono condivisi e non vengono liberati) */
  dispose(): void;
}
