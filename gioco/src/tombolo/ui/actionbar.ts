/**
 * Barra delle azioni (GDD 10.3, 72 px): ≡ Menu (48) · ↶ Disfa (64) ·
 * Fissa l'ora (grande, 120) · Taccuino (64). All'ultima riga "Fissa l'ora"
 * diventa "Chiudi il merletto". Nelle altre modalità il pulsante grande cambia:
 * "Lascia accadere" / "Riprova" (occasioni), "Salta" (spartito), "Chiudi il
 * merletto" (Archivio rammendato). Un pulsante può pulsare (tutorial).
 */
import { el } from '../../core/ui/dom';
import { button, iconButton, setTextParams } from '../../core/ui/components';
import type { TomboloLayout } from '../layout';
import { fitText, place } from './popup';

export type PulseTarget = 'fissa' | 'taccuino' | 'nome' | 'disfa' | null;

export interface ActionBarHandlers {
  menu(): void;
  undo(): void;
  main(): void;
  notebook(): void;
}

export interface ActionBarState {
  mainKey: string;
  mainEnabled: boolean;
  undoEnabled: boolean;
  undoVisible: boolean;
  pulse: PulseTarget;
}

/** Dopo un clic del mouse il fuoco lascia il pulsante, così Spazio e Invio restano al merletto. */
function releaseFocus(e: MouseEvent, b: HTMLElement): void {
  if (e.detail > 0) b.blur();
}

export class ActionBar {
  readonly el: HTMLElement;
  readonly menu: HTMLButtonElement;
  readonly undo: HTMLButtonElement;
  readonly main: HTMLButtonElement;
  readonly notebook: HTMLButtonElement;
  private last = '';

  constructor(h: ActionBarHandlers) {
    this.menu = iconButton({ icon: 'menu', labelKey: 'tombolo.azioni.menu', size: 48, onClick: (e) => (releaseFocus(e, this.menu), h.menu()), test: 'tb-menu', className: 'tb-act tb-act-menu' });
    this.undo = iconButton({ icon: 'disfa', labelKey: 'tombolo.azioni.disfa', size: 64, onClick: (e) => (releaseFocus(e, this.undo), h.undo()), test: 'tb-disfa', className: 'tb-act tb-act-disfa' });
    this.main = button({ labelKey: 'tombolo.azioni.fissa', kind: 'primario', size: 'grande', onClick: (e) => (releaseFocus(e, this.main), h.main()), test: 'tb-fissa', className: 'tb-act tb-act-fissa' });
    this.notebook = iconButton({ icon: 'taccuino', labelKey: 'tombolo.azioni.taccuino', size: 64, onClick: (e) => (releaseFocus(e, this.notebook), h.notebook()), test: 'tb-taccuino', className: 'tb-act tb-act-taccuino' });
    // I suoni dei pulsanti del tombolo arrivano dagli eventi della notte.
    for (const b of [this.undo, this.main]) b.dataset.audioSilent = '1';
    this.el = el('nav', { class: 'tb-actions', test: 'tb-azioni' }, this.menu, this.undo, this.main, this.notebook);
  }

  update(s: ActionBarState): void {
    const key = JSON.stringify(s);
    if (key === this.last) return;
    this.last = key;
    const label = this.main.querySelector<HTMLElement>('.core-btn-label');
    if (label && label.dataset.i18n !== s.mainKey) {
      label.dataset.i18n = s.mainKey;
      setTextParams(label, {});
      fitText(label, 12);
    }
    this.main.disabled = !s.mainEnabled;
    this.undo.disabled = !s.undoEnabled;
    this.undo.hidden = !s.undoVisible;
    this.main.classList.toggle('tb-pulsa', s.pulse === 'fissa');
    this.undo.classList.toggle('tb-pulsa', s.pulse === 'disfa');
    this.notebook.classList.toggle('tb-pulsa', s.pulse === 'taccuino');
  }

  /** Riga non valida: "Fissa l'ora" trema (oltre alla vibrazione). */
  shake(): void {
    this.main.classList.remove('tb-trema');
    void this.main.offsetWidth;
    this.main.classList.add('tb-trema');
  }

  layout(l: TomboloLayout): void {
    place(this.el, l.actions);
    const label = this.main.querySelector<HTMLElement>('.core-btn-label');
    if (label) fitText(label, 12);
  }
}
