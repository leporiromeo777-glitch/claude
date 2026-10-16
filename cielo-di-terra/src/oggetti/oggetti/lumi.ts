/**
 * Lanterne e lumi notturni del paese: lampione su palo, lanterna a braccio da muro, lanterna appesa,
 * lanterna a mano a petrolio (quella di Ottavio), lanterna di prua delle barche, cappelletta votiva
 * con il lumino. Vetri e fiamme stanno nel canale `lume` (si accendono con impostaIntensitaLumi),
 * l'alone è uno sprite additivo; la luce puntiforme vera è facoltativa (`luce: true`).
 */
import * as THREE from 'three';
import { Costruttore, mat, matSegmento, mescola } from '../costruttore';
import { box, cil, creaAlone, creaLuceLume, ingombroDa, risultato } from '../comune';
import { geoBoxC, geoCilindro, geoCono, geoLastra, geoSfera, geoToro, geoTubo } from '../forme';
import { PALETTE } from '../palette';
import { Rng, semeNumerico, type Seme } from '../rng';
import { leggiIntensitaLumi } from '../materiali';
import type { Collider, OggettoProcedurale } from '../tipi';
import { SUP } from '../superfici';

export type TipoLanterna = 'palo' | 'muro' | 'appesa' | 'mano' | 'prua' | 'nicchia';

export interface OpzioniLanterna {
  tipo?: TipoLanterna;
  seme?: Seme;
  /** aggiunge una PointLight calda (solo per i primi piani) */
  luce?: boolean;
  /** alone additivo attorno alla fiamma (predefinito sì) */
  alone?: boolean;
  /** altezza del palo (tipo 'palo') */
  altezza?: number;
}

export interface StatoLume {
  /** 0 spento, 1 acceso (se assente segue impostaIntensitaLumi) */
  accesa?: number;
}

/**
 * Testa di lanterna a quattro vetri, nel sistema m (base a y = 0), scala s (1 = 34 cm di altezza).
 * Restituisce la posizione locale della fiamma.
 */
export function testaLanterna(b: Costruttore, m: THREE.Matrix4, s = 1, metallo: number = PALETTE.ferro): THREE.Vector3 {
  const w = 0.2 * s;
  const h = 0.24 * s;
  b.aggiungi(geoBoxC(w + 0.04 * s, 0.03 * s, w + 0.04 * s), { matrice: m.clone().multiply(mat([0, 0.015 * s, 0])), colore: metallo, superficie: SUP.METALLO, piatto: true });
  b.aggiungi(geoCono(0.06 * s, 0.05 * s, 4), { matrice: m.clone().multiply(mat([0, -0.05 * s, 0], [Math.PI, Math.PI / 4, 0])), colore: metallo, superficie: SUP.METALLO, piatto: true });
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    b.aggiungi(geoBoxC(0.018 * s, h, 0.018 * s), { matrice: m.clone().multiply(mat([(x * w) / 2, 0.03 * s + h / 2, (z * w) / 2])), colore: metallo, superficie: SUP.METALLO, piatto: true });
  }
  // vetri (volume luminoso) e fiamma
  b.aggiungi(geoBoxC(w - 0.01 * s, h - 0.01 * s, w - 0.01 * s), {
    matrice: m.clone().multiply(mat([0, 0.03 * s + h / 2, 0])),
    colore: PALETTE.lumeCaldo,
    canale: 'lume', superficie: SUP.VETRO,
    gradiente: { basso: 1.0, alto: 0.7, y0: 0, y1: h },
  });
  const fiamma = geoSfera(0.03 * s, 6, 4);
  fiamma.scale(1, 1.8, 1);
  const pf = new THREE.Vector3(0, 0.03 * s + h * 0.42, 0);
  b.aggiungi(fiamma, { matrice: m.clone().multiply(mat(pf)), colore: PALETTE.lumeFiamma, canale: 'lume', superficie: SUP.VETRO });
  // cappello a piramide con camino e anello
  b.aggiungi(geoCono(w * 0.85, 0.11 * s, 4), { matrice: m.clone().multiply(mat([0, 0.03 * s + h, 0], [0, Math.PI / 4, 0])), colore: metallo, superficie: SUP.METALLO, piatto: true });
  b.aggiungi(geoCilindro(0.025 * s, 0.025 * s, 0.05 * s, 6), { matrice: m.clone().multiply(mat([0, 0.03 * s + h + 0.08 * s, 0])), colore: metallo, superficie: SUP.METALLO });
  b.aggiungi(geoToro(0.03 * s, 0.006 * s, 4, 8), { matrice: m.clone().multiply(mat([0, 0.03 * s + h + 0.16 * s, 0])), colore: metallo, superficie: SUP.METALLO });
  return pf.applyMatrix4(m);
}

/** Lanterna a mano a petrolio (vetro a globo, base d'ottone, manico). Restituisce la fiamma. */
export function lanternaPetrolio(b: Costruttore, m: THREE.Matrix4, s = 1): THREE.Vector3 {
  b.aggiungi(geoCilindro(0.075 * s, 0.085 * s, 0.07 * s, 12), { matrice: m, colore: PALETTE.ottone, superficie: SUP.OTTONE, gradiente: { basso: 0.8, alto: 1.1, y0: 0, y1: 0.07 * s } });
  const profilo = [
    new THREE.Vector2(0.045 * s, 0),
    new THREE.Vector2(0.07 * s, 0.05 * s),
    new THREE.Vector2(0.075 * s, 0.1 * s),
    new THREE.Vector2(0.06 * s, 0.15 * s),
    new THREE.Vector2(0.035 * s, 0.18 * s),
  ];
  const globo = new THREE.LatheGeometry(profilo, 10);
  globo.deleteAttribute('uv');
  b.aggiungi(globo, { matrice: m.clone().multiply(mat([0, 0.07 * s, 0])), colore: PALETTE.lumeCaldo, canale: 'lume', superficie: SUP.VETRO, gradiente: { basso: 1, alto: 0.75, y0: 0, y1: 0.3 } });
  const fiamma = geoSfera(0.022 * s, 6, 4);
  fiamma.scale(1, 1.9, 1);
  const pf = new THREE.Vector3(0, 0.07 * s + 0.07 * s, 0);
  b.aggiungi(fiamma, { matrice: m.clone().multiply(mat(pf)), colore: PALETTE.lumeFiamma, canale: 'lume', superficie: SUP.VETRO });
  // gabbia
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const p0 = new THREE.Vector3(Math.cos(a) * 0.08 * s, 0.07 * s, Math.sin(a) * 0.08 * s).applyMatrix4(m);
    const p1 = new THREE.Vector3(Math.cos(a) * 0.05 * s, 0.26 * s, Math.sin(a) * 0.05 * s).applyMatrix4(m);
    b.aggiungi(geoCilindro(0.005 * s, 0.005 * s, 1, 3), { matrice: matSegmento(p0, p1), colore: PALETTE.ottoneScuro, superficie: SUP.OTTONE });
  }
  b.aggiungi(geoCilindro(0.045 * s, 0.06 * s, 0.035 * s, 10), { matrice: m.clone().multiply(mat([0, 0.25 * s, 0])), colore: PALETTE.ottone, superficie: SUP.OTTONE });
  b.aggiungi(geoCono(0.045 * s, 0.04 * s, 10), { matrice: m.clone().multiply(mat([0, 0.285 * s, 0])), colore: PALETTE.ottoneScuro, superficie: SUP.OTTONE });
  b.aggiungi(geoToro(0.08 * s, 0.006 * s, 4, 12, Math.PI), { matrice: m.clone().multiply(mat([0, 0.3 * s, 0])), colore: PALETTE.ottoneScuro, superficie: SUP.OTTONE });
  return pf.applyMatrix4(m);
}

/** Lanterna o lume del paese. */
export function creaLanterna(opz: OpzioniLanterna = {}): OggettoProcedurale<StatoLume> {
  const tipo = opz.tipo ?? 'palo';
  const seme = semeNumerico(opz.seme ?? `lanterna-${tipo}`);
  const rng = new Rng(seme);
  const b = new Costruttore(rng);
  const collider: Collider[] = [];
  let fiamma = new THREE.Vector3();
  let dimAlone = 1.2;
  let intensitaLuce = 2.5;

  switch (tipo) {
    case 'palo': {
      const h = opz.altezza ?? 3.0;
      b.aggiungi(geoLastra(0.38, 0.5, 0.38, rng.intero(0, 1e6), 0.05), { matrice: mat([0, -0.2, 0]), colore: PALETTE.gneiss, superficie: SUP.PIETRA, gradiente: { basso: 0.75, alto: 1, y0: -0.2, y1: 0.3 }, piatto: true });
      b.aggiungi(geoCilindro(0.045, 0.06, h, 7), { matrice: mat([0, 0.25, 0]), colore: PALETTE.ferro, superficie: SUP.METALLO, gradiente: { basso: 0.8, alto: 1.1, y0: 0, y1: h } });
      b.aggiungi(geoToro(0.07, 0.015, 4, 8), { matrice: mat([0, 0.6, 0], [Math.PI / 2, 0, 0]), colore: PALETTE.ferroChiaro, superficie: SUP.METALLO });
      // braccio a ricciolo
      const pts = [new THREE.Vector3(0, h - 0.1, 0), new THREE.Vector3(0.15, h + 0.12, 0), new THREE.Vector3(0.4, h + 0.18, 0), new THREE.Vector3(0.55, h + 0.08, 0)];
      b.aggiungi(geoTubo(pts, [0.025, 0.022, 0.02, 0.018], 5), { colore: PALETTE.ferro, superficie: SUP.METALLO });
      const ricciolo = geoToro(0.08, 0.012, 4, 10, Math.PI * 1.4);
      b.aggiungi(ricciolo, { matrice: mat([0.12, h - 0.06, 0]), colore: PALETTE.ferro, superficie: SUP.METALLO });
      b.aggiungi(geoCilindro(0.008, 0.008, 0.12, 3), { matrice: mat([0.55, h - 0.04, 0]), colore: PALETTE.ferro, superficie: SUP.METALLO });
      fiamma = testaLanterna(b, mat([0.55, h - 0.42, 0]), 1.15);
      collider.push(cil(0, -0.2, 0, 0.2, h + 0.5, 'palo'));
      dimAlone = 1.6;
      break;
    }
    case 'muro': {
      // origine sul muro (faccia z = 0), il braccio sporge verso +Z
      b.aggiungi(geoBoxC(0.12, 0.3, 0.03), { matrice: mat([0, 0, 0.015]), colore: PALETTE.ferro, superficie: SUP.METALLO, piatto: true });
      const pts = [new THREE.Vector3(0, 0.1, 0.02), new THREE.Vector3(0, 0.2, 0.25), new THREE.Vector3(0, 0.12, 0.45)];
      b.aggiungi(geoTubo(pts, [0.018, 0.016, 0.014], 5), { colore: PALETTE.ferro, superficie: SUP.METALLO });
      b.aggiungi(geoTubo([new THREE.Vector3(0, -0.12, 0.02), new THREE.Vector3(0, -0.02, 0.2), new THREE.Vector3(0, 0.15, 0.33)], [0.012, 0.012, 0.01], 4), { colore: PALETTE.ferro, superficie: SUP.METALLO });
      fiamma = testaLanterna(b, mat([0, -0.3, 0.45]), 0.9);
      dimAlone = 1.2;
      intensitaLuce = 1.8;
      break;
    }
    case 'appesa': {
      // origine al gancio; la catena scende
      for (let k = 0; k < 4; k++) {
        b.aggiungi(geoToro(0.025, 0.006, 3, 6), { matrice: mat([0, -0.04 - k * 0.05, 0], [0, (k % 2) * (Math.PI / 2), 0]), colore: PALETTE.ferro, superficie: SUP.METALLO });
      }
      fiamma = testaLanterna(b, mat([0, -0.62, 0]), 1.0);
      dimAlone = 1.3;
      break;
    }
    case 'mano': {
      fiamma = lanternaPetrolio(b, new THREE.Matrix4(), 1.1);
      dimAlone = 0.9;
      intensitaLuce = 1.6;
      collider.push(cil(0, 0, 0, 0.1, 0.35, 'oggetto'));
      break;
    }
    case 'prua': {
      b.aggiungi(geoCilindro(0.025, 0.03, 0.55, 6), { colore: PALETTE.legnoScuro, superficie: SUP.LEGNO });
      fiamma = testaLanterna(b, mat([0, 0.55, 0]), 0.9, PALETTE.ottoneScuro);
      dimAlone = 1.1;
      break;
    }
    case 'nicchia': {
      // cappelletta votiva: pilastro di pietra intonacato, nicchia ad arco, tettuccio di piode, lumino
      const hp = 1.9;
      b.aggiungi(geoLastra(0.75, hp + 0.3, 0.55, rng.intero(0, 1e6), 0.02), {
        matrice: mat([0, -0.3, 0]),
        colore: PALETTE.intonacoVecchio,
        gradiente: { basso: 0.7, alto: 1.02, y0: 0, y1: hp },
        rumore: 0.04,
        piatto: true,
      });
      // nicchia: fondo scuro dipinto con un cielo azzurro-stellato semplificato
      const fondo = new THREE.ShapeGeometry(
        (() => {
          const s = new THREE.Shape();
          s.moveTo(-0.22, 0);
          s.lineTo(0.22, 0);
          s.lineTo(0.22, 0.42);
          s.absarc(0, 0.42, 0.22, 0, Math.PI, false);
          s.lineTo(-0.22, 0);
          return s;
        })(),
        6,
      );
      fondo.deleteAttribute('uv');
      b.aggiungi(fondo, { matrice: mat([0, 1.05, 0.28]), colore: 0x3d5a86, gradiente: { basso: 0.6, alto: 1.0, y0: 1.05, y1: 1.7 } });
      b.aggiungi(geoLastra(0.5, 0.05, 0.16, rng.intero(0, 1e6), 0.05), { matrice: mat([0, 1.02, 0.32]), colore: PALETTE.gneissChiaro, superficie: SUP.PIETRA, piatto: true });
      // figurina stilizzata e lumino
      b.aggiungi(geoCono(0.07, 0.3, 6), { matrice: mat([0, 1.07, 0.32]), colore: PALETTE.calce });
      b.aggiungi(geoSfera(0.04, 6, 4), { matrice: mat([0, 1.4, 0.32]), colore: PALETTE.calce });
      b.aggiungi(geoCilindro(0.03, 0.03, 0.05, 6), { matrice: mat([0.13, 1.07, 0.36]), colore: PALETTE.vermiglio });
      const fi = geoSfera(0.018, 5, 3);
      fi.scale(1, 1.8, 1);
      fiamma = new THREE.Vector3(0.13, 1.15, 0.36);
      b.aggiungi(fi, { matrice: mat(fiamma), colore: PALETTE.lumeFiamma, canale: 'lume', superficie: SUP.VETRO });
      // tettuccio a due falde
      for (const s of [-1, 1]) {
        b.aggiungi(geoLastra(0.55, 0.06, 0.85, rng.intero(0, 1e6), 0.1), {
          matrice: mat([s * 0.2, hp + 0.08, 0], [0, 0, -s * 0.55]),
          colore: PALETTE.piode, superficie: SUP.PIODE,
          variazione: 0.08,
          piatto: true,
        });
      }
      collider.push(box(0, hp / 2 - 0.15, 0, 0.4, hp / 2 + 0.15, 0.3, 'muro'));
      dimAlone = 0.7;
      intensitaLuce = 1.0;
      break;
    }
  }

  const gruppo = b.costruisci(`lanterna-${tipo}`);
  let alone: THREE.Sprite | null = null;
  if (opz.alone ?? true) {
    alone = creaAlone(fiamma, dimAlone);
    gruppo.add(alone);
  }
  let luce: THREE.PointLight | null = null;
  if (opz.luce) {
    luce = creaLuceLume(fiamma, intensitaLuce, 9);
    gruppo.add(luce);
  }
  let t = rng.next() * 10;
  const update = (dt: number, stato?: StatoLume) => {
    t += dt;
    const acc = stato?.accesa ?? leggiIntensitaLumi();
    const tremolio = 1 + Math.sin(t * 13.1) * 0.04 + Math.sin(t * 7.3 + 1.3) * 0.05 + Math.sin(t * 23.7) * 0.02;
    if (alone) alone.scale.setScalar(dimAlone * tremolio * (0.6 + 0.4 * Math.min(1, acc)));
    if (luce) {
      luce.intensity = intensitaLuce * tremolio * acc;
      luce.visible = acc > 0.02;
    }
  };
  update(0);
  return risultato<StatoLume>({
    nome: `lanterna-${tipo}`,
    seme,
    gruppo,
    collider,
    ingombro: ingombroDa(gruppo),
    punti: { fiamma },
    update,
  });
}

/** Lume a terra / sul davanzale: candela in un vasetto (per decorare le soglie nelle processioni). */
export function creaLumino(seme: Seme = 'lumino'): OggettoProcedurale<StatoLume> {
  const rng = new Rng(seme);
  const b = new Costruttore(rng);
  b.aggiungi(geoCilindro(0.05, 0.04, 0.08, 8), { colore: mescola(PALETTE.vermiglio, 0x000000, 0.2) });
  b.aggiungi(geoCilindro(0.02, 0.02, 0.05, 6), { matrice: mat([0, 0.08, 0]), colore: PALETTE.calce });
  const f = geoSfera(0.015, 5, 3);
  f.scale(1, 1.8, 1);
  const pf = new THREE.Vector3(0, 0.15, 0);
  b.aggiungi(f, { matrice: mat(pf), colore: PALETTE.lumeFiamma, canale: 'lume', superficie: SUP.VETRO });
  const gruppo = b.costruisci('lumino');
  const alone = creaAlone(pf, 0.45);
  gruppo.add(alone);
  return risultato<StatoLume>({
    nome: 'lumino',
    seme: rng.seme,
    gruppo,
    collider: [],
    ingombro: ingombroDa(gruppo),
    punti: { fiamma: pf },
    update: (_dt, stato) => {
      alone.scale.setScalar(0.45 * (0.6 + 0.4 * Math.min(1, stato?.accesa ?? leggiIntensitaLumi())));
    },
  });
}
