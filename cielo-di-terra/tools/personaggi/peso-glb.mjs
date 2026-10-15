#!/usr/bin/env node
/**
 * Quanto pesa ogni parte di un GLB (immagini, attributi per mesh), per decidere dove risparmiare.
 *   node tools/personaggi/peso-glb.mjs file.glb [altri.glb]
 */
import { readFileSync } from 'node:fs';

for (const file of process.argv.slice(2)) {
  const buf = readFileSync(file);
  const lenJson = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + lenJson).toString('utf8'));
  const bv = json.bufferViews ?? [];
  const righe = [];
  for (const [i, im] of (json.images ?? []).entries()) righe.push([`immagine ${i} ${im.mimeType}`, bv[im.bufferView]?.byteLength ?? 0]);
  for (const m of json.meshes ?? []) {
    for (const p of m.primitives) {
      for (const [nome, acc] of Object.entries(p.attributes)) {
        const a = json.accessors[acc];
        righe.push([`${m.name}.${nome} (${a.count} ${a.type} ${a.componentType})`, bv[a.bufferView]?.byteLength ?? 0]);
      }
      if (p.indices !== undefined) {
        const a = json.accessors[p.indices];
        righe.push([`${m.name}.indici (${a.count})`, bv[a.bufferView]?.byteLength ?? 0]);
      }
    }
  }
  const tot = buf.length;
  console.log(`\n${file}: ${(tot / 1024).toFixed(0)} KB, estensioni ${JSON.stringify(json.extensionsUsed ?? [])}, ossa ${json.skins?.[0]?.joints.length ?? 0}`);
  for (const [n, b] of righe) console.log(`  ${(b / 1024).toFixed(1).padStart(7)} KB  ${n}`);
}
