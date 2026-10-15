/**
 * Base comune degli strati d'ambiente: ricevono i parametri derivati dallo stato
 * (ParametriAmbiente) a ogni aggiornamento e pianificano i propri eventi casuali
 * con un piccolo anticipo sul tempo audio.
 */
import type { ParametriAmbiente } from '../mappature';
import type { Vec3 } from '../tipi';
import { lunghezza, normalizza, scala, somma, tra, vettoriale, type Rng } from '../util';
import type { Kit } from '../sintesi/kit';

/** Dove si trova l'ascoltatore in questo momento. */
export interface Ascoltatore {
  posizione: Vec3;
  avanti: Vec3;
  su: Vec3;
  /** Altezza dal suolo (m). */
  altezza: number;
}

/** Parametri di attenuazione con la distanza di una sorgente posizionale. */
export interface ProfiloSpaziale {
  /** Distanza di riferimento (volume pieno), m. */
  rif: number;
  /** Distanza massima oltre cui non si attenua più, m. */
  max: number;
  /** Fattore di attenuazione (0 = solo direzione, nessuna attenuazione). */
  rolloff: number;
  /** Pan a potenza costante invece di HRTF (per i suoni gravi, dove l'HRTF non serve). */
  semplice?: boolean;
}

/** Ciò che il motore mette a disposizione di uno strato. */
export interface ContestoStrato {
  kit: Kit;
  /** Ingresso del bus su cui suona lo strato. */
  uscita: AudioNode;
  /** Mandata al riverbero dello stesso bus. */
  riverbero: AudioNode;
  /** Posizione e orientamento correnti dell'ascoltatore. */
  ascoltatore(): Ascoltatore;
  /** Crea un panner HRTF fermo in `p`, collegato all'uscita dello strato. */
  panner(p: Vec3, profilo: ProfiloSpaziale): PannerNode;
}

/** Anticipo con cui gli strati pianificano gli eventi casuali (s). */
export const ANTICIPO = 0.3;

export abstract class Strato {
  private ultimoT = -Infinity;
  protected readonly sorgenti: AudioScheduledSourceNode[] = [];
  protected readonly nodi: AudioNode[] = [];

  constructor(protected readonly c: ContestoStrato) {}

  /** Applica i parametri e pianifica gli eventi casuali fino a t + ANTICIPO. */
  abstract aggiorna(p: ParametriAmbiente, t: number): void;

  /** Intervallo di tempo ancora da pianificare: [da, a). */
  protected finestra(t: number): [number, number] {
    const da = Math.max(this.ultimoT, t);
    const a = t + ANTICIPO;
    this.ultimoT = Math.max(this.ultimoT, a);
    return [da, a];
  }

  /** Registra sorgenti continue e nodi per la distruzione. */
  protected tieni<T extends AudioNode>(n: T): T {
    this.nodi.push(n);
    if ('start' in n && 'stop' in n) this.sorgenti.push(n as unknown as AudioScheduledSourceNode);
    return n;
  }

  /** Ferma le sorgenti continue e scollega tutto. */
  distruggi(): void {
    for (const s of this.sorgenti) {
      try {
        s.stop();
      } catch {
        /* mai partita o già ferma */
      }
    }
    for (const n of this.nodi) {
      try {
        n.disconnect();
      } catch {
        /* già scollegato */
      }
    }
    this.sorgenti.length = 0;
    this.nodi.length = 0;
  }
}

/**
 * Un punto casuale attorno all'ascoltatore, a distanza orizzontale fra dMin e dMax,
 * a `quota` metri dal suolo (il suolo è sotto i piedi: posizione − su × altezza).
 */
export function puntoAttorno(asc: Ascoltatore, rng: Rng, dMin: number, dMax: number, quota: number): Vec3 {
  const su = normalizza(asc.su, { x: 0, y: 1, z: 0 });
  let e1 = vettoriale(su, { x: 0, y: 0, z: 1 });
  if (lunghezza(e1) < 0.1) e1 = vettoriale(su, { x: 1, y: 0, z: 0 });
  e1 = normalizza(e1);
  const e2 = vettoriale(su, e1);
  const ang = rng() * Math.PI * 2;
  const d = tra(rng, dMin, dMax);
  const base = somma(asc.posizione, scala(su, -Math.max(0, asc.altezza) + quota));
  return somma(base, somma(scala(e1, Math.cos(ang) * d), scala(e2, Math.sin(ang) * d)));
}

/** Avvia una sorgente continua con uno scarto casuale nel buffer. */
export function avviaContinua(s: AudioBufferSourceNode & { scarto?: number }, t: number): void {
  s.start(t, s.scarto ?? 0);
}
