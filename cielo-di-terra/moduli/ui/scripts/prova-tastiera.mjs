// Prova di fumo nel browser vero: navigazione con la tastiera fra titolo, pausa, taccuino, Pianta,
// impostazioni e dialogo, con il focus sempre dentro il componente aperto. Uso: npm run prova-tastiera
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = await createServer({ root: radice, configFile: path.join(radice, 'vite.config.ts'), server: { port: 0, host: '127.0.0.1' }, logLevel: 'warn' });
await server.listen();
const indirizzo = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const pagina = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errori = [];
pagina.on('pageerror', (e) => errori.push(e.message));
let falliti = 0;
const verifica = async (nome, condizione) => {
  const ok = await pagina.evaluate(condizione);
  console.log(`${ok ? 'ok  ' : 'NO  '} ${nome}`);
  if (!ok) falliti++;
};
const focusDentro = (sel) => `(() => { const a = document.activeElement; return !!a && !!a.closest('${sel}'); })()`;

try {
  await pagina.goto(`${indirizzo}?c=titolo`, { waitUntil: 'networkidle' });
  await pagina.waitForFunction(() => window.__UI_PRONTA__ === true);
  await verifica('il titolo ha il focus su «Continua»', `document.activeElement?.textContent?.includes('Continua')`);
  await pagina.keyboard.press('ArrowDown');
  await pagina.keyboard.press('ArrowDown');
  await verifica('le frecce scendono a «Impostazioni»', `document.activeElement?.textContent?.includes('Impostazioni')`);
  await pagina.keyboard.press('Enter');
  await verifica('Invio apre le impostazioni', `window.ui.pannelloImpostazioni.visible && !window.ui.titolo.visible`);
  await verifica('il focus è nelle impostazioni', focusDentro('.ui-impostazioni'));
  await pagina.keyboard.press('ArrowRight');
  await pagina.keyboard.press('ArrowRight');
  await verifica('le frecce cambiano scheda', `document.activeElement?.getAttribute('aria-selected') === 'true' && document.activeElement.textContent.includes('Suono')`);
  for (let i = 0; i < 40; i++) await pagina.keyboard.press('Tab');
  await verifica('Tab resta nelle impostazioni', focusDentro('.ui-impostazioni'));
  await pagina.keyboard.press('Escape');
  await verifica('Esc torna al titolo', `window.ui.titolo.visible && !window.ui.pannelloImpostazioni.visible`);
  await verifica('il focus torna nel titolo', focusDentro('.ui-titolo'));

  await pagina.evaluate(() => {
    window.ui.titolo.hide();
    window.ui.indicazioni.show();
  });
  await pagina.keyboard.press('Escape');
  await verifica('Esc in gioco apre la pausa', `window.ui.pausa.visible && window.ui.inputCatturato && window.ui.tempoFermo`);
  await pagina.keyboard.press('t');
  await verifica('T dalla pausa apre il taccuino', `window.ui.taccuino.visible && !window.ui.pausa.visible`);
  await pagina.keyboard.press('ArrowDown');
  await verifica('le frecce scelgono le piste', focusDentro('.ui-tc-sinistra'));
  await pagina.keyboard.press('Escape');
  await verifica('Esc torna alla pausa', `window.ui.pausa.visible && !window.ui.taccuino.visible`);
  await pagina.keyboard.press('p');
  await verifica('P apre la Pianta', `window.ui.pianta.visible`);
  await pagina.keyboard.press('+');
  await pagina.keyboard.press('ArrowLeft');
  await pagina.keyboard.press('c');
  await pagina.keyboard.press('Escape');
  await pagina.keyboard.press('Escape');
  await verifica('Esc, Esc: di nuovo in gioco', `!window.ui.inputCatturato && !window.ui.tempoFermo`);

  await pagina.evaluate(() =>
    window.ui.dialogo.show({ chi: 'Ottavio', testo: 'Allora è vero.', risposte: [{ testo: 'Tu chi sei?' }, { testo: 'Io ti facevo più lento.' }] }),
  );
  await pagina.keyboard.press('Space');
  await verifica('Spazio completa il testo', `window.ui.dialogo.testoFinito`);
  const scelte = await pagina.evaluate(() => new Promise((r) => { window.ui.dialogo.once('scelta', r); setTimeout(() => r(-1), 1500); window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' })); }));
  console.log(`${scelte === 1 ? 'ok  ' : 'NO  '} il tasto 2 sceglie la seconda risposta`);
  if (scelte !== 1) falliti++;
} finally {
  await browser.close();
  await server.close();
}
if (errori.length) console.error('Errori nella pagina:\n' + errori.join('\n'));
if (falliti || errori.length) process.exitCode = 1;
else console.log('Tutto bene.');
