/**
 * Pagina dei comandi (revisione 1, C10, SCH-03; GDD 11): overlay 'comandi',
 * aperto dalla Pausa con `sc-pausa-comandi`. Elenca i tasti, generati dalla
 * mappa dei tasti del core (`KEY_HELP` in keymap.ts), e i gesti del tocco e del
 * mouse (GDD 11.1-11.2), compreso il clic destro sul fuso.
 */
import type { PanelHandle, Services } from '../core/types';
import { KEY_HELP, keyLabelParts, type KeyHelp } from '../core/keymap';
import type { KeyInfo } from '../core/keymap';
import { el } from '../core/ui/dom';
import { panel, textOf } from '../core/ui/components';
import { sectionTitle } from './widgets';

/** Gesti del tocco e del mouse (GDD 11.1 e 11.2), nell'ordine della pagina. */
export const GESTURE_HELP = [
  'trascina', 'rilascia', 'toccaIncrocio', 'trascinaFuori', 'pressioneLunga', 'clicDestro',
  'toccaSpillo', 'scorri', 'rigaPassata', 'appuntaNome', 'indietroAndroid',
] as const;

/** Un tasto come elemento <kbd> (modificatori + nome). */
function kbd(s: Services, k: KeyInfo): HTMLElement {
  const parts = keyLabelParts(k);
  const box = el('kbd', { class: 'sc-tasto' });
  for (const m of parts.mods) {
    box.appendChild(el('kbd', { class: 'sc-tasto-pezzo' }, textOf(`ui.comandi.tasto.${m}`, undefined, 'span')));
    box.appendChild(document.createTextNode('+'));
  }
  const name = parts.name;
  if (parts.named) box.appendChild(el('kbd', { class: 'sc-tasto-pezzo' }, textOf(`ui.comandi.tasto.${name}`, undefined, 'span')));
  else box.appendChild(el('kbd', { class: 'sc-tasto-pezzo' }, name));
  void s;
  return box;
}

function keysCell(s: Services, h: KeyHelp): HTMLElement {
  const cell = el('dt', { class: 'sc-comandi-tasti' });
  h.keys.forEach((k, i) => {
    if (i > 0) cell.appendChild(el('span', { class: 'sc-comandi-sep' }, h.range ? '–' : ' / '));
    cell.appendChild(kbd(s, k));
  });
  return cell;
}

export function comandiPanel(s: Services, container: HTMLElement): PanelHandle {
  const keys = el('dl', { class: 'sc-comandi-lista', test: 'sc-comandi-tasti' });
  for (const h of KEY_HELP) {
    const id = h.id;
    const ctx = h.context;
    const desc = el('dd', { class: 'sc-comandi-desc' }, textOf(`ui.comandi.azione.${id}`, undefined, 'span'));
    if (ctx) desc.appendChild(textOf(`ui.comandi.contesto.${ctx}`, undefined, 'span', { className: 'sc-comandi-contesto' }));
    keys.appendChild(el('div', { class: 'sc-comandi-riga', test: `sc-comandi-${h.id}`, data: { actions: h.actions.join(' ') } }, keysCell(s, h), desc));
  }
  const gestures = el('dl', { class: 'sc-comandi-lista', test: 'sc-comandi-gesti' });
  for (const g of GESTURE_HELP) {
    gestures.appendChild(
      el(
        'div',
        { class: 'sc-comandi-riga', test: `sc-comandi-gesto-${g}` },
        el('dt', { class: 'sc-comandi-gesto' }, textOf(`ui.comandi.gesto.${g}.come`, undefined, 'span')),
        el('dd', { class: 'sc-comandi-desc' }, textOf(`ui.comandi.gesto.${g}.cosa`, undefined, 'span')),
      ),
    );
  }
  const p = panel({
    variant: 'velluto',
    titleKey: 'ui.comandi.titolo',
    className: 'sc-comandi',
    test: 'sc-comandi',
    children: [
      textOf('ui.comandi.intro', undefined, 'p', { className: 'sc-nota' }),
      sectionTitle('ui.comandi.sezione.tocco', 'mano'),
      gestures,
      sectionTitle('ui.comandi.sezione.tastiera', 'tastiera'),
      keys,
    ],
  });
  container.classList.add('sc-overlay-comandi');
  const wrap = el('div', { class: 'sc-comandi-wrap' }, p);
  container.appendChild(wrap);
  return {
    destroy() {
      container.classList.remove('sc-overlay-comandi');
      wrap.remove();
    },
  };
}
