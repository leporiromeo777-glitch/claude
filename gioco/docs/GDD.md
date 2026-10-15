# TRAMA. Il merletto dei giorni
### Game Design Document (versione 1.1, 14 ottobre 2026: revisione 1 dopo il primo playtest)

> In inglese: *Trama: The Lace of Days*. Questo documento è la bibbia del progetto: dove il codice e questo testo non sono d'accordo, si corregge uno dei due e si annota il cambiamento in fondo (sezione 18, Registro delle modifiche).
> Documenti collegati: `ARCHITETTURA.md` (tecnica, interfacce TypeScript, pipeline), `RICERCA.md` (perché questo gioco e non un altro), `REVISIONE-1.md` (decisioni e contratti della revisione 1, dopo il primo playtest).

---

## 0. Scheda

| Voce | Valore |
|---|---|
| Genere | Puzzle narrativo a turni: si intrecciano fili-persona su un tombolo, e quello che si tesse di notte accade il giorno dopo |
| Frase di vendita | «Quello che tessi stanotte accade domani.» |
| Hook in una riga | Un puzzle di trecce in cui ogni filo è una persona e ogni incrocio è un incontro: chi passa sopra consegna all'altro quello che porta |
| Piattaforme | Browser desktop e mobile ora; iOS e Android con lo stesso codice (Capacitor 8) quando l'autore lo decide |
| Orientamento | Telefono verticale bloccato, una mano; tablet e desktop qualsiasi proporzione (tre pannelli in orizzontale) |
| Sessione | 10-20 minuti = una Giornata (sera, notte, alba). Si interrompe in qualsiasi momento senza perdere nulla |
| Durata | Prologo 5 min; finale base 5-6 ore; finale vero 7-9 ore; completamento 12+ ore. Più Merletto del giorno e Merletto libero senza fine |
| Lingue | Italiano (principale), inglese (interfaccia al 100% nel livello L1, storia nel livello L2) |
| Modello | Premium senza pubblicità né acquisti dentro l'app. Sugli store: prima parte gratuita (Prologo + Atto I + Merletto del giorno) e sblocco unico. Sul web tutto sbloccato |
| Classificazione prevista | PEGI 7 / 9+ (lutto, malattia, temi familiari; nessuna violenza) |
| Offline | Sempre. Nessuna richiesta di rete a runtime |

---

## 1. Visione e pilastri

**Visione.** Sant'Arianna è un'isola della laguna dove da quasi quattro secoli una merlettaia tesse ogni notte il merletto del giorno dopo, e quello che tesse accade. Ada, sedici anni, eredita il tombolo la notte in cui muore la nonna Clotilde. Tessendo scopre che la nonna ha usato quel potere per decidere la vita degli altri: chi restava, chi partiva, chi non doveva mai incontrarsi. Il gioco chiede al giocatore la stessa cosa che chiede ad Ada: per un inverno intero impari a comandare le persone, e alla fine scopri che il punto era conoscerle.

**Pilastri.** Ogni scelta di design va controllata contro questi cinque punti. Se una funzione non ne serve almeno uno, si taglia.

1. **Un gesto, molto profondo.** Il gioco ha un solo verbo: incrociare due fili. Tutto il resto (lettere, voci, segreti, febbre, maree) è una conseguenza di quel gesto. Niente inventario, niente avatar, niente combattimento.
2. **La meccanica è la storia.** Ogni regola nasce da un personaggio (Teresa legge le lettere, Don Piero è un pozzo, Marta non passa mai sotto Teresa) e ogni svolta della storia cambia una regola. Il merletto finito è la cronaca leggibile della giornata.
3. **Si avanza con la conoscenza.** Il Taccuino ricorda stranezze, desideri, verità. Nel finale vero non si vince con la bravura nei puzzle ma sapendo chi vuole che cosa. La conoscenza sopravvive anche quando si riavvolge la storia.
4. **Stato sempre visibile, sbagliare non costa.** Tutto quello che conta è sul tombolo. Niente timer, Disfa illimitato durante la notte. Il fallimento di una richiesta fa comunque avanzare la storia e insegna qualcosa.
5. **Velluto e filo.** Il mondo è desaturato (velluto blu notte, legno, carta, laguna spenta). Solo i fili e le perline sono saturi. Il low-poly delle figurine è intaglio di legno tornito: il limite tecnico è lo stile.

**Cosa NON è.** Non è un roguelike, non ha mazzi di carte, non ha statistiche che crescono, non ha un loop temporale (il giorno accade e resta), non ha una diga né un paese sommerso.

---

## 2. Il mondo in una pagina

- **Sant'Arianna**: isola immaginaria della laguna nord-adriatica, autunno 1965 - primavera 1966 (le date compaiono solo nell'Archivio; nel presente si dice "quell'autunno"). Una sola Fondamenta lunga e stretta, case color mattone, ocra e verde laguna. Il vaporetto per la terraferma passa la mattina e la sera.
- **La Fondamenta** è una strada sola, e i suoi sei luoghi stanno sempre nello stesso ordine, da ovest a est: **Molo, Forno, Piazza, Chiesa, Farmacia, Faro**. È così stretta che per passare bisogna incontrarsi: due persone che vanno in direzioni opposte si scambiano di posto e in quel momento si parlano. È la giustificazione dentro il mondo della regola base del gioco.
- **Il tombolo**: il cuscino cilindrico del merletto a fuselli. Ogni filo che pende da un fuso è un abitante. Le colonne sono i luoghi, le righe sono le ore.
- **Le regole del mondo**, che sono anche regole del gioco:
  - quello che la merlettaia tesse di notte accade il giorno dopo;
  - la merlettaia non ha un filo: non sta nel merletto;
  - chi non sta nel merletto, l'isola lo dimentica a poco a poco.
- **I bigliettini**: gli abitanti non ne parlano apertamente, ma la sera infilano sotto la porta della merlettaia dei biglietti con le loro richieste.
- **Il nome dell'isola**: Arianna fu la prima merlettaia (1630). Il filo di Arianna, che porta fuori dal labirinto, è il tema nascosto del finale vero.

---

## 3. Regole di gioco (specifica formale)

Questa sezione è normativa: il motore (`src/engine`) la implementa alla lettera e i test unitari ne verificano ogni riga. Le parole in `monospace` sono gli identificatori usati nei dati.

### 3.1 Il tombolo

- **Colonne = luoghi.** Una giornata usa da 3 a 6 colonne (`columns`), sempre sottoinsieme ordinato di `molo, forno, piazza, chiesa, farmacia, faro`. W = numero di colonne.
- **Righe = ore.** La giornata ha un'ora di apertura `startHour` e un'ora di chiusura `endHour`. Le posizioni all'ora di apertura sono date (`initial`). Le righe giocabili sono le ore `startHour+1 … endHour`. La riga dell'ora *h* contiene gli incroci che avvengono "durante" quell'ora; le posizioni all'ora *h* sono quelle dopo gli incroci della riga *h*.
- **Una persona per luogo.** In ogni ora ogni colonna ha esattamente un filo. I posti senza un personaggio sono occupati da **fili di lino grezzo** (`lino`): passanti, barcaioli, pescatori senza nome. Così il mondo è coerente: la Piazza non è mai vuota.
- **Movimento.** In una riga un filo si sposta al massimo di una colonna, e solo incrociando il vicino.

### 3.2 I fili

| Tipo (`ThreadKind`) | Chi | Regole speciali |
|---|---|---|
| `persona` | Personaggi con nome (sezione 5.4) | Hanno colore, motivo, icona, nota musicale, stranezze |
| `lino` | Passanti anonimi (`lino1`, `lino2`…) | **Non prendono lettere né segreti** (non accettano nulla da sconosciuti); prendono e passano voci, nome di Ada e febbre (la strada porta chiacchiere e malattie). Se entrano nel merletto portando una lettera (il marinaio del vaporetto con la posta), la possono consegnare. Filo più sottile, colore grezzo, nessuna icona |
| `nero` | Il filo di seppia (Livia), Atto III | Si muove da solo (3.9), sta sempre sopra, i suoi incroci non consumano matassa, non si può trascinare |
| `avorio` | Clotilde, solo nell'Archivio | Come `persona`, ma esiste solo nei merletti antichi |

### 3.3 L'incrocio

- Il giocatore sceglie, per la riga corrente, un insieme di **coppie adiacenti disgiunte**: la coppia *i* è formata dalle colonne *i* e *i+1*. Ogni filo partecipa al massimo a un incrocio per riga (come il suono delle campane "a cambi").
- Ogni incrocio ha un **verso**: quale dei due fili passa **sopra** (`over: 'L' | 'R'`). Con il trascinamento, il fuso che si trascina passa sopra; toccando l'incrocio si rovescia.
- Un incrocio = le due persone **si incontrano** in quell'ora e si scambiano di posto.
- Ogni incrocio fatto dal giocatore consuma **1 braccio di matassa** (3.7). Rovesciare un incrocio non costa nulla.

### 3.4 Ordine di risoluzione di una riga (normativo)

Quando il giocatore preme **Fissa l'ora**, il motore esegue in quest'ordine:

1. **Blocchi.** Un filo è bloccato in questa riga se: è annodato dalla riga precedente (rancore, 3.8), oppure si trova in una colonna allagata in quest'ora (marea, 3.8). Un filo bloccato non può incrociare.
2. **Incroci forzati.** Se c'è un filo nero (o un'autotessitura, 3.10), il suo incrocio di questa riga è già deciso e mostrato da un'ora prima: occupa la sua coppia, e il giocatore non può usare quei due fili.
3. **Validità.** La riga è rifiutata (non si può fissare, con messaggio e vibrazione morbida) se un incrocio viola una stranezza (3.6), se la matassa è finita, o dopo il passo 7 se uno spillo d'ottone non è rispettato o Gino non ha corso.
4. **Passaggi.** Per ogni incrocio (A sopra, B sotto) si applicano i passaggi della tabella 3.5. Gli incroci di una riga sono disgiunti, quindi l'ordine fra loro non conta: il motore li calcola tutti a partire dallo stato all'inizio della riga.
5. **Scambio.** I fili di ogni incrocio si scambiano di colonna.
6. **Bordi.** Se a quest'ora c'è un evento di bordo (vaporetto, barca, secca, 3.8), si applica.
7. **Fine riga.** Effetti di fine riga nell'ordine: Teresa legge (3.6), controllo del trabocco del pozzo, controllo degli spilli d'ottone di quest'ora, controllo di Gino.
8. **Annuncio.** Si calcola l'incrocio del filo nero per la riga successiva e lo si mostra in anteprima.

### 3.5 Le perline (`BeadType`) e cosa passa in un incrocio

Le perline sono le cose che le persone portano. Ogni perlina ha una forma oltre al colore.

| Perlina | Forma e colore | Regola nell'incrocio (A sopra, B sotto) | Detto della nonna |
|---|---|---|---|
| `lettera` | Rettangolino di carta avorio con sigillo rosso | Ogni lettera **in viaggio** portata da A passa a B. Se B è il destinatario, la lettera è **consegnata** e resta bloccata a B per sempre. Le lettere di B restano a B (chi sta sotto non dà) | «Chi sta sopra, dà.» |
| `voce` | Perla luminosa con un anello | Si copia in **entrambi i versi**: alla fine, A e B hanno tutte le voci di tutti e due | «La voce non ha verso.» |
| `segreto` | Rombo nero lucido | Si copia **solo da A a B** (lo si confida). A lo tiene | «Il segreto scende soltanto.» |
| `febbre` | Goccia verde opaca | Se uno dei due è malato, lo diventano entrambi (contagio in tutti e due i versi). Eccezioni: il farmacista Lunardi (3.6). Gino con la febbre resta a letto: non corre (3.6) | «La febbre non chiede permesso.» |
| `nome` | Piccola perla di madreperla con una "A" | Come la voce (entrambi i versi). È il nome di Ada (3.11) | «Chi ti nomina, ti tiene.» |

Regole generali dei passaggi:

- **Pozzo**: Don Piero non dà mai lettere, voci, segreti né il nome di Ada (3.6). Li riceve tutti. La febbre invece passa anche da lui.
- **Lino**: non riceve lettere né segreti (resta tutto a chi li aveva).
- Il **segreto di lettura** `letta:<idLettera>` nasce quando Teresa legge una lettera (3.6). Si comporta come qualsiasi segreto.
- Le perline non "si consumano": una voce o un segreto copiati restano a tutti quelli che li hanno ricevuti, fino a fine giornata.

### 3.6 Le stranezze dei personaggi (`QuirkId`)

Le stranezze sono regole legate a una persona. Il giocatore **le scopre** la prima volta che producono un effetto (con un messaggio, una vibrazione e una voce nel Taccuino). Da quel momento compaiono come icona sul fuso e nella scheda del personaggio. Ogni stranezza debutta in una giornata dove nessuna richiesta può fallire per colpa sua.

| ID | Personaggio | Effetto formale | Debutto | Come cambia |
|---|---|---|---|---|
| `martaNoSotto` | Marta | Un incrocio con Marta **sotto** e Teresa **sopra** è rifiutato: il fuso rimbalza con un secco «No.» | g00 | Rimosso se Teresa e Marta si riconciliano (flag `riconciliate`, g18) |
| `teresaLegge` | Teresa | A fine riga, per ogni lettera in viaggio che Teresa tiene e che non è indirizzata a lei, Teresa riceve il segreto `letta:<id>` | g00 (luce), formale g06 | Rimosso con `riconciliate` (Teresa promette di non leggere più) |
| `pieroPozzo` | Don Piero | Non dà mai lettere, voci, segreti, nome. Le lettere che riceve e non sono per lui restano a lui come "custodite" | g00 (implicito), formale g07 | Svolta: `pieroTrabocca` |
| `pieroTrabocca` | Don Piero | Attiva da g16. Se a fine riga Don Piero tiene almeno **3 segreti**, il pozzo **trabocca**: al suo prossimo incrocio da sopra dà tutto quello che custodisce (lettere comprese, che da quel momento sono di nuovo "in viaggio"), poi il conteggio dei segreti torna a zero | g16 | Dopo il primo trabocco, nei finali Don Piero non è più un pozzo |
| `ginoCorre` | Gino | **Gino non sta fermo due ore di fila.** Una riga è rifiutata se Gino non incrocia, aveva un incrocio possibile (non è bloccato e almeno un vicino è libero: non bloccato, non in un incrocio forzato, con un verso ammesso) **e** non aveva incrociato nemmeno nella riga precedente. All'apertura, e quando rientra da un bordo, conta come appena mosso; una riga in cui è bloccato (nodo, marea) conta come ferma. Un vicino impegnato dal giocatore in un altro incrocio conta come libero: Gino ha la precedenza, e il messaggio lo nomina («Gino è stato fermo un'ora: adesso deve incrociare (può con Marta)»). **Con la febbre resta a letto**: una riga che comincia con Gino malato non lo obbliga e non conta come ferma. Un incrocio forzato del filo nero con Gino vale | g01 | Nessuno (rev. 1: prima doveva incrociare in ogni riga, vedi 18) |
| `ninaCuriosa` | Nina | Quando Nina sta **sopra**, oltre a dare, riceve anche i segreti di chi sta sotto (salvo che sia il pozzo) | g07 | Nessuno |
| `zenoFaro` | Zeno | Dopo ogni riga, la colonna di Zeno dista al massimo **2** dalla colonna del Faro (se nella giornata il Faro non c'è, si usa l'ultima colonna a destra). Un incrocio che lo porterebbe oltre è rifiutato | g05 | Nessuno |
| `lunardiCura` | Lunardi | Lunardi non si ammala mai. Se Lunardi sta **sopra** a un malato, il malato guarisce (la cura vince sul contagio nello stesso incrocio). Se sta sotto, non cura | g09 | Nessuno |

### 3.7 Spilli e matassa

- **Spilli d'ottone** (`pins`, appuntamenti fissi dell'isola): `{filo, luogo, ora}`. Esempio: Don Piero in Chiesa alle 11 per la messa. Sono **obbligatori**: la riga di quell'ora non si può fissare finché non sono rispettati. Il tombolo segnala in rosso, già ore prima, uno spillo diventato irraggiungibile (distanza in colonne maggiore delle righe che restano). Toccando uno spillo si legge di chi è, dove e quando («Teresa al Forno alle 9: appuntamento fisso»); gli spilli d'ottone sono anche fra gli obiettivi.
- **Spilli rossi** (richieste accettate dai bigliettini, 4.2): condizioni facoltative valutate a fine giornata. Il numero di spilli rossi disponibili ogni sera è limitato (sezione 3.13).
- **Spilli verdi** (occasioni): solo nel Merletto Aperto e nell'Archivio A6 (3.10).
- **Matassa**: le braccia di filo della notte. Ogni incrocio fatto dal giocatore costa 1 braccio. Quando la matassa è finita, i fusi non si incrociano più (si può sempre disfare). Il valore di ogni giornata è `minimo per la combinazione di richieste prevista dal design + margine dell'atto` (3.13), calcolato dal solver e salvato nei dati.
- **Lasciar cadere uno spillo rosso**: durante la notte il giocatore può rinunciare a una richiesta accettata (diventa "fallita", con le sue conseguenze). Ogni giornata è garantita risolvibile **senza** richieste, quindi non esistono vicoli ciechi.

### 3.8 Eventi della giornata

- **Regola del Molo e dei bordi** (`edges`). Alle ore delle barche (vaporetto, barca di Bepi) e, nell'Atto III, all'ora della secca sul lato del Faro: **chi si trova nella colonna di bordo esce dal merletto** (parte, o va incontro a chi arriva e lo accompagna via dalla Fondamenta) e **chi arriva prende il suo posto** (un personaggio indicato nei dati, oppure un nuovo filo di lino). Chi esce porta con sé le sue perline e non rientra per il resto della giornata, salvo un evento di bordo che lo faccia rientrare per nome. Il bordo è il Molo (`side: 'molo'`, prima colonna) oppure il Faro (`side: 'faro'`, ultima colonna). Nel Libro: «All'ora delle barche, chi è al Molo se ne va.»
- **Rancore** (`rancore`, Atto II). Coppie in rancore dichiarate nei dati (all'inizio solo Teresa e Marta). Se due fili in rancore si incrociano: **nessun passaggio di perline** (non si parlano), si forma un **nodo** disegnato sul merletto, e tutti e due sono **bloccati nella riga successiva**. Con Teresa e Marta il nodo si combina con `martaNoSotto`: possono incrociarsi solo con Marta sopra, e anche così si annodano.
- **Marea** (`tide`, Atto III). `{daOra, aOra, colonne}`: nelle righe di quelle ore i fili nelle colonne allagate sono bloccati (nessuno entra né esce: c'è l'acqua alta).
- **Filo nero** (`nero`, Atto III): vedi 3.9.

### 3.9 Il filo nero

- Entra dal bordo indicato all'ora indicata (con la regola dei bordi: chi è lì esce).
- Ha un'agenda: una lista di obiettivi `{segui: filo}` (raggiungere un personaggio e incrociarlo) oppure `{luogo, ora}`.
- **Ogni riga si muove da solo** di una colonna verso l'obiettivo, incrociando il vicino in quella direzione, **sempre sopra**. Se il vicino è bloccato, aspetta. Quando incrocia il filo che seguiva, passa all'obiettivo successivo.
- La sua mossa della riga *h* è calcolata dallo stato all'ora *h-1* e **mostrata in anteprima** (un incrocio fantasma tratteggiato) appena si fissa l'ora *h-1*. Il giocatore non può usare quei due fili nella riga *h*.
- I suoi incroci non consumano matassa. Dà lettere, voci e segreti come qualsiasi filo sopra.

### 3.10 Autotessitura (finali, Archivio A6, filo nero)

Nell'Archivio A6 e nei finali "Il filo di seppia" e "Il merletto aperto", alcuni o tutti i fili si muovono da soli con questo algoritmo deterministico (`planAutoRow`). Lo stesso algoritmo muove il filo nero.

1. Per ogni filo autonomo si calcola il **bersaglio** per la riga *h*: il primo elemento della sua agenda non ancora soddisfatto. Un'**occasione** (spillo verde `{tipo, luogo, ora}`) attira i fili che hanno il gusto corrispondente (tabella 5.4) e vale come bersaglio `{luogo, ora}` se l'ora non è passata.
2. Direzione `dir = segno(colonnaBersaglio - colonnaAttuale)`. Margine `slack = (oraBersaglio - (h-1)) - |distanza|`. Un filo senza bersaglio ha `dir = 0` e margine infinito.
3. Coppie candidate (*i*, *i+1*): il filo a sinistra vuole andare a destra e quello a destra vuole andare a sinistra, oppure uno dei due vuole muoversi e l'altro **cede**. Cedono: i lino; i fili con `dir = 0` e margine ≥ 2.
4. Si ordinano le candidate per margine minimo crescente (prima il più urgente), a parità per colonna da sinistra. Si prendono avidamente quelle disgiunte.
5. **Verso**: sta sopra chi ha qualcosa da dare all'altro (lettera indirizzata a lui, o desiderio di tipo "dare"); altrimenti il più urgente; a parità il filo di sinistra. Il filo nero sta sempre sopra.
6. Se un filo è controllato dal giocatore (finale "Il filo di seppia"), la sua mossa si applica per prima e le coppie che lo toccano sono escluse dal calcolo.

### 3.11 Il nome di Ada e la memoria (da g12)

- Ogni notte, prima di tessere, Ada appunta il suo **nome** (perlina `nome`) su un filo a scelta tra quelli presenti. Il nome si diffonde come una voce.
- Ogni personaggio ha una **memoria di Ada** da 0 a 3. All'inizio di g12 è 3 per tutti, tranne Lunardi (1, è appena arrivato).
- A fine giornata, per ogni personaggio presente nel merletto: se ha il nome, `memoria + 1` (massimo 3), altrimenti `memoria - 1` (minimo 0). Chi oggi non era nel merletto non cambia.
- **Memoria 0 = ha dimenticato Ada.** Effetti, tutti visibili: i suoi bigliettini arrivano senza firma, a matita, indirizzati "Alla merlettaia" (4.2, autore da dedurre); nelle vignette la figurina di Ada che parla con lui è legno grezzo senza vernice; nelle battute la chiama "signorina" o "la merlettaia".
- Il finale vero richiede, a fine g22, almeno **4 personaggi con memoria ≥ 1**.

### 3.12 Condizioni (richieste, obiettivi, desideri)

Le richieste dei bigliettini, gli obiettivi obbligatori di prologo e modalità procedurali e i desideri del finale vero sono espressi con lo stesso linguaggio di condizioni (`Condition`). Il solver le compila in pochi bit di stato.

| Condizione | Significato | Quando si valuta |
|---|---|---|
| `presso(chi, luogo, ora)` | `chi` si trova in `luogo` all'ora | A quell'ora |
| `maiPresso(chi, luogo, da, a)` | `chi` non è mai in `luogo` nelle ore da…a | Ogni ora dell'intervallo |
| `incontra(a, b, da?, a?)` | `a` e `b` si incrociano almeno una volta nelle righe indicate | Appena succede; fallisce a fine intervallo |
| `nonIncontra(a, b, da?, a?)` | `a` e `b` non si incrociano mai nelle righe indicate (tutta la giornata se omesse). `b` può essere `*` = nessun filo con nome | Fallisce al primo incrocio |
| `sopra(a, b, entro?)` | `a` incrocia `b` stando sopra almeno una volta | Come `incontra` |
| `consegnata(lettera, entro?)` | La lettera è consegnata al destinatario entro l'ora | All'ora limite (o a fine giornata) |
| `ha(chi, perlina, entro?)` | `chi` tiene o conosce la perlina entro l'ora | All'ora limite |
| `nonHa(chi, perlina)` | `chi` non la tiene mai in tutta la giornata | Fallisce appena la riceve |
| `parte(chi, ora?)` / `resta(chi)` | `chi` esce (o non esce) dal merletto da un bordo | A fine giornata |
| `esceCon(perlina, ora)` | La perlina esce dal merletto con chi esce da un bordo a quell'ora (per esempio una lettera spedita col vaporetto) | A quell'ora |
| `sano(chi)` | `chi` non ha la febbre a fine giornata | A fine giornata |
| `incontriAlmeno(chi, n)` | `chi` incrocia almeno `n` fili diversi con nome | A fine giornata |
| `tutti([...])`, `almeno(n, [...])`, `non(c)` | Combinatori | Come le parti |

### 3.13 Parametri bilanciabili (valori iniziali)

Tutti questi numeri stanno in `src/content/balance.json` e si cambiano senza toccare il codice.

| Parametro | Atto I | Atto II | Atto III | Note |
|---|---|---|---|---|
| Colonne (W) | 3-6 | 6 | 6 | Prologo 3 |
| Righe per giornata | 4-10 | 8-14 | 8-14 | Mai più di 14 |
| Bigliettini per sera | 3 | 3-4 | 4 | |
| Spilli rossi per sera | 2 | 2 | 3 | g23: 2 la sera prima della notte; la scelta del finale usa sempre 1 spillo |
| Margine di matassa | +3 | +2 | +1 | g13: +0 |
| Memoria iniziale | n.d. | 3 (Lunardi 1) | come lasciata | Variazione ±1 al giorno |
| Soglia trabocco del pozzo | n.d. | 3 segreti | 3 | |
| Durata nodo di rancore | n.d. | 1 riga | 1 riga | |
| Lampada dei suggerimenti | sempre visibile, tenue; si accende dopo 60 s senza fissare un'ora o 3 Disfa di fila sulla stessa riga; dopo il primo suggerimento della notte resta accesa | | | |
| Filo d'oro | solo se il minimo della notte è almeno 3 (`oro.minIncroci`) | | | |
| Vignette all'alba | max 3 (4 solo per i culmini, 5.9), ognuna ≤ 8 s con avanzamento automatico attivabile | | | |
| Finale vero | memoria ≥ 1 per almeno 4 personaggi a fine g22 | | | |

**Criteri di qualità delle notti** (revisione 1; calcolati da `npm run levels:check`, bloccanti con `--qualita`; dettagli in `REVISIONE-1.md`, contratto C14). Per la base, ogni bigliettino da solo e ogni combinazione possibile non voluta; la *designata* è la combinazione possibile più cara.

| Criterio | Regola |
|---|---|
| K1 densità | minimo ≥ ⌈righe/2⌉ (designata e ogni bigliettino non marcato `facile`) |
| K2 costo | ogni bigliettino costa almeno 2 incroci più della base (Atto I) o 3 (Atti II-III); al massimo uno per sera può essere `facile`, solo se è in un conflitto voluto |
| K3 Gino | con Gino in scena, la differenza fra il minimo e il minimo senza `ginoCorre` è al massimo il 40% del minimo |
| K4 ritmo | nella soluzione registrata, al massimo 2 righe vuote di fila e al massimo il 40% di righe vuote |
| K5 ambiguità | designata con al massimo 20 soluzioni ottime |
| K6 dilemma | almeno un conflitto voluto per sera (g03-g22) |
| K7 intervallo | minimo della designata nell'intervallo "Min" di 5.2, ±1 (solo avviso) |

Esenti: g00 (tutorial), g01 solo per K2, Archivi, `fin_chiuso`, finali in autotessitura. `fin_merlettaia`: minimo della base ≥ 8, più K3 e K4.

Tempi di animazione (moltiplicati dall'impostazione "Velocità animazioni": 0,5×, 1×, 2×, istantanea):

| Animazione | Durata a 1× |
|---|---|
| Scambio dei fusi | 250 ms |
| Passaggio di una perlina lungo l'incrocio | 350 ms |
| Campana di fine ora | suono 2 s, l'interfaccia non aspetta |
| Annuncio del filo nero | 400 ms |
| Carillon del merletto finito | 1 battito per riga, 380 ms a battito |

### 3.14 Fine giornata: valutazione ed eleganza

1. Si valutano gli obiettivi obbligatori e le richieste accettate: ognuna è **soddisfatta** o **fallita**.
2. Si applicano le **conseguenze** scritte nei dati del bigliettino (flag di storia, memoria, desideri conosciuti, voci di Taccuino).
3. Si calcola l'**eleganza** del merletto, che non incide sulla storia:
   - **Incroci**: totale degli incroci del giocatore. **Filo d'oro** ✦ se è uguale al minimo calcolato dal solver per le richieste accettate quella notte, se quel minimo è almeno 3 (`oro.minIncroci`: una notte chiusa con 0-2 incroci non è un'impresa) e se non si è usato il suggerimento "fantasma" con un incrocio (il fantasma di una riga di quiete non conta).
   - **Ore di quiete**: righe senza incroci. Si conserva il record.
   - **Simmetria** (sì/no): il merletto è simmetrico rispetto all'asse verticale (un incrocio nella coppia *i* alla riga *r* ha il corrispondente nella coppia *W-2-i* alla stessa riga).
4. Record personali per giornata (incroci minimi, quiete massima, simmetria ottenuta). I fili d'oro accumulati sbloccano fusi intagliati (solo estetici, sezione 7).

### 3.15 Esempio giocato e verificato: il Prologo

Verificato con il solver prototipo (minimo 4 incroci, 3 soluzioni ottime che differiscono solo per il verso di un incrocio).

- Colonne: Forno, Piazza, Chiesa. Ore 5 → 9 (righe 6, 7, 8, 9).
- Alle 5: Teresa al Forno, Marta in Piazza, Don Piero in Chiesa. Teresa porta una lettera per Don Piero.
- Spilli d'ottone: Marta al Forno alle 6; Teresa al Forno alle 9; Don Piero in Chiesa alle 9. Obiettivo: lettera consegnata a Don Piero entro le 9.

| Ora | Incrocio (sopra / sotto) | Dopo la riga | Cosa succede |
|---|---|---|---|
| 6 | Marta / Teresa | Marta, Teresa, Piero | Marta apre il forno. A fine riga Teresa ha ancora la lettera e la legge: si accende la sua luce (segreto `letta:L1`) |
| 7 | Teresa / Piero | Marta, Piero, Teresa | Teresa sta sopra: la lettera passa a Don Piero ed è consegnata. Al primo incrocio della riga, qualunque sia il verso, compare la nota «Chi sta sopra, dà.»; se il giocatore ha messo Piero sopra, la lettera trema e non passa |
| 8 | Piero / Teresa (verso indifferente) | Marta, Teresa, Piero | Il segreto di Teresa, se lei sta sopra, finisce nel pozzo |
| 9 | Marta / Teresa | Teresa, Marta, Piero | Se il giocatore trascina Teresa su Marta, il fuso rimbalza: «No.» (prima stranezza). Trascinando Marta su Teresa funziona |

Il merletto si chiude nella stessa forma con cui era cominciato (Teresa, Marta, Piero): il carillon lo suona come una piccola melodia circolare.

### 3.16 Esempio giocato e verificato: Giornata 6, "La lettera da Venezia"

Verificato con il solver prototipo. Serve a mostrare richieste in conflitto e la regola del Molo.

- Colonne: Molo, Forno, Piazza, Chiesa, Farmacia, Faro. Ore 6 → 12.
- Alle 6: lino, Marta, Teresa, Don Piero, Nina, Zeno. Teresa ha la voce "Nina vuole partire".
- Alle 8 arriva il vaporetto: il lino al Molo esce, entra un marinaio (lino) con la lettera per Nina (l'esito dell'esame).
- Spilli d'ottone: Marta al Forno alle 7; Don Piero in Chiesa alle 11.
- Bigliettini (2 spilli rossi):
  - **N1, Nina**: «La lettera da Venezia arrivi a me entro le 11. E la postina non la deve leggere.» → `tutti(consegnata(L1, 11), nonHa(teresa, letta:L1))`
  - **N2, Marta**: «Domani non voglio vedere la Teresa.» → `nonIncontra(marta, teresa)`
  - **N3, Zeno**: «Che il prete non senta chiacchiere su Nina: lo direbbe a suo padre.» → `nonHa(piero, voce:ninaParte)`
- Risultati del solver (versione 1.0): senza richieste 0 incroci; N1 da sola 5; N1+N2 5; N2+N3 0; **N1+N3 impossibile** (per far arrivare la lettera a Nina senza Teresa, Don Piero deve tornare in Chiesa passando da Teresa, che gli dà la voce). Il conflitto è voluto: è la scelta morale della sera. *Revisione 1:* N2 e N3 da sole e N2+N3 costano 0, contro i criteri di 3.13 (K1, K2); il ridisegno di g06 conserva il conflitto N1+N3 e fa costare lavoro anche alle richieste di Marta e Zeno (per esempio uno spillo che porta Teresa e Marta sulla stessa strada).
- Una soluzione ottima per N1+N2 (5 incroci):

| Ora | Incroci (sopra / sotto) | Posizioni dopo la riga |
|---|---|---|
| 7 | nessuno | lino, Marta, Teresa, Piero, Nina, Zeno |
| 8 | nessuno; vaporetto: esce il lino, entra il marinaio con la lettera | marinaio, Marta, Teresa, Piero, Nina, Zeno |
| 9 | Piero / Nina | marinaio, Marta, Teresa, Nina, Piero, Zeno |
| 10 | Marta / marinaio; Teresa / Nina | Marta, marinaio, Nina, Teresa, Piero, Zeno |
| 11 | marinaio / Nina (lettera consegnata); Teresa / Piero | Marta, Nina, marinaio, Piero, Teresa, Zeno |
| 12 | nessuno | invariate |

Matassa della giornata: 5 + 3 = 8.

---

## 4. Core loop

### 4.1 Il minuto (una riga, 5-30 secondi)

1. Guardi la riga dell'ora corrente: spilli, perline, anteprima del filo nero, richieste appuntate.
2. Trascini un fuso sopra quello del vicino: tocco di legno, due note (quelle dei due personaggi).
3. Le perline scorrono lungo l'incrocio; un'anteprima mostra subito l'effetto (nessuna informazione nascosta).
4. Correggi: rovesci, disfi, provi un'altra coppia. Poi **Fissa l'ora**: suona la campana, gli spilli rispettati si accendono, si passa alla riga dopo.

### 4.2 La sessione (una Giornata, 10-20 minuti)

1. **La sera** (1-2 min). Alla porta arriva un oggetto (una bottiglia con una lettera firmata "L.", una pagina strappata, un fuso intagliato): una ricompensa garantita, anche dopo una giornata andata male. La frase d'arrivo dice da dove viene: la laguna, la mano di qualcuno, sotto la porta, la casa stessa (5.6). Poi sotto la porta scivolano i **bigliettini** (3-4). Per ognuno Ada può:
   - **Appuntarlo** con uno spillo rosso: diventa una richiesta per la notte. Gli spilli sono pochi (3.13): il pulsante dice quanti ne restano («Appunta · restano 2 spilli») e, quando sono finiti, come liberarne uno;
   - **Rispondere**, se il bigliettino lo permette: due risposte scritte, che non consumano spilli e cambiano i bigliettini dei giorni dopo, le battute dell'alba e a volte un desiderio conosciuto;
   - **Lasciarlo**: anche ignorare ha conseguenze scritte.
   - **Bigliettino anonimo** (da g12, se l'autore ha dimenticato Ada): prima di appuntarlo Ada deve scegliere chi l'ha scritto tra i personaggi, deducendolo dal modo di scrivere. Se sbaglia, la richiesta vale per la persona sbagliata e all'alba il vero autore resta deluso (quadro del fallimento).
2. **La notte** (6-12 min). Da g12, prima appunta il nome di Ada su un filo. Poi tesse il merletto del giorno dopo, riga per riga.
3. **L'alba** (20-40 s, si può saltare). "Il giorno accade": fino a 3 vignette (4 se servono per i culmini, 5.9). Ogni vignetta è un diorama fermo, con 1-2 figurine e una riga di testo accompagnata dal borbottio sintetico del personaggio. Una vignetta per una richiesta fallita mostra sempre un'informazione nuova (quadro del fallimento). Intanto il merletto suona come un carillon. Alcune giornate finiscono con una **consegna a mano** dopo l'ultima vignetta: qualcuno bussa e Ada legge subito quello che le porta (la lettera di Clotilde in g14, il fascio di Livia in g16; 5.6).
4. **Il bilancio** (30 s). Richieste soddisfatte e fallite con la loro conseguenza in una riga (scritta per quel bigliettino, mai una frase generica), nuove voci del Taccuino (mai una che ripete la conseguenza appena letta), eleganza e record. Pulsante "Riascolta il merletto".
5. **Archivio** (facoltativo, 5-10 min, quando sbloccato). Un merletto antico da leggere e rammendare (5.3). Facoltativo davvero: dalla Pausa «Lascia per ora» riporta alla cassapanca e alla storia.

Salvataggio automatico: a ogni ora fissata, a ogni passaggio di fase, quando la pagina si nasconde o l'app va in pausa.

### 4.3 Il meta (ore)

- 24 giornate di storia + una giornata finale, in 3 atti (autunno, inverno, primavera).
- Ogni atto introduce 2-4 regole con lo schema: introduzione sicura, sviluppo, combinazione, svolta.
- Sei **destini** cambiano davvero (5.1) e decidono quali finali sono possibili.
- Il **Taccuino** accumula conoscenza (stranezze, desideri, verità, lettere). Sopravvive ai riavvolgimenti della storia.
- Sei **merletti d'Archivio** raccontano la colpa della nonna, dalla più piccola alla più grande, e insegnano l'ultimo punto.

---

## 5. Struttura e contenuti

### 5.1 Destini (flag di storia)

| Flag | Valori | Dove si decide | Effetti |
|---|---|---|---|
| `nina` | `parte` / `resta` | g20 (preparato da g03, g06, g10) | Epiloghi, finale vero (desiderio di Nina e Bepi) |
| `riconciliate` | sì / no | g18 (preparato da g11, arc1, arc3) | Rimuove `martaNoSotto`, `teresaLegge` e il rancore; requisito del finale vero |
| `bepi` | `salvo` / `ferito` | g15 | Battute, epiloghi |
| `lettereLivia` | `liberate` / `sepolte` | g16 | Requisito del finale vero; voce di Livia nel Taccuino |
| `zenoLivia` | sì / no | g22 (incontro di Zeno e del filo nero) | Epiloghi; desiderio di Zeno |
| memoria di Ada | 0-3 per personaggio | g12-g22 | Bigliettini anonimi, finale vero |

Flag minori (stringhe e numeri): risposte ai bigliettini (`risposta:<idBigliettino>`), richieste soddisfatte (`ok:<id>`), `febbreCurati` (0-4, g13), `ginoFaro` (desiderio di Gino soddisfatto).

### 5.2 Le giornate

Convenzioni: colonne abbreviate **M**olo, **F**orno, **P**iazza, **C**hiesa, F**a**rmacia, Fa**r**o. Le posizioni iniziali precise, le perline e gli spilli d'ottone li scrivono i pacchetti di contenuto e li verifica il solver (`npm run levels:check`), rispettando i vincoli di ogni riga. "Min" è l'intervallo atteso del minimo di incroci per la combinazione di richieste prevista (la *designata*), con la regola di Gino della revisione 1. Ogni notte rispetta inoltre i criteri di qualità di 3.13; una notte che non li rispetta si ridisegna (cast, intenzioni dei bigliettini e conflitti voluti restano).

#### ATTO I. L'ordito (autunno). Insegna: incrocio, spillo, sopra dà, voce, Molo, segreto, pozzo.

| ID | Titolo | Colonne / ore | Fili | Novità | Min | Momento di storia |
|---|---|---|---|---|---|---|
| g00 | Il merletto della nonna | F P C / 5→9 | Teresa, Marta, Piero | Incrocio, spillo, sopra dà, prima stranezza | 4 | Clotilde è morta, l'orologio è fermo alle 5:59. Ada finisce il merletto e il sole sorge |
| g01 | La prima sera | M F P C / 6→11 | Gino, Marta, Teresa, Piero | Bigliettini, `ginoCorre` (non sta fermo due ore di fila) | 3-5 | L'isola scopre che la merlettaia nuova è una ragazzina |
| g02 | Si dice | M F P C / 6→12 | Gino, Marta, Teresa, Piero | Voce, matassa visibile | 4-6 | La voce gira: "la piccola tesse peggio della vecchia" |
| g03 | Il vaporetto delle nove | M F P C / 6→12 | Nina, Marta, Teresa, Piero (+ lino) | Regola del Molo (vaporetto alle 9) | 4-6 | Nina vuole andare a Venezia per l'esame |
| g04 | La barca di Bepi | M F P C A / 6→14 | Bepi, Nina, Marta, Teresa, Piero | Barca: Bepi esce alle 8, rientra alle 11 | 10 | Bepi non vuole che la figlia parta |
| g05 | Il guardiano | M F P C A R / 6→13 | lino, Gino, Marta, Teresa, Piero, Zeno | `zenoFaro`, sei colonne (la Farmacia è chiusa: lino) | 5-8 | Zeno riceve una lettera firmata "L.": «Questa calligrafia… no, non può essere.» |
| g06 | La lettera da Venezia | M F P C A R / 6→12 | lino, Marta, Teresa, Piero, Nina, Zeno | Segreto, `teresaLegge` formale | 10 | Esempio 3.16. Arriva l'esito dell'esame di Nina |
| g07 | Il pozzo | M F P C A R / 6→14 | Marta, Teresa, Piero, Nina, Gino, Zeno | `pieroPozzo` formale, `ninaCuriosa` | 10 | Teresa vuole confessarsi: trent'anni fa lesse una lettera di Marta |
| g08 | Il filo nero | M F P C A R / 6→16 | Marta, Teresa, Piero, Nina, Gino, Zeno | Combinazione di tutto (vaporetto alle 9) | 14 | Chiuso il merletto, sul bordo alto (ore 3 della notte) compare un filo nero che Ada non ha tessuto e che incrocia Zeno al Faro: il giocatore lo **vede** (apparizione, `apparizione` nei dati). Fine Atto I |

Archivio sbloccato: **arc1** dopo g03, **arc2** dopo g07.

#### ATTO II. La trama (inverno). Insegna: febbre e cura, rancore, nome di Ada, trabocco.

| ID | Titolo | Colonne / ore | Fili | Novità | Min | Momento di storia |
|---|---|---|---|---|---|---|
| g09 | Il farmacista | 6 col / 6→14 | Gino (malato, a letto finché non è curato), Marta, Teresa, Piero, Nina, lino → Lunardi | Febbre, `lunardiCura`, Gino malato non corre; Lunardi arriva col vaporetto delle 8 e apre la Farmacia alle 10 (spillo d'ottone) | 10 | Un medico forestiero: l'isola diffida. Curare Gino lo rimette a correre |
| g10 | La settimana della febbre | 6 col / 6→16 | Gino e Bepi malati, Marta, Teresa, Lunardi, Nina | Quarantena: forno e chiesa devono funzionare (spilli d'ottone) | 17 | Marta vuole stare vicino a Gino malato (risposta: desiderio di Marta) |
| g11 | Il nodo | 6 col / 6→16 | Marta, Teresa, Piero, Gino, Lunardi, Nina | Rancore Teresa-Marta | 11 | Teresa e Marta si incrociano per la prima volta: nodo |
| g12 | Il nome | 6 col / 6→16 | Marta, Teresa, Piero, Lunardi, Bepi, Zeno | Nome di Ada e memoria | 14 | Lunardi chiede «E lei chi sarebbe?». La figurina di Ada perde il primo colore |
| g13 | La notte più lunga | 6 col / 6→20 | 4 malati (Gino delira: a letto finché ha la febbre), Lunardi, Marta | Margine di matassa 0 | 19 | Si possono curare tutti solo con un merletto perfetto. Specchio del 1958 (arc3) |
| g14 | La lettera di Zeno | 6 col / 6→16 | Zeno, Piero, Teresa, Marta, Nina, Gino | Nessuna nuova regola | 16 | Alla fine dell'alba Zeno bussa e consegna la lettera che il filo d'avorio gli diede alle 2 (6.4): Ada la legge subito, prima del bilancio; poi la cassapanca con l'Archivio 1951. Svolta di metà gioco |
| g15 | La tempesta | 6 col / 6→20 | Bepi in mare (fuori dal merletto), Zeno, Nina, Marta, Gino, Piero + lino | Bepi rientra sempre alle 20 (barca al Molo). Se Zeno non è al Faro alle 18, 19 e 20 (richiesta di Nina), la barca urta la secca e Bepi torna ferito: destino `bepi` | 19 | Zeno al Faro tutta la sera, mentre sul bordo alto del merletto torna a vedersi il filo nero lontano |
| g16 | Il pozzo trabocca | 6 col / 6→18 | Piero (custodisce il fascio delle lettere di Livia), Teresa, Zeno, Nina, Marta, Gino | `pieroTrabocca` | 17 | Far traboccare il pozzo e portare il fascio a Zeno senza che Teresa lo legga (Ada non ha filo: il fascio è indirizzato a lei presso il Faro, quindi è consegnato quando arriva a Zeno). Fine Atto II: se le lettere sono liberate, alla fine dell'alba Zeno porta il fascio e Ada legge la voce di Livia |

Archivio: **arc3** dopo g11, **arc4** dopo g14.

#### ATTO III. Il rovescio (primavera). Insegna: filo nero, marea. Ribalta: regole che si tolgono.

| ID | Titolo | Colonne / ore | Fili | Novità | Min | Momento di storia |
|---|---|---|---|---|---|---|
| g17 | La donna in nero | 6 col / 6→16 | Zeno, Teresa, Marta, Nina, Gino, Piero + nero (entra dal Faro alle 9: chi è al Faro alle 9 esce, quindi non deve esserci Zeno) | Filo nero autonomo, che segue Zeno | 7-9 | Una donna con lo scialle nero sulla Fondamenta. Nessuno la riconosce, tranne Zeno |
| g18 | La pace | 6 col / 6→16 | Teresa, Marta, Gino, Nina, Piero, Lunardi | Riconciliazione: la confessione di Teresa deve arrivare a Marta passando da Gino (il segreto scende soltanto e Marta non sta sotto Teresa) | 12 | Se riesce: `riconciliate`, si tolgono `martaNoSotto`, `teresaLegge` e il rancore. Le regole cambiano davanti al giocatore |
| g19 | Acqua alta | 6 col / 6→16 | Bepi, Nina, Marta, Teresa, Zeno, Lunardi | Marea: Molo e Piazza allagati 10-13 | 8-10 | La laguna si alza: l'isola è più piccola |
| g20 | Nina | 6 col / 6→14 | Nina, Bepi, Marta, Gino, Teresa, Zeno | Vaporetto delle 9 | 11 | Nina parte per Venezia o resta. Bepi vuole salutarla «come si deve» |
| g21 | Il punto aperto | 6 col / 6→18 | Teresa, Marta, Piero, Gino, Zeno, Lunardi + nero | Nero + marea | 9-11 | La sera prima Ada ha letto arc6: sa che esiste un punto senza merlettaia |
| g22 | La secca | 6 col / 6→20 | Zeno, Piero, Teresa, Marta, Gino, Nina/Bepi + Livia | Bordo del Faro: alle 15 Livia arriva a piedi sulla lingua di sabbia (chi è al Faro esce) | 19 | Livia sull'isola. Se Zeno la incrocia: `zenoLivia`. Controllo della memoria per il finale vero |
| g23 | La vigilia | 6 col / 6→12 | Tutti quelli rimasti | Nessuna; 2 bigliettini semplici, 2 spilli | 9 | Giornata breve e quieta. Dopo la notte, la sera della scelta (6.6), con un solo spillo |

Archivio: **arc5** dopo g18, **arc6** la sera di g20.

#### Le giornate finali

| ID | Finale | Meccanica | Obiettivo |
|---|---|---|---|
| `fin_merlettaia` | La merlettaia | Tessitura normale, 6 colonne, 6→18 | Almeno quattro saluti su sei, fatti **dando**: chi saluta passa sopra a Livia e le consegna qualcosa (il pane di Marta, una lettera di Teresa, la benedizione di Don Piero, la valigia di Zeno…), con almeno un conflitto voluto; poi Livia sale volontariamente sul vaporetto delle 18. Minimo della base ≥ 8 (3.13). Il filtro sulla memoria della 1.0 cade: con la memoria a zero chi saluta Livia non ricorda Ada, e il saluto vale lo stesso |
| `fin_seppia` | Il filo di seppia | Ada ha un filo corallo e il giocatore muove **solo quello**; tutti gli altri si muovono con l'autotessitura secondo l'agenda scritta da Livia | Ada incontra sei persone (sta sotto: riceve) prima delle 18 |
| `fin_chiuso` | Il merletto chiuso (finale falso) | Tessitura normale, 6→9 | Portare Livia al Molo alle 9. Quando si fissa l'ora 9 il giocatore vede il nodo chiudersi su tutti i fili e il merletto disfarsi all'indietro (`chiusura: 'nodo'`), senza suono di successo; non si salva: «Questo merletto l'ho già visto.» Si torna alla sera di g23, dove il biglietto di Clotilde resta piegato |
| `fin_aperto` | Il merletto aperto (finale vero) | Nessun incrocio manuale. Ada pianta fino a **5 occasioni** (spilli verdi) e preme "Lascia accadere": il giorno si tesse da solo (3.10). Si può riprovare all'infinito | Tutti i desideri soddisfatti nello stesso merletto (5.4), Ada e Livia si incontrano, nessuno parte contro voglia |

### 5.3 L'Archivio (6 merletti antichi)

**Come si gioca.** Un merletto d'Archivio è un merletto già finito, disegnato con lo stesso motore, con i fili **sbiaditi** (grigi, senza icona) e 1-2 righe **strappate**.

1. **Nominare.** Si tocca (o si tiene premuto) un fuso sbiadito, un tratto qualunque del suo filo anche dopo che è uscito dal merletto, oppure una voce dell'elenco «Fili da nominare», e gli si assegna un nome tra i candidati (che comprendono sempre un'esca). Gli indizi sono scritti nella grammatica imparata giocando: chi è sempre in Chiesa alle 11, chi non sta mai sotto un altro, chi inghiotte le lettere, chi resta vicino al Faro, chi esce col vaporetto, le note a margine. Come in Obra Dinn, **nessun contatore dice quali nomi sono giusti**: si vede solo quanti nomi sono stati dati. Quando fra i nomi provvisori ce ne sono **almeno 3 giusti** (o tutti quelli che restano, se sono meno di 3) si confermano da soli e i fili si ricolorano. Un nome già dato a un altro filo si sposta (niente doppioni). Se tutti i fili hanno un nome e la conferma non scatta: «Tre nomi giusti non ci sono ancora».
2. **Rammendare.** Le righe strappate si ritessono con i normali controlli del tombolo. Lo stato dopo il rammendo (posizioni e perline) deve coincidere con quello registrato nella riga successiva. La matassa è uguale agli incroci originali.
3. **Eco.** Si sblocca la vignetta del ricordo, toccando gli incroci si leggono gli echi (frasi dette in quell'incontro, con i due nomi del crocevia) e nel Taccuino si chiudono una o più domande.

«Chiudi il merletto» dice sempre che cosa manca (nomi o rammendo). «Ricomincia la notte» conserva i nomi confermati. Dalla Pausa «Lascia per ora» torna alla cassapanca. Il primo Archivio (arc1) ha un tutorial (nomina, rammenda, eco); nel layout largo il pannello di sinistra elenca fili da nominare, candidati, strappi ed echi. «Rileggi» apre un merletto rammendato in sola lettura.

| ID | Anno | Titolo | Fili (candidati; esca in corsivo) | Cosa si scopre | Nota a margine di Clotilde |
|---|---|---|---|---|---|
| arc1 | 1936 | La lettera di Marta | Marta, Teresa, Ernesto (marinaio), Don Anselmo; *Clotilde* | Clotilde fece portare a Teresa la lettera in cui Ernesto chiedeva a Marta di partire con lui, e la fece leggere in Piazza all'ora del mercato. La voce arrivò al padre di Marta. Ernesto partì solo. Esca: la merlettaia non ha filo | «Perché restasse.» |
| arc2 | 1965 | L'ultimo merletto | Zeno, Piero, Teresa, lino, filo d'avorio; *Livia* | Il filo d'avorio è Clotilde, l'ultima volta che si è tessuta dentro (la prima fu il merletto di prova di arc6). Alle 2 passa sopra Zeno al Faro e gli consegna una lettera. Alle 3 il filo è tagliato: Clotilde muore | «Un'ultima volta, dentro.» |
| arc3 | 1958 | La febbre | Teresa, Aldo, il vecchio dottor Bortolo, Marta, Bepi; *Lunardi* (allora non era sull'isola) | Nell'epidemia, Clotilde fece arrivare il medico prima ai sei bambini della scuola e lasciò la febbre ad Aldo, il fidanzato di Teresa, che l'estate dopo l'avrebbe portata via in terraferma. Aldo morì | «Uno per sei. E uno che restava.» |
| arc4 | 1951 | Il vaporetto delle nove | Livia, Zeno, Piero, Teresa, Bepi; *Ernesto* (partito nel 1936) | Livia voleva un merletto "aperto" e litigò con la madre. Clotilde la tessé al Molo all'ora del vaporetto. Zeno le portò la valigia credendo a una gita. La lettera di Livia per la figlia di due anni finì a Don Piero | «Non ancora.» |
| arc5 | 1630 | Il primo merletto | Arianna, cinque fili di appestati e sani (nominati per mestiere: il barcaiolo, la vedova, il fornaio, il prete, il bambino); *Clotilde* | Arianna tessé la quarantena durante la peste: tenne lontani malati e sani e salvò l'isola, che la dimenticò. Nasce la regola «chi tesse non è tessuto» | Mano di Arianna: «Chi tesse non è tessuto.» Sotto, mano di Clotilde: «Lo so.» |
| arc6 | Senza data | Il punto aperto | Quattro fili (Clotilde giovane, Livia bambina, Zeno, Piero giovane cappellano): la prima volta che la merlettaia si è data un filo | Un merletto di prova in cui Clotilde non incrocia nulla: pianta solo occasioni, e i fili si incrociano da soli secondo i desideri. Il rammendo qui si fa **piantando occasioni** (tutorial del finale vero) | «Non ho avuto il coraggio.» |

### 5.4 Personaggi

Ogni personaggio-filo ha: colore saturo (solo il filo e la fascia della figurina), un motivo disegnato sul filo, un'icona sul fuso, una nota della scala di Re dorico, una voce sintetica, una calligrafia (inchiostro, carta, inclinazione), stranezze, un desiderio da scoprire e dei gusti per le occasioni del finale vero.

| ID | Nome, ruolo, età | Colore (hex) | Motivo | Icona | Nota | Stranezza | Desiderio (come si scopre) | Gusti (occasioni) |
|---|---|---|---|---|---|---|---|---|
| `teresa` | Teresa Bortolato, postina, 54 | Blu cobalto `#2F5DA8` | Righe oblique | Busta | La4 | `teresaLegge` | «Una lettera scritta per me.» (arc3 + risposta in g18) | festa, messa |
| `marta` | Marta Zennaro, fornaia, 52 | Rosso mattone `#C0442C` | Puntini | Pagnotta | Re4 | `martaNoSotto` | «Che Gino non se ne vada come Ernesto.» (arc1 + risposta in g10) | messa, pane |
| `piero` | Don Piero Vianello, parroco, 64 | Viola liturgico `#6E3D96` | Filo doppio | Croce | Re3 | `pieroPozzo`, `pieroTrabocca` | «Restituire quello che custodisco.» (lettera di Clotilde g14, g16) | messa |
| `gino` | Gino Zennaro, figlio di Marta, 11 | Azzurro `#4FB3E0` | Onde | Aquilone | Mi5 | `ginoCorre` | «Vedere la lanterna del Faro accesa da dentro.» (bigliettino di Zeno in g05, o g13) | festa, pane, lanterna |
| `bepi` | Bepi Scarpa, pescatore, 48 | Arancio `#E07B24` | Zig-zag | Pesce | Sol3 | nessuna (ha la barca) | «Salutare Nina come si deve.» (g20) | festa, vaporetto |
| `nina` | Nina Scarpa, 17 | Giallo `#E8C12E` | Tratteggio | Libro | Si4 | `ninaCuriosa` | «Studiare a Venezia, fare la maestra.» (g03) | vaporetto, festa |
| `zeno` | Zeno Busetto, guardiano del faro, 61 | Verde petrolio `#1F8A78` | Catenella | Lanterna | Do4 | `zenoFaro` | «Chiedere perdono a Livia.» (g14) | lanterna |
| `lunardi` | Dottor Ettore Lunardi, farmacista, 39 (dall'Atto II) | Argento `#D9DEE3` | Punto croce | Ampolla | Fa4 | `lunardiCura` | «Che l'isola mi chiami per nome.» (g12-g13) | pane, festa |
| `livia` | Livia Vio, madre di Ada, 38 (filo nero, Atto III) | Nero di seppia `#15110E`, riflesso `#3B2F27` | Lucido (riflesso che scorre) | Scialle | La3 | autonoma, sempre sopra | «Rivedere Ada.» (automatico in g17) | segue Ada |
| `ada` | Ada Vio, 16, la merlettaia | Corallo `#F07C6C` | Perlato | Fuso | Re5 | (filo solo nei finali) | «Avere un filo.» (g23) | segue Livia |
| `clotilde` | Clotilde Vio, la nonna (filo d'avorio, Archivio) | Avorio `#EFE3C8` | Liscio | Forbici | Do5 | come persona | n.d. | n.d. |
| `lino` | Passanti, barcaioli, marinai | Lino grezzo `#8E8676` | Nessuno, filo sottile (60%) | Nessuna | legno senza nota | vedi 3.2 | n.d. | cedono sempre |

Personaggi solo d'Archivio (fili sbiaditi, figurine riusate con un viraggio): Ernesto (1936), Don Anselmo (1936), Aldo (1958), dottor Bortolo (1958), Arianna (1630).

**Voci in breve** (per chi scrive i testi):

- **Teresa**: parla molto e in fretta, curiosa e sola, dice "cara" a tutti. Scrive su carta celeste da lettera, inchiostro blu, calligrafia ordinata da ufficio postale.
- **Marta**: frasi corte, orgoglio, mani nella farina. Carta da pane, matita grassa, maiuscole.
- **Don Piero**: lento, gentile, pieno di silenzi; non mente mai ma tace molto. Inchiostro viola, latino scappato qua e là.
- **Gino**: punti esclamativi, errori di ortografia, disegnini.
- **Bepi**: burbero, affettuoso solo con i gesti. Scrive pochissimo, sbaglia le doppie.
- **Nina**: impaziente, ironica, cita i libri. Quaderno a righe.
- **Zeno**: poche parole, parla del mare e della luce. Grafia grande e storta.
- **Lunardi**: cortese, preciso, un po' ridicolo; parla in italiano di città. Ricettario.
- **Livia**: calda, triste, ironica come Nina; scrive "Ada mia".
- **Clotilde**: solo note a margine, color seppia, frasi brevissime e definitive.

### 5.5 Luoghi

| ID | Luogo | Icona | Abitudini (spilli d'ottone tipici) | Diorama |
|---|---|---|---|---|
| `molo` | Molo | Bitta con cima | Vaporetto 8 o 9 e 18; barca di Bepi alle 7 | Pali, vaporetto, barche |
| `forno` | Forno | Pagnotta | Marta dalle 6 alle 7 | Bocca del forno, pale |
| `piazza` | Piazza | Vera da pozzo | Mercato 9-11, festa | Pozzo di pietra, panchine, lampione |
| `chiesa` | Chiesa | Campanile | Messa: Don Piero alle 7 o alle 9, e alle 11 | Sagrato, portale, campanile con l'orologio |
| `farmacia` | Farmacia | Mortaio | Lunardi dalle 10 (Atto II) | Bancone, vasi |
| `faro` | Faro | Faro | Zeno sempre vicino; luce dalle 18 | Faro bianco e rosso, scogli |

Più la **stanza di Ada** (titolo, prologo, sera): il tombolo sul cavalletto, la sedia vuota della nonna, la finestrella, la cassapanca dell'Archivio.

### 5.6 Gli oggetti della sera (la laguna restituisce)

Ogni sera arriva un oggetto, garantito, con due eccezioni volute (la sera dopo la consegna della lettera di Clotilde, quando la laguna è nera di tempesta, e la prima sera dell'Atto III). La **provenienza** è scritta nei dati (`campaign.json`, `objects`) e decide la frase d'arrivo: *laguna* («Bussano alla porta. La laguna ha lasciato qualcosa.»), *mano* («Zeno bussa alla porta. Ha qualcosa per te.»), *porta* («Sotto la porta, un biglietto.»), *casa* («Sul tombolo ti aspetta ancora qualcosa della nonna.»). Le **consegne a mano** importanti avvengono alla fine dell'alba, prima del bilancio (`dawnObject`). Le voci del Taccuino su un oggetto si sbloccano solo quando Ada lo legge.

| Quando | Oggetto | Provenienza | Contenuto |
|---|---|---|---|
| Sera di g01 | L'ultimo merletto della nonna (sul tombolo) + il Libro dei Punti | casa | Apre la domanda «Di chi è il filo d'avorio?» |
| Sere di g02-g14 (tranne g06 e g10) | Bottiglia con lettera di "L." (11 lettere) | laguna | Frammenti della vita di Livia in terraferma, senza nomi; sempre "Cara mia". Esempi in 6.5 |
| Sera di g06 | Fuso intagliato a forma di faro | laguna | Lo ha perso Zeno: dentro c'è un'iniziale, "L." |
| Sera di g10 | Pagina strappata dal Libro dei Punti | laguna | Il disegno del "punto aperto", senza spiegazione |
| Fine dell'alba di g14 | La lettera di Clotilde | mano (Zeno) | Testo in 6.4. Poi bilancio e Archivio 1951 |
| Sera di g15 | Niente | – | «Stasera la laguna non porta niente: è nera, e si alza il vento.» |
| Sera di g16 | Una bottiglia vuota con dentro un nodo di filo nero | laguna | Nessun testo: il segno che qualcuno sta tessendo da fuori |
| Fine dell'alba di g16 | Il fascio delle lettere di Livia (se liberate) | mano (Zeno) | 3 lettere leggibili e «altre centosessantacinque» (una al mese per quattordici anni) |
| Sera di g17 | Niente (cartello dell'Atto III, primavera) | – | «Sotto la porta non c'è niente. Fuori, qualcuno cammina sulla Fondamenta.» |
| Sere di g18-g23 | Bigliettini di Livia ("Sto arrivando") | porta | Diretti, firmati |
| Sera della scelta (dopo g23) | Il nastro della nonna | casa | Il filo d'avorio avanzato: lo nominano gli epiloghi A e D |

### 5.7 Il Libro dei Punti

Un libro di cuoio che si apre a pagine. Ogni regola ha una pagina con un disegno (generato in codice dal motore: un mini-merletto di 3 righe animato) e un breve testo d'istruzione, più le note a margine della nonna in corsivo color seppia. Le pagine si aggiungono quando la regola si introduce, segnate «Nuova»: la prima volta che il Taccuino si apre in quella notte, si apre su quella pagina. Sul tombolo ogni regola nuova si annuncia nella sua prima notte con una nota a margine e una pulsazione sull'elemento che riguarda (revisione 1; tabella delle prime volte in `REVISIONE-1.md`, D03). Elenco:

1. **L'incrocio**: «Due fili che si incontrano si scambiano il posto.» Margine: «La Fondamenta è stretta: per passare bisogna parlarsi.»
2. **Lo spillo**: «Lo spillo d'ottone è un appuntamento: non si sposta.» Margine: «Il pane alle sei, la messa alle undici. Il resto si può cambiare.»
3. **Chi sta sopra, dà**: lettere. Margine: «Chi sta sopra, dà. Chi sta sotto, riceve. Non è una questione d'onore.»
4. **La voce**. Margine: «La voce non ha verso.»
5. **La matassa**: «Il filo di una notte è contato.» Margine: «Chi spreca filo, spreca vite.»
6. **Il Molo**. Margine: «All'ora delle barche, chi è al Molo se ne va.»
7. **Il segreto**. Margine: «Il segreto scende soltanto.»
8. **Il pozzo**. Margine: «Don Piero è un pozzo. Ma anche i pozzi si riempiono.»
9. **La febbre**. Margine: «La febbre non chiede permesso.»
10. **Il nodo**. Margine: «Due che si odiano, se si incontrano, restano fermi.»
11. **Il nome** (pagina scritta da Ada stessa, a matita). «Chi ti nomina, ti tiene.»
12. **Il filo nero** (pagina senza note della nonna: è vuota, Ada la scrive). «Non l'ho tessuto io.»
13. **La marea**. Margine: «L'acqua alta fa l'isola più piccola.»
14. **Il punto aperto** (pagina strappata in g09, completata dopo arc6). Margine: «Non ho avuto il coraggio.»

### 5.8 Il Taccuino di Ada

Un unico pannello a schede, raggiungibile sempre (pulsante in basso, tasto Tab). Schede:

1. **Bigliettini**: i bigliettini della sera, le richieste appuntate con il loro stato in tempo reale (soddisfatta, in corso, a rischio, fallita).
2. **Persone**: una scheda per personaggio con figurina, colore, motivo, icona, stranezze scoperte (con la fonte: "visto" oppure "dal Libro"), desiderio ("?" finché non è scoperto), memoria di Ada (3 puntini, da g12), frasi notevoli.
3. **Libro dei Punti**: le pagine sbloccate.
4. **Domande**: i fili sciolti, cioè le domande aperte. Una sola è evidenziata come **pista** del momento, con il testo "Dove guardare". Una pista arriva sempre prima della risposta e sparisce quando la domanda è risolta; dopo la scelta di g23 non c'è più pista. Le domande si chiudono con una risposta in una riga. Elenco: «Di chi è il filo d'avorio?», «Perché Marta e Teresa non si parlano?», «Chi è L.?», «Chi tesse il filo nero?», «Che cosa custodisce Don Piero?», «Che cosa successe nel 1958?», «Perché mia madre se n'è andata?», «Cos'è il punto aperto?», «Che cosa vuole ognuno?» (si chiude con 8/8 desideri).
5. **Lettere di L.**: le lettere arrivate, rileggibili dalla prima bottiglia.
6. **Archivio**: i merletti antichi e il loro stato (nuovo, nominato, rammendato).

Il Taccuino contiene indizi e collegamenti, mai soluzioni, e mai anticipazioni: una voce su un oggetto, una lettera o una persona si sblocca solo quando Ada li ha visti (condizione `{knows: 'oggetto'}`). Le voci già lette sono riassunte in una riga. Le schede stanno in una sola riga che scorre.

**Voci del Taccuino** (`diary.*.json`): circa 80 in tutto. Ognuna ha `id`, sezione, testo, condizione di sblocco (`StoryCond`), e se apre o chiude una domanda. Esempi:

- `persona.marta.noSotto` (sblocco: evento `stranezza martaNoSotto`): «Marta non passa mai sotto Teresa. Me l'ha detto con un "No." che ha fatto tremare il tombolo.»
- `domanda.avorio.indizio1` (sblocco: arc2 nominato): «Il filo d'avorio è passato sopra Zeno alle due. Gli ha dato qualcosa.»
- `desiderio.gino` (sblocco: richiesta `g05.zeno` soddisfatta, oppure risposta in g13): «Gino vuole vedere la lanterna accesa da dentro. Lo ha scritto tre volte, con tre errori diversi.»

### 5.9 Le battute (sistema alla maniera di Hades, ma piccolo)

- **Vignette scritte per la giornata** (`level.dawn.candidates`): 3-5 per giornata, ognuna con condizione (`StoryCond`) e priorità. Sono le scene importanti: richiesta soddisfatta o fallita, momento di storia.
- **Battute generiche** (`lines.json`): per ogni personaggio, 2 varianti per ognuno di 7 eventi del merletto (`incontro`, `consegna`, `voce`, `segreto letto`, `rifiuto`, `nodo`, `cura`) più 4 battute "di riserva" per l'alba qualunque. Circa 130 battute. Esempio: Marta su `incontro` con Teresa sopra non può esserci; Marta su `nodo` con Teresa: «Neanche il Signore mi fa passare di lì.»
- **Selezione all'alba** (revisione 1):
  1. le vignette scritte di priorità ≥ 100 (**culmini**) escono tutte, nell'ordine dei dati, anche se parla lo stesso personaggio di seguito; una vignetta con `dopo: <id>` esce subito dopo quella (es. la pace e poi il pane caldo in g18); il massimo sale a 4 solo per i culmini;
  2. poi le altre vignette scritte per priorità (richiesta fallita 80, soddisfatta 60, stranezza scoperta 50), scartando due vignette consecutive dello stesso personaggio e quelle già mostrate negli ultimi 3 giorni (salvo priorità ≥ 80), fino a 3;
  3. le **battute generiche** (10) si aggiungono solo se le vignette scritte sono meno di 2 e mai in una giornata con un culmine; quelle di riserva solo se non c'è nessuna vignetta scritta; le battute che citano fatti (numeri, persone) hanno una condizione che li rende veri;
  4. gli avvisi delle voci nuove del Taccuino compaiono dopo l'ultima vignetta.
- **Battute per chi ha dimenticato Ada**: ogni battuta può avere una variante `dimentica` (usa "signorina", "la merlettaia").
- Lunghezza massima: 90 caratteri per riga di testo, 2 righe per vignetta.

---

## 6. Storia completa (bibbia della verità)

### 6.1 Cronologia (scritta prima di tutto il resto)

| Anno | Fatto |
|---|---|
| 1630 | Peste nella laguna. Arianna, ricamatrice, scopre che quello che tesse di notte accade: tesse la quarantena e salva l'isola. Non avendo un filo, viene dimenticata. L'isola prende il nome di una santa che nessuno sa chi fosse |
| 1630-1905 | Una merlettaia per generazione, quasi sempre nella stessa famiglia (Vio). Il potere passa a chi tiene il tombolo la notte in cui la merlettaia precedente muore |
| 1905 | Clotilde Vio, 19 anni, eredita il tombolo |
| 1927 | Nasce Livia, figlia di Clotilde |
| 1936 | Clotilde fa leggere a Teresa in Piazza la lettera di Ernesto a Marta. Marta resta, Ernesto parte solo. Da allora Marta non passa sotto Teresa (arc1) |
| 1949 | Nasce Ada, figlia di Livia e di un marinaio di Chioggia che non torna (fatto noto, non un mistero) |
| 1951 | Livia vuole diventare merlettaia "a modo suo": tessere solo occasioni, lasciare che le persone scelgano. Clotilde la tesse sul vaporetto delle 9. La lettera di Livia per Ada finisce nel pozzo di Don Piero. Fuori dal merletto, l'isola dimentica Livia in pochi mesi; solo Zeno e Don Piero la ricordano (arc4) |
| 1951-1965 | Livia scrive ogni mese. Clotilde tesse i merletti dei giorni giusti in modo che ogni lettera arrivi a Don Piero e lì si fermi. Più tardi Livia comincia a gettare bottiglie in mare dal molo di Chioggia |
| 1958 | Epidemia. Clotilde salva i sei bambini della scuola e lascia la febbre ad Aldo, il fidanzato di Teresa che voleva portarla in terraferma. Aldo muore (arc3) |
| 1965, autunno | Clotilde, ottantenne, si tesse dentro per l'ultima volta (filo d'avorio; la prima fu il merletto di prova di arc6, quando Livia era bambina): alle 2 passa sopra Zeno e gli consegna una lettera per Ada. Alle 3 muore. L'orologio del campanile si ferma alle 5:59 perché il merletto del giorno è incompiuto |
| 1965-66 | Il gioco. Con la nonna morta, la laguna restituisce le bottiglie di Livia. Livia, che a Chioggia ha imparato a tessere da sola con un filo tinto nel nero di seppia (invisibile sul velluto blu di Clotilde), tenta di rientrare nel merletto dell'isola |

### 6.2 Temi

- **Dare occasioni, non destini.** Il potere di decidere per gli altri, anche a fin di bene, toglie loro la vita. Clotilde salvò sei bambini e condannò un uomo; tenne l'isola unita e la svuotò di scelte.
- **Ricordo e oblio.** Chi tesse non è tessuto: la merlettaia paga il potere con la solitudine. Livia, tenuta fuori dal merletto, è stata dimenticata. Ada rischia la stessa sorte.
- **Conoscere le persone.** Il finale vero si apre solo a chi sa cosa desidera ognuno.

### 6.3 Gli atti

**Prologo.** La notte in cui Clotilde muore, il sole non sorge: il merletto è a metà. Ada lo finisce. Il giorno arriva.

**Atto I. L'ordito.** Ada impara il tombolo e l'isola. I bigliettini la trattano prima come una bambina, poi con rispetto, poi con paura. Si apre la faida fra Teresa e Marta (arc1 rivela che fu Clotilde a provocarla: prima incrinatura nell'immagine della nonna santa). Zeno riceve una lettera firmata "L." e la nasconde. arc2: il filo d'avorio era Clotilde, e alle 2 diede qualcosa a Zeno. Zeno nega. Fine dell'atto: nel merletto presente, alle 3 di notte, compare un filo nero che Ada non ha tessuto.

**Atto II. La trama.** Arriva un medico forestiero, e con lui la febbre. Nella settimana della febbre Ada deve decidere chi curare per primo: lo stesso dilemma della nonna nel 1958 (arc3, scoperto a metà settimana). Ada comincia a essere dimenticata: chi non riceve il suo nome la chiama "signorina". **Svolta a metà gioco (g14):** alla fine dell'alba Zeno bussa e consegna la lettera di Clotilde, che Ada legge subito, prima del bilancio. La madre di Ada è viva, la nonna l'ha mandata via e ha sepolto le sue lettere nel pozzo di Don Piero. Subito dopo, la cassapanca: arc4 mostra la mattina del 1951. La tempesta (g15) tiene Zeno al Faro mentre il filo nero si avvicina. Fine dell'atto (g16): Ada fa traboccare il pozzo e le lettere di Livia tornano in viaggio. Se arrivano a Zeno, alla fine dell'alba lui gliele porta e Ada legge la voce di sua madre per la prima volta.

**Atto III. Il rovescio.** Livia si tesse nel merletto dell'isola con il filo nero: una donna con lo scialle nero che nessuno riconosce cammina sulla Fondamenta cercando Zeno, perché Ada, senza filo, è irraggiungibile. Le regole cominciano a togliersi invece che ad aggiungersi: se Teresa e Marta si riconciliano (g18), due stranezze spariscono davanti al giocatore. arc5 rivela l'origine della regola «chi tesse non è tessuto»; arc6 il punto che Clotilde non ebbe il coraggio di usare. Alla secca più bassa dell'anno (g22) Livia arriva a piedi sulla sabbia. La vigilia (g23) finisce con la scelta.

### 6.4 Testi chiave

**Biglietto appuntato al tombolo (prologo).** «Ada, finisci tu. Il sole aspetta. C.»

**Prima nota a margine** (al primo incrocio delle 7 nel prologo, qualunque sia il verso): «Chi sta sopra, dà.»

**La lettera di Clotilde** (g14, consegnata da Zeno alla fine dell'alba; circa 150 parole, testo base):

> Ada,
> se Zeno ti dà questa lettera vuol dire che il filo d'avorio ha tenuto fino alle tre, e che io non ci sono più.
> Tua madre è viva. Si chiama Livia, e l'ho mandata via io, col vaporetto delle nove, quando tu avevi due anni. Voleva tessere un merletto aperto, lasciare che la gente scegliesse da sola. Io avevo paura. Avevo visto cosa fa la gente quando sceglie da sola.
> Ti ha scritto ogni mese. Le lettere sono da Don Piero: le ho fatte arrivare lì io, una per una, per quattordici anni. Lui non sa nemmeno di custodirle.
> Ho fatto anche altro. Lo troverai nella cassapanca. Non ti chiedo di perdonarmi.
> Ti chiedo una cosa sola: non credere a chi ti dice che l'isola ha bisogno di una merlettaia. Io ci ho creduto per sessant'anni.
> Due merlettaie sullo stesso merletto lo strappano. Questo almeno è vero. Credo.
> C.

**Zeno, consegnando la lettera:** «Me l'ha data lei, alle due. Mi è passata sopra come un'onda. Io non ho mai saputo dire di no a quella famiglia.»

**Livia, prima battuta nel merletto (g17, alba):** «Nessuno qui sa chi sono. Va bene così. Basta che lei mi veda.»

**Teresa, riconciliazione (g18, alba, se riuscita):** Marta: «Trent'anni, Teresa.» Teresa: «Trenta. E non era nemmeno colpa mia, si scopre: me l'ha detto la piccola.» Marta: «Lo so. Siediti, che il pane è caldo.» (Le due vignette escono sempre insieme: 5.9.)

**Don Piero, trabocco (g16):** «Credevo di custodire peccati. Erano lettere. Che Dio mi perdoni la distrazione.»

### 6.5 Lettere di L. (esempi; 11 in tutto negli Atti I-II, 50-90 parole ciascuna)

Le bottiglie arrivano in disordine: alcune sono in mare da dieci anni, altre da un mese.

1. «Cara mia, oggi a Chioggia c'era un vento che ti avrebbe fatto ridere. Ho comprato un quaderno a righe, di quelli che piacevano a me da piccola. Non so se le bottiglie arrivano. Le lettere, di sicuro, no. L.»
4. «Cara mia, ho imparato a tessere da sola. Non so se si dice così: a tessere senza avere il diritto. Uso il nero di seppia, perché sul velluto blu non si vede. Nessuno mi ha insegnato. L.»
8. «Cara mia, quest'anno compi sedici anni. Io a sedici anni volevo andarmene e restare insieme. Spero che a te riesca una delle due. L.»
11. «Cara mia, lei è morta, vero? Stanotte il mare era diverso. Vengo. Non so ancora come. L.»

### 6.6 La scelta (sera di g23) e i finali

La scelta usa lo stesso sistema dei bigliettini: quattro biglietti e un solo spillo.

| Biglietto | Autore | Testo | Porta a |
|---|---|---|---|
| A | Zeno (o Don Piero, se Zeno ha memoria 0) | «Resta. L'isola ha bisogno di una merlettaia, e tua madre ha bisogno di andarsene libera, stavolta.» | `fin_merlettaia` |
| B | Livia | «Dammi il tombolo, Ada. Tu vivi. Io ho già vissuto abbastanza fuori.» | `fin_seppia` |
| C | Clotilde (pagina trovata nel Libro) | «Rimandala via, come ho fatto io. Funziona.» | `fin_chiuso` (falso) |
| D | Ada stessa | «Il punto aperto.» | `fin_aperto`; se mancano i requisiti il biglietto è strappato e dice cosa manca, per esempio «Non so ancora cosa vuole Zeno» |

**Requisiti del finale vero (D):** `lettereLivia = liberate`; `riconciliate`; 8 desideri su 8 nel Taccuino (Teresa, Marta, Piero, Gino, Bepi, Nina, Zeno, Lunardi); almeno 4 personaggi con memoria ≥ 1 a fine g22. I desideri sono conoscenza e restano anche dopo un riavvolgimento; gli altri requisiti appartengono alla linea temporale.

**Epiloghi** (3-4 vignette ciascuno, più titoli di coda col carillon dell'intera partita):

- **A. La merlettaia (il dovere).** Nella notte del finale l'isola saluta Livia dando (almeno quattro saluti su sei, 5.2). Livia riparte con il vaporetto delle 18, per scelta, con Ada che la saluta dalla finestra. Ada resta senza filo: il nastro della nonna lo annoda al tombolo, per la merlettaia che verrà. Anni dopo, il suo merletto più bello è appeso in chiesa senza nome; i ragazzi dell'isola non sanno chi l'ha fatto. Ultima riga: «Il sole è sorto ogni giorno. Nessuno ha mai saputo perché.»
- **B. Il filo di seppia (la libertà).** Livia prende il tombolo e diventa la merlettaia; Ada ha un filo corallo e una vita: la scuola, Nina, la terraferma. Nel giro di un anno l'isola dimentica Livia, e anche Ada comincia a dimenticarla. Ultima riga: «Mia madre tesse ancora. Lo so perché ogni tanto il giorno è più gentile di quanto dovrebbe.»
- **C. Il merletto chiuso (falso).** Alle 9 il giocatore vede il nodo chiudersi su tutti i fili e il merletto disfarsi all'indietro; nessun suono di successo; schermo nero; la campana stonata (sempre, anche dopo il finale vero) suona un'ora sbagliata; si torna alla sera di g23 con una nuova voce del Taccuino: «Il punto di Clotilde: chi lo ripete, lo ripete per sempre.» Il biglietto di Clotilde resta piegato e non si riappunta. Non conta come finale nei titoli.
- **D. Il merletto aperto (il finale vero).** Ada e Livia appuntano solo occasioni: l'epilogo nomina quelle **davvero piantate** dal giocatore (parametro `{occasioni}`). I fili si incrociano da soli secondo i desideri; almeno tre vignette chiudono i desideri tessuti quella notte (Teresa riceve una lettera scritta per lei, Gino dentro la lanterna accesa, Lunardi chiamato per nome, Nina, Zeno e Livia). Il nastro della nonna basta per due fili: uno per Ada, uno per Livia. Tutti hanno un filo. Il tombolo resta in chiesa, come una reliquia che nessuno usa più. La campana del campanile suona finalmente intonata. Ultima riga: «Per un autunno e un inverno ho imparato a comandare le persone. Poi ho imparato a conoscerle.» Si sblocca lo spartito dell'intera partita; la schermata Fine lo riconosce («La campana suona intonata. Hai trovato il punto aperto.») e il titolo cambia (filo corallo sul tombolo, campana intonata).

In tutti i finali il merletto finito resta sullo schermo finché il giocatore non tocca «Continua».

---

## 7. Progressione e sblocchi

Si sblocca varietà, mai potenza. Nessuna statistica cresce.

| Quando | Cosa si sblocca |
|---|---|
| g00 | Libro dei Punti (pagine 1-3), Taccuino (Persone, Domande) |
| g01 | Bigliettini e spilli rossi, Telaio (mappa delle giornate) |
| g02 | Matassa visibile, records di eleganza |
| g03 | Archivio arc1 |
| g02 | Lettere di L. come scheda del Taccuino (dalla prima bottiglia) |
| g07 | **Merletto del giorno** |
| fine g08 | **Merletto libero** (senza gradi), Ripassa |
| g11-g14 | arc3, arc4 |
| fine g16 | Gradi del Merletto libero |
| g18, g20 | arc5, arc6 |
| primo finale (qualsiasi, tranne il falso) | Epiloghi nel Telaio, spartito dell'intera partita, fusi intagliati extra |
| finale vero | Campana intonata e filo corallo nel titolo, riga dedicata nella schermata Fine (la Tovaglia resta L3) |

**Fusi intagliati** (solo estetici, cambiano il fuso di Ada nel titolo e i fusi dei lino): 6 stili (liscio, a spirale, a pigna, col faro, con la barca, d'avorio). Si ottengono con i fili d'oro: 3, 8, 15, 22 fili d'oro, più due legati al Merletto del giorno (7 giorni di fila, 30 giorni in totale).

---

## 8. Rigiocabilità

1. **Destini e finali.** Quattro finali (uno falso) più sei destini. Una partita mostra circa metà delle conseguenze: con 2-3 spilli su 3-4 bigliettini per sera, molte richieste restano non scelte.
2. **Telaio e "Riprendi da qui".** Dal Telaio si apre qualsiasi giornata già giocata:
   - **Rigioca**: rifai il merletto per i record, senza cambiare la storia;
   - **Riprendi da qui**: la storia torna alla sera di quella giornata (con conferma). I flag di storia tornano come erano; il **Taccuino resta** (stranezze, desideri, domande, Archivio). Chi sa già tutto può puntare al finale vero molto più in fretta.
   - **Ripassa**: se la notte ha le stesse richieste di una soluzione già trovata, un pulsante la ritesse da sola in 5 secondi.
3. **Merletto del giorno** (da g07). Uguale per tutti, calcolato dalla data, offline.
   - Seme: la data locale `AAAA-MM-GG` → hash `xmur3` → generatore `sfc32`.
   - Regola del giorno: lunedì voce, martedì segreto e pozzo, mercoledì Molo, giovedì febbre, venerdì nodo, sabato marea, domenica filo nero. Se il giocatore non l'ha ancora incontrata nella storia, appare la pagina del Libro con la regola (senza note di storia). La scheda del giorno ha **«Chi c'è stanotte»**: personaggi presenti, le loro stranezze attive e le coppie in rancore; sul tombolo la scheda di ogni fuso elenca tutte le stranezze attive, e le lettere dicono sempre a chi vanno.
   - Dimensioni: lunedì-giovedì 5 colonne e 7 righe; venerdì-domenica 6 colonne e 8 righe. Cast casuale fra gli 8 personaggi, con le loro stranezze, più lino.
   - Obiettivi obbligatori: 1-2 lettere da consegnare entro un'ora, 1 vincolo `nonHa` o `nonIncontra`, 1 `presso` o `incontra`, 1-2 spilli d'ottone. Matassa = minimo + 1.
   - Filtro di qualità (nel generatore, deterministico): risolvibile; minimo tra 6 e 12 incroci (5 colonne) o tra 8 e 14 (6 colonne); un giocatore automatico avido non lo risolve con quella matassa; al massimo 12 soluzioni ottime distinte; la regola del giorno serve davvero (la soluzione ottima calcolata senza la regola non è valida con la regola, oppure costa di più). Si provano i semi `data#0 … data#499`; se nessuno passa, si usa la lista di riserva precalcolata `daily-fallback.json` (60 semi) indicizzata col giorno dell'anno.
   - Risultato condivisibile come testo, senza server: `TRAMA 14/10 · 9 incroci (min 8) · 2 ore di quiete · simmetria ✦` (data nel formato della lingua) più lo spartito (punto 5) e un'immagine PNG del merletto generata sul dispositivo, con un cartiglio (TRAMA, data, incroci e minimo) (Web Share API, o share sheet nativo).
   - Record locali e serie di giorni consecutivi.
4. **Merletto libero** (da fine g08). Stesso generatore con seme casuale o scelto, difficoltà (piccolo, medio, grande) e, dopo l'Atto II, **Gradi** combinabili, ognuno vale 1 punto:
   1. Matassa esatta (minimo + 0);
   2. Senza Disfa (si può disfare solo nella riga corrente);
   3. Spilli velati (gli spilli d'ottone si vedono solo 2 ore prima);
   4. Un nodo in più (una coppia in rancore);
   5. Filo nero in più;
   6. Notte corta (2 righe in meno, con un nuovo controllo di risolvibilità).
   Record per livello di gradi raggiunto. Ogni grado deve pesare sul livello generato (spilli velati solo con spilli oltre la seconda ora, rancore fra fili che altrimenti si incrocerebbero, filo nero che cambia la soluzione): il generatore scarta i gradi inutili. Il libero si condivide con «Condividi il seme».
5. **Spartito.** Ogni merletto finito si esporta come stringa corta, per esempio `TRAMA1-G20261014-b._.ad.c-7k`: modalità e riferimento (giornata di storia, data, seme e gradi), poi gli incroci riga per riga (una lettera per incrocio: `coppia*2 + verso`, righe separate da `.`, riga vuota `_`), poi 2 caratteri di controllo. Chi incolla lo spartito vede il merletto tessersi e ne ascolta il carillon. Passaparola senza server.
6. **Eleganza.** Filo d'oro, ore di quiete, simmetria: tre record per ogni giornata e per ogni merletto procedurale.

**Livello L2** (dopo che L1 è finito e rifinito):

- **La Settimana**: 7 giornate procedurali collegate. Le richieste fallite cambiano le giornate successive (un personaggio offeso che evita qualcuno, una febbre che si allarga), con un pool di stranezze procedurali che comprende la **malalingua** (una voce che passa da lei cambia contenuto e diventa falsa: si deve verificare all'alba).
- **Esercizi della nonna**: 12 puzzle puri scelti dal generatore, uno per regola, con 3 livelli di eleganza.
- Storia completa in inglese.

**Livello L3**: la **Tovaglia** (tutti i merletti della partita cuciti in un'unica immagine esportabile in PNG, che suona l'intera partita), l'**alfabeto dei punti** (certe sequenze di incroci nei merletti d'Archivio formano lettere; decifrate, aprono 6 merletti segreti).

---

## 9. I primi 10 minuti

| Tempo | Momento | Cosa impara il giocatore |
|---|---|---|
| 0:00 | **Titolo.** Il tombolo alla luce di una lampada a olio, un fuso che dondola. Laguna e orologio che ticchetta. Una scritta sola: "Tocca per iniziare" (sblocca l'audio) | Il tono |
| 0:15 | Schermo nero, una riga: «Sant'Arianna. La notte in cui morì Clotilde, l'orologio del campanile si fermò alle 5:59.» Il ticchettio si ferma | La premessa |
| 0:30 | **Diorama della stanza di Ada.** La sedia della nonna è vuota, sul tombolo un merletto a metà, un biglietto appuntato al tombolo: «Ada, finisci tu. Il sole aspetta. C.» Il titolo sta su una fascia scura; il Taccuino non c'è ancora. Si tocca il tombolo | Il tombolo è il gioco |
| 0:45 | **Primo gesto (g00, riga delle 6).** Tre fili: Teresa, Marta, Don Piero. Senza scritte, una mano fantasma trascina **un fuso fantasma** di Marta sopra quello di Teresa, con una freccia; lo spillo d'ottone di Marta pulsa. Il giocatore lo rifà: tocco di legno e due note. Lo spillo (Marta, Forno, 6) si accende e a margine compare «Lo spillo è un appuntamento: Marta apre il forno alle sei.». Il pulsante "Fissa l'ora" pulsa: lo si tocca, suona la campana (stonata), canta un gallo, nella finestrella in alto la luce cresce. Sul filo di Teresa compare una piccola luce: nessuna spiegazione, solo una voce nel Taccuino: «Teresa si è accesa. Che cosa ha visto?» | Incrocio, spillo, ora |
| 1:30 | **Riga delle 7.** La lettera di Teresa trema verso Don Piero. Al primo incrocio, in qualunque verso, sul margine compare a mano: «Chi sta sopra, dà.» Se il giocatore ha trascinato Piero sopra Teresa, la lettera resta dov'è; un tocco sull'incrocio lo rovescia: la lettera vola a Don Piero e il sigillo si accende | Sopra/sotto, rovesciare |
| 2:30 | **Riga delle 8.** Libera: Disfa pulsa e a margine: «Sbagliare non costa: ogni incrocio si disfa.» Si prova, si disfa | Disfa |
| 3:00 | **Riga delle 9.** Spilli: Teresa al Forno, Don Piero in Chiesa. Il gesto ovvio è trascinare Teresa su Marta: il fuso rimbalza con un «No.» e una vibrazione morbida; il Taccuino si apre un attimo: «Marta non passa mai sotto Teresa.» Trascinando Marta su Teresa si risolve. Il merletto si chiude e il carillon suona una melodia che torna su se stessa | Le stranezze sono regole |
| 4:00 | **"Il giorno accade".** Tre vignette: Marta inforna («Il forno apre alle sei anche se finisce il mondo.»); Teresa consegna la lettera; Don Piero legge e si fa serio. Il pulsante "Salta" è sempre visibile | Le conseguenze |
| 5:00 | **La prima sera.** Sul tombolo c'è ancora l'ultimo merletto della nonna: un filo d'avorio che non è di nessuno si interrompe alle 3, tagliato netto. Si apre la prima domanda: «Di chi è il filo d'avorio?». Bussano: tre bigliettini (Marta, Don Piero, Gino), due spilli rossi | Scegliere costa |
| 6:30 | **Giornata 1.** Quattro fili, compare Gino. La prima volta che si prova a fissare la seconda ora di fila senza farlo incrociare: «Gino è stato fermo un'ora: adesso deve incrociare.» Seconda stranezza, con la sua nota a margine | Il mondo ha le sue regole |
| 9:00 | Alba e bilancio: una richiesta soddisfatta, una no, con la sua conseguenza in una riga | Fallire fa avanzare |
| 10:00 | **Aggancio.** La laguna porta alla porta una bottiglia: «Cara mia, oggi a Chioggia c'era un vento che ti avrebbe fatto ridere… L.» Seconda domanda: «Chi è L.?» | Il mistero continua |

In dieci minuti il genere è chiaro (puzzle narrativo a turni, non punitivo), sono state insegnate cinque meccaniche una alla volta e si sono aperti due misteri.

---

## 10. UI/UX e schermate

### 10.1 Principi

- Azioni frequenti nel terzo inferiore dello schermo. In alto solo informazioni (giornata, ora, matassa).
- Bersagli di tocco di almeno 48 px CSS (44 pt), principali 56-64 px, distanziati di almeno 8 px.
- Sempre un modo per tornare indietro: tasto Indietro di Android, Esc, pulsante.
- Interfaccia sempre dentro la safe area. Il velluto riempie il resto.
- Testo minimo 15 px, base 17 px, moltiplicato dall'impostazione "Dimensione testo" (90-140%).
- Nessuna informazione solo di colore: forma, motivo, icona o testo accompagnano sempre il colore.
- Interfaccia di gioco disegnata nel mondo: carta, ottone, velluto, legno. Niente pannelli "da app".

### 10.2 Disposizioni

- **Telefono verticale** (riferimento 390×844, minimo 360×640): una colonna.
- **Largo** (larghezza CSS ≥ 900 e rapporto ≥ 1,15: desktop, iPad orizzontale): tre pannelli. A sinistra Bigliettini e richieste (300 px), al centro il tombolo (massimo 640 px), a destra il Taccuino (320 px). Su larghezze intermedie il pannello di destra diventa a scomparsa.
- **Tablet verticale**: come il telefono, centrato con larghezza massima 720 px.
- Il cambio di disposizione avviene al ridimensionamento, senza ricaricare (necessario per iPad con finestre ridimensionabili).

### 10.3 Schermate

**Titolo.** Sfondo: render del tombolo sul cavalletto. Titolo "TRAMA" e sottotitolo "Il merletto dei giorni". Pulsanti allineati in basso: Continua (se c'è un salvataggio), Nuova storia, Merletto del giorno (bloccato con lucchetto e "dopo la giornata 7", visibile anche al primo avvio), Merletto libero, Telaio, Impostazioni, Crediti. Dopo il finale vero la campana del titolo suona intonata e sul tombolo c'è un filo corallo.

**Sera (la porta).** Diorama della stanza di Ada di sera. Prima arriva l'oggetto della laguna (si tocca per leggerlo). Poi i bigliettini scivolano da sotto la porta come carte. Toccandone uno si apre a tutto schermo, con la calligrafia del personaggio, e tre pulsanti in basso, fuori dal foglio: **Appunta** («Appunta · restano 2 spilli»; con gli spilli finiti dice come liberarne uno), **Rispondi** (se possibile: due risposte scritte), **Lascia**. Il foglio si inclina tutto insieme, al massimo di 3°, e il testo non ne esce mai; le lettere lunghe scorrono dentro il foglio. Per i bigliettini anonimi c'è prima "Chi l'ha scritto?" con la fila dei ritratti. In basso: "Al tombolo" (attivo sempre; i bigliettini non decisi contano come lasciati, con una conferma). Gli spilli si mostrano solo se ci sono bigliettini. Alla prima sera di ogni atto, un cartello con il titolo dell'atto e la stagione.

**Tombolo (la notte)**, telefono verticale, dall'alto in basso:

| Fascia | Altezza | Contenuto |
|---|---|---|
| Barra alta | 52 px | Giornata e titolo, ora corrente **e ora di fine** («Ore 7 · fino alle 20»), matassa (gomitolo con "5/8"). Le scritte non scendono mai sotto 15 px × scala del testo: vanno a capo |
| Intestazione colonne | 40 px | Icona e nome breve di ogni luogo, sempre visibile |
| Merletto | resto | Righe delle ore, etichette delle ore a sinistra (l'icona di un evento sta accanto al numero, non al suo posto). L'altezza delle righe si adatta (30-56 px) perché tutta la notte stia sullo schermo; se non basta, righe da 40 px e un indicatore «↓ altre N ore». Le righe passate salgono, le future sono velate e mostrano gli spilli. La riga corrente è una fascia più chiara in basso. Trascinando in verticale si scorrono le ore |
| Striscia richieste | 36 px | Gettoni delle richieste appuntate con stato (in corso, soddisfatta, a rischio); toccando si apre il bigliettino |
| Fusi | 128 px | I fusi pendono sotto la riga corrente, uno per colonna; colonne larghe almeno 52 px |
| Barra azioni | 72 px | ≡ Menu (48) · ↶ Disfa (64) · **Fissa l'ora** (grande, 120) · Taccuino (64). Sopra a destra la lampada dei suggerimenti, sempre visibile. Quando le prossime ore si possono fissare vuote senza che accada nulla, compare «Fissa fino alle N» (Salta le ore quiete) |

Comportamenti: anteprima immediata dei passaggi durante il trascinamento (una richiesta che si compirebbe con la bozza ha una spunta tratteggiata, «si compie se fissi l'ora»; «soddisfatta» solo a ora fissata); spillo irraggiungibile segnato in rosso con l'ora; con la riga non valida, "Fissa l'ora" vibra e spiega il motivo in una riga (per esempio «Don Piero deve essere in Chiesa alle 11»): un solo messaggio per violazione. Toccando uno spillo, una barca, una perlina, un'etichetta d'ora o l'incrocio annunciato del filo nero si apre una bolla che spiega. Gli obiettivi (con gli spilli d'ottone, le finestre orarie e le coppie in rancore) stanno nel popup del pulsante Obiettivi, che mostra il contatore, e nel layout largo nel pannello di sinistra. Le note a margine non coprono mai la riga corrente, gli spilli, gli slot o i fusi; un tocco le chiude. Toccando una riga passata si vede lo stato di quell'ora con la barra "Riavvolgi fino a qui / Annulla". Da g12, prima della prima riga, appare il passaggio "Appunta il tuo nome" (si tocca un fuso). All'ultima riga "Fissa l'ora" diventa "Chiudi il merletto".

**Alba.** Diorama a tutto schermo (o nella metà alta), riquadro di testo in basso con il nome colorato del personaggio, borbottio sintetico, tocco per avanzare. "Salta" in basso a sinistra. Velocità del testo regolabile.

**Bilancio.** Foglio di carta: righe delle richieste (✓ / ✗ e conseguenza in una frase), nuove voci del Taccuino (toccabili), eleganza (incroci / minimo, ore di quiete, simmetria) e record, pulsanti "Riascolta il merletto", "Spartito", "Continua".

**Taccuino** (pannello sopra qualsiasi schermata). Schede in basso (Bigliettini, Persone, Libro, Domande, Lettere, Archivio). Carta, serif da libro.

**Archivio.** Cassapanca con i merletti come rotoli (Apri, Più tardi, Rileggi in sola lettura per quelli rammendati). Dentro un merletto: tombolo in modalità Archivio (fili sbiaditi, righe strappate); contatore "Nomi dati: 2 di 4 · si confermano a gruppi di tre giusti"; nel layout largo, a sinistra, il pannello dell'Archivio (fili da nominare, candidati, strappi, echi). La lampada c'è anche qui.

**Telaio.** Una lunga striscia di merletto verticale: ogni giornata è un nodo con titolo, stato delle richieste, filo d'oro. Toccando un nodo: Rigioca, Riprendi da qui, Riascolta. Gli epiloghi visti compaiono in fondo.

**Merletto del giorno.** Scheda con la data, la regola del giorno (pagina del Libro), record e serie; "Tessi". Dopo: risultati, "Condividi", "Copia spartito".

**Merletto libero.** Seme (casuale o inserito), dimensione, gradi (interruttori con descrizione), «Chi c'è stanotte», "Tessi". Con una notte a metà sullo stesso seme il pulsante principale è «Riprendi il merletto» e «Tessi da capo» chiede conferma. Più "Importa spartito" e «Condividi il seme».

**Pausa** (sopra il tombolo, anche con il tasto Indietro di Android). Riprendi, Ricomincia la notte, Taccuino, Impostazioni, Comandi (tasti e gesti), Torna al titolo; nell'Archivio anche «Lascia per ora». Tutto è già salvato.

**Impostazioni.** Volume generale, musica, effetti, voci; dimensione del testo; alto contrasto; velocità animazioni (0,5×, 1×, 2×, istantanea); movimento ridotto; vibrazione; didascalie dei suoni; avanzamento automatico delle vignette; lingua (italiano, inglese); salvataggi: Esporta (stringa da copiare), Importa, Cancella tutto (doppia conferma).

**Crediti.** Scorrimento lento sul carillon. Autore (da `credits.json`), "realizzato con strumenti di intelligenza artificiale", font con licenza OFL (Atkinson Hyperlegible, EB Garamond, Caveat), strumenti (Blender, Vite, Capacitor), «Ispirato alla tradizione del merletto a fuselli di Pellestrina e Burano».

**Finale.** Il merletto finito resta sullo schermo con «Continua»; poi le vignette dell'epilogo, poi i titoli di coda con il carillon dell'intera partita (un battito per giornata, la nota del personaggio più presente).

**Sovrapposizioni di sistema.** "Tocca per continuare" quando il contesto audio non è attivo (iOS dopo un'interruzione); avvisi brevi (toast) in basso, che non prendono i tocchi; finestre di conferma con il pulsante sicuro a sinistra; pannelli sovrapposti sempre opachi.

### 10.4 Mappa di navigazione

Titolo → (Nuova storia | Continua) → Sera → Tombolo → Alba → Bilancio → [Archivio] → Sera successiva… → Scelta → Finale → Titoli → Titolo.
Titolo → Merletto del giorno / Merletto libero → Tombolo → Bilancio → Titolo.
Titolo → Telaio → (Rigioca → Tombolo → Bilancio → Telaio) | (Riprendi da qui → Sera).
Indietro: chiude la sovrapposizione più alta; nel tombolo apre la Pausa; nella sera chiede se tornare al titolo; nel titolo, sull'app nativa, chiede se uscire.

---

## 11. Controlli

### 11.1 Touch

| Gesto | Azione |
|---|---|
| Trascinare un fuso in orizzontale oltre la metà della colonna vicina | Incrocio, con il fuso trascinato sopra. Area di presa: tutta la colonna, alta 128 px |
| Rilasciare prima della metà | Annulla, il fuso torna al suo posto |
| Toccare un incrocio della riga corrente | Rovescia sopra/sotto |
| Trascinare un incrocio fuori dalla riga, o premere Disfa | Toglie l'incrocio |
| Pressione lunga (500 ms) su un fuso | Scheda del personaggio (stranezze note, desiderio, memoria); su un fuso sbiadito dell'Archivio, la scelta del nome |
| Toccare uno spillo, una barca, una perlina, un'etichetta d'ora, uno slot d'occasione | Bolla che spiega (chi, dove, quando, che cosa porta) |
| Trascinare in verticale sul merletto | Scorre le ore |
| Toccare una riga passata | Anteprima e riavvolgimento |
| Toccare un fuso, nel passaggio "Appunta il tuo nome" | Mette il nome di Ada su quel filo; finché nessuna ora è fissata, un altro tocco lo sposta |
| Pizzico | Non usato (lo zoom del browser è disabilitato) |

Vibrazione: leggera all'incrocio, media al passaggio di una perlina, "successo" quando una richiesta è soddisfatta, doppia leggera al rifiuto, media a "Fissa l'ora".

### 11.2 Mouse

Stesso trascinamento; clic sull'incrocio per rovesciarlo; rotella per scorrere le ore; tasto destro su un fuso per la scheda; il passaggio del mouse mostra solo anteprime in più (nome del filo, perline), mai necessarie.

### 11.3 Tastiera

| Tasto | Azione |
|---|---|
| ← → | Sposta il cursore tra le coppie di colonne (nell'Archivio, mentre si nomina, fra tutte le colonne) |
| 1-6 | Porta il cursore sul filo n (coppia alla sua destra) |
| Spazio | Incrocia la coppia, filo di sinistra sopra |
| Maiusc + Spazio | Incrocia la coppia, filo di destra sopra |
| F | Rovescia l'incrocio sotto il cursore |
| Invio | Fissa l'ora |
| Maiusc + Invio | Salta le ore quiete (quando è offerto) |
| Backspace o Z | Disfa |
| ↑ ↓, PagSu, PagGiù | Scorre le ore |
| Tab | Taccuino |
| H | Suggerimento |
| N | Appunta il nome (da g12) |
| Esc | Pausa / chiude il pannello (nella sera senza pannelli: chiede se tornare al titolo) |
| In vignetta: Spazio o Invio avanza, S salta, A avanzamento automatico | |

### 11.4 Sistema

- Tasto Indietro di Android: chiude il pannello aperto o apre la Pausa (plugin App, evento `backButton`).
- Pausa automatica e salvataggio: `visibilitychange`, `pagehide`, evento `pause` di Capacitor.
- Nessuna meccanica a tempo, nessuna pressione prolungata obbligatoria (la scheda del personaggio è raggiungibile anche dal Taccuino).

---

## 12. Direzione artistica: "Velluto e filo"

### 12.1 Regole di stile

1. **Un solo strato saturo.** Mondo, interfaccia e figurine sono desaturati; sono saturi solo i fili, le perline, le fasce colorate delle figurine (il colore del loro filo) e gli spilli.
2. **Legno tornito.** I personaggi sono figurine di legno tornito e dipinto: il corpo è un fuso, la testa una sfera con pochi tratti dipinti, accessori come piccole primitive (berretto, scialle, rete, colletto). Le figurine non camminano: nelle vignette sono ferme in una posa.
3. **Presepe di laguna.** I diorami sono plastici: case squadrate, tegole, pali, acqua come superficie piatta lucida, luce da teatro (chiave calda, riempimento freddo).
4. **Il merletto è disegnato in codice**, non renderizzato: fili come curve di Bézier con torsione e motivi, su velluto procedurale.
5. **Alto contrasto e sagome leggibili** anche a 360 px di larghezza.

### 12.2 Palette (token di `src/core/theme.css`)

**Mondo e interfaccia**

| Token | Hex | Uso |
|---|---|---|
| `--velluto` | `#1C2233` | Fondo del tombolo, sfondi |
| `--velluto-luce` | `#2A3247` | Riga corrente, pannelli |
| `--velluto-ombra` | `#121622` | Vignettatura |
| `--legno` | `#B89B72` | Fusi, cornici |
| `--legno-scuro` | `#6E5539` | Ombre del legno, testo su carta chiara secondario |
| `--carta` | `#EDE4D3` | Bigliettini, Taccuino |
| `--carta-ombra` | `#D8CCB4` | Bordi della carta |
| `--inchiostro` | `#2B2622` | Testo su carta |
| `--seppia` | `#6B4A2F` | Note a margine di Clotilde |
| `--laguna` | `#7F918C` | Diorami (acqua) |
| `--mattone-spento` | `#9A6B5A` | Diorami (case) |
| `--ocra-spenta` | `#B59A6A` | Diorami (case) |
| `--alba` | `#D9C3B0` | Cielo dell'alba |
| `--ottone` | `#C9A24A` | Spilli d'ottone, pulsanti principali |
| `--spillo-rosso` | `#C8372D` | Richieste |
| `--spillo-verde` | `#4E9A5B` | Occasioni |
| `--testo-chiaro` | `#F3EEE4` | Testo su velluto |
| `--errore` | `#E0604F` | Spillo irraggiungibile (sempre con icona e testo) |

**Fili**: colori della tabella 5.4. In alto contrasto: velluto `#0B0D14`, fili con bordo chiaro di 1 px, lino `#B5AE9F`.

**Perline**

| Perlina | Colori | Forma |
|---|---|---|
| Lettera | Carta `#F2EBDD`, sigillo `#B3261E` | Rettangolo 12×9 con punto rosso |
| Voce | `#FFF4C2` con alone | Cerchio con anello |
| Segreto | `#101010` con riflesso bianco | Rombo |
| Febbre | `#7A9A3A` | Goccia irregolare |
| Nome | `#F5EFE6` con alone corallo `#F07C6C` | Perla con "A" |

### 12.3 Il merletto in codice (specifica per il renderer)

- **Velluto**: rumore procedurale (due ottave, 256×256, ripetuto) sul colore `--velluto`, vignettatura radiale. Generato una volta in un canvas fuori schermo.
- **Fili**: spessore 6 px (lino 3,5 px; filo doppio due linee da 2,5 px). Colore base, poi una linea di luce larga 1 px spostata di -1 px, poi il **motivo**: righe oblique (tratti a 45° ogni 6 px), puntini (ogni 9 px), filo doppio, onde (sinusoide ampiezza 1,5 px), zig-zag, tratteggio lungo, catenella (piccole ellissi), punto croce (piccole x), lucido (riflesso che scorre lentamente), perlato (perline ogni 12 px).
- **Tratto senza incrocio**: verticale, con un'ondulazione appena visibile (0,8 px).
- **Incrocio**: due curve di Bézier cubiche a S fra le due colonne. Si disegna prima il filo sotto, poi un'interruzione color velluto di 3 px dove passa l'altro, poi il filo sopra con un'ombra morbida (offset 1 px, nera al 35%, niente `shadowBlur`).
- **Nodo** (rancore): un piccolo nodo disegnato sull'incrocio e le due righe successive dei due fili più spesse e scure. Finché la regola vale, un segno di nodo sulla testa dei due fusi in rancore lo dice prima.
- **Spilli**: testa sferica (ottone, rosso, verde) con riflesso, gambo corto, nella cella (colonna, ora); icona del personaggio sulla testa. Spillo rispettato: brilla; irraggiungibile: barrato in `--errore` con un "!".
- **Filo nero**: sempre con un bordo chiaro sottile, anche senza alto contrasto. **Annunciato**: incrocio fantasma tratteggiato e semitrasparente nella riga successiva.
- **Slot delle occasioni**: cerchio tratteggiato verde con l'icona del tipo disegnata sopra il filo, su fondo pieno.
- **Righe fissate**: disegnate una volta in strisce fuori schermo (8 righe per striscia); a ogni fotogramma si ridisegnano solo la riga corrente, le perline animate e i fusi.

### 12.4 Movimento

- Fusi: pendolo con molla smorzata (rigidità 40, smorzamento 6) quando si prendono, si lasciano o si incrociano.
- Perline: volano lungo la curva dell'incrocio (350 ms, uscita morbida).
- Campana: la luce della finestrella cresce di un passo a ogni ora fissata (solo nel prologo e nell'ultima giornata).
- Movimento ridotto: niente dondolio, niente voli delle perline (compaiono), dissolvenze al posto degli scorrimenti.

### 12.5 Elenco degli asset (Blender, Cycles su CPU)

Convenzioni: nomi minuscoli con trattino basso; percorsi in `public/assets/`; sprite raccolti in atlas di massimo 2048×2048; diorami come WebP singoli.

| Gruppo | Nome file / frame | Quantità | Risoluzione | Note |
|---|---|---|---|---|
| Fusi | `fuso/<id>` | 12 (8 personaggi, Livia, Ada, Clotilde, lino) | 96×320, trasparente | Fuso di legno con filo avvolto del colore del personaggio e testa intagliata con un dettaglio (berretto, scialle…). L'icona del personaggio è disegnata in codice sopra la testa |
| Fusi intagliati | `fuso/stile_<n>` | 6 | 96×320 | Varianti estetiche (L1: 2, L2: tutte) |
| Figurine | `fig/<id>/<posa>` | 10 personaggi + `lino` (figura anonima non dipinta, usata anche per i personaggi d'Archivio con il loro nome) × 3 pose (`ferma`, `porge`, `saluta`) = 33 | 256 di altezza, trasparente | Basetta tonda. Fascia del colore del filo |
| Ada grezza | `fig/ada/<posa>_grezza` | 3 | 256 | Legno senza vernice (memoria 0) |
| Diorami | `dio/<luogo>/<luce>` | 7 luoghi (6 + stanza) × 3 luci (`alba`, `giorno`, `notte`) = 21 | 1024×768 WebP | Camera ortografica a 30°, area sicura centrale 768×576 |
| Quadri speciali | `tab/<nome>` | 6: `sedia_vuota`, `tempesta`, `secca`, `sacrestia_lettere`, `merletto_in_chiesa`, `vaporetto_alba` | 1024×768 WebP | L1: i primi 4 |
| Oggetti | `obj/<nome>` | `tombolo` (1024²), `bottiglia`, `forbici`, `libro`, `fuso_faro`, `fascio_lettere` (256²) | vedi | Trasparenti |
| Icona app | `assets/logo.png` | 1 | 1024×1024, opaca | Un fuso sul velluto blu |
| Splash | `assets/splash.png`, `assets/splash-dark.png` | 2 | 2732×2732 | Logo centrato su `#1C2233` |
| Icone web | `public/icons/icon-192.png`, `icon-512.png`, `favicon.png` | 3 | | Dal logo |

Budget: atlas sprite ≤ 3 MB in tutto; diorami ≤ 90 KB ciascuno; asset totali ≤ 6 MB.

---

## 13. Audio (tutto procedurale, WebAudio, nessun file)

### 13.1 Struttura

Un solo `AudioContext`. Bus: `master` (con compressore leggero: soglia -18 dB, rapporto 3) → `musica`, `effetti`, `voci`, `ambiente`, ognuno con il suo volume. Suoni brevi sintetizzati al volo; suoni lunghi o costosi (campana, carillon) pre-renderizzati all'avvio con `OfflineAudioContext` in `AudioBuffer` e riusati. Massimo 48 voci contemporanee, con le più vecchie tagliate.

### 13.2 Ricette

| Suono | Ricetta |
|---|---|
| **Tocco di legno** (fuso, incrocio) | Sintesi modale: rumore di 2 ms filtrato passa-banda su f0 casuale 500-900 Hz (±5% a ogni colpo), che eccita 4 modi con rapporti 1 : 2,76 : 5,40 : 8,93, ampiezze 1 : 0,5 : 0,25 : 0,12, decadimenti 120, 60, 35, 20 ms |
| **Note dei personaggi** | Timbro da carillon: sinusoide fondamentale + armonica 2 (ampiezza 0,3) + parziale 4,2 (0,1), attacco 2 ms, decadimento esponenziale 1,2 s, desintonia casuale ±3 cent. Note in Re dorico: Piero Re3 146,83 Hz; Bepi Sol3 196,00; Livia La3 220,00; Zeno Do4 261,63; Marta Re4 293,66; Lunardi Fa4 349,23; Teresa La4 440,00; Nina Si4 493,88; Clotilde Do5 523,25; Ada Re5 587,33; Gino Mi5 659,25. Lino: solo tocco di legno |
| **Incrocio** | Tocco di legno + bicordo delle due note (sopra prima di 30 ms). In rancore: la nota sotto stonata di +40 cent (si sentono i battimenti) |
| **Rovesciare** | Due tocchi rapidi (40 ms), il secondo più acuto |
| **Lettera che passa** | Fruscio di carta: rumore 60 ms, passa-banda 3 kHz, Q 1,5 |
| **Voce che si copia** | "Sss": rumore 200 ms con filtro formante 2,5 kHz e inviluppo a campana, pan verso chi riceve |
| **Segreto che scende** | Tocco di legno grave (f0 300 Hz) + "tin" di vetro (sinusoide 2,4 kHz, decadimento 300 ms) |
| **Febbre** | Due sinusoidi a 110 e 113 Hz (battimento), 400 ms, passa-basso 400 Hz |
| **Cura** | Tre note di carillon ascendenti (Fa4, La4, Do5) a 70 ms |
| **Nodo** | Corda che cigola: Karplus-Strong a 90 Hz, smorzamento alto, 500 ms |
| **Rifiuto "No."** | Tonfo di legno (f0 200 Hz) + borbottio di Marta di 1 sillaba, secco |
| **Campana dell'ora** | Sintesi additiva con parziali della campana: rapporti 0,5 / 1 / 1,2 / 1,5 / 2 / 2,5 / 3 / 4, ampiezze 0,6 / 0,8 / 0,5 / 0,35 / 0,7 / 0,25 / 0,2 / 0,15, decadimenti 4 / 3 / 2,5 / 2 / 1,8 / 1,2 / 1 / 0,8 s, fondamentale (prime) 196 Hz, colpo di batacchio di 15 ms (rumore passa-banda 1,2 kHz). **Stonatura** con parametro `s` da 0 a 1: ogni parziale spostata di `s × [-35, +20, -45, +30, -25, +40, -15, +10]` cent, più un ronzio (rumore modulato) di ampiezza `0,15 × s`. `s` = 1 nel prologo e nell'Atto I, 0,6 nell'Atto II, 0,25 nell'Atto III, 0 dopo il finale vero. Il progresso si sente |
| **Carillon del merletto** | Una riga = un battito (380 ms). Ogni incrocio della riga suona il bicordo dei due personaggi; righe vuote: un tic leggero. Pre-renderizzato a fine giornata |
| **Vaporetto** | Due onde a dente di sega a 92 e 93,5 Hz, passa-basso 600 Hz, 1,5 s con attacco lento |
| **Barca** | Motore: rumore marrone modulato a 9 Hz, 2 s |
| **Gabbiano** | FM: portante 1800 Hz, modulante 900 Hz, indice 3, glissando 1800→1300 Hz in 250 ms, 2-3 versi; ogni 8-20 s nell'ambiente di giorno |
| **Pagina, bottiglia, carta** | Rumore filtrato con inviluppi brevi; bottiglia: tre parziali di vetro (1,9 / 3,1 / 4,7 kHz) |
| **Trabocco** | Gorgoglio: 12 bolle (sinusoidi con glissando ascendente 300→900 Hz in 60 ms) a intervalli casuali |
| **Marea** | Rumore rosa con passa-basso che sale da 200 a 800 Hz in 2 s |
| **Arrivo del filo nero** | Bordone basso La1 (55 Hz) con tremolo lento, 2 s, sotto la nota di Livia |

### 13.3 Ambiente

- **Laguna di giorno**: rumore rosa (filtro di Voss) → passa-basso 900 Hz, più un passa-banda che oscilla con un LFO a 0,08 Hz (le onde); gabbiani.
- **Notte** (sera e tombolo): acqua che lambisce (rumore passa-basso 400 Hz con ampiezza modulata a 0,3 Hz), orologio che ticchetta piano (tranne nel prologo, dove è fermo).
- **Pioggia** (Atto II): granulare, 200 grani al secondo di rumore di 2-5 ms filtrati passa-alto a 2 kHz, più un letto passa-basso.
- **Vento**: rumore marrone passa-banda 300-800 Hz con LFO lento.
- **Tempesta**: vento + pioggia + tuoni (rumore marrone di 2,5 s con passa-basso che scende da 800 a 120 Hz).

### 13.4 Musica: il "filò"

Generativa, ispirata alle veglie in cui si filava raccontando.

- **Bordone**: due onde triangolari leggermente desintonate (±4 cent) sulla tonica e sulla quinta, passa-basso 600 Hz, guadagno 0,06, tremolo a 0,05 Hz. Gli accordi ruotano ogni 8 battute fra i (Re-La), IV (Sol-Re) e VII (Do-Sol) di Re dorico.
- **Arpeggio**: ogni 800 ms (75 bpm, crome) una nota a timbro di carillon scelta fra le note dei personaggi presenti nella giornata: salita e discesa con salti decisi da un generatore con seme (il seme è l'ID della giornata, quindi ogni giornata ha la sua musica). Guadagno 0,08.
- **Stati**: titolo (solo bordone e campana), sera (arpeggio lento, 1 nota ogni 1,6 s), notte (arpeggio normale), alba (si aggiunge la quinta sopra, più brillante), Archivio (solo carillon stonato a metà velocità), finale vero (tutte le note di tutti, intonate).
- Durante le battute la musica si abbassa di 8 dB.

### 13.5 Voci (borbottio)

Per ogni sillaba: oscillatore a dente di sega all'altezza del personaggio (con variazione ±8% per sillaba e una leggera discesa lungo la frase) → due filtri passa-banda (F1, F2) della vocale (a 800/1200 Hz, e 400/2000, i 300/2300, o 450/800, u 325/700, Q 8) → inviluppo (attacco 10 ms, rilascio 30 ms). Una sillaba su due ha prima un breve rumore di consonante (15 ms, passa-alto 3 kHz). Le vocali vengono dal testo vero della battuta, così il ritmo del borbottio segue la frase.

| Personaggio | Altezza (Hz) | Sillabe/s | Carattere |
|---|---|---|---|
| Teresa | 260 | 11 | Rapida, acuta |
| Marta | 220 | 8 | Decisa, sillabe corte |
| Don Piero | 110 | 5 | Lenta, grave |
| Gino | 330 | 12 | Saltellante |
| Bepi | 120 | 7 | Ruvida (+20% rumore) |
| Nina | 280 | 9 | Viva |
| Zeno | 100 | 4 | Soffiata (+30% rumore) |
| Lunardi | 150 | 7 | Precisa, formanti spostate in alto del 10% |
| Livia | 200 | 6 | Morbida, passa-basso 2,5 kHz |

Clotilde non parla mai: le sue note a margine hanno solo il suono della penna.

### 13.6 Regole di piattaforma

- `AudioContext` creato e ripreso in modo sincrono nel primo `pointerdown` o `keydown`.
- `suspend()` quando la pagina si nasconde, `resume()` quando torna visibile. Se lo stato non è `running` (anche `interrupted` su iOS), compare "Tocca per continuare".
- L'interruttore del silenzioso di iOS spegne l'audio: va bene, perché ogni informazione sonora ha un equivalente visivo.
- Didascalie dei suoni (se attive): «[campana, ore 9]», «[il vaporetto suona]», «[Marta: borbottio deciso]», «[la febbre passa a Gino]».

---

## 14. Accessibilità

- Ogni filo si distingue per colore, **motivo** e **icona**; ogni perlina per colore e **forma**. Verificato con simulazioni di daltonismo (deuteranopia, protanopia, tritanopia) negli screenshot automatici.
- Alto contrasto; dimensione del testo 90-140% (nessuna scritta, nemmeno nell'HUD del tombolo, si rimpicciolisce sotto la sua misura: si va a capo); movimento ridotto; velocità animazioni (fino a "istantanea").
- Testo su carta con contrasto ≥ 4,5:1, anche il nome dei personaggi dai colori chiari (Lunardi, lino); calligrafie inclinate al massimo di 3°, sempre dentro il foglio.
- Nessun limite di tempo, nessuna pressione prolungata obbligatoria, nessun gesto a due dita.
- Tutto si gioca con la sola tastiera; tutto si gioca con un solo dito.
- Didascalie dei suoni; vibrazione disattivabile; avanzamento automatico delle vignette.
- Testi del DOM leggibili dagli screen reader (bigliettini, Taccuino, menu, bilancio); per il tombolo, una riga di stato testuale nascosta aggiornata a ogni ora ("Ore 9. Teresa al Molo, Marta al Forno…"). L2: tombolo completamente navigabile con screen reader.
- Suggerimenti a tre gradini sempre gratuiti: **Spinta** (evidenzia l'obiettivo più urgente con una frase della nonna), **Indizio** (una frase come «Alle 10 Teresa deve passare sopra Nina»), **Fantasma** (l'incrocio giusto della riga corrente, tratteggiato). Il fantasma toglie il filo d'oro della giornata, nient'altro, e lo chiede prima; il fantasma di una riga di quiete è gratuito. Toccare la lampada riapre il gradino già visto, non sale mai da solo. Se le richieste accettate non stanno insieme, o una non si può più compiere, la lampada lo dice e propone quale lasciare cadere o fino a che ora disfare.

---

## 15. Modello commerciale e store

- Web: tutto sbloccato, nessun pagamento.
- iOS e Android (in futuro): prova gratuita (prologo, Atto I, Merletto del giorno), poi sblocco unico. Un modulo `entitlements` esiste da subito: sul web risponde sempre "sbloccato"; sugli store si collegherà agli acquisti nativi (StoreKit e Google Play Billing) senza toccare il resto del gioco. Nessuna pubblicità, nessun tracciamento: scheda privacy "Nessun dato raccolto".
- `appId` definitivo: `it.trama.merletto` (non va mai cambiato dopo la prima uscita, perché i salvataggi dipendono dall'origine).

---

## 16. Livelli di priorità e tagli

| Livello | Contenuto |
|---|---|
| **L1 (obbligatorio, il gioco completo)** | Tutte le regole di 3.1-3.14; prologo, g01-g23, 4 finali; 6 merletti d'Archivio; Taccuino completo; Libro dei Punti; bigliettini con risposte e anonimi; memoria; Telaio con Rigioca e Riprendi; Ripassa; Merletto del giorno; Merletto libero con gradi; spartito; suggerimenti; audio completo; tutte le schermate di 10.3; interfaccia in inglese; asset di 12.5 (L1); progetti nativi pronti |
| **L2** | Storia in inglese; Settimana; Esercizi della nonna; tutti i fusi intagliati; quadri speciali 5-6; tombolo con screen reader completo; acquisti nativi |
| **L3** | Tovaglia; alfabeto dei punti e merletti segreti |

**Tagli già pronti, in quest'ordine, se il tempo non basta**: (1) gradi del Merletto libero da 6 a 3; (2) arc5 diventa una sola vignetta senza rammendo; (3) g19 e g21 si fondono (Atto III da 7 a 6 giornate); (4) battute generiche da 2 varianti a 1; (5) risposte ai bigliettini solo nei giorni con desideri. **Mai da tagliare**: il solver nei test, il Taccuino, i finali, salvataggi e piattaforma.

---

## 17. Definizione di fatto

Una funzione è fatta quando tutte le voci pertinenti sono vere.

**Per ogni funzione**
- [ ] Rispetta questo GDD (o il GDD è stato aggiornato nel Registro delle modifiche).
- [ ] `npm run build` senza errori né warning di TypeScript; `npm test` verde.
- [ ] Testi solo tramite chiavi i18n; nessuna stringa italiana nel codice.
- [ ] Funziona con mouse, touch e sola tastiera; bersagli ≥ 48 px.
- [ ] Nessuna informazione solo di colore.
- [ ] Ha un'API di debug in `window.__GAME__` sufficiente a testarla da Playwright.

**Per il gioco intero (rilascio web)**
- [ ] `npm run levels:check -- --qualita` verde: ogni giornata risolvibile senza richieste, ogni richiesta singola risolvibile entro la matassa, le combinazioni segnate come "impossibili" sono volute e annotate nei dati, e i criteri di qualità di 3.13 sono rispettati.
- [ ] Test end-to-end: prologo giocato con trascinamenti reali (mouse e touch); percorso d'oro della campagna fino a ognuno dei 4 finali; salvataggio e ripresa a metà notte; Merletto del giorno deterministico; spartito andata e ritorno.
- [ ] Nessuna richiesta di rete esterna (test che lo verifica); funziona offline dopo il primo caricamento.
- [ ] Screenshot automatici senza testo che esce dai riquadri su 360×640, iPhone 15 Pro, iPad orizzontale, 1920×1080, anche con testo al 140%.
- [ ] 60 fps durante il trascinamento sul profilo desktop di riferimento; nessuna allocazione per fotogramma nel ciclo del tombolo; bundle JS ≤ 450 KB gzip; asset ≤ 6 MB.
- [ ] Audio: si sblocca al primo tocco, si sospende in background, "Tocca per continuare" funziona.
- [ ] Salvataggio a ogni ora fissata e in background; due slot con checksum; esporta e importa.
- [ ] Italiano completo e rivisto; inglese completo per l'interfaccia; nessuna chiave mancante (test).
- [ ] Prima ora giocata da un agente "giocatore" con log: nessun punto bloccato senza pista evidenziata.

**Per la pubblicazione sugli store (quando l'autore lo decide)**
- [ ] `npm run app:sync` senza errori; `android/` e `ios/` aggiornati nel repository.
- [ ] APK di debug compilato nel container (`npm run android:apk`).
- [ ] Icone e splash generati; `appCategory="game"`; telefoni bloccati in verticale; privacy manifest presente.
- [ ] Nessun comportamento da browser: niente selezione del testo, zoom, menu del tocco prolungato, rimbalzo dello scroll.
- [ ] `docs/STORE.md` con i passi sul Mac e sulle console degli store.

---

## 18. Registro delle modifiche

| Data | Versione | Modifica |
|---|---|---|
| 2026-10-14 | 1.0 | Prima stesura dal concept vincitore TRAMA, con le correzioni dei giudici (vedi `RICERCA.md`) |
| 2026-10-14 | 1.1 | **Revisione 1 dopo il primo playtest** (121 segnalazioni, `docs/stato/PLAYTEST-1.md`; decisioni e contratti in `REVISIONE-1.md`). Regole: `ginoCorre` diventa «Gino non sta fermo due ore di fila» e con la febbre resta a letto (3.5, 3.6); filo d'oro solo con minimo ≥ 3 (3.13, 3.14); criteri di qualità delle notti K1-K7 (3.13, 5.2, 17). Onboarding: ogni regola nuova annunciata sul tombolo nella sua prima notte, pagina del Libro «Nuova», prologo con fuso fantasma e «Chi sta sopra, dà» per tutti (3.15, 5.7, 9). Archivio: nomi senza contatore dei giusti e senza doppioni, fili usciti nominabili, «Lascia per ora», tutorial, «Rileggi» in sola lettura (4.2, 5.3, 10.3). Tombolo: ora di fine nell'HUD, righe adattive, bolle al tocco, obiettivi completi con spilli e finestre orarie, lettere col destinatario, rancore visibile, «soddisfatta» solo a ora fissata, lampada sempre visibile e fantasma con conferma, «Salta le ore quiete» (10.3, 11, 12.3, 14). Storia: lettera di Clotilde e fascio consegnati a mano alla fine dell'alba di g14 e g16, provenienza degli oggetti, due sere senza oggetto (4.2, 5.6, 6.3); Taccuino che non anticipa (5.8); selezione dell'alba con culmini e coppie (5.9); continuità (5.3 arc2/arc6, 6.1, 6.4, Appendici A e B); g17 si chiama «La donna in nero»; g23 con 2 bigliettini. Finali: A ridisegnato (saluti che danno, senza filtro sulla memoria), C con nodo e riavvolgimento visibili, D con epilogo dalle occasioni piantate e chiusura dei desideri, il merletto finito resta, riconoscimento del finale vero senza la Tovaglia (L3) (5.2, 6.6, 7). Modalità extra: «Chi c'è stanotte», gradi che contano, condivisione con data locale e cartiglio (8). Accessibilità: testo grande mai rimpicciolito, inchiostro ≥ 4,5:1, calligrafia entro ±3° (14) |

---

## Appendice A. Bigliettini dell'Atto I (testo e condizioni)

Formato: **ID**, autore, testo, richiesta (`Condition`), conseguenze principali. Le risposte, dove ci sono, sono indicate con R1/R2. Le conseguenze "se lasciato" valgono anche quando la richiesta fallisce, salvo indicazione.

**g01, La prima sera** (2 spilli)
- `g01.marta`, Marta: «Il Gino stia lontano dal Molo dopo le nove. L'acqua è alta e lui non ha giudizio.» → `maiPresso(gino, molo, 9, 11)`. Ok: Marta all'alba «Brava, merlettaia.» Fallita: Gino si bagna fino alle ginocchia, Marta scrive più dura domani.
- `g01.piero`, Don Piero: «Gentile signorina Ada, la posta mi arrivi entro le dieci, se il Signore e la Teresa lo consentono.» → `consegnata(L_piero, 10)` (entro = l'ora compresa; rev. 1: prima diceva «prima delle dieci»). Ok: voce di Taccuino sul pozzo (indizio: «Don Piero mette via tutto, anche le buste vuote»).
- `g01.gino`, Gino: «VOGLIO SUONARE LA CAMPANA!!! portami in chiesa alle 11» → `presso(gino, chiesa, 11)`. Ok: alle 11 suona la campana del campanile (stonata, fuori orario): vignetta comica, Don Piero ride.

**g02, Si dice** (2 spilli; Teresa ha la voce «La merlettaia nuova è una bambina»)
- `g02.marta`: «Che il Gino non senta le chiacchiere.» → `nonHa(gino, voce:bambina)`.
- `g02.teresa`: «Cara, Don Piero deve sapere la novità entro le nove. È giusto che il parroco sappia.» → `ha(piero, voce:bambina, 9)` (rev. 1: la messa è alle undici, ovunque). R1 «Non è una novità, è una chiacchiera.» R2 «Va bene.» (R1 abbassa la fiducia di Teresa: i suoi bigliettini di g03 sono più freddi).
- `g02.gino`: «voglio fare il giro! Molo alle 8, chiesa alle 11» → `tutti(presso(gino, molo, 8), presso(gino, chiesa, 11))`.

**g03, Il vaporetto delle nove** (2 spilli)
- `g03.nina`: «Domani prendo il vaporetto delle nove per l'esame a Venezia. Al babbo non dire niente: lui è in mare.» → `parte(nina, 9)`. R1 «Diglielo, a tuo padre.» R2 «Vai. È la tua vita.» Ok: flag `ninaEsame`. Sblocca il desiderio di Nina (con qualsiasi risposta o se appuntato).
- `g03.marta`: «Domani nessuno parta. Non voglio vedere partenze.» → `resta(nina)` (conflitto voluto con `g03.nina`).
- `g03.teresa`: «La posta dal vaporetto la prendo io. Fa' che io sia al Molo alle dieci.» → `presso(teresa, molo, 10)`.

**g04, La barca di Bepi** (2 spilli; Teresa ha la voce «Bepi ha venduto la rete buona»)
- `g04.nina`: «Vorrei salutare il babbo prima che esca in barca.» → `incontra(nina, bepi, 6, 7)`.
- `g04.bepi`: «la teresa non vada a dire in giro della rete. specie a mia figlia» → `nonHa(nina, voce:rete)`.
- `g04.piero`: «Bepi passi in Chiesa al ritorno: ha una candela da accendere per sua moglie.» → `presso(bepi, chiesa, 14)`. Ok: vignetta di Bepi in chiesa; primo accenno alla moglie morta (nessun mistero, solo tenerezza).

**g05, Il guardiano** (2 spilli; Teresa ha una lettera per Zeno firmata "L.")
- `g05.zeno`: «Il ragazzo venga a vedere la lanterna alle dodici.» → `presso(gino, faro, 12)`. Ok: sblocca il desiderio di Gino; flag `ginoFaro`. All'alba Gino trova la lanterna spenta (di giorno non si accende): il desiderio di vederla accesa da dentro resta aperto fino al finale.
- `g05.marta`: «Il Gino NON vada al Faro. Là c'è quel vecchio matto.» → `maiPresso(gino, faro, 6, 13)` (conflitto con `g05.zeno`).
- `g05.teresa`: «C'è una lettera per Zeno. Viene da Chioggia. Fa' che arrivi, cara.» → `consegnata(L_zeno, 13)`. Ok: alba con Zeno: «Questa calligrafia… no. Non può essere.» Se Teresa la tiene a fine riga la legge: il segreto «Una certa L. scrive a Zeno» entra nel gioco (e nelle chiacchiere di g07).

**g06, La lettera da Venezia**: vedi 3.16.

**g07, Il pozzo** (2 spilli; Teresa ha il segreto «Ho letto la lettera di Marta, nel '36»)
- `g07.teresa`: «Voglio confessarmi. Che il mio peso arrivi a Don Piero, e a nessun altro.» → `tutti(ha(piero, segreto:confessione), nonHa(nina, segreto:confessione), nonHa(marta, segreto:confessione))`. Il peso non è la lettura in Piazza (la sa mezza isola) ma il fatto che Teresa aveva aperto la lettera prima e sapeva che cosa chiedeva Ernesto.
- `g07.nina`: «Cosa nasconde la Teresa? Voglio saperlo. Ho diciassette anni, non sette.» → `ha(nina, segreto:confessione)` (conflitto; con `ninaCuriosa` è più facile di quanto sembri).
- `g07.zeno`: «Il ragazzo passi dal Faro alle tredici. Gli ho promesso la lanterna.» → `presso(gino, faro, 13)`.

**g08, Il filo nero** (2 spilli)
- `g08.marta`: «Domani è l'anniversario di mio padre. Prima della messa delle undici voglio parlare con Don Piero, e voglio il Gino con me.» → `tutti(incontra(marta, piero, 9, 11), incontra(marta, gino, 9, 11))`.
- `g08.nina`: «La domanda d'iscrizione per Venezia deve partire col vaporetto delle nove. Dalla a chiunque salga.» → `esceCon(L_iscrizione, 9)`. R1 «Il babbo lo sa?» R2 «Partirà.»
- `g08.zeno`: «Stanotte non ho dormito. Dalle tre in poi non voglio vedere nessuno.» → `nonIncontra(zeno, *, 15, 16)`.
- Fine giornata (sempre): apparizione del filo nero sul bordo alto del merletto, all'ora 3, che incrocia Zeno al Faro (il giocatore la vede); Taccuino: «Non l'ho tessuto io.»


## Appendice B. Bigliettini degli Atti II e III (intenzioni)

Il pacchetto di contenuto degli Atti II-III scrive testi e condizioni seguendo queste intenzioni (3-4 per giornata, almeno un conflitto per sera, almeno una risposta per giornata).

| Giornata | Bigliettini (autore: intenzione) |
|---|---|
| g09 | Marta: Gino curato entro mezzogiorno · Teresa: il medico forestiero non tocchi la posta (`nonIncontra(lunardi, teresa)`) · Nina: la febbre non arrivi a lei |
| g10 | Marta: stare vicino a Gino malato (contagio voluto; R1/R2 sblocca il desiderio di Marta) · Lunardi: visitare almeno 3 persone (il testo non chiede un ordine: «e passi anche dal pescatore Scarpa») · Don Piero: messa delle 11 con i sani |
| g11 | Teresa: «voglio parlare con Marta» (porta al primo nodo) · Marta: «non voglio vedere la Teresa» · Gino: la lettera di scuola arrivi alla madre |
| g12 | Lunardi: «come si chiama la merlettaia?» (`ha(lunardi, nome)`; sblocca il desiderio di Lunardi) · Bepi: Nina non sappia del debito · Zeno: nessuno al Faro dopo le 15 |
| g13 | Tutti: curare i malati (4 richieste di cura, 2 spilli: la scelta di chi curare, ma un merletto perfetto li cura tutti; i testi non chiedono un ordine). Gino delira: a letto finché è malato, curato torna a correre |
| g14 | Zeno: incontrare Don Piero (prepara la consegna) · Teresa: una lettera per lei (non arriva: Atto III) · Nina: risultati dell'esame (ammessa al magistrale di Venezia, con un posto in convitto da Pasqua) |
| g15 | Nina: il babbo torni (spilli di Zeno al Faro) · Marta: Gino non esca nella tempesta · Don Piero: le campane a tempesta alle 19 (`presso(piero, chiesa, 19)`) |
| g16 | Zeno: il fascio arrivi a lui · Teresa: non leggere più (non toccare il fascio) · Don Piero: «liberatemi» |
| g17 | Zeno: incontrare la donna in nero (il nero lo cerca) · Teresa: sapere chi è (`ha(teresa, segreto:livia)`; se ci riesce, in g22 la riconosce e poi la dimentica, come l'isola dimentica chi è fuori dal merletto) · Marta: nessuna forestiera in Piazza |
| g18 | Teresa: la confessione arrivi a Marta (via Gino) · Marta: R1/R2 «se la Teresa ha qualcosa da dire, lo dica» · Gino: correre da tutti · Lunardi: incontri almeno 3 |
| g19 | Bepi: la barca al sicuro prima dell'acqua alta · Nina: R1/R2 su Venezia · Teresa: la posta non si bagni (lettere consegnate entro le 10; dopo la pace, Teresa non le legge più) |
| g20 | Nina: partire alle 9 · Bepi: salutarla prima (desiderio di Bepi) · Marta: Gino non la segua al Molo |
| g21 | Zeno: vedere ancora la donna in nero · Don Piero: restituire una lettera a Teresa · Gino: la lanterna alle 20 |
| g22 | Zeno: incontrare Livia (`zenoLivia`) · Don Piero: dare a Livia il fascio rimasto · Teresa: «chi è quella donna?» · Marta: pane caldo per la forestiera |
| g23 | Mattino quieto: 2 richieste semplici, 2 spilli. Dopo la notte, la sera della scelta (6.6), con un solo spillo |
