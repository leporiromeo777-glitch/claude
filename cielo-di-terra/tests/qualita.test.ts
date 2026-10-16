import { describe, expect, it } from 'vitest';
import { MisuraQualita, PRESET_GRADINI, PRESET_QUALITA, gradinoSotto, isSceltaQualita, mediana, stimaIniziale } from '../src/render/post/qualita';

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

  it('comanda il mondo della traccia «luce»: ombre e motivi economici a Bassa', () => {
    expect(PRESET_QUALITA.bassa.motivi).toBeLessThan(0.5);
    expect(PRESET_QUALITA.media.motivi).toBe(1);
    expect(PRESET_QUALITA.alta.motivi).toBe(1);
    expect(PRESET_QUALITA.media.ombre).toBe('media');
    expect(PRESET_QUALITA.alta.ombre).toBe('alta');
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
    expect(cambi).toEqual(['media', 'mediaRidotta', 'bassa']);
    expect(m.finita).toBe(true);
    expect(m.conclusa).toBe(true);
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

  it('il costo misurato (GPU o disegno) si giudica a 1/55 s: 20 ms fanno scendere', () => {
    const m = new MisuraQualita('alta');
    let r: string | null = null;
    // il browser va a 60 Hz ma la scheda (ombre comprese) lavora 20 ms: sotto i 60 fps veri
    for (let i = 0; i < 600 && !r; i++) r = m.campione(1 / 60, 0.02);
    expect(r).toBe('media');
  });

  it('senza costo misurato 20 ms per fotogramma restano sotto la soglia di 1/44 s', () => {
    const m = new MisuraQualita('alta');
    for (let i = 0; i < 600 && !m.finita; i++) expect(m.campione(0.02)).toBeNull();
    expect(m.livello).toBe('alta');
  });

  it('un fotogramma lento per la CPU conta come uno lento per la scheda', () => {
    const m = new MisuraQualita('media');
    let r: string | null = null;
    // GPU 6 ms, ma il disegno (draw call, ridistribuzione) costa 25 ms alla CPU: il gioco passa il massimo
    for (let i = 0; i < 600 && !r; i++) r = m.campione(1 / 40, Math.max(0.006, 0.025));
    expect(r).toBe('mediaRidotta');
  });

  it('i gradini: Alta → Media → Media ridotta → Bassa; Media ridotta è Media all’80% dei pixel', () => {
    expect(gradinoSotto('alta')).toBe('media');
    expect(gradinoSotto('media')).toBe('mediaRidotta');
    expect(gradinoSotto('mediaRidotta')).toBe('bassa');
    expect(gradinoSotto('bassa')).toBe('bassa');
    const r = PRESET_GRADINI.mediaRidotta;
    expect(r.livello).toBe('media');
    expect(r.scala).toBeCloseTo(0.8, 6);
    expect(r.filtro).toBe(PRESET_QUALITA.media.filtro);
    expect(r.ombre).toBe('media');
    expect(r.contorni).toBe(true);
    expect(PRESET_GRADINI.alta).toBe(PRESET_QUALITA.alta);
  });

  it('la passata finale non supera la densità del preset (Bassa 1, Media 1,5, Alta 2)', () => {
    expect(PRESET_QUALITA.bassa.maxPixelRatioCanvas).toBe(1);
    expect(PRESET_QUALITA.media.maxPixelRatioCanvas).toBe(1.5);
    expect(PRESET_QUALITA.alta.maxPixelRatioCanvas).toBe(2);
  });

  it('dopo la misura iniziale sorveglia per dieci minuti: una finestra di 5 s ogni 60 s, solo verso il basso', () => {
    const m = new MisuraQualita('alta');
    // misura iniziale a 60 fps, 8 ms di scheda: resta Alta
    for (let i = 0; i < 400 && !m.finita; i++) expect(m.campione(1 / 60, 0.008)).toBeNull();
    expect(m.finita).toBe(true);
    expect(m.conclusa).toBe(false);
    // fuori dalla finestra il costo alto non conta e la scheda non serve
    expect(m.vuoleCosto).toBe(false);
    for (let i = 0; i < 60 * 30; i++) expect(m.campione(1 / 60, 0.03)).toBeNull();
    // poi il gioco si fa pesante (20 ms): alla fine della prima finestra si scende di un gradino
    let r: string | null = null;
    let finestra = false;
    for (let i = 0; i < 60 * 40 && !r; i++) {
      finestra ||= m.vuoleCosto;
      r = m.campione(1 / 60, 0.02);
    }
    expect(finestra).toBe(true);
    expect(r).toBe('media');
    // leggero (10 ms): non risale e non scende più
    for (let i = 0; i < 60 * 120; i++) expect(m.campione(1 / 60, 0.01)).toBeNull();
    expect(m.livello).toBe('media');
    // dopo dieci minuti la sorveglianza finisce
    for (let i = 0; i < 60 * 600; i++) m.campione(1 / 60, 0.01);
    expect(m.conclusa).toBe(true);
    expect(m.campione(1 / 60, 0.05)).toBeNull();
  });

  it('la sorveglianza non giudica senza costo misurato (intervallo quantizzato dal vsync)', () => {
    const m = new MisuraQualita('media');
    for (let i = 0; i < 400 && !m.finita; i++) m.campione(1 / 60, 0.008);
    for (let i = 0; i < 60 * 200; i++) expect(m.campione(1 / 25)).toBeNull();
    expect(m.livello).toBe('media');
  });

  it('mediana', () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 1, 2, 3])).toBe(2.5);
    expect(mediana([])).toBe(0);
  });
});
