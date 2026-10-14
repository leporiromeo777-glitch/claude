/**
 * Limitatore di voci (GDD 13.1, ARCHITETTURA 11): al massimo 48 nodi sorgente attivi
 * (buffer, oscillatori, LFO). Oltre, si ferma il più vecchio degli effetti; se non ce
 * ne sono, la nota non persistente più vecchia (voci, musica, eventi d'ambiente).
 * Le sorgenti persistenti (bordone, loop d'ambiente, LFO) non si tagliano mai: se
 * tutto il posto è loro, il suono nuovo semplicemente non parte.
 *
 * Una sorgente conta dal momento in cui viene creata (anche se programmata poco più
 * avanti) fino alla fine prevista o all'evento `ended`.
 */

export type VoiceKind = 'sfx' | 'voice' | 'music' | 'ambience';
export const MAX_VOICES = 48;

export interface VoiceEntry {
  readonly id: number;
  readonly node: AudioScheduledSourceNode;
  readonly gain: GainNode | null;
  readonly kind: VoiceKind;
  readonly persistent: boolean;
  /** Fine prevista nel tempo del contesto (Infinity per loop e persistenti). */
  end: number;
  ended: boolean;
}

export class VoiceLimiter {
  private list: VoiceEntry[] = [];
  private seq = 0;
  private maxSeen = 0;
  private stolen = 0;

  constructor(
    private readonly now: () => number,
    readonly max = MAX_VOICES,
  ) {}

  /** Toglie le sorgenti finite (evento ended o fine prevista passata). */
  prune(): void {
    const t = this.now();
    let w = 0;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i]!;
      if (e.ended || t >= e.end) {
        e.ended = true;
        continue;
      }
      this.list[w++] = e;
    }
    this.list.length = w;
  }

  count(): number {
    this.prune();
    return this.list.length;
  }

  /** Massimo numero di sorgenti contemporanee visto finora. */
  peak(): number {
    return this.maxSeen;
  }

  /** Sorgenti fermate per fare posto. */
  stolenCount(): number {
    return this.stolen;
  }

  resetPeak(): void {
    this.maxSeen = this.count();
  }

  /** Quante sorgenti per tipo (debug). */
  byKind(): Record<VoiceKind, number> {
    this.prune();
    const out: Record<VoiceKind, number> = { sfx: 0, voice: 0, music: 0, ambience: 0 };
    for (const e of this.list) out[e.kind]++;
    return out;
  }

  /** Fa posto per `n` nuove sorgenti. false se non si può (tutto occupato da persistenti). */
  reserve(n = 1): boolean {
    this.prune();
    while (this.list.length + n > this.max) {
      const victim = this.oldest((e) => !e.persistent && e.kind === 'sfx') ?? this.oldest((e) => !e.persistent);
      if (!victim) return false;
      this.kill(victim);
    }
    return true;
  }

  /** Registra una sorgente appena creata (dopo reserve()). */
  add(node: AudioScheduledSourceNode, o: { kind: VoiceKind; persistent?: boolean; end: number; gain?: GainNode | null }): VoiceEntry {
    const entry: VoiceEntry = {
      id: ++this.seq,
      node,
      gain: o.gain ?? null,
      kind: o.kind,
      persistent: !!o.persistent,
      end: o.persistent ? Infinity : o.end,
      ended: false,
    };
    this.list.push(entry);
    if (this.list.length > this.maxSeen) this.maxSeen = this.list.length;
    return entry;
  }

  /** Una sorgente è finita (evento ended o stop volontario). */
  release(entry: VoiceEntry): void {
    entry.ended = true;
    const i = this.list.indexOf(entry);
    if (i >= 0) this.list.splice(i, 1);
  }

  /** Ferma subito tutte le sorgenti che soddisfano `pred` (tutte se manca). */
  stopAll(pred?: (e: VoiceEntry) => boolean): void {
    for (const e of this.list.slice()) if (!pred || pred(e)) this.kill(e);
  }

  private oldest(pred: (e: VoiceEntry) => boolean): VoiceEntry | null {
    for (const e of this.list) if (pred(e)) return e;
    return null;
  }

  private kill(e: VoiceEntry): void {
    this.release(e);
    this.stolen++;
    try {
      e.gain?.gain.cancelScheduledValues(0);
      if (e.gain) e.gain.gain.value = 0;
    } catch {
      /* il nodo può essere già scollegato */
    }
    try {
      e.node.stop();
    } catch {
      /* già fermo o mai partito */
    }
  }
}
