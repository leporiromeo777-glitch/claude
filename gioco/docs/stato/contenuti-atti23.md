# Stato del pacchetto: contenuti-atti23

**Stato:** done (contenuti completi, verificati con `levels:check` e test; revisione di coerenza fatta)

## Riepilogo

Atto II (g09-g16), Atto III (g17-g23), i quattro livelli finali, Archivio A3-A6, finali, Taccuino, lettere e test. Il pacchetto contiene solo JSON più il test `tests/unit/content/atto23.test.ts`. Non ho modificato `src/core/types.ts`: i tipi esistenti bastavano.

- **Livelli** (23, ognuno con il suo `.computed.json`, sourceHash aggiornato e segni `voluta`): `g09` … `g23`, `fin_merlettaia`, `fin_seppia`, `fin_chiuso`, `fin_aperto`, `arc3` … `arc6`. `npm run levels:check` è verde per tutti i 34 livelli del gioco.
- **Bigliettini**: 61 in tutto. `notes.atto2.json` ha 3-4 bigliettini per sera da g09 a g16, più due varianti che dipendono dall'Archivio (`g10.marta` / `g10.marta.senzaArchivio`, con `availableIf {done:'arc1'}`). `notes.atto3.json` ha 4 bigliettini per sera da g17 a g22 (più la variante `g18.marta` / `g18.marta.senzaArchivio` su arc3) e i 5 bigliettini della scelta di g23 (4 visibili alla volta, vedi sotto).
- **Taccuino**: 122 voci. `diary.atto2.json` e `diary.atto3.json` contengono i desideri di Teresa, Marta, Piero, Bepi, Zeno, Lunardi e Livia (Nina e Gino sono già nell'Atto I), le stranezze nuove (`lunardiCura`, `pieroTrabocca`), le persone, le domande con pista e risposta, l'Archivio, le lettere e una pagina di Ada per ogni giornata.
- **Lettere** (`lettere.atto23.json`, 15): `lettera_L8` … `lettera_L11` (sere di g10-g13; L8 e L11 sono il testo del GDD), `lettera_clotilde` (g14, GDD 6.4 alla lettera), `fascio_1` … `fascio_3` (g16, solo se `lettereLivia == 'liberate'`), `biglietto_livia_1` … `biglietto_livia_6` (g17-g22, «Sto arrivando») e `nastro_nonna` (g23).
- **Finali** (`endings.json`): `merlettaia`, `seppia`, `chiuso` (con `countsAsEnding: false`, perché riporta alla sera prima) e `aperto`. Ognuno ha 4 vignette di epilogo; `aperto` ha i requisiti del GDD 6.6 e la lista `missing`.
- **Testi** italiani in `text/it/atto2.json` (283 testi, 5.020 parole), `text/it/atto3.json` (225, 3.388) e `text/it/finali.json` (62, 600). In tutto **9.008 parole** italiane, dentro l'intervallo atteso di 9.000-12.000. Righe di vignetta ≤ 90 caratteri, bigliettini ≤ 220. I testi inglesi non ci sono, come per l'Atto I (vedi Problemi noti).

### Giornate

«Base» è il minimo di incroci con i soli obiettivi del livello. «Designato» è il minimo con la combinazione di bigliettini da cui si calcola la matassa. La matassa è il designato più il margine dell'atto (+2 nell'Atto II, +1 nell'Atto III), come suggerisce `levels:check`. Fa eccezione g13, dove la matassa è esattamente il designato (GDD: margine 0).

| Giornata | Ore | Base | Designato | Matassa | Min GDD | Conflitto voluto (spilli: II = 2, III = 3) |
|---|---|---|---|---|---|---|
| g09 Il farmacista | 6→14 | 11 | 13 | 15 | 5-7 | g09.teresa + g09.nina |
| g10 La settimana della febbre | 6→16 | 10 | 13 | 15 | 7-9 | g10.lunardi + g10.bepi |
| g11 Il nodo | 6→16 | 10 | 11 | 13 | 7-9 | g11.teresa + g11.marta |
| g12 Il nome | 6→16 | 1 | 6 | 8 | 7-9 | g12.bepi + g12.teresa (g12.lunardi segnato `voluta` in check, vedi Problemi noti) |
| g13 La notte più lunga | 6→20 | 14 | 20 | **20** | 10-12 | nessuno: le 4 cure insieme costano esattamente 20 (merletto perfetto) |
| g14 La lettera di Zeno | 6→16 | 10 | 13 | 15 | 8-10 | g14.nina + g14.gino |
| g15 La tempesta | 6→20 | 14 | 15 | 17 | 9-11 | g15.nina + g15.gino |
| g16 Il pozzo trabocca | 6→18 | 12 | 13 | 15 | 9-11 | g16.zeno + g16.marta, g16.piero + g16.marta |
| g17 Il filo nero | 6→16 | 9 | 12 | 13 | 7-9 | ogni terna con g17.teresa + g17.piero, e zeno + marta + piero |
| g18 La pace | 6→16 | 11 | 12 | 13 | 8-10 | la terna teresa + gino + lunardi |
| g19 Acqua alta | 6→16 | 0 | 9 | 10 | 8-10 | g19.bepi + g19.nina |
| g20 Nina | 6→14 | 8 | 12 | 13 | 7-9 | g20.nina + g20.teresa |
| g21 Il punto aperto | 6→18 | 10 | 11 | 12 | 9-11 | g21.gino + g21.marta |
| g22 La secca | 6→20 | 9 | 17 | 18 | 10-12 | g22.zeno + g22.teresa |
| g23 La vigilia | 6→12 | 4 | 4 | 5 | 4-6 | — (obiettivi del mattino; la sera, la scelta) |

### Finali giocabili e Archivio

| Livello | Forma | Matassa | Note |
|---|---|---|---|
| `fin_merlettaia` | 6 col / 6→18 | 5 | `almeno(4, incontra(livia, X))` + `parte(livia, 18)`, vaporetto delle 18 |
| `fin_seppia` | 6 col / 6→18, `autoweave` controllato `ada` | 10 | Ada ha un filo; occasioni fisse (pane al Forno 8, messa 11, festa in Piazza 16); `base.rows` presente |
| `fin_chiuso` | 6 col / 6→9 | 4 | `presso(livia, molo, 9)`: il punto di Clotilde ripetuto |
| `fin_aperto` | 6 col / 6→20, `autoweave` | 0 | 12 occasioni permesse, 5 slot, 9 obiettivi (i desideri più Ada-Livia); 15 insiemi validi; `occasionsSolution` presente e `occasionsSolutions` fra 1 e 20 |
| `arc3` 1958 | 6→11, buco 9-10 | 2 | esca Lunardi, chiude `anno1958` |
| `arc4` 1951 | 5→10, buco 7-8 | 2 | vaporetto alle 9, valigia Zeno→Livia, lettera per Ada; esca Ernesto, chiude `madre` |
| `arc5` 1630 | 6→11, buco 8-9 | 3 | fili per mestiere (`labelKey`), barca nera alle 10; solo Arianna sbiadita; esca Clotilde |
| `arc6` senza data | 4 col / 6→12 | 0 | si rammenda con le occasioni (2 slot, 8 permesse); `occasionsSolution` presente; esca Ada |

## API e convenzioni per gli altri pacchetti

- **Flag di storia** impostati dai bigliettini: `lettereLivia` (`'liberate'` / `'sepolte'`, g16.zeno), `riconciliate` (true, g18.teresa), `zenoLivia` (true/false, g22.zeno), `nina` (`'parte'` / `'resta'`, g20.nina), `bepi` (`'salvo'` / `'ferito'`, g15.nina, anche su `onIgnore`), `lunardiChiamato` (`'Ettore'`, g13.lunardi R2), `febbreCurati` (contatore, g13). Altri flag solo per le vignette: `martaLunardi`, `teresaDottore`, `ninaFebbre`, `martaForno`, `martaPromessa`, `bepiDottore`, `primoNodo`, `martaPerche`, `martaLargo`, `bepiDebito`, `teresaLettera`, `ginoFaro`, `ginoTempesta`, `teresaPromessa`, `teresaSa`, `martaAscolta`, `ninaVenezia`, `martaLanterna`, `teresaLivia`.
- **Domande del Taccuino** chiuse qui: `anno1958` (arc3), `madre` (arc4), `pozzo` (g16), `martaTeresa` (g18), `filoNero` (g17), `puntoAperto` (arc6), `desideri` (tutti gli 8 desideri), `chiL` e `avorio` (g14).
- **Desideri**: voci `desiderio.<id>` per teresa, marta, piero, bepi, zeno, lunardi, livia; si sbloccano con `{knows:'desire', id}`. Le risposte che li rivelano sono segnate nei bigliettini (`desire` su R1/R2 o su `onOk`).
- **Scelta di g23**: `g23.zeno` (merlettaia, `availableIf memoria zeno ≥ 1`), `g23.piero` (stesso testo, se Zeno ha dimenticato Ada), `g23.livia` (seppia), `g23.clotilde` (chiuso), `g23.ada` (aperto). I testi sono quelli del GDD 6.6. Ogni sera se ne vedono quattro, con finali A, B, C, D.
- **Finale vero**: `endings.json` › `aperto.requires` = `lettereLivia == 'liberate'` e `riconciliate == true` e gli 8 desideri del cast noti e almeno 4 persone con `memoria ≥ 1` (le 70 combinazioni da 4 scritte esplicitamente). `missing` ha una voce per requisito, con il testo da mostrare quando la condizione è falsa.

## Decisioni

- **Varianti d'Archivio.** g10 e g18 hanno due versioni del bigliettino di Marta, scelte con `availableIf {done:'arc1'}` e `{done:'arc3'}`. Chi ha rammendato l'Archivio legge la versione che porta al desiderio.
- **g13 senza conflitto.** Le quattro richieste di cura sono compatibili, ma solo con il merletto perfetto: matassa 20 = minimo con tutte e quattro. Così la «notte più lunga» premia chi non sceglie, come la nonna non fece nel 1958.
- **g16, carico del pozzo.** I tre segreti arrivano da Nina, da Marta e dalla confessione di Piero; Gino non porta segreti, perché il suo filo che attraversa tutto faceva esplodere gli stati. Spilli in più su Marta e Zeno. `levels:check` impiega circa 3 secondi.
- **Nero.** g17: Livia entra dal Faro alle 9 e segue Zeno, poi va in Piazza alle 15; lo spillo di Piero è alle 7 perché alle 11 il nero lo rendeva impossibile. g21: il nero entra dal Faro alle 8 e cerca Piero, poi Zeno.
- **g09.** La Farmacia apre alle 13 (spillo d'ottone di Lunardi), non alle 10 come nel GDD: alle 10 con `ginoCorre` e il forno di Marta la giornata non aveva soluzione.
- **g10.** Fra i fili c'è Don Piero al posto di Teresa: serve per la richiesta del GDD «messa delle 11 con i sani» (`nonHa(piero, febbre)` + spillo in chiesa alle 11). Bepi ha un quarto bigliettino (`nonIncontra(lunardi, bepi)`).
- **g12.** La richiesta di Zeno «nessuno al Faro dopo le 15» diventa `presso(zeno, faro, 15)` e `presso(zeno, faro, 16)`: una colonna tiene un filo solo, quindi è equivalente. Nina rientra col vaporetto delle 9, per dare senso al debito di Bepi.
- **g21.** Il Gino vuole la lanterna alle 18 e non alle 20, perché la giornata del GDD finisce alle 18.
- **g23.** Le due richieste del mattino sono obiettivi del livello (Livia incontra Piero prima delle 11, poi Marta). La giornata non ha la regola `nome`: è la vigilia, la memoria si congela alla fine di g22.
- **Minimi sopra il GDD.** Con `ginoCorre`, ogni giornata con Gino costa almeno una riga per ogni ora in cui Gino è nel merletto: g09-g11, g13-g16 e g18 superano l'intervallo «Min» del GDD 5.2, come già nell'Atto I. g12 e g19 stanno sotto, perché lì il costo è nei bigliettini (nome, marea) e non negli obiettivi.
- **Testi del GDD alla lettera**: lettera di Clotilde (6.4), le battute di Zeno alla sera di g14, L8 e L11, i bigliettini della scelta (6.6), il margine di arc5 («Chi tesse non è tessuto.» / «Lo so.»), «Trent'anni, Teresa.» «Trenta.» in g18. Il test li confronta con il GDD.

## Revisione di coerenza con la bibbia (GDD 2 e 6)

Punti controllati, con le correzioni fatte:

1. **Cronologia.** Il presente è autunno 1965 - primavera 1966. Livia parte nel 1951 con Ada di due anni: «quattordici anni» in tutti i testi; Ada compie sedici anni (L8); il fascio ha lettere a due anni e mezzo, nove (1958, la febbre) e quindici anni; 168 lettere = 14 × 12, «tre leggibili e altre centosessantacinque».
2. **Marta e Teresa.** Il rancore nasce nel 1936 (Ernesto, Don Anselmo): «ventidue anni» in arc3 (1958), «trenta» nel presente, come nel GDD.
3. **Aldo.** Fidanzato di Teresa, morto nella febbre del 1958; voleva portarla in terraferma l'estate dopo. Il fazzoletto per il viaggio mai fatto era «trent'anni» nel cassetto: corretto in «sette anni» (1959-1966).
4. **Bepi.** È vedovo (g04, la candela per la moglie). In g20 dà alla Nina l'anello della madre. Prima era un fazzoletto, che però doppiava quello di Teresa nella stessa alba: l'ho cambiato e ho corretto anche il soggetto («Lo tenevo»).
5. **Livia dimenticata.** L'isola non la riconosce: Marta no (g17, g22), Teresa no (g22, «non me la ricordo per niente»). Zeno e Don Piero sì, perché custodiscono qualcosa di suo. Nessun testo fa ricordare Livia a chi non la custodisce.
6. **Il nero di seppia** non si vede sul velluto blu ma sul merletto sì (fascio_3, risposta `filoNero`); la bottiglia di g15 contiene solo un nodo, senza testo (GDD 6.5).
7. **Clotilde.** Firma «C.», grafia color seppia dei margini; i margini sono quelli del GDD per arc3-arc6 («Uno per sei…», «Non ancora.», «Lo so.», «Non ho avuto il coraggio.»). Il nastro d'avorio è il filo avanzato e serve al finale vero.
8. **Ada narratrice.** Ada non riferisce cose che non può sapere. In g11 la riga «Lo dice il Libro, a margine» attribuiva al Libro una frase che non c'è: ora è «Lo diceva la nonna».
9. **Personaggi.** Lunardi viene da Padova e si chiama Ettore; Bepi non apre al dottore; la Nina va all'Istituto magistrale di Venezia e porta Leopardi; il Gino vuole la campana e la lanterna di Zeno (promesse dell'Atto I); Don Piero «Fiat voluntas», il pozzo trabocca a tre segreti.
10. **Orari e luoghi.** Vaporetto delle nove (g20, arc4, fin_chiuso), secca alle tre dal lato del Faro (g22, biglietto_livia_5), marea 10-13 su Molo e Piazza (g19, e il biglietto di Livia «tre ore sul Molo»), lanterna alla fine della giornata (g21).
11. **Ortografia dei bigliettini.** Bepi e il Gino scrivono in minuscolo e senza punteggiatura, ma senza errori: ho corretto «tropo» e «stamatina».
12. **Finale chiuso.** Riporta alla sera prima, con il biglietto della nonna «ancora lì, piegato in quattro»; non conta come finale (`countsAsEnding: false`).

## Problemi noti

- **Testi inglesi assenti** per atto2, atto3 e finali, come per atto1: il gioco ricade sull'italiano. Le chiavi esistono tutte in italiano (lo verifica il test).
- **g12.lunardi è segnato `voluta` in `levels:check`.** Il check usa `nomeOn: null`, quindi `ha(lunardi, nome)` vi risulta impossibile. Nel gioco è risolvibile: il test la verifica con `nomeOn` su Lunardi e su Marta.
- **g18**: l'unico conflitto è la terna completa. Le coppie sono tutte compatibili, ma con 3 spilli il giocatore deve comunque rinunciare a una richiesta.
- **g16**: `levels:check` impiega circa 3 secondi (354.610 stati).
- **Parole**: 9.008, appena sopra la soglia di 9.000.
- **arc6** dà l'avviso del check «recorded lace not replayed»: è previsto, perché si rammenda con le occasioni.

## Richieste per altri pacchetti

- **motore**: `levels:check` dovrebbe provare le scelte di `nomeOn` nei livelli con la regola `nome` (così g12.lunardi non avrebbe bisogno di `voluta`) e potrebbe fare un secondo passaggio sul costo. `SOLVER_VERSION` e l'hash di sorgente vanno lasciati compatibili con i `.computed.json` committati.
- **campagna**:
  - la memoria per la scelta di g23 è quella alla fine di g22 (g23 e i finali non hanno la regola `nome`);
  - `done(arcN)` deve essere vero quando l'Archivio è rammendato, e `done('fin_chiuso')` va registrato;
  - le lettere `fascio_*` e l'oggetto `fascio_lettere` compaiono solo se `lettereLivia == 'liberate'`;
  - per `EndingDef.missing`, la `cond` è il requisito e il testo va mostrato quando è falsa;
  - i bigliettini di g23 vanno mostrati nella fase `scelta` dopo la notte di g23, filtrati con `availableIf` (memoria di Zeno);
  - le varianti di g10 e g18 vanno scelte con `availableIf {done: arcN}`.
- **tombolo**: mostrare gli obiettivi `parte(bepi, 9)` (g12) e `resta(zeno)` (g17). In arc6 il rammendo si fa con le occasioni e i buchi coprono tutta la giornata.
- **contenuti-atto1**: niente di bloccante.

## Test

- `npx vitest run tests/unit/content/`: 75 test superati (41 in `atto23.test.ts`, 34 in `atto1.test.ts`).
- `npx vitest run`: 50 file, 734 test superati.
- `npx tsx tools/levels/check.ts --no-write`: «34 levels OK». I miei 23 livelli sono tutti `ok`; l'unico avviso è quello previsto di arc6.
- `npx tsc --noEmit`: nessun errore nei miei file. L'unico errore del progetto è in `tests/unit/tombolo/browser-verify.ts`, che non è mio.

`atto23.test.ts` verifica:

- la validazione dei contenuti senza errori e le chiavi di testo tutte presenti in italiano;
- le lunghezze (righe ≤ 90 caratteri, bigliettini ≤ 220) e il conteggio delle parole;
- 3-4 bigliettini per sera da g09 a g22 e 4 in g23, con i finali A, B, C, D. Lo fa con un piccolo valutatore di condizioni su due stati di gioco;
- le vignette dell'alba (3-5, con le condizioni sui flag) e i conflitti `voluta`;
- le stranezze del giorno, g12 risolvibile con `nomeOn`, i destini (Bepi, Nina, lettere, Zeno);
- i desideri (8 più Livia, ognuno con la sua voce di Taccuino sbloccabile), le domande e le lettere;
- i requisiti del finale vero, esattamente quelli del GDD 6.6 su tutte le 256 combinazioni di memoria, insieme ai finali e all'Archivio;
- i sourceHash dei `.computed.json`, i margini di matassa, g13 a merletto perfetto e il replay delle soluzioni;
- gli eventi del GDD, le citazioni della bibbia e gli anni (1630, 1951, 1958).
