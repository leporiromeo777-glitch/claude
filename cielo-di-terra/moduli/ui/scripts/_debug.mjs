import { createServer } from 'vite';
import { chromium } from 'playwright';
const root = process.cwd();
const server = await createServer({ root, configFile: root + '/vite.config.ts', server: { port: 0, host: '127.0.0.1' }, logLevel: 'warn' });
await server.listen();
const url = server.resolvedUrls.local[0];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(url + '?c=impostazioni-accessibilita', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__UI_PRONTA__ === true);
const info = await p.evaluate(() => {
  const f = document.querySelector('.ui-imp-foglio');
  const out = [];
  let el = f;
  while (el) { const r = el.getBoundingClientRect(); out.push([el.className || el.tagName, Math.round(r.top), Math.round(r.height), el.scrollTop, getComputedStyle(el).overflow]); el = el.parentElement; }
  const c = document.querySelector('.ui-imp-corpo');
  return { out, corpo: [c.scrollHeight, c.clientHeight, getComputedStyle(c).minHeight, getComputedStyle(f).display, getComputedStyle(f).maxHeight] };
});
console.log(JSON.stringify(info, null, 1));
await b.close(); await server.close();
