/**
 * Striscia delle richieste (GDD 10.3, 36 px): un gettone per ogni spillo rosso
 * appuntato, con l'icona dell'autore e lo stato in tempo reale (in corso,
 * soddisfatta, a rischio, fallita, lasciata cadere) — forma e testo, mai solo
 * colore. Toccando un gettone si apre il bigliettino con la possibilità di
 * lasciarlo cadere. Nell'Archivio la striscia mostra i nomi giusti e gli
 * strappi; con le occasioni, quante se ne possono ancora piantare.
 * I gettoni sono bersagli da 48 px centrati sulla striscia.
 */
import type { CondStatus, NoteId } from '../../core/types';
import { el, clear } from '../../core/ui/dom';
import { button, setTextParams, textOf } from '../../core/ui/components';
import { svgIcon } from '../../core/ui/glyphs';
import type { TomboloLayout } from '../layout';
import { fitText, place, type Params } from './popup';

export interface RequestToken {
  /** Id del bigliettino, oppure `obiettivo:<n>` per gli obiettivi obbligatori. */
  noteId: NoteId;
  goal?: boolean;
  icon: string;
  color: string;
  status: CondStatus;
  dropped: boolean;
  /** Etichetta accessibile già tradotta (autore e stato). */
  label: string;
}

const STATUS_GLYPH: Record<CondStatus | 'lasciata', string> = {
  in_corso: 'spillo',
  soddisfatta: 'spunta',
  a_rischio: 'info',
  fallita: 'chiudi',
  lasciata: 'chiudi',
};

export class RequestStrip {
  readonly el: HTMLElement;
  private readonly tokens: HTMLElement;
  private readonly info: HTMLElement;
  private last = '';
  private infoKey = '';

  constructor(private readonly onOpen: (noteId: NoteId) => void) {
    this.tokens = el('div', { class: 'tb-req-tokens', role: 'list' });
    this.info = el('span', { class: 'tb-req-info', test: 'tb-req-info' });
    this.el = el('div', { class: 'tb-requests', test: 'tb-richieste' }, this.tokens, this.info);
  }

  update(items: RequestToken[]): void {
    const key = JSON.stringify(items);
    if (key === this.last) return;
    this.last = key;
    clear(this.tokens);
    for (const it of items) {
      const st = it.dropped ? 'lasciata' : it.status;
      const b = el(
        'button',
        {
          type: 'button',
          class: ['tb-token', 'core-solid', `tb-token--${st}`, it.goal && 'tb-token--obiettivo'],
          role: 'listitem',
          label: it.label,
          title: it.label,
          test: it.goal ? `tb-${it.noteId.replace(':', '-')}` : `tb-richiesta-${it.noteId}`,
          data: { stato: st },
          style: { '--tb-token-colore': it.color },
        },
        el('span', { class: 'tb-token-chip' }, svgIcon(it.icon, { size: 16 }), el('span', { class: 'tb-token-state' }, svgIcon(STATUS_GLYPH[st], { size: 12 }))),
      );
      b.addEventListener('click', (e) => {
        if (e.detail > 0) b.blur();
        this.onOpen(it.noteId);
      });
      this.tokens.appendChild(b);
    }
  }

  /** Testo a destra della striscia (Archivio, occasioni); chiave vuota = niente. */
  setInfo(key: string, params: Params): void {
    const k = `${key}|${JSON.stringify(params)}`;
    if (k === this.infoKey) return;
    this.infoKey = k;
    clear(this.info);
    if (key) this.info.appendChild(textOf(key, params, 'span'));
    fitText(this.info, 10);
  }

  layout(l: TomboloLayout): void {
    place(this.el, l.requests);
    this.el.style.paddingRight = `${l.lamp.w + 8}px`;
    fitText(this.info, 10);
  }
}

export interface NoteCardData {
  noteId: NoteId;
  authorName: string;
  textKey: string;
  statusKey: string;
  statusParams: Params;
  statusText: string;
  dropped: boolean;
  canDrop: boolean;
}

/** Contenuto della scheda di un bigliettino appuntato; `onAll` apre il pannello dei Bigliettini (layout stretto). */
export function noteCard(d: NoteCardData, onDrop: () => void, onAll?: () => void): HTMLElement {
  const body = el('div', { class: 'tb-note', test: `tb-bigliettino-${d.noteId}` });
  body.appendChild(textOf('tombolo.richieste.di', { nome: d.authorName }, 'h2', { className: 'tb-note-author' }));
  body.appendChild(textOf(d.textKey, undefined, 'p', { className: 'tb-note-text', rich: true }));
  const status = el('p', { class: 'tb-note-status', test: 'tb-bigliettino-stato' });
  status.appendChild(textOf(d.statusKey, d.statusParams, 'span'));
  body.appendChild(status);
  if (d.canDrop && !d.dropped) {
    const b = button({ labelKey: 'tombolo.richieste.lascia', kind: 'secondario', icon: 'chiudi', onClick: onDrop, test: 'tb-lascia-cadere' });
    body.appendChild(b);
  }
  if (onAll) body.appendChild(button({ labelKey: 'tombolo.richieste.tutti', kind: 'testo', icon: 'nota', onClick: onAll, test: 'tb-bigliettini' }));
  return body;
}

export function setStatus(node: HTMLElement, key: string, params: Params): void {
  node.dataset.i18n = key;
  setTextParams(node, params);
}

/** Contenuto della scheda di un obiettivo obbligatorio. */
export function goalCard(text: string, statusKey: string, statusParams: Params): HTMLElement {
  const body = el('div', { class: 'tb-note tb-goal', test: 'tb-obiettivo' });
  body.appendChild(textOf('tombolo.obiettivo.titolo', undefined, 'h2', { className: 'tb-note-author' }));
  body.appendChild(el('p', { class: 'tb-goal-text', text: text }));
  const status = el('p', { class: 'tb-note-status', test: 'tb-obiettivo-stato' });
  status.appendChild(textOf(statusKey, statusParams, 'span'));
  body.appendChild(status);
  return body;
}
