# Il percorso facile: prologo e missione 1 senza blocchi

Data: 2026-10-16. Rami: `funzioni/percorso`, poi `funzioni/percorso-2` (il secondo giro, dopo le
prove del «giocatore maldestro»). Responsabile: accessibilità del percorso (regia).

La partita automatica (`npm run e2e:fase1`) si teletrasporta e mira esatto: non vedeva i punti
dove un giocatore vero (che cammina, mira a occhio, non ha letto il design) restava fermo. Qui,
passo per passo dal vetro della capsula alla lettera di Rosa, che cosa poteva bloccarlo e che
cosa è cambiato. Prima di questo lavoro erano già stati corretti: la lettera letta tenendola
aperta 3 s, «Camminare» che basta sedersi all'aperto, la camera del titolo spenta dopo
«Continua», la lente con punti di 90 cm e l'indicazione «Q — …».

Le reti di sicurezza nuove sono in `src/regia/percorso.ts` (una sola chiamata per passo dalla
regia, `percorso.update`); le tolleranze in `src/regia/bersagli.ts`, `src/regia/corpo.ts`,
`src/regia/regia.ts`, `src/regia/dialoghi.ts`, `src/regia/png.ts` e nei raggi di
`content/luoghi.json`. Nei contenuti: quattro condizioni di `content/dialoghi.json` e la riga
della novizia alla Bacheca in `content/personaggi.json`; nessuna riga di `content/missioni.json`.
Nel secondo giro anche i sentieri del popolamento (`src/popolamento/sentieri.ts`, i tracciati in
`luoghi/sentieriCorbella.ts` e `mobili.ts`): la Terrazza Pedrazzini a piedi non si raggiungeva.

**Con le indicazioni delle missioni** (ramo `funzioni/obiettivi-2`, già nel ramo principale: il
pannello con l'obiettivo, la riga dell'attesa «… arriva alle 07:00: siediti e aspetta», il
segnalino sulla meta, il menu «Aspetta fino a» con l'ora di chi arriva) le due cose si dividono
il lavoro così: il pannello dice *che cosa fare e dove*, e *chi arriva e quando*; il percorso
dice *che cosa premere adesso* (nel posto del tasto E, quando non c'è un bersaglio), tiene in
piedi la storia quando un dialogo si perde e allarga i bersagli e i luoghi. La nota «in piazza
non c'è nessuno» del primo giro di questo lavoro è stata tolta: la dice il pannello, con l'ora
giusta (la velata al lavatoio alle 07:00, non il paese alle 08:00). Gli orari della novizia sono
stati scritti nei contenuti come la regia li applica, così il pannello sa che la sera e il
giorno dopo lei c'è ancora.

## Secondo giro: il giocatore maldestro

Un secondo giro di prove ha giocato il commit `20ed2e1` come un giocatore vero: cammina con W
seguendo il segnalino, mira con 5-12° di errore, si ferma a 2-4 m, arriva alle ore sbagliate,
chiude le carte con Esc, salva e ricarica a metà dei passi. Che cosa ha trovato e che cosa è
cambiato:

| Gravità | Passo | Problema | Correzione |
|---|---|---|---|
| **blocca** | M1.3, M1.18 La Terrazza Pedrazzini | Non si raggiungeva a piedi. La mulattiera taglia di sbieco le alzate dei gradoni: al tornante il nastro largo 1,9 m stava su un traverso di 49° (con la salita, 50-59°, oltre i 47° del controller) e si scivolava a valle, fuori dal varco, contro un muro di 2,85 m. La scorciatoia non era registrata fra i sentieri: i muri delle terrazze la tagliavano (2,35-2,85 m, gradini di 0,84 m). In più nessuna delle due arrivava sulla terrazza: la mulattiera finiva contro il fianco del ripiano (3,5 m), la scorciatoia 7 m sotto il suo muro di fronte. Un altro tornante stava a metà di un'alzata, con i due tratti sovrapposti a quote diverse. | **Camminamento sui traversi** (`suoloDiTraverso` in `sentieri.ts`): dove il suolo sotto il nastro pende di traverso più di 32°, il profilo parte dal bordo a monte e i gradini coprono tutta la larghezza, in piano di traverso; i livelli non saltano mai più di un'alzata; dove a valle si cadrebbe più di un metro c'è un parapetto (non sui nastri di altri sentieri o di altri tratti). La **scorciatoia è registrata** fra i sentieri per prima: i muri delle terrazze le aprono il varco (senza i gradini, variante Carta, la terza alzata resta troppo ripida: chiusa come prima). Le **ultime alzate**: mulattiera e scorciatoia salgono accanto alla terrazza ed entrano dall'angolo dove il suolo è già alla quota del ripiano (77 m); il tornante di metà alzata è sceso sulla terrazza di sotto. Prova in Node (`tests/popolamento/sentieri-a-piedi.test.ts`): con W, a occhio con 0, 8 e 12° di errore, dalla mulattiera e dalla scorciatoia (anche dritti dal castagno morto) fino al castagno del cartellino, e in discesa. |
| frustra | M1.3, M1.18 | Contro la scarpata l'indicazione nominava la scorciatoia anche senza gradini e non diceva dove partono le strade. | «P — Troppo alto: alla Terrazza Pedrazzini si sale dalla mulattiera, che parte dalla Piazza delle Ore, o dalla scorciatoia con i gradini di assi, 75 m a Mont del castagno morto»; prima delle 07:00 (variante Carta) «… dalla mulattiera …: la scorciatoia non ha ancora i gradini, il campanaro li rimette alle 07:00». |
| frustra | M1.21 La prova | Arrivata alla passerella, Ottavio scende dal cielo lontano e il segnalino passa su di lui («passerella raggiunta durante il passo»); chi lo seguiva usciva dai 7 m del luogo e il dialogo non partiva più (la coda e la riserva leggevano «Elvira è lì adesso»). | La coda dei dialoghi (`dialoghi.ts`) e la riserva (`percorso.ts`) leggono la condizione anche nell'ambito del passo che il dialogo fa avanzare, come il segnalino: raggiunta la passerella, Ottavio viene da Elvira dove si trova. Provato a 12 m dalla passerella: Ottavio atterra, la raggiunge e la prova parte in 10 s. |
| frustra | M1.13 Il ritorno | Dal guado il segnalino punta dritto alla piazza, contro i muri dei Ronchi; l'indicazione diceva solo «cerca un sentiero». | «P — Troppo alto: in piazza si torna dalla strada dei Ronchi: dal guado sali fra le case dei Ronchi e seguila verso il paese»; per il fienile e la prova «alla passerella del Messo si scende dalla strada dei Ronchi, che parte dalla piazza». La strada, a occhio, dal guado alla piazza: provata in Node e nel browser (il passo si chiude). |
| frustra | M1.11, M1.20 La notte | Chi aveva scelto di vegliare trovava «mezzanotte» fra le voci di X anche fra le 00:00 e le 05:30: scelta alle 00:00 del giorno 3 durava 24 ore e si perdeva la mattina della prova. Fra le 20:00 e le 21:00 c'era solo «mezzanotte», mentre il pannello diceva «aspetta il mattino». | `vociDiAttesa` (`orologio.ts`): «mezzanotte» la sera o, per chi veglia, di giorno; mai fra le 00:00 e le 05:30. «L'alba (05:30)» dalle 20:00. Un'attesa di più di 20 ore si rifiuta con una nota. |
| minore | P0.3 Lo sguardo in su | Gli aiuti finivano a 80 s: chi tirava giù il mouse mentre lo sguardo saliva li consumava. | Ancora ogni 30 s (ogni 20 s per la scritta del vetro); dal secondo aiuto, finita la planata dello sguardo, il passo si chiude da sé. Provato tirando giù il mouse ogni secondo: chiuso a 82 s. |
| minore | P0.5 La lettera dopo «Continua» | In piedi E non faceva niente, e il pannello diceva «o premi E». | La lettera è un bersaglio anche in piedi finché il passo della lettera è da fare. |
| minore | P0.2 La Cripta dopo «Continua» | Tornava «Alzati: E» con Elvira già in piedi. | Il suggerimento «Alzati» si ripete solo a Elvira sdraiata; che cosa fare lo dice il pannello. |
| minore | Tutti i dialoghi | Esc non faceva niente: da un dialogo lungo non si usciva. | Esc (con lo storico chiuso) apre la pausa sopra il dialogo, che resta aperto sotto; «Esci al titolo» lo interrompe e lo salva come un caricamento. |
| minore | Pausa e salvataggio | La conferma diceva «salvato all'ultima alba o all'ultimo letto», ma si salva adesso; chi chiudeva il browser perdeva tutto dall'ultimo passo. | «Tornare al titolo? Il viaggio si salva qui, adesso: «Continua» riparte da questo punto.» Camminando (senza modali, senza attesa) si salva anche ogni 90 s di gioco. |
| minore | M1.15 La cella | Entrando, «E — Pianta lo squadro sul chiodo 1» copriva la targa. | Il chiodo 1 si pianta dopo aver letto la targa (o fuori dal passo del campanile). |
| minore | M1.4 L'innesto | Il cartellino, a 80 cm dall'innesto, rubava E: tenendolo si apriva la carta invece di tagliare. | Letto il cartellino, durante l'innesto tace. |

## Reti di sicurezza per tutto il percorso

| Problema | Correzione |
|---|---|
| Solo il dialogo delle campane aveva una riserva (`campaneDiRiserva`): un altro dialogo automatico interrotto (Esc), perso in un caricamento o annunciato quando la persona non c'era fermava la storia. | **Dialoghi di riserva** generalizzati: per ogni passo attivo del prologo e della missione 1, i dialoghi automatici che lo fanno avanzare (nominati da `completa_quando`, o che accendono alla fine un flag che la condizione legge, come la lettera di Rosa, o la scelta della notte nel fienile) si richiedono ogni 1,5 s se non sono aperti, in coda o finiti e la loro condizione vale. |
| Un dialogo automatico in coda si apriva anche quando la sua condizione non valeva più e chi parlava era lontano (la novizia che parla dalla Casa del Velo, il mattino dopo, a Elvira in giro per il paese). | La coda dei dialoghi (`dialoghi.ts`) apre un dialogo automatico solo se la condizione vale ancora; se è legato a un luogo («luogo:bacheca_ore raggiunto») solo con chi parla entro 25 m (Ottavio a parte: viene lui). Gli altri automatici (il letto della Casa del Velo alle 20:30) si aprono dove capita, come prima. Le richieste «forzate» della riserva saltano la condizione. |
| Un dialogo automatico legato a un luogo non partiva se Elvira, dopo esserci arrivata, ne usciva (la prova alla passerella, seguendo il segnalino su Ottavio). | La coda e la riserva leggono la condizione anche nell'ambito del passo che il dialogo fa avanzare (il luogo resta «raggiunto durante il passo», come per il segnalino); la distanza di chi parla resta controllata (la novizia parla da vicino). |
| Nessuna indicazione di che cosa premere nei gesti senza un bersaglio. | **Indicazioni dei gesti** nel posto del tasto E: la scala della Cripta (W), il Velo in aria (Spazio), lo squadro piantato (A/D, poi il tasto destro, con la barra della collimazione e la palina da cercare), Ottavio in volo (G), da seduta l'attesa (X, con «E: rileggi la lettera»). |
| Un passo fermo a lungo non ripeteva più che cosa fare. | **Promemoria**: dopo 90 s (40 s per sedersi nel prologo) il suggerimento dei comandi del passo torna una volta. |
| Contro un muro che si scavalca con un salto (il parapetto di 90 cm fuori dalla botola, più alto di un gradino di 50 cm) Elvira si fermava senza capire perché. Contro un muro di terrazza o una scarpata (sotto la Terrazza Pedrazzini il terreno sale di oltre due metri in due metri) restava ferma e il segnalino continuava a indicare in su. | Ferma contro un muretto fra 0,5 e 1,2 m: «Spazio — Salta: scavalca il muretto». Ferma per più di un secondo contro un muro più alto (fino a 15 m: non le case né il campanile) o un pendio più ripido di quanto si cammini (47°): «P — Troppo alto / Troppo ripido: cerca un sentiero o dei gradini (la Pianta)», e nei passi della Terrazza «… alla Terrazza Pedrazzini si sale dalla mulattiera delle Terrazze o dalla scorciatoia con i gradini di assi». «Ferma» vuol dire quasi immobile sul piano e quasi a terra: contro un muro sul pendio il controller salta fra «a terra» e «in aria», e la prima versione non se ne accorgeva. |
| Dalla terrazza del campanile ci si butta col Velo: a terra Elvira restava «dentro la cella» e fuori non funzionava più niente (bersagli all'aperto, squadro), neanche dopo un caricamento. | Lontana dalla terrazza (8 m) o 4 m sotto il pavimento, Elvira è fuori (`esciDallaCellaSeCaduta`). |
| Allo squadro piantato il fiato non tornava: con il fiato corto «la bolla non sta ferma» per sempre. | Piantati, il fiato torna come da fermi. |
| Finita un'attesa («aspetta fino a la brace»), la storia se ne accorgeva al decimo di secondo dopo: chi si alzava subito (o la prova automatica) non vedeva chiudersi il passo. | Quando l'attesa arriva, la storia si aggiorna nello stesso passo. |
| Il salvataggio automatico scattava solo ai passi, all'alba e al sonno. | Camminando, senza modali né attese, anche ogni 90 s di gioco. |
| Esc nei dialoghi non faceva niente. | Apre la pausa sopra il dialogo. |

## Prologo «Due secoli»

| Passo | Problema | Correzione |
|---|---|---|
| P0.1 Il vetro (`pr_vetro`) | La scritta era un cono di 17° a 58° dallo sguardo iniziale, sdraiati; chi non la trovava restava nella capsula. | Cono di 26° (raggio 0,2 m a 40 cm). Dopo 12 s (e 30 s) lo sguardo ci scivola sopra da solo. |
| P0.2 La Cripta (`pr_cripta`) | Si poteva salire la scala e spingere la botola prima di prendere la busta e aprire l'armadietto: fuori, con il passo della Cripta da fare e la botola che si scendeva solo dopo lo sguardo in su, la partita era bloccata. | La botola non si apre finché mancano la busta o l'armadietto (una nota dice quale); «Scendi nella Cripta» funziona anche con il passo della Cripta da fare (vecchi salvataggi). Sulla scala: «W — Sali la scala». |
| P0.3 La botola, lo sguardo in su (`pr_guarda_su`) | Il passero a 20 s e «Guarda in su» a 35 s, poi più niente: chi gioca con il touchpad, con l'asse Y invertito o non capiva «in su» restava lì. | Dopo 50 s (e poi ogni 30 s) lo sguardo sale da solo verso il lago appeso (più di 50° sull'orizzonte, come chiede il passo); dal secondo aiuto il passo si chiude alla fine della planata dello sguardo. |
| P0.4 Camminare (`pr_camminare`) | Chi non si sentiva il fiato corto non sapeva di doversi sedere. | Promemoria «Siediti a respirare: tieni premuto C» dopo 40 s. |
| P0.5 La lettera | (già corretto: 3 s aperta) | Promemoria «Siediti sul muretto…» dopo 45 s; da seduta, dopo averla letta, «X — Aspetta fino a… (E: rileggi la lettera)». Finché il passo è da fare si apre con E anche in piedi (dopo «Continua»). |
| P0.6 Le campane | (già: `campaneDiRiserva`) | Diventata la riserva generale dei dialoghi. |

## Missione 1 «Il castagno vuoto», giorno 1

| Passo | Problema | Correzione |
|---|---|---|
| M1.1 La lente | (già corretto) L'indicazione «Q — …» compariva solo entro 9 m. | Entro 12 m. |
| M1.2 La marza | Il ramo vivo, sopra la testa, era un bersaglio di 50 cm entro 2,8 m dagli occhi. | 80 cm, entro 3,6 m. |
| M1.3 Il cartellino | Il cartellino è legato a 3 m da terra: andava guardato da meno di 2 m (ferma a 4 m Elvira non poteva leggerlo) e il luogo del castagno aveva un raggio di 4 m. La terrazza sta sopra muri e scarpate: in linea retta dal castagno morto non si sale. **E nessuna delle due strade ci arrivava a piedi** (secondo giro). | Il cartellino si legge fino a 4,6 m dagli occhi (60 cm); il castagno del cartellino ha raggio 8 m (sulla terrazza Elvira sta 1,3 m sotto la quota del luogo: dentro la tolleranza). La mulattiera e la scorciatoia si percorrono a piedi fino all'angolo della terrazza (vedi il secondo giro). Contro la scarpata: «P — Troppo alto/ripido: … la mulattiera, che parte dalla Piazza delle Ore, o la scorciatoia con i gradini di assi, 75 m a Mont del castagno morto» (la scorciatoia solo dalle 07:00, quando il campanaro ha rimesso i gradini). |
| M1.4 L'innesto | Anche l'innesto è sopra la testa (50 cm entro 2,8 m). Il cartellino accanto rubava E. | 70 cm entro 3,8 m; a metà gesto si riprende (già così). Letto il cartellino, durante l'innesto tace. |
| M1.5 Il Velo | **La planata contava solo con il Velo aperto 2 s**: con la fisica del Velo un salto dal muretto della Terrazza (3,5 m) lo tiene aperto mezzo secondo, da 8 m poco più di uno; servivano una quindicina di metri. La prova automatica partiva in volo a 10 m/s da 13 m. | Conta anche il Velo aperto almeno 0,3 s in un salto che finisce almeno 2,5 m più in basso (i 2 s restano per le planate lunghe). In aria «Spazio — tienilo premuto: apri il Velo»; un atterraggio senza planata dice perché («il Velo non ha preso aria: salta da un muro più alto»). |
| M1.6 I velati | Prima delle 08:00 c'è solo Togna (dalle 07:00, al lavatoio). | Lo dice il pannello delle indicazioni (chi arriva e a che ora, e il menu «Aspetta fino a» propone l'ora). Le persone si scelgono da 4 m (prima 3,4). Al fermo delle 17:30 restano il campanaro, la Pina, i bambini e Nando: sempre almeno tre. |
| M1.7 Il Messo | Se il terzo velato era Nando (ai Ronchi), Ottavio atterrava a metà strada verso la piazza e il dialogo partiva solo entrando in piazza: nessuno lo diceva. | Ottavio atterra a una dozzina di metri da Elvira; dopo 25 s il dialogo parte anche fuori dalla piazza (riserva «ovunque»: viene lui). |
| M1.8 La brace | Nessun blocco (il tempo passa comunque). | Promemoria «aspetta» dopo 90 s; da seduta «X — Aspetta fino a…». |
| M1.9 L'Ombrista | Nessun blocco (finisce alle 20:30). | — |
| M1.10 Il fienile | Il luogo del fienile aveva raggio 6 m attorno al centro (dentro i muri): davanti alla porta, a due metri, non si era «arrivati». **Chi girava tutta la notte arrivava al fienile di giorno**: la scelta di Ottavio, il sonno e il mattino del giorno 2 non tornavano più. | Raggio 12 m. **Fermo della prima notte**: finché Elvira non arriva al fienile l'orologio non passa le 05:00 del giorno 2 (aggiunto alla tabella dei fermi in FASE1 §2.2). |
| M1.11 La notte | Se il dialogo «Dormi o guardi?» arrivava dopo le 05:30 (dopo il passo), la scelta «Dormo» non faceva più niente. Chi vegliava poteva scegliere «mezzanotte» dopo la mezzanotte (24 ore). | Il dialogo non si apre più a passo finito (`!passo:m1_notte completato`); riserva del dialogo mentre il passo è attivo. «Mezzanotte» mai fra le 00:00 e le 05:30; attese di più di 20 ore rifiutate. |

## Missione 1, giorni 2 e 3

| Passo | Problema | Correzione |
|---|---|---|
| M1.12 Il mattino | Il dialogo del mattino chiedeva `giorno:2` esatto: un salvataggio vecchio arrivato al giorno 3 non poteva più finire il passo. | `giorno:>=2` (anche per la variante della passerella salvata). |
| M1.13 Il ritorno | In linea retta dal guado ci si ferma contro i muri dei Ronchi, a 158 m dalla piazza. | «P — Troppo alto: in piazza si torna dalla strada dei Ronchi …». |
| M1.14 Il dono | La Bacheca aveva raggio 2 m (bisognava starci sopra); la novizia se ne andava alle 19:00 alla Casa del Velo, e solo il giorno 2: chi la cercava alle 20 non la trovava (e il dialogo partiva da lontano), la mattina dopo non c'era più alla Bacheca. Il pacco portato da Ottavio poteva essere seguito da quello della novizia. Il popolamento non valuta le condizioni degli orari: dato il dono, i giorni dopo l'avrebbe rimessa alla Bacheca. | Bacheca con raggio 8 m. La novizia **aspetta alla Bacheca dalle 07:00 alle 21:00, ogni giorno dal secondo, finché non ha dato il dono** (`postoDiClelia` in `png.ts`, e la stessa riga in `personaggi.json`: il pannello, cercandola alle 22, dice «arriva domani alle 07:00»); il dialogo si apre solo con lei vicina; dopo il pacco di Ottavio non si apre più. Dato il dono se ne va; dalle 20:00 del giorno 2 e i giorni dopo è alla Casa del Velo (dove la sera può offrire il letto). |
| M1.15 Il campanile | Fuori dalle 08:00-18:00 il campanaro non c'è e la porta diceva solo «Le chiavi le ha il campanaro». Nella cella «Pianta lo squadro» copriva la targa. | Il pannello dice dove e quando (il sagrato, alle 08:00). La porta chiusa dice dov'è adesso: «è qui vicino, parlagli (E)» (entro 35 m), «adesso rimette i gradini della scorciatoia», «arriva sul sagrato alle 08:00: siediti (C) e aspetta (X)», «torna in piazza alle 19:45, per l'Ombrista», «domattina alle 08:00». La targa si legge da 3 m (prima 2,2). Il chiodo 1 si pianta dopo la targa. |
| M1.16 Il libretto | Nessun blocco (la pagina del segnalibro conta dopo 2 s aperta). | — |
| M1.17 Il chiodo 2 | Il chiodo era un bersaglio di 35 cm entro 2,4 m (ai piedi). Dopo averlo piantato, «E — Stacca lo squadro» copriva che cosa fare. La bolla aveva una finestra di un terzo di secondo per lasciare A/D. | Chiodi da 60 cm entro 3 m. Piantati: «A / D — centra la bolla», poi «Tasto destro — guarda nel cannocchiale e cerca la palina bianca e rossa sul campanile», poi la croce con la barra (anche quando il tasso la copre: il tentativo conta). Bolla 0,18 (prima 0,12). |
| M1.18 Il primo rilievo | La croce doveva stare entro 0,9° per 1,5 s. Sotto la terrazza, come per il cartellino. | 1,3° (2° con «collimazione agganciata»). Le strade a piedi e, contro la scarpata, quale prendere e dove parte. |
| M1.19 La strada del Messo | Prima delle 14:00 Ottavio è in volo con le lettere e scende solo al fischio (G): nessuno lo diceva («arrivo al fienile alle 12»). | «G — Chiama Ottavio con un fischio: è in volo con le lettere», finché il dialogo della passerella non è fatto. |
| M1.20 La seconda notte | Nessun blocco. | Promemoria «aspetta». |
| M1.21 La prova | La passerella aveva raggio 4 m: dalla riva il dialogo non partiva. Dalle 09:00 del giorno 3 Ottavio non è più sulle assi (gli orari finiscono lì). Chi seguiva il segnalino su Ottavio che scendeva usciva dal luogo e il dialogo non partiva più. | Raggio 7 m; riserva del dialogo; se non c'è, Ottavio scende dal cielo accanto a Elvira (provato alle 10:00 del giorno 3). La condizione si legge nell'ambito del passo: raggiunta la passerella, Ottavio viene da Elvira dove si trova. |
| M1.22 La lettera di Rosa | Il passo legge un flag acceso alla fine del dialogo: senza riserva. | Riserva (il dialogo accende il flag che il passo legge). |

## Stati da cui non si esce

| Caso | Com'è adesso |
|---|---|
| Dialogo interrotto (pausa → «Esci al titolo», o il browser chiuso) | Quelli «parlando» si riprendono parlando di nuovo (il contatore dei velati sale solo alla fine); quelli automatici li richiede la riserva. Esc in un dialogo apre la pausa (prima non faceva niente). |
| «Aspetta fino a» scelto male di notte | «Mezzanotte» non c'è fra le 00:00 e le 05:30; un'attesa di più di 20 ore si rifiuta. |
| Fuori dal luogo di un dialogo automatico dopo esserci arrivati | Il dialogo parte lo stesso (ambito del passo); Ottavio viene da Elvira. |
| Salvataggio a dialogo aperto | Al caricamento il dialogo si interrompe e si riapre da capo (già così); la riserva lo copre comunque. |
| Salvataggio da seduta o allo squadro piantato | Si salva la quota in piedi; lo squadro torna «in mano». |
| Gesto a metà (marza, innesto) | La marza si ritaglia; l'innesto si riprende dal tempo a cui era (`stadioInnesto` si salva). |
| Velo aperto all'atterraggio | Si chiude da solo a terra (controller). |
| Notte nel fienile | «Dormi nel fieno» dalle 20:30 alle 05:00 (non prima della scelta di Ottavio); da seduta «l'alba (05:30)». |
| «Continua» in ogni passo | Il suggerimento del passo torna (`suggerisciPassoCorrente`), il pannello riprende l'obiettivo, le reti del percorso ripartono da zero (i promemoria e gli aiuti dello sguardo tornano). |

## Prove

- `tests/regia/percorso.test.ts`: i dialoghi che fanno avanzare ogni passo, le indicazioni dei
  gesti, il muretto, il muro alto e la scarpata, il fermo della prima notte, le planate corte, i
  luoghi più larghi, la porta del campanile a ogni ora, il posto della novizia e il suo arrivo per
  il pannello (`prossimoArrivo` alle 22: domani alle 07:00); `tests/regia/interazioni-corpo.test.ts`
  (planata da un muro), `tests/regia/catasto-abitanti.test.ts` (la novizia alla Bacheca la sera e
  il giorno dopo, poi alla Casa del Velo), `tests/regia/dialoghi-coda.test.ts` (la coda:
  condizione, distanza solo per i dialoghi di un luogo, richieste forzate).
- Prove mirate nel browser (copie tagliate di `scripts/e2e-fase1.mjs`, non nel repository), con i
  tasti veri e senza mirare esatto: lo sguardo nella capsula senza mouse (14,5 s); fuori dalla
  botola senza alzare lo sguardo (sale da solo a 50 s); la botola prima della busta (resta
  chiusa, «W — Sali la scala»); fuori, contro il parapetto verso il paese («Spazio — scavalca», e
  con il salto si passa); sotto la Terrazza Pedrazzini contro la scarpata («P — Troppo ripido: …
  la mulattiera … la scorciatoia»); il cartellino da 4 m (si legge, il passo si chiude); la
  planata dal muretto di 3,5 m (conta, «Spazio» in aria); giù dal campanile col Velo (fuori dalla
  cella); i velati alle 06:30 (il pannello: nessuno con cui parlare, una velata al lavatoio arriva
  alle 07:00) e alle 07:12 (il segnalino è su di lei); il terzo velato
  ai Ronchi (il Messo arriva in 30 s); la notte girando (orologio fermo alle 05:00 del giorno 2,
  al fienile «Dormi o guardi?»); la novizia alle 20:00 (c'è e dà il pacco) e alle 22:00 (nessuno;
  il mattino dopo, lontano, non parla; alla Bacheca sì); la porta del campanile alle 06:30 («arriva
  sul sagrato alle 08:00»); il prato alle 12:00 («G», il fischio, si parla con Ottavio); lo squadro
  sul chiodo 2 da 2,2 m («A / D»); la prova della passerella alle 10:00 del giorno 3 (Ottavio
  scende e la prova parte); «Continua» da un salvataggio della notte nel fienile (Ottavio
  richiede «Dormi o guardi?»).
- Secondo giro. `tests/popolamento/sentieri-a-piedi.test.ts`: il controller vero sul paese vero,
  con W e lo sguardo verso il prossimo pezzo del sentiero (0, 8 e 12° di errore, niente salti):
  la mulattiera e la scorciatoia fino al castagno del cartellino e in discesa, la scorciatoia
  chiusa senza gradini, la strada dei Ronchi dal guado alla piazza e ritorno.
  `tests/regia/dialoghi-coda.test.ts` (la prova con Elvira uscita dalla passerella),
  `tests/regia/percorso.test.ts` (le strade, «Aspetta fino a» di notte, gli aiuti ripetuti),
  `tests/ui/componenti.test.ts` (Esc nel dialogo apre la pausa).
- Secondo giro, nel browser con i tasti veri (copie degli script del giocatore maldestro, non nel
  repository): dal castagno morto, dritti col segnalino ci si ferma contro i muri e lo schermo
  dice le due strade; per la cripta, la piazza e la mulattiera, a occhio, fino al cartellino
  (445 m, nessuna fermata, il cartellino letto da 3,5 m con 8° di errore); dopo le 07:40 dal
  castagno morto per la scorciatoia (208 m); durante l'innesto il cartellino tace; la prova
  alla passerella con Elvira a 12 m (Ottavio la raggiunge, il dialogo parte in 10 s); dal guado
  «… la strada dei Ronchi …» e per la strada fino in piazza (il passo si chiude); «Aspetta fino
  a» alle 00:00 con la veglia (solo l'alba; «mezzanotte» rifiutata); «Continua» nella Cripta in
  piedi (niente «Alzati»); lo sguardo in su tirando giù il mouse ogni secondo (chiuso a 82 s);
  la lettera in piedi dopo «Continua» (E la apre, letta chiude il passo); 100 s a passeggio
  (salvato); Esc nel dialogo delle campane (la pausa sopra, Esc di nuovo torna al dialogo); nella
  cella prima della targa il chiodo 1 non è un bersaglio, dopo sì.
- `npm run typecheck`, `npm test`, `npm run verifica-contenuti`, `npm run build`,
  `npm run e2e:fase1`: verdi.

## Che cosa resta

- **Per le indicazioni delle missioni** (contenuti loro, non toccati qui): il segnalino punta
  ancora dritto sulla meta, e in linea retta non si arriva né alla Terrazza Pedrazzini né dal
  guado alla piazza. Chi spinge contro i muri legge la strada, ma servirebbero tappe:
  in `m1_cartellino` e `m1_primo_rilievo`, finché la terrazza non è raggiunta, la partenza della
  scorciatoia (`scorciatoia_terrazze`, solo con `variante:E4=Abitata`; la scorciatoia è dritta,
  un punto basta) o della mulattiera (una tappa sola non basta: è a tornanti, ci vorrebbe un
  punto per tornante o un segnalino che segua il nastro); in `m1_ritorno`
  `{ "luogo": "i_ronchi", "quando": "luogo:guado_sass raggiunto e !luogo:i_ronchi raggiunto" }`.
- I muri delle terrazze hanno il varco della scorciatoia anche nella variante Carta (le
  «terrazze intatte» dei contenuti): la scorciatoia resta chiusa lo stesso, perché la terza
  alzata senza gradini è troppo ripida, ma le prime due si salgono. Da rifinire con chi fa i
  muri (grafica/natura), se si vuole il varco solo con i gradini.
- I camminamenti dei traversi (gradini a tutta larghezza, parapetti di pietra o corrimano di
  castagno) hanno la forma semplice dei gradini che c'erano: il loro aspetto è da rifinire con
  la grafica.
- Se si misura la passerella prima di parlare con Ottavio (le assi ancora sulla riva), il passo
  si chiude lo stesso ma il mattino dopo la passerella misurata è quella senza assi: non blocca,
  ma la battuta di Ottavio non torna. Da decidere con la storia.
- La nota di `m1_dono` in `content/missioni.json` dice ancora «dalle 07:00 alle 19:00»: è una
  nota (non la legge il motore) e le righe di `missioni.json` qui non si toccano; FASE1 §M1.14 è
  aggiornato.
