# Playtest finale (dopo la revisione 2 e il collaudo)

## finale-nuovo-telefono — divertimento 7/10, chiarezza 6/10

Da pendolare che non legge le istruzioni, i primi 10 minuti funzionano bene. La mano fantasma insegna il gesto. Ogni regola arriva con una nota a margine al momento giusto. Gli spilli toccati dicono di chi sono, e i gettoni «a rischio» aiutano davvero. Diorami e bigliettini scritti a mano hanno fascino. L'Archivio del '36, con i ricordi sugli incroci e il «Perché restasse», è il momento più bello. La ripresa dopo una ricarica è perfetta.

Dal giorno 2 però in metro non basta l'intuito. Con Marta+Teresa la notte g02 ha solo 2 soluzioni e l'ho dovuta schematizzare su carta. Anche g04 (5 fili più la barca) e g05 (6 fili, colonne da 57 px) chiedono ragionamenti lunghi. Le notti durano 5-10 minuti l'una. Nell'Archivio il pannello Obiettivi diceva «In corso» per una consegna che la mia bozza faceva già: ho disfatto una soluzione giusta e consumato due Indizi.

Rispetto a PLAYTEST-1 e PLAYTEST-2:
- non ho più visto la scorciatoia «Fissa fino alle 8» (Q001) né il toast che svela Teresa nell'Archivio (Q070);
- il bigliettino di Gino coperto dai pulsanti rotondi (Q004/P011) c'è ancora;
- lo stato «In corso» con la bozza giusta (Q034) si ripresenta nell'Archivio, dove pesa di più.

Niente di bloccante, solo attriti di chiarezza e un salto di difficoltà.

**Lo consiglieresti?** Sì, ma a un amico che ama i puzzle logici e le storie piccole, non a chi cerca un passatempo da due fermate. È bello e la storia di Marta e Teresa prende. Però dal giorno 2 servono 5-10 minuti di concentrazione a notte, e in metro con una mano sola si fatica.

## finale-esperto — divertimento 8/10, chiarezza 6/10

Da giocatore pagante che vuole arrivare in fondo: TRAMA è un gioco vero, con un'anima. Il sistema delle regole che si accumulano funziona: chi sta sopra dà, voci, segreti che scendono, Don Piero pozzo che trabocca a tre segreti, febbre e cura, nodo, Gino che non sta fermo, Zeno legato al Faro, filo nero che cerca, acqua alta. Le notti dell'Atto II e III sono puzzle densi, dove ogni regola serve. g13 (19 incroci su 19 di matassa, scegliere chi curare come la nonna nel '58) e g18 (la confessione portata dal Gino mentre Nina e Lunardi non devono saperla) sono momenti alla Obra Dinn/Outer Wilds: la regola diventa storia.

La scrittura è il punto più alto, e i ritorni sono veri: la lettera di Clotilde all'alba di g14, «Uno per sei. E uno che restava» in arc3, la risposta a Marta che sblocca il desiderio di Teresa solo se hai rammendato il '58, le regole che «si sciolgono come spago bagnato» dopo la pace, il finale chiuso che ti riporta alla sera con la carta «Piegato». Diorami e figurine sono belli, bilancio e Taccuino danno conseguenze specifiche. L'undo libero fra le ore rende la sperimentazione indolore.

Dove perde punti è la leggibilità delle informazioni che decidono la notte.
- In g18 e g21 si possono appuntare richieste che si escludono a vicenda, e la sera non lo lascia capire. In g21 serve la Spinta per scoprirlo.
- Le ore dell'acqua alta non sono scritte da nessuna parte: ho pianificato male per un'ora sbagliata.
- La stranezza di Zeno (al massimo due luoghi dal Faro) l'ho scoperta solo sbattendoci contro, ma perché avevo saltato l'Atto I.
- I finali B e D hanno meccaniche nuove e opache: agende e desideri dei fili si vedono un'ora prima o per niente. Li ho chiusi grazie alla lampada, che risolve più che guidare.
- L'Archivio a nomi resta in parte una lotteria sugli ultimi due fili.
- Piccoli attriti d'interfaccia: bolla dell'Archivio appiccicosa e non aggiornata, eco che blocca i tocchi, testo «gruppi di tre» con un solo filo, pannelli doppi sul tombolo.

Niente di bloccante: ho raggiunto il finale vero e altri due finali senza bug che rompono la partita.

**Lo consiglieresti?** Sì, a un amico che ha amato Obra Dinn, Outer Wilds o i puzzle logici con carta e matita, e che legge volentieri: le notti difficili ripagano e la storia di Ada, Clotilde e Livia arriva davvero. Gli direi però due cose. La prima: tenga a portata un foglio, perché dall'Atto II in poi le notti vanno pianificate. La seconda: alla sera certe richieste si escludono senza dirlo, e allora la Spinta della lampada va chiesta senza vergogna. A chi cerca un puzzle rilassante da metro lo sconsiglierei per gli ultimi atti. Per lo stesso motivo non lo metterei ancora fra i capolavori: i finali B e D e l'Archivio chiedono troppa fiducia nella lampada.

## Collaudo automatico

E2E, both runs with E2E_PORT=6110 E2E_REUSE=1 E2E_DIST=scratchpad/qa-finale/dist E2E_SHOTS=1 npx playwright test --workers=2: first run 182 passed, 0 failed, 98 skipped; final run 290 tests, 190 passed, 0 failed, 0 flaky, 100 skipped. collaudo.spec.ts on its own: fails on the old build (band alpha 0), 8 of 8 pass on the fixed build. npx tsc --noEmit -p .: no errors. npx vitest run: 102 files, 1633 tests passed. npm run levels:check -- --qualita: 34 levels OK. npm run native:check: 48 of 48. npm run native:test: 70 passed, 0 failed. npm run build: no errors. Browser probes in scratchpad/probe-qa checked the failed-pin label «!12» at the right edge at 360 and 390 px; it is not clipped.

## Segnalazioni

- **F001** [medio] (tombolo, finale-nuovo-telefono) Archivio arc1: gli obiettivi dicono «In corso» anche quando la bozza consegna già la lettera; la conferma arriva solo fissando l'ora
- **F002** [medio] (tombolo, finale-nuovo-telefono) Prologo: la prima mossa 'naturale' (trascinare il fuso di sinistra) viene rifiutata con «No.» per una regola mai mostrata
- **F003** [minore] (contenuti-atto1, finale-nuovo-telefono) g02 con Marta+Teresa: salto di difficoltà al giorno 2 (2 sole soluzioni), senza nessun segnale la sera
- **F004** [minore] (tombolo, finale-nuovo-telefono) Archivio: l'intestazione dice «Merletto chiuso» mentre il pulsante dice ancora «Chiudi il merletto»
- **F005** [minore] (campagna, finale-nuovo-telefono) Sera: «Andare al tombolo? Alcuni bigliettini non sono stati decisi…» compare ogni sera anche dopo aver usato tutti gli spilli
- **F006** [minore] (campagna, finale-nuovo-telefono) Oggetto della sera: il primo «Continua» non chiude la scheda, la allunga e sposta il pulsante
- **F007** [minore] (campagna, finale-nuovo-telefono) Bigliettino di Gino (g01): la fine «alle 11» è coperta dai pulsanti rotondi e dalla freccia di scorrimento
- **F008** [minore] (tombolo, finale-nuovo-telefono) Uno spillo d'ottone violato dalla bozza non si segnala: lo scopri solo toccando «Chiudi il merletto»
- **F009** [minore] (tombolo, finale-nuovo-telefono) La bolla di uno spillo resta sullo schermo dopo altri tocchi
- **F010** [minore] (tombolo, finale-nuovo-telefono) «Nuova pagina nel Libro» copre l'ora e il «fino alle» all'inizio della notte
- **F011** [minore] (contenuti-atto1, finale-nuovo-telefono) g05: alba e bilancio mettono Zeno al Faro a mezzogiorno, ma per portarci Gino, Zeno deve lasciarlo
- **F012** [minore] (tombolo, finale-nuovo-telefono) Archivio: la riga per il lettore di schermo usa ancora «il filo sbiadito N» dopo aver dato i nomi
- **F013** [medio] (campagna / contenuti-atti23, finale-esperto) g21: tre richieste appuntabili insieme ma incompatibili, e la sera non lo dice (Q012 ancora presente)
- **F014** [medio] (contenuti-atti23 / campagna, finale-esperto) g18: la richiesta di Lunardi contraddice quella di Teresa, ma il suo bigliettino non lo lascia capire
- **F015** [medio] (tombolo, finale-esperto) g21: le ore dell'acqua alta non sono indicate da nessuna parte (rettangoli grigi ambigui, nessuna bolla)
- **F016** [medio] (tombolo / campagna, finale-esperto) Finali B e D: meccaniche nuove quasi senza spiegazione, si chiudono di fatto con la lampada
- **F017** [medio] (contenuti-atti23 / tombolo, finale-esperto) Archivio 1958: gli ultimi due nomi si tirano a indovinare (Q028 ancora presente)
- **F018** [minore] (tombolo, finale-esperto) Archivio: la bolla informativa resta appiccicata e non si aggiorna dopo aver dato il nome
- **F019** [minore] (tombolo, finale-esperto) Archivio rammendato: con la scheda di un'eco aperta, i tocchi sugli altri incroci vengono ignorati
- **F020** [minore] (tombolo / contenuti-atti23, finale-esperto) arc5: «Nomi dati: 0 di 1 · si confermano a gruppi di tre giusti» con un solo filo da nominare
- **F021** [minore] (contenuti-atti23, finale-esperto) g09: la nota a margine «finché è malato non deve correre» sembra un divieto, ma la regola è un'esenzione
- **F022** [minore] (campagna, finale-esperto) Vignetta dell'Archivio persa se il gioco si chiude durante la lettura; «Rileggi» mostra solo il merletto
- **F023** [minore] (campagna, finale-esperto) Una risposta che svela un desiderio non dà alcun segnale
- **F024** [minore] (campagna, finale-esperto) Telaio: per provare un altro finale bisogna rigiocare tutta la vigilia di g23
- **F025** [minore] (campagna, finale-esperto) Il finale chiuso visto non compare fra gli «Epiloghi visti» del Telaio
- **F026** [minore] (contenuti-atti23, finale-esperto) Epilogo del finale vero: Marta e Don Piero non ci sono
- **F027** [minore] (campagna / tombolo, finale-esperto) Tombolo a 1440×900: i due pannelli laterali mostrano gli stessi bigliettini
