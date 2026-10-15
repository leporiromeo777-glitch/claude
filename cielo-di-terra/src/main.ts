/**
 * Punto d'ingresso: controlla WebGL2, mostra un piccolo caricamento, costruisce
 * il gioco e (in sviluppo o con VITE_E2E=1) installa `window.__GAME__`.
 */
import { installDebugApi } from './core/debug';
import { Game } from './game';

const app = document.getElementById('app')!;
const params = new URLSearchParams(location.search);
const e2e = import.meta.env.VITE_E2E === '1';
const debugEnabled = import.meta.env.DEV || e2e;

function overlay(text: string): HTMLDivElement {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: '10px',
    font: '15px/1.4 Georgia, "Times New Roman", serif',
    color: '#efe8d8',
    background: '#232838',
    zIndex: '20',
    textAlign: 'center',
  } satisfies Partial<CSSStyleDeclaration>);
  el.innerHTML = `<div style="font-size:28px;letter-spacing:.04em">Cielo di Terra</div><div id="load-msg">${text}</div>`;
  document.body.appendChild(el);
  return el;
}

function hint(): void {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed',
    right: '10px',
    bottom: '10px',
    font: '12px/1.4 Georgia, serif',
    color: 'rgba(245,240,228,0.85)',
    background: 'rgba(30,28,40,0.45)',
    padding: '6px 10px',
    borderRadius: '6px',
    pointerEvents: 'none',
    zIndex: '9',
  } satisfies Partial<CSSStyleDeclaration>);
  el.textContent = 'Clic per guardare · WASD · Spazio salta, tenuto in aria apre il Velo · Shift corre · E interagisce · F3 statistiche';
  document.body.appendChild(el);
  setTimeout(() => (el.style.display = 'none'), 15000);
}

async function boot(): Promise<void> {
  const test = document.createElement('canvas').getContext('webgl2');
  if (!test) {
    overlay('Questo browser non supporta WebGL2: serve per entrare nel Verbano.');
    return;
  }
  const load = overlay('preparo il cilindro…');
  const msg = load.querySelector('#load-msg') as HTMLDivElement;
  const game = new Game(app, { debugOverlay: params.has('debug'), e2e });
  const hours = params.get('ora');
  if (hours !== null && !Number.isNaN(Number(hours))) game.clock.setHours(Number(hours));
  await game.init(async (m) => {
    msg.textContent = m;
    await new Promise((r) => setTimeout(r, 0));
  });
  if (debugEnabled) installDebugApi(game);
  if (!e2e) game.ensureLoaded();
  load.remove();
  if (!e2e) hint();
  game.start();
  (window as unknown as { __GAME_READY__: boolean }).__GAME_READY__ = true;
}

boot().catch((err) => {
  console.error(err);
  overlay(`Errore: ${String(err)}`);
});
