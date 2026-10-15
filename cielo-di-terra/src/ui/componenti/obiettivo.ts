import { Componente } from '../core/componente';
import { h, s } from '../core/dom';
import { nodiTesto } from '../core/testo';
import type { Impostazioni } from '../impostazioni/store';
import './obiettivo.css';

/**
 * Indicazioni delle missioni (Impostazioni › Aiuti): pannello e segnalino («complete», di serie),
 * pannello senza segnalino («obiettivo»), niente (come voleva il GDD: «nessuna»).
 */
export type IndicazioniMissioni = Impostazioni['indicazioniMissioni'];

/** Una riga in più sotto l'obiettivo seguito: un altro passo attivo o una missione secondaria. */
export interface VoceObiettivo {
  /** Titolo della missione (assente per un altro passo della stessa missione). */
  titolo?: string;
  indicazione: string;
}

/** Che cosa mostra il pannello: la missione principale e il passo che il giocatore segue. */
export interface DatiObiettivo {
  /** Identità del passo seguito («missione/passo»): quando cambia, parte l'animazione «nuovo obiettivo». */
  chiave: string;
  /** Titolo della missione principale (in piccolo, in alto). */
  missione: string;
  /** Indicazione pratica: che cosa fare, dove, con quale tasto (i tasti fra graffe: «Siediti {C}»). */
  indicazione: string;
  /** L'obiettivo del Taccuino, poetico (più piccolo, a matita). */
  obiettivo?: string;
  /** Al massimo due righe in più (passi paralleli, missioni secondarie). */
  altri?: readonly VoceObiettivo[];
  /**
   * Una riga sotto l'indicazione quando la meta non c'è ancora: «Adesso non c'è nessuno con cui
   * parlare: … arriva alle 07:00» (i tasti fra graffe). Cambiarla non è un obiettivo nuovo.
   */
  attesa?: string;
}

/** Il segnalino di direzione, già proiettato sullo schermo dalla regia. */
export interface StatoSegnalino {
  /** Posizione in px nel riquadro dell'interfaccia. */
  x: number;
  y: number;
  /** Appoggiato al bordo: la meta è fuori dallo schermo o dietro. */
  bordo: boolean;
  /** Direzione (rad) verso cui girarsi, sullo schermo: 0 = destra, π/2 = giù. */
  angolo: number;
  /** Distanza già scritta («120 m», «1,8 km»). */
  distanza: string;
  /** La meta è molto più in alto («in su») o più in basso («sotto»). */
  verticale: 'su' | 'giu' | null;
  /** La meta è alle spalle: la freccia sta sul fianco, verso cui girarsi, con «dietro». */
  dietro?: boolean;
}

export interface OpzioniPannelloObiettivo {
  /** L'impostazione «Indicazioni delle missioni» (predefinita: complete). */
  modo?: () => IndicazioniMissioni;
}

export interface EventiPannelloObiettivo {
  /** È comparso un obiettivo nuovo (dopo l'animazione del passo concluso): la chiave. */
  nuovoObiettivo: string;
  /** Il tasto O ha mostrato (true) o nascosto (false) il pannello. */
  alternato: boolean;
}

/** Quanto resta la riga barrata (ms): la matita la barra, poi svanisce (obiettivo.css). */
const DURATA_BARRA = 1000;

/**
 * Testo con i tasti fra graffe: i tasti diventano tastini, il resto è testo con il markup dei
 * testi. Ogni tastino sta su una riga sola con la parola che lo precede e la sua parentesi
 * («campanile (» + tasto + «).»), così l'a capo non lascia una parentesi aperta in fondo alla riga.
 */
export function testoConTasti(testo: string): Node[] {
  const parti = testo.split(/\{([^}]+)\}/);
  const out: Node[] = [];
  let resto = parti[0] ?? '';
  for (let i = 1; i < parti.length; i += 2) {
    // davanti: l'ultima parola, con lo spazio o la parentesi che la attacca al tasto
    const davanti = /\S*\s?\S*$/.exec(resto)?.[0] ?? '';
    const dopo = parti[i + 1] ?? '';
    // dietro: la punteggiatura attaccata al tasto («).», «,»)
    const coda = /^[^\s{]*/.exec(dopo)?.[0] ?? '';
    if (resto.length > davanti.length) out.push(nodiTesto(resto.slice(0, resto.length - davanti.length)));
    out.push(h('span', { class: 'ui-ob-insieme' }, nodiTesto(davanti), h('span', { class: 'ui-tasto ui-ob-tasto' }, parti[i]!), nodiTesto(coda)));
    resto = dopo.slice(coda.length);
  }
  if (resto) out.push(nodiTesto(resto));
  return out;
}

/** Testo senza graffe (per i lettori di schermo). */
function testoPiano(testo: string): string {
  return testo.replace(/[{}]/g, '');
}

/** Una riga d'indicazione: il testo sta in uno span in linea, che la matita barra riga per riga. */
function rigaIndicazione(testo: string): HTMLParagraphElement {
  return h('p', { class: 'ui-ob-indicazione' }, h('span', { class: 'ui-ob-testo' }, testoConTasti(testo)));
}

/**
 * Pannello dell'obiettivo (in alto a sinistra) e segnalino di direzione sul mondo: le
 * «indicazioni delle missioni» chieste dall'utente (il GDD §8 non le voleva: ora sono un'opzione,
 * attiva di serie).
 *
 * - il pannello: il titolo della missione in maiuscoletto, l'indicazione pratica in evidenza,
 *   l'obiettivo poetico del Taccuino a matita, al massimo due righe in più (altri passi,
 *   secondarie). Quando cambia il passo la riga vecchia si barra a matita e compare la nuova con
 *   «nuovo obiettivo»; se in quel momento il pannello è nascosto (un dialogo, una carta), lo fa
 *   quando ricompare;
 * - il segnalino: un cerchietto a matita con la distanza, o una freccia appoggiata al bordo
 *   quando la meta è fuori dallo schermo o dietro, con «in su»/«sotto»;
 * - si nasconde sotto i modali (`.ui-con-modale`) e quando la regia lo sospende (scene guidate);
 *   il tasto O mostra e nasconde il pannello. Non prende mai il mouse.
 */
export class PannelloObiettivo extends Componente<EventiPannelloObiettivo> {
  private readonly pannello: HTMLElement;
  private readonly testaMissione: HTMLSpanElement;
  private readonly etichettaNuovo: HTMLSpanElement;
  private readonly righe: HTMLDivElement;
  private readonly obiettivoEl: HTMLParagraphElement;
  private readonly attesaEl: HTMLParagraphElement;
  private readonly altriEl: HTMLUListElement;
  private readonly notaEl: HTMLParagraphElement;
  private readonly avviso: HTMLParagraphElement;
  private readonly segno: HTMLDivElement;
  private readonly segnoDistanza: HTMLSpanElement;
  private readonly segnoVerticale: HTMLSpanElement;
  private readonly segnoDietro: HTMLSpanElement;
  private readonly segnoFreccia: SVGSVGElement;
  private readonly annuncio: HTMLDivElement;

  private corrente: DatiObiettivo | null = null;
  /** Ciò che il giocatore ha visto per ultimo (per barrarlo quando arriva il passo nuovo). */
  private mostrata: { chiave: string; indicazione: string } | null = null;
  private rigaAttuale: HTMLParagraphElement | null = null;
  private sospeso = false;
  private perUtente = true;
  private timer: ReturnType<typeof setTimeout>[] = [];
  private timerAvviso: ReturnType<typeof setTimeout> | null = null;
  private timerNota: ReturnType<typeof setTimeout> | null = null;
  private ultimoSegno = { x: NaN, y: NaN, bordo: false, angolo: NaN, distanza: '', verticale: null as StatoSegnalino['verticale'], dietro: false, sopra: false, visibile: false };

  constructor(private readonly opz: OpzioniPannelloObiettivo = {}) {
    super({ classe: 'ui-obiettivo', modale: false });
    this.testaMissione = h('span', { class: 'ui-ob-missione' });
    this.etichettaNuovo = h('span', { class: 'ui-ob-nuovo', 'aria-hidden': 'true' }, 'nuovo obiettivo');
    this.righe = h('div', { class: 'ui-ob-righe' });
    this.obiettivoEl = h('p', { class: 'ui-ob-obiettivo' });
    this.attesaEl = h('p', { class: 'ui-ob-attesa', hidden: true });
    this.altriEl = h('ul', { class: 'ui-ob-altri', hidden: true });
    this.notaEl = h('p', { class: 'ui-ob-nota', hidden: true });
    this.pannello = h(
      'section',
      { class: 'ui-ob-pannello', 'aria-label': 'Obiettivo', hidden: true },
      h('div', { class: 'ui-ob-testa' }, this.testaMissione, this.etichettaNuovo),
      this.righe,
      this.attesaEl,
      this.obiettivoEl,
      this.altriEl,
      this.notaEl,
    );
    this.avviso = h('p', { class: 'ui-ob-avviso', hidden: true, role: 'status' });
    // il segnalino: cerchietto a matita (davanti) o freccia (al bordo), distanza, in su / sotto
    // al bordo una punta di freccia piena (un chevron sottile, girato, si leggeva «7» o «<»)
    this.segnoFreccia = s(
      'svg',
      { class: 'ui-ob-freccia', viewBox: '-14 -14 28 28', width: 44, height: 44 },
      s('path', { class: 'ui-ob-punta', d: 'M 11.5 0 L -7.5 -10 L -3.6 0 L -7.5 10 Z' }),
    );
    const cerchio = s(
      'svg',
      { class: 'ui-ob-cerchio', viewBox: '-14 -14 28 28', width: 30, height: 30 },
      s('path', { class: 'ui-ob-ombra', d: 'M 1.2 -9.6 C 6.6 -9.2 10.2 -5 9.7 0.6 C 9.2 6 4.8 9.8 -0.6 9.5 C -6.2 9.1 -9.9 4.8 -9.5 -0.8 C -9.1 -6 -5 -9.9 1.6 -9.4 C 3.4 -9.2 4.6 -8.7 5.6 -8' }),
      s('path', { class: 'ui-ob-linea', d: 'M 1.2 -9.6 C 6.6 -9.2 10.2 -5 9.7 0.6 C 9.2 6 4.8 9.8 -0.6 9.5 C -6.2 9.1 -9.9 4.8 -9.5 -0.8 C -9.1 -6 -5 -9.9 1.6 -9.4 C 3.4 -9.2 4.6 -8.7 5.6 -8' }),
      s('circle', { class: 'ui-ob-punto', r: 2.1 }),
    );
    this.segnoDistanza = h('span', { class: 'ui-ob-distanza' });
    this.segnoVerticale = h('span', { class: 'ui-ob-verticale' });
    this.segnoDietro = h('span', { class: 'ui-ob-dietro', hidden: true });
    this.segno = h(
      'div',
      { class: 'ui-ob-segnalino', hidden: true, 'aria-hidden': 'true' },
      h('div', { class: 'ui-ob-segno' }, cerchio, this.segnoFreccia),
      h('div', { class: 'ui-ob-etichetta' }, this.segnoDistanza, this.segnoDietro, this.segnoVerticale),
    );
    // per i lettori di schermo: solo l'indicazione nuova, una volta
    this.annuncio = h('div', { class: 'ui-sr', 'aria-live': 'polite' });
    // il segnalino dopo il pannello: se la meta cade sulla carta, si vede sopra (la regia lo sposta sotto)
    this.el.append(this.pannello, this.avviso, this.segno, this.annuncio);
  }

  /** Mostra il livello (all'inizio del gioco); il pannello compare quando ci sono i dati. */
  show(): void {
    this.apri();
    this.rendi();
  }

  /** Il modo scelto nelle impostazioni. */
  get modo(): IndicazioniMissioni {
    return this.opz.modo?.() ?? 'complete';
  }

  /** Il pannello si vede adesso (dati, modo, tasto O, non sospeso). */
  get pannelloVisibile(): boolean {
    return this.visible && !this.sospeso && this.perUtente && this.modo !== 'nessuna' && !!this.corrente;
  }

  /** Il segnalino si vede adesso. */
  get segnalinoVisibile(): boolean {
    return this.ultimoSegno.visibile;
  }

  /** Dove sta il pannello sullo schermo (px), se si vede: il segnalino gli gira attorno. */
  areaPannello(): { sinistra: number; destra: number; sotto: number } | null {
    if (!this.pannelloVisibile || this.pannello.hidden) return null;
    const r = this.pannello.getBoundingClientRect();
    return r.width > 0 ? { sinistra: r.left, destra: r.right, sotto: r.bottom } : null;
  }

  /** Il giocatore ha nascosto il pannello con il tasto O. */
  get nascostoDalGiocatore(): boolean {
    return !this.perUtente;
  }

  /** I dati del passo seguito (null: niente da mostrare). */
  aggiorna(d: DatiObiettivo | null): void {
    const c = this.corrente;
    const uguale =
      c === d ||
      (!!c &&
        !!d &&
        c.chiave === d.chiave &&
        c.missione === d.missione &&
        c.indicazione === d.indicazione &&
        c.obiettivo === d.obiettivo &&
        c.attesa === d.attesa &&
        (c.altri ?? []).length === (d.altri ?? []).length &&
        (c.altri ?? []).every((a, i) => a.titolo === d.altri![i]!.titolo && a.indicazione === d.altri![i]!.indicazione));
    if (!uguale) this.corrente = d;
    this.rendi();
  }

  /**
   * Riprende un obiettivo senza annunciarlo (dopo «Continua», o null per una partita nuova): niente
   * «nuovo obiettivo», niente suono, niente riga barrata del passo di prima.
   */
  ripristina(d: DatiObiettivo | null): void {
    for (const t of this.timer) clearTimeout(t);
    this.timer = [];
    this.righe.replaceChildren();
    this.pannello.classList.remove('ui-ob-pannello--cambia', 'ui-ob-pannello--primo');
    this.etichettaNuovo.classList.remove('ui-ob-nuovo--si');
    this.corrente = d;
    this.rigaAttuale = null;
    this.mostrata = null;
    if (d) {
      this.rigaAttuale = rigaIndicazione(d.indicazione);
      this.righe.append(this.rigaAttuale);
      this.mostrata = { chiave: d.chiave, indicazione: d.indicazione };
    }
    this.rendi();
  }

  /** Ridisegna secondo le impostazioni (cambiato il modo). */
  ridisegna(): void {
    this.rendi();
    if (this.modo !== 'complete') this.segnalino(null);
  }

  /**
   * Sospende il pannello e il segnalino (dialoghi, letture, scene guidate, titolo): il passo
   * nuovo arrivato nel frattempo si annuncia quando il pannello ricompare.
   */
  sospendi(vero: boolean): void {
    if (this.sospeso === vero) return;
    this.sospeso = vero;
    this.el.classList.toggle('ui-ob--sospeso', vero);
    if (vero) this.segnalino(null);
    this.rendi();
  }

  /** Tasto O: mostra o nasconde il pannello (il segnalino resta, secondo l'impostazione). */
  alterna(): void {
    if (this.modo === 'nessuna') {
      this.avvisa('Indicazioni delle missioni spente: Impostazioni › Aiuti');
      return;
    }
    this.perUtente = !this.perUtente;
    this.el.classList.toggle('ui-ob--nascosto', !this.perUtente);
    this.avvisa(this.perUtente ? null : '{O} mostra l’obiettivo');
    this.rendi();
    this.emit('alternato', this.perUtente);
  }

  /** Una nota a matita in fondo al pannello per `ms` millisecondi (i tasti fra graffe). */
  nota(testo: string, ms = 8000): void {
    if (this.timerNota) clearTimeout(this.timerNota);
    this.notaEl.replaceChildren(...testoConTasti(testo));
    this.notaEl.hidden = false;
    this.timerNota = setTimeout(() => {
      this.notaEl.hidden = true;
      this.timerNota = null;
    }, ms);
  }

  /** Il segnalino di direzione (null lo toglie). Scrive nel DOM solo ciò che cambia. */
  segnalino(st: StatoSegnalino | null): void {
    const u = this.ultimoSegno;
    const visibile = !!st && this.visible && !this.sospeso && this.modo === 'complete';
    if (!visibile || !st) {
      if (u.visibile) {
        this.segno.hidden = true;
        u.visibile = false;
      }
      return;
    }
    if (!u.visibile) {
      this.segno.hidden = false;
      u.visibile = true;
    }
    const x = Math.round(st.x);
    const y = Math.round(st.y);
    if (x !== u.x || y !== u.y) {
      this.segno.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      u.x = x;
      u.y = y;
    }
    if (st.bordo !== u.bordo) {
      this.segno.classList.toggle('ui-ob-segnalino--bordo', st.bordo);
      u.bordo = st.bordo;
    }
    const a = Math.round(st.angolo * 100) / 100;
    if (st.bordo && a !== u.angolo) {
      this.segnoFreccia.style.transform = `rotate(${a}rad)`;
      u.angolo = a;
    }
    // l'etichetta sta dalla parte del centro dello schermo (sotto, o sopra se il segno è in basso)
    const sopra = st.bordo && Math.sin(st.angolo) > 0.55;
    if (sopra !== u.sopra) {
      this.segno.classList.toggle('ui-ob-segnalino--etichetta-sopra', sopra);
      u.sopra = sopra;
    }
    const dietro = !!st.dietro;
    if (dietro !== u.dietro) {
      this.segnoDietro.hidden = !dietro;
      this.segnoDietro.textContent = dietro ? 'dietro' : '';
      this.segno.classList.toggle('ui-ob-segnalino--dietro', dietro);
      u.dietro = dietro;
    }
    // sul fianco destro l'etichetta va verso il centro, non fuori dallo schermo
    this.segno.classList.toggle('ui-ob-segnalino--fianco-destro', dietro && Math.cos(st.angolo) > 0);
    this.segno.classList.toggle('ui-ob-segnalino--fianco-sinistro', dietro && Math.cos(st.angolo) < 0);
    if (st.distanza !== u.distanza) {
      this.segnoDistanza.textContent = st.distanza;
      u.distanza = st.distanza;
    }
    if (st.verticale !== u.verticale) {
      this.segnoVerticale.textContent = st.verticale === 'su' ? 'in su' : st.verticale === 'giu' ? 'sotto' : '';
      this.segnoVerticale.hidden = !st.verticale;
      this.segno.classList.toggle('ui-ob-segnalino--su', st.verticale === 'su');
      this.segno.classList.toggle('ui-ob-segnalino--giu', st.verticale === 'giu');
      u.verticale = st.verticale;
    }
  }

  override destroy(): void {
    for (const t of this.timer) clearTimeout(t);
    if (this.timerAvviso) clearTimeout(this.timerAvviso);
    if (this.timerNota) clearTimeout(this.timerNota);
    super.destroy();
  }

  // ---------- interni ----------

  /** Porta il DOM d'accordo con i dati; anima il passo nuovo solo se il pannello si vede. */
  private rendi(): void {
    const d = this.corrente;
    this.el.classList.toggle('ui-ob--solo-obiettivo', this.modo === 'obiettivo');
    this.el.classList.toggle('ui-ob--nessuna', this.modo === 'nessuna');
    // le notifiche del Taccuino si stringono solo quando il pannello c'è davvero (obiettivo.css)
    this.el.classList.toggle('ui-ob--con-pannello', this.pannelloVisibile);
    // nascosto (sospeso, tasto O, «Nessuna»): neanche i lettori di schermo lo leggono
    const muto = String(!this.pannelloVisibile);
    if (this.pannello.getAttribute('aria-hidden') !== muto) this.pannello.setAttribute('aria-hidden', muto);
    if (!this.pannelloVisibile || !d) {
      if (!d && !this.pannello.hidden) this.pannello.hidden = true;
      return;
    }
    if (this.pannello.hidden) this.pannello.hidden = false;
    const nuovo = !this.mostrata || this.mostrata.chiave !== d.chiave;
    if (nuovo) this.annunciaNuovo(d);
    else if (this.mostrata && this.mostrata.indicazione !== d.indicazione && this.rigaAttuale) {
      this.rigaAttuale.firstElementChild?.replaceChildren(...testoConTasti(d.indicazione));
      this.mostrata.indicazione = d.indicazione;
    }
    if (this.testaMissione.textContent !== d.missione) this.testaMissione.textContent = d.missione;
    this.scriviAttesa(d);
    if (!nuovo) {
      this.scriviSecondarie(d);
      const ob = d.obiettivo ?? '';
      if (this.obiettivoEl.textContent !== ob) {
        this.obiettivoEl.textContent = ob;
        this.obiettivoEl.hidden = !ob;
      }
    }
  }

  /** Il passo concluso si barra, il nuovo compare con «nuovo obiettivo». */
  private annunciaNuovo(d: DatiObiettivo): void {
    for (const t of this.timer) clearTimeout(t);
    this.timer = [];
    const vecchia = this.rigaAttuale;
    const riga = rigaIndicazione(d.indicazione);
    // le righe concluse prima (animazioni interrotte) se ne vanno subito
    for (const r of [...this.righe.children]) if (r !== vecchia) r.remove();
    if (vecchia && this.mostrata) {
      vecchia.classList.add('ui-ob-indicazione--conclusa');
      vecchia.setAttribute('aria-hidden', 'true');
      riga.classList.add('ui-ob-indicazione--entra');
      this.togliDopo(vecchia);
    } else {
      riga.classList.add('ui-ob-indicazione--prima');
    }
    this.righe.append(riga);
    this.rigaAttuale = riga;
    this.mostrata = { chiave: d.chiave, indicazione: d.indicazione };
    // l'obiettivo del Taccuino e le righe in più cambiano subito, ma compaiono con la riga nuova
    // (la regia è nel CSS, con i ritardi delle animazioni: nessun timer fa partire animazioni,
    // così si avviano tutte al prossimo fotogramma anche quando il gioco è fermo per le foto)
    this.obiettivoEl.textContent = d.obiettivo ?? '';
    this.obiettivoEl.hidden = !d.obiettivo;
    this.scriviSecondarie(d);
    this.pannello.classList.remove('ui-ob-pannello--cambia', 'ui-ob-pannello--primo');
    this.etichettaNuovo.classList.remove('ui-ob-nuovo--si');
    void this.pannello.offsetWidth;
    this.pannello.classList.add(vecchia ? 'ui-ob-pannello--cambia' : 'ui-ob-pannello--primo');
    this.etichettaNuovo.classList.add('ui-ob-nuovo--si');
    this.annuncio.textContent = `Nuovo obiettivo: ${testoPiano(d.indicazione)}`;
    this.emit('nuovoObiettivo', d.chiave);
  }

  /**
   * Toglie la riga barrata quando ha finito di svanire (fine dell'animazione `ui-ob-svanisci`);
   * di riserva, dopo `DURATA_BARRA`, se le sue animazioni non sono più in corso (pannello
   * nascosto, «riduci i movimenti»). Un'animazione ferma a metà (le foto delle prove) la tiene.
   */
  private togliDopo(vecchia: HTMLElement): void {
    if (this.ridotto()) {
      vecchia.remove();
      return;
    }
    vecchia.addEventListener('animationend', (e) => {
      if (e.target === vecchia && e.animationName === 'ui-ob-svanisci') vecchia.remove();
    });
    const riserva = (): void => {
      if (!vecchia.isConnected) return;
      const ancora = vecchia.getAnimations?.().some((a) => a.playState === 'running' || a.playState === 'paused');
      if (ancora) this.timer.push(setTimeout(riserva, 250));
      else vecchia.remove();
    };
    this.timer.push(setTimeout(riserva, DURATA_BARRA));
  }

  /** La riga dell'attesa («arriva alle 07:00»), solo se cambia. */
  private scriviAttesa(d: DatiObiettivo): void {
    const a = d.attesa ?? '';
    if (this.attesaEl.dataset['testo'] === a) return;
    this.attesaEl.dataset['testo'] = a;
    this.attesaEl.replaceChildren(...(a ? testoConTasti(a) : []));
    this.attesaEl.hidden = !a;
  }

  private scriviSecondarie(d: DatiObiettivo): void {
    const altri = (d.altri ?? []).slice(0, 2);
    const firma = altri.map((a) => `${a.titolo ?? ''}|${a.indicazione}`).join('\n');
    if (this.altriEl.dataset['firma'] === firma) return;
    this.altriEl.dataset['firma'] = firma;
    this.altriEl.replaceChildren(
      ...altri.map((a) => h('li', { class: 'ui-ob-altro' }, a.titolo ? h('span', { class: 'ui-ob-altro-titolo' }, a.titolo) : h('span', { class: 'ui-ob-altro-titolo' }, 'Anche'), ' ', testoConTasti(a.indicazione))),
    );
    this.altriEl.hidden = altri.length === 0;
  }

  /** Una riga breve sotto il pannello (tasto O), che sparisce da sola. */
  private avvisa(testo: string | null): void {
    if (this.timerAvviso) clearTimeout(this.timerAvviso);
    this.timerAvviso = null;
    if (!testo) {
      this.avviso.hidden = true;
      return;
    }
    this.avviso.replaceChildren(...testoConTasti(testo));
    this.avviso.hidden = false;
    this.timerAvviso = setTimeout(() => {
      this.avviso.hidden = true;
      this.timerAvviso = null;
    }, 2600);
  }
}
