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
import { inquadraturaPorta, riassuntoPorte, verificaPaese } from '../src/popolamento/verificaPorte';
import { worldToCyl } from '../src/world/cylinder';
import { giocoFinto } from '../tests/popolamento/banco';

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
/** (z, θ, h) del punto a `d` m davanti alla soglia e `su` m sopra (per le prove a piedi nel browser) */
const davanti = (p: PortaPosata, d: number, su = 0) => {
  const q = worldToCyl(p.centro.clone().addScaledVector(p.normale, d).addScaledVector(p.su, su));
  return { z: q.z, theta: q.theta, h: q.h };
};
console.log(`paese costruito in ${((t1 - t0) / 1000).toFixed(1)} s, verifica in ${((t2 - t1) / 1000).toFixed(1)} s`);
const perOggetto = new Map<string, number>();
for (const e of esiti) perOggetto.set(e.porta.oggetto, (perOggetto.get(e.porta.oggetto) ?? 0) + 1);
console.log(`porte: ${r.totale} (${[...perOggetto].map(([k, v]) => `${k} ${v}`).join(', ')}); versione lontana: ${lontane.porte.length}`);
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
  writeFileSync(
    out,
    JSON.stringify(
      {
        data: new Date().toISOString(),
        riassunto: r,
        porte: esiti.map((e) => ({
          id: e.porta.id,
          oggetto: e.porta.oggetto,
          proprietario: e.porta.proprietario,
          zona: e.porta.zona,
          variante: e.porta.variante ?? null,
          appoggio: e.porta.appoggio,
          soglia: e.soglia,
          difetti: e.difetti,
          suoloMin: +e.suoloMin.toFixed(3),
          suoloMax: +e.suoloMax.toFixed(3),
          suolo120: +e.suolo120.toFixed(3),
          copertura: e.copertura,
          complanare: e.complanare,
          ostacolo: e.ostacolo ?? null,
          note: e.note,
          inquadratura: inquadraturaPorta(e.porta),
          // a 7, 3 e 0,6 m davanti alla soglia, e il centro del battente
          davanti: { a7: davanti(e.porta, 7), a3: davanti(e.porta, 3), soglia: davanti(e.porta, 0.6) },
          battente: davanti(e.porta, e.porta.battente, e.porta.altezza * 0.55),
        })),
      },
      null,
      1,
    ),
  );
  console.log(`inventario: ${out}`);
}
c.dispose();
