/**
 * Fusi intagliati (GDD 7): solo estetici, cambiano il fuso di Ada nel titolo e
 * i fusi dei lino nel tombolo (`unlocks.selectedCosmetic`, letto dal titolo e
 * dal tombolo). Sei stili, `stile_1` … `stile_6` nell'ordine del GDD (liscio, a
 * spirale, a pigna, col faro, con la barca, d'avorio):
 *
 * - `stile_1` … `stile_4` arrivano con i fili d'oro (li assegna la campagna);
 * - `stile_5` con 7 Merletti del giorno di fila, `stile_6` con 30 giorni tessuti
 *   in tutto (li assegnano le schermate, a fine Merletto del giorno).
 *
 * Si possono scegliere solo gli stili sbloccati che hanno il loro disegno fra
 * gli asset (gli altri arriveranno con il livello L2).
 */
import type { SaveData, Services } from '../core/types';

export const COSMETIC_IDS = ['stile_1', 'stile_2', 'stile_3', 'stile_4', 'stile_5', 'stile_6'] as const;
export type CosmeticId = (typeof COSMETIC_IDS)[number];

/** Fusi del Merletto del giorno (GDD 7). */
export const DAILY_STREAK_COSMETIC: CosmeticId = 'stile_5';
export const DAILY_STREAK_DAYS = 7;
export const DAILY_TOTAL_COSMETIC: CosmeticId = 'stile_6';
export const DAILY_TOTAL_DAYS = 30;

export function isCosmeticId(id: string): id is CosmeticId {
  return (COSMETIC_IDS as readonly string[]).includes(id);
}

/** Nome (chiave) di uno stile. */
export function cosmeticNameKey(id: string): string {
  return isCosmeticId(id) ? `ui.impostazioni.fuso.${id}` : 'ui.impostazioni.fuso.ada';
}

/**
 * Sblocchi del Merletto del giorno dopo un giorno tessuto (dati già aggiornati:
 * serie e giorni). Modifica `unlocks.cosmetics`; restituisce gli stili nuovi.
 */
export function dailyCosmetics(d: Pick<SaveData, 'unlocks' | 'stats' | 'daily'>): CosmeticId[] {
  const out: CosmeticId[] = [];
  const add = (id: CosmeticId): void => {
    if (d.unlocks.cosmetics.includes(id)) return;
    d.unlocks.cosmetics.push(id);
    out.push(id);
  };
  if (d.stats.dailyStreak >= DAILY_STREAK_DAYS) add(DAILY_STREAK_COSMETIC);
  if (Object.keys(d.daily).length >= DAILY_TOTAL_DAYS) add(DAILY_TOTAL_COSMETIC);
  return out;
}

/** Lo stile ha il suo disegno fra gli asset? */
export function hasCosmeticArt(s: Partial<Pick<Services, 'assets'>>, id: string): boolean {
  try {
    return !!s.assets && s.assets.has(`fuso/${id}`);
  } catch {
    return false;
  }
}

/** Stili sbloccati e disegnati, in ordine. */
export function availableCosmetics(s: Pick<Services, 'save'> & Partial<Pick<Services, 'assets'>>): CosmeticId[] {
  const owned = s.save.data().unlocks.cosmetics;
  return COSMETIC_IDS.filter((id) => owned.includes(id) && hasCosmeticArt(s, id));
}

/** Sceglie lo stile (null = il fuso di Ada). */
export function selectCosmetic(s: Pick<Services, 'save'>, id: CosmeticId | null): void {
  s.save.update(
    (d) => {
      if (id && d.unlocks.cosmetics.includes(id)) d.unlocks.selectedCosmetic = id;
      else delete d.unlocks.selectedCosmetic;
    },
    { immediate: true, reason: 'fuso' },
  );
}

/** Piccola anteprima del fuso (canvas), dal suo frame nell'atlas. */
export function spindlePreview(s: Partial<Pick<Services, 'assets'>>, frameName: string, h = 48): HTMLCanvasElement | null {
  if (!s.assets || typeof document === 'undefined') return null;
  try {
    const f = s.assets.frame(frameName);
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const w = Math.max(8, Math.round((f.sw / Math.max(1, f.sh)) * h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    c.className = 'sc-fuso-anteprima';
    c.setAttribute('aria-hidden', 'true');
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(f.source, f.sx, f.sy, f.sw, f.sh, 0, 0, c.width, c.height);
    return c;
  } catch {
    return null;
  }
}
