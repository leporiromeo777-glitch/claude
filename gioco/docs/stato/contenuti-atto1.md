# Stato del pacchetto: contenuti-atto1

**Stato:** done

## Riepilogo

Dati comuni, Prologo, Atto I (g00-g08) e Archivio A1-A2, solo JSON più il test `tests/unit/content/atto1.test.ts`.

- **Dati comuni** (committati per primi): `characters.json` (16 personaggi con colore, motivo, icona, nota, voce, calligrafia, stranezze, desiderio, gusti; i 5 solo d'Archivio con `archiveOnly`), `places.json`, `book.json` (14 pagine del Libro dei Punti, sblocchi anche per gli Atti II-III), `balance.json` (GDD 3.13), `campaign.json` (g00-g23, finali, giornata della scelta, spilli, `archiveAfter`, `objectAfter`, stonatura 1 / 0,6 / 0,25), `lines.json` (162 battute), `credits.json` (autore segnaposto). Testi in `text/it/comune.json` e `text/en/comune.json` (inglese completo).
- **Livelli** g00-g08, arc1, arc2 con i `.computed.json` (sourceHash aggiornato, `npm run levels:check` verde per tutti e 11).
- **Bigliettini** (`notes.atto1.json`): 24, tre per sera da g01 a g08 con testi e condizioni dell'Appendice A, una risposta per sera, conseguenze (flag, Taccuino, desideri).
- **Taccuino** (`diary.atto1.json`): 72 voci (stranezze, regole dell'Atto I con le parole di Ada, persone, desideri di Nina e Gino, domande con piste, lettere, Archivio).
- **Lettere di L.** (`lettere.atto1.json`): `lettera_L1` … `lettera_L7` per le sere di g01, g02, g03, g04, g06, g07, g08 (1 e 4 sono gli esempi del GDD 6.5).
- **Testi** italiani dell'Atto I in `text/it/atto1.json`. Parole italiane: comune 2.798 + atto1 3.392 = **6.190**.

| Giornata | Colonne / ore | Min designato | Matassa | Conflitto voluto |
|---|---|---|---|---|
| g00 | F P C / 5→9 | 4 | 6 | — (prologo, obiettivo obbligatorio) |
| g01 | M F P C / 6→11 | 6 | 9 | g01.piero + g01.gino |
| g02 | M F P C / 6→12 | 7 | 10 | g02.marta + g02.gino |
| g03 | M F P C / 6→12 | 5 | 8 | g03.nina + g03.marta |
| g04 | M F P C A / 6→14 | 5 | 8 | g04.bepi + g04.piero |
| g05 | 6 col / 6→13 | 8 | 11 | g05.zeno + g05.marta |
| g06 | 6 col / 6→12 | 5 | 8 | g06.nina + g06.zeno (GDD 3.16) |
| g07 | 6 col / 6→14 | 9 | 12 | g07.teresa + g07.nina |
| g08 | 6 col / 6→16 | 12 | 15 | g08.marta + g08.nina |

Archivio: arc1 (1936, 5 colonne, 8→12, strappo 10-11, matassa 4) e arc2 (la notte scorsa, 0→5, strappo 1-2, matassa 2): merletto registrato completo, 4 fili sbiaditi, candidati con esca (Clotilde, Livia), echi su ogni incrocio, nota a margine, vignetta di rivelazione, domande chiuse (`martaTeresa`, `avorio`).

## Convenzioni dei dati comuni (per contenuti-atti23, campagna, interfaccia)

- `characters.json`: chiavi `comune.pers.<id>.nome|nomeCompleto|ruolo|desiderio|presentazione`.
- `places.json`: chiavi `comune.luogo.<id>.nome|breve|descrizione`; `diorama` = `dio/<id>` (la luce si aggiunge: `dio/<id>/<alba|giorno|notte>`). C'è anche `comune.luogo.stanza.*` per la stanza di Ada (non è un PlaceId).
- Etichette dei fili di lino riusabili da tutti i livelli: `comune.fili.<lino|passante|marinaio|pescatore|barcaiolo|comare|garzone|forestiero|avorio|sbiadito>`.
- `campaign.json`: `pins` 0 / 2 (Atti I-II) / 3 (Atto III) / 1 (g23, la scelta); `archiveAfter` arc1 g03, arc2 g07, arc3 g11, arc4 g14, arc5 g18, arc6 g20.
- **Oggetti della sera** (`objectAfter`): se l'id coincide con l'id di una `LetterDef`, l'oggetto è quella lettera. Id: `lettera_L1` … `lettera_L11` (L8-L11 in `lettere.atto23.json`, `arrivesAfter` g10, g11, g12, g13), `lettera_clotilde` (g14, firmata `C.`), `biglietto_livia_1` … `biglietto_livia_6` (g17-g22, firmati `L.`). Gli altri oggetti hanno i testi in `comune.oggetti.<id>.nome|descrizione`: `merletto_avorio`, `libro_punti`, `bottiglia`, `fuso_faro`, `pagina_strappata`, `bottiglia_nodo_nero`, `fascio_lettere`, `nastro_nonna`.
- **Domande del Taccuino** (`QuestionId`, GDD 5.8), testo in `comune.domande.<id>.titolo`: `avorio`, `martaTeresa`, `chiL`, `filoNero`, `pozzo`, `anno1958`, `madre`, `puntoAperto`, `desideri`. L'Atto I apre `avorio`, `martaTeresa`, `chiL`, `filoNero`, `pozzo`, `desideri` e chiude `avorio` (arc2) e `martaTeresa` (arc1). `madre`, `anno1958`, `puntoAperto` restano agli Atti II-III.
- **Voci del Taccuino**: id con il prefisso della sezione (`persone.`, `libro.`, `domande.`, `lettere.`, `archivio.`) più `desiderio.<personaggio>` (sezione `persone`, sblocco `{ knows: 'desire', id }`); testi in `atto1.diario.<id>`. Le voci che si sbloccano con un Archivio usano `{ done: 'arcN' }` e sono anche nel suo `archive.unlocks`.
- `book.json`: id `incrocio, spillo, sopraDa, voce, matassa, molo, segreto, pozzo, febbre, nodo, nome, nero, marea, puntoAperto`. La pagina `pozzo` usa `rule: 'segreto'` (il pozzo non è una RuleId). Le note a margine delle pagine `nome` e `nero` sono di Ada (a matita), le altre di Clotilde. Sblocco `{ any: [ { knows: 'rule', id }, { done: <giornata precedente> } ] }`.
- `lines.json`: 9 personaggi parlanti (gli 8 del cast + Livia) × 7 eventi × 2 + 4 di riserva = 162. Eventi del GDD 5.9 → `LaceEventKind`: incontro → `incontro`, consegna → `consegna`, voce → `copia`, segreto letto → `legge`, rifiuto → `stranezza`, nodo → `nodo`, cura → `cura`; più `riserva`. Chiavi `comune.battute.<pers>.<evento>.<n>`, variante per chi ha dimenticato Ada `…<n>d` (`forgetKey`).
- Chiavi dei livelli dell'Atto I: `atto1.<giorno>.titolo|perline.*|alba.<nome>[2]|hint.spinta|hint.indizio|margine.*`, bigliettini `atto1.<giorno>.<autore>.testo|r1|r2`, Archivio `atto1.arcN.eco.*|margine|rivela.1|rivela.2`.
- Titoli degli atti: `comune.atti.<0-3>.titolo|sottotitolo`. Crediti: `comune.crediti.*`.

## Decisioni prese

- g00 ha la meccanica identica ad ARCHITETTURA 14.1 (verificata: minimo 4, matassa 6). Aggiunte solo le altre due vignette del GDD 9 (Teresa consegna, Don Piero legge), il suggerimento `indizio` e due passi `pulsa` (Disfa alle 8, Taccuino alle 9).
- g06 è l'esempio del GDD 3.16 alla lettera: N1 5, N1+N2 5, N2+N3 0, N1+N3 impossibile e voluta, matassa 8.
- Con `ginoCorre` il minimo di una giornata con Gino è almeno il numero di righe: g01 6, g02 7, g07 9, g08 12 superano di 1-2 l'intervallo «Min» del GDD 5.2 (che non può valere con Gino sempre in campo). Matassa sempre = minimo designato + 3.
- g04: la barca di Bepi rientra alle **11** invece che alle 13: la richiesta dell'Appendice A `presso(bepi, chiesa, 14)` dal Molo alle 13 sarebbe impossibile (tre colonne in una riga). L'uscita di Bepi alle 7 è un obiettivo obbligatorio `parte(bepi, 7)`: uno spillo non basta, perché gli spilli si controllano dopo i bordi (GDD 3.4) e Bepi a quell'ora è già fuori.
- g08: i 6 fili con nome occupano le 6 colonne, quindi il vaporetto delle 9 porta sempre via qualcuno. Con Nina in Piazza alle 10 e Don Piero in Chiesa alle 11, la domanda d'iscrizione può partire solo con il Gino o con Marta: è il conflitto con la richiesta di Marta. Il destinatario della domanda è un filo di lino `segreteria` che non entra mai nel merletto.
- I fili sbiaditi dell'Archivio hanno id neutri (`f1` … `f4`) con il `character` della risposta; il padre di Marta (arc1) è un filo con nome senza CharacterId (`labelKey`).
- Per gli effetti delle risposte si usano flag leggibili (`teresaFredda`, `ninaDillo`, `bepiSaVenezia`, `ginoFaro`, `ninaEsame`…), e le vignette dell'alba li leggono con `{ reply }`, `{ ok }`, `{ failed }`, `{ accepted }`.
- Le vignette di sola narrazione hanno 0 figure (la figurina `lino` non è un CharacterId).
- Nota di Gino: 659,25 Hz, come la tabella del pacchetto audio.

## Problemi noti

- La storia dell'Atto I in inglese (`text/en/atto1.json`, livello L2) non c'è: in inglese l'Atto I ripiega sull'italiano. Il namespace `comune` invece è completo in inglese.
- `book.json` non ha i `demo` (facoltativi): il disegno animato della pagina va generato dal codice.

## Richieste per altri pacchetti

- **tombolo**: g04 ha un obiettivo obbligatorio (`goals: parte(bepi, 7)`), da mostrare come quello del prologo. In g08 il filo `segreteria` esiste solo come destinatario e non entra mai. Tutorial: g00 aggiunge `pulsa disfa` (8) e `pulsa taccuino` (9); g01 usa `margine` con `when: 'rifiuto'` (Gino non sta fermo); g02 `margine` con `when: 'primaOra'`.
- **campagna**: vedi le convenzioni sopra (oggetti = id delle lettere, domande, desideri, voci d'Archivio con `{ done: 'arcN' }`). Le note a margine delle pagine `nome` e `nero` del Libro vanno scritte con la mano di Ada.
- **contenuti-atti23**: usare gli id e le chiavi comuni sopra; per le lettere 8-11 usare `lettera_L8` … `lettera_L11`; per chiudere le domande aperte dall'Atto I usare gli stessi `QuestionId`.

## Test

- `npx vitest run tests/unit/content/atto1.test.ts` → 28 test verdi (validazione senza errori sui file del pacchetto, chiavi italiane, inglese di `comune` completo, 3 bigliettini e una risposta per sera, 3-5 vignette, conflitto voluto per sera, tutorial, righe ≤ 90 e bigliettini ≤ 220, 162 battute, 14 pagine, 24 giornate, lettere, Taccuino, sourceHash, g00 = 4, g06 come GDD 3.16, matassa = designato + 3, soluzioni riprovate col motore, Archivio).
- `npm run levels:check` → g00-g08, arc1, arc2 tutti ✓ (i livelli degli Atti II-III sono di un altro pacchetto).
- `npx tsc --noEmit -p .` → nessun errore.
- `npx vitest run tests/unit/audio tests/unit/content tests/unit/core` → 36 file, 390 test verdi.
