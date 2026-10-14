/**
 * Pagina del Libro dei Punti con la regola di un merletto procedurale (GDD 8.3:
 * «appare la pagina del Libro con la regola, senza note di storia»): titolo e
 * testo della pagina dai contenuti (book.json), senza la nota a margine di Clotilde.
 */
import type { BookPageDef, RuleId, Services } from '../core/types';
import { el } from '../core/ui/dom';
import { textOf } from '../core/ui/components';

/** Pagine del Libro per una regola (la regola 'segreto' ha anche quella del pozzo). */
export function bookPagesFor(s: Pick<Services, 'content' | 'i18n'>, rule: RuleId): BookPageDef[] {
  return s.content.book.filter((p) => p.rule === rule && s.i18n.has(p.titleKey) && s.i18n.has(p.textKey));
}

/** Titolo breve della regola (per le righe d'informazione). */
export function ruleTitleKey(s: Pick<Services, 'content' | 'i18n'>, rule: RuleId): string {
  return bookPagesFor(s, rule)[0]?.titleKey ?? `ui.regola.${rule}.titolo`;
}

/** La regola è già nota al giocatore (Libro dei Punti della storia)? */
export function ruleKnown(s: Pick<Services, 'save'>, rule: RuleId): boolean {
  return s.save.data().knowledge.rules.includes(rule);
}

/** Foglio "pagina del Libro" con la regola. */
export function bookPage(s: Pick<Services, 'content' | 'i18n' | 'save'>, rule: RuleId, test: string): HTMLElement {
  const pages = bookPagesFor(s, rule);
  const known = ruleKnown(s, rule);
  const body = el('div', { class: 'sc-libro-pagine' });
  if (pages.length === 0) {
    body.appendChild(
      el(
        'div',
        { class: 'sc-libro-pagina' },
        textOf(`ui.regola.${rule}.titolo`, undefined, 'h3', { className: 'sc-libro-titolo' }),
        textOf(`ui.regola.${rule}.testo`, undefined, 'p', { className: 'sc-libro-testo', rich: true }),
      ),
    );
  } else {
    for (const p of pages) {
      body.appendChild(
        el(
          'div',
          { class: 'sc-libro-pagina', data: { pagina: p.id } },
          textOf(p.titleKey, undefined, 'h3', { className: 'sc-libro-titolo' }),
          textOf(p.textKey, undefined, 'p', { className: 'sc-libro-testo', rich: true }),
        ),
      );
    }
  }
  return el(
    'article',
    { class: 'sc-libro core-solid', test, data: { regola: rule, nota: known ? 'si' : 'no' } },
    el(
      'header',
      { class: 'sc-libro-testa' },
      textOf('ui.libro.etichetta', undefined, 'span', { className: 'sc-libro-etichetta' }),
      known ? null : textOf('ui.libro.nuova', undefined, 'span', { className: 'sc-libro-nuova' }),
    ),
    body,
  );
}
