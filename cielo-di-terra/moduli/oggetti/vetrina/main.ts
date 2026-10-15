/**
 * Vetrina degli oggetti (npm run dev): dispone tutti i generatori su un prato con luce calda.
 * Parametri URL:
 *   ?vista=insieme|rustici|…   inquadratura (vedi VISTE; l'elenco è in window.__viste)
 *   &t=2.5                     secondi di animazione simulati prima della foto
 *   &fermo=1                   non anima (per le schermate)
 *   ?vista=misure              misura triangoli e draw call di ogni voce del catalogo (window.__misure())
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
import { creaLanterna, creaLumino } from '../src/oggetti/lumi';
import { creaAbitante, type StatoAbitante } from '../src/oggetti/abitante';
import { creaFada, creaSciameFade, creaSciameApi, type StatoFada } from '../src/oggetti/fade';
import { creaSquadroPrimaPersona, creaVeloPrimaPersona, PUNTALE_PIANTATO } from '../src/oggetti/primaPersona';
import { CATALOGO } from '../src/catalogo';
import { misura } from '../src/misure';
import type { OggettoProcedurale } from '../src/tipi';

type PrimaPersona = 'squadro-piantato' | 'squadro-mano' | 'velo';

interface Vista {
  cam: [number, number, number];
  guarda: [number, number, number];
  fov?: number;
  notte?: boolean;
  primaPersona?: PrimaPersona;
  t?: number;
  didascalia: string;
}

const VISTE: Record<string, Vista> = {
  insieme: { cam: [6, 30, 74], guarda: [2, 2, -2], didascalia: 'Vetrina d’insieme' },
  rustici: { cam: [-5, 4.2, 7], guarda: [-7, 3.6, -8], fov: 58, didascalia: 'Rustici ticinesi in gneiss con tetto in piode' },
  smontato: { cam: [27, 4.5, 6], guarda: [16, 2, -8], didascalia: 'Rustico «smontato dalle Fade» (stessa pianta del rustico a destra)' },
  campanile: { cam: [14, 5, 6], guarda: [4, 16, -22], fov: 50, didascalia: 'Campanile di San Vigilio con il Pilastro 1' },
  cella: { cam: [10, 27, -12], guarda: [4, 24, -22], fov: 42, didascalia: 'Cella campanaria, cappello di piode, Pilastro 1 con la targa del 2120' },
  castagni: { cam: [-18, 6.5, 50], guarda: [-27, 6, 22], fov: 55, didascalia: 'Castagni secolari: estate, autunno, fioritura' },
  cripta: { cam: [-2.5, 3.2, 23], guarda: [-6, 1.0, 15.5], didascalia: 'Castagno morto e botola della Cripta (aperta)' },
  muri: { cam: [19, 4.0, 31], guarda: [26, 1.0, 18], didascalia: 'Muri a secco, scaletta e cancello' },
  cancello: { cam: [29.5, 1.9, 26.5], guarda: [31, 0.8, 22], fov: 45, didascalia: 'Cancello di legno fra due pilastri' },
  lago: { cam: [22, 4, -26], guarda: [32, 1, -19], fov: 50, didascalia: 'Pontile con la tavola dei venti, barche a vela rossa' },
  barca: { cam: [37, 2.2, -36], guarda: [42, 1.4, -30], fov: 42, didascalia: 'Barca a remi con vela al terzo e lanterna a prua' },
  fienile: { cam: [-20, 3.5, 6], guarda: [-28, 3, -6], didascalia: 'Fienile in legno e pietra' },
  capisaldi: { cam: [7.2, 2.1, 31.8], guarda: [7.2, 0.7, 26.4], fov: 52, didascalia: 'Capisaldi: chiodo nel muro, pilastrino, masso, pilastro di bronzo' },
  chiodo: { cam: [1.95, 1.55, 26.5], guarda: [1.95, 0.84, 26.02], fov: 38, didascalia: 'Chiodo d’ottone numerato con il segno di vernice' },
  palina: { cam: [20, 3, 50], guarda: [28, 6, 35], didascalia: 'Paline bianche e rosse per i capisaldi lontani' },
  abitanti: { cam: [5.5, 1.9, 14.5], guarda: [5, 1.2, 3.5], fov: 42, t: 2.2, didascalia: 'Abitanti velati: garza di noce, maschere di castagno, bugnera, cappucci' },
  velati: { cam: [3.6, 1.62, 7.6], guarda: [4.0, 1.35, 3.0], fov: 32, t: 2.2, didascalia: 'Senza volto: velo di garza, maschera intagliata, cappuccio, rete da apicoltore' },
  'squadro-piantato': { cam: [0, 0, 0], guarda: [0, 0, -1], fov: 60, primaPersona: 'squadro-piantato', didascalia: 'Lo squadro di Aurelio piantato sul chiodo 37' },
  'squadro-mano': { cam: [-1, 1.62, 34], guarda: [4, 6, -22], fov: 60, primaPersona: 'squadro-mano', didascalia: 'Lo squadro tenuto in mano come cannocchiale' },
  velo: { cam: [10, 7.5, 38], guarda: [18, 2, -20], fov: 65, primaPersona: 'velo', didascalia: 'Il Velo in planata: traversa, tela cucita, nappina' },
  fade: { cam: [26, 3.2, 3], guarda: [16, 1.6, -8], notte: true, t: 7, didascalia: 'Notte: le Fade smontano il rustico non benedetto' },
  'fade-vicino': { cam: [20.5, 2.3, -1.5], guarda: [17.5, 1.5, -5], fov: 40, notte: true, t: 2.3, didascalia: 'Una Fada solleva una pietra' },
  'fada-giorno': { cam: [20.5, 2.3, -1.5], guarda: [17.5, 1.5, -5], fov: 40, t: 2.3, didascalia: 'Una Fada di giorno: rame, ottone e smalto verde' },
  api: { cam: [19.6, 2.0, 9.0], guarda: [22, 1.8, 6], fov: 45, t: 4, didascalia: 'Sciame di api di rame' },
  lanterne: { cam: [5, 1.8, 15], guarda: [5, 1.6, 3], fov: 50, notte: true, t: 2.2, didascalia: 'Lanterne e lumi notturni del paese' },
  notte: { cam: [6, 30, 74], guarda: [2, 2, -2], notte: true, t: 6, didascalia: 'Vetrina d’insieme di notte' },
};

const parametri = new URLSearchParams(location.search);
const nomeVista = parametri.get('vista') ?? 'insieme';
const vista = VISTE[nomeVista] ?? (VISTE['insieme'] as Vista);
const tSimulato = Number(parametri.get('t') ?? String(vista.t ?? 1.5));
const fermo = parametri.get('fermo') === '1';
const finestra = window as unknown as Record<string, unknown>;
finestra['__viste'] = Object.keys(VISTE);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

if (nomeVista === 'misure') {
  avviaMisure();
} else {
  avviaVetrina();
}

function avviaVetrina(): void {
  const scena = new THREE.Scene();
  const ambiente = creaAmbiente(scena);
  ambiente.impostaNotte(!!vista.notte);
  impostaIntensitaLumi(vista.notte ? 1 : 0);

  const camera = new THREE.PerspectiveCamera(vista.fov ?? 45, window.innerWidth / window.innerHeight, vista.primaPersona ? 0.02 : 0.1, 1500);
  camera.position.set(...vista.cam);
  camera.lookAt(new THREE.Vector3(...vista.guarda));
  scena.add(camera);

  type Animato = { o: OggettoProcedurale<unknown>; stato?: () => unknown };
  const animati: Animato[] = [];
  function posa<S>(o: OggettoProcedurale<S>, x: number, z: number, rotY = 0, stato?: () => S): OggettoProcedurale<S> {
    o.gruppo.position.set(x, 0, z);
    o.gruppo.rotation.y = rotY;
    scena.add(o.gruppo);
    if (o.update) animati.push({ o: o as unknown as OggettoProcedurale<unknown>, ...(stato ? { stato } : {}) });
    return o;
  }

  // --- acqua del lago (solo vetrina)
  {
    const g = new THREE.CircleGeometry(20, 48);
    g.rotateX(-Math.PI / 2);
    const acqua = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: vista.notte ? 0x2c4a6a : 0x4f9a8a }));
    acqua.position.set(40, 0.04, -28);
    acqua.receiveShadow = true;
    scena.add(acqua);
  }

  // --- rustici
  posa(creaRustico({ seme: 11, piani: 2, balcone: 'fronte' }), -18, -8, 0.15);
  posa(creaRustico({ seme: 12, piani: 3, balcone: 'lato' }), -9, -10, -0.1);
  posa(creaRustico({ seme: 13, piani: 1 }), -1, -7, 0.3);
  posa(creaRustico({ seme: 14, piani: 2, scalaEsterna: true, balcone: 'nessuno' }), 7, -9, -0.25);
  posa(creaRustico({ seme: 14, piani: 2, scalaEsterna: true, balcone: 'nessuno', smontato: true }), 16, -8, -0.1);
  // --- campanile, fienile
  posa(creaCampanile(), 4, -22, 0.1);
  posa(creaFienile({ seme: 3 }), -28, -6, 0.5);
  // --- castagni
  posa(creaCastagno({ seme: 21, stagione: 'estate' }), -16, 22);
  posa(creaCastagno({ seme: 22, stagione: 'autunno' }), -30, 16);
  posa(creaCastagno({ seme: 23, stagione: 'fioritura', altezza: 11 }), -38, 30);
  posa(creaCastagnoMorto({ seme: 24, cripta: true, apertaAllInizio: true }), -6, 14, 0.2);
  // --- terrazze
  posa(creaMuroSecco({ seme: 31, lunghezza: 14, raggioCurva: 30, altezza: 1.6 }), 24, 18, 0.1);
  posa(creaMuroSecco({ seme: 32, lunghezza: 12, raggioCurva: 26, altezza: 1.3 }), 25, 12, 0.08);
  posa(creaScaletta({ seme: 33, gradini: 7 }), 21, 20.6, 0.1);
  posa(creaCancello({ seme: 34, apertura: 0.35 }), 31, 22, 0.1);
  posa(creaMuroSecco({ seme: 35, percorso: [[0, 0], [3, 0.2], [6, 1.2], [8, 3]], altezza: 1.1 }), 33, 22.3, 0);
  // --- lago
  posa(creaPontile({ seme: 41 }), 26, -14, Math.PI * 0.75);
  posa(creaBarca({ seme: 42, vela: 'alzata' }), 42, -30, 0.6, () => ({ vento: 0.6, mura: 1 as const }));
  posa(creaBarca({ seme: 43, vela: 'ammainata', coloreScafo: 0xe4dccb }), 34.8, -19.3, 2.356);
  // --- capisaldi
  const chiodo37 = posa(creaCaposaldo({ numero: 37, supporto: 'muro' }), 2, 26);
  if (nomeVista === 'chiodo') {
    const c = (chiodo37.punti['chiodo'] as THREE.Vector3).clone().add(chiodo37.gruppo.position);
    camera.position.copy(c).add(new THREE.Vector3(0.0, 0.42, 0.3));
    camera.lookAt(c);
  }
  posa(creaCaposaldo({ numero: 141, supporto: 'pilastrino' }), 5, 27);
  posa(creaCaposaldo({ numero: 8, supporto: 'masso' }), 8.5, 26);
  posa(creaPilastro({ numero: 4, segnale: 'disco', altezzaSegnale: 6 }), 12, 27);
  posa(creaPilastro({ numero: 6, segnale: 'palina', altezzaSegnale: 8, lumeDiMira: true }), 40, 30);
  posa(creaPalina({ altezza: 9, base: 'ometto' }), 26, 34);
  posa(creaPalina({ altezza: 8.5, base: 'pilastro', numero: 12 }), 34, 40);

  // --- abitanti nella piazza
  const occhio = camera.position.clone();
  const campanileTesta = new THREE.Vector3(4, 22, -22);
  const fermoGuarda = (): StatoAbitante => ({ modo: 'fermo', guarda: occhio });
  posa(creaAbitante({ seme: 101, copricapo: 'velo', corporatura: 'media', postura: 'mani-giunte' }), 2.2, 3.2, 0.3, fermoGuarda);
  posa(creaAbitante({ seme: 102, copricapo: 'maschera', corporatura: 'robusta', postura: 'eretta', gerla: true }), 4.1, 2.4, -0.2, (): StatoAbitante => ({ guarda: occhio, gesto: 'saluta' }));
  posa(creaAbitante({ seme: 103, copricapo: 'apicoltore', corporatura: 'esile', postura: 'eretta', guanti: true }), 6.3, 3.4, -0.5, (): StatoAbitante => ({ gesto: 'indica', indica: campanileTesta, guarda: campanileTesta }));
  posa(creaAbitante({ seme: 104, copricapo: 'cappuccio', corporatura: 'anziana', bastone: true }), 8.2, 2.0, -0.7, fermoGuarda);
  posa(creaAbitante({ seme: 105, copricapo: 'cappello', corporatura: 'esile', postura: 'eretta', gerla: true }), 3.2, 5.6, 0.9, (): StatoAbitante => ({ modo: 'cammina', velocita: 1.0 }));
  posa(creaAbitante({ seme: 106, copricapo: 'velo', corporatura: 'bambino', postura: 'eretta', coloreVelo: 0x8c6c4c }), 5.1, 5.9, -0.3, fermoGuarda);
  posa(creaAbitante({ seme: 107, copricapo: 'maschera-liscia', corporatura: 'esile', postura: 'mani-giunte', colore: 0x26222a, coloreVelo: 0x1d1a20 }), 0.6, 5.2, 0.6);
  posa(creaAbitante({ seme: 108, copricapo: 'velo', corporatura: 'robusta', postura: 'braccia-conserte', coloreVelo: 0x5c4330 }), 9.4, 5.1, -0.9, (): StatoAbitante => ({ gesto: 'mano-al-petto', guarda: occhio }));
  // le api che girano attorno alla bugnera
  posa(creaSciameApi({ seme: 109, numero: 6, raggio: 0.45, centro: new THREE.Vector3(0, 1.8, 0) }), 6.3, 3.4);

  // --- lumi
  posa(creaLanterna({ tipo: 'palo', luce: !!vista.notte }), -1.5, 3.5);
  posa(creaLanterna({ tipo: 'palo', seme: 2, luce: !!vista.notte }), 11.5, 7.5);
  posa(creaLanterna({ tipo: 'nicchia', luce: !!vista.notte }), 11, 3.2, -0.6);
  {
    // forca di legno con la lanterna appesa
    const forca = new THREE.Group();
    const legno = new THREE.MeshLambertMaterial({ color: 0x5a3f2c });
    const palo = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.6, 0.14), legno);
    palo.position.set(0, 1.3, 0);
    const braccio = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.1), legno);
    braccio.position.set(0.4, 2.5, 0);
    forca.add(palo, braccio);
    forca.position.set(-0.5, 0, 8.5);
    scena.add(forca);
    const appesa = posa(creaLanterna({ tipo: 'appesa' }), 0, 0, 0);
    appesa.gruppo.position.set(0.25, 2.45, 8.5);
  }
  posa(creaLanterna({ tipo: 'mano', luce: !!vista.notte }), 6.0, 8.2);
  for (const [i, x] of [3.0, 3.25, 3.5].entries()) posa(creaLumino(`lumino-${i}`), x, 8.6);
  {
    // lanterna a muro sulla facciata del rustico in (7, −9)
    const lm = creaLanterna({ tipo: 'muro' });
    lm.gruppo.position.set(7.5, 2.3, -5.0);
    lm.gruppo.rotation.y = -0.25;
    scena.add(lm.gruppo);
    if (lm.update) animati.push({ o: lm as unknown as OggettoProcedurale<unknown> });
  }

  // --- Fade attorno al rustico smontato (coordinate del gruppo = mondo)
  const centroRovina = new THREE.Vector3(16, 0, -8);
  const fadeLavori: Array<[THREE.Vector3, THREE.Vector3, number]> = [
    [new THREE.Vector3(14.5, 0, -3.8), new THREE.Vector3(19.8, 0, -3.0), 0],
    [new THREE.Vector3(12.8, 0, -6.5), new THREE.Vector3(11.0, 0, -2.5), 1.7],
    [new THREE.Vector3(18.5, 0, -4.5), new THREE.Vector3(21.5, 0, -7.5), 3.3],
  ];
  let fadaVicina: THREE.Object3D | null = null;
  for (const [i, [da, a, ritardo]] of fadeLavori.entries()) {
    const f = creaFada({ seme: 200 + i, luce: !!vista.notte && i === 0, scia: !!vista.notte });
    if (i === 0) fadaVicina = f.gruppo.getObjectByName('fada-macchina') ?? null;
    scena.add(f.gruppo);
    const stato: StatoFada = { modo: 'trasporta', da, a, quota: 2.4, velocita: 2.4 };
    // avanzamento iniziale sfalsato
    for (let k = 0; k < ritardo * 30; k++) f.update?.(1 / 30, stato);
    animati.push({ o: f as unknown as OggettoProcedurale<unknown>, stato: () => stato });
  }
  {
    const f = creaFada({ seme: 210, pietra: false, scia: !!vista.notte });
    scena.add(f.gruppo);
    animati.push({ o: f as unknown as OggettoProcedurale<unknown>, stato: () => ({ modo: 'cerchio', centro: centroRovina, raggio: 5.5, quota: 3.0, velocita: 2.5 }) });
  }
  if (vista.notte) {
    const sc = creaSciameFade({ seme: 211, numero: 16, centro: centroRovina, raggio: 9, quota: 2.6, conPietra: 0.35 });
    scena.add(sc.gruppo);
    animati.push({ o: sc as unknown as OggettoProcedurale<unknown> });
  }
  // --- sciame di api sopra il prato vicino al lago
  posa(creaSciameApi({ seme: 300, numero: 160, raggio: 1.0, centro: new THREE.Vector3(0, 1.8, 0) }), 22, 6);

  // --- prima persona
  if (vista.primaPersona) {
    if (vista.primaPersona === 'squadro-piantato') {
      const sq = creaSquadroPrimaPersona({ posa: 'piantato' });
      camera.add(sq.gruppo);
      animati.push({ o: sq as unknown as OggettoProcedurale<unknown>, stato: () => ({ posa: 'piantato' }) });
      // camera disposta in modo che il puntale stia sul chiodo 37
      const chiodo = (chiodo37.punti['chiodo'] as THREE.Vector3).clone().add(chiodo37.gruppo.position);
      camera.rotation.set(-0.3, 0.15, 0, 'YXZ');
      camera.updateMatrixWorld();
      const off = PUNTALE_PIANTATO.clone().applyQuaternion(camera.quaternion);
      camera.position.copy(chiodo).sub(off);
    } else if (vista.primaPersona === 'squadro-mano') {
      const sq = creaSquadroPrimaPersona({ posa: 'mano' });
      camera.add(sq.gruppo);
      animati.push({ o: sq as unknown as OggettoProcedurale<unknown>, stato: () => ({ posa: 'mano', mira: 0 }) });
    } else {
      const v = creaVeloPrimaPersona();
      camera.add(v.gruppo);
      animati.push({ o: v as unknown as OggettoProcedurale<unknown>, stato: () => ({ deriva: 0.55, vento: 0.7, rollio: 0.1 }) });
    }
  }

  const didascalia = document.getElementById('didascalia');
  if (didascalia) didascalia.textContent = vista.didascalia;

  const aggiorna = (dt: number) => {
    for (const a of animati) a.o.update?.(dt, a.stato?.());
  };
  const passo = 1 / 30;
  for (let t = 0; t < tSimulato; t += passo) aggiorna(passo);
  // primi piani di una Fada: la camera la segue
  if ((nomeVista === 'fade-vicino' || nomeVista === 'fada-giorno') && fadaVicina) {
    const p = fadaVicina.getWorldPosition(new THREE.Vector3());
    camera.position.copy(p).add(new THREE.Vector3(1.6, 0.25, 1.9));
    camera.lookAt(p.clone().add(new THREE.Vector3(0, 0.05, 0)));
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  let ultimo = performance.now();
  const ciclo = () => {
    const ora = performance.now();
    const dt = Math.min(0.05, (ora - ultimo) / 1000);
    ultimo = ora;
    if (!fermo) aggiorna(dt);
    renderer.render(scena, camera);
    if (!fermo) requestAnimationFrame(ciclo);
  };
  ciclo();
  finestra['__pronto'] = true;
}

/** Misura ogni voce del catalogo da sola, con renderer.info (draw call e triangoli veri). */
function avviaMisure(): void {
  impostaIntensitaLumi(1);
  renderer.shadowMap.enabled = false;
  finestra['__misure'] = () => {
    const risultati: Array<Record<string, unknown>> = [];
    for (const voce of CATALOGO) {
      const scena = new THREE.Scene();
      scena.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
      const o = voce.crea();
      scena.add(o.gruppo);
      o.update?.(1 / 30, undefined);
      o.gruppo.updateMatrixWorld(true);
      const sfera = new THREE.Box3().setFromObject(o.gruppo).getBoundingSphere(new THREE.Sphere());
      const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 5000);
      const d = Math.max(1, sfera.radius) * 2.8;
      camera.position.copy(sfera.center).add(new THREE.Vector3(0, d * 0.3, d));
      camera.lookAt(sfera.center);
      renderer.info.reset();
      renderer.render(scena, camera);
      const info = renderer.info.render;
      const stima = misura(o.gruppo);
      risultati.push({
        nome: voce.nome,
        triangoli: info.triangles,
        drawCall: info.calls,
        punti: info.points,
        mesh: stima.mesh,
        stimaTriangoli: stima.triangoli,
        stimaDrawCall: stima.drawCall,
        collider: o.collider.length,
        note: voce.nota ?? '',
      });
      o.dispose();
    }
    return risultati;
  };
  finestra['__pronto'] = true;
}
