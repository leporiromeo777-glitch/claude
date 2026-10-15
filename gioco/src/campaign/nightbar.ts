/**
 * Elementi della campagna sopra il tombolo (DOM della scena, sotto overlay e modali):
 *
 * - la barra con un solo pulsante che resta sul merletto finito: «Continua» dei finali
 *   (`cp-finale-continua`, D14: il merletto finito resta finché non si tocca) e «Torna
 *   alla cassapanca» dopo «Rileggi» (`cp-rileggi-chiudi`);
 * - l'avviso toccabile «Nuova pagina nel Libro: …» all'inizio della notte che introduce
 *   una regola (CAM-06, `cp-libro-avviso`): apre il Taccuino su quella pagina.
 *
 * Entrambi si tolgono da soli quando la scena del tombolo esce.
 *
 * Revisione 2: la barra si mette al posto del pulsante principale del tombolo (Q031), e
 * serve anche alla fine delle notti normali (R2-D5, `cp-notte-continua`).
 */
import type { Services } from '../core/types';
import { el } from '../core/ui/dom';
import { button, textOf } from '../core/ui/components';
import { svgIcon } from '../core/ui/glyphs';
import { sceneHost } from './ui';

const live = new Set<HTMLElement>();
let installed = false;

function install(s: Services): void {
  if (installed) return;
  installed = true;
  s.bus.on('scene:exit', ({ id }) => {
    if (id === 'tombolo') clearNightBars();
  });
}

/** Toglie barre e avvisi della campagna sopra il tombolo. */
export function clearNightBars(): void {
  for (const n of [...live]) n.remove();
  live.clear();
  for (const off of offs.splice(0)) off();
  for (const h of hosts) h.classList.remove('cp-con-barra');
  hosts.clear();
}

const offs: (() => void)[] = [];
const hosts = new Set<HTMLElement>();

/**
 * La barra prende il posto del pulsante principale del tombolo, spento a merletto finito
 * (Q031): stessa posizione e altezza, senza toccare i pulsanti accanto (menu, Taccuino);
 * il pulsante spento si nasconde (`cp-con-barra`). Senza il pulsante resta in basso al centro.
 */
export function placeOverMain(host: HTMLElement, bar: HTMLElement): boolean {
  const main = host.querySelector<HTMLElement>('[data-test="tb-fissa"]');
  if (!main) return false;
  const mr = main.getBoundingClientRect();
  if (mr.width <= 0 || mr.height <= 0) return false;
  const hr = host.getBoundingClientRect();
  let left = mr.left;
  let right = mr.right;
  const mid = (mr.left + mr.right) / 2;
  for (const b of main.parentElement?.children ?? []) {
    if (b === main || !(b instanceof HTMLElement) || b.hidden) continue;
    const r = b.getBoundingClientRect();
    if (r.width <= 0 || r.bottom <= mr.top || r.top >= mr.bottom) continue;
    if (r.left >= mid) right = Math.min(right, r.left - 6);
    else left = Math.max(left, r.right + 6);
  }
  if (right - left < 120) return false;
  bar.classList.add('cp-notte-barra--posto');
  bar.style.left = `${left - hr.left}px`;
  bar.style.top = `${mr.top - hr.top}px`;
  bar.style.width = `${right - left}px`;
  bar.style.height = `${mr.height}px`;
  host.classList.add('cp-con-barra');
  hosts.add(host);
  return true;
}

export interface NightBarOpts {
  labelKey: string;
  test: string;
  icon?: string;
  onClick: () => void;
}

/** Barra in basso con un pulsante (sul merletto finito). Restituisce la funzione che la toglie. */
export function showNightBar(s: Services, o: NightBarOpts): () => void {
  install(s);
  clearNightBars();
  let done = false;
  const remove = (): void => {
    bar.remove();
    live.delete(bar);
    if (![...live].some((n) => n.classList.contains('cp-notte-barra'))) {
      for (const h of hosts) h.classList.remove('cp-con-barra');
      hosts.clear();
    }
  };
  const b = button({
    labelKey: o.labelKey,
    icon: o.icon ?? 'avanti',
    kind: 'primario',
    onClick: () => {
      if (done) return;
      done = true;
      remove();
      o.onClick();
    },
    test: o.test,
  });
  const bar = el('div', { class: 'cp-notte-barra', test: `${o.test}-barra` }, b);
  const host = sceneHost(s);
  host.appendChild(bar);
  live.add(bar);
  placeOverMain(host, bar);
  if (typeof window !== 'undefined') {
    const onResize = (): void => {
      if (bar.isConnected) placeOverMain(host, bar);
    };
    window.addEventListener('resize', onResize);
    offs.push(() => window.removeEventListener('resize', onResize));
  }
  b.focus({ preventScroll: true });
  return remove;
}

/** Avviso toccabile in alto, che sparisce da solo dopo `ms`. */
export function showNightNotice(s: Services, o: { textKey: string; params?: Record<string, string | number>; test: string; onClick: () => void; ms?: number }): () => void {
  install(s);
  const node = el('button', { type: 'button', class: 'cp-notte-avviso core-solid', test: o.test }, svgIcon('libro', { size: 18 }), textOf(o.textKey, o.params, 'span', { rich: true }));
  let timer: ReturnType<typeof setTimeout> | null = null;
  const remove = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
    node.remove();
    live.delete(node);
  };
  node.addEventListener('click', (e) => {
    e.stopPropagation();
    remove();
    o.onClick();
  });
  sceneHost(s).appendChild(node);
  live.add(node);
  timer = setTimeout(remove, o.ms ?? 7000);
  return remove;
}
