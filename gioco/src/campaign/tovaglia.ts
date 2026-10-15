/**
 * La Tovaglia (R2-D5, GDD 7): il riconoscimento del finale vero sul Telaio. Tutti i
 * merletti della partita cuciti insieme in una tela sola, uno per giornata nell'ordine
 * della storia, che suona l'intera partita (il carillon dei titoli di coda).
 *
 * Si mostra dopo il finale vero (`unlocks.tovaglia`, o «Il merletto aperto» fra gli
 * epiloghi visti). I merletti si disegnano col disegno del PNG del tombolo
 * (`drawLaceImage`), uno alla volta, senza fermare la scena.
 */
import type { ContentDB, FlagValue, LevelId, Playing, RowMoves, SaveData, Services } from '../core/types';
import { el } from '../core/ui/dom';
import { button, textOf } from '../core/ui/components';
import { drawLaceImage, laceImageSize } from '../tombolo/index';
import { gameScore } from './score';
import { dayLabel } from './frame';
import type { CampaignStateX } from './types';

export interface TovagliaTile {
  levelId: LevelId;
  rows: RowMoves[];
  flags: Record<string, FlagValue>;
}

/** Il finale vero è stato visto: la Tovaglia c'è. */
export function hasTovaglia(d: Pick<SaveData, 'unlocks' | 'campaign'>): boolean {
  const c = d.campaign as CampaignStateX | null;
  return d.unlocks.tovaglia === true || !!c?.endingsSeen?.includes('aperto');
}

/** I merletti della Tovaglia: le giornate tessute, poi il finale, nell'ordine della storia. */
export function tovagliaTiles(c: CampaignStateX, db: Pick<ContentDB, 'campaign' | 'levels'>): TovagliaTile[] {
  const ids = [...db.campaign.days.map((d) => d.id), ...Object.values(db.campaign.finals)];
  const out: TovagliaTile[] = [];
  for (const id of ids) {
    const h = c.history[id];
    if (!h || h.rows.length === 0 || !db.levels.get(id)) continue;
    out.push({ levelId: id, rows: h.rows, flags: { ...(c.snapshots[id]?.flags ?? c.flags) } });
  }
  return out;
}

const TILE_W = 84;
const TILE_H = 132;

/** Un merletto della Tovaglia in un riquadro (disegnato dopo, con `paint`). */
function tileCanvas(): HTMLCanvasElement {
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const cv = el('canvas', { class: 'cp-tovaglia-merletto', attrs: { 'aria-hidden': 'true' } });
  cv.width = Math.round(TILE_W * dpr);
  cv.height = Math.round(TILE_H * dpr);
  cv.style.width = `${TILE_W}px`;
  cv.style.height = `${TILE_H}px`;
  return cv;
}

function paint(s: Services, cv: HTMLCanvasElement, t: TovagliaTile): void {
  const level = s.content.levels.get(t.levelId);
  const ctx = cv.getContext('2d');
  if (!level || !ctx) return;
  const { w, h } = laceImageSize(level);
  const k = Math.min(cv.width / w, cv.height / h);
  ctx.setTransform(k, 0, 0, k, (cv.width - w * k) / 2, (cv.height - h * k) / 2);
  try {
    drawLaceImage(ctx, level, t.rows, undefined, t.flags);
  } catch (err) {
    console.warn('[campaign] tovaglia tile failed', t.levelId, err);
  }
}

/**
 * La sezione della Tovaglia nel Telaio (`cp-tovaglia`): titolo, una riga che dice che cos'è,
 * la tela dei merletti (`cp-tovaglia-tela`) e «Ascolta la Tovaglia» (`cp-tovaglia-ascolta`).
 * Restituisce l'elemento e la funzione che ferma disegno e carillon.
 */
export function tovagliaSection(s: Services, c: CampaignStateX): { el: HTMLElement; stop: () => void } {
  const tiles = tovagliaTiles(c, s.content);
  const cloth = el('div', { class: 'cp-tovaglia-tela', test: 'cp-tovaglia-tela', role: 'img', attrs: { 'aria-label': s.i18n.t('campaign.telaio.tovagliaTela', { n: tiles.length }) } });
  const canvases = tiles.map((t) => {
    const cv = tileCanvas();
    const lab = dayLabel(s.content, t.levelId);
    cv.title = s.i18n.t(lab.key, lab.params);
    cv.dataset.giornata = t.levelId;
    cloth.appendChild(cv);
    return cv;
  });
  let carillon: Playing | null = null;
  const listen = button({
    labelKey: 'campaign.telaio.tovagliaAscolta',
    icon: 'nota',
    kind: 'secondario',
    disabled: tiles.length === 0,
    onClick: () => {
      try {
        carillon?.stop();
        carillon = s.audio.carillon(gameScore(c.history, s.content, s.content.balance.anim.beatMs));
      } catch {
        carillon = null;
      }
    },
    test: 'cp-tovaglia-ascolta',
  });
  const box = el(
    'section',
    { class: 'cp-tovaglia', test: 'cp-tovaglia' },
    el('h2', { class: 'cp-tovaglia-titolo' }, textOf('campaign.telaio.tovaglia', undefined, 'span')),
    textOf('campaign.telaio.tovagliaIntro', undefined, 'p', { className: 'cp-tovaglia-intro' }),
    cloth,
    el('div', { class: 'cp-tovaglia-azioni' }, listen),
  );
  // Un merletto per volta: la scena resta pronta ai tocchi.
  let i = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const next = (): void => {
    timer = null;
    const t = tiles[i];
    const cv = canvases[i];
    if (!t || !cv || !box.isConnected) return;
    paint(s, cv, t);
    i++;
    if (i < tiles.length) timer = setTimeout(next, 0);
  };
  timer = setTimeout(next, 0);
  return {
    el: box,
    stop: () => {
      if (timer) clearTimeout(timer);
      timer = null;
      try {
        carillon?.stop();
      } catch {
        /* già fermo */
      }
      carillon = null;
    },
  };
}
