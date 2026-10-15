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

## Verifica della revisione 1

Ho rifatto i passi del playtest per ogni segnalazione del gruppo, nel browser (build `VITE_E2E=1` servita con `vite preview` sulla porta 5705, tocchi veri al centro dei pulsanti, screenshot guardati uno per uno), e ho riletto il codice contro i contratti. Undici attività su dodici reggevano già; la dodicesima (CAM-11) no, e due difetti erano sfuggiti anche ai test.

### Correzioni

- **CAM-11, inchiostro dei nomi.** Nel bilancio e nel Taccuino il nome di Lunardi era ancora a **3,94:1**, come nel playtest (P096). La regola «nomi sulla carta» in fondo a `campaign.css` (miscuglio al 40% con l'inchiostro) veniva dopo quella con `--pers-ink` e la sovrascriveva. Adesso anche lei usa `var(--pers-ink, …)`. Nei bigliettini e nelle lettere l'inchiostro si calcola sulla carta della calligrafia e non su quella predefinita (`inkNamesOn` in `ui.ts`). Senza questo, l'etichetta di Marta, di Bepi e di Zeno sulla loro carta più scura sarebbe scesa a 3,2-3,8:1.
- **CAM-06, Taccuino.** Aperto su una scheda il cui corpo non ha pulsanti (Domande vuote, Libro senza voci, Lettere), il Taccuino passava da solo alla prima scheda. Il motivo: l'overlay mette il fuoco sul primo pulsante, cioè sulla prima scheda, e la riga delle schede segue il fuoco. All'apertura il fuoco va ora sulla scheda scelta.
- **Test nuovi.**
  - `verifica-r1.test.ts` gioca tutta la storia due volte, una appuntando i bigliettini e una lasciandoli, e controlla ogni giornata:
    - nessuna riga ripetuta nella pagina del bilancio, con i testi resi;
    - le voci annunciate alla lettura non tornano;
    - «Ora so che cosa desidera X» una sola volta per persona;
    - le regole dell'alba (D11) e la consegna come ultima vignetta.
  - `verifica-r1.dom.test.ts` controlla:
    - che il CSS non colori nessun nome senza `--pers-ink`;
    - che ogni bigliettino e ogni lettera del gioco abbia i nomi a 4,5:1 sulla sua carta;
    - il Taccuino che resta sulla scheda chiesta;
    - Esc e Indietro con la conferma;
    - gli spilli contati solo con bigliettini da appuntare;
    - niente Taccuino sul buio del prologo.

  I due test delle correzioni falliscono sul codice di prima.

### Prove nel browser (sonde in `scratchpad/rev1-campagna-ver`)

| Segnalazioni | Sonda | Esito |
|---|---|---|
| P001, P032 | arc1 dopo il bilancio di g03: Apri, Pausa, «Lascia per ora», titolo e Continua (non riapre arc1), «Più tardi», sera di g04 con arc1 «nuovo»; Rileggi e Rifai su arc1 rammendato | 20/20 |
| P007, P011, P021, P057, P058 | Gino g01, Bepi g04 e g10, Zeno g14 a 390×844 e 1440×900: `elementFromPoint` al centro di Appunta, Lascia e Rispondi, e l'azione avviene davvero; righe della lettera di g03 e di quella di Clotilde dentro il foglio, firma compresa; «Risposto» non coperto | 56/56 |
| P009, P056, P074 | porta di g01, g02, g18, g15, g17; g14 dalla sera (Zeno e Nina appuntati) alla notte, alba con 3 culmini e la consegna per ultima, nessun avviso sopra le vignette, lettera, 7 voci annunciate, bilancio senza le voci della lettera, arc4, sera vuota di g15 | 22/22 |
| P067, P117, P027, P098 | g18 con la pace: pace, pane, Gino, niente battute generiche né avvisi; record al plurale; «Come doveva andare» in g12 | 6/6 |
| P016, P064, P088, P120 | da g00 a g09 giocando: cartello dell'Atto II, avviso «Nuova pagina nel Libro: La febbre» toccato, Libro su «La febbre» con «Nuova», 6 schede in una riga (390 e 1440); dopo la scelta niente pista e la frase di chiusura | 18/18 |
| P025, P046, P070 | prologo largo con l'elenco degli obiettivi; Merletto del giorno a 1920×1080 con l'elenco completo (5 voci per 4 obiettivi più lo spillo); g05 riga per riga con la bozza: gettone e pannello concordano (Zeno alle 12, Marta e Teresa alle 13) | 10/10 |
| P077, P108, P109, P111, P121, P073, P106 | A e B restano con «Continua» oltre 3,5 s; C al cartello nero subito, poi il biglietto piegato, non appuntabile, col rimando al «punto di Clotilde»; D con la soluzione delle occasioni: l'epilogo dice «il vaporetto delle 9, la festa in Farmacia a mezzogiorno, la festa in Piazza alle 17 e la lanterna alle 20», e la Fine ha la riga del finale vero | 21/21 |
| P010, P024, P114, P116 | «Appunta · restano 2 spilli», «resta 1 spillo», «nessuno spillo» con la spiegazione e il collegamento che apre l'altro bigliettino; Esc chiede, Esc annulla, Esc col bigliettino aperto lo chiude solo; sera di g23 «spilli 0/2», scelta con 1 spillo (390 e 1440) | 30/30 |
| P083 | prologo a 390×844 e 1440×900, in italiano e in inglese: niente Taccuino sul buio, fascia scura, biglietto sul tombolo | 12/12 |
| P035, P096 | rivelazione di arc1 a tutta area come l'alba (390, 1180, 1440); nome di Lunardi su bigliettino, bilancio e Taccuino; scansione di 1007 nomi visibili in 13 sere, nei loro bigliettini e nei bilanci | 15/15, 0 sotto 4,5:1 |
| tutte | 360×640 col testo al 140%, in italiano e in inglese: cartello, porta, oggetto con le voci, spilli finiti, Esc, consegna di g14, bilancio, Taccuino, Continua del finale | 39/40 (il collegamento sotto gli spilli finiti si raggiunge scorrendo l'overlay: verificato) |
| regressione | `tests/unit/campaign/browser-verify.ts` sulla build nuova | 105/105 |

### Come ho letto i contratti (verifica)

- **CAM-01, «mostra nomi e colori».** L'ho intesa come P032 al contrario: i fili del merletto rammendato hanno il loro personaggio, colore e testa del fuso, e non sono più grigi con «Nomi dati 0/4». Così è. Il nome come testo non compare: in modo `replay` il tombolo non crea l'ArchiveBook, ignora `resume.archiveNames` e a merletto finito i fusi non si toccano. Anche gli echi in sola lettura dipendono dal tombolo.

### Problemi noti (verifica)

- **Tombolo, layout largo.** La nota a margine copre ancora il titolo e l'inizio del pannello dei Bigliettini (screenshot di g05 a 1440×900).
- **Tombolo, build minimizzata.** Durante la verifica, una build con il `lace.ts` di prima del commit ff88c10 lanciava a ogni fotogramma `ReferenceError: Cannot access 'c' before initialization` nel disegno degli spilli: il minimizzatore di Vite 8.3.4 rinominava male l'indice del ciclo. Senza minimizzazione non succedeva. Con il codice attuale del tombolo la build è pulita; lo segnalo perché la stessa forma di codice potrebbe ripresentarlo.

## Revisione 2

Tutte le 29 attività del gruppo in `docs/stato/revisione-2.json` (6 P1, 23 P2) sono chiuse. Per ognuna ho rifatto i passi del playtest nel browser e c'è un test che le copre. Le decisioni seguite sono R2-D2 (numeri veri del bilancio, per la parte della campagna) e R2-D5 (fine della notte da gustare). Il conteggio degli incroci del giocatore in `metrics` resta del motore.

### Che cosa è cambiato

- **R2-D2: record veri (Q002, Q053, Q016, Q054).**
  - `recordNight(d, levelId, metrics, spartito, { ok, set })` in `progress.ts`. Un merletto entra nei record e nei fili d'oro solo se tutte le richieste accettate e tutti gli obiettivi sono soddisfatti (`outcomeCounts`). Una richiesta lasciata cadere o con l'autore sbagliato conta come fallita. Un merletto sotto il minimo della notte non conta mai.
  - I record sono per insieme di richieste: `records[livello].sets[chiave]`, con la chiave `requestSetKey` (gli id ordinati, «-» se non ce ne sono). Il bilancio mostra il record delle stesse richieste. Il primo merletto di un insieme fa il record senza annunciarlo. I campi di `LaceRecord` restano: sono il meglio dei merletti riusciti, e il Telaio ne legge filo d'oro e spartito.
  - Un merletto che non conta lo dice: «Questo merletto non entra nei record…» (`cp-bilancio-record-escluso`). Niente «Nuovo record» e niente filo d'oro.
  - Il filo d'oro ha una riga sola:
    - «Il tuo primo filo d'oro ✦» una volta nella vita del salvataggio (`firstGold`, `data-primo="1"`);
    - poi «Filo d'oro ✦ (il primo di questa giornata)»;
    - poi «Filo d'oro ✦».
    «Primo filo d'oro» non è più fra i «nuovo record».
  - Lo stesso vale per Rigioca dal Telaio (`completeReplay`), gli Archivi (contano se rammendati) e i finali.
- **R2-D5: fine della notte da gustare (Q032, Q031).**
  - Dopo l'ultima ora il merletto finito resta sul tombolo almeno 2,5 s (`LACE_HOLD_MS`, non scalati dalla velocità delle animazioni). Dopo 0,7 s suona il suo carillon. Poi compare «All'alba» (`cp-notte-continua`), e un tocco porta all'alba.
  - Con l'avanzamento automatico si va all'alba da soli, sempre dopo 2,5 s. L'alba prende il carillon che sta suonando (`adoptLaceCarillon`), così non ricomincia da capo.
  - Lo stesso vale per Rigioca dal Telaio (verso il bilancio) e per i finali A, B, D (`cp-finale-continua`, che non va avanti da solo). C resta immediato, Ripassa resta com'era.
  - La barra prende il posto del pulsante principale del tombolo, spento (`placeOverMain` in `nightbar.ts`): stessa posizione e altezza, senza toccare menu e Taccuino. Il pulsante spento si nasconde (`cp-con-barra`).
- **R2-D5: la Tovaglia sul Telaio.** Dopo il finale vero (`unlocks.tovaglia`, o «aperto» fra gli epiloghi visti) il Telaio si apre con «La Tovaglia» (`cp-tovaglia`, file nuovo `tovaglia.ts`):
  - una riga che dice che cos'è;
  - la tela con tutti i merletti tessuti, uno per giornata nell'ordine della storia (`cp-tovaglia-tela`), disegnati con `drawLaceImage` del tombolo, uno alla volta;
  - «Ascolta la Tovaglia» (`cp-tovaglia-ascolta`), il carillon dell'intera partita.
- **Q012, coppia incompatibile.** Prima di fissare la prima ora di una notte della storia, nei Bigliettini (pannello di sinistra, o Taccuino sul telefono) c'è «Torna alla sera» (`cp-torna-sera`). Si torna alla sera con gli spilli di prima, senza conseguenze. La notte salvata si toglie (anche quella che il tombolo salva uscendo) e i fogli aperti si chiudono. Dopo la prima ora il pulsante sparisce.
- **Q014.** Il tombolo non emetteva un evento quando si lascia cadere uno spillo dal gettone, e i Bigliettini e il Taccuino guardavano lo stato della notte ogni 250 ms (`watchNight`). Nella rifinitura (sotto) il controllo periodico è sostituito dall'evento `night:drop`.
- **Q069, Q075.** Di notte, nel tombolo, una stranezza scoperta non fa più un avviso, nemmeno quando viene da un rifiuto. Il tombolo la spiega già, e l'avviso copriva le righe basse.
  - La voce resta «Nuova» nel Taccuino e torna nel bilancio in «Nel Taccuino».
  - Il Taccuino fisso del layout largo si accende un attimo (`cp-taccuino--lampo`).
  - Nei merletti d'Archivio l'avviso esce quando si lascia il tombolo.
- **Q026.** Nel foglio della lettera (alba di g14 e g16, porta):
  - «Nel Taccuino» è chiaro sul velluto: 6,1:1;
  - le voci sono su carta opaca: 11,9:1.
- **Q027, Q003.** I pulsanti di testo sulla carta, come «Rifai» nella cassapanca, sono in inchiostro e sottolineati: 11,9:1.
- **Q004.**
  - Quando l'elenco dei bigliettini continua sotto il piede compare la freccia `cp-sera-scorri` (48 px), che scorre l'elenco.
  - L'altezza del piede va in `--cp-piede-h`: un bigliettino appena chiuso torna in vista sopra i pulsanti.
- **Q006.** «Al tombolo» e «Ripassa» ignorano il clic fantasma: un clic che arriva da un tocco cominciato fuori dal pulsante negli ultimi 800 ms, cioè su «Continua» di un foglio che intanto si è chiuso. La tastiera e i tocchi veri valgono sempre.
- **Q007.** Con gli spilli finiti, «Sposta qui lo spillo di Bepi» (`cp-vai-<id>`, stesso data-test) toglie lo spillo e appunta subito il bigliettino aperto (`movePin`). Un anonimo senza autore scelto non lo prende.
- **Q008, Q020, Q037.** Le schede del Taccuino stanno tutte in vista. Se in una riga non ci stanno, vanno su due righe bilanciate (3 + 3, 3 + 2), e su tre se nemmeno così ci stanno le etichette (`fitStrip`, `data-righe`). Si ridispongono quando cambia la larghezza.
- **Q010, Q058.**
  - Un fuso intagliato si annuncia solo se si può scegliere (`availableCosmetics`, letto da `src/screens/cosmetics.ts`).
  - Si annuncia col nome («Un fuso intagliato: «Liscio»»), la sua anteprima e dove si sceglie («Si sceglie in Impostazioni…»).
  - Niente più «(stile N)». Gli stili senza disegno restano in `unlocks.cosmetics`.
- **Q055.** «Chi ricorda Ada» dice quanto ricorda, con la direzione a parte:
  - «ricorda appena Ada (1/3) · più di ieri»;
  - «ricorda Ada (2/3) · meno di ieri»;
  - «ricorda bene Ada (3/3)»;
  - «ha dimenticato Ada».
- **Q056.** Una stranezza sciolta dalla storia è barrata, con «non più: sciolta». Lo decide il motore (`quirkDissolved` chiede a `createContext` con i flag).
- **Q060.** Clotilde scrive con la grafia seppia dei margini (`CLOTILDE_HAND`: Caveat, inchiostro #5C3B22 su #EFE3C8, 7,8:1, ±2°). Vale per la lettera all'alba, le lettere nel Taccuino, la sua carta nella scelta e il biglietto del prologo.
- **Q039.** La sera di g16 la bottiglia è vuota, con un nodo di filo nero (`EMPTY_BOTTLE`). La si ricava da `obj/bottiglia`:
  - la carta dentro il vetro si riempie col vetro intorno;
  - il contorno resta intatto;
  - dentro si disegna il nodo;
  - il risultato si calcola una volta.
- **Q066.** Nelle notti senza bigliettini e con obiettivi il pannello si intitola «Obiettivi» e non dice «Nessuna richiesta stanotte».
- **Q067.** Col mouse (puntatore fine, come nel titolo) le scritte dicono «Clicca…» (`tapKey`): prologo, tombolo del prologo, porta, vignette, Telaio. La scritta sul buio compare prima ed è chiara: 17,5:1.
- **Q073.**
  - Le parole dei bigliettini restano intere (niente `overflow-wrap: anywhere` sul testo; ci pensa il foglio del core).
  - Col testo grande le colonne si allargano (`210px × --text-scale`).
  - A 140% «L'ANNIVERSARIO» di Marta resta su una riga, a 360×640 e a 1280×720.
- **Q035.** Aprendo una giornata del Telaio i suoi pulsanti vengono in vista sopra il piede fisso.
- **Debug.** `__GAME__.campaign.pastLace()` va subito oltre il merletto finito, come il tocco su «Continua».

### Come ho letto i contratti

- **R2-D2, «per lo stesso insieme di richieste».** I record si tengono per insieme (le richieste accettate quella sera, anche se poi lasciate cadere), dentro il `LaceRecord` del livello (campo `sets`, che il core conserva). Non ho cambiato `LaceRecord` in `core/types.ts`, che non è del gruppo.
  - Il filo d'oro resta uno per livello, come nel GDD, ma lo dà solo un merletto che conta.
  - I salvataggi di prima tengono i loro valori. Il primo merletto riuscito di un insieme fa il record di quell'insieme.
- **R2-D2, «Primo filo d'oro una volta sola».** È il primo filo d'oro di tutto il salvataggio: nessun livello lo aveva prima. Una storia nuova non lo ripete, perché i record restano.
- **R2-D5, 2,5 s.** Valgono sempre, anche con la velocità istantanea: il contratto dice «almeno 2,5 s».
  - «Un tocco» è il tocco su «All'alba», al posto del pulsante principale. Un tocco ovunque avrebbe tolto al giocatore il menu e il Taccuino sul merletto finito.
  - Ho applicato la stessa attesa ai finali e a Rigioca dal Telaio.
- **R2-D5, «Tovaglia nominata e mostrata».** Sul Telaio la Tovaglia è i merletti della partita cuciti in una tela, che suona l'intera partita (GDD 7, L3, nella forma più semplice): niente PNG da esportare.
  - Il titolo è di schermi-atto1 (Q036). Può rimandare al Telaio: «la Tovaglia è nel Telaio».
- **Q012.** Ho scelto la via più semplice fra quelle proposte: tornare alla sera finché non c'è un'ora fissata. Lasciar cadere uno spillo resta una richiesta fallita, come dice la conferma del tombolo. Non ho aggiunto avvisi alla sera, che avrebbero svelato il dilemma. Gli indizi che rendono deducibile la coppia sono dei contenuti (vedi sotto).

### Richieste per altri gruppi

- **QA / e2e** (`tests/e2e`, di nessun gruppo), dopo R2-D5:
  - dopo una notte della storia la scena resta `tombolo` finché non si tocca `cp-notte-continua`, o non si chiama `campaign.pastLace()` (o `campaign.skipDawn()`);
  - `prologo.spec.ts` («dopo la notte, l'alba» entro 20 s), `layout.spec.ts` (g06 → alba) e `helpers/campaign.ts` (`playGolden`: `waitScene('alba')` dopo `playNight`) vanno aggiornati;
  - `cp-vai-<id>` adesso sposta lo spillo;
  - `cp-finale-continua` compare dopo 2,5 s.
- **schermi-atto1:**
  - Q036: la Tovaglia si vede nel Telaio (`cp-tovaglia`);
  - GDD 7 dice ancora «la Tovaglia resta L3»;
  - Q012: in g06 e g08 la coppia incompatibile dipende da informazioni che la sera non mostra (Teresa che porta già la chiacchiera, il vaporetto delle 9); servono indizi nei testi della sera.
- **tombolo:**
  - un evento sul bus quando uno spillo si lascia cadere (per esempio `night:drop`) sarebbe meglio del controllo periodico dei pannelli;
  - a merletto finito resta la nota a margine del tutorial («Sbagliare non costa…») sopra le prime righe.
- **contenuti-atti23:** dopo la pace le voci del Taccuino sulle stranezze sciolte (per esempio «Marta non passa mai sotto Teresa. Me l'ha detto con un «No.»…») restano al presente. Le righe delle stranezze nella scheda adesso sono barrate. Si può valutare una formulazione al passato, legata a `riconciliate`.

### Test

- `npx vitest run tests/unit/campaign`: 14 file, 148 test, tutti verdi. Sono nuovi:
  - `revisione2.test.ts`, logica con i contenuti veri: record per insieme e solo riusciti; passi di Q002 dalla giornata e da Rigioca; Q053; primo filo d'oro; `movePin`; stranezze sciolte; Tovaglia;
  - `revisione2.dom.test.ts`, 23 test in happy-dom per bilancio, pannelli, Taccuino, sera, carta e CSS, Telaio e controller.
  Aggiornati `progress`, `i18n` e `revisione1.dom`. In `revisione1.test.ts` le voci della lettera di Clotilde che chiedono anche un desiderio aspettano: è un contenuto nuovo di contenuti-atti23.
- `npx tsc --noEmit -p .`: nessun errore.
- `tests/unit/content/atto23.test.ts` e `tests/unit/tombolo/revisione1-p1.test.ts`, che usano la campagna: verdi.
- Nel browser ho usato la build `VITE_E2E=1` servita con `vite preview` sulla porta 6020 e ho guardato gli screenshot uno per uno.
  - `browser-verify.ts`, aggiornato alla fine della notte: **107/107**.
  - Sonde della revisione 2 (`scratchpad/rev2-campagna/probe.mjs`): **76/76**, nessun errore in console.

| Segnalazioni | Sonda | Esito |
|---|---|---|
| R2-D5, Q032, Q031, Q067 | prologo a 390×844 a tocchi: «Tocca per continuare» 17,5:1; a 0,7 s ancora il merletto; «All'alba» dopo 2,5 s al posto di «Merletto chiuso», fra menu e Taccuino, non coperto; un tocco porta all'alba | 10/10 |
| Q066, Q067, Q020 | prologo a 1440×900 col mouse: «Clicca per continuare» e «Clicca sul tombolo»; pannello «Obiettivi» senza «Nessuna richiesta»; schede del Taccuino fisso dentro il pannello | 6/6 |
| Q004, Q007, Q039 | g01 con Gino appuntato: freccia, scorrimento, Gino sopra il piede; g04: «Sposta qui lo spillo di Bepi» in un tocco; g16: bottiglia vuota col nodo, alla porta e nel foglio | 5/5 |
| Q073 | g08 al 140% a 360×640 e 1280×720: «L'ANNIVERSARIO» intero, nella carta e nel dettaglio | 4/4 |
| Q012 | g06 Nina + Zeno a 390×844: «Torna alla sera» nel Taccuino, sera con gli stessi spilli e senza notte salvata, Taccuino chiuso, cambio di spillo e nuova notte con Nina + Marta, pulsante sparito dopo la prima ora | 7/7 |
| Q014 | g06 a 1440×900: spillo di Zeno lasciato cadere dal tombolo, il pannello dice «Lasciata cadere» entro 450 ms e il pulsante sparisce | 4/4 |
| Q069, Q075 | g01: riga rifiutata per Gino, nessun avviso, la stranezza nel Taccuino | 3/3 |
| Q026, Q060 | alba di g14 a 390×844 e 1440×900: lettera in Caveat seppia, «Nel Taccuino» 6,1:1, voci 11,9:1 | 8/8 |
| Q027, Q003 | cassapanca con arc1 rammendato: «Rifai» 11,9:1, «Rileggi» 11,0:1 | 3/3 |
| Q008, Q020, Q037 | sei schede a 390 (overlay), 1180 e 1440 (fisse): due righe, nessuna tagliata, alte 52 px | 3/3 |
| Q002, Q053 | g02 riuscita (record 7), poi Rigioca con le righe della base (richieste fallite, 4 incroci): niente «Nuovo record», «non entra nei record», salvataggio invariato | 6/6 |
| Q016, Q054, Q010, Q058 | bilancio di g02 col primo filo d'oro (una riga), g04 col terzo e il fuso «Liscio» con «Impostazioni» | 5/5 |
| R2-D5, Q031 | finale D a 1180×820: «Continua» dopo 2,5 s, non copre il Taccuino; Telaio con la Tovaglia | 6/6 |
| R2-D5, Q035 | 12 giornate e la Tovaglia al telefono (12 merletti); Giornata 11 in fondo: «Rigioca» si tocca | 4/4 |
| Q056 | g19 dopo la pace a 1440×900: «Non passa mai sotto Teresa» barrata | 2/2 |

### Problemi noti

- I record dei salvataggi di prima della revisione 2 tengono i loro valori di livello. Fra questi può esserci un minimo ottenuto con una richiesta fallita, ma il bilancio non li mostra più, perché mostra quelli dell'insieme. Dalla rifinitura anche il Telaio legge solo i record per insieme (vedi sotto).
- La bottiglia vuota è ricavata dall'immagine della bottiglia col messaggio. Dove stava il foglio resta una leggera traccia nel vetro, a 72-112 px poco visibile. Un asset dedicato (asset-blender) sarebbe più pulito.

## Verifica e rifinitura della revisione 2

### Correzioni della verifica (commit 339c8c5)

- La sfumatura del piede fisso (sera, Telaio) non si prende più i tocchi; i suoi pulsanti sì.
- Q035: una giornata del Telaio mezza sotto il piede risponde ai tocchi, e aprendola i suoi pulsanti vengono in vista.
- Q056: nel Taccuino le voci sulle stranezze sciolte dalla pace sono segnate «non più».
- Le stranezze scoperte rigiocando dal Telaio vanno in «Nel Taccuino» del bilancio, non in avvisi impilati sopra «Continua».
- La Tovaglia compare nel Telaio solo se la storia di adesso ha tessuto il finale vero (non per uno sblocco di una storia di prima).
- Q039: il nodo nero della bottiglia vuota si legge anche alla porta.
- Q010: il bilancio nomina il «Fuso intagliato».

### Rifinitura (ultimo passaggio, residui dei verificatori)

- **«Continua» del bilancio fuori dalla zona che scorre.** Al telefono piccolo, in inglese, la prima voce del Libro restava a metà sotto «Continua» (attaccato al bordo con `position: sticky`). Adesso il foglio del bilancio ha due parti: le voci scorrono in `.cp-foglio-scorre` (`cp-bilancio-scorre`) e «Continua» sta nel piede del foglio, sotto. Nessuna voce gli passa sotto; «Riascolta», «Spartito» e il Taccuino restano in fondo alle voci. Vale anche per il bilancio di un Rigioca dal Telaio. Provato a 360×640 in inglese con il controllo dei layout degli e2e (`auditLayout`): nessun problema.
- **Q012, la Spinta offre «Torna alla sera».** Quando la Spinta dice che le richieste non stanno insieme, prima della prima ora c'è anche «Torna alla sera» (`tb-suggerimento-torna-sera`, con una riga che dice che si cambiano gli spilli senza conseguenze), accanto a «Lascia cadere lo spillo di…». Il tombolo non importa la campagna: chiede a un aggancio (`setNightHooks({ backToEvening })` in `src/tombolo/active.ts`), che la campagna registra in `controller.install()` con `canGoBackToEvening()` e `backToEvening()`. Nel Merletto del giorno e nel libero l'aggancio dice di no e resta solo «Lascia cadere».
- **Q014, evento `night:drop`.** Il tombolo emette `night:drop` (`{ noteId, levelId }`) quando uno spillo si lascia cadere, da qualunque parte (gettone, Spinta, Taccuino, debug), una volta sola. I Bigliettini e il Taccuino si ridisegnano su questo evento; `watchNight` e il controllo ogni 250 ms sono tolti. L'evento è in `GameEventMap` (core) e in ARCHITETTURA 4.
- **Telaio sui record per insieme.** La stella del filo d'oro e lo spartito di «Riascolta» (quando la giornata non è nella storia di adesso) vengono da `countedRecord` (`progress.ts`): solo i record per insieme di richieste, cioè solo merletti riusciti. Lo spartito è quello dell'insieme della giornata, se c'è, altrimenti quello col minimo d'incroci. Il record d'insieme tiene anche il filo d'oro (`SetRecord.filoDOro`). I campi di livello dei salvataggi di prima (che potevano venire da merletti falliti, Q002) non si leggono più.
- **Q059.** La scheda «Lettere» del Taccuino e il segnaposto dei biglietti alla porta hanno il glifo `foglio`. La nota musicale resta per «Riascolta».
- **e2e.** `helpers/campaign.ts` ha `passLace(page)` (chiama `campaign.pastLace()` finché il merletto finito è sul tombolo); `playNight` e `playGolden` lo usano. `prologo.spec.ts` aspetta «All'alba» (`cp-notte-continua`), verifica che prima del tocco la scena sia ancora il tombolo e lo tocca (mouse o dito); `layout.spec.ts` (schermate per gli store) va oltre il merletto prima di aspettare l'alba. Verdi: prologo su desktop e android-piccolo, store (3), giro in inglese su android-piccolo.

### Scelte consapevoli (lasciate come sono)

- **Q004.** Finché non si scorre, la freccia `cp-sera-scorri` sta sopra il testo dell'ultimo bigliettino: è il segno che l'elenco continua; dopo il tocco il bigliettino è tutto in vista.
- **Q039.** La bottiglia vuota resta ricavata dallo sprite, col nodo disegnato sopra. Un asset dedicato è lavoro di asset-blender.
- **R2-D5.** «Un tocco» resta il tocco su «All'alba» al posto del pulsante principale (non un tocco ovunque), per lasciare menu e Taccuino sul merletto finito.
- **Salvataggi di prima.** Una stella del filo d'oro che c'era solo nei campi di livello (salvataggi di prima della revisione 2) non si vede più nel Telaio finché un merletto riuscito non la rifà. Contatori e fusi intagliati già sbloccati restano.

### Test (rifinitura)

- `tests/unit/campaign/revisione2.dom.test.ts`: Q014 sull'evento (niente `setInterval`); glifo `foglio` nella scheda Lettere; bilancio con «Continua» fuori dalla zona che scorre (DOM e CSS); `countedRecord` e stella del Telaio solo dai record per insieme; l'aggancio «Torna alla sera» registrato da `install()`.
- `tests/unit/tombolo/rifinitura-r2.test.ts`: Spinta con «Torna alla sera» (e senza, fuori dalla campagna), `night:drop` una volta sola.
- `npx vitest run`: 102 file, 1633 test verdi; `npx tsc --noEmit -p .` senza errori; `npm run levels:check -- --qualita`: 34 livelli OK (nessun avviso K7 dopo la colonna «Min» misurata); `npm run build` senza errori.
- e2e sulla build `VITE_E2E=1` (porta 6100): `prologo`, `archivio`, `giornaliero`, `revisione1`, `salvataggio`, `smoke` su `desktop` e `android-piccolo` 54 verdi e 4 saltati; `layout` schermate per gli store (3) e giro in inglese su `android-piccolo` (2) verdi; `campagna` (percorso d'oro e i quattro finali) verde su `desktop`.
- Prove nel browser delle parti toccate (sonde nella cartella di lavoro): scheda di Marta nel Merletto del giorno del 15/10 a 1280×800 («Nessuna stranezza nota che conti stanotte.») e matassa «1 braccio usato»; g06 Nina + Zeno a 390×844 al dito: Spinta con «Lascia cadere» e «Torna alla sera», tocco → sera con gli stessi spilli e senza notte salvata; g06 a 1440×900: `night:drop` e pannello aggiornato entro 60 ms; arc3 a 1180×820: scheda del filo sbiadito sul pannello, merletto libero col filo evidenziato; bilancio a 1280×720 e a 360×640 in inglese senza problemi di layout; Rigioca di g02 dal Telaio: bilancio col piede, stella nel Telaio dal record d'insieme; Taccuino › Lettere col foglio; alba di g08 con la domanda lasciata cadere; epilogo A con Zeno che accende il Faro. Nessun errore in console.

