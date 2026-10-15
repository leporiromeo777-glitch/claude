/**
 * Scena 'libero' (GDD 8.4, 10.3 "Merletto libero"): seme (casuale o scritto),
 * dimensione, gradi (interruttori con descrizione, chiusi finché
 * `unlocks.gradi` è falso), «Tessi»; più «Importa spartito».
 * Dopo la notte (`{ risultato: 'libero' | 'spartito' }`): i risultati.
 *
 * Revisione 1 (SCH-04, P036): con una notte libera a metà sullo stesso seme e
 * gli stessi gradi il pulsante fisso è «Riprendi il merletto»
 * (`sc-libero-riprendi`) e «Tessi da capo» (`sc-libero-dacapo`, in cima)
 * chiede conferma; con una notte a metà di un altro seme «Riprendi il merletto
 * <seme>» sta in cima alla pagina. Al primo ingresso dopo un ricaricamento la
 * scelta riparte dal seme della notte a metà.
 *
 * Il livello si prepara in background (Worker) a ogni cambio di seme,
 * dimensione o gradi, così «Tessi» parte subito.
 */
import type { GradoId, Services } from '../core/types';
import { el } from '../core/ui/dom';
import { iconButton, textOf, toggle, type ToggleHandle } from '../core/ui/components';
import { bookPage } from './bookPage';
import { chiSection } from './chi';
import { icon } from './icons';
import { launchLibero, launchSpartito } from './launch';
import {
  DIMENSIONI,
  DIMENSIONI_ORDER,
  GRADI_ORDER,
  SEED_MAX,
  dimensioneOf,
  gradiPoints,
  isSeed,
  liberoLevelId,
  normalizeGradi,
  normalizeSeed,
  parseLiberoId,
  randomSeed,
  ruleOfSeed,
  withDimensione,
  type Dimensione,
} from './libero';
import { resultsSheet, type ResultsView } from './results';
import { ScreenScene } from './ScreenScene';
import { generatedNow, liberoLevel, resultOf, type ModeOrigin } from './state';
import { buttonGroup, messageLine, screenFrame, section, segmented, statRow, wideButton } from './widgets';

/** Ultima scelta (resta fra un ingresso e l'altro nella stessa sessione). */
const choice: { seed: string; size: Dimensione; gradi: GradoId[] } = { seed: '', size: 'medio', gradi: [] };

export function liberoChoice(): { seed: string; size: Dimensione; gradi: GradoId[] } {
  if (!choice.seed) choice.seed = randomSeed(choice.size);
  return { seed: choice.seed, size: choice.size, gradi: [...choice.gradi] };
}

export function setLiberoChoice(c: Partial<{ seed: string; size: Dimensione; gradi: GradoId[] }>): void {
  if (c.size) {
    choice.size = c.size;
    if (choice.seed) choice.seed = withDimensione(choice.seed, c.size);
  }
  if (c.seed && isSeed(c.seed)) {
    choice.seed = c.seed;
    choice.size = dimensioneOf(c.seed) ?? choice.size;
  }
  if (c.gradi) choice.gradi = normalizeGradi(c.gradi);
}

/** Grado più alto (in punti) di un Merletto libero completato. */
export function bestGradiPoints(records: Record<string, unknown>): number {
  let best = 0;
  for (const id of Object.keys(records)) {
    const p = parseLiberoId(id);
    if (p) best = Math.max(best, gradiPoints(p.gradi));
  }
  return best;
}

export class LiberoScene extends ScreenScene {
  readonly id = 'libero' as const;
  private resultOrigin: ModeOrigin | null = null;
  private results: ResultsView | null = null;
  private busy = false;
  private prepTimer: ReturnType<typeof setTimeout> | null = null;
  private dynamic: HTMLElement | null = null;
  /** Pulsanti che dipendono dalla notte a metà: in cima alla pagina e nel piede. */
  private topActions: HTMLElement | null = null;
  private footActions: HTMLElement | null = null;
  private show: ((key: string | null, params?: Record<string, string | number>, kind?: 'errore' | 'info' | 'ok') => void) | null = null;
  /** Il testo nel campo del seme non è un seme valido (Tessi non deve partire con il seme di prima). */
  private seedInvalid = false;
  private seedField: HTMLInputElement | null = null;

  constructor(s: Services) {
    super(s, { glow: { x: 0.85, y: 0.04, r: 0.7, alpha: 0.13 } });
  }

  override enter(params?: unknown): void {
    const p = params && typeof params === 'object' ? (params as { risultato?: unknown }) : {};
    const r = p.risultato === 'libero' || p.risultato === 'spartito' ? p.risultato : null;
    this.resultOrigin = r && resultOf(r) ? r : null;
    // Nessuna scelta ancora (primo ingresso dopo un ricaricamento): si parte dalla notte a metà.
    if (!choice.seed) {
      const half = this.savedLibero();
      if (half) setLiberoChoice({ seed: half.seed, gradi: half.gradi });
    }
    liberoChoice();
    super.enter(params);
  }

  /** La notte libera salvata a metà (seme e gradi), se c'è. */
  private savedLibero(): { seed: string; gradi: GradoId[]; levelId: string } | null {
    const n = this.s.save.data().night;
    if (!n || n.origin !== 'libero') return null;
    const p = parseLiberoId(n.params.levelId);
    if (!p) return null;
    return { seed: p.seed, gradi: n.params.gradi ?? p.gradi, levelId: n.params.levelId };
  }

  /** La notte a metà è proprio quella della scelta corrente (stesso seme, stessi gradi)? */
  private savedIsChoice(): boolean {
    const half = this.savedLibero();
    if (!half) return false;
    const c = liberoChoice();
    return half.levelId === liberoLevelId(c.seed, this.allowedGradi(c.gradi));
  }

  protected override afterEnter(): void {
    try {
      this.s.audio.setMusic('titolo', this.s.save.data().unlocks.tovaglia ? { stonatura: 0 } : {});
    } catch {
      /* audio non pronto */
    }
    if (!this.resultOrigin) this.prepare();
  }

  protected override beforeExit(): void {
    this.seedField = null;
    this.seedInvalid = false;
    if (this.prepTimer !== null) clearTimeout(this.prepTimer);
    this.prepTimer = null;
    this.results?.destroy();
    this.results = null;
  }

  /** Prepara il livello della scelta corrente nel Worker (in cache). */
  private prepare(delayMs = 0): void {
    if (this.prepTimer !== null) clearTimeout(this.prepTimer);
    this.prepTimer = setTimeout(() => {
      this.prepTimer = null;
      const c = liberoChoice();
      if (!this.s.save.data().unlocks.libero) return;
      void liberoLevel(c.seed, this.allowedGradi(c.gradi)).catch(() => undefined);
    }, delayMs);
  }

  private allowedGradi(g: readonly GradoId[]): GradoId[] {
    return this.s.save.data().unlocks.gradi ? normalizeGradi(g) : [];
  }

  private locked(): boolean {
    return !this.s.save.data().unlocks.libero || !this.s.entitlements.isUnlocked('fullGame');
  }

  protected build(): HTMLElement {
    this.results?.destroy();
    this.results = null;
    const s = this.s;
    const res = this.resultOrigin ? resultOf(this.resultOrigin) : null;
    const f = screenFrame({ id: 'libero', titleKey: 'ui.libero.titolo', onBack: () => this.goBack(), variant: res ? 'carta' : 'velluto' });
    if (res) {
      this.results = resultsSheet(s, res, {
        onAgain: () => {
          if (res.origin === 'spartito') void launchSpartito(s, res.outcome.spartito, 'libero');
          else {
            const p = parseLiberoId(res.level.id);
            if (p) void launchLibero(s, p.seed, res.gradi.length ? res.gradi : p.gradi);
          }
        },
        onBack: () => this.goBack(),
        onNew: () => {
          setLiberoChoice({ seed: randomSeed(liberoChoice().size) });
          this.resultOrigin = null;
          this.mount(false);
          this.prepare();
        },
      });
      f.body.appendChild(this.results.el);
      if (this.results.foot.childElementCount > 0) f.foot.appendChild(this.results.foot);
      return f.root;
    }
    if (this.locked()) {
      f.body.append(
        el(
          'div',
          { class: 'sc-chiuso', test: 'sc-libero-chiuso' },
          icon('lucchetto', 40),
          textOf(s.entitlements.isUnlocked('fullGame') ? 'ui.libero.bloccato' : 'ui.titolo.lucchetto.completo', undefined, 'p', { className: 'sc-chiuso-testo' }),
        ),
        wideButton({ icon: 'importa', labelKey: 'ui.libero.importa', onClick: () => void s.ui.openOverlay('spartito', { returnTo: 'libero' }), test: 'sc-libero-importa' }),
      );
      return f.root;
    }

    const c = liberoChoice();
    const msg = messageLine('sc-libero-messaggio');

    // ───── Seme ─────
    const seedInput = el('input', {
      type: 'text',
      class: 'sc-campo sc-campo--seme',
      value: c.seed,
      attrs: {
        maxlength: SEED_MAX,
        autocomplete: 'off',
        autocapitalize: 'off',
        spellcheck: 'false',
        inputmode: 'text',
        'aria-label': s.i18n.t('ui.libero.seme'),
        'aria-describedby': 'sc-libero-seme-aiuto',
      },
      data: { i18nLabel: 'ui.libero.seme' },
      test: 'sc-libero-seme',
    });
    const dice = iconButton({
      icon: 'gomitolo',
      labelKey: 'ui.libero.semeCasuale',
      onClick: () => {
        setLiberoChoice({ seed: randomSeed(liberoChoice().size) });
        seedInput.value = liberoChoice().seed;
        this.seedInvalid = false;
        seedInput.removeAttribute('aria-invalid');
        msg.show(null);
        this.updateDynamic();
        this.prepare(200);
      },
      size: 48,
      kind: 'secondario',
      className: 'sc-dado',
      test: 'sc-libero-casuale',
    });
    dice.replaceChildren(icon('dado', 24));
    this.seedField = seedInput;
    this.seedInvalid = false;
    seedInput.addEventListener('input', () => {
      const n = normalizeSeed(seedInput.value, liberoChoice().size);
      if (!n) {
        this.seedInvalid = true;
        seedInput.setAttribute('aria-invalid', 'true');
        msg.show(seedInput.value.trim() ? 'ui.libero.semeNonValido' : 'ui.libero.semeVuoto', undefined, 'errore');
        return;
      }
      this.seedInvalid = false;
      seedInput.removeAttribute('aria-invalid');
      msg.show(null);
      const prevSize = liberoChoice().size;
      setLiberoChoice({ seed: n });
      if (liberoChoice().size !== prevSize) size.set(liberoChoice().size);
      this.updateDynamic();
      this.prepare(400);
    });
    seedInput.addEventListener('blur', () => {
      // Un seme non valido resta scritto (con l'errore) finché il giocatore non lo corregge.
      if (!this.seedInvalid) seedInput.value = liberoChoice().seed;
    });
    seedInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (this.savedIsChoice()) void this.resumeSaved(msg.show);
        else void this.weave(false, msg.show);
      }
    });
    const seedRow = el('div', { class: 'sc-seme' }, seedInput, dice);
    const seedHelp = textOf('ui.libero.semeAiuto', undefined, 'p', { className: 'sc-nota' });
    seedHelp.id = 'sc-libero-seme-aiuto';

    // ───── Dimensione ─────
    const size = segmented<Dimensione>({
      labelKey: 'ui.libero.dimensione',
      options: DIMENSIONI_ORDER.map((d) => ({ value: d, labelKey: `ui.libero.dimensioni.${d}`, descKey: 'ui.comune.filiOre', params: { fili: DIMENSIONI[d].columns, ore: DIMENSIONI[d].rows } })),
      value: c.size,
      onChange: (v) => {
        setLiberoChoice({ size: v });
        seedInput.value = liberoChoice().seed;
        this.seedInvalid = false;
        seedInput.removeAttribute('aria-invalid');
        msg.show(null);
        this.updateDynamic();
        this.prepare(200);
      },
      test: 'sc-libero-dimensione',
      hideLabel: true,
    });

    // ───── Gradi ─────
    const gradiOpen = s.save.data().unlocks.gradi;
    const toggles: [GradoId, ToggleHandle][] = GRADI_ORDER.map((g) => {
      const t = toggle({
        labelKey: `ui.libero.grado.${g}.nome`,
        descriptionKey: `ui.libero.grado.${g}.desc`,
        value: gradiOpen && c.gradi.includes(g),
        onChange: (v) => {
          const cur = new Set(liberoChoice().gradi);
          if (v) cur.add(g);
          else cur.delete(g);
          setLiberoChoice({ gradi: [...cur] });
          this.updateDynamic();
          this.prepare(300);
        },
        test: `sc-libero-grado-${g}`,
      });
      if (!gradiOpen) {
        t.el.disabled = true;
        t.el.setAttribute('aria-disabled', 'true');
      }
      return [g, t];
    });
    const gradiNote = gradiOpen
      ? null
      : el('p', { class: 'sc-nota sc-nota--chiusa', test: 'sc-libero-gradi-chiusi' }, icon('lucchetto', 18), textOf('ui.libero.gradiBloccati', undefined, 'span'));

    this.dynamic = el('div', { class: 'sc-libero-dinamico', test: 'sc-libero-dinamico' });

    this.show = msg.show;
    this.topActions = el('div', { class: 'sc-libero-cima', test: 'sc-libero-cima' });
    this.footActions = el('div', { class: 'sc-libero-piede' });
    const others = [wideButton({ icon: 'importa', labelKey: 'ui.libero.importa', onClick: () => void s.ui.openOverlay('spartito', { returnTo: 'libero' }), test: 'sc-libero-importa' })];

    f.body.append(
      this.topActions,
      section('ui.libero.seme', 'dado', 'sc-libero-sezione-seme', seedRow, seedHelp),
      section('ui.libero.dimensione', 'gomitolo', 'sc-libero-sezione-dimensione', size.el),
      this.dynamic,
      section('ui.libero.gradi', 'stella', 'sc-libero-sezione-gradi', gradiNote, el('div', { class: 'sc-gradi', test: 'sc-libero-gradi' }, ...toggles.map(([, t]) => t.el))),
    );
    f.body.appendChild(buttonGroup(others, 'sc-azioni', 'sc-libero-altre', 'vertical'));
    f.foot.append(msg.el, this.footActions);
    this.updateDynamic();
    return f.root;
  }

  /**
   * Pulsanti legati alla notte a metà (SCH-04): nel piede «Tessi» o, se la notte a
   * metà è di questa scelta, «Riprendi il merletto»; in cima «Tessi da capo» (con
   * conferma) o il «Riprendi» di una notte a metà di un altro seme.
   */
  private updateActions(): void {
    const top = this.topActions;
    const foot = this.footActions;
    if (!top || !foot) return;
    const show = this.show ?? undefined;
    const half = this.savedLibero();
    const same = this.savedIsChoice();
    const hadFocus = foot.contains(document.activeElement) || top.contains(document.activeElement);
    let primary: HTMLButtonElement;
    const topButtons: HTMLButtonElement[] = [];
    if (same) {
      primary = wideButton({ icon: 'play', labelKey: 'ui.libero.riprendiQui', kind: 'primario', onClick: () => void this.resumeSaved(show), test: 'sc-libero-riprendi' });
      topButtons.push(wideButton({ icon: 'ricomincia', labelKey: 'ui.libero.daCapo', onClick: () => void this.weaveFromScratch(show), test: 'sc-libero-dacapo' }));
    } else {
      primary = wideButton({ icon: 'play', labelKey: 'ui.libero.tessi', kind: 'primario', onClick: () => void this.weave(false, show), test: 'sc-libero-tessi' });
      if (half) {
        topButtons.push(
          wideButton({
            icon: 'ricomincia',
            labelKey: 'ui.libero.riprendi',
            labelParams: { seme: half.seed },
            onClick: () => void this.resumeSaved(show),
            test: 'sc-libero-riprendi',
          }),
        );
      }
    }
    primary.dataset.autofocus = '1';
    foot.replaceChildren(buttonGroup([primary], 'sc-azioni', 'sc-libero-azioni', 'vertical'));
    top.replaceChildren(...(topButtons.length ? [buttonGroup(topButtons, 'sc-azioni', 'sc-libero-cima-azioni', 'vertical')] : []));
    top.hidden = topButtons.length === 0;
    if (hadFocus) primary.focus({ preventScroll: true });
  }

  /** «Tessi da capo» sulla stessa scelta della notte a metà: chiede prima di disfarla. */
  async weaveFromScratch(show?: (key: string | null, params?: Record<string, string | number>, kind?: 'errore' | 'info' | 'ok') => void): Promise<boolean> {
    if (this.busy) return false;
    if (this.savedIsChoice()) {
      const ok = await this.s.ui.confirm({
        titleKey: 'ui.libero.daCapoDomanda.titolo',
        bodyKey: 'ui.libero.daCapoDomanda.corpo',
        okKey: 'ui.libero.daCapoDomanda.ok',
        cancelKey: 'ui.libero.daCapoDomanda.annulla',
        danger: true,
      });
      if (!ok) {
        show?.('ui.notteInCorso.rinuncia', undefined, 'info');
        return false;
      }
    }
    return this.weave(false, show);
  }

  /** Regola, punti dei gradi e record della scelta corrente. */
  private updateDynamic(): void {
    this.updateActions();
    const host = this.dynamic;
    if (!host) return;
    const s = this.s;
    const c = liberoChoice();
    const gradi = this.allowedGradi(c.gradi);
    const rule = ruleOfSeed(c.seed);
    const levelId = liberoLevelId(c.seed, gradi);
    const rec = s.save.data().records[levelId];
    const best = bestGradiPoints(s.save.data().records);
    // «Chi c'è stanotte» (SCH-07): dal livello generato; se non è pronto, appena lo è.
    const gen = generatedNow(levelId);
    if (!gen) {
      void liberoLevel(c.seed, gradi).then(
        () => {
          const now = liberoChoice();
          if (this.dynamic === host && host.isConnected && liberoLevelId(now.seed, this.allowedGradi(now.gradi)) === levelId) this.updateDynamic();
        },
        () => undefined,
      );
    }
    host.replaceChildren(
      section('ui.libero.regola', 'foglio', 'sc-libero-regola', bookPage(s, rule, 'sc-libero-libro')),
      chiSection(s, gen?.level ?? null, 'sc-libero-chi'),
      section(
        'ui.libero.record',
        'stella',
        'sc-libero-records',
        el(
          'div',
          { class: 'sc-stats sc-stats--record' },
          statRow('ui.libero.punti', textOf('ui.libero.puntiValore', { n: gradi.length }, 'span'), 'sc-libero-punti'),
          statRow(
            'ui.libero.recordSeme',
            rec && rec.minIncroci !== null ? textOf('ui.risultato.incrociSolo', { n: rec.minIncroci }, 'span') : textOf('ui.libero.nessunRecord', undefined, 'span'),
            'sc-libero-record-seme',
          ),
          statRow('ui.libero.gradoMigliore', textOf('ui.libero.puntiValore', { n: best }, 'span'), 'sc-libero-grado-migliore'),
        ),
      ),
    );
  }

  async resumeSaved(show?: (key: string | null, params?: Record<string, string | number>, kind?: 'errore' | 'info' | 'ok') => void): Promise<void> {
    const half = this.savedLibero();
    if (!half || this.busy) return;
    this.busy = true;
    const r = await launchLibero(this.s, half.seed, half.gradi, { resume: true });
    this.busy = false;
    if (!r.ok) show?.(r.errorKey === 'ui.notteInCorso.rinuncia' ? null : r.errorKey, undefined, 'errore');
  }

  /** Tessi con la scelta corrente. */
  async weave(_resume: boolean, show?: (key: string | null, params?: Record<string, string | number>, kind?: 'errore' | 'info' | 'ok') => void): Promise<boolean> {
    if (this.busy) return false;
    const c = liberoChoice();
    if (this.seedInvalid || !isSeed(c.seed)) {
      show?.(this.seedField && !this.seedField.value.trim() ? 'ui.libero.semeVuoto' : 'ui.libero.semeNonValido', undefined, 'errore');
      this.seedField?.focus();
      return false;
    }
    this.busy = true;
    show?.('ui.libero.preparazione', undefined, 'info');
    const r = await launchLibero(this.s, c.seed, this.allowedGradi(c.gradi));
    this.busy = false;
    if (!r.ok) {
      show?.(r.errorKey === 'ui.notteInCorso.rinuncia' ? null : r.errorKey, undefined, 'errore');
      return false;
    }
    show?.(null);
    return true;
  }
}
