# Stato del pacchetto: campagna

**Stato:** done (costruito, poi verificato e corretto)

La campagna si gioca nel browser dall'inizio alla fine:
- prologo;
- sere, notti, albe, bilanci, Archivi;
- la scelta di g23 e i quattro finali, con i titoli di coda;
- salvataggi a ogni passaggio di fase, e ripresa anche a metà notte.

Il prologo e la prima giornata sono stati giocati in Chromium con trascinamenti e tocchi veri, nel layout stretto (390×844) e in quello largo (1280×720). Il resto della campagna è stato giocato con l'API di debug e con l'autoplay vero del tombolo.

## Riepilogo

File: `src/campaign/`, `src/i18n/{it,en}/campaign.json`, `tests/unit/campaign/`.

### API pubbliche (per gli altri pacchetti)

- **`controller.ts`**: `controller` / `campaign` implementano `CampaignController` (ARCHITETTURA 5.4): `newGame()`, `continueGame()`, `resumeFrom(levelId)`, `replay(levelId)`, `state()`, `knowledge()`.
- **Contratto con le schermate** (navigazione per scena):
  - `scenes.go('sera', { cmd: 'nuova', confirmed? })`: senza `confirmed` e con una storia salvata la sera chiede conferma;
  - `{ cmd: 'continua' }`: riprende la fase salvata, anche a metà notte;
  - `{ cmd: 'riprendi', levelId }`: Riprendi da qui;
  - `scenes.go('telaio', { back?: SceneId })`.
- **Scene**: `sera` (prologo, sera, scelta), `alba`, `bilancio`, `archivio`, `telaio`, `finale`.
- **Pannelli in UiLayer**:
  - `taccuino`: sei schede; opzioni `{ from, levelId, origin, accepted, tab?, entry?, noteId?, fixed? }`;
  - `bigliettini`: richieste della notte con lo stato dal vivo e «Lascia cadere»;
  - interni: `cp-nota`, `cp-oggetto`.
- **Bus**:
  - `night:complete` con origine `campagna`, `archivio` o `telaio`;
  - `night:exit`: una notte facoltativa lasciata a metà si abbandona;
  - `quirk:discovered`: solo dalle notti della storia.
- **Logica pura** (testata in Node):
  - `story.ts`: `evalStory`, `applyEffects`;
  - `memoria.ts`: `memoriaAfterNight`, `initialMemoria`, `ensureMemoria`;
  - `dawn.ts`: `selectDawn`, `buildDawn`;
  - `evening.ts`: `eveningNotes`, `pinNote`, `replyNote`, `leaveNote`, `pinsLeft`, `campaignNightParams`;
  - `endings.ts`: `endingRequirements`, `choiceCards`, `epilogueOf`;
  - `progress.ts`: `recordNight`, `dayUnlocks`, `endingUnlocks`, `goldUnlocks`, `showsElegance`;
  - `diary.ts`: `refreshDiary`, `currentPista`, `quirkRevealed`;
  - `rewind.ts`: `rewindTo` (Riprendi da qui);
  - `flow.ts`: la macchina a stati su `SaveData`.
- **`__GAME__.campaign`** (ARCHITETTURA 15.1): `state`, `knowledge`, `newGame`, `goto(levelId, phase?)`, `accept(noteIds, guesses?)`, `reply(noteId, 'R1'|'R2')`, `toNight`, `skipDawn`, `finishDay`, `setFlag`, `setMemoria`, `learn(kind, id)`, `choose(ending)`, `unlockAll`. In più: `phase`, `scene`, `nav`, `continue`, `evening`, `unpin`, `leave`, `objectSeen`, `ripassa`, `dawn`, `report`, `next`, `cards`, `requirements`, `resumeFrom`, `replay`, `archive`, `finale`.

### Che cosa fa (in breve)

- **Sera**:
  - l'oggetto della laguna (dopo g00 anche il Libro dei Punti; il fascio di lettere e `fascio_1..3` solo se `lettereLivia == 'liberate'`);
  - i bigliettini filtrati con `availableIf`, con Appunta / Rispondi / Lascia e gli spilli contati da campaign.json;
  - per gli anonimi (memoria 0), «Chi l'ha scritto?» prima di appuntare;
  - «Al tombolo» sempre attivo, con una conferma se restano bigliettini non decisi;
  - Ripassa quando le richieste coincidono con una soluzione già trovata.
- **Notte**: `NightParams` con `needsNome` solo nei livelli con la regola `nome`; modi `archivio`, `occasioni`, `controllato` e `normale`.
- **Alba**: selezione GDD 5.9; vignette con diorama, figurine (Ada grezza; chi non ha una figurina usa quella anonima tinta del suo colore), borbottio, Salta e avanzamento automatico (al massimo 8 s per vignetta).
- **Bilancio**:
  - esiti e conseguenze, bigliettini lasciati, memoria, voci nuove;
  - eleganza e record da g02 (GDD 7), filo d'oro, sblocchi;
  - Riascolta, Spartito; «Continua» resta attaccato al bordo basso.
- **Archivio**: la cassapanca, il merletto nel tombolo, la rivelazione, la nota a margine con la penna di Clotilde, le voci nuove.
- **Telaio**: Rigioca, Riprendi da qui (con conferma), Ripassa, Riascolta, epiloghi visti. Dopo una notte del Telaio, Indietro torna dove si era entrati.
- **Scelta e finali**: D strappato con le mancanze, C che torna alla sera di g23, epiloghi filtrati per `when`, titoli di coda col carillon dell'intera partita.

## Correzioni della verifica

1. **Bigliettini all'inizio della notte.** Nel layout largo il pannello Bigliettini del tombolo diceva «Nessuna richiesta stanotte» fino alla prima ora fissata. Il tombolo monta i pannelli prima di rendere attiva la notte. Ora:
   - i pannelli si ridisegnano a `scene:enter`;
   - prima di allora mostrano le richieste appuntate come «in corso».
2. **Notti facoltative lasciate a metà.** Un Rigioca, o un merletto d'Archivio aperto dalla cassapanca, lasciato con «Torna al titolo» si riapriva a ogni «Continua» al posto della storia. Ora:
   - chi esce da una notte facoltativa la abbandona;
   - se l'app viene chiusa a metà, la notte si riprende alla stessa riga;
   - un merletto d'Archivio aperto dalla cassapanca durante la sera prima non si riprendeva affatto.
3. **Stranezze fuori dalla storia.** Le stranezze scoperte nel Merletto del giorno o in quello libero entravano nel Taccuino della storia, anticipando personaggi e voci (per esempio Lunardi prima dell'Atto II). Ora entrano solo quelle delle notti della storia.
4. **Nuova storia.** Cancellava gli epiloghi visti, che il GDD 7 elenca fra gli sblocchi (il rapporto diceva il contrario). Ora restano.
5. **«Al tombolo» sempre attivo** (GDD 10.3). Prima era disabilitato finché non si leggeva l'oggetto.
6. **Eleganza e record dal bilancio di g02** (GDD 7: «g02: matassa visibile, records di eleganza»). Prima comparivano già nel prologo.
7. **Voci lette nel Taccuino fisso.** Nel layout largo il Taccuino è sempre aperto e non segnava mai le voci come lette: restavano tutte «Nuova», per esteso. Ora diventano lette quando la scena smonta il pannello; una voce evidenziata resta aperta.
8. **Stranezze senza anticipazioni.** La scheda della persona scriveva subito «Legge le lettere che porta» quando Teresa «si accende» nel prologo, mentre i contenuti lo spiegano solo dopo g05. Ora una stranezza si scrive per esteso solo quando tutte le voci di quella persona che la nominano sono nel Taccuino.
9. **«Continua» a portata nel bilancio.** Con molte voci nuove finiva sotto la piega. Ora è in una riga attaccata al bordo basso (GDD 10.1).
10. **Nomi leggibili sulla carta.** Il grigio chiaro di Lunardi era illeggibile sui fogli: ora i nomi sono in inchiostro velato dal colore, e sottolineatura e icona portano il colore pieno.
11. **Titoli di coda senza doppioni.** Il titolo del gioco, i caratteri e gli strumenti comparivano due volte. Ora ogni riga compare una volta sola. Restano le righe del GDD 10.3 che credits.json non ha (intelligenza artificiale, Pellestrina e Burano).
12. **Musica dell'Archivio** anche quando si riprende una notte d'Archivio. È stato aggiunto `rewind.ts` (ARCHITETTURA 5.4).

## Decisioni prese

- **Bigliettini ignorati.** Sono quelli non appuntati quando si va al tombolo, anche se si è risposto. «Lascia» li segna come lasciati subito, e valgono `onIgnore`. I destini legati a una richiesta (Bepi, Nina, lettere) seguono così la richiesta non tentata.
- **Autore sbagliato di un anonimo.** La richiesta fallisce (`onFail`) e all'alba c'è il quadro della delusione (priorità 80). È la lettura più semplice di «la richiesta vale per la persona sbagliata».
- **Esiti per bigliettino** in `history[levelId]` (accettati, ignorati, risposte, esiti), non come flag `ok:` / `risposta:`. I contenuti non usano quei flag.
- **Memoria.**
  - Prima di g12 vale 3 per tutti e 1 per Lunardi.
  - Cambia solo nei livelli con la regola `nome`.
  - La scelta di g23 usa la memoria di fine g22.
- **`done(arcN)`** vuol dire Archivio rammendato (anche arc6, con le occasioni). **`done(fin_chiuso)`** è registrato in `history` con righe vuote; C non conta come finale.
- **Nuova storia** azzera la storia e il Taccuino. Record, sblocchi, statistiche ed epiloghi visti restano.
- **Snapshot.** Se ne salva uno a ogni sera. Riprendi da qui ricalcola i bigliettini con la conoscenza attuale e tiene epiloghi visti e soluzioni trovate.
- **Ripassa** solo con `unlocks.libero` (dopo g08) e con una soluzione per le stesse richieste.
- **Notti facoltative.**
  - Un Rigioca o un Ripassa dal Telaio, o un Archivio aperto dalla cassapanca fuori dalla fase d'Archivio, si abbandonano uscendo.
  - Si riprendono solo dopo una chiusura brusca.
  - Le notti della storia e quelle della fase d'Archivio restano sempre da riprendere.
- **Schede del Taccuino.** Lettere da g06 o con 5 lettere; Archivio quando c'è un rotolo; Bigliettini dal giorno 1, o di notte con richieste.
- **Fusi a fili d'oro** `stile_1..4` a 3, 8, 15 e 22 fili d'oro; il primo finale che conta li dà tutti («fusi intagliati extra», GDD 7).
- **Finale con obiettivi falliti**: si ritenta la notte.
- **Navigazione dopo la notte.** Un solo passaggio di scena verso la stessa scena alla volta. Dopo `night:complete` si aspettano 1,6 s (scalati con la velocità delle animazioni), e si va avanti solo se il giocatore è ancora davanti a quel merletto.

## Problemi noti

- **Velocità delle vignette.** Non c'è un'impostazione separata per la velocità del testo: `Settings` non ha il campo. L'avanzamento automatico usa la velocità delle animazioni.
- **Fusi della serie del giorno.** `stile_5` e `stile_6` (7 giorni di fila, 30 in totale) non li assegna la campagna: sono del pacchetto interfaccia.
- **Asset dei fusi.** In L1 esistono solo gli asset `fuso/stile_1` e `fuso/stile_2`: `stile_3` e `stile_4` sono scritti in `unlocks.cosmetics`, e il titolo li mostra quando l'asset esiste.
- **Avviso sulle vignette.** L'avviso di una stranezza scoperta all'ultima riga (2,8 s) copre per circa un secondo il riquadro della prima vignetta dell'alba. È un toast del core, ed è transitorio.

## Richieste per altri pacchetti

- **tombolo** (facoltativo):
  - Montare i pannelli `bigliettini` e `taccuino` dopo aver reso attiva la notte. Oggi la campagna rimedia ridisegnandoli a `scene:enter`.
  - Passare `fixed: true` al Taccuino montato a destra nel layout largo, così le voci nuove restano «Nuova» per tutta la notte e diventano lette quando la notte finisce.
  - Nel prologo, giocato con il mouse in Playwright, il primo trascinamento dopo «Fissa l'ora» delle 6 a volte non viene preso per 1-2 s (l'animazione della riga?): è servito ripeterlo fino a tre volte.
- **contenuti-atto1**: in `comune.crediti` restano i segnaposto «[nome dell'autore]», visibili nei titoli di coda della campagna e nei crediti.
- **interfaccia**: già allineata (Continua → `{ cmd: 'continua' }`, Nuova storia → `{ cmd: 'nuova', confirmed: true }`, Pausa → overlay `taccuino`). Restano a lei i fusi `stile_5` e `stile_6`.
- **piattaforma-qa**: usare `__GAME__.campaign` e aspettare `night.state().active` prima di `night.autoplay()`. Usare la build con `vite preview`. Riferimento funzionante: `tests/unit/campaign/browser-verify.ts`.
  - Variabili: `CAMPAIGN_VERIFY_PORT`, `CAMPAIGN_VERIFY_URL`, `CAMPAIGN_VERIFY_OUT`.
  - Notti facoltative: dopo un ricaricamento «Continua» le riprende; dopo «Torna al titolo» non più.

## Test

- **`npx vitest run tests/unit/campaign`**: 8 file, 57 test, tutti verdi.
  - story, memoria, alba, flusso con i contenuti veri fino ai quattro finali, Archivio, Riprendi da qui, Ripassa, progressione e sblocchi, testi it/en;
  - DOM con happy-dom: Taccuino fisso e overlay, voci lette, stranezze non anticipate, Bigliettini all'inizio della notte, vignette e figurine tinte, anonimi;
  - controller sul bus: notti facoltative lasciate a metà, «Continua» che riprende l'Archivio, stranezze solo dalla storia.
- **`npx tsc --noEmit -p .`**: nessun errore.
- **`CAMPAIGN_VERIFY_PORT=5285 npx tsx tests/unit/campaign/browser-verify.ts`** (build e `vite preview`, Chromium): 99 controlli superati, nessun errore in console.
  - prologo e prima giornata a tocchi;
  - ricarica in ogni fase e a metà notte;
  - tutta la campagna fino a g23 con l'autoplay del tombolo, e i finali A, B, C, D;
  - layout largo con i Bigliettini dal vivo;
  - Archivio dalla fase e dalla cassapanca (ripresa e abbandono);
  - anonimo con l'autore sbagliato;
  - Telaio: Riprendi, Rigioca, Ripassa e ritorno alla sera;
  - eleganza da g02 e «Continua» visibile;
  - misure a 360×640 con il testo al 140%.
- **Esplorazione a mano con Playwright**: screenshot guardati uno per uno.
  - Prologo trascinando davvero i fusi, alba toccando le vignette, bilancio, oggetto, bigliettini, risposta, spilli, Taccuino, notte di g01; in stretto e in largo, in italiano.
  - g12 (nome e memoria nel bilancio e nel Taccuino), la scelta, fin_seppia, l'epilogo, i titoli, la fine.
