import { Componente } from '../core/componente';
import { h, svuota } from '../core/dom';
import { nodiTesto, parolaBarrata, testoSemplice } from '../core/testo';
import './taccuino.css';

/**
 * Le due mani di Elvira (GDD §8.2): la «tecnica» in stampatello a matita dura,
 * la «madre» in corsivo a matita morbida.
 */
export type ManoTaccuino = 'tecnica' | 'madre';

/** Una nota libera, o attaccata sotto una domanda o un indizio. */
export interface NotaTaccuino {
  id: string;
  testo: string;
  mano?: ManoTaccuino;
  nuova?: boolean;
}

export interface IndizioTaccuino {
  id: string;
  /** Il testo dell'indizio (markup [[tecnica|locale]] e *corsivo*). */
  testo: string;
  /** Da dove viene (es. «Capsula n. 5, Cripta», «Togna, al lavatoio»). Sempre presente. */
  fonte: string;
  mano?: ManoTaccuino;
  /** Note scritte sotto l'indizio (spesso dall'altra mano). */
  note?: NotaTaccuino[];
  /** Voce nuova: evidenziata a matita finché non è vista. */
  nuovo?: boolean;
}

export interface PistaTaccuino {
  id: string;
  /** La pista è una domanda («Chi ha scritto la lettera di Marta?»), mai «vai al punto X». */
  domanda: string;
  mano?: ManoTaccuino;
  /** Pista chiusa: barrata, con la risposta se c'è. */
  chiusa?: boolean;
  risposta?: string;
  nuova?: boolean;
  indizi: IndizioTaccuino[];
  /** Note scritte sotto la domanda. */
  note?: NotaTaccuino[];
}

export interface ParolaTaccuino {
  /** La parola tecnica di Elvira, che compare barrata («asse»). */
  tecnica: string;
  /** La parola locale scritta accanto («il Fuso»). */
  locale: string;
  nota?: string;
  nuova?: boolean;
}

/** Un proverbio: in dialetto (se c'è) e in italiano, con la fonte e la nota di Elvira. */
export interface ProverbioTaccuino {
  id?: string;
  dialetto?: string | null;
  italiano: string;
  fonte?: string;
  /** Ciò che Elvira ci scrive accanto (la regola che c'è dietro, quando l'ha capita). */
  nota?: string;
  nuovo?: boolean;
}

/** Una variante della leggenda della Partenza, come l'ha raccontata l'Ombrista. */
export interface LeggendaTaccuino {
  id: string;
  /** La frase trascritta. */
  testo: string;
  /** Quando e chi (es. «L'Ombrista, prima sera»). */
  fonte: string;
  /** Id del testo completo (es. «testi.leggende.partenza_1»): se c'è, la voce si può aprire («leggi»). */
  testoCompleto?: string;
  nuova?: boolean;
}

/** Una sacca d'aria trovata sott'acqua: resta segnata per sempre. */
export interface RespiroTaccuino {
  nome: string;
  dove: string;
  nuovo?: boolean;
}

export interface DatiTaccuino {
  /** La riga fissa in alto: il prossimo evento del cielo («Meta fra 34 s», «Brace alle 19:30»). */
  prossimoEvento: string;
  piste: PistaTaccuino[];
  parole: ParolaTaccuino[];
  /** Note libere («Una stella non fa ombra»), sotto le piste. */
  note?: NotaTaccuino[];
  /** Proverbi (nella scheda «Parole», pagina di destra). */
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
  /** Note, parole tecniche e proverbi visti (id della nota, parola tecnica, id o testo del proverbio). */
  parole: string[];
  leggende: string[];
}

export interface EventiTaccuino {
  chiudi: void;
  /** È stata scelta una pista. */
  pista: string;
  /** Voci nuove mostrate a schermo (emesso quando si vedono). */
  visto: VociViste;
  /** Si vuole leggere il testo completo di una leggenda (l'id del testo, es. «testi.leggende.partenza_1»). */
  leggi: string;
}

export type SchedaTaccuino = 'piste' | 'parole' | 'leggende' | 'respiri';
type Scheda = SchedaTaccuino;

const VUOTE: VociViste = { piste: [], indizi: [], parole: [], leggende: [] };

/**
 * Taccuino di Elvira: un quaderno aperto su due colonne. A sinistra le piste (domande aperte) e gli appunti,
 * a destra gli indizi della pista scelta con la loro fonte; nella scheda «Parole» le parole tecniche
 * barrate con accanto quella locale, e i proverbi. In alto, fissa, la riga del prossimo evento del cielo.
 * Le voci nuove sono evidenziate a matita, con un asterisco rosso nel margine.
 */
export class Taccuino extends Componente<EventiTaccuino> {
  private readonly riga: HTMLParagraphElement;
  private readonly sinistra: HTMLDivElement;
  private readonly destra: HTMLDivElement;
  private readonly schede: Record<Scheda, HTMLButtonElement>;
  private dati: DatiTaccuino = { prossimoEvento: '', piste: [], parole: [] };
  private scheda: Scheda = 'piste';
  private pistaAttiva: string | null = null;
  private vistiInAttesa: VociViste | null = null;

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

  /** Apre il taccuino (con nuovi dati, se dati), sulla scheda indicata. */
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

  /** Aggiorna solo la riga fissa del prossimo evento del cielo (si può chiamare ogni secondo). */
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

  protected override quandoMostrato(): void {
    const v = this.vistiInAttesa;
    this.vistiInAttesa = null;
    if (v) this.segnalaVisti(v);
  }

  // ---------- interni ----------

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
    svuota(this.sinistra);
    svuota(this.destra);
    this.sinistra.setAttribute('role', 'tabpanel');
    this.sinistra.setAttribute('aria-labelledby', `ui-tc-tab-${scheda}`);
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
    svuota(this.sinistra);
    svuota(this.destra);
    this.disegnaPiste();
    if (focus) this.sinistra.querySelector<HTMLElement>('.ui-tc-pista[aria-current="true"]')?.focus();
    this.emit('pista', id);
  }

  /** Segno «nuovo» nel margine e testo per i lettori di schermo. */
  private segno(nuovo: boolean | undefined): (HTMLElement | null)[] {
    return nuovo ? [h('span', { class: 'ui-nuovo-segno', 'aria-hidden': 'true' }, '*')] : [];
  }

  private nota(n: NotaTaccuino, classe = 'ui-tc-nota'): HTMLElement {
    return h(
      'p',
      { class: `${classe}` },
      ...this.segno(n.nuova),
      h('span', { class: `ui-tc-mano--${n.mano ?? 'tecnica'}${n.nuova ? ' ui-nuovo' : ''}` }, nodiTesto(n.testo)),
      n.nuova ? h('span', { class: 'ui-sr' }, ' (nuova)') : null,
    );
  }

  private disegnaPiste(): void {
    const { piste } = this.dati;
    const note = this.dati.note ?? [];
    const aperte = piste.filter((p) => !p.chiusa);
    const chiuse = piste.filter((p) => p.chiusa);

    this.sinistra.append(h('h2', { class: 'ui-tc-intestazione' }, 'Piste'));
    const voce = (p: PistaTaccuino): HTMLLIElement => {
      const attiva = p.id === this.pistaAttiva;
      const nuoviIndizi = p.indizi.filter((i) => i.nuovo).length;
      const b = h(
        'button',
        {
          type: 'button',
          class: `ui-tc-pista ui-tc-mano--${p.mano ?? 'tecnica'}${p.chiusa ? ' ui-tc-pista--chiusa' : ''}`,
          'aria-current': attiva ? 'true' : 'false',
          tabindex: attiva ? 0 : -1,
          onclick: () => this.scegliPista(p.id, true),
        },
        ...this.segno(p.nuova || nuoviIndizi > 0),
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
    if (note.length) {
      this.sinistra.append(h('h3', { class: 'ui-tc-sottotitolo' }, 'Appunti'), ...note.map((n) => this.nota(n, 'ui-tc-nota ui-tc-appunto')));
    }

    const p = piste.find((x) => x.id === this.pistaAttiva);
    const viste: VociViste = {
      ...VUOTE,
      piste: piste.filter((x) => x.nuova).map((x) => x.id),
      parole: note.filter((n) => n.nuova).map((n) => n.id),
    };
    if (!p) {
      this.segnalaVisti(viste);
      return;
    }
    this.destra.setAttribute('aria-label', `Indizi: ${testoSemplice(p.domanda)}`);
    this.destra.append(h('h2', { class: `ui-tc-domanda ui-tc-mano--${p.mano ?? 'tecnica'}${p.chiusa ? ' ui-tc-domanda--chiusa' : ''}` }, nodiTesto(p.domanda)));
    for (const n of p.note ?? []) this.destra.append(this.nota(n, 'ui-tc-nota ui-tc-nota--domanda'));
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
            ...this.segno(i.nuovo),
            h('span', { class: `ui-tc-indizio-testo ui-tc-mano--${i.mano ?? 'tecnica'}${i.nuovo ? ' ui-nuovo' : ''}` }, nodiTesto(i.testo)),
            i.nuovo ? h('span', { class: 'ui-sr' }, ' (nuovo)') : null,
            h('span', { class: 'ui-tc-fonte' }, `— ${i.fonte}`),
            ...(i.note ?? []).map((n) => this.nota(n, 'ui-tc-nota ui-tc-nota--indizio')),
          ),
        ),
      ),
    );
    viste.indizi = p.indizi.filter((i) => i.nuovo).map((i) => i.id);
    viste.parole.push(...(p.note ?? []).filter((n) => n.nuova).map((n) => n.id), ...p.indizi.flatMap((i) => (i.note ?? []).filter((n) => n.nuova).map((n) => n.id)));
    this.segnalaVisti(viste);
  }

  private disegnaParole(): void {
    const parole = this.dati.parole;
    const proverbi = this.dati.proverbi ?? [];
    const voceParola = (p: ParolaTaccuino): HTMLLIElement =>
      h(
        'li',
        { class: 'ui-tc-parola' },
        ...this.segno(p.nuova),
        h('span', { class: p.nuova ? 'ui-nuovo' : '' }, parolaBarrata(p.tecnica, p.locale)),
        p.nota ? h('span', { class: 'ui-tc-parola-nota' }, nodiTesto(p.nota)) : null,
      );
    const voceProverbio = (p: ProverbioTaccuino): HTMLLIElement =>
      h(
        'li',
        { class: 'ui-tc-proverbio' },
        ...this.segno(p.nuovo),
        p.dialetto
          ? h('span', { class: `ui-tc-dialetto${p.nuovo ? ' ui-nuovo' : ''}`, lang: 'lmo' }, `«${p.dialetto}»`)
          : h('span', { class: `ui-tc-dialetto${p.nuovo ? ' ui-nuovo' : ''}` }, `«${p.italiano}»`),
        p.dialetto ? h('span', { class: 'ui-tc-traduzione' }, nodiTesto(p.italiano)) : null,
        p.nota ? h('span', { class: 'ui-tc-nota-proverbio ui-tc-mano--madre' }, nodiTesto(p.nota)) : null,
        p.fonte ? h('span', { class: 'ui-tc-fonte' }, `— ${p.fonte}`) : null,
      );
    this.sinistra.append(
      h('h2', { class: 'ui-tc-intestazione' }, 'Parole di qui'),
      h('p', { class: 'ui-tc-premessa' }, 'Barrata la mia, accanto quella che usano loro.'),
      parole.length ? h('ul', { class: 'ui-tc-parole' }, parole.map(voceParola)) : h('p', { class: 'ui-tc-vuoto' }, 'Nessuna parola nuova, finora.'),
    );
    this.destra.setAttribute('aria-label', 'Proverbi');
    this.destra.append(
      h('h2', { class: 'ui-tc-intestazione' }, 'Proverbi'),
      proverbi.length ? h('ul', { class: 'ui-tc-parole' }, proverbi.map(voceProverbio)) : h('p', { class: 'ui-tc-vuoto' }, 'La gente velata parla per proverbi. Ascolta.'),
    );
    this.segnalaVisti({
      ...VUOTE,
      parole: [...parole.filter((p) => p.nuova).map((p) => p.tecnica), ...proverbi.filter((p) => p.nuovo).map((p) => p.id ?? p.italiano)],
    });
  }

  private disegnaLeggende(): void {
    const leggende = this.dati.leggende ?? [];
    this.destra.setAttribute('aria-label', 'Leggende, seguito');
    this.sinistra.append(h('h2', { class: 'ui-tc-intestazione' }, 'La Partenza, come la racconta Pina'));
    if (!leggende.length) this.sinistra.append(h('p', { class: 'ui-tc-vuoto' }, 'Alla brace, in Piazza delle Ore, l’Ombrista tende il suo telo.'));
    // Le più recenti per prime; si riempie la pagina di sinistra e poi quella di destra.
    const ordinate = [...leggende].reverse();
    const meta = Math.ceil(ordinate.length / 2);
    const voce = (l: LeggendaTaccuino): HTMLElement =>
      h(
        'article',
        { class: 'ui-tc-leggenda' },
        h('h3', { class: 'ui-tc-sera' }, ...this.segno(l.nuova), l.fonte),
        h('p', { class: `ui-tc-mano--madre${l.nuova ? ' ui-nuovo' : ''}` }, nodiTesto(l.testo)),
        l.testoCompleto
          ? h(
              'button',
              { type: 'button', class: 'ui-bottone ui-bottone--leggero ui-tc-leggi', onclick: () => this.emit('leggi', l.testoCompleto!) },
              'Rileggi tutta la storia',
            )
          : null,
      );
    this.sinistra.append(...ordinate.slice(0, meta).map(voce));
    this.destra.append(...ordinate.slice(meta).map(voce));
    this.segnalaVisti({ ...VUOTE, leggende: leggende.filter((l) => l.nuova).map((l) => l.id) });
  }

  private disegnaRespiri(): void {
    const respiri = this.dati.respiri ?? [];
    this.destra.setAttribute('aria-label', 'Respiri, seguito');
    this.sinistra.append(
      h('h2', { class: 'ui-tc-intestazione' }, 'Respiri'),
      h('p', { class: 'ui-tc-premessa' }, 'Le sacche d’aria sotto il lago. Qui si respira.'),
    );
    if (!respiri.length) this.sinistra.append(h('p', { class: 'ui-tc-vuoto' }, 'Ancora nessuna.'));
    const voce = (r: RespiroTaccuino): HTMLLIElement =>
      h(
        'li',
        { class: 'ui-tc-respiro' },
        ...this.segno(r.nuovo),
        h('span', { class: `ui-tc-mano--tecnica${r.nuovo ? ' ui-nuovo' : ''}` }, r.nome),
        h('span', { class: 'ui-tc-fonte' }, r.dove),
      );
    const meta = Math.ceil(respiri.length / 2);
    if (respiri.length) this.sinistra.append(h('ul', { class: 'ui-tc-indizi' }, respiri.slice(0, meta).map(voce)));
    if (respiri.length > meta) this.destra.append(h('ul', { class: 'ui-tc-indizi' }, respiri.slice(meta).map(voce)));
  }

  /** Emette «visto» per ciò che è a schermo; se il taccuino è ancora chiuso, aspetta l'apertura. */
  private segnalaVisti(v: VociViste): void {
    const vuoto = !v.piste.length && !v.indizi.length && !v.parole.length && !v.leggende.length;
    if (vuoto) return;
    if (!this.visible) {
      this.vistiInAttesa = v;
      return;
    }
    this.emit('visto', v);
  }
}
