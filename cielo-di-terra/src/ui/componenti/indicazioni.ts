import { Componente } from '../core/componente';
import { h, s } from '../core/dom';
import { nodiTesto, testoSemplice } from '../core/testo';
import './indicazioni.css';

export interface AzioneContestuale {
  /** Tasto da premere (es. «E»). */
  tasto: string;
  /** Che cosa fa (es. «Rileva», «Parla con Ottavio»). */
  testo: string;
  /** Avanzamento di un'azione tenuta premuta (0-1), es. il rilievo. */
  progresso?: number;
}

export type DirezioneSuono = 'sinistra' | 'destra' | 'davanti' | 'dietro' | 'sopra' | 'sotto';

export interface Sottotitolo {
  testo: string;
  /** Chi parla (voci). */
  chi?: string;
  /** 'voce' (predefinito) o 'suono' («[campane di San Vigilio]»). */
  tipo?: 'voce' | 'suono';
  /** Da dove viene il suono rispetto a Elvira. */
  direzione?: DirezioneSuono;
  /** Durata in ms (predefinita: in base alla lunghezza del testo). */
  durata?: number;
}

export interface StatoSquadro {
  /** Caposaldo traguardato (es. «Pilastro 6», «Chiodo 37»); assente se il reticolo non punta niente. */
  caposaldo?: string;
  /** Riga sotto il nome (es. «412 m · a Mane»). */
  dettaglio?: string;
  /** Bolla della livella: -1 (tutta a sinistra) … 0 (in bolla) … 1. */
  livella?: number;
  /** Ingrandimento del cannocchiale (predefinito 4). */
  ingrandimento?: number;
  /** Il caposaldo è collimato: il reticolo si fa più netto. */
  collimato?: boolean;
}

export interface OpzioniNotifica {
  /** Durata in ms (predefinita 4200). */
  durata?: number;
  /** 'matita' (predefinita) o 'rosso' (cambi della notte, avvisi). */
  tono?: 'matita' | 'rosso';
}

export interface EventiIndicazioni {
  /** Una notifica è sparita. */
  notificaFinita: string;
}

const PAROLE_DIREZIONE: Record<DirezioneSuono, string> = {
  sinistra: 'a sinistra',
  destra: 'a destra',
  davanti: 'davanti',
  dietro: 'dietro',
  sopra: 'in su',
  sotto: 'in basso',
};

/**
 * Indicazioni a schermo minime: puntino centrale, azione contestuale, notifiche a matita, sottotitoli,
 * fiato e Velo (solo quando servono) e il mirino dello squadro a cannocchiale.
 * Non prende mai il mouse: è un livello trasparente.
 */
export class Indicazioni extends Componente<EventiIndicazioni> {
  private readonly puntino: HTMLDivElement;
  private readonly azioneEl: HTMLDivElement;
  private readonly suggerimentoEl: HTMLParagraphElement;
  private readonly notifiche: HTMLDivElement;
  private readonly sottotitoli: HTMLDivElement;
  private readonly misuratori: HTMLDivElement;
  private readonly arcoFiato: SVGPathElement;
  private readonly arcoVelo: SVGPathElement;
  private readonly vignetta: HTMLDivElement;
  private readonly squadroEl: HTMLDivElement;
  private readonly targa: HTMLDivElement;
  private readonly dettaglio: HTMLDivElement;
  private readonly bolla: HTMLDivElement;
  private readonly ingrandimento: SVGTextElement;
  private readonly annuncioSquadro: HTMLDivElement;
  private valori = { fiato: null as number | null, velo: null as number | null };
  private timerMisuratori: ReturnType<typeof setTimeout> | null = null;
  private puntinoVoluto = true;
  private squadroAttivo = false;

  constructor() {
    super({ classe: 'ui-indicazioni', modale: false });
    this.el.setAttribute('aria-hidden', 'false');

    this.puntino = h('div', { class: 'ui-hud-puntino', 'aria-hidden': 'true' });
    this.azioneEl = h('div', { class: 'ui-hud-azione', hidden: true, role: 'status' });
    this.suggerimentoEl = h('p', { class: 'ui-hud-suggerimento', hidden: true, role: 'status' });
    this.notifiche = h('div', { class: 'ui-hud-notifiche', role: 'status', 'aria-live': 'polite' });
    this.sottotitoli = h('div', { class: 'ui-hud-sottotitoli', 'aria-live': 'polite' });

    // Fiato (a sinistra) e Velo (a destra): due archi sottili intorno al puntino.
    const R = 30;
    const arco = (da: number, a: number): string => {
      const p = (g: number): string => `${(R * Math.cos((g * Math.PI) / 180)).toFixed(2)} ${(R * Math.sin((g * Math.PI) / 180)).toFixed(2)}`;
      return `M ${p(da)} A ${R} ${R} 0 0 ${a > da ? 1 : 0} ${p(a)}`;
    };
    this.arcoFiato = s('path', { d: arco(130, 230), class: 'ui-hud-arco ui-hud-arco--fiato', pathLength: 1 });
    this.arcoVelo = s('path', { d: arco(50, -50), class: 'ui-hud-arco ui-hud-arco--velo', pathLength: 1 });
    this.misuratori = h(
      'div',
      { class: 'ui-hud-misuratori', 'aria-hidden': 'true' },
      s(
        'svg',
        { viewBox: '-44 -44 88 88', width: 88, height: 88 },
        s('path', { d: arco(130, 230), class: 'ui-hud-arco-fondo ui-hud-arco--fiato-fondo' }),
        s('path', { d: arco(50, -50), class: 'ui-hud-arco-fondo ui-hud-arco--velo-fondo' }),
        this.arcoFiato,
        this.arcoVelo,
      ),
      h('span', { class: 'ui-hud-etichetta ui-hud-etichetta--fiato' }, 'fiato'),
      h('span', { class: 'ui-hud-etichetta ui-hud-etichetta--velo' }, 'Velo'),
    );
    this.vignetta = h('div', { class: 'ui-hud-vignetta', 'aria-hidden': 'true' });

    // Mirino dello squadro.
    this.targa = h('div', { class: 'ui-sq-targa' });
    this.dettaglio = h('div', { class: 'ui-sq-dettaglio' });
    this.bolla = h('div', { class: 'ui-sq-bolla' });
    this.ingrandimento = s('text', { x: 0, y: 0, class: 'ui-sq-x' }, '×4');
    this.squadroEl = h(
      'div',
      { class: 'ui-squadro', hidden: true, 'aria-hidden': 'true' },
      h('div', { class: 'ui-sq-ombra' }),
      reticolo(this.ingrandimento),
      h('div', { class: 'ui-sq-testa' }, this.targa, this.dettaglio),
      h('div', { class: 'ui-sq-livella' }, h('div', { class: 'ui-sq-fiala' }, h('span', { class: 'ui-sq-tacca' }), h('span', { class: 'ui-sq-tacca ui-sq-tacca--d' }), this.bolla)),
    );
    // Annuncio testuale per i lettori di schermo.
    this.annuncioSquadro = h('div', { class: 'ui-sr', 'aria-live': 'polite' });

    this.el.append(this.vignetta, this.squadroEl, this.puntino, this.misuratori, this.azioneEl, this.suggerimentoEl, this.sottotitoli, this.notifiche, this.annuncioSquadro);
    this.aggiornaMisuratori();
  }

  /** Mostra il livello delle indicazioni (di solito sempre, durante il gioco). */
  show(): void {
    this.apri();
  }

  /** Puntino al centro dello schermo. */
  mostraPuntino(vero: boolean): void {
    this.puntinoVoluto = vero;
    this.puntino.hidden = !vero || this.squadroAttivo;
  }

  /** Azione contestuale vicino al centro, in basso («E — Rileva»); null la toglie. */
  azione(a: AzioneContestuale | null): void {
    if (!a) {
      this.azioneEl.hidden = true;
      return;
    }
    const prog = a.progresso;
    this.azioneEl.replaceChildren(
      h('span', { class: 'ui-tasto ui-hud-tasto' }, a.tasto),
      h('span', { class: 'ui-hud-azione-sep', 'aria-hidden': 'true' }, '—'),
      h('span', { class: 'ui-hud-azione-testo' }, a.testo),
      ...(prog !== undefined ? [h('span', { class: 'ui-hud-progresso', style: `--p:${Math.max(0, Math.min(1, prog))}`, 'aria-hidden': 'true' })] : []),
    );
    this.azioneEl.setAttribute('aria-label', `${a.tasto}: ${a.testo}`);
    this.azioneEl.hidden = false;
  }

  /**
   * Suggerimento dei comandi: una riga in corsivo a matita in basso, la prima volta di ogni gesto
   * (markup [[tecnica|locale]] e *corsivo*; i tasti fra parentesi graffe, es. «Tieni premuto {E} vicino al chiodo»).
   * null lo toglie. Si nasconde da sé se l'impostazione «Suggerimenti dei comandi» è spenta.
   */
  suggerimento(testo: string | null): void {
    if (!testo) {
      this.suggerimentoEl.hidden = true;
      return;
    }
    const parti = testo.split(/\{([^}]+)\}/);
    this.suggerimentoEl.replaceChildren(...parti.map((p, i) => (i % 2 ? h('span', { class: 'ui-tasto' }, p) : nodiTesto(p))));
    this.suggerimentoEl.hidden = false;
  }

  /** Notifica breve a matita in alto a destra («Nuova pista nel taccuino»). */
  notifica(testo: string, opz: OpzioniNotifica = {}): void {
    const durata = opz.durata ?? 4200;
    const el = h(
      'div',
      { class: `ui-hud-notifica${opz.tono === 'rosso' ? ' ui-hud-notifica--rosso' : ''}` },
      h('span', { class: 'ui-hud-notifica-testo' }, nodiTesto(testo)),
      s('svg', { viewBox: '0 0 200 12', preserveAspectRatio: 'none', class: 'ui-hud-notifica-tratto', 'aria-hidden': 'true' }, s('path', { d: 'M3 7 C 40 3, 90 9.5, 140 5 S 188 6, 197 4', pathLength: 1 })),
    );
    this.notifiche.append(el);
    while (this.notifiche.children.length > 3) this.notifiche.firstElementChild?.remove();
    setTimeout(() => {
      el.classList.add('ui-hud-notifica--via');
      setTimeout(() => {
        el.remove();
        this.emit('notificaFinita', testo);
      }, this.ridotto() ? 0 : 450);
    }, durata);
  }

  /**
   * Dove stanno le notifiche sullo schermo (px), se ce n'è almeno una: il segnalino delle
   * indicazioni non ci passa sotto. Null senza notifiche.
   */
  areaNotifiche(): { sinistra: number; destra: number; sotto: number } | null {
    if (!this.visible || this.notifiche.children.length === 0) return null;
    const r = this.notifiche.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? { sinistra: r.left, destra: r.right, sotto: r.bottom } : null;
  }

  /**
   * Sottotitolo di una voce o di un suono. Restituisce una funzione che lo toglie prima del tempo.
   * Rispetta le impostazioni (sottotitoli, sottotitoli dei suoni) tramite le classi della radice.
   */
  sottotitolo(st: Sottotitolo): () => void {
    const suono = st.tipo === 'suono';
    const dir = st.direzione;
    let contenuto: (Node | null)[];
    if (suono) {
      // Suoni tra parentesi quadre; la direzione è una freccia ai lati o una parola dentro le parentesi.
      const laterale = dir === 'sinistra' || dir === 'destra';
      const parola = dir && !laterale ? `, ${PAROLE_DIREZIONE[dir]}` : '';
      contenuto = [
        dir === 'sinistra' ? h('span', { class: 'ui-hud-freccia', 'aria-hidden': 'true' }, '‹') : null,
        h('span', null, `[${testoSemplice(st.testo)}${parola}]`),
        dir === 'destra' ? h('span', { class: 'ui-hud-freccia', 'aria-hidden': 'true' }, '›') : null,
        laterale && dir ? h('span', { class: 'ui-sr' }, ` (${PAROLE_DIREZIONE[dir]})`) : null,
      ];
    } else {
      contenuto = [st.chi ? h('span', { class: 'ui-hud-chi' }, st.chi) : null, h('span', null, nodiTesto(st.testo))];
    }
    const el = h('p', { class: `ui-hud-sottotitolo${suono ? ' ui-hud-sottotitolo--suono' : ''}` }, contenuto);
    this.sottotitoli.append(el);
    while (this.sottotitoli.children.length > 3) this.sottotitoli.firstElementChild?.remove();
    const parole = testoSemplice(st.testo).split(/\s+/).length;
    const durata = st.durata ?? Math.max(2200, Math.min(9000, 900 + parole * 330));
    let tolto = false;
    const togli = (): void => {
      if (tolto) return;
      tolto = true;
      el.classList.add('ui-hud-sottotitolo--via');
      setTimeout(() => el.remove(), this.ridotto() ? 0 : 300);
    };
    setTimeout(togli, durata);
    return togli;
  }

  /** Fiato di Elvira (0-1); null o 1 lo nascondono dopo un attimo. Sotto 0,35 la vista si restringe. */
  fiato(valore: number | null): void {
    this.valori.fiato = valore === null ? null : Math.max(0, Math.min(1, valore));
    this.aggiornaMisuratori();
  }

  /** Tenuta del Velo in planata (0-1); null lo nasconde. */
  velo(valore: number | null): void {
    this.valori.velo = valore === null ? null : Math.max(0, Math.min(1, valore));
    this.aggiornaMisuratori();
  }

  /** Mirino dello squadro a cannocchiale; null lo toglie. */
  squadro(stato: StatoSquadro | null): void {
    this.squadroAttivo = !!stato;
    this.squadroEl.hidden = !stato;
    this.puntino.hidden = !this.puntinoVoluto || this.squadroAttivo;
    this.el.classList.toggle('ui-hud--squadro', !!stato);
    if (!stato) {
      this.annuncioSquadro.textContent = '';
      return;
    }
    this.targa.textContent = stato.caposaldo ?? '—';
    this.targa.classList.toggle('ui-sq-targa--vuota', !stato.caposaldo);
    this.dettaglio.textContent = stato.dettaglio ?? (stato.caposaldo ? '' : 'nessun caposaldo nel reticolo');
    this.squadroEl.classList.toggle('ui-sq--collimato', !!stato.collimato);
    const liv = Math.max(-1, Math.min(1, stato.livella ?? 0));
    this.bolla.style.setProperty('--liv', String(liv));
    this.squadroEl.classList.toggle('ui-sq--in-bolla', Math.abs(liv) < 0.08);
    this.ingrandimento.textContent = `×${stato.ingrandimento ?? 4}`;
    this.annuncioSquadro.textContent = stato.caposaldo ? `Nel reticolo: ${stato.caposaldo}${stato.collimato ? ', collimato' : ''}` : '';
  }

  private aggiornaMisuratori(): void {
    const { fiato, velo } = this.valori;
    const serveFiato = fiato !== null && fiato < 0.995;
    const serveVelo = velo !== null;
    this.arcoFiato.style.strokeDashoffset = String(1 - (fiato ?? 1));
    this.arcoVelo.style.strokeDashoffset = String(1 - (velo ?? 1));
    this.misuratori.classList.toggle('ui-hud-misuratori--fiato', serveFiato);
    this.misuratori.classList.toggle('ui-hud-misuratori--velo', serveVelo);
    this.misuratori.classList.toggle('ui-hud-misuratori--poco-fiato', fiato !== null && fiato < 0.25);
    this.vignetta.style.setProperty('--stretta', String(fiato === null ? 0 : Math.max(0, (0.4 - fiato) / 0.4)));
    // Quando tutto torna pieno, gli archi restano un attimo e poi spariscono.
    if (this.timerMisuratori) clearTimeout(this.timerMisuratori);
    if (fiato !== null && fiato >= 0.995 && !serveVelo) {
      this.misuratori.classList.add('ui-hud-misuratori--pieno');
      this.timerMisuratori = setTimeout(() => this.misuratori.classList.remove('ui-hud-misuratori--pieno'), 1200);
    }
  }
}

/** Reticolo del cannocchiale: anello d'ottone graduato, fili a croce con le tacche stadimetriche. */
function reticolo(ingrandimento: SVGTextElement): SVGSVGElement {
  const svg = s('svg', { class: 'ui-sq-reticolo', viewBox: '-500 -500 1000 1000', preserveAspectRatio: 'xMidYMid meet' });
  const defs = s('defs');
  const grad = s('linearGradient', { id: 'ui-sq-ottone', x1: 0, y1: 0, x2: 1, y2: 1 });
  grad.append(
    s('stop', { offset: '0', 'stop-color': '#f0d79a' }),
    s('stop', { offset: '0.35', 'stop-color': '#b4904f' }),
    s('stop', { offset: '0.7', 'stop-color': '#6f5122' }),
    s('stop', { offset: '1', 'stop-color': '#c9a35e' }),
  );
  defs.append(grad);
  svg.append(defs);
  const R = 380;
  svg.append(
    s('circle', { r: R + 16, class: 'ui-sq-anello' }),
    s('circle', { r: R - 2, class: 'ui-sq-anello-interno' }),
  );
  // Tacche ogni 5°, più lunghe ogni 30°.
  const tacche = s('g', { class: 'ui-sq-tacche' });
  for (let g = 0; g < 360; g += 5) {
    const lunga = g % 30 === 0;
    const r1 = R - (lunga ? 22 : 11);
    const a = (g * Math.PI) / 180;
    tacche.append(s('line', { x1: (Math.cos(a) * r1).toFixed(1), y1: (Math.sin(a) * r1).toFixed(1), x2: (Math.cos(a) * (R - 2)).toFixed(1), y2: (Math.sin(a) * (R - 2)).toFixed(1) }));
  }
  svg.append(tacche);
  // Fili: due linee per ciascun asse (chiara sotto, scura sopra) per leggersi su ogni sfondo.
  const fili = s('g', { class: 'ui-sq-fili' });
  const filo = (x1: number, y1: number, x2: number, y2: number): void => {
    fili.append(s('line', { x1, y1, x2, y2, class: 'ui-sq-filo-chiaro' }), s('line', { x1, y1, x2, y2, class: 'ui-sq-filo' }));
  };
  filo(-R + 4, 0, -16, 0);
  filo(16, 0, R - 4, 0);
  filo(0, -R + 4, 0, -16);
  filo(0, 16, 0, R - 4);
  // Tacche stadimetriche.
  for (const y of [-120, 120]) filo(-34, y, 34, y);
  for (const x of [-60, -120, -180, 60, 120, 180]) filo(x, -7, x, 7);
  svg.append(fili, s('circle', { r: 3.4, class: 'ui-sq-centro' }));
  ingrandimento.setAttribute('x', String(R - 70));
  ingrandimento.setAttribute('y', '-18');
  svg.append(ingrandimento);
  return svg;
}
