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

/**
 * Distanza del cambio di dettaglio delle zone del paese per livello di qualità (m). Rifinitura 2:
 * Media da 400 a 310 m (dalla terrazza verso il paese faceva 257 draw call e 1,85 M triangoli, sul
 * livello che deve reggere i 60 fps su grafica integrata); Bassa a 260.
 * Unione 4: Alta da 400 a 350 m. La rifinitura 2 «oggetti» teneva 400 finché il caso peggiore (il
 * paese da 190 m nel bosco, 860/16) restava sotto i 2,5 M triangoli; con i fusti e le chiome della
 * rifinitura 2 «mondo» arrivava a 2,51 M di sola scena (2,69 M con le ombre); a 350 m scende a
 * 2,26 M (2,45 M con le ombre). Da vicino (terrazze, castagno morto, Velo) non cambia nulla.
 */
export function distanzaLodPerQualita(livello: string): number {
  return livello === 'bassa' ? 260 : livello === 'media' ? 310 : 350;
}

/** Aggiorna la distanza del cambio di dettaglio di tutti i LOD cotti sotto `radice`. */
export function impostaDistanzaLod(radice: Object3D, distanza: number): void {
  radice.traverse((o) => {
    const lod = o as LOD;
    if (!lod.isLOD || !lod.name.startsWith('corbella:')) return;
    const l = lod.levels[1];
    if (l) l.distance = distanza;
  });
}

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
  /** nome dell'oggetto posato (per l'inventario delle porte: `rustico_12`, `annesso_3`…) */
  nome?: string;
}

/**
 * Una porta posata nel mondo (migliorie «porte»): la `PortaOggetto` della libreria portata in
 * coordinate mondo con la matrice di posa. La raccolgono i cantieri; la maniglia di Corbella le
 * elenca tutte (`porte()`) per le verifiche e per le schermate.
 */
export interface PortaPosata {
  /** `proprietario:nome` (unico nella maniglia) */
  id: string;
  nome: string;
  /** l'oggetto a cui appartiene (nome posato, luogo o nome del generatore) */
  proprietario: string;
  /** il generatore (rustico, annesso, casupola, campanile…) */
  oggetto: string;
  zona: string;
  /** centro della soglia sul filo del muro (mondo) */
  centro: Vector3;
  /** normale orizzontale verso fuori (mondo, unitaria) */
  normale: Vector3;
  /** il su locale (verso l'asse) */
  su: Vector3;
  larghezza: number;
  altezza: number;
  battente: number;
  appoggio: 'suolo' | 'scala' | 'balcone';
  /** origine dell'oggetto posato (mondo) */
  origine: Vector3;
  /** variante di un elemento mobile (E2…) a cui appartiene, se è mobile */
  variante?: string;
}

/**
 * Una scaletta di gneiss posata davanti a una porta (migliorie «porte», `gradiniPorta`): il
 * pianerottolo e i gradini, misurati dalla soglia lungo la normale della porta. Serve alla verifica
 * (gradini dentro altri edifici o nel muro di una terrazza, pedate sepolte da un fianco, ultimo
 * scalino troppo alto).
 */
export interface ScalettaPosata {
  /** l'oggetto della porta (nome posato o luogo), se noto */
  proprietario?: string;
  zona: string;
  /** centro della soglia sul filo del muro (mondo) */
  soglia: Vector3;
  /** normale orizzontale della porta (mondo, unitaria) e su locale */
  normale: Vector3;
  su: Vector3;
  /** la rampa scende dritta davanti alla porta o di lato, lungo la facciata */
  verso: string;
  /** larghezza del pianerottolo (m) */
  larghezza: number;
  /** profondità del pianerottolo (m dal muro) */
  inizio: number;
  /** quanto la scaletta si allontana dal muro lungo la normale (m) */
  lunghezza: number;
  alzata: number;
  /**
   * il pianerottolo e le pedate nel riferimento della porta: centro `d` m davanti al muro e `l` m di
   * lato (verso t = su × normale), direzione della rampa (fd, fl), lunghezza e larghezza, cima `top`
   * rispetto alla soglia
   */
  gradini: Array<{ d: number; l: number; fd: number; fl: number; lungo: number; largo: number; top: number }>;
  /** i muretti sul bordo del pianerottolo (con la rampa di lato), nello stesso riferimento */
  parapetti: Array<{ d: number; l: number; fd: number; fl: number; lungo: number }>;
  /** dove si scende sul prato (0,3 m dopo l'ultimo gradino) e direzione della rampa */
  uscita: { d: number; l: number };
  direzione: { d: number; l: number };
}

export class Cantiere {
  readonly singolo: Accumulo = { parti: [], vertici: 0 };
  readonly doppio: Accumulo = { parti: [], vertici: 0 };
  readonly collider: VoceCollider[] = [];
  /** porte degli oggetti posati (coordinate mondo) */
  readonly porte: PortaPosata[] = [];
  /** scalette davanti alle porte (coordinate mondo) */
  readonly scalette: ScalettaPosata[] = [];
  readonly lumi: Vector3[] = [];
  readonly dimensioniLumi: number[] = [];
  /** direzione di ogni lume (normale del vetro delle finestre; null = in tutte le direzioni) */
  readonly direzioniLumi: (Vector3 | null)[] = [];

  /**
   * distanza (m) oltre la quale si mostra la versione `lontano` (se c'è). Rifinitura 1: 400 m a
   * Media e Alta, 260 a Bassa (prima 210: dalle terrazze e dal belvedere il paese era di scatole);
   * la cambia la qualità con `distanzaLodPerQualita` (vedi `installaCorbella`; oggi 350/310/260).
   */
  distanzaLod = 400;
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
      if (o.porte) {
        const proprietario = opz.nome ?? opz.luogo ?? o.nome;
        const origine = new Vector3().setFromMatrixPosition(m);
        const su = new Vector3(0, 1, 0).transformDirection(m);
        for (const p of o.porte) {
          this.porte.push({
            id: `${proprietario}:${p.nome}`,
            nome: p.nome,
            proprietario,
            oggetto: o.nome,
            zona: this.nome,
            centro: p.centro.clone().applyMatrix4(m),
            normale: p.normale.clone().transformDirection(m),
            su: su.clone(),
            larghezza: p.larghezza,
            altezza: p.altezza,
            battente: p.battente,
            appoggio: p.appoggio,
            origine: origine.clone(),
          });
        }
      }
      const punti: Record<string, Vector3> = {};
      for (const [k, v] of Object.entries(o.punti)) punti[k] = v.clone().applyMatrix4(m);
      return punti;
    }
    return {};
  }

  /**
   * Segna una porta disegnata a mano nel cantiere (le versioni lontane delle case): soglia in (u, v)
   * sulla facciata +Z dell'oggetto posato con la matrice `m`, battente a `battente` dal muro.
   */
  segnaPorta(m: Matrix4, proprietario: string, oggetto: string, u: number, v: number, larghezza: number, altezza: number, zFacciata: number, battente: number): void {
    this.porte.push({
      id: `${proprietario}:porta`,
      nome: 'porta',
      proprietario,
      oggetto,
      zona: this.nome,
      centro: new Vector3(u, v, zFacciata).applyMatrix4(m),
      normale: new Vector3(0, 0, 1).transformDirection(m),
      su: new Vector3(0, 1, 0).transformDirection(m),
      larghezza,
      altezza,
      battente,
      appoggio: 'suolo',
      origine: new Vector3().setFromMatrixPosition(m),
    });
  }

  /** Aggiunge un collider già nel formato del motore. */
  aggiungiCollider(c: Collider, tag: string, luogo?: string): Collider {
    c.tag = tag;
    this.collider.push({ collider: c, tag, ...(luogo ? { luogo } : {}) });
    return c;
  }

  /** Aggiunge un lume (punto mondo); `direzione`: verso dove guarda (finestre), se no tutt'attorno. */
  lume(p: Vector3, dimensione = 0.6, direzione: Vector3 | null = null): void {
    this.lumi.push(p.clone());
    this.dimensioniLumi.push(dimensione);
    this.direzioniLumi.push(direzione ? direzione.clone().normalize() : null);
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
    // ogni finestra accesa ha il suo bagliore, con la direzione del vetro: i bagliori del motore
    // sono spinti verso la camera e passano i muri, e le finestre sul retro facevano puntini attorno
    // alla casa; con la direzione si spengono quando il vetro guarda dall'altra parte
    for (const g of gruppi) {
      const p = g.s.multiplyScalar(1 / g.k);
      const n = g.n.lengthSq() > 1e-6 ? g.n.normalize() : null;
      if (n) p.addScaledVector(n, 0.25);
      // alone contenuto: la finestra si deve leggere come una finestra, non come una lanterna
      this.lume(p, 0.42, n);
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
