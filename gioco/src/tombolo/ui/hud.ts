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
import { place } from './popup';

export interface HudState {
  /** Giornata ("Giornata 6", "Prologo", "Archivio · 1936"): chiave o vuota. */
  dayKey: string;
  dayParams: Record<string, string | number>;
  titleKey: string;
  titleParams: Record<string, string | number>;
  /** Ora corrente e ora di fine, già scritte nella lingua corrente («7», «8 pm»). */
  hour: string;
  end: string;
  done: boolean;
  matassa: { used: number; total: number } | null;
  /** Luce della finestrella (0-1): cresce di un passo a ogni ora fissata; null = nascosta. */
  light: number | null;
}

/**
 * Barra alta (GDD 10.3, D16): le scritte non scendono mai sotto 15 px × scala del
 * testo (niente riduzione per farle stare): vanno a capo, e la barra cresce in
 * altezza (la regia legge `naturalHeight()` e ridispone il tombolo).
 */
export class Hud {
  readonly el: HTMLElement;
  private readonly title: HTMLElement;
  private readonly day: HTMLElement;
  private readonly name: HTMLElement;
  private readonly hour: HTMLElement;
  private readonly end: HTMLElement;
  private readonly time: HTMLElement;
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
    this.hour = textOf('tombolo.hud.ora', { ora: '' }, 'span', { className: 'tb-hud-hour' });
    this.hour.dataset.test = 'tb-hud-ora';
    this.end = textOf('tombolo.hud.fino', { fine: '' }, 'span', { className: 'tb-hud-end' });
    this.end.dataset.test = 'tb-hud-fine';
    this.time = el('span', { class: 'tb-hud-time' }, this.hour, this.end);
    this.matassaText = textOf('tombolo.hud.matassa', { usata: 0, totale: 0 }, 'span', { className: 'tb-hud-matassa-text' });
    this.matassaAria = textOf('tombolo.hud.matassaAria', { usata: 0, totale: 0 }, 'span', { className: 'core-sr-only' });
    this.matassaText.setAttribute('aria-hidden', 'true');
    this.matassa = el('div', { class: 'tb-hud-matassa', test: 'tb-matassa' }, svgIcon('gomitolo', { size: 22 }), this.matassaText, this.matassaAria);
    this.window = el('span', { class: 'tb-finestra', test: 'tb-finestra', attrs: { 'aria-hidden': 'true' } }, el('span', { class: 'tb-finestra-luce' }));
    const stats = el('div', { class: 'tb-hud-stats' }, this.window, this.time, this.matassa);
    this.el = el('header', { class: 'tb-hud', test: 'tb-hud' }, this.title, stats);
  }

  /** Aggiorna le scritte; true se sono cambiate (la regia ricontrolla l'altezza). */
  update(s: HudState): boolean {
    const key = JSON.stringify(s);
    if (key === this.last) return false;
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
    this.end.hidden = s.done;
    setTextParams(this.end, { fine: s.end });
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
    return true;
  }

  /** Il gomitolo pulsa (tutorial della matassa, C02). */
  setPulse(on: boolean): void {
    this.matassa.classList.toggle('tb-pulsa', on);
  }

  layout(l: TomboloLayout): void {
    place(this.el, l.hud);
  }

  /** Altezza della barra con le scritte intere (0 se il browser non misura). */
  naturalHeight(): number {
    const h0 = this.el.style.height;
    this.el.style.height = 'auto';
    const h = this.el.offsetHeight;
    this.el.style.height = h0;
    return h;
  }
}

export interface ColumnInfo {
  place: PlaceId;
  icon: string;
  shortKey: string;
  nameKey: string;
}

/**
 * Intestazione delle colonne: icona e nome breve (D16). Il nome non si
 * rimpicciolisce e non si tronca: se non sta nella colonna (o la colonna è sotto
 * i 44 px) resta solo l'icona, con il nome per esteso come nome accessibile.
 */
export class ColumnHeader {
  readonly el: HTMLElement;
  private cells: HTMLElement[] = [];
  private labels: HTMLElement[] = [];

  constructor() {
    this.el = el('div', { class: 'tb-header', test: 'tb-colonne' });
  }

  build(cols: ColumnInfo[], nameOf: (key: string) => string = (k) => k): void {
    clear(this.el);
    this.cells = [];
    this.labels = [];
    for (const c of cols) {
      const label = textOf(c.shortKey, undefined, 'span', { className: 'tb-header-label' });
      const cell = el('div', { class: 'tb-header-cell', data: { luogo: c.place }, attrs: { role: 'columnheader', 'aria-label': nameOf(c.nameKey) } }, svgIcon(c.icon, { size: 18 }), label);
      cell.title = nameOf(c.nameKey);
      // Al cambio di lingua il nome accessibile (e il title) si riscrive con il resto (D16).
      cell.dataset.i18nLabel = c.nameKey;
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
    this.fit(l.colW);
  }

  /** Solo icona dove il nome breve non sta intero (o sotto i 44 px di colonna). */
  fit(colW: number): void {
    this.cells.forEach((cell, i) => {
      const label = this.labels[i];
      if (!label) return;
      cell.classList.remove('tb-header-cell--icona');
      label.hidden = false;
      label.removeAttribute('aria-hidden');
      const tooNarrow = colW < 44;
      // Il confronto è con la casella del nome (la cella ha 2 px di margine per lato):
      // «Piazza» largo 60 px in una casella da 58 era tagliato di un soffio.
      const overflow = label.scrollWidth > 0 && (label.scrollWidth > label.clientWidth || label.scrollWidth > cell.clientWidth - 4);
      if (tooNarrow || overflow) {
        cell.classList.add('tb-header-cell--icona');
        label.hidden = true;
        label.setAttribute('aria-hidden', 'true');
      }
    });
  }

  /** Nomi visibili (per i test): null = solo icona. */
  visibleLabels(): (string | null)[] {
    return this.labels.map((l) => (l.hidden ? null : (l.textContent ?? '')));
  }
}
