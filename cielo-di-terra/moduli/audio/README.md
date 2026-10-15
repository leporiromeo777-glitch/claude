# Modulo `audio` di «Cielo di Terra»

Tutto il suono del gioco, **interamente procedurale** con la Web Audio API: sintesi,
rumore filtrato e piccoli campioni generati in codice (rumori ciclici, corde del salterio
con Karplus-Strong, campane a parziali inarmoniche, coro di grilli, risposta del riverbero).
Nessun file audio, nessuna dipendenza a runtime (né three.js né altro): i vettori sono
semplici `{x, y, z}`, quindi un `THREE.Vector3` va bene così com'è.

Il gusto: niente suoni stridenti. Ogni suono è misurato offline in Chromium (picco, RMS,
energia sopra i 6 kHz) e tarato perché resti morbido, caldo e un po' artigianale.

## Che cosa fa

**Motore (`AudioEngine`)**
- avvio dentro un gesto dell'utente (`avvia()` o `AudioEngine.avviaAlPrimoGesto`);
- bus separati con volumi impostabili: `generale`, `ambiente`, `effetti`, `voci`, `musica`
  (curva percettiva: cursore 0,5 ≈ −12 dB); muto; **in pausa tutto tace** e il contesto viene sospeso;
- riverbero condiviso a convoluzione (risposta generata in codice) con una mandata per bus;
- limitatore dolce sull'uscita (disattivabile; le misure sono fatte senza, il margine c'è già);
- ascoltatore 3D con posizione, sguardo e «su» che nel cilindro **punta verso l'asse**;
  sorgenti posizionali HRTF (pan semplice per i suoni gravi e per gli eventi d'ambiente lontani).

**Ambienti** (strati continui, guidati da `aggiorna` a ogni fotogramma)
- **vento**: due canali indipendenti (corpo grave + sibilo morbido) con raffiche; cresce
  con l'altezza dal suolo e con la velocità; sulle Finestre cala, tranne quello del volo;
- **la Linea**: ronzio basso e caldo (La1 di giorno, Sol1 alla brace), più chiaro di giorno,
  scuro e con un lento respiro di notte; più forte avvicinandosi all'asse; all'alba
  **si accende dal Tappo Sud come una miccia** (soffio, scintille e ronzio che scorrono lungo l'asse);
- **uccelli** di giorno nelle valli (merlo, cincia, fringuello e, lontano, il cuculo; coro
  all'alba) e **grilli** di notte (coro lontano in loop + grilli vicini posizionati);
- **le Finestre**: silenzio quasi totale, fruscio del vetro, cigolio del ferro dei costoloni
  e il «tonc» lontano di una trave che si dilata;
- **il lago**: acqua che lambisce la riva, gorgoglii e gocce;
- **il Sordo**: rombo lontano e continuo «come di treno» (rombo, tono delle ruote,
  «ta-dum» delle giunzioni) che cresce avvicinandosi al Tappo Nord;
- **le Fade** al lavoro nei dintorni di notte (se il gioco passa `fadeVicine`);
- **fruscio del Velo** in planata (stoffa che batte più in fretta con la velocità).
- Uno strato muto da più di 8 s si stacca dal grafo e smette di consumare CPU.

**Effetti** (eventi singoli con `evento`): passi su erba, pietra, legno, ghiaia; salto e
atterraggio; Velo che si apre e si chiude; lo squadro piantato sul caposaldo (tintinnio
d'ottone) e la bolla che si livella; l'inchiostro che si spande (tocco del pennello,
pennellata, grana della carta e un accordo caldo che entra «a velature» in tre secondi);
pagine del taccuino; le Fade (carillon, ronzio, pietra posata); le api di rame; le
campane di San Vigilio (ore, rintocco, a festa); l'accensione della Linea; i clic dell'interfaccia.

**Musica**: quattro temi generativi brevi e discreti (salterio, fisarmonica «musette», flauto,
carillon), ogni volta un po' diversi: `alba` (Re, salterio che si accende e flauto),
`primo-volo` (Sol lidio), `primo-rilievo` (valzerino lento di fisarmonica), `notte-fade`
(La dorico, carillon rado e bordone). Passano per un passa-alto a 140 Hz e restano sotto
l'ambiente. Una regia evita sovrapposizioni e ripetizioni ravvicinate; il tema dell'alba
parte da solo alle 5:48 di gioco.

## Struttura

```
src/
  index.ts            API pubblica (riesporta tutto ciò che serve)
  motore.ts           AudioEngine: grafo, bus, ascoltatore, eventi, musica
  tipi.ts             tipi pubblici (StatoAudio, EventoAudio, …)
  costanti.ts         costanti del mondo e di regia (Linea, ore, San Vigilio, lago, Sordo)
  mappature.ts        funzioni pure: stato del gioco → parametri della sintesi
  mixer.ts            logica dei volumi (pura)
  pianificatore.ts    eventi casuali (Poisson a tasso variabile, puro)
  util.ts             Rng con seme, matematica, vettori
  sintesi/campioni.ts campioni generati in codice (puri)
  sintesi/kit.ts      fabbrica di nodi, cache dei buffer, inviluppi, grani, modi
  ambienti/*.ts       strati: aria (vento, volo, Linea), vita (fauna, Fade), luoghi (lago, Sordo, Finestre)
  effetti/*.ts        passi, velo, rilievo, notte, campane, linea, interfaccia
  musica/*.ts         temi generativi (puri), strumenti, lettore, regia
demo/                 pagina demo (Vite)
test/                 Vitest: logica pura + rendering offline in Chromium
strumenti/            banco offline da riga di comando, schermate della demo
```

## API pubblica

Tutto si importa da `src/index.ts` (dopo lo spostamento: `src/audio/index.ts`).

### `AudioEngine`

```ts
class AudioEngine {
  constructor(opzioni?: OpzioniMotore);

  readonly mixer: Mixer;
  get stato(): StatoMotore;                       // 'spento' | 'attivo' | 'in-pausa' | 'distrutto'
  get contesto(): BaseAudioContext | null;
  get parametri(): ParametriAmbiente | null;      // ultimi parametri derivati (debug, HUD)
  get analizzatoreUscita(): AnalyserNode | null;  // per misuratori
  get temaInCorso(): TemaMusicale | null;
  get muto(): boolean;

  avvia(): Promise<void>;                         // dentro un gesto dell'utente
  static avviaAlPrimoGesto(motore: AudioEngine, bersaglio?: EventTarget): () => void;
  pausa(): void;                                  // tutto tace, contesto sospeso
  riprendi(): Promise<void>;
  distruggi(): Promise<void>;

  impostaVolume(bus: NomeBus, valore: number): void;  // 0-1
  volume(bus: NomeBus): number;
  impostaMuto(muto: boolean): void;
  nodoBus(bus: NomeBus): AudioNode | null;            // per collegare suoni esterni (voci)

  aggiorna(stato: StatoAudio, dt?: number): void;     // ogni fotogramma
  evento(e: EventoAudio): number;                     // durata stimata (s), 0 se rifiutato
  suonaTema(tema: TemaMusicale, opzioni?: { forza?: boolean }): boolean;
  fermaMusica(dissolvenza?: number): void;
  impostaCampanile(posizione: Vec3 | null, orarie?: boolean): void;
  creaSorgente(posizione: Vec3, opzioni?: OpzioniSorgente): SorgentePosizionale | null;
  precarica(): void;                                  // genera prima campane e corde
}

interface OpzioniMotore {
  contesto?: BaseAudioContext;        // es. OfflineAudioContext nei test, o il contesto del gioco
  seme?: number;                      // Rng (predefinito: Date.now())
  limitatore?: boolean;               // predefinito true
  ambienti?: boolean;                 // predefinito true
  strati?: readonly NomeStrato[];     // predefinito: tutti
  spazializzazione?: 'hrtf' | 'semplice'; // predefinito 'hrtf'
  musicaAlba?: boolean;               // tema dell'alba automatico, predefinito true
  campanile?: { posizione: Vec3; orarie: boolean } | null; // predefinito: San Vigilio, orarie false
  battito?: boolean;                  // timer interno 100 ms (predefinito: sì con AudioContext reale)
}
type NomeStrato = 'vento' | 'volo' | 'linea' | 'fauna' | 'lago' | 'sordo' | 'finestre' | 'fade';
```

### Stato per fotogramma ed eventi

```ts
interface Vec3 { x: number; y: number; z: number }
type NomeBus = 'generale' | 'ambiente' | 'effetti' | 'voci' | 'musica';
type IdZona = 'valle-1' | 'finestra-ponti' | 'valle-2' | 'finestra-2' | 'valle-3' | 'finestra-3';
type Superficie = 'erba' | 'pietra' | 'legno' | 'ghiaia';
type TemaMusicale = 'alba' | 'primo-volo' | 'primo-rilievo' | 'notte-fade';
type VarietaFade = 'carillon' | 'ronzio' | 'pietra';
type VarietaInterfaccia = 'clic' | 'sopra' | 'conferma' | 'annulla' | 'apri' | 'chiudi';

interface StatoAudio {
  posizione: Vec3;       // testa del giocatore, mondo del motore (riferimento rotante)
  avanti?: Vec3;         // sguardo (predefinito +Z)
  su?: Vec3;             // predefinito: verso l'asse
  velocita: number;      // m/s
  ora: number;           // 0-24
  altezza?: number;      // sopra il TERRENO (PlayerController.heightAboveGround); predefinita R − r
  theta?: number;        // predefinito atan2(−x, −y)
  zona?: IdZona;         // predefinita da θ (con sfumatura di 4° ai bordi delle Finestre)
  inVolo?: boolean;      // Velo aperto
  distanzaLago?: number; // m dalla riva; predefinita: stima dal layout (θ 141-191, z 720-2480)
  distanzaSordo?: number;// m dal piede del Sordo; predefinita 2640 − z
  fadeVicine?: number;   // 0-1, Fade nei dintorni (suonano solo di notte)
}

type EventoAudio =
  | { tipo: 'passo'; superficie: Superficie; forza?: number; posizione?: Vec3 }
  | { tipo: 'salto'; superficie?: Superficie }
  | { tipo: 'atterraggio'; superficie?: Superficie; velocita?: number }
  | { tipo: 'velo-apri' } | { tipo: 'velo-chiudi' }
  | { tipo: 'squadro-pianta'; posizione?: Vec3 }
  | { tipo: 'bolla-livellata' }
  | { tipo: 'inchiostro'; ampiezza?: number; posizione?: Vec3 }
  | { tipo: 'pagina'; verso?: 'avanti' | 'indietro' }
  | { tipo: 'fade'; varieta: VarietaFade; posizione?: Vec3 }
  | { tipo: 'api'; durata?: number; posizione?: Vec3 }
  | { tipo: 'campane'; modo?: 'ore' | 'rintocco' | 'festa'; ore?: number; posizione?: Vec3 }
  | { tipo: 'accensione-linea' }
  | { tipo: 'interfaccia'; varieta: VarietaInterfaccia }
  | { tipo: 'tema'; tema: TemaMusicale };

interface OpzioniSorgente {
  bus?: 'ambiente' | 'effetti' | 'voci' | 'musica'; // predefinito 'effetti'
  distanzaRiferimento?: number; distanzaMassima?: number; attenuazione?: number;
}
interface SorgentePosizionale { readonly ingresso: AudioNode; posiziona(p: Vec3): void; rilascia(): void }
```

### Mixer e funzioni pure

```ts
class Mixer {
  imposta(bus: NomeBus, valore: number): number; volume(bus: NomeBus): number;
  muto: boolean; inPausa: boolean;
  guadagno(bus: NomeBus): number;                          // lineare; il generale include muto/pausa
  guadagnoEffettivo(bus: Exclude<NomeBus, 'generale'>): number;
  esporta(): ImpostazioniMixer; importa(dati: Partial<ImpostazioniMixer> | null | undefined): void;
}
const VOLUMI_PREDEFINITI: Readonly<Record<NomeBus, number>>; // 0.9 / 0.85 / 0.85 / 1 / 0.6

calcolaParametriAmbiente(stato: StatoAudio): ParametriAmbiente;
coordinateCilindriche(p: Vec3): { theta; raggio; altezza; z };
posizioneCilindrica(thetaGradi: number, z: number, altezza: number): Vec3;
suVersoAsse(p: Vec3): Vec3;   vettoreSicuro(p: Vec3): Vec3;
zonaDaTheta(theta: number): IdZona;   descrizioneZona(id: IdZona): DescrizioneZona;
pesoFinestra(theta: number, sfumatura?: number): number;
volumeAGuadagno(v: number): number;
orientamentoAscoltatore(avanti: Vec3, su: Vec3): { avanti: Vec3; su: Vec3 };
parametriVento(altezza: number, velocita: number): ParametriVento;
parametriVolo(velocita: number, inVolo: boolean): ParametriVolo;
parametriLinea(ora: number, altezza?: number): ParametriLinea;   luceLinea(ora: number): number;
intensitaUccelli(ora: number): number;   intensitaGrilli(ora: number): number;
parametriFauna(ora: number, pesoValle: number, altezza: number): { uccelli: number; grilli: number };
pesoLago(d: number): number;   pesoSordo(d: number): number;   attenuazioneValle(pesoFin: number): number;
distanzaLagoStimata(theta: number, z: number, altezza: number): number;   distanzaSordoStimata(z: number): number;
normalizzaOra(ora: number): number;   haAttraversato(prima: number, dopo: number, soglia: number): boolean;

generaTema(tema: TemaMusicale, seme: number): Partitura;   TEMI: readonly TemaMusicale[];
class RegiaMusica { valuta(tema, ora, forza?): DecisioneMusica; avvia(tema, ora, durata): void; ferma(ora): void; inCorso(ora): TemaMusicale | null }
costanti   // LUNGHEZZA_CILINDRO, RAGGIO_INTERNO, ZONE, CAMPANILE_SAN_VIGILIO, LAGO_STIMATO, PIEDE_SORDO, ORA_*, …
```

## Integrazione nel gioco

Convenzioni: le stesse di `src/world/cylinder.ts` del motore (asse = Z, `x = −r·sin θ`,
`y = −r·cos θ`, «su» verso l'asse, riferimento rotante). La θ di default è `atan2(−x, −y)`.

```ts
import { AudioEngine, type StatoAudio } from './audio';

const audio = new AudioEngine();
AudioEngine.avviaAlPrimoGesto(audio, renderer.domElement); // oppure audio.avvia() nel clic «Gioca»
audio.mixer.importa(JSON.parse(localStorage.getItem('audio') ?? 'null'));

// eventi del PlayerController → suoni
player.onEvent = (e) => {
  if (e.type === 'jump') audio.evento({ tipo: 'salto', superficie });
  else if (e.type === 'land') audio.evento({ tipo: 'atterraggio', superficie, velocita: e.speed });
  else if (e.type === 'velo') audio.evento({ tipo: e.open ? 'velo-apri' : 'velo-chiudi' });
};

// a ogni fotogramma
const stato: StatoAudio = {
  posizione: camera.position,                         // Vector3 va bene
  avanti: camera.getWorldDirection(tmp),
  su: frame.up,                                        // facoltativo
  velocita: player.velocity.length(),
  altezza: player.heightAboveGround,                   // importante sui rilievi
  inVolo: player.veloOpen,
  ora: orologio.ora,                                   // 0-24, un giorno = 40 minuti
  fadeVicine: fade.densitaVicino(player.position),     // facoltativo
};
audio.aggiorna(stato, dt);

// passi: il controller sa quando il piede tocca e su che cosa
audio.evento({ tipo: 'passo', superficie: superficieSotto(player), forza: corsa ? 1 : 0.6 });
// rilievo
audio.evento({ tipo: 'squadro-pianta', posizione: caposaldo.posizione });
audio.evento({ tipo: 'bolla-livellata' });
audio.evento({ tipo: 'inchiostro', ampiezza: 0.8, posizione: particella.centro });
// musica nei momenti precisi (l'alba parte da sola)
audio.suonaTema('primo-volo');
// menu di pausa
audio.pausa(); /* … */ void audio.riprendi();
// voci dei personaggi: un nodo vostro → creaSorgente(pos, { bus: 'voci' }).ingresso
```

Le campane: per default sono posizionate sulla cella campanaria di San Vigilio
(`costanti.CAMPANILE_SAN_VIGILIO`, z 1062, θ 37,2°, h 62,5) e **non** battono le ore da sole;
quando la valle è rilevata: `audio.impostaCampanile(pos, true)` (battono dalle 6 alle 22).

## Prove

```
npm install
npm test                 # 74 test Vitest della logica non sonora (mixer, mappature, temi, regia, campioni…)
npm run test:offline     # 8 test: rendering OfflineAudioContext in Chromium headless (Playwright 1.56.1)
npm run typecheck
npm run demo             # pagina demo su http://localhost:5178
node strumenti/banco.mjs --wav [id…]   # misure e file WAV in risultati/
npm run build:demo && npm run shots    # schermate della demo in risultati/schermate/
```

Il test offline rende **45 prove** (ogni effetto, ogni ambiente, ogni tema, un mix con
tutto insieme) attraverso il vero `AudioEngine` con il limitatore **spento**, e controlla:
segnale non nullo (picco > −60 dBFS), nessun campione non finito, nessun clipping
(picco < −0,45 dBFS), continua trascurabile, energia sopra i 6 kHz < 15%. Verifica anche il
mixer nel grafo vero (muto = silenzio, ogni cursore spegne solo il suo bus, generale a 0,5 =
−12 dB, limitatore sotto 0 dBFS con tutto al massimo) e il ciclo di vita con un
`AudioContext` vero (avvio, accensione della Linea attraversando le 5:30, tema accettato e
rifiutato dalla regia, sorgente posizionale, pausa → `suspended`, ripresa → `running`,
distruzione → `closed`).

Livelli misurati (volumi predefiniti, limitatore spento): picco massimo del mix più carico
−9 dBFS; passi −18…−22 dBFS di picco; campane −10; ambienti di valle ≈ −36/−40 dBFS RMS,
Finestra ≈ −46 (quasi silenzio), volo in quota ≈ −25; temi ≈ −38/−43 RMS, sotto l'ambiente.
L'unico suono con un po' di acuti è la pagina del taccuino (≈ 10% sopra i 6 kHz, è carta).

## Adattamenti e differenze segnalate

- **θ**: allineata al motore (`atan2(−x, −y)`), non la convenzione trigonometrica usuale.
- **`altezza`**: quella dei contenuti (`luoghi.json`) è h dal fondo dello scafo; per il suono
  serve l'altezza sopra il terreno. Se il gioco non la passa, il modulo usa `R − r`, che sui
  rilievi (Corbella è a h ≈ 35-40) sovrastima il vento e allontana i grilli: passare
  `heightAboveGround`.
- Lago, piede del Sordo (z 2640) e campanile presi da `src/world/layout.json` e
  `content/luoghi.json`; restano costanti copiate (il modulo non legge file fuori dalla sua
  cartella): se il layout cambia, aggiornare `costanti.ts`.

## Cosa resta da fare

- Collegare `superficie` dei passi al materiale reale sotto i piedi (il motore oggi non lo espone).
- `distanzaLago` vera dal motore (riva, isole) e un'eventuale `distanzaFinestra` per i bordi in quota.
- Suoni non richiesti in questa fase ma previsti dal concept: voce di Meridiana filtrata
  «dal metallo delle campane» (il bus `voci` è pronto), Ruota che cambia tono prima del picco
  nella Tenuta, subacqueo (filtro passa-basso sull'ambiente sotto il lago), correnti calde della Linea.
- Ascolto critico in cuffia su hardware vero: le tarature sono state fatte con misure
  (livelli, spettri), non a orecchio.
- Prestazioni: in rendering offline tutti gli strati insieme costano circa il 10-15% di un
  core; su dispositivi deboli usare `spazializzazione: 'semplice'` o ridurre `strati`.
