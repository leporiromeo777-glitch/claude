/**
 * Testo ricco senza innerHTML (ARCHITETTURA 10).
 *
 * Marcatori ammessi nei testi:
 * - `*corsivo*` → <em>
 * - `**grassetto**` → <strong>
 * - `[[teresa]]` → nome del personaggio nel suo colore, con la sua icona
 * - a capo (`\n`) → <br>
 * Un marcatore non chiuso resta testo. Tutto diventa nodi DOM creati uno per uno.
 */
import type { CharacterId } from '../types';
import { services, hasService } from '../services';
import { svgIcon } from './glyphs';
import { CHARACTER_COLORS } from '../placeholders';

export interface RichTextDeps {
  t(key: string, params?: Record<string, string | number>): string;
  has?(key: string): boolean;
  /** Nome, colore e icona di un personaggio. */
  character?(id: string): { name: string; color: string; icon: string } | null;
  /** Segna in rosso le chiavi mancanti (sviluppo). */
  markMissing?: boolean;
}

// ───────── Inchiostro su carta (revisione 1, C17) ─────────
/** Carta predefinita del gioco (`--carta`). */
export const PAPER_DEFAULT = '#EDE4D3';
/** Contrasto minimo del testo sulla carta (WCAG AA). */
export const INK_MIN_CONTRAST = 4.5;

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function toHex(rgb: readonly number[]): string {
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}
function luminance(rgb: readonly number[]): number {
  const lin = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (lin[0] ?? 0) + 0.7152 * (lin[1] ?? 0) + 0.0722 * (lin[2] ?? 0);
}
/** Rapporto di contrasto WCAG fra due colori `#RRGGBB` (1..21). */
export function contrastRatio(a: string, b: string): number {
  const x = parseHex(a);
  const y = parseHex(b);
  if (!x || !y) return 1;
  const la = luminance(x);
  const lb = luminance(y);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Inchiostro leggibile sulla carta (C17): scurisce `hex` (stessa tinta, verso il
 * nero) fino a un contrasto ≥ 4,5:1 su `paper` (`#EDE4D3` se manca). Un colore
 * che basta già resta com'è (in `#RRGGBB` maiuscolo); un colore non valido dà
 * l'inchiostro del gioco.
 */
export function inkOnPaper(hex: string, paper: string = PAPER_DEFAULT): string {
  const rgb = parseHex(hex);
  if (!rgb) return '#2B2622';
  const bg = parseHex(paper) ? paper : PAPER_DEFAULT;
  for (let k = 1; k >= 0; k -= 0.01) {
    const c = toHex(rgb.map((v) => v * k));
    if (contrastRatio(c, bg) >= INK_MIN_CONTRAST) return c;
  }
  return '#000000';
}

export type RichNode =
  | { k: 'text'; v: string }
  | { k: 'br' }
  | { k: 'em'; c: RichNode[] }
  | { k: 'strong'; c: RichNode[] }
  | { k: 'pers'; id: string };

/** Analizza i marcatori in un albero (puro, testabile senza DOM). */
export function parseRich(src: string): RichNode[] {
  const out: RichNode[] = [];
  let buf = '';
  const flush = (): void => {
    if (buf) out.push({ k: 'text', v: buf });
    buf = '';
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') {
      flush();
      out.push({ k: 'br' });
      i++;
      continue;
    }
    if (c === '[' && src[i + 1] === '[') {
      const end = src.indexOf(']]', i + 2);
      const id = end > 0 ? src.slice(i + 2, end).trim() : '';
      if (end > 0 && /^[a-z][a-z0-9_]*$/i.test(id)) {
        flush();
        out.push({ k: 'pers', id });
        i = end + 2;
        continue;
      }
    }
    if (c === '*' && src[i + 1] === '*') {
      const end = src.indexOf('**', i + 2);
      if (end > i + 2) {
        flush();
        out.push({ k: 'strong', c: parseRich(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    } else if (c === '*') {
      // Il corsivo si chiude al primo '*' singolo; le coppie '**' interne sono grassetti.
      let j = i + 1;
      let end = -1;
      while (j < src.length) {
        if (src[j] === '*') {
          if (src[j + 1] === '*') {
            j += 2;
            continue;
          }
          end = j;
          break;
        }
        j++;
      }
      if (end > i + 1) {
        flush();
        out.push({ k: 'em', c: parseRich(src.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    buf += c;
    i++;
  }
  flush();
  return out;
}

/** Testo semplice senza marcatori (per aria-label, didascalie, condivisione). */
export function plainText(src: string, nameOf?: (id: string) => string): string {
  const walk = (nodes: RichNode[]): string =>
    nodes
      .map((n) => {
        switch (n.k) {
          case 'text':
            return n.v;
          case 'br':
            return '\n';
          case 'em':
          case 'strong':
            return walk(n.c);
          case 'pers':
            return nameOf ? nameOf(n.id) : n.id;
        }
        return '';
      })
      .join('');
  return walk(parseRich(src));
}

function build(nodes: RichNode[], parent: Node, deps: RichTextDeps): void {
  for (const n of nodes) {
    switch (n.k) {
      case 'text':
        parent.appendChild(document.createTextNode(n.v));
        break;
      case 'br':
        parent.appendChild(document.createElement('br'));
        break;
      case 'em':
      case 'strong': {
        const e = document.createElement(n.k);
        build(n.c, e, deps);
        parent.appendChild(e);
        break;
      }
      case 'pers': {
        const info = deps.character?.(n.id) ?? null;
        const span = document.createElement('span');
        span.className = 'core-pers';
        span.dataset.character = n.id;
        const color = info?.color ?? CHARACTER_COLORS.lino;
        span.style.setProperty('--pers-color', color);
        span.style.setProperty('--pers-ink', inkOnPaper(color));
        if (info?.icon) span.appendChild(svgIcon(info.icon, { size: 16, className: 'core-pers-icon' }));
        span.appendChild(document.createTextNode(info?.name ?? n.id));
        parent.appendChild(span);
        break;
      }
    }
  }
}

/** Converte un testo già tradotto in un frammento DOM. */
export function richFromString(text: string, deps: RichTextDeps): DocumentFragment {
  const frag = document.createDocumentFragment();
  build(parseRich(text), frag, deps);
  return frag;
}

/** Dipendenze predefinite: i servizi del gioco. */
export function defaultRichDeps(): RichTextDeps {
  return {
    t: (k, p) => services.i18n.t(k, p),
    has: (k) => services.i18n.has(k),
    markMissing: import.meta.env.DEV,
    character(id) {
      const def = hasService('content') ? services.content.characters.get(id as CharacterId) : undefined;
      const nameKey = def?.nameKey ?? `comune.pers.${id}.nome`;
      const name = services.i18n.has(nameKey) ? services.i18n.t(nameKey) : id.charAt(0).toUpperCase() + id.slice(1);
      const color = def?.color ?? (CHARACTER_COLORS as Record<string, string>)[id] ?? CHARACTER_COLORS.lino;
      return { name, color, icon: def?.icon ?? '' };
    },
  };
}

/**
 * Testo ricco da una chiave i18n (ARCHITETTURA 5.1: `richText(key, params)`).
 * In sviluppo una chiave mancante è avvolta in uno span con il bordo rosso.
 */
export function richText(key: string, params?: Record<string, string | number>, deps: RichTextDeps = defaultRichDeps()): DocumentFragment {
  const frag = richFromString(deps.t(key, params), deps);
  if (deps.markMissing && deps.has && !deps.has(key)) {
    const wrap = document.createElement('span');
    wrap.className = 'core-missing-key';
    wrap.dataset.key = key;
    wrap.appendChild(frag);
    const out = document.createDocumentFragment();
    out.appendChild(wrap);
    return out;
  }
  return frag;
}
