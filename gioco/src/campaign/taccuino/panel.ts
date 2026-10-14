/**
 * Il Taccuino di Ada (GDD 5.8, 10.3): un pannello a schede, raggiungibile sempre
 * (pulsante, tasto Tab). Schede in basso: Bigliettini, Persone, Libro, Domande, Lettere,
 * Archivio. Carta, serif da libro. Contiene indizi e collegamenti, mai soluzioni; le
 * voci già lette sono riassunte in una riga (si toccano per riaprirle).
 *
 * Registrato in UiLayer come pannello 'taccuino' (montato fisso nel layout largo,
 * overlay nello stretto) e 'bigliettini' (le richieste della notte, ARCHITETTURA 4).
 * Opzioni: `{ from, levelId, origin, accepted, tab?, entry?, noteId?, fixed? }`.
 *
 * Schede visibili (GDD 7): Persone, Domande e Libro dal prologo; Bigliettini dalla
 * prima sera (o durante una notte con richieste); Lettere di L. dalla giornata 6 (o se
 * se ne conoscono già cinque); Archivio quando la cassapanca ha un merletto.
 */
import type { CharacterId, CondReport, DiaryEntryDef, DiaryEntryId, Knowledge, PanelHandle, Services, Unsub } from '../../core/types';
import { CAST_IDS } from '../../core/ids';
import { el, clear } from '../../core/ui/dom';
import { button, paperCard, tabs, textOf, type TabsHandle } from '../../core/ui/components';
import { svgIcon } from '../../core/ui/glyphs';
import { activeNight } from '../../tombolo/index';
import { controller } from '../controller';
import { bookPageByAda, bookPages, currentPista, questionOf, quirkRevealed } from '../diary';
import { dayIndexOf } from '../evening';
import { notePaper, noteMarks } from '../notes';
import { memoriaInPlay } from '../memoria';
import { ADA_PENCIL_HAND, charChip, handOf, spriteCanvas } from '../ui';
import type { CampaignStateX, DayResultX } from '../types';

export type TabId = 'bigliettini' | 'persone' | 'libro' | 'domande' | 'lettere' | 'archivio';
export const TAB_IDS: readonly TabId[] = ['bigliettini', 'persone', 'libro', 'domande', 'lettere', 'archivio'];
const TAB_ICONS: Record<TabId, string> = { bigliettini: 'spillo', persone: 'fuso', libro: 'libro', domande: 'info', lettere: 'nota', archivio: 'forbici' };

export interface TaccuinoOpts {
  from?: string;
  levelId?: string;
  origin?: string;
  accepted?: string[];
  tab?: TabId;
  entry?: DiaryEntryId;
  noteId?: string;
  fixed?: boolean;
}

let lastTab: TabId = 'persone';

function sectionTab(def: DiaryEntryDef): TabId {
  return def.section === 'persone' ? 'persone' : def.section;
}

function maxDayIndex(s: Services, c: CampaignStateX | null): number {
  if (!c) return -1;
  let m = c.dayIndex;
  for (const id of Object.keys(c.history)) m = Math.max(m, dayIndexOf(s.content, id));
  return m;
}

/** Schede visibili adesso. */
export function visibleTabs(s: Services, c: CampaignStateX | null, k: Knowledge, o: TaccuinoOpts): TabId[] {
  const night = activeNight();
  const out: TabId[] = [];
  const day = maxDayIndex(s, c);
  if (day >= 1 || (o.from === 'tombolo' && (night?.params.accepted.length ?? 0) > 0)) out.push('bigliettini');
  out.push('persone', 'libro', 'domande');
  if (day >= dayIndexOf(s.content, 'g06') || k.letters.length >= 5) out.push('lettere');
  if (Object.keys(k.archive).length > 0) out.push('archivio');
  return out;
}

/** Una voce del Taccuino: le già lette in una riga, le nuove intere. */
function entryView(s: Services, def: DiaryEntryDef, isNew: boolean, highlight: boolean): HTMLElement {
  const text = textOf(def.textKey, undefined, 'span', { rich: true, className: 'cp-voce-testo' });
  const src = def.source ? textOf(`campaign.taccuino.fonte.${def.source}`, undefined, 'span', { className: 'cp-voce-fonte' }) : null;
  const b = el(
    'button',
    { type: 'button', class: ['cp-voce', isNew ? 'cp-voce--nuova' : highlight ? null : 'cp-voce--letta', highlight ? 'cp-voce--evidenziata' : null], test: `cp-voce-${def.id}`, attrs: { 'aria-expanded': isNew || highlight ? 'true' : 'false' } },
    isNew ? textOf('campaign.taccuino.nuova', undefined, 'span', { className: 'cp-voce-nuova-segno' }) : null,
    text,
    src,
  );
  b.addEventListener('click', () => {
    const open = b.getAttribute('aria-expanded') === 'true';
    b.setAttribute('aria-expanded', open ? 'false' : 'true');
    b.classList.toggle('cp-voce--letta', open);
  });
  return b;
}

function reportStatus(s: Services, r: CondReport | null, dropped: boolean): HTMLElement {
  const st = dropped ? 'lasciata' : (r?.status ?? 'in_corso');
  return el('span', { class: ['cp-stato-richiesta', `cp-stato--${st}`], data: { stato: st } }, svgIcon(st === 'soddisfatta' ? 'spunta' : st === 'fallita' || st === 'lasciata' ? 'chiudi' : st === 'a_rischio' ? 'info' : 'gomitolo', { size: 16 }), textOf(`campaign.taccuino.stato.${st}`, undefined, 'span'));
}

/** Contenuto dei Bigliettini: la notte in corso (stato in tempo reale), la sera, o la giornata appena chiusa. */
export function renderBigliettini(s: Services, box: HTMLElement, o: TaccuinoOpts): void {
  const c = controller.state();
  const night = activeNight();
  const k = controller.knowledge();
  void k;
  if (night && (o.from === 'tombolo' || s.scenes.current() === 'tombolo')) {
    const p = night.params;
    const statuses = night.session.requestStatus();
    const dropped = night.session.dropped;
    const list = el('div', { class: 'cp-taccuino-lista', test: 'cp-bigliettini-notte' });
    const only = o.noteId ? p.accepted.filter((a) => a.noteId === o.noteId) : p.accepted;
    for (const a of only) {
      const note = s.content.notes.get(a.noteId);
      const r = statuses.find((x) => x.noteId === a.noteId)?.report ?? null;
      const isDropped = dropped.includes(a.noteId);
      const item = el('div', { class: 'cp-richiesta-notte', test: `cp-richiesta-${a.noteId}` });
      if (note) item.appendChild(notePaper(s, note, c, { full: !!o.noteId }));
      item.appendChild(reportStatus(s, r, isDropped));
      if (a.authorGuess) item.appendChild(textOf('campaign.sera.appuntatoPer', { nome: `[[${a.authorGuess}]]` }, 'p', { rich: true, className: 'cp-tenue' }));
      if (!isDropped && !night.completed) {
        item.appendChild(
          button({
            labelKey: 'campaign.taccuino.lasciaCadere',
            kind: 'testo',
            onClick: () => {
              void s.ui.confirm({ titleKey: 'campaign.taccuino.lasciaCadereTitolo', bodyKey: 'campaign.taccuino.lasciaCadereCorpo', okKey: 'campaign.taccuino.lasciaCadere', cancelKey: 'campaign.taccuino.annulla', danger: true }).then((ok) => {
                if (ok) activeNight()?.drop(a.noteId);
              });
            },
            test: `cp-lascia-cadere-${a.noteId}`,
          }),
        );
      }
      list.appendChild(item);
    }
    if (p.goals.length > 0 && !o.noteId) {
      const goals = night.session.goalStatus();
      const ok = goals.filter((g) => g.status === 'soddisfatta').length;
      list.appendChild(el('p', { class: 'cp-obiettivi', test: 'cp-obiettivi-notte' }, svgIcon('stella', { size: 16 }), textOf('campaign.taccuino.obiettivi', { fatti: ok, totale: goals.length }, 'span')));
    }
    if (list.childElementCount === 0) list.appendChild(textOf('campaign.taccuino.nessunaRichiesta', undefined, 'p', { className: 'cp-tenue' }));
    box.appendChild(list);
    return;
  }
  if (!c) {
    box.appendChild(textOf('campaign.taccuino.nessunaRichiesta', undefined, 'p', { className: 'cp-tenue' }));
    return;
  }
  if (c.phase === 'notte' && c.evening && o.from === 'tombolo' && (o.origin === undefined || o.origin === 'campagna')) {
    // Il tombolo monta i pannelli prima di rendere attiva la notte: finché non c'è,
    // le richieste appuntate stasera sono "in corso" (poi arriva lo stato dal vivo).
    const list = el('div', { class: 'cp-taccuino-lista', test: 'cp-bigliettini-notte' });
    for (const a of c.evening.accepted) {
      const note = s.content.notes.get(a.noteId);
      if (!note || (o.noteId && o.noteId !== a.noteId)) continue;
      list.appendChild(el('div', { class: 'cp-richiesta-notte', test: `cp-richiesta-${a.noteId}` }, notePaper(s, note, c, { full: !!o.noteId }), reportStatus(s, null, false)));
    }
    if (list.childElementCount === 0) list.appendChild(textOf('campaign.taccuino.nessunaRichiesta', undefined, 'p', { className: 'cp-tenue' }));
    box.appendChild(list);
    return;
  }
  if (c.evening && (c.phase === 'sera' || c.phase === 'scelta')) {
    const list = el('div', { class: 'cp-taccuino-lista', test: 'cp-bigliettini-sera' });
    for (const id of c.evening.noteIds) {
      const note = s.content.notes.get(id);
      if (!note) continue;
      const m = noteMarks(c, id);
      const item = el('div', { class: 'cp-richiesta-notte' }, notePaper(s, note, c));
      const marks = el('p', { class: 'cp-segni' });
      if (m.pinned) marks.appendChild(textOf('campaign.sera.segnoAppuntato', undefined, 'span', { className: 'cp-segno cp-segno--spillo' }));
      if (m.reply) marks.appendChild(textOf('campaign.sera.segnoRisposto', undefined, 'span', { className: 'cp-segno' }));
      if (m.left && !m.pinned) marks.appendChild(textOf('campaign.sera.segnoLasciato', undefined, 'span', { className: 'cp-segno' }));
      item.appendChild(marks);
      list.appendChild(item);
    }
    if (list.childElementCount === 0) list.appendChild(textOf('campaign.taccuino.nessunBigliettino', undefined, 'p', { className: 'cp-tenue' }));
    box.appendChild(list);
    return;
  }
  // Giornata appena chiusa (alba, bilancio) o l'ultima della storia.
  const hist = c.history[c.report?.levelId ?? c.levelId] as DayResultX | undefined;
  const list = el('div', { class: 'cp-taccuino-lista', test: 'cp-bigliettini-giorno' });
  for (const r of hist?.requests ?? []) {
    const note = s.content.notes.get(r.noteId);
    if (!note) continue;
    list.appendChild(el('div', { class: 'cp-richiesta-notte' }, notePaper(s, note, c), reportStatus(s, { status: r.status }, false)));
  }
  if (list.childElementCount === 0) list.appendChild(textOf('campaign.taccuino.nessunaRichiesta', undefined, 'p', { className: 'cp-tenue' }));
  box.appendChild(list);
}

function dots(n: number): string {
  return '●'.repeat(Math.max(0, Math.min(3, n))) + '○'.repeat(Math.max(0, 3 - Math.max(0, n)));
}

/** Chi compare nel Taccuino: il cast incontrato fin qui, più chi ha voci proprie. */
function people(s: Services, c: CampaignStateX | null, k: Knowledge): CharacterId[] {
  const seen = new Set<CharacterId>();
  const upTo = maxDayIndex(s, c);
  s.content.campaign.days.forEach((d, i) => {
    if (i > upTo) return;
    const lv = s.content.levels.get(d.id);
    for (const t of lv?.threads ?? []) if (t.kind !== 'lino' && t.character) seen.add(t.character);
  });
  for (const id of k.diary) {
    const def = s.content.diary.get(id);
    if (def?.section === 'persone' && def.character) seen.add(def.character);
  }
  for (const q of k.desires) seen.add(q);
  const order: CharacterId[] = [...CAST_IDS, 'livia', 'ada'];
  return order.filter((x) => seen.has(x) && !s.content.characters.get(x)?.archiveOnly);
}

function renderPersone(s: Services, box: HTMLElement, k: Knowledge, seenMark: number, highlight: string | null): void {
  const c = controller.state();
  const list = el('div', { class: 'cp-taccuino-lista', test: 'cp-taccuino-persone' });
  for (const id of people(s, c, k)) {
    const def = s.content.characters.get(id);
    if (!def) continue;
    const card = el('article', { class: 'cp-persona', style: { '--pers-color': def.color }, test: `cp-persona-${id}` });
    const head = el(
      'header',
      { class: 'cp-persona-testa' },
      spriteCanvas(s, `fig/${id}/ferma`, 56, { className: 'cp-persona-figura' }),
      el('div', null, charChip(s, id), textOf(def.roleKey, undefined, 'p', { className: 'cp-tenue' }), textOf(`campaign.motivi.${def.pattern}`, undefined, 'p', { className: 'cp-persona-motivo' })),
    );
    card.appendChild(head);
    const quirks = def.quirks.filter((q) => quirkRevealed(q, id, k, s.content));
    for (const q of quirks) card.appendChild(el('p', { class: 'cp-persona-stranezza', test: `cp-stranezza-${q}` }, svgIcon('info', { size: 16 }), textOf(`campaign.stranezze.${q}`, undefined, 'span'), textOf('campaign.taccuino.fonte.visto', undefined, 'span', { className: 'cp-voce-fonte' })));
    const knowsDesire = k.desires.includes(id);
    card.appendChild(
      el('p', { class: 'cp-persona-desiderio', test: `cp-desiderio-${id}`, data: { noto: knowsDesire ? '1' : '0' } }, textOf('campaign.taccuino.desiderio', undefined, 'span', { className: 'cp-tenue' }), knowsDesire && def.desireKey ? textOf(def.desireKey, undefined, 'span', { rich: true }) : el('span', { class: 'cp-ignoto', text: '?' })),
    );
    const mem = c?.memoria[id];
    if (c && memoriaInPlay(c) && typeof mem === 'number') {
      card.appendChild(el('p', { class: 'cp-persona-memoria', test: `cp-memoria-${id}` }, textOf('campaign.taccuino.memoria', undefined, 'span', { className: 'cp-tenue' }), el('span', { class: 'cp-punti', attrs: { 'aria-label': s.i18n.t('campaign.taccuino.memoriaN', { n: mem }) } }, dots(mem))));
    }
    for (const eid of k.diary) {
      const e = s.content.diary.get(eid);
      if (!e || e.section !== 'persone' || e.character !== id) continue;
      card.appendChild(entryView(s, e, k.diary.indexOf(eid) >= seenMark, highlight === eid));
    }
    list.appendChild(card);
  }
  // Voci sulle persone senza un personaggio preciso.
  for (const eid of k.diary) {
    const e = s.content.diary.get(eid);
    if (e && e.section === 'persone' && !e.character) list.appendChild(entryView(s, e, k.diary.indexOf(eid) >= seenMark, highlight === eid));
  }
  box.appendChild(list);
}

function renderLibro(s: Services, box: HTMLElement, k: Knowledge, seenMark: number, highlight: string | null): void {
  const c = controller.state();
  const list = el('div', { class: 'cp-taccuino-lista', test: 'cp-taccuino-libro' });
  const pages = c ? bookPages(c, k, s.content) : [];
  for (const p of pages) {
    const byAda = bookPageByAda(p);
    const page = el('article', { class: 'cp-pagina', test: `cp-pagina-${p.id}` }, textOf(p.titleKey, undefined, 'h3', { className: 'cp-pagina-titolo' }), textOf(p.textKey, undefined, 'p', { rich: true, className: 'cp-pagina-testo' }));
    if (p.marginKey) {
      page.appendChild(
        byAda
          ? paperCard({ hand: ADA_PENCIL_HAND, className: 'cp-margine cp-margine--ada', test: `cp-margine-${p.id}`, children: [textOf(p.marginKey, undefined, 'p', { rich: true })] })
          : el('p', { class: 'cp-margine cp-margine--nonna', test: `cp-margine-${p.id}` }, textOf(p.marginKey, undefined, 'span', { rich: true })),
      );
    }
    list.appendChild(page);
  }
  if (pages.length === 0) list.appendChild(textOf('campaign.taccuino.libroVuoto', undefined, 'p', { className: 'cp-tenue' }));
  for (const eid of k.diary) {
    const e = s.content.diary.get(eid);
    if (e?.section === 'libro') list.appendChild(entryView(s, e, k.diary.indexOf(eid) >= seenMark, highlight === eid));
  }
  box.appendChild(list);
}

function renderDomande(s: Services, box: HTMLElement, k: Knowledge, seenMark: number, highlight: string | null): void {
  const list = el('div', { class: 'cp-taccuino-lista', test: 'cp-taccuino-domande' });
  const pista = currentPista(k, s.content);
  const pistaDef = pista ? s.content.diary.get(pista) : undefined;
  if (pistaDef) {
    list.appendChild(el('aside', { class: 'cp-pista', test: 'cp-pista', data: { voce: pistaDef.id } }, textOf('campaign.taccuino.doveGuardare', undefined, 'p', { className: 'cp-pista-titolo' }), textOf(pistaDef.textKey, undefined, 'p', { rich: true })));
  }
  const pistaQ = pistaDef ? questionOf(pistaDef) : null;
  const qs = Object.keys(k.questions).sort((a, b) => {
    const ra = k.questions[a] === 'risolta' ? 1 : 0;
    const rb = k.questions[b] === 'risolta' ? 1 : 0;
    if (ra !== rb) return ra - rb;
    if (a === pistaQ) return -1;
    if (b === pistaQ) return 1;
    return 0;
  });
  const used = new Set<string>();
  for (const q of qs) {
    const solved = k.questions[q] === 'risolta';
    const sec = el('section', { class: ['cp-domanda', solved ? 'cp-domanda--risolta' : null, q === pistaQ ? 'cp-domanda--pista' : null], test: `cp-domanda-${q}`, data: { stato: k.questions[q] ?? 'aperta' } });
    sec.appendChild(el('h3', { class: 'cp-domanda-titolo' }, svgIcon(solved ? 'spunta' : 'info', { size: 18 }), textOf(`comune.domande.${q}.titolo`, undefined, 'span'), textOf(solved ? 'campaign.taccuino.risolta' : 'campaign.taccuino.aperta', undefined, 'span', { className: 'cp-tenue' })));
    for (const eid of k.diary) {
      const e = s.content.diary.get(eid);
      if (!e || e.section !== 'domande' || questionOf(e) !== q) continue;
      used.add(eid);
      sec.appendChild(entryView(s, e, k.diary.indexOf(eid) >= seenMark, highlight === eid));
    }
    list.appendChild(sec);
  }
  for (const eid of k.diary) {
    const e = s.content.diary.get(eid);
    if (e && e.section === 'domande' && !used.has(eid)) list.appendChild(entryView(s, e, k.diary.indexOf(eid) >= seenMark, highlight === eid));
  }
  if (qs.length === 0) list.appendChild(textOf('campaign.taccuino.nessunaDomanda', undefined, 'p', { className: 'cp-tenue' }));
  box.appendChild(list);
}

function renderLettere(s: Services, box: HTMLElement, k: Knowledge, seenMark: number, highlight: string | null): void {
  const list = el('div', { class: 'cp-taccuino-lista', test: 'cp-taccuino-lettere' });
  const known = s.content.letters.filter((l) => k.letters.includes(l.id));
  for (const l of known) {
    const signer: CharacterId = l.signed === 'C.' ? 'clotilde' : 'livia';
    list.appendChild(paperCard({ hand: handOf(s, signer), className: 'cp-lettera', test: `cp-lettera-${l.id}`, children: [textOf(l.textKey, undefined, 'p', { rich: true, className: 'cp-lettera-testo' })] }));
  }
  if (known.length === 0) list.appendChild(textOf('campaign.taccuino.nessunaLettera', undefined, 'p', { className: 'cp-tenue' }));
  for (const eid of k.diary) {
    const e = s.content.diary.get(eid);
    if (e?.section === 'lettere') list.appendChild(entryView(s, e, k.diary.indexOf(eid) >= seenMark, highlight === eid));
  }
  box.appendChild(list);
}

function renderArchivio(s: Services, box: HTMLElement, k: Knowledge, seenMark: number, highlight: string | null): void {
  const list = el('div', { class: 'cp-taccuino-lista', test: 'cp-taccuino-archivio' });
  for (const [id, st] of Object.entries(k.archive)) {
    const lv = s.content.levels.get(id);
    if (!lv?.archive) continue;
    list.appendChild(el('p', { class: 'cp-rotolo-riga', test: `cp-archivio-${id}`, data: { stato: st } }, el('span', { class: 'cp-rotolo-anno', text: lv.archive.year }), textOf(lv.archive.titleKey, undefined, 'span'), textOf(`campaign.archivio.stato.${st}`, undefined, 'span', { className: 'cp-tenue' })));
  }
  for (const eid of k.diary) {
    const e = s.content.diary.get(eid);
    if (e?.section === 'archivio') list.appendChild(entryView(s, e, k.diary.indexOf(eid) >= seenMark, highlight === eid));
  }
  box.appendChild(list);
}

/** Pannello 'taccuino'. */
export function taccuinoPanel(s: Services, container: HTMLElement, raw?: unknown): PanelHandle {
  const o = (raw ?? {}) as TaccuinoOpts;
  const k0 = controller.knowledge();
  const c0 = controller.state();
  const seenMark = Math.min(c0?.diarySeen ?? 0, k0.diary.length);
  let highlight: string | null = o.entry ?? null;
  let current: TabId = o.tab ?? lastTab;
  if (o.entry) {
    const def = s.content.diary.get(o.entry);
    if (def) current = sectionTab(def);
  } else if (o.noteId || (o.from === 'tombolo' && !o.tab && (activeNight()?.params.accepted.length ?? 0) > 0 && !o.fixed)) current = 'bigliettini';
  const root = el('section', { class: ['cp-taccuino', 'core-solid', o.fixed ? 'cp-taccuino--fisso' : null], test: 'cp-taccuino', attrs: { 'aria-label': s.i18n.t('campaign.taccuino.titolo') } });
  const title = textOf('campaign.taccuino.titolo', undefined, 'h2', { className: 'cp-taccuino-titolo' });
  const body = el('div', { class: 'cp-taccuino-corpo', test: 'cp-taccuino-corpo' });
  let bar: TabsHandle | null = null;
  const barBox = el('div', { class: 'cp-taccuino-schede' });
  root.append(title, body, barBox);
  container.appendChild(root);
  let tabsKey = '';

  const render = (): void => {
    const k = controller.knowledge();
    const c = controller.state();
    const vis = visibleTabs(s, c, k, o);
    if (!vis.includes(current)) current = vis.includes('persone') ? 'persone' : (vis[0] ?? 'persone');
    const key = vis.join('|');
    if (key !== tabsKey) {
      tabsKey = key;
      clear(barBox);
      bar = tabs({
        tabs: vis.map((id) => ({ id, labelKey: `campaign.taccuino.schede.${id}`, icon: TAB_ICONS[id] })),
        selected: current,
        onSelect: (id) => {
          current = id as TabId;
          lastTab = current;
          highlight = null;
          renderBody();
        },
        test: 'cp-taccuino-scheda',
      });
      barBox.appendChild(bar.el);
    }
    bar?.select(current);
    renderBody();
  };

  const renderBody = (): void => {
    const k = controller.knowledge();
    const scroll = body.scrollTop;
    clear(body);
    switch (current) {
      case 'bigliettini':
        renderBigliettini(s, body, o);
        break;
      case 'persone':
        renderPersone(s, body, k, seenMark, highlight);
        break;
      case 'libro':
        renderLibro(s, body, k, seenMark, highlight);
        break;
      case 'domande':
        renderDomande(s, body, k, seenMark, highlight);
        break;
      case 'lettere':
        renderLettere(s, body, k, seenMark, highlight);
        break;
      case 'archivio':
        renderArchivio(s, body, k, seenMark, highlight);
        break;
    }
    if (highlight) body.querySelector<HTMLElement>(`[data-test="cp-voce-${CSS.escape(highlight)}"]`)?.scrollIntoView?.({ block: 'center' });
    else body.scrollTop = scroll;
  };

  render();
  // Le voci viste adesso non sono più nuove alla prossima apertura (GDD 5.8: le già lette
  // si riassumono in una riga). L'overlay le segna lette appena si apre; il pannello fisso
  // del layout largo, che resta sempre aperto, quando la scena lo smonta.
  const markSeen = (): void => {
    const c = controller.state();
    if (!c || (c.diarySeen ?? 0) >= controller.knowledge().diary.length) return;
    controller.mutate((d) => {
      const cc = d.campaign as CampaignStateX | null;
      if (cc) cc.diarySeen = d.knowledge.diary.length;
    }, 'taccuino', false);
  };
  if (c0 && (c0.diarySeen ?? 0) < k0.diary.length && !o.fixed) markSeen();
  const offs: Unsub[] = [
    controller.onChange(() => {
      if (root.isConnected) render();
    }),
  ];
  for (const ev of ['night:row', 'night:undo', 'night:complete', 'quirk:discovered'] as const) {
    offs.push(
      s.bus.on(ev, () => {
        if (root.isConnected && current === 'bigliettini') renderBody();
      }),
    );
  }
  // Il tombolo monta i pannelli prima che la notte sia attiva: quando la scena è entrata
  // le schede (Bigliettini durante una notte con richieste) e lo stato dal vivo cambiano.
  offs.push(
    s.bus.on('scene:enter', () => {
      if (root.isConnected) render();
    }),
  );
  return {
    update: render,
    destroy() {
      for (const off of offs.splice(0)) off();
      root.remove();
      if (o.fixed) {
        try {
          markSeen();
        } catch (err) {
          console.warn('[campaign] notebook mark failed', err);
        }
      }
    },
  };
}

/** Pannello 'bigliettini': le richieste della notte (o della sera) con il loro stato. */
export function bigliettiniPanel(s: Services, container: HTMLElement, raw?: unknown): PanelHandle {
  const o = (raw ?? {}) as TaccuinoOpts;
  const root = el('section', { class: 'cp-taccuino cp-pannello-bigliettini core-solid', test: 'cp-pannello-bigliettini' }, textOf('campaign.taccuino.schede.bigliettini', undefined, 'h2', { className: 'cp-taccuino-titolo' }));
  const body = el('div', { class: 'cp-taccuino-corpo' });
  root.appendChild(body);
  container.appendChild(root);
  const render = (): void => {
    clear(body);
    renderBigliettini(s, body, { ...o, from: o.from ?? 'tombolo' });
  };
  render();
  const offs: Unsub[] = [controller.onChange(() => root.isConnected && render())];
  for (const ev of ['night:row', 'night:undo', 'night:complete', 'scene:enter'] as const) offs.push(s.bus.on(ev, () => root.isConnected && render()));
  return {
    update: render,
    destroy() {
      for (const off of offs.splice(0)) off();
      root.remove();
    },
  };
}


