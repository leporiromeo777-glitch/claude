/**
 * Scena 'tombolo' (ARCHITETTURA 5.3): riceve NightParams ed emette night:cross,
 * night:violation, night:row, night:undo, night:complete e night:exit.
 *
 * - enter(params): NightParams; senza parametri (o con `{ resume: true }`) riprende
 *   la notte salvata in SaveData.night. Il livello d'una ripresa si ritrova con
 *   `resolveLevel` (contenuti, fixture, Merletto del giorno, risolutori).
 * - exit(): salva la notte (se non è finita) ed emette night:exit.
 * - Indietro (Esc, tasto Android): chiude l'anteprima o la scheda aperta,
 *   altrimenti apre il menu Pausa.
 */
import type { ActionEvent, CanvasHost, Gesture, NightParams, Scene, Services, Viewport } from '../core/types';
import { NightController } from './controller';
import { setActiveNight } from './active';
import { rememberLevel, resolveComputed, resumeParams } from './resume';

export function isNightParams(v: unknown): v is NightParams {
  if (!v || typeof v !== 'object') return false;
  const p = v as Partial<NightParams>;
  const lv = p.level as Partial<NightParams['level']> | undefined;
  return (
    typeof p.mode === 'string' &&
    typeof p.origin === 'string' &&
    !!lv &&
    typeof lv.id === 'string' &&
    Array.isArray(lv.columns) &&
    Array.isArray(lv.initial) &&
    Array.isArray(lv.threads) &&
    typeof lv.startHour === 'number' &&
    typeof lv.endHour === 'number'
  );
}

function normalize(p: NightParams): NightParams {
  return {
    ...p,
    flags: p.flags ?? {},
    accepted: Array.isArray(p.accepted) ? p.accepted : [],
    goals: Array.isArray(p.goals) ? p.goals : [...(p.level.goals ?? [])],
    needsNome: !!p.needsNome,
  };
}

export class TomboloScene implements Scene {
  readonly id = 'tombolo' as const;
  private ctl: NightController | null = null;

  constructor(private readonly s: Services) {}

  async enter(params?: unknown): Promise<void> {
    let p: NightParams | null = isNightParams(params) ? normalize(params) : null;
    if (!p) p = await resumeParams(this.s);
    if (!p) {
      this.s.ui.toast('tombolo.errore.nessunaNotte', undefined, 'warn');
      const back = this.s.scenes.has('titolo') ? 'titolo' : 'boot';
      void this.s.scenes.go(back, undefined, { transition: 'none' });
      return;
    }
    rememberLevel(p.level);
    const computed = await resolveComputed(this.s, p.level.id);
    try {
      const ctl = new NightController(this.s, p, { computed });
      ctl.computedRef = computed;
      this.ctl = ctl;
      setActiveNight(ctl);
    } catch (err) {
      console.error('[tombolo] night failed to start', err);
      this.s.ui.toast('tombolo.errore.livello', undefined, 'warn');
      const back = this.s.scenes.has('titolo') ? 'titolo' : 'boot';
      void this.s.scenes.go(back, undefined, { transition: 'none' });
    }
  }

  exit(): void {
    const c = this.ctl;
    this.ctl = null;
    setActiveNight(null);
    c?.destroy();
  }

  update(dt: number): void {
    this.ctl?.update(dt);
  }

  render(_alpha: number, host: CanvasHost): void {
    this.ctl?.render(host);
  }

  resize(vp: Viewport): void {
    this.ctl?.resize(vp);
  }

  onAction(a: ActionEvent): boolean {
    return this.ctl ? this.ctl.interact.onAction(a) : false;
  }

  onGesture(g: Gesture): boolean {
    return this.ctl ? this.ctl.interact.onGesture(g) : false;
  }

  onBack(): boolean {
    return this.ctl ? this.ctl.back() : false;
  }
}
