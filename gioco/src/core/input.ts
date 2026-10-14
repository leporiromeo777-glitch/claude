/**
 * Input unificato (ARCHITETTURA 7).
 *
 * - Solo Pointer Events sul canvas, con setPointerCapture sul pointerdown;
 *   i gesti (gestures.ts) arrivano in px CSS relativi al canvas.
 * - Tastiera (keymap.ts) → ActionEvent; Tab ed Esc non escono mai dal gioco.
 * - Livelli modali: `pushLayer(nome)` fa sì che solo il livello in cima riceva
 *   azioni e gesti. Un gestore registrato con onAction/onGesture appartiene al
 *   livello che era in cima al momento della registrazione: le scene (gestite
 *   dal SceneManager, livello di base) ricevono solo se non c'è un overlay sopra.
 *   Quando un livello si chiude, i suoi gestori sono scartati.
 * - Sblocco audio: al pointerdown, al pointerup (che per il tocco è l'evento che
 *   dà l'attivazione utente) e al keydown si chiama `audio.unlock()` in modo
 *   sincrono, dentro il gestore, finché l'audio non è 'running'.
 */
import type { ActionEvent, ActionId, AudioEngine, Gesture, InputRouter, Unsub } from './types';
import { GestureRecognizer, LONGPRESS_MS, type PointerKind, type PointerSample } from './gestures';
import { ALWAYS_PREVENT, mapKey, type FocusContext } from './keymap';

export interface InputDeps {
  /** Elemento che riceve i gesti (il canvas). Assente nei test: funziona solo simulate. */
  canvas?: HTMLElement | null;
  /** Finestra per tastiera, menu contestuale e sblocco audio. */
  win?: Window | null;
  /** Radice dell'interfaccia: Tab, se nessuno lo usa, sposta il fuoco qui dentro. */
  uiRoot?: HTMLElement | null;
  /** Accesso pigro all'audio: registerAudio() può sostituire lo stub in qualsiasi momento. */
  audio?: () => AudioEngine;
  onAudioUnlocked?: () => void;
  now?: () => number;
  /** Attesa fra i passi di simulate.drag (ms). */
  simulateStepMs?: number;
}

export interface InputEventRecord {
  kind: 'gesture' | 'action';
  layer: string;
  handled: boolean;
  gesture?: Gesture;
  action?: ActionEvent;
}

export interface CoreInput extends InputRouter {
  /** Consegna un'azione al livello in cima. true se qualcuno l'ha gestita. */
  dispatchAction(a: ActionEvent): boolean;
  dispatchGesture(g: Gesture): boolean;
  /** Nomi dei livelli dal basso all'alto ('base' è sempre il primo). */
  layers(): string[];
  /** Osserva tutti i gesti e le azioni (debug, scena diagnostica). Non consuma nulla. */
  observe(fn: (e: InputEventRecord) => void): Unsub;
  destroy(): void;
}

interface Handler<T> {
  fn: (x: T) => boolean;
  layer: number;
}

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date', 'time']);
const INTERACTIVE_ROLES = new Set(['button', 'slider', 'switch', 'tab', 'menuitem', 'option', 'checkbox', 'radio', 'link', 'spinbutton']);
const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Che cosa ha il fuoco: un campo di testo, un controllo interattivo o niente. */
export function focusContextOf(target: EventTarget | null): FocusContext {
  if (!target || typeof (target as Partial<Element>).tagName !== 'string') return 'none';
  const elt = target as HTMLElement;
  const tag = elt.tagName.toLowerCase();
  if (elt.isContentEditable || tag === 'textarea') return 'text';
  if (tag === 'input') {
    const type = ((elt as HTMLInputElement).type || 'text').toLowerCase();
    return TEXT_INPUT_TYPES.has(type) ? 'text' : 'interactive';
  }
  if (tag === 'button' || tag === 'select' || tag === 'summary' || (tag === 'a' && elt.hasAttribute('href'))) return 'interactive';
  const role = elt.getAttribute('role');
  if (role && INTERACTIVE_ROLES.has(role)) return 'interactive';
  return 'none';
}

function pointerKind(t: string): PointerKind {
  return t === 'touch' ? 'touch' : t === 'pen' ? 'pen' : 'mouse';
}

export function createInput(deps: InputDeps = {}): CoreInput {
  const now = deps.now ?? (() => performance.now());
  const stepMs = deps.simulateStepMs ?? 16;
  const win = deps.win ?? null;
  const canvas = deps.canvas ?? null;

  let nextLayerId = 1;
  const stack: { id: number; name: string }[] = [{ id: 0, name: 'base' }];
  const actionHandlers: Handler<ActionEvent>[] = [];
  const gestureHandlers: Handler<Gesture>[] = [];
  const observers: ((e: InputEventRecord) => void)[] = [];
  let device: 'mouse' | 'touch' | 'keyboard' = 'mouse';
  try {
    // Prima di qualsiasi evento: un puntatore grossolano vuol dire tocco.
    if (win?.matchMedia?.('(pointer: coarse)').matches) device = 'touch';
  } catch {
    /* matchMedia non disponibile */
  }
  /** Motore audio per cui si è già notificato lo sblocco: lo stub e poi quello vero contano a parte. */
  let unlockedFor: AudioEngine | null = null;
  const cleanups: (() => void)[] = [];

  const top = (): { id: number; name: string } => stack[stack.length - 1] ?? { id: 0, name: 'base' };

  function addHandler<T>(list: Handler<T>[], fn: (x: T) => boolean): Unsub {
    const h: Handler<T> = { fn, layer: top().id };
    list.push(h);
    return () => {
      const i = list.indexOf(h);
      if (i >= 0) list.splice(i, 1);
    };
  }

  function deliver<T>(list: Handler<T>[], x: T): boolean {
    const layer = top().id;
    // Dal più recente al più vecchio: chi si registra dopo ha la precedenza.
    const snapshot = list.filter((h) => h.layer === layer).reverse();
    for (const h of snapshot) {
      try {
        if (h.fn(x)) return true;
      } catch (err) {
        console.error('[input] handler error', err);
      }
    }
    return false;
  }

  function notify(rec: InputEventRecord): void {
    for (const o of observers.slice()) {
      try {
        o(rec);
      } catch (err) {
        console.error('[input] observer error', err);
      }
    }
  }

  function dispatchAction(a: ActionEvent): boolean {
    const handled = deliver(actionHandlers, a);
    notify({ kind: 'action', layer: top().name, handled, action: a });
    return handled;
  }

  function dispatchGesture(g: Gesture): boolean {
    const handled = deliver(gestureHandlers, g);
    notify({ kind: 'gesture', layer: top().name, handled, gesture: g });
    return handled;
  }

  const recognizer = new GestureRecognizer((g) => {
    dispatchGesture(g);
  });
  const simRecognizer = new GestureRecognizer((g) => {
    dispatchGesture(g);
  });

  /**
   * Sblocco audio sincrono dentro il gestore dell'evento utente. 'audio:unlocked' parte
   * una volta per ogni motore: se il primo tocco arriva mentre c'è ancora lo stub e il
   * motore vero si registra dopo, il motore vero ha comunque il suo sblocco e il suo evento.
   */
  function tryUnlockAudio(): void {
    if (!deps.audio) return;
    let audio: AudioEngine;
    try {
      audio = deps.audio();
      // Finché non è 'running' (anche dopo una sospensione) si riprova a ogni gesto.
      if (audio.state() !== 'running') audio.unlock();
    } catch (err) {
      console.error('[input] audio unlock failed', err);
      return;
    }
    if (unlockedFor !== audio && audio.state() === 'running') {
      unlockedFor = audio;
      deps.onAudioUnlocked?.();
    }
  }

  function cycleFocus(backwards: boolean): void {
    const root = deps.uiRoot;
    if (!root) return;
    const all = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (e) => e.getClientRects().length > 0 && !e.closest('[inert],[aria-hidden="true"]'),
    );
    // Se c'è un overlay o una conferma aperta, il fuoco resta lì dentro.
    const modal = Array.from(root.querySelectorAll<HTMLElement>('.core-modal-host, .core-overlay')).pop();
    const list = modal ? all.filter((e) => modal.contains(e)) : all;
    if (list.length === 0) return;
    const active = (win?.document.activeElement ?? null) as HTMLElement | null;
    const i = active ? list.indexOf(active) : -1;
    const next = backwards ? (i <= 0 ? list.length - 1 : i - 1) : i < 0 || i >= list.length - 1 ? 0 : i + 1;
    list[next]?.focus();
  }

  // ───────── Collegamento al DOM ─────────
  if (win) {
    const onKeyDown = (e: KeyboardEvent): void => {
      tryUnlockAudio();
      device = 'keyboard';
      if (e.isComposing) return;
      const focus = focusContextOf(e.target ?? win.document.activeElement);
      const mapped = mapKey(e, focus);
      let handled = false;
      if (mapped) {
        const ev: ActionEvent = { action: mapped.action, repeat: mapped.repeat, source: 'keyboard' };
        if (mapped.index !== undefined) ev.index = mapped.index;
        handled = dispatchAction(ev);
      }
      if (handled) {
        e.preventDefault();
        return;
      }
      if (focus === 'text') return;
      if (e.key === 'Tab') {
        e.preventDefault();
        cycleFocus(e.shiftKey);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        return;
      }
      if (focus === 'none' && ALWAYS_PREVENT.has(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault();
    };
    const onPointerDownAny = (e: PointerEvent): void => {
      device = e.pointerType === 'mouse' ? 'mouse' : 'touch';
      tryUnlockAudio();
    };
    const onPointerUpAny = (): void => {
      tryUnlockAudio();
    };
    const onContextMenu = (e: Event): void => {
      if (focusContextOf(e.target) !== 'text') e.preventDefault();
    };
    // Safari su iOS ignora user-scalable=no: il pizzico si ferma sull'evento proprietario gesturestart.
    const onGestureStart = (e: Event): void => {
      e.preventDefault();
    };
    win.addEventListener('keydown', onKeyDown);
    win.addEventListener('pointerdown', onPointerDownAny, { capture: true });
    win.addEventListener('pointerup', onPointerUpAny, { capture: true });
    win.addEventListener('contextmenu', onContextMenu);
    win.addEventListener('gesturestart', onGestureStart, { passive: false });
    cleanups.push(() => {
      win.removeEventListener('keydown', onKeyDown);
      win.removeEventListener('pointerdown', onPointerDownAny, { capture: true });
      win.removeEventListener('pointerup', onPointerUpAny, { capture: true });
      win.removeEventListener('contextmenu', onContextMenu);
      win.removeEventListener('gesturestart', onGestureStart);
    });
  }

  if (canvas) {
    let rect = canvas.getBoundingClientRect();
    let longTimer: ReturnType<typeof setTimeout> | null = null;
    const clearLong = (): void => {
      if (longTimer !== null) clearTimeout(longTimer);
      longTimer = null;
    };
    const sample = (e: PointerEvent): PointerSample => ({
      id: e.pointerId,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      t: now(),
      pointer: pointerKind(e.pointerType),
      button: e.button,
    });
    const onDown = (e: PointerEvent): void => {
      rect = canvas.getBoundingClientRect();
      if (!recognizer.down(sample(e))) return;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* il puntatore può essere già sparito */
      }
      clearLong();
      longTimer = setTimeout(() => {
        longTimer = null;
        recognizer.tick(now());
      }, LONGPRESS_MS + 10);
    };
    const onMove = (e: PointerEvent): void => {
      if (recognizer.activeId() !== e.pointerId) return;
      recognizer.move(sample(e));
    };
    const onUp = (e: PointerEvent): void => {
      if (recognizer.activeId() !== e.pointerId) return;
      clearLong();
      recognizer.up(sample(e));
      try {
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* niente da rilasciare */
      }
    };
    const onCancel = (e: PointerEvent): void => {
      if (recognizer.activeId() !== e.pointerId) return;
      clearLong();
      recognizer.cancel({ id: e.pointerId });
    };
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      rect = canvas.getBoundingClientRect();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? rect.height || 600 : 1;
      recognizer.wheel(e.clientX - rect.left, e.clientY - rect.top, e.deltaY * unit);
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('lostpointercapture', onCancel);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    cleanups.push(() => {
      clearLong();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('lostpointercapture', onCancel);
      canvas.removeEventListener('wheel', onWheel);
    });
  }

  const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
  const SIM_ID = -7;

  const router: CoreInput = {
    onGesture: (fn) => addHandler(gestureHandlers, fn),
    onAction: (fn) => addHandler(actionHandlers, fn),
    pushLayer(name) {
      const layer = { id: nextLayerId++, name };
      stack.push(layer);
      let open = true;
      return () => {
        if (!open) return;
        open = false;
        const i = stack.indexOf(layer);
        if (i > 0) stack.splice(i, 1);
        for (const list of [actionHandlers, gestureHandlers] as Handler<unknown>[][]) {
          for (let j = list.length - 1; j >= 0; j--) if (list[j]?.layer === layer.id) list.splice(j, 1);
        }
      };
    },
    lastDevice: () => device,
    simulate: {
      tap(x, y, pointer = 'mouse') {
        const t = now();
        simRecognizer.cancel();
        simRecognizer.down({ id: SIM_ID, x, y, t, pointer, button: 0 });
        simRecognizer.up({ id: SIM_ID, x, y, t: t + 40, pointer, button: 0 });
      },
      async drag(x0, y0, x1, y1, steps = 12, pointer = 'mouse') {
        const n = Math.max(1, Math.floor(steps));
        let t = now();
        simRecognizer.cancel();
        simRecognizer.down({ id: SIM_ID, x: x0, y: y0, t, pointer, button: 0 });
        for (let i = 1; i <= n; i++) {
          await sleep(stepMs);
          t += stepMs;
          const k = i / n;
          simRecognizer.move({ id: SIM_ID, x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, t, pointer, button: 0 });
        }
        await sleep(stepMs);
        simRecognizer.up({ id: SIM_ID, x: x1, y: y1, t: t + stepMs, pointer, button: 0 });
      },
      action(a: ActionId, index?: number) {
        const ev: ActionEvent = { action: a, repeat: false, source: 'debug' };
        if (index !== undefined) ev.index = index;
        dispatchAction(ev);
      },
    },
    dispatchAction,
    dispatchGesture,
    layers: () => stack.map((l) => l.name),
    observe(fn) {
      observers.push(fn);
      return () => {
        const i = observers.indexOf(fn);
        if (i >= 0) observers.splice(i, 1);
      };
    },
    destroy() {
      for (const c of cleanups.splice(0)) c();
    },
  };
  return router;
}
