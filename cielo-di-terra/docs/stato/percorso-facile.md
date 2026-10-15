# Il percorso facile: prologo e missione 1 senza blocchi

Data: 2026-10-15. Ramo: `funzioni/percorso`. Responsabile: accessibilità del percorso (regia).

La partita automatica (`npm run e2e:fase1`) si teletrasporta e mira esatto: non vedeva i punti
dove un giocatore vero (che cammina, mira a occhio, non ha letto il design) restava fermo. Qui,
passo per passo dal vetro della capsula alla lettera di Rosa, che cosa poteva bloccarlo e che
cosa è cambiato. Prima di questo lavoro erano già stati corretti: la lettera letta tenendola
aperta 3 s, «Camminare» che basta sedersi all'aperto, la camera del titolo spenta dopo
«Continua», la lente con punti di 90 cm e l'indicazione «Q — …».

Le reti di sicurezza nuove sono in `src/regia/percorso.ts` (una sola chiamata per passo dalla
regia, `percorso.update`); le tolleranze in `src/regia/bersagli.ts`, `src/regia/corpo.ts`,
`src/regia/regia.ts`, `src/regia/dialoghi.ts`, `src/regia/png.ts` e nei raggi di
`content/luoghi.json`. Nei contenuti: quattro condizioni di `content/dialoghi.json`, nessuna
riga di `content/missioni.json`.

## Reti di sicurezza per tutto il percorso

| Problema | Correzione |
|---|---|
| Solo il dialogo delle campane aveva una riserva (`campaneDiRiserva`): un altro dialogo automatico interrotto, perso in un caricamento o annunciato quando la persona non c'era fermava la storia. | **Dialoghi di riserva** generalizzati: per ogni passo attivo del prologo e della missione 1, i dialoghi automatici che lo fanno avanzare (nominati da `completa_quando`, o che accendono alla fine un flag che la condizione legge, come la lettera di Rosa, o la scelta della notte nel fienile) si richiedono ogni 1,5 s se non sono aperti, in coda o finiti e la loro condizione vale. |
| Un dialogo automatico in coda si apriva anche quando la sua condizione non valeva più e chi parlava era lontano (la novizia che parla dalla Casa del Velo, il mattino dopo, a Elvira in giro per il paese). | La coda dei dialoghi (`dialoghi.ts`) apre un dialogo automatico solo se la condizione vale ancora e chi parla è entro 25 m (Ottavio a parte: viene lui). Le richieste «forzate» della riserva saltano la condizione. |
| Nessuna indicazione di che cosa premere nei gesti senza un bersaglio. | **Indicazioni dei gesti** nel posto del tasto E: la scala della Cripta (W), il Velo in aria (Spazio), lo squadro piantato (A/D, poi il tasto destro, con la barra della collimazione e la palina da cercare), Ottavio in volo (G), da seduta l'attesa (X, con «E: rileggi la lettera»). |
| Un passo fermo a lungo non ripeteva più che cosa fare. | **Promemoria**: dopo 90 s (40 s per sedersi nel prologo) il suggerimento dei comandi del passo torna una volta. |
| Dalla terrazza del campanile ci si butta col Velo: a terra Elvira restava «dentro la cella» e fuori non funzionava più niente (bersagli all'aperto, squadro), neanche dopo un caricamento. | Lontana dalla terrazza (8 m) o 4 m sotto il pavimento, Elvira è fuori (`esciDallaCellaSeCaduta`). |
| Allo squadro piantato il fiato non tornava: con il fiato corto «la bolla non sta ferma» per sempre. | Piantati, il fiato torna come da fermi. |
| Uscendo dalla botola verso il paese c'è un parapetto di 90 cm (più alto di un gradino, 50 cm): camminando contro, Elvira si fermava senza capire perché. Anche la prova automatica, che camminava verso il muretto del belvedere, restava lì (poi si teletrasportava). | Ferma contro un muretto che si scavalca con un salto (fra 0,5 e 1,2 m): «Spazio — Salta: scavalca il muretto» (`murettoDavanti`). |
| Finita un'attesa («aspetta fino a la brace»), la storia se ne accorgeva al decimo di secondo dopo: chi si alzava subito (o la prova automatica) non vedeva chiudersi il passo. | Quando l'attesa arriva, la storia si aggiorna nello stesso passo. |

## Prologo «Due secoli»

| Passo | Problema | Correzione |
|---|---|---|
| P0.1 Il vetro (`pr_vetro`) | La scritta era un cono di 17° a 58° dallo sguardo iniziale, sdraiati; chi non la trovava restava nella capsula. | Cono di 26° (raggio 0,2 m a 40 cm). Dopo 12 s (e 30 s) lo sguardo ci scivola sopra da solo. |
| P0.2 La Cripta (`pr_cripta`) | Si poteva salire la scala e spingere la botola prima di prendere la busta e aprire l'armadietto: fuori, con il passo della Cripta da fare e la botola che si scendeva solo dopo lo sguardo in su, la partita era bloccata. | La botola non si apre finché mancano la busta o l'armadietto (una nota dice quale); «Scendi nella Cripta» funziona anche con il passo della Cripta da fare (vecchi salvataggi). Sulla scala: «W — Sali la scala». |
| P0.3 La botola, lo sguardo in su | Nessun blocco (il passero a 20 s, «Guarda in su» a 35 s). | — |
| P0.4 Camminare (`pr_camminare`) | Chi non si sentiva il fiato corto non sapeva di doversi sedere. | Promemoria «Siediti a respirare: tieni premuto C» dopo 40 s. |
| P0.5 La lettera | (già corretto: 3 s aperta) | Promemoria «Siediti sul muretto…» dopo 45 s; da seduta, dopo averla letta, «X — Aspetta fino a… (E: rileggi la lettera)». |
| P0.6 Le campane | (già: `campaneDiRiserva`) | Diventata la riserva generale dei dialoghi. |

## Missione 1 «Il castagno vuoto», giorno 1

| Passo | Problema | Correzione |
|---|---|---|
| M1.1 La lente | (già corretto) L'indicazione «Q — …» compariva solo entro 9 m. | Entro 12 m. |
| M1.2 La marza | Il ramo vivo, sopra la testa, era un bersaglio di 50 cm entro 2,8 m dagli occhi. | 80 cm, entro 3,6 m. |
| M1.3 Il cartellino | Il cartellino è legato a 3 m da terra: andava guardato da meno di 2 m (ferma a 4 m Elvira non poteva leggerlo) e il luogo del castagno aveva un raggio di 4 m. | Il cartellino si legge fino a 4,6 m dagli occhi (60 cm); il castagno del cartellino ha raggio 8 m. |
| M1.4 L'innesto | Anche l'innesto è sopra la testa (50 cm entro 2,8 m). | 70 cm entro 3,8 m; a metà gesto si riprende (già così). |
| M1.5 Il Velo | **La planata contava solo con il Velo aperto 2 s**: con la fisica del Velo un salto dal muretto della Terrazza (3,5 m) lo tiene aperto mezzo secondo, da 8 m poco più di uno; servivano una quindicina di metri. La prova automatica partiva in volo a 10 m/s da 13 m. | Conta anche il Velo aperto almeno 0,3 s in un salto che finisce almeno 2,5 m più in basso (i 2 s restano per le planate lunghe). In aria «Spazio — tienilo premuto: apri il Velo»; un atterraggio senza planata dice perché («il Velo non ha preso aria: salta da un muro più alto»). |
| M1.6 I velati | Prima delle 08:00 c'è solo Togna: nessuno diceva di aspettare. (Dalle 08:00 alle 17:30, il fermo del giorno 1, ci sono sempre almeno il campanaro, la Pina e i bambini.) | In piazza, se mancano persone con cui parlare: «Adesso in piazza non c'è nessuno con cui parlare. Il paese si sveglia: alle 08:00… Siediti (C) e aspetta (X).» Le persone si scelgono da 4 m (prima 3,4). |
| M1.7 Il Messo | Se il terzo velato era Nando (ai Ronchi), Ottavio atterrava a metà strada verso la piazza e il dialogo partiva solo entrando in piazza: nessuno lo diceva. | Ottavio atterra a una dozzina di metri da Elvira; dopo 25 s il dialogo parte anche fuori dalla piazza (riserva «ovunque»: viene lui). |
| M1.8 La brace | Nessun blocco (il tempo passa comunque). | Promemoria «aspetta» dopo 90 s; da seduta «X — Aspetta fino a…». |
| M1.9 L'Ombrista | Nessun blocco (finisce alle 20:30). | — |
| M1.10 Il fienile | Il luogo del fienile aveva raggio 6 m attorno al centro (dentro i muri): davanti alla porta, a due metri, non si era «arrivati». **Chi girava tutta la notte arrivava al fienile di giorno**: la scelta di Ottavio, il sonno e il mattino del giorno 2 non tornavano più. | Raggio 12 m. **Fermo della prima notte**: finché Elvira non arriva al fienile l'orologio non passa le 05:00 del giorno 2 (aggiunto alla tabella dei fermi in FASE1 §2.2). |
| M1.11 La notte | Se il dialogo «Dormi o guardi?» arrivava dopo le 05:30 (dopo il passo), la scelta «Dormo» non faceva più niente. | Il dialogo non si apre più a passo finito (`!passo:m1_notte completato`); riserva del dialogo mentre il passo è attivo. |

## Missione 1, giorni 2 e 3

| Passo | Problema | Correzione |
|---|---|---|
| M1.12 Il mattino | Il dialogo del mattino chiedeva `giorno:2` esatto: un salvataggio vecchio arrivato al giorno 3 non poteva più finire il passo. | `giorno:>=2` (anche per la variante della passerella salvata). |
| M1.13 Il ritorno | Nessun blocco. | — |
| M1.14 Il dono | La Bacheca aveva raggio 2 m (bisognava starci sopra); la novizia se ne andava alle 19:00 alla Casa del Velo: chi la cercava alle 20 non la trovava (e il dialogo partiva da lontano), la mattina dopo non c'era più alla Bacheca. Il pacco portato da Ottavio poteva essere seguito da quello della novizia. | Bacheca con raggio 8 m. La novizia **aspetta alla Bacheca dalle 07:00 alle 21:00, ogni giorno dal secondo, finché non ha dato il dono** (`png.ts`); il dialogo si apre solo con lei vicina; dopo il pacco di Ottavio non si apre più. |
| M1.15 Il campanile | Fuori dalle 08:00-18:00 il campanaro non c'è e la porta diceva solo «Le chiavi le ha il campanaro». | La porta dice quando c'è: «arriva sul sagrato alle 08:00: siediti (C) e aspetta (X)», «torna domattina», «è qui vicino, parlagli». La targa si legge da 3 m (prima 2,2). |
| M1.16 Il libretto | Nessun blocco. | — |
| M1.17 Il chiodo 2 | Il chiodo era un bersaglio di 35 cm entro 2,4 m (ai piedi). Dopo averlo piantato, «E — Stacca lo squadro» copriva che cosa fare. La bolla aveva una finestra di un terzo di secondo per lasciare A/D. | Chiodi da 60 cm entro 3 m. Piantati: «A / D — centra la bolla», poi «Tasto destro — guarda nel cannocchiale e cerca la palina bianca e rossa sul campanile», poi la croce con la barra (anche quando il tasso la copre: il tentativo conta). Bolla 0,18 (prima 0,12). |
| M1.18 Il primo rilievo | La croce doveva stare entro 0,9° per 1,5 s. | 1,3° (2° con «collimazione agganciata»). |
| M1.19 La strada del Messo | Prima delle 14:00 Ottavio è in volo con le lettere e scende solo al fischio (G): nessuno lo diceva («arrivo al fienile alle 12»). | «G — Chiama Ottavio con un fischio: è in volo con le lettere», finché il dialogo della passerella non è fatto. |
| M1.20 La seconda notte | Nessun blocco. | Promemoria «aspetta». |
| M1.21 La prova | La passerella aveva raggio 4 m: dalla riva il dialogo non partiva. | Raggio 7 m; riserva del dialogo. |
| M1.22 La lettera di Rosa | Il passo legge un flag acceso alla fine del dialogo: senza riserva. | Riserva (il dialogo accende il flag che il passo legge). |

## Prove

- `tests/regia/percorso.test.ts`: i dialoghi che fanno avanzare ogni passo, le indicazioni dei
  gesti, il fermo della prima notte, le planate corte, i luoghi più larghi, la porta del
  campanile, la novizia; `tests/regia/interazioni-corpo.test.ts` (planata da un muro) e
  `tests/regia/catasto-abitanti.test.ts` (la novizia aspetta alla Bacheca),
  `tests/regia/dialoghi-coda.test.ts` (la coda: condizione, distanza, richieste forzate).
- Prove mirate nel browser (copie tagliate di `scripts/e2e-fase1.mjs`, non nel repository), con
  i tasti veri e senza mirare esatto: lo sguardo nella capsula senza mouse (14,5 s); la botola
  prima della busta (resta chiusa, «W — Sali la scala»); fuori, contro il parapetto verso il
  paese («Spazio — scavalca», e con il salto si passa); il cartellino da 4 m (si legge, il
  passo si chiude); la planata dal muretto di 3,5 m (conta, «Spazio» in aria); giù dal
  campanile col Velo (fuori dalla cella); i velati alle 07:12 (la nota del paese che dorme); il
  terzo velato ai Ronchi (il Messo arriva in 30 s); la notte girando (orologio fermo alle 05:00
  del giorno 2, al fienile «Dormi o guardi?»); la novizia alle 20:00 (c'è e dà il pacco) e alle
  22:00 (nessuno; il mattino dopo, lontano, non parla; alla Bacheca sì); il prato alle 12:00
  («G», il fischio, si parla con Ottavio); lo squadro sul chiodo 2 da 2,2 m («A / D»);
  «Continua» da un salvataggio della notte nel fienile (Ottavio richiede «Dormi o guardi?»).
- `npm run typecheck`, `npm test`, `npm run verifica-contenuti`, `npm run build`,
  `npm run e2e:fase1`: verdi.

## Che cosa resta

- Una prova di cammino «ingenuo» (dritti verso la meta, un salto quando si è fermi) arriva dalla
  botola al belvedere, al castagno, dalla Terrazza alla piazza, alla passerella e al Sass dal
  Messo; non arriva in linea retta dal castagno o dalla piazza alla Terrazza Pedrazzini, né dal
  guado alla piazza: i muri delle terrazze e il muro di Ronco sono alti, si passa dalla
  mulattiera, dalla scorciatoia o dal ponte. È la strada che il segnalino delle indicazioni
  delle missioni deve indicare (le tappe della «via»), non un blocco della storia.
- Le indicazioni delle missioni (pannello con l'obiettivo e segnalino, ramo `funzioni/obiettivi`)
  dicono anche dove andare e chi arriva a che ora: qui solo le note dove il giocatore si
  ferma (la porta del campanile, la piazza vuota) e che cosa premere.
- Se si misura la passerella prima di parlare con Ottavio (le assi ancora sulla riva), il passo
  si chiude lo stesso ma il mattino dopo la passerella misurata è quella senza assi: non blocca,
  ma la battuta di Ottavio non torna. Da decidere con la storia.
