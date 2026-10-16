/**
 * Una conversazione simulata in Node con un personaggio vero (GLB di public/personaggi, posa.ts), come la
 * fa il gioco: Elvira arriva di lato, chi le parla si gira con calma (la figura intera ruota con il profilo
 * di velocità del popolamento, GIRO in src/popolamento/abitanti.ts), tre battute, il dialogo si chiude. A
 * ogni passo di 1/60 s si misura:
 *  - la velocità e l'accelerazione angolare di ogni osso nello spazio della figura (gli scatti);
 *  - mano e mezzo avambraccio dentro il busto (un'ellisse attorno alla spina, come tools/personaggi/provini_fogli.py);
 *  - le articolazioni: gomito (0° = teso), polso rispetto all'avambraccio, testa rispetto al petto;
 *  - i piedi: quanto scivolano sul suolo quando sono a terra (anche mentre il corpo si gira);
 *  - la quota del bacino (chi è seduto non si alza).
 * Lo usano tests/personaggi/parlare.test.ts e, a mano, chi ritocca l'animatore.
 */
import * as THREE from 'three';
import type { OggettoProcedurale } from '../../src/oggetti/tipi';
import type { StatoAbitante } from '../../src/oggetti/oggetti/abitante';
import type { StatoPersonaggioGioco } from '../../src/personaggi/fabbrica';
import { battutaPersonaggio, fineBattutePersonaggio } from '../../src/personaggi/fabbrica';
import { pianoGiro, posizioneGiro, type PianoGiro } from '../../src/popolamento/abitanti';
import { animatoreDi, osso } from './posa';

export interface MisureConversazione {
  /** velocità angolare più alta fra le ossa (gradi/s) e dove */
  velMax: number;
  velOsso: string;
  velT: number;
  /** accelerazione angolare più alta (gradi/s²) e dove */
  accMax: number;
  accOsso: string;
  accT: number;
  /** la stessa cosa per petto, collo e testa soli (il respiro, i cenni) */
  velBusto: number;
  /** le gambe (cosce, stinchi, piedi): i passi per seguire il corpo che si gira sono più svelti */
  velGambe: number;
  accGambe: number;
  /** mano o mezzo avambraccio dentro il busto più di quanto ci stava a riposo: profondità più grande (m) */
  dentroBusto: number;
  /** quando e dove (polso o avambraccio, lato) */
  dentroDove: string;
  /** gomito più piegato (gradi, 0 = teso) e polso più girato rispetto all'avambraccio (gradi) */
  gomitoMax: number;
  polsoMax: number;
  /** testa rispetto al petto (gradi) */
  collo: number;
  /** piedi a terra: velocità orizzontale più alta e 95° percentile (m/s), alzata più alta (m) */
  scivolaMax: number;
  scivolaP95: number;
  alzataPiedi: number;
  /** escursione della quota del bacino (m) */
  bacino: number;
  /** di quanto si è girato il corpo intero (gradi) */
  giro: number;
}

export interface OpzioniConversazione {
  /** angolo (gradi, + = alla sinistra della figura) da cui arriva Elvira, e a che distanza (m) */
  da?: number;
  distanza?: number;
  /** se si gira con il corpo (in piedi) */
  siGira?: boolean;
  /** stato del popolamento: posa, profilo per sedersi, ecc. */
  stato?: StatoPersonaggioGioco;
  /** istanti delle battute (s) e loro durata; quando si chiude; fino a quando si misura */
  battute?: number[];
  durata?: number;
  chiudi?: number;
  fine?: number;
  /** secondi di gioco già passati prima (il tempo interno dell'animatore: il respiro dipendeva da quanto era grande) */
  prima?: number;
}

/** La rotazione di `b` nello spazio di `radice`: il prodotto dei quaternioni locali lungo la catena. */
export function rotazioneNelModello(b: THREE.Object3D, radice: THREE.Object3D, out: THREE.Quaternion): THREE.Quaternion {
  out.identity();
  for (let x: THREE.Object3D | null = b; x && x !== radice; x = x.parent) out.premultiply(x.quaternion);
  return out.normalize();
}

const OSSA = ['bacino', 'schiena', 'petto', 'collo', 'testa', 'braccioS', 'avambraccioS', 'manoS', 'braccioD', 'avambraccioD', 'manoD', 'cosciaS', 'stincoS', 'piedeS', 'cosciaD', 'stincoD', 'piedeD'];
const BUSTO = new Set(['petto', 'collo', 'testa']);
const GAMBE = /^(coscia|stinco|piede)/;
const DEG = 180 / Math.PI;

/**
 * La conversazione con la figura `o` (un personaggio vero, creato con posa.ts/figura): la figura sta in un
 * gruppo «mondo» che la ruota attorno a Y come il popolamento ruota l'abitante.
 */
export function conversazione(o: OggettoProcedurale<StatoAbitante>, opz: OpzioniConversazione = {}): MisureConversazione {
  const dt = 1 / 60;
  const mondo = new THREE.Group();
  mondo.add(o.gruppo);
  const da = ((opz.da ?? 70) * Math.PI) / 180;
  const dist = opz.distanza ?? 2.4;
  // Elvira: occhi a 1,6 m, a `dist` m nella direzione `da` (Y su, la figura guarda +Z)
  const occhi = new THREE.Vector3(Math.sin(da) * dist, 1.6, Math.cos(da) * dist);
  const stato: StatoPersonaggioGioco = { modo: 'fermo', ...(opz.stato ?? {}) };
  const anim = animatoreDi(o);
  const H = anim.altezza;
  const ossa = new Map(OSSA.map((n) => [n, osso(o, n)]));
  const battute = opz.battute ?? [0, 2.2, 4.4];
  const durata = opz.durata ?? 2.6;
  const chiudi = opz.chiudi ?? 6;
  const fine = opz.fine ?? 10;
  // il tempo di gioco già passato (i respiri e gli sguardi di prima), Elvira lontana
  for (let t = 0; t < (opz.prima ?? 240); t += 0.25) o.update?.(0.25, stato);
  // un secondo e mezzo con Elvira lì vicino: la testa si gira già
  stato.guarda = occhi;
  for (let i = 0; i < 90; i++) o.update?.(dt, stato);
  // il giro del corpo (yaw in gradi bussola: + verso la sinistra della figura = +Y)
  let yaw = 0;
  let piano: PianoGiro | null = null;
  let meta: number | null = null;
  const yawElvira = (Math.atan2(occhi.x, occhi.z) * DEG) - 5 * Math.sign(occhi.x);
  const m: MisureConversazione = { velMax: 0, velOsso: '', velT: 0, accMax: 0, accOsso: '', accT: 0, velBusto: 0, velGambe: 0, accGambe: 0, dentroBusto: 0, dentroDove: '', gomitoMax: 0, polsoMax: 0, collo: 0, scivolaMax: 0, scivolaP95: 0, alzataPiedi: 0, bacino: 0, giro: 0 };
  const q0 = new Map<string, THREE.Quaternion>();
  const w0 = new Map<string, number>();
  const q = new THREE.Quaternion();
  const piediPrima = new Map<string, THREE.Vector3>();
  const scivola: number[] = [];
  const baseDentro = new Map<string, number>();
  let bacMin = Infinity;
  let bacMax = -Infinity;
  const yCaviglia = (ossa.get('piedeS')!.getWorldPosition(new THREE.Vector3()).y + ossa.get('piedeD')!.getWorldPosition(new THREE.Vector3()).y) / 2;
  const passi = Math.round(fine / dt);
  for (let i = 0; i <= passi; i++) {
    const t = i * dt;
    for (const b of battute) if (Math.abs(t - b) < dt / 2) {
      battutaPersonaggio(o.gruppo, durata);
      if (b === battute[0] && opz.siGira !== false && Math.abs(yawElvira) > 25) meta = yawElvira;
    }
    if (Math.abs(t - chiudi) < dt / 2) fineBattutePersonaggio(o.gruppo);
    if (meta !== null) {
      piano ??= pianoGiro(yaw, 0, meta);
      piano.t = Math.min(piano.T, piano.t + dt);
      yaw = posizioneGiro(piano).yaw;
      if (piano.t >= piano.T) {
        yaw = meta;
        meta = null;
      }
      mondo.rotation.y = yaw / DEG;
    }
    o.update?.(dt, stato);
    mondo.updateMatrixWorld(true);
    // le ossa nello spazio della figura: la catena delle rotazioni locali fino alla radice del modello (con
    // la matrice del mondo, nei generici scalati in modo diverso in larghezza e altezza, il quaternione
    // estratto non è unitario e misura velocità che non ci sono)
    for (const [nome, b] of ossa) {
      rotazioneNelModello(b, anim.radice, q);
      const p = q0.get(nome);
      if (p) {
        const v = 2 * Math.acos(Math.min(1, Math.abs(p.dot(q)))) * DEG / dt;
        const a = w0.has(nome) ? Math.abs(v - (w0.get(nome) as number)) / dt : 0;
        w0.set(nome, v);
        if (GAMBE.test(nome)) {
          m.velGambe = Math.max(m.velGambe, v);
          m.accGambe = Math.max(m.accGambe, a);
        } else if (v > m.velMax) Object.assign(m, { velMax: v, velOsso: nome, velT: t });
        if (!GAMBE.test(nome) && a > m.accMax) Object.assign(m, { accMax: a, accOsso: nome, accT: t });
        if (BUSTO.has(nome)) m.velBusto = Math.max(m.velBusto, v);
        p.copy(q);
      } else q0.set(nome, q.clone());
    }
    // posizioni nello spazio della figura
    const inGruppo = new THREE.Matrix4().copy(o.gruppo.matrixWorld).invert();
    const pos = (n: string) => ossa.get(n)!.getWorldPosition(new THREE.Vector3()).applyMatrix4(inGruppo);
    const bac = pos('bacino');
    const collo = pos('collo');
    bacMin = Math.min(bacMin, bac.y);
    bacMax = Math.max(bacMax, bac.y);
    const asse = collo.clone().sub(bac);
    const L = asse.length();
    asse.normalize();
    for (const lato of ['S', 'D']) {
      const spalla = pos(`braccio${lato}`);
      const gomito = pos(`avambraccio${lato}`);
      const polso = pos(`mano${lato}`);
      for (const [k, P] of [polso, gomito.clone().add(polso).multiplyScalar(0.5)].entries()) {
        const d = P.clone().sub(bac);
        const s = d.dot(asse);
        if (s < 0.05 * H || s > L) continue;
        const perp = d.addScaledVector(asse, -s);
        const lat = perp.x;
        const fr = Math.sqrt(Math.max(0, perp.lengthSq() - lat * lat));
        const e = (lat / (0.12 * H)) ** 2 + (fr / (0.07 * H)) ** 2;
        // quanto entra in più di quanto stava già a riposo (le pose di riposo le controllano le prove di forma)
        const chiave = `${k}${lato}`;
        const p0 = e < 1 ? (1 - Math.sqrt(e)) * 0.07 * H : 0;
        if (!baseDentro.has(chiave)) baseDentro.set(chiave, p0);
        const p = p0 - (baseDentro.get(chiave) as number);
        if (p > m.dentroBusto) {
          m.dentroBusto = p;
          m.dentroDove = `${k ? 'avambraccio' : 'polso'}${lato} a ${t.toFixed(2)} s`;
        }
      }
      const b1 = gomito.clone().sub(spalla).normalize();
      const b2 = polso.clone().sub(gomito).normalize();
      m.gomitoMax = Math.max(m.gomitoMax, Math.acos(THREE.MathUtils.clamp(b1.dot(b2), -1, 1)) * DEG);
      // il polso: la rotazione locale della mano (rispetto all'avambraccio) lontano da quella di riposo
      const mano = ossa.get(`mano${lato}`)!;
      const r0 = (anim.ossa.get(`mano${lato}` as 'manoS') as { riposo: THREE.Quaternion }).riposo;
      m.polsoMax = Math.max(m.polsoMax, 2 * Math.acos(Math.min(1, Math.abs(r0.dot(mano.quaternion)))) * DEG);
    }
    // la testa rispetto al petto: collo e testa insieme, lontano dal riposo
    {
      const c = ossa.get('collo')!;
      const te = ossa.get('testa')!;
      const rc = (anim.ossa.get('collo') as { riposo: THREE.Quaternion }).riposo;
      const rt = (anim.ossa.get('testa') as { riposo: THREE.Quaternion }).riposo;
      const ora = c.quaternion.clone().multiply(te.quaternion);
      const riposo = rc.clone().multiply(rt);
      m.collo = Math.max(m.collo, 2 * Math.acos(Math.min(1, Math.abs(riposo.dot(ora)))) * DEG);
    }
    // i piedi nel mondo: a terra (caviglia entro 1,5 cm dalla quota di riposo) non devono scivolare
    for (const lato of ['S', 'D']) {
      const p = ossa.get(`piede${lato}`)!.getWorldPosition(new THREE.Vector3());
      m.alzataPiedi = Math.max(m.alzataPiedi, p.y - yCaviglia);
      const prima = piediPrima.get(lato);
      if (prima && p.y - yCaviglia < 0.015 && prima.y - yCaviglia < 0.015) {
        const v = Math.hypot(p.x - prima.x, p.z - prima.z) / dt;
        scivola.push(v);
        m.scivolaMax = Math.max(m.scivolaMax, v);
      }
      piediPrima.set(lato, p);
    }
  }
  scivola.sort((a, b) => a - b);
  m.scivolaP95 = scivola[Math.floor(scivola.length * 0.95)] ?? 0;
  m.bacino = bacMax - bacMin;
  m.giro = yaw;
  mondo.remove(o.gruppo);
  return m;
}
