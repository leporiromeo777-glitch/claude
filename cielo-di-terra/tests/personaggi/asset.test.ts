/**
 * I GLB dei personaggi (public/personaggi, prodotti da tools/personaggi/processa.py) e il loro indice:
 * ci sono tutti i 13 della Fase 1, ognuno con le stesse 17 ossa, due livelli di dettaglio sullo stesso
 * scheletro, una texture JPEG, la geometria quantizzata, e stanno nei limiti di peso.
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { IndicePersonaggi } from '../../src/personaggi/indice';
import { NOMI_OSSA } from '../../src/personaggi/ossa';

const CARTELLA = join(__dirname, '..', '..', 'public', 'personaggi');
const indice = JSON.parse(readFileSync(join(CARTELLA, 'indice.json'), 'utf-8')) as IndicePersonaggi;

const FASE1 = ['ottavio', 'togna', 'bortolo', 'pina', 'annunciata', 'nando', 'clelia', 'lisa', 'gioanin', 'velata_donna', 'velato_gerla', 'velato_maschera', 'velato_cappuccio'];
const BAMBINI = new Set(['lisa', 'gioanin']);

interface Gltf {
  nodes: { name?: string }[];
  skins: { joints: number[] }[];
  meshes: { name: string; primitives: { attributes: Record<string, number> }[] }[];
  materials: { pbrMetallicRoughness?: { baseColorTexture?: unknown; metallicFactor?: number } }[];
  images: { mimeType?: string }[];
  extensionsUsed?: string[];
}

function jsonGlb(file: string): Gltf {
  const b = readFileSync(file);
  expect(b.readUInt32LE(0)).toBe(0x46546c67); // «glTF»
  const lung = b.readUInt32LE(12);
  expect(b.readUInt32LE(16)).toBe(0x4e4f534a); // blocco JSON
  return JSON.parse(b.subarray(20, 20 + lung).toString('utf-8')) as Gltf;
}

describe('personaggi: indice e GLB', () => {
  it('l\'indice elenca i 13 personaggi della Fase 1 con le ossa di NOMI_OSSA', () => {
    expect(indice.personaggi.map((p) => p.id).sort()).toEqual([...FASE1].sort());
    expect([...indice.ossa]).toEqual([...NOMI_OSSA]);
    for (const p of indice.personaggi) expect([...p.ossa]).toEqual([...NOMI_OSSA]);
  });

  it('altezze: adulti 1,50-1,82 m, bambini 1,10-1,25 m', () => {
    for (const p of indice.personaggi) {
      if (BAMBINI.has(p.id)) {
        expect(p.altezza, p.id).toBeGreaterThanOrEqual(1.1);
        expect(p.altezza, p.id).toBeLessThanOrEqual(1.25);
      } else {
        expect(p.altezza, p.id).toBeGreaterThanOrEqual(1.5);
        expect(p.altezza, p.id).toBeLessThanOrEqual(1.82);
      }
    }
  });

  it('peso: ogni GLB sotto 1,5 MB, tutti insieme sotto 18 MB', () => {
    let totale = 0;
    for (const p of indice.personaggi) {
      const kb = statSync(join(CARTELLA, p.file)).size;
      expect(kb, p.id).toBeLessThan(1.5 * 1024 * 1024);
      totale += kb;
    }
    expect(totale).toBeLessThan(18 * 1024 * 1024);
  });

  it.each(FASE1)('%s: 17 ossa, lod0 e lod1 skinned, una texture JPEG, quantizzato', (id) => {
    const voce = indice.personaggi.find((p) => p.id === id);
    expect(voce).toBeDefined();
    const g = jsonGlb(join(CARTELLA, (voce as { file: string }).file));
    // una skin per LOD (l'esportatore di Blender ne scrive una per mesh), sulle stesse ossa
    expect(g.skins.length).toBeGreaterThanOrEqual(1);
    for (const s of g.skins) {
      const ossa = s.joints.map((j) => g.nodes[j]?.name);
      expect(ossa.sort()).toEqual([...NOMI_OSSA].sort());
      expect([...s.joints].sort()).toEqual([...(g.skins[0] as { joints: number[] }).joints].sort());
    }
    expect(g.meshes.map((m) => m.name).sort()).toEqual(['lod0', 'lod1']);
    for (const m of g.meshes) {
      for (const pr of m.primitives) {
        expect(pr.attributes).toHaveProperty('JOINTS_0');
        expect(pr.attributes).toHaveProperty('WEIGHTS_0');
        expect(pr.attributes).toHaveProperty('TEXCOORD_0');
      }
    }
    expect(g.materials).toHaveLength(1);
    expect(g.materials[0]?.pbrMetallicRoughness?.baseColorTexture).toBeDefined();
    expect(g.materials[0]?.pbrMetallicRoughness?.metallicFactor ?? 1).toBe(0);
    expect(g.images).toHaveLength(1);
    expect(g.images[0]?.mimeType).toBe('image/jpeg');
    expect(g.extensionsUsed ?? []).toContain('KHR_mesh_quantization');
  });
});
