import { describe, expect, it } from 'vitest';
import {
  posizioneCilindrica,
  attenuazioneValle,
  calcolaParametriAmbiente,
  coordinateCilindriche,
  distanzaLagoStimata,
  distanzaSordoStimata,
  haAttraversato,
  intensitaGrilli,
  intensitaUccelli,
  luceLinea,
  normalizzaOra,
  orientamentoAscoltatore,
  parametriFauna,
  parametriLinea,
  parametriVento,
  parametriVolo,
  pesoFinestra,
  pesoLago,
  pesoSordo,
  suVersoAsse,
  volumeAGuadagno,
  zonaDaTheta,
} from '../../src/audio/mappature';
import { RAGGIO_INTERNO } from '../../src/audio/costanti';
import { lunghezza, punto } from '../../src/audio/util';
import type { Vec3 } from '../../src/audio/tipi';

function pos(theta: number, z: number, altezza: number): Vec3 {
  return posizioneCilindrica(theta, z, altezza);
}

describe('geometria del cilindro', () => {
  it('ricava θ, raggio e altezza dalla posizione', () => {
    const c = coordinateCilindriche(pos(135, 1200, 12));
    expect(c.theta).toBeCloseTo(135, 6);
    expect(c.altezza).toBeCloseTo(12, 6);
    expect(c.z).toBe(1200);
    expect(coordinateCilindriche(pos(350, 0, 0)).theta).toBeCloseTo(350, 6);
  });

  it('segue le convenzioni del motore: x = −r·sin θ, y = −r·cos θ', () => {
    const p0 = posizioneCilindrica(0, 10, 0);
    expect(p0.x).toBeCloseTo(0, 9);
    expect(p0.y).toBeCloseTo(-RAGGIO_INTERNO, 9);
    const p90 = posizioneCilindrica(90, 10, 46);
    expect(p90.x).toBeCloseTo(-600, 9);
    expect(p90.y).toBeCloseTo(0, 9);
    const u0 = suVersoAsse(p0);
    expect(u0.x).toBeCloseTo(0, 9);
    expect(u0.y).toBeCloseTo(1, 9);
    expect(u0.z).toBe(0);
    // la stessa θ del motore: thetaOf(x, y) = atan2(−x, −y)
    for (const t of [0, 37.2, 105, 166, 300]) expect(coordinateCilindriche(posizioneCilindrica(t, 1, 5)).theta).toBeCloseTo(t, 9);
  });

  it('il «su» punta verso l\'asse ed è unitario', () => {
    const p = pos(200, 500, 3);
    const u = suVersoAsse(p);
    expect(lunghezza(u)).toBeCloseTo(1, 9);
    expect(u.z).toBe(0);
    // muovendosi lungo il «su» ci si avvicina all'asse
    const dentro = { x: p.x + u.x * 10, y: p.y + u.y * 10, z: p.z };
    expect(coordinateCilindriche(dentro).altezza).toBeCloseTo(13, 6);
    expect(suVersoAsse({ x: 0, y: 0, z: 10 })).toEqual({ x: 0, y: 1, z: 0 });
  });

  it('assegna le zone secondo θ', () => {
    expect(zonaDaTheta(10)).toBe('valle-1');
    expect(zonaDaTheta(95)).toBe('finestra-ponti');
    expect(zonaDaTheta(165)).toBe('valle-2');
    expect(zonaDaTheta(225)).toBe('finestra-2');
    expect(zonaDaTheta(300)).toBe('valle-3');
    expect(zonaDaTheta(359.9)).toBe('finestra-3');
    expect(zonaDaTheta(360)).toBe('valle-1');
    expect(zonaDaTheta(-5)).toBe('finestra-3');
  });

  it('sfuma il peso della Finestra ai bordi (0,5 sul bordo, 0 e 1 lontano)', () => {
    expect(pesoFinestra(45)).toBe(0);
    expect(pesoFinestra(105)).toBe(1);
    expect(pesoFinestra(90)).toBeCloseTo(0.5, 6);
    expect(pesoFinestra(120)).toBeCloseTo(0.5, 6);
    expect(pesoFinestra(87)).toBe(0);
    expect(pesoFinestra(93)).toBe(1);
    // attraverso lo zero: θ = 0 è il bordo fra Finestra 3 e Valle 1
    expect(pesoFinestra(0)).toBeCloseTo(0.5, 6);
    expect(pesoFinestra(359)).toBeGreaterThan(0.5);
    expect(pesoFinestra(1)).toBeLessThan(0.5);
    // monotòno entrando
    let prec = -1;
    for (let t = 84; t <= 96; t += 0.5) {
      const w = pesoFinestra(t);
      expect(w).toBeGreaterThanOrEqual(prec);
      prec = w;
    }
  });
});

describe('cursori di volume', () => {
  it('curva percettiva limitata e monotòna', () => {
    expect(volumeAGuadagno(0)).toBe(0);
    expect(volumeAGuadagno(1)).toBe(1);
    expect(20 * Math.log10(volumeAGuadagno(0.5))).toBeCloseTo(-12.04, 1);
    expect(volumeAGuadagno(-3)).toBe(0);
    expect(volumeAGuadagno(7)).toBe(1);
    expect(volumeAGuadagno(Number.NaN)).toBe(0);
    for (let v = 0; v < 1; v += 0.05) expect(volumeAGuadagno(v + 0.05)).toBeGreaterThan(volumeAGuadagno(v));
  });
});

describe('ascoltatore', () => {
  it('rende ortonormale la coppia avanti/su', () => {
    const o = orientamentoAscoltatore({ x: 0.3, y: 0.2, z: 1 }, { x: -1, y: 0.4, z: 0 });
    expect(lunghezza(o.avanti)).toBeCloseTo(1, 9);
    expect(lunghezza(o.su)).toBeCloseTo(1, 9);
    expect(punto(o.avanti, o.su)).toBeCloseTo(0, 9);
  });

  it('non degenera se si guarda dritto verso l\'asse', () => {
    const o = orientamentoAscoltatore({ x: -1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 });
    expect(lunghezza(o.su)).toBeCloseTo(1, 9);
    expect(Math.abs(punto(o.avanti, o.su))).toBeLessThan(1e-9);
    const z = orientamentoAscoltatore({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    expect(Number.isFinite(z.su.x + z.su.y + z.su.z)).toBe(true);
  });
});

describe('vento e volo', () => {
  it('il vento cresce con l\'altezza e con la velocità', () => {
    const terra = parametriVento(0, 0);
    const alto = parametriVento(200, 0);
    const veloce = parametriVento(0, 25);
    const tutto = parametriVento(300, 30);
    expect(alto.guadagno).toBeGreaterThan(terra.guadagno);
    expect(veloce.guadagno).toBeGreaterThan(terra.guadagno);
    expect(tutto.guadagno).toBeGreaterThan(Math.max(alto.guadagno, veloce.guadagno));
    expect(tutto.tagliaCorpo).toBeGreaterThan(terra.tagliaCorpo);
    expect(alto.raffiche).toBeGreaterThan(terra.raffiche);
    for (let h = 0; h < 600; h += 20) expect(parametriVento(h + 20, 5).guadagno).toBeGreaterThan(parametriVento(h, 5).guadagno);
    for (let v = 0; v < 40; v += 2) expect(parametriVento(10, v + 2).guadagno).toBeGreaterThanOrEqual(parametriVento(10, v).guadagno);
  });

  it('resta morbido: guadagno e risonanza hanno un tetto, anche con valori assurdi', () => {
    const p = parametriVento(1e6, 1e4);
    expect(p.guadagno).toBeLessThan(0.45);
    expect(p.qFischio).toBeLessThanOrEqual(2.2);
    expect(p.centroFischio).toBeLessThan(2500);
    const n = parametriVento(Number.NaN, Number.NaN);
    expect(Number.isFinite(n.guadagno)).toBe(true);
    expect(parametriVento(-50, -10).guadagno).toBe(parametriVento(0, 10).guadagno);
  });

  it('il fruscio del Velo c\'è solo in volo e batte più in fretta con la velocità', () => {
    expect(parametriVolo(20, false).guadagno).toBe(0);
    expect(parametriVolo(20, true).guadagno).toBeGreaterThan(parametriVolo(5, true).guadagno);
    expect(parametriVolo(25, true).battito).toBeGreaterThan(parametriVolo(5, true).battito);
    expect(parametriVolo(1000, true).battito).toBeLessThanOrEqual(16.5);
  });
});

describe('la Linea secondo l\'ora', () => {
  it('spenta (brace) di notte, accesa di giorno, si accende all\'alba', () => {
    expect(luceLinea(2)).toBe(0);
    expect(luceLinea(12)).toBe(1);
    expect(luceLinea(23)).toBe(0);
    expect(luceLinea(6.25)).toBeGreaterThan(0.2);
    expect(luceLinea(6.25)).toBeLessThan(0.8);
    expect(luceLinea(19.25)).toBeGreaterThan(0.2);
    expect(luceLinea(19.25)).toBeLessThan(0.8);
    for (let h = 5.5; h < 7; h += 0.1) expect(luceLinea(h + 0.1)).toBeGreaterThanOrEqual(luceLinea(h));
  });

  it('ronzio: La1 di giorno, Sol1 alla brace, più scuro e col respiro di notte', () => {
    const giorno = parametriLinea(13);
    const notte = parametriLinea(1);
    expect(giorno.frequenza).toBeCloseTo(55, 6);
    expect(notte.frequenza).toBeCloseTo(49, 6);
    expect(giorno.taglio).toBeGreaterThan(notte.taglio);
    expect(giorno.guadagno).toBeGreaterThan(notte.guadagno);
    expect(notte.respiro).toBeGreaterThan(giorno.respiro);
    expect(notte.brace).toBe(1);
    expect(parametriLinea(13, 600).guadagno).toBeGreaterThan(giorno.guadagno);
  });

  it('accetta ore fuori intervallo', () => {
    expect(normalizzaOra(25)).toBe(1);
    expect(normalizzaOra(-1)).toBe(23);
    expect(parametriLinea(37).luce).toBe(parametriLinea(13).luce);
  });
});

describe('uccelli e grilli', () => {
  it('gli uccelli cantano di giorno (coro all\'alba), i grilli di notte', () => {
    expect(intensitaUccelli(2)).toBe(0);
    expect(intensitaUccelli(23)).toBe(0);
    expect(intensitaUccelli(6.6)).toBeGreaterThan(0.9);
    expect(intensitaUccelli(12)).toBeGreaterThan(0.3);
    expect(intensitaUccelli(6.6)).toBeGreaterThan(intensitaUccelli(12));
    expect(intensitaGrilli(23)).toBe(1);
    expect(intensitaGrilli(2)).toBe(1);
    expect(intensitaGrilli(12)).toBe(0);
    expect(intensitaGrilli(6)).toBe(0);
  });

  it('vivono nelle valli, al suolo', () => {
    expect(parametriFauna(7, 1, 2).uccelli).toBeGreaterThan(0.5);
    expect(parametriFauna(7, 0, 2).uccelli).toBe(0);
    expect(parametriFauna(7, 1, 300).uccelli).toBe(0);
    expect(parametriFauna(22, 1, 2).grilli).toBe(1);
    expect(parametriFauna(22, 1, 100).grilli).toBeLessThan(1);
  });
});

describe('lago, Sordo, Finestre', () => {
  it('l\'acqua si sente vicino alla riva', () => {
    expect(pesoLago(0)).toBe(1);
    expect(pesoLago(8)).toBe(1);
    expect(pesoLago(80)).toBeGreaterThan(0);
    expect(pesoLago(80)).toBeLessThan(1);
    expect(pesoLago(150)).toBe(0);
    expect(distanzaLagoStimata(166, 1500, 0)).toBe(0);
    expect(distanzaLagoStimata(166, 700, 0)).toBe(20);
    expect(distanzaLagoStimata(45, 1500, 0)).toBeGreaterThan(500);
    expect(distanzaLagoStimata(166, 1500, 40)).toBe(40);
  });

  it('il rombo del Sordo cresce avvicinandosi al Tappo Nord', () => {
    expect(distanzaSordoStimata(2600)).toBe(40);
    expect(distanzaSordoStimata(2950)).toBe(0);
    expect(pesoSordo(distanzaSordoStimata(1000))).toBe(0);
    expect(pesoSordo(30)).toBe(1);
    let prec = -1;
    for (let z = 1200; z <= 3000; z += 50) {
      const w = pesoSordo(distanzaSordoStimata(z));
      expect(w).toBeGreaterThanOrEqual(prec);
      prec = w;
    }
  });

  it('sulle Finestre la valle quasi tace', () => {
    expect(attenuazioneValle(0)).toBe(1);
    expect(attenuazioneValle(1)).toBeCloseTo(0.06, 9);
  });
});

describe('parametri complessivi', () => {
  it('ricava tutto dalla posizione', () => {
    const p = calcolaParametriAmbiente({ posizione: pos(105, 2000, 5), velocita: 3, ora: 14 });
    expect(p.zona).toBe('finestra-ponti');
    expect(p.pesoFinestra).toBe(1);
    expect(p.altezza).toBeCloseTo(5, 6);
    expect(p.fauna.uccelli).toBe(0);
    expect(p.duckValle).toBeCloseTo(0.06, 6);
    expect(p.inVolo).toBe(false);
  });

  it('rispetta zona, θ, altezza e distanze passate dal gioco', () => {
    const p = calcolaParametriAmbiente({
      posizione: pos(45, 1000, 1.7),
      velocita: -12,
      ora: 30,
      zona: 'finestra-2',
      altezza: 50,
      distanzaLago: 0,
      distanzaSordo: 10,
      fadeVicine: 3,
    });
    expect(p.zona).toBe('finestra-2');
    expect(p.pesoFinestra).toBe(1);
    expect(p.altezza).toBe(50);
    expect(p.velocita).toBe(12);
    expect(p.ora).toBe(6);
    expect(p.pesoSordo).toBe(1);
    expect(p.pesoLago).toBe(0); // il lago non si sente sopra una Finestra
    expect(p.fadeVicine).toBe(1);
    const q = calcolaParametriAmbiente({ posizione: pos(45, 1000, 1.7), velocita: 0, ora: 12, theta: 160, distanzaLago: 3 });
    expect(q.zona).toBe('valle-2');
    expect(q.pesoLago).toBe(1);
  });

  it('non produce NaN con ingressi sporchi', () => {
    const p = calcolaParametriAmbiente({ posizione: { x: 0, y: 0, z: Number.NaN }, velocita: Number.NaN, ora: Number.NaN });
    const numeri = JSON.stringify(p).match(/null/g);
    expect(numeri).toBeNull();
  });
});

describe('attraversamento delle ore', () => {
  it('riconosce il passaggio di una soglia, anche a mezzanotte', () => {
    expect(haAttraversato(5.4, 5.6, 5.5)).toBe(true);
    expect(haAttraversato(5.5, 5.6, 5.5)).toBe(false);
    expect(haAttraversato(5.4, 5.5, 5.5)).toBe(true);
    expect(haAttraversato(23.9, 0.1, 0)).toBe(true);
    expect(haAttraversato(23.9, 0.1, 24)).toBe(true);
    expect(haAttraversato(6, 5, 5.5)).toBe(false); // all'indietro
    expect(haAttraversato(1, 9, 5.5)).toBe(false); // salto troppo lungo
    expect(haAttraversato(5, 5, 5)).toBe(false);
  });
});
