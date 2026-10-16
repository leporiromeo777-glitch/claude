/**
 * La lettera in mano (bozzetto 1), parte visiva della regia: quando Elvira legge una lettera o un
 * biglietto il foglio di carta sale nella sua destra guantata; la carta da leggere è quella del
 * lettore dell'interfaccia (a tutto schermo), e quando lo si chiude il foglio resta in mano un
 * momento, nel mondo e nella sua luce, poi si abbassa e sparisce.
 *
 * Disegnato in una scena a parte sopra il mondo (come lo squadro), con il materiale del primo
 * piano (`render/primoPiano.ts`): la luce è quella del mondo. Non cambia niente del gioco.
 */
import { PerspectiveCamera, Scene, type WebGLRenderer } from 'three';
import type { Game, SistemaGioco } from '../../game';
import { creaLetteraPrimaPersona, type StatoLettera } from '../../oggetti/oggetti/primaPersona';
import type { OggettoProcedurale } from '../../oggetti/tipi';

/**
 * Che cosa mostra il lettore dell'interfaccia (aperto, tipo di carta) e se le mani sono già
 * occupate da uno strumento (lo squadro in mano o piantato).
 */
export type StatoLettore = () => { aperta: boolean; tipo: string; maniOccupate?: boolean };

/** Le carte che si tengono in mano come un foglio. */
const IN_MANO = new Set(['lettera', 'biglietto', 'dattiloscritto', 'foglio']);

export class LetteraInMano implements SistemaGioco {
  private scena = new Scene();
  private camera: PerspectiveCamera;
  private lettera: OggettoProcedurale<StatoLettera> | null = null;
  private stato: StatoLettera = { alzata: 0 };
  /** secondi da tenerla ancora in mano dopo la chiusura del lettore */
  private tieni = 0;
  private eraAperta = false;
  private alzata = 0;

  constructor(
    private game: Game,
    private lettore: StatoLettore,
  ) {
    this.camera = new PerspectiveCamera(game.settings.fov, 1, 0.02, 10);
  }

  update(dt: number): void {
    const l = this.lettore();
    const aperta = l.aperta && IN_MANO.has(l.tipo);
    if (aperta) this.tieni = 1.4;
    else if (this.eraAperta) this.tieni = 1.4;
    else this.tieni = Math.max(0, this.tieni - dt);
    this.eraAperta = aperta;
    // col Velo aperto o lo squadro in mano la lettera non si tiene
    const libera = this.game.player.veloAmount < 0.05 && !l.maniOccupate;
    const obiettivo = (aperta || this.tieni > 0) && libera ? 1 : 0;
    this.alzata += (obiettivo - this.alzata) * Math.min(1, dt * (obiettivo > this.alzata ? 6 : 3.2));
    if (this.alzata > 0.01 && !this.lettera) {
      this.lettera = creaLetteraPrimaPersona();
      this.scena.add(this.lettera.gruppo);
    }
  }

  overlay(renderer: WebGLRenderer): void {
    if (!this.lettera || this.alzata < 0.02 || this.game.freeCamera) return;
    this.stato.alzata = this.alzata;
    this.lettera.update?.(0, this.stato);
    const g = this.game;
    if (this.camera.aspect !== g.camera.aspect || this.camera.fov !== g.settings.fov) {
      this.camera.aspect = g.camera.aspect;
      this.camera.fov = g.settings.fov;
      this.camera.updateProjectionMatrix();
    }
    renderer.clearDepth();
    renderer.render(this.scena, this.camera);
  }
}
