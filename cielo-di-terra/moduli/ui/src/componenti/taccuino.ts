import { Componente } from '../core/componente';
import { h, svuota } from '../core/dom';
import { nodiTesto, parolaBarrata, testoSemplice } from '../core/testo';
import './taccuino.css';

export interface IndizioTaccuino {
  id: string;
  /** Il testo dell'indizio, scritto da Elvira (markup [[tecnica|locale]] e *corsivo*). */
  testo: string;
  /** Da dove viene (es. «libretto di Aurelio, Chiodo 37», «Ottavio, in piazza»). */
  fonte: string;
  /** Voce nuova: evidenziata a matita finché non è vista. */
  nuovo?: boolean;
  /**
   * Quale mano di Elvira l'ha scritto: la «tecnica» in stampatello a matita dura (predefinita),
   * la «madre» in corsivo a matita morbida.
   */
  mano?: ManoTaccuino;
}

export type ManoTaccuino = 'tecnica' | 'madre';

export interface PistaTaccuino {
  id: string;
  /** La pista è una domanda aperta («Chi ha scritto la lettera di Marta?»). */
  domanda: string;
  /** Pista chiusa: barrata, con la risposta se c'è. */
  chiusa?: boolean;
  risposta?: string;
  nuova?: boolean;
  indizi: IndizioTaccuino[];
}

export interface ParolaTaccuino {
  /** La parola tecnica di Elvira, che compare barrata («asse»). */
  tecnica: string;
  /** La parola locale scritta accanto («il Fuso»). */
  locale: string;
  nota?: string;
  nuova?: boolean;
}

/** Un proverbio in dialetto con la traduzione di Elvira e, quando l'ha capita, la regola che c'è dietro. */
export interface ProverbioTaccuino {
  dialetto: string;
  traduzione: string;
  regola?: string;
  nuovo?: boolean;
}

/** Una variante della leggenda della Partenza, come l'ha raccontata l'Ombrista. */
export interface LeggendaTaccuino {
  id: string;
  /** Quando (es. «Sera del giorno 2»). */
  sera: string;
  testo: string;
  nuova?: boolean;
}

/** Una sacca d'aria trovata sott'acqua: resta segnata per sempre. */
export interface RespiroTaccuino {
  nome: string;
  dove: string;
  nuovo?: boolean;
}

export interface DatiTaccuino {
  /** La riga fissa in alto: il prossimo evento del cielo (es. «Meta fra 34 s», «Brace alle 19:30»). */
  prossimoEvento: string;
  piste: PistaTaccuino[];
  parole: ParolaTaccuino[];
  /** Proverbi in dialetto (nella scheda «Parole», dopo le parole). */
  proverbi?: ProverbioTaccuino[];
  /** Varianti dell'Ombrista; se manca, la scheda «Leggende» non compare. */
  leggende?: LeggendaTaccuino[];
  /** Sacche d'aria; se manca, la scheda «Respiri» non compare. */
  respiri?: RespiroTaccuino[];
  /** Pista selezionata all'apertura (predefinita: la prima nuova, o la prima aperta). */
  pistaAttiva?: string;
}

/** Voci nuove che l'utente ha visto: il gioco può togliere il segno «nuovo». */
export interface VociViste {
  piste: string[];
  indizi: string[];
  /** Parole tecniche (o testi dei proverbi in dialetto) viste. */
  parole: string[];
  leggende: string[];
}

export interface EventiTaccuino {
  chiudi: void;
  /** È stata scelta una pista. */
  pista: string;
  /** Voci nuove mostrate a schermo (emesso quando si vedono). */
  visto: VociViste;
}

export type SchedaTaccuino = 'piste' | 'parole' | 'leggende' | 'respiri';
type Scheda = SchedaTaccuino;

/**
 * Taccuino di Elvira: un quaderno aperto su due colonne. A sinistra le piste (domande aperte),
 * a destra gli indizi della pista scelta con la loro fonte; nella scheda «Parole» le parole tecniche
 * barrate con accanto quella locale. In alto, fissa, la riga del prossimo evento del cielo.
 */
export class Taccuino extends Componente<EventiTaccuino> {
  private readonly riga: HTMLParagraphElement;
  private readonly sinistra: HTMLDivElement;
  private readonly destra: HTMLDivElement;
  private readonly schede: Record<Scheda, HTMLButtonElement>;
  private dati: DatiTaccuino = { prossimoEvento: '', piste: [], parole: [] };
  private scheda: Scheda = 'piste';
  private pistaAttiva: string | null = null;

  constructor() {
    super({ classe: 'ui-modale ui-taccuino', modale: true, ruolo: 'dialog', etichetta: 'Taccuino' });
    this.riga = h('p', { class: 'ui-tc-riga-testo' });
    this.sinistra = h('div', { class: 'ui-tc-pagina ui-tc-sinistra', tabindex: -1 });
    this.destra = h('div', { class: 'ui-tc-pagina ui-tc-destra', tabindex: 0, role: 'region', 'aria-label': 'Pagina di destra' });

    const scheda = (id: Scheda, testo: string): HTMLButtonElement =>
      h('button', { class: 'ui-tc-linguetta', type: 'button', role: 'tab', id: `ui-tc-tab-${id}`, onclick: () => this.mostraScheda(id, true) }, testo);
    this.schede = {
      piste: scheda('piste', 'Piste'),
      parole: scheda('parole', 'Parole'),
      leggende: scheda('leggende', 'Leggende'),
      respiri: scheda('respiri', 'Respiri'),
    };
    const linguette = h(
      'div',
      { class: 'ui-tc-linguette', role: 'tablist', 'aria-label': 'Sezioni del taccuino', 'aria-orientation': 'vertical' },
      Object.values(this.schede),
    );
    linguette.addEventListener('keydown', (e) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      const visibili = this.schedeVisibili();
      const i = visibili.indexOf(this.scheda);
      const d = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1;
      this.mostraScheda(visibili[(i + d + visibili.length) % visibili.length]!, true);
    });

    const bChiudi = h(
      'button',
      { class: 'ui-bottone ui-tc-chiudi', type: 'button', onclick: () => this.emit('chiudi') },
      h('span', { class: 'ui-tasto', 'aria-hidden': 'true' }, 'Esc'),
      'Chiudi il taccuino',
    );

    this.el.append(
      h('div', { class: 'ui-velo', 'aria-hidden': 'true' }),
      h(
        'div',
        { class: 'ui-tc-cornice' },
        h(
          'div',
          { class: 'ui-tc-quaderno' },
          h('div', { class: 'ui-tc-riga', role: 'status' }, h('span', { class: 'ui-tc-riga-etichetta' }, 'Prossimo nel cielo'), this.riga),
          h('div', { class: 'ui-tc-pagine' }, this.sinistra, h('div', { class: 'ui-tc-dorso', 'aria-hidden': 'true' }), this.destra),
          linguette,
        ),
        h(
          'p',
          { class: 'ui-tc-aiuto' },
          h('span', { class: 'ui-tasto' }, '↑'),
          h('span', { class: 'ui-tasto' }, '↓'),
          ' scegli una pista   ',
          h('span', { class: 'ui-tasto' }, 'Tab'),
          ' passa alla pagina accanto   ',
          bChiudi,
        ),
      ),
    );

    this.sinistra.addEventListener('keydown', (e) => {
      if (this.scheda !== 'piste' || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
      e.preventDefault();
      e.stopPropagation();
      this.spostaPista(e.key === 'ArrowDown' ? 1 : -1);
    });
  }

  /** Apre il taccuino (con nuovi dati, se dati). */
  show(dati?: DatiTaccuino, scheda: Scheda = 'piste'): void {
    if (dati) this.dati = dati;
    this.pistaAttiva = this.sceltaIniziale();
    this.disegnaRiga();
    this.mostraScheda(scheda, false);
    this.apri();
  }

  /** Aggiorna i dati (anche a taccuino aperto). */
  aggiorna(dati: DatiTaccuino): void {
    this.dati = dati;
    if (!this.pistaAttiva || !dati.piste.some((p) => p.id === this.pistaAttiva)) this.pistaAttiva = this.sceltaIniziale();
    this.disegnaRiga();
    if (this.visible) this.mostraScheda(this.scheda, false);
  }

  /** Aggiorna solo la riga fissa del prossimo evento del cielo. */
  prossimoEvento(testo: string): void {
    this.dati = { ...this.dati, prossimoEvento: testo };
    this.disegnaRiga();
  }

  override gestisciTasto(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      this.emit('chiudi');
      return true;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (e.key === 't' || e.key === 'T') {
      this.emit('chiudi');
      return true;
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && this.scheda === 'piste' && !this.el.contains(document.activeElement)) {
      this.spostaPista(e.key === 'ArrowDown' ? 1 : -1);
      return true;
    }
    return false;
  }

  protected override focusIniziale(): HTMLElement | null {
    return this.sinistra.querySelector<HTMLElement>('.ui-tc-pista[aria-current="true"]') ?? this.schede[this.scheda];
  }

  private sceltaIniziale(): string | null {
    const p = this.dati.piste;
    const voluta = this.dati.pistaAttiva && p.find((x) => x.id === this.dati.pistaAttiva);
    if (voluta) return voluta.id;
    if (this.pistaAttiva && p.some((x) => x.id === this.pistaAttiva)) return this.pistaAttiva;
    return (p.find((x) => x.nuova || x.indizi.some((i) => i.nuovo)) ?? p.find((x) => !x.chiusa) ?? p[0])?.id ?? null;
  }

  private disegnaRiga(): void {
    this.riga.textContent = this.dati.prossimoEvento || 'Il cielo è quieto.';
  }

  private schedeVisibili(): Scheda[] {
    const v: Scheda[] = ['piste', 'parole'];
    if (this.dati.leggende) v.push('leggende');
    if (this.dati.respiri) v.push('respiri');
    return v;
  }

  private mostraScheda(scheda: Scheda, focus: boolean): void {
    const visibili = this.schedeVisibili();
    if (!visibili.includes(scheda)) scheda = 'piste';
    this.scheda = scheda;
    for (const [id, b] of Object.entries(this.schede) as [Scheda, HTMLButtonElement][]) {
      b.hidden = !visibili.includes(id);
      b.setAttribute('aria-selected', String(id === scheda));
      b.tabIndex = id === scheda ? 0 : -1;
    }
    this.el.dataset['scheda'] = scheda;
    if (scheda === 'piste') this.disegnaPiste();
    else if (scheda === 'parole') this.disegnaParole();
    else if (scheda === 'leggende') this.disegnaLeggende();
    else this.disegnaRespiri();
    if (focus) this.schede[scheda].focus();
  }

  private spostaPista(d: 1 | -1): void {
    const lista = this.dati.piste;
    if (!lista.length) return;
    const i = Math.max(0, lista.findIndex((p) => p.id === this.pistaAttiva));
    const j = (i + d + lista.length) % lista.length;
    this.scegliPista(lista[j]!.id, true);
  }

  private scegliPista(id: string, focus: boolean): void {
    this.pistaAttiva = id;
    this.disegnaPiste();
    if (focus) this.sinistra.querySelector<HTMLElement>('.ui-tc-pista[aria-current="true"]')?.focus();
    this.emit('pista', id);
  }

  private disegnaPiste(): void {
    const { piste } = this.dati;
    const aperte = piste.filter((p) => !p.chiusa);
    const chiuse = piste.filter((p) => p.chiusa);

    svuota(this.sinistra);
    this.pannello('piste');
    this.sinistra.append(h('h2', { class: 'ui-tc-intestazione' }, 'Piste'));
    const voce = (p: PistaTaccuino): HTMLLIElement => {
      const attiva = p.id === this.pistaAttiva;
      const nuoviIndizi = p.indizi.filter((i) => i.nuovo).length;
      const b = h(
        'button',
        {
          type: 'button',
          class: `ui-tc-pista${p.chiusa ? ' ui-tc-pista--chiusa' : ''}`,
          'aria-current': attiva ? 'true' : 'false',
          tabindex: attiva ? 0 : -1,
          onclick: () => this.scegliPista(p.id, true),
        },
        p.nuova || nuoviIndizi ? h('span', { class: 'ui-nuovo-segno', 'aria-hidden': 'true' }, '*') : null,
        h('span', { class: p.nuova ? 'ui-nuovo' : '' }, nodiTesto(p.domanda)),
        p.nuova ? h('span', { class: 'ui-sr' }, ' (nuova)') : null,
        !p.nuova && nuoviIndizi ? h('span', { class: 'ui-sr' }, ` (${nuoviIndizi} indizi nuovi)`) : null,
        p.chiusa ? h('span', { class: 'ui-sr' }, ' (chiusa)') : null,
      );
      return h('li', null, b);
    };
    if (!piste.length) this.sinistra.append(h('p', { class: 'ui-tc-vuoto' }, 'Ancora nessuna domanda. Guardati intorno.'));
    if (aperte.length) this.sinistra.append(h('ul', { class: 'ui-tc-elenco' }, aperte.map(voce)));
    if (chiuse.length) {
      this.sinistra.append(h('h3', { class: 'ui-tc-sottotitolo' }, 'Chiuse'), h('ul', { class: 'ui-tc-elenco ui-tc-elenco--chiuse' }, chiuse.map(voce)));
    }

    svuota(this.destra);
    this.destra.removeAttribute('aria-labelledby');
    const p = piste.find((x) => x.id === this.pistaAttiva);
    if (!p) {
      this.destra.append(h('p', { class: 'ui-tc-vuoto' }, ''));
      return;
    }
    this.destra.setAttribute('aria-label', `Indizi: ${testoSemplice(p.domanda)}`);
    this.destra.append(h('h2', { class: `ui-tc-domanda${p.chiusa ? ' ui-tc-domanda--chiusa' : ''}` }, nodiTesto(p.domanda)));
    if (p.chiusa && p.risposta) this.destra.append(h('p', { class: 'ui-tc-risposta' }, nodiTesto(p.risposta)));
    if (!p.indizi.length) this.destra.append(h('p', { class: 'ui-tc-vuoto' }, 'Niente, per ora.'));
    this.destra.append(
      h(
        'ul',
        { class: 'ui-tc-indizi' },
        p.indizi.map((i) =>
          h(
            'li',
            { class: 'ui-tc-indizio' },
            i.nuovo ? h('span', { class: 'ui-nuovo-segno', 'aria-hidden': 'true' }, '*') : null,
            h('span', { class: `ui-tc-indizio-testo ui-tc-mano--${i.mano ?? 'tecnica'}${i.nuovo ? ' ui-nuovo' : ''}` }, nodiTesto(i.testo)),
            i.nuovo ? h('span', { class: 'ui-sr' }, ' (nuovo)') : null,
            h('span', { class: 'ui-tc-fonte' }, `— ${i.fonte}`),
          ),
        ),
      ),
    );
    this.segnalaVisti({ piste: piste.filter((x) => x.nuova).map((x) => x.id), indizi: p.indizi.filter((i) => i.nuovo).map((i) => i.id), parole: [], leggende: [] });
  }

  private disegnaParole(): void {
    const parole = this.dati.parole;
    const proverbi = this.dati.proverbi ?? [];
    const voceParola = (p: ParolaTaccuino): HTMLLIElement =>
      h(
        'li',
        { class: 'ui-tc-parola' },
        p.nuova ? h('span', { class: 'ui-nuovo-segno', 'aria-hidden': 'true' }, '*') : null,
        h('span', { class: p.nuova ? 'ui-nuovo' : '' }, parolaBarrata(p.tecnica, p.locale)),
        p.nota ? h('span', { class: 'ui-tc-parola-nota' }, nodiTesto(p.nota)) : null,
      );
    const voceProverbio = (p: ProverbioTaccuino): HTMLLIElement =>
      h(
        'li',
        { class: 'ui-tc-proverbio' },
        p.nuovo ? h('span', { class: 'ui-nuovo-segno', 'aria-hidden': 'true' }, '*') : null,
        h('span', { class: `ui-tc-dialetto${p.nuovo ? ' ui-nuovo' : ''}`, lang: 'lmo' }, `«${p.dialetto}»`),
        h('span', { class: 'ui-tc-traduzione' }, nodiTesto(p.traduzione)),
        p.regola ? h('span', { class: 'ui-tc-regola' }, nodiTesto(p.regola)) : null,
      );
    svuota(this.sinistra);
    this.pannello('parole');
    this.sinistra.append(
      h('h2', { class: 'ui-tc-intestazione' }, 'Parole di qui'),
      h('p', { class: 'ui-tc-premessa' }, 'Barrata la mia, accanto quella che usano loro.'),
      parole.length ? h('ul', { class: 'ui-tc-parole' }, parole.map(voceParola)) : h('p', { class: 'ui-tc-vuoto' }, 'Nessuna parola nuova, finora.'),
    );
    svuota(this.destra);
    this.destra.setAttribute('aria-label', 'Proverbi');
    this.destra.append(
      h('h2', { class: 'ui-tc-intestazione' }, 'Proverbi'),
      proverbi.length ? h('ul', { class: 'ui-tc-parole' }, proverbi.map(voceProverbio)) : h('p', { class: 'ui-tc-vuoto' }, 'La gente velata parla per proverbi. Ascolta.'),
    );
    this.segnalaVisti({
      piste: [],
      indizi: [],
      parole: [...parole.filter((p) => p.nuova).map((p) => p.tecnica), ...proverbi.filter((p) => p.nuovo).map((p) => p.dialetto)],
      leggende: [],
    });
  }

  private disegnaLeggende(): void {
    const leggende = this.dati.leggende ?? [];
    svuota(this.sinistra);
    svuota(this.destra);
    this.pannello('leggende');
    this.destra.setAttribute('aria-label', 'Leggende, seguito');
    this.sinistra.append(h('h2', { class: 'ui-tc-intestazione' }, 'La Partenza, come la racconta Pina'));
    if (!leggende.length) this.sinistra.append(h('p', { class: 'ui-tc-vuoto' }, 'Alla brace, in Piazza delle Ore, l\u2019Ombrista tende il suo telo.'));
    // Le più recenti per prime; si riempie la pagina di sinistra e poi quella di destra.
    const ordinate = [...leggende].reverse();
    const meta = Math.ceil(ordinate.length / 2);
    const voce = (l: LeggendaTaccuino): HTMLElement =>
      h(
        'article',
        { class: 'ui-tc-leggenda' },
        h('h3', { class: 'ui-tc-sera' }, l.nuova ? h('span', { class: 'ui-nuovo-segno', 'aria-hidden': 'true' }, '*') : null, l.sera),
        h('p', { class: `ui-tc-mano--madre${l.nuova ? ' ui-nuovo' : ''}` }, nodiTesto(l.testo)),
      );
    this.sinistra.append(...ordinate.slice(0, meta).map(voce));
    this.destra.append(...ordinate.slice(meta).map(voce));
    this.segnalaVisti({ piste: [], indizi: [], parole: [], leggende: leggende.filter((l) => l.nuova).map((l) => l.id) });
  }

  private disegnaRespiri(): void {
    const respiri = this.dati.respiri ?? [];
    svuota(this.sinistra);
    svuota(this.destra);
    this.pannello('respiri');
    this.destra.setAttribute('aria-label', 'Respiri, seguito');
    this.sinistra.append(
      h('h2', { class: 'ui-tc-intestazione' }, 'Respiri'),
      h('p', { class: 'ui-tc-premessa' }, 'Le sacche d\u2019aria sotto il lago. Qui si respira.'),
    );
    if (!respiri.length) this.sinistra.append(h('p', { class: 'ui-tc-vuoto' }, 'Ancora nessuna.'));
    const voce = (r: RespiroTaccuino): HTMLLIElement =>
      h(
        'li',
        { class: 'ui-tc-respiro' },
        r.nuovo ? h('span', { class: 'ui-nuovo-segno', 'aria-hidden': 'true' }, '*') : null,
        h('span', { class: `ui-tc-mano--tecnica${r.nuovo ? ' ui-nuovo' : ''}` }, r.nome),
        h('span', { class: 'ui-tc-fonte' }, r.dove),
      );
    const meta = Math.ceil(respiri.length / 2);
    this.sinistra.append(h('ul', { class: 'ui-tc-indizi' }, respiri.slice(0, meta).map(voce)));
    if (respiri.length > meta) this.destra.append(h('ul', { class: 'ui-tc-indizi' }, respiri.slice(meta).map(voce)));
  }

  private pannello(scheda: Scheda): void {
    this.sinistra.setAttribute('role', 'tabpanel');
    this.sinistra.setAttribute('aria-labelledby', `ui-tc-tab-${scheda}`);
  }

  private segnalaVisti(v: VociViste): void {
    if (!this.visible && !this.el.classList.contains('ui-aperto')) {
      // Si segnala solo ciò che è davvero a schermo: alla prima apertura lo farà quandoMostrato.
      this.vistiInAttesa = v;
      return;
    }
    if (v.piste.length || v.indizi.length || v.parole.length || v.leggende.length) this.emit('visto', v);
  }

  private vistiInAttesa: VociViste | null = null;

  protected override quandoMostrato(): void {
    const v = this.vistiInAttesa;
    this.vistiInAttesa = null;
    if (v && (v.piste.length || v.indizi.length || v.parole.length || v.leggende.length)) this.emit('visto', v);
  }
}
