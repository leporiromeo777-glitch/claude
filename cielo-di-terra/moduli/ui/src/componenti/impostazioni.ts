import { Componente } from '../core/componente';
import { h } from '../core/dom';
import {
  LIMITI,
  type CambioImpostazione,
  type ChiaveImpostazione,
  type Impostazioni,
  type StoreImpostazioni,
} from '../impostazioni/store';
import './impostazioni.css';

type ChiaviTipo<T> = { [K in ChiaveImpostazione]: Impostazioni[K] extends T ? K : never }[ChiaveImpostazione];

type Riga =
  | { tipo: 'cursore'; chiave: ChiaviTipo<number>; etichetta: string; nota?: string; formato: (v: number) => string }
  | { tipo: 'interruttore'; chiave: ChiaviTipo<boolean>; etichetta: string; nota?: string }
  | { tipo: 'scelta'; chiave: ChiaviTipo<string>; etichetta: string; nota?: string; opzioni: { valore: string; etichetta: string }[] };

interface Sezione {
  id: string;
  titolo: string;
  righe: Riga[];
}

const numero = (v: number, cifre = 0): string =>
  v.toLocaleString('it-IT', { minimumFractionDigits: cifre, maximumFractionDigits: cifre });
const percento = (v: number): string => `${numero(v * 100)} %`;

/** Le sezioni e le righe del pannello. */
export const SEZIONI_IMPOSTAZIONI: readonly Sezione[] = [
  {
    id: 'visione',
    titolo: 'Visione e controlli',
    righe: [
      { tipo: 'cursore', chiave: 'campoVisivo', etichetta: 'Campo visivo', formato: (v) => `${numero(v)}°` },
      { tipo: 'cursore', chiave: 'sensibilitaMouse', etichetta: 'Sensibilità del mouse', formato: (v) => `${numero(v, 2)} ×` },
      { tipo: 'interruttore', chiave: 'invertiAsseY', etichetta: 'Inverti l’asse verticale', nota: 'Il mouse in avanti fa guardare in basso.' },
      {
        tipo: 'interruttore',
        chiave: 'oscillazioneTesta',
        etichetta: 'Oscillazione della testa',
        nota: 'Il passo fa ondeggiare lo sguardo. Spenta di base, per chi soffre il mal di mare.',
      },
      {
        tipo: 'interruttore',
        chiave: 'fisicaPiena',
        etichetta: 'Fisica piena',
        nota: 'Il Coriolis agisce per intero anche sul passo e sui salti di Elvira; di norma è ridotto al 40%.',
      },
    ],
  },
  {
    id: 'suono',
    titolo: 'Suono',
    righe: [
      { tipo: 'cursore', chiave: 'volumeGenerale', etichetta: 'Volume generale', formato: percento },
      { tipo: 'cursore', chiave: 'volumeMusica', etichetta: 'Musica', formato: percento },
      { tipo: 'cursore', chiave: 'volumeAmbiente', etichetta: 'Ambiente', nota: 'Vento, acqua, campane, macchine.', formato: percento },
      { tipo: 'cursore', chiave: 'volumeVoci', etichetta: 'Voci', formato: percento },
    ],
  },
  {
    id: 'accessibilita',
    titolo: 'Testo e accessibilità',
    righe: [
      {
        tipo: 'scelta',
        chiave: 'dimensioneTesto',
        etichetta: 'Dimensione del testo',
        opzioni: [
          { valore: 'normale', etichetta: 'Normale' },
          { valore: 'grande', etichetta: 'Grande' },
          { valore: 'molto-grande', etichetta: 'Molto grande' },
          { valore: 'enorme', etichetta: 'Enorme' },
        ],
      },
      { tipo: 'interruttore', chiave: 'sottotitoli', etichetta: 'Sottotitoli', nota: 'Le voci, con il nome di chi parla.' },
      { tipo: 'interruttore', chiave: 'sottotitoliSuoni', etichetta: 'Sottotitoli dei suoni', nota: 'Campane, macchine, sciami, con la direzione.' },
      { tipo: 'cursore', chiave: 'sfondoSottotitoli', etichetta: 'Fondo dei sottotitoli', formato: percento },
      {
        tipo: 'scelta',
        chiave: 'velocitaTesto',
        etichetta: 'Velocità del testo',
        nota: 'Come compaiono le battute dei dialoghi.',
        opzioni: [
          { valore: 'lenta', etichetta: 'Lenta' },
          { valore: 'normale', etichetta: 'Normale' },
          { valore: 'veloce', etichetta: 'Veloce' },
          { valore: 'istantanea', etichetta: 'Subito' },
        ],
      },
      {
        tipo: 'scelta',
        chiave: 'calligrafia',
        etichetta: 'Calligrafia delle carte',
        nota: 'Lettere, libretto di Aurelio, taccuino: a mano o in carattere da stampa.',
        opzioni: [
          { valore: 'corsiva', etichetta: 'A mano' },
          { valore: 'semplice', etichetta: 'Testo semplice' },
        ],
      },
      { tipo: 'interruttore', chiave: 'caratteriLeggibili', etichetta: 'Caratteri ad alta leggibilità', nota: 'Atkinson Hyperlegible in tutta l’interfaccia.' },
      { tipo: 'interruttore', chiave: 'altoContrasto', etichetta: 'Alto contrasto', nota: 'Carta piena e inchiostro nero, senza grana.' },
      { tipo: 'interruttore', chiave: 'riduciMovimenti', etichetta: 'Riduci i movimenti dell’interfaccia', nota: 'Niente dissolvenze, pagine che scorrono o testo progressivo.' },
      { tipo: 'interruttore', chiave: 'rosaDeiVenti', etichetta: 'Pianta: rosa dei venti' },
      { tipo: 'interruttore', chiave: 'posizioneSullaPianta', etichetta: 'Pianta: posizione di Elvira' },
    ],
  },
];

export interface EventiPannelloImpostazioni {
  /** L'utente vuole tornare indietro (Esc o «Indietro»). */
  indietro: void;
  /** Un'impostazione è cambiata (rilancia l'evento dello store). */
  cambio: CambioImpostazione;
}

/**
 * Pannello delle impostazioni: un foglio con tre schede. Ogni controllo scrive subito nello store
 * (che salva in localStorage ed emette «cambio»).
 */
export class PannelloImpostazioni extends Componente<EventiPannelloImpostazioni> {
  private readonly schede: HTMLButtonElement[] = [];
  private readonly pannelli: HTMLElement[] = [];
  private readonly aggiornatori = new Map<ChiaveImpostazione, () => void>();
  private readonly bRipristina: HTMLButtonElement;
  private timerRipristino: ReturnType<typeof setTimeout> | null = null;
  private schedaAttiva = 0;

  constructor(private readonly store: StoreImpostazioni) {
    super({ classe: 'ui-modale ui-impostazioni', modale: true, ruolo: 'dialog', etichetta: 'Impostazioni' });

    const listaSchede = h('div', { class: 'ui-imp-schede', role: 'tablist', 'aria-label': 'Sezioni delle impostazioni' });
    const corpo = h('div', { class: 'ui-imp-corpo' });
    SEZIONI_IMPOSTAZIONI.forEach((sez, i) => {
      const idScheda = `ui-imp-scheda-${sez.id}`;
      const idPannello = `ui-imp-pannello-${sez.id}`;
      const scheda = h(
        'button',
        {
          class: 'ui-imp-scheda',
          type: 'button',
          role: 'tab',
          id: idScheda,
          'aria-controls': idPannello,
          onclick: () => this.mostraScheda(i, true),
        },
        sez.titolo,
      );
      const pannello = h(
        'section',
        { class: 'ui-imp-pannello', role: 'tabpanel', id: idPannello, 'aria-labelledby': idScheda, tabindex: -1 },
        sez.righe.map((r) => this.creaRiga(r)),
      );
      this.schede.push(scheda);
      this.pannelli.push(pannello);
      listaSchede.append(scheda);
      corpo.append(pannello);
    });
    listaSchede.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      const n = this.schede.length;
      let j = this.schedaAttiva;
      if (e.key === 'ArrowLeft') j = (j - 1 + n) % n;
      else if (e.key === 'ArrowRight') j = (j + 1) % n;
      else if (e.key === 'Home') j = 0;
      else j = n - 1;
      this.mostraScheda(j, true);
    });

    this.bRipristina = h('button', { class: 'ui-bottone ui-bottone--leggero', type: 'button', onclick: () => this.ripristina() }, 'Ripristina i valori di base');
    const bIndietro = h(
      'button',
      { class: 'ui-bottone', type: 'button', onclick: () => this.emit('indietro') },
      h('span', { class: 'ui-tasto', 'aria-hidden': 'true' }, 'Esc'),
      'Indietro',
    );

    this.el.append(
      h('div', { class: 'ui-velo', 'aria-hidden': 'true' }),
      h(
        'div',
        { class: 'ui-carta ui-imp-foglio' },
        h('header', { class: 'ui-imp-testa' }, h('h2', { class: 'ui-imp-titolo' }, 'Impostazioni'), listaSchede),
        corpo,
        h('footer', { class: 'ui-imp-piede' }, h('p', { class: 'ui-imp-salvate ui-nota' }, 'Le scelte si salvano da sole.'), this.bRipristina, bIndietro),
      ),
    );

    this.store.on('cambio', (c) => {
      this.aggiornatori.get(c.chiave)?.();
      this.emit('cambio', c);
    });
    this.mostraScheda(0, false);
  }

  /** Mostra il pannello, facoltativamente su una scheda ('visione' | 'suono' | 'accessibilita'). */
  show(scheda?: string): void {
    for (const agg of this.aggiornatori.values()) agg();
    if (scheda) {
      const i = SEZIONI_IMPOSTAZIONI.findIndex((s) => s.id === scheda);
      if (i >= 0) this.mostraScheda(i, false);
    }
    this.apri();
  }

  protected override focusIniziale(): HTMLElement | null {
    return this.schede[this.schedaAttiva] ?? null;
  }

  override gestisciTasto(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      this.emit('indietro');
      return true;
    }
    return false;
  }

  protected override quandoNascosto(): void {
    this.annullaRipristino();
  }

  private mostraScheda(i: number, focus: boolean): void {
    this.schedaAttiva = i;
    this.schede.forEach((s, j) => {
      const attiva = i === j;
      s.setAttribute('aria-selected', String(attiva));
      s.tabIndex = attiva ? 0 : -1;
      this.pannelli[j]!.hidden = !attiva;
    });
    if (focus) this.schede[i]!.focus();
  }

  private ripristina(): void {
    if (this.timerRipristino === null) {
      this.bRipristina.textContent = 'Sicuro? Premi di nuovo';
      this.bRipristina.classList.add('ui-imp-avviso');
      this.timerRipristino = setTimeout(() => this.annullaRipristino(), 3500);
      return;
    }
    this.annullaRipristino();
    this.store.reset();
  }

  private annullaRipristino(): void {
    if (this.timerRipristino !== null) clearTimeout(this.timerRipristino);
    this.timerRipristino = null;
    this.bRipristina.textContent = 'Ripristina i valori di base';
    this.bRipristina.classList.remove('ui-imp-avviso');
  }

  private creaRiga(r: Riga): HTMLElement {
    const id = `ui-imp-${r.chiave}`;
    const idNota = r.nota ? `${id}-nota` : null;
    const etichetta = h('div', { class: 'ui-imp-etichetta' }, h('label', { for: id, id: `${id}-et` }, r.etichetta), r.nota ? h('p', { class: 'ui-imp-nota', id: idNota }, r.nota) : null);
    let controllo: HTMLElement;

    if (r.tipo === 'cursore') {
      const [min, max, passo] = LIMITI[r.chiave] ?? [0, 1, 0.01];
      const valore = h('output', { class: 'ui-imp-valore', for: id });
      const input = h('input', {
        type: 'range',
        id,
        class: 'ui-cursore',
        min,
        max,
        step: passo,
        'aria-describedby': idNota,
      });
      const aggiorna = (): void => {
        const v = this.store.get(r.chiave);
        input.value = String(v);
        const testo = r.formato(v);
        valore.textContent = testo;
        input.setAttribute('aria-valuetext', testo);
        input.style.setProperty('--riempito', `${((v - min) / (max - min)) * 100}%`);
      };
      input.addEventListener('input', () => {
        this.store.set(r.chiave, Number(input.value));
        aggiorna();
      });
      this.aggiornatori.set(r.chiave, aggiorna);
      controllo = h('div', { class: 'ui-imp-controllo' }, input, valore);
    } else if (r.tipo === 'interruttore') {
      const stato = h('span', { class: 'ui-interruttore-testo', 'aria-hidden': 'true' });
      const btn = h(
        'button',
        { type: 'button', role: 'switch', id, class: 'ui-interruttore', 'aria-labelledby': `${id}-et`, 'aria-describedby': idNota },
        h('span', { class: 'ui-interruttore-binario', 'aria-hidden': 'true' }, h('span', { class: 'ui-interruttore-pomo' })),
        stato,
      );
      const aggiorna = (): void => {
        const v = this.store.get(r.chiave);
        btn.setAttribute('aria-checked', String(v));
        stato.textContent = v ? 'Sì' : 'No';
      };
      btn.addEventListener('click', () => {
        this.store.set(r.chiave, !this.store.get(r.chiave));
        aggiorna();
      });
      this.aggiornatori.set(r.chiave, aggiorna);
      controllo = h('div', { class: 'ui-imp-controllo' }, btn);
    } else {
      const gruppo = h('div', { class: 'ui-scelta', role: 'radiogroup', 'aria-labelledby': `${id}-et`, 'aria-describedby': idNota, id });
      const input: HTMLInputElement[] = [];
      for (const o of r.opzioni) {
        const radio = h('input', { type: 'radio', name: id, value: o.valore, class: 'ui-sr ui-scelta-input', id: `${id}-${o.valore}` });
        radio.addEventListener('change', () => {
          if (radio.checked) (this.store.set as (k: ChiaveImpostazione, v: string) => boolean)(r.chiave, o.valore);
        });
        input.push(radio);
        gruppo.append(h('span', { class: 'ui-scelta-voce' }, radio, h('label', { for: `${id}-${o.valore}` }, o.etichetta)));
      }
      const aggiorna = (): void => {
        const v = this.store.get(r.chiave);
        for (const x of input) x.checked = x.value === v;
      };
      this.aggiornatori.set(r.chiave, aggiorna);
      // L'etichetta principale punta al primo radio per il clic.
      etichetta.querySelector('label')?.setAttribute('for', `${id}-${r.opzioni[0]!.valore}`);
      controllo = h('div', { class: 'ui-imp-controllo' }, gruppo);
    }
    return h('div', { class: `ui-imp-riga ui-imp-riga--${r.tipo}` }, etichetta, controllo);
  }
}
