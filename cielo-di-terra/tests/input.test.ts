// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ATTESA_BLOCCO_MS, FRECCE_IMBARDATA, Input, type ModoSguardo } from '../src/core/input';

/** Il canvas finto e un controllo sul blocco del puntatore. */
let el: HTMLElement;
let input: Input;
let modi: ModoSguardo[];
let bloccato: Element | null;

function impostaBlocco(fn: (() => unknown) | undefined): void {
  Object.defineProperty(el, 'requestPointerLock', { value: fn, configurable: true, writable: true });
}

function cambiaBlocco(su: Element | null): void {
  bloccato = su;
  document.dispatchEvent(new Event('pointerlockchange'));
}

function puntatore(tipo: string, x: number, y: number, extra: Partial<PointerEventInit> = {}): PointerEvent {
  // (mentre si trascina il tasto sinistro è giù: buttons = 1; al rilascio 0)
  return new PointerEvent(tipo, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0, buttons: tipo === 'pointerup' ? 0 : 1, bubbles: true, ...extra });
}

beforeEach(() => {
  vi.useFakeTimers();
  bloccato = null;
  Object.defineProperty(document, 'pointerLockElement', { get: () => bloccato, configurable: true });
  el = document.createElement('canvas');
  document.body.append(el);
  input = new Input();
  modi = [];
  input.onModoSguardo = (m) => modi.push(m);
  input.attach(el);
});

afterEach(() => {
  input.detach();
  el.remove();
  vi.useRealTimers();
});

describe('sguardo: ripiego quando il pointer lock è vietato', () => {
  it('senza requestPointerLock il clic passa subito al trascinamento', () => {
    impostaBlocco(undefined);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(input.modoSguardo).toBe('trascina');
    expect(modi).toEqual(['trascina']);
  });

  it('una promessa rifiutata (iframe senza allow-pointer-lock) passa al trascinamento', async () => {
    impostaBlocco(() => Promise.reject(new DOMException('vietato', 'SecurityError')));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(input.modoSguardo).toBe('trascina');
  });

  it('un errore lanciato o «pointerlockerror» passano al trascinamento', () => {
    impostaBlocco(() => {
      throw new Error('no');
    });
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(input.modoSguardo).toBe('trascina');

    const altro = new Input();
    const el2 = document.createElement('div');
    altro.attach(el2);
    Object.defineProperty(el2, 'requestPointerLock', { value: () => undefined, configurable: true });
    el2.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.dispatchEvent(new Event('pointerlockerror'));
    expect(altro.modoSguardo).toBe('trascina');
    altro.detach();
  });

  it(`se il blocco non arriva entro ${ATTESA_BLOCCO_MS} ms si trascina; se arriva si resta col blocco`, () => {
    impostaBlocco(() => new Promise(() => {}));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    vi.advanceTimersByTime(ATTESA_BLOCCO_MS - 50);
    expect(input.modoSguardo).toBe('blocco');
    vi.advanceTimersByTime(100);
    expect(input.modoSguardo).toBe('trascina');

    const ok = new Input();
    const el2 = document.createElement('div');
    ok.attach(el2);
    Object.defineProperty(el2, 'requestPointerLock', { value: () => Promise.resolve(), configurable: true });
    el2.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    cambiaBlocco(el2);
    vi.advanceTimersByTime(1000);
    expect(ok.pointerLocked).toBe(true);
    expect(ok.modoSguardo).toBe('blocco');
    // dopo un blocco riuscito un rifiuto è passeggero (Esc appena premuto): niente ripiego
    cambiaBlocco(null);
    document.dispatchEvent(new Event('pointerlockerror'));
    expect(ok.modoSguardo).toBe('blocco');
    ok.detach();
  });

  it('se il blocco arriva dopo l’attesa (permesso lento) si torna al blocco', () => {
    impostaBlocco(() => new Promise(() => {}));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    vi.advanceTimersByTime(ATTESA_BLOCCO_MS + 100);
    expect(input.modoSguardo).toBe('trascina');
    cambiaBlocco(el);
    expect(input.modoSguardo).toBe('blocco');
    expect(modi).toEqual(['trascina', 'blocco']);
    // dopo Esc il clic richiede il blocco
    cambiaBlocco(null);
    const chiesto = vi.fn(() => new Promise(() => {}));
    impostaBlocco(chiesto);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(chiesto).toHaveBeenCalled();
  });

  it('dopo il ripiego il clic non chiede più il blocco', () => {
    const chiesto = vi.fn(() => Promise.reject(new Error('no')));
    impostaBlocco(chiesto);
    input.passaATrascina();
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(chiesto).not.toHaveBeenCalled();
  });
});

describe('sguardo: trascinamento e frecce', () => {
  it('trascinando col tasto sinistro la visuale gira; il destro e il rilascio non contano', () => {
    let primo = 0;
    input.onPrimoSguardo = () => primo++;
    el.dispatchEvent(puntatore('pointerdown', 100, 100));
    window.dispatchEvent(puntatore('pointermove', 130, 90));
    window.dispatchEvent(puntatore('pointermove', 140, 95));
    expect(input.consumeMouse()).toEqual({ dx: 40, dy: -5 });
    expect(primo).toBe(1);
    window.dispatchEvent(puntatore('pointerup', 140, 95));
    window.dispatchEvent(puntatore('pointermove', 200, 95));
    expect(input.consumeMouse()).toEqual({ dx: 0, dy: 0 });
    el.dispatchEvent(puntatore('pointerdown', 0, 0, { button: 2 }));
    window.dispatchEvent(puntatore('pointermove', 50, 0));
    expect(input.consumeMouse()).toEqual({ dx: 0, dy: 0 });
  });

  it('se il rilascio si perde (fuori dalla finestra) lo sguardo si ferma al primo movimento senza tasto', () => {
    el.dispatchEvent(puntatore('pointerdown', 100, 100));
    window.dispatchEvent(puntatore('pointermove', 120, 100));
    expect(input.consumeMouse()).toEqual({ dx: 20, dy: 0 });
    // niente pointerup: il mouse torna dentro col tasto già alzato
    window.dispatchEvent(puntatore('pointermove', 160, 100, { buttons: 0 }));
    expect(input.consumeMouse()).toEqual({ dx: 0, dy: 0 });
    expect(input.trascina).toBe(false);
    window.dispatchEvent(puntatore('pointermove', 200, 100));
    expect(input.consumeMouse()).toEqual({ dx: 0, dy: 0 });
  });

  it('col dito si afferra il mondo (verso opposto)', () => {
    el.dispatchEvent(puntatore('pointerdown', 100, 100, { pointerType: 'touch', pointerId: 7 }));
    window.dispatchEvent(puntatore('pointermove', 110, 100, { pointerType: 'touch', pointerId: 7 }));
    expect(input.consumeMouse().dx).toBeLessThan(0);
  });

  it('le frecce girano lo sguardo, ma non quando l’interfaccia ha la tastiera', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true }));
    const a = input.lookKeys(0.1);
    expect(a.yaw).toBeCloseTo(-FRECCE_IMBARDATA * 0.1);
    expect(a.pitch).toBe(0);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', bubbles: true }));
    expect(input.lookKeys(0.1).pitch).toBeGreaterThan(0);
    input.bloccoInterfaccia = true;
    expect(input.lookKeys(0.1)).toEqual({ yaw: 0, pitch: 0 });
    input.bloccoInterfaccia = false;
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp', bubbles: true }));
    expect(input.lookKeys(0.1)).toEqual({ yaw: 0, pitch: 0 });
  });

  it('le frecce non scorrono la pagina, ma ← → restano ai cursori e ai menu', () => {
    const e = new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true, cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    const cursore = document.createElement('input');
    cursore.type = 'range';
    document.body.append(cursore);
    const e2 = new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true, cancelable: true });
    cursore.dispatchEvent(e2);
    expect(e2.defaultPrevented).toBe(false);
    cursore.remove();
    input.bloccoInterfaccia = true;
    const e3 = new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true, cancelable: true });
    window.dispatchEvent(e3);
    expect(e3.defaultPrevented).toBe(false);
  });
});
