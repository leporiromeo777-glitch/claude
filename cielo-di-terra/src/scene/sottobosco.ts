/**
 * Sottobosco vicino al giocatore (traccia «natura»): erba a ciuffi che si muove nel vento, erba
 * secca alta, felci color ruggine, fiori d'ottobre, cespugli, sassi col muschio, foglie cadute e
 * ricci sotto i castagni.
 *
 * Come funziona:
 * - il fondo è diviso in celle di 12 m (z, arco sul fondo); attorno alla camera, entro `raggio`, ogni
 *   cella genera una volta (con un seme suo, quindi sempre uguale) le sue istanze e le tiene in
 *   cache. La generazione legge il terreno come lo dipinge la mesh (quota `groundHeight`, colore
 *   `terrainColor`, densità di bosco, riale, lago, pendenza) e salta i sentieri e l'interno dei
 *   collisori (case, muri, ripiani, tronchi): niente erba che buca i pavimenti o i selciati;
 * - quando l'insieme delle celle vicine cambia, le istanze si ricopiano in poche InstancedMesh
 *   (una per tipo: ~8 chiamate di disegno);
 * - con la distanza le istanze si rimpiccioliscono fino a sparire (`uSfuma` dei materiali): il
 *   bordo del cerchio non si vede, e l'erba ha il colore del prato dipinto sotto (lo shader rifà la
 *   stessa pittura del terreno: `pratoDipinto`), quindi sfuma nel colore del terreno.
 *
 * Costo controllato dalla qualità (`impostaQualita`, collegato a `PresetQualita.vegetazione`):
 * raggio e densità scalano insieme (Bassa ~14 m e 45%, Media ~24 m e 75%, Alta ~34 m e 100%).
 */
import { Group, InstancedBufferAttribute, InstancedMesh, Vector3, type BufferGeometry, type Material, type ShaderMaterial } from 'three';
import { DEG, LAYOUT, METERS_PER_DEG } from '../world/constants';
import { surfaceDistance, worldToCyl } from '../world/cylinder';
import type { BoxCollider, Collider, ColliderWorld } from '../world/colliders';
import { Simplex3, clamp, mulberry32, smoothstep } from '../world/noise';
import { WATER_HEIGHT, createMasks, groundHeight, slopeAt, surfaceHeight } from '../world/terrain';
import { terrainColor } from '../render/palette';
import { creaMaterialeNatura, impostaNucleo, impostaSfuma } from '../render/naturaMateriali';
import type { WorldUniforms } from '../render/uniforms';
import { distanzaTratto, trattiVicini, type Tratto } from './sentieri';
import { densitaBosco } from './bosco';
import { geometrieCespuglio } from './alberi';
import { geoCiuffoErba, geoFelce, geoFiore, geoFoglieTerra, geoRicci, geoSasso } from './sottoboscoForme';

/** Lato della cella (m). */
const CELLA = 12;

/**
 * Segna un buffer di istanze da rimandare alla scheda, solo per i primi `quanti` valori: three.js
 * senza intervalli rimanda l'intero array alla sua capienza (megabyte a ogni ridistribuzione).
 */
export function aggiorna(attr: { clearUpdateRanges(): void; addUpdateRange(start: number, count: number): void; needsUpdate: boolean }, quanti: number): void {
  attr.clearUpdateRanges();
  // (senza intervalli three.js rimanda tutto: con zero istanze non serve rimandare niente)
  if (quanti <= 0) return;
  attr.addUpdateRange(0, quanti);
  attr.needsUpdate = true;
}
const NA = Math.round((360 * METERS_PER_DEG) / CELLA);
/** Campioni del terreno per lato di cella (griglia di 3 m). */
const SUB = 4;

type Tipo = 'erba' | 'fiori' | 'felci' | 'sassi' | 'foglie' | 'ricci' | 'cespugliChioma' | 'cespugliCarte';
const TIPI: readonly Tipo[] = ['erba', 'fiori', 'felci', 'sassi', 'foglie', 'ricci', 'cespugliChioma', 'cespugliCarte'];

/** Istanze di un tipo in una cella: matrici (16) e tinte (4: rgb + seme). */
interface Blocco {
  m: Float32Array;
  t: Float32Array;
  n: number;
}

interface Cella {
  blocchi: Record<Tipo, Blocco>;
}

interface Campione {
  h: number;
  slope: number;
  bosco: number;
  colore: [number, number, number];
  acqua: boolean;
  piazza: number;
  paese: number;
  roccia: number;
  riva: number;
}


const VILLAGE = LAYOUT.villages[0]!;
const NOISE = new Simplex3(8080);
const _p = new Vector3();
const _v = new Vector3();

/** Preset di qualità: raggio (m) e densità. */
function preset(k: number): { raggio: number; densita: number } {
  const q = clamp(k, 0.2, 1.3);
  return { raggio: 10 + 24 * q, densita: 0.3 + 0.7 * q };
}

export class Sottobosco {
  readonly group = new Group();
  raggio = 34;
  densita = 1;
  private readonly mesh = new Map<Tipo, InstancedMesh>();
  private readonly materiali: ShaderMaterial[] = [];
  private readonly celle = new Map<number, Cella>();
  private attive: number[] = [];
  private chiaveAttive = '';
  private nCollider = -1;
  private readonly capienza: Record<Tipo, number> = { erba: 16000, fiori: 2400, felci: 2000, sassi: 1200, foglie: 2400, ricci: 600, cespugliChioma: 500, cespugliCarte: 500 };
  /** castagni per cella (basi in z, arco), per foglie e ricci */
  private castagni = new Map<number, Array<[number, number]>>();
  private ultimaCam = new Vector3(1e9, 0, 0);
  /** celle lontane dalla camera (l'erba vi si dirada) */
  private readonly lontane = new Map<number, boolean>();
  /** tipi spenti dalla qualità */
  private spenti = new Set<Tipo>();
  /** istanze disegnate per tipo (statistiche) */
  readonly conteggi: Record<Tipo, number> = { erba: 0, fiori: 0, felci: 0, sassi: 0, foglie: 0, ricci: 0, cespugliChioma: 0, cespugliCarte: 0 };

  constructor(
    u: WorldUniforms,
    private readonly colliders: ColliderWorld,
    alberi: ReadonlyArray<{ pos: Vector3; specie?: string }>,
  ) {
    this.group.name = 'sottobosco';
    const cesp = geometrieCespuglio();
    const geos: Record<Tipo, BufferGeometry> = {
      erba: geoCiuffoErba(11),
      fiori: geoFiore(12),
      felci: geoFelce(13),
      sassi: geoSasso(14),
      foglie: geoFoglieTerra(15),
      ricci: geoRicci(16),
      cespugliChioma: cesp.chioma,
      cespugliCarte: cesp.carte,
    };
    const mats: Record<Tipo, ShaderMaterial> = {
      // erba: il colore del prato dipinto sotto (uFoglia.z = 1, vedi erbaDipinta)
      erba: creaMaterialeNatura(u, { tipo: 'erba', flessione: 1 }),
      fiori: creaMaterialeNatura(u, { tipo: 'erba', flessione: 0.8 }),
      felci: creaMaterialeNatura(u, { tipo: 'erba', flessione: 0.35 }),
      sassi: creaMaterialeNatura(u, { tipo: 'sottobosco', superficie: 0 }),
      foglie: creaMaterialeNatura(u, { tipo: 'sottobosco', superficie: 0 }),
      ricci: creaMaterialeNatura(u, { tipo: 'sottobosco', superficie: 0 }),
      cespugliChioma: creaMaterialeNatura(u, { tipo: 'chioma', flessione: 2.5 }),
      cespugliCarte: creaMaterialeNatura(u, { tipo: 'carte', foglia: 1, flessione: 2.5 }),
    };
    (mats.erba.uniforms['uFoglia']!.value as { z: number }).z = 1;
    impostaNucleo(mats.cespugliChioma, 0.7);
    for (const tipo of TIPI) {
      const g = geos[tipo].clone();
      const n = this.capienza[tipo];
      g.setAttribute('aTint', new InstancedBufferAttribute(new Float32Array(n * 4), 4));
      if (tipo === 'cespugliChioma' || tipo === 'cespugliCarte') g.setAttribute('aTint2', new InstancedBufferAttribute(new Float32Array(n * 4), 4));
      const m = new InstancedMesh(g, mats[tipo] as Material, n);
      m.count = 0;
      m.visible = false;
      m.frustumCulled = false;
      m.name = `sottobosco-${tipo}`;
      // l'erba e le carte non proiettano (tanti triangoli piccoli); i cespugli sì. I sassi no: sono
      // piccoli e la passata d'ombra non li rimpicciolisce con la distanza come la vista (l'ombra
      // restava piena e poi spariva di colpo al bordo della cella)
      m.userData['ombra'] = tipo === 'cespugliChioma';
      this.mesh.set(tipo, m);
      this.group.add(m);
      this.materiali.push(mats[tipo]);
    }
    for (const t of alberi) {
      if (t.specie && t.specie !== 'castagno') continue;
      const c = worldToCyl(t.pos);
      const k = chiave(Math.floor(c.z / CELLA), Math.floor((c.theta * METERS_PER_DEG) / CELLA));
      let l = this.castagni.get(k);
      if (!l) this.castagni.set(k, (l = []));
      l.push([c.z, c.theta * METERS_PER_DEG]);
    }
    this.impostaQualita(1);
  }

  /** Qualità (0.2..1.3): raggio e densità del sottobosco (Bassa ~0.45, Media ~0.75, Alta 1). */
  impostaQualita(k: number): void {
    // a Bassa niente felci né fiori (restano erba, sassi, foglie, ricci e cespugli)
    this.spenti = k < 0.5 ? new Set<Tipo>(['felci', 'fiori']) : new Set<Tipo>();
    const p = preset(k);
    if (Math.abs(p.densita - this.densita) > 1e-3) this.celle.clear();
    this.raggio = p.raggio;
    this.densita = p.densita;
    for (const m of this.materiali) impostaSfuma(m, 0, 0, this.raggio * 0.62, this.raggio);
    this.chiaveAttive = '';
  }

  /** Aggiorna le celle attorno alla camera; genera al più per `budgetMs` (Infinity = tutto subito). */
  update(cam: Vector3, budgetMs = 3): void {
    // i collisori cambiano (il paese vero si costruisce dopo il motore): si rigenera tutto
    if (this.colliders.size !== this.nCollider) {
      this.nCollider = this.colliders.size;
      this.celle.clear();
      this.chiaveAttive = '';
    }
    const c = worldToCyl(cam);
    // sopra i 60 m dal suolo il sottobosco non si vede: niente lavoro
    const alto = c.h - groundHeight(c.z, c.theta) > 60;
    if (alto) {
      if (this.attive.length) {
        this.attive = [];
        this.chiaveAttive = '';
        this.ricopia();
      }
      return;
    }
    if (budgetMs < Infinity && cam.distanceToSquared(this.ultimaCam) < 1 && this.chiaveAttive !== '') return;
    this.ultimaCam.copy(cam);
    const arc = c.theta * METERS_PER_DEG;
    const iz0 = Math.floor(c.z / CELLA);
    const ia0 = Math.floor(arc / CELLA);
    const rc = Math.ceil(this.raggio / CELLA) + 1;
    const voglio: Array<[number, number, number, number]> = [];
    for (let dz = -rc; dz <= rc; dz++) {
      for (let da = -rc; da <= rc; da++) {
        const iz = iz0 + dz;
        const ia = ia0 + da;
        // distanza dal centro della cella più vicino della cella al punto
        const zc = Math.max(iz * CELLA, Math.min(c.z, (iz + 1) * CELLA));
        const ac = Math.max(ia * CELLA, Math.min(arc, (ia + 1) * CELLA));
        const d = Math.hypot(zc - c.z, ac - arc);
        if (d > this.raggio + 1) continue;
        if (iz < 0 || iz * CELLA > LAYOUT.cylinder.length) continue;
        voglio.push([chiave(iz, ia), iz, ((ia % NA) + NA) % NA, d]);
      }
    }
    // dalle celle più vicine alle più lontane: si generano prima e si disegnano prima (le istanze
    // vicine riempiono la profondità e i frammenti lontani dietro si scartano prima)
    voglio.sort((a, b) => a[3] - b[3]);
    // genera le celle mancanti, le più vicine prima, entro il budget
    const t0 = performance.now();
    let mancano = false;
    for (const [k, iz, ia] of voglio) {
      if (this.celle.has(k)) continue;
      if (performance.now() - t0 > budgetMs) {
        mancano = true;
        continue;
      }
      this.celle.set(k, this.genera(iz, ia));
    }
    const pronte = voglio.filter(([k]) => this.celle.has(k)).map(([k]) => k);
    // vicine e lontane cambiano anche senza cambiare celle: la chiave porta la cella della camera
    const ch = `${iz0}:${ia0}|${pronte.join(',')}`;
    this.lontane.clear();
    for (const [k, iz, ia] of voglio) {
      const dz = (iz + 0.5) * CELLA - c.z;
      let da = (ia + 0.5) * CELLA - arc;
      const giro = NA * CELLA;
      da -= Math.round(da / giro) * giro;
      this.lontane.set(k, Math.hypot(dz, da) > 18);
    }
    if (ch !== this.chiaveAttive) {
      this.chiaveAttive = mancano ? '' : ch;
      this.attive = pronte;
      this.ricopia();
    }
    // la cache non cresce senza limiti
    if (this.celle.size > 400) {
      const tieni = new Set(voglio.map(([k]) => k));
      for (const k of this.celle.keys()) if (!tieni.has(k)) this.celle.delete(k);
    }
  }

  /** Istanze disegnate in tutto (statistiche). */
  get istanze(): number {
    let n = 0;
    for (const t of TIPI) n += this.conteggi[t];
    return n;
  }

  private ricopia(): void {
    for (const tipo of TIPI) {
      const mesh = this.mesh.get(tipo)!;
      const cap = this.capienza[tipo];
      const M = mesh.instanceMatrix.array as Float32Array;
      const T = (mesh.geometry.getAttribute('aTint') as InstancedBufferAttribute).array as Float32Array;
      const T2a = mesh.geometry.getAttribute('aTint2') as InstancedBufferAttribute | undefined;
      let n = 0;
      for (const k of this.spenti.has(tipo) ? [] : this.attive) {
        const b = this.celle.get(k)?.blocchi[tipo];
        if (!b || !b.n) continue;
        // l'erba è fitta vicino e si dirada lontano (metà dei ciuffi oltre ~18 m)
        if (tipo === 'erba' && (this.lontane.get(k) ?? false)) {
          for (let i = 0; i < b.n && n < cap; i += 2) {
            M.set(b.m.subarray(i * 16, i * 16 + 16), n * 16);
            T.set(b.t.subarray(i * 4, i * 4 + 4), n * 4);
            n++;
          }
          continue;
        }
        const q = Math.min(b.n, cap - n);
        if (q <= 0) break;
        M.set(b.m.subarray(0, q * 16), n * 16);
        T.set(b.t.subarray(0, q * 4), n * 4);
        if (T2a) {
          // cespugli: seconda tinta = oro d'autunno (quota di masse che l'hanno presa nel seme)
          const T2 = T2a.array as Float32Array;
          for (let i = 0; i < q; i++) {
            const o = (n + i) * 4;
            T2[o] = 0.74;
            T2[o + 1] = 0.56;
            T2[o + 2] = 0.24;
            T2[o + 3] = 0.3 + b.t[i * 4 + 3]! * 0.5;
          }
        }
        n += q;
      }
      mesh.count = n;
      mesh.visible = n > 0;
      // alla scheda si rimanda solo la parte usata dei buffer (non tutta la capienza)
      aggiorna(mesh.instanceMatrix, n * 16);
      aggiorna(mesh.geometry.getAttribute('aTint') as InstancedBufferAttribute, n * 4);
      if (T2a) aggiorna(T2a, n * 4);
      this.conteggi[tipo] = n;
    }
  }

  // ------------------------------------------------------------------------------- generazione

  private campiona(iz: number, ia: number): Campione[] {
    const out: Campione[] = [];
    const m = createMasks();
    const col = [0, 0, 0];
    for (let j = 0; j < SUB; j++) {
      for (let i = 0; i < SUB; i++) {
        const z = (iz + (j + 0.5) / SUB) * CELLA;
        const th = ((ia + (i + 0.5) / SUB) * CELLA) / METERS_PER_DEG;
        const h = surfaceHeight(z, th, m);
        const slope = slopeAt(z, th, true);
        const bosco = densitaBosco(z, th, h, slope, m);
        terrainColor(z, th, h, slope, m, col);
        const acqua = m.stream < 3.2 || (m.lakeQ < 1.25 && h < WATER_HEIGHT + 0.25) || m.kind !== 'valle' && m.capS <= 0 && m.capN <= 0;
        const roccia = Math.max(smoothstep(0.62, 0.95, slope), m.bank * 0.8, m.capN > 0.05 ? 0.7 : 0);
        const riva = m.stream < 9 ? 1 - smoothstep(3.2, 9, m.stream) : m.lakeQ < 1.4 ? 1 - smoothstep(WATER_HEIGHT + 0.2, WATER_HEIGHT + 2.5, h) : 0;
        const dv = surfaceDistance(z, th, VILLAGE.zCenter, VILLAGE.thetaCenter);
        out.push({ h, slope, bosco, colore: [col[0]!, col[1]!, col[2]!], acqua, piazza: m.piazza, paese: m.theme === 'selve' ? 1 - smoothstep(110, 150, dv) : 0, roccia, riva });
      }
    }
    return out;
  }

  private genera(iz: number, ia: number): Cella {
    const seme = (iz * 7919 + ia * 104729) >>> 0;
    const rnd = mulberry32(seme);
    const camp = this.campiona(iz, ia);
    const z0 = iz * CELLA;
    const a0 = ia * CELLA;
    // collisori vicini: solo quelli che toccano il suolo della cella
    const zc = z0 + CELLA / 2;
    const thc = (a0 + CELLA / 2) / METERS_PER_DEG;
    const vicini: Collider[] = this.colliders.query(zc, thc, CELLA).slice();
    const sentieri: Tratto[] = trattiVicini(z0, z0 + CELLA, a0, a0 + CELLA, 3);
    const castagni: Array<[number, number]> = [];
    for (let dz = -1; dz <= 1; dz++) for (let da = -1; da <= 1; da++) castagni.push(...(this.castagni.get(chiave(iz + dz, ((ia + da) % NA + NA) % NA)) ?? []));
    const blocchi = {} as Record<Tipo, Blocco>;
    const liste: Record<Tipo, number[]> = { erba: [], fiori: [], felci: [], sassi: [], foglie: [], ricci: [], cespugliChioma: [], cespugliCarte: [] };
    const tinte: Record<Tipo, number[]> = { erba: [], fiori: [], felci: [], sassi: [], foglie: [], ricci: [], cespugliChioma: [], cespugliCarte: [] };
    const k = this.densita;

    const occupato = (z: number, th: number, h: number, margine: number): boolean => {
      // sentieri (nastro largo ~2 m)
      const s = th * METERS_PER_DEG;
      for (const seg of sentieri) if (distanzaTratto(z, s, seg) < seg.larghezza / 2 + 0.35 + margine) return true;
      if (!vicini.length) return false;
      cylPunto(z, th, h + 0.12, _p);
      for (const col of vicini) {
        if (col.kind === 'box') {
          if (dentroBox(col, _p, margine)) return true;
        } else {
          _v.subVectors(_p, col.base);
          const y = _v.dot(col.up);
          if (y < -0.5 || y > col.height + 0.5) continue;
          _v.addScaledVector(col.up, -y);
          if (_v.length() <= col.radius + 0.25 + margine) return true;
        }
      }
      return false;
    };
    const campione = (u: number, v: number): Campione => camp[Math.min(SUB - 1, Math.floor(v * SUB)) * SUB + Math.min(SUB - 1, Math.floor(u * SUB))]!;
    const metti = (tipo: Tipo, z: number, th: number, h: number, yaw: number, sx: number, sy: number, sz: number, r: number, g: number, b: number, s: number): void => {
      matriceSuperficie(z, th, h, yaw, sx, sy, sz, liste[tipo]);
      tinte[tipo].push(r, g, b, s);
    };

    // --- erba: ciuffi fitti, più alti nei prati incolti, rasi in paese, radi nel bosco fitto
    const nErba = Math.round(CELLA * CELLA * 3.3 * k);
    for (let i = 0; i < nErba; i++) {
      const u = rnd();
      const v = rnd();
      const c = campione(u, v);
      if (c.acqua || c.piazza > 0.2) continue;
      const z = z0 + v * CELLA;
      const a = a0 + u * CELLA;
      const th = a / METERS_PER_DEG;
      let p = 1 - c.roccia * 0.85;
      p *= 1 - smoothstep(0.35, 0.8, c.bosco) * 0.75;
      p *= 1 - c.paese * 0.45;
      // a chiazze: l'erba si accoppia (zolle), con qualche radura
      const nz = NOISE.noise(z / 7, a / 7, 3.1) * 0.5 + 0.5;
      p *= 0.45 + 0.9 * nz;
      if (rnd() > p) continue;
      const h = groundHeight(z, th);
      if (occupato(z, th, h, 0.05)) continue;
      const incolto = smoothstep(0.45, 0.8, NOISE.noise(z / 23, a / 23, 7.7) * 0.5 + 0.5) * (1 - c.paese);
      const alt = (0.26 + rnd() * 0.2) * (1 - c.paese * 0.4) * (1 + incolto * 1.2 + c.riva * 0.6);
      const larg = 1.0 + rnd() * 0.6;
      const tv = 0.92 + rnd() * 0.16;
      metti('erba', z, th, h - 0.03, rnd() * 360, larg, alt, larg, c.colore[0] * tv, c.colore[1] * tv, c.colore[2] * tv, rnd());
    }

    // --- fiori d'ottobre a mazzetti nei prati: colchici lilla, margherite, cicoria azzurra, qualche giallo
    const nFiori = Math.round(CELLA * CELLA * 0.09 * k);
    const fiori: Array<[number, number, number]> = [
      [0.86, 0.68, 0.95],
      [0.97, 0.96, 0.92],
      [0.55, 0.66, 0.98],
      [0.98, 0.84, 0.32],
    ];
    for (let i = 0; i < nFiori; i++) {
      const u = rnd();
      const v = rnd();
      const c = campione(u, v);
      if (c.acqua || c.piazza > 0.1 || c.roccia > 0.4 || c.bosco > 0.4) continue;
      const z = z0 + v * CELLA;
      const a = a0 + u * CELLA;
      const mazzo = NOISE.noise(z / 9, a / 9, 1.7) * 0.5 + 0.5;
      if (rnd() > smoothstep(0.5, 0.75, mazzo) * (1 - c.paese * 0.6)) continue;
      const th = a / METERS_PER_DEG;
      const h = groundHeight(z, th);
      if (occupato(z, th, h, 0.05)) continue;
      const f = fiori[Math.floor((NOISE.noise(z / 30, a / 30, 9.9) * 0.5 + 0.5) * 3.99)]!;
      const s = 0.8 + rnd() * 0.5;
      metti('fiori', z, th, h - 0.02, rnd() * 360, s, s, s, f[0], f[1], f[2], rnd());
    }

    // --- felci d'ottobre (ruggine, oro, qualche verde) ai margini del bosco e nel sottobosco
    const nFelci = Math.round(CELLA * CELLA * 0.16 * k);
    for (let i = 0; i < nFelci; i++) {
      const u = rnd();
      const v = rnd();
      const c = campione(u, v);
      if (c.acqua || c.piazza > 0 || c.paese > 0.5) continue;
      const p = smoothstep(0.08, 0.4, c.bosco) * (1 - c.roccia * 0.6) + c.riva * 0.25;
      if (rnd() > p) continue;
      const z = z0 + v * CELLA;
      const a = a0 + u * CELLA;
      const th = a / METERS_PER_DEG;
      const h = groundHeight(z, th);
      if (occupato(z, th, h, 0.2)) continue;
      const t = rnd();
      const col: [number, number, number] = t < 0.5 ? [0.68, 0.4, 0.2] : t < 0.8 ? [0.74, 0.58, 0.28] : [0.42, 0.5, 0.24];
      const s = 0.7 + rnd() * 0.6;
      metti('felci', z, th, h - 0.04, rnd() * 360, s, s * (0.8 + rnd() * 0.4), s, col[0], col[1], col[2], rnd());
    }

    // --- sassi col muschio: sui pendii e nella roccia; nei prati pochi e bassi (si cammina sopra)
    const nSassi = Math.round(CELLA * CELLA * 0.05 * k);
    for (let i = 0; i < nSassi; i++) {
      const u = rnd();
      const v = rnd();
      const c = campione(u, v);
      if (c.acqua || c.piazza > 0) continue;
      const p = 0.12 + c.roccia * 0.9 + smoothstep(0.35, 0.6, c.slope) * 0.4 + c.riva * 0.5;
      if (rnd() > p) continue;
      const z = z0 + v * CELLA;
      const a = a0 + u * CELLA;
      const th = a / METERS_PER_DEG;
      const h = groundHeight(z, th);
      if (occupato(z, th, h, 0.4)) continue;
      // grandi solo dove non si cammina (pendii ripidi, roccia)
      const grande = Math.max(c.roccia, smoothstep(0.55, 0.85, c.slope)) * (1 - smoothstep(0.05, 0.3, c.riva));
      const s = (0.16 + rnd() * 0.22) * (1 + grande * 2.2) * (1 - c.riva * 0.4);
      const tv = 0.95 + rnd() * 0.15;
      metti('sassi', z, th, h, rnd() * 360, s * (0.8 + rnd() * 0.5), s * (0.7 + rnd() * 0.4), s, tv, tv, tv, rnd());
    }

    // --- cespugli ai margini del bosco e lungo le rive
    const nCesp = Math.round(CELLA * CELLA * 0.02 * k);
    for (let i = 0; i < nCesp; i++) {
      const u = rnd();
      const v = rnd();
      const c = campione(u, v);
      if (c.acqua || c.piazza > 0 || c.paese > 0.6) continue;
      const margine = smoothstep(0.06, 0.25, c.bosco) * (1 - smoothstep(0.5, 0.75, c.bosco));
      if (rnd() > margine * 0.9 + c.riva * 0.4) continue;
      const z = z0 + v * CELLA;
      const a = a0 + u * CELLA;
      const th = a / METERS_PER_DEG;
      const h = groundHeight(z, th);
      if (occupato(z, th, h, 0.8)) continue;
      const s = 0.7 + rnd() * 0.7;
      const t = rnd();
      const col: [number, number, number] = t < 0.5 ? [0.46, 0.5, 0.22] : t < 0.8 ? [0.6, 0.54, 0.24] : [0.66, 0.38, 0.2];
      const seme2 = rnd();
      metti('cespugliChioma', z, th, h - 0.1, rnd() * 360, s, s * (0.8 + rnd() * 0.3), s, col[0], col[1], col[2], seme2);
      // le carte di foglie con la stessa matrice e la stessa tinta
      liste.cespugliCarte.push(...liste.cespugliChioma.slice(-16));
      tinte.cespugliCarte.push(col[0], col[1], col[2], seme2);
    }

    // --- foglie cadute e ricci sotto i castagni (e un po' ovunque nel bosco)
    for (const [cz, cs] of castagni) {
      if (cz < z0 - 7 || cz > z0 + CELLA + 7 || cs < a0 - 7 || cs > a0 + CELLA + 7) continue;
      const nF = Math.round(5 * k);
      for (let i = 0; i < nF; i++) {
        const r = 1.2 + Math.sqrt(rnd()) * 5.5;
        const ang = rnd() * Math.PI * 2;
        const z = cz + Math.cos(ang) * r;
        const a = cs + Math.sin(ang) * r;
        if (z < z0 || z >= z0 + CELLA || a < a0 || a >= a0 + CELLA) continue;
        const th = a / METERS_PER_DEG;
        const h = groundHeight(z, th);
        if (occupato(z, th, h, 0)) continue;
        const ricci = rnd() < 0.4;
        const s = 0.8 + rnd() * 0.4;
        metti(ricci ? 'ricci' : 'foglie', z, th, h, rnd() * 360, s, 1, s, 1, 1, 1, rnd());
      }
    }
    const nFoglieBosco = Math.round(CELLA * CELLA * 0.05 * k);
    for (let i = 0; i < nFoglieBosco; i++) {
      const u = rnd();
      const v = rnd();
      const c = campione(u, v);
      if (c.acqua || c.piazza > 0) continue;
      if (rnd() > smoothstep(0.2, 0.6, c.bosco) + c.paese * 0.05) continue;
      const z = z0 + v * CELLA;
      const a = a0 + u * CELLA;
      const th = a / METERS_PER_DEG;
      const h = groundHeight(z, th);
      if (occupato(z, th, h, 0)) continue;
      const s = 0.8 + rnd() * 0.4;
      metti('foglie', z, th, h, rnd() * 360, s, 1, s, 1, 1, 1, rnd());
    }

    for (const tipo of TIPI) blocchi[tipo] = { m: new Float32Array(liste[tipo]), t: new Float32Array(tinte[tipo]), n: tinte[tipo].length / 4 };
    return { blocchi };
  }
}

function chiave(iz: number, ia: number): number {
  return iz * 1024 + (((ia % NA) + NA) % NA);
}

function cylPunto(z: number, th: number, h: number, out: Vector3): Vector3 {
  const r = LAYOUT.cylinder.radius - h;
  const t = th * DEG;
  return out.set(-r * Math.sin(t), -r * Math.cos(t), z);
}

function dentroBox(c: BoxCollider, p: Vector3, m: number): boolean {
  _v.subVectors(p, c.center);
  return Math.abs(_v.dot(c.right)) <= c.half.x + m && Math.abs(_v.dot(c.up)) <= c.half.y + m && Math.abs(_v.dot(c.forward)) <= c.half.z + m;
}

/**
 * Matrice (16 numeri, per colonne) che porta la geometria locale al punto (z, theta, h) con yaw e
 * scala, come `surfaceMatrix` ma senza allocare: la aggiunge in coda a `out`.
 */
function matriceSuperficie(z: number, th: number, h: number, yawDeg: number, sx: number, sy: number, sz: number, out: number[]): void {
  const t = th * DEG;
  const ux = Math.sin(t);
  const uy = Math.cos(t);
  const ex = -uy;
  const ey = ux;
  const yaw = yawDeg * DEG;
  const cy = Math.cos(yaw);
  const sy0 = Math.sin(yaw);
  // avanti = nord·cos + est·sin; destra = avanti × su; dietro = -avanti
  const fx = ex * sy0;
  const fy = ey * sy0;
  const fz = cy;
  // (fx, fy, fz) × (ux, uy, 0)
  const rx = fy * 0 - fz * uy;
  const ry = fz * ux - fx * 0;
  const rz = fx * uy - fy * ux;
  const r = LAYOUT.cylinder.radius - h;
  out.push(rx * sx, ry * sx, rz * sx, 0, ux * sy, uy * sy, 0, 0, -fx * sz, -fy * sz, -fz * sz, 0, -r * ux, -r * uy, z, 1);
}
