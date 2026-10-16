/**
 * Contesto di costruzione: le zone (cantieri), i punti d'interazione, le impronte occupate, gli
 * oggetti animati e i sentieri. Lo riempiono i moduli dei luoghi; `installaCorbella` lo cuoce.
 */
import { Group, Matrix4, Vector3, type Object3D } from 'three';
import { matriceSuperficie } from '../oggetti/cilindro';
import type { OggettoProcedurale } from '../oggetti/tipi';
import { Cantiere, type OpzioniOggetto } from './cantiere';
import { cil, distanza, metriPerGrado, mondo, sposta, suolo, type PuntoCil } from './terreno';
import type { AzionePunto, PuntoInterazione } from './tipi';
import type { Collider } from '../world/colliders';

/** Impronta occupata (per non sovrapporre case e per togliere i castagni del motore). */
export interface Impronta {
  z: number;
  theta: number;
  /** rettangolo orientato (yaw bussola) o cerchio se `raggio` */
  yaw?: number;
  larghezza?: number;
  profondita?: number;
  raggio?: number;
  nome: string;
}

/** Sentiero: spezzata sul suolo (per i varchi nei muri e per le case). */
export interface TracciatoSentiero {
  nome: string;
  punti: PuntoCil[];
  larghezza: number;
}

/** Oggetto animato con aggiornamento per fotogramma. */
export interface Animato {
  nome: string;
  oggetto: Object3D;
  update?: (dt: number) => void;
}

export class Contesto {
  readonly zone = new Map<string, Cantiere>();
  readonly punti = new Map<string, PuntoInterazione>();
  readonly impronte: Impronta[] = [];
  readonly sentieri: TracciatoSentiero[] = [];
  /** oggetti con materiale proprio o animati (botola, lanterne, abitanti…) */
  readonly dinamici = new Group();
  readonly animati: Animato[] = [];
  /** dischi (z, theta, raggio) dove passa bassa la visuale di un lato del rilievo: niente case */
  readonly visuali: Array<{ z: number; theta: number; raggio: number }> = [];
  /** dove la visuale sfiora il suolo (< 1,6 m): niente muri delle terrazze */
  readonly visualiBasse: Array<{ z: number; theta: number; raggio: number }> = [];
  /** segnale di mira di ogni caposaldo (id `cs_N` → punto mondo): palina, disco o biffa sul chiodo */
  readonly segnali = new Map<string, Vector3>();
  /** collider di oggetti dinamici (fuori dai cantieri), con tag */
  readonly colliderDinamici: Array<{ collider: Collider; tag: string; luogo?: string }> = [];

  constructor() {
    this.dinamici.name = 'corbella:dinamici';
  }

  zona(nome: string): Cantiere {
    let c = this.zone.get(nome);
    if (!c) {
      c = new Cantiere(nome);
      this.zone.set(nome, c);
    }
    return c;
  }

  /**
   * Posa un oggetto della libreria nella zona: (z, theta) sul suolo + `sopra`, davanti verso `yaw`.
   * Restituisce i punti dell'oggetto in coordinate mondo.
   */
  posa(zona: string, o: OggettoProcedurale<unknown> | Object3D, z: number, theta: number, yaw: number, opz: OpzioniOggetto & { h?: number; sopra?: number } = {}): Record<string, Vector3> {
    const h = opz.h ?? suolo(z, theta) + (opz.sopra ?? 0);
    const m = matriceSuperficie(z, theta, h, yaw);
    return this.zona(zona).oggetto(o, m, opz);
  }

  /** Matrice di posa (libreria: davanti = +Z). */
  matrice(z: number, theta: number, h: number, yaw: number, scala = 1): Matrix4 {
    return matriceSuperficie(z, theta, h, yaw, scala);
  }

  /** Registra un punto d'interazione. */
  punto(id: string, azione: AzionePunto, etichetta: string, pos: Vector3, opz: { raggio?: number; luogo?: string; rif?: string; attivo?: boolean } = {}): PuntoInterazione {
    const c = cil(pos);
    const p: PuntoInterazione = {
      id,
      azione,
      etichetta,
      pos: pos.clone(),
      cil: { z: c.z, theta: c.theta, h: c.h },
      raggio: opz.raggio ?? 2,
      attivo: opz.attivo ?? true,
      ...(opz.luogo ? { luogo: opz.luogo } : {}),
      ...(opz.rif ? { rif: opz.rif } : {}),
    };
    this.punti.set(id, p);
    // il segnale di un chiodo, se il caposaldo non ne ha uno suo (palina, disco): la biffa tenuta
    // in piedi sul chiodo, 1,2 m (come nelle visuali dei lati)
    if (azione === 'pianta_squadro' && opz.rif?.startsWith('cs_') && !this.segnali.has(opz.rif)) {
      const su = new Vector3(-pos.x, -pos.y, 0).normalize();
      this.segnali.set(opz.rif, pos.clone().addScaledVector(su, 1.2));
    }
    return p;
  }

  /** Punto sul suolo a (z, theta) + `sopra`. */
  qui(z: number, theta: number, sopra = 0): Vector3 {
    return mondo(z, theta, suolo(z, theta) + sopra);
  }

  occupa(i: Impronta): void {
    this.impronte.push(i);
  }

  /** Vero se (z, theta) cade in un'impronta (con margine). */
  occupato(z: number, theta: number, margine = 0, salta?: string): boolean {
    for (const i of this.impronte) {
      if (salta && i.nome === salta) continue;
      if (i.raggio !== undefined) {
        if (distanza(i, { z, theta }) < i.raggio + margine) return true;
        continue;
      }
      const y = ((i.yaw ?? 0) * Math.PI) / 180;
      const dn = z - i.z;
      const de = ((theta - i.theta + 540) % 360 - 180) * metriPerGrado(40);
      const avanti = dn * Math.cos(y) + de * Math.sin(y);
      const destra = -dn * Math.sin(y) + de * Math.cos(y);
      if (Math.abs(avanti) <= (i.profondita ?? 0) / 2 + margine && Math.abs(destra) <= (i.larghezza ?? 0) / 2 + margine) return true;
    }
    return false;
  }

  /** Vero se (z, theta) cade in un corridoio di visuale (con margine). */
  inVisuale(z: number, theta: number, margine = 0, basse = false): boolean {
    for (const v of basse ? this.visualiBasse : this.visuali) if (distanza(v, { z, theta }) < v.raggio + margine) return true;
    return false;
  }

  /** Distanza minima (m) da un sentiero (fuorché quello di nome `tranne`). */
  distanzaSentieri(z: number, theta: number, tranne?: string): number {
    let best = Infinity;
    for (const s of this.sentieri) {
      if (s.nome === tranne) continue;
      for (let k = 0; k < s.punti.length - 1; k++) {
        const a = s.punti[k]!;
        const b = s.punti[k + 1]!;
        best = Math.min(best, distanzaSegmento({ z, theta }, a, b) - s.larghezza / 2);
      }
    }
    return best;
  }

  /** Aggiunge un oggetto animato/dinamico alla scena del popolamento. */
  animato(nome: string, oggetto: Object3D, update?: (dt: number) => void): Animato {
    oggetto.name = oggetto.name || nome;
    this.dinamici.add(oggetto);
    const a: Animato = { nome, oggetto, ...(update ? { update } : {}) };
    this.animati.push(a);
    return a;
  }
}

/** Distanza (m) di p dal segmento ab sul suolo. */
export function distanzaSegmento(p: PuntoCil, a: PuntoCil, b: PuntoCil): number {
  const k = metriPerGrado(40);
  const ax = 0;
  const ay = 0;
  const bx = ((b.theta - a.theta + 540) % 360 - 180) * k;
  const by = b.z - a.z;
  const px = ((p.theta - a.theta + 540) % 360 - 180) * k;
  const py = p.z - a.z;
  const l2 = bx * bx + by * by;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * bx + (py - ay) * by) / l2)) : 0;
  return Math.hypot(px - t * bx, py - t * by);
}

/** Punto a distanza `d` lungo il segmento ab (in metri). */
export function lungo(a: PuntoCil, b: PuntoCil, t: number): PuntoCil {
  const k = metriPerGrado(40);
  const de = ((b.theta - a.theta + 540) % 360 - 180) * k;
  return sposta(a.z, a.theta, (b.z - a.z) * t, de * t, 40);
}
