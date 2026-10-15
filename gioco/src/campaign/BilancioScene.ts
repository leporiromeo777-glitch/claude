/**
 * Scena 'bilancio' (GDD 3.14, 4.2, 10.3): un foglio di carta con le richieste
 * (✓ / ✗ e la conseguenza in una riga), i bigliettini lasciati, la memoria di Ada,
 * le voci nuove del Taccuino (toccabili), l'eleganza e i record, gli sblocchi, poi
 * "Riascolta il merletto", "Spartito" e "Continua".
 *
 * Con `{ telaio }` mostra il merletto rigiocato dal Telaio (solo eleganza e record) e
 * torna al Telaio.
 */
import type { ActionEvent, CharacterId, LaceMetrics, Playing, Scene, Services, Viewport } from '../core/types';
import { el } from '../core/ui/dom';
import { button, textOf } from '../core/ui/components';
import { svgIcon } from '../core/ui/glyphs';
import { controller, type BilancioParams } from './controller';
import { dayLabel, SideNotebook } from './frame';
import { scoreFromRows } from './score';
import { charChip, sceneHost, spriteCanvas } from './ui';
import type { DayReport } from './types';
import { showsElegance } from './progress';
import { availableCosmetics, cosmeticNameKey } from '../screens/cosmetics';

function dots(n: number, max = 3): string {
  return '●'.repeat(Math.max(0, Math.min(max, n))) + '○'.repeat(Math.max(0, max - Math.max(0, n)));
}

export class BilancioScene implements Scene {
  readonly id = 'bilancio' as const;
  private root: HTMLElement | null = null;
  private side: SideNotebook | null = null;
  private carillon: Playing | null = null;
  private telaio: BilancioParams['telaio'] | null = null;

  constructor(private readonly s: Services) {}

  enter(params?: unknown): void {
    const p = (params ?? {}) as BilancioParams;
    this.telaio = p.telaio ?? null;
    const c = controller.state();
    if (!this.telaio && (!c || c.phase !== 'bilancio' || !c.report)) {
      void controller.route().then((r) => {
        if (r) controller.go(r);
        else void this.s.scenes.go(this.s.scenes.has('titolo') ? 'titolo' : 'boot');
      });
      return;
    }
    controller.sound('bilancio', this.telaio?.levelId ?? c?.report?.levelId);
    this.side = new SideNotebook(this.s, { from: 'bilancio' });
    const sheet = this.telaio ? this.buildTelaio() : this.buildDay(c?.report as DayReport);
    this.root = el('div', { class: 'cp-scena cp-bilancio', test: 'cp-bilancio' }, el('div', { class: 'cp-centro' }, sheet), this.side.column);
    sceneHost(this.s).appendChild(this.root);
    this.side.sync();
    this.root.querySelector<HTMLElement>('[data-test="cp-bilancio-continua"]')?.focus({ preventScroll: true });
  }

  private header(levelId: string): HTMLElement {
    const lv = this.s.content.levels.get(levelId);
    const lab = dayLabel(this.s.content, levelId);
    return el(
      'header',
      { class: 'cp-foglio-testa' },
      textOf('campaign.bilancio.titolo', undefined, 'h1', { className: 'cp-foglio-titolo' }),
      el('p', { class: 'cp-foglio-sotto' }, textOf(lab.key, lab.params, 'span'), lv ? el('span', { text: ' · ' }) : null, lv ? textOf(lv.titleKey, undefined, 'span') : null),
    );
  }

  private section(titleKey: string, test: string, ...children: (HTMLElement | null)[]): HTMLElement {
    return el('section', { class: 'cp-foglio-sezione', test }, textOf(titleKey, undefined, 'h2', { className: 'cp-foglio-h' }), ...children);
  }

  private buildDay(r: DayReport): HTMLElement {
    const s = this.s;
    const parts: HTMLElement[] = [this.header(r.levelId)];

    // Obiettivi del giorno (prologo, barca di Bepi, …).
    if (r.goals.length > 0) {
      const ok = r.goals.every((g) => g === 'soddisfatta');
      parts.push(
        this.section(
          'campaign.bilancio.obiettivi',
          'cp-bilancio-obiettivi',
          el('p', { class: ['cp-riga', ok ? 'cp-ok' : 'cp-ko'] }, svgIcon(ok ? 'spunta' : 'chiudi', { size: 20 }), textOf(ok ? 'campaign.bilancio.obiettiviOk' : 'campaign.bilancio.obiettiviKo', undefined, 'span')),
        ),
      );
    }

    // Richieste.
    if (r.requests.length > 0) {
      const list = el('ul', { class: 'cp-lista' });
      for (const q of r.requests) {
        const ok = q.status === 'soddisfatta';
        const statusKey = q.wrongGuess ? 'campaign.bilancio.stato.autoreSbagliato' : q.dropped ? 'campaign.bilancio.stato.lasciataCadere' : ok ? 'campaign.bilancio.stato.soddisfatta' : 'campaign.bilancio.stato.fallita';
        list.appendChild(
          el(
            'li',
            { class: ['cp-richiesta', ok ? 'cp-ok' : 'cp-ko'], test: `cp-bilancio-richiesta-${q.noteId}`, data: { stato: q.status } },
            el('span', { class: 'cp-esito', attrs: { 'aria-hidden': 'true' } }, svgIcon(ok ? 'spunta' : 'chiudi', { size: 22 })),
            el('div', { class: 'cp-richiesta-corpo' }, el('p', { class: 'cp-richiesta-testa' }, charChip(s, q.author), textOf(statusKey, undefined, 'span', { className: 'cp-stato' })), textOf(q.consequenceKey, q.consequenceParams, 'p', { rich: true, className: 'cp-conseguenza' })),
          ),
        );
      }
      parts.push(this.section('campaign.bilancio.richieste', 'cp-bilancio-richieste', list));
    } else if (r.dayIndex > 0) {
      parts.push(this.section('campaign.bilancio.richieste', 'cp-bilancio-richieste', textOf('campaign.bilancio.nessunaRichiesta', undefined, 'p', { className: 'cp-tenue' })));
    }

    // Bigliettini lasciati (con conseguenze).
    if (r.ignored.length > 0) {
      const list = el('ul', { class: 'cp-lista' });
      for (const q of r.ignored) {
        list.appendChild(el('li', { class: 'cp-richiesta cp-lasciato', test: `cp-bilancio-lasciato-${q.noteId}` }, el('div', { class: 'cp-richiesta-corpo' }, el('p', { class: 'cp-richiesta-testa' }, charChip(s, q.author), textOf('campaign.bilancio.stato.lasciato', undefined, 'span', { className: 'cp-stato' })), textOf(q.consequenceKey, q.consequenceParams, 'p', { rich: true, className: 'cp-conseguenza' }))));
      }
      parts.push(this.section('campaign.bilancio.lasciati', 'cp-bilancio-lasciati', list));
    }

    // Memoria di Ada (da g12).
    if (r.memoria.length > 0) {
      const list = el('ul', { class: 'cp-lista cp-memoria' });
      for (const m of r.memoria) {
        const up = m.after > m.before;
        list.appendChild(
          el(
            'li',
            { class: 'cp-riga', test: `cp-bilancio-memoria-${m.character}` },
            charChip(s, m.character as CharacterId),
            el('span', { class: 'cp-punti', attrs: { 'aria-hidden': 'true' } }, dots(m.after)),
            // Le parole dicono quanto ricorda (Q055); la direzione è detta a parte.
            textOf('campaign.bilancio.memoriaLivello', { n: m.after }, 'span', { className: 'cp-tenue' }),
            m.after > 0 ? textOf(up ? 'campaign.bilancio.memoriaSu' : 'campaign.bilancio.memoriaGiu', undefined, 'span', { className: 'cp-tenue cp-memoria-verso' }) : null,
          ),
        );
      }
      parts.push(this.section('campaign.bilancio.memoria', 'cp-bilancio-memoria', list));
    }

    // Voci nuove del Taccuino (toccabili).
    if (r.newDiary.length > 0) {
      const list = el('ul', { class: 'cp-lista' });
      for (const id of r.newDiary) {
        const def = s.content.diary.get(id);
        if (!def) continue;
        const b = el('button', { type: 'button', class: 'cp-voce-nuova', test: `cp-bilancio-voce-${id}` }, svgIcon('taccuino', { size: 18 }), textOf(def.textKey, undefined, 'span', { rich: true }));
        b.addEventListener('click', () => this.side?.open({ entry: id }));
        list.appendChild(el('li', null, b));
      }
      parts.push(this.section('campaign.bilancio.taccuino', 'cp-bilancio-voci', list));
    }

    // Eleganza e record da quando la matassa è visibile (GDD 7: g02).
    if (showsElegance(s.content.levels.get(r.levelId))) parts.push(this.elegance(r.metrics, r.record, r.goldThread));

    const unlocks = this.unlocksSection(r.unlocked);
    if (unlocks) parts.push(unlocks);

    parts.push(...this.actions(r.levelId, r.rows, r.spartito, () => controller.afterBilancio()));
    return el('article', { class: 'cp-foglio core-solid', test: 'cp-bilancio-foglio' }, ...parts);
  }

  /**
   * «Si apre qualcosa». Un fuso intagliato si annuncia solo se si può scegliere (ha il suo
   * disegno, `availableCosmetics`): con il nome, l'anteprima e dove si sceglie (Q010, Q058).
   */
  private unlocksSection(unlocked: readonly string[], withTest = true): HTMLElement | null {
    const owned = new Set<string>(availableCosmetics(this.s));
    const list = el('ul', { class: 'cp-lista' });
    for (const u of unlocked) {
      const [kind, id] = u.includes(':') ? (u.split(':') as [string, string]) : [u, ''];
      if (kind === 'cosmetic' && !owned.has(id)) continue;
      const icon = kind === 'cosmetic' ? spriteCanvas(this.s, `fuso/${id}`, 40, { className: 'cp-sblocco-fuso' }) : svgIcon('stella', { size: 18 });
      list.appendChild(el('li', { class: ['cp-riga', 'cp-sblocco', kind === 'cosmetic' ? 'cp-sblocco--fuso' : null], test: withTest ? `cp-bilancio-sblocco-${u}` : undefined }, icon, this.unlockText(kind, id)));
    }
    if (list.childElementCount === 0) return null;
    return this.section('campaign.bilancio.sblocchi', 'cp-bilancio-sblocchi', list);
  }

  private unlockText(kind: string, id: string): HTMLElement {
    if (kind === 'archive') {
      const lv = this.s.content.levels.get(id);
      return textOf('campaign.sblocchi.archivio', { titolo: lv?.archive ? this.s.i18n.t(lv.archive.titleKey) : id }, 'span');
    }
    if (kind === 'cosmetic') {
      return el('span', { class: 'cp-sblocco-testo' }, textOf('campaign.sblocchi.fusoNome', { nome: this.s.i18n.t(cosmeticNameKey(id)) }, 'span'), textOf('campaign.sblocchi.fusoDove', undefined, 'span', { className: 'cp-tenue cp-sblocco-dove' }));
    }
    return textOf(`campaign.sblocchi.${kind}`, undefined, 'span');
  }

  /**
   * Eleganza (R2-D2). I record sono quelli delle stesse richieste e li fa solo un merletto
   * con tutte le richieste e gli obiettivi soddisfatti: un merletto che non conta lo dice e
   * non annuncia né «Nuovo record» né il filo d'oro. «Primo filo d'oro» compare una volta
   * sola nella vita del salvataggio, al posto della riga del filo d'oro (Q016, Q054).
   */
  private elegance(m: LaceMetrics, rec: DayReport['record'], gold: boolean): HTMLElement {
    const rows: HTMLElement[] = [];
    const counted = rec.counted !== false;
    rows.push(el('p', { class: 'cp-riga', test: 'cp-bilancio-incroci' }, textOf(m.minIncroci === null ? 'campaign.bilancio.incrociSenzaMin' : 'campaign.bilancio.incroci', { n: m.incroci, min: m.minIncroci ?? 0 }, 'span')));
    if (m.filoDOro && counted) {
      const key = rec.firstGold ? 'campaign.bilancio.filoDOroPrimo' : gold ? 'campaign.bilancio.filoDOroNuovo' : 'campaign.bilancio.filoDOro';
      rows.push(el('p', { class: ['cp-riga', 'cp-oro', rec.firstGold ? 'cp-oro--primo' : null], test: 'cp-bilancio-oro', data: { primo: rec.firstGold ? '1' : '0' } }, svgIcon('stella', { size: 18 }), textOf(key, undefined, 'span')));
    }
    rows.push(el('p', { class: 'cp-riga' }, textOf('campaign.bilancio.quiete', { n: m.quiete }, 'span')));
    rows.push(el('p', { class: 'cp-riga' }, textOf(m.simmetria ? 'campaign.bilancio.simmetriaSi' : 'campaign.bilancio.simmetriaNo', undefined, 'span')));
    const after = rec.after;
    if (after && after.minIncroci !== null) rows.push(el('p', { class: 'cp-riga cp-tenue', test: 'cp-bilancio-record' }, textOf('campaign.bilancio.record', { incroci: after.minIncroci ?? 0, quiete: after.maxQuiete ?? 0 }, 'span')));
    if (!counted) rows.push(el('p', { class: 'cp-riga cp-tenue', test: 'cp-bilancio-record-escluso' }, textOf('campaign.bilancio.recordNonConta', undefined, 'span')));
    else for (const f of rec.improved) if (f !== 'filoDOro') rows.push(el('p', { class: 'cp-riga cp-nuovo-record', test: `cp-bilancio-nuovo-${f}` }, textOf(`campaign.bilancio.nuovoRecord.${f}`, undefined, 'span')));
    return this.section('campaign.bilancio.eleganza', 'cp-bilancio-eleganza', ...rows);
  }

  /**
   * Pulsanti in fondo al foglio: "Riascolta il merletto", "Spartito" e il Taccuino in una
   * riga; "Continua" in una riga sua che resta attaccata al bordo basso mentre si scorre
   * (GDD 10.1: l'azione principale nel terzo inferiore, anche con molte voci nuove).
   */
  private actions(levelId: string, rows: DayReport['rows'], spartito: string, onContinue: () => void): HTMLElement[] {
    const s = this.s;
    const replay = button({
      labelKey: 'campaign.bilancio.riascolta',
      icon: 'nota',
      kind: 'secondario',
      onClick: () => {
        const lv = s.content.levels.get(levelId);
        if (!lv) return;
        try {
          this.carillon?.stop();
          this.carillon = s.audio.carillon(scoreFromRows(lv, rows, controller.state()?.flags ?? {}, s.content.balance, s.content.balance.anim.beatMs));
        } catch {
          this.carillon = null;
        }
      },
      test: 'cp-bilancio-riascolta',
    });
    const copy = button({
      labelKey: 'campaign.bilancio.spartito',
      icon: 'copia',
      kind: 'secondario',
      disabled: !spartito,
      onClick: () => {
        void s.platform.copy(spartito).then((ok) => s.ui.toast(ok ? 'campaign.bilancio.spartitoCopiato' : 'campaign.bilancio.spartitoNonCopiato', { spartito }, ok ? 'ok' : 'warn'));
      },
      test: 'cp-bilancio-spartito',
    });
    const cont = button({ labelKey: 'campaign.bilancio.continua', icon: 'avanti', kind: 'primario', size: 'grande', onClick: onContinue, test: 'cp-bilancio-continua' });
    return [el('div', { class: 'cp-foglio-azioni' }, replay, copy, this.side?.button() ?? null), el('footer', { class: 'cp-foglio-azioni cp-foglio-continua' }, cont)];
  }

  private buildTelaio(): HTMLElement {
    const t = this.telaio;
    if (!t) return el('article');
    const parts: HTMLElement[] = [this.header(t.levelId), textOf('campaign.bilancio.rigiocata', undefined, 'p', { className: 'cp-tenue' })];
    parts.push(this.elegance(t.metrics, t.record, t.record.goldThread));
    const unlocks = this.unlocksSection(t.record.unlocked, false);
    if (unlocks) parts.push(unlocks);
    parts.push(...this.actions(t.levelId, t.rows, t.spartito, () => void this.s.scenes.go('telaio', { ritorno: true })));
    return el('article', { class: 'cp-foglio core-solid', test: 'cp-bilancio-foglio' }, ...parts);
  }

  exit(): void {
    try {
      this.carillon?.stop();
    } catch {
      /* già fermo */
    }
    this.carillon = null;
    this.side?.destroy();
    this.side = null;
    this.root?.remove();
    this.root = null;
  }

  resize(_vp: Viewport): void {
    this.side?.sync();
  }

  onAction(a: ActionEvent): boolean {
    if (a.action === 'notebook') {
      this.side?.open();
      return true;
    }
    return false;
  }

  onBack(): boolean {
    if (this.telaio) {
      void this.s.scenes.go('telaio', { ritorno: true });
      return true;
    }
    void this.s.scenes.go(this.s.scenes.has('titolo') ? 'titolo' : 'boot');
    return true;
  }
}
