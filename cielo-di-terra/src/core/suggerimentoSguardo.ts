/**
 * Suggerimento dello sguardo: una riga a matita in alto al centro, la prima volta che si gioca.
 *
 * - finché il puntatore si può bloccare: «Clic per guardare col mouse»;
 * - quando il blocco è vietato (iframe) o fallisce: «Trascina col mouse per guardare intorno»,
 *   mostrato subito al momento del ripiego;
 * - sotto, piccolo: le frecce girano lo sguardo, WASD per camminare.
 *
 * Compare dopo qualche secondo di gioco senza menu se lo sguardo non si è ancora mosso, e sparisce
 * appena si gira la visuale (o da solo dopo un po'). Vive dentro la radice dell'interfaccia, sopra
 * il canvas e sotto i modali (che lo nascondono).
 */
import type { Input, ModoSguardo } from './input';

const TESTI: Record<ModoSguardo, string> = {
  blocco: 'Clic per guardare col mouse',
  trascina: 'Trascina col mouse per guardare intorno',
};
const SOTTO = 'oppure le frecce ← → ↑ ↓ · W A S D per camminare';

export interface OpzioniSuggerimentoSguardo {
  /** Secondi di gioco libero prima di mostrarlo. */
  ritardo?: number;
  /** Secondi dopo cui sparisce comunque. */
  durata?: number;
}

export class SuggerimentoSguardo {
  readonly el: HTMLDivElement;
  private readonly riga: HTMLDivElement;
  private tempoLibero = 0;
  private visibileDa = -1;
  private mostrato = false;
  private finito = false;
  private guardato = false;
  private readonly ritardo: number;
  private readonly durata: number;

  constructor(
    parent: HTMLElement,
    private readonly input: Input,
    opz: OpzioniSuggerimentoSguardo = {},
  ) {
    this.ritardo = opz.ritardo ?? 2.5;
    this.durata = opz.durata ?? 14;
    this.el = document.createElement('div');
    this.el.className = 'cdt-suggerimento-sguardo';
    this.el.setAttribute('role', 'status');
    Object.assign(this.el.style, {
      position: 'absolute',
      left: '50%',
      top: 'clamp(18px, 9vh, 90px)',
      transform: 'translateX(-50%)',
      maxWidth: 'calc(100% - 32px)',
      padding: '8px 18px 9px',
      textAlign: 'center',
      color: '#f7f0dc',
      background: 'rgba(28, 22, 30, 0.42)',
      borderRadius: '14px',
      boxShadow: '0 0 22px rgba(28, 22, 30, 0.35)',
      textShadow: '0 0 2px rgba(10,7,4,.9), 0 1px 3px rgba(10,7,4,.85)',
      fontFamily: "'Caveat', 'Segoe Print', 'Bradley Hand', cursive",
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 0.45s ease',
      zIndex: '5',
    } satisfies Partial<CSSStyleDeclaration>);
    this.riga = document.createElement('div');
    Object.assign(this.riga.style, { fontSize: 'calc(27px * var(--ui-scala, 1))', lineHeight: '1.15' } satisfies Partial<CSSStyleDeclaration>);
    const sotto = document.createElement('div');
    sotto.textContent = SOTTO;
    Object.assign(sotto.style, { fontSize: 'calc(19px * var(--ui-scala, 1))', opacity: '0.88', marginTop: '2px' } satisfies Partial<CSSStyleDeclaration>);
    this.el.append(this.riga, sotto);
    this.el.hidden = true;
    parent.appendChild(this.el);

    const primoPrima = input.onPrimoSguardo;
    input.onPrimoSguardo = () => {
      primoPrima?.();
      this.guardato = true;
      // il suggerimento del ripiego resta qualche secondo anche se si è già guardato
      if (this.mostrato && input.modoSguardo === 'blocco') this.nascondi();
    };
    const modoPrima = input.onModoSguardo;
    input.onModoSguardo = (m) => {
      modoPrima?.(m);
      if (m === 'trascina') this.mostra(m, 7);
    };
  }

  /** A ogni passo: `dt` in secondi. */
  aggiorna(dt: number): void {
    const catturato = this.input.bloccoInterfaccia;
    this.el.style.visibility = catturato ? 'hidden' : 'visible';
    if (this.finito) return;
    if (this.mostrato) {
      if (!catturato) this.visibileDa += dt;
      if (this.visibileDa > this.durataCorrente) this.nascondi();
      return;
    }
    if (catturato || this.guardato) return;
    this.tempoLibero += dt;
    if (this.tempoLibero >= this.ritardo) this.mostra(this.input.modoSguardo, this.durata);
  }

  private durataCorrente = 0;

  private mostra(m: ModoSguardo, durata: number): void {
    this.riga.textContent = TESTI[m];
    this.mostrato = true;
    this.finito = false;
    this.visibileDa = 0;
    this.durataCorrente = durata;
    this.el.hidden = false;
    requestAnimationFrame(() => (this.el.style.opacity = '1'));
  }

  private nascondi(): void {
    this.finito = true;
    this.mostrato = false;
    this.el.style.opacity = '0';
    setTimeout(() => {
      if (this.finito) this.el.hidden = true;
    }, 500);
  }

  destroy(): void {
    this.el.remove();
  }
}
