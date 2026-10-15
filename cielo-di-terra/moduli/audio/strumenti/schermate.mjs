// Schermate della pagina demo (desktop e telefono) con Chromium headless.
// Uso: npm run build:demo && node strumenti/schermate.mjs
import { preview } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = await preview({ configFile: path.join(radice, 'vite.config.ts'), preview: { port: 5179, strictPort: true } });
const indirizzo = 'http://localhost:5179/';
const cartella = path.join(radice, 'risultati', 'schermate');
await mkdir(cartella, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const errori = [];
for (const [nome, viewport, tema] of [
  ['desktop', { width: 1280, height: 1100 }, 'light'],
  ['desktop-scuro', { width: 1280, height: 1100 }, 'dark'],
  ['telefono', { width: 390, height: 1400 }, 'light'],
]) {
  const pagina = await browser.newPage({ viewport, colorScheme: tema });
  pagina.on('pageerror', (e) => errori.push(`${nome}: ${e}`));
  pagina.on('console', (m) => m.type() === 'error' && errori.push(`${nome}: ${m.text()}`));
  await pagina.goto(indirizzo);
  await pagina.click('#avvia');
  await pagina.getByRole('button', { name: 'Alba nelle Selve' }).click();
  await pagina.waitForTimeout(600);
  await pagina.getByRole('button', { name: 'inchiostro che si spande' }).click();
  await pagina.getByRole('button', { name: 'un rintocco' }).click();
  await pagina.waitForTimeout(900);
  await pagina.screenshot({ path: path.join(cartella, `${nome}.png`), fullPage: true });
  const larghezza = await pagina.evaluate(() => document.documentElement.scrollWidth);
  if (larghezza > viewport.width) errori.push(`${nome}: scorrimento orizzontale (${larghezza}px)`);
  await pagina.close();
}
await browser.close();
await new Promise((r) => server.httpServer.close(r));
console.log(errori.length ? errori.join('\n') : 'nessun errore');
