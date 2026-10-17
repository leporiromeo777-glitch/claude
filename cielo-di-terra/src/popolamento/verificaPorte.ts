/**
 * Verifica delle porte del paese (migliorie «porte», dopo la prova del 16 ottobre: «alcune porte che
 * non si vedono e sono incastrate»). Gira in Node sul paese vero (`installaCorbella` + i collider del
 * motore) e, per ogni porta posata (`ManigliaCorbella.porte()`), controlla:
 *
 * - `sotto_terra`: il suolo davanti alla soglia (o una lastra calpestabile) sta più di 0,15 m sopra la
 *   soglia: il battente è sepolto per un pezzo;
 * - `sospesa`: appena fuori il suolo (o il pianerottolo) è più di 0,15 m sotto la soglia, o nel metro
 *   e sessanta davanti c'è un salto più alto di un gradino;
 * - `contro_pendio`: a 1,2 m davanti il suolo sale più di mezzo metro (la porta guarda una scarpata);
 * - `ostruita`: nel metro e venti davanti alla porta c'è un collider (muro, annesso, scala, tronco…)
 *   che non è un gradino o una lastra alla quota della soglia;
 * - `dentro_impronta`: lo spazio davanti cade nell'impronta di un altro edificio, di un orto, di un
 *   albero (anche senza collider);
 * - `coperta`: un raggio che arriva dritto sulla porta incontra qualcos'altro prima del battente
 *   (lo zoccolo del campanile, il muro di un annesso, il nucleo di un muro a secco…) o il terreno;
 * - `sfarfallio`: sul battente c'è un'altra superficie a meno di 1,2 cm (stesso piano: z-fighting);
 * - `lod`: la casa ha una versione lontana ma lì la porta non c'è, o sta altrove;
 * - `gradini_ostruiti`: sopra il pianerottolo o un gradino della scaletta davanti alla porta (fino a
 *   1,7 m), o nel metro dopo l'ultimo, c'è un collider che non si calpesta (il muro di un'altra casa,
 *   il suo tetto, il muro di una terrazza), o la scaletta entra nell'impronta di un altro edificio;
 * - `gradini_sepolti`: una pedata sta sotto il suolo, da un fianco, più di 2 cm (il «dente» di
 *   pietra dei pendii di traverso, o il prato che spunta sulla pietra);
 * - `gradini_sospesi`: dall'ultimo gradino al prato c'è più di 30 cm.
 *
 * I raggi attraversano le mesh vere del paese (quelle cotte dai cantieri, vicino e lontano), con un
 * indice dei soli triangoli attorno alle porte: tutta la verifica dura pochi secondi.
 */
import { Mesh, Vector3, type BufferAttribute, type Object3D } from 'three';
import type { ColliderWorld, Collider } from '../world/colliders';
import { cylToWorld, localFrameTheta, worldToCyl } from '../world/cylinder';
import { groundHeight } from '../world/terrain';
import type { PortaPosata, ScalettaPosata } from './cantiere';
import type { Impronta } from './contesto';
import type { ManigliaCorbella } from './corbella';
import { differenza, distanza } from './terreno';

export type DifettoPorta = 'sotto_terra' | 'sospesa' | 'contro_pendio' | 'ostruita' | 'dentro_impronta' | 'coperta' | 'sfarfallio' | 'lod' | 'gradini_ostruiti' | 'gradini_sepolti' | 'gradini_sospesi';

export const DIFETTI_PORTA: readonly DifettoPorta[] = ['sotto_terra', 'sospesa', 'contro_pendio', 'ostruita', 'dentro_impronta', 'coperta', 'sfarfallio', 'lod', 'gradini_ostruiti', 'gradini_sepolti', 'gradini_sospesi'];

export interface EsitoPorta {
  porta: PortaPosata;
  difetti: DifettoPorta[];
  /** quota (z, θ, h) del centro della soglia */
  soglia: { z: number; theta: number; h: number };
  /** suolo davanti rispetto alla soglia (m): il minimo appena fuori (0,15-0,3 m), il massimo fino a 0,7 m */
  suoloMin: number;
  suoloMax: number;
  /** suolo a 1,2 m davanti rispetto alla soglia (m) */
  suolo120: number;
  /** collider o impronta che ingombra (tag e luogo), se c'è */
  ostacolo?: string;
  /** frazione dei raggi che trovano qualcosa davanti al battente (0-1) */
  copertura: number;
  /** frazione dei raggi con una superficie complanare al battente (0-1) */
  complanare: number;
  /** distanza (m) della porta più vicina della versione lontana (Infinity se la casa non ce l'ha) */
  distanzaLontana?: number;
  note: string[];
}

export interface FontiVerificaPorte {
  /** i collider del mondo (motore + paese) */
  colliders: ColliderWorld;
  /** impronte del popolamento */
  impronte: ReadonlyArray<Impronta>;
  /** radice delle mesh del paese (vicino), per i raggi; senza, niente `coperta`/`sfarfallio` */
  scena?: Object3D;
  /** porte della versione lontana; con `zoneLontane` (le zone che hanno un lontano) dà `lod` */
  porteLontane?: ReadonlyArray<PortaPosata>;
  zoneLontane?: ReadonlySet<string>;
  /** porte coperte apposta (predefinite: `PORTE_VELATE`) */
  velate?: ReadonlySet<string>;
  /** quota del suolo visivo (predefinita: `groundHeight`, la mesh LOD 0) */
  suolo?: (z: number, theta: number) => number;
  /** le scalette davanti alle porte (`ManigliaCorbella.scalette()`): senza, niente controlli dei gradini */
  scalette?: ReadonlyArray<ScalettaPosata>;
}

/** Una pedata può stare sotto il suolo, da un fianco, al più di tanto (m): il prato non spunta sulla pietra. */
export const GRADINO_SEPOLTO = 0.02;
/** Il pianerottolo, sul suo spigolo a monte, può stare sotto il suolo al più di tanto (m). */
export const PIANEROTTOLO_SEPOLTO = 0.12;
/** Dall'ultimo gradino al prato al più (m). */
export const ULTIMO_SCALINO = 0.3;

/**
 * Porte coperte apposta: la Casa del Velo ha un velo nero appeso davanti alla porta (contenuti:
 * «un velo nero sulla porta»). Per loro `coperta` non vale.
 */
export const PORTE_VELATE: ReadonlySet<string> = new Set(['casa_del_velo:porta']);

/** Tolleranza della soglia sul suolo (m). */
export const TOLLERANZA_SOGLIA = 0.15;
/** Spazio libero davanti alla porta (m). */
export const SPAZIO_DAVANTI = 1.2;

/** Tag dei collider su cui si cammina (gradini, lastre, scale, passerelle). */
const CALPESTABILI = new Set(['calpestabile', 'gradino', 'scala', 'passerella', 'soglia']);

/**
 * Impronte di spazi aperti (una porta può dare sulla piazza, sul sagrato, su un ripiano, su un
 * sentiero): non contano per `dentro_impronta`.
 */
export function improntaAperta(nome: string): boolean {
  return /^porta:|^scala:|piazza|sagrato|ripiano|belvedere|guado|ponte|passerella|sentiero|botola|^E1$|^E4$|cortile|aia/.test(nome);
}

// ---------------------------------------------------------------- terna della porta

interface Terna {
  c: Vector3;
  n: Vector3;
  t: Vector3;
  u: Vector3;
}

function terna(p: PortaPosata): Terna {
  const n = p.normale.clone().normalize();
  const u = p.su.clone().normalize();
  // la normale deve essere orizzontale: tolgo la componente sul su (i generatori la danno già così)
  n.addScaledVector(u, -n.dot(u)).normalize();
  const t = new Vector3().crossVectors(u, n).normalize();
  return { c: p.centro.clone(), n, t, u };
}

/** Punto della porta: `d` m davanti al filo del muro, `l` di lato, `h` sopra la soglia. */
function punto(T: Terna, d: number, l: number, h: number, out = new Vector3()): Vector3 {
  return out.copy(T.c).addScaledVector(T.n, d).addScaledVector(T.t, l).addScaledVector(T.u, h);
}

// ---------------------------------------------------------------- suolo e collider

const _q: Collider[] = [];
const _v = new Vector3();

/** Quota del collider calpestabile più alto sotto `p` (entro `sotto`…`sopra` m dalla quota di p), o -Infinity. */
function quotaCalpestabile(col: ColliderWorld, p: Vector3, hp: number, sotto: number, sopra: number): number {
  const c = worldToCyl(p);
  let best = -Infinity;
  for (const k of col.query(c.z, c.theta, 6, _q)) {
    if (!k.tag || !CALPESTABILI.has(k.tag)) continue;
    if (k.kind === 'box') {
      _v.subVectors(p, k.center);
      if (Math.abs(_v.dot(k.right)) > k.half.x || Math.abs(_v.dot(k.forward)) > k.half.z) continue;
      const top = hp + (k.half.y - _v.dot(k.up));
      if (top >= hp - sotto && top <= hp + sopra) best = Math.max(best, top);
    } else {
      _v.subVectors(p, k.base);
      const y = _v.dot(k.up);
      _v.addScaledVector(k.up, -y);
      if (_v.length() > k.radius) continue;
      const top = hp + (k.height - y);
      if (top >= hp - sotto && top <= hp + sopra) best = Math.max(best, top);
    }
  }
  return best;
}

/**
 * Il collider che contiene `p` (escluse le lastre calpestabili con la cima entro `passo` m sopra
 * `hBase`, e le persone: Pina sulla sua soglia si sposta), o null.
 */
export function colliderNelPunto(col: ColliderWorld, p: Vector3, hp: number, hBase: number, passo: number): Collider | null {
  const c = worldToCyl(p);
  for (const k of col.query(c.z, c.theta, 8, _q)) {
    if (k.tag === 'personaggio') continue;
    let dentro = false;
    let top = 0;
    if (k.kind === 'box') {
      _v.subVectors(p, k.center);
      dentro = Math.abs(_v.dot(k.right)) <= k.half.x && Math.abs(_v.dot(k.up)) <= k.half.y && Math.abs(_v.dot(k.forward)) <= k.half.z;
      top = hp + (k.half.y - _v.dot(k.up));
    } else {
      _v.subVectors(p, k.base);
      const y = _v.dot(k.up);
      if (y >= 0 && y <= k.height) {
        _v.addScaledVector(k.up, -y);
        dentro = _v.length() <= k.radius;
      }
      top = hp + (k.height - y);
    }
    if (!dentro) continue;
    if (k.tag && CALPESTABILI.has(k.tag) && top <= hBase + passo) continue;
    return k;
  }
  return null;
}

// ---------------------------------------------------------------- impronte

function dentroImpronta(i: Impronta, z: number, theta: number): boolean {
  if (i.raggio !== undefined) return distanza(i, { z, theta }) < i.raggio;
  const d = differenza(i, { z, theta }, 40);
  const y = ((i.yaw ?? 0) * Math.PI) / 180;
  const avanti = d.nord * Math.cos(y) + d.est * Math.sin(y);
  const destra = -d.nord * Math.sin(y) + d.est * Math.cos(y);
  return Math.abs(avanti) <= (i.profondita ?? 0) / 2 && Math.abs(destra) <= (i.larghezza ?? 0) / 2;
}

// ---------------------------------------------------------------- triangoli attorno alle porte

/** Indice dei triangoli vicini alle porte: per ogni porta la lista dei suoi triangoli (9 + 3 numeri ciascuno). */
class TriangoliVicini {
  /** triangoli: 9 coordinate + 3 colori */
  readonly tri: number[] = [];
  readonly perPorta: number[][];
  private readonly celle = new Map<string, number[]>();
  private readonly lato = 2;

  constructor(porte: ReadonlyArray<Terna & { w: number; a: number }>) {
    this.perPorta = porte.map(() => []);
    const corner = new Vector3();
    porte.forEach((T, i) => {
      // scatola della porta: da 0,5 m dentro il muro a 1,6 m fuori, larga w + 0,6, alta a + 0,6
      const min = new Vector3(Infinity, Infinity, Infinity);
      const max = new Vector3(-Infinity, -Infinity, -Infinity);
      for (const d of [-0.5, 1.6]) for (const l of [-T.w / 2 - 0.3, T.w / 2 + 0.3]) for (const h of [-0.3, T.a + 0.3]) {
        punto(T, d, l, h, corner);
        min.min(corner);
        max.max(corner);
      }
      for (let x = Math.floor(min.x / this.lato); x <= Math.floor(max.x / this.lato); x++)
        for (let y = Math.floor(min.y / this.lato); y <= Math.floor(max.y / this.lato); y++)
          for (let z = Math.floor(min.z / this.lato); z <= Math.floor(max.z / this.lato); z++) {
            const k = `${x},${y},${z}`;
            const l = this.celle.get(k);
            if (l) l.push(i);
            else this.celle.set(k, [i]);
          }
    });
  }

  /** Aggiunge le mesh visibili sotto `radice` (per i LOD solo il livello vicino). */
  aggiungi(radice: Object3D): void {
    radice.updateMatrixWorld(true);
    const visita = (o: Object3D) => {
      if (!o.visible) return;
      const lod = o as unknown as { isLOD?: boolean; levels?: Array<{ object: Object3D }> };
      if (lod.isLOD && lod.levels?.length) {
        visita(lod.levels[0]!.object);
        return;
      }
      const m = o as Mesh;
      if (m.isMesh && !(o as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) this.mesh(m);
      for (const c of o.children) visita(c);
    };
    visita(radice);
  }

  private mesh(m: Mesh): void {
    const g = m.geometry;
    const pos = g.getAttribute('position') as BufferAttribute | undefined;
    if (!pos) return;
    const col = (g.getAttribute('aColor') ?? g.getAttribute('color')) as BufferAttribute | undefined;
    const idx = g.getIndex();
    const n = idx ? idx.count : pos.count;
    const mw = m.matrixWorld;
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    const L = this.lato;
    const segnate: number[] = [];
    for (let t = 0; t + 2 < n; t += 3) {
      const i0 = idx ? idx.getX(t) : t;
      const i1 = idx ? idx.getX(t + 1) : t + 1;
      const i2 = idx ? idx.getX(t + 2) : t + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(mw);
      b.fromBufferAttribute(pos, i1).applyMatrix4(mw);
      c.fromBufferAttribute(pos, i2).applyMatrix4(mw);
      const x0 = Math.floor(Math.min(a.x, b.x, c.x) / L);
      const x1 = Math.floor(Math.max(a.x, b.x, c.x) / L);
      const y0 = Math.floor(Math.min(a.y, b.y, c.y) / L);
      const y1 = Math.floor(Math.max(a.y, b.y, c.y) / L);
      const z0 = Math.floor(Math.min(a.z, b.z, c.z) / L);
      const z1 = Math.floor(Math.max(a.z, b.z, c.z) / L);
      // triangoli enormi (oltre 4000 celle di 2 m: il terreno, le nubi) non stanno attorno a una porta: li salto
      if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 4000) continue;
      segnate.length = 0;
      for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++)
          for (let z = z0; z <= z1; z++) {
            const porte = this.celle.get(`${x},${y},${z}`);
            if (porte) for (const p of porte) if (!segnate.includes(p)) segnate.push(p);
          }
      if (!segnate.length) continue;
      const id = this.tri.length / 12;
      this.tri.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      if (col) this.tri.push((col.getX(i0) + col.getX(i1) + col.getX(i2)) / 3, (col.getY(i0) + col.getY(i1) + col.getY(i2)) / 3, (col.getZ(i0) + col.getZ(i1) + col.getZ(i2)) / 3);
      else this.tri.push(0, 0, 0);
      for (const p of segnate) this.perPorta[p]!.push(id);
    }
  }

  /** Tutte le intersezioni del raggio (o, dir) con i triangoli della porta `i`, ordinate per distanza. */
  raggio(i: number, o: Vector3, dir: Vector3, tMax: number): Array<{ t: number; frontale: boolean; nx: number; ny: number; nz: number; col: [number, number, number] }> {
    const out: Array<{ t: number; frontale: boolean; nx: number; ny: number; nz: number; col: [number, number, number] }> = [];
    const T = this.tri;
    for (const id of this.perPorta[i]!) {
      const k = id * 12;
      const ax = T[k]!, ay = T[k + 1]!, az = T[k + 2]!;
      const e1x = T[k + 3]! - ax, e1y = T[k + 4]! - ay, e1z = T[k + 5]! - az;
      const e2x = T[k + 6]! - ax, e2y = T[k + 7]! - ay, e2z = T[k + 8]! - az;
      const px = dir.y * e2z - dir.z * e2y;
      const py = dir.z * e2x - dir.x * e2z;
      const pz = dir.x * e2y - dir.y * e2x;
      const det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-12) continue;
      const inv = 1 / det;
      const sx = o.x - ax, sy = o.y - ay, sz = o.z - az;
      const u = (sx * px + sy * py + sz * pz) * inv;
      if (u < 0 || u > 1) continue;
      const qx = sy * e1z - sz * e1y;
      const qy = sz * e1x - sx * e1z;
      const qz = sx * e1y - sy * e1x;
      const v = (dir.x * qx + dir.y * qy + dir.z * qz) * inv;
      if (v < 0 || u + v > 1) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (t <= 0 || t > tMax) continue;
      let nx = e1y * e2z - e1z * e2y;
      let ny = e1z * e2x - e1x * e2z;
      let nz = e1x * e2y - e1y * e2x;
      const ln = Math.hypot(nx, ny, nz) || 1;
      nx /= ln;
      ny /= ln;
      nz /= ln;
      out.push({ t, frontale: nx * dir.x + ny * dir.y + nz * dir.z < 0, nx, ny, nz, col: [T[k + 9]!, T[k + 10]!, T[k + 11]!] });
    }
    return out.sort((x, y) => x.t - y.t);
  }
}

// ---------------------------------------------------------------- verifica

/** Verifica tutte le porte. */
export function verificaPorte(porte: ReadonlyArray<PortaPosata>, fonti: FontiVerificaPorte): EsitoPorta[] {
  const suolo = fonti.suolo ?? groundHeight;
  const terne = porte.map((p) => Object.assign(terna(p), { w: p.larghezza, a: p.altezza }));
  let tri: TriangoliVicini | null = null;
  if (fonti.scena) {
    tri = new TriangoliVicini(terne);
    tri.aggiungi(fonti.scena);
  }
  const p = new Vector3();
  const out: EsitoPorta[] = [];
  porte.forEach((porta, i) => {
    const T = terne[i]!;
    const w = porta.larghezza;
    const cs = worldToCyl(T.c);
    const hS = cs.h;
    const difetti = new Set<DifettoPorta>();
    const note: string[] = [];
    /** quota d'appoggio (suolo o lastra calpestabile) nel punto (d, l) davanti, rispetto alla soglia */
    const appoggio = (d: number, l: number): number => {
      punto(T, d, l, 0, p);
      const c = worldToCyl(p);
      const g = suolo(c.z, c.theta);
      const k = quotaCalpestabile(fonti.colliders, p, c.h, 1.5, 1.0);
      return Math.max(g, k) - hS;
    };

    // la scaletta davanti alla porta, se c'è. Con la rampa di lato (lungo la facciata) davanti al
    // pianerottolo c'è il muretto: lo spazio davanti e i salti si guardano solo sul pianerottolo, il
    // resto lo controlla la verifica della scaletta
    const sc = fonti.scalette?.find((x) => x.soglia.distanceTo(porta.centro) < 0.3 && x.normale.dot(T.n) > 0.9);
    const finoA = sc && sc.verso !== 'avanti' ? sc.inizio - 0.3 : Infinity;

    // 1. soglia sul suolo (solo le porte a terra; le altre hanno la scala o la lobbia)
    let suoloMin = 0;
    let suoloMax = 0;
    let suolo120 = 0;
    if (porta.appoggio === 'suolo') {
      // appena fuori (sulla lastra di soglia, fino a 0,3 m) il suolo, o il pianerottolo, sta alla
      // quota della soglia; più in là (fino a 0,7 m) non deve salire sopra la soglia
      const vicino: number[] = [];
      for (const d of [0.15, 0.3]) for (const l of [-0.35 * w, 0, 0.35 * w]) vicino.push(appoggio(d, l));
      const fuori: number[] = [...vicino];
      for (const l of [-0.35 * w, 0, 0.35 * w]) fuori.push(appoggio(0.7, l));
      suoloMin = Math.min(...vicino);
      suoloMax = Math.max(...fuori);
      suolo120 = appoggio(Math.min(SPAZIO_DAVANTI, finoA), 0);
      if (suoloMax > TOLLERANZA_SOGLIA) {
        difetti.add('sotto_terra');
        note.push(`suolo ${suoloMax.toFixed(2)} m sopra la soglia`);
      }
      if (suoloMin < -TOLLERANZA_SOGLIA) {
        difetti.add('sospesa');
        note.push(`soglia ${(-suoloMin).toFixed(2)} m sopra il suolo`);
      }
      if (suolo120 > 0.5) {
        difetti.add('contro_pendio');
        note.push(`a ${SPAZIO_DAVANTI} m il suolo sale di ${suolo120.toFixed(2)} m`);
      }
      // scendendo dalla soglia (fino a 1,6 m) nessun salto più alto di un gradino (26 cm ogni 10 cm)
      if (!difetti.has('sospesa')) {
        for (const l of [-0.35 * w, 0, 0.35 * w]) {
          let prima = appoggio(0.3, l);
          for (let d = 0.4; d <= Math.min(1.6, finoA) + 1e-6; d += 0.1) {
            const ora = appoggio(d, l);
            if (prima - ora > 0.26) {
              difetti.add('sospesa');
              note.push(`a ${d.toFixed(1)} m un salto di ${(prima - ora).toFixed(2)} m senza gradino`);
              break;
            }
            prima = ora;
          }
          if (difetti.has('sospesa')) break;
        }
      }
    }

    // 2. spazio libero davanti: collider (non i gradini alla quota della soglia) e impronte
    let ostacolo: string | undefined;
    // (davanti alla porta in cima a una scala c'è il pianerottolo, largo 1,1 m: oltre, la scala scende)
    for (const d of (porta.appoggio === 'scala' ? [0.3, 0.7] : [0.3, 0.7, SPAZIO_DAVANTI]).filter((x) => x <= Math.max(0.3, finoA))) {
      if (ostacolo) break;
      for (const l of [-0.3 * w, 0, 0.3 * w]) {
        if (ostacolo) break;
        const base = porta.appoggio === 'suolo' ? Math.max(0, appoggio(d, l)) : 0;
        // la porta di una lobbia dà sul ballatoio: la ringhiera (e il suo collider) sta sotto 1,1 m
        const altezze = porta.appoggio === 'balcone' ? [1.25, 1.7] : [0.35, 0.6, 1.1, 1.7];
        for (const h of altezze) {
          punto(T, d, l, base + h, p);
          const ph = worldToCyl(p).h;
          const k = colliderNelPunto(fonti.colliders, p, ph, hS + base, 0.5);
          if (k && !(porta.appoggio === 'balcone' && k.tag === 'calpestabile' && d < 1.1)) {
            ostacolo = `collider «${k.tag ?? '?'}» a ${d} m`;
            break;
          }
        }
      }
    }
    if (ostacolo) difetti.add('ostruita');
    let improntaIngombra: string | undefined;
    for (const d of porta.appoggio === 'suolo' ? [0.6, SPAZIO_DAVANTI] : []) {
      punto(T, d, 0, 0, p);
      const c = worldToCyl(p);
      for (const imp of fonti.impronte) {
        if (imp.nome === porta.proprietario || improntaAperta(imp.nome)) continue;
        // l'impronta dell'oggetto stesso (contiene la sua origine)
        const o = worldToCyl(porta.origine);
        if (dentroImpronta(imp, o.z, o.theta)) continue;
        if (dentroImpronta(imp, c.z, c.theta)) {
          improntaIngombra = `impronta «${imp.nome}» a ${d} m`;
          break;
        }
      }
      if (improntaIngombra) break;
    }
    if (improntaIngombra) {
      difetti.add('dentro_impronta');
      ostacolo = ostacolo ? `${ostacolo}; ${improntaIngombra}` : improntaIngombra;
    }

    // 3. il battente si vede: raggi dritti sulla porta (3 × 3)
    let copertura = 0;
    let complanare = 0;
    if (tri) {
      const dir = T.n.clone().negate();
      const D0 = 1.4;
      const atteso = D0 - porta.battente;
      let coperti = 0;
      let piani = 0;
      let n = 0;
      for (const l of [-0.29 * w, 0.037 * w, 0.31 * w]) {
        // (la porta di una lobbia sta dietro la ringhiera: i raggi sopra 1,1 m)
        const righe = porta.appoggio === 'balcone' ? [1.15, 1.45, porta.altezza - 0.31] : [0.33, porta.altezza * 0.53, porta.altezza - 0.31];
        for (const hh of righe) {
          n++;
          const o = punto(T, D0, l, hh, new Vector3());
          // il terreno sopra il battente in quel punto
          const sulBattente = punto(T, porta.battente, l, hh, new Vector3());
          const cb = worldToCyl(sulBattente);
          if (suolo(cb.z, cb.theta) > cb.h + 0.02) {
            coperti++;
            continue;
          }
          const hits = tri.raggio(i, o, dir, atteso + 0.6).filter((x) => x.frontale);
          const primo = hits[0];
          if (!primo) {
            // niente: il battente manca del tutto (nessuna geometria)
            coperti++;
            continue;
          }
          // (conta quello che sta entro 0,8 m dal muro, appoggiato o addossato alla porta: più in là una
          // panca o la ringhiera di una lobbia non coprono la porta, e gli ingombri li trova il punto 2)
          if (primo.t < atteso - 0.05 && primo.t > D0 - 0.8) {
            coperti++;
            continue;
          }
          const altro = hits.find((x) => x !== primo && Math.abs(x.t - primo.t) < 0.012 && Math.abs(x.nx * primo.nx + x.ny * primo.ny + x.nz * primo.nz) > 0.98 && Math.abs(x.col[0] - primo.col[0]) + Math.abs(x.col[1] - primo.col[1]) + Math.abs(x.col[2] - primo.col[2]) > 0.03);
          if (altro) piani++;
        }
      }
      copertura = coperti / n;
      complanare = piani / n;
      if (coperti > 0 && !(fonti.velate ?? PORTE_VELATE).has(porta.id)) {
        difetti.add('coperta');
        note.push(`${coperti}/${n} raggi trovano altro prima del battente`);
      }
      if (piani > 0) {
        difetti.add('sfarfallio');
        note.push(`${piani}/${n} raggi con una superficie complanare al battente`);
      }
    }

    // 4. LOD: la porta c'è anche nella versione lontana (se la casa ne ha una)
    let distanzaLontana: number | undefined;
    if (fonti.porteLontane && fonti.zoneLontane?.has(porta.zona) && porta.appoggio === 'suolo' && /^(rustico|annesso)/.test(porta.oggetto)) {
      distanzaLontana = Infinity;
      for (const q of fonti.porteLontane) {
        if (q.proprietario !== porta.proprietario) continue;
        distanzaLontana = Math.min(distanzaLontana, q.centro.distanceTo(porta.centro));
      }
      if (distanzaLontana > 0.6) {
        difetti.add('lod');
        note.push(Number.isFinite(distanzaLontana) ? `nella versione lontana la porta sta a ${distanzaLontana.toFixed(1)} m` : 'nella versione lontana la porta non c’è');
      }
    }

    // 5. la scaletta davanti alla porta, se c'è: libera, con le pedate fuori dal suolo, fino al prato
    if (sc) {
      const r = verificaScaletta(sc, fonti, porta, suolo);
      for (const d of r.difetti) difetti.add(d);
      note.push(...r.note);
      if (r.ostacolo) ostacolo = ostacolo ? `${ostacolo}; ${r.ostacolo}` : r.ostacolo;
    }

    out.push({
      porta,
      difetti: DIFETTI_PORTA.filter((d) => difetti.has(d)),
      soglia: { z: cs.z, theta: cs.theta, h: hS },
      suoloMin,
      suoloMax,
      suolo120,
      ...(ostacolo ? { ostacolo } : {}),
      copertura,
      complanare,
      ...(distanzaLontana !== undefined ? { distanzaLontana } : {}),
      note,
    });
  });
  return out;
}

/**
 * Controlla la scaletta `sc` davanti alla porta: niente collider (che non si calpestano) sopra le
 * pedate e nel metro dopo l'ultimo gradino, niente impronte di altri edifici, nessuna pedata sotto
 * il suolo da un fianco, l'ultimo scalino fino al prato al più di `ULTIMO_SCALINO`.
 */
export function verificaScaletta(
  sc: ScalettaPosata,
  fonti: FontiVerificaPorte,
  porta?: PortaPosata,
  suolo: (z: number, theta: number) => number = fonti.suolo ?? groundHeight,
): { difetti: DifettoPorta[]; note: string[]; ostacolo?: string; sepolto: number; ultimo: number } {
  const difetti = new Set<DifettoPorta>();
  const note: string[] = [];
  let ostacolo: string | undefined;
  const n = sc.normale.clone().normalize();
  const u = sc.su.clone().normalize();
  const t = new Vector3().crossVectors(u, n).normalize();
  const P = (d: number, l: number, h: number, out = new Vector3()) => out.copy(sc.soglia).addScaledVector(n, d).addScaledVector(t, l).addScaledVector(u, h);
  const p = new Vector3();
  const hS = worldToCyl(sc.soglia).h;
  let sepolto = -Infinity;
  const origine = porta ? worldToCyl(porta.origine) : null;
  /** punto (d, l) del riferimento della porta: `a` m lungo la rampa della pedata `g`, `b` di traverso */
  const nellaPedata = (g: ScalettaPosata['gradini'][number], a: number, b: number): [number, number] => [g.d + g.fd * a - g.fl * b, g.l + g.fl * a + g.fd * b];
  sc.gradini.forEach((g, i) => {
    // pedata fuori dal suolo (il pianerottolo, sul suo spigolo a monte, può toccare il prato)
    const tolleranza = i === 0 ? PIANEROTTOLO_SEPOLTO - GRADINO_SEPOLTO : 0;
    for (const a of [-g.lungo / 2 + 0.04, 0, g.lungo / 2 - 0.04]) {
      for (const b of [-g.largo / 2 + 0.04, -g.largo / 4, 0, g.largo / 4, g.largo / 2 - 0.04]) {
        const c = worldToCyl(P(...nellaPedata(g, a, b), g.top, p));
        sepolto = Math.max(sepolto, suolo(c.z, c.theta) - c.h - tolleranza);
      }
    }
    const nome = i === 0 ? 'pianerottolo' : `gradino ${i}`;
    // niente sopra la pedata (sul pianerottolo con i muretti, fra i muretti)
    if (!ostacolo) {
      const bordo = i === 0 && sc.parapetti.length ? 0.4 : 0.12;
      for (const b of [-g.largo / 2 + bordo, 0, g.largo / 2 - bordo]) {
        if (ostacolo) break;
        for (const h of [0.35, 1.0, 1.7]) {
          P(...nellaPedata(g, 0, b), g.top + h, p);
          const ph = worldToCyl(p).h;
          const k = colliderNelPunto(fonti.colliders, p, ph, hS + g.top, 0.5);
          if (k) {
            ostacolo = `${nome}: collider «${k.tag ?? '?'}» a ${h} m sopra la pedata`;
            break;
          }
        }
      }
    }
    // né dentro l'impronta di un altro edificio
    if (!ostacolo) {
      const c = worldToCyl(P(g.d, g.l, g.top, p));
      for (const imp of fonti.impronte) {
        if (improntaAperta(imp.nome) || (porta && imp.nome === porta.proprietario)) continue;
        if (origine && dentroImpronta(imp, origine.z, origine.theta)) continue;
        if (!/^(rustico|annesso|casa|casupola|mulino|fienile|gra|capanno|campanile|chiesa|E2)/.test(imp.nome)) continue;
        if (dentroImpronta(imp, c.z, c.theta)) {
          ostacolo = `${nome} nell'impronta «${imp.nome}»`;
          break;
        }
      }
    }
  });
  // nel metro dopo l'ultimo gradino, all'altezza di chi scende
  const ultimoTop = sc.gradini[sc.gradini.length - 1]?.top ?? 0;
  const f = sc.direzione;
  const prato = (a: number, b = 0) => {
    const c = worldToCyl(P(sc.uscita.d + f.d * a - f.l * b, sc.uscita.l + f.l * a + f.d * b, 0, p));
    return suolo(c.z, c.theta) - hS;
  };
  const ultimo = ultimoTop - Math.min(prato(-0.15), prato(0.05));
  if (!ostacolo) {
    for (const a of [0, 0.5]) {
      if (ostacolo) break;
      for (const b of [-0.45, 0, 0.45]) {
        if (ostacolo) break;
        const base = prato(a, b);
        for (const h of [0.35, 1.0, 1.7]) {
          P(sc.uscita.d + f.d * a - f.l * b, sc.uscita.l + f.l * a + f.d * b, base + h, p);
          const ph = worldToCyl(p).h;
          const k = colliderNelPunto(fonti.colliders, p, ph, hS + base, 0.5);
          if (k) {
            ostacolo = `dopo l'ultimo gradino: collider «${k.tag ?? '?'}»`;
            break;
          }
        }
      }
    }
  }
  if (ostacolo) difetti.add('gradini_ostruiti');
  if (sepolto > GRADINO_SEPOLTO) {
    difetti.add('gradini_sepolti');
    note.push(`una pedata ${sepolto.toFixed(2)} m sotto il suolo`);
  }
  if (ultimo > ULTIMO_SCALINO) {
    difetti.add('gradini_sospesi');
    note.push(`ultimo scalino di ${ultimo.toFixed(2)} m`);
  }
  return { difetti: [...difetti], note, ...(ostacolo ? { ostacolo } : {}), sepolto, ultimo };
}

/** Riassunto per difetto: quante porte ne hanno uno. */
export function riassuntoPorte(esiti: ReadonlyArray<EsitoPorta>): Record<DifettoPorta | 'totale' | 'difettose', number> {
  const r = { totale: esiti.length, difettose: esiti.filter((e) => e.difetti.length).length } as Record<DifettoPorta | 'totale' | 'difettose', number>;
  for (const d of DIFETTI_PORTA) r[d] = esiti.filter((e) => e.difetti.includes(d)).length;
  return r;
}

/**
 * Inquadratura per guardare una porta: camera `dist` m davanti, all'altezza degli occhi sul suolo,
 * spostata di lato di `lato` m, che guarda il centro del battente. (z, θ, h, yaw, pitch) per
 * `__GAME__.setCamera`.
 */
export function inquadraturaPorta(p: PortaPosata, dist = 4.5, lato = 0.8, suolo: (z: number, theta: number) => number = groundHeight): { z: number; theta: number; h: number; yaw: number; pitch: number } {
  const T = terna(p);
  const occhio = punto(T, dist, lato, 0);
  const c = worldToCyl(occhio);
  const hS = worldToCyl(T.c).h;
  const h = Math.max(suolo(c.z, c.theta), hS) + 1.62;
  const camera = cylToWorld(c.z, c.theta, h);
  const bersaglio = punto(T, p.battente, 0, p.altezza * 0.5);
  const f = localFrameTheta(c.theta);
  const d = bersaglio.sub(camera).normalize();
  const pitch = (Math.asin(Math.max(-1, Math.min(1, d.dot(f.up)))) * 180) / Math.PI;
  const yaw = (Math.atan2(d.dot(f.east), d.dot(f.north)) * 180) / Math.PI;
  return { z: c.z, theta: c.theta, h, yaw, pitch };
}

/**
 * Verifica tutte le porte del paese costruito: quelle posate con le varianti attive degli elementi
 * mobili, poi, variante per variante, quelle delle altre (la casa di Nando abitata o smontata).
 * Alla fine rimette le varianti com'erano.
 */
export function verificaPaese(c: ManigliaCorbella, colliders: ColliderWorld): EsitoPorta[] {
  const lontane = c.porteLontane();
  const fonti: FontiVerificaPorte = { colliders, impronte: c.impronte, scena: c.radice, porteLontane: lontane.porte, zoneLontane: lontane.zone, scalette: c.scalette(false) };
  const esiti = verificaPorte(c.porte(false), fonti);
  for (const [id, e] of c.elementi) {
    const iniziale = e.variante;
    for (const v of e.varianti) {
      if (v === iniziale) continue;
      c.setVariante(id, v);
      const sue = c.porte(false).filter((p) => p.variante === `${id}=${v}`);
      if (sue.length) esiti.push(...verificaPorte(sue, { ...fonti, scalette: c.scalette(false) }));
    }
    c.setVariante(id, iniziale);
  }
  return esiti;
}

/** Una riga dell'inventario delle porte (serializzabile: per gli script e per il browser). */
export interface VocePorta {
  id: string;
  oggetto: string;
  proprietario: string;
  zona: string;
  variante: string | null;
  appoggio: PortaPosata['appoggio'];
  soglia: { z: number; theta: number; h: number };
  difetti: DifettoPorta[];
  suoloMin: number;
  suoloMax: number;
  suolo120: number;
  copertura: number;
  complanare: number;
  ostacolo: string | null;
  note: string[];
  /** da dove guardarla (`inquadraturaPorta`) */
  inquadratura: { z: number; theta: number; h: number; yaw: number; pitch: number };
  /** (z, θ, h) a 7, 3 e 0,6 m davanti alla soglia */
  davanti: { a7: { z: number; theta: number; h: number }; a3: { z: number; theta: number; h: number }; soglia: { z: number; theta: number; h: number } };
  /** il centro del battente */
  battente: { z: number; theta: number; h: number };
  /** la scaletta davanti, se c'è: verso, gradini e dove si scende (z, θ, h) */
  scaletta: { verso: string; gradini: number; uscita: { z: number; theta: number; h: number } } | null;
}

/** L'inventario delle porte verificate, pronto per un JSON. */
export function inventarioPorte(esiti: ReadonlyArray<EsitoPorta>, scalette: ReadonlyArray<ScalettaPosata> = []): VocePorta[] {
  const cil = (v: Vector3) => {
    const q = worldToCyl(v);
    return { z: q.z, theta: q.theta, h: q.h };
  };
  const davanti = (p: PortaPosata, d: number, su = 0) => cil(p.centro.clone().addScaledVector(p.normale, d).addScaledVector(p.su, su));
  return esiti.map((e) => {
    const p = e.porta;
    const sc = scalette.find((x) => x.soglia.distanceTo(p.centro) < 0.3 && x.normale.dot(p.normale) > 0.9);
    let scaletta: VocePorta['scaletta'] = null;
    if (sc) {
      const t = new Vector3().crossVectors(sc.su, sc.normale).normalize();
      const u = sc.soglia.clone().addScaledVector(sc.normale, sc.uscita.d).addScaledVector(t, sc.uscita.l);
      const c = worldToCyl(u);
      scaletta = { verso: sc.verso, gradini: sc.gradini.length - 1, uscita: { z: c.z, theta: c.theta, h: groundHeight(c.z, c.theta) } };
    }
    return {
      id: p.id,
      oggetto: p.oggetto,
      proprietario: p.proprietario,
      zona: p.zona,
      variante: p.variante ?? null,
      appoggio: p.appoggio,
      soglia: e.soglia,
      difetti: e.difetti,
      suoloMin: +e.suoloMin.toFixed(3),
      suoloMax: +e.suoloMax.toFixed(3),
      suolo120: +e.suolo120.toFixed(3),
      copertura: e.copertura,
      complanare: e.complanare,
      ostacolo: e.ostacolo ?? null,
      note: e.note,
      inquadratura: inquadraturaPorta(p),
      davanti: { a7: davanti(p, 7), a3: davanti(p, 3), soglia: davanti(p, 0.6) },
      battente: davanti(p, p.battente, p.altezza * 0.55),
      scaletta,
    };
  });
}
