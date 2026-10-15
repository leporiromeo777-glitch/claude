import { describe, expect, it } from 'vitest';
import { CATALOGO_ELEMENTI, MOSSE_GDD, PILASTRI_GDD, TETTO_MOSSE_PER_ATTO, TRIANGOLI_GDD } from '../src/catalogoGdd';
import { lunghezzaLato } from '../src/griglia';
import { latoFra, regoleDaContenuti } from '../src/regole';
import { puntoDi, visibilitaDaTabella } from '../src/visibilita';
import { contenutoSintetico, regoleCon, regoleFase1 } from './aiuti';

describe('regole dai contenuti della Fase 1', () => {
  const r = regoleFase1();

  it('legge tutto senza problemi', () => {
    expect(r.problemi).toEqual([]);
    expect(r.fase).toBe(1);
    expect([...r.capisaldi.values()].filter((c) => c.fonte === 'contenuti' && !c.lontano)).toHaveLength(10);
    expect([...r.capisaldi.values()].filter((c) => c.fonte === 'contenuti' && c.lontano)).toHaveLength(12);
    expect(r.lati.size).toBe(18);
    expect([...r.lati.values()].filter((l) => l.chiudibile)).toHaveLength(16);
    expect(r.particelle.size).toBe(228);
    expect([...r.elementi.keys()]).toEqual(['E1', 'E2', 'E3', 'E4']);
    expect(r.inventario?.particelle).toHaveLength(63);
    expect(r.area).toEqual({ izMin: 19, izMax: 30, itMin: 1, itMax: 19 });
    expect(r.parametri).toMatchObject({ latoMin: 40, latoMaxGiorno: 600, bufferVentaglio: 60, abbagliamentoAsse: 150, tettoCapisaldiPerNotte: 8 });
    expect(r.leggi.map((l) => l.id)).toEqual(['legge_1', 'legge_2']);
  });

  it('in Fase 1 le regole attive della notte sono la 3 e la 4 (GDD §11)', () => {
    expect(r.regoleAttive).toEqual({ mosse: false, terminale: false, giro: true, eccezioni: true });
    expect(regoleCon({ fase: 5 }).regoleAttive).toEqual({ mosse: true, terminale: true, giro: true, eccezioni: true });
  });

  it('ogni lato contiene le particelle dei suoi due capisaldi e la sua lunghezza è quella sul foglio con il dislivello', () => {
    for (const l of r.lati.values()) {
      const a = r.capisaldi.get(l.a)!;
      const b = r.capisaldi.get(l.b)!;
      expect(Math.abs(lunghezzaLato(a, b) - l.lunghezza), l.id).toBeLessThan(0.15);
      const ventaglio = l.chiudibile ? l.particelle : l.particelleSeChiudibile;
      expect(ventaglio, l.id).toContain(a.cella);
      expect(ventaglio, l.id).toContain(b.cella);
    }
  });

  it('la tabella di visibilità è simmetrica e spiega i lati bloccati', () => {
    const vis = visibilitaDaTabella(r);
    for (const l of r.lati.values()) {
      const a = r.capisaldi.get(l.a)!;
      const b = r.capisaldi.get(l.b)!;
      const ab = vis(puntoDi(a), puntoDi(b), { scopo: 'lato', ora: 600 });
      const ba = vis(puntoDi(b), puntoDi(a), { scopo: 'lato', ora: 600 });
      expect(ab, l.id).toEqual(ba);
      if (l.chiudibile) expect(ab).toBe(true);
      else expect(typeof ab === 'object' && ab.motivo).toBeTruthy();
    }
    expect(latoFra(r, 'cs_2', 'cs_1')?.id).toBe('1-2');
  });

  it('lumi lontani: ore, Collare, Caposaldo Zero', () => {
    const p14 = r.capisaldi.get('cs_14')!;
    expect(p14.lume).toEqual({ tipo: 'permanente', descrizione: expect.stringContaining('Rosa'), ore: [1230, 300], collare: [[60, 100]] });
    expect(r.capisaldi.get('cs_21')!.lume?.collare).toEqual([[120, 160]]);
    expect(r.capisaldi.get('cs_15')!.lume?.tipo).toBe('ottavio');
    expect(p14.rilevabile).toBe(false);
    expect(p14.motivoNonRilevabile).toMatch(/incollate/);
    const zero = r.capisaldi.get('cs_0')!;
    expect(zero).toMatchObject({ tipo: 'zero', sempreBianco: true, rilevabile: false });
    expect(r.capisaldi.get('cs_1')).toMatchObject({ rilevatoDa: 'G4', valle: 'valle-1', cella: 2505, lume: { tipo: 'ottavio' } });
    expect(r.capisaldi.get('cs_7')!.lume).toBeNull();
    // i pilastri del GDD che i contenuti non hanno ancora
    expect(r.capisaldi.get('cs_44')).toMatchObject({ fonte: 'GDD', z: 1520, theta: 70, rilevabile: false });
    expect(r.capisaldi.get('cs_210')).toMatchObject({ motivoNonRilevabile: expect.stringMatching(/Divelto/) });
    expect(regoleCon({ fase: 3 }).capisaldi.get('cs_14')!.rilevabile).toBe(true);
    expect(regoleCon({ pilastriGdd: false }).capisaldi.has('cs_44')).toBe(false);
  });

  it('elementi mobili: varianti, ore, stadi, cicli e motivi della notte', () => {
    const e2 = r.elementi.get('E2')!;
    expect(e2).toMatchObject({ nome: 'Casa di Nando', particelle: [2796], varianteIniziale: 'Smontata', oraFade: 30, stadi: ['Abitata', 'Smontata', 'Carta'] });
    expect(e2.motivi['Abitata>Smontata']).toBe('Non misurata: un muro in meno.');
    expect(e2.cicli).toEqual([{ ora: 510, chi: 'nando', da: 'Smontata', a: 'Abitata', testo: expect.any(String) }]);
    expect(r.elementi.get('E1')).toMatchObject({ viaNecessaria: true, alternativa: 'guado_sass', oraFade: 1400, protocollo: false });
    expect(r.elementi.get('E3')).toMatchObject({ legatoA: 'E2', oraFade: 30 });
    expect(r.elementi.get('E4')!.cheCosa).toMatch(/gradini/);
    expect(r.elementoDiCella.get(2311)).toBe('E4');
    expect(r.flagCelle.get(2796)).toBe('casa_nando_rilevata');
    expect(r.notti.get(1)?.pesarinaFlag).toBe('taccuino_spostato');
    expect(r.notti.get(2)?.pesarinaFlag).toBeNull();
    expect(r.notteModello).toBe(2);
    expect(r.giroEventi.map((g) => g.ora)).toEqual([1325, 120, 270]);
    expect(r.testi.perVariante.Carta).toBe('{nome}: non misurata, tornata alla Carta.');
    expect(r.testi.rilevataRimasta).toBe('{nome}: misurata, è rimasta.');
  });

  it('i contenuti mancanti o malformati non fermano niente: finiscono nei problemi', () => {
    const vuote = regoleDaContenuti({});
    expect(vuote.problemi.length).toBeGreaterThan(0);
    expect(vuote.capisaldi.has('cs_1')).toBe(true); // dal GDD
    const rotte = regoleDaContenuti({
      capisaldi: { rete_corbella: [{ id: 'cs_x' }, { z: 1, theta: 2 }], lati: [{ id: 'x-y', a: 'cs_x', b: 'cs_y' }] },
      fade: { particelle: [{ id: -3 }, { id: 99999 }], elementi_mobili: [{ id: 'Q', particelle: [5], varianti: [{ id: 'Abitata' }], variante_iniziale: 'Boh', ora_fade: 'mezzanotte' }] },
    });
    expect(rotte.problemi.join('\n')).toMatch(/senza coordinate/);
    expect(rotte.problemi.join('\n')).toMatch(/lato «x-y»/);
    expect(rotte.problemi.join('\n')).toMatch(/id non valido/);
    expect(rotte.problemi.join('\n')).toMatch(/variante iniziale «Boh»/);
    expect(rotte.problemi.join('\n')).toMatch(/manca la variante Carta/);
    expect(rotte.problemi.join('\n')).toMatch(/ora non leggibile/);
    expect(rotte.problemi.join('\n')).toMatch(/catalogo dei 40 elementi/);
  });

  it('il contenuto sintetico dei test si legge senza problemi gravi', () => {
    const s = regoleDaContenuti(contenutoSintetico());
    expect(s.problemi.filter((p) => !/catalogo/.test(p))).toEqual(['lato a-b: senza ventaglio precalcolato, si usa la fascia geometrica di 60 m']);
    expect(s.elementi.get('X2')?.protocollo).toBe(true);
    expect(s.lati.get('a-b')?.quando).toEqual(['alba', 'giorno']);
  });
});

describe('il catalogo del GDD', () => {
  it('40 elementi mobili: 14 di trama e 26 facoltativi, distribuiti come in §3.4.3', () => {
    const n = (f: (x: (typeof CATALOGO_ELEMENTI)[number]) => boolean) => CATALOGO_ELEMENTI.filter(f).reduce((s, x) => s + x.quanti, 0);
    expect(n(() => true)).toBe(40);
    expect(n((x) => x.trama)).toBe(14);
    expect(n((x) => !x.trama)).toBe(26);
    const zone = { 'Corbella e le Selve': 12, Verbanetto: 9, Alpeggi: 10, 'Tappo Sud': 1, Finestre: 5, Guscio: 2, Sordo: 1 };
    for (const [z, k] of Object.entries(zone)) expect(n((x) => x.zona === z), z).toBe(k);
    // i quattro del nucleo di Corbella sono i quattro elementi della Fase 1
    expect(CATALOGO_ELEMENTI.filter((x) => x.idFase1).map((x) => x.idFase1).sort()).toEqual(['E1', 'E2', 'E3', 'E4']);
  });

  it('30 ancore della Penna in 10 elementi con la variante Scritta (§3.4.7)', () => {
    const conAncore = CATALOGO_ELEMENTI.filter((x) => x.ancore > 0);
    expect(conAncore).toHaveLength(10);
    expect(conAncore.every((x) => x.varianti.includes('Scritta'))).toBe(true);
    expect(conAncore.reduce((s, x) => s + x.ancore, 0)).toBe(30);
    const perZona = (z: string) => conAncore.filter((x) => x.zona === z).reduce((s, x) => s + x.ancore, 0);
    expect([perZona('Sordo'), perZona('Alpeggi'), perZona('Verbanetto'), perZona('Corbella e le Selve'), perZona('Guscio'), perZona('Finestre')]).toEqual([8, 6, 6, 5, 3, 2]);
  });

  it('dodici mosse della Madre, sei triangoli, i pilastri della rete', () => {
    expect(MOSSE_GDD).toHaveLength(12);
    expect(['I', 'II', 'III'].map((a) => MOSSE_GDD.filter((m) => m.atto === a).length)).toEqual([4, 5, 3]);
    expect(TETTO_MOSSE_PER_ATTO).toEqual({ I: 2, II: 3, III: 2 });
    expect(TRIANGOLI_GDD.map((t) => t.id)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5', 'T6']);
    expect(PILASTRI_GDD.filter((p) => !p.divelto)).toHaveLength(21);
  });
});
