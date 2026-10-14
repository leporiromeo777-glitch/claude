/**
 * Motore audio procedurale (GDD 13, ARCHITETTURA 11): implementa AudioEngine.
 *
 * - Un solo AudioContext, creato dentro unlock() in modo sincrono (il core lo chiama
 *   nel gestore del primo pointerdown/pointerup/keydown, finché lo stato non è 'running').
 *   Prima dello sblocco ogni chiamata è innocua: si registra nel log, emette la sua
 *   didascalia e ricorda ambiente, musica e volumi, che partono allo sblocco.
 * - Grafo: sorgenti → bus (musica, effetti, voci, ambiente) → master → compressore.
 * - Limitatore a 48 sorgenti (voices.ts).
 * - Pre-render in idle, a piccoli lotti: 3 colpi di campana per ogni stonatura, i
 *   rumori di base in loop, le note dei personaggi, i colpi di legno e una variante degli
 *   effetti che rispondono ai gesti (gli altri si rendono al primo uso).
 * - suspend()/resume() dalla pausa dell'app; se dopo resume() lo stato non torna
 *   'running' (anche 'interrupted' su iOS) si chiede l'overlay "Tocca per continuare".
 * - Nessun file audio: tutto è sintetizzato.
 *
 * I parametri `gain` di sfx() e note() sono moltiplicatori del livello normale (1).
 */
import type {
  AmbienceId,
  AudioEngine,
  CarillonScore,
  CharacterId,
  Hour,
  MusicState,
  Playing,
  Settings,
  SfxId,
} from '../core/types';
import { CHARACTER_IDS } from '../core/ids';
import { type AudioGraph, applyDuck, applyVolumes, createGraph } from './graph';
import { SoundBank } from './bank';
import { MAX_VOICES, VoiceLimiter, type VoiceKind } from './voices';
import { NOTE_GAIN, Player } from './player';
import { Clock, type ClockTimers } from './scheduler';
import { MusicTrack, type MusicOpts } from './music';
import { AmbienceTrack, clockModeFor, clockTicks } from './ambience';
import { CARILLON_NOTE_GAIN, CARILLON_TICK_GAIN, CarillonTrack, carillonEvents, carillonSeconds } from './carillon';
import { CAPTIONS, Captioner, SFX_CAPTIONS, ambienceCaptionKey, type CaptionRecord } from './captions';
import type { Rand } from './synth/dsp';
import { type CharacterLookup, noteHzFor } from './synth/musicbox';
import { STONATURE } from './synth/bell';
import { FALLBACK_VOICE, type VoiceLookup, penSeconds, planBabble, styleFor, voiceFor } from './synth/babble';
import { type RecipeId, SFX_IDS, WARM_RECIPES } from './synth/sfx';

export const LOG_SIZE = 200;
/** Attesa prima di decidere che il contesto non è ripartito (overlay). */
export const BLOCKED_CHECK_MS = 400;
/** Tempo massimo di un lotto di pre-render dentro un callback di idle. */
export const PRERENDER_SLICE_MS = 12;

export interface LogEntry {
  /** SfxId, oppure 'incrocio', 'nota', 'campana', 'carillon', 'borbottio', 'ambiente', 'musica'. */
  id: string;
  /** Millisecondi (performance.now()). */
  t: number;
  detail?: string;
}

export interface PrerenderStats {
  started: boolean;
  done: boolean;
  jobs: number;
  completed: number;
  /** Tempo di CPU del thread principale speso nei lotti (ms). */
  cpuMs: number;
  /** Lotti eseguiti. */
  slices: number;
}

/** Informazioni sul gioco in corso (le dà register.ts; nei test valori fissi). */
export interface GameAudioContext {
  /** Stonatura della giornata in corso (campana). */
  stonatura(): number;
  /** Stonature da pre-renderizzare (prima quella corrente). */
  stonatureInUse(): number[];
  /** Personaggi della giornata in corso (arpeggio). */
  presentCharacters(): (CharacterId | 'lino')[];
  /** Seme della musica (id della giornata). */
  musicSeed(): string;
  /** L'orologio della notte è fermo (prologo). */
  clockStopped(): boolean;
}

export interface EngineDeps {
  /** Crea l'AudioContext; null se WebAudio non c'è. Iniettabile nei test. */
  createContext?: () => AudioContext | null;
  /** Orologio per il registro (ms). */
  now?: () => number;
  rand?: Rand;
  /** Emette 'audio:caption'. */
  caption?: (textKey: string, params?: Record<string, string | number>) => void;
  /** Nome visibile di un personaggio, nella lingua corrente. */
  nameOf?: (who: CharacterId | 'lino') => string;
  /** Carattere della voce ("rapido e acuto"), nella lingua corrente. */
  styleOf?: (who: CharacterId) => string;
  characters?: () => (CharacterLookup & VoiceLookup) | null;
  game?: Partial<GameAudioContext>;
  /** Esegue fn quando il thread è libero; fn riceve il tempo rimasto (ms). */
  idle?: (fn: (remaining: () => number) => void) => void;
  timers?: ClockTimers;
  /** La pagina è visibile? */
  visible?: () => boolean;
  /** Il contesto non riparte da solo: mostrare (true) o togliere (false) "Tocca per continuare". */
  onBlocked?: (blocked: boolean) => void;
}

type WebkitWindow = { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };

export function defaultCreateContext(): AudioContext | null {
  const w = globalThis as unknown as WebkitWindow;
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor({ latencyHint: 'interactive' });
  } catch {
    return new Ctor();
  }
}

function defaultIdle(fn: (remaining: () => number) => void): void {
  const ric = (globalThis as { requestIdleCallback?: (cb: (d: { timeRemaining(): number }) => void, o?: { timeout: number }) => number })
    .requestIdleCallback;
  if (typeof ric === 'function') {
    ric((d) => fn(() => d.timeRemaining()), { timeout: 600 });
  } else {
    setTimeout(() => {
      const t0 = performance.now();
      fn(() => 10 - (performance.now() - t0));
    }, 0);
  }
}

const SFX_SET: ReadonlySet<string> = new Set<string>(SFX_IDS);
const CHARACTER_SET: ReadonlySet<string> = new Set<string>(CHARACTER_IDS);
const DEFAULT_VOLUMES: Settings['volume'] = { master: 0.8, music: 0.6, sfx: 0.8, voice: 0.7 };

interface Runtime {
  ctx: AudioContext;
  graph: AudioGraph;
  bank: SoundBank;
  limiter: VoiceLimiter;
  player: Player;
  clock: Clock;
  music: MusicTrack;
  ambience: AmbienceTrack;
}

function silentPlaying(): Playing {
  return { stop() {}, done: Promise.resolve() };
}

export class WebAudioEngine implements AudioEngine {
  private rt: Runtime | null = null;
  private unavailable = false;
  private closed = false;
  private appSuspended = false;
  private wasRunning = false;
  private blocked = false;
  private blockTimer: unknown = null;
  /**
   * Un tocco su "Tocca per continuare" non è bastato: l'overlay non ricompare finché
   * l'audio non torna 'running' (ci riprova da solo ogni gesto, tramite unlock()).
   */
  private gaveUp = false;
  private retryTimer: unknown = null;
  private muted = false;
  private volumes: Settings['volume'] = { ...DEFAULT_VOLUMES };
  private explicitDuck = false;
  private speaking = 0;
  private desiredAmbience: { id: AmbienceId; fadeMs?: number; clock?: boolean } = { id: 'silenzio' };
  private desiredMusic: { state: MusicState; opts: MusicOpts } = { state: 'off', opts: {} };
  private readonly ring: LogEntry[] = [];
  private readonly captioner: Captioner;
  private readonly rand: Rand;
  private readonly now: () => number;
  private readonly timers: ClockTimers;
  private readonly game: GameAudioContext;
  private readonly playings = new Set<() => void>();
  readonly prerender: PrerenderStats = { started: false, done: false, jobs: 0, completed: 0, cpuMs: 0, slices: 0 };

  constructor(private readonly deps: EngineDeps = {}) {
    this.rand = deps.rand ?? Math.random;
    this.now = deps.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    this.timers = deps.timers ?? {
      set: (fn, ms) => setTimeout(fn, ms),
      clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    };
    this.captioner = new Captioner((k, p) => deps.caption?.(k, p), this.now);
    const g = deps.game ?? {};
    this.game = {
      stonatura: g.stonatura ?? (() => 1),
      stonatureInUse: g.stonatureInUse ?? (() => [...STONATURE]),
      presentCharacters: g.presentCharacters ?? (() => []),
      musicSeed: g.musicSeed ?? (() => ''),
      clockStopped: g.clockStopped ?? (() => false),
    };
  }

  // ───────────── Ciclo di vita ─────────────

  unlock(): void {
    if (this.closed) return;
    try {
      this.appSuspended = false;
      // Un contesto chiuso dal sistema non riparte più: se ne crea uno nuovo.
      if (this.rt && this.rt.ctx.state === 'closed') this.discardRuntime();
      if (!this.rt && !this.create()) return;
      const rt = this.rt;
      if (!rt) return;
      if (rt.ctx.state !== 'running') {
        this.resumeContext(rt.ctx);
        this.kick(rt.ctx);
      }
      this.onStateChange();
    } catch (err) {
      console.warn('[audio] unlock failed', err);
    }
  }

  state(): 'locked' | 'running' | 'suspended' {
    const rt = this.rt;
    if (!rt) return 'locked';
    if (this.appSuspended) return 'suspended';
    return rt.ctx.state === 'running' ? 'running' : 'suspended';
  }

  suspend(): void {
    this.appSuspended = true;
    this.setBlocked(false);
    const rt = this.rt;
    if (!rt) return;
    rt.clock.setRunning(false);
    try {
      void Promise.resolve(rt.ctx.suspend()).catch(() => undefined);
    } catch {
      /* contesto già chiuso */
    }
  }

  resume(): void {
    this.appSuspended = false;
    const rt = this.rt;
    if (!rt || this.closed) return;
    this.resumeContext(rt.ctx);
    this.onStateChange();
    this.scheduleBlockedCheck();
  }

  /**
   * Tocco sull'overlay "Tocca per continuare", dentro il gesto: riprende il contesto. Se
   * nemmeno così l'audio riparte (contesto rotto, telefonata in corso), l'overlay sparisce
   * lo stesso: il gioco resta giocabile (ogni suono ha un equivalente visivo) e ogni
   * gesto successivo riprova con unlock().
   */
  retryFromOverlay(): void {
    this.unlock();
    this.resume();
    if (this.retryTimer !== null) this.timers.clear(this.retryTimer);
    this.retryTimer = null;
    if (this.state() === 'running') return;
    this.retryTimer = this.timers.set(() => {
      this.retryTimer = null;
      if (this.state() !== 'running') {
        this.gaveUp = true;
        this.setBlocked(false);
      }
    }, BLOCKED_CHECK_MS);
  }

  /** Chiude il contesto (test, ricarica). Dopo, ogni chiamata è innocua. */
  close(): void {
    this.closed = true;
    for (const stop of [...this.playings]) stop();
    if (this.blockTimer !== null) this.timers.clear(this.blockTimer);
    if (this.retryTimer !== null) this.timers.clear(this.retryTimer);
    this.blockTimer = this.retryTimer = null;
    this.discardRuntime();
  }

  /** Lascia il contesto attuale (chiuso dal sistema o dal gioco); il prossimo unlock() ne crea uno nuovo. */
  private discardRuntime(): void {
    const rt = this.rt;
    this.rt = null;
    if (!rt) return;
    rt.clock.stop();
    Object.assign(this.prerender, { started: false, done: false, jobs: 0, completed: 0, cpuMs: 0, slices: 0 });
    if (rt.ctx.state === 'closed') return;
    try {
      void Promise.resolve(rt.ctx.close()).catch(() => undefined);
    } catch {
      /* già chiuso */
    }
  }

  private create(): boolean {
    if (this.unavailable) return false;
    let ctx: AudioContext | null = null;
    try {
      ctx = (this.deps.createContext ?? defaultCreateContext)();
    } catch (err) {
      console.warn('[audio] AudioContext unavailable', err);
      ctx = null;
    }
    if (!ctx) {
      this.unavailable = true;
      return false;
    }
    const graph = createGraph(ctx);
    applyVolumes(graph, this.volumes, this.muted, true);
    const limiter = new VoiceLimiter(() => ctx.currentTime, MAX_VOICES);
    const characters = (): (CharacterLookup & VoiceLookup) | null => this.characters();
    const bank = new SoundBank(ctx, { rand: this.rand, characters });
    const player = new Player(graph, bank, limiter, this.rand);
    const clock = new Clock(() => ctx.currentTime, this.timers);
    const music = new MusicTrack({
      player,
      noteHz: (who) => bank.noteHz(who),
      defaultNotes: () => this.game.presentCharacters(),
      defaultSeed: () => this.game.musicSeed(),
      stonatura: () => this.game.stonatura(),
      allCharacters: () => CHARACTER_IDS.filter((c) => bank.noteHz(c) !== null),
    });
    const ambience = new AmbienceTrack({
      player,
      rand: this.rand,
      clockStopped: () => this.game.clockStopped(),
      onEvent: (id) => {
        if (id === 'tuono') this.captioner.say(CAPTIONS.tuono);
      },
    });
    this.rt = { ctx, graph, bank, limiter, player, clock, music, ambience };
    const onChange = (): void => this.onStateChange();
    if (typeof ctx.addEventListener === 'function') ctx.addEventListener('statechange', onChange);
    else ctx.onstatechange = onChange;
    // Ambiente, musica e ducking chiesti prima dello sblocco partono adesso.
    ambience.set(this.desiredAmbience.id, this.desiredAmbience.fadeMs, this.desiredAmbience.clock);
    music.set(this.desiredMusic.state, this.desiredMusic.opts);
    clock.add(ambience);
    clock.add(music);
    if (this.explicitDuck || this.speaking > 0) applyDuck(graph, true);
    return true;
  }

  private resumeContext(ctx: AudioContext): void {
    try {
      const p = ctx.resume();
      if (p && typeof p.then === 'function') {
        p.then(
          () => this.onStateChange(),
          () => this.onStateChange(),
        );
      }
    } catch {
      /* resume non permesso adesso: riprova al prossimo gesto */
    }
  }

  /** iOS: una sorgente silenziosa avviata dentro il gesto sblocca davvero l'uscita. */
  private kick(ctx: AudioContext): void {
    try {
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
    } catch {
      /* non serve altrove */
    }
  }

  private onStateChange(): void {
    const rt = this.rt;
    if (!rt) return;
    const running = this.state() === 'running';
    rt.clock.setRunning(running);
    if (running) {
      this.wasRunning = true;
      this.gaveUp = false;
      // Il tocco sull'overlay ha funzionato: niente verdetto in sospeso.
      if (this.retryTimer !== null) {
        this.timers.clear(this.retryTimer);
        this.retryTimer = null;
      }
      this.setBlocked(false);
      this.startPrerender();
    } else if (!this.appSuspended && this.wasRunning && rt.ctx.state !== 'closed') {
      // Interruzione (iOS 'interrupted', telefonata…): si controlla fra poco.
      this.scheduleBlockedCheck();
    }
  }

  private visible(): boolean {
    try {
      return this.deps.visible ? this.deps.visible() : true;
    } catch {
      return true;
    }
  }

  private scheduleBlockedCheck(): void {
    if (this.blockTimer !== null || !this.rt) return;
    this.blockTimer = this.timers.set(() => {
      this.blockTimer = null;
      const rt = this.rt;
      const stuck = !!rt && this.wasRunning && !this.gaveUp && !this.appSuspended && !this.closed && this.visible() && this.state() !== 'running';
      this.setBlocked(stuck);
    }, BLOCKED_CHECK_MS);
  }

  private setBlocked(on: boolean): void {
    if (on === this.blocked) return;
    this.blocked = on;
    try {
      this.deps.onBlocked?.(on);
    } catch (err) {
      console.error('[audio] onBlocked failed', err);
    }
  }

  isBlocked(): boolean {
    return this.blocked;
  }

  /** Il suono si può programmare adesso (contesto creato e in esecuzione). */
  private live(): Runtime | null {
    const rt = this.rt;
    return rt && this.state() === 'running' ? rt : null;
  }

  private characters(): (CharacterLookup & VoiceLookup) | null {
    try {
      return this.deps.characters?.() ?? null;
    } catch {
      return null;
    }
  }

  private nameOf(who: CharacterId | 'lino'): string {
    try {
      return this.deps.nameOf?.(who) ?? who;
    } catch {
      return who;
    }
  }

  private record(id: string, detail?: string): void {
    const e: LogEntry = detail === undefined ? { id, t: Math.round(this.now()) } : { id, t: Math.round(this.now()), detail };
    this.ring.push(e);
    if (this.ring.length > LOG_SIZE) this.ring.splice(0, this.ring.length - LOG_SIZE);
  }

  private guard(what: string, fn: () => void): void {
    try {
      fn();
    } catch (err) {
      console.warn(`[audio] ${what} failed`, err);
    }
  }

  // ───────────── Pre-render ─────────────

  private startPrerender(): void {
    const rt = this.rt;
    if (!rt || this.prerender.started) return;
    this.prerender.started = true;
    const freqs: number[] = [];
    for (const c of CHARACTER_IDS) {
      const f = rt.bank.noteHz(c);
      if (f !== null) freqs.push(f);
    }
    let stonature: number[];
    try {
      stonature = [this.game.stonatura(), ...this.game.stonatureInUse()];
    } catch {
      stonature = [...STONATURE];
    }
    const jobs = rt.bank.prerenderJobs(stonature, freqs, WARM_RECIPES);
    this.prerender.jobs = jobs.length;
    const idle = this.deps.idle ?? defaultIdle;
    const slice = (remaining: () => number): void => {
      if (this.closed || this.rt !== rt) return;
      const t0 = this.now();
      do {
        const job = jobs.shift();
        if (!job) break;
        try {
          job();
        } catch (err) {
          console.warn('[audio] prerender job failed', err);
        }
        this.prerender.completed++;
      } while (jobs.length > 0 && remaining() > 2 && this.now() - t0 < PRERENDER_SLICE_MS);
      this.prerender.cpuMs += this.now() - t0;
      this.prerender.slices++;
      if (jobs.length > 0) idle(slice);
      else this.prerender.done = true;
    };
    idle(slice);
  }

  // ───────────── Volumi, silenzio, ducking ─────────────

  setVolumes(v: Settings['volume']): void {
    this.guard('setVolumes', () => {
      this.volumes = { ...v };
      if (this.rt) applyVolumes(this.rt.graph, this.volumes, this.muted);
    });
  }

  /** Silenzia tutto (debug). */
  mute(on: boolean): boolean {
    this.muted = !!on;
    if (this.rt) applyVolumes(this.rt.graph, this.volumes, this.muted);
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  duck(on: boolean): void {
    this.explicitDuck = !!on;
    this.updateDuck();
  }

  private updateDuck(): void {
    if (this.rt) this.guard('duck', () => applyDuck(this.rt!.graph, this.explicitDuck || this.speaking > 0));
  }

  // ───────────── Suoni ─────────────

  sfx(id: SfxId, o: { pan?: number; gain?: number; detune?: number } = {}): void {
    this.guard('sfx', () => {
      this.record(id);
      if (!SFX_SET.has(id)) {
        console.warn(`[audio] unknown sfx "${String(id)}"`);
        return;
      }
      this.captioner.say(SFX_CAPTIONS[id]);
      this.playRecipe(id, o);
    });
  }

  /**
   * Suona una ricetta con una didascalia scelta da chi chiama (suoni automatici con il
   * nome del personaggio). `logId` è l'id nel registro (di solito l'SfxId).
   */
  play(
    id: RecipeId,
    o: { pan?: number; gain?: number; detune?: number; delay?: number } = {},
    caption?: { key: string; params?: Record<string, string | number> } | null,
    logId: string = id,
  ): void {
    this.guard('play', () => {
      this.record(logId, logId === id ? undefined : id);
      if (caption) this.captioner.say(caption.key, caption.params);
      this.playRecipe(id, o);
    });
  }

  private playRecipe(id: RecipeId, o: { pan?: number; gain?: number; detune?: number; delay?: number }): void {
    const rt = this.live();
    if (!rt) return;
    const opts: { when?: number; gain?: number; pan?: number; detune?: number } = {};
    if (o.delay) opts.when = rt.ctx.currentTime + o.delay;
    if (o.gain !== undefined) opts.gain = o.gain;
    if (o.pan !== undefined) opts.pan = o.pan;
    if (o.detune !== undefined) opts.detune = o.detune;
    rt.player.sfx(id, opts);
  }

  note(who: CharacterId | 'lino', o: { pan?: number; gain?: number; detuneCents?: number } = {}): void {
    this.guard('note', () => {
      this.record('nota', who);
      const rt = this.live();
      if (!rt) return;
      const opts: { gain: number; pan?: number; cents?: number } = { gain: NOTE_GAIN * (o.gain ?? 1) };
      if (o.pan !== undefined) opts.pan = o.pan;
      if (o.detuneCents !== undefined) opts.cents = o.detuneCents;
      rt.player.note(rt.bank.noteHz(who), opts);
    });
  }

  crossing(over: CharacterId | 'lino', under: CharacterId | 'lino', o: { rancor?: boolean; pan?: number; delay?: number; gain?: number; flip?: boolean } = {}): void {
    this.guard('crossing', () => {
      this.record(o.flip ? 'rovescia' : 'incrocio', `${over}/${under}${o.rancor ? ' rancore' : ''}`);
      if (o.rancor) this.captioner.say(CAPTIONS.incrocioRancore, { sopra: this.nameOf(over), sotto: this.nameOf(under) });
      const rt = this.live();
      if (!rt) return;
      const when = rt.ctx.currentTime + (o.delay ?? 0);
      const opts: { when: number; rancor: boolean; pan?: number; gain?: number; wood?: boolean } = { when, rancor: !!o.rancor };
      if (o.pan !== undefined) opts.pan = o.pan;
      if (o.gain !== undefined) opts.gain = o.gain;
      if (o.flip) {
        // Rovesciare: due tocchi rapidi (il secondo più acuto), poi il bicordo nel verso nuovo.
        rt.player.sfx('rovescia', o.pan !== undefined ? { when, pan: o.pan } : { when });
        opts.when = when + 0.07;
        opts.wood = false;
      }
      rt.player.crossing(rt.bank.noteHz(over), rt.bank.noteHz(under), opts);
    });
  }

  /**
   * Bicordo di carillon senza legno (sopra, poi sotto 30 ms dopo): la riga di un merletto
   * che si ritesse da uno spartito. Senza note (riga vuota) un tic leggero.
   */
  dyad(over: CharacterId | 'lino' | null, under: CharacterId | 'lino' | null, o: { delay?: number; pan?: number } = {}): void {
    this.guard('dyad', () => {
      this.record('nota', over && under ? `${over}/${under}` : 'tic');
      const rt = this.live();
      if (!rt) return;
      const when = rt.ctx.currentTime + (o.delay ?? 0);
      if (!over || !under) {
        rt.player.sfx('tic', { when, gain: CARILLON_TICK_GAIN, kind: 'music' });
        return;
      }
      const opts: { when: number; pan?: number; gain: number; wood: boolean } = { when, gain: CARILLON_NOTE_GAIN / NOTE_GAIN, wood: false };
      if (o.pan !== undefined) opts.pan = o.pan;
      rt.player.crossing(rt.bank.noteHz(over), rt.bank.noteHz(under), opts);
    });
  }

  /** Didascalia senza suono (per esempio il carillon di uno spartito che si ritesse). */
  caption(textKey: string, params?: Record<string, string | number>): void {
    this.captioner.say(textKey, params);
  }

  bell(o: { hour: Hour; stonatura: number }): void {
    this.guard('bell', () => {
      const s = Number.isFinite(o.stonatura) ? Math.min(1, Math.max(0, o.stonatura)) : 1;
      this.record('campana', `ore ${o.hour} s=${s}`);
      this.captioner.say(s > 0 ? CAPTIONS.campanaStonata : CAPTIONS.campana, { ora: o.hour });
      const rt = this.live();
      if (!rt) return;
      rt.player.bell(s);
    });
  }

  carillon(score: CarillonScore): Playing {
    try {
      const rows = Array.isArray(score?.rows) ? score.rows : [];
      const safe: CarillonScore = { beatMs: score?.beatMs ?? 380, rows };
      this.record('carillon', `${rows.length} righe`);
      this.captioner.say(CAPTIONS.carillon);
      const seconds = carillonSeconds(safe);
      let track: CarillonTrack | null = null;
      const rt = this.live();
      if (rt && rows.length > 0) {
        track = new CarillonTrack(rt.player, carillonEvents(safe), rt.ctx.currentTime + 0.05, (who) => rt.bank.noteHz(who));
        rt.clock.add(track);
      }
      return this.playing(seconds, () => {
        track?.stop();
        if (track && rt) rt.clock.remove(track);
      });
    } catch (err) {
      console.warn('[audio] carillon failed', err);
      return silentPlaying();
    }
  }

  babble(who: CharacterId, text: string, o: { rate?: number } = {}): Playing {
    try {
      this.record('borbottio', who);
      const str = typeof text === 'string' ? text : '';
      if (!CHARACTER_SET.has(who)) {
        // Chi non è un personaggio (per esempio il narratore) non ha voce: niente suono e
        // niente didascalia, ma la battuta dura quanto durerebbe, per l'avanzamento automatico.
        const plan = planBabble(str, FALLBACK_VOICE, o.rate !== undefined ? { rand: this.rand, rate: o.rate } : { rand: this.rand });
        return plan.syllables.length > 0 ? this.playing(plan.duration, () => undefined) : silentPlaying();
      }
      const voice = voiceFor(who, this.characters());
      const rt = this.live();
      if (voice === null) {
        // Clotilde non parla: solo la penna.
        const seconds = penSeconds(str);
        this.captioner.say(CAPTIONS.penna);
        const h = rt ? rt.player.play(rt.bank.pen(str), { bus: 'voci', kind: 'voice' }) : null;
        return this.playing(seconds, () => h?.stop());
      }
      const planOpts: { rand: Rand; style: ReturnType<typeof styleFor>; rate?: number } = { rand: this.rand, style: styleFor(who) };
      if (o.rate !== undefined) planOpts.rate = o.rate;
      const plan = planBabble(str, voice, planOpts);
      if (plan.syllables.length === 0) return silentPlaying();
      let carattere = '';
      try {
        carattere = this.deps.styleOf?.(who) ?? '';
      } catch {
        carattere = '';
      }
      this.captioner.say(CAPTIONS.borbottio, { nome: this.nameOf(who), carattere });
      const h = rt ? rt.player.play(rt.bank.babble(plan, voice), { bus: 'voci', kind: 'voice' as VoiceKind }) : null;
      // La musica si abbassa di 8 dB mentre il personaggio parla.
      this.speaking++;
      this.updateDuck();
      let released = false;
      const release = (): void => {
        if (released) return;
        released = true;
        this.speaking = Math.max(0, this.speaking - 1);
        this.updateDuck();
      };
      return this.playing(plan.duration, () => h?.stop(), release);
    } catch (err) {
      console.warn('[audio] babble failed', err);
      return silentPlaying();
    }
  }

  /**
   * Playing con una durata nota: `done` si risolve alla fine (anche ad audio spento,
   * così chi aspetta la battuta ha gli stessi tempi) oppure a stop().
   */
  private playing(seconds: number, onStop: () => void, onEnd?: () => void): Playing {
    let finished = false;
    let resolve: () => void = () => undefined;
    const done = new Promise<void>((r) => (resolve = r));
    let timer: unknown = null;
    const finish = (stopSound: boolean): void => {
      if (finished) return;
      finished = true;
      if (timer !== null) this.timers.clear(timer);
      this.playings.delete(stopNow);
      if (stopSound) {
        try {
          onStop();
        } catch {
          /* già fermo */
        }
      }
      onEnd?.();
      resolve();
    };
    const stopNow = (): void => finish(true);
    this.playings.add(stopNow);
    timer = this.timers.set(() => finish(false), Math.max(0, seconds * 1000));
    return { stop: stopNow, done };
  }

  /**
   * Ambiente (GDD 13.3). `o.clock` aggiunge (true) o toglie (false) l'orologio che
   * ticchetta; senza, c'è solo nella notte (fermo nel prologo). Il titolo chiede
   * `setAmbience('laguna', undefined, { clock: true })`: laguna e orologio (GDD 9).
   */
  setAmbience(a: AmbienceId, fadeMs?: number, o?: { clock?: boolean }): void {
    this.guard('setAmbience', () => {
      const clock = o?.clock;
      this.record('ambiente', clock === undefined ? a : `${a} ${clock ? '+' : '-'}orologio`);
      const prev = this.desiredAmbience;
      const changed = a !== prev.id || clock !== prev.clock;
      const next: { id: AmbienceId; fadeMs?: number; clock?: boolean } = { id: a };
      if (fadeMs !== undefined) next.fadeMs = fadeMs;
      if (clock !== undefined) next.clock = clock;
      this.desiredAmbience = next;
      if (changed) this.captioner.say(ambienceCaptionKey(a, clock, this.game.clockStopped()));
      const rt = this.rt;
      if (!rt) return;
      rt.ambience.set(a, fadeMs, clock);
      if (!rt.clock.has(rt.ambience)) rt.clock.add(rt.ambience);
    });
  }

  /**
   * Il contesto del gioco è cambiato (scena nuova): la musica chiesta senza seme o note
   * riprende quelli della giornata giusta. Senza cambiamenti non succede nulla.
   */
  refreshContext(): void {
    this.guard('refreshContext', () => {
      const rt = this.rt;
      if (!rt) return;
      rt.music.set(this.desiredMusic.state, this.desiredMusic.opts);
      if (!rt.clock.has(rt.music)) rt.clock.add(rt.music);
    });
  }

  setMusic(s: MusicState, o: MusicOpts = {}): void {
    this.guard('setMusic', () => {
      this.record('musica', s);
      this.desiredMusic = { state: s, opts: { ...o } };
      const rt = this.rt;
      if (!rt) return;
      rt.music.set(s, o);
      if (!rt.clock.has(rt.music)) rt.clock.add(rt.music);
    });
  }

  // ───────────── Debug ─────────────

  /** Ultimi 200 suoni richiesti, anche senza contesto audio. */
  log(): LogEntry[] {
    return this.ring.map((e) => ({ ...e }));
  }

  captions(): CaptionRecord[] {
    return this.captioner.history();
  }

  stats(): {
    state: 'locked' | 'running' | 'suspended';
    contextState: string | null;
    sampleRate: number | null;
    active: number;
    peak: number;
    stolen: number;
    max: number;
    byKind: Record<VoiceKind, number> | null;
    muted: boolean;
    ducked: boolean;
    blocked: boolean;
    music: MusicState;
    ambience: AmbienceId;
    /** L'orologio dell'ambiente ticchetta adesso (prima dello sblocco: quello chiesto). */
    clock: boolean;
    prerender: PrerenderStats;
  } {
    const rt = this.rt;
    return {
      state: this.state(),
      contextState: rt ? rt.ctx.state : null,
      sampleRate: rt ? rt.ctx.sampleRate : null,
      active: rt ? rt.limiter.count() : 0,
      peak: rt ? rt.limiter.peak() : 0,
      stolen: rt ? rt.limiter.stolenCount() : 0,
      max: MAX_VOICES,
      byKind: rt ? rt.limiter.byKind() : null,
      muted: this.muted,
      ducked: this.explicitDuck || this.speaking > 0,
      blocked: this.blocked,
      music: this.desiredMusic.state,
      ambience: this.desiredAmbience.id,
      clock: rt
        ? rt.ambience.ticking()
        : clockTicks(clockModeFor(this.desiredAmbience.id, this.desiredAmbience.clock), this.game.clockStopped()),
      prerender: { ...this.prerender },
    };
  }

  /** Suona `n` effetti di fila (test del limitatore): picco di sorgenti attive. */
  stress(n = 200): { requested: number; active: number; peak: number; stolen: number } {
    const count = Math.max(0, Math.min(2000, Math.floor(n)));
    for (let i = 0; i < count; i++) this.sfx(SFX_IDS[i % SFX_IDS.length]!, { gain: 0.05 });
    const rt = this.rt;
    return {
      requested: count,
      active: rt ? rt.limiter.count() : 0,
      peak: rt ? rt.limiter.peak() : 0,
      stolen: rt ? rt.limiter.stolenCount() : 0,
    };
  }

  /**
   * Simula un'interruzione del sistema (telefonata, Siri su iOS): il contesto si ferma
   * senza che il gioco l'abbia chiesto. Serve a provare "Tocca per continuare".
   */
  simulateInterruption(): void {
    const rt = this.rt;
    if (!rt) return;
    try {
      void Promise.resolve(rt.ctx.suspend()).then(
        () => this.onStateChange(),
        () => undefined,
      );
    } catch {
      /* contesto chiuso */
    }
  }

  /** Il contesto (solo per i test e la verifica). */
  context(): AudioContext | null {
    return this.rt?.ctx ?? null;
  }

  /** Frequenza della nota di un personaggio (con i dati attuali). */
  noteHz(who: CharacterId | 'lino'): number | null {
    return noteHzFor(who, this.characters());
  }
}
