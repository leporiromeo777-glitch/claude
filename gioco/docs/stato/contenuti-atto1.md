# Stato del pacchetto: contenuti-atto1

**Stato:** done (verificato e corretto; revisioni 1 e 2 fatte, vedi sotto)

## Revisione 2

Gruppo **schermi-atto1** della revisione 2 (docs/REVISIONE-2.md): i contenuti dell'Atto I e i comuni, più R2-D7. Le schermate, il core e l'audio sono in interfaccia.md, fondamenta.md e audio.md (sezioni «Revisione 2»).

**Accettazione:**
- `npm run levels:check -- --qualita` esce con **0** su tutte le 34 notti: nessuna violazione C14 e nessun avviso K7, perché la colonna «Min» del GDD ora è quella misurata.
- `npx vitest run tests/unit/content/atto1.test.ts tests/unit/content/en.test.ts` è verde: 80 test in atto1, compresi quelli nuovi della revisione 2.

| Task | Esito | Commit | Cosa |
|---|---|---|---|
| Q009 bigliettino lasciato senza conseguenze | fatto | 3598d20 | Tutti i 26 bigliettini dell'Atto I hanno `esito.lasciato` (it/en, al massimo 140 caratteri), quindi ogni bigliettino lasciato ha la sua riga nel bilancio (regola della campagna in `flow.ts`). Ogni riga racconta come reagisce chi l'ha scritto al bigliettino rimasto senza spillo, mai un fatto del merletto che lasciarlo non controlla. Esempio, g01.piero: «Lui non ha chiesto niente: ha aspettato la posta, come si aspetta la pioggia.» |
| Q005 nota della matassa | fatto (parte dei contenuti) | 3598d20 | «Il gomitolo conta il filo usato: ogni incrocio costa un braccio.» (en «The skein counts the thread used…»), come l'HUD |
| Q065 coerenza (g01, g05) | fatto (parte dell'Atto I) | 3598d20 | **g01**: la campana delle undici è quella della messa, e Don Piero arriva di corsa dalla Piazza, dove lo appunta lo spillo delle 11 (alba e Taccuino, it/en). Spillo e conflitto voluto piero+gino restano: spostare lo spillo rendeva impossibile la posta di Don Piero o il conflitto. **g05**: il Gino la lanterna «me l'ha detto tre volte, ogni volta più forte» (non l'ha scritto) |
| Q074 spoiler nel desiderio di Zeno | fatto | 3598d20 | `comune.pers.zeno.desiderio`: «Chiedere perdono a una persona, prima che sia tardi.» (en «To ask someone's forgiveness, before it is too late.»). Si sblocca la sera di g14, prima della lettera di Clotilde, e non nomina Livia |
| Q018 + R2-D7 Atto I più impegnativo, regola di Gino che pesa | fatto | 2740d8f | g04, g06, g07, g08 ridisegnate (sotto); g05 era già a posto; g00-g02 non toccate |
| Q077 colonna «Min» di GDD 5.2 | fatto | 2740d8f | Valori misurati per g04 (10), g06 (10), g07 (10), g08 (14), g09 (10), g10 (17), g11 (11), g12 (14), g13 (19), g14 (16), g15 (19), g16 (17), g18 (12), g20 (11), g22 (19), g23 (9). Le altre stavano già nell'intervallo ±1. g04: la barca «esce alle 8, rientra alle 11» |
| Q048 (parte comune) | fatto | ba0360b | `comune.oggetti.fascio_lettere.descrizione` non ripete più «una al mese per quattordici anni» dell'alba e del Taccuino di g16 (lo segnalava il test R2-D3 di contenuti-atti23) |

### R2-D7: come si misura «richiede di pensare»

Il criterio di REVISIONE-2 («almeno il 30% di soluzioni non ottime tra quelle brevi») preso alla lettera non distingue niente. Fra tutti i percorsi entro il minimo + 2, quelli non ottimi sono sempre oltre l'85% in ogni notte, perché un incrocio in più si può aggiungere in molti modi. Eppure il giocatore del playtest trovava sempre il minimo.

**Interpretazione** (la più semplice che distingue; codice in `tests/unit/content/viaBreve.ts`):
- le «soluzioni brevi» sono quelle di chi a ogni ora fa il minor numero di incroci che lascia la notte ancora risolvibile entro la matassa (la **via breve**);
- chi gioca così sa che cosa è ancora possibile, ma rimanda ogni incrocio finché può;
- a parità si contano tutte le scelte, con i versi contati solo quando contano, come fa `countOptimal`;
- una combinazione «richiede di pensare» se almeno il 30% dei percorsi della via breve finisce sopra il minimo, cioè se per arrivare al minimo bisogna pensare all'ordine delle cose.

**Prima della revisione:**
- g04, g06 e g08 erano a 0% in tutte le combinazioni: la via breve trovava sempre il minimo;
- g05 era all'83% e al 75%, g07 al 70%;
- la regola di Gino non alzava il minimo di nessuna combinazione possibile di g05 e g07.

| Notte | Cosa cambia | Designata (min) | Matassa | Via breve (combinazioni possibili) | Regola di Gino |
|---|---|---|---|---|---|
| g04 | Teresa porta anche **la lettera per Don Piero entro le due** (obiettivo fisso, nuova perlina `L_piero`, etichetta it/en); ordine iniziale e spilli uguali | nina+piero 10 | 13 | nina+bepi **50%**, nina+piero 0% | — (niente Gino) |
| g05 | invariata | zeno+teresa 8 | 11 | zeno+teresa **83%**, marta+teresa **75%** | non pesa (8 = 8) |
| g06 | tolto lo spillo della Nina in Piazza alle 12 (resta Teresa al Forno alle 11): la lettera da Venezia ha più strade. La Nina costa 1 ed è la facile della sera, dentro il conflitto voluto con Zeno | marta+zeno 10 | 13 | nina+marta **50%**, marta+zeno 0% | — |
| g07 | il Gino parte accanto a Teresa (nina, marta, **gino, teresa**, piero, zeno) e Marta torna al Forno alle 12 (spillo nuovo). Nessuna facile: tutti e tre i bigliettini costano 2 | teresa+zeno 10 | 13 | nina+zeno **75%**, teresa+zeno 0% | **pesa**: +2 in teresa+zeno e nina+zeno (10 contro 8), +2 nella base |
| g08 | la Nina passa dalla **Farmacia alle 10**; il Gino va al **Faro alle 13** (prima Farmacia alle 14 e Faro alle 16); restano Marta al Forno alle 7 e alle 15 e la Nina in Chiesa alle 12 | marta+zeno 14 | 17 | nina+zeno **80%**, marta+zeno 0% | pesa: +4 in marta+zeno, +3 in nina+zeno (entro K3) |

**La regola di Gino in g07** (Q018).
- Il Gino non può stare fermo due ore. Nella soluzione registrata di nina+zeno la sua corsa porta la confessione: la riceve da Teresa alle 10, la passa a Marta alle 11 e a Don Piero alle 12, e alle 13 la Nina, curiosa, la prende da Marta.
- In teresa+zeno la stessa corsa va fatta senza che il Gino riceva mai il peso di Teresa.
- È il vincolo che Q018 chiedeva: «farlo ballare senza rovinare una consegna».

**Misure C14 dopo il ridisegno.**
- Nessuna violazione con `--qualita`.
- Soluzioni ottime della designata: g04 16, g06 1, g07 16, g08 2.
- Conflitti voluti invariati: bepi+piero, nina+zeno, teresa+nina, marta+nina.
- Facili: g05.marta e g06.nina; g07.nina non è più facile.

**Nel browser** (build `VITE_E2E=1` sulla porta 6060, 390×844 touch, it). Sera, poi bigliettini appuntati, poi notte nel tombolo vero (`night.autoplay`), poi alba. Le 8 combinazioni possibili di g04, g06, g07 e g08 finiscono con tutte e due le richieste soddisfatte al minimo:
- g04: 10 e 9;
- g06: 10 e 7;
- g07: 10 e 10;
- g08: 14 e 11.

HUD della matassa: 13, 13, 13 e 17. Nessun errore in console. Ho guardato gli screenshot delle notti (spilli nuovi di g08).

### Decisioni

- **Lettera di Don Piero in g04.** È un obiettivo fisso, come la partenza della barca. È la sola aggiunta alla storia della notte: Teresa è la postina. Non cambia il cast né le intenzioni dei bigliettini.
- **g08: la Nina alla Farmacia alle 10.** La Farmacia è solo un posto della Fondamenta (apre Lunardi in g09). Nessun testo lo contraddice.
- **GDD.** Ho cambiato solo la colonna «Min» e la barca di g04, come chiede Q077. Nell'Appendice A del GDD la campana di g01 è ancora «stonata, fuori orario»: è un appunto di disegno, i testi del gioco ora dicono la messa.

### Problemi noti e richieste

- **tombolo-motore.** Il test `tests/unit/engine/quality.test.ts` «K7: intervalli "Min" dalle tabelle di GDD 5.2» legge il GDD vero e si aspetta i valori di prima (g06 `[5, 5]`, g13 `[10, 12]`). Dopo Q077 sono `[10, 10]` e `[19, 19]`. È l'unico test rosso della suita unitaria e va aggiornato da chi ha il file.
- **tombolo-motore.** `hud.matassaAria` dice «1 braccia usate» (Q005, plurale). È in `src/i18n/*/tombolo.json`.
- **contenuti-atti23.** Q065, finale A: «Zeno le ha portato la valigia fino al vaporetto» mentre Zeno è appuntato al Faro alle 18. È in `finali.json`, `finale.merlettaia.2.zeno`.
- **e2e (nessun gruppo).** `tests/e2e/prologo.spec.ts` «dal titolo all'alba» passa tutti i gesti ma aspetta l'alba da sola. Con R2-D5 (campagna) dopo l'ultima ora serve un tocco: il test va aggiornato.

### Verifica della revisione 2

Verificatore del gruppo schermi-atto1: ho ripreso ogni task coi passi del playtest 2, nel codice, nei test e nel browser (build `VITE_E2E=1` servita sulla porta 6065, screenshot guardati).

| Task | Esito della verifica | Prova |
|---|---|---|
| Q005 | parziale (resta il plurale) | la nota di g02 dice «Il gomitolo conta il filo usato», come l'HUD. `hud.matassaAria` («1 braccia usate») è ancora di tombolo-motore |
| Q009 | fatto, con una correzione | sera di g01 a 390×844 con Marta e Gino appuntati e Don Piero lasciato: il bilancio ha la riga «Bigliettini lasciati — Don Piero — Il bigliettino di Don Piero è rimasto senza spillo…». **Corretto (d95f53e)**: g05 Zeno e g04 Bepi dicevano «Non ne scriverà un altro», ma Zeno scrive ancora in g06-g08 e Bepi in g10. g01 e g02 Gino («ha suonato con la pentola», «il giro in cortile»), g06 Nina («ha aspettato la posta tutta la mattina») e g07 Zeno («la lanterna aspetterà») raccontavano fatti del merletto che lasciare il bigliettino non decide: ora dicono solo la reazione di chi l'ha scritto. In g02 Marta non dice più «ancora» (con g01 riuscito non era mai stata lasciata) e in g05 «Ha sgridato il Gino» non è più ambiguo. Test nuovo in `atto1.test.ts` |
| Q018, R2-D7 | fatto | `levels:check --qualita` verde su 34 notti. Nel browser la soluzione da 8 incroci di g07 Nina+Zeno trovata **senza** la regola del Gino, giocata nel tombolo vero, si ferma alle 9 con «Gino è stato fermo un'ora: adesso deve incrociare (può con Nina).»: la regola è il collo di bottiglia (minimo 10 contro 8). Le soluzioni registrate di 10 combinazioni di g04-g08 finiscono al minimo con tutte le richieste soddisfatte |
| Q065 | parziale (resta il finale A) | g01: campana della messa e Don Piero dalla Piazza in alba e Taccuino; g05: «Me l'ha detto tre volte». Il finale A (`finali.json`, contenuti-atti23) dice ancora «la valigia fino al vaporetto» |
| Q074 | fatto | `comune.pers.zeno.desiderio` non nomina Livia (it/en), test |
| Q077 | fatto | colonna «Min» e barca di g04 nel GDD; nessun avviso K7. Il test K7 di `quality.test.ts` è stato staccato dai valori del GDD da tombolo-motore (45cf7ce) |

### Rifinitura della revisione 2 (residui dei verificatori)

- **Q019, metà di g08.** L'alba della domanda scaduta diceva «La Nina rimette la busta nel libro» anche quando la busta era finita a Don Piero (che non dà niente). La seconda riga ora non dice dov'è la busta: «La Nina chiude il libro di scuola, piano, come si chiude una porta.» (en allineato). Dividere la vignetta per chi tiene la busta avrebbe portato g08 a 6-7 vignette candidate, oltre le 3-5 di GDD 5.9.
- **R2-D3, g08 Marta.** L'esito fallito non è più un «o… o…»: «Marta è arrivata alla messa senza il momento che voleva, con Don Piero e il Gino tutti e due. Ha pregato da sola.»
- **g08, la Nina alla Farmacia alle 10.** Verificato col GDD: la Farmacia è chiusa fino a g09, ma è un tratto della Fondamenta (con sei colonne a ogni ora qualcuno ci passa davanti) e nessun testo lo contraddice. Ho cercato con il solver un'altra posizione: lo spillo spostato in ogni altro luogo e ora (7-15), anche insieme a uno spostamento dello spillo del Gino o a uno spillo in più di qualunque filo (12 466 varianti), o rompe la notte (base irrisolvibile, K2, K3) o porta la designata a 16-17 (oltre il 14 di GDD 5.2) o perde la «via breve» di R2-D7; l'unica variante con designata 14 mette Zeno in Chiesa alle 14-15, contro il suo bigliettino e `zenoFaro`. **Scelta consapevole:** lo spillo resta; il GDD (Appendice A) lo spiega.
- **Q005** (plurale della matassa) e **Q065** (finale A, Zeno al Faro) sono fatti; **Q077**: la colonna «Min» di GDD 5.2 ha ora tutti i minimi misurati da `levels:check` (anche g01-g03, g05, g17, g19, g21) e l'Appendice A è allineata ai dati (campana della messa in g01, g02 «di corsa», bigliettini più duri di Marta e più freddi di Teresa, g04, g07, g08).

## Revisione 1

Compiti CA1-01 … CA1-08 di `docs/REVISIONE-1.md` (playtest 1), tutti fatti. Solo file del gruppo: JSON dei contenuti, testi `atto1` e `comune` in it/en, livelli g00-g08, arc1, arc2 con i `.computed.json`, `tests/unit/content/atto1.test.ts`.

**Accettazione di CA1-04:** `npm run levels:check -- --only g00,g01,g02,g03,g04,g05,g06,g07,g08,arc1,arc2 --qualita` esce con **0** (11 livelli OK, nessuna violazione C14; restano 3 avvisi K7, vedi sotto). Il test «C14 (REVISIONE-1 CA1-04)» controlla `quality.violazioni` vuoto per tutti e 11, al più un bigliettino facile per sera e solo dentro un conflitto voluto.

| Compito | Esito | Commit | Cosa |
|---|---|---|---|
| CA1-01 [P0] lanterna di g05 | fatto | f12882c | All'alba di g05 il Gino trova la lanterna **spenta** («È tutta vetri e ottone, ma spenta!» / «Si accende alle sei. Da dentro, un giorno.»). Test: nessun testo di `atto1` o `comune` prima del finale dice che l'ha vista accesa da dentro. |
| CA1-02 [P0] dati comuni dei contratti | fatto | dd22351 | `campaign.json` come C04 (`objects`, `dawnObject` di g14 e g16, `eveningEmptyKey` di g15 e g17, g23 con 2 spilli); `balance.oro.minIncroci` 3 (C15); Marta `hand` atkinson, maiuscolo, 1,05; Aldo con motivo `catenella` e icona `campana`, che in arc3 non usa nessun altro; `comune.oggetti.*` per tutti gli oggetti (lettera di Clotilde, fasci 1-3, biglietti di Livia 1-6). Test: provenienza di ogni oggetto, Aldo distinto. |
| CA1-03 [P1] tutorial | fatto | f12882c, 15a88e9 | Passi D03/C02: g00 spillo alle 6, «Chi sta sopra, dà» al primo incrocio delle 7 qualunque sia il verso, Disfa alle 8; g01 la regola nuova del Gino (all'inizio delle 8 o al primo rifiuto `corre`); g02 matassa; g03 Molo; g04 barca; g05 Faro; g06 segreto; g07 pozzo e Nina curiosa; arc1 nomi, rammendo, echi. `hintKeys` di arc1 e arc2 rivisti per i nomi. Test: ogni regola della colonna «Novità» del GDD 5.2 ha una nota a margine nella sua prima notte. |
| CA1-04 [P1] ridisegno g01-g08 | fatto | 68094ee, 5f0e8ff, 61275dc, 4638532, feb4759, 9314053, 490a741 | Tutte le notti rispettano C14 (tabella sotto). Intenzioni dell'Appendice A e conflitti voluti invariati. |
| CA1-05 [P1] Taccuino | fatto | f12882c | Voci su bottiglie, fuso, merletto d'avorio, Libro e lettere con `{knows:'oggetto'}`; persone sbloccate quando compaiono (Gino g01, Nina g03, Bepi g04, Zeno g05); la risposta R1 a Marta in g06 rimanda all'Archivio solo se arc1 non è rammendato, altrimenti `domande.martaTeresa.chiediloDopo`. Test con la campagna simulata. |
| CA1-06 [P1] esiti | fatto | f12882c | `esito.ok` / `esito.fallita` (e `lasciato` dove serve) per tutti i 26 bigliettini, specifici, ≤ 140 caratteri, senza frasi in comune con le voci del Taccuino della stessa giornata (test C05); le tre frasi ripetute di arc1 sono una voce sola. |
| CA1-07 [P1] continuità | fatto | f12882c, 490a741 | «entro le dieci» / «entro le nove», Teresa che a sedici anni impastava il pane, Don Piero che dà del lei, «1965. La notte in cui morì la nonna…», segreto di Teresa (aperta prima), deissi di g03 e g06, «resta solo la sua rete», eco di arc2, «Un'ultima volta, dentro.», testi del filo nero, `apparizione` di g08 (C12). Inglese allineato. |
| CA1-08 [P2] voci, etichette, battute | fatto | f12882c | Etichette delle perline in minuscolo, con articolo e destinatario delle lettere (C16); il Gino scrive con gli errori da g01, Bepi senza doppie e in minuscolo; `lines.json` con condizioni vere (consegna, incontro; la battuta «sette!» è riscritta). |

### Misure C14 per notte (dopo il ridisegno)

Costo = minimo con il solo bigliettino meno il minimo della base. Vuote = righe vuote consecutive / totali nella soluzione registrata della designata. Soluzioni = soluzioni ottime della designata (K5, al massimo 20).

| Notte | Base | Designata (min) | Matassa | Costo dei bigliettini | Conflitto voluto | Facile | Vuote | Soluzioni |
|---|---|---|---|---|---|---|---|---|
| g00 | 4 | base 4 | 6 | — | — | — | 0/0 | 3 |
| g01 | 5 | marta+piero 6 | 9 | marta +0, piero +1, gino +0 (g01 è esente da K2) | piero+gino | — | 0/0 | 16 |
| g02 | 4 | marta+martaDura 7 | 10 | marta +3, martaDura +3, teresa +2, gino +3 | marta+gino, martaDura+gino | — | 0/0 | 7 |
| g03 | 4 | nina+teresa 7 | 10 | nina +2, marta +0, teresa +2, teresaFredda +2 | nina+marta | g03.marta | 1/1 | 4 |
| g04 | 4 | nina+piero 10 | 13 | nina +2, bepi +3, piero +4 | bepi+piero | — | 0/0 | 1 |
| g05 | 5 | zeno+teresa 8 | 11 | zeno +3, marta +0, teresa +3 | zeno+marta | g05.marta | 1/1 | 12 |
| g06 | 4 | marta+zeno 12 | 15 | nina +2, marta +3, zeno +5 | nina+zeno | — | 0/0 | 1 |
| g07 | 5 | teresa+zeno 9 | 12 | teresa +2, nina +0, zeno +3 | teresa+nina | g07.nina | 1/1 | 20 |
| g08 | 7 | marta+zeno 13 | 16 | marta +5, nina +2, zeno +2 | marta+nina | — | 1/1 | 12 |
| arc1 | 4 | base 4 | 4 | — | — | — | 1/1 | 2 |
| arc2 | 2 | base 2 | 2 | — | — | — | 1/1 | 2 |

(In g02 la «designata» `marta+martaDura` è la coppia tecnica delle due varianti, che non arrivano mai insieme: la calcola così `levels:check`.)

### Le notti ridisegnate

- **g01**: Teresa al Forno alle 8 e al Molo alle 9, Don Piero in Piazza alle 11; regola nuova del Gino.
- **g02**: apertura Teresa, Gino, Marta, Piero; Marta al Forno e Teresa in Piazza alle 12.
- **g03**: apertura Piero, Teresa, Marta, Nina; Don Piero in Chiesa alle 10 e in Piazza alle 12; il divieto di Marta è la facile della sera.
- **g04**: la barca di Bepi esce alle **8** (obiettivo `parte(bepi, 8)`) e rientra alle 11; Teresa in Piazza alle 10, Don Piero in Piazza alle 12, Marta al Forno alle 14.
- **g05**: apertura Gino, Marta, Teresa, lino, Piero, Zeno; Teresa al Molo alle 8 e in Piazza alle 13, la lettera per Zeno passa dal Gino; il divieto di Marta è la facile, nel conflitto voluto con Zeno.
- **g06**: apertura lino, Nina, Marta, Zeno, Piero, Teresa; Teresa al Forno alle 11, Nina in Piazza alle 12. Teresa parte dal Faro e deve attraversare il paese: il divieto di Marta («Domani non voglio vedere la Teresa») costa 3.
- **g07**: apertura Nina, Marta, Teresa, Gino, Piero, Zeno; Marta a messa alle 8, il Gino al Forno alle 9, Teresa in Piazza alle 13. La corsa del Gino serve al puzzle: per arrivare al Forno alle 9 passa sopra Teresa, che deve stare sotto per non dargli il suo peso.
- **g08**: apertura Teresa, Nina, Marta, Gino, Piero, Zeno; Marta al Forno alle 7 e alle 15, Nina in Chiesa alle 12, il Gino alla Farmacia alle 14 e al Faro alle 16 (la lanterna promessa), mentre Zeno non vuole vedere nessuno.

### Decisioni e interpretazioni dei contratti

- **g07.teresa** («Che il mio peso arrivi a Don Piero, e a nessun altro»): la condizione ora esclude tutti i fili con nome, non solo Nina e Marta (`nonHa` anche per Gino e Zeno). È la stessa intenzione, presa alla lettera; così ogni incrocio con Teresa ha un verso solo e la designata ha 20 soluzioni ottime invece di 50 e più.
- **g08.zeno**: la finestra è `nonIncontra(zeno, *, 14, 16)`, «dalle due in poi» invece che «dalle tre» (it ed en). Con le tre il bigliettino costava al più 1 (K2).
- **Facili** (`--facile`): g03.marta, g05.marta, g07.nina. Uno per sera, ognuno dentro il conflitto voluto della sera. g07.nina è facile per la stranezza di Nina («con `ninaCuriosa` è più facile di quanto sembri», Appendice A).
- **arc1**: la nota «Chi è questo filo?» è `ora 10`, non `primaOra`. Il tombolo apre l'Archivio dal primo strappo (10) con la riga delle 9 già registrata, quindi `primaOra` non scatta mai (`rows.length` è 1); anche il fuso che pulsa è alle 10. Un test controlla che negli Archivi ogni passo con un'ora cada in una riga strappata.
- **GDD 5.2, colonna «Min»**: va aggiornata per g04 (ora 10, prima 5-7), g06 (12, prima 5) e g08 (13, prima 8-10): `levels:check` lo segnala come avviso K7. Con la regola del Gino e i criteri K1-K2 (densità e costo dei bigliettini) i vecchi minimi non bastano più. Le altre notti stanno nell'intervallo ±1. Nella stessa tabella: g04 «Bepi esce alle 7, rientra alle 13» diventa «esce alle 8, rientra alle 11»; g06 non è più l'esempio del GDD 3.16 (la tabella del 3.16 va rifatta con la nuova g06, oppure tenuta come esempio astratto).
- **eveningEmptyKey** di g15 e g17 (`atto2.g15.sera.vuota`, `atto3.g17.sera.vuota`): le chiavi sono di contenuti-atti23; `campaign.json` le punta e basta.

### Problemi noti e richieste

- **tombolo** (facoltativo): `primaOra` negli Archivi non scatta mai, perché la notte apre con una riga già registrata. Si può far valere `primaOra` alla prima riga giocabile; i contenuti dell'Atto I non ne dipendono più.
- `tests/unit/content/en.test.ts` ha 2 test rossi su chiavi di `atto2` e `finali` (lunghezze di `atto2.g12.zeno.testo`, `finali.merlettaia.hint.*`, `atto2.g09.hint.indizio`, `atto2.g12.hint.spinta`): sono testi di contenuti-atti23, non di questo gruppo.
- g06 e g08 sono più dense di prima (designata 12 e 13): la curva di difficoltà dell'Atto I sale più in fretta. Da guardare nel playtest 2.

### Test e verifiche della revisione 1

- `npx vitest run tests/unit/content/atto1.test.ts` → 66 test verdi.
- `npm run levels:check -- --only g00,g01,g02,g03,g04,g05,g06,g07,g08,arc1,arc2 --qualita` → exit 0.
- `npx tsc --noEmit -p .` → nessun errore in `atto1.test.ts` né in `en.test.ts`.
- Browser (build `VITE_E2E=1` servita da `vite preview` sulla porta 5660, Chromium 390×844 touch, lingua it), 14/14:
  - note a margine: g00 alle 6 (spillo), alle 7 («Chi sta sopra, dà» col verso giusto), alle 8 (Disfa); g01 alle 8 (Gino); g02 alle 8 (matassa, dopo quella della voce); g03 alle 8 (Molo); g05 alle 8 (Faro); arc1 alle 10 («Chi è questo filo?»);
  - g04, g06, g07, g08: la soluzione registrata della designata, giocata nel tombolo vero, soddisfa tutte e due le richieste;
  - sera di g01: oggetti dell'alba (merletto d'avorio, Libro dei Punti) e bigliettino di Don Piero «entro le dieci»;
  - nessun errore in console.


## Riepilogo

Dati comuni, Prologo, Atto I (g00-g08) e Archivio A1-A2: solo JSON più il test `tests/unit/content/atto1.test.ts`.

- **Dati comuni** (committati per primi, usati anche dagli Atti II-III):
  - `characters.json`: i 16 personaggi con colore, motivo, icona, nota, voce, calligrafia, stranezze, desiderio e gusti; i 5 solo d'Archivio hanno `archiveOnly`. Le note sono quelle della tabella dell'audio.
  - `places.json`, `book.json` (14 pagine del Libro dei Punti, sblocchi anche per gli Atti II-III), `balance.json` (GDD 3.13).
  - `campaign.json`: g00-g23, finali, giornata della scelta, spilli, `archiveAfter`, `objectAfter`, stonatura 1 / 0,6 / 0,25.
  - `lines.json` (162 battute), `credits.json` (la riga dell'autore è `comune.crediti.autore`: formula neutra, vedi Integrazione).
  - Testi in `text/it/comune.json` e `text/en/comune.json` (inglese completo).
- **Livelli** g00-g08, arc1, arc2 con i `.computed.json` (sourceHash aggiornato; `npm run levels:check` verde per tutti e 11).
- **Bigliettini** (`notes.atto1.json`): 26 in tutto. Ogni sera ne arrivano 3, con i testi e le condizioni dell'Appendice A. Due sono varianti che sostituiscono il bigliettino base (vedi sotto). Ogni sera ha almeno una risposta e un conflitto voluto.
- **Taccuino** (`diary.atto1.json`): 80 voci. Coprono stranezze, regole dell'Atto I, persone, i desideri di Nina e Gino, le domande con le piste, le lettere e l'Archivio. Ogni risposta ha la sua voce.
- **Lettere di L.** (`lettere.atto1.json`): `lettera_L1` … `lettera_L7` per le sere di g01, g02, g03, g04, g06, g07 e g08. La 1 e la 4 sono gli esempi del GDD 6.5.
- **Testi** italiani dell'Atto I in `text/it/atto1.json`. Parole italiane: comune 2.798 + atto1 3.607 = **6.405**.

Valori prima della revisione 1 (quelli nuovi sono nella tabella delle misure C14 qui sopra):

| Giornata | Colonne / ore | Min designato | Matassa | Conflitto voluto |
|---|---|---|---|---|
| g00 | F P C / 5→9 | 4 (3 soluzioni ottime, GDD 3.15) | 6 | — (prologo, obiettivo obbligatorio) |
| g01 | M F P C / 6→11 | 6 | 9 | g01.piero + g01.gino (impossibile anche senza `ginoCorre`) |
| g02 | M F P C / 6→12 | 7 | 10 | g02.marta (o g02.martaDura) + g02.gino |
| g03 | M F P C / 6→12 | 5 | 8 | g03.nina + g03.marta |
| g04 | M F P C A / 6→14 | 5 | 8 | g04.bepi + g04.piero |
| g05 | 6 col / 6→13 | 8 | 11 | g05.zeno + g05.marta |
| g06 | 6 col / 6→12 | 5 | 8 | g06.nina + g06.zeno (GDD 3.16, tabella riprodotta) |
| g07 | 6 col / 6→14 | 9 | 12 | g07.teresa + g07.nina |
| g08 | 6 col / 6→16 | 12 | 15 | g08.marta + g08.nina |

Archivio:
- arc1 (1936): 5 colonne, 8→12, strappo 10-11, matassa 4.
- arc2 (la notte scorsa): 0→5, strappo 1-2, matassa 2.
- Entrambi hanno il merletto registrato completo, 4 fili sbiaditi, candidati con esca (Clotilde, Livia), echi su ogni incrocio, nota a margine, vignetta di rivelazione e domande chiuse (`martaTeresa`, `avorio`).

## Correzioni della verifica

- **g01, GDD 3.6.** Nel giorno del suo debutto, `ginoCorre` rendeva impossibile la coppia g01.piero + g01.gino: senza la stranezza era risolvibile in 4 incroci. Ho aggiunto lo spillo d'ottone «Teresa al Molo alle 9» (la posta). Ora il conflitto è geometrico e vale anche senza Gino. Minimo designato e matassa non cambiano (6 e 9). Un test verifica la regola per tutti i debutti dell'Atto I: `ginoCorre` g01, `zenoFaro` g05, `teresaLegge` g06, `pieroPozzo` e `ninaCuriosa` g07.
- **g01, nota a margine del tutorial.** Era `when: 'rifiuto'` alle 7 con il testo su Gino. Il tombolo però la mostra sul rifiuto di Marta (codice `rifiuto`), non su Gino (codice `corre`): con Teresa sopra Marta compariva «Il Gino non sta fermo». Ora il testo vale per tutti e due i rifiuti: «Ognuno ha il suo verso: c'è chi non passa sotto, e chi non sta fermo.» L'ho verificato nel browser.
- **Varianti dei bigliettini dell'Appendice A**, che prima mancavano:
  - Se g01.marta fallisce o viene lasciato, il giorno dopo arriva `g02.martaDura` invece di `g02.marta`, più duro.
  - Con la risposta R1 a g02.teresa, il giorno dopo arriva `g03.teresaFredda` invece di `g03.teresa`, senza «cara».
  - Il meccanismo è `availableIf` sul flag (`martaDura`, `teresaFredda`), con la stessa richiesta del bigliettino base.
  - Vignette e voci del Taccuino legate a quelle note accettano tutte e due le varianti.
- **Risposte senza conseguenze.** Le risposte g01.gino R2, g04.nina R1, g05.marta R2, g06.marta R2, g07.nina R1/R2 e g08.nina R1/R2 non cambiavano niente di visibile. Ora ognuna sblocca una voce del Taccuino. Tutte le risposte hanno anche l'effetto `{ diary }`, oltre alla condizione `{ reply }` della voce.
- **Testi del Taccuino in contraddizione** con i bigliettini: `persone.teresa.amica` diceva «mi ha chiamata cara tre volte», `persone.teresa.fredda` «non mi chiama più cara». Li ho riscritti.
- **Pagina `puntoAperto` del Libro.** Si completa dopo arc6, come dice il GDD 5.7: `{ any: [ { done: 'arc6' }, { done: 'g21' } ] }`. Prima diceva `done g20`, quindi si completava prima che arc6 si potesse leggere.
- **Test nuovi** (34 in tutto):
  - 3 bigliettini per sera con ogni combinazione dei flag delle varianti;
  - varianti dei bigliettini;
  - conseguenze di ogni risposta;
  - mano del tutorial valida e giornata ancora risolvibile;
  - regola del debutto delle stranezze;
  - oggetti della sera;
  - prologo con 3 soluzioni ottime e la partita della tabella del GDD 3.15;
  - g06 con la tabella del GDD 3.16 riprodotta riga per riga.

## API e convenzioni per gli altri pacchetti

- `characters.json`: chiavi `comune.pers.<id>.nome|nomeCompleto|ruolo|desiderio|presentazione`.
- `places.json`: chiavi `comune.luogo.<id>.nome|breve|descrizione`. `diorama` = `dio/<id>`; la luce si aggiunge, `dio/<id>/<alba|giorno|notte>`. C'è anche `comune.luogo.stanza.*` per la stanza di Ada, che non è un PlaceId.
- Etichette dei fili di lino riusabili: `comune.fili.<lino|passante|marinaio|pescatore|barcaiolo|comare|garzone|forestiero|avorio|sbiadito>`.
- `campaign.json`:
  - `pins`: 0 in g00, 2 negli Atti I-II, 3 nell'Atto III, 1 in g23 (la scelta).
  - `archiveAfter`: arc1 dopo g03, arc2 dopo g07, arc3 dopo g11, arc4 dopo g14, arc5 dopo g18, arc6 dopo g20.
- **Oggetti della sera** (`objectAfter`): se l'id coincide con l'id di una `LetterDef`, l'oggetto è quella lettera.
  - `lettera_L1` … `lettera_L11`: L8-L11 sono in `lettere.atto23.json`, `arrivesAfter` g10, g11, g12, g13.
  - `lettera_clotilde`: g14, firmata `C.`.
  - `biglietto_livia_1` … `biglietto_livia_6`: g17-g22, firmati `L.`.
  - Gli altri oggetti hanno i testi in `comune.oggetti.<id>.nome|descrizione`: `merletto_avorio`, `libro_punti`, `bottiglia`, `fuso_faro`, `pagina_strappata`, `bottiglia_nodo_nero`, `fascio_lettere`, `nastro_nonna`.
- **Domande del Taccuino** (`QuestionId`, GDD 5.8), testo in `comune.domande.<id>.titolo`: `avorio`, `martaTeresa`, `chiL`, `filoNero`, `pozzo`, `anno1958`, `madre`, `puntoAperto`, `desideri`.
  - L'Atto I apre `avorio`, `martaTeresa`, `chiL`, `filoNero`, `pozzo`, `desideri`.
  - L'Atto I chiude `avorio` (arc2) e `martaTeresa` (arc1).
- **Voci del Taccuino**:
  - Id con il prefisso della sezione (`persone.`, `libro.`, `domande.`, `lettere.`, `archivio.`), più `desiderio.<personaggio>` (sezione `persone`, sblocco `{ knows: 'desire', id }`).
  - Testi in `atto1.diario.<id>`.
  - Le voci sbloccate da un Archivio usano `{ done: 'arcN' }` (Archivio completato) e sono anche nel suo `archive.unlocks`.
- **Varianti dei bigliettini.** Più `NoteDef` dello stesso autore per la stessa sera, con `availableIf` complementari (`{ flag, eq: true }` e `{ not: … }`).
  - `level.notes` le elenca tutte; la sera mostra solo quelle con `availableIf` vero, cioè sempre 3.
  - `levels:check` calcola anche le loro combinazioni.
  - Gli id delle varianti non seguono lo schema `<giorno>.<autore>`: l'autore è nel campo `author`.
- `book.json`:
  - Id: `incrocio, spillo, sopraDa, voce, matassa, molo, segreto, pozzo, febbre, nodo, nome, nero, marea, puntoAperto`.
  - La pagina `pozzo` usa `rule: 'segreto'`, perché il pozzo non è una RuleId.
  - Le note a margine delle pagine `nome` e `nero` sono di Ada (a matita); le altre sono di Clotilde.
  - Sblocco: `{ any: [ { knows: 'rule', id }, { done: <giornata precedente> } ] }`; per `puntoAperto` vedi sopra.
- `lines.json`:
  - 9 personaggi (gli 8 del cast più Livia) × 7 eventi × 2, più 4 di riserva = 162 battute.
  - Eventi del GDD 5.9 → `LaceEventKind`: incontro → `incontro`, consegna → `consegna`, voce → `copia`, segreto letto → `legge`, rifiuto → `stranezza`, nodo → `nodo`, cura → `cura`; più `riserva`.
  - Chiavi `comune.battute.<pers>.<evento>.<n>`; la variante per chi ha dimenticato Ada è `…<n>d` (`forgetKey`).
- Chiavi dei livelli dell'Atto I:
  - `atto1.<giorno>.titolo|perline.*|alba.<nome>[2]|hint.spinta|hint.indizio|margine.*`;
  - bigliettini `atto1.<giorno>.<autore>.testo|r1|r2`;
  - Archivio `atto1.arcN.eco.*|margine|rivela.1|rivela.2`.
- Titoli degli atti: `comune.atti.<0-3>.titolo|sottotitolo`. Crediti: `comune.crediti.*`.

## Decisioni

- g00 ha la meccanica identica ad ARCHITETTURA 14.1: minimo 4, 3 soluzioni ottime, matassa 6. Ho aggiunto solo le altre due vignette del GDD 9, il suggerimento `indizio` e due passi `pulsa` (Disfa alle 8, Taccuino alle 9).
- g06 era l'esempio del GDD 3.16 alla lettera (N1 5, N1+N2 5, N2+N3 0, N1+N3 impossibile e voluta, matassa 8). Con la revisione 1 non lo è più: vedi «Decisioni e interpretazioni dei contratti».
- Con `ginoCorre`, il minimo di una giornata con Gino è almeno il numero di righe in cui Gino è nel merletto. Per questo g01 (6), g02 (7), g07 (9) e g08 (12) superano di 1-2 l'intervallo «Min» del GDD 5.2. La matassa resta sempre il minimo designato più 3.
- g04, barca di Bepi:
  - Rientra alle **11** invece che alle 13, perché dal Molo alle 13 la richiesta dell'Appendice A `presso(bepi, chiesa, 14)` sarebbe impossibile (tre colonne in una riga).
  - L'uscita di Bepi alle 7 è l'obiettivo obbligatorio `parte(bepi, 7)`: gli spilli si controllano dopo i bordi.
  - Di conseguenza g04.nina (salutarlo alle 7) è sempre soddisfatta: Bepi deve incrociare Nina per arrivare al Molo.
- g08: i 6 fili con nome occupano le 6 colonne, quindi il vaporetto delle 9 porta sempre via qualcuno. Il destinatario della domanda d'iscrizione è un filo di lino `segreteria`, che non entra mai nel merletto.
- I fili sbiaditi dell'Archivio hanno id neutri (`f1` … `f4`) con il `character` della risposta. Il padre di Marta (arc1) è un filo `persona` senza CharacterId, con `labelKey`.
- Le vignette di sola narrazione hanno 0 figure.

## Problemi noti

- ~~La storia dell'Atto I in inglese non c'è~~ **Risolto**: il pacchetto traduzione-en ha tradotto atto1, atto2, atto3 e finali (vedi Integrazione).
- Gli intervalli «Min» del GDD 5.2 non valgono per le giornate con Gino (vedi Decisioni).

## Richieste per altri pacchetti

- **campagna**:
  - Filtrare `level.notes` con `availableIf`: in g02 e g03 l'elenco contiene il bigliettino base e la sua variante, e la sera ne mostra 3.
  - Le altre convenzioni sono quelle sopra (oggetti = id delle lettere, domande, desideri, voci d'Archivio con `{ done: 'arcN' }`).
  - Le note a margine delle pagine `nome` e `nero` del Libro vanno scritte con la mano di Ada.
  - `fascio_lettere` (g16) va mostrato solo se le lettere di Livia sono liberate (GDD 5.6).
  - Dopo g00, oltre a `merletto_avorio`, compare il Libro dei Punti (`comune.oggetti.libro_punti`).
- **tombolo**:
  - g04 ha un obiettivo obbligatorio (`goals: parte(bepi, 7)`), da mostrare come quello del prologo.
  - In g08 il filo `segreteria` esiste solo come destinatario e non entra mai.
  - Facoltativo: far scattare il margine `when: 'rifiuto'` anche sui rifiuti `corre` e `faro`. Il GDD 3.4 li chiama tutti «riga rifiutata», e il testo di g01 vale per tutti e due i casi.
  - Un filo `persona` senza `character` (il padre di Marta in arc1) oggi si disegna come un lino. Conviene disegnarlo come un filo con nome neutro, perché riceve lettere e segreti.
- **contenuti-atti23**:
  - Usare gli id e le chiavi comuni sopra; per le lettere 8-11 gli id `lettera_L8` … `lettera_L11`.
  - Chiudere le domande lasciate aperte dall'Atto I (`chiL`, `filoNero`, `pozzo`, `desideri`) con gli stessi `QuestionId`.

## Test

- `npx vitest run tests/unit/content/atto1.test.ts` → 34 test verdi.
- `npx tsx tools/levels/check.ts --only g00,g01,g02,g03,g04,g05,g06,g07,g08,arc1,arc2` → 11 livelli OK.
- `npx vitest run tests/unit/content tests/unit/core` → 22 file, 248 test verdi (compreso `atto23.test.ts`).
- `validateContent` su tutti i contenuti presenti → 0 errori.
- `npx tsc --noEmit -p .` → nessun errore nei file del pacchetto.
- Browser (Chromium headless, `__GAME__.night`):
  - g00, g01, g06, g08, arc1 e arc2 si aprono nel tombolo vero, e l'autoplay soddisfa le richieste accettate;
  - g06 riproduce la figura del GDD 3.16 (5/8);
  - le note a margine compaiono: «Chi sta sopra, dà.» in g00 alle 7 con Piero sopra, e la nota del rifiuto in g01 con il «No.» di Marta.

## Integrazione

Richieste di `docs/stato/RICHIESTE.md` per questo pacchetto, controllate sul codice attuale (14 ottobre 2026).

| Richiesta | Esito |
|---|---|
| Crediti con il segnaposto `[nome dell'autore]` (autore, ideazione, testi), visibili nei titoli di coda e nella schermata Crediti | **Fatto.** Formula neutra in italiano e in inglese: «Un'idea nata da una conversazione con Claude» / «An idea born from a conversation with Claude»; «Ideazione, design e storia: Claude (Anthropic)»; «Testi italiani e inglesi: Claude (Anthropic)». Nuovo test: crediti senza segnaposto né parentesi quadre, presenti in tutte e due le lingue. |
| `text/en/comune.json` con le virgolette dritte (9 coppie) mentre la storia usa “ ” | **Fatto.** Le 9 coppie ora sono tipografiche (“dear”, “my Ada”, “L.”, “the keeper”, “news”, “doctor”, “the pharmacy man”). Il test di `en.test.ts` controlla anche `comune.*`: niente `"` dritte e “ ” bilanciate. |
| `characters.json`: `noteHz` e `voice` come GDD 13.2/13.5, Clotilde `voice: null`, Lino senza nota | Già fatto: `tests/unit/audio/notes.test.ts` verde. |
| `campaign.json`: stonatura 1 (g00-g08), 0,6 (g09-g16), 0,25 (g17-g23) | Già fatto (controllato sul file). |
| Flusso di `levels:check`, `--voluta`, matassa = `matassaSuggerita` | Già fatto: `npx tsx tools/levels/check.ts --no-write` → 34 livelli OK; nessun livello modificato, quindi nessun `.computed.json` da rigenerare. |
| Se si aggiunge l'inglese della storia dell'Atto I, serve anche per atti 2-3 e finali | Già fatto dal pacchetto traduzione-en (atto1, atto2, atto3, finali). Il problema noto «la storia dell'Atto I in inglese non c'è» non vale più. |
| `validateContent` (righe giocabili, vignette, archivio, bigliettini, chiavi) e forme del loader | Già fatto: `validateContent` su **tutti** i contenuti → 0 errori. |

**Come citare l'autore.** La riga dell'autore è una sola chiave, `comune.crediti.autore` (in `src/content/text/it/comune.json` e `text/en/comune.json`), puntata da `credits.json` (`authorKey`). Per citare una persona basta cambiare quel testo nelle due lingue, per esempio «Un gioco di Nome Cognome»; le righe `comune.crediti.righe.ideazione` e `.testi` si cambiano allo stesso modo. Il test rifiuta solo i segnaposto tra parentesi quadre.

Test: `npx vitest run tests/unit/content` → 3 file, 111 test verdi (`atto1.test.ts` 35). Browser (build `VITE_E2E=1` servita da `vite preview` sulla porta 5420, 390×844 touch): schermata Crediti in italiano e in inglese con la nuova formula e senza parentesi quadre, `missingKeys` vuoto in tutte e due le lingue, nessun errore in console.
