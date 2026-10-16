/**
 * Input: tastiera (WASD, Spazio, Shift, E...), mouse con pointer lock al clic,
 * tasti del mouse come codici «Mouse0»/«Mouse2» (il destro serve al cannocchiale).
 * I tasti "appena premuti" restano in coda finché un passo di simulazione non
 * li consuma, così non si perdono fra un fotogramma e l'altro.
 *
 * Sguardo, tre strade (si può sempre usarne più d'una):
 * 1. **pointer lock** al clic sul canvas: il mouse gira la visuale senza tenere premuto;
 * 2. **trascinamento** col tasto sinistro (o col dito): il ripiego quando il blocco del
 *    puntatore è vietato (iframe senza `allow-pointer-lock`, come negli artifact di claude.ai)
 *    o fallisce: errore, promessa rifiutata, `pointerlockerror`, o nessuna risposta entro
 *    `ATTESA_BLOCCO_MS`. Da quel momento il clic non chiede più il blocco;
 * 3. **frecce** ←→↑↓: girano la visuale (non muovono più il corpo: per camminare WASD).
 *    Nei menu, nei dialoghi e nelle schede le frecce servono all'interfaccia: lì
 *    `bloccoInterfaccia` è vero e lo sguardo dalla tastiera tace.
 */

/** Come si guarda col mouse in questo momento. */
export type ModoSguardo = 'blocco' | 'trascina';

/** Millisecondi entro cui il browser deve concedere il blocco del puntatore. */
export const ATTESA_BLOCCO_MS = 300;

/** Velocità dello sguardo con le frecce (radianti al secondo). */
export const FRECCE_IMBARDATA = 1.9;
export const FRECCE_BECCHEGGIO = 1.25;

/** Un controllo che usa da sé le frecce (cursore, casella di testo, scelta). */
function campoDiTesto(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable === true;
}

export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private dx = 0;
  private dy = 0;
  pointerLocked = false;
  private target: HTMLElement | null = null;
  /** Se falso l'input è ignorato (es. durante gli screenshot). */
  enabled = true;
  /**
   * Vero quando l'interfaccia ha preso la tastiera (menu, dialoghi, carte, schede):
   * le frecce restano all'interfaccia e non girano la visuale. Lo imposta chi monta il gioco.
   */
  bloccoInterfaccia = false;
  /** 'blocco' finché il pointer lock funziona; 'trascina' dopo il primo rifiuto. */
  modoSguardo: ModoSguardo = 'blocco';
  /** Chiamato quando il modo cambia (per il suggerimento a schermo). */
  onModoSguardo: ((m: ModoSguardo) => void) | null = null;
  /** Chiamato la prima volta che il giocatore gira davvero la visuale (mouse, dito o frecce). */
  onPrimoSguardo: (() => void) | null = null;
  private haGuardato = false;
  /** Il blocco è già arrivato almeno una volta: un rifiuto dopo è passeggero (es. Esc appena premuto). */
  private bloccoOttenuto = false;
  private attesaBlocco: ReturnType<typeof setTimeout> | null = null;
  private trascinando: number | null = null;
  private ultimoX = 0;
  private ultimoY = 0;
  private tocco = false;

  attach(el: HTMLElement): void {
    this.target = el;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    el.addEventListener('click', this.onClick);
    el.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    el.addEventListener('contextmenu', this.onContextMenu);
    el.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    document.addEventListener('pointerlockchange', this.onLockChange);
    document.addEventListener('pointerlockerror', this.onLockError);
    document.addEventListener('mousemove', this.onMouseMove);
    // il dito che trascina non deve scorrere né ingrandire la pagina
    el.style.touchAction = 'none';
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.target?.removeEventListener('click', this.onClick);
    this.target?.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.target?.removeEventListener('contextmenu', this.onContextMenu);
    this.target?.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    document.removeEventListener('pointerlockerror', this.onLockError);
    document.removeEventListener('mousemove', this.onMouseMove);
    this.annullaAttesa();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.enabled) return;
    // la pagina non deve scorrere; ← → restano ai controlli dell'interfaccia (cursori, scelte)
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown') e.preventDefault();
    else if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && !this.bloccoInterfaccia && !campoDiTesto(e.target)) e.preventDefault();
    if (!this.down.has(e.code)) this.pressed.add(e.code);
    this.down.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
  };

  private onBlur = () => {
    this.down.clear();
    this.trascinando = null;
  };

  /** Dimentica i tasti tenuti e quelli in coda (quando un menu prende la tastiera). */
  releaseAll(): void {
    this.down.clear();
    this.pressed.clear();
    this.trascinando = null;
  }

  /** Tasti del mouse come codici «Mouse0» (sinistro), «Mouse1», «Mouse2» (destro). */
  private onMouseDown = (e: MouseEvent) => {
    if (!this.enabled) return;
    const code = `Mouse${e.button}`;
    if (!this.down.has(code)) this.pressed.add(code);
    this.down.add(code);
  };

  private onMouseUp = (e: MouseEvent) => {
    this.down.delete(`Mouse${e.button}`);
  };

  private onContextMenu = (e: Event) => {
    e.preventDefault();
  };

  // ---------------------------------------------------------------- pointer lock

  private onClick = () => {
    if (!this.enabled || this.pointerLocked || this.modoSguardo !== 'blocco') return;
    this.chiediBlocco();
  };

  /** Chiede il blocco del puntatore; al primo segno di rifiuto passa al trascinamento. */
  private chiediBlocco(): void {
    const el = this.target;
    if (!el || typeof el.requestPointerLock !== 'function') {
      this.passaATrascina();
      return;
    }
    this.annullaAttesa();
    this.attesaBlocco = setTimeout(() => {
      this.attesaBlocco = null;
      if (!this.pointerLocked) this.passaATrascina();
    }, ATTESA_BLOCCO_MS);
    try {
      const p = el.requestPointerLock() as unknown;
      if (p && typeof (p as Promise<void>).then === 'function') (p as Promise<void>).then(undefined, () => this.passaATrascina());
    } catch {
      this.passaATrascina();
    }
  }

  private annullaAttesa(): void {
    if (this.attesaBlocco !== null) clearTimeout(this.attesaBlocco);
    this.attesaBlocco = null;
  }

  private onLockChange = () => {
    this.pointerLocked = !!this.target && document.pointerLockElement === this.target;
    if (this.pointerLocked) {
      this.bloccoOttenuto = true;
      this.annullaAttesa();
      // il permesso è arrivato dopo l'attesa (lento, non negato): si torna al blocco, così dopo
      // Esc il clic lo richiede e il suggerimento non dice più «Trascina»
      if (this.modoSguardo === 'trascina') {
        this.modoSguardo = 'blocco';
        this.onModoSguardo?.('blocco');
      }
    }
  };

  private onLockError = () => {
    this.passaATrascina();
  };

  /**
   * Il blocco non arriva: da ora si guarda trascinando (per tutta la sessione). Se il blocco
   * era già stato concesso, il rifiuto è passeggero (Chrome rifiuta per un attimo dopo Esc):
   * si resta in modo 'blocco' e il clic dopo riprova; nel frattempo il trascinamento funziona.
   */
  passaATrascina(): void {
    this.annullaAttesa();
    if (this.modoSguardo === 'trascina' || this.bloccoOttenuto) return;
    this.modoSguardo = 'trascina';
    this.onModoSguardo?.('trascina');
  }

  private onMouseMove = (e: MouseEvent) => {
    if (!this.enabled || !this.pointerLocked) return;
    this.aggiungi(e.movementX, e.movementY);
  };

  // ---------------------------------------------------------------- trascinamento

  /**
   * Il trascinamento funziona sempre quando il puntatore non è bloccato: è il modo principale
   * dopo un rifiuto e, prima del primo clic, permette comunque di guardarsi intorno.
   */
  private onPointerDown = (e: PointerEvent) => {
    if (!this.enabled || this.pointerLocked) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.trascinando = e.pointerId;
    this.tocco = e.pointerType === 'touch';
    this.ultimoX = e.clientX;
    this.ultimoY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.trascinando === null || e.pointerId !== this.trascinando) return;
    // il rilascio si è perso (fuori dalla finestra o dall'iframe): il tasto non è più giù
    if (!this.enabled || this.pointerLocked || (e.pointerType === 'mouse' && (e.buttons & 1) === 0)) {
      this.trascinando = null;
      return;
    }
    const mx = e.clientX - this.ultimoX;
    const my = e.clientY - this.ultimoY;
    this.ultimoX = e.clientX;
    this.ultimoY = e.clientY;
    // col dito si «afferra» il mondo (verso opposto), col mouse si gira come col blocco
    const k = this.tocco ? -1.4 : 1;
    this.aggiungi(mx * k, my * k);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId === this.trascinando) this.trascinando = null;
  };

  /** Vero mentre si trascina per guardare. */
  get trascina(): boolean {
    return this.trascinando !== null;
  }

  private aggiungi(dx: number, dy: number): void {
    if (!dx && !dy) return;
    this.dx += dx;
    this.dy += dy;
    this.segnaSguardo();
  }

  private segnaSguardo(): void {
    if (this.haGuardato) return;
    this.haGuardato = true;
    this.onPrimoSguardo?.();
  }

  // ---------------------------------------------------------------- letture

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** Vero una sola volta per pressione. */
  consumePressed(code: string): boolean {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  /** Spostamento del mouse accumulato (pixel) dall'ultima lettura. */
  consumeMouse(): { dx: number; dy: number } {
    // (un oggetto riusato: niente allocazioni a ogni fotogramma; va letto subito)
    const r = this.letturaMouse;
    r.dx = this.dx;
    r.dy = this.dy;
    this.dx = 0;
    this.dy = 0;
    return r;
  }
  private readonly letturaMouse = { dx: 0, dy: 0 };
  private readonly letturaFrecce = { yaw: 0, pitch: 0 };

  /**
   * Sguardo dalle frecce per `dt` secondi: radianti di imbardata (+ = destra) e di
   * beccheggio (+ = su). Zero se l'interfaccia ha la tastiera o l'input è spento.
   */
  lookKeys(dt: number): { yaw: number; pitch: number } {
    const r = this.letturaFrecce;
    r.yaw = 0;
    r.pitch = 0;
    if (!this.enabled || this.bloccoInterfaccia || dt <= 0) return r;
    const x = (this.down.has('ArrowRight') ? 1 : 0) - (this.down.has('ArrowLeft') ? 1 : 0);
    const y = (this.down.has('ArrowUp') ? 1 : 0) - (this.down.has('ArrowDown') ? 1 : 0);
    if (x || y) this.segnaSguardo();
    const t = Math.min(dt, 0.1);
    r.yaw = x * FRECCE_IMBARDATA * t;
    r.pitch = y * FRECCE_BECCHEGGIO * t;
    return r;
  }

  /** Simula tasti (debug/E2E). */
  simulate(code: string, isDown: boolean): void {
    if (isDown) {
      if (!this.down.has(code)) this.pressed.add(code);
      this.down.add(code);
    } else this.down.delete(code);
  }
}
