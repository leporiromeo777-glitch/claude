/**
 * La notte vista: gli sciami di Fade (src/oggetti) che fanno il loro giro di Corbella alle ore
 * di fade_fase1.json (escono dalle bocche alle 22:05, le Terrazze alle 22:20, il riale alle
 * 23:20, i Ronchi alle 00:30, le Selve alte alle 02:00, rientrano alle 04:30).
 *
 * Le regole (che cosa cambia) stanno nel catasto (`PortaRilievo.avanzaTempo`); qui c'è solo
 * ciò che si vede, e il controllo «un cerchio di Fade resta 3 s nel campo visivo».
 */
import { Group, Vector3, type Scene } from 'three';
import { creaSciameFade, impostaIntensitaLumi, posaSulCilindro, type OggettoProcedurale } from '../oggetti';
import { cylToWorld } from '../world/cylinder';
import { groundHeight } from '../world/terrain';

export interface TappaFade {
  /** Ora d'inizio e durata (ore). */
  da: number;
  durata: number;
  z: number;
  theta: number;
  raggio: number;
}

/** Il giro di Corbella (fade_fase1.json → giro_corbella e notti). */
export const GIRO: TappaFade[] = [
  { da: 22 + 5 / 60, durata: 0.25, z: 1215, theta: 41, raggio: 7 },
  { da: 22 + 5 / 60, durata: 0.25, z: 975, theta: 20, raggio: 7 },
  { da: 22 + 20 / 60, durata: 0.5, z: 1000, theta: 28, raggio: 9 },
  { da: 23 + 20 / 60, durata: 0.5, z: 1163, theta: 51.9, raggio: 9 },
  { da: 0.5, durata: 0.67, z: 1188, theta: 46, raggio: 9 },
  { da: 0.5, durata: 0.67, z: 1150, theta: 43.5, raggio: 8 },
  { da: 2, durata: 0.67, z: 800, theta: 9, raggio: 14 },
  { da: 4.5, durata: 0.2, z: 1215, theta: 41, raggio: 6 },
];

export function tappeAttive(ore: number): TappaFade[] {
  return GIRO.filter((t) => {
    const fine = t.da + t.durata;
    return fine <= 24 ? ore >= t.da && ore < fine : ore >= t.da || ore < fine - 24;
  });
}

export class NotteVista {
  readonly gruppo = new Group();
  private sciami: OggettoProcedurale<{ centro?: Vector3 }>[] = [];
  private centri: Vector3[] = [];

  constructor(scene: Scene) {
    this.gruppo.name = 'fade';
    scene.add(this.gruppo);
    for (let i = 0; i < 3; i++) {
      const s = creaSciameFade({ seme: `giro-${i}`, numero: 14, raggio: 7, quota: 3 });
      s.gruppo.visible = false;
      this.gruppo.add(s.gruppo);
      this.sciami.push(s);
    }
  }

  /** Centri degli sciami visibili (mondo). */
  get visibili(): Vector3[] {
    return this.centri;
  }

  update(dt: number, ore: number, notte: number): void {
    impostaIntensitaLumi(Math.max(0, Math.min(1, notte)));
    const attive = notte > 0.5 ? tappeAttive(ore) : [];
    this.centri = [];
    this.sciami.forEach((s, i) => {
      const t = attive[i];
      if (!t) {
        s.gruppo.visible = false;
        return;
      }
      const h = groundHeight(t.z, t.theta);
      if (!s.gruppo.visible || s.gruppo.userData['tappa'] !== `${t.z},${t.theta}`) {
        posaSulCilindro(s.gruppo, t.z, t.theta, h);
        s.gruppo.userData['tappa'] = `${t.z},${t.theta}`;
      }
      s.gruppo.visible = true;
      s.update?.(dt, {});
      this.centri.push(cylToWorld(t.z, t.theta, h + 3));
    });
  }

  /** Quante Fade ci sono attorno a un punto (0-1), per l'audio. */
  vicine(p: Vector3): number {
    let k = 0;
    for (const c of this.centri) k = Math.max(k, 1 - Math.min(1, c.distanceTo(p) / 120));
    return k;
  }
}
