/**
 * Input: tastiera (WASD, Spazio, Shift, E...), mouse con pointer lock al clic.
 * I tasti "appena premuti" restano in coda finché un passo di simulazione non
 * li consuma, così non si perdono fra un fotogramma e l'altro.
 */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private dx = 0;
  private dy = 0;
  pointerLocked = false;
  private target: HTMLElement | null = null;
  /** Se falso l'input è ignorato (es. durante gli screenshot). */
  enabled = true;

  attach(el: HTMLElement): void {
    this.target = el;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    el.addEventListener('click', this.onClick);
    document.addEventListener('pointerlockchange', this.onLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.target?.removeEventListener('click', this.onClick);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.enabled) return;
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    if (!this.down.has(e.code)) this.pressed.add(e.code);
    this.down.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
  };

  private onBlur = () => {
    this.down.clear();
  };

  private onClick = () => {
    if (!this.enabled || this.pointerLocked) return;
    const p = this.target?.requestPointerLock?.();
    if (p && typeof (p as Promise<void>).catch === 'function') (p as Promise<void>).catch(() => {});
  };

  private onLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.target;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.enabled || !this.pointerLocked) return;
    this.dx += e.movementX;
    this.dy += e.movementY;
  };

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
    const r = { dx: this.dx, dy: this.dy };
    this.dx = 0;
    this.dy = 0;
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
