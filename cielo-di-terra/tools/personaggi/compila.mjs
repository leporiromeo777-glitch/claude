#!/usr/bin/env node
/**
 * Compila nel browser (Chromium headless, WebGL2 via SwiftShader) il materiale del mondo dei personaggi
 * con i pezzi GLSL di common.ts del ramo corrente e, con --ramo=<nome>, di un altro ramo (per esempio
 * il rifacimento grafico): dice subito se una firma usata dal materiale è cambiata.
 *
 *   node tools/personaggi/compila.mjs [--ramo=grafica/luce]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const radice = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=') || '1'];
  }),
);
const casi = [{ nome: 'questo ramo', common: '/src/render/shaders/common.ts' }];
const tmp = join(radice, 'tools', 'personaggi', '_common');
if (args.ramo) {
  mkdirSync(tmp, { recursive: true });
  const testo = execFileSync('git', ['show', `${args.ramo}:cielo-di-terra/src/render/shaders/common.ts`], { cwd: radice, encoding: 'utf8' });
  const nome = `${args.ramo.replace(/[^a-z0-9]+/gi, '-')}.ts`;
  writeFileSync(join(tmp, nome), testo);
  casi.push({ nome: args.ramo, common: `/tools/personaggi/_common/${nome}` });
}
const moduli = realpathSync(join(radice, 'node_modules'));
const porta = 5180 + Math.floor(Math.random() * 9);
const server = await createServer({
  root: radice,
  logLevel: 'error',
  server: { port: porta, host: '127.0.0.1', hmr: false, fs: { allow: [radice, moduli] } },
  optimizeDeps: { include: ['three'] },
});
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let tuttoBene = true;
try {
  for (const c of casi) {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${porta}/tools/personaggi/compila.html?common=${encodeURIComponent(c.common)}`);
    await page.waitForFunction(() => !!window.__COMPILA__, null, { timeout: 300000 });
    const e = await page.evaluate(() => window.__COMPILA__);
    tuttoBene &&= e.ok;
    console.log(`${c.nome}: ${e.ok ? 'compila' : 'NON COMPILA'}${e.avvisi.length ? ` (${e.avvisi.join('; ')})` : ''}`);
    for (const r of e.errori) console.log(r.split('\n').slice(0, 12).join('\n'));
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
  if (args.ramo) rmSync(tmp, { recursive: true, force: true });
}
process.exit(tuttoBene ? 0 : 1);
