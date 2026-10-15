/**
 * Controlli dello sguardo (FASE1 §2.4): «lo sguardo resta 1,5 s sulla scritta del vetro»,
 * «più di 50° sopra l'orizzonte locale per 1,5 s», «la lente resta 1 s su un punto d'esame»,
 * «un cerchio di Fade resta 3 s nel campo visivo».
 *
 * Ogni controllo accumula il tempo in cui la condizione tiene e scatta una volta sola.
 * Logica pura su vettori.
 */
import { Vector3 } from 'three';

export interface ControlloSguardo {
  id: string;
  /** Punto da guardare (mondo) o null se il controllo non è un punto (vedi `prova`). */
  posizione?: Vector3 | (() => Vector3 | null);
  /** Raggio del bersaglio (m): il cono consentito è atan(raggio / distanza). */
  raggio?: number;
  /** Distanza massima dagli occhi (m). */
  distanza?: number;
  /** Cono minimo (gradi), utile per i bersagli lontani: «nel campo visivo» = 25°. */
  conoMinimo?: number;
  /** Secondi di sguardo continuo. */
  durata: number;
  /** Se falso il controllo è sospeso (e il tempo si azzera). */
  attivo?: () => boolean;
  /** Prova personalizzata (al posto del punto): vero se lo sguardo «tiene». */
  prova?: (occhio: Vector3, avanti: Vector3) => boolean;
  /** Chiamata una volta quando il tempo è raggiunto. */
  compiuto: () => void;
  /** Se vero il controllo resta e può scattare ancora (dopo che lo sguardo si è staccato). */
  ripetibile?: boolean;
}

const _d = new Vector3();

/** Vero se lo sguardo cade sul punto `p` (cono del raggio o minimo). */
export function guardaPunto(occhio: Vector3, avanti: Vector3, p: Vector3, raggio: number, distanzaMax = Infinity, conoMinimoGradi = 0): boolean {
  _d.subVectors(p, occhio);
  const dist = _d.length();
  if (dist > distanzaMax) return false;
  if (dist < 1e-3) return true;
  const ang = Math.acos(Math.max(-1, Math.min(1, _d.dot(avanti) / dist)));
  const cono = Math.max(Math.atan2(raggio, dist), conoMinimoGradi * (Math.PI / 180));
  return ang <= cono;
}

/** Elevazione dello sguardo sopra l'orizzonte locale (gradi), con `su` = verso l'asse. */
export function elevazione(avanti: Vector3, su: Vector3): number {
  return Math.asin(Math.max(-1, Math.min(1, avanti.dot(su)))) * (180 / Math.PI);
}

export class Sguardi {
  private controlli = new Map<string, ControlloSguardo>();
  private tempi = new Map<string, number>();
  private scattati = new Set<string>();

  registra(c: ControlloSguardo): () => void {
    this.controlli.set(c.id, c);
    this.tempi.delete(c.id);
    return () => this.togli(c.id);
  }

  togli(id: string): void {
    this.controlli.delete(id);
    this.tempi.delete(id);
  }

  ha(id: string): boolean {
    return this.controlli.has(id);
  }

  /** Secondi accumulati per un controllo (per il debug e i test). */
  tempo(id: string): number {
    return this.tempi.get(id) ?? 0;
  }

  update(dt: number, occhio: Vector3, avanti: Vector3): void {
    for (const c of [...this.controlli.values()]) {
      if (c.attivo && !c.attivo()) {
        this.tempi.delete(c.id);
        continue;
      }
      let tiene: boolean;
      if (c.prova) tiene = c.prova(occhio, avanti);
      else {
        const p = typeof c.posizione === 'function' ? c.posizione() : c.posizione;
        tiene = !!p && guardaPunto(occhio, avanti, p, c.raggio ?? 0.3, c.distanza ?? Infinity, c.conoMinimo ?? 0);
      }
      if (!tiene) {
        this.tempi.delete(c.id);
        if (c.ripetibile) this.scattati.delete(c.id);
        continue;
      }
      if (c.ripetibile && this.scattati.has(c.id)) continue;
      const t = (this.tempi.get(c.id) ?? 0) + dt;
      this.tempi.set(c.id, t);
      if (t >= c.durata) {
        this.tempi.delete(c.id);
        if (c.ripetibile) this.scattati.add(c.id);
        else this.controlli.delete(c.id);
        c.compiuto();
      }
    }
  }
}
