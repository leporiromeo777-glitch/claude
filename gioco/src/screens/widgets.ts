/**
 * Pezzi d'interfaccia comuni alle schermate (prefisso CSS `sc-`): cornice di
 * una schermata con il pulsante Indietro, scelta a segmenti (gruppo radio),
 * righe di statistiche, pulsanti con icona e didascalia. Tutti i testi
 * arrivano da chiavi i18n (textOf: si ritraducono al cambio di lingua).
 */
import type { Services } from '../core/types';
import type { CoreUiLayer } from '../core/ui/layer';
import { el, type Child } from '../core/ui/dom';
import { arrowNavigation, iconButton, textOf, uid } from '../core/ui/components';
import { icon } from './icons';

type Params = Record<string, string | number>;

/** Contenitore del DOM delle scene (CoreUiLayer.sceneRoot, o #ui-root). */
export function sceneRoot(s: Services): HTMLElement {
  return (s.ui as Partial<CoreUiLayer>).sceneRoot ?? s.ui.root;
}

export interface FrameOpts {
  id: string;
  titleKey: string;
  titleParams?: Params;
  onBack: () => void;
  /** Foglio di carta (Libro, risultati) o pannello di velluto (impostazioni). */
  variant?: 'carta' | 'velluto';
  backKey?: string;
  wide?: boolean;
}

export interface Frame {
  root: HTMLElement;
  sheet: HTMLElement;
  body: HTMLElement;
  /** Piede fisso del foglio (azioni principali sempre a portata di pollice). */
  foot: HTMLElement;
  title: HTMLElement;
  back: HTMLButtonElement;
}

/** Cornice di una schermata: testata con Indietro e titolo, corpo che scorre. */
export function screenFrame(o: FrameOpts): Frame {
  const back = iconButton({
    icon: 'indietro',
    labelKey: o.backKey ?? 'ui.comune.indietro',
    onClick: () => o.onBack(),
    size: 48,
    kind: 'testo',
    className: 'sc-indietro',
    test: `sc-${o.id}-indietro`,
  });
  const title = textOf(o.titleKey, o.titleParams, 'h1', { className: 'sc-testata-titolo' });
  const head = el('header', { class: 'sc-testata' }, back, title);
  const body = el('div', { class: 'sc-corpo' });
  const foot = el('footer', { class: 'sc-piede' });
  const sheet = el(
    'section',
    { class: ['sc-foglio', 'core-solid', `sc-foglio--${o.variant ?? 'velluto'}`, o.wide && 'sc-foglio--largo'], test: `sc-${o.id}-foglio` },
    head,
    body,
    foot,
  );
  const root = el('div', { class: ['sc-schermo', `sc-schermo--${o.id}`], test: `sc-${o.id}` }, sheet);
  return { root, sheet, body, foot, title, back };
}

/** Titoletto di una sezione. */
export function sectionTitle(key: string, iconName?: string, params?: Params): HTMLElement {
  const h = el('h2', { class: 'sc-sezione-titolo' });
  if (iconName) h.appendChild(icon(iconName, 20));
  h.appendChild(textOf(key, params, 'span'));
  return h;
}

export function section(titleKey: string | null, iconName: string | undefined, test: string, ...children: Child[]): HTMLElement {
  return el('section', { class: 'sc-sezione', test }, titleKey ? sectionTitle(titleKey, iconName) : null, ...children);
}

export interface SegmentOption<T extends string | number> {
  value: T;
  labelKey: string;
  params?: Params;
  descKey?: string;
}

export interface SegmentedHandle<T extends string | number> {
  el: HTMLElement;
  set(v: T): void;
  get(): T;
  setDisabled(on: boolean): void;
}

/** Scelta a segmenti accessibile (role radiogroup; frecce, Home, Fine). */
export function segmented<T extends string | number>(o: {
  labelKey: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  test: string;
  disabled?: boolean;
  /** Etichetta solo per gli screen reader (quando un titolo di sezione la ripete già). */
  hideLabel?: boolean;
}): SegmentedHandle<T> {
  let value = o.value;
  let disabled = !!o.disabled;
  const labelId = uid('sc-seg');
  const label = textOf(o.labelKey, undefined, 'span', { className: o.hideLabel ? 'core-sr-only' : 'sc-segmenti-etichetta' });
  label.id = labelId;
  const group = el('div', { class: 'sc-segmenti-gruppo', role: 'radiogroup', attrs: { 'aria-labelledby': labelId }, test: o.test });
  const buttons = new Map<T, HTMLButtonElement>();
  const sync = (): void => {
    for (const [v, b] of buttons) {
      const on = v === value;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      b.classList.toggle('sc-segmento--scelto', on);
      b.disabled = disabled;
    }
  };
  const choose = (v: T, focus: boolean): void => {
    if (disabled) return;
    const changed = v !== value;
    value = v;
    sync();
    if (focus) buttons.get(v)?.focus();
    if (changed) o.onChange(v);
  };
  for (const opt of o.options) {
    const b = el('button', { type: 'button', class: 'sc-segmento', role: 'radio', test: `${o.test}-${String(opt.value)}` });
    b.appendChild(textOf(opt.labelKey, opt.params, 'span', { className: 'sc-segmento-testo' }));
    if (opt.descKey) b.appendChild(textOf(opt.descKey, opt.params, 'span', { className: 'sc-segmento-desc' }));
    b.addEventListener('click', () => choose(opt.value, false));
    buttons.set(opt.value, b);
    group.appendChild(b);
  }
  group.addEventListener('keydown', (e: KeyboardEvent) => {
    const list = o.options.map((x) => x.value);
    const i = list.indexOf(value);
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % list.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + list.length) % list.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = list.length - 1;
    if (next < 0) return;
    e.preventDefault();
    e.stopPropagation();
    const v = list[next];
    if (v !== undefined) choose(v, true);
  });
  sync();
  const wrap = el('div', { class: 'sc-segmenti core-solid' }, label, group);
  return {
    el: wrap,
    set(v) {
      value = v;
      sync();
    },
    get: () => value,
    setDisabled(on) {
      disabled = on;
      sync();
    },
  };
}

/** Riga etichetta → valore (statistiche, record). */
export function statRow(labelKey: string, value: HTMLElement | string, test?: string, labelParams?: Params): HTMLElement {
  const v = typeof value === 'string' ? el('span', { text: value }) : value;
  v.classList.add('sc-stat-valore');
  return el('div', { class: 'sc-stat', test }, textOf(labelKey, labelParams, 'span', { className: 'sc-stat-etichetta' }), v);
}

/** Pulsante a tutta larghezza con icona, etichetta e (facoltativa) didascalia. */
export function wideButton(o: {
  icon: string;
  labelKey: string;
  labelParams?: Params;
  subKey?: string;
  subParams?: Params;
  kind?: 'primario' | 'secondario' | 'carta' | 'pericolo';
  onClick: () => void;
  test: string;
  locked?: boolean;
  disabled?: boolean;
}): HTMLButtonElement {
  const b = el('button', {
    type: 'button',
    class: ['core-btn', `core-btn--${o.kind ?? 'secondario'}`, 'sc-voce', o.locked && 'sc-voce--chiusa'],
    test: o.test,
    disabled: !!o.disabled,
    attrs: { 'aria-disabled': o.locked ? 'true' : null },
    data: { bloccato: o.locked ? '1' : null },
  });
  const text = el('span', { class: 'sc-voce-testi' }, textOf(o.labelKey, o.labelParams, 'span', { className: 'sc-voce-etichetta' }));
  if (o.subKey) text.appendChild(textOf(o.subKey, o.subParams, 'span', { className: 'sc-voce-sotto' }));
  // Contenitore interno: in un riquadro stretto l'icona va sopra il testo (container query).
  b.appendChild(el('span', { class: 'sc-voce-dentro' }, icon(o.locked ? 'lucchetto' : o.icon, 22, 'sc-voce-icona'), text));
  b.addEventListener('click', () => {
    if (b.disabled) return;
    o.onClick();
  });
  return b;
}

/** Gruppo di pulsanti navigabile con le frecce. */
export function buttonGroup(items: HTMLElement[], className: string, test?: string, orientation: 'vertical' | 'horizontal' | 'both' = 'both'): HTMLElement {
  const g = el('div', { class: ['core-solid', className], role: 'group', test }, ...items);
  arrowNavigation(g, 'button', orientation);
  return g;
}

/** Messaggio in una riga (errori, avvisi) con regione aria-live. */
export function messageLine(test: string): { el: HTMLElement; show(key: string | null, params?: Params, kind?: 'errore' | 'info' | 'ok'): void } {
  const node = el('p', { class: 'sc-messaggio', test, role: 'status', attrs: { 'aria-live': 'polite' } });
  node.hidden = true;
  return {
    el: node,
    show(key, params, kind = 'info') {
      while (node.firstChild) node.removeChild(node.firstChild);
      if (!key) {
        node.hidden = true;
        return;
      }
      node.hidden = false;
      node.dataset.kind = kind;
      node.appendChild(textOf(key, params, 'span'));
    },
  };
}

/** Rimette il fuoco sul primo elemento utile di una schermata (tastiera subito pronta). */
export function focusFirst(root: HTMLElement, selector = '[data-autofocus], button:not([disabled])'): void {
  const target = root.querySelector<HTMLElement>(selector);
  target?.focus({ preventScroll: true });
}
