/**
 * Orientamento della camera in prima persona dentro il cilindro.
 *
 * L'orientamento è un quaternione completo (la camera guarda lungo -Z locale,
 * con +Y in alto sullo schermo, come in three.js). Ogni fotogramma:
 *
 * - a terra il corpo segue il suolo: la camera viene "trasportata" con la
 *   rotazione minima che porta il vecchio "su" locale nel nuovo, così camminando
 *   attorno al cilindro l'inclinazione dello sguardo resta naturale;
 * - in aria il corpo conserva il suo orientamento nello spazio (inerzia) e un
 *   rollio lento riporta l'orizzonte in bolla rispetto al "su" locale. Quando si
 *   attraversa l'asse e il "giù" si capovolge, questo diventa il rollio lento
 *   annunciato dalla nappina del Velo;
 * - yaw attorno al "su" locale, pitch attorno alla destra della camera (limitato a ±89°).
 */
import { Quaternion, Vector3 } from 'three';

const _q = new Quaternion();
const _f = new Vector3();
const _s = new Vector3();
const _r = new Vector3();
const _want = new Vector3();
const _axis = new Vector3();

export interface CameraRigOptions {
  /** Costante di tempo del livellamento a terra (s). */
  groundLevelTau: number;
  /** Costante di tempo del livellamento in aria per piccoli scarti (s). */
  airLevelTau: number;
  /** Costante di tempo del rollio quando il "giù" si capovolge (s). */
  flipTau: number;
  /** Pitch massimo (gradi). */
  maxPitchDeg: number;
}

export class CameraRig {
  readonly quaternion = new Quaternion();
  /** Ultimo "su" locale usato per il trasporto. */
  private refUp = new Vector3(0, 1, 0);
  /** Angolo di rollio residuo (rad), per debug e per la nappina. */
  rollError = 0;
  options: CameraRigOptions = { groundLevelTau: 0.06, airLevelTau: 0.35, flipTau: 1.1, maxPitchDeg: 89 };

  /** Imposta l'orientamento da "su" locale, direzione orizzontale e pitch. */
  set(up: Vector3, heading: Vector3, pitchRad: number): void {
    _f.copy(heading).addScaledVector(up, -heading.dot(up)).normalize();
    const fwd = _f.clone().multiplyScalar(Math.cos(pitchRad)).addScaledVector(up, Math.sin(pitchRad)).normalize();
    const scr = up.clone().multiplyScalar(Math.cos(pitchRad)).addScaledVector(_f, -Math.sin(pitchRad)).normalize();
    setFromForwardUp(this.quaternion, fwd, scr);
    this.refUp.copy(up);
  }

  forward(out: Vector3 = new Vector3()): Vector3 {
    return out.set(0, 0, -1).applyQuaternion(this.quaternion);
  }

  screenUp(out: Vector3 = new Vector3()): Vector3 {
    return out.set(0, 1, 0).applyQuaternion(this.quaternion);
  }

  right(out: Vector3 = new Vector3()): Vector3 {
    return out.set(1, 0, 0).applyQuaternion(this.quaternion);
  }

  /** Pitch rispetto al "su" dato (rad). */
  pitch(up: Vector3): number {
    return Math.asin(Math.max(-1, Math.min(1, this.forward(_f).dot(up))));
  }

  /** Yaw/pitch da mouse (rad). Yaw positivo = verso destra. */
  look(dYaw: number, dPitch: number, up: Vector3): void {
    if (dYaw !== 0) {
      _q.setFromAxisAngle(up, -dYaw);
      this.quaternion.premultiply(_q).normalize();
    }
    if (dPitch !== 0) {
      const max = (this.options.maxPitchDeg * Math.PI) / 180;
      const p = this.pitch(up);
      const np = Math.max(-max, Math.min(max, p + dPitch));
      const d = np - p;
      if (Math.abs(d) > 1e-7) {
        this.right(_r);
        _q.setFromAxisAngle(_r, d);
        this.quaternion.premultiply(_q).normalize();
      }
    }
  }

  /**
   * Aggiorna con il "su" locale corrente.
   * @param grounded true se il corpo è appoggiato al suolo
   */
  update(dt: number, up: Vector3, grounded: boolean): void {
    if (grounded) {
      // trasporto parallelo con la rotazione minima refUp -> up
      const d = this.refUp.dot(up);
      _axis.crossVectors(this.refUp, up);
      const len = _axis.length();
      if (len > 1e-12) {
        _q.setFromAxisAngle(_axis.multiplyScalar(1 / len), Math.atan2(len, d));
        this.quaternion.premultiply(_q).normalize();
      }
    }
    this.refUp.copy(up);

    // livellamento dell'orizzonte: la destra della camera deve stare nel piano orizzontale
    this.forward(_f);
    _want.crossVectors(_f, up);
    const wl = _want.length();
    if (wl < 0.03) {
      this.rollError = 0;
      return; // si guarda dritto in su o in giù: il rollio non è definito
    }
    _want.multiplyScalar(1 / wl);
    this.right(_r);
    this.screenUp(_s);
    // angolo con segno da destra attuale a destra voluta, attorno a forward
    const sin = _axis.crossVectors(_r, _want).dot(_f);
    const cos = _r.dot(_want);
    const err = Math.atan2(sin, cos);
    this.rollError = err;
    const big = Math.abs(err) > 0.6;
    const tau = grounded ? this.options.groundLevelTau : big ? this.options.flipTau : this.options.airLevelTau;
    let k = 1 - Math.exp(-dt / Math.max(1e-4, tau));
    if (big && !grounded) {
      // rollio lento a velocità limitata (circa 180 gradi in ~2.5 s)
      const maxStep = 1.3 * dt;
      k = Math.min(k, maxStep / Math.abs(err) + 0.002);
    }
    _q.setFromAxisAngle(_f, err * k);
    this.quaternion.premultiply(_q).normalize();
  }
}

/** Quaternione di una camera che guarda `forward` con `up` sullo schermo. */
export function setFromForwardUp(q: Quaternion, forward: Vector3, up: Vector3): Quaternion {
  const z = _f.copy(forward).multiplyScalar(-1).normalize();
  const x = _r.crossVectors(up, z).normalize();
  const y = _s.crossVectors(z, x);
  // matrice di rotazione con colonne x, y, z
  const m00 = x.x, m01 = y.x, m02 = z.x;
  const m10 = x.y, m11 = y.y, m12 = z.y;
  const m20 = x.z, m21 = y.z, m22 = z.z;
  const tr = m00 + m11 + m22;
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1);
    q.set((m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s);
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    q.set(0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s);
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    q.set((m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s);
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    q.set((m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s);
  }
  return q.normalize();
}
