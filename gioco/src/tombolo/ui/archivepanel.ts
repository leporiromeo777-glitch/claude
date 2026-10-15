/**
 * Pannello dell'Archivio (C09, D05.8): nel layout largo, al posto dei
 * Bigliettini, il tombolo monta a sinistra il proprio pannello con
 * - i fili da nominare, ciascuno con il suo nome provvisorio (toccandolo si sceglie);
 * - i candidati (chi è già su un filo, chi è confermato);
 * - gli strappi da rammendare;
 * - gli obiettivi del livello (l'Archivio con le occasioni);
 * - dopo il rammendo, il registro degli echi letti, con i due nomi del crocevia.
 * `data-test`: `tb-archivio-pannello`.
 */
import type { CharacterId, ThreadId } from '../../core/types';
import { el, clear } from '../../core/ui/dom';
import { svgIcon } from '../../core/ui/glyphs';
import { textOf } from '../../core/ui/components';
import type { Session } from '../session';
import { type TextDeps, describeCondition, formatHour } from '../text';

export interface ArchivePanelHost {
  readonly session: Session;
  readonly textDeps: TextDeps;
  /** `from: 'pannello'`: la scheda si apre sul pannello, col filo evidenziato nel merletto. */
  openNamePicker(t: ThreadId, via?: undefined, from?: 'pannello'): void;
  /** Echi già letti stanotte (ora, coppia), nell'ordine. */
  heardEchoes(): readonly { hour: number; pair: number }[];
  /** Gli echi si possono toccare (nominato e rammendato). */
  echoesOpen(): boolean;
  /** «Teresa → Aldo, alle 9»: i due nomi del crocevia di un eco. */
  echoNames(hour: number, pair: number): string;
}

export class ArchivePanel {
  readonly el: HTMLElement;
  private last = '';

  constructor(private readonly host: ArchivePanelHost) {
    this.el = el('section', { class: 'tb-archivio-pannello', test: 'tb-archivio-pannello' });
    this.update();
  }

  update(): void {
    const s = this.host.session;
    const a = s.archive;
    if (!a) return;
    const d = this.host.textDeps;
    const t = (k: string, p?: Record<string, string | number>): string => d.i18n.t(k, p);
    const key = `${s.version}|${this.host.heardEchoes().length}|${this.host.echoesOpen()}|${t('tombolo.archivio.pannello.fili')}`;
    if (key === this.last) return;
    this.last = key;
    clear(this.el);
    const lv = s.level;
    const year = (lv.archive?.year ?? '').trim();
    this.el.appendChild(textOf(year ? 'tombolo.hud.archivioAnno' : 'tombolo.hud.archivio', { anno: year }, 'p', { className: 'tb-ap-anno' }));
    this.el.appendChild(textOf(lv.titleKey, undefined, 'h2', { className: 'tb-ap-titolo' }));

    // Fili da nominare.
    const pr = a.progress();
    this.el.appendChild(textOf('tombolo.archivio.pannello.fili', undefined, 'h3', { className: 'tb-ap-sezione' }));
    this.el.appendChild(textOf('tombolo.archivio.nomiDati', { dati: pr.given, totale: pr.total }, 'p', { className: 'tb-ap-nota' }));
    const fili = el('ul', { class: 'tb-obiettivi', role: 'list' });
    a.faded().forEach((th, i) => {
      const n = i + 1;
      const li = el('li', { class: ['tb-ob', a.isConfirmed(th) ? 'tb-ob--nominato' : 'tb-ob--daNominare'], test: `tb-ap-filo-${th}`, data: { filo: th } });
      if (a.isConfirmed(th)) {
        const who = a.confirmedAs(th);
        const ch = who ? d.content.characters.get(who) : undefined;
        li.append(this.mark(ch?.icon ?? 'spunta', 'spunta'), el('span', { class: 'tb-ob-corpo' }, el('span', { class: 'tb-ob-testo', text: t('tombolo.obiettivi.sbiaditoNominato', { n, nome: ch ? t(ch.nameKey) : (who ?? '') }) })));
      } else {
        const g = a.tentativeOf(th);
        const ch = g ? d.content.characters.get(g) : undefined;
        const b = el(
          'button',
          { type: 'button', class: 'tb-ob-tocca' },
          this.mark('info', 'info'),
          el('span', { class: 'tb-ob-corpo' }, el('span', { class: 'tb-ob-testo', text: g ? t('tombolo.obiettivi.sbiaditoProvvisorio', { n, nome: ch ? t(ch.nameKey) : g }) : t('tombolo.obiettivi.sbiadito', { n }) })),
        );
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          this.host.openNamePicker(th, undefined, 'pannello');
        });
        li.appendChild(b);
      }
      fili.appendChild(li);
    });
    this.el.appendChild(fili);

    // Candidati.
    this.el.appendChild(textOf('tombolo.archivio.pannello.candidati', undefined, 'h3', { className: 'tb-ap-sezione' }));
    const cands = el('ul', { class: 'tb-ap-candidati', role: 'list' });
    const faded = a.faded();
    for (const id of a.candidates()) {
      const ch = d.content.characters.get(id as CharacterId);
      const holder = a.holderOf(id);
      const state = holder ? (a.isConfirmed(holder) ? 'confermato' : 'provvisorio') : 'libero';
      const li = el('li', { class: ['tb-ap-cand', `tb-ap-cand--${state}`], test: `tb-ap-candidato-${id}`, data: { stato: state } }, svgIcon(ch?.icon ?? 'info', { size: 16 }), el('span', { text: ch ? t(ch.nameKey) : id }));
      if (holder) li.appendChild(el('span', { class: 'tb-ap-cand-filo', text: t('tombolo.archivio.suFilo', { n: faded.indexOf(holder) + 1 }) }));
      cands.appendChild(li);
    }
    this.el.appendChild(cands);

    // Strappi (Archivio a strappi) o obiettivi (Archivio con le occasioni).
    if (s.mode === 'archivio') {
      this.el.appendChild(textOf('tombolo.archivio.pannello.strappi', undefined, 'h3', { className: 'tb-ap-sezione' }));
      const holes = el('ul', { class: 'tb-obiettivi', role: 'list' });
      const open = new Set(a.openHoles().map((h) => h.from));
      for (const h of a.holes()) {
        const st = open.has(h.from) ? 'daRammendare' : 'rammendato';
        const text = h.from === h.to ? t('tombolo.obiettivi.strappoOra', { ora: formatHour(d, h.from) }) : t('tombolo.obiettivi.strappo', { da: formatHour(d, h.from), a: formatHour(d, h.to) });
        holes.appendChild(el('li', { class: ['tb-ob', `tb-ob--${st}`], test: `tb-ap-strappo-${h.from}` }, this.mark('disfa', st === 'rammendato' ? 'spunta' : 'disfa'), el('span', { class: 'tb-ob-corpo' }, el('span', { class: 'tb-ob-testo', text }), el('span', { class: 'tb-ob-perche', text: t(`tombolo.obiettivi.stato.${st}`) }))));
      }
      this.el.appendChild(holes);
    }
    if (s.params.goals.length > 0) {
      this.el.appendChild(textOf('tombolo.archivio.pannello.obiettivi', undefined, 'h3', { className: 'tb-ap-sezione' }));
      const goals = el('ul', { class: 'tb-obiettivi', role: 'list' });
      const reps = s.goalStatus();
      s.params.goals.forEach((c, i) => {
        const r = reps[i]?.status ?? 'in_corso';
        goals.appendChild(el('li', { class: ['tb-ob', `tb-ob--${r}`] }, this.mark('stella', r === 'soddisfatta' ? 'spunta' : 'spillo'), el('span', { class: 'tb-ob-corpo' }, el('span', { class: 'tb-ob-testo', text: describeCondition(d, c) }), el('span', { class: 'tb-ob-perche', text: t(`tombolo.stato.${r}`) }))));
      });
      this.el.appendChild(goals);
    }

    // Registro degli echi.
    if (this.host.echoesOpen()) {
      const all = a.echoes();
      const heard = this.host.heardEchoes();
      this.el.appendChild(textOf('tombolo.archivio.pannello.echi', { letti: heard.length, totale: all.length }, 'h3', { className: 'tb-ap-sezione' }));
      if (heard.length === 0) this.el.appendChild(textOf('tombolo.archivio.fatto', undefined, 'p', { className: 'tb-ap-nota' }));
      const list = el('ul', { class: 'tb-ap-echi', role: 'list', test: 'tb-ap-echi' });
      for (const h of heard) {
        const key = a.echoAt(h.hour, h.pair);
        if (!key) continue;
        list.appendChild(el('li', { class: 'tb-ap-eco' }, el('span', { class: 'tb-ap-eco-chi', text: this.host.echoNames(h.hour, h.pair) }), el('span', { class: 'tb-ap-eco-testo', text: t(key) })));
      }
      this.el.appendChild(list);
    }
  }

  private mark(icon: string, state: string): HTMLElement {
    return el('span', { class: 'tb-ob-segno', attrs: { 'aria-hidden': 'true' } }, svgIcon(icon, { size: 16 }), el('span', { class: 'tb-ob-stato' }, svgIcon(state, { size: 11 })));
  }
}
