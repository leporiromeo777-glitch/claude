import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CELLA_DTHETA, CELLA_DZ, CELLE_NTHETA, CELLE_NZ, L, PERIODO_ROTAZIONE, R, STRISCE } from '../src/costanti';
import {
  angoloFra,
  celleNelRaggio,
  celleNellaFascia,
  centroCella,
  deltaGradi,
  distanzaDaSegmento,
  distanzaFoglio,
  distanzaSegmentoDallAsse,
  foglioDi,
  idCella,
  indiciCella,
  nomeCatastale,
  normalizzaGradi,
  posizione3D,
  strisciaDi,
} from '../src/griglia';
import { LAYOUT_MOTORE, contenuti } from './aiuti';

describe('costanti del mondo', () => {
  it('sono quelle del motore (src/world/layout.json)', () => {
    expect(CELLA_DZ).toBe(40);
    expect(CELLA_DTHETA).toBe(3.75);
    if (!existsSync(LAYOUT_MOTORE)) return;
    const layout = JSON.parse(readFileSync(LAYOUT_MOTORE, 'utf8'));
    expect(layout.cylinder.radius).toBe(R);
    expect(layout.cylinder.length).toBe(L);
    expect(layout.cylinder.rotationPeriod).toBe(PERIODO_ROTAZIONE);
    expect(layout.cells.nZ).toBe(CELLE_NZ);
    expect(layout.cells.nTheta).toBe(CELLE_NTHETA);
    expect(layout.strips.map((s: { id: string; thetaStart: number; thetaEnd: number }) => [s.id, s.thetaStart, s.thetaEnd])).toEqual(
      STRISCE.map((s) => [s.id, s.thetaDa, s.thetaA]),
    );
  });
});

describe('griglia delle particelle', () => {
  it('id = floor(z/40)·96 + floor(θ/3,75), come FASE1 §2.1', () => {
    expect(idCella(1062, 37.2)).toBe(2505); // Pilastro 1
    expect(idCella(946, 23.6)).toBe(2214); // chiodo 3
    expect(idCella(1112, 27)).toBe(2599); // botola della Cripta
    expect(idCella(1172, 57)).toBe(2799); // chiodo 8
    expect(idCella(1163, 51.9)).toBe(2797); // passerella del Messo
    expect(idCella(-5, -1)).toBe(95); // si avvolge in θ e si ferma al Tappo Sud
    expect(idCella(3000, 360)).toBe(74 * 96);
    expect(indiciCella(2505)).toEqual({ iz: 26, it: 9 });
    expect(centroCella(2505)).toEqual({ z: 1060, theta: 35.625 });
  });

  it('il nome catastale è quello delle tabelle del design', () => {
    const attesi: Record<number, string> = {
      2599: '1-656',
      2214: '1-559',
      2213: '1-558',
      2311: '1-584',
      2407: '1-608',
      2505: '1-634',
      2797: '1-710',
      2798: '1-711',
      2796: '1-709',
      2699: '1-684',
      2799: '1-712',
    };
    for (const [id, nome] of Object.entries(attesi)) expect(nomeCatastale(Number(id))).toBe(nome);
    // e quello di tutte le 228 particelle di fade_fase1.json
    for (const p of contenuti().fade.particelle as { id: number; catasto: string }[]) expect(nomeCatastale(p.id)).toBe(p.catasto);
  });

  it('fogli: valli 1-3, Sordo 4, Finestre 5', () => {
    expect(foglioDi(2505)).toBe(1);
    expect(foglioDi(idCella(1500, 160))).toBe(2);
    expect(foglioDi(idCella(1500, 280))).toBe(3);
    expect(foglioDi(idCella(2800, 30))).toBe(4);
    expect(foglioDi(idCella(1500, 105))).toBe(5);
    expect(nomeCatastale(idCella(1500, 105))).toMatch(/^5-\d+$/);
    expect(nomeCatastale(idCella(2645, 0))).toBe('4-1');
    expect(strisciaDi(345).nome).toBe('Finestra delle Vedove');
    expect(strisciaDi(-10).id).toBe('finestra-3');
  });

  it('angoli e distanze sul foglio si avvolgono a 0°/360°', () => {
    expect(normalizzaGradi(-30)).toBe(330);
    expect(deltaGradi(350, 10)).toBe(20);
    expect(deltaGradi(10, 350)).toBe(-20);
    const d = distanzaFoglio({ z: 0, theta: 359 }, { z: 0, theta: 1 });
    expect(d).toBeCloseTo(2 * (R * Math.PI) / 180, 6);
    expect(distanzaDaSegmento({ z: 50, theta: 0 }, { z: 0, theta: 359 }, { z: 100, theta: 1 })).toBeCloseTo(0, 6);
  });

  it('il ventaglio geometrico (60 m dal segmento) coincide con quello di capisaldi.json', () => {
    const { capisaldi, fade } = contenuti();
    const cs = new Map<string, { z: number; theta: number }>(capisaldi.rete_corbella.map((c: { id: string; z: number; theta: number }) => [c.id, c]));
    const itMax = fade.griglia.area_fase1.itheta[1] as number;
    const fuoriArea: number[] = [];
    for (const l of capisaldi.lati as { id: string; a: string; b: string; particelle: number[]; particelle_se_fosse_chiudibile: number[] }[]) {
      const geo = celleNellaFascia(cs.get(l.a)!, cs.get(l.b)!, 60);
      const dati = l.particelle.length ? l.particelle : l.particelle_se_fosse_chiudibile;
      const extra = geo.filter((c) => !dati.includes(c));
      expect(dati.every((c) => geo.includes(c)), l.id).toBe(true);
      // le sole differenze sono fuori dall'area della Fase 1 (colonna 20, θ 75°-78,75°)
      for (const c of extra) {
        expect(c % 96).toBeGreaterThan(itMax);
        fuoriArea.push(c);
      }
    }
    expect([...new Set(fuoriArea)].sort()).toEqual([2708, 2804, 2900]);
  });

  it('celle nel raggio', () => {
    const c = celleNelRaggio({ z: 1062, theta: 37.2 }, 60);
    expect(c).toContain(2505);
    expect(c.every((id) => distanzaFoglio({ z: 1062, theta: 37.2 }, centroCella(id)) <= 60)).toBe(true);
    // attorno a θ 0 prende le colonne di entrambi i lati
    const z = celleNelRaggio({ z: 1000, theta: 0.5 }, 40);
    expect(z.some((id) => id % 96 === 95) && z.some((id) => id % 96 === 0)).toBe(true);
  });

  it('posizioni 3D con la terna del motore e distanza dall\'asse', () => {
    const p = posizione3D(100, 0, 0);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(-646, 9);
    expect(p.z).toBe(100);
    const q = posizione3D(100, 90, 46);
    expect(q.x).toBeCloseTo(-600, 9);
    // un lato che attraversa il cilindro passa per l'asse; uno corto resta lontano
    expect(distanzaSegmentoDallAsse(posizione3D(0, 0, 0), posizione3D(0, 180, 0))).toBeCloseTo(0, 6);
    expect(distanzaSegmentoDallAsse(posizione3D(0, 10, 0), posizione3D(100, 10, 0))).toBeCloseTo(646, 6);
    expect(angoloFra(posizione3D(0, 0, 0), posizione3D(0, 10, 0), posizione3D(100, 0, 0))).toBeGreaterThan(80);
  });
});
