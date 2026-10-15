/**
 * Costruttore di geometrie unite.
 *
 * Ogni oggetto viene composto aggiungendo pezzi (geometrie three.js) con un colore per vertice,
 * una trasformazione e un canale di materiale; alla fine tutti i pezzi dello stesso canale
 * diventano UNA sola BufferGeometry, quindi una sola draw call per canale.
 * Le geometrie unite si possono anche estrarre per istanziarle (vedi istanze.ts).
 */
import * as THREE from 'three';
import { materialePer, type Canale } from './materiali';
import { hashPosizione, Rng } from './rng';

/** Funzione di colore per vertice: riceve posizione e normale (coordinate dell'oggetto). */
export type FnColore = (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => void;

/** Occlusione ambientale cotta per vertice (0 = nessuna, 1 = buio pieno), posizione e normale nell'oggetto. */
export type FnOcclusione = (p: THREE.Vector3, n: THREE.Vector3) => number;

export interface Gradiente {
  /** moltiplicatore di luminosità alla quota y0 */
  basso: number;
  /** moltiplicatore di luminosità alla quota y1 */
  alto: number;
  y0: number;
  y1: number;
}

export interface OpzioniPezzo {
  /**
   * colore (sRGB, come in PALETTE) o funzione per vertice (in spazio lineare);
   * 'geometria' usa l'attributo `color` già presente nella geometria (es. pezzi di un altro Costruttore)
   */
  colore: THREE.ColorRepresentation | FnColore | 'geometria';
  canale?: Canale;
  /** trasformazione del pezzo */
  matrice?: THREE.Matrix4;
  /** normali per faccia (pietra, tetti, legno); altrimenti normali morbide */
  piatto?: boolean;
  /** sfumatura verticale di luminosità */
  gradiente?: Gradiente;
  /** variazione di luminosità per vertice, coerente sulla posizione (0..0.5) */
  rumore?: number;
  /** variazione di luminosità dell'intero pezzo (0..0.5) */
  variazione?: number;
  /** variazione di tinta dell'intero pezzo verso il caldo/freddo (0..0.2) */
  tinta?: number;
  /** indice dell'osso (solo per mesh con scheletro) */
  osso?: number;
  /** pesi per vertice: restituisce [i0, w0, i1, w1] (solo per mesh con scheletro) */
  pesi?: (p: THREE.Vector3) => [number, number, number, number];
  /**
   * tipo di superficie dipinta dal materiale del mondo (valore di `SUPERFICIE` di
   * `render/superfici.ts`, più la variante 0..0.99): pietra, piode, legno, intonaco, tessuto…
   * Senza (0) vale la superficie del materiale (AUTO per gli oggetti: dedotta dal colore).
   * Con `colore: 'geometria'` si tiene il tag della geometria sorgente se non se ne dà uno.
   */
  superficie?: number;
  /** occlusione ambientale cotta: costante o per vertice (piede dei muri, sotto le gronde) */
  occlusione?: number | FnOcclusione;
}

interface Accumulo {
  pos: number[];
  nor: number[];
  col: number[];
  skinI: number[];
  skinW: number[];
  skin: boolean;
  /** superficie e occlusione per vertice (x, y), come l'attributo `aSuperficie` */
  sup: number[];
  /** almeno un pezzo ha dichiarato superficie o occlusione */
  conSup: boolean;
}

/** Costruisce una matrice da posizione, rotazione (Eulero XYZ, radianti) e scala. */
export function mat(
  pos: readonly [number, number, number] | THREE.Vector3 = [0, 0, 0],
  rot: readonly [number, number, number] | THREE.Euler = [0, 0, 0],
  scala: number | readonly [number, number, number] = 1,
): THREE.Matrix4 {
  const p = pos instanceof THREE.Vector3 ? pos : new THREE.Vector3(pos[0], pos[1], pos[2]);
  const e = rot instanceof THREE.Euler ? rot : new THREE.Euler(rot[0], rot[1], rot[2]);
  const s = typeof scala === 'number' ? new THREE.Vector3(scala, scala, scala) : new THREE.Vector3(scala[0], scala[1], scala[2]);
  return new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(e), s);
}

/** Matrice che porta l'asse +Y del pezzo lungo il segmento a→b (per aste, pali, rami). */
export function matSegmento(a: THREE.Vector3, b: THREE.Vector3, scalaXZ = 1): THREE.Matrix4 {
  const d = new THREE.Vector3().subVectors(b, a);
  const l = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  return new THREE.Matrix4().compose(a.clone(), q, new THREE.Vector3(scalaXZ, l, scalaXZ));
}

const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _c = new THREE.Color();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _cc = new THREE.Vector3();
const _nm = new THREE.Matrix3();

export class Costruttore {
  private canali = new Map<Canale, Accumulo>();
  readonly rng: Rng;
  /** seme del rumore di colore */
  private semeRumore: number;

  constructor(rng: Rng | number = 1) {
    this.rng = typeof rng === 'number' ? new Rng(rng) : rng;
    this.semeRumore = this.rng.seme;
  }

  private accumulo(canale: Canale): Accumulo {
    let a = this.canali.get(canale);
    if (!a) {
      a = { pos: [], nor: [], col: [], skinI: [], skinW: [], skin: false, sup: [], conSup: false };
      this.canali.set(canale, a);
    }
    return a;
  }

  /** Aggiunge un pezzo. La geometria passata non viene modificata. */
  aggiungi(geo: THREE.BufferGeometry, opz: OpzioniPezzo): this {
    const acc = this.accumulo(opz.canale ?? 'opaco');
    const m = opz.matrice ?? new THREE.Matrix4();
    _nm.getNormalMatrix(m);
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    let norAttr = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
    if (!norAttr && !opz.piatto) {
      const g2 = geo.clone();
      g2.computeVertexNormals();
      norAttr = g2.getAttribute('normal') as THREE.BufferAttribute;
    }
    const indice = geo.getIndex();
    const nVert = indice ? indice.count : posAttr.count;

    // colore di base
    const colAttr = opz.colore === 'geometria' ? (geo.getAttribute('color') as THREE.BufferAttribute | undefined) : undefined;
    const fn = typeof opz.colore === 'function' ? (opz.colore as FnColore) : null;
    const base = fn || opz.colore === 'geometria' ? null : new THREE.Color(opz.colore as THREE.ColorRepresentation);
    // superficie: dal pezzo, oppure (pezzi già costruiti) dalla geometria sorgente
    const supAttr = opz.superficie === undefined && opz.occlusione === undefined ? (geo.getAttribute('aSuperficie') as THREE.BufferAttribute | undefined) : undefined;
    const supPezzo = opz.superficie ?? 0;
    const occFn = typeof opz.occlusione === 'function' ? opz.occlusione : null;
    const occK = typeof opz.occlusione === 'number' ? opz.occlusione : 0;
    if (supAttr || opz.superficie !== undefined || opz.occlusione !== undefined) acc.conSup = true;
    const varPezzo = opz.variazione ? 1 + this.rng.centrato(opz.variazione) : 1;
    const tintaPezzo = opz.tinta ? this.rng.centrato(opz.tinta) : 0;
    const det = m.determinant();

    const inizio = acc.pos.length / 3;
    for (let k = 0; k < nVert; k++) {
      // con determinante negativo (specchiatura) l'ordine dei vertici va invertito
      let kk = k;
      if (det < 0) {
        const t = k % 3;
        kk = k - t + (t === 1 ? 2 : t === 2 ? 1 : 0);
      }
      const i = indice ? indice.getX(kk) : kk;
      _p.fromBufferAttribute(posAttr, i).applyMatrix4(m);
      if (norAttr) _n.fromBufferAttribute(norAttr, i).applyMatrix3(_nm).normalize();
      else _n.set(0, 1, 0);
      acc.pos.push(_p.x, _p.y, _p.z);
      acc.nor.push(_n.x, _n.y, _n.z);

      if (fn) fn(_p, _n, _c);
      else if (colAttr) _c.fromBufferAttribute(colAttr, i);
      else if (base) _c.copy(base);
      else _c.setRGB(1, 1, 1);
      let f = varPezzo;
      if (opz.gradiente) {
        const g = opz.gradiente;
        const t = THREE.MathUtils.clamp((_p.y - g.y0) / (g.y1 - g.y0 || 1), 0, 1);
        f *= THREE.MathUtils.lerp(g.basso, g.alto, t);
      }
      if (opz.rumore) f *= 1 + (hashPosizione(_p.x, _p.y, _p.z, this.semeRumore) - 0.5) * 2 * opz.rumore;
      let r = _c.r * f;
      let gg = _c.g * f;
      let bb = _c.b * f;
      if (tintaPezzo) {
        r *= 1 + tintaPezzo;
        bb *= 1 - tintaPezzo;
      }
      acc.col.push(r, gg, bb);
      if (supAttr) acc.sup.push(supAttr.getX(i), supAttr.itemSize > 1 ? supAttr.getY(i) : 0);
      else acc.sup.push(supPezzo, occFn ? occFn(_p, _n) : occK);

      if (opz.osso !== undefined || opz.pesi) {
        acc.skin = true;
        if (opz.pesi) {
          const [i0, w0, i1, w1] = opz.pesi(_p);
          acc.skinI.push(i0, i1, 0, 0);
          acc.skinW.push(w0, w1, 0, 0);
        } else {
          acc.skinI.push(opz.osso as number, 0, 0, 0);
          acc.skinW.push(1, 0, 0, 0);
        }
      } else {
        acc.skinI.push(0, 0, 0, 0);
        acc.skinW.push(1, 0, 0, 0);
      }
    }

    // normali per faccia
    if (opz.piatto) {
      for (let v = inizio; v < acc.pos.length / 3; v += 3) {
        _a.fromArray(acc.pos, v * 3);
        _b.fromArray(acc.pos, v * 3 + 3);
        _cc.fromArray(acc.pos, v * 3 + 6);
        _b.sub(_a);
        _cc.sub(_a);
        _b.cross(_cc).normalize();
        for (let j = 0; j < 3; j++) {
          acc.nor[(v + j) * 3] = _b.x;
          acc.nor[(v + j) * 3 + 1] = _b.y;
          acc.nor[(v + j) * 3 + 2] = _b.z;
        }
      }
    }
    return this;
  }

  /** Scorciatoia: parallelepipedo w×h×d con la base appoggiata a y = 0 della propria matrice. */
  box(w: number, h: number, d: number, matrice: THREE.Matrix4, opz: Omit<OpzioniPezzo, 'matrice'>): this {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0);
    return this.aggiungi(g, { piatto: true, ...opz, matrice });
  }

  /** Numero di triangoli accumulati (tutti i canali). */
  triangoli(): number {
    let t = 0;
    for (const a of this.canali.values()) t += a.pos.length / 9;
    return t;
  }

  vuoto(): boolean {
    return this.triangoli() === 0;
  }

  /** Geometria unita di un canale (o null se vuoto). */
  geometria(canale: Canale): THREE.BufferGeometry | null {
    const a = this.canali.get(canale);
    if (!a || a.pos.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(a.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(a.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(a.col, 3));
    if (a.skin) {
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(a.skinI, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(a.skinW, 4));
    }
    if (a.conSup) g.setAttribute('aSuperficie', new THREE.Float32BufferAttribute(a.sup, 2));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }

  /** Canali non vuoti. */
  canaliUsati(): Canale[] {
    return [...this.canali.entries()].filter(([, a]) => a.pos.length > 0).map(([c]) => c);
  }

  /**
   * Crea un gruppo con una mesh per canale.
   * @param nome nome del gruppo (e prefisso delle mesh)
   */
  costruisci(nome: string, ombre = true): THREE.Group {
    const gruppo = new THREE.Group();
    gruppo.name = nome;
    for (const canale of this.canaliUsati()) {
      const g = this.geometria(canale);
      if (!g) continue;
      const mesh = new THREE.Mesh(g, materialePer(canale));
      mesh.name = `${nome}:${canale}`;
      mesh.userData['canale'] = canale;
      mesh.castShadow = ombre && canale !== 'lume';
      mesh.receiveShadow = canale !== 'lume';
      gruppo.add(mesh);
    }
    return gruppo;
  }

  /** Crea una singola mesh (il canale indicato) o null. */
  mesh(nome: string, canale: Canale = 'opaco', ombre = true): THREE.Mesh | null {
    const g = this.geometria(canale);
    if (!g) return null;
    const mesh = new THREE.Mesh(g, materialePer(canale));
    mesh.name = `${nome}:${canale}`;
    mesh.userData['canale'] = canale;
    mesh.castShadow = ombre && canale !== 'lume';
    mesh.receiveShadow = canale !== 'lume';
    return mesh;
  }
}

/** Colore sRGB → lineare (scorciatoia). */
export function col(c: THREE.ColorRepresentation): THREE.Color {
  return new THREE.Color(c);
}

/** Interpola fra due colori della palette (sRGB in ingresso, risultato lineare). */
export function mescola(a: THREE.ColorRepresentation, b: THREE.ColorRepresentation, t: number): THREE.Color {
  return new THREE.Color(a).lerp(new THREE.Color(b), t);
}
