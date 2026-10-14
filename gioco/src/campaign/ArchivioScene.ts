/**
 * Scena 'archivio' (GDD 5.3, 10.3): la cassapanca con i merletti antichi come rotoli.
 * Aprire un rotolo avvia il tombolo in modo 'archivio' (A1-A5) o 'occasioni' (A6);
 * a merletto chiuso tornano qui l'esito, la vignetta di rivelazione (se rammendato),
 * la nota a margine di Clotilde e le voci nuove del Taccuino.
 *
 * Dopo il bilancio di una giornata con `archiveAfter` (fase 'archivio') il rotolo nuovo
 * è in evidenza, con "Apri" e "Più tardi"; dalla sera la cassapanca si sfoglia e basta.
 *
 * Revisione 1:
 * - `{ cmd: 'lascia', levelId }` (C10, «Lascia per ora» dalla Pausa): la notte d'Archivio
 *   salvata si toglie, l'Archivio resta com'era e si torna alla cassapanca con «Apri» e
 *   «Più tardi» (che, nella fase d'Archivio, porta alla sera dopo);
 * - un rotolo rammendato ha «Rileggi» (il merletto rammendato in sola lettura, con i
 *   nomi e i colori) e «Rifai» (lo si ritesse da capo);
 * - la vignetta di rivelazione occupa tutta l'area, come le vignette dell'alba (CAM-11).
 */
import type { ActionEvent, LevelId, Scene, SceneId, Services, Viewport } from '../core/types';
import { el, clear } from '../core/ui/dom';
import { button, textOf } from '../core/ui/components';
import { svgIcon } from '../core/ui/glyphs';
import { controller, type ArchivioParams } from './controller';
import { Backdrop, SideNotebook } from './frame';
import { VignettePlayer } from './vignette';
import { sceneHost, unloadImages } from './ui';
import type { ArchiveResult } from './flow';

export class ArchivioScene implements Scene {
  readonly id = 'archivio' as const;
  private root: HTMLElement | null = null;
  private main: HTMLElement | null = null;
  private side: SideNotebook | null = null;
  private backdrop: Backdrop | null = null;
  private player: VignettePlayer | null = null;
  private reveal: HTMLElement | null = null;
  private back: SceneId | null = null;

  constructor(private readonly s: Services) {}

  enter(params?: unknown): void {
    const p = (params ?? {}) as ArchivioParams;
    this.back = p.back ?? null;
    this.root = el('div', { class: 'cp-scena cp-archivio', test: 'cp-archivio' });
    this.backdrop = new Backdrop(this.s, 0.6);
    this.main = el('div', { class: 'cp-centro' });
    this.side = new SideNotebook(this.s, { from: 'archivio', tab: 'archivio' });
    this.root.append(this.backdrop.el, this.main, this.side.column);
    sceneHost(this.s).appendChild(this.root);
    this.backdrop.show('dio/stanza/notte');
    this.side.sync();
    controller.sound('archivio', p.result?.levelId ?? p.levelId);
    if (p.cmd === 'lascia' && p.levelId) controller.leaveArchive(p.levelId);
    if (p.result) this.showResult(p.result);
    else this.showChest();
  }

  private phaseArchive(): boolean {
    return controller.state()?.phase === 'archivio';
  }

  private showChest(): void {
    const main = this.main;
    if (!main) return;
    clear(main);
    const k = controller.knowledge();
    const c = controller.state();
    const fresh = this.phaseArchive() ? (c?.archiveOpen ?? null) : null;
    main.appendChild(el('header', { class: 'cp-sera-testa' }, el('div', { class: 'cp-sera-intestazione' }, textOf('campaign.archivio.titolo', undefined, 'h1', { className: 'cp-sera-titolo' }), textOf(fresh ? 'campaign.archivio.nuovoRotolo' : 'campaign.archivio.intro', undefined, 'p', { className: 'cp-sera-intro' }))));
    const list = el('div', { class: 'cp-rotoli', role: 'list', test: 'cp-rotoli' });
    const ids = this.s.content.campaign.days.map((d) => d.archiveAfter).filter((x): x is string => !!x && k.archive[x] !== undefined);
    for (const id of ids) {
      const lv = this.s.content.levels.get(id);
      if (!lv?.archive) continue;
      const st = k.archive[id] ?? 'nuovo';
      const mended = st === 'rammendato';
      // Rammendato: «Rileggi» lo mostra finito in sola lettura, «Rifai» lo ritesse da capo.
      const actions = el(
        'div',
        { class: 'cp-rotolo-azioni' },
        button({ labelKey: mended ? 'campaign.archivio.rileggi' : 'campaign.archivio.apri', icon: 'libro', kind: id === fresh ? 'primario' : 'secondario', onClick: () => (mended ? this.reread(id) : this.open(id)), test: `cp-apri-${id}` }),
        mended ? button({ labelKey: 'campaign.archivio.rifai', icon: 'disfa', kind: 'testo', onClick: () => this.open(id), test: `cp-rifai-${id}` }) : null,
      );
      const roll = el(
        'article',
        { class: ['cp-rotolo', 'core-solid', id === fresh ? 'cp-rotolo--nuovo' : null], role: 'listitem', test: `cp-rotolo-${id}`, data: { stato: st } },
        el('p', { class: 'cp-rotolo-anno', text: lv.archive.year }),
        textOf(lv.archive.titleKey, undefined, 'h2', { className: 'cp-rotolo-titolo' }),
        textOf(`campaign.archivio.stato.${st}`, undefined, 'p', { className: 'cp-tenue' }),
        actions,
      );
      list.appendChild(roll);
    }
    if (ids.length === 0) list.appendChild(textOf('campaign.archivio.vuota', undefined, 'p', { className: 'cp-tenue' }));
    main.appendChild(list);
    const foot = el('footer', { class: 'cp-sera-piede' }, el('div', { class: 'cp-sera-strumenti' }, this.side?.button() ?? null));
    foot.appendChild(
      el(
        'div',
        { class: 'cp-sera-vai' },
        button({ labelKey: this.phaseArchive() ? 'campaign.archivio.piuTardi' : 'campaign.archivio.chiudi', icon: 'avanti', kind: this.phaseArchive() ? 'secondario' : 'primario', onClick: () => this.leave(), test: 'cp-archivio-chiudi' }),
      ),
    );
    main.appendChild(foot);
    main.querySelector<HTMLElement>(fresh ? `[data-test="cp-apri-${fresh}"]` : '[data-test^="cp-apri-"]')?.focus({ preventScroll: true });
  }

  private open(id: LevelId): void {
    controller.openArchive(id);
  }

  private reread(id: LevelId): void {
    controller.rereadArchive(id);
  }

  private showResult(r: ArchiveResult): void {
    const main = this.main;
    if (!main) return;
    clear(main);
    if (r.reveal && this.root) {
      // La rivelazione nello stesso contenitore delle vignette dell'alba (CAM-11): tutta l'area.
      const lv = this.s.content.levels.get(r.levelId);
      this.player = new VignettePlayer(this.s, { vignettes: [r.reveal], onDone: () => this.showSummary(r), test: 'cp-archivio-rivelazione' });
      this.reveal = el(
        'div',
        { class: 'cp-scena cp-alba cp-rivelazione', test: 'cp-archivio-rivelazione-area' },
        el('header', { class: 'cp-alba-testa core-sicura-top' }, el('span', { class: 'cp-alba-titolo', text: lv?.archive?.year ?? '' }), lv?.archive ? textOf(lv.archive.titleKey, undefined, 'span') : null),
        this.player.el,
      );
      this.root.appendChild(this.reveal);
      this.player.start();
      return;
    }
    this.showSummary(r);
  }

  private showSummary(r: ArchiveResult): void {
    this.player?.destroy();
    this.player = null;
    this.reveal?.remove();
    this.reveal = null;
    const main = this.main;
    if (!main) return;
    clear(main);
    const lv = this.s.content.levels.get(r.levelId);
    const sheet = el('article', { class: 'cp-foglio core-solid', test: 'cp-archivio-esito', data: { rammendato: r.mended ? '1' : '0' } });
    sheet.appendChild(el('header', { class: 'cp-foglio-testa' }, el('p', { class: 'cp-rotolo-anno', text: lv?.archive?.year ?? '' }), lv?.archive ? textOf(lv.archive.titleKey, undefined, 'h1', { className: 'cp-foglio-titolo' }) : null));
    sheet.appendChild(el('p', { class: ['cp-riga', r.mended ? 'cp-ok' : 'cp-ko'] }, svgIcon(r.mended ? 'spunta' : 'info', { size: 20 }), textOf(r.mended ? 'campaign.archivio.esito.rammendato' : r.named ? 'campaign.archivio.esito.nominato' : 'campaign.archivio.esito.nuovo', undefined, 'span')));
    if (r.mended && lv?.archive?.marginKey) {
      sheet.appendChild(el('p', { class: 'cp-margine cp-margine--nonna', test: 'cp-archivio-margine' }, textOf(lv.archive.marginKey, undefined, 'span', { rich: true })));
      try {
        this.s.audio.babble('clotilde', this.s.i18n.t(lv.archive.marginKey));
      } catch {
        /* audio non pronto */
      }
    }
    if (r.newDiary.length > 0) {
      const list = el('ul', { class: 'cp-lista' });
      for (const id of r.newDiary) {
        const def = this.s.content.diary.get(id);
        if (!def) continue;
        const b = el('button', { type: 'button', class: 'cp-voce-nuova', test: `cp-archivio-voce-${id}` }, svgIcon('taccuino', { size: 18 }), textOf(def.textKey, undefined, 'span', { rich: true }));
        b.addEventListener('click', () => this.side?.open({ entry: id }));
        list.appendChild(el('li', null, b));
      }
      sheet.appendChild(el('section', { class: 'cp-foglio-sezione' }, textOf('campaign.bilancio.taccuino', undefined, 'h2', { className: 'cp-foglio-h' }), list));
    }
    const actions = el('footer', { class: 'cp-foglio-azioni' }, this.side?.button() ?? null);
    if (!r.mended) actions.appendChild(button({ labelKey: 'campaign.archivio.riprova', icon: 'disfa', kind: 'secondario', onClick: () => this.open(r.levelId), test: 'cp-archivio-riprova' }));
    actions.appendChild(button({ labelKey: 'campaign.archivio.allaCassapanca', icon: 'libro', kind: 'secondario', onClick: () => this.showChest(), test: 'cp-archivio-cassapanca' }));
    actions.appendChild(button({ labelKey: this.phaseArchive() ? 'campaign.archivio.continua' : 'campaign.archivio.chiudi', icon: 'avanti', kind: 'primario', size: 'grande', onClick: () => this.leave(), test: 'cp-archivio-continua' }));
    sheet.appendChild(actions);
    main.appendChild(el('div', { class: 'cp-centro-foglio' }, sheet));
    main.querySelector<HTMLElement>('[data-test="cp-archivio-continua"]')?.focus({ preventScroll: true });
  }

  private leave(): void {
    if (this.phaseArchive()) {
      controller.afterArchive();
      return;
    }
    if (this.back && this.s.scenes.has(this.back)) {
      void this.s.scenes.go(this.back);
      return;
    }
    void controller.route().then((r) => {
      if (r) controller.go(r);
      else void this.s.scenes.go(this.s.scenes.has('titolo') ? 'titolo' : 'boot');
    });
  }

  exit(): void {
    this.player?.destroy();
    this.player = null;
    this.reveal?.remove();
    this.reveal = null;
    this.side?.destroy();
    this.side = null;
    this.backdrop?.destroy();
    this.backdrop = null;
    this.root?.remove();
    this.root = null;
    this.main = null;
    unloadImages(this.s.assets);
  }

  resize(_vp: Viewport): void {
    this.side?.sync();
    this.backdrop?.draw();
    this.player?.draw();
  }

  onAction(a: ActionEvent): boolean {
    if (a.action === 'notebook') {
      this.side?.open();
      return true;
    }
    return this.player?.onAction(a) ?? false;
  }

  onBack(): boolean {
    if (this.player) {
      this.player.skip();
      return true;
    }
    this.leave();
    return true;
  }
}
