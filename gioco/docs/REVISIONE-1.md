# TRAMA. Revisione 1 (dopo il primo playtest)

### Direzione creativa, 14 ottobre 2026

> Documento normativo per il secondo giro di lavoro. Fonti: `docs/stato/PLAYTEST-1.md` e `docs/stato/playtest-1.json` (121 segnalazioni di 6 giocatori simulati e rapporto QA), `docs/stato/RICHIESTE.md`, `GDD.md` (aggiornato alla 1.1 insieme a questo documento), `ARCHITETTURA.md`, `PACCHETTI.json`.
> Obiettivo: divertimento ≥ 8 e chiarezza ≥ 8 al prossimo playtest (oggi 6,3 e 4,8), nessun bug, nessun punto in cui un giocatore si blocca o non capisce. La visione non cambia: un gesto solo, la meccanica è la storia, stato sempre visibile, sbagliare non costa.
> Ogni affermazione sul codice è stata verificata sul repository (commit d2a0cbc). I numeri dei livelli vengono dal solver vero (`tools/levels/check.ts`), anche quelli della regola nuova di Gino: per misurarli ho fatto girare una copia del motore modificata fuori dal repository, nella cartella temporanea; il codice del gioco non è stato toccato.

## Indice

0. Sintesi
1. Decisioni (D01-D20)
2. Contratti fra gruppi (C00-C19)
3. Liste di lavoro per gruppo
4. Ordine dei lavori
5. Segnalazioni scartate o rimandate
6. Copertura delle 121 segnalazioni
7. Come si giudica la revisione

---

## 0. Sintesi

Il playtest dice tre cose.

1. **Il gioco non insegna abbastanza e nasconde informazioni.** Regole nuove arrivano in silenzio (matassa, Molo, febbre, nodo), gli spilli non dicono di chi sono, le lettere generate non dicono a chi vanno, gli obiettivi `incontra` nascondono la finestra oraria, l'ora di fine della notte non si vede, la lampada sparisce. La chiarezza a 4,8 viene quasi tutta da qui.
2. **I puzzle sono o meccanici o vuoti.** Lo conferma il solver:
   - in **tutte** le notti con Gino il minimo coincide con il numero delle righe e le ore di quiete possibili sono 0. Gino incrocia in ogni riga e il resto del puzzle si risolve "gratis" mentre lui corre;
   - nelle notti senza Gino molte richieste costano 0-1 incroci (g03, g04, g06, g12, g19) e la notte è una fila di «Fissa l'ora».
3. **Il montaggio narrativo tradisce la storia.** La rivelazione centrale (g14) arriva come punto elenco prima della lettera. Il Taccuino anticipa gli oggetti della sera dopo. Battute generiche schiacciano i culmini. Ci sono incoerenze di continuità. La calligrafia inclinata esce dal foglio e copre i pulsanti (bloccante).

Le decisioni principali:

- **Gino non sta fermo due ore di fila** (non più "ogni ora"), e **con la febbre resta a letto**. Le notti con Gino dimezzano gli incroci meccanici, tornano le ore di quiete e la febbre diventa un dilemma: curare Gino lo rimette a correre (D01).
- **Criteri misurabili per ogni notte**, calcolati da `levels:check`: densità, costo di ogni richiesta, quota di Gino, ritmo delle righe vuote, ambiguità, dilemma. Si ridisegnano le notti che non li rispettano. Il filo d'oro richiede un minimo di almeno 3 (D02).
- **Ogni regola nuova si annuncia sul tombolo la prima notte**, come già fa g12, e la pagina del Libro si evidenzia. Il prologo insegna davvero: il fuso segue la mano fantasma e «Chi sta sopra, dà» compare anche a chi fa giusto (D03, D04).
- **Archivio senza vicoli ciechi**: «Lascia per ora», tutorial, nomi alla maniera di Obra Dinn (nessun contatore dei giusti, conferma a gruppi di tre), fili usciti nominabili, «Chiudi il merletto» che spiega cosa manca (D05).
- **Tutto quello che conta si vede e si tocca** sul tombolo (D06), e i suggerimenti dicono la verità (D07).
- **La lettera di Clotilde si consegna a mano alla fine dell'alba di g14**, prima del bilancio e prima dell'Archivio 1951. Il Taccuino scrive solo quello che Ada ha visto (D09, D10).

---

## 1. Decisioni

Ogni decisione indica le segnalazioni che risolve. Il dettaglio dei formati è nei contratti (sezione 2), il lavoro nelle liste (sezione 3).

### D01. Gino non sta fermo due ore di fila; con la febbre resta a letto

**Problema.** `ginoCorre` obbliga Gino a incrociare in ogni riga in cui può. Il solver lo conferma:

| Notte | Righe | Minimo base oggi | Incroci di Gino nella soluzione ottima | Ore di quiete possibili |
|---|---|---|---|---|
| g02 | 6 | 6 | 6 | 0 |
| g10 | 10 | 10 | 10 | 0 |
| g13 | 14 | 14 | 14 | 0 |
| g15 | 14 | 14 | 14 | 0 |
| g16 | 12 | 12 | 12 | 0 |

Le richieste quasi sempre non aggiungono incroci, perché si soddisfano mentre Gino corre: in g10, per esempio, Marta, Don Piero e Bepi da soli costano tutti 10, come la base. Il giocatore fa avanti e indietro con la stessa coppia (P015, P022, P091). In g13 il bigliettino dice «IL GINO DELIRA» e lui deve correre ogni ora (P091). E il messaggio di rifiuto non si capisce quando il suo unico vicino sta già incrociando con un altro (P094).

**Decisione.** Nuova regola, normativa in GDD 3.6:

- **Gino non sta fermo due ore di fila.** All'apertura conta come appena mosso. Una riga è rifiutata se Gino:
  - non incrocia;
  - aveva un incrocio possibile (definizione invariata: non bloccato, e un vicino non bloccato, non in un incrocio forzato, con un verso ammesso dalle stranezze);
  - **e** non aveva incrociato nemmeno nella riga precedente.

  Una riga in cui Gino è bloccato (nodo, marea) conta come ferma.
- **Con la febbre Gino resta a letto.** Se all'inizio della riga Gino ha la febbre, quella riga non lo obbliga e non conta come ferma.
- **Il vicino impegnato in un altro incrocio conta come libero: Gino ha la precedenza.** Il messaggio lo dice e nomina il vicino.

**Perché questa e non un'altra.** Toglierebbe tutto il problema eliminare Gino da alcune notti (proposta di P091), ma si perderebbe il personaggio più vivo dell'isola. Una regola "a turno" mantiene il carattere («non sta fermo»), dà al giocatore una scelta (quando muoverlo) e restituisce le ore di quiete. La febbre che lo mette a letto è coerente con la storia: in g13 delira davvero. Crea anche un dilemma bello e leggibile: chi cura Gino lo rimette a correre.

**Effetto misurato** (copia del motore con la regola nuova, livelli invariati):

| Notte | Base oggi → nuova | Combinazione designata oggi → nuova |
|---|---|---|
| g01 | 5 → 3 | 6 → 6 |
| g02 | 6 → 4 | 7 → 6 |
| g05 | 7 → 4 | 8 → 6 |
| g07 | 8 → 4 | 9 → 6 |
| g09 | 11 → 8 | 13 → 9 (7 con la febbre) |
| g10 | 10 → 5 | 13 → 9 |
| g11 | 10 → 5 | 11 → 5 |
| g13 | 14 → 7 | 20 → 12 (7 con la febbre) |
| g15 | 14 → 7 | 15 → 8 |
| g18 | 11 → 6 | 14 → 12 |
| g22 | 9 → 5 | 17 → 13 |

La regola da sola non basta, e lo dicono gli stessi numeri: con la regola nuova la base di g10 è 5, e i 5 incroci sono ancora tutti di Gino. Le richieste continuano a costare 0. Per questo D01 va insieme a D02, il ridisegno con criteri misurabili. g16 con la regola nuova supera il limite di 400 000 stati del solver per la base: il controllo deve poter alzare il limite (MOT-03).

Risolve: P015, P022 (in parte), P091, P094, P045 (messaggio).

### D02. Puzzle che chiedono di pensare: criteri misurabili e ridisegno

**Problema.** Notti risolte con 0-1 incroci e poi solo «Fissa l'ora» (g03, g04, g06, g12, g19; P022). Lunghe serie di ore vuote (g21 ore 13-17; finale A con 4 trascinamenti e 8 conferme a vuoto; P115). Filo d'oro senza sforzo (P022).

**Decisione.**

1. `levels:check` calcola per ogni livello di storia e per i finali giocati a mano **sette criteri di qualità** (contratto C14), li scrive nel `.computed.json` e con `--qualita` li rende bloccanti. Ogni notte che non li rispetta si ridisegna, con lo stesso cast, le stesse richieste per intenzione e la stessa storia, verificando sempre col solver. I criteri in breve:
   - densità: almeno un incrocio ogni due righe per ogni richiesta;
   - costo: ogni bigliettino costa almeno 2 incroci in più della base (3 negli Atti II-III);
   - quota di Gino: al massimo il 40% del minimo;
   - ritmo: al massimo 2 righe vuote di fila e al massimo il 40% di righe vuote;
   - ambiguità: al massimo 20 soluzioni ottime;
   - dilemma: almeno un conflitto voluto per sera;
   - intervallo "Min" della tabella GDD 5.2 rispettato (solo avviso).
2. **Filo d'oro solo se il minimo della notte è almeno 3** (`balance.oro.minIncroci`). Una notte che si chiude con 0 incroci non è un'impresa: niente filo d'oro, niente rimprovero.
3. **«Salta le ore quiete»**: quando la bozza è vuota e le prossime ore si possono fissare vuote senza che succeda nulla (nessuno spillo, bordo, marea, nero, scadenza, obbligo di Gino), il tombolo offre «Fissa fino alle N». Serve soprattutto nei finali e nelle notti lunghe; se una notte rispetta il ritmo, compare di rado.
4. Il **finale A** si ridisegna come un vero ultimo puzzle (D14).

Risolve: P015, P022, P091, P115.

### D03. Onboarding: ogni regola si insegna sul tombolo, la prima volta

**Problema.**
- La mano fantasma non muove il fuso, quindi il verso è ambiguo.
- «Chi sta sopra, dà» compare solo a chi sbaglia.
- Gli spilli non dicono di chi sono, e il Disfa pulsa senza spiegazione (P005, P013).
- Matassa e Molo arrivano senza una parola (P014). Febbre e nodo idem (P088). La pagina del Libro sta in fondo all'elenco.
- g12 invece funziona: nota a margine più pulsazione.

**Decisione.** Il modello di g12 diventa la regola.
- Ogni regola o stranezza nuova ha, nella sua prima notte:
  - una nota a margine di Clotilde (o di Ada, a matita, per nome e nero), che compare quando la regola sta per servire: all'inizio dell'ora giusta o al primo evento;
  - una pulsazione sull'elemento del tombolo che la riguarda (matassa, barca del Molo, spillo, fuso, lampada);
  - la sua pagina del Libro segnata «Nuova». Il Taccuino si apre su quella pagina la prima volta che si apre in quella notte.
- Il tutorial del tombolo acquista trigger e bersagli nuovi (contratto C02), sempre senza nuovi tipi di passo.
- **Prologo riscritto**:
  - alle 6 un fuso fantasma semitrasparente segue la mano con una freccia, da Marta su Teresa;
  - lo spillo di Marta pulsa, e al primo incrocio la nota «Lo spillo è un appuntamento…»;
  - alle 7 «Chi sta sopra, dà» compare al primo incrocio, qualunque sia il verso;
  - alle 8 la nota «Sbagliare non costa: ogni incrocio si disfa» accompagna la pulsazione di Disfa;
  - alle 9 resta il «No.».
- Tabella delle prime volte (contenuti):

| Regola | Prima notte | Quando compare | Pulsa |
|---|---|---|---|
| Spillo | g00 | primo incrocio delle 6 | spillo di Marta |
| Chi sta sopra, dà | g00 | primo incrocio delle 7 | – |
| Disfa | g00 | inizio delle 8 | Disfa |
| Gino (regola nuova) | g01 | prima riga rifiutata per Gino, altrimenti inizio delle 8 | fuso di Gino |
| Voce | g02 | prima riga (già c'è) | – |
| Matassa | g02 | inizio delle 8 | gomitolo |
| Molo | g03 | inizio dell'ora prima del vaporetto | barca |
| Barca di Bepi | g04 | inizio dell'ora prima della barca | barca |
| Faro (Zeno) | g05 | primo rifiuto di Zeno, altrimenti inizio delle 8 | fuso di Zeno |
| Segreto e Teresa che legge | g06 | primo evento `legge` | – |
| Pozzo, Nina curiosa | g07 | primo `passa` verso Don Piero / primo segreto ricevuto da Nina sopra | – |
| Febbre, cura, Gino a letto | g09 | prima riga; primo `cura` | fuso di Gino, fuso di Lunardi |
| Nodo | g11 | prima riga | fusi di Teresa e Marta (segno del rancore) |
| Nome | g12 | già c'è | – |
| Trabocco | g16 | prima riga; primo `trabocca` | fuso di Don Piero |
| Filo nero | g17 | prima riga (a matita, mano di Ada) | – |
| Marea | g19 | inizio dell'ora prima dell'acqua alta | colonne allagate |
| Archivio | arc1 | prima riga; nomi confermati; rammendo fatto | fuso sbiadito 1 |
| Occasioni | arc6, finale D | già c'è | primo posto libero |

Risolve: P002, P005, P013, P014, P088.

### D04. Le note a margine non coprono il gioco

**Problema.** La nota copre la riga corrente, gli spilli, gli slot e gli incroci; non si chiude e lascia passare i tocchi (P004, P107). Una violazione produce tre messaggi: banner rosso, nota e riquadro in basso.

**Decisione.**
- **Posizione.** La nota non interseca mai:
  - la riga corrente e le due righe future visibili;
  - gli spilli, gli slot, le icone di bordo e gli incroci non fissati;
  - la fascia dei fusi, la striscia delle richieste e la barra delle azioni.

  Va sopra le righe già fissate. Se lo spazio non basta, nella fascia fra l'intestazione delle colonne e il merletto, che si sposta in giù per farle posto. Nel layout largo va nel pannello di sinistra, in cima.
- **Durata.**
  - Un tocco la chiude e il tocco non passa sotto.
  - Si chiude da sola alla prima azione valida successiva, purché siano passati almeno 4 s. Altrimenti resta 12 s.
  - Con l'avanzamento automatico spento resta finché il giocatore non agisce.
- **Una nota alla volta**, in coda. Ogni testo si mostra una volta per notte.
- **Un solo messaggio per violazione.** Il pulsante «Fissa l'ora» vibra e sotto compare una riga di motivo. Se parte una nota del tutorial, quella riga non compare. I rifiuti di riga non producono mai un avviso a banner.

Risolve: P004, P107.

### D05. Archivio senza vicoli ciechi

**Problema.**
- Una volta aperto, non si torna alla storia (P001).
- Niente spiega come si nomina (P002).
- Il contatore dice subito se un nome è giusto; i nomi doppi sono ammessi; il selettore si sbaglia col dito (P003).
- Su touch il tocco sul fuso sceglie da solo un nome, per un click fantasma (P086).
- Un filo uscito col vaporetto non si può più nominare, e «Chiudi il merletto» non risponde (P019).
- «Rileggi» azzera il merletto (P032).
- Nel layout largo il pannello è vuoto e gli echi non dicono chi parla (P099, P070).

**Decisione.**
1. **«Lascia per ora»** nella Pausa di ogni notte d'Archivio: si torna alla cassapanca, con «Più tardi» per proseguire la storia. I nomi già confermati restano nel Taccuino (contratto C10).
2. **Nomi alla maniera di Obra Dinn.**
   - Nessun contatore dei giusti: il selettore mostra «Nomi dati: 2 di 4 · si confermano a gruppi di tre giusti».
   - Quando fra i nomi provvisori ce ne sono almeno tre giusti (o tutti quelli che restano, se sono meno di tre) si confermano da soli, con ricolorazione e vibrazione.
   - Se tutti i fili hanno un nome provvisorio e la conferma non scatta: «Tre nomi giusti non ci sono ancora».
3. **Niente nomi doppi.** Dare a un filo un nome già usato lo sposta, con un messaggio («Teresa ora è sul filo 2»).
4. **Ogni filo sbiadito si nomina da ovunque.** Vale per:
   - il fuso, con tocco o pressione lunga (la pressione lunga non apre più la scheda vuota);
   - un qualunque tratto del suo filo, anche dopo che è uscito dal merletto;
   - l'elenco «Fili da nominare» nel pannello dell'Archivio o nel popup degli obiettivi.
5. **Il selettore non tradisce il dito.**
   - Si apre al `click` e non al `pointerup`.
   - Ignora i tocchi per 350 ms dopo l'apertura e ha altezza fissa («Togli il nome» c'è sempre, disattivato se non serve).
   - Si apre lontano dal punto toccato.
6. **«Chiudi il merletto» spiega sempre** che cosa manca (nomi o rammendo, con le ore). «Ricomincia la notte» nell'Archivio conserva i nomi confermati.
7. **Tutorial del primo Archivio** (arc1):
   - «Chi è questo filo? Toccalo e dagli un nome.», con il fuso 1 che pulsa;
   - quando tutti i nomi sono confermati: «Ora ritessi le ore strappate, com'erano.»;
   - a rammendo fatto: «Tocca gli incroci: si ricordano.».
8. **Pannello dell'Archivio** nel layout largo, a sinistra:
   - i fili da nominare con il loro nome provvisorio;
   - i candidati;
   - gli strappi da rammendare;
   - dopo il rammendo, il registro degli echi.

   Gli echi mostrano i due nomi del crocevia («Teresa → Marta, alle 9»). La lampada c'è anche nell'Archivio.
9. **«Rileggi»** apre il merletto rammendato in sola lettura, con nomi, colori ed echi.

Risolve: P001, P002, P003, P019, P032, P070 (Archivio), P086, P099.

### D06. Sul tombolo tutto quello che conta si vede, e toccandolo si spiega

**Decisione.**
- **HUD**: «Ore 7 · fino alle 20» (ora di fine sempre visibile) (P087).
- **Righe**: l'altezza della riga si adatta perché tutta la notte stia sullo schermo: `rowH = clamp(spazio / (righe + 0,6), 30, 56)`. Sotto i 30 px le righe tornano a 40 px e compare un indicatore di scorrimento in fondo al merletto («↓ altre 3 ore», tocco per scorrere). Gli spilli e gli slot futuri nascosti sono elencati negli obiettivi (P087, P105, P072).
- **Tocco che spiega.** Un tocco (o il passaggio del mouse) apre una bolla che si chiude al tocco successivo:
  - su uno spillo d'ottone: «Teresa al Forno alle 9: appuntamento fisso»;
  - su una barca o un bordo: «Alle 8 il vaporetto: chi è al Molo esce. Entra il marinaio con la lettera per Nina»;
  - su una perlina: la sua etichetta e chi la porta;
  - su un'etichetta d'ora: gli eventi di quell'ora;
  - sull'incrocio annunciato del filo nero.

  Ora e icona d'evento stanno affiancate: l'icona non sostituisce più il numero (P013, P031, P042, P049, P100).
- **Obiettivi completi**:
  - popup con il contatore sul pulsante («2/5»), senza titolo ripetuto, con gli spilli d'ottone e un'ombra di scorrimento;
  - nel layout largo, lo stesso elenco nel pannello di sinistra (componente del tombolo montato dalla campagna, contratto C08) (P042, P046, P054, P070).
- **Lettere con destinatario**: «la lettera per Zeno», numerate se più d'una per la stessa persona; toccando la busta compare il destinatario (P037).
- **Finestre orarie** in ogni obiettivo `incontra` e nei suoi messaggi: «Bepi incontra Lunardi fra le 7 e le 10» / «… non si sono incontrati entro le 10» (P038).
- **Rancore visibile**:
  - un piccolo nodo disegnato sulla testa dei due fusi in rancore, finché la regola vale;
  - una riga negli obiettivi «Teresa e Marta sono in rancore»;
  - la scheda del personaggio lo dice (P041).
- **Stranezze nelle modalità extra**:
  - nel Merletto del giorno, nel libero e negli spartiti la scheda del fuso elenca tutte le stranezze attive del livello;
  - la scheda della modalità ha una sezione «Chi c'è stanotte» (P045).
- **Nella campagna la scheda del fuso non anticipa il Taccuino**: una stranezza compare per esteso solo quando la mostra anche il Taccuino. È la stessa regola di `quirkRevealed` in `src/campaign/diary.ts` (P017).
- **«Soddisfatta» solo sulle righe fissate.** L'anteprima della riga in bozza dà al massimo lo stato «si compie se fissi l'ora» (spunta tratteggiata, nessun avviso) (P025, P102).
- **Slot delle occasioni leggibili**:
  - icona sopra il filo, su fondo pieno;
  - etichetta col tipo e l'ora al passaggio del mouse e alla pressione lunga;
  - il bersaglio del tocco coincide con il cerchio disegnato;
  - il chip «Occasioni: n/5» sta fuori dalla griglia;
  - «Riprova» azzera il contatore degli obiettivi (P071, P072, P104).
- **Desktop grande**:
  - il centro cresce fino a 960 px e scala perline, spilli e numeri delle ore;
  - il filo nero ha sempre un bordo chiaro;
  - i motivi di Gino (onde) e Teresa (righe oblique) diventano più marcati, senza cambiare i colori, che sono identità del personaggio (P034, P046).

### D07. I suggerimenti dicono la verità e non rubano il filo d'oro

**Problema.**
- Con richieste incompatibili la lampada ripete «lascia stare i fili» e il fantasma costa il filo d'oro per dire «non fare nulla» (P020).
- La lampada è invisibile per 60 s (P026) e sparisce dopo ogni ora (P101).
- Il terzo tocco sulla lampada chiama il Fantasma senza avviso (P103).

**Decisione.**
1. **La lampada è sempre visibile**, tenue. Si accende (invito) dopo 60 s senza fissare o dopo 3 Disfa sulla stessa riga. Dopo il primo suggerimento della notte resta accesa per tutta la notte.
2. **Il tocco sulla lampada riapre il gradino più alto già mostrato in quella riga**, o la Spinta se non ce n'è. Non avanza mai da solo. Si sale solo con i pulsanti della scheda. Una Spinta identica all'ultima già letta stanotte si salta e si va all'Indizio.
3. **Il Fantasma chiede conferma** se il filo d'oro è ancora possibile: il pulsante diventa «Sì, mostramelo (perdi il filo d'oro)».
4. **Il Fantasma su una riga di quiete è gratuito**: se l'incrocio giusto è "nessuno", non si perde il filo d'oro.
5. **Richieste incompatibili.** Quando il solver dice "impossibile" con le richieste accettate, la lampada non ripiega più in silenzio sugli obiettivi obbligatori:
   - se togliendo una richiesta le altre tornano possibili: «Stanotte la richiesta di Nina e quella di Zeno non stanno insieme: una va lasciata cadere», con un pulsante «Lascia cadere lo spillo di …» per ciascuna;
   - se una richiesta da sola non è più possibile da questo punto: «Da qui la richiesta di Nina non si compie più: disfa fino alle 8, o lasciala cadere». L'ora è l'ultima da cui torna possibile.

   Solo dopo, gli indizi seguono la strada migliore con quello che resta.
6. **Comandi da tastiera visibili**: pagina «Comandi» nella Pausa; con le frecce il cursore raggiunge tutte le colonne anche nell'Archivio.

Risolve: P020, P026, P101, P103.

### D08. Testi generati dal tombolo grammaticali in italiano e in inglese

**Decisione.**
- Le etichette delle perline sono sintagmi nominali in minuscolo con l'articolo, leggibili a metà frase: «la lettera di Ernesto per Marta», «la chiacchiera sulla merlettaia bambina», «il nome del dottore». Le lettere nominano sempre il destinatario.
- Il tombolo mette la maiuscola alla prima lettera di ogni frase composta.
- Ogni condizione su una perlina usa un modello per tipo di perlina (riceve / sente / conosce / ricorda il nome di Ada / ha la febbre; contratto C16).
- `almeno(n, …)` con parti dello stesso tipo si compatta: «Almeno 3 fra Teresa, Gino, Bepi, Nina e Zeno sanno il nome del dottore (entro le 20)».
- In inglese le ore si scrivono «8 pm».
- I messaggi di violazione distinguono nodo e marea e il filo nero, senza accordi di genere sbagliati (contratto C13).

Risolve: P006 (popup), P012, P029, P048, P082, P093, P112, P118.

### D09. La rivelazione di g14 è una scena, e gli oggetti arrivano da dove arrivano

**Problema.** Alla fine di g14 il bilancio elenca «L. è Livia, mia madre. È viva» e «Ho letto la lettera della nonna tre volte» prima che il giocatore l'abbia letta. Poi si gioca l'Archivio 1951. Solo la sera dopo la lettera arriva «portata dalla laguna» (P056). Tutti gli oggetti dicono «La laguna ha lasciato qualcosa», anche il merletto della nonna, la lettera che porta Zeno, i biglietti di Livia sotto la porta (P009, P074).

**Decisione.**
1. **Oggetto dell'alba** (`dawnObject`, contratto C04). Alcuni oggetti si consegnano a mano alla fine delle vignette dell'alba, prima del bilancio:
   - la vignetta di consegna di Zeno («Me l'ha data lei, alle due…») è obbligatoria;
   - segue la lettura a tutto schermo;
   - solo dopo il bilancio, con le voci del Taccuino sbloccate dalla lettura;
   - solo dopo ancora la cassapanca con l'Archivio 1951, che la lettera annuncia («Lo troverai nella cassapanca»).

   Si usa in **g14** (lettera di Clotilde) e in **g16** (il fascio delle lettere di Livia, se liberate). Così l'Atto II finisce con Ada che legge la voce di sua madre (GDD 6.3).
2. **Provenienza degli oggetti**, scritta nei dati: laguna (bottiglie, fuso del faro, pagina strappata, bottiglia col nodo nero), mano (lettera di Clotilde e fascio, da Zeno), porta (biglietti di Livia), casa (merletto della nonna, Libro dei Punti, nastro). Ogni provenienza ha la sua frase d'arrivo.
3. **Due sere senza oggetto**, con una ragione: la sera di g15 («Stasera la laguna non porta niente: è nera, e si alza il vento») e la sera di g17 (cartello dell'Atto III, primavera; «Sotto la porta non c'è niente. Fuori, qualcuno cammina sulla Fondamenta»). È una deroga voluta a «ogni sera un oggetto» (GDD 5.6 aggiornato).

Risolve: P009, P056, P074.

### D10. Il Taccuino ricorda, non anticipa

**Decisione.**
- Le voci del Taccuino che parlano di un oggetto o di una lettera si sbloccano **quando Ada lo legge** (nuova condizione `{knows: 'oggetto', id}`, contratto C03), non con `{done: gNN}`. La campagna aggiorna il Taccuino subito dopo la lettura dell'oggetto. Lo stesso vale per persone non ancora viste (Nina si conosce in g03, non in g02) (P008, P023, P064).
- **Le piste arrivano prima delle risposte.** Una pista di una domanda già risolta non si sblocca più. Nella scheda Domande le piste stanno sopra la risposta e si nascondono a domanda risolta (P064, P090).
- **Dopo la scelta di g23 non c'è più pista**: al suo posto una frase di chiusura (P120).
- La scheda **Lettere** esiste dalla prima bottiglia (g02), così ogni lettera si rilegge (P007).
- Le schede del Taccuino stanno in una sola riga che scorre (P016).

### D11. L'alba rispetta i culmini

**Problema.** Dopo il nodo, le 168 lettere, la pace, l'alba chiude con «Ah, cara, che giornata!» (P067, P117). In g18 la vignetta del pane («Lo so. Siediti, che il pane è caldo») non compare mai. È scartata perché parla la stessa persona della vignetta precedente: un difetto di `selectDawn`, verificato nel codice.

**Decisione** (selezione normativa, GDD 5.9 aggiornato):
1. Le vignette scritte di priorità ≥ 100 (culmini) escono **tutte**, nell'ordine dei dati, anche se parla lo stesso personaggio di seguito. Una vignetta con `dopo: <id>` esce subito dopo quella. Il massimo sale a 4 solo se servono per i culmini.
2. Poi le altre vignette scritte (80, 60, 50), con le regole di oggi (niente stesso personaggio di seguito, niente vignette viste negli ultimi 3 giorni salvo priorità ≥ 80).
3. Le **battute generiche** (eventi e riserva) si aggiungono solo se le vignette scritte sono meno di 2, e mai in una giornata con un culmine. Le battute di riserva si usano solo se non c'è nessuna vignetta scritta. Le battute che citano numeri o persone (es. «li ho contati: sette!») hanno una condizione che le rende vere.
4. Gli avvisi delle voci nuove del Taccuino durante l'alba compaiono dopo l'ultima vignetta, non sopra la prima (RICHIESTE, traduzione-en).

Risolve: P067, P117.

### D12. Il bilancio racconta conseguenze vere, una volta sola

**Decisione.**
- Ogni bigliettino con richiesta ha un **esito scritto** per soddisfatta e per fallita (`esito`, contratto C05). La frase di riserva «Per Marta è andata come sperava» resta solo come rete di sicurezza: un test di contenuto ne vieta l'uso (P018, P028, P068).
- Una voce del Taccuino usata come conseguenza non si ripete in «Nel Taccuino» (P028).
- «Ora so che cosa desidera X» solo la prima volta (P078).
- Il record va al plurale corretto: «1 incrocio, 1 ora di quiete» (P027, P078).
- La sezione degli obiettivi si chiama «Come doveva andare», non «Il merletto del giorno» (P098).

### D13. Continuità: le versioni canoniche

| Incoerenza | Versione canonica | Segnalazioni |
|---|---|---|
| Gino vede la lanterna accesa da dentro in g05 | In g05 Gino sale al Faro ma la lanterna di giorno è spenta («È tutta vetri e ottone, ma spenta!»; Zeno: «Si accende alle sei. Da dentro, un giorno.»). Il desiderio resta aperto fino al finale | P059 |
| Teresa riconosce Livia in g17 e non la conosce in g22 | Coerente con la regola dell'isola: chi non è nel merletto si dimentica. Variante di g22.teresa se g17.teresa è riuscita: «Quella donna l'avevo riconosciuta, cara, e poi mi è scappata come una parola. Voglio rivederla appena mette piede sull'isola.» | P060 |
| Teresa legge dopo la pace | Varianti di g19 con `riconciliate`: «Non le leggo più, ma l'acqua sì» | P061 |
| Filo d'avorio «l'unica volta» contro arc6 | arc6 è il merletto di prova, la **prima** volta in cui Clotilde si diede un filo (Livia bambina). arc2 è l'**ultima**. Si correggono i testi di arc2 («l'ultima volta che si tessé dentro»), la nota a margine di arc2 («Un'ultima volta, dentro.») e la lettera («il filo d'avorio ha tenuto fino alle tre») | P062 |
| Filo nero raccontato ma mai visto in g08 e g15 | Si vede: alla chiusura del merletto il tombolo mostra l'**apparizione** del filo nero sul bordo alto, all'ora 3, che incrocia Zeno al Faro (g08). In g15 entra di due colonne (contratto C12). In g15 «più vicino dell'altra volta», non «di ieri» | P063 |
| Percorso scolastico di Nina | Una sola linea: esame (g03), promossa (g06), domanda d'iscrizione (g08), **ammessa al magistrale con un posto in convitto da Pasqua** (g14), partenza in primavera (g20). In g13 Lunardi non parla di esami | P066 |
| Il «segreto» di Teresa è pubblico | Che una lettera fu letta in Piazza lo sa mezza isola. Il segreto è un altro: **Teresa l'aveva aperta prima, sapeva che Ernesto chiedeva a Marta di partire con lui, e la lesse ad alta voce lo stesso**. Si toglie «non so più perché» (g11). In g18 Teresa sa del ruolo della nonna perché gliel'ha detto Ada («me l'ha detto la piccola») | P069 |
| Don Piero «pozzo» che riferisce (g06) | La vignetta passa a chi la voce l'ha data, non al pozzo | P069 |
| Deissi dei bigliettini | I bigliettini si leggono la sera e parlano di **domani** («Domani nessuno parta»). Le albe parlano di oggi | P065 |
| Lettera di Clotilde: «ogni giorno» e «biglietto del cuscino» | «una per una, per quattordici anni»; «Come sul biglietto appuntato al tombolo» | P080 |
| Teresa «a sedici anni portavo la posta» | «a sedici anni impastavo già il pane per mia madre» | P075 |
| «La notte scorsa» nell'Archivio 1965; messa delle nove | «1965. La notte in cui morì la nonna.»; il bigliettino di g02 dice «entro le nove» | P076 |
| Geografia e scene minori | g04: «Al Molo resta solo la sua rete»; g20: «fino a Pellestrina»; l'eco di arc2 dell'una diventa un ricordo; in arc6 «Don Piero», giovane cappellano | P081 |
| Nastro d'avorio mai ripreso | Lo nominano gli epiloghi A e D (D14) | P085 |
| Voci dei personaggi | Revisione voce per voce: Gino con gli errori da g01, Bepi senza doppie e minuscolo («la nina») sempre, Don Piero dà del lei, Ada narratrice dice «la Nina», «il Gino» | P079 |
| Bigliettini che chiedono vincoli non controllati | Si riscrive il testo e non si aggiunge la condizione: «e passi anche dal pescatore Scarpa», «Curalo, ti prego» | P092 |
| Esito di g12 su chi ha portato la voce | Testo neutro: «La Nina ha saputo del debito. Il Bepi non parla più a nessuno.» | P095 |
| Bilancio e Taccuino contraddittori (g10, g11, g13, g21) | Esiti specifici (D12) e voci riscritte, una per una | P068 |
| Lettera del 1951 «custodita da Don Piero» | «la lettera del 1951, che mia madre ha riavuto dal pozzo» | P113 |
| Titoli doppi e anni ripetuti | g17 si chiama «La donna in nero»; arc3 «La febbre» (l'anno è già nell'intestazione) | P097, P119 |
| Stagioni | «La storia di quell'anno è finita»; «Per un autunno e un inverno»; cartello d'atto con la stagione alla prima sera di ogni atto | P077 |
| g23: «Domani è la vigilia» | **Corretto così**: la sera di g23 precede la giornata della vigilia (vedi sezione 5). Si correggono gli spilli senza bigliettini (D14) | P114 |

### D14. Finali all'altezza

- **Finale A (la merlettaia), ridisegnato.**
  - Oggi sono 4 trascinamenti di Livia e 8 conferme a vuoto.
  - Diventa: i saluti si fanno **dando**, perché chi saluta passa sopra a Livia e le consegna qualcosa: il pane di Marta, la lettera di Teresa, la benedizione di Don Piero, la valigia di Zeno.
  - Almeno 4 saluti su 6, con un conflitto voluto: due saluti nella stessa ora agli estremi della Fondamenta.
  - Livia sale sul vaporetto delle 18.
  - Deve rispettare i criteri di C14 con base ≥ 8. Il filtro sulla memoria di GDD 6.6 cade: lo spiega GDD 6.6 aggiornato.
- **Finale C (il merletto chiuso).**
  - Quando si fissa l'ora 9 il tombolo mostra il nodo che si chiude su tutti i fili, poi il merletto che si disfa all'indietro.
  - Niente «Il merletto è chiuso» e niente jingle di successo: suono del nodo e campana stonata.
  - Poi il cartello nero. Dopo il finale vero la campana resta stonata qui (contratto C11).
  - Tornati alla scelta, il biglietto di Clotilde è piegato e non si riappunta, con la voce «Il punto di Clotilde».
- **Finale D (il merletto aperto).**
  - La prima vignetta dell'epilogo nomina le occasioni davvero piantate, con il parametro `{occasioni}` (contratto C04).
  - Si aggiungono almeno 3 vignette che chiudono i desideri tessuti quella notte: Teresa riceve una lettera scritta per lei; Gino dentro la lanterna accesa; Lunardi chiamato per nome; Nina; Zeno e Livia.
  - Il nastro della nonna compare: «Il nastro era abbastanza lungo per due fili. Ne ho fatto uno per me e uno per mia madre.»
- **Il merletto finito resta.** Nei finali la campagna non passa più all'epilogo dopo 1,6 s: il merletto resta sullo schermo con un pulsante «Continua».
- **Riconoscimento del finale vero.**
  - Nella schermata Fine: «La campana suona intonata. Hai trovato il punto aperto.».
  - Nel titolo un dettaglio visibile: filo corallo sul tombolo e stella accanto a «Telaio».
  - La Tovaglia **non** si nomina: è L3 e non esiste (GDD 7 aggiornato).
- **Sera di g23.** Due bigliettini semplici (GDD Appendice B) con 2 spilli. La scelta usa sempre un solo spillo. Gli spilli si mostrano solo se ci sono bigliettini.

Risolve: P073, P085, P106, P108, P109, P110, P111, P114 (spilli), P115, P121.

### D15. Calligrafia: il foglio si inclina, il testo resta nel foglio

**Problema.** `.core-carta--mano .core-carta-testo` ruota il blocco di testo intero con `transform-origin: left top`. Più il testo è lungo, più esce dal foglio a sinistra, fino a coprire i pulsanti. Il paragrafo intercetta i clic e «Appunta», «Lascia», «Rispondi» non rispondono (P007, P021, P057, P058: bloccante).

**Decisione** (contratto C17).
- Si ruota il foglio intero (`.core-carta--mano`), con un'inclinazione limitata a ±3°. Il testo non ha trasformazioni proprie.
- Il foglio delle lettere lunghe scorre in verticale dentro sé stesso.
- I pulsanti stanno fuori dal foglio, in un livello sopra.
- Il testo ha `pointer-events: none`.
- La grafia di Marta passa a uno stampatello netto (font `atkinson`, maiuscolo): la L non si legge più come C (P033, P084).
- Il nome dei personaggi su carta usa un inchiostro scurito fino a contrasto ≥ 4,5:1 (Lunardi oggi 3,9:1). Il colore pieno resta nella sottolineatura e nell'icona (P096).

### D16. Interfaccia e accessibilità

- **HUD con testo grande** (P039).
  - Le scritte dell'HUD del tombolo non scendono mai sotto 15 px × scala del testo.
  - Si va a capo invece di troncare. Le colonne strette usano il nome breve, e sotto i 44 px solo l'icona con nome accessibile.
  - Il calcolo si rifà a sovrapposizioni chiuse e a font caricati.
- **Impostazioni opache** sopra la Pausa, con un colore di foglio dedicato in alto contrasto. Niente parole spezzate nei segmenti: a testo grande vanno in colonna (P043, P047).
- **Merletto libero.** Con una notte a metà sullo stesso seme il pulsante fisso diventa «Riprendi il merletto», e «Tessi da capo» chiede conferma (P036).
- **Musica della notte nelle modalità extra**, con il seme del livello (P040).
- **Offline dopo il primo caricamento**: un service worker mette in cache index, chunk, font e `assets/` (≤ 6 MB). Il test `rete.spec.ts «senza rete»` deve passare (QA, GDD 0 e 17).
- **Gli avvisi brevi non prendono i tocchi** (`pointer-events: none`) (QA).
- **Esc o Indietro nella sera senza pannelli aperti** chiede «Tornare al titolo? È tutto salvato.» invece di uscire (P116).
- **Prologo raccolto** (P083):
  - niente Taccuino sullo schermo nero;
  - titolo su una fascia scura;
  - il biglietto appuntato sul tombolo.
- **Didascalie dei suoni** sopra il piede del titolo, mai sopra i pulsanti. Il menu del titolo ha un'ombra quando scorre (P055).

### D17. Modalità extra che si capiscono

- La scheda del Merletto del giorno e del libero ha **«Chi c'è stanotte»**: personaggi, stranezze attive e coppie in rancore (P041, P045).
- **I gradi devono contare**: il generatore scarta un grado che non cambia nulla (P044). Per esempio:
  - spilli velati senza spilli oltre la seconda ora;
  - rancore fra due che non si incontrano mai;
  - filo nero che non tocca la soluzione.
- **Condivisione** (P050):
  - data nel formato della lingua (`Intl`);
  - nel PNG un cartiglio con TRAMA, data, incroci e minimo;
  - nel libero il pulsante «Condividi il seme».
- **Titolo al primo avvio**: le modalità bloccate si vedono col lucchetto e la condizione («dopo la giornata 7») (P053).
- **Testi coerenti con stato e modalità** (P051):
  - «Tessuto oggi: 7 incroci, già il minimo»;
  - nessun riferimento a richieste appuntate dove non ce ne sono;
  - «Clicca per iniziare» col mouse.

### D18. Nativo pronto per gli store

- `ios/App/App/PrivacyInfo.xcprivacy` dichiara anche `NSPrivacyAccessedAPICategoryFileTimestamp` con motivo `C617.1`, richiesto da `@capacitor/filesystem`.
- `npx cap sync` registra `@capacitor/filesystem` in `android/capacitor.settings.gradle` e nel `Package.swift` di iOS. Oggi manca in entrambi: verificato.
- `native:check` controlla entrambe le cose.
- `docs/STORE.md`:
  - mette in evidenza la grafica di Google Play già pronta (`assets/feature-graphic.png` e `assets/feature-graphic-en.png`, 1024×500), che oggi risulta «da preparare»;
  - aggiorna la sezione privacy.

### D19. Proprietà dei file non assegnati, test end-to-end, rigenerazione

- `src/content/loader.ts`, `src/content/validate.ts`, `vite.config.ts`, `README.md`, `tsconfig.json` e i file del service worker (`public/sw.js`) erano di fondamenta: in questa revisione sono del gruppo **schermi**.
- `tests/e2e/` non ha un gruppo in questa revisione: nessuno li modifica. Ogni gruppo:
  - mantiene stabili i `data-test` esistenti, salvo quelli cambiati in C18;
  - tiene verdi build, test unitari e `levels:check`.

  L'allineamento delle suite e2e è il primo compito del giro di QA che precede il playtest 2.
- **Rigenerazione dei `.computed.json`.** Ogni gruppo di contenuto rigenera **solo i propri livelli**, con `npm run levels:check -- --only <id,id,…>`. Nessuno lancia `levels:check` senza `--only` sulla cartella condivisa.

### D20. Ordine dei lavori

Tre ondate (sezione 4). Prima i contratti di tipo e la regola del motore (ondata 0-1), perché tutto il resto ci si appoggia. Poi tutto in parallelo. Il ridisegno dei livelli parte quando la regola di Gino e le metriche sono nel motore (ondata 2).

---

## 2. Contratti fra gruppi

I contratti sono definiti al punto che i gruppi possono lavorare in parallelo senza parlarsi. Dove un contratto cambia `src/core/types.ts`, il testo da aggiungere è dato qui alla lettera e lo aggiunge **solo schermi** (SCH-01). Gli altri scrivono codice contro questi tipi.

### C00. Aggiunte a `src/core/types.ts`, `src/core/ids.ts` e `src/content/validate.ts`

Solo aggiunte: campi opzionali e varianti nuove. Nessuna forma esistente cambia.

```ts
// StoryCond: nuova variante di 'knows'
| { knows: 'quirk' | 'diary' | 'desire' | 'rule' | 'archive' | 'oggetto'; id: string }

// Tutorial (sostituisce TutorialStep; le forme di oggi restano valide)
export type MarginWhen =
  | 'primaOra' | 'ora' | 'incrocio' | 'versoSbagliato' | 'rifiuto' | 'spillo' | 'evento'
  | 'nome' | 'archivioNomi' | 'archivioRammendo';
export type PulseTarget =
  | 'fissa' | 'taccuino' | 'nome' | 'disfa'
  | 'lampada' | 'obiettivi' | 'matassa' | 'bordo' | 'spillo' | 'fuso' | 'marea';
export type TutorialStep =
  | { k: 'mano'; hour: Hour; pair: number; over: Side }
  | { k: 'margine'; when: MarginWhen; textKey: string; hour?: Hour;
      codice?: Violation['code']; evento?: LaceEventKind; chi?: ThreadId; mano?: 'clotilde' | 'ada' }
  | { k: 'pulsa'; target: PulseTarget; hour: Hour; thread?: ThreadId };

// Oggetti della campagna
export interface ObjectMeta { from: 'laguna' | 'mano' | 'porta' | 'casa'; by?: CharacterId }
// CampaignDay: + dawnObject?: string; eveningEmptyKey?: string;
// CampaignDef: + objects?: Record<string, ObjectMeta>;

// Bigliettini
// NoteDef: + esito?: { ok?: string; fallita?: string; lasciato?: string };

// Vignette
// VignetteDef: + dopo?: string;

// Livello
// LevelDef: + chiusura?: 'nodo';
//           + apparizione?: { hour: Hour; side: EdgeSide; passi: number };

// Motore
// LaceState: + ginoFermo?: 0 | 1;
// BalanceDef: + oro?: { minIncroci: number };
export interface QualityConfig {
  config: string;                 // 'base' | '<noteId>' | '<noteId>+<noteId>[+<noteId>]'
  min: number | null;             // minimo incroci (null = impossibile)
  minSenzaGino: number | null;    // minimo togliendo 'ginoCorre' (null se Gino non c'è)
  costo?: number;                 // solo bigliettini singoli: min(base+nota) − min(base)
  vuoteMax: number;               // righe consecutive senza incroci del giocatore nella soluzione registrata
  vuoteTot: number;
  soluzioniOttime: number;        // countOptimal (fino a 50)
}
export interface QualityReport { configs: QualityConfig[]; designata: string; facili: NoteId[]; violazioni: string[] }
// LevelComputed: + quality?: QualityReport;

// Conoscenza
// Knowledge: + bookSeen?: string[];

// Eventi
// GameEventMap: + 'tombolo:nodo': { levelId: LevelId };
//               + 'tombolo:apparizione': { levelId: LevelId };
```

`src/core/ids.ts`: `KNOWS_KINDS` comprende `'oggetto'`. Si aggiungono le liste `MARGIN_WHEN`, `PULSE_TARGETS` e `OBJECT_FROM`.

`src/content/validate.ts` accetta e controlla:
- `knows: 'oggetto'`: l'id deve essere un oggetto (`comune.oggetti.<id>`) o una lettera (`LetterDef.id`).
- I passi di tutorial nuovi:
  - `when: 'ora'` richiede `hour`;
  - `evento` deve stare in `LACE_EVENT_KINDS`;
  - `codice` deve essere un codice di `Violation`;
  - `chi` e `thread` devono essere fili del livello.
- `dawnObject`: oggetto o lettera esistente.
- `objects[*].from`: in `OBJECT_FROM`; `by` deve essere un `CharacterId`.
- `eveningEmptyKey` ed `esito.*`: chiavi esistenti in italiano.
- `dopo`: vignetta della stessa giornata.
- `apparizione.hour < startHour`, `passi` fra 1 e W.
- `chiusura`: solo `'nodo'`.

### C01. Regola di Gino (motore; la usano tombolo, contenuti, generatore)

- **Stato.** `ginoFermo` vale 1 dopo la riga *r* se e solo se valgono tutte e tre:
  - Gino è nel merletto a fine riga;
  - non ha incrociato nella riga *r* (anche un incrocio forzato del filo nero vale come incrocio);
  - all'inizio della riga *r* non aveva la febbre (con la regola `febbre` attiva).

  Negli altri casi vale 0. All'apertura vale 0. Chi entra da un bordo parte da 0.
- **Violazione `corre`** nella riga *r*. Si ha se e solo se valgono tutte:
  - Gino è nel merletto e non è bloccato;
  - all'inizio di *r* non ha la febbre;
  - ha un incrocio possibile (definizione di oggi: un vicino non bloccato, non in un incrocio forzato, non autonomo, con almeno un verso ammesso dalle stranezze);
  - `ginoFermo` della riga *r−1* è 1;
  - la riga non fa incrociare Gino.

  Un vicino impegnato dal giocatore in un altro incrocio conta come libero.
- **Parametri della violazione**: `{ chi: 'gino', vicino: <id del primo vicino libero, da sinistra> }`. `messageKey` resta `tombolo.violazione.corre`.
- **Compatto.** Uno slot `OFF_GF` nello stato. Entra nella chiave del solver solo se il livello ha `ginoCorre`. `LaceState.ginoFermo` si scrive solo quando vale 1 e `stateKey` lo comprende.
- `SOLVER_VERSION` cresce di 1: tutti i `.computed.json` vanno rigenerati (D19).
- Il giocatore automatico (`bot.ts`), `simulate`, `applyRow`, il generatore e i suggerimenti usano la stessa funzione.

### C02. Passi del tutorial (contenuti scrivono, tombolo esegue, schermi valida)

| Passo | Quando parte |
|---|---|
| `margine` `primaOra` | all'inizio della prima riga giocabile (com'è oggi) |
| `margine` `ora` | all'inizio della riga `hour` |
| `margine` `incrocio` | al primo incrocio del giocatore messo in bozza nella riga `hour` (in qualunque riga se `hour` manca), qualunque sia il verso |
| `margine` `versoSbagliato` | com'è oggi |
| `margine` `rifiuto` | a una riga o un incrocio rifiutati per una stranezza; con `codice` solo per quel codice (`rifiuto`, `corre`, `faro`, `bloccato`, `occupato`) |
| `margine` `spillo` | a una violazione di spillo |
| `margine` `evento` | alla prima comparsa dell'evento `evento` nell'anteprima della riga corrente o in una riga fissata; con `chi`, solo se il filo coinvolto è `chi` (per `passa`/`copia`: chi riceve; per `cura`: chi guarisce; per `contagio`: chi si ammala) |
| `margine` `nome` | subito dopo che il nome è stato appuntato (g12) |
| `margine` `archivioNomi` | quando tutti i fili sbiaditi sono confermati |
| `margine` `archivioRammendo` | quando tutti gli strappi sono rammendati |

- Il campo `mano` sceglie la grafia della nota: `'clotilde'` (seppia, predefinita) o `'ada'` (matita).
- `pulsa` evidenzia un elemento finché il giocatore non ci interagisce o finché l'ora `hour` non è fissata. Bersagli:
  - `fissa`, `taccuino`, `nome`, `disfa`: come oggi;
  - `lampada`;
  - `obiettivi`: il pulsante degli obiettivi;
  - `matassa`: il gomitolo dell'HUD;
  - `bordo`: l'icona dell'evento di bordo della riga `hour`;
  - `spillo`: lo spillo d'ottone di `thread` più vicino a `hour`;
  - `fuso`: il fuso di `thread`;
  - `marea`: le colonne allagate dalla riga `hour`.
- `mano` (fantasma): il tombolo disegna anche un fuso fantasma semitrasparente che segue la mano da colonna a colonna, con una freccia.
- Regole di visualizzazione: D04. Ogni `textKey` si mostra una volta per notte; due passi con la stessa chiave contano come uno.

### C03. Condizione `{ knows: 'oggetto', id }` e Taccuino alla lettura

- Vera se `id` sta in `knowledge.objects` o in `knowledge.letters`.
- La campagna chiama `refreshDiary` subito dopo `learnItems`, cioè quando il giocatore chiude un oggetto alla porta o all'alba. Le voci nuove si annunciano lì, non nel bilancio.
- I contenuti spostano su questa condizione ogni voce del Taccuino che parla di un oggetto o di una lettera.

### C04. Oggetti: provenienza, oggetto dell'alba, sere vuote, `{occasioni}` negli epiloghi

`campaign.json` (contenuti-atto1):

```jsonc
{
  "days": [
    { "id": "g14", "...": "...", "dawnObject": "lettera_clotilde" },          // niente objectAfter
    { "id": "g15", "...": "...", "eveningEmptyKey": "atto2.g15.sera.vuota", "objectAfter": "bottiglia_nodo_nero" },
    { "id": "g16", "...": "...", "dawnObject": "fascio_lettere" },            // niente objectAfter
    { "id": "g17", "...": "...", "eveningEmptyKey": "atto3.g17.sera.vuota", "objectAfter": "biglietto_livia_1" },
    { "id": "g23", "...": "...", "pins": 2, "objectAfter": "nastro_nonna" }
  ],
  "objects": {
    "merletto_avorio": { "from": "casa" }, "libro_punti": { "from": "casa" }, "nastro_nonna": { "from": "casa" },
    "lettera_clotilde": { "from": "mano", "by": "zeno" },
    "fascio_lettere": { "from": "mano", "by": "zeno" },
    "biglietto_livia_1": { "from": "porta" }, "...": "biglietto_livia_2…6 idem"
  }
}
```

- Un oggetto senza voce in `objects` ha provenienza `laguna`.
- `fascio_lettere` all'alba porta con sé `fascio_1..3` solo se `lettereLivia = liberate`, come oggi la sera.
- **L'oggetto dell'alba** si mostra dopo l'ultima vignetta dell'alba e prima del bilancio, con:
  - il titolo `campaign.alba.consegna` («Prima di andare via…»);
  - la figura di `by`;
  - la lettura a tutto schermo con lo stesso foglio della sera (C17).

  Poi `learnItems`, `refreshDiary` e solo dopo il bilancio. L'Archivio di quella giornata (`archiveAfter`) viene dopo il bilancio, come oggi.
- `eveningEmptyKey` è la frase della porta di quella sera quando non arriva niente. Vale solo se `objectAfter` della giornata precedente manca.
- **Frasi d'arrivo** (chiavi della campagna):

| Chiave | Testo |
|---|---|
| `campaign.sera.arrivo.laguna` | «Bussano alla porta. La laguna ha lasciato qualcosa.» |
| `campaign.sera.arrivo.mano` | «{nome} bussa alla porta. Ha qualcosa per te.» |
| `campaign.sera.arrivo.porta` | «Sotto la porta, un biglietto.» |
| `campaign.sera.arrivo.casa` | «Sul tombolo ti aspetta ancora qualcosa della nonna.» |
| `campaign.sera.arrivo.niente` | testo predefinito se manca `eveningEmptyKey` |

- **Epiloghi.** La campagna passa a ogni riga di epilogo il parametro `{occasioni}`: l'elenco delle occasioni piantate nella notte del finale, ordinate per ora, formattate con `campaign.occasione.<kind>` (`{presso}`, `{ora}`) e unite con virgole ed «e». Esempio: «il vaporetto delle 9, la festa in Farmacia a mezzogiorno, la festa in Piazza alle 17 e la lanterna alle 20». Se il finale non ha occasioni, il parametro è vuoto.

### C05. Esito dei bigliettini (`NoteDef.esito`)

- `esito.ok`, `esito.fallita`, `esito.lasciato` sono chiavi di testo dei contenuti, scritte come una riga di conseguenza («Il Gino è rimasto all'asciutto. Marta mi ha guardata come si guarda un forno che tira bene.»).
- La campagna usa, in quest'ordine:
  1. `esito.<stato>`;
  2. destino;
  3. desiderio, solo se nuovo;
  4. voce del Taccuino, che allora non si ripete in «Nel Taccuino»;
  5. frase generica.
- I test di contenuto chiedono `esito.ok` ed `esito.fallita` per ogni bigliettino con `request`. Fanno eccezione i biglietti della scelta di g23 (`ending`).

### C06. Vignette dell'alba: `dopo` e regole di selezione

- `priority ≥ 100` = culmine.
- `dopo: '<id>'` lega una vignetta a un'altra della stessa giornata: esce subito dopo, se anche la sua `when` è vera.
- Le regole di selezione sono quelle di D11 (normative, GDD 5.9).
- Dati da sistemare nei contenuti:
  - g18: `g18.alba.pane` con `dopo: 'g18.alba.pace'`;
  - g16: `g16.alba.fascio.2` dentro la consegna del fascio;
  - g14: `g14.alba.sera` diventa la vignetta di consegna dell'oggetto dell'alba (priorità 100, senza `when`).

### C07. Stato delle richieste durante la notte (tombolo → campagna)

`activeNight().session.requestStatusFull()` restituisce:

```ts
interface RequestStatus {
  noteId: NoteId;
  report: CondReport;       // valutato sulle righe FISSATE; 'a_rischio' anche quando la sola bozza la farebbe fallire
  anteprima: CondStatus;    // valutato con la riga corrente in bozza
  dropped: boolean;
}
```

- L'avviso «La richiesta di X è soddisfatta!», la vibrazione di successo e la spunta piena dipendono **solo** da `report.status === 'soddisfatta'`.
- Se `anteprima === 'soddisfatta'` e `report.status !== 'soddisfatta'`, il gettone mostra una spunta tratteggiata e il pannello della campagna mostra `campaign.taccuino.stato.inArrivo` («Si compie se fissi l'ora»).
- `goalStatus()` segue la stessa regola per gli obiettivi obbligatori, con `goalPreview(): CondStatus[]`.

### C08. Elenco degli obiettivi del tombolo per il pannello della campagna

```ts
// src/tombolo/index.ts
export function objectivesElement(opts?: { compact?: boolean }): HTMLElement | null;
```

- Restituisce `null` se non c'è una notte attiva.
- Contiene:
  - gli obiettivi obbligatori (testo completo e stato);
  - gli spilli d'ottone (chi, dove, quando, stato: rispettato, futuro, irraggiungibile);
  - le coppie in rancore;
  - nelle modalità extra, gli obiettivi generati;
  - nell'Archivio, i fili da nominare.
- Si aggiorna da solo su `night:row`, `night:undo` e `night:cross` e si smonta quando la notte finisce.
- `data-test`: `tb-obiettivi-lista` e, per le voci, `tb-obiettivo-<i>`, `tb-spillo-<thread>-<ora>`, `tb-rancore-<a>-<b>`, `tb-sbiadito-<thread>`.
- Il pannello `bigliettini` della campagna lo mostra sotto le richieste, al posto di «Obiettivi: n/m», anche quando la notte non è di campagna.

### C09. Pannello sinistro nell'Archivio

- In modalità `archivio` (e `occasioni` con `archive`), nel layout largo il tombolo **non** monta il pannello `bigliettini`: monta il proprio `tb-archivio-pannello` (D05.8).
- La campagna non cambia nulla.

### C10. Pausa: «Lascia per ora» e «Comandi» (schermi, campagna, tombolo)

- **Lascia per ora.** Il pannello Pausa riceve gli `opts` di oggi (`{from:'tombolo', origin, levelId}`). Se `origin === 'archivio'` mostra il pulsante `sc-pausa-lascia` (`ui.pausa.lascia` «Lascia per ora»). Al tocco:
  1. `services.ui.closeOverlay()`;
  2. `void services.scenes.go('archivio', { cmd: 'lascia', levelId })`.
- La scena `archivio` della campagna, con `{cmd:'lascia'}`:
  - svuota `SaveData.night` se è d'Archivio per quel livello;
  - non tocca `knowledge.archive`;
  - mostra la cassapanca con «Apri» e «Più tardi»;
  - in fase `archivio`, «Più tardi» porta alla sera seguente come oggi.
- Il tombolo non cambia: salva all'uscita come sempre.
- **Comandi.** Il pulsante `sc-pausa-comandi` (`ui.pausa.comandi`) apre l'elenco di tasti e gesti di GDD 11, generato dalla mappa dei tasti del core (`ui.comandi.*`).

### C11. Chiusura `nodo` (finale C)

- `fin_chiuso.json` ha `"chiusura": "nodo"`. Quando si fissa l'ultima riga di un livello con `chiusura: 'nodo'`, il tombolo:
  1. emette `tombolo:nodo` `{levelId}`;
  2. anima il nodo che si chiude su tutti i fili (800 ms) e il merletto che si disfa dal basso in alto (1,5 s), a 1×; con velocità istantanea o movimento ridotto, una dissolvenza;
  3. non mostra la riga «Merletto chiuso»;
  4. emette `night:complete` come sempre.
- L'audio (schermi), su `tombolo:nodo`, suona `nodo` e la campana dell'ora 3 con stonatura 1. Su `night:complete` di un livello con `chiusura: 'nodo'` non suona `successo`. `resolveStonatura` restituisce 1 per `fin_chiuso` anche dopo il finale vero.
- La campagna passa direttamente al cartello nero.

### C12. Apparizione del filo nero (g08, g15)

- `apparizione: { hour, side, passi }` con `hour < startHour`.
- Quando il giocatore chiude il merletto, prima di `night:complete`, il tombolo:
  1. scorre in cima;
  2. disegna sopra la prima riga, nel margine alto, un'etichetta d'ora (`hour`);
  3. fa entrare dal bordo `side` un filo nero che avanza di `passi` colonne incrociando da sopra i fili che trova lì all'apertura (2,5 s a 1×; dissolvenza con movimento ridotto);
  4. lo lascia sfumare;
  5. emette `tombolo:apparizione` `{levelId}` all'inizio (l'audio suona `nero`).
- Dati: g08 `{ "hour": 3, "side": "faro", "passi": 1 }` (incrocia Zeno al Faro); g15 `{ "hour": 3, "side": "faro", "passi": 2 }`.

### C13. Violazioni e rapporti delle condizioni (motore → tombolo)

| Violazione o condizione | Parametri | Chiavi del tombolo |
|---|---|---|
| `bloccato` | `{ chi, causa: 'nodo' \| 'marea' }` | `tombolo.violazione.bloccato.nodo` «Il filo di {chi} è annodato: in quest'ora non si muove.», `.marea` «Con l'acqua alta, il filo di {chi} non si muove.» |
| `occupato` | `{ a, b, nero?: <id del filo nero o autonomo coinvolto> }` | con `nero`: `tombolo.violazione.occupato.nero` «{nero} si muove da solo: non si può incrociare.» |
| `corre` | `{ chi, vicino }` (C01) | `tombolo.violazione.corre` «{chi} è stato fermo un'ora: adesso deve incrociare (può con {vicino}).» |
| Rapporti di `incontra`, `nonIncontra`, `sopra` | `dalle`, `alle` quando la condizione ha una finestra | i modelli con finestra (C16) |

### C14. Criteri di qualità dei livelli (`levels:check`)

**Configurazioni.** Si valutano:
- la base;
- ogni bigliettino da solo;
- ogni combinazione possibile non `voluta` di 2 bigliettini, e di 3 negli atti con 3 spilli.

La **designata** è quella di oggi: la combinazione possibile più cara.

**Criteri**, con le soglie nelle costanti del motore, documentate in GDD 3.13:

| Criterio | Regola | Si applica a |
|---|---|---|
| K1 densità | `min ≥ ⌈righe / 2⌉` | designata e ogni bigliettino non `facile` |
| K2 costo | `min(base + nota) − min(base) ≥ 2` nell'Atto I, `≥ 3` negli Atti II-III | ogni bigliettino; al massimo uno per sera può essere marcato `facile` (`--facile g06:g06.marta`, il segno resta nel computed come `voluta`), e solo se è in un conflitto voluto con un altro bigliettino della sera |
| K3 Gino | `min − minSenzaGino ≤ 0,4 × min` | designata e bigliettini, se Gino c'è con `ginoCorre` |
| K4 ritmo | `vuoteMax ≤ 2` e `vuoteTot ≤ ⌊0,4 × righe⌋` nella soluzione registrata | designata e bigliettini |
| K5 ambiguità | `soluzioniOttime ≤ 20` | designata |
| K6 dilemma | almeno una combinazione `voluta` per sera | g03-g22 |
| K7 intervallo | il minimo della designata cade nell'intervallo "Min" di GDD 5.2 ±1 | solo avviso |

**Esenti:**
- g00, perché è il tutorial;
- g01, solo per K2;
- gli Archivi;
- `fin_chiuso`, perché ha 3 righe e fa da colpo di scena;
- `fin_aperto` e `fin_seppia`, che hanno l'autotessitura: per loro valgono solo le regole delle occasioni di oggi.

`fin_merlettaia` deve avere `min(base) ≥ 8` più K3 e K4.

**Comando.**
- `npm run levels:check` calcola sempre `quality` e lo scrive. Le violazioni sono avvisi. Con `--qualita` sono errori (uscita 1).
- `--max-states <n>` alza il limite del solver per il controllo; il predefinito per `levels:check` diventa 1 500 000.
- La tabella `--report` ha le colonne `K1…K6`.

**Test.** `atto1.test.ts` e `atto23.test.ts` richiedono `quality.violazioni` vuoto per i loro livelli.

### C15. `balance.json`

```jsonc
"oro":  { "minIncroci": 3 },
"hint": { "lampSeconds": 60, "undoRepeat": 3 }   // invariato; dopo il primo uso la lampada resta accesa (regola, non parametro)
```

Il motore (`metrics`): `filoDOro = !fantasmaUsed && minIncroci !== null && minIncroci >= oro.minIncroci && incroci === minIncroci`. Se `oro` manca vale 3.

### C16. Testi generati: etichette e modelli (contenuti ↔ tombolo)

**Etichette** (`labelKey` delle perline nei livelli):
- sintagma nominale con articolo, tutto minuscolo salvo i nomi propri;
- leggibile dopo «riceve», «sente», «conosce»;
- le lettere nominano il destinatario («la lettera di Teresa per Don Piero»);
- le voci e i segreti dicono di che cosa parlano («la chiacchiera sul debito di Bepi», «il nome del dottore»).

Per le lettere generate (`labelKey: 'tombolo.generato.lettera'` con `to`) il tombolo compone `tombolo.generato.letteraPer` «la lettera per {to}». Se ce n'è più d'una per la stessa persona usa `…letteraPerN` «la {n, selectordinal…} lettera per {to}».

**Modelli del tombolo** per tipo di perlina (`<tipo>` in `lettera | voce | segreto | nome | febbre`; `letta:*` vale come `segreto`):

| Chiave | Testi |
|---|---|
| `tombolo.obiettivo.ha.<tipo>` | «{chi} riceve {perlina} entro le {ora}» / «{chi} sente {perlina}…» / «{chi} conosce {perlina}…» / «{chi} ricorda il nome di Ada…» / «{chi} ha la febbre…» |
| `tombolo.obiettivo.nonHa.<tipo>` | «{chi} non tocca mai {perlina}» / «non sente mai» / «non scopre mai» / «non sente mai il nome di Ada» / «{chi} non si ammala mai» |
| `tombolo.cond.fallita.ha.<tipo>`, `tombolo.cond.rischio.ha.<tipo>`, `tombolo.cond.fallita.nonHa.<tipo>` | stessa logica |
| `tombolo.obiettivo.incontraFinestra`, `nonIncontraFinestra`, `sopraEntro` | «{a} incontra {b} fra le {dalle} e le {alle}»… |
| `tombolo.cond.fallita.incontraFinestra` | «{a} e {b} non si sono incontrati entro le {alle}.» |
| `tombolo.obiettivo.almenoStesso` | «Almeno {n} fra {elenco} {azione}» |
| `tombolo.ora.fmt` | it «{h}», en «{h12} {ampm}» o «noon» |
| `tombolo.rancore.coppia` | «{a} e {b} sono in rancore: se si incrociano, si annodano.» (la usa anche schermi) |
| `tombolo.stranezza.ginoCorre` | «Non sta fermo due ore di fila. Con la febbre resta a letto.» (la usa anche schermi) |

La maiuscola a inizio frase la mette il tombolo (`capitalizeFirst`, consapevole della lingua).

### C17. Calligrafia e inchiostro su carta (schermi ↔ campagna)

- `src/core/ui/base.css`:
  - la rotazione si applica a `.core-carta--mano`, il foglio intero, e vale `clamp(-3deg, var(--mano-inclinazione), 3deg)`, con `transform-origin: center`;
  - `.core-carta-testo` non ha `transform` e ha `pointer-events: none`;
  - la classe `core-carta--scorre` dà al foglio `max-height` (70 % dell'altezza disponibile) e `overflow-y: auto` (con `pointer-events: auto` sul foglio, così lo scorrimento funziona).
- **Regola per la campagna:** nessun pulsante dentro `.core-carta`. I pulsanti stanno in un contenitore fratello, dopo il foglio, in un livello superiore.
- `src/core/ui/richtext.ts` esporta `inkOnPaper(hex: string, paper?: string): string`: scurisce il colore fino a contrasto ≥ 4,5:1 sulla carta (`#EDE4D3` se `paper` manca). `.core-pers` lo usa per il testo; la campagna lo usa per `.cp-pers` e per le intestazioni dei bigliettini.

### C18. `data-test` e chiavi i18n nuove fra gruppi

| Gruppo | `data-test` |
|---|---|
| Tombolo | `tb-obiettivi-lista`, `tb-obiettivo-<i>`, `tb-spillo-<thread>-<ora>`, `tb-rancore-<a>-<b>`, `tb-sbiadito-<thread>`, `tb-archivio-pannello`, `tb-archivio-chiudi-motivo`, `tb-bolla` (bolla del tocco), `tb-scorri-giu`, `tb-salta-quiete`, `tb-fantasma-conferma`, `tb-suggerimento-lascia-<noteId>`, `tb-nota-margine` (esistente se c'è, altrimenti nuovo) |
| Campagna | `cp-alba-oggetto`, `cp-sera-arrivo`, `cp-finale-continua`, `cp-sera-esci-conferma`, `cp-atto-cartello`, `cp-taccuino-libro-nuova` |
| Schermi | `sc-pausa-lascia`, `sc-pausa-comandi`, `sc-comandi`, `sc-libero-riprendi`, `sc-libero-dacapo`, `sc-giornaliero-chi`, `sc-libero-chi`, `sc-libero-condividi-seme` |

Restano invariati: `tb-lampada`, `tb-nomina`, `tb-nomina-<id>`, `tb-nomina-togli`, `tb-scheda`, `tb-suggerimento`, `tb-suggerimento-ancora`.

Chiavi lette da un gruppo diverso da chi le scrive:
- `tombolo.stranezza.*` e `tombolo.rancore.coppia`, lette da schermi;
- `campaign.sera.arrivo.*`, `campaign.alba.consegna`, `campaign.occasione.*`, scritte dalla campagna;
- `ui.pausa.lascia`, `ui.pausa.comandi`, `ui.comandi.*`, scritte da schermi.

Ogni chiave nuova esiste in `it` e in `en`.

### C19. Contenuti: chiavi di testo nuove richieste da altri gruppi

| Gruppo di contenuto | Chiavi |
|---|---|
| Contenuti-atto1 | `comune.oggetti.<id>` per ogni oggetto citato in `objects`; i testi dei passi di tutorial nuovi; `atto1.g00.margine.spillo`, `atto1.g00.margine.disfa`, `atto1.g01.margine.gino`, `atto1.g02.margine.matassa`, `atto1.g03.margine.molo`, `atto1.g04.margine.barca`, `atto1.g05.margine.faro`, `atto1.g06.margine.segreto`, `atto1.g07.margine.pozzo`, `atto1.arc1.margine.nomina`, `atto1.arc1.margine.rammenda`, `atto1.arc1.margine.eco` |
| Contenuti-atti23 | `atto2.g09.margine.febbre`, `atto2.g09.margine.cura`, `atto2.g09.margine.ginoLetto`, `atto2.g11.margine.nodo`, `atto2.g16.margine.trabocco`, `atto3.g17.margine.nero` (mano di Ada), `atto3.g19.margine.marea`, `atto2.g15.sera.vuota`, `atto3.g17.sera.vuota`, `atto2.arc3.hint.*`, `atto2.arc4.hint.*`, `atto3.arc5.hint.*` |

Le chiavi di nome esatto possono cambiare purché coincidano fra livello e testo: le controlla `validate.ts`.

---

## 3. Liste di lavoro per gruppo

Formato: **ID [priorità] Titolo** · segnalazioni.
- **Fare**: che cosa fare.
- **Accettazione**: come si verifica.

Priorità: P0 bug bloccanti o gravi e punti che impediscono di capire o di finire; P1 medi e design; P2 minori. Ogni gruppo tiene verdi `npm run build`, `npm test` e il proprio `levels:check -- --only …`, e aggiorna il proprio `docs/stato/<gruppo>.md`.

### 3.1 Motore (`src/engine/`, `tools/levels/`, `tests/unit/engine/`)

**MOT-01 [P1, ondata 1] Regola di Gino nuova** · P015, P091, P094.
- **Fare**:
  - C01 in `core.ts` (`ginoFailed`, `stepRow`), `model.ts` (slot `OFF_GF`), `state.ts` (`toCompact`, `fromCompact`, `stateKey`), `solver.ts` (campo della chiave), `rules.ts`, `bot.ts`, `generator.ts`;
  - parametri `{chi, vicino}`;
  - `SOLVER_VERSION + 1`;
  - rigenerare i `.computed.json` delle fixture e `data/daily-fallback.json`.
- **Accettazione**:
  - test a tabella: prima riga libera; seconda riga ferma rifiutata; riga dopo un incrocio libera; vicino impegnato in un altro incrocio rifiutato con `vicino`; febbre all'inizio della riga nessun obbligo e niente accumulo; rientro dal bordo azzera; nodo e marea contano come fermo; incrocio forzato del nero vale;
  - test di solver su una fixture di 6 righe con Gino e nessun altro vincolo: minimo 3;
  - `npm test` verde.

**MOT-02 [P1, ondata 1] Parametri di violazioni e rapporti** · P038, P045, P093, P094, P118.
- **Fare**:
  - C13: `bloccato.causa`, `occupato.nero`, `corre.vicino`;
  - rapporti di `incontra`, `nonIncontra` e `sopra` con `dalle`/`alle` quando c'è la finestra;
  - aggiornare `engineTextKeys()` con le chiavi nuove.
- **Accettazione**: test unitari su ciascun caso; `i18n.test.ts` del tombolo non trova chiavi mancanti (lo verifica il tombolo dopo TOM-14).

**MOT-03 [P1, ondata 1] Metriche di qualità in `levels:check`** · P022.
- **Fare**: C14 completo:
  - `minSenzaGino` (contesto senza `ginoCorre`), `costo`, `vuoteMax`, `vuoteTot`, `soluzioniOttime` (`countOptimal`);
  - `--facile`, `--qualita`, `--max-states` (predefinito 1 500 000 per il controllo);
  - colonne del rapporto;
  - scrittura di `quality` nel computed.
- **Accettazione**:
  - con il contenuto di oggi `levels:check --report` elenca le violazioni (g04, g06, g10 devono comparire);
  - g16 si verifica senza superare il limite;
  - test su fixture con valori attesi per ogni criterio.

**MOT-04 [P1] Filo d'oro solo con minimo ≥ 3** · P022.
- **Fare**: C15 in `metrics()`.
- **Accettazione**: test: minimo 0 o 2 dà niente filo d'oro anche a incroci = minimo; minimo 3 dà filo d'oro; fantasma toglie sempre.

**MOT-05 [P1] Generatore: gradi che contano** · P044.
- **Fare**: nel filtro di qualità, un grado vale solo se cambia il puzzle; altrimenti si prova il seme `#k` successivo. Per grado:

| Grado | Condizione per valere |
|---|---|
| `spilliVelati` | almeno uno spillo a un'ora ≥ start+3 |
| `nodoInPiu` | la soluzione ottima senza rancore fa incrociare la coppia, oppure con il rancore il minimo cresce |
| `neroInPiu` | la soluzione ottima senza nero non è valida col nero, oppure costa di più |
| `notteCorta` | il controllo di oggi |
| `matassaEsatta`, `senzaDisfa` | valgono sempre |

  Nel generatore si applica la regola di Gino nuova.
- **Accettazione**: test su 200 semi per ogni combinazione di gradi: ogni livello accettato rispetta la condizione dei suoi gradi; il seme `pm0ozmz` piccolo con «Spilli velati» e «Un nodo in più» produce un livello dove entrambi pesano.

### 3.2 Tombolo (`src/tombolo/`, `src/i18n/*/tombolo.json`, `tests/unit/tombolo/`)

**TOM-01 [P0] Archivio su touch: click fantasma** · P086.
- **Fare**: D05.5.
- **Accettazione**: test con touch simulato (pointer `touch` più click di compatibilità): un tocco sul fuso apre il selettore e nessun nome si assegna; il click entro 350 ms dall'apertura è ignorato; il caso di `tests/e2e/archivio.spec.ts` su iphone/android/ipad non fallisce più (verifica manuale con lo script del tombolo).

**TOM-02 [P0] Archivio: nomi alla Obra Dinn** · P003.
- **Fare**: D05.2-3: niente conteggio dei giusti; conferma automatica a gruppi di tre; spostamento dei doppi; messaggi `tombolo.archivio.nomiDati`, `.nonAncora`, `.spostato`.
- **Accettazione**: test di `ArchiveBook`:
  - dare un nome sbagliato non cambia nulla di visibile oltre a «Nomi dati»;
  - tre giusti confermano;
  - un doppio si sposta;
  - con 4 fili tutti nominati e 2 giusti compare «non ancora».

**TOM-03 [P0] Archivio: fili usciti nominabili, «Chiudi» che spiega, «Ricomincia» che conserva** · P019.
- **Fare**: D05.4 e D05.6; `tb-archivio-chiudi-motivo`.
- **Accettazione**: riproduzione di P019 (arc1 tessuto prima di nominare, filo 3 uscito alle 12):
  - il filo 3 si nomina toccandone il tratto e dall'elenco;
  - «Chiudi» senza nomi mostra «Manca il nome del filo sbiadito 3»;
  - «Ricomincia la notte» lascia confermati i nomi già confermati.

**TOM-04 [P1] Archivio: pannello, lampada, echi, tutorial** · P002, P070, P099.
- **Fare**:
  - D05.1 (il tombolo emette solo `night:exit`; il pulsante è di schermi);
  - D05.4 (la pressione lunga sul fuso sbiadito apre il selettore);
  - D05.7 (trigger `archivioNomi` e `archivioRammendo`);
  - D05.8 (C09);
  - lampada e suggerimenti nell'Archivio (il rammendo usa `computed.base.rows`);
  - echi con i nomi.
- **Accettazione**: arc3 in 1180×820: pannello sinistro con fili, candidati, strappi; dopo il rammendo gli echi mostrano «Teresa → Aldo, alle 9»; la lampada c'è; i test di layout del tombolo passano.

**TOM-05 [P0] HUD e testo grande** · P039.
- **Fare**: D16, primo punto.
- **Accettazione**: test di layout a 360×640, testo 140 %, alto contrasto, in it e en, con impostazioni cambiate dalla Pausa:
  - nessuna scritta dell'HUD sotto 15 × 1,4 px;
  - nessun troncamento con puntini;
  - i nomi delle colonne sono interi o solo icona;
  - le misure sono identiche prima e dopo una ricarica.

**TOM-06 [P0] Destinatari delle lettere e finestre orarie** · P037, P038.
- **Fare**: C16 per le lettere generate (numerazione compresa); bolla sulla busta con il destinatario; avvisi di rischio con il nome della lettera; obiettivi `incontra` con la finestra (C13, C16).
- **Accettazione**: Merletto del giorno del 14/10 e libero `gdjm8dc`: ogni lettera negli obiettivi ha il destinatario; due lettere per la stessa persona sono distinte; «Bepi incontra Lunardi fra le 7 e le 10»; il fallimento dice «entro le 10».

**TOM-07 [P1] Note a margine** · P004, P107.
- **Fare**: D04 completo.
- **Accettazione**: test di layout: su g01 alle 7, g02 alle 7, finale D e finale B, il rettangolo della nota non interseca la riga corrente, gli spilli, gli slot e gli incroci in bozza; un tocco sulla nota la chiude senza rovesciare l'incrocio sotto; una riga rifiutata produce un solo messaggio.

**TOM-08 [P1] Tutorial: trigger, bersagli, fuso fantasma** · P005, P088.
- **Fare**: C02 completo in `tutorial.ts`, `ui/actionbar.ts`, `ui/hud.ts`, `render/`. Il fuso fantasma segue la mano.
- **Accettazione**: test unitari di `Tutorial` per ogni `when` e ogni `target`; prologo: alle 6 la mano trascina un fuso visibile da colonna 1 a 0; alle 7, con il verso giusto, compare «Chi sta sopra, dà».

**TOM-09 [P1] «Soddisfatta» solo sulle righe fissate** · P025, P102.
- **Fare**: C07.
- **Accettazione**: riproduzione di P102 (g21: Zeno, Piero, Gino) e del finale D: nessun avviso di richiesta soddisfatta prima che la riga sia fissata; spunta tratteggiata in anteprima; `requestStatusFull()` ha `anteprima`.

**TOM-10 [P1] Suggerimenti che dicono la verità** · P020, P026, P101, P103.
- **Fare**: D07.1-5: lampada visibile dall'inizio; tocco che riapre; conferma del Fantasma; quiete gratuita; diagnosi delle richieste incompatibili con `solveAsync`, provando a togliere una richiesta alla volta e cercando l'ultima ora da cui una richiesta torna possibile. Chiavi `tombolo.hint.incompatibili`, `.tardi`, `.fantasmaConferma`.
- **Accettazione**:
  - g06 con Nina e Zeno: la Spinta dice che le due non stanno insieme e offre di lasciarne cadere una;
  - in una riga di quiete il Fantasma non toglie il filo d'oro;
  - tre tocchi sulla lampada non chiamano mai il Fantasma;
  - dopo il primo suggerimento la lampada resta accesa alle ore seguenti.

**TOM-11 [P1] Righe visibili e ora di fine** · P072, P087, P105.
- **Fare**: D06 (HUD e righe), `tb-scorri-giu`.
- **Accettazione**: in g13 (14 righe) a 1180×820 e 390×844, e nel finale D a 1280×800, tutte le righe sono visibili oppure compare l'indicatore con il numero di ore nascoste; l'HUD dice «fino alle 20»; gli spilli futuri nascosti sono negli obiettivi.

**TOM-12 [P1] Il tocco spiega** · P013, P014, P031, P042, P049, P100.
- **Fare**: bolle su spilli, bordi, perline, ore, nero; ora e icona affiancate; passaggio del mouse equivalente; `tb-bolla`.
- **Accettazione**: test d'interazione: tocco sullo spillo di Forno alle 9 nel prologo → «Teresa al Forno alle 9»; tocco sulla barca di g06 → testo con il marinaio e la lettera per Nina; il numero 10 resta visibile accanto alla barca.

**TOM-13 [P1] Obiettivi: popup e componente** · P042, P046, P054, P070.
- **Fare**: C08; popup con contatore sul pulsante, spilli, niente intestazione ripetuta, ombra di scorrimento.
- **Accettazione**: libero grande con 5 obiettivi a 360×640: il pulsante mostra «n/5», le 5 voci si leggono scorrendo e l'ombra lo segnala; `objectivesElement()` passa i test DOM.

**TOM-14 [P2] Testi generati** · P006, P012, P029, P048, P082, P093, P094, P112, P118.
- **Fare**: C16 e C13 lato testi; nel popup del gettone di una richiesta, sotto il testo del bigliettino, la riga con la condizione esatta («Lettera per Don Piero: consegnata entro le 10»).
- **Accettazione**: test di `describeCondition` e `reportText` su tutti i tipi di perlina, in it e en; i casi delle segnalazioni producono le frasi attese; `tombolo.i18n.test` verde.

**TOM-15 [P1] Occasioni** · P071, P072, P104.
- **Fare**: D06 (slot); il bersaglio del tocco usa la stessa funzione del disegno (centro riga).
- **Accettazione**: test: un clic al centro di ogni cerchio pianta esattamente quella occasione (tipo, luogo, ora); il chip non copre celle; «Riprova» azzera gli obiettivi.

**TOM-16 [P1] Il nome si sposta prima della prima ora** · P089.
- **Fare**: finché nessuna riga è fissata, un tocco su un altro fuso sposta il nome, con l'avviso «Il tuo nome ora è su X».
- **Accettazione**: test: in g12 Piero → Zeno → Piero funziona; dopo la prima ora fissata il tocco è ignorato con il messaggio «Il nome è già appuntato».

**TOM-17 [P1] Rancore visibile, stranezze nelle modalità extra, scheda coerente** · P017, P041, P045.
- **Fare**: D06 (rancore, modalità extra, regola di `quirkRevealed`). Il tombolo implementa una copia della funzione, con un test di equivalenza sui dati veri.
- **Accettazione**:
  - libero `pm0ozmz` con «Un nodo in più»: segno del nodo sui due fusi e riga negli obiettivi;
  - giorno del 18/10: la scheda di Gino elenca la sua stranezza;
  - prologo: la scheda di Teresa non svela che legge le lettere finché non lo fa il Taccuino.

**TOM-18 [P2] Desktop grande, filo nero, motivi** · P034, P046.
- **Fare**: D06 (desktop).
- **Accettazione**: 1920×1080: centro ≥ 900 px, spilli ≥ 20 px, numeri delle ore ≥ 15 px; filo nero con bordo chiaro; in g05 alle 9 Gino e Teresa vicini si distinguono anche in bianco e nero (controllo di layout sul motivo).

**TOM-19 [P2] Tastiera e lettore di schermo** · P026, P052.
- **Fare**: cursore delle frecce su tutte le colonne quando si nomina; riga di stato rigenerata a `settings:change` di lingua.
- **Accettazione**: test d'input; dopo il cambio di lingua la riga di stato è tutta nella lingua nuova.

**TOM-20 [P1] Chiusura «nodo» e apparizione del filo nero** · P063, P109.
- **Fare**: C11 e C12 nel tombolo.
- **Accettazione**: test della scena con il livello di prova: gli eventi `tombolo:nodo` e `tombolo:apparizione` partono una volta; `night:complete` arriva dopo l'animazione; con `animSpeed` 0 tutto è istantaneo.

**TOM-21 [P2] PNG con cartiglio** · P050.
- **Fare**: `renderLacePng(level, rows, flags, caption?)` con `caption: { titolo, sottotitolo, riga }` disegnato in un cartiglio in basso.
- **Accettazione**: test di esportazione con e senza cartiglio (dimensione e area del cartiglio).

**TOM-22 [P2] «Salta le ore quiete»** · P022, P115.
- **Fare**: D02.3, `tb-salta-quiete`, tasto Maiusc+Invio.
- **Accettazione**: test: compare solo se ≥ 2 righe si fissano vuote senza eventi; si ferma prima di uno spillo, bordo, marea, nero, scadenza o obbligo di Gino; Disfa torna indietro di una riga alla volta.

### 3.3 Campagna (`src/campaign/`, `src/i18n/*/campaign.json`, `tests/unit/campaign/`)

**CAM-01 [P0] Archivio davvero facoltativo, «Rileggi» in sola lettura** · P001, P032.
- **Fare**:
  - C10 lato scena `archivio`;
  - «Rileggi» apre il merletto rammendato in sola lettura (`mode: 'replay'` con le righe registrate e i nomi confermati) e consente gli echi;
  - il pulsante che lo rifà da capo si chiama «Rifai».
- **Accettazione**: test di flusso:
  - arc1 aperto in fase archivio, poi Lascia, poi «Più tardi» porta alla sera di g04;
  - la cassapanca mostra arc1 ancora da fare;
  - «Rileggi» su arc1 rammendato mostra nomi e colori.

**CAM-02 [P0] Bigliettini e lettere sul foglio giusto** · P007, P011, P021, P057, P058.
- **Fare**:
  - C17 lato campagna: pulsanti fuori da `.core-carta`;
  - `core-carta--scorre` per lettere e bigliettini lunghi;
  - lista dei bigliettini con margine in fondo pari ai pulsanti fissi più 16 px;
  - scheda Lettere del Taccuino dalla prima lettera ricevuta.
- **Accettazione**:
  - test DOM: `document.elementFromPoint` al centro di «Appunta», «Lascia» e «Rispondi» restituisce il pulsante, per Bepi (8°), Gino (−7°) e Zeno (−9°) a 390×844 e 1440×900;
  - la lettera di Clotilde e quella di g03 hanno ogni riga dentro il foglio, firma compresa;
  - «Risposto» si vede senza scorrere.

**CAM-03 [P0] Rivelazione di g14 e oggetti a mano** · P009, P056, P074.
- **Fare**: C03 (aggiornamento del Taccuino alla lettura) e C04 (`dawnObject`, `objects`, `eveningEmptyKey`, frasi d'arrivo), con `cp-alba-oggetto` e `cp-sera-arrivo`.
- **Accettazione**: test di flusso su g14:
  - alba, poi vignetta di Zeno, poi lettera, poi bilancio (che non contiene voci sbloccate prima della lettura), poi cassapanca con arc4;
  - g01 dice «Sul tombolo ti aspetta ancora qualcosa della nonna»;
  - g18 dice «Sotto la porta, un biglietto»;
  - la sera di g15 mostra la frase vuota.

**CAM-04 [P1] Alba che rispetta i culmini** · P067, P117.
- **Fare**: D11 in `dawn.ts` (`selectDawn` e candidate), C06 (`dopo`); avvisi del Taccuino dopo l'ultima vignetta.
- **Accettazione**: test puri di `selectDawn`:
  - g18 con pace mostra pace e poi pane, e nessuna battuta generica;
  - g11 con nodo, nessuna riserva;
  - una giornata senza vignette scritte usa la riserva;
  - una battuta di riserva non segue mai un culmine.

**CAM-05 [P1] Bilancio** · P018, P027, P028, P068, P078, P098.
- **Fare**: D12, C05; plurali ICU in `bilancio.record`; la sezione si chiama «Come doveva andare».
- **Accettazione**: test di `consequenceOf` con `esito`; nessuna riga del bilancio identica a una voce di «Nel Taccuino» della stessa pagina; «1 incrocio, 1 ora di quiete».

**CAM-06 [P1] Taccuino** · P016, P064, P088, P120.
- **Fare**:
  - D10 (piste prima delle risposte, nascoste a domanda risolta, nessuna pista dopo la scelta con la frase `campaign.taccuino.pistaFinita`);
  - pagina del Libro «Nuova» (`knowledge.bookSeen`): all'apertura del Taccuino in una notte con una pagina nuova si va su quella; avviso «Nuova pagina nel Libro: La febbre» toccabile all'inizio della notte;
  - schede in una riga scorrevole.
- **Accettazione**: test del pannello: in g09 il Libro si apre su «La febbre» con il segno «Nuova»; dopo la scelta di g23 «Dove guardare» non c'è; con 6 schede a 390 px una sola riga.

**CAM-07 [P1] Pannello dei bigliettini durante la notte** · P025, P046, P070.
- **Fare**: C07 (`inArrivo`) e C08 (elenco degli obiettivi nel pannello, anche nelle notti extra).
- **Accettazione**: prologo nel layout largo: il pannello mostra il testo dell'obiettivo con lo stato; Merletto del giorno a 1920×1080: elenco completo; g05 alle 12 con la bozza: pannello e gettone concordano.

**CAM-08 [P1] Finali** · P077, P108, P109, P111, P121.
- **Fare**:
  - merletto che resta con `cp-finale-continua` nei finali A, B e D;
  - C11 lato campagna (niente passaggio doppio, cartello nero subito);
  - biglietto di Clotilde piegato e non appuntabile dopo `done('fin_chiuso')`;
  - schermata Fine col riconoscimento del finale vero (D14);
  - `fineTesto` «La storia di quell'anno è finita».
- **Accettazione**: test di flusso dei quattro finali: dopo il finale D il merletto resta finché non si tocca Continua; dopo C la carta C ha `available: false` e lo stato piegato; la Fine del finale vero ha la riga in più.

**CAM-09 [P1] Sera** · P010, P024, P114, P116.
- **Fare**:
  - `sera.appunta` «Appunta · {n, plural, one {resta # spillo} other {restano # spilli}}»;
  - con gli spilli finiti, sotto il pulsante: «Togli lo spillo da un altro bigliettino per appuntare questo» (con collegamento);
  - spilli mostrati solo se ci sono bigliettini; la scelta di g23 usa sempre 1 spillo;
  - Esc e Indietro senza pannelli chiedono conferma (`cp-sera-esci-conferma`).
- **Accettazione**: test DOM e di flusso per ciascun punto.

**CAM-10 [P2] Cartelli d'atto e prologo raccolto** · P077, P083.
- **Fare**:
  - alla prima sera di ogni atto, un cartello `cp-atto-cartello` con titolo e stagione (`comune.atti.N.sottotitolo`, oggi mai usati);
  - prologo: niente Taccuino sul buio, titolo su fascia scura, biglietto sul tombolo.
- **Accettazione**: screenshot di riferimento rivisti a mano, a 1440×900 e 390×844.

**CAM-11 [P2] Vignetta di rivelazione e inchiostro dei nomi** · P035, P096.
- **Fare**: la rivelazione dell'Archivio usa lo stesso contenitore delle vignette dell'alba; `inkOnPaper` (C17) per `.cp-pers` e per le intestazioni dei bigliettini.
- **Accettazione**: contrasto del nome di Lunardi ≥ 4,5:1 (test con il calcolo WCAG); la vignetta di arc1 occupa tutta l'area come le albe.

**CAM-12 [P2] `{occasioni}` negli epiloghi** · P073, P106.
- **Fare**: C04, ultimo punto.
- **Accettazione**: test: con l'insieme della soluzione di `fin_aperto` il parametro vale «il vaporetto delle 9, la festa in Farmacia a mezzogiorno, la festa in Piazza alle 17 e la lanterna alle 20» (it) e l'equivalente in en.

### 3.4 Schermi (`src/screens/`, `src/core/`, `src/audio/`, `src/main.ts`, `index.html`, `public/manifest.webmanifest`, `package.json`, `src/i18n/*/{ui,core,audio}.json`, `tests/unit/{screens,core,audio}/`; più i file di D19)

**SCH-01 [P0, ondata 0] Tipi e validazione dei contratti**.
- **Fare**: C00 alla lettera in `types.ts`, `ids.ts`, `validate.ts`.
- **Accettazione**:
  - `npm run build` verde con i contenuti di oggi;
  - test di `validate` per ogni forma nuova (valida e non valida);
  - nessun altro file di altri gruppi toccato.

**SCH-02 [P0] Calligrafia: il foglio si inclina, il testo resta dentro** · P007, P021, P057, P058.
- **Fare**: C17 lato core (CSS e `inkOnPaper`).
- **Accettazione**: test del core sulle regole CSS calcolate (rotazione sul foglio, limite ±3°, testo senza transform e senza eventi); pagina di prova con le grafie di tutti i personaggi e un testo di 150 parole: nessun carattere fuori dal foglio.

**SCH-03 [P0] Pausa: «Lascia per ora» e «Comandi»** · P001, P026.
- **Fare**: C10 lato pannello; pagina `sc-comandi` con i gesti e i tasti di GDD 11, compresi H, N, Maiusc+Invio e il clic destro.
- **Accettazione**: test DOM: il pulsante c'è solo con origine `archivio` e chiama la scena giusta; la pagina dei comandi elenca tutte le azioni della mappa dei tasti.

**SCH-04 [P0] Merletto libero: «Tessi» non cancella** · P036.
- **Fare**: D16 (Merletto libero); `sc-libero-riprendi` in cima e come pulsante fisso; `sc-libero-dacapo` con conferma.
- **Accettazione**: test: con una notte libera a metà sullo stesso seme il pulsante fisso riprende; «Tessi da capo» chiede conferma; annullando, il salvataggio resta intatto.

**SCH-05 [P1] Impostazioni opache e segmenti a testo grande** · P043, P047.
- **Fare**: fondo opaco per i fogli sovrapposti, colore di foglio in alto contrasto, segmenti in colonna a testo ≥ 130 %, niente `word-break` a metà parola.
- **Accettazione**: layout a 360×640 140 % it: «Istantanea» intera; dietro le impostazioni non si legge la Pausa (pixel di sfondo opachi).

**SCH-06 [P1] Musica della notte nelle modalità extra** · P040.
- **Fare**: all'avvio delle notti `giornaliero`, `libero` e `spartito`: `setMusic('notte', { seed: level.musicSeed ?? level.id, notes: personaggi presenti })`; al ritorno ai risultati e al titolo, la musica del titolo.
- **Accettazione**: test audio: `stats().music` vale `notte` durante la notte del giorno e del libero.

**SCH-07 [P1] «Chi c'è stanotte»** · P041, P045.
- **Fare**:
  - nella scheda del giorno e del libero, una sezione `sc-giornaliero-chi` / `sc-libero-chi`;
  - per ogni personaggio presente, icona, nome e stranezze attive (`tombolo.stranezza.*`);
  - coppie in rancore (`tombolo.rancore.coppia`);
  - regola del giorno con la pagina del Libro.
- **Accettazione**: test DOM sui giorni 15/10 e 18/10 e sul libero `gdjm8dc`.

**SCH-08 [P1] Offline dopo il primo caricamento** · QA (rete.spec.ts).
- **Fare**:
  - `public/sw.js` (cache versione = `gameVersion`, precache di index, chunk, font, `assets/manifest.json` e dei file elencati, rete come ripiego), registrato in `main.ts` solo sul web e non in dev;
  - `manifest.webmanifest` invariato;
  - nessuna richiesta esterna.
- **Accettazione**: con il server fermo dopo il primo caricamento, prologo fino all'alba con diorami e font; `missingAssets()` vuoto; nessun errore di rete in console.

**SCH-09 [P1] Gli avvisi brevi non prendono i tocchi** · QA.
- **Fare**: `.core-toast` con `pointer-events: none` e senza `core-solid`.
- **Accettazione**: test del layer: un tocco su un avviso arriva all'elemento sotto.

**SCH-10 [P2] Titolo al primo avvio, didascalie** · P053, P055.
- **Fare**: D17 (modalità bloccate) e D16 (didascalie, ombra di scorrimento).
- **Accettazione**: al primo avvio si vedono le voci bloccate con il lucchetto e la condizione; a 360×640 140 % le didascalie non coprono pulsanti; in inglese «Credits» è raggiungibile e l'ombra lo segnala.

**SCH-11 [P2] Condivisione** · P050.
- **Fare**: data con `Intl.DateTimeFormat` della lingua; il PNG con il cartiglio (TOM-21); nel libero «Condividi il seme» (testo con seme, gradi e spartito).
- **Accettazione**: in en-US la data è «10/18»; il PNG ha il cartiglio; il libero condivide.

**SCH-12 [P2] Testi per stato e modalità** · P051.
- **Fare**: D17 (testi).
- **Accettazione**: test DOM su: scheda del giorno già tessuto; ricomincio nel libero senza richieste; titolo con il mouse.

**SCH-13 [P2] Audio del finale C** · P110.
- **Fare**: C11 lato audio (`resolveStonatura`, niente `successo`, suono del nodo, campana dell'ora 3).
- **Accettazione**: test automazione: `fin_chiuso` dopo il finale vero, il registro ha la campana con `s=1` e nessun `successo`.

**SCH-14 [P2] Inchiostro e avvisi della build** · P096, QA.
- **Fare**: `inkOnPaper` (C17), se non già fatto in SCH-02; in `vite.config.ts`, divisione dei chunk o limite a 700 KB, con la nota sul budget CSS in gzip in `README.md`.
- **Accettazione**: build senza avvisi.

**SCH-15 [P2] Il titolo ricorda il finale vero** · P121.
- **Fare**: con `unlocks.tovaglia` (nome storico del flag) il titolo mostra il filo corallo sul tombolo e la stella accanto a «Telaio».
- **Accettazione**: screenshot del titolo con il flag acceso e spento.

### 3.5 Contenuti, Atto I (dati comuni, g00-g08, arc1-arc2, testi `comune` e `atto1` in it e en)

**CA1-01 [P0] La lanterna di Gino in g05** · P059.
- **Fare**: D13 (prima riga), in it e en.
- **Accettazione**: nessun testo prima del finale dice che Gino ha visto la lanterna accesa da dentro (controllo nel test di `atto1`).

**CA1-02 [P0, ondata 1] Dati comuni dei contratti** · P009, P033, P056, P074, P084, P114.
- **Fare**:
  - `campaign.json` come C04 (`dawnObject` di g14 e g16, `objects`, `eveningEmptyKey` di g15 e g17, g23 con 2 spilli);
  - `balance.json` con `oro` (C15);
  - `characters.json`: Marta `hand.font = 'atkinson'`, maiuscolo, `sizeScale` 1,05; Aldo con motivo e icona che nessun altro usa in arc3 (`catenella` o `tratteggio`, glifo esistente; richiesta QA);
  - `comune.oggetti.*` per tutti gli oggetti.
- **Accettazione**: `validate` verde (dopo SCH-01); test di `atto1`: provenienza di ogni oggetto, Aldo distinto per motivo e icona da ogni altro filo di arc3.

**CA1-03 [P1] Prologo e tutorial dell'Atto I e degli Archivi 1-2** · P002, P005, P013, P014.
- **Fare**: passi di tutorial come D03 (tabella) e C02:
  - g00: spillo, «Chi sta sopra, dà» con `incrocio` alle 7, Disfa con testo;
  - g01: Gino con la regola nuova;
  - g02: matassa; g03: Molo; g04: barca; g05: Faro; g06: segreto; g07: pozzo;
  - arc1 e arc2: archivio.

  Chiavi di C19 in it e en. `hintKeys` di arc1 e arc2 rivisti per i nomi.
- **Accettazione**: `validate` verde; test di `atto1`: ogni regola della colonna «Novità» di GDD 5.2 ha almeno un passo `margine` nella sua prima notte.

**CA1-04 [P1, ondata 2] Ridisegno delle notti g01-g08** · P015, P022.
- **Fare**: dopo MOT-01 e MOT-03, ridisegnare le notti che non rispettano C14 (oggi sicuramente g02, g03, g04, g06, g08). Si possono cambiare posizioni iniziali, perline, spilli d'ottone, ore e condizioni dei bigliettini, ma non le intenzioni dei bigliettini dell'Appendice A né i conflitti voluti (g01 Piero+Gino, g02 Marta+Gino, g03 Nina+Marta, g04 Bepi+Piero, g05 Zeno+Marta, g06 Nina+Zeno, g07 Teresa+Nina, g08 Marta+Nina). Linee guida:
  - far portare a Gino qualcosa di utile, perché la sua corsa serva al puzzle;
  - mettere almeno uno spillo che costringa a passare dove si rischia (Teresa che legge, il pozzo);
  - nelle notti con barca e vaporetto, chi deve partire deve arrivare al Molo all'ora giusta.

  Rigenerare con `--only`. Aggiornare la tabella "Min" di GDD 5.2 se il risultato cambia, in accordo con la direzione: lo segnala il proprio rapporto di stato.
- **Accettazione**: `npm run levels:check -- --only g00,…,g08,arc1,arc2 --qualita` esce con 0; i test di `atto1` controllano `quality.violazioni` vuoto.

**CA1-05 [P1] Taccuino dell'Atto I** · P008, P023, P030, P064.
- **Fare**: D10:
  - voci su bottiglie, fuso, merletto d'avorio, Libro e lettere con `{knows:'oggetto'}`;
  - persone sbloccate quando compaiono (Nina con g03);
  - variante della risposta a Marta in g06 quando arc1 è rammendato (niente rimando all'Archivio).
- **Accettazione**: test di `atto1` con la campagna simulata: nessuna voce cita un oggetto non ancora letto; il rimando all'Archivio non compare con arc1 rammendato.

**CA1-06 [P1] Esiti dei bigliettini dell'Atto I** · P018, P028.
- **Fare**: `esito.ok` ed `esito.fallita` (e `lasciato` dove serve) per ogni bigliettino g01-g08, specifici e non ripetuti in una voce del Taccuino della stessa giornata. Unificare le frasi ripetute di arc1 (una voce invece di tre).
- **Accettazione**: test C05 verde per g01-g08.

**CA1-07 [P1] Testi e continuità dell'Atto I** · P006, P062, P063, P065, P069, P075, P076, P081.
- **Fare**: D13 per le righe che toccano `atto1.json` e `comune.json`:
  - «entro le dieci», «entro le nove»;
  - età di Teresa;
  - «1965. La notte in cui morì la nonna»;
  - segreto di Teresa (g06 e g07);
  - deissi g03 e g06;
  - g04 «resta solo la sua rete»;
  - eco di arc2;
  - arc2 «l'ultima volta»;
  - g08 testi del filo nero coerenti con l'apparizione;
  - `apparizione` nel livello g08 (C12).

  Inglese allineato.
- **Accettazione**: `validate` e test di `atto1` ed `en` verdi; ogni testo citato nelle segnalazioni ha la versione nuova.

**CA1-08 [P2] Voci, etichette, battute** · P012, P029, P067, P079, P082.
- **Fare**:
  - etichette delle perline di g00-g08, arc1 e arc2 secondo C16 (minuscolo, articolo, destinatario delle lettere);
  - voci di Gino (errori da g01) e Bepi (doppie, minuscolo) nei testi dell'Atto I;
  - battute di `lines.json` con condizioni vere (la battuta «sette!» solo con almeno 7 incontri, o riscritta);
  - inglese allineato.
- **Accettazione**: test di `atto1`: nessuna etichetta di perlina comincia con la maiuscola salvo nomi propri; ogni lettera ha il destinatario nell'etichetta.

### 3.6 Contenuti, Atti II-III (g09-g23, finali, arc3-arc6, testi `atto2`, `atto3`, `finali` in it e en)

**CA23-01 [P0] Rivelazione di g14, fascio di g16, piste** · P056, P064, P090.
- **Fare**:
  - g14: vignetta di consegna di Zeno a priorità 100 senza `when` (C06), voci `chiL.risposta`, `persone.ada.g14`, `madre.apre`, `diario.lettere.clotilde` con `{knows:'oggetto', id:'lettera_clotilde'}`;
  - g16: consegna del fascio come oggetto dell'alba, voci sul fascio con `{knows:'oggetto', id:'fascio_1'}`;
  - g15: voci della bottiglia col nodo nero alla lettura;
  - piste prima delle risposte (`domande.anno1958.pista` con `{done:'g10'}`, pista del 1951 prima di arc4, oppure tolte);
  - `atto2.g15.sera.vuota`, `atto3.g17.sera.vuota`.
- **Accettazione**: test di `atto23` con la campagna simulata: dalla fine di g14 al bilancio nessuna voce che nomini Livia madre prima della lettura; nessuna pista sbloccata dopo che la sua domanda è risolta.

**CA23-02 [P1] Tutorial degli Atti II-III e degli Archivi 3-5** · P070, P088.
- **Fare**: D03, passi per g09 (febbre, cura, Gino a letto), g11, g16, g17 (mano di Ada), g19, arc3-arc5; `hintKeys` per arc3-arc5; chiavi C19.
- **Accettazione**: test di `atto23`: ogni regola nuova ha la sua nota nella prima notte; `validate` verde.

**CA23-03 [P1, ondata 2] Ridisegno delle notti g09-g23** · P022, P091, P115.
- **Fare**: come CA1-04, con le intenzioni dell'Appendice B e i conflitti voluti di oggi.
  - g13 «La notte più lunga» resta la notte del dilemma della cura: Gino a letto con la febbre finché non è curato.
  - g21 non deve avere più di 2 ore vuote di fila: la marea congela, il nero si muove, ma il giocatore deve avere qualcosa da fare o le ore si accorciano.
  - g16 entro il limite di stati (`--max-states` se serve).
- **Accettazione**: `npm run levels:check -- --only g09,…,g23,fin_merlettaia,fin_seppia,fin_chiuso,fin_aperto,arc3,arc4,arc5,arc6 --qualita` esce con 0; test di `atto23`.

**CA23-04 [P1] Finali** · P073, P085, P106, P109, P115.
- **Fare**: D14:
  - `fin_merlettaia` ridisegnato (saluti che danno, almeno 4 su 6, un conflitto, base ≥ 8);
  - `fin_chiuso` con `"chiusura": "nodo"`;
  - epilogo D con `{occasioni}` in una sola vignetta, 3 o più vignette di chiusura dei desideri, il nastro;
  - epilogo A con il nastro;
  - nessuna frase spezzata su due vignette.
- **Accettazione**: `levels:check` verde con `--qualita` per `fin_merlettaia`; test di `atto23`: ogni riga di epilogo è una frase completa (non finisce con la virgola); l'epilogo D non nomina occasioni fisse.

**CA23-05 [P1] Continuità degli Atti II-III** · P060, P061, P062, P066, P068, P069, P080, P092, P095, P113.
- **Fare**: D13 per le righe in `atto2`, `atto3` e `finali`, con varianti `availableIf` dove indicato (g22.teresa, g19.teresa e la sua alba).
- **Accettazione**: test di `atto23`: le varianti si escludono a vicenda e coprono tutti i casi dei flag; ogni testo citato ha la versione nuova.

**CA23-06 [P1] Esiti e alba degli Atti II-III** · P067, P068, P117.
- **Fare**: C05 per g09-g23; C06 (`dopo` in g18, g16, g14); battute delle albe g11, g14, g16, g18, g20 riviste perché i culmini non abbiano riempitivi (con la nuova selezione resta solo da verificare i dati).
- **Accettazione**: test C05 verde; con la selezione nuova (CAM-04) le albe di g11, g14, g16, g18 e g20 nei casi delle segnalazioni non contengono battute generiche.

**CA23-07 [P2] Testi minori** · P063, P065, P077, P079, P081, P097, P112, P114, P119.
- **Fare**:
  - deissi (g09 «arriva un dottore», g13 «un giorno intero», g22);
  - g15 «più vicino dell'altra volta» e `apparizione` in g15;
  - «Pellestrina»; arc6 «Don Piero»;
  - titoli (arc3 senza anno, g17 «La donna in nero»);
  - voci di Bepi, Don Piero, Lunardi («A lei, signorina, intendo.»);
  - etichetta del nome del dottore (C16);
  - «Per un autunno e un inverno» nell'epilogo aperto;
  - bigliettini di g23 (due richieste semplici).

  Inglese allineato.
- **Accettazione**: `validate` e test di `atto23` verdi.

### 3.7 Nativa (`android/`, `ios/`, `scripts/`, `docs/STORE.md`)

**NAT-01 [P1] Privacy manifest e plugin sincronizzati** · brief, punto 8.
- **Fare**: D18:
  - `NSPrivacyAccessedAPICategoryFileTimestamp` / `C617.1` in `PrivacyInfo.xcprivacy`;
  - `npx cap sync` (Android e iOS), così `@capacitor/filesystem` compare in `capacitor.settings.gradle` e nel `Package.swift`;
  - `check-native.mjs` controlla le due cose; `native:test` aggiornato.
- **Accettazione**: `npm run native:check` e `npm run native:test` verdi; `npm run android:apk` produce l'APK (o l'errore di rete documentato come oggi).

**NAT-02 [P2] STORE.md** · brief, punto 8.
- **Fare**:
  - grafica in evidenza indicata con i due file pronti e l'anteprima, in cima alla sezione delle schede;
  - privacy aggiornata (UserDefaults e marcatura temporale dei file, motivi CA92.1 e C617.1);
  - percorsi delle schermate per gli store (`tests/e2e/__screenshots__/store/`).
- **Accettazione**: nessun «da preparare» rimasto per elementi che esistono.

---

## 4. Ordine dei lavori

| Ondata | Chi | Cosa | Sblocca |
|---|---|---|---|
| 0 | schermi | SCH-01 (tipi e validazione) | tutti |
| 1 | motore | MOT-01, MOT-02, MOT-03, MOT-04 | ridisegno dei livelli, testi del tombolo |
| 1 | contenuti-atto1 | CA1-02 (dati comuni dei contratti) | CAM-03, CAM-08 |
| 1-2 | tutti gli altri | ogni compito non segnato «ondata 2», in parallelo | – |
| 2 | contenuti | CA1-04, CA23-03 (ridisegno), dopo MOT-01 e MOT-03 | playtest 2 |
| fine | ogni gruppo | rapporto in `docs/stato/<gruppo>.md`: compiti chiusi, misure di C14, problemi aperti | QA |

I gruppi di contenuto possono scrivere testi, tutorial, esiti e continuità subito. Solo i numeri dei livelli aspettano il motore. Il tombolo può sviluppare TOM-14 contro i parametri di C13 prima che MOT-02 arrivi: se mancano, il tombolo ripiega sulla chiave generica di oggi.

---

## 5. Segnalazioni scartate o rimandate

Nessuna segnalazione è scartata del tutto. Qui ci sono le proposte di soluzione non seguite, con il motivo, e le parti rimandate.

| Segnalazione | Proposta non seguita o rimandata | Motivo |
|---|---|---|
| P003 | «Pulsante "Conferma questi 3"» | Si sceglie la conferma automatica a gruppi di tre di Obra Dinn, senza contatore dei giusti: toglie l'informazione gratuita senza aggiungere un passaggio |
| P094 | «Allineare `ginoFailed` al GDD: un vicino impegnato non è libero» | Con quella lettura basterebbe occupare i vicini di Gino per fermarlo, e la regola perderebbe senso. Si tiene «Gino ha la precedenza», ma lo dice il messaggio (C13), e la regola nuova (D01) rende l'obbligo raro |
| P091 | «Togliere Gino da alcune notti» | Gino è il personaggio più vivo; si cambia la regola (D01) e lo si integra nel puzzle (K3) |
| P062 | «Togliere il filo d'avorio da arc6» | arc6 nei dati ha davvero il filo di Clotilde e l'eco «Oggi guardo» funziona solo così. Si corregge arc2: prima e ultima volta (D13) |
| P063 | «Riscrivere il filo nero come visto dalla finestra» | Il GDD vuole che lo si veda sul merletto, ed è il gancio di fine Atto I: si implementa l'apparizione (C12) |
| P092 | «Aggiungere le condizioni d'ordine e d'orario» | Complicherebbe due notti già lunghe; si riscrive il testo |
| P114 (prima parte) | «"Domani è la vigilia" è incoerente» | Non lo è: la sera di g23 precede la giornata della vigilia (le sere aprono la giornata, GDD 4.2), e lo stesso vale per «domani c'è la secca» di `biglietto_livia_5`. Si correggono invece gli spilli senza bigliettini |
| P121 | «Rendere visibile la Tovaglia» | La Tovaglia è L3 e non esiste: si toglie dal GDD come premio del finale vero e si danno riconoscimenti che esistono (D14) |
| P050 | Condivisione del libero «come promette la schermata», con un server | Nessun server (GDD 0): si condivide il seme come testo |
| P046 | «Scalare colonne e perline con lo spazio» oltre i 960 px | Oltre 960 px il merletto perde la leggibilità d'insieme; sopra quella misura cresce il velluto, non il merletto |
| P022 | «Avanzamento automatico» delle ore vuote | Si sceglie un pulsante esplicito («Salta le ore quiete»): il giocatore deve vedere ogni ora che fissa |
| P044 | Togliere i punti ai gradi inutili | Si preferisce che il generatore non produca mai gradi inutili: il punteggio resta onesto e più semplice |
| QA (README e2e) | Sezione del README sui test end-to-end | Rimandata al giro di QA (D19): `tests/e2e` non ha un gruppo in questa revisione |

---

## 6. Copertura delle 121 segnalazioni

| Segnalazione | Compiti |
|---|---|
| P001 | CAM-01, SCH-03 |
| P002 | TOM-04, CA1-03 |
| P003 | TOM-02 |
| P004 | TOM-07 |
| P005 | TOM-08, CA1-03 |
| P006 | CA1-07, TOM-14 |
| P007 | SCH-02, CAM-02 |
| P008 | CA1-05 |
| P009 | CAM-03, CA1-02 |
| P010 | CAM-09 |
| P011 | CAM-02 |
| P012 | TOM-14, CA1-08 |
| P013 | TOM-12, CA1-03 |
| P014 | CA1-03, TOM-12 |
| P015 | MOT-01, CA1-04 |
| P016 | CAM-06 |
| P017 | TOM-17 |
| P018 | CA1-06, CAM-05 |
| P019 | TOM-03 |
| P020 | TOM-10 |
| P021 | CAM-02, SCH-02 |
| P022 | MOT-03, MOT-04, CA1-04, CA23-03, TOM-22 |
| P023 | CA1-05 |
| P024 | CAM-09 |
| P025 | TOM-09, CAM-07 |
| P026 | TOM-10, TOM-19, SCH-03 |
| P027 | CAM-05 |
| P028 | CAM-05, CA1-06 |
| P029 | CA1-08, TOM-14 |
| P030 | CA1-05 |
| P031 | TOM-12 |
| P032 | CAM-01 |
| P033 | CA1-02 |
| P034 | TOM-18 |
| P035 | CAM-11 |
| P036 | SCH-04 |
| P037 | TOM-06 |
| P038 | TOM-06, MOT-02 |
| P039 | TOM-05 |
| P040 | SCH-06 |
| P041 | TOM-17, SCH-07 |
| P042 | TOM-12, TOM-13 |
| P043 | SCH-05 |
| P044 | MOT-05 |
| P045 | SCH-07, TOM-17, MOT-02 |
| P046 | TOM-18, TOM-13, CAM-07 |
| P047 | SCH-05 |
| P048 | TOM-14 |
| P049 | TOM-12 |
| P050 | SCH-11, TOM-21 |
| P051 | SCH-12 |
| P052 | TOM-19 |
| P053 | SCH-10 |
| P054 | TOM-13 |
| P055 | SCH-10 |
| P056 | CAM-03, CA1-02, CA23-01 |
| P057 | SCH-02, CAM-02 |
| P058 | SCH-02, CAM-02 |
| P059 | CA1-01 |
| P060 | CA23-05 |
| P061 | CA23-05 |
| P062 | CA1-07, CA23-05 |
| P063 | TOM-20, CA1-07, CA23-07 |
| P064 | CAM-06, CA1-05, CA23-01 |
| P065 | CA1-07, CA23-07 |
| P066 | CA23-05 |
| P067 | CAM-04, CA23-06, CA1-08 |
| P068 | CA23-06, CA23-05, CAM-05 |
| P069 | CA1-07, CA23-05 |
| P070 | CAM-07, TOM-04, TOM-13, CA23-02 |
| P071 | TOM-15 |
| P072 | TOM-11, TOM-15 |
| P073 | CA23-04, CAM-12 |
| P074 | CAM-03, CA1-02 |
| P075 | CA1-07 |
| P076 | CA1-07 |
| P077 | CAM-10, CAM-08, CA23-07 |
| P078 | CAM-05 |
| P079 | CA1-08, CA23-07 |
| P080 | CA23-05 |
| P081 | CA1-07, CA23-07 |
| P082 | TOM-14, CA1-08 |
| P083 | CAM-10 |
| P084 | CA1-02 |
| P085 | CA23-04 |
| P086 | TOM-01 |
| P087 | TOM-11 |
| P088 | CA23-02, TOM-08, CAM-06 |
| P089 | TOM-16 |
| P090 | CA23-01 |
| P091 | MOT-01, CA23-03 |
| P092 | CA23-05 |
| P093 | MOT-02, TOM-14 |
| P094 | MOT-01, MOT-02, TOM-14 |
| P095 | CA23-05 |
| P096 | CAM-11, SCH-14 |
| P097 | CA23-07 |
| P098 | CAM-05 |
| P099 | TOM-04 |
| P100 | TOM-12 |
| P101 | TOM-10 |
| P102 | TOM-09 |
| P103 | TOM-10 |
| P104 | TOM-15 |
| P105 | TOM-11 |
| P106 | CA23-04, CAM-12 |
| P107 | TOM-07 |
| P108 | CAM-08 |
| P109 | TOM-20, CAM-08, CA23-04 |
| P110 | SCH-13 |
| P111 | CAM-08 |
| P112 | TOM-14, CA23-07 |
| P113 | CA23-05 |
| P114 | CAM-09, CA1-02, CA23-07 (prima parte: sezione 5) |
| P115 | CA23-03, CA23-04, TOM-22 |
| P116 | CAM-09 |
| P117 | CAM-04, CA23-06 |
| P118 | MOT-02, TOM-14 |
| P119 | CA23-07 |
| P120 | CAM-06 |
| P121 | CAM-08, SCH-15 |

Dal rapporto QA e dalle richieste aperte, fuori dalle 121:

| Origine | Compito |
|---|---|
| Offline | SCH-08 |
| Avvisi che prendono i tocchi | SCH-09 |
| Avviso della build | SCH-14 |
| Aldo e Teresa indistinguibili in arc3 | CA1-02 |
| Avvisi del Taccuino sopra la prima vignetta dell'alba | CAM-04 |
| Lettera lunga «Alla porta» | CAM-02 e SCH-02 |
| Nativo | NAT-01, NAT-02 |

---

## 7. Come si giudica la revisione

Prima del playtest 2 ogni gruppo consegna:
- compiti chiusi con l'accettazione verificata;
- `npm run build`, `npm test` e `npm run levels:check -- --qualita` verdi;
- un rapporto con le misure di C14 per ogni notte.

Il playtest 2 rigioca gli stessi percorsi dei sei giocatori, più un giocatore nuovo che parte da zero. La revisione è riuscita se:
- divertimento e chiarezza sono ≥ 8 per ogni giocatore;
- non resta nessuna segnalazione grave;
- nessun giocatore resta bloccato più di 2 minuti senza che il gioco gli dica dove guardare (GDD 17, ultima voce).
