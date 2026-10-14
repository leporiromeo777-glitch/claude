/**
 * Barra alta (52 px: giornata e titolo, ora corrente, matassa con il gomitolo
 * "5/8") e intestazione delle colonne (40 px: icona e nome breve di ogni luogo,
 * sempre visibile). GDD 10.3.
 */
import type { PlaceId } from '../../core/types';
import { el, clear } from '../../core/ui/dom';
import { setTextParams, textOf } from '../../core/ui/components';
import { svgIcon } from '../../core/ui/glyphs';
import type { TomboloLayout } from '../layout';
import { fitText, place } from './popup';

export interface HudState {
  /** Giornata ("Giornata 6", "Prologo", "Archivio · 1936"): chiave o vuota. */
  dayKey: string;
  dayParams: Record<string, string | number>;
  titleKey: string;
  titleParams: Record<string, string | number>;
  hour: number;
  done: boolean;
  matassa: { used: number; total: number } | null;
  /** Luce della finestrella (0-1): cresce di un passo a ogni ora fissata; null = nascosta. */
  light: number | null;
}

export class Hud {
  readonly el: HTMLElement;
  private readonly title: HTMLElement;
  private readonly day: HTMLElement;
  private readonly name: HTMLElement;
  private readonly hour: HTMLElement;
  private readonly matassa: HTMLElement;
  private readonly matassaText: HTMLElement;
  private readonly matassaAria: HTMLElement;
  private readonly window: HTMLElement;
  private last = '';

  constructor() {
    // Titolo su due righe: la giornata (piccola) e il nome del merletto (GDD 10.3).
    this.day = textOf('tombolo.hud.titolo', undefined, 'span', { className: 'tb-hud-day' });
    this.name = textOf('tombolo.hud.titolo', undefined, 'span', { className: 'tb-hud-name' });
    this.title = el('h1', { class: 'tb-hud-title', test: 'tb-hud-titolo' }, this.day, this.name);
    this.hour = textOf('tombolo.hud.ora', { ora: 0 }, 'span', { className: 'tb-hud-hour' });
    this.matassaText = textOf('tombolo.hud.matassa', { usata: 0, totale: 0 }, 'span', { className: 'tb-hud-matassa-text' });
    this.matassaAria = textOf('tombolo.hud.matassaAria', { usata: 0, totale: 0 }, 'span', { className: 'core-sr-only' });
    this.matassaText.setAttribute('aria-hidden', 'true');
    this.matassa = el('div', { class: 'tb-hud-matassa', test: 'tb-matassa' }, svgIcon('gomitolo', { size: 22 }), this.matassaText, this.matassaAria);
    this.window = el('span', { class: 'tb-finestra', test: 'tb-finestra', attrs: { 'aria-hidden': 'true' } }, el('span', { class: 'tb-finestra-luce' }));
    this.el = el('header', { class: 'tb-hud', test: 'tb-hud' }, this.title, this.window, this.hour, this.matassa);
  }

  update(s: HudState): void {
    const key = JSON.stringify(s);
    if (key === this.last) return;
    this.last = key;
    this.day.hidden = !s.dayKey;
    if (s.dayKey) {
      this.day.dataset.i18n = s.dayKey;
      setTextParams(this.day, s.dayParams);
    }
    this.name.dataset.i18n = s.titleKey;
    setTextParams(this.name, s.titleParams);
    this.hour.dataset.i18n = s.done ? 'tombolo.hud.finito' : 'tombolo.hud.ora';
    setTextParams(this.hour, { ora: s.hour });
    this.window.hidden = s.light === null;
    if (s.light !== null) this.window.style.setProperty('--tb-luce', String(Math.max(0, Math.min(1, s.light))));
    if (s.matassa) {
      this.matassa.hidden = false;
      setTextParams(this.matassaText, { usata: s.matassa.used, totale: s.matassa.total });
      setTextParams(this.matassaAria, { usata: s.matassa.used, totale: s.matassa.total });
      this.matassa.classList.toggle('tb-finita', s.matassa.used >= s.matassa.total);
    } else {
      this.matassa.hidden = true;
    }
    this.fit();
  }

  layout(l: TomboloLayout): void {
    place(this.el, l.hud);
    this.fit();
  }

  fit(): void {
    fitText(this.title, 12);
    fitText(this.hour, 12);
    fitText(this.matassaText, 11);
  }
}

export interface ColumnInfo {
  place: PlaceId;
  icon: string;
  shortKey: string;
  nameKey: string;
}

/** Intestazione delle colonne: icona e nome breve. */
export class ColumnHeader {
  readonly el: HTMLElement;
  private cells: HTMLElement[] = [];
  private labels: HTMLElement[] = [];

  constructor() {
    this.el = el('div', { class: 'tb-header', test: 'tb-colonne' });
  }

  build(cols: ColumnInfo[]): void {
    clear(this.el);
    this.cells = [];
    this.labels = [];
    for (const c of cols) {
      const label = textOf(c.shortKey, undefined, 'span', { className: 'tb-header-label' });
      const cell = el('div', { class: 'tb-header-cell', data: { luogo: c.place } }, svgIcon(c.icon, { size: 18 }), label);
      cell.setAttribute('title', '');
      this.cells.push(cell);
      this.labels.push(label);
      this.el.appendChild(cell);
    }
  }

  layout(l: TomboloLayout): void {
    place(this.el, l.header);
    this.cells.forEach((cell, i) => {
      cell.style.left = `${(l.colX[i] ?? 0) - l.header.x}px`;
      cell.style.width = `${l.colW}px`;
    });
    for (const lab of this.labels) fitText(lab, 9);
  }
}
