/**
 * Laboratorio delle pose dei personaggi: i modelli veri con la FABBRICA del gioco (creaPersonaggio, lo
 * stesso stato del popolamento) in fila, su una scena semplice: un gradino per sedersi, il suolo per
 * terra, una vasca per chi lavora chino, la barra del Velo per Ottavio. Luce calda e cielo freddo, il
 * materiale di ripiego (toon) perché qui non c'è il motore.
 *
 *   tools/personaggi/laboratorio.html?m=togna,nando&scena=seduti&vista=fianco&t=2
 *
 * scene: in-piedi, conserte, giunte, dietro, seduti (gradino di 0,45 m), soglia (0,14 m), terra, chino,
 * cammina (avanzano davvero: si vedono i piedi), volo (Ottavio col Velo), gesti (battuta ogni 1,5 s).
 * Espone window.__LAB__ per le schermate (laboratorio.mjs).
 */
import * as THREE from 'three';
import { creaPersonaggio, precaricaPersonaggi, type StatoPersonaggioGioco } from '../../src/personaggi';
import { battutaPersonaggio } from '../../src/personaggi/fabbrica';
import type { ProfiloSuolo } from '../../src/personaggi/sedute';

const q = new URLSearchParams(location.search);
const modelli = (q.get('m') ?? 'togna').split(',').filter(Boolean);
const scena = q.get('scena') ?? 'in-piedi';
let vista = q.get('vista') ?? 'tre-quarti';
const passo = Number(q.get('passo') ?? 2.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const mondo = new THREE.Scene();
mondo.background = new THREE.Color(0xd9cdb6);
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 200);
mondo.add(new THREE.HemisphereLight(0x9fb6d6, 0x7a6248, 1.35));
const sole = new THREE.DirectionalLight(0xffe0b0, 2.6);
sole.position.set(4, 7, 6);
sole.castShadow = true;
sole.shadow.mapSize.set(2048, 2048);
Object.assign(sole.shadow.camera, { left: -9, right: 9, top: 5, bottom: -3 });
sole.shadow.bias = -0.0005;
sole.shadow.normalBias = 0.02;
mondo.add(sole);
const contro = new THREE.DirectionalLight(0xc8d8ff, 0.5);
contro.position.set(-3, 4, -6);
mondo.add(contro);

const pietra = new THREE.MeshLambertMaterial({ color: 0x9a948a });
const suolo = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshLambertMaterial({ color: 0x9a8f5c }));
suolo.rotation.x = -Math.PI / 2;
suolo.receiveShadow = true;
mondo.add(suolo);
// righe ogni 25 cm sul suolo (per vedere se i piedi scivolano)
const righe = new THREE.Group();
for (let z = -6; z <= 30; z += 0.25) {
  const r = new THREE.Mesh(new THREE.PlaneGeometry(60, 0.012), new THREE.MeshBasicMaterial({ color: z % 1 === 0 ? 0x5a5030 : 0x7d7348 }));
  r.rotation.x = -Math.PI / 2;
  r.position.set(0, 0.001, z);
  righe.add(r);
}
mondo.add(righe);

interface Figura {
  id: string;
  o: NonNullable<ReturnType<typeof creaPersonaggio>>;
  stato: StatoPersonaggioGioco;
  x: number;
}
const figure: Figura[] = [];

function profiloGradino(sedile: number, spigolo: number, piedi: number): ProfiloSuolo {
  const quote: number[] = [];
  for (let i = 0; i < 19; i++) quote.push(-0.8 + i * 0.1 <= spigolo + 1e-6 ? sedile : piedi);
  return { inizio: -0.8, passo: 0.1, quote };
}

function velo(): THREE.Group {
  // come accessori() del popolamento: tela, traversa, montanti fino alla barra di comando
  const g = new THREE.Group();
  g.name = 'velo-ottavio';
  const legno = new THREE.MeshLambertMaterial({ color: 0x7a5236 });
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), new THREE.MeshLambertMaterial({ color: 0x5f8a4a, side: THREE.DoubleSide }));
  tela.position.set(0, 2.6, 0);
  tela.rotation.x = -Math.PI / 2 + 0.25;
  g.add(tela);
  const barra = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.7, 6), legno);
  barra.rotation.z = Math.PI / 2;
  barra.position.set(0, 1.25, 0.35);
  g.add(barra);
  for (const s of [-1, 1]) {
    const a = new THREE.Vector3(0, 2.55, 0.15);
    const b = new THREE.Vector3(s * 0.35, 1.25, 0.35);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, a.distanceTo(b), 5), legno);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.add(m);
  }
  return g;
}

async function avvia(): Promise<void> {
  await precaricaPersonaggi(undefined, { cartella: '/personaggi/' });
  const n = modelli.length;
  modelli.forEach((id, i) => {
    const postura = ({ conserte: 'braccia-conserte', giunte: 'mani-giunte', dietro: 'mani-dietro' } as Record<string, string>)[scena] ?? q.get('postura');
    const opz = { seme: id, ...(id === 'annunciata' || id === 'velato_maschera' ? { bastone: true } : {}), ...(id === 'velato_gerla' ? { gerla: true } : {}), ...(postura ? { postura: postura as never } : {}) };
    const o = creaPersonaggio(id, opz);
    if (!o) return;
    const x = (i - (n - 1) / 2) * passo;
    o.gruppo.position.set(x, 0, 0);
    mondo.add(o.gruppo);
    const stato: StatoPersonaggioGioco = { modo: 'fermo' };
    if (scena === 'seduti') {
      stato.posa = 'seduto';
      stato.profilo = profiloGradino(0.45, 0.1, 0);
    } else if (scena === 'soglia') {
      stato.posa = 'seduto';
      stato.profilo = profiloGradino(0.14, -0.3, 0);
    } else if (scena === 'terra') {
      stato.posa = 'seduto';
      stato.profilo = profiloGradino(0, 0, 0);
    } else if (scena === 'chino') stato.posa = 'chino';
    else if (scena === 'cammina') {
      stato.modo = 'cammina';
      stato.velocita = id === 'lisa' || id === 'gioanin' ? 1.3 : id === 'annunciata' ? 0.7 : 1.1;
    } else if (scena === 'volo') {
      const v = velo();
      o.gruppo.add(v);
    }
    figure.push({ id, o, stato, x });
  });
  // gli arredi della scena
  if (scena === 'seduti') {
    const g = new THREE.Mesh(new THREE.BoxGeometry(n * passo + 1, 0.45, 1.2), pietra);
    g.position.set(0, 0.225, 0.1 - 0.6);
    g.castShadow = g.receiveShadow = true;
    mondo.add(g);
  } else if (scena === 'soglia') {
    const g = new THREE.Mesh(new THREE.BoxGeometry(n * passo + 1, 0.14, 1.2), pietra);
    g.position.set(0, 0.07, -0.3 - 0.6);
    g.castShadow = g.receiveShadow = true;
    mondo.add(g);
  } else if (scena === 'chino') {
    // la vasca del lavatoio: il bordo a 0,85 m, l'acqua a 0,76, il davanti a 0,19 m dai piedi
    const v = new THREE.Mesh(new THREE.BoxGeometry(n * passo + 1, 0.85, 1.8), pietra);
    v.position.set(0, 0.425, 0.19 + 0.9);
    v.castShadow = v.receiveShadow = true;
    mondo.add(v);
    const acqua = new THREE.Mesh(new THREE.PlaneGeometry(n * passo + 0.6, 1.4), new THREE.MeshLambertMaterial({ color: 0x3f6f73 }));
    acqua.rotation.x = -Math.PI / 2;
    acqua.position.set(0, 0.86, 0.19 + 0.9);
    mondo.add(acqua);
  }
}

/**
 * Un riquadro per figura (le altre nascoste): la camera guarda quella figura dall'angolo della vista,
 * alla stessa distanza per tutte; così anche di fianco non si coprono.
 */
function disegna(): void {
  const n = figure.length;
  const W = innerWidth;
  const Hh = innerHeight;
  const colonne = Math.max(1, Math.min(n, Math.round(Math.sqrt((n * W) / Hh / 0.6))));
  const righe = Math.ceil(n / colonne);
  const cw = Math.floor(W / colonne);
  const ch = Math.floor(Hh / righe);
  camera.aspect = cw / ch;
  camera.fov = 26;
  camera.updateProjectionMatrix();
  const ang = ({ fronte: 0, fianco: 90, retro: 180, 'tre-quarti': 35, alto: 25, basso: 30 } as Record<string, number>)[vista] ?? 35;
  const a = THREE.MathUtils.degToRad(ang);
  const alto = scena === 'volo' ? 2.7 : 2.0;
  const dist = (alto / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) * 1.08 * Number(q.get('zoom') ?? 1);
  renderer.setScissorTest(true);
  renderer.setClearColor(0xd9cdb6);
  figure.forEach((f, i) => {
    for (const g of figure) g.o.gruppo.visible = g === f;
    const c = i % colonne;
    const r = Math.floor(i / colonne);
    renderer.setViewport(c * cw, Hh - (r + 1) * ch, cw, ch);
    renderer.setScissor(c * cw, Hh - (r + 1) * ch, cw, ch);
    const p = f.o.gruppo.position;
    const cy = scena === 'volo' ? 1.35 : vista === 'basso' ? 0.55 : 0.85;
    const su = vista === 'alto' ? 1.4 : vista === 'basso' ? -0.3 : 0;
    camera.position.set(p.x + Math.sin(a) * dist, cy + su, p.z + Math.cos(a) * dist);
    camera.lookAt(p.x, cy, p.z);
    camera.updateMatrixWorld();
    renderer.render(mondo, camera);
  });
  renderer.setScissorTest(false);
  for (const g of figure) g.o.gruppo.visible = true;
}

let tempo = 0;
let prossimaBattuta = 0.5;
function avanza(fino: number): void {
  const dt = 1 / 60;
  while (tempo < fino - 1e-6) {
    for (const f of figure) {
      if (f.stato.modo === 'cammina') f.o.gruppo.position.z += (f.stato.velocita ?? 1.1) * dt;
      f.o.update?.(dt, f.stato);
    }
    if (scena === 'gesti' && tempo >= prossimaBattuta) {
      for (const f of figure) battutaPersonaggio(f.o.gruppo);
      prossimaBattuta += 1.5;
    }
    tempo += dt;
  }
}

const pronto = avvia();

declare global {
  interface Window {
    __LAB__: { pronto: Promise<void>; fotogramma(t: number, vista?: string): void };
  }
}
window.__LAB__ = {
  pronto,
  fotogramma(t, v) {
    if (v) vista = v;
    avanza(t);
    disegna();
  },
};
