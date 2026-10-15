// Lato Node del banco di prova offline: impacchetta test/offline/banco.ts con esbuild,
// apre Chromium headless con Playwright e rende i suoni con OfflineAudioContext.
// Uso da riga di comando:  node strumenti/banco.mjs [--wav] [id ...]
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Impacchetta il banco in un unico script IIFE. */
export async function impacchetta() {
  const r = await build({
    entryPoints: [path.join(radice, 'test/offline/banco.ts')],
    bundle: true,
    format: 'iife',
    target: 'es2022',
    write: false,
    logLevel: 'silent',
  });
  return r.outputFiles[0].text;
}

/** Apre Chromium e restituisce { pagina, chiudi }. */
export async function apriBanco() {
  const codice = await impacchetta();
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const pagina = await browser.newPage();
  const errori = [];
  pagina.on('pageerror', (e) => errori.push(String(e)));
  pagina.on('console', (m) => {
    if (m.type() === 'error') errori.push(m.text());
  });
  await pagina.setContent('<!doctype html><meta charset="utf-8"><title>banco audio</title>');
  await pagina.addScriptTag({ content: codice });
  return {
    pagina,
    errori,
    elenco: () => pagina.evaluate(() => window.bancoAudio.elenco()),
    rendi: (id, opz = {}) => pagina.evaluate(([i, o]) => window.bancoAudio.rendi(i, o), [id, opz]),
    cicloDiVita: () => pagina.evaluate(() => window.bancoAudio.provaCicloDiVita()),
    chiudi: () => browser.close(),
  };
}

function riga(m) {
  const f = (x, n = 6) => String(x).padStart(n);
  return `${m.id.padEnd(22)} picco ${f(m.piccoDb)} dB  rms ${f(m.rmsDb)} dB  attivo ${f(m.rmsAttivoDb)} dB  acuti ${f((m.acuti * 100).toFixed(1))}%  ${f(m.msRendering, 5)} ms`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const wav = args.includes('--wav');
  const opzStrati = args.find((a) => a.startsWith('--strati='));
  const strati = opzStrati ? opzStrati.slice('--strati='.length).split(',') : undefined;
  const ids = args.filter((a) => !a.startsWith('--'));
  const banco = await apriBanco();
  const tutte = ids.length ? ids : await banco.elenco();
  const cartella = path.join(radice, 'risultati');
  await mkdir(cartella, { recursive: true });
  const misure = [];
  for (const id of tutte) {
    const m = await banco.rendi(id, { wav, ...(strati ? { strati } : {}) });
    if (strati) m.id = `${m.id}[${strati.join('+')}]`;
    if (m.wav) {
      await writeFile(path.join(cartella, `${m.id}.wav`), Buffer.from(m.wav, 'base64'));
      delete m.wav;
    }
    misure.push(m);
    console.log(riga(m));
  }
  await writeFile(path.join(cartella, 'misure.json'), JSON.stringify(misure, null, 2));
  if (banco.errori.length) console.log('Errori nella pagina:\n' + banco.errori.join('\n'));
  await banco.chiudi();
}
