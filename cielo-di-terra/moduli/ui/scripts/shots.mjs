// Schermate della demo dell'interfaccia: una per componente, a 1280×720 e a 1920×1080.
// Uso: npm run shots            (tutte)
//      npm run shots -- titolo  (solo i componenti indicati)
// Avvia da sé il server di Vite su una porta libera e salva in shots/<componente>-<larghezza>.png.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const qui = path.dirname(fileURLToPath(import.meta.url));
const radiceModulo = path.resolve(qui, '..');
const cartellaShots = path.join(radiceModulo, 'shots');

/** Componenti della demo: nome del file e parametro `c` della pagina. */
export const COMPONENTI = [
  'titolo',
  'titolo-conferma',
  'pausa',
  'impostazioni',
  'impostazioni-accessibilita',
  'dialogo',
  'dialogo-storico',
  'lettera',
  'libretto',
  'cartellino',
  'dattiloscritto',
  'taccuino',
  'taccuino-parole',
  'pianta',
  'pianta-zoom',
  'hud',
  'hud-notte',
  'squadro',
  'crediti',
  'caricamento',
  'testo-semplice',
];

const DIMENSIONI = [
  [1280, 720],
  [1920, 1080],
];

const scelti = process.argv.slice(2);
const lista = scelti.length ? COMPONENTI.filter((c) => scelti.some((s) => c === s || c.startsWith(s + '-'))) : COMPONENTI;

await mkdir(cartellaShots, { recursive: true });
const server = await createServer({
  root: radiceModulo,
  configFile: path.join(radiceModulo, 'vite.config.ts'),
  server: { port: 0, strictPort: false, host: '127.0.0.1' },
  logLevel: 'warn',
});
await server.listen();
const indirizzo = server.resolvedUrls?.local?.[0] ?? `http://127.0.0.1:${server.config.server.port}/`;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errori = [];
try {
  for (const [w, hgt] of DIMENSIONI) {
    const pagina = await browser.newPage({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1 });
    pagina.on('pageerror', (e) => errori.push(`${w}: ${e.message}`));
    pagina.on('console', (m) => {
      if (m.type() === 'error') errori.push(`${w} console: ${m.text()}`);
    });
    for (const c of lista) {
      await pagina.goto(`${indirizzo}?c=${encodeURIComponent(c)}`, { waitUntil: 'networkidle' });
      await pagina.waitForFunction(() => window.__UI_PRONTA__ === true, null, { timeout: 15000 });
      await pagina.waitForTimeout(700);
      const file = path.join(cartellaShots, `${c}-${w}.png`);
      await pagina.screenshot({ path: file });
      console.log('salvata', path.relative(radiceModulo, file));
    }
    await pagina.close();
  }
} finally {
  await browser.close();
  await server.close();
}
if (errori.length) {
  console.error('Errori nella pagina:\n' + errori.join('\n'));
  process.exitCode = 1;
}
