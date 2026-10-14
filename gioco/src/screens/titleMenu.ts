/**
 * Voci del menu del titolo (GDD 10.3 "Titolo", GDD 7 sblocchi; ARCHITETTURA 5.4):
 * Continua (se c'è una storia), Nuova storia, Merletto del giorno, Merletto
 * libero, Telaio (se la scena esiste), Impostazioni, Crediti; lucchetti secondo
 * `save.unlocks`. Logica pura, provata in Node.
 */
import type { SaveData } from '../core/types';

export type TitleItemId = 'continua' | 'nuova' | 'giornaliero' | 'libero' | 'telaio' | 'impostazioni' | 'crediti';

export interface TitleItem {
  id: TitleItemId;
  labelKey: string;
  icon: string;
  primary: boolean;
  locked: boolean;
  /** Didascalia sotto l'etichetta (il lucchetto, o un'informazione). */
  subKey?: string;
}

export interface TitleMenuContext {
  /** La scena 'telaio' è registrata (pacchetto campagna). */
  hasTelaio: boolean;
  /** Versione completa (sugli store: acquisto fatto; sul web sempre vero). */
  fullGame: boolean;
  /** Il Merletto del giorno di oggi è già tessuto. */
  dailyDoneToday: boolean;
}

/** Primo avvio: nessuna storia, nessuna notte, nessun merletto. */
export function isFirstLaunch(d: SaveData): boolean {
  return d.campaign === null && d.night === null && d.stats.nights === 0 && Object.keys(d.daily).length === 0 && Object.keys(d.records).length === 0;
}

function hasHistory(d: SaveData): boolean {
  const h = d.campaign?.history;
  return !!h && Object.keys(h).length > 0;
}

export function titleItems(d: SaveData, c: TitleMenuContext): TitleItem[] {
  const items: TitleItem[] = [];
  const story = d.campaign !== null;
  if (story) items.push({ id: 'continua', labelKey: 'ui.titolo.continua', icon: 'play', primary: true, locked: false });
  items.push({
    id: 'nuova',
    // Il primissimo avvio ha una scritta sola (GDD 9): «Tocca per iniziare».
    labelKey: isFirstLaunch(d) ? 'ui.titolo.inizia' : 'ui.titolo.nuova',
    icon: story ? 'matita' : 'play',
    primary: !story,
    locked: false,
  });
  const dailyLocked = !d.unlocks.daily;
  items.push({
    id: 'giornaliero',
    labelKey: 'ui.titolo.giornaliero',
    icon: 'sole',
    primary: false,
    locked: dailyLocked,
    subKey: dailyLocked ? 'ui.titolo.lucchetto.giornaliero' : c.dailyDoneToday ? 'ui.titolo.giornalieroFatto' : 'ui.titolo.giornalieroNuovo',
  });
  const liberoLocked = !d.unlocks.libero || !c.fullGame;
  items.push({
    id: 'libero',
    labelKey: 'ui.titolo.libero',
    icon: 'gomitolo',
    primary: false,
    locked: liberoLocked,
    ...(liberoLocked ? { subKey: c.fullGame ? 'ui.titolo.lucchetto.libero' : 'ui.titolo.lucchetto.completo' } : {}),
  });
  if (c.hasTelaio) {
    const telaioLocked = !hasHistory(d);
    items.push({ id: 'telaio', labelKey: 'ui.titolo.telaio', icon: 'telaio', primary: false, locked: telaioLocked, ...(telaioLocked ? { subKey: 'ui.titolo.lucchetto.telaio' } : {}) });
  }
  items.push({ id: 'impostazioni', labelKey: 'ui.titolo.impostazioni', icon: 'impostazioni', primary: false, locked: false });
  items.push({ id: 'crediti', labelKey: 'ui.titolo.crediti', icon: 'info', primary: false, locked: false });
  return items;
}
