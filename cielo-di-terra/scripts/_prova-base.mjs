// Base temporanea per le prove mirate (NON committare).
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

function serve(dir, port) {
  const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' };
  const server = createServer((req, res) => {
    let p = normalize(join(dir, decodeURIComponent((req.url || '/').split('?')[0])));
    if (!p.startsWith(dir)) return res.writeHead(403).end();
    if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
    if (!existsSync(p)) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': tipi[extname(p)] || 'application/octet-stream' });
    createReadStream(p).pipe(res);
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

export async function avvia() {
  const port = 4900 + Math.floor(Math.random() * 300);
  const server = await serve(join(root, 'dist-e2e'), port);
  const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.stack || e}`));
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__?.regia, null, { timeout: 300000 });
  await page.evaluate(() => window.__GAME__.stopLoop());
  const R = (fn, arg) => page.evaluate(fn, arg);
  const fine = async () => {
    const errori = logs.filter((l) => /pageerror|\[error\]/i.test(l));
    if (errori.length) console.log('ERRORI:\n' + errori.slice(0, 10).join('\n'));
    await browser.close();
    server.close();
  };
  return { page, R, logs, fine };
}
