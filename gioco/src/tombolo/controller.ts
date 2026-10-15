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
  SolveRequest,
  SolveResult,
  ThreadId,
  Unsub,
  Viewport,
  Violation,
} from '../core/types';
import { el } from '../core/ui/dom';
import { button, textOf } from '../core/ui/components';
import { type RowHint, solveAsync } from '../engine/index';
import { type Diagnosis, Session } from './session';
import { BAND, type NotePlacement, SLOT_R, type TomboloLayout, autoScroll, computeTomboloLayout, placeMarginNote, rowBottom, rowTop, rowsBelow, scrollLimits, slotCenter } from './layout';
import { buildVisuals, type ThreadVisual, visualOf } from './visuals';
import { type TextDeps, capitalizeFirst, describeCondition, formatHour, nameParams, reportText, threadName, violationMessageKey, violationParams } from './text';
import { LaceRenderer, emptyOverlay, type Overlay, type Palette } from './render/lace';
import { type LaceModel, buildLaceModel, stacksOf } from './render/model';
import { type ActivePulse, type MarginHand, Tutorial } from './tutorial';
import { Interaction } from './interact';
import { ActionBar } from './ui/actionbar';
import { ColumnHeader, Hud } from './ui/hud';
import { type GoalsButtonState, RequestStrip, goalCard, noteCard, type RequestToken } from './ui/requests';
import { ObjectivesList } from './ui/objectives';
import { Bubble, type BubbleTarget, bubbleTargetAt, bubbleText } from './ui/bubbles';
import { ArchivePanel } from './ui/archivepanel';
import { shownQuirks } from './quirks';
import { HintLamp, TIERS, hintCard } from './ui/hintlamp';
import { charCard, namePicker } from './ui/charcard';
import { ExplainLine, MarginNote, Popup, type PopupAnchor, ReasonLine, StatusLine, fitText, place, type Params } from './ui/popup';
import { AutoRunner, allowedAt, allowedCells, occasionSlots, toggleOccasion } from './modes/autoweave';
import { replayStepMs } from './modes/replay';
import { saveNight, clearNight } from './resume';
import type { NameResult } from './modes/archive';

/** Come è arrivato un tocco (per aprire le schede lontano dal dito e dopo il click di compatibilità). */
export interface TapVia {
  pointer?: 'mouse' | 'touch' | 'pen';
  /** Y del tocco sullo schermo (px CSS). */
  y?: number;
}

const BEAD_EVENTS: ReadonlySet<LaceEvent['k']> = new Set(['passa', 'copia', 'consegna', 'contagio', 'cura']);
/** Durate delle chiusure speciali a 1× (C11, C12) e della dissolvenza con il movimento ridotto. */
const ENDING_NODO_S = 2.3;
const ENDING_APPARIZIONE_S = 2.5;
const ENDING_FADE_S = 0.6;
/** Nota a margine: si chiude alla prima azione valida dopo 4 s, da sola dopo 12 s (D04). */
const NOTE_MIN_S = 4;
const NOTE_MAX_S = 12;

export interface ControllerOptions {
  computed: LevelComputed | null;
  /** Solver dei suggerimenti e della diagnosi (il Worker; iniettabile nei test). */
  solveAsync?: (req: SolveRequest, signal?: AbortSignal) => Promise<SolveResult>;
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
  readonly textDeps: TextDeps;
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
  /** Perché «Chiudi il merletto» non chiude l'Archivio (TOM-03). */
  readonly closeReason = new ReasonLine('tb-archivio-chiudi-motivo');
  readonly margin = new MarginNote();
  /** Bolla del tocco che spiega (TOM-12). */
  readonly bubble = new Bubble();
  readonly status = new StatusLine();
  private readonly prompt: HTMLElement;
  /** «↓ altre N ore» (TOM-11): righe che non stanno nel merletto. */
  private readonly scrollDown: HTMLButtonElement;
  private scrollHintN = -1;
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
      solveAsync: o.solveAsync ?? ((req, signal) => solveAsync(req, signal)),
      knownQuirks: save.knowledge.quirks,
    });
    this.textDeps = { i18n: s.i18n, content: s.content, level: params.level, override: (id) => this.fadedName(id) };
    this.visuals = this.makeVisuals();
    this.renderer = new LaceRenderer();
    this.tutorial = new Tutorial(params.level.tutorial ?? [], { margin: (k, hand) => this.showMargin(k, hand) });
    this.overlay.quirk = this.quirkOf;
    this.overlay.label = this.labelOf;
    this.overlay.rancor = this.rancorOf;
    this.interact = new Interaction(this);
    this.vp = s.viewport.get();

    // ───────── DOM ─────────
    this.requests = new RequestStrip((id) => this.openRequest(id));
    this.requests.onSkip = () => this.skipQuiet();
    this.actions = new ActionBar({ menu: () => this.openMenu(), undo: () => this.undo(), main: () => this.mainAction(), notebook: () => this.openNotebook() });
    this.lamp = new HintLamp(() => {
      this.tutorial.interacted('lampada');
      void this.lampTap();
    });
    this.margin.onTap = () => this.closeNote();
    this.prompt = el('div', { class: 'tb-prompt', role: 'status', test: 'tb-nome-prompt', hidden: true });
    this.scrollDown = el('button', { type: 'button', class: ['tb-scorri', 'core-solid'], test: 'tb-scorri-giu', hidden: true });
    this.scrollDown.addEventListener('click', (e) => {
      if (e.detail > 0) this.scrollDown.blur();
      this.scrollBy(Math.max(this.layout.rowH, this.layout.lace.h * 0.8));
      this.updateScrollHint();
    });
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
      this.closeReason.el,
      this.margin.el,
      this.bubble.el,
      this.prompt,
      this.scrollDown,
      this.rewindBar,
      this.status.el,
    );
    this.header.build(
      params.level.columns.map((p) => {
        const pl = s.content.places.get(p);
        return { place: p, icon: pl?.icon ?? 'info', shortKey: pl?.shortKey ?? `tombolo.luogo.${p}`, nameKey: pl?.nameKey ?? `tombolo.luogo.${p}` };
      }),
      (k) => s.i18n.t(k),
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
    if (!this.session.done) this.tutorial.onEvents(this.session.preview().events);
    this.updateStatusLine();
    this.lastRowHour = this.session.hour;
    this.rememberStatuses();
    this.saveNow(false);
    this.s.canvas?.canvas?.addEventListener('pointermove', this.onHover);
    if (typeof window !== 'undefined') window.addEventListener('keydown', this.onKeyCapture, true);
    // Le misure delle scritte si rifanno a font caricati (D16).
    try {
      void document.fonts?.ready.then(() => {
        if (!this.destroyed) this.resize(this.vp);
      });
    } catch {
      /* niente FontFaceSet */
    }
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
    // TOM-19: la riga di stato si riscrive tutta nella lingua nuova (i nomi dei luoghi sono nei parametri).
    this.updateStatusLine();
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
    this.layout = computeTomboloLayout(vp, lv.columns.length, lv.endHour - lv.startHour, { noteBand: this.noteBand, hud: this.hudH });
    this.renderer.configure(this.layout, vp.dpr);
    this.extraVersion++;
    this.refresh(true);
    this.layoutDom();
    this.scroll = this.scrollTarget;
  }

  /** Altezza della barra alta con le scritte a capo (0 = la sua altezza normale). */
  private hudH = 0;

  private relayouts = 0;
  private overlayWasOpen = false;

  /** La barra alta ha cambiato scritte: se ha cambiato altezza, si ridispone il tombolo. */
  private checkHudHeight(): void {
    const natural = this.hud.naturalHeight();
    const want = natural > BAND.hud ? natural : 0;
    if (natural > 0 && want !== this.hudH && this.relayouts < 4) {
      this.relayouts++;
      this.hudH = want;
      this.resize(this.vp);
      this.relayouts--;
    }
  }

  private layoutDom(): void {
    const l = this.layout;
    this.hud.layout(l);
    // Le scritte della barra alta vanno a capo invece di rimpicciolirsi (D16): se
    // non stanno nei 52 px la barra cresce e il tombolo si ridispone.
    const natural = this.hud.naturalHeight();
    const want = natural > BAND.hud ? natural : 0;
    if (natural > 0 && want !== this.hudH && this.relayouts < 4) {
      this.hudH = want;
      this.relayouts++;
      this.resize(this.vp);
      this.relayouts--;
      return;
    }
    this.header.layout(l);
    this.requests.layout(l);
    this.actions.layout(l);
    this.lamp.layout(l);
    const laceTop = l.lace.y + 6;
    const w = Math.min(l.center.w - 24, 460);
    // «Appunta il tuo nome»: in cima al merletto (prima della prima riga non c'è niente sotto).
    this.prompt.style.left = `${l.center.x + (l.center.w - w) / 2}px`;
    this.prompt.style.top = `${laceTop}px`;
    this.prompt.style.width = `${w}px`;
    // Un solo messaggio, sopra «Fissa l'ora» (D04): mai sulla riga corrente.
    this.placeReason(this.explain.el);
    this.applyNoteRect();
    place(this.rewindBar, l.actions);
    this.placeReason(this.closeReason.el);
    this.popup?.position(this.popupAnchor(this.popupTop));
    // Gli avvisi brevi del core (una voce del Taccuino, una stranezza) salgono sopra
    // la striscia delle richieste: in basso coprirebbero i fusi (vedi tombolo.css).
    this.s.ui.root?.style?.setProperty(TOAST_BOTTOM_VAR, `${Math.max(0, Math.round(l.cssH - l.requests.y + 8))}px`);
    this.mountPanels();
  }

  /** Posto delle schede: sopra la barra delle azioni o, con `top`, in cima al merletto. */
  private popupAnchor(top = false): PopupAnchor {
    const l = this.layout;
    if (top) return { x: l.center.x, y: l.lace.y + 4, w: l.center.w, h: l.actions.y - l.lace.y - 12, top: true };
    return { x: l.center.x, y: l.cssH - l.actions.y + 8, w: l.center.w, h: l.actions.y - l.lace.y - 16 };
  }

  private popupTop = false;

  /** Riga di motivo: sopra la barra delle azioni, centrata sul pulsante grande. */
  private placeReason(node: HTMLElement): void {
    const l = this.layout;
    const w = Math.min(l.center.w - 16, 420);
    node.style.left = `${l.center.x + (l.center.w - w) / 2}px`;
    node.style.width = `${w}px`;
    node.style.bottom = `${l.cssH - l.actions.y + 4}px`;
    node.style.top = '';
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
    this.archivePanel = null;
    if (l.left && this.session.archive) {
      // Archivio (C09): a sinistra il pannello del tombolo, non i Bigliettini.
      const panel = new ArchivePanel(this);
      this.archivePanel = panel;
      this.leftBox.replaceChildren(panel.el);
      this.panelLeft = { destroy: () => panel.el.remove() };
    } else if (l.left) this.panelLeft = this.s.ui.mountPanel('bigliettini', this.leftBox, opts);
    // Il Taccuino a destra è fisso: non apre la scheda dei Bigliettini (sono già a sinistra).
    if (l.right) this.panelRight = this.s.ui.mountPanel('taccuino', this.rightBox, { ...opts, fixed: true });
  }

  /** Pannello dell'Archivio nel layout largo (C09), se montato. */
  private archivePanel: ArchivePanel | null = null;
  /** Echi letti stanotte (registro del pannello dell'Archivio). */
  private readonly heard: { hour: number; pair: number }[] = [];

  heardEchoes(): readonly { hour: number; pair: number }[] {
    return this.heard;
  }

  /** «Teresa → Aldo, alle 9»: chi stava sopra e chi sotto nel crocevia di un eco. */
  echoNames(hour: number, pair: number): string {
    const t = this.session.archive?.echoThreads(hour, pair);
    if (!t) return formatHour(this.textDeps, hour);
    return capitalizeFirst(this.s.i18n.t('tombolo.archivio.ecoChi', { sopra: threadName(this.textDeps, t.over), sotto: threadName(this.textDeps, t.under), ora: formatHour(this.textDeps, hour) }), this.s.i18n.locale());
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
      if (this.margin.visible()) this.positionNote();
    }
    this.updateUi();
    this.updateLists();
    this.archivePanel?.update();
  }

  echoesOpen(): boolean {
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
    // C11: il merletto chiuso dal nodo non dice «Merletto chiuso» nemmeno sul pulsante.
    if (this.completed) return { key: this.params.level.chiusura === 'nodo' ? 'tombolo.azioni.fissa' : 'tombolo.azioni.chiuso', enabled: false };
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
    const hudChanged = this.hud.update({
      dayKey: day.key,
      dayParams: day.params,
      titleKey: lv.titleKey,
      titleParams: this.titleParams(),
      hour: formatHour(this.textDeps, s.done ? lv.endHour : s.hour),
      end: formatHour(this.textDeps, lv.endHour),
      // C11: il merletto chiuso dal nodo non dice «Merletto chiuso».
      done: s.done && lv.chiusura !== 'nodo',
      matassa: this.showMatassa() ? s.matassa() : null,
      light: this.windowLight(),
    });
    if (hudChanged && this.layout) this.checkHudHeight();
    const main = this.mainKey();
    const pulses = this.activePulses();
    const has = (t: string): boolean => pulses.some((p) => p.target === t);
    this.actions.update({
      mainKey: main.key,
      mainEnabled: main.enabled,
      undoEnabled: !this.completed && s.canUndo(),
      undoVisible: this.params.mode !== 'replay' && this.params.mode !== 'occasioni',
      pulse: (['fissa', 'disfa', 'taccuino'] as const).filter((t) => has(t)),
    });
    this.lamp.el.classList.toggle('tb-pulsa', has('lampada'));
    this.hud.setPulse(has('matassa'));
    // Richieste.
    const tokens: RequestToken[] = s.requestStatusFull().map((st) => {
      const acc = this.params.accepted.find((a) => a.noteId === st.noteId);
      const who = (acc?.authorGuess ?? acc?.author ?? 'teresa') as CharacterId;
      const ch = this.s.content.characters.get(who);
      const name = ch ? this.s.i18n.t(ch.nameKey) : who;
      // Spunta tratteggiata: si compirebbe fissando l'ora (C07); «soddisfatta» solo a ora fissata.
      const preview = !st.dropped && st.anteprima === 'soddisfatta' && st.report.status !== 'soddisfatta';
      const statusKey = st.dropped ? 'tombolo.richieste.statoLasciata' : preview ? 'tombolo.stato.inArrivo' : `tombolo.stato.${st.report.status}`;
      return {
        noteId: st.noteId,
        icon: ch?.icon ?? 'busta',
        color: ch?.color ?? '#C8372D',
        status: st.report.status,
        preview,
        dropped: st.dropped,
        label: this.s.i18n.t('tombolo.richieste.gettone', { nome: name, stato: this.s.i18n.t(statusKey) }),
      };
    });
    this.requests.update(tokens);
    // Salta le ore quiete (D02.3): «Fissa fino alle N» quando almeno 2 righe si fissano vuote senza eventi
    // e (R2-D1, Q001) il solver conferma che da lì le richieste si compiono ancora.
    const quiet = this.completed || this.previewRow >= 0 ? { count: 0, until: 0 } : this.confirmedQuiet();
    this.quietUntil = quiet.count >= 2 ? quiet.until : null;
    this.requests.setSkip(this.quietUntil !== null ? formatHour(this.textDeps, this.quietUntil) : null);
    // Pulsante Obiettivi con il contatore «2/5» (C08): obiettivi, spilli, rancore, fili da nominare.
    this.requests.setGoals(this.goalsButton());
    this.requests.goals.classList.toggle('tb-pulsa', has('obiettivi'));
    const a = s.archive;
    if (a) {
      // Archivio con le occasioni (A6): oltre ai nomi, quante occasioni restano da piantare.
      const occ = this.params.mode === 'occasioni' ? { piantate: s.occasions.length, posti: occasionSlots(lv) } : null;
      if (!a.allNamed()) {
        const pr = a.progress();
        // Nella striscia la forma breve (la regola dei gruppi di tre la dice il selettore).
        this.requests.setInfo(occ ? 'tombolo.archivio.contatoreOccasioni' : 'tombolo.archivio.nomiDatiBreve', { dati: pr.given, totale: pr.total, ...(occ ?? {}) }, occ ? 'tombolo.archivio.contatoreOccasioniBreve' : undefined);
      }
      // Sul telefono stretto la frase intera non sta nella striscia: la forma breve, mai tagliata.
      else if (!this.echoesOpen()) this.requests.setInfo(occ ? 'tombolo.occasioni.contatore' : 'tombolo.archivio.daRammendare', occ ?? {}, occ ? undefined : 'tombolo.archivio.daRammendareBreve');
      else this.requests.setInfo('tombolo.archivio.fatto', {}, 'tombolo.archivio.fattoBreve');
    } else if (this.params.mode === 'occasioni') {
      this.requests.setInfo('tombolo.occasioni.contatore', { piantate: s.occasions.length, posti: occasionSlots(lv) });
    } else if (this.params.mode === 'replay') {
      this.requests.setInfo('tombolo.replay.righe', { fatte: s.rows.length, totale: lv.endHour - lv.startHour });
    } else this.requests.setInfo('', {});
    // Lampada (D07.1): sempre visibile, tenue; accesa dopo 60 s senza fissare o 3 Disfa
    // sulla stessa riga, e accesa per tutta la notte dopo il primo suggerimento.
    const avail = this.lampAvailable();
    this.lamp.setLit(avail && (this.lampLit() || this.hintsShown > 0), avail);
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
    // Dopo «Ore 9.» comincia una frase nuova: maiuscola anche se il primo nome è
    // «il marinaio» o «il filo sbiadito 1» (P012, P082); l'ora nel formato della lingua.
    if (parts[0]) parts[0] = capitalizeFirst(parts[0], this.s.i18n.locale());
    // C11: nemmeno la riga di stato dice «Merletto chiuso» dopo il nodo.
    this.status.set(s.done && this.params.level.chiusura !== 'nodo' ? 'tombolo.sr.fine' : 'tombolo.sr.stato', {
      ora: st.hour,
      oraFmt: formatHour(this.textDeps, st.hour),
      posizioni: parts.join(this.s.i18n.t('tombolo.sr.separatore')),
    });
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
    // Le misure si rifanno a sovrapposizioni chiuse (D16: impostazioni cambiate dalla Pausa).
    const ui = this.s.ui as UiLayerExtra & { overlays?: () => string[] };
    const overlayOpen = (ui.overlays?.().length ?? 0) > 0;
    if (this.overlayWasOpen && !overlayOpen) this.resize(this.vp);
    this.overlayWasOpen = overlayOpen;
    // Nota a margine: 12 s, se l'avanzamento automatico è acceso (D04).
    if (this.margin.visible() && this.s.settings.get().autoAdvance && this.time - this.noteAt >= NOTE_MAX_S) this.closeNote();
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
    const e = this.ending;
    if (e) {
      e.t += dt;
      if (o.ending) o.ending.p = Math.min(1, e.dur > 0 ? e.t / e.dur : 1);
      if (e.kind === 'apparizione' && this.layout) this.scroll = -(this.layout.rowH + 8);
      if (e.t >= e.dur) this.endEnding();
    }
    this.updateScrollHint();
  }

  /** Indicatore delle righe nascoste in fondo al merletto (D06: «↓ altre 3 ore»). */
  updateScrollHint(): void {
    if (!this.layout) return;
    const n = rowsBelow(this.layout, this.scroll);
    if (n === this.scrollHintN) return;
    this.scrollHintN = n;
    this.scrollDown.hidden = n === 0;
    this.scrollDown.dataset.ore = String(n);
    if (n > 0) {
      this.scrollDown.replaceChildren(textOf('tombolo.scorri.giu', { n }, 'span'));
      const l = this.layout;
      const w = Math.min(220, l.center.w - 32);
      this.scrollDown.style.left = `${l.center.x + (l.center.w - w) / 2}px`;
      this.scrollDown.style.width = `${w}px`;
      this.scrollDown.style.top = `${l.lace.y + l.lace.h - 48}px`;
    }
  }

  render(host: CanvasHost): void {
    if (this.destroyed || !this.model) return;
    const o = this.overlay;
    const s = this.session;
    const dragging = this.interact.dragging() !== null;
    o.handFrom = dragging ? -1 : this.handFrom;
    o.handTo = dragging ? -1 : this.handTo;
    const naming = this.keyboard && !this.placing && this.namingByKeyboard();
    o.cursorPair = this.keyboard && !this.placing && !(naming && (s.needsNome || !s.isPlayerRow())) ? this.interact.cursorPair : -1;
    o.cursorCol = naming ? this.interact.cursorThread : -1;
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
  /** Fili in rancore finché la regola vale (segno del nodo sulla testa del fuso, D06). */
  private readonly rancorous = new Set<ThreadId>();
  private readonly rancorOf = (t: ThreadId): boolean => this.rancorous.has(t);

  /** Stranezze da mostrare di un personaggio (TOM-17: modalità extra o regola del Taccuino). */
  quirksOf(character: CharacterId): QuirkId[] {
    const ch = this.s.content.characters.get(character);
    if (!ch) return [];
    const k = this.s.save.data().knowledge;
    return shownQuirks(this.params.origin, character, ch.quirks, this.session.ctx.quirks, { quirks: [...this.known], diary: k.diary }, this.s.content);
  }
  private readonly labelOf = (t: ThreadId): string | null => this.labels.get(t) ?? null;

  /** Dati delle sovrapposizioni che non cambiano a ogni fotogramma. */
  private updateOverlayData(): void {
    const s = this.session;
    this.quirky.clear();
    for (const t of this.model?.hangPos ?? []) {
      const v = this.visuals.get(t);
      if (!v || !v.character || v.faded) continue;
      if (this.quirksOf(v.character).length > 0) this.quirky.add(t);
    }
    this.rancorous.clear();
    for (const [a, b] of s.ctx.rancor) {
      this.rancorous.add(a);
      this.rancorous.add(b);
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
    // Pulsazioni del tutorial sul merletto (C02): fuso, spillo, bordo, marea.
    const o = this.overlay;
    o.pulseEdge = -1;
    o.pulsePinCol = -1;
    o.pulsePinIndex = -1;
    o.pulseTideFrom = -1;
    const lv = this.params.level;
    const start = lv.startHour;
    for (const p of this.activePulses()) {
      if (p.target === 'fuso' && p.thread) hl.add(p.thread);
      else if (p.target === 'bordo') o.pulseEdge = p.hour - start;
      else if (p.target === 'marea') o.pulseTideFrom = p.hour - start;
      else if (p.target === 'spillo' && p.thread) {
        let best: { col: number; index: number; d: number } | null = null;
        for (const pin of lv.pins) {
          if (pin.thread !== p.thread) continue;
          const col = lv.columns.indexOf(pin.place);
          const d = Math.abs(pin.hour - p.hour);
          if (col >= 0 && (!best || d < best.d)) best = { col, index: pin.hour - start, d };
        }
        if (best) {
          o.pulsePinCol = best.col;
          o.pulsePinIndex = best.index;
        }
      }
    }
  }

  /** Pulsazioni del tutorial attive adesso. */
  private activePulses(): ActivePulse[] {
    const s = this.session;
    if (this.completed) return [];
    return this.tutorial.pulses(s.hour, s.draft.length === 0, s.needsNome);
  }

  // ───────── Il tocco spiega ─────────

  /** Bersaglio di una bolla sotto il punto (spillo, bordo, perlina, ora, filo nero), o null. */
  bubbleTargetAt(x: number, y: number): BubbleTarget | null {
    if (!this.model || !this.layout) return null;
    return bubbleTargetAt({ layout: this.layout, model: this.model, scroll: this.scroll, rig: this.renderer.rig, previewing: this.previewRow >= 0 }, x, y);
  }

  /** Apre la bolla del bersaglio sotto il punto; false se lì non c'è niente da spiegare. */
  showBubbleAt(x: number, y: number, hover = false): boolean {
    const t = this.bubbleTargetAt(x, y);
    if (!t) {
      if (hover && this.bubbleByHover) this.hideBubble();
      return false;
    }
    const text = bubbleText(
      { text: this.textDeps, level: this.params.level, session: this.session, accepted: this.params.accepted, occasions: this.session.occasions, locale: this.s.i18n.locale() },
      t,
    );
    if (!text) return false;
    const l = this.layout;
    this.bubble.show(text, t.x, t.y, { x: l.center.x, y: l.hud.y + l.hud.h, w: l.center.w, h: l.actions.y - l.hud.y - l.hud.h });
    this.bubble.el.dataset.tipo = t.k;
    this.bubbleByHover = hover;
    if (!hover) {
      if (t.k === 'spillo') this.tutorial.interacted('spillo');
      if (t.k === 'bordo') this.tutorial.interacted('bordo');
    }
    return true;
  }

  private bubbleByHover = false;

  hideBubble(): void {
    if (this.bubble.visible()) this.bubble.hide();
    this.bubbleByHover = false;
  }

  /** Passaggio del mouse (GDD 11.2): la stessa bolla del tocco, solo come anteprima. */
  private readonly onHover = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse' || e.buttons !== 0 || this.destroyed) return;
    if (this.bubble.visible() && !this.bubbleByHover) return;
    if (this.popup?.isOpen()) return;
    const cv = this.s.canvas?.canvas;
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    this.showBubbleAt(e.clientX - r.left, e.clientY - r.top, true);
  };

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

  /**
   * Si nomina con la tastiera (TOM-19): il nome di Ada da appuntare o un filo
   * sbiadito dell'Archivio ancora da confermare. Allora le frecce raggiungono
   * tutte le colonne (anche l'ultima, che nessuna coppia ha a sinistra).
   */
  namingByKeyboard(): boolean {
    const s = this.session;
    if (this.completed) return false;
    if (s.needsNome) return true;
    const a = s.archive;
    return !!a && a.faded().some((t) => !a.isConfirmed(t));
  }

  /** Il cursore delle frecce è sulla colonna `col` mentre si nomina: la riga di stato dice chi c'è. */
  cursorMoved(col: number): void {
    if (!this.namingByKeyboard()) return;
    const t = this.threadAtColumn(col);
    const place = this.params.level.columns[col];
    if (!t || !place) return;
    this.status.set('tombolo.sr.cursore', { posto: this.s.i18n.t(`tombolo.sr.luogo.${place}`, { nome: threadName(this.textDeps, t) }) });
  }

  // ───────── Azioni ─────────

  private textOfViolation(v: Violation): { key: string; params: Params } {
    return { key: violationMessageKey(this.textDeps, v), params: violationParams(this.textDeps, v) };
  }

  /**
   * Una violazione produce un solo messaggio (D04): la riga di motivo sopra «Fissa
   * l'ora», oppure la nota del tutorial se ne parte una. Mai un avviso a banner.
   */
  private onViolation(v: Violation): void {
    this.lastViolation = v;
    const t = this.textOfViolation(v);
    this.closeReason.hide();
    const noted = this.tutorial.onViolation(v, this.session.hour);
    if (noted) {
      this.explain.hide();
      this.suppressed = t;
    } else {
      this.suppressed = null;
      this.explain.show(t.key, t.params, 'warn', 4500);
    }
  }

  /** Messaggio di una violazione sostituito da una nota del tutorial (per il debug). */
  suppressed: { key: string; params: Params } | null = null;

  /** Un messaggio nella riga in basso (al posto di quello che c'era). */
  private say(key: string, params: Params, kind: 'info' | 'warn' | 'ok', ms: number): void {
    this.closeReason.hide();
    this.explain.show(key, params, kind, ms);
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
    this.ghostDone(pair, over);
    this.launchFlights(pair);
    this.validAction();
    this.tutorial.onCross(hour, s.wrongSide(pair));
    this.tutorial.onEvents(s.preview().events);
    this.refresh();
    return null;
  }

  /** Un'azione accettata: i messaggi di un rifiuto passato non valgono più; la nota può chiudersi. */
  private validAction(): void {
    this.suppressed = null;
    if (this.explain.key.startsWith('tombolo.violazione.')) this.explain.hide();
    this.noteAction();
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
      this.validAction();
      this.tutorial.onCross(this.session.hour, this.session.wrongSide(pair));
      this.tutorial.onEvents(this.session.preview().events);
    }
    this.refresh();
    return v;
  }

  removeCrossing(pair: number): void {
    if (this.completed) return;
    this.session.remove(pair);
    this.validAction();
    this.refresh();
  }

  tapCurrentPair(p: number): void {
    const s = this.session;
    if (s.draft.some((d) => d.pair === p)) {
      this.flipCrossing(p);
      return;
    }
    if (s.forced().some((f) => f.pair === p)) this.say('tombolo.violazione.forzato', nameParams(this.textDeps, { a: s.state.pos[p] ?? '', b: s.state.pos[p + 1] ?? '' }), 'info', 3500);
  }

  /** Tocco su un fuso: nome di Ada (da g12) o nome di un filo sbiadito (Archivio). */
  tapSpindle(t: ThreadId, via?: TapVia): void {
    if (this.nomeTap(t)) return;
    if (this.isFadedThread(t)) this.openNamePicker(t, via);
  }

  /** Tasto N: nome di Ada (da g12) o nome di un filo sbiadito (Archivio). */
  nameKey(t: ThreadId): void {
    if (this.nomeTap(t)) return;
    if (this.isFadedThread(t)) this.openNamePicker(t);
  }

  /**
   * Il nome di Ada (GDD 3.11, TOM-16): si appunta toccando un fuso; finché nessuna
   * ora è fissata un tocco su un altro fuso lo sposta («Il tuo nome ora è su X»);
   * dopo, il tocco dice «Il nome è già appuntato». true se il tocco è servito al nome.
   */
  private nomeTap(t: ThreadId): boolean {
    const s = this.session;
    if (!this.params.needsNome || this.completed) return false;
    if (s.needsNome) {
      this.setNome(t);
      return true;
    }
    if (s.nomeOn === t) return false;
    if (s.rows.length === 0) {
      this.setNome(t, true);
      return true;
    }
    this.say('tombolo.nome.giaAppuntato', { nome: threadName(this.textDeps, s.nomeOn ?? t) }, 'info', 3000);
    return true;
  }

  /** Un filo sbiadito dell'Archivio (confermato o no). */
  isFadedThread(t: ThreadId | null): t is ThreadId {
    return !!t && !!this.session.archive && !!this.params.level.archive?.faded.includes(t);
  }

  /**
   * Filo che passa nella cella (riga `index`, colonna `col`): nella metà alta
   * quello di prima della riga, nella metà bassa quello di dopo. Le righe non
   * ancora tessute dell'Archivio si leggono dal merletto registrato.
   */
  threadInCell(index: number, col: number, lower: boolean): ThreadId | null {
    const s = this.session;
    const start = this.params.level.startHour;
    const at = (i: number): ThreadId | null => {
      if (i < 0) return null;
      const st = s.timeline[i];
      if (st && i <= s.rows.length) return st.pos[col] ?? null;
      return s.archive ? s.archive.recordedThreadAt(start + i, col) : null;
    };
    if (index <= 0) return at(0);
    return at(lower ? index : index - 1) ?? at(index - 1);
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
    this.closeReason.hide();
    this.validAction();
    this.cancelPreview();
    this.refresh();
    this.updateStatusLine();
    for (const st of s.requestStatusFull()) {
      if (st.report.status === 'soddisfatta' && this.lastStatus[st.noteId] !== 'soddisfatta') {
        this.s.haptics.play('successo');
        const acc = this.params.accepted.find((a) => a.noteId === st.noteId);
        const ch = acc ? this.s.content.characters.get(acc.authorGuess ?? acc.author) : undefined;
        this.say('tombolo.richieste.soddisfatta', { nome: ch ? this.s.i18n.t(ch.nameKey) : '' }, 'ok', 3000);
      }
    }
    this.rememberStatuses();
    this.tutorial.interacted('fissa');
    const lastEvents = s.events[s.events.length - 1];
    if (lastEvents) this.tutorial.onEvents(lastEvents);
    const a = s.archive;
    if (a && this.params.mode === 'archivio' && a.allMended() && !this.mendAnnounced) {
      this.mendAnnounced = true;
      this.tutorial.onArchive('rammendo');
    }
    this.tutorial.onRowStart(s.hour, false);
    if (!s.done) this.tutorial.onEvents(s.preview().events);
    this.saveNow(true);
    if (s.done && !(s.archive && this.params.mode === 'archivio') && this.params.mode !== 'occasioni') this.finish();
  }

  /** Maiusc+Invio (GDD 11.3): il core lo mappa su `confirm`; qui si ricorda il Maiusc. */
  private shiftEnter = false;
  private readonly onKeyCapture = (e: KeyboardEvent): void => {
    this.shiftEnter = e.key === 'Enter' && e.shiftKey;
  };

  /** L'ultimo `confirm` veniva da Maiusc+Invio? (si legge una volta sola) */
  consumeShiftEnter(): boolean {
    const v = this.shiftEnter;
    this.shiftEnter = false;
    return v;
  }

  /** Ultima ora che «Fissa fino alle N» fisserebbe (null = non offerto). */
  quietUntil: number | null = null;
  /** Conferma del solver per «Fissa fino alle N» (per stato della notte; null = in attesa). */
  private quietCheck: { key: string; result: { count: number; until: number } | null } | null = null;

  /** Corsa di ore quiete confermata (subito se si può, altrimenti quando il solver risponde). */
  private confirmedQuiet(): { count: number; until: number } {
    const s = this.session;
    const run = s.quietRun();
    const none = { count: 0, until: 0 };
    if (run.count < 2) return none;
    const key = `${s.hour}|${s.hintSig()}|${run.count}`;
    if (this.quietCheck?.key === key) return this.quietCheck.result ?? none;
    const now = s.quietConfirmedNow(run);
    this.quietCheck = { key, result: now };
    if (now) return now;
    void s.confirmQuietRun(run).then((r) => {
      if (this.destroyed || this.quietCheck?.key !== key) return;
      this.quietCheck.result = r;
      if (r.count >= 2) this.updateUi();
    });
    return none;
  }

  /**
   * Salta le ore quiete (D02.3, Maiusc+Invio): fissa riga per riga le ore vuote e si
   * ferma al primo evento; Disfa torna indietro di una riga alla volta.
   */
  skipQuiet(): number {
    if (this.completed || this.quietUntil === null) return 0;
    const s = this.session;
    const until = this.quietUntil;
    let n = 0;
    for (let guard = 0; guard < 32 && s.hour <= until && !s.done; guard++) {
      if (s.draft.length > 0) break;
      const res = this.fix();
      if (!res.ok) break;
      n++;
    }
    return n;
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
      if (this.session.done && this.session.archive && this.session.succeeded()) this.closeArchive();
      else if (this.session.done) this.retry();
      else this.run();
      return;
    }
    if (this.session.archive && m === 'archivio' && this.session.done) {
      this.closeArchive();
      return;
    }
    this.fix();
  }

  /**
   * Che cosa manca per chiudere un merletto d'Archivio (TOM-03, D05.6): i nomi
   * dei fili sbiaditi, il rammendo di uno strappo, o null se si può chiudere.
   */
  archiveCloseProblem(): { key: string; params: Params } | null {
    const s = this.session;
    const a = s.archive;
    if (!a) return null;
    const faded = this.params.level.archive?.faded ?? [];
    const miss = a.missing();
    if (miss.length > 0) {
      const nums = miss.map((t) => String(faded.indexOf(t) + 1));
      return { key: 'tombolo.archivio.manca.nomi', params: { n: nums.length, fili: this.joinList(nums) } };
    }
    if (this.params.mode === 'occasioni') return s.done && s.succeeded() ? null : { key: 'tombolo.archivio.manca.giornata', params: {} };
    const open = a.openHoles()[0];
    if (open) return open.from === open.to ? { key: 'tombolo.archivio.manca.rammendoOra', params: { ora: open.from } } : { key: 'tombolo.archivio.manca.rammendo', params: { da: open.from, a: open.to } };
    if (!s.done) return { key: 'tombolo.archivio.manca.righe', params: { ora: s.hour } };
    return null;
  }

  /** «Chiudi il merletto» nell'Archivio: chiude, oppure dice che cosa manca. */
  private closeArchive(): void {
    const p = this.archiveCloseProblem();
    if (!p) {
      this.closeReason.hide();
      this.finish();
      return;
    }
    this.closeReason.show(p.key, p.params, 6000);
    this.actions.shake();
    this.s.haptics.play('rifiuto');
  }

  /** «1, 2 e 3» nella lingua corrente. */
  joinList(items: readonly string[]): string {
    if (items.length <= 1) return items[0] ?? '';
    const sep = this.s.i18n.t('tombolo.elenco.separatore');
    const last = this.s.i18n.t('tombolo.elenco.ultimo');
    return `${items.slice(0, -1).join(sep)}${last}${items[items.length - 1]}`;
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
    this.validAction();
    this.tutorial.interacted('disfa');
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
        this.showEcho(key, this.params.level.startHour + index, pair);
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

  setNome(thread: ThreadId, moved = false): void {
    const s = this.session;
    if (s.rows.length > 0) return;
    s.setNome(thread);
    if (s.nomeOn !== thread) return;
    const name = threadName(this.textDeps, thread);
    this.say(moved ? 'tombolo.nome.spostato' : 'tombolo.nome.appuntato', { nome: name }, 'ok', 3000);
    this.validAction();
    this.tutorial.onNome();
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
    this.overlay.ghosts = [];
    if (this.popup?.el.dataset.test === 'tb-popup-hint') this.popup.close();
  }

  /** Il giocatore ha fatto un incrocio del Fantasma: quel tratteggio sparisce, e con l'ultimo tutto. */
  private ghostDone(pair: number, over: Side): void {
    const o = this.overlay;
    if (o.ghosts.length === 0) {
      if (o.ghostPair === pair) this.clearHintMarks();
      return;
    }
    const rest = o.ghosts.filter((g) => !(g.pair === pair && g.over === over));
    if (rest.length === o.ghosts.length) return;
    if (rest.length === 0) {
      this.clearHintMarks();
      return;
    }
    o.ghosts = rest;
    o.ghostPair = rest[0]?.pair ?? -1;
    o.ghostOver = rest[0]?.over ?? 'L';
  }

  /**
   * Suggerimenti della riga (D07.2) e loro validità (R2-D1): cambiando ora si
   * riparte dalla Spinta; cambiando nome, bozza o richieste lasciate cadere i
   * suggerimenti già calcolati non valgono più (si ricalcolano), ma la lampada
   * riapre lo stesso gradino.
   */
  private resetHintRow(): void {
    const s = this.session;
    const h = s.done ? -2 : s.hour;
    const sig = `${s.hintSig()}|${s.draft.map((c) => `${c.pair}${c.over}`).sort().join(',')}`;
    if (this.hintRowHour === h) {
      if (this.hintStateSig !== sig) {
        this.hintStateSig = sig;
        this.rowHints.clear();
        this.pendingGhost = null;
        this.diagnosis = null;
      }
      return;
    }
    this.hintRowHour = h;
    this.hintStateSig = sig;
    this.hintMax = -1;
    this.rowHints.clear();
    this.countedTiers.clear();
    this.pendingGhost = null;
  }

  /** Firma dello stato su cui sono stati calcolati i suggerimenti della riga. */
  private hintStateSig = '';
  /** Gradini già contati in questa riga (un suggerimento ricalcolato non si conta di nuovo). */
  private readonly countedTiers = new Set<HintTier>();

  /** Nell'Archivio, a righe finite o fra uno strappo e l'altro: suggerimenti sui nomi. */
  private namingHints(): boolean {
    const a = this.session.archive;
    return !!a && !a.allNamed() && !this.session.isPlayerRow() && !this.completed;
  }

  /** La lampada si può toccare (sempre visibile, D07.1). */
  lampAvailable(): boolean {
    if (this.completed) return false;
    return this.session.isPlayerRow() || this.namingHints();
  }

  /**
   * Tocco sulla lampada (D07.2): riapre il gradino più alto già mostrato in questa
   * riga, o la Spinta. Non sale mai da solo: si sale con i pulsanti della scheda.
   */
  async lampTap(): Promise<Hint | null> {
    if (!this.lampAvailable()) return null;
    this.resetHintRow();
    const tier = this.hintMax >= 0 ? (TIERS[this.hintMax] as HintTier) : 'spinta';
    return this.showHint(tier);
  }

  /** Tasto H: come la lampada; con la scheda del suggerimento aperta, il gradino successivo. */
  async nextHint(): Promise<Hint | null> {
    return this.lampTap();
  }

  /** Gradino successivo a quello più alto mostrato (pulsante della scheda, H con la scheda aperta). */
  private async advanceHint(): Promise<Hint | null> {
    this.resetHintRow();
    const max = this.namingHints() ? 1 : TIERS.length - 1;
    const i = Math.min(max, this.hintMax + 1);
    return this.showHint(TIERS[i] as HintTier);
  }

  /** Suggerimento di un gradino (debug e test: il fantasma senza conferma). */
  async hint(tier: HintTier): Promise<Hint> {
    return this.showHint(tier, true);
  }

  private hintMax = -1;
  private readonly rowHints = new Map<HintTier, Hint>();
  /** Fantasma calcolato in attesa di conferma (D07.3). */
  private pendingGhost: Hint | null = null;
  /** Ultima Spinta letta stanotte (D07.2: una identica si salta). */
  private lastSpinta = '';
  /** Suggerimenti mostrati stanotte: dopo il primo la lampada resta accesa (D07.1). */
  private hintsShown = 0;
  /** Diagnosi delle richieste dell'ultima Spinta (D07.5). */
  diagnosis: Diagnosis | null = null;

  private hintKey(h: Hint): string {
    return `${h.textKey}|${JSON.stringify(h.params ?? {})}`;
  }

  /** Suggerimento sui nomi dell'Archivio (spinta e indizio del livello). */
  private namingHint(tier: HintTier): Hint {
    const keys = this.params.level.hintKeys ?? {};
    if (tier === 'spinta') return { tier, textKey: keys.spinta ?? 'tombolo.hint.archivio.spinta' };
    return { tier: 'indizio', textKey: keys.indizio ?? 'tombolo.hint.archivio.indizio' };
  }

  private async showHint(tier: HintTier, confirmed = false): Promise<Hint> {
    const s = this.session;
    this.resetHintRow();
    let h = this.rowHints.get(tier) ?? null;
    if (!h) {
      if (this.namingHints()) h = this.namingHint(tier);
      else if (tier === 'spinta') {
        const d = await s.diagnose();
        if (this.destroyed) return { tier, textKey: 'tombolo.hint.spinta.generico' };
        this.diagnosis = d;
        if (d) h = this.diagnosisHint(d);
        else {
          h = await s.computeHint('spinta');
          // Una Spinta identica all'ultima già letta stanotte si salta: si va all'Indizio.
          if (this.hintKey(h) === this.lastSpinta && this.hintMax < 0) h = this.rowHints.get('indizio') ?? (await s.computeHint('indizio'));
        }
      } else if (tier === 'fantasma' && this.pendingGhost && confirmed) h = this.pendingGhost;
      else h = await s.computeHint(tier);
      if (this.destroyed) return h;
      // Il fantasma con un incrocio costa il filo d'oro: prima si chiede (D07.3).
      if (h.tier === 'fantasma' && h.ghost && !confirmed && s.goldPossible(this.s.content.balance?.oro?.minIncroci ?? 3)) {
        this.pendingGhost = h;
        this.openGhostConfirm();
        return h;
      }
      if (!this.rowHints.has(h.tier)) {
        if (!this.countedTiers.has(h.tier)) s.useHint(h);
        else if (h.tier === 'fantasma' && h.ghost) s.fantasmaUsed = true;
        this.countedTiers.add(h.tier);
        this.rowHints.set(h.tier, h);
      }
      if (h.tier === 'spinta' && !this.diagnosis) this.lastSpinta = this.hintKey(h);
    }
    this.pendingGhost = null;
    this.hintMax = Math.max(this.hintMax, TIERS.indexOf(h.tier));
    this.hintsShown++;
    this.lastHint = h;
    const o = this.overlay;
    const start = this.params.level.startHour;
    o.hintRow = h.highlight?.hour !== undefined ? h.highlight.hour - start : -1;
    o.hintCol = h.highlight?.column ?? -1;
    o.ghostPair = h.ghost ? h.ghost.pair : -1;
    o.ghostOver = h.ghost?.over ?? 'L';
    o.ghosts = (h as RowHint).ghosts?.map((g) => ({ pair: g.pair, over: g.over })) ?? (h.ghost ? [{ pair: h.ghost.pair, over: h.ghost.over }] : []);
    if (o.hintRow >= 1) this.revealRow(o.hintRow);
    const maxTier = this.namingHints() ? 1 : TIERS.length - 1;
    const next = this.hintMax < maxTier ? (TIERS[this.hintMax + 1] as HintTier) : null;
    const hint = h;
    const leavesOut = h.tier === 'spinta' ? [] : [...s.hintLeavesOut];
    this.openPopup(
      'tb-popup-hint',
      (body) => {
        const card = hintCard({ tier: hint.tier, textKey: hint.textKey, params: nameParams(this.textDeps, hint.params), next }, () => void this.advanceHint());
        if (hint.tier === 'spinta' && this.diagnosis) this.appendDiagnosisActions(card, this.diagnosis);
        if (hint.tier !== 'spinta' && leavesOut.length > 0) this.appendLeavesOut(card, leavesOut);
        const extra = (hint as RowHint).extra ?? [];
        if (extra.length > 0) {
          const st = this.session.state;
          const names = extra.map((c) => this.s.i18n.t('tombolo.hint.coppia', { a: threadName(this.textDeps, st.pos[c.pair] ?? ''), b: threadName(this.textDeps, st.pos[c.pair + 1] ?? '') }));
          const p = textOf('tombolo.hint.sciogli', { elenco: this.joinList(names), n: extra.length }, 'p', { className: 'tb-hint-text' });
          p.dataset.test = 'tb-suggerimento-sciogli';
          card.insertBefore(p, card.querySelector('.tb-hint-text')?.nextSibling ?? null);
        }
        body.appendChild(card);
      },
      // H con la scheda aperta: il gradino successivo (come il pulsante della scheda).
      { hint: () => void this.advanceHint() },
    );
    this.updateUi();
    this.saveNow(false);
    return h;
  }

  /** Testo della Spinta quando le richieste non stanno insieme (D07.5). */
  private diagnosisHint(d: Diagnosis): Hint {
    const who = (id: NoteId): string => {
      const acc = this.params.accepted.find((a) => a.noteId === id);
      const ch = acc ? this.s.content.characters.get(acc.authorGuess ?? acc.author) : undefined;
      return ch ? this.s.i18n.t(ch.nameKey) : id;
    };
    if (d.k === 'tardi') {
      return d.hour === null
        ? { tier: 'spinta', textKey: 'tombolo.hint.tardiSempre', params: { nome: who(d.note) } }
        : { tier: 'spinta', textKey: 'tombolo.hint.tardi', params: { nome: who(d.note), ora: d.hour } };
    }
    if (d.k === 'incompatibili') {
      const names = this.params.accepted.filter((a) => !this.session.dropped.includes(a.noteId)).map((a) => who(a.noteId));
      const richieste = names.length === 2 ? this.s.i18n.t('tombolo.hint.richiesteDue', { a: names[0] ?? '', b: names[1] ?? '' }) : this.s.i18n.t('tombolo.hint.richiesteMolte', { elenco: this.joinList(names) });
      return { tier: 'spinta', textKey: 'tombolo.hint.incompatibili', params: { richieste } };
    }
    return d.hour === null ? { tier: 'spinta', textKey: 'tombolo.hint.impossibile' } : { tier: 'spinta', textKey: 'tombolo.hint.obiettiviTardi', params: { ora: d.hour } };
  }

  /** Nomi degli autori dei bigliettini (come li ha attribuiti il giocatore). */
  private noteAuthor(id: NoteId): string {
    const acc = this.params.accepted.find((a) => a.noteId === id);
    const ch = acc ? this.s.content.characters.get(acc.authorGuess ?? acc.author) : undefined;
    return ch ? this.s.i18n.t(ch.nameKey) : id;
  }

  /** «Vale se lasci cadere la richiesta di …» (Q013): l'Indizio non sceglie in silenzio. */
  private appendLeavesOut(card: HTMLElement, notes: readonly NoteId[]): void {
    const names = notes.map((id) => this.noteAuthor(id));
    const t = this.s.i18n.t.bind(this.s.i18n);
    const richieste = names.length === 1 ? t('tombolo.hint.richiestaUna', { nome: names[0] ?? '' }) : names.length === 2 ? t('tombolo.hint.richiesteDue', { a: names[0] ?? '', b: names[1] ?? '' }) : t('tombolo.hint.richiesteMolte', { elenco: this.joinList(names) });
    const p = textOf('tombolo.hint.seLasci', { richieste }, 'p', { className: 'tb-hint-warn' });
    p.dataset.test = 'tb-suggerimento-selasci';
    const text = card.querySelector('.tb-hint-text');
    if (text && text.nextSibling) card.insertBefore(p, text.nextSibling);
    else card.appendChild(p);
  }

  /** Pulsanti della diagnosi: lascia cadere lo spillo di …, disfa fino alle … */
  private appendDiagnosisActions(card: HTMLElement, d: Diagnosis): void {
    const box = el('div', { class: 'tb-hint-actions' });
    const notes = d.k === 'incompatibili' ? d.notes : d.k === 'tardi' ? [d.note] : [];
    for (const id of notes) {
      const acc = this.params.accepted.find((a) => a.noteId === id);
      const ch = acc ? this.s.content.characters.get(acc.authorGuess ?? acc.author) : undefined;
      const b = button({ labelKey: 'tombolo.hint.lascia', params: { nome: ch ? this.s.i18n.t(ch.nameKey) : id }, kind: 'secondario', icon: 'chiudi', onClick: () => {
        this.popup?.close();
        this.drop(id);
      }, test: `tb-suggerimento-lascia-${id}` });
      box.appendChild(b);
    }
    const hour = d.k === 'incompatibili' ? null : d.hour;
    if (hour !== null && this.session.canRewindTo(hour)) {
      box.appendChild(button({ labelKey: 'tombolo.hint.disfaFino', params: { ora: hour }, kind: 'secondario', icon: 'disfa', onClick: () => {
        this.popup?.close();
        this.rewind(hour);
      }, test: 'tb-suggerimento-riavvolgi' }));
    }
    const next = card.querySelector('[data-test="tb-suggerimento-ancora"]');
    if (next) card.insertBefore(box, next);
    else card.appendChild(box);
  }

  /** Conferma del fantasma quando il filo d'oro è ancora possibile (D07.3). */
  private openGhostConfirm(): void {
    this.openPopup('tb-popup-hint', (body) => {
      const card = el('div', { class: 'tb-hint', test: 'tb-suggerimento', data: { gradino: 'conferma' } });
      card.appendChild(textOf('tombolo.hint.gradino.fantasma', undefined, 'h2', { className: 'tb-hint-tier' }));
      card.appendChild(textOf('tombolo.hint.fantasmaConferma', undefined, 'p', { className: 'tb-hint-text' }));
      card.appendChild(button({ labelKey: 'tombolo.hint.fantasmaSi', kind: 'primario', icon: 'lampada', onClick: () => void this.showHint('fantasma', true), test: 'tb-fantasma-conferma' }));
      card.appendChild(button({ labelKey: 'tombolo.hint.fantasmaNo', kind: 'testo', onClick: () => this.popup?.close(), test: 'tb-fantasma-annulla' }));
      body.appendChild(card);
    });
  }

  // ───────── Archivio ─────────

  name(thread: ThreadId, character: CharacterId | null): NameResult | null {
    const a = this.session.archive;
    if (!a) return null;
    const r = a.name(thread, character);
    const faded = this.params.level.archive?.faded ?? [];
    if (r.confirmed.length > 0) {
      this.visuals = this.makeVisuals();
      this.visualsVersion++;
      this.s.haptics.play('successo');
      this.explain.show('tombolo.archivio.confermati', { n: r.confirmed.length }, 'ok', 3500);
      this.closeReason.hide();
      if (a.allNamed()) this.tutorial.onArchive('nomi');
    } else if (r.waiting) {
      this.explain.show('tombolo.archivio.nonAncora', { n: a.counter().needed }, 'info', 4000);
    } else if (r.moved && character) {
      const ch = this.s.content.characters.get(character);
      this.explain.show('tombolo.archivio.spostato', { nome: ch ? this.s.i18n.t(ch.nameKey) : character, n: faded.indexOf(thread) + 1 }, 'info', 3500);
    }
    this.extraVersion++;
    this.session.version++;
    this.refresh();
    this.saveNow(false);
    return r;
  }

  /**
   * Scelta del nome di un filo sbiadito (D05.4-5). Con il tocco si apre al «click»
   * di compatibilità e non al pointerup (che la farebbe trovare sotto il dito al
   * click), e comunque lontano dal punto toccato; i primi 350 ms la scheda ignora
   * i tocchi (Popup). Dall'elenco dei fili si apre in cima al merletto.
   */
  openNamePicker(t: ThreadId, via?: TapVia): void {
    const a = this.session.archive;
    if (!a || this.completed) return;
    const l = this.layout;
    // Lontano dal dito: un tocco nella metà bassa (fusi, righe in basso) apre in cima.
    const top = via?.y === undefined ? true : via.y > l.lace.y + l.lace.h / 2;
    if (via?.pointer === 'touch' || via?.pointer === 'pen') {
      this.afterCompatClick(() => this.showNamePicker(t, top));
      return;
    }
    this.showNamePicker(t, top);
  }

  /** Esegue `fn` dopo il click di compatibilità di un tocco (o dopo 400 ms se non arriva). */
  private afterCompatClick(fn: () => void): void {
    if (typeof window === 'undefined') {
      fn();
      return;
    }
    let done = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const go = (): void => {
      if (done) return;
      done = true;
      window.removeEventListener('click', onClick, true);
      if (timer) clearTimeout(timer);
      if (!this.destroyed) fn();
    };
    const onClick = (): void => {
      setTimeout(go, 0);
    };
    window.addEventListener('click', onClick, true);
    timer = setTimeout(go, 400);
  }

  private showNamePicker(t: ThreadId, top: boolean): void {
    const a = this.session.archive;
    if (!a) return;
    if (a.isConfirmed(t)) {
      this.openCharCard(t);
      return;
    }
    const faded = this.params.level.archive?.faded ?? [];
    const cands = a.candidates().map((id) => {
      const ch = this.s.content.characters.get(id);
      const holder = a.holderOf(id);
      return {
        id,
        name: ch ? this.s.i18n.t(ch.nameKey) : id,
        icon: ch?.icon ?? 'info',
        color: ch?.color ?? '#8E8676',
        usedOn: holder && holder !== t && !a.isConfirmed(holder) ? this.s.i18n.t('tombolo.archivio.suFilo', { n: faded.indexOf(holder) + 1 }) : null,
        locked: !!holder && holder !== t && a.isConfirmed(holder),
      };
    });
    const pr = a.progress();
    this.openPopup(
      'tb-popup-nomina',
      (body) => {
        body.appendChild(
          namePicker({ thread: t, threadText: threadName(this.textDeps, t), candidates: cands, current: a.tentativeOf(t), given: pr.given, total: pr.total }, (ch) => {
            this.popup?.close();
            this.name(t, ch);
          }),
        );
      },
      undefined,
      top,
    );
  }

  /** Eco di un incrocio: i due nomi del crocevia e la voce di allora (D05.8). */
  private showEcho(key: string, hour: number, pair: number): void {
    if (!this.heard.some((h) => h.hour === hour && h.pair === pair)) this.heard.push({ hour, pair });
    this.archivePanel?.update();
    this.openPopup('tb-popup-eco', (body) => {
      body.appendChild(el('p', { class: 'tb-echo-chi', test: 'tb-eco-chi', text: this.echoNames(hour, pair) }));
      const p = el('p', { class: 'tb-echo', test: 'tb-eco', data: { chiave: key } });
      p.textContent = this.s.i18n.t(key);
      body.appendChild(p);
    });
  }

  /** Eco di un incrocio (debug e test). */
  echo(hour: number, pair: number): string | null {
    if (this.model.echoes.length === 0) return null;
    const key = this.session.archive?.echoAt(hour, pair) ?? null;
    if (key) this.showEcho(key, hour, pair);
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

  /**
   * Slot di un'occasione sotto il punto (TOM-15): il cerchio disegnato al centro
   * della cella (da piantare o già piantato), o null.
   */
  occasionSlotAt(x: number, y: number): { col: number; index: number } | null {
    const l = this.layout;
    if (!this.model || !l) return null;
    const r = Math.max(SLOT_R * (l.scale ?? 1) + 4, Math.min(l.rowH, l.colW) * 0.45);
    let best: { col: number; index: number; d: number } | null = null;
    for (const p of this.model.pins) {
      if (p.kind !== 'verde') continue;
      const c = slotCenter(l, this.scroll, p.col, p.index);
      const d = Math.hypot(x - c.x, y - c.y);
      if (d <= r && (!best || d < best.d)) best = { col: p.col, index: p.index, d };
    }
    return best ? { col: best.col, index: best.index } : null;
  }

  /** La cella (colonna, riga) ammette un'occasione? (senza elenco: tutte). */
  occasionCellAllowed(col: number, index: number): boolean {
    const lv = this.params.level;
    const place = lv.columns[col];
    if (!place) return false;
    if (allowedCells(lv).length === 0) return true;
    return !!allowedAt(lv, place, lv.startHour + index);
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
    this.placing = false;
    this.extraVersion++;
    const lv = this.params.level;
    const kind = !s.done ? null : lv.chiusura === 'nodo' ? 'nodo' : lv.apparizione && lv.apparizione.hour < lv.startHour ? 'apparizione' : null;
    if (kind) {
      this.startEnding(kind);
      this.refresh();
      this.updateStatusLine();
      return this.completed;
    }
    s.complete();
    this.explain.show('tombolo.fine', {}, 'ok', 4000);
    this.refresh();
    this.updateStatusLine();
    return this.completed;
  }

  /**
   * Chiusure speciali (C11, C12), sempre prima di `night:complete`:
   * - nodo (finale C): `tombolo:nodo`, il nodo che si chiude su tutti i fili (800 ms) e il
   *   merletto che si disfa dal basso (1,5 s); niente «Il merletto è chiuso»;
   * - apparizione (g08, g15): `tombolo:apparizione`, in cima un filo nero entra dal bordo
   *   all'ora indicata e incrocia da sopra i fili dell'apertura (2,5 s), poi sfuma.
   * A 1×; con la velocità istantanea tutto subito; con il movimento ridotto una dissolvenza.
   */
  private startEnding(kind: 'nodo' | 'apparizione'): void {
    const lv = this.params.level;
    this.s.bus.emit(kind === 'nodo' ? 'tombolo:nodo' : 'tombolo:apparizione', { levelId: lv.id });
    const sp = this.animSpeed();
    const reduced = this.s.settings.get().reducedMotion;
    const base = kind === 'nodo' ? ENDING_NODO_S : ENDING_APPARIZIONE_S;
    const dur = sp <= 0 ? 0 : (reduced ? ENDING_FADE_S : base) / sp;
    const ap = lv.apparizione;
    const o = this.overlay;
    o.ending = { kind, p: 0, fade: reduced, hour: ap ? String(ap.hour) : '', side: ap?.side === 'molo' ? -1 : 1, passi: ap?.passi ?? 1 };
    this.ending = { kind, t: 0, dur };
    if (kind === 'apparizione' && this.layout) {
      // In cima, con un margine sopra la prima riga per l'ora della notte prima.
      this.manualScroll = true;
      this.scroll = -(this.layout.rowH + 8);
    }
    if (dur <= 0) this.endEnding();
  }

  private ending: { kind: 'nodo' | 'apparizione'; t: number; dur: number } | null = null;

  /** L'animazione di chiusura è in corso (night:complete non è ancora partito). */
  endingRunning(): boolean {
    return this.ending !== null;
  }

  private endEnding(): void {
    const e = this.ending;
    if (!e) return;
    this.ending = null;
    if (this.overlay.ending) this.overlay.ending.p = 1;
    if (e.kind === 'apparizione') {
      this.overlay.ending = null;
      this.explain.show('tombolo.fine', {}, 'ok', 4000);
    }
    this.session.complete();
    this.refresh();
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

  private openPopup(test: string, fill: (body: HTMLElement) => void, keys?: Partial<Record<ActionId, () => void>>, top = false): Popup {
    this.popup?.close();
    const p = new Popup({ input: this.s.input, host: this.root, onClose: () => {
      if (this.popup === p) this.popup = null;
      const pl = this.popupList;
      if (pl && !pl.el.isConnected) {
        this.dropList(pl);
        this.popupList = null;
      }
    } }, keys ? { test, keys } : { test });
    fill(p.body);
    this.popup = p;
    this.popupTop = top;
    p.open(this.popupAnchor(top));
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
            statusText: st ? reportText(this.textDeps, st.report, acc.request) : '',
            condition: capitalizeFirst(describeCondition(this.textDeps, acc.request), this.s.i18n.locale()),
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

  /** Stato del pulsante Obiettivi, o null se non c'è niente da elencare. */
  private goalsButton(): GoalsButtonState | null {
    if (!ObjectivesList.hasItems(this)) return null;
    const count = ObjectivesList.count(this);
    const reports = this.session.goalStatus();
    const order: CondStatus[] = ['fallita', 'a_rischio', 'in_corso', 'soddisfatta'];
    const worst = order.find((st) => reports.some((r) => r.status === st)) ?? (this.session.unreachable().length > 0 ? 'a_rischio' : 'in_corso');
    const done = count?.done ?? 0;
    const total = count?.total ?? 0;
    return { done, total, status: worst, label: this.s.i18n.t('tombolo.obiettivi.pulsante', { fatti: done, totale: total }) };
  }

  /** Elenchi degli obiettivi aperti (popup, pannelli della campagna e dell'Archivio). */
  private readonly objectiveLists = new Set<ObjectivesList>();

  /**
   * Elenco degli obiettivi (C08) per il pannello della campagna: si aggiorna da
   * solo con la notte e si smonta quando la notte finisce (scena chiusa).
   */
  objectivesElement(opts: { compact?: boolean } = {}): HTMLElement {
    const list = new ObjectivesList(this, opts);
    this.objectiveLists.add(list);
    const off = [
      this.s.bus.on('night:row', () => list.update()),
      this.s.bus.on('night:undo', () => list.update()),
      this.s.bus.on('night:cross', () => list.update()),
    ];
    this.listUnsubs.set(list, off);
    return list.el;
  }

  private readonly listUnsubs = new Map<ObjectivesList, Unsub[]>();

  private dropList(list: ObjectivesList): void {
    for (const u of this.listUnsubs.get(list) ?? []) u();
    this.listUnsubs.delete(list);
    this.objectiveLists.delete(list);
  }

  /** Aggiorna gli elenchi aperti (e toglie quelli non più nel documento). */
  private updateLists(): void {
    for (const l of [...this.objectiveLists]) {
      if (!l.el.isConnected && l !== this.popupList) {
        this.dropList(l);
        continue;
      }
      l.update();
    }
  }

  private popupList: ObjectivesList | null = null;

  /** ObjectivesHost: uno spillo dell'ora `hour` sta fuori dalle righe visibili? */
  pinHidden(hour: number): boolean {
    const l = this.layout;
    if (!l) return false;
    const i = hour - this.params.level.startHour;
    const y = rowBottom(l, i) - this.scrollTarget;
    return y < 0 || y > l.lace.h;
  }

  /** ObjectivesHost: il giocatore ha toccato una voce dell'elenco. */
  touched(): void {
    this.tutorial.interacted('obiettivi');
  }

  /** Popup del pulsante Obiettivi (D06): l'elenco completo, con l'ombra se scorre. */
  openGoals(): void {
    this.tutorial.interacted('obiettivi');
    const list = new ObjectivesList(this);
    this.objectiveLists.add(list);
    this.popupList = list;
    this.openPopup('tb-popup-obiettivi', (body) => {
      const wrap = el('div', { class: 'tb-obiettivi-scorre', test: 'tb-obiettivi-scorre' }, list.el);
      const shade = (): void => {
        const more = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight > 2;
        wrap.dataset.ombra = more ? '1' : '0';
        wrap.classList.toggle('tb-ombra-giu', more);
      };
      wrap.addEventListener('scroll', shade, { passive: true });
      body.appendChild(wrap);
      requestAnimationFrame?.(shade);
      shade();
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
    const quirks = ch ? this.quirksOf(ch.id) : [];
    const rancor = this.session.ctx.rancor
      .filter(([a, b]) => a === t || b === t)
      .map(([a, b]) => this.s.i18n.t('tombolo.rancore.coppia', { a: threadName(this.textDeps, a), b: threadName(this.textDeps, b) }));
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
          rancor,
          desireKey: ch && save.knowledge.desires.includes(ch.id) ? (ch.desireKey ?? null) : null,
          memoria: showMem ? memoria : null,
        }),
      );
    });
  }

  openNotebook(): void {
    this.tutorial.interacted('taccuino');
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
    // Nell'Archivio i nomi già confermati restano (D05.6): si riparte con quelli.
    const a = this.session.archive;
    const confirmed = a ? a.confirmedList() : [];
    if (a && confirmed.length > 0) {
      const names: Record<ThreadId, CharacterId> = {};
      for (const t of confirmed) {
        const ch = a.confirmedAs(t);
        if (ch) names[t] = ch;
      }
      p.resume = { levelId: this.params.level.id, rows: [], draft: [], dropped: [], nomeOn: null, hintsUsed: 0, fantasmaUsed: false, archiveNames: names };
    }
    this.clearSaved();
    this.restarted = true;
    void this.s.scenes.go('tombolo', p, { transition: 'none' });
  }

  restarted = false;
  /** Il tutorial «rammendo fatto» è già partito stanotte. */
  private mendAnnounced = false;

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

  /**
   * Nota a margine del tutorial: una alla volta, le altre in coda (D04). Una nota
   * rimasta da un'ora già fissata lascia il posto a quella dell'ora corrente, che
   * deve comparire quando la regola serve (D03: alle 7 del prologo «Chi sta sopra,
   * dà» al primo incrocio, anche se la nota delle 6 non ha ancora fatto i suoi 4 s);
   * con lei se ne vanno le note ancora in coda delle ore passate.
   */
  private showMargin(key: string, hand: MarginHand = 'clotilde'): void {
    const hour = this.session.hour;
    if (this.margin.visible()) {
      if (this.margin.current === key || this.noteQueue.some((q) => q.key === key)) return;
      if (this.noteHour < hour) {
        for (let i = this.noteQueue.length - 1; i >= 0; i--) if ((this.noteQueue[i]?.hour ?? hour) < hour) this.noteQueue.splice(i, 1);
        this.margin.hide();
        this.displayNote(key, hand);
        return;
      }
      this.noteQueue.push({ key, hand, hour });
      return;
    }
    this.displayNote(key, hand);
  }

  private readonly noteQueue: { key: string; hand: MarginHand; hour: number }[] = [];
  /** Ora (della notte) in cui è comparsa la nota visibile. */
  private noteHour = -1;
  private noteAt = -1;
  private noteBand = 0;
  private notePlace: NotePlacement | null = null;

  private displayNote(key: string, hand: MarginHand): void {
    this.margin.show(key, hand);
    this.noteAt = this.time;
    this.noteHour = this.session.hour;
    // Con una nota del tutorial il messaggio in basso non serve (un solo messaggio).
    this.explain.hide();
    this.positionNote();
    try {
      this.s.audio.babble(hand === 'ada' ? 'ada' : 'clotilde', this.s.i18n.t(key));
    } catch {
      /* audio non pronto */
    }
  }

  /** Chiude la nota a margine e mostra la prossima in coda. */
  closeNote(): void {
    if (!this.margin.visible()) return;
    this.margin.hide();
    this.noteAt = -1;
    const next = this.noteQueue.shift();
    if (next) this.displayNote(next.key, next.hand);
    else this.positionNote();
  }

  /** Un'azione valida del giocatore: la nota si chiude se è lì da almeno 4 s (D04). */
  private noteAction(): void {
    if (this.margin.visible() && this.time - this.noteAt >= NOTE_MIN_S) this.closeNote();
  }

  /** Dove sta la nota (D04): pannello di sinistra, sopra le righe fissate, o in una fascia. */
  private positionNote(): void {
    if (!this.layout || !this.model) return;
    if (!this.margin.visible()) {
      this.notePlace = null;
      this.leftBox.style.paddingTop = '';
      if (this.noteBand !== 0) {
        this.noteBand = 0;
        this.resize(this.vp);
      }
      return;
    }
    const lv = this.params.level;
    const base = computeTomboloLayout(this.vp, lv.columns.length, lv.endHour - lv.startHour, { hud: this.hudH });
    const w = base.kind === 'largo' && base.left ? base.left.w - 16 : Math.min(base.center.w - 24, 380);
    const h = this.margin.measure(w);
    const obstacles = this.model.pins.map((p) => p.index);
    // A merletto d'Archivio nominato e rammendato gli incroci degli echi si toccano: la nota non li copre.
    const echoRows = [...new Set(this.model.echoes.map((e) => e.index))];
    const pl = placeMarginNote(base, this.model.current, obstacles, w, h, echoRows);
    this.notePlace = pl;
    if (pl.band !== this.noteBand) {
      this.noteBand = pl.band;
      this.resize(this.vp);
      return;
    }
    this.applyNoteRect();
  }

  private applyNoteRect(): void {
    const pl = this.notePlace;
    const node = this.margin.el;
    if (!pl) return;
    node.style.left = `${pl.rect.x}px`;
    node.style.top = `${pl.rect.y}px`;
    node.style.width = `${pl.rect.w}px`;
    node.style.right = '';
    node.style.maxWidth = '';
    node.dataset.posto = pl.mode;
    // In cima al pannello di sinistra la nota non copre il pannello: il suo contenuto scende.
    this.leftBox.style.paddingTop = pl.mode === 'pannello' ? `${pl.rect.h + 16}px` : '';
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
    this.s.canvas?.canvas?.removeEventListener('pointermove', this.onHover);
    if (typeof window !== 'undefined') window.removeEventListener('keydown', this.onKeyCapture, true);
    this.runner?.stop();
    this.popup?.close();
    this.explain.destroy();
    this.panelLeft?.destroy();
    this.panelRight?.destroy();
    // C08: gli elenchi degli obiettivi montati dalla campagna si smontano con la notte.
    for (const l of [...this.objectiveLists]) {
      this.dropList(l);
      l.el.remove();
    }
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
