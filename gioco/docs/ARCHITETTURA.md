# TRAMA: architettura tecnica
### Versione 1.0, 14 ottobre 2026

> Documento normativo per chi scrive il codice. Le regole del gioco stanno in `GDD.md` (sezione 3): qui c'è come si implementano.
> Tutti i percorsi sono relativi alla cartella `gioco/`. **Non si tocca niente fuori da `gioco/`**: il resto del repository è il sito di un'azienda di autisti.

---

## 1. Stack e motivazioni

| Componente | Versione | Perché |
|---|---|---|
| Node / npm | 22.22 / 10.9 (nel container) | |
| TypeScript | 7.0.2 (compilatore nativo). Se dà problemi su qualche funzione, si fissa la 6.0.x | `strict`, controllo dei tipi in `npm run build` |
| Vite | 8.3.4 | Dev server e build; `base: './'` perché la build funzioni in qualsiasi sottocartella e dentro la WebView |
| Renderer | **Canvas 2D** per il tombolo e i diorami, **DOM + CSS** per tutta l'interfaccia testuale | Vedi sotto |
| Capacitor | core, cli, ios, android 8.5.3 | Stesso codice web dentro app iOS e Android |
| Plugin Capacitor | app 8.1.2, haptics 8.0.2, preferences 8.0.1, splash-screen 8.0.2, screen-orientation 8.0.2, `@capacitor-community/keep-awake` 8.0.1; SystemBars è già nel core | Ciclo di vita, vibrazione, salvataggi nativi, splash, orientamento |
| `@capacitor/assets` | 3.0.5 | Icone e splash nativi da un'unica immagine |
| Font | `@fontsource/atkinson-hyperlegible`, `@fontsource/eb-garamond`, `@fontsource/caveat` (OFL), solo sottoinsieme latino | Inclusi nel bundle, nessuna richiesta di rete |
| Test unitari | Vitest (versione compatibile con Vite 8, da verificare all'installazione) | Motore, solver, salvataggi, contenuti |
| Test end-to-end | `@playwright/test` **fissato a 1.56.1** (è il Chromium presente in `/opt/pw-browsers`) | La 1.64 cerca un Chromium che non c'è |
| Script TS da riga di comando | `tsx` | `npm run levels:check` |
| Asset 3D | Blender 5.2.2 come modulo Python (`bpy`) nel venv indicato da `BLENDER_PY`; Pillow 12.3, numpy | Render Cycles su CPU |

**Perché Canvas 2D e non PixiJS o three.js.** L'elemento visivo principale, il merletto, è fatto di curve (Bézier, tratteggi, motivi): Canvas 2D le disegna nativamente e bene. Gli sprite sono pochi (al massimo 12 fusi, 3 figurine per vignetta, un diorama). Le righe già fissate si disegnano una volta in canvas fuori schermo, quindi a ogni fotogramma si ridisegna poco. Con Canvas 2D: bundle più piccolo, nessuna gestione della perdita di contesto WebGL su iOS, screenshot deterministici nei test, nessuna dipendenza esterna. Il testo (bigliettini, Taccuino, menu) va nel DOM: font veri, a capo automatico, i18n, accessibilità e dimensione del testo regolabile gratis.

**Niente framework UI.** L'interfaccia usa un piccolo helper (`el()`, componenti in `src/core/ui/`). Meno dipendenze, nessun conflitto di stato tra scena canvas e interfaccia.

---

## 2. Struttura delle cartelle e proprietà

Ogni cartella appartiene a **un solo pacchetto di lavoro** (sigla tra parentesi; vedi l'elenco dei pacchetti in fondo, sezione 18). Nessun pacchetto modifica file di un altro.

```
gioco/
├─ package.json, package-lock.json, tsconfig.json, vite.config.ts,
│  vitest.config.ts, playwright.config.ts, capacitor.config.ts,
│  index.html, .gitignore, README.md                         (F)
├─ docs/  GDD.md, ARCHITETTURA.md, RICERCA.md                 (documenti di progetto)
│         STORE.md                                            (P)
├─ src/
│  ├─ main.ts                                                 (F) avvio
│  ├─ core/                                                   (F) servizi condivisi
│  │  ├─ types.ts            tipi condivisi (sezione 4) – congelato dopo F
│  │  ├─ services.ts         registro dei servizi
│  │  ├─ events.ts           bus di eventi tipizzato
│  │  ├─ loop.ts             ciclo a passo fisso
│  │  ├─ input.ts, gestures.ts, keymap.ts
│  │  ├─ viewport.ts, canvas.ts
│  │  ├─ scenes.ts           gestore delle scene
│  │  ├─ save/               save.ts, backends.ts, migrate.ts, checksum.ts
│  │  ├─ i18n.ts, settings.ts, platform.ts, haptics.ts, entitlements.ts
│  │  ├─ assets.ts, placeholders.ts, rng.ts, debug.ts, fonts.ts, audio-stub.ts
│  │  ├─ boot.scene.ts       scena di avvio/diagnostica
│  │  └─ ui/                 dom.ts, components.ts, richtext.ts, layer.ts, theme.css, base.css
│  ├─ content/
│  │  ├─ loader.ts, validate.ts                               (F)
│  │  ├─ characters.json, places.json, book.json, balance.json,
│  │  │  campaign.json, lines.json, credits.json              (C1)
│  │  ├─ levels/g00…g08.json, arc1.json, arc2.json (+ .computed.json)  (C1)
│  │  ├─ levels/g09…g23.json, fin_*.json, arc3…arc6.json (+ .computed.json) (C2)
│  │  ├─ notes.atto1.json, diary.atto1.json, lettere.atto1.json         (C1)
│  │  ├─ notes.atto2.json, notes.atto3.json, diary.atto2.json,
│  │  │  diary.atto3.json, lettere.atto23.json, endings.json            (C2)
│  │  └─ text/<it|en>/comune.json, atto1.json                 (C1)
│  │     text/<it|en>/atto2.json, atto3.json, finali.json     (C2)
│  ├─ engine/                                                 (M) regole, solver, generatore
│  ├─ tombolo/                                                (T) scena della notte
│  ├─ campaign/                                               (S) flusso della storia, Taccuino, alba, archivio
│  ├─ screens/                                                (I) titolo, menu, impostazioni, modalità
│  ├─ audio/                                                  (A) motore audio
│  └─ i18n/<it|en>/core.json (F), tombolo.json (T), campaign.json (S),
│                   ui.json (I), audio.json (A)
├─ public/
│  ├─ assets/  manifest.json, atlas/, dio/, tab/, obj/        (B) generati e versionati
│  └─ icons/   icon-192.png, icon-512.png, favicon.png        (B)
├─ assets/     logo.png, splash.png, splash-dark.png          (B) sorgenti per @capacitor/assets
├─ tools/
│  ├─ blender/  common.py, fusi.py, figurine.py, diorami.py,
│  │            oggetti.py, icona.py, render_all.sh, README.md (B)
│  ├─ atlas/    pack.py, contact_sheet.py                     (B)
│  └─ levels/   check.ts, report.ts, daily-fallback.ts         (M)
├─ scripts/    android-build.sh, release-android.sh, release-ios.sh (P)
├─ android/, ios/                                             (P) progetti nativi generati e versionati
└─ tests/
   ├─ unit/core/ (F), unit/engine/ (M), unit/tombolo/ (T), unit/campaign/ (S),
   │  unit/screens/ (I), unit/audio/ (A), unit/content/atto1.test.ts (C1),
   │  unit/content/atto23.test.ts (C2)
   └─ e2e/smoke.spec.ts (F), e2e/*.spec.ts tutti gli altri (P)
```

Sigle: **F** fondamenta, **M** motore, **T** tombolo, **A** audio, **B** asset Blender, **I** interfaccia, **S** storia/campagna, **C1** contenuti Atto I, **C2** contenuti Atti II-III, **P** piattaforma e QA.

---

## 3. Avvio, registri, collaborazione fra pacchetti

### 3.1 Avvio (`src/main.ts`)

1. Importa `core/fonts.ts`, `core/ui/theme.css`, `core/ui/base.css`.
2. Crea i servizi del core (`services.ts`): bus, viewport, canvas host, input, settings, save (carica il salvataggio), i18n (lingua dalle impostazioni o dal browser), piattaforma, haptics, entitlements, debug, audio *stub* (no-op).
3. Carica i contenuti (`content/loader.ts`, sincrono, `import.meta.glob` con `eager: true`) e il manifest degli asset (`fetch('./assets/manifest.json')`; se manca, si usano i segnaposto).
4. **Registra i pacchetti**: `import.meta.glob('./*/register.ts', { eager: true })`. Ogni pacchetto ha un `register.ts` che registra scene, servizi (per esempio l'audio vero), pannelli, API di debug, e importa il suo CSS. Il core non conosce i pacchetti.
5. Avvia il ciclo e va alla scena `titolo` se registrata, altrimenti `boot` (scena diagnostica del core).
6. Nasconde lo splash nativo (`platform.hideSplash()`), chiede `navigator.storage.persist()` sul web.

### 3.2 Regole di collaborazione

- `src/core/types.ts` appartiene a F ed è **congelato** dopo la consegna di F. Chi ha bisogno di tipi propri li dichiara nel proprio modulo. Per aggiungere eventi si usa la fusione di dichiarazioni:
  ```ts
  // src/tombolo/events.d.ts (esempio)
  import '../core/types';
  declare module '../core/types' {
    interface GameEventMap { 'tombolo:zoom': { level: number } }
  }
  ```
  Una modifica indispensabile a `types.ts` va segnalata nel report finale del pacchetto; la applica solo F.
- Chiavi di testo solo nei propri file di namespace (sezione 10). CSS con prefisso di classe del pacchetto: `core-`, `tb-` (tombolo), `cp-` (campagna), `sc-` (schermate), nessuno per l'audio.
- Ogni pacchetto registra la propria API di debug in un proprio namespace (sezione 15).
- I pacchetti di contenuto scrivono solo JSON (più il proprio test). I dati sono validati da `content/validate.ts` (F) e dal solver (`npm run levels:check`, M).

---

## 4. Tipi condivisi (`src/core/types.ts`)

Questo è il contratto fra i pacchetti. F lo scrive **esattamente così** (si possono aggiungere commenti, non cambiare forme).

```ts
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
}
export type TutorialStep =
  | { k: 'mano'; hour: Hour; pair: number; over: Side }                       // mano fantasma che mostra l'incrocio
  | { k: 'margine'; when: 'versoSbagliato' | 'rifiuto' | 'primaOra' | 'spillo'; textKey: string; hour?: Hour }  // nota a margine di Clotilde
  | { k: 'pulsa'; target: 'fissa' | 'taccuino' | 'nome' | 'disfa'; hour: Hour };

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
  | { knows: 'quirk' | 'diary' | 'desire' | 'rule' | 'archive'; id: string }
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
export interface CampaignDay { id: LevelId; act: 0 | 1 | 2 | 3; pins: number; archiveAfter?: LevelId; objectAfter?: string; stonatura: number }
export interface CampaignDef { days: CampaignDay[]; finals: Record<EndingId, LevelId>; choiceDay: LevelId }
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
  base: { incroci: number; rows: RowMoves[] };
  perNote: Record<NoteId, { incroci: number | null; rows?: RowMoves[] }>;   // null = impossibile
  combos: { notes: NoteId[]; incroci: number | null; rows?: RowMoves[]; voluta?: boolean }[];
  matassaSuggerita: number;
  quieteMax: number;
  occasionsSolution?: OccasionDef[];   // livelli con occasioni: un insieme minimo che soddisfa gli obiettivi
  occasionsSolutions?: number;         // quanti insiemi validi esistono fra quelli ammessi
}
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
  /** Revisione 2 (Q014): uno spillo rosso lasciato cadere durante la notte (gettone, Spinta, Taccuino, debug). */
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
  | 'crossL' | 'crossR' | 'flip' | 'select' | 'skip' | 'auto' | 'tab';
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
  /**
   * Ambiente (GDD 13.3). `o.clock` (revisione 2) aggiunge (true) o toglie (false) l'orologio
   * che ticchetta; senza, c'è solo nella notte (fermo nel prologo). Il titolo chiede
   * `setAmbience('laguna', undefined, { clock: true })`: laguna e orologio (GDD 9).
   */
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
```

`src/core/services.ts` esporta `services: Services` (popolato all'avvio) e `registerAudio(a: AudioEngine): void`, che sostituisce lo stub.

---

## 5. Moduli e interfacce

### 5.1 Core (F)

| File | Responsabilità | API principale |
|---|---|---|
| `events.ts` | Bus tipizzato | `createBus<M>(): EventBus<M>`; registro degli ultimi 500 eventi per il debug |
| `loop.ts` | Ciclo a passo fisso (6) | `createLoop(onUpdate, onRender): GameLoop` |
| `input.ts`, `gestures.ts`, `keymap.ts` | Input unificato (7) | `InputRouter` |
| `viewport.ts`, `canvas.ts` | Dimensioni, DPR, safe area, layout (8) | `services.viewport.get()`, `services.canvas` |
| `scenes.ts` | Scene e transizioni (dissolvenza 200 ms) | `SceneManager`; inoltra update, render, resize, azioni, gesti e Indietro alla scena attiva, dopo i livelli modali di `input.pushLayer` |
| `save/*` | Salvataggi (9) | `SaveService` |
| `i18n.ts` | Testi (10) | `I18n`, più `richText(key, params): DocumentFragment` in `ui/richtext.ts` |
| `settings.ts` | Impostazioni con valori predefiniti; applica `--text-scale`, `data-contrast`, `data-motion` su `<html>` | `SettingsStore` |
| `platform.ts` | Web o Capacitor: pausa, ripresa, Indietro, condivisione, copia, splash, keep-awake, blocco verticale sui telefoni Android | `Platform` |
| `haptics.ts` | `@capacitor/haptics` in nativo, `navigator.vibrate` sul web (schemi: leggero `[10]`, medio `[20]`, successo `[15,40,15]`, rifiuto `[8,30,8]`), rispetta l'impostazione | `Haptics` |
| `assets.ts`, `placeholders.ts` | Caricamento atlas e immagini per gruppi; segnaposto disegnati in codice (fuso stilizzato del colore del personaggio, diorama a fasce di colore) quando un asset manca | `AssetStore` |
| `rng.ts` | `xmur3(str)`, `sfc32(a,b,c,d)`, `rngFromSeed(seed: string): () => number`, `shuffle`, `pick` | |
| `debug.ts` | `window.__GAME__` (15) | `DebugRegistry` |
| `entitlements.ts` | Sul web sempre `true` | `Entitlements` |
| `audio-stub.ts` | Implementazione vuota di `AudioEngine` | |
| `ui/dom.ts` | `el(tag, props, ...children)`, `clear(node)`, `on(node, ev, fn): Unsub` | |
| `ui/components.ts` | Componenti a tema: `button`, `iconButton`, `panel`, `tabs`, `slider`, `toggle`, `paperCard`, `modal`. Bersagli ≥ 48 px, focus visibile, navigazione da tastiera | |
| `ui/layer.ts` | `UiLayer`: pannelli, overlay, toast, conferme | |
| `ui/theme.css` | Token della palette (GDD 12.2), varianti alto contrasto e movimento ridotto | |
| `ui/base.css` | Reset, `user-select: none`, `-webkit-touch-callout: none`, `touch-action: none` sul canvas, `overscroll-behavior: none`, niente evidenziazione al tocco | |
| `content/loader.ts`, `content/validate.ts` | Carica e convalida i contenuti | `loadContent(): ContentDB`, `validateContent(db): string[]` (errori leggibili: riferimenti mancanti, colonne non ordinate, chiavi i18n mancanti, `initial` di lunghezza sbagliata…) |

### 5.2 Motore (M): `src/engine/`

Puro TypeScript, **nessun accesso a DOM, servizi o tempo**: gira identico nel browser, nel Web Worker e in Node.

| File | Contenuto |
|---|---|
| `index.ts` | Esporta l'API qui sotto |
| `context.ts` | `createContext(level, flags, opts?) → RunContext` (applica `riconciliate`: toglie `martaNoSotto`, `teresaLegge` e il rancore Teresa-Marta; `pieroTrabocca` resta) |
| `state.ts` | `initialState`, clonazione, chiavi di confronto |
| `rules.ts` | `blocked`, `checkCrossing`, `previewRow`, `applyRow` (ordine normativo GDD 3.4) |
| `conditions.ts` | Valutazione su una timeline; compilazione in bit di stato per il solver |
| `solver.ts`, `solver.worker.ts`, `solver-client.ts` | Solver a strati (vedi sotto); client asincrono basato su Worker |
| `autoweave.ts` | `planAutoRow` (GDD 3.10), usato anche per il filo nero |
| `hints.ts` | `hintFor(level, ctx, timeline, rows, goals, tier, solution?) → Hint` |
| `generator.ts`, `daily.ts`, `bot.ts` | Generatore procedurale, filtro di qualità, Merletto del giorno, giocatore avido |
| `spartito.ts` | Codifica e decodifica |
| `metrics.ts` | Incroci, quiete, simmetria, filo d'oro |
| `fixtures/*.json` | Livelli di test (prologo e g06 del GDD, livelli sintetici) |
| `data/daily-fallback.json` | 60 semi di riserva per il Merletto del giorno |

```ts
// src/engine/index.ts
export function createContext(level: LevelDef, flags: Record<FlagId, FlagValue>, opts?: { nomeOn?: ThreadId | null; occasions?: OccasionDef[] }): RunContext;
export function initialState(level: LevelDef, ctx: RunContext): LaceState;
export function blocked(level: LevelDef, state: LaceState, ctx: RunContext): ThreadId[];      // per la riga successiva
export function forcedCrossings(level: LevelDef, state: LaceState, ctx: RunContext): Crossing[]; // filo nero / autotessitura, riga successiva
/** Controllo immediato durante il trascinamento: null se l'incrocio è ammesso insieme a quelli già nella bozza. */
export function checkCrossing(level: LevelDef, state: LaceState, draft: Crossing[], c: Crossing, ctx: RunContext): Violation | null;
/** Applica la bozza senza controllare spilli e Gino: serve all'anteprima. */
export function previewRow(level: LevelDef, state: LaceState, draft: Crossing[], ctx: RunContext): RowResult;
/** Applica la riga con tutti i controlli. ok=false → violations spiega perché. */
export function applyRow(level: LevelDef, state: LaceState, draft: Crossing[], ctx: RunContext): RowResult;
export function unreachablePins(level: LevelDef, state: LaceState, ctx: RunContext): PinDef[];  // distanza > righe rimaste
export function evaluate(level: LevelDef, timeline: LaceState[], events: LaceEvent[][], conds: Condition[], ctx: RunContext, final: boolean): CondReport[];
export function metrics(level: LevelDef, rows: RowMoves[], minIncroci: number | null, fantasmaUsed: boolean): LaceMetrics;
export function solve(req: SolveRequest): SolveResult;              // sincrono (Node, worker)
export function solveAsync(req: SolveRequest): Promise<SolveResult>; // browser: Worker, annullabile con AbortSignal opzionale
export function planAutoRow(level: LevelDef, state: LaceState, ctx: RunContext, controlled?: Crossing | null): Crossing[];
export function hintFor(args: { level: LevelDef; ctx: RunContext; timeline: LaceState[]; rows: RowMoves[]; goals: Condition[]; tier: HintTier; solution?: RowMoves[] }): Hint;
export interface GenSpec { seed: string; columns: 4 | 5 | 6; rows: number; rule: RuleId; gradi: GradoId[]; difficulty: 'piccolo' | 'medio' | 'grande' }
export interface GenResult { level: LevelDef; min: number; optimalCount: number; tries: number; seedUsed: string; fromFallback: boolean }
export function generate(spec: GenSpec): GenResult;
export function dailySpec(date: string /* AAAA-MM-GG */): GenSpec;
export interface Spartito { mode: 'S' | 'G' | 'L'; ref: string; gradi?: GradoId[]; rows: RowMoves[] }
export function encodeSpartito(s: Spartito): string;
export function decodeSpartito(str: string): Spartito | null;
export const SOLVER_VERSION: number;
```

**Solver (implementazione richiesta).**

- Programmazione dinamica a strati: uno strato per ora. Per ogni stato raggiunto si tiene il costo minimo (incroci) e il puntatore al predecessore; alla fine si ricostruisce la soluzione.
- **Stato compatto**: permutazione codificata con il codice di Lehmer (≤ 720 valori), più i soli bit **rilevanti**: si compilano le condizioni e si tracciano solo le perline che compaiono negli obiettivi, nelle richieste o nelle stranezze attive (per esempio `letta:L1` solo se una condizione la nomina), più i bit "incontrati" per le sole coppie citate. Chiave numerica (fino a 53 bit) o stringa corta.
- Generazione delle mosse: accoppiamenti della riga che rispettano blocchi e incroci forzati (al massimo 13 con 6 colonne); il verso si enumera **solo** quando cambia qualcosa (uno dei due ha perline trasferibili tracciate, c'è una stranezza di verso, una condizione `sopra`), altrimenti si usa il verso sinistro.
- Potature: costo + limite inferiore (spilli futuri irraggiungibili) > matassa; condizioni già fallite; bit `nonHa`/`nonIncontra` violati.
- Misure del prototipo Python (da battere in TypeScript): prologo 18 stati; giornata 6 del GDD con N1+N2 636 stati; 6 colonne × 14 righe con 2 lettere, una voce, un segreto e 2 incontri tracciati: 152.000 stati con matassa = minimo + 2. Obiettivo TypeScript: ≤ 3 s in Node per quel caso, ≤ 1,5 s nel Worker per i suggerimenti (altrimenti si usa la soluzione precalcolata, o il suggerimento generico).

**Livelli con occasioni** (`fin_aperto`, `arc6`): `levels:check` enumera tutti i sottoinsiemi di `allowedOccasions` con al massimo `occasionSlots` elementi (i contenuti limitano `allowedOccasions` a 10-14 celle, quindi qualche migliaio di combinazioni), simula la giornata con `planAutoRow` e salva in `occasionsSolution` l'insieme valido più piccolo e in `occasionsSolutions` quanti ce ne sono (devono essere fra 1 e 20: né impossibile né banale). Per `fin_seppia` la soluzione di riferimento è in `base.rows` (le mosse del filo controllato).

**Generatore** (`generate`): per `k = 0…499` prova il seme `seed#k`: dispone cast e lino, sceglie perline e obiettivi secondo la regola, calcola il minimo con il solver, applica il filtro di qualità del GDD (8.3). Deterministico: stessa versione del gioco e stesso seme danno lo stesso livello. Il giocatore avido (`bot.ts`) a ogni riga sceglie l'insieme di incroci che massimizza un punteggio di progresso (distanze dagli spilli, lettere più vicine ai destinatari, vincoli rispettati).

### 5.3 Tombolo (T): `src/tombolo/`

Una sola scena (`TomboloScene`, id `tombolo`) che riceve `NightParams` ed emette `night:complete` (e `night:drop` quando uno spillo si lascia cadere, revisione 2).

Agganci della notte (revisione 2, Q012): il tombolo non importa la campagna. Le azioni che appartengono a chi ha aperto la notte passano da `setNightHooks({ backToEvening: { can, go } })` (`src/tombolo/active.ts`, esportato da `src/tombolo/index.ts`): la campagna lo registra in `controller.install()`, e la Spinta «le richieste non stanno insieme» offre «Torna alla sera» accanto a «Lascia cadere» finché `can()` è vero (prima della prima ora di una notte della storia).

| File | Contenuto |
|---|---|
| `register.ts` | Registra la scena, il debug `night`, il CSS |
| `TomboloScene.ts` | Ciclo di vita, stato della notte (`NightSession`), autosalvataggio |
| `session.ts` | `NightSession`: timeline, bozza della riga, Disfa, riavvolgimento, richieste lasciate cadere, suggerimenti; nessun disegno |
| `layout.ts` | Calcolo della disposizione (GDD 10.3): fasce, colonne, altezza righe, aree di tocco; stretto e largo |
| `render/velvet.ts`, `render/threads.ts`, `render/patterns.ts`, `render/beads.ts`, `render/pins.ts`, `render/spindles.ts`, `render/cache.ts` | Disegno del merletto (GDD 12.3), cache delle righe fissate in strisce fuori schermo |
| `interact.ts` | Trascinamento dei fusi, tocco per rovesciare, scorrimento, tastiera, nome di Ada |
| `modes/archive.ts` | Fili sbiaditi, nominare a gruppi di 3, rammendo contro `recorded` |
| `modes/autoweave.ts` | Filo controllato (`fin_seppia`), piazzamento delle occasioni e "Lascia accadere" |
| `modes/replay.ts` | Spartito e Ripassa |
| `ui/hud.ts`, `ui/actionbar.ts`, `ui/requests.ts`, `ui/hintlamp.ts`, `ui/charcard.ts` | Interfaccia DOM sopra il canvas |

```ts
// src/tombolo/session.ts (API usata dalla scena e dal debug)
export interface NightSession {
  readonly params: NightParams; readonly ctx: RunContext;
  readonly timeline: LaceState[];          // timeline[0] = apertura
  readonly rows: RowMoves[];               // righe fissate
  readonly draft: Crossing[];              // riga corrente
  readonly hour: Hour;                     // ora della riga corrente
  propose(c: Crossing): Violation | null;  // aggiunge alla bozza se valido
  flip(pair: number): Violation | null;
  remove(pair: number): void;
  preview(): RowResult;
  fix(): RowResult;                        // ok → nuova riga, autosalvataggio, eventi
  undo(): void;                            // toglie l'ultimo incrocio della bozza, o riapre la riga precedente
  rewindTo(hour: Hour): void;
  setNome(thread: ThreadId): void;
  drop(noteId: NoteId): void;
  requestStatus(): { noteId: NoteId; report: CondReport }[];
  hint(tier: HintTier): Promise<Hint>;
  complete(): NightOutcome;                // chiamato dopo l'ultima riga
  toResume(): NightResume;
}
```

Tutorial: il tombolo esegue i `tutorial` del livello. `mano` mostra una mano fantasma che ripete il trascinamento finché il giocatore non fa un incrocio in quella riga; `margine` fa comparire a mano, sul bordo del merletto, una nota di Clotilde quando succede l'evento indicato (`versoSbagliato` = un incrocio in cui una lettera passerebbe solo col verso opposto); `pulsa` fa pulsare un pulsante.

Regole d'interfaccia: soglia di trascinamento 8 px; l'incrocio si propone quando il fuso supera il 50% della colonna vicina; a ogni proposta si chiama `checkCrossing` e, se c'è un rifiuto, il fuso rimbalza (animazione 200 ms), suona `rifiuto`, vibra `rifiuto` e appare la riga di spiegazione. "Fissa l'ora" chiama `applyRow`; se `ok=false` mostra la prima violazione.

### 5.4 Storia e campagna (S): `src/campaign/`

| File | Contenuto |
|---|---|
| `register.ts` | Scene `sera`, `alba`, `bilancio`, `archivio`, `finale`; pannelli `taccuino` e `bigliettini`; debug `campaign` |
| `controller.ts` | Macchina a stati della campagna (fasi di `CampaignCore`), avvio delle notti (`scenes.go('tombolo', NightParams)`) e ricezione di `night:complete` con origine `campagna`, `archivio` o `telaio` |
| `story.ts` | `evalStory(cond: StoryCond, s: CampaignState, k: Knowledge): boolean`; `applyEffects(effects, s, k)` |
| `evening.ts` + `SeraScene.ts` | Oggetto della laguna, bigliettini, spilli, risposte, autori anonimi |
| `dawn.ts` + `AlbaScene.ts` | Selezione delle vignette (GDD 5.9), riproduzione con babble, salta, avanzamento automatico |
| `memoria.ts` | Aggiornamento della memoria a fine giornata (GDD 3.11) |
| `BilancioScene.ts` | Esiti, Taccuino nuovo, eleganza, record, spartito |
| `taccuino/*.ts` | Pannello a schede (GDD 5.8) |
| `ArchivioScene.ts` | Cassapanca; avvia il tombolo in modo `archivio`; eco e vignetta di rivelazione |
| `endings.ts` + `FinaleScene.ts` | Scelta di g23, requisiti e mancanze, epiloghi, titoli col carillon |
| `rewind.ts` | Riprendi da qui: ripristina `snapshots[levelId]`, conserva `Knowledge` |
| `TelaioScene.ts` | Telaio (GDD 10.3): mappa delle giornate, Rigioca, Riprendi da qui, Riascolta, epiloghi visti |
| `vignette.ts` | Componente diorama + figure + testo, usato da alba, archivio e finali |

```ts
// src/campaign/controller.ts
export interface CampaignController {
  newGame(): Promise<void>;
  continueGame(): Promise<void>;
  resumeFrom(levelId: LevelId): Promise<void>;   // Riprendi da qui
  replay(levelId: LevelId): Promise<void>;       // Rigioca (non cambia la storia)
  state(): CampaignState | null;
  knowledge(): Knowledge;
}
export const campaign: CampaignController;
```

**Contratto con le schermate (I).** Le schermate non importano il controller: navigano per scena. `scenes.go('sera', { cmd: 'nuova' })` avvia una nuova storia (con conferma se ne esiste una), `{ cmd: 'continua' }` riprende dal salvataggio (anche a metà notte), `scenes.go('telaio')` apre il Telaio. Il titolo mostra "Continua" se `save.data().campaign` non è nullo.

### 5.5 Schermate (I): `src/screens/`

Scene `titolo`, `giornaliero`, `libero`, `impostazioni`, `crediti`; overlay `pausa`; import dello spartito; condivisione (testo + PNG del merletto generato con `renderLacePng(level, rows): Promise<Blob>`, funzione di T esportata da `src/tombolo/export.ts`). Il menu Pausa si registra come overlay `pausa` in `UiLayer` e il tombolo lo apre con `ui.openOverlay('pausa')`.

### 5.6 Audio (A): `src/audio/`

`register.ts` crea l'implementazione e chiama `registerAudio()`. Si iscrive agli eventi del bus per i suoni automatici (incrocio, rifiuto, ora fissata, consegna) così le altre scene non devono chiamarlo per ogni dettaglio; le scene chiamano direttamente solo babble, carillon, ambiente e musica. File: `engine.ts` (contesto, bus, limitatore di voci), `synth/wood.ts`, `synth/musicbox.ts`, `synth/bell.ts`, `synth/noise.ts`, `synth/babble.ts`, `ambience.ts`, `music.ts`, `captions.ts`, `autoplay.ts` (sblocco e overlay "Tocca per continuare").

---

## 6. Ciclo di gioco a passo fisso

```ts
// src/core/loop.ts
const STEP = 1 / 60;           // secondi
const MAX_FRAME = 0.25;        // dt massimo dopo una ripresa
const MAX_STEPS = 5;
let acc = 0, last = performance.now() / 1000, speed = 1, paused = false, raf = 0;
function frame(nowMs: number) {
  raf = requestAnimationFrame(frame);
  const now = nowMs / 1000;
  let dt = Math.min(now - last, MAX_FRAME); last = now;
  if (paused) return;
  acc += dt * speed;
  let steps = 0;
  while (acc >= STEP && steps < MAX_STEPS) { onUpdate(STEP); acc -= STEP; steps++; }
  if (steps === MAX_STEPS) acc = 0;           // niente spirale della morte
  onRender(acc / STEP);
}
```

- `visibilitychange` nascosto → `pause()` e salvataggio immediato; visibile → `resume()` (con `last` riallineato, così il `dt` non salta).
- Debug: `__GAME__.core.time.pause()`, `.step(ms)` (esegue gli update a passi di 1/60 e un render), `.setSpeed(x)` (i test usano 8× per le animazioni).
- Il gioco è a turni: le animazioni (fusi, perline, campana) sono interpolazioni dentro `update`; la logica non dipende dal tempo. Con "Velocità animazioni = istantanea" le durate valgono 0.
- iOS WebView: rAF a 60 Hz; Android può andare a 90-120 Hz: il passo fisso rende tutto uguale.

---

## 7. Input unificato

- Solo **Pointer Events** sul canvas e sul livello UI, con `setPointerCapture` sul `pointerdown`. Niente eventi touch o mouse separati.
- Riconoscitore di gesti (`gestures.ts`): **tap** (spostamento ≤ 10 px e durata ≤ 300 ms), **longpress** (500 ms fermo entro 10 px; annulla il tap), **drag** (oltre 8 px: `dragstart`, `drag`, `dragend`; `dragcancel` su `pointercancel`), **wheel**. Un solo puntatore attivo: i tocchi successivi sono ignorati finché il primo non finisce. Coordinate in px CSS relative al canvas.
- Tastiera (`keymap.ts`) → `ActionEvent` secondo GDD 11.3. Ripetizione per le frecce. `Tab` e `Esc` non escono dal gioco (`preventDefault`), salvo nei campi di testo.
- **Livelli**: `input.pushLayer('pausa')` fa sì che solo il livello in cima riceva azioni e gesti finché non si chiama l'`Unsub`. Le scene ricevono solo se non c'è un overlay sopra.
- Indietro: tasto Indietro di Android (`platform.onBack`) e `Esc` producono `ActionEvent 'back'`; la catena è: overlay in cima → scena (`onBack`) → nel titolo, su nativo, conferma di uscita.
- Il primo `pointerdown` o `keydown` della sessione chiama `services.audio.unlock()` **dentro il gestore, in modo sincrono**.
- Nessun comportamento da browser: `contextmenu` disabilitato sul gioco, `touch-action: none`, `user-select: none`, meta viewport con `user-scalable=no`, `overscroll-behavior: none` su `html` e `body`.

---

## 8. Dimensioni, layout e safe area

- `index.html`: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">`, `html, body { height: 100dvh; background: var(--velluto) }`.
- Canvas: dimensione CSS `100dvw × 100dvh`, risoluzione interna `css × dpr` con `dpr = Math.min(devicePixelRatio, 2)`, `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`: tutto il codice disegna in px CSS.
- Aggiornamento su `ResizeObserver` del contenitore + `visualViewport.resize` + `orientationchange`, con un debounce di 50 ms; emette `viewport:change`.
- **Safe area**: un `<div id="safe-probe">` invisibile con `padding: env(safe-area-inset-top, var(--safe-area-inset-top, 0px)) …`; `getComputedStyle` ne legge i quattro valori. Le variabili `--safe-area-inset-*` sono quelle che SystemBars di Capacitor inietta sulle WebView Android vecchie. Nei test si simula la safe area impostando quelle variabili.
- Layout: `largo` se `cssW >= 900 && cssW / cssH >= 1.15`, altrimenti `stretto`. Nel layout largo il tombolo monta i pannelli `bigliettini` (sinistra) e `taccuino` (destra) con `ui.mountPanel`; nello stretto li apre come overlay.
- Testo: `html { font-size: calc(17px * var(--text-scale)) }`; i componenti usano `rem`.
- Orientamento: telefoni bloccati in verticale (impostazioni native, sezione 14); sul web nessun blocco: in orizzontale su telefono si usa comunque il layout stretto centrato con larghezza massima 520 px.

---

## 9. Salvataggi

- **Backend**: `StorageBackend` con due implementazioni in `save/backends.ts`:
  - `LocalStorageBackend` (web), con ogni accesso dentro `try/catch` (navigazione privata, spazio pieno → si continua in memoria e si mostra un avviso una volta);
  - `PreferencesBackend` (`@capacitor/preferences`, importato dinamicamente solo se `Capacitor.isNativePlatform()`): UserDefaults su iOS, SharedPreferences su Android, che non vengono svuotati come lo storage della WebView.
- **Formato**: `SaveData` (sezione 4) in JSON, con involucro `{ "v": 1, "sum": "<fnv1a32 esadecimale>", "data": {…} }`.
- **Due slot alternati**: chiavi `trama.v1.a` e `trama.v1.b`, più `trama.v1.ultimo` con il nome dell'ultimo slot scritto. In lettura si prende il più recente con checksum valido; se è corrotto, l'altro.
- **Migrazioni**: `migrate.ts` contiene `migrations: Record<number, (old: unknown) => unknown>`; si applicano in ordine fino a `schema` corrente. Test per ogni migrazione.
- **Quando si salva**: a ogni ora fissata (`night:row`), a ogni cambio di fase della campagna, al termine di ogni modalità, su `visibilitychange` nascosto, `pagehide`, `platform.onPause`. Le scritture normali sono raggruppate (massimo una ogni 2 s); quelle con `immediate: true` partono subito.
- **Ripresa a metà notte**: `SaveData.night` contiene i parametri della notte (con `levelId` al posto del livello: i livelli procedurali si rigenerano dal seme) e `NightResume`. "Continua" riapre il tombolo esattamente alla riga corrente.
- **Esporta / Importa**: stringa `TRAMA-SAVE-1:` + base64url del JSON compresso (`CompressionStream('gzip')` se disponibile, altrimenti non compresso). L'import verifica checksum e schema prima di sovrascrivere (con conferma).
- `appId` (`it.trama.merletto`) e scheme della WebView non si cambiano mai dopo l'uscita: lo storage dipende dall'origine.

---

## 10. Testi e lingue (i18n)

- File JSON per lingua e namespace: `src/i18n/<locale>/<ns>.json` (testi d'interfaccia, un namespace per pacchetto) e `src/content/text/<locale>/<ns>.json` (testi narrativi). La chiave completa è `<ns>.<percorso>`, per esempio `atto1.g03.nina.testo`, `ui.titolo.continua`, `tombolo.violazione.spillo`.
- Caricamento con `import.meta.glob(…, { eager: true })`; un namespace definito due volte è un errore (test).
- Interpolazione `{nome}`; plurali `{n, plural, one {# incrocio} other {# incroci}}`; marcatori ammessi nei testi: `*corsivo*`, `**grassetto**`, `[[teresa]]` (nome del personaggio nel suo colore, con icona). `richText` li converte in nodi DOM, mai `innerHTML`.
- Catena di riserva: lingua scelta → italiano → la chiave stessa (in sviluppo con un bordo rosso e un avviso in console).
- Test: nessuna chiave usata nel codice o nei dati manca in italiano; per l'inglese, nessuna chiave dei namespace `core`, `ui`, `tombolo`, `campaign`, `audio`, `comune` manca (L1); le altre sono L2 e il test le elenca senza fallire.
- Regole di scrittura: righe di testo di gioco ≤ 90 caratteri; nessun testo dentro le immagini; date e numeri con `Intl`.

---

## 11. Audio engine

Specifica sonora completa in GDD 13. Implementazione:

- Un `AudioContext` creato in `unlock()` (chiamato in modo sincrono dal primo gesto). Prima dello sblocco tutte le chiamate sono ignorate senza errori.
- Grafo: sorgenti → bus (`musica`, `effetti`, `voci`, `ambiente`) → `master` (GainNode) → `DynamicsCompressorNode` (soglia -18 dB, rapporto 3, attacco 5 ms, rilascio 200 ms) → destinazione.
- Limitatore di voci: massimo 48 nodi sorgente attivi; oltre, si ferma il più vecchio degli effetti.
- Pre-render dopo lo sblocco, a lotti in `requestIdleCallback` (o `setTimeout` 0): 3 colpi di campana per ogni valore di stonatura usato (1; 0,6; 0,25; 0), rumori base (rosa, marrone, bianco: 2 s ciascuno, in loop). Totale < 300 ms di CPU.
- Ambiente e musica: nodi persistenti con dissolvenze `setTargetAtTime` (costante 0,3 s).
- Ciclo di vita: `suspend()` su pagina nascosta e pausa dell'app; `resume()` al ritorno; se `state !== 'running'` dopo `resume()` (iOS `interrupted`), si mostra l'overlay "Tocca per continuare" (`audio/autoplay.ts`), che al tocco richiama `resume()`.
- Didascalie: ogni suono significativo emette `audio:caption`; il core le mostra in basso a sinistra se l'impostazione è attiva.
- Debug/test: `__GAME__.audio.log()` restituisce gli ultimi 200 suoni richiesti (`{ id, t }`), anche senza contesto audio (nei test headless).

---

## 12. Pipeline degli asset (Blender)

- **Interprete**: `BLENDER_PY` (variabile d'ambiente). Valore predefinito in questo container: `/tmp/claude-0/-home-user-claude/c3e3ef47-6c71-52f7-905c-1c8a39dab6eb/scratchpad/bvenv/bin/python` (venv con `bpy` 5.2.2, Pillow, numpy). È un percorso di sessione: `tools/blender/README.md` spiega come ricreare il venv (`python3.13 -m venv bvenv && bvenv/bin/pip install bpy==5.2.2 pillow numpy`).
- **Comando**: `npm run assets:render` → `tools/blender/render_all.sh`, che lancia **ogni script in un sottoprocesso separato** (un crash di Blender non solleva eccezioni Python: si controlla il codice d'uscita) e poi `tools/atlas/pack.py`. Gli asset generati sono **versionati nel repository**: la build del gioco non richiede Blender.
- **Script**:
  - `common.py`: reset della scena (`read_factory_settings(use_empty=True)`), palette in sRGB convertita in lineare, materiali (legno procedurale con texture Wave + Noise, vernice opaca, metallo per l'ottone, acqua lucida), rig di camera e luci, impostazioni di render, salvataggio. Semi casuali fissi per ogni asset (`random.seed(nome)`).
  - `fusi.py`, `figurine.py`, `diorami.py`, `oggetti.py`, `icona.py`: uno per gruppo (GDD 12.5). Ogni script accetta `--only <nome>` e `--out <cartella>`.
  - `tools/atlas/pack.py`: impacchetta (algoritmo a scaffali, padding 2 px, estrusione dei bordi 1 px) gli sprite in `public/assets/atlas/atlas_<n>.png` ≤ 2048×2048; converte diorami e quadri in WebP qualità 80 in `public/assets/dio/` e `public/assets/tab/`; genera `public/assets/manifest.json` (formato `AssetManifest`), `assets/logo.png`, `assets/splash*.png`, `public/icons/*`.
  - `tools/atlas/contact_sheet.py`: fogli di controllo in `tools/blender/out/contact_*.png` (non pubblicati) per la revisione visiva.
- **Impostazioni di render**: Cycles, dispositivo CPU, 4 thread; campioni 24 per gli sprite e 32 per i diorami; denoiser OIDN; `scene.render.use_persistent_data = True`; `view_settings.view_transform = 'Standard'`, `look = 'None'`; PNG RGBA 8 bit; `film_transparent = True` per sprite e oggetti. Contorni Freestyle (spessore 1,2 px, colore `#2B2622`) su figurine e diorami, con lineset e linestyle creati esplicitamente. Mai EEVEE (nel container è inutilizzabile); niente Workbench (dipende da Mesa).
- **Camere** (tutte ortografiche):
  - fusi: frontale, elevazione 8°, inquadratura sul bounding box + 6%, 96×320;
  - figurine: tre quarti (azimut 30°, elevazione 20°), 256×256, piede della basetta all'ancora `ay = 0.92`;
  - diorami: frontale dalla laguna, elevazione 30°, 1024×768, soggetto principale nell'area sicura centrale 768×576 (il gioco li ritaglia a "cover" su schermi diversi);
  - oggetti: tre quarti, 256×256 (tombolo 1024×1024).
- **Luci**: giorno: sole caldo `#FFE2B8` intensità 3,5 a 50° da sinistra + area fredda `#A9BBD9` 0,8; alba: sole basso 8° `#FFB38A` 2,5 + cielo `#D9C3B0`; notte: luna `#8FA6D9` 0,6 + finestre emissive `#FFB24A` 4,0 + lampione.
- **Convenzioni di nome**: frame `fuso/<id>`, `fuso/stile_<n>`, `fig/<id>/<posa>`, `fig/ada/<posa>_grezza`, `obj/<nome>`; immagini `dio/<luogo>/<luce>`, `tab/<nome>`. Gruppi di caricamento: `core` (atlas), `dio` (diorami), `tab` (quadri).
- **Tempi attesi** (misurati nel container): circa 0,12-0,6 s a sprite, 20-40 s a diorama; l'intera pipeline sta sotto i 20 minuti.

---

## 13. Capacitor e build native ("un comando")

**`capacitor.config.ts`** (F):

```ts
import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'it.trama.merletto',      // MAI cambiarlo dopo la prima pubblicazione
  appName: 'Trama',
  webDir: 'dist',
  backgroundColor: '#1C2233',
  ios: { contentInset: 'never', scrollEnabled: false },
  android: { allowMixedContent: false },
  plugins: {
    SystemBars: { hidden: true, insetsHandling: 'css', style: 'DARK' },
    SplashScreen: { launchAutoHide: false, showSpinner: false, backgroundColor: '#1C2233' },
  },
};
export default config;
```

**Script npm** (in `package.json`, F):

| Script | Comando | Dove |
|---|---|---|
| `dev` | `vite --host` | ovunque |
| `build` | `tsc --noEmit && vite build` | ovunque |
| `preview` | `vite preview --host --port 4173` | ovunque |
| `test` | `vitest run` | ovunque |
| `test:e2e` | `playwright test` | ovunque |
| `levels:check` | `tsx tools/levels/check.ts` | ovunque |
| `assets:render` | `bash tools/blender/render_all.sh` | container con Blender |
| `assets:native` | `capacitor-assets generate --ios --android --iconBackgroundColor '#1C2233' --iconBackgroundColorDark '#1C2233' --splashBackgroundColor '#1C2233' --splashBackgroundColorDark '#1C2233'` | dopo `cap add` |
| `app:sync` | `npm run build && cap sync` | ovunque |
| `app:android` | `npm run build && cap sync android && cap open android` | Mac/PC con Android Studio |
| `app:ios` | `npm run build && cap sync ios && cap open ios` | Mac con Xcode |
| `app:run:android` / `app:run:ios` | `npm run build && cap run android` / `… ios` | con dispositivo o emulatore |
| `android:apk` | `npm run app:sync && bash scripts/android-build.sh assembleDebug` | container (SDK Android presente) |
| `release:android` | `bash scripts/release-android.sh` (build, sync, `cap build android --androidreleasetype AAB` firmato con `$KEYSTORE_PATH`, `$KEYSTORE_PASS`, alias `upload`) | Mac/PC |
| `release:ios` | `bash scripts/release-ios.sh` (build, sync, `cap build ios --xcode-team-id $APPLE_TEAM_ID --xcode-export-method app-store-connect`) | Mac |

`scripts/android-build.sh` ritenta Gradle fino a 5 volte con attesa crescente (Maven Central attraverso il proxy risponde a volte 429). Il keystore non entra mai nel repository (`.gitignore`).

**Progetti nativi** (P), generati qui con `npx cap add android` e `npx cap add ios` (funzionano su Linux; iOS usa Swift Package Manager, niente CocoaPods) e **versionati**:

- Android (`android/app/src/main/AndroidManifest.xml`): `android:appCategory="game"` su `<application>`; `android:screenOrientation="fullUser"` sull'activity; all'avvio, se il lato corto dello schermo è < 600 dp, `ScreenOrientation.lock({ orientation: 'portrait' })` (in `platform.ts`). minSdk 24, target/compile 36.
- iOS (`ios/App/App/Info.plist`): `UISupportedInterfaceOrientations` (iPhone) solo `Portrait`; `UISupportedInterfaceOrientations~ipad` tutti e quattro; `UIStatusBarHidden = true`; niente `UIRequiresFullScreen` (deprecato). Nessuna chiamata a `lock()` su iOS (così non serve modificare l'AppDelegate). `ios/App/App/PrivacyInfo.xcprivacy` con `NSPrivacyTracking = false`, nessun dominio di tracciamento, `NSPrivacyAccessedAPICategoryUserDefaults` con motivo `CA92.1`.
- Icone e splash: `npm run assets:native` da `assets/logo.png` (1024, opaca) e `assets/splash*.png`.

**Sul Mac dell'autore, quando vorrà pubblicare:** Node 22+, Xcode 26+ (obbligatorio per caricare su App Store dal 28/04/2026), Android Studio 2025.2.1 o successivo. Poi `npm ci && npm run app:ios` (oppure `app:android`) apre il progetto pronto; `npm run release:*` produce i pacchetti firmati. Google Play per gli account personali nuovi richiede un test chiuso con 12 tester per 14 giorni: va pianificato presto. Tutto in `docs/STORE.md` (P).

---

## 14. Formato dei dati (esempi normativi)

### 14.1 Livello: il prologo (`src/content/levels/g00.json`)

```json
{
  "id": "g00", "kind": "storia", "act": 0, "titleKey": "atto1.g00.titolo",
  "columns": ["forno", "piazza", "chiesa"],
  "startHour": 5, "endHour": 9,
  "threads": [
    { "id": "teresa", "kind": "persona", "character": "teresa" },
    { "id": "marta", "kind": "persona", "character": "marta" },
    { "id": "piero", "kind": "persona", "character": "piero" }
  ],
  "initial": ["teresa", "marta", "piero"],
  "beads": [ { "id": "L1", "type": "lettera", "holder": "teresa", "to": "piero", "labelKey": "atto1.g00.perline.L1" } ],
  "rules": ["incrocio", "spillo", "lettera"],
  "quirks": ["martaNoSotto", "teresaLegge", "pieroPozzo"],
  "pins": [
    { "thread": "marta", "place": "forno", "hour": 6 },
    { "thread": "teresa", "place": "forno", "hour": 9 },
    { "thread": "piero", "place": "chiesa", "hour": 9 }
  ],
  "goals": [ { "t": "consegnata", "bead": "L1", "by": 9 } ],
  "matassa": 6,
  "dawn": { "candidates": [
    { "id": "g00.alba.marta", "priority": 100, "background": "dio/forno/alba",
      "figures": [ { "character": "marta", "pose": "porge", "x": 0.5 } ],
      "lines": [ { "speaker": "marta", "textKey": "atto1.g00.alba.marta" } ] }
  ] },
  "hintKeys": { "spinta": "atto1.g00.hint.spinta" },
  "tutorial": [
    { "k": "mano", "hour": 6, "pair": 0, "over": "R" },
    { "k": "pulsa", "target": "fissa", "hour": 6 },
    { "k": "margine", "when": "versoSbagliato", "textKey": "atto1.g00.margine.sopraDa", "hour": 7 }
  ]
}
```

Il file calcolato accanto (`g00.computed.json`, scritto da `npm run levels:check`) contiene `LevelComputed`: per il prologo `base.incroci = 4`, `quieteMax = 0`, `sourceHash` = hash del JSON sorgente normalizzato.

### 14.2 Bigliettino (`notes.atto1.json`, array di `NoteDef`)

```json
{
  "id": "g03.nina", "day": "g03", "author": "nina",
  "textKey": "atto1.g03.nina.testo",
  "request": { "t": "parte", "who": "nina", "hour": 9 },
  "replies": [
    { "id": "R1", "textKey": "atto1.g03.nina.r1", "effects": [ { "setFlag": "ninaDillo", "value": true } ] },
    { "id": "R2", "textKey": "atto1.g03.nina.r2", "effects": [ { "setFlag": "ninaVai", "value": true } ] }
  ],
  "onOk": [ { "setFlag": "ninaEsame", "value": true }, { "desire": "nina" } ],
  "onFail": [ { "diary": "persone.nina.esamePerso" } ],
  "onIgnore": [ { "desire": "nina" } ]
}
```

### 14.3 Voce di Taccuino e battuta

```json
{ "id": "persone.marta.noSotto", "section": "persone", "character": "marta",
  "textKey": "atto1.diario.marta.noSotto", "source": "visto",
  "unlock": { "knows": "quirk", "id": "martaNoSotto" } }
```

```json
{ "id": "marta.nodo.teresa.1", "character": "marta", "event": "nodo", "with": "teresa",
  "textKey": "comune.battute.marta.nodo.1", "forgetKey": "comune.battute.marta.nodo.1d", "priority": 10 }
```

### 14.4 Personaggio (`characters.json`)

```json
{ "id": "teresa", "nameKey": "comune.pers.teresa.nome", "roleKey": "comune.pers.teresa.ruolo",
  "color": "#2F5DA8", "pattern": "righe", "icon": "busta", "noteHz": 440.0,
  "voice": { "pitch": 260, "rate": 11, "formantShift": 0, "noise": 0 },
  "hand": { "font": "caveat", "ink": "#24407A", "paper": "#DCE6EE", "slantDeg": -2, "sizeScale": 1 },
  "quirks": ["teresaLegge"], "desireKey": "comune.pers.teresa.desiderio", "likes": ["festa", "messa"] }
```

### 14.5 Campagna (`campaign.json`)

```json
{ "choiceDay": "g23",
  "finals": { "merlettaia": "fin_merlettaia", "seppia": "fin_seppia", "chiuso": "fin_chiuso", "aperto": "fin_aperto" },
  "days": [
    { "id": "g00", "act": 0, "pins": 0, "stonatura": 1, "objectAfter": "merletto_avorio" },
    { "id": "g01", "act": 1, "pins": 2, "stonatura": 1, "objectAfter": "lettera_L1" },
    { "id": "g03", "act": 1, "pins": 2, "stonatura": 1, "archiveAfter": "arc1", "objectAfter": "lettera_L3" }
  ] }
```

(Elenco completo: g00-g23 nell'ordine del GDD 5.2.)

### 14.6 Spartito

`TRAMA1-<modo><riferimento>[~<gradi>]-<righe>-<controllo>`

- modo: `S` (giornata di storia, riferimento = id), `G` (giornaliero, `AAAAMMGG`), `L` (libero, seme in base36);
- gradi: iniziali separate da `+` (`me+sd+sv+ni+np+nc`);
- righe: una per ora giocabile, separate da `.`; riga vuota `_`; ogni incrocio è una lettera `a…l` = `coppia*2 + (verso === 'R' ? 1 : 0)`; gli incroci forzati (filo nero) non si scrivono;
- controllo: 2 caratteri base36 dell'FNV-1a dei campi precedenti.

---

## 15. API di debug e strategia di test

### 15.1 `window.__GAME__`

Attiva in sviluppo, con `?debug=1` nell'URL, e nelle build di test (`VITE_E2E=1`). Disattiva nelle build per gli store. Ogni pacchetto registra il proprio namespace con `services.debug.register(ns, api)`. Tutte le funzioni sono sincrone o restituiscono una Promise; tutti i valori restituiti sono serializzabili (JSON).

| Namespace (pacchetto) | Funzioni |
|---|---|
| `__GAME__.ready` (F) | Promise risolta quando l'avvio è finito |
| `core` (F) | `scene()`, `goto(id, params?)`, `save()` (SaveData), `setSettings(p)`, `wipe()`, `exportSave()`, `importSave(s)`, `viewport()`, `events(n?)` (ultimi eventi), `emit(nome, payload)`, `perf()` (fps, ms per fotogramma p50/p95), `time.pause()`, `time.resume()`, `time.step(ms)`, `time.setSpeed(x)`, `missingAssets()`, `missingKeys(locale?)` |
| `engine` (M) | `level(id)`, `solve(levelId, noteIds?, opts?)`, `computed(levelId)`, `daily(date)`, `generate(spec)`, `encode(spartito)`, `decode(str)` |
| `night` (T) | `state()` (righe, bozza, ora, timeline, richieste e loro stato), `cross(pair, over)`, `flip(pair)`, `remove(pair)`, `fix()`, `undo()`, `rewind(hour)`, `setNome(thread)`, `drop(noteId)`, `autoplay(rows?, msPerRow?)` (senza argomenti usa la soluzione calcolata per le richieste accettate), `hint(tier)`, `name(thread, character)` (archivio), `occasions(list)` e `run()` (finale aperto), `move(dir)` (filo controllato), `layout()` (rettangoli di fusi, righe, pulsanti in px CSS: servono ai test per trascinare davvero) |
| `campaign` (S) | `state()`, `knowledge()`, `newGame()`, `goto(levelId, phase)`, `accept(noteIds, guesses?)`, `reply(noteId, 'R1' \| 'R2')`, `toNight()`, `skipDawn()`, `finishDay()`, `setFlag(k, v)`, `setMemoria(c, n)`, `learn(kind, id)`, `choose(ending)`, `unlockAll()` |
| `ui` (I) | `open(screen)`, `share()` (ultimo testo di condivisione), `daily()` (dati del giorno) |
| `audio` (A) | `state()`, `log()`, `mute(on)` |

### 15.2 Test

1. **Unitari (Vitest, `npm test`)**: ogni pacchetto testa il proprio codice in `tests/unit/<pacchetto>/`. Obbligatori:
   - motore: una tabella di casi per ogni riga delle tabelle del GDD 3.4-3.11 (stato prima, incroci, stato atteso, eventi attesi); i due esempi giocati del GDD (3.15 e 3.16) con i numeri esatti; determinismo del generatore; spartito andata e ritorno su 200 soluzioni casuali; un carattere corrotto nello spartito viene rilevato;
   - core: checksum e scelta dello slot, migrazioni, plurali e marcatori di i18n, riconoscitore dei gesti (sequenze di puntatori sintetiche);
   - contenuti: `validateContent` senza errori; ogni livello ha il suo `.computed.json` aggiornato (`sourceHash`); ogni bigliettino citato esiste; ogni `textKey` esiste in italiano.
2. **`npm run levels:check`** (M): per ogni livello di storia, archivio e finale: base risolvibile; ogni bigliettino singolo risolvibile o marcato `impossibile` nei dati con motivo; tutte le combinazioni di `pins` bigliettini calcolate e le impossibili segnalate (devono essere marcate `voluta`); matassa ≥ minimo della combinazione designata; scrive i `.computed.json`; esce con codice ≠ 0 se qualcosa non torna. Opzione `--report` per una tabella riassuntiva.
3. **End-to-end (Playwright 1.56.1, `npm run test:e2e`)**: `webServer` = `npm run build && npm run preview` su `http://localhost:4173`, `baseURL` con `?debug=1`. Progetti:

   | Progetto | Viewport | DPR | Touch |
   |---|---|---|---|
   | `desktop` | 1280×720 | 1 | no |
   | `desktop-hd` | 1920×1080 | 1 | no (solo screenshot) |
   | `iphone` | 390×844 | 3 | sì (`isMobile`, `hasTouch`) |
   | `android-piccolo` | 360×640 | 2 | sì |
   | `ipad-orizzontale` | 1180×820 | 2 | sì |

   Mai `--use-angle=swiftshader` (rende il canvas 10 volte più lento). Suite (F scrive `smoke.spec.ts`, P tutte le altre):
   - `smoke`: avvio senza errori in console; `__GAME__.ready`; nessuna richiesta verso host diversi da localhost (intercettazione di rete).
   - `prologo`: il prologo giocato con **trascinamenti veri** (`page.mouse` su desktop, `page.touchscreen`/eventi pointer touch su iphone), usando `night.layout()` per le coordinate; verifica il rifiuto di Marta, il rovesciamento, la consegna, la fine.
   - `campagna`: percorso d'oro dalla g00 alla g23 con `campaign.*` e `night.autoplay()`, poi ognuno dei 4 finali (il falso deve riportare alla sera di g23); controlla flag, conoscenza e requisiti del finale vero.
   - `archivio`: nominare (conferma solo con 3 giusti), rammendare, eco.
   - `salvataggio`: ricarica a metà notte e riprende alla stessa riga; `visibilitychange` salva; export e import; slot corrotto → si usa l'altro.
   - `giornaliero`: stessa data → stesso livello (hash) anche dopo ricarica; testo di condivisione; import dello spartito che ritesse il merletto.
   - `layout`: screenshot di ogni schermata per progetto (anche con testo al 140%, alto contrasto, inglese, safe area simulata 47/34 px); script che fallisce se un elemento di testo esce dal suo contenitore (`scrollWidth > clientWidth + 1`) o se un elemento interattivo è più piccolo di 44×44 px.
   - `audio`: dopo il primo tocco `audio.state() === 'running'`; nascondendo la pagina → `suspended`; log dei suoni della prima riga del prologo.
   - `prestazioni`: 3 secondi di trascinamento continuo nel tombolo a 6 colonne: p95 del tempo per fotogramma (misurato in pagina) < 8 ms sul progetto `desktop`; heap JS < 150 MB dopo 10 giornate in autoplay.
4. **Comando unico di verifica**: `npm run ci` = `npm run build && npm test && npm run levels:check && npm run test:e2e`.

Le prestazioni misurate nel container non dicono nulla dei telefoni veri: prima della pubblicazione sugli store serve una prova su un iPhone e su un Android di fascia media.

---

## 16. Budget di prestazioni

| Voce | Budget |
|---|---|
| Fotogrammi | 60 fps sul telefono di riferimento (fascia media 2023); p95 < 8 ms di JS per fotogramma su desktop durante il trascinamento |
| Disegno del tombolo | Righe fissate in cache fuori schermo (strisce da 8 righe); per fotogramma solo riga corrente, fusi, perline animate: ≤ 300 operazioni di path; niente `shadowBlur` né `filter` |
| Allocazioni | Nessuna allocazione nel ciclo di disegno del tombolo (array e oggetti preallocati, pool per le animazioni) |
| Canvas | Risoluzione `css × min(dpr, 2)` |
| JavaScript | ≤ 450 KB gzip in tutto (nessun framework); worker del solver separato ≤ 60 KB |
| CSS | ≤ 40 KB |
| Font | ≤ 400 KB (solo sottoinsieme latino, pesi usati) |
| Asset | ≤ 6 MB in tutto; gruppo `core` (atlas) ≤ 3 MB; diorami caricati per gruppo |
| Memoria | Heap JS ≤ 150 MB; al massimo 4 diorami decodificati alla volta |
| Avvio | Titolo interattivo ≤ 2,5 s sul telefono di riferimento (app nativa, avvio a freddo) |
| Solver | ≤ 3 s per livello in Node (`levels:check`); suggerimenti nel Worker ≤ 1,5 s, altrimenti soluzione precalcolata o suggerimento generico; Merletto del giorno ≤ 1,5 s nel Worker |
| Audio | ≤ 48 sorgenti contemporanee; pre-render ≤ 300 ms di CPU, in background dopo lo sblocco |
| Salvataggio | JSON ≤ 64 KB; scrittura ≤ 5 ms; al massimo una ogni 2 s salvo le immediate |

---

## 17. Convenzioni di codice

- TypeScript `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `moduleResolution: "bundler"`, `resolveJsonModule`, `target: "ES2022"`. Niente `any` (si usa `unknown` più controlli).
- Nomi di dominio in italiano come nel GDD (`incrocio`, `matassa`, `spillo`, `perlina`, `fuso`); nomi tecnici generici in inglese (`update`, `render`, `state`). Commenti in italiano.
- File: `camelCase.ts` per i moduli, `PascalCase.ts` per le classi di scena; un `register.ts` per pacchetto.
- Nessuna stringa visibile all'utente nel codice: sempre `i18n.t`.
- Nessun `innerHTML` con testi di contenuto; nessuna richiesta di rete a runtime (tranne `./assets/manifest.json` e gli asset locali); nessun `eval`.
- Ogni accesso a `localStorage`, `navigator.vibrate`, `navigator.share`, `CompressionStream` dentro `try/catch` o dietro un controllo di disponibilità.
- Il motore resta puro: niente `Date.now()`, `Math.random()` (si usa `rng.ts` con seme), DOM o servizi.
- Commit piccoli, per pacchetto, con messaggio in italiano.

---

## 18. Pacchetti di lavoro (sintesi)

| Sigla | Pacchetto | Possiede | Dipende da |
|---|---|---|---|
| F | Fondamenta | configurazioni, `src/main.ts`, `src/core/`, `content/loader.ts` e `validate.ts`, `i18n/*/core.json`, `tests/unit/core/`, `tests/e2e/smoke.spec.ts` | nessuno |
| M | Motore delle regole | `src/engine/`, `tools/levels/`, `tests/unit/engine/` | F |
| A | Audio | `src/audio/`, `i18n/*/audio.json`, `tests/unit/audio/` | F |
| B | Asset Blender | `tools/blender/`, `tools/atlas/`, `public/assets/`, `public/icons/`, `assets/` | F |
| T | Tombolo | `src/tombolo/`, `i18n/*/tombolo.json`, `tests/unit/tombolo/` | F, M |
| I | Interfaccia e modalità | `src/screens/`, `i18n/*/ui.json`, `tests/unit/screens/` | F, M, T |
| C1 | Contenuti Atto I | contenuti comuni + Atto I (sezione 2) | F, M |
| C2 | Contenuti Atti II-III e finali | contenuti Atti II-III (sezione 2) | F, M |
| S | Storia e campagna | `src/campaign/`, `i18n/*/campaign.json`, `tests/unit/campaign/` | F, M, T, C1, C2 |
| P | Piattaforma nativa e QA | `android/`, `ios/`, `scripts/`, `docs/STORE.md`, `tests/e2e/` (tranne smoke) | tutti |

Ordine consigliato: F → (M, A, B in parallelo) → (T, C1, C2 in parallelo) → (I, S) → P.
