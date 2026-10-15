import { Emettitore } from '../core/emettitore';

/** Dimensione del testo dell'interfaccia (moltiplica la scala di base di 18 px). */
export type DimensioneTesto = 'normale' | 'grande' | 'molto-grande' | 'enorme';
/** Velocità con cui compare il testo dei dialoghi. */
export type VelocitaTesto = 'lenta' | 'normale' | 'veloce' | 'istantanea';
/** Come si leggono le carte scritte a mano. */
export type Calligrafia = 'corsiva' | 'semplice';
/** Coriolis sul corpo di Elvira: spento (0 %), ridotto (40 %, di serie) o pieno («fisica piena», 100 %). */
export type CoriolisCorpo = 'spento' | 'ridotto' | 'pieno';
/** Capovolgimento attraversando il cielo: rollio lento annunciato o dissolvenza a pennello. */
export type Capovolgimento = 'rollio' | 'dissolvenza';
/** Il Dondolio dopo la svolta: visibile, oppure sostituito da un suono e da un'onda del Velo. */
export type DondolioVisivo = 'visivo' | 'suono';
/** Azioni lunghe (rilievo, Tenuta…): tenere premuto o premere una volta. */
export type ModoAzioni = 'tieni' | 'premi';

/** Tutte le impostazioni del gioco gestite dall'interfaccia. */
export interface Impostazioni {
  // Visione e comandi
  /** Campo visivo verticale in gradi (70-110). */
  campoVisivo: number;
  /** Moltiplicatore della sensibilità del mouse (0,2-3). */
  sensibilitaMouse: number;
  invertiAsseY: boolean;
  /** Oscillazione della testa camminando: spenta di default. */
  oscillazioneTesta: boolean;
  /** Coriolis su passi e salti; 'pieno' è la «fisica piena». */
  coriolisCorpo: CoriolisCorpo;
  azioniTenute: ModoAzioni;
  // Comfort
  /** Vignettatura in planata (0-1). */
  vignettaturaPlanata: number;
  capovolgimento: Capovolgimento;
  /** Velocità apparente delle stelle nelle Finestre (0,25-1). */
  velocitaStelle: number;
  dondolio: DondolioVisivo;
  // Suono (0-1)
  volumeGenerale: number;
  volumeMusica: number;
  volumeAmbiente: number;
  volumeVoci: number;
  audioMono: boolean;
  // Testo e lettura
  dimensioneTesto: DimensioneTesto;
  sottotitoli: boolean;
  /** Didascalie dei suoni («[tre rintocchi]»). */
  sottotitoliSuoni: boolean;
  /** Opacità della fascia dietro i sottotitoli (0-1). */
  sfondoSottotitoli: number;
  velocitaTesto: VelocitaTesto;
  calligrafia: Calligrafia;
  /** Carattere ad alta leggibilità (Atkinson Hyperlegible) per tutta l'interfaccia. */
  caratteriLeggibili: boolean;
  altoContrasto: boolean;
  /** Riduce i movimenti dell'interfaccia (dissolvenze, sfogliare, testo progressivo). */
  riduciMovimenti: boolean;
  // Aiuti
  /** Il punto a matita al centro, quando lo sguardo cade su qualcosa. */
  puntino: boolean;
  /** Suggerimenti dei comandi la prima volta di ogni verbo. */
  suggerimentiComandi: boolean;
  /** Archi sottili del fiato e del Velo intorno al punto (oltre al restringimento della vista). */
  indicatoriFiato: boolean;
  /** Pianta: rosa dei venti. */
  rosaDeiVenti: boolean;
  /** Pianta: puntatore della posizione di Elvira (spento di serie, come da GDD §8.3). */
  posizioneSullaPianta: boolean;
  /** Matita marcata: più contrasto per il mondo e la Pianta a matita. */
  matitaMarcata: boolean;
  /** Bolla più larga (finestra di 1,5 s nel Dondolio). */
  bollaLarga: boolean;
  /** La collimazione aggancia il segnale. */
  collimazioneAgganciata: boolean;
  /** Apnea più lunga (+50 %). */
  apneaLunga: boolean;
  /** Più tempo nelle prove a tempo (Tenuta, traversate delle Finestre). */
  piuTempo: boolean;
  /** Arco di anteprima a matita per i lanci. */
  arcoLancio: boolean;
  /** Avviso della sera: prima di dormire, ciò che non è misurato. */
  avvisoSera: boolean;
}

export type ChiaveImpostazione = keyof Impostazioni;

export interface CambioImpostazione<K extends ChiaveImpostazione = ChiaveImpostazione> {
  chiave: K;
  valore: Impostazioni[K];
  precedente: Impostazioni[K];
  /** Copia di tutte le impostazioni dopo il cambio. */
  tutte: Readonly<Impostazioni>;
}

export interface EventiImpostazioni {
  /** Un'impostazione è cambiata. */
  cambio: CambioImpostazione;
  /** Sono state ripristinate le impostazioni predefinite. */
  ripristino: Readonly<Impostazioni>;
}

/** Scale del testo: 18 px di base, mai sotto 16 px per i testi più piccoli. */
export const SCALE_TESTO: Record<DimensioneTesto, number> = {
  normale: 1,
  grande: 1.15,
  'molto-grande': 1.3,
  enorme: 1.5,
};

/** Caratteri al secondo per la scrittura progressiva dei dialoghi (Infinity = subito). */
export const VELOCITA_CARATTERI: Record<VelocitaTesto, number> = {
  lenta: 28,
  normale: 50,
  veloce: 95,
  istantanea: Number.POSITIVE_INFINITY,
};

export function impostazioniPredefinite(preferisceMenoMovimento = false): Impostazioni {
  return {
    campoVisivo: 80,
    sensibilitaMouse: 1,
    invertiAsseY: false,
    oscillazioneTesta: false,
    coriolisCorpo: 'ridotto',
    azioniTenute: 'tieni',
    vignettaturaPlanata: 0.5,
    capovolgimento: 'rollio',
    velocitaStelle: 1,
    dondolio: 'visivo',
    volumeGenerale: 0.8,
    volumeMusica: 0.7,
    volumeAmbiente: 0.8,
    volumeVoci: 1,
    audioMono: false,
    dimensioneTesto: 'normale',
    sottotitoli: true,
    sottotitoliSuoni: true,
    sfondoSottotitoli: 0.55,
    velocitaTesto: 'normale',
    calligrafia: 'corsiva',
    caratteriLeggibili: false,
    altoContrasto: false,
    riduciMovimenti: preferisceMenoMovimento,
    puntino: true,
    suggerimentiComandi: true,
    indicatoriFiato: true,
    rosaDeiVenti: true,
    posizioneSullaPianta: false,
    matitaMarcata: false,
    bollaLarga: false,
    collimazioneAgganciata: false,
    apneaLunga: false,
    piuTempo: false,
    arcoLancio: false,
    avvisoSera: false,
  };
}

/** Fattore del Coriolis sul corpo (0; 0,4; 1) per il motore. */
export function fattoreCoriolisCorpo(imp: Pick<Impostazioni, 'coriolisCorpo'>): number {
  return imp.coriolisCorpo === 'pieno' ? 1 : imp.coriolisCorpo === 'spento' ? 0 : 0.4;
}

/** Limiti dei valori numerici: [minimo, massimo, passo]. */
export const LIMITI: Partial<Record<ChiaveImpostazione, readonly [number, number, number]>> = {
  campoVisivo: [70, 110, 1],
  sensibilitaMouse: [0.2, 3, 0.05],
  vignettaturaPlanata: [0, 1, 0.05],
  velocitaStelle: [0.25, 1, 0.05],
  volumeGenerale: [0, 1, 0.01],
  volumeMusica: [0, 1, 0.01],
  volumeAmbiente: [0, 1, 0.01],
  volumeVoci: [0, 1, 0.01],
  sfondoSottotitoli: [0, 1, 0.05],
};

const VALORI_AMMESSI: Partial<Record<ChiaveImpostazione, readonly string[]>> = {
  dimensioneTesto: ['normale', 'grande', 'molto-grande', 'enorme'],
  velocitaTesto: ['lenta', 'normale', 'veloce', 'istantanea'],
  calligrafia: ['corsiva', 'semplice'],
  coriolisCorpo: ['spento', 'ridotto', 'pieno'],
  azioniTenute: ['tieni', 'premi'],
  capovolgimento: ['rollio', 'dissolvenza'],
  dondolio: ['visivo', 'suono'],
};

/** Corregge un valore: tipo giusto, dentro i limiti; altrimenti restituisce `undefined`. */
export function validaValore<K extends ChiaveImpostazione>(
  chiave: K,
  valore: unknown,
  rif: Impostazioni,
): Impostazioni[K] | undefined {
  const atteso = typeof rif[chiave];
  if (typeof valore !== atteso) return undefined;
  if (atteso === 'number') {
    if (!Number.isFinite(valore as number)) return undefined;
    const lim = LIMITI[chiave];
    let v = valore as number;
    if (lim) v = Math.min(lim[1], Math.max(lim[0], v));
    return v as Impostazioni[K];
  }
  if (atteso === 'string') {
    const ammessi = VALORI_AMMESSI[chiave];
    if (ammessi && !ammessi.includes(valore as string)) return undefined;
  }
  return valore as Impostazioni[K];
}

/** Interfaccia minima di uno storage (localStorage o un sostituto nei test). */
export interface ArchivioChiaveValore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export interface OpzioniStore {
  /** Chiave in localStorage (predefinita: «cielo-di-terra.impostazioni»). */
  chiave?: string;
  /** Archivio da usare; predefinito `window.localStorage` se disponibile. */
  archivio?: ArchivioChiaveValore | null;
  /** Valori di partenza diversi dai predefiniti (es. dal sistema operativo). */
  predefinite?: Partial<Impostazioni>;
}

const VERSIONE = 1;

function archivioPredefinito(): ArchivioChiaveValore | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    // Accesso negato (finestra privata, cookie bloccati…): le impostazioni restano in memoria.
    return null;
  }
}

function preferenzaMovimentoRidotto(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Impostazioni persistenti: lette e salvate in localStorage (sempre dentro try/catch),
 * con validazione dei valori ed eventi di cambiamento.
 */
export class StoreImpostazioni extends Emettitore<EventiImpostazioni> {
  private valori: Impostazioni;
  private readonly predefinite: Impostazioni;
  private readonly chiave: string;
  private readonly archivio: ArchivioChiaveValore | null;

  constructor(opz: OpzioniStore = {}) {
    super();
    this.chiave = opz.chiave ?? 'cielo-di-terra.impostazioni';
    this.archivio = opz.archivio === undefined ? archivioPredefinito() : opz.archivio;
    this.predefinite = { ...impostazioniPredefinite(preferenzaMovimentoRidotto()), ...opz.predefinite };
    this.valori = { ...this.predefinite, ...this.leggi() };
  }

  /** Valore di un'impostazione. */
  get<K extends ChiaveImpostazione>(chiave: K): Impostazioni[K] {
    return this.valori[chiave];
  }

  /** Copia di tutte le impostazioni. */
  all(): Readonly<Impostazioni> {
    return { ...this.valori };
  }

  /** Valori predefiniti. */
  defaults(): Readonly<Impostazioni> {
    return { ...this.predefinite };
  }

  /**
   * Cambia un'impostazione, la salva ed emette «cambio».
   * I valori fuori limite sono riportati nei limiti; quelli di tipo sbagliato sono ignorati.
   * Restituisce `true` se il valore è cambiato.
   */
  set<K extends ChiaveImpostazione>(chiave: K, valore: Impostazioni[K]): boolean {
    const v = validaValore(chiave, valore, this.predefinite);
    if (v === undefined) return false;
    const precedente = this.valori[chiave];
    if (Object.is(precedente, v)) return false;
    this.valori[chiave] = v;
    this.salva();
    this.emit('cambio', { chiave, valore: v, precedente, tutte: this.all() } as CambioImpostazione);
    return true;
  }

  /** Ripristina le impostazioni predefinite (emette un «cambio» per ogni valore cambiato e poi «ripristino»). */
  reset(): void {
    const prima = this.valori;
    this.valori = { ...this.predefinite };
    this.salva();
    for (const k of Object.keys(prima) as ChiaveImpostazione[]) {
      if (!Object.is(prima[k], this.valori[k])) {
        this.emit('cambio', { chiave: k, valore: this.valori[k], precedente: prima[k], tutte: this.all() } as CambioImpostazione);
      }
    }
    this.emit('ripristino', this.all());
  }

  private leggi(): Partial<Impostazioni> {
    if (!this.archivio) return {};
    let grezzo: string | null = null;
    try {
      grezzo = this.archivio.getItem(this.chiave);
    } catch {
      return {};
    }
    if (!grezzo) return {};
    try {
      const dati = JSON.parse(grezzo) as { v?: number; impostazioni?: Record<string, unknown> };
      const sorgente = dati && typeof dati === 'object' && dati.impostazioni ? dati.impostazioni : {};
      const fuori: Partial<Impostazioni> = {};
      for (const k of Object.keys(this.predefinite) as ChiaveImpostazione[]) {
        if (!(k in sorgente)) continue;
        const v = validaValore(k, sorgente[k], this.predefinite);
        if (v !== undefined) (fuori as Record<string, unknown>)[k] = v;
      }
      return fuori;
    } catch {
      // JSON rovinato: si riparte dai predefiniti.
      return {};
    }
  }

  private salva(): void {
    if (!this.archivio) return;
    try {
      this.archivio.setItem(this.chiave, JSON.stringify({ v: VERSIONE, impostazioni: this.valori }));
    } catch {
      // Quota piena o storage negato: si continua con i valori in memoria.
    }
  }
}
