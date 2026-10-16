/**
 * Il Velo in prima persona (bozzetto 3): la traversa di frassino tenuta con i guanti di cuoio, i
 * montanti legati con la corda, la tela cucita a punti a croce vista da sotto in controluce e la
 * nappina rossa che pende dalla parte della deriva (Coriolis) e annuncia il capovolgimento del «giù».
 * Il modello è `creaVeloPrimaPersona` (src/oggetti), il materiale quello del primo piano
 * (`primoPiano.ts`): la luce è la stessa del mondo (`keyLightDir`, aggiornata da `Game`).
 *
 * Scena separata con camera propria (disegnata dopo il mondo, con il depth pulito), così il
 * modello non entra nei muri; passa dalla stessa post-produzione del mondo.
 */
import { Group, PerspectiveCamera, Scene } from 'three';
import { creaVeloPrimaPersona } from '../oggetti/oggetti/primaPersona';
import type { OggettoProcedurale } from '../oggetti/tipi';
import type { StatoVelo } from '../oggetti/oggetti/primaPersona';
import { UNIFORMI_PRIMO_PIANO } from './primoPiano';

export class FirstPersonVelo {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  /** luce del primo piano (condivisa con lo squadro e la lettera): la scrive `Game.updateFirstPerson` */
  readonly uniforms = UNIFORMI_PRIMO_PIANO;
  private rig = new Group();
  private velo: OggettoProcedurale<StatoVelo>;
  private stato: StatoVelo = { angoloNappina: 0, beccheggioNappina: 0, vento: 0.5, rollio: 0 };
  private tasselAngle = 0;
  private tasselVel = 0;
  private tasselPitch = 0;
  private open = 0;
  private time = 0;

  constructor(fov: number, aspect: number) {
    this.camera = new PerspectiveCamera(fov, aspect, 0.02, 10);
    this.velo = creaVeloPrimaPersona();
    this.rig.add(this.velo.gruppo);
    this.scene.add(this.rig);
    this.rig.visible = false;
  }

  setAspect(fov: number, aspect: number): void {
    this.camera.fov = fov;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /**
   * @param openAmount apertura 0..1 del Velo
   * @param lateral accelerazione laterale apparente (destra dello schermo, m/s^2)
   * @param vertical accelerazione apparente verso il basso dello schermo (m/s^2)
   * @param roll errore di rollio della camera (rad): la nappina lo anticipa
   */
  update(dt: number, openAmount: number, lateral: number, vertical: number, roll: number): void {
    this.open = openAmount;
    const e = openAmount * openAmount * (3 - 2 * openAmount);
    this.rig.visible = openAmount > 0.01;
    this.rig.position.set(0, -0.75 * (1 - e), 0.1 * (1 - e));
    this.rig.rotation.x = -0.25 * (1 - e);
    // pendolo smorzato verso la direzione della gravità apparente nello schermo
    const g = Math.max(0.5, vertical);
    const target = Math.atan2(-lateral, g) + roll * 0.6;
    const k = 30;
    const c = 4.5;
    this.tasselVel += (k * (target - this.tasselAngle) - c * this.tasselVel) * dt;
    this.tasselAngle += this.tasselVel * dt;
    this.time += dt;
    UNIFORMI_PRIMO_PIANO.uTime.value = this.time;
    this.tasselPitch += (0.15 * Math.sin(this.time * 3) - this.tasselPitch) * Math.min(1, dt * 2);
    if (!this.rig.visible) return;
    this.stato.angoloNappina = this.tasselAngle;
    this.stato.beccheggioNappina = this.tasselPitch;
    this.stato.vento = 0.25 + 0.75 * e;
    this.stato.rollio = roll;
    this.velo.update?.(dt, this.stato);
  }

  get tasselLean(): number {
    return this.tasselAngle;
  }

  get openAmount(): number {
    return this.open;
  }
}
