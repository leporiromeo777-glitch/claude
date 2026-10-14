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
 * |                               | suoni del merletto: gli incroci non ancora sentiti (fili    |
 * |                               | che si muovono da soli, filo nero; l'annuncio del filo nero |
 * |                               | della riga dopo è muto), lettera, voce, segreto,            |
 * |                               | febbre, cura, nodo, trabocco, vaporetto/barca/secca, filo   |
 * |                               | nero; marea se nella riga dopo c'è l'acqua alta             |
 * | night:row in modo 'replay'    | il carillon: un bicordo per incrocio (o un tic), niente     |
 * |                               | campana né incroci da night:cross (spartito, Ripassa)       |
 * | night:undo                    | disfa                                                       |
 * | night:complete                | successo (tutto soddisfatto, Archivio rammendato) o         |
 * |                               | fallimento; niente con la chiusura 'nodo' (finale C, C11)   |
 * | tombolo:nodo                  | nodo e la campana dell'ora 3 con stonatura 1 (C11)          |
 * | tombolo:apparizione           | nero: il filo nero che appare a merletto chiuso (C12)       |
 * | scene:enter tombolo, notti    | musica 'notte' con il seme del livello e i personaggi       |
 * | giornaliero/libero/spartito   | presenti (SCH-06; la campagna la chiede da sé)              |
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
  MusicState,
  NightOrigin,
  NightOutcome,
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
import { createContext } from '../engine/context';
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
  /**
   * Il contesto del gioco è cambiato (scena nuova): la musica chiesta senza seme o
   * note riprende quelli della giornata giusta. Facoltativo.
   */
  refreshContext?(): void;
  /** Musica (facoltativo: la usano le notti delle modalità extra, SCH-06). */
  setMusic?(s: MusicState, o?: { seed?: string; notes?: (CharacterId | 'lino')[]; stonatura?: number }): void;
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
/** Violazioni ravvicinate (la stessa riga rifiutata): un solo tonfo. */
export const VIOLATION_GAP_MS = 150;

const CHAR_SET: ReadonlySet<string> = new Set<string>(CHARACTER_IDS);

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

/**
 * Coppie in rancore attive, come le calcola il motore (createContext): quelle del
 * livello, meno Teresa-Marta dopo la riconciliazione.
 */
export function activeRancor(level: LevelDef | null, flags: Readonly<Record<string, FlagValue>> | null): [ThreadId, ThreadId][] {
  if (!level?.rancor?.length) return [];
  try {
    return createContext(level, { ...(flags ?? {}) }).rancor;
  } catch {
    return level.rancor.map(([a, b]) => [a, b] as [ThreadId, ThreadId]);
  }
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
  // Il finale C stona sempre, anche dopo il finale vero (C11).
  if (levelId && content?.campaign && levelId === content.campaign.finals.chiuso) return 1;
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
  | { k: 'crossing'; over: CharacterId | 'lino'; under: CharacterId | 'lino'; pan?: number; pair?: number; rancor?: boolean };

/** Il filo nero della giornata (ThreadDef di tipo 'nero', o quello indicato in level.nero). */
export function isNeroThread(thread: ThreadId, level: LevelDef | null): boolean {
  if (!level) return false;
  if (level.nero?.thread === thread) return true;
  return level.threads?.some((t) => t.id === thread && t.kind === 'nero') ?? false;
}

export interface EventSoundOpts {
  level: LevelDef | null;
  /** Ordine dei fili dopo la riga (per la panoramica). */
  pos: readonly ThreadId[];
  nameOf: (who: CharacterId | 'lino') => string;
  /**
   * Coppie (indice della colonna di sinistra) il cui incrocio non si è ancora sentito
   * con night:cross: fili che si muovono da soli (autotessitura, filo nero). Senza
   * questa funzione gli incontri non suonano (li ha già suonati la bozza).
   */
  unannounced?: (pair: number) => boolean;
  /** La coppia è in rancore (la nota sotto stona). */
  rancor?: (a: ThreadId, b: ThreadId) => boolean;
}

/**
 * Suoni degli eventi di una riga fissata, in ordine, senza doppioni (funzione pura).
 */
export function eventSounds(events: readonly LaceEvent[], o: EventSoundOpts): EventSound[] {
  const { level, pos } = o;
  const cols = level?.columns?.length ?? pos.length;
  const panOf = (t: ThreadId): number => {
    const i = pos.indexOf(t);
    return i >= 0 ? columnPan(i, cols) : 0;
  };
  const name = (t: ThreadId): string => o.nameOf(threadWho(t, level));
  const delivered = new Set(events.filter((e) => e.k === 'consegna').map((e) => (e as { bead: string }).bead));
  // Il filo nero che entra da un bordo ha il suo suono: chi esce da quel lato non suona.
  const neroSides = new Set(
    events.filter((e): e is Extract<LaceEvent, { k: 'entra' }> => e.k === 'entra' && isNeroThread(e.thread, level)).map((e) => e.side),
  );
  const out: EventSound[] = [];
  const seen = new Set<string>();
  const push = (s: EventSound): void => {
    const key =
      s.k === 'sfx'
        ? `${s.id}|${s.caption?.key ?? ''}|${JSON.stringify(s.caption?.params ?? {})}`
        : s.pair !== undefined
          ? `x|${s.pair}`
          : `x|${s.over}|${s.under}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };
  const sfx = (id: RecipeId, caption: CaptionRef | null, pan?: number): void => {
    push(pan === undefined ? { k: 'sfx', id, caption } : { k: 'sfx', id, caption, pan });
  };
  const crossing = (over: ThreadId, under: ThreadId, pair: number): void => {
    const s: EventSound = { k: 'crossing', over: threadWho(over, level), under: threadWho(under, level), pan: columnPan(pair + 0.5, cols), pair };
    if (o.rancor?.(over, under)) s.rancor = true;
    push(s);
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
        if (e.k === 'entra' && isNeroThread(e.thread, level)) {
          sfx('nero', { key: SFX_CAPTIONS.nero ?? '' }, pan);
          break;
        }
        if (neroSides.has(e.side)) break;
        // La secca (Atto III, lato del Faro) è l'acqua che si ritira, non la marea che sale.
        const id: RecipeId = e.kind === 'vaporetto' ? 'vaporetto' : e.kind === 'barca' ? 'barca' : 'secca';
        if (edgeDone.has(id)) break;
        edgeDone.add(id);
        sfx(id, { key: id === 'secca' ? CAPTIONS.secca : (SFX_CAPTIONS[id] ?? '') }, pan);
        break;
      }
      case 'incontro':
        // Gli incroci forzati (filo nero, autotessitura) arrivano qui, nella riga in cui
        // avvengono.
        if (o.unannounced?.(e.pair)) crossing(e.over, e.over === e.a ? e.b : e.a, e.pair);
        break;
      case 'nero':
        // Solo l'annuncio dell'incrocio della riga dopo (anteprima tratteggiata): l'incrocio
        // vero suona con la sua riga, come 'incontro'.
        break;
      case 'stranezza':
        break;
    }
  }
  return out;
}

/** Le notti delle modalità extra: la musica della notte la chiede l'automazione (SCH-06). */
export const MODE_NIGHT_ORIGINS: readonly NightOrigin[] = ['giornaliero', 'libero', 'spartito'];

/** Ora della campana del nodo del finale C (C11). */
export const NODO_BELL_HOUR = 3;

/**
 * Esito della notte per il suono finale: richieste e obiettivi soddisfatti e, in un
 * merletto d'Archivio, il rammendo riuscito.
 */
export function outcomeOk(o: NightOutcome): boolean {
  const requests = (o.requests ?? []).every((r) => r.status === 'soddisfatta');
  const goals = (o.goals ?? []).every((g) => g.status === 'soddisfatta');
  const mended = !o.archive || o.archive.mended !== false;
  return requests && goals && mended;
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
  /** Disfa ha riaperto la riga precedente: la sua bozza (già sentita) non è nota. */
  private draftUnknown = false;
  private lastPage = -Infinity;
  private lastViolation = -Infinity;
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
          // La chiusura 'nodo' (finale C) ha già suonato il suo nodo: niente successo (C11).
          const nodo = this.night?.level.chiusura === 'nodo' && this.night.level.id === o.levelId;
          if (!this.night?.replay && !nodo) this.deps.engine.sfx(outcomeOk(o) ? 'successo' : 'fallimento');
          this.resetDraft(null);
        }),
      ),
      bus.on('tombolo:nodo', () =>
        this.guard(() => {
          this.deps.engine.sfx('nodo');
          this.deps.engine.bell({ hour: NODO_BELL_HOUR, stonatura: 1 });
        }),
      ),
      bus.on('tombolo:apparizione', () => this.guard(() => this.deps.engine.sfx('nero'))),
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
    if (id === 'tombolo') {
      const p = params as { level?: unknown; flags?: Record<string, FlagValue>; mode?: unknown; origin?: unknown } | undefined;
      if (p && isLevel(p.level)) this.night = { level: p.level, flags: p.flags ?? {}, replay: p.mode === 'replay' };
      this.replayRows = 0;
      this.resetDraft(null);
      // SCH-06: le notti del giorno, del libero e degli spartiti hanno la musica della notte.
      if (p && isLevel(p.level) && (MODE_NIGHT_ORIGINS as readonly unknown[]).includes(p.origin)) {
        const lvl = p.level;
        const notes: (CharacterId | 'lino')[] = [];
        for (const t of lvl.threads) {
          const w = threadWho(t.id, lvl);
          if (!notes.includes(w)) notes.push(w);
        }
        this.deps.engine.setMusic?.('notte', { seed: lvl.musicSeed ?? lvl.id, notes });
      }
    }
    // 'scene:enter' arriva dopo enter() della scena: se la scena ha chiesto la musica senza
    // seme o note, adesso il contesto (giornata, personaggi) è quello giusto.
    this.deps.engine.refreshContext?.();
  }

  private resetDraft(hour: Hour | null): void {
    this.draft.clear();
    this.stack.length = 0;
    this.draftHour = hour;
    this.draftUnknown = false;
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
    // Uno spartito che si ritesse suona le sue righe come un carillon (onReplayRow).
    if (this.night?.replay) return;
    if (this.draftHour !== hour) this.resetDraft(hour);
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
      // Si è riaperta la riga precedente: la sua bozza non è nota (i suoi incroci si sono
      // già sentiti), si riparte da zero.
      this.resetDraft(hour);
      this.draftUnknown = true;
    }
  }

  private onViolation(v: Violation): void {
    const marta = v.code === 'rifiuto' && (!v.quirk || v.quirk === 'martaNoSotto');
    // Una riga rifiutata può portare più violazioni insieme: un solo tonfo (il «No.» di
    // Marta passa sempre).
    const t = this.now();
    if (!marta && t - this.lastViolation < VIOLATION_GAP_MS) return;
    this.lastViolation = t;
    if (marta) {
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
    // Gli incroci della bozza si sono già sentiti (night:cross); quelli dei fili che si
    // muovono da soli (autotessitura, filo nero) suonano adesso.
    const announced = new Set(this.draft.keys());
    const unknown = this.draftUnknown;
    const sounds = eventSounds(events ?? [], {
      level: lvl,
      pos: pos ?? [],
      nameOf: this.deps.nameOf,
      unannounced: (pair) => !unknown && !announced.has(pair),
      rancor: (a, b) => this.isRancor(a, b),
    });
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
        const o: { pan?: number; delay: number; gain: number; rancor: boolean } = { delay, gain: 0.8, rancor: !!s.rancor };
        if (s.pan !== undefined) o.pan = s.pan;
        e.crossing(s.over, s.under, o);
      }
    });
    this.resetDraft(null);
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
