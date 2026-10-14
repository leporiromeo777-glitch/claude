// @vitest-environment happy-dom
/**
 * Calligrafia e inchiostro su carta (revisione 1, C17, SCH-02 e SCH-14).
 * Le regole si leggono dagli stili calcolati di happy-dom con base.css caricato.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { paperCard, handStyle } from '../../../src/core/ui/components';
import { contrastRatio, inkOnPaper, PAPER_DEFAULT, richFromString } from '../../../src/core/ui/richtext';
import type { Handwriting } from '../../../src/core/types';
import { installTestServices } from './helpers';

const CSS = readFileSync(resolve(__dirname, '../../../src/core/ui/base.css'), 'utf8');
const CHARACTERS = JSON.parse(readFileSync(resolve(__dirname, '../../../src/content/characters.json'), 'utf8')) as {
  id: string; color: string; hand: Handwriting | null;
}[];

/** Il corpo di una regola CSS (senza commenti), dato il selettore esatto. */
function rule(selector: string): string {
  const clean = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = new RegExp(`(^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'm');
  const m = re.exec(clean);
  return m?.[2] ?? '';
}

describe('calligrafia (C17): il foglio si inclina, il testo resta dentro', () => {
  beforeAll(() => {
    installTestServices();
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
  });

  it('la rotazione è sul foglio intero, limitata a ±3°, attorno al centro', () => {
    const r = rule('.core-carta--mano');
    expect(r).toMatch(/transform:\s*rotate\(clamp\(-3deg,\s*var\(--mano-inclinazione, 0deg\),\s*3deg\)\)/);
    expect(r).toMatch(/transform-origin:\s*center/);
    const card = paperCard({ hand: CHARACTERS.find((c) => c.id === 'zeno')!.hand, children: ['ciao'] });
    document.body.appendChild(card);
    const cs = getComputedStyle(card);
    expect(cs.transformOrigin === 'center' || /50%\s+50%/.test(cs.transformOrigin)).toBe(true);
    expect(card.style.getPropertyValue('--mano-inclinazione')).toBe('-9deg');
    card.remove();
  });

  it('il testo non ha trasformazioni proprie e non prende i tocchi', () => {
    const card = paperCard({ hand: CHARACTERS.find((c) => c.id === 'bepi')!.hand, children: ['un testo lungo'] });
    document.body.appendChild(card);
    const testo = card.querySelector('.core-carta-testo') as HTMLElement;
    const cs = getComputedStyle(testo);
    expect(cs.pointerEvents).toBe('none');
    expect(cs.transform === '' || cs.transform === 'none').toBe(true);
    // Nessuna regola del foglio ruota il testo.
    expect(rule(".core-carta--mano .core-carta-testo")).not.toMatch(/(^|[^-])transform\s*:/);
    expect(rule('.core-carta-testo')).toMatch(/transform:\s*none/);
    card.remove();
  });

  it('core-carta--scorre: altezza massima al 70% e scorrimento verticale', () => {
    const r = rule('.core-carta--scorre');
    expect(r).toMatch(/max-height:\s*70d?vh/);
    expect(r).toMatch(/overflow-y:\s*auto/);
    expect(r).toMatch(/pointer-events:\s*auto/);
    const card = paperCard({ children: ['x'], className: 'core-carta--scorre' });
    document.body.appendChild(card);
    expect(getComputedStyle(card).overflowY).toBe('auto');
    card.remove();
  });

  it('handStyle porta l\'inclinazione del personaggio, il CSS la limita', () => {
    for (const c of CHARACTERS) {
      if (!c.hand) continue;
      expect(handStyle(c.hand)['--mano-inclinazione']).toBe(`${c.hand.slantDeg}deg`);
    }
  });
});

describe('inkOnPaper (C17)', () => {
  it('scurisce fino a 4,5:1 sulla carta predefinita; Lunardi compreso', () => {
    const lunardi = CHARACTERS.find((c) => c.id === 'lunardi')!.color;
    expect(contrastRatio(lunardi, PAPER_DEFAULT)).toBeLessThan(4.5);
    const ink = inkOnPaper(lunardi);
    expect(ink).toMatch(/^#[0-9A-F]{6}$/);
    expect(contrastRatio(ink, '#EDE4D3')).toBeGreaterThanOrEqual(4.5);
    for (const c of CHARACTERS) expect(contrastRatio(inkOnPaper(c.color), '#EDE4D3')).toBeGreaterThanOrEqual(4.5);
  });

  it('un colore già scuro resta com\'è; la carta si può scegliere; stessa tinta', () => {
    expect(inkOnPaper('#2b2622')).toBe('#2B2622');
    expect(contrastRatio(inkOnPaper('#E8C12E', '#DCE6EE'), '#DCE6EE')).toBeGreaterThanOrEqual(4.5);
    const [r, g, b] = [0xe8, 0xc1, 0x2e];
    const out = inkOnPaper('#E8C12E');
    const k = parseInt(out.slice(1, 3), 16) / r;
    expect(Math.abs(parseInt(out.slice(3, 5), 16) / g - k)).toBeLessThan(0.02);
    expect(Math.abs(parseInt(out.slice(5, 7), 16) / b - k)).toBeLessThan(0.05);
    expect(inkOnPaper('rosso')).toBe('#2B2622');
  });

  it('.core-pers usa l\'inchiostro scurito; il colore pieno resta in sottolineatura', () => {
    installTestServices();
    const frag = richFromString('[[lunardi]]', {
      t: (k) => k,
      character: () => ({ name: 'Lunardi', color: '#D9DEE3', icon: '' }),
    });
    const span = frag.firstChild as HTMLElement;
    expect(span.style.getPropertyValue('--pers-color')).toBe('#D9DEE3');
    expect(contrastRatio(span.style.getPropertyValue('--pers-ink'), PAPER_DEFAULT)).toBeGreaterThanOrEqual(4.5);
    expect(rule('.core-pers')).toMatch(/color:\s*var\(--pers-ink/);
    expect(rule('.core-pers')).toMatch(/border-bottom:\s*3px solid var\(--pers-color\)/);
  });
});
