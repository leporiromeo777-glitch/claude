/**
 * Piccolo aiuto per il DOM (ARCHITETTURA 1, 5.1): niente framework, niente
 * innerHTML. `el(tag, props, ...figli)` crea un elemento; i testi diventano nodi
 * di testo, quindi nessun contenuto viene mai interpretato come HTML.
 */
import type { Unsub } from '../types';

export type Child = Node | string | number | boolean | null | undefined | readonly Child[];

export interface ElProps {
  class?: string | readonly (string | false | null | undefined)[];
  id?: string;
  /** Testo del nodo (textContent). */
  text?: string;
  /** Proprietà CSS (anche variabili `--x`), con setProperty. */
  style?: Record<string, string | number | null | undefined>;
  /** dataset: `{ test: 'ok' }` → data-test="ok". */
  data?: Record<string, string | number | boolean | null | undefined>;
  /** Attributi qualsiasi; false/null/undefined li toglie, true li mette vuoti. */
  attrs?: Record<string, string | number | boolean | null | undefined>;
  on?: { [K in keyof HTMLElementEventMap]?: (e: HTMLElementEventMap[K]) => void };
  role?: string;
  title?: string;
  tabIndex?: number;
  hidden?: boolean;
  disabled?: boolean;
  type?: string;
  value?: string;
  /** aria-label */
  label?: string;
  /** Attributo stabile per i test: data-test. */
  test?: string;
}

export function append(parent: Node, ...children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false || c === true) continue;
    if (Array.isArray(c)) append(parent, ...(c as Child[]));
    else if (typeof c === 'string' || typeof c === 'number') parent.appendChild(document.createTextNode(String(c)));
    else parent.appendChild(c as Node);
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: ElProps | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props) {
    if (props.class) {
      const cls = typeof props.class === 'string' ? props.class : props.class.filter(Boolean).join(' ');
      if (cls) node.className = cls;
    }
    if (props.id) node.id = props.id;
    if (props.text !== undefined) node.textContent = props.text;
    if (props.style) {
      for (const [k, v] of Object.entries(props.style)) {
        if (v === null || v === undefined) continue;
        const prop = k.startsWith('--') ? k : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
        node.style.setProperty(prop, String(v));
      }
    }
    if (props.data) {
      for (const [k, v] of Object.entries(props.data)) if (v !== null && v !== undefined && v !== false) node.dataset[k] = String(v);
    }
    if (props.attrs) {
      for (const [k, v] of Object.entries(props.attrs)) {
        if (v === null || v === undefined || v === false) node.removeAttribute(k);
        else node.setAttribute(k, v === true ? '' : String(v));
      }
    }
    if (props.on) {
      for (const [ev, fn] of Object.entries(props.on)) {
        if (fn) node.addEventListener(ev, fn as EventListener);
      }
    }
    if (props.role) node.setAttribute('role', props.role);
    if (props.title) node.title = props.title;
    if (props.tabIndex !== undefined) node.tabIndex = props.tabIndex;
    if (props.hidden) node.hidden = true;
    if (props.disabled !== undefined && 'disabled' in node) (node as HTMLButtonElement).disabled = props.disabled;
    if (props.type) node.setAttribute('type', props.type);
    if (props.value !== undefined && 'value' in node) (node as HTMLInputElement).value = props.value;
    if (props.label) node.setAttribute('aria-label', props.label);
    if (props.test) node.dataset.test = props.test;
  }
  append(node, ...children);
  return node;
}

/** Svuota un nodo. */
export function clear(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** addEventListener che restituisce la funzione per toglierlo. */
export function on<K extends keyof HTMLElementEventMap>(
  node: EventTarget,
  ev: K | string,
  fn: (e: HTMLElementEventMap[K]) => void,
  opts?: AddEventListenerOptions | boolean,
): Unsub {
  node.addEventListener(ev, fn as EventListener, opts);
  return () => node.removeEventListener(ev, fn as EventListener, opts);
}

/** Sostituisce i figli di un nodo. */
export function replaceChildren(node: Element, ...children: Child[]): void {
  clear(node);
  append(node, ...children);
}
