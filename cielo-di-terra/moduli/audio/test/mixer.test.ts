import { describe, expect, it } from 'vitest';
import { Mixer, VOLUMI_PREDEFINITI } from '../src/mixer';
import { NOMI_BUS } from '../src/tipi';

describe('Mixer', () => {
  it('parte dai volumi predefiniti, con la musica più bassa dell\'ambiente', () => {
    const m = new Mixer();
    for (const b of NOMI_BUS) expect(m.volume(b)).toBe(VOLUMI_PREDEFINITI[b]);
    expect(m.guadagno('musica')).toBeLessThan(m.guadagno('ambiente'));
    expect(m.muto).toBe(false);
    expect(m.inPausa).toBe(false);
  });

  it('limita i cursori a 0-1 e scarta i valori non numerici', () => {
    const m = new Mixer();
    expect(m.imposta('effetti', 1.7)).toBe(1);
    expect(m.imposta('effetti', -2)).toBe(0);
    expect(m.imposta('effetti', Number.NaN)).toBe(0);
    expect(m.imposta('voci', 0.5)).toBe(0.5);
    expect(m.guadagno('voci')).toBeCloseTo(0.25, 9);
  });

  it('muto e pausa spengono solo il generale', () => {
    const m = new Mixer();
    m.imposta('generale', 1);
    m.imposta('ambiente', 1);
    expect(m.guadagnoEffettivo('ambiente')).toBe(1);
    m.muto = true;
    expect(m.guadagno('generale')).toBe(0);
    expect(m.guadagno('ambiente')).toBe(1);
    expect(m.guadagnoEffettivo('ambiente')).toBe(0);
    m.muto = false;
    m.inPausa = true;
    expect(m.guadagnoEffettivo('musica')).toBe(0);
    m.inPausa = false;
    expect(m.guadagnoEffettivo('ambiente')).toBe(1);
  });

  it('il guadagno effettivo è il prodotto bus × generale', () => {
    const m = new Mixer();
    m.imposta('generale', 0.5);
    m.imposta('musica', 0.5);
    expect(m.guadagnoEffettivo('musica')).toBeCloseTo(0.0625, 9);
  });

  it('esporta e importa le impostazioni, ignorando dati rotti', () => {
    const a = new Mixer();
    a.imposta('ambiente', 0.3);
    a.muto = true;
    const dati = a.esporta();
    const b = new Mixer();
    b.importa(dati);
    expect(b.volume('ambiente')).toBe(0.3);
    expect(b.muto).toBe(true);
    // l'istantanea è una copia
    dati.volumi.ambiente = 0.9;
    expect(a.volume('ambiente')).toBe(0.3);
    const c = new Mixer();
    c.importa(null);
    c.importa({ volumi: { effetti: 'forte' } as unknown as Record<'effetti', number> } as never);
    c.importa({ volumi: { voci: 0.2 } } as never);
    expect(c.volume('effetti')).toBe(VOLUMI_PREDEFINITI.effetti);
    expect(c.volume('voci')).toBe(0.2);
    expect(c.muto).toBe(false);
  });
});
