# Stato del pacchetto: campagna

**Stato:** done

## Riepilogo

Il pacchetto `campagna` (src/campaign/, src/i18n/{it,en}/campaign.json, tests/unit/campaign/) fa girare la storia: la macchina a stati delle giornate (sera → notte → alba → bilancio → [archivio] → sera …; dopo g23 scelta → finale → titoli), le scene `sera`, `alba`, `bilancio`, `archivio`, `telaio`, `finale`, i pannelli `taccuino` e `bigliettini` (più `cp-nota` e `cp-oggetto`), il Taccuino come conoscenza, la memoria del nome, gli sblocchi del GDD 7 e il debug `__GAME__.campaign`.

### Logica pura (senza DOM, testata in Node)

- `story.ts`: `evalStory(cond, state, knowledge, o?)` per tutte le varianti di `StoryCond` (flag con uguaglianza e `gte`/`lte` numerici, `ok`/`failed`/`accepted`/`ignored`/`reply`, `event` sugli eventi dell'ultima notte con fili distinti, `knows` per stranezze/voci/desideri/regole/Archivio, `memoria`, `done`), `applyEffects(effects, state, knowledge, o?, log)` per tutti gli `Effect` (flag, voci del Taccuino che aprono e chiudono domande, desideri, stranezze, lettere, oggetti, memoria). Una domanda risolta non si riapre.
- `memoria.ts`: memoria del nome (GDD 3.11): +1 a chi tiene il nome a fine notte, −1 a chi era nel merletto senza, invariata per gli assenti, fra 0 e 3; si parte da 3, Lunardi da 1; si aggiorna solo nei livelli con la regola `nome` (da g12). Con memoria 0 il bigliettino arriva anonimo.
- `evening.ts`: bigliettini della sera (filtrati con `availableIf`, 3 per sera; nella fase `scelta` quelli di g23 con `ending`), oggetti della laguna (dopo g00 il merletto d'avorio e il Libro dei Punti; il fascio di lettere e `fascio_1..3` solo se `lettereLivia == 'liberate'`), spilli contati da `campaign.json`, Appunta / Togli spillo / Rispondi (R1, R2: effetti subito, una volta) / Lascia, l'autore da indovinare per gli anonimi, i parametri della notte (`needsNome` da g12, flag, richieste).
- `dawn.ts`: selezione dell'alba (GDD 5.9): priorità, mai lo stesso personaggio due volte di fila, niente ripetizioni negli ultimi 3 giorni salvo priorità ≥ 80, al massimo 3; candidate dal livello (`when`), dalle righe di lines.json legate agli eventi della notte e di riserva, quadro della delusione (priorità 80) per l'autore sbagliato; Ada grezza (`_grezza`) finché non ha un nome.
- `diary.ts`: voci sbloccate a ogni passaggio (fino a stabilità), pista del momento (la voce `pista` più recente con la domanda non risolta), pagine del Libro.
- `endings.ts`: carte della scelta (A, B, C, D), requisiti del finale vero con i testi di `EndingDef.missing` quando la condizione è falsa, epiloghi filtrati per `when` nell'ordine del file.
- `progress.ts`: record di eleganza, fili d'oro (una volta per livello), fusi intagliati `stile_1..4` a 3, 8, 15, 22 fili d'oro (tutti e quattro al primo finale che conta), g07 → `unlocks.daily`, g08 → `unlocks.libero` (e Ripassa), g16 → `unlocks.gradi`, finale aperto → `unlocks.tovaglia`.
- `simulate.ts`, `score.ts`: notti simulate con le soluzioni precalcolate (debug, test) e il carillon dell'intera partita (un battito per giornata chiusa).
- `flow.ts`: macchina a stati su `SaveData` (pura): `newCampaign`, `beginEvening`, `startNight`, `completeDay` (esiti, conseguenze, nuove voci, memoria, record, alba, rapporto del bilancio), `finishDawn`, `finishBilancio`, Archivio (`archiveParams`, `completeArchive`), scelta (`choose`, `finalParams`, `completeFinal`: C registra `fin_chiuso` e torna alla sera di g23 senza contare come finale; un finale con obiettivi falliti si ritenta), `rewindTo` (Riprendi da qui), `replayParams` (Rigioca), `ripassaParams` / `replayRipassaParams` (Ripassa), snapshot a ogni sera.

### Controller e scene

- `controller.ts` (`controller`, `campaign`): implementa `CampaignController` (`newGame`, `continueGame`, `resumeFrom`, `replay`, `state`, `knowledge`). Comandi della scena `sera`: `{ cmd: 'nuova', confirmed? }`, `{ cmd: 'continua' }`, `{ cmd: 'riprendi', levelId }`. Ascolta `night:complete` per le origini `campagna`, `archivio`, `telaio` (navigazione dopo 1,6 s, ridotta con la velocità delle animazioni, solo se il giocatore è ancora davanti a quel merletto), `quirk:discovered` (voce nel Taccuino e avviso). Salva subito a ogni cambio di fase; «Continua» a metà notte riprende con `resumeParams` del tombolo alla stessa riga. Musica e ambiente per fase (`sera` con seme e personaggi della giornata, `alba`, `archivio`, `finale`; laguna, notte, pioggia nell'atto II, vento e tempesta in g15).
- `SeraScene.ts`: prologo (schermo nero, stanza con la sedia vuota, il biglietto di Clotilde, «Tocca il tombolo»); sera con la porta e l'oggetto della laguna (`sfx('bottiglia')`), i bigliettini (`sfx('carta')`), il dettaglio con Appunta / Rispondi / Lascia e «Chi l'ha scritto?» per gli anonimi, il piede con Taccuino, cassapanca (Archivio), Telaio, Ripassa, «Al tombolo · spilli x/y» (conferma se restano bigliettini non decisi); scelta di g23 (carta strappata D con l'elenco di ciò che manca).
- `AlbaScene.ts` + `vignette.ts`: vignette con diorama e figurine su canvas, testo ricco, borbottio per chi parla (non per il narratore), tocco / Invio / Spazio avanza, S salta, A automatico (aspetta la fine del borbottio, al massimo 8 s per vignetta), «Salta» sempre visibile.
- `BilancioScene.ts`: richieste soddisfatte e fallite con le conseguenze, nuove voci del Taccuino, eleganza e record, filo d'oro, sblocchi, spartito, «Riascolta» (carillon).
- `ArchivioScene.ts`: la cassapanca con i rotoli dell'Archivio (nuovo, nominato, rammendato) e l'apertura della notte d'Archivio.
- `TelaioScene.ts`: la striscia delle giornate; per ciascuna Rigioca, Riprendi da qui (con conferma: torna lo snapshot, il Taccuino resta), Ripassa (dopo g08), Riascolta; epiloghi visti.
- `FinaleScene.ts`: epiloghi, titoli di coda con il carillon dell'intera partita, ritorno alla sera di g23 per il finale chiuso.
- `taccuino/panel.ts`: pannello `taccuino` con sei schede (Bigliettini dal giorno 1 o di notte con richieste; Persone; Libro; Domande con la pista «Dove guardare»; Lettere da g06 o con 5 lettere; Archivio se c'è un merletto nella cassapanca); voci nuove intere, lette in una riga; pannello `bigliettini` con lo stato dal vivo e «Lascia cadere» durante la notte. Nel layout largo il Taccuino è montato fisso accanto alla scena (`SideNotebook`), nello stretto è un overlay che si chiude con Indietro.

### `__GAME__.campaign`

`state()`, `knowledge()`, `newGame()`, `goto(levelId, phase?)` (giornate con `sera` / `notte` / `alba` / `bilancio` / `scelta`, Archivi, finali), `accept(noteIds, guesses?)`, `reply(noteId, 'R1' | 'R2')`, `toNight()`, `skipDawn()`, `finishDay()` (sera → notte → alba → bilancio → giornata dopo; di notte usa `activeNight().autoplay()`), `setFlag(k, v)`, `setMemoria(c, n)`, `learn(kind, id, state?)`, `choose(ending)`, `unlockAll()`. In più: `phase()`, `scene()`, `nav()`, `continue()`, `evening()`, `unpin(noteId)`, `leave(noteId)`, `objectSeen()`, `ripassa()`, `dawn()`, `report()`, `next()`, `cards()`, `requirements(ending?)`, `resumeFrom(levelId)`, `replay(levelId)`, `archive(levelId)`, `finale()`.

## Decisioni prese

- **Bigliettini ignorati**: sono quelli non appuntati quando si va al tombolo (anche se si è risposto); «Lascia» li segna come lasciati subito. Valgono `onIgnore`.
- **Autore sbagliato** di un anonimo: la richiesta fallisce (`onFail`) e all'alba c'è il quadro della delusione.
- **Esiti per bigliettino** nella storia (`history[levelId]`: accettati, ignorati, risposte, esiti), non come flag `ok:`/`risposta:`.
- **Memoria** prima di g12: 3 per tutti, Lunardi 1; per la scelta di g23 vale quella di fine g22.
- **`done(arcN)`** = Archivio rammendato (anche arc6 con le occasioni); **`done(fin_chiuso)`** registrato nella storia con righe vuote.
- **Nuova storia** azzera la conoscenza (Taccuino); i record, gli sblocchi e gli epiloghi visti restano.
- **Snapshot** a ogni sera (senza l'esito dell'ultima notte); Riprendi da qui ricalcola i bigliettini della sera con la conoscenza attuale e tiene epiloghi visti e soluzioni trovate.
- **Ripassa** solo con `unlocks.libero` (dopo g08) e solo se c'è già una soluzione per le stesse richieste: nella sera e nel Telaio.
- **Finale** con obiettivi falliti: si ritenta la notte (fase `scelta` invariata).
- **Velocità del testo** delle vignette: si usa la velocità delle animazioni (non c'è un'impostazione a parte).
- **Navigazione**: un solo passaggio di scena in volo verso la stessa scena (5 s), cancellato a ogni `scene:enter`.

## Problemi noti

- I fusi intagliati `stile_5` e `stile_6` (serie del Merletto del giorno) non li assegna la campagna.
- In L1 ci sono solo gli asset `fuso/stile_1` e `fuso/stile_2`: `stile_3` e `stile_4` finiscono in `unlocks.cosmetics` (GDD 7: 3, 8, 15, 22 fili d'oro) ma il titolo li mostra solo quando l'asset esiste.
- Le figurine di chi non ha un modello (Clotilde, Ernesto…) usano la figura anonima `fig/lino/<posa>`.

## Richieste per altri pacchetti

- **piattaforma-qa**: usare `__GAME__.campaign` (sopra); prima di `night.autoplay()` aspettare `night.state().active`; per le prove lunghe usare la build con `vite preview` (il server di sviluppo ricarica la pagina quando altri pacchetti cambiano file). Riferimento funzionante: `tests/unit/campaign/browser-verify.ts`.
- **interfaccia**: già allineata (Continua → `{ cmd: 'continua' }`, Nuova storia → `{ cmd: 'nuova', confirmed: true }`, Pausa → overlay `taccuino`). Restano a lei i fusi della serie del giorno.
- **tombolo**: `night:complete` arriva prima che `NightController.completed` sia impostato; la campagna lo gestisce (controlla dopo un tick), nessuna modifica necessaria.

## Test

- `npx vitest run tests/unit/campaign`: 7 file, 48 test (story, memoria, alba, flusso con i contenuti veri fino ai quattro finali, Archivio, Riprendi da qui, Ripassa, progressione e sblocchi, testi it/en, DOM con happy-dom: Taccuino fisso / overlay, schede e pista, vignette, bigliettini anonimi).
- `npx tsc --noEmit -p .`: nessun errore.
- `npx tsx tests/unit/campaign/browser-verify.ts` (build + `vite preview` sulla porta 5281, Chromium di Playwright): prologo e primo giorno giocati a mano (tocchi), ricarica in ogni fase e a metà notte, tutta la campagna fino a g23 con l'autoplay del tombolo, i finali A, B, C, D, layout largo e stretto, Archivio, Telaio (Riprendi, Rigioca, Ripassa), misure a 360×640 con il testo al 140%, nessun errore in console: 93/93 controlli superati.
