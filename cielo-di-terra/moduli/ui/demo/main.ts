/**
 * Pagina demo del modulo UI. Senza parametri mostra un pannellino per provare tutti i componenti;
 * con `?c=<nome>` prepara un solo stato (le schermate di scripts/shots.mjs).
 */
import { InterfacciaGioco, StoreImpostazioni, caricaCaratteri, type Carta } from '../src/index';
import * as esempio from './dati';
import { contenutiVeri } from './contenuti';

const parametri = new URLSearchParams(location.search);
const scelta = parametri.get('c');
const dati = contenutiVeri(esempio);

// ---------- il «gioco» finto: un canvas con un bozzetto dipinto ----------

const sfondi = import.meta.glob('./sfondi/*.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const canvas = document.getElementById('canvas-gioco') as HTMLCanvasElement;
let sfondoCorrente = '';

function disegnaSfondo(n: number): Promise<void> {
  const url = sfondi[`./sfondi/finale-${n}.jpg`] ?? '';
  sfondoCorrente = url;
  return new Promise((risolvi) => {
    const img = new Image();
    img.onload = () => {
      if (sfondoCorrente !== url) return risolvi();
      canvas.width = innerWidth;
      canvas.height = innerHeight;
      const ctx = canvas.getContext('2d')!;
      const sc = Math.max(canvas.width / img.width, canvas.height / img.height);
      ctx.drawImage(img, (canvas.width - img.width * sc) / 2, (canvas.height - img.height * sc) / 2, img.width * sc, img.height * sc);
      risolvi();
    };
    img.onerror = () => risolvi();
    img.src = url;
  });
}

// ---------- l'interfaccia ----------

const store = new StoreImpostazioni({
  // Nelle schermate niente localStorage: ogni stato parte dai valori di base.
  archivio: scelta ? null : undefined,
  chiave: 'cielo-di-terra.demo-ui',
  predefinite: { posizioneSullaPianta: true },
});
const ui = new InterfacciaGioco(document.getElementById('gioco')!, {
  impostazioni: store,
  datiTaccuino: () => dati.taccuino,
  datiPianta: () => dati.pianta,
  datiPausa: () => ({ luogo: 'Corbella, Piazza delle Ore', quando: 'Giorno 3 · le 19.42', prossimoEvento: dati.taccuino.prossimoEvento }),
});
(window as unknown as { ui: InterfacciaGioco }).ui = ui;

ui.titolo.on('continua', () => {
  ui.titolo.hide();
  avviaGioco();
});
ui.titolo.on('nuovaPartita', () => {
  ui.titolo.hide();
  caricaPoiGioca();
});
ui.pausa.on('esciAlTitolo', () => ui.titolo.show(datiTitolo));
ui.dialogo.on('scelta', (i) => {
  const r = dati.battuta.risposte?.[i];
  ui.dialogo.show({ chi: dati.battuta.chi, aspetto: dati.battuta.aspetto, testo: `Hai scelto: «${r?.testo ?? ''}». Ottavio si stringe nelle spalle e guarda in su, verso il lago appeso.` });
});
ui.dialogo.on('avanti', () => ui.dialogo.hide());
ui.on('catturaInput', (preso) => document.body.classList.toggle('input-ui', preso));

const datiTitolo = { puoiContinuare: true, salvataggio: 'Giorno 3 · Corbella, alla brace', versione: '0.1 · fase 1' };

function avviaGioco(): void {
  ui.indicazioni.show();
  ui.indicazioni.mostraPuntino(true);
  ui.indicazioni.azione({ tasto: 'E', testo: 'Parla con Ottavio' });
}

function caricaPoiGioca(): void {
  ui.caricamento.show();
  let p = 0;
  const t = setInterval(() => {
    p += 0.07;
    ui.caricamento.progresso(p, p < 0.4 ? 'Si stende la Carta…' : p < 0.8 ? 'Le Fade tornano nelle stalle…' : 'La Linea si accende…');
    if (p >= 1) {
      clearInterval(t);
      ui.caricamento.hide();
      avviaGioco();
    }
  }, 220);
}

const carte: Record<string, Carta> = {
  lettera: dati.lettera,
  libretto: dati.libretto,
  cartellino: dati.cartellino,
  biglietto: dati.biglietto,
  dattiloscritto: dati.dattiloscritto,
};

/** Prepara uno stato della demo; restituisce lo sfondo da usare. */
async function prepara(c: string): Promise<void> {
  const sfondo: Record<string, number> = {
    titolo: 1,
    'titolo-conferma': 1,
    pausa: 2,
    impostazioni: 1,
    'impostazioni-accessibilita': 1,
    'impostazioni-aiuti': 1,
    dialogo: 5,
    'dialogo-storico': 5,
    lettera: 1,
    libretto: 2,
    cartellino: 2,
    biglietto: 5,
    dattiloscritto: 7,
    taccuino: 5,
    'taccuino-parole': 5,
    'taccuino-leggende': 5,
    pianta: 3,
    'pianta-zoom': 3,
    hud: 1,
    'hud-notte': 5,
    squadro: 2,
    crediti: 6,
    caricamento: 1,
    'testo-semplice': 1,
    'contrasto-grande': 1,
  };
  await disegnaSfondo(sfondo[c] ?? 1);
  switch (c) {
    case 'titolo':
      ui.titolo.show(datiTitolo);
      break;
    case 'titolo-conferma':
      ui.titolo.show(datiTitolo);
      (ui.titolo.el.querySelectorAll<HTMLButtonElement>('.ui-voce')[1] as HTMLButtonElement).click();
      break;
    case 'pausa':
      avviaGioco();
      ui.apriPausa();
      break;
    case 'impostazioni':
      ui.pannelloImpostazioni.show('visione');
      break;
    case 'impostazioni-accessibilita':
      ui.pannelloImpostazioni.show('testo');
      break;
    case 'impostazioni-aiuti':
      ui.pannelloImpostazioni.show('aiuti');
      break;
    case 'dialogo':
    case 'dialogo-storico':
      for (const v of esempio.STORICO_ESEMPIO) ui.dialogo.aggiungiStorico(v);
      ui.dialogo.show(dati.battuta);
      ui.dialogo.completa();
      if (c === 'dialogo-storico') ui.dialogo.toggleStorico(true);
      break;
    case 'lettera':
    case 'cartellino':
    case 'biglietto':
    case 'dattiloscritto':
      ui.lettore.show(carte[c]!);
      break;
    case 'libretto':
      ui.lettore.show(carte['libretto']!, dati.paginaLibretto);
      break;
    case 'testo-semplice':
      store.set('calligrafia', 'semplice');
      ui.lettore.show(carte['lettera']!);
      break;
    case 'contrasto-grande':
      store.set('altoContrasto', true);
      store.set('dimensioneTesto', 'molto-grande');
      store.set('caratteriLeggibili', true);
      ui.apriTaccuino();
      break;
    case 'taccuino':
      ui.apriTaccuino();
      break;
    case 'taccuino-parole':
      ui.taccuino.show(dati.taccuino, 'parole');
      break;
    case 'taccuino-leggende':
      ui.taccuino.show(dati.taccuino, 'leggende');
      break;
    case 'pianta':
      ui.apriPianta();
      break;
    case 'pianta-zoom':
      ui.apriPianta();
      ui.pianta.impostaZoom(4);
      ui.pianta.centraSu(1010, 34);
      break;
    case 'hud':
      avviaGioco();
      ui.indicazioni.notifica('Nuova pista nel taccuino');
      ui.indicazioni.sottotitolo({ chi: 'Ottavio', testo: 'Di qua, Giardiniera: il fienile è dopo il mulino, a Mane.', durata: 60000 });
      ui.indicazioni.sottotitolo({ tipo: 'suono', testo: 'tre rintocchi da San Vigilio', direzione: 'sinistra', durata: 60000 });
      break;
    case 'hud-notte':
      ui.indicazioni.show();
      ui.indicazioni.mostraPuntino(true);
      ui.indicazioni.fiato(0.28);
      ui.indicazioni.velo(0.62);
      ui.indicazioni.suggerimento('Tieni premuto {E} vicino a un chiodo d’ottone per piantare lo squadro');
      ui.indicazioni.notifica('Stanotte le Fade sono sul prato di Ronco', { tono: 'rosso' });
      ui.indicazioni.sottotitolo({ tipo: 'suono', testo: 'tintinnio d’ottone e frullo leggero', direzione: 'davanti', durata: 60000 });
      break;
    case 'squadro':
      ui.indicazioni.show();
      ui.indicazioni.squadro({ caposaldo: 'Pilastro 6', dettaglio: 'Sass Grand · 412 m a Mane', livella: 0.22, ingrandimento: 4 });
      ui.indicazioni.azione({ tasto: 'E', testo: 'Rileva', progresso: 0.4 });
      break;
    case 'crediti':
      ui.crediti.show();
      break;
    case 'caricamento':
      ui.caricamento.show({ proverbi: dati.proverbi });
      ui.caricamento.progresso(0.62, 'Le Fade tornano nelle stalle…');
      break;
    default:
      ui.titolo.show(datiTitolo);
  }
}

// ---------- pannellino di prova (solo senza ?c=) ----------

function pannelloDemo(): void {
  const stati = [
    'titolo', 'pausa', 'impostazioni', 'dialogo', 'lettera', 'libretto', 'cartellino', 'dattiloscritto',
    'biglietto', 'taccuino', 'taccuino-parole', 'taccuino-leggende', 'pianta', 'pianta-zoom', 'hud', 'hud-notte', 'squadro', 'crediti', 'caricamento',
  ];
  const p = document.createElement('details');
  p.className = 'demo-pannello';
  p.innerHTML = '<summary>Demo UI</summary>';
  const lista = document.createElement('div');
  for (const s of stati) {
    const a = document.createElement('a');
    a.href = `?c=${s}&prova=1`;
    a.textContent = s;
    lista.append(a);
  }
  p.append(lista);
  document.body.append(p);
}

await caricaCaratteri();
await prepara(scelta ?? 'titolo');
if (!scelta || parametri.has('prova')) pannelloDemo();
// Il testo progressivo e le dissolvenze hanno bisogno di qualche istante.
setTimeout(() => ((window as unknown as { __UI_PRONTA__: boolean }).__UI_PRONTA__ = true), 450);
