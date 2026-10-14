/**
 * Didascalie dei suoni (GDD 13.6, 14; ARCHITETTURA 11). Ogni suono significativo emette
 * `audio:caption` con una chiave del namespace `audio` (it ed en); il core la mostra in
 * basso a sinistra se l'impostazione è attiva. Le didascalie partono anche ad audio
 * spento o bloccato: servono proprio a chi non sente.
 *
 * Non hanno didascalia i suoni che accompagnano un gesto già visibile (prendere e
 * lasciare un fuso, l'incrocio normale, rovesciare, disfare, i tocchi dei pulsanti).
 */
import type { AmbienceId, CharacterId, SfxId } from '../core/types';

export const CAPTION_NS = 'audio.didascalie';

export function captionKey(name: string): string {
  return `${CAPTION_NS}.${name}`;
}

/** Didascalia di ogni effetto suonato con sfx() (null = nessuna). */
export const SFX_CAPTIONS: Readonly<Record<SfxId, string | null>> = {
  fuso_presa: null,
  fuso_rilascio: null,
  incrocio: null,
  rovescia: null,
  lettera: captionKey('lettera'),
  voce: captionKey('voce'),
  segreto: captionKey('segreto'),
  febbre: captionKey('febbre'),
  cura: captionKey('cura'),
  nodo: captionKey('nodo'),
  rifiuto: captionKey('rifiuto'),
  disfa: null,
  ora_fissata: null,
  vaporetto: captionKey('vaporetto'),
  barca: captionKey('barca'),
  gabbiano: captionKey('gabbiano'),
  pagina: captionKey('pagina'),
  bottiglia: captionKey('bottiglia'),
  carta: captionKey('carta'),
  successo: captionKey('successo'),
  fallimento: captionKey('fallimento'),
  trabocco: captionKey('trabocco'),
  marea: captionKey('marea'),
  nero: captionKey('nero'),
  ui_tap: null,
  ui_indietro: null,
};

/** Didascalie degli ambienti (al cambio). */
export const AMBIENCE_CAPTIONS: Readonly<Record<AmbienceId, string | null>> = {
  silenzio: null,
  laguna: captionKey('ambiente.laguna'),
  notte: captionKey('ambiente.notte'),
  pioggia: captionKey('ambiente.pioggia'),
  vento: captionKey('ambiente.vento'),
  tempesta: captionKey('ambiente.tempesta'),
};

/** Didascalie con parametri, usate dal motore e dai suoni automatici. */
export const CAPTIONS = {
  campana: captionKey('campana'), // {ora}
  campanaStonata: captionKey('campanaStonata'), // {ora}
  incrocioRancore: captionKey('incrocioRancore'), // {sopra} {sotto}
  letteraA: captionKey('letteraA'), // {nome}
  consegna: captionKey('consegna'), // {nome}
  voceA: captionKey('voceA'), // {nome}
  nomeA: captionKey('nomeA'), // {nome}
  segretoA: captionKey('segretoA'), // {nome}
  legge: captionKey('legge'), // {nome}
  febbreA: captionKey('febbreA'), // {nome}
  curaA: captionKey('curaA'), // {nome}
  nodoTra: captionKey('nodoTra'), // {a} {b}
  tonfo: captionKey('tonfo'),
  traboccoDi: captionKey('traboccoDi'), // {nome}
  borbottio: captionKey('borbottio'), // {nome} {carattere}
  penna: captionKey('penna'),
  carillon: captionKey('carillon'),
  tuono: captionKey('tuono'),
  notteFerma: captionKey('ambiente.notteFerma'),
} as const;

/** Tutte le chiavi di didascalia che il pacchetto può emettere (per i test). */
export const ALL_CAPTION_KEYS: readonly string[] = [
  ...new Set(
    [...Object.values(SFX_CAPTIONS), ...Object.values(AMBIENCE_CAPTIONS), ...Object.values(CAPTIONS)].filter(
      (k): k is string => typeof k === 'string',
    ),
  ),
].sort();

/** Chiavi del carattere della voce, una per personaggio ('altro' di riserva). */
export function characterStyleKey(who: CharacterId): string {
  return `audio.carattere.${who}`;
}

/** Nome breve di riserva di un personaggio (se i contenuti non ci sono). */
export function shortNameKey(who: CharacterId | 'lino'): string {
  return `audio.chi.${who}`;
}

export interface CaptionRecord {
  textKey: string;
  params?: Record<string, string | number>;
  t: number;
}

/**
 * Emettitore con un filtro anti-ripetizione: la stessa didascalia (chiave e parametri)
 * non riparte prima di `windowMs`.
 */
export class Captioner {
  private readonly last = new Map<string, number>();
  private readonly recent: CaptionRecord[] = [];

  constructor(
    private readonly emit: (textKey: string, params?: Record<string, string | number>) => void,
    private readonly now: () => number,
    private readonly windowMs = 1200,
  ) {}

  say(textKey: string | null | undefined, params?: Record<string, string | number>): boolean {
    if (!textKey) return false;
    const id = params ? `${textKey}|${JSON.stringify(params)}` : textKey;
    const t = this.now();
    const prev = this.last.get(id);
    if (prev !== undefined && t - prev < this.windowMs) return false;
    this.last.set(id, t);
    if (this.last.size > 64) {
      for (const [k, v] of this.last) if (t - v >= this.windowMs) this.last.delete(k);
    }
    const rec: CaptionRecord = params ? { textKey, params, t } : { textKey, t };
    this.recent.push(rec);
    if (this.recent.length > 50) this.recent.shift();
    try {
      this.emit(textKey, params);
    } catch (err) {
      console.error('[audio] caption failed', err);
    }
    return true;
  }

  /** Ultime didascalie emesse (debug e test). */
  history(): CaptionRecord[] {
    return this.recent.slice();
  }
}
