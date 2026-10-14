/**
 * Grafo audio (GDD 13.1, ARCHITETTURA 11):
 *
 *   sorgenti → bus (musica, effetti, voci, ambiente) → master (GainNode)
 *            → compressore (soglia -18 dB, rapporto 3, attacco 5 ms, rilascio 200 ms) → uscita
 *
 * La musica passa prima da un nodo di "ducking" (-8 dB durante le battute).
 * Funziona con qualsiasi BaseAudioContext: lo stesso grafo serve al gioco
 * (AudioContext) e alla verifica offline (OfflineAudioContext).
 */
import type { Settings } from '../core/types';

export type BusId = 'musica' | 'effetti' | 'voci' | 'ambiente';
export const BUS_IDS: readonly BusId[] = ['musica', 'effetti', 'voci', 'ambiente'];

/** Ducking della musica durante le battute: -8 dB. */
export const DUCK_DB = -8;
export const DUCK_GAIN = Math.pow(10, DUCK_DB / 20);
/** Costante di tempo delle dissolvenze di ambiente e musica (s). */
export const FADE_TC = 0.3;
/**
 * Livelli di mescolanza dei bus (moltiplicano il volume delle impostazioni).
 * La musica del GDD ha guadagni bassi (bordone 0,06, arpeggio 0,08): il bus la riporta
 * a un livello udibile sotto gli effetti; l'ambiente segue il volume degli effetti ma
 * resta un letto sommesso.
 */
export const MUSIC_LEVEL = 2.2;
export const AMBIENCE_LEVEL = 0.3;

export const COMPRESSOR = { threshold: -18, knee: 6, ratio: 3, attack: 0.005, release: 0.2 } as const;

export interface AudioGraph {
  ctx: BaseAudioContext;
  master: GainNode;
  compressor: DynamicsCompressorNode;
  buses: Record<BusId, GainNode>;
  /** Ingresso della musica (prima del volume): qui agisce il ducking. */
  musicDuck: GainNode;
  /** Nodo a cui collegare le sorgenti di un bus. */
  input(bus: BusId): AudioNode;
}

/** Curva percettiva dei cursori di volume (0..1 → guadagno): quadratica, 0,5 ≈ -12 dB. */
export function volumeToGain(v: number): number {
  const x = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
  return x * x;
}

function setParam(p: AudioParam, value: number, ctx: BaseAudioContext, tc = 0.03): void {
  try {
    const now = ctx.currentTime;
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.setTargetAtTime(value, now, tc);
  } catch {
    p.value = value;
  }
}

export function createGraph(ctx: BaseAudioContext, destination?: AudioNode): AudioGraph {
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = COMPRESSOR.threshold;
  compressor.knee.value = COMPRESSOR.knee;
  compressor.ratio.value = COMPRESSOR.ratio;
  compressor.attack.value = COMPRESSOR.attack;
  compressor.release.value = COMPRESSOR.release;
  compressor.connect(destination ?? ctx.destination);
  const master = ctx.createGain();
  master.connect(compressor);
  const mk = (): GainNode => {
    const g = ctx.createGain();
    g.connect(master);
    return g;
  };
  const buses: Record<BusId, GainNode> = { musica: mk(), effetti: mk(), voci: mk(), ambiente: mk() };
  const musicDuck = ctx.createGain();
  musicDuck.connect(buses.musica);
  return {
    ctx,
    master,
    compressor,
    buses,
    musicDuck,
    input: (bus) => (bus === 'musica' ? musicDuck : buses[bus]),
  };
}

/** Applica i volumi delle impostazioni (con una breve rampa per evitare scatti). */
export function applyVolumes(g: AudioGraph, v: Settings['volume'], muted: boolean, immediate = false): void {
  const set = (p: AudioParam, x: number): void => {
    if (immediate) p.value = x;
    else setParam(p, x, g.ctx);
  };
  set(g.master.gain, muted ? 0 : volumeToGain(v.master));
  set(g.buses.musica.gain, volumeToGain(v.music) * MUSIC_LEVEL);
  set(g.buses.effetti.gain, volumeToGain(v.sfx));
  set(g.buses.voci.gain, volumeToGain(v.voice));
  set(g.buses.ambiente.gain, volumeToGain(v.sfx) * AMBIENCE_LEVEL);
}

/** Abbassa (o rialza) la musica di 8 dB. */
export function applyDuck(g: AudioGraph, on: boolean): void {
  setParam(g.musicDuck.gain, on ? DUCK_GAIN : 1, g.ctx, 0.08);
}
