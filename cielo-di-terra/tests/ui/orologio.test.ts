// @vitest-environment happy-dom
/**
 * L'orologio a schermo (src/ui/componenti/orologio.ts) dentro l'interfaccia: l'ora e il giorno,
 * il sole o la luna sul loro arco, la notte, le cifre che corrono nell'attesa, l'impostazione
 * «Orologio a schermo», le notifiche che gli scendono sotto, i modali che lo coprono (non il
 * dialogo).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InterfacciaGioco, StoreImpostazioni, arcoAstro, cieloQuadrante, eNotteOrologio, testoOrologio } from '../../src/ui/index';
import { SEZIONI_IMPOSTAZIONI } from '../../src/ui/componenti/impostazioni';

let ui: InterfacciaGioco;
let contenitore: HTMLDivElement;

function crea(): void {
  contenitore = document.createElement('div');
  document.body.append(contenitore);
  ui = new InterfacciaGioco(contenitore, { impostazioni: new StoreImpostazioni({ archivio: null, predefinite: { riduciMovimenti: true } }) });
  ui.orologio.show();
}

const radice = () => contenitore.querySelector<HTMLElement>('.ui-radice')!;
const ora = () => ui.orologio.el.querySelector<HTMLElement>('.ui-or-ora')!.textContent;
const sotto = () => ui.orologio.el.querySelector<HTMLElement>('.ui-or-sotto')!.textContent;
const numero = () => ui.orologio.el.querySelector<HTMLElement>('.ui-or-n')!.textContent;
const astro = () => ui.orologio.el.querySelector<SVGGElement>('.ui-or-astro')!.getAttribute('transform');

beforeEach(() => crea());
afterEach(() => {
  ui.destroy();
  contenitore.remove();
});

describe('la matematica dell\'orologio', () => {
  it('scrive HH:MM come un orologio vero (i minuti non si arrotondano in avanti)', () => {
    expect(testoOrologio(7.5)).toBe('07:30');
    expect(testoOrologio(19.5)).toBe('19:30');
    expect(testoOrologio(19.4999)).toBe('19:29');
    expect(testoOrologio(5 + 38 / 60)).toBe('05:38');
    expect(testoOrologio(0)).toBe('00:00');
    expect(testoOrologio(23.99)).toBe('23:59');
    expect(testoOrologio(24)).toBe('00:00');
  });

  it('il sole va da un orizzonte all\'altro dalle 05:30 alle 21:00; la luna di notte', () => {
    expect(arcoAstro(5.5)).toBeCloseTo(0, 9);
    expect(arcoAstro(13.25)).toBeCloseTo(0.5, 9);
    expect(arcoAstro(20.99)).toBeLessThan(1);
    expect(arcoAstro(21)).toBeCloseTo(0, 9);
    expect(arcoAstro(1.25)).toBeCloseTo(0.5, 9);
    expect(eNotteOrologio(21)).toBe(true);
    expect(eNotteOrologio(5.49)).toBe(true);
    expect(eNotteOrologio(5.5)).toBe(false);
    expect(eNotteOrologio(12)).toBe(false);
  });

  it('il cielo del quadrante è chiaro di giorno, blu inchiostro di notte, caldo all\'alba e al tramonto', () => {
    const luce = (c: string) => [1, 3, 5].reduce((s, i) => s + parseInt(c.slice(i, i + 2), 16), 0) / 3;
    const [giornoAlto] = cieloQuadrante(12);
    const [notteAlto] = cieloQuadrante(1);
    expect(luce(giornoAlto)).toBeGreaterThan(luce(notteAlto) + 80);
    const [, tramonto] = cieloQuadrante(19.5);
    expect(parseInt(tramonto.slice(1, 3), 16)).toBeGreaterThan(parseInt(tramonto.slice(5, 7), 16));
    // continuo: da un minuto all'altro i colori cambiano poco
    for (let o = 0; o < 24; o += 1 / 60) {
      const [a] = cieloQuadrante(o);
      const [b] = cieloQuadrante(o + 1 / 60);
      expect(Math.abs(luce(a) - luce(b))).toBeLessThan(4);
    }
  });
});

describe('l\'orologio a schermo', () => {
  it('è montato dopo le indicazioni e il pannello, prima dei modali, e non prende il mouse', () => {
    const ordine = [...radice().querySelectorAll('.ui-componente')].map((e) => e.classList[1]);
    expect(ordine.indexOf('ui-orologio')).toBe(2);
    expect(ui.orologio.modale).toBe(false);
  });

  it('mostra l\'ora e il giorno; di notte la luna e le stelle', () => {
    ui.orologio.aggiorna({ giorno: 1, ore: 7 + 42 / 60 });
    expect(ora()).toBe('07:42');
    expect(sotto()).toBe('giorno 1');
    expect(ui.orologio.el.classList.contains('ui-orologio--notte')).toBe(false);
    const t1 = astro();
    ui.orologio.aggiorna({ giorno: 1, ore: 12 });
    expect(astro()).not.toBe(t1);
    ui.orologio.aggiorna({ giorno: 2, ore: 22.25 });
    expect(ora()).toBe('22:15');
    expect(sotto()).toBe('giorno 2');
    expect(ui.orologio.el.classList.contains('ui-orologio--notte')).toBe(true);
    expect(ui.orologio.el.querySelector('.ui-or-carta')!.getAttribute('aria-label')).toBe('Giorno 2, ore 22:15');
  });

  it('nell\'attesa le cifre corrono e la seconda riga dice fino a che ora', () => {
    const viste: string[] = [];
    ui.orologio.aggiorna({ giorno: 1, ore: 9, verso: 19.5 });
    expect(sotto()).toBe('fino alle 19:30');
    expect(numero()).toBe('19:30');
    expect(ui.orologio.el.classList.contains('ui-orologio--corre')).toBe(true);
    for (let o = 9; o <= 19.5; o += 0.37) {
      ui.orologio.aggiorna({ giorno: 1, ore: o, verso: 19.5 });
      viste.push(ora()!);
    }
    expect(new Set(viste).size).toBe(viste.length);
    ui.orologio.aggiorna({ giorno: 1, ore: 19.5, verso: null });
    expect(ora()).toBe('19:30');
    expect(sotto()).toBe('giorno 1');
    expect(ui.orologio.el.classList.contains('ui-orologio--corre')).toBe(false);
  });

  it('scrive nel DOM solo quando cambia il minuto', () => {
    ui.orologio.aggiorna({ giorno: 1, ore: 10 });
    const nodo = ui.orologio.el.querySelector('.ui-or-ora')!;
    let cambi = 0;
    const oss = new MutationObserver((m) => (cambi += m.length));
    oss.observe(ui.orologio.el, { subtree: true, childList: true, characterData: true, attributes: true });
    for (let i = 0; i < 50; i++) ui.orologio.aggiorna({ giorno: 1, ore: 10 + i / 6000 });
    return new Promise<void>((ok) =>
      setTimeout(() => {
        oss.disconnect();
        expect(cambi).toBe(0);
        expect(nodo.textContent).toBe('10:00');
        ok();
      }, 0),
    );
  });

  it('«Orologio a schermo» (Aiuti) è acceso di serie e lo toglie; le notifiche gli scendono sotto', () => {
    const riga = SEZIONI_IMPOSTAZIONI.flatMap((x) => x.righe).find((x) => x.chiave === 'orologioSchermo');
    expect(riga?.etichetta).toBe('Orologio a schermo');
    expect(SEZIONI_IMPOSTAZIONI.find((x) => x.righe.includes(riga!))?.id).toBe('aiuti');
    expect(ui.impostazioni.get('orologioSchermo')).toBe(true);
    expect(radice().classList.contains('ui-con-orologio')).toBe(true);
    expect(ui.orologio.attivo).toBe(true);
    ui.impostazioni.set('orologioSchermo', false);
    expect(ui.orologio.el.classList.contains('ui-orologio--spento')).toBe(true);
    expect(radice().classList.contains('ui-con-orologio')).toBe(false);
    expect(ui.orologio.attivo).toBe(false);
    expect(ui.orologio.area()).toBeNull();
    ui.impostazioni.set('orologioSchermo', true);
    expect(radice().classList.contains('ui-con-orologio')).toBe(true);
    ui.orologio.hide();
    expect(radice().classList.contains('ui-con-orologio')).toBe(false);
  });

  it('sotto il dialogo resta; sotto la pausa (e le carte) la radice lo dice al foglio di stile', () => {
    ui.dialogo.show({ chi: 'Ottavio', testo: 'Ciao.' });
    expect(radice().classList.contains('ui-con-modale')).toBe(true);
    expect(radice().classList.contains('ui-solo-dialogo')).toBe(true);
    ui.apriPausa();
    expect(radice().classList.contains('ui-solo-dialogo')).toBe(false);
    ui.pausa.hide();
    expect(radice().classList.contains('ui-solo-dialogo')).toBe(true);
    ui.dialogo.hide();
    expect(radice().classList.contains('ui-con-modale')).toBe(false);
    expect(radice().classList.contains('ui-solo-dialogo')).toBe(false);
  });
});
