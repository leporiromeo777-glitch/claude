/**
 * Scena 'alba' (GDD 4.2, 10.3): "il giorno accade". Fino a 3 vignette scelte a fine
 * notte (resoconto della giornata), mentre il merletto suona come un carillon.
 * "Salta" sempre visibile; alla fine si va al bilancio.
 */
import type { ActionEvent, Playing, Scene, Services, Viewport } from '../core/types';
import { el } from '../core/ui/dom';
import { textOf } from '../core/ui/components';
import { controller } from './controller';
import { VignettePlayer } from './vignette';
import { scoreFromOutcome, scoreFromRows } from './score';
import { sceneHost, unloadImages } from './ui';

export class AlbaScene implements Scene {
  readonly id = 'alba' as const;
  private root: HTMLElement | null = null;
  private player: VignettePlayer | null = null;
  private carillon: Playing | null = null;
  private left = false;

  constructor(private readonly s: Services) {}

  enter(): void {
    const c = controller.state();
    const report = c?.report;
    if (!c || c.phase !== 'alba' || !report) {
      void controller.route().then((r) => {
        if (r) controller.go(r);
        else void this.s.scenes.go(this.s.scenes.has('titolo') ? 'titolo' : 'boot');
      });
      return;
    }
    controller.sound('alba', report.levelId);
    const level = this.s.content.levels.get(report.levelId);
    const title = level ? textOf(level.titleKey, undefined, 'span') : null;
    this.root = el(
      'div',
      { class: 'cp-scena cp-alba', test: 'cp-alba' },
      el('header', { class: 'cp-alba-testa core-sicura-top' }, textOf('campaign.alba.titolo', undefined, 'h1', { className: 'cp-alba-titolo' }), title),
    );
    this.player = new VignettePlayer(this.s, { vignettes: report.dawn, onDone: () => this.done(), test: 'cp-alba-vignetta' });
    this.root.appendChild(this.player.el);
    sceneHost(this.s).appendChild(this.root);
    if (level) {
      try {
        const beat = this.s.content.balance.anim.beatMs;
        const score = c.lastOutcome?.levelId === level.id ? scoreFromOutcome(level, c.lastOutcome, beat) : scoreFromRows(level, report.rows, c.flags, this.s.content.balance, beat);
        this.carillon = this.s.audio.carillon(score);
      } catch {
        this.carillon = null;
      }
    }
    this.player.start();
  }

  private done(): void {
    if (this.left) return;
    this.left = true;
    controller.toBilancio();
  }

  /** Posizione delle vignette (debug). */
  position(): unknown {
    return this.player?.position() ?? null;
  }

  skip(): void {
    this.player?.skip();
  }

  exit(): void {
    this.player?.destroy();
    this.player = null;
    try {
      this.carillon?.stop();
    } catch {
      /* già fermo */
    }
    this.carillon = null;
    this.root?.remove();
    this.root = null;
    unloadImages(this.s.assets);
  }

  resize(_vp: Viewport): void {
    this.player?.draw();
  }

  onAction(a: ActionEvent): boolean {
    if (a.action === 'notebook') {
      void this.s.ui.openOverlay('taccuino', { from: 'alba' });
      return true;
    }
    return this.player?.onAction(a) ?? false;
  }

  onBack(): boolean {
    this.player?.skip();
    return true;
  }
}
