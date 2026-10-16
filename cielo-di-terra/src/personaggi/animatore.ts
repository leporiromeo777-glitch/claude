/**
 * Animazione procedurale dello scheletro dei personaggi generati (vedi ossa.ts): niente clip, solo
 * rotazioni calcolate a ogni fotogramma, come per gli abitanti procedurali (update(dt, stato)).
 *
 * Le rotazioni si scrivono nello SPAZIO DEL MODELLO (X = sinistra del personaggio, Y = alto,
 * Z = avanti), indipendenti dal rollio delle ossa esportate da Blender:
 *     osso.quaternion = riposo · W⁻¹ · R · W
 * dove W è l'orientamento di riposo dell'osso nello spazio del modello. Così R ruota l'osso attorno
 * al suo attacco come se il padre fosse a riposo, e la catena (braccio → avambraccio → mano) si
 * compone da sola: la rotazione accumulata del figlio è C_padre · R_figlio.
 *
 * Segni utili (spazio del modello):
 *  - Rx(+) piega in avanti la schiena e la testa, porta INDIETRO coscia e braccio, piega il ginocchio,
 *    abbassa la punta del piede;
 *  - Rx(-) porta avanti coscia, braccio e avambraccio (la mano verso +Z);
 *  - Rz(-) abbassa il braccio S (sinistro), Rz(+) abbassa il braccio D;
 *  - Ry(+) gira la testa verso la propria sinistra (+X).
 *
 * Gambe e braccia con un'IK a due ossa (`ik2`): i bersagli dati nello spazio del modello (i piedi a
 * terra, le mani nella vasca, sulla barra del Velo, in grembo) si portano prima nel riferimento di
 * riposo del padre (bacino per le gambe, petto per le braccia) con la rotazione accumulata del busto,
 * così restano giusti anche col busto piegato.
 *
 * Il passo: la fase avanza con la DISTANZA percorsa (`avanzamento`), il piede d'appoggio va indietro
 * esattamente quanto avanza il corpo (non pattina), si stacca alzando il tallone sulla punta, e in volo
 * fa una curva morbida alta almeno 0,07·H (0,09·H i bambini). Il bacino scende quanto serve perché le
 * gambe arrivino ai piedi.
 *
 * Nessuna allocazione per fotogramma: vettori e quaternioni di lavoro sono del modulo.
 */
import * as THREE from 'three';
import { NOMI_OSSA, type NomeOsso } from './ossa';

export type GestoPersonaggio = 'nessuno' | 'saluta' | 'indica' | 'mano-al-petto';
export type PosaBraccia = 'libere' | 'mani-giunte' | 'braccia-conserte' | 'mani-dietro';
/** Posa del corpo, come quella del popolamento (`PosaNpc`): in piedi, seduto, chino sul lavoro. */
export type PosaCorpo = 'in-piedi' | 'seduto' | 'chino';
/** Che cosa fanno le mani da sedute: in grembo, sul pomo del bastone, il lavoro di Pina (cartone e forbici). */
export type ManiSeduta = 'grembo' | 'bastone' | 'forbici';

/**
 * Dove si siede (spazio del modello, m, con l'origine ai piedi della figura): `sedile` = quota del piano
 * su cui posa (panca, gradino, soglia, selciato), `piedi` = quota del piano dove vanno i piedi, `avanti`
 * = dove stanno le anche lungo Z (dietro lo spigolo del sedile), `terra` = seduto per terra (gambe
 * incrociate o, con la veste lunga, distese avanti). Vedi sedute.ts, che la ricava dal profilo del suolo.
 */
export interface Seduta {
  sedile: number;
  piedi: number;
  avanti: number;
  terra: boolean;
}

export interface StatoPersonaggio {
  /** 'fermo' (respiro, peso che si sposta) o 'cammina' (passo sul posto: lo spostamento lo fa il motore) */
  modo?: 'fermo' | 'cammina';
  /** velocità di camminata in m/s (lunghezza del passo; e la fase, se manca `avanzamento`) */
  velocita?: number;
  /**
   * metri percorsi in avanti dall'ultimo aggiornamento (unità del modello): la fase del passo avanza
   * con questi, così il piede d'appoggio non pattina; se manca vale velocita · dt
   */
  avanzamento?: number;
  /** punto da guardare in coordinate MONDO (null = avanti) */
  guarda?: THREE.Vector3 | null;
  gesto?: GestoPersonaggio;
  /** per 'indica': punto in coordinate mondo */
  indica?: THREE.Vector3 | null;
  /** 0..1: quanto sta curvo (anziani; Togna china sulla vasca = 1); se manca vale quello delle opzioni */
  curvo?: number;
  /** posa delle braccia da fermi (come la «postura» degli abitanti procedurali); se manca, quella delle opzioni */
  braccia?: PosaBraccia;
  /** in piedi (predefinito), seduto (vedi `seduta`), chino */
  posa?: PosaCorpo;
  /** dove si siede (con posa 'seduto'); senza: una panca alta 0,45 m, le anche 0,12 m indietro */
  seduta?: Seduta | null;
  /** che cosa fanno le mani da sedute (predefinito: quello delle opzioni, poi 'grembo') */
  maniSeduta?: ManiSeduta;
  /**
   * le due mani su due punti dello spazio del SUOLO del modello (origine ai piedi, come il gruppo della
   * figura, nelle unità del modello: per esempio la barra del Velo da planata di Ottavio); null o assente =
   * niente. Sopra la posa delle braccia, sotto i gesti.
   */
  mani?: { readonly S: THREE.Vector3; readonly D: THREE.Vector3 } | null;
  /** appeso al Velo da planata: il corpo si inclina in avanti, le gambe pendono un po' indietro */
  volo?: boolean;
  /**
   * di quanto (rad, + = verso la propria sinistra, attorno a +Y) si è girata la figura intera dall'ultimo
   * aggiornamento: in piedi e fermi i piedi restano dove sono e fanno dei passi brevi per seguire il corpo
   * (non ruota su se stesso né scivola); oltre 1,2 rad in un colpo è un salto (vaiA), i piedi ripartono
   */
  giro?: number;
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
  /** z (m) della schiena, nello spazio del modello: mani dietro, gerla */
  retroBusto?: number;
  /** seme del carattere: ritmo del respiro, sguardi, ampiezza del passo, piccole asimmetrie (senza: neutro) */
  seme?: number;
  /** quanto è curvo quando lo stato non lo dice (anziani) */
  curvo?: number;
  /** posa delle braccia quando lo stato non la dice */
  braccia?: PosaBraccia;
  /** porta un bastone nella mano destra: da fermo la mano lo tiene avanti, all'altezza del fianco */
  bastone?: boolean;
  /** bambino: passo più rapido, respiro più veloce, sguardi più vivaci, piede più alto */
  bambino?: boolean;
  /** che cosa fanno le mani da sedute quando lo stato non lo dice */
  maniSeduta?: ManiSeduta;
  /** la mano destra tiene qualcosa (bastone, pietra): i gesti si fanno con la sinistra */
  manoDOccupata?: boolean;
  /** tutte e due le mani tengono qualcosa (Pina: forbici e cartone): parlando niente gesti delle mani, solo il capo */
  maniOccupate?: boolean;
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

// --- misure della camminata e delle pose (frazioni dell'altezza H)
/** lunghezza di un passo (un piede davanti all'altro), con e senza veste lunga */
export const PASSO = { gonna: 0.31, libero: 0.34 };
/** frazione del ciclo con il piede a terra */
export const APPOGGIO = 0.6;
/** alzata minima del piede in volo (adulti, bambini) */
export const ALZATA = { adulto: 0.07, bambino: 0.09 };
/** quanto stanno le anche (le teste dei femori) sopra il piano della seduta e sopra il suolo da seduti per terra */
export const ANCA_SEDUTA = 0.06;
export const ANCA_TERRA = 0.075;
/**
 * distanza massima spalla-polso nelle pose delle braccia, in frazioni della lunghezza del braccio: il gomito
 * si piega davvero (le braccia conserte tese a X erano all'88-92%); le mani giunte alla pancia e quelle
 * dietro la schiena hanno bisogno di un po' più di braccio
 */
export const ESTENSIONE_POSE = { conserte: 0.7, giunte: 0.84, dietro: 0.84 };

const DEG = Math.PI / 180;
const _q = new THREE.Quaternion();
const _r = new THREE.Quaternion();
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _qc = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _u = new THREE.Vector3();
const _bersaglio = new THREE.Vector3();
const _bersaglio2 = new THREE.Vector3();
const _polo = new THREE.Vector3();
const _d1 = new THREE.Vector3();
const _d2 = new THREE.Vector3();
const _D = new THREE.Vector3();
const _n = new THREE.Vector3();
const _gomito = new THREE.Vector3();
const _polso = new THREE.Vector3();
const _m = new THREE.Matrix4();
const IDENTITA = new THREE.Quaternion();
const ASSE_X = new THREE.Vector3(1, 0, 0);
const ASSE_Y = new THREE.Vector3(0, 1, 0);

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
const liscio = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** 0 → 1 con velocità nulla ai due capi (mezzo coseno), x in [0, 1] */
const morbido = (x: number) => (1 - Math.cos(Math.PI * THREE.MathUtils.clamp(x, 0, 1))) / 2;

/**
 * Una molla smorzata in modo critico (posizione e velocità): va verso il bersaglio senza oscillare e
 * senza salti di velocità quando il bersaglio cambia di colpo (la testa che passa da uno sguardo distratto
 * a chi parla). `k` = rigidezza (1/s: a 5 arriva in circa un secondo), `vmax` = velocità massima.
 * Integrata a passi di 1/60 s al più, così regge anche gli aggiornamenti radi dei lontani.
 */
export function molla(stato: { x: number; v: number }, bersaglio: number, k: number, dt: number, vmax = Infinity): void {
  const n = Math.max(1, Math.ceil(dt * 60 - 1e-6));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const a = k * k * (bersaglio - stato.x) - 2 * k * stato.v;
    stato.v = THREE.MathUtils.clamp(stato.v + a * h, -vmax, vmax);
    stato.x += stato.v * h;
  }
}

/** Un numero fra 0 e 1 dal seme e da un indice (mulberry32 di una volta): le scelte delle battute. */
function caso(seme: number, n: number): number {
  let t = (seme ^ Math.imul(n + 1, 0x9e3779b9)) >>> 0;
  t = (t + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** I gesti che accompagnano le battute: la mano che si apre davanti (il più comune) o la mano al petto. */
export type GestoBattuta = 'apre' | 'mano-al-petto';

/**
 * Le misure della conversazione (secondi, gradi): quanto spesso e quanto ampio. Tutto quello che si muove
 * parlando entra e esce a velocità nulla (mezzo coseno), mai a gradino.
 */
export const CONVERSAZIONE = {
  /** probabilità di un gesto a una battuta (bambini un po' di più), e il tempo minimo fra due gesti */
  gesto: 0.4,
  gestoBambino: 0.55,
  fraGesti: 6,
  /** entrata, tenuta (al più) e uscita del gesto */
  gestoEntra: 0.9,
  gestoTiene: 1.5,
  gestoEsce: 1.0,
  /** il cenno del capo all'inizio di una battuta: probabilità, ampiezza (gradi) e durata */
  cenno: 0.7,
  cennoAmp: [3.5, 6] as const,
  cennoDurata: [0.75, 1.0] as const,
  /** il capo che si muove appena mentre parla (gradi) */
  capo: 1.6,
  /** il petto che respira (gradi), e quanto di più mentre parla (frazione) */
  respiro: 1.0,
  respiroParla: 0.3,
  /** lo sguardo: rigidezza della molla (1/s) e velocità massima (gradi/s) */
  sguardoK: 4.5,
  sguardoVmax: 160,
  /** un passo per seguire il corpo che si gira: oltre questo scarto (rad) fra piede e corpo, durata (s), alzata (·H) */
  passoGiro: 0.15,
  passoGiroDurata: 0.44,
  passoGiroAlzata: 0.026,
} as const;

/** Nomi delle ossa per lato (niente stringhe composte a ogni fotogramma). */
const LATO = {
  S: { lato: 'S', braccio: 'braccioS', avambraccio: 'avambraccioS', mano: 'manoS', coscia: 'cosciaS', stinco: 'stincoS', piede: 'piedeS', segno: 1 },
  D: { lato: 'D', braccio: 'braccioD', avambraccio: 'avambraccioD', mano: 'manoD', coscia: 'cosciaD', stinco: 'stincoD', piede: 'piedeD', segno: -1 },
} as const;
const LATI = [LATO.S, LATO.D] as const;
type Lato = (typeof LATI)[number];

/** Seduta predefinita (senza profilo del suolo): una panca di 0,45 m, le anche 12 cm dietro l'origine. */
const SEDUTA_PREDEFINITA: Seduta = { sedile: 0.45, piedi: 0, avanti: -0.12, terra: false };

export class AnimatorePersonaggio {
  readonly radice: THREE.Object3D;
  readonly ossa = new Map<NomeOsso, Osso>();
  private readonly lista: Osso[] = [];
  /** altezza a riposo (cima della testa), per le ampiezze */
  readonly altezza: number;
  /** z della superficie del petto (per le mani) e della schiena */
  readonly fronteBusto: number;
  readonly retroBusto: number;
  readonly carattere: Carattere;
  private readonly opz: {
    apertura: number;
    gonna: boolean;
    sfasamento: number;
    curvo: number;
    braccia: PosaBraccia;
    bastone: boolean;
    bambino: boolean;
    maniSeduta: ManiSeduta;
    manoDOccupata: boolean;
    maniOccupate: boolean;
  };
  private t = 0;
  /** fase del ciclo del passo (0..1, un ciclo = due passi) */
  private fase = 0;
  /** 0 = fermo, 1 = cammina (sfuma fra i due) */
  private cammino = 0;
  private velocita = 0;
  /** lo sguardo (rad): molle con posizione e velocità (vedi `molla`) */
  private readonly yaw = { x: 0, v: 0 };
  private readonly pitch = { x: 0, v: 0 };
  /** fase del respiro (rad): si accumula, così cambiare il ritmo non fa saltare il petto */
  private faseRespiro = 0;
  private gestoPeso = 0;
  /** peso della posa delle braccia (sfuma col cammino e con i gesti) */
  private posaPeso = 0;
  private posaAttiva: PosaBraccia = 'libere';
  private gestoAttivo: GestoPersonaggio = 'nessuno';
  private curvo = 0;
  private seduto = 0;
  private chino = 0;
  private volo = 0;
  /** la seduta che sfuma (si tiene l'ultima per l'uscita) */
  private readonly sedutaAttiva: Seduta = { ...SEDUTA_PREDEFINITA };
  private maniSedutaAttive: ManiSeduta = 'grembo';
  /** peso e bersagli delle mani su due punti (StatoPersonaggio.mani), tenuti per sfumare all'uscita */
  private maniPeso = 0;
  private readonly maniS = new THREE.Vector3();
  private readonly maniD = new THREE.Vector3();
  /** la battuta in corso (annunciaBattuta): tempo dall'inizio, quanto dura il parlato, quante finora */
  private battutaT = 99;
  private battutaDurata = 0;
  private battute = 0;
  /** quanto sta parlando adesso (0..1, sale e scende morbido) */
  private parla = 0;
  /** il cenno del capo della battuta: tempo dall'inizio (s), ampiezza (rad), durata (s) */
  private cenno = { t: 99, amp: 0, durata: 1 };
  /** il gesto della battuta: quale, da quanto (s), quanto tiene, con che mano, e quando è cominciato l'ultimo */
  private gestoB: { tipo: GestoBattuta; t: number; tiene: number; lato: 'S' | 'D' } | null = null;
  private ultimoGesto = -99;
  private readonly semeBattute: number;
  /** quanto i piedi sono girati rispetto al corpo (rad, attorno a +Y del modello) e il passo in corso per rimetterli */
  private readonly piedeGiro = { S: 0, D: 0 };
  private passoGiro: { lato: 'S' | 'D'; t: number; da: number; a: number } | null = null;
  /** velocità con cui il corpo intero sta girando (rad/s, smorzata) e il peso dell'IK dei piedi girati */
  private giroVel = 0;
  private giroPeso = 0;
  private readonly giroPesoM = { x: 0, v: 0 };
  private fermoGiro = 0;
  /**
   * spostamento del modello (m, nello spazio del suo genitore) da applicare alla radice dopo `update`:
   * y = abbassamento del bacino nel passo e nella seduta, z = indietro da seduti
   */
  readonly spostamento = new THREE.Vector3();
  private readonly abbassaBracciaS: number;
  private readonly abbassaBracciaD: number;
  private readonly dirBraccioD = new THREE.Vector3();
  private readonly dirBraccioS = new THREE.Vector3();
  /** quota e profondità dell'attacco delle cosce a riposo */
  private readonly yAnche: number;
  private readonly zAnche: number;
  /** lunghezze delle gambe (coscia, stinco) e del braccio (braccio + avambraccio) */
  private readonly L1g: number;
  private readonly L2g: number;
  /** caviglia e punta del piede a riposo, rispetto alla caviglia: la punta sta avanti di `piedeL`, a `piedeY` dal suolo */
  private readonly piedeL: number;
  private readonly yCaviglia: number;
  /** rotazioni accumulate di bacino, schiena e petto in questo fotogramma (per i bersagli nel modello) */
  private readonly C = { bacino: new THREE.Quaternion(), schiena: new THREE.Quaternion(), petto: new THREE.Quaternion() };
  private readonly P = { schiena: new THREE.Vector3(), petto: new THREE.Vector3() };
  /** posizioni delle ginocchia calcolate dall'IK (spazio del modello, senza lo spostamento) */
  private readonly ginocchio = { S: new THREE.Vector3(), D: new THREE.Vector3() };
  /** caviglie volute nel passo (spazio del suolo), per chi misura, e beccheggio dei piedi */
  readonly caviglie = { S: new THREE.Vector3(), D: new THREE.Vector3() };
  private readonly beccheggio = { S: 0, D: 0 };

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
      maniSeduta: opz.maniSeduta ?? (opz.bastone ? 'bastone' : 'grembo'),
      manoDOccupata: opz.manoDOccupata ?? opz.bastone ?? false,
      maniOccupate: opz.maniOccupate ?? false,
    };
    this.t = this.opz.sfasamento;
    this.curvo = this.opz.curvo;
    this.fase = (this.opz.sfasamento * 0.37) % 1;
    this.faseRespiro = (this.opz.sfasamento * Math.PI * 2) / this.carattere.respiro;
    this.semeBattute = ((opz.seme ?? 0) ^ 0x7a11c0) >>> 0;
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
      // (normalizzato: nei generici la copia è scalata in modo diverso in larghezza e altezza e il quaternione
      // estratto dalla matrice del mondo non è unitario; W⁻¹·R·W allora non era una rotazione pura e ogni osso
      // si accorciava di qualche decimillesimo)
      const W = osso.getWorldQuaternion(new THREE.Quaternion()).premultiply(radiceInv).normalize();
      const attacco = osso.getWorldPosition(new THREE.Vector3()).applyMatrix4(radiceMatInv);
      const o: Osso = { nome, osso, riposo: osso.quaternion.clone(), W, Winv: W.clone().invert(), attacco, R: new THREE.Quaternion() };
      this.ossa.set(nome, o);
      this.lista.push(o);
    }
    const testa = this.o('testa');
    // la cima: l'attacco della testa più la sua lunghezza (le ossa finali non hanno figli: stimata)
    this.altezza = opz.altezza ?? testa.attacco.y / 0.87;
    const H = this.altezza;
    // davanti al petto: mai più di 0,07·H davanti all'attacco del petto (un velo che pende non è il petto)
    const petto = this.o('petto').attacco;
    this.fronteBusto = Math.min(opz.fronteBusto ?? petto.z + 0.06 * H, petto.z + 0.07 * H);
    this.retroBusto = opz.retroBusto ?? petto.z - (this.fronteBusto - petto.z) - 0.01 * H;
    this.yAnche = (this.o('cosciaS').attacco.y + this.o('cosciaD').attacco.y) / 2;
    this.zAnche = (this.o('cosciaS').attacco.z + this.o('cosciaD').attacco.z) / 2;
    this.L1g = this.o('stincoS').attacco.distanceTo(this.o('cosciaS').attacco);
    this.L2g = this.o('piedeS').attacco.distanceTo(this.o('stincoS').attacco);
    this.yCaviglia = (this.o('piedeS').attacco.y + this.o('piedeD').attacco.y) / 2;
    // la punta del piede: circa 0,11·H davanti alla caviglia (lo scheletro non ha l'osso della punta)
    this.piedeL = 0.11 * H;
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
    this.dirBraccioS.copy(this.o('avambraccioS').attacco).sub(this.o('braccioS').attacco).normalize();
  }

  /** abbassamento del bacino (m): la y di `spostamento` (compatibilità con il pilota) */
  get abbassamento(): number {
    return this.spostamento.y;
  }

  /** quanto cammina (0..1), per chi deve far ondeggiare l'orlo */
  get passo(): number {
    return this.cammino;
  }

  /** quanto è seduto (0..1): la veste passa ai pesi «da seduti» (vedi gonne.ts) */
  get sedutoPeso(): number {
    return this.seduto;
  }

  /** quanto è appeso al Velo (0..1) */
  get voloPeso(): number {
    return this.volo;
  }

  /** tempo interno (s, con lo sfasamento) */
  get tempo(): number {
    return this.t;
  }

  /** fase del passo (0..1) */
  get faseCiclo(): number {
    return this.fase;
  }

  /** lunghezza della gamba dall'anca alla caviglia */
  get lunghezzaGamba(): number {
    return this.L1g + this.L2g;
  }

  /** l'attacco a riposo di un osso, nello spazio del modello */
  attacco(nome: NomeOsso): THREE.Vector3 {
    return this.o(nome).attacco;
  }

  /**
   * Una battuta di dialogo comincia (`durata` = per quanto parla, s): come una persona in una conversazione
   * tranquilla. Quasi sempre un piccolo cenno del capo, lento; mentre parla il capo si muove appena e il
   * respiro si fa un po' più ampio; ogni tanto (non a ogni battuta, mai due gesti a meno di
   * `CONVERSAZIONE.fraGesti` s) la mano libera si apre davanti o va al petto. Le scelte vengono dal seme
   * del personaggio: la stessa battuta fa sempre lo stesso.
   */
  annunciaBattuta(durata = 2.6): void {
    const n = this.battute++;
    const K = CONVERSAZIONE;
    this.battutaT = 0;
    this.battutaDurata = THREE.MathUtils.clamp(durata, 1.2, 7);
    const s = this.semeBattute;
    // il cenno (se il precedente è finito: due cenni non si sommano)
    if (this.cenno.t >= this.cenno.durata && caso(s, n * 3) < K.cenno) {
      const bimbo = this.opz.bambino ? 1.3 : 1;
      this.cenno = {
        t: -0.08 - 0.2 * caso(s, n * 3 + 1),
        amp: (K.cennoAmp[0] + (K.cennoAmp[1] - K.cennoAmp[0]) * caso(s, n * 3 + 2)) * bimbo * DEG,
        durata: K.cennoDurata[0] + (K.cennoDurata[1] - K.cennoDurata[0]) * caso(s, n * 7 + 5),
      };
    }
    // il gesto: raro, mai alla prima battuta di chi non si conosce ancora, mai due di fila
    const p = this.opz.bambino ? K.gestoBambino : K.gesto;
    if (n > 0 && !this.opz.maniOccupate && !this.gestoB && this.t - this.ultimoGesto > K.fraGesti && caso(s, n * 5 + 11) < p) {
      const tipo: GestoBattuta = caso(s, n * 5 + 13) < 0.72 ? 'apre' : 'mano-al-petto';
      this.gestoB = { tipo, t: -0.15, tiene: Math.min(K.gestoTiene, Math.max(0.6, this.battutaDurata * 0.45)), lato: this.opz.manoDOccupata ? 'S' : 'D' };
      this.ultimoGesto = this.t;
    }
  }

  /** Il dialogo è finito: niente più parlato; il gesto in corso esce da solo, morbido. */
  fineBattute(): void {
    this.battutaDurata = Math.min(this.battutaDurata, this.battutaT);
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
    const voloOra = stato.volo ? 1 : 0;
    const posaCorpo = camminaOra || voloOra ? 'in-piedi' : (stato.posa ?? 'in-piedi');
    this.cammino = smorza(this.cammino, camminaOra * (1 - voloOra), 6, d);
    this.velocita = smorza(this.velocita, stato.velocita ?? (camminaOra ? 1.1 : 0), 4, d);
    this.curvo = smorza(this.curvo, stato.curvo ?? this.opz.curvo, 3, d);
    this.seduto = smorza(this.seduto, posaCorpo === 'seduto' ? 1 : 0, 5, d);
    this.chino = smorza(this.chino, posaCorpo === 'chino' ? 1 : 0, 3.5, d);
    this.volo = smorza(this.volo, voloOra, 4, d);
    if (posaCorpo === 'seduto') {
      const s = stato.seduta ?? SEDUTA_PREDEFINITA;
      const a = this.sedutaAttiva;
      // la seduta nuova si prende subito se si era in piedi, altrimenti sfuma (un altro gradino)
      const k = this.seduto < 0.05 ? 1 : 1 - Math.exp(-6 * d);
      a.sedile += (s.sedile - a.sedile) * k;
      a.piedi += (s.piedi - a.piedi) * k;
      a.avanti += (s.avanti - a.avanti) * k;
      a.terra = s.terra;
      this.maniSedutaAttive = stato.maniSeduta ?? this.opz.maniSeduta;
    }
    const posa = stato.braccia ?? this.opz.braccia;
    if (posa !== this.posaAttiva && this.posaPeso < 0.02) this.posaAttiva = posa;
    this.posaPeso = smorza(this.posaPeso, posa === this.posaAttiva && posa !== 'libere' && stato.modo !== 'cammina' ? 1 : 0, 4, d);
    // la battuta in corso: quanto parla (sale in un terzo di secondo, scende in uno), cenno e gesto
    this.battutaT += d;
    this.cenno.t += d;
    if (this.gestoB) this.gestoB.t += d;
    const parlaOra = this.battutaT < this.battutaDurata ? 1 : 0;
    this.parla = smorza(this.parla, parlaOra, parlaOra > this.parla ? 6 : 2.5, d);
    // il gesto chiesto dallo stato (la storia: saluta, indica un punto), sfumato con calma
    const gesto = stato.gesto && stato.gesto !== 'nessuno' ? stato.gesto : 'nessuno';
    if (gesto !== this.gestoAttivo && this.gestoPeso < 0.02) this.gestoAttivo = gesto;
    this.gestoPeso = smorza(this.gestoPeso, gesto === this.gestoAttivo && gesto !== 'nessuno' ? 1 : 0, 4.5, d);

    const k = this.cammino;
    const fermo = 1 - k;
    const sd = this.seduto;
    const ch = this.chino;
    const vl = this.volo;
    const inPiedi = (1 - sd) * (1 - ch) * (1 - vl);
    const sed = this.sedutaAttiva;
    const terra = sed.terra ? sd : 0;
    const panca = sed.terra ? 0 : sd;
    // il corpo intero che si gira (verso chi parla): i piedi restano a terra e lo seguono a passi
    this.aggiornaGiro(stato.giro ?? 0, d, inPiedi, k);

    // --- il passo: fase dalla distanza percorsa
    const v = Math.max(this.velocita, 0.3);
    const passo = (this.opz.gonna ? PASSO.gonna : PASSO.libero) * H * C.passo * (this.opz.bambino ? 0.95 : 1) * THREE.MathUtils.clamp(0.55 + 0.45 * (v / 1.2), 0.6, 1.15);
    const avanzato = stato.avanzamento ?? (camminaOra ? (stato.velocita ?? 1.1) * d : 0);
    this.fase = (this.fase + Math.max(0, avanzato) / (2 * passo)) % 1;
    const f = this.fase * Math.PI * 2;
    const s = Math.sin(f);
    const c = Math.cos(f);
    const amp = Math.min(1, v / 1.2) * k;
    // bacino: ruota col passo e ondeggia sulla gamba d'appoggio
    // (la gamba S è avanti quando cos > 0: l'anca sinistra avanti è Ry negativa)
    this.ruota('bacino', 0, -4 * DEG * amp * c, 2.5 * DEG * amp * s);
    // busto: contro-rotazione (le spalle al contrario delle anche) e un filo in avanti quando cammina
    this.ruota('schiena', 3 * DEG * k, 3 * DEG * amp * c);
    this.ruota('petto', 0, 2 * DEG * amp * c);

    // --- fermo: respiro e peso che si sposta (solo in piedi)
    // (la fase si accumula: prima era sin(t·2π/periodo) con il periodo che cambiava a ogni battuta, e con
    // t di qualche minuto il petto e le spalle tremavano per tre secondi a ogni battuta)
    const K = CONVERSAZIONE;
    const pa = this.parla;
    this.faseRespiro = (this.faseRespiro + (d * Math.PI * 2) / (C.respiro * (1 - 0.12 * pa))) % (Math.PI * 2);
    const resp = Math.sin(this.faseRespiro);
    const peso = Math.sin((t * Math.PI * 2) / C.peso + 1.3) * C.pesoAmp * fermo * inPiedi;
    this.ruota('petto', -K.respiro * DEG * resp * (0.6 + 0.4 * fermo) * (1 + K.respiroParla * pa));
    this.ruota('bacino', 0, 0, 1.6 * DEG * peso);
    this.ruota('schiena', 0, 0, -1.2 * DEG * peso);
    const fermoGambe = fermo * inPiedi;
    this.ruota('cosciaS', 0, 0, -1.6 * DEG * peso);
    this.ruota('cosciaD', 0, 0, -1.6 * DEG * peso);
    this.ruota('piedeS', 0, 0, 1.6 * DEG * peso);
    this.ruota('piedeD', 0, 0, 1.6 * DEG * peso);
    // il ginocchio che non porta il peso si sblocca appena
    this.ruota('stincoS', 3 * DEG * Math.max(0, -peso) * fermoGambe);
    this.ruota('stincoD', 3 * DEG * Math.max(0, peso) * fermoGambe);
    // abitudini: testa un po' inclinata, spalle un po' avanti
    this.ruota('collo', C.spalle * 0.5 * DEG, 0, C.inclina * 0.4 * DEG);
    this.ruota('testa', 0, 0, C.inclina * 0.6 * DEG);
    // la battuta: un cenno del capo lento (giù e su, velocità nulla ai capi) e, mentre parla, il capo che
    // si muove appena (tre seni lenti sul tempo continuo: a una battuta nuova niente riparte da capo)
    const cn = this.cenno;
    if (cn.t > 0 && cn.t < cn.durata) {
      const u = 0.5 * (1 - Math.cos((2 * Math.PI * cn.t) / cn.durata));
      this.ruota('collo', cn.amp * 0.3 * u * (1 - 0.5 * ch));
      this.ruota('testa', cn.amp * 0.7 * u * (1 - 0.5 * ch));
    }
    if (pa > 0.001) {
      const a = K.capo * DEG * pa * (this.opz.bambino ? 1.4 : 1) * (1 - 0.5 * ch);
      this.ruota('testa', a * (0.6 * Math.sin(t * 4.1 + 0.3) + 0.4 * Math.sin(t * 6.7 + 1.9)), a * 0.8 * Math.sin(t * 2.3 + 0.7), a * 0.5 * Math.sin(t * 3.1 + 2.2));
    }

    // --- curvo (anziani): schiena e collo avanti, testa che rialza lo sguardo
    const cv = this.curvo * (1 - sd * 0.5) * (1 - ch) * (1 - vl);
    let dy = 0;
    if (cv > 0.001) {
      this.ruota('schiena', 14 * DEG * cv);
      this.ruota('petto', 12 * DEG * cv);
      this.ruota('collo', 6 * DEG * cv);
      this.ruota('testa', -16 * DEG * cv);
      const g = cv * (1 - sd) * fermo;
      this.ruota('cosciaS', -6 * DEG * g);
      this.ruota('cosciaD', -6 * DEG * g);
      this.ruota('stincoS', 8 * DEG * g);
      this.ruota('stincoD', 8 * DEG * g);
      dy -= 0.012 * H * g;
    }

    // --- chino sul lavoro (la vasca, il muro): si piega all'anca, le ginocchia morbide, i piedi fermi
    if (ch > 0.001) {
      this.ruota('bacino', 34 * DEG * ch);
      this.ruota('schiena', 18 * DEG * ch);
      this.ruota('petto', 8 * DEG * ch);
      this.ruota('collo', -10 * DEG * ch);
      this.ruota('testa', -14 * DEG * ch);
    }

    // --- seduto: schiena un po' avanti; per terra un po' di più (le mani vanno sulle cosce)
    if (sd > 0.001) {
      this.ruota('schiena', (5 + 6 * (terra / Math.max(sd, 1e-3))) * DEG * sd);
      this.ruota('collo', 3 * DEG * sd);
    }

    // --- appeso al Velo: tutto il corpo avanti di 24° attorno alle spalle, un dondolio lento
    if (vl > 0.001) {
      const dond = Math.sin(t * 1.3) * 3 * DEG;
      this.ruota('bacino', (24 * DEG + dond) * vl, 0, Math.sin(t * 0.9) * 2 * DEG * vl);
      this.ruota('collo', -12 * DEG * vl);
      this.ruota('testa', -14 * DEG * vl);
    }

    // --- rotazioni accumulate del busto (servono ai bersagli dati nello spazio del modello)
    this.accumulaBusto();

    // --- spostamento della radice: seduta, chino, volo; poi il passo abbassa quanto serve
    const sp = this.spostamento;
    sp.set(0, dy, 0);
    if (sd > 0.001) {
      const quota = sed.terra ? sed.piedi + ANCA_TERRA * H : sed.sedile + ANCA_SEDUTA * H;
      sp.y += (quota - this.yAnche) * sd;
      sp.z += (sed.avanti - this.zAnche) * sd;
    }
    if (ch > 0.001) {
      // le anche vanno indietro e un po' giù per stare in equilibrio sui piedi
      sp.y -= 0.03 * H * ch;
      sp.z -= 0.07 * H * ch;
    }
    if (vl > 0.001) {
      // il corpo ruota attorno al bacino: si riporta su (le spalle restano sotto la barra) e un po' avanti
      sp.y += 0.04 * H * vl;
      sp.z += 0.03 * H * vl;
    }
    // girandosi a passi le ginocchia si sbloccano appena (e l'IK dei piedi resta lontano dalla gamba tesa)
    if (this.giroPeso > 0.001) sp.y -= 0.008 * H * this.giroPeso * inPiedi;

    // --- gambe: il passo (piedi a terra che non pattinano), la seduta, il chino, il volo
    if (k > 0.001 && inPiedi > 0.001) this.gambePasso(k * inPiedi, amp, passo, H);
    if (this.giroPeso > 0.001) this.gambeGiro(this.giroPeso * inPiedi * (1 - k), H);
    if (ch > 0.001) this.gambeFerme(ch * (1 - k));
    if (panca > 0.001) this.gambeSedute(panca, sed, H);
    if (terra > 0.001) this.gambePerTerra(terra, sed, H);
    if (vl > 0.001) {
      // le gambe pendono un po' indietro rispetto al corpo inclinato, le ginocchia appena piegate
      for (const L of LATI) {
        this.ruota(L.coscia, (8 + L.segno * 2 * Math.sin(t * 1.1)) * DEG * vl);
        this.ruota(L.stinco, 16 * DEG * vl);
        this.ruota(L.piede, 18 * DEG * vl);
      }
    }

    // --- sguardo (prima delle braccia: un busto che si gira sposta le spalle)
    this.sguardo(stato, d, fermo, ch, t);
    this.accumulaBusto();

    // --- braccia: giù dalla posa ad A, oscillano col passo, gomito un po' piegato
    const respSpalle = 0.6 * DEG * resp;
    const oscilla = C.oscilla * DEG * amp;
    // (il braccio opposto alla gamba: gamba S avanti, braccio S indietro)
    this.ruota('braccioS', oscilla * c, 0, -(this.abbassaBracciaS - respSpalle));
    this.ruota('braccioD', -oscilla * c, 0, this.abbassaBracciaD - respSpalle);
    this.ruota('avambraccioS', -(8 + 10 * amp * Math.max(0, -c)) * DEG);
    this.ruota('avambraccioD', -(8 + 10 * amp * Math.max(0, c)) * DEG);
    this.ruota('manoS', 0, 0, 4 * DEG);
    this.ruota('manoD', 0, 0, -4 * DEG);

    // --- posa delle braccia (IK sulle due mani), sotto i gesti
    const libero = 1 - this.gestoPeso * 0.999;
    if (this.posaPeso > 0.001) this.posaBraccia(this.posaAttiva, this.posaPeso * (1 - sd) * (1 - ch) * (1 - vl));
    // seduti: le mani in grembo, sul bastone o al lavoro; chini: nella vasca, sulle pietre
    if (sd > 0.001) this.maniSedute(sd, t);
    if (ch > 0.001) this.maniAlLavoro(ch, t, H);
    // il bastone: la mano destra lo tiene avanti, all'altezza del fianco (in piedi)
    if (this.opz.bastone) this.reggiBastone(inPiedi * (1 - 0.6 * k));

    // --- le mani su due punti (la barra del Velo), sopra le pose e sotto i gesti
    if (stato.mani) {
      this.maniS.copy(stato.mani.S);
      this.maniD.copy(stato.mani.D);
    }
    this.maniPeso = smorza(this.maniPeso, stato.mani ? 1 : 0, 6, d);
    if (this.maniPeso > 0.001) {
      this.raggiungiModello('S', _u.copy(this.maniS).sub(sp), this.maniPeso, 1);
      this.raggiungiModello('D', _u.copy(this.maniD).sub(sp), this.maniPeso, 1);
    }

    // --- il gesto della battuta (la mano libera che si apre davanti, o al petto), sotto quelli della storia
    if (this.gestoB) this.gestoBattuta(H, libero);

    // --- gesti della storia (mano destra, o sinistra se la destra tiene qualcosa), sfumati
    if (this.gestoPeso > 0.001) this.gesto(this.gestoAttivo, this.gestoPeso, t, stato.indica ?? null);

    // --- scrive le ossa: riposo · W⁻¹ · R · W
    for (const o of this.lista) {
      _q.copy(o.Winv).multiply(o.R).multiply(o.W);
      o.osso.quaternion.copy(o.riposo).multiply(_q);
    }
  }

  /** Rotazioni accumulate e posizioni di bacino, schiena e petto (spazio del modello, senza spostamento). */
  private accumulaBusto(): void {
    const b = this.o('bacino');
    const sc = this.o('schiena');
    const pe = this.o('petto');
    this.C.bacino.copy(b.R);
    this.C.schiena.copy(b.R).multiply(sc.R);
    this.C.petto.copy(this.C.schiena).multiply(pe.R);
    this.P.schiena.copy(sc.attacco).sub(b.attacco).applyQuaternion(this.C.bacino).add(b.attacco);
    this.P.petto.copy(pe.attacco).sub(sc.attacco).applyQuaternion(this.C.schiena).add(this.P.schiena);
  }

  /** Un punto dello spazio del modello portato nel riferimento di riposo del bacino (gambe) o del petto (braccia). */
  private nelRiposo(padre: 'bacino' | 'petto', p: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    const C = this.C[padre];
    const A = this.o(padre).attacco;
    const P = padre === 'bacino' ? A : this.P.petto;
    _qc.copy(C).invert();
    return out.copy(p).sub(P).applyQuaternion(_qc).add(A);
  }

  /** Una direzione dello spazio del modello nel riferimento di riposo del padre. */
  private direzioneNelRiposo(padre: 'bacino' | 'petto', dir: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    _qc.copy(this.C[padre]).invert();
    return out.copy(dir).applyQuaternion(_qc);
  }

  /** L'anca di un lato nello spazio del modello (senza spostamento), con il bacino ruotato. */
  private anca(L: Lato, out: THREE.Vector3): THREE.Vector3 {
    const b = this.o('bacino').attacco;
    return out.copy(this.o(L.coscia).attacco).sub(b).applyQuaternion(this.C.bacino).add(b);
  }

  /**
   * IK di una gamba: la caviglia sul punto `caviglia` (spazio del SUOLO, cioè del modello più lo
   * spostamento), il ginocchio verso `polo` (spazio del modello), il piede inclinato di `beccheggio`
   * (Rx, + = punta giù) rispetto al suolo.
   */
  private gambaIK(L: Lato, caviglia: THREE.Vector3, polo: THREE.Vector3, beccheggio: number, peso: number, imbardata = 0): void {
    if (peso <= 0.0005) return;
    const sp = this.spostamento;
    _bersaglio2.copy(caviglia).sub(sp);
    this.nelRiposo('bacino', _bersaglio2, _bersaglio2);
    this.direzioneNelRiposo('bacino', polo, _polo);
    this.ik2(this.o(L.coscia), this.o(L.stinco), this.o(L.piede), _bersaglio2, _polo, peso, 0.998);
    // il ginocchio (per chi mette le mani sulle cosce)
    const co = this.o(L.coscia);
    const st = this.o(L.stinco);
    _qa.copy(this.C.bacino).multiply(co.R);
    this.anca(L, this.ginocchio[L.lato]).add(_u.copy(st.attacco).sub(co.attacco).applyQuaternion(_qa));
    // il piede: rotazione accumulata voluta = Rx(beccheggio); R_piede = (C_bacino · R_coscia · R_stinco)⁻¹ · Rx
    const pi = this.o(L.piede);
    _qa.copy(this.C.bacino).multiply(co.R).multiply(st.R).invert();
    _qb.setFromAxisAngle(ASSE_X, beccheggio);
    // il piede girato attorno alla verticale (i piedi rimasti a terra mentre il corpo si gira)
    if (imbardata) _qb.premultiply(_qc.setFromAxisAngle(ASSE_Y, imbardata));
    _qa.multiply(_qb);
    pi.R.slerp(_qa, peso);
  }

  /**
   * Il corpo intero si è girato di `dg` rad (StatoPersonaggio.giro): il piede a terra resta dov'è (rispetto
   * al corpo gira al contrario); quando un piede è girato più di `CONVERSAZIONE.passoGiro` rispetto al corpo
   * fa un passo breve per tornargli sotto (posandosi un filo avanti nel verso del giro), poi l'altro. A
   * corpo fermo, i piedi rimasti storti si sistemano con un passo. Seduti, chini, in cammino o dopo un salto
   * i piedi tornano subito sotto il corpo (non c'è niente da seguire).
   */
  private aggiornaGiro(dg: number, d: number, inPiedi: number, k: number): void {
    const K = CONVERSAZIONE;
    const pg = this.piedeGiro;
    if (Math.abs(dg) > 1.2 || inPiedi < 0.5 || k > 0.3) {
      pg.S = 0;
      pg.D = 0;
      this.passoGiro = null;
      this.giroVel = 0;
      this.giroPeso = Math.abs(dg) > 1.2 ? 0 : smorza(this.giroPeso, 0, 6, d);
      this.giroPesoM.v = 0;
      return;
    }
    if (d <= 0) return;
    this.giroVel = smorza(this.giroVel, dg / d, 8, d);
    const ps = this.passoGiro;
    for (const L of LATI) if (ps?.lato !== L.lato) pg[L.lato] -= dg;
    if (ps) {
      ps.t += d / K.passoGiroDurata;
      pg[ps.lato] = ps.da + (ps.a - ps.da) * morbido(ps.t);
      if (ps.t >= 1) this.passoGiro = null;
    }
    const gira = Math.abs(this.giroVel) > 0.25;
    this.fermoGiro = gira ? 0 : this.fermoGiro + d;
    if (!this.passoGiro) {
      // dove si posa un piede: un filo avanti nel verso del giro se il corpo sta ancora girando, se no sotto il corpo
      const avanti = gira ? THREE.MathUtils.clamp(this.giroVel * K.passoGiroDurata * 0.5, -0.18, 0.18) : 0;
      // il piede più lontano da lì fa il passo (a pari merito quello dal lato verso cui si gira)
      const sS = Math.abs(pg.S - avanti);
      const sD = Math.abs(pg.D - avanti);
      const lato: 'S' | 'D' = sS > sD + 1e-4 ? 'S' : sD > sS + 1e-4 ? 'D' : this.giroVel >= 0 ? 'S' : 'D';
      const scarto = lato === 'S' ? sS : sD;
      if (scarto > K.passoGiro || (this.fermoGiro > 0.4 && scarto > 0.03)) this.passoGiro = { lato, t: 0, da: pg[lato], a: avanti };
    }
    const serve = this.passoGiro || Math.abs(pg.S) > 0.003 || Math.abs(pg.D) > 0.003 ? 1 : 0;
    // (una molla: l'IK dei piedi entra e esce senza gradini di velocità)
    this.giroPesoM.x = this.giroPeso;
    molla(this.giroPesoM, serve, 7, d);
    this.giroPeso = THREE.MathUtils.clamp(this.giroPesoM.x, 0, 1);
  }

  /** Le gambe con i piedi girati (aggiornaGiro): la caviglia ruotata attorno alla verticale, il passo in aria. */
  private gambeGiro(peso: number, H: number): void {
    if (peso <= 0.001) return;
    const ps = this.passoGiro;
    for (const L of LATI) {
      const ang = this.piedeGiro[L.lato];
      const r = this.o(L.piede).attacco;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      // rotazione attorno a +Y: x' = x·c + z·s, z' = -x·s + z·c (nello spazio del suolo: a riposo i piedi ci posano)
      _bersaglio.set(r.x * c + r.z * s, r.y, -r.x * s + r.z * c);
      let becc = 0;
      if (ps && ps.lato === L.lato) {
        // su e giù alla quarta del seno: il piede si stacca e si posa a velocità nulla, e il ginocchio (che
        // vicino alla gamba tesa si piega come la radice dell'alzata) parte e si ferma morbido
        const a = Math.sin(Math.PI * THREE.MathUtils.clamp(ps.t, 0, 1)) ** 4;
        _bersaglio.y += CONVERSAZIONE.passoGiroAlzata * H * a;
        becc = 8 * DEG * a;
      }
      // il ginocchio a metà fra il davanti del bacino e quello del piede
      const c2 = Math.cos(ang / 2);
      const s2 = Math.sin(ang / 2);
      const px = L.segno * 0.08;
      _polo.set(px * c2 + s2, 0, -px * s2 + c2);
      this.gambaIK(L, _bersaglio, _polo, becc, peso, ang);
    }
  }

  /** Il ciclo del passo per le due gambe e l'abbassamento del bacino che serve perché ci arrivino. */
  private gambePasso(peso: number, amp: number, passo: number, H: number): void {
    const sp = this.spostamento;
    const alzata = (this.opz.bambino ? ALZATA.bambino : ALZATA.adulto) * H;
    const beta = APPOGGIO;
    // corsa della caviglia rispetto al corpo: in appoggio va indietro di 2·β·passo (quanto avanza il
    // corpo nello stesso tempo); un po' più indietro che avanti (il piede si posa sotto il corpo)
    // (la fase va con la distanza: la corsa NON si scala con la velocità, se no il piede scivola)
    const a = beta * passo;
    const centro = -0.12 * a;
    const ampPeso = Math.min(1, amp / 0.6);
    // bersagli delle caviglie (spazio del suolo) e beccheggio del piede
    let abbassa = 0;
    for (const L of LATI) {
      const fl = (this.fase + (L.lato === 'D' ? 0.5 : 0)) % 1;
      const xr = this.o(L.piede).attacco.x * 0.86;
      const zr = this.o(L.piede).attacco.z;
      const cav = this.caviglie[L.lato];
      let becc = 0;
      if (fl < beta) {
        // appoggio: la punta resta dov'è; nell'ultimo quarto il tallone si alza sulla punta
        const u = fl / beta;
        const zPunta = zr + this.piedeL + centro + a * (1 - 2 * u);
        becc = 28 * DEG * liscio(0.68, 1, u) * ampPeso;
        // caviglia = punta - Rx(becc)·(punta - caviglia a riposo)
        const dyP = this.yCaviglia - 0.012 * H;
        cav.set(xr, 0.012 * H + dyP * Math.cos(becc) + this.piedeL * Math.sin(becc), zPunta - this.piedeL * Math.cos(becc) + dyP * Math.sin(becc));
      } else {
        // in volo: dalla spinta al passo dopo, in una curva morbida
        const w = (fl - beta) / (1 - beta);
        const e = liscio(0, 1, w);
        const zStacco = zr + centro - a;
        const yStacco = this.yCaviglia + this.piedeL * Math.sin(28 * DEG * ampPeso) * 0.9;
        const zPosa = zr + centro + a;
        becc = (28 * (1 - liscio(0, 0.45, w)) - 10 * Math.sin(Math.PI * liscio(0.4, 1, w))) * DEG * ampPeso;
        cav.set(xr, yStacco + (this.yCaviglia - yStacco) * e + alzata * Math.sin(Math.PI * w) ** 1.2 * ampPeso, zStacco + (zPosa - zStacco) * e);
      }
      // quanto deve scendere il bacino perché questa gamba ci arrivi (0,985 della lunghezza, mai tesa)
      this.anca(L, _v);
      const oriz = Math.hypot(_v.x + sp.x - cav.x, _v.z + sp.z - cav.z);
      const Lmax = 0.985 * (this.L1g + this.L2g);
      const vert = Math.sqrt(Math.max(Lmax * Lmax - oriz * oriz, 0));
      abbassa = Math.min(abbassa, vert - (_v.y + sp.y - cav.y));
      this.beccheggio[L.lato] = becc;
    }
    // il bacino scende quanto serve (sfumato col peso del passo) e ondeggia sulla gamba d'appoggio
    sp.y += abbassa * peso;
    sp.x += 0.012 * H * Math.sin(this.fase * Math.PI * 2) * amp;
    for (const L of LATI) {
      _polo.set(L.segno * 0.08, 0, 1);
      // a passo minimo i bersagli sfumano verso la posa da fermi (le caviglie a riposo)
      const cav = this.caviglie[L.lato];
      _w.copy(this.o(L.piede).attacco);
      _w.lerp(cav, Math.min(1, peso * 1.2));
      this.gambaIK(L, _w, _polo, this.beccheggio[L.lato] * peso, peso);
    }
  }

  /** I piedi fermi dove sono a riposo (chino: il bacino va indietro e giù, le ginocchia si piegano). */
  private gambeFerme(peso: number): void {
    for (const L of LATI) {
      _polo.set(L.segno * 0.1, 0, 1);
      this.gambaIK(L, this.o(L.piede).attacco, _polo, 0, peso);
    }
  }

  /** Seduto su un piano alto (panca, gradino, soglia): le cosce avanti, i piedi giù sul piano dei piedi. */
  private gambeSedute(peso: number, sed: Seduta, H: number): void {
    for (const L of LATI) {
      // il ginocchio a una coscia di distanza davanti all'anca; la caviglia sotto il ginocchio, sul piano dei piedi
      const xa = this.o(L.coscia).attacco.x;
      const x = xa * 1.25 + L.segno * 0.012 * H;
      // il ginocchio a una coscia davanti all'anca, appena più basso; la caviglia sotto: sul piano dei piedi
      // se ci arriva, altrimenti (panca alta, gambe corte) lo stinco pende dritto e i piedi restano su
      const yAnca = sed.sedile + ANCA_SEDUTA * H;
      const z = sed.avanti + this.L1g * (this.opz.gonna ? 0.9 : 0.95) + 0.02 * H;
      const yGinocchio = yAnca - 0.02 * H;
      _bersaglio.set(x, Math.max(sed.piedi + this.yCaviglia, yGinocchio - this.L2g * 0.995), z);
      _polo.set(L.segno * 0.15, 0.35, 1);
      this.gambaIK(L, _bersaglio, _polo, -4 * DEG, peso);
    }
  }

  /**
   * Seduto per terra: senza veste lunga le gambe incrociate davanti, con la veste lunga distese avanti
   * (i talloni sul suolo).
   */
  private gambePerTerra(peso: number, sed: Seduta, H: number): void {
    const z0 = sed.avanti;
    for (const L of LATI) {
      if (this.opz.gonna) {
        // le gambe distese avanti, appena piegate e un po' aperte, i talloni a terra e le punte in su: la
        // veste segue cosce e stinchi come sulla panca (con le ginocchia raccolte la stoffa fra ginocchia
        // e suolo si strappava)
        _bersaglio.set(L.segno * 0.075 * H, sed.piedi + this.yCaviglia, z0 + (this.L1g + this.L2g) * 0.93);
        _polo.set(L.segno * 0.1, 1, 0.2);
        this.gambaIK(L, _bersaglio, _polo, -45 * DEG, peso);
      } else {
        // la caviglia sinistra davanti alla destra, ognuna sotto il ginocchio dell'altra
        // (la punta appena in su: con la punta in giù le scarpe entravano 5 cm nel suolo)
        const davanti = L.lato === 'S' ? 0.035 * H : 0;
        _bersaglio.set(-L.segno * 0.07 * H, sed.piedi + this.yCaviglia, z0 + 0.13 * H + davanti);
        _polo.set(L.segno * 1, 0.55, 0.3);
        this.gambaIK(L, _bersaglio, _polo, -10 * DEG, peso);
      }
    }
  }

  /**
   * Lo sguardo: testa e collo verso il punto (in spazio modello), con limiti e inerzia. Una molla
   * smorzata (non più un inseguimento del primo ordine): quando il punto cambia di colpo la testa parte e
   * si ferma piano, senza scatti, e non supera `CONVERSAZIONE.sguardoVmax`. Chi è chino sul lavoro gira
   * la testa poco (Togna alla vasca «non si gira»).
   */
  private sguardo(stato: StatoPersonaggio, d: number, fermo: number, ch: number, t: number): void {
    const C = this.carattere;
    const K = CONVERSAZIONE;
    let yawB = 0;
    let pitchB = 0;
    const limite = (75 - 40 * ch) * DEG;
    if (stato.guarda) {
      _v.copy(stato.guarda);
      this.radice.worldToLocal(_v);
      _w.copy(_v).sub(this.o('testa').attacco);
      const ang = Math.atan2(_w.x, _w.z);
      yawB = THREE.MathUtils.clamp(ang, -limite, limite);
      const oriz = Math.hypot(_w.x, _w.z);
      pitchB = THREE.MathUtils.clamp(-Math.atan2(_w.y, oriz), -30 * DEG, (35 - 15 * ch) * DEG);
      // dietro le spalle: si gira fin dove può, dal lato da cui è già girato (prima seguiva il segno di x
      // e a chi passava dietro la testa scattava da una spalla all'altra)
      if (_w.z < 0 && Math.abs(ang) > 100 * DEG) yawB = Math.sign(this.yaw.x || _w.x || 1) * limite;
    } else {
      // sguardi distratti quando è fermo
      const fq = C.sguardoF;
      yawB = (Math.sin(t * 0.37 * fq + 1.1) * 0.6 + Math.sin(t * 0.13 * fq) * 0.4) * C.sguardoAmp * DEG * fermo * (1 - ch * 0.7);
      pitchB = Math.sin(t * 0.29 * fq + 2) * 4 * DEG * fermo;
    }
    molla(this.yaw, yawB, K.sguardoK, d, K.sguardoVmax * DEG);
    molla(this.pitch, pitchB, K.sguardoK, d, K.sguardoVmax * DEG);
    const yaw = this.yaw.x;
    const pitch = this.pitch.x;
    // oltre 45° gira anche il busto (metà del resto), poi collo e testa; il passaggio è morbido (prima
    // max(0, |yaw| - 45°) aveva uno spigolo a 45°)
    const oltre = Math.abs(yaw) - 45 * DEG;
    const busto = (oltre > -10 * DEG ? (oltre < 10 * DEG ? (oltre + 10 * DEG) ** 2 / (40 * DEG) : oltre) : 0) * Math.sign(yaw);
    this.ruota('petto', 0, busto * 0.5);
    this.ruota('collo', pitch * 0.35, (yaw - busto * 0.5) * 0.4);
    this.ruota('testa', pitch * 0.65, (yaw - busto * 0.5) * 0.6);
  }

  /**
   * Il gesto di una battuta (annunciaBattuta): entra e esce a mezzo coseno, tiene per un po' con un piccolo
   * battito della mano. Solo con la mano libera: chi è chino, cammina, è appeso al Velo, tiene la barra,
   * ha le braccia conserte o le mani dietro, è seduto col bastone o con le forbici non lo fa (sfuma via
   * se nel frattempo il corpo passa a una di queste pose).
   *  - «apre»: la mano davanti al ventre, un po' di lato, il gomito piegato lungo il fianco (il percorso della
   *    mano va avanti e in su, fuori dal corpo);
   *  - «mano-al-petto»: la mano sul petto dal suo lato (prima attraversava la linea di mezzo).
   */
  private gestoBattuta(H: number, libero: number): void {
    const g = this.gestoB;
    if (!g) return;
    const K = CONVERSAZIONE;
    const fine = K.gestoEntra + g.tiene + K.gestoEsce;
    if (g.t >= fine) {
      this.gestoB = null;
      return;
    }
    if (g.t <= 0) return;
    let w = g.t < K.gestoEntra ? morbido(g.t / K.gestoEntra) : g.t < K.gestoEntra + g.tiene ? 1 : 1 - morbido((g.t - K.gestoEntra - g.tiene) / K.gestoEsce);
    // le mani occupate o il corpo che fa altro
    const posaOccupa = this.posaAttiva === 'braccia-conserte' || this.posaAttiva === 'mani-dietro' ? this.posaPeso : 0;
    const sedutaOccupa = this.maniSedutaAttive !== 'grembo' ? this.seduto : 0;
    w *= (1 - this.cammino) * (1 - this.chino) * (1 - this.volo) * (1 - this.maniPeso) * (1 - posaOccupa) * (1 - sedutaOccupa) * libero;
    if (w < 0.001) return;
    const L = LATO[g.lato];
    const sg = L.segno;
    if (g.tipo === 'apre') {
      const bac = this.o('bacino').attacco;
      const spalla = this.o(L.braccio).attacco;
      // un battito lento della mano mentre tiene (sale e scende di un centimetro e mezzo)
      const batti = Math.sin((g.t - K.gestoEntra) * 4.2) * 0.009 * H * w * w;
      _bersaglio.set(spalla.x * 0.8, bac.y + 0.12 * H + batti, this.fronteBusto + 0.11 * H);
      this.raggiungi(L.lato, _bersaglio, w, 0.84);
      // il palmo appena verso l'alto e la mano un po' aperta in fuori
      this.ruota(L.mano, -8 * DEG * w, 0, -sg * 6 * DEG * w);
    } else {
      const petto = this.o('petto').attacco;
      const collo = this.o('collo').attacco;
      _bersaglio.set(sg * 0.025 * H, petto.y + 0.28 * (collo.y - petto.y), this.fronteBusto + 0.04 * H);
      this.raggiungi(L.lato, _bersaglio, w, 0.9);
      this.ruota(L.mano, -14 * DEG * w, 0, sg * 18 * DEG * w);
    }
  }

  private gesto(gesto: GestoPersonaggio, g: number, t: number, indica: THREE.Vector3 | null): void {
    // la mano dei gesti: la destra, o la sinistra se la destra tiene qualcosa (bastone, pietra)
    const L = this.opz.manoDOccupata ? LATO.S : LATO.D;
    const sg = L.segno;
    const giaAbbassato = L.lato === 'D' ? this.abbassaBracciaD : this.abbassaBracciaS;
    if (gesto === 'saluta') {
      this.ruota(L.braccio, 0, 0, sg * (giaAbbassato + 70 * DEG) * g);
      this.ruota(L.avambraccio, 0, 0, sg * (75 - 18 * Math.sin(t * 9)) * DEG * g);
      this.ruota(L.mano, 0, 0, sg * 10 * DEG * g);
    } else if (gesto === 'indica') {
      // il braccio intero verso il punto (nel riferimento del petto), avambraccio dritto
      if (indica) {
        _v.copy(indica);
        this.radice.worldToLocal(_v);
        this.nelRiposo('petto', _v, _v);
        _v.sub(this.o(L.braccio).attacco);
      } else _v.set(sg * 0.25, -0.15, 1);
      if (_v.lengthSq() < 1e-8) _v.set(0, 0, 1);
      _v.normalize();
      _qa.setFromUnitVectors(L.lato === 'D' ? this.dirBraccioD : this.dirBraccioS, _v);
      // sostituisce la rotazione del braccio (sfumata)
      this.o(L.braccio).R.slerp(_qa, g);
      this.o(L.avambraccio).R.slerp(IDENTITA, g);
    } else if (gesto === 'mano-al-petto') {
      // la mano sul petto, un po' verso il centro, davanti al busto (riferimento del petto)
      const petto = this.o('petto').attacco;
      const collo = this.o('collo').attacco;
      _bersaglio.set(-sg * 0.03 * this.altezza, petto.y + 0.3 * (collo.y - petto.y), this.fronteBusto + 0.035 * this.altezza);
      this.raggiungi(L.lato, _bersaglio, g);
      this.ruota(L.mano, -20 * DEG * g, 0, sg * 25 * DEG * g);
    }
  }

  private posaBraccia(posa: PosaBraccia, p: number): void {
    if (p <= 0.001) return;
    const H = this.altezza;
    const petto = this.o('petto').attacco;
    const fronte = this.fronteBusto;
    const bacino = this.o('bacino').attacco;
    if (posa === 'mani-giunte') {
      // le mani una sull'altra davanti alla pancia, i gomiti piegati lungo i fianchi
      const y = bacino.y + 0.1 * H;
      this.raggiungi('S', _bersaglio.set(0.015 * H, y, fronte + 0.04 * H), p, ESTENSIONE_POSE.giunte);
      this.raggiungi('D', _bersaglio.set(-0.015 * H, y - 0.01 * H, fronte + 0.055 * H), p, ESTENSIONE_POSE.giunte);
    } else if (posa === 'braccia-conserte') {
      // ogni mano verso il gomito opposto, appena davanti al petto (mai davanti al velo che pende)
      const y = petto.y - 0.02 * H;
      const z = Math.max(petto.z + 0.08 * H, fronte + 0.015 * H);
      this.raggiungi('S', _bersaglio.set(-0.1 * H, y, z), p, ESTENSIONE_POSE.conserte);
      this.raggiungi('D', _bersaglio.set(0.1 * H, y + 0.02 * H, z + 0.02 * H), p, ESTENSIONE_POSE.conserte);
    } else if (posa === 'mani-dietro') {
      // le mani dietro la schiena, sopra il bacino (più in basso il braccio sarebbe tutto teso)
      const dietro = this.retroBusto - 0.02 * H;
      this.raggiungi('S', _bersaglio.set(0.03 * H, bacino.y + 0.08 * H, dietro), p, ESTENSIONE_POSE.dietro);
      this.raggiungi('D', _bersaglio.set(-0.03 * H, bacino.y + 0.09 * H, dietro - 0.01 * H), p, ESTENSIONE_POSE.dietro);
    }
  }

  /** Seduti: le mani sulle cosce verso le ginocchia, sul pomo del bastone, o col cartone e le forbici. */
  private maniSedute(p: number, t: number): void {
    if (p <= 0.001) return;
    const H = this.altezza;
    const modo = this.maniSedutaAttive;
    const sed = this.sedutaAttiva;
    if (modo === 'bastone' && !sed.terra) {
      // le mani una sull'altra sul pomo del bastone, che sta fra le ginocchia
      _bersaglio.copy(this.ginocchio.S).add(this.ginocchio.D).multiplyScalar(0.5);
      _bersaglio.y += 0.13 * H;
      _bersaglio.z += 0.04 * H;
      this.raggiungiModello('D', _bersaglio, p, 0.92);
      _bersaglio.y += 0.035 * H;
      _bersaglio.x += 0.01 * H;
      this.raggiungiModello('S', _bersaglio, p, 0.92);
      return;
    }
    if (modo === 'forbici') {
      // il cartone tenuto in grembo con la sinistra, le forbici nella destra che tagliano piano
      const taglio = Math.sin(t * 1.4) * 0.012 * H;
      _bersaglio.copy(this.ginocchio.S).add(this.ginocchio.D).multiplyScalar(0.5).lerp(this.anca(LATO.S, _w), 0.45);
      _bersaglio.y += 0.11 * H;
      _bersaglio.x += 0.02 * H;
      this.raggiungiModello('S', _bersaglio, p, 0.92);
      _bersaglio.x -= 0.075 * H;
      _bersaglio.y += 0.03 * H + taglio;
      _bersaglio.z += 0.02 * H;
      this.raggiungiModello('D', _bersaglio, p, 0.92);
      return;
    }
    for (const L of LATI) {
      // sulla coscia, verso il ginocchio, un po' all'esterno (non in mezzo al grembo)
      this.anca(L, _w);
      _bersaglio.copy(_w).lerp(this.ginocchio[L.lato], 0.7);
      _bersaglio.y += 0.065 * H;
      _bersaglio.x += L.segno * 0.02 * H;
      this.raggiungiModello(L.lato, _bersaglio, p, 0.95);
    }
  }

  /** Chini: le mani avanti e in basso (nella vasca, sulle pietre), che strofinano piano avanti e indietro. */
  private maniAlLavoro(p: number, t: number, H: number): void {
    if (p <= 0.001) return;
    const sp = this.spostamento;
    const strofina = Math.sin(t * 2.6) * 0.04;
    for (const L of LATI) {
      // nello spazio del suolo: 0,44·H da terra, 0,27·H davanti ai piedi (la vasca, l'acqua)
      _bersaglio.set(L.segno * 0.085 * H, 0.44 * H, 0.27 * H + strofina * L.segno);
      _bersaglio.sub(sp);
      this.raggiungiModello(L.lato, _bersaglio, p, 0.97);
      this.ruota(L.mano, 25 * DEG * p);
    }
  }

  /** La mano destra regge il bastone: avanti e di lato, all'altezza del fianco. */
  private reggiBastone(p: number): void {
    if (p <= 0.001) return;
    const H = this.altezza;
    const spalla = this.o('braccioD').attacco;
    this.raggiungi('D', _bersaglio.set(spalla.x - 0.035 * H, 0.52 * H, this.fronteBusto + 0.07 * H), p, 0.85);
  }

  /**
   * Porta il polso sul punto `bersaglio` dello spazio del MODELLO (senza spostamento) qualunque sia la
   * piega del busto: il punto passa nel riferimento di riposo del petto e poi `raggiungi`.
   */
  raggiungiModello(lato: 'S' | 'D', bersaglio: THREE.Vector3, peso = 1, estensione = 1): void {
    this.nelRiposo('petto', bersaglio, _bersaglio2);
    this.raggiungi(lato, _bersaglio2, peso, estensione);
  }

  /**
   * IK a due ossa: porta il polso del lato dato sul punto `bersaglio` (spazio del modello, con il busto
   * a riposo), con il gomito verso fuori, in basso e indietro. `peso` sfuma dalla posa calcolata finora.
   * `estensione` (0..1) limita la distanza spalla-polso a quella frazione del braccio: il gomito si piega
   * davvero (le pose delle braccia usano ESTENSIONE_POSE). Non tiene `bersaglio`.
   */
  raggiungi(lato: 'S' | 'D', bersaglio: THREE.Vector3, peso = 1, estensione = 1): void {
    if (peso <= 0) return;
    const L = LATO[lato];
    _polo.set(L.segno * 0.6, -0.5, -0.6);
    this.ik2(this.o(L.braccio), this.o(L.avambraccio), this.o(L.mano), bersaglio, _polo, peso, estensione);
  }

  /**
   * IK a due ossa generica (riferimento di riposo del padre di `a`): la fine di `b` (l'attacco di `c`)
   * va su `bersaglio`, il gomito o il ginocchio verso `polo`.
   */
  private ik2(a: Osso, b: Osso, c: Osso, bersaglio: THREE.Vector3, polo: THREE.Vector3, peso: number, estensione: number): void {
    const S = a.attacco;
    const L1 = b.attacco.distanceTo(S);
    const L2 = c.attacco.distanceTo(b.attacco);
    _d1.copy(b.attacco).sub(S).normalize();
    _d2.copy(c.attacco).sub(b.attacco).normalize();
    _D.copy(bersaglio).sub(S);
    const dist = THREE.MathUtils.clamp(_D.length(), Math.abs(L1 - L2) + 1e-3, Math.min(L1 + L2 - 1e-3, (L1 + L2) * estensione));
    _D.normalize();
    const cosA = THREE.MathUtils.clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    _n.copy(polo);
    _n.addScaledVector(_D, -_n.dot(_D));
    if (_n.lengthSq() < 1e-10) _n.set(0, 0, 1).addScaledVector(_D, -_D.z);
    _n.normalize();
    _gomito.copy(S).addScaledVector(_D, L1 * cosA).addScaledVector(_n, L1 * sinA);
    _polso.copy(S).addScaledVector(_D, dist);
    // direzioni nuove delle due ossa
    _w.copy(_gomito).sub(S).normalize();
    _v.copy(_polso).sub(_gomito).normalize();
    _qa.setFromUnitVectors(_d1, _w);
    _qb.copy(_qa).invert();
    _v.applyQuaternion(_qb);
    _qb.setFromUnitVectors(_d2, _v);
    a.R.slerp(_qa, peso);
    b.R.slerp(_qb, peso);
  }
}
