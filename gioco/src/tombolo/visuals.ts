/**
 * Aspetto dei fili (GDD 5.4, 12.2-12.3): colore, motivo, spessore, icona, fuso.
 * Calcolato una volta per notte (e quando un filo d'Archivio si ricolora),
 * così il disegno non costruisce stringhe di colore a ogni fotogramma.
 */
import type { CharacterDef, CharacterId, LevelDef, ThreadId, ThreadKind, ThreadPattern } from '../core/types';
import { CHARACTER_COLORS } from '../core/placeholders';

export interface ThreadVisual {
  id: ThreadId;
  kind: ThreadKind;
  character: CharacterId | null;
  /** Colore base. */
  color: string;
  /** Linea di luce (1 px, spostata di −1 px). */
  light: string;
  /** Ombra (nodo, contorni). */
  dark: string;
  /** Colore del motivo. */
  ink: string;
  pattern: ThreadPattern;
  /** Spessore del filo (lino 3,5; doppio = due linee). */
  width: number;
  /** Glifo sul fuso (null: lino e fili sbiaditi). */
  icon: string | null;
  /** Fotogramma del fuso nell'atlas. */
  spindle: string;
  faded: boolean;
  /** Alto contrasto: bordo chiaro di 1 px. */
  edge: string | null;
}

export const LINO_COLOR = '#8E8676';
export const LINO_COLOR_HC = '#B5AE9F';
export const FADED_COLOR = '#77736B';
export const NERO_RIFLESSO = '#3B2F27';

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function parseHex(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m && m[1] ? Number.parseInt(m[1], 16) : 0x808080;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) | (clamp255(r) << 16) | (clamp255(g) << 8) | clamp255(b)).toString(16).slice(1)}`;
}

/** Schiarisce (f > 0) o scurisce (f < 0) un colore. */
export function shade(hex: string, f: number): string {
  const [r, g, b] = parseHex(hex);
  if (f >= 0) return toHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f);
  return toHex(r * (1 + f), g * (1 + f), b * (1 + f));
}

/** Luminanza relativa approssimata (0-1). */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function withAlpha(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

export interface VisualOptions {
  highContrast?: boolean;
  /** Archivio: fili ancora sbiaditi. */
  faded?: (id: ThreadId) => boolean;
  /** Archivio: personaggio confermato di un filo sbiadito. */
  confirmedAs?: (id: ThreadId) => CharacterId | null;
  /** Fuso intagliato scelto (fusi dei lino). */
  cosmetic?: string | null;
}

function characterVisual(id: ThreadId, kind: ThreadKind, ch: CharacterDef | undefined, chId: CharacterId, hc: boolean): ThreadVisual {
  const color = ch?.color ?? CHARACTER_COLORS[chId] ?? LINO_COLOR;
  const lum = luminance(color);
  const light = chId === 'livia' ? NERO_RIFLESSO : shade(color, 0.45);
  const ink = lum > 0.62 ? shade(color, -0.55) : shade(color, 0.62);
  return {
    id,
    kind,
    character: chId,
    color,
    light,
    dark: shade(color, -0.45),
    ink: chId === 'livia' ? '#6B5A4C' : ink,
    pattern: ch?.pattern ?? 'liscio',
    width: 6,
    icon: ch?.icon ?? null,
    spindle: `fuso/${chId === 'ernesto' || chId === 'anselmo' || chId === 'aldo' || chId === 'bortolo' || chId === 'arianna' ? 'lino' : chId}`,
    faded: false,
    edge: hc ? '#F3EEE4' : null,
  };
}

function linoVisual(id: ThreadId, hc: boolean, cosmetic: string | null | undefined): ThreadVisual {
  const color = hc ? LINO_COLOR_HC : LINO_COLOR;
  return {
    id,
    kind: 'lino',
    character: null,
    color,
    light: shade(color, 0.35),
    dark: shade(color, -0.4),
    ink: shade(color, 0.5),
    pattern: 'nessuno',
    width: 3.5,
    icon: null,
    spindle: cosmetic ? `fuso/${cosmetic}` : 'fuso/lino',
    faded: false,
    edge: hc ? '#F3EEE4' : null,
  };
}

function fadedVisual(id: ThreadId, kind: ThreadKind, hc: boolean): ThreadVisual {
  const color = hc ? '#A39E93' : FADED_COLOR;
  return {
    id,
    kind,
    character: null,
    color,
    light: shade(color, 0.25),
    dark: shade(color, -0.35),
    ink: shade(color, 0.3),
    pattern: 'nessuno',
    width: 5,
    icon: null,
    spindle: 'fuso/lino',
    faded: true,
    edge: hc ? '#F3EEE4' : null,
  };
}

/** Aspetto di tutti i fili del livello (i lino entrati da un bordo anonimo si risolvono con `visualOf`). */
export function buildVisuals(level: LevelDef, characters: ReadonlyMap<CharacterId, CharacterDef>, o: VisualOptions = {}): Map<ThreadId, ThreadVisual> {
  const hc = !!o.highContrast;
  const out = new Map<ThreadId, ThreadVisual>();
  for (const t of level.threads) {
    if (o.faded?.(t.id)) {
      out.set(t.id, fadedVisual(t.id, t.kind, hc));
      continue;
    }
    const conf = o.confirmedAs?.(t.id) ?? null;
    const chId = conf ?? t.character ?? null;
    if (t.kind === 'lino' && !conf) {
      out.set(t.id, linoVisual(t.id, hc, o.cosmetic));
      continue;
    }
    if (chId) {
      out.set(t.id, characterVisual(t.id, t.kind, characters.get(chId), chId, hc));
      continue;
    }
    out.set(t.id, linoVisual(t.id, hc, o.cosmetic));
  }
  return out;
}

/** Aspetto di un filo, con i lino sintetici (`lino<N>`) e gli sconosciuti come lino. */
export function visualOf(map: Map<ThreadId, ThreadVisual>, id: ThreadId, hc = false): ThreadVisual {
  let v = map.get(id);
  if (!v) {
    v = linoVisual(id, hc, null);
    map.set(id, v);
  }
  return v;
}
