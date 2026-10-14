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

## Revisione 1

Tutte le dodici attività del gruppo (CAM-01 … CAM-12) sono chiuse, ciascuna con il suo criterio d'accettazione verificato da test unitari e nel browser. I contratti sono quelli di `docs/REVISIONE-1.md` (C03, C04, C05, C06, C07, C08, C10, C11, C17, C18); i tipi nuovi (SCH-01) e i dati comuni (CA1-02) sono già nel repository.

### Che cosa è cambiato

- **CAM-01, Archivio facoltativo.**
  - La scena `archivio` riceve `{ cmd: 'lascia', levelId }` (C10). Toglie `SaveData.night` solo se è la notte d'Archivio di quel livello, non tocca `knowledge.archive` e mostra la cassapanca con «Apri» e «Più tardi». Nella fase d'Archivio «Più tardi» porta alla sera dopo.
  - Un rotolo rammendato ha due pulsanti. «Rileggi» (`cp-apri-<id>`) apre il merletto registrato in modo `replay`, con `resume.archiveNames` uguale ai nomi giusti. Non registra record e non cambia l'Archivio; a merletto finito resta sullo schermo con «Alla cassapanca» (`cp-rileggi-chiudi`). «Rifai» (`cp-rifai-<id>`) lo ritesse da capo.
- **CAM-02, il foglio giusto (C17).**
  - Nessun pulsante dentro `.core-carta`: le risposte non sono più fogli-pulsante e i pulsanti stanno in un livello sopra il foglio.
  - I bigliettini interi e le lettere hanno `core-carta--scorre`.
  - I segni («Appuntato», «Risposto», «Lasciato») stanno sopra il foglio, così «Risposto» si vede senza scorrere. La lista ha in fondo 56 + 16 px.
  - La scheda Lettere c'è dalla prima lettera.
- **CAM-03, oggetti (C03, C04).**
  - `{knows: 'oggetto'}` è vera con l'oggetto o la lettera letti.
  - L'oggetto della porta ha la frase della sua provenienza (`campaign.sera.arrivo.<from>`, `cp-sera-arrivo`). La sera senza oggetto mostra `eveningEmptyKey` (o `campaign.sera.arrivo.niente`).
  - L'oggetto dell'alba (`dawnObject`) si calcola a fine notte (`report.dawnItems`, `report.dawnBy`). Dopo l'ultima vignetta c'è la consegna (`cp-alba-oggetto`): «Prima di andare via…», la figura di chi consegna, la lettura nello stesso foglio della sera. Poi `learnItems` e `refreshDiary`; le voci nuove si annunciano lì, sotto la lettera (`cp-lettura-voci`), e non tornano nel bilancio. Poi il bilancio e la cassapanca. Anche alla porta le voci nuove compaiono sotto l'oggetto prima di chiuderlo.
  - Nel g14 la vignetta di chi consegna (Zeno) è sempre l'ultima dell'alba e non resta mai fuori, anche con 4 culmini.
- **CAM-04, alba (D11, C06).** `selectDawn` riscritta:
  - i culmini (≥ 100) escono tutti, nell'ordine dei dati;
  - `dopo` lega una vignetta alla sua;
  - il massimo sale a 4 solo per i culmini;
  - le battute generiche entrano solo con meno di 2 scritte e mai con un culmine; la riserva solo senza scritte.

  Gli avvisi del Taccuino arrivati a fine notte (una stranezza scoperta nelle ultime righe) non coprono più la prima vignetta: si tolgono all'inizio dell'alba ed escono dopo l'ultima, o col bilancio se prima c'è una lettura.
- **CAM-05, bilancio (C05).** `consequenceOf` usa nell'ordine:
  1. `esito.<stato>`;
  2. destino;
  3. desiderio, solo se scoperto adesso;
  4. voce del Taccuino;
  5. frase generica.

  Le voci usate come conseguenza e quelle già annunciate alla lettura non si ripetono in «Nel Taccuino». `bilancio.record` è al plurale («Record: 1 incrocio, 1 ora di quiete») e la sezione degli obiettivi si chiama «Come doveva andare».
- **CAM-06, Taccuino.**
  - Una pista di una domanda già risolta non si sblocca più. Nelle Domande le piste stanno sopra le risposte e spariscono a domanda risolta. Dopo la scelta di g23 (fasi finale, titoli, fine) «Dove guardare» lascia il posto a `campaign.taccuino.pistaFinita` (`cp-pista-finita`).
  - Pagine del Libro «Nuova» (`knowledge.bookSeen`, `cp-taccuino-libro-nuova`): si segnano viste quando il pannello che le ha mostrate si chiude. Nella prima notte di una regola, la prima apertura del Taccuino va sulla sua pagina. Nel layout stretto compare l'avviso toccabile «Nuova pagina nel Libro: La febbre» (`cp-libro-avviso`), che apre il Taccuino su quella pagina.
  - Le schede stanno in una riga che scorre, sfumata dal lato dove ce ne sono altre.
- **CAM-07, pannello dei bigliettini.**
  - Lo stato viene da `requestStatusFull()`: con `anteprima === 'soddisfatta'` e il rapporto non ancora soddisfatto, «Si compie se fissi l'ora» con la spunta tratteggiata (C07). Il pannello si ridisegna anche a `night:cross`, quindi segue la bozza.
  - Sotto le richieste c'è `objectivesElement({ compact: true })` del tombolo (C08), uno per pannello e per notte. Se il tombolo non lo offre, resta il conteggio di prima.
  - Nelle notti senza bigliettini il pannello si intitola «Obiettivi» e non dice «Nessuna richiesta».
- **CAM-08, finali.**
  - A, B e D: il merletto finito resta con «Continua» (`cp-finale-continua`, sopra il pulsante principale spento del tombolo).
  - C passa subito al cartello nero. Non risuona la campana se il livello ha `chiusura: 'nodo'`, perché la suona l'audio a `tombolo:nodo`.
  - Dopo `fin_chiuso` il biglietto di Clotilde è piegato (`ChoiceCard.folded`, `data-stato="piegato"`), non si appunta e rimanda a «Il punto di Clotilde».
  - La Fine del finale vero ha la riga `cp-finale-vero`; `fineTesto` dice «La storia di quell'anno è finita».
- **CAM-09, sera.**
  - «Appunta · restano 2 spilli».
  - Con gli spilli finiti, sotto i pulsanti c'è come liberarne uno, con i collegamenti ai bigliettini appuntati (`cp-spilli-finiti`, `cp-vai-<id>`).
  - Gli spilli si contano solo se c'è un bigliettino da appuntare; la scelta di g23 usa sempre 1 spillo (`pinsOf(…, 'scelta')`).
  - Esc o Indietro senza pannelli chiedono «Tornare al titolo? È tutto salvato.» (`cp-sera-esci-conferma` sull'ospite del dialogo).
- **CAM-10, cartelli d'atto e prologo.**
  - Alla prima sera di g01, g09 e g17 c'è un cartello nero con la stagione e il titolo (`cp-atto-cartello`, una volta per sera).
  - Nel prologo niente Taccuino sul buio. Lo schermo nero copre tutta la finestra anche nel layout largo, il titolo sta su una fascia scura e il biglietto è appuntato sul tombolo.
- **CAM-11.** La rivelazione dell'Archivio occupa tutta l'area come le vignette dell'alba. Il nome dei personaggi sulla carta usa `inkOnPaper` (`--pers-ink`): Lunardi ≥ 4,5:1.
- **CAM-12.** Ogni riga d'epilogo riceve `{occasioni}`: le occasioni piantate nella notte del finale (`history[fin].occasions`, anche per un epilogo rivisto dal Telaio), ordinate per ora. Esempio: «il vaporetto delle 9, la festa in Farmacia a mezzogiorno, la festa in Piazza alle 17 e la lanterna alle 20»; in inglese «the 9 am ferry, …».
- **Altro.** La stranezza di Gino nel Taccuino dice la regola nuova (D01). L'API di debug ha `dawnObjectSeen()`, `leaveArchive(id)`, `reread(id)`, e `dawn()` riporta anche l'oggetto. `skipDawn()` salta anche la consegna (la lettera si impara lo stesso).

### Come ho letto i contratti

- **C03, avvisi.** «Le voci nuove si annunciano lì, non nel bilancio»: alla lettura (porta o alba) compare l'elenco «Nel Taccuino» sotto l'oggetto, e quelle voci (`diaryAnnounced`) restano fuori da «Nel Taccuino» del bilancio. Se l'oggetto si chiude con Indietro, un avviso mostra la prima.
- **C04, porta e oggetti.** La frase vuota della porta vale solo nelle sere senza oggetto, cioè dove la giornata prima non ha `objectAfter`. Per la provenienza conta il primo oggetto della sera, quindi merletto e Libro dicono «casa».
- **C06, `dopo`.** Una vignetta con `dopo` esce subito dopo la sua. Se quella non è fra le candidate, esce come le altre.
- **C08.** Il componente si chiede al tombolo una volta per pannello e per notte, e il pannello lo riattacca a ogni ridisegno.
- **C10, nomi.** I nomi confermati prima di «Lascia per ora» non si conservano, perché il contratto dice solo di svuotare la notte salvata. D05.1 dice che «restano nel Taccuino»; se servirà, si può tenere `resume.archiveNames` in un campo della campagna e ripassarlo all'apertura.
- **CAM-01, Rileggi.** Il modo `replay` mostra nomi e colori perché il tombolo, senza ArchiveBook, disegna i fili col loro personaggio. Gli echi toccabili in sola lettura dipendono dal tombolo (sotto).
- **CAM-06, avviso.** Vale solo per una regola che compare per la prima volta in quella giornata (g02 voce e matassa, g03 molo, g06 segreto, g09 febbre, g11 nodo, g12 nome, g17 nero, g19 marea), dopo che Ada ha il Libro dei Punti. Nel layout largo non c'è, perché il Taccuino fisso si apre già sulla pagina.

### Richieste per altri gruppi

- **tombolo:**
  - con «Rileggi» (`mode: 'replay'` su un livello d'Archivio, origine `archivio`) servono gli echi toccabili, che oggi richiedono l'ArchiveBook;
  - con «Rileggi» non dovrebbe partire il tutorial: in arc1 compare «Chi è questo filo?…»;
  - nel layout largo la nota a margine (D04, «nel pannello di sinistra, in cima») copre l'inizio del pannello dei Bigliettini: si può riservarle spazio, o la campagna può lasciare un margine in cima se il tombolo lo segnala con una classe.
- **piattaforma-qa:**
  - i flussi da aggiornare nelle e2e sono:
    - il cartello d'atto alla prima sera di g01, g09 e g17 (`cp-atto-cartello`, si tocca);
    - il secondo «Continua» dell'oggetto quando compaiono le voci (`cp-lettura-voci`);
    - la consegna all'alba di g14 e g16 (`cp-alba-oggetto-continua`);
    - «Continua» sul merletto finito dei finali (`cp-finale-continua`);
  - `tests/unit/campaign/browser-verify.ts` è già allineato.

### Test

- `npx vitest run tests/unit/campaign`: 10 file, 97 test, tutti verdi. Sono nuovi `revisione1.test.ts` (logica pura con i contenuti veri) e `revisione1.dom.test.ts` (happy-dom), più casi in `dawn.test.ts` e `controller.test.ts`.
- `npx tsc --noEmit -p .`: nessun errore nei file della campagna. Gli errori rimasti sono di altri gruppi, in corso.
- Nel browser, con la build `VITE_E2E=1` servita con `vite preview` sulla porta 5700, ho guardato gli screenshot uno per uno:
  - `browser-verify.ts`: 105/105;
  - sonde mirate:
    - bigliettini di Gino, Bepi e Zeno a 390×844 e 1440×900, con `elementFromPoint` al centro di Appunta, Lascia e Rispondi;
    - lettere dentro il foglio, «Risposto» visibile, spilli finiti, Esc;
    - g14 dalla notte alla cassapanca, e g15 con la sera vuota;
    - arc1 con Lascia, Più tardi, rivelazione a tutta area, Rileggi e Rifai;
    - i quattro finali con «Continua», `{occasioni}`, Fine e biglietto piegato;
    - g09 con l'avviso e il Libro;
    - pannello dei bigliettini nel prologo largo, nel Merletto del giorno a 1920×1080 e in g05 con la bozza (gettone e pannello concordano);
    - 360×640 col testo al 140% in italiano e in inglese.

### Problemi noti

- Le voci annunciate alla lettura possono essere molte (7 per la lettera di Clotilde). L'elenco scorre e «Continua» resta attaccato in fondo.
- I nomi dati nell'Archivio prima di «Lascia per ora» si perdono (vedi C10 sopra).
