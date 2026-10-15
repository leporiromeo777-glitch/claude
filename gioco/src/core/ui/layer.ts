/**
 * Livello dell'interfaccia (ARCHITETTURA 4 "UiLayer", 5.1; GDD 10.3 "Sovrapposizioni di sistema").
 *
 * Struttura di #ui-root (dal basso all'alto):
 *   .core-scene      contenitore libero per il DOM delle scene
 *   .core-overlays   pannelli sopra tutto (openOverlay), chiudibili con Indietro
 *   .core-modals     conferme (pulsante sicuro a sinistra)
 *   .core-captions   didascalie dei suoni, in basso a sinistra
 *   .core-toasts     avvisi brevi, in basso
 *   .core-fade       dissolvenza fra le scene
 *
 * #ui-root lascia passare i tocchi al canvas (pointer-events: none): ricevono i
 * tocchi solo gli elementi interattivi e quelli con la classe `core-solid`.
 * Ogni overlay e ogni conferma apre un livello modale dell'input: le scene non
 * ricevono azioni né gesti finché non si chiude.
 */
import type { EventBus, GameEventMap, I18n, PanelHandle, SettingsStore, UiLayer, Unsub } from '../types';
import type { CoreInput } from '../input';
import { el, clear } from './dom';
import { button, firstFocusable, iconButton, modal, panel, retranslate, textOf } from './components';

export const TOAST_MS = 2800;
export const CAPTION_MS = 2600;
const MAX_TOASTS = 3;
const MAX_CAPTIONS = 3;

type PanelFactory = (container: HTMLElement, opts?: unknown) => PanelHandle;

interface OverlayEntry {
  id: string;
  host: HTMLElement;
  handle: PanelHandle;
  popLayer: Unsub;
  resolve: () => void;
  previousFocus: Element | null;
}

export interface UiLayerDeps {
  root: HTMLElement;
  input: CoreInput;
  bus: EventBus<GameEventMap>;
  i18n: I18n;
  settings: SettingsStore;
  timers?: { set(fn: () => void, ms: number): unknown; clear(h: unknown): void };
}

export interface CoreUiLayer extends UiLayer {
  /** Contenitore per il DOM delle scene. */
  sceneRoot: HTMLElement;
  /** Elemento della dissolvenza fra scene. */
  fadeEl: HTMLElement;
  /** Id degli overlay aperti, dal basso all'alto. */
  overlays(): string[];
  hasPanel(id: string): boolean;
  /** Riscrive tutti i testi tradotti (cambio di lingua). */
  retranslate(): void;
  destroy(): void;
}

/** Elementi che si toccano: le didascalie non ci vanno sopra. */
const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="switch"], [role="slider"]';
/** Note da leggere (la nota a margine del tutorial sul tombolo): le didascalie le evitano se possono. */
const NOTES = '[role="note"]';
/** Quanto conta coprire una nota rispetto a un pulsante: meno, così non si copre mai un pulsante per lasciarla libera. */
const NOTE_WEIGHT = 0.25;

export function createUiLayer(deps: UiLayerDeps): CoreUiLayer {
  const { root, input, bus, i18n, settings } = deps;
  const timers = deps.timers ?? {
    set: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clear: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>),
  };
  const panels = new Map<string, PanelFactory>();
  const stack: OverlayEntry[] = [];
  const cleanups: Unsub[] = [];

  clear(root);
  const sceneRoot = el('div', { class: 'core-scene' });
  const overlaysEl = el('div', { class: 'core-overlays' });
  const modalsEl = el('div', { class: 'core-modals' });
  const captionsEl = el('div', { class: 'core-captions', attrs: { 'aria-live': 'polite' } });
  const toastsEl = el('div', { class: 'core-toasts', role: 'status', attrs: { 'aria-live': 'polite' } });
  const fadeEl = el('div', { class: 'core-fade', attrs: { 'aria-hidden': 'true' } });
  root.append(sceneRoot, overlaysEl, modalsEl, captionsEl, toastsEl, fadeEl);

  function placeholderPanel(container: HTMLElement, id: string): PanelHandle {
    const p = panel({ titleKey: 'core.ui.pannello', params: { id }, children: [textOf('core.ui.pannelloAssente', undefined, 'p')] });
    p.dataset.placeholderPanel = id;
    container.appendChild(p);
    return { destroy: () => p.remove() };
  }

  function build(id: string, container: HTMLElement, opts?: unknown): PanelHandle {
    const f = panels.get(id);
    if (!f) return placeholderPanel(container, id);
    try {
      return f(container, opts);
    } catch (err) {
      console.error(`[ui] panel "${id}" failed`, err);
      return placeholderPanel(container, id);
    }
  }

  function closeEntry(entry: OverlayEntry): void {
    const i = stack.indexOf(entry);
    if (i < 0) return;
    stack.splice(i, 1);
    try {
      entry.handle.destroy();
    } catch (err) {
      console.error(`[ui] panel "${entry.id}" destroy failed`, err);
    }
    entry.host.remove();
    entry.popLayer();
    if (entry.previousFocus instanceof HTMLElement && entry.previousFocus.isConnected) entry.previousFocus.focus();
    entry.resolve();
  }

  /**
   * Didascalie dei suoni (revisione 1, SCH-10, P055): mai sopra un pulsante e, se si
   * può, nemmeno sopra una nota da leggere (`role="note"`, la nota a margine del
   * tutorial). Si prova il posto di sempre (in basso a sinistra), poi appena sopra i
   * controlli in basso, poi in alto; vince il primo che non copre niente, o quello che
   * copre meno (una nota pesa un quarto di un pulsante).
   */
  function placeCaptions(): void {
    const lines = Array.from(captionsEl.children) as HTMLElement[];
    if (lines.length === 0) return;
    const rootBox = root.getBoundingClientRect();
    const controls: { r: DOMRect; w: number }[] = [];
    const collect = (sel: string, w: number): void => {
      for (const c of Array.from(root.querySelectorAll<HTMLElement>(sel))) {
        if (captionsEl.contains(c) || toastsEl.contains(c) || fadeEl.contains(c)) continue;
        const r = c.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) controls.push({ r, w });
      }
    };
    collect(INTERACTIVE, 1);
    collect(NOTES, NOTE_WEIGHT);
    if (controls.length === 0) return;
    const block = (): DOMRect | null => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const l of lines) {
        const r = l.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
      }
      return Number.isFinite(x0) ? new DOMRect(x0, y0, x1 - x0, y1 - y0) : null;
    };
    const covered = (): number => {
      const b = block();
      if (!b) return 0;
      let area = 0;
      for (const { r, w: weight } of controls) {
        const w = Math.min(b.right, r.right) - Math.max(b.left, r.left);
        const h = Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top);
        if (w > 0 && h > 0) area += w * h * weight;
      }
      return area;
    };
    const apply = (posto: 'basso' | 'alto', bottom: number | null): void => {
      captionsEl.dataset.posto = posto;
      if (bottom === null) captionsEl.style.removeProperty('--didascalie-basso');
      else captionsEl.style.setProperty('--didascalie-basso', `${Math.round(bottom)}px`);
    };
    apply('basso', null);
    let best = { posto: 'basso' as 'basso' | 'alto', bottom: null as number | null, area: covered() };
    if (best.area === 0) return;
    // Appena sopra i controlli che stanno sotto (e di fianco) alle didascalie.
    const b = block();
    if (b) {
      const below = controls.filter(({ r }) => r.right > b.left && r.left < b.right && r.top >= rootBox.top + rootBox.height * 0.35);
      if (below.length > 0) {
        const top = Math.min(...below.map(({ r }) => r.top));
        const bottom = rootBox.bottom - top + 8;
        if (bottom + b.height < rootBox.height) {
          apply('basso', bottom);
          const area = covered();
          if (area < best.area) best = { posto: 'basso', bottom, area };
          if (area === 0) return;
        }
      }
    }
    apply('alto', null);
    const area = covered();
    if (area < best.area) best = { posto: 'alto', bottom: null, area };
    apply(best.posto, best.bottom);
  }

  function showLine(container: HTMLElement, node: HTMLElement, ms: number, max: number): void {
    container.appendChild(node);
    while (container.children.length > max) container.firstElementChild?.remove();
    // Classe di entrata al fotogramma dopo, per la transizione CSS.
    requestAnimationFrame(() => node.classList.add('core-visibile'));
    timers.set(() => {
      node.classList.remove('core-visibile');
      timers.set(() => node.remove(), 300);
    }, ms);
  }

  const layer: CoreUiLayer = {
    root,
    sceneRoot,
    fadeEl,
    registerPanel(id, factory) {
      if (panels.has(id)) console.warn(`[ui] panel "${id}" registered again`);
      panels.set(id, factory);
    },
    hasPanel: (id) => panels.has(id),
    mountPanel(id, container, opts) {
      return build(id, container, opts);
    },
    openOverlay(id, opts) {
      const previousFocus = document.activeElement;
      const box = el('div', { class: 'core-overlay-box core-solid' });
      const host = el(
        'div',
        { class: 'core-overlay core-solid', role: 'dialog', attrs: { 'aria-modal': 'true' }, data: { overlay: id }, test: `overlay-${id}` },
        box,
      );
      const popLayer = input.pushLayer(`overlay:${id}`);
      let resolve: () => void = () => undefined;
      const done = new Promise<void>((r) => (resolve = r));
      const entry: OverlayEntry = { id, host, handle: { destroy() {} }, popLayer, resolve, previousFocus };
      // Indietro / Esc chiude l'overlay in cima (gestore del livello appena aperto).
      input.onAction((a) => {
        if (a.action !== 'back') return false;
        closeEntry(entry);
        return true;
      });
      const close = iconButton({
        icon: 'chiudi',
        labelKey: 'core.ui.chiudi',
        onClick: () => closeEntry(entry),
        className: 'core-overlay-close',
        test: `overlay-${id}-chiudi`,
      });
      host.appendChild(close);
      overlaysEl.appendChild(host);
      stack.push(entry);
      entry.handle = build(id, box, opts);
      (firstFocusable(box) ?? close).focus({ preventScroll: true });
      return done;
    },
    closeOverlay() {
      const top = stack[stack.length - 1];
      if (top) closeEntry(top);
    },
    overlays: () => stack.map((e) => e.id),
    toast(textKey, params, kind = 'info') {
      // Revisione 1 (SCH-09): l'avviso non prende i tocchi (niente core-solid), passano all'elemento sotto.
      const node = el('div', { class: ['core-toast'], data: { kind }, test: 'toast' }, textOf(textKey, params, 'span', { rich: true }));
      showLine(toastsEl, node, TOAST_MS, MAX_TOASTS);
    },
    confirm(o) {
      return new Promise<boolean>((resolve) => {
        const previousFocus = document.activeElement;
        const popLayer = input.pushLayer('confirm');
        let settled = false;
        const finish = (v: boolean): void => {
          if (settled) return;
          settled = true;
          host.remove();
          popLayer();
          if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
          resolve(v);
        };
        input.onAction((a) => {
          if (a.action === 'back') {
            finish(false);
            return true;
          }
          // Tab resta libero per spostare il fuoco fra i pulsanti; le altre azioni
          // non arrivano comunque alla scena sotto (il livello in cima è questo).
          return a.action !== 'notebook' && a.action !== 'tab';
        });
        // Pulsante sicuro a sinistra (GDD 10.3), con il fuoco.
        const cancel = button({ labelKey: o.cancelKey, kind: 'secondario', onClick: () => finish(false), test: 'confirm-annulla' });
        const ok = button({ labelKey: o.okKey, kind: o.danger ? 'pericolo' : 'primario', onClick: () => finish(true), test: 'confirm-ok' });
        const box = modal(
          o.bodyKey
            ? { titleKey: o.titleKey, bodyKey: o.bodyKey, actions: [cancel, ok], test: 'confirm' }
            : { titleKey: o.titleKey, actions: [cancel, ok], test: 'confirm' },
        );
        const host = el('div', { class: 'core-modal-host core-solid' }, box);
        modalsEl.appendChild(host);
        cancel.focus({ preventScroll: true });
      });
    },
    retranslate() {
      retranslate(root);
    },
    destroy() {
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top) closeEntry(top);
      }
      for (const c of cleanups.splice(0)) c();
      clear(root);
    },
  };

  // Didascalie dei suoni (in basso a sinistra), se attive nelle impostazioni.
  cleanups.push(
    bus.on('audio:caption', (p) => {
      if (!settings.get().captions) return;
      const node = el('div', { class: 'core-caption', test: 'caption' }, textOf(p.textKey, p.params));
      showLine(captionsEl, node, CAPTION_MS, MAX_CAPTIONS);
      placeCaptions();
    }),
  );
  cleanups.push(
    bus.on('toast', (p) => {
      layer.toast(p.textKey, p.params, p.kind);
    }),
  );
  let lastLocale = i18n.locale();
  cleanups.push(
    bus.on('settings:change', (s) => {
      if (s.locale !== lastLocale) {
        lastLocale = s.locale;
        retranslate(root);
      }
      if (!s.captions) clear(captionsEl);
    }),
  );
  return layer;
}
