/**
 * Glifi disegnati in codice (viewBox 24×24, tratti a linea). Servono sia al DOM
 * (svgIcon) sia al canvas (glyphPath → Path2D): così l'icona di un personaggio
 * (CharacterDef.icon) è la stessa sul fuso, nel testo e nel Taccuino.
 *
 * Personaggi (GDD 5.4): busta, pagnotta, croce, aquilone, pesce, libro, lanterna,
 * ampolla, scialle, fuso, forbici. Luoghi (GDD 5.5): bitta, pagnotta, pozzo,
 * campanile, mortaio, faro. Interfaccia: menu, disfa, taccuino, lampada, lucchetto,
 * indietro, avanti, chiudi, spillo, gomitolo, spunta, impostazioni, condividi,
 * copia, nota, stella, play, pausa, info, campana, matita.
 */

export interface Glyph {
  d: string;
  /** Riempito invece che a tratto. */
  fill?: boolean;
}

export const GLYPHS: Readonly<Record<string, Glyph>> = {
  // Personaggi
  busta: { d: 'M3 6h18v12H3z M3 6l9 7 9-7' },
  pagnotta: { d: 'M4 16c0-5.5 3.6-9 8-9s8 3.5 8 9v1.5H4z M8.5 10.5l1.4 2.5 M12 9.5v3 M15.5 10.5l-1.4 2.5' },
  croce: { d: 'M12 3v18 M7 8h10' },
  aquilone: { d: 'M12 2l6 8-6 8-6-8z M12 2v16 M6 10h12 M12 18c-1.5 1.5 1.5 2.5 0 4' },
  pesce: { d: 'M2 12c3.5-4.5 9-5 13-2l5-3v10l-5-3c-4 3-9.5 2.5-13-2z M7 11v.01' },
  libro: { d: 'M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4z M20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z' },
  lanterna: { d: 'M9 4h6 M12 2v2 M8 7h8v10H8z M7 17h10l-1 3H8z M12 10v4' },
  ampolla: { d: 'M10 3h4 M10.5 3v6L5 19a1.5 1.5 0 0 0 1.3 2h11.4a1.5 1.5 0 0 0 1.3-2l-5.5-10V3 M7.5 15h9' },
  scialle: { d: 'M3 6h18l-9 14z M7.5 6l4.5 7 4.5-7' },
  fuso: { d: 'M12 2v3 M10 5h4v3h-4z M9 8h6l-1 7h-4z M11 15h2l-.5 6h-1z' },
  forbici: { d: 'M8.5 6a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z M8.5 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z M8 7.5L20 18 M8 16.5L20 6' },
  // Luoghi
  bitta: { d: 'M8 20h8 M9 20V10h6v10 M7 10h10 M8.5 6h7v4h-7z M4 15c3 2 13 2 16 0' },
  pozzo: { d: 'M5 10h14 M6 10v10h12V10 M8 10V6 M16 10V6 M6 6h12 M12 6V3' },
  campanile: { d: 'M9 21V8l3-5 3 5v13z M9 12h6 M11 15h2v3h-2z' },
  mortaio: { d: 'M4 11h16l-2 7H6z M8 18l-1 3h10l-1-3 M14 11l5-8' },
  faro: { d: 'M10 21l1-14h2l1 14z M8.5 21h7 M11 7V4h2v3 M10 4h4 M8 4.5L4 3 M16 4.5L20 3 M10.6 12h2.8 M10.3 16h3.4' },
  // Interfaccia
  menu: { d: 'M4 7h16 M4 12h16 M4 17h16' },
  disfa: { d: 'M9 6L4 11l5 5 M4 11h10a5 5 0 0 1 0 10h-2' },
  taccuino: { d: 'M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6z M6 3v18 M9 7h6 M9 11h6' },
  lampada: { d: 'M9 18h6 M10 21h4 M12 3a6 6 0 0 1 4 10.5c-1 1-1 2-1 3H9c0-1 0-2-1-3A6 6 0 0 1 12 3z' },
  lucchetto: { d: 'M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3 M12 15v2' },
  indietro: { d: 'M15 5l-7 7 7 7' },
  avanti: { d: 'M9 5l7 7-7 7' },
  chiudi: { d: 'M6 6l12 12 M18 6L6 18' },
  spillo: { d: 'M15 6a3 3 0 1 1-6 0 3 3 0 1 1 6 0z M12 9v12' },
  gomitolo: { d: 'M20 12a8 8 0 1 1-16 0 8 8 0 1 1 16 0z M6 8c4 0 9 3 12 8 M5 13c4-1 9 1 11 6 M9 4.6c3 3 4 8 3 15' },
  spunta: { d: 'M5 12l5 5 9-10' },
  impostazioni: {
    d: 'M15 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0z M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M5.6 18.4l2.1-2.1 M16.3 7.7l2.1-2.1',
  },
  condividi: { d: 'M12 3v12 M8 7l4-4 4 4 M5 12v8h14v-8' },
  copia: { d: 'M8 8h11v13H8z M5 16V3h11' },
  nota: { d: 'M9 18V5l10-2v13 M9 18a3 3 0 1 1-6 0 3 3 0 1 1 6 0z M19 16a3 3 0 1 1-6 0 3 3 0 1 1 6 0z' },
  stella: { d: 'M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2z', fill: true },
  play: { d: 'M7 4l13 8-13 8z', fill: true },
  pausa: { d: 'M7 4h3v16H7z M14 4h3v16h-3z', fill: true },
  info: { d: 'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0z M12 11v6 M12 7.5v.5' },
  campana: { d: 'M6 17h12 M7 17v-6a5 5 0 0 1 10 0v6 M12 3v3 M11 20h2' },
  matita: { d: 'M4 20l1-5L16 4l4 4L9 19z M14 6l4 4' },
};

export type GlyphName = keyof typeof GLYPHS;

const FALLBACK: Glyph = { d: 'M19 12a7 7 0 1 1-14 0 7 7 0 1 1 14 0z' };

export function glyph(name: string): Glyph {
  return GLYPHS[name] ?? FALLBACK;
}

export function hasGlyph(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(GLYPHS, name);
}

const pathCache = new Map<string, Path2D>();

/** Path2D del glifo (coordinate 0-24): `ctx.scale(s / 24, s / 24)` e poi stroke o fill. */
export function glyphPath(name: string): Path2D {
  let p = pathCache.get(name);
  if (!p) {
    p = new Path2D(glyph(name).d);
    pathCache.set(name, p);
  }
  return p;
}

/** Disegna un glifo sul canvas, centrato in (x, y), largo `size` px. */
export function drawGlyph(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  size: number,
  color: string,
  lineWidth = 2,
): void {
  const g = glyph(name);
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  if (g.fill) {
    ctx.fillStyle = color;
    ctx.fill(glyphPath(name));
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = (lineWidth * 24) / size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(glyphPath(name));
  }
  ctx.restore();
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Icona SVG per il DOM (colore: currentColor). Decorativa salvo `label`. */
export function svgIcon(name: string, opts: { size?: number; className?: string; label?: string } = {}): SVGSVGElement {
  const g = glyph(name);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  const size = opts.size ?? 24;
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('class', `core-icon${opts.className ? ` ${opts.className}` : ''}`);
  svg.dataset.glyph = name;
  if (opts.label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', opts.label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', g.d);
  if (g.fill) {
    path.setAttribute('fill', 'currentColor');
  } else {
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.8');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
  }
  svg.appendChild(path);
  return svg;
}
