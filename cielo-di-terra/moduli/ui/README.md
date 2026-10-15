# Modulo `ui` — l'interfaccia di «Cielo di Terra»

Interfaccia del gioco in TypeScript + DOM/CSS, senza framework e senza three.js, montata in un livello
trasparente sopra il canvas del motore. Lo stile è quello del gioco: carta avorio con i bordi sfrangiati,
inchiostro di galla, matita, ottone; nessuna icona sulla mappa, niente HUD invadente. Tutti i testi sono
in italiano, mai sotto i 16 px, e ogni componente si usa con tastiera e mouse con il focus sempre visibile.

Componenti:

| # | Classe | Che cos'è |
|---|---|---|
| 1 | `SchermataTitolo` | cartiglio di carta con «Cielo di Terra», «Chi tiene la valle», Continua / Nuova partita (con conferma) / Impostazioni / Crediti; sfondo trasparente |
| 2 | `MenuPausa` | Esc: Riprendi, Taccuino, Pianta, Impostazioni, Esci al titolo (con conferma); luogo, ora, riga del cielo |
| 3 | `PannelloImpostazioni` + `StoreImpostazioni` | cinque schede (Visione e comandi, Comfort, Suono, Testo e lettura, Aiuti); salvate in localStorage dentro try/catch; eventi di cambiamento |
| 4 | `FinestraDialogo` | nome, aspetto del velato, didascalia di scena, testo progressivo saltabile, risposte 1-9 / frecce / mouse, storico (H) |
| 5 | `LettoreCarte` | carta a tutto schermo: lettera (corsiva scolastica), biglietto, libretto di Aurelio a due pagine su copertina di tela, cartellino, dattiloscritto, foglio; «Leggi stampato» (S) |
| 6 | `Taccuino` | quaderno aperto: piste (domande), indizi con fonte, le due mani di Elvira, parole barrate con la parola locale, proverbi, leggende, respiri; riga fissa del prossimo evento del cielo; voci nuove a matita |
| 7 | `PiantaVerbano` | cilindro srotolato su canvas 2D: z 0-3000 in orizzontale, θ in verticale che si chiude su sé stesso; bianco / matita / inchiostro e acquerello; capisaldi, lati, Elvira, valli e Finestre, rosa dei venti, resoconto del mattino |
| 8 | `Indicazioni` | punto a matita, azione contestuale («E — Rileva»), suggerimenti dei comandi, notifiche a matita, sottotitoli e didascalie dei suoni con direzione, fiato e Velo, mirino dello squadro (reticolo, vignettatura, targhetta del caposaldo, livella) |
| 9 | `Crediti`, `SchermataCaricamento` | crediti su un foglio che scorre; caricamento con il cilindro disegnato a matita, la linea d'inchiostro e i proverbi |
| — | `InterfacciaGioco` | regia: radice, pila dei modali, Esc/indietro, scorciatoie, sottomenu, impostazioni visive, `catturaInput` e `tempoFermo` |
| — | `adattatori` | da `content/*.json` (formato della Fase 1) ai tipi dell'interfaccia |

## Comandi

```bash
npm install
npm run dev              # demo su http://127.0.0.1:5181 (pannellino «Demo UI» in alto a sinistra; ?c=<stato>)
npm test                 # vitest + happy-dom
npm run typecheck        # tsc --noEmit (TypeScript 7, strict)
npm run shots            # schermate in shots/<stato>-1280.png e -1920.png (Playwright, Chromium di /opt/pw-browsers)
npm run prova-tastiera   # prova di fumo nel browser: navigazione da tastiera fra i componenti
npm run importa-contenuti   # copia content/*.json in demo/contenuti/ (fotografia per la demo)
```

Stati della demo (`?c=`): `titolo`, `titolo-conferma`, `pausa`, `impostazioni`, `impostazioni-accessibilita`,
`impostazioni-aiuti`, `dialogo`, `dialogo-storico`, `lettera`, `libretto`, `cartellino`, `biglietto`,
`dattiloscritto`, `taccuino`, `taccuino-parole`, `taccuino-leggende`, `pianta`, `pianta-zoom`, `hud`,
`hud-notte`, `squadro`, `crediti`, `caricamento`, `testo-semplice`, `contrasto-grande`.
Dietro all'interfaccia la demo disegna sul canvas i bozzetti `finale-*.jpg` del concept, al posto del gioco.

## Struttura

```
src/
  index.ts              API pubblica (tutto passa da qui)
  interfaccia.ts        InterfacciaGioco (regia)
  radice.ts             creaRadice, applicaImpostazioniVisive, annuncia
  adattatori.ts         content/*.json → tipi dell'interfaccia
  core/                 Emettitore, Componente, h()/s(), focus, testo con markup, filtri SVG, disegni
  impostazioni/store.ts StoreImpostazioni
  componenti/*.ts|css   un file per componente, con il suo CSS
  pianta/               geometria del cilindro, modello a griglia, pittore su canvas
  stile/                base.css (variabili, carta, voci di menu), caratteri.ts (@fontsource)
demo/                   pagina demo (index.html alla radice del modulo), dati d'esempio, sfondi, contenuti/
scripts/                shots.mjs, prova-tastiera.mjs, importa-contenuti.mjs
test/                   nucleo, pianta, componenti, adattatori
shots/                  schermate (1280×720 e 1920×1080)
```

Dipendenze di esecuzione: solo i caratteri `@fontsource/*` (Google Fonts, licenza SIL OFL, ospitati in
locale). Il CSS è importato dai file TypeScript (`import './titolo.css'`): con Vite non serve altro.

## API pubblica

Tutto si importa da `src/index.ts` (dopo lo spostamento: `src/ui/index.ts`).

### Regia

```ts
class InterfacciaGioco extends Emettitore<EventiInterfaccia> {
  constructor(contenitore: HTMLElement, opz?: OpzioniInterfaccia);
  readonly radice: HTMLElement;              // .ui-radice, sopra il canvas
  readonly impostazioni: StoreImpostazioni;
  readonly indicazioni: Indicazioni;
  readonly dialogo: FinestraDialogo;
  readonly titolo: SchermataTitolo;
  readonly pausa: MenuPausa;
  readonly taccuino: Taccuino;
  readonly pianta: PiantaVerbano;
  readonly lettore: LettoreCarte;
  readonly pannelloImpostazioni: PannelloImpostazioni;
  readonly crediti: Crediti;
  readonly caricamento: SchermataCaricamento;
  get inputCatturato(): boolean;   // un modale ha tastiera e mouse
  get tempoFermo(): boolean;       // il mondo deve fermarsi
  apriPausa(): void;               // chiamarla anche quando si perde il pointer lock
  apriTaccuino(dati?: DatiTaccuino): void;
  apriPianta(dati?: DatiPianta): void;
  tornaAlGioco(): void;            // chiude tutti i modali tranne titolo e caricamento
  annuncia(testo: string): void;   // lettori di schermo
  destroy(): void;
}
interface OpzioniInterfaccia {
  impostazioni?: StoreImpostazioni;
  opzioniStore?: OpzioniStore;
  scorciatoie?: boolean;                          // Esc pausa, T taccuino, P Pianta (predefinito true)
  datiTaccuino?: () => DatiTaccuino | undefined;  // usati da scorciatoie e pausa
  datiPianta?: () => DatiPianta | undefined;
  datiPausa?: () => DatiPausa | undefined;
}
interface EventiInterfaccia {
  catturaInput: boolean;  // true: liberare il puntatore e ignorare i comandi di movimento
  tempoFermo: boolean;    // true: fermare l'orologio del mondo (pausa e sottomenu, carte, menu del titolo, caricamento)
}
```

Navigazione già collegata: titolo → impostazioni/crediti → indietro al titolo; pausa → taccuino, Pianta,
impostazioni → indietro alla pausa; Esc chiude sempre il componente in cima (o torna indietro). Il taccuino e la
Pianta aperti durante il gioco non fermano il tempo (GDD §8.2); aperti dalla pausa sì.
I tasti sono ascoltati su `window` in fase di cattura: se un modale li consuma chiama `preventDefault` e
`stopPropagation`; il gioco può anche controllare `ui.inputCatturato`.

### Base comune

```ts
abstract class Componente<E> extends Emettitore<E & EventiBase> {
  readonly el: HTMLElement;
  readonly modale: boolean;
  mount(radice: HTMLElement): this;
  get visible(): boolean;
  hide(): void;
  toggle(vero?: boolean): void;      // riapre con gli ultimi dati
  destroy(): void;
  gestisciTasto(e: KeyboardEvent): boolean;   // usato dalla regia
}
interface EventiBase { mostrato: void; nascosto: void }
class Emettitore<E> {
  on<K>(evento: K, fn: (dato: E[K]) => void): () => void;   // restituisce la funzione che toglie l'ascoltatore
  once<K>(evento: K, fn: (dato: E[K]) => void): () => void;
  off<K>(evento: K, fn: (dato: E[K]) => void): void;
  offAll(evento?: keyof E): void;
}
function creaRadice(contenitore: HTMLElement): HTMLElement;   // per usare i componenti senza la regia
function applicaImpostazioniVisive(radice: HTMLElement, imp: Readonly<Impostazioni>): void;
function caricaCaratteri(limiteMs?: number): Promise<void>;
```

### Impostazioni

```ts
class StoreImpostazioni extends Emettitore<EventiImpostazioni> {
  constructor(opz?: { chiave?: string; archivio?: ArchivioChiaveValore | null; predefinite?: Partial<Impostazioni> });
  get<K extends ChiaveImpostazione>(k: K): Impostazioni[K];
  set<K extends ChiaveImpostazione>(k: K, v: Impostazioni[K]): boolean;  // valida, porta nei limiti, salva, emette
  all(): Readonly<Impostazioni>;
  defaults(): Readonly<Impostazioni>;
  reset(): void;
}
interface EventiImpostazioni {
  cambio: { chiave; valore; precedente; tutte: Readonly<Impostazioni> };
  ripristino: Readonly<Impostazioni>;
}
interface Impostazioni {
  campoVisivo: number;            // 70-110 °, 80
  sensibilitaMouse: number;       // 0,2-3, 1
  invertiAsseY: boolean;
  oscillazioneTesta: boolean;     // spenta di serie
  coriolisCorpo: 'spento' | 'ridotto' | 'pieno';   // 'pieno' = «fisica piena»; ridotto (40 %) di serie
  azioniTenute: 'tieni' | 'premi';
  vignettaturaPlanata: number;    // 0-1
  capovolgimento: 'rollio' | 'dissolvenza';
  velocitaStelle: number;         // 0,25-1
  dondolio: 'visivo' | 'suono';
  volumeGenerale: number; volumeMusica: number; volumeAmbiente: number; volumeVoci: number;   // 0-1
  audioMono: boolean;
  dimensioneTesto: 'normale' | 'grande' | 'molto-grande' | 'enorme';   // ×1; 1,15; 1,3; 1,5
  sottotitoli: boolean; sottotitoliSuoni: boolean; sfondoSottotitoli: number;
  velocitaTesto: 'lenta' | 'normale' | 'veloce' | 'istantanea';
  calligrafia: 'corsiva' | 'semplice';   // «testo semplice» per tutte le carte e il taccuino
  caratteriLeggibili: boolean;           // Atkinson Hyperlegible ovunque
  altoContrasto: boolean;
  riduciMovimenti: boolean;              // predefinito da prefers-reduced-motion
  puntino: boolean; suggerimentiComandi: boolean; indicatoriFiato: boolean;
  rosaDeiVenti: boolean; posizioneSullaPianta: boolean;   // la posizione è spenta di serie (GDD §8.3)
  matitaMarcata: boolean; bollaLarga: boolean; collimazioneAgganciata: boolean;
  apneaLunga: boolean; piuTempo: boolean; arcoLancio: boolean; avvisoSera: boolean;
}
function fattoreCoriolisCorpo(imp): number;   // 0; 0,4; 1
const VELOCITA_CARATTERI: Record<VelocitaTesto, number>;   // caratteri al secondo
class PannelloImpostazioni extends Componente<{ indietro: void; cambio: CambioImpostazione }> {
  constructor(store: StoreImpostazioni);
  show(scheda?: 'visione' | 'comfort' | 'suono' | 'testo' | 'aiuti'): void;
}
```

Le impostazioni che riguardano l'interfaccia (testo, calligrafia, contrasto, movimenti, sottotitoli, punto,
segni del fiato, matita marcata) si applicano da sole; le altre (campo visivo, mouse, Coriolis, volumi, aiuti
di gioco) il motore le legge con `ui.impostazioni.get(…)` e ascolta `ui.impostazioni.on('cambio', …)`.

### Titolo, pausa, crediti, caricamento

```ts
class SchermataTitolo extends Componente<{ continua: void; nuovaPartita: void; impostazioni: void; crediti: void }> {
  show(dati?: { puoiContinuare: boolean; salvataggio?: string; versione?: string }): void;
}
class MenuPausa extends Componente<{ riprendi: void; taccuino: void; pianta: void; impostazioni: void; esciAlTitolo: void }> {
  show(dati?: { luogo?: string; quando?: string; prossimoEvento?: string }): void;
}
class Crediti extends Componente<{ chiudi: void }> {
  show(dati?: DatiCrediti): void;   // { sezioni: { titolo; righe: (string | [ruolo, nome])[] }[]; dedica? }
}
class SchermataCaricamento extends Componente<{ completo: void }> {
  show(dati?: { proverbi?: string[]; testo?: string }): void;
  progresso(valore: number, testo?: string): void;   // 0-1
}
```

### Dialogo

```ts
interface BattutaDialogo {
  chi: string;                 // «Ottavio, detto Ventin» (o «una velata»)
  aspetto?: string;            // «velo da corsa verde legato alla fronte»
  didascalia?: string;         // corsivo, prima della battuta
  testo: string;               // markup: [[tecnica|locale]], *corsivo*
  risposte?: { testo: string; disabilitata?: boolean; nota?: string; giaDetta?: boolean }[];
}
class FinestraDialogo extends Componente<{ scelta: number; avanti: void; testoCompleto: void }> {
  constructor(opz?: { caratteriAlSecondo?: () => number; maxStorico?: number; nomeProtagonista?: string });
  show(battuta: BattutaDialogo): void;   // anche per la battuta successiva
  completa(): void;
  get testoFinito(): boolean;
  get vociStorico(): readonly { chi: string; testo: string; elvira: boolean }[];
  aggiungiStorico(v): void; pulisciStorico(): void; toggleStorico(vero?: boolean): void;
}
```

Tasti: Spazio/Invio/clic completano il testo e, senza risposte, vanno avanti; 1-9 scelgono; ↑↓ spostano il
focus fra le risposte; H apre lo storico. Esc non chiude il dialogo: passa alla regia (pausa).

### Carte

```ts
type TipoCarta = 'lettera' | 'biglietto' | 'libretto' | 'cartellino' | 'dattiloscritto' | 'foglio';
interface Carta { id?: string; tipo: TipoCarta; titolo: string; supporto?: string; pagine: PaginaCarta[] }
interface PaginaCarta {
  testo: string; intestazione?: string; data?: string; firma?: string;
  tabella?: [string, string][];   // numeri in colonna (libretto)
  margine?: string;               // nota a margine dell'autore
  notaElvira?: string;            // nota a matita di Elvira
  schizzo?: string;               // schizzo descritto a parole, in una cornice tratteggiata
}
class LettoreCarte extends Componente<{ pagina: number; chiudi: void }> {
  show(carta: Carta, pagina?: number): void;
  vaiA(pagina: number): void; successiva(): void; precedente(): void;
  toggleStampato(vero?: boolean): void;   // «Leggi stampato», solo nel lettore
  get paginaCorrente(): number;
}
```

Tasti: ←/→ sfogliano; ↑/↓ e PagSu/PagGiù/Spazio scorrono le pagine lunghe (e girano pagina in fondo);
S alterna stampato/a mano; Esc mette via. Il libretto mostra due pagine affiancate da 1000 px di larghezza.

### Taccuino

```ts
interface DatiTaccuino {
  prossimoEvento: string;          // la riga fissa: «Meta fra 34 s», «Brace alle 19:30»
  piste: PistaTaccuino[];          // { id, domanda, mano?, chiusa?, risposta?, nuova?, indizi, note? }
  parole: ParolaTaccuino[];        // { tecnica, locale, nota?, nuova? }
  note?: NotaTaccuino[];           // appunti liberi { id, testo, mano?, nuova? }
  proverbi?: ProverbioTaccuino[];  // { id?, dialetto?, italiano, fonte?, nota?, nuovo? }
  leggende?: LeggendaTaccuino[];   // { id, testo, fonte, testoCompleto?, nuova? } — assente: scheda nascosta
  respiri?: RespiroTaccuino[];     // { nome, dove, nuovo? } — assente: scheda nascosta
  pistaAttiva?: string;
}
// IndizioTaccuino: { id, testo, fonte, mano?: 'tecnica' | 'madre', note?, nuovo? }
class Taccuino extends Componente<{ chiudi: void; pista: string; visto: VociViste; leggi: string }> {
  show(dati?: DatiTaccuino, scheda?: 'piste' | 'parole' | 'leggende' | 'respiri'): void;
  aggiorna(dati: DatiTaccuino): void;
  prossimoEvento(testo: string): void;   // aggiornabile ogni secondo
}
// visto: { piste, indizi, parole, leggende } — le voci nuove effettivamente mostrate (per togliere il segno)
// leggi: id del testo completo di una leggenda (es. «testi.leggende.partenza_1»)
```

### Pianta

```ts
interface DatiPianta {
  griglia?: GrigliaPianta;              // formato del motore (CellGrid): id = iz·nTheta + iθ
  particelle?: ParticellaPianta[];      // particelle con nome e rettangolo/contorno (si sommano alla griglia)
  capisaldi: CaposaldoPianta[];         // { id, numero, tipo?: 'pilastro'|'chiodo', z, theta, rilevato, visto?, nome? }
  lati?: { da: string; a: string }[];   // lati rilevati, linee sottili a china
  resoconto?: { righe: string[]; prossimaFinestra?: string };   // righe vuote: «Notte quieta.»
  elvira?: { z: number; theta: number; direzione: number };    // gradi: 0 = verso Lag (+z), 90 = a Mane (+θ)
  luoghi?: { id?; nome; z; theta; visibile? }[];   // il nome compare quando la sua cella è rilevata
  fasce?: FasciaPianta[];               // valli e Finestre (predefinite: FASCE_VERBANO)
  totaleParticelle?: number;
}
interface GrigliaPianta {
  nZ: number; nTheta: number;
  stati: ArrayLike<number>;      // 0 bianco, 1 matita, 2 rilevato
  salute?: ArrayLike<number>;    // 1 verde, 2 bruno, 3 grigio
  terreno?: ArrayLike<number>;   // 0 terra, 1 acqua, 2 roccia, 3 abitato
  cambiate?: ArrayLike<number>;  // 1 = cambiata stanotte (in rosso)
  seppia?: ArrayLike<number>;    // 1 = rilievo a inchiostro seppia (G4, 2291)
}
interface ParticellaPianta {
  id: string; nome?: string; z0: number; z1: number; theta0: number; theta1: number;
  contorno?: [number, number][]; stato: 'bianco' | 'matita' | 'rilevato' | 'colore';
  salute?: 'verde' | 'bruno' | 'grigio'; terreno?: 'terra' | 'acqua' | 'roccia' | 'abitato';
  cambiata?: boolean; inchiostro?: 'china' | 'seppia';
}
class PiantaVerbano extends Componente<{ chiudi: void; punto: { z; theta; particella: ParticellaPianta | null } }> {
  constructor(opz?: { rosaDeiVenti?: () => boolean; posizione?: () => boolean; matitaMarcata?: () => boolean });
  show(dati?: DatiPianta): void;
  aggiorna(dati: DatiPianta): void;
  centraSu(z: number, theta: number): void;
  impostaZoom(fattore: number): void;   // 1 = tutto il cilindro in larghezza
  ridisegna(): void;
}
```

Tasti e mouse: trascinare o frecce per scorrere (in verticale il foglio non finisce mai), rotella o +/− per
ingrandire, 0 alterna «tutto il giro» e «tutto il cilindro», C centra su Elvira, Esc/P chiude. Passando sopra
la Pianta la didascalia dice valle, nome catastale (es. «particella 1-559»), coordinate e stato.
Costanti e aiuti esportati: `LUNGHEZZA_Z`, `RAGGIO`, `CIRCONFERENZA`, `METRI_PER_GRADO`, `FASCE_VERBANO`,
`normalizzaGradi`, `ModelloPianta`, `nomeCatastale(iz, it)`.

### Indicazioni a schermo

```ts
class Indicazioni extends Componente<{ notificaFinita: string }> {
  show(): void;
  mostraPuntino(vero: boolean): void;
  azione(a: { tasto: string; testo: string; progresso?: number } | null): void;
  suggerimento(testo: string | null): void;   // «Tieni premuto {E} vicino al chiodo…»
  notifica(testo: string, opz?: { durata?: number; tono?: 'matita' | 'rosso' }): void;
  sottotitolo(s: { testo: string; chi?: string; tipo?: 'voce' | 'suono';
                   direzione?: 'sinistra' | 'destra' | 'davanti' | 'dietro' | 'sopra' | 'sotto'; durata?: number }): () => void;
  fiato(valore: number | null): void;   // 0-1; sotto 0,4 la vista si restringe
  velo(valore: number | null): void;
  squadro(stato: { caposaldo?: string; dettaglio?: string; livella?: number; ingrandimento?: number; collimato?: boolean } | null): void;
}
```

### Adattatori dai contenuti

```ts
cartaDaTesto(id: string, voce: VoceTestiJson, sezione?: string, tipo?: TipoCarta): Carta
librettoDaTesti(libretto: Record<string, VoceTestiJson>, opz?: { ordine?: string[]; titolo?: string }): Carta
cartaDaLeggenda(id: string, voce: VoceTestiJson): Carta              // un quadro del telo per pagina
taccuinoDaContenuti(json: TaccuinoJson, stato: StatoTaccuino): DatiTaccuino
grigliaDaParticelle(particelle: ParticellaFadeJson[], opz?: { nZ?; nTheta?; stati?; cambiate? }): GrigliaPianta
capisaldiDaContenuti(json, stato?: { rilevati?: Iterable<string>; visti?: Iterable<string> }): CaposaldoPianta[]
latiDaContenuti(lati, chiusi: Iterable<string>): LatoPianta[]
luoghiDaContenuti(luoghi, tipi?: string[]): LuogoPianta[]
battutaDaNodo(dialogo: DialogoJson, nodoId: string, personaggi?: PersonaggioJson[], valuta?: (cond: string) => boolean)
  : { battuta: BattutaDialogo; risposte: RispostaJson[] } | null
aspettoDaPersonaggio(p?: PersonaggioJson): string | undefined
separaNote(testo), staccaFirma(testo), terrenoDaTipo(tipo), tipoCartaPer(sezione, id)
```

## Come si integra nel gioco

```ts
import { InterfacciaGioco, grigliaDaParticelle, battutaDaNodo } from './ui';

const ui = new InterfacciaGioco(document.getElementById('app')!, {
  datiTaccuino: () => storia.taccuino(),            // DatiTaccuino dal motore della storia
  datiPianta: () => ({ griglia: cellGrid, capisaldi, lati, elvira: posizioneElvira() }),
  datiPausa: () => ({ luogo: luogoCorrente(), quando: orologio.testo(), prossimoEvento: cielo.prossimo() }),
});

// Puntatore e tempo.
ui.on('catturaInput', (preso) => (preso ? document.exitPointerLock() : canvas.requestPointerLock()));
ui.on('tempoFermo', (fermo) => orologio.pausa(fermo));
document.addEventListener('pointerlockchange', () => {
  // Esc nel pointer lock lo consuma il browser: la pausa si apre qui.
  if (!document.pointerLockElement && !ui.inputCatturato) ui.apriPausa();
});

// Titolo.
ui.titolo.show({ puoiContinuare: salvataggi.esiste(), salvataggio: salvataggi.descrizione(), versione });
ui.titolo.on('continua', () => { ui.titolo.hide(); carica(); });
ui.pausa.on('esciAlTitolo', () => { salva(); ui.titolo.show(); });

// Impostazioni del motore.
const imp = ui.impostazioni;
camera.fov = imp.get('campoVisivo');
imp.on('cambio', ({ chiave, valore }) => { if (chiave === 'campoVisivo') camera.fov = valore as number; });

// Ogni fotogramma, solo quando cambia qualcosa.
ui.indicazioni.show();
ui.indicazioni.azione(bersaglio ? { tasto: 'E', testo: bersaglio.verbo } : null);
ui.indicazioni.fiato(fiatoPieno ? null : fiato);
ui.taccuino.prossimoEvento(cielo.prossimo());       // anche a taccuino aperto

// Dialoghi da content/dialoghi.json.
const passo = battutaDaNodo(dialoghi[id], nodo, personaggi, (c) => storia.valuta(c));
ui.dialogo.show(passo!.battuta);
ui.dialogo.on('scelta', (i) => storia.scegli(passo!.risposte[i]!));
```

La griglia del motore (`CellGrid.state`, `Uint8Array`, 0/1/2) si passa così com'è in `griglia.stati`;
`salute`, `terreno`, `cambiate` e `seppia` sono facoltativi (`grigliaDaParticelle` ricava terreno e seppia da
`content/fade_fase1.json`). Il rendering è a richiesta (solo quando cambia la vista o i dati), non a ogni fotogramma.

Spostamento in `src/ui/`: copiare `src/` (il resto è demo e strumenti), aggiungere al `package.json` del
gioco le dipendenze `@fontsource/*` elencate qui, e importare `./ui` dal codice del gioco. Nessun percorso
assoluto, nessun file esterno alla cartella.

## Stile

- Carta: avorio `#f0e7d1` con grana fine, fibre e macchie (SVG `feTurbulence` in data URI) e bordo sfrangiato
  (filtro SVG `feDisplacementMap` sullo pseudo-elemento, così il testo resta nitido).
- Inchiostro di galla `#241e19`, matita `#57534c` (contrasto ≥ 6:1 sulla carta), ottone per pomelli, levette,
  anello del cannocchiale e fermaglio del taccuino, vermiglio (matita rossa) per i segni del nuovo e del resoconto.
- Caratteri (Google Fonts, in locale con @fontsource): EB Garamond (testo), IM Fell English e SC (titoli,
  cartigli), Caveat (la mano «madre» di Elvira), Patrick Hand SC (la mano «tecnica», stampatello), Playwrite IT
  Moderna (la corsiva scolastica di Marta), Architects Daughter (Aurelio), Special Elite (dattiloscritti),
  Atkinson Hyperlegible (opzione di leggibilità).
- Focus da tastiera: un ovale tracciato a matita intorno alle voci di menu, un contorno d'inchiostro altrove.

## Accessibilità

Testi ≥ 16 px (anche i tasti disegnati e le etichette della Pianta); dimensione del testo fino a ×1,5; testo
semplice al posto delle calligrafie (anche per la sola carta, con S); caratteri ad alta leggibilità; alto
contrasto; riduzione dei movimenti (predefinita da `prefers-reduced-motion`); velocità del testo dei dialoghi;
sottotitoli e didascalie dei suoni con direzione e fondo regolabile; focus intrappolato nei modali e
restituito alla chiusura; ruoli ARIA (dialog, tablist, switch, radiogroup, progressbar, log) e regioni
`aria-live` per notifiche, sottotitoli, mirino e didascalia della Pianta; i tre stati della Pianta non
dipendono dal solo colore (vuoto, tratteggio, campitura con contorno a china); matita marcata.

## Differenze rispetto alle istruzioni, al GDD e ai contenuti

- **Posizione di Elvira sulla Pianta**: disegnata con posizione e direzione come chiesto, ma l'impostazione
  «Pianta: dove sono» è **spenta di serie** come vuole il GDD §8.3 (la demo la accende).
- **Fiato e Velo**: il GDD §8.1 dice «nessuna barra». C'è sempre il restringimento della vista; i due archi
  sottili intorno al punto (chiesti dalle istruzioni) compaiono solo quando servono e si spengono con
  «Segni del fiato e del Velo». Se il design li vuole spenti di serie basta `predefinite: { indicatoriFiato: false }`.
- **«Fisica piena»**: è il terzo valore di «Coriolis sul corpo» (spento / ridotto 40 % / pieno), come nel GDD §10.
- **Campo visivo** 70-110° (GDD §10). Aggiunte dal GDD §10: vignettatura in planata, capovolgimento, velocità
  delle stelle, Dondolio, audio mono, azioni tenute/premute, aiuti di rilievo, apnea, più tempo, arco del lancio,
  avviso della sera, punto e suggerimenti disattivabili. Il motore le legge dallo store.
- **Rosa dei venti**: Mane in alto, Sera in basso, a Mont/Tappo Sud a sinistra, a Lag/Tappo Nord a destra,
  «in su» come un punto che esce dal foglio. θ cresce verso l'alto (come la mappa del GDD §2.4).
- **Nomi delle Finestre**: Finestra dei Ponti, Finestra Cieca (210-240), Finestra delle Vedove (330-360), dal
  GDD §2.4; `layout.json` del motore ha ancora «Finestra 2/3» (segnalato nel suo `_nota`).
- **Contenuti** (letti dal vero `content/`): gli stati delle particelle si chiamano `colore` (accettato come
  sinonimo di `rilevato`); in `taccuino.json` le domande citano anche proverbi fra gli indizi e hanno
  `risposta` = id di un indizio; le note si attaccano con `sotto` a una domanda o a un indizio; i proverbi
  hanno `dialetto` che può essere `null` e `nota_elvira`; le leggende del taccuino rimandano a
  `testo_completo` (evento `leggi`); in `testi.json` le note a margine sono dentro il testo come
  «(a margine) …» o «(Elvira, a matita) …» e il libretto ha `schizzo` e `nota_2322`. Gli adattatori gestiscono
  tutto questo. In Fase 1 non ci sono lettere di «S.»: il dattiloscritto della demo è un esempio scritto qui.

## Test

- `npm test`: 41 test (vitest 5 + happy-dom) su emettitore, testo con markup, store delle impostazioni
  (limiti, tipi, JSON rovinato, localStorage che lancia, reset), geometria del cilindro (giro di 360°, copie,
  inverso schermo/mondo, limiti della vista), modello della Pianta (rasterizzazione oltre 0°, contorni chiusi
  anche attraverso 360°, nomi catastali del GDD), regia (Esc, sottomenu, scorciatoie, `catturaInput`,
  `tempoFermo`), titolo, impostazioni, dialogo, lettore, taccuino, indicazioni e adattatori.
- `npm run prova-tastiera`: 16 controlli nel Chromium vero (frecce, Invio, Tab intrappolato, Esc, T, P, 1-9).
- `npm run typecheck`: pulito.
- `npm run shots`: 25 stati × 2 risoluzioni (50 schermate) in `shots/`, senza errori nella pagina.

## Cosa resta da fare

- Rimappare i comandi (le scorciatoie sono T, P, Esc, H, S, 1-9, frecce): serve il modulo dei comandi.
- Il menu «aspetta fino a» (GDD §3.7) e i tre slot di salvataggio manuali (GDD §8.5).
- Il telo dell'Ombrista come scena propria (oggi le leggende si leggono come carte, un quadro per pagina).
- Gli schizzi delle carte sono descritti a parole in una cornice: quando ci saranno i disegni, `schizzo` può
  diventare un'immagine.
- Animazione «l'inchiostro si allarga dal caposaldo» sulla Pianta quando una particella viene rilevata
  (oggi la Pianta mostra lo stato, non la transizione).
- L'erbario (pagine dei rami, Germogli) non è in questo modulo.
- Prove con lettori di schermo veri e con utenti sensibili al movimento.
