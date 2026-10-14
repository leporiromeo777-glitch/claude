# Stato del pacchetto: traduzione-en

**Stato:** done (costruito, poi verificato e corretto dal verificatore).

## Riepilogo

Traduzione inglese di tutta la storia (livello L2): quattro file JSON più il test.

- `src/content/text/en/atto1.json`: Prologo, g01-g08, Archivio A1-A2, Taccuino dell'Atto I, lettere di L. 1-7.
- `src/content/text/en/atto2.json`: g09-g16, Archivio A3-A4, Taccuino dell'Atto II, lettere di L. 8-11, lettera di Clotilde, le tre lettere del fascio.
- `src/content/text/en/atto3.json`: g17-g23 con i quattro biglietti della scelta, Archivio A5-A6, Taccuino dell'Atto III, biglietti di Livia, nastro della nonna.
- `src/content/text/en/finali.json`: i quattro finali (suggerimenti, margini, epiloghi con le varianti dei destini) e le mancanze del finale vero.
- `tests/unit/content/en.test.ts`: 24 test.

| Namespace | Testi | Parole it | Parole en | Caratteri en / it |
|---|---|---|---|---|
| atto1 | 278 | 3.607 | 3.695 | 0,99 |
| atto2 | 298 | 5.338 | 5.511 | 1,00 |
| atto3 | 232 | 3.555 | 3.715 | 1,00 |
| finali | 70 | 708 | 725 | 0,97 |
| **Totale** | **878** | **13.208** | **13.646** | **1,00** |

### API pubbliche (per gli altri pacchetti)

Il pacchetto non ha codice: dà solo **chiavi i18n** nei namespace `atto1`, `atto2`, `atto3` e `finali` della lingua `en`.

- Sono **le stesse chiavi dei file italiani**, con la stessa struttura annidata, gli stessi segnaposto e gli stessi a capo. Chi usa `t('atto2.lettere.lettera_clotilde')` o i `textKey`, `titleKey`, `labelKey`, `forgetKey` dei contenuti ottiene l'inglese quando la lingua è `en`.
- I file vengono **caricati da soli**: `loadI18nSources()` (`src/core/i18n.ts`) li prende con il glob `../content/text/*/*.json`. Il loader dei contenuti non va toccato e non serve registrarli da nessuna parte.
- In inglese `__GAME__.core.missingKeys('en')` restituisce **zero chiavi** (verificato nel browser). Prima la storia ripiegava sull'italiano.

## Verifica (pacchetto verificatore)

Ho riletto **tutte le 878 stringhe** mettendo vicini italiano e inglese, non solo un campione. Ho confrontato la traduzione con il GDD:

- 2: il mondo;
- 5.4: le voci dei personaggi;
- 5.6-5.8: oggetti della sera, Libro dei Punti e Taccuino;
- 6: la storia, i testi chiave, le lettere di L., la scelta e i finali;
- 12 e 14.

Ho controllato anche la terminologia di `comune.json` e dell'interfaccia. La qualità è alta: tono, voci, proverbi e testi chiave del GDD 6.4-6.6 sono resi bene. Ho corretto quello che non andava.

### Correzioni alla traduzione

| Chiave | Prima | Dopo | Perché |
|---|---|---|---|
| `atto1.g05.alba.calligrafia2` | «on the side of his heart» | «tucks it into his jacket, over his heart» | Calco dall'italiano. |
| `atto1.g08.alba.filoNero`, `atto1.diario.domande.filoNero.apre` | «At three in the night» | «At three in the morning» | Non è idiomatico. Per stare in 90 caratteri ho riordinato la vignetta. |
| `atto1.g06.alba.tuttiSanno2` | «Eight in Latin» | «An eight in Latin» | È un voto. |
| `atto2.g14.alba.prete.1` | «And someone who isn't here to ask forgiveness of.» | «Father, I must give something back. And ask forgiveness of someone who isn't here.» | Contorta. È la battuta della svolta. |
| `atto2.g16.perline.fascio` | «for Ada, via the Lighthouse» | «for Ada, care of the Lighthouse» | «presso» è l'indirizzo postale: *c/o*. |
| `atto2.g16.alba.fascio.2d` | «by the sea» | «with the sea» | Uguale alla variante normale («col mare»). |
| `atto2.g13.marta.testo` | «calls for the grandmother. Yours.» | «calling for Granny. Yours.» | È il Gino che chiama la nonna. Ora è coerente con «Mum, Granny always said keep still» della stessa giornata. |
| `atto2.g09.marta.testo`, `atto2.diario.persone.bepi.dottore` | «stranger doctor» | «mainland doctor» | «the stranger doctor» si legge come comparativo, «il dottore più strano». |
| `atto3.g18.alba.gino.1` | «a bitter sweet» | «a sweet that tasted bitter» | Si leggeva come *bittersweet*. |
| `finali.chiuso.epilogo.3.1` | «I woke up on yesterday evening» | «I woke up and it was yesterday evening again» | Sgrammaticato. |

### Test aggiunti

Con il codice reale ho controllato che i nuovi test falliscano davvero: ho inserito apposta «Molo», «cushion» e una «è» in un testo, poi ho rimesso il file com'era.

- **Crescita ≤ 20%** (dalla specifica: «non allungare più del 20%»):
  - per ogni namespace nel suo insieme;
  - per ogni testo di almeno 80 caratteri, cioè quelli che riempiono davvero l'interfaccia.

  Resta anche il limite di 1,3× per ogni stringa, che il test già aveva.
- **Niente virgolette « » e niente vocali con accento grave** (à, è, ì, ò, ù) nell'inglese. «fiancé» ha l'accento acuto ed è ammesso.
- **Stessi marcatori di formattazione** dell'italiano.
- **Glossario di `comune.json` e dell'interfaccia.** Se l'italiano usa un termine, l'inglese usa quello concordato:
  - Libro dei Punti → Book of Stitches; Taccuino → Notebook; Archivio → Archive;
  - spillo d'ottone → brass pin; filo d'avorio → ivory thread; nero di seppia → sepia black; punto aperto → open stitch;
  - tombolo → lace pillow; matassa → skein; fuso → bobbin; merlettaia → lacemaker; bigliettino → note; cassapanca → chest;
  - vaporetto → ferry; acqua alta → high water; febbre → fever;
  - Molo, Forno, Piazza, Chiesa, Farmacia, Faro → Pier, Bakery, Square, Church, Pharmacy, Lighthouse.

  Ci sono due eccezioni motivate:
  - il Gino scrive «Peer»;
  - il suggerimento di g22 dice «the Lighthouse» invece di «dalla secca».
- **Nessuna variante concorrente:** spindle, cushion, Book of Points, diary, journal, wharf, vaporetto, campanile, Piazza.
- **Biglietti del Gino:** hanno tutti la sua ortografia da bambino (chirch, litehouse, tonite, preist…).

### Verifica nel browser

Ho usato Playwright 1.56.1 e Chromium headless, con una build di prova servita da `vite preview` sulla porta 5315 (poi chiusa). Ho usato una build e non il server di sviluppo perché questo si ricarica quando altri agenti modificano file. La pagina era aperta con `?debug=1&lang=en`, a 390×844, in modalità touch.

Tutti i 43 controlli sono passati. Non ci sono stati errori in console né avvisi di chiavi mancanti.

Su ogni schermata ho fatto girare un'euristica che cerca parole italiane nel testo visibile: non ne ha trovate.

- **Lingua.** `document.documentElement.lang` vale `en`, e `__GAME__.core.missingKeys('en')` è vuoto.
- **Prologo** (dalla nuova storia):
  - la stanza, con il biglietto «Ada, you finish it. The sun is waiting. C.»;
  - il tombolo, con il titolo «Grandmother's Lace»;
  - la notte in autoplay;
  - l'alba con le vignette di Marta, Teresa e Don Piero in inglese;
  - il Bilancio.
- **Atto II, g14:**
  - la sera, con la lettera L11 alla porta e i 4 bigliettini (Zeno; il Gino con «litehouse»);
  - la notte «Zeno's Letter»;
  - l'alba con la battuta corretta di Zeno («Father, I must give something back…»);
  - il Bilancio.
- **Atto II, g15 e g16:** la lettera di Clotilde con gli a capo, e la notte «The Well Overflows».
- **Atto III e finale:**
  - la scelta di g23, con i biglietti A, B e C in inglese;
  - D strappata, con le mancanze in inglese;
  - la scelta B, la notte «The Sepia Thread» e l'epilogo («My mother took the lace pillow.» … «My mother still weaves.»).

Lo script e gli screenshot sono nello scratchpad della sessione: `verify-traduzione-en/verify-en.mjs` e `verify-traduzione-en/shots/*.png`. Non sono nel repository, perché `tests/e2e/` appartiene a piattaforma-qa.

## Decisioni

- **Inglese britannico**, come `comune.json`: *colour*, *recognise*, *practise*, *Mum*, *jumper*. Per il parlato citato si usano le virgolette tipografiche “ ” (le « » diventano “ ”), con l'apostrofo dritto.
- **Terminologia di `comune.json` e dell'interfaccia**, senza eccezioni (vedi il glossario del test).
  - Restano italiani: Fondamenta, Sant'Arianna, Don Piero, i nomi propri, Chioggia e Burano.
  - Padova diventa Padua, Venezia diventa Venice.
- **Vaporetto → ferry.** Il molo di Chioggia, minuscolo nelle lettere di Livia, è «quay», per distinguerlo dal Pier dell'isola.
- **Secca → shallows / low tide.** Il titolo di g22 è «Low Water», in coppia con «High Water» (g19).
- **Forestiero.**
  - Come nome è «the stranger».
  - Come aggettivo del dottore è «mainland doctor» per Marta e per il Taccuino, «doctor from away» nel biglietto di Bepi.
- **La nonna.**
  - Nella voce di Ada è «Grandmother», con la maiuscola, come un nome.
  - Il Gino, e Marta quando riporta le sue parole, dicono «Granny».
- **Forme di rivolgersi alle persone.** Davanti ai nomi l'articolo cade («il Gino» → «Gino»).
  - cara → dear;
  - figliola / figliolo → my child / my son;
  - signorina → miss;
  - signorina merlettaia → Miss Lacemaker;
  - babbo → Dad;
  - la firma «La mamma» → Mum.
- **Calligrafie popolari.**
  - Il Gino scrive minuscolo e con errori da bambino inglese.
  - Bepi sbaglia le doppie: «fevver», «setle», «tel», «goodby».
- **Proverbi** costruiti come i margini di `comune.json`: «Who weaves is not woven.», «Nets can be made again. Daughters can't.», «A knot not tied is a knot that stays.».
- **Titoli corti.** Tre hanno perso l'articolo per stare nell'1,3× del test: «First Evening» (g01) e «Black Thread» (g08, g17).
- **Etichette delle perline di conoscenza** (g17, g21, g22). Sono rese come nomi («The woman in black's name»), perché il tombolo le inserisce in frasi come «{chi} didn't get {perlina}».
- **`atto2.diario.persone.zeno.lettera`.** L'inglese dice «all this time» e non «for a night» come l'italiano. La voce si sblocca con `done: g14` e Zeno teneva la lettera dalla notte del prologo, quindi l'italiano è sbagliato. Vedi le richieste.

## Problemi noti

Nessuno nei file del pacchetto. Le cose che restano aperte sono negli altri pacchetti (vedi sotto).

## Richieste per altri pacchetti

- **contenuti-atti23.** In `src/content/text/it/atto2.json`, `diario.persone.zeno.lettera` dice «Zeno ha tenuto per una notte la lettera della nonna per me». È in contraddizione con la storia: la voce si sblocca con `done: g14`, e la lettera gli fu data la notte del prologo. Proposta: «Zeno ha tenuto per tutto questo tempo la lettera della nonna per me.» L'inglese dice già «all this time».
- **campagna.**
  - **Finestra «At the door».** A 390×844 la lettera di Clotilde (circa 150 parole) esce dal foglio inclinato ed è tagliata a sinistra e in basso. Lo si vede nello screenshot `en-20-g15-lettera-clotilde.png`. Serve un foglio che scorre in verticale, con il testo contenuto e la rotazione solo sul foglio.
  - **Alba.** I toast delle voci nuove del Taccuino («Teresa lit up. What did she see?», «When Nina is on top…») compaiono sopra il riquadro della prima vignetta e ne coprono il testo per qualche secondo (`en-15-g14-alba-0.png`, `en-03-prologo-alba-0.png`). Non dipende dalla lingua. Meglio annunciare le voci dopo le vignette, o spostare i toast in alto durante l'alba.
- **contenuti-atto1.** `src/content/text/en/comune.json` usa le virgolette dritte `"…"` in 9 coppie («calls everyone "dear"», «"the keeper"»…). La storia inglese usa le tipografiche “…”. Per coerenza conviene passare anche `comune.json` alle “ ”.
- **piattaforma-qa.** Nella suite `layout` in inglese conviene aggiungere gli screenshot dell'alba e della sera di una giornata dell'Atto II (per esempio g14) e della scelta di g23. In alcune righe i testi inglesi sono fino al 30% più lunghi.

## Test

- `npx vitest run tests/unit/content/`: 3 file e 108 test passati, così divisi:
  - `en.test.ts`: 24;
  - `atto1.test.ts`: 34;
  - `atto23.test.ts`: 50.
- `npx tsc --noEmit -p .`: nessun errore, né nei file del pacchetto né nel resto del progetto.
- Prova di mutazione dei nuovi test: ho inserito «Molo», «cushion» e una «è» nei testi e sono falliti 4 test; poi ho rimesso il file com'era.
- Playwright sulla build di prova (porta 5315): 43 controlli su 43 passati. Il server è stato chiuso.

## Integrazione

Non ci sono sezioni «Per: traduzione-en» in `docs/stato/RICHIESTE.md`. Le richieste che questo pacchetto aveva fatto agli altri e che toccano i testi sono state chiuse nel gruppo contenuti (14 ottobre 2026):

- **`atto2.diario.persone.zeno.lettera`** in italiano ora dice «per tutto questo tempo», come l'inglese «all this time».
- **Virgolette di `comune.json`.** Le 9 coppie dritte di `text/en/comune.json` sono diventate “ ”. Nuovo test in `en.test.ts`: nei testi inglesi della storia **e di `comune`** nessuna `"` dritta e “ ” bilanciate (25 test).
- **Crediti** in inglese senza segnaposto: «An idea born from a conversation with Claude», «Concept, design and story: Claude (Anthropic)», «Italian and English text: Claude (Anthropic)».

Test: `npx vitest run tests/unit/content` → 111 test verdi. Browser (porta 5420, `?lang=en`): Crediti e Taccuino in inglese, nessuna virgoletta dritta nel Taccuino aperto, `missingKeys('en')` vuoto, nessun errore in console.
