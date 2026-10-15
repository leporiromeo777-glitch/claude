/**
 * Velature a tutto schermo della regia (non sono interfaccia: sono «come vede» Elvira):
 * il nero dell'inizio che si apre a scatti, la dissolvenza del sonno, il bianco della botola,
 * il lampo della Meta, il cerchio della lente, il passero che vola in su.
 *
 * Solo DOM e transizioni CSS: vanno avanti anche quando il ciclo del gioco è fermo.
 */
export class Velatura {
  private nero: HTMLDivElement;
  private bianco: HTMLDivElement;
  private lenteEl: HTMLDivElement;
  private uccello: HTMLDivElement;
  private foglie: HTMLDivElement;
  /**
   * L'ultima dissolvenza del nero e quella del bianco, ognuna per conto suo (per sapere se la
   * vista è coperta: un lampo della Meta durante l'alba non deve far dimenticare il nero).
   */
  private readonly copertura = new Map<HTMLDivElement, { t0: number; da: number; a: number; secondi: number }>();

  constructor(contenitore: HTMLElement) {
    const base = (z: number): HTMLDivElement => {
      const d = document.createElement('div');
      Object.assign(d.style, { position: 'fixed', inset: '0', pointerEvents: 'none', opacity: '0', zIndex: String(z) } satisfies Partial<CSSStyleDeclaration>);
      contenitore.appendChild(d);
      return d;
    };
    this.nero = base(6);
    this.nero.className = 'regia-velatura-nero';
    this.nero.style.background = '#06060a';
    this.bianco = base(6);
    this.bianco.style.background = '#f4f1ea';
    this.lenteEl = base(5);
    this.lenteEl.style.background = 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0 30vmin, rgba(40,32,24,0.55) 31vmin, rgba(20,16,12,0.92) 40vmin)';
    this.lenteEl.style.transition = 'opacity .25s';
    this.foglie = base(5);
    this.foglie.style.background = 'radial-gradient(circle at 46% 52%, rgba(18,38,22,0.97) 0 22vmin, rgba(28,52,30,0.93) 34vmin, rgba(10,22,14,0.9) 60vmin)';
    this.foglie.style.transition = 'opacity .3s';
    this.uccello = document.createElement('div');
    Object.assign(this.uccello.style, {
      position: 'fixed',
      left: '52%',
      top: '78%',
      width: '18px',
      height: '8px',
      pointerEvents: 'none',
      opacity: '0',
      zIndex: '5',
      borderTop: '3px solid #2a2622',
      borderRadius: '50% 50% 0 0',
    } satisfies Partial<CSSStyleDeclaration>);
    contenitore.appendChild(this.uccello);
  }

  private dissolvi(el: HTMLDivElement, da: number, a: number, secondi: number, passi?: number): void {
    if (el === this.nero || el === this.bianco) this.copertura.set(el, { t0: performance.now(), da, a, secondi });
    el.style.transition = 'none';
    el.style.opacity = String(da);
    void el.offsetWidth;
    el.style.transition = `opacity ${secondi}s ${passi ? `steps(${passi}, end)` : 'ease'}`;
    el.style.opacity = String(a);
  }

  /**
   * La vista è coperta dal nero o dal bianco (più di metà): l'inizio nella capsula, il sonno,
   * la luce della botola. Le indicazioni a schermo aspettano che si veda.
   */
  coperta(): boolean {
    const adesso = performance.now();
    for (const c of this.copertura.values()) {
      const k = c.secondi > 0 ? Math.min(1, (adesso - c.t0) / (c.secondi * 1000)) : 1;
      if (c.da + (c.a - c.da) * k > 0.5) return true;
    }
    return false;
  }

  /** Dal nero alla vista (a scatti: la luce color miele che si accende). */
  dalNero(secondi: number, aScatti = false): void {
    this.dissolvi(this.nero, 1, 0, secondi, aScatti ? 7 : undefined);
  }

  alNero(secondi: number): void {
    this.dissolvi(this.nero, 0, 1, secondi);
  }

  /** La luce grigia che entra dalla botola. */
  dalBianco(secondi: number): void {
    this.dissolvi(this.bianco, 0.9, 0, secondi);
  }

  /** La lama della Meta che attraversa la valle. */
  lampo(): void {
    this.dissolvi(this.bianco, 0.32, 0, 1.6);
  }

  /** Un respiro: la vista si chiude un attimo (alzarsi dopo due secoli). */
  respiro(): void {
    this.dissolvi(this.nero, 0.55, 0, 1.4);
  }

  lente(si: boolean): void {
    const v = si ? '1' : '0';
    if (this.lenteEl.style.opacity !== v) this.lenteEl.style.opacity = v;
  }

  /** Nel cannocchiale, al posto della palina, il buio verde di un albero (il tasso del sagrato). */
  fogliame(si: boolean): void {
    const v = si ? '1' : '0';
    if (this.foglie.style.opacity !== v) this.foglie.style.opacity = v;
  }

  /** Un passero si alza dalla botola e vola dritto verso l'asse. */
  passero(): void {
    const u = this.uccello;
    u.style.transition = 'none';
    u.style.opacity = '1';
    u.style.top = '78%';
    u.style.transform = 'scale(1.6)';
    void u.offsetWidth;
    u.style.transition = 'top 2.6s ease-in, transform 2.6s ease-in, opacity 2.6s ease-in';
    u.style.top = '-6%';
    u.style.transform = 'scale(0.5)';
    u.style.opacity = '0.2';
  }

  update(_dt: number): void {
    // tutto con le transizioni CSS
  }
}
