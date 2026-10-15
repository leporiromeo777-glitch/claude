/**
 * La fabbrica dei personaggi per il gioco, con la STESSA INTERFACCIA di `creaAbitante`
 * (src/oggetti/oggetti/abitante.ts):
 *
 *     creaPersonaggio(chi, opz: OpzioniAbitante): OggettoProcedurale<StatoAbitante> | null
 *
 * null se per `chi` non c'è un modello caricato (chi chiama usa `creaAbitante(opz)`).
 * Lo stesso contratto della figura procedurale:
 * - `gruppo` con y = 0 al suolo, fronte su +Z;
 * - `collider`: lo stesso cilindro 'personaggio' (stesso raggio della figura procedurale con le stesse
 *   opzioni, alto quanto il modello): la fisica non cambia;
 * - `ingombro`, `punti` (testa, manoDestra, manoSinistra e in più petto, bacino, cima);
 * - `update(dt, stato)` con modo fermo/cammina, velocita, guarda, gesto, indica; in più capisce
 *   `posa` ('in-piedi' | 'seduto' | 'chino', vedi `StatoPersonaggioGioco`), che la figura procedurale
 *   riceveva come rotazioni sulle ossa dopo l'animazione (`posaOssa` in src/popolamento/abitanti.ts).
 *
 * Prese per gli oggetti di scena: ossa `presaD`, `presaS` (sul palmo), `cintura` (sul bacino), `dorso`
 * (sul petto, dietro), con gli assi del modello a riposo: un oggetto figlio con posizione (0, 0, 0)
 * sta nel palmo, con +Y in alto e +Z avanti (come sulle ossa della figura procedurale).
 *
 * Prestazioni: LOD0 fino a 25 m, LOD1 (2000 triangoli) oltre; animazione a 30 Hz oltre 25 m,
 * 15 Hz oltre 60, 6 Hz oltre 120; oltre 230 m non si disegna né si anima (distanze in precarica.ts).
 * Nessuna allocazione per fotogramma.
 */
import * as THREE from 'three';
import { clone as cloneScheletro } from 'three/addons/utils/SkeletonUtils.js';
import { cil } from '../oggetti/comune';
import type { OpzioniAbitante, StatoAbitante } from '../oggetti/oggetti/abitante';
import { semeNumerico } from '../oggetti/rng';
import type { OggettoProcedurale } from '../oggetti/tipi';
import { AnimatorePersonaggio, type PosaCorpo, type StatoPersonaggio } from './animatore';
import { aggiornaOnda, creaMaterialePersonaggio } from './materiale';
import type { NomeOsso } from './ossa';
import { motore, personaggiDisponibili, prototipo, type PrototipoPersonaggio } from './precarica';
import { derivaProcedurale, posturaAnimatore, scegliModello } from './schede';

/** Lo stato del popolamento più la posa del corpo (che la figura procedurale riceveva sulle ossa). */
export interface StatoPersonaggioGioco extends StatoAbitante {
  posa?: PosaCorpo;
}

/** Colore del legno del bastone (sRGB). */
const LEGNO = 0x5a4030;

const _pos = new THREE.Vector3();
const _cam = new THREE.Vector3();
const _a = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const SU = new THREE.Vector3(0, 1, 0);

/** Un mulberry32 piccolo per le varianti (non tocca il generatore della figura procedurale). */
function casuale(seme: number): () => number {
  let s = seme >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Texture di un pixel (il legno del bastone usa lo stesso materiale dei personaggi). */
let pixelLegno: THREE.DataTexture | null = null;
function texturePixel(): THREE.DataTexture {
  if (pixelLegno) return pixelLegno;
  const c = new THREE.Color(LEGNO);
  const t = new THREE.DataTexture(new Uint8Array([Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), 255]), 1, 1, THREE.RGBAFormat);
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  pixelLegno = t;
  return t;
}

/**
 * Crea una presa: un osso (non dello scheletro) figlio di `padre`, nel punto `punto` dello spazio del
 * modello, con gli assi del modello a riposo. `radice` è la radice del modello (spazio del modello).
 */
function creaPresa(nome: string, padre: THREE.Object3D, radice: THREE.Object3D, punto: THREE.Vector3): THREE.Bone {
  const presa = new THREE.Bone();
  presa.name = nome;
  // matrice del padre nello spazio del modello (a riposo)
  _m.copy(radice.matrixWorld).invert().multiply(padre.matrixWorld);
  _m.invert();
  presa.position.copy(punto).applyMatrix4(_m);
  _m.decompose(_a, _q, _pos);
  presa.quaternion.copy(_q);
  padre.add(presa);
  return presa;
}

/**
 * Il personaggio per l'abitante `chi` del popolamento (id dei contenuti: 'togna', 'nando'…, oppure
 * 'velato_3' per i velati di Corbella) con le opzioni procedurali che avrebbe avuto. null se il
 * modello non è caricato.
 */
export function creaPersonaggio(chi: string, opz: OpzioniAbitante = {}): OggettoProcedurale<StatoAbitante> | null {
  const id = scegliModello(chi, opz, personaggiDisponibili());
  if (!id) return null;
  const proto = prototipo(id);
  if (!proto) return null;
  return istanza(chi, proto, opz);
}

function istanza(chi: string, proto: PrototipoPersonaggio, opz: OpzioniAbitante): OggettoProcedurale<StatoAbitante> {
  const scheda = proto.scheda;
  const der = derivaProcedurale(opz);
  const seme = semeNumerico(opz.seme ?? chi);
  const caso = casuale(seme ^ 0x5eed);
  const H0 = proto.altezza;

  // --- varianti (solo i generici: i personaggi con un nome sono come la Bibbia li vuole)
  const scala = new THREE.Vector3(1, 1, 1);
  let tinta = new THREE.Color(0xffffff);
  if (scheda.generico) {
    const larg = der.corporatura === 'robusta' ? 1.07 : der.corporatura === 'esile' ? 0.95 : 1;
    const alt = der.corporatura === 'anziana' ? 0.97 : 1;
    const sy = alt * (1 + (caso() * 2 - 1) * 0.04);
    const sx = larg * (1 + (caso() * 2 - 1) * 0.05);
    scala.set(sx, sy, sx);
    // una tinta leggera dal colore della veste procedurale (o dal seme), mai più del 22%
    const base = opz.colore !== undefined ? new THREE.Color(opz.colore) : new THREE.Color().setHSL(0.06 + caso() * 0.1, 0.35, 0.55);
    const lum = Math.max(0.2, (base.r + base.g + base.b) / 3);
    base.multiplyScalar(0.85 / lum);
    tinta = new THREE.Color(1, 1, 1).lerp(base, 0.12 + caso() * 0.1);
  }
  const H = H0 * scala.y;

  // --- la copia: scheletro proprio, geometria e texture condivise
  const copia = cloneScheletro(proto.scena);
  copia.name = `modello:${proto.id}`;
  copia.scale.copy(scala);
  const gruppo = new THREE.Group();
  gruppo.name = `personaggio:${chi}`;
  gruppo.userData['personaggio'] = proto.id;
  gruppo.add(copia);
  const lod: THREE.SkinnedMesh[] = [];
  copia.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) lod.push(o as THREE.SkinnedMesh);
  });
  lod.sort((a, b) => a.name.localeCompare(b.name));
  copia.updateMatrixWorld(true);

  // --- prese per gli oggetti di scena (prima dell'animatore: posizioni a riposo)
  const ossa = new Map<string, THREE.Bone>();
  copia.traverse((o) => {
    if ((o as THREE.Bone).isBone) ossa.set(o.name, o as THREE.Bone);
  });
  const osso = (n: NomeOsso) => ossa.get(n) as THREE.Bone;
  const inModello = (o: THREE.Object3D, out: THREE.Vector3) => out.setFromMatrixPosition(o.matrixWorld).applyMatrix4(_m.copy(copia.matrixWorld).invert());
  const palmo = (lato: 'S' | 'D') => {
    const mano = inModello(osso(`mano${lato}`), new THREE.Vector3());
    const gomito = inModello(osso(`avambraccio${lato}`), new THREE.Vector3());
    return mano.add(mano.clone().sub(gomito).setLength(0.045 * H0));
  };
  const presaD = creaPresa('presaD', osso('manoD'), copia, palmo('D'));
  const presaS = creaPresa('presaS', osso('manoS'), copia, palmo('S'));
  const bacino = inModello(osso('bacino'), new THREE.Vector3());
  creaPresa('cintura', osso('bacino'), copia, bacino.clone().setY(bacino.y + 0.02 * H0));
  const petto = inModello(osso('petto'), new THREE.Vector3());
  creaPresa('dorso', osso('petto'), copia, petto.clone().setZ(petto.z - 0.12 * H0));

  // --- animatore: postura come la figura procedurale con le stesse opzioni
  const postura = posturaAnimatore(der.postura, der.corporatura);
  const animatore = new AnimatorePersonaggio(copia, {
    apertura: scheda.apertura,
    gonna: scheda.gonna,
    sfasamento: caso() * 20,
    altezza: H0,
    fronteBusto: proto.fronteBusto,
    seme,
    curvo: postura.curvo,
    braccia: postura.braccia,
    bastone: opz.bastone ?? false,
    bambino: scheda.bambino ?? false,
  });

  // --- materiale (uno per copia: tinta e ondeggio sono suoi); passa a quello del mondo quando arrivano gli uniform
  let materiale = creaMaterialePersonaggio(motore.uniform, { mappa: proto.mappa, tinta });
  let usaMondo = !!motore.uniform;
  for (const m of lod) {
    m.material = materiale;
    m.castShadow = true;
    m.receiveShadow = false;
  }

  // --- il bastone: da terra al palmo destro, aggiornato con l'animazione
  let bastone: THREE.Mesh | null = null;
  let matBastone: THREE.Material | null = null;
  if (opz.bastone) {
    const g = new THREE.CylinderGeometry(0.016, 0.021, 1, 6, 1);
    g.translate(0, 0.5, 0); // base a 0, cima a 1
    matBastone = creaMaterialePersonaggio(motore.uniform, { mappa: texturePixel(), pennellata: 0.3 });
    bastone = new THREE.Mesh(g, matBastone);
    bastone.name = 'bastone';
    bastone.castShadow = true;
    gruppo.add(bastone);
  }
  const rifaiMateriale = () => {
    if (!motore.uniform || usaMondo) return;
    const nuovo = creaMaterialePersonaggio(motore.uniform, { mappa: proto.mappa, tinta });
    for (const m of lod) m.material = nuovo;
    materiale.dispose();
    materiale = nuovo;
    if (bastone && matBastone) {
      const nb = creaMaterialePersonaggio(motore.uniform, { mappa: texturePixel(), pennellata: 0.3 });
      bastone.material = nb;
      matBastone.dispose();
      matBastone = nb;
    }
    usaMondo = true;
  };
  motore.ascoltatori.add(rifaiMateriale);

  // --- stato per l'animatore (riusato: niente allocazioni)
  const st: StatoPersonaggio = {};
  const passa = (s: StatoAbitante | undefined) => {
    st.modo = s?.modo ?? 'fermo';
    st.velocita = s?.velocita ?? (st.modo === 'cammina' ? 1.1 : 0);
    st.guarda = s?.guarda ?? null;
    st.gesto = s?.gesto ?? 'nessuno';
    st.indica = s?.indica ?? null;
    st.posa = (s as StatoPersonaggioGioco | undefined)?.posa ?? 'in-piedi';
  };
  const ampOrlo = scheda.gonna ? 0.011 * H0 : 0;
  const cima = new THREE.Vector3();
  const piede = new THREE.Vector3();
  const anima = (dt: number, s: StatoAbitante | undefined) => {
    passa(s);
    animatore.update(dt, st);
    const sp = animatore.spostamento;
    copia.position.set(sp.x * scala.x, sp.y * scala.y, sp.z * scala.z);
    aggiornaOnda(materiale, ampOrlo, animatore.tempo, animatore.passo);
    if (bastone) {
      // cima nel palmo destro, punta a terra un po' più avanti (matrici relative al gruppo)
      copia.updateMatrixWorld(true);
      cima.setFromMatrixPosition(presaD.matrixWorld).applyMatrix4(_m.copy(gruppo.matrixWorld).invert());
      piede.set(cima.x - 0.02, 0, cima.z + 0.06);
      _a.copy(cima).sub(piede);
      const l = _a.length();
      bastone.position.copy(piede);
      bastone.quaternion.setFromUnitVectors(SU, _a.divideScalar(Math.max(l, 1e-4)));
      bastone.scale.set(1, l + 0.08, 1);
    }
  };
  anima(0, undefined);

  // --- livello di dettaglio e frequenza dell'animazione
  let livello = 0; // 0, 1 = LOD; 2 = lontano (LOD1 a 6 Hz); 3 = sparito
  let accumulo = caso() * 0.1; // sfasato: i lontani non si aggiornano tutti nello stesso fotogramma
  const mostra = (l: number) => {
    livello = l;
    gruppo.userData['livello'] = l;
    const vis = Math.min(l, 1);
    for (let i = 0; i < lod.length; i++) {
      const m = lod[i] as THREE.SkinnedMesh;
      m.visible = l < 3 && (i === vis || (lod.length === 1 && i === 0));
      m.castShadow = l < 2;
    }
    if (bastone) bastone.visible = l < 3;
  };
  mostra(0);
  const scegliLivello = (): number => {
    const cam = motore.camera;
    if (!cam) return 0;
    const e = gruppo.matrixWorld.elements;
    _pos.set(e[12] as number, e[13] as number, e[14] as number);
    const c = cam.matrixWorld.elements;
    _cam.set(c[12] as number, c[13] as number, c[14] as number);
    const d = _pos.distanceTo(_cam);
    const D = motore.distanze;
    // isteresi: si cambia livello un paio di metri oltre il confine
    const soglie = [D.lod1, D.lontano, D.sparisce];
    let l = livello;
    while (l < 3 && d > (soglie[l] as number) + 2) l++;
    while (l > 0 && d < (soglie[l - 1] as number) - 2) l--;
    return l;
  };
  /** intervallo fra due aggiornamenti dell'animazione (s) per distanza */
  const intervallo = (l: number, d: number): number => (l === 0 ? 0 : l === 1 ? (d > 60 ? 1 / 15 : 1 / 30) : 1 / 6);

  const update = (dt: number, s?: StatoAbitante) => {
    const l = scegliLivello();
    if (l !== livello) mostra(l);
    if (l === 3) {
      accumulo = Math.min(accumulo + dt, 0.25);
      return;
    }
    accumulo += dt;
    const d = l === 0 ? 0 : _pos.distanceTo(_cam);
    if (accumulo < intervallo(l, d)) return;
    anima(accumulo, s);
    accumulo = 0;
  };

  // --- punti notevoli nella posa di riposo animata (spazio del gruppo)
  gruppo.updateMatrixWorld(true);
  const inGruppo = (o: THREE.Object3D) => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).applyMatrix4(_m.copy(gruppo.matrixWorld).invert());
  const testa = inGruppo(osso('testa'));
  testa.y += (H - testa.y) * 0.42;
  const punti: Record<string, THREE.Vector3> = {
    testa,
    manoDestra: inGruppo(presaD),
    manoSinistra: inGruppo(presaS),
    petto: inGruppo(osso('petto')),
    bacino: inGruppo(osso('bacino')),
    cima: new THREE.Vector3(0, H, 0),
  };

  const raggio = Math.max(der.raggio, proto.raggio * scala.x);
  const collider = [cil(0, 0, 0, der.raggio, H, 'personaggio')];
  gruppo.userData['oggetto'] = 'personaggio';
  gruppo.userData['seme'] = seme;
  gruppo.userData['collider'] = collider;
  return {
    nome: 'personaggio',
    seme,
    gruppo,
    collider,
    appoggio: new THREE.Vector3(0, 0, 0),
    ingombro: { raggio, altezza: H, interrata: 0 },
    punti,
    update,
    dispose: () => {
      // la geometria e la texture sono del modello condiviso: si liberano solo i materiali propri
      motore.ascoltatori.delete(rifaiMateriale);
      materiale.dispose();
      matBastone?.dispose();
      bastone?.geometry.dispose();
      gruppo.removeFromParent();
    },
  };
}

/** Livello di dettaglio mostrato da un personaggio (0, 1 = LOD; 2 = lontano; 3 = sparito), per le prove. */
export function livelloPersonaggio(o: OggettoProcedurale<StatoAbitante>): number {
  return Number(o.gruppo.userData['livello'] ?? 0);
}
