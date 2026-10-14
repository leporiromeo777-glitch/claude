/**
 * Scena 'finale' (GDD 6.6, 10.3): epiloghi e titoli di coda.
 *
 * Modi:
 * - 'chiuso': il merletto si annoda da solo; schermo nero, la campana stonata suona
 *   un'ora sbagliata, le vignette del merletto chiuso, poi si torna alla sera di g23
 *   (la scelta) con la voce nuova del Taccuino. Non conta come finale.
 * - 'riprova': il merletto del finale non tiene (obiettivi non soddisfatti): si riprova.
 * - 'epilogo' / 'titoli': le vignette dell'epilogo (filtrate con `when`), poi i titoli di
 *   coda con il carillon dell'intera partita (un battito per giornata).
 * - 'fine': la storia è finita (Telaio, titolo, spartiti della partita).
 * - 'rivedi': un epilogo già visto, dal Telaio.
 */
import type { ActionEvent, EndingId, Playing, Scene, Services, Viewport } from '../core/types';
import { el, clear } from '../core/ui/dom';
import { button, textOf } from '../core/ui/components';
import { controller, type FinaleParams } from './controller';
import { epilogueOf } from './endings';
import { gameScore } from './score';
import { VignettePlayer } from './vignette';
import { animDelay, sceneHost, unloadImages } from './ui';
import type { VignetteView } from './types';

/**
 * Righe dei titoli di coda richieste dal GDD 10.3 che credits.json non ha già («realizzato
 * con strumenti di intelligenza artificiale», la tradizione di Pellestrina e Burano):
 * caratteri e strumenti sono già nelle righe dei contenuti.
 */
export const CREDIT_KEYS = ['campaign.titoli.ia', 'campaign.titoli.ispirato'] as const;

export class FinaleScene implements Scene {
  readonly id = 'finale' as const;
  private root: HTMLElement | null = null;
  private player: VignettePlayer | null = null;
  private carillon: Playing | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private mode: FinaleParams['mode'] = 'fine';
  private ending: EndingId | null = null;
  private step: 'buio' | 'vignette' | 'titoli' | 'fine' | 'riprova' = 'fine';

  constructor(private readonly s: Services) {}

  enter(params?: unknown): void {
    const p = (params ?? {}) as Partial<FinaleParams>;
    const c = controller.state();
    this.mode = p.mode ?? (c?.phase === 'fine' ? 'fine' : 'titoli');
    this.ending = p.ending ?? c?.choice ?? null;
    this.root = el('div', { class: 'cp-scena cp-finale', test: 'cp-finale', data: { modo: this.mode, finale: this.ending ?? '' } });
    sceneHost(this.s).appendChild(this.root);
    controller.sound('finale', this.ending ? this.s.content.campaign.finals[this.ending] : undefined);
    switch (this.mode) {
      case 'chiuso':
        this.darkness();
        break;
      case 'riprova':
        this.retryCard();
        break;
      case 'epilogo':
      case 'titoli':
      case 'rivedi':
        this.epilogue();
        break;
      default:
        this.endCard();
    }
  }

  private epilogueViews(ending: EndingId | null): VignetteView[] {
    const last = controller.lastFinalResult();
    if (last && last.ending === ending && last.epilogue.length > 0) return last.epilogue;
    const c = controller.state();
    if (!ending || !c) return [];
    return epilogueOf(ending, c, controller.knowledge(), this.s.content);
  }

  /** Il merletto chiuso: buio, campana stonata a un'ora sbagliata, poi le vignette. */
  private darkness(): void {
    const root = this.root;
    if (!root) return;
    this.step = 'buio';
    clear(root);
    root.appendChild(el('div', { class: 'cp-buio', test: 'cp-finale-buio' }, textOf('campaign.finale.annodato', undefined, 'p', { className: 'cp-prologo-riga' })));
    try {
      this.s.audio.bell({ hour: 3, stonatura: 1 });
    } catch {
      /* audio non pronto */
    }
    this.timers.push(setTimeout(() => this.playVignettes(this.epilogueViews('chiuso'), () => this.backToChoice()), animDelay(this.s, 2200)));
  }

  private backToChoice(): void {
    void this.s.scenes.go('sera', { cmd: 'continua' });
  }

  private playVignettes(views: VignetteView[], then: () => void): void {
    const root = this.root;
    if (!root) return;
    this.step = 'vignette';
    clear(root);
    this.player?.destroy();
    this.player = new VignettePlayer(this.s, { vignettes: views, onDone: () => then(), test: 'cp-finale-vignetta' });
    root.appendChild(this.player.el);
    this.player.start();
  }

  private epilogue(): void {
    const views = this.epilogueViews(this.ending);
    this.playVignettes(views, () => {
      if (this.mode === 'rivedi') void this.s.scenes.go('telaio', { ritorno: true });
      else this.credits();
    });
  }

  /** Titoli di coda sul carillon dell'intera partita. */
  private credits(): void {
    const root = this.root;
    if (!root) return;
    this.player?.destroy();
    this.player = null;
    this.step = 'titoli';
    clear(root);
    const c = controller.state();
    const db = this.s.content;
    const lines: HTMLElement[] = [];
    if (this.ending) {
      const def = db.endings.get(this.ending);
      const lv = def ? db.levels.get(def.level) : undefined;
      if (lv) lines.push(textOf(lv.titleKey, undefined, 'h1', { className: 'cp-titoli-finale' }));
    }
    lines.push(textOf('campaign.titoli.gioco', undefined, 'h2', { className: 'cp-titoli-gioco' }));
    // Ogni riga una volta sola (il titolo del gioco è anche fra le righe di credits.json).
    const said = new Set<string>([this.s.i18n.t('campaign.titoli.gioco').trim()]);
    const add = (key: string): void => {
      if (!this.s.i18n.has(key)) return;
      const text = this.s.i18n.t(key).trim();
      if (said.has(text)) return;
      said.add(text);
      lines.push(textOf(key, undefined, 'p', { className: 'cp-titoli-riga', rich: true }));
    };
    if (db.credits.authorKey) add(db.credits.authorKey);
    for (const l of db.credits.lines) add(l.key);
    for (const k of CREDIT_KEYS) add(k);
    const scroll = el('div', { class: 'cp-titoli-scorrimento', test: 'cp-titoli' }, ...lines);
    const skip = button({ labelKey: 'campaign.titoli.fine', icon: 'avanti', kind: 'secondario', onClick: () => this.endTitles(), test: 'cp-titoli-fine' });
    root.append(el('div', { class: 'cp-titoli' }, scroll), el('div', { class: 'cp-titoli-barra' }, skip));
    let seconds = 24;
    if (c) {
      try {
        const score = gameScore(c.history, db, Math.max(380, db.balance.anim.beatMs * 2));
        this.carillon = this.s.audio.carillon(score);
        seconds = Math.max(18, Math.min(60, (score.rows.length * score.beatMs) / 1000 + 6));
      } catch {
        this.carillon = null;
      }
    }
    const reduced = this.s.settings.get().reducedMotion || this.s.settings.get().animSpeed === 0;
    scroll.style.setProperty('--cp-titoli-durata', `${reduced ? 0 : seconds}s`);
    if (!reduced) scroll.classList.add('cp-titoli-scorre');
    this.timers.push(setTimeout(() => this.endTitles(), reduced ? animDelay(this.s, 6000) || 6000 : seconds * 1000));
    skip.focus({ preventScroll: true });
  }

  private endTitles(): void {
    if (this.step !== 'titoli') return;
    if (controller.state()?.phase === 'titoli') controller.finishTitles();
    this.endCard();
  }

  /** La storia è finita. */
  private endCard(): void {
    const root = this.root;
    if (!root) return;
    this.step = 'fine';
    this.stopCarillon();
    clear(root);
    const c = controller.state();
    const s = this.s;
    const card = el('article', { class: 'cp-foglio cp-fine core-solid', test: 'cp-finale-fine' }, textOf('campaign.finale.fineTitolo', undefined, 'h1', { className: 'cp-foglio-titolo' }), textOf('campaign.finale.fineTesto', undefined, 'p', { rich: true }));
    const actions = el('footer', { class: 'cp-foglio-azioni' });
    if (c && Object.keys(c.history).length > 0) {
      actions.appendChild(
        button({
          labelKey: 'campaign.finale.spartiti',
          icon: 'copia',
          kind: 'secondario',
          onClick: () => {
            const text = s.content.campaign.days
              .map((d) => c.history[d.id]?.spartito)
              .filter((x): x is string => !!x)
              .join('\n');
            void s.platform.copy(text).then((ok) => s.ui.toast(ok ? 'campaign.finale.spartitiCopiati' : 'campaign.bilancio.spartitoNonCopiato', { spartito: '' }, ok ? 'ok' : 'warn'));
          },
          test: 'cp-finale-spartiti',
        }),
      );
    }
    if (s.scenes.has('telaio')) actions.appendChild(button({ labelKey: 'campaign.finale.telaio', icon: 'gomitolo', kind: 'secondario', onClick: () => void s.scenes.go('telaio'), test: 'cp-finale-telaio' }));
    actions.appendChild(button({ labelKey: 'campaign.finale.titolo', icon: 'avanti', kind: 'primario', onClick: () => void s.scenes.go(s.scenes.has('titolo') ? 'titolo' : 'boot'), test: 'cp-finale-titolo' }));
    card.appendChild(actions);
    root.appendChild(el('div', { class: 'cp-centro-foglio' }, card));
  }

  private retryCard(): void {
    const root = this.root;
    if (!root) return;
    this.step = 'riprova';
    clear(root);
    const card = el(
      'article',
      { class: 'cp-foglio core-solid', test: 'cp-finale-riprova' },
      textOf('campaign.finale.nonTiene', undefined, 'h1', { className: 'cp-foglio-titolo' }),
      textOf('campaign.finale.nonTieneTesto', undefined, 'p', { rich: true }),
      el('footer', { class: 'cp-foglio-azioni' }, button({ labelKey: 'campaign.finale.riprova', icon: 'disfa', kind: 'primario', onClick: () => controller.retryFinal(), test: 'cp-finale-riprova-notte' })),
    );
    root.appendChild(el('div', { class: 'cp-centro-foglio' }, card));
  }

  /** Stato del finale (debug). */
  info(): { mode: string; step: string; ending: EndingId | null } {
    return { mode: this.mode, step: this.step, ending: this.ending };
  }

  skip(): void {
    if (this.step === 'vignette') this.player?.skip();
    else if (this.step === 'titoli') this.endTitles();
  }

  private stopCarillon(): void {
    try {
      this.carillon?.stop();
    } catch {
      /* già fermo */
    }
    this.carillon = null;
  }

  exit(): void {
    for (const t of this.timers.splice(0)) clearTimeout(t);
    this.player?.destroy();
    this.player = null;
    this.stopCarillon();
    this.root?.remove();
    this.root = null;
    unloadImages(this.s.assets);
  }

  resize(_vp: Viewport): void {
    this.player?.draw();
  }

  onAction(a: ActionEvent): boolean {
    if (this.player) return this.player.onAction(a);
    if (this.step === 'titoli' && (a.action === 'skip' || a.action === 'confirm')) {
      this.endTitles();
      return true;
    }
    return false;
  }

  onBack(): boolean {
    if (this.step === 'vignette' || this.step === 'titoli') {
      this.skip();
      return true;
    }
    if (this.step === 'buio') return true;
    void this.s.scenes.go(this.s.scenes.has('titolo') ? 'titolo' : 'boot');
    return true;
  }
}
