/**
 * Il tocco spiega (D06, TOM-12): un tocco (o il passaggio del mouse) su uno
 * spillo, una barca o un bordo, una perlina, un'etichetta d'ora o l'incrocio
 * annunciato del filo nero apre una bolla (`tb-bolla`) che si chiude al tocco
 * successivo. Qui c'è la geometria (dove stanno le cose disegnate, la stessa del
 * renderer) e il testo di ogni bolla.
 */
import type { AcceptedRequest, Condition, LevelDef, OccasionDef, ThreadId } from '../../core/types';
import { el } from '../../core/ui/dom';
import type { Rect, TomboloLayout } from '../layout';
import { SLOT_R, rowBottom, rowTop, slotCenter } from '../layout';
import type { LaceModel } from '../render/model';
import { edgeX } from '../render/lace';
import type { SpindleRig } from '../render/spindles';
import type { Session } from '../session';
import { type TextDeps, beadName, capitalizeFirst, formatHour, joinNames, nameParams, threadName } from '../text';

/** Raggio del bersaglio di un tocco su spilli, barche e perline (px CSS). */
export const BUBBLE_HIT = 14;

export type BubbleTarget =
  | { k: 'spillo'; kind: 'ottone' | 'rosso' | 'verde'; col: number; index: number; x: number; y: number }
  | { k: 'bordo'; index: number; side: -1 | 1; kind: string; x: number; y: number }
  | { k: 'perlina'; thread: ThreadId; bead: string; delivered: boolean; x: number; y: number }
  | { k: 'ora'; index: number; x: number; y: number }
  | { k: 'nero'; pair: number; x: number; y: number };

export interface BubbleScene {
  layout: TomboloLayout;
  model: LaceModel;
  scroll: number;
  rig: SpindleRig;
  /** La riga corrente è in anteprima di riavvolgimento: le perline non si vedono. */
  previewing: boolean;
}

/** Centro della testa di uno spillo (come in render/pins.ts). */
export function pinHead(l: TomboloLayout, scroll: number, col: number, index: number): { x: number; y: number } {
  const x = (l.colCx[col] ?? 0) + 9;
  const y = l.lace.y - scroll + rowBottom(l, index) - 11;
  return { x, y };
}

/** Centro dell'icona di un evento di bordo (come in render/lace.ts). */
export function edgeCenter(l: TomboloLayout, scroll: number, index: number, side: number): { x: number; y: number } {
  return { x: edgeX(l, side), y: l.lace.y - scroll + rowBottom(l, index) - l.rowH * 0.25 };
}

/** Posizioni delle perline delle pile (come `drawStacks` in render/lace.ts). */
export function beadSpots(sc: BubbleScene): { thread: ThreadId; bead: string; delivered: boolean; x: number; y: number }[] {
  const { layout: l, model: m, scroll, rig } = sc;
  if (sc.previewing) return [];
  const top = l.lace.y - scroll;
  const hangTop = Math.min(Math.max(top + rowBottom(l, m.done ? m.rows : m.current), l.lace.y), l.lace.y + l.lace.h);
  const y0 = hangTop + 14;
  const out: { thread: ThreadId; bead: string; delivered: boolean; x: number; y: number }[] = [];
  for (const st of m.stacks) {
    const s = rig.get(st.thread);
    const x0 = l.colCx[st.col] ?? 0;
    const x1 = s ? rig.xOf(s) : x0;
    let y = y0;
    for (let k = 0; k < st.beads.length && k < 5; k++) {
      const b = st.beads[k];
      if (!b) continue;
      const f = Math.min(1, (y - y0) / Math.max(1, l.spindles.y - y0));
      out.push({ thread: st.thread, bead: b.id, delivered: b.delivered, x: x0 + (x1 - x0) * f * f, y });
      y += 16;
    }
  }
  return out;
}

/** Riga (indice) sotto una y nel merletto, o −1. */
function rowUnder(l: TomboloLayout, scroll: number, y: number): number {
  if (y < l.lace.y || y >= l.lace.y + l.lace.h) return -1;
  const cy = y - l.lace.y + scroll;
  if (cy < 0) return -1;
  if (cy < l.openH) return 0;
  const i = Math.floor((cy - l.openH) / l.rowH) + 1;
  return i >= 1 && i <= l.rows ? i : -1;
}

/** Che cosa c'è da spiegare sotto un punto dello schermo (null: niente). */
export function bubbleTargetAt(sc: BubbleScene, x: number, y: number): BubbleTarget | null {
  const { layout: l, model: m, scroll } = sc;
  const near = (ax: number, ay: number, r = BUBBLE_HIT): boolean => (x - ax) * (x - ax) + (y - ay) * (y - ay) <= r * r;
  // Perline (sotto la riga corrente, sui fili che pendono).
  for (const b of beadSpots(sc)) if (near(b.x, b.y, 10)) return { k: 'perlina', thread: b.thread, bead: b.bead, delivered: b.delivered, x: b.x, y: b.y };
  const inLace = y >= l.lace.y && y < l.lace.y + l.lace.h;
  if (!inLace) return null;
  // Spilli (anche nelle righe future).
  for (const p of m.pins) {
    // Le occasioni (anche quelle da piantare) al centro della cella, gli spilli sulla testa.
    const h = p.kind === 'verde' ? slotCenter(l, scroll, p.col, p.index) : pinHead(l, scroll, p.col, p.index);
    if (near(h.x, h.y, p.kind === 'verde' ? SLOT_R + 3 : BUBBLE_HIT)) return { k: 'spillo', kind: p.kind, col: p.col, index: p.index, x: h.x, y: h.y };
  }
  // Barche, bordi, ingresso del filo nero.
  for (const e of m.edges) {
    const c = edgeCenter(l, scroll, e.index, e.side);
    if (near(c.x, c.y)) return { k: 'bordo', index: e.index, side: e.side, kind: e.kind, x: c.x, y: c.y };
  }
  const i = rowUnder(l, scroll, y);
  if (i < 0) return null;
  // Incrocio annunciato del filo nero nella riga corrente.
  if (i === m.current && m.liveShape) {
    for (const c of m.liveShape.crossings) {
      if (!c.ghost) continue;
      const cx = ((l.colCx[c.pair] ?? 0) + (l.colCx[c.pair + 1] ?? 0)) / 2;
      const cy = l.lace.y - scroll + (rowTop(l, i) + rowBottom(l, i)) / 2;
      if (Math.abs(x - cx) <= l.colW * 0.5 && Math.abs(y - cy) <= l.rowH * 0.5) return { k: 'nero', pair: c.pair, x: cx, y: cy };
    }
  }
  // Etichetta dell'ora (colonna a sinistra del merletto).
  const x0 = l.colX[0] ?? l.center.x;
  if (x >= l.center.x && x < x0 - 2) {
    const cy = l.lace.y - scroll + (i === 0 ? (rowTop(l, 0) + rowBottom(l, 0)) / 2 : rowBottom(l, i) - Math.min(10, l.rowH * 0.22));
    return { k: 'ora', index: i, x: l.gutterCx, y: cy };
  }
  return null;
}

export interface BubbleTextDeps {
  text: TextDeps;
  level: LevelDef;
  session: Session;
  accepted: readonly AcceptedRequest[];
  occasions: readonly OccasionDef[];
  locale: string;
}

/** Testo della bolla di un bersaglio. */
export function bubbleText(d: BubbleTextDeps, t: BubbleTarget): string {
  const td = d.text;
  const i18n = td.i18n;
  const lv = d.level;
  const start = lv.startHour;
  const P = (p: Record<string, string | number>): Record<string, string | number> => nameParams(td, p);
  let out = '';
  switch (t.k) {
    case 'spillo': {
      const hour = start + t.index;
      const place = lv.columns[t.col] ?? 'molo';
      if (t.kind === 'verde') {
        const o =
          d.occasions.find((x) => x.place === place && x.hour === hour) ??
          (lv.autoweave?.presetOccasions ?? []).find((x) => x.place === place && x.hour === hour) ??
          (lv.autoweave?.allowedOccasions ?? []).find((x) => x.place === place && x.hour === hour);
        out = i18n.t('tombolo.bolla.occasione', { ...P({ luogo: place, ora: hour }), tipo: i18n.t(`tombolo.occasione.${o?.kind ?? 'festa'}`) });
        break;
      }
      if (t.kind === 'rosso') {
        for (const a of d.accepted) {
          const who = presso(a.request).find((c) => c.place === place && c.hour === hour);
          if (!who) continue;
          const ch = td.content.characters.get(a.authorGuess ?? a.author);
          out = i18n.t('tombolo.bolla.spilloRosso', { ...P({ chi: who.who, luogo: place, ora: hour }), autore: ch ? i18n.t(ch.nameKey) : a.author });
          break;
        }
        break;
      }
      const pin = lv.pins.find((p) => p.place === place && p.hour === hour);
      if (pin) out = i18n.t('tombolo.bolla.spillo', P({ chi: pin.thread, luogo: place, ora: hour }));
      else {
        // Spillo d'ottone di un obiettivo (presso, o parte all'ora di una barca).
        const who = goalWho(lv, d.session.params.goals, place, hour);
        out = i18n.t('tombolo.bolla.spilloObiettivo', P({ chi: who ?? '', luogo: place, ora: hour }));
      }
      break;
    }
    case 'bordo': {
      const hour = start + t.index;
      out = edgeSentence(d, hour, t.side, t.kind);
      break;
    }
    case 'perlina': {
      const key = t.delivered ? 'tombolo.bolla.perlinaConsegnata' : 'tombolo.bolla.perlina';
      out = i18n.t(key, { perlina: beadName(td, t.bead), chi: threadName(td, t.thread) });
      break;
    }
    case 'ora': {
      const hour = start + t.index;
      const parts = hourEvents(d, hour);
      out = parts.length > 0 ? i18n.t('tombolo.bolla.ora', { ora: formatHour(td, hour), eventi: joinNames(td, parts) }) : i18n.t('tombolo.bolla.oraVuota', { ora: formatHour(td, hour) });
      break;
    }
    case 'nero': {
      const s = d.session;
      const L = s.state.pos[t.pair] ?? '';
      const R = s.state.pos[t.pair + 1] ?? '';
      const neroId = lv.nero?.thread ?? '';
      const other = L === neroId ? R : L;
      out = i18n.t('tombolo.bolla.nero', P({ chi: other, nero: neroId || L }));
      break;
    }
  }
  return capitalizeFirst(out, d.locale);
}

function presso(c: Condition, out: { who: ThreadId; place: string; hour: number }[] = []): { who: ThreadId; place: string; hour: number }[] {
  if (c.t === 'presso') out.push({ who: c.who, place: c.place, hour: c.hour });
  else if (c.t === 'tutti' || c.t === 'almeno') for (const x of c.of) presso(x, out);
  return out;
}

function goalWho(level: LevelDef, goals: readonly Condition[], place: string, hour: number): ThreadId | null {
  for (const g of goals) {
    const walk = (c: Condition): ThreadId | null => {
      if (c.t === 'presso' && c.place === place && c.hour === hour) return c.who;
      if (c.t === 'parte' && c.hour === hour) return c.who;
      if (c.t === 'tutti') for (const x of c.of) {
        const w = walk(x);
        if (w) return w;
      }
      return null;
    };
    const w = walk(g);
    if (w) return w;
  }
  void level;
  return null;
}

/** «Alle 8 il vaporetto: chi è al Molo esce. Entra il marinaio con la lettera per Nina.» */
function edgeSentence(d: BubbleTextDeps, hour: number, side: number, kind: string): string {
  const td = d.text;
  const i18n = td.i18n;
  const lv = d.level;
  const place = side < 0 ? lv.columns[0] : lv.columns[lv.columns.length - 1];
  const base = nameParams(td, { ora: hour, luogo: place ?? 'molo' });
  if (kind === 'nero') return i18n.t('tombolo.bolla.bordo.nero', base);
  const k = kind === 'vaporetto' || kind === 'barca' || kind === 'secca' ? kind : 'barca';
  let s = i18n.t(`tombolo.bolla.bordo.${k}`, base);
  const e = (lv.edges ?? []).find((x) => x.hour === hour && (x.side === 'molo' ? -1 : 1) === side);
  if (e?.enters) {
    const carried = lv.beads.filter((b) => b.holder === e.enters || (b.holders ?? []).includes(e.enters as string)).map((b) => beadName(td, b.id));
    const chi = threadName(td, e.enters);
    s += ' ' + capitalizeFirst(carried.length > 0 ? i18n.t('tombolo.bolla.entraCon', { chi, perline: joinNames(td, carried) }) : i18n.t('tombolo.bolla.entra', { chi }), d.locale);
  }
  return s;
}

/** Che cosa succede a un'ora (bolla dell'etichetta d'ora). */
function hourEvents(d: BubbleTextDeps, hour: number): string[] {
  const td = d.text;
  const i18n = td.i18n;
  const lv = d.level;
  const out: string[] = [];
  for (const e of lv.edges ?? []) {
    if (e.hour !== hour) continue;
    const place = e.side === 'molo' ? lv.columns[0] : lv.columns[lv.columns.length - 1];
    out.push(i18n.t(`tombolo.bolla.evento.${e.kind}`, nameParams(td, { luogo: place ?? 'molo' })));
  }
  if (lv.nero && lv.nero.enter.hour === hour) out.push(i18n.t('tombolo.bolla.evento.nero', {}));
  for (const p of lv.pins) if (p.hour === hour) out.push(i18n.t('tombolo.bolla.evento.spillo', nameParams(td, { chi: p.thread, luogo: p.place })));
  for (const t of lv.tide ?? []) {
    const luoghi = joinNames(td, t.places.map((p) => i18n.t(`tombolo.presso.${p}`)));
    if (t.from === hour) out.push(i18n.t('tombolo.bolla.evento.marea', { luoghi }));
    if (t.to === hour) out.push(i18n.t('tombolo.bolla.evento.mareaFine', { luoghi }));
  }
  return out;
}

/** Bolla del tocco: non prende i tocchi, si chiude al tocco successivo. */
export class Bubble {
  readonly el: HTMLElement;
  private readonly text: HTMLElement;
  current = '';

  constructor() {
    this.text = el('span', { class: 'tb-bolla-testo' });
    this.el = el('div', { class: 'tb-bolla', role: 'tooltip', test: 'tb-bolla', hidden: true }, this.text);
  }

  /** Mostra la bolla sopra il punto (x, y), dentro `bounds`. */
  show(text: string, x: number, y: number, bounds: Rect): void {
    this.current = text;
    this.text.textContent = text;
    this.el.hidden = false;
    const w = Math.min(280, bounds.w - 16);
    this.el.style.width = 'auto';
    this.el.style.maxWidth = `${w}px`;
    const bw = Math.min(w, this.el.offsetWidth || w);
    const bh = this.el.offsetHeight || 40;
    const left = Math.max(bounds.x + 8, Math.min(bounds.x + bounds.w - bw - 8, x - bw / 2));
    const above = y - bh - 14;
    const top = above >= bounds.y + 4 ? above : y + 16;
    this.el.style.left = `${Math.round(left)}px`;
    this.el.style.top = `${Math.round(top)}px`;
    this.el.dataset.posto = above >= bounds.y + 4 ? 'sopra' : 'sotto';
  }

  visible(): boolean {
    return !this.el.hidden;
  }

  hide(): void {
    this.current = '';
    this.el.hidden = true;
  }
}
