# Playtest 2 — dopo la revisione 1

## r2-nuovo-telefono — divertimento 7/10, chiarezza 7/10

In metro si capisce: la mano fantasma mostra il gesto, ogni regola nuova arriva con una nota a margine e una pagina «Nuova». Gli spilli dicono di chi sono. La lampada ha tre gradini e chiede conferma prima del fantasma. Diorami, borbottii e bigliettini scritti a mano hanno fascino. Il bilancio ha conseguenze specifiche. L'Archivio ora si spiega da solo, si può lasciare e Rileggi mostra il merletto finito: è il miglioramento più grosso. I puzzle dell'Atto I restano facili: ho fatto il minimo al primo colpo in g02, g03 e g04, senza mai sentirmi messo alla prova. Gino avanti e indietro è ancora meccanico. Ci sono ancora difetti. La scorciatoia «Fissa fino alle 8» nel prologo porta il giocatore nuovo in un vicolo cieco. Rigiocando dal Telaio, un merletto fallito diventa «nuovo record» sotto il minimo. «Rifai» è quasi invisibile. Il bigliettino di Gino finisce ancora sotto i pulsanti rotondi. Del primo playtest (P001-P018): risolti P001, P002, P004, P005, P006, P007, P008, P009, P010, P012, P013, P014, P018. Parziali P003 (si conferma a gruppi di tre), P015 e P016 (l'ultima scheda è tagliata). Non risolto P011. P017 non verificato.

## r2-puzzle-desktop — divertimento 7/10, chiarezza 5/10

Rispetto al PLAYTEST-1 il salto è netto. Niente più notti da un incrocio e sette "Fissa l'ora": servono da 6 a 15 incroci, e g09 (febbre, Gino a letto che torna a correre appena guarito, Lunardi che cura solo da sopra) e g10 sono veri puzzle in cui le regole si combinano. La lampada ora dice onestamente "queste due richieste non stanno insieme" e avvisa che il fantasma costa il filo d'oro. Ci sono la pagina Comandi, le bolle del vaporetto e "Si compie se fissi l'ora": chiari.

Però un bug di disegno nasconde la perlina di chi porta una sola cosa: voci, segreti, lettere e febbre. Così in g06 ho fallito Zeno alla prima mossa, senza alcuna informazione visibile. Il contagio di g09 e g10 va tenuto a memoria.

La scelta serale è un tranello: in g06 e g08 la coppia impossibile non si deduce dai bigliettini, la notte non permette di cambiare e lasciar cadere conta come fallita. Il secondo gradino della lampada sceglie in silenzio quale richiesta tenere.

La regola nuova di Gino raramente pesa. Il filo d'oro motiva (minimi giusti), ma l'arrivo a ogni notte di «Primo filo d'oro» lo svaluta. Lo comprerei; da appassionato voglio regole sempre visibili.

## r2-atti23-finali — divertimento 7/10, chiarezza 6/10

Volevo sapere come finiva, e mi ha tenuto. Rispetto al playtest 1 l'Atto II insegna bene: pagina «NUOVA» del Libro, nota a margine, rifiuti spiegati («Il filo di Marta è annodato»). La lampada ora dice quando le richieste non stanno insieme. La lettera della nonna all'alba di g14 è una vera scena, e il fascio di g16 commuove. arc3 si chiude con «Uno per sei». I 4 finali sono distinti e veri. A e B ora sono puzzle, C mostra il nodo e il riavvolgimento. D è il miglior puzzle del gioco, con un riscontro chiaro su ogni obiettivo, e l'epilogo racconta proprio le occasioni che ho piantato.
Male: la lampada a volte mente. In g12 dice di lasciar cadere una richiesta fattibile, in g13 ripete un incrocio già fatto. Il bilancio di g21 conta i passi del filo nero come miei. Nell'Archivio gli ultimi due nomi li ho tirati a indovinare. Alcuni testi sul pannello scuro si leggono a fatica, e i Rifai sono invisibili. Il controllo di B e le occasioni di D sono spiegati poco. La ricompensa del finale vero è quasi invisibile. Le notti senza aiuti restano lunghe, ma il ritmo regge.

## r2-editor-extra — divertimento 7/10, chiarezza 6/10

Rispetto al primo playtest il montaggio della storia è molto migliorato:
- la lettera di Clotilde consegnata da Zeno e letta prima del bilancio funziona;
- le 168 lettere, la pace col pane caldo, «quattordici anni e mezz'ora», il nodo di C e il riconoscimento del finale vero arrivano dove devono;
- la calligrafia sta nel foglio;
- l'alba non schiaccia più i culmini.

Da editor severo, però, la storia regge solo sul ramo «buono». Basta fallire o riuscire nell'ordine sbagliato e tornano i buchi:
- la Nina viene ammessa a una scuola a cui non ha mai fatto domanda;
- la Nina parte due volte;
- Don Piero restituisce lettere già restituite e firma, col tu, un biglietto che non è suo;
- il Taccuino celebra una pace che non c'è stata.

La prosa poi si ripete in modo ossessivo: alba, esito e Taccuino dicono la stessa frase tre volte, proprio nei momenti più forti. Molte voci del Taccuino restano vaghe («o… o…») su cose che il giocatore ha appena visto.

Sul telefono al 140% tutto è leggibile e si gioca. Il guaio vero è la lampada: Indizio e Fantasma danno un solo incrocio quando la riga ne vuole due. Seguendoli alla lettera il merletto diventa irrisolvibile e intanto si perde il filo d'oro.

## QA end-to-end

Final run on HEAD 116e167: 280 tests, 27.6 min, 2 workers. Static build with VITE_E2E=1 in the scratchpad (qa-r2/dist), served by vite preview on port 5900 and run with E2E_PORT=5900 E2E_REUSE=1 E2E_DIST=<dist>. The offline test starts its own server on the first free port from 5901 to 5909. Totals: 172 passed, 10 failed, 98 skipped (projects excluded on purpose).
- desktop: 51 passed / 5 failed / 0 skipped
- desktop-hd: 12 / 0 / 44
- iphone: 39 / 3 / 14
- android-piccolo: 35 / 2 / 19
- ipad-orizzontale: 35 / 0 / 21

The 10 failures:
- 8 stable, from 4 real game defects: Gino toast (desktop, iphone), arc1 'Teresa' toast (desktop, iphone), Crediti 'TRAMA' at 140% (iphone, android), 'L'ANNIVERSARIO' at 140% (desktop, android).
- 2 intermittent, on desktop (prologo and audio), from the gesture defect. When re-run alone, prologo, audio and archivio passed 19/19 on desktop, android and iPad.

First run (suite before my changes): 220 tests, 133 passed, 9 failed, 78 skipped.
- desktop 43/1/0, desktop-hd 12/0/32, iphone 29/1/14, android 25/4/15, ipad 24/3/17.
- None of the 9 failures came from a deliberate revision choice. Two of them were 'Test not found' because I rewrote rete.spec.ts while the run was going.

Measurements:
- drag on 6 columns: p95 1.5 ms
- JS heap after 10 days: 8.8 MB
- build JS: 390.7 KB gzip
- golden path: 24 days, 48 requests pinned and all satisfied, 6 Archives mended, C/D/A/B finals played to the end
- story paper: 153 sheets per run


## Segnalazioni

- **Q042** [grave/testo] (contenuti-atti23, r2-editor-extra) Finale vero (D): la Nina parte di nuovo, anche se è partita in g20
- **Q043** [grave/testo] (contenuti-atti23, r2-editor-extra) La domanda d'iscrizione della Nina non parte (g08), ma in g14 arriva l'ammissione
- **Q041** [grave/bug] (motore, r2-editor-extra) Indizio e Fantasma danno un solo incrocio per riga: seguirli porta in un vicolo cieco
- **Q011** [grave/bug] (tombolo, r2-puzzle-desktop) La prima perlina di ogni filo è invisibile: voci, segreti, lettere e febbre di chi ne porta una sola non si vedono
- **Q023** [grave/bug] (tombolo, r2-atti23-finali) g12: la lampada dichiara impossibile la richiesta di Lunardi (fattibile) se la chiedi prima di appuntare il nome, e non si corregge più
- **Q002** [medio/bug] (campagna, r2-nuovo-telefono) Rigioca dal Telaio: un merletto con richieste fallite diventa «Nuovo record: meno incroci», sotto il minimo
- **Q012** [medio/design] (campagna, r2-puzzle-desktop) La coppia incompatibile della sera non si può dedurre (g06, g08) e di notte non si rimedia senza un fallimento
- **Q014** [medio/bug] (campagna, r2-puzzle-desktop) Dopo «Lascia cadere lo spillo» dal gettone, il pannello Bigliettini resta su «In corso» con il pulsante attivo
- **Q026** [medio/accessibilità] (campagna, r2-atti23-finali) Pannello della lettera (alba di g14, fascio di g16): «Nel taccuino» e le sue voci con contrasto 1,8:1 e 3,5:1
- **Q027** [medio/ux] (campagna, r2-atti23-finali) Cassapanca: i pulsanti «Rifai» degli Archivi rammendati sono quasi invisibili (testo crema su carta crema)
- **Q069** [medio/bug] (campagna (src/campaign/controller.ts, toast on quirk:discovered), with tombolo for D04, qa-e2e) A row refused for Gino also produces a banner toast with the quirk text (3 messages for one violation)
- **Q028** [medio/design] (contenuti-atti23, r2-atti23-finali) Archivio 1958: gli ultimi due nomi (Teresa e Bepi) si indovinano a caso; il rammendo si capisce solo con l'indizio
- **Q044** [medio/testo] (contenuti-atti23, r2-editor-extra) g22: Don Piero chiede di restituire lettere che sono già uscite dal pozzo in g16
- **Q045** [medio/testo] (contenuti-atti23, r2-editor-extra) La carta A firmata Don Piero usa il testo di Zeno, col «tu», e Don Piero ha dimenticato Ada
- **Q046** [medio/testo] (contenuti-atti23, r2-editor-extra) g18 fallita: l'alba dice «il nodo resta», il Taccuino festeggia regole sciolte
- **Q047** [medio/testo] (contenuti-atti23, r2-editor-extra) Contraddizioni nella stessa pagina: g22 «senza dire niente», g16 «segreti di Marta al prete», g18 «non era nemmeno colpa mia»
- **Q048** [medio/testo] (contenuti-atti23, r2-editor-extra) Ripetizioni: alba, esito e Taccuino dicono la stessa cosa, anche tre o quattro volte
- **Q049** [medio/testo] (contenuti-atti23, r2-editor-extra) Voci ed esiti che restano vaghi («o… o…») su ciò che il giocatore ha appena visto
- **Q050** [medio/design] (contenuti-atti23, r2-editor-extra) Il perdono di Zeno per la valigia si consuma tre volte (g17, g21, g22)
- **Q024** [medio/bug] (motore, r2-atti23-finali) Bilancio di g21: «18 incroci (minimo 12)» anche con la soluzione ottima; conta gli incroci automatici del filo nero
- **Q071** [medio/bug] (schermi (src/core/input.ts, formerly fondamenta; not touched by the revision), qa-e2e) Gestures are timed by processing time: a main-thread stall turns a drag into a long press (character card); intermittent under load
- **Q001** [medio/ux] (tombolo, r2-nuovo-telefono) Nel prologo «Fissa fino alle 8» porta dritto in un merletto impossibile
- **Q013** [medio/ux] (tombolo, r2-puzzle-desktop) Dopo «non stanno insieme», l'Indizio sceglie in silenzio quale richiesta tenere
- **Q025** [medio/bug] (tombolo, r2-atti23-finali) g13: l'indizio della lampada ripete un incrocio che è già nella bozza invece di dire quello che manca
- **Q051** [medio/ux] (tombolo, r2-editor-extra) Libero: il filo nero entra al Molo alla prima ora e fa uscire Marta in silenzio; gli obiettivi restano «a rischio»
- **Q052** [medio/ux] (tombolo, r2-editor-extra) Merletto del giorno 15/10: la lettera di Marta e la febbre di Bepi non si vedono sul tombolo
- **Q070** [medio/bug] (tombolo (session emits quirk:discovered for an Archive faded thread), with campagna (shows it), qa-e2e) When arc1 opens, a toast reveals that faded thread 2 is Teresa before any name is given
- **Q003** [minore/grafica] (campagna, r2-nuovo-telefono) Cassapanca: il pulsante «Rifai» è crema su carta crema, quasi invisibile
- **Q004** [minore/grafica] (campagna, r2-nuovo-telefono) Sera: la fine del bigliettino di Gino resta sotto i pulsanti rotondi Taccuino e Telaio (P011 ancora aperto)
- **Q006** [minore/bug] (campagna, r2-nuovo-telefono) Intermittente: chiusa la bottiglia di g03 si apre da sola «Andare al tombolo?»
- **Q007** [minore/ux] (campagna, r2-nuovo-telefono) Spostare uno spillo quando sono finiti richiede 4 passi e porta sul bigliettino sbagliato
- **Q008** [minore/grafica] (campagna, r2-nuovo-telefono) Taccuino: la sesta scheda «Archivio» è tagliata dal bordo destro
- **Q010** [minore/design] (campagna, r2-nuovo-telefono) «Si apre qualcosa: Un fuso intagliato (stile 1)» senza dire che cos'è né dove vederlo
- **Q016** [minore/testo] (campagna, r2-puzzle-desktop) Bilancio: «Filo d'oro ✦ (il primo di questa giornata)» e «Primo filo d'oro» dicono la stessa cosa, ogni sera
- **Q020** [minore/ux] (campagna, r2-puzzle-desktop) Schede del Taccuino tagliate a 1440×900: «Lettere» troncata, «Archivio» fuori dal pannello
- **Q031** [minore/grafica] (campagna, r2-atti23-finali) Finali: «Continua» è sovrapposto al pulsante «Merletto chiuso» e copre il bordo del Taccuino
- **Q032** [minore/design] (campagna, r2-atti23-finali) Notti normali: dopo l'ultima ora la scena passa all'alba in meno di un secondo, il merletto finito non si gode
- **Q035** [minore/ux] (campagna, r2-atti23-finali) Telaio: i pulsanti di una giornata aperta in fondo alla lista finiscono sotto il piede fisso e non rispondono
- **Q037** [minore/ux] (campagna, r2-atti23-finali) Schede del Taccuino tagliate senza segno di scorrimento («Archivio» fuori dal pannello)
- **Q039** [minore/testo] (campagna, r2-atti23-finali) g16: «Una bottiglia vuota. Niente lettera.» ma l'immagine mostra una bottiglia con il foglio arrotolato
- **Q053** [minore/bug] (campagna, r2-editor-extra) Il record mescola tentativi con richieste diverse: «12 incroci (minimo 12)» ma «Record: 7 incroci»
- **Q054** [minore/testo] (campagna, r2-editor-extra) «Primo filo d'oro» compare in ogni bilancio, accanto a «(il primo di questa giornata)»
- **Q055** [minore/ux] (campagna, r2-editor-extra) «Chi ricorda Ada»: a 1/3 dice «ricorda», a 2/3 «comincia a dimenticare»
- **Q056** [minore/testo] (campagna, r2-editor-extra) Dopo la pace il Taccuino descrive ancora come attive le stranezze sciolte
- **Q058** [minore/design] (campagna, r2-editor-extra) Fusi intagliati «stile 3» e «stile 4» annunciati come ricompensa ma non selezionabili
- **Q060** [minore/grafica] (campagna, r2-editor-extra) La lettera di Clotilde è in tondo tipografico, non nella sua grafia color seppia
- **Q066** [minore/ux] (campagna, r2-editor-extra) «Nessuna richiesta stanotte.» sopra un elenco di obiettivi
- **Q067** [minore/testo] (campagna, r2-editor-extra) Con il mouse il gioco dice «Tocca…» (prologo, alba, sera)
- **Q075** [minore/ux] (campagna, verificatori-r1) Gli avvisi delle nuove voci del Taccuino durante la notte (stranezze scoperte) coprono le righe basse del merletto su telefono per qualche secondo (g09 alle 12, g16 alle 13, fine di g15).
- **Q073** [minore/bug] (campagna (note cards) and schermi (.core-carta-testo with overflow-wrap: break-word in src/core/ui/base.css), qa-e2e) Marta's g08 note at 140%: 'L'ANNIVERSA / RIO'; still present, and wider with Marta's new uppercase print hand (D15)
- **Q019** [minore/testo] (contenuti-atti23, r2-puzzle-desktop) Alba e Taccuino si contraddicono (g10: il forno; g08: la busta di Nina)
- **Q038** [minore/testo] (contenuti-atti23, r2-atti23-finali) Alba di g11: Marta chiede «chi me l'ha portata? Non la Teresa, spero» anche quando gliel'ha data il Gino
- **Q057** [minore/testo] (contenuti-atti23, r2-editor-extra) g14: dopo la lettera della nonna il bilancio dice ancora «Non dice a chi» di Zeno
- **Q005** [minore/testo] (contenuti-atto1, r2-nuovo-telefono) Matassa: la nota dice «quanto filo resta» ma il contatore conta il filo usato; «1 braccia usate»
- **Q009** [minore/testo] (contenuti-atto1, r2-nuovo-telefono) «Anche lasciarli ha le sue conseguenze», ma il bigliettino lasciato di Don Piero (g01) non ne ha nessuna
- **Q018** [minore/design] (contenuti-atto1, r2-puzzle-desktop) La regola nuova di Gino quasi non incide
- **Q065** [minore/testo] (contenuti-atto1, r2-editor-extra) Coerenza minore: messa delle 11 contro Don Piero in Piazza alle 11 (g01); Gino che «l'ha scritto tre volte» (g05); Zeno al Faro e alla valigia alle 18 (finale A)
- **Q074** [minore/testo] (contenuti-atto1, verificatori-r1) La scheda Persone di Zeno mostra «Desidera: Chiedere perdono a Livia.» la sera di g14, appena si risponde al suo bigliettino, prima della lettera di Clotilde (spoiler).
- **Q059** [minore/grafica] (fondamenta, r2-editor-extra) L'icona «nota» è una nota musicale (♫): usata per regola del giorno, scheda Lettere e biglietti di Livia
- **Q022** [minore/testo] (interfaccia, r2-puzzle-desktop) Merletto del giorno: «Marta — Nessuna stranezza.» anche se Marta ne ha una nota
- **Q036** [minore/ux] (interfaccia, r2-atti23-finali) Il finale vero non dà un riconoscimento visibile: solo una stellina sul Telaio, la Tovaglia mai nominata
- **Q068** [minore/grafica] (interfaccia, r2-editor-extra) Titolo al 140% su telefono: la freccia di scorrimento copre «Crediti»
- **Q015** [minore/bug] (motore, r2-puzzle-desktop) «A rischio» per una richiesta già impossibile
- **Q062** [minore/design] (motore, r2-editor-extra) Con «Spilli velati» la Spinta svela gli spilli nascosti
- **Q076** [minore/testo] (motore, verificatori-r1) La Spinta della lampada può parlare di un evento passato (g04 alle 9: 'Alle otto Bepi esce in barca…').
- **Q077** [minore/design] (regia, verificatori-r1) K7: in 12 notti degli Atti II-III la combinazione più difficile è sopra l'intervallo 'Min' del GDD 5.2: aggiornare la colonna del GDD con i valori misurati; idem g04/g06/g08 e la barca di g04 (esce alle 8, rientra alle 11).
- **Q072** [minore/bug] (schermi (src/screens, formerly interfaccia), qa-e2e) Crediti at 140% on phones: 'TRAMA' breaks mid-word ('TRAM' / 'A'); still present from the previous round
- **Q017** [minore/testo] (tombolo, r2-puzzle-desktop) «Hai lasciato cadere lo spillo rosso»: non dice di chi
- **Q021** [minore/ux] (tombolo, r2-puzzle-desktop) I fili non hanno nome sul tombolo; il motivo «a onde» di Gino sembra lo zig-zag di Bepi
- **Q029** [minore/ux] (tombolo, r2-atti23-finali) Finale B (filo controllato): la modalità non è spiegata e trascinare un altro filo cancella in silenzio l'incrocio di Ada
- **Q030** [minore/ux] (tombolo, r2-atti23-finali) Finale D: nessuna lampada, icone delle occasioni sbiadite sotto i fili, piantarle non dice cosa si è piantato
- **Q033** [minore/ux] (tombolo, r2-atti23-finali) Stati invisibili sul tombolo: chi è annodato (g11) e chi ha la febbre all'inizio (g13) non si vede
- **Q034** [minore/ux] (tombolo, r2-atti23-finali) Richieste «a fine giornata» restano «In corso» all'ultima ora anche con la bozza giusta
- **Q040** [minore/testo] (tombolo, r2-atti23-finali) Finale D: il fallimento di «Almeno 3 fra Teresa, Gino, Bepi, Nina e Zeno…» nomina solo Teresa
- **Q061** [minore/ux] (tombolo, r2-editor-extra) Il Fantasma non chiede conferma prima di togliere il filo d'oro (D07.3)
- **Q063** [minore/ux] (tombolo, r2-editor-extra) Al 140% su telefono il messaggio di rifiuto copre tutta la fascia dei fusi
- **Q064** [minore/grafica] (tombolo, r2-editor-extra) L'apparizione del filo nero in g08 dura meno di un secondo ed è un segmento minuscolo
