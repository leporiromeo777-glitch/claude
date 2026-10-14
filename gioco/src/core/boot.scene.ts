/**
 * Scena di avvio e diagnostica (id 'boot'). Si usa quando la scena del titolo
 * non è registrata, e resta raggiungibile con `__GAME__.core.goto('boot')`.
 *
 * Mostra: velluto procedurale, titolo da core.json, dimensioni e safe area
 * (con il rettangolo della safe area disegnato sul canvas), registro dal vivo
 * di gesti e azioni, elenco degli asset mancanti con i segnaposto dei fusi
 * che dondolano (il dondolio va col tempo simulato: time.step è deterministico),
 * contenuti, scene e pacchetti registrati, scelta della lingua.
 */
import type { ActionEvent, CanvasHost, CharacterId, Gesture, Locale, Scene, Services, Viewport } from './types';
import { EXPECTED_FRAMES, EXPECTED_IMAGES } from './assets';
import { el, clear } from './ui/dom';
import { button, menuList, panel, setTextParams, textOf } from './ui/components';
import { drawGlyph } from './ui/glyphs';
import { rngFromSeed } from './rng';

export interface BootInfo {
  version: string;
  packages: () => string[];
  contentErrors: () => number;
  sceneRoot: HTMLElement;
  registeredScenes: () => string[];
}

const LOG_SIZE = 8;
const MISSING_SHOWN = 12;
const SPINDLES = ['teresa', 'marta', 'piero', 'gino', 'nina', 'zeno'];

/** Velluto: rumore di valore a due ottave su 256×256, ripetibile, con il colore --velluto. */
export function makeVelvetTile(base: string, size = 256): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const m = /^#?([0-9a-f]{6})$/i.exec(base.trim());
  const n = m && m[1] ? Number.parseInt(m[1], 16) : 0x1c2233;
  const br = (n >> 16) & 255;
  const bg = (n >> 8) & 255;
  const bb = n & 255;
  const rng = rngFromSeed('velluto');
  const grid = (cells: number): Float32Array => {
    const g = new Float32Array(cells * cells);
    for (let i = 0; i < g.length; i++) g[i] = rng();
    return g;
  };
  const octave = (g: Float32Array, cells: number, x: number, y: number): number => {
    const fx = (x / size) * cells;
    const fy = (y / size) * cells;
    const x0 = Math.floor(fx) % cells;
    const y0 = Math.floor(fy) % cells;
    const x1 = (x0 + 1) % cells;
    const y1 = (y0 + 1) % cells;
    const tx = fx - Math.floor(fx);
    const ty = fy - Math.floor(fy);
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = g[y0 * cells + x0] ?? 0;
    const b = g[y0 * cells + x1] ?? 0;
    const cc = g[y1 * cells + x0] ?? 0;
    const d = g[y1 * cells + x1] ?? 0;
    return (a + (b - a) * sx) * (1 - sy) + (cc + (d - cc) * sx) * sy;
  };
  const g1 = grid(16);
  const g2 = grid(64);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = octave(g1, 16, x, y) * 0.65 + octave(g2, 64, x, y) * 0.35 - 0.5;
      const k = 1 + v * 0.16;
      const i = (y * size + x) * 4;
      img.data[i] = Math.min(255, br * k);
      img.data[i + 1] = Math.min(255, bg * k);
      img.data[i + 2] = Math.min(255, bb * k);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

interface BootColors {
  velluto: string;
  ombra: string;
  ottone: string;
  carta: string;
  testo: string;
}

function readColors(): BootColors {
  return {
    velluto: cssVar('--velluto', '#1C2233'),
    ombra: cssVar('--velluto-ombra', '#121622'),
    ottone: cssVar('--ottone', '#C9A24A'),
    carta: cssVar('--carta', '#EDE4D3'),
    testo: cssVar('--testo-chiaro', '#F3EEE4'),
  };
}

export class BootScene implements Scene {
  readonly id = 'boot' as const;
  private t = 0;
  private root: HTMLElement | null = null;
  private velvet: CanvasPattern | null = null;
  private velvetBase = '';
  /** Voci del registro: i nomi (gesto, azione) si traducono al momento di mostrarle. */
  private log: { key: string; name: { param: string; key: string }; params: Record<string, string | number> }[] = [];
  private offSettings: (() => void) | null = null;
  private locale = '';
  private logEl: HTMLElement | null = null;
  private vpText: HTMLElement | null = null;
  private safeText: HTMLElement | null = null;
  private deviceText: HTMLElement | null = null;
  private missingTitle: HTMLElement | null = null;
  private missingList: HTMLElement | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private colors: BootColors | null = null;
  private colorsFor = '';

  constructor(
    private readonly s: Services,
    private readonly info: BootInfo,
  ) {}

  enter(): void {
    // Chiede tutti gli asset previsti: quelli assenti finiscono in missing() e si vedono come segnaposto.
    for (const f of EXPECTED_FRAMES) this.s.assets.frame(f);
    for (const i of EXPECTED_IMAGES) this.s.assets.image(i);
    this.build();
    this.refreshTimer = setInterval(() => this.refreshMissing(), 1000);
    // Al cambio di lingua si ricostruisce tutto (anche i nomi dentro i parametri).
    this.locale = this.s.i18n.locale();
    this.offSettings = this.s.bus.on('settings:change', (st) => {
      if (st.locale === this.locale) return;
      this.locale = st.locale;
      this.rebuild();
    });
  }

  exit(): void {
    if (this.refreshTimer !== null) clearInterval(this.refreshTimer);
    this.refreshTimer = null;
    this.offSettings?.();
    this.offSettings = null;
    this.root?.remove();
    this.root = null;
  }

  private build(): void {
    const { s, info } = this;
    const vp = s.viewport.get();
    this.vpText = textOf('core.boot.viewport', this.vpParams(vp), 'p');
    this.vpText.dataset.test = 'boot-viewport';
    this.safeText = textOf('core.boot.safe', this.safeParams(vp), 'p');
    this.safeText.dataset.test = 'boot-safe';
    this.deviceText = textOf('core.boot.dispositivo', { dispositivo: s.i18n.t(`core.dispositivo.${s.input.lastDevice()}`) }, 'p');
    this.logEl = el('ul', { class: 'core-boot-log', test: 'boot-log', attrs: { 'aria-live': 'polite' } });
    this.missingTitle = textOf('core.boot.asset.titolo', { n: 0 }, 'h3', { className: 'core-boot-h' });
    this.missingList = el('ul', { class: 'core-boot-list', test: 'boot-missing' });

    const db = s.content;
    const errors = info.contentErrors();
    const langButtons = (['it', 'en'] as Locale[]).map((l) =>
      button({
        labelKey: `core.lingua.${l}`,
        kind: s.i18n.locale() === l ? 'primario' : 'secondario',
        onClick: () => s.settings.set({ locale: l }),
        test: `boot-lingua-${l}`,
      }),
    );
    const none = (list: string[]): string => (list.length ? list.join(', ') : s.i18n.t('core.boot.nessuno'));

    const body = el(
      'div',
      { class: 'core-panel-body' },
      el('div', null, textOf('core.app.titolo', undefined, 'h1', { className: 'core-boot-title' }), textOf('core.app.sottotitolo', undefined, 'p', { className: 'core-boot-sub' })),
      el('section', { class: 'core-boot-section' }, textOf('core.boot.schermo', undefined, 'h3', { className: 'core-boot-h' }), this.vpText, this.safeText, this.deviceText),
      el('section', { class: 'core-boot-section' }, textOf('core.boot.log.titolo', undefined, 'h3', { className: 'core-boot-h' }), this.logEl),
      el(
        'section',
        { class: 'core-boot-section' },
        this.missingTitle,
        textOf('core.boot.asset.segnaposto', undefined, 'p', { className: 'core-boot-muted' }),
        this.missingList,
      ),
      el(
        'section',
        { class: 'core-boot-section', test: 'boot-content' },
        textOf('core.boot.contenuti.titolo', undefined, 'h3', { className: 'core-boot-h' }),
        textOf('core.boot.contenuti.conteggi', { livelli: db.levels.size, personaggi: db.characters.size, bigliettini: db.notes.size }, 'p'),
        errors > 0 ? textOf('core.boot.contenuti.errori', { n: errors }, 'p') : textOf('core.boot.contenuti.validi', undefined, 'p'),
        textOf('core.boot.scene', { elenco: none(info.registeredScenes()) }, 'p', { className: 'core-boot-muted' }),
        textOf('core.boot.pacchetti', { elenco: none(info.packages()) }, 'p', { className: 'core-boot-muted' }),
        textOf('core.boot.versione', { versione: info.version }, 'p', { className: 'core-boot-muted' }),
      ),
      el('section', { class: 'core-boot-section' }, textOf('core.boot.lingua', undefined, 'h3', { className: 'core-boot-h' }), menuList(langButtons, { orientation: 'horizontal', test: 'boot-lingue' })),
    );
    const p = panel({ variant: 'velluto', className: 'core-boot-panel', test: 'boot-panel', children: [body] });
    this.root = el('div', { class: 'core-boot', test: 'boot' }, p);
    info.sceneRoot.appendChild(this.root);
    this.renderLog();
    this.refreshMissing();
  }

  private rebuild(): void {
    this.root?.remove();
    this.build();
  }

  private vpParams(vp: Viewport): Record<string, string | number> {
    return {
      w: vp.cssW,
      h: vp.cssH,
      dpr: vp.dpr,
      layout: this.s.i18n.t(`core.layout.${vp.layout}`),
      orientamento: this.s.i18n.t(`core.orientamento.${vp.orientation}`),
    };
  }

  private safeParams(vp: Viewport): Record<string, string | number> {
    return { top: vp.safe.top, right: vp.safe.right, bottom: vp.safe.bottom, left: vp.safe.left };
  }

  private refreshMissing(): void {
    if (!this.missingTitle || !this.missingList) return;
    const missing = this.s.assets.missing();
    setTextParams(this.missingTitle, { n: missing.length });
    clear(this.missingList);
    for (const m of missing.slice(0, MISSING_SHOWN)) this.missingList.appendChild(el('li', { text: m }));
    if (missing.length > MISSING_SHOWN) this.missingList.appendChild(el('li', null, textOf('core.boot.asset.altri', { n: missing.length - MISSING_SHOWN })));
  }

  private pushLog(key: string, name: { param: string; key: string }, params: Record<string, string | number>): void {
    this.log.push({ key, name, params });
    if (this.log.length > LOG_SIZE) this.log.shift();
    this.renderLog();
    if (this.deviceText) setTextParams(this.deviceText, { dispositivo: this.s.i18n.t(`core.dispositivo.${this.s.input.lastDevice()}`) });
  }

  private renderLog(): void {
    if (!this.logEl) return;
    clear(this.logEl);
    if (this.log.length === 0) {
      this.logEl.appendChild(el('li', { class: 'core-boot-muted' }, textOf('core.boot.log.vuoto')));
      return;
    }
    for (const e of [...this.log].reverse()) {
      const params = { ...e.params, [e.name.param]: this.s.i18n.t(e.name.key) };
      this.logEl.appendChild(el('li', null, textOf(e.key, params)));
    }
  }

  onGesture(g: Gesture): boolean {
    const gesto = { param: 'gesto', key: `core.gesto.${g.k}` };
    const r = (v: number): number => Math.round(v);
    if (g.k === 'dragstart' || g.k === 'drag' || g.k === 'dragend' || g.k === 'dragcancel') {
      // Durante il trascinamento si registra solo l'inizio e la fine.
      if (g.k === 'drag') return true;
      this.pushLog('core.boot.log.trascina', gesto, { x: r(g.x), y: r(g.y), dx: r(g.dx), dy: r(g.dy) });
    } else {
      this.pushLog('core.boot.log.gesto', gesto, { x: r(g.x), y: r(g.y) });
    }
    return true;
  }

  onAction(a: ActionEvent): boolean {
    if (a.action === 'back') return false;
    const azione = { param: 'azione', key: `core.azione.${a.action}` };
    if (a.index !== undefined) this.pushLog('core.boot.log.azioneIndice', azione, { indice: a.index + 1 });
    else this.pushLog('core.boot.log.azione', azione, {});
    // Tab, Invio e Spazio restano disponibili per muoversi fra i pulsanti.
    return !(a.action === 'notebook' || a.action === 'tab' || a.action === 'confirm' || a.action === 'crossL' || a.action === 'crossR');
  }

  resize(vp: Viewport): void {
    if (this.vpText) setTextParams(this.vpText, this.vpParams(vp));
    if (this.safeText) setTextParams(this.safeText, this.safeParams(vp));
  }

  update(dt: number): void {
    this.t += dt;
  }

  render(_alpha: number, host: CanvasHost): void {
    const { ctx, cssW, cssH } = host;
    const vp = this.s.viewport.get();
    const contrast = document.documentElement.dataset.contrast ?? '';
    if (!this.colors || this.colorsFor !== contrast) {
      this.colors = readColors();
      this.colorsFor = contrast;
    }
    const col = this.colors;
    const base = col.velluto;
    if (!this.velvet || this.velvetBase !== base) {
      this.velvet = ctx.createPattern(makeVelvetTile(base), 'repeat');
      this.velvetBase = base;
    }
    ctx.fillStyle = this.velvet ?? base;
    ctx.fillRect(0, 0, cssW, cssH);
    const vign = ctx.createRadialGradient(cssW / 2, cssH / 2, Math.min(cssW, cssH) * 0.3, cssW / 2, cssH / 2, Math.max(cssW, cssH) * 0.75);
    vign.addColorStop(0, 'rgba(18,22,34,0)');
    vign.addColorStop(1, col.ombra);
    ctx.fillStyle = vign;
    ctx.fillRect(0, 0, cssW, cssH);

    // Safe area: rettangolo tratteggiato d'ottone.
    const { top, right, bottom, left } = vp.safe;
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = col.ottone;
    ctx.lineWidth = 2;
    ctx.strokeRect(left + 1, top + 1, cssW - left - right - 2, cssH - top - bottom - 2);
    ctx.restore();
    if (top > 0) {
      ctx.fillStyle = 'rgba(201,162,74,0.12)';
      ctx.fillRect(0, 0, cssW, top);
    }
    if (bottom > 0) {
      ctx.fillStyle = 'rgba(201,162,74,0.12)';
      ctx.fillRect(0, cssH - bottom, cssW, bottom);
    }

    // Fusi (segnaposto o veri) che dondolano in fondo.
    const reduced = this.s.settings.get().reducedMotion;
    const n = SPINDLES.length;
    const colW = Math.min(64, (cssW - left - right - 24) / n);
    const fusoH = Math.min(132, colW * 2.6);
    const y0 = cssH - bottom - fusoH - 18;
    const x0 = (cssW - colW * n) / 2;
    for (let i = 0; i < n; i++) {
      const who = SPINDLES[i] ?? 'lino';
      const f = this.s.assets.frame(`fuso/${who}`);
      const scale = fusoH / f.sh;
      const w = f.sw * scale;
      const cx = x0 + colW * (i + 0.5);
      const angle = reduced ? 0 : Math.sin(this.t * 1.6 + i * 0.9) * 0.07;
      ctx.save();
      ctx.translate(cx, y0);
      ctx.rotate(angle);
      ctx.strokeStyle = col.carta;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.drawImage(f.source, f.sx, f.sy, f.sw, f.sh, -w * f.ax, -fusoH * f.ay, w, fusoH);
      ctx.restore();
      const def = this.s.content.characters.get(who as CharacterId);
      if (def?.icon) drawGlyph(ctx, def.icon, cx, y0 + fusoH + 10, 14, col.testo, 1.6);
    }
  }
}
