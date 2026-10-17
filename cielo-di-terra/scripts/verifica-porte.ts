/**
 * Inventario e verifica delle porte del paese (migliorie «porte»), in Node:
 *
 *   npx tsx scripts/verifica-porte.ts [--json=percorso] [--tutte]
 *
 * Costruisce Corbella sul banco di prova dei test (il paese segnaposto del motore, poi
 * `installaCorbella`), fa girare `verificaPorte` su tutte le porte posate (varianti mobili comprese)
 * e stampa il riassunto e l'elenco delle porte difettose. Con `--json` scrive anche l'inventario
 * completo con l'inquadratura di ogni porta (per `scripts/porte-schermate.mjs`).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { installaCorbella } from '../src/popolamento/index';
import type { PortaPosata } from '../src/popolamento/cantiere';
import { inventarioPorte, riassuntoPorte, verificaPaese } from '../src/popolamento/verificaPorte';
import { worldToCyl } from '../src/world/cylinder';
import { giocoFinto } from '../tests/popolamento/banco';
import { ultimoEsitoPorte } from '../src/popolamento/luoghi/case';

const args = process.argv.slice(2);
const json = args.find((a) => a.startsWith('--json='))?.split('=')[1];
const tutte = args.includes('--tutte');

const t0 = Date.now();
const g = giocoFinto(true);
const c = installaCorbella(g, { agganciaCiclo: false, luciAbitanti: false, orari: false });
const t1 = Date.now();
const lontane = c.porteLontane();
const esiti = verificaPaese(c, g.world.colliders);
const t2 = Date.now();

const r = riassuntoPorte(esiti);
console.log(`paese costruito in ${((t1 - t0) / 1000).toFixed(1)} s, verifica in ${((t2 - t1) / 1000).toFixed(1)} s`);
const perOggetto = new Map<string, number>();
for (const e of esiti) perOggetto.set(e.porta.oggetto, (perOggetto.get(e.porta.oggetto) ?? 0) + 1);
console.log(`porte: ${r.totale} (${[...perOggetto].map(([k, v]) => `${k} ${v}`).join(', ')}); versione lontana: ${lontane.porte.length}`);
const ep = ultimoEsitoPorte;
if (ep) console.log(`case: porte girate ${ep.porteGirate}, scale esterne girate ${ep.scaleGirate} e tolte ${ep.scaleTolte}, case spostate ${ep.caseSpostate}, girate verso monte ${ep.caseGirate}, tolte ${ep.caseTolte.length}${ep.caseTolte.length ? ` (${ep.caseTolte.join(' ')})` : ''}`);
console.log(`difettose: ${r.difettose}`);
for (const [k, v] of Object.entries(r)) if (k !== 'totale' && k !== 'difettose') console.log(`  ${k.padEnd(16)} ${v}`);
for (const e of esiti) {
  if (!e.difetti.length && !tutte) continue;
  const p = e.porta;
  console.log(
    `${p.id.padEnd(30)} ${p.oggetto.padEnd(10)} z ${e.soglia.z.toFixed(1)} θ ${e.soglia.theta.toFixed(2)} | ${e.difetti.join(', ') || 'ok'} | suolo ${e.suoloMin.toFixed(2)}…${e.suoloMax.toFixed(2)} a1,2 ${e.suolo120.toFixed(2)} | cop ${e.copertura.toFixed(2)} | ${e.ostacolo ?? ''} ${e.note.join('; ')}`,
  );
}
if (json) {
  const out = resolve(json);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ data: new Date().toISOString(), mondo: 'node', riassunto: r, porte: inventarioPorte(esiti, c.scalette(true)) }, null, 1));
  console.log(`inventario: ${out}`);
}
c.dispose();
