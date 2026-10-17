// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InterfacciaGioco, StoreImpostazioni, type Carta } from '../../src/ui/index';

let ui: InterfacciaGioco;
let contenitore: HTMLDivElement;

function tasto(key: string): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  window.dispatchEvent(e);
  return e;
}

beforeEach(() => {
  contenitore = document.createElement('div');
  document.body.append(contenitore);
  ui = new InterfacciaGioco(contenitore, {
    impostazioni: new StoreImpostazioni({ archivio: null, predefinite: { riduciMovimenti: true } }),
    datiTaccuino: () => ({ prossimoEvento: 'Meta fra 34 s', piste: [], parole: [] }),
    datiPianta: () => ({ capisaldi: [] }),
  });
});

afterEach(() => {
  ui.destroy();
  contenitore.remove();
});

describe('InterfacciaGioco', () => {
  it('monta tutti i componenti in una radice trasparente sopra il canvas', () => {
    const r = contenitore.querySelector('.ui-radice')!;
    expect(r).toBeTruthy();
    expect(r.querySelectorAll('.ui-componente').length).toBe(12);
    expect(r.classList.contains('ui-ridotto')).toBe(true);
    expect(document.getElementById('ui-f-bordo')).toBeTruthy();
  });

  it('Esc apre la pausa, cattura l’input e ferma il tempo; Esc di nuovo riprende', () => {
    const cattura: boolean[] = [];
    const tempo: boolean[] = [];
    ui.on('catturaInput', (v) => cattura.push(v));
    ui.on('tempoFermo', (v) => tempo.push(v));
    const e = tasto('Escape');
    expect(e.defaultPrevented).toBe(true);
    expect(ui.pausa.visible).toBe(true);
    expect(ui.inputCatturato).toBe(true);
    tasto('Escape');
    expect(ui.pausa.visible).toBe(false);
    expect(cattura).toEqual([true, false]);
    expect(tempo).toEqual([true, false]);
  });

  it('Esc in un dialogo apre la pausa sopra il dialogo, che resta aperto sotto', () => {
    ui.dialogo.show({ chi: 'Ottavio', testo: 'Allora?', risposte: [{ testo: 'Sì.' }, { testo: 'No.' }] });
    const e = tasto('Escape');
    expect(e.defaultPrevented).toBe(true);
    expect(ui.pausa.visible).toBe(true);
    expect(ui.dialogo.visible).toBe(true);
    expect(ui.tempoFermo).toBe(true);
    tasto('Escape'); // riprendi: si torna al dialogo
    expect(ui.pausa.visible).toBe(false);
    expect(ui.dialogo.visible).toBe(true);
    expect(ui.inputCatturato).toBe(true);
    // con lo storico aperto Esc chiude lo storico, non apre la pausa
    tasto('h');
    tasto('Escape');
    expect(ui.pausa.visible).toBe(false);
    expect(ui.dialogo.visible).toBe(true);
  });

  it('un menu del gioco fuori dalla pila («Aspetta fino a…»): Esc lo chiude e non apre anche la pausa', () => {
    // come il menu dell'attesa della regia: i numeri scelgono, X o Esc lasciano perdere
    let aperto = true;
    const scelte: string[] = [];
    const menu = (e: KeyboardEvent): boolean => {
      if (/^[1-9]$/.test(e.key)) scelte.push(e.key);
      else if (e.key === 'Escape' || e.key === 'x') aperto = false;
      else return false;
      if (!aperto) ui.tastiPrima = null;
      return true;
    };
    // l'ingresso del gioco ascolta la finestra dopo l'interfaccia (in bolla): non deve sentire i tasti del menu
    const sentiti: string[] = [];
    const ingresso = (e: KeyboardEvent): void => void sentiti.push(e.key);
    window.addEventListener('keydown', ingresso);
    try {
      ui.tastiPrima = menu;
      const uno = tasto('1');
      expect(uno.defaultPrevented).toBe(true);
      expect(scelte).toEqual(['1']);
      // un tasto che non è del menu passa (Invio arriva all'ingresso: la regia lo scarta da sé)
      tasto('Enter');
      expect(sentiti).toEqual(['Enter']);
      const esc = tasto('Escape');
      expect(esc.defaultPrevented).toBe(true);
      expect(aperto).toBe(false);
      expect(ui.pausa.visible).toBe(false);
      expect(ui.tastiPrima).toBeNull();
      expect(sentiti).toEqual(['Enter']);
      // menu chiuso: Esc torna ad aprire la pausa
      tasto('Escape');
      expect(ui.pausa.visible).toBe(true);
      // con un modale aperto (la pausa sopra il menu) i tasti vanno al modale, non al menu
      ui.pausa.hide();
      aperto = true;
      ui.tastiPrima = menu;
      ui.apriPausa();
      tasto('Escape');
      expect(ui.pausa.visible).toBe(false);
      expect(aperto).toBe(true);
      expect(ui.tastiPrima).toBe(menu);
    } finally {
      window.removeEventListener('keydown', ingresso);
      ui.tastiPrima = null;
    }
  });

  it('dalla pausa alle impostazioni e indietro, senza perdere la pausa', () => {
    const tempo: boolean[] = [];
    ui.on('tempoFermo', (v) => tempo.push(v));
    ui.apriPausa();
    (ui.pausa.el.querySelectorAll<HTMLButtonElement>('.ui-voce')[4]!).click();
    expect(ui.pannelloImpostazioni.visible).toBe(true);
    expect(ui.pausa.visible).toBe(false);
    tasto('Escape');
    expect(ui.pannelloImpostazioni.visible).toBe(false);
    expect(ui.pausa.visible).toBe(true);
    expect(tempo).toEqual([true]);
  });

  it('le scorciatoie T e P aprono taccuino e Pianta; il taccuino non ferma il tempo', () => {
    tasto('t');
    expect(ui.taccuino.visible).toBe(true);
    expect(ui.tempoFermo).toBe(false);
    tasto('Escape');
    expect(ui.taccuino.visible).toBe(false);
    tasto('p');
    expect(ui.pianta.visible).toBe(true);
    tasto('Escape');
    expect(ui.pianta.visible).toBe(false);
  });

  it('il titolo chiede conferma prima di cancellare un viaggio salvato', () => {
    const nuova = vi.fn();
    ui.titolo.on('nuovaPartita', nuova);
    ui.titolo.show({ puoiContinuare: true });
    const voci = ui.titolo.el.querySelectorAll<HTMLButtonElement>('.ui-voce');
    voci[1]!.click();
    expect(nuova).not.toHaveBeenCalled();
    const conferma = ui.titolo.el.querySelector<HTMLElement>('.ui-titolo-conferma')!;
    expect(conferma.hidden).toBe(false);
    conferma.querySelector<HTMLButtonElement>('.ui-voce')!.click();
    expect(nuova).toHaveBeenCalledTimes(1);
    ui.titolo.show({ puoiContinuare: false });
    expect(ui.titolo.el.querySelector<HTMLButtonElement>('.ui-voce')!.disabled).toBe(true);
  });

  it('le impostazioni scrivono nello store e lo store aggiorna i controlli', () => {
    ui.pannelloImpostazioni.show('aiuti');
    const interruttore = ui.pannelloImpostazioni.el.querySelector<HTMLButtonElement>('#ui-imp-posizioneSullaPianta')!;
    expect(interruttore.getAttribute('aria-checked')).toBe('false');
    interruttore.click();
    expect(ui.impostazioni.get('posizioneSullaPianta')).toBe(true);
    ui.impostazioni.set('posizioneSullaPianta', false);
    expect(interruttore.getAttribute('aria-checked')).toBe('false');
    ui.impostazioni.set('dimensioneTesto', 'grande');
    expect(ui.radice.style.getPropertyValue('--ui-scala')).toBe('1.15');
    ui.impostazioni.set('calligrafia', 'semplice');
    expect(ui.radice.classList.contains('ui-semplice')).toBe(true);
  });
});

describe('FinestraDialogo', () => {
  it('le risposte si scelgono con i numeri e finiscono nello storico', () => {
    const scelte: number[] = [];
    ui.dialogo.on('scelta', (i) => scelte.push(i));
    ui.dialogo.show({
      chi: 'Ottavio',
      aspetto: 'velo da corsa verde',
      didascalia: 'Atterra correndo.',
      testo: 'Allora è vero. La Svegliata.',
      risposte: [{ testo: 'Tu chi sei?' }, { testo: 'Io ti facevo più lento.' }, { testo: 'Chiuso', disabilitata: true }],
    });
    // Con «riduci i movimenti» il testo compare subito.
    expect(ui.dialogo.testoFinito).toBe(true);
    tasto('3');
    expect(scelte).toEqual([]);
    tasto('2');
    expect(scelte).toEqual([1]);
    const storico = ui.dialogo.vociStorico;
    expect(storico.map((v) => v.chi)).toEqual(['Ottavio', 'Elvira']);
    expect(storico[1]!.testo).toBe('Io ti facevo più lento.');
  });

  it('senza risposte Invio va avanti; H apre lo storico', () => {
    const avanti = vi.fn();
    ui.dialogo.on('avanti', avanti);
    ui.dialogo.show({ chi: 'Meridiana', testo: 'Confermo, Giardiniera.' });
    tasto('h');
    expect(ui.dialogo.el.querySelector<HTMLElement>('.ui-dlg-storico')!.hidden).toBe(false);
    tasto('Enter');
    expect(avanti).toHaveBeenCalledTimes(1);
  });
});

describe('LettoreCarte', () => {
  const libretto: Carta = {
    tipo: 'libretto',
    titolo: 'Libretto',
    pagine: [{ testo: 'uno' }, { testo: 'due' }, { testo: 'tre' }, { testo: 'quattro', margine: 'a margine' }],
  };

  it('sfoglia il libretto a due pagine con le frecce', () => {
    const pagine: number[] = [];
    ui.lettore.on('pagina', (n) => pagine.push(n));
    ui.lettore.show(libretto);
    expect(ui.lettore.el.querySelectorAll('.ui-lt-pagina').length).toBe(2);
    tasto('ArrowRight');
    expect(ui.lettore.paginaCorrente).toBe(2);
    tasto('ArrowRight');
    expect(ui.lettore.paginaCorrente).toBe(2);
    tasto('ArrowLeft');
    expect(pagine).toEqual([0, 2, 0]);
    expect(ui.tempoFermo).toBe(true);
    tasto('Escape');
    expect(ui.lettore.visible).toBe(false);
  });

  it('una lettera di una pagina nasconde i comandi per sfogliare', () => {
    ui.lettore.show({ tipo: 'lettera', titolo: 'Lettera', supporto: 'carta grezza', pagine: [{ testo: 'Mamma,\n\nciao.', firma: 'Marta' }] });
    const nav = ui.lettore.el.querySelectorAll<HTMLButtonElement>('.ui-lt-nav');
    expect([...nav].every((b) => b.hidden)).toBe(true);
    expect(ui.lettore.el.querySelector('.ui-lt-firma')!.textContent).toBe('Marta');
    expect(ui.lettore.el.querySelector('.ui-lt-supporto')!.textContent).toBe('carta grezza');
  });
});

describe('Taccuino', () => {
  it('segnala le voci nuove viste e apre la pista nuova per prima', () => {
    const visti = vi.fn();
    ui.taccuino.on('visto', visti);
    ui.taccuino.show({
      prossimoEvento: 'Brace alle 19:30',
      piste: [
        { id: 'a', domanda: 'Vecchia?', indizi: [{ id: 'i1', testo: 'x', fonte: 'f' }] },
        { id: 'b', domanda: 'Nuova?', nuova: true, indizi: [{ id: 'i2', testo: 'y', fonte: 'g', nuovo: true, mano: 'madre' }] },
      ],
      parole: [{ tecnica: 'asse', locale: 'il Fuso' }],
    });
    expect(ui.taccuino.el.querySelector('.ui-tc-riga-testo')!.textContent).toBe('Brace alle 19:30');
    expect(ui.taccuino.el.querySelector('.ui-tc-domanda')!.textContent).toBe('Nuova?');
    expect(ui.taccuino.el.querySelector('.ui-tc-mano--madre')).toBeTruthy();
    expect(visti).toHaveBeenCalledWith({ piste: ['b'], indizi: ['i2'], parole: [], leggende: [] });
    ui.taccuino.prossimoEvento('Meta fra 12 s');
    expect(ui.taccuino.el.querySelector('.ui-tc-riga-testo')!.textContent).toBe('Meta fra 12 s');
  });
});

describe('Indicazioni', () => {
  it('azione, notifica e sottotitoli', () => {
    vi.useFakeTimers();
    try {
      ui.indicazioni.show();
      ui.indicazioni.azione({ tasto: 'E', testo: 'Rileva' });
      expect(ui.indicazioni.el.querySelector<HTMLElement>('.ui-hud-azione')!.hidden).toBe(false);
      ui.indicazioni.azione(null);
      expect(ui.indicazioni.el.querySelector<HTMLElement>('.ui-hud-azione')!.hidden).toBe(true);
      ui.indicazioni.notifica('Nuova pista nel taccuino', { durata: 1000 });
      expect(ui.indicazioni.el.querySelectorAll('.ui-hud-notifica').length).toBe(1);
      vi.advanceTimersByTime(1500);
      expect(ui.indicazioni.el.querySelectorAll('.ui-hud-notifica').length).toBe(0);
      const togli = ui.indicazioni.sottotitolo({ tipo: 'suono', testo: 'tre rintocchi', direzione: 'sinistra' });
      const st = ui.indicazioni.el.querySelector('.ui-hud-sottotitolo')!;
      expect(st.textContent).toContain('[tre rintocchi]');
      expect(st.textContent).toContain('‹');
      togli();
      vi.advanceTimersByTime(400);
      expect(ui.indicazioni.el.querySelector('.ui-hud-sottotitolo')).toBeNull();
      ui.indicazioni.squadro({ caposaldo: 'Pilastro 6', livella: 0 });
      expect(ui.indicazioni.el.querySelector('.ui-sq-targa')!.textContent).toBe('Pilastro 6');
      expect(ui.indicazioni.el.querySelector('.ui-squadro')!.classList.contains('ui-sq--in-bolla')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
