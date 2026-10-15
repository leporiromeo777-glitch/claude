# Modulo «narrativa» — il motore della storia

Motore narrativo di *Cielo di Terra* in **TypeScript puro** (niente three.js, niente DOM): flag e contatori, condizioni, missioni, dialoghi, scene, Taccuino, inventario e salvataggio. È guidato dai JSON di `content/` ed è coperto da test Vitest.

Il gioco fornisce i fatti del mondo tramite l'interfaccia `WorldFacts` (luogo dove si trova Elvira, ora, giorno, celle rilevate…) e chiama `narrativa.tick()` ogni tanto. La narrativa risponde con eventi tipizzati: passo attivato, missione completata, `evento:nome`, `tempo:salta-a 6`, dialogo da aprire…

```
moduli/narrativa/
  src/
    index.ts        esportazioni pubbliche
    narrativa.ts    facciata Narrativa, WorldFacts, FornitoreMondo
    condizioni.ts   parser e valutatore delle condizioni
    effetti.ts      parser degli effetti
    flag.ts         ArchivioFlag (flag e contatori)
    missioni.ts     macchina a stati delle missioni (passi, eventi, aiuti a tempo)
    dialoghi.ts     esecutore dei dialoghi (getNode / choose / isFinished)
    taccuino.ts     domande, indizi, note, parole barrate, proverbi, leggende, obiettivi, riga del cielo
    inventario.ts   inventario semplice
    salvataggio.ts  serializzazione versionata, checksum, migrazioni, due slot
    contenuti.ts    tipi dei contenuti e normalizzazione dei JSON veri
    eventi.ts       emettitore di eventi tipizzato
    verifica.ts     verifica statica dei contenuti e partita simulata
  scripts/verifica-contenuti.ts   verifica i veri file di content/
  test/             9 file di test Vitest (più aiuti.ts), 140 test
```

## Comandi

```sh
npm install
npm test                      # Vitest: 9 file, 140 test, tutti verdi
npm run typecheck             # tsc --noEmit (TypeScript 7.0.2, strict, stesse opzioni del motore)
npm run verifica-contenuti    # verifica ../../content
npx tsx scripts/verifica-contenuti.ts [cartella] [--md] [--traccia]
```

`verifica-contenuti` esce con 0 se non ci sono errori, 1 se ce ne sono e 2 se i file narrativi non esistono ancora. Con `--md` stampa in Markdown, con `--traccia` aggiunge il diario della partita simulata.

## Integrazione nel gioco

```ts
import missioni from '../../content/missioni.json';
import dialoghi from '../../content/dialoghi.json';
import taccuino from '../../content/taccuino.json';
import testi from '../../content/testi.json';
import { Narrativa, GestoreSalvataggi, archivioDaStorage, riempiSegnaposto, type WorldFacts } from './narrativa';

const fatti: WorldFacts = {
  ora: () => orologio.ora,                                   // 0 ≤ ora < 24
  giorno: () => orologio.giorno,                             // dal giorno 1
  notte: () => orologio.notte,                               // facoltativo (predefinito 21:00-05:30, GDD §2.3)
  luogoRaggiunto: (id) => luoghi.dentroRaggio(id),           // Elvira è ADESSO entro il raggio del luogo
  cellaRilevata: (id) => pianta.stato(Number(id)) === 'colore',
  cellaVista: (id) => pianta.stato(Number(id)) !== 'bianco', // facoltativo
  varianteParticella: (id) => notte.variante(id),            // facoltativo: 'Carta', 'Abitata', 'Smontata'…
  prossimoEventoCielo: () => null,                           // facoltativo: riga del cielo calcolata dal gioco
};

const narrativa = new Narrativa({ missioni, dialoghi, taccuino, testi }, fatti);
if (narrativa.problemi.length) console.warn(narrativa.problemi);   // contenuti malformati: non fermano il gioco

// gli effetti dei contenuti che spettano al gioco
narrativa.eventi.on('evento', ({ nome, argomenti }) => {
  switch (nome) {
    case 'orologio': orologio.comando(argomenti); break;       // fermo 05:38 | max 17:30 | libero
    case 'testo': ui.vistaLettura(argomenti[0]); break;         // testi.json
    case 'battuta': audio.battuta(argomenti[0]); break;
    case 'suggerimento': ui.suggerimento(argomenti[0]); break;
    case 'variante': notte.impostaVariante(argomenti[0], argomenti[1]); break;
    case 'musica': case 'suono': audio.suona(nome, argomenti[0]); break;
    case 'pianta': ui.pianta(argomenti[0]); break;              // apri | resoconto
    case 'npc': png.ordine(argomenti[0]); break;                // ottavio->accompagna:fienile_ottavio
    default: regia.evento(nome, argomenti);                     // evento:linea_miccia…
  }
});
narrativa.eventi.on('tempo', ({ azione, ore }) => (azione === 'salta-a' ? orologio.saltaA(ore) : orologio.avanza(ore)));
narrativa.eventi.on('apriDialogo', ({ dialogo }) => ui.apriDialogo(narrativa.dialoghi.avvia(dialogo)));
narrativa.eventi.on('passoAttivato', ({ obiettivo }) => hud.obiettivo(obiettivo));

// nel ciclo del gioco, per esempio due volte al secondo:
narrativa.tick(secondiRealiPassati);   // i secondi servono agli «aiuti» a tempo dei passi
// il motore accende i flag che gli spettano (vedi il contratto più sotto):
narrativa.flag.set('guardato_in_su');
narrativa.flag.incrementa('lumi_appuntati');
narrativa.inventario.aggiungi('marza_pedrazzini');
narrativa.segnalaLuogo('passerella_messo');   // facoltativo: una visita breve fra due tick

// dialoghi: la UI parla solo con getNode / choose / isFinished
let nodo = narrativa.parla('ottavio');          // o narrativa.interagisci('altoparlante_cella')
while (nodo && !narrativa.dialoghi.isFinished()) {
  const i = await ui.mostra(nodo);              // nodo.didascalia, nodo.chi, nodo.testo, nodo.risposte[i].testo
  nodo = narrativa.dialoghi.choose(i);          // nodo finale (senza risposte): choose(0) = «continua»
}

// l'Ombrista alle 19:45
const scena = narrativa.scenaDisponibile('leggende');  // 'partenza_1', 'partenza_2b'…
if (scena) { await ombrista.recita(scena); narrativa.concludiScena(scena); }

// riga del cielo (con i segnaposto riempiti dal gioco)
hud.rigaCielo(riempiSegnaposto(narrativa.taccuino.rigaCielo() ?? '', { secondi: meta.secondiAlProssimoPassaggio() }));

// salvataggio: narrativa + stato del mondo (blob opaco del gioco), due slot alternati
const salvataggi = new GestoreSalvataggi({ archivio: archivioDaStorage(localStorage) });
const mondo = {
  esporta: () => ({ giocatore: { z, theta, altezza, direzione }, giorno, ora, particelle: notte.stati() }),
  importa: (blob: unknown) => ripristinaMondo(blob),
};
await narrativa.salva(salvataggi, mondo, { luogo: 'Corbella', giorno });
await narrativa.carica(salvataggi, mondo);      // null se non c'è nessun salvataggio
```

Note:

- Gli `import` dei JSON richiedono `resolveJsonModule`, già attivo nel `tsconfig` del motore. Il gioco può anche caricarli con `fetch`: il costruttore accetta qualunque oggetto.
- `tick()` è idempotente e rientrante: si può chiamare anche da dentro un ascoltatore. Gli effetti di una risposta e la fine di un dialogo fanno già un `tick()` da soli.
- **Luoghi** (FASE1 §2.3: «una volta raggiunto resta vero per quel passo»). `WorldFacts.luogoRaggiunto` dice dove si trova Elvira **adesso**. Dentro un passo di missione la narrativa ricorda i luoghi raggiunti mentre il passo è attivo e li dimentica quando il passo si chiude. Per questo `luogo:piazza_ore raggiunto` in `m1_ritorno` non è vero solo perché il giorno prima Elvira era in piazza. Nelle condizioni dei dialoghi e del Taccuino, invece, conta la posizione attuale.
- Gli errori dei contenuti (condizioni malformate, effetti sconosciuti, id inesistenti) non fermano il gioco: finiscono in `narrativa.problemi` e nell'evento `errore`, una volta sola ciascuno. Con `{ rigoroso: true }` lanciano subito, il che serve nei test e in CI. Un'eccezione lanciata da `WorldFacts` non viene invece mai nascosta.
- Nessun percorso assoluto e nessuna dipendenza fuori dalla cartella: il modulo si sposta in `src/narrativa/` così com'è. Lo script di verifica cerca `content/` tre livelli sopra di sé, quindi funziona sia da `moduli/narrativa/scripts/` sia da `src/narrativa/scripts/`.

## Linguaggio delle condizioni

Le parole chiave non distinguono maiuscole e minuscole. Precedenza: `non`/`!`, poi `e`, poi `o`; le parentesi sono libere. `&&` e `,` valgono «e», `||` vale «o». Una **lista** è vera quando sono vere tutte; `null`, la stringa vuota e la lista vuota sono sempre vere. Sono accettati anche gli oggetti `{ "e": [...] }`, `{ "tutte": [...] }`, `{ "o": [...] }`, `{ "almeno_una": [...] }`, `{ "non": ... }`.

| Atomo | Vero quando |
|---|---|
| `vero`, `falso`, `sempre`, `mai`, `inizio` | costanti (`inizio` = vero: «appena la missione parte») |
| `notte`, `giorno` | è notte / non è notte (`WorldFacts.notte`, altrimenti 21:00-05:30) |
| `flag:nome` | flag acceso (definito e diverso da `false`, `0`, `""`); i nomi possono contenere `:` (`flag:lente:corteccia`) |
| `flag:nome=valore` e `!=`, `>`, `>=`, `<`, `<=` | confronto; valori: numeri, `vero`/`falso`, testo, `"testo con spazi"`; un flag assente vale `false`/`0`/`""` |
| `contatore:nome>=3`, `contatore:nome` | come `flag:` (i contatori sono flag numerici) |
| `!atomo`, `non atomo`, `!(…)` | negazione |
| `luogo:id raggiunto` | vedi la nota sui luoghi; il qualificatore si può omettere |
| `ora:>=20`, `ora:>=07:40`, `ora:<6`, `ora:20`, `ora:6-9`, `ora:22-5` | intervalli semiaperti `[da, a)`, oltre la mezzanotte se `da > a`; `ora:20` vale per tutta l'ora `[20, 21)` |
| `giorno:2`, `giorno:>=2`, `giorno:2-4` | numero del giorno (intervalli chiusi) |
| `cella:id rilevata` (`colore`), `vista` (`matita`), `bianca` (`bianco`) | `cellaRilevata` / rilevata o `cellaVista` / né l'una né l'altra |
| `particella:E1 abitata`, `variante:E1=Abitata` (anche `carta`, `mietuta`, `scritta`, `smontata`) | `varianteParticella(id)`, maiuscole indifferenti |
| `dialogo:id finito` / `iniziato` | dialogo chiuso normalmente / almeno aperto |
| `missione:id completata` / `attiva` / `avviata` / `inattiva` | stato di una missione |
| `passo:id completato` / `attivo`; `passo:missione/passo …` | stato di un passo; con il solo id il passo si cerca fra tutte le missioni |
| `oggetto:id`, `oggetto:id>=2` | inventario narrativo più `WorldFacts.quantitaOggetto` |
| `taccuino:id` (`presente`), `aperta`, `chiusa`, `barrata` | stato di una voce del Taccuino |

Prefissi in più si registrano con `new Narrativa(c, fatti, { parser: { prefissiExtra: ['fada'] } })` e li valuta `WorldFacts.predicato(prefisso, argomento, qualificatore)`. Gli errori dicono che cosa non va e dove: `Condizione «flag:a e pippo:b»: prefisso sconosciuto «pippo:» (carattere 10)`.

## Linguaggio degli effetti

| Effetto | Che cosa fa |
|---|---|
| `flag:x`, `flag:x=3`, `flag:x=nero`, `flag:x=falso` | accende / imposta |
| `flag:x+=1`, `flag:x-=2`, `contatore:x+1`, `contatore:x-1`, `contatore:x=0` | somma (un flag assente parte da 0) |
| `!flag:x`, `flag:-x` | spegne (rimuove) |
| `taccuino:id` (`chiudi`, `riapri`, `barra`, `rimuovi`) | scrive o aggiorna una voce |
| `cielo:testo libero` | fissa la riga del cielo (`cielo:` vuoto la libera) |
| `missione:id` / `missione:id avvia`, `missione:id completata`, `missione:id fallisci` | avvia / completa / fa fallire una missione |
| `oggetto:+id`, `oggetto:-id`, `oggetto:+id*3`, `germoglio:+1` | inventario (`germoglio:+1` = `oggetto:+germoglio`) |
| `dialogo:id` | evento `apriDialogo` |
| `tempo:salta-a 6`, `tempo:avanza 2`, `dormi:fino 05:30` | evento `tempo` |
| `evento:nome arg…` e i prefissi `testo:`, `battuta:`, `suggerimento:`, `orologio:`, `musica:`, `suono:`, `pianta:`, `npc:`, `variante:E1=Abitata` | evento `evento` con `nome` = l'id dopo `evento:` oppure il prefisso (elenco in `PREFISSI_EVENTO`) |

## API pubblica

Tutto si importa da `src/index.ts`.

### Facciata

```ts
interface WorldFacts {
  ora(): number;
  giorno(): number;
  notte?(): boolean;                                   // predefinito: NOTTE_PREDEFINITA = { inizio: 21, fine: 5.5 }
  luogoRaggiunto(id: string): boolean;                 // Elvira è ora entro il raggio del luogo
  cellaRilevata(id: string): boolean;
  cellaVista?(id: string): boolean;
  varianteParticella?(id: string): string | undefined;
  quantitaOggetto?(id: string): number;
  predicato?(prefisso: string, argomento: string, qualificatore?: string): boolean;
  prossimoEventoCielo?(): string | null;
}

interface FornitoreMondo { esporta(): unknown; importa(blob: unknown): void; }

interface OpzioniNarrativa {
  parser?: { prefissiExtra?: string[]; statiCellaExtra?: string[] };
  missioniIniziali?: string[];         // predefinite: missioniOrfane(contenuti)
  notte?: { inizio: number; fine: number };
  rigoroso?: boolean;
}

interface ContenutiNarrativa { missioni?: unknown; dialoghi?: unknown; taccuino?: unknown; testi?: unknown }

class Narrativa {
  constructor(contenuti: ContenutiNarrativa | ContenutiNormalizzati, fatti: WorldFacts, opzioni?: OpzioniNarrativa);
  readonly eventi: Emettitore<EventiNarrativa>;
  readonly flag: ArchivioFlag;
  readonly missioni: Missioni;
  readonly dialoghi: Dialoghi;
  readonly taccuino: Taccuino;
  readonly inventario: Inventario;
  readonly parser: ParserCondizioni;
  readonly contenuti: ContenutiNormalizzati;
  readonly contesto: ContestoCondizioni;
  readonly fatti: WorldFacts;
  readonly problemi: string[];
  tick(secondi?: number): boolean;                     // true se è cambiato qualcosa
  valuta(c: CondizioneGrezza, origine?: string, ambito?: AmbitoPasso): boolean;
  valutaCompilata(n: NodoCondizione, ambito?: AmbitoPasso): boolean;
  applicaEffetti(effetti: readonly (string | Effetto)[], origine?: string): void;   // poi tick()
  applicaEffetto(effetto: string | Effetto, origine?: string): void;
  segnalaLuogo(id: string): void;                      // visita breve: vale per i passi attivi; poi tick()
  parla(personaggio: string): VistaNodo | null;        // dialogo «si_apre: parlando con»
  interagisci(oggetto: string): VistaNodo | null;      // dialogo «si_apre: interagendo con»
  scenaDisponibile(gruppo?: string): string | null;    // predefinito 'leggende'
  concludiScena(id: string): boolean;                  // applica gli `alla_fine` della scena
  scenaConclusa(id: string): boolean;
  esporta(): StatoNarrativo;
  importa(stato: StatoNarrativo): void;                // senza eventi né effetti
  salva(gestore: GestoreSalvataggi, mondo: FornitoreMondo, meta?: Record<string, unknown>): Promise<InfoSlot>;
  carica(gestore: GestoreSalvataggi, mondo: FornitoreMondo): Promise<RisultatoCaricamento<StatoNarrativo> | null>;
}

function missioniOrfane(c: ContenutiNormalizzati): string[];   // senza avvia_quando e mai avviate da un effetto
function riempiSegnaposto(testo: string, valori: Record<string, string | number>): string;

interface EventiNarrativa {
  missioneAvviata: { missione: string; titolo: string };
  passoAttivato: { missione: string; passo: string; obiettivo?: string; luogo?: string };
  passoCompletato: { missione: string; passo: string };
  missioneCompletata: { missione: string; titolo: string };
  missioneFallita: { missione: string; titolo: string };
  dialogoAvviato: { dialogo: string; personaggio: string };
  nodoDialogo: VistaNodo;
  rispostaScelta: { dialogo: string; nodo: string; indice: number; testo: string };
  dialogoFinito: { dialogo: string; personaggio: string };
  dialogoInterrotto: { dialogo: string; personaggio: string };
  erroreDialogo: { dialogo: string; messaggio: string };
  flag: { nome: string; prima?: ValoreFlag; dopo?: ValoreFlag };
  oggetto: { id: string; prima: number; dopo: number };
  taccuino: { id: string; azione: 'aggiunta' | 'chiusa' | 'riaperta' | 'barrata' | 'rimossa'; voce: VoceVisibile | null };
  rigaCielo: { testo: string | null };
  obiettivi: { obiettivi: { missione: string; passo: string; testo: string }[] };
  evento: { nome: string; argomenti: string[]; origine?: string };
  tempo: { azione: 'salta-a' | 'avanza'; ore: number; origine?: string };
  apriDialogo: { dialogo: string; origine?: string; automatico?: boolean };
  scenaConclusa: { scena: string; gruppo: string };
  errore: { messaggio: string; origine?: string };
}

interface StatoNarrativo {
  flag: Record<string, ValoreFlag>;
  missioni: StatoMissioni;     // { inizializzate; missioni: Record<id, { stato; passi; eventi?; aiuti? }> }
  dialoghi: StatoDialoghi;     // { finiti; iniziati; corrente: { dialogo; nodo } | null }
  taccuino: StatoTaccuino;     // { voci: StatoVoce[]; rigaCielo: string | null; obiettivi }
  inventario: Record<string, number>;
  luoghiPasso?: Record<string, string[]>;   // «missione/passo» → luoghi raggiunti durante il passo
  scene?: string[];                         // scene concluse
}
```

### Eventi, flag, inventario

```ts
class Emettitore<M extends object> {
  on<K extends keyof M>(tipo: K, fn: (dato: M[K]) => void): () => void;   // restituisce «stacca»
  once<K extends keyof M>(tipo: K, fn: (dato: M[K]) => void): () => void;
  off<K extends keyof M>(tipo: K, fn: (dato: M[K]) => void): void;
  onQualsiasi(fn: <K extends keyof M>(tipo: K, dato: M[K]) => void): () => void;   // chiamati per primi
  emit<K extends keyof M>(tipo: K, dato: M[K]): void;
  svuota(): void;
}

type ValoreFlag = boolean | number | string;
class ArchivioFlag {
  readonly eventi: Emettitore<{ cambio: CambioFlag }>;
  get(nome: string): ValoreFlag | undefined;
  esiste(nome: string): boolean;
  vero(nome: string): boolean;
  set(nome: string, valore?: ValoreFlag): void;       // predefinito true; evento solo se cambia
  rimuovi(nome: string): void;
  incrementa(nome: string, delta?: number): number;   // i contatori
  tutti(): Record<string, ValoreFlag>;
  esporta(): Record<string, ValoreFlag>;
  importa(dati: Record<string, unknown>): void;
}

class Inventario {
  readonly eventi: Emettitore<{ cambio: { id: string; prima: number; dopo: number } }>;
  quantita(id: string): number;
  ha(id: string, n?: number): boolean;
  aggiungi(id: string, n?: number): void;
  rimuovi(id: string, n?: number): boolean;           // false se non bastano
  elenco(): { id: string; quantita: number }[];
  esporta(): Record<string, number>;
  importa(dati: Record<string, unknown>): void;
}
```

### Condizioni ed effetti

```ts
type CondizioneGrezza = string | boolean | null | undefined | readonly CondizioneGrezza[] | { readonly [k: string]: CondizioneGrezza };
class ParserCondizioni {
  constructor(opzioni?: OpzioniParser);
  analizza(testo: string): NodoCondizione;            // lancia ErroreCondizione; con cache
  compila(c: CondizioneGrezza): NodoCondizione;
  valuta(c: CondizioneGrezza, ctx: ContestoCondizioni): boolean;
  errori(c: CondizioneGrezza): string[];
}
class ErroreCondizione extends Error { readonly motivo: string; readonly testo: string; readonly posizione?: number; }
function analizzaCondizione(testo: string): NodoCondizione;
function compilaCondizione(c: CondizioneGrezza): NodoCondizione;
function valutaCondizione(c: CondizioneGrezza, ctx: ContestoCondizioni): boolean;
function valutaNodo(n: NodoCondizione, ctx: ContestoCondizioni): boolean;
function atomiDi(n: NodoCondizione): Atomo[];
function stampaCondizione(n: NodoCondizione): string;   // forma canonica

interface ContestoCondizioni {
  flag(nome: string): ValoreFlag | undefined; ora(): number; giorno(): number; notte(): boolean;
  luogoRaggiunto(id: string): boolean; cella(id: string, stato: string): boolean;
  dialogo(id: string, stato: 'finito' | 'iniziato'): boolean;
  missione(id: string, stato: 'completata' | 'attiva' | 'avviata' | 'inattiva'): boolean;
  passo(missione: string | undefined, passo: string, stato: 'completato' | 'attivo'): boolean;
  quantitaOggetto(id: string): number;
  taccuino(id: string, stato: 'presente' | 'aperta' | 'chiusa' | 'barrata'): boolean;
  predicato?(prefisso: string, argomento: string, qualificatore?: string): boolean;
}

type Effetto =
  | { tipo: 'flag'; nome: string; valore: ValoreFlag } | { tipo: 'flag-somma'; nome: string; delta: number }
  | { tipo: 'flag-rimuovi'; nome: string }
  | { tipo: 'taccuino'; id: string; azione: 'aggiungi' | 'chiudi' | 'riapri' | 'barra' | 'rimuovi' }
  | { tipo: 'cielo'; testo: string }
  | { tipo: 'missione'; id: string; azione: 'avvia' | 'completa' | 'fallisci' }
  | { tipo: 'oggetto'; id: string; delta: number }
  | { tipo: 'evento'; nome: string; argomenti: string[] }
  | { tipo: 'tempo'; azione: 'salta-a' | 'avanza'; ore: number }
  | { tipo: 'dialogo'; id: string };
function analizzaEffetto(testo: string): Effetto;       // lancia ErroreEffetto
function stampaEffetto(e: Effetto): string;
function listaEffetti(e: unknown): string[];
const PREFISSI_EVENTO: readonly string[];               // testo, suggerimento, variante, orologio, musica, suono, battuta, pianta, npc
```

### Missioni

```ts
type StatoMissione = 'inattiva' | 'attiva' | 'completata' | 'fallita';
type StatoPasso = 'bloccato' | 'attivo' | 'completato';
interface AmbitoPasso { missione: string; passo: string }
class Missioni {
  constructor(defs: readonly MissioneDef[], deps: DipendenzeMissioni, iniziali?: readonly string[]);
  readonly eventi: Emettitore<EventiMissioni>;
  readonly iniziali: readonly string[];
  definizione(id: string): MissioneDef | undefined;
  elenco(): MissioneDef[];
  stato(id: string): StatoMissione;
  statoPasso(missione: string | undefined, passo: string): StatoPasso;
  missioneDelPasso(passo: string): string | undefined;
  attive(): string[];
  completate(): string[];
  passiAttivi(): { missione: string; passo: string; obiettivo?: string; luogo?: string }[];
  avvia(id: string): boolean;
  completa(id: string): boolean;                       // forza (i passi saltati non applicano i loro effetti)
  completaPasso(missione: string, passo: string): boolean;
  fallisci(id: string): boolean;
  aggiorna(): boolean;                                 // la chiama Narrativa.tick()
  avanzaTempo(secondi: number): boolean;               // aiuti a tempo; lo chiama Narrativa.tick(secondi)
  esporta(): StatoMissioni;
  importa(dati: StatoMissioni): void;
}
```

Regole:

- **Avvio.** Una missione parte quando `avvia_quando` è vera, con l'effetto `missione:id`, oppure perché è fra le *iniziali*. Le iniziali partono al primo `tick()` di una partita nuova; per default sono le missioni senza `avvia_quando` che nessun effetto avvia (nella Fase 1: prologo, sfondo, segreti, indizio, easter egg, disco di piombo).
- **Attivazione dei passi.** Un passo **con** `attiva_quando` si attiva quando la condizione è vera, anche in parallelo ad altri (`inizio` = subito). Un passo **senza** `attiva_quando` aspetta il precedente; con `"ordine": "libero"` si attiva invece subito.
- **Durante il passo.** Gli `eventi: [{quando, effetti}]` scattano una volta sola, la prima volta che `quando` è vera mentre il passo è attivo. Gli `aiuti: [{dopo_s, effetti}]` scattano dopo `dopo_s` secondi reali di passo attivo, contati con `tick(secondi)`.
- **Completamento.** Un passo attivo si completa quando `completa_quando` è vera; un passo senza `completa_quando` si completa solo da codice. Quando l'ultimo passo si completa la missione si chiude, e gli eventi arrivano in quest'ordine: passo completato → missione completata → effetti del passo → effetti della missione. Così la missione seguente si annuncia dopo.
- Tutto avviene a cascata nello stesso `tick()`. L'`obiettivo_taccuino` di un passo attivo sta fra gli obiettivi del Taccuino; se è l'id di una voce, la voce viene anche scritta.

### Dialoghi

```ts
interface VistaNodo {
  dialogo: string; personaggio: string; nodo: string;
  chi: string;                                      // chi parla (nodo.chi o il personaggio)
  didascalia?: string; testo: string;               // testo "" = nodo muto con sola didascalia
  risposte: { indice: number; testo: string }[];    // già filtrate per condizione
  finale: boolean;                                  // nessuna risposta visibile: choose(0) continua o chiude
}
class Dialoghi {
  readonly eventi: Emettitore<EventiDialoghi>;
  avvia(id: string, nodo?: string): VistaNodo | null;   // interrompe un dialogo già aperto
  getNode(): VistaNodo | null;
  choose(index: number): VistaNodo | null;              // null = dialogo finito
  isFinished(): boolean;                                // true se nessun dialogo è aperto
  interrompi(): void;                                   // chiude senza registrarlo fra i finiti
  aperto(): string | null;
  finito(id: string): boolean;
  iniziato(id: string): boolean;
  finiti(): string[];
  segnaFinito(id: string): void;
  disponibili(personaggio?: string): string[];
  perPersonaggio(personaggio: string): string | null;   // «si_apre: parlando con»
  perInterazione(oggetto: string): string | null;       // «si_apre: interagendo con»
  automaticiPronti(): string[];                         // «automatico» ed «effetto» con condizione vera, mai finiti
  definizione(id: string): DialogoDef | undefined;
  esporta(): StatoDialoghi;
  importa(dati: StatoDialoghi): void;
}
```

`vai_a` uguale a `"fine"`, `null` o `""` (o assente) chiude il dialogo. Quando un dialogo arriva alla fine si applicano i suoi `alla_fine`. Un `vai_a` verso un nodo inesistente chiude il dialogo e il problema viene segnalato. `si_apre`:

- **parlando** con `con` (predefinito il personaggio): la UI usa `parla`. Fra più dialoghi disponibili vince il primo nell'ordine del file (o quello con `priorita` più alta).
- **interagendo** con un oggetto: la UI usa `interagisci`.
- **automatico**: appena la condizione è vera e nessun dialogo è aperto, la narrativa emette `apriDialogo { automatico: true }` una volta sola. Se il dialogo viene interrotto lo riannuncia.
- **effetto**: si apre con l'effetto `dialogo:id`, oppure, come un automatico, quando la sua condizione (di solito un flag) diventa vera.

### Taccuino

```ts
interface VoceVisibile {
  id: string; tipo: 'domanda' | 'indizio' | 'parola' | 'nota' | 'proverbio' | 'leggenda' | string; testo: string;
  fonte?: string; tecnica?: string; locale?: string; domanda?: string; risposta?: string;
  mano?: string; sotto?: string; indizi?: string[]; dialetto?: string; italiano?: string; commento?: string;
  chiusa: boolean; barrata: boolean; ordine: number;
  scrittaIl?: { giorno: number; ora: number }; chiusaIl?: { giorno: number; ora: number };
  nota: boolean;   // false se l'id non è in taccuino.json
}
class Taccuino {
  readonly eventi: Emettitore<EventiTaccuino>;
  definizione(id: string): VoceDef | undefined;
  ha(id: string): boolean;
  stato(id: string): StatoVoce | undefined;
  aggiungi(id: string): boolean;          // le parole nascono barrate; `sostituisce` toglie la voce sostituita
  chiudi(id: string): boolean;
  riapri(id: string): boolean;
  barra(id: string): boolean;
  rimuovi(id: string): boolean;
  voce(id: string): VoceVisibile | null;
  voci(tipo?: TipoVoce): VoceVisibile[];  // in ordine di scrittura
  domandeAperte(): VoceVisibile[];
  domandeChiuse(): VoceVisibile[];
  indizi(domanda?: string): VoceVisibile[];
  parole(): VoceVisibile[];
  rigaCielo(): string | null;             // effetto «cielo:» > candidata di riga_del_cielo > WorldFacts.prossimoEventoCielo
  rigaCieloId(): string | null;           // id della candidata mostrata (es. 'rc_meta')
  impostaRigaCielo(testo: string | null): void;            // salvata
  impostaRigaCieloCandidata(r: { id: string; testo: string } | null): void;
  impostaRigaCieloGioco(testo: string | null): void;
  obiettivi(): { missione: string; passo: string; testo: string }[];
  segnaObiettivo(o: Obiettivo): void;
  togliObiettivo(missione: string, passo?: string): void;
  aggiorna(valuta: (c: CondizioneGrezza) => boolean): boolean;   // sblocca_quando / chiusa_quando (solo voci già scritte)
  esporta(): StatoTaccuino;
  importa(dati: StatoTaccuino): void;
}
```

La **riga del cielo** si sceglie a ogni `tick()`. Fra le candidate di `taccuino.json → riga_del_cielo` vince quella con `quando` vera e `priorita` più **alta**: `rc_meta` (1, «sempre») fa da fondo, gli annunci specifici (2-4) passano davanti. Un effetto `cielo:` ha comunque la precedenza. I segnaposto (`{secondi}`) li riempie il gioco con `riempiSegnaposto`.

### Salvataggio

```json
{ "formato": "cielo-di-terra/salvataggio", "versione": 1, "contatore": 7,
  "salvatoIl": "2026-10-15T08:00:00.000Z", "checksum": "1f3a…",
  "dati": { "narrativa": { … }, "mondo": <blob del gioco>, "meta": { … } } }
```

- **Checksum.** È un cyrb53 a 53 bit calcolato sul JSON canonico (chiavi ordinate) di tutto il resto. Protegge dalla corruzione, non da chi modifica il file.
- **Due slot alternati**, `<prefisso>.a` e `<prefisso>.b`. Ogni salvataggio va nello slot che **non** contiene il salvataggio valido più recente, poi viene riletto e verificato. Se la scrittura si interrompe o lancia (spazio esaurito), l'altro slot resta intatto.
- **Caricamento.** Prende lo slot valido con il contatore più alto; se è rovinato ripiega sull'altro, con un avviso. Se nessuno slot si può caricare ma qualcosa c'era, `carica()` lancia `ErroreSalvataggio`, così il gioco non riparte da zero in silenzio. Le operazioni del gestore vanno in fila.

```ts
const FORMATO_SALVATAGGIO = 'cielo-di-terra/salvataggio';
const VERSIONE_SALVATAGGIO = 1;
interface ContenutoSalvataggio<N = unknown> { narrativa: N; mondo: unknown; meta?: Record<string, unknown> }
interface DocumentoSalvataggio<N = unknown> { formato: string; versione: number; contatore: number; salvatoIl: string; checksum: string; dati: ContenutoSalvataggio<N> }
type Migrazione = (dati: Record<string, unknown>) => Record<string, unknown>;
class RegistroMigrazioni {
  registra(da: number, fn: Migrazione): this;           // dalla versione da alla da + 1
  ha(da: number): boolean;
  versioni(): number[];
  migra(dati: Record<string, unknown>, da: number, a: number): Record<string, unknown>;   // su una copia
}
function migrazioniPredefinite(): RegistroMigrazioni;
function creaDocumento<N>(c: ContenutoSalvataggio<N>, o?: { contatore?: number; versione?: number; adesso?: Date }): DocumentoSalvataggio<N>;
function serializza<N>(c: ContenutoSalvataggio<N>, o?: OpzioniSerializza): string;
function leggiDocumento(testo: string): DocumentoSalvataggio;                 // verifica formato e checksum
function deserializza<N>(testo: string, o?: { migrazioni?: RegistroMigrazioni; versione?: number }): DocumentoSalvataggio<N>;
function jsonCanonico(v: unknown): string;
function hash53(testo: string, seme?: number): string;
function checksumDocumento(doc: Omit<DocumentoSalvataggio, 'checksum'> & { checksum?: string }): string;
interface Archivio {
  leggi(chiave: string): string | null | Promise<string | null>;
  scrivi(chiave: string, valore: string): void | Promise<void>;
  rimuovi(chiave: string): void | Promise<void>;
}
class ArchivioMemoria implements Archivio { readonly dati: Map<string, string>; }
function archivioDaStorage(s: { getItem; setItem; removeItem }): Archivio;   // localStorage
class GestoreSalvataggi {
  constructor(o: { archivio: Archivio; prefisso?: string; migrazioni?: RegistroMigrazioni; versione?: number; adesso?: () => Date });
  chiave(slot: 'a' | 'b'): string;
  elenco(): Promise<InfoSlot[]>;      // { slot, chiave, stato: 'vuoto' | 'valido' | 'rovinato', contatore?, versione?, salvatoIl?, meta?, errore? }
  salva<N>(c: ContenutoSalvataggio<N>): Promise<InfoSlot>;
  carica<N>(): Promise<{ slot: 'a' | 'b'; documento: DocumentoSalvataggio<N>; avvisi: string[] } | null>;
  cancella(): Promise<void>;
}
```

Per cambiare formato si alza `VERSIONE_SALVATAGGIO` e si registra in `migrazioniPredefinite()` la funzione `registra(vecchia, dati => nuoviDati)`. Il blob del mondo è opaco per questo modulo: il gioco può versionarlo da sé, oppure una migrazione registrata qui può toccarlo, perché riceve tutto `dati`.

### Contenuti e verifica

```ts
function normalizzaContenuti(c: ContenutiNarrativa): ContenutiNormalizzati;
// ContenutiNormalizzati = { missioni: MissioneDef[]; dialoghi: Record<string, DialogoDef>; taccuino: VoceDef[];
//                           rigaCielo: RigaCieloDef[]; scene: ScenaDef[]; avvisi: string[] }
function verificaContenuti(c: ContenutiVerifica, o?: OpzioniVerifica): RapportoVerifica;
// ContenutiVerifica = ContenutiNarrativa & { luoghi?; personaggi?; celle?: string[]; elementi?: Record<string, string[]>; testi? }
// RapportoVerifica = { errori; avvisi; simulazione: EsitoMissione[]; traccia; ipotesi;
//                      flagDelGioco; oggettiDelGioco; flagSoloScritti; dialoghiNonGiocati; conteggi }
```

**Che cosa controlla la verifica** (sia `verificaContenuti` sia lo script):

- Condizioni ed effetti si analizzano.
- Ogni `vai_a` e ogni nodo iniziale esistono; segnala nodi irraggiungibili e dialoghi che non possono finire.
- Gli id citati esistono: luoghi, dialoghi, missioni, passi (e i passi citati con il solo id non sono ambigui), voci del Taccuino, personaggi, celle, elementi mobili e varianti, testi/battute/suggerimenti di `testi.json`.
- I collegamenti del Taccuino sono coerenti fra domande, indizi, `sotto` e `sostituisce`.
- Produce il **contratto con il motore**: i flag e gli oggetti letti che nessun effetto dà, e i flag scritti che nessuna condizione legge.
- Gioca una **partita simulata**, missione per missione nell'ordine del file. Il simulatore rende vere le condizioni come farebbe un giocatore: va nei luoghi (un luogo alla volta), rileva celle, aspetta l'ora o il giorno, recita le scene e gioca i dialoghi automatici quando si aprono.
- Nei dialoghi esplora i rami con istantanee. Sceglie quello che porta all'obiettivo e, a parità, quello più ricco di conseguenze, così non perde ciò che servirà dopo.
- Fra due alternative `o` preferisce quella che non richiede ipotesi. Un flag o un oggetto che nessun contenuto dà lo considera dato dal gioco e lo scrive fra le ipotesi.
- Non rigioca un dialogo già finito e non ripetibile: se ciò che serve era su un altro ramo, la missione risulta bloccata.

## Formato dei contenuti veri: differenze gestite

I file di `content/` aggiungono campi rispetto al formato concordato (li descrive `docs/design/FASE1.md` §2.3-2.7). Il modulo li gestisce tutti:

- **Dialoghi.**
  - `si_apre {come, con, condizione}`: parlando, interagendo, automatico, effetto.
  - `alla_fine` (effetti alla fine del dialogo), `didascalia` e `chi` nei nodi, `testo: ""` per i nodi muti.
  - Il dialogo è una mappa per id; il primo nodo dell'elenco è quello d'ingresso.
- **Missioni.**
  - `attiva_quando` esplicito su ogni passo, compreso `inizio`, con passi paralleli (`m1_dono`).
  - `effetti_attivazione`, `eventi`, `aiuti`, `luogo`, `tipo`, `descrizione`; `obiettivo_taccuino: null` per i passi senza obiettivo.
  - Le missioni senza avvio partono all'inizio.
- **Condizioni.** `passo:id` senza missione, `contatore:x>=N`, `variante:E1=Abitata`, `inizio`, flag con `:` nel nome (`lente:corteccia`, `tentato_lato:2-1`), ore `HH:MM`.
- **Effetti.**
  - `contatore:x+1`, `missione:id` senza azione, `missione:id completata`, `flag:-x`, `germoglio:+1`, `dormi:fino HH:MM`.
  - `testo:`, `battuta:`, `suggerimento:`, `orologio:`, `musica:`, `suono:`, `pianta:`, `npc:`, `variante:` sono richieste al gioco e diventano l'evento `evento`.
- **Taccuino.** È raggruppato in `domande`, `indizi`, `note`, `parole`, `proverbi`, `leggende`, più `riga_del_cielo` (candidate con priorità). Campi: `mano`, `sotto`, `indizi`, `chiusa_quando` (anche `null`), `sostituisce`, `nota`, `dialetto`/`italiano`. Le parole si scrivono già barrate, come dice la `_nota` del file.
- **Testi.** Le voci di `testi.json` con `condizione`/`alla_fine` (le sere dell'Ombrista in `leggende`) sono **scene**: `scenaDisponibile` e `concludiScena`.
- **Celle.** Gli id sono numerici (`iz*96 + itheta`) e gli elementi mobili sono `E1`…`E4`, con varianti con la maiuscola. Gli stati `bianco`/`matita`/`colore` di `fade_fase1.json` sono sinonimi di `bianca`/`vista`/`rilevata`.
- **Notte.** Il default è 21:00-05:30, come nel GDD §2.3.

## Problemi trovati nei contenuti

Verifica dei file di `content/` del 15 ottobre 2026, ore 07:35. Ultime modifiche ai file: missioni 07:19, dialoghi e taccuino 07:22, testi 07:23, fade/luoghi/capisaldi 07:25. Conteggi: 13 missioni, 42 passi, 29 dialoghi, 140 nodi, 95 voci del Taccuino, 8 candidate della riga del cielo, 4 scene, 158 condizioni, 246 effetti. I contenuti non sono stati corretti: qui sotto ci sono solo le segnalazioni.

**Errori: nessuno.** Tutte le condizioni e tutti gli effetti si analizzano, ogni `vai_a` punta a un nodo esistente, ogni effetto ha una forma nota. Nella partita simulata **tutte le 13 missioni si completano**: prologo, missione 1 «Il castagno vuoto» fino a `m1_gancio`, poi le libere, i segreti, l'indizio e l'easter egg. Il diario completo si ottiene con `--traccia`.

**Avvisi (da guardare con il design).**

1. **Collegamenti incoerenti fra domande e indizi del Taccuino.**
   - `q_vetro` elenca `i_g4`, ma `i_g4.domanda` è `q_botola`.
   - `q_api` elenca `i_lettera_rosa`, ma `i_lettera_rosa.domanda` è `q_rosa`.
   - `i_clausola` punta a `q_vetro`, che non lo elenca.
   - Puntano a `q_notte`, che non li elenca: `i_proverbio_togna`, `i_casa_nando`, `i_ballo_fade`, `i_casa_nando_rimasta`, `i_legge_1`, `i_carta_madre`.

   Per la UI vale il campo `domanda` dell'indizio (`taccuino.indizi(domanda)`); la lista `indizi` della domanda viene solo esposta.
2. **`i_lume_che_cammina`: nessun effetto la scrive.** La nota di `lib_lumi_lontani` dice che la aggiunge il motore quando si appunta la lanterna di Tecla: il motore deve chiamare `narrativa.applicaEffetti(['taccuino:i_lume_che_cammina'])`.
3. **`d_bambini`: i `chi` `lisa` e `gioanin` non sono in `personaggi.json`** (c'è solo `bambini`). È voluto (FASE1 §2.5), ma se la UI cerca nomi e voci in `personaggi.json` non li trova.
4. **`lib_disco_di_piombo / ld_appunta` ha `obiettivo_taccuino: null`** pur essendo di tipo `libero` (gli altri liberi hanno un obiettivo). Va bene se è voluto (è il segreto di livello 1).
5. **`ombrista_1_vista` non è nella tabella dei flag del motore** (FASE1 §2.4 e §2.6), ma non manca: lo accende l'`alla_fine` della scena `testi.leggende.partenza_1`, che il gioco deve concludere con `concludiScena('partenza_1')`.
6. **`m02_cisterna_di_rosa` non si completa nella Fase 1** (lo dice la sua descrizione): `m2_aggancio` aspetta `flag:fase2_disponibile`, che non accende nessuno. Il simulatore lo ha supposto acceso per andare avanti.
7. **`oggetto:lettera_marta`** è richiesto da `pr_cripta` e da `seg_buste_capsule`, ma nessun effetto lo dà e FASE1 §2.6 non lo elenca fra gli oggetti del motore. Lo dice solo la nota di `pr_cripta`: «busta_5 (la lettera di Marta: dà oggetto:lettera_marta)». Il motore deve chiamare `inventario.aggiungi('lettera_marta')` quando Elvira prende la busta.
8. **Flag scritti che nessuna condizione legge.** Li deve leggere il gioco, oppure sono solo memoria:
   - `campanile_aperto`: la porta del campanile (`m1_campanile` non lo controlla: senza questo controllo nel motore si sale anche senza Bortolo).
   - `passerella_rimessa`, `aspetta_brace_sbloccato`, `campane_ore`, `dorme_casa_velo`, `lezione_balcone`, `aiutato_nando`, `nodo1_innestato`, `primo_rilievo`, `ramo_vivo_trovato`.
   - `parlato_togna`, `parlato_bortolo`, `parlato_annunciata`, `parlato_bambini`.
   - `segreto_buste`, `segreto_figura`, `segreto_meridiana`.

**Il contratto con il motore** (letto dai contenuti, mai scritto da un effetto: deve accenderlo il gioco). Coincide con FASE1 §2.4 e §2.6 tranne i punti 5 e 7 sopra:

- **Sguardi e gesti:** `guardato_vetro`, `guardato_in_su`, `seduta`, `fiato_corto`, `planata_fatta`, `planata:ripa_san_vigilio`, `innesto_fatto`, `figura_presa`, `velo_indossato`, `atterrata_altra_valle`.
- **Letture e aperture:** `armadietto_aperto`, `lettera_letta`, `cartellino_letto`, `targa_p1_letta`, `libretto_cs1_letto`, `libretto_pagina:monte_vettore`, `pianta_aperta`, `pianta_g4_guardata`, `taccuino_spostato`.
- **Esami:**
  - `esaminato:capsula_1`, `_2`, `_3`, `_4`, `_6`, `_7`, `esaminato:serratura_5`;
  - `lente:ricci`, `lente:amenti`, `lente:corteccia`, `lente:innesto_vecchio`, `lente:busta_6`, `lente:busta_7`, `lente:cippo`.
- **Squadro e Pianta:** `tentato_lato:2-1`, `appuntato_lontano:2505`, `appuntato_lanterna`, `corbella_a_colori`, `casa_nando_rilevata`, contatore `lumi_appuntati`.
- **Cielo e notte:** `prima_meta_vista`, `meta_appena_passata`, `notte_su_E1`, `fade_viste`.
- **Fase 2:** `fase2_disponibile`.
- **Oggetti:** `marza_pedrazzini` (gesto «taglia»), `lettera_marta` (punto 7).

**Dialoghi che la partita simulata non ha giocato** (17): alternative, facoltativi e ripetibili, nessuno necessario a finire le missioni.

- Bortolo: `d_bortolo_gradini`, `d_bortolo_campanile`, `d_bortolo_campanile_velo`.
- Velati: `d_bambini`, `d_pina_soglia`, `d_pina_soglia_velo`, `d_nando_1`, `d_nando_velo`, `d_nando_mattino`, `d_nando_benedetta`.
- Ottavio: `d_ottavio_mattino_salvata`, `d_ottavio_strada`, `d_ottavio_balcone`, `d_ottavio_consigli`, `d_ottavio_pacco`.
- Altri: `d_meridiana_campanile`, `d_clelia_letto`.

Per i `velati` il simulatore ne ha fatti tre (`d_togna`, `d_bortolo_1`, `d_annunciata`), come chiede `m1_velati`.

Il design sta ancora lavorando ai file: per aggiornare questa sezione basta rilanciare `npm run verifica-contenuti -- --md`.

## Test

9 file, 140 test (`npm test`), tutti verdi:

- **`condizioni.test.ts`**:
  - parser: tutti gli atomi, precedenza, parentesi, liste, oggetti e/o/non, cache;
  - 23 errori con la posizione, prefissi e stati aggiuntivi;
  - valutatore: flag e confronti, ore e intervalli oltre la mezzanotte, giorni, notte, fatti del mondo, stato narrativo.
- **`effetti-flag-inventario.test.ts`**: tutte le forme di effetto, gli errori, la forma canonica; archivio dei flag; inventario; emettitore.
- **`missioni.test.ts`**:
  - prologo e missione 1 percorsi con gli eventi in ordine esatto, attivazioni a orario, cascata in un solo tick;
  - avvio da condizione, da effetto e iniziale; ordine libero; completamento forzato e fallimento;
  - obiettivi nel Taccuino; esporta/importa con passi nuovi.
- **`dialoghi.test.ts`**:
  - nodo e risposte filtrate, effetti di nodi e risposte, nodi finali e `vai_a` automatico, fine e registrazione;
  - errori, nodi inesistenti, interruzione;
  - scelta del dialogo per personaggio, effetti che aprono altri dialoghi, salvataggio a dialogo aperto.
- **`taccuino.test.ts`**: ordine e fonti, domande aperte e chiuse, parole barrate e sostituite, voci sconosciute, riga del cielo, obiettivi, voci automatiche, forma raggruppata.
- **`salvataggio.test.ts`**:
  - JSON canonico e hash; andata e ritorno; corruzione;
  - **migrazioni** in fila (v1→v3), su copia, ed errori (migrazione mancante, salvataggio dal futuro, doppia registrazione);
  - **due slot alternati**: ripiego sullo slot buono, scrittura troncata o che lancia, entrambi rovinati, migrazione al caricamento, salvataggi concorrenti in fila;
  - archivi asincroni e `localStorage` finto; partita salvata e ricaricata insieme al mondo, che poi prosegue.
- **`narrativa.test.ts`**:
  - fatti del mondo nelle condizioni, notte predefinita, prefissi del gioco, errori del gioco non nascosti;
  - problemi raccolti o lanciati, tutti gli effetti, taccuino e missioni che si sbloccano a vicenda;
  - tick rientrante, riga del cielo, esporta/importa.
- **`formato-reale.test.ts`** (il formato di FASE1): condizioni ed effetti nuovi, passi a `inizio`, eventi e aiuti a tempo, dialoghi automatici e riannunci, parlando/interagendo/effetto, `alla_fine` con i contatori, luoghi validi per la durata del passo, `segnalaLuogo`, Taccuino raggruppato, riga del cielo con priorità e segnaposto, scene dell'Ombrista, verifica completa.
- **`verifica.test.ts`**: contenuti corretti, errori di ogni tipo rilevati, missione mai avviata e ipotesi, condizioni impossibili, alternative e missioni avviate da un dialogo.

## Cosa resta da fare

- **Integrazione.**
  - Spostare la cartella in `src/narrativa/`.
  - Implementare `WorldFacts` sul motore: posizione nei raggi di `luoghi.json`, Pianta, orologio, varianti della notte.
  - Chiamare `tick(secondi)` dal ciclo di gioco.
  - Collegare `evento`, `tempo` e `apriDialogo` alla regia e alla UI.
  - Far accendere al motore i flag del contratto qui sopra.
- **Orologio.** Gli effetti `orologio:fermo|max|libero` arrivano come eventi: i fermi della Fase 1 (FASE1 §2.2) li applica l'orologio del motore.
- **UI.** Il modulo dà già tutto ciò che serve al Taccuino (voci con mano, domande aperte e chiuse, indizi per domanda, parole barrate, proverbi, leggende, obiettivi, riga del cielo) e al riquadro dei dialoghi (`VistaNodo` con didascalia e `chi`), ma non disegna nulla.
- **Notte e Fade** (`fade_fase1.json`): appartengono al motore. Lo script di verifica le usa solo per gli id di celle ed elementi mobili.
- **CI.** `npm run verifica-contenuti` è pensato per girare accanto ai test: esce con codice 1 se ci sono errori.
