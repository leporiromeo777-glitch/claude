import { describe, expect, it } from 'vitest';
import {
  CIRCONFERENZA,
  aSchermo,
  ampiezza,
  copieVisibili,
  daSchermo,
  dentroAngolo,
  fasciaDi,
  limitaVista,
  normalizzaGradi,
  scalaIntera,
  scalaMinima,
} from '../src/pianta/geometria';
import { ModelloPianta, nomeCatastale } from '../src/pianta/modello';

describe('geometria del cilindro srotolato', () => {
  it('normalizza gli angoli e misura gli intervalli che passano per 0', () => {
    expect(normalizzaGradi(-30)).toBe(330);
    expect(normalizzaGradi(725)).toBe(5);
    expect(ampiezza(350, 10)).toBe(20);
    expect(ampiezza(0, 360)).toBe(360);
    expect(dentroAngolo(5, 350, 10)).toBe(true);
    expect(dentroAngolo(20, 350, 10)).toBe(false);
  });

  it('trova le copie da disegnare quando il foglio scorre oltre 360°', () => {
    // Una fascia vicina allo 0 si vede due volte se la finestra va da -20° a 380°.
    expect(copieVisibili(350, 20, -20, 380)).toEqual([-360, 0]);
    expect(copieVisibili(100, 30, 0, 90)).toEqual([]);
  });

  it('schermo e mondo sono uno l’inverso dell’altro', () => {
    const v = { zc: 1500, tc: 45, scala: 0.4 };
    const [x, y] = aSchermo(v, 1000, 600, 1200, 80);
    const [z, t] = daSchermo(v, 1000, 600, x, y);
    expect(z).toBeCloseTo(1200, 6);
    expect(t).toBeCloseTo(80, 6);
    // θ cresce verso l'alto: un θ maggiore sta più in alto.
    expect(aSchermo(v, 1000, 600, 1500, 60)[1]).toBeLessThan(aSchermo(v, 1000, 600, 1500, 30)[1]);
  });

  it('la vista resta fra «tutto il giro» e 8 volte la scala intera', () => {
    const sMin = scalaMinima(900, 500);
    expect(sMin).toBeCloseTo(Math.min(900 / 3000, 500 / CIRCONFERENZA), 9);
    const lontana = limitaVista({ zc: 99999, tc: 10, scala: 0.0001 }, 1000, 900, 500);
    expect(lontana.scala).toBeCloseTo(sMin, 9);
    expect(lontana.zc).toBe(1500);
    const vicina = limitaVista({ zc: -500, tc: 10, scala: 99 }, 1000, 900, 500);
    expect(vicina.scala).toBeCloseTo(scalaIntera(900) * 8, 9);
    expect(vicina.zc).toBeGreaterThan(0);
  });

  it('sa in quale valle o Finestra cade un angolo', () => {
    expect(fasciaDi(45)?.nome).toBe('Corbella e le Selve');
    expect(fasciaDi(100)?.nome).toBe('Finestra dei Ponti');
    expect(fasciaDi(359)?.nome).toBe('Finestra delle Vedove');
  });
});

describe('ModelloPianta', () => {
  it('rasterizza una particella che passa per 0° e conta gli stati', () => {
    const m = ModelloPianta.da({
      particelle: [
        { id: 'a', z0: 0, z1: 80, theta0: 352.5, theta1: 7.5, stato: 'rilevato', salute: 'bruno' },
        { id: 'b', z0: 1000, z1: 1040, theta0: 30, theta1: 33.75, stato: 'colore' },
        { id: 'c', z0: 2000, z1: 2040, theta0: 90, theta1: 93.75, stato: 'matita', cambiata: true },
      ],
    });
    expect(m.statoIn(20, 0)).toBe(2);
    expect(m.statoIn(20, 355)).toBe(2);
    expect(m.statoIn(20, 20)).toBe(0);
    expect(m.salute[m.indice(20, 359)]).toBe(2);
    expect(m.statoIn(1020, 31)).toBe(2);
    expect(m.cambiate[m.indice(2020, 91)]).toBe(1);
    const c = m.conteggi();
    expect(c.rilevato).toBe(2 * 4 + 1);
    expect(c.matita).toBe(1);
  });

  it('accetta la griglia del motore e ne ricava contorni chiusi', () => {
    const nZ = 75;
    const nTheta = 96;
    const stati = new Uint8Array(nZ * nTheta);
    // Un blocco di 3×3 celle rilevate.
    for (let iz = 10; iz < 13; iz++) for (let it = 20; it < 23; it++) stati[iz * nTheta + it] = 2;
    const m = ModelloPianta.da({ griglia: { nZ, nTheta, stati } });
    const seg = m.contorni(2);
    expect(seg.length).toBeGreaterThan(0);
    // Contorno chiuso: ogni estremo compare un numero pari di volte.
    const conta = new Map<string, number>();
    for (let i = 0; i < seg.length; i += 2) {
      const k = `${seg[i]!.toFixed(3)},${seg[i + 1]!.toFixed(3)}`;
      conta.set(k, (conta.get(k) ?? 0) + 1);
    }
    for (const n of conta.values()) expect(n % 2).toBe(0);
  });

  it('chiude i contorni anche attraverso 360°', () => {
    const stati = new Uint8Array(75 * 96);
    stati[40 * 96 + 0] = 1;
    stati[40 * 96 + 95] = 1;
    const m = ModelloPianta.da({ griglia: { nZ: 75, nTheta: 96, stati } });
    const seg = m.contorni(1);
    // Due celle adiacenti attraverso lo 0 formano una sola macchia: nessun segmento fra loro sul bordo θ=0.
    let tagliaLoZero = false;
    for (let i = 0; i < seg.length; i += 4) {
      const t1 = seg[i + 1]!;
      const t2 = seg[i + 3]!;
      if (Math.abs(t1 - 360) < 1e-6 && Math.abs(t2 - 360) < 1e-6) tagliaLoZero = true;
    }
    expect(tagliaLoZero).toBe(false);
  });

  it('dà il nome catastale delle celle di valle come nel GDD', () => {
    // Terrazza Pedrazzini: iz 23, colonna 6 di Valle 1 → «1-559».
    expect(nomeCatastale(23, 6)).toBe('1-559');
    expect(nomeCatastale(0, 32)).toBe('2-1');
    expect(nomeCatastale(5, 26)).toBeNull();
  });
});
