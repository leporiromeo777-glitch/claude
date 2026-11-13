#!/usr/bin/env node
// Unisce stile, script e contenuti in un solo file:
//   dist/index.html      pagina completa (si apre anche con un doppio clic, si pubblica ovunque)
//   dist/artifact.html   la stessa pagina senza <html>/<head>/<body>, per gli Artifact di Claude
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validaTutto, CATEGORIE } from './valida.mjs';

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leggi = (p) => readFileSync(join(RADICE, p), 'utf8');

// «node scripts/build.mjs --solo 00-esempi.json» costruisce la pagina con un solo file di contenuti (per le prove).
const solo = process.argv.includes('--solo') ? process.argv[process.argv.indexOf('--solo') + 1] : null;
let { tutti, problemi } = validaTutto(solo ?? undefined);
if (solo) tutti = tutti.filter((f) => f.nome === solo);
if (problemi.length) {
  console.error(problemi.join('\n'));
  console.error(`\n✗ ${problemi.length} problemi nei contenuti: build interrotta`);
  process.exit(1);
}
const video = tutti.flatMap((f) => f.video);

const stile = leggi('src/stile.css');
const script = readdirSync(join(RADICE, 'src/js')).filter((f) => f.endsWith('.js')).sort()
  .map((f) => `// ---- ${f}\n${leggi('src/js/' + f)}`).join('\n');
const dati = JSON.stringify({ categorie: CATEGORIE, video }).replace(/</g, '\\u003c');

// Le sostituzioni usano una funzione: così i «$» dentro script e dati non vengono interpretati.
const pagina = leggi('src/pagina.html')
  .replace('/*STILE*/', () => stile)
  .replace('/*DATI*/', () => dati)
  .replace('/*SCRIPT*/', () => `(() => {\n'use strict';\n${script}\n})();`);

const [testa, corpo] = pagina.split('<!--CORPO-->');
const completa = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}</style>
${testa.trim()}
</head>
<body>
${corpo.trim()}
</body>
</html>
`;

mkdirSync(join(RADICE, 'dist'), { recursive: true });
writeFileSync(join(RADICE, 'dist/index.html'), completa);
writeFileSync(join(RADICE, 'dist/artifact.html'), `${testa.trim()}\n${corpo.trim()}\n`);

const libri = new Set(video.map((v) => v.libro.titolo)).size;
const kb = (Buffer.byteLength(completa) / 1024).toFixed(0);
console.log(`✓ ${video.length} video da ${libri} libri → dist/index.html (${kb} KB)`);
