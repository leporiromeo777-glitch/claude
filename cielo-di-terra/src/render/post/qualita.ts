/**
 * Livelli di qualità grafica: Bassa, Media, Alta e la scelta «Automatica», che parte da una stima
 * (il nome della scheda grafica) e misura i primi secondi di gioco: se il fotogramma è lento scende
 * di un livello e misura di nuovo (al massimo due volte), poi smette.
 *
 * Tutto qui è logica pura (nessun WebGL): si prova con i test unitari.
 */

export type LivelloQualita = 'bassa' | 'media' | 'alta';
export type SceltaQualita = LivelloQualita | 'automatica';

export const LIVELLI: readonly LivelloQualita[] = ['bassa', 'media', 'alta'];
export const SCELTE_QUALITA: readonly SceltaQualita[] = ['automatica', 'bassa', 'media', 'alta'];

export type FiltroPittorico = 'nessuno' | 'generalizzato' | 'anisotropico';

/** Che cosa accende ogni livello. */
export interface PresetQualita {
  livello: LivelloQualita;
  /** Rapporto pixel/CSS massimo per il disegno del mondo (il canvas resta nitido fino a 2). */
  maxPixelRatio: number;
  /** Risoluzione interna del mondo rispetto a quel rapporto (1 = piena). */
  scala: number;
  /** Campioni MSAA del mondo (0 = spento). */
  msaa: number;
  /** Livelli della catena del bagliore (0 = spento). */
  bloom: number;
  /** Filtro pittorico (Kuwahara). */
  filtro: FiltroPittorico;
  /** Raggio del filtro in pixel a 1080p (scala con l'altezza dell'immagine). */
  raggio: number;
  /**
   * Filtro a metà risoluzione (un quarto dei pixel, raggio dimezzato: circa 16 volte meno lavoro),
   * poi riportato a piena risoluzione seguendo i bordi del colore originale.
   */
  mezzaRisoluzione: boolean;
  /** Contorni morbidi dalla profondità. */
  contorni: boolean;
  /** Pennellata orientata e grana fine della carta. */
  pennellata: boolean;
  /** Antialiasing di ripiego nel passaggio finale (quando non c'è né MSAA né filtro). */
  fxaa: boolean;
  /** Ombre portate (le accende la traccia «luce»: vedi `Game.onQualita`). */
  ombre: boolean;
}

export const PRESET_QUALITA: Readonly<Record<LivelloQualita, PresetQualita>> = {
  bassa: { livello: 'bassa', maxPixelRatio: 1, scala: 0.7, msaa: 0, bloom: 3, filtro: 'nessuno', raggio: 0, mezzaRisoluzione: false, contorni: false, pennellata: false, fxaa: true, ombre: false },
  media: { livello: 'media', maxPixelRatio: 1, scala: 1, msaa: 0, bloom: 5, filtro: 'generalizzato', raggio: 4, mezzaRisoluzione: true, contorni: true, pennellata: true, fxaa: false, ombre: true },
  alta: { livello: 'alta', maxPixelRatio: 1.25, scala: 1, msaa: 2, bloom: 6, filtro: 'anisotropico', raggio: 4, mezzaRisoluzione: false, contorni: true, pennellata: true, fxaa: false, ombre: true },
};

export function isLivello(x: unknown): x is LivelloQualita {
  return x === 'bassa' || x === 'media' || x === 'alta';
}

export function isSceltaQualita(x: unknown): x is SceltaQualita {
  return x === 'automatica' || isLivello(x);
}

/** Un livello più in basso (o lo stesso se già al minimo). */
export function livelloSotto(l: LivelloQualita): LivelloQualita {
  return l === 'alta' ? 'media' : 'bassa';
}

/**
 * Prima stima dal nome della scheda grafica (WEBGL_debug_renderer_info): schede dedicate e
 * Apple M → Alta; rasterizzatori software e integrate vecchie → Bassa; il resto (Iris Xe,
 * Radeon integrate, nomi nascosti) → Media.
 */
export function stimaIniziale(renderer: string): LivelloQualita {
  const r = renderer.toLowerCase();
  if (/swiftshader|llvmpipe|softpipe|software|basic render|mali-[4t]|adreno \(tm\) [1-5]\d\d\b|powervr|intel.*hd graphics [2-5]\d{3}\b/.test(r)) return 'bassa';
  if (/nvidia|geforce|quadro|rtx|gtx|radeon (rx|pro|vii)|radeon\(tm\) rx|arc\(tm\) a|intel.*arc|apple m[1-9]|apple gpu/.test(r)) return 'alta';
  return 'media';
}

export interface OpzioniMisura {
  /** Secondi da scartare all'inizio (compilazione delle shader, caricamenti). */
  riscaldamento: number;
  /** Secondi di campioni per decidere. */
  finestra: number;
  /** Sopra questo tempo per fotogramma (s, mediana) si scende di livello. */
  soglia: number;
  /** Quante volte al massimo si scende. */
  maxCambi: number;
}

export const MISURA_PREDEFINITA: OpzioniMisura = { riscaldamento: 1.5, finestra: 2.5, soglia: 1 / 44, maxCambi: 2 };

/**
 * Misura dei primi secondi per la qualità automatica. Si chiama `campione(dt, costo)` a ogni
 * fotogramma: `dt` è il tempo reale trascorso (fa avanzare il riscaldamento e la finestra),
 * `costo` quello da giudicare (il tempo GPU se c'è, altrimenti `dt`). Restituisce il nuovo livello
 * quando decide di scendere, altrimenti null. Fotogrammi lunghi più di 0,25 s (scheda nascosta,
 * pausa del debugger) non contano.
 */
export class MisuraQualita {
  private t = 0;
  private campioni: number[] = [];
  private cambi = 0;
  finita = false;

  constructor(
    public livello: LivelloQualita,
    private readonly opz: OpzioniMisura = MISURA_PREDEFINITA,
  ) {}

  campione(dt: number, costo: number = dt): LivelloQualita | null {
    if (this.finita || !(dt > 0) || dt > 0.25 || !(costo >= 0)) return null;
    this.t += dt;
    if (this.t < this.opz.riscaldamento) return null;
    this.campioni.push(costo);
    const raccolto = this.t - this.opz.riscaldamento;
    if (raccolto < this.opz.finestra || this.campioni.length < 20) return null;
    const m = mediana(this.campioni);
    this.campioni = [];
    this.t = 0;
    if (m > this.opz.soglia && this.livello !== 'bassa' && this.cambi < this.opz.maxCambi) {
      this.cambi++;
      this.livello = livelloSotto(this.livello);
      // più in basso non si può andare: niente altre misure
      if (this.livello === 'bassa' || this.cambi >= this.opz.maxCambi) this.finita = true;
      return this.livello;
    }
    this.finita = true;
    return null;
  }
}

export function mediana(v: readonly number[]): number {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  const k = s.length >> 1;
  return s.length % 2 ? s[k]! : (s[k - 1]! + s[k]!) / 2;
}
