/**
 * Scena 'alba' (GDD 4.2, 10.3): "il giorno accade". Fino a 3 vignette (4 con i culmini)
 * scelte a fine notte (resoconto della giornata), mentre il merletto suona come un
 * carillon. "Salta" sempre visibile; alla fine si va al bilancio.
 *
 * Revisione 1: gli avvisi del Taccuino arrivati a fine notte escono dopo l'ultima
 * vignetta (D11). Se la giornata ha un oggetto dell'alba (C04: la lettera di Clotilde in
 * g14, il fascio delle lettere in g16) dopo le vignette c'è la consegna a mano
 * (`cp-alba-oggetto`): «Prima di andare via…», la figura di chi consegna, la lettura a
 * tutto schermo; le voci nuove del Taccuino si annunciano lì (C03), poi il bilancio.
 */
import type { ActionEvent, CharacterId, Playing, Scene, Services, Viewport } from '../core/types';
import { el } from '../core/ui/dom';
import { button, textOf } from '../core/ui/components';
import { controller } from './controller';
import { VignettePlayer, figureFrame } from './vignette';
import { scoreFromOutcome, scoreFromRows } from './score';
import { charChip, sceneHost, spriteCanvas, unloadImages } from './ui';
import { dawnObjectPending } from './flow';
import { itemOf } from './evening';
import { itemsSheet, newEntriesBox } from './notes';

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
    controller.deferRecentNotices();
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
    // Dopo l'ultima vignetta l'oggetto dell'alba, se c'è; gli avvisi tenuti da parte (D11)
    // escono subito, o con il bilancio se prima c'è la lettura (non coprono la lettera).
    const c = controller.state();
    if (c && dawnObjectPending(c) && !this.delivery) {
      this.showDelivery(c.report?.dawnItems ?? [], c.report?.dawnBy ?? null);
      return;
    }
    controller.flushNotices();
    this.left = true;
    controller.toBilancio();
  }

  private delivery: HTMLElement | null = null;

  /** La consegna a mano dell'oggetto dell'alba (C04) e la sua lettura a tutto schermo. */
  private showDelivery(ids: readonly string[], by: CharacterId | null): void {
    const root = this.root;
    if (!root) return;
    this.player?.destroy();
    this.player = null;
    const items = ids.map((id) => itemOf(id, this.s.content));
    const head = el(
      'header',
      { class: 'cp-consegna-testa' },
      by ? spriteCanvas(this.s, figureFrame(by, 'porge', false), 96, { className: 'cp-consegna-figura' }) : null,
      el('div', null, textOf('campaign.alba.consegna', undefined, 'h2', { className: 'cp-dettaglio-titolo' }), by ? charChip(this.s, by) : null),
    );
    const actions = el('div', { class: 'cp-dettaglio-azioni' });
    let read = false;
    const cont = button({
      labelKey: 'campaign.sera.oggettoContinua',
      icon: 'avanti',
      kind: 'primario',
      size: 'grande',
      onClick: () => {
        if (!read) {
          read = true;
          const box = newEntriesBox(this.s, controller.dawnObjectSeen(), 'alba');
          if (box) {
            actions.before(box);
            box.scrollIntoView?.({ block: 'nearest' });
            return;
          }
        }
        this.left = true;
        controller.toBilancio();
      },
      test: 'cp-alba-oggetto-continua',
    });
    actions.appendChild(cont);
    const sheet = el('div', { class: 'cp-dettaglio cp-oggetti core-solid' }, head, ...itemsSheet(this.s, items), actions);
    this.delivery = el('div', { class: 'cp-alba-consegna', test: 'cp-alba-oggetto', data: { oggetto: ids[0] ?? '' } }, el('div', { class: 'cp-centro-foglio' }, sheet));
    root.appendChild(this.delivery);
    try {
      this.s.audio.sfx('carta');
    } catch {
      /* audio non pronto */
    }
    cont.focus({ preventScroll: true });
  }

  /** Posizione delle vignette (debug). */
  position(): unknown {
    return this.player?.position() ?? null;
  }

  /** Salta le vignette; durante la consegna dell'oggetto, la lettura (si impara lo stesso). */
  skip(): void {
    if (this.delivery) {
      if (this.left) return;
      this.left = true;
      controller.toBilancio();
      return;
    }
    this.player?.skip();
  }

  /** Stato della consegna dell'oggetto dell'alba (debug). */
  deliveryShown(): boolean {
    return !!this.delivery;
  }

  exit(): void {
    this.player?.destroy();
    this.player = null;
    this.delivery?.remove();
    this.delivery = null;
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
    // Durante la consegna Indietro non salta la lettera: si legge e si continua.
    if (this.delivery) return true;
    this.player?.skip();
    return true;
  }
}
