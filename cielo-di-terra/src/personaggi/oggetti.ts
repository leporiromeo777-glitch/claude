/**
 * Oggetti di scena dei personaggi generati: le cose tenute in mano o portate sulla schiena, che la
 * pipeline lascia fuori dal modello (sam_3_3d le butta, un bastone che tocca terra lega la mano al suolo
 * nei pesi, la gerla deve poter essere vuota o carica). Sono figure procedurali semplici attaccate a
 * un osso: seguono l'animazione senza pesi propri.
 *
 *   const m = await caricaPersonaggio(url, opz);
 *   m.update(0, { curvo: voce.curvo });          // la posa di riposo (braccia abbassate)
 *   for (const o of voce.oggetti) attaccaOggetto(m, o);   // «bastone@manoD», «gerla@petto»...
 *
 * L'oggetto si piazza rispetto alla posa che lo scheletro ha in quel momento (il bastone è verticale e
 * tocca terra con le braccia giù): va attaccato dopo il primo update.
 */
import * as THREE from 'three';
import type { ModelloPersonaggio } from './carica';
import { NOMI_OSSA, type NomeOsso } from './ossa';

export type NomeOggetto = 'gerla' | 'bastone' | 'forbici' | 'figura-di-cartone' | 'pacchetto' | 'pietra' | 'cesto';

const COLORI = {
  castagno: 0x7a5232,
  castagnoScuro: 0x4b3322,
  vimini: 0x9a6a3c,
  cuoio: 0x6e4b33,
  ferro: 0x6d6a6e,
  cartone: 0xb8894a,
  canapa: 0xd9c9a6,
  spago: 0xb59b6a,
  pietra: 0x938c94,
};

// un materiale per colore, condiviso da tutti gli oggetti di scena di tutti i personaggi
const materiali = new Map<string, THREE.Material>();
function materiale(colore: number, doppio = false): THREE.Material {
  const chiave = `${colore}:${doppio}`;
  let m = materiali.get(chiave);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: colore, side: doppio ? THREE.DoubleSide : THREE.FrontSide });
    materiali.set(chiave, m);
  }
  return m;
}

/** misure della gerla in frazioni dell'altezza del personaggio */
const GERLA = { alto: 0.34, rSu: 0.11, rGiu: 0.065 };

function gerla(H: number): THREE.Group {
  // cesta conica di castagno intrecciato, aperta in alto, con due spallacci di cuoio
  const g = new THREE.Group();
  const alto = GERLA.alto * H;
  const rSu = GERLA.rSu * H;
  const rGiu = GERLA.rGiu * H;
  const cesta = new THREE.Mesh(new THREE.CylinderGeometry(rSu, rGiu, alto, 14, 5, true), materiale(COLORI.vimini, true));
  cesta.position.y = alto / 2;
  g.add(cesta);
  // cerchi di rinforzo e il fondo
  for (const [y, r] of [
    [alto, rSu],
    [alto * 0.55, rGiu + (rSu - rGiu) * 0.55],
    [0.01 * H, rGiu],
  ] as const) {
    const anello = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008 * H, 5, 18), materiale(COLORI.castagnoScuro));
    anello.rotation.x = Math.PI / 2;
    anello.position.y = y;
    g.add(anello);
  }
  const fondo = new THREE.Mesh(new THREE.CircleGeometry(rGiu, 14), materiale(COLORI.castagnoScuro));
  fondo.rotation.x = Math.PI / 2;
  g.add(fondo);
  // spallacci: due archi davanti alla cesta (verso il corpo, +Z)
  for (const s of [-1, 1]) {
    const sp = new THREE.Mesh(new THREE.TorusGeometry(0.1 * H, 0.012 * H, 4, 10, Math.PI), materiale(COLORI.cuoio));
    sp.rotation.y = Math.PI / 2;
    sp.position.set(s * 0.06 * H, alto * 0.62, rGiu + 0.02 * H);
    sp.scale.set(1, 1.25, 0.8);
    g.add(sp);
  }
  return g;
}

function bastone(lunghezza: number, H: number): THREE.Group {
  // bastone di castagno nodoso: il pomo in alto (y = 0, nella mano), la punta in basso
  const g = new THREE.Group();
  const asta = new THREE.Mesh(new THREE.CylinderGeometry(0.012 * H, 0.009 * H, lunghezza, 6), materiale(COLORI.castagno));
  asta.position.y = -lunghezza / 2 + 0.03 * H;
  g.add(asta);
  const pomo = new THREE.Mesh(new THREE.SphereGeometry(0.018 * H, 6, 4), materiale(COLORI.castagnoScuro));
  pomo.position.y = 0.035 * H;
  g.add(pomo);
  for (const f of [0.3, 0.62]) {
    const nodo = new THREE.Mesh(new THREE.SphereGeometry(0.014 * H, 5, 3), materiale(COLORI.castagnoScuro));
    nodo.position.y = -lunghezza * f;
    nodo.scale.set(1, 0.7, 1);
    g.add(nodo);
  }
  return g;
}

function forbici(H: number): THREE.Group {
  // forbici da sarta grandi, punta in basso
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const lama = new THREE.Mesh(new THREE.BoxGeometry(0.012 * H, 0.17 * H, 0.004 * H), materiale(COLORI.ferro));
    lama.position.set(s * 0.006 * H, -0.085 * H, 0);
    lama.rotation.z = s * 0.06;
    g.add(lama);
    const occhio = new THREE.Mesh(new THREE.TorusGeometry(0.018 * H, 0.004 * H, 4, 10), materiale(COLORI.ferro));
    occhio.position.set(s * 0.016 * H, 0.02 * H, 0);
    g.add(occhio);
  }
  return g;
}

function cartone(H: number): THREE.Group {
  // figura di cartone ocra: un omino con una ruota, su un bastoncino
  const g = new THREE.Group();
  const m = materiale(COLORI.cartone, true);
  const corpo = new THREE.Mesh(new THREE.PlaneGeometry(0.05 * H, 0.09 * H), m);
  corpo.position.y = 0.11 * H;
  const testa = new THREE.Mesh(new THREE.CircleGeometry(0.02 * H, 10), m);
  testa.position.y = 0.175 * H;
  const ruota = new THREE.Mesh(new THREE.RingGeometry(0.02 * H, 0.032 * H, 14), m);
  ruota.position.set(0.05 * H, 0.09 * H, 0);
  const asta = new THREE.Mesh(new THREE.CylinderGeometry(0.003 * H, 0.003 * H, 0.08 * H, 4), materiale(COLORI.castagnoScuro));
  asta.position.y = 0.03 * H;
  g.add(corpo, testa, ruota, asta);
  return g;
}

function pacchetto(H: number): THREE.Group {
  const g = new THREE.Group();
  const scatola = new THREE.Mesh(new THREE.BoxGeometry(0.09 * H, 0.06 * H, 0.06 * H), materiale(COLORI.canapa));
  scatola.position.y = -0.04 * H;
  g.add(scatola);
  for (const r of [0, Math.PI / 2]) {
    const spago = new THREE.Mesh(new THREE.TorusGeometry(0.037 * H, 0.0025 * H, 3, 12), materiale(COLORI.spago));
    spago.position.y = -0.04 * H;
    spago.rotation.y = r;
    spago.scale.set(1.2, 0.85, 1);
    g.add(spago);
  }
  return g;
}

function pietra(H: number): THREE.Group {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.DodecahedronGeometry(0.045 * H, 0), materiale(COLORI.pietra));
  p.scale.set(1.3, 0.45, 1);
  p.position.y = -0.03 * H;
  g.add(p);
  return g;
}

function cesto(H: number): THREE.Group {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * H, 0.05 * H, 0.06 * H, 12, 1, true), materiale(COLORI.vimini, true));
  c.position.y = -0.13 * H;
  const manico = new THREE.Mesh(new THREE.TorusGeometry(0.06 * H, 0.005 * H, 4, 12, Math.PI), materiale(COLORI.castagnoScuro));
  manico.position.y = -0.1 * H;
  g.add(c, manico);
  return g;
}

/** Interpreta «nome@osso» (le note fra parentesi si ignorano); null se non è un oggetto noto. */
export function leggiOggetto(voce: string): { nome: NomeOggetto; osso: NomeOsso } | null {
  const m = /^([a-z-]+)@([A-Za-z]+)/.exec(voce.trim());
  if (!m) return null;
  const nome = m[1] as NomeOggetto;
  const osso = m[2] as NomeOsso;
  if (!['gerla', 'bastone', 'forbici', 'figura-di-cartone', 'pacchetto', 'pietra', 'cesto'].includes(nome)) return null;
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
    // dietro la schiena: il fondo all'altezza della vita, la bocca appena sopra le spalle; la schiena
    // è dietro il petto quanto il davanti del busto gli sta avanti (fronteBusto, misurato sul modello)
    const mezzo = THREE.MathUtils.clamp(a.fronteBusto - petto.z, 0.05 * H, 0.14 * H);
    dove.set(0, petto.y - 0.2 * H, petto.z - mezzo - (GERLA.rGiu + 0.005) * H);
    // inclinata indietro quanto basta perché il fianco verso la schiena resti verticale
    obj.rotation.x = -Math.atan2((GERLA.rSu - GERLA.rGiu) * H, GERLA.alto * H);
  } else {
    // nelle mani: al palmo, un po' oltre il polso lungo la mano
    const polso = pos(osso);
    const figlio = osso.children.find((c) => (c as THREE.Bone).isBone);
    const punta = figlio ? pos(figlio) : polso.clone().add(new THREE.Vector3(0, -0.08 * H, 0));
    dove.copy(polso).lerp(punta, 0.55);
    if (r.nome === 'bastone') obj = bastone(dove.y + 0.04 * H, H);
    else if (r.nome === 'forbici') obj = forbici(H);
    else if (r.nome === 'figura-di-cartone') obj = cartone(H);
    else if (r.nome === 'pacchetto') obj = pacchetto(H);
    else if (r.nome === 'pietra') obj = pietra(H);
    else obj = cesto(H);
    if (r.nome === 'bastone') dove.z += 0.02 * H;
  }
  obj.name = `oggetto:${r.nome}`;
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
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
