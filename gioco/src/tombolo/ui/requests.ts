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
  /** Si compirebbe fissando l'ora (spunta tratteggiata, C07). */
  preview?: boolean;
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

/** Pulsante Obiettivi: contatore «2/5» e stato peggiore (C08, D06). */
export interface GoalsButtonState {
  done: number;
  total: number;
  status: CondStatus;
  /** Etichetta accessibile già tradotta. */
  label: string;
}

export class RequestStrip {
  readonly el: HTMLElement;
  /** Pulsante Obiettivi (apre l'elenco completo). */
  readonly goals: HTMLButtonElement;
  private readonly goalsCount: HTMLElement;
  private readonly tokens: HTMLElement;
  private readonly info: HTMLElement;
  private last = '';
  private lastGoals = '';
  private infoKey = '';

  constructor(private readonly onOpen: (noteId: NoteId) => void) {
    this.tokens = el('div', { class: 'tb-req-tokens', role: 'list' });
    this.info = el('span', { class: 'tb-req-info', test: 'tb-req-info' });
    this.goalsCount = el('span', { class: 'tb-obiettivi-conto' });
    this.goals = el(
      'button',
      { type: 'button', class: ['tb-obiettivi-btn', 'core-solid'], test: 'tb-obiettivi', hidden: true },
      el('span', { class: 'tb-token-chip' }, svgIcon('stella', { size: 16 })),
      this.goalsCount,
    );
    this.goals.addEventListener('click', (e) => {
      if (e.detail > 0) this.goals.blur();
      this.onOpen('obiettivi');
    });
    this.skip = el('button', { type: 'button', class: ['tb-salta', 'core-solid'], test: 'tb-salta-quiete', hidden: true });
    this.skip.addEventListener('click', (e) => {
      if (e.detail > 0) this.skip.blur();
      this.onSkip?.();
    });
    this.el = el('div', { class: 'tb-requests', test: 'tb-richieste' }, this.goals, this.tokens, this.info, this.skip);
  }

  /** «Fissa fino alle N» (Salta le ore quiete, D02.3). */
  readonly skip: HTMLButtonElement;
  onSkip: (() => void) | null = null;
  private lastSkip = '';

  /** Mostra (con l'ora già scritta) o nasconde il pulsante delle ore quiete. */
  setSkip(until: string | null): void {
    const k = until ?? '';
    if (k === this.lastSkip) return;
    this.lastSkip = k;
    this.skip.hidden = until === null;
    this.info.hidden = until !== null;
    if (until !== null) this.skip.replaceChildren(textOf('tombolo.azioni.saltaQuiete', { ora: until }, 'span'));
  }

  /** Pulsante Obiettivi con il contatore; null = niente da elencare. */
  setGoals(g: GoalsButtonState | null): void {
    const k = JSON.stringify(g);
    if (k === this.lastGoals) return;
    this.lastGoals = k;
    this.goals.hidden = !g;
    if (!g) return;
    this.goalsCount.textContent = `${g.done}/${g.total}`;
    this.goals.setAttribute('aria-label', g.label);
    this.goals.title = g.label;
    this.goals.dataset.stato = g.status;
    for (const st of ['in_corso', 'soddisfatta', 'a_rischio', 'fallita']) this.goals.classList.toggle(`tb-token--${st}`, g.status === st);
  }

  update(items: RequestToken[]): void {
    const key = JSON.stringify(items);
    if (key === this.last) return;
    this.last = key;
    clear(this.tokens);
    for (const it of items) {
      const st = it.dropped ? 'lasciata' : it.status;
      const glyph = it.preview ? 'spunta' : STATUS_GLYPH[st];
      const b = el(
        'button',
        {
          type: 'button',
          class: ['tb-token', 'core-solid', `tb-token--${st}`, it.goal && 'tb-token--obiettivo', it.preview && 'tb-token--anteprima'],
          role: 'listitem',
          label: it.label,
          title: it.label,
          test: it.goal ? `tb-${it.noteId.replace(':', '-')}` : `tb-richiesta-${it.noteId}`,
          data: { stato: st, anteprima: it.preview ? '1' : '0' },
          style: { '--tb-token-colore': it.color },
        },
        el('span', { class: 'tb-token-chip' }, svgIcon(it.icon, { size: 16 }), el('span', { class: 'tb-token-state' }, svgIcon(glyph, { size: 12 }))),
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
  /** La condizione esatta, sotto il testo del bigliettino (TOM-14): «La lettera per Don Piero: consegnata entro le 10». */
  condition?: string;
  dropped: boolean;
  canDrop: boolean;
}

/** Contenuto della scheda di un bigliettino appuntato; `onAll` apre il pannello dei Bigliettini (layout stretto). */
export function noteCard(d: NoteCardData, onDrop: () => void, onAll?: () => void): HTMLElement {
  const body = el('div', { class: 'tb-note', test: `tb-bigliettino-${d.noteId}` });
  body.appendChild(textOf('tombolo.richieste.di', { nome: d.authorName }, 'h2', { className: 'tb-note-author' }));
  body.appendChild(textOf(d.textKey, undefined, 'p', { className: 'tb-note-text', rich: true }));
  if (d.condition) body.appendChild(el('p', { class: 'tb-note-condizione', test: 'tb-bigliettino-condizione', text: d.condition }));
  const status = el('p', { class: 'tb-note-status', test: 'tb-bigliettino-stato' });
  status.appendChild(textOf(d.statusKey, d.statusParams, 'span'));
  body.appendChild(status);
  if (d.canDrop && !d.dropped) {
    const b = button({ labelKey: 'tombolo.richieste.lascia', kind: 'secondario', icon: 'chiudi', onClick: onDrop, test: 'tb-lascia-cadere' });
    body.appendChild(b);
  }
  if (onAll) body.appendChild(button({ labelKey: 'tombolo.richieste.tutti', kind: 'testo', icon: 'busta', onClick: onAll, test: 'tb-bigliettini' }));
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
