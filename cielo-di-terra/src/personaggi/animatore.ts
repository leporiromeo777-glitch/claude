/**
 * Animazione procedurale dello scheletro dei personaggi generati (vedi ossa.ts): niente clip, solo
 * rotazioni calcolate a ogni fotogramma, come per gli abitanti procedurali (update(dt, stato)).
 *
 * Le rotazioni si scrivono nello SPAZIO DEL MODELLO (X = sinistra del personaggio, Y = alto,
 * Z = avanti), indipendenti dal rollio delle ossa esportate da Blender:
 *     osso.quaternion = riposo · W⁻¹ · R · W
 * dove W è l'orientamento di riposo dell'osso nello spazio del modello. Così R ruota l'osso attorno
 * al suo attacco come se il padre fosse a riposo, e la catena (braccio → avambraccio → mano) si
 * compone da sola: il mondo dell'osso figlio è R_padre · R_figlio · W_figlio.
 *
 * Segni utili (spazio del modello):
 *  - Rx(+) piega in avanti la schiena e la testa, porta INDIETRO coscia e braccio, piega il ginocchio;
 *  - Rx(-) porta avanti coscia, braccio e avambraccio (la mano verso +Z);
 *  - Rz(-) abbassa il braccio S (sinistro), Rz(+) abbassa il braccio D;
 *  - Ry(+) gira la testa verso la propria sinistra (+X).
 *
 * Nessuna allocazione per fotogramma: vettori e quaternioni di lavoro sono del modulo.
 */
import * as THREE from 'three';
import { NOMI_OSSA, type NomeOsso } from './ossa';

export type GestoPersonaggio = 'nessuno' | 'saluta' | 'indica' | 'mano-al-petto';
export type PosaBraccia = 'libere' | 'mani-giunte' | 'braccia-conserte' | 'mani-dietro';
/** Posa del corpo, come quella del popolamento (`PosaNpc`): in piedi, seduto, chino sul lavoro. */
export type PosaCorpo = 'in-piedi' | 'seduto' | 'chino';

export interface StatoPersonaggio {
  /** 'fermo' (respiro, peso che si sposta) o 'cammina' (passo sul posto: lo spostamento lo fa il motore) */
  modo?: 'fermo' | 'cammina';
  /** velocità di camminata in m/s (cadenza e ampiezza del passo) */
  velocita?: number;
  /** punto da guardare in coordinate MONDO (null = avanti) */
  guarda?: THREE.Vector3 | null;
  gesto?: GestoPersonaggio;
  /** per 'indica': punto in coordinate mondo */
  indica?: THREE.Vector3 | null;
  /** 0..1: quanto sta curvo (anziani; Togna china sulla vasca = 1); se manca vale quello delle opzioni */
  curvo?: number;
  /** posa delle braccia da fermi (come la «postura» degli abitanti procedurali); se manca, quella delle opzioni */
  braccia?: PosaBraccia;
  /** in piedi (predefinito), seduto (bacino a 0,5 m dall'origine, come la figura procedurale), chino */
  posa?: PosaCorpo;
}

export interface OpzioniAnimatore {
  /** apertura delle braccia a riposo, in gradi dalla verticale (abbastanza da non entrare nei fianchi) */
  apertura?: number;
  /** veste lunga: passo più corto, ginocchia meno piegate, seduta più composta */
  gonna?: boolean;
  /** sfasamento (s) del respiro e degli sguardi, per non avere tutti all'unisono */
  sfasamento?: number;
  /** altezza del personaggio in m (se manca, stimata dall'attacco della testa) */
  altezza?: number;
  /** z (m) della superficie davanti al petto, nello spazio del modello: dove appoggiare le mani */
  fronteBusto?: number;
  /** seme del carattere: ritmo del respiro, sguardi, ampiezza del passo, piccole asimmetrie (senza: neutro) */
  seme?: number;
  /** quanto è curvo quando lo stato non lo dice (anziani) */
  curvo?: number;
  /** posa delle braccia quando lo stato non la dice */
  braccia?: PosaBraccia;
  /** porta un bastone nella mano destra: da fermo la mano lo tiene avanti, all'altezza del fianco */
  bastone?: boolean;
  /** bambino: passo più rapido, respiro più veloce, sguardi più vivaci */
  bambino?: boolean;
}

/** Il «carattere» del movimento, dal seme: ritmi e ampiezze un po' diversi per ognuno. */
export interface Carattere {
  /** periodo del respiro (s) */
  respiro: number;
  /** periodo dello spostamento del peso (s) e sua ampiezza relativa */
  peso: number;
  pesoAmp: number;
  /** frequenza e ampiezza (gradi) degli sguardi distratti */
  sguardoF: number;
  sguardoAmp: number;
  /** oscillazione delle braccia nel passo (gradi) */
  oscilla: number;
  /** lunghezza relativa del passo */
  passo: number;
  /** inclinazione abituale della testa (gradi, Rz) e spalle avanti (gradi) */
  inclina: number;
  spalle: number;
  /** apertura delle braccia in più o in meno (gradi) */
  apertura: number;
}

const NEUTRO: Carattere = { respiro: 4.2, peso: 9, pesoAmp: 1, sguardoF: 1, sguardoAmp: 14, oscilla: 16, passo: 1, inclina: 0, spalle: 0, apertura: 0 };

/** Il carattere di un seme (mulberry32): deterministico, uguale su ogni macchina. */
export function carattereDa(seme: number | undefined, bambino = false): Carattere {
  if (seme === undefined) return bambino ? { ...NEUTRO, respiro: 3.2, sguardoF: 1.5, passo: 0.95 } : { ...NEUTRO };
  let s = seme >>> 0;
  const r = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const tra = (a: number, b: number) => a + (b - a) * r();
  return {
    respiro: bambino ? tra(2.8, 3.6) : tra(3.6, 4.9),
    peso: tra(7, 11.5),
    pesoAmp: tra(0.7, 1.35),
    sguardoF: (bambino ? 1.5 : 1) * tra(0.8, 1.25),
    sguardoAmp: tra(10, 19),
    oscilla: tra(12, 20),
    passo: tra(0.94, 1.06),
    inclina: tra(-3.5, 3.5),
    spalle: tra(-1.5, 4),
    apertura: tra(-1.5, 2),
  };
}

const DEG = Math.PI / 180;
const _q = new THREE.Quaternion();
const _r = new THREE.Quaternion();
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _bersaglio = new THREE.Vector3();
const _d1 = new THREE.Vector3();
const _d2 = new THREE.Vector3();
const _D = new THREE.Vector3();
const _n = new THREE.Vector3();
const _gomito = new THREE.Vector3();
const _polso = new THREE.Vector3();
const _m = new THREE.Matrix4();
const IDENTITA = new THREE.Quaternion();

interface Osso {
  nome: NomeOsso;
  osso: THREE.Bone;
  riposo: THREE.Quaternion;
  /** orientamento di riposo nello spazio del modello e il suo inverso */
  W: THREE.Quaternion;
  Winv: THREE.Quaternion;
  /** attacco a riposo nello spazio del modello */
  attacco: THREE.Vector3;
  /** rotazione richiesta in questo fotogramma (spazio del modello) */
  R: THREE.Quaternion;
}

const smorza = (attuale: number, bersaglio: number, k: number, dt: number) => bersaglio + (attuale - bersaglio) * Math.exp(-k * dt);

/** Nomi delle ossa per lato (niente stringhe composte a ogni fotogramma). */
const LATO = {
  S: { lato: 'S', braccio: 'braccioS', avambraccio: 'avambraccioS', mano: 'manoS', coscia: 'cosciaS', stinco: 'stincoS', piede: 'piedeS', segno: 1 },
  D: { lato: 'D', braccio: 'braccioD', avambraccio: 'avambraccioD', mano: 'manoD', coscia: 'cosciaD', stinco: 'stincoD', piede: 'piedeD', segno: -1 },
} as const;
const LATI = [LATO.S, LATO.D] as const;

export class AnimatorePersonaggio {
  readonly radice: THREE.Object3D;
  readonly ossa = new Map<NomeOsso, Osso>();
  private readonly lista: Osso[] = [];
  /** altezza a riposo (cima della testa), per le ampiezze */
  readonly altezza: number;
  /** z della superficie del petto (per le mani) */
  readonly fronteBusto: number;
  readonly carattere: Carattere;
  private readonly opz: { apertura: number; gonna: boolean; sfasamento: number; curvo: number; braccia: PosaBraccia; bastone: boolean; bambino: boolean };
  private t = 0;
  private fase = 0;
  /** 0 = fermo, 1 = cammina (sfuma fra i due) */
  private cammino = 0;
  private velocita = 0;
  private yaw = 0;
  private pitch = 0;
  private gestoPeso = 0;
  /** peso della posa delle braccia (sfuma col cammino e con i gesti) */
  private posaPeso = 0;
  private posaAttiva: PosaBraccia = 'libere';
  private gestoAttivo: GestoPersonaggio = 'nessuno';
  private curvo = 0;
  private seduto = 0;
  private chino = 0;
  /**
   * spostamento del modello (m, nello spazio del suo genitore) da applicare alla radice dopo `update`:
   * y = abbassamento del bacino nel passo e nella seduta, z = indietro da seduti
   */
  readonly spostamento = new THREE.Vector3();
  private readonly abbassaBracciaS: number;
  private readonly abbassaBracciaD: number;
  private readonly dirBraccioD = new THREE.Vector3();
  /** quota dell'attacco delle cosce a riposo (per la seduta) */
  private readonly yAnche: number;

  constructor(radice: THREE.Object3D, opz: OpzioniAnimatore = {}) {
    this.radice = radice;
    this.carattere = carattereDa(opz.seme, opz.bambino ?? false);
    this.opz = {
      apertura: (opz.apertura ?? 9) + this.carattere.apertura,
      gonna: opz.gonna ?? false,
      sfasamento: opz.sfasamento ?? 0,
      curvo: opz.curvo ?? 0,
      braccia: opz.braccia ?? 'libere',
      bastone: opz.bastone ?? false,
      bambino: opz.bambino ?? false,
    };
    this.t = this.opz.sfasamento;
    this.curvo = this.opz.curvo;
    radice.updateMatrixWorld(true);
    const radiceInv = new THREE.Quaternion();
    radice.getWorldQuaternion(radiceInv).invert();
    const radiceMatInv = _m.copy(radice.matrixWorld).invert();
    const trovate = new Map<string, THREE.Bone>();
    radice.traverse((o) => {
      if ((o as THREE.Bone).isBone && !trovate.has(o.name)) trovate.set(o.name, o as THREE.Bone);
    });
    for (const nome of NOMI_OSSA) {
      const osso = trovate.get(nome);
      if (!osso) throw new Error(`personaggio senza l'osso «${nome}»`);
      const W = osso.getWorldQuaternion(new THREE.Quaternion()).premultiply(radiceInv);
      const attacco = osso.getWorldPosition(new THREE.Vector3()).applyMatrix4(radiceMatInv);
      const o: Osso = { nome, osso, riposo: osso.quaternion.clone(), W, Winv: W.clone().invert(), attacco, R: new THREE.Quaternion() };
      this.ossa.set(nome, o);
      this.lista.push(o);
    }
    const testa = this.o('testa');
    // la cima: l'attacco della testa più la sua lunghezza (le ossa finali non hanno figli: stimata)
    this.altezza = opz.altezza ?? testa.attacco.y / 0.87;
    this.fronteBusto = opz.fronteBusto ?? this.o('petto').attacco.z + 0.1 * this.altezza;
    this.yAnche = (this.o('cosciaS').attacco.y + this.o('cosciaD').attacco.y) / 2;
    // quanto abbassare le braccia dalla posa ad A (gradi), misurato dall'osso del braccio
    const ang = (n: 'S' | 'D') => {
      const a = this.o(LATO[n].braccio).attacco;
      const b = this.o(LATO[n].avambraccio).attacco;
      return Math.atan2(Math.abs(b.x - a.x), a.y - b.y);
    };
    const ap = this.opz.apertura * DEG;
    this.abbassaBracciaS = Math.max(0, ang('S') - ap);
    this.abbassaBracciaD = Math.max(0, ang('D') - ap);
    this.dirBraccioD.copy(this.o('avambraccioD').attacco).sub(this.o('braccioD').attacco).normalize();
  }

  /** abbassamento del bacino (m): la y di `spostamento` (compatibilità con il pilota) */
  get abbassamento(): number {
    return this.spostamento.y;
  }

  /** quanto cammina (0..1), per chi deve far ondeggiare l'orlo */
  get passo(): number {
    return this.cammino;
  }

  /** tempo interno (s, con lo sfasamento) */
  get tempo(): number {
    return this.t;
  }

  /** l'attacco a riposo di un osso, nello spazio del modello */
  attacco(nome: NomeOsso): THREE.Vector3 {
    return this.o(nome).attacco;
  }

  private o(nome: NomeOsso): Osso {
    return this.ossa.get(nome) as Osso;
  }

  /** Aggiunge (in coda) una rotazione in spazio modello all'osso: prima Z, poi X, poi Y. */
  private ruota(nome: NomeOsso, rx: number, ry = 0, rz = 0): void {
    const o = this.ossa.get(nome) as Osso;
    _e.set(rx, ry, rz, 'YXZ');
    _r.setFromEuler(_e);
    o.R.premultiply(_r);
  }

  update(dt: number, stato: StatoPersonaggio = {}): void {
    // fino a un quarto di secondo: chi è lontano si aggiorna di rado (vedi fabbrica.ts)
    const d = Math.min(Math.max(dt, 0), 0.25);
    this.t += d;
    const t = this.t;
    const H = this.altezza;
    const C = this.carattere;
    for (const o of this.lista) o.R.identity();

    // --- stati che sfumano
    const camminaOra = stato.modo === 'cammina' ? 1 : 0;
    const posaCorpo = camminaOra ? 'in-piedi' : (stato.posa ?? 'in-piedi');
    this.cammino = smorza(this.cammino, camminaOra, 6, d);
    this.velocita = smorza(this.velocita, stato.velocita ?? (camminaOra ? 1.1 : 0), 4, d);
    this.curvo = smorza(this.curvo, stato.curvo ?? this.opz.curvo, 3, d);
    this.seduto = smorza(this.seduto, posaCorpo === 'seduto' ? 1 : 0, 5, d);
    this.chino = smorza(this.chino, posaCorpo === 'chino' ? 1 : 0, 3.5, d);
    const posa = stato.braccia ?? this.opz.braccia;
    if (posa !== this.posaAttiva && this.posaPeso < 0.02) this.posaAttiva = posa;
    this.posaPeso = smorza(this.posaPeso, posa === this.posaAttiva && posa !== 'libere' && stato.modo !== 'cammina' ? 1 : 0, 4, d);
    const gesto = stato.gesto ?? 'nessuno';
    if (gesto !== this.gestoAttivo && this.gestoPeso < 0.02) this.gestoAttivo = gesto;
    this.gestoPeso = smorza(this.gestoPeso, gesto === this.gestoAttivo && gesto !== 'nessuno' ? 1 : 0, 7, d);

    const k = this.cammino;
    const fermo = 1 - k;
    const sd = this.seduto;
    const ch = this.chino;
    const inPiedi = (1 - sd) * (1 - ch);

    // --- passo: lunghezza del passo ~0.4 H, un ciclo = due passi
    const passo = (this.opz.gonna ? 0.32 : 0.4) * H * C.passo * (this.opz.bambino ? 0.92 : 1);
    const v = Math.max(this.velocita, 0.3);
    this.fase += d * k * (v / (2 * passo)) * Math.PI * 2;
    const f = this.fase;
    const s = Math.sin(f);
    const c = Math.cos(f);
    const amp = Math.min(1, v / 1.2) * k;
    const aCoscia = (this.opz.gonna ? 17 : 24) * DEG * amp;
    const aGinocchio = (this.opz.gonna ? 28 : 40) * DEG * amp;
    for (const L of LATI) {
      const sl = s * L.segno;
      const cl = c * L.segno;
      const coscia = -aCoscia * sl; // sl > 0: gamba avanti
      // il ginocchio si piega nella fase di volo (la gamba avanza: cl > 0) e un poco all'appoggio
      const ginocchio = aGinocchio * Math.max(0, cl) ** 1.5 + 4 * DEG * amp;
      this.ruota(L.coscia, coscia);
      this.ruota(L.stinco, ginocchio);
      // il piede resta quasi piano; alla spinta (gamba dietro) la punta scende
      this.ruota(L.piede, -(coscia + ginocchio) * 0.85 + Math.max(0, -sl) * 10 * DEG * amp);
    }
    // bacino: ondeggia e ruota col passo; si abbassa quando le gambe sono aperte
    this.ruota('bacino', 0, 4 * DEG * amp * s, 2.5 * DEG * amp * c);
    let dy = -0.012 * H * amp * Math.abs(s);
    // busto: contro-rotazione e un filo in avanti quando cammina
    this.ruota('schiena', 3 * DEG * k, -3 * DEG * amp * s);
    this.ruota('petto', 0, -2 * DEG * amp * s);

    // --- fermo: respiro e peso che si sposta (solo in piedi)
    const resp = Math.sin((t * Math.PI * 2) / C.respiro);
    const peso = Math.sin((t * Math.PI * 2) / C.peso + 1.3) * C.pesoAmp * fermo * inPiedi;
    this.ruota('petto', -1.2 * DEG * resp * (0.6 + 0.4 * fermo));
    this.ruota('bacino', 0, 0, 1.6 * DEG * peso);
    this.ruota('schiena', 0, 0, -1.2 * DEG * peso);
    this.ruota('cosciaS', 0, 0, -1.6 * DEG * peso);
    this.ruota('cosciaD', 0, 0, -1.6 * DEG * peso);
    this.ruota('piedeS', 0, 0, 1.6 * DEG * peso);
    this.ruota('piedeD', 0, 0, 1.6 * DEG * peso);
    // il ginocchio che non porta il peso si sblocca appena
    this.ruota('stincoS', 3 * DEG * Math.max(0, -peso));
    this.ruota('stincoD', 3 * DEG * Math.max(0, peso));
    // abitudini: testa un po' inclinata, spalle un po' avanti
    this.ruota('collo', C.spalle * 0.5 * DEG, 0, C.inclina * 0.4 * DEG);
    this.ruota('testa', 0, 0, C.inclina * 0.6 * DEG);

    // --- curvo (anziani, lavandaia): schiena e collo avanti, testa che rialza lo sguardo
    const cv = this.curvo * (1 - sd * 0.5);
    if (cv > 0.001) {
      this.ruota('schiena', 14 * DEG * cv);
      this.ruota('petto', 12 * DEG * cv);
      this.ruota('collo', 6 * DEG * cv);
      this.ruota('testa', -16 * DEG * cv);
      this.ruota('cosciaS', -6 * DEG * cv * (1 - sd));
      this.ruota('cosciaD', -6 * DEG * cv * (1 - sd));
      this.ruota('stincoS', 8 * DEG * cv * (1 - sd));
      this.ruota('stincoD', 8 * DEG * cv * (1 - sd));
      dy -= 0.012 * H * cv * (1 - sd);
    }

    // --- seduto: cosce avanti, stinchi giù, bacino a 0,5 m dall'origine e un po' indietro
    if (sd > 0.001) {
      const aC = (this.opz.gonna ? 78 : 84) * DEG * sd;
      const aG = (this.opz.gonna ? 76 : 82) * DEG * sd;
      for (const L of LATI) {
        this.ruota(L.coscia, -aC, 0, L.segno * 3 * DEG * sd);
        this.ruota(L.stinco, aG);
        this.ruota(L.piede, -4 * DEG * sd);
      }
      this.ruota('schiena', 5 * DEG * sd);
      this.ruota('collo', 3 * DEG * sd);
      dy += (0.5 - this.yAnche) * sd;
    }

    // --- chino sul lavoro (la vasca, il muro): schiena giù, ginocchia morbide
    if (ch > 0.001) {
      this.ruota('schiena', 24 * DEG * ch);
      this.ruota('petto', 16 * DEG * ch);
      this.ruota('collo', 4 * DEG * ch);
      this.ruota('testa', 4 * DEG * ch);
      this.ruota('cosciaS', -10 * DEG * ch);
      this.ruota('cosciaD', -10 * DEG * ch);
      this.ruota('stincoS', 16 * DEG * ch);
      this.ruota('stincoD', 16 * DEG * ch);
      this.ruota('piedeS', -6 * DEG * ch);
      this.ruota('piedeD', -6 * DEG * ch);
      dy -= 0.025 * H * ch;
    }
    this.spostamento.set(0, dy, -0.12 * sd);

    // --- braccia: giù dalla posa ad A, oscillano col passo, gomito un po' piegato
    const respSpalle = 0.6 * DEG * resp;
    const oscilla = C.oscilla * DEG * amp;
    this.ruota('braccioS', oscilla * s, 0, -(this.abbassaBracciaS - respSpalle));
    this.ruota('braccioD', -oscilla * s, 0, this.abbassaBracciaD - respSpalle);
    this.ruota('avambraccioS', -(8 + 10 * amp * Math.max(0, -s)) * DEG);
    this.ruota('avambraccioD', -(8 + 10 * amp * Math.max(0, s)) * DEG);
    this.ruota('manoS', 0, 0, 4 * DEG);
    this.ruota('manoD', 0, 0, -4 * DEG);

    // --- posa delle braccia (IK sulle due mani), sotto i gesti
    const libero = 1 - this.gestoPeso * 0.999;
    if (this.posaPeso > 0.001) this.posaBraccia(this.posaAttiva, this.posaPeso * libero * (1 - sd) * (1 - ch));
    // seduti: le mani in grembo; chini: le mani avanti e in basso (nella vasca, sulle pietre)
    if (sd > 0.001) this.maniInGrembo(sd * libero);
    if (ch > 0.001) this.maniAlLavoro(ch * libero, t);
    // il bastone: la mano destra lo tiene avanti, all'altezza del fianco (in piedi)
    if (this.opz.bastone) this.reggiBastone(inPiedi * libero * (1 - 0.6 * k));

    // --- gesti (braccio destro), sfumati
    const g = this.gestoPeso;
    if (g > 0.001) this.gesto(this.gestoAttivo, g, t, stato.indica ?? null);

    // --- sguardo: testa e collo verso il punto (in spazio modello), con limiti e inerzia
    let yawB = 0;
    let pitchB = 0;
    if (stato.guarda) {
      _v.copy(stato.guarda);
      this.radice.worldToLocal(_v);
      _w.copy(_v).sub(this.o('testa').attacco);
      const ang = Math.atan2(_w.x, _w.z);
      yawB = THREE.MathUtils.clamp(ang, -75 * DEG, 75 * DEG);
      const oriz = Math.hypot(_w.x, _w.z);
      pitchB = THREE.MathUtils.clamp(-Math.atan2(_w.y, oriz), -30 * DEG, 35 * DEG);
      // dietro le spalle: si gira fin dove può, dal lato giusto
      if (_w.z < 0 && Math.abs(ang) > 100 * DEG) yawB = Math.sign(_w.x || 1) * 75 * DEG;
    } else {
      // sguardi distratti quando è fermo
      const fq = C.sguardoF;
      yawB = (Math.sin(t * 0.37 * fq + 1.1) * 0.6 + Math.sin(t * 0.13 * fq) * 0.4) * C.sguardoAmp * DEG * fermo * (1 - ch * 0.7);
      pitchB = Math.sin(t * 0.29 * fq + 2) * 4 * DEG * fermo;
    }
    this.yaw = smorza(this.yaw, yawB, 4, d);
    this.pitch = smorza(this.pitch, pitchB, 4, d);
    // oltre 45° gira anche il busto (metà del resto), poi collo e testa
    const busto = Math.max(0, Math.abs(this.yaw) - 45 * DEG) * Math.sign(this.yaw);
    this.ruota('petto', 0, busto * 0.5);
    this.ruota('collo', this.pitch * 0.35, (this.yaw - busto * 0.5) * 0.4);
    this.ruota('testa', this.pitch * 0.65, (this.yaw - busto * 0.5) * 0.6);

    // --- scrive le ossa: riposo · W⁻¹ · R · W
    for (const o of this.lista) {
      _q.copy(o.Winv).multiply(o.R).multiply(o.W);
      o.osso.quaternion.copy(o.riposo).multiply(_q);
    }
  }

  private gesto(gesto: GestoPersonaggio, g: number, t: number, indica: THREE.Vector3 | null): void {
    // il braccio destro torna alla posa ad A (togli l'abbassamento) e poi fa il gesto
    const giaAbbassato = this.abbassaBracciaD;
    if (gesto === 'saluta') {
      this.ruota('braccioD', 0, 0, -(giaAbbassato + 70 * DEG) * g);
      this.ruota('avambraccioD', 0, 0, (-75 + 18 * Math.sin(t * 9)) * DEG * g);
      this.ruota('manoD', 0, 0, -10 * DEG * g);
    } else if (gesto === 'indica') {
      // il braccio intero verso il punto (in spazio modello), avambraccio dritto
      if (indica) {
        _v.copy(indica);
        this.radice.worldToLocal(_v);
        _v.sub(this.o('braccioD').attacco);
      } else _v.set(-0.2, -0.05, 1);
      if (_v.lengthSq() < 1e-8) _v.set(0, 0, 1);
      _v.normalize();
      _qa.setFromUnitVectors(this.dirBraccioD, _v);
      // sostituisce la rotazione del braccio (sfumata)
      this.o('braccioD').R.slerp(_qa, g);
      this.o('avambraccioD').R.slerp(IDENTITA, g);
    } else if (gesto === 'mano-al-petto') {
      // la mano destra sul petto, un po' a sinistra del centro, davanti al busto
      const petto = this.o('petto').attacco;
      const collo = this.o('collo').attacco;
      _bersaglio.set(0.03 * this.altezza, petto.y + 0.3 * (collo.y - petto.y), this.fronteBusto + 0.035 * this.altezza);
      this.raggiungi('D', _bersaglio, g);
      this.ruota('manoD', -20 * DEG * g, 0, -25 * DEG * g);
    }
  }

  private posaBraccia(posa: PosaBraccia, p: number): void {
    if (p <= 0.001) return;
    const H = this.altezza;
    const petto = this.o('petto').attacco;
    const fronte = this.fronteBusto;
    const bacino = this.o('bacino').attacco;
    if (posa === 'mani-giunte') {
      // le mani una sull'altra davanti alla pancia
      const y = bacino.y + 0.08 * H;
      this.raggiungi('S', _bersaglio.set(0.015 * H, y, fronte + 0.05 * H), p);
      this.raggiungi('D', _bersaglio.set(-0.015 * H, y - 0.01 * H, fronte + 0.065 * H), p);
    } else if (posa === 'braccia-conserte') {
      // ogni mano verso il gomito opposto, davanti al petto
      const y = petto.y + 0.02 * H;
      this.raggiungi('S', _bersaglio.set(-0.07 * H, y, fronte + 0.04 * H), p);
      this.raggiungi('D', _bersaglio.set(0.07 * H, y + 0.02 * H, fronte + 0.07 * H), p);
    } else if (posa === 'mani-dietro') {
      // le mani dietro la schiena, all'altezza del bacino
      const dietro = petto.z - (fronte - petto.z) - 0.03 * H;
      this.raggiungi('S', _bersaglio.set(0.03 * H, bacino.y + 0.02 * H, dietro), p);
      this.raggiungi('D', _bersaglio.set(-0.03 * H, bacino.y + 0.03 * H, dietro - 0.01 * H), p);
    }
  }

  /** Seduti: le mani appoggiate sulle cosce, verso le ginocchia (le cosce sono orizzontali). */
  private maniInGrembo(p: number): void {
    if (p <= 0.001) return;
    const H = this.altezza;
    const anca = this.yAnche;
    const z = this.o('bacino').attacco.z + 0.2 * H;
    for (const L of LATI) {
      // sulla coscia, verso il ginocchio, un po' all'esterno (non in mezzo al grembo)
      const x = this.o(L.coscia).attacco.x + L.segno * 0.035 * H;
      this.raggiungi(L.lato, _bersaglio.set(x, anca + 0.06 * H, z), p);
    }
  }

  /** Chini: le mani avanti e in basso (nel busto a riposo: la schiena piegata le porta giù), un lento lavorare. */
  private maniAlLavoro(p: number, t: number): void {
    if (p <= 0.001) return;
    const H = this.altezza;
    const petto = this.o('petto').attacco;
    const fronte = this.fronteBusto;
    const lavoro = Math.sin(t * 1.7) * 0.025 * H;
    this.raggiungi('S', _bersaglio.set(0.08 * H, petto.y - 0.2 * H + lavoro, fronte + 0.13 * H), p);
    this.raggiungi('D', _bersaglio.set(-0.08 * H, petto.y - 0.2 * H - lavoro, fronte + 0.14 * H), p);
  }

  /** La mano destra regge il bastone: avanti e di lato, all'altezza del fianco. */
  private reggiBastone(p: number): void {
    if (p <= 0.001) return;
    const H = this.altezza;
    const spalla = this.o('braccioD').attacco;
    this.raggiungi('D', _bersaglio.set(spalla.x - 0.035 * H, 0.52 * H, this.fronteBusto + 0.07 * H), p);
  }

  /**
   * IK a due ossa: porta il polso del lato dato sul punto `bersaglio` (spazio del modello, con il busto
   * a riposo), con il gomito verso fuori, in basso e indietro. `peso` sfuma dalla posa calcolata finora.
   * Serve ai gesti e alle pose di mestiere (le mani nella vasca, sul bastone, giunte).
   * Non tiene `bersaglio`: si può passare un vettore di lavoro.
   */
  raggiungi(lato: 'S' | 'D', bersaglio: THREE.Vector3, peso = 1): void {
    if (peso <= 0) return;
    const L = LATO[lato];
    const ua = this.o(L.braccio);
    const fa = this.o(L.avambraccio);
    const ma = this.o(L.mano);
    const S = ua.attacco;
    const L1 = fa.attacco.distanceTo(S);
    const L2 = ma.attacco.distanceTo(fa.attacco);
    _d1.copy(fa.attacco).sub(S).normalize();
    _d2.copy(ma.attacco).sub(fa.attacco).normalize();
    _D.copy(bersaglio).sub(S);
    const dist = THREE.MathUtils.clamp(_D.length(), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3);
    _D.normalize();
    const cosA = THREE.MathUtils.clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    // polo del gomito: fuori, in basso, indietro
    _n.set(L.segno * 0.6, -0.5, -0.6);
    _n.addScaledVector(_D, -_n.dot(_D)).normalize();
    _gomito.copy(S).addScaledVector(_D, L1 * cosA).addScaledVector(_n, L1 * sinA);
    _polso.copy(S).addScaledVector(_D, dist);
    // direzioni nuove di braccio e avambraccio
    _w.copy(_gomito).sub(S).normalize();
    _v.copy(_polso).sub(_gomito).normalize();
    _qa.setFromUnitVectors(_d1, _w);
    _qb.copy(_qa).invert();
    _v.applyQuaternion(_qb);
    _qb.setFromUnitVectors(_d2, _v);
    ua.R.slerp(_qa, peso);
    fa.R.slerp(_qb, peso);
  }
}
