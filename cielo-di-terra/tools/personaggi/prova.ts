/**
 * Pagina di prova dei personaggi generati (vedi prova.html per i parametri).
 * Luce calda principale + riempimento freddo dal cielo, come vuole il rifacimento grafico;
 * animazione procedurale di src/personaggi (respiro, camminata, sguardo, gesti).
 * Per le schermate automatiche espone window.__PROVA__ (tools/personaggi/fotografa.mjs).
 */
import * as THREE from 'three';
import {
  attaccaOggetto,
  caricaIndice,
  caricaPersonaggio,
  opzioniDaIndice,
  type GestoPersonaggio,
  type IndicePersonaggi,
  type ModelloPersonaggio,
  type PosaBraccia,
  type StatoPersonaggio,
  type StileMateriale,
} from '../../src/personaggi';
import { creaAbitante } from '../../src/oggetti/oggetti/abitante';

let indiceP: Promise<IndicePersonaggi> | null = null;
const indice = () => (indiceP ??= caricaIndice('../../public/personaggi/'));

const q = new URLSearchParams(location.search);
const modelli = (q.get('m') ?? 'togna').split(',').filter(Boolean);
const stile = (q.get('stile') ?? 'toon') as StileMateriale;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, innerWidth / innerHeight, 0.1, 200);

// --- luci: sole caldo radente + cielo freddo + controluce tenue
const sera = q.get('luce') === 'sera';
const cielo = new THREE.HemisphereLight(sera ? 0x6f7fb0 : 0x9fb6d6, sera ? 0x4a3a34 : 0x7a6248, sera ? 1.1 : 1.35);
scena.add(cielo);
const sole = new THREE.DirectionalLight(sera ? 0xffb070 : 0xffe0b0, sera ? 2.4 : 2.6);
sole.position.set(4, sera ? 3 : 7, 6);
sole.castShadow = true;
sole.shadow.mapSize.set(2048, 2048);
sole.shadow.camera.left = -5;
sole.shadow.camera.right = 5;
sole.shadow.camera.top = 5;
sole.shadow.camera.bottom = -2;
sole.shadow.bias = -0.0005;
sole.shadow.normalBias = 0.02;
scena.add(sole);
const contro = new THREE.DirectionalLight(0xc8d8ff, 0.5);
contro.position.set(-3, 4, -6);
scena.add(contro);

// --- fondo: carta calda o un bozzetto
const sfondo = q.get('sfondo');
if (sfondo) {
  new THREE.TextureLoader().load(sfondo, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    scena.background = t;
  });
} else {
  scena.background = new THREE.Color(sera ? 0x3d3a55 : 0xd9cdb6);
  const suolo = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshLambertMaterial({ color: sera ? 0x4a5040 : 0x9a8f5c }));
  suolo.rotation.x = -Math.PI / 2;
  suolo.receiveShadow = true;
  scena.add(suolo);
}

interface Figura {
  nome: string;
  gruppo: THREE.Object3D;
  update: (dt: number, stato: StatoPersonaggio) => void;
  altezza: number;
}

// gli abitanti procedurali di oggi, per il confronto: copia di ASPETTO e dei VELATI di
// src/popolamento/abitanti.ts (i quattro generici sono i velati più vicini ai nuovi modelli)
const ASPETTO_VECCHIO: Record<string, Parameters<typeof creaAbitante>[0]> = {
  ottavio: { seme: 'ottavio', copricapo: 'velo', corporatura: 'esile', postura: 'eretta', colore: 0x5c7442, coloreVelo: 0x4f8a46 },
  pina: { seme: 'pina', copricapo: 'cappuccio', corporatura: 'anziana', postura: 'curva', colore: 0x7c766e, coloreVelo: 0x8d8780 },
  togna: { seme: 'togna', copricapo: 'velo', corporatura: 'robusta', postura: 'curva', colore: 0xd9d0bf, coloreVelo: 0x6a4a31 },
  bortolo: { seme: 'bortolo', copricapo: 'cappello', corporatura: 'robusta', postura: 'mani-dietro', colore: 0x5a4a3a, coloreVelo: 0x1f1d22 },
  annunciata: { seme: 'annunciata', copricapo: 'velo', corporatura: 'anziana', postura: 'mani-giunte', colore: 0x4b3322, coloreVelo: 0x4b3322, bastone: true },
  nando: { seme: 'nando', copricapo: 'cappello', corporatura: 'robusta', postura: 'eretta', colore: 0xcfbd97, coloreVelo: 0x8a7a5a, guanti: false },
  clelia: { seme: 'clelia', copricapo: 'maschera-liscia', corporatura: 'esile', postura: 'mani-giunte', colore: 0x1b191e, coloreVelo: 0x141216 },
  lisa: { seme: 'lisa', copricapo: 'velo', corporatura: 'bambino', postura: 'eretta', colore: 0xe9e3d6, coloreVelo: 0xf2eee4 },
  gioanin: { seme: 'gioanin', copricapo: 'velo', corporatura: 'bambino', postura: 'eretta', colore: 0xe2dccc, coloreVelo: 0xf4f0e6 },
  velata_donna: { seme: 'velata_donna', copricapo: 'velo', corporatura: 'media' },
  velato_gerla: { seme: 'velato_gerla', copricapo: 'velo', corporatura: 'media', gerla: true },
  velato_maschera: { seme: 'velato_maschera', copricapo: 'maschera', corporatura: 'anziana', bastone: true },
  velato_cappuccio: { seme: 'velato_cappuccio', copricapo: 'cappuccio', corporatura: 'esile' },
};

async function figura(id: string): Promise<Figura> {
  if (id.startsWith('vecchio')) {
    const chi = id.split(':')[1] ?? 'togna';
    const a = creaAbitante(ASPETTO_VECCHIO[chi] ?? { seme: chi });
    return {
      nome: q.get('nomi') === '1' ? chi : `oggi: ${chi} (procedurale)`,
      gruppo: a.gruppo,
      altezza: a.ingombro.altezza,
      update: (dt, s) => a.update?.(dt, { modo: s.modo ?? 'fermo', velocita: s.velocita ?? 1.1, guarda: s.guarda ?? null, gesto: s.gesto ?? 'nessuno' }),
    };
  }
  const url = id.startsWith('pilota:') ? `./pilota/${id.slice(7)}.glb` : `../../public/personaggi/${id}.glb`;
  // lod=1 forza il livello basso (distanza di passaggio 0)
  // con indice=1 gonna, apertura e postura di riposo vengono da public/personaggi/indice.json
  const voce = q.get('indice') === '1' ? (await indice()).personaggi.find((p) => p.id === id) : undefined;
  const base = {
    stile,
    gonna: q.get('gonna') !== '0',
    apertura: Number(q.get('apertura') ?? 12),
    ...(q.get('lod') === '1' ? { distanzaLod: 0 } : {}),
  };
  const m: ModelloPersonaggio = await caricaPersonaggio(url, voce ? opzioniDaIndice(voce, { stile: base.stile, ...(q.get('lod') === '1' ? { distanzaLod: 0 } : {}) }) : base);
  const curvo = voce?.curvo ?? 0;
  if (voce && q.get('oggetti') !== '0') {
    // gli oggetti di scena dell'indice (bastone, gerla...), attaccati nella posa di riposo
    m.update(0, { curvo });
    for (const o of voce.oggetti) attaccaOggetto(m, o);
  }
  const tri = m.lod.map((x) => (x.geometry.index ? x.geometry.index.count : x.geometry.getAttribute('position').count) / 3);
  const nome = q.get('nomi') === '1' ? `${id}\n${m.altezza.toFixed(2).replace('.', ',')} m` : `${id} (${tri.map((x) => Math.round(x)).join(' / ')} tri)`;
  return { nome, gruppo: m.gruppo, altezza: m.altezza, update: (dt, s) => m.update(dt, { ...s, curvo: Math.max(s.curvo ?? 0, curvo) }, camera) };
}

const figure: Figura[] = [];
const etichette = document.getElementById('etichette') as HTMLDivElement;
if (q.get('nomi') === '1') {
  // modo «scheda» (tools/personaggi/scheda.mjs): etichette grandi, niente riga di stato
  etichette.style.fontSize = '22px';
  etichette.style.bottom = '8px';
  (document.getElementById('info') as HTMLDivElement).style.display = 'none';
}
const stato: StatoPersonaggio = {
  modo: (q.get('modo') as 'fermo' | 'cammina') ?? 'fermo',
  velocita: Number(q.get('velocita') ?? 1.1),
  gesto: (q.get('gesto') as GestoPersonaggio) ?? 'nessuno',
  curvo: Number(q.get('curvo') ?? 0),
  braccia: (q.get('braccia') as PosaBraccia) ?? 'libere',
  guarda: null,
};
let vista = q.get('vista') ?? 'tre-quarti';

function inquadra(): void {
  const n = figure.length;
  const passo = Number(q.get('passo') ?? 1.15);
  const largo = (n - 1) * passo + 1.2;
  const alto = Math.max(1.8, ...figure.map((f) => f.altezza)) + 0.3;
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const dist = Math.max(alto / 2 / Math.tan(fov / 2), largo / 2 / Math.tan(fov / 2) / camera.aspect) * 1.08;
  const ang = { fronte: 0, fianco: 90, retro: 180, 'tre-quarti': 35 }[vista] ?? 35;
  const a = THREE.MathUtils.degToRad(ang);
  // le figure ruotano, la camera resta davanti alla fila
  figure.forEach((f, i) => {
    f.gruppo.position.set((i - (n - 1) / 2) * passo, 0, 0);
    f.gruppo.rotation.y = -a;
  });
  if (q.get('primo') === '1') {
    // primo piano delle teste (per giudicare i volti scoperti e i veli)
    const hy = Math.max(...figure.map((f) => f.altezza)) * 0.9;
    camera.position.set(0, hy, Math.max(1.6, largo * 0.95));
    camera.lookAt(0, hy - 0.05, 0);
  } else {
    camera.position.set(0, alto * 0.48, dist);
    camera.lookAt(0, alto * 0.46, 0);
  }
  camera.updateMatrixWorld();
  etichette.innerHTML = '';
  figure.forEach((f) => {
    const p = f.gruppo.position.clone().project(camera);
    const s = document.createElement('span');
    s.textContent = f.nome;
    if (q.get('nomi') === '1') {
      // due righe (nome, altezza) appoggiate al fondo
      s.style.whiteSpace = 'pre-line';
      s.style.textAlign = 'center';
      s.style.bottom = '0';
    }
    s.style.left = `${((p.x + 1) / 2) * innerWidth}px`;
    etichette.appendChild(s);
  });
  (document.getElementById('info') as HTMLDivElement).textContent = `vista ${vista} · ${stato.modo} · stile ${stile}`;
}

let tempo = 0;
function avanza(fino: number): void {
  // tempo fisso a passi di 1/60 s: le schermate sono ripetibili
  const dt = 1 / 60;
  while (tempo < fino - 1e-6) {
    for (const f of figure) f.update(dt, stato);
    tempo += dt;
  }
}

async function avvia(): Promise<void> {
  for (const id of modelli) {
    const f = await figura(id);
    figure.push(f);
    scena.add(f.gruppo);
  }
  inquadra();
  const tFisso = q.get('t');
  if (tFisso !== null) {
    avanza(Number(tFisso));
    renderer.render(scena, camera);
  } else {
    let prima = performance.now();
    renderer.setAnimationLoop(() => {
      const ora = performance.now();
      const dt = Math.min(0.05, (ora - prima) / 1000);
      prima = ora;
      for (const f of figure) f.update(dt, stato);
      renderer.render(scena, camera);
    });
  }
}

const pronto = avvia();

declare global {
  interface Window {
    __PROVA__: {
      pronto: Promise<void>;
      /** porta l'animazione al tempo t (s, da 0) e disegna */
      fotogramma(
        t: number,
        opz?: { vista?: string; modo?: 'fermo' | 'cammina'; gesto?: GestoPersonaggio; guarda?: [number, number, number] | null; curvo?: number; braccia?: PosaBraccia },
      ): void;
    };
  }
}

window.__PROVA__ = {
  pronto,
  fotogramma(t, opz = {}) {
    if (opz.vista) vista = opz.vista;
    if (opz.modo) stato.modo = opz.modo;
    if (opz.gesto) stato.gesto = opz.gesto;
    if (opz.curvo !== undefined) stato.curvo = opz.curvo;
    if (opz.braccia) stato.braccia = opz.braccia;
    if (opz.guarda !== undefined) stato.guarda = opz.guarda ? new THREE.Vector3(...opz.guarda) : null;
    inquadra();
    if (t < tempo) {
      // si riparte da capo: ricarica lo stato degli animatori avanzando da zero non è possibile, quindi si va solo avanti
      tempo = t;
    }
    avanza(t);
    renderer.render(scena, camera);
  },
};

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  inquadra();
});
