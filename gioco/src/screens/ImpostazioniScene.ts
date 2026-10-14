/**
 * Scena 'impostazioni' (dal titolo): il pannello delle impostazioni a tutto
 * schermo, con Importa e Cancella tutto. Dopo Cancella tutto si torna al titolo.
 */
import type { Services } from '../core/types';
import { buildSettingsPanel, type SettingsPanel } from './settingsPanel';
import { ScreenScene } from './ScreenScene';
import { screenFrame } from './widgets';

export class ImpostazioniScene extends ScreenScene {
  readonly id = 'impostazioni' as const;
  private panel: SettingsPanel | null = null;

  constructor(s: Services) {
    super(s);
    // I testi del pannello si ritraducono da soli: niente ricostruzione (il fuoco resta dov'è).
    this.rebuildOnLocale = false;
  }

  protected build(): HTMLElement {
    this.panel?.destroy();
    const f = screenFrame({ id: 'impostazioni', titleKey: 'ui.impostazioni.titolo', onBack: () => this.goBack() });
    this.panel = buildSettingsPanel(this.s, { overlay: false, onWiped: () => this.goBack() });
    f.body.appendChild(this.panel.el);
    return f.root;
  }

  protected override beforeExit(): void {
    this.panel?.destroy();
    this.panel = null;
  }
}
