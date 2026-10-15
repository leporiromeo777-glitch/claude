// Schermate della vetrina con Playwright (Chromium headless, WebGL2 via SwiftShader).
// Uso: node scripts/schermate.mjs [vista1 vista2 ...] [--solo-misure] [--larghezza=1600 --altezza=900]
// Salva le PNG in shots/ e le misure (triangoli e draw call per oggetto) in shots/misure.json e shots/misure.md.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const qui = dirname(fileURLToPath(import.meta.url));
const radice = join(qui, '..');
const cartella = join(radice, 'shots');

const argomenti = process.argv.slice(2);
const soloMisure = argomenti.includes('--solo-misure');
const senzaMisure = argomenti.includes('--senza-misure');
const opzione = (nome, predefinito) => {
  const a = argomenti.find((x) => x.startsWith(`--${nome}=`));
  return a ? a.split('=')[1] : predefinito;
};
const larghezza = Number(opzione('larghezza', '1600'));
const altezza = Number(opzione('altezza', '900'));
const richieste = argomenti.filter((a) => !a.startsWith('--'));

await mkdir(cartella, { recursive: true });

const server = await createServer({ configFile: join(radice, 'vite.config.ts'), server: { port: 5182, strictPort: false }, logLevel: 'error' });
await server.listen();
const indirizzo = server.resolvedUrls.local[0];

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const pagina = await browser.newPage({ viewport: { width: larghezza, height: altezza } });
const errori = [];
pagina.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errori.push(`[${m.type()}] ${m.text()}`);
});
pagina.on('pageerror', (e) => errori.push(`[pageerror] ${e.message}`));

async function apri(query) {
  await pagina.goto(`${indirizzo}?${query}`, { waitUntil: 'load' });
  await pagina.waitForFunction(() => window.__pronto === true, null, { timeout: 180000 });
}

try {
  // elenco delle viste dalla pagina stessa
  await apri('vista=insieme&fermo=1&elenco=1');
  const tutte = await pagina.evaluate(() => window.__viste ?? ['insieme']);
  const viste = richieste.length ? richieste : tutte;

  if (!soloMisure) {
    for (const v of viste) {
      const t0 = Date.now();
      await apri(`vista=${v}&fermo=1`);
      await pagina.waitForTimeout(150);
      await pagina.screenshot({ path: join(cartella, `${v}.png`) });
      console.log(`schermata ${v}.png (${Date.now() - t0} ms)`);
    }
  }

  if (!senzaMisure && (soloMisure || richieste.length === 0)) {
    await apri('vista=misure&fermo=1');
    const misure = await pagina.evaluate(() => window.__misure());
    await writeFile(join(cartella, 'misure.json'), JSON.stringify(misure, null, 2));
    const righe = ['| oggetto | triangoli | draw call | mesh | note |', '|---|---:|---:|---:|---|'];
    for (const m of misure) righe.push(`| ${m.nome} | ${m.triangoli} | ${m.drawCall} | ${m.mesh} | ${m.note ?? ''} |`);
    await writeFile(join(cartella, 'misure.md'), righe.join('\n') + '\n');
    console.log(righe.join('\n'));
  }
} finally {
  if (errori.length) {
    console.log('\nMessaggi della console:');
    for (const e of [...new Set(errori)].slice(0, 30)) console.log('  ' + e);
  }
  await browser.close();
  await server.close();
}
