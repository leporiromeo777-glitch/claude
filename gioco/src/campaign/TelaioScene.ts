/**
 * Scena 'telaio' (GDD 8.2, 10.3): una lunga striscia di merletto verticale. Ogni
 * giornata è un nodo con titolo, stato delle richieste e filo d'oro; toccandolo:
 * Rigioca (per i record, la storia non cambia), Riprendi da qui (la storia torna alla
 * sera di quella giornata, il Taccuino resta; con conferma), Riascolta (il carillon del
 * merletto). In fondo gli epiloghi visti.
 */
import type { ActionEvent, LevelId, Playing, RowMoves, Scene, SceneId, Services, Viewport } from '../core/types';
import { el, clear } from '../core/ui/dom';
import { button, textOf } from '../core/ui/components';
import { svgIcon } from '../core/ui/glyphs';
import { decodeSpartito, spartitoRows } from '../engine/index';
import { controller, type FinaleParams } from './controller';
import { dayLabel, SideNotebook } from './frame';
import { scoreFromRows } from './score';
import { sceneHost } from './ui';
import type { DayResultX } from './types';

export class TelaioScene implements Scene {
  readonly id = 'telaio' as const;
  private root: HTMLElement | null = null;
  private main: HTMLElement | null = null;
  private side: SideNotebook | null = null;
  private carillon: Playing | null = null;
  private back: SceneId | null = null;
  private open: LevelId | null = null;

  constructor(private readonly s: Services) {}

  enter(params?: unknown): void {
    const p = (params ?? {}) as { back?: SceneId };
    this.back = p.back ?? null;
    this.root = el('div', { class: 'cp-scena cp-telaio', test: 'cp-telaio' });
    this.main = el('div', { class: 'cp-centro' });
    this.side = new SideNotebook(this.s, { from: 'telaio' });
    this.root.append(this.main, this.side.column);
    sceneHost(this.s).appendChild(this.root);
    this.side.sync();
    try {
      this.s.audio.setMusic('sera', { seed: 'telaio' });
      this.s.audio.setAmbience('notte');
    } catch {
      /* audio non pronto */
    }
    this.open = controller.state()?.levelId ?? null;
    this.refresh();
  }

  private rowsOf(id: LevelId): RowMoves[] | null {
    const h = controller.state()?.history[id] as DayResultX | undefined;
    if (h?.rows?.length) return h.rows;
    const rec = controller.data().records[id];
    const lv = this.s.content.levels.get(id);
    if (rec?.bestSpartito && lv) {
      const sp = decodeSpartito(rec.bestSpartito);
      if (sp) return spartitoRows(lv, sp);
    }
    return null;
  }

  private refresh(): void {
    const main = this.main;
    if (!main) return;
    const focused = (document.activeElement as HTMLElement | null)?.dataset?.test ?? null;
    clear(main);
    const c = controller.state();
    const d = controller.data();
    main.appendChild(
      el(
        'header',
        { class: 'cp-sera-testa' },
        el('div', { class: 'cp-sera-intestazione' }, textOf('campaign.telaio.titolo', undefined, 'h1', { className: 'cp-sera-titolo' }), textOf('campaign.telaio.intro', undefined, 'p', { className: 'cp-sera-intro' })),
      ),
    );
    if (!c) {
      main.appendChild(textOf('campaign.telaio.vuoto', undefined, 'p', { className: 'cp-sera-intro', rich: true }));
    } else {
      const strip = el('ol', { class: 'cp-striscia', test: 'cp-striscia' });
      const days = this.s.content.campaign.days;
      let reached = c.dayIndex;
      for (const id of Object.keys(c.history)) reached = Math.max(reached, days.findIndex((x) => x.id === id));
      days.forEach((day, i) => {
        const lv = this.s.content.levels.get(day.id);
        if (!lv) return;
        const known = i <= reached || !!d.records[day.id];
        const h = c.history[day.id] as DayResultX | undefined;
        const rec = d.records[day.id];
        const lab = dayLabel(this.s.content, day.id);
        const node = el('li', { class: ['cp-nodo', h ? 'cp-nodo--fatto' : null, i === c.dayIndex ? 'cp-nodo--oggi' : null, known ? null : 'cp-nodo--futuro'], test: `cp-nodo-${day.id}`, data: { giornata: day.id } });
        const head = el('button', { type: 'button', class: 'cp-nodo-testa', disabled: !known, test: `cp-nodo-apri-${day.id}`, attrs: { 'aria-expanded': this.open === day.id ? 'true' : 'false' } }, el('span', { class: 'cp-nodo-punto', attrs: { 'aria-hidden': 'true' } }), textOf(lab.key, lab.params, 'span', { className: 'cp-nodo-giornata' }), known ? textOf(lv.titleKey, undefined, 'span', { className: 'cp-nodo-titolo' }) : el('span', { class: 'cp-nodo-titolo', text: '…' }));
        if (rec?.filoDOro) head.appendChild(el('span', { class: 'cp-oro', test: `cp-nodo-oro-${day.id}` }, svgIcon('stella', { size: 16 }), textOf('campaign.telaio.filoDOro', undefined, 'span', { className: 'core-sr-only' })));
        if (h && h.requests.length > 0) {
          const ok = h.requests.filter((r) => r.status === 'soddisfatta').length;
          head.appendChild(textOf('campaign.telaio.richieste', { ok, ko: h.requests.length - ok }, 'span', { className: 'cp-tenue cp-nodo-esiti' }));
        }
        head.addEventListener('click', () => {
          this.open = this.open === day.id ? null : day.id;
          this.refresh();
        });
        node.appendChild(head);
        if (this.open === day.id && known) node.appendChild(this.actions(day.id, !!h || !!rec, !!c.snapshots[day.id]));
        strip.appendChild(node);
      });
      main.appendChild(strip);
      if (c.endingsSeen.length > 0) {
        const ep = el('section', { class: 'cp-epiloghi', test: 'cp-epiloghi' }, textOf('campaign.telaio.epiloghi', undefined, 'h2', { className: 'cp-foglio-h' }));
        for (const e of c.endingsSeen) {
          const def = this.s.content.endings.get(e);
          const lv = def ? this.s.content.levels.get(def.level) : undefined;
          ep.appendChild(button({ labelKey: lv?.titleKey ?? `campaign.finale.${e}`, icon: 'play', kind: 'secondario', onClick: () => void this.s.scenes.go('finale', { mode: 'rivedi', ending: e } satisfies FinaleParams), test: `cp-epilogo-${e}` }));
        }
        main.appendChild(ep);
      }
    }
    main.appendChild(el('footer', { class: 'cp-sera-piede' }, el('div', { class: 'cp-sera-strumenti' }, this.side?.button() ?? null), el('div', { class: 'cp-sera-vai' }, button({ labelKey: 'campaign.telaio.indietro', icon: 'indietro', kind: 'secondario', onClick: () => this.leave(), test: 'cp-telaio-indietro' }))));
    if (focused) main.querySelector<HTMLElement>(`[data-test="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
  }

  private actions(id: LevelId, played: boolean, canResume: boolean): HTMLElement {
    const s = this.s;
    const box = el('div', { class: 'cp-nodo-azioni', test: `cp-nodo-azioni-${id}` });
    box.appendChild(button({ labelKey: 'campaign.telaio.rigioca', icon: 'disfa', kind: 'secondario', disabled: !played, onClick: () => void controller.replay(id), test: `cp-rigioca-${id}` }));
    box.appendChild(
      button({
        labelKey: 'campaign.telaio.riprendi',
        icon: 'gomitolo',
        kind: 'primario',
        disabled: !canResume,
        onClick: () => {
          void s.ui.confirm({ titleKey: 'campaign.telaio.riprendiTitolo', bodyKey: 'campaign.telaio.riprendiCorpo', okKey: 'campaign.telaio.riprendiOk', cancelKey: 'campaign.telaio.annulla', danger: true }).then((ok) => {
            if (ok) void s.scenes.go('sera', { cmd: 'riprendi', levelId: id });
          });
        },
        test: `cp-riprendi-${id}`,
      }),
    );
    const rows = this.rowsOf(id);
    box.appendChild(
      button({
        labelKey: 'campaign.telaio.riascolta',
        icon: 'nota',
        kind: 'secondario',
        disabled: !rows,
        onClick: () => {
          const lv = s.content.levels.get(id);
          if (!lv || !rows) return;
          try {
            this.carillon?.stop();
            this.carillon = s.audio.carillon(scoreFromRows(lv, rows, controller.state()?.snapshots[id]?.flags ?? {}, s.content.balance, s.content.balance.anim.beatMs));
          } catch {
            this.carillon = null;
          }
        },
        test: `cp-riascolta-${id}`,
      }),
    );
    return box;
  }

  private leave(): void {
    const to = this.back && this.s.scenes.has(this.back) ? this.back : this.s.scenes.has('titolo') ? 'titolo' : 'boot';
    if (to === 'sera') {
      void this.s.scenes.go('sera', { cmd: 'continua' });
      return;
    }
    void this.s.scenes.go(to);
  }

  exit(): void {
    try {
      this.carillon?.stop();
    } catch {
      /* già fermo */
    }
    this.carillon = null;
    this.side?.destroy();
    this.side = null;
    this.root?.remove();
    this.root = null;
    this.main = null;
  }

  resize(_vp: Viewport): void {
    this.side?.sync();
  }

  onAction(a: ActionEvent): boolean {
    if (a.action === 'notebook') {
      this.side?.open();
      return true;
    }
    return false;
  }

  onBack(): boolean {
    this.leave();
    return true;
  }
}
