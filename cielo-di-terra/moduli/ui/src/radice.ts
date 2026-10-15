import { assicuraFiltri } from './core/filtri';
import { SCALE_TESTO, type Impostazioni } from './impostazioni/store';
import './stile/caratteri';
import './stile/base.css';

/**
 * Crea il livello dell'interfaccia dentro `contenitore` (di solito lo stesso elemento che contiene il canvas,
 * oppure `document.body`). Il livello copre tutto lo schermo, è trasparente e lascia passare il mouse
 * tranne dove c'è un componente aperto che lo vuole.
 */
export function creaRadice(contenitore: HTMLElement): HTMLElement {
  const radice = contenitore.ownerDocument.createElement('div');
  radice.className = 'ui-radice';
  radice.lang = 'it';
  contenitore.append(radice);
  assicuraFiltri(radice);
  // Regione «aria-live» per annunciare notifiche e cambi di stato ai lettori di schermo.
  const annunci = contenitore.ownerDocument.createElement('div');
  annunci.className = 'ui-sr ui-annunci';
  annunci.setAttribute('aria-live', 'polite');
  annunci.setAttribute('role', 'status');
  radice.append(annunci);
  return radice;
}

/** Annuncia un testo ai lettori di schermo (senza mostrarlo). */
export function annuncia(radice: HTMLElement, testo: string): void {
  const el = radice.querySelector('.ui-annunci');
  if (!el) return;
  el.textContent = '';
  // Il cambio in due tempi fa ripetere l'annuncio anche se il testo è uguale.
  setTimeout(() => {
    el.textContent = testo;
  }, 30);
}

/** Applica alla radice le impostazioni che riguardano l'aspetto dell'interfaccia. */
export function applicaImpostazioniVisive(radice: HTMLElement, imp: Readonly<Impostazioni>): void {
  radice.style.setProperty('--ui-scala', String(SCALE_TESTO[imp.dimensioneTesto] ?? 1));
  radice.style.setProperty('--ui-sfondo-sottotitoli', String(imp.sfondoSottotitoli));
  radice.classList.toggle('ui-ridotto', imp.riduciMovimenti);
  radice.classList.toggle('ui-semplice', imp.calligrafia === 'semplice');
  radice.classList.toggle('ui-leggibile', imp.caratteriLeggibili);
  radice.classList.toggle('ui-contrasto', imp.altoContrasto);
  radice.classList.toggle('ui-senza-sottotitoli', !imp.sottotitoli);
  radice.classList.toggle('ui-senza-suoni', !imp.sottotitoliSuoni);
  radice.classList.toggle('ui-senza-puntino', !imp.puntino);
  radice.classList.toggle('ui-senza-suggerimenti', !imp.suggerimentiComandi);
  radice.classList.toggle('ui-senza-archi', !imp.indicatoriFiato);
  radice.classList.toggle('ui-matita-marcata', imp.matitaMarcata);
}
