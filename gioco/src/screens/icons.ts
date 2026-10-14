/**
 * Icone delle schermate: quelle del core (src/core/ui/glyphs.ts) più alcune
 * proprie, con lo stesso stile (viewBox 24×24, tratto a linea, currentColor).
 */
import { hasGlyph, svgIcon } from '../core/ui/glyphs';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Ingranaggio a 8 denti (Impostazioni), distinto dal sole del Merletto del giorno. */
function gearPath(teeth = 8, outer = 9.8, root = 7.3, hole = 3): string {
  const pt = (deg: number, r: number): string => {
    const a = (deg * Math.PI) / 180;
    return `${(12 + r * Math.cos(a)).toFixed(2)} ${(12 + r * Math.sin(a)).toFixed(2)}`;
  };
  const step = 360 / teeth;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a = i * step - 90;
    d += `${i === 0 ? 'M' : 'L'}${pt(a - 11, root)} L${pt(a - 6.5, outer)} L${pt(a + 6.5, outer)} L${pt(a + 11, root)} `;
  }
  d += 'Z';
  d += ` M${12 - hole} 12a${hole} ${hole} 0 1 0 ${hole * 2} 0a${hole} ${hole} 0 1 0 ${-hole * 2} 0z`;
  return d;
}

/** Tracciati propri (viewBox 24×24). */
export const SC_ICONS: Readonly<Record<string, string>> = {
  ingranaggio: gearPath(),
  dado: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M8.5 8.5h.01 M15.5 8.5h.01 M12 12h.01 M8.5 15.5h.01 M15.5 15.5h.01',
  ricomincia: 'M4 12a8 8 0 1 0 2.4-5.7 M4 4v4h4',
  casa: 'M4 11l8-7 8 7 M6 9.5V20h12V9.5 M10 20v-5h4v5',
  telaio: 'M8 3h8v18H8z M12 5.5l2.4 3-2.4 3-2.4-3z M12 13.5l2.4 3-2.4 3-2.4-3z',
  sole: 'M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 1 0 0-9z M12 2v2.5 M12 19.5V22 M4.9 4.9l1.8 1.8 M17.3 17.3l1.8 1.8 M2 12h2.5 M19.5 12H22 M4.9 19.1l1.8-1.8 M17.3 6.7l1.8-1.8',
  scarica: 'M12 3v12 M7.5 10.5L12 15l4.5-4.5 M5 19h14',
  esporta: 'M12 15V3 M7.5 7.5L12 3l4.5 4.5 M5 14v6h14v-6',
  importa: 'M12 3v12 M7.5 10.5L12 15l4.5-4.5 M5 14v6h14v-6',
  cestino: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6',
  lingua: 'M3 12h18 M12 3c2.6 2.5 4 5.6 4 9s-1.4 6.5-4 9 M12 3c-2.6 2.5-4 5.6-4 9s1.4 6.5 4 9 M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0z',
  suono: 'M4 9h4l5-4v14l-5-4H4z M16 9a4 4 0 0 1 0 6 M18.5 6.5a8 8 0 0 1 0 11',
  occhio: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z M15 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0z',
  mano: 'M8 13V5.5a1.5 1.5 0 0 1 3 0V12 M11 11V4.5a1.5 1.5 0 0 1 3 0V12 M14 11.5V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 7-6 7-3 0-4.5-1.5-6-4l-2-3.5a1.5 1.5 0 0 1 2.6-1.5L8 13',
  salva: 'M5 4h11l3 3v13H5z M8 4v5h7V4 M8 20v-6h8v6',
  fiamma: 'M12 21c-3.9 0-6-2.6-6-5.6 0-3.6 3.3-5.4 3.8-9.4 2.5 1.6 3.7 3.5 3.9 5.6.9-.7 1.4-1.7 1.6-2.9 1.8 1.6 2.7 3.9 2.7 6.4 0 3.5-2.4 5.9-6 5.9z',
};

export function hasScIcon(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(SC_ICONS, name) || hasGlyph(name);
}

/** Icona SVG decorativa (aria-hidden), dal core o dalle schermate. */
export function icon(name: string, size = 22, className = ''): SVGSVGElement {
  const d = SC_ICONS[name];
  if (d === undefined) return svgIcon(name, { size, className });
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('class', `core-icon${className ? ` ${className}` : ''}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.dataset.glyph = name;
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.8');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);
  return svg;
}

/**
 * Bordo di merletto disegnato (smerlo con occhielli), per separare il titolo dal
 * sottotitolo e le sezioni dei fogli. Puramente decorativo.
 */
export function laceEdge(className = 'sc-smerlo', scallops = 9): SVGSVGElement {
  const w = scallops * 24;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} 18`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  let d = `M0 3H${w}`;
  for (let i = 0; i < scallops; i++) {
    const x = i * 24;
    d += ` M${x} 3c3 11 21 11 24 0`;
    d += ` M${x + 12} 9.5a2 2 0 1 0 0 .01`;
  }
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.2');
  path.setAttribute('stroke-linecap', 'round');
  svg.appendChild(path);
  return svg;
}
