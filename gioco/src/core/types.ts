/**
 * Tipi condivisi fra i pacchetti (ARCHITETTURA 4).
 *
 * Questo file è il contratto fra i pacchetti: le forme e i nomi sono quelli
 * del documento di architettura, alla lettera. Dopo la consegna delle
 * fondamenta è CONGELATO: si possono solo AGGIUNGERE tipi mancanti, mai
 * rinominare o cambiare quelli esistenti. Per aggiungere eventi al bus si usa
 * la fusione di dichiarazioni (vedi ARCHITETTURA 3.2):
 *
 *   import '../core/types';
 *   declare module '../core/types' {
 *     interface GameEventMap { 'tombolo:zoom': { level: number } }
 *   }
 */

// ───────────── Identificatori ─────────────
export type CharacterId =
  | 'teresa' | 'marta' | 'piero' | 'gino' | 'bepi' | 'nina' | 'zeno' | 'lunardi'
  | 'livia' | 'ada' | 'clotilde'
  | 'ernesto' | 'anselmo' | 'aldo' | 'bortolo' | 'arianna';
export type PlaceId = 'molo' | 'forno' | 'piazza' | 'chiesa' | 'farmacia' | 'faro';
export const PLACE_ORDER: readonly PlaceId[] = ['molo', 'forno', 'piazza', 'chiesa', 'farmacia', 'faro'];
/** Un CharacterId per i personaggi; 'lino1', 'lino2', … per i lino. */
export type ThreadId = string;
export type ThreadKind = 'persona' | 'lino' | 'nero' | 'avorio';
export type BeadType = 'lettera' | 'voce' | 'segreto' | 'febbre' | 'nome';
/** Es. 'L1', 'voce:bambina', 'letta:L1' (creato dal motore quando Teresa legge L1), 'febbre', 'nome'. */
export type BeadId = string;
export type RuleId =
  | 'incrocio' | 'spillo' | 'lettera' | 'voce' | 'matassa' | 'molo' | 'segreto'
  | 'febbre' | 'rancore' | 'nome' | 'nero' | 'marea' | 'occasioni';
export type QuirkId =
  | 'martaNoSotto' | 'teresaLegge' | 'pieroPozzo' | 'pieroTrabocca'
  | 'ginoCorre' | 'ninaCuriosa' | 'zenoFaro' | 'lunardiCura';
export type Side = 'L' | 'R';              // quale filo della coppia sta sopra
export type EdgeSide = 'molo' | 'faro';
export type Hour = number;                 // 0..24
export type LevelId = string;              // 'g00'…'g23', 'arc1'…'arc6', 'fin_aperto', 'day-2026-10-14', 'lib-…'
export type NoteId = string;               // 'g03.nina'
export type FlagId = string;
export type DiaryEntryId = string;
export type QuestionId = string;
export type EndingId = 'merlettaia' | 'seppia' | 'chiuso' | 'aperto';
export type OccasionKind = 'pane' | 'festa' | 'messa' | 'lanterna' | 'vaporetto';
export type GradoId = 'matassaEsatta' | 'senzaDisfa' | 'spilliVelati' | 'nodoInPiu' | 'neroInPiu' | 'notteCorta';
export type Locale = 'it' | 'en';
export type SceneId =
  | 'boot' | 'titolo' | 'sera' | 'tombolo' | 'alba' | 'bilancio' | 'archivio'
  | 'telaio' | 'giornaliero' | 'libero' | 'impostazioni' | 'crediti' | 'finale';
export type FlagValue = string | number | boolean;

// ───────────── Dati di livello (JSON) ─────────────
export interface ThreadDef { id: ThreadId; kind: ThreadKind; character?: CharacterId; labelKey?: string }
export interface BeadDef {
  id: BeadId; type: BeadType;
  /** Chi la tiene all'apertura. Può essere un filo fuori dal merletto che entrerà da un bordo. Per 'febbre' e 'nome' vedi holders. */
  holder?: ThreadId;
  holders?: ThreadId[];           // voci, segreti, febbre: più portatori iniziali
  to?: ThreadId;                  // solo lettere: destinatario
  labelKey: string;               // testo breve mostrato al tocco ("Lettera da Venezia per Nina")
}
export interface PinDef { thread: ThreadId; place: PlaceId; hour: Hour }
export interface EdgeEvent { hour: Hour; side: EdgeSide; kind: 'vaporetto' | 'barca' | 'secca'; enters?: ThreadId }
export interface TideDef { from: Hour; to: Hour; places: PlaceId[] }
export type AgendaItem = { follow: ThreadId } | { place: PlaceId; hour: Hour } | { stay: true };
export interface NeroDef { thread: ThreadId; enter: { hour: Hour; side: EdgeSide }; agenda: AgendaItem[] }
export interface OccasionDef { kind: OccasionKind; place: PlaceId; hour: Hour }
export interface AutoAgentDef { thread: ThreadId; agenda: AgendaItem[]; likes: OccasionKind[]; givesTo?: ThreadId[] }
export interface AutoweaveDef {
  agents: AutoAgentDef[];            // fili che si muovono da soli (gli altri: lino, cedono)
  controlled?: ThreadId;             // fin_seppia: il filo di Ada mosso dal giocatore
  occasionSlots?: number;            // fin_aperto: 5; arc6: 2
  allowedOccasions?: OccasionDef[];  // se presente, solo queste celle/tipi
  presetOccasions?: OccasionDef[];   // fin_seppia: l'agenda di Livia, non modificabile
}
export interface VignetteFigure { character: CharacterId; pose: 'ferma' | 'porge' | 'saluta'; x: number; flip?: boolean }
export interface VignetteLine { speaker: CharacterId | 'narratore'; textKey: string; forgetKey?: string }
export interface VignetteDef {
  id: string; when?: StoryCond; priority: number;
  background: string;                // nome immagine, es. 'dio/forno/alba'
  figures: VignetteFigure[];
  lines: VignetteLine[];             // max 2 righe da 90 caratteri
  sfx?: SfxId[];
  /** Revisione 1 (C06): id di un'altra vignetta della stessa giornata; questa esce subito dopo, se anche la sua `when` è vera. */
  dopo?: string;
}
export interface ArchiveDef {
  year: string; titleKey: string;
  faded: ThreadId[];                     // fili da nominare
  candidates: CharacterId[];             // con l'esca
  answer: Record<ThreadId, CharacterId>;
  holes: { from: Hour; to: Hour }[];     // righe strappate (estremi inclusi)
  recorded: RowMoves[];                  // il merletto originale completo
  echoes: { hour: Hour; pair: number; textKey: string }[];
  marginKey: string;
  reveal: VignetteDef;
  closes: QuestionId[];
  unlocks: DiaryEntryId[];
}
export interface LevelDef {
  id: LevelId;
  kind: 'storia' | 'archivio' | 'finale' | 'giornaliero' | 'libero' | 'esercizio' | 'test';
  act: 0 | 1 | 2 | 3;
  titleKey: string;
  columns: PlaceId[];                // 3..6, sottoinsieme ordinato di PLACE_ORDER
  startHour: Hour; endHour: Hour;    // righe giocabili: startHour+1 … endHour
  threads: ThreadDef[];              // tutti i fili, anche quelli che entreranno
  initial: ThreadId[];               // length === columns.length
  beads: BeadDef[];
  rules: RuleId[];
  quirks: QuirkId[];                 // stranezze attive (prima dei flag di storia)
  rancor?: [ThreadId, ThreadId][];
  pins: PinDef[];                    // spilli d'ottone
  edges?: EdgeEvent[];
  tide?: TideDef[];
  nero?: NeroDef;
  autoweave?: AutoweaveDef;
  goals?: Condition[];               // obiettivi obbligatori
  notes?: NoteId[];                  // bigliettini della sera precedente
  matassa: number;
  dawn?: { candidates: VignetteDef[] };
  archive?: ArchiveDef;
  hintKeys?: { spinta?: string; indizio?: string };
  tutorial?: TutorialStep[];         // prologo, g01, g12: guida senza testo
  musicSeed?: string;
  /** Revisione 1 (C11): chiusura speciale dell'ultima riga (finale C). */
  chiusura?: 'nodo';
  /** Revisione 1 (C12): il filo nero che appare a merletto chiuso, prima dell'apertura (`hour < startHour`). */
  apparizione?: { hour: Hour; side: EdgeSide; passi: number };
}
// Tutorial (revisione 1, C00/C02: sostituisce TutorialStep; le forme di prima restano valide)
export type MarginWhen =
  | 'primaOra' | 'ora' | 'incrocio' | 'versoSbagliato' | 'rifiuto' | 'spillo' | 'evento'
  | 'nome' | 'archivioNomi' | 'archivioRammendo';
export type PulseTarget =
  | 'fissa' | 'taccuino' | 'nome' | 'disfa'
  | 'lampada' | 'obiettivi' | 'matassa' | 'bordo' | 'spillo' | 'fuso' | 'marea';
export type TutorialStep =
  | { k: 'mano'; hour: Hour; pair: number; over: Side }                       // mano fantasma che mostra l'incrocio
  | { k: 'margine'; when: MarginWhen; textKey: string; hour?: Hour;
      codice?: Violation['code']; evento?: LaceEventKind; chi?: ThreadId; mano?: 'clotilde' | 'ada' }  // nota a margine (Clotilde o Ada)
  | { k: 'pulsa'; target: PulseTarget; hour: Hour; thread?: ThreadId };

// ───────────── Condizioni sul merletto (GDD 3.12) ─────────────
export type Condition =
  | { t: 'presso'; who: ThreadId; place: PlaceId; hour: Hour }
  | { t: 'maiPresso'; who: ThreadId; place: PlaceId; from: Hour; to: Hour }
  | { t: 'incontra'; a: ThreadId; b: ThreadId; from?: Hour; to?: Hour }
  | { t: 'nonIncontra'; a: ThreadId; b: ThreadId | '*'; from?: Hour; to?: Hour }
  | { t: 'sopra'; a: ThreadId; b: ThreadId; to?: Hour }
  | { t: 'consegnata'; bead: BeadId; by?: Hour }
  | { t: 'ha'; who: ThreadId; bead: BeadId; by?: Hour }
  | { t: 'nonHa'; who: ThreadId; bead: BeadId }
  | { t: 'parte'; who: ThreadId; hour?: Hour }
  | { t: 'resta'; who: ThreadId }
  | { t: 'esceCon'; bead: BeadId; hour: Hour }
  | { t: 'sano'; who: ThreadId }
  | { t: 'incontriAlmeno'; who: ThreadId; n: number }
  | { t: 'tutti'; of: Condition[] }
  | { t: 'almeno'; n: number; of: Condition[] }
  | { t: 'non'; c: Condition };
export type CondStatus = 'soddisfatta' | 'in_corso' | 'a_rischio' | 'fallita';
export interface CondReport { status: CondStatus; reasonKey?: string; params?: Record<string, string | number> }

// ───────────── Condizioni ed effetti di storia ─────────────
export type StoryCond =
  | { flag: FlagId; eq?: FlagValue; gte?: number; lte?: number }
  | { ok: NoteId } | { failed: NoteId } | { accepted: NoteId } | { ignored: NoteId }
  | { reply: NoteId; is: 'R1' | 'R2' }
  | { event: LaceEventKind; a?: ThreadId; b?: ThreadId; quirk?: QuirkId }  // nell'ultima notte giocata
  | { knows: 'quirk' | 'diary' | 'desire' | 'rule' | 'archive' | 'oggetto'; id: string }   // 'oggetto' (C03): oggetto o lettera conosciuti
  | { memoria: CharacterId; gte?: number; lte?: number }
  | { done: LevelId }
  | { all: StoryCond[] } | { any: StoryCond[] } | { not: StoryCond };
export type Effect =
  | { setFlag: FlagId; value: FlagValue }
  | { addFlag: FlagId; by: number }
  | { diary: DiaryEntryId }
  | { desire: CharacterId }
  | { question: QuestionId; state: 'aperta' | 'risolta' }
  | { memoria: CharacterId; by: number }
  | { unlock: 'archive' | 'mode' | 'cosmetic'; id: string }
  | { object: string };

// ───────────── Contenuti narrativi (JSON) ─────────────
export type ThreadPattern =
  | 'righe' | 'puntini' | 'doppio' | 'onde' | 'zigzag' | 'tratteggio'
  | 'catenella' | 'croce' | 'lucido' | 'perlato' | 'liscio' | 'nessuno';
export interface VoiceProfile { pitch: number; rate: number; formantShift: number; noise: number; lowpass?: number }
export interface Handwriting { font: 'caveat' | 'garamond' | 'atkinson'; ink: string; paper: string; slantDeg: number; sizeScale: number; caps?: boolean }
export interface CharacterDef {
  id: CharacterId; nameKey: string; roleKey: string;
  color: string; pattern: ThreadPattern; icon: string;   // icon: nome del glifo disegnato in codice
  noteHz: number | null; voice: VoiceProfile | null; hand: Handwriting | null;
  quirks: QuirkId[]; desireKey?: string; likes: OccasionKind[];
  archiveOnly?: boolean;
}
export interface PlaceDef { id: PlaceId; nameKey: string; shortKey: string; icon: string; diorama: string }
export interface NoteDef {
  id: NoteId; day: LevelId; author: CharacterId;
  textKey: string;
  request?: Condition;
  replies?: { id: 'R1' | 'R2'; textKey: string; effects: Effect[] }[];
  onOk?: Effect[]; onFail?: Effect[]; onIgnore?: Effect[];
  availableIf?: StoryCond;
  ending?: EndingId;                       // solo i biglietti della scelta (g23)
  /** Revisione 1 (C05): righe di conseguenza (chiavi di testo) per stato della richiesta. */
  esito?: { ok?: string; fallita?: string; lasciato?: string };
}
export interface DiaryEntryDef {
  id: DiaryEntryId; section: 'persone' | 'libro' | 'domande' | 'lettere' | 'archivio';
  character?: CharacterId; textKey: string;
  source?: 'visto' | 'libro' | 'sentito' | 'archivio';
  unlock: StoryCond; opens?: QuestionId[]; closes?: QuestionId[]; pista?: boolean;
}
export interface LineDef {
  id: string; character: CharacterId; event: LaceEventKind | 'riserva';
  with?: CharacterId; when?: StoryCond; textKey: string; forgetKey?: string; priority?: number;
}
export interface LetterDef { id: string; arrivesAfter: LevelId; textKey: string; signed: 'L.' | 'C.' | string }
export interface BookPageDef { id: string; rule: RuleId | 'puntoAperto'; titleKey: string; textKey: string; marginKey?: string; demo?: LevelDef; unlock: StoryCond }
// Oggetti della campagna (revisione 1, C04): provenienza; un oggetto senza voce in `objects` viene dalla laguna.
export interface ObjectMeta { from: 'laguna' | 'mano' | 'porta' | 'casa'; by?: CharacterId }
export interface CampaignDay {
  id: LevelId; act: 0 | 1 | 2 | 3; pins: number; archiveAfter?: LevelId; objectAfter?: string; stonatura: number;
  dawnObject?: string;               // C04: oggetto consegnato a mano alla fine dell'alba
  eveningEmptyKey?: string;          // C04: frase della porta quando quella sera non arriva niente
}
export interface CampaignDef { days: CampaignDay[]; finals: Record<EndingId, LevelId>; choiceDay: LevelId; objects?: Record<string, ObjectMeta> }
export interface EndingDef {
  id: EndingId; level: LevelId; requires?: StoryCond;
  missing: { cond: StoryCond; textKey: string }[];
  epilogue: VignetteDef[]; countsAsEnding: boolean;
}
export interface BalanceDef {
  acts: Record<'1' | '2' | '3', { pins: number; slack: number; notes: [number, number] }>;
  memoria: { start: number; startLunardi: number; min: number; max: number; trueEndingCount: number };
  traboccoSoglia: number; nodoRighe: number;
  hint: { lampSeconds: number; undoRepeat: number };
  anim: { swapMs: number; beadMs: number; neroMs: number; beatMs: number };
  /** Revisione 1 (C15): filo d'oro solo se il minimo della notte è almeno `minIncroci` (assente = 3). */
  oro?: { minIncroci: number };
}
export interface ContentDB {
  levels: Map<LevelId, LevelDef>;
  computed: Map<LevelId, LevelComputed>;
  characters: Map<CharacterId, CharacterDef>;
  places: Map<PlaceId, PlaceDef>;
  notes: Map<NoteId, NoteDef>;
  diary: Map<DiaryEntryId, DiaryEntryDef>;
  lines: LineDef[];
  letters: LetterDef[];
  book: BookPageDef[];
  campaign: CampaignDef;
  endings: Map<EndingId, EndingDef>;
  balance: BalanceDef;
  credits: { authorKey: string; lines: { key: string }[] };
}

// ───────────── Motore: stato e risultati ─────────────
export interface Crossing { pair: number; over: Side; forced?: boolean }
export interface RowMoves { hour: Hour; crossings: Crossing[] }
export interface LaceState {
  hour: Hour;
  pos: ThreadId[];                                   // per colonna
  offboard: { thread: ThreadId; hour: Hour; side: EdgeSide }[];
  holders: Record<BeadId, ThreadId[]>;               // lettere: 0-1 elementi; 'febbre': i malati; 'nome': chi ricorda
  delivered: BeadId[];
  knotted: ThreadId[];                               // bloccati nella riga successiva
  pozzo: { secrets: number; overflowing: boolean };
  usedMatassa: number;
  met: string[];                                     // 'a|b' con a<b, coppie incontrate finora
  metOver: string[];                                 // 'a>b': a è passato sopra b
  /** Revisione 1 (C01): 1 se Gino è stato fermo nell'ultima riga; si scrive solo quando vale 1. */
  ginoFermo?: 0 | 1;
}
export type LaceEventKind =
  | 'incontro' | 'passa' | 'copia' | 'consegna' | 'legge' | 'contagio' | 'cura'
  | 'nodo' | 'esce' | 'entra' | 'trabocca' | 'stranezza' | 'nero';
export type LaceEvent =
  | { k: 'incontro'; a: ThreadId; b: ThreadId; over: ThreadId; pair: number }
  | { k: 'passa'; bead: BeadId; from: ThreadId; to: ThreadId }
  | { k: 'copia'; bead: BeadId; from: ThreadId; to: ThreadId }
  | { k: 'consegna'; bead: BeadId; to: ThreadId }
  | { k: 'legge'; letter: BeadId; secret: BeadId; who: ThreadId }
  | { k: 'contagio'; from: ThreadId; to: ThreadId }
  | { k: 'cura'; who: ThreadId; by: ThreadId }
  | { k: 'nodo'; a: ThreadId; b: ThreadId }
  | { k: 'esce'; thread: ThreadId; side: EdgeSide; kind: EdgeEvent['kind'] }
  | { k: 'entra'; thread: ThreadId; side: EdgeSide; kind: EdgeEvent['kind'] }
  | { k: 'trabocca'; who: ThreadId }
  | { k: 'stranezza'; quirk: QuirkId; thread: ThreadId }
  | { k: 'nero'; thread: ThreadId; pair: number };
export interface Violation {
  code: 'rifiuto' | 'faro' | 'corre' | 'spillo' | 'matassa' | 'bloccato' | 'occupato' | 'forzato' | 'disgiunto';
  threads?: ThreadId[]; pin?: PinDef; quirk?: QuirkId;
  messageKey: string; params?: Record<string, string | number>;
}
export interface RowResult { ok: boolean; state: LaceState; events: LaceEvent[]; violations: Violation[] }
export interface RunContext {
  flags: Readonly<Record<FlagId, FlagValue>>;
  quirks: QuirkId[];               // attive: level.quirks meno quelle tolte dai flag (es. riconciliate)
  rules: RuleId[];
  rancor: [ThreadId, ThreadId][];  // level.rancor meno quelli tolti dai flag
  nomeOn: ThreadId | null;
  occasions: OccasionDef[];
  /** Parametri bilanciabili del motore (GDD 3.13, balance.json); assenti = 3 segreti e 1 riga. */
  traboccoSoglia?: number;
  nodoRighe?: number;
}
export interface LaceMetrics { incroci: number; minIncroci: number | null; quiete: number; simmetria: boolean; filoDOro: boolean }
export interface SolveRequest {
  level: LevelDef; ctx: RunContext; goals: Condition[];
  from?: { state: LaceState; rowsDone: RowMoves[] };
  objective?: 'minIncroci' | 'maxQuiete';
  matassa?: number;            // default level.matassa
  maxStates?: number;          // default 400000 in Node, 60000 nel browser
  countOptimal?: boolean;      // conta le soluzioni ottime distinte (fino a 50)
}
export interface SolveResult {
  status: 'ok' | 'impossibile' | 'limite';
  rows?: RowMoves[]; incroci?: number; quiete?: number; optimalCount?: number;
  states: number; ms: number;
}
export interface LevelComputed {
  levelId: LevelId; sourceHash: string; solverVersion: number;
  /**
   * `nomeOn` (livelli con la regola 'nome', GDD 3.11): presente solo quando le condizioni nominano
   * la perlina `nome`; è il filo su cui appuntare il nome per ottenere il minimo. In quel caso le
   * righe valgono solo con quel filo: per bigliettini e combinazioni `rows` non si salva.
   */
  base: { incroci: number; rows: RowMoves[]; nomeOn?: ThreadId };
  perNote: Record<NoteId, { incroci: number | null; rows?: RowMoves[]; nomeOn?: ThreadId }>;   // null = impossibile
  combos: { notes: NoteId[]; incroci: number | null; rows?: RowMoves[]; voluta?: boolean; nomeOn?: ThreadId }[];
  matassaSuggerita: number;
  quieteMax: number;
  occasionsSolution?: OccasionDef[];   // livelli con occasioni: un insieme minimo che soddisfa gli obiettivi
  occasionsSolutions?: number;         // quanti insiemi validi esistono fra quelli ammessi
  quality?: QualityReport;             // revisione 1 (C14): criteri di qualità calcolati da levels:check
}
// Criteri di qualità dei livelli (revisione 1, C14)
export interface QualityConfig {
  config: string;                 // 'base' | '<noteId>' | '<noteId>+<noteId>[+<noteId>]'
  min: number | null;             // minimo incroci (null = impossibile)
  minSenzaGino: number | null;    // minimo togliendo 'ginoCorre' (null se Gino non c'è)
  costo?: number;                 // solo bigliettini singoli: min(base+nota) − min(base)
  vuoteMax: number;               // righe consecutive senza incroci del giocatore nella soluzione registrata
  vuoteTot: number;
  soluzioniOttime: number;        // countOptimal (fino a 50)
}
export interface QualityReport { configs: QualityConfig[]; designata: string; facili: NoteId[]; violazioni: string[] }
export type HintTier = 'spinta' | 'indizio' | 'fantasma';
export interface Hint { tier: HintTier; textKey: string; params?: Record<string, string | number>; highlight?: { hour?: Hour; column?: number; pin?: PinDef }; ghost?: Crossing }

// ───────────── Notte (contratto fra chi avvia e il tombolo) ─────────────
export type NightOrigin = 'campagna' | 'giornaliero' | 'libero' | 'telaio' | 'archivio' | 'spartito';
export interface AcceptedRequest { noteId: NoteId; request: Condition; author: CharacterId; authorGuess?: CharacterId }
export interface NightResume {
  levelId: LevelId; rows: RowMoves[]; draft: Crossing[]; dropped: NoteId[];
  nomeOn: ThreadId | null; hintsUsed: number; fantasmaUsed: boolean;
  occasions?: OccasionDef[]; archiveNames?: Record<ThreadId, CharacterId>;
}
export interface NightParams {
  origin: NightOrigin;
  mode: 'normale' | 'archivio' | 'controllato' | 'occasioni' | 'replay';
  level: LevelDef;
  flags: Record<FlagId, FlagValue>;
  accepted: AcceptedRequest[];
  goals: Condition[];
  needsNome: boolean;               // da g12: chiedere dove appuntare il nome
  gradi?: GradoId[];
  resume?: NightResume;
  replay?: RowMoves[];              // spartito e Ripassa
  replaySpeedMs?: number;
}
export interface NightOutcome {
  origin: NightOrigin; levelId: LevelId;
  rows: RowMoves[]; timeline: LaceState[]; events: LaceEvent[][];
  goals: CondReport[];
  requests: { noteId: NoteId; status: 'soddisfatta' | 'fallita' }[];
  dropped: NoteId[];
  metrics: LaceMetrics; spartito: string;
  hintsUsed: number; fantasmaUsed: boolean;
  discoveredQuirks: QuirkId[];
  nomeOn: ThreadId | null;
  archive?: { named: boolean; mended: boolean };
  occasions?: OccasionDef[];
}

// ───────────── Salvataggi ─────────────
export interface Settings {
  volume: { master: number; music: number; sfx: number; voice: number };   // 0..1
  textScale: number;            // 0.9..1.4
  highContrast: boolean;
  animSpeed: 0 | 0.5 | 1 | 2;   // 0 = istantanea
  reducedMotion: boolean; haptics: boolean; captions: boolean; autoAdvance: boolean;
  locale: Locale;
}
export interface DayResult {
  levelId: LevelId; rows: RowMoves[];
  requests: { noteId: NoteId; status: 'soddisfatta' | 'fallita' }[];
  metrics: LaceMetrics; spartito: string; at: string;
}
export interface EveningState {
  noteIds: NoteId[];
  accepted: { noteId: NoteId; authorGuess?: CharacterId }[];
  replies: Record<NoteId, 'R1' | 'R2'>;
  ignored: NoteId[];
  objectSeen: boolean;
}
export interface CampaignCore {
  dayIndex: number; levelId: LevelId;
  phase: 'sera' | 'notte' | 'alba' | 'bilancio' | 'archivio' | 'scelta' | 'finale' | 'titoli' | 'fine';
  flags: Record<FlagId, FlagValue>;
  memoria: Partial<Record<CharacterId, number>>;
  evening: EveningState | null;
  lastOutcome: NightOutcome | null;
  shownLines: { id: string; day: number }[];
  endingsSeen: EndingId[];
}
export interface CampaignState extends CampaignCore {
  history: Record<LevelId, DayResult>;
  snapshots: Record<LevelId, CampaignCore>;     // stato all'inizio della sera di ogni giornata
}
export interface Knowledge {
  quirks: QuirkId[]; rules: RuleId[]; diary: DiaryEntryId[]; desires: CharacterId[];
  questions: Record<QuestionId, 'aperta' | 'risolta'>;
  archive: Record<LevelId, 'nuovo' | 'nominato' | 'rammendato'>;
  letters: string[]; objects: string[]; seenVignettes: string[];
  bookSeen?: string[];          // revisione 1 (D03): pagine del Libro già viste (le altre sono «Nuova»)
}
export interface LaceRecord { minIncroci: number | null; maxQuiete: number | null; simmetria: boolean; filoDOro: boolean; bestSpartito?: string }
export interface DailyRecord { date: string; incroci: number; min: number; quiete: number; simmetria: boolean; spartito: string }
export interface Unlocks { daily: boolean; libero: boolean; gradi: boolean; cosmetics: string[]; selectedCosmetic?: string; tovaglia: boolean }
export interface SaveData {
  schema: 1; app: 'trama'; writtenAt: string; gameVersion: string;
  settings: Settings;
  campaign: CampaignState | null;
  knowledge: Knowledge;
  night: { origin: NightOrigin; params: Omit<NightParams, 'level'> & { levelId: LevelId }; resume: NightResume } | null;
  records: Record<LevelId, LaceRecord>;
  daily: Record<string, DailyRecord>;
  unlocks: Unlocks;
  stats: { playMs: number; nights: number; goldThreads: number; dailyStreak: number; lastDaily?: string };
}

// ───────────── Servizi ─────────────
export type Unsub = () => void;
export interface GameEventMap {
  'app:pause': {}; 'app:resume': {}; 'app:back': {};
  'viewport:change': Viewport;
  'scene:enter': { id: SceneId; params?: unknown }; 'scene:exit': { id: SceneId };
  'settings:change': Settings;
  'save:request': { reason: string; immediate?: boolean };
  'save:written': { slot: 'a' | 'b'; bytes: number };
  'night:cross': { hour: Hour; crossing: Crossing; over: ThreadId; under: ThreadId };
  'night:violation': { v: Violation };
  'night:row': { hour: Hour; result: RowResult };
  'night:undo': { hour: Hour };
  'night:complete': { outcome: NightOutcome };
  'night:exit': { origin: NightOrigin };
  /** Uno spillo rosso lasciato cadere durante la notte (gettone, Spinta, Taccuino, debug). */
  'night:drop': { noteId: NoteId; levelId: LevelId };
  'quirk:discovered': { quirk: QuirkId; thread: ThreadId };
  'diary:new': { id: DiaryEntryId };
  'toast': { textKey: string; params?: Record<string, string | number>; kind?: 'info' | 'ok' | 'warn' };
  'audio:caption': { textKey: string; params?: Record<string, string | number> };
  'audio:unlocked': {};
  // Revisione 1 (C11, C12)
  'tombolo:nodo': { levelId: LevelId };
  'tombolo:apparizione': { levelId: LevelId };
}
export interface EventBus<M> {
  on<K extends keyof M>(k: K, fn: (p: M[K]) => void): Unsub;
  once<K extends keyof M>(k: K, fn: (p: M[K]) => void): Unsub;
  emit<K extends keyof M>(k: K, p: M[K]): void;
}
export interface SafeArea { top: number; right: number; bottom: number; left: number }
export interface Viewport {
  cssW: number; cssH: number; dpr: number;      // dpr già limitato a 2
  safe: SafeArea; orientation: 'portrait' | 'landscape';
  layout: 'stretto' | 'largo';                  // largo: cssW >= 900 && cssW/cssH >= 1.15
  textScale: number;
}
export interface CanvasHost { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; cssW: number; cssH: number; dpr: number }
export interface Scene {
  readonly id: SceneId;
  enter(params?: unknown): void | Promise<void>;
  exit(): void;
  update?(dt: number): void;          // passo fisso, dt = 1/60 s
  render?(alpha: number, host: CanvasHost): void;
  resize?(vp: Viewport): void;
  onAction?(e: ActionEvent): boolean;
  onGesture?(g: Gesture): boolean;
  onBack?(): boolean;                 // true = gestito
}
export interface SceneManager {
  register(id: SceneId, factory: () => Scene): void;
  go(id: SceneId, params?: unknown, opts?: { transition?: 'fade' | 'none' }): Promise<void>;
  current(): SceneId | null;
  has(id: SceneId): boolean;
}
export type ActionId =
  | 'confirm' | 'back' | 'pause' | 'undo' | 'fixHour' | 'notebook' | 'hint' | 'name'
  | 'left' | 'right' | 'up' | 'down' | 'pageUp' | 'pageDown'
  | 'crossL' | 'crossR' | 'flip' | 'select' | 'skip' | 'auto' | 'tab'
  | 'skipQuiet';   // revisione 1: Maiusc+Invio, «Salta le ore quiete» (GDD 11.3, TOM-22)
export interface ActionEvent { action: ActionId; index?: number; repeat: boolean; source: 'keyboard' | 'ui' | 'debug' }
export type Gesture =
  | { k: 'tap'; x: number; y: number; pointer: 'mouse' | 'touch' | 'pen'; button: number }
  | { k: 'longpress'; x: number; y: number; pointer: 'mouse' | 'touch' | 'pen' }
  | { k: 'dragstart' | 'drag' | 'dragend' | 'dragcancel'; x: number; y: number; startX: number; startY: number; dx: number; dy: number; pointer: 'mouse' | 'touch' | 'pen' }
  | { k: 'wheel'; x: number; y: number; dy: number };
export interface InputRouter {
  onGesture(fn: (g: Gesture) => boolean): Unsub;     // coordinate CSS rispetto al canvas
  onAction(fn: (a: ActionEvent) => boolean): Unsub;
  pushLayer(name: string): Unsub;                     // overlay modali: riceve solo il livello in cima
  lastDevice(): 'mouse' | 'touch' | 'keyboard';
  simulate: {
    tap(x: number, y: number, pointer?: 'mouse' | 'touch'): void;
    drag(x0: number, y0: number, x1: number, y1: number, steps?: number, pointer?: 'mouse' | 'touch'): Promise<void>;
    action(a: ActionId, index?: number): void;
  };
}
export interface I18n {
  t(key: string, params?: Record<string, string | number>): string;
  has(key: string): boolean;
  locale(): Locale;
  setLocale(l: Locale): void;
  missing(l?: Locale): string[];
}
export interface StorageBackend { get(key: string): Promise<string | null>; set(key: string, v: string): Promise<void>; remove(key: string): Promise<void> }
export interface SaveService {
  load(): Promise<SaveData>;
  data(): SaveData;
  update(mut: (d: SaveData) => void, opts?: { immediate?: boolean; reason?: string }): void;
  flush(): Promise<void>;
  exportString(): string;
  importString(s: string): { ok: boolean; errorKey?: string };
  wipe(): Promise<void>;
}
export interface SettingsStore { get(): Settings; set(p: Partial<Settings>): void }
export type SfxId =
  | 'fuso_presa' | 'fuso_rilascio' | 'incrocio' | 'rovescia' | 'lettera' | 'voce' | 'segreto'
  | 'febbre' | 'cura' | 'nodo' | 'rifiuto' | 'disfa' | 'ora_fissata' | 'vaporetto' | 'barca'
  | 'gabbiano' | 'pagina' | 'bottiglia' | 'carta' | 'successo' | 'fallimento' | 'trabocco'
  | 'marea' | 'nero' | 'ui_tap' | 'ui_indietro';
export type AmbienceId = 'silenzio' | 'laguna' | 'notte' | 'pioggia' | 'vento' | 'tempesta';
export type MusicState = 'off' | 'titolo' | 'sera' | 'notte' | 'alba' | 'archivio' | 'finale';
export interface CarillonScore { beatMs: number; rows: (CharacterId | 'lino')[][][] }  // per riga: lista di bicordi [sopra, sotto]
export interface Playing { stop(): void; done: Promise<void> }
export interface AudioEngine {
  unlock(): void;
  state(): 'locked' | 'running' | 'suspended';
  suspend(): void; resume(): void;
  setVolumes(v: Settings['volume']): void;
  sfx(id: SfxId, o?: { pan?: number; gain?: number; detune?: number }): void;
  note(who: CharacterId | 'lino', o?: { pan?: number; gain?: number; detuneCents?: number }): void;
  crossing(over: CharacterId | 'lino', under: CharacterId | 'lino', o?: { rancor?: boolean; pan?: number }): void;
  bell(o: { hour: Hour; stonatura: number }): void;
  carillon(score: CarillonScore): Playing;
  babble(who: CharacterId, text: string, o?: { rate?: number }): Playing;
  // Aggiunta compatibile (integrazione): `o.clock` è l'orologio che ticchetta piano.
  // Di serie c'è solo in 'notte' (fermo nel prologo); true lo aggiunge a qualunque
  // ambiente e ticchetta sempre (titolo: «laguna e orologio», GDD 9), false lo toglie.
  setAmbience(a: AmbienceId, fadeMs?: number, o?: { clock?: boolean }): void;
  setMusic(s: MusicState, o?: { seed?: string; notes?: (CharacterId | 'lino')[]; stonatura?: number }): void;
  duck(on: boolean): void;
}
export type HapticKind = 'leggero' | 'medio' | 'successo' | 'rifiuto';
export interface Haptics { play(k: HapticKind): void }
export interface Platform {
  native: boolean; os: 'web' | 'ios' | 'android';
  onPause(fn: () => void): Unsub; onResume(fn: () => void): Unsub;
  onBack(fn: () => boolean): Unsub;
  exitApp(): void; keepAwake(on: boolean): void;
  share(o: { text: string; title?: string; file?: Blob; fileName?: string }): Promise<boolean>;
  copy(text: string): Promise<boolean>;
  hideSplash(): void;
}
export interface SpriteFrame { source: CanvasImageSource; sx: number; sy: number; sw: number; sh: number; ax: number; ay: number; placeholder: boolean }
export interface AssetManifest {
  version: number;
  atlases: { image: string; width: number; height: number; frames: Record<string, { x: number; y: number; w: number; h: number; ax: number; ay: number }> }[];
  images: Record<string, { src: string; w: number; h: number; group: string }>;
}
export interface AssetStore {
  load(groups: string[]): Promise<void>;
  frame(name: string): SpriteFrame;               // mai undefined: segnaposto se manca
  image(name: string): CanvasImageSource;         // idem
  has(name: string): boolean;
  missing(): string[];
}
export interface PanelHandle { update?(): void; destroy(): void }
export interface UiLayer {
  root: HTMLElement;                                          // #ui-root, sopra il canvas
  registerPanel(id: 'taccuino' | 'bigliettini' | string, factory: (container: HTMLElement, opts?: unknown) => PanelHandle): void;
  mountPanel(id: string, container: HTMLElement, opts?: unknown): PanelHandle;   // pannello fisso (layout largo)
  openOverlay(id: string, opts?: unknown): Promise<void>;     // pannello sopra tutto (layout stretto), chiudibile con Indietro
  closeOverlay(): void;
  toast(textKey: string, params?: Record<string, string | number>, kind?: 'info' | 'ok' | 'warn'): void;
  confirm(o: { titleKey: string; bodyKey?: string; okKey: string; cancelKey: string; danger?: boolean }): Promise<boolean>;
}
export interface Entitlements { isUnlocked(feature: 'fullGame'): boolean }
export interface DebugRegistry { register(ns: string, api: Record<string, (...args: never[]) => unknown>): void }
export interface GameLoop { pause(): void; resume(): void; step(ms: number): void; setSpeed(x: number): void; paused(): boolean; fps(): number }
export interface Services {
  bus: EventBus<GameEventMap>; scenes: SceneManager; input: InputRouter; viewport: { get(): Viewport };
  canvas: CanvasHost; save: SaveService; settings: SettingsStore; i18n: I18n;
  audio: AudioEngine; haptics: Haptics; platform: Platform; assets: AssetStore;
  content: ContentDB; ui: UiLayer; debug: DebugRegistry; loop: GameLoop; entitlements: Entitlements;
}
