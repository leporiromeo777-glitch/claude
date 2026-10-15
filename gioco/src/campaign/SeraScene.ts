/**
 * Scena 'sera' (GDD 4.2, 9, 10.3): la porta di Ada.
 *
 * - Riceve i comandi delle schermate (ARCHITETTURA 5.4): `{ cmd: 'nuova' }` (con conferma
 *   se c'è già una storia), `{ cmd: 'continua' }` (riprende la fase salvata, anche a
 *   metà notte), `{ cmd: 'riprendi', levelId }` (Riprendi da qui). Se la fase non è la
 *   sera, la scena passa subito a quella giusta.
 * - Prologo: schermo nero con la riga d'apertura, poi la stanza con il biglietto della
 *   nonna e il tombolo da toccare (GDD 9).
 * - Sera: l'oggetto della laguna (si tocca per leggerlo), poi i bigliettini come carte;
 *   ognuno si apre a tutto schermo con Appunta / Rispondi / Lascia. "Al tombolo" è
 *   sempre attivo: i bigliettini non decisi contano come lasciati, con una conferma.
 *   "Ripassa" quando le richieste coincidono con una soluzione già trovata.
 * - Scelta (sera di g23): quattro biglietti e uno spillo; il punto aperto è strappato
 *   finché mancano i requisiti.
 *
 * Revisione 1: la porta dice da dove arriva l'oggetto (C04: laguna, mano, porta, casa;
 * `cp-sera-arrivo`) o che stasera non arriva niente; alla prima sera di ogni atto un
 * cartello con titolo e stagione (`cp-atto-cartello`); gli spilli si mostrano solo se ci
 * sono bigliettini da appuntare; Esc e Indietro senza pannelli chiedono conferma prima
 * di tornare al titolo (`cp-sera-esci-conferma`); il prologo è raccolto (niente Taccuino
 * sul buio, titolo su una fascia scura, il biglietto appuntato sul tombolo).
 */
import type { ActionEvent, Scene, Services, Viewport } from '../core/types';
import { el, clear } from '../core/ui/dom';
import { button, iconButton, paperCard, textOf } from '../core/ui/components';
import { svgIcon } from '../core/ui/glyphs';
import { controller, type SeraCommand } from './controller';
import { arrivalOf, dayAt, emptyDoorKey, eveningItems, firstEveningOfAct, pinsLeft, pinsOf, undecided } from './evening';
import { choiceCards } from './endings';
import { eveningMode, levelOf, ripassaAvailable } from './flow';
import { Backdrop, dayLabel, SideNotebook } from './frame';
import { notePaper, noteMarks } from './notes';
import { handOf, sceneHost, spriteCanvas, tapKey, unloadImages } from './ui';
import type { CampaignStateX } from './types';

export class SeraScene implements Scene {
  readonly id = 'sera' as const;
  private root: HTMLElement | null = null;
  private main: HTMLElement | null = null;
  private side: SideNotebook | null = null;
  private backdrop: Backdrop | null = null;
  private off: (() => void) | null = null;
  private prologueStep: 'buio' | 'stanza' | null = null;
  /** Cartello d'atto da mostrare prima della sera (CAM-10). */
  private actCard = false;
  private soundsDone = new Set<string>();
  private renderQueued = false;
  private active = false;
  /** Si sta già andando al tombolo (niente doppie partenze con un doppio tocco). */
  private leaving = false;
  /**
   * Dove è cominciato l'ultimo tocco o clic (Q006): un «clic» che arriva ad «Al tombolo» da
   * un tocco cominciato altrove (su «Continua» di un foglio che intanto si è chiuso) è un
   * clic fantasma e non vale. Un tocco vero comincia sul pulsante; la tastiera non ha tocchi.
   */
  private lastDown: { target: EventTarget | null; at: number } = { target: null, at: -Infinity };
  private readonly onPointerDown = (e: Event): void => {
    this.lastDown = { target: e.target, at: Date.now() };
  };

  constructor(private readonly s: Services) {}

  async enter(params?: unknown): Promise<void> {
    const cmd = (params ?? {}) as SeraCommand;
    this.active = true;
    this.root = el('div', { class: 'cp-scena cp-sera', test: 'cp-sera' });
    this.backdrop = new Backdrop(this.s, 0.5);
    this.main = el('div', { class: 'cp-centro cp-sera-centro' });
    this.side = new SideNotebook(this.s, { from: 'sera' });
    this.root.append(this.backdrop.el, this.main, this.side.column);
    sceneHost(this.s).appendChild(this.root);
    this.main.addEventListener('scroll', () => this.syncScrollCue(), { passive: true });
    if (typeof document !== 'undefined') document.addEventListener('pointerdown', this.onPointerDown, true);

    if (cmd.cmd === 'nuova' && controller.state() && !cmd.confirmed) {
      // Nuova storia con un salvataggio: conferma (la storia e il Taccuino ricominciano).
      void this.s.ui
        .confirm({ titleKey: 'campaign.nuova.titolo', bodyKey: 'campaign.nuova.corpo', okKey: 'campaign.nuova.ok', cancelKey: 'campaign.nuova.annulla', danger: true })
        .then((ok) => {
          if (!this.active) return;
          if (ok) void this.s.scenes.go('sera', { cmd: 'nuova', confirmed: true });
          else void this.s.scenes.go(this.s.scenes.has('titolo') ? 'titolo' : 'boot');
        });
      return;
    }
    let route;
    try {
      route = await controller.prepare(cmd);
    } catch (err) {
      console.error('[campaign] evening failed', err);
      route = null;
    }
    if (!this.active) return;
    if (!route) {
      void this.s.scenes.go(this.s.scenes.has('titolo') ? 'titolo' : 'boot');
      return;
    }
    if ('night' in route || route.scene !== 'sera') {
      controller.go(route);
      return;
    }
    const c = controller.state();
    if (c && c.dayIndex === 0 && c.phase === 'sera') this.prologueStep = c.prologueSeen ? 'stanza' : 'buio';
    this.actCard = !!c && c.phase === 'sera' && this.firstOfAct(c) && c.actCardSeen !== c.dayIndex;
    controller.sound('sera');
    this.off = controller.onChange(() => this.queueRender());
    this.side.sync();
    this.refresh();
  }

  private queueRender(): void {
    if (this.renderQueued) return;
    this.renderQueued = true;
    queueMicrotask(() => {
      this.renderQueued = false;
      if (this.active) this.refresh();
    });
  }

  private once(key: string, fn: () => void): void {
    if (this.soundsDone.has(key)) return;
    this.soundsDone.add(key);
    try {
      fn();
    } catch {
      /* audio non pronto */
    }
  }

  refresh(): void {
    const main = this.main;
    const c = controller.state();
    if (!main || !c) return;
    const focusedTest = (document.activeElement as HTMLElement | null)?.dataset?.test ?? null;
    // La fase è cambiata (si va al tombolo, alla scelta…): naviga chi l'ha cambiata.
    if (c.phase !== 'sera' && c.phase !== 'scelta') return;
    clear(main);
    // Niente Taccuino sul buio del prologo né sul cartello d'atto (CAM-10).
    if (this.side) this.side.column.classList.toggle('cp-lato--nascosto', this.prologueStep === 'buio' || this.actCard);
    if (this.prologueStep) this.renderPrologue(main, c);
    else if (this.actCard) this.renderActCard(main, c);
    else if (c.phase === 'scelta') this.renderChoice(main, c);
    else this.renderEvening(main, c);
    this.side?.update();
    if (focusedTest) main.querySelector<HTMLElement>(`[data-test="${CSS.escape(focusedTest)}"]`)?.focus({ preventScroll: true });
    this.syncScrollCue();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => this.syncScrollCue());
  }

  /**
   * L'elenco scorre sotto il piede (Q004): l'altezza del piede va in `--cp-piede-h` (i
   * bigliettini tornano in vista sopra i pulsanti) e, finché sotto c'è altro, sul bordo
   * del piede compare la freccia che scorre (`cp-sera-scorri`).
   */
  private syncScrollCue(): void {
    const main = this.main;
    if (!main) return;
    const foot = main.querySelector<HTMLElement>(':scope > .cp-sera-piede');
    if (foot) main.style.setProperty('--cp-piede-h', `${Math.round(foot.offsetHeight)}px`);
    const more = main.scrollHeight - main.clientHeight - main.scrollTop > 8;
    main.classList.toggle('cp-sera--altro', more);
  }

  /** Dopo un foglio chiuso il bigliettino toccato torna in vista sopra il piede (Q004). */
  private afterOverlay(noteId?: string): void {
    if (!noteId || !this.main) return;
    this.main.querySelector<HTMLElement>(`[data-test="cp-bigliettino-${CSS.escape(noteId)}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }

  /**
   * Il clic viene da un tocco cominciato poco prima fuori dal pulsante (un clic fantasma,
   * Q006). Senza un tocco recente (tastiera, o un tocco di più di 800 ms fa) vale sempre.
   */
  private ghost(e?: MouseEvent): boolean {
    const b = (e?.currentTarget as Node | null) ?? null;
    const t = this.lastDown.target as Node | null;
    if (!b || !t || Date.now() - this.lastDown.at > 800) return false;
    return !b.contains(t);
  }

  // ───────── Prologo (GDD 9) ─────────

  private renderPrologue(main: HTMLElement, c: CampaignStateX): void {
    if (this.prologueStep === 'buio') {
      this.backdrop?.show('');
      const box = el(
        'button',
        { type: 'button', class: 'cp-prologo-buio', test: 'cp-prologo-buio' },
        textOf('campaign.prologo.notte', undefined, 'p', { className: 'cp-prologo-riga' }),
        textOf(tapKey('campaign.prologo.tocca'), undefined, 'p', { className: 'cp-prologo-tocca' }),
      );
      box.addEventListener('click', () => this.advancePrologue());
      main.appendChild(box);
      box.focus({ preventScroll: true });
      return;
    }
    this.backdrop?.show('tab/sedia_vuota');
    const lab = dayLabel(this.s.content, c.levelId);
    const note = paperCard({
      hand: handOf(this.s, 'clotilde'),
      className: 'cp-biglietto-nonna',
      test: 'cp-prologo-biglietto',
      children: [textOf('campaign.prologo.biglietto', undefined, 'p', { rich: true })],
    });
    // Il biglietto appuntato sul tombolo (CAM-10): il tombolo al centro, lo spillo sul foglio.
    const pin = el('span', { class: 'cp-biglietto-spillo', attrs: { 'aria-hidden': 'true' } }, svgIcon('spillo', { size: 22 }));
    const table = el('div', { class: 'cp-prologo-tombolo' }, spriteCanvas(this.s, 'obj/tombolo', 220, { className: 'cp-prologo-tombolo-figura' }), el('div', { class: 'cp-prologo-biglietto' }, pin, note));
    const go = button({ labelKey: tapKey('campaign.prologo.tombolo'), kind: 'primario', size: 'grande', onClick: () => this.goNight(), test: 'cp-prologo-tombolo' });
    go.prepend(spriteCanvas(this.s, 'obj/tombolo', 40));
    main.append(
      el('header', { class: 'cp-sera-testa cp-fascia', test: 'cp-prologo-titolo' }, el('div', { class: 'cp-sera-intestazione' }, textOf(lab.key, lab.params, 'p', { className: 'cp-sera-giornata' }), textOf('comune.atti.0.sottotitolo', undefined, 'h1', { className: 'cp-sera-titolo' }))),
      el('p', { class: 'cp-sera-intro cp-fascia' }, textOf('campaign.prologo.stanza', undefined, 'span')),
      table,
      el('div', { class: 'cp-sera-piede' }, go),
    );
  }

  // ───────── Cartello d'atto (CAM-10) ─────────

  /** Prima sera di un atto (g01, g09, g17). */
  private firstOfAct(c: CampaignStateX): boolean {
    return firstEveningOfAct(this.s.content, c.dayIndex);
  }

  private renderActCard(main: HTMLElement, c: CampaignStateX): void {
    this.backdrop?.show('');
    const act = dayAt(this.s.content, c.dayIndex)?.act ?? 1;
    const card = el(
      'button',
      { type: 'button', class: 'cp-prologo-buio cp-atto-cartello', test: 'cp-atto-cartello', data: { atto: String(act) } },
      textOf(`comune.atti.${act}.sottotitolo`, undefined, 'p', { className: 'cp-atto-stagione' }),
      textOf(`comune.atti.${act}.titolo`, undefined, 'h1', { className: 'cp-prologo-riga cp-atto-titolo' }),
      textOf(tapKey('campaign.prologo.tocca'), undefined, 'p', { className: 'cp-prologo-tocca' }),
    );
    card.addEventListener('click', () => this.closeActCard());
    main.appendChild(card);
    card.focus({ preventScroll: true });
  }

  private closeActCard(): void {
    if (!this.actCard) return;
    this.actCard = false;
    controller.mutate((d) => {
      const cc = d.campaign as CampaignStateX | null;
      if (cc) cc.actCardSeen = cc.dayIndex;
    }, 'atto', false);
    this.refresh();
  }

  private advancePrologue(): void {
    this.prologueStep = 'stanza';
    controller.mutate((d) => {
      const c = d.campaign as CampaignStateX | null;
      if (c) c.prologueSeen = true;
    }, 'prologo', false);
    this.refresh();
    this.main?.querySelector<HTMLElement>('[data-test="cp-prologo-tombolo"]')?.focus({ preventScroll: true });
  }

  // ───────── Sera ─────────

  private header(c: CampaignStateX): HTMLElement {
    const level = levelOf(this.s.content, c.levelId);
    const lab = dayLabel(this.s.content, c.levelId);
    const menu = iconButton({ icon: 'indietro', labelKey: 'campaign.sera.titolo', onClick: () => this.toTitle(), test: 'cp-sera-menu', className: 'cp-sera-menu' });
    return el(
      'header',
      { class: 'cp-sera-testa' },
      menu,
      el('div', { class: 'cp-sera-intestazione' }, textOf(lab.key, lab.params, 'p', { className: 'cp-sera-giornata' }), textOf(level.titleKey, undefined, 'h1', { className: 'cp-sera-titolo' }), textOf(`comune.atti.${level.act}.titolo`, undefined, 'p', { className: 'cp-sera-atto' })),
    );
  }

  private objectDoor(c: CampaignStateX): HTMLElement | null {
    const ev = c.evening;
    if (!ev || ev.objectSeen) return null;
    const items = eveningItems(c.dayIndex, eveningMode(c), c, this.s.content);
    if (items.length === 0) return null;
    const arrival = arrivalOf(this.s.content, items);
    if (arrival.from === 'laguna') this.once(`bottiglia:${c.levelId}:${c.phase}`, () => this.s.audio.sfx('bottiglia'));
    else this.once(`porta:${c.levelId}:${c.phase}`, () => this.s.audio.sfx('carta'));
    const first = items[0];
    // La frase d'arrivo dice da dove viene l'oggetto (C04).
    const door = el(
      'button',
      { type: 'button', class: 'cp-porta core-solid', test: 'cp-oggetto', data: { da: arrival.from } },
      first?.image ? spriteCanvas(this.s, first.image, 72) : svgIcon('nota', { size: 40 }),
      el('span', { class: 'cp-porta-testo' }, el('span', { class: 'cp-porta-titolo', test: 'cp-sera-arrivo', data: { da: arrival.from } }, textOf(arrival.key, arrival.params, 'span', { rich: true })), textOf(tapKey('campaign.sera.oggettoTocca'), undefined, 'span', { className: 'cp-tenue' })),
    );
    door.addEventListener('click', () => {
      void this.s.ui.openOverlay('cp-oggetto', { from: 'sera' }).then(() => {
        // Chiuso senza «Continua» (Indietro): l'oggetto è letto lo stesso (C03).
        if (!this.active || controller.state()?.evening?.objectSeen) return;
        const fresh = controller.objectSeen();
        const first = fresh.map((id) => this.s.content.diary.get(id)).find((x) => !!x);
        if (first) this.s.ui.toast(first.textKey, undefined, 'info');
      });
    });
    return door;
  }

  private noteButton(c: CampaignStateX, id: string): HTMLElement | null {
    const note = this.s.content.notes.get(id);
    if (!note) return null;
    const m = noteMarks(c, id);
    const marks = el('span', { class: 'cp-segni' });
    if (m.pinned) marks.appendChild(el('span', { class: 'cp-segno cp-segno--spillo' }, svgIcon('spillo', { size: 16 }), textOf('campaign.sera.segnoAppuntato', undefined, 'span')));
    if (m.reply) marks.appendChild(el('span', { class: 'cp-segno' }, svgIcon('matita', { size: 16 }), textOf('campaign.sera.segnoRisposto', undefined, 'span')));
    if (m.left && !m.pinned) marks.appendChild(el('span', { class: 'cp-segno' }, textOf('campaign.sera.segnoLasciato', undefined, 'span')));
    const b = el('button', { type: 'button', class: ['cp-bigliettino', m.pinned ? 'cp-appuntato' : null, m.left && !m.pinned ? 'cp-lasciato' : null], test: `cp-bigliettino-${id}` }, notePaper(this.s, note, c), marks);
    b.addEventListener('click', () => {
      void this.s.ui.openOverlay('cp-nota', { noteId: id, from: 'sera' }).then(() => this.afterOverlay(id));
    });
    return b;
  }

  private renderEvening(main: HTMLElement, c: CampaignStateX): void {
    this.backdrop?.show('dio/stanza/notte');
    const ev = c.evening;
    main.appendChild(this.header(c));
    const door = this.objectDoor(c);
    if (door) {
      main.appendChild(door);
    } else {
      // Stasera alla porta non arriva niente (C04): la frase della giornata.
      const empty = ev?.objectSeen && !this.itemsArrived(c) ? emptyDoorKey(c.dayIndex, eveningMode(c), c, this.s.content) : null;
      if (empty) main.appendChild(el('p', { class: 'cp-sera-intro cp-porta-vuota', test: 'cp-sera-arrivo', data: { da: 'niente' } }, textOf(empty, undefined, 'span', { rich: true })));
    }
    const ids = ev?.noteIds ?? [];
    if (!door && ids.length > 0) {
      this.once(`carta:${c.levelId}`, () => this.s.audio.sfx('carta'));
      const grid = el('div', { class: 'cp-bigliettini', role: 'list', test: 'cp-bigliettini' });
      for (const id of ids) {
        const b = this.noteButton(c, id);
        if (b) grid.appendChild(el('div', { role: 'listitem' }, b));
      }
      main.appendChild(textOf('campaign.sera.sottoLaPorta', { n: ids.length }, 'p', { className: 'cp-sera-intro' }));
      main.appendChild(grid);
    } else if (!door) {
      main.appendChild(textOf('campaign.sera.nessunBigliettino', undefined, 'p', { className: 'cp-sera-intro' }));
    }
    main.appendChild(this.footer(c));
  }

  /** Stasera alla porta è arrivato un oggetto (già letto o no). */
  private itemsArrived(c: CampaignStateX): boolean {
    return eveningItems(c.dayIndex, eveningMode(c), c, this.s.content).length > 0;
  }

  private footer(c: CampaignStateX): HTMLElement {
    const s = this.s;
    const total = pinsOf(s.content, c.dayIndex);
    const used = total - pinsLeft(c, s.content);
    const foot = el('footer', { class: 'cp-sera-piede' });
    const tools = el('div', { class: 'cp-sera-strumenti' });
    tools.appendChild(this.side?.button() ?? el('span'));
    if (Object.keys(controller.knowledge().archive).length > 0) {
      tools.appendChild(iconButton({ icon: 'libro', labelKey: 'campaign.sera.cassapanca', onClick: () => void s.scenes.go('archivio', { browse: true, back: 'sera' }), size: 56, kind: 'secondario', test: 'cp-sera-cassapanca' }));
    }
    if (s.scenes.has('telaio') && c.dayIndex > 0) {
      tools.appendChild(iconButton({ icon: 'gomitolo', labelKey: 'campaign.sera.telaio', onClick: () => void s.scenes.go('telaio', { back: 'sera' }), size: 56, kind: 'secondario', test: 'cp-sera-telaio' }));
    }
    foot.appendChild(tools);
    const go = el('div', { class: 'cp-sera-vai' });
    if (ripassaAvailable(controller.data())) {
      go.appendChild(button({ labelKey: 'campaign.sera.ripassa', icon: 'play', kind: 'secondario', onClick: (e) => this.goNight(true, e), test: 'cp-ripassa' }));
    }
    // Gli spilli si contano solo se stasera c'è un bigliettino da appuntare (CAM-09).
    const pinnable = (c.evening?.noteIds ?? []).some((id) => !!s.content.notes.get(id)?.request);
    const label = total > 0 && pinnable ? 'campaign.sera.alTomboloSpilli' : 'campaign.sera.alTombolo';
    // "Al tombolo" è attivo sempre (GDD 10.3): l'oggetto non letto finisce comunque nel
    // Taccuino, i bigliettini non decisi contano come lasciati (con una conferma).
    go.appendChild(button({ labelKey: label, params: { usati: used, totale: total }, kind: 'primario', size: 'grande', onClick: (e) => this.toNight(e), test: 'cp-al-tombolo' }));
    foot.appendChild(go);
    // L'elenco continua sotto il piede (Q004): una freccia sul bordo lo dice e lo fa scorrere.
    const more = el('button', { type: 'button', class: 'cp-sera-scorri', test: 'cp-sera-scorri', label: this.s.i18n.t('campaign.sera.scorri'), title: this.s.i18n.t('campaign.sera.scorri') }, svgIcon('avanti', { size: 22 }));
    more.addEventListener('click', () => {
      const main = this.main;
      if (main) main.scrollBy?.({ top: Math.max(120, main.clientHeight * 0.7), behavior: 'smooth' });
    });
    foot.prepend(more);
    return foot;
  }

  private goNight(ripassa = false, e?: MouseEvent): void {
    if (this.leaving || !this.active || this.ghost(e)) return;
    this.leaving = true;
    if (ripassa) controller.ripassa();
    else controller.toNight();
  }

  private toNight(e?: MouseEvent): void {
    const c = controller.state();
    if (!c || this.leaving || this.ghost(e)) return;
    const open = undecided(c);
    if (open.length === 0) {
      this.goNight();
      return;
    }
    void this.s.ui
      .confirm({ titleKey: 'campaign.sera.confermaTitolo', bodyKey: 'campaign.sera.confermaCorpo', okKey: 'campaign.sera.confermaOk', cancelKey: 'campaign.sera.confermaNo' })
      .then((ok) => {
        if (ok) this.goNight();
      });
  }

  // ───────── Scelta (sera di g23) ─────────

  private renderChoice(main: HTMLElement, c: CampaignStateX): void {
    this.backdrop?.show('dio/stanza/notte');
    main.appendChild(
      el('header', { class: 'cp-sera-testa' }, iconButton({ icon: 'indietro', labelKey: 'campaign.sera.titolo', onClick: () => this.toTitle(), test: 'cp-sera-menu', className: 'cp-sera-menu' }), el('div', { class: 'cp-sera-intestazione' }, textOf('campaign.scelta.giornata', undefined, 'p', { className: 'cp-sera-giornata' }), textOf('campaign.scelta.titolo', undefined, 'h1', { className: 'cp-sera-titolo' }))),
    );
    const door = this.objectDoor(c);
    if (door) main.appendChild(door);
    else {
      this.once('carta:scelta', () => this.s.audio.sfx('carta'));
      main.appendChild(textOf('campaign.scelta.intro', undefined, 'p', { className: 'cp-sera-intro' }));
      const grid = el('div', { class: 'cp-bigliettini cp-scelta', role: 'list', test: 'cp-scelta' });
      for (const card of choiceCards(levelOf(this.s.content, c.levelId), c, controller.knowledge(), this.s.content)) {
        const paper = notePaper(this.s, card.note, c);
        if (card.folded) paper.classList.add('cp-nota--piegata');
        else if (!card.available) paper.classList.add('cp-nota--strappata');
        const sign = card.folded ? 'campaign.scelta.segnoPiegato' : card.available ? null : 'campaign.scelta.mancaQualcosa';
        const b = el('button', { type: 'button', class: ['cp-bigliettino', card.folded ? 'cp-piegato' : card.available ? null : 'cp-strappato'], test: `cp-carta-${card.ending}`, data: { ending: card.ending, disponibile: card.available ? '1' : '0', stato: card.folded ? 'piegato' : card.available ? 'libero' : 'strappato' } }, paper, sign ? textOf(sign, undefined, 'span', { className: 'cp-segno' }) : null);
        b.addEventListener('click', () => void this.s.ui.openOverlay('cp-nota', { noteId: card.note.id, from: 'scelta' }));
        grid.appendChild(el('div', { role: 'listitem' }, b));
      }
      main.appendChild(grid);
    }
    const tools = el('div', { class: 'cp-sera-strumenti' }, this.side?.button() ?? null);
    if (this.s.scenes.has('telaio')) tools.appendChild(iconButton({ icon: 'gomitolo', labelKey: 'campaign.sera.telaio', onClick: () => void this.s.scenes.go('telaio', { back: 'sera' }), size: 56, kind: 'secondario', test: 'cp-sera-telaio' }));
    main.appendChild(el('footer', { class: 'cp-sera-piede' }, tools, el('div', { class: 'cp-sera-vai' }, textOf('campaign.scelta.unoSpillo', undefined, 'p', { className: 'cp-tenue' }))));
  }

  private toTitle(): void {
    void this.s.scenes.go(this.s.scenes.has('titolo') ? 'titolo' : 'boot');
  }

  exit(): void {
    this.active = false;
    if (typeof document !== 'undefined') document.removeEventListener('pointerdown', this.onPointerDown, true);
    this.off?.();
    this.off = null;
    this.side?.destroy();
    this.side = null;
    this.backdrop?.destroy();
    this.backdrop = null;
    this.root?.remove();
    this.root = null;
    this.main = null;
    unloadImages(this.s.assets);
  }

  resize(_vp: Viewport): void {
    this.side?.sync();
    this.backdrop?.draw();
  }

  onAction(a: ActionEvent): boolean {
    if (a.action === 'notebook') {
      this.side?.open();
      return true;
    }
    if (this.prologueStep === 'buio' && (a.action === 'confirm' || a.action === 'crossL' || a.action === 'select')) {
      this.advancePrologue();
      return true;
    }
    if (this.actCard && (a.action === 'confirm' || a.action === 'crossL' || a.action === 'select' || a.action === 'skip')) {
      this.closeActCard();
      return true;
    }
    return false;
  }

  /** Esc o Indietro senza pannelli aperti: si chiede prima di uscire (CAM-09, P116). */
  onBack(): boolean {
    if (this.exitAsked) return true;
    this.exitAsked = true;
    const ask = this.s.ui.confirm({ titleKey: 'campaign.sera.esciTitolo', bodyKey: 'campaign.sera.esciCorpo', okKey: 'campaign.sera.esciOk', cancelKey: 'campaign.sera.esciNo' });
    const host = [...this.s.ui.root.querySelectorAll<HTMLElement>('[data-test="confirm"]')].pop()?.parentElement;
    if (host) host.dataset.test = 'cp-sera-esci-conferma';
    void ask.then((ok) => {
      this.exitAsked = false;
      if (ok && this.active) this.toTitle();
    });
    return true;
  }

  private exitAsked = false;
}
