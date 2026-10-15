/**
 * La matematica del segnalino di direzione: dal punto della meta (mondo) alla posizione sullo
 * schermo, al bordo quando è fuori o dietro, con «in su»/«sotto» e la distanza.
 *
 * Niente DOM e niente allocazioni: vettori di lavoro riusati e un risultato scritto in `out`.
 * Il «su» nel cilindro è verso l'asse e cambia da punto a punto: l'altra parte della valle è
 * davvero sopra la testa, e il segnalino lo dice.
 */
import { Vector3, type Camera } from 'three';
import { surfaceDistance } from '../world/cylinder';

/** Il riquadro dello schermo e la zona in cui il segnalino si appoggia quando la meta è fuori. */
export interface Riquadro {
  larghezza: number;
  altezza: number;
  /** Margini (px) della zona del bordo: lontano dal pannello, dalle notifiche e dai sottotitoli. */
  sinistra: number;
  destra: number;
  sopra: number;
  sotto: number;
  /**
   * La fascia dei sottotitoli e delle azioni, in basso al centro: dentro (|x - centro| <
   * `bandaCentro`) il segnalino resta `sottoCentro` px sopra il fondo; fuori scende fino a `sotto`.
   */
  sottoCentro?: number;
  bandaCentro?: number;
  /** Margine (px) entro cui una meta davanti conta ancora come «sullo schermo». */
  margineVisibile: number;
}

export interface Proiezione {
  /** Posizione in px nel riquadro. */
  x: number;
  y: number;
  /** Appoggiato al bordo della zona (meta fuori dallo schermo o dietro). */
  bordo: boolean;
  /** La meta è alle spalle della camera. */
  dietro: boolean;
  /** Direzione dal centro dello schermo verso la meta (rad; 0 = destra, π/2 = giù). */
  angolo: number;
}

export function nuovaProiezione(): Proiezione {
  return { x: 0, y: 0, bordo: false, dietro: false, angolo: 0 };
}

const _v = new Vector3();
const _d = new Vector3();

/** Sotto questa distanza dal piano della camera (m) la meta conta come dietro. */
const VICINO_AL_PIANO = 0.05;

/** Alle spalle, il segnalino sta di lato a questa altezza (frazione dello schermo, dall'alto). */
export const QUOTA_DIETRO = 0.62;
/** Quasi esattamente alle spalle (|x| sotto questa frazione della profondità) resta dal lato di prima. */
const ALLE_SPALLE = 0.12;

/**
 * Proietta `punto` sullo schermo della camera (le matrici devono essere aggiornate, come dopo un
 * disegno). Davanti e dentro lo schermo: il punto stesso. Davanti ma fuori: il punto del bordo
 * della zona nella direzione verso cui girarsi. Dietro: sul fianco dello schermo dalla parte
 * verso cui conviene girarsi, un po' sotto la metà, con la freccia di lato (non in basso al
 * centro, fra azione e sottotitoli, dove una freccia in giù si leggerebbe «giù»); proprio alle
 * spalle resta dal lato di prima (`out` è anche la memoria), così non salta da un fianco all'altro.
 */
export function proietta(punto: Vector3, camera: Camera, r: Riquadro, out: Proiezione): Proiezione {
  _v.copy(punto).applyMatrix4(camera.matrixWorldInverse); // spazio della camera: -z è avanti
  const dietro = _v.z > -VICINO_AL_PIANO;
  const cx = r.larghezza / 2;
  const cy = r.altezza / 2;
  let dx: number;
  let dy: number;
  if (!dietro) {
    _v.applyMatrix4(camera.projectionMatrix); // coordinate normalizzate (con la divisione prospettica)
    const x = ((_v.x + 1) / 2) * r.larghezza;
    const y = ((1 - _v.y) / 2) * r.altezza;
    const m = r.margineVisibile;
    if (x >= m && x <= r.larghezza - m && y >= m && y <= r.altezza - m) {
      out.x = x;
      out.y = y;
      out.bordo = false;
      out.dietro = false;
      out.angolo = Math.atan2(y - cy, x - cx);
      return out;
    }
    dx = x - cx;
    dy = y - cy;
  } else {
    // alle spalle: di lato, dalla parte in cui sta (x a destra nello spazio della camera)
    let destra = _v.x >= 0;
    if (Math.abs(_v.x) < ALLE_SPALLE * Math.max(0.01, Math.abs(_v.z)) && out.dietro) destra = out.x > cx;
    out.x = destra ? r.larghezza - r.destra : r.sinistra;
    out.y = Math.min(r.altezza - r.sotto, Math.max(r.sopra, r.altezza * QUOTA_DIETRO));
    out.bordo = true;
    out.dietro = true;
    out.angolo = destra ? 0 : Math.PI;
    return out;
  }
  const n = Math.hypot(dx, dy) || 1;
  dx /= n;
  dy /= n;
  // il raggio dal centro dello schermo incontra il bordo della zona; in basso al centro la zona
  // si ferma sopra i sottotitoli e le azioni
  let t = bordo(r, cx, cy, dx, dy, r.sotto);
  let x = cx + dx * t;
  let y = cy + dy * t;
  const sc = r.sottoCentro;
  const banda = r.bandaCentro ?? 0;
  if (sc !== undefined && sc > r.sotto && y > r.altezza - sc && Math.abs(x - cx) < banda) {
    if (Math.abs(dx) > SBIECO * dy) {
      // di sbieco: scivola lungo il fondo fino al fianco della fascia (la freccia resta girata giusta)
      x = Math.min(r.larghezza - r.destra, Math.max(r.sinistra, cx + Math.sign(dx) * banda));
    } else {
      // quasi dritto in giù: si ferma sopra la fascia
      t = bordo(r, cx, cy, dx, dy, sc);
      x = cx + dx * t;
      y = cy + dy * t;
    }
  }
  out.x = x;
  out.y = y;
  out.bordo = true;
  out.dietro = false;
  out.angolo = Math.atan2(dy, dx);
  return out;
}

/** Oltre questo rapporto |dx|/dy una meta in basso è «di sbieco»: il segnalino va al fianco della fascia dei sottotitoli. */
const SBIECO = 0.45;

/** Quanto (px) va il raggio (dx, dy) dal centro prima di incontrare il bordo della zona. */
function bordo(r: Riquadro, cx: number, cy: number, dx: number, dy: number, sotto: number): number {
  let t = Infinity;
  if (dx > 1e-9) t = Math.min(t, (r.larghezza - r.destra - cx) / dx);
  else if (dx < -1e-9) t = Math.min(t, (r.sinistra - cx) / dx);
  if (dy > 1e-9) t = Math.min(t, (r.altezza - sotto - cy) / dy);
  else if (dy < -1e-9) t = Math.min(t, (r.sopra - cy) / dy);
  return Number.isFinite(t) && t > 0 ? t : 0;
}

/** Angolo (gradi) sopra o sotto l'orizzonte locale oltre il quale la meta è «in su» o «sotto». */
export const ANGOLO_VERTICALE = 30;
/** Dislivello minimo (m) per dirlo. */
export const DISLIVELLO_VERTICALE = 6;
/** Una meta vicina ma quasi a piombo (la botola sopra la scala) è «in su» già da questo dislivello (m)… */
export const DISLIVELLO_A_PIOMBO = 1.5;
/** …se sta oltre questo angolo (gradi) sull'orizzonte. */
export const ANGOLO_A_PIOMBO = 60;

const SENO_VERTICALE = Math.sin((ANGOLO_VERTICALE * Math.PI) / 180);
const SENO_A_PIOMBO = Math.sin((ANGOLO_A_PIOMBO * Math.PI) / 180);

/**
 * La meta è molto più in alto («su») o più in basso («giu») di chi guarda? `su` è il «su» locale
 * (unitario, verso l'asse). Serve sia l'angolo sull'orizzonte sia un dislivello vero: una
 * persona a due passi non è «sotto» anche se la si guarda dall'alto. Fa eccezione la meta quasi
 * a piombo (la botola in cima alla scala, la cripta sotto i piedi): lì basta un metro e mezzo.
 */
export function verticale(occhi: Vector3, meta: Vector3, su: Vector3): 'su' | 'giu' | null {
  _d.subVectors(meta, occhi);
  const dist = _d.length();
  if (dist < 1e-3) return null;
  const alto = _d.dot(su);
  const seno = alto / dist;
  if ((alto > DISLIVELLO_VERTICALE && seno > SENO_VERTICALE) || (alto > DISLIVELLO_A_PIOMBO && seno > SENO_A_PIOMBO)) return 'su';
  if ((alto < -DISLIVELLO_VERTICALE && seno < -SENO_VERTICALE) || (alto < -DISLIVELLO_A_PIOMBO && seno < -SENO_A_PIOMBO)) return 'giu';
  return null;
}

/** Distanza (m) fra due punti del cilindro: sulla superficie, più il dislivello. */
export function distanzaMeta(zA: number, thetaA: number, hA: number, zB: number, thetaB: number, hB: number): number {
  return Math.hypot(surfaceDistance(zA, thetaA, zB, thetaB), hB - hA);
}

/** La distanza da scrivere sotto il segnalino: «7 m», «45 m», «120 m», «1,8 km». */
export function scriviDistanza(m: number): string {
  if (!Number.isFinite(m) || m < 0) return '';
  if (m < 100) return `${Math.max(1, Math.round(m))} m`;
  if (m < 1000) return `${Math.round(m / 5) * 5} m`;
  return `${(Math.round(m / 100) / 10).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}
