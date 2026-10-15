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
import type { OggettoProcedurale } from '../src/tipi';

interface Vista {
  cam: [number, number, number];
  guarda: [number, number, number];
  fov?: number;
  notte?: boolean;
  didascalia: string;
}

const VISTE: Record<string, Vista> = {
  insieme: { cam: [0, 26, 62], guarda: [0, 4, 0], didascalia: 'Vetrina d’insieme' },
  rustici: { cam: [-6, 6, 22], guarda: [-6, 3.5, -6], didascalia: 'Rustici ticinesi in gneiss con tetto in piode' },
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

// --- stazione: rustici ---
posa(creaRustico({ seme: 11, piani: 2, balcone: 'fronte' }), -18, -8, 0.15);
posa(creaRustico({ seme: 12, piani: 3, balcone: 'lato' }), -9, -10, -0.1);
posa(creaRustico({ seme: 13, piani: 1 }), -1, -7, 0.3);
posa(creaRustico({ seme: 14, piani: 2, scalaEsterna: true, balcone: 'nessuno' }), 7, -9, -0.25);
posa(creaRustico({ seme: 14, piani: 2, scalaEsterna: true, balcone: 'nessuno', smontato: true }), 16, -8, -0.1);

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
