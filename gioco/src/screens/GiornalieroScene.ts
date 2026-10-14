/**
 * Scena 'giornaliero' (GDD 8.3, 10.3 "Merletto del giorno"): scheda con la
 * data, la regola del giorno (pagina del Libro), record e serie; «Tessi».
 * Dopo la notte (parametri `{ risultato: 'giornaliero' }`): risultati,
 * «Condividi», «Copia spartito».
 *
 * Il livello si genera appena si entra (`dailySpec` + `generateAsync`, nel
 * Worker), così «Tessi» parte subito. Se c'è una notte salvata a metà per oggi
 * si offre «Riprendi». «Chi c'è stanotte» (SCH-07) elenca personaggi, stranezze
 * attive e coppie in rancore del merletto generato.
 */
import type { Services } from '../core/types';
import { el } from '../core/ui/dom';
import { textOf } from '../core/ui/components';
import { dailySpec, type GenResult } from '../engine/index';
import { bookPage } from './bookPage';
import { chiSection } from './chi';
import { dailyCount, liveStreak } from './daily';
import { longDate } from './format';
import { icon } from './icons';
import { launchDaily, launchSpartito, savedNightOf } from './launch';
import { resultsSheet, type ResultsView } from './results';
import { ScreenScene } from './ScreenScene';
import { dailyLevel, resultOf, today, type ModeOrigin } from './state';
import { buttonGroup, messageLine, screenFrame, section, statRow, wideButton } from './widgets';

export class GiornalieroScene extends ScreenScene {
  readonly id = 'giornaliero' as const;
  private date = today();
  private gen: GenResult | null = null;
  private failed = false;
  private resultOrigin: ModeOrigin | null = null;
  private results: ResultsView | null = null;
  private busy = false;

  constructor(s: Services) {
    super(s, { glow: { x: 0.15, y: 0.02, r: 0.75, alpha: 0.16 } });
  }

  override enter(params?: unknown): void {
    const p = params && typeof params === 'object' ? (params as { risultato?: unknown }) : {};
    const r = p.risultato === 'giornaliero' || p.risultato === 'spartito' ? p.risultato : null;
    this.resultOrigin = r && resultOf(r) ? r : null;
    this.date = today();
    super.enter(params);
  }

  protected override afterEnter(): void {
    try {
      this.s.audio.setMusic('titolo', this.s.save.data().unlocks.tovaglia ? { stonatura: 0 } : {});
    } catch {
      /* audio non pronto */
    }
    if (this.resultOrigin || !this.s.save.data().unlocks.daily) return;
    void dailyLevel(this.date).then(
      (g) => {
        this.gen = g;
        if (!this.resultOrigin) this.mount(false);
      },
      (err: unknown) => {
        console.error('[screens] daily generation failed', err);
        this.failed = true;
        if (!this.resultOrigin) this.mount(false);
      },
    );
  }

  protected override beforeExit(): void {
    this.results?.destroy();
    this.results = null;
  }

  protected build(): HTMLElement {
    this.results?.destroy();
    this.results = null;
    const s = this.s;
    const res = this.resultOrigin ? resultOf(this.resultOrigin) : null;
    const f = screenFrame({ id: 'giornaliero', titleKey: 'ui.giornaliero.titolo', onBack: () => this.goBack(), variant: res ? 'carta' : 'velluto' });
    if (res) {
      this.results = resultsSheet(s, res, {
        onAgain: () => {
          if (res.origin === 'spartito') void launchSpartito(s, res.outcome.spartito, 'giornaliero');
          else void this.weave(false);
        },
        onBack: () => this.goBack(),
      });
      f.body.appendChild(this.results.el);
      if (this.results.foot.childElementCount > 0) f.foot.appendChild(this.results.foot);
      return f.root;
    }
    if (!s.save.data().unlocks.daily) {
      f.body.appendChild(
        el(
          'div',
          { class: 'sc-chiuso', test: 'sc-giornaliero-chiuso' },
          icon('lucchetto', 40),
          textOf('ui.giornaliero.bloccato', undefined, 'p', { className: 'sc-chiuso-testo' }),
        ),
      );
      return f.root;
    }
    const d = s.save.data();
    const spec = dailySpec(this.date);
    const record = d.daily[this.date];
    const streak = liveStreak(d.stats, this.date);
    const levelId = `day-${this.date}`;
    const saved = savedNightOf(s, levelId);

    const dateLine = textOf('ui.giornaliero.data', { data: longDate(this.date, s.i18n.locale()) }, 'p', { className: 'sc-data' });
    dateLine.dataset.test = 'sc-giornaliero-data';
    const status = el('p', { class: 'sc-stato', test: 'sc-giornaliero-stato', attrs: { 'aria-live': 'polite' } });
    status.appendChild(
      textOf(this.failed ? 'ui.giornaliero.errore' : this.gen ? 'ui.giornaliero.pronto' : 'ui.giornaliero.preparazione', undefined, 'span'),
    );
    status.dataset.stato = this.failed ? 'errore' : this.gen ? 'pronto' : 'attesa';

    const info = el(
      'div',
      { class: 'sc-stats', test: 'sc-giornaliero-info' },
      statRow('ui.giornaliero.dimensioni', textOf('ui.comune.filiOre', { fili: spec.columns, ore: spec.rows }, 'span'), 'sc-giornaliero-dimensioni'),
      statRow(
        'ui.giornaliero.matassa',
        this.gen ? textOf('ui.giornaliero.matassaValore', { n: this.gen.level.matassa, min: this.gen.min }, 'span') : textOf('ui.giornaliero.matassaRegola', undefined, 'span'),
        'sc-giornaliero-matassa',
      ),
    );
    const records = el(
      'div',
      { class: 'sc-stats sc-stats--record', test: 'sc-giornaliero-record' },
      statRow(
        'ui.giornaliero.recordOggi',
        record ? textOf('ui.giornaliero.recordValore', { n: record.incroci, min: record.min }, 'span') : textOf('ui.giornaliero.nessunRecord', undefined, 'span'),
        'sc-giornaliero-record-oggi',
      ),
      statRow('ui.giornaliero.serie', textOf('ui.giornaliero.serieValore', { n: streak }, 'span'), 'sc-giornaliero-serie'),
      statRow('ui.giornaliero.totale', textOf('ui.giornaliero.totaleValore', { n: dailyCount(d.daily) }, 'span'), 'sc-giornaliero-totale'),
    );

    const msg = messageLine('sc-giornaliero-messaggio');
    const actions: HTMLButtonElement[] = [];
    if (saved) {
      actions.push(wideButton({ icon: 'play', labelKey: 'ui.giornaliero.riprendi', kind: 'primario', onClick: () => void this.weave(true, msg.show), test: 'sc-giornaliero-riprendi' }));
      actions.push(wideButton({ icon: 'ricomincia', labelKey: 'ui.giornaliero.daCapo', onClick: () => void this.weave(false, msg.show), test: 'sc-giornaliero-tessi' }));
    } else {
      actions.push(
        wideButton({
          icon: 'play',
          labelKey: record ? 'ui.giornaliero.ritessi' : 'ui.giornaliero.tessi',
          kind: 'primario',
          onClick: () => void this.weave(false, msg.show),
          test: 'sc-giornaliero-tessi',
          disabled: this.failed,
        }),
      );
    }
    actions.push(
      wideButton({
        icon: 'importa',
        labelKey: 'ui.giornaliero.importa',
        onClick: () => void s.ui.openOverlay('spartito', { returnTo: 'giornaliero' }),
        test: 'sc-giornaliero-importa',
      }),
    );
    if (actions[0]) actions[0].dataset.autofocus = '1';

    f.body.append(
      dateLine,
      status,
      section('ui.giornaliero.regola', 'nota', 'sc-giornaliero-regola', bookPage(s, spec.rule, 'sc-giornaliero-libro')),
      chiSection(s, this.gen?.level ?? null, 'sc-giornaliero-chi'),
      section('ui.giornaliero.merletto', 'gomitolo', 'sc-giornaliero-merletto', info),
      section('ui.giornaliero.record', 'stella', 'sc-giornaliero-records', records),
    );
    // Nel piede solo l'azione principale (sempre visibile anche con il testo grande); il resto in fondo al foglio.
    const [first, ...others] = actions;
    if (others.length > 0) f.body.appendChild(buttonGroup(others, 'sc-azioni', 'sc-giornaliero-altre', 'vertical'));
    f.foot.append(msg.el, buttonGroup(first ? [first] : [], 'sc-azioni', 'sc-giornaliero-azioni', 'vertical'));
    return f.root;
  }

  /** Tessi (o Riprendi): genera se serve e apre il tombolo. */
  async weave(resume: boolean, show?: (key: string | null, params?: Record<string, string | number>, kind?: 'errore' | 'info' | 'ok') => void): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    show?.('ui.giornaliero.preparazione', undefined, 'info');
    const r = await launchDaily(this.s, this.date, { resume });
    this.busy = false;
    if (!r.ok) {
      show?.(r.errorKey === 'ui.notteInCorso.rinuncia' ? null : r.errorKey, undefined, 'errore');
      return false;
    }
    show?.(null);
    return true;
  }
}
