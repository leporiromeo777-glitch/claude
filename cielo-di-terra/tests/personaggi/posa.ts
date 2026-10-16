/**
 * Misure sulle pose dei personaggi veri (i GLB di public/personaggi caricati in Node, glbNode.ts) con
 * lo skinning fatto sulla CPU: braccia tese, vertici sotto la seduta, spigoli stirati, piedi che pattinano.
 * Le usano le prove di forma (forma.test.ts) e, a mano, chi ritocca animatore e pipeline.
 */
import * as THREE from 'three';
import type { OpzioniAbitante, StatoAbitante } from '../../src/oggetti/oggetti/abitante';
import type { OggettoProcedurale } from '../../src/oggetti/tipi';
import type { AnimatorePersonaggio } from '../../src/personaggi/animatore';
import { creaPersonaggio, type StatoPersonaggioGioco } from '../../src/personaggi/fabbrica';
import { registraPrototipo, svuotaPersonaggi } from '../../src/personaggi/precarica';
import { SCHEDE } from '../../src/personaggi/schede';
import type { ProfiloSuolo } from '../../src/personaggi/sedute';
import { MODELLI, prototipoGlb } from './glbNode';

export { MODELLI };

/** Registra i 13 modelli veri (una volta). */
let registrati: Promise<void> | null = null;
export function registraVeri(): Promise<void> {
  registrati ??= (async () => {
    svuotaPersonaggi();
    for (const id of MODELLI) registraPrototipo(await prototipoGlb(id));
  })();
  return registrati;
}

/** Un personaggio vero nel suo gruppo (con le opzioni procedurali più semplici). */
export function figura(id: string, opz: OpzioniAbitante = {}): OggettoProcedurale<StatoAbitante> {
  const o = creaPersonaggio(id, { seme: id, ...(id === 'annunciata' || id === 'velato_maschera' ? { bastone: true } : {}), ...opz });
  if (!o) throw new Error(`nessun modello per ${id}`);
  o.gruppo.updateMatrixWorld(true);
  return o;
}

export function animatoreDi(o: OggettoProcedurale<StatoAbitante>): AnimatorePersonaggio {
  // l'animatore non è esposto: lo ritrova dal gruppo (la fabbrica lo lega alla battuta)
  const g = o.gruppo as THREE.Group & { userData: Record<string, unknown> };
  const a = (g.userData['animatore'] as AnimatorePersonaggio | undefined) ?? null;
  if (!a) throw new Error('animatore non trovato');
  return a;
}

/** La SkinnedMesh LOD0 della figura. */
export function lod0(o: OggettoProcedurale<StatoAbitante>): THREE.SkinnedMesh {
  let m: THREE.SkinnedMesh | null = null;
  o.gruppo.traverse((x) => {
    if ((x as THREE.SkinnedMesh).isSkinnedMesh && x.name === 'lod0') m = x as THREE.SkinnedMesh;
  });
  if (!m) throw new Error('lod0 mancante');
  return m;
}

/** Fa girare la figura `n` fotogrammi da 1/60 s con lo stato dato. */
export function anima(o: OggettoProcedurale<StatoAbitante>, stato: StatoPersonaggioGioco, n = 90): void {
  for (let i = 0; i < n; i++) o.update?.(1 / 60, stato);
  o.gruppo.updateMatrixWorld(true);
}

/** Le posizioni deformate dei vertici del LOD0 nello spazio del gruppo della figura. */
export function vertici(o: OggettoProcedurale<StatoAbitante>): Float32Array {
  const m = lod0(o);
  o.gruppo.updateMatrixWorld(true);
  m.skeleton.update();
  const inv = new THREE.Matrix4().copy(o.gruppo.matrixWorld).invert();
  const rel = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
  const n = m.geometry.getAttribute('position').count;
  const out = new Float32Array(n * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    m.getVertexPosition(i, p).applyMatrix4(rel);
    out[i * 3] = p.x;
    out[i * 3 + 1] = p.y;
    out[i * 3 + 2] = p.z;
  }
  return out;
}

/** Spigoli dei triangoli del LOD0 (coppie di indici, senza doppioni). */
export function spigoli(m: THREE.SkinnedMesh): Uint32Array {
  const idx = m.geometry.index;
  const n = idx ? idx.count : m.geometry.getAttribute('position').count;
  const visti = new Set<number>();
  const out: number[] = [];
  const nv = m.geometry.getAttribute('position').count;
  const metti = (a: number, b: number) => {
    const k = a < b ? a * nv + b : b * nv + a;
    if (visti.has(k)) return;
    visti.add(k);
    out.push(a, b);
  };
  for (let t = 0; t < n; t += 3) {
    const a = idx ? idx.getX(t) : t;
    const b = idx ? idx.getX(t + 1) : t + 1;
    const c = idx ? idx.getX(t + 2) : t + 2;
    metti(a, b);
    metti(b, c);
    metti(c, a);
  }
  return Uint32Array.from(out);
}

/** Il rapporto più grande fra la lunghezza di uno spigolo in posa e a riposo (spigoli a riposo > 2 mm). */
export function stiramento(riposo: Float32Array, posa: Float32Array, sp: Uint32Array): { max: number; oltre3: number; dove: number[]; vertice: number } {
  let max = 0;
  let oltre3 = 0;
  let dove: number[] = [];
  let vertice = -1;
  for (let k = 0; k < sp.length; k += 2) {
    const a = sp[k] as number;
    const b = sp[k + 1] as number;
    const l0 = Math.hypot((riposo[a * 3] as number) - (riposo[b * 3] as number), (riposo[a * 3 + 1] as number) - (riposo[b * 3 + 1] as number), (riposo[a * 3 + 2] as number) - (riposo[b * 3 + 2] as number));
    if (l0 < 0.002) continue;
    const l1 = Math.hypot((posa[a * 3] as number) - (posa[b * 3] as number), (posa[a * 3 + 1] as number) - (posa[b * 3 + 1] as number), (posa[a * 3 + 2] as number) - (posa[b * 3 + 2] as number));
    // conta solo uno strappo che si vede: almeno 3 cm più lungo (gli spigoli di pochi millimetri delle
    // cuciture triplicano senza che si veda niente)
    const r = l1 - l0 > 0.03 ? l1 / l0 : 1;
    if (r > 3) oltre3++;
    if (r > max) {
      max = r;
      // il vertice che si è mosso di più fra i due
      const ma = Math.hypot((posa[a * 3] as number) - (riposo[a * 3] as number), (posa[a * 3 + 1] as number) - (riposo[a * 3 + 1] as number), (posa[a * 3 + 2] as number) - (riposo[a * 3 + 2] as number));
      const mb = Math.hypot((posa[b * 3] as number) - (riposo[b * 3] as number), (posa[b * 3 + 1] as number) - (riposo[b * 3 + 1] as number), (posa[b * 3 + 2] as number) - (riposo[b * 3 + 2] as number));
      vertice = ma > mb ? a : b;
      const w = ma > mb ? b : a;
      dove = [riposo[w * 3] as number, riposo[w * 3 + 1] as number, riposo[w * 3 + 2] as number];
    }
  }
  return { max, oltre3, dove, vertice };
}

/** Un gradino: piano a `sedile` m fino a `spigolo` m davanti all'origine, poi il suolo a `piedi`. */
export function profiloGradino(sedile: number, spigolo = 0.1, piedi = 0): ProfiloSuolo {
  const quote: number[] = [];
  for (let i = 0; i < 19; i++) {
    const d = -0.8 + i * 0.1;
    quote.push(d <= spigolo + 1e-6 ? sedile : piedi);
  }
  return { inizio: -0.8, passo: 0.1, quote };
}

/** Un suolo piatto (seduti per terra) a quota `q`. */
export function profiloPiano(q = 0): ProfiloSuolo {
  return { inizio: -0.8, passo: 0.1, quote: new Array(19).fill(q) };
}

/** Le ossa per nome nella copia. */
export function osso(o: OggettoProcedurale<StatoAbitante>, nome: string): THREE.Bone {
  let b: THREE.Bone | null = null;
  o.gruppo.traverse((x) => {
    if (!b && (x as THREE.Bone).isBone && x.name === nome) b = x as THREE.Bone;
  });
  if (!b) throw new Error(`osso ${nome} mancante`);
  return b;
}

/** Quanto è tesa la catena spalla-polso di un lato: distanza spalla-polso / (braccio + avambraccio). */
export function estensione(o: OggettoProcedurale<StatoAbitante>, lato: 'S' | 'D'): number {
  const p = (n: string) => osso(o, n).getWorldPosition(new THREE.Vector3());
  o.gruppo.updateMatrixWorld(true);
  const s = p(`braccio${lato}`);
  const g = p(`avambraccio${lato}`);
  const m = p(`mano${lato}`);
  return s.distanceTo(m) / (s.distanceTo(g) + g.distanceTo(m));
}

/** Gli indici dei vertici del LOD0 pesati almeno `soglia` sulle ossa dei piedi, per lato. */
export function verticiPiedi(m: THREE.SkinnedMesh, soglia = 0.6): { S: number[]; D: number[] } {
  const ossa = m.skeleton.bones;
  const iS = ossa.findIndex((b) => b.name === 'piedeS');
  const iD = ossa.findIndex((b) => b.name === 'piedeD');
  const si = m.geometry.getAttribute('skinIndex');
  const sw = m.geometry.getAttribute('skinWeight');
  const out = { S: [] as number[], D: [] as number[] };
  for (let i = 0; i < si.count; i++) {
    let wS = 0;
    let wD = 0;
    for (let k = 0; k < 4; k++) {
      const b = si.getComponent(i, k);
      if (b === iS) wS += sw.getComponent(i, k);
      if (b === iD) wD += sw.getComponent(i, k);
    }
    if (wS >= soglia) out.S.push(i);
    if (wD >= soglia) out.D.push(i);
  }
  return out;
}

/**
 * La camminata dritta a `v` m/s per `secondi` (il gruppo avanza davvero, come nel gioco): per ogni vertice
 * dei piedi che resta a terra (entro 1,5 cm dal suolo) in due fotogrammi di fila, la sua velocità
 * orizzontale nel mondo. Torna la media, il 95° percentile e l'alzata massima dei piedi.
 */
export function pattinamento(o: OggettoProcedurale<StatoAbitante>, v = 1.1, secondi = 3, soglia = 0.6, soloScarpa = false, suolo = 0.015): { medio: number; p95: number; alzata: number; campioni: number; abbassamento: number } {
  const m = lod0(o);
  const piedi = verticiPiedi(m, soglia);
  if (soloScarpa) {
    // solo la scarpa: entro 6 cm di lato dalla caviglia e fra il tallone e la punta (a riposo), non
    // l'orlo largo di una veste lunga pesato sul piede
    const riposo = vertici(o);
    for (const lato of ['S', 'D'] as const) {
      const c = osso(o, `piede${lato}`).getWorldPosition(new THREE.Vector3());
      piedi[lato] = piedi[lato].filter((i) => {
        const x = riposo[i * 3] as number;
        const z = riposo[i * 3 + 2] as number;
        return Math.abs(x - c.x) < 0.06 && z > c.z - 0.07 && z < c.z + 0.22;
      });
    }
  }
  const tutti = [...piedi.S, ...piedi.D];
  const stato: StatoPersonaggioGioco = { modo: 'cammina', velocita: v };
  const dt = 1 / 60;
  // avvio: un secondo di camminata prima di misurare
  for (let i = 0; i < 60; i++) {
    o.gruppo.position.z += v * dt;
    o.update?.(dt, stato);
  }
  const p = new THREE.Vector3();
  const prima = new Float32Array(tutti.length * 3);
  const ora = new Float32Array(tutti.length * 3);
  let haPrima = false;
  const vel: number[] = [];
  let alzata = 0;
  let abbassamento = 0;
  const n = Math.round(secondi / dt);
  for (let f = 0; f < n; f++) {
    o.gruppo.position.z += v * dt;
    o.update?.(dt, stato);
    o.gruppo.updateMatrixWorld(true);
    m.skeleton.update();
    let minS = Infinity;
    let minD = Infinity;
    for (let k = 0; k < tutti.length; k++) {
      m.getVertexPosition(tutti[k] as number, p).applyMatrix4(m.matrixWorld);
      ora[k * 3] = p.x;
      ora[k * 3 + 1] = p.y;
      ora[k * 3 + 2] = p.z;
      if (k < piedi.S.length) minS = Math.min(minS, p.y);
      else minD = Math.min(minD, p.y);
    }
    alzata = Math.max(alzata, Math.max(minS, minD));
    abbassamento = Math.min(abbassamento, (o.gruppo.children[0] as THREE.Object3D).position.y);
    if (haPrima) {
      for (let k = 0; k < tutti.length; k++) {
        if ((ora[k * 3 + 1] as number) < suolo && (prima[k * 3 + 1] as number) < suolo) {
          vel.push(Math.hypot((ora[k * 3] as number) - (prima[k * 3] as number), (ora[k * 3 + 2] as number) - (prima[k * 3 + 2] as number)) / dt);
        }
      }
    }
    prima.set(ora);
    haPrima = true;
  }
  vel.sort((a, b) => a - b);
  const medio = vel.reduce((a, b) => a + b, 0) / Math.max(vel.length, 1);
  return { medio, p95: vel[Math.floor(vel.length * 0.95)] ?? 0, alzata, campioni: vel.length, abbassamento };
}

/** I pesi di un vertice: «osso:peso» per le influenze non nulle. */
export function pesi(m: THREE.SkinnedMesh, i: number): string {
  const si = m.geometry.getAttribute('skinIndex');
  const sw = m.geometry.getAttribute('skinWeight');
  const out: string[] = [];
  for (let k = 0; k < 4; k++) {
    const w = sw.getComponent(i, k);
    if (w > 0.01) out.push(`${m.skeleton.bones[si.getComponent(i, k)]?.name}:${w.toFixed(2)}`);
  }
  return out.join(' ');
}

/** Le schede (per sapere chi ha la gonna). */
export { SCHEDE };
