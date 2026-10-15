/**
 * La griglia delle particelle e la geometria «sul foglio» (il cilindro srotolato).
 *
 * Convenzioni identiche al motore (`src/world/cells.ts`, `src/world/cylinder.ts`):
 * id = iz·96 + iθ, iz lungo z (0 = Tappo Sud), iθ lungo θ (0 = θ 0°, crescente a Mane);
 * il foglio è il piano (z, s) con s = θ·R in radianti, cioè l'arco sul fondo.
 */
import {
  CELLA_DTHETA,
  CELLA_DZ,
  CELLE_NTHETA,
  CELLE_NZ,
  CELLE_TOTALI,
  DEG,
  FOGLI,
  R,
  STRISCE,
  Z_SORDO,
  type Striscia,
} from './costanti';

export interface PuntoFoglio {
  z: number;
  theta: number;
}

export interface Punto3D {
  x: number;
  y: number;
  z: number;
}

/** Riporta un angolo in gradi nell'intervallo [0, 360). */
export function normalizzaGradi(theta: number): number {
  const t = theta % 360;
  return t < 0 ? t + 360 : t;
}

/** Differenza angolare con segno più breve (b − a), in (−180, 180]. */
export function deltaGradi(a: number, b: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export function idValido(id: number): boolean {
  return Number.isInteger(id) && id >= 0 && id < CELLE_TOTALI;
}

/** Particella che contiene (z, θ). */
export function idCella(z: number, theta: number): number {
  const iz = Math.min(CELLE_NZ - 1, Math.max(0, Math.floor(z / CELLA_DZ)));
  const it = Math.floor(normalizzaGradi(theta) / CELLA_DTHETA) % CELLE_NTHETA;
  return iz * CELLE_NTHETA + it;
}

export function indiciCella(id: number): { iz: number; it: number } {
  return { iz: Math.floor(id / CELLE_NTHETA), it: id % CELLE_NTHETA };
}

/** Centro della particella in (z, θ). */
export function centroCella(id: number): PuntoFoglio {
  const { iz, it } = indiciCella(id);
  return { z: (iz + 0.5) * CELLA_DZ, theta: (it + 0.5) * CELLA_DTHETA };
}

/** Striscia (valle o Finestra) che contiene θ. */
export function strisciaDi(theta: number): Striscia {
  const t = normalizzaGradi(theta);
  for (const s of STRISCE) if (t >= s.thetaDa && t < s.thetaA) return s;
  return STRISCE[STRISCE.length - 1]!;
}

/**
 * Foglio del catasto di una particella (GDD §2.2): 1-3 le valli (con i loro lobi del
 * Tappo Sud), 4 il Sordo (z ≥ 2640), 5 le Finestre.
 */
export function foglioDi(id: number): number {
  const c = centroCella(id);
  if (c.z >= Z_SORDO) return 4;
  return strisciaDi(c.theta).foglio;
}

/**
 * Nome catastale «foglio-numero» (GDD §2.2, FASE1 §2.1): per una valle
 * numero = iz·24 + (colonna dentro la valle) + 1, e la Terrazza Pedrazzini (2214) è «1-559».
 * Le Finestre (foglio 5) mettono in fila le loro tre strisce da 8 colonne (24 colonne per riga);
 * il Sordo (foglio 4) numera le sue righe da z 2640 sulle 96 colonne. Il GDD non dà una formula
 * per i fogli 4 e 5: questa è una proposta (vedi README).
 */
export function nomeCatastale(id: number): string {
  const { iz, it } = indiciCella(id);
  const foglio = foglioDi(id);
  if (foglio === 4) {
    const iz0 = Math.floor(Z_SORDO / CELLA_DZ);
    return `4-${(iz - iz0) * CELLE_NTHETA + it + 1}`;
  }
  const s = strisciaDi(centroCella(id).theta);
  const colInStriscia = it - Math.round(s.thetaDa / CELLA_DTHETA);
  if (s.tipo === 'finestra') {
    const finestre = STRISCE.filter((x) => x.tipo === 'finestra');
    const k = finestre.findIndex((x) => x.id === s.id);
    const colonne = Math.round((s.thetaA - s.thetaDa) / CELLA_DTHETA);
    return `5-${iz * colonne * finestre.length + k * colonne + colInStriscia + 1}`;
  }
  const colonne = Math.round((s.thetaA - s.thetaDa) / CELLA_DTHETA);
  return `${foglio}-${iz * colonne + colInStriscia + 1}`;
}

export function nomeFoglio(foglio: number): string {
  return FOGLI[foglio] ?? `Foglio ${foglio}`;
}

/** Distanza sul foglio (z, arco sul fondo) fra due punti, con l'avvolgimento in θ. */
export function distanzaFoglio(a: PuntoFoglio, b: PuntoFoglio): number {
  return Math.hypot(b.z - a.z, deltaGradi(a.theta, b.theta) * DEG * R);
}

/**
 * Distanza sul foglio del punto p dal segmento a-b. Il segmento prende la via più
 * breve in θ (un lato non fa mai il giro del cilindro).
 */
export function distanzaDaSegmento(p: PuntoFoglio, a: PuntoFoglio, b: PuntoFoglio): number {
  const bx = b.z - a.z;
  const by = deltaGradi(a.theta, b.theta) * DEG * R;
  const px = p.z - a.z;
  const py = deltaGradi(a.theta, p.theta) * DEG * R;
  const l2 = bx * bx + by * by;
  const t = l2 > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / l2)) : 0;
  return Math.hypot(px - t * bx, py - t * by);
}

/** Particelle il cui centro dista al massimo `raggio` metri (sul foglio) da (z, θ). */
export function celleNelRaggio(centro: PuntoFoglio, raggio: number): number[] {
  const out: number[] = [];
  const izMin = Math.max(0, Math.floor((centro.z - raggio) / CELLA_DZ) - 1);
  const izMax = Math.min(CELLE_NZ - 1, Math.floor((centro.z + raggio) / CELLA_DZ) + 1);
  const dGradi = raggio / (R * DEG) + CELLA_DTHETA;
  const meta = Math.min(Math.floor(CELLE_NTHETA / 2), Math.ceil(dGradi / CELLA_DTHETA));
  const itC = Math.floor(normalizzaGradi(centro.theta) / CELLA_DTHETA);
  const viste = new Set<number>();
  for (let iz = izMin; iz <= izMax; iz++) {
    for (let k = -meta; k <= meta; k++) {
      const it = (((itC + k) % CELLE_NTHETA) + CELLE_NTHETA) % CELLE_NTHETA;
      const id = iz * CELLE_NTHETA + it;
      if (viste.has(id)) continue;
      viste.add(id);
      if (distanzaFoglio(centro, centroCella(id)) <= raggio) out.push(id);
    }
  }
  return out.sort((x, y) => x - y);
}

/**
 * Il ventaglio geometrico di un lato (GDD §3.2): le particelle il cui centro dista al
 * massimo `buffer` metri dal segmento a-b proiettato sul suolo.
 */
export function celleNellaFascia(a: PuntoFoglio, b: PuntoFoglio, buffer: number): number[] {
  const dTheta = deltaGradi(a.theta, b.theta);
  const zMin = Math.min(a.z, b.z) - buffer;
  const zMax = Math.max(a.z, b.z) + buffer;
  const margineGradi = buffer / (R * DEG) + CELLA_DTHETA;
  const t0 = Math.min(0, dTheta) - margineGradi;
  const t1 = Math.max(0, dTheta) + margineGradi;
  const out = new Set<number>();
  const izMin = Math.max(0, Math.floor(zMin / CELLA_DZ));
  const izMax = Math.min(CELLE_NZ - 1, Math.floor(zMax / CELLA_DZ));
  const k0 = Math.floor((a.theta + t0) / CELLA_DTHETA);
  const k1 = Math.ceil((a.theta + t1) / CELLA_DTHETA);
  for (let iz = izMin; iz <= izMax; iz++) {
    for (let k = k0; k <= k1; k++) {
      const it = ((k % CELLE_NTHETA) + CELLE_NTHETA) % CELLE_NTHETA;
      const id = iz * CELLE_NTHETA + it;
      if (distanzaDaSegmento(centroCella(id), a, b) <= buffer) out.add(id);
    }
  }
  return [...out].sort((x, y) => x - y);
}

/**
 * Lunghezza di un lato come la scrive capisaldi.json: la distanza sul foglio (z, arco sul fondo)
 * composta con il dislivello. È quella che conta per i limiti di 40 e 600 m.
 */
export function lunghezzaLato(a: PuntoFoglio & { altezza: number }, b: PuntoFoglio & { altezza: number }): number {
  return Math.hypot(distanzaFoglio(a, b), b.altezza - a.altezza);
}

/** Punto del mondo a (z, θ, h), con la stessa terna del motore (`cylToWorld`). */
export function posizione3D(z: number, theta: number, h: number): Punto3D {
  const r = R - h;
  const t = theta * DEG;
  return { x: -r * Math.sin(t), y: -r * Math.cos(t), z };
}

export function distanza3D(a: Punto3D, b: Punto3D): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

/** Distanza minima dall'asse (la Linea) del segmento 3D a-b. */
export function distanzaSegmentoDallAsse(a: Punto3D, b: Punto3D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / l2)) : 0;
  return Math.hypot(a.x + t * dx, a.y + t * dy);
}

/** Angolo (gradi) fra le direzioni o→a e o→b. */
export function angoloFra(o: Punto3D, a: Punto3D, b: Punto3D): number {
  const ux = a.x - o.x;
  const uy = a.y - o.y;
  const uz = a.z - o.z;
  const vx = b.x - o.x;
  const vy = b.y - o.y;
  const vz = b.z - o.z;
  const nu = Math.hypot(ux, uy, uz);
  const nv = Math.hypot(vx, vy, vz);
  if (nu === 0 || nv === 0) return 0;
  const c = Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / (nu * nv)));
  return Math.acos(c) / DEG;
}
