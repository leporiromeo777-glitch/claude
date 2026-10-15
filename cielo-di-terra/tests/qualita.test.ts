import { describe, expect, it } from 'vitest';
import { MisuraQualita, PRESET_QUALITA, isSceltaQualita, mediana, stimaIniziale } from '../src/render/post/qualita';

describe('preset di qualità', () => {
  it('Bassa: niente Kuwahara, niente ombre, risoluzione ridotta; Alta: anisotropico e MSAA', () => {
    const b = PRESET_QUALITA.bassa;
    expect(b.filtro).toBe('nessuno');
    expect(b.ombre).toBe('spente');
    expect(b.scala).toBeLessThan(1);
    expect(PRESET_QUALITA.media.filtro).toBe('generalizzato');
    expect(PRESET_QUALITA.alta.filtro).toBe('anisotropico');
    expect(PRESET_QUALITA.alta.msaa).toBeGreaterThan(0);
    // il filtro lavora a metà risoluzione (circa 16 volte meno lavoro a parità di pennellata);
    // Alta ha le pennellate più larghe e orientate
    expect(PRESET_QUALITA.media.mezzaRisoluzione).toBe(true);
    expect(PRESET_QUALITA.alta.mezzaRisoluzione).toBe(true);
    expect(PRESET_QUALITA.alta.raggio).toBeGreaterThan(PRESET_QUALITA.media.raggio);
  });

  it('riconosce le scelte valide', () => {
    expect(isSceltaQualita('automatica')).toBe(true);
    expect(isSceltaQualita('alta')).toBe(true);
    expect(isSceltaQualita('ultra')).toBe(false);
  });

  it('stima dal nome della scheda', () => {
    expect(stimaIniziale('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)')).toBe('alta');
    expect(stimaIniziale('Apple M2')).toBe('alta');
    expect(stimaIniziale('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0)')).toBe('media');
    expect(stimaIniziale('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)')).toBe('bassa');
    expect(stimaIniziale('ANGLE (Intel, Intel(R) HD Graphics 4000 Direct3D11)')).toBe('bassa');
    expect(stimaIniziale('')).toBe('media');
  });
});

describe('qualità automatica', () => {
  it('a 60 fps resta dov’è e smette di misurare', () => {
    const m = new MisuraQualita('alta');
    for (let i = 0; i < 400; i++) expect(m.campione(1 / 60)).toBeNull();
    expect(m.finita).toBe(true);
    expect(m.livello).toBe('alta');
  });

  it('se il fotogramma è lento scende, rimisura e scende ancora, poi si ferma', () => {
    const m = new MisuraQualita('alta');
    const cambi: string[] = [];
    for (let i = 0; i < 2000 && !m.finita; i++) {
      const r = m.campione(1 / 20);
      if (r) cambi.push(r);
    }
    expect(cambi).toEqual(['media', 'bassa']);
    expect(m.finita).toBe(true);
  });

  it('ignora i fotogrammi delle pause e giudica il costo GPU quando c’è', () => {
    const m = new MisuraQualita('media');
    // il browser limita a 30 fps (risparmio energetico) ma la GPU lavora 8 ms: niente cambio
    for (let i = 0; i < 400; i++) {
      m.campione(5); // scheda nascosta: scartato
      expect(m.campione(1 / 30, 0.008)).toBeNull();
    }
    expect(m.livello).toBe('media');
  });

  it('mediana', () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 1, 2, 3])).toBe(2.5);
    expect(mediana([])).toBe(0);
  });
});
