/**
 * Registrazione del pacchetto schermate (ARCHITETTURA 3.1, 5.5): scene
 * 'titolo', 'giornaliero', 'libero', 'impostazioni', 'crediti'; overlay
 * 'pausa' (il tombolo lo apre con Indietro, Esc o ≡), 'impostazioni' (sopra
 * la pausa), 'comandi' (tasti e gesti, dalla pausa) e 'spartito' (importa); risolutore dei livelli `lib-…` per
 * riprendere un Merletto libero dopo un ricaricamento; esiti delle notti delle
 * modalità; debug `__GAME__.ui`; CSS.
 */
import type { PanelHandle, Services } from '../core/types';
import { el } from '../core/ui/dom';
import { panel } from '../core/ui/components';
import { registerLevelResolver } from '../tombolo/index';
import './screens.css';
import { CreditiScene } from './CreditiScene';
import { GiornalieroScene } from './GiornalieroScene';
import { ImpostazioniScene } from './ImpostazioniScene';
import { LiberoScene } from './LiberoScene';
import { TitoloScene } from './TitoloScene';
import { registerUiDebug } from './debug';
import { parseLiberoId } from './libero';
import { installOutcomeListener } from './outcomes';
import { pausePanel } from './pausePanel';
import { comandiPanel } from './comandiPanel';
import { buildSettingsPanel } from './settingsPanel';
import { spartitoPanel } from './spartitoPanel';
import { liberoLevel } from './state';

/** Overlay 'impostazioni' (dal menu Pausa): lo stesso pannello, senza Importa e Cancella tutto. */
function settingsOverlay(s: Services, container: HTMLElement): PanelHandle {
  const p = buildSettingsPanel(s, { overlay: true });
  const box = panel({ variant: 'velluto', titleKey: 'ui.impostazioni.titolo', className: 'sc-impostazioni-overlay', test: 'sc-impostazioni-overlay', children: [p.el] });
  const wrap = el('div', { class: 'sc-overlay-impostazioni' }, box);
  container.appendChild(wrap);
  return {
    update: () => p.refresh(),
    destroy() {
      p.destroy();
      wrap.remove();
    },
  };
}

export function register(s: Services): void {
  s.scenes.register('titolo', () => new TitoloScene(s));
  s.scenes.register('giornaliero', () => new GiornalieroScene(s));
  s.scenes.register('libero', () => new LiberoScene(s));
  s.scenes.register('impostazioni', () => new ImpostazioniScene(s));
  s.scenes.register('crediti', () => new CreditiScene(s));

  s.ui.registerPanel('pausa', (c, o) => pausePanel(s, c, o));
  s.ui.registerPanel('impostazioni', (c) => settingsOverlay(s, c));
  s.ui.registerPanel('spartito', (c, o) => spartitoPanel(s, c, o));
  s.ui.registerPanel('comandi', (c) => comandiPanel(s, c));

  // Merletto libero: l'id non contiene dimensione e regola, ma il seme sì (prima lettera e hash).
  registerLevelResolver(async (id) => {
    const p = parseLiberoId(id);
    if (!p) return null;
    const gen = await liberoLevel(p.seed, p.gradi);
    return gen.level.id === id ? gen.level : null;
  });

  installOutcomeListener(s);
  registerUiDebug(s);
}
