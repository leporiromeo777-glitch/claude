# Stato del pacchetto: motore

Costruito, verificato e aggiornato con un intervento mirato su `levels:check` (richieste di docs/stato/RICHIESTE.md, sezione «Per: motore»). Revisione 1 dopo il primo playtest: MOT-01…MOT-05 chiusi (sezione «Revisione 1» qui sotto).

**Stato:** done

## Revisione 1

Compiti di docs/REVISIONE-1.md, sezione 3.1, tutti chiusi con test. Commit: e68d0b0 (MOT-01), ee03d16 (MOT-03), 34f4aca (MOT-02), e9b27fe (MOT-04), db5fa00 (MOT-05), 86a4e74 (Gino controllato prima di applicare la riga; test dei tempi sul tempo di CPU), più quelli di questo rapporto.

### MOT-01. Gino non sta fermo due ore di fila; con la febbre resta a letto (C01) · P015, P091, P094

- **Stato.** Nuovo slot `OFF_GF` nello stato compatto (model.ts), calcolato in `stepRow` (core.ts) dopo bordi e fine riga: vale 1 se Gino è sulla tela a fine riga, c'era già all'inizio (chi entra da un bordo parte da 0), non ha incrociato (anche un incrocio forzato del nero vale) e all'inizio della riga non aveva la febbre. All'apertura 0. Una riga bloccata (nodo, marea) conta come ferma.
- **Regola.** `ginoVicino(m, st, row, blocked)` restituisce il primo vicino libero da sinistra se la riga va rifiutata (Gino sulla tela, non bloccato, senza febbre a inizio riga, fermo nella riga prima, con un incrocio possibile, e la riga non lo fa incrociare), altrimenti -1; `ginoFailed` = `ginoVicino >= 0`. La stessa funzione serve `applyRow` (quindi `simulate`, suggerimenti, tombolo), il solver, il giocatore automatico e il generatore. Un vicino impegnato dal giocatore in un altro incrocio conta come libero.
- **Febbre.** "Con la regola `febbre` attiva" = la perlina febbre esiste e non è inerte (il generatore la spegne con `disable: ['febbre']`, come le altre regole). Con Gino nel livello la febbre si traccia sempre nel solver e nel giocatore automatico (`trackedBeads`).
- **Stato pubblico.** `LaceState.ginoFermo` (arrivato con SCH-01) si scrive solo quando vale 1; `toCompact`, `fromCompact` e `stateKey` lo comprendono (la chiave del rammendo d'Archivio è quindi più precisa; `sameLace` no).
- **Violazione `corre`**: `params: { chi, vicino }`, `threads: [gino]`, `messageKey` invariato.
- `SOLVER_VERSION` 2, `GENERATOR_VERSION` 2 (i livelli generati cambiano). Rigenerati i computed delle fixture e `src/engine/data/daily-fallback.json` (60 semi, `--check` verde). I computed dei contenuti li rigenerano i gruppi dei contenuti (D19).
- Fixture nuova `test-gino` (Molo, Forno, Piazza; Marta, Gino, Don Piero; 6 righe; nessun altro vincolo): minimo 3, 3 ore di quiete, 16 soluzioni ottime, uguali alla ricerca esaustiva su `applyRow`. Il titolo usa la chiave di prova esistente `tombolo.test.grande`, perché il test del tombolo vuole nel suo json ogni chiave delle fixture.
- Una sequenza valida con la regola vecchia lo è anche con la nuova (la nuova è più debole, e la febbre la allenta ancora): i merletti registrati degli Archivi restano validi.
- **Effetto misurato** sui contenuti di oggi, prima del ridisegno (base vecchia → nuova): g01 5→3, g02 6→4, g05 7→4, g07 8→4, g08 5→5, g09 11→5, g10 10→1, g11 10→5, g13 14→0, g14 10→5, g15 14→7, g16 12→6, g17 9→5, g18 11→6, g20 8→4, g21 5→3, g22 9→5. Uguali alla tabella di D01 dove la regia ha misurato senza la febbre; g09, g10 e g13 scendono di più perché Gino comincia la notte con la febbre e resta a letto (in g13 la base è 0: è il dilemma voluto, curarlo lo rimette a correre).

### MOT-02. Parametri di violazioni e rapporti (C13) · P038, P045, P093, P094, P118

- `bloccato`: `params: { chi, causa: 'nodo' | 'marea' }` (chi = il primo bloccato da sinistra; 'nodo' se è annodato dalla riga prima, altrimenti 'marea').
- `occupato`: `params: { a, b, nero? }`, dove a e b sono i due fili dell'incrocio forzato che occupa la coppia (come i `threads` di oggi) e `nero` il filo nero o autonomo che lo muove. In più `forzato` ha `params.nero` quando si tocca la coppia del filo autonomo.
- `corre`: `{ chi, vicino }` (MOT-01).
- Motivi di `evaluate`: `incontra` e `nonIncontra` con una finestra (`from` o `to` nei dati) hanno anche `dalle` e `alle` (la finestra effettiva, in ore di riga); `sopra` con `to` ha `alle`. Senza finestra i parametri non cambiano.
- **Interpretazione del contratto**: `messageKey` resta la chiave generica del codice (`tombolo.violazione.bloccato`, `.occupato`, `.corre`); la chiave di dettaglio la sceglie il tombolo dai parametri, come dice la sezione 4 di REVISIONE-1 («se mancano, il tombolo ripiega sulla chiave generica»). `engineTextKeys()` elenca anche `tombolo.violazione.bloccato.nodo`, `.bloccato.marea`, `.occupato.nero` (`VIOLATION_DETAIL_KEYS`), e `violationTextKey(v)` fa la scelta (esportata per comodità). Il tombolo oggi già sceglie da sé le chiavi giuste (provato nel browser, vedi sotto). I modelli `…Finestra` di C16 sono chiavi del tombolo: il motore non li produce.

### MOT-03. Criteri di qualità in `levels:check` (C14) · P022

- `src/engine/quality.ts` (puro, esportato da index): soglie `QUALITY` (documentate in GDD 3.13), `judgeQuality` con K1-K7, `designata` (la configurazione possibile più cara; a parità quella con più bigliettini, poi la prima), `qualityExemption` (g00, Archivi, `fin_chiuso` e autotessitura esenti; g01 esente da K2; `fin_merlettaia`: min(base) ≥ 8, K3, K4), `dilemmaRequired` (g03-g22), `emptyRows`.
- `levels:check` calcola per la base, ogni bigliettino da solo e ogni combinazione possibile non voluta: `min` (dentro la matassa, o il minimo vero se oltre; null per un bigliettino voluto impossibile), `minSenzaGino` (stesso contesto, stesso filo del nome, senza `ginoCorre`; null se Gino non c'è), `costo` (bigliettini), `vuoteMax`/`vuoteTot` sulla soluzione registrata (quella del solver: a parità di incroci la più quieta), `soluzioniOttime` (`countOptimal`, fino a 50). Scrive `quality` nel computed per ogni livello, Archivi compresi (base = rammendo più corto, righe vuote sul merletto registrato, rammendi ottimi contati).
- Opzioni: `--qualita` (violazioni come errori, uscita 1; anche `npm run levels:check --qualita`), `--facile <liv>:<nota>` (al massimo uno per sera; esente da K1 e K2; il segno resta in `quality.facili` da un'esecuzione all'altra, come `voluta`; `--facile <liv>:-<nota>` lo toglie; un segno su una nota che non c'è più si toglie con un avviso), `--max-states <n>` (predefinito `CHECK_MAX_STATES` = 1 500 000 per ogni risoluzione). `--report` ha le colonne K1…K6 (✓, ✗n, – esente). K7 legge gli intervalli "Min" dalle tabelle di docs/GDD.md 5.2 ed è sempre un avviso.
- **Interpretazioni**: «il segno resta nel computed come `voluta`» = persiste come `voluta`, in `quality.facili`. Un facile vale solo se sta in una combinazione `voluta` di almeno due bigliettini; un bigliettino impossibile da solo non ha costo né K1-K4. La designata è soggetta a K1 anche se è un bigliettino facile.
- **Misure sul contenuto di oggi** (prima del ridisegno, `--report` senza scrivere; tutte le violazioni sono avvisi): g04 (K1 ✗2, K2 ✗2, K4 ✗6), g06 (K1 ✗2, K2 ✗2, K4 ✗6, K5 ✗1) e g10 (K1 ✗4, K2 ✗4, K4 ✗12, K5 ✗1) compaiono come chiesto; in tutto solo g00, gli Archivi e i finali esenti sono puliti. K6 manca in g09 e g13; `fin_merlettaia` ha base 4 (< 8). g16 si verifica senza toccare il limite (base 6; 6,4 milioni di stati in tutto, circa 78 s su una macchina carica); tutto il controllo dei 34 livelli circa 2 minuti.

| Livello | Base | K1 | K2 | K3 | K4 | K5 | K6 |
|---|---|---|---|---|---|---|---|
| g01 | 3 | ✓ | – | ✗2 | ✓ | ✓ | – |
| g02 | 4 | ✓ | ✗4 | ✗3 | ✓ | ✓ | – |
| g03 | 0 | ✗1 | ✗1 | – | ✗3 | ✓ | ✓ |
| g04 | 1 | ✗2 | ✗2 | – | ✗6 | ✓ | ✓ |
| g05 | 4 | ✓ | ✗1 | ✗1 | ✗1 | ✓ | ✓ |
| g06 | 0 | ✗2 | ✗2 | – | ✗6 | ✗1 | ✓ |
| g07 | 4 | ✓ | ✗3 | ✗4 | ✗4 | ✗1 | ✓ |
| g08 | 5 | ✓ | ✗2 | ✗3 | ✗4 | ✓ | ✓ |
| g09 | 5 | ✓ | ✗3 | ✓ | ✗8 | ✗1 | ✗1 |
| g10 | 1 | ✗4 | ✗4 | ✓ | ✗12 | ✗1 | ✓ |
| g11 | 5 | ✓ | ✗3 | ✗2 | ✗4 | ✓ | ✓ |
| g12 | 2 | ✗3 | ✗3 | – | ✗10 | ✗1 | ✓ |
| g13 | 0 | ✗4 | ✗3 | ✓ | ✗10 | ✗1 | ✗1 |
| g14 | 5 | ✓ | ✗3 | ✗1 | ✗4 | ✗1 | ✓ |
| g15 | 7 | ✓ | ✗4 | ✗5 | ✗5 | ✗1 | ✓ |
| g16 | 6 | ✓ | ✗3 | ✗2 | ✗3 | ✗1 | ✓ |
| g17 | 5 | ✓ | ✗4 | ✗3 | ✗5 | ✗1 | ✓ |
| g18 | 6 | ✓ | ✗3 | ✗1 | ✗1 | ✗1 | ✓ |
| g19 | 0 | ✗4 | ✓ | – | ✗10 | ✗1 | ✓ |
| g20 | 4 | ✓ | ✗4 | ✗5 | ✗4 | ✓ | ✓ |
| g21 | 3 | ✗4 | ✗4 | ✗3 | ✗10 | ✗1 | ✓ |
| g22 | 5 | ✗1 | ✗1 | ✗5 | ✗8 | ✗1 | ✓ |
| g23 | 4 | ✓ | ✓ | – | ✗1 | ✗1 | – |
| fin_merlettaia | 4 | ✗1 | – | – | ✗2 | – | – |

### MOT-04. Filo d'oro solo con minimo ≥ 3 (C15) · P022

`metrics(level, rows, minIncroci, fantasmaUsed, oro?)`: il quinto argomento è `balance.oro` (facoltativo; senza, `ORO_MIN_INCROCI` = 3). `filoDOro = !fantasmaUsed && minIncroci !== null && minIncroci >= oro.minIncroci && incroci === minIncroci`. Chi chiama oggi con quattro argomenti ha già la regola con la soglia 3.

### MOT-05. Gradi del generatore che contano · P044

Nel filtro di qualità c'è un passo 6: ogni grado deve cambiare il puzzle, altrimenti si prova il seme `#k` dopo (gli stadi del ripiego diventano 0-6). `gradeMatters(spec, built, grado, min, hi)`:
- `spilliVelati`: almeno uno spillo d'ottone a un'ora ≥ apertura + 3;
- `nodoInPiu`: senza la coppia aggiunta dal grado la soluzione ottima la fa incrociare, oppure con il rancore il minimo cresce;
- `neroInPiu`: senza il nero aggiunto (o senza il filo in più da seguire, se il nero c'era già per la regola del giorno) la soluzione ottima non regge col nero, oppure costa di meno;
- `notteCorta`, `matassaEsatta`, `senzaDisfa`: sempre.

`buildCandidate` dice che cosa hanno aggiunto i gradi (`grades.rancor`, `grades.nero`); un grado che non ha potuto aggiungere niente non conta. Un limite di stati (30 000, `GEN_MAX_STATES`) vale come "non conta". La regola di Gino nuova vale anche qui (stesso solver). Il seme del playtest `pm0ozmz` (piccolo, regola molo) con Spilli velati e Un nodo in più ora dà `pm0ozmz#100`: spillo di Don Piero al Faro alle 12 (apertura 8), Zeno e Gino in rancore, ed entrambi i gradi pesano. Tempi del generatore con la regola nuova: per i Merletti del giorno dal 14/10 al 12/11 il giorno più lento costa 330-400 ms di CPU (prima 260-280 ms), in tutto 2,3-2,6 s contro 2,0-2,2 s; con Gino lo spazio degli stati è più grande (sulle stesse 230 candidate del 7/11: 55 000 stati contro 23 000) e servono più semi, perché i minimi scendono. I test dei tempi ora misurano il tempo di CPU del processo: con la macchina carica (carico medio 20 su 4 processori, altri gruppi al lavoro) il tempo di orologio arrivava a 2,7 s e i test fallivano senza colpa del codice.

### Prove nel browser

Build `VITE_E2E=1` servita con `vite preview` sulla porta 5640 (poi chiusa), Chromium 390×844, Playwright. `__GAME__.engine.version()` → solver 2, generatore 2. Fixture `test-gino` nel tombolo: alle 7 «Fissa l'ora» senza incroci passa; alle 8 è rifiutata con «Gino è stato fermo un'ora: adesso deve incrociare (può con Marta).»; incrociando passa; l'autoplay fa 3 incroci (righe _ x _ x _ x), `minIncroci` 3, filo d'oro. `test-rancore`: dopo il nodo delle 7, alle 8 «Il filo di Teresa è annodato: in quest'ora non si muove.». `test-nero`: alle 9 la coppia di Zeno e Livia è del nero, il giocatore prova la coppia 3: «Livia si muove da solo: non si può incrociare.» (chiave `occupato.nero` scelta dal tombolo con `params.nero`). Giorno 18/10 (con Gino): generato al seme #172, minimo 9. Nessun errore in console. Schermate in scratchpad/rev1-motore/shots (01-05).

### Problemi aperti e note per gli altri gruppi

- **Contenuti**: i computed vanno rigenerati con `levels:check -- --only …` (SOLVER_VERSION 2, `quality`); i numeri qui sopra sono di prima del ridisegno. g16 e g13 sono lenti da verificare (decine di secondi) finché la base resta così aperta.
- **Tombolo** (test da aggiornare, file non miei): in tests/unit/tombolo/integrazione.test.ts g12 con Lunardi (minimo 2), arc2 e arc3 (rammendo da 2) si aspettano il filo d'oro: con C15 non c'è più, se il tombolo non passa un `oro` diverso per gli Archivi. «g01: la nota di Clotilde compare quando Gino non sta fermo» presuppone il rifiuto alla prima riga: ora la prima riga è libera, il rifiuto arriva alla seconda riga ferma. Il testo di `occupato.nero` («{nero} si muove da solo») non si accorda con Livia («da sola», come chiedeva P118).
- **Tombolo, TOM-22** («Salta le ore quiete»): l'obbligo di Gino si sa con `applyRow(level, state, [], ctx)` (violazione `corre`), o leggendo `state.ginoFermo === 1`.
- Il contratto C13 non dice il genere dei parametri: gli id restano id di fili, il tombolo li traduce.

## Riepilogo

Il pacchetto "motore" (src/engine/, tools/levels/, tests/unit/engine/) è stato verificato contro la specifica di PACCHETTI.json, GDD 3 (tutta), 8.3-8.5, 14 e ARCHITETTURA 5.2, 14.6, 15.2, 16, 17, leggendo il codice e non il rapporto. Le regole sono state provate con script e con un confronto automatico fra il solver e una ricerca esaustiva (applyRow + evaluate) su oltre 15.000 livelli casuali piccoli (3-6 colonne; stranezze, perline, bordi, marea, rancore, filo nero, autotessitura, condizioni di ogni tipo con combinatori). Il comportamento nel browser (Worker, AbortSignal, `__GAME__.engine`) è stato provato in Chromium con Playwright.

Commit della verifica: d0d7cbf, a9febc2. Commit del costruttore: 859b8f5, b41c8b6, 1b1922a. Commit dell'intervento: 66c434a più quello di questo rapporto.

### Intervento mirato su levels:check (richieste dei contenuti)

1. **Nome di Ada (GDD 3.11).** Nei livelli con la regola `nome`, per ogni condizione che nomina la perlina `nome` (`ha`, `nonHa`, `esceCon`, anche dentro `tutti`/`almeno`/`non`: `mentionsNome`) levels:check prova come filo del nome **ogni filo presente all'apertura** (lino compresi; mai «nessuno», perché Ada il nome lo appunta sempre) e tiene il minimo; a parità vince il primo da sinistra. La voce del computed porta `nomeOn` (il filo migliore) e, per bigliettini e combinazioni, **non porta `rows`**: quelle righe valgono solo con quel filo, e il tombolo (`precomputed()`) cerca le soluzioni solo per insieme di bigliettini; senza righe risolve con la scelta vera del giocatore. Risultato: g12.lunardi non è più `voluta` (2 incroci con il nome su Lunardi; con Don Piero è impossibile, perché il pozzo non dà il nome); lunardi+bepi 2, lunardi+zeno 3, lunardi+teresa 5, tutte con `nomeOn: lunardi`. I quattro segni `voluta` diventati inutili sono stati tolti. La matassa di g12 (8 = 6 + 2) non cambia.
2. **Combinazioni con meno bigliettini degli spilli.** Il giocatore può appuntare anche meno di `pins` bigliettini, quindi ora si calcolano tutte le combinazioni da 2 a `pins` (nell'Atto III coppie e terne, prima solo terne). Ogni coppia possibile entra nella combinazione designata (matassa suggerita) e ha la sua soluzione (il tombolo la usa per il filo d'oro: prima, con due spilli nell'Atto III, `minIncroci()` era null). g18: teresa+gino = 14, quindi la matassa suggerita passa da 13 a 15, uguale alla matassa già corretta dai contenuti.
3. **Segni `voluta` e coppie.** Le coppie impossibili dell'Atto III sono esattamente i «conflitti voluti» della tabella di docs/stato/contenuti-atti23.md e stanno solo in terne già marcate `voluta`: g17 teresa+piero e marta+piero, g18 teresa+lunardi, g19 bepi+nina, g20 nina+teresa, g21 gino+marta, g22 zeno+teresa. Le ho marcate con `--voluta` (il test dei contenuti verifica che siano impossibili anche senza limite di matassa: conflitti di regole). Regole nuove del controllo: una combinazione che contiene un bigliettino o una combinazione più piccola impossibile e voluta è voluta anch'essa (il conflitto è lo stesso); un segno su una combinazione diventata possibile si toglie con un avviso e la combinazione conta per la matassa; una combinazione voluta impossibile solo per la matassa (con più filo si farebbe) dà un avviso; un `--voluta` che non corrisponde a nessuna combinazione calcolata dà un avviso; l'errore di una combinazione impossibile dice quale combinazione più piccola la rende tale.
4. **Altro.** `--report` mostra il filo del nome (`lunardi=2@lunardi`). `__GAME__.engine.solve(levelId, noteIds, opts)` accetta `opts.nomeOn`; se manca e le condizioni nominano `nome` prova ogni filo come levels:check e restituisce anche `nomeOn`. `SOLVER_VERSION` resta 1 e l'impronta dei sorgenti non cambia: i `.computed.json` cambiati sono solo g12 e g17-g22 (rigenerati), gli altri 27 sono identici byte per byte; le fixture del motore non cambiano.
5. **Flag di storia (controllo in più).** Ho confrontato i numeri di g19-g23 e dei finali calcolati senza flag con quelli con `riconciliate`: sono identici per base, bigliettini e combinazioni, quindi il limite noto «levels:check gira senza flag» oggi non ha effetti sui contenuti.

### Problemi trovati e corretti

1. **Condizioni sul segreto di lettura** (`ha`/`esceCon` su `letta:<lettera>`): il limite ottimistico del solver (`atomCanOk`) le dava per impossibili finché Teresa non aveva letto, quindi il solver scartava soluzioni valide (diceva "impossibile" dove la ricerca esaustiva trovava 0-3 incroci) e `evaluate` mostrava `a_rischio` a torto. Ora Teresa conta come portatrice possibile finché la lettera è in viaggio (conditions.ts).
2. **levels:check sull'Archivio**: la base si calcolava risolvendo la giornata da zero con la matassa del rammendo (pochi incroci), quindi un merletto d'Archivio con spilli d'ottone dava errore. Ora per l'Archivio: il merletto registrato si riapplica (anche gli obiettivi, se ci sono, devono risultare soddisfatti), ogni strappo si cerca a strati con gli stati uguali fusi (esatto anche per strappi lunghi), `base.incroci` = somma dei rammendi più corti, `base.rows` = merletto registrato (forzati ricalcolati), `matassaSuggerita` = incroci originali negli strappi (GDD 5.3); errore se la matassa è sotto il rammendo più corto, avviso se è diversa dagli incroci originali.
3. **Suggerimenti al limite di stati**: se il solver si fermava al limite (60000 stati) il suggerimento diceva «da qui non si arriva». Ora dà il suggerimento generico (ARCHITETTURA 5.2); «impossibile» solo quando lo è davvero.
4. **Ripartenza del solver** (`from`): la matassa già usata ora è `from.state.usedMatassa` (prima: la somma delle righe rifatte). Uguale nell'uso normale; nel rammendo d'Archivio, dove il tombolo riparte da zero all'inizio dello strappo, ora funziona.
5. **Parametri bilanciabili** (GDD 3.13: "si cambiano senza toccare il codice"): soglia del trabocco e durata del nodo erano costanti (3 e 1). Ora `RunContext` ha i campi facoltativi `traboccoSoglia` e `nodoRighe` (aggiunta non distruttiva in core/types.ts) e `createContext(level, flags, { balance })` li legge da balance.json. Senza `balance` valgono i valori del GDD, quindi niente cambia per chi non li passa. I nodi di più righe hanno maschere in più nello stato compatto e il campo `knots` nello stato pubblico. L'impronta del sorgente cambia solo con valori diversi dal GDD (le impronte attuali restano uguali). levels:check e `__GAME__.engine.solve` passano `db.balance`.
6. **Generatore, ripiego**: se nessuno dei 500 semi passa il filtro (succede spesso nel Merletto libero a 4 colonne), si prendeva il primo candidato risolvibile, spesso banale (minimo 2). Ora si prende quello arrivato più avanti nel filtro (minimo nell'intervallo, poi soluzioni ottime ≤ 12, poi giocatore avido battuto), a parità il primo. Il Merletto del giorno non cambia: usa prima la lista di riserva.
7. **levels:check**: quando il solver arriva al limite di stati l'errore ora lo dice ("could not be verified: solver state limit reached") invece di "impossibile".
8. **Solver con pieroTrabocca**: si tracciavano tutte le perline; ora tutti i segreti (si contano per il trabocco), le lettere con i loro segreti di lettura se Teresa legge, e le perline delle condizioni. Verificato contro la ricerca esaustiva.

### Contenuto e API pubbliche (src/engine/index.ts)

TypeScript puro: importa solo ../core/types, ../core/rng, moduli propri e JSON. Le regole sono scritte una volta sola (model.ts, core.ts) su uno stato compatto (Int32Array) e servono API pubbliche, solver, giocatore avido e autotessitura.

- `createContext(level, flags, opts?: { nomeOn?, occasions?, balance? }) → RunContext`. Con `riconciliate` (true o 'sì') toglie martaNoSotto, teresaLegge e il rancore Teresa-Marta; pieroTrabocca resta. `presetOccasions` entrano da sole. `flagOn(v)`.
- `initialState(level, ctx)`, `cloneState`, `stateKey` (con `ginoFermo`), `sameLace` (confronto del rammendo). Tipo `EngineLaceState` = LaceState + `agenda?` (agende dei fili autonomi) + `knots?` (solo con nodi di più righe).
- `blocked`, `forcedCrossings` (riga successiva), `checkCrossing(level, state, draft, c, ctx)`, `previewRow`, `applyRow` (ordine di GDD 3.4; rifiutata → stato invariato, `events: []`), `unreachablePins`.
- `evaluate(level, timeline, events, conds, ctx, final) → CondReport[]` (soddisfatta / in_corso / a_rischio / fallita, con `reasonKey` e `params`). `mentionsNome(cond)`: la condizione nomina la perlina `nome` (quindi dipende da `ctx.nomeOn`).
- `metrics(level, rows, minIncroci, fantasmaUsed, oro?)` (C15, `ORO_MIN_INCROCI` = 3), `isSymmetric`.
- `QUALITY`, `judgeQuality`, `qualityExemption`, `dilemmaRequired`, `emptyRows`, `designata` (criteri C14).
- `solve(req)` sincrono; `solveAsync(req, signal?)` e `generateAsync(spec, signal?)` in un Web Worker (`new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' })`), annullabili; in Node ripiegano sul sincrono. `SOLVER_VERSION` = 2 (revisione 1), `defaultMaxStates()` (400000 Node, 60000 browser; levels:check usa 1 500 000).
- `planAutoRow(level, state, ctx, controlled?)`.
- `hintFor({ level, ctx, timeline, rows, goals, tier, solution? }) → Hint`.
- `generate(spec)`, `dailySpec(date)`, `dailyLevelId`, `weekday`, `dayOfYear`, `nextDate`, `DAILY_RULES`, `minRange`, `GENERATOR_VERSION`, `GEN_KEYS`, `greedyPlay`.
- `encodeSpartito`, `decodeSpartito`, `spartitoRows(level, s)` (ore vere), `spartitoRef(mode, idOrDateOrSeed)`, `GRADO_CODES`.
- `simulate(level, ctx, rows, from?)`, `simulateAndEvaluate`.
- `levelSourceHash`, `levelSourceHashFromDB(db, id)`, `pinsForLevel`, `stableStringify`, `fnv1a32`.
- `engineTextKeys()`, `violationKey`, `violationTextKey`, `conditionKey`, `HINT_KEYS`, `VIOLATION_CODES`, `VIOLATION_DETAIL_KEYS`.
- `memoriaAfterDay(level, timeline, memoria, opts?)`, `MEMORIA_MIN`, `MEMORIA_MAX`.
- register.ts registra `__GAME__.engine`: `level(id)`, `solve(levelId, noteIds?, opts?)` (opts: `flags`, `objective`, `matassa`, `countOptimal`, `maxStates`, `nomeOn`; senza `nomeOn` e con condizioni sul nome prova ogni filo e aggiunge `nomeOn` al risultato), `computed(levelId)`, `daily(date)`, `generate(spec)`, `encode(sp)`, `decode(str)`, più `fixture(name)` e `version()`.
- `LevelComputed` (core/types.ts, aggiunta non distruttiva): `base`, `perNote[id]` e `combos[i]` possono avere `nomeOn?: ThreadId`; quando c'è, bigliettini e combinazioni non hanno `rows`. `combos` contiene tutte le combinazioni da 2 a `pins` bigliettini con richiesta (più le voci `voluta` di un solo bigliettino impossibile).
- Fixture (src/engine/fixtures): g00 (identico ad ARCHITETTURA 14.1), g06 (GDD 3.16, con notes.fixtures.json e campaign.json), test-grande (6×14), test-motivi (12 fili), test-nero, test-marea, test-febbre, test-rancore, test-trabocca, test-bordi, test-occasioni, test-seppia, test-archivio, test-gino (revisione 1), ognuna con il suo .computed.json.
- tools/levels: `check.ts` (`npm run levels:check`, opzioni `--dir`, anche come `npm run levels:check --dir X`; `--report`, `--only`, `--no-write`, `--voluta lvl:a+b`, `--facile lvl:nota`, `--qualita`, `--max-states n`), `report.ts`, `daily-fallback.ts` (`--check`). `runCheck(opts)`, `checkLevel(level, db, voluta, file, extra?)`, `gddMinRanges()` e `CHECK_MAX_STATES` sono esportati per i test.

Numeri verificati: prologo 4 incroci e 3 soluzioni ottime; g06 base 0, N1 5, N1+N2 5, N2+N3 0, N1+N3 impossibile (marcata voluta), matassa 8; caso 6×14 a matassa minimo+2 in circa 0,35 s (14-33 mila stati) in Node, 0,65 s nel Worker in sviluppo; Merletto del giorno su 460 date consecutive: al massimo 435 ms, 2 volte la lista di riserva (regola segreto); worker del solver 55 KB minificato, 20 KB gzip.

## Integrazione

Richieste di docs/stato/RICHIESTE.md («Per: motore») controllate sul codice attuale: sono tutte già soddisfatte, nessun cambiamento al motore né agli strumenti.

- `src/core/rng.ts` (`rngFromSeed`, `shuffle` che restituisce una copia): il generatore lo usa già; tools/levels importa `node:fs` con i tipi di Node del tsconfig.
- levels:check con ogni scelta di `nomeOn` sui livelli con la regola `nome` (g12.lunardi non è più `voluta`, 2 incroci con il nome su Lunardi) e combinazioni da 2 a `pins` bigliettini (coppie dell'Atto III controllate contro la matassa): fatto nell'intervento precedente (vedi sopra), `SOLVER_VERSION` e impronte invariate.
- Verifica di oggi: `npm run levels:check` → 34 livelli OK, nessun `.computed.json` cambiato; `npx vitest run tests/unit/engine` → 12 file, 292 test verdi.
- Il `nomeOn` del computed ora lo usa anche l'autoplay del tombolo (richiesta della verifica del motore al tombolo, fatta: vedi docs/stato/tombolo.md, «Integrazione»). Il tombolo calcola l'eleganza dell'Archivio sulle sole righe rammendate, coerente con `base.incroci` = somma dei rammendi più corti di levels:check: nessun cambiamento a `metrics`.

## Decisioni prese

- (Costruttore, confermate) Gino: "incrocio possibile" = non bloccato e un vicino libero (non bloccato, non in un incrocio forzato, almeno un verso ammesso dalle stranezze), la matassa non conta: a matassa finita la riga di Gino si rifiuta e si disfa. Così più matassa non obbliga mai a più incroci e la programmazione dinamica resta esatta. Un vicino usato dal giocatore in un altro incrocio resta "libero".
- (Costruttore, confermate) Verso enumerato solo quando conta (perline trasferibili tracciate, pozzo che trabocca, Marta e Teresa, pozzo con perline tracciate, Nina con segreti, Lunardi con un malato, condizione `sopra`): il confronto con la ricerca esaustiva lo conferma. `countOptimal` conta le sequenze ottime con questi versi (prologo: 3 come nel GDD).
- (Costruttore) Bordi: 'molo' prima colonna, 'faro' ultima; ingressi anonimi con i lino di riserva del livello, poi `lino<N>` sintetici (ids che non sono in `level.threads`); un bordo in colonna allagata non avviene; un filo con nome già sulla tela non entra (e nessuno esce). Il filo nero entra come evento di bordo.
- (Costruttore) Pozzo: conta i segreti ricevuti dall'ultimo trabocco (partendo da quelli che ha all'apertura); trabocca a fine riga alla soglia; al prossimo incrocio da sopra dà tutto, poi il conteggio torna a zero. Nina non prende dal pozzo. Lunardi non è mai malato.
- (Costruttore) Spartito: controllo = FNV-1a(corpo) % 36 seguito da ⌊h/36⌋ % 36, la convenzione che rende valido l'esempio del GDD. Con 2 caratteri base 36 un carattere alterato sfugge con probabilità circa 1/1296 (limite del formato, non del codice).
- (Verifica) Archivio in levels:check: vedi il punto 2 sopra. `computed.base.rows` di un Archivio è il merletto registrato: è la soluzione da usare per "Ripassa", autoplay e suggerimenti.
- (Verifica) Parametri bilanciabili tramite `RunContext` facoltativo invece di leggere i contenuti dal motore (che resta puro).
- (Verifica) Ripiego del generatore: il candidato arrivato più avanti nel filtro. `GENERATOR_VERSION` resta 1: il Merletto del giorno non cambia e il Merletto libero non era ancora pubblicato.
- (Intervento) Nome di Ada in levels:check: si provano tutti i fili presenti all'apertura (come `setNome` del tombolo, che accetta qualsiasi filo della tela, lino compresi), solo per le condizioni che nominano `nome` (le altre non dipendono dal filo del nome: nessuna regola del motore guarda chi ha il nome). Il minimo di una combinazione col nome comprende la scelta del filo: chi appunta il nome altrove può non arrivare al filo d'oro.
- (Intervento) Righe non salvate per le voci che dipendono dal filo del nome: il contratto del tombolo cerca le soluzioni precalcolate solo per insieme di bigliettini, e righe valide per un altro filo darebbero suggerimenti e autoplay sbagliati. Per la stessa ragione il test dei contenuti che rigioca le soluzioni senza `nomeOn` resta valido.
- (Intervento) Segni `voluta` sulle coppie dell'Atto III messi a mano (non ereditati dalle terne): ereditarli verso il basso nasconderebbe una coppia diventata impossibile per sbaglio quando ogni terna che la contiene è già voluta per un altro conflitto. Verso l'alto invece l'eredità è sicura (una combinazione che contiene un conflitto voluto è impossibile per forza).
- (Intervento) Le varianti dello stesso autore (g02, g03, g10: `availableIf` complementari) restano combinate come prima: non cambiano nessun numero e sono innocue.

## Problemi noti

- levels:check usa il contesto senza flag di storia: per una giornata i cui numeri dipendono da un flag (per esempio `riconciliate` dopo g18) i combinati calcolati sono quelli senza flag. Verificato: con i contenuti attuali i numeri di g19-g23 e dei finali sono identici con e senza `riconciliate`.
- `matassaSuggerita` usa il margine dell'atto da balance.json: per g13 il GDD vuole +0 (la giornata può avere matassa = minimo, levels:check lo accetta).
- Giornate grandi con pieroTrabocca: g16 dei contenuti (6×12, molti segreti) faceva 11 risoluzioni in circa 3,4 s in tutto con levels:check. Con la regola di Gino della revisione 1 lo spazio degli stati cresce (Gino ha più libertà) e i criteri di qualità aggiungono una risoluzione senza Gino per ogni configurazione: oggi g16 chiede circa 6,4 milioni di stati in tutto (circa 78 s su una macchina carica) e tutto `npm run levels:check` circa 2 minuti. Il limite per risoluzione è 1 500 000 (`--max-states`).
- `hintFor` senza `solution` (o con una che non combacia con le righe fissate) risolve in modo sincrono fino a 60000 stati: sul thread principale può bloccare fino a circa 1 s. Il tombolo deve prima ottenere la soluzione con `solveAsync` e passarla.
- Merletto libero: con 4 colonne molte regole non passano il filtro e si usa il ripiego (segnalato con `fromFallback`); certi semi a 6 colonne con la regola segreto arrivano a circa 2 s (nel Worker).

## Richieste per altri pacchetti

- **tombolo**: aggiungere a src/i18n/it|en/tombolo.json le chiavi prodotte dal motore: `engineTextKeys()` e `GEN_KEYS` (violazioni `tombolo.violazione.*`, motivi `tombolo.cond.fallita.*` e `tombolo.cond.rischio.*`, suggerimenti `tombolo.hint.*`, titoli e perline dei livelli generati `tombolo.generato.*`). I parametri `chi`, `sopra`, `sotto`, `a`, `b` sono id di fili e `luogo` è un PlaceId: tradurli in nomi prima di `i18n.t`.
- **tombolo**: creare il contesto con `createContext(level, flags, { nomeOn, occasions, balance: db.balance })`. Per i suggerimenti chiamare `solveAsync` e passare la soluzione a `hintFor`. Nell'Archivio: azzerare `usedMatassa` all'inizio dello strappo e confrontare con `sameLace`; per i suggerimenti passare `solution = computed.base.rows` (il merletto registrato). Ids `lino<N>` che non sono in `level.threads` sono lino entrati da un bordo anonimo. In fin_seppia l'anteprima della riga è `planAutoRow(level, state, ctx, mossaControllata)`.
- **campagna**: passare `balance: db.balance` a `createContext`; `memoriaAfterDay(level, timeline, memoria, { min, max })` con i valori di balance.memoria; `evaluate` per lo stato delle richieste.
- **interfaccia**: Merletto del giorno con `dailySpec(date)` + `generateAsync(spec, signal)`; Merletto libero con semi in base 36 (`[0-9a-z]`), perché lo spartito in modo L porta il seme così (`spartitoRef('L', seme)`).
- **contenuti-atto1, contenuti-atti23**: `npm run levels:check` (scrive i .computed.json); combinazioni impossibili volute con `npm run levels:check -- --voluta <livello>:<nota>+<nota>`; ora si calcolano anche le coppie dell'Atto III e basta marcare la coppia in conflitto (le terne che la contengono diventano voluta da sole). Per l'Archivio: matassa = incroci originali negli strappi; la base riportata è il rammendo più corto. (Facoltativo, contenuti-atti23) in docs/stato/contenuti-atti23.md il problema noto «g12.lunardi è segnato voluta» è risolto, e il commento del test di g12 («non con quella di Teresa, voluta») è superato: lunardi+teresa costa 5.
- **tombolo**: nell'autoplay (`controller.autoplay`) con `needsNome`, usare il `nomeOn` della voce del computed per l'insieme accettato (`perNote[id].nomeOn`, `combos[i].nomeOn`, `base.nomeOn`) se c'è, invece del primo filo non lino: in g12 con g12.lunardi il primo filo è Bepi (6 incroci invece di 2, niente filo d'oro). Le voci con `nomeOn` non hanno `rows`: `precomputed()` restituisce già null e si risolve con `solveAsync`, va bene così.

## Test

- **Revisione 1**: `npx vitest run tests/unit/engine` → 15 file, 349 test verdi. Nuovi: rules.table.test.ts (casi C01: prima riga libera, seconda ferma rifiutata con `{chi, vicino}`, vicino da sinistra e vicino bloccato, riga dopo un incrocio libera e stato a zero, vicino impegnato in un altro incrocio, febbre a inizio riga senza obbligo né accumulo, contagio e cura, ingresso dal bordo e uscita, nodo e marea che contano come fermo, nero forzato che vale, vicino nel forzato non libero, matassa finita, autotessitura); solver.test.ts (test-gino: minimo 3 e soluzioni ottime uguali alla ricerca esaustiva, febbre tutta la notte → 0, febbre spenta → 3, ripartenza da metà notte); violations.test.ts (C13); quality.test.ts (giudizio K1-K7, esenzioni, facili; levels:check su un g05 in miniatura con i valori di ogni configurazione, --facile persistente, --qualita, --max-states, colonne del rapporto, intervalli del GDD, Archivio); hints.test.ts (C15); gradi.test.ts (63 combinazioni di gradi × 200 semi, pm0ozmz). `npx tsc --noEmit -p .` → nessun errore nei file del motore. `npx tsx tools/levels/daily-fallback.ts --check` → 60 semi OK.
- `npx vitest run tests/unit/engine` → 12 file, 292 test verdi (circa 9 s). verifica.test.ts: solver contro ricerca esaustiva su 180 livelli casuali (un terzo con trabocco a 2 e nodi di 2 righe) con ogni soluzione rigiocata e valutata; regressioni su `letta:`, suggerimento al limite di stati, ripartenza con `usedMatassa` dello stato, ripiego del generatore, parametri di balance.json, Archivio in levels:check. Nuovi (intervento) in check.test.ts: livello col nome (ogni bigliettino e combinazione uguale al minimo su tutti i fili presenti, `nomeOn` giusto, niente righe; `nonHa(nina, nome)` gratis appuntando il nome su un altro; segno inutile tolto con avviso e risultato stabile alla seconda esecuzione), livello con 3 spilli (coppie e terne calcolate, coppia impossibile da marcare, terna che la contiene voluta da sola, soluzioni delle coppie rigiocate, matassa suggerita dalla coppia più cara, coppia oltre la matassa = errore anche con la terna voluta, avviso per `--voluta` sconosciuto); in register.test.ts `solve` con la regola del nome.
- `npx vitest run tests/unit/content tests/unit/engine` → 14 file, 376 test verdi; `npx vitest run` (tutto il progetto, in quel momento) → 56 file, 825 test verdi.
- `npm run levels:check` → 34 livelli OK, exit 0 (circa 8 s); una seconda esecuzione non cambia nessun file. `npm run levels:check --dir src/engine/fixtures` → 13 livelli OK, fixture invariate.
- Chromium (Playwright 1.56.1, server di sviluppo sulla porta 5215 poi chiuso), intervento: `__GAME__.engine.solve('g12', ['g12.lunardi'])` → ok, 2 incroci, `nomeOn: 'lunardi'`; con `{ nomeOn: null }` → impossibile; `computed('g18')` con le coppie. Nel tombolo: g18 con teresa+gino in autoplay → 14 incroci, `minIncroci` 14, filo d'oro (prima `minIncroci` era null); g12 con lunardi+zeno e nome su Lunardi → 3 incroci, entrambe soddisfatte, filo d'oro. Nessun errore in console.
- Fuzz più ampio fuori dai test (script nello scratchpad): oltre 15.000 livelli casuali da 3 a 6 colonne, nessuna differenza fra solver e ricerca esaustiva dopo le correzioni (prima: 3 differenze, tutte da `letta:`).
- `npx tsc --noEmit -p .` → nessun errore in tutto il progetto.
- `npm run levels:check --dir src/engine/fixtures` → 13 livelli OK, exit 0; un livello irrisolvibile → exit 1. Su src/content/levels (contenuti degli Atti II in corso, senza scrivere) il controllo gira e segnala solo combinazioni da marcare.
- `npx tsx tools/levels/daily-fallback.ts --check` → 60 semi OK.
- Chromium (Playwright 1.56.1), server di sviluppo sulla porta 5215 poi chiuso: `__GAME__.engine` presente con tutte le funzioni di ARCHITETTURA 15.1; solve g00 4 incroci e 3 ottime, g06 N1+N2 5 e N1+N3 impossibile; daily 2026-10-14; `solveAsync` e `generateAsync` girano davvero in un Worker (`solver.worker.ts?worker_file&type=module`); `AbortSignal` → AbortError; `hintFor` con la soluzione del Worker; nessun errore in console.
- Bundle del worker (esbuild, minificato): 55 KB, 20 KB gzip.
