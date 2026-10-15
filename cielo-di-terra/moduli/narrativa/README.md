# Modulo «narrativa» — il motore della storia

Motore narrativo di *Cielo di Terra* in **TypeScript puro** (niente three.js, niente DOM): flag, condizioni, missioni, dialoghi, Taccuino, inventario e salvataggio. Tutto è guidato dai JSON di `content/` e verificato con Vitest.

Il gioco fornisce i fatti del mondo tramite l'interfaccia `WorldFacts` (luoghi raggiunti, ora, giorno, celle rilevate…) e chiama `narrativa.tick()` ogni tanto; la narrativa risponde con eventi tipizzati (passo attivato, missione completata, «evento:nome», «tempo:salta-a 6»…).

```
moduli/narrativa/
  src/
    index.ts        esportazioni pubbliche
    narrativa.ts    facciata Narrativa, WorldFacts, FornitoreMondo
    condizioni.ts   parser e valutatore delle condizioni
    effetti.ts      parser degli effetti
    flag.ts         ArchivioFlag
    missioni.ts     macchina a stati delle missioni
    dialoghi.ts     esecutore dei dialoghi (getNode / choose / isFinished)
    taccuino.ts     domande, indizi, parole barrate, obiettivi, riga del cielo
    inventario.ts   inventario semplice
    salvataggio.ts  serializzazione versionata, checksum, migrazioni, due slot
    contenuti.ts    tipi dei contenuti e normalizzazione dei JSON
    eventi.ts       emettitore di eventi tipizzato
    verifica.ts     verifica statica dei contenuti + partita simulata
  scripts/verifica-contenuti.ts   verifica i veri file di content/
  test/             test Vitest
```

## Comandi

```sh
npm install
npm test                      # Vitest
npm run typecheck             # tsc --noEmit (TypeScript 7, strict)
npm run verifica-contenuti    # verifica ../../content (oppure: npx tsx scripts/verifica-contenuti.ts <cartella> [--md] [--traccia])
```

`verifica-contenuti` esce con 0 se non ci sono errori, 1 se ce ne sono, 2 se i file narrativi non esistono ancora.

## Integrazione nel gioco

```ts
import missioni from '../../content/missioni.json';
import dialoghi from '../../content/dialoghi.json';
import taccuino from '../../content/taccuino.json';
import { Narrativa, GestoreSalvataggi, archivioDaStorage, type WorldFacts } from './narrativa';

const fatti: WorldFacts = {
  ora: () => orologio.ora,                       // 0 ≤ ora < 24
  giorno: () => orologio.giorno,                 // dal giorno 1
  notte: () => orologio.notte,                   // facoltativo (predefinito 21:00-05:30, GDD §2.3)
  luogoRaggiunto: (id) => luoghiRaggiunti.has(id),
  cellaRilevata: (id) => pianta.stato(id) === 'rilevata',
  cellaVista: (id) => pianta.stato(id) !== 'bianca',          // facoltativo
  varianteParticella: (id) => notte.variante(id),             // facoltativo: carta/abitata/mietuta/scritta
  prossimoEventoCielo: () => cielo.prossimoEventoTesto(),     // facoltativo: riga fissa del Taccuino
};

const narrativa = new Narrativa({ missioni, dialoghi, taccuino }, fatti);
if (narrativa.problemi.length) console.warn(narrativa.problemi);   // contenuti malformati: non fermano il gioco

narrativa.eventi.on('passoAttivato', ({ missione, passo, obiettivo }) => hud.obiettivo(obiettivo));
narrativa.eventi.on('missioneCompletata', ({ titolo }) => hud.cartolina(titolo));
narrativa.eventi.on('evento', ({ nome, argomenti }) => scene.esegui(nome, argomenti)); // «evento:nome …»
narrativa.eventi.on('tempo', ({ azione, ore }) => (azione === 'salta-a' ? orologio.saltaA(ore) : orologio.avanza(ore)));
narrativa.eventi.on('apriDialogo', ({ dialogo }) => ui.apriDialogo(narrativa.dialoghi.avvia(dialogo)));

// nel ciclo del gioco, per esempio due volte al secondo e subito dopo un evento
// del mondo (luogo raggiunto, cella rilevata, alba):
narrativa.tick();

// dialoghi: la UI parla solo con getNode / choose / isFinished
let nodo = narrativa.parla('ottavio');            // sceglie il dialogo disponibile del personaggio
while (nodo && !narrativa.dialoghi.isFinished()) {
  const i = await ui.mostra(nodo);                // nodo.testo, nodo.risposte[i].testo, nodo.finale
  nodo = narrativa.dialoghi.choose(i);            // nodo finale: choose(0) = «continua»
}

// salvataggio: narrativa + stato del mondo (blob opaco del gioco), due slot alternati
const salvataggi = new GestoreSalvataggi({ archivio: archivioDaStorage(localStorage) });
const mondo = {
  esporta: () => ({ giocatore: { z, theta, altezza }, giorno, ora, particelle: notte.stati() }),
  importa: (blob: unknown) => ripristinaMondo(blob),
};
await narrativa.salva(salvataggi, mondo, { luogo: 'Corbella', giorno });
await narrativa.carica(salvataggi, mondo);       // null se non c'è nessun salvataggio
```

Note:

- Gli `import` dei JSON richiedono `resolveJsonModule` (già attivo nel `tsconfig` del motore). In alternativa il gioco può caricarli con `fetch` e passarli al costruttore: la facciata accetta qualunque oggetto.
- `tick()` è idempotente e rientrante: si può chiamare anche da dentro un ascoltatore. Gli effetti di una risposta di dialogo e la fine di un dialogo fanno già un `tick()` da soli.
- Gli errori dei contenuti (condizioni malformate, effetti sconosciuti, id inesistenti) non fermano il gioco: finiscono in `narrativa.problemi` e nell'evento `errore`, una volta sola ciascuno. Con `{ rigoroso: true }` lanciano subito (utile nei test e in CI).
- Nessun percorso assoluto, nessuna dipendenza fuori dalla cartella: il modulo si sposta in `src/narrativa/` così com'è. Lo script di verifica cerca `content/` tre livelli sopra di sé, quindi funziona sia in `moduli/narrativa/scripts/` sia in `src/narrativa/scripts/`.

## Linguaggio delle condizioni

Le parole chiave non distinguono maiuscole e minuscole. Precedenza: `non`/`!` > `e` > `o`; parentesi a piacere. Sinonimi: `&&` e `,` valgono «e», `||` vale «o». Una **lista** di condizioni è vera quando sono vere tutte; `null`, stringa vuota e lista vuota sono sempre vere. Sono accettati anche gli oggetti `{ "e": [...] }`, `{ "tutte": [...] }`, `{ "o": [...] }`, `{ "almeno_una": [...] }`, `{ "non": ... }`.

| Atomo | Significato |
|---|---|
| `vero`, `falso` (`sempre`, `mai`) | costanti |
| `notte`, `giorno` | è notte / non è notte (`WorldFacts.notte`, altrimenti 21:00-05:30) |
| `flag:nome` | flag acceso (definito e diverso da `false`, `0`, `""`) |
| `flag:nome=valore`, `!=`, `>`, `>=`, `<`, `<=` | confronto; valori: numeri, `vero`/`falso`, testo, `"testo con spazi"`. Un flag assente vale `false`/`0`/`""` |
| `!flag:nome`, `non flag:nome` | negazione (di qualunque cosa, anche di gruppi: `!(a o b)`) |
| `luogo:id raggiunto` | `WorldFacts.luogoRaggiunto` (il qualificatore si può omettere) |
| `ora:>=20`, `ora:<6`, `ora:20`, `ora:6-9`, `ora:22-5`, `ora:6:30-9` | ora del giorno; intervalli semiaperti `[da, a)`, che scavalcano la mezzanotte se `da > a`; `ora:20` vale per tutta l'ora `[20, 21)` |
| `giorno:>=2`, `giorno:2`, `giorno:2-4` | numero del giorno; gli intervalli di giorni sono chiusi |
| `cella:id rilevata` (anche `vista`, `bianca`, `carta`, `abitata`, `mietuta`, `scritta`; `particella:` è sinonimo) | rilevata → `cellaRilevata`; vista → rilevata o `cellaVista`; bianca → né l'una né l'altra; le varianti → `varianteParticella(id) === stato` |
| `dialogo:id finito` / `iniziato` | dialoghi finiti (chiusi normalmente) o almeno aperti |
| `missione:id completata` / `attiva` / `avviata` / `inattiva` | stato di una missione (`avviata` = attiva o completata o fallita) |
| `passo:missione/passo completato` / `attivo` | stato di un passo (anche `missione.passo`) |
| `oggetto:id`, `oggetto:id>=2` | inventario narrativo + `WorldFacts.quantitaOggetto` |
| `taccuino:id` (`presente`), `aperta`, `chiusa`, `barrata` | stato di una voce del Taccuino |

Prefissi in più (per esempio `fada:prato_alto vista`) si registrano con `new Narrativa(c, fatti, { parser: { prefissiExtra: ['fada'] } })` e si valutano con `WorldFacts.predicato(prefisso, argomento, qualificatore)`.

Gli errori di sintassi dicono che cosa non va e dove: `Condizione «flag:a e pippo:b»: prefisso sconosciuto «pippo:» (carattere 10)`.

## Linguaggio degli effetti

| Effetto | Che cosa fa |
|---|---|
| `flag:x` | accende `x` (`true`) |
| `flag:x=3`, `flag:x=nero`, `flag:x=falso` | imposta un valore |
| `flag:x+=1`, `flag:x-=2` | somma (un flag assente parte da 0) |
| `!flag:x`, `flag:-x` | rimuove |
| `taccuino:id` | scrive la voce (`taccuino:id chiudi` / `riapri` / `barra` / `rimuovi`; chiudere o barrare una voce non ancora scritta la scrive) |
| `cielo:testo libero` | imposta la riga del cielo del Taccuino (`cielo:` vuoto la cancella) |
| `missione:id avvia` | avvia una missione (anche `completa`, `fallisci`; senza azione vale `avvia`) |
| `oggetto:+id`, `oggetto:-id`, `oggetto:+id*3` | inventario |
| `evento:nome arg…` | evento `evento` per il gioco (scene, suoni, dissolvenze, cartoline) |
| `tempo:salta-a 6`, `tempo:salta-a 6:30`, `tempo:avanza 2` | evento `tempo`: il gioco sposta l'orologio |
| `dialogo:id avvia` | evento `apriDialogo`: il gioco apre il dialogo |

## API pubblica

Tutto si importa da `src/index.ts`.

### Facciata

```ts
interface WorldFacts {
  ora(): number;                       // 0 ≤ ora < 24
  giorno(): number;                    // dal giorno 1
  notte?(): boolean;                   // predefinito: NOTTE_PREDEFINITA = { inizio: 21, fine: 5.5 }
  luogoRaggiunto(id: string): boolean;
  cellaRilevata(id: string): boolean;
  cellaVista?(id: string): boolean;
  varianteParticella?(id: string): string | undefined;
  quantitaOggetto?(id: string): number;
  predicato?(prefisso: string, argomento: string, qualificatore?: string): boolean;
  prossimoEventoCielo?(): string | null;
}

interface FornitoreMondo { esporta(): unknown; importa(blob: unknown): void; }

interface OpzioniNarrativa {
  parser?: OpzioniParser;              // { prefissiExtra?: string[]; statiCellaExtra?: string[] }
  missioniIniziali?: string[];         // predefinite: missioniOrfane(contenuti)
  notte?: { inizio: number; fine: number };
  rigoroso?: boolean;
}

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
  valuta(c: CondizioneGrezza, origine?: string): boolean;
  applicaEffetti(effetti: readonly (string | Effetto)[], origine?: string): void;   // poi tick()
  applicaEffetto(effetto: string | Effetto, origine?: string): void;
  tick(): boolean;                                                                  // true se è cambiato qualcosa
  parla(personaggio: string): VistaNodo | null;
  esporta(): StatoNarrativo;
  importa(stato: StatoNarrativo): void;                                             // senza eventi né effetti
  salva(gestore: GestoreSalvataggi, mondo: FornitoreMondo, meta?: Record<string, unknown>): Promise<InfoSlot>;
  carica(gestore: GestoreSalvataggi, mondo: FornitoreMondo): Promise<RisultatoCaricamento<StatoNarrativo> | null>;
}

function missioniOrfane(c: ContenutiNormalizzati): string[];   // missioni senza avvia_quando che nessun effetto avvia

interface EventiNarrativa {
  missioneAvviata: { missione: string; titolo: string };
  passoAttivato: { missione: string; passo: string; obiettivo?: string };
  passoCompletato: { missione: string; passo: string };
  missioneCompletata: { missione: string; titolo: string };
  missioneFallita: { missione: string; titolo: string };
  dialogoAvviato: { dialogo: string; personaggio: string };
  nodoDialogo: VistaNodo;
  rispostaScelta: { dialogo: string; nodo: string; indice: number; testo: string };
  dialogoFinito: { dialogo: string; personaggio: string };
  dialogoInterrotto: { dialogo: string; personaggio: string };
  erroreDialogo: { dialogo: string; messaggio: string };
  flag: CambioFlag;                       // { nome, prima, dopo }
  oggetto: CambioOggetto;                 // { id, prima, dopo }
  taccuino: { id: string; azione: 'aggiunta' | 'chiusa' | 'riaperta' | 'barrata' | 'rimossa'; voce: VoceVisibile | null };
  rigaCielo: { testo: string | null };
  obiettivi: { obiettivi: Obiettivo[] };
  evento: { nome: string; argomenti: string[]; origine?: string };
  tempo: { azione: 'salta-a' | 'avanza'; ore: number; origine?: string };
  apriDialogo: { dialogo: string; origine?: string };
  errore: { messaggio: string; origine?: string };
}

interface StatoNarrativo {
  flag: Record<string, ValoreFlag>;
  missioni: StatoMissioni;     // { inizializzate: boolean; missioni: Record<id, { stato; passi: Record<id, StatoPasso> }> }
  dialoghi: StatoDialoghi;     // { finiti: string[]; iniziati: string[]; corrente: { dialogo; nodo } | null }
  taccuino: StatoTaccuino;     // { voci: StatoVoce[]; rigaCielo: string | null; obiettivi: Obiettivo[] }
  inventario: Record<string, number>;
}
```

### Eventi

```ts
class Emettitore<M extends object> {
  on<K extends keyof M>(tipo: K, fn: (dato: M[K]) => void): () => void;   // restituisce «stacca»
  once<K extends keyof M>(tipo: K, fn: (dato: M[K]) => void): () => void;
  off<K extends keyof M>(tipo: K, fn: (dato: M[K]) => void): void;
  onQualsiasi(fn: <K extends keyof M>(tipo: K, dato: M[K]) => void): () => void;
  emit<K extends keyof M>(tipo: K, dato: M[K]): void;
  svuota(): void;
}
```

### Flag

```ts
type ValoreFlag = boolean | number | string;
class ArchivioFlag {
  readonly eventi: Emettitore<{ cambio: CambioFlag }>;
  get(nome: string): ValoreFlag | undefined;
  esiste(nome: string): boolean;
  vero(nome: string): boolean;
  set(nome: string, valore?: ValoreFlag): void;      // predefinito true; evento solo se cambia
  rimuovi(nome: string): void;
  incrementa(nome: string, delta?: number): number;
  tutti(): Record<string, ValoreFlag>;
  esporta(): Record<string, ValoreFlag>;
  importa(dati: Record<string, unknown>): void;
}
function valoreVero(v: ValoreFlag | undefined): boolean;
```

### Condizioni

```ts
type CondizioneGrezza = string | boolean | null | undefined | readonly CondizioneGrezza[] | { readonly [k: string]: CondizioneGrezza };
type NodoCondizione =
  | { tipo: 'costante'; valore: boolean } | { tipo: 'e'; figli: NodoCondizione[] } | { tipo: 'o'; figli: NodoCondizione[] }
  | { tipo: 'non'; figlio: NodoCondizione } | { tipo: 'atomo'; atomo: Atomo };
interface ContestoCondizioni {
  flag(nome: string): ValoreFlag | undefined; ora(): number; giorno(): number; notte(): boolean;
  luogoRaggiunto(id: string): boolean; cella(id: string, stato: string): boolean;
  dialogo(id: string, stato: 'finito' | 'iniziato'): boolean;
  missione(id: string, stato: 'completata' | 'attiva' | 'avviata' | 'inattiva'): boolean;
  passo(missione: string, passo: string, stato: 'completato' | 'attivo'): boolean;
  quantitaOggetto(id: string): number;
  taccuino(id: string, stato: 'presente' | 'aperta' | 'chiusa' | 'barrata'): boolean;
  predicato?(prefisso: string, argomento: string, qualificatore?: string): boolean;
}
class ParserCondizioni {
  constructor(opzioni?: OpzioniParser);
  analizza(testo: string): NodoCondizione;                     // lancia ErroreCondizione; con cache
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
function stampaCondizione(n: NodoCondizione): string;          // forma canonica
```

### Effetti

```ts
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
function analizzaEffetto(testo: string): Effetto;              // lancia ErroreEffetto
function stampaEffetto(e: Effetto): string;
function listaEffetti(e: unknown): string[];
```

### Missioni

```ts
type StatoMissione = 'inattiva' | 'attiva' | 'completata' | 'fallita';
type StatoPasso = 'bloccato' | 'attivo' | 'completato';
class Missioni {
  constructor(defs: readonly MissioneDef[], deps: DipendenzeMissioni, iniziali?: readonly string[]);
  readonly eventi: Emettitore<EventiMissioni>;
  readonly iniziali: readonly string[];
  definizione(id: string): MissioneDef | undefined;
  elenco(): MissioneDef[];
  stato(id: string): StatoMissione;
  statoPasso(missione: string, passo: string): StatoPasso;
  attive(): string[];
  completate(): string[];
  passiAttivi(): { missione: string; passo: string; obiettivo?: string }[];
  avvia(id: string): boolean;
  completa(id: string): boolean;                        // forza (gli effetti dei passi saltati non si applicano)
  completaPasso(missione: string, passo: string): boolean;
  fallisci(id: string): boolean;
  aggiorna(): boolean;                                  // la chiama Narrativa.tick()
  esporta(): StatoMissioni;
  importa(dati: StatoMissioni): void;
}
```

Regole: una missione parte da sola quando `avvia_quando` è vera, oppure con l'effetto `missione:id avvia`, oppure perché è fra le *iniziali* (avviate al primo `tick()` di una partita nuova; predefinite: le missioni senza `avvia_quando` che nessun effetto avvia, di solito il prologo). In una missione **sequenziale** (predefinita) un passo si attiva quando il precedente è completato **e** la sua `attiva_quando` (se c'è) è vera; con `"ordine": "libero"` conta solo `attiva_quando`. Un passo attivo si completa quando `completa_quando` è vera (un passo senza `completa_quando` si completa solo da codice). Quando l'ultimo passo si completa la missione si chiude: l'ordine degli eventi è *passo completato → missione completata → effetti del passo → effetti della missione*, così la missione seguente viene annunciata dopo. Tutto avviene a cascata nello stesso `tick()`. Mentre un passo è attivo il suo `obiettivo_taccuino` sta fra gli obiettivi del Taccuino; se è l'id di una voce del Taccuino, quella voce viene anche scritta.

### Dialoghi

```ts
interface VistaNodo {
  dialogo: string; personaggio: string; nodo: string; chi: string; testo: string;
  risposte: { indice: number; testo: string }[];   // già filtrate per condizione
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
  disponibili(personaggio?: string): string[];          // condizione vera e non finiti (o ripetibili), per priorità
  perPersonaggio(personaggio: string): string | null;
  definizione(id: string): DialogoDef | undefined;
  esporta(): StatoDialoghi;
  importa(dati: StatoDialoghi): void;
}
```

`vai_a` uguale a `null`, `""`, `"fine"`, `"esci"`, `"chiudi"` (o assente) chiude il dialogo. Un nodo può avere `effetti` (applicati entrando) e, se non ha risposte, un `vai_a` automatico. Un `vai_a` verso un nodo inesistente chiude il dialogo e viene segnalato. Campi facoltativi di un dialogo: `condizione` (disponibilità), `ripetibile`, `priorita`, `inizio`.

### Taccuino

```ts
interface VoceVisibile {
  id: string; tipo: 'domanda' | 'indizio' | 'parola' | 'nota' | 'obiettivo' | string; testo: string;
  fonte?: string; tecnica?: string; locale?: string; domanda?: string; risposta?: string;
  chiusa: boolean; barrata: boolean; ordine: number;
  scrittaIl?: { giorno: number; ora: number }; chiusaIl?: { giorno: number; ora: number };
  nota: boolean;   // false se l'id non è in taccuino.json
}
class Taccuino {
  constructor(voci: readonly VoceDef[], adesso?: () => MomentoGioco | undefined);
  readonly eventi: Emettitore<EventiTaccuino>;
  definizione(id: string): VoceDef | undefined;
  ha(id: string): boolean;
  stato(id: string): StatoVoce | undefined;
  aggiungi(id: string): boolean;
  chiudi(id: string): boolean;
  riapri(id: string): boolean;
  barra(id: string): boolean;
  rimuovi(id: string): boolean;
  voce(id: string): VoceVisibile | null;
  voci(tipo?: TipoVoce): VoceVisibile[];               // in ordine di scrittura
  domandeAperte(): VoceVisibile[];
  domandeChiuse(): VoceVisibile[];
  indizi(domanda?: string): VoceVisibile[];
  parole(): VoceVisibile[];
  rigaCielo(): string | null;                           // quella dei contenuti, altrimenti quella del gioco
  impostaRigaCielo(testo: string | null): void;         // salvata
  impostaRigaCieloGioco(testo: string | null): void;    // non salvata (Narrativa la prende da WorldFacts a ogni tick)
  obiettivi(): Obiettivo[];                             // { missione, passo, testo }
  segnaObiettivo(o: Obiettivo): void;
  togliObiettivo(missione: string, passo?: string): void;
  aggiorna(valuta: (c: CondizioneGrezza) => boolean): boolean;   // sblocca_quando / chiudi_quando
  esporta(): StatoTaccuino;
  importa(dati: StatoTaccuino): void;
}
```

### Inventario

```ts
class Inventario {
  readonly eventi: Emettitore<{ cambio: { id: string; prima: number; dopo: number } }>;
  quantita(id: string): number;
  ha(id: string, n?: number): boolean;
  aggiungi(id: string, n?: number): void;
  rimuovi(id: string, n?: number): boolean;     // false se non bastano
  elenco(): { id: string; quantita: number }[];
  esporta(): Record<string, number>;
  importa(dati: Record<string, unknown>): void;
}
```

### Salvataggio

Documento salvato (JSON):

```json
{ "formato": "cielo-di-terra/salvataggio", "versione": 1, "contatore": 7,
  "salvatoIl": "2026-10-15T08:00:00.000Z", "checksum": "1f3a…",
  "dati": { "narrativa": { … }, "mondo": <blob del gioco>, "meta": { … } } }
```

Il checksum (cyrb53, 53 bit) è calcolato sul JSON canonico (chiavi ordinate) di tutto il resto: serve contro la corruzione, non contro chi modifica il file. Due slot alternati, `<prefisso>.a` e `<prefisso>.b`: ogni salvataggio va nello slot che **non** contiene il salvataggio valido più recente, poi viene riletto e verificato; se la scrittura si interrompe o lancia (spazio esaurito) l'altro slot resta intatto. Il caricamento prende lo slot valido con il contatore più alto e, se è rovinato, ripiega sull'altro (con un avviso). Se nessuno slot è caricabile ma qualcosa c'era, `carica()` lancia `ErroreSalvataggio` invece di far ripartire il gioco da zero in silenzio. Le operazioni del gestore vanno in fila.

```ts
const FORMATO_SALVATAGGIO = 'cielo-di-terra/salvataggio';
const VERSIONE_SALVATAGGIO = 1;
interface ContenutoSalvataggio<N = unknown> { narrativa: N; mondo: unknown; meta?: Record<string, unknown> }
interface DocumentoSalvataggio<N = unknown> {
  formato: string; versione: number; contatore: number; salvatoIl: string; checksum: string; dati: ContenutoSalvataggio<N>;
}
type Migrazione = (dati: Record<string, unknown>) => Record<string, unknown>;
class RegistroMigrazioni {
  registra(da: number, fn: Migrazione): this;           // dalla versione da alla da + 1
  ha(da: number): boolean;
  versioni(): number[];
  migra(dati: Record<string, unknown>, da: number, a: number): Record<string, unknown>;   // su una copia
}
function migrazioniPredefinite(): RegistroMigrazioni;   // qui si registrano le migrazioni del formato
function creaDocumento<N>(c: ContenutoSalvataggio<N>, o?: { contatore?: number; versione?: number; adesso?: Date }): DocumentoSalvataggio<N>;
function serializza<N>(c: ContenutoSalvataggio<N>, o?: OpzioniSerializza): string;
function leggiDocumento(testo: string): DocumentoSalvataggio;            // verifica formato e checksum
function deserializza<N>(testo: string, o?: { migrazioni?: RegistroMigrazioni; versione?: number }): DocumentoSalvataggio<N>;
function jsonCanonico(v: unknown): string;
function hash53(testo: string, seme?: number): string;
function checksumDocumento(doc: DocumentoSalvataggio | Omit<DocumentoSalvataggio, 'checksum'>): string;

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
  elenco(): Promise<InfoSlot[]>;          // { slot, chiave, stato: 'vuoto' | 'valido' | 'rovinato', contatore?, versione?, salvatoIl?, meta?, errore? }
  salva<N>(c: ContenutoSalvataggio<N>): Promise<InfoSlot>;
  carica<N>(): Promise<{ slot: 'a' | 'b'; documento: DocumentoSalvataggio<N>; avvisi: string[] } | null>;
  cancella(): Promise<void>;
}
```

Per cambiare formato: alzare `VERSIONE_SALVATAGGIO` e registrare in `migrazioniPredefinite()` la funzione `registra(vecchia, dati => nuoviDati)`. Il blob del mondo è opaco per questo modulo: il gioco può versionarlo per conto suo, oppure una migrazione registrata qui può toccarlo (riceve tutto `dati`). Il formato suggerito per il blob è `{ giocatore: { z, theta, altezza, direzione }, giorno, ora, particelle: { id: variante }, … }`.

### Contenuti e verifica

```ts
interface ContenutiNarrativa { missioni?: unknown; dialoghi?: unknown; taccuino?: unknown }
function normalizzaContenuti(c: ContenutiNarrativa): ContenutiNormalizzati;   // { missioni, dialoghi, taccuino, avvisi }
function verificaContenuti(c: ContenutiVerifica, o?: OpzioniVerifica): RapportoVerifica;
// ContenutiVerifica = ContenutiNarrativa & { luoghi?: unknown; personaggi?: unknown; celle?: readonly string[] }
// RapportoVerifica = { errori; avvisi; simulazione: EsitoMissione[]; traccia; ipotesi; conteggi }
```

La normalizzazione accetta piccole differenze di forma: liste o mappe per id, `nodi` come lista o mappa, risposte come stringa semplice, `effetti` come stringa singola, nomi alternativi (`obiettivo`/`obiettivo_taccuino`, `condizione`/`completa_quando`, `nome`/`titolo`, `avvia_quando`/`attiva_quando` a livello di missione, `effetti_finali`), il Taccuino come lista o raggruppato (`{ domande, indizi, parole }`). Ogni scostamento finisce negli avvisi.

**Verifica** (`verificaContenuti` e lo script): condizioni ed effetti si analizzano; ogni `vai_a` e ogni nodo iniziale esistono; nodi irraggiungibili; dialoghi che non possono finire; id citati (luoghi, dialoghi, missioni, passi, voci, personaggi, celle) esistenti; flag letti ma mai impostati e oggetti richiesti ma mai dati; passi senza `completa_quando` o senza obiettivo. Poi una **partita simulata** dal prologo in avanti, missione per missione nell'ordine del file, con fatti finti: il simulatore rende vere le condizioni come farebbe un giocatore (raggiunge i luoghi, rileva le celle, aspetta l'ora o il giorno giusti, gioca i dialoghi esplorandone i rami con istantanee e scegliendo quello che porta all'obiettivo e, a parità, quello più ricco di conseguenze). Se un flag o un oggetto non è dato da nessun contenuto lo considera dato dal gioco e lo scrive fra le ipotesi. Un dialogo già finito e non ripetibile non si rigioca: se ciò che serve era su un altro ramo, la missione risulta bloccata.

## Test

8 file, 128 test (`npm test`):

- `condizioni.test.ts`: parser (tutti gli atomi, precedenza, parentesi, liste, oggetti e/o/non, cache, 23 errori con posizione, prefissi e stati aggiuntivi) e valutatore (flag e confronti, ore e intervalli oltre la mezzanotte, giorni, notte, fatti del mondo, stato narrativo).
- `effetti-flag-inventario.test.ts`: tutte le forme di effetto, errori, forma canonica; archivio dei flag; inventario; emettitore.
- `missioni.test.ts`: prologo e missione 1 percorsi con eventi in ordine esatto, attivazioni a orario, cascata in un solo tick, avvio da condizione, da effetto e iniziale, ordine libero, completamento forzato e fallimento, obiettivi nel Taccuino, esporta/importa con passi nuovi.
- `dialoghi.test.ts`: nodo e risposte filtrate, effetti di nodi e risposte, nodi finali e `vai_a` automatico, fine e registrazione, errori, nodi inesistenti, interruzione, scelta del dialogo per personaggio (condizioni, priorità, ripetibili), effetti che aprono altri dialoghi, salvataggio a dialogo aperto, forme alternative.
- `taccuino.test.ts`: voci in ordine con fonte e momento, domande aperte/chiuse, parole barrate, voci sconosciute, riga del cielo, obiettivi, voci automatiche, forma raggruppata.
- `salvataggio.test.ts`: JSON canonico e hash, andata e ritorno, corruzione, migrazioni in fila (v1→v3) su copia ed errori (mancante, dal futuro), due slot alternati, ripiego sullo slot buono, scrittura troncata o che lancia, entrambi rovinati, migrazione al caricamento, archivi asincroni e localStorage finto, salvataggi concorrenti, partita salvata e ricaricata con il mondo che prosegue.
- `narrativa.test.ts`: fatti del mondo nelle condizioni, notte predefinita, prefissi del gioco, problemi raccolti o lanciati (rigoroso), tutti gli effetti, taccuino e missioni che si sbloccano a vicenda, tick rientrante, riga del cielo, esporta/importa.
- `verifica.test.ts`: contenuti corretti (simulazione completa), errori di ogni tipo rilevati, missione mai avviata e ipotesi, condizioni impossibili, alternative e missioni avviate da un dialogo.

## Problemi trovati nei contenuti

<!-- RAPPORTO-CONTENUTI -->
*(in attesa dei file di `content/`)*
<!-- /RAPPORTO-CONTENUTI -->

## Cosa resta da fare

- **Integrazione**: spostare la cartella in `src/narrativa/`, collegare `WorldFacts` al motore (luoghi raggiunti, Pianta, orologio, notte) e chiamare `tick()` dal ciclo di gioco; collegare gli eventi `evento`, `tempo`, `apriDialogo` alla regia e alla UI.
- **UI**: il modulo dà già tutto ciò che serve al Taccuino (voci, domande aperte e chiuse, indizi per domanda, parole barrate, obiettivi, riga del cielo) e al riquadro dei dialoghi (`VistaNodo`), ma non disegna nulla.
- **Ombrista, Bacheca, lettere della Madre**: le varianti serali scelte «da 3-4 flag per sera» si possono esprimere come dialoghi con `condizione` e `priorita`, o con un piccolo selettore sopra `valuta()`; da decidere con il design quando ci saranno i testi.
- **Testi lunghi** (`content/testi.json`) e **regole delle Fade** (`fade_fase1.json`) non sono letti da questo modulo: la notte appartiene al motore. Lo script di verifica usa `fade_fase1.json` solo per conoscere gli id delle particelle.
- **CI**: `npm run verifica-contenuti` è pensato per girare in CI accanto ai test (codice di uscita 1 se ci sono errori).
