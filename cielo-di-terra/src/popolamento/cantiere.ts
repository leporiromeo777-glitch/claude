/**
 * Cantiere: raccoglie la geometria statica di una zona di Corbella e la cuoce in poche mesh con il
 * materiale del mondo del motore (attributo `aColor`: rgb sRGB + emissione notturna).
 *
 * Accetta:
 * - oggetti della libreria `oggetti` (gruppi con `userData.canale`), posati con una matrice mondo
 *   (di solito `matriceSuperficie` della libreria: davanti = +Z);
 * - geometrie semplici con un colore (primitive del motore o forme proprie).
 *
 * Per ogni zona escono al massimo due mesh: «singolo» (FrontSide: pietra, legno, vetri, finestre)
 * e «doppio» (DoubleSide: tele, veli, foglie piatte, vele). Dai vetri accesi (canale `lume`) si
 * ricavano i punti dei lumi per `game.lamps`; i vetri di giorno sono scuri e di notte si accendono
 * con `uNight` (come le finestre del motore).
 *
 * I collider della libreria passano nel formato del motore con `colliderAlMondo`; ogni collider porta
 * un tag (muro, tetto, calpestabile, porta, botola, chiodo, caposaldo, palina, tronco, scala…).
 */
import { BufferAttribute, BufferGeometry, Color, LOD, LinearSRGBColorSpace, Matrix3, Matrix4, Mesh, Object3D, SRGBColorSpace, Sphere, Vector3, type Material } from 'three';
import { colliderAlMondo } from '../oggetti/cilindro';
import type { OggettoProcedurale } from '../oggetti/tipi';
import type { Collider } from '../world/colliders';

export type RGB = [number, number, number];

/** Materiali del motore usati dalle mesh cotte. */
export interface MaterialiCantiere {
  singolo: Material;
  doppio: Material;
}

/** Collider con le sue etichette (il motore conosce solo `tag`). */
export interface VoceCollider {
  collider: Collider;
  tag: string;
  /** luogo dei contenuti o gruppo di appartenenza */
  luogo?: string;
}

interface Accumulo {
  /** `sup` (facoltativo): superficie e occlusione per vertice, come l'attributo `aSuperficie` */
  parti: Array<{ pos: Float32Array; nor: Float32Array; col: Float32Array; sup?: Float32Array }>;
  vertici: number;
}

/**
 * Superficie di una forma semplice: valore costante [tipo + variante, occlusione] oppure per
 * vertice (posizione nelle coordinate della forma, prima della matrice).
 */
export type SuperficieForma = readonly [number, number] | ((p: Vector3) => readonly [number, number]);

const VETRO_SPENTO: RGB = [0.17, 0.155, 0.19];
const _v = new Vector3();
const _n = new Vector3();
const _nm = new Matrix3();
const _c = new Color();
const _rel = new Matrix4();
const _inv = new Matrix4();

/** Colore sRGB 0..1 da esadecimale. */
export function hex(h: number): RGB {
  return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
}

/** Mescola due colori. */
export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function scala(a: RGB, k: number): RGB {
  return [a[0] * k, a[1] * k, a[2] * k];
}

/** Opzioni per un oggetto della libreria. */
export interface OpzioniOggetto {
  /** aggiunge i collider dell'oggetto (predefinito sì) */
  collider?: boolean;
  /** rinomina i tag dei collider (es. 'muro' -> 'chiesa') */
  tag?: (tag: string | undefined) => string;
  /** luogo dei contenuti (metadato dei collider) */
  luogo?: string;
  /** raccoglie i lumi dai vetri accesi (predefinito sì) */
  lumi?: boolean;
  /** tinta moltiplicativa (rgb) applicata a tutta la geometria */
  tinta?: RGB;
}

export class Cantiere {
  readonly singolo: Accumulo = { parti: [], vertici: 0 };
  readonly doppio: Accumulo = { parti: [], vertici: 0 };
  readonly collider: VoceCollider[] = [];
  readonly lumi: Vector3[] = [];
  readonly dimensioniLumi: number[] = [];

  /** distanza (m) oltre la quale si mostra la versione `lontano` (se c'è) */
  distanzaLod = 210;
  private _lontano: Cantiere | null = null;

  constructor(readonly nome: string) {}

  /** Versione semplificata per la distanza (case come scatole, muri come nastri). */
  get lontano(): Cantiere {
    if (!this._lontano) this._lontano = new Cantiere(`${this.nome}:lontano`);
    return this._lontano;
  }

  get haLontano(): boolean {
    return !!this._lontano && this._lontano.triangoli > 0;
  }

  /** Numero di triangoli raccolti. */
  get triangoli(): number {
    return (this.singolo.vertici + this.doppio.vertici) / 3;
  }

  /**
   * Aggiunge un oggetto della libreria (o un Object3D con mesh della libreria) con la matrice mondo `m`.
   * Restituisce i punti notevoli dell'oggetto in coordinate mondo.
   */
  oggetto(o: OggettoProcedurale<unknown> | Object3D, m: Matrix4, opz: OpzioniOggetto = {}): Record<string, Vector3> {
    const radice = 'gruppo' in o ? o.gruppo : o;
    radice.updateMatrixWorld(true);
    _inv.copy(radice.matrixWorld).invert();
    radice.traverse((ob) => {
      if (!ob.visible) return;
      const mesh = ob as Mesh;
      if (!mesh.isMesh || (ob as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) return;
      const canale = String(mesh.userData['canale'] ?? 'opaco');
      _rel.multiplyMatrices(m, _inv).multiply(ob.matrixWorld);
      this.aggiungiGeometria(mesh.geometry, _rel, canale === 'sottile' ? 'doppio' : 'singolo', canale === 'lume', opz.lumi ?? true, opz.tinta);
    });
    if ('gruppo' in o) {
      if (opz.collider ?? true) {
        for (const c of o.collider) {
          const cm = colliderAlMondo(c, m) as Collider & { tag?: string };
          const tag = opz.tag ? opz.tag(c.tag) : (c.tag ?? 'oggetto');
          const col = { ...cm, id: -1, tag } as Collider;
          this.collider.push({ collider: col, tag, ...(opz.luogo ? { luogo: opz.luogo } : {}) });
        }
      }
      const punti: Record<string, Vector3> = {};
      for (const [k, v] of Object.entries(o.punti)) punti[k] = v.clone().applyMatrix4(m);
      return punti;
    }
    return {};
  }

  /** Aggiunge un collider già nel formato del motore. */
  aggiungiCollider(c: Collider, tag: string, luogo?: string): Collider {
    c.tag = tag;
    this.collider.push({ collider: c, tag, ...(luogo ? { luogo } : {}) });
    return c;
  }

  /** Aggiunge un lume (punto mondo). */
  lume(p: Vector3, dimensione = 0.6): void {
    this.lumi.push(p.clone());
    this.dimensioniLumi.push(dimensione);
  }

  /**
   * Aggiunge una geometria semplice (position + normal) con un colore uniforme o per vertice.
   * `emissione` 0..1: quanto si accende di notte (finestre, vetri).
   */
  forma(g: BufferGeometry, m: Matrix4, colore: RGB, emissione = 0, faccia: 'singolo' | 'doppio' = 'singolo', sfuma?: (p: Vector3, out: RGB) => void, superficie?: SuperficieForma): void {
    const gg = g.index ? g.toNonIndexed() : g;
    const pos = gg.getAttribute('position');
    const nor = gg.getAttribute('normal');
    const n = pos.count;
    const P = new Float32Array(n * 3);
    const N = new Float32Array(n * 3);
    const C = new Float32Array(n * 4);
    const S = superficie ? new Float32Array(n * 2) : undefined;
    _nm.getNormalMatrix(m);
    const out: RGB = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      _v.fromBufferAttribute(pos, i);
      if (sfuma) {
        out[0] = colore[0];
        out[1] = colore[1];
        out[2] = colore[2];
        sfuma(_v, out);
      }
      if (S && superficie) {
        const t = typeof superficie === 'function' ? superficie(_v) : superficie;
        S[i * 2] = t[0];
        S[i * 2 + 1] = t[1];
      }
      _v.applyMatrix4(m);
      P[i * 3] = _v.x;
      P[i * 3 + 1] = _v.y;
      P[i * 3 + 2] = _v.z;
      if (nor) _n.fromBufferAttribute(nor, i).applyMatrix3(_nm).normalize();
      else _n.set(0, 1, 0);
      N[i * 3] = _n.x;
      N[i * 3 + 1] = _n.y;
      N[i * 3 + 2] = _n.z;
      const c = sfuma ? out : colore;
      C[i * 4] = c[0];
      C[i * 4 + 1] = c[1];
      C[i * 4 + 2] = c[2];
      C[i * 4 + 3] = emissione;
    }
    const acc = faccia === 'doppio' ? this.doppio : this.singolo;
    acc.parti.push(S ? { pos: P, nor: N, col: C, sup: S } : { pos: P, nor: N, col: C });
    acc.vertici += n;
  }

  /** Triangoli già in coordinate mondo (posizioni, normali, colori rgba; `S` = aSuperficie, 2 per vertice). */
  grezzo(P: Float32Array, N: Float32Array, C: Float32Array, faccia: 'singolo' | 'doppio' = 'singolo', S?: Float32Array): void {
    const acc = faccia === 'doppio' ? this.doppio : this.singolo;
    acc.parti.push(S ? { pos: P, nor: N, col: C, sup: S } : { pos: P, nor: N, col: C });
    acc.vertici += P.length / 3;
  }

  /** Geometria già con `aColor` (o `color` lineare della libreria) e matrice. */
  private aggiungiGeometria(g: BufferGeometry, m: Matrix4, faccia: 'singolo' | 'doppio', lume: boolean, raccogliLumi: boolean, tinta?: RGB): void {
    const gg = g.index ? g.toNonIndexed() : g;
    const pos = gg.getAttribute('position');
    const nor = gg.getAttribute('normal');
    const aCol = gg.getAttribute('aColor');
    const col = gg.getAttribute('color');
    const sup = gg.getAttribute('aSuperficie');
    const n = pos.count;
    const P = new Float32Array(n * 3);
    const N = new Float32Array(n * 3);
    const C = new Float32Array(n * 4);
    const S = sup ? new Float32Array(n * 2) : undefined;
    _nm.getNormalMatrix(m);
    for (let i = 0; i < n; i++) {
      if (S && sup) {
        S[i * 2] = sup.getX(i);
        S[i * 2 + 1] = sup.itemSize > 1 ? sup.getY(i) : 0;
      }
      _v.fromBufferAttribute(pos, i).applyMatrix4(m);
      P[i * 3] = _v.x;
      P[i * 3 + 1] = _v.y;
      P[i * 3 + 2] = _v.z;
      if (nor) _n.fromBufferAttribute(nor, i).applyMatrix3(_nm).normalize();
      else _n.set(0, 1, 0);
      N[i * 3] = _n.x;
      N[i * 3 + 1] = _n.y;
      N[i * 3 + 2] = _n.z;
      let r = 0.7;
      let gr = 0.7;
      let b = 0.7;
      let a = 0;
      if (aCol) {
        r = aCol.getX(i);
        gr = aCol.getY(i);
        b = aCol.getZ(i);
        a = aCol.getW(i);
      } else if (col) {
        // la libreria tiene i colori per vertice in spazio lineare (se ColorManagement è attivo)
        _c.setRGB(col.getX(i), col.getY(i), col.getZ(i), LinearSRGBColorSpace);
        const s = { r: 0, g: 0, b: 0 };
        _c.getRGB(s, SRGBColorSpace);
        r = s.r;
        gr = s.g;
        b = s.b;
        if (lume) a = Math.min(1, Math.max(0, (Math.max(r, gr, b) - 0.25) * 1.6));
      }
      if (lume && a > 0.3) {
        // vetro acceso di notte: di giorno è scuro come le finestre del motore
        r = VETRO_SPENTO[0];
        gr = VETRO_SPENTO[1];
        b = VETRO_SPENTO[2];
      }
      if (tinta) {
        r *= tinta[0];
        gr *= tinta[1];
        b *= tinta[2];
      }
      C[i * 4] = r;
      C[i * 4 + 1] = gr;
      C[i * 4 + 2] = b;
      C[i * 4 + 3] = a;
    }
    const acc = faccia === 'doppio' ? this.doppio : this.singolo;
    acc.parti.push(S ? { pos: P, nor: N, col: C, sup: S } : { pos: P, nor: N, col: C });
    acc.vertici += n;
    if (lume && raccogliLumi) this.raccogliLumi(P, N, C);
  }

  /** Raggruppa i triangoli accesi in lumi (centro del vetro, poco fuori dalla faccia). */
  private raccogliLumi(P: Float32Array, N: Float32Array, C: Float32Array): void {
    const gruppi: Array<{ s: Vector3; n: Vector3; k: number }> = [];
    const tri = P.length / 9;
    const c = new Vector3();
    const nn = new Vector3();
    for (let t = 0; t < tri; t++) {
      const i0 = t * 3;
      if ((C[i0 * 4 + 3] as number) < 0.5 || (C[(i0 + 1) * 4 + 3] as number) < 0.5 || (C[(i0 + 2) * 4 + 3] as number) < 0.5) continue;
      c.set(0, 0, 0);
      nn.set(0, 0, 0);
      for (let k = 0; k < 3; k++) {
        c.x += P[(i0 + k) * 3] as number;
        c.y += P[(i0 + k) * 3 + 1] as number;
        c.z += P[(i0 + k) * 3 + 2] as number;
        nn.x += N[(i0 + k) * 3] as number;
        nn.y += N[(i0 + k) * 3 + 1] as number;
        nn.z += N[(i0 + k) * 3 + 2] as number;
      }
      c.multiplyScalar(1 / 3);
      let g = gruppi.find((x) => x.s.clone().multiplyScalar(1 / x.k).distanceToSquared(c) < 0.9 * 0.9);
      if (!g) {
        g = { s: new Vector3(), n: new Vector3(), k: 0 };
        gruppi.push(g);
      }
      g.s.add(c);
      g.n.add(nn);
      g.k++;
    }
    // al più due bagliori per casa (le finestre più grandi): i bagliori del motore non si nascondono
    // dietro i muri, e tante finestre sui fianchi diventavano puntini attorno alla casa
    gruppi.sort((a, b) => b.k - a.k);
    for (const g of gruppi.slice(0, 2)) {
      const p = g.s.multiplyScalar(1 / g.k);
      if (g.n.lengthSq() > 1e-6) p.addScaledVector(g.n.normalize(), 0.25);
      // alone piccolo: la finestra si deve leggere come una finestra, non come una lanterna
      this.lume(p, 0.3);
    }
  }

  /**
   * Cuoce la zona: una o due mesh con i materiali del motore; se c'è una versione `lontano`, un LOD
   * centrato sulla zona (vicino fino a `distanzaLod`, poi la versione semplice).
   */
  costruisci(mat: MaterialiCantiere): Object3D {
    const vicino = this.costruisciSolo(mat);
    if (!this.haLontano) return vicino;
    const lontano = this._lontano!.costruisciSolo(mat);
    const sfera = new Sphere();
    const tmp = new Sphere();
    let prima = true;
    vicino.traverse((o) => {
      const g = (o as Mesh).geometry as BufferGeometry | undefined;
      if (!g?.boundingSphere) return;
      if (prima) sfera.copy(g.boundingSphere);
      else sfera.union(tmp.copy(g.boundingSphere));
      prima = false;
    });
    const lod = new LOD();
    lod.name = `corbella:${this.nome}:lod`;
    lod.position.copy(sfera.center);
    lod.updateMatrix();
    for (const g of [vicino, lontano]) {
      g.position.copy(sfera.center).negate();
      g.updateMatrix();
      g.matrixAutoUpdate = false;
    }
    lod.addLevel(vicino, 0);
    lod.addLevel(lontano, this.distanzaLod);
    lod.userData['triangoliVicino'] = this.triangoli;
    lod.userData['triangoliLontano'] = this._lontano!.triangoli;
    return lod;
  }

  private costruisciSolo(mat: MaterialiCantiere): Object3D {
    const gruppo = new Object3D();
    gruppo.name = `corbella:${this.nome}`;
    for (const [nome, acc] of [
      ['singolo', this.singolo],
      ['doppio', this.doppio],
    ] as const) {
      if (!acc.vertici) continue;
      const P = new Float32Array(acc.vertici * 3);
      const N = new Float32Array(acc.vertici * 3);
      const C = new Float32Array(acc.vertici * 4);
      // aSuperficie solo se qualche parte la dichiara (le altre restano 0: superficie del materiale)
      const S = acc.parti.some((p) => p.sup) ? new Float32Array(acc.vertici * 2) : null;
      let o = 0;
      for (const p of acc.parti) {
        P.set(p.pos, o * 3);
        N.set(p.nor, o * 3);
        C.set(p.col, o * 4);
        if (S && p.sup) S.set(p.sup, o * 2);
        o += p.pos.length / 3;
      }
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(P, 3));
      g.setAttribute('normal', new BufferAttribute(N, 3));
      g.setAttribute('aColor', new BufferAttribute(C, 4));
      if (S) g.setAttribute('aSuperficie', new BufferAttribute(S, 2));
      g.computeBoundingSphere();
      g.computeBoundingBox();
      const mesh = new Mesh(g, nome === 'doppio' ? mat.doppio : mat.singolo);
      mesh.name = `corbella:${this.nome}:${nome}`;
      mesh.matrixAutoUpdate = false;
      mesh.userData['triangoli'] = acc.vertici / 3;
      gruppo.add(mesh);
    }
    gruppo.matrixAutoUpdate = false;
    return gruppo;
  }
}
