/**
 * Vetrina degli oggetti (vite dev): dispone tutti i generatori su un prato con luce calda.
 * Parametri URL:
 *   ?vista=insieme|rustici|...   inquadratura (vedi VISTE)
 *   &t=2.5                       secondi di animazione simulati prima della foto
 *   &fermo=1                     non anima (per le schermate)
 */
import * as THREE from 'three';
import { creaAmbiente } from './ambiente';
import { impostaIntensitaLumi } from '../src/materiali';
import { creaRustico } from '../src/oggetti/rustico';
import { creaCampanile } from '../src/oggetti/campanile';
import { creaCastagno, creaCastagnoMorto } from '../src/oggetti/castagno';
import { creaMuroSecco, creaScaletta, creaCancello } from '../src/oggetti/muri';
import { creaFienile } from '../src/oggetti/fienile';
import { creaPontile, creaBarca } from '../src/oggetti/lago';
import { creaCaposaldo, creaPalina, creaPilastro } from '../src/oggetti/caposaldo';
import { creaLanterna } from '../src/oggetti/lumi';
import type { OggettoProcedurale } from '../src/tipi';

interface Vista {
  cam: [number, number, number];
  guarda: [number, number, number];
  fov?: number;
  notte?: boolean;
  didascalia: string;
}

const VISTE: Record<string, Vista> = {
  insieme: { cam: [8, 30, 78], guarda: [2, 3, -2], didascalia: 'Vetrina d’insieme' },
  rustici: { cam: [-6, 6, 22], guarda: [-6, 3.5, -6], didascalia: 'Rustici ticinesi in gneiss con tetto in piode' },
  smontato: { cam: [30, 5, 8], guarda: [22, 2, -7], didascalia: 'Rustico «smontato dalle Fade»' },
  campanile: { cam: [14, 5, 6], guarda: [4, 16, -22], fov: 50, didascalia: 'Campanile di San Vigilio con il Pilastro 1' },
  castagni: { cam: [-14, 6, 46], guarda: [-22, 6, 20], didascalia: 'Castagni secolari: estate, autunno, fioritura' },
  cripta: { cam: [-3, 3.2, 26], guarda: [-6, 1.5, 16], didascalia: 'Castagno morto e botola della Cripta' },
  muri: { cam: [22, 5, 36], guarda: [24, 1.5, 18], didascalia: 'Muri a secco, scaletta e cancello' },
  lago: { cam: [26, 6, -6], guarda: [40, 0.5, -26], didascalia: 'Pontile, barca a vela rossa, fienile' },
  capisaldi: { cam: [6, 2.2, 34], guarda: [6, 0.8, 27], didascalia: 'Capisaldi: chiodo nel muro, pilastrino, masso, pilastro di bronzo' },
  chiodo: { cam: [1.75, 1.15, 27.0], guarda: [1.75, 0.8, 26.0], fov: 35, didascalia: 'Chiodo d’ottone numerato' },
  palina: { cam: [20, 3, 50], guarda: [26, 6, 34], didascalia: 'Palina bianca e rossa sull’ometto' },
};

const parametri = new URLSearchParams(location.search);
const nomeVista = parametri.get('vista') ?? 'insieme';
const vista = VISTE[nomeVista] ?? (VISTE['insieme'] as Vista);
const tSimulato = Number(parametri.get('t') ?? '1.5');
const fermo = parametri.get('fermo') === '1';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const scena = new THREE.Scene();
const ambiente = creaAmbiente(scena);
ambiente.impostaNotte(!!vista.notte);
impostaIntensitaLumi(vista.notte ? 1 : 0);

const camera = new THREE.PerspectiveCamera(vista.fov ?? 45, window.innerWidth / window.innerHeight, 0.05, 1500);
camera.position.set(...vista.cam);
camera.lookAt(new THREE.Vector3(...vista.guarda));
scena.add(camera);

const animati: Array<OggettoProcedurale<unknown>> = [];

function posa<S>(o: OggettoProcedurale<S>, x: number, z: number, rotY = 0): OggettoProcedurale<S> {
  o.gruppo.position.set(x, 0, z);
  o.gruppo.rotation.y = rotY;
  scena.add(o.gruppo);
  if (o.update) animati.push(o as OggettoProcedurale<unknown>);
  return o;
}

// --- acqua del lago (solo vetrina) ---
{
  const g = new THREE.CircleGeometry(20, 48);
  g.rotateX(-Math.PI / 2);
  const acqua = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0x4f9a8a }));
  acqua.position.set(40, 0.04, -28);
  acqua.receiveShadow = true;
  scena.add(acqua);
}

// --- stazione: rustici ---
posa(creaRustico({ seme: 11, piani: 2, balcone: 'fronte' }), -18, -8, 0.15);
posa(creaRustico({ seme: 12, piani: 3, balcone: 'lato' }), -9, -10, -0.1);
posa(creaRustico({ seme: 13, piani: 1 }), -1, -7, 0.3);
posa(creaRustico({ seme: 14, piani: 2, scalaEsterna: true, balcone: 'nessuno' }), 7, -9, -0.25);
posa(creaRustico({ seme: 14, piani: 2, scalaEsterna: true, balcone: 'nessuno', smontato: true }), 16, -8, -0.1);

// --- campanile, fienile ---
posa(creaCampanile(), 4, -22, 0.1);
posa(creaFienile({ seme: 3 }), -28, -6, 0.5);

// --- castagni ---
posa(creaCastagno({ seme: 21, stagione: 'estate' }), -16, 22);
posa(creaCastagno({ seme: 22, stagione: 'autunno' }), -30, 16);
posa(creaCastagno({ seme: 23, stagione: 'fioritura', altezza: 11 }), -38, 30);
posa(creaCastagnoMorto({ seme: 24, cripta: true, apertaAllInizio: true }), -6, 14, 0.2);

// --- terrazze ---
posa(creaMuroSecco({ seme: 31, lunghezza: 14, raggioCurva: 30, altezza: 1.6 }), 24, 18, 0.1);
posa(creaMuroSecco({ seme: 32, lunghezza: 12, raggioCurva: 26, altezza: 1.3 }), 25, 12, 0.08);
posa(creaScaletta({ seme: 33, gradini: 7 }), 21, 18.6, 0.1);
posa(creaCancello({ seme: 34, apertura: 0.35 }), 31, 22, 0.1);
posa(creaMuroSecco({ seme: 35, percorso: [[0, 0], [3, 0.2], [6, 1.2], [8, 3]], altezza: 1.1, terrapieno: false }), 33, 22.3, 0);

// --- lago ---
posa(creaPontile({ seme: 41 }), 30, -18, Math.PI * 0.72);
posa(creaBarca({ seme: 42, vela: 'alzata' }), 42, -30, 0.6);
posa(creaBarca({ seme: 43, vela: 'ammainata', coloreScafo: 0xe4dccb }), 36, -22, 2.2);

// --- capisaldi ---
posa(creaCaposaldo({ numero: 37, supporto: 'muro' }), 2, 26);
posa(creaCaposaldo({ numero: 141, supporto: 'pilastrino' }), 5, 27);
posa(creaCaposaldo({ numero: 8, supporto: 'masso' }), 8.5, 26);
posa(creaPilastro({ numero: 4, segnale: 'palina' }), 12, 27);
posa(creaPalina({ altezza: 9, base: 'ometto' }), 26, 34);
posa(creaPalina({ altezza: 8.5, base: 'pilastro', numero: 12 }), 34, 40);

// --- lumi ---
posa(creaLanterna({ tipo: 'palo' }), 2, -2);
posa(creaLanterna({ tipo: 'nicchia' }), 10, 6, -0.4);

const didascalia = document.getElementById('didascalia');
if (didascalia) didascalia.textContent = vista.didascalia;

function aggiorna(dt: number) {
  for (const o of animati) o.update?.(dt, undefined);
}

// simulazione deterministica del tempo iniziale
const passo = 1 / 30;
for (let t = 0; t < tSimulato; t += passo) aggiorna(passo);

function ridimensiona() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', ridimensiona);

let ultimo = performance.now();
function ciclo() {
  const ora = performance.now();
  const dt = Math.min(0.05, (ora - ultimo) / 1000);
  ultimo = ora;
  if (!fermo) aggiorna(dt);
  renderer.render(scena, camera);
  if (!fermo) requestAnimationFrame(ciclo);
}
ciclo();
renderer.render(scena, camera);
(window as unknown as { __viste: string[] }).__viste = Object.keys(VISTE);
(window as unknown as { __pronto: boolean }).__pronto = true;
