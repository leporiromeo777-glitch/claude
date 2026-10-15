// @vitest-environment happy-dom
/**
 * Revisione 2, Q073 (parte del core): le parole dei fogli non si spezzano a metà
 * («L'ANNIVERSA / RIO» nel bigliettino di Marta al 140%). Se una parola non entra,
 * la calligrafia scende un poco (--carta-adatta), mai sotto il corpo dei fogli
 * (GDD 14: nessuna scritta sotto la sua misura); solo oltre si va a capo dentro la
 * parola (core-carta--spezza). Un foglio senza calligrafia non scende mai.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CARTA_REM, MANO_REM, fitFactor, fitFloor, paperCard } from '../../../src/core/ui/components';
import type { Handwriting } from '../../../src/core/types';

const MARTA: Handwriting = { font: 'atkinson', ink: '#3E3A36', paper: '#D8C3A0', slantDeg: 0, sizeScale: 1.05, caps: true };
import { installTestServices } from './helpers';

const CSS = readFileSync(resolve(__dirname, '../../../src/core/ui/base.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
function rule(selector: string): string {
  const re = new RegExp(`(^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'm');
  return re.exec(CSS)?.[2] ?? '';
}

describe('fitFactor e fitFloor', () => {
  it('la misura: la calligrafia torna al più al corpo dei fogli; un foglio senza calligrafia non scende', () => {
    expect(fitFloor(null)).toBe(1);
    expect(fitFloor(MARTA)).toBeCloseTo(CARTA_REM / (MANO_REM * 1.05), 6);
    expect(fitFloor({ ...MARTA, sizeScale: 0.7 })).toBe(1);
  });
  it('niente da fare se la parola più lunga entra, o se il foglio non può scendere', () => {
    expect(fitFactor(160, 168, 1, 0.7)).toBeNull();
    expect(fitFactor(168.4, 168, 1, 0.7)).toBeNull();
    expect(fitFactor(0, 168, 1, 0.7)).toBeNull();
    expect(fitFactor(200, 0, 1, 0.7)).toBeNull();
    expect(fitFactor(200, 168)).toBeNull();
  });
  it('scende quanto basta, arrotondato per difetto al centesimo', () => {
    expect(fitFactor(200, 168, 1, 0.7)).toBe(0.84);
    // Misurato con un fattore già applicato: si riparte dalla larghezza naturale.
    expect(fitFactor(200 * 0.9, 168, 0.9, 0.7)).toBe(0.84);
  });
  it('mai sotto la misura', () => {
    expect(fitFactor(1000, 168, 1, 0.74)).toBe(0.74);
    expect(fitFactor(1000, 168, 1, 0.7405)).toBe(0.75);
  });
});

describe('CSS dei fogli', () => {
  it('le parole non si spezzano a metà, salvo l’ultima risorsa', () => {
    expect(rule('.core-carta-testo')).toMatch(/overflow-wrap:\s*normal/);
    expect(rule('.core-carta-testo')).not.toMatch(/break-word|anywhere/);
    expect(CSS).toMatch(/\.core-carta--spezza \.core-carta-testo \*\s*\{\s*overflow-wrap:\s*anywhere/);
    // Durante la misura le parole restano intere anche se chi usa il foglio le lascia spezzare.
    expect(CSS).toMatch(/\.core-carta--misura \.core-carta-testo \*\s*\{\s*overflow-wrap:\s*normal !important;\s*word-break:\s*normal !important;/);
  });
  it('solo la calligrafia segue --carta-adatta; il corpo dei fogli resta 1.05rem', () => {
    expect(rule('.core-carta')).toMatch(/font-size:\s*1\.05rem;/);
    expect(rule('.core-carta--mano .core-carta-testo')).toMatch(/font-size:\s*calc\(1\.35rem \* var\(--mano-scala, 1\) \* var\(--carta-adatta, 1\)\)/);
    expect(CARTA_REM).toBe(1.05);
    expect(MANO_REM).toBe(1.35);
  });
});

describe('paperCard tiene le parole intere', () => {
  beforeAll(() => installTestServices());
  const observers: (() => void)[] = [];
  afterEach(() => {
    observers.length = 0;
    vi.unstubAllGlobals();
  });

  function stubRO(): void {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private cb: () => void) {
          observers.push(() => this.cb());
        }
        observe(): void {}
        disconnect(): void {}
      },
    );
  }

  /** Il testo misura `natural` px senza andare a capo nelle parole; il foglio ne offre `box`. */
  function measure(card: HTMLElement, natural: number, box: number): void {
    const text = card.querySelector('.core-carta-testo') as HTMLElement;
    Object.defineProperty(text, 'clientWidth', { configurable: true, get: () => box });
    Object.defineProperty(text, 'scrollWidth', {
      configurable: true,
      get: () => Math.max(box, natural * Number(card.style.getPropertyValue('--carta-adatta') || 1)),
    });
  }

  it('«L’ANNIVERSARIO» di Marta largo 200 px in 168 px: la calligrafia scende a 0,84 e non si spezza', () => {
    stubRO();
    const card = paperCard({ hand: MARTA, children: ["L'ANNIVERSARIO"] });
    measure(card, 200, 168);
    observers.forEach((f) => f());
    expect(card.style.getPropertyValue('--carta-adatta')).toBe('0.84');
    expect(card.classList.contains('core-carta--spezza')).toBe(false);
  });

  it('una parola che non entra nemmeno alla misura del foglio: si spezza (ultima risorsa)', () => {
    stubRO();
    const card = paperCard({ hand: MARTA, children: ['Supercalifragilistichespiralidoso'] });
    measure(card, 400, 168);
    observers.forEach((f) => f());
    expect(Number(card.style.getPropertyValue('--carta-adatta'))).toBeGreaterThanOrEqual(fitFloor(MARTA));
    expect(card.classList.contains('core-carta--spezza')).toBe(true);
  });

  it('un foglio senza calligrafia non rimpicciolisce mai: si spezza la parola (GDD 14)', () => {
    stubRO();
    const card = paperCard({ children: ["L'ANNIVERSARIO"] });
    measure(card, 200, 168);
    observers.forEach((f) => f());
    expect(card.style.getPropertyValue('--carta-adatta')).toBe('');
    expect(card.classList.contains('core-carta--spezza')).toBe(true);
  });

  it('quando il foglio si allarga, si torna al carattere pieno', () => {
    stubRO();
    const card = paperCard({ hand: MARTA, children: ["L'ANNIVERSARIO"] });
    measure(card, 200, 168);
    observers.forEach((f) => f());
    measure(card, 200, 260);
    observers.forEach((f) => f());
    expect(card.style.getPropertyValue('--carta-adatta')).toBe('');
    expect(card.classList.contains('core-carta--spezza')).toBe(false);
  });
});
