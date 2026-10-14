/**
 * Menu Pausa (GDD 10.3 "Pausa"; ARCHITETTURA 5.5): overlay 'pausa' registrato in
 * UiLayer. Il tombolo lo apre con `{ from: 'tombolo', origin, levelId }` (anche
 * con il tasto Indietro di Android ed Esc).
 *
 * Riprendi · Ricomincia la notte · Lascia per ora (solo nell'Archivio, C10) ·
 * Taccuino (se il pannello esiste) · Comandi (C10) · Impostazioni (overlay sopra
 * la pausa) · Torna al titolo. Tutto è già salvato: il tombolo salva la notte a
 * ogni ora fissata e quando la scena si chiude.
 */
import type { NightOrigin, PanelHandle, Services } from '../core/types';
import type { CoreUiLayer } from '../core/ui/layer';
import { el } from '../core/ui/dom';
import { panel, textOf } from '../core/ui/components';
import { activeNight } from '../tombolo/index';
import { laceEdge } from './icons';
import { buttonGroup, wideButton } from './widgets';

export interface PauseOptions {
  from?: string;
  origin?: NightOrigin;
  levelId?: string;
}

function hasPanel(s: Services, id: string): boolean {
  const ui = s.ui as Partial<CoreUiLayer>;
  return typeof ui.hasPanel === 'function' ? ui.hasPanel(id) : false;
}

export function pausePanel(s: Services, container: HTMLElement, raw?: unknown): PanelHandle {
  const o: PauseOptions = raw && typeof raw === 'object' ? (raw as PauseOptions) : {};
  const fromNight = o.from === 'tombolo' || (s.scenes.current() === 'tombolo' && !!activeNight());
  const replay = o.origin === 'spartito';

  const resume = wideButton({ icon: 'play', labelKey: 'ui.pausa.riprendi', kind: 'primario', onClick: () => s.ui.closeOverlay(), test: 'sc-pausa-riprendi' });
  const items: HTMLElement[] = [resume];
  if (fromNight) {
    items.push(
      wideButton({
        icon: 'ricomincia',
        labelKey: replay ? 'ui.pausa.ricominciaSpartito' : 'ui.pausa.ricomincia',
        onClick: () => {
          void s.ui
            .confirm({
              titleKey: 'ui.pausa.ricominciaDomanda.titolo',
              bodyKey: replay ? 'ui.pausa.ricominciaDomanda.corpoSpartito' : 'ui.pausa.ricominciaDomanda.corpo',
              okKey: 'ui.pausa.ricominciaDomanda.ok',
              cancelKey: 'ui.pausa.ricominciaDomanda.annulla',
              danger: !replay,
            })
            .then((ok) => {
              if (!ok) return;
              s.ui.closeOverlay();
              activeNight()?.restart();
            });
        },
        test: 'sc-pausa-ricomincia',
      }),
    );
  }
  // C10: dall'Archivio si torna alla cassapanca senza perdere i nomi confermati.
  if (o.origin === 'archivio') {
    items.push(
      wideButton({
        icon: 'cassapanca',
        labelKey: 'ui.pausa.lascia',
        onClick: () => {
          s.ui.closeOverlay();
          void s.scenes.go('archivio', { cmd: 'lascia', levelId: o.levelId });
        },
        test: 'sc-pausa-lascia',
      }),
    );
  }
  if (hasPanel(s, 'taccuino')) {
    items.push(
      wideButton({
        icon: 'taccuino',
        labelKey: 'ui.pausa.taccuino',
        onClick: () => void s.ui.openOverlay('taccuino', { from: o.from ?? 'pausa', levelId: o.levelId }),
        test: 'sc-pausa-taccuino',
      }),
    );
  }
  items.push(
    wideButton({
      icon: 'tastiera',
      labelKey: 'ui.pausa.comandi',
      onClick: () => void s.ui.openOverlay('comandi', { from: 'pausa' }),
      test: 'sc-pausa-comandi',
    }),
    wideButton({
      icon: 'ingranaggio',
      labelKey: 'ui.pausa.impostazioni',
      onClick: () => void s.ui.openOverlay('impostazioni', { from: 'pausa' }),
      test: 'sc-pausa-impostazioni',
    }),
    wideButton({
      icon: 'casa',
      labelKey: 'ui.pausa.titolo',
      onClick: () => {
        s.ui.closeOverlay();
        void s.scenes.go(s.scenes.has('titolo') ? 'titolo' : 'boot');
      },
      test: 'sc-pausa-esci',
    }),
  );
  const note = replay ? null : textOf('ui.pausa.salvato', undefined, 'p', { className: 'sc-nota sc-pausa-nota' });
  const p = panel({
    variant: 'velluto',
    className: 'sc-pausa',
    test: 'sc-pausa',
    children: [laceEdge('sc-smerlo sc-smerlo--pausa', 7), note, buttonGroup(items, 'sc-azioni', 'sc-pausa-azioni', 'vertical')],
  });
  const title = textOf('ui.pausa.titoloPannello', undefined, 'h2', { className: 'core-panel-title sc-pausa-titolo' });
  p.prepend(title);
  p.setAttribute('aria-label', s.i18n.t('ui.pausa.titoloPannello'));
  container.classList.add('sc-overlay-stretto');
  container.appendChild(el('div', { class: 'sc-pausa-wrap' }, p));
  return {
    destroy() {
      container.classList.remove('sc-overlay-stretto');
      p.parentElement?.remove();
    },
  };
}
