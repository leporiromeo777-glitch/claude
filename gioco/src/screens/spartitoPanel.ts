/**
 * Importa spartito (GDD 8.5, 10.3 "Merletto libero … Più Importa spartito"):
 * overlay 'spartito' con un campo dove incollare la stringa. Se è valida, il
 * tombolo la ritesse da solo (modo 'replay', origine 'spartito') mentre il
 * carillon la suona; se no, una riga spiega perché.
 */
import type { PanelHandle, SceneId, Services } from '../core/types';
import { el } from '../core/ui/dom';
import { panel, textOf } from '../core/ui/components';
import { launchSpartito } from './launch';
import { messageLine, wideButton } from './widgets';

export interface SpartitoPanelOptions {
  returnTo?: SceneId;
  /** Testo già pronto nel campo (per esempio dal debug). */
  value?: string;
}

export function spartitoPanel(s: Services, container: HTMLElement, raw?: unknown): PanelHandle {
  const o: SpartitoPanelOptions = raw && typeof raw === 'object' ? (raw as SpartitoPanelOptions) : {};
  const field = el('textarea', {
    class: 'sc-campo sc-campo--codice',
    attrs: { rows: 3, spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', placeholder: s.i18n.t('ui.spartito.segnaposto'), 'aria-label': s.i18n.t('ui.spartito.campo') },
    data: { i18nLabel: 'ui.spartito.campo' },
    test: 'sc-spartito-campo',
  });
  if (o.value) field.value = o.value;
  const msg = messageLine('sc-spartito-messaggio');
  let busy = false;
  const go = wideButton({
    icon: 'play',
    labelKey: 'ui.spartito.tessi',
    kind: 'primario',
    onClick: () => void submit(),
    test: 'sc-spartito-tessi',
  });
  const submit = async (): Promise<void> => {
    if (busy) return;
    busy = true;
    go.disabled = true;
    msg.show('ui.spartito.caricamento', undefined, 'info');
    const r = await launchSpartito(s, field.value, o.returnTo ?? (s.scenes.current() === 'giornaliero' ? 'giornaliero' : 'libero'));
    busy = false;
    go.disabled = false;
    if (r.ok) {
      msg.show(null);
      s.ui.closeOverlay();
      return;
    }
    msg.show(r.errorKey, undefined, 'errore');
    field.focus();
  };
  field.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  });
  const p = panel({
    variant: 'velluto',
    titleKey: 'ui.spartito.titolo',
    className: 'sc-spartito',
    test: 'sc-spartito',
    children: [textOf('ui.spartito.aiuto', undefined, 'p', { className: 'sc-nota' }), field, msg.el, go],
  });
  container.classList.add('sc-overlay-stretto');
  container.appendChild(p);
  // Il fuoco va al campo (il core lo darebbe al primo elemento: è già il campo).
  setTimeout(() => field.focus({ preventScroll: true }), 0);
  return {
    destroy() {
      container.classList.remove('sc-overlay-stretto');
      p.remove();
    },
  };
}
