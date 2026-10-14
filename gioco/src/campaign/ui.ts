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

/** Calligrafia "a matita" dei bigliettini anonimi (GDD 3.11: alla merlettaia, senza firma). */
export const PENCIL_HAND: Handwriting = { font: 'caveat', ink: '#55504A', paper: '#E9E3D6', slantDeg: 1, sizeScale: 1 };

/** Mano di Ada a matita (pagine del Libro sul nome e sul filo nero). */
export const ADA_PENCIL_HAND: Handwriting = { font: 'caveat', ink: '#5A5048', paper: '#EFE6D2', slantDeg: 2, sizeScale: 1 };

export function handOf(s: Services, id: CharacterId | string): Handwriting | null {
  return s.content.characters.get(id as CharacterId)?.hand ?? null;
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
    const f = s.assets.frame(name);
    const k = Math.min(c.width / Math.max(1, f.sw), c.height / Math.max(1, f.sh));
    const w = f.sw * k;
    const h = f.sh * k;
    try {
      ctx.drawImage(f.source, f.sx, f.sy, f.sw, f.sh, (c.width - w) / 2, (c.height - h) / 2, w, h);
    } catch {
      /* immagine non pronta */
    }
  };
  draw();
  return c;
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
