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
  sceneHost(s).appendChild(bar);
  live.add(bar);
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
