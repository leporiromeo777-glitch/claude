/**
 * Gestore delle scene (ARCHITETTURA 5.1).
 *
 * - register(id, factory), go(id, params, { transition: 'fade' | 'none' }),
 *   current(), has(id). I cambi di scena sono in fila: mai due insieme.
 * - Dissolvenza di 200 ms (100 in uscita, 100 in entrata; nessuna con la
 *   velocità delle animazioni "istantanea" o con il movimento ridotto).
 * - Inoltra alla scena attiva update, render, resize, azioni, gesti e Indietro.
 *   Le azioni e i gesti arrivano solo se nessun overlay modale è aperto
 *   (input.pushLayer): il gestore della scena vive nel livello di base.
 * - Catena di Indietro: overlay in cima → scena (onBack, poi onAction 'back')
 *   → nel titolo (o se nessuno lo gestisce), su nativo, conferma di uscita.
 */
import type { ActionEvent, CanvasHost, EventBus, GameEventMap, Gesture, Scene, SceneId, SceneManager, Viewport } from './types';
import type { CoreInput } from './input';

export const FADE_MS = 200;

export interface SceneDeps {
  bus: EventBus<GameEventMap>;
  input: CoreInput;
  canvas: CanvasHost & { fill?(color: string): void };
  viewport: () => Viewport;
  /** Elemento della dissolvenza (assente nei test). */
  fadeEl?: HTMLElement | null;
  /** Durata della dissolvenza (0 = nessuna), letta a ogni cambio di scena. */
  fadeMs?: () => number;
  /** Colore di fondo per le scene che non disegnano sul canvas. */
  background?: () => string;
  /** Ultima risorsa per Indietro (per esempio: conferma di uscita su nativo). */
  onUnhandledBack?: (current: SceneId | null) => void;
  wait?: (ms: number) => Promise<void>;
}

export interface CoreSceneManager extends SceneManager {
  update(dt: number): void;
  render(alpha: number): void;
  resize(vp: Viewport): void;
  /** Esegue la catena di Indietro a partire dalla scena (gli overlay sono gestiti dall'input). */
  back(): boolean;
  registered(): SceneId[];
  transitioning(): boolean;
  scene(): Scene | null;
}

export function createSceneManager(deps: SceneDeps): CoreSceneManager {
  const factories = new Map<SceneId, () => Scene>();
  let active: Scene | null = null;
  let busy = false;
  let queue: Promise<void> = Promise.resolve();
  let needsClear = true;
  const wait = deps.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  function setFade(opacity: number, ms: number): void {
    const f = deps.fadeEl;
    if (!f) return;
    f.style.transitionDuration = `${ms}ms`;
    f.style.opacity = String(opacity);
    f.classList.toggle('core-fade--attiva', opacity > 0);
  }

  function backChain(a: ActionEvent): boolean {
    const s = active;
    if (!s || busy) return busy;
    try {
      if (s.onBack?.()) return true;
      if (s.onAction?.(a)) return true;
    } catch (err) {
      console.error(`[scenes] back in "${s.id}" failed`, err);
    }
    deps.onUnhandledBack?.(s.id);
    return true;
  }

  deps.input.onAction((a: ActionEvent) => {
    if (a.action === 'back') return backChain(a);
    if (!active || busy) return false;
    try {
      return active.onAction?.(a) ?? false;
    } catch (err) {
      console.error(`[scenes] action in "${active.id}" failed`, err);
      return false;
    }
  });
  deps.input.onGesture((g: Gesture) => {
    if (!active || busy) return false;
    try {
      return active.onGesture?.(g) ?? false;
    } catch (err) {
      console.error(`[scenes] gesture in "${active.id}" failed`, err);
      return false;
    }
  });

  async function doGo(id: SceneId, params: unknown, transition: 'fade' | 'none'): Promise<void> {
    const factory = factories.get(id);
    if (!factory) throw new Error(`scenes: scene "${id}" is not registered`);
    const ms = transition === 'fade' ? Math.max(0, deps.fadeMs?.() ?? FADE_MS) : 0;
    busy = true;
    try {
      if (ms > 0 && active) {
        setFade(1, ms / 2);
        await wait(ms / 2);
      }
      const old = active;
      if (old) {
        active = null;
        try {
          old.exit();
        } catch (err) {
          console.error(`[scenes] exit of "${old.id}" failed`, err);
        }
        deps.bus.emit('scene:exit', { id: old.id });
      }
      const next = factory();
      active = next;
      needsClear = true;
      await next.enter(params);
      next.resize?.(deps.viewport());
      deps.bus.emit('scene:enter', params === undefined ? { id } : { id, params });
      if (ms > 0) {
        setFade(0, ms / 2);
        await wait(ms / 2);
      } else {
        setFade(0, 0);
      }
    } finally {
      busy = false;
    }
  }

  const mgr: CoreSceneManager = {
    register(id, factory) {
      if (factories.has(id)) console.warn(`[scenes] scene "${id}" registered again: replaced`);
      factories.set(id, factory);
    },
    go(id, params, opts) {
      const run = (): Promise<void> => doGo(id, params, opts?.transition ?? 'fade');
      const p = queue.then(run, run);
      queue = p.catch(() => undefined);
      return p;
    },
    current: () => active?.id ?? null,
    has: (id) => factories.has(id),
    update(dt) {
      if (!active) return;
      try {
        active.update?.(dt);
      } catch (err) {
        console.error(`[scenes] update of "${active.id}" failed`, err);
      }
    },
    render(alpha) {
      const s = active;
      if (s?.render) {
        try {
          s.render(alpha, deps.canvas);
        } catch (err) {
          console.error(`[scenes] render of "${s.id}" failed`, err);
        }
        needsClear = true;
        return;
      }
      // Scene solo DOM: il canvas resta di velluto (ridipinto solo quando serve).
      if (needsClear) {
        deps.canvas.fill?.(deps.background?.() ?? '#1C2233');
        needsClear = false;
      }
    },
    resize(vp) {
      needsClear = true;
      try {
        active?.resize?.(vp);
      } catch (err) {
        console.error(`[scenes] resize of "${active?.id}" failed`, err);
      }
    },
    back: () => backChain({ action: 'back', repeat: false, source: 'ui' }),
    registered: () => [...factories.keys()],
    transitioning: () => busy,
    scene: () => active,
  };
  return mgr;
}
