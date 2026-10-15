# Stato del pacchetto: piattaforma-qa (parte 2, suite end-to-end)

**Stato:** done, verificato. Tutte le suite di ARCHITETTURA 15.2 (tranne `smoke`, di fondamenta) sono scritte e girano sui cinque progetti di Playwright. La verifica ha allargato il giro delle schermate, ha reso il controllo del layout capace di vedere i difetti trovati dal primo playtest (calligrafia fuori dal foglio, pulsanti coperti, parole spezzate), ha aggiunto il controllo di tutta la carta della storia e il comportamento da app di GDD 17. I test che falliscono lo fanno per difetti di altri pacchetti, descritti qui sotto con i passi per riprodurli.

La parte 1 (nativo: `android/`, `ios/`, `scripts/`, `docs/STORE.md`) è del pacchetto piattaforma-nativa e non è stata toccata.

## Riepilogo

File (tutti in `tests/e2e/`):

| File | Cosa prova | Progetti |
|---|---|---|
| `prologo.spec.ts` | Il prologo della campagna giocato con **trascinamenti veri**: mouse sul desktop, eventi touch del protocollo DevTools (pointer `touch`) su iPhone, Android e iPad, coordinate da `night.layout()`. Dal titolo («Tocca per iniziare») allo schermo nero, al biglietto, alle quattro righe di GDD 3.15: spillo di Marta a vuoto, nota a margine «Chi sta sopra, dà», tocco che rovescia, lettera consegnata, «No.» di Marta con il fuso che rimbalza, fine con 4 incroci, `night:complete` e l'alba con le tre vignette. Ogni trascinamento deve arrivare al tombolo **al primo colpo**. In più: pressione lunga → scheda del personaggio; il prologo con la sola tastiera (desktop). | 4 da gioco |
| `campagna.spec.ts` | **Percorso d'oro** dalla g00 alla scelta di g23 giocato come un giocatore che conosce la storia (helpers/campaign.ts): ogni sera l'oggetto, le risposte che svelano i desideri, le richieste utili al finale vero se si possono tessere insieme (soluzione precalcolata da `levels:check`, altrimenti il solver), di notte `night.autoplay()`, gli Archivi dalla cassapanca. Controlla: 24 giornate, ogni richiesta appuntata soddisfatta, 6 Archivi rammendati, `lettereLivia = liberate`, `riconciliate`, 8 desideri su 8, memoria ≥ 1 per almeno 4 a fine g22, requisiti di D **raggiunti giocando**. Poi C (torna alla sera di g23, non conta, lascia «Il punto di Clotilde»), D (Tovaglia sbloccata), A e B: «Continua» sotto il merletto finito, epilogo, titoli col carillon, fine. Nessuna richiesta fuori da localhost. | desktop, iphone |
| `archivio.spec.ts` | arc1 dalla cassapanca: tocco su un fuso sbiadito → scelta dei nomi; 2 giusti + 1 sbagliato non confermano e il contatore dei nomi si legge nella striscia, 3 giusti sì; un rammendo lecito ma sbagliato si rifiuta con `tombolo.archivio.nonCoincide`, Disfa riporta allo strappo, quello registrato si accetta; tocco su un incrocio → eco; «Chiudi il merletto» toccato davvero → rivelazione, arc1 rammendato, domanda chiusa. | 4 da gioco |
| `salvataggio.spec.ts` | Ricarica a metà notte (senza flush) → «Continua» dal titolo riprende alla stessa riga, con la stessa bozza e le richieste lasciate cadere; pagina nascosta (`visibilitychange`) → bozza scritta nello storage subito e ciclo in pausa; esporta e importa dalle Impostazioni (conferma, salvataggio identico tranne `writtenAt`, stringa rovinata rifiutata); slot più recente corrotto → si carica l'altro con un avviso, tutti e due corrotti → si riparte da zero con un avviso. | 4 da gioco |
| `giornaliero.spec.ts` | Stessa data → stessa impronta (`levelSourceHash`) dopo il ricaricamento, in un altro contesto (altro fuso orario e lingua) e con `engine.daily`; un altro giorno → un altro merletto. «Tessi», notte tessuta, testo da condividere di GDD 8.3 con i numeri del record e lo spartito; spartito reimportato dal pannello che ritesse lo stesso merletto; carattere alterato rifiutato. | 4 da gioco |
| `layout.spec.ts` | (1) **Giro di 41 schermate** (helpers/tour.ts) in **5 varianti** (base, testo 140%, alto contrasto, inglese, safe area 47/34), con screenshot e controllo del DOM (helpers/audit.ts) a ogni tappa; una sonda verifica che il controllo veda davvero ogni tipo di problema. (2) **Tutta la carta della storia**: sera per sera (g01-g23) l'oggetto o la lettera della laguna, ogni bigliettino e le sue risposte, con lo stesso controllo (base sui 4 progetti da gioco, 140% e inglese su desktop e Android piccolo). (3) **Daltonismo**: screenshot simulati (deuteranopia, protanopia, tritanopia con le matrici di Machado 2009, più bianco e nero) del merletto a 12 motivi e di g14; controllo sui dati: in ogni livello due fili che si confondono di colore (ΔE < 20) hanno motivo e icona diversi, e due fili non hanno mai lo stesso motivo e la stessa icona. (4) **Store**: 5 schermate per iPhone 6,9" (1290×2796), iPad 13" (2064×2752) e Android (1080×1920). | tutti e 5 (carta: 4; daltonismo: desktop, iphone; store e sonda: desktop) |
| `app.spec.ts` | **Comportamento da app** (GDD 11.1 e 17): viewport senza zoom e fino ai bordi, testo non selezionabile (anche col triplo clic) tranne il campo di esportazione, menu contestuale soppresso, la pagina non scorre né rimbalza trascinando sul tombolo, pizzico e doppio tocco non ingrandiscono. Le sonde sono state provate su una pagina qualunque (lì il pizzico ingrandisce, il triplo clic seleziona, il trascinamento scorre). | 4 da gioco |
| `audio.spec.ts` | `locked` prima di un gesto, `running` dopo il primo tocco o clic, `suspended` con la pagina nascosta e di nuovo `running`; log della prima riga del prologo vero giocata col puntatore: incrocio (marta/teresa) → ora fissata → campana (ore 6 s=1) → segreto; «Tocca per continuare» dopo un'interruzione; `mute(on)`; didascalia della campana tradotta; nessun file audio scaricato. | 4 da gioco |
| `prestazioni.spec.ts` | Trascinamento continuo di 4,5 s (più dei 3 richiesti, così i 240 campioni di `perf()` sono tutti di trascinamento) su 6 colonne × 14 righe: p95 < 8 ms; heap JS < 150 MB dopo 10 giornate in autoplay (dopo la raccolta dei rifiuti, dal protocollo DevTools); budget della build di ARCHITETTURA 16 (JS e worker gzip, CSS, font, asset, atlas). | desktop |
| `i18n.spec.ts` | In inglese nessuna chiave L1 mancante (core, ui, tombolo, campaign, audio, comune), storia inglese controllata a parte; italiano completo; giro di tutte le schermate in italiano e in inglese senza chiavi chieste e mancanti né chiavi visibili; `<html lang>`. | desktop |
| `rete.spec.ts` | Percorso completo (tutte le schermate, una partita fino all'Archivio di g03, Merletto libero) con la rete sorvegliata: tutte le richieste sono dell'origine del gioco. Dopo il primo caricamento, senza rete: prologo, sera, notte, Merletto del giorno (Worker) e libero, Impostazioni, Crediti. | desktop, iphone |

### API dei file di aiuto (`tests/e2e/helpers/`, riusabili da chiunque scriva un test end-to-end)

- `game.ts`: `test` (con la fixture `game`: rete sorvegliata dal primo istante, richieste fuori da localhost bloccate e registrate, errori di console raccolti, gioco aperto da un salvataggio vuoto; opzioni `fresh`, `lang`), `game.expectClean()`, `call(page, 'ns.fn', ...args)` per `window.__GAME__`, `ready`, `reload`, `openGame`, `until`, `scene`, `phase`, `waitScene`, `waitPhase`, `waitNight` (tombolo aperto e notte attiva), `nightState` (tipo `NightState`), `onlyProjects`, `PLAY_PROJECTS`, `guardNetwork`, `captureErrors`.
- `pointer.ts`: `pointerOf(testInfo)` ('mouse' o 'touch'), `drag`, `tap`, `longPress` (mouse o `Input.dispatchTouchEvent`), `nightLayout`, `dragSpindle(page, kind, da, a)`, `tapCrossing`, `pressFix`, `centerOf`, `tapTest(page, kind, dataTest)` (con le attese di Playwright).
- `campaign.ts`: `contentNotes()`, `campaignDays()`, `CAST`, `planEvening`, `playNight`, `playArchive`, `playGolden(page, { untilLevel?, maxDays?, onDay? })`, `precomputed(page, livello, bigliettini)` e `solutionRows(page, livello, bigliettini, flags?)` (soluzione dal `.computed.json`, poi dal solver nel browser, che sui livelli grandi può fermarsi al limite), `toFinale(page)` (dopo la notte di un finale preme «Continua» sotto il merletto e aspetta la scena del finale).
- `audit.ts`: `auditLayout(page, { safeTop?, safeBottom?, minTarget? })` → problemi `overflow`, `fuori-pulsante`, `fuori-schermo`, `piccolo`, `chiave`, `safe-area`, `fuori-foglio`, `coperto`, `testo-coperto`, `parola-spezzata`, `testo-piccolo` (solo informativo, in `INFO_KINDS`); `describeProblems`.
- `tour.ts`: `TOUR` (41 tappe, da un salvataggio vuoto, nell'ordine), `TOUR_DAY`.
- `shots.ts`: `shot`, `keepImage` (riferimenti in `__screenshots__/` scritti solo se mancano o con `--update-snapshots` / `E2E_SHOTS=1`).

### Il giro delle schermate (41 tappe)

Titolo al primo avvio; prologo (schermo nero, biglietto); tombolo del prologo; Pausa; alba; bilancio; sera con l'oggetto; bigliettini; bigliettino con le risposte; Taccuino; **conferma di «Al tombolo» con bigliettini non decisi**; notte con richieste; **scheda del suggerimento (Indizio)**; **barra «Riavvolgi fino a qui / Annulla»**; **scheda del personaggio** (tasto destro sul fuso); sera dell'Atto II (g14); **bigliettino anonimo con «Chi l'ha scritto?»**; **le cinque schede del Taccuino pieno** (Persone, Libro, Domande, Lettere, Archivio); alba dell'Atto II; **«Appunta il tuo nome» (g12)**; cassapanca e merletto d'Archivio; Telaio e **un nodo aperto (Rigioca, Riprendi da qui, Riascolta)**; scelta di g23 e carta strappata; epilogo; titoli di coda; Merletto del giorno, spartito, risultati; Merletto libero; Impostazioni; Crediti; **«Tocca per continuare»**; titolo con una storia. In grassetto le tappe aggiunte dalla verifica (GDD 10.3).

### Il controllo del layout (helpers/audit.ts)

Su tutto `#ui-root`, a ogni tappa:
- testo che esce dal contenitore (`scrollWidth > clientWidth + 1`), dal pulsante o dallo schermo; bersagli < 44 px (ARCHITETTURA 15.2; quelli fra 44 e 48 px di GDD 10.1 si annotano nel rapporto del test); chiavi non tradotte; elementi nella safe area (nei contenitori che scorrono si guardano gli estremi dello scorrimento);
- **fuori dal foglio**: i glifi di ogni testo, misurati con un `Range` (quindi con la rotazione della calligrafia), devono stare nel foglio che li contiene, cioè il primo antenato con uno sfondo; la tolleranza tiene conto dell'inclinazione; non si controlla l'asse su cui un contenitore in mezzo scorre;
- **comando coperto**: al centro di ogni comando `document.elementFromPoint` deve trovare il comando (o un suo figlio); quello che sta sotto una finestra modale o un velo a tutto schermo è coperto apposta; nei contenitori che scorrono contano il primo e l'ultimo comando agli estremi;
- **testo sotto un pulsante** (per i contenitori che scorrono, l'ultimo testo a fine scorrimento);
- **parola spezzata**: una parola visibile su due righe senza trattino;
- **testo piccolo** (solo informativo): sotto 15 px × dimensione del testo (GDD 10.1).

### Screenshot di riferimento

In `tests/e2e/__screenshots__/` (480 file, 28 MB):
- `layout/<progetto>/base/<tappa>.jpg`: tutte le 41 tappe sui 5 progetti;
- `layout/<progetto>/<testo-140|alto-contrasto|inglese|safe-area>/<tappa>.jpg`: le 12 tappe più dense (titolo, bigliettini, notte, sera e bigliettino anonimo dell'Atto II, alba dell'Atto II, bilancio, Taccuino, lettere del Taccuino, scelta di g23, impostazioni, risultati del giorno). Le altre si allegano solo al rapporto del test;
- `layout/<desktop|iphone>/daltonismo/<motivi|g14>-<simulazione>.jpg`;
- `store/<iphone-6.9-1290x2796|ipad-13-2064x2752|android-1080x1920>/<1-titolo|2-tombolo-notte|3-alba-vignetta|4-taccuino|5-merletto-del-giorno>.jpg` (JPEG qualità 90 alla risoluzione piena).

Si scrivono quando mancano o con `npx playwright test --update-snapshots` (oppure `E2E_SHOTS=1`); un giro normale non tocca il repository. Non sono confronti pixel per pixel (velluto, luce del titolo e animazioni cambiano a ogni fotogramma): i controlli veri sono quelli del DOM.

### Come si lancia

- Tutto: `npm run test:e2e` (il `webServer` di playwright.config.ts fa la build con `VITE_E2E=1` e la serve con `vite preview`; `E2E_PORT` cambia porta).
- Con un server già avviato su una build statica (consigliato quando altri modificano i file): `VITE_E2E=1 npx vite build --outDir <cartella>` + `npx vite preview --outDir <cartella> --port <porta>`, poi `E2E_PORT=<porta> E2E_REUSE=1 E2E_DIST=<cartella> npx playwright test`.
- Una suite: `npx playwright test tests/e2e/prologo.spec.ts --project=iphone`.

## Decisioni prese

- **Gesti.** Sui progetti con `hasTouch` il tocco passa da `Input.dispatchTouchEvent`: Chromium genera pointer `touch`, `touchstart/touchend` e anche i click di compatibilità, esattamente come un telefono. I pulsanti del DOM si toccano con `locator.tap()`/`click()`; «Fissa l'ora» al centro del pulsante senza attese di stabilità, perché nel tutorial pulsa.
- **Primo colpo.** Un trascinamento che non arriva al tombolo al primo tentativo è un difetto (un giocatore non riprova): errore «soft», poi si riprova per verificare comunque il resto.
- **Percorso d'oro** giocato dai dati dei bigliettini, non con i flag forzati. Per sapere se un insieme di richieste si può tessere si usa prima la soluzione precalcolata di `levels:check` (come fanno l'autoplay e i suggerimenti): il solver nel browser sui livelli ridisegnati di g13 e g16 si ferma al limite (`status: 'limite'`) e il percorso non appuntava più le lettere di Livia. Solo se i requisiti di D non tornano il test lo segnala e poi li completa con l'API per provare comunque il finale.
- **Finali.** Dopo la notte di A, B e D il merletto finito resta sullo schermo con «Continua» (`cp-finale-continua`, decisione D14 della campagna): il test lo preme come un giocatore (`toFinale`).
- **Animazioni istantanee** (`animSpeed: 0`) nei giri delle schermate e nella campagna; le schermate per gli store usano la velocità normale.
- **Safe area.** Dentro un contenitore che scorre il contenuto può passare sotto le fasce di sistema mentre si scorre; agli estremi dello scorrimento tutto deve essere raggiungibile. Un'area di tocco alta come lo schermo non conta.
- **Calligrafia.** Il testo ruotato non si confronta con il rettangolo del pulsante (il rettangolo allineato agli assi è più largo di quello visibile), ma i suoi glifi si confrontano con il foglio (`fuori-foglio`), con una tolleranza pari a quanto l'inclinazione allarga il rettangolo di una riga.
- **Coperture volute.** Una finestra modale, il suo velo a tutto schermo, gli avvisi e le didascalie coprono apposta: non si contano. Le righe nascoste da un riassunto a tre righe (`line-clamp`) non si controllano.
- **Bigliettino anonimo nel giro.** Si fa dimenticare Ada all'autore del primo bigliettino di g14 (`campaign.setMemoria(autore, 0)`), si fotografa «Chi l'ha scritto?» e poi si rimette la memoria com'era.
- **Taccuino pieno.** Per le cinque schede il giro fa conoscere tutto quello che i contenuti possono far conoscere (stranezze, desideri, lettere, domande, regole del Libro, un Archivio): le schede lunghe sono quelle dove il testo esce.
- **Daltonismo.** La verifica automatica è sui dati (colori di characters.json simulati e convertiti in CIELAB, motivo e icona); la monocromia è solo nel rapporto: GDD 14 nomina le tre dicromasie.
- **Budget CSS** misurato gzip come il JavaScript (ARCHITETTURA 16 non lo dice); il peso senza compressione è nel rapporto del test.
- **Prestazioni.** Trascinamento di 4,5 s invece di 3, perché `perf()` tiene gli ultimi 240 fotogrammi.
- **Progetti.** `desktop-hd` gira solo il layout (ARCHITETTURA 15.2: «solo screenshot»); campagna e rete su desktop e iphone; prestazioni e i18n sul desktop.

## Correzioni della verifica

- **Giro delle schermate incompleto** rispetto a GDD 10.3: mancavano la finestra di conferma, la scheda del suggerimento, la barra del riavvolgimento, la scheda del personaggio, il bigliettino anonimo, le schede del Taccuino oltre la prima, «Appunta il tuo nome», il nodo del Telaio e «Tocca per continuare». Aggiunte (28 → 41 tappe), anche per il controllo delle chiavi di i18n.
- **Il controllo del layout non vedeva i difetti più gravi del primo playtest** (P007, P021, P047, P057, P058): saltava il testo ruotato e non guardava né i glifi fuori dal foglio, né i comandi coperti, né le parole spezzate. Aggiunti `fuori-foglio`, `coperto`, `testo-coperto`, `parola-spezzata` (e `testo-piccolo` informativo), con la sonda che li prova tutti. Ritrovati tutti i casi del playtest, più altri.
- **Solo un bigliettino e un oggetto controllati**: la calligrafia cambia da personaggio a personaggio. Nuovo test «tutta la carta della storia» (88-90 fogli per progetto).
- **Comportamento da app di GDD 17 non provato**: nuovo `app.spec.ts`.
- **Archivio**: il contatore dei nomi si legge davvero nella striscia (accetta «2/3» o «Nomi dati: 3 di 4» della revisione 1); «Chiudi il merletto» si tocca (prima `night.main()`).
- **Richiesta di traduzione-en**: sera e bigliettino anonimo dell'Atto II (g14) e lettere del Taccuino anche fra i riferimenti in inglese, al 140% e con la safe area.
- **Percorso d'oro più robusto** alle notti ridisegnate (soluzioni precalcolate) e al «Continua» dei finali; `salvataggio`, `layout` (store e daltonismo) e il giro usano le stesse soluzioni.
- **Gesti del test più fedeli**: il trascinamento si muove subito dopo la pressione (prima aspettava 16 ms, che con la CPU carica diventavano più dei 500 ms della pressione lunga); nel test dell'audio il suono si sblocca al titolo, come fa il giocatore, prima della notte; il messaggio di errore dice se si è aperta la scheda del personaggio.
- **Suggerimento**: il giro chiedeva `night.hint(2)` invece di `'indizio'` e la scheda mostrava la chiave grezza `tombolo.hint.ancora.spinta`: era il test (l'API non controlla il valore).

## Risultati e test che falliscono

Esecuzione finale sul codice di `HEAD` 552d862 (15/10/2026, mentre la revisione 1 degli altri pacchetti era in corso): `HEAD` esportato con `git archive` in una cartella dello scratchpad, i test di questo pacchetto copiati sopra, build `VITE_E2E=1` servita da `vite preview` sulla 5297. Macchina molto carica (carico medio 15-22 su 4 CPU).

- Suite completa: **185 test, 87 superati, 18 falliti, 80 saltati** (progetti esclusi apposta) in 31 min. Di questi 18, 5 dipendevano da due attese del test superate dalla revisione 1 (il contatore dell'Archivio ora dice «Nomi dati: 3 di 4»; la sonda del layout finiva sotto il piede del titolo): corrette e riprovate, passano (Archivio su desktop, iPhone e iPad; sonda; comportamento da app).
- Già corretti dagli altri pacchetti durante la verifica, e ora verdi: il gioco web offline dopo il primo caricamento (service worker, SCH-08); Teresa e Aldo con motivo e icona diversi in arc3; la calligrafia fuori dalla carta e sopra i pulsanti (lettere L2-L10, lettera di Clotilde, bigliettini di Bepi e di Zeno: P007, P021, P057, P058); «Istantanea» spezzata al 140%; il click fantasma nella scelta dei nomi dell'Archivio sul telefono (P086); i finali con «Continua»; il percorso d'oro con le lettere di Livia liberate.

Difetti che restano (stessi contenuti in `requests_for_others`):

1. **tombolo (con contenuti-atto1) · prologo: alle 7 la nota «Chi sta sopra, dà» non compare più** (prologo.spec.ts «dal titolo all'alba» su desktop, iphone, android-piccolo, ipad-orizzontale; «con la sola tastiera» su desktop). GDD 9 (1:30) e 3.15: è il momento che insegna sopra/sotto.
   - Errore: `nota «Chi sta sopra, dà»` → atteso `atto1.g00.margine.sopraDa`, ricevuto `atto1.g00.margine.spillo`.
   - Causa: la nota delle 6 («Lo spillo è un appuntamento…», passo `margine/incrocio/hour 6` di g00.json) resta la nota corrente anche alle 7, e i passi delle 7 (`incrocio` e `versoSbagliato` con `sopraDa`) non la sostituiscono.
   - Passi: `campaign.newGame()`, `campaign.goto('g00','notte')`; `night.fix()`; `night.cross(0,'R')`; `night.fix()`; `night.cross(1,'R')` → `night.state().margin` = `{"current":"atto1.g00.margine.spillo","shown":["atto1.g00.margine.spillo"]}`, a schermo la nota dello spillo.
2. **tombolo · Archivio sul telefono piccolo: la nota a margine copre il merletto e si prende il tocco dell'eco** (archivio.spec.ts su android-piccolo; P107).
   - Errore: `l'eco parla al tocco` → `[data-test="tb-eco"]` non compare.
   - Passi: viewport 360×640 touch; `campaign.newGame()`, `campaign.goto('arc1','archivio')`, tocco su `cp-apri-arc1`; nominare con `night.name` e rammendare con le righe registrate (10-11); `night.layout()`: riga delle 9 a y 150-206; al centro dell'incrocio 9/coppia 1 (161, 178) `document.elementFromPoint` dà `aside.tb-margin[tb-margine]` («Ora ritessi le ore strappate, com'erano.», nota che resta anche a rammendo finito). `night.echo(9,1)` invece risponde.
3. **tombolo · pulsante `tb-scorri-giu` alto 36 px** (220×36, sotto i 44 px di ARCHITETTURA 15.2 e i 48 di GDD 10.1) su android-piccolo (tutte le varianti) e iphone al 140%, in ogni notte con il merletto più lungo dello schermo (giri di layout.spec.ts: tombolo-prologo, notte, suggerimento, riavvolgi, scheda, nome, Pausa). Passi: 360×640, `campaign.goto('g12','notte')`, misurare `[data-test="tb-scorri-giu"]`. In più, al 140% su 360×640 l'intestazione «Piazza» dell'Archivio esce dalla sua colonna (`span.tb-header-label` 60 > 58 px).
4. **interfaccia · Crediti al 140% sui telefoni: «TRAMA» va a capo a metà parola** («TRAM» / «A»; `p.sc-crediti-nome`, iphone e android-piccolo). Passi: 360×640, `core.setSettings({ textScale: 1.4 })`, `ui.open('crediti')`. Proposta: niente spaziatura delle lettere così larga o una dimensione che si adatta alla larghezza.
5. **campagna (con fondamenta, `.core-carta-testo` con `overflow-wrap: break-word`) · bigliettino di Marta di g08 al 140%: «L'ANNIVERSA / RIO»** (desktop 1280×720 e android-piccolo; layout.spec.ts «tutta la carta della storia (testo-140)»). Passi: `core.setSettings({ textScale: 1.4 })`, `campaign.goto('g08','sera')`, `campaign.objectSeen()`: la carta `cp-bigliettino-g08.marta` (maiuscolo, 200 px di larghezza) spezza la parola. Proposta: `hyphens: auto` con `lang="it"` sulla carta, o una scala della calligrafia che non superi la larghezza della parola più lunga.
6. **fondamenta · gesti misurati con l'ora di elaborazione, non con quella dell'evento** (instabile, solo con la CPU carica: prologo su iPad 1-2 volte su 3, una volta l'audio su iPad). In `src/core/input.ts` i campioni usano `now()` al momento della gestione e il timer della pressione lunga (510 ms) può scattare prima che il browser consegni i movimenti già avvenuti: un trascinamento diventa la scheda del personaggio, un tocco più lungo di 300 ms di elaborazione non rovescia l'incrocio. Su un telefono vero succede quando il thread principale si ferma (decodifica, pre-render dell'audio al primo tocco). Proposta: `t: e.timeStamp` nei campioni e, quando il timer scatta, una ricontrollata dopo aver lasciato passare gli eventi in coda (`setTimeout(0)`), annullando la pressione lunga se un movimento con `timeStamp` anteriore alla scadenza supera la soglia.

Misure dell'esecuzione finale (allegati dei test; CPU molto carica):
- trascinamento su 6 colonne: **p95 3 ms**, p50 0,4 ms (177 fotogrammi durante il trascinamento);
- heap JS dopo 10 giornate (g00-g09) in autoplay: **8,7 MB**;
- build: JavaScript 387,5 KB gzip (budget 450), worker 19,8 KB, CSS 17,8 KB gzip (78,3 KB senza compressione), font 222 KB, asset 2,15 MB, atlas 1,61 MB;
- percorso d'oro: 24 giornate, 51 richieste appuntate e tutte soddisfatte, 6 Archivi rammendati, requisiti del finale vero raggiunti giocando, C/D/A/B fino alla fine;
- carta della storia: 88-90 fogli per progetto, controllati in 1-1,5 min.

## Problemi noti

- Le misure di prestazioni sono fatte nel container (Chromium headless, CPU condivisa): non dicono nulla dei telefoni veri (ARCHITETTURA 15.2). Servono prove su un iPhone e su un Android di fascia media.
- Il tocco è simulato con il protocollo DevTools: è lo stesso percorso di eventi di un telefono, ma Safari su iOS non è provato (qui c'è solo Chromium).
- Gli screenshot di riferimento non sono confronti automatici pixel per pixel.
- La suite completa dura circa 30 minuti con 2 worker su questa macchina carica (185 test, 80 saltati apposta per progetto).
- Con la CPU molto carica il prologo su iPad a volte perde un gesto (difetto 6, fondamenta): finché il riconoscitore non usa l'ora degli eventi il test può fallire in modo intermittente.
- «Nessuna allocazione per fotogramma nel ciclo del tombolo» (ARCHITETTURA 16) non è misurabile in modo affidabile dal browser: resta ai test unitari del tombolo.

## Richieste per altri pacchetti

Vedi il campo `requests_for_others` dell'esito del pacchetto: sono gli stessi difetti della sezione «Risultati e test che falliscono», con i passi per riprodurli.

## Test

| Comando | Risultato |
|---|---|
| `npx tsc --noEmit -p .` (repository e `HEAD` 552d862 esportato) | nessun errore in `tests/e2e/` (né nel resto del progetto a 552d862) |
| Suite completa sulla build del 14/10 sera (21:44), prima delle correzioni della revisione 1 | 87 superati, 6 falliti: i difetti poi corretti dagli altri (offline, Aldo, click fantasma) |
| Suite completa con il nuovo controllo del layout, stessa build | 67 superati, 38 falliti: la calligrafia fuori dalla carta e sopra i pulsanti in tutti i giri (difetti del playtest), poi corretti dalla revisione 1 |
| Suite completa su `HEAD` db5fa00 | 97 superati, 8 falliti |
| **Suite completa su `HEAD` 552d862** (finale) | **87 superati, 18 falliti, 80 saltati** (31 min, 2 worker); 5 fallimenti erano attese del test superate dalla revisione 1, corrette e riprovate: passano |
| Riprove mirate dopo le correzioni (`--repeat-each`) | Archivio desktop/iphone/ipad verdi; audio 8/8; sonda e `app.spec.ts` verdi; prologo e Archivio android come nei difetti 1-2 |
| Sonde a mano (script Playwright nello scratchpad) | pizzico, triplo clic e trascinamento su una pagina qualunque: zoom 4,2×, testo selezionato, pagina scorsa (quindi `app.spec.ts` misura davvero); margine del prologo, eco coperta, «TRAMA», «L'ANNIVERSA/RIO» riprodotti con screenshot |

Screenshot guardati: titolo, notte di g16 e alba di g06 per gli store; Merletto del giorno; bigliettino anonimo al 140%; lettere del Taccuino in inglese; scheda del personaggio; «Appunta il tuo nome»; barra del riavvolgimento; suggerimento; lettere e bigliettini fuori dalla carta (prima della revisione 1); prologo con la nota delle 6 alle 7; eco coperta dalla nota sul telefono.
