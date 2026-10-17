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
 *   `posa` ('in-piedi' | 'seduto' | 'chino'), il `profilo` del suolo per sedersi e il `luogo`
 *   (vedi `StatoPersonaggioGioco`), che il popolamento passa solo ai modelli nuovi.
 *
 * Il passo segue la distanza davvero percorsa dal gruppo (niente piedi che pattinano); da seduti le vesti
 * lunghe passano ai pesi «da seduti» (gonne.ts); appeso al Velo da planata il corpo si inclina e le mani
 * vanno alla barra; a ogni battuta di dialogo (`battutaPersonaggio`) un cenno o un gesto.
 *
 * Prese per gli oggetti di scena: ossa `presaD`, `presaS` (sul palmo), `cintura` (sul bacino), `dorso`
 * (sul petto, dietro), con gli assi del modello a riposo: un oggetto figlio con posizione (0, 0, 0)
 * sta nel palmo, con +Y in alto e +Z avanti (come sulle ossa della figura procedurale).
 *
 * Prestazioni: LOD0 fino a 25 m, LOD1 (2000 triangoli) oltre; animazione a 30 Hz oltre 25 m,
 * 15 Hz oltre 60, 6 Hz oltre 120; oltre 230 m non si disegna né si anima (distanze in precarica.ts).
 * Le distanze sono quelle «viste»: con il cannocchiale o la lente (campo visivo stretto) contano come
 * più vicine. Nessuna allocazione per fotogramma.
 */
import * as THREE from 'three';
import { clone as cloneScheletro } from 'three/addons/utils/SkeletonUtils.js';
import { cil, } from '../oggetti/comune';
import { Costruttore } from '../oggetti/costruttore';
import { aggiungiAColor } from '../oggetti/integrazione';
import type { OpzioniAbitante, StatoAbitante } from '../oggetti/oggetti/abitante';
import { semeNumerico } from '../oggetti/rng';
import type { OggettoProcedurale } from '../oggetti/tipi';
import { createWorldMaterial } from '../render/worldMaterial';
import type { WorldUniforms } from '../render/uniforms';
import { AnimatorePersonaggio, type ManiSeduta, type PosaCorpo, type Seduta, type StatoPersonaggio } from './animatore';
import { aggiornaOnda, aggiornaVariante, creaMaterialePersonaggio } from './materiale';
import { attaccaOggetto, leggiOggetto } from './oggetti';
import type { NomeOsso } from './ossa';
import { motore, personaggiDisponibili, prototipo, type PrototipoPersonaggio } from './precarica';
import { derivaProcedurale, posturaAnimatore, scegliModello } from './schede';
import { CORREZIONI, sedutaDaProfilo, type ProfiloSuolo } from './sedute';

/** Lo stato del popolamento più quello che la figura procedurale riceveva sulle ossa o non riceveva affatto. */
export interface StatoPersonaggioGioco extends StatoAbitante {
  posa?: PosaCorpo;
  /** da seduti: le quote del suolo lungo la direzione in cui guarda (sedute.ts); senza, una panca di 0,45 m */
  profilo?: ProfiloSuolo | null;
  /** il luogo dei contenuti dove sta (per le correzioni di sedute.ts) */
  luogo?: string | null;
}

/** Colore del legno del bastone (sRGB). */
const LEGNO = 0x5a4030;

/**
 * La barra di comando del Velo da planata (src/popolamento/abitanti.ts, accessori(): barra orizzontale a
 * y = 1,25 m, 0,35 m davanti, larga 0,7 m), nello spazio della figura: col Velo aperto (visibile) Ottavio
 * ci tiene le mani, il corpo inclinato in avanti.
 */
export const PRESA_VELO = { S: new THREE.Vector3(0.24, 1.25, 0.35), D: new THREE.Vector3(-0.24, 1.25, 0.35) };

/** Campo visivo di riferimento per le distanze dei livelli di dettaglio (gradi, quello predefinito del gioco). */
const FOV_RIFERIMENTO = 70;

const _pos = new THREE.Vector3();
const _cam = new THREE.Vector3();
const _a = new THREE.Vector3();
const _x = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const SU = new THREE.Vector3(0, 1, 0);
const ASSE_Y = new THREE.Vector3(0, 1, 0);
const TAN_RIF = Math.tan((FOV_RIFERIMENTO * Math.PI) / 360);

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

/**
 * Gli oggetti di scena (oggetti.ts) nascono col Costruttore della libreria: colore per vertice e
 * `userData.canale`. Con gli uniform del motore passano al materiale del mondo come il resto del paese
 * (stessa luce, foschia e matita; il vetro del lume si accende di notte), con due materiali condivisi
 * da tutti (una faccia e doppia faccia). Senza motore restano i materiali della libreria.
 */
let materialiOggetti: { u: WorldUniforms; singolo: THREE.Material; doppio: THREE.Material } | null = null;
function vestiOggettoMondo(radice: THREE.Object3D): void {
  const u = motore.uniform;
  if (!u) return;
  if (materialiOggetti?.u !== u) {
    const doppio = createWorldMaterial(u, { kind: 'object', side: THREE.DoubleSide });
    doppio.name = 'personaggi-oggetti-doppio';
    const singolo = createWorldMaterial(u, { kind: 'object' });
    singolo.name = 'personaggi-oggetti';
    materialiOggetti = { u, singolo, doppio };
  }
  const mo = materialiOggetti;
  radice.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const canale = mesh.userData['canale'] as string | undefined;
    if (!canale) return;
    if (!mesh.geometry.getAttribute('aColor')) aggiungiAColor(mesh.geometry, canale === 'lume' ? 'da-colore' : 'nessuna');
    mesh.material = canale === 'sottile' ? mo.doppio : mo.singolo;
  });
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

/** La funzione `chiave` messa in userData dalla fabbrica (o dalla figura procedurale) dentro `figura`. */
function funzioneDi(figura: THREE.Object3D | null | undefined, chiave: string): ((x?: number) => void) | undefined {
  let f: ((x?: number) => void) | undefined;
  figura?.traverse((o) => {
    f ??= o.userData[chiave] as ((x?: number) => void) | undefined;
  });
  return f;
}

/**
 * Una battuta di dialogo comincia per chi è disegnato in `figura` (il gruppo dell'abitante o quello del
 * personaggio) e dura `durata` s: quasi sempre un piccolo cenno del capo, il capo che si muove appena
 * mentre parla, ogni tanto un gesto della mano libera (animatore.ts, annunciaBattuta). La figura
 * procedurale fa un cenno. Lo chiama la regia (src/regia/png.ts) a ogni battuta.
 */
export function battutaPersonaggio(figura: THREE.Object3D | null | undefined, durata?: number): void {
  funzioneDi(figura, 'battuta')?.(durata);
}

/** Il dialogo è finito: chi parlava smette (il gesto in corso esce da solo, morbido). */
export function fineBattutePersonaggio(figura: THREE.Object3D | null | undefined): void {
  funzioneDi(figura, 'fineBattute')?.();
}

/**
 * Mette via (o riprende in mano) l'oggetto di scena `nome` di chi è disegnato in `figura`: Clelia, dato il
 * pacchetto a Elvira, non lo tiene più in mano mentre se ne va. Il livello di dettaglio lo rispetta.
 */
export function ripostoOggettoPersonaggio(figura: THREE.Object3D | null | undefined, nome: string, riposto: boolean): void {
  figura?.traverse((o) => {
    if (o.userData['oggettoDiScena'] !== nome) return;
    o.userData['riposto'] = riposto;
    let livello = 0;
    for (let p = o.parent; p; p = p.parent) {
      if (typeof p.userData['livello'] === 'number') {
        livello = p.userData['livello'] as number;
        break;
      }
    }
    o.visible = !riposto && livello < 3;
  });
}

/**
 * Da che lato chi è disegnato in `figura` sta girando la testa per guardare qualcuno: un punto nel mondo
 * da quel lato (in `out`); false se non guarda nessuno o se la figura non lo sa dire. Il popolamento
 * (src/popolamento/abitanti.ts, rivolgiVerso) gira il corpo da quel lato quando chi parla è quasi dietro
 * la schiena.
 */
export function puntoSguardoPersonaggio(figura: THREE.Object3D | null | undefined, out: THREE.Vector3): boolean {
  let f: ((o: THREE.Vector3) => boolean) | undefined;
  figura?.traverse((o) => {
    f ??= o.userData['puntoSguardo'] as ((o: THREE.Vector3) => boolean) | undefined;
  });
  return f ? f(out) : false;
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
  let variante = 0;
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
    // e la variante di colore per regione (velo, giacca, gonna: materiale.ts), dal seme
    variante = seme;
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
  // le geometrie in piedi e da seduti (solo vesti lunghe), per livello di dettaglio
  const geoPiedi = lod.map((m) => m.geometry);
  const geoSeduta = lod.map((m) => proto.geometrieSedute.get(m.name) ?? m.geometry);
  let geoSedutaAttiva = false;
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
  // quanto è curvo: per i personaggi con un nome vale quello scelto dalla produzione sul modello
  // (indice.json: Annunciata 0,55, Pina 0,45...), per i generici almeno quello
  const curvo = scheda.curvo === undefined ? postura.curvo : scheda.generico ? Math.max(postura.curvo, scheda.curvo) : scheda.curvo;
  const voci = scheda.oggetti ?? [];
  const tiene = (nome: string) => voci.some((v) => leggiOggetto(v)?.nome === nome);
  const maniSeduta: ManiSeduta = tiene('forbici') ? 'forbici' : opz.bastone ? 'bastone' : 'grembo';
  const animatore = new AnimatorePersonaggio(copia, {
    apertura: scheda.apertura,
    gonna: scheda.gonna,
    sfasamento: caso() * 20,
    altezza: H0,
    fronteBusto: proto.fronteBusto,
    retroBusto: proto.retroBusto,
    seme,
    curvo,
    braccia: scheda.bracciaVietate?.includes(postura.braccia) ? 'mani-giunte' : postura.braccia,
    bastone: opz.bastone ?? false,
    bambino: scheda.bambino ?? false,
    maniSeduta,
    // la destra tiene il bastone o la pietra: i gesti li fa la sinistra
    manoDOccupata: !!opz.bastone || voci.some((v) => /@manoD/.test(v) && leggiOggetto(v)?.nome !== 'forbici'),
    // forbici e cartone (Pina): parlando gesticola solo col capo
    maniOccupate: voci.some((v) => /@manoD/.test(v)) && voci.some((v) => /@manoS/.test(v) && !/facoltativo/.test(v)),
  });
  gruppo.userData['battuta'] = (durata?: number) => animatore.annunciaBattuta(durata);
  gruppo.userData['fineBattute'] = () => animatore.fineBattute();
  gruppo.userData['puntoSguardo'] = (out: THREE.Vector3) => animatore.puntoSguardo(out);
  // per le prove e gli strumenti (tests/personaggi/posa.ts)
  gruppo.userData['animatore'] = animatore;

  // --- materiale (uno per copia: tinta, variante e ondeggio sono suoi); passa a quello del mondo quando arrivano gli uniform
  const tavolozza = scheda.tavolozza;
  let materiale = creaMaterialePersonaggio(motore.uniform, { mappa: proto.mappa, tinta, variante, ...(tavolozza ? { tavolozza } : {}) });
  let usaMondo = !!motore.uniform;
  for (const m of lod) {
    m.material = materiale;
    m.castShadow = true;
    m.receiveShadow = false;
  }

  // --- il bastone: da terra al palmo destro, aggiornato con l'animazione
  let bastone: THREE.Mesh | null = null;
  if (opz.bastone) {
    const b = new Costruttore(41);
    // base a 0, cima a 1: si allunga con la scala
    b.aggiungi(new THREE.CylinderGeometry(0.016, 0.021, 1, 6, 1).translate(0, 0.5, 0), { colore: LEGNO });
    bastone = b.mesh('bastone');
    if (bastone) {
      bastone.name = 'bastone';
      bastone.castShadow = true;
      gruppo.add(bastone);
    }
  }
  /** oggetti di scena dell'indice attaccati alle ossa (più sotto, dopo la prima posa) */
  const oggetti: THREE.Object3D[] = [];
  const dritti: THREE.Object3D[] = [];
  const rifaiMateriale = () => {
    if (!motore.uniform || usaMondo) return;
    const nuovo = creaMaterialePersonaggio(motore.uniform, { mappa: proto.mappa, tinta, variante, ...(tavolozza ? { tavolozza } : {}) });
    for (const m of lod) m.material = nuovo;
    materiale.dispose();
    materiale = nuovo;
    if (bastone) vestiOggettoMondo(bastone);
    for (const o of oggetti) vestiOggettoMondo(o);
    usaMondo = true;
  };
  motore.ascoltatori.add(rifaiMateriale);

  // --- stato per l'animatore (riusato: niente allocazioni)
  const st: StatoPersonaggio = {};
  const seduta: Seduta = { sedile: 0.45, piedi: 0, avanti: -0.12, terra: false };
  let profiloVisto: ProfiloSuolo | null | undefined;
  let sedutaCorretta: Seduta | undefined;
  let giro = 0;
  let velo: THREE.Object3D | null = null;
  let cercaVelo = 3;
  const maniVelo = { S: new THREE.Vector3(), D: new THREE.Vector3() };
  // la posizione e la direzione del gruppo all'ultimo aggiornamento (per la distanza percorsa e il giro)
  const ultimo = new THREE.Vector3();
  let haUltimo = false;
  const avanti = new THREE.Vector3();
  const avantiPrima = new THREE.Vector3();
  const su = new THREE.Vector3();
  const passa = (s: StatoAbitante | undefined, dt: number) => {
    const g = s as StatoPersonaggioGioco | undefined;
    st.modo = s?.modo ?? 'fermo';
    st.velocita = s?.velocita ?? (st.modo === 'cammina' ? 1.1 : 0);
    st.guarda = s?.guarda ?? null;
    st.gesto = s?.gesto ?? 'nessuno';
    st.indica = s?.indica ?? null;
    st.posa = g?.posa ?? 'in-piedi';
    // la distanza percorsa davvero dal gruppo, lungo la direzione in cui guarda (unità del modello), e di
    // quanto si è girato attorno al suo su (i piedi lo seguono a passi, animatore.ts)
    gruppo.updateWorldMatrix(true, false);
    _pos.setFromMatrixPosition(gruppo.matrixWorld);
    avanti.set(0, 0, 1).transformDirection(gruppo.matrixWorld);
    su.set(0, 1, 0).transformDirection(gruppo.matrixWorld);
    let percorso = -1;
    let giro = 0;
    if (haUltimo) {
      _a.copy(_pos).sub(ultimo);
      const dist = _a.length();
      // un salto (vaiA) non è un passo
      if (dist < Math.max(0.6, 3 * dt * (st.velocita ?? 1.1) + 0.05)) {
        percorso = Math.max(0, _a.dot(avanti)) / scala.z;
        _a.copy(avantiPrima).addScaledVector(su, -avantiPrima.dot(su));
        _cam.copy(avanti).addScaledVector(su, -avanti.dot(su));
        giro = Math.atan2(_x.crossVectors(_a, _cam).dot(su), _a.dot(_cam));
      } else giro = 9;
    }
    ultimo.copy(_pos);
    avantiPrima.copy(avanti);
    haUltimo = true;
    st.giro = giro;
    if (st.modo === 'cammina' && percorso >= 0) st.avanzamento = percorso;
    else delete st.avanzamento;
    // le correzioni di sedute.ts per id@luogo (solo la figura che si vede gira o cambia sedile)
    const corr = st.posa === 'seduto' && g?.luogo ? CORREZIONI[`${chi}@${g.luogo}`] : undefined;
    giro = corr?.giro ?? 0;
    // seduti: dove, dal profilo del suolo (una volta per profilo), nelle unità del modello
    if (st.posa === 'seduto') {
      const p = g?.profilo ?? null;
      if (p !== profiloVisto || corr?.seduta !== sedutaCorretta) {
        profiloVisto = p;
        sedutaCorretta = corr?.seduta;
        const sd = corr?.seduta ?? sedutaDaProfilo(p);
        // per le prove e gli strumenti: dove si è seduto (m, riferimento della figura) e su quale profilo
        gruppo.userData['seduta'] = sd;
        gruppo.userData['profilo'] = p;
        seduta.sedile = sd.sedile / scala.y;
        seduta.piedi = sd.piedi / scala.y;
        seduta.avanti = sd.avanti / scala.z;
        seduta.terra = sd.terra;
      }
      st.seduta = seduta;
    }
    // il Velo da planata (lo aggiunge il popolamento subito dopo la creazione, accessori()): cercato
    // nei primi aggiornamenti, poi mai più
    if (!velo && cercaVelo-- > 0) velo = gruppo.getObjectByName('velo-ottavio') ?? null;
    if (velo?.visible) {
      maniVelo.S.copy(PRESA_VELO.S).divide(scala);
      maniVelo.D.copy(PRESA_VELO.D).divide(scala);
      st.mani = maniVelo;
      st.volo = true;
    } else {
      st.mani = null;
      st.volo = false;
    }
  };
  const ampOrlo = scheda.gonna ? 0.011 * H0 : 0;
  const cima = new THREE.Vector3();
  const piede = new THREE.Vector3();
  const anima = (dt: number, s: StatoAbitante | undefined) => {
    passa(s, dt);
    animatore.update(dt, st);
    const sp = animatore.spostamento;
    copia.position.set(sp.x * scala.x, sp.y * scala.y, sp.z * scala.z);
    copia.rotation.y = (giro * Math.PI) / 180;
    if (giro) copia.position.applyAxisAngle(ASSE_Y, copia.rotation.y);
    // da seduti la veste lunga passa ai pesi da seduti (gonne.ts)
    const vuoleSeduta = animatore.sedutoPeso > 0.5;
    if (vuoleSeduta !== geoSedutaAttiva) {
      geoSedutaAttiva = vuoleSeduta;
      for (let i = 0; i < lod.length; i++) (lod[i] as THREE.SkinnedMesh).geometry = (vuoleSeduta ? geoSeduta[i] : geoPiedi[i]) as THREE.BufferGeometry;
    }
    aggiornaOnda(materiale, ampOrlo * (1 - animatore.sedutoPeso), animatore.tempo, animatore.passo);
    if (bastone || dritti.length) copia.updateMatrixWorld(true);
    if (bastone) {
      // cima nel palmo destro, punta a terra un po' più avanti (matrici relative al gruppo); da seduti
      // il suolo è quello dei piedi
      cima.setFromMatrixPosition(presaD.matrixWorld).applyMatrix4(_m.copy(gruppo.matrixWorld).invert());
      const suolo = (st.posa === 'seduto' ? seduta.piedi * scala.y : 0) * animatore.sedutoPeso;
      piede.set(cima.x - 0.02, suolo, cima.z + 0.06);
      _a.copy(cima).sub(piede);
      const l = _a.length();
      bastone.position.copy(piede);
      bastone.quaternion.setFromUnitVectors(SU, _a.divideScalar(Math.max(l, 1e-4)));
      bastone.scale.set(1, l + 0.08, 1);
    }
    // il cartone e la pietra restano dritti rispetto alla figura (il cartone rivolto avanti, un po' indietro)
    for (const o of dritti) {
      const padre = o.parent;
      if (!padre) continue;
      gruppo.getWorldQuaternion(_q);
      if (o.userData['dritto'] === 'cartone') _q2.setFromAxisAngle(_a.set(1, 0, 0), -0.25);
      else _q2.identity();
      _q.multiply(_q2);
      padre.getWorldQuaternion(_q2).invert();
      o.quaternion.copy(_q2).multiply(_q);
      if (o.userData['dritto'] === 'cartone') {
        // e sporge davanti alla mano (6% dell'altezza, verso chi guarda): in grembo o col braccio giù
        // altrimenti la nasconde il mantello
        const base = (o.userData['base'] ??= o.position.clone()) as THREE.Vector3;
        padre.localToWorld(_a.copy(base));
        gruppo.getWorldQuaternion(_q);
        _a.add(_pos.set(0, 0.02 * H, 0.06 * H).applyQuaternion(_q));
        o.position.copy(padre.worldToLocal(_a));
      }
    }
  };
  anima(0, undefined);

  // --- oggetti di scena dell'indice (oggetti.ts), attaccati nella posa di riposo appena calcolata.
  // Il bastone lo fa già questa fabbrica (da terra al palmo, con `opz.bastone`, come la figura
  // procedurale); la gerla solo a chi l'aveva (`opz.gerla`: il generico con la gerla veste anche chi ha
  // solo il cappello); il cesto facoltativo a metà delle donne velate, se hanno le mani libere.
  for (const voce of voci) {
    const r = leggiOggetto(voce);
    if (!r || r.nome === 'bastone') continue;
    if (r.nome === 'gerla' && !opz.gerla) continue;
    if (r.nome === 'cesto' && (postura.braccia !== 'libere' || caso() < 0.5)) continue;
    const o = attaccaOggetto({ gruppo, animatore }, voce);
    if (!o) continue;
    oggetti.push(o);
    if (o.userData['dritto']) dritti.push(o);
  }
  if (bastone) vestiOggettoMondo(bastone);
  for (const o of oggetti) vestiOggettoMondo(o);

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
    aggiornaVariante(materiale, l);
    if (bastone) bastone.visible = l < 3;
    // (un oggetto «messo via», ripostoOggettoPersonaggio, resta nascosto)
    for (const o of oggetti) o.visible = l < 3 && !o.userData['riposto'];
  };
  mostra(0);
  /** la distanza «vista» dalla camera: con un campo visivo stretto (cannocchiale, lente) conta di meno */
  let distanzaVista = 0;
  const scegliLivello = (): number => {
    const cam = motore.camera;
    if (!cam) return 0;
    const e = gruppo.matrixWorld.elements;
    _pos.set(e[12] as number, e[13] as number, e[14] as number);
    const c = cam.matrixWorld.elements;
    _cam.set(c[12] as number, c[13] as number, c[14] as number);
    let d = _pos.distanceTo(_cam);
    const pc = cam as THREE.PerspectiveCamera;
    if (pc.isPerspectiveCamera) d *= Math.tan((pc.fov * Math.PI) / 360) / TAN_RIF;
    distanzaVista = d;
    const D = motore.distanze;
    // isteresi: si cambia livello un paio di metri oltre il confine
    const soglie = [D.lod1, D.lontano, D.sparisce];
    let l = livello;
    while (l < 3 && d > (soglie[l] as number) + 2) l++;
    while (l > 0 && d < (soglie[l - 1] as number) - 2) l--;
    return l;
  };
  /** intervallo fra due aggiornamenti dell'animazione (s) per distanza vista */
  const intervallo = (l: number, d: number): number => (l === 0 ? 0 : l === 1 ? (d > 60 ? 1 / 15 : 1 / 30) : 1 / 6);

  const update = (dt: number, s?: StatoAbitante) => {
    const l = scegliLivello();
    if (l !== livello) mostra(l);
    if (l === 3) {
      accumulo = Math.min(accumulo + dt, 0.25);
      return;
    }
    accumulo += dt;
    if (accumulo < intervallo(l, distanzaVista)) return;
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
      // la geometria e la texture sono del modello condiviso: si liberano i materiali propri e gli scheletri
      motore.ascoltatori.delete(rifaiMateriale);
      materiale.dispose();
      for (const m of lod) m.skeleton.dispose();
      bastone?.geometry.dispose();
      // gli oggetti di scena: geometrie proprie, materiali condivisi (della libreria o del mondo)
      for (const o of oggetti) o.traverse((x) => (x as THREE.Mesh).geometry?.dispose());
      delete gruppo.userData['battuta'];
      delete gruppo.userData['fineBattute'];
      delete gruppo.userData['puntoSguardo'];
      gruppo.removeFromParent();
    },
  };
}

/**
 * Prepara la GPU prima di giocare: carica le texture dei modelli e compila il materiale dei personaggi
 * con una copia di prova, così il primo personaggio che entra in vista non fa scattare il gioco.
 */
export function preriscaldaPersonaggi(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
  const ids = [...personaggiDisponibili()];
  for (const id of ids) {
    const m = prototipo(id)?.mappa;
    if (m) renderer.initTexture(m);
  }
  const primo = ids[0];
  if (!primo) return;
  const prova = creaPersonaggio(primo, { seme: 'preriscalda' });
  if (!prova) return;
  const scena = new THREE.Scene();
  scena.add(prova.gruppo);
  renderer.compile(scena, camera);
  scena.remove(prova.gruppo);
  // la copia di prova resta (fuori scena): il suo materiale tiene vivo il programma compilato, che
  // altrimenti three libererebbe e ricompilerebbe al primo personaggio vero
  preriscaldo?.dispose();
  preriscaldo = prova;
}
let preriscaldo: OggettoProcedurale<StatoAbitante> | null = null;

/** Livello di dettaglio mostrato da un personaggio (0, 1 = LOD; 2 = lontano; 3 = sparito), per le prove. */
export function livelloPersonaggio(o: OggettoProcedurale<StatoAbitante>): number {
  return Number(o.gruppo.userData['livello'] ?? 0);
}
