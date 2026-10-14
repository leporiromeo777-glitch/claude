/**
 * Tipi interni del pacchetto campagna (ARCHITETTURA 5.4).
 *
 * `SaveData.campaign` è un `CampaignState` (types.ts, congelato). La campagna ci
 * conserva in più alcuni campi propri, tutti facoltativi e serializzabili in JSON:
 * il salvataggio del core tiene l'oggetto della campagna così com'è.
 *
 * - `report`: il resoconto della giornata appena chiusa (alba e bilancio lo mostrano
 *   identico anche dopo un ricaricamento);
 * - `solutions`: i merletti riusciti per una combinazione di richieste (Ripassa);
 *   sopravvivono a "Riprendi da qui" come il Taccuino;
 * - `decided`: bigliettini della sera già decisi (appuntati, risposti o lasciati);
 * - `left`: bigliettini lasciati esplicitamente con "Lascia";
 * - `choice`: il finale scelto la sera di g23;
 * - `archiveOpen`: il merletto d'Archivio in lettura (fase 'archivio');
 * - `diarySeen`: quante voci del Taccuino erano già state viste (le altre sono "nuove");
 * - `prologueSeen`: l'apertura del prologo è già stata mostrata.
 *
 * `history` contiene `DayResultX`: un `DayResult` con quello che è successo la sera
 * (risposte, bigliettini lasciati, autori indovinati). Le condizioni `{ok}`, `{failed}`,
 * `{accepted}`, `{ignored}` e `{reply}` si valutano su questi dati e sulla sera in corso.
 */
import type {
  CampaignCore,
  CampaignState,
  CharacterId,
  CondStatus,
  DayResult,
  DiaryEntryId,
  EndingId,
  LaceMetrics,
  LaceRecord,
  LevelId,
  NoteId,
  QuirkId,
  RowMoves,
  VignetteDef,
  VignetteFigure,
  VignetteLine,
} from '../core/types';

/** Riga di vignetta con parametri facoltativi (per i testi della campagna). */
export interface ViewLine extends VignetteLine {
  params?: Record<string, string | number>;
}

/** Vignetta pronta da mostrare: quella dei dati, o una costruita dalla campagna. */
export interface VignetteView extends Omit<VignetteDef, 'lines'> {
  lines: ViewLine[];
  /** Chi parla di più (per l'alternanza dell'alba). */
  who?: CharacterId | null;
  /** Ada senza vernice (chi parla con lei l'ha dimenticata). */
  grezza?: boolean;
}

export type RequestOutcome = 'soddisfatta' | 'fallita';

/** Una richiesta della giornata nel bilancio. */
export interface ReportRequest {
  noteId: NoteId;
  author: CharacterId;
  /** Autore indovinato (bigliettino anonimo). */
  guess?: CharacterId;
  status: RequestOutcome;
  dropped: boolean;
  wrongGuess: boolean;
  /** Conseguenza in una riga: chiave e parametri. */
  consequenceKey: string;
  consequenceParams?: Record<string, string | number>;
  /** La conseguenza è il testo di una voce del Taccuino (testo ricco dei contenuti). */
  consequenceDiary?: DiaryEntryId;
}

export interface MemoriaChange {
  character: CharacterId;
  before: number;
  after: number;
}

/** Resoconto della giornata chiusa (alba + bilancio). */
export interface DayReport {
  levelId: LevelId;
  dayIndex: number;
  requests: ReportRequest[];
  /** Bigliettini lasciati (con conseguenze scritte). */
  ignored: { noteId: NoteId; author: CharacterId; consequenceKey: string; consequenceParams?: Record<string, string | number>; consequenceDiary?: DiaryEntryId }[];
  goals: CondStatus[];
  newDiary: DiaryEntryId[];
  newQuirks: QuirkId[];
  newDesires: CharacterId[];
  memoria: MemoriaChange[];
  metrics: LaceMetrics;
  record: { before: LaceRecord | null; after: LaceRecord; improved: ('incroci' | 'quiete' | 'simmetria' | 'filoDOro')[] };
  goldThread: boolean;
  /** Sblocchi nuovi (GDD 7): 'daily', 'libero', 'gradi', 'tovaglia', 'cosmetic:<id>', 'archive:<id>'. */
  unlocked: string[];
  spartito: string;
  rows: RowMoves[];
  /** Vignette dell'alba già scelte. */
  dawn: VignetteView[];
}

export interface SolutionEntry {
  notes: NoteId[];
  rows: RowMoves[];
}

/** Campi propri della campagna dentro `SaveData.campaign`. */
export interface CampaignExtra {
  report?: DayReport | null;
  solutions?: Record<LevelId, SolutionEntry[]>;
  decided?: NoteId[];
  left?: NoteId[];
  choice?: EndingId | null;
  archiveOpen?: LevelId | null;
  diarySeen?: number;
  /** Voci del Taccuino all'inizio della sera (quelle dopo sono le nuove della giornata). */
  diaryAtEvening?: number;
  prologueSeen?: boolean;
}

export interface DayResultX extends DayResult {
  accepted?: { noteId: NoteId; authorGuess?: CharacterId }[];
  ignored?: NoteId[];
  replies?: Record<NoteId, 'R1' | 'R2'>;
  wrongGuess?: NoteId[];
}

export type CampaignStateX = CampaignState & CampaignExtra;

export type Phase = CampaignCore['phase'];

export type { VignetteFigure };
