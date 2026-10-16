/**
 * Livelli di qualità grafica: Bassa, Media, Alta e la scelta «Automatica», che parte da una stima
 * (il nome della scheda grafica) e misura i primi secondi di gioco: se il fotogramma è lento scende
 * di un gradino e misura di nuovo (al massimo tre volte). Poi, per i primi dieci minuti, una
 * sorveglianza lenta e solo verso il basso: una finestra di 5 s ogni 60 s, e se la mediana del costo
 * misurato supera ~1/58 s scende ancora di un gradino.
 *
 * Gradini dell'automatica (rifinitura 2): Alta → Media → **Media ridotta** (lo stesso preset di Media
 * con il mondo all'80% dei pixel: filtro, contorni e ombre restano) → Bassa. «Media ridotta» non è
 * una scelta del giocatore: il suo `livello` resta 'media' (interfaccia, paese, personaggi la
 * trattano come Media).
 *
 * Tutto qui è logica pura (nessun WebGL): si prova con i test unitari.
 */

export type LivelloQualita = 'bassa' | 'media' | 'alta';
export type SceltaQualita = LivelloQualita | 'automatica';
/** I gradini della qualità automatica: i tre livelli più «Media ridotta» fra Media e Bassa. */
export type GradinoQualita = LivelloQualita | 'mediaRidotta';

export const LIVELLI: readonly LivelloQualita[] = ['bassa', 'media', 'alta'];
export const SCELTE_QUALITA: readonly SceltaQualita[] = ['automatica', 'bassa', 'media', 'alta'];

export type FiltroPittorico = 'nessuno' | 'generalizzato' | 'anisotropico';

/**
 * Livello delle ombre portate della traccia «luce» per ogni qualità: gli stessi nomi di
 * `QualitaOmbre` in render/ombre.ts, così `luce.ombre.impostaQualita(preset.ombre)` basta.
 */
export type LivelloOmbre = 'spente' | 'bassa' | 'media' | 'alta';

/** Che cosa accende ogni livello. */
export interface PresetQualita {
  livello: LivelloQualita;
  /** Rapporto pixel/CSS massimo per il disegno del mondo. */
  maxPixelRatio: number;
  /**
   * Rapporto pixel/CSS massimo del canvas, cioè della passata finale (FXAA, grana, vignettatura,
   * toni). L'interfaccia HTML resta nitida da sola. Rifinitura 2: a Bassa su uno schermo Retina la
   * passata finale lavorava su otto volte i pixel del mondo.
   */
  maxPixelRatioCanvas: number;
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
  /** Ombre portate della traccia «luce» ('spente' a Bassa): vedi `Game.applicaOmbre`. */
  ombre: LivelloOmbre;
  /**
   * Motivi del mondo della traccia «luce» (`uDettaglio`): 1 = pieni, 0 = economici (niente tocchi
   * fini del prato né foglie cadute, motivi delle superfici solo da vicino). Vedi `Game.applicaOmbre`.
   */
  motivi: number;
  /**
   * Vegetazione della traccia «natura» (0.2..1.3): distanze dei livelli di dettaglio degli alberi,
   * raggio e densità del sottobosco (erba, felci, fiori…). Vedi `Vegetation.impostaQualita`.
   */
  vegetazione: number;
}

export const PRESET_QUALITA: Readonly<Record<LivelloQualita, PresetQualita>> = {
  // (Bassa: vegetazione 0.35, sotto 0.5 niente carte di foglie lontane né felci e fiori: vedi
  // Vegetation.impostaQualita e Sottobosco.impostaQualita)
  bassa: { livello: 'bassa', maxPixelRatio: 1, maxPixelRatioCanvas: 1, scala: 0.7, msaa: 0, bloom: 3, filtro: 'nessuno', raggio: 0, mezzaRisoluzione: false, contorni: false, pennellata: false, fxaa: true, ombre: 'spente', motivi: 0, vegetazione: 0.35 },
  // (rifinitura 2: vegetazione da 0,75 a 0,6, e sotto 0,8 niente carte di foglie ai LOD 2 e 3:
  // margine per i 60 fps a 1080p su una integrata, vedi Vegetation.impostaQualita)
  media: { livello: 'media', maxPixelRatio: 1, maxPixelRatioCanvas: 1.5, scala: 1, msaa: 0, bloom: 5, filtro: 'generalizzato', raggio: 4, mezzaRisoluzione: true, contorni: true, pennellata: true, fxaa: false, ombre: 'media', motivi: 1, vegetazione: 0.6 },
  alta: { livello: 'alta', maxPixelRatio: 1.25, maxPixelRatioCanvas: 2, scala: 1, msaa: 2, bloom: 6, filtro: 'anisotropico', raggio: 5, mezzaRisoluzione: true, contorni: true, pennellata: true, fxaa: false, ombre: 'alta', motivi: 1, vegetazione: 1 },
};

/** Il preset di ogni gradino dell'automatica («Media ridotta» = Media all'80% dei pixel del mondo). */
export const PRESET_GRADINI: Readonly<Record<GradinoQualita, PresetQualita>> = {
  ...PRESET_QUALITA,
  mediaRidotta: { ...PRESET_QUALITA.media, scala: 0.8 },
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

/** Un gradino più in basso dell'automatica: Alta → Media → Media ridotta → Bassa. */
export function gradinoSotto(g: GradinoQualita): GradinoQualita {
  return g === 'alta' ? 'media' : g === 'media' ? 'mediaRidotta' : 'bassa';
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
  /**
   * Soglia per il costo misurato (tempo GPU o del disegno, s, mediana): più stretta della soglia
   * sull'intervallo fra i fotogrammi, perché l'obiettivo è 60 fps e il costo misurato non comprende
   * il resto del fotogramma (logica, compositore del browser).
   */
  sogliaCosto: number;
  /** Quante volte al massimo si scende nella misura iniziale. */
  maxCambi: number;
  /**
   * Sorveglianza dopo la misura iniziale, solo verso il basso e solo col costo misurato (con
   * l'intervallo fra i fotogrammi, quantizzato dal vsync, non si giudica): per `durata` secondi,
   * una finestra di `finestra` secondi ogni `periodo`; se la mediana supera `soglia` si scende di un
   * gradino. Assente = niente sorveglianza.
   */
  sorveglianza?: { durata: number; periodo: number; finestra: number; soglia: number };
}

export const MISURA_PREDEFINITA: OpzioniMisura = {
  riscaldamento: 1.5,
  finestra: 2.5,
  soglia: 1 / 44,
  sogliaCosto: 1 / 55,
  maxCambi: 3,
  sorveglianza: { durata: 600, periodo: 60, finestra: 5, soglia: 1 / 58 },
};

/**
 * Misura dei primi secondi per la qualità automatica. Si chiama `campione(dt, costo)` a ogni
 * fotogramma: `dt` è il tempo reale trascorso (fa avanzare il riscaldamento e la finestra),
 * `costo` quello da giudicare: se è dato (il massimo fra il tempo GPU, ombre comprese, e il tempo
 * CPU del disegno) vale la soglia `sogliaCosto` (circa 1/55 s), altrimenti si giudica `dt` con
 * `soglia` (1/44 s). Restituisce il nuovo livello quando decide di scendere, altrimenti null.
 * Fotogrammi lunghi più di 0,25 s (scheda nascosta, pausa del debugger) non contano.
 */
export class MisuraQualita {
  private t = 0;
  private campioni: number[] = [];
  private cambi = 0;
  /** nella finestra corrente è arrivato un costo misurato (GPU o disegno) */
  private misurato = false;
  /** la misura iniziale è finita (poi resta, se c'è, la sorveglianza lenta) */
  finita = false;
  /** secondi di sorveglianza trascorsi dalla fine della misura iniziale */
  private tSorv = 0;
  private campioniSorv: number[] = [];

  constructor(
    public livello: GradinoQualita,
    private readonly opz: OpzioniMisura = MISURA_PREDEFINITA,
  ) {}

  /** Niente più da misurare: misura iniziale finita e sorveglianza scaduta (o assente, o già a Bassa). */
  get conclusa(): boolean {
    const sv = this.opz.sorveglianza;
    return this.finita && (!sv || this.tSorv >= sv.durata || this.livello === 'bassa');
  }

  /** Vero se adesso serve il costo misurato (misura iniziale o finestra della sorveglianza). */
  get vuoleCosto(): boolean {
    if (!this.finita) return true;
    const sv = this.opz.sorveglianza;
    if (!sv || this.conclusa) return false;
    return this.tSorv % sv.periodo >= sv.periodo - sv.finestra;
  }

  campione(dt: number, costoMisurato?: number): GradinoQualita | null {
    if (this.finita) return this.sorveglia(dt, costoMisurato);
    const costo = costoMisurato ?? dt;
    if (this.finita || !(dt > 0) || dt > 0.25 || !(costo >= 0)) return null;
    if (costoMisurato !== undefined) this.misurato = true;
    this.t += dt;
    if (this.t < this.opz.riscaldamento) return null;
    this.campioni.push(costo);
    const raccolto = this.t - this.opz.riscaldamento;
    if (raccolto < this.opz.finestra || this.campioni.length < 20) return null;
    const m = mediana(this.campioni);
    this.campioni = [];
    this.t = 0;
    const soglia = this.misurato ? this.opz.sogliaCosto : this.opz.soglia;
    this.misurato = false;
    if (m > soglia && this.livello !== 'bassa' && this.cambi < this.opz.maxCambi) {
      this.cambi++;
      this.livello = gradinoSotto(this.livello);
      // più in basso non si può andare: niente altre misure
      if (this.livello === 'bassa' || this.cambi >= this.opz.maxCambi) this.finita = true;
      return this.livello;
    }
    this.finita = true;
    return null;
  }

  /** Sorveglianza lenta dopo la misura iniziale (vedi `OpzioniMisura.sorveglianza`). */
  private sorveglia(dt: number, costo?: number): GradinoQualita | null {
    const sv = this.opz.sorveglianza;
    if (!sv || this.conclusa || !(dt > 0) || dt > 0.25) return null;
    const prima = this.tSorv % sv.periodo;
    this.tSorv += dt;
    const ora = this.tSorv % sv.periodo;
    const inFinestra = ora >= sv.periodo - sv.finestra;
    if (inFinestra && costo !== undefined && costo >= 0) this.campioniSorv.push(costo);
    // fine della finestra (il periodo ricomincia): si decide
    if (ora < prima) {
      const c = this.campioniSorv;
      this.campioniSorv = [];
      if (c.length >= 20 && mediana(c) > sv.soglia && this.livello !== 'bassa') {
        this.livello = gradinoSotto(this.livello);
        return this.livello;
      }
    }
    return null;
  }
}

export function mediana(v: readonly number[]): number {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  const k = s.length >> 1;
  return s.length % 2 ? s[k]! : (s[k - 1]! + s[k]!) / 2;
}
