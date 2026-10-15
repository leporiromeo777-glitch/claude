/**
 * Banco di prova del popolamento nel motore vero: avvia il gioco come src/main.ts, poi
 * installa Corbella e mostra i suggerimenti «E» dei punti d'interazione vicini.
 *
 * Parametri URL: ?ora=21.5 (ora iniziale), ?segnaposto (non toglie il paese segnaposto),
 * ?e2e (buffer conservato e pixel ratio 1, per gli screenshot).
 * In console: window.__GAME__ (API di debug del motore), window.__CORBELLA__ (maniglia).
 */
import { installDebugApi } from '../../../src/core/debug';
import { Game } from '../../../src/game';
import { installaCorbella, type ManigliaCorbella } from '../src/index';

declare global {
  interface Window {
    __CORBELLA__?: ManigliaCorbella;
    __CORBELLA_READY__?: boolean;
    __GAME_READY__?: boolean;
  }
}

const params = new URLSearchParams(location.search);
const e2e = params.has('e2e') || import.meta.env.VITE_E2E === '1';

async function avvia(): Promise<void> {
  const app = document.getElementById('app')!;
  const game = new Game(app, { debugOverlay: params.has('debug'), e2e });
  const ora = params.get('ora');
  if (ora !== null && !Number.isNaN(Number(ora))) game.clock.setHours(Number(ora));
  await game.init();
  installDebugApi(game);
  const corbella = installaCorbella(game, { segnaposto: params.has('segnaposto') ? 'tieni' : 'rimuovi' });
  window.__CORBELLA__ = corbella;
  console.log('Corbella', JSON.stringify(corbella.statistiche));
  if (!e2e) game.ensureLoaded();
  // suggerimento «E» del punto più vicino
  const prompt = document.getElementById('prompt')!;
  game.bus.on('player:interact', () => {
    const p = corbella.puntiVicini(game.camera.position)[0];
    if (p) console.log('interazione', p.id, p.rif ?? '');
  });
  setInterval(() => {
    const p = corbella.puntiVicini(game.camera.position)[0];
    prompt.style.display = p ? 'block' : 'none';
    if (p) prompt.textContent = `E — ${p.etichetta}`;
  }, 200);
  game.start();
  window.__GAME_READY__ = true;
  window.__CORBELLA_READY__ = true;
}

avvia().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#fff;position:fixed;top:0;left:0">${String(err?.stack ?? err)}</pre>`);
});
