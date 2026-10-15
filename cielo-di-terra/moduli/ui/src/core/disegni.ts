/**
 * Piccoli disegni a penna in SVG, condivisi fra i componenti (non sono icone: sono illustrazioni
 * da cartiglio, come i fregi delle carte topografiche).
 */
import { s } from './dom';

/**
 * Il Verbano visto di tre quarti: un cilindro a matita con le tre Finestre scure, la Linea sull'asse
 * e la Lanterna sul Tappo Nord. `tratti` aggiunge la classe che anima il disegno (schermata di caricamento).
 */
export function disegnoCilindro(opz: { larghezza?: number; animato?: boolean } = {}): SVGSVGElement {
  const L = 320;
  const H = 104;
  const cx1 = 44;
  const cx2 = 276;
  const cy = 52;
  const rx = 17;
  const ry = 40;
  const svg = s('svg', {
    viewBox: `0 0 ${L} ${H}`,
    width: opz.larghezza ?? L,
    class: `ui-cilindro${opz.animato ? ' ui-cilindro--animato' : ''}`,
    'aria-hidden': 'true',
    focusable: 'false',
  });
  // x sul bordo sinistro di un'ellisse terminale, per una quota y.
  const xBordo = (cx: number, y: number): number => {
    const t = Math.max(-1, Math.min(1, (y - cy) / ry));
    return cx - rx * Math.sqrt(1 - t * t);
  };
  // y di una generatrice all'angolo φ (gradi) sulla metà visibile (0° in alto, 180° in basso).
  const yAngolo = (phi: number): number => cy - ry * Math.cos((phi * Math.PI) / 180);

  // Finestre visibili sulla faccia di fronte: due strisce scure (la terza è dietro).
  const finestre: [number, number][] = [
    [8, 34],
    [110, 140],
  ];
  for (const [a, b] of finestre) {
    const passi = 10;
    const pts: string[] = [];
    for (let i = 0; i <= passi; i++) {
      const y = yAngolo(a + ((b - a) * i) / passi);
      pts.push(`${xBordo(cx1, y).toFixed(1)},${y.toFixed(1)}`);
    }
    for (let i = passi; i >= 0; i--) {
      const y = yAngolo(a + ((b - a) * i) / passi);
      pts.push(`${xBordo(cx2, y).toFixed(1)},${y.toFixed(1)}`);
    }
    svg.append(s('polygon', { points: pts.join(' '), class: 'ui-cil-finestra' }));
  }

  // Tratteggio delle valli: generatrici sottili.
  for (let phi = 45; phi < 180; phi += 9) {
    if (finestre.some(([a, b]) => phi >= a - 2 && phi <= b + 2)) continue;
    const y = yAngolo(phi);
    svg.append(
      s('path', {
        d: `M${xBordo(cx1, y).toFixed(1)} ${y.toFixed(1)} L${xBordo(cx2, y).toFixed(1)} ${y.toFixed(1)}`,
        class: 'ui-cil-generatrice',
      }),
    );
  }

  // Contorno: arco sinistro (metà visibile), due generatrici di contorno, ellisse del Tappo Nord.
  svg.append(
    s('path', {
      d: `M${cx1} ${cy - ry} A${rx} ${ry} 0 0 0 ${cx1} ${cy + ry}`,
      class: 'ui-cil-contorno',
    }),
    s('path', { d: `M${cx1} ${cy - ry} L${cx2} ${cy - ry}`, class: 'ui-cil-contorno' }),
    s('path', { d: `M${cx1} ${cy + ry} L${cx2} ${cy + ry}`, class: 'ui-cil-contorno' }),
    s('ellipse', { cx: cx2, cy, rx, ry, class: 'ui-cil-contorno' }),
    // Il Sordo: tratteggio sul tappo.
    s('path', {
      d: `M${cx2 - 9} ${cy + 22} L${cx2 - 3} ${cy + 8} L${cx2 + 1} ${cy + 14} L${cx2 + 6} ${cy + 4} L${cx2 + 11} ${cy + 20}`,
      class: 'ui-cil-generatrice',
    }),
    // La Linea, sull'asse.
    s('path', { d: `M${cx1 + 4} ${cy} L${cx2 - 4} ${cy}`, class: 'ui-cil-linea' }),
    // La Lanterna, al centro del Tappo Nord.
    s('circle', { cx: cx2, cy, r: 3.2, class: 'ui-cil-lanterna' }),
  );
  return svg;
}

/** Sottolineatura a mano libera (per titoli e notifiche). */
export function trattoMatita(larghezza = 200): SVGSVGElement {
  return s(
    'svg',
    { viewBox: '0 0 200 12', width: larghezza, height: 12, preserveAspectRatio: 'none', class: 'ui-tratto', 'aria-hidden': 'true' },
    s('path', { d: 'M3 7 C 40 3, 90 9.5, 140 5 S 188 6, 197 4', pathLength: 1 }),
  );
}
