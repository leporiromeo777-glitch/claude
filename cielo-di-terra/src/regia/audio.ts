/**
 * Ponte fra la regia e il motore audio procedurale (src/audio).
 *
 * - avvio al primo gesto dell'utente (clic o tasto: il browser lo esige);
 * - `aggiorna` a ogni fotogramma con lo stato del giocatore (posizione, «su» verso l'asse,
 *   velocità, ora, altezza dal suolo, Velo aperto);
 * - i passi: un evento ogni 0,75 m a terra (0,95 m di corsa), con la superficie sotto i piedi;
 * - suoni singoli per gli eventi del motore e della storia; musica con i temi del modulo.
 */
import { Vector3 } from 'three';
import { AudioEngine, type EventoAudio, type NomeBus, type Superficie, type TemaMusicale } from '../audio';

export interface StatoGiocatoreAudio {
  occhi: Vector3;
  avanti: Vector3;
  su: Vector3;
  velocita: number;
  ore: number;
  altezza: number;
  inVolo: boolean;
  aTerra: boolean;
  corre: boolean;
  superficie: Superficie;
  fadeVicine?: number;
}

/** Musiche dei contenuti (FASE1 §2.6) → temi del modulo audio. */
export const MUSICHE: Record<string, TemaMusicale> = {
  primo_sguardo: 'alba',
  primo_rilievo: 'primo-rilievo',
  chiusura_m1: 'primo-volo',
  primo_volo: 'primo-volo',
  notte_fade: 'notte-fade',
};

export class PonteAudio {
  readonly motore: AudioEngine;
  private accPassi = 0;
  private staccaGesto: (() => void) | null = null;
  private inPausa = false;

  constructor() {
    this.motore = new AudioEngine({ musicaAlba: true });
  }

  /** Il contesto parte al primo clic o tasto. */
  avviaAlPrimoGesto(bersaglio: EventTarget = window): void {
    this.staccaGesto = AudioEngine.avviaAlPrimoGesto(this.motore, bersaglio);
  }

  get attivo(): boolean {
    return this.motore.stato === 'attivo';
  }

  volume(bus: NomeBus, v: number): void {
    this.motore.impostaVolume(bus, v);
  }

  pausa(si: boolean): void {
    if (si === this.inPausa) return;
    this.inPausa = si;
    if (si) this.motore.pausa();
    else void this.motore.riprendi();
  }

  aggiorna(dt: number, s: StatoGiocatoreAudio): void {
    if (this.motore.stato !== 'attivo') return;
    this.motore.aggiorna(
      {
        posizione: s.occhi,
        avanti: s.avanti,
        su: s.su,
        velocita: s.velocita,
        ora: s.ore,
        altezza: Math.max(0, s.altezza),
        inVolo: s.inVolo,
        ...(s.fadeVicine !== undefined ? { fadeVicine: s.fadeVicine } : {}),
      },
      dt,
    );
    if (s.aTerra && s.velocita > 0.6) {
      this.accPassi += s.velocita * dt;
      const passo = s.corre ? 0.95 : 0.75;
      if (this.accPassi >= passo) {
        this.accPassi -= passo;
        this.evento({ tipo: 'passo', superficie: s.superficie, forza: s.corre ? 1 : 0.6 });
      }
    } else this.accPassi = 0;
  }

  evento(e: EventoAudio): number {
    if (this.motore.stato !== 'attivo') return 0;
    return this.motore.evento(e);
  }

  tema(id: string, forza = true): boolean {
    const t = MUSICHE[id] ?? (id as TemaMusicale);
    if (this.motore.stato !== 'attivo') return false;
    return this.motore.suonaTema(t, { forza });
  }

  campaneOrarie(si: boolean, posizione: Vector3 | null): void {
    this.motore.impostaCampanile(posizione, si);
  }

  distruggi(): void {
    this.staccaGesto?.();
    void this.motore.distruggi();
  }
}
