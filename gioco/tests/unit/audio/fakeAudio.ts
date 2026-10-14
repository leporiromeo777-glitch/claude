/**
 * Un AudioContext finto per i test in Node: abbastanza WebAudio per costruire il grafo,
 * programmare sorgenti e far avanzare il tempo a mano. Le sorgenti finiscono (onended)
 * quando `advance()` supera la loro fine (durata del buffer o stop()).
 */

type Listener = () => void;

export class FakeParam {
  value: number;
  readonly calls: { fn: string; args: number[] }[] = [];
  constructor(v: number) {
    this.value = v;
  }
  setValueAtTime(v: number, t: number): this {
    this.value = v;
    this.calls.push({ fn: 'setValueAtTime', args: [v, t] });
    return this;
  }
  setTargetAtTime(v: number, t: number, tc: number): this {
    this.value = v;
    this.calls.push({ fn: 'setTargetAtTime', args: [v, t, tc] });
    return this;
  }
  linearRampToValueAtTime(v: number, t: number): this {
    this.value = v;
    this.calls.push({ fn: 'linearRampToValueAtTime', args: [v, t] });
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number): this {
    this.value = v;
    this.calls.push({ fn: 'exponentialRampToValueAtTime', args: [v, t] });
    return this;
  }
  cancelScheduledValues(t: number): this {
    this.calls.push({ fn: 'cancelScheduledValues', args: [t] });
    return this;
  }
}

export class FakeNode {
  readonly outputs: unknown[] = [];
  constructor(readonly ctx: FakeAudioContext) {}
  connect<T>(dest: T): T {
    this.outputs.push(dest);
    return dest;
  }
  disconnect(): void {
    this.outputs.length = 0;
  }
}

export class FakeGain extends FakeNode {
  readonly gain = new FakeParam(1);
}

export class FakeBiquad extends FakeNode {
  type = 'lowpass';
  readonly frequency = new FakeParam(350);
  readonly Q = new FakeParam(1);
  readonly gain = new FakeParam(0);
}

export class FakePanner extends FakeNode {
  readonly pan = new FakeParam(0);
}

export class FakeCompressor extends FakeNode {
  readonly threshold = new FakeParam(-24);
  readonly knee = new FakeParam(30);
  readonly ratio = new FakeParam(12);
  readonly attack = new FakeParam(0.003);
  readonly release = new FakeParam(0.25);
}

export class FakeBuffer {
  readonly data: Float32Array[];
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.data = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  get duration(): number {
    return this.length / this.sampleRate;
  }
  getChannelData(c: number): Float32Array {
    return this.data[c]!;
  }
  copyToChannel(src: Float32Array, c: number): void {
    this.data[c]!.set(src.subarray(0, this.length));
  }
}

export class FakeSource extends FakeNode {
  onended: Listener | null = null;
  startAt: number | null = null;
  stopAt: number | null = null;
  ended = false;
  start(when = 0): void {
    if (this.startAt !== null) throw new Error('start() twice');
    this.startAt = when;
    this.ctx.sources.push(this);
  }
  stop(when?: number): void {
    const t = when ?? this.ctx.currentTime;
    this.stopAt = this.stopAt === null ? t : Math.min(this.stopAt, t);
  }
  /** Fine naturale (Infinity per oscillatori e loop). */
  naturalEnd(): number {
    return Infinity;
  }
  end(): number {
    return Math.min(this.naturalEnd(), this.stopAt ?? Infinity);
  }
  playing(now: number): boolean {
    return !this.ended && this.startAt !== null && now < this.end();
  }
}

export class FakeBufferSource extends FakeSource {
  buffer: FakeBuffer | null = null;
  readonly playbackRate = new FakeParam(1);
  readonly detune = new FakeParam(0);
  loop = false;
  override naturalEnd(): number {
    if (this.loop || !this.buffer || this.startAt === null) return Infinity;
    return this.startAt + this.buffer.duration / (this.playbackRate.value || 1);
  }
}

export class FakeOscillator extends FakeSource {
  type = 'sine';
  readonly frequency = new FakeParam(440);
  readonly detune = new FakeParam(0);
}

export class FakeAudioContext {
  currentTime = 0;
  sampleRate: number;
  state: 'suspended' | 'running' | 'closed' | 'interrupted';
  readonly destination: FakeNode;
  readonly sources: FakeSource[] = [];
  onstatechange: Listener | null = null;
  private readonly listeners: Listener[] = [];
  resumeCalls = 0;
  suspendCalls = 0;
  /** Se false, resume() non riesce (iOS interrotto). */
  canResume = true;

  constructor(o: { sampleRate?: number; state?: 'suspended' | 'running' } = {}) {
    this.sampleRate = o.sampleRate ?? 44100;
    this.state = o.state ?? 'running';
    this.destination = new FakeNode(this);
  }

  addEventListener(type: string, fn: Listener): void {
    if (type === 'statechange') this.listeners.push(fn);
  }

  private setState(s: FakeAudioContext['state']): void {
    if (s === this.state) return;
    this.state = s;
    for (const fn of this.listeners) fn();
    this.onstatechange?.();
  }

  resume(): Promise<void> {
    this.resumeCalls++;
    if (this.canResume && this.state !== 'closed') this.setState('running');
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.suspendCalls++;
    if (this.state !== 'closed') this.setState('suspended');
    return Promise.resolve();
  }
  /** Interruzione del sistema (telefonata). */
  interrupt(): void {
    this.setState('interrupted');
  }
  close(): Promise<void> {
    this.setState('closed');
    return Promise.resolve();
  }

  createGain(): FakeGain {
    return new FakeGain(this);
  }
  createBiquadFilter(): FakeBiquad {
    return new FakeBiquad(this);
  }
  createStereoPanner(): FakePanner {
    return new FakePanner(this);
  }
  createDynamicsCompressor(): FakeCompressor {
    return new FakeCompressor(this);
  }
  createBufferSource(): FakeBufferSource {
    return new FakeBufferSource(this);
  }
  createOscillator(): FakeOscillator {
    return new FakeOscillator(this);
  }
  createBuffer(channels: number, length: number, sampleRate: number): FakeBuffer {
    return new FakeBuffer(channels, length, sampleRate);
  }

  /** Sorgenti che suonano adesso. */
  playing(): FakeSource[] {
    return this.sources.filter((s) => s.playing(this.currentTime));
  }

  /** Avanza il tempo (solo se il contesto è in esecuzione) e chiama onended. */
  advance(seconds: number): void {
    if (this.state !== 'running') return;
    this.currentTime += seconds;
    for (const s of this.sources) {
      if (!s.ended && s.startAt !== null && this.currentTime >= s.end()) {
        s.ended = true;
        s.onended?.();
      }
    }
  }

  asAudioContext(): AudioContext {
    return this as unknown as AudioContext;
  }
}

/** Timer finti: si eseguono a mano con `run(ms)`. */
export class FakeTimers {
  private now = 0;
  private seq = 0;
  private readonly queue = new Map<number, { at: number; fn: () => void }>();
  set = (fn: () => void, ms: number): unknown => {
    const id = ++this.seq;
    this.queue.set(id, { at: this.now + ms, fn });
    return id;
  };
  clear = (h: unknown): void => {
    this.queue.delete(h as number);
  };
  /** Fa passare `ms` millisecondi eseguendo i timer scaduti in ordine. */
  run(ms: number): void {
    const end = this.now + ms;
    for (;;) {
      let next: [number, { at: number; fn: () => void }] | null = null;
      for (const e of this.queue) if (e[1].at <= end && (!next || e[1].at < next[1].at)) next = e;
      if (!next) break;
      this.queue.delete(next[0]);
      this.now = next[1].at;
      next[1].fn();
    }
    this.now = end;
  }
  pending(): number {
    return this.queue.size;
  }
}

/** Generatore pseudo-casuale semplice e ripetibile per i test. */
export function seeded(seed = 1): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}
