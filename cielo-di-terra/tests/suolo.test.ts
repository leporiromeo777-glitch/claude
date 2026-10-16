/**
 * Migliorie del 16 ottobre, traccia «suolo»: il prato e la strada del paese non sono più una spalmata
 * arancione. Qui le parti che si possono provare senza disegnare:
 * - la terra battuta dei sentieri resta terra per la superficie automatica (mai pietra a blocchi né
 *   prato dipinto), anche fra un vertice e l'altro del nastro, ed è meno satura di prima;
 * - le shader hanno il colore locale del suolo, il colore del prato per l'erba e il ginocchio della
 *   saturazione nella passata finale;
 * - l'erba vera cresce anche sopra i ripiani d'erba (terrazze, riempimenti dei muri), alla loro quota,
 *   e non fuori dal loro rettangolo.
 */
import { describe, expect, it } from 'vitest';
import { InstancedMesh, ShaderMaterial } from 'three';
import { TRAVERSO_BATTUTO, coloreTerraBattuta } from '../src/popolamento/sentieri';
import { RIPIANI_ERBOSI } from '../src/popolamento/ripiano';
import { SUPERFICIE, superficieAutomatica } from '../src/render/superfici';
import { createWorldMaterial } from '../src/render/worldMaterial';
import { creaMaterialeNatura } from '../src/render/naturaMateriali';
import { createWorldUniforms } from '../src/render/uniforms';
import { PARAMETRI_PREDEFINITI } from '../src/render/post/pipeline';
import { FRAG_FINALE } from '../src/render/post/shaders';
import { TERRENO_GLSL } from '../src/render/shaders/terreno';
import { Sottobosco } from '../src/scene/sottobosco';
import { ColliderWorld } from '../src/world/colliders';
import { worldToCyl } from '../src/world/cylinder';
import { groundHeight } from '../src/world/terrain';
import { DEG, LAYOUT, METERS_PER_DEG } from '../src/world/constants';

const sat = (c: readonly number[]): number => (Math.max(...c) - Math.min(...c)) / Math.max(...c);

describe('terra battuta dei sentieri', () => {
  it('è terra per la superficie automatica in ogni punto del nastro, anche fra due vertici', () => {
    for (let s = 0; s < 240; s += 0.37) {
      for (let i = 0; i < TRAVERSO_BATTUTO.length; i++) {
        const u = TRAVERSO_BATTUTO[i]!;
        const c = coloreTerraBattuta(s, u);
        expect(superficieAutomatica(c, 1), `s ${s.toFixed(2)} u ${u}`).toBe(SUPERFICIE.TERRA);
        if (i + 1 < TRAVERSO_BATTUTO.length) {
          const d = coloreTerraBattuta(s, TRAVERSO_BATTUTO[i + 1]!);
          for (const t of [0.25, 0.5, 0.75]) {
            const m = [c[0] + (d[0] - c[0]) * t, c[1] + (d[1] - c[1]) * t, c[2] + (d[2] - c[2]) * t] as [number, number, number];
            expect(superficieAutomatica(m, 1), `s ${s.toFixed(2)} fra u ${u} e ${TRAVERSO_BATTUTO[i + 1]}`).toBe(SUPERFICIE.TERRA);
          }
        }
      }
    }
  });

  it('è meno satura del vecchio bruno #9a7e58 (che nella luce dorata diventava una fascia arancione)', () => {
    const vecchio = sat([0x9a / 255, 0x7e / 255, 0x58 / 255]);
    for (const u of [-1, -0.6, 0, 0.6, 1]) expect(sat(coloreTerraBattuta(10, u))).toBeLessThan(vecchio);
  });

  it('i vertici di traverso sono ordinati e vanno da −1 a 1', () => {
    expect(TRAVERSO_BATTUTO[0]).toBe(-1);
    expect(TRAVERSO_BATTUTO[TRAVERSO_BATTUTO.length - 1]).toBe(1);
    for (let i = 1; i < TRAVERSO_BATTUTO.length; i++) expect(TRAVERSO_BATTUTO[i]!).toBeGreaterThan(TRAVERSO_BATTUTO[i - 1]!);
  });
});

describe('shader del suolo', () => {
  const u = createWorldUniforms();

  it('il terreno e la terra degli oggetti tengono il colore locale nella luce dorata', () => {
    for (const kind of ['terrain', 'object'] as const) {
      const fs = (createWorldMaterial(u, { kind }) as ShaderMaterial).fragmentShader;
      expect(fs).toContain('coloreLocale(col, s.albedo');
      expect(fs).toContain('quotaColoreLocale()');
    }
    // il terreno sa quanto è prato (la terra nuda tiene di più il suo colore)
    expect(TERRENO_GLSL).toContain('float terrenoDipinto(');
    expect(TERRENO_GLSL).toContain('return grass;');
  });

  it("l'erba prende solo il colore delle chiazze del prato e tiene il suo colore", () => {
    const fs = creaMaterialeNatura(u, { tipo: 'erba' }).fragmentShader;
    expect(fs).toContain('pratoColore(s.albedo');
    expect(fs).toContain('coloreLocale(col, s.albedo');
    expect(TERRENO_GLSL).toContain('vec3 pratoColore(');
  });

  it('la passata finale ha il ginocchio della saturazione, tarato fra 0,5 e 0,7', () => {
    expect(FRAG_FINALE).toContain('uSatGinocchio');
    const [soglia, pendenza] = PARAMETRI_PREDEFINITI.ginocchioSaturazione;
    expect(soglia).toBeGreaterThan(0.5);
    expect(soglia).toBeLessThan(0.7);
    expect(pendenza).toBeGreaterThan(0);
    expect(pendenza).toBeLessThan(1);
  });
});

describe("l'erba vera sopra i ripiani d'erba", () => {
  it('cresce alla quota del ripiano dentro il suo rettangolo e non fuori', () => {
    // un ripiano finto 3 m sopra il prato, lontano dal paese (niente collisori, niente sentieri)
    const z = 1500;
    const theta = 4.3;
    const g0 = groundHeight(z, theta);
    const quota = g0 + 3;
    RIPIANI_ERBOSI.set('prova-suolo', { z, theta, yaw: 30, larghezza: 9, profondita: 7, quota });
    try {
      const s = new Sottobosco(createWorldUniforms(), new ColliderWorld(), []);
      const iz = Math.floor(z / 12);
      const ia = Math.floor((theta * METERS_PER_DEG) / 12);
      // genera le celle attorno al ripiano
      const sopra: number[] = [];
      let fuori = 0;
      const gen = (s as unknown as { genera(iz: number, ia: number): { blocchi: Record<string, { m: Float32Array; n: number }> } }).genera.bind(s);
      for (let dz = -1; dz <= 1; dz++) {
        for (let da = -1; da <= 1; da++) {
          const b = gen(iz + dz, ia + da).blocchi['erba']!;
          for (let i = 0; i < b.n; i++) {
            const x = b.m[i * 16 + 12]!;
            const y = b.m[i * 16 + 13]!;
            const zz = b.m[i * 16 + 14]!;
            const c = worldToCyl({ x, y, z: zz } as never);
            const nord = c.z - z;
            const est = (c.theta - theta) * (LAYOUT.cylinder.radius - quota) * DEG;
            const yr = 30 * DEG;
            const avanti = nord * Math.cos(yr) + est * Math.sin(yr);
            const destra = -nord * Math.sin(yr) + est * Math.cos(yr);
            const dentro = Math.abs(destra) < 4.5 - 0.45 && Math.abs(avanti) < 3.5 - 0.45;
            if (dentro) sopra.push(c.h);
            else if (Math.abs(destra) > 4.6 || Math.abs(avanti) > 3.6) {
              // fuori dal ripiano l'erba sta sul prato
              expect(Math.abs(c.h - (groundHeight(c.z, c.theta) - 0.03))).toBeLessThan(0.05);
              fuori++;
            }
          }
        }
      }
      expect(sopra.length).toBeGreaterThan(20);
      for (const h of sopra) expect(Math.abs(h - (quota - 0.03))).toBeLessThan(0.05);
      expect(fuori).toBeGreaterThan(50);
      s.group.traverse((o) => {
        if (o instanceof InstancedMesh) o.dispose();
      });
    } finally {
      RIPIANI_ERBOSI.delete('prova-suolo');
    }
  });
});
