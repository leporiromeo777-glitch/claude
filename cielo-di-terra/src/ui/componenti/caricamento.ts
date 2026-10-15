import { Componente } from '../core/componente';
import { h, s } from '../core/dom';
import { disegnoCilindro } from '../core/disegni';
import './caricamento.css';

export interface DatiCaricamento {
  /** Proverbi che si alternano in basso. */
  proverbi?: string[];
  /** Testo iniziale sotto la linea (es. «Si stende la Carta…»). */
  testo?: string;
}

export interface EventiCaricamento {
  /** Il caricamento ha raggiunto il 100%. */
  completo: void;
}

/** Proverbi del Verbano (dal concept), usati se il gioco non ne passa altri. */
export const PROVERBI_PREDEFINITI = [
  'Ciò che la Giardiniera ha misurato, la notte non lo tocca.',
  'La pietra misurata vale più della penna.',
  'Quando il lago trema, l’Om dal Fond cambia spalla.',
];

/**
 * Schermata di caricamento: un foglio pieno (il gioco dietro non è ancora pronto) su cui si disegna
 * a matita il Verbano, una linea d'inchiostro che avanza e un proverbio.
 */
export class SchermataCaricamento extends Componente<EventiCaricamento> {
  private readonly tratto: SVGPathElement;
  private readonly testo: HTMLParagraphElement;
  private readonly proverbio: HTMLParagraphElement;
  private readonly percento: HTMLSpanElement;
  private readonly barra: HTMLDivElement;
  private proverbi: string[] = PROVERBI_PREDEFINITI;
  private indiceProverbio = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private valore = 0;

  constructor() {
    super({ classe: 'ui-caricamento', modale: false });
    this.el.setAttribute('role', 'progressbar');
    this.el.setAttribute('aria-label', 'Caricamento');
    this.el.setAttribute('aria-valuemin', '0');
    this.el.setAttribute('aria-valuemax', '100');
    this.tratto = s('path', { d: 'M2 9 C 120 5, 240 12, 360 8 S 560 6, 598 8', pathLength: 1, class: 'ui-car-tratto' });
    this.testo = h('p', { class: 'ui-car-testo' });
    this.percento = h('span', { class: 'ui-car-percento' });
    this.proverbio = h('p', { class: 'ui-car-proverbio' });
    this.barra = h(
      'div',
      { class: 'ui-car-barra' },
      s('svg', { viewBox: '0 0 600 16', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, s('path', { d: 'M2 9 C 120 5, 240 12, 360 8 S 560 6, 598 8', class: 'ui-car-guida' }), this.tratto),
      h('span', { class: 'ui-car-matita', 'aria-hidden': 'true' }),
    );
    this.el.append(
      h(
        'div',
        { class: 'ui-car-foglio' },
        h('div', { class: 'ui-car-disegno' }, disegnoCilindro({ larghezza: 420, animato: true })),
        h('h2', { class: 'ui-car-titolo' }, 'Cielo di Terra'),
        this.barra,
        h('div', { class: 'ui-car-stato' }, this.testo, this.percento),
        this.proverbio,
      ),
    );
  }

  show(dati: DatiCaricamento = {}): void {
    this.proverbi = dati.proverbi?.length ? dati.proverbi : PROVERBI_PREDEFINITI;
    this.indiceProverbio = Math.floor(Math.random() * this.proverbi.length);
    this.mostraProverbio();
    this.testo.textContent = dati.testo ?? 'Si stende la Carta…';
    this.progresso(0);
    this.apri();
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.indiceProverbio = (this.indiceProverbio + 1) % this.proverbi.length;
      this.mostraProverbio();
    }, 7000);
  }

  /** Avanzamento (0-1) e, se dato, il testo di che cosa si sta caricando. */
  progresso(valore: number, testo?: string): void {
    const v = Math.max(0, Math.min(1, valore));
    this.valore = v;
    this.tratto.style.strokeDashoffset = String(1 - v);
    this.barra.style.setProperty('--p', String(v));
    this.percento.textContent = `${Math.round(v * 100)} %`;
    this.el.setAttribute('aria-valuenow', String(Math.round(v * 100)));
    if (testo !== undefined) this.testo.textContent = testo;
    if (v >= 1) this.emit('completo');
  }

  get valoreCorrente(): number {
    return this.valore;
  }

  protected override quandoNascosto(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private mostraProverbio(): void {
    const p = this.proverbi[this.indiceProverbio] ?? '';
    this.proverbio.classList.remove('ui-car-proverbio--entra');
    void this.proverbio.offsetWidth;
    this.proverbio.textContent = p;
    this.proverbio.classList.add('ui-car-proverbio--entra');
  }
}
