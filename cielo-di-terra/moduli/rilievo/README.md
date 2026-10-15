# Modulo «rilievo» — il catasto di *Cielo di Terra*

Il cuore del gioco in **TypeScript puro** (niente DOM, niente three.js): il modello del Catasto, il **rilievo** di giorno (appuntare, rilevare un lato, triangoli e stazione libera attraverso il cielo), la **notte delle Fade** come macchina a stati finiti deterministica con le due leggi e le quattro regole, il **resoconto del mattino** in italiano, i **dati per la Pianta** e il **salvataggio** versionato. È guidato da `content/capisaldi.json` e `content/fade_fase1.json` ed è coperto da 106 test Vitest, fra cui la simulazione di accettazione della Fase 1 e un simulatore di 1.000 partite.

Fonti: `docs/design/GDD.md` (§2.2, §2.6, §3.2, §3.3, §3.4, §5.6, §8.3, app. B), `docs/design/FASE1.md` (§2, §3, §5, §7, §8.4, §10), `content/*.json`, `src/world/layout.json` e `src/world/cells.ts` del motore (solo per le convenzioni: il modulo non importa niente del motore).

```
moduli/rilievo/
  src/
    index.ts        esportazioni pubbliche
    costanti.ts     costanti del mondo e della griglia (copiate dal motore), orari, parametri
    griglia.ts      id ⇄ (iz, iθ), nome catastale, fogli, distanze sul foglio, ventaglio geometrico, 3D
    tempo.ts        ore «HH:MM» o numeri, fasi del giorno, intervalli, ore dei lumi e del Collare
    tipi.ts         regole (Def*), stato (StatoCatasto…), eventi, resoconto
    regole.ts       regoleDaContenuti(): compila capisaldi.json e fade_fase1.json
    catalogoGdd.ts  pilastri GDD §2.6, triangoli T1-T6, 12 mosse della Madre, 40 elementi mobili
    stato.ts        statoIniziale, letture (stato, inchiostro, cella rilevata, info), salute
    visibilita.ts   «linea libera?»: tipo della funzione del gioco, tabella dei contenuti, lumi
    rilievo.ts      passa, appunta, rileva, chiudiTriangolo, stazioneLibera, capisaldi, mano che ricorda
    notte.ts        notte / iniziaNotte / avanzaNotte / chiudiNotte, mosse, terminale e Penna, cicli del giorno
    resoconto.ts    righe del resoconto in italiano, prossime finestre
    pianta.ts       datiPianta (formato del modulo ui), celleMotore
    salvataggio.ts  blob JSON versionato con controllo, migrazioni, riconciliazione con i contenuti
    catasto.ts      facciata Catasto con eventi; collegaAlMondo / sincronizzaMondo
    casuale.ts      generatore con seme (mulberry32)
  test/             11 file, 106 test (aiuti.ts carica i contenuti veri da ../../../content)
```

## Comandi

```sh
npm install
npm test            # Vitest: 11 file, 106 test, tutti verdi (circa 3,5 s, 1.000 partite comprese)
npm run typecheck   # tsc --noEmit (TypeScript 7.0.2, strict, stesse opzioni del motore)
```

I test leggono i contenuti veri da `content/` tre livelli sopra `test/`: funzionano sia da `moduli/rilievo/test/` sia da `src/rilievo/test/` dopo lo spostamento.

## Idee di base

- **Regole e stato sono separati.** Le regole (`RegoleCatasto`) si compilano dai contenuti a ogni avvio e non si salvano. Lo stato (`StatoCatasto`) è un oggetto JSON puro: si salva così com'è.
- **Funzioni pure.** Ogni operazione riceve uno stato e ne restituisce uno nuovo: `{ stato, ok, eventi, effetti, motivo?, messaggio? }`. Lo stato ricevuto non viene mai modificato (copia «copy-on-write»: le particelle non cambiate si condividono, quindi **chi usa il modulo non deve modificare gli oggetti dello stato**). Per chi preferisce un oggetto con gli ascoltatori c'è la facciata `Catasto`.
- **Eventi per il gioco** (motore, oggetti 3D, audio, interfaccia): particelle a matita, particelle rivelate con il punto d'origine dell'inchiostro, lato chiuso, rilievo fallito con il motivo, varianti da scambiare, caposaldi spostati, resoconto.
- **Effetti per la narrativa**, già nel suo linguaggio: `flag:tentato_lato:2-1`, `flag:rilevato_lato:3-1`, `flag:appuntato:2505`, `contatore:lumi_appuntati+1`, `flag:notte_su_E1`, `flag:taccuino_spostato`, `flag:corbella_a_colori`… Il gioco li passa a `narrativa.applicaEffetti(effetti)`.
- **I tre stati** sono quelli di `fade_fase1.json`: `'bianco' | 'matita' | 'colore'`; una particella a colore ha un inchiostro, `'china'` (un rilievo di Elvira, G5) o `'seppia'` (solo un rilievo antico, il G4 del 2291). Ogni particella conserva i suoi rilievi (firma, lato o triangolo, capisaldi da cui dipende, giorno), così la seconda legge si applica davvero: se un caposaldo viene spostato, perdono il colore solo le particelle che dipendevano soltanto da lui.

## API pubblica

Tutto si importa da `src/index.ts`. Le firme sono esatte.

### Regole e stato

```ts
interface ContenutiCatasto { capisaldi?: unknown; fade?: unknown }   // i JSON di content/
interface OpzioniRegole {
  fase?: number;                               // predefinita 1 (GDD §11): decide che cosa è attivo
  parametri?: Partial<ParametriCatasto>;       // 40/600/60/150 m, 1500 m, tetti… (vedi costanti.ts)
  regoleAttive?: Partial<RegoleAttive>;        // { mosse, terminale, giro, eccezioni }
  pilastriGdd?: boolean;                       // aggiunge i pilastri del GDD §2.6 mancanti (predefinito: sì)
  triangoli?: DefTriangolo[];                  // predefiniti: T1-T6 del GDD §5.6
  particelleTrama?: Record<string, number[]>;  // particelle di trama dei triangoli (T1 → [...])
  mosse?: DefMossa[];                          // predefinite: le 12 del GDD §3.4.5
  ancore?: DefAncora[];                        // ancore della Penna (nessuna nella Fase 1)
  testi?: Partial<TestiResoconto>;
  flagCelle?: Record<number, string>;          // predefinito: 2796 → casa_nando_rilevata
  vieDiTrama?: number[];                       // particelle delle vie di trama (regola 4)
}
function regoleDaContenuti(contenuti: ContenutiCatasto, opzioni?: OpzioniRegole): RegoleCatasto;
// regole.problemi: string[]   avvisi di lettura (vuoto con i contenuti attuali)

function statoIniziale(regole: RegoleCatasto, opzioni?: { giorno?: number }): StatoCatasto;
function statoDi(stato: StatoCatasto, id: number): StatoParticella;              // 'bianco' | 'matita' | 'colore'
function inchiostroDi(stato: StatoCatasto, id: number): Inchiostro | null;        // 'china' | 'seppia'
function cellaRilevataDaElvira(stato: StatoCatasto, id: number): boolean;         // condizione «cella:id rilevata»
function cellaAColore(stato: StatoCatasto, id: number): boolean;                  // da chiunque (conta per la notte)
function firmeDi(stato: StatoCatasto, id: number): string[];
function elementoRilevato(stato: StatoCatasto, regole: RegoleCatasto, elemento: string): boolean;
function varianteDi(stato: StatoCatasto, elemento: string): string | undefined;
function inventarioCompleto(stato: StatoCatasto, regole: RegoleCatasto): boolean;   // flag corbella_a_colori
function inventarioMancante(stato: StatoCatasto, regole: RegoleCatasto): number[];
function infoParticella(stato: StatoCatasto, regole: RegoleCatasto, id: number): InfoParticella;
//   { id, catasto, stato, inchiostro, firme, elemento, hub, rifugio,
//     protettaStanotte: string | null, vegliata: boolean, cambiataStanotte: boolean, persaPer: string[] }
function impostaSalute(stato: StatoCatasto, id: number, salute: 'verde' | 'bruno' | 'grigio' | null): StatoCatasto;
function conteggi(stato: StatoCatasto): { bianco: number; matita: number; colore: number; china: number; seppia: number };
```

### Il rilievo di giorno e attraverso il cielo

```ts
interface RisultatoCatasto {
  stato: StatoCatasto; ok: boolean; eventi: EventoCatasto[]; effetti: string[];
  motivo?: CodiceMotivo; messaggio?: string;          // perché è fallito, in italiano
}

// Elvira passa: le particelle bianche entro 60 m diventano matita (stesso oggetto stato se non cambia niente)
function passa(stato: StatoCatasto, regole: RegoleCatasto, posizione: { z: number; theta: number }): RisultatoCatasto;

// Squadro in mano: il bersaglio entro 1500 m va a matita; un caposaldo diventa «visto»
type Bersaglio = { caposaldo: string } | { cella: number } | { punto: { z: number; theta: number; altezza?: number } }
               | { lanterna: true } | { lume: string };
interface InputAppunto {
  bersaglio: Bersaglio; ora: Ora;
  osservatore?: { z: number; theta: number; altezza: number };  // portata, flag «lontano» (> 600 m), abbagliamento
  lineaLibera?: FunzioneVisibilita; lumiDiOttavio?: string[];
}
function appunta(stato: StatoCatasto, regole: RegoleCatasto, input: InputAppunto): RisultatoCatasto;

// Squadro piantato sul caposaldo A, mira al caposaldo B
interface InputRilievo {
  stazione: string; mira: string; ora: Ora; giorno?: number;
  lineaLibera?: FunzioneVisibilita;      // il raycast del gioco; senza, la tabella visibile_da dei contenuti
  senzaFiato?: boolean;
  particellaVisibile?: (stazione: PuntoMira, cella: number) => boolean;  // per i lati non precalcolati
}
function rileva(stato: StatoCatasto, regole: RegoleCatasto, input: InputRilievo): RisultatoCatasto;
function anteprimaRilievo(stato: StatoCatasto, regole: RegoleCatasto, input: InputRilievo): { ok: boolean; motivo?: CodiceMotivo; messaggio?: string; nuove: number[] };
function ventaglioDi(regole: RegoleCatasto, nuovi: Readonly<Record<string, DefCaposaldo>>, a: string, b: string, particellaVisibile?: (s: PuntoMira, c: number) => boolean): number[];
function idLato(regole: RegoleCatasto, nuovi: Readonly<Record<string, DefCaposaldo>>, a: string, b: string): string;

// Di notte o alla brace: tre pilastri di tre valli (T1-T4) — 80 m attorno ai vertici + particelle di trama
interface InputTriangolo { stazione: string; mire: [string, string]; ora: Ora; giorno?: number; lineaLibera?: FunzioneVisibilita; lumiDiOttavio?: string[]; senzaFiato?: boolean }
function chiudiTriangolo(stato: StatoCatasto, regole: RegoleCatasto, input: InputTriangolo): RisultatoCatasto;

// Di notte: un punto qualunque e tre lumi → chiodo nuovo «E1», ventaglio di 40 m (T5, T6 con caposaldo: 'cs_0')
interface InputStazioneLibera {
  punto: { z: number; theta: number; altezza: number }; lumi: [string, string, string]; ora: Ora; giorno?: number;
  lineaLibera?: FunzioneVisibilita; lumiDiOttavio?: string[]; senzaFiato?: boolean; caposaldo?: string;
}
function stazioneLibera(stato: StatoCatasto, regole: RegoleCatasto, input: InputStazioneLibera): RisultatoCatasto;

function segnaCaposaldoVisto(stato: StatoCatasto, regole: RegoleCatasto, id: string): RisultatoCatasto;  // trovato a 1,5 m
function rimettiCaposaldo(stato: StatoCatasto, regole: RegoleCatasto, id: string): RisultatoCatasto;     // la pietra torna al suo posto
function parametriSquadro(stato: StatoCatasto, regole: RegoleCatasto): ParametriSquadro;
//   { manoCheRicorda, tolleranzaBolla: 1 | 2, collimazioneS: 1.5 | 0.8, rimisuraS: 5, appuntoS: 1 }
```

`CodiceMotivo` dei fallimenti: `stazione_sconosciuta`, `mira_sconosciuta`, `stessa_stazione`, `senza_fiato`, `stazione_spostata`, `mira_spostata`, `non_attivo` (fase), `troppo_corto`, `troppo_lungo`, `altra_valle`, `abbaglia`, `fuori_orario`, `coperto` (il motivo è quello dei contenuti o del raycast: «Il tasso del sagrato copre la cella…»), `collare`, `buio`, `troppo_lontano`, `lumi_insufficienti`, `lumi_allineati`, `tre_valli`, `non_notte`, e per la Penna `ancora_sconosciuta`, `ancora_occupata`, `particella_non_rilevata`, `una_per_notte`. Le verifiche del lato seguono l'ordine in cui il giocatore le incontra: caposaldo, fiato, pietra al suo posto, fase, lunghezza (40-600 m, misurata come in capisaldi.json: distanza sul foglio composta con il dislivello), stessa valle, abbagliamento (Linea accesa 05:30-19:30 e lato a meno di 150 m dall'asse), lato bloccato nei contenuti, ora del lato (`quando`), linea libera.

Effetti del rilievo: `flag:tentato_lato:<stazione>-<mira>` sempre (anche se fallisce), `flag:rilevato_lato:<stazione>-<mira>` e `flag:rilevato_lato:<id del lato>` se diverso, `flag:elemento_rilevato:E1` quando un elemento diventa tutto rilevato, `flag:casa_nando_rilevata`, `flag:corbella_a_colori` (una volta sola), `flag:triangolo_rete:1-11-3`, `flag:rilevato_triangolo:T1`, `flag:stazione_libera:E1`. Dell'appunto: `flag:appuntato:<cella>`, `flag:appuntato_lontano:<cella>`, `contatore:lumi_appuntati+1` (un lume permanente, la prima volta, di notte), `flag:appuntato_lanterna`, `flag:appuntato_lume:<id>`.

### Visibilità: «linea libera?»

```ts
interface PuntoMira { id?: string; z: number; theta: number; altezza: number; altezzaSegnale?: number }
interface ContestoVisibilita { scopo: 'lato' | 'lume' | 'appunto' | 'triangolo' | 'stazione_libera'; ora: number /* minuti */ }
type EsitoVisibilita = boolean | { libera: boolean; motivo?: string };
type FunzioneVisibilita = (da: PuntoMira, a: PuntoMira, contesto: ContestoVisibilita) => EsitoVisibilita;

function visibilitaDaTabella(regole: RegoleCatasto, nuovi?: Readonly<Record<string, DefCaposaldo>>): FunzioneVisibilita;
function lumeVisibile(c: DefCaposaldo, oraMinuti: number, lumiDiOttavio?: readonly string[]): { acceso: boolean; codice?: 'buio' | 'collare'; motivo?: string };
function puntoDi(c: DefCaposaldo): PuntoMira;
function nomeBreve(c: DefCaposaldo): string;     // «Pilastro 14», «chiodo 7», «Caposaldo Zero», «chiodo E1»
```

### La notte delle Fade

```ts
interface ElviraNotte {
  cella?: number | null;                                     // dove passa la notte
  percorso?: { ora: string | number; cella: number | null }[]; // oppure: da quell'ora in poi è lì
  sveglia?: boolean;                                         // veglia tutta la notte
}
interface InputNotte {
  elvira?: ElviraNotte;
  seme?: number;                         // le scelte (i chiodi della Notte dei Termini) dipendono solo dal seme
  dopoSvolta?: boolean;                  // Protocollo Rientro: Mietuta
  ombraDiMeridiana?: boolean;            // la Madre non vede le firme G5
  veloDellaMadre?: boolean;              // A1-A3 e B2 colpiscono le case degli Smascherati
  particelleProtette?: number[];         // protette come rilevate (Radice di confine…)
  alternativeNonDisponibili?: string[];  // il guado non si vede: il sentiero necessario resta
  prossimeFinestreExtra?: string[];      // Meta, marea, vento…: righe calcolate dal gioco
}
interface RisultatoNotte { nuovoStato: StatoCatasto; resoconto: Resoconto; eventi: EventoCatasto[]; effetti: string[] }

function notte(stato: StatoCatasto, regole: RegoleCatasto, input?: InputNotte): RisultatoNotte;   // pura e deterministica
// a passi, per la veglia:
function iniziaNotte(stato: StatoCatasto, regole: RegoleCatasto, input?: InputNotte): StatoCatasto;
function avanzaNotte(stato: StatoCatasto, regole: RegoleCatasto, finoA: Ora, elvira?: { cella: number | null }): { stato: StatoCatasto; eventi: EventoCatasto[] };
function chiudiNotte(stato: StatoCatasto, regole: RegoleCatasto): { stato: StatoCatasto; resoconto: Resoconto; eventi: EventoCatasto[] };
function previsioneNotte(stato: StatoCatasto, regole: RegoleCatasto, input?: InputNotte): Resoconto;  // l'«avviso della sera»
function varianteBersaglio(e: DefElemento, corrente: string, dopoSvolta: boolean): string;

// di giorno
function impostaVariante(stato: StatoCatasto, regole: RegoleCatasto, elemento: string, variante: string): RisultatoCatasto;  // effetto variante:E1=Abitata
interface InputCicli { da: Ora; a: Ora; chiPresente?: (chi: string) => boolean }   // intervallo (da, a]
function applicaCicliDelGiorno(stato: StatoCatasto, regole: RegoleCatasto, input: InputCicli): RisultatoCatasto;

// mosse della Madre (Fase 5)
interface ContestoMosse { atto: 'I' | 'II' | 'III'; notte?: number; flag?: readonly string[]; contatori?: Readonly<Record<string, number>>; veloDellaMadre?: boolean; forza?: readonly string[] }
function annunciaMosse(stato: StatoCatasto, regole: RegoleCatasto, ctx: ContestoMosse): RisultatoCatasto;  // la sera, alla brace
function condizioneMossa(stato: StatoCatasto, condizione: string, ctx?: Pick<ContestoMosse, 'flag' | 'contatori'>): boolean;

// Penna di catasto (Fase 5)
function scriviConPenna(stato: StatoCatasto, regole: RegoleCatasto, input: { ancora: string; giorno?: number }): RisultatoCatasto;
function rimisuraScrittura(stato: StatoCatasto, regole: RegoleCatasto, ancora: string): RisultatoCatasto;
```

**Come gira una notte.** La notte del giorno N va dalle 21:00 alle 05:30; alla fine `stato.giorno` diventa N + 1. Alle 22:00 si applicano la **regola 1** (le mosse annunciate la sera prima: spostano capisaldi, al massimo 8; le particelle che dipendevano solo da loro tornano a matita, con `persaPer` per la rimisura in 5 s) e la **regola 2** (il G3 cancella le scritture costruite e non rimisurate, poi le Fade costruiscono quelle di oggi). Poi, all'ora fissa di ogni elemento (`ora_fade`), la **regola 3** porta l'elemento non rilevato alla Carta, o di uno stadio verso la Carta (la casa di Nando), o a Mietuta dopo la svolta, salvo la **regola 4**: l'hub, le vie di trama, i rifugi, la particella dove sta Elvira, il sentiero necessario senza alternativa visibile. Un elemento rilevato solo in parte torna alla Carta per intero. Il tetto di particelle cambiate per notte è un parametro (`tettoParticellePerNotte`, senza tetto di serie: il design dà solo il tetto di 8 capisaldi). Gli elementi legati («le stesse pietre»): il muro di Ronco si richiude solo con le pietre tolte alla casa quella notte, e se il muro è misurato le pietre restano in un mucchio (nota nella riga della casa); di giorno Nando apre la breccia solo se ha una casa da rifare. Nella Fase 1 sono attive le regole 3 e 4 (GDD §11): `annunciaMosse` non annuncia niente e il terminale è spento.

Effetti della notte: `flag:notte_su_<E>` (Elvira era sull'elemento al passaggio), `flag:notte_vegliata:<N>`, il flag della Pesarina della notte (`taccuino_spostato`, solo la prima notte e solo se Elvira dorme), `flag:mossa_fatta:A1`, `flag:mossa_deviata:A1`, `contatore:smeriglio=1`, `evento:tempo_della_perla`.

### Il resoconto del mattino

```ts
interface Resoconto {
  notte: number; giorno: number;
  titolo: string;                        // «Che cosa è cambiato stanotte»
  quieta: boolean;                       // nessuna riga rossa
  righe: RigaResoconto[];                // { colore: 'rosso'|'verde'|'grigio', testo, motivo, regola: 1|2|3|4, elemento?, caposaldo?, particelle }
  prossimeFinestre: string[];            // «Alle 07:00: il campanaro Bortolo rimette i gradini.»
  testo: string[];                       // pronto per il Taccuino: prima le rosse (o «Notte quieta.»), poi le altre
  particelleCambiate: number[];          // da segnare in rosso sulla Pianta fino alle 12:00
  cambiamenti: Cambiamento[];            // il dettaglio, in ordine di tempo
  cronologia: { ora: string; testo: string; elemento?: string; dove?: string }[];  // per chi veglia
  effetti: string[];
}
function testoResoconto(r: Resoconto): string;
```

Righe rosse: «Passerella del Messo: non misurata, tornata alla Carta.», «Casa di Nando: non misurata, un muro in meno.», «Muro di Ronco: non misurato, le pietre rimesse nel muro.», «Pilastro 4 spostato di 3 m a Sera. 21 particelle sono tornate a matita.», «Scala del fienile alto: scrittura G5 cancellata dal G3.». Righe verdi, la prima notte in cui il rilievo salva un elemento: «Passerella del Messo: misurata, è rimasta.». Righe grigie: «Passerella del Messo: c'eri tu, le Fade ti hanno girato attorno.». Ogni particella cambiata sta in una riga rossa (verificato dal simulatore).

### Dati per la Pianta e per il motore

```ts
function datiPianta(stato: StatoCatasto, regole: RegoleCatasto, opzioni?: { ora?: Ora; giorno?: number; tuttiICapisaldi?: boolean }): DatiPiantaCatasto;
interface DatiPiantaCatasto {
  griglia: { nZ: 75; nTheta: 96; stati: Uint8Array /*0 bianco,1 matita,2 colore*/; seppia: Uint8Array; cambiate: Uint8Array; salute: Uint8Array /*1 verde,2 bruno,3 grigio*/ };
  particelle: { id: number; catasto: string; stato: StatoParticella; inchiostro?: Inchiostro; cambiata?: boolean }[];
  capisaldi: { id; numero; etichetta; tipo: 'pilastro' | 'chiodo'; nome; z; theta; rilevato; visto; inchiostro?; spostato? }[];  // solo trovati o rilevati
  lati: { id: string; da: string; a: string; firma: string }[];
  triangoli: { id: string; tipo: string; vertici: string[] }[];
  resoconto?: { righe: string[] /*rosse*/; altreRighe: { testo; colore: 'verde' | 'grigio' }[]; prossimaFinestra?: string; dettaglio: RigaResoconto[]; quieta: boolean };  // fino alle 12:00
  inventario?: { nome: 'Corbella'; aColore: number; totale: 63 };
  totaleParticelle: number;
  conteggi: { bianco; matita; colore; china; seppia };
}
function celleMotore(stato: StatoCatasto): Uint8Array;                  // 7.200 codici CellState del motore
const CODICE_MOTORE = { bianco: 0, matita: 1, colore: 2 };
```

Il formato ricalca `DatiPianta` del modulo `ui` (`moduli/ui/src/pianta/modello.ts`): `griglia`, `capisaldi`, `lati`, `resoconto.righe`, `resoconto.prossimaFinestra` e `totaleParticelle` si passano così come sono; i campi in più (`altreRighe`, `inchiostro`, `firma`, `triangoli`) l'interfaccia può ignorarli o usarli.

### Salvataggio

```ts
interface BlobCatasto { formato: 'cielo-di-terra/catasto'; versione: number; controllo: string /* FNV-1a */; stato: StatoCatasto }
function salvaCatasto(stato: StatoCatasto): BlobCatasto;
function serializzaCatasto(stato: StatoCatasto): string;
function caricaCatasto(blob: unknown, regole?: RegoleCatasto, opzioni?: { tollerante?: boolean }): { stato: StatoCatasto; avvisi: string[] };
function deserializzaCatasto(testo: string, regole?: RegoleCatasto, opzioni?: { tollerante?: boolean }): { stato: StatoCatasto; avvisi: string[] };
class ErroreSalvataggio extends Error {}
```

Il blob contiene tutto: particelle con i loro rilievi, elementi, capisaldi (visti, rilevati, spostati), chiodi nuovi, lati, triangoli, ancore, mosse, contatori, l'ultima notte con il resoconto e anche una notte in corso (si salva a metà veglia e si riprende con lo stesso esito). `caricaCatasto` rifiuta i blob non del catasto, di versioni future o manomessi (controllo sbagliato); con le regole riconcilia lo stato con i contenuti correnti (elementi nuovi o tolti, varianti rinominate, capisaldi e ancore nuove) e restituisce gli avvisi. Le migrazioni fra versioni hanno già il loro posto (`MIGRAZIONI` in salvataggio.ts).

### La facciata `Catasto`

```ts
class Catasto {
  constructor(regole: RegoleCatasto, stato?: StatoCatasto);
  readonly regole: RegoleCatasto;
  get stato(): StatoCatasto;
  ultimiEffetti: string[];                                         // effetti dell'ultima operazione
  on<T extends EventoCatasto['tipo']>(tipo: T, fn: (e: Extract<EventoCatasto, { tipo: T }>) => void): () => void;
  on(tipo: '*', fn: (e: EventoCatasto) => void): () => void;
  passa(p): RisultatoCatasto; appunta(i): RisultatoCatasto; rileva(i): RisultatoCatasto;
  chiudiTriangolo(i): RisultatoCatasto; stazioneLibera(i): RisultatoCatasto;
  segnaCaposaldoVisto(id): RisultatoCatasto; rimettiCaposaldo(id): RisultatoCatasto;
  impostaVariante(elemento, variante): RisultatoCatasto; cicliDelGiorno(i: InputCicli): RisultatoCatasto;
  annunciaMosse(ctx): RisultatoCatasto; scriviConPenna(ancora): RisultatoCatasto; rimisuraScrittura(ancora): RisultatoCatasto;
  impostaSalute(id, salute): void; parametriSquadro(): ParametriSquadro;
  notte(input?): RisultatoNotte; iniziaNotte(input?): void; avanzaNotte(finoA, elvira?): EventoCatasto[]; chiudiNotte(): Resoconto;
  previsione(input?): Resoconto;
  statoParticella(id): StatoParticella; cellaRilevata(id): boolean; cellaAColore(id): boolean;
  variante(elemento): string | undefined; info(id): InfoParticella; inventarioCompleto(): boolean;
  ultimoResoconto(): Resoconto | null; pianta(opzioni?): DatiPiantaCatasto;
  salva(): BlobCatasto; ripristina(blob, opzioni?): string[]; static carica(blob, regole, opzioni?): Catasto;
}
interface MondoCelle { setCellState(id: number, stato: 0 | 1 | 2): void; revealCells(ids: number[], origine: { z: number; theta: number }): void }
interface OggettiVarianti { mostraVariante(elemento: string, variante: string, pezzi: { mostra: string[]; nascondi: string[] }): void }
function sincronizzaMondo(stato: StatoCatasto, mondo: MondoCelle): void;
function collegaAlMondo(catasto: Catasto, mondo: MondoCelle, oggetti?: OggettiVarianti): () => void;
```

Altre esportazioni: le costanti (`R`, `L`, `CELLE_NZ`, `CELLE_NTHETA`, `CELLA_DZ`, `CELLA_DTHETA`, `STRISCE`, `FOGLI`, `ORARI`, `PARAMETRI_PREDEFINITI`, `FIRMA_ELVIRA`), la griglia (`idCella`, `centroCella`, `nomeCatastale`, `foglioDi`, `strisciaDi`, `distanzaFoglio`, `celleNelRaggio`, `celleNellaFascia`, `lunghezzaLato`, `posizione3D`, `distanzaSegmentoDallAsse`…), il tempo (`minuti`, `formattaOra`, `faseDelGiorno`, `lineaAccesa`…), il catalogo del GDD (`PILASTRI_GDD`, `TRIANGOLI_GDD`, `MOSSE_GDD`, `CATALOGO_ELEMENTI`, `TETTO_MOSSE_PER_ATTO`) e tutti i tipi.

## Come si integra nel gioco

### 1. Avvio

```ts
import capisaldi from '../../content/capisaldi.json';
import fade from '../../content/fade_fase1.json';
import { Catasto, regoleDaContenuti, collegaAlMondo, sincronizzaMondo, caricaCatasto } from './rilievo';

const regole = regoleDaContenuti({ capisaldi, fade });          // { fase: 1 } di serie
if (regole.problemi.length) console.warn(regole.problemi);      // contenuti malformati: non fermano il gioco
const catasto = salvataggio ? Catasto.carica(salvataggio, regole) : new Catasto(regole);

sincronizzaMondo(catasto.stato, world);   // il World del motore parte tutto a matita: qui prende lo stato vero
collegaAlMondo(catasto, world, oggetti3d);
```

`collegaAlMondo` traduce gli eventi così: `particelle_matita` → `world.setCellState(id, 1)`; `particelle_rivelate` → `world.revealCells(celle, origine)` (l'inchiostro si allarga dalla stazione: `origine` è il chiodo o il pilastro dove è piantato lo squadro); `particelle_perse` (un caposaldo spostato) → `world.setCellState(id, 1)`; `variante_cambiata` → `oggetti3d.mostraVariante(elemento, variante, { mostra, nascondi })`. Gli altri eventi li ascolta il gioco direttamente:

```ts
catasto.on('particelle_rivelate', (e) => {
  if (e.primoDelFoglio) render.grigliaDelFoglio(e.foglio, 6);   // la griglia a china del foglio per 6 s (GDD §3.2)
  audio.musica(e.rimisura ? 'rimisura' : 'primo_rilievo');
  // e.ripassate: particelle seppia ripassate a china (per la Pianta; nel mondo erano già dipinte)
});
catasto.on('rilievo_fallito', (e) => ui.reticolo(e.messaggio));    // «Il tasso del sagrato copre la cella…»
catasto.on('lato_chiuso', (e) => audio.matita());
```

### 2. La visibilità: un raycast sul terreno e sui collisori

Il gioco passa a `rileva`, `appunta`, `chiudiTriangolo` e `stazioneLibera` una `FunzioneVisibilita`. Il motore non ha ancora un raycast; ecco come farlo con le sue funzioni (`cylToWorld`, `worldToCyl` di `src/world/cylinder.ts`, `groundHeight` di `src/world/terrain.ts`, `world.colliders.query`):

```ts
const lineaLibera: FunzioneVisibilita = (da, a) => {
  const occhio = cylToWorld(da.z, da.theta, da.altezza + 1.5);                  // squadro all'altezza degli occhi
  const segnale = cylToWorld(a.z, a.theta, a.altezza + (a.altezzaSegnale ?? 0) + 0.3);
  const d = occhio.distanceTo(segnale);
  for (let t = 2; t < d - 2; t += 2) {                                         // un passo ogni 2 m
    const p = occhio.clone().lerp(segnale, t / d);
    const c = worldToCyl(p);
    if (c.h < groundHeight(c.z, c.theta)) return { libera: false, motivo: 'Il terreno copre la mira.' };
    for (const col of world.colliders.query(c.z, c.theta, 3)) if (contiene(col, p)) return { libera: false, motivo: motivoDi(col) };
  }
  return true;
};
```

I lati che i contenuti dichiarano bloccati (`chiudibile: false`, come 1-2 per il tasso e 1-5 per la tettoia) restano bloccati con il loro motivo anche se il raycast dicesse «libera»: i contenuti hanno l'ultima parola. Senza funzione, il modulo usa la tabella `visibile_da` / `non_visibile_da` di capisaldi.json (è quella dei test), che però non sa rispondere per i punti liberi della stazione libera. Per `appunta` il raycast di solito non serve: il gioco appunta ciò che lo sguardo ha già colpito, e passa solo `osservatore` per la portata di 1500 m, il flag «lontano» e l'abbagliamento.

### 3. Di giorno

```ts
// ogni secondo circa, o a ogni cambio di particella sotto i piedi
catasto.passa({ z: elvira.z, theta: elvira.theta });
// squadro in mano, mira tenuta 1 s (catasto.parametriSquadro().appuntoS)
catasto.appunta({ bersaglio: { caposaldo: 'cs_6' }, ora: orologio.ora, osservatore: elvira.occhio });
// pianta, livella, collima (1,5 s o 0,8 s con la mano che ricorda), leggi:
const r = catasto.rileva({ stazione: 'cs_3', mira: 'cs_1', ora: orologio.ora, lineaLibera, senzaFiato: fiato.corto });
narrativa.applicaEffetti(catasto.ultimiEffetti);
// gli abitanti rimettono le cose (Bortolo 07:00, Nando 08:30, Ottavio 19:30): a ogni avanzamento dell'orologio
catasto.cicliDelGiorno({ da: oraPrecedente, a: orologio.ora, chiPresente: (chi) => png.alPosto(chi) });
```

### 4. Di notte

- **Elvira dorme** (`dormi:fino 05:30`, letto o rifugio): `const r = catasto.notte({ elvira: { cella: cellaDelLetto }, seme })`, poi `narrativa.applicaEffetti(r.effetti)` e la Pianta si apre sul resoconto (`pianta:resoconto`). Lo scambio delle varianti avviene mentre lei dorme: gli eventi `variante_cambiata` arrivano tutti insieme.
- **Elvira veglia**: alle 21:00 `catasto.iniziaNotte({ elvira: { sveglia: true }, seme })`; a ogni minuto di gioco (o a ogni «aspetta fino a») `catasto.avanzaNotte(orologio.ora, { cella: cellaDiElvira })`: gli eventi `variante_cambiata` arrivano all'ora del passaggio (`e.ora`) e il gioco scambia i pezzi quando il giocatore non guarda; `resoconto.cronologia` dice che cosa mettere in scena (le Fade che escono alle 22:05, il ballo alle Selve alte…). All'alba `catasto.chiudiNotte()`.
- **Il giocatore non dorme e non segue la notte** (è nel Guscio, ha messo in pausa…): alle 05:30 l'orologio chiama comunque `catasto.notte({ elvira: { cella } })` (o `chiudiNotte()` se la notte era iniziata). Ogni notte va chiusa una volta sola: lo stato passa al giorno dopo.
- **La sera** (alla brace, prima dell'Ombrista) `catasto.annunciaMosse({ atto, flag })` sceglie e annuncia le mosse della Madre per la notte: l'evento `mossa_annunciata` porta la frase dell'Ombrista e della lettera alla Bacheca. Nella Fase 1 non annuncia niente.
- **L'avviso della sera** (opzione di accessibilità, GDD §10): `catasto.previsione({ elvira })` restituisce il resoconto che la notte scriverebbe, senza cambiare niente.

### 5. Gli oggetti 3D degli elementi mobili

Ogni variante ha i suoi `pezzi` in fade_fase1.json (`assi_passerella_x3`, `decal_prato_pettinato`…): l'evento `variante_cambiata` dice quali mostrare e quali nascondere. All'avvio e dopo un caricamento il gioco mostra per ogni elemento la variante `catasto.variante(id)`. La nota dell'evento (`nota`) segnala il mucchio di pietre al margine quando il muro di Ronco è misurato.

### 6. Con la narrativa (moduli/narrativa)

```ts
const fatti: WorldFacts = {
  ...,
  cellaRilevata: (id) => catasto.cellaRilevata(Number(id)),               // «cella:id rilevata» = rilievo G5
  cellaVista: (id) => catasto.statoParticella(Number(id)) !== 'bianco',
  varianteParticella: (id) => catasto.variante(id),
};
narrativa.eventi.on('evento', ({ nome, argomenti }) => {
  if (nome === 'variante') catasto.impostaVariante(argomenti[0], argomenti[1]);   // variante:E1=Abitata
  if (nome === 'pianta') ui.pianta(catasto.pianta({ ora: orologio.ora, giorno: orologio.giorno }));
});
// dopo ogni operazione del catasto:
narrativa.applicaEffetti(catasto.ultimiEffetti);
```

### 7. Salvataggio

Il salvataggio automatico all'alba e a ogni passo di missione (GDD §8.5) mette `catasto.salva()` nel blob del mondo (`FornitoreMondo.esporta` della narrativa); al caricamento `catasto.ripristina(blob)` e poi `sincronizzaMondo`.

## Costanti copiate dal motore

Dal motore (`src/world/layout.json`, `constants.ts`, `cells.ts`) e dal GDD §2.1, in `src/costanti.ts`: R = 646 m, L = 3000 m, periodo 51 s; griglia di 75 righe in z × 96 colonne in θ, celle di 40 m × 3,75°, id = iz·96 + iθ, centro ((iz + 0,5)·40, (iθ + 0,5)·3,75); strisce valle-1 0-90, finestra-ponti 90-120, valle-2 120-210, finestra-2 (Cieca) 210-240, valle-3 240-330, finestra-3 (Vedove) 330-360; il Sordo da z 2640; terna 3D come `cylToWorld` (x = −r·sin θ, y = −r·cos θ, r = 646 − h); codici `CellState` Blank 0, Pencil 1, Painted 2. Orari (GDD §2.3): alba 05:30, giorno pieno 06:30, brace 19:30, notte 21:00, giro 22:00-04:30, segni rossi fino alle 12:00. Il test `griglia.test.ts` confronta le costanti con `layout.json` quando il file è raggiungibile.

## Numeri verificati (test/accettazione.test.ts)

| Fatto del design | Atteso | Risultato |
|---|---|---|
| particelle dell'area (fade_fase1.json) | 228: 127 bianche, 86 matita, 15 colore | uguale |
| striscia della Cripta (FASE1 §8.4) | 15 particelle del lato 1-11, seppia, G4 | uguale; `cella:… rilevata` è falsa finché Elvira non le ripassa |
| brace del giorno 1 (notti[0].stato_atteso_alla_brace) | E1-E4 Abitata | uguale (cicli di Bortolo, Nando, Ottavio) |
| notte 1 (FASE1 M1.12, notti[0].giro) | in rosso passerella, scorciatoia, casa di Nando, muro di Ronco; prossime finestre 07:00, 08:30, brace | 4 righe rosse con gli stessi da/a/motivo/particelle; «Alle 07:00…», «Alle 08:30…», «Alle 19:30…»; `taccuino_spostato` |
| notte 1 sulla passerella (M1.11) | la passerella resta | resta; `notte_su_E1`, riga grigia |
| chiodo 2 (M1.17) | il tasso copre | `coperto`, «Il tasso del sagrato copre la cella…», `flag:tentato_lato:2-1` |
| lato 1-3 (M1.18) | 20 particelle | ventaglio 20 = 13 nuove + 7 ripassate dalla seppia alla china; griglia del foglio; 2214 e 2213 rilevate; scorciatoia misurata |
| lato 7-8 (M1.19) | 13 particelle, passerella | 13; `cella:2797` e `cella:2798` rilevate |
| notte 2 (M1.21, notti[1].esito_atteso) | in rosso solo casa e muro; passerella e scorciatoia «misurata: è rimasta» | uguale |
| rete di Corbella (FASE1 §3, §7.1) | 16 lati chiudibili, inventario di 63 particelle | 16 lati chiusi, 63/63 a colore (e tutte a china), `corbella_a_colori` una volta, `casa_nando_rilevata`; 91 particelle a colore in tutto (l'unione dei 16 ventagli) |
| notti dopo | «Notte quieta» | la prima con due righe verdi (casa e muro), poi nessuna riga |

Il simulatore (`test/simulatore.test.ts`) gioca 1.000 partite casuali delle prime tre notti (rilievi a caso anche sui lati bloccati, appunti, passaggi, Elvira che dorme o veglia in posti e percorsi casuali, abitanti assenti) e non trova violazioni: nessuna notte tocca hub, rifugi, vie di trama o la particella di Elvira; ogni particella cambiata ha la sua riga rossa; nessun caposaldo spostato e nessun rilievo perso nella Fase 1; mai una particella torna bianca; il guado del Sass non cambia mai; i lati 1-3 e 7-8 restano sempre chiudibili; nessun testo incompleto e nessun Severino; lo stato di partenza non viene mai modificato; stesso seme, stessa partita.

## Incoerenze trovate nei contenuti (con la correzione proposta)

Nessun file dei contenuti è stato modificato.

1. **missioni.json → `m1_strada.note`**: «Il lato 7-8 chiude la passerella; vanno bene anche 1-7, 1-8 o 8-11». Il lato **1-7 copre solo 2797** (la passerella), non 2798 (il sentiero nel prato di Ronco): da solo non completa il passo (`cella:2797 rilevata e cella:2798 rilevata`) e la notte riporta la passerella alla Carta, perché un elemento rilevato in parte torna alla Carta per intero. Lo stesso vale per 1-6 e 6-8 (solo 2798). Correzione: «vanno bene anche 1-8 o 8-11 (o 1-7 insieme a 1-6 o 6-8)». Il test «quali lati salvano ogni elemento mobile» lo documenta.
2. **«Hub» nella regola 4.** fade_fase1.json → regole[3].fase1 dice «Hub = particelle di tipo abitato e piazza», ma 2407 (scorciatoia), 2699 (muro di Ronco) e 2796 (casa di Nando) sono `tipo: "abitato"` con `hub: false`, giustamente: se fossero hub le Fade non le toccherebbero mai. Anche il GDD §3.4.4 dice «l'hub (il nucleo di Corbella)» mentre §3.4.3 mette quattro elementi mobili «nel nucleo di Corbella». Il modulo usa il campo `hub`. Correzione: «Hub = particelle con `hub: true` (case e piazza del nucleo, esclusi i suoi quattro elementi mobili)», nel JSON e nel GDD.
3. **Ventagli tagliati all'area.** I lati del Pilastro 6 (1-6, 2-6, 5-6, 6-8) non contengono 2708, 2804, 2900 (colonna 20, θ 75°-78,75°, Valle 1) che la regola dei 60 m include: sono fuori da `area_fase1` (iθ 1-19). Per la Fase 1 va bene, ma il `_nota` di capisaldi.json non lo dice. Correzione: scriverlo nel `_nota` («ventagli ritagliati all'area della Fase 1») e, quando l'area cresce, aggiungere le tre particelle a quei quattro lati (il modulo le calcolerebbe da solo con `celleNellaFascia`).
4. **Il genere nel resoconto.** `resoconto_del_mattino.righe.Carta` = «{nome}: non misurata, tornata alla Carta.» vale per la passerella e la scorciatoia, non per il **Muro** di Ronco. Il modulo usa il motivo per elemento scritto in `notti[].giro` («Non misurato: le pietre rimesse nel muro.») e ricade sul modello solo se manca. Correzione: un campo `motivi` (o `genere`) in ogni elemento di `elementi_mobili`.
5. **La Pesarina se Elvira veglia.** `notti[0].pesarina` dice che apre il Taccuino «dove dorme Elvira», ma non che cosa succede se lei veglia tutta la notte. Il modulo accende `taccuino_spostato` solo se Elvira dorme. Correzione: scriverlo nella notte 1 (o dire che la Pesarina passa comunque).
6. **I pilastri della rete non hanno un lume.** `rete_corbella` non dà `lume` ai pilastri 1, 4, 6, ma i triangoli T5 e T6 collimano di notte il Pilastro 1 da lontano. Il modulo dà ai pilastri della rete il lume di Ottavio (21:00-05:00). Correzione: aggiungere `lume`, `ore`, `collare` anche ai pilastri della rete.
7. **Il Collare nei lontani**: due formati («coperto dal Collare fra le 01:00 e le 01:40», «dentro il Collare dalle 02:00 alle 02:40») e un uso improprio (`cs_0.collare = "sempre bianco"`). Il modulo li legge tutti, ma propone `collare_ore: [["01:00","01:40"]]` e un campo `sempre_bianco: true` per il Caposaldo Zero.
8. **Lati di notte su chiodi senza segnale.** Tutti i lati vicini hanno `quando: "giorno, brace e notte"`, anche verso chiodi d'ottone senza segnale (`altezza_segnale: 0`), che di notte a 200 m non si vedono. Il modulo segue i contenuti. Da decidere: di notte solo i lati verso un segnale illuminato.
9. **`corbella_a_colori`**: FASE1 §2.6 dice «tutte le particelle dell'inventario sono rilevate» senza dire se le 15 seppia del G4 contano. Il modulo conta il colore di chiunque (con i 15 lati non G4 le 63 particelle sono comunque tutte anche a china). Correzione: specificarlo.
10. **«Il lato 1-3 colora 20 particelle»** (FASE1 M1.18): 7 delle 20 sono già a seppia (2409, 2410, 2504, 2505, 2506, 2601, 2602); nel mondo cambiano 13 particelle, sulla Pianta 7 passano dalla seppia alla china. Proposta: scriverlo così nel testo, perché l'animazione dell'inchiostro riguarda 13 particelle.
11. **Il nome catastale «4-117»** (GDD §2.2, orto di Battista) non segue nessuna formula: il GDD dà la numerazione solo per le valli. Il modulo propone per il Sordo (foglio 4) righe da z 2640 sulle 96 colonne (l'orto, cella 6949, sarebbe «4-614») e per le Finestre (foglio 5) le tre strisce da 8 colonne in fila. Correzione: una formula nel GDD per i fogli 4 e 5, o un nome fisso per l'orto.
12. **Quote dei pilastri**: GDD §2.6 dà il Pilastro 4 a h 90 e il 6 a h 42, capisaldi.json a 91,0 e 41,7 (quote del terreno del motore). Valgono i contenuti; la tabella del GDD andrebbe aggiornata.
13. **Mossa A1 e gioco libero.** La condizione di A1 («Elvira ha rilevato un lato con il Pilastro 4») è già vera nel gioco libero della Fase 1 (lati 1-4, 3-4, 4-37). Il modulo spegne le mosse per fase (GDD §11): quando arriverà la Fase 5, A1 scatterà la prima sera per chi ha già chiuso quei lati. Da tenere presente.

## Decisioni prese dove il design non è esplicito

- **Seppia e china.** Ripassare a china una particella seppia non toglie il rilievo G4: la particella conserva tutti i rilievi validi; la china prevale. `cella:id rilevata` della narrativa è vera solo con un rilievo G5 (FASE1 §2.3); la notte guarda il colore di chiunque (fade_fase1.json → condizioni_notte).
- **Righe verdi** solo la prima notte in cui il rilievo salva un elemento dopo essere stato fatto (poi la Pianta non ripete «è rimasta» ogni mattina).
- **Elementi legati**: il muro di Ronco cambia solo se la casa ha perso le pietre la stessa notte; di giorno Nando apre la breccia solo se rifà la casa (le stesse pietre non si raddoppiano).
- **Rimettere un caposaldo** non ridà il colore da solo: si rimisura (in 5 s; l'evento ha `rimisura: true`), come dice il GDD §3.2.
- **Cancellazione del G3**: la particella dell'ancora torna a matita (GDD §3.3, transizioni ammesse), l'elemento alla Carta.
- **Mosse della Madre**: al massimo una per sera (parametro `mossePerNotte`), il tetto per atto (2, 3, 2) vale anche per quelle forzate dalla trama. La Notte dei Termini sceglie con il seme fra i chiodi usati da Elvira, mai pilastri, mai nell'hub o nei rifugi (sagrato e fienile).
- **Lati lunghi di notte**: il massimo di 600 m vale sempre; attraverso il cielo si chiudono solo i triangoli.
- **Stazione libera**: tre lumi distinti, accesi, non coperti dal Collare, con almeno 10° fra le direzioni (`separazioneLumi`), altrimenti «i lumi sono allineati». Il chiodo nuovo si chiama `cs_E1` (etichetta «E1»): l'id evita la confusione con gli elementi mobili E1-E4 di fade_fase1.json.
- **Testi in più** (proposte, sovrascrivibili con `opzioni.testi`): «Notte quieta.», «{nome}: c'eri tu, le Fade ti hanno girato attorno.», «{nome}: protetta, è rimasta.», «{caposaldo} spostato di {metri} m a {direzione}.», «{nome}: scrittura G5 cancellata dal G3.», «Alle {ora}: {testo}».

## Cosa resta da fare

- **Raycast del motore**: la `FunzioneVisibilita` va scritta quando il motore avrà il raycast sui collisori (sopra c'è lo schema); fino ad allora va bene la tabella dei contenuti.
- **Fase 3**: lumi di mira di Ottavio (chi li porta e dove, per sera), particelle di trama dei triangoli T1-T4, tabella di visibilità notturna dei lontani fra loro (oggi i triangoli della tabella si fidano del design per la coppia delle due mire).
- **Fase 5**: le ancore della Penna e i chiodi 141 e 203 nei contenuti; i flag delle missioni usati dalle condizioni delle mosse (`m08_completata`…, `sera_della_svolta`, `notte_dopo_la_svolta`) vanno accesi dalla narrativa e passati in `ContestoMosse.flag`; la tabella del giro dipinta nella Galleria della Carta (il Taccuino può leggerla da `regole.elementi[].oraFade`).
- **Il Sordo** resta a matita (e la Lanterna in bianco) finché T6 non lo dipinge: oggi fuori dall'area dei contenuti tutto parte bianco; quando i contenuti del Sordo arriveranno basterà dargli `stato_iniziale: "matita"` e nessun lato.
- **Salute delle particelle**: il modulo la conserva e la passa alla Pianta (`impostaSalute`), ma chi la decide (diagnosi con la lente, Nodi riparati) è nel gioco.
- **Indice ecologico, servizi di Meridiana per valle rilevata**: il modulo dà `inventarioCompleto`; il servizio (le campane) lo accende la narrativa con `corbella_a_colori`.
