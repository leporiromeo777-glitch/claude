/**
 * Traccia «luce»: migrazione delle impostazioni, nucleo della Linea e direzione della luce,
 * superfici, materiale del mondo, scelta di chi proietta ombra.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { BoxGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial, Scene, ShaderMaterial, Vector3, type DepthTexture, type WebGLRenderer } from 'three';
import { DEFAULT_SETTINGS, LEGACY_SETTINGS_KEYS, SETTINGS_KEY, SETTINGS_VERSION, loadSettings, migraImpostazioni, saveSettings } from '../src/core/settings';
import { CORE_Z_EVENING, CORE_Z_MORNING, computeSky, keyLightDir } from '../src/world/sky';
import { cylToWorld, upAt } from '../src/world/cylinder';
import { L, LAYOUT } from '../src/world/constants';
import { SUPERFICIE, leggiSuperficie, superficieAutomatica, taggaSuperficie } from '../src/render/superfici';
import { createWorldMaterial, impostaSuperficieBase } from '../src/render/worldMaterial';
import { applySky, createWorldUniforms } from '../src/render/uniforms';
import { LAYER_OMBRE, Ombre } from '../src/render/ombre';

class MemoriaFinta {
  dati = new Map<string, string>();
  getItem(k: string): string | null {
    return this.dati.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.dati.set(k, v);
  }
  removeItem(k: string): void {
    this.dati.delete(k);
  }
}

const g = globalThis as unknown as { localStorage?: MemoriaFinta };

describe('impostazioni: nuovo raggio dipinto e migrazione', () => {
  afterEach(() => {
    delete g.localStorage;
  });

  it('il raggio sempre dipinto è più largo di prima', () => {
    expect(DEFAULT_SETTINGS.nearPaint[0]).toBeGreaterThanOrEqual(200);
    expect(DEFAULT_SETTINGS.nearPaint[1]).toBeGreaterThan(DEFAULT_SETTINGS.nearPaint[0]);
    expect(SETTINGS_VERSION).toBe(2);
  });

  it('da v1 butta il vecchio nearPaint e tiene il resto', () => {
    const m = migraImpostazioni({ fov: 82, nearPaint: [70, 150], invertY: true }, 1);
    expect(m.fov).toBe(82);
    expect(m.invertY).toBe(true);
    expect(m.nearPaint).toBeUndefined();
  });

  it('in v2 un nearPaint scelto resta, uno rotto si scarta', () => {
    expect(migraImpostazioni({ versione: 2, nearPaint: [120, 300] }).nearPaint).toEqual([120, 300]);
    expect(migraImpostazioni({ versione: 2, nearPaint: [300, 100] }).nearPaint).toBeUndefined();
    expect(migraImpostazioni({ versione: 2, nearPaint: 'x' }).nearPaint).toBeUndefined();
    expect(migraImpostazioni(null)).toEqual({});
  });

  it('loadSettings legge la chiave v1, migra e riscrive in v2', () => {
    const mem = new MemoriaFinta();
    mem.setItem(LEGACY_SETTINGS_KEYS[1]!, JSON.stringify({ ...DEFAULT_SETTINGS, fov: 77, nearPaint: [70, 150] }));
    g.localStorage = mem;
    const s = loadSettings();
    expect(s.fov).toBe(77);
    expect(s.nearPaint).toEqual(DEFAULT_SETTINGS.nearPaint);
    const salvato = JSON.parse(mem.getItem(SETTINGS_KEY)!) as { versione: number; nearPaint: number[] };
    expect(salvato.versione).toBe(2);
    expect(salvato.nearPaint).toEqual(DEFAULT_SETTINGS.nearPaint);
  });

  it('saveSettings + loadSettings: andata e ritorno in v2', () => {
    const mem = new MemoriaFinta();
    g.localStorage = mem;
    saveSettings({ ...DEFAULT_SETTINGS, nearPaint: [6, 14], headBob: true });
    const s = loadSettings();
    expect(s.nearPaint).toEqual([6, 14]);
    expect(s.headBob).toBe(true);
  });

  it('senza archivio: i valori predefiniti', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('il nucleo della Linea scorre lungo l asse', () => {
  it('da sud al mattino a nord la sera', () => {
    const m = computeSky(7);
    const n = computeSky(12.75);
    const e = computeSky(19);
    expect(m.coreZ).toBeLessThan(0.2 * L);
    expect(n.coreZ).toBeGreaterThan(0.4 * L);
    expect(n.coreZ).toBeLessThan(0.6 * L);
    expect(e.coreZ).toBeGreaterThan(0.85 * L);
    expect(m.coreZ).toBeGreaterThanOrEqual(CORE_Z_MORNING - 1);
    expect(e.coreZ).toBeLessThanOrEqual(CORE_Z_EVENING + 1);
  });

  it('all alba sta sulla miccia, al tramonto segue la brace', () => {
    const alba = computeSky(5.55);
    expect(alba.coreZ).toBeLessThanOrEqual(alba.lineaIgnite + 1e-6);
    const sera = computeSky(20.4);
    expect(sera.coreZ).toBeLessThan(sera.lineaIgnite);
  });

  it('a Corbella la luce del mattino è radente e viene da sud, a mezzogiorno è alta', () => {
    const c = LAYOUT.villages[0]!;
    const P = cylToWorld(c.zCenter, c.thetaCenter, 60);
    const up = upAt(c.thetaCenter);
    const elev = (h: number) => {
      const d = keyLightDir(P.x, P.y, P.z, computeSky(h));
      return { el: Math.asin(new Vector3(d.x, d.y, d.z).dot(up)), z: d.z };
    };
    const mattino = elev(7);
    const mezzodi = elev(11.5);
    expect(mattino.z).toBeLessThan(0); // da sud
    expect((mattino.el * 180) / Math.PI).toBeLessThan(35);
    expect((mezzodi.el * 180) / Math.PI).toBeGreaterThan(55);
  });

  it('applySky porta il nucleo, la foschia e l ora negli uniform', () => {
    const u = createWorldUniforms();
    const s = computeSky(7);
    applySky(u, s);
    expect(u.uSole.value.x).toBeCloseTo(s.coreZ, 6);
    expect(u.uSole.value.y).toBeCloseTo(s.coreFlat, 6);
    expect(u.uGolden.value).toBeCloseTo(s.golden, 6);
    expect(u.uHazeZenith.value.x).toBeCloseTo(s.hazeZenith[0], 6);
  });
});

describe('superfici', () => {
  it('taggaSuperficie scrive tipo, variante e occlusione su un intervallo', () => {
    const geo = new BoxGeometry(1, 1, 1).toNonIndexed();
    const n = geo.getAttribute('position').count;
    taggaSuperficie(geo, SUPERFICIE.PIETRA, { a: 6, variante: 0.3, occlusione: 0.2 });
    taggaSuperficie(geo, SUPERFICIE.PIODE, { da: 6 });
    const a = geo.getAttribute('aSuperficie');
    expect(a.itemSize).toBe(2);
    expect(a.count).toBe(n);
    expect(leggiSuperficie(a.getX(0))).toEqual({ tipo: SUPERFICIE.PIETRA, variante: expect.closeTo(0.3, 5), dichiarata: true });
    expect(a.getY(0)).toBeCloseTo(0.2, 6);
    expect(leggiSuperficie(a.getX(7)).tipo).toBe(SUPERFICIE.PIODE);
    expect(a.getY(7)).toBe(0);
  });

  it('NESSUNA si può dichiarare (diverso da "non taggato", che prende la superficie del materiale)', () => {
    const geo = new BoxGeometry(1, 1, 1).toNonIndexed();
    taggaSuperficie(geo, SUPERFICIE.NESSUNA, { a: 3 });
    const a = geo.getAttribute('aSuperficie');
    expect(leggiSuperficie(a.getX(0))).toMatchObject({ tipo: SUPERFICIE.NESSUNA, dichiarata: true });
    expect(leggiSuperficie(a.getX(5))).toMatchObject({ tipo: SUPERFICIE.NESSUNA, dichiarata: false });
  });

  it('AUTO deduce il tipo dal colore dei segnaposto', () => {
    const c = (h: number): [number, number, number] => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
    expect(superficieAutomatica(c(0xa7a39b), 0)).toBe(SUPERFICIE.PIETRA); // gneiss
    expect(superficieAutomatica(c(0xb0a491), 0)).toBe(SUPERFICIE.PIETRA); // gneiss caldo
    expect(superficieAutomatica(c(0x4a4c56), 0.7)).toBe(SUPERFICIE.PIODE); // ardesia sul tetto
    expect(superficieAutomatica(c(0x4a4c56), 0)).toBe(SUPERFICIE.PIETRA); // ardesia in piedi
    expect(superficieAutomatica(c(0xf1ebde), 0)).toBe(SUPERFICIE.INTONACO); // calce
    expect(superficieAutomatica(c(0xd9d0bd), 1)).toBe(SUPERFICIE.PIETRA); // ciottoli chiari del selciato
    expect(superficieAutomatica(c(0x2c2830), 1)).toBe(SUPERFICIE.PIETRA); // linea scura della meridiana
    expect(superficieAutomatica(c(0x7a5236), 0)).toBe(SUPERFICIE.LEGNO);
    expect(superficieAutomatica(c(0x7d9a4b), 1)).toBe(SUPERFICIE.ERBA);
    expect(superficieAutomatica(c(0x678a3c), 0)).toBe(SUPERFICIE.FOGLIAME);
    expect(superficieAutomatica(c(0x2a2c30), 0, 1)).toBe(SUPERFICIE.VETRO); // finestra che si accende
    // colori vivi (ottone, gerani, foglie d'autunno, palina): nessun motivo, restano come sono
    expect(superficieAutomatica(c(0xc9a24a), 0)).toBe(SUPERFICIE.NESSUNA);
    expect(superficieAutomatica(c(0xc7362b), 0)).toBe(SUPERFICIE.NESSUNA);
    expect(superficieAutomatica(c(0xc2802b), 0)).toBe(SUPERFICIE.NESSUNA);
  });

  it('i valori dell enum sono interi distinti, 0 = nessuna', () => {
    const v = Object.values(SUPERFICIE);
    expect(new Set(v).size).toBe(v.length);
    expect(SUPERFICIE.NESSUNA).toBe(0);
    for (const x of v) expect(Number.isInteger(x)).toBe(true);
  });

  it('il materiale del mondo dichiara aSuperficie (0 se manca) e la superficie predefinita', () => {
    const u = createWorldUniforms();
    const m = createWorldMaterial(u, { kind: 'object', superficie: SUPERFICIE.FOGLIAME });
    expect((m.defaultAttributeValues as Record<string, number[]>)['aSuperficie']).toEqual([0, 0]);
    expect(m.uniforms['uSuperficieBase']!.value).toBe(SUPERFICIE.FOGLIAME);
    expect(m.vertexShader).toContain('aSuperficie');
    expect(m.vertexShader).toContain('skinning_pars_vertex');
    impostaSuperficieBase(m, SUPERFICIE.CORTECCIA);
    expect(m.uniforms['uSuperficieBase']!.value).toBe(SUPERFICIE.CORTECCIA);
    // gli uniform condivisi sono gli stessi oggetti (un solo aggiornamento per tutti)
    expect(m.uniforms['uSole']).toBe(u.uSole);
    expect(m.fragmentShader).toContain('uOmbraMappa');
  });
});

describe('ombre: chi proietta', () => {
  const finto = {} as WebGLRenderer;

  it('mette sul layer le mesh opache, non trasparenti, Linea, castagni lontani, terreno', () => {
    const u = createWorldUniforms();
    const scene = new Scene();
    const opaco = new MeshBasicMaterial();
    const trasp = new MeshBasicMaterial({ transparent: true });
    const casa = new Mesh(new BoxGeometry(), opaco);
    casa.name = 'corbella:case:1';
    const vetro = new Mesh(new BoxGeometry(), trasp);
    const linea = new Group();
    linea.name = 'linea';
    const nucleo = new Mesh(new BoxGeometry(), opaco);
    linea.add(nucleo);
    const lontani = new InstancedMesh(new BoxGeometry(), opaco, 4);
    lontani.name = 'castagni-chioma-lod2';
    const vicini = new InstancedMesh(new BoxGeometry(), opaco, 4);
    vicini.name = 'castagni-chioma-lod0';
    const terreno = new Mesh(new BoxGeometry(), new ShaderMaterial());
    terreno.name = 'terreno-3-1-lod0';
    const escluso = new Mesh(new BoxGeometry(), opaco);
    escluso.userData['ombra'] = false;
    scene.add(casa, vetro, linea, lontani, vicini, terreno, escluso);
    const o = new Ombre(finto, scene, new Group() as never, u, 'media');
    o.scansiona();
    expect(casa.layers.isEnabled(LAYER_OMBRE)).toBe(true);
    expect(vicini.layers.isEnabled(LAYER_OMBRE)).toBe(true);
    expect(vetro.layers.isEnabled(LAYER_OMBRE)).toBe(false);
    expect(nucleo.layers.isEnabled(LAYER_OMBRE)).toBe(false);
    expect(lontani.layers.isEnabled(LAYER_OMBRE)).toBe(false);
    expect(terreno.layers.isEnabled(LAYER_OMBRE)).toBe(false);
    expect(escluso.layers.isEnabled(LAYER_OMBRE)).toBe(false);
    // la camera principale non vede il layer delle ombre: nulla cambia nel disegno del mondo
    expect(casa.layers.isEnabled(0)).toBe(true);
    expect(o.stats.proiettori).toBe(2);
  });

  it('spente: niente mappa e uOmbra.x = 0 anche dopo render()', () => {
    const u = createWorldUniforms();
    const o = new Ombre(finto, new Scene(), new Group() as never, u, 'spente');
    o.render();
    expect(u.uOmbra.value.x).toBe(0);
    o.impostaQualita('bassa');
    expect(o.qualita).toBe('bassa');
    o.attive = false;
    o.render();
    expect(u.uOmbra.value.x).toBe(0);
  });

  it('il sampler delle ombre ha sempre una mappa di profondità con confronto (mai null)', () => {
    // con null three.js lega una texture RGBA e WebGL2 rifiuta tutte le draw del mondo
    const u = createWorldUniforms();
    const vuota = u.uOmbraMappa.value as DepthTexture;
    expect(vuota.isDepthTexture).toBe(true);
    expect(vuota.compareFunction).not.toBeNull();
    expect(vuota.version).toBeGreaterThan(0); // si alloca al primo uso
    const o = new Ombre(finto, new Scene(), new Group() as never, u, 'alta');
    expect(u.uOmbraMappa.value).toBe(vuota); // prima del primo passaggio (o di notte)
    u.uNight.value = 1;
    o.render();
    expect(u.uOmbraMappa.value).toBe(vuota);
    o.impostaQualita('spente');
    expect(u.uOmbraMappa.value).toBe(vuota);
    o.impostaQualita('media');
    expect(u.uOmbraMappa.value).toBe(vuota);
    o.dispose();
    expect(u.uOmbraMappa.value).toBe(vuota);
  });
});
