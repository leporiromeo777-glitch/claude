/**
 * I GLB veri dei personaggi (public/personaggi) caricati in Node per le prove di forma e di posa: il
 * GLTFLoader di three, con le immagini tolte dal JSON (in Node non c'è niente che decodifichi un JPEG;
 * per misurare la geometria e lo scheletro la texture non serve). La geometria quantizzata
 * (KHR_mesh_quantization) la legge GLTFLoader da solo.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { preparaPrototipo, type PrototipoPersonaggio } from '../../src/personaggi/precarica';
import { SCHEDE, leggiIndice } from '../../src/personaggi/schede';

export const CARTELLA_GLB = join(__dirname, '..', '..', 'public', 'personaggi');

/** Gli id dei 13 modelli, nell'ordine dell'indice. */
export const MODELLI: readonly string[] = leggiIndice(JSON.parse(readFileSync(join(CARTELLA_GLB, 'indice.json'), 'utf-8'))).map((v) => v.id);

/** Il GLB senza immagini, texture e campionatori (un GLB valido da dare a GLTFLoader.parse). */
function senzaImmagini(buf: Buffer): ArrayBuffer {
  const lungJson = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + lungJson).toString('utf-8')) as Record<string, unknown> & {
    materials?: { pbrMetallicRoughness?: Record<string, unknown> }[];
  };
  delete json['images'];
  delete json['textures'];
  delete json['samplers'];
  for (const m of json.materials ?? []) if (m.pbrMetallicRoughness) delete m.pbrMetallicRoughness['baseColorTexture'];
  let testo = JSON.stringify(json);
  while (Buffer.byteLength(testo) % 4) testo += ' ';
  const j = Buffer.from(testo, 'utf-8');
  const resto = buf.subarray(20 + lungJson);
  const totale = 12 + 8 + j.length + resto.length;
  const out = Buffer.alloc(totale);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(totale, 8);
  out.writeUInt32LE(j.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  j.copy(out, 20);
  resto.copy(out, 20 + j.length);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}

const cache = new Map<string, Promise<THREE.Object3D>>();

/** La scena del GLB di `id` (una copia nuova a ogni chiamata: SkeletonUtils non serve, si riparsa). */
export function scenaGlb(id: string): Promise<THREE.Object3D> {
  let p = cache.get(id);
  if (!p) {
    const dati = senzaImmagini(readFileSync(join(CARTELLA_GLB, `${id}.glb`)));
    p = new GLTFLoader().parseAsync(dati, '').then((g) => g.scene);
    cache.set(id, p);
    // il risultato si usa una volta: la prossima chiamata riparsa (scene indipendenti)
    void p.then(() => cache.delete(id));
  }
  return p;
}

/** Il prototipo pronto (come nel gioco) del modello `id`. */
export async function prototipoGlb(id: string): Promise<PrototipoPersonaggio> {
  const scena = await scenaGlb(id);
  return preparaPrototipo(id, scena, SCHEDE[id]);
}
