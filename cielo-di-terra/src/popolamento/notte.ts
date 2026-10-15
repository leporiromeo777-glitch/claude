/**
 * La notte di Corbella: le Fade (due sciami di lumi caldi che escono dalle bocche alle 22:05, fanno
 * il giro di `fade_fase1.json → giro_corbella` e rientrano alle 04:30), le bocche nei prati, e la
 * lanterna di Tecla che cammina sul vetro della Finestra delle Vedove dalle 23:00 alle 02:00.
 *
 * Gli sciami sono quelli della libreria (`creaSciameFade`, istanziati, con i loro materiali e gli
 * aloni additivi); la lanterna di Tecla è un bagliore del motore (`LampGlows`) che si sposta.
 */
import * as THREE from 'three';
import { creaSciameFade } from '../oggetti/oggetti/fade';
import { Costruttore, mat } from '../oggetti/costruttore';
import { geoBoxC, geoCilindro } from '../oggetti/forme';
import { PALETTE } from '../oggetti/palette';
import { LampGlows } from '../render/lamps';
import type { WorldUniforms } from '../render/uniforms';
import { LONTANI, luogo } from './contenuti';
import type { Contesto } from './contesto';
import { mondo, suolo } from './terreno';

interface Tappa {
  ora: number;
  z: number;
  theta: number;
  quota: number;
  raggio: number;
}

/** Il giro delle Fade di Corbella per sciame (ore decimali, anche oltre la mezzanotte: 24 + h). */
const GIRO: Tappa[][] = [
  // sciame della bocca delle Terrazze
  [
    { ora: 22.08, z: 975, theta: 20, quota: 1.5, raggio: 2 },
    { ora: 22.33, z: 990, theta: 27.6, quota: 4, raggio: 9 },
    { ora: 22.83, z: 1010, theta: 28.4, quota: 4, raggio: 10 },
    { ora: 23.33, z: 1000, theta: 27.6, quota: 6, raggio: 12 },
    { ora: 26.0, z: 820, theta: 10, quota: 14, raggio: 18 },
    { ora: 27.5, z: 840, theta: 12, quota: 10, raggio: 14 },
    { ora: 28.5, z: 975, theta: 20, quota: 1.5, raggio: 2 },
  ],
  // sciame della bocca del Ronco
  [
    { ora: 22.08, z: 1215, theta: 41, quota: 1.5, raggio: 2 },
    { ora: 23.33, z: 1166, theta: 52.6, quota: 3, raggio: 7 },
    { ora: 23.83, z: 1170, theta: 54.5, quota: 3, raggio: 9 },
    { ora: 24.5, z: 1186, theta: 46.0, quota: 3.0, raggio: 6 },
    { ora: 24.85, z: 1170, theta: 44.8, quota: 3.5, raggio: 8 },
    { ora: 25.17, z: 1152, theta: 43.6, quota: 3, raggio: 7 },
    { ora: 26.0, z: 830, theta: 12, quota: 12, raggio: 16 },
    { ora: 28.5, z: 1215, theta: 41, quota: 1.5, raggio: 2 },
  ],
];

export interface Notte {
  sciami: THREE.Object3D[];
  /** dove le Fade attive scaldano il suolo (centro di ogni sciame, coordinate mondo); restituisce quanti */
  lumiFade(out: THREE.Vector3[]): number;
  /** forza la presenza delle Fade (null = segue l'ora) */
  fade: boolean | null;
  tecla: { pos: THREE.Vector3; visibile: boolean } | null;
  update(dt: number, ora: number): void;
  dispose(): void;
}

export function costruisciNotte(ctx: Contesto, uniforms: WorldUniforms | undefined): Notte {
  // bocche nei prati: botole tonde di ferro fra l'erba
  for (const [z, th, nome] of [
    [1215, 41, 'bocca_ronco'],
    [975, 20, 'bocca_terrazze'],
  ] as const) {
    const b = new Costruttore(z);
    b.aggiungi(geoCilindro(0.85, 0.9, 0.12, 12), { matrice: mat([0, 0.0, 0]), colore: 0x4a4440, piatto: true });
    b.aggiungi(geoCilindro(0.7, 0.7, 0.06, 12), { matrice: mat([0, 0.1, 0]), colore: PALETTE.ferro, piatto: true });
    for (let k = 0; k < 4; k++) b.aggiungi(geoBoxC(1.3, 0.03, 0.06), { matrice: mat([0, 0.16, 0], [0, (k * Math.PI) / 4, 0]), colore: 0x3a3634, piatto: true });
    ctx.posa('notte', b.costruisci(nome), z, th, 0, { collider: false });
    ctx.punto(`guarda:${nome}`, 'guarda', 'Una bocca nel prato', mondo(z, th, suolo(z, th) + 0.2), { raggio: 2, rif: nome, attivo: false });
  }
  const sciami: THREE.Object3D[] = [];
  const oggetti: Array<ReturnType<typeof creaSciameFade>> = [];
  GIRO.forEach((giro, i) => {
    const s = creaSciameFade({ seme: `fade-${i}`, numero: 18, raggio: 6, quota: 3, conPietra: i === 1 ? 0.45 : 0.2, scala: 1.15 });
    const g = new THREE.Group();
    g.name = `fade:${i}`;
    g.add(s.gruppo);
    g.visible = false;
    ctx.dinamici.add(g);
    sciami.push(g);
    oggetti.push(s);
    void giro;
  });
  // la lanterna di Tecla
  let tecla: Notte['tecla'] = null;
  let bagliore: LampGlows | null = null;
  const nicchia = LONTANI.find((c) => c.id === 'cs_35');
  if (nicchia) {
    tecla = { pos: mondo(nicchia.z - 30, nicchia.theta, 1.6), visibile: false };
    if (uniforms) {
      bagliore = new LampGlows(uniforms);
      bagliore.setLamps([tecla.pos], [2.2]);
      bagliore.points.name = 'lanterna-tecla';
      bagliore.points.visible = false;
      ctx.dinamici.add(bagliore.points);
    }
  }
  void luogo;
  let t = 0;
  const centri = GIRO.map(() => new THREE.Vector3());
  const notte: Notte = {
    sciami,
    lumiFade(out) {
      let n = 0;
      sciami.forEach((g, i) => {
        if (!g.visible || n >= out.length) return;
        // il centro dello sciame, alzato a metà della quota di volo
        const up = centri[i]!.set(-g.position.x, -g.position.y, 0).normalize();
        out[n++]!.copy(g.position).addScaledVector(up, 2.6);
      });
      return n;
    },
    fade: null,
    tecla,
    update(dt, ora) {
      t += dt;
      // Fade
      const h = ora < 12 ? ora + 24 : ora;
      GIRO.forEach((giro, i) => {
        const g = sciami[i]!;
        const s = oggetti[i]!;
        const attivo = notte.fade ?? (h >= giro[0]!.ora && h <= giro[giro.length - 1]!.ora);
        g.visible = attivo;
        if (!attivo) return;
        let a = giro[0]!;
        let b = giro[giro.length - 1]!;
        for (let k = 0; k < giro.length - 1; k++) {
          if (h >= giro[k]!.ora && h <= giro[k + 1]!.ora) {
            a = giro[k]!;
            b = giro[k + 1]!;
            break;
          }
        }
        const u = Math.min(1, Math.max(0, (h - a.ora) / Math.max(1e-3, b.ora - a.ora)));
        // resta sull'elemento per gran parte del tratto, poi si sposta
        const v = u < 0.75 ? 0 : (u - 0.75) / 0.25;
        const z = a.z + (b.z - a.z) * v;
        const th = a.theta + (b.theta - a.theta) * v;
        const centro = mondo(z, th, suolo(z, th) + 0.5);
        g.position.copy(centro);
        // orienta lo sciame con il «su» locale (la libreria vola in +Y)
        const up = new THREE.Vector3(-centro.x, -centro.y, 0).normalize();
        g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
        s.update?.(dt, { centro: new THREE.Vector3(0, a.quota + (b.quota - a.quota) * v, 0) });
      });
      // Tecla: 23:00-02:00, avanti e indietro lungo il vetro, si ferma vicino alla nicchia
      if (tecla && nicchia) {
        const vis = h >= 23 && h <= 26;
        tecla.visibile = vis;
        if (vis) {
          const fase = ((h - 23) / 3) * Math.PI * 2;
          const dz = -34 + 30 * (0.5 - 0.5 * Math.cos(fase));
          tecla.pos.copy(mondo(nicchia.z + dz, nicchia.theta + Math.sin(t * 0.05) * 0.05, suolo(nicchia.z + dz, nicchia.theta) + 1.6));
        }
        if (bagliore) {
          bagliore.points.visible = vis;
          const attr = bagliore.points.geometry.getAttribute('position') as THREE.BufferAttribute;
          attr.setXYZ(0, tecla.pos.x, tecla.pos.y, tecla.pos.z);
          attr.needsUpdate = true;
        }
      }
    },
    dispose() {
      for (const s of oggetti) s.dispose();
      bagliore?.points.geometry.dispose();
    },
  };
  return notte;
}
