/**
 * I luoghi di content/luoghi.json nel mondo: posizione, quota efficace e «luogo raggiunto».
 *
 * Le quote dei luoghi sono state calcolate su una versione precedente del terreno: alcune
 * (la Terrazza Pedrazzini, il Sass Grand) stanno oggi 20-80 m sotto il suolo. Per i luoghi
 * all'aperto la regia usa quindi la quota vera del terreno; tiene la quota dei contenuti
 * solo per gli interni (la Cripta, sotto terra), per la cella campanaria e per il cielo.
 */
import { Vector3 } from 'three';
import type { Collider, ColliderWorld } from '../world/colliders';
import { cylToWorld, surfaceDistance, upAt } from '../world/cylinder';
import { groundHeight } from '../world/terrain';
import { LUOGHI, type Luogo } from './contenuti';

/** Luoghi che stanno davvero alla quota scritta nei contenuti (non sul terreno). */
const QUOTA_DAI_CONTENUTI = new Set(['cella_campanaria']);

/** Quota efficace di un luogo (m verso l'asse). */
export function quotaLuogo(l: Luogo, suolo: (z: number, theta: number) => number = groundHeight): number {
  if (l.tipo === 'interno' || l.tipo === 'cielo' || QUOTA_DAI_CONTENUTI.has(l.id)) return l.altezza;
  return suolo(l.z, l.theta);
}

/** Posizione mondo del luogo (alla quota efficace). */
export function posizioneLuogo(l: Luogo, out = new Vector3()): Vector3 {
  return cylToWorld(l.z, l.theta, quotaLuogo(l), out);
}

/**
 * Elvira (piedi a (z, theta, h)) è dentro il raggio del luogo? Distanza sulla superficie
 * entro il raggio e quota entro max(raggio, 6) m: chi plana alto sopra la piazza non c'è
 * ancora, chi sta sul muretto sì.
 */
export function dentroLuogo(l: Luogo, z: number, theta: number, h: number, quota = quotaLuogo(l)): boolean {
  const d = surfaceDistance(z, theta, l.z, l.theta);
  if (d > l.raggio) return false;
  const tolleranza = l.tipo === 'interno' ? Math.max(3, l.raggio * 0.5) : Math.max(l.raggio, 6);
  return Math.abs(h - quota) <= tolleranza;
}

/** Indice dei luoghi con le quote efficaci precalcolate. */
export class Luoghi {
  readonly tutti: readonly Luogo[];
  private quote = new Map<string, number>();

  constructor(luoghi: readonly Luogo[] = LUOGHI, suolo: (z: number, theta: number) => number = groundHeight) {
    this.tutti = luoghi;
    for (const l of luoghi) this.quote.set(l.id, quotaLuogo(l, suolo));
  }

  get(id: string): Luogo | undefined {
    return this.tutti.find((l) => l.id === id);
  }

  quota(id: string): number {
    return this.quote.get(id) ?? 0;
  }

  posizione(id: string, out = new Vector3()): Vector3 | null {
    const l = this.get(id);
    if (!l) return null;
    return cylToWorld(l.z, l.theta, this.quota(id), out);
  }

  dentro(id: string, z: number, theta: number, h: number): boolean {
    const l = this.get(id);
    return !!l && dentroLuogo(l, z, theta, h, this.quota(id));
  }

  /** Tutti i luoghi in cui si trova adesso Elvira. */
  doveSono(z: number, theta: number, h: number): string[] {
    return this.tutti.filter((l) => dentroLuogo(l, z, theta, h, this.quota(l.id))).map((l) => l.id);
  }

  /** Il luogo più vicino con un nome da mostrare (pausa, salvataggio). */
  piuVicino(z: number, theta: number, tipi?: readonly string[]): Luogo | null {
    let best: Luogo | null = null;
    let bd = Infinity;
    for (const l of this.tutti) {
      if (tipi && !tipi.includes(l.tipo)) continue;
      const d = surfaceDistance(z, theta, l.z, l.theta) - l.raggio;
      if (d < bd) {
        bd = d;
        best = l;
      }
    }
    return best;
  }
}

const _p = new Vector3();
const _d = new Vector3();
const _u = new Vector3();
const _t = new Vector3();
const _q: Collider[] = [];

/** Collisori su cui si sta in piedi: i ripiani delle terrazze, i gradini dei sentieri. */
const CALPESTABILI = new Set(['calpestabile', 'gradino']);

/**
 * Quota d'appoggio in (z, θ): il terreno del motore o, se più in alto (fino a 8 m), la cima di un
 * ripiano o di un gradino del popolamento (le terrazze riempite stanno sopra il terreno). Serve ai
 * teletrasporti della regia, che altrimenti lascerebbero Elvira ai piedi del muro della terrazza.
 */
export function quotaAppoggio(colliders: ColliderWorld | null, z: number, theta: number, suolo: (z: number, theta: number) => number = groundHeight): number {
  let h = suolo(z, theta);
  if (!colliders) return h;
  cylToWorld(z, theta, h, _p);
  upAt(theta, _u);
  for (const c of colliders.query(z, theta, 2, _q)) {
    if (c.kind !== 'box' || !CALPESTABILI.has(c.tag ?? '')) continue;
    _d.subVectors(_p, c.center);
    if (Math.abs(_d.dot(c.right)) > c.half.x || Math.abs(_d.dot(c.forward)) > c.half.z) continue;
    _t.copy(c.center).addScaledVector(c.up, c.half.y);
    const ht = h + _t.sub(_p).dot(_u);
    if (ht > h && ht < suolo(z, theta) + 8) h = ht;
  }
  return h;
}
