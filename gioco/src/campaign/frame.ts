/**
 * Cornice comune delle scene della campagna: etichetta della giornata e Taccuino
 * laterale. Nel layout largo il Taccuino è montato fisso a destra (320 px, GDD 10.2);
 * nello stretto si apre come overlay (Tab o il pulsante) e si chiude con Indietro.
 */
import type { ContentDB, LevelId, PanelHandle, Services } from '../core/types';
import { el } from '../core/ui/dom';
import { iconButton } from '../core/ui/components';
import { dayIndexOf } from './evening';
import { isWide, loadImages } from './ui';

/** "Prologo" o "Giornata N" per una giornata della campagna; i finali e l'Archivio hanno il loro. */
export function dayLabel(db: Pick<ContentDB, 'campaign' | 'levels'>, levelId: LevelId): { key: string; params?: Record<string, string | number> } {
  const i = dayIndexOf(db, levelId);
  if (i === 0) return { key: 'campaign.giornata.prologo' };
  if (i > 0) return { key: 'campaign.giornata.n', params: { n: i } };
  const lv = db.levels.get(levelId);
  if (lv?.kind === 'archivio') return { key: 'campaign.giornata.archivio' };
  if (lv?.kind === 'finale') return { key: 'campaign.giornata.finale' };
  return { key: 'campaign.giornata.altro' };
}

export class SideNotebook {
  readonly column: HTMLElement;
  private handle: PanelHandle | null = null;
  private mode = '';

  constructor(
    private readonly s: Services,
    private readonly opts: Record<string, unknown> = {},
  ) {
    this.column = el('aside', { class: 'cp-lato core-solid', test: 'cp-taccuino-fisso', hidden: true });
  }

  /** Monta o smonta il pannello secondo la disposizione corrente. */
  sync(): void {
    const wide = isWide(this.s);
    const mode = wide ? 'largo' : 'stretto';
    if (mode === this.mode) {
      this.handle?.update?.();
      return;
    }
    this.mode = mode;
    this.column.parentElement?.toggleAttribute('data-largo', wide);
    this.handle?.destroy();
    this.handle = null;
    this.column.hidden = !wide;
    if (wide) this.handle = this.s.ui.mountPanel('taccuino', this.column, { ...this.opts, fixed: true });
  }

  update(): void {
    this.handle?.update?.();
  }

  wide(): boolean {
    return this.mode === 'largo';
  }

  /** Apre il Taccuino: nel largo porta il fuoco al pannello fisso, nello stretto apre l'overlay. */
  open(extra: Record<string, unknown> = {}): void {
    if (this.mode === 'largo' && !this.column.hidden) {
      if (Object.keys(extra).length > 0) {
        this.handle?.destroy();
        this.handle = this.s.ui.mountPanel('taccuino', this.column, { ...this.opts, ...extra, fixed: true });
      }
      this.column.querySelector<HTMLElement>('[role="tab"], button')?.focus({ preventScroll: true });
      return;
    }
    void this.s.ui.openOverlay('taccuino', { ...this.opts, ...extra });
  }

  /** Pulsante "Taccuino" (nascosto nel largo, dove il Taccuino è già aperto). */
  button(test = 'cp-apri-taccuino'): HTMLButtonElement {
    return iconButton({ icon: 'taccuino', labelKey: 'campaign.taccuino.apri', onClick: () => this.open(), size: 56, kind: 'secondario', test, className: 'cp-btn-taccuino' });
  }

  destroy(): void {
    this.handle?.destroy();
    this.handle = null;
    this.column.remove();
  }
}

/** Sfondo dipinto in un canvas del DOM (diorama o quadro "a copertura", con un velo scuro). */
export class Backdrop {
  readonly el: HTMLCanvasElement;
  private name = '';
  private ro: ResizeObserver | null = null;

  constructor(
    private readonly s: Services,
    private readonly veil = 0.45,
  ) {
    this.el = el('canvas', { class: 'cp-fondo', attrs: { 'aria-hidden': 'true' } });
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.draw());
      this.ro.observe(this.el);
    }
  }

  show(name: string): void {
    this.name = name;
    this.draw();
    void loadImages(this.s.assets, [name]).then(() => this.draw());
  }

  draw(): void {
    const c = this.el;
    const w = Math.max(1, Math.round(c.clientWidth || 1));
    const h = Math.max(1, Math.round(c.clientHeight || 1));
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#121622';
    ctx.fillRect(0, 0, w, h);
    if (this.name) {
      try {
        const img = this.s.assets.image(this.name) as CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
        const iw = Number(img.naturalWidth ?? img.width ?? 1024) || 1024;
        const ih = Number(img.naturalHeight ?? img.height ?? 768) || 768;
        const k = Math.max(w / iw, h / ih);
        ctx.drawImage(img, (w - iw * k) / 2, (h - ih * k) / 2, iw * k, ih * k);
      } catch {
        /* immagine non pronta */
      }
    }
    if (this.veil > 0) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `rgba(18,22,34,${this.veil * 0.6})`);
      g.addColorStop(1, `rgba(18,22,34,${Math.min(0.95, this.veil * 1.6)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }

  destroy(): void {
    this.ro?.disconnect();
    this.el.remove();
  }
}
