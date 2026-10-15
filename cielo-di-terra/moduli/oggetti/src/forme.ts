/**
 * Forme di base (geometrie three.js) usate dai generatori: massi, lastre, tubi a raggio variabile,
 * masse di fogliame, estrusioni, archi. Tutte a pochi poligoni.
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hashPosizione } from './rng';

/** Cilindro con la base a y = 0. */
export function geoCilindro(rSopra: number, rSotto: number, h: number, segmenti = 8, aperto = false): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rSopra, rSotto, h, segmenti, 1, aperto);
  g.translate(0, h / 2, 0);
  g.deleteAttribute('uv');
  return g;
}

/** Parallelepipedo con la base a y = 0. */
export function geoBox(w: number, h: number, d: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  g.deleteAttribute('uv');
  return g;
}

/** Parallelepipedo centrato. */
export function geoBoxC(w: number, h: number, d: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.deleteAttribute('uv');
  return g;
}

/**
 * Masso: icosaedro deformato, facce piatte. `schiaccia` riduce l'altezza (lastre, sassi da muro).
 */
export function geoMasso(raggio: number, seme: number, irregolarita = 0.3, dettaglio = 0, schiaccia = 1): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(raggio, dettaglio);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const h = hashPosizione(v.x, v.y, v.z, seme);
    const h2 = hashPosizione(v.z, v.x, v.y, seme + 17);
    const s = 1 + (h - 0.5) * 2 * irregolarita;
    v.multiplyScalar(s);
    v.x += (h2 - 0.5) * irregolarita * raggio * 0.3;
    v.y *= schiaccia;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

/**
 * Massa tondeggiante di fogliame: icosaedro suddiviso, gonfiato in modo irregolare, normali morbide.
 * `dettaglio` 1 = 80 triangoli, 2 = 320.
 */
export function geoMassa(raggio: number, seme: number, irregolarita = 0.18, dettaglio = 1, schiaccia = 0.85, normaliSferiche = 0.6): THREE.BufferGeometry {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(raggio, dettaglio);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const d = v.clone().normalize();
    // rigonfiamenti a bassa frequenza: somma di tre «bozzi»
    let s = 1;
    for (let k = 0; k < 3; k++) {
      const cx = hashPosizione(k, 1, 2, seme) - 0.5;
      const cy = hashPosizione(k, 3, 4, seme) - 0.5;
      const cz = hashPosizione(k, 5, 6, seme) - 0.5;
      const c = new THREE.Vector3(cx, cy * 0.6 + 0.2, cz).normalize();
      s += Math.max(0, d.dot(c)) ** 3 * irregolarita * 1.3;
    }
    s += (hashPosizione(v.x, v.y, v.z, seme) - 0.5) * irregolarita * 0.6;
    v.multiplyScalar(s);
    // fondo più piatto, come le chiome dipinte
    if (v.y < 0) v.y *= schiaccia * 0.8;
    else v.y *= schiaccia;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  if (normaliSferiche > 0) {
    // normali piegate verso la direzione radiale: ombreggiatura tonda anche con pochi poligoni
    const nor = g.getAttribute('normal') as THREE.BufferAttribute;
    const n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      n.fromBufferAttribute(nor, i).lerp(v, normaliSferiche).normalize();
      nor.setXYZ(i, n.x, n.y, n.z);
    }
  }
  return g;
}

/** Lastra o blocco squadrato con gli spigoli un po' irregolari (facce piatte). */
export function geoLastra(w: number, h: number, d: number, seme: number, irregolarita = 0.12): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const hx = hashPosizione(v.x, v.y, v.z, seme) - 0.5;
    const hy = hashPosizione(v.y, v.z, v.x, seme + 3) - 0.5;
    const hz = hashPosizione(v.z, v.x, v.y, seme + 7) - 0.5;
    v.x += hx * w * irregolarita;
    v.y += hy * h * irregolarita;
    v.z += hz * d * irregolarita;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.translate(0, h / 2, 0);
  return g;
}

export interface OpzioniTubo {
  chiudiInizio?: boolean;
  chiudiFine?: boolean;
  /** moltiplicatore del raggio per anello i e angolo a (radianti): per lobi delle radici, torsioni */
  forma?: (i: number, angolo: number) => number;
  /** rotazione iniziale dell'anello */
  fase?: number;
}

/**
 * Tubo lungo una spezzata con raggio variabile (tronchi, rami, braccia, corde).
 * Usa riferimenti a trasporto parallelo, quindi non si attorciglia.
 */
export function geoTubo(punti: THREE.Vector3[], raggi: number[], segmenti = 6, opz: OpzioniTubo = {}): THREE.BufferGeometry {
  const n = punti.length;
  const pos: number[] = [];
  const idx: number[] = [];
  const tangenti: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = punti[Math.max(0, i - 1)] as THREE.Vector3;
    const b = punti[Math.min(n - 1, i + 1)] as THREE.Vector3;
    tangenti.push(new THREE.Vector3().subVectors(b, a).normalize());
  }
  // normale iniziale
  const t0 = tangenti[0] as THREE.Vector3;
  const ausiliario = Math.abs(t0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  let normale = new THREE.Vector3().crossVectors(t0, ausiliario).normalize();
  const fase = opz.fase ?? 0;
  for (let i = 0; i < n; i++) {
    const t = tangenti[i] as THREE.Vector3;
    if (i > 0) {
      const tp = tangenti[i - 1] as THREE.Vector3;
      const q = new THREE.Quaternion().setFromUnitVectors(tp, t);
      normale = normale.clone().applyQuaternion(q);
    }
    const binormale = new THREE.Vector3().crossVectors(t, normale).normalize();
    const p = punti[i] as THREE.Vector3;
    const r = raggi[Math.min(i, raggi.length - 1)] as number;
    for (let s = 0; s < segmenti; s++) {
      const ang = (s / segmenti) * Math.PI * 2 + fase;
      const f = opz.forma ? opz.forma(i, ang) : 1;
      const c = Math.cos(ang) * r * f;
      const sn = Math.sin(ang) * r * f;
      pos.push(p.x + normale.x * c + binormale.x * sn, p.y + normale.y * c + binormale.y * sn, p.z + normale.z * c + binormale.z * sn);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let s = 0; s < segmenti; s++) {
      const a = i * segmenti + s;
      const b = i * segmenti + ((s + 1) % segmenti);
      const c = (i + 1) * segmenti + s;
      const d = (i + 1) * segmenti + ((s + 1) % segmenti);
      idx.push(a, c, b, b, c, d);
    }
  }
  if (opz.chiudiInizio) {
    const centro = pos.length / 3;
    const p = punti[0] as THREE.Vector3;
    pos.push(p.x, p.y, p.z);
    for (let s = 0; s < segmenti; s++) idx.push(centro, s, (s + 1) % segmenti);
  }
  if (opz.chiudiFine) {
    const centro = pos.length / 3;
    const p = punti[n - 1] as THREE.Vector3;
    pos.push(p.x, p.y, p.z);
    const o = (n - 1) * segmenti;
    for (let s = 0; s < segmenti; s++) idx.push(centro, o + ((s + 1) % segmenti), o + s);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Estrusione di un profilo 2D (nel piano XY) di spessore `profondita` lungo Z, centrata in Z.
 */
export function geoEstrusione(forma: THREE.Shape, profondita: number, segmentiCurve = 4): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(forma, { depth: profondita, bevelEnabled: false, curveSegments: segmentiCurve });
  g.translate(0, 0, -profondita / 2);
  g.deleteAttribute('uv');
  return g;
}

/** Profilo di un'apertura ad arco a tutto sesto (base a y = 0), larghezza w, altezza totale h. */
export function formaArco(w: number, h: number, segmenti = 6): THREE.Shape {
  const r = w / 2;
  const s = new THREE.Shape();
  s.moveTo(-r, 0);
  s.lineTo(r, 0);
  s.lineTo(r, h - r);
  for (let i = 1; i <= segmenti; i++) {
    const a = (i / segmenti) * Math.PI;
    s.lineTo(Math.cos(a) * r, h - r + Math.sin(a) * r);
  }
  s.lineTo(-r, 0);
  return s;
}

/** Piano rettangolare w×h con normale +Z, suddiviso (per tele e veli animati). */
export function geoPiano(w: number, h: number, sx = 1, sy = 1): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h, sx, sy);
  g.deleteAttribute('uv');
  return g;
}

/** Cono (base a y = 0). */
export function geoCono(r: number, h: number, segmenti = 8, aperto = false): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(r, h, segmenti, 1, aperto);
  g.translate(0, h / 2, 0);
  g.deleteAttribute('uv');
  return g;
}

/** Sfera a pochi poligoni (normali morbide). */
export function geoSfera(r: number, w = 8, h = 6): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, w, h);
  g.deleteAttribute('uv');
  return g;
}

/** Toro (anelli, maniglie, bordi). */
export function geoToro(r: number, spessore: number, segRad = 5, segTub = 12, arco = Math.PI * 2): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(r, spessore, segRad, segTub, arco);
  g.deleteAttribute('uv');
  return g;
}

/** Spezzata liscia (Catmull-Rom) campionata in n punti. */
export function curva(punti: THREE.Vector3[], n: number): THREE.Vector3[] {
  if (punti.length < 3) {
    const out: THREE.Vector3[] = [];
    const a = punti[0] as THREE.Vector3;
    const b = punti[punti.length - 1] as THREE.Vector3;
    for (let i = 0; i < n; i++) out.push(a.clone().lerp(b, i / (n - 1)));
    return out;
  }
  return new THREE.CatmullRomCurve3(punti, false, 'centripetal').getPoints(n - 1);
}
