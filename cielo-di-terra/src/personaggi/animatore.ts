/**
 * Animazione procedurale dello scheletro dei personaggi generati (vedi ossa.ts): niente clip, solo
 * rotazioni calcolate a ogni fotogramma, come per gli abitanti procedurali (update(dt, stato)).
 *
 * Le rotazioni si scrivono nello SPAZIO DEL MODELLO (X = sinistra del personaggio, Y = alto,
 * Z = avanti), indipendenti dal rollio delle ossa esportate da Blender:
 *     osso.quaternion = riposo · W⁻¹ · R · W
 * dove W è l'orientamento di riposo dell'osso nello spazio del modello. Così R ruota l'osso attorno
 * al suo attacco come se il padre fosse a riposo, e la catena (braccio → avambraccio → mano) si
 * compone da sola.
 *
 * Segni utili (spazio del modello):
 *  - Rx(+) piega in avanti la schiena e la testa, porta INDIETRO coscia e braccio, piega il ginocchio;
 *  - Rx(-) porta avanti coscia, braccio e avambraccio (la mano verso +Z);
 *  - Rz(-) abbassa il braccio S (sinistro), Rz(+) abbassa il braccio D;
 *  - Ry(+) gira la testa verso la propria sinistra (+X).
 */
import * as THREE from 'three';
import { NOMI_OSSA, type NomeOsso } from './ossa';

export type GestoPersonaggio = 'nessuno' | 'saluta' | 'indica' | 'mano-al-petto';

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
  /** 0..1: quanto sta curvo (anziani; Togna china sulla vasca = 1) */
  curvo?: number;
  /** posa delle braccia da fermi (come la «postura» degli abitanti procedurali) */
  braccia?: PosaBraccia;
}

export type PosaBraccia = 'libere' | 'mani-giunte' | 'braccia-conserte' | 'mani-dietro';

export interface OpzioniAnimatore {
  /** apertura delle braccia a riposo, in gradi dalla verticale (abbastanza da non entrare nei fianchi) */
  apertura?: number;
  /** veste lunga: passo più corto, ginocchia meno piegate */
  gonna?: boolean;
  /** sfasamento (s) del respiro e degli sguardi, per non avere tutti all'unisono */
  sfasamento?: number;
  /** altezza del personaggio in m (se manca, stimata dall'attacco della testa) */
  altezza?: number;
  /** z (m) della superficie davanti al petto, nello spazio del modello: dove appoggiare le mani */
  fronteBusto?: number;
}

const _q = new THREE.Quaternion();
const _r = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _m = new THREE.Matrix4();

interface Osso {
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

export class AnimatorePersonaggio {
  readonly radice: THREE.Object3D;
  readonly ossa = new Map<NomeOsso, Osso>();
  /** altezza a riposo (cima della testa), per le ampiezze */
  readonly altezza: number;
  private readonly opz: Required<Omit<OpzioniAnimatore, 'altezza' | 'fronteBusto'>>;
  /** z della superficie del petto (per le mani) */
  readonly fronteBusto: number;
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
  /** abbassamento del bacino durante il passo (m): chi usa l'animatore lo somma alla y del modello */
  abbassamento = 0;
  private readonly abbassaBracciaS: number;
  private readonly abbassaBracciaD: number;
  private readonly dirBraccioD = new THREE.Vector3();

  constructor(radice: THREE.Object3D, opz: OpzioniAnimatore = {}) {
    this.radice = radice;
    this.opz = { apertura: opz.apertura ?? 9, gonna: opz.gonna ?? false, sfasamento: opz.sfasamento ?? 0 };
    this.t = this.opz.sfasamento;
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
      this.ossa.set(nome, { osso, riposo: osso.quaternion.clone(), W, Winv: W.clone().invert(), attacco, R: new THREE.Quaternion() });
    }
    const testa = this.o('testa');
    // la cima: l'attacco della testa più la sua lunghezza (le ossa finali non hanno figli: stimata)
    this.altezza = opz.altezza ?? testa.attacco.y / 0.87;
    this.fronteBusto = opz.fronteBusto ?? this.o('petto').attacco.z + 0.1 * this.altezza;
    // quanto abbassare le braccia dalla posa ad A (gradi), misurato dall'osso del braccio
    const ang = (n: 'S' | 'D') => {
      const a = this.o(`braccio${n}`).attacco;
      const b = this.o(`avambraccio${n}`).attacco;
      return Math.atan2(Math.abs(b.x - a.x), a.y - b.y);
    };
    const ap = THREE.MathUtils.degToRad(this.opz.apertura);
    this.abbassaBracciaS = Math.max(0, ang('S') - ap);
    this.abbassaBracciaD = Math.max(0, ang('D') - ap);
    this.dirBraccioD.copy(this.o('avambraccioD').attacco).sub(this.o('braccioD').attacco).normalize();
  }

  private o(nome: string): Osso {
    return this.ossa.get(nome as NomeOsso) as Osso;
  }

  /** Aggiunge (in coda) una rotazione in spazio modello all'osso: prima Z, poi X, poi Y (gradi→radianti già fatti). */
  private ruota(nome: NomeOsso, rx: number, ry = 0, rz = 0): void {
    const o = this.ossa.get(nome) as Osso;
    _e.set(rx, ry, rz, 'YXZ');
    _r.setFromEuler(_e);
    o.R.premultiply(_r);
  }

  update(dt: number, stato: StatoPersonaggio = {}): void {
    const d = Math.min(dt, 0.1);
    this.t += d;
    const t = this.t;
    const H = this.altezza;
    for (const o of this.ossa.values()) o.R.identity();

    // --- stati che sfumano
    const camminaOra = stato.modo === 'cammina' ? 1 : 0;
    this.cammino = smorza(this.cammino, camminaOra, 6, d);
    this.velocita = smorza(this.velocita, stato.velocita ?? (camminaOra ? 1.1 : 0), 4, d);
    this.curvo = smorza(this.curvo, stato.curvo ?? 0, 3, d);
    const posa = stato.braccia ?? 'libere';
    if (posa !== this.posaAttiva && this.posaPeso < 0.02) this.posaAttiva = posa;
    this.posaPeso = smorza(this.posaPeso, posa === this.posaAttiva && posa !== 'libere' && stato.modo !== 'cammina' ? 1 : 0, 4, d);
    const gesto = stato.gesto ?? 'nessuno';
    if (gesto !== this.gestoAttivo && this.gestoPeso < 0.02) this.gestoAttivo = gesto;
    this.gestoPeso = smorza(this.gestoPeso, gesto === this.gestoAttivo && gesto !== 'nessuno' ? 1 : 0, 7, d);

    const k = this.cammino;
    const fermo = 1 - k;

    // --- passo: lunghezza del passo ~0.4 H, un ciclo = due passi
    const passo = (this.opz.gonna ? 0.32 : 0.4) * H;
    const v = Math.max(this.velocita, 0.3);
    this.fase += d * k * (v / (2 * passo)) * Math.PI * 2;
    const f = this.fase;
    const s = Math.sin(f);
    const c = Math.cos(f);
    const amp = Math.min(1, v / 1.2) * k;
    const DEG = Math.PI / 180;
    const aCoscia = (this.opz.gonna ? 17 : 24) * DEG * amp;
    const aGinocchio = (this.opz.gonna ? 28 : 40) * DEG * amp;
    for (const [lato, segno] of [
      ['S', 1],
      ['D', -1],
    ] as const) {
      const sl = s * segno;
      const cl = c * segno;
      const coscia = -aCoscia * sl; // sl > 0: gamba avanti
      // il ginocchio si piega nella fase di volo (la gamba avanza: cl > 0) e un poco all'appoggio
      const ginocchio = aGinocchio * Math.max(0, cl) ** 1.5 + 4 * DEG * amp;
      this.ruota(`coscia${lato}`, coscia);
      this.ruota(`stinco${lato}`, ginocchio);
      // il piede resta quasi piano; alla spinta (gamba dietro) la punta scende
      this.ruota(`piede${lato}`, -(coscia + ginocchio) * 0.85 + Math.max(0, -sl) * 10 * DEG * amp);
    }
    // bacino: ondeggia e ruota col passo; si abbassa quando le gambe sono aperte
    this.ruota('bacino', 0, 4 * DEG * amp * s, 2.5 * DEG * amp * c);
    this.abbassamento = -0.012 * H * amp * Math.abs(s);
    // busto: contro-rotazione e un filo in avanti quando cammina
    this.ruota('schiena', 3 * DEG * k, -3 * DEG * amp * s);
    this.ruota('petto', 0, -2 * DEG * amp * s);

    // --- fermo: respiro (4 s) e peso che si sposta (9 s)
    const resp = Math.sin((t * Math.PI * 2) / 4.2);
    const peso = Math.sin((t * Math.PI * 2) / 9 + 1.3);
    this.ruota('petto', -1.2 * DEG * resp * (0.6 + 0.4 * fermo));
    this.ruota('bacino', 0, 0, 1.6 * DEG * peso * fermo);
    this.ruota('schiena', 0, 0, -1.2 * DEG * peso * fermo);
    this.ruota('cosciaS', 0, 0, -1.6 * DEG * peso * fermo);
    this.ruota('cosciaD', 0, 0, -1.6 * DEG * peso * fermo);
    this.ruota('piedeS', 0, 0, 1.6 * DEG * peso * fermo);
    this.ruota('piedeD', 0, 0, 1.6 * DEG * peso * fermo);

    // --- curvo (anziani, lavandaia): schiena e collo avanti, testa che rialza lo sguardo
    const cv = this.curvo;
    if (cv > 0.001) {
      this.ruota('schiena', 14 * DEG * cv);
      this.ruota('petto', 12 * DEG * cv);
      this.ruota('collo', 6 * DEG * cv);
      this.ruota('testa', -16 * DEG * cv);
      this.ruota('cosciaS', -6 * DEG * cv);
      this.ruota('cosciaD', -6 * DEG * cv);
      this.ruota('stincoS', 8 * DEG * cv);
      this.ruota('stincoD', 8 * DEG * cv);
    }

    // --- braccia: giù dalla posa ad A, oscillano col passo, gomito un po' piegato
    const respSpalle = 0.6 * DEG * resp;
    const oscilla = 16 * DEG * amp;
    this.ruota('braccioS', oscilla * s, 0, -(this.abbassaBracciaS - respSpalle));
    this.ruota('braccioD', -oscilla * s, 0, this.abbassaBracciaD - respSpalle);
    this.ruota('avambraccioS', -(8 + 10 * amp * Math.max(0, -s)) * DEG);
    this.ruota('avambraccioD', -(8 + 10 * amp * Math.max(0, s)) * DEG);
    this.ruota('manoS', 0, 0, 4 * DEG);
    this.ruota('manoD', 0, 0, -4 * DEG);

    // --- posa delle braccia (IK sulle due mani), sotto i gesti
    if (this.posaPeso > 0.001) this.posaBraccia(this.posaAttiva, this.posaPeso * (1 - this.gestoPeso * 0.999));

    // --- gesti (braccio destro), sfumati
    const g = this.gestoPeso;
    if (g > 0.001) this.gesto(this.gestoAttivo, g, t, stato.indica ?? null);

    // --- sguardo: testa e collo verso il punto (in spazio modello), con limiti e inerzia
    let yawB = 0;
    let pitchB = 0;
    if (stato.guarda) {
      _v.copy(stato.guarda);
      this.radice.worldToLocal(_v);
      const testa = this.o('testa').attacco;
      _w.copy(_v).sub(testa);
      yawB = THREE.MathUtils.clamp(Math.atan2(_w.x, _w.z), -75 * DEG, 75 * DEG);
      const oriz = Math.hypot(_w.x, _w.z);
      pitchB = THREE.MathUtils.clamp(-Math.atan2(_w.y, oriz), -30 * DEG, 35 * DEG);
      if (_w.z < 0 && Math.abs(Math.atan2(_w.x, _w.z)) > 100 * DEG) yawB = Math.sign(_w.x) * 75 * DEG;
    } else {
      // sguardi distratti quando è fermo
      yawB = (Math.sin(t * 0.37 + 1.1) * 0.6 + Math.sin(t * 0.13) * 0.4) * 14 * DEG * fermo;
      pitchB = Math.sin(t * 0.29 + 2) * 4 * DEG * fermo;
    }
    this.yaw = smorza(this.yaw, yawB, 4, d);
    this.pitch = smorza(this.pitch, pitchB, 4, d);
    const busto = Math.max(0, Math.abs(this.yaw) - 45 * DEG) * Math.sign(this.yaw);
    this.ruota('petto', 0, busto * 0.5);
    this.ruota('collo', this.pitch * 0.35, (this.yaw - busto * 0.5) * 0.4);
    this.ruota('testa', this.pitch * 0.65, (this.yaw - busto * 0.5) * 0.6);

    // --- scrive le ossa: riposo · W⁻¹ · R · W
    for (const o of this.ossa.values()) {
      _q.copy(o.Winv).multiply(o.R).multiply(o.W);
      o.osso.quaternion.copy(o.riposo).multiply(_q);
    }
  }

  private gesto(gesto: GestoPersonaggio, g: number, t: number, indica: THREE.Vector3 | null): void {
    const DEG = Math.PI / 180;
    // il braccio destro torna alla posa ad A (togli l'abbassamento) e poi fa il gesto
    const giaAbbassato = this.abbassaBracciaD;
    if (gesto === 'saluta') {
      this.ruota('braccioD', 0, 0, -(giaAbbassato + 70 * DEG) * g);
      this.ruota('avambraccioD', 0, 0, (-75 + 18 * Math.sin(t * 9)) * DEG * g);
      this.ruota('manoD', 0, 0, -10 * DEG * g);
    } else if (gesto === 'indica') {
      // il braccio intero verso il punto (in spazio modello), avambraccio dritto
      let dir = new THREE.Vector3(0.2, -0.05, 1);
      if (indica) {
        const p = this.radice.worldToLocal(indica.clone());
        dir = p.sub(this.o('braccioD').attacco);
      }
      dir.normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(this.dirBraccioD, dir);
      const o = this.o('braccioD');
      // sostituisce la rotazione del braccio (sfumata)
      o.R.slerp(q, g);
      this.o('avambraccioD').R.slerp(new THREE.Quaternion(), g);
    } else if (gesto === 'mano-al-petto') {
      // la mano destra sul petto, un po' a sinistra del centro, davanti al busto
      const petto = this.o('petto').attacco;
      const collo = this.o('collo').attacco;
      const bersaglio = new THREE.Vector3(0.03 * this.altezza, petto.y + 0.3 * (collo.y - petto.y), this.fronteBusto + 0.035 * this.altezza);
      this.raggiungi('D', bersaglio, g);
      this.ruota('manoD', -20 * DEG * g, 0, -25 * DEG * g);
    }
  }

  private posaBraccia(posa: PosaBraccia, p: number): void {
    const H = this.altezza;
    const petto = this.o('petto').attacco;
    const fronte = this.fronteBusto;
    const bacino = this.o('bacino').attacco;
    if (posa === 'mani-giunte') {
      // le mani una sull'altra davanti alla pancia
      const y = bacino.y + 0.08 * H;
      this.raggiungi('S', new THREE.Vector3(0.015 * H, y, fronte + 0.05 * H), p);
      this.raggiungi('D', new THREE.Vector3(-0.015 * H, y - 0.01 * H, fronte + 0.065 * H), p);
    } else if (posa === 'braccia-conserte') {
      // ogni mano verso il gomito opposto, davanti al petto
      const y = petto.y + 0.02 * H;
      this.raggiungi('S', new THREE.Vector3(-0.07 * H, y, fronte + 0.04 * H), p);
      this.raggiungi('D', new THREE.Vector3(0.07 * H, y + 0.02 * H, fronte + 0.07 * H), p);
    } else if (posa === 'mani-dietro') {
      // le mani dietro la schiena, all'altezza del bacino
      const dietro = petto.z - (fronte - petto.z) - 0.03 * H;
      this.raggiungi('S', new THREE.Vector3(0.03 * H, bacino.y + 0.02 * H, dietro), p);
      this.raggiungi('D', new THREE.Vector3(-0.03 * H, bacino.y + 0.03 * H, dietro - 0.01 * H), p);
    }
  }

  /**
   * IK a due ossa: porta il polso del lato dato sul punto `bersaglio` (spazio del modello, a riposo),
   * con il gomito verso fuori, in basso e indietro. `peso` sfuma dalla posa calcolata finora.
   * Serve ai gesti e alle pose di mestiere (le mani nella vasca, sul bastone, giunte).
   */
  raggiungi(lato: 'S' | 'D', bersaglio: THREE.Vector3, peso = 1): void {
    if (peso <= 0) return;
    const ua = this.o(`braccio${lato}`);
    const fa = this.o(`avambraccio${lato}`);
    const ma = this.o(`mano${lato}`);
    const S = ua.attacco;
    const L1 = fa.attacco.distanceTo(S);
    const L2 = ma.attacco.distanceTo(fa.attacco);
    const d1 = fa.attacco.clone().sub(S).normalize();
    const d2 = ma.attacco.clone().sub(fa.attacco).normalize();
    const D = bersaglio.clone().sub(S);
    const dist = THREE.MathUtils.clamp(D.length(), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3);
    const dirD = D.normalize();
    const cosA = THREE.MathUtils.clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    const polo = new THREE.Vector3(lato === 'S' ? 0.6 : -0.6, -0.5, -0.6);
    const n = polo.sub(dirD.clone().multiplyScalar(polo.dot(dirD))).normalize();
    const gomito = S.clone().add(dirD.clone().multiplyScalar(L1 * cosA)).add(n.multiplyScalar(L1 * sinA));
    const polso = S.clone().add(dirD.clone().multiplyScalar(dist));
    const dirUA = gomito.clone().sub(S).normalize();
    const dirFA = polso.sub(gomito).normalize();
    const Rua = new THREE.Quaternion().setFromUnitVectors(d1, dirUA);
    const Rfa = new THREE.Quaternion().setFromUnitVectors(d2, dirFA.applyQuaternion(Rua.clone().invert()));
    ua.R.slerp(Rua, peso);
    fa.R.slerp(Rfa, peso);
  }
}
