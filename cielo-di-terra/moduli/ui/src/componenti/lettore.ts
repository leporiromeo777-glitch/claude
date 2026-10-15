import { Componente } from '../core/componente';
import { h, svuota } from '../core/dom';
import { nodiTesto, paragrafi } from '../core/testo';
import './lettore.css';

/**
 * Tipi di carta, ognuno con la sua carta e la sua mano:
 * - lettera: corsiva scolastica su carta da lettere piegata in tre (la lettera di Marta);
 * - libretto: il libretto di rilievo di Aurelio, a quadretti, due pagine affiancate;
 * - biglietto: un biglietto scritto a mano da qualcun altro (la Madre, Rosa…), su carta grezza;
 * - cartellino: un cartellino piccolo (erbario, bacheca, capisaldi);
 * - dattiloscritto: un foglio battuto a macchina (le lettere di «S.»);
 * - foglio: un foglio stampato qualsiasi.
 */
export type TipoCarta = 'lettera' | 'biglietto' | 'libretto' | 'cartellino' | 'dattiloscritto' | 'foglio';

export interface PaginaCarta {
  /** Intestazione in alto (es. «Chiodo 37 · grà di Pian»). */
  intestazione?: string;
  /** Data o luogo, in alto a destra. */
  data?: string;
  /** Testo (paragrafi separati da una riga vuota; markup [[tecnica|locale]] e *corsivo*). */
  testo: string;
  /** Righe in colonna (libretto): [voce, valore]. */
  tabella?: [string, string][];
  /** Firma, in fondo a destra. */
  firma?: string;
  /** Nota a margine (di chi ha scritto la carta: «(a margine) Per E.: …»). */
  margine?: string;
  /** Nota a matita di Elvira, aggiunta dopo (es. «Il castagno accanto non c'è più»). */
  notaElvira?: string;
  /** Uno schizzo, descritto a parole (finché non c'è il disegno): «il campanile visto di lato, con la palina». */
  schizzo?: string;
}

export interface Carta {
  id?: string;
  tipo: TipoCarta;
  /** Titolo mostrato sopra il foglio e letto dai lettori di schermo (es. «Lettera di Marta»). */
  titolo: string;
  /** Com'è fatta la carta, in una riga (es. «un foglio di carta grezza piegato in quattro…»): sotto il titolo. */
  supporto?: string;
  pagine: PaginaCarta[];
}

export interface EventiLettore {
  /** Pagina mostrata (indice 0-based della prima pagina visibile). */
  pagina: number;
  /** L'utente ha chiuso la carta. */
  chiudi: void;
}

/**
 * Lettore di carte a tutto schermo: un foglio di carta con la calligrafia leggibile
 * (o in testo semplice, secondo le impostazioni), pagine sfogliabili con frecce, PagSu/PagGiù o mouse.
 */
export class LettoreCarte extends Componente<EventiLettore> {
  private readonly titolo: HTMLHeadingElement;
  private readonly supporto: HTMLParagraphElement;
  private readonly scena: HTMLDivElement;
  private readonly contatore: HTMLSpanElement;
  private readonly bPrec: HTMLButtonElement;
  private readonly bSucc: HTMLButtonElement;
  private readonly bStampato: HTMLButtonElement;
  private carta: Carta | null = null;
  private indice = 0;

  constructor() {
    super({ classe: 'ui-modale ui-lettore', modale: true, ruolo: 'dialog', etichetta: 'Carta' });
    this.titolo = h('h2', { class: 'ui-lt-titolo', id: 'ui-lt-titolo' });
    this.supporto = h('p', { class: 'ui-lt-supporto', hidden: true });
    this.scena = h('div', { class: 'ui-lt-scena', 'aria-live': 'polite' });
    this.contatore = h('span', { class: 'ui-lt-contatore' });
    this.bPrec = h('button', { class: 'ui-bottone ui-lt-nav', type: 'button', onclick: () => this.precedente() }, h('span', { 'aria-hidden': 'true' }, '‹'), ' Pagina prima');
    this.bSucc = h('button', { class: 'ui-bottone ui-lt-nav', type: 'button', onclick: () => this.successiva() }, 'Pagina dopo ', h('span', { 'aria-hidden': 'true' }, '›'));
    this.bStampato = h(
      'button',
      { class: 'ui-bottone ui-bottone--leggero ui-lt-stampato-b', type: 'button', 'aria-pressed': 'false', onclick: () => this.toggleStampato() },
      h('span', { class: 'ui-tasto', 'aria-hidden': 'true' }, 'S'),
      'Leggi stampato',
    );
    const bChiudi = h(
      'button',
      { class: 'ui-bottone ui-lt-chiudi', type: 'button', onclick: () => this.emit('chiudi') },
      h('span', { class: 'ui-tasto', 'aria-hidden': 'true' }, 'Esc'),
      'Metti via',
    );
    this.el.setAttribute('aria-labelledby', 'ui-lt-titolo');
    this.el.removeAttribute('aria-label');
    this.el.append(
      h('div', { class: 'ui-velo ui-velo--scuro', 'aria-hidden': 'true' }),
      h('div', { class: 'ui-lt-cornice' }, h('header', { class: 'ui-lt-testa' }, this.titolo, this.supporto), this.scena, h('nav', { class: 'ui-lt-barra', 'aria-label': 'Pagine' }, this.bPrec, this.contatore, this.bSucc, this.bStampato, bChiudi)),
    );
    this.scena.addEventListener('click', (e) => {
      if (!this.carta || this.pagineVisibili() >= this.carta.pagine.length) return;
      if ((e.target as Element).closest('button, a')) return;
      const r = this.scena.getBoundingClientRect();
      if (e.clientX < r.left + r.width * 0.3) this.precedente();
      else if (e.clientX > r.left + r.width * 0.7) this.successiva();
    });
    addEventListener('resize', () => {
      if (this.visible && this.carta?.tipo === 'libretto') this.disegna(0);
    });
  }

  /** Mostra una carta, dalla pagina `pagina` (0-based). */
  show(carta: Carta, pagina = 0): void {
    this.carta = carta;
    this.indice = 0;
    this.titolo.textContent = carta.titolo;
    this.supporto.textContent = carta.supporto ?? '';
    this.supporto.hidden = !carta.supporto;
    this.el.dataset['tipo'] = carta.tipo;
    this.vaiA(pagina, 0);
    this.apri();
  }

  /** Va alla pagina indicata (0-based). Nel libretto la pagina è allineata alla coppia di sinistra. */
  vaiA(pagina: number, direzione: -1 | 0 | 1 = 0): void {
    if (!this.carta) return;
    const passo = this.pagineVisibili();
    const max = Math.max(0, this.carta.pagine.length - 1);
    let i = Math.max(0, Math.min(max, Math.floor(pagina)));
    i -= i % passo;
    const cambiata = i !== this.indice;
    this.indice = i;
    this.disegna(direzione);
    if (cambiata || direzione === 0) this.emit('pagina', this.indice);
  }

  successiva(): void {
    if (!this.carta) return;
    const passo = this.pagineVisibili();
    if (this.indice + passo < this.carta.pagine.length) this.vaiA(this.indice + passo, 1);
  }

  precedente(): void {
    if (this.indice > 0) this.vaiA(this.indice - this.pagineVisibili(), -1);
  }

  /** Alterna la lettura a mano e quella in carattere stampato, solo per il lettore (GDD §10: «versione stampata a richiesta»). */
  toggleStampato(vero = !this.el.classList.contains('ui-lt-stampato')): void {
    this.el.classList.toggle('ui-lt-stampato', vero);
    this.bStampato.setAttribute('aria-pressed', String(vero));
    this.bStampato.lastChild!.textContent = vero ? 'Leggi a mano' : 'Leggi stampato';
  }

  /** Pagina corrente (0-based). */
  get paginaCorrente(): number {
    return this.indice;
  }

  override gestisciTasto(e: KeyboardEvent): boolean {
    switch (e.key) {
      case 'Escape':
        this.emit('chiudi');
        return true;
      case 'ArrowRight':
        this.successiva();
        return true;
      case 'ArrowLeft':
        this.precedente();
        return true;
      case 'ArrowDown':
      case 'ArrowUp':
        this.scorri(e.key === 'ArrowDown' ? 80 : -80);
        return true;
      case 'PageDown':
      case ' ':
        // Prima si legge fino in fondo la pagina lunga, poi si gira.
        if (!this.scorri('pagina')) this.successiva();
        return true;
      case 'PageUp':
        if (!this.scorri('pagina-su')) this.precedente();
        return true;
      case 'Home':
        this.vaiA(0, -1);
        return true;
      case 'End':
        this.vaiA(Number.MAX_SAFE_INTEGER, 1);
        return true;
      case 's':
      case 'S':
        if (e.ctrlKey || e.metaKey || e.altKey || this.bStampato.offsetParent === null) return false;
        this.toggleStampato();
        return true;
      default:
        return false;
    }
  }

  protected override focusIniziale(): HTMLElement | null {
    return this.bSucc.disabled ? (this.el.querySelector<HTMLElement>('.ui-lt-chiudi') ?? null) : this.bSucc;
  }

  /** Scorre la pagina lunga visibile; restituisce false se non c'era niente da scorrere in quel verso. */
  private scorri(quanto: number | 'pagina' | 'pagina-su'): boolean {
    const pagine = [...this.scena.querySelectorAll<HTMLElement>('.ui-lt-pagina')];
    for (const p of pagine) {
      const passo = quanto === 'pagina' ? p.clientHeight * 0.85 : quanto === 'pagina-su' ? -p.clientHeight * 0.85 : quanto;
      const prima = p.scrollTop;
      const max = p.scrollHeight - p.clientHeight;
      if (max <= 1) continue;
      if ((passo > 0 && prima >= max - 1) || (passo < 0 && prima <= 0)) continue;
      p.scrollBy({ top: passo, behavior: this.ridotto() ? 'auto' : 'smooth' });
      return true;
    }
    return false;
  }

  /** Segna le pagine che continuano più in basso («segue»). */
  private aggiornaSegue(p: HTMLElement): void {
    p.classList.toggle('ui-lt-segue', p.scrollHeight - p.scrollTop - p.clientHeight > 6);
  }

  /** Il libretto mostra due pagine affiancate quando c'è spazio. */
  private pagineVisibili(): number {
    if (this.carta?.tipo !== 'libretto') return 1;
    const larghezza = this.radice?.clientWidth || (typeof innerWidth === 'number' ? innerWidth : 1280);
    return larghezza >= 1000 ? 2 : 1;
  }

  private disegna(direzione: -1 | 0 | 1): void {
    const carta = this.carta;
    if (!carta) return;
    const passo = this.pagineVisibili();
    svuota(this.scena);
    const foglio = h('div', { class: `ui-lt-foglio ui-lt--${carta.tipo}${passo === 2 ? ' ui-lt--doppia' : ''}` });
    for (let k = 0; k < passo; k++) {
      const n = this.indice + k;
      const pag = carta.pagine[n];
      foglio.append(pag ? this.pagina(carta, pag, n) : h('div', { class: 'ui-carta ui-lt-pagina ui-lt-pagina--vuota', 'aria-hidden': 'true' }));
    }
    if (direzione !== 0 && !this.ridotto()) foglio.classList.add(direzione > 0 ? 'ui-lt-entra-destra' : 'ui-lt-entra-sinistra');
    this.scena.append(foglio);
    for (const p of foglio.querySelectorAll<HTMLElement>('.ui-lt-pagina')) {
      p.addEventListener('scroll', () => this.aggiornaSegue(p), { passive: true });
      requestAnimationFrame(() => this.aggiornaSegue(p));
    }

    const totale = carta.pagine.length;
    const ultima = Math.min(totale, this.indice + passo);
    this.contatore.textContent =
      totale <= 1 ? '' : passo === 2 && ultima > this.indice + 1 ? `Pagine ${this.indice + 1}–${ultima} di ${totale}` : `Pagina ${this.indice + 1} di ${totale}`;
    const soloUna = totale <= passo;
    this.bPrec.hidden = soloUna;
    this.bSucc.hidden = soloUna;
    this.bPrec.disabled = this.indice <= 0;
    this.bSucc.disabled = this.indice + passo >= totale;
  }

  private pagina(carta: Carta, pag: PaginaCarta, n: number): HTMLElement {
    const el = h('article', { class: 'ui-carta ui-lt-pagina', 'aria-label': `Pagina ${n + 1}` });
    if (pag.data) el.append(h('p', { class: 'ui-lt-data' }, pag.data));
    if (pag.intestazione) el.append(h('h3', { class: 'ui-lt-intestazione' }, nodiTesto(pag.intestazione)));
    el.append(h('div', { class: 'ui-lt-testo' }, paragrafi(pag.testo)));
    if (pag.tabella?.length) {
      el.append(
        h(
          'table',
          { class: 'ui-lt-tabella' },
          h(
            'tbody',
            null,
            pag.tabella.map(([a, b]) => h('tr', null, h('th', { scope: 'row' }, a), h('td', null, b))),
          ),
        ),
      );
    }
    if (pag.schizzo) {
      el.append(
        h(
          'figure',
          { class: 'ui-lt-schizzo' },
          h('span', { class: 'ui-lt-schizzo-cornice', 'aria-hidden': 'true' }),
          h('figcaption', null, h('span', { class: 'ui-sr' }, 'Schizzo: '), nodiTesto(pag.schizzo)),
        ),
      );
    }
    if (pag.firma) el.append(h('p', { class: 'ui-lt-firma' }, pag.firma));
    if (pag.margine) el.append(h('aside', { class: 'ui-lt-margine ui-lt-margine--autore', 'aria-label': 'Nota a margine' }, nodiTesto(pag.margine)));
    if (pag.notaElvira) el.append(h('aside', { class: 'ui-lt-margine', 'aria-label': 'Nota di Elvira, a matita' }, nodiTesto(pag.notaElvira)));
    el.append(h('span', { class: 'ui-lt-segno-segue', 'aria-hidden': 'true' }, 'segue ▾'));
    if (carta.tipo === 'libretto') el.append(h('span', { class: 'ui-lt-numero', 'aria-hidden': 'true' }, String(n + 1)));
    if (carta.tipo === 'cartellino') el.append(h('span', { class: 'ui-lt-foro', 'aria-hidden': 'true' }));
    return el;
  }
}
