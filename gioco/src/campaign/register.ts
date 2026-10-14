/**
 * Registrazione del pacchetto campagna (ARCHITETTURA 3.1, 5.4): le scene 'sera',
 * 'alba', 'bilancio', 'archivio', 'telaio' e 'finale'; i pannelli 'taccuino' e
 * 'bigliettini' (più quelli interni della sera, 'cp-nota' e 'cp-oggetto'); il debug
 * `__GAME__.campaign`; il CSS; l'ascolto di `night:complete` e delle stranezze scoperte.
 */
import type { Services } from '../core/types';
import './campaign.css';
import { controller } from './controller';
import { SeraScene } from './SeraScene';
import { AlbaScene } from './AlbaScene';
import { BilancioScene } from './BilancioScene';
import { ArchivioScene } from './ArchivioScene';
import { TelaioScene } from './TelaioScene';
import { FinaleScene } from './FinaleScene';
import { bigliettiniPanel, taccuinoPanel } from './taccuino/panel';
import { noteDetailPanel, objectPanel } from './notes';
import { registerCampaignDebug } from './debug';

export function register(s: Services): void {
  s.scenes.register('sera', () => new SeraScene(s));
  s.scenes.register('alba', () => new AlbaScene(s));
  s.scenes.register('bilancio', () => new BilancioScene(s));
  s.scenes.register('archivio', () => new ArchivioScene(s));
  s.scenes.register('telaio', () => new TelaioScene(s));
  s.scenes.register('finale', () => new FinaleScene(s));
  s.ui.registerPanel('taccuino', (container, opts) => taccuinoPanel(s, container, opts));
  s.ui.registerPanel('bigliettini', (container, opts) => bigliettiniPanel(s, container, opts));
  s.ui.registerPanel('cp-nota', (container, opts) => noteDetailPanel(s, container, opts));
  s.ui.registerPanel('cp-oggetto', (container) => objectPanel(s, container));
  controller.install();
  registerCampaignDebug(s);
}
