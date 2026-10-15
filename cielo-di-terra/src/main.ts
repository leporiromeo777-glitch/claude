/**
 * Punto d'ingresso: controlla WebGL2, monta l'interfaccia (caricamento, titolo), costruisce il
 * gioco e la regia e, in sviluppo o con VITE_E2E=1, installa `window.__GAME__` (motore) e
 * `window.__GAME__.regia` (storia).
 *
 * Parametri URL: `?debug` pannello statistiche; `?ora=21.5` ora del titolo; `?nuova` salta il
 * titolo e comincia una partita nuova (prove); `?senza-titolo` resta nel mondo libero (motore).
 */
import { installDebugApi } from './core/debug';
import { SuggerimentoSguardo } from './core/suggerimentoSguardo';
import { Game } from './game';
import { installaCorbella } from './popolamento';
import { aggiungiAcquaLavatoio } from './render/water';
import { installaDebugRegia } from './regia/debug';
import { Regia } from './regia/regia';
import { InterfacciaGioco, caricaCaratteri } from './ui';
import { NOTA_QUALITA } from './ui/componenti/impostazioni';

const app = document.getElementById('app')!;
const params = new URLSearchParams(location.search);
const e2e = import.meta.env.VITE_E2E === '1';
const debugEnabled = import.meta.env.DEV || e2e;

function senzaWebGL(): void {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: '10px',
    font: '17px/1.4 Georgia, "Times New Roman", serif',
    color: '#efe8d8',
    background: '#232838',
    textAlign: 'center',
  } satisfies Partial<CSSStyleDeclaration>);
  el.innerHTML = '<div style="font-size:28px;letter-spacing:.04em">Cielo di Terra</div><div>Questo browser non supporta WebGL2: serve per entrare nel Verbano.</div>';
  document.body.appendChild(el);
}

async function boot(): Promise<void> {
  if (!document.createElement('canvas').getContext('webgl2')) {
    senzaWebGL();
    return;
  }
  let regia: Regia | null = null;
  const ui = new InterfacciaGioco(app, {
    datiTaccuino: () => regia?.ponte.datiTaccuino(),
    datiPianta: () => regia?.ponte.datiPianta(),
    datiPausa: () => regia?.ponte.datiPausa(),
  });
  ui.caricamento.show({ testo: 'preparo il cilindro…' });
  await caricaCaratteri(e2e ? 400 : 1500).catch(() => undefined);
  const game = new Game(app, { debugOverlay: params.has('debug'), e2e });
  const passi = ['particelle', 'terreno', 'finestre, Linea, Collare', 'paesi', 'castagni', 'pronto'];
  await game.init(async (m) => {
    ui.caricamento.progresso(Math.min(0.95, (passi.indexOf(m) + 1) / (passi.length + 1)), m);
    await new Promise((r) => setTimeout(r, 0));
  });
  const ore = params.get('ora');
  if (ore !== null && !Number.isNaN(Number(ore))) game.clock.setHours(Number(ore));
  collegaInterfaccia(game, ui);
  if (debugEnabled) installDebugApi(game);
  if (!params.has('senza-titolo')) {
    ui.caricamento.progresso(0.9, 'Corbella: le case, i muri, la gente');
    await new Promise((r) => setTimeout(r, 0));
    // il paese vero (src/popolamento) al posto del segnaposto del motore; il suo passo lo chiama la regia
    const corbella = installaCorbella(game, { agganciaCiclo: false, luciAbitanti: false });
    // l'acqua che si muove nella vasca del lavatoio (traccia «natura»)
    aggiungiAcquaLavatoio(game, corbella.punto('esamina:lavatoio')?.pos, corbella.chiodo(5));
    ui.caricamento.progresso(0.97, 'la Cripta, i chiodi');
    await new Promise((r) => setTimeout(r, 0));
    regia = new Regia(game, ui, corbella, { e2e });
    if (debugEnabled) installaDebugRegia(regia);
  }
  ui.caricamento.progresso(1, 'pronto');
  ui.caricamento.hide();
  game.start();
  if (regia) {
    let nuova = params.has('nuova');
    try {
      nuova ||= sessionStorage.getItem('cielo-di-terra.nuova') === '1';
      sessionStorage.removeItem('cielo-di-terra.nuova');
    } catch {
      /* niente */
    }
    if (nuova) regia.nuovaPartita();
    else await regia.mostraTitolo();
  }
  if (!e2e) game.ensureLoaded();
  (window as unknown as { __GAME_READY__: boolean }).__GAME_READY__ = true;
}

/**
 * Fili fra interfaccia e motore che non passano dalla regia:
 * - «Qualità grafica» (Esc → Impostazioni → Visione e comandi) → `game.setQualita`;
 * - quando l'interfaccia prende la tastiera (menu, dialoghi, carte) le frecce non girano lo sguardo;
 * - il suggerimento dello sguardo la prima volta (non nelle prove E2E: le foto restano pulite).
 */
function collegaInterfaccia(game: Game, ui: InterfacciaGioco): void {
  const imp = ui.impostazioni;
  const qualita = (): void => game.setQualita(imp.get('qualitaGrafica'));
  qualita();
  imp.on('cambio', (c) => {
    if (c.chiave === 'qualitaGrafica') qualita();
  });
  imp.on('ripristino', qualita);
  const nomi = { bassa: 'Bassa', media: 'Media', alta: 'Alta' } as const;
  game.onQualita((p) => {
    const auto = game.qualita === 'automatica' ? ' (scelta automatica)' : '';
    ui.pannelloImpostazioni.impostaNota('qualitaGrafica', `${NOTA_QUALITA} Adesso: ${nomi[p.livello]}${auto}.`);
  });
  game.input.bloccoInterfaccia = ui.inputCatturato;
  ui.on('catturaInput', (preso) => (game.input.bloccoInterfaccia = preso));
  if (!e2e) {
    const sugg = new SuggerimentoSguardo(ui.radice, game.input);
    game.sistemi.push({ update: (dt) => sugg.aggiorna(dt) });
  }
}

boot().catch((err) => {
  console.error(err);
  const el = document.createElement('pre');
  el.textContent = `Errore: ${String(err)}`;
  Object.assign(el.style, { position: 'fixed', inset: '20px', color: '#f0e7d1', background: '#232838', padding: '20px', zIndex: '50' });
  document.body.appendChild(el);
});
