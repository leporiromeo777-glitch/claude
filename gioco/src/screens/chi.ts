/**
 * «Chi c'è stanotte» (revisione 1, SCH-07, P041, P045; GDD 8.3-8.4): nella
 * scheda del Merletto del giorno e del libero, prima di tessere, i personaggi
 * del merletto con icona, nome e stranezze attive (`tombolo.stranezza.*`), il
 * filo nero, i passanti e le coppie in rancore (`tombolo.rancore.coppia`).
 * Chi ha stranezze che stanotte non contano (revisione 2, Q022) non è detto
 * «senza stranezze»: «Nessuna stranezza che conti stanotte».
 * La regola del giorno resta nella sua sezione con la pagina del Libro.
 */
import type { CharacterId, LevelDef, QuirkId, Services, ThreadId } from '../core/types';
import { CHARACTER_IDS, isOneOf } from '../core/ids';
import { el } from '../core/ui/dom';
import { textOf } from '../core/ui/components';
import { createContext } from '../engine/index';
import { icon } from './icons';

export interface ChiPerson {
  thread: ThreadId;
  character: CharacterId;
  nero: boolean;
  /** Stranezze del personaggio che stanotte contano. */
  quirks: QuirkId[];
  /** Stranezze sue che stanotte non contano (per esempio: chi riguardano non c'è). Revisione 2, Q022. */
  dormant: QuirkId[];
}

export interface ChiInfo {
  people: ChiPerson[];
  passanti: number;
  rancor: [CharacterId | ThreadId, CharacterId | ThreadId][];
}

/** Personaggio di un filo (il campo `character`, o l'id se è un CharacterId). */
function characterOf(level: LevelDef, thread: ThreadId): CharacterId | null {
  const def = level.threads.find((t) => t.id === thread);
  if (def?.character) return def.character;
  return isOneOf(CHARACTER_IDS, thread) ? thread : null;
}

/** Chi c'è nel merletto, con le stranezze attive di ognuno e le coppie in rancore (puro). */
export function chiInfo(s: Pick<Services, 'content'>, level: LevelDef): ChiInfo {
  let ctx: { quirks: QuirkId[]; rancor: [ThreadId, ThreadId][] };
  try {
    ctx = createContext(level, {});
  } catch {
    ctx = { quirks: [...level.quirks], rancor: [...(level.rancor ?? [])] };
  }
  const active = new Set<QuirkId>(ctx.quirks);
  const people: ChiPerson[] = [];
  let passanti = 0;
  for (const t of level.threads) {
    const ch = t.kind === 'lino' ? null : characterOf(level, t.id);
    if (!ch) {
      passanti++;
      continue;
    }
    if (people.some((p) => p.character === ch)) continue;
    const own = s.content.characters.get(ch)?.quirks ?? [];
    people.push({
      thread: t.id,
      character: ch,
      nero: t.kind === 'nero',
      quirks: own.filter((q) => active.has(q)),
      dormant: own.filter((q) => !active.has(q)),
    });
  }
  const rancor = ctx.rancor.map(([a, b]) => [characterOf(level, a) ?? a, characterOf(level, b) ?? b] as [CharacterId | ThreadId, CharacterId | ThreadId]);
  return { people, passanti, rancor };
}

function nameKeyOf(s: Pick<Services, 'content'>, id: string): string {
  return s.content.characters.get(id as CharacterId)?.nameKey ?? `comune.pers.${id}.nome`;
}

/**
 * La sezione (data-test `test`). Senza livello (ancora in preparazione) dice
 * che il tombolo si prepara.
 */
export function chiSection(s: Pick<Services, 'content' | 'i18n'>, level: LevelDef | null, test: string): HTMLElement {
  const box = el('section', { class: 'sc-sezione sc-chi', test });
  const h = el('h2', { class: 'sc-sezione-titolo' }, icon('mano', 20), textOf('ui.chi.titolo', undefined, 'span'));
  box.appendChild(h);
  if (!level) {
    box.appendChild(textOf('ui.chi.attesa', undefined, 'p', { className: 'sc-nota' }));
    return box;
  }
  const info = chiInfo(s, level);
  const list = el('ul', { class: 'sc-chi-lista' });
  for (const p of info.people) {
    const def = s.content.characters.get(p.character);
    const row = el(
      'li',
      { class: ['sc-chi-persona', p.nero && 'sc-chi-persona--nero'], test: `${test}-${p.character}`, data: { quirks: p.quirks.join(' ') } },
      el('span', { class: 'sc-chi-icona', style: def?.color ? { '--pers-color': def.color } : undefined }, icon(def?.icon ?? 'gomitolo', 22)),
    );
    const text = el('div', { class: 'sc-chi-testo' }, textOf(nameKeyOf(s, p.character), undefined, 'strong', { className: 'sc-chi-nome' }));
    if (p.nero) text.appendChild(textOf('ui.chi.nero', undefined, 'span', { className: 'sc-chi-stranezza' }));
    for (const q of p.quirks) {
      const key = `tombolo.stranezza.${q}`;
      text.appendChild(textOf(s.i18n.has(key) ? key : 'ui.chi.stranezzaRiserva', undefined, 'span', { className: 'sc-chi-stranezza' }));
    }
    // Q022: chi ha stranezze che stanotte non contano non è «senza stranezze».
    if (!p.nero && p.quirks.length === 0) {
      const key = p.dormant.length > 0 ? 'ui.chi.nessunaStranezzaStanotte' : 'ui.chi.nessunaStranezza';
      text.appendChild(textOf(key, undefined, 'span', { className: 'sc-chi-stranezza sc-chi-stranezza--nessuna' }));
    }
    row.appendChild(text);
    list.appendChild(row);
  }
  box.appendChild(list);
  if (info.passanti > 0) box.appendChild(textOf('ui.chi.passanti', { n: info.passanti }, 'p', { className: 'sc-nota sc-chi-passanti' }));
  for (const [a, b] of info.rancor) {
    const params = { a: s.i18n.t(nameKeyOf(s, a)), b: s.i18n.t(nameKeyOf(s, b)) };
    const key = s.i18n.has('tombolo.rancore.coppia') ? 'tombolo.rancore.coppia' : 'ui.chi.rancore';
    const line = el('p', { class: 'sc-chi-rancore', test: `${test}-rancore-${a}-${b}` }, icon('nodo', 18), textOf(key, params, 'span'));
    box.appendChild(line);
  }
  return box;
}
