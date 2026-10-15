import { Componente } from '../core/componente';
import { h, s } from '../core/dom';
import { FASCE_VERBANO, LUNGHEZZA_Z, fasciaDi, limitaVista, normalizzaGradi, scalaIntera, scalaMinima, type Vista } from '../pianta/geometria';
import { PittorePianta } from '../pianta/disegno';
import { nomeCatastale, type DatiPianta, type ParticellaPianta } from '../pianta/modello';
import './pianta.css';

export interface EventiPianta {
  chiudi: void;
  /** Clic su un punto della Pianta: coordinate del mondo e particella con nome (se c'è). */
  punto: { z: number; theta: number; particella: ParticellaPianta | null };
}

export interface OpzioniPianta {
  /** Mostrare la rosa dei venti (impostazione). */
  rosaDeiVenti?: () => boolean;
  /** Mostrare la posizione di Elvira (impostazione). */
  posizione?: () => boolean;
  /** Matita marcata (impostazione di accessibilità). */
  matitaMarcata?: () => boolean;
}

const NOMI_STATO = ['mai vista', 'vista con lo squadro, a matita', 'rilevata'];
const NOMI_SALUTE = ['', 'sana', 'malata, bruna', 'spenta, grigia'];

/**
 * La Pianta del Verbano a tutto schermo: il cilindro srotolato (z da 0 a 3000 in orizzontale, θ in verticale,
 * chiuso su sé stesso). Trascina o usa le frecce per scorrere, rotella o +/− per ingrandire, C per centrare su Elvira.
 */
export class PiantaVerbano extends Componente<EventiPianta> {
  private readonly canvas: HTMLCanvasElement;
  private readonly area: HTMLDivElement;
  private readonly pittore: PittorePianta;
  private readonly sottotitolo: HTMLParagraphElement;
  private readonly didascalia: HTMLParagraphElement;
  private readonly rosa: HTMLDivElement;
  private readonly scalaGrafica: HTMLDivElement;
  private readonly resoconto: HTMLDivElement;
  private readonly opz: OpzioniPianta;
  private dati: DatiPianta = { capisaldi: [] };
  private vista: Vista = { zc: LUNGHEZZA_Z / 2, tc: 45, scala: 0.4 };
  private evidenzia: string | null = null;
  private richiesta = 0;
  private trascina: { id: number; x: number; y: number; vista: Vista; mosso: boolean } | null = null;
  private osservatore: ResizeObserver | null = null;
  private primaVolta = true;

  constructor(opz: OpzioniPianta = {}) {
    super({ classe: 'ui-modale ui-pianta', modale: true, ruolo: 'dialog', etichetta: 'Pianta del Verbano' });
    this.opz = opz;
    this.canvas = h('canvas', { class: 'ui-pt-canvas', role: 'img', tabindex: 0 });
    this.pittore = new PittorePianta(this.canvas);
    this.area = h('div', { class: 'ui-pt-area' }, this.canvas);

    this.sottotitolo = h('p', { class: 'ui-pt-sottotitolo' });
    this.didascalia = h('p', { class: 'ui-pt-didascalia', 'aria-live': 'polite' });
    this.scalaGrafica = h('div', { class: 'ui-pt-scala', 'aria-hidden': 'true' });
    const voceLegenda = (classe: string, testo: string): HTMLLIElement => h('li', null, h('span', { class: `ui-pt-campione ${classe}`, 'aria-hidden': 'true' }), testo);
    const legenda = h(
      'div',
      { class: 'ui-pt-legenda' },
      h('h3', { class: 'ui-titoletto' }, 'Legenda'),
      h(
        'ul',
        null,
        voceLegenda('ui-pt-campione--bianco', 'mai vista'),
        voceLegenda('ui-pt-campione--matita', 'a matita'),
        voceLegenda('ui-pt-campione--rilevato', 'rilevata'),
        voceLegenda('ui-pt-campione--cambiata', 'cambiata'),
        voceLegenda('ui-pt-campione--caposaldo', 'capisaldi'),
        voceLegenda('ui-pt-campione--finestra', 'Finestra'),
      ),
    );

    this.rosa = h('div', { class: 'ui-pt-rosa' }, rosaDeiVenti());
    this.area.append(this.rosa);
    this.resoconto = h('div', { class: 'ui-pt-resoconto', hidden: true, role: 'region', 'aria-label': 'Resoconto del mattino' });

    const bottone = (testo: string, etichetta: string, fn: () => void, classe = ''): HTMLButtonElement =>
      h('button', { class: `ui-bottone ui-pt-bottone ${classe}`, type: 'button', 'aria-label': etichetta, title: etichetta, onclick: fn }, testo);
    const comandi = h(
      'div',
      { class: 'ui-pt-comandi' },
      bottone('+', 'Ingrandisci', () => this.zoom(1.4)),
      bottone('−', 'Rimpicciolisci', () => this.zoom(1 / 1.4)),
      bottone('Elvira', 'Centra su Elvira (C)', () => this.centraSuElvira(true), 'ui-pt-bottone--testo'),
    );
    const bChiudi = h(
      'button',
      { class: 'ui-bottone ui-pt-chiudi', type: 'button', onclick: () => this.emit('chiudi') },
      h('span', { class: 'ui-tasto', 'aria-hidden': 'true' }, 'Esc'),
      'Chiudi',
    );
    const aiuto = h(
      'p',
      { class: 'ui-pt-aiuto' },
      'Trascina o usa ',
      h('span', { class: 'ui-tasto' }, '←'),
      h('span', { class: 'ui-tasto' }, '↑'),
      h('span', { class: 'ui-tasto' }, '↓'),
      h('span', { class: 'ui-tasto' }, '→'),
      ' per scorrere; rotella o ',
      h('span', { class: 'ui-tasto' }, '+'),
      h('span', { class: 'ui-tasto' }, '−'),
      ' per ingrandire; ',
      h('span', { class: 'ui-tasto' }, '0'),
      ' tutto il giro; ',
      h('span', { class: 'ui-tasto' }, 'C'),
      ' su Elvira.',
    );
    const lato = h(
      'aside',
      { class: 'ui-pt-lato' },
      h('div', { class: 'ui-pt-chiudi-riga' }, bChiudi),
      h('header', { class: 'ui-pt-testa' }, h('h2', { class: 'ui-pt-titolo' }, 'Pianta del Verbano'), this.sottotitolo),
      h('div', { class: 'ui-pt-strumenti' }, this.scalaGrafica, comandi),
      this.didascalia,
      this.resoconto,
      legenda,
    );
    this.area.append(aiuto);

    this.el.append(
      h('div', { class: 'ui-velo ui-velo--scuro', 'aria-hidden': 'true' }),
      h('div', { class: 'ui-carta ui-pt-foglio' }, this.area, lato),
    );
    this.collegaInput();
  }

  /** Apre la Pianta con i dati (stati delle particelle, capisaldi, posizione di Elvira). */
  show(dati?: DatiPianta): void {
    if (dati) this.impostaDati(dati);
    this.apri();
    this.osservaDimensioni();
    this.ridimensiona();
    if (this.primaVolta) {
      this.primaVolta = false;
      this.vistaIntera();
    }
    this.centraSuElvira(false);
    this.ridisegna();
    // Ridisegna quando i caratteri sono pronti (le etichette su canvas li usano).
    document.fonts?.ready.then(() => this.ridisegna());
  }

  /** Aggiorna i dati (anche a Pianta aperta). */
  aggiorna(dati: DatiPianta): void {
    this.impostaDati(dati);
    this.ridisegna();
  }

  /** Centra la vista su un punto. */
  centraSu(z: number, theta: number): void {
    this.vista = { ...this.vista, zc: z, tc: this.tVicino(theta) };
    this.limita();
    this.ridisegna();
  }

  /** Imposta l'ingrandimento (1 = cilindro intero in larghezza). */
  impostaZoom(fattore: number): void {
    this.vista = { ...this.vista, scala: scalaIntera(this.pittore.larghezzaUtile) * fattore };
    this.limita();
    this.ridisegna();
  }

  override gestisciTasto(e: KeyboardEvent): boolean {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const passoX = 120 / this.vista.scala;
    const passoT = 120 / (this.vista.scala * ((2 * Math.PI * 646) / 360));
    switch (e.key) {
      case 'Escape':
      case 'p':
      case 'P':
        this.emit('chiudi');
        return true;
      case 'ArrowLeft':
        this.sposta(-passoX, 0);
        return true;
      case 'ArrowRight':
        this.sposta(passoX, 0);
        return true;
      case 'ArrowUp':
        this.sposta(0, passoT);
        return true;
      case 'ArrowDown':
        this.sposta(0, -passoT);
        return true;
      case '+':
      case '=':
        this.zoom(1.4);
        return true;
      case '-':
      case '_':
        this.zoom(1 / 1.4);
        return true;
      case 'c':
      case 'C':
        this.centraSuElvira(true);
        return true;
      case '0':
      case 'Home':
        // Alterna «tutto il giro» e «tutto il cilindro in larghezza».
        if (Math.abs(this.vista.scala - scalaMinima(this.pittore.larghezzaUtile, this.pittore.altezzaRegione)) < 1e-6) this.vistaIntera();
        else this.vista = { ...this.vista, zc: LUNGHEZZA_Z / 2, scala: scalaMinima(this.pittore.larghezzaUtile, this.pittore.altezzaRegione) };
        this.limita();
        this.ridisegna();
        return true;
      default:
        return false;
    }
  }

  protected override focusIniziale(): HTMLElement | null {
    return this.canvas;
  }

  protected override quandoNascosto(): void {
    this.osservatore?.disconnect();
    this.osservatore = null;
  }

  // ---------- interni ----------

  private impostaDati(dati: DatiPianta): void {
    this.dati = dati;
    this.pittore.impostaDati(dati);
    const c = this.pittore.modelloCorrente.conteggi();
    const totale = dati.totaleParticelle;
    const capisaldi = dati.capisaldi.filter((x) => x.rilevato).length;
    const rilevate = dati.griglia || !dati.particelle?.length ? c.rilevato : dati.particelle.filter((p) => p.stato === 'rilevato').length;
    const parti = [
      totale
        ? `${rilevate.toLocaleString('it-IT')} particelle rilevate su ${totale.toLocaleString('it-IT')}`
        : `${rilevate.toLocaleString('it-IT')} ${rilevate === 1 ? 'particella rilevata' : 'particelle rilevate'}`,
      `${capisaldi} ${capisaldi === 1 ? 'caposaldo' : 'capisaldi'}`,
    ];
    this.sottotitolo.textContent = parti.join(' · ');
    this.disegnaResoconto();
    const dove = dati.elvira ? fasciaDi(dati.elvira.theta, dati.fasce ?? FASCE_VERBANO)?.nome : undefined;
    this.canvas.setAttribute(
      'aria-label',
      `Pianta del Verbano: ${parti.join(', ')}.${dove ? ` Elvira è in ${dove}, a ${Math.round(dati.elvira!.z)} metri dal Tappo Sud.` : ''}`,
    );
  }

  private disegnaResoconto(): void {
    const r = this.dati.resoconto;
    this.resoconto.hidden = !r;
    if (!r) return;
    this.resoconto.replaceChildren(
      h('h3', { class: 'ui-pt-resoconto-titolo' }, 'Stanotte'),
      r.righe.length
        ? h('ul', null, r.righe.map((x) => h('li', null, x)))
        : h('p', { class: 'ui-pt-resoconto-quieta' }, 'Notte quieta.'),
      ...(r.prossimaFinestra ? [h('p', { class: 'ui-pt-resoconto-finestra' }, r.prossimaFinestra)] : []),
    );
  }

  private osservaDimensioni(): void {
    if (this.osservatore || typeof ResizeObserver === 'undefined') return;
    this.osservatore = new ResizeObserver(() => {
      this.ridimensiona();
      this.ridisegna();
    });
    this.osservatore.observe(this.area);
  }

  private ridimensiona(): void {
    const r = this.area.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const sIntera = scalaIntera(this.pittore.larghezzaUtile);
    const fattore = this.vista.scala / sIntera;
    this.pittore.ridimensiona(r.width, r.height, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
    this.vista = { ...this.vista, scala: scalaIntera(this.pittore.larghezzaUtile) * (Number.isFinite(fattore) ? fattore : 1) };
    this.limita();
  }

  private vistaIntera(): void {
    this.vista = { zc: LUNGHEZZA_Z / 2, tc: this.vista.tc, scala: scalaIntera(this.pittore.larghezzaUtile) };
  }

  private centraSuElvira(animato: boolean): void {
    const e = this.dati.elvira;
    if (!e) return;
    const intera = this.vista.scala <= scalaIntera(this.pittore.larghezzaUtile) + 1e-6;
    this.vista = { ...this.vista, zc: intera ? this.vista.zc : e.z, tc: this.tVicino(e.theta) };
    this.limita();
    if (animato) this.ridisegna();
  }

  /** θ equivalente a `theta` più vicino al centro attuale (per non saltare di un giro). */
  private tVicino(theta: number): number {
    const d = normalizzaGradi(theta - this.vista.tc);
    return this.vista.tc + (d > 180 ? d - 360 : d);
  }

  private sposta(dz: number, dt: number): void {
    this.vista = { ...this.vista, zc: this.vista.zc + dz, tc: this.vista.tc + dt };
    this.limita();
    this.ridisegna();
  }

  private zoom(f: number, cx?: number, cy?: number): void {
    const { larghezza, altezza } = this.pittore.misure;
    const x = cx ?? larghezza / 2;
    const y = cy ?? altezza / 2;
    const prima = this.pittore.mondoIn(this.vista, x, y);
    this.vista = { ...this.vista, scala: this.vista.scala * f };
    this.limita();
    if (prima) {
      const dopo = this.pittore.mondoIn(this.vista, x, y);
      if (dopo) this.vista = { ...this.vista, zc: this.vista.zc + (prima.z - dopo.z), tc: this.vista.tc + (prima.theta - dopo.theta) };
      this.limita();
    }
    this.ridisegna();
  }

  private limita(): void {
    // Tiene θ del centro vicino a [0, 360) senza cambiare ciò che si vede.
    const tc = this.vista.tc;
    const giri = Math.floor(tc / 360);
    this.vista = limitaVista({ ...this.vista, tc: tc - giri * 360 }, this.pittore.larghezzaRegione, this.pittore.larghezzaUtile, this.pittore.altezzaRegione);
  }

  /** Ridisegna la Pianta al prossimo fotogramma (es. dopo un cambio di impostazioni). */
  ridisegna(): void {
    if (this.richiesta) return;
    this.richiesta = requestAnimationFrame(() => {
      this.richiesta = 0;
      if (!this.visible) return;
      this.rosa.hidden = this.opz.rosaDeiVenti ? !this.opz.rosaDeiVenti() : false;
      this.pittore.disegna(this.vista, {
        posizione: this.opz.posizione ? this.opz.posizione() : true,
        contrasto: !!this.el.closest('.ui-contrasto'),
        marcata: this.opz.matitaMarcata ? this.opz.matitaMarcata() : !!this.el.closest('.ui-matita-marcata'),
        evidenzia: this.evidenzia,
      });
      this.aggiornaScala();
    });
  }

  private aggiornaScala(): void {
    // Scala grafica: il segmento «tondo» più lungo che sta in 160 px.
    const metriPer160 = 160 / this.vista.scala;
    const tondi = [50, 100, 200, 250, 500, 1000];
    const m = tondi.filter((x) => x <= metriPer160).pop() ?? 50;
    const px = m * this.vista.scala;
    this.scalaGrafica.replaceChildren(
      h('span', { class: 'ui-pt-scala-barra', style: `width:${px.toFixed(0)}px` }, h('span'), h('span')),
      h('span', { class: 'ui-pt-scala-testo' }, `${m.toLocaleString('it-IT')} m`),
    );
  }

  private descriviPunto(x: number, y: number): void {
    const w = this.pittore.mondoIn(this.vista, x, y);
    if (!w || w.z < 0 || w.z > LUNGHEZZA_Z) {
      this.didascalia.textContent = '';
      if (this.evidenzia) {
        this.evidenzia = null;
        this.ridisegna();
      }
      return;
    }
    const m = this.pittore.modelloCorrente;
    const i = m.indice(w.z, w.theta);
    const stato = m.stati[i] ?? 0;
    const fascia = fasciaDi(w.theta, this.dati.fasce ?? FASCE_VERBANO);
    const p = this.pittore.particellaIn(w.z, w.theta);
    const parti: string[] = [];
    if (p?.nome && p.stato !== 'bianco') parti.push(p.nome);
    const catasto = nomeCatastale(Math.floor(i / m.nTheta), i % m.nTheta, m.nTheta);
    if (catasto && stato > 0) parti.push(`particella ${catasto}`);
    if (fascia) parti.push(fascia.nome);
    parti.push(`z ${Math.round(w.z).toLocaleString('it-IT')} m, θ ${Math.round(normalizzaGradi(w.theta))}°`);
    let statoTesto = NOMI_STATO[stato] ?? '';
    if (stato >= 2 && m.salute[i]) statoTesto += `, ${NOMI_SALUTE[m.salute[i]!]}`;
    if (m.cambiate[i]) statoTesto += ', cambiata stanotte';
    if (fascia?.tipo !== 'finestra') parti.push(statoTesto);
    this.didascalia.textContent = parti.join(' · ');
    const id = p && p.stato !== 'bianco' ? p.id : null;
    if (id !== this.evidenzia) {
      this.evidenzia = id;
      this.ridisegna();
    }
  }

  private collegaInput(): void {
    const c = this.canvas;
    const locale = (e: { clientX: number; clientY: number }): [number, number] => {
      const r = c.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    c.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      c.setPointerCapture(e.pointerId);
      this.trascina = { id: e.pointerId, x: e.clientX, y: e.clientY, vista: { ...this.vista }, mosso: false };
      c.classList.add('ui-pt-presa');
    });
    c.addEventListener('pointermove', (e) => {
      const t = this.trascina;
      if (t && t.id === e.pointerId) {
        const dx = e.clientX - t.x;
        const dy = e.clientY - t.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) t.mosso = true;
        const mpg = (2 * Math.PI * 646) / 360;
        this.vista = { ...t.vista, zc: t.vista.zc - dx / t.vista.scala, tc: t.vista.tc + dy / (t.vista.scala * mpg) };
        this.limita();
        this.ridisegna();
        return;
      }
      const [x, y] = locale(e);
      this.descriviPunto(x, y);
    });
    const fine = (e: PointerEvent): void => {
      const t = this.trascina;
      if (!t || t.id !== e.pointerId) return;
      this.trascina = null;
      c.classList.remove('ui-pt-presa');
      if (!t.mosso && e.type === 'pointerup') {
        const [x, y] = locale(e);
        const w = this.pittore.mondoIn(this.vista, x, y);
        if (w && w.z >= 0 && w.z <= LUNGHEZZA_Z) {
          this.emit('punto', { z: w.z, theta: normalizzaGradi(w.theta), particella: this.pittore.particellaIn(w.z, w.theta) ?? null });
        }
      }
    };
    c.addEventListener('pointerup', fine);
    c.addEventListener('pointercancel', fine);
    c.addEventListener('pointerleave', () => {
      if (!this.trascina) this.didascalia.textContent = '';
    });
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const [x, y] = locale(e);
        if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) this.zoom(Math.exp(-e.deltaY * 0.0018), x, y);
        else this.sposta(e.deltaX / this.vista.scala, 0);
      },
      { passive: false },
    );
  }
}

/** Rosa dei venti locale: Mane in alto (verso della rotazione), Sera in basso, i Tappi ai lati, «in su» al centro. */
function rosaDeiVenti(): SVGSVGElement {
  // Unità del viewBox = pixel: le scritte restano di almeno 16 px.
  const svg = s('svg', {
    viewBox: '-130 -100 260 200',
    width: 260,
    height: 200,
    role: 'img',
    'aria-label': 'Rosa dei venti: Mane in alto, Sera in basso, a Mont il Tappo Sud a sinistra, a Lag il Tappo Nord a destra, «in su» verso l\u2019asse',
  });
  const punta = (ang: number, lung: number, larg: number, scura: boolean): SVGElement => {
    const g = s('g', { transform: `rotate(${ang})` });
    g.append(
      s('path', { d: `M0 ${-lung} L${larg} 0 L0 0 Z`, class: scura ? 'ui-rosa-scuro' : 'ui-rosa-chiaro' }),
      s('path', { d: `M0 ${-lung} L${-larg} 0 L0 0 Z`, class: scura ? 'ui-rosa-chiaro' : 'ui-rosa-scuro' }),
    );
    return g;
  };
  svg.append(
    s('circle', { r: 34, class: 'ui-rosa-anello' }),
    s('circle', { r: 30.5, class: 'ui-rosa-anello-fine' }),
    punta(45, 24, 6, false),
    punta(135, 24, 6, false),
    punta(225, 24, 6, false),
    punta(315, 24, 6, false),
    punta(0, 56, 9, true),
    punta(90, 46, 8, true),
    punta(180, 46, 8, true),
    punta(270, 46, 8, true),
    // «In su»: verso l'asse, cioè fuori dal foglio, verso chi guarda.
    s('circle', { r: 8, class: 'ui-rosa-insu' }),
    s('circle', { r: 2.4, class: 'ui-rosa-insu-punto' }),
    s('text', { x: 0, y: -64, class: 'ui-rosa-testo', 'text-anchor': 'middle' }, 'Mane'),
    s('text', { x: 0, y: 66, class: 'ui-rosa-testo', 'text-anchor': 'middle', 'dominant-baseline': 'hanging' }, 'Sera'),
    s('text', { x: -54, y: 0, class: 'ui-rosa-testo', 'text-anchor': 'end' }, 'Mont'),
    s('text', { x: -54, y: 18, class: 'ui-rosa-sotto', 'text-anchor': 'end' }, 'Tappo Sud'),
    s('text', { x: 54, y: 0, class: 'ui-rosa-testo', 'text-anchor': 'start' }, 'Lag'),
    s('text', { x: 54, y: 18, class: 'ui-rosa-sotto', 'text-anchor': 'start' }, 'Tappo Nord'),
    s('text', { x: 13, y: -13, class: 'ui-rosa-insu-testo', 'text-anchor': 'start' }, 'in su'),
  );
  return svg;
}
