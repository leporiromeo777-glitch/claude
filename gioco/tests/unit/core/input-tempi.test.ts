/**
 * Revisione 2, Q071: i gesti si cronometrano sull'istante dell'evento (e.timeStamp),
 * non su quello in cui il thread principale riesce a elaborarlo. Un blocco del thread
 * non trasforma più un trascinamento in pressione lunga (scheda del personaggio).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Gesture } from '../../../src/core/types';
import { createInput, eventTime } from '../../../src/core/input';
import { SeenClock } from '../../../src/core/gestures';

type Listener = (e: unknown) => void;

/** Canvas finto: tiene gli ascoltatori e li chiama con eventi costruiti a mano. */
function fakeCanvas(): HTMLElement & { fire(type: string, e: object): void } {
  const ls = new Map<string, Listener[]>();
  const el = {
    addEventListener(type: string, fn: Listener) {
      ls.set(type, [...(ls.get(type) ?? []), fn]);
    },
    removeEventListener(type: string, fn: Listener) {
      ls.set(
        type,
        (ls.get(type) ?? []).filter((f) => f !== fn),
      );
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0 }),
    setPointerCapture() {},
    hasPointerCapture: () => false,
    releasePointerCapture() {},
    fire(type: string, e: object) {
      for (const fn of ls.get(type) ?? []) fn(e);
    },
  };
  return el as unknown as HTMLElement & { fire(type: string, e: object): void };
}

interface PEv {
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
  button: number;
  timeStamp: number;
  getCoalescedEvents?: () => PEv[];
}
const ev = (x: number, y: number, timeStamp: number, extra: Partial<PEv> = {}): PEv => ({
  pointerId: 1,
  pointerType: 'mouse',
  clientX: x,
  clientY: y,
  button: 0,
  timeStamp,
  ...extra,
});

describe('Q071: tempi dei gesti sull’istante dell’evento', () => {
  let clock = 0;
  beforeEach(() => {
    vi.useFakeTimers();
    clock = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Fotogrammi in attesa (requestAnimationFrame della finestra finta). */
  let frames: (() => void)[] = [];
  /** Il browser disegna un fotogramma: prima di questo passano gli eventi in coda. */
  const frame = (): void => {
    const list = frames;
    frames = [];
    for (const f of list) f();
  };

  function setup(): { canvas: ReturnType<typeof fakeCanvas>; got: Gesture[] } {
    frames = [];
    const canvas = fakeCanvas();
    const win = {
      addEventListener() {},
      removeEventListener() {},
      requestAnimationFrame(cb: () => void) {
        frames.push(cb);
        return frames.length;
      },
      cancelAnimationFrame() {
        frames = [];
      },
    } as unknown as Window;
    const input = createInput({ canvas, win, now: () => clock });
    const got: Gesture[] = [];
    input.onGesture((g) => {
      got.push(g);
      return true;
    });
    return { canvas, got };
  }
  const kinds = (got: Gesture[]): string[] => got.map((g) => g.k);

  /** Il thread gira normalmente per `ms` millisecondi: i timer scattano in orario. */
  const run = (ms: number): void => {
    for (let i = 0; i < ms; i++) {
      clock += 1;
      vi.advanceTimersByTime(1);
    }
  };
  /** Il thread è bloccato per `ms`: il tempo passa, niente gira. */
  const stall = (ms: number): void => {
    clock += ms;
  };
  /** Finito il blocco, scatta il prossimo timer arretrato (senza che passi altro tempo). */
  const overdue = (): void => {
    vi.advanceTimersToNextTimer();
  };

  it('eventTime: usa timeStamp se è sullo stesso orologio, altrimenti l’istante corrente; mai nel futuro', () => {
    expect(eventTime({ timeStamp: 120 }, 700)).toBe(120);
    expect(eventTime({ timeStamp: 0 }, 700)).toBe(700);
    expect(eventTime({}, 700)).toBe(700);
    expect(eventTime({ timeStamp: 1_760_000_000_000 }, 700)).toBe(700); // millisecondi dal 1970
    expect(eventTime({ timeStamp: 900 }, 700)).toBe(700);
    expect(eventTime({ timeStamp: Number.NaN }, 700)).toBe(700);
  });

  it('SeenClock: toglie dal tempo i tratti in cui il thread era bloccato', () => {
    const c = new SeenClock();
    c.start(0);
    c.alive(50);
    c.alive(100);
    expect(c.map(100)).toBe(100);
    c.alive(800); // 700 ms senza segni di vita: cieco da 150 a 800
    expect(c.blindBefore(800)).toBe(650);
    expect(c.map(120)).toBe(120);
    expect(c.map(800)).toBe(150);
    expect(c.map(900)).toBe(250);
    c.start(1000);
    expect(c.map(1000)).toBe(1000);
  });

  it('i passi della segnalazione, con gli istanti veri del sistema: 14 movimenti fatti durante il blocco → trascinamento', () => {
    const { canvas, got } = setup();
    clock = 1;
    canvas.fire('pointerdown', ev(100, 100, 1));
    run(4);
    stall(700);
    // Finito il blocco: prima il battito arretrato, poi (al fotogramma) i movimenti in coda.
    overdue();
    for (let i = 1; i <= 14; i++) canvas.fire('pointermove', ev(100 - i * 6, 100, 1 + i * 16));
    frame();
    run(30);
    canvas.fire('pointerup', ev(16, 100, 1 + 15 * 16));
    expect(kinds(got)).not.toContain('longpress');
    expect(kinds(got)[0]).toBe('dragstart');
    expect(kinds(got).at(-1)).toBe('dragend');
    expect(got.at(-1)?.x).toBe(16);
  });

  it('i passi della segnalazione col mouse simulato: i movimenti nascono solo dopo il blocco → trascinamento', () => {
    for (const battitoPrima of [true, false]) {
      const { canvas, got } = setup();
      clock = 1;
      canvas.fire('pointerdown', ev(100, 100, 1));
      run(4);
      stall(700);
      if (battitoPrima) overdue();
      // Il browser crea i movimenti solo adesso, con l'istante di adesso (oltre 500 ms dalla pressione).
      for (let i = 1; i <= 14; i++) {
        canvas.fire('pointermove', ev(100 - i * 6, 100, clock));
        run(16);
        frame();
      }
      canvas.fire('pointerup', ev(16, 100, clock));
      expect(kinds(got)).not.toContain('longpress');
      expect(kinds(got)[0]).toBe('dragstart');
      expect(kinds(got).at(-1)).toBe('dragend');
    }
  });

  it('un movimento elaborato tardi conta con il suo istante, non con quello dell’elaborazione', () => {
    const { canvas, got } = setup();
    clock = 1;
    canvas.fire('pointerdown', ev(100, 100, 1));
    stall(700);
    canvas.fire('pointermove', ev(97, 100, 17));
    expect(kinds(got)).toEqual([]);
    canvas.fire('pointermove', ev(80, 100, 33));
    expect(kinds(got)).toEqual(['dragstart']);
  });

  it('movimenti accorpati: decide il primo campione oltre la soglia, con il suo istante', () => {
    const { canvas, got } = setup();
    clock = 1;
    canvas.fire('pointerdown', ev(100, 100, 1));
    stall(700);
    const parts = [ev(98, 100, 20), ev(95, 100, 40), ev(60, 100, 60), ev(20, 100, 690)];
    canvas.fire('pointermove', { ...ev(20, 100, 690), getCoalescedEvents: () => parts });
    expect(kinds(got)).toEqual(['dragstart', 'drag']);
    expect(got[0]?.x).toBe(60);
    expect(got[1]?.x).toBe(20);
  });

  it('pressione lunga vera: il puntatore resta fermo e la scheda si apre dopo il fotogramma', () => {
    const { canvas, got } = setup();
    clock = 1;
    canvas.fire('pointerdown', ev(100, 100, 1, { pointerType: 'touch' }));
    run(520);
    expect(kinds(got)).toEqual([]);
    frame();
    run(2);
    expect(kinds(got)).toEqual(['longpress']);
    expect(clock).toBeLessThan(560);
    canvas.fire('pointerup', ev(100, 100, clock, { pointerType: 'touch' }));
    expect(kinds(got)).toEqual(['longpress']);
  });

  it('pressione lunga con il thread bloccato e il puntatore fermo: scatta comunque, contando solo il tempo visto', () => {
    const { canvas, got } = setup();
    clock = 1;
    canvas.fire('pointerdown', ev(100, 100, 1, { pointerType: 'touch' }));
    run(10);
    stall(700);
    overdue();
    frame();
    run(1);
    expect(kinds(got)).toEqual([]);
    for (let i = 0; i < 60 && got.length === 0; i++) {
      run(10);
      frame();
    }
    expect(kinds(got)).toEqual(['longpress']);
  });

  it('tap fatto durante un blocco (giù a 1 ms, su a 80 ms, elaborati a 700 ms): resta un tap', () => {
    const { canvas, got } = setup();
    clock = 700;
    canvas.fire('pointerdown', ev(100, 100, 1));
    canvas.fire('pointerup', ev(101, 100, 80));
    run(600);
    frame();
    run(5);
    expect(kinds(got)).toEqual(['tap']);
  });

  it('il rilascio annulla il ricontrollo rimandato della pressione lunga', () => {
    const { canvas, got } = setup();
    clock = 1;
    canvas.fire('pointerdown', ev(100, 100, 1));
    run(520); // ricontrollo in attesa del fotogramma
    // Rilasciato prima del fotogramma, con un leggero spostamento: niente pressione lunga dopo.
    canvas.fire('pointerup', ev(100, 100, 400));
    frame();
    run(100);
    expect(kinds(got)).toEqual([]);
  });
});
