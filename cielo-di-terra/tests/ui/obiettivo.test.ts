// @vitest-environment happy-dom
/**
 * Il pannello dell'obiettivo e il segnalino (src/ui/componenti/obiettivo.ts) dentro
 * l'interfaccia: dati, passo nuovo che barra il vecchio, sospensione, tasto O, impostazione.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InterfacciaGioco, StoreImpostazioni, type DatiObiettivo } from '../../src/ui/index';
import { testoConTasti } from '../../src/ui/componenti/obiettivo';
import { SEZIONI_IMPOSTAZIONI } from '../../src/ui/componenti/impostazioni';

let ui: InterfacciaGioco;
let contenitore: HTMLDivElement;

function tasto(key: string): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  window.dispatchEvent(e);
  return e;
}

const PRIMO: DatiObiettivo = {
  chiave: 'prologo/pr_camminare',
  missione: 'Due secoli',
  indicazione: 'Cammina piano verso il muretto del belvedere e siediti (tieni {C}).',
  obiettivo: 'Le gambe. Due secoli. Piano.',
  altri: [],
};
const SECONDO: DatiObiettivo = {
  chiave: 'prologo/pr_lettera',
  missione: 'Due secoli',
  indicazione: 'Siediti (tieni {C}) e leggi fino in fondo la lettera di Marta: si apre da sola.',
  obiettivo: '«Per la mamma.»',
  altri: [{ indicazione: 'Vai alla Bacheca ({E}).' }, { titolo: 'Corbella a china', indicazione: 'Chiudi i lati.' }, { titolo: 'Troppo', indicazione: 'non si vede' }],
};

function crea(ridotto = true): void {
  contenitore = document.createElement('div');
  document.body.append(contenitore);
  ui = new InterfacciaGioco(contenitore, { impostazioni: new StoreImpostazioni({ archivio: null, predefinite: { riduciMovimenti: ridotto } }) });
  ui.obiettivo.show();
}

const pannello = () => ui.obiettivo.el.querySelector<HTMLElement>('.ui-ob-pannello')!;
const righe = () => [...ui.obiettivo.el.querySelectorAll<HTMLElement>('.ui-ob-indicazione')];
const segno = () => ui.obiettivo.el.querySelector<HTMLElement>('.ui-ob-segnalino')!;

afterEach(() => {
  ui.destroy();
  contenitore.remove();
});

describe('pannello dell’obiettivo', () => {
  beforeEach(() => crea());

  it('è montato fra le indicazioni e i modali, e senza dati non si vede', () => {
    const r = contenitore.querySelector('.ui-radice')!;
    const ordine = [...r.querySelectorAll('.ui-componente')].map((e) => e.classList[1]);
    expect(ordine.slice(0, 4)).toEqual(['ui-indicazioni', 'ui-obiettivo', 'ui-orologio', 'ui-modale']);
    expect(pannello().hidden).toBe(true);
    expect(ui.obiettivo.pannelloVisibile).toBe(false);
  });

  it('mostra la missione, l’indicazione con i tastini e l’obiettivo del Taccuino; al massimo due righe in più', () => {
    const nuovi: string[] = [];
    ui.obiettivo.on('nuovoObiettivo', (k) => nuovi.push(k));
    ui.obiettivo.aggiorna(SECONDO);
    expect(pannello().hidden).toBe(false);
    expect(pannello().querySelector('.ui-ob-missione')!.textContent).toBe('Due secoli');
    expect(righe()).toHaveLength(1);
    expect(righe()[0]!.textContent).toBe('Siediti (tieni C) e leggi fino in fondo la lettera di Marta: si apre da sola.');
    expect(righe()[0]!.querySelector('.ui-tasto')!.textContent).toBe('C');
    expect(pannello().querySelector('.ui-ob-obiettivo')!.textContent).toBe('«Per la mamma.»');
    const altri = [...pannello().querySelectorAll('.ui-ob-altro')].map((x) => x.textContent);
    expect(altri).toEqual(['Anche Vai alla Bacheca (E).', 'Corbella a china Chiudi i lati.']);
    expect(nuovi).toEqual(['prologo/pr_lettera']);
    // gli stessi dati non rifanno niente
    ui.obiettivo.aggiorna({ ...SECONDO });
    expect(nuovi).toHaveLength(1);
  });

  it('il passo nuovo barra il vecchio e lo sostituisce (subito, con «riduci i movimenti»)', () => {
    const nuovi: string[] = [];
    ui.obiettivo.on('nuovoObiettivo', (k) => nuovi.push(k));
    ui.obiettivo.aggiorna(PRIMO);
    ui.obiettivo.aggiorna(SECONDO);
    expect(nuovi).toEqual(['prologo/pr_camminare', 'prologo/pr_lettera']);
    expect(ui.obiettivo.el.querySelector('.ui-ob-nuovo')!.classList.contains('ui-ob-nuovo--si')).toBe(true);
    expect(pannello().querySelector('.ui-ob-obiettivo')!.textContent).toBe('«Per la mamma.»');
  });

  it('senza dati (nessuna missione) il pannello sparisce', () => {
    ui.obiettivo.aggiorna(PRIMO);
    ui.obiettivo.aggiorna(null);
    expect(pannello().hidden).toBe(true);
  });

  it('sospeso (dialoghi, scene): il passo nuovo aspetta e si annuncia quando il pannello torna', () => {
    const nuovi: string[] = [];
    ui.obiettivo.on('nuovoObiettivo', (k) => nuovi.push(k));
    ui.obiettivo.aggiorna(PRIMO);
    ui.obiettivo.sospendi(true);
    expect(ui.obiettivo.el.classList.contains('ui-ob--sospeso')).toBe(true);
    expect(ui.obiettivo.pannelloVisibile).toBe(false);
    ui.obiettivo.aggiorna(SECONDO);
    expect(nuovi).toEqual(['prologo/pr_camminare']);
    expect(righe()[0]!.textContent).toContain('Cammina piano');
    ui.obiettivo.sospendi(false);
    expect(nuovi).toEqual(['prologo/pr_camminare', 'prologo/pr_lettera']);
    expect(righe().at(-1)!.textContent).toContain('leggi fino in fondo la lettera');
  });

  it('i modali coprono il pannello (classe della radice) e prendono i tasti: O non passa al gioco', () => {
    ui.obiettivo.aggiorna(PRIMO);
    ui.apriTaccuino({ prossimoEvento: '', piste: [], parole: [] });
    expect(ui.radice.classList.contains('ui-con-modale')).toBe(true);
    tasto('o');
    expect(ui.obiettivo.nascostoDalGiocatore).toBe(false);
  });
});

describe('tasto O e impostazione «Indicazioni delle missioni»', () => {
  beforeEach(() => crea());

  it('O nasconde e rimostra il pannello, con una riga che lo ricorda', () => {
    ui.obiettivo.aggiorna(PRIMO);
    const alternati: boolean[] = [];
    ui.obiettivo.on('alternato', (v) => alternati.push(v));
    const e = tasto('o');
    expect(e.defaultPrevented).toBe(true);
    expect(ui.obiettivo.nascostoDalGiocatore).toBe(true);
    expect(ui.obiettivo.pannelloVisibile).toBe(false);
    expect(ui.obiettivo.el.classList.contains('ui-ob--nascosto')).toBe(true);
    const avviso = ui.obiettivo.el.querySelector<HTMLElement>('.ui-ob-avviso')!;
    expect(avviso.hidden).toBe(false);
    expect(avviso.textContent).toContain('mostra l’obiettivo');
    tasto('O');
    expect(ui.obiettivo.pannelloVisibile).toBe(true);
    expect(alternati).toEqual([false, true]);
  });

  it('dalla pausa: «Obiettivo a schermo» (o O) torna al gioco e nasconde il pannello', () => {
    ui.obiettivo.aggiorna(PRIMO);
    ui.apriPausa();
    const voce = [...ui.pausa.el.querySelectorAll<HTMLButtonElement>('.ui-voce')].find((b) => b.textContent?.includes('Obiettivo a schermo'))!;
    expect(voce.textContent).toContain('O');
    voce.click();
    expect(ui.pausa.visible).toBe(false);
    expect(ui.obiettivo.nascostoDalGiocatore).toBe(true);
    ui.apriPausa();
    tasto('o');
    expect(ui.pausa.visible).toBe(false);
    expect(ui.obiettivo.nascostoDalGiocatore).toBe(false);
  });

  it('di serie «Complete»; «Senza segnalino» spegne il segnalino; «Nessuna» anche il pannello, e O lo dice', () => {
    const riga = SEZIONI_IMPOSTAZIONI.flatMap((x) => x.righe).find((x) => 'chiave' in x && x.chiave === 'indicazioniMissioni') as { opzioni: { valore: string; etichetta: string }[] };
    expect(riga.opzioni.map((o) => o.etichetta)).toEqual(['Complete', 'Senza segnalino', 'Nessuna']);
    expect(ui.impostazioni.get('indicazioniMissioni')).toBe('complete');
    ui.obiettivo.aggiorna(PRIMO);
    ui.obiettivo.segnalino({ x: 300.4, y: 200.6, bordo: false, angolo: 0, distanza: '35 m', verticale: 'su' });
    expect(segno().hidden).toBe(false);
    expect(segno().style.transform).toBe('translate3d(300px, 201px, 0)');
    expect(segno().textContent).toBe('35 min su');
    expect(segno().classList.contains('ui-ob-segnalino--su')).toBe(true);
    ui.impostazioni.set('indicazioniMissioni', 'obiettivo');
    expect(segno().hidden).toBe(true);
    ui.obiettivo.segnalino({ x: 1, y: 1, bordo: false, angolo: 0, distanza: '3 m', verticale: null });
    expect(segno().hidden).toBe(true);
    expect(ui.obiettivo.pannelloVisibile).toBe(true);
    ui.impostazioni.set('indicazioniMissioni', 'nessuna');
    expect(ui.obiettivo.pannelloVisibile).toBe(false);
    expect(ui.obiettivo.el.classList.contains('ui-ob--nessuna')).toBe(true);
    tasto('o');
    expect(ui.obiettivo.nascostoDalGiocatore).toBe(false);
    expect(ui.obiettivo.el.querySelector('.ui-ob-avviso')!.textContent).toContain('spente');
  });

  it('alle spalle: «dietro» nell’etichetta, che sul fianco destro va verso il centro', () => {
    ui.obiettivo.aggiorna(PRIMO);
    ui.obiettivo.segnalino({ x: 1222, y: 446, bordo: true, angolo: 0, distanza: '40 m', verticale: null, dietro: true });
    expect(segno().textContent).toBe('40 mdietro');
    expect(segno().classList.contains('ui-ob-segnalino--dietro')).toBe(true);
    expect(segno().classList.contains('ui-ob-segnalino--fianco-destro')).toBe(true);
    ui.obiettivo.segnalino({ x: 640, y: 200, bordo: false, angolo: 0, distanza: '40 m', verticale: null });
    expect(segno().textContent).toBe('40 m');
    expect(segno().classList.contains('ui-ob-segnalino--fianco-destro')).toBe(false);
  });

  it('il segnalino sta sopra il pannello (dopo, nel DOM): una meta sulla carta non sparisce sotto', () => {
    const figli = [...ui.obiettivo.el.children];
    expect(figli.indexOf(segno())).toBeGreaterThan(figli.indexOf(pannello()));
  });

  it('il segnalino al bordo: la freccia girata verso la meta, l’etichetta dalla parte del centro', () => {
    ui.obiettivo.aggiorna(PRIMO);
    ui.obiettivo.segnalino({ x: 640, y: 525, bordo: true, angolo: Math.PI / 2, distanza: '12 m', verticale: null });
    expect(segno().classList.contains('ui-ob-segnalino--bordo')).toBe(true);
    expect(segno().classList.contains('ui-ob-segnalino--etichetta-sopra')).toBe(true);
    expect(ui.obiettivo.el.querySelector<SVGElement>('.ui-ob-freccia')!.style.transform).toBe('rotate(1.57rad)');
    ui.obiettivo.segnalino(null);
    expect(segno().hidden).toBe(true);
    // sospeso: niente segnalino anche se arriva
    ui.obiettivo.sospendi(true);
    ui.obiettivo.segnalino({ x: 10, y: 10, bordo: false, angolo: 0, distanza: '3 m', verticale: null });
    expect(segno().hidden).toBe(true);
  });
});

describe('attesa, ripresa, tastini', () => {
  beforeEach(() => crea());

  it('la riga dell’attesa sotto l’indicazione: cambiarla non è un obiettivo nuovo', () => {
    const nuovi: string[] = [];
    ui.obiettivo.on('nuovoObiettivo', (k) => nuovi.push(k));
    ui.obiettivo.aggiorna(PRIMO);
    const attesa = () => pannello().querySelector<HTMLElement>('.ui-ob-attesa')!;
    expect(attesa().hidden).toBe(true);
    ui.obiettivo.aggiorna({ ...PRIMO, attesa: 'Una novizia arriva alle 07:00: siediti ({C}) e aspetta ({X}).' });
    expect(attesa().hidden).toBe(false);
    expect(attesa().textContent).toBe('Una novizia arriva alle 07:00: siediti (C) e aspetta (X).');
    expect(attesa().querySelectorAll('.ui-tasto')).toHaveLength(2);
    ui.obiettivo.aggiorna(PRIMO);
    expect(attesa().hidden).toBe(true);
    expect(nuovi).toEqual(['prologo/pr_camminare']);
  });

  it('ripristina (dopo «Continua»): l’obiettivo torna senza «nuovo obiettivo», senza barrare il vecchio', () => {
    const nuovi: string[] = [];
    ui.obiettivo.on('nuovoObiettivo', (k) => nuovi.push(k));
    ui.obiettivo.aggiorna(PRIMO);
    ui.obiettivo.ripristina(SECONDO);
    expect(nuovi).toEqual(['prologo/pr_camminare']);
    expect(righe()).toHaveLength(1);
    expect(righe()[0]!.classList.contains('ui-ob-indicazione--conclusa')).toBe(false);
    expect(righe()[0]!.textContent).toContain('lettera di Marta');
    expect(ui.obiettivo.el.querySelector('.ui-ob-nuovo')!.classList.contains('ui-ob-nuovo--si')).toBe(false);
    expect(pannello().querySelector('.ui-ob-obiettivo')!.textContent).toBe('«Per la mamma.»');
    // lo stesso passo dopo non è nuovo; uno diverso sì
    ui.obiettivo.aggiorna(SECONDO);
    expect(nuovi).toHaveLength(1);
    ui.obiettivo.aggiorna(PRIMO);
    expect(nuovi).toEqual(['prologo/pr_camminare', 'prologo/pr_camminare']);
    // una partita nuova: niente di prima
    ui.obiettivo.ripristina(null);
    expect(righe()).toHaveLength(0);
    expect(pannello().hidden).toBe(true);
  });

  it('il tastino resta sulla riga della parola e della parentesi che lo precedono', () => {
    const div = document.createElement('div');
    div.append(...testoConTasti('Sul sagrato livella ({A} e {D}) e mira il campanile ({tasto destro}).'));
    const gruppi = [...div.querySelectorAll('.ui-ob-insieme')].map((g) => g.textContent);
    expect(gruppi).toEqual(['livella (A', 'e D)', 'campanile (tasto destro).']);
    expect(div.textContent).toBe('Sul sagrato livella (A e D) e mira il campanile (tasto destro).');
    const d2 = document.createElement('div');
    d2.append(...testoConTasti('Apri il Velo (tieni {Spazio} in aria).'));
    expect([...d2.querySelectorAll('.ui-ob-insieme')].map((g) => g.textContent)).toEqual(['(tieni Spazio']);
    expect(d2.textContent).toBe('Apri il Velo (tieni Spazio in aria).');
  });

  it('il pannello stringe le notifiche solo quando si vede (classe «con pannello»)', () => {
    const con = () => ui.obiettivo.el.classList.contains('ui-ob--con-pannello');
    expect(con()).toBe(false);
    ui.obiettivo.aggiorna(PRIMO);
    expect(con()).toBe(true);
    tasto('o');
    expect(con()).toBe(false);
    tasto('o');
    ui.impostazioni.set('indicazioniMissioni', 'nessuna');
    expect(con()).toBe(false);
  });
});

describe('con le animazioni', () => {
  beforeEach(() => crea(false));

  it('la riga vecchia resta barrata finché compare la nuova', () => {
    ui.obiettivo.aggiorna(PRIMO);
    ui.obiettivo.aggiorna(SECONDO);
    const r = righe();
    expect(r).toHaveLength(2);
    expect(r[0]!.classList.contains('ui-ob-indicazione--conclusa')).toBe(true);
    expect(r[0]!.getAttribute('aria-hidden')).toBe('true');
    expect(r[1]!.classList.contains('ui-ob-indicazione--entra')).toBe(true);
    expect(ui.obiettivo.el.querySelector('.ui-sr')!.textContent).toBe('Nuovo obiettivo: Siediti (tieni C) e leggi fino in fondo la lettera di Marta: si apre da sola.');
  });

  it('la riga barrata se ne va quando ha finito di svanire, o di riserva dopo un secondo', () => {
    vi.useFakeTimers();
    try {
      ui.obiettivo.aggiorna(PRIMO);
      ui.obiettivo.aggiorna(SECONDO);
      expect(righe()).toHaveLength(2);
      // la fine dello svanire la toglie (le altre animazioni della riga no)
      const vecchia = righe()[0]!;
      const fine = (nome: string): Event => Object.assign(new Event('animationend'), { animationName: nome });
      vecchia.dispatchEvent(fine('ui-ob-compari'));
      expect(righe()).toHaveLength(2);
      vecchia.dispatchEvent(fine('ui-ob-svanisci'));
      expect(righe()).toHaveLength(1);
      // senza animazioni (pannello nascosto): la riserva
      ui.obiettivo.aggiorna({ ...PRIMO, chiave: 'prologo/pr_campane' });
      expect(righe()).toHaveLength(2);
      vi.advanceTimersByTime(1100);
      expect(righe()).toHaveLength(1);
      expect(righe()[0]!.classList.contains('ui-ob-indicazione--conclusa')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
