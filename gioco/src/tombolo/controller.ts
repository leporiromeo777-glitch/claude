/**
 * Regia della notte: tiene insieme la sessione (session.ts, solo motore), il
 * disegno (render/), l'interfaccia DOM (ui/), il tutorial, il ritorno tattile e
 * l'autosalvataggio. La scena (TomboloScene.ts) le passa il ciclo di vita, il
 * debug (`__GAME__.night`) chiama gli stessi metodi dei gesti e dei tasti.
 */
import type {
  ActionId,
  CanvasHost,
  CharacterId,
  CondReport,
  CondStatus,
  Crossing,
  Hint,
  HintTier,
  LaceEvent,
  LevelComputed,
  NightOutcome,
  NightParams,
  NoteId,
  OccasionDef,
  QuirkId,
  RowMoves,
  Services,
  Side,
  ThreadId,
  Unsub,
  Viewport,
  Violation,
} from '../core/types';
import { el } from '../core/ui/dom';
import { button } from '../core/ui/components';
import { solveAsync } from '../engine/index';
import { Session } from './session';
import { type TomboloLayout, autoScroll, computeTomboloLayout, rowBottom, rowTop, scrollLimits } from './layout';
import { buildVisuals, type ThreadVisual, visualOf } from './visuals';
import { type TextDeps, describeCondition, nameParams, reportText, threadName, violationParams } from './text';
import { LaceRenderer, emptyOverlay, type Overlay, type Palette } from './render/lace';
import { type LaceModel, buildLaceModel, stacksOf } from './render/model';
import { Tutorial } from './tutorial';
import { Interaction } from './interact';
import { ActionBar } from './ui/actionbar';
import { ColumnHeader, Hud } from './ui/hud';
import { RequestStrip, goalCard, noteCard, type RequestToken } from './ui/requests';
import { HintLamp, TIERS, hintCard } from './ui/hintlamp';
import { charCard, namePicker } from './ui/charcard';
import { ExplainLine, MarginNote, Popup, StatusLine, fitText, place, type Params } from './ui/popup';
import { AutoRunner, allowedAt, occasionSlots, toggleOccasion } from './modes/autoweave';
import { replayStepMs } from './modes/replay';
import { saveNight, clearNight } from './resume';

const BEAD_EVENTS: ReadonlySet<LaceEvent['k']> = new Set(['passa', 'copia', 'consegna', 'contagio', 'cura']);

export interface ControllerOptions {
  computed: LevelComputed | null;
}

type UiLayerExtra = Services['ui'] & { sceneRoot?: HTMLElement; hasPanel?: (id: string) => boolean };

export class NightController {
  readonly s: Services;
  readonly params: NightParams;
  readonly session: Session;
  readonly renderer: LaceRenderer;
  layout!: TomboloLayout;
  model!: LaceModel;
  scroll = 0;
  private scrollTarget = 0;
  private manualScroll = false;
  private modelVersion = -1;
  private extraVersion = 0;
  private builtExtra = -1;
  visuals: Map<ThreadId, ThreadVisual>;
  private visualsVersion = 0;
  readonly overlay: Overlay = emptyOverlay();
  readonly interact: Interaction;
  private readonly tutorial: Tutorial;
  completed: NightOutcome | null = null;
  private runner: AutoRunner | null = null;
  private runFailed = false;
  private placing = false;
  private time = 0;
  private idle = 0;
  private hintRowHour = -1;
  private hintStep = 0;
  lastHint: Hint | null = null;
  lastViolation: Violation | null = null;
  previewRow = -1;
  private keyboard = false;
  private popup: Popup | null = null;
  private readonly known: Set<QuirkId>;
  private readonly unsubs: Unsub[] = [];
  private destroyed = false;
  private lastStatus: Record<NoteId, string> = {};
  private vp: Viewport;
  private readonly textDeps: TextDeps;
  private lastRowHour = -1;
  private panelLeft: { destroy(): void } | null = null;
  private panelRight: { destroy(): void } | null = null;
  private panelMode = '';
  /** I pannelli del layout largo si montano solo a notte attiva (`activeNight()`), vedi `startPanels`. */
  private panelsLive = false;
  private lastSaveVersion = -1;

  // DOM
  readonly root: HTMLElement;
  private readonly hud = new Hud();
  private readonly header = new ColumnHeader();
  private readonly requests: RequestStrip;
  private readonly actions: ActionBar;
  private readonly lamp: HintLamp;
  readonly explain = new ExplainLine();
  readonly margin = new MarginNote();
  readonly status = new StatusLine();
  private readonly prompt: HTMLElement;
  private readonly rewindBar: HTMLElement;
  private readonly leftBox: HTMLElement;
  private readonly rightBox: HTMLElement;

  constructor(s: Services, params: NightParams, o: ControllerOptions) {
    this.s = s;
    this.params = params;
    const save = s.save.data();
    this.known = new Set(save.knowledge.quirks);
    this.session = new Session(params, {
      emit: (k, p) => s.bus.emit(k, p),
      balance: s.content.balance ?? null,
      computed: o.computed,
      solveAsync: (req, signal) => solveAsync(req, signal),
      knownQuirks: save.knowledge.quirks,
    });
    this.textDeps = { i18n: s.i18n, content: s.content, level: params.level, override: (id) => this.fadedName(id) };
    this.visuals = this.makeVisuals();
    this.renderer = new LaceRenderer();
    this.tutorial = new Tutorial(params.level.tutorial ?? [], { margin: (k) => this.showMargin(k) });
    this.overlay.quirk = this.quirkOf;
    this.overlay.label = this.labelOf;
    this.interact = new Interaction(this);
    this.vp = s.viewport.get();

    // ───────── DOM ─────────
    this.requests = new RequestStrip((id) => this.openRequest(id));
    this.actions = new ActionBar({ menu: () => this.openMenu(), undo: () => this.undo(), main: () => this.mainAction(), notebook: () => this.openNotebook() });
    this.lamp = new HintLamp(() => void this.nextHint());
    this.prompt = el('div', { class: 'tb-prompt', role: 'status', test: 'tb-nome-prompt', hidden: true });
    this.rewindBar = el('div', { class: 'tb-rewind core-solid', test: 'tb-riavvolgi', hidden: true });
    this.leftBox = el('div', { class: 'tb-panel tb-panel-left', test: 'tb-pannello-sinistro', hidden: true });
    this.rightBox = el('div', { class: 'tb-panel tb-panel-right', test: 'tb-pannello-destro', hidden: true });
    this.root = el(
      'div',
      { class: 'tb-root', test: 'tombolo', data: { modo: params.mode } },
      this.leftBox,
      this.rightBox,
      this.hud.el,
      this.header.el,
      this.requests.el,
      this.actions.el,
      this.lamp.el,
      this.explain.el,
      this.margin.el,
      this.prompt,
      this.rewindBar,
      this.status.el,
    );
    this.header.build(
      params.level.columns.map((p) => {
        const pl = s.content.places.get(p);
        return { place: p, icon: pl?.icon ?? 'info', shortKey: pl?.shortKey ?? `tombolo.luogo.${p}`, nameKey: pl?.nameKey ?? `tombolo.luogo.${p}` };
      }),
    );
    const host = (s.ui as UiLayerExtra).sceneRoot ?? s.ui.root;
    host.appendChild(this.root);

    // ───────── Eventi ─────────
    const bus = s.bus;
    this.unsubs.push(
      bus.on('night:cross', () => s.haptics.play('leggero')),
      bus.on('night:violation', () => s.haptics.play('rifiuto')),
      bus.on('night:row', (p) => {
        if (p.result.ok && params.mode !== 'replay') s.haptics.play('medio');
      }),
      bus.on('quirk:discovered', (p) => this.known.add(p.quirk)),
      bus.on('app:pause', () => this.saveNow(true)),
      bus.on('settings:change', () => this.onSettings()),
    );

    if (params.mode === 'occasioni') this.placing = !params.resume || this.session.rows.length === 0;
    if (params.mode === 'replay' || params.mode === 'occasioni') {
      this.runner = new AutoRunner({
        step: () => this.autoStep(),
        stepMs: () => this.autoStepMs(),
        onDone: (ok) => this.autoDone(ok),
      });
      if (params.mode === 'replay') this.runner.start();
    }
    this.onSettings();
    this.resize(this.vp);
    this.tutorial.onRowStart(this.session.hour, this.session.rows.length === 0);
    this.updateStatusLine();
    this.lastRowHour = this.session.hour;
    this.rememberStatuses();
    this.saveNow(false);
    // Ultima cosa: se la notte non parte (costruttore interrotto) la classe non resta appesa.
    nightOpened(s.ui.root);
  }

  // ───────── Aspetto ─────────

  private fadedName(id: ThreadId): string | null {
    const a = this.session?.archive;
    if (!a || !a.isFaded(id)) return null;
    const i = this.params.level.archive?.faded.indexOf(id) ?? -1;
    return this.s.i18n.t('tombolo.filo.sbiaditoN', { n: i + 1 });
  }

  private makeVisuals(): Map<ThreadId, ThreadVisual> {
    const a = this.session.archive;
    const settings = this.s.settings.get();
    const save = this.s.save.data();
    const opts: Parameters<typeof buildVisuals>[2] = { highContrast: settings.highContrast, cosmetic: save.unlocks.selectedCosmetic ?? null };
    if (a) {
      opts.faded = (id) => a.isFaded(id);
      opts.confirmedAs = (id) => a.confirmedAs(id);
    }
    return buildVisuals(this.params.level, this.s.content.characters, opts);
  }

  private onSettings(): void {
    const st = this.s.settings.get();
    const css = getComputedStyle(document.documentElement);
    const v = (n: string, d: string): string => css.getPropertyValue(n).trim() || d;
    const pal: Palette = {
      velluto: v('--velluto', '#1C2233'),
      vellutoLuce: v('--velluto-luce', '#2A3247'),
      vellutoOmbra: v('--velluto-ombra', '#121622'),
      ottone: v('--ottone', '#C9A24A'),
      testo: v('--testo-chiaro', '#F3EEE4'),
      testoTenue: v('--testo-tenue', '#B9B3A6'),
      errore: v('--errore', '#E0604F'),
      laguna: v('--laguna', '#7F918C'),
    };
    this.renderer.setPalette(pal);
    this.renderer.rig.reduced = st.reducedMotion;
    this.visuals = this.makeVisuals();
    this.visualsVersion++;
    this.extraVersion++;
    this.refresh();
    if (this.layout) this.layoutDom();
  }

  /** Velocità delle animazioni (0 = istantanea). */
  animSpeed(): number {
    const st = this.s.settings.get();
    return st.animSpeed;
  }

  private animS(ms: number): number {
    const sp = this.animSpeed();
    return sp <= 0 ? 0 : ms / 1000 / sp;
  }

  // ───────── Disposizione ─────────

  resize(vp: Viewport): void {
    this.vp = vp;
    const lv = this.params.level;
    this.layout = computeTomboloLayout(vp, lv.columns.length, lv.endHour - lv.startHour);
    this.renderer.configure(this.layout, vp.dpr);
    this.extraVersion++;
    this.refresh(true);
    this.layoutDom();
    this.scroll = this.scrollTarget;
  }

  private layoutDom(): void {
    const l = this.layout;
    this.hud.layout(l);
    this.header.layout(l);
    this.requests.layout(l);
    this.actions.layout(l);
    this.lamp.layout(l);
    const laceTop = l.lace.y + 6;
    const w = Math.min(l.center.w - 24, 460);
    for (const node of [this.explain.el, this.prompt]) {
      node.style.left = `${l.center.x + (l.center.w - w) / 2}px`;
      node.style.top = `${laceTop}px`;
      node.style.width = `${w}px`;
    }
    this.margin.el.style.right = `${l.cssW - (l.center.x + l.center.w) + 8}px`;
    this.margin.el.style.top = `${laceTop + 52}px`;
    this.margin.el.style.maxWidth = `${Math.min(260, l.center.w * 0.62)}px`;
    place(this.rewindBar, l.actions);
    this.popup?.position(this.popupAnchor());
    // Gli avvisi brevi del core (una voce del Taccuino, una stranezza) salgono sopra
    // la striscia delle richieste: in basso coprirebbero i fusi (vedi tombolo.css).
    this.s.ui.root?.style?.setProperty(TOAST_BOTTOM_VAR, `${Math.max(0, Math.round(l.cssH - l.requests.y + 8))}px`);
    this.mountPanels();
  }

  private popupAnchor(): { x: number; y: number; w: number; h: number } {
    const l = this.layout;
    return { x: l.center.x, y: l.cssH - l.actions.y + 8, w: l.center.w, h: l.actions.y - l.lace.y - 16 };
  }

  /**
   * Largo: Bigliettini a sinistra e Taccuino a destra come pannelli fissi; stretto: niente.
   * Si montano solo dopo `startPanels()`, cioè con la notte già attiva: i pannelli leggono
   * `activeNight()` (stato dal vivo delle richieste, schede da mostrare).
   */
  private mountPanels(): void {
    const l = this.layout;
    const mode = l.kind === 'largo' ? `largo${l.rightCollapsed ? '-' : '+'}` : 'stretto';
    if (l.left) place(this.leftBox, l.left);
    if (l.right) place(this.rightBox, l.right);
    if (!this.panelsLive || this.destroyed) return;
    if (mode === this.panelMode) return;
    this.panelMode = mode;
    this.panelLeft?.destroy();
    this.panelRight?.destroy();
    this.panelLeft = this.panelRight = null;
    this.leftBox.hidden = !l.left;
    this.rightBox.hidden = !l.right;
    const opts = { from: 'tombolo', levelId: this.params.level.id, origin: this.params.origin, accepted: this.params.accepted.map((a) => a.noteId) };
    if (l.left) this.panelLeft = this.s.ui.mountPanel('bigliettini', this.leftBox, opts);
    // Il Taccuino a destra è fisso: non apre la scheda dei Bigliettini (sono già a sinistra).
    if (l.right) this.panelRight = this.s.ui.mountPanel('taccuino', this.rightBox, { ...opts, fixed: true });
  }

  /** La notte è attiva (`setActiveNight`): si montano i pannelli del layout largo. */
  startPanels(): void {
    if (this.panelsLive) return;
    this.panelsLive = true;
    this.mountPanels();
  }

  // ───────── Modello e interfaccia ─────────

  /** Ricalcola modello, fusi e interfaccia se la notte è cambiata. */
  refresh(force = false): void {
    if (!this.layout) return;
    const s = this.session;
    const changed = force || s.version !== this.modelVersion || this.extraVersion !== this.builtExtra;
    if (changed) {
      this.model = buildLaceModel(
        { session: s, visuals: this.visuals, visualsVersion: this.visualsVersion, gradi: this.params.gradi ?? [], placingOccasions: this.placing, echoesOpen: this.echoesOpen() },
        this.model ?? null,
      );
      this.modelVersion = s.version;
      this.builtExtra = this.extraVersion;
      this.renderer.rig.assign(this.model.hangPos, this.layout.colCx, this.animS(this.s.content.balance?.anim.swapMs ?? 250), this.s.assets, this.visuals);
      const lim = scrollLimits(this.layout, this.model.current);
      this.scrollTarget = Math.max(lim.min, Math.min(lim.max, autoScroll(this.layout, this.model.current)));
      if (!this.manualScroll || force) this.manualScroll = false;
      if (s.hour !== this.lastRowHour) {
        this.lastRowHour = s.hour;
        this.manualScroll = false;
      }
      if (s.version !== this.lastSaveVersion && this.lastSaveVersion >= 0) this.saveNow(false);
    }
    this.updateUi();
  }

  private echoesOpen(): boolean {
    const a = this.session.archive;
    if (!a) return false;
    return a.allNamed() && (this.params.mode === 'occasioni' ? this.session.succeeded() : a.allMended() && this.session.done);
  }

  private titleParams(): Params {
    const id = this.params.level.id;
    const day = /^day-(\d{4})-(\d{2})-(\d{2})$/.exec(id);
    const lib = /^lib-([0-9a-z]+)/.exec(id);
    const out: Params = {};
    if (day) {
      try {
        const d = new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
        out.data = new Intl.DateTimeFormat(this.s.i18n.locale(), { day: 'numeric', month: 'long' }).format(d);
      } catch {
        out.data = `${day[3]}/${day[2]}`;
      }
    }
    if (lib && lib[1]) out.seme = lib[1];
    return out;
  }

  /**
   * Giornata nella barra alta (GDD 10.3 "Giornata e titolo"): «Prologo»,
   * «Giornata 6», «Finale», «Archivio · 1936». I merletti generati hanno già la
   * data o il seme nel titolo: niente riga.
   */
  private dayLabel(): { key: string; params: Params } {
    const lv = this.params.level;
    if (lv.archive) {
      const year = (lv.archive.year ?? '').trim();
      // Alcuni titoli hanno già l'anno («1958. La febbre»): non si ripete.
      const inTitle = year !== '' && this.s.i18n.t(lv.titleKey).includes(year);
      return year && !inTitle ? { key: 'tombolo.hud.archivioAnno', params: { anno: year } } : { key: 'tombolo.hud.archivio', params: {} };
    }
    if (lv.kind === 'finale') return { key: 'tombolo.hud.finale', params: {} };
    const days = this.s.content.campaign?.days ?? [];
    const i = days.findIndex((d) => d.id === lv.id);
    if (i === 0) return { key: 'tombolo.hud.prologo', params: {} };
    if (i > 0) return { key: 'tombolo.hud.giornata', params: { n: i } };
    return { key: '', params: {} };
  }

  private showMatassa(): boolean {
    const lv = this.params.level;
    const m = this.params.mode;
    // Occasioni e spartiti non hanno incroci del giocatore: niente gomitolo.
    if (m === 'occasioni' || m === 'replay') return false;
    return lv.rules.includes('matassa') || lv.kind !== 'storia' || m === 'archivio';
  }

  private mainKey(): { key: string; enabled: boolean } {
    const s = this.session;
    const m = this.params.mode;
    if (this.completed) return { key: 'tombolo.azioni.chiuso', enabled: false };
    if (m === 'replay') return { key: 'tombolo.azioni.salta', enabled: true };
    if (m === 'occasioni') {
      if (this.runner?.running()) return { key: 'tombolo.azioni.accade', enabled: false };
      // Archivio con le occasioni (A6) riuscito: si chiude a mano, dopo gli echi.
      if (s.done && s.archive && s.succeeded()) return { key: 'tombolo.azioni.chiudi', enabled: true };
      if (s.done) return { key: 'tombolo.azioni.riprova', enabled: true };
      return { key: 'tombolo.azioni.lasciaAccadere', enabled: true };
    }
    if (s.archive && m === 'archivio' && s.done) return { key: 'tombolo.azioni.chiudi', enabled: true };
    if (s.needsNome) return { key: 'tombolo.azioni.fissa', enabled: false };
    if (s.done) return { key: 'tombolo.azioni.chiudi', enabled: false };
    if (s.hour === this.params.level.endHour) return { key: 'tombolo.azioni.chiudi', enabled: true };
    return { key: 'tombolo.azioni.fissa', enabled: true };
  }

  private updateUi(): void {
    const s = this.session;
    const lv = this.params.level;
    this.updateOverlayData();
    const day = this.dayLabel();
    this.hud.update({
      dayKey: day.key,
      dayParams: day.params,
      titleKey: lv.titleKey,
      titleParams: this.titleParams(),
      hour: s.done ? lv.endHour : s.hour,
      done: s.done,
      matassa: this.showMatassa() ? s.matassa() : null,
      light: this.windowLight(),
    });
    const main = this.mainKey();
    const pulse = this.completed ? null : this.tutorial.pulse(s.hour, s.draft.length === 0, s.needsNome);
    this.actions.update({
      mainKey: main.key,
      mainEnabled: main.enabled,
      undoEnabled: !this.completed && s.canUndo(),
      undoVisible: this.params.mode !== 'replay' && this.params.mode !== 'occasioni',
      pulse: pulse === 'nome' ? null : pulse,
    });
    // Richieste.
    const tokens: RequestToken[] = s.requestStatusFull().map((st) => {
      const acc = this.params.accepted.find((a) => a.noteId === st.noteId);
      const who = (acc?.authorGuess ?? acc?.author ?? 'teresa') as CharacterId;
      const ch = this.s.content.characters.get(who);
      const name = ch ? this.s.i18n.t(ch.nameKey) : who;
      const statusKey = st.dropped ? 'tombolo.richieste.statoLasciata' : `tombolo.stato.${st.report.status}`;
      return {
        noteId: st.noteId,
        icon: ch?.icon ?? 'busta',
        color: ch?.color ?? '#C8372D',
        status: st.report.status,
        dropped: st.dropped,
        label: this.s.i18n.t('tombolo.richieste.gettone', { nome: name, stato: this.s.i18n.t(statusKey) }),
      };
    });
    // Obiettivi obbligatori del livello: gettoni d'ottone prima delle richieste
    // (con più di due obiettivi, un gettone solo che li elenca tutti).
    const reports = s.goalStatus();
    const goalTokens: RequestToken[] = reports.length > 2 ? [this.goalSummaryToken(reports)] : reports.map((r, i) => {
      const c = this.params.goals[i];
      const text = c ? describeCondition(this.textDeps, c) : '';
      return {
        noteId: `obiettivo:${i}`,
        goal: true,
        icon: 'stella',
        color: '#C9A24A',
        status: r.status,
        dropped: false,
        label: this.s.i18n.t('tombolo.obiettivo.gettone', { testo: text, stato: this.s.i18n.t(`tombolo.stato.${r.status}`) }),
      };
    });
    this.requests.update([...goalTokens, ...tokens]);
    const a = s.archive;
    if (a) {
      const c = a.counter();
      // Archivio con le occasioni (A6): oltre ai nomi, quante occasioni restano da piantare.
      const occ = this.params.mode === 'occasioni' ? { piantate: s.occasions.length, posti: occasionSlots(lv) } : null;
      if (!a.allNamed()) this.requests.setInfo(occ ? 'tombolo.archivio.contatoreOccasioni' : 'tombolo.archivio.contatore', { giusti: c.correct, servono: c.needed, ...(occ ?? {}) });
      else if (!this.echoesOpen()) this.requests.setInfo(occ ? 'tombolo.occasioni.contatore' : 'tombolo.archivio.daRammendare', occ ?? {});
      else this.requests.setInfo('tombolo.archivio.fatto', {});
    } else if (this.params.mode === 'occasioni') {
      this.requests.setInfo('tombolo.occasioni.contatore', { piantate: s.occasions.length, posti: occasionSlots(lv) });
    } else if (this.params.mode === 'replay') {
      this.requests.setInfo('tombolo.replay.righe', { fatte: s.rows.length, totale: lv.endHour - lv.startHour });
    } else this.requests.setInfo('', {});
    // Lampada.
    const playerRow = s.isPlayerRow() && !this.completed;
    const lit = playerRow && this.lampLit();
    this.lamp.setLit(lit, playerRow && (lit || this.hintRowHour === s.hour));
    // Passaggio del nome.
    const needsNome = s.needsNome && !this.completed;
    if (needsNome !== !this.prompt.hidden) {
      this.prompt.hidden = !needsNome;
      if (needsNome) {
        this.prompt.replaceChildren(el('span', { class: 'tb-prompt-text' }));
        const t = this.prompt.firstElementChild as HTMLElement;
        t.dataset.i18n = 'tombolo.nome.appunta';
        t.textContent = this.s.i18n.t('tombolo.nome.appunta');
      }
    }
    this.root.dataset.fatto = this.completed ? '1' : '0';
  }

  /**
   * Finestrella della stanza (GDD 9, 12.4): solo nel prologo e nell'ultima giornata,
   * la luce cresce di un passo a ogni ora fissata.
   */
  private windowLight(): number | null {
    const lv = this.params.level;
    const days = this.s.content.campaign?.days ?? [];
    const first = days[0]?.id ?? 'g00';
    const last = this.s.content.campaign?.choiceDay ?? days[days.length - 1]?.id ?? 'g23';
    if (lv.id !== first && lv.id !== last) return null;
    const rows = Math.max(1, lv.endHour - lv.startHour);
    return Math.min(1, this.session.rows.length / rows);
  }

  private lampLit(): boolean {
    const s = this.session;
    const bal = this.s.content.balance?.hint ?? { lampSeconds: 60, undoRepeat: 3 };
    if (this.idle >= bal.lampSeconds) return true;
    return s.undoStreak.hour === s.hour && s.undoStreak.n >= bal.undoRepeat;
  }

  private updateStatusLine(): void {
    const s = this.session;
    const st = s.state;
    const parts: string[] = [];
    st.pos.forEach((t, col) => {
      const place = this.params.level.columns[col] ?? 'molo';
      parts.push(this.s.i18n.t(`tombolo.sr.luogo.${place}`, { nome: threadName(this.textDeps, t) }));
    });
    this.status.set(s.done ? 'tombolo.sr.fine' : 'tombolo.sr.stato', { ora: st.hour, posizioni: parts.join(this.s.i18n.t('tombolo.sr.separatore')) });
  }

  private rememberStatuses(): void {
    const out: Record<NoteId, string> = {};
    for (const st of this.session.requestStatusFull()) out[st.noteId] = st.report.status;
    this.lastStatus = out;
  }

  // ───────── Ciclo ─────────

  update(dt: number): void {
    if (this.destroyed) return;
    this.time += dt;
    const speed = this.animSpeed();
    this.renderer.rig.update(dt, speed);
    this.renderer.flights.update(speed <= 0 ? 1 : dt * speed);
    this.runner?.update(dt);
    const s = this.session;
    if (s.isPlayerRow() && !this.completed && !this.popup?.isOpen() && !s.needsNome) {
      const before = this.lampLit();
      this.idle += dt;
      if (!before && this.lampLit()) this.updateUi();
    }
    // Scorrimento morbido verso la riga corrente.
    if (!this.manualScroll) {
      const st = this.s.settings.get();
      const k = st.reducedMotion || speed <= 0 ? 1 : Math.min(1, dt * 10);
      this.scroll += (this.scrollTarget - this.scroll) * k;
      if (Math.abs(this.scrollTarget - this.scroll) < 0.3) this.scroll = this.scrollTarget;
    }
    const o = this.overlay;
    o.time = this.time;
    o.pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
  }

  render(host: CanvasHost): void {
    if (this.destroyed || !this.model) return;
    const o = this.overlay;
    const s = this.session;
    const dragging = this.interact.dragging() !== null;
    o.handFrom = dragging ? -1 : this.handFrom;
    o.handTo = dragging ? -1 : this.handTo;
    o.cursorPair = this.keyboard && !this.placing ? this.interact.cursorPair : -1;
    o.nameStep = s.needsNome;
    o.previewRow = this.previewRow;
    o.showEchoes = this.model.echoes.length > 0;
    o.nomeOn = s.nomeOn;
    this.renderer.draw(host.ctx, host.cssW, host.cssH, host.dpr, this.layout, this.model, this.scroll, o, this.s.assets);
  }

  /** Fili con una stranezza nota (icona sul fuso), ricalcolati quando la notte cambia. */
  private readonly quirky = new Set<ThreadId>();
  /** Nomi provvisori dei fili sbiaditi (Archivio), ricalcolati quando cambiano. */
  private readonly labels = new Map<ThreadId, string>();
  private handFrom = -1;
  private handTo = -1;

  private readonly quirkOf = (t: ThreadId): boolean => this.quirky.has(t);
  private readonly labelOf = (t: ThreadId): string | null => this.labels.get(t) ?? null;

  /** Dati delle sovrapposizioni che non cambiano a ogni fotogramma. */
  private updateOverlayData(): void {
    const s = this.session;
    this.quirky.clear();
    for (const t of this.model?.hangPos ?? []) {
      const v = this.visuals.get(t);
      if (!v || !v.character || v.faded) continue;
      const ch = this.s.content.characters.get(v.character);
      if (ch && ch.quirks.some((q) => this.known.has(q) && s.ctx.quirks.includes(q))) this.quirky.add(t);
    }
    this.labels.clear();
    const a = s.archive;
    if (a) {
      for (const t of a.faded()) {
        const g = a.isFaded(t) ? a.tentativeOf(t) : null;
        if (!g) continue;
        const ch = this.s.content.characters.get(g);
        this.labels.set(t, this.s.i18n.t('tombolo.archivio.provvisorio', { nome: ch ? this.s.i18n.t(ch.nameKey) : g }));
      }
    }
    const hand = this.completed ? null : this.tutorial.hand(s.hour, s.draft.length === 0);
    this.handFrom = hand ? hand.from : -1;
    this.handTo = hand ? hand.to : -1;
    const hl = this.overlay.highlight;
    hl.clear();
    if (s.needsNome && !this.completed) for (const t of s.state.pos) hl.add(t);
  }

  // ───────── Scorrimento ─────────

  scrollBy(dy: number): void {
    this.setScroll(this.scroll + dy);
  }

  setScroll(v: number): void {
    const lim = scrollLimits(this.layout, this.model.current);
    this.manualScroll = true;
    this.scroll = Math.max(lim.min, Math.min(lim.max, v));
  }

  beginManualScroll(): void {
    this.manualScroll = true;
  }

  revealRow(i: number): void {
    const l = this.layout;
    const y = rowTop(l, i) - this.scroll;
    if (y < 0) this.setScroll(rowTop(l, i) - 8);
    else if (y + l.rowH > l.lace.h) this.setScroll(rowBottom(l, i) - l.lace.h + 8);
  }

  // ───────── Lettura per l'interazione ─────────

  isBusy(): boolean {
    return !!this.runner?.running();
  }

  threadAtColumn(col: number): ThreadId | null {
    return this.model?.hangPos[col] ?? null;
  }

  placingOccasions(): boolean {
    return this.placing && !this.completed;
  }

  canDragSpindles(): boolean {
    const s = this.session;
    return !this.completed && s.isPlayerRow() && !s.needsNome && this.previewRow < 0;
  }

  /** Colonna del compagno d'incrocio (nella bozza) del filo in colonna `col`, o −1. */
  draftPartner(col: number): number {
    for (const d of this.session.draft) {
      if (d.pair === col) return col + 1;
      if (d.pair + 1 === col) return col - 1;
    }
    return -1;
  }

  keyboardCursor(): void {
    this.keyboard = true;
  }

  // ───────── Azioni ─────────

  private textOfViolation(v: Violation): { key: string; params: Params } {
    return { key: v.messageKey, params: violationParams(this.textDeps, v) };
  }

  private onViolation(v: Violation): void {
    this.lastViolation = v;
    const t = this.textOfViolation(v);
    this.explain.show(t.key, t.params, 'warn', 4500);
    this.tutorial.onViolation(v, this.session.hour);
  }

  cross(pair: number, over: Side, source: 'drag' | 'key' | 'debug'): Violation | null {
    if (this.completed) return null;
    this.cancelPreview();
    const s = this.session;
    const hour = s.hour;
    const v = s.propose({ pair, over });
    if (v) {
      this.onViolation(v);
      if (source !== 'drag') {
        const t = s.state.pos[over === 'L' ? pair : pair + 1];
        if (t) this.renderer.rig.bounce(t, over === 'L' ? 1 : -1, this.layout.colW);
      }
      this.refresh();
      return v;
    }
    if (this.lastHint?.ghost && this.lastHint.ghost.pair === pair) this.clearHintMarks();
    this.launchFlights(pair);
    this.tutorial.onCross(hour, s.wrongSide(pair));
    this.refresh();
    return null;
  }

  private launchFlights(pair: number): void {
    const s = this.session;
    const l = this.layout;
    const speed = this.animSpeed();
    // Il volo si vede solo con le animazioni; la vibrazione del passaggio c'è sempre (GDD 11.1).
    const animate = speed > 0 && !this.s.settings.get().reducedMotion;
    const p = s.preview();
    const L = s.state.pos[pair];
    const R = s.state.pos[pair + 1];
    const cur = s.rows.length + 1;
    const y0 = rowTop(l, cur) + 4;
    const y1 = rowBottom(l, cur) + 14;
    const xL = l.colCx[pair] ?? 0;
    const xR = l.colCx[pair + 1] ?? 0;
    const dur = this.animS(this.s.content.balance?.anim.beadMs ?? 350);
    // Ogni perlina atterra nel suo posto della pila di chi la riceve.
    const stacks = stacksOf(p.state, this.model.beadTypes);
    const slot = (to: ThreadId, bead: string): number => {
      const st = stacks.find((x) => x.thread === to);
      const i = st ? st.beads.findIndex((b) => b.id === bead) : -1;
      return Math.max(0, Math.min(4, i));
    };
    let any = false;
    for (const e of p.events) {
      if (!BEAD_EVENTS.has(e.k)) continue;
      let from: ThreadId | null = null;
      let to: ThreadId | null = null;
      let bead = '';
      if (e.k === 'passa' || e.k === 'copia') {
        from = e.from;
        to = e.to;
        bead = e.bead;
      } else if (e.k === 'consegna') {
        to = e.to;
        from = to === L ? (R ?? null) : (L ?? null);
        bead = e.bead;
      } else if (e.k === 'contagio') {
        from = e.from;
        to = e.to;
        bead = 'febbre';
      } else if (e.k === 'cura') {
        from = e.by;
        to = e.who;
        bead = 'febbre';
      }
      if (!from || !to || !((from === L && to === R) || (from === R && to === L))) continue;
      const type = this.model.beadTypes.get(bead) ?? (bead.startsWith('letta:') ? 'segreto' : bead === 'nome' ? 'nome' : bead === 'febbre' ? 'febbre' : 'voce');
      any = true;
      if (!animate) continue;
      const fromX = from === L ? xL : xR;
      // Chi riceve finisce nella colonna da cui è partito chi dà.
      this.renderer.flights.launch(type, bead, to, e.k === 'consegna', fromX, y0, fromX, y1 + 16 * slot(to, bead), dur, (xL + xR) / 2);
    }
    if (any) this.s.haptics.play('medio');
  }

  flipCrossing(pair: number): Violation | null {
    if (this.completed) return null;
    const v = this.session.flip(pair);
    if (v) this.onViolation(v);
    else {
      this.launchFlights(pair);
      this.tutorial.onCross(this.session.hour, this.session.wrongSide(pair));
    }
    this.refresh();
    return v;
  }

  removeCrossing(pair: number): void {
    if (this.completed) return;
    this.session.remove(pair);
    this.refresh();
  }

  tapCurrentPair(p: number): void {
    const s = this.session;
    if (s.draft.some((d) => d.pair === p)) {
      this.flipCrossing(p);
      return;
    }
    if (s.forced().some((f) => f.pair === p)) this.explain.show('tombolo.violazione.forzato', nameParams(this.textDeps, { a: s.state.pos[p] ?? '', b: s.state.pos[p + 1] ?? '' }), 'info', 3500);
  }

  tapSpindle(t: ThreadId): void {
    const s = this.session;
    if (s.needsNome) {
      this.setNome(t);
      return;
    }
    if (s.archive && this.params.level.archive?.faded.includes(t)) this.openNamePicker(t);
  }

  /** Tasto N: nome di Ada (da g12) o nome di un filo sbiadito (Archivio). */
  nameKey(t: ThreadId): void {
    if (this.session.needsNome) this.setNome(t);
    else if (this.session.archive && this.params.level.archive?.faded.includes(t)) this.openNamePicker(t);
  }

  fix(): { ok: boolean; violations: Violation[] } {
    if (this.completed) return { ok: false, violations: [] };
    const s = this.session;
    const res = s.fix();
    if (!res.ok) {
      const v = res.violations[0];
      if (v) this.onViolation(v);
      this.actions.shake();
      this.refresh();
      return { ok: false, violations: res.violations };
    }
    this.afterRow();
    return { ok: true, violations: [] };
  }

  /** Dopo una riga fissata: lampada, richieste soddisfatte, tutorial, fine della notte. */
  private afterRow(): void {
    const s = this.session;
    this.idle = 0;
    this.clearHintMarks();
    this.explain.hide();
    this.margin.hide();
    this.cancelPreview();
    this.refresh();
    this.updateStatusLine();
    for (const st of s.requestStatusFull()) {
      if (st.report.status === 'soddisfatta' && this.lastStatus[st.noteId] !== 'soddisfatta') {
        this.s.haptics.play('successo');
        const acc = this.params.accepted.find((a) => a.noteId === st.noteId);
        const ch = acc ? this.s.content.characters.get(acc.authorGuess ?? acc.author) : undefined;
        this.explain.show('tombolo.richieste.soddisfatta', { nome: ch ? this.s.i18n.t(ch.nameKey) : '' }, 'ok', 3000);
      }
    }
    this.rememberStatuses();
    this.tutorial.onRowStart(s.hour, false);
    this.saveNow(true);
    if (s.done && !(s.archive && this.params.mode === 'archivio') && this.params.mode !== 'occasioni') this.finish();
  }

  /** Pulsante grande: Fissa l'ora, Chiudi il merletto, Lascia accadere, Riprova, Salta. */
  mainAction(): void {
    if (this.completed) return;
    if (this.previewRow >= 0) {
      this.confirmRewind();
      return;
    }
    const m = this.params.mode;
    if (m === 'replay') {
      this.skip();
      return;
    }
    if (m === 'occasioni') {
      if (this.session.done && this.session.archive && this.session.succeeded()) this.finish();
      else if (this.session.done) this.retry();
      else this.run();
      return;
    }
    if (this.session.archive && m === 'archivio' && this.session.done) {
      this.finish();
      return;
    }
    this.fix();
  }

  undo(): void {
    if (this.completed) return;
    this.cancelPreview();
    const s = this.session;
    if (!s.canUndo()) {
      if (s.draft.length === 0 && this.params.gradi?.includes('senzaDisfa') && s.rows.length > 0) this.explain.show('tombolo.disfa.vietato', {}, 'info', 3000);
      return;
    }
    const hourBefore = s.hour;
    s.undo();
    if (s.hour !== hourBefore) {
      this.updateStatusLine();
      this.clearHintMarks();
    }
    this.refresh();
  }

  /** Anteprima di una riga passata (stato a quell'ora) con "Riavvolgi fino a qui / Annulla". */
  tapPastRow(index: number, pair: number): void {
    const s = this.session;
    const a = s.archive;
    if (a && this.model.echoes.length > 0 && pair >= 0) {
      const key = a.echoAt(this.params.level.startHour + index, pair);
      if (key) {
        this.showEcho(key);
        return;
      }
    }
    const hour = this.params.level.startHour + index;
    if (!s.canRewindTo(hour) || index >= this.model.current) {
      if (a && this.params.mode === 'archivio') this.explain.show('tombolo.archivio.registrata', {}, 'info', 3000);
      return;
    }
    this.previewRewind(index);
  }

  previewRewind(index: number): void {
    const s = this.session;
    const state = s.timeline[index];
    if (!state) return;
    this.previewRow = index;
    this.overlay.previewStacks = stacksOf(state, this.model.beadTypes);
    this.rewindBar.replaceChildren(
      el('span', { class: 'tb-rewind-text' }),
      button({ labelKey: 'tombolo.riavvolgi.annulla', kind: 'secondario', onClick: () => this.cancelPreview(), test: 'tb-riavvolgi-annulla' }),
      button({ labelKey: 'tombolo.riavvolgi.qui', kind: 'primario', onClick: () => this.confirmRewind(), test: 'tb-riavvolgi-qui' }),
    );
    const txt = this.rewindBar.firstElementChild as HTMLElement;
    txt.dataset.i18n = 'tombolo.riavvolgi.ora';
    txt.textContent = this.s.i18n.t('tombolo.riavvolgi.ora', { ora: state.hour });
    this.rewindBar.hidden = false;
    this.actions.el.hidden = true;
    fitText(txt, 11);
    this.status.set('tombolo.sr.anteprima', { ora: state.hour });
  }

  cancelPreview(): void {
    if (this.previewRow < 0) return;
    this.previewRow = -1;
    this.overlay.previewStacks = null;
    this.rewindBar.hidden = true;
    this.actions.el.hidden = false;
  }

  confirmRewind(): void {
    const i = this.previewRow;
    this.cancelPreview();
    if (i < 0) return;
    this.rewind(this.params.level.startHour + i);
  }

  rewind(hour: number): boolean {
    const s = this.session;
    if (!s.canRewindTo(hour)) return false;
    s.rewindTo(hour);
    this.clearHintMarks();
    this.updateStatusLine();
    this.refresh();
    this.saveNow(true);
    return true;
  }

  setNome(thread: ThreadId): void {
    const s = this.session;
    if (s.rows.length > 0) return;
    s.setNome(thread);
    const name = threadName(this.textDeps, thread);
    this.explain.show('tombolo.nome.appuntato', { nome: name }, 'ok', 3000);
    this.refresh();
    this.updateStatusLine();
    this.saveNow(true);
  }

  drop(noteId: NoteId): void {
    if (this.completed) return;
    this.session.drop(noteId);
    this.explain.show('tombolo.richieste.lasciataMsg', {}, 'info', 3000);
    this.refresh();
    this.saveNow(true);
  }

  // ───────── Suggerimenti ─────────

  private clearHintMarks(): void {
    this.overlay.hintRow = -1;
    this.overlay.hintCol = -1;
    this.overlay.ghostPair = -1;
    if (this.popup?.el.dataset.test === 'tb-popup-hint') this.popup.close();
  }

  async nextHint(): Promise<Hint | null> {
    const s = this.session;
    if (!s.isPlayerRow() || this.completed) return null;
    if (this.hintRowHour !== s.hour) {
      this.hintRowHour = s.hour;
      this.hintStep = 0;
    }
    const tier = TIERS[Math.min(this.hintStep, TIERS.length - 1)] as HintTier;
    return this.hint(tier);
  }

  async hint(tier: HintTier): Promise<Hint> {
    const s = this.session;
    if (this.hintRowHour !== s.hour) {
      this.hintRowHour = s.hour;
      this.hintStep = 0;
    }
    this.hintStep = Math.max(this.hintStep, TIERS.indexOf(tier) + 1);
    const h = await s.hint(tier);
    if (this.destroyed) return h;
    this.lastHint = h;
    const o = this.overlay;
    const start = this.params.level.startHour;
    o.hintRow = h.highlight?.hour !== undefined ? h.highlight.hour - start : -1;
    o.hintCol = h.highlight?.column ?? -1;
    o.ghostPair = h.ghost ? h.ghost.pair : -1;
    o.ghostOver = h.ghost?.over ?? 'L';
    if (o.hintRow >= 1) this.revealRow(o.hintRow);
    const next = this.hintStep < TIERS.length ? (TIERS[this.hintStep] as HintTier) : null;
    this.openPopup(
      'tb-popup-hint',
      (body) => {
        body.appendChild(hintCard({ tier: h.tier, textKey: h.textKey, params: nameParams(this.textDeps, h.params), next }, (t) => void this.hint(t)));
      },
      // H con la scheda aperta: il gradino successivo (come un altro tocco sulla lampada).
      { hint: () => void this.nextHint() },
    );
    this.updateUi();
    this.saveNow(false);
    return h;
  }

  // ───────── Archivio ─────────

  name(thread: ThreadId, character: CharacterId | null): { confirmed: ThreadId[]; correct: number; needed: number } | null {
    const a = this.session.archive;
    if (!a) return null;
    const r = a.name(thread, character);
    if (r.confirmed.length > 0) {
      this.visuals = this.makeVisuals();
      this.visualsVersion++;
      this.s.haptics.play('successo');
      this.explain.show('tombolo.archivio.confermati', { n: r.confirmed.length }, 'ok', 3500);
    }
    this.extraVersion++;
    this.session.version++;
    this.refresh();
    this.saveNow(false);
    return r;
  }

  private openNamePicker(t: ThreadId): void {
    const a = this.session.archive;
    if (!a) return;
    if (a.isConfirmed(t)) {
      this.openCharCard(t);
      return;
    }
    const cands = a.candidates().map((id) => {
      const ch = this.s.content.characters.get(id);
      return { id, name: ch ? this.s.i18n.t(ch.nameKey) : id, icon: ch?.icon ?? 'info', color: ch?.color ?? '#8E8676' };
    });
    const c = a.counter();
    this.openPopup('tb-popup-nomina', (body) => {
      body.appendChild(
        namePicker({ thread: t, threadText: threadName(this.textDeps, t), candidates: cands, current: a.tentativeOf(t), correct: c.correct, needed: c.needed }, (ch) => {
          this.popup?.close();
          this.name(t, ch);
        }),
      );
    });
  }

  private showEcho(key: string): void {
    this.openPopup('tb-popup-eco', (body) => {
      const p = el('p', { class: 'tb-echo', test: 'tb-eco', data: { chiave: key } });
      p.textContent = this.s.i18n.t(key);
      body.appendChild(p);
    });
  }

  /** Eco di un incrocio (debug e test). */
  echo(hour: number, pair: number): string | null {
    if (this.model.echoes.length === 0) return null;
    const key = this.session.archive?.echoAt(hour, pair) ?? null;
    if (key) this.showEcho(key);
    return key;
  }

  // ───────── Occasioni e spartiti ─────────

  toggleOccasionCell(col: number, index: number): void {
    const lv = this.params.level;
    const place = lv.columns[col];
    if (!place || !this.placing) return;
    const hour = lv.startHour + index;
    const allowed = allowedAt(lv, place, hour);
    const cell: OccasionDef = allowed ?? { kind: 'festa', place, hour };
    const r = toggleOccasion(lv, this.session.occasions, cell);
    if (r.problem) {
      this.explain.show(r.problem, { posti: occasionSlots(lv) }, 'warn', 3000);
      this.s.haptics.play('rifiuto');
      return;
    }
    this.setOccasions(r.list);
  }

  setOccasions(list: readonly OccasionDef[]): OccasionDef[] {
    const out = this.session.setOccasions(list);
    this.runFailed = false;
    this.placing = this.params.mode === 'occasioni';
    this.extraVersion++;
    this.refresh();
    this.saveNow(false);
    return out;
  }

  private autoStep(): ReturnType<Session['stepAuto']> {
    const r = this.session.stepAuto();
    this.refresh();
    return r;
  }

  private autoStepMs(): number {
    if (this.params.mode === 'replay') return replayStepMs(this.params.replay?.length ?? 1, this.params.replaySpeedMs);
    const sp = this.animSpeed();
    const base = (this.s.content.balance?.anim.beatMs ?? 380) * 1.6;
    return sp <= 0 ? 0 : base / sp;
  }

  private autoDone(ok: boolean): void {
    const s = this.session;
    this.updateStatusLine();
    if (this.params.mode === 'replay') {
      if (ok && s.done) this.finish();
      else this.explain.show('tombolo.replay.errore', { ora: s.hour }, 'warn', 5000);
      this.refresh();
      return;
    }
    if (s.succeeded()) {
      // Nell'Archivio (A6) la notte si chiude con "Chiudi il merletto", come gli
      // altri Archivi: prima si possono leggere gli echi.
      if (s.archive) {
        this.s.haptics.play('successo');
        // Con tutti i nomi la striscia dice già «tocca gli incroci per gli echi».
        if (!s.archive.allNamed()) this.explain.show('tombolo.archivio.rammendato', {}, 'ok', 4000);
        this.refresh();
        return;
      }
      this.finish();
      return;
    }
    this.runFailed = true;
    this.explain.show('tombolo.occasioni.nonBasta', {}, 'warn', 5000);
    this.refresh();
  }

  /** Lascia accadere: la giornata si tesse da sola, riga per riga. */
  run(): void {
    if (this.params.mode !== 'occasioni' || this.completed || !this.runner) return;
    if (this.session.done || this.session.rows.length > 0) this.session.retry();
    this.placing = false;
    // La nota di Clotilde (come si piantano le occasioni) non copre la giornata che accade.
    this.margin.hide();
    this.extraVersion++;
    this.runner.start();
    this.refresh();
  }

  retry(): void {
    if (this.params.mode !== 'occasioni' || this.completed) return;
    this.runner?.stop();
    this.session.retry();
    this.runFailed = false;
    this.placing = true;
    this.extraVersion++;
    this.refresh();
    this.updateStatusLine();
  }

  /** Salta: lo spartito (o la giornata delle occasioni) si completa subito. */
  skip(): void {
    if (!this.runner || this.completed) return;
    if (this.params.mode === 'occasioni' && !this.runner.running()) return;
    this.runner.finish();
  }

  /** Filo controllato: −1 sinistra, 0 fermo, 1 destra, poi si fissa l'ora. */
  move(dir: -1 | 0 | 1): { ok: boolean; violations: Violation[] } {
    const s = this.session;
    if (this.params.mode !== 'controllato') return { ok: false, violations: [] };
    for (const d of [...s.draft]) s.remove(d.pair);
    const c = s.controlledMove(dir);
    if (c) {
      const v = this.cross(c.pair, c.over, 'debug');
      if (v) return { ok: false, violations: [v] };
    }
    return this.fix();
  }

  // ───────── Fine ─────────

  /** Chiude la notte: esito, evento night:complete, salvataggio della notte tolto. */
  finish(): NightOutcome | null {
    if (this.completed) return this.completed;
    const s = this.session;
    this.runner?.stop();
    // Prima l'esito e il salvataggio, poi l'annuncio: chi ascolta night:complete
    // trova la notte già chiusa (anche se cambia scena subito).
    this.completed = s.outcome();
    this.clearSaved();
    s.complete();
    this.placing = false;
    this.extraVersion++;
    this.explain.show('tombolo.fine', {}, 'ok', 4000);
    this.refresh();
    this.updateStatusLine();
    return this.completed;
  }

  /** Autoplay (debug): le righe date, o la soluzione per le richieste accettate. */
  async autoplay(rows?: RowMoves[], msPerRow = 0): Promise<NightOutcome | null> {
    const s = this.session;
    const m = this.params.mode;
    const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
    if (m === 'replay') {
      this.skip();
      return this.completed;
    }
    if (m === 'occasioni') {
      if (s.archive) {
        for (const t of s.archive.faded()) {
          const ans = this.params.level.archive?.answer[t];
          if (ans) this.name(t, ans);
        }
      }
      const sol = rows ? null : this.computedOccasions();
      if (sol) this.setOccasions(sol);
      this.run();
      this.runner?.finish();
      if (s.archive && s.succeeded()) this.finish();
      return this.completed;
    }
    if (s.archive) {
      for (const t of s.archive.faded()) {
        const ans = this.params.level.archive?.answer[t];
        if (ans) this.name(t, ans);
      }
    }
    if (s.needsNome) {
      // Il filo del minimo dal .computed.json (g12 con Lunardi: il nome su Lunardi,
      // 2 incroci); senza indicazione, il primo filo che non è un lino.
      const best = s.precomputedNomeOn();
      const t = (best && s.state.pos.includes(best) ? best : null) ?? s.state.pos.find((x) => this.visuals.get(x)?.kind !== 'lino') ?? s.state.pos[0];
      if (t) this.setNome(t);
    }
    let sol = rows ?? null;
    if (!sol) {
      const pre = s.precomputed();
      sol = pre;
      if (!sol || !this.prefixOk(sol)) {
        const res = await solveAsync({ level: s.level, ctx: s.ctx, goals: s.goals(), from: { state: s.state, rowsDone: s.rows } });
        sol = res.status === 'ok' && res.rows ? res.rows : null;
        if (!sol) {
          const res2 = await solveAsync({ level: s.level, ctx: s.ctx, goals: [...this.params.goals], from: { state: s.state, rowsDone: s.rows } });
          sol = res2.status === 'ok' && res2.rows ? res2.rows : null;
        }
      }
    }
    if (!sol) return null;
    for (const r of sol) {
      if (this.completed || this.destroyed) break;
      if (r.hour < s.hour) continue;
      if (r.hour !== s.hour) break;
      for (const d of [...s.draft]) s.remove(d.pair);
      for (const c of r.crossings) if (!c.forced) this.cross(c.pair, c.over, 'debug');
      const res = this.fix();
      if (!res.ok) break;
      if (msPerRow > 0) await wait(msPerRow);
    }
    if (s.archive && this.params.mode === 'archivio' && s.done) this.finish();
    return this.completed;
  }

  private prefixOk(sol: readonly RowMoves[]): boolean {
    const s = this.session;
    const key = (c: readonly Crossing[]): string =>
      c
        .filter((x) => !x.forced)
        .map((x) => `${x.pair}${x.over}`)
        .sort()
        .join(',');
    return sol.length === s.level.endHour - s.level.startHour && s.rows.every((r, i) => key(r.crossings) === key(sol[i]?.crossings ?? []));
  }

  private computedOccasions(): OccasionDef[] | null {
    return this.computedRef?.occasionsSolution ?? null;
  }

  computedRef: LevelComputed | null = null;

  // ───────── Pannelli, menu, schede ─────────

  private openPopup(test: string, fill: (body: HTMLElement) => void, keys?: Partial<Record<ActionId, () => void>>): Popup {
    this.popup?.close();
    const p = new Popup({ input: this.s.input, host: this.root, onClose: () => {
      if (this.popup === p) this.popup = null;
    } }, keys ? { test, keys } : { test });
    fill(p.body);
    this.popup = p;
    p.open(this.popupAnchor());
    return p;
  }

  openRequest(noteId: NoteId): void {
    if (noteId === 'obiettivi') {
      this.openGoals();
      return;
    }
    if (noteId.startsWith('obiettivo:')) {
      this.openGoal(Number(noteId.slice(10)));
      return;
    }
    const acc = this.params.accepted.find((a) => a.noteId === noteId);
    if (!acc) return;
    const st = this.session.requestStatusFull().find((x) => x.noteId === noteId);
    const note = this.s.content.notes.get(noteId);
    const who = acc.authorGuess ?? acc.author;
    const ch = this.s.content.characters.get(who);
    const statusKey = st?.dropped ? 'tombolo.richieste.statoLasciata' : st?.report.reasonKey ?? `tombolo.stato.${st?.report.status ?? 'in_corso'}`;
    const statusParams = st && !st.dropped ? nameParams(this.textDeps, st.report.params) : {};
    this.openPopup('tb-popup-bigliettino', (body) => {
      body.appendChild(
        noteCard(
          {
            noteId,
            authorName: ch ? this.s.i18n.t(ch.nameKey) : who,
            textKey: note?.textKey ?? 'tombolo.richieste.senzaTesto',
            statusKey,
            statusParams,
            statusText: st ? reportText(this.textDeps, st.report) : '',
            dropped: !!st?.dropped,
            canDrop: !this.completed,
          },
          () => {
            void this.s.ui
              .confirm({ titleKey: 'tombolo.richieste.confermaTitolo', bodyKey: 'tombolo.richieste.confermaCorpo', okKey: 'tombolo.richieste.lascia', cancelKey: 'tombolo.ui.annulla', danger: true })
              .then((ok) => {
                if (!ok) return;
                this.popup?.close();
                this.drop(noteId);
              });
          },
          // Layout stretto: il pannello dei Bigliettini si apre sopra il tombolo.
          this.layout.kind === 'stretto'
            ? () => {
                this.popup?.close();
                void this.s.ui.openOverlay('bigliettini', { from: 'tombolo', levelId: this.params.level.id, noteId });
              }
            : undefined,
        ),
      );
    });
  }

  private goalSummaryToken(reports: CondReport[]): RequestToken {
    const order: CondStatus[] = ['fallita', 'a_rischio', 'in_corso', 'soddisfatta'];
    const worst = order.find((st) => reports.some((r) => r.status === st)) ?? 'in_corso';
    const done = reports.filter((r) => r.status === 'soddisfatta').length;
    return {
      noteId: 'obiettivi',
      goal: true,
      icon: 'stella',
      color: '#C9A24A',
      status: worst,
      dropped: false,
      label: this.s.i18n.t('tombolo.obiettivo.riassunto', { fatti: done, totale: reports.length }),
    };
  }

  /** Elenco degli obiettivi obbligatori con il loro stato. */
  openGoals(): void {
    const reports = this.session.goalStatus();
    this.openPopup('tb-popup-obiettivi', (body) => {
      reports.forEach((r, i) => {
        const c = this.params.goals[i];
        if (!c) return;
        const statusKey = r.reasonKey ?? `tombolo.stato.${r.status}`;
        body.appendChild(goalCard(describeCondition(this.textDeps, c), statusKey, r.reasonKey ? nameParams(this.textDeps, r.params) : {}));
      });
    });
  }

  /** Scheda di un obiettivo obbligatorio: descrizione e stato in tempo reale. */
  openGoal(i: number): void {
    const c = this.params.goals[i];
    if (!c) return;
    const r = this.session.goalStatus()[i] ?? { status: 'in_corso' as const };
    const statusKey = r.reasonKey ?? `tombolo.stato.${r.status}`;
    const statusParams = r.reasonKey ? nameParams(this.textDeps, r.params) : {};
    this.openPopup('tb-popup-obiettivo', (body) => {
      body.appendChild(goalCard(describeCondition(this.textDeps, c), statusKey, statusParams));
    });
  }

  openCharCard(t: ThreadId): void {
    const v = visualOf(this.visuals, t);
    const save = this.s.save.data();
    const def = this.params.level.threads.find((x) => x.id === t);
    const kind: 'persona' | 'lino' | 'nero' | 'avorio' | 'sbiadito' = v.faded ? 'sbiadito' : v.kind === 'persona' ? 'persona' : v.kind;
    const ch = v.character ? this.s.content.characters.get(v.character) : undefined;
    const quirks = ch ? ch.quirks.filter((q) => this.known.has(q)) : [];
    const memoria = ch && save.campaign ? (save.campaign.memoria[ch.id] ?? null) : null;
    const showMem = memoria !== null && (this.params.needsNome || this.params.level.rules.includes('nome'));
    this.openPopup('tb-popup-scheda', (body) => {
      body.appendChild(
        charCard({
          thread: t,
          nameText: threadName(this.textDeps, t),
          roleKey: ch && !v.faded ? ch.roleKey : null,
          color: v.color,
          icon: v.icon,
          kind: kind === 'persona' && !ch ? (def?.kind === 'avorio' ? 'avorio' : 'persona') : kind,
          quirks,
          desireKey: ch && save.knowledge.desires.includes(ch.id) ? (ch.desireKey ?? null) : null,
          memoria: showMem ? memoria : null,
        }),
      );
    });
  }

  openNotebook(): void {
    const l = this.layout;
    if (l.kind === 'largo' && l.right && !this.rightBox.hidden) {
      const f = this.rightBox.querySelector<HTMLElement>('button, [tabindex]');
      f?.focus({ preventScroll: true });
      this.rightBox.classList.remove('tb-panel--lampo');
      void this.rightBox.offsetWidth;
      this.rightBox.classList.add('tb-panel--lampo');
      return;
    }
    void this.s.ui.openOverlay('taccuino', { from: 'tombolo', levelId: this.params.level.id });
  }

  openMenu(): void {
    const ui = this.s.ui as UiLayerExtra;
    this.cancelPreview();
    if (typeof ui.hasPanel !== 'function' || ui.hasPanel('pausa')) {
      void ui.openOverlay('pausa', { from: 'tombolo', origin: this.params.origin, levelId: this.params.level.id });
      return;
    }
    // Senza il menu Pausa registrato: una scheda minima per riprendere o ricominciare.
    this.openPopup('tb-popup-menu', (body) => {
      body.appendChild(
        el(
          'div',
          { class: 'tb-menu' },
          button({ labelKey: 'tombolo.menu.riprendi', kind: 'primario', onClick: () => this.popup?.close(), test: 'tb-menu-riprendi', block: true }),
          button({ labelKey: 'tombolo.menu.ricomincia', kind: 'secondario', onClick: () => this.restart(), test: 'tb-menu-ricomincia', block: true }),
        ),
      );
    });
  }

  /** Ricomincia la notte dall'apertura (stessi parametri, senza ripresa). */
  restart(): void {
    this.popup?.close();
    // Gli overlay aperti sopra il tombolo (la Pausa da cui si ricomincia) si chiudono.
    const ui = this.s.ui as UiLayerExtra & { overlays?: () => string[] };
    for (let guard = 0; guard < 8 && (ui.overlays?.().length ?? 0) > 0; guard++) ui.closeOverlay();
    const p: NightParams = { ...this.params };
    delete p.resume;
    this.clearSaved();
    this.restarted = true;
    void this.s.scenes.go('tombolo', p, { transition: 'none' });
  }

  restarted = false;

  back(): boolean {
    if (this.popup?.isOpen()) {
      this.popup.close();
      return true;
    }
    if (this.previewRow >= 0) {
      this.cancelPreview();
      return true;
    }
    this.openMenu();
    return true;
  }

  // ───────── Fusi (feedback del trascinamento) ─────────

  spindlePicked(t: ThreadId): void {
    this.renderer.rig.startDrag(t);
    try {
      this.s.audio.sfx('fuso_presa');
    } catch {
      /* audio non pronto */
    }
  }

  spindleMoved(t: ThreadId, x: number): void {
    this.renderer.rig.dragTo(t, x);
  }

  spindleReleased(t: ThreadId, crossed: boolean): void {
    this.renderer.rig.endDrag(t, this.animS(200));
    this.refresh();
    if (!crossed) {
      try {
        this.s.audio.sfx('fuso_rilascio');
      } catch {
        /* audio non pronto */
      }
    }
  }

  spindleBounce(t: ThreadId, dir: number): void {
    this.renderer.rig.bounce(t, dir, this.layout.colW);
  }

  // ───────── Note a margine ─────────

  private showMargin(key: string): void {
    this.margin.show(key);
    try {
      this.s.audio.babble('clotilde', this.s.i18n.t(key));
    } catch {
      /* audio non pronto */
    }
  }

  // ───────── Salvataggio ─────────

  saveNow(immediate: boolean): void {
    if (this.completed || this.destroyed) return;
    if (this.params.mode === 'replay') return;
    this.lastSaveVersion = this.session.version;
    saveNight(this.s, this.params, this.session.toResume(), immediate);
  }

  /**
   * Notte finita o ricominciata: si toglie il suo salvataggio. Le notti 'replay'
   * (spartito, Ripassa) non si salvano mai, quindi non toccano `SaveData.night`:
   * lì può esserci la notte di storia o del merletto lasciata a metà. Anche negli
   * altri modi si toglie solo un salvataggio di questo livello.
   */
  private clearSaved(): void {
    if (this.params.mode === 'replay') return;
    clearNight(this.s, this.params.level.id);
  }

  // ───────── Fine della scena ─────────

  destroy(): void {
    if (this.destroyed) return;
    if (!this.completed && !this.restarted) {
      this.saveNow(true);
      this.s.bus.emit('night:exit', { origin: this.params.origin });
    }
    this.destroyed = true;
    this.runner?.stop();
    this.popup?.close();
    this.explain.destroy();
    this.panelLeft?.destroy();
    this.panelRight?.destroy();
    for (const u of this.unsubs.splice(0)) u();
    this.root.remove();
    nightClosed(this.s.ui.root);
  }
}

// ───────── Avvisi del core durante la notte ─────────

/** Distanza dal fondo degli avvisi brevi durante la notte (sopra la striscia delle richieste). */
const TOAST_BOTTOM_VAR = '--tb-avvisi-basso';
/** Classe sulla radice dell'interfaccia mentre c'è un tombolo (anche fra due notti di fila). */
const NIGHT_CLASS = 'tb-notte';
let openNights = 0;

function nightOpened(root: HTMLElement | undefined): void {
  openNights++;
  root?.classList?.add(NIGHT_CLASS);
}

function nightClosed(root: HTMLElement | undefined): void {
  openNights = Math.max(0, openNights - 1);
  if (openNights > 0) return;
  root?.classList?.remove(NIGHT_CLASS);
  root?.style?.removeProperty(TOAST_BOTTOM_VAR);
}
