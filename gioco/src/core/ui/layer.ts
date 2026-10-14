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
