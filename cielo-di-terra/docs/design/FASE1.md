# Cielo di Terra — Fase 1: sceneggiatura giocabile

Il prologo «Due secoli» e la missione 1 «Il castagno vuoto», più il gioco libero che li segue. Durata: 45-60 minuti per la storia, poi quanto si vuole.

Documento normativo per la prima versione giocabile. Le regole generali sono nel `GDD.md`; i dati da caricare sono in `content/`:

| File | Contenuto |
|---|---|
| `luoghi.json` | 47 luoghi con (z, θ, altezza), raggio d'arrivo, tipo, zona, cella |
| `capisaldi.json` | la rete di Corbella (10 capisaldi), i 18 lati con il loro ventaglio di particelle, 12 pilastri lontani visti di notte |
| `personaggi.json` | chi c'è, come appare, che voce ha, dove sta a ogni ora |
| `dialoghi.json` | tutti i dialoghi della Fase 1, con condizioni ed effetti |
| `missioni.json` | prologo, missione 1, tre segreti, l'easter egg e il gioco libero, passo per passo |
| `taccuino.json` | domande, indizi con fonte, parole barrate, note a due mani, proverbi, riga del cielo |
| `testi.json` | lettera di Marta, biglietti, pagine del libretto di Aurelio, cartellini, scritte, leggende dell'Ombrista, battute di Elvira e di Meridiana, suggerimenti dei comandi |
| `fade_fase1.json` | le due leggi, le quattro regole, i quattro elementi mobili, il giro delle Fade, le due notti, il resoconto del mattino, le 228 particelle dell'area con il loro stato iniziale |

---

## 1. Che cosa deve dimostrare la Fase 1

1. Il cilindro si **guarda in su**: il primo minuto all'aperto finisce con il lago appeso sopra la testa.
2. Il gioco **insegna un verbo alla volta**, nell'ordine: guardare in su, camminare (e respirare), leggere, la lente, l'innesto, il Velo, parlare con i velati, la notte, la Pianta e il resoconto del mattino, il libretto, il rilievo.
3. La **prima legge della notte** si impara col corpo: il sentiero non misurato sparisce, quello misurato resta.
4. Il **primo rilievo** fa passare un pezzo di valle dalla matita al colore sotto gli occhi del giocatore, e da lontano si vede.
5. Il mondo è **più grande** di Corbella: dopo la missione si può volare nelle altre valli, che restano a matita.
6. La storia ha già **tre fili** che tirano: la lettera con il fiore sbagliato, chi ha scritto sul vetro, perché le api non impollinano.

---

## 2. Convenzioni

### 2.1 Coordinate e celle

- Posizioni in **(z, θ, h)**: z in metri da 0 (Tappo Sud) a 3000 (Tappo Nord), θ in gradi crescenti a Mane, h in metri di quota verso l'asse (r = 646 − h). Le quote dei luoghi sono già comprensive del terreno del motore.
- **Celle** (particelle): id = floor(z/40)·96 + floor(θ/3,75), come in `src/world/cells.ts`. Il nome catastale a schermo è «1-N», con N = iz·24 + iθ + 1.
- Celle che contano nella Fase 1:

| Cella | Catasto | Che cosa c'è |
|---|---|---|
| 2599 | 1-656 | la botola della Cripta e il castagno morto (già a colore: rilievo G4 del 2291) |
| 2214 | 1-559 | la Terrazza Pedrazzini e il chiodo 3 |
| 2213 | 1-558 | il castagno del cartellino |
| 2311, 2407 | 1-584, 1-608 | la scorciatoia delle Terrazze (elemento mobile E4) |
| 2505 | 1-634 | Piazza delle Ore e campanile di San Vigilio (Pilastro 1) |
| 2797, 2798 | 1-710, 1-711 | la passerella del Messo e il sentiero nel prato di Ronco (elemento mobile E1) |
| 2796 | 1-709 | la casa di Nando (E2) |
| 2699 | 1-684 | il muro di Ronco (E3) |
| 2799 | 1-712 | il fienile di Ottavio (rifugio) e il chiodo 8 |

### 2.2 Il tempo nella Fase 1

- Un giorno di 24 ore dura 40 minuti reali: **1 ora di gioco = 100 s**.
- Alba 05:30 (la Linea arriva sopra Corbella alle 05:40), giorno 06:30-19:30, brace 19:30-21:00, notte 21:00-05:30, giro delle Fade 22:00-04:30.
- **Fermi dell'orologio** (solo nella Fase 1, perché il tutorial non dipenda dalla velocità del giocatore). Sono scritti nei passi di `missioni.json` come effetti `orologio:`:

| Quando | Fermo |
|---|---|
| dal risveglio all'apertura della botola | l'orologio è fermo alle 05:38 |
| giorno 1, finché Ottavio non ha parlato con Elvira | l'orologio non supera le 17:30 |
| giorno 2, finché non è fatto il primo rilievo | non supera le 16:00 |
| giorno 2, finché la passerella del Messo non è rilevata | non supera le 19:00 |

Quando un fermo tiene, il mondo non si blocca: la luce resta quella del pomeriggio, le persone continuano le loro routine dell'ultima ora. Il giocatore non deve accorgersene.

### 2.3 Condizioni ed effetti nei dati

**Condizioni** (`attiva_quando`, `completa_quando`, `condizione`): atomi combinati con `e` / `o` (la `e` lega più forte) e parentesi tonde; `!` davanti a un atomo lo nega.

| Atomo | Vero quando |
|---|---|
| `inizio` | all'avvio di una partita nuova |
| `flag:nome` | il flag è acceso |
| `luogo:id raggiunto` | Elvira è entro il `raggio` del luogo (una volta raggiunto resta vero per quel passo) |
| `ora:>=HH:MM`, `ora:<HH:MM` | ora di gioco (`ora:>=20` vale 20:00) |
| `giorno:N`, `giorno:>=N` | giorno di gioco (il primo è 1) |
| `cella:id rilevata` | la particella è a colore per un rilievo di Elvira (G5) |
| `dialogo:id finito` | il dialogo è arrivato a un nodo che finisce |
| `passo:id completato` | il passo di missione è completato |
| `contatore:nome>=N` | contatore numerico |
| `oggetto:id` | Elvira possiede l'oggetto |
| `variante:E1=Abitata` | l'elemento mobile ha quella variante |

**Effetti**: `flag:nome` (accende), `flag:-nome` (spegne), `contatore:nome+1`, `taccuino:id` (aggiunge una voce di `taccuino.json`), `missione:id` (attiva una missione), `missione:id completata`, `oggetto:+id` / `oggetto:-id`, `testo:id` (apre un testo di `testi.json` in vista di lettura), `dialogo:id` (avvia un dialogo), `orologio:fermo HH:MM`, `orologio:max HH:MM`, `orologio:libero`, `germoglio:+1`, `variante:E1=Abitata`, `suono:id`, `musica:id`, `pianta:apri`, `npc:id->luogo` (sposta un personaggio), `suggerimento:id` (mostra un suggerimento dei comandi).

### 2.4 Flag che il motore accende da solo

| Flag | Si accende quando |
|---|---|
| `guardato_in_su` | all'aperto, lo sguardo sta più di 50° sopra l'orizzonte locale per 1,5 s |
| `guardato_vetro` | nella capsula, lo sguardo resta sulla scritta del vetro per 1,5 s |
| `seduta` | Elvira si siede a respirare |
| `lettera_letta` | la vista di lettura della lettera di Marta arriva all'ultima riga |
| `prima_meta_vista` | primo passaggio della Meta con Elvira all'aperto |
| `planata_fatta` | il Velo resta aperto almeno 2 s e Elvira atterra in piedi |
| `pianta_aperta` | il giocatore apre la Pianta |
| `libretto_aperto` | il giocatore apre il libretto |
| `lente:<oggetto>` | la lente resta 1 s su un punto d'esame (vedi `luoghi.json` e §5) |
| `appuntato:<cella>` | la cella è stata appuntata con lo squadro |
| `appuntato_lontano:<cella>` | la cella è stata appuntata da più di 600 m |
| `tentato_lato:<a-b>` | Elvira ha piantato lo squadro su `a` e collimato verso `b`, anche senza riuscire |
| `rilevato_lato:<a-b>` | il lato è stato chiuso |
| `notte_vegliata:N` | Elvira è rimasta sveglia per tutta la notte N |
| `taccuino_spostato` | la Pesarina ha aperto il Taccuino (notte 1) |

---

## 3. La rete di Corbella in breve

Dieci capisaldi (dettagli in `capisaldi.json`). Per la storia ne servono quattro: **1, 2, 3, 7, 8**.

| Caposaldo | Dove | (z, θ, h) | Ruolo nella Fase 1 |
|---|---|---|---|
| Pilastro 1 | cella campanaria di San Vigilio | (1062, 37,2, 62,5) | il bersaglio del primo rilievo |
| Chiodo 2 | sagrato | (1050, 39,6, 35,5) | il primo tentativo: il tasso copre il Pilastro 1 |
| Chiodo 3 | muro della Terrazza Pedrazzini | (946, 23,6, 57) | stazione del primo rilievo (lato 1-3) |
| Pilastro 4 | Pian dei Ricci | (800, 9,0, 91) | gioco libero |
| Chiodo 5 | gradino del lavatoio | (1040, 39,5, 35,8) | gioco libero (la tettoia copre il Pilastro 1) |
| Pilastro 6 | Sass Grand | (1190, 74,0, 41,7) | gioco libero |
| Chiodo 7 | soglia del mulino | (1130, 51,0, 7,7) | passerella del Messo (lato 7-8) |
| Chiodo 8 | Sass dal Messo | (1172, 57,0, 12,8) | passerella del Messo |
| Chiodo 11 | cippo della Cripta | (1110, 26,2, 45,9) | già rilevato dal G4 nel 2291 (lato 1-11) |
| Chiodo 37 | muro della grà di Pian | (890, 17,5, 35,2) | gioco libero |

Lati chiudibili: 1-3, 1-4, 1-6, 1-7, 1-8, 1-11 (già fatto), 3-4, 3-5, 3-11, 3-37, 4-37, 5-6, 2-6, 6-8, 7-8, 8-11. Bloccati: 1-2 (il tasso), 1-5 (la tettoia del lavatoio).

---

## 4. Il prologo «Due secoli» (circa 8 minuti)

### P0.1 Il vetro — `pr_vetro`

- **Luogo**: Capsula n. 5, Cripta dei Giardinieri (1112, 27,4, −4,5). Orologio fermo alle 05:38.
- **Che cosa vede**: nero. Un sibilo di gas. Una luce color miele si accende a scatti. Elvira è sdraiata; sopra la faccia, a venti centimetri, il coperchio di vetro appannato. Le sue mani (guanti rattoppati, l'anello) entrano nell'inquadratura e puliscono la condensa. Sul vetro, scritto a matita dura da fuori, al contrario per chi lo legge da sotto ma leggibile: **«Non fidarti delle campane»**.
- **Che cosa fa**: muove lo sguardo. È il primo verbo: guardare (in su, perché è sdraiata).
- **Suggerimento**: «Guarda» (con il comando dello sguardo).
- **Avanza quando**: lo sguardo resta sulla scritta 1,5 s (`flag:guardato_vetro`).
- **Elvira** (voce filtrata dal respiratore, piano): «...Chi?»
- **Taccuino**: domanda `q_vetro`; indizio `i_scritta_vetro`.
- **Tempo**: 40 s.

### P0.2 La Cripta — `pr_cripta`

- **Luogo**: Cripta dei Giardinieri (1112, 27,0, −4,5), raggio 12 m.
- **Che cosa vede**: il coperchio si solleva da solo. Sala a volta del 2121, sette capsule a semicerchio, tubi con la condensa. Elvira si mette seduta (comando «alzati»). Il display della capsula: **2322**. Le capsule:
  - n. 1, Battista Rè: aperta, il coperchio spinto dall'interno, vuota;
  - n. 2, Agnese Moretti: dentro un'urna di rame;
  - n. 3, Ilde Bassi: vuota, una corona funebre secca sul coperchio e una targa d'ottone «Santa Giardiniera, salita nella Linea, 2265»;
  - n. 4, Severino Lanfranchi: vuota, coperchio richiuso con cura;
  - n. 6, Teo Cattori, e n. 7, dottoressa Irene Sala: addormentati sotto il vetro gelato, le sveglie staccate (cavi tagliati netti), una busta di carta grezza appoggiata su ciascun vetro.
- Sul **suo** vetro, sotto la scritta, una busta: «Per la mamma». Accanto alla capsula, l'armadietto n. 5.
- **Che cosa fa**: si alza, cammina piano (0,9 m/s, le gambe di due secoli), prende la busta, apre l'armadietto: la tuta da Giardiniera (già indossata), il **Velo** ripiegato, lo **squadro a cannocchiale** e il **libretto** di Aurelio in una borsa di cuoio, l'**erbario** con la lente legata a un cordino, il coltello da innesto, rafia e mastice, il respiratore (già sul viso). Può esaminare le capsule (facoltativo). Sulla serratura della propria capsula: segni di forzatura dall'esterno.
- **Elvira** davanti all'armadietto, toccando lo squadro: «Aurelio.» Davanti alla capsula 3: «Ilde?» Davanti alle capsule 6 e 7: «Dormite. Beati voi.»
- **Avanza quando**: `oggetto:lettera_marta e flag:armadietto_aperto`.
- **Taccuino**: domanda `q_giardinieri`; indizi facoltativi `i_capsula_1`, `i_capsula_2`, `i_capsula_3`, `i_capsula_4`, `i_capsule_6_7`, `i_forzata`.
- **Segreto disponibile**: «Le buste delle capsule» (§8.1), appena Elvira ha la lente.
- **Tempo**: 2-3 min.

### P0.3 La botola — `pr_botola`

- **Luogo**: corridoio di servizio (1106, 27,2, −4) → scala (1111, 27,0, −1,5) → botola (1112, 27,0, 42).
- **Che cosa vede**: un corridoio basso di segmenti di ferro, con gli orari di manutenzione del 2121 dipinti a mano e, a gesso, una scritta di un tecnico (testo `gesso_corridoio`). In fondo una scala alla marinara. In alto, la botola, con un filo di luce grigia attorno al bordo.
- **Che cosa fa**: sale la scala guardando in su (ci si arrampica guardando in alto: il verbo «guardare in su» viene naturale). Spinge la botola. **L'orologio riparte: sono le 05:39.**
- **La scena**: la botola si apre su un cielo che non è un cielo. Dal Tappo Sud una linea di fuoco corre lungo l'asse, come una miccia (la Linea si accende: il fronte passa sopra Corbella alle 05:40). Nella luce che arriva, sopra la testa, il terreno continua: un lago a testa in giù, con minuscole vele rosse, campanili rovesciati, campi a matita che diventano blu nella foschia. Musica: il primo tema (un accordo che si apre).
- **Avanza quando**: `luogo:botola raggiunto e flag:guardato_in_su`. Se dopo 20 s all'aperto il giocatore non ha guardato in su, un passero si alza in volo verso l'alto e un suono di campanaccio arriva dal cielo (dal lago appeso). Se ancora niente dopo altri 15 s, il suggerimento «Guarda in su».
- **Elvira**, a lungo zitta, poi: «Il lago. Sopra.»
- **Taccuino**: parola `w_insu` (~~verso l'asse~~ in su: la scrive più tardi, ma la voce si aggiunge qui) e `w_linea`.
- **Tempo**: 1-2 min.

### P0.4 Camminare — `pr_camminare`

- **Luogo**: dalla botola al muretto del belvedere (1094, 29,8, 46), 25 m a Mont e a Mane, sul ciglio della prima terrazza.
- **Che cosa vede**: il castagno morto sopra la botola, i ricci vuoti, l'erba fredda. Davanti, sotto, i tetti di piode di Corbella e il campanile bianco; più in là il riale; sopra, il lago appeso. Le prime persone velate attraversano la piazza, lontane.
- **Che cosa fa**: cammina. Dopo 15-20 m il fiato si fa corto: la vista si restringe ai bordi, il respiratore soffia. Suggerimento «Siediti a respirare» la prima volta. Si siede sul muretto.
- **Avanza quando**: `luogo:belvedere_muretto raggiunto e flag:seduta` (se si siede altrove prima del muretto, il passo si completa lo stesso appena arriva al muretto).
- **Elvira**, sedendosi: «Piano, vecchia.»
- **Tempo**: 1 min.

### P0.5 La lettera — `pr_lettera`

- **Luogo**: muretto del belvedere.
- **Che cosa fa**: da seduta apre la busta (suggerimento «Leggi»). Vista di lettura a tutto schermo: la carta grezza, la calligrafia rotonda di una ragazza, la «g» chiusa a ricciolo. Testo completo: `testi.json` → `lettere.lettera_marta`. Il passo si chiude all'ultima riga.
- **Il fiore sbagliato**: «Tieni ancora la stella alpina che ti ho dato all'imbarco?»
- **Mentre legge o subito dopo**: il primo passaggio della Meta. Una lama di luce bianca attraversa la valle in tre secondi; tutte le ombre di Corbella scattano insieme e tornano. (Se la Meta è già passata mentre camminava, la nota scatta al passaggio successivo.)
- **Elvira**, abbassando la lettera: «Stella alpina.» Una pausa. «Mi diede un martagone.»
- **Taccuino** (le due mani litigano per la prima volta):
  - indizio `i_stella_alpina` (tecnica): «"Tieni ancora la stella alpina?" Mi diede un martagone.»
  - nota `n_fiore_madre` (madre, sotto): «Aveva nove anni. Avrà dimenticato.»
  - domanda `q_lettera` (tecnica): «Chi ha scritto la lettera di Marta?»
  - domanda `q_marta` (madre): «Marta è sulla Sorella?»
  - parola `w_sorella`: ~~Verbano II~~ la Sorella.
  - indizio `i_carta_castagno` (tecnica): «Carta grezza, fibra lunga. Castagno.» e, sotto, `n_carta_madre` (madre): «Sulla Sorella avranno i nostri castagni.»
  - al passaggio della Meta: indizio `i_ombre_meta`, nota `n_meta_tecnica` (tecnica): «Una stella non fa ombra. Non a otto anni luce.» e `n_sorella_madre` (madre): «Se la Sorella è il Verbano II, Marta è lassù.»; parola `w_meta`.
- **Tempo**: 1-2 min.

### P0.6 Le campane — `pr_campane`

- **Luogo**: muretto del belvedere; la voce viene dal campanile di San Vigilio (1062, 37,2), 150 m più in basso.
- **Che cosa sente**: tre rintocchi, poi una voce di donna calma, metallica, che esce dall'altoparlante della cella campanaria e rimbalza sui tetti. La Linea sopra la valle pulsa una volta quando dice il suo nome. Dialogo `d_meridiana_1`:
  - **Meridiana**: «Giardiniera cinque. Bentornata in servizio.»
  - risposte: «Chi parla?» → «Meridiana. Gestione del Giardino.» / «Dove sono?» → «Nel Giardino. Non posso rivelare altro.» / «Chi mi ha svegliata?» → «Il registro della Cripta riporta un'apertura manuale. Non posso rivelare il codice.»
  - **Meridiana**: «Indice ecologico: zero virgola quarantuno. Sotto zero virgola trenta non garantisco la vita.»
  - **Meridiana**: «Tu sei la Giardiniera. Guarda.»
  - **Meridiana**, quando Elvira non risponde più: «Registro la richiesta.»
- **Elvira**, dopo: «Le campane parlano.» E guarda il vetro della botola, ancora aperta, ricordando la scritta.
- **Avanza quando**: `dialogo:d_meridiana_1 finito`.
- **Taccuino**: domanda `q_indice`; nota `n_campane` (tecnica): «Le campane parlano. Qualcuno mi ha scritto di non fidarmi.»
- **Effetti**: comincia la missione 1.
- **Tempo**: 1 min.

---

## 5. Missione 1 «Il castagno vuoto»

### Giorno 1

#### M1.1 La lente — `m1_lente` (circa 3 min)

- **Obiettivo nel Taccuino**: «Il mio castagno. Che cos'ha?»
- **Luogo**: il castagno morto (1114, 27,6, 42), sopra la botola.
- **Che cosa fa**: si alza, torna al castagno, prende la lente dall'erbario (suggerimento «Lente»). La lente si appoggia su tre punti d'esame, segnati da nulla se non dal fatto che sono interessanti a vista: i **ricci** per terra, gli **amenti** sui rami bassi, la **corteccia** del tronco. Ogni esame disegna uno schizzo a matita nel Taccuino con la diagnosi in una parola.
  - ricci: vuoti da tre anni → «non impollinato»;
  - amenti: intatti, polline mai portato via → «nessuno li ha visitati»;
  - corteccia: secca, legno affamato di luce → «poca luce».
- Dopo il terzo esame la lente nota da sola un **ramo basso a Mane con la corteccia verde** («ramo vivo»).
- **Elvira**: «Ciao, vecchio.» (al castagno, toccandolo) … «Non sei malato. Hai fame.» … «Uno è ancora vivo. Bravo.»
- **Avanza quando**: `flag:lente:ricci e flag:lente:amenti e flag:lente:corteccia`.
- **Taccuino**: domanda `q_api` («Perché le api non impollinano?»); indizi `i_ricci_vuoti`, `i_amenti`, `i_fame_luce`, `i_ramo_vivo`.

#### M1.2 La marza — `m1_marza` (30 s)

- **Obiettivo**: «Una marza dal ramo vivo, prima che muoia anche lui.»
- **Che cosa fa**: con il coltello da innesto taglia una marza dal ramo vivo (un gesto: tenere premuto mentre si guarda il ramo).
- **Elvira**: «Scusa.»
- **Avanza quando**: `oggetto:marza_pedrazzini`.
- **Effetti**: la Pianta si apre da sola per la prima volta e mostra il **disegno a matita delle Selve**, nella mano di Elvira, con una scritta del 2119 «Terrazza Pedrazzini — marze di casa». Suggerimento «Pianta». Sulla Pianta c'è già una piccola striscia a inchiostro seppia attorno alla Cripta (non commentata qui: è l'indizio facoltativo §8.4).

#### M1.3 La terrazza — `m1_cartellino` (2-3 min)

- **Obiettivo**: «Dove l'ho piantato, il primo innesto di casa?»
- **Luogo**: Terrazza Pedrazzini (948, 23,0, 56), 170 m a Mont della Cripta. Due strade: la **mulattiera delle Terrazze** (Carta: tornanti, lunga) o la **scorciatoia** con i gradini di assi (rimessi dal campanaro alle 07:00; se il giocatore ci arriva prima delle 07:00 trova le assi accatastate e Bortolo che le sta infilando nei muri: battuta di Bortolo, `d_bortolo_gradini`).
- **Che cosa vede**: la terrazza larga, i castagni da frutto inselvatichiti, ricci vuoti dappertutto. Su un castagno vigoroso, legato al ramo più basso, un **cartellino di zinco**.
- **Che cosa fa**: si avvicina e legge il cartellino (vista di lettura breve): «Marze: selva Pedrazzini, Cevio. E. P. 2119».
- **Elvira**: «La mia scrittura.»
- **Avanza quando**: `luogo:castagno_cartellino raggiunto e flag:cartellino_letto`.
- **Taccuino**: indizio `i_cartellino`.

#### M1.4 Il primo innesto — `m1_innesto` (3 min)

- **Obiettivo**: «Rimettere casa sul castagno del cartellino.»
- **Che cosa fa**: prima la lente sul punto d'innesto («innesto del 2120 morto; il selvatico ha ripreso; vivo»), poi il gesto dell'innesto in tre tempi, ciascuno con un movimento delle mani: **taglia** (spacco nel ramo), **inserisci** (la marza), **lega** (rafia e mastice). Il gesto si sbaglia solo se si lascia a metà: si riprende da dove si era.
- **Elvira**, mentre lega: «Su. Attacca.» Dopo: «Lo saprò in primavera.»
- **Avanza quando**: `flag:innesto_fatto`.
- **Taccuino**: indizio `i_innesto_morto`; nota `n_innesto` (tecnica): «Innesto a spacco sul castagno del cartellino. Se prende, si vedrà a primavera.» e, sotto, `n_rafia_madre` (madre): «Marta mi teneva la rafia.»
- **Nota di sistema**: la terrazza non è un elemento mobile: l'innesto è sicuro. È il Nodo 1 del giardino («castagno del cartellino»), che diventa visibile nel Taccuino quando la sua particella (2213) è rilevata.

#### M1.5 Il Velo — `m1_velo` (3-4 min)

- **Obiettivo**: «In paese senza fare tutti i tornanti.»
- **Luogo**: tre muri a secco in fila fra la terrazza e la piazza:
  1. Muretto della Terrazza (962, 25,4), 3,5 m;
  2. Muraglione della Grà (985, 27,6), 8 m;
  3. Ripa di San Vigilio (1036, 33,2), 12 m, che finisce sopra la Piazza delle Ore.
- **Che cosa fa**: sul primo muretto, suggerimento «Salta, poi apri il Velo». Il Velo si apre con un frullo di tela; in alto entra nell'inquadratura il bordo del Velo, la traversa di legno, la nappina che pende. Planata di 14 m. Al secondo muro una planata di 30 m. Alla Ripa una planata di 45 m che atterra in piazza, davanti ai velati che si voltano tutti insieme.
- **Si può anche** scendere a piedi dalla scorciatoia o dalla mulattiera: il passo chiede una sola planata qualunque (almeno 3 m) e l'arrivo in piazza. Ma i tre muri sono la via più evidente e più corta.
- **Elvira**, alla prima planata: «Oh.» Alla terza, atterrando: «Si vola ancora, qui.»
- **Avanza quando**: `flag:planata_fatta e luogo:piazza_ore raggiunto`.
- **Taccuino**: niente (le mani parlano da sole).

#### M1.6 I velati — `m1_velati` (5-6 min)

- **Obiettivo**: «Che cosa sanno, quelli velati?»
- **Luogo**: Piazza delle Ore (1046, 37,0) e dintorni. Ore tipiche: 09:00-13:00.
- **Che cosa vede**: una dozzina di figure velate (garza color noce, cappucci, cappelli a tesa larga), che si fermano e la guardano da lontano; si avvicinano solo i bambini. La gente si dà di gomito: «La Svegliata.»
- **Che cosa fa**: parla con almeno **tre** di questi (ogni dialogo finito fa `contatore:velati+1`):

| Chi | Dove e quando | Dialogo | Che cosa lascia |
|---|---|---|---|
| Togna, lavandaia | lavatoio (1040, 39,5), 07:00-12:00 | `d_togna` | il proverbio della notte: «Quel che la Giardinéra la mesüra, la nocc la tóca mía.» |
| Bortolo, campanaro | sagrato (1052, 39,2), 08:00-18:00 | `d_bortolo_1` | «le campane le suono io; la voce no»; il campanile è chiuso fino a domani |
| Annunciata | panca davanti a San Vigilio (1066, 39,5), 09:00-17:00 | `d_annunciata` | le Lettere dalla Sorella; «Fidati della Madre» (le stesse parole della lettera) |
| Pina | soglia di Pina (1050, 34,5), 08:00-18:00 | `d_pina_soglia` | i cartoni; «Stasera alla brace racconto la Partenza» (e la scatola delle figure: segreto §8.2) |
| Nando, Smascherato | casa di Nando (1188, 46,0), 08:30-18:00 | `d_nando_1` | la casa smontata ogni notte; «Me la benedici, Svegliata?» |
| i bambini (Lisa, Gioanin) | piazza, tutto il giorno | `d_bambini` | «Sei tu la Svegliata? Quella della profezia?»; le parole a Mane e a Sera |

- **Avanza quando**: `contatore:velati>=3`.
- **Taccuino**: proverbio `pv_misura` (con la traduzione di Elvira); indizi `i_svegliata`, `i_benedetta`, `i_proverbio_togna`; parole `w_mane`, `w_sera` (dai bambini o da Togna).

#### M1.7 Il Messo — `m1_ottavio` (3 min)

- **Obiettivo**: «Chi vola sopra la piazza?»
- **Attiva quando**: `passo:m1_velati completato`. Entro 30 s una sagoma con un Velo verde scende in spirale dal cielo (da una corrente calda sopra la grà) e atterra correndo in piazza: **Ottavio**, 17 anni, il velo da corsa legato alla fronte, la borsa del Messo, un lume a petrolio alla cintura.
- **Dialogo** `d_ottavio_incontro` (battute principali):
  - **Ottavio**: «Allora è vero. La Svegliata. Ti facevo più alta.»
  - Elvira: «Io ti facevo più lento.» / «Tu chi sei?»
  - **Ottavio**: «Ottavio. Il Messo. Ventin, per quelli che non mi pagano.» … «Le lettere fra le valli le porto io. Da qui al lago appeso, al Sordo no.»
  - le **parole** arrivano dentro il discorso, mai spiegate: la **Linea** («quando la Linea fa la brace»), la **Meta** («la Meta passa, l'ombra scappa»), **a Mane** e **a Sera** («il lago è a Mane, gli Alpeggi a Sera»), **in su** («si cade in su, dal Balcone»);
  - **Ottavio**: «Dove dormi, Svegliata? Nella Cripta? Con i morti?» … «Ho un fienile. Il fieno è pulito, il tetto quasi.»
  - **Ottavio**: «Prima però la Pina. Alla brace racconta la Partenza. Ci si siede e si aspetta.»
- **Avanza quando**: `dialogo:d_ottavio_incontro finito`.
- **Effetti**: toglie il fermo delle 17:30; parole `w_linea`, `w_meta`, `w_mane`, `w_sera`, `w_insu` (quelle mancanti); sblocca «aspetta fino a: brace».
- **Taccuino**: indizio `i_messo`.

#### M1.8 La brace — `m1_brace` (1-2 min)

- **Obiettivo**: «Aspettare la brace.»
- **Che cosa fa**: si siede sulla panca della piazza accanto a Ottavio (o dove vuole) e usa «aspetta fino a: brace» (suggerimento la prima volta). Il tempo accelera, la riga del cielo conta all'indietro, la Linea si ritira dal Sordo verso il Tappo Sud e lascia una brace blu. Se sono già le 19:30, il passo si chiude subito.
- **Avanza quando**: `ora:>=19:30`.
- **Elvira**, guardando la Linea che si ritira: «Come una miccia, al contrario.»

#### M1.9 L'Ombrista — `m1_ombrista` (3 min, facoltativo nel contenuto)

- **Luogo**: il telo dell'Ombrista (1057, 36,0), 19:45-20:30. Trenta sagome velate sedute sui gradini della piazza; i bambini davanti.
- **Che cosa vede**: una lampada a olio si accende dietro il telo; due mani enormi entrano nell'ombra e muovono figure di cartone: i Padri, il Mondo Bruciato, la Nave, la Sorella, la Santa che sale nella Linea, la Svegliata. Testo: `testi.json` → `leggende.partenza_1` (la versione della Confraternita, recitata da Pina). Il giocatore può andarsene: Ottavio lo aspetta al margine della piazza.
- **Avanza quando**: `ora:>=20:30 o flag:ombrista_1_vista`.
- **Taccuino**: leggenda `lg_partenza_1` (la frase chiave: «e la Svegliata prese la maschera»).

#### M1.10 Il fienile — `m1_fienile` (2 min)

- **Obiettivo**: «Il fienile del Messo, al di là del riale.»
- **Percorso**: dalla piazza giù per i Ronchi (dove la casa di Nando è intera e il muro di Ronco ha la sua breccia) fino al riale (1163, 51,9). Ottavio prende tre assi da sotto un cespuglio e le butta sul riale: la **passerella del Messo** (E1 diventa Abitata). Attraversano il prato di Ronco su un sentiero battuto fino al fienile (1176, 58,5).
- **Ottavio**, buttando le assi: «Ogni sera la rimetto. Ogni notte se la prendono.» Elvira: «Chi?» Ottavio: «Le Fade. Chi altro.»
- **Avanza quando**: `luogo:fienile_ottavio raggiunto`.
- **Taccuino**: parola `w_fade` (~~macchine di manutenzione?~~ le Fade: con il punto di domanda, perché Elvira ancora non le ha viste).

#### M1.11 La notte — `m1_notte` (1 min se dorme, 10-14 min se veglia)

- **Luogo**: fienile di Ottavio, rifugio.
- **Dialogo** `d_ottavio_fienile`: dalla finestrella si vede, a Mane e in alto, il vetro della Finestra dei Ponti con le stelle che girano; ogni 51 s la Meta, e poco dopo un disco grigio con la sua fase.
  - **Ottavio**: «Quella è la Sorella. Ci sono i parenti, sopra. Due volte al mese la Madre legge le loro lettere in piazza.»
  - Elvira: «Ci sono i miei, sopra.» / «Tu ci credi?»
  - **Ottavio**, alla seconda: «Io guardo. Credere è un'altra cosa.» (Ottavio non dice di più: il suo goniometro è nella borsa, e la borsa resta chiusa.)
  - **Ottavio**: «Dormi o guardi? Se guardi, non uscire. Il fienile è benedetto, il prato no.»
- **Scelta**:
  - **dormire** → dissolvenza; l'orologio salta alle 05:30 del giorno 2;
  - **vegliare** → Elvira siede alla finestrella; si può usare «aspetta fino a: mezzanotte». Alle 22:05 escono lumi caldi da una bocca nel prato dei Ronchi; alle 23:20 un cerchio di lumi danza sopra il riale: le assi si sollevano, vengono posate in ordine sulla riva, il sentiero viene pettinato. Alle 00:30, più lontano, le pietre della casa di Nando si sollevano e tornano nel muro di Ronco. Si può uscire: le Fade non guardano le persone. **Chi si siede sulla passerella** prima delle 23:20 la salva per quella notte (le Fade le girano attorno e se ne vanno): vedi la variante del mattino.
- **Avanza quando**: `giorno:2 e ora:>=05:30`.
- **Taccuino** (solo se veglia): indizio `i_ballo_fade`, nota `n_fade_tecnica` (tecnica): «Non smontano a caso. Rimettono.»

### Giorno 2

#### M1.12 Il mattino — `m1_mattino` (3 min)

- **Obiettivo**: «Dov'è finita la passerella?»
- **Che cosa vede**: Elvira si sveglia nel fieno. Il Taccuino è **aperto sulla pagina delle parole**; lei l'aveva chiuso. Un peso sul petto che svanisce. Ottavio è sulla porta.
- **Il resoconto del mattino**: la Pianta si apre da sola (suggerimento «Pianta») sul primo resoconto: in rosso la passerella del Messo e la scorciatoia delle Terrazze («non misurata: tornata alla Carta»), la casa di Nando («non misurata: un muro in meno»), il muro di Ronco. In fondo: «Nando ricostruisce alle 08:30. Bortolo rimette i gradini alle 07:00.»
- **Fuori**: il riale scorre libero; il sentiero è un prato pettinato come da una mano enorme; le tre assi sono accatastate in ordine sulla riva, dall'altra parte.
- **Dialogo** `d_ottavio_mattino`:
  - **Ottavio**: «Se l'è presa la notte. Le Fade. Non era benedetta.»
  - Elvira: «Benedetta da chi?» / «E adesso come si passa?»
  - **Ottavio**: «Dalla Madre. Le case benedette restano. Le altre...» (indica la casa di Nando, lontana, con il muro a terra)
  - **Ottavio**: «Al guado. Ci si bagna le scarpe. Stasera la rimetto.»
- **Variante** (se Elvira ha passato la notte sulla passerella): la passerella c'è. **Ottavio**: «Ci hai dormito sopra? Le Fade non toccano chi c'è. Ma non puoi dormire su tutti i ponti del mondo.» La lezione resta nel resoconto: la scorciatoia e la casa di Nando sono cambiate.
- **Avanza quando**: `dialogo:d_ottavio_mattino finito e flag:pianta_aperta`.
- **Taccuino**: domanda `q_notte` («Perché il sentiero non c'è più e il ponte del Mulino sì?»), domanda `q_pesarina` («Chi ha aperto il mio Taccuino stanotte?»), indizi `i_sentiero_sparito`, `i_muro_ronco`, `i_taccuino_aperto`; parola `w_fade` senza punto di domanda.

#### M1.13 Il ritorno — `m1_ritorno` (2 min)

- **Obiettivo**: «Tornare in paese dal guado.»
- **Percorso**: il guado del Sass (1205, 50,3), cinque pietre piatte: è l'alternativa visibile che la regola 4 garantisce. Sulla strada, ai Ronchi, alle 08:30 **Nando** prende le pietre dal muro di Ronco (che stanotte è tornato intero) e rifà il muro della sua casa: `d_nando_mattino` («Le stesse pietre. Ogni notte nel muro, ogni mattina in casa. Si consumano le mani, non le pietre.»). Se Elvira passa dalle terrazze, vede Bortolo che infila i gradini nei muri.
- **Avanza quando**: `luogo:piazza_ore raggiunto`.
- **Taccuino**: nota `n_pietre` (tecnica): «Le stesse pietre vanno avanti e indietro. Le Fade non distruggono: rimettono com'era scritto.»

#### M1.14 Il dono dell'Eremo — `m1_dono` (2 min)

- **Obiettivo**: «Una novizia mi aspetta alla Bacheca.»
- **Luogo**: Bacheca delle Ore (1043, 35,6). La novizia **Clelia** (maschera di castagno liscia, veste nera) aspetta dalle 07:00 alle 19:00; parte il dialogo quando Elvira è a 15 m.
- **Dialogo** `d_clelia_dono`:
  - **Clelia**: «Dalla Madre, per la Svegliata.» Porge un pacchetto legato con lo spago: un **velo di garza nera** e un biglietto.
  - Elvira: «Che cosa vuole la Madre?» / «Non porto veli.» / «Grazie.»
  - **Clelia**, a tutte: «Non sta a me saperlo. La Madre scrive per chi sa leggere.» E se ne va verso la Casa del Velo.
- **Il biglietto** (vista di lettura, `testi.json` → `lettere.biglietto_madre`): «La profezia dice che la Svegliata prenderà la maschera. Non guardare il Sordo, e ti aspetto. — La Madre». Calligrafia ordinata, carta grezza.
- **Scelta** (libera, reversibile fino alla missione 6): **indossare il velo** o tenerlo nella borsa. Con il velo: i velati si inchinano, Nando si volta e non parla, Bortolo apre il campanile senza fare domande, Pina dice «Ti sta bene il nero. Non ti somiglia». Senza velo: tutto come prima.
- **Avanza quando**: `dialogo:d_clelia_dono finito`.
- **Taccuino**: domanda `q_sordo` («Perché non si guarda il Sordo?»); indizio `i_biglietto_madre`; parola `w_sordo` (~~Tappo Nord~~ il Sordo). Elvira guarda a Lag, in fondo alla valle: la parete grigia, a matita, e sopra il disco di piombo sull'asse.
- **Elvira**: «"Non guardare." Allora guardo.»

#### M1.15 Il campanile — `m1_campanile` (2 min)

- **Obiettivo**: «Perché sul campanile c'è un pilastro del Catasto?» (La palina bianca e rossa sopra la cella si vede da tutta la valle; Elvira la riconosce come un segnale di Aurelio appena la guarda con lo squadro, o appena ha parlato con Bortolo.)
- **Luogo**: sagrato (1052, 39,2) → campanile (1062, 37,2) → cella campanaria (1062, 37,2, 62,5).
- **Dialogo** `d_bortolo_campanile`: **Bortolo**: «La Svegliata vuole salire? Le campane non mordono. La voce sì, a volte.» Apre la porta del campanile.
- **Che cosa fa**: sale la scala di legno; nella cella, le tre campane e, legato al ceppo della più grande, un altoparlante arrugginito del 2121 (si può parlare con Meridiana: `d_meridiana_campanile`, facoltativo). Esce sul tetto piano accanto alla cuspide: il **Pilastro 1**, bronzo, con una targa d'ottone (`testi.json` → `cartellini.targa_p1`): «CATASTO DEL GIARDINO DEL VERBANO — CS 1 — rilevato da A. Respini, 14 ottobre 2120». Da lassù tutta Corbella, il riale, le terrazze; a Lag il Sordo; sopra, il lago.
- **Avanza quando**: `luogo:cella_campanaria raggiunto e flag:targa_p1_letta`.
- **Elvira**, toccando la targa: «Ciao, geometra.»
- **Taccuino**: indizio `i_targa_p1`.

#### M1.16 Il libretto — `m1_libretto` (1-2 min)

- **Obiettivo**: «Che cosa dice Aurelio del suo Pilastro 1?»
- **Che cosa fa**: apre il libretto (suggerimento «Libretto»). Si apre da solo sulla pagina con un segnalibro di rafia: la monografia **CS 1** (`testi.json` → `libretto.cs_1`), scritta per lei: «CS 1. Pilastro di bronzo sulla cella campanaria di San Vigilio, palina b/r 8 m. Da qui vedi il chiodo 2 sul sagrato, se il tasso non è cresciuto. — Per E.: il primo l'ho messo dove avresti sentito le campane.» Nella pagina accanto, la pagina «Come si fa» (`libretto.come_si_fa`): le istruzioni del rilievo nella calligrafia di Aurelio, con un disegnino di una bambina che regge una stadia più alta di lei.
- **Avanza quando**: `flag:libretto_cs1_letto`.
- **Elvira**, dopo un silenzio: «Pianta, livella, collima, leggi. Me lo dicevi sempre.»
- **Taccuino**: nota `n_aurelio_madre` (madre): «La bambina con la stadia è Marta. Aveva sei anni.»

#### M1.17 Il chiodo 2 — `m1_chiodo2` (2 min)

- **Obiettivo**: «Il chiodo 2, sul sagrato.»
- **Luogo**: sagrato, gradino più basso (1050, 39,6, 35,5).
- **Che cosa fa**: trova il chiodo d'ottone (la monografia CS 2 lo descrive: «sul primo gradino, a Mane del portale»), **pianta** lo squadro (suggerimento «Pianta»: tieni premuto), **livella** (la bolla nella fiala; suggerimento la prima volta), **collima**: nel cannocchiale, al posto della palina, il buio verde del **tasso**. Si può muovere il reticolo quanto si vuole: la palina non si vede.
- **Elvira**: «Il tasso è cresciuto, Aurelio.» Poi, sfogliando: «Chiodo 3. Il muro della terrazza di sopra. "Quella dei tuoi castagni."»
- **Avanza quando**: `flag:tentato_lato:2-1`.
- **Taccuino**: indizio `i_tasso`; la monografia CS 3 si segna con un'orecchia.
- **Nota**: dal chiodo 2 si può chiudere il lato 2-6 (Pilastro 6 sul Sass Grand). Se il giocatore lo scopre da solo e lo chiude, il primo rilievo è quello: va bene, il passo M1.18 resta da fare (serve la terrazza), e l'animazione della griglia del foglio si vede la prima volta, ovunque avvenga.

#### M1.18 Il primo rilievo — `m1_primo_rilievo` (3 min)

- **Obiettivo**: «Dalla Terrazza Pedrazzini si vede il campanile?»
- **Luogo**: chiodo 3, sul muro della Terrazza Pedrazzini (946, 23,6, 57). La scorciatoia è stata rimessa da Bortolo alle 07:00.
- **Che cosa fa**: pianta, livella, collima: nel reticolo, sopra i tetti, la palina bianca e rossa del Pilastro 1, in una cartolina nitida. Tiene la mira 1,5 s. **Leggi**: Elvira scrive la lettura nel libretto (suono di matita).
- **Lo spettacolo**: per sei secondi una griglia a china si disegna su tutta la valle (il foglio 1 del Catasto, a celle di 40 m), visibile anche sopra la testa; poi resta solo il ventaglio del lato 1-3 (20 particelle: la terrazza, la scorciatoia, la fascia di terrazze fino al campanile). L'inchiostro chiude i contorni, il colore entra a velature dal chiodo verso il campanile in tre secondi: l'erba diventa verde-oro, i castagni a tre toni, i muri grigio-viola. Le terrazze sopra il paese, che erano tempera spenta, si accendono. Musica: l'accordo che sale. In basso, in piazza, qualcuno indica la collina.
- **Elvira**: «Eccoti.»
- **Avanza quando**: `cella:2214 rilevata`.
- **Effetti**: toglie il fermo delle 16:00; `flag:primo_rilievo`; il Nodo 1 (castagno del cartellino, particella 2213) diventa visibile: il Taccuino scrive «Nodo del giardino: castagno del cartellino. Non impollinato.» con uno schizzo bruno; la scorciatoia delle Terrazze (2311, 2407) è ora misurata.
- **Taccuino**: nota `n_primo_rilievo` (tecnica): «Lato 3-1, chiuso. Il colore viene dal chiodo, come l'acqua da una sorgente.»

#### M1.19 La strada del Messo — `m1_strada` (4-5 min)

- **Obiettivo**: «Se misuro la passerella del Messo, la notte la lascia stare?»
- **Luogo**: riale e prato di Ronco. Ottavio è al fienile dalle 14:00 (se il giocatore arriva prima, è in volo sopra la piazza e scende quando Elvira lo chiama con un fischio, comando «chiama»).
- **Dialogo** `d_ottavio_strada`:
  - Elvira: «Rimettiamola adesso, la tua passerella.»
  - **Ottavio**: «Adesso? Alla brace si rimette.» … «Va bene, Svegliata. Ma se domani non c'è, le assi le porti tu.»
  - mentre posano le assi: **Ottavio**: «Che cosa fai con quel coso d'ottone?» Elvira: «Lo misuro.» / «Lo benedico.» **Ottavio** (alla seconda): «Allora sei proprio la Santa. Non dirlo alla Madre.»
- **Che cosa fa**: la passerella torna Abitata; Elvira cerca da sola i chiodi nel libretto (monografie CS 7 e CS 8, con le loro descrizioni: «sulla soglia del mulino», «sul masso tondo dove si siedono i Messi»), pianta lo squadro su uno e collima l'altro. Il lato 7-8 chiude 13 particelle, fra cui la passerella e il sentiero nel prato.
- **Avanza quando**: `cella:2797 rilevata e cella:2798 rilevata`.
- **Effetti**: toglie il fermo delle 19:00.
- **Elvira**: «Vediamo se la notte sa leggere.»

#### M1.20 La seconda notte — `m1_seconda_notte` (1 min se dorme)

- **Obiettivo**: «Aspettare il mattino.»
- **Dove**: dove vuole. Il fienile resta il suo rifugio; se porta il velo nero, Clelia le offre un letto nella Casa del Velo (dialogo breve, `d_clelia_letto`). L'Ombrista della seconda sera cambia secondo ciò che Elvira ha fatto (`leggende.partenza_2a/2b/2c`, §6).
- **Avanza quando**: `giorno:3 e ora:>=05:30`.

### Giorno 3

#### M1.21 La prova — `m1_prova` (2 min)

- **Obiettivo**: «La passerella c'è ancora?»
- **Che cosa vede**: il resoconto del mattino: in rosso solo la casa di Nando e il muro di Ronco; la passerella e la scorciatoia hanno una riga verde, «misurata: è rimasta». Al riale, le tre assi sono al loro posto; il sentiero è battuto. Ottavio è seduto sulle assi.
- **Dialogo** `d_ottavio_prova`:
  - **Ottavio**: «Non se l'è presa. Prima volta in tre anni.» … «L'hai benedetta?»
  - Elvira: «L'ho misurata.» / «Sì.»
  - **Ottavio**, alla prima: «È la stessa cosa?» Elvira: «Non lo so ancora.» Alla seconda: «Lo sapevo. La Santa.»
- **Avanza quando**: `luogo:passerella_messo raggiunto e dialogo:d_ottavio_prova finito`.
- **Taccuino**: la domanda `q_notte` si chiude con la prima legge, scritta dalla tecnica in stampatello (`i_legge_1`): «CIÒ CHE HO MISURATO, LA NOTTE NON LO TOCCA.» e, accanto, il proverbio di Togna con la traduzione.

#### M1.22 La lettera di Rosa — `m1_gancio` (1-2 min)

- **Obiettivo**: «Il Messo ha una lettera per me.»
- **Dialogo** `d_ottavio_gancio`:
  - **Ottavio** tira fuori dalla borsa una busta sporca di cera: «C'è anche questa. Dai Bugni, sul Verbanetto. La Rosa, la Bugnera. Ha detto: alla Svegliata, se è vera.»
  - **Lettera di Rosa** (`lettere.lettera_rosa`): «Alla Svegliata, se è vera. Ho trecento api di rame in una cisterna. Non sono rotte. Il prete dice di pregare, io dico di guardarle. Vieni ai Bugni prima della Tramontana. — Rosa».
  - Elvira alza gli occhi: sopra, sul lago appeso, sulla riva a Mane, una colonna di scintille di rame che sale e si sfalda.
  - Elvira: «Come ci si arriva, al lago appeso?»
  - **Ottavio**: «Si cade. Dal Balcone dei Messi, su in cima alle Selve, dove si pesa poco. Segui i nastri verdi sui castagni.» … «Domattina ti insegno. Se arrivi prima tu, non buttarti finché la nappina non pende.»
- **Avanza quando**: `flag:lettera_rosa_letta`.
- **Effetti**: `germoglio:+1`; missione 1 completata; attiva la missione 2 «La cisterna di Rosa» (nella Fase 1 solo come domanda e come porta chiusa ai Bugni); comincia il gioco libero.
- **Taccuino**: domanda `q_rosa` («Trecento api morte. Perché?») collegata a `q_api`; indizio `i_lettera_rosa`.
- **Musica**: tema di chiusura, breve. Nessun cartello «Missione completata»: una riga nel Taccuino si chiude con un tratto di matita.

---

## 6. L'Ombrista nella Fase 1

| Sera | Variante | Condizione | Frase chiave (nel Taccuino) |
|---|---|---|---|
| 1 | `partenza_1` | sempre | «e la Svegliata prese la maschera» |
| 2 | `partenza_2a` «quello di sotto» | `flag:figura_toccata` | «e quello di sotto, che nessuno nomina, cambiò spalla» |
| 2 | `partenza_2b` «la Svegliata guardò in su» | `!flag:figura_toccata e !flag:velo_indossato` | «e la Svegliata guardò in su, e la Notte la guardò» |
| 2 | `partenza_2c` «il velo nero» | `!flag:figura_toccata e flag:velo_indossato` | «e la Svegliata prese il velo, e le campane suonarono a festa» |
| 3 e seguenti | ripete la 2 della condizione vera, con un cartone diverso al centro | | |

I testi sono in `testi.json` → `leggende`.

---

## 7. Il gioco libero

Dopo la missione 1 il mondo resta aperto. Niente di ciò che segue è necessario.

### 7.1 Corbella a colori

- La rete di Corbella chiude 16 lati. Le 63 particelle del nucleo che la rete può rilevare sono l'**inventario di Corbella** (`fade_fase1.json` → `inventario_corbella`).
- Quando sono tutte a colore: **le campane di San Vigilio tornano a segnare l'ora** (un rintocco per ora, 06:00-21:00), primo servizio di Meridiana. Meridiana dall'altoparlante: «Corbella è in carta. Le ore sono tue, Giardiniera.»
- Il lato 1-8 chiude anche la casa di Nando: da quel giorno la casa resta intera e Nando lo dice a tutti («La Svegliata mi ha benedetto la casa»). È la premessa della secondaria «La casa che non c'è» (Fase 5), che ne mostrerà il costo. Il flag è `casa_nando_rilevata`.
- I lati 1-7 e 1-8 chiudono il muro di Ronco: da quel momento le Fade non rimettono più le pietre nel muro, e lasciano quelle della casa di Nando in un mucchio al margine. Nando: «Adesso le pietre dormono per terra. Meglio per la schiena.»

### 7.2 Il Balcone dei Messi e l'altra valle

- Il **sentiero dei nastri verdi** parte dal Pian dei Ricci (800, 9,0) e sale lungo la cresta a Sera fino al lobo del Tappo Sud, dentro il Collare (varco a h 294), fino al **Balcone dei Messi** (110, 30, 449), a 0,3 g. Circa 8 minuti di salita: i salti si allungano, le cadute rallentano.
- Dal Balcone, con il Velo aperto e la nappina che pende, ci si lancia **verso l'altra valle**: 60-90 s di volo attraverso il cielo, il capovolgimento lento, l'atterraggio nel Verbanetto o negli Alpeggi.
- **Le altre valli nella Fase 1** restano **a matita anche da vicino**: è un limite di produzione della Fase 1 (i materiali dipinti delle valli 2 e 3 arrivano nelle fasi 2 e 4), che il gioco presenta così: il mondo è un foglio ancora da colorare. I segnali vivi restano a colori: le vele rosse, la lanterna della Torre dei Bugni, il faro dell'Isola dei Conigli, il fumo della cascina degli Alpeggi. I capisaldi delle altre valli non si possono rilevare: le pagine del libretto per quelle valli sono incollate dall'umidità («Le scollerò con il vapore», scrive Elvira).
- Ai **Bugni** (1500, 195,5) la porta di Rosa è chiusa, con un biglietto nel battente: «Sono in cisterna. Torno con la Tramontana. — R.» Tre api di rame girano attorno alla porta.
- Il **Cancello dei Pellegrini** sulla Finestra dei Ponti (1500, 88,5) è chiuso con una catena e un cartello: «Per ordine della Madre: nei giorni della Sorella la Notte non si attraversa.»
- Per **tornare a Corbella**: si risale un Tappo e si ricade, oppure si cammina sul lobo del Tappo Sud attorno al Mozzo, in alto, dove i tre lobi si uniscono.

### 7.3 La notte nel gioco libero

- Ogni notte ripete le regole di `fade_fase1.json` (notte 2 come modello): ciò che non è misurato fa il suo giro.
- Dal fienile o dal campanile, di notte, si vedono i **lumi lontani** (`capisaldi.json` → `lontani_di_notte`): il faro dell'Isola dei Conigli, la lanterna della Torre dei Bugni, il lumino della croce d'alpe, il lumino della nicchia del Ponte di Mezzo e, dalle 23:00 alle 02:00, una lanterna che cammina sulla Finestra delle Vedove (Tecla). Si possono appuntare: diventano matita sulla Pianta e una nota nel Taccuino (`i_lumi_lontani`). Rilevare attraverso il cielo arriva nella Fase 3.

---

## 8. Segreti ed easter egg della Fase 1

### 8.1 Segreto: le buste delle capsule (livello 2)

- **Dove**: Cripta, capsule 6 e 7. Disponibile dal primo minuto; la Cripta resta aperta per tutto il gioco.
- **Come**: guardare le due buste con la **lente** («Per Teo, da Ines, dalla Sorella»; «Per la dottoressa Sala, da suo figlio, dalla Sorella»). Elvira non le apre: non sono sue. Le confronta con la lettera di Marta, che ha in tasca.
- **Che cosa trova**: la stessa carta grezza, la stessa «g» chiusa a ricciolo.
- **Taccuino**: indizio `i_buste` (tecnica): «Ines scrive come Marta. La stessa g, chiusa a ricciolo. La stessa carta.» E sotto (madre): «Sulla Sorella insegneranno a scrivere così.»
- **Ricompensa**: 1 Germoglio.
- **Condizione**: `flag:lente:busta_6 e flag:lente:busta_7 e oggetto:lettera_marta`.

### 8.2 Segreto: la figura che non esce mai (livello 2)

- **Dove**: soglia di Pina (1050, 34,5), di giorno (08:00-18:00), dal giorno 1.
- **Come**: accanto a Pina c'è la scatola dei cartoni, aperta. Guardandoci dentro (interazione «guarda»), fra i Padri, la Sorella e la Santa, c'è una figura che non compare mai in piazza: un **uomo curvo con una ruota sulle spalle**. Si può prendere in mano.
- **Che cosa succede**: Pina, senza alzare la testa, allunga la mano e la riprende. Nessuna parola (`d_pina_figura` ha un solo nodo, senza testo parlato: «Pina riprende la figura e la rimette in fondo alla scatola, sotto le altre.»). Da quella sera l'Ombrista racconta la variante «quello di sotto».
- **Taccuino**: indizio `i_figura`: «Nella scatola di Pina, un uomo con una ruota sulle spalle. Non lo usa mai.»
- **Ricompensa**: la variante della leggenda (nessun Germoglio).
- **Condizione**: `flag:figura_toccata`.

### 8.3 Segreto: la meridiana della Piazza (livello 2)

- **Dove**: dalla valle di fronte. Il punto migliore è il **Crestone dei Ponti** (1046, 127, 101), sulla cresta a Sera del Verbanetto, raggiungibile solo con il volo attraverso il cielo dal Balcone dei Messi. Funziona da qualunque punto delle valli 2 e 3 che veda la piazza da più di 600 m senza passare a meno di 150 m dall'asse (di giorno), o da ovunque alla brace.
- **Come**: appuntare la Piazza delle Ore con lo squadro (cannocchiale ×4). Da lontano il selciato non è una decorazione: le linee delle ore convergono tutte verso il Sordo, e una sola, più scura, punta a un punto preciso della parete, a Lag e a Mane.
- **Taccuino**: indizio `i_meridiana` con uno schizzo: «Le linee della Piazza convergono sul Sordo. Una è più scura: indica un punto della parete. Perché una piazza indica una montagna che non si guarda?» Collegato a `q_sordo`.
- **Ricompensa**: 1 Germoglio. (È la via senza pagine della missione 14.)
- **Condizione**: `flag:appuntato_lontano:2505`.

### 8.4 Indizio facoltativo: chi ha misurato la Cripta

Non è un segreto, ma il primo filo verso S. La Pianta si apre con una striscia a **inchiostro seppia** attorno alla Cripta (le 15 particelle del lato 1-11). Guardandola sulla Pianta, o passando la lente sul chiodo 11 del cippo (graffi freschi sull'ottone), il Taccuino scrive `q_botola` («Chi ha misurato la striscia della Cripta?») e `i_g4` («Inchiostro vecchio, seppia. Firma: G4. Anno 2291.»). La firma G4 tornerà nella missione 5 («G4, Fondo, dispositivo: respinto»).

### 8.5 Easter egg: il Monte Vettore

- **Dove**: l'ultima pagina del libretto di Aurelio, dopo le monografie del Verbano.
- **Che cosa c'è**: una monografia del 2084, scritta quando Aurelio era studente, di un caposaldo sul **Monte Vettore**, con uno schizzo dei Sibillini e una nota a margine: «Nebbia. Il sentiero di ieri oggi non c'era. Rimisurare.» (`libretto.monte_vettore`).
- **Elvira**, la prima volta che la legge: «Avevi vent'anni. Già allora.»
- **Taccuino**: indizio `i_vettore` (nessuna domanda: non porta da nessuna parte).
- **In più**, come scritta d'ambiente nel corridoio della Cripta: a gesso, un tecnico del 2121: «Qui non ci sono torri da scalare. Arrangiati con la carta.» (`scritte.gesso_corridoio`).

---

## 9. Tempi di riferimento

| Blocco | Minuti reali |
|---|---|
| Prologo (P0.1-P0.6) | 7-10 |
| Giorno 1 (M1.1-M1.11, dormendo) | 24-28 |
| Giorno 2 (M1.12-M1.20) | 17-20 |
| Giorno 3 (M1.21-M1.22) | 3-4 |
| **Totale storia** | **51-62** (45 per chi va dritto e non guarda l'Ombrista) |
| Veglia della prima notte (facoltativa) | +10-14 |
| Corbella a colori | +15-20 |
| Balcone dei Messi e volo nell'altra valle | +12-15 |

---

## 10. Criteri di accettazione della Fase 1

1. Il prologo e la missione 1 si completano da una partita nuova senza blocchi, con qualunque scelta: dormire o vegliare, indossare o no il velo, toccare o no la figura, chiudere o no il lato 2-6 per primo.
2. Nessuna notte rende la missione incompletabile: le alternative (guado del Sass, mulattiera) esistono sempre; il simulatore della notte, eseguito in Node su 1.000 partite casuali delle prime tre notti, non trova violazioni delle regole (hub, rifugi, vie, particella di Elvira).
3. Il resoconto del mattino spiega ogni cambiamento in una riga.
4. Il primo rilievo mostra la griglia del foglio e il colore che si allarga dal chiodo, e il cambiamento si vede dalla piazza e dal Balcone dei Messi.
5. Dopo la missione si raggiunge il Balcone dei Messi e si atterra nel Verbanetto o negli Alpeggi, con il capovolgimento lento o la dissolvenza, senza perdere il controllo.
6. I tre segreti e l'easter egg sono raggiungibili e ciascuno lascia la sua voce nel Taccuino.
7. Il Taccuino non contiene mai un'indicazione del tipo «vai a»: solo domande, indizi con la fonte, parole e note.
8. Nessuna icona a schermo durante il gioco.
