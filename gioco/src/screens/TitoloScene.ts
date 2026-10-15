/**
 * Scena 'titolo' (GDD 9, 10.3; ARCHITETTURA 5.4-5.5): il tombolo alla luce
 * della lampada su canvas (TitleArt), titolo e menu nel DOM, in basso.
 *
 * - Continua → `scenes.go('sera', { cmd: 'continua' })`; Nuova storia →
 *   `{ cmd: 'nuova', confirmed: true }` (la conferma, se c'è già una storia, la
 *   chiede il titolo); Telaio → `scenes.go('telaio')` se la scena esiste.
 * - Merletto del giorno e Merletto libero con i lucchetti di `save.unlocks`;
 *   Impostazioni e Crediti compatti in fondo (azioni rare).
 * - Primissimo avvio (GDD 9): «una scritta sola», «Tocca per iniziare» («Clicca
 *   per iniziare» con il mouse); le modalità chiuse si vedono con il lucchetto e
 *   la condizione (D17), Impostazioni e Crediti sono due icone.
 * - Il menu scorre: una freccia sotto il menu, fuori dall'area che scorre, dice che
 *   sotto c'è dell'altro (SCH-10; revisione 2, Q068: non copre più l'ultima voce).
 * - Dopo il finale vero (`unlocks.tovaglia`): un filo corallo sul tombolo e una
 *   stella accanto a Telaio (SCH-15, P121); sotto «Telaio» una riga a video (revisione 2,
 *   Q036): «la Tovaglia è sul Telaio» se il Telaio di questa storia la mostra, altrimenti
 *   «la campana suona intonata».
 * - Musica del titolo (campana intonata dopo il finale vero) e laguna.
 * - Telefono verticale: titolo, tombolo, menu in colonna. Schermi larghi
 *   (rapporto ≥ 1,25 e almeno 640 px): tombolo a sinistra, titolo e menu a destra.
 */
import type { ActionEvent, CanvasHost, Scene, Services, Unsub, Viewport } from '../core/types';
import { el } from '../core/ui/dom';
import { arrowNavigation, textOf } from '../core/ui/components';
import { dailySpec } from '../engine/index';
import { resumeNight } from '../tombolo/index';
import { icon, laceEdge } from './icons';
import { TitleArt } from './titleArt';
import { isFirstLaunch, titleItems, tovagliaOnLoom, type TitleItem, type TitleItemId } from './titleMenu';
import { ruleTitleKey } from './bookPage';
import { today } from './state';
import { sceneRoot, wideButton } from './widgets';

/** Il primo titolo della sessione compare più lentamente (atmosfera). */
let firstTitle = true;
let current: TitoloScene | null = null;

/** Il titolo aperto (per il debug e per aggiornare i lucchetti). */
export function currentTitle(): TitoloScene | null {
  return current;
}

/** Si gioca con il mouse? Un puntatore fine con il passaggio (e nessun tocco già visto). */
export function usesMouse(s: Pick<Services, 'input'>): boolean {
  try {
    if (s.input.lastDevice() === 'touch') return false;
  } catch {
    /* input non pronto */
  }
  try {
    return typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch {
    return false;
  }
}

export function isLandscapeLayout(vp: Pick<Viewport, 'cssW' | 'cssH'>): boolean {
  return vp.cssW >= 640 && vp.cssW / Math.max(1, vp.cssH) >= 1.25;
}

export class TitoloScene implements Scene {
  readonly id = 'titolo' as const;
  private root: HTMLElement | null = null;
  private stage: HTMLElement | null = null;
  private art: TitleArt;
  private readonly offs: Unsub[] = [];
  private ro: ResizeObserver | null = null;
  private measure = true;
  private locale = '';
  private items: TitleItem[] = [];
  private landscape = false;
  private built = false;
  private shade: () => void = () => undefined;

  constructor(private readonly s: Services) {
    const st = s.settings.get();
    const still = st.reducedMotion || st.animSpeed === 0;
    this.art = new TitleArt(s, { fadeSeconds: still ? 0 : firstTitle ? 1.8 : 0.6, trueEnding: s.save.data().unlocks.tovaglia === true });
    this.art.setStill(still);
  }

  enter(): void {
    firstTitle = false;
    current = this;
    this.locale = this.s.i18n.locale();
    this.build();
    this.music();
    this.offs.push(
      this.s.bus.on('settings:change', (st) => {
        this.art.setStill(st.reducedMotion || st.animSpeed === 0);
        this.art.invalidate();
        this.measure = true;
        if (st.locale !== this.locale) {
          this.locale = st.locale;
          this.build();
        }
      }),
    );
  }

  exit(): void {
    if (current === this) current = null;
    for (const off of this.offs.splice(0)) off();
    this.ro?.disconnect();
    this.ro = null;
    this.root?.remove();
    this.root = null;
    this.stage = null;
  }

  private music(): void {
    try {
      const tovaglia = this.s.save.data().unlocks.tovaglia;
      this.s.audio.setMusic('titolo', tovaglia ? { stonatura: 0 } : {});
      // GDD 9: «Laguna e orologio che ticchetta» (il ticchettio si ferma nel prologo).
      this.s.audio.setAmbience('laguna', undefined, { clock: true });
    } catch {
      /* audio non pronto */
    }
  }

  /** Voci correnti del menu (anche per il debug). */
  menu(): TitleItem[] {
    return this.items.map((i) => ({ ...i }));
  }

  /** Ricostruisce il menu (dopo uno sblocco o un import). */
  refresh(): void {
    this.build();
  }

  private context(): Parameters<typeof titleItems>[1] {
    const d = this.s.save.data();
    return {
      hasTelaio: this.s.scenes.has('telaio'),
      fullGame: this.s.entitlements.isUnlocked('fullGame'),
      dailyDoneToday: !!d.daily[today()],
      mouse: usesMouse(this.s),
      trueEnding: d.unlocks.tovaglia === true,
      tovagliaOnLoom: d.unlocks.tovaglia === true && tovagliaOnLoom(d, this.s.content.campaign?.finals?.aperto),
    };
  }

  private build(): void {
    const s = this.s;
    const focusedId = (document.activeElement as HTMLElement | null)?.dataset?.test ?? null;
    this.root?.remove();
    this.ro?.disconnect();
    this.items = titleItems(s.save.data(), this.context());

    const head = el(
      'header',
      { class: 'sc-titolo-testa' },
      textOf('ui.titolo.nome', undefined, 'h1', { className: 'sc-titolo-nome' }),
      laceEdge('sc-smerlo sc-smerlo--titolo', 9),
      textOf('ui.titolo.sottotitolo', undefined, 'p', { className: 'sc-titolo-sotto' }),
    );
    this.stage = el('div', { class: 'sc-titolo-palco', attrs: { 'aria-hidden': 'true' }, test: 'sc-titolo-palco' });
    const first = isFirstLaunch(s.save.data());
    const slots: Record<TitleItem['slot'], HTMLElement[]> = { principale: [], modo: [], piede: [] };
    for (const it of this.items) slots[it.slot].push(this.button(it, first));
    const nav = el(
      'nav',
      { class: 'sc-titolo-menu core-solid', attrs: { 'aria-label': s.i18n.t('ui.titolo.menu') }, test: 'sc-titolo-menu' },
      el('div', { class: 'sc-titolo-principali' }, ...slots.principale),
      slots.modo.length > 0 ? el('div', { class: 'sc-titolo-griglia', test: 'sc-titolo-modi' }, ...slots.modo) : null,
      el('div', { class: 'sc-titolo-piede', test: 'sc-titolo-piede' }, ...slots.piede),
    );
    // Segno di scorrimento (SCH-10, P055) in una striscia sua SOTTO il menu, fuori dall'area che
    // scorre: non copre mai una voce (revisione 2, Q068: la freccia cadeva su «Crediti»). C'è
    // finché il menu scorre; la freccia si accende quando sotto c'è dell'altro.
    const hint = el('div', { class: 'sc-titolo-ombra', test: 'sc-titolo-ombra', attrs: { 'aria-hidden': 'true' } });
    const shade = (): void => {
      const overflow = nav.scrollHeight > nav.clientHeight + 2;
      const more = nav.scrollTop + nav.clientHeight < nav.scrollHeight - 2;
      nav.dataset.scorre = more ? 'giu' : 'no';
      hint.dataset.stato = !overflow ? 'no' : more ? 'giu' : 'fine';
    };
    nav.addEventListener('scroll', shade, { passive: true });
    this.shade = shade;
    // Frecce fra tutte le voci del menu.
    arrowNavigation(nav, 'button', 'both');
    const version = textOf('ui.titolo.versione', { versione: typeof __GAME_VERSION__ === 'string' ? __GAME_VERSION__ : '' }, 'p', { className: 'sc-titolo-versione' });
    version.setAttribute('aria-hidden', 'true');
    const side = el('div', { class: 'sc-titolo-lato' }, head, nav, hint, version);
    this.root = el(
      'div',
      { class: ['sc-titolo', !this.built && 'sc-titolo--entra', first && 'sc-titolo--primo'], test: 'sc-titolo', data: { forma: this.landscape ? 'orizzontale' : 'verticale' } },
      this.stage,
      side,
    );
    this.built = true;
    this.applyForm(this.s.viewport.get());
    sceneRoot(s).appendChild(this.root);
    this.measure = true;
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => {
        this.measure = true;
        this.shade();
      });
      this.ro.observe(this.stage);
      this.ro.observe(nav);
    }
    shade();
    requestAnimationFrame(() => this.shade());
    // Fuoco sulla voce di prima (dopo un cambio di lingua) o sulla principale.
    const again = focusedId ? this.root.querySelector<HTMLElement>(`[data-test="${focusedId}"]`) : null;
    (again ?? this.root.querySelector<HTMLElement>('.sc-titolo-principali button'))?.focus({ preventScroll: true });
  }

  private button(it: TitleItem, first: boolean): HTMLButtonElement {
    const s = this.s;
    if (it.slot === 'piede') {
      // Impostazioni e Crediti: compatti in fondo; al primo avvio solo l'icona (una scritta sola, GDD 9).
      const b = wideButton({ icon: it.icon, labelKey: it.labelKey, kind: 'testo', onClick: () => void this.activate(it.id), test: `sc-titolo-${it.id}`, iconOnly: first, className: 'sc-voce--piede' });
      if (first) b.title = s.i18n.t(it.labelKey);
      return b;
    }
    let subParams: Record<string, string> | undefined;
    if (it.id === 'giornaliero' && !it.locked) {
      try {
        subParams = { regola: s.i18n.t(ruleTitleKey(s, dailySpec(today()).rule)) };
      } catch {
        subParams = { regola: '' };
      }
    }
    const b = wideButton({
      icon: it.icon,
      labelKey: it.labelKey,
      ...(it.subKey ? { subKey: it.subKey } : {}),
      ...(subParams ? { subParams } : {}),
      kind: it.primary ? 'primario' : 'secondario',
      locked: it.locked,
      onClick: () => void this.activate(it.id),
      test: `sc-titolo-${it.id}`,
    });
    if (it.primary) b.classList.add('core-btn--grande', 'sc-voce--principale');
    if (it.star) {
      // Il finale vero (SCH-15): una stella d'ottone accanto a Telaio.
      // La frase si legge a video nella didascalia (Q036): la stella è solo un segno.
      const star = el('span', { class: 'sc-voce-stella', test: `sc-titolo-${it.id}-stella`, attrs: { title: s.i18n.t('ui.titolo.finaleVero'), 'aria-hidden': 'true' } }, icon('stella', 18));
      b.querySelector('.sc-voce-testi')?.after(star);
    }
    return b;
  }

  /** Esegue una voce del menu (anche dal debug). */
  async activate(id: TitleItemId): Promise<void> {
    const s = this.s;
    const it = this.items.find((x) => x.id === id);
    if (!it) return;
    if (it.locked) {
      s.ui.toast(it.subKey ?? 'ui.titolo.bloccato', undefined, 'info');
      return;
    }
    switch (id) {
      case 'continua':
        if (s.scenes.has('sera')) void s.scenes.go('sera', { cmd: 'continua' });
        else if (!(await resumeNight(s))) s.ui.toast('ui.titolo.storiaAssente', undefined, 'warn');
        return;
      case 'nuova': {
        if (s.save.data().campaign) {
          const ok = await s.ui.confirm({
            titleKey: 'ui.titolo.nuovaDomanda.titolo',
            bodyKey: 'ui.titolo.nuovaDomanda.corpo',
            okKey: 'ui.titolo.nuovaDomanda.ok',
            cancelKey: 'ui.titolo.nuovaDomanda.annulla',
            danger: true,
          });
          if (!ok) return;
        }
        if (s.scenes.has('sera')) void s.scenes.go('sera', { cmd: 'nuova', confirmed: true });
        else this.prologueFallback();
        return;
      }
      case 'giornaliero':
        void s.scenes.go('giornaliero');
        return;
      case 'libero':
        void s.scenes.go('libero');
        return;
      case 'telaio':
        if (s.scenes.has('telaio')) void s.scenes.go('telaio');
        return;
      case 'impostazioni':
        void s.scenes.go('impostazioni');
        return;
      case 'crediti':
        void s.scenes.go('crediti');
        return;
    }
  }

  /** Senza il pacchetto della campagna: il prologo si apre direttamente nel tombolo. */
  private prologueFallback(): void {
    const s = this.s;
    const level = s.content.levels.get('g00');
    if (!level) {
      s.ui.toast('ui.titolo.storiaAssente', undefined, 'warn');
      return;
    }
    void s.scenes.go('tombolo', { origin: 'campagna', mode: 'normale', level, flags: {}, accepted: [], goals: [...(level.goals ?? [])], needsNome: false });
  }

  private applyForm(vp: Viewport): void {
    this.landscape = isLandscapeLayout(vp);
    if (this.root) this.root.dataset.forma = this.landscape ? 'orizzontale' : 'verticale';
  }

  update(dt: number): void {
    this.art.update(dt);
  }

  render(_alpha: number, host: CanvasHost): void {
    if (this.measure && this.stage) {
      this.measure = false;
      const r = this.stage.getBoundingClientRect();
      const c = host.canvas.getBoundingClientRect();
      // Il fuso non deve coprire il titolo: unione dei rettangoli del nome, dello smerlo e del sottotitolo.
      let avoid: { x: number; y: number; w: number; h: number } | null = null;
      for (const e of this.root?.querySelectorAll<HTMLElement>('.sc-titolo-nome, .sc-smerlo--titolo, .sc-titolo-sotto') ?? []) {
        const b = e.getBoundingClientRect();
        if (b.width === 0) continue;
        const x0 = Math.min(avoid ? avoid.x : b.left - c.left, b.left - c.left);
        const y0 = Math.min(avoid ? avoid.y : b.top - c.top, b.top - c.top);
        const x1 = Math.max(avoid ? avoid.x + avoid.w : b.right - c.left, b.right - c.left);
        const y1 = Math.max(avoid ? avoid.y + avoid.h : b.bottom - c.top, b.bottom - c.top);
        avoid = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      }
      this.art.setStage({ x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height }, this.landscape, avoid);
    }
    this.art.render(host);
  }

  resize(vp: Viewport): void {
    this.applyForm(vp);
    this.art.invalidate();
    this.measure = true;
  }

  onAction(a: ActionEvent): boolean {
    if (!this.root) return false;
    // Frecce, Invio o un numero senza fuoco: il fuoco va sul menu (poi lavora il browser).
    if (a.action === 'up' || a.action === 'down' || a.action === 'left' || a.action === 'right' || a.action === 'confirm') {
      const first = this.root.querySelector<HTMLElement>('.sc-titolo-principali button');
      if (first && document.activeElement !== first) {
        first.focus();
        return true;
      }
    }
    return false;
  }

  onBack(): boolean {
    // Nel titolo Indietro non ha dove tornare: su nativo il core chiede se uscire.
    return false;
  }

  /** Geometria del quadro (debug). */
  artGeometry(): ReturnType<TitleArt['geometry']> {
    return this.art.geometry();
  }
}
