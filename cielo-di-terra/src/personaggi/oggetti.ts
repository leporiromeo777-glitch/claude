/**
 * Oggetti di scena dei personaggi generati: le cose tenute in mano o portate addosso, che la pipeline
 * lascia fuori dal modello (sam_3_3d le butta, un bastone che tocca terra lega la mano al suolo nei pesi,
 * la gerla deve poter essere vuota o carica). Sono figure procedurali semplici attaccate a un osso:
 * seguono l'animazione senza pesi propri.
 *
 *   const m = await caricaPersonaggio(url, opz);
 *   m.update(0, { curvo: voce.curvo });          // la posa di riposo (braccia abbassate)
 *   for (const o of voce.oggetti) attaccaOggetto(m, o);   // «bastone@manoD», «gerla@petto»...
 *
 * Fatti con il Costruttore della libreria (src/oggetti/costruttore.ts): colore per vertice, una mesh per
 * canale (opaco, sottile, lume), quindi una o due draw call per oggetto e, nel gioco, i materiali del
 * mondo come il resto del paese (vedi `vestiOggettoMondo` in fabbrica.ts). Il vetro del lume di Ottavio
 * è nel canale «lume»: di notte si accende.
 *
 * L'oggetto si piazza rispetto alla posa che lo scheletro ha in quel momento (il bastone è verticale e
 * tocca terra con le braccia giù): va attaccato dopo il primo update. Il cartone di Pina e la pietra di
 * Nando restano DRITTI rispetto alla figura qualunque cosa faccia la mano (`userData.dritto`: la fabbrica
 * ne raddrizza l'orientamento a ogni aggiornamento).
 */
import * as THREE from 'three';
import { Costruttore, mat } from '../oggetti/costruttore';
import type { ModelloPersonaggio } from './carica';
import { NOMI_OSSA, type NomeOsso } from './ossa';

export type NomeOggetto = 'gerla' | 'bastone' | 'forbici' | 'figura-di-cartone' | 'pacchetto' | 'pietra' | 'cesto' | 'lume';
const NOMI_OGGETTI: readonly string[] = ['gerla', 'bastone', 'forbici', 'figura-di-cartone', 'pacchetto', 'pietra', 'cesto', 'lume'];

const COLORI = {
  castagno: 0x7a5232,
  castagnoScuro: 0x4b3322,
  vimini: 0x9a6a3c,
  viminiScuro: 0x7a5230,
  cuoio: 0x6e4b33,
  ferro: 0x5f5c62,
  cartone: 0xb8894a,
  canapa: 0xd9c9a6,
  spago: 0xb59b6a,
  // la pietra di Nando: gneiss scuro e caldo (prima era grigio-lilla chiarissimo e alla luce diventava bianco)
  pietra: 0x6f6870,
  ottone: 0xa8843e,
  vetro: 0xffc870,
};

/** misure della gerla in frazioni dell'altezza del personaggio */
const GERLA = { alto: 0.34, rSu: 0.11, rGiu: 0.065 };

function gerla(H: number): THREE.Group {
  // cesta conica di castagno intrecciato, aperta in alto, con due spallacci di cuoio
  const b = new Costruttore(31);
  const alto = GERLA.alto * H;
  const rSu = GERLA.rSu * H;
  const rGiu = GERLA.rGiu * H;
  b.aggiungi(new THREE.CylinderGeometry(rSu, rGiu, alto, 14, 5, true), { matrice: mat([0, alto / 2, 0]), colore: COLORI.vimini, canale: 'sottile', rumore: 0.08 });
  // cerchi di rinforzo e il fondo
  for (const [y, r] of [
    [alto, rSu],
    [alto * 0.55, rGiu + (rSu - rGiu) * 0.55],
    [0.01 * H, rGiu],
  ] as const) {
    b.aggiungi(new THREE.TorusGeometry(r, 0.008 * H, 5, 18), { matrice: mat([0, y, 0], [Math.PI / 2, 0, 0]), colore: COLORI.castagnoScuro });
  }
  b.aggiungi(new THREE.CircleGeometry(rGiu, 14), { matrice: mat([0, 0.004 * H, 0], [-Math.PI / 2, 0, 0]), colore: COLORI.viminiScuro });
  // spallacci: due archi davanti alla cesta (verso il corpo, +Z)
  for (const s of [-1, 1]) {
    b.aggiungi(new THREE.TorusGeometry(0.1 * H, 0.012 * H, 4, 10, Math.PI), { matrice: mat([s * 0.06 * H, alto * 0.62, rGiu + 0.02 * H], [0, Math.PI / 2, 0], [1, 1.25, 0.8]), colore: COLORI.cuoio });
  }
  return b.costruisci('gerla');
}

function bastone(lunghezza: number, H: number): THREE.Group {
  // bastone di castagno nodoso: il pomo in alto (y = 0, nella mano), la punta in basso
  const b = new Costruttore(32);
  b.aggiungi(new THREE.CylinderGeometry(0.012 * H, 0.009 * H, lunghezza, 6), { matrice: mat([0, -lunghezza / 2 + 0.03 * H, 0]), colore: COLORI.castagno });
  b.aggiungi(new THREE.SphereGeometry(0.018 * H, 6, 4), { matrice: mat([0, 0.035 * H, 0]), colore: COLORI.castagnoScuro });
  for (const f of [0.3, 0.62]) b.aggiungi(new THREE.SphereGeometry(0.014 * H, 5, 3), { matrice: mat([0, -lunghezza * f, 0], [0, 0, 0], [1, 0.7, 1]), colore: COLORI.castagnoScuro });
  return b.costruisci('bastone');
}

function forbici(H: number): THREE.Group {
  // forbici da sarta grandi, punta in basso, un po' aperte (tagliano)
  const b = new Costruttore(33);
  for (const s of [-1, 1]) {
    b.aggiungi(new THREE.BoxGeometry(0.012 * H, 0.17 * H, 0.004 * H), { matrice: mat([s * 0.008 * H, -0.085 * H, 0], [0, 0, s * 0.12]), colore: COLORI.ferro, piatto: true });
    b.aggiungi(new THREE.TorusGeometry(0.018 * H, 0.004 * H, 4, 10), { matrice: mat([s * 0.016 * H, 0.02 * H, 0]), colore: COLORI.ferro });
  }
  return b.costruisci('forbici');
}

/**
 * Una figura di cartone dell'Ombrista: la Santa che sale nella Linea (velata, con l'aureola), su un
 * bastoncino. Piatta, alta 0,25 m, rivolta avanti. NON l'uomo con la ruota: quello è l'indizio della
 * missione (FASE1.md §8.2), sta in fondo alla scatola e non esce mai.
 */
function cartone(H: number): THREE.Group {
  const b = new Costruttore(34);
  const s = H / 1.52; // le misure sono quelle per Pina (1,52 m)
  // la sagoma: veste a campana, testa velata, aureola; un piano a doppia faccia
  const sagoma = new THREE.Shape();
  const p: [number, number][] = [
    [-0.05, 0.0],
    [0.05, 0.0],
    [0.035, 0.08],
    [0.042, 0.13],
    [0.03, 0.16],
    [0.03, 0.19],
    [0.018, 0.215],
    [-0.018, 0.215],
    [-0.03, 0.19],
    [-0.03, 0.16],
    [-0.042, 0.13],
    [-0.035, 0.08],
  ];
  sagoma.moveTo(p[0]![0] * s, p[0]![1] * s);
  for (const [x, y] of p.slice(1)) sagoma.lineTo(x * s, y * s);
  sagoma.closePath();
  b.aggiungi(new THREE.ShapeGeometry(sagoma), { matrice: mat([0, 0.035 * s, 0]), colore: COLORI.cartone, canale: 'sottile', piatto: true });
  // l'aureola: un anello sottile dietro la testa
  b.aggiungi(new THREE.RingGeometry(0.026 * s, 0.033 * s, 14), { matrice: mat([0, 0.235 * s, -0.002 * s]), colore: 0xc9a050, canale: 'sottile', piatto: true });
  // il bastoncino che la regge
  b.aggiungi(new THREE.CylinderGeometry(0.003 * s, 0.003 * s, 0.07 * s, 4), { matrice: mat([0, 0.0, -0.003 * s]), colore: COLORI.castagnoScuro });
  return b.costruisci('figura-di-cartone');
}

function pacchetto(H: number): THREE.Group {
  const b = new Costruttore(35);
  b.aggiungi(new THREE.BoxGeometry(0.09 * H, 0.06 * H, 0.06 * H), { matrice: mat([0, -0.04 * H, 0]), colore: COLORI.canapa, piatto: true });
  for (const r of [0, Math.PI / 2]) {
    b.aggiungi(new THREE.TorusGeometry(0.037 * H, 0.0025 * H, 3, 12), { matrice: mat([0, -0.04 * H, 0], [0, r, 0], [1.2, 0.85, 1]), colore: COLORI.spago });
  }
  return b.costruisci('pacchetto');
}

/** La pietra di Nando: un sasso di 12 cm, irregolare, appoggiato sul palmo. */
function pietra(): THREE.Group {
  const g = new THREE.IcosahedronGeometry(0.065, 1);
  const pos = g.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // rumore deterministico sulla direzione: bozze e spigoli smussati
    const n = Math.sin(v.x * 61 + v.y * 37) * 0.5 + Math.sin(v.z * 53 - v.x * 29) * 0.5;
    v.multiplyScalar(1 + n * 0.12);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const b = new Costruttore(36);
  b.aggiungi(g, { matrice: mat([0, 0.04, 0], [0.3, 0.6, 0.1], [1, 0.75, 0.85]), colore: COLORI.pietra, rumore: 0.12, piatto: true });
  return b.costruisci('pietra');
}

function cesto(H: number): THREE.Group {
  const b = new Costruttore(37);
  b.aggiungi(new THREE.CylinderGeometry(0.07 * H, 0.05 * H, 0.06 * H, 12, 1, true), { matrice: mat([0, -0.13 * H, 0]), colore: COLORI.vimini, canale: 'sottile', rumore: 0.08 });
  b.aggiungi(new THREE.CircleGeometry(0.05 * H, 12), { matrice: mat([0, -0.16 * H, 0], [-Math.PI / 2, 0, 0]), colore: COLORI.viminiScuro });
  b.aggiungi(new THREE.TorusGeometry(0.06 * H, 0.005 * H, 4, 12, Math.PI), { matrice: mat([0, -0.1 * H, 0]), colore: COLORI.castagnoScuro });
  return b.costruisci('cesto');
}

/**
 * Il lume a petrolio di Ottavio: una gabbia d'ottone col vetro acceso, appesa a un gancio alla cintura,
 * dietro l'anca. Il 30% più piccolo di quello della figura procedurale.
 */
function lume(): THREE.Group {
  const b = new Costruttore(38);
  // gancio e anello in alto (y = 0: il punto d'aggancio)
  b.aggiungi(new THREE.TorusGeometry(0.012, 0.0025, 4, 10), { matrice: mat([0, -0.012, 0]), colore: COLORI.ferro });
  // cappello e fondo
  b.aggiungi(new THREE.ConeGeometry(0.032, 0.025, 8), { matrice: mat([0, -0.035, 0]), colore: COLORI.ottone });
  b.aggiungi(new THREE.CylinderGeometry(0.03, 0.034, 0.016, 8), { matrice: mat([0, -0.125, 0]), colore: COLORI.ottone });
  // il vetro acceso e le quattro sbarre della gabbia
  b.aggiungi(new THREE.CylinderGeometry(0.022, 0.024, 0.07, 8), { matrice: mat([0, -0.083, 0]), colore: COLORI.vetro, canale: 'lume' });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    b.aggiungi(new THREE.CylinderGeometry(0.0022, 0.0022, 0.08, 3), { matrice: mat([Math.cos(a) * 0.028, -0.083, Math.sin(a) * 0.028]), colore: COLORI.ottone });
  }
  return b.costruisci('lume');
}

/** Interpreta «nome@osso» (le note fra parentesi si ignorano); null se non è un oggetto noto. */
export function leggiOggetto(voce: string): { nome: NomeOggetto; osso: NomeOsso } | null {
  const m = /^([a-z-]+)@([A-Za-z]+)/.exec(voce.trim());
  if (!m) return null;
  const nome = m[1] as NomeOggetto;
  const osso = m[2] as NomeOsso;
  if (!NOMI_OGGETTI.includes(nome)) return null;
  if (!(NOMI_OSSA as readonly string[]).includes(osso)) return null;
  return { nome, osso };
}

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

/**
 * Attacca un oggetto di scena all'osso indicato («bastone@manoD», «gerla@petto»...) e lo restituisce
 * (null se la voce non è un oggetto noto). L'oggetto è dritto nel mondo nella posa attuale.
 * Basta il gruppo e l'animatore: lo usano sia caricaPersonaggio (pagine di prova) sia la fabbrica del gioco.
 */
export function attaccaOggetto(modello: Pick<ModelloPersonaggio, 'gruppo' | 'animatore'>, voce: string): THREE.Object3D | null {
  const r = leggiOggetto(voce);
  if (!r) return null;
  const a = modello.animatore;
  const H = a.altezza;
  const osso = a.ossa.get(r.osso)?.osso;
  if (!osso) return null;
  const radice = modello.gruppo;
  radice.updateMatrixWorld(true);
  // posizione voluta nello spazio del modello
  const inv = new THREE.Matrix4().copy(radice.matrixWorld).invert();
  const pos = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
  let obj: THREE.Object3D;
  const dove = new THREE.Vector3();
  if (r.nome === 'gerla') {
    obj = gerla(H);
    const petto = pos(osso);
    // dietro la schiena (retroBusto, misurato sul modello): il fondo all'altezza della vita, la bocca
    // appena sopra le spalle
    dove.set(0, petto.y - 0.2 * H, Math.min(a.retroBusto, petto.z - 0.05 * H) - (GERLA.rGiu + 0.005) * H);
    // inclinata indietro quanto basta perché il fianco verso la schiena resti verticale
    obj.rotation.x = -Math.atan2((GERLA.rSu - GERLA.rGiu) * H, GERLA.alto * H);
  } else if (r.nome === 'lume') {
    // appeso alla cintura dietro l'anca destra (dove non lo urta il braccio che oscilla)
    obj = lume();
    const b = pos(osso);
    dove.set(-0.092 * H, b.y - 0.03 * H, b.z - 0.05 * H);
    obj.userData['dondola'] = true;
  } else {
    // nelle mani: al palmo, un po' oltre il polso lungo la mano
    const polso = pos(osso);
    const figlio = osso.children.find((c) => (c as THREE.Bone).isBone);
    const punta = figlio ? pos(figlio) : polso.clone().add(new THREE.Vector3(0, -0.08 * H, 0));
    dove.copy(polso).lerp(punta, 0.55);
    if (r.nome === 'bastone') obj = bastone(dove.y + 0.04 * H, H);
    else if (r.nome === 'forbici') obj = forbici(H);
    else if (r.nome === 'figura-di-cartone') {
      obj = cartone(H);
      obj.userData['dritto'] = 'cartone';
    } else if (r.nome === 'pacchetto') obj = pacchetto(H);
    else if (r.nome === 'pietra') {
      obj = pietra();
      obj.userData['dritto'] = 'pietra';
    } else obj = cesto(H);
    if (r.nome === 'bastone') dove.z += 0.02 * H;
  }
  obj.name = `oggetto:${r.nome}`;
  obj.userData['oggettoDiScena'] = r.nome;
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = o.userData['canale'] !== 'lume';
  });
  // da spazio modello a spazio dell'osso (con la posa attuale): locale = osso⁻¹ · radice · voluto
  obj.position.copy(dove);
  obj.updateMatrix();
  _m.copy(osso.matrixWorld).invert().multiply(radice.matrixWorld).multiply(obj.matrix);
  _m.decompose(_p, _q, _s);
  obj.position.copy(_p);
  obj.quaternion.copy(_q);
  obj.scale.copy(_s);
  osso.add(obj);
  return obj;
}
