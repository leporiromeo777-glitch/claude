/**
 * Salvataggio: serializzazione versionata in JSON con checksum, registro
 * delle migrazioni e due slot alternati.
 *
 * Il documento salvato ha questa forma:
 *
 *   {
 *     "formato": "cielo-di-terra/salvataggio",
 *     "versione": 1,
 *     "contatore": 7,               // cresce a ogni salvataggio
 *     "salvatoIl": "2026-10-15T…",  // ora reale
 *     "checksum": "…",              // hash di tutto il resto
 *     "dati": { "narrativa": {…}, "mondo": <blob opaco del gioco>, "meta": {…} }
 *   }
 *
 * Due slot alternati («<prefisso>.a» e «<prefisso>.b»): ogni salvataggio
 * sovrascrive il più vecchio, così se la scrittura si interrompe resta
 * intatto quello precedente. Al caricamento vince lo slot valido con il
 * contatore più alto.
 */

export const FORMATO_SALVATAGGIO = 'cielo-di-terra/salvataggio';

/** Versione corrente del formato. Ogni aumento vuole una migrazione registrata. */
export const VERSIONE_SALVATAGGIO = 1;

export interface ContenutoSalvataggio<N = unknown> {
  /** Stato narrativo (`Narrativa.esporta()`). */
  narrativa: N;
  /** Stato del mondo fornito dal gioco: posizione, ora, particelle… Il modulo non lo interpreta. */
  mondo: unknown;
  /** Dati liberi per la schermata di caricamento (luogo, giorno, tempo di gioco…). */
  meta?: Record<string, unknown>;
}

export interface DocumentoSalvataggio<N = unknown> {
  formato: string;
  versione: number;
  contatore: number;
  salvatoIl: string;
  checksum: string;
  dati: ContenutoSalvataggio<N>;
}

export class ErroreSalvataggio extends Error {
  constructor(messaggio: string) {
    super(messaggio);
    this.name = 'ErroreSalvataggio';
  }
}

// ---------------------------------------------------------------------------
// Checksum

/** JSON con le chiavi ordinate: lo stesso valore dà sempre la stessa stringa. */
export function jsonCanonico(valore: unknown): string {
  return JSON.stringify(valore, (_k, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      return Object.fromEntries(
        Object.keys(o)
          .sort()
          .map((k) => [k, o[k]]),
      );
    }
    return v;
  });
}

/** Hash cyrb53 (53 bit) di una stringa, in esadecimale di 14 cifre. Serve contro la corruzione, non contro i trucchi. */
export function hash53(testo: string, seme = 0): string {
  let h1 = 0xdeadbeef ^ seme;
  let h2 = 0x41c6ce57 ^ seme;
  for (let i = 0; i < testo.length; i++) {
    const c = testo.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return n.toString(16).padStart(14, '0');
}

/** Checksum di un documento (tutti i campi tranne `checksum`). */
export function checksumDocumento(doc: Omit<DocumentoSalvataggio, 'checksum'> & { checksum?: string }): string {
  const { checksum: _ignorato, ...resto } = doc;
  return hash53(jsonCanonico(resto));
}

// ---------------------------------------------------------------------------
// Migrazioni

/** Una migrazione porta i `dati` dalla versione `da` alla versione `da + 1`. */
export type Migrazione = (dati: Record<string, unknown>) => Record<string, unknown>;

export class RegistroMigrazioni {
  private readonly passi = new Map<number, Migrazione>();

  /** Registra la migrazione dalla versione `da` alla `da + 1`. */
  registra(da: number, fn: Migrazione): this {
    if (!Number.isInteger(da) || da < 0) throw new ErroreSalvataggio(`Versione di partenza non valida: ${da}`);
    if (this.passi.has(da)) throw new ErroreSalvataggio(`Migrazione dalla versione ${da} già registrata`);
    this.passi.set(da, fn);
    return this;
  }

  ha(da: number): boolean {
    return this.passi.has(da);
  }

  /** Versioni di partenza coperte, in ordine. */
  versioni(): number[] {
    return [...this.passi.keys()].sort((a, b) => a - b);
  }

  /** Porta `dati` dalla versione `da` alla versione `a` applicando le migrazioni in fila. */
  migra(dati: Record<string, unknown>, da: number, a: number): Record<string, unknown> {
    if (da > a) {
      throw new ErroreSalvataggio(`Il salvataggio è della versione ${da}, più nuova di questo gioco (${a})`);
    }
    let corrente = dati;
    for (let v = da; v < a; v++) {
      const fn = this.passi.get(v);
      if (!fn) throw new ErroreSalvataggio(`Manca la migrazione dalla versione ${v} alla ${v + 1}`);
      corrente = fn(structuredCopy(corrente));
      if (!corrente || typeof corrente !== 'object') {
        throw new ErroreSalvataggio(`La migrazione dalla versione ${v} non ha restituito un oggetto`);
      }
    }
    return corrente;
  }
}

function structuredCopy<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

/**
 * Migrazioni del formato narrativo. Per cambiare formato: alzare
 * `VERSIONE_SALVATAGGIO` e registrare qui `registra(vecchia, fn)`.
 */
export function migrazioniPredefinite(): RegistroMigrazioni {
  return new RegistroMigrazioni();
}

// ---------------------------------------------------------------------------
// Serializzazione

export interface OpzioniSerializza {
  contatore?: number;
  versione?: number;
  adesso?: Date;
}

/** Crea il documento con checksum. */
export function creaDocumento<N>(contenuto: ContenutoSalvataggio<N>, opzioni: OpzioniSerializza = {}): DocumentoSalvataggio<N> {
  const senza = {
    formato: FORMATO_SALVATAGGIO,
    versione: opzioni.versione ?? VERSIONE_SALVATAGGIO,
    contatore: opzioni.contatore ?? 1,
    salvatoIl: (opzioni.adesso ?? new Date()).toISOString(),
    dati: structuredCopy({
      narrativa: contenuto.narrativa,
      mondo: contenuto.mondo === undefined ? null : contenuto.mondo,
      ...(contenuto.meta ? { meta: contenuto.meta } : {}),
    }) as ContenutoSalvataggio<N>,
  };
  return { ...senza, checksum: checksumDocumento(senza) };
}

/** Serializza in una stringa JSON. */
export function serializza<N>(contenuto: ContenutoSalvataggio<N>, opzioni: OpzioniSerializza = {}): string {
  return JSON.stringify(creaDocumento(contenuto, opzioni));
}

export interface OpzioniDeserializza {
  migrazioni?: RegistroMigrazioni;
  /** Versione attesa dal gioco (predefinita: VERSIONE_SALVATAGGIO). */
  versione?: number;
}

/** Legge e verifica un documento senza migrarlo. Lancia `ErroreSalvataggio` se è rovinato. */
export function leggiDocumento(testo: string): DocumentoSalvataggio {
  let doc: unknown;
  try {
    doc = JSON.parse(testo);
  } catch {
    throw new ErroreSalvataggio('Il salvataggio non è JSON valido');
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new ErroreSalvataggio('Il salvataggio non è un oggetto');
  const d = doc as Partial<DocumentoSalvataggio>;
  if (d.formato !== FORMATO_SALVATAGGIO) throw new ErroreSalvataggio(`Formato sconosciuto: ${String(d.formato)}`);
  if (typeof d.versione !== 'number' || !Number.isInteger(d.versione)) throw new ErroreSalvataggio('Versione mancante');
  if (typeof d.contatore !== 'number') throw new ErroreSalvataggio('Contatore mancante');
  if (typeof d.checksum !== 'string') throw new ErroreSalvataggio('Checksum mancante');
  if (!d.dati || typeof d.dati !== 'object') throw new ErroreSalvataggio('Dati mancanti');
  const atteso = checksumDocumento(d as DocumentoSalvataggio);
  if (atteso !== d.checksum) throw new ErroreSalvataggio('Checksum non valido: il salvataggio è rovinato');
  return d as DocumentoSalvataggio;
}

/** Legge, verifica e migra alla versione corrente. */
export function deserializza<N = unknown>(testo: string, opzioni: OpzioniDeserializza = {}): DocumentoSalvataggio<N> {
  const doc = leggiDocumento(testo);
  const versione = opzioni.versione ?? VERSIONE_SALVATAGGIO;
  if (doc.versione === versione) return doc as DocumentoSalvataggio<N>;
  const migrazioni = opzioni.migrazioni ?? migrazioniPredefinite();
  const dati = migrazioni.migra(doc.dati as unknown as Record<string, unknown>, doc.versione, versione);
  return { ...doc, versione, dati: dati as unknown as ContenutoSalvataggio<N> };
}

// ---------------------------------------------------------------------------
// Archivi

/** Dove finiscono le stringhe: localStorage, IndexedDB, file… (sincrono o asincrono). */
export interface Archivio {
  leggi(chiave: string): string | null | Promise<string | null>;
  scrivi(chiave: string, valore: string): void | Promise<void>;
  rimuovi(chiave: string): void | Promise<void>;
}

/** Archivio in memoria (prove, server). */
export class ArchivioMemoria implements Archivio {
  readonly dati = new Map<string, string>();
  leggi(chiave: string): string | null {
    return this.dati.get(chiave) ?? null;
  }
  scrivi(chiave: string, valore: string): void {
    this.dati.set(chiave, valore);
  }
  rimuovi(chiave: string): void {
    this.dati.delete(chiave);
  }
}

/** Interfaccia minima di `localStorage` (senza dipendere dal DOM). */
export interface StorageMinimo {
  getItem(chiave: string): string | null;
  setItem(chiave: string, valore: string): void;
  removeItem(chiave: string): void;
}

/** Adatta `window.localStorage` (o simili) a un `Archivio`. */
export function archivioDaStorage(storage: StorageMinimo): Archivio {
  return {
    leggi: (k) => storage.getItem(k),
    scrivi: (k, v) => storage.setItem(k, v),
    rimuovi: (k) => storage.removeItem(k),
  };
}

// ---------------------------------------------------------------------------
// Due slot alternati

export type NomeSlot = 'a' | 'b';

export interface InfoSlot {
  slot: NomeSlot;
  chiave: string;
  stato: 'vuoto' | 'valido' | 'rovinato';
  contatore?: number;
  versione?: number;
  salvatoIl?: string;
  meta?: Record<string, unknown>;
  errore?: string;
}

export interface RisultatoCaricamento<N = unknown> {
  slot: NomeSlot;
  documento: DocumentoSalvataggio<N>;
  /** Problemi incontrati (slot rovinati saltati, migrazioni fallite…). */
  avvisi: string[];
}

export interface OpzioniGestore {
  archivio: Archivio;
  /** Prefisso delle chiavi (predefinito «cielo-di-terra.salvataggio»). */
  prefisso?: string;
  migrazioni?: RegistroMigrazioni;
  versione?: number;
  adesso?: () => Date;
}

export class GestoreSalvataggi {
  private readonly archivio: Archivio;
  private readonly prefisso: string;
  private readonly migrazioni: RegistroMigrazioni;
  private readonly versione: number;
  private readonly adesso: () => Date;

  constructor(opzioni: OpzioniGestore) {
    this.archivio = opzioni.archivio;
    this.prefisso = opzioni.prefisso ?? 'cielo-di-terra.salvataggio';
    this.migrazioni = opzioni.migrazioni ?? migrazioniPredefinite();
    this.versione = opzioni.versione ?? VERSIONE_SALVATAGGIO;
    this.adesso = opzioni.adesso ?? (() => new Date());
  }

  chiave(slot: NomeSlot): string {
    return `${this.prefisso}.${slot}`;
  }

  /** Stato dei due slot. */
  async elenco(): Promise<InfoSlot[]> {
    return [await this.info('a'), await this.info('b')];
  }

  private async info(slot: NomeSlot): Promise<InfoSlot & { testo?: string; documento?: DocumentoSalvataggio }> {
    const chiave = this.chiave(slot);
    let testo: string | null;
    try {
      testo = await this.archivio.leggi(chiave);
    } catch (e) {
      return { slot, chiave, stato: 'rovinato', errore: `lettura fallita: ${messaggio(e)}` };
    }
    if (testo === null || testo === '') return { slot, chiave, stato: 'vuoto' };
    try {
      const documento = leggiDocumento(testo);
      return {
        slot,
        chiave,
        stato: 'valido',
        contatore: documento.contatore,
        versione: documento.versione,
        salvatoIl: documento.salvatoIl,
        ...(documento.dati.meta ? { meta: documento.dati.meta } : {}),
        testo,
        documento,
      };
    } catch (e) {
      return { slot, chiave, stato: 'rovinato', errore: messaggio(e) };
    }
  }

  /**
   * Salva nello slot che non contiene il salvataggio valido più recente,
   * poi rilegge e verifica quello che ha scritto.
   */
  async salva<N>(contenuto: ContenutoSalvataggio<N>): Promise<InfoSlot> {
    const [a, b] = await this.elenco();
    const validi = [a!, b!].filter((s) => s.stato === 'valido');
    const piuRecente = validi.sort((x, y) => (y.contatore ?? 0) - (x.contatore ?? 0))[0];
    const destinazione: NomeSlot = piuRecente ? (piuRecente.slot === 'a' ? 'b' : 'a') : 'a';
    const contatore = Math.max(a!.contatore ?? 0, b!.contatore ?? 0) + 1;
    const testo = serializza(contenuto, { contatore, versione: this.versione, adesso: this.adesso() });
    const chiave = this.chiave(destinazione);
    await this.archivio.scrivi(chiave, testo);
    const verifica = await this.info(destinazione);
    if (verifica.stato !== 'valido' || verifica.contatore !== contatore) {
      throw new ErroreSalvataggio(
        `Il salvataggio nello slot ${destinazione} non si rilegge (${verifica.errore ?? verifica.stato}); lo slot precedente è intatto`,
      );
    }
    const { testo: _t, documento: _d, ...info } = verifica;
    return info;
  }

  /** Carica il salvataggio valido più recente (null se non ce n'è nessuno). */
  async carica<N = unknown>(): Promise<RisultatoCaricamento<N> | null> {
    const slot = [await this.info('a'), await this.info('b')];
    const avvisi: string[] = [];
    for (const s of slot) if (s.stato === 'rovinato') avvisi.push(`Slot ${s.slot} rovinato: ${s.errore}`);
    const validi = slot.filter((s) => s.stato === 'valido').sort((x, y) => (y.contatore ?? 0) - (x.contatore ?? 0));
    for (const s of validi) {
      try {
        const documento = deserializza<N>(s.testo!, { migrazioni: this.migrazioni, versione: this.versione });
        return { slot: s.slot, documento, avvisi };
      } catch (e) {
        avvisi.push(`Slot ${s.slot} non caricabile: ${messaggio(e)}`);
      }
    }
    // Nessuno slot caricabile. Se c'era qualcosa di rovinato lo diciamo con un
    // errore, così il gioco non riparte da zero in silenzio.
    if (avvisi.length) throw new ErroreSalvataggio(avvisi.join('; '));
    return null;
  }

  /** Cancella entrambi gli slot. */
  async cancella(): Promise<void> {
    await this.archivio.rimuovi(this.chiave('a'));
    await this.archivio.rimuovi(this.chiave('b'));
  }
}

function messaggio(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
