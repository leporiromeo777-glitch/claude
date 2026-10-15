/**
 * Lettore della musica: suona una partitura sul tempo audio, pianificando le note
 * con un piccolo anticipo (così si può fermare in qualsiasi momento e funziona anche
 * nei contesti offline, dove il tempo avanza a scatti).
 */
import { pulisciA, type Kit } from '../sintesi/kit';
import type { TemaMusicale } from '../tipi';
import { suonaNota } from './strumenti';
import type { Partitura } from './temi';

/** Anticipo di pianificazione delle note (s). */
export const ANTICIPO_MUSICA = 0.6;

export class LettoreMusica {
  private brano: {
    partitura: Partitura;
    inizio: number;
    prossima: number;
    gTema: GainNode;
    mandata: GainNode;
    fine: number;
  } | null = null;

  constructor(
    private readonly kit: Kit,
    private readonly uscita: AudioNode,
    private readonly riverbero: AudioNode,
  ) {}

  /** Il tema che sta suonando (o sfumando), se c'è. */
  get tema(): TemaMusicale | null {
    return this.brano?.partitura.tema ?? null;
  }

  /** Comincia a suonare una partitura all'istante `t`. Ferma quella precedente. */
  suona(partitura: Partitura, t: number): void {
    this.ferma(t, 1.5);
    const gTema = this.kit.guadagno(1.25);
    gTema.connect(this.uscita);
    const mandata = this.kit.guadagno(0.22);
    gTema.connect(mandata).connect(this.riverbero);
    this.brano = { partitura, inizio: t, prossima: 0, gTema, mandata, fine: t + partitura.durata };
    this.aggiorna(t);
  }

  /** Pianifica le note che cadono entro `t + ANTICIPO_MUSICA`. */
  aggiorna(t: number): void {
    const b = this.brano;
    if (!b) return;
    const note = b.partitura.note;
    while (b.prossima < note.length) {
      const n = note[b.prossima];
      if (!n) break;
      const tn = b.inizio + n.t;
      if (tn > t + ANTICIPO_MUSICA) break;
      if (tn >= t - 0.05) suonaNota(this.kit, b.gTema, Math.max(tn, t), n);
      b.prossima++;
    }
    if (t > b.fine + 1 && b.prossima >= note.length) this.brano = null;
  }

  /** Sfuma e ferma il tema in corso. */
  ferma(t: number, dissolvenza = 2): void {
    const b = this.brano;
    if (!b) return;
    b.gTema.gain.cancelScheduledValues(t);
    b.gTema.gain.setValueAtTime(b.gTema.gain.value, t);
    b.gTema.gain.setTargetAtTime(0, t, Math.max(0.05, dissolvenza / 4));
    pulisciA(this.kit, t + dissolvenza * 1.5 + 6, [b.gTema, b.mandata]);
    this.brano = null;
  }
}
