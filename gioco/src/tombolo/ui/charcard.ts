/**
 * Scheda del personaggio (GDD 11.1: pressione lunga o tasto destro su un fuso):
 * nome e ruolo, stranezze note, desiderio ("?" finché non è scoperto), memoria
 * di Ada (tre puntini, da g12). Per i lino e i fili sbiaditi una riga sola.
 * Nell'Archivio la stessa scheda serve a nominare i fili sbiaditi: la fila dei
 * candidati (con l'esca) e «Nomi dati: 2 di 4» (mai quanti sono giusti).
 */
import type { CharacterId, QuirkId } from '../../core/types';
import { el } from '../../core/ui/dom';
import { button, textOf } from '../../core/ui/components';
import { svgIcon } from '../../core/ui/glyphs';

export interface CharCardData {
  thread: string;
  nameText: string;
  roleKey: string | null;
  color: string;
  icon: string | null;
  kind: 'persona' | 'lino' | 'nero' | 'avorio' | 'sbiadito';
  quirks: QuirkId[];
  /** Righe del rancore già scritte («Teresa e Marta sono in rancore…»), D06. */
  rancor?: string[];
  desireKey: string | null;
  memoria: number | null;
  /**
   * Che cosa ha adesso, già scritto (R2-D4, Q033, Q052): «Porta la lettera per
   * Bepi.», «Ha la febbre.», «Il suo filo è annodato: in quest'ora non si muove.».
   */
  stato?: string[];
}

export function charCard(d: CharCardData): HTMLElement {
  const body = el('div', { class: 'tb-char', test: 'tb-scheda', data: { filo: d.thread } });
  const head = el('div', { class: 'tb-char-head' });
  const badge = el('span', { class: 'tb-char-badge', style: { '--tb-char-colore': d.color } });
  if (d.icon) badge.appendChild(svgIcon(d.icon, { size: 22 }));
  head.append(badge, el('h2', { class: 'tb-char-name', text: d.nameText }));
  body.appendChild(head);
  if (d.roleKey) body.appendChild(textOf(d.roleKey, undefined, 'p', { className: 'tb-char-role' }));
  if (d.stato && d.stato.length > 0) {
    body.appendChild(textOf('tombolo.scheda.adesso', undefined, 'h3', { className: 'tb-char-sub' }));
    const box = el('div', { class: 'tb-char-stato', test: 'tb-scheda-stato' });
    for (const line of d.stato) box.appendChild(el('p', { class: 'tb-char-line', text: line }));
    body.appendChild(box);
  }
  if (d.kind !== 'persona') {
    body.appendChild(textOf(`tombolo.scheda.tipo.${d.kind}`, undefined, 'p', { className: 'tb-char-kind' }));
    return body;
  }
  body.appendChild(textOf('tombolo.scheda.stranezze', undefined, 'h3', { className: 'tb-char-sub' }));
  if (d.quirks.length === 0) body.appendChild(textOf('tombolo.scheda.nessunaStranezza', undefined, 'p', { className: 'tb-char-line' }));
  for (const q of d.quirks) body.appendChild(textOf(`tombolo.stranezza.${q}`, undefined, 'p', { className: 'tb-char-line' }));
  for (const r of d.rancor ?? []) body.appendChild(el('p', { class: 'tb-char-line tb-char-rancore', test: 'tb-scheda-rancore', text: r }));
  body.appendChild(textOf('tombolo.scheda.desiderio', undefined, 'h3', { className: 'tb-char-sub' }));
  body.appendChild(d.desireKey ? textOf(d.desireKey, undefined, 'p', { className: 'tb-char-line', rich: true }) : textOf('tombolo.scheda.desiderioIgnoto', undefined, 'p', { className: 'tb-char-line' }));
  if (d.memoria !== null) {
    const dots = el('p', { class: 'tb-char-memoria', test: 'tb-scheda-memoria' });
    dots.appendChild(textOf('tombolo.scheda.memoria', { n: d.memoria }, 'span'));
    const row = el('span', { class: 'tb-char-dots', attrs: { 'aria-hidden': 'true' } });
    for (let i = 0; i < 3; i++) row.appendChild(el('span', { class: ['tb-dot', i < d.memoria && 'tb-dot--pieno'] }));
    dots.appendChild(row);
    body.appendChild(dots);
  }
  return body;
}

export interface NamePickerCandidate {
  id: CharacterId;
  name: string;
  icon: string;
  color: string;
  /** Il nome è già provvisorio su un altro filo: «sul filo 2» (toccandolo si sposta qui). */
  usedOn: string | null;
  /** Il nome è confermato su un altro filo: non si può dare. */
  locked: boolean;
}

export interface NamePickerData {
  thread: string;
  /** Etichetta del filo ("il filo sbiadito 2"). */
  threadText: string;
  candidates: NamePickerCandidate[];
  current: CharacterId | null;
  /** Nomi dati (provvisori o confermati) e fili sbiaditi in tutto (D05.2). */
  given: number;
  total: number;
}

/**
 * Scelta del nome di un filo sbiadito (Archivio, D05.2-5). Nessun contatore dei
 * giusti: «Nomi dati: 2 di 4 · si confermano a gruppi di tre giusti». Altezza
 * fissa: i candidati sono sempre gli stessi e «Togli il nome» c'è sempre
 * (disattivato se il filo non ha un nome), così un tocco non trova un pulsante
 * diverso da quello che il dito si aspetta.
 */
export function namePicker(d: NamePickerData, onPick: (c: CharacterId | null) => void): HTMLElement {
  const body = el('div', { class: 'tb-names', test: 'tb-nomina', data: { filo: d.thread } });
  body.appendChild(textOf('tombolo.archivio.chiE', { filo: d.threadText }, 'h2', { className: 'tb-names-title' }));
  const count = textOf('tombolo.archivio.nomiDati', { dati: d.given, totale: d.total }, 'p', { className: 'tb-names-count' });
  count.dataset.test = 'tb-nomina-dati';
  body.appendChild(count);
  const grid = el('div', { class: 'tb-names-grid', role: 'group' });
  for (const c of d.candidates) {
    const b = button({ label: c.name, kind: c.id === d.current ? 'primario' : 'carta', icon: c.icon, onClick: () => onPick(c.id), test: `tb-nomina-${c.id}` });
    b.style.setProperty('--tb-char-colore', c.color);
    b.setAttribute('aria-pressed', c.id === d.current ? 'true' : 'false');
    if (c.locked) {
      b.disabled = true;
      b.classList.add('tb-names-locked');
    }
    if (c.usedOn && c.id !== d.current) {
      const note = el('span', { class: 'tb-names-used', text: c.usedOn });
      b.appendChild(note);
    }
    grid.appendChild(b);
  }
  body.appendChild(grid);
  const off = button({ labelKey: 'tombolo.archivio.togli', kind: 'testo', onClick: () => onPick(null), test: 'tb-nomina-togli' });
  off.disabled = !d.current;
  body.appendChild(off);
  return body;
}
