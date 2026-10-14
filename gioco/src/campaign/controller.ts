/**
 * Controller della campagna (ARCHITETTURA 5.4): la macchina a stati delle fasi
 * (`flow.ts`) collegata al salvataggio, alle scene, al tombolo e all'audio.
 *
 * - Ogni cambio di fase si salva subito (`save.update(…, { immediate: true })`).
 * - Le notti partono con `scenes.go('tombolo', NightParams)`; "Continua" a metà notte
 *   riapre il tombolo con `resumeParams` (pacchetto tombolo) alla riga salvata.
 * - `night:complete` con origine 'campagna' chiude la giornata (o il finale),
 *   'archivio' aggiorna l'Archivio, 'telaio' aggiorna solo i record.
 * - Le schermate navigano per scena: `scenes.go('sera', { cmd: 'nuova' | 'continua' |
 *   'riprendi', levelId? })` e `scenes.go('telaio')`; la scena 'sera' chiama `prepare()`.
 */
import type {
  AmbienceId,
  BookPageDef,
  CampaignState,
  CharacterId,
  EndingId,
  Knowledge,
  LevelId,
  MusicState,
  NightOutcome,
  NightParams,
  SaveData,
  SceneId,
  Services,
} from '../core/types';
import { services } from '../core/services';
import { defaultKnowledge } from '../core/save/defaults';
import { activeNight, resumeParams } from '../tombolo/index';
import * as flow from './flow';
import { rewindTo } from './rewind';
import { refreshDiary } from './diary';
import { precomputedRows, simulateNight } from './simulate';
import { campaignDays, campaignNightParams, dayIndexOf } from './evening';
import type { ArchiveResult, FinalResult } from './flow';
import type { CampaignStateX, DayReport } from './types';
import { animDelay, charName, isWide } from './ui';
import { plainText } from '../core/ui/richtext';
import { clearNightBars, showNightBar, showNightNotice } from './nightbar';
import { newBookPages } from './diary';

export interface CampaignController {
  newGame(): Promise<void>;
  continueGame(): Promise<void>;
  resumeFrom(levelId: LevelId): Promise<void>;
  replay(levelId: LevelId): Promise<void>;
  state(): CampaignState | null;
  knowledge(): Knowledge;
}

export type SeraCommand = { cmd?: 'nuova' | 'continua' | 'riprendi'; levelId?: LevelId; confirmed?: boolean };

/** Dove va il gioco per la fase corrente: una scena, o una notte da (ri)aprire. */
export type Route = { scene: SceneId; params?: unknown } | { night: NightParams };

/** Parametri delle scene della campagna. */
export interface FinaleParams {
  mode: 'chiuso' | 'riprova' | 'epilogo' | 'titoli' | 'fine' | 'rivedi';
  ending?: EndingId | null;
}
export interface ArchivioParams {
  result?: ArchiveResult;
  browse?: boolean;
  back?: SceneId;
  /** «Lascia per ora» dalla Pausa di una notte d'Archivio (C10). */
  cmd?: 'lascia';
  levelId?: LevelId;
}
export interface BilancioParams {
  telaio?: { levelId: LevelId; metrics: NightOutcome['metrics']; record: ReturnType<typeof flow.completeReplay>; spartito: string; rows: NightOutcome['rows'] };
}

const NIGHT_TO_DAWN_MS = 1600;

type Listener = () => void;

export class CampaignControllerImpl implements CampaignController {
  private listeners = new Set<Listener>();
  private installed = false;
  /** Durante finishDay del debug la navigazione la decide chi chiama. */
  private suppressNav = 0;
  private lastFinal: FinalResult | null = null;
  private lastArchive: ArchiveResult | null = null;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  /** Avvisi del Taccuino tenuti da parte durante l'alba (D11): escono dopo l'ultima vignetta. */
  private held: { key: string; params?: Record<string, string | number> }[] = [];
  /** Avvisi appena mostrati (per toglierli se l'alba arriva mentre sono ancora sullo schermo). */
  private recent: { key: string; params?: Record<string, string | number>; at: number }[] = [];

  constructor(private readonly svc: () => Services = () => services) {}

  private get s(): Services {
    return this.svc();
  }

  // ───────── Stato ─────────

  data(): SaveData {
    return this.s.save.data();
  }

  state(): CampaignStateX | null {
    return (this.data().campaign as CampaignStateX | null) ?? null;
  }

  knowledge(): Knowledge {
    return this.data().knowledge ?? defaultKnowledge();
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private changed(): void {
    for (const fn of [...this.listeners]) {
      try {
        fn();
      } catch (err) {
        console.error('[campaign] listener failed', err);
      }
    }
  }

  /** Modifica il salvataggio (subito su disco) e avvisa le scene. */
  mutate<T>(fn: (d: SaveData) => T, reason = 'campagna', immediate = true): T {
    let out!: T;
    let err: unknown = null;
    this.s.save.update(
      (d) => {
        try {
          out = fn(d);
        } catch (e) {
          err = e;
        }
      },
      { immediate, reason },
    );
    if (err) throw err;
    this.changed();
    return out;
  }

  /** Emette 'diary:new' per le voci nuove (il pacchetto audio suona la pagina). */
  announceDiary(ids: readonly string[]): void {
    for (const id of ids) this.s.bus.emit('diary:new', { id });
  }

  // ───────── Ascolto del bus ─────────

  install(): void {
    if (this.installed) return;
    this.installed = true;
    const bus = this.s.bus;
    bus.on('scene:enter', ({ id }) => {
      if (this.pendingNav?.scene === id) this.pendingNav = null;
      try {
        if (id === 'tombolo') this.nightStarted();
        else if (id !== 'alba') this.flushNotices();
      } catch (err) {
        console.error('[campaign] scene:enter failed', err);
      }
    });
    bus.on('night:complete', ({ outcome }) => {
      try {
        this.onNightComplete(outcome);
      } catch (err) {
        console.error('[campaign] night:complete failed', err);
      }
    });
    bus.on('night:exit', ({ origin }) => {
      try {
        this.onNightExit(origin);
      } catch (err) {
        console.error('[campaign] night:exit failed', err);
      }
    });
    bus.on('quirk:discovered', ({ quirk }) => {
      try {
        // Il Taccuino è la conoscenza della storia: le stranezze viste nel Merletto del
        // giorno o in quello libero non entrano (svelerebbero personaggi non ancora incontrati).
        // (Una notte ripresa riemette le scoperte mentre si costruisce, prima di essere attiva.)
        const origin = activeNight()?.params.origin ?? this.data().night?.origin;
        if (origin && !(flow.CAMPAIGN_ORIGINS as readonly string[]).includes(origin)) return;
        const k = this.knowledge();
        if (k.quirks.includes(quirk) && !this.state()) return;
        let fresh: string[] = [];
        this.mutate((d) => {
          if (!d.knowledge.quirks.includes(quirk)) d.knowledge.quirks.push(quirk);
          if (d.campaign) fresh = refreshDiary(d.campaign, d.knowledge, this.s.content);
        }, 'stranezza', false);
        this.announceDiary(fresh);
        // Il Taccuino "si apre un attimo" (GDD 9): la voce nuova in un avviso. Se la notte
        // è appena finita l'avviso aspetta la fine dell'alba (D11): non copre le vignette.
        const first = fresh.map((id) => this.s.content.diary.get(id)).find((x) => !!x);
        if (first) setTimeout(() => this.notice(first.textKey), 0);
      } catch (err) {
        console.error('[campaign] quirk:discovered failed', err);
      }
    });
  }

  private onNightComplete(outcome: NightOutcome): void {
    const c = this.state();
    if (outcome.origin === 'campagna') {
      if (!c || outcome.levelId !== c.levelId) return;
      if (c.phase === 'notte') this.closeDay(outcome);
      else if (c.phase === 'finale') this.closeFinal(outcome);
    } else if (outcome.origin === 'archivio' && activeNight()?.params.mode === 'replay') {
      // «Rileggi»: il merletto rammendato resta da guardare (e da toccare negli echi);
      // nessun record e nessun cambio d'Archivio. Si torna alla cassapanca col pulsante.
      this.afterNight(outcome, () => {
        showNightBar(this.s, { labelKey: 'campaign.archivio.allaCassapanca', icon: 'libro', test: 'cp-rileggi-chiudi', onClick: () => this.nav('archivio', { browse: true } satisfies ArchivioParams) });
      }, 0);
    } else if (outcome.origin === 'archivio') {
      const r = this.mutate((d) => flow.completeArchive(d, this.s.content, outcome), 'archivio');
      this.lastArchive = r;
      this.announceDiary(r.newDiary);
      this.afterNight(outcome, () => this.go({ scene: 'archivio', params: { result: r } satisfies ArchivioParams }), 0);
    } else if (outcome.origin === 'telaio') {
      const rec = this.mutate((d) => flow.completeReplay(d, outcome), 'telaio');
      const params: BilancioParams = { telaio: { levelId: outcome.levelId, metrics: outcome.metrics, record: rec, spartito: outcome.spartito, rows: outcome.rows } };
      this.afterNight(outcome, () => this.go({ scene: 'bilancio', params }));
    }
  }

  /**
   * Il giocatore lascia una notte a metà (Pausa → Torna al titolo). Le notti della storia
   * restano salvate e "Continua" le riprende; una notte facoltativa (Rigioca o Ripassa dal
   * Telaio, un merletto d'Archivio aperto dalla cassapanca fuori dalla fase d'Archivio)
   * lasciata così si abbandona: altrimenti "Continua" la riaprirebbe ogni volta al posto
   * della storia. Se l'app viene chiusa senza uscire dalla notte, si riprende anche quella.
   */
  private onNightExit(origin: NightParams['origin']): void {
    const phase = this.state()?.phase;
    const optional = origin === 'telaio' || (origin === 'archivio' && phase !== 'archivio');
    if (!optional || this.data().night?.origin !== origin) return;
    this.s.save.update(
      (d) => {
        if (d.night?.origin === origin) d.night = null;
      },
      { immediate: true, reason: 'notte lasciata' },
    );
  }

  private closeDay(outcome: NightOutcome): DayReport {
    const report = this.mutate((d) => flow.completeDay(d, this.s.content, outcome), 'giornata');
    this.announceDiary(report.newDiary);
    this.afterNight(outcome, () => this.go({ scene: 'alba' }));
    return report;
  }

  /**
   * Fine della notte di un finale (D14, C11). Il merletto chiuso (C) passa subito al
   * cartello nero (il tombolo ha già mostrato il nodo); negli altri finali il merletto
   * finito resta sullo schermo con «Continua» (`cp-finale-continua`).
   */
  private closeFinal(outcome: NightOutcome): FinalResult {
    const r = this.mutate((d) => flow.completeFinal(d, this.s.content, outcome), 'finale');
    this.lastFinal = r;
    this.announceDiary(r.newDiary);
    const toFinale = (): void => this.go({ scene: 'finale', params: { mode: r.kind, ending: r.ending } satisfies FinaleParams });
    if (r.kind === 'chiuso') this.afterNight(outcome, toFinale, 0);
    else if (r.kind === 'epilogo') this.afterNight(outcome, () => void showNightBar(this.s, { labelKey: 'campaign.finale.continua', test: 'cp-finale-continua', onClick: toFinale }), 0);
    else this.afterNight(outcome, toFinale, NIGHT_TO_DAWN_MS);
    return r;
  }

  // ───────── Avvisi ─────────

  /** Un avviso del Taccuino: subito, oppure dopo l'alba se la notte è appena finita. */
  notice(key: string, params?: Record<string, string | number>): void {
    const night = activeNight();
    const ending = !!night && (!!night.completed || !!(night.session as { done?: boolean }).done);
    const scene = this.s.scenes.current();
    if (scene === 'alba' || (scene === 'tombolo' && ending && night?.params.origin === 'campagna')) {
      this.held.push(params ? { key, params } : { key });
      return;
    }
    this.s.ui.toast(key, params, 'info');
    this.recent.push(params ? { key, params, at: Date.now() } : { key, at: Date.now() });
    if (this.recent.length > 6) this.recent.shift();
  }

  /**
   * L'alba comincia: gli avvisi della campagna ancora sullo schermo (una stranezza scoperta
   * nelle ultime righe) si tolgono e tornano dopo l'ultima vignetta (D11).
   */
  deferRecentNotices(ms = 3500): void {
    const now = Date.now();
    const keep = this.recent.filter((n) => now - n.at < ms);
    this.recent = [];
    if (keep.length === 0) return;
    for (const n of keep) this.held.push(n.params ? { key: n.key, params: n.params } : { key: n.key });
    const norm = (x: string): string => x.replace(/\s+/g, ' ').trim();
    const texts = new Set(keep.map((n) => norm(plainText(this.s.i18n.t(n.key, n.params), (id) => charName(this.s, id)))));
    for (const t of this.s.ui.root.querySelectorAll<HTMLElement>('.core-toast')) if (texts.has(norm(t.textContent ?? ''))) t.remove();
  }

  /** Mostra gli avvisi tenuti da parte (alla fine dell'alba o fuori dal tombolo). */
  flushNotices(): void {
    const list = this.held.splice(0);
    for (const n of list) this.s.ui.toast(n.key, n.params, 'info');
  }

  /**
   * Inizio di una notte: l'avviso «Nuova pagina nel Libro» della regola nuova (D03). Nel
   * layout largo il Taccuino fisso si apre già su quella pagina: niente avviso.
   */
  private nightStarted(): void {
    const night = activeNight();
    if (!night || night.params.origin !== 'campagna' || isWide(this.s)) return;
    const page = nightRulePage(this.s, this.state(), this.knowledge());
    if (!page) return;
    showNightNotice(this.s, {
      textKey: 'campaign.taccuino.paginaNuova',
      params: { titolo: this.s.i18n.t(page.titleKey) },
      test: 'cp-libro-avviso',
      onClick: () => void this.s.ui.openOverlay('taccuino', { from: 'tombolo', tab: 'libro', page: page.id, levelId: night.params.level.id, origin: night.params.origin }),
    });
  }

  /** Annulla il passaggio automatico dopo la notte (quando qualcun altro decide dove andare). */
  cancelPending(): void {
    if (this.pendingTimer) clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
    clearNightBars();
  }

  /** Stato della navigazione (debug). */
  navInfo(): { suppressNav: number; pending: boolean } {
    return { suppressNav: this.suppressNav, pending: this.pendingTimer !== null };
  }

  lastFinalResult(): FinalResult | null {
    return this.lastFinal;
  }

  lastArchiveResult(): ArchiveResult | null {
    return this.lastArchive;
  }

  /** Dopo la notte: un momento per guardare il merletto chiuso, poi la scena dopo. */
  private afterNight(outcome: NightOutcome, then: () => void, ms = NIGHT_TO_DAWN_MS): void {
    if (this.suppressNav > 0) return;
    if (this.pendingTimer) clearTimeout(this.pendingTimer);
    const run = (): void => {
      this.pendingTimer = null;
      const still = this.s.scenes.current() === 'tombolo' && activeNight()?.completed?.levelId === outcome.levelId;
      if (still) then();
    };
    // Anche senza attesa si passa al turno dopo: il tombolo segna la notte come
    // completata subito dopo aver emesso night:complete.
    this.pendingTimer = setTimeout(run, Math.max(0, animDelay(this.s, ms)));
  }

  // ───────── Navigazione ─────────

  go(r: Route): void {
    if ('night' in r) {
      this.startNightScene(r.night);
      return;
    }
    this.nav(r.scene, r.params);
  }

  /**
   * Cambio di scena senza doppioni: se c'è già un cambio verso la stessa scena in fila
   * (per esempio la sera che, entrando, trova la notte già avviata), non se ne accoda
   * un secondo. Il segno si toglie quando la scena entra (o dopo 5 s).
   */
  nav(scene: SceneId, params?: unknown): void {
    const now = Date.now();
    if (this.pendingNav && this.pendingNav.scene === scene && now - this.pendingNav.at < 5000) return;
    this.pendingNav = { scene, at: now };
    void this.s.scenes.go(scene, params);
  }

  private pendingNav: { scene: SceneId; at: number } | null = null;

  /** Apre il tombolo con i parametri della notte (musica e ambiente della notte). */
  startNightScene(p: NightParams): void {
    this.sound(p.origin === 'archivio' ? 'archivio' : 'notte', p.level.id);
    this.nav('tombolo', p);
  }

  /** Musica e ambiente per una fase. */
  sound(kind: 'sera' | 'notte' | 'alba' | 'bilancio' | 'archivio' | 'finale', levelId?: LevelId): void {
    const s = this.s;
    const id = levelId ?? this.state()?.levelId ?? '';
    const level = s.content.levels.get(id);
    const notes: (CharacterId | 'lino')[] = [];
    for (const t of level?.threads ?? []) {
      const w: CharacterId | 'lino' = t.kind === 'lino' || !t.character ? 'lino' : t.character;
      if (!notes.includes(w)) notes.push(w);
    }
    const act = level?.act ?? 1;
    const storm = id === 'g15';
    let music: MusicState = 'sera';
    let amb: AmbienceId = 'notte';
    switch (kind) {
      case 'sera':
        music = 'sera';
        amb = storm ? 'vento' : act === 2 ? 'pioggia' : 'notte';
        break;
      case 'notte':
        music = 'notte';
        amb = storm ? 'tempesta' : act === 2 ? 'pioggia' : 'notte';
        break;
      case 'alba':
      case 'bilancio':
        music = 'alba';
        amb = storm ? 'tempesta' : act === 2 ? 'pioggia' : 'laguna';
        break;
      case 'archivio':
        music = 'archivio';
        amb = 'notte';
        break;
      case 'finale':
        music = 'finale';
        amb = 'laguna';
        break;
    }
    try {
      s.audio.setMusic(music, { seed: level?.musicSeed ?? id, notes });
      s.audio.setAmbience(amb);
    } catch {
      /* audio non pronto */
    }
  }

  /** Dove si va per la fase corrente (null senza storia). */
  async route(): Promise<Route | null> {
    const c = this.state();
    if (!c) return null;
    const db = this.s.content;
    const saved = this.data().night;
    const resumeIf = async (origins: string[]): Promise<NightParams | null> => {
      if (!saved || !origins.includes(saved.origin)) return null;
      const p = await resumeParams(this.s);
      return p && origins.includes(p.origin) ? p : null;
    };
    switch (c.phase) {
      case 'sera':
      case 'scelta':
        return { scene: 'sera' };
      case 'notte': {
        const p = await resumeIf(['campagna']);
        if (p && p.level.id === c.levelId) return { night: p };
        return { night: campaignNightParams(c, flow.levelOf(db, c.levelId), db) };
      }
      case 'alba':
        return { scene: 'alba' };
      case 'bilancio':
        return { scene: 'bilancio' };
      case 'archivio': {
        const p = await resumeIf(['archivio']);
        if (p) return { night: p };
        return { scene: 'archivio' };
      }
      case 'finale': {
        const p = await resumeIf(['campagna']);
        if (p && p.level.id === c.levelId) return { night: p };
        return { night: flow.finalParams(this.data(), db) };
      }
      case 'titoli':
        return { scene: 'finale', params: { mode: 'titoli', ending: c.choice ?? null } satisfies FinaleParams };
      case 'fine':
        return { scene: 'finale', params: { mode: 'fine', ending: c.choice ?? null } satisfies FinaleParams };
    }
    return { scene: 'sera' };
  }

  /**
   * Una notte del Telaio, o un merletto d'Archivio aperto dalla cassapanca durante la
   * sera, rimasti a metà hanno la precedenza su "Continua" (si riprendono alla stessa riga).
   */
  private async savedSideNight(): Promise<NightParams | null> {
    const saved = this.data().night;
    if (!saved || (saved.origin !== 'telaio' && saved.origin !== 'archivio')) return null;
    const p = await resumeParams(this.s);
    return p && (p.origin === 'telaio' || p.origin === 'archivio') ? p : null;
  }

  /**
   * Comando ricevuto dalla scena 'sera'. Restituisce la rotta: se è la sera stessa la
   * scena si mostra, altrimenti naviga.
   */
  async prepare(cmd: SeraCommand): Promise<Route | null> {
    if (cmd.cmd === 'nuova') {
      this.mutate((d) => flow.newCampaign(d, this.s.content), 'nuova');
      return { scene: 'sera' };
    }
    if (cmd.cmd === 'riprendi' && cmd.levelId) {
      const ok = this.mutate((d) => rewindTo(d, this.s.content, cmd.levelId as LevelId), 'riprendi');
      if (!ok) return this.route();
      return { scene: 'sera' };
    }
    if (cmd.cmd === 'continua') {
      const side = await this.savedSideNight();
      if (side) return { night: side };
    }
    return this.route();
  }

  // ───────── API (ARCHITETTURA 5.4) ─────────

  async newGame(): Promise<void> {
    this.mutate((d) => flow.newCampaign(d, this.s.content), 'nuova');
    this.go({ scene: 'sera' });
  }

  async continueGame(): Promise<void> {
    const side = await this.savedSideNight();
    if (side) {
      this.startNightScene(side);
      return;
    }
    const r = await this.route();
    if (r) this.go(r);
    else this.nav(this.s.scenes.has('titolo') ? 'titolo' : 'boot');
  }

  async resumeFrom(levelId: LevelId): Promise<void> {
    const ok = this.mutate((d) => rewindTo(d, this.s.content, levelId), 'riprendi');
    if (ok) this.go({ scene: 'sera' });
  }

  async replay(levelId: LevelId): Promise<void> {
    const p = flow.replayParams(this.data(), this.s.content, levelId);
    this.startNightScene(p);
  }

  // ───────── Azioni della sera e delle fasi (usate dalle scene e dal debug) ─────────

  /** Al tombolo: i bigliettini non appuntati restano lasciati. */
  toNight(): NightParams {
    const p = this.mutate((d) => flow.startNight(d, this.s.content), 'notte');
    this.startNightScene(p);
    return p;
  }

  /** Ripassa: la soluzione già trovata si ritesse da sola. */
  ripassa(): NightParams | null {
    const p = this.mutate((d) => flow.ripassaParams(d, this.s.content), 'ripassa');
    if (p) this.startNightScene(p);
    return p;
  }

  objectSeen(): string[] {
    const fresh = this.mutate((d) => flow.markObjectSeen(d, this.s.content), 'oggetto');
    this.announceDiary(fresh);
    return fresh;
  }

  /** L'oggetto consegnato all'alba è stato letto (C03, C04): voci nuove annunciate lì. */
  dawnObjectSeen(): string[] {
    const fresh = this.mutate((d) => flow.readDawnObject(d, this.s.content), 'oggetto');
    this.announceDiary(fresh);
    return fresh;
  }

  /** Dall'alba al bilancio. */
  toBilancio(): void {
    const fresh = this.mutate((d) => flow.finishDawn(d, this.s.content), 'bilancio');
    this.announceDiary(fresh);
    this.go({ scene: 'bilancio' });
  }

  /** Dal bilancio alla fase dopo (scelta, Archivio, sera). */
  afterBilancio(): void {
    const next = this.mutate((d) => flow.finishBilancio(d, this.s.content), 'sera');
    this.go({ scene: next === 'archivio' ? 'archivio' : 'sera' });
  }

  /** Chiude la fase d'Archivio e passa alla sera dopo. */
  afterArchive(): void {
    this.mutate((d) => flow.finishArchivePhase(d, this.s.content), 'sera');
    this.go({ scene: 'sera' });
  }

  /** Apre un merletto d'Archivio nel tombolo. */
  openArchive(id: LevelId): NightParams {
    const p = this.mutate((d) => flow.archiveParams(d, this.s.content, id), 'archivio');
    this.mutate((d) => {
      const c = d.campaign as CampaignStateX | null;
      if (c && c.phase === 'archivio') c.archiveOpen = id;
    });
    this.sound('archivio', id);
    this.nav('tombolo', p);
    return p;
  }

  /** «Rileggi» un merletto rammendato: in sola lettura, si ritesse da solo (CAM-01). */
  rereadArchive(id: LevelId): NightParams {
    const p = flow.rereadParams(this.s.content, id);
    this.sound('archivio', id);
    this.nav('tombolo', p);
    return p;
  }

  /** «Lascia per ora» (C10): la notte d'Archivio salvata si toglie, l'Archivio resta com'era. */
  leaveArchive(levelId: LevelId): boolean {
    let left = false;
    this.s.save.update(
      (d) => {
        left = flow.leaveArchiveNight(d, levelId);
      },
      { immediate: true, reason: 'archivio lasciato' },
    );
    this.changed();
    return left;
  }

  /** Sceglie un finale (sera di g23) e apre la sua notte. */
  choose(ending: EndingId): flow.ChoiceResult {
    const r = this.mutate((d) => flow.choose(d, this.s.content, ending), 'scelta');
    if (r.ok) this.startNightScene(flow.finalParams(this.data(), this.s.content));
    return r;
  }

  /** Riapre la notte del finale (dopo un merletto che non tiene). */
  retryFinal(): void {
    const c = this.state();
    if (!c || c.phase !== 'finale') return;
    this.startNightScene(flow.finalParams(this.data(), this.s.content));
  }

  /** Titoli di coda finiti. */
  finishTitles(): void {
    this.mutate((d) => flow.finishTitles(d), 'fine');
  }

  // ───────── Debug ─────────

  /** Notte simulata con la soluzione precalcolata (senza il tombolo). */
  simulateCurrentNight(): NightOutcome | null {
    const d = this.data();
    const p = flow.currentNightParams(d, this.s.content);
    if (!p) return null;
    const computed = this.s.content.computed.get(p.level.id) ?? null;
    const rows = precomputedRows(computed, p.accepted.map((a) => a.noteId)) ?? [];
    return simulateNight(p, rows, computed, this.s.content.balance) ?? simulateNight(p, computed?.base.rows ?? [], computed, this.s.content.balance);
  }

  /**
   * Chiude la giornata in corso fino alla sera dopo (debug): dalla sera va alla notte,
   * gioca la notte (autoplay del tombolo se è aperto, altrimenti la soluzione
   * precalcolata), salta alba, bilancio e Archivio.
   */
  async finishDay(): Promise<CampaignStateX | null> {
    const c0 = this.state();
    if (!c0) return null;
    this.cancelPending();
    this.suppressNav++;
    try {
      if (c0.phase === 'sera') this.mutate((d) => flow.startNight(d, this.s.content), 'notte');
      let c = this.state();
      if (c && (c.phase === 'notte' || c.phase === 'finale')) {
        const night = activeNight();
        let done = false;
        if (night && night.params.origin === 'campagna' && night.params.level.id === c.levelId && !night.completed) {
          await night.autoplay();
          done = this.state()?.phase !== c.phase;
        }
        if (!done) {
          const o = this.simulateCurrentNight();
          if (!o) throw new Error('campaign: night could not be simulated');
          this.onNightComplete({ ...o, origin: 'campagna' });
        }
      }
      c = this.state();
      if (c?.phase === 'alba') this.announceDiary(this.mutate((d) => flow.finishDawn(d, this.s.content), 'bilancio'));
      c = this.state();
      if (c?.phase === 'bilancio') this.mutate((d) => flow.finishBilancio(d, this.s.content), 'sera');
      c = this.state();
      if (c?.phase === 'archivio') this.mutate((d) => flow.finishArchivePhase(d, this.s.content), 'sera');
    } finally {
      this.suppressNav--;
    }
    const r = await this.route();
    if (r) this.go(r);
    return this.state();
  }

  /** Salta direttamente a una giornata e a una fase (debug). */
  async goto(levelId: LevelId, phase: string = 'sera'): Promise<CampaignStateX | null> {
    const db = this.s.content;
    this.cancelPending();
    if (!this.state()) this.mutate((d) => flow.newCampaign(d, db), 'nuova');
    const level = db.levels.get(levelId);
    if (!level) throw new Error(`campaign: unknown level ${levelId}`);
    if (level.archive) {
      this.mutate((d) => {
        const c = flow.camp(d);
        if (d.knowledge.archive[levelId] === undefined) d.knowledge.archive[levelId] = 'nuovo';
        if (phase === 'archivio') {
          c.phase = 'archivio';
          c.archiveOpen = levelId;
        }
      });
      if (phase === 'notte') this.openArchive(levelId);
      else this.go({ scene: 'archivio', params: { browse: phase !== 'archivio' } satisfies ArchivioParams });
      return this.state();
    }
    const ending = Object.entries(db.campaign.finals).find(([, id]) => id === levelId)?.[0] as EndingId | undefined;
    if (ending) {
      this.mutate((d) => {
        const c = flow.camp(d);
        c.dayIndex = dayIndexOf(db, db.campaign.choiceDay);
        flow.beginChoice(d, db, true);
        c.choice = ending;
        c.phase = 'finale';
        c.levelId = levelId;
      });
      this.startNightScene(flow.finalParams(this.data(), db));
      return this.state();
    }
    const idx = dayIndexOf(db, levelId);
    if (idx < 0) throw new Error(`campaign: ${levelId} is not a campaign day`);
    this.mutate((d) => {
      const c = flow.camp(d);
      c.dayIndex = idx;
      flow.beginEvening(d, db);
      if (phase === 'scelta' && levelId === db.campaign.choiceDay) flow.beginChoice(d, db);
    });
    if (phase === 'notte') {
      this.toNight();
    } else if (phase === 'alba' || phase === 'bilancio') {
      this.suppressNav++;
      try {
        this.mutate((d) => flow.startNight(d, db), 'notte');
        const o = this.simulateCurrentNight();
        if (o) this.onNightComplete({ ...o, origin: 'campagna' });
        if (phase === 'bilancio') this.mutate((d) => flow.finishDawn(d, db));
      } finally {
        this.suppressNav--;
      }
      this.go({ scene: phase });
    } else {
      this.go({ scene: 'sera' });
    }
    return this.state();
  }

  /** Giornate della campagna (per il Telaio). */
  days(): ReturnType<typeof campaignDays> {
    return campaignDays(this.s.content);
  }
}

/**
 * Pagina del Libro della regola nuova di stanotte (D03): non ancora vista, di una regola
 * che nella storia compare per la prima volta in questa giornata. Null se non c'è (o se
 * Ada non ha ancora il Libro dei Punti).
 */
export function nightRulePage(s: Services, c: CampaignStateX | null, k: Knowledge): BookPageDef | null {
  const night = activeNight();
  if (!c || !night || night.params.origin !== 'campagna' || !k.objects.includes('libro_punti')) return null;
  const days = s.content.campaign.days;
  const idx = days.findIndex((d) => d.id === night.params.level.id);
  if (idx < 0) return null;
  const before = new Set<string>();
  for (const d of days.slice(0, idx)) for (const r of s.content.levels.get(d.id)?.rules ?? []) before.add(r);
  const fresh = new Set<string>(night.params.level.rules.filter((r) => !before.has(r)));
  return newBookPages(c, k, s.content).find((p) => fresh.has(p.rule)) ?? null;
}

export const controller = new CampaignControllerImpl();

/** Il controller della campagna (ARCHITETTURA 5.4). */
export const campaign: CampaignController = controller;
