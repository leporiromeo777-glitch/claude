/**
 * Base delle schermate di menu ('giornaliero', 'libero', 'impostazioni',
 * 'crediti'): DOM in `sceneRoot`, fondo di velluto sul canvas (ridisegnato solo
 * quando serve), Indietro/Esc → titolo, frecce e Invio senza fuoco → il fuoco va
 * al primo pulsante (poi lavora il browser), ricostruzione al cambio di lingua
 * (i testi con parametri già tradotti si rifanno).
 */
import type { ActionEvent, CanvasHost, Scene, SceneId, Services, Unsub, Viewport } from '../core/types';
import { Backdrop, type BackdropOptions } from './backdrop';
import { sceneRoot } from './widgets';

export abstract class ScreenScene implements Scene {
  abstract readonly id: SceneId;
  protected root: HTMLElement | null = null;
  protected readonly offs: Unsub[] = [];
  protected readonly backdrop: Backdrop;
  /** Ricostruire tutto al cambio di lingua (false se i testi si ritraducono da soli). */
  protected rebuildOnLocale = true;
  private locale = '';
  private entered = false;

  constructor(
    protected readonly s: Services,
    backdrop: BackdropOptions = { glow: { x: 0.12, y: 0.05, r: 0.7, alpha: 0.12 } },
  ) {
    this.backdrop = new Backdrop(backdrop);
  }

  /** Costruisce il DOM della schermata (radice). */
  protected abstract build(): HTMLElement;

  /** Dopo il primo montaggio (musica, lavori in background). */
  protected afterEnter(_params: unknown): void {
    /* facoltativo */
  }

  /** Pulizia propria della schermata. */
  protected beforeExit(): void {
    /* facoltativo */
  }

  enter(params?: unknown): void {
    this.entered = true;
    this.locale = this.s.i18n.locale();
    this.mount(true);
    this.offs.push(
      this.s.bus.on('settings:change', (st) => {
        this.backdrop.invalidate();
        if (st.locale !== this.locale) {
          this.locale = st.locale;
          if (this.rebuildOnLocale) this.mount(false);
        }
      }),
    );
    this.afterEnter(params);
  }

  /** (Ri)monta il DOM, conservando il fuoco sull'elemento con lo stesso data-test. */
  protected mount(first: boolean): void {
    if (!this.entered) return;
    const active = document.activeElement as HTMLElement | null;
    const focusTest = !first && active && this.root?.contains(active) ? active.dataset.test ?? null : null;
    const scroll = this.root?.querySelector<HTMLElement>('.sc-foglio')?.scrollTop ?? 0;
    this.root?.remove();
    this.root = this.build();
    sceneRoot(this.s).appendChild(this.root);
    const sheet = this.root.querySelector<HTMLElement>('.sc-foglio');
    if (sheet && !first) sheet.scrollTop = scroll;
    const again = focusTest ? this.root.querySelector<HTMLElement>(`[data-test="${focusTest}"]`) : null;
    // Fuoco: l'azione principale della schermata (data-autofocus) o il pulsante Indietro
    // (mai un cursore: le frecce cambierebbero un valore senza volerlo).
    const target = again ?? this.root.querySelector<HTMLElement>('[data-autofocus]') ?? this.root.querySelector<HTMLElement>('.sc-indietro');
    target?.focus({ preventScroll: true });
  }

  exit(): void {
    this.entered = false;
    this.beforeExit();
    for (const off of this.offs.splice(0)) off();
    this.root?.remove();
    this.root = null;
  }

  render(_alpha: number, host: CanvasHost): void {
    this.backdrop.draw(host);
  }

  resize(_vp: Viewport): void {
    this.backdrop.invalidate();
  }

  /** Indietro: di norma il titolo. */
  protected goBack(): void {
    void this.s.scenes.go(this.s.scenes.has('titolo') ? 'titolo' : 'boot');
  }

  onBack(): boolean {
    this.goBack();
    return true;
  }

  onAction(a: ActionEvent): boolean {
    if (!this.root) return false;
    if (a.action === 'up' || a.action === 'down' || a.action === 'confirm' || a.action === 'pageUp' || a.action === 'pageDown') {
      const sheet = this.root.querySelector<HTMLElement>('.sc-foglio');
      if ((a.action === 'pageUp' || a.action === 'pageDown') && sheet) {
        sheet.scrollBy({ top: (a.action === 'pageDown' ? 1 : -1) * sheet.clientHeight * 0.85 });
        return true;
      }
      if (document.activeElement && this.root.contains(document.activeElement) && document.activeElement !== document.body) return false;
      const first = this.root.querySelector<HTMLElement>('[data-autofocus]') ?? this.root.querySelector<HTMLElement>('.sc-indietro');
      if (first) {
        first.focus();
        return true;
      }
    }
    return false;
  }
}
