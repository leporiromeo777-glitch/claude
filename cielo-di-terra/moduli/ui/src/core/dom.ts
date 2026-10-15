/**
 * Piccoli aiuti per costruire il DOM senza framework.
 */

type Figlio = Node | string | number | null | undefined | false;
type Attributi = Record<string, string | number | boolean | null | undefined | EventListener>;

/**
 * Crea un elemento: h('button', { class: 'ui-voce', type: 'button', onclick: fn }, 'Riprendi').
 * Gli attributi `on…` diventano ascoltatori; `true` scrive l'attributo vuoto; `false`/`null` lo omette.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attr: Attributi | null = null,
  ...figli: (Figlio | Figlio[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attr) {
    for (const [k, v] of Object.entries(attr)) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2), v as EventListener);
      } else if (k === 'class') {
        el.className = String(v);
      } else if (v === true) {
        el.setAttribute(k, '');
      } else {
        el.setAttribute(k, String(v));
      }
    }
  }
  aggiungi(el, figli);
  return el;
}

/** Elemento SVG con attributi. */
export function s<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attr: Record<string, string | number> = {},
  ...figli: (SVGElement | string)[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attr)) el.setAttribute(k, String(v));
  for (const f of figli) el.append(typeof f === 'string' ? document.createTextNode(f) : f);
  return el;
}

function aggiungi(el: Element, figli: (Figlio | Figlio[])[]): void {
  for (const f of figli) {
    if (Array.isArray(f)) aggiungi(el, f);
    else if (f === null || f === undefined || f === false) continue;
    else if (typeof f === 'string' || typeof f === 'number') el.append(document.createTextNode(String(f)));
    else el.append(f);
  }
}

/** Svuota un elemento. */
export function svuota(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

const SELETTORE_FOCUS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Elementi raggiungibili con Tab dentro `el`, nell'ordine del documento. */
export function focalizzabili(el: HTMLElement): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>(SELETTORE_FOCUS)].filter(
    (x) => !x.closest('[hidden]') && !x.closest('[inert]') && x.getAttribute('aria-hidden') !== 'true',
  );
}

/**
 * Tiene il focus dentro `el` quando si preme Tab (finestre modali).
 * Restituisce la funzione che toglie la trappola.
 */
export function trappolaFocus(el: HTMLElement): () => void {
  const suTasto = (e: KeyboardEvent): void => {
    if (e.key !== 'Tab') return;
    const lista = focalizzabili(el);
    if (lista.length === 0) {
      e.preventDefault();
      return;
    }
    const primo = lista[0]!;
    const ultimo = lista[lista.length - 1]!;
    const attivo = document.activeElement;
    if (e.shiftKey && (attivo === primo || !el.contains(attivo))) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && (attivo === ultimo || !el.contains(attivo))) {
      e.preventDefault();
      primo.focus();
    }
  };
  el.addEventListener('keydown', suTasto);
  return () => el.removeEventListener('keydown', suTasto);
}

/**
 * Navigazione con le frecce in un elenco verticale di voci (menu).
 * Su/Giù (e Home/Fine) spostano il focus fra le voci abilitate; il giro si chiude.
 */
export function navigazioneFrecce(contenitore: HTMLElement, selettore: string): () => void {
  const suTasto = (e: KeyboardEvent): void => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const voci = [...contenitore.querySelectorAll<HTMLElement>(selettore)].filter(
      (v) => !(v as HTMLButtonElement).disabled && v.getAttribute('aria-disabled') !== 'true' && !v.closest('[hidden]'),
    );
    if (voci.length === 0) return;
    const i = voci.indexOf(document.activeElement as HTMLElement);
    let j = i;
    if (e.key === 'ArrowDown') j = i < 0 ? 0 : (i + 1) % voci.length;
    else if (e.key === 'ArrowUp') j = i < 0 ? voci.length - 1 : (i - 1 + voci.length) % voci.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = voci.length - 1;
    e.preventDefault();
    voci[j]!.focus();
  };
  contenitore.addEventListener('keydown', suTasto);
  return () => contenitore.removeEventListener('keydown', suTasto);
}

/** Generatore pseudo-casuale deterministico (mulberry32): stessi bordi di carta a ogni apertura. */
export function casuale(seme: number): () => number {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash semplice di una stringa (per scegliere un seme da un id). */
export function hashStringa(testo: string): number {
  let h = 2166136261;
  for (let i = 0; i < testo.length; i++) {
    h ^= testo.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Vero se l'interfaccia deve evitare i movimenti (impostazione o preferenza del sistema). */
export function movimentiRidotti(radice: Element | null): boolean {
  if (radice?.closest('.ui-ridotto')) return true;
  return false;
}

/** Attende un fotogramma (utile per far partire le transizioni CSS). */
export function fotogramma(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}
