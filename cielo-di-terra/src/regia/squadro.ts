/**
 * Lo squadro a cannocchiale di Aurelio in prima persona (GDD §3.2, FASE1 M1.17-M1.18).
 *
 * - **R** lo prende in mano o lo ripone (solo se Elvira l'ha preso dall'armadietto);
 * - **tasto destro** tenuto: il cannocchiale x4 (campo visivo / 4, reticolo dell'interfaccia);
 * - in mano, la mira tenuta 1 s su una cosa la **appunta** (evento `appunto`);
 * - **piantato** su un chiodo (tieni E vicino al chiodo: lo fa la regia con `pianta`):
 *   1. la bolla si centra con **A/D** (piccoli movimenti della vite);
 *   2. si collima: il reticolo sul segnale di un altro caposaldo per 1,5 s;
 *   3. «leggi»: evento `collimato` (la regia chiede al catasto se il lato si chiude).
 *
 * Disegna lo strumento d'ottone e le mani guantate (src/oggetti, bozzetto 2) in una scena a parte
 * sopra il mondo, con il materiale del primo piano: la luce è quella del mondo (gli uniform
 * `UNIFORMI_PRIMO_PIANO`, che il motore aggiorna a ogni fotogramma).
 */
import { PerspectiveCamera, Scene, Vector3, type WebGLRenderer } from 'three';
import type { Game, SistemaGioco } from '../game';
import { Emettitore } from '../narrativa';
import { creaSquadroPrimaPersona, type OggettoProcedurale, type StatoSquadro } from '../oggetti';
import { cylToWorld, localFrameAt, worldToCyl } from '../world/cylinder';
import { DEG } from '../world/constants';
import { groundHeight } from '../world/terrain';

export type StatoStrumento = 'riposto' | 'in_mano' | 'piantato';

/** Qualcosa che il cannocchiale può traguardare (un segnale, un lume, la Lanterna). */
export interface BersaglioMira {
  id: string;
  nome: string;
  posizione: Vector3;
  /** Cono di tolleranza (gradi). */
  tolleranza?: number;
  /** Il segnale di un caposaldo (si collima da piantati). */
  caposaldo?: string;
}

export interface EventiSquadro {
  piantato: { caposaldo: string };
  livellato: { caposaldo: string };
  staccato: { caposaldo: string };
  /** Collimazione tenuta 1,5 s su un segnale (anche nascosto: il tentativo conta). */
  collimato: { stazione: string; mira: string };
  /** Mira tenuta 1 s con lo squadro in mano. */
  appunto: { bersaglio: string | null; cella: number | null; distanza: number; punto: Vector3 };
  /** La mira cambia (per il reticolo dell'interfaccia). */
  mira: { bersaglio: BersaglioMira | null; distanza: number; tenuta: number };
}

export interface OpzioniSquadro {
  /** I bersagli possibili adesso. */
  bersagli: () => BersaglioMira[];
  /** Tolleranza della bolla (0,12; più larga con l'aiuto «bolla larga»). */
  tolleranzaBolla?: () => number;
  /** Secondi di collimazione (1,5; 0,8 con «collimazione agganciata»). */
  tempoCollimazione?: () => number;
}

const _f = { up: new Vector3(), east: new Vector3(), north: new Vector3() };
const _d = new Vector3();
const _p = new Vector3();

/** Raggio contro il terreno: primo punto sotto il suolo lungo la direzione (passi di 3 m). */
export function raggioTerreno(da: Vector3, dir: Vector3, max = 1500, passo = 3): Vector3 | null {
  for (let s = passo; s <= max; s += passo) {
    _p.copy(da).addScaledVector(dir, s);
    const c = worldToCyl(_p);
    if (c.z < 0 || c.z > 3000) return null;
    if (c.h <= groundHeight(c.z, c.theta)) {
      // affina a metà passo
      _p.addScaledVector(dir, -passo / 2);
      return _p.clone();
    }
  }
  return null;
}

export class Squadro implements SistemaGioco {
  readonly eventi = new Emettitore<EventiSquadro>();
  stato: StatoStrumento = 'riposto';
  /** Caposaldo su cui è piantato. */
  stazione: string | null = null;
  bolla = 0;
  livellato = false;
  telescopio = false;
  /** Lo squadro è disponibile (Elvira l'ha preso). */
  disponibile = false;
  /** Bloccato da un menu o da un dialogo. */
  bloccato = false;
  private fp: OggettoProcedurale<StatoSquadro> | null = null;
  private scena = new Scene();
  private camera: PerspectiveCamera;
  private miraCorrente: { id: string | null; tempo: number; appuntato: boolean } = { id: null, tempo: 0, appuntato: false };
  private passo = 0;
  private derivaBolla = 0;

  constructor(
    private game: Game,
    private opz: OpzioniSquadro,
  ) {
    this.camera = new PerspectiveCamera(game.settings.fov, 1, 0.02, 10);
  }

  private assicuraModello(): OggettoProcedurale<StatoSquadro> {
    if (!this.fp) {
      this.fp = creaSquadroPrimaPersona({ posa: 'mano' });
      this.scena.add(this.fp.gruppo);
    }
    return this.fp;
  }

  prendi(): void {
    if (!this.disponibile || this.stato !== 'riposto') return;
    this.stato = 'in_mano';
    this.assicuraModello();
  }

  riponi(): void {
    if (this.stato === 'piantato') this.stacca();
    this.stato = 'riposto';
    this.telescopio = false;
  }

  /** Pianta lo squadro sul chiodo del caposaldo `id`. */
  pianta(id: string): void {
    this.assicuraModello();
    this.stato = 'piantato';
    this.stazione = id;
    this.livellato = false;
    this.bolla = (Math.random() < 0.5 ? -1 : 1) * (0.55 + Math.random() * 0.3);
    this.derivaBolla = 0;
    this.eventi.emit('piantato', { caposaldo: id });
  }

  stacca(): void {
    if (this.stato !== 'piantato' || !this.stazione) return;
    const id = this.stazione;
    this.stato = 'in_mano';
    this.stazione = null;
    this.livellato = false;
    this.eventi.emit('staccato', { caposaldo: id });
  }

  /** Il bersaglio più al centro del cannocchiale, entro la sua tolleranza. */
  bersaglioInMira(occhio: Vector3, avanti: Vector3): { b: BersaglioMira; dist: number } | null {
    let best: { b: BersaglioMira; dist: number; ang: number } | null = null;
    for (const b of this.opz.bersagli()) {
      _d.subVectors(b.posizione, occhio);
      const dist = _d.length();
      if (dist < 1) continue;
      const ang = Math.acos(Math.max(-1, Math.min(1, _d.dot(avanti) / dist))) / DEG;
      if (ang > (b.tolleranza ?? 0.9)) continue;
      if (!best || ang < best.ang) best = { b, dist, ang };
    }
    return best ? { b: best.b, dist: best.dist } : null;
  }

  update(dt: number): void {
    const g = this.game;
    const inp = g.input;
    if (this.bloccato) {
      this.telescopio = false;
      g.setFovScale(1);
      return;
    }
    if (inp.consumePressed('KeyR')) {
      if (this.stato === 'riposto') this.prendi();
      else this.riponi();
    }
    const vuole = (this.stato !== 'riposto' && inp.isDown('Mouse2')) || (this.stato !== 'riposto' && inp.isDown('KeyM'));
    this.telescopio = vuole;
    g.setFovScale(this.telescopio ? 0.25 : 1);
    if (this.stato === 'riposto') return;

    // bolla (solo piantato): A/D muovono la vite, una piccola deriva la tiene viva
    if (this.stato === 'piantato' && !this.livellato) {
      const vite = (inp.isDown('KeyD') ? 1 : 0) - (inp.isDown('KeyA') ? 1 : 0);
      this.derivaBolla += (Math.random() - 0.5) * dt * 0.6;
      this.derivaBolla *= Math.exp(-dt * 1.5);
      this.bolla = Math.max(-1, Math.min(1, this.bolla - vite * dt * 0.75 + this.derivaBolla * dt));
      const tol = this.opz.tolleranzaBolla?.() ?? 0.12;
      if (Math.abs(this.bolla) < tol && vite === 0) {
        this.livellato = true;
        this.bolla = 0;
        this.eventi.emit('livellato', { caposaldo: this.stazione ?? '' });
      }
    }

    // mira
    const occhio = g.camera.position;
    const avanti = g.rig.forward(new Vector3());
    if (!this.telescopio) {
      this.miraCorrente = { id: null, tempo: 0, appuntato: false };
      this.eventi.emit('mira', { bersaglio: null, distanza: 0, tenuta: 0 });
      return;
    }
    const m = this.bersaglioInMira(occhio, avanti);
    const id = m?.b.id ?? '__terreno';
    if (id !== this.miraCorrente.id) this.miraCorrente = { id, tempo: 0, appuntato: false };
    this.miraCorrente.tempo += dt;
    this.eventi.emit('mira', { bersaglio: m?.b ?? null, distanza: m?.dist ?? 0, tenuta: this.miraCorrente.tempo });
    if (this.miraCorrente.appuntato) return;
    if (this.stato === 'piantato') {
      const serve = this.opz.tempoCollimazione?.() ?? 1.5;
      if (m?.b.caposaldo && this.livellato && this.stazione && m.b.caposaldo !== this.stazione && this.miraCorrente.tempo >= serve) {
        this.miraCorrente.appuntato = true;
        this.eventi.emit('collimato', { stazione: this.stazione, mira: m.b.caposaldo });
      }
      return;
    }
    if (this.miraCorrente.tempo >= 1) {
      this.miraCorrente.appuntato = true;
      const punto = m ? m.b.posizione.clone() : raggioTerreno(occhio, avanti);
      if (!punto) return;
      const c = worldToCyl(punto);
      const cella = c.z >= 0 && c.z < 3000 ? g.world.cellAt(c.z, c.theta) : null;
      this.eventi.emit('appunto', { bersaglio: m?.b.id ?? null, cella, distanza: punto.distanceTo(occhio), punto });
    }
  }

  overlay(renderer: WebGLRenderer): void {
    if (this.stato === 'riposto' || this.telescopio || this.bloccato || !this.fp) return;
    const g = this.game;
    const v = g.player.vel.length();
    this.passo += (Math.min(1, v / 7) - this.passo) * 0.1;
    this.fp.update?.(1 / 60, { posa: this.stato === 'piantato' ? 'piantato' : 'mano', passo: g.player.grounded ? this.passo : 0, mira: 0 });
    const aspetto = g.camera.aspect;
    if (this.camera.aspect !== aspetto || this.camera.fov !== g.settings.fov) {
      this.camera.aspect = aspetto;
      this.camera.fov = g.settings.fov;
      this.camera.updateProjectionMatrix();
    }
    renderer.clearDepth();
    renderer.render(this.scena, this.camera);
  }

  /** Per il puntale piantato: dove mettere i piedi di Elvira rispetto al chiodo. */
  static piediDavantiAlChiodo(chiodo: Vector3, guardaVerso: Vector3, distanza = 0.75): { z: number; theta: number } {
    const c = worldToCyl(chiodo);
    localFrameAt(chiodo, _f, c.theta);
    _d.subVectors(guardaVerso, chiodo);
    _d.addScaledVector(_f.up, -_d.dot(_f.up));
    if (_d.lengthSq() < 1e-6) _d.copy(_f.north);
    _d.normalize();
    const p = chiodo.clone().addScaledVector(_d, -distanza);
    const q = worldToCyl(p);
    return { z: q.z, theta: q.theta };
  }

  esporta(): { stato: StatoStrumento } {
    return { stato: this.stato === 'piantato' ? 'in_mano' : this.stato };
  }

  importa(d: { stato?: StatoStrumento } | null | undefined): void {
    this.stazione = null;
    this.livellato = false;
    this.stato = d?.stato === 'in_mano' && this.disponibile ? 'in_mano' : 'riposto';
    if (this.stato === 'in_mano') this.assicuraModello();
  }
}

/** Punto del segnale (palina) di un caposaldo dato il punto del chiodo e l'altezza del segnale. */
export function puntoSegnale(z: number, theta: number, h: number, altezzaSegnale: number): Vector3 {
  return cylToWorld(z, theta, h + Math.max(0.1, altezzaSegnale * 0.6));
}
