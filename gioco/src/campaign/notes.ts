/**
 * Bigliettini e oggetti della sera nel DOM (GDD 10.3 "Sera"): la carta con la
 * calligrafia del personaggio (a matita e senza firma se l'autore ha dimenticato Ada),
 * il dettaglio a tutto schermo con Appunta / Rispondi / Lascia e "Chi l'ha scritto?",
 * le carte della scelta (con il biglietto D strappato e le mancanze), l'oggetto della
 * laguna. Il dettaglio e l'oggetto sono pannelli aperti come overlay ('cp-nota',
 * 'cp-oggetto'): si chiudono con Indietro.
 */
import type { CharacterId, NoteDef, PanelHandle, Services } from '../core/types';
import { el, clear } from '../core/ui/dom';
import { button, paperCard, textOf } from '../core/ui/components';
import { svgIcon } from '../core/ui/glyphs';
import { controller } from './controller';
import { eveningItems, guessCandidates, isAnonymous, pinNote, pinsLeft, replyNote, leaveNote, unpinNote } from './evening';
import { choiceCards } from './endings';
import { eveningMode, levelOf } from './flow';
import { ADA_PENCIL_HAND, PENCIL_HAND, charChip, handOf, spriteCanvas } from './ui';
import type { CampaignStateX } from './types';
import { emptyLog } from './story';

/** Il foglio di un bigliettino (anteprima o intero). */
export function notePaper(s: Services, note: NoteDef, c: CampaignStateX | null, opts: { full?: boolean; test?: string } = {}): HTMLElement {
  const anon = c ? isAnonymous(note, c, s.content) : false;
  const hand = anon ? PENCIL_HAND : note.author === 'ada' ? ADA_PENCIL_HAND : handOf(s, note.author);
  const head = anon
    ? textOf('campaign.sera.allaMerlettaia', undefined, 'p', { className: 'cp-nota-a' })
    : el('p', { class: 'cp-nota-a' }, charChip(s, note.author));
  const body = textOf(note.textKey, undefined, 'p', { rich: true, className: ['cp-nota-testo', opts.full ? '' : 'cp-nota-testo--breve'].join(' ').trim() });
  const card = paperCard({ hand, children: [head, body], test: opts.test, className: ['cp-nota', anon ? 'cp-nota--anonima' : ''].join(' ').trim() });
  card.dataset.note = note.id;
  if (anon) card.dataset.anonimo = '1';
  return card;
}

function ev(c: CampaignStateX | null): NonNullable<CampaignStateX['evening']> | null {
  return c?.evening ?? null;
}

/** Stato di un bigliettino della sera (per i segni sulla carta). */
export function noteMarks(c: CampaignStateX, id: string): { pinned: boolean; reply: 'R1' | 'R2' | null; left: boolean; guess: CharacterId | null } {
  const e = ev(c);
  const acc = e?.accepted.find((a) => a.noteId === id);
  return { pinned: !!acc, reply: e?.replies[id] ?? null, left: (c.left ?? []).includes(id), guess: acc?.authorGuess ?? null };
}

/** Dettaglio di un bigliettino della sera (overlay 'cp-nota'). */
export function noteDetailPanel(s: Services, container: HTMLElement, opts?: unknown): PanelHandle {
  const noteId = String((opts as { noteId?: string } | undefined)?.noteId ?? '');
  const root = el('div', { class: 'cp-dettaglio core-solid', test: 'cp-nota-dettaglio' });
  container.appendChild(root);
  let guess: CharacterId | null = null;
  let replying = false;
  let error: string | null = null;

  const render = (): void => {
    clear(root);
    const c = controller.state();
    const note = s.content.notes.get(noteId);
    if (!c || !note) {
      root.appendChild(textOf('campaign.sera.nessunBigliettino', undefined, 'p'));
      return;
    }
    if (c.phase === 'scelta') {
      renderChoice(c, note);
      return;
    }
    const m = noteMarks(c, noteId);
    const anon = isAnonymous(note, c, s.content);
    root.appendChild(notePaper(s, note, c, { full: true, test: `cp-nota-carta-${noteId}` }));
    if (m.pinned) {
      root.appendChild(
        el('p', { class: 'cp-segno cp-segno--spillo', test: 'cp-nota-appuntato' }, svgIcon('spillo', { size: 18 }), m.guess ? textOf('campaign.sera.appuntatoPer', { nome: `[[${m.guess}]]` }, 'span', { rich: true }) : textOf('campaign.sera.appuntato', undefined, 'span')),
      );
    }
    if (m.reply) {
      const r = note.replies?.find((x) => x.id === m.reply);
      if (r) root.appendChild(el('div', { class: 'cp-risposta-data', test: 'cp-nota-risposta-data' }, textOf('campaign.sera.haiRisposto', undefined, 'p', { className: 'cp-tenue' }), textOf(r.textKey, undefined, 'p', { rich: true, className: 'cp-risposta-testo' })));
    }
    if (m.left && !m.pinned) root.appendChild(el('p', { class: 'cp-segno', test: 'cp-nota-lasciato' }, textOf('campaign.sera.lasciato', undefined, 'span')));
    // Bigliettino anonimo: prima di appuntarlo, chi l'ha scritto?
    if (anon && !m.pinned && note.request) {
      const level = levelOf(s.content, c.levelId);
      const row = el('div', { class: 'cp-chi', role: 'group', test: 'cp-nota-chi' }, textOf('campaign.sera.chiLHaScritto', undefined, 'p', { className: 'cp-chi-domanda' }));
      const people = el('div', { class: 'cp-chi-volti' });
      for (const who of guessCandidates(level)) {
        const b = el('button', { type: 'button', class: ['cp-volto', guess === who ? 'cp-attivo' : null], test: `cp-chi-${who}`, attrs: { 'aria-pressed': guess === who ? 'true' : 'false' } }, spriteCanvas(s, `fig/${who}/ferma`, 44), charChip(s, who));
        b.addEventListener('click', () => {
          guess = who;
          error = null;
          render();
        });
        people.appendChild(b);
      }
      row.appendChild(people);
      root.appendChild(row);
    }
    if (error) root.appendChild(textOf(`campaign.sera.errore.${error}`, undefined, 'p', { className: 'cp-errore', rich: true }));
    // Risposte scritte.
    if (replying && note.replies?.length && !m.reply) {
      const list = el('div', { class: 'cp-risposte', role: 'group', test: 'cp-nota-risposte' }, textOf('campaign.sera.scegliRisposta', undefined, 'p', { className: 'cp-tenue' }));
      for (const r of note.replies) {
        const b = el('button', { type: 'button', class: 'cp-risposta core-carta', test: `cp-risposta-${r.id}` }, textOf(r.textKey, undefined, 'span', { rich: true }));
        b.addEventListener('click', () => {
          const log = emptyLog();
          const err = controller.mutate((d) => replyNote(d.campaign as CampaignStateX, d.knowledge, s.content, noteId, r.id, log), 'risposta');
          if (err) error = err;
          else controller.announceDiary(log.diary);
          replying = false;
          render();
        });
        list.appendChild(b);
      }
      root.appendChild(list);
    }
    const left = pinsLeft(c, s.content);
    const actions = el('div', { class: 'cp-dettaglio-azioni' });
    if (m.pinned) {
      actions.appendChild(
        button({
          labelKey: 'campaign.sera.togliSpillo',
          icon: 'spillo',
          kind: 'secondario',
          onClick: () => {
            controller.mutate((d) => unpinNote(d.campaign as CampaignStateX, noteId), 'spillo');
            render();
          },
          test: 'cp-togli-spillo',
        }),
      );
    } else if (note.request) {
      actions.appendChild(
        button({
          labelKey: 'campaign.sera.appunta',
          params: { n: left },
          icon: 'spillo',
          kind: 'primario',
          disabled: left <= 0,
          onClick: () => {
            const err = controller.mutate((d) => pinNote(d.campaign as CampaignStateX, s.content, noteId, guess ?? undefined), 'spillo');
            if (err) {
              error = err;
              render();
              return;
            }
            s.ui.closeOverlay();
          },
          test: 'cp-appunta',
        }),
      );
    }
    if (note.replies?.length && !m.reply) {
      actions.appendChild(
        button({
          labelKey: 'campaign.sera.rispondi',
          icon: 'matita',
          kind: 'secondario',
          onClick: () => {
            replying = !replying;
            render();
          },
          test: 'cp-rispondi',
        }),
      );
    }
    if (!m.left || m.pinned) {
      actions.appendChild(
        button({
          labelKey: 'campaign.sera.lascia',
          kind: 'testo',
          onClick: () => {
            controller.mutate((d) => leaveNote(d.campaign as CampaignStateX, noteId), 'lascia');
            s.ui.closeOverlay();
          },
          test: 'cp-lascia',
        }),
      );
    }
    root.appendChild(actions);
  };

  const renderChoice = (c: CampaignStateX, note: NoteDef): void => {
    const cards = choiceCards(levelOf(s.content, c.levelId), c, controller.knowledge(), s.content);
    const card = cards.find((x) => x.note.id === note.id);
    const torn = !!card && !card.available;
    const paper = notePaper(s, note, c, { full: true, test: `cp-nota-carta-${noteId}` });
    if (torn) paper.classList.add('cp-nota--strappata');
    root.appendChild(paper);
    if (torn && card) {
      const list = el('ul', { class: 'cp-mancanze', test: 'cp-mancanze' });
      for (const k of card.missing) list.appendChild(el('li', null, textOf(k, undefined, 'span', { rich: true })));
      root.appendChild(el('div', { class: 'cp-strappo' }, textOf('campaign.scelta.strappato', undefined, 'p', { className: 'cp-tenue' }), list));
    }
    const actions = el('div', { class: 'cp-dettaglio-azioni' });
    actions.appendChild(
      button({
        labelKey: 'campaign.scelta.appunta',
        icon: 'spillo',
        kind: 'primario',
        disabled: torn || !card,
        onClick: () => {
          if (!card) return;
          void s.ui.confirm({ titleKey: 'campaign.scelta.confermaTitolo', bodyKey: `campaign.scelta.conferma.${card.ending}`, okKey: 'campaign.scelta.confermaOk', cancelKey: 'campaign.scelta.confermaNo' }).then((ok) => {
            if (!ok) return;
            s.ui.closeOverlay();
            controller.choose(card.ending);
          });
        },
        test: 'cp-scegli',
      }),
    );
    root.appendChild(actions);
  };

  render();
  const off = controller.onChange(() => {
    if (root.isConnected) render();
  });
  return {
    update: render,
    destroy() {
      off();
      root.remove();
    },
  };
}

/** L'oggetto (o gli oggetti) della laguna (overlay 'cp-oggetto'). */
export function objectPanel(s: Services, container: HTMLElement): PanelHandle {
  const c = controller.state();
  const root = el('div', { class: 'cp-dettaglio cp-oggetti core-solid', test: 'cp-oggetto-dettaglio' });
  container.appendChild(root);
  if (!c) return { destroy: () => root.remove() };
  const items = eveningItems(c.dayIndex, eveningMode(c), c, s.content);
  root.appendChild(textOf('campaign.sera.oggettoTitolo', undefined, 'h2', { className: 'cp-dettaglio-titolo' }));
  for (const it of items) {
    const box = el('section', { class: 'cp-oggetto', test: `cp-oggetto-${it.id}` });
    if (it.image) box.appendChild(spriteCanvas(s, it.image, 112, { className: 'cp-oggetto-figura' }));
    if (it.kind === 'lettera' && it.letter) {
      const signer: CharacterId = it.letter.signed === 'C.' ? 'clotilde' : 'livia';
      box.appendChild(
        paperCard({
          hand: handOf(s, signer),
          className: 'cp-lettera',
          test: `cp-lettera-${it.id}`,
          children: [textOf(it.letter.textKey, undefined, 'p', { rich: true, className: 'cp-lettera-testo' })],
        }),
      );
    } else {
      box.appendChild(textOf(`comune.oggetti.${it.id}.nome`, undefined, 'h3', { className: 'cp-oggetto-nome' }));
      box.appendChild(textOf(`comune.oggetti.${it.id}.descrizione`, undefined, 'p', { rich: true, className: 'cp-oggetto-descrizione' }));
    }
    root.appendChild(box);
  }
  root.appendChild(el('div', { class: 'cp-dettaglio-azioni' }, button({ labelKey: 'campaign.sera.oggettoContinua', icon: 'avanti', kind: 'primario', onClick: () => s.ui.closeOverlay(), test: 'cp-oggetto-continua' })));
  return { destroy: () => root.remove() };
}
