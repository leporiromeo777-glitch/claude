/**
 * Suoni automatici (ARCHITETTURA 5.6): il pacchetto audio ascolta il bus, così le altre
 * scene non devono chiamarlo per ogni dettaglio.
 *
 * | evento                        | suono                                                       |
 * |-------------------------------|-------------------------------------------------------------|
 * | night:cross                   | incrocio (legno + bicordo), in rancore nota sotto +40 cent;  |
 * |                               | se la stessa coppia cambia verso: rovescia                   |
 * | night:violation               | rifiuto («No.» di Marta) o tonfo per le altre violazioni     |
 * | night:row (ok)                | ora_fissata, campana con la stonatura del giorno, poi i     |
 * |                               | suoni del merletto: lettera, voce, segreto, febbre, cura,   |
 * |                               | nodo, trabocco, vaporetto/barca/marea, filo nero; marea     |
 * |                               | se nella riga dopo c'è l'acqua alta                         |
 * | night:row in modo 'replay'    | il carillon: un bicordo per incrocio (o un tic), niente     |
 * |                               | campana (spartito importato, Ripassa)                       |
 * | night:undo                    | disfa                                                       |
 * | night:complete                | successo (tutto soddisfatto) o fallimento                   |
 * | diary:new, quirk:discovered   | pagina                                                      |
 * | clic sui pulsanti di #ui-root | ui_tap (ui_indietro su chiudi/annulla/indietro)             |
 * | app:back                      | ui_indietro                                                 |
 * | app:pause / app:resume        | suspend() / resume()                                        |
 *
 * Tiene anche il contesto del gioco che serve al motore: livello in corso, stonatura,
 * personaggi presenti, orologio fermo nel prologo.
 */
import type {
  BeadType,
  CharacterId,
  ContentDB,
  EventBus,
  FlagValue,
  GameEventMap,
  Hour,
  LaceEvent,
  LevelDef,
  SaveData,
  SceneId,
  Settings,
  SfxId,
  Side,
  ThreadId,
  Unsub,
  Violation,
} from '../core/types';
import { CHARACTER_IDS } from '../core/ids';
import { CAPTIONS, SFX_CAPTIONS } from './captions';
import type { GameAudioContext } from './engine';
import { STONATURE } from './synth/bell';
import type { RecipeId } from './synth/sfx';

export interface CaptionRef {
  key: string;
  params?: Record<string, string | number>;
}

/** Quello che l'automazione usa del motore (WebAudioEngine lo implementa). */
export interface AutomationTarget {
  sfx(id: SfxId, o?: { pan?: number; gain?: number; detune?: number }): void;
  play(id: RecipeId, o?: { pan?: number; gain?: number; detune?: number; delay?: number }, caption?: CaptionRef | null, logId?: string): void;
  crossing(over: CharacterId | 'lino', under: CharacterId | 'lino', o?: { rancor?: boolean; pan?: number; delay?: number; gain?: number; flip?: boolean }): void;
  bell(o: { hour: Hour; stonatura: number }): void;
  dyad(over: CharacterId | 'lino' | null, under: CharacterId | 'lino' | null, o?: { delay?: number; pan?: number }): void;
  caption(textKey: string, params?: Record<string, string | number>): void;
  suspend(): void;
  resume(): void;
}

export interface AutomationDeps {
  bus: EventBus<GameEventMap>;
  engine: AutomationTarget;
  content: () => ContentDB | null;
  save: () => SaveData | null;
  settings: () => Settings | null;
  nameOf: (who: CharacterId | 'lino') => string;
  /** Radice dell'interfaccia: i clic sui pulsanti fanno ui_tap. */
  uiRoot?: HTMLElement | null;
  now?: () => number;
}

/** Suoni del merletto al massimo per ogni ora fissata. */
export const MAX_ROW_SOUNDS = 6;
/** Primo suono del merletto dopo la campana, e passo fra i suoni (a velocità 1×). */
export const ROW_SOUND_START = 0.15;
export const ROW_SOUND_STEP = 0.18;

const CHAR_SET: ReadonlySet<string> = new Set<string>(CHARACTER_IDS);

function truthy(v: FlagValue | undefined): boolean {
  return v === true || v === 1 || v === 'si' || v === 'sì' || v === 'true';
}

/** Chi suona un filo: il personaggio del filo, 'lino' per i passanti. */
export function threadWho(thread: ThreadId, level: LevelDef | null): CharacterId | 'lino' {
  const def = level?.threads?.find((t) => t.id === thread);
  if (def) {
    if (def.kind === 'lino') return 'lino';
    if (def.character) return def.character;
  }
  return CHAR_SET.has(thread) ? (thread as CharacterId) : 'lino';
}

function samePair(a: ThreadId, b: ThreadId, x: ThreadId, y: ThreadId): boolean {
  return (a === x && b === y) || (a === y && b === x);
}

/** Coppie in rancore attive: quelle del livello, meno Teresa-Marta se si sono riconciliate. */
export function activeRancor(level: LevelDef | null, flags: Readonly<Record<string, FlagValue>> | null): [ThreadId, ThreadId][] {
  const list = level?.rancor ?? [];
  const reconciled = truthy(flags?.['riconciliate']);
  return list.filter(([a, b]) => !(reconciled && samePair(a, b, 'teresa', 'marta')));
}

/** Panoramica di una colonna (o del punto fra due colonne): da -0,6 a +0,6. */
export function columnPan(column: number, columns: number): number {
  if (!(columns > 1) || !Number.isFinite(column)) return 0;
  return Math.max(-0.6, Math.min(0.6, ((column / (columns - 1)) * 2 - 1) * 0.6));
}

/**
 * Stonatura della campana (GDD 13.2): 0 dopo il finale vero; altrimenti quella della
 * giornata (campaign.json); nel finale vero 0 e nel falso 1; per gli altri livelli
 * quella della giornata di campagna raggiunta, o per atto (I: 1, II: 0,6, III: 0,25).
 */
export function resolveStonatura(levelId: string | null, level: LevelDef | null, content: ContentDB | null, save: SaveData | null): number {
  const trueEnding = !!save && (save.unlocks?.tovaglia === true || !!save.campaign?.endingsSeen?.includes('aperto'));
  if (trueEnding) return 0;
  const campaign = content?.campaign;
  const valid = (s: unknown): s is number => typeof s === 'number' && Number.isFinite(s);
  if (levelId && campaign) {
    const day = campaign.days.find((d) => d.id === levelId);
    if (day && valid(day.stonatura)) return day.stonatura;
    if (levelId === campaign.finals.aperto) return 0;
    if (levelId === campaign.finals.chiuso) return 1;
    const cur = save?.campaign ? campaign.days.find((d) => d.id === save.campaign!.levelId) : undefined;
    if (cur && valid(cur.stonatura)) return cur.stonatura;
  }
  const act = level?.act;
  return act === 2 ? 0.6 : act === 3 ? 0.25 : 1;
}

/** Tipo di una perlina dal suo id (anche quelle nate in gioco, come 'letta:L1'). */
export function beadTypeOf(bead: string, level: LevelDef | null): BeadType | null {
  const def = level?.beads?.find((b) => b.id === bead);
  if (def) return def.type;
  if (bead.startsWith('letta:')) return 'segreto';
  if (bead.startsWith('voce:')) return 'voce';
  if (bead === 'febbre') return 'febbre';
  if (bead === 'nome') return 'nome';
  return null;
}

/** La marea sale nella riga dopo quella fissata (TideDef: righe bloccate da `from` a `to`). */
export function tideRises(level: LevelDef | null, hour: Hour): boolean {
  return !!level?.tide?.some((t) => t.from === hour + 1);
}

export type EventSound =
  | { k: 'sfx'; id: RecipeId; pan?: number; caption: CaptionRef | null }
  | { k: 'crossing'; over: CharacterId | 'lino'; under: CharacterId | 'lino'; pan?: number };

/**
 * Suoni degli eventi di una riga fissata, in ordine, senza doppioni (funzione pura).
 * `pos` è l'ordine dei fili dopo la riga (per la panoramica).
 */
export function eventSounds(
  events: readonly LaceEvent[],
  o: { level: LevelDef | null; pos: readonly ThreadId[]; nameOf: (who: CharacterId | 'lino') => string },
): EventSound[] {
  const { level, pos } = o;
  const cols = level?.columns?.length ?? pos.length;
  const panOf = (t: ThreadId): number => {
    const i = pos.indexOf(t);
    return i >= 0 ? columnPan(i, cols) : 0;
  };
  const name = (t: ThreadId): string => o.nameOf(threadWho(t, level));
  const delivered = new Set(events.filter((e) => e.k === 'consegna').map((e) => (e as { bead: string }).bead));
  const out: EventSound[] = [];
  const seen = new Set<string>();
  const push = (s: EventSound): void => {
    const key = s.k === 'sfx' ? `${s.id}|${s.caption?.key ?? ''}|${JSON.stringify(s.caption?.params ?? {})}` : `x|${s.over}|${s.under}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };
  const sfx = (id: RecipeId, caption: CaptionRef | null, pan?: number): void => {
    push(pan === undefined ? { k: 'sfx', id, caption } : { k: 'sfx', id, caption, pan });
  };
  const edgeDone = new Set<string>();
  for (const e of events) {
    switch (e.k) {
      case 'consegna':
        sfx('lettera', { key: CAPTIONS.consegna, params: { nome: name(e.to) } }, panOf(e.to));
        break;
      case 'passa':
      case 'copia': {
        if (e.k === 'passa' && delivered.has(e.bead)) break;
        const type = beadTypeOf(e.bead, level) ?? (e.k === 'passa' ? 'lettera' : 'voce');
        const nome = { nome: name(e.to) };
        if (type === 'lettera') sfx('lettera', { key: CAPTIONS.letteraA, params: nome }, panOf(e.to));
        else if (type === 'voce') sfx('voce', { key: CAPTIONS.voceA, params: nome }, panOf(e.to));
        else if (type === 'nome') sfx('voce', { key: CAPTIONS.nomeA, params: nome }, panOf(e.to));
        else if (type === 'segreto') sfx('segreto', { key: CAPTIONS.segretoA, params: nome }, panOf(e.to));
        else if (type === 'febbre') sfx('febbre', { key: CAPTIONS.febbreA, params: nome }, panOf(e.to));
        break;
      }
      case 'legge':
        sfx('segreto', { key: CAPTIONS.legge, params: { nome: name(e.who) } }, panOf(e.who));
        break;
      case 'contagio':
        sfx('febbre', { key: CAPTIONS.febbreA, params: { nome: name(e.to) } }, panOf(e.to));
        break;
      case 'cura':
        sfx('cura', { key: CAPTIONS.curaA, params: { nome: name(e.who) } }, panOf(e.who));
        break;
      case 'nodo':
        sfx('nodo', { key: CAPTIONS.nodoTra, params: { a: name(e.a), b: name(e.b) } }, panOf(e.a));
        break;
      case 'trabocca':
        sfx('trabocco', { key: CAPTIONS.traboccoDi, params: { nome: name(e.who) } }, panOf(e.who));
        break;
      case 'esce':
      case 'entra': {
        const pan = e.side === 'molo' ? -0.6 : 0.6;
        const def = level?.threads?.find((t) => t.id === e.thread);
        if (e.k === 'entra' && def?.kind === 'nero') {
          sfx('nero', { key: SFX_CAPTIONS.nero ?? '' }, pan);
          break;
        }
        const id: SfxId = e.kind === 'vaporetto' ? 'vaporetto' : e.kind === 'barca' ? 'barca' : 'marea';
        if (edgeDone.has(id)) break;
        edgeDone.add(id);
        sfx(id, { key: SFX_CAPTIONS[id] ?? '' }, pan);
        break;
      }
      case 'nero': {
        const a = pos[e.pair];
        const b = pos[e.pair + 1];
        const other = a === e.thread ? b : a;
        if (other !== undefined) {
          push({ k: 'crossing', over: threadWho(e.thread, level), under: threadWho(other, level), pan: columnPan(e.pair + 0.5, cols) });
        }
        break;
      }
      case 'incontro':
      case 'stranezza':
        break;
    }
  }
  return out;
}

interface NightInfo {
  level: LevelDef;
  flags: Record<string, FlagValue>;
  /** Spartito o Ripassa: le righe suonano come un carillon, senza campana. */
  replay: boolean;
}

function isLevel(x: unknown): x is LevelDef {
  const l = x as Partial<LevelDef> | null;
  return !!l && typeof l === 'object' && typeof l.id === 'string' && Array.isArray(l.threads) && Array.isArray(l.columns);
}

export class AudioAutomation implements GameAudioContext {
  private night: NightInfo | null = null;
  private scene: SceneId | null = null;
  private draftHour: Hour | null = null;
  private readonly draft = new Map<number, Side>();
  private readonly stack: number[] = [];
  private lastPage = -Infinity;
  private replayRows = 0;
  private lastVolumes: Settings['volume'] | null = null;
  private lastPreview = -Infinity;
  private readonly now: () => number;

  constructor(private readonly deps: AutomationDeps) {
    this.now = deps.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  }

  // ───────────── Contesto del gioco (per il motore) ─────────────

  levelId(): string | null {
    const camp = this.safeSave()?.campaign ?? null;
    if (this.scene === 'tombolo' && this.night) return this.night.level.id;
    if (camp && this.scene && ['sera', 'alba', 'bilancio', 'archivio', 'finale'].includes(this.scene)) return camp.levelId;
    return this.night?.level.id ?? camp?.levelId ?? null;
  }

  level(): LevelDef | null {
    const id = this.levelId();
    if (!id) return null;
    if (this.night && this.night.level.id === id) return this.night.level;
    return this.safeContent()?.levels.get(id) ?? null;
  }

  stonatura(): number {
    return resolveStonatura(this.levelId(), this.level(), this.safeContent(), this.safeSave());
  }

  stonatureInUse(): number[] {
    const days = this.safeContent()?.campaign.days ?? [];
    const set = new Set<number>(STONATURE);
    for (const d of days) if (typeof d.stonatura === 'number' && Number.isFinite(d.stonatura)) set.add(d.stonatura);
    return [...set];
  }

  presentCharacters(): (CharacterId | 'lino')[] {
    const lvl = this.level();
    if (!lvl) return [];
    const out = new Set<CharacterId | 'lino'>();
    for (const t of lvl.threads) out.add(threadWho(t.id, lvl));
    return [...out];
  }

  musicSeed(): string {
    const lvl = this.level();
    return lvl?.musicSeed ?? lvl?.id ?? this.levelId() ?? '';
  }

  clockStopped(): boolean {
    return this.levelId() === 'g00';
  }

  private safeContent(): ContentDB | null {
    try {
      return this.deps.content();
    } catch {
      return null;
    }
  }

  private safeSave(): SaveData | null {
    try {
      return this.deps.save();
    } catch {
      return null;
    }
  }

  // ───────────── Ascolto del bus ─────────────

  install(): Unsub {
    const { bus } = this.deps;
    const offs: Unsub[] = [
      bus.on('scene:enter', (p) => this.onScene(p.id, p.params)),
      bus.on('night:cross', (p) => this.guard(() => this.onCross(p.hour, p.crossing.pair, p.crossing.over, p.over, p.under))),
      bus.on('night:violation', (p) => this.guard(() => this.onViolation(p.v))),
      bus.on('night:row', (p) => this.guard(() => this.onRow(p.hour, p.result.ok, p.result.events, p.result.state.pos))),
      bus.on('night:undo', (p) => this.guard(() => this.onUndo(p.hour))),
      bus.on('night:complete', (p) =>
        this.guard(() => {
          const o = p.outcome;
          // Uno spartito che si ritesse non ha esito: ha già suonato il suo carillon.
          if (!this.night?.replay) {
            const ok = (o.requests ?? []).every((r) => r.status === 'soddisfatta') && (o.goals ?? []).every((g) => g.status === 'soddisfatta');
            this.deps.engine.sfx(ok ? 'successo' : 'fallimento');
          }
          this.draft.clear();
          this.draftHour = null;
        }),
      ),
      bus.on('diary:new', () => this.guard(() => this.page())),
      bus.on('quirk:discovered', () => this.guard(() => this.page())),
      bus.on('app:back', () => this.guard(() => this.deps.engine.sfx('ui_indietro'))),
      bus.on('app:pause', () => this.guard(() => this.deps.engine.suspend())),
      bus.on('app:resume', () => this.guard(() => this.deps.engine.resume())),
      bus.on('settings:change', (s) => this.guard(() => this.onSettings(s))),
    ];
    const root = this.deps.uiRoot;
    if (root) {
      const onClick = (e: Event): void => this.guard(() => this.onClick(e.target));
      root.addEventListener('click', onClick, true);
      offs.push(() => root.removeEventListener('click', onClick, true));
    }
    return () => {
      for (const off of offs.splice(0)) off();
    };
  }

  private guard(fn: () => void): void {
    try {
      fn();
    } catch (err) {
      console.warn('[audio] automation failed', err);
    }
  }

  private onScene(id: SceneId, params: unknown): void {
    this.scene = id;
    if (id !== 'tombolo') return;
    const p = params as { level?: unknown; flags?: Record<string, FlagValue>; mode?: unknown } | undefined;
    if (p && isLevel(p.level)) this.night = { level: p.level, flags: p.flags ?? {}, replay: p.mode === 'replay' };
    this.replayRows = 0;
    this.draft.clear();
    this.stack.length = 0;
    this.draftHour = null;
  }

  private isRancor(a: ThreadId, b: ThreadId): boolean {
    const n = this.night;
    if (!n) return false;
    return activeRancor(n.level, n.flags).some(([x, y]) => samePair(a, b, x, y));
  }

  private pan(pair: number): number {
    const cols = this.night?.level.columns.length ?? 0;
    return columnPan(pair + 0.5, cols);
  }

  private onCross(hour: Hour, pair: number, side: Side, over: ThreadId, under: ThreadId): void {
    if (this.draftHour !== hour) {
      this.draft.clear();
      this.stack.length = 0;
      this.draftHour = hour;
    }
    const prev = this.draft.get(pair);
    const flip = prev !== undefined && prev !== side;
    this.draft.set(pair, side);
    if (prev === undefined) this.stack.push(pair);
    const lvl = this.night?.level ?? null;
    this.deps.engine.crossing(threadWho(over, lvl), threadWho(under, lvl), {
      rancor: this.isRancor(over, under),
      pan: this.pan(pair),
      flip,
    });
  }

  private onUndo(hour: Hour): void {
    this.deps.engine.sfx('disfa');
    if (this.draftHour === hour && this.stack.length > 0) {
      const pair = this.stack.pop()!;
      this.draft.delete(pair);
    } else {
      // Si è riaperta la riga precedente: la sua bozza non è nota, si riparte da zero.
      this.draft.clear();
      this.stack.length = 0;
      this.draftHour = hour;
    }
  }

  private onViolation(v: Violation): void {
    if (v.code === 'rifiuto' && (!v.quirk || v.quirk === 'martaNoSotto')) {
      this.deps.engine.sfx('rifiuto');
      return;
    }
    this.deps.engine.play('tonfo', { gain: 0.9 }, { key: CAPTIONS.tonfo }, 'rifiuto');
  }

  private animStep(): number {
    const speed = this.deps.settings()?.animSpeed ?? 1;
    return speed > 0 ? ROW_SOUND_STEP / speed : 0.04;
  }

  /** Spartito che si ritesse: ogni riga è un battito del carillon (bicordi degli incroci). */
  private onReplayRow(events: readonly LaceEvent[]): void {
    const e = this.deps.engine;
    const lvl = this.night?.level ?? null;
    if (this.replayRows++ === 0) e.caption(CAPTIONS.carillon);
    const meets = (events ?? []).filter((x): x is Extract<LaceEvent, { k: 'incontro' }> => x.k === 'incontro');
    if (meets.length === 0) {
      e.dyad(null, null);
      return;
    }
    const cols = lvl?.columns.length ?? 0;
    meets.forEach((m, i) => {
      const under = m.over === m.a ? m.b : m.a;
      e.dyad(threadWho(m.over, lvl), threadWho(under, lvl), { delay: i * 0.012, pan: columnPan(m.pair + 0.5, cols) });
    });
  }

  private onRow(hour: Hour, ok: boolean, events: readonly LaceEvent[], pos: readonly ThreadId[]): void {
    if (!ok) return;
    if (this.night?.replay) {
      this.onReplayRow(events);
      return;
    }
    const e = this.deps.engine;
    e.sfx('ora_fissata');
    e.bell({ hour, stonatura: this.stonatura() });
    const lvl = this.night?.level ?? null;
    const sounds = eventSounds(events ?? [], { level: lvl, pos: pos ?? [], nameOf: this.deps.nameOf });
    if (tideRises(lvl, hour)) sounds.push({ k: 'sfx', id: 'marea', caption: { key: SFX_CAPTIONS.marea ?? '' } });
    sounds.splice(MAX_ROW_SOUNDS);
    const step = this.animStep();
    sounds.forEach((s, i) => {
      const delay = ROW_SOUND_START + i * step;
      if (s.k === 'sfx') {
        const o: { pan?: number; delay: number } = { delay };
        if (s.pan !== undefined) o.pan = s.pan;
        e.play(s.id, o, s.caption, s.id);
      } else {
        const o: { pan?: number; delay: number; gain: number; rancor: boolean } = { delay, gain: 0.8, rancor: false };
        if (s.pan !== undefined) o.pan = s.pan;
        e.crossing(s.over, s.under, o);
      }
    });
    this.draft.clear();
    this.stack.length = 0;
    this.draftHour = null;
  }

  private page(): void {
    const t = this.now();
    if (t - this.lastPage < 800) return;
    this.lastPage = t;
    this.deps.engine.sfx('pagina');
  }

  private onSettings(s: Settings): void {
    const prev = this.lastVolumes;
    this.lastVolumes = { ...s.volume };
    if (!prev) return;
    // Anteprima del volume degli effetti mentre si muove il cursore.
    if (prev.sfx !== s.volume.sfx || prev.master !== s.volume.master) {
      const t = this.now();
      if (t - this.lastPreview >= 120) {
        this.lastPreview = t;
        this.deps.engine.sfx('ui_tap');
      }
    }
  }

  private onClick(target: EventTarget | null): void {
    const t = target as Element | null;
    if (!t || typeof t.closest !== 'function') return;
    const el = t.closest('button, [role="button"], [role="tab"], [role="switch"], [role="menuitem"], [role="option"], a[href]');
    if (!el || el.closest('[data-audio-silent]')) return;
    if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return;
    const test = el.getAttribute('data-test') ?? '';
    const back = el.classList.contains('core-overlay-close') || /(^|-)(chiudi|indietro|annulla|back)($|-)/.test(test);
    this.deps.engine.sfx(back ? 'ui_indietro' : 'ui_tap');
  }

  /** Il livello della notte in corso (debug). */
  nightLevelId(): string | null {
    return this.night?.level.id ?? null;
  }

  /** Inizializza i volumi noti (per l'anteprima del cursore). */
  primeVolumes(v: Settings['volume']): void {
    this.lastVolumes = { ...v };
  }
}
