/**
 * La notte vista dalla regia: gli sciami di Fade del popolamento (`corbella.notte`: escono dalle
 * bocche alle 22:05, seguono il giro di fade_fase1.json, rientrano alle 04:30) e la lanterna di
 * Tecla. Il popolamento li muove; qui si leggono per il controllo «un cerchio di Fade resta 3 s
 * nel campo visivo» e per l'audio (quanto sono vicine).
 *
 * Le regole (che cosa cambia di notte) stanno nel catasto (`src/rilievo`).
 */
import { Vector3 } from 'three';
import type { Notte } from '../popolamento';

export class NotteVista {
  constructor(private readonly notte: Notte) {}

  /** Centri degli sciami visibili (mondo). */
  get visibili(): Vector3[] {
    const out: Vector3[] = [];
    for (const s of this.notte.sciami) if (s.visible) out.push(s.getWorldPosition(new Vector3()));
    return out;
  }

  /** La lanterna di Tecla, se si vede adesso. */
  get tecla(): Vector3 | null {
    const t = this.notte.tecla;
    return t?.visibile ? t.pos.clone() : null;
  }

  /** Quante Fade ci sono attorno a un punto (0-1), per l'audio. */
  vicine(p: Vector3): number {
    let k = 0;
    for (const c of this.visibili) k = Math.max(k, 1 - Math.min(1, c.distanceTo(p) / 120));
    return k;
  }
}
