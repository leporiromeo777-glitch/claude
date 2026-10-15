/**
 * Pannello statistiche (si attiva con ?debug nell'URL o con il tasto F3):
 * fps, tempo per fotogramma, chiamate di disegno, triangoli, LOD del terreno,
 * stato del giocatore (quota, gravità, modo).
 */
export class StatsOverlay {
  readonly el: HTMLDivElement;
  private frames = 0;
  private acc = 0;
  private fps = 0;
  private ms = 0;
  visible: boolean;

  constructor(parent: HTMLElement, visible: boolean) {
    this.el = document.createElement('div');
    this.el.id = 'stats';
    Object.assign(this.el.style, {
      position: 'fixed',
      left: '8px',
      top: '8px',
      padding: '6px 9px',
      font: '12px/1.35 ui-monospace, Menlo, Consolas, monospace',
      color: '#f4efe2',
      background: 'rgba(30, 28, 40, 0.62)',
      borderRadius: '6px',
      whiteSpace: 'pre',
      pointerEvents: 'none',
      zIndex: '10',
    } satisfies Partial<CSSStyleDeclaration>);
    parent.appendChild(this.el);
    this.visible = visible;
    this.el.style.display = visible ? 'block' : 'none';
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? 'block' : 'none';
  }

  /** Da chiamare a ogni fotogramma con il tempo reale trascorso. */
  frame(dt: number, lines: () => string[]): void {
    this.frames++;
    this.acc += dt;
    if (this.acc >= 0.5) {
      this.fps = this.frames / this.acc;
      this.ms = (this.acc / this.frames) * 1000;
      this.frames = 0;
      this.acc = 0;
      if (this.visible) this.el.textContent = [`${this.fps.toFixed(0)} fps  ${this.ms.toFixed(1)} ms`, ...lines()].join('\n');
    }
  }

  get currentFps(): number {
    return this.fps;
  }
}
