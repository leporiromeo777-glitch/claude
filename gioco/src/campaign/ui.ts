/**
 * Piccoli aiuti d'interfaccia condivisi dalle scene e dai pannelli della campagna:
 * contenitore delle scene, nomi e colori dei personaggi, immagini degli asset in un
 * canvas del DOM, caricamento su richiesta dei diorami, calligrafie.
 */
import type { AssetStore, CharacterId, Handwriting, Services, UiLayer } from '../core/types';
import { el } from '../core/ui/dom';
import { svgIcon } from '../core/ui/glyphs';
import { CHARACTER_COLORS } from '../core/placeholders';
import { inkOnPaper } from '../core/ui/richtext';

/** Contenitore del DOM delle scene (CoreUiLayer.sceneRoot), o la radice dell'interfaccia. */
export function sceneHost(s: Services): HTMLElement {
  return (s.ui as UiLayer & { sceneRoot?: HTMLElement }).sceneRoot ?? s.ui.root;
}

/** Carica su richiesta le immagini indicate (diorami e quadri): ARCHITETTURA 12, richiesta di asset-blender. */
export async function loadImages(assets: AssetStore, names: readonly string[]): Promise<void> {
  const a = assets as AssetStore & { loadNames?: (n: string[]) => Promise<void> };
  try {
    if (typeof a.loadNames === 'function') await a.loadNames([...names]);
  } catch (err) {
    console.warn('[campaign] image load failed', err);
  }
}

/** Libera i diorami e i quadri decodificati (al massimo 4 alla volta, ARCHITETTURA 16). */
export function unloadImages(assets: AssetStore): void {
  const a = assets as AssetStore & { unload?: (g: string) => void };
  try {
    a.unload?.('dio');
    a.unload?.('tab');
  } catch {
    /* niente da liberare */
  }
}

export function charName(s: Services, id: CharacterId | string): string {
  const def = s.content.characters.get(id as CharacterId);
  const key = def?.nameKey ?? `comune.pers.${id}.nome`;
  return s.i18n.has(key) ? s.i18n.t(key) : id;
}

export function charColor(s: Services, id: CharacterId | string): string {
  return s.content.characters.get(id as CharacterId)?.color ?? (CHARACTER_COLORS as Record<string, string>)[id] ?? CHARACTER_COLORS.lino;
}

export function charIcon(s: Services, id: CharacterId | string): string {
  return s.content.characters.get(id as CharacterId)?.icon ?? 'fuso';
}

/**
 * Etichetta di un personaggio: icona, colore e nome (mai solo colore). Sulla carta il
 * nome è in un inchiostro scurito fino a 4,5:1 (C17, `inkOnPaper`); il colore pieno resta
 * nella sottolineatura e nell'icona.
 */
export function charChip(s: Services, id: CharacterId | string, opts: { test?: string } = {}): HTMLElement {
  const color = charColor(s, id);
  return el(
    'span',
    { class: 'core-pers cp-pers', style: { '--pers-color': color, '--pers-ink': inkOnPaper(color) }, data: { character: id }, test: opts.test },
    svgIcon(charIcon(s, id), { size: 16, className: 'core-pers-icon' }),
    charName(s, id),
  );
}

/**
 * I nomi dentro un foglio con una carta propria (la calligrafia di un bigliettino o di
 * una lettera): l'inchiostro si scurisce fino a 4,5:1 su quella carta (C17), non su
 * quella predefinita. Vale per le etichette (`charChip`) e per i nomi nel testo.
 */
export function inkNamesOn(root: HTMLElement, paper: string | null | undefined): void {
  if (!paper) return;
  for (const n of root.querySelectorAll<HTMLElement>('.core-pers')) {
    const color = n.style.getPropertyValue('--pers-color').trim();
    if (color) n.style.setProperty('--pers-ink', inkOnPaper(color, paper));
  }
}

/** Calligrafia "a matita" dei bigliettini anonimi (GDD 3.11: alla merlettaia, senza firma). */
export const PENCIL_HAND: Handwriting = { font: 'caveat', ink: '#55504A', paper: '#E9E3D6', slantDeg: 1, sizeScale: 1 };

/** Mano di Ada a matita (pagine del Libro sul nome e sul filo nero). */
export const ADA_PENCIL_HAND: Handwriting = { font: 'caveat', ink: '#5A5048', paper: '#EFE6D2', slantDeg: 2, sizeScale: 1 };

/**
 * La mano di Clotilde (Q060): la grafia color seppia delle note a margine del Libro e dei
 * merletti d'Archivio (Caveat, inchiostro seppia), non il tondo tipografico. Così il
 * Taccuino può dire che la lettera «è scritta con la grafia dei margini».
 */
export const CLOTILDE_HAND: Handwriting = { font: 'caveat', ink: '#5C3B22', paper: '#EFE3C8', slantDeg: 2, sizeScale: 1.1 };

export function handOf(s: Services, id: CharacterId | string): Handwriting | null {
  if (id === 'clotilde') return CLOTILDE_HAND;
  return s.content.characters.get(id as CharacterId)?.hand ?? null;
}

/** La bottiglia vuota con il nodo di filo nero (g15 → sera di g16, Q039): derivata da `obj/bottiglia`. */
export const EMPTY_BOTTLE = 'obj/bottiglia_vuota';

type Frame = ReturnType<Services['assets']['frame']>;
const derived = new Map<unknown, HTMLCanvasElement>();

/**
 * La bottiglia senza il foglio arrotolato (Q039): dalla bottiglia col messaggio si toglie
 * la carta (i pixel color carta dentro il vetro, riempiti col vetro intorno) e dentro si
 * disegna un nodo di filo nero. Si calcola una volta per immagine; null se non si può.
 */
export function emptyBottle(f: Frame): HTMLCanvasElement | null {
  const cached = derived.get(f.source);
  if (cached) return cached;
  if (typeof document === 'undefined') return null;
  try {
    const w = Math.max(1, Math.round(f.sw));
    const h = Math.max(1, Math.round(f.sh));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings) as CanvasRenderingContext2D | null;
    if (!ctx || typeof ctx.getImageData !== 'function') return null;
    ctx.drawImage(f.source, f.sx, f.sy, f.sw, f.sh, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const k = 256 / Math.max(w, h);
    const alpha = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? 0 : (d[(y * w + x) * 4 + 3] ?? 0));
    // Dentro il vetro, lontano dal contorno: il bordo della bottiglia non si tocca.
    const inside = (x: number, y: number, r: number): boolean => {
      for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (alpha(xx, yy) < 200) return false;
      return true;
    };
    // La carta: più rossa che verde e più che blu, nel mezzo della bottiglia (non il tappo).
    const x0 = Math.floor(100 / k);
    const x1 = Math.ceil(220 / k);
    const y0 = Math.floor(90 / k);
    const y1 = Math.ceil(205 / k);
    const r3 = Math.max(1, Math.round(3 / k));
    const r2 = Math.max(1, Math.round(2 / k));
    const paper: number[] = [];
    for (let y = y0; y < Math.min(h, y1); y++) {
      for (let x = x0; x < Math.min(w, x1); x++) {
        const i = (y * w + x) * 4;
        const r = d[i] ?? 0;
        const g = d[i + 1] ?? 0;
        const b = d[i + 2] ?? 0;
        if ((d[i + 3] ?? 0) >= 200 && r >= g && r > b + 12 && inside(x, y, r3)) paper.push(y * w + x);
      }
    }
    // Un po' più larga, per prendere anche i bordi sfumati del foglio (sempre dentro il vetro).
    const rad = Math.max(1, Math.round(4 / k));
    const mask = new Uint8Array(w * h);
    for (const p of paper) {
      const x = p % w;
      const y = (p - x) / w;
      for (let yy = Math.max(0, y - rad); yy <= Math.min(h - 1, y + rad); yy++) {
        for (let xx = Math.max(0, x - rad); xx <= Math.min(w - 1, x + rad); xx++) {
          const q = yy * w + xx;
          if (!mask[q] && alpha(xx, yy) >= 200 && inside(xx, yy, r2)) mask[q] = 1;
        }
      }
    }
    // Si riempie col vetro intorno, dal bordo verso l'interno (l'opacità resta quella di prima).
    const known = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p++) known[p] = !mask[p] && (d[p * 4 + 3] ?? 0) > 100 ? 1 : 0;
    let todo: number[] = [];
    for (let p = 0; p < w * h; p++) if (mask[p]) todo.push(p);
    for (let it = 0; it < 160 && todo.length > 0; it++) {
      const fill: [number, number, number, number][] = [];
      const rest: number[] = [];
      for (const p of todo) {
        const x = p % w;
        const y = (p - x) / w;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const q = yy * w + xx;
            if (!known[q]) continue;
            r += d[q * 4] ?? 0;
            g += d[q * 4 + 1] ?? 0;
            b += d[q * 4 + 2] ?? 0;
            n++;
          }
        }
        if (n > 0) fill.push([p, r / n, g / n, b / n]);
        else rest.push(p);
      }
      if (fill.length === 0) break;
      for (const [p, r, g, b] of fill) {
        d[p * 4] = r;
        d[p * 4 + 1] = g;
        d[p * 4 + 2] = b;
        known[p] = 1;
      }
      todo = rest;
    }
    ctx.putImageData(img, 0, 0);
    // Il nodo di filo nero, dove stava il foglio: due anelli intrecciati e i due capi lungo
    // la bottiglia, abbastanza spessi da leggersi anche alla porta (72 px, verifica R2).
    ctx.save();
    ctx.scale(1 / k, 1 / k);
    ctx.strokeStyle = '#120e0e';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.ellipse(153, 146, 11, 8, 0.7, 0, Math.PI * 2);
    ctx.moveTo(176, 155);
    ctx.ellipse(166, 155, 10, 7, -0.2, 0, Math.PI * 2);
    ctx.moveTo(126, 128);
    ctx.quadraticCurveTo(136, 132, 144, 140);
    ctx.moveTo(174, 160);
    ctx.quadraticCurveTo(186, 170, 200, 172);
    ctx.stroke();
    ctx.restore();
    derived.set(f.source, c);
    return c;
  } catch {
    return null;
  }
}

/** Disegna una cornice di sprite (obj/…, fig/…) in un canvas del DOM, centrata. */
export function spriteCanvas(s: Services, name: string, size: number, opts: { className?: string; label?: string } = {}): HTMLCanvasElement {
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const c = el('canvas', { class: ['cp-sprite', opts.className], attrs: { 'aria-hidden': opts.label ? null : 'true', role: opts.label ? 'img' : null, 'aria-label': opts.label ?? null } });
  c.width = Math.round(size * dpr);
  c.height = Math.round(size * dpr);
  c.style.width = `${size}px`;
  c.style.height = `${size}px`;
  const draw = (): void => {
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const f = s.assets.frame(name === EMPTY_BOTTLE ? 'obj/bottiglia' : name);
    const k = Math.min(c.width / Math.max(1, f.sw), c.height / Math.max(1, f.sh));
    const w = f.sw * k;
    const h = f.sh * k;
    try {
      const empty = name === EMPTY_BOTTLE && !f.placeholder ? emptyBottle(f) : null;
      if (empty) ctx.drawImage(empty, 0, 0, empty.width, empty.height, (c.width - w) / 2, (c.height - h) / 2, w, h);
      else ctx.drawImage(f.source, f.sx, f.sy, f.sw, f.sh, (c.width - w) / 2, (c.height - h) / 2, w, h);
    } catch {
      /* immagine non pronta */
    }
  };
  draw();
  return c;
}

/** Si gioca con il mouse (puntatore fine, come nel titolo, SCH-12). */
export function pointerFine(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch {
    return false;
  }
}

/** «Tocca…» col dito, «Clicca…» col mouse (Q067, D17): la chiave con il suffisso `Clic`. */
export function tapKey(key: string): string {
  return pointerFine() ? `${key}Clic` : key;
}

/** Ritardo scalato con la velocità delle animazioni (0 = istantanea). */
export function animDelay(s: Services, ms: number): number {
  const st = s.settings.get();
  if (st.animSpeed === 0) return 0;
  return ms / st.animSpeed;
}

/** Elemento che segue la disposizione (largo/stretto). */
export function isWide(s: Services): boolean {
  return s.viewport.get().layout === 'largo';
}
