/**
 * Componenti a tema (ARCHITETTURA 5.1, GDD 10.1): button, iconButton, panel,
 * tabs, slider, toggle, paperCard, modal, menuList. Bersagli di almeno 48 px,
 * focus sempre visibile, navigazione da tastiera (frecce nei gruppi).
 *
 * Tutti i testi arrivano da chiavi i18n. Gli elementi di testo creati qui hanno
 * `data-i18n` (e `data-i18n-params`): al cambio di lingua `retranslate(root)` li
 * riscrive senza ricostruire la schermata.
 */
import type { Handwriting } from '../types';
import { services, hasService } from '../services';
import { el, on, type Child } from './dom';
import { svgIcon } from './glyphs';
import { richText } from './richtext';

type Params = Record<string, string | number>;

let idCounter = 0;
/** Identificatori univoci e deterministici per legare etichette e controlli. */
export function uid(prefix: string): string {
  idCounter++;
  return `${prefix}-${idCounter}`;
}

function tr(key: string, params?: Params): string {
  return hasService('i18n') ? services.i18n.t(key, params) : key;
}

function missing(key: string): boolean {
  return import.meta.env.DEV && hasService('i18n') && !services.i18n.has(key);
}

/** Elemento di testo tradotto, che si aggiorna al cambio di lingua. */
export function textOf<K extends keyof HTMLElementTagNameMap = 'span'>(
  key: string,
  params?: Params,
  tag?: K,
  opts: { rich?: boolean; className?: string } = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag ?? 'span') as HTMLElementTagNameMap[K];
  node.dataset.i18n = key;
  if (params) node.dataset.i18nParams = JSON.stringify(params);
  if (opts.rich) node.dataset.i18nRich = '1';
  if (opts.className) node.className = opts.className;
  fillText(node, key, params, !!opts.rich);
  return node;
}

function fillText(node: HTMLElement, key: string, params: Params | undefined, rich: boolean): void {
  if (rich) {
    while (node.firstChild) node.removeChild(node.firstChild);
    node.appendChild(richText(key, params));
  } else {
    node.textContent = tr(key, params);
  }
  node.classList.toggle('core-missing-key', missing(key));
}

/** Riscrive i testi con data-i18n (e gli aria-label con data-i18n-label) sotto `root`. */
export function retranslate(root: ParentNode): void {
  for (const node of Array.from(root.querySelectorAll<HTMLElement>('[data-i18n]'))) {
    const key = node.dataset.i18n;
    if (!key) continue;
    let params: Params | undefined;
    try {
      params = node.dataset.i18nParams ? (JSON.parse(node.dataset.i18nParams) as Params) : undefined;
    } catch {
      params = undefined;
    }
    fillText(node, key, params, node.dataset.i18nRich === '1');
  }
  for (const node of Array.from(root.querySelectorAll<HTMLElement>('[data-i18n-label]'))) {
    const key = node.dataset.i18nLabel;
    if (key) {
      const text = tr(key);
      node.setAttribute('aria-label', text);
      if (node.hasAttribute('title')) node.title = text;
    }
  }
}

/** Aggiorna i parametri di un testo creato con textOf. */
export function setTextParams(node: HTMLElement, params: Params): void {
  node.dataset.i18nParams = JSON.stringify(params);
  const key = node.dataset.i18n;
  if (key) fillText(node, key, params, node.dataset.i18nRich === '1');
}

export type ButtonKind = 'primario' | 'secondario' | 'pericolo' | 'testo' | 'carta';

export interface ButtonOpts {
  labelKey?: string;
  params?: Params;
  /** Testo già pronto (per esempio un nome): da usare solo se non esiste una chiave. */
  label?: string;
  icon?: string;
  kind?: ButtonKind;
  size?: 'normale' | 'grande';
  onClick: (e: MouseEvent) => void;
  disabled?: boolean;
  test?: string;
  block?: boolean;
  className?: string;
}

export function button(o: ButtonOpts): HTMLButtonElement {
  const b = el('button', {
    type: 'button',
    class: ['core-btn', `core-btn--${o.kind ?? 'secondario'}`, o.size === 'grande' && 'core-btn--grande', o.block && 'core-btn--blocco', o.className],
    disabled: !!o.disabled,
    test: o.test,
  });
  if (o.icon) b.appendChild(svgIcon(o.icon, { size: 22 }));
  if (o.labelKey) b.appendChild(textOf(o.labelKey, o.params, 'span', { className: 'core-btn-label' }));
  else if (o.label) b.appendChild(el('span', { class: 'core-btn-label', text: o.label }));
  b.addEventListener('click', (e) => {
    if (b.disabled) return;
    o.onClick(e);
  });
  return b;
}

export interface IconButtonOpts {
  icon: string;
  labelKey: string;
  params?: Params;
  onClick: (e: MouseEvent) => void;
  size?: 48 | 56 | 64;
  kind?: ButtonKind;
  disabled?: boolean;
  test?: string;
  className?: string;
}

export function iconButton(o: IconButtonOpts): HTMLButtonElement {
  const size = o.size ?? 48;
  const label = tr(o.labelKey, o.params);
  const b = el('button', {
    type: 'button',
    class: ['core-btn', 'core-btn--icona', `core-btn--${o.kind ?? 'testo'}`, o.className],
    style: { '--btn-size': `${size}px` },
    label,
    title: label,
    disabled: !!o.disabled,
    test: o.test,
  });
  b.dataset.i18nLabel = o.labelKey;
  b.appendChild(svgIcon(o.icon, { size: Math.round(size * 0.5) }));
  b.addEventListener('click', (e) => {
    if (b.disabled) return;
    o.onClick(e);
  });
  return b;
}

export interface PanelOpts {
  titleKey?: string;
  params?: Params;
  variant?: 'carta' | 'velluto';
  className?: string;
  test?: string;
  children?: Child[];
}

export function panel(o: PanelOpts): HTMLElement {
  const p = el('section', {
    class: ['core-panel', 'core-solid', `core-panel--${o.variant ?? 'carta'}`, o.className],
    test: o.test,
  });
  if (o.titleKey) p.appendChild(textOf(o.titleKey, o.params, 'h2', { className: 'core-panel-title' }));
  const body = el('div', { class: 'core-panel-body' }, ...(o.children ?? []));
  p.appendChild(body);
  return p;
}

/** Navigazione con le frecce fra i figli focalizzabili di un gruppo. */
export function arrowNavigation(container: HTMLElement, selector: string, orientation: 'vertical' | 'horizontal' | 'both' = 'both'): () => void {
  return on(container, 'keydown', (e: KeyboardEvent) => {
    const prev = orientation !== 'horizontal' ? ['ArrowUp'] : [];
    const next = orientation !== 'horizontal' ? ['ArrowDown'] : [];
    if (orientation !== 'vertical') {
      prev.push('ArrowLeft');
      next.push('ArrowRight');
    }
    const items = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
      (x) => !(x as HTMLButtonElement).disabled && x.getClientRects().length > 0,
    );
    if (items.length === 0) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    let target = -1;
    if (prev.includes(e.key)) target = i <= 0 ? items.length - 1 : i - 1;
    else if (next.includes(e.key)) target = i < 0 || i >= items.length - 1 ? 0 : i + 1;
    else if (e.key === 'Home') target = 0;
    else if (e.key === 'End') target = items.length - 1;
    if (target < 0) return;
    e.preventDefault();
    e.stopPropagation();
    items[target]?.focus();
  });
}

export function menuList(items: HTMLElement[], o: { test?: string; orientation?: 'vertical' | 'horizontal'; className?: string } = {}): HTMLElement {
  const list = el('div', {
    class: ['core-menu', `core-menu--${o.orientation ?? 'vertical'}`, 'core-solid', o.className],
    role: 'group',
    test: o.test,
  }, ...items);
  arrowNavigation(list, 'button, [role="switch"], input', o.orientation ?? 'vertical');
  return list;
}

export interface TabDef {
  id: string;
  labelKey: string;
  icon?: string;
}

export interface TabsHandle {
  el: HTMLElement;
  select(id: string): void;
  selected(): string;
}

export function tabs(o: { tabs: TabDef[]; selected: string; onSelect: (id: string) => void; test?: string; className?: string }): TabsHandle {
  let current = o.selected;
  const buttons = new Map<string, HTMLButtonElement>();
  const bar = el('div', { class: ['core-tabs', 'core-solid', o.className], role: 'tablist', test: o.test });
  const sync = (): void => {
    for (const [id, b] of buttons) {
      const on = id === current;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      b.classList.toggle('core-tab--attiva', on);
    }
  };
  for (const t of o.tabs) {
    const b = el('button', { type: 'button', class: 'core-tab', role: 'tab', test: `${o.test ?? 'tab'}-${t.id}` });
    if (t.icon) b.appendChild(svgIcon(t.icon, { size: 20 }));
    b.appendChild(textOf(t.labelKey, undefined, 'span', { className: 'core-tab-label' }));
    b.addEventListener('click', () => {
      handle.select(t.id);
      o.onSelect(t.id);
    });
    buttons.set(t.id, b);
    bar.appendChild(b);
  }
  arrowNavigation(bar, '[role="tab"]', 'horizontal');
  bar.addEventListener('focusin', (e) => {
    // Con le frecce il fuoco si sposta: la scheda segue il fuoco.
    const id = [...buttons.entries()].find(([, b]) => b === e.target)?.[0];
    if (id && id !== current) {
      handle.select(id);
      o.onSelect(id);
    }
  });
  const handle: TabsHandle = {
    el: bar,
    select(id) {
      if (!buttons.has(id)) return;
      current = id;
      sync();
    },
    selected: () => current,
  };
  sync();
  return handle;
}

export interface SliderHandle {
  el: HTMLElement;
  input: HTMLInputElement;
  set(v: number): void;
}

export function slider(o: {
  labelKey: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onInput: (v: number) => void;
  /** Testo del valore (per esempio "80%"). */
  format?: (v: number) => string;
  test?: string;
}): SliderHandle {
  const id = uid('core-slider');
  const label = textOf(o.labelKey, undefined, 'label', { className: 'core-slider-label' });
  label.htmlFor = id;
  const out = el('output', { class: 'core-slider-value', attrs: { for: id } });
  const input = el('input', {
    id,
    type: 'range',
    class: 'core-slider-input',
    attrs: { min: o.min, max: o.max, step: o.step },
    test: o.test,
  });
  const show = (v: number): void => {
    out.textContent = o.format ? o.format(v) : String(v);
    input.setAttribute('aria-valuetext', out.textContent);
  };
  input.value = String(o.value);
  show(o.value);
  input.addEventListener('input', () => {
    const v = Number(input.value);
    show(v);
    o.onInput(v);
  });
  const wrap = el('div', { class: 'core-slider core-solid' }, el('div', { class: 'core-slider-head' }, label, out), input);
  return {
    el: wrap,
    input,
    set(v) {
      input.value = String(v);
      show(v);
    },
  };
}

export interface ToggleHandle {
  el: HTMLButtonElement;
  set(v: boolean): void;
  get(): boolean;
}

export function toggle(o: { labelKey: string; value: boolean; onChange: (v: boolean) => void; descriptionKey?: string; test?: string }): ToggleHandle {
  let value = o.value;
  const b = el('button', { type: 'button', class: 'core-toggle', role: 'switch', test: o.test });
  const text = el('span', { class: 'core-toggle-text' }, textOf(o.labelKey, undefined, 'span', { className: 'core-toggle-label' }));
  if (o.descriptionKey) text.appendChild(textOf(o.descriptionKey, undefined, 'span', { className: 'core-toggle-desc' }));
  b.append(text, el('span', { class: 'core-toggle-track', attrs: { 'aria-hidden': 'true' } }, el('span', { class: 'core-toggle-knob' })));
  const sync = (): void => {
    b.setAttribute('aria-checked', value ? 'true' : 'false');
  };
  b.addEventListener('click', () => {
    value = !value;
    sync();
    o.onChange(value);
  });
  sync();
  return {
    el: b,
    set(v) {
      value = v;
      sync();
    },
    get: () => value,
  };
}

const HAND_FONTS: Record<Handwriting['font'], string> = {
  caveat: 'var(--font-mano)',
  garamond: 'var(--font-libro)',
  atkinson: 'var(--font-ui)',
};

/** Stile della calligrafia di un personaggio (font, inchiostro, carta, inclinazione). */
export function handStyle(h: Handwriting): Record<string, string> {
  return {
    '--carta-colore': h.paper,
    '--inchiostro-colore': h.ink,
    '--mano-font': HAND_FONTS[h.font] ?? 'var(--font-mano)',
    '--mano-inclinazione': `${h.slantDeg}deg`,
    '--mano-scala': String(h.sizeScale),
    '--mano-maiuscole': h.caps ? 'uppercase' : 'none',
  };
}

/** Spostamento massimo (px) degli angoli di un foglio inclinato: un foglio alto si inclina meno (P057). */
export const MANO_SPOSTAMENTO_MAX = 12;

/**
 * Inclinazione (gradi) di un foglio scritto a mano alto `height` px: quella del
 * personaggio, al massimo ±3° (C17), e meno se il foglio è così alto che i suoi
 * angoli si sposterebbero di più di `maxShift` px. Così una lettera lunga (Clotilde
 * nel Taccuino a 360 px con il testo al 140%: quasi 1900 px) non esce dai lati del
 * contenitore che la taglia, e le iniziali delle righe e la firma restano visibili.
 */
export function slantForHeight(slantDeg: number, height: number, maxShift = MANO_SPOSTAMENTO_MAX): number {
  const want = Math.min(3, Math.abs(slantDeg));
  const sign = slantDeg < 0 ? -1 : 1;
  const half = height / 2;
  if (want === 0 || !(half > maxShift)) return sign * want;
  const allowed = (Math.asin(maxShift / half) * 180) / Math.PI;
  return sign * (Math.round(Math.min(want, allowed) * 100) / 100);
}

/** Tiene l'inclinazione di un foglio alto entro `slantForHeight` (si ricalcola quando cambia l'altezza). */
function keepTiltInside(card: HTMLElement, slantDeg: number): void {
  if (slantDeg === 0 || typeof ResizeObserver === 'undefined') return;
  const full = Math.min(3, Math.abs(slantDeg));
  new ResizeObserver(() => {
    const s = slantForHeight(slantDeg, card.offsetHeight);
    card.style.setProperty('--mano-inclinazione', Math.abs(s) < full ? `${s}deg` : `${slantDeg}deg`);
  }).observe(card);
}

export function paperCard(o: { children?: Child[]; hand?: Handwriting | null; onClick?: () => void; test?: string; className?: string; labelKey?: string }): HTMLElement {
  const interactive = !!o.onClick;
  const card = el(interactive ? 'button' : 'div', {
    class: ['core-carta', 'core-solid', o.hand && 'core-carta--mano', o.className],
    style: o.hand ? handStyle(o.hand) : undefined,
    test: o.test,
    type: interactive ? 'button' : undefined,
  }, el('div', { class: 'core-carta-testo' }, ...(o.children ?? [])));
  if (o.hand) keepTiltInside(card, o.hand.slantDeg);
  if (o.labelKey) {
    card.setAttribute('aria-label', tr(o.labelKey));
    card.dataset.i18nLabel = o.labelKey;
  }
  if (o.onClick) card.addEventListener('click', () => o.onClick?.());
  return card;
}

export function modal(o: {
  titleKey?: string;
  bodyKey?: string;
  params?: Params;
  body?: Child;
  actions: HTMLElement[];
  test?: string;
  className?: string;
}): HTMLElement {
  const titleId = uid('core-modal-title');
  const box = el('div', {
    class: ['core-modal', 'core-solid', o.className],
    role: 'dialog',
    attrs: { 'aria-modal': 'true', 'aria-labelledby': o.titleKey ? titleId : null },
    test: o.test,
  });
  if (o.titleKey) {
    const h = textOf(o.titleKey, o.params, 'h2', { className: 'core-modal-title' });
    h.id = titleId;
    box.appendChild(h);
  }
  if (o.bodyKey) box.appendChild(textOf(o.bodyKey, o.params, 'p', { className: 'core-modal-body', rich: true }));
  if (o.body) box.appendChild(el('div', { class: 'core-modal-body' }, o.body));
  const actions = el('div', { class: 'core-modal-actions' }, ...o.actions);
  arrowNavigation(actions, 'button', 'horizontal');
  box.appendChild(actions);
  return box;
}

/** Primo elemento focalizzabile dentro un contenitore. */
export function firstFocusable(root: ParentNode): HTMLElement | null {
  return root.querySelector<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
}
