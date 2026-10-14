/**
 * Elenco degli obiettivi della notte (C08, D06): lo stesso componente sta nel
 * popup del pulsante Obiettivi, nel pannello di sinistra del layout largo (lo
 * monta la campagna con `objectivesElement()`) e nel pannello dell'Archivio.
 *
 * Contiene:
 * - gli obiettivi obbligatori, con il testo completo (finestre orarie comprese)
 *   e lo stato sulle righe fissate; una spunta tratteggiata se si compirebbero
 *   fissando l'ora (C07);
 * - gli spilli d'ottone (chi, dove, quando; rispettato, futuro, irraggiungibile),
 *   anche quelli delle righe che non si vedono;
 * - le coppie in rancore, finché la regola vale;
 * - nell'Archivio, i fili da nominare (toccandoli si sceglie il nome) e gli strappi.
 *
 * `data-test`: `tb-obiettivi-lista`, `tb-obiettivo-<i>`, `tb-spillo-<thread>-<ora>`,
 * `tb-rancore-<a>-<b>`, `tb-sbiadito-<thread>`, `tb-strappo-<ora>`.
 */
import type { CondStatus, ThreadId } from '../../core/types';
import { el, clear } from '../../core/ui/dom';
import { svgIcon } from '../../core/ui/glyphs';
import type { Session } from '../session';
import { type TextDeps, describeCondition, formatHour, nameParams, reportText, threadName } from '../text';
import type { ThreadVisual } from '../visuals';
import { visualOf } from '../visuals';
import { capitalizeNode } from './popup';

export interface ObjectivesHost {
  readonly session: Session;
  readonly textDeps: TextDeps;
  readonly visuals: Map<ThreadId, ThreadVisual>;
  /** Righe visibili (le altre sono nascoste dallo scorrimento o dai gradi). */
  pinHidden(hour: number): boolean;
  openNamePicker(t: ThreadId): void;
  /** Il giocatore ha toccato una voce (il tutorial spegne la pulsazione degli obiettivi). */
  touched?(): void;
}

/** Stato di una voce, con il testo che lo accompagna (mai solo colore). */
type ItemState = CondStatus | 'anteprima' | 'rispettato' | 'futuro' | 'irraggiungibile' | 'nominato' | 'daNominare' | 'rammendato' | 'daRammendare' | 'rancore';

const STATE_GLYPH: Record<ItemState, string> = {
  in_corso: 'spillo',
  soddisfatta: 'spunta',
  a_rischio: 'info',
  fallita: 'chiudi',
  anteprima: 'spunta',
  rispettato: 'spunta',
  futuro: 'spillo',
  irraggiungibile: 'chiudi',
  nominato: 'spunta',
  daNominare: 'info',
  rammendato: 'spunta',
  daRammendare: 'disfa',
  rancore: 'croce',
};

export interface ObjectivesCount {
  done: number;
  total: number;
}

export class ObjectivesList {
  readonly el: HTMLElement;
  private last = '';

  constructor(
    private readonly host: ObjectivesHost,
    private readonly opts: { compact?: boolean } = {},
  ) {
    this.el = el('ul', { class: ['tb-obiettivi', opts.compact && 'tb-obiettivi--compatto'], test: 'tb-obiettivi-lista', role: 'list' });
    this.update();
  }

  /** Quanti obiettivi sono raggiunti (per il contatore sul pulsante «2/5»). */
  static count(host: ObjectivesHost): ObjectivesCount | null {
    const s = host.session;
    const a = s.archive;
    if (a) {
      const faded = a.faded();
      if (faded.length > 0) return { done: a.confirmedList().length, total: faded.length };
    }
    const goals = s.goalStatus();
    if (goals.length > 0) return { done: goals.filter((g) => g.status === 'soddisfatta').length, total: goals.length };
    const pins = s.level.pins;
    if (pins.length > 0) {
      const h = s.state.hour;
      return { done: pins.filter((p) => p.hour <= h).length, total: pins.length };
    }
    return null;
  }

  /** C'è qualcosa da elencare? */
  static hasItems(host: ObjectivesHost): boolean {
    const s = host.session;
    return s.params.goals.length > 0 || s.level.pins.length > 0 || s.ctx.rancor.length > 0 || !!s.archive;
  }

  update(): void {
    const s = this.host.session;
    const key = `${s.version}|${s.hour}|${this.host.textDeps.i18n.t('tombolo.stato.in_corso')}`;
    if (key === this.last) return;
    this.last = key;
    clear(this.el);
    const d = this.host.textDeps;
    const t = (k: string, p?: Record<string, string | number>): string => d.i18n.t(k, p);

    // Obiettivi obbligatori.
    const reports = s.goalStatus();
    const preview = s.goalPreview();
    s.params.goals.forEach((c, i) => {
      const r = reports[i] ?? { status: 'in_corso' as const };
      const ante = preview[i] === 'soddisfatta' && r.status !== 'soddisfatta';
      const state: ItemState = ante ? 'anteprima' : r.status;
      const why = r.reasonKey ? reportText(d, r, c) : ante ? t('tombolo.stato.inArrivo') : t(`tombolo.stato.${r.status}`);
      this.item(`tb-obiettivo-${i}`, 'stella', describeCondition(d, c), state, why);
    });

    // Spilli d'ottone (anche quelli delle righe che non si vedono).
    const unreachable = s.done ? [] : s.unreachable();
    const fixedHour = s.state.hour;
    const veiled = (s.params.gradi ?? []).includes('spilliVelati');
    for (const p of s.level.pins) {
      if (veiled && p.hour > s.hour + 2 && p.hour > fixedHour) continue;
      const lost = unreachable.some((u) => u.thread === p.thread && u.place === p.place && u.hour === p.hour);
      const state: ItemState = p.hour <= fixedHour ? 'rispettato' : lost ? 'irraggiungibile' : 'futuro';
      const text = t('tombolo.obiettivi.spillo', nameParams(d, { chi: p.thread, luogo: p.place, ora: p.hour }));
      const why = t(`tombolo.obiettivi.stato.${state}`, { ora: formatHour(d, p.hour) });
      const hidden = state === 'futuro' && this.host.pinHidden(p.hour);
      const v = visualOf(this.host.visuals, p.thread);
      this.item(`tb-spillo-${p.thread}-${p.hour}`, v.icon ?? 'spillo', text, state, hidden ? `${why} · ${t('tombolo.obiettivi.nascosto')}` : why);
    }

    // Coppie in rancore, finché la regola vale.
    for (const [a, b] of s.ctx.rancor) {
      this.item(`tb-rancore-${a}-${b}`, 'croce', t('tombolo.rancore.coppia', { a: threadName(d, a), b: threadName(d, b) }), 'rancore', '');
    }

    // Archivio: fili da nominare e strappi da rammendare.
    const arc = s.archive;
    if (arc) {
      const faded = arc.faded();
      faded.forEach((th, i) => {
        const n = i + 1;
        if (arc.isConfirmed(th)) {
          const who = arc.confirmedAs(th);
          const ch = who ? d.content.characters.get(who) : undefined;
          this.item(`tb-sbiadito-${th}`, ch?.icon ?? 'spunta', t('tombolo.obiettivi.sbiaditoNominato', { n, nome: ch ? t(ch.nameKey) : (who ?? '') }), 'nominato', t('tombolo.obiettivi.stato.nominato'));
          return;
        }
        const g = arc.tentativeOf(th);
        const ch = g ? d.content.characters.get(g) : undefined;
        const text = g ? t('tombolo.obiettivi.sbiaditoProvvisorio', { n, nome: ch ? t(ch.nameKey) : g }) : t('tombolo.obiettivi.sbiadito', { n });
        const li = this.item(`tb-sbiadito-${th}`, 'info', text, 'daNominare', t('tombolo.obiettivi.stato.daNominare'), () => {
          this.host.touched?.();
          this.host.openNamePicker(th);
        });
        li.dataset.filo = th;
      });
      if (s.mode === 'archivio') {
        const open = new Set(arc.openHoles().map((h) => h.from));
        for (const h of arc.holes()) {
          const state: ItemState = open.has(h.from) ? 'daRammendare' : 'rammendato';
          const text = h.from === h.to ? t('tombolo.obiettivi.strappoOra', { ora: formatHour(d, h.from) }) : t('tombolo.obiettivi.strappo', { da: formatHour(d, h.from), a: formatHour(d, h.to) });
          this.item(`tb-strappo-${h.from}`, 'disfa', text, state, t(`tombolo.obiettivi.stato.${state}`));
        }
      }
    }
  }

  private item(test: string, icon: string, text: string, state: ItemState, why: string, onTap?: () => void): HTMLElement {
    const li = el('li', { class: ['tb-ob', `tb-ob--${state}`], test, data: { stato: state }, role: 'listitem' });
    const mark = el('span', { class: 'tb-ob-segno', attrs: { 'aria-hidden': 'true' } }, svgIcon(icon, { size: 16 }), el('span', { class: 'tb-ob-stato' }, svgIcon(STATE_GLYPH[state], { size: 11 })));
    const body = el('span', { class: 'tb-ob-corpo' });
    const main = el('span', { class: 'tb-ob-testo', text });
    capitalizeNode(main);
    body.appendChild(main);
    if (why) body.appendChild(el('span', { class: 'tb-ob-perche', text: why }));
    if (onTap) {
      const b = el('button', { type: 'button', class: 'tb-ob-tocca' }, mark, body);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        onTap();
      });
      li.appendChild(b);
    } else li.append(mark, body);
    this.el.appendChild(li);
    return li;
  }
}
