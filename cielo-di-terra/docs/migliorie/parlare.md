# Traccia «parlare»: chi parla con Elvira si muove come una persona

Ramo `migliorie/parlare`, partito da `49e41d8` (il brief delle quattro tracce). Lamentela di chi gioca:
«i personaggi si muovono in maniera strana quando parlano».

In breve: all'apertura di ogni dialogo chi parlava **ruotava su se stesso in un fotogramma** (anche seduto
sulla panca) e un quarto di secondo dopo **tornava com'era, di nuovo in un fotogramma**, con la testa
girata di 70° per guardare Elvira; a **una battuta su due faceva un gesto** a scatto (fino a 1200°/s): un
braccio teso rigido verso niente («indica») o la mano al petto **attraverso il busto**; e il petto e la
testa **tremavano** a ogni battuta per un errore nel respiro. Adesso si gira con calma, a passi; il capo fa
piccoli cenni lenti; un gesto morbido ogni tanto (mai con le mani occupate); il respiro è continuo; chi è
seduto o chino resta com'è e gira solo la testa.

Una verifica indipendente (voto 7/10) ha trovato poi quattro cose, una nuova per colpa della prima tornata:
**con Elvira che arriva da dietro la testa guardava dalla parte sbagliata** e, quando il corpo si girava,
attraversava di colpo tutto il collo; nel giro ampio **i piedi strisciavano** all'inizio e alla fine di ogni
passo; **dieci secondi dopo il dialogo** chi aveva parlato voltava le spalle a Elvira anche se lei era ancora
lì; **Clelia spariva in un fotogramma** dopo il dono. Sono corrette tutte e quattro: vedi la sezione
«Seconda tornata», più sotto.

## Seconda tornata: quello che ha trovato la verifica

Ogni difetto l'ho prima riprodotto (una prova in Node sui 13 modelli veri che fallisce sul codice di
`f8a00fc` con i numeri della verifica, e le sequenze del gioco vero della verifica come «prima»), poi
corretto e rifatto nel gioco vero con lo stesso copione: Elvira arriva camminando, si apre il dialogo col
tasto E, si legge e si va avanti con Invio, poi resta lì e infine se ne va (`tools/personaggi/prova-dialoghi.mjs`,
Vite in modo e2e, Chromium SwiftShader, passi fissi di 1/60 s, misure a 60 Hz).

### 1. La testa dalla parte sbagliata (la regressione) — media

**Che cosa si vedeva.** Giorno 2, 15:00, prato del Ronco: Elvira arriva da dietro a sinistra di Ottavio
(110° dal suo avanti). Fino all'apertura del dialogo si vedeva la nuca di Ottavio, girata via da lei; poi,
mentre il corpo si girava, la testa attraversava tutto il collo a 160°/s rispetto al corpo (232°/s nel
mondo, oltre la soglia di 120°/s che ci si era dati per petto, collo e testa). Su tutti i 13 modelli.

**La causa.** In `sguardo()` (animatore.ts) la prima tornata aveva messo, per chi sta oltre 100° dall'avanti,
`yawB = sign(this.yaw.x || _w.x || 1) · limite`: la testa restava sulla spalla da cui era già girata. Se uno
sguardo distratto l'aveva girata dall'altra parte (una volta su due), guardava lontano da Elvira; appena,
girandosi il corpo, Elvira scendeva sotto i 100°, il bersaglio cambiava lato e la molla dello sguardo
correva alla sua velocità massima (160°/s), nello stesso verso del corpo.

**La correzione.**
- La testa guarda **dalla parte di Elvira** (il segno del suo angolo), fin dove può. Solo quando lei è quasi
  dietro la schiena (oltre `CONVERSAZIONE.sguardoDietro` = 155°, cioè a meno di 25° dalla schiena) il lato
  resta quello di prima (isteresi: chi le passa di poco dietro le spalle non fa saltare la testa); se in
  quel momento il corpo si sta girando, il lato è quello verso cui gira, perché è da lì che lei gli comparirà
  davanti. Lo stesso nella figura procedurale di riserva (abitante.ts).
- Il corpo si gira **dal lato della testa**: con Elvira a più di 140° (`rivolgiVerso`) il popolamento chiede
  alla figura da che parte sta guardando (`puntoSguardoPersonaggio`, dalla fabbrica o dalla figura
  procedurale) e, se è l'altra rispetto alla via più corta, fa il giro lungo (al più una ventina di gradi in
  più: `pianoGiro(…, verso)`). Così la testa, già girata verso di lei, non deve mai passare all'altra spalla.
- La molla dello sguardo va al più a **110°/s** (era 160): la testa nello spazio della figura gira quanto lo
  sguardo, e così resta sotto i 120°/s anche quando Elvira passa davvero da una spalla all'altra.

**Dopo.** In Node (`sguardoDaDietro`, Elvira a ±110° e ±150° mentre lui guardava dall'altra parte, 13
modelli): prima la testa all'apertura era a −76° (dalla parte opposta), andava a 163°/s nella figura e
237°/s nel mondo, cambiava spalla su tutti i modelli; adesso è a +71…+72° dalla sua parte, al più 61°/s
nella figura e 75°/s nel mondo, mai dalla parte sbagliata. Col giro lungo (Elvira a 170° dalla parte
opposta alla testa): 58°/s e 75°/s, la testa non cambia spalla. Nel gioco vero, Ottavio al prato: la testa
nello spazio della figura da 163 a 58°/s, il collo da 112 a 40°/s, il petto da 80 a 28°/s; la nuca non si
vede più, il viso è girato verso Elvira già mentre lei arriva (`parlare/testa-da-dietro.jpg`).

### 2. Il giro ampio: i piedi strisciavano — bassa

**Che cosa si vedeva.** Con Elvira alle spalle (160°) il giro dura 3,2 s e ogni passo cominciava e finiva
strisciando: in gioco i piedi a terra arrivavano a 0,6 m/s (Bortolo da dietro), in Node a 165° il 95°
percentile era 0,11-0,26 m/s e il massimo 0,4-0,7 m/s; il piede fermo si torceva fino a 26-31° rispetto al
bacino (un istante a gambe «a forbice»).

**La causa** (misurata fotogramma per fotogramma, `aggiornaGiro`): il piede in aria andava da dov'era a
dove si posava **rispetto al corpo**, a mezzo coseno. Nel fotogramma in cui si staccava e in quello in cui
si posava la sua velocità relativa era zero, cioè nel mondo correva con il corpo che girava (0,3 m/s alla
caviglia, che sta a 21 cm dal centro del giro): appena posato si fermava di colpo. In più si alzava alla
quarta del seno (sotto 1,5 cm per metà del passo, mentre girava già), il primo passo partiva quando il corpo
cominciava appena a girare (senza sapere dove posarsi: il piede restava indietro di 45°) e il punto dove
posarsi era limitato a 0,18 rad, troppo poco per centrare la torsione.

**La correzione.**
- La traiettoria del piede in aria è **nel mondo**: parte ferma da dov'era e arriva ferma dove si posa (il
  punto dove sarà il corpo, previsto con la velocità e l'accelerazione del giro, `giroAcc`).
- Il piede **si alza prima di girare e si posa dopo**: su in un terzo del passo (`passoGiroSu`), gira solo
  fra il 12 e l'88 per cento (`passoGiroGira`), alzata 0,022·H.
- Dove si posa: avanti di metà del giro di un passo (fino a 0,35 rad): girando di continuo i piedi stanno
  fra ±20° rispetto al corpo; il piede a terra **ruota un po' sul posto** (sulla caviglia, il 40 per cento:
  `passoGiroPerno`), così la gamba si torce meno.
- Il passo «per sistemare i piedi» a corpo fermo non parte più quando il corpo comincia appena a girare, e
  l'IK dei piedi girati entra più svelta (finché il suo peso era basso i piedi seguivano il corpo).

**Dopo.** In Node sui 13 modelli: a ±165° piedi a terra al 95° percentile 0,001-0,003 m/s (prima
0,11-0,26), al più 0,02-0,14 (prima 0,39-0,69), torsione piede-bacino 19° (prima 26-27°); a 120°: 0,010-0,022
e al più 0,06-0,14 (prima 0,05-0,13 e 0,42-0,75), torsione 22° (prima 31°); a 75° (il giro di tutti i
giorni): 0,010-0,022 e al più 0,07-0,17 (prima 0,02-0,06 e 0,36-0,63), torsione 24° (prima 32°); gambe al
più 202°/s e 4600°/s² (soglie 320 e 6000). Anche l'IK dei piedi entra più svelta all'inizio del giro (la
molla del peso a k = 14 invece di 7: finché il peso era basso i piedi seguivano un po' il corpo). Nel gioco vero, Bortolo da dietro: piedi a terra durante il giro da 0,125 a
0,006 m/s (95° percentile) e da 0,60 a 0,10 m/s al più; nessun osso oltre i 300°/s
(`parlare/giro-ampio.jpg`). La durata del giro (3,2 s a 160°) non è cambiata: 75°/s di punta, come una
persona che si gira con calma.

### 3. Dopo il dialogo voltava le spalle a Elvira — bassa

**La causa.** `DOPO_DIALOGO.max = 10` (png.ts): dieci secondi dopo la chiusura chi aveva parlato tornava al
verso del suo posto anche con Elvira ferma a 1,8 m; se lei era arrivata da dietro, le voltava le spalle con
un giro di 160° (nel gioco: Bortolo a 30,1 s, Ottavio a 59 s).

**La correzione.** Niente più massimo: resta rivolto a Elvira finché lei gli sta vicino (4,5 m), per quanto
ci resti; torna alle sue cose quando lei si è allontanata da 1,5 s (e non prima di 2,5 s dalla fine del
dialogo). Se lei, ferma, gli è girata attorno (oltre 50° dal suo avanti), si rigira con calma verso di lei;
se gli passa accanto camminando per andarsene la segue solo con la testa. E chi cammina con Elvira alle
spalle (oltre 110°) guarda dove va, invece di voltarsi per tutto il cammino (a meno che non le stia
parlando in quel momento).

**Dopo.** Nel gioco vero, Bortolo e Ottavio restano rivolti a Elvira per tutti i 16 e 11 s in cui lei resta
lì; prima, 10 s dopo la chiusura, cominciavano a voltarle le spalle con lei ancora lì (Bortolo da 160° verso
0°, Ottavio da 104° a 53°). Quando lei se ne va tornano al loro verso (`parlare/giro-ampio.jpg`, il grafico
del giro).

### 4. Clelia spariva dopo il dono — bassa

**La causa.** Appena `d_clelia_dono` risulta finito, `postoDiClelia` dà «via» e `condizioni` la nascondeva
(`mostra(false)`): 0,15 s dopo l'ultima battuta, con la lettera della Madre aperta. Chiusa la lettera, la
novizia non c'era più, mentre la didascalia dice «si inchina appena e se ne va verso la Casa del Velo».

**La correzione.** Se è lì alla Bacheca, Clelia fa un piccolo cenno, aspetta che il dialogo sia chiuso, si
gira con calma (a passi, senza lasciare gli ultimi gradi alla testa: `rivolgiVerso(punto, true)`) e va a
piedi alla Casa del Velo (1 m/s, la via dritta dalla Bacheca alla porta è libera: controllato sui
collisori del paese); arrivata alla porta entra. Il pacchetto non lo tiene più in mano
(`ripostoOggettoPersonaggio`: un oggetto di scena «messo via» resta nascosto anche quando cambia il livello
di dettaglio). Se la si ritrova altrove (un salvataggio, un'altra ora) vale quello che c'era: alla Casa del
Velo dalle 20, nessuno di notte.

**Dopo.** Nel gioco vero, a 1280×720 con l'interfaccia: chiusa la lettera Clelia è ancora lì, poi si gira e
se ne va; a 32 s è entrata nella Casa del Velo (`parlare/clelia-se-ne-va.jpg`).

## Come ho guardato: i provini dei dialoghi veri

`tools/personaggi/provini-parlare.mjs` gioca i dialoghi veri della Fase 1 con la regia (Vite in modo e2e,
Chromium SwiftShader, `window.__GAME__`): mette l'ora e il luogo, porta Elvira di lato rispetto a dove guarda
chi parla (come ci si arriva camminando), apre il dialogo (`regia.dialoghi.richiedi`), va avanti a 2,2 e 4,4 s
e chiude a 6 s. Per 7,5 s salva 8 fotogrammi al secondo **dagli occhi di Elvira** (la camera del gioco) e **di
lato**, e a ogni passo di 1/60 s misura la velocità angolare di ogni osso nello spazio della figura, il giro
del corpo, la testa rispetto al corpo, l'altezza dei polsi, le mani dentro il busto e la quota del bacino.
`tools/personaggi/provini_fogli.py` fa i fogli dei provini, i grafici delle misure e i confronti prima | dopo.
Per il «prima» gli animatori sono invecchiati di 20 minuti di gioco (`a.t += 1200`): chi gioca ci arriva
così, e il tremito del respiro cresce con il tempo.

```
node tools/personaggi/provini-parlare.mjs --out=<cartella> [--solo=bortolo,togna-china] [--procedurale]
python3 -I tools/personaggi/provini_fogli.py <cartella>                     # fogli e grafici
python3 -I tools/personaggi/provini_fogli.py --confronta <prima> <dopo> --uscita <cartella> [--grafici a,b]
```

Le scene: Ottavio in piedi al prato del Ronco (`d_ottavio_incontro`) e seduto sulla passerella del riale
(`d_ottavio_prova`, giorno 3), Togna china alla vasca del lavatoio (`d_togna`), Bortolo sul sagrato con le
mani dietro la schiena (`d_bortolo_1`), Annunciata seduta col bastone a San Vigilio, Pina seduta sulla soglia
con cartone e forbici, Nando con la pietra in mano, Clelia alla Bacheca (dialogo automatico, da 2,6 m e da
16 m), i bambini in piazza (parlano a turno), i velati all'alba che si voltano, un dialogo lungo con Ottavio
(sei battute) e le figure procedurali di riserva (i GLB dei personaggi bloccati).

### Che cosa era strano, personaggio per personaggio (prima)

| scena | che cosa si vedeva |
|---|---|
| **Ottavio in piedi** | all'apertura il corpo gira di 70° in un fotogramma (4230°/s), a 0,3 s torna com'era in un altro; la testa resta girata di 70° e rientra in 1,5 s. Alla prima battuta la mano destra va al petto (a 760°/s) passando 2 cm dentro il busto; alla terza tende il braccio dritto di lato, rigido, verso niente, per 1,6 s, e lo lascia cadere a 680°/s alla chiusura. Petto e testa vibrano (fino a 150°/s) per tutto il dialogo. |
| **Ottavio seduto** (passerella) | ruota da seduto: 61° di colpo all'apertura e indietro a 0,3 s, di nuovo alla chiusura (6,1 e 7,0 s); il braccio «indica» teso da seduto. In più **era seduto nell'acqua del riale**: la quota della seduta veniva dal fondo del riale, non dalle assi della passerella (h = −0,42 m). |
| **Togna china** alla vasca | non gira il corpo (la didascalia dice «Non si gira»), ma alla terza battuta tira fuori la mano destra dalla vasca e la porta al petto **attraverso il busto** (5 cm dentro), la rimette giù a 770°/s alla chiusura; la testa trema a ogni battuta. |
| **Bortolo** (mani dietro la schiena) | giro di 75° in un fotogramma e ritorno a 0,27 s; la mano esce da dietro la schiena e va al petto **passando dentro il corpo** (11 cm); alla terza battuta il braccio teso di lato (1200°/s). Il caso peggiore. |
| **Annunciata seduta** col bastone | ruota di 55° **sulla panca** e torna indietro; la mano sinistra lascia il pomo del bastone a 420°/s. |
| **Pina seduta** (cartone e forbici) | ruota di 45° sulla soglia e torna; alla seconda battuta la mano con le forbici scatta (430°/s). |
| **Nando** (pietra nella destra) | giro di 80° e ritorno; il braccio sinistro teso di lato da 2,2 a 3,8 s, poi giù a 660°/s. |
| **Clelia** (automatico, 2,6 m e 16 m) | non si gira; testa e polsi tremano a ogni battuta (fino a 300°/s alla testa). Alla quarta battuta sparisce (vedi «Che cosa resta»). |
| **bambini** | Lisa gira di 60° di colpo e le braccia scattano (825°/s); Gioanin non si gira affatto. |
| **velati** all'alba | si voltano solo con la testa, piano: niente di strano. |
| **dialogo lungo** con Ottavio | un gesto **a ogni seconda battuta** (mano al petto, indica, mano al petto: il giro fisso `cenno, mano-al-petto, cenno, indica`), ognuno con due picchi da 620-780°/s, e il tremito del petto per tutto il tempo. |
| **figure procedurali** | stesso giro e ritorno di colpo; la testa insegue al primo ordine; alle battute non fanno niente. |

## Le cause (trovate nel codice e misurate)

1. **Il corpo girava di colpo, e un attimo dopo tornava com'era, di colpo.** All'apertura di un dialogo
   `DirettoreDialoghi.mostra` chiamava `Abitanti.voltaVerso` → `ManigliaNpc.orientaVerso`, che assegna lo
   yaw della figura in un fotogramma (70-80° in 1/60 s: 4200-4800°/s). Ma il popolamento riapplica gli
   orari a ogni minuto di gioco (`corbella.ts`: `Math.abs(h - ultimaOra) > 1/60` → `applicaOrario`, cioè ogni
   1,7 s reali) e `colloca`/`collocaVelato` rimettevano sempre lo yaw al verso del piazzamento: chi si era
   girato tornava di scatto com'era, di solito durante la prima battuta (nei provini a 0,27-0,30 s
   dall'apertura), con la testa che restava girata di 70° per guardare Elvira. Chi è seduto (Annunciata,
   Pina, Ottavio) ruotava sul sedile allo stesso modo.
2. **Il respiro tremava a ogni battuta**, tanto più quanto più a lungo si era giocato:
   `resp = sin(t·2π / (respiro·(1 − 0,25·parla)))`, con `parla` che salta da 0 a 1 all'inizio di ogni
   battuta e scende in 3 s. Cambiare il periodo dentro il seno di un tempo `t` grande fa correre la fase
   (a t = 20 minuti la fase corre a ~200 rad/s per tre secondi): il petto, le spalle e la testa, che seguono
   il respiro, vibrano a decine di hertz, che a 60 fotogrammi al secondo è una tremarella.
3. **Un gesto a ogni seconda battuta, veloce, e a volte assurdo.** `annunciaBattuta` sceglieva da un giro
   fisso `['cenno', 'mano-al-petto', 'cenno', 'indica']`, tenuto 1,6 s e sfumato con un inseguimento del
   primo ordine a k = 7 (mezzo gesto in 0,1 s: braccio a 500-1250°/s, e la velocità che parte da zero in un
   fotogramma: 40 000-75 000°/s²). «indica» senza un punto (le battute non ne hanno) tendeva il braccio
   dritto avanti e di lato, rigido, verso niente; la mano al petto passava la linea di mezzo e, da chi
   aveva le mani dietro la schiena (Bortolo) o in grembo, attraversava il busto per arrivarci. I gesti non
   guardavano se le mani erano occupate: Togna china tirava fuori le mani dalla vasca, Pina indicava con
   le forbici, Annunciata lasciava il pomo del bastone.
4. **Il cenno del capo partiva a scatto**: 9° in 0,45 s con un mezzo seno, cioè da fermo a 63°/s in un
   fotogramma (3800°/s²), a ogni battuta.
5. **Lo sguardo inseguiva al primo ordine** (`smorza`, k = 4): quando il punto guardato cambia di colpo (il
   corpo che gira sotto la testa, Elvira che entra nei 9 m) la testa parte alla velocità massima nel primo
   fotogramma; chi aveva Elvira dietro le spalle scattava da una spalla all'altra.
6. **Ottavio seduto nel riale**: `quota()` del popolamento cercava la seduta solo fra i collisori delle case
   e delle panche, non fra quelli del mondo marcati `passerella`.
7. **Le figure procedurali** giravano il corpo nello stesso modo (punto 1) e la testa con lo stesso
   inseguimento (punto 5); la testa si fermava contro un limite netto di 1 rad e da lì girava il petto, di
   colpo.

## Che cosa è cambiato

### Girarsi verso Elvira (src/popolamento/abitanti.ts, src/regia/png.ts, src/personaggi/animatore.ts)

- `ManigliaNpc.rivolgiVerso(punto | null)`: il corpo si gira con un **profilo di velocità** (`pianoGiro`
  / `posizioneGiro`: una cubica di Hermite, velocità continua da ferma a ferma, al più 75°/s e 250°/s²,
  almeno 0,7 s); `null` lo riporta, nello stesso modo, al verso del suo posto. Sotto i 25° gira solo la
  testa (gli ultimi 5° li fa sempre lo sguardo). Chi è seduto o chino non gira il corpo: gira la testa.
- Gli orari (`applicaOrario`, `colloca`, `collocaVelato`) non rigirano più chi è rivolto a qualcuno: il
  verso del posto si ricorda a parte (`yawCasa`) e, se il posto cambia, ci si arriva con lo stesso profilo.
  `orientaVerso` resta immediato per chi viene appena messo in un posto (teletrasporti, scene).
- `Abitanti.voltaVerso` chiama `rivolgiVerso`; i bambini (che parlano a turno) si girano tutti e due; la
  didascalia «Non si gira» (Togna alla vasca) lascia il corpo com'è, ma lo sguardo va a Elvira.
- Finito il dialogo (`DirettoreDialoghi.chiudi` → `Abitanti.fineDialogo`) chi ha parlato resta rivolto a
  Elvira finché lei è lì (entro 4,5 m, senza limite di tempo; se lei, ferma, gli gira attorno si rigira) e
  poi, quando lei se ne va, torna piano alle sue cose (seconda tornata: prima al più 10 s).
  Durante il dialogo (e subito dopo) la guarda anche da lontano (fino a 40 m: il dialogo automatico della
  novizia si apre fino a 25).
- Ottavio che atterra o arriva vicino a Elvira si gira con calma (prima: di colpo).
- I **piedi seguono il corpo a passi** (`aggiornaGiro`/`gambeGiro` nell'animatore): la figura riceve dalla
  fabbrica quanto sta girando (`StatoPersonaggio.giro`, °/s, dallo yaw del gruppo); i piedi restano piantati
  finché lo scarto con il corpo supera 0,15 rad, poi un passo di 0,44 s, alternando i piedi; il bacino si
  abbassa appena (1,4 cm) durante il passo. Senza i passi, con un giro morbido i piedi avrebbero ruotato
  sul posto come su un piatto girevole. (Nella seconda tornata il piede in aria segue una traiettoria nel
  mondo, si alza prima di girare e si posa dopo, e il piede a terra ruota un po' sul posto: vedi sopra.)
- `quota()` del popolamento cerca la seduta anche fra i collisori del mondo marcati `passerella`: Ottavio
  siede sulle assi della passerella del riale, non sul fondo.

### Le battute (src/personaggi/animatore.ts, fabbrica.ts, src/regia/dialoghi.ts)

- `annunciaBattuta(durata)`: la regia passa per quanto si parla (`durataBattuta(testo)`: il tempo in cui
  la finestra scrive il testo e un po' di lettura, fra 1,2 e 6 s).
- **Il cenno del capo**: 7 battute su 10, 3,5-6° (i bambini il 30 % in più), 0,75-1 s, a mezzo coseno
  (velocità nulla ai capi), con un ritardo di 0,08-0,28 s dall'inizio della battuta; due cenni non si sommano.
- **Mentre parla** il capo si muove appena (1,6°, tre seni lenti sul tempo continuo) e il respiro si fa un
  po' più ampio (+30 %), poi tutto si spegne con calma.
- **I gesti**: solo «apre» (la mano libera si apre davanti al ventre, il gomito lungo il fianco) e «mano al
  petto» (sul petto dal suo lato, senza passare la linea di mezzo); «indica» senza un punto non c'è più
  (resta `gesto('indica', …, punto)` per la regia, che il punto lo dà). Un gesto con probabilità 0,4
  (bambini 0,55), mai alla prima battuta, mai a meno di 6 s dal precedente; entra in 0,9 s ed esce in
  1,0 s a mezzo coseno, tiene al più 1,5 s con un battito lento della mano. Le scelte vengono dal seme del
  personaggio: la stessa conversazione fa sempre la stessa cosa.
- **Mani occupate** (`OpzioniAnimatore.maniOccupate`, dalla fabbrica: oggetti in tutte e due le mani, come
  Pina con cartone e forbici): niente gesti. Il gesto si spegne anche se il corpo è chino, cammina, è
  seduto col bastone o con gli attrezzi, ha le braccia conserte o le mani dietro la schiena (Bortolo).
- `fineBattute()` (alla chiusura del dialogo, `fineBattutePersonaggio`): il parlato finisce e il gesto in
  corso esce da solo, morbido (prima restava tenuto fino alla fine dei suoi 1,6 s e poi cadeva a scatto).

### Il respiro e lo sguardo

- Il respiro è una **fase accumulata** (`faseRespiro += dt·2π/periodo`): cambiare il periodo mentre si parla
  cambia la velocità, non la fase. Niente tremito, qualunque sia l'ora di gioco.
- Lo **sguardo è una molla critica** (`molla`, k = 4,5 1/s, al più 110°/s dalla seconda tornata), del
  secondo ordine: parte e arriva con velocità nulla. Con Elvira dietro le spalle la testa si gira dalla sua
  parte, fin dove può, con l'isteresi a 155° (vedi «Seconda tornata»: la prima versione teneva il lato da cui
  la testa era già girata e una volta su due guardava dalla parte sbagliata).
- Le **figure procedurali** (src/oggetti/oggetti/abitante.ts) hanno la stessa molla per lo sguardo e un
  cenno del capo (giù e su a mezzo coseno, 0,85 s) alla battuta. Mentre si girano verso chi parla il
  popolamento le fa camminare sul posto (non hanno i piedi a terra): il peso della camminata e quello dei
  gesti della regia ora salgono e scendono con una molla (prima al primo ordine: fermandosi a metà passo
  gambe e braccia partivano da ferme a 120°/s in un fotogramma); la testa gira fino a ~1 rad con un
  limite morbido (lineare fino a 0,6 rad, poi tanh) e il resto lo prende il petto (con il limite netto la
  testa si fermava di colpo e il petto partiva di colpo).

### Misure e strumenti

- `W` (la rotazione del riposo nello spazio del modello) si normalizza: nei modelli generici, scalati in
  modo diverso in larghezza e in altezza, il quaternione non era unitario (non si vedeva, ma falsava le
  misure).
- `tools/personaggi/provini-parlare.mjs` e `tools/personaggi/provini_fogli.py` (vedi sopra).
- `tests/personaggi/conversazione.ts`: la conversazione simulata in Node, con le misure (sotto).

## Come si regola

Tutto in costanti con un nome, una riga di commento ciascuna:

- `CONVERSAZIONE` in `src/personaggi/animatore.ts`:
  - `gesto` / `gestoBambino` (0,4 / 0,55): probabilità di un gesto a una battuta (mai alla prima, mai con
    le mani occupate o se il corpo fa altro); `fraGesti` (6 s): tempo minimo fra due gesti;
  - `gestoEntra` / `gestoTiene` / `gestoEsce` (0,9 / ≤ 1,5 / 1,0 s): la forma del gesto (mezzo coseno in
    entrata e in uscita: velocità nulla ai capi);
  - `cenno` (0,7), `cennoAmp` (3,5-6°), `cennoDurata` (0,75-1 s): il cenno del capo a inizio battuta;
  - `capo` (1,6°): quanto si muove il capo mentre parla;
  - `respiro` (1,0°) e `respiroParla` (+30 %): l'ampiezza del respiro, un po' più ampio parlando;
  - `sguardoK` (4,5 1/s) e `sguardoVmax` (110°/s): la molla dello sguardo; `sguardoDietro` (155°): oltre
    quest'angolo dall'avanti chi guarda è «dietro la schiena» e il lato della testa ha l'isteresi;
  - `passoGiro` (0,15 rad), `passoGiroDurata` (0,44 s), `passoGiroAlzata` (0,022·H): i passi con cui i
    piedi seguono il corpo che si gira; `passoGiroSu` (un terzo del passo per alzarsi e per posarsi),
    `passoGiroGira` (il piede gira fra il 12 e l'88 per cento del passo, quando è su), `passoGiroAvanti`
    (0,35 rad: quanto avanti si posa al più), `passoGiroPerno` (0,4: quanto il piede a terra ruota sul
    posto con il corpo).
- `GIRO` in `src/popolamento/abitanti.ts` (75°/s, 250°/s², almeno 0,7 s): il giro del corpo intero verso
  chi parla e il ritorno; `pianoGiro`/`posizioneGiro` sono la curva (Hermite, velocità continua).
- La soglia dei 25° sotto la quale gira solo la testa è in `ManigliaNpc.rivolgiVerso`, e lì anche i 140°
  oltre i quali il corpo si gira dal lato della testa (`puntoSguardoPersonaggio`).
- `DOPO_DIALOGO` in `src/regia/png.ts` (`min` 2,5 s, `vicino` 4,5 m, `via` 1,5 s, `rigira` 50°): chi ha
  parlato resta rivolto a Elvira finché lei è entro `vicino`, si rigira se lei, ferma, è oltre `rigira`
  gradi dal suo avanti, torna alle sue cose quando lei è lontana da `via` s. `DIETRO_IN_CAMMINO` (110°): chi
  cammina non si volta a guardarla se lei gli sta così dietro. `CLELIA_VIA` (1 m/s, 1,2 m dalla porta):
  Clelia che se ne va alla Casa del Velo.
- `durataBattuta` in `src/regia/dialoghi.ts`: per quanto «parla» chi dice una battuta (dal testo).

## Le prove

### Prove automatiche nuove

- `tests/personaggi/parlare.test.ts` (21 prove) sui 13 modelli veri (GLB in Node, skinning sulla CPU), con
  la conversazione simulata di `tests/personaggi/conversazione.ts`: Elvira arriva a 75° di lato, il corpo
  si gira con il profilo del popolamento, tre battute, il dialogo si chiude. A ogni passo di 1/60 s, nello
  spazio della figura: nessun osso oltre 220°/s e nessuna accelerazione oltre 3000°/s² (gambe dei passi:
  320°/s e 6000°/s²), petto-collo-testa sotto i 120°/s, mani e avambracci dentro il busto al più 1,5 cm in
  più che a riposo, polso al più 45° dall'avambraccio, gomito al più 150°, testa al più 90° dal petto,
  piedi a terra che scivolano al più 0,12 m/s (95° percentile) e che si alzano davvero (≥ 2 cm). Seduti
  (Annunciata col bastone, Pina, Ottavio, Lisa): bacino fermo entro 1 cm, senza scatti; Togna china: le mani
  restano nella vasca. La figura procedurale: la testa si volta e annuisce senza scatti; i passi sul posto
  del giro cominciano e finiscono senza gradini di velocità (fermandosi a metà passo: prima 120°/s e
  5300°/s², adesso 64°/s e 900°/s²). Il respiro: dopo un minuto o dopo un'ora di gioco le battute muovono
  il petto allo stesso modo.
- `tests/popolamento/girarsi.test.ts` (6 prove) nel paese vero in Node con l'ora che corre come nel gioco:
  Bortolo si gira verso Elvira al più a 75°/s e gli orari, a ogni minuto di gioco, non lo rigirano; finito
  il dialogo torna piano; l'accelerazione è limitata; sotto i 25° gira solo la testa; Annunciata seduta non
  gira e non si alza; Ottavio il giorno 3 sta sulle assi della passerella; `orientaVerso` resta immediato.
- `tests/personaggi/modulo.test.ts`: la prova del cenno riscritta (si vede, ma sotto 1,6 rad/s).

Seconda tornata (tutte falliscono sul codice di `f8a00fc`, con i numeri della verifica):
- `parlare.test.ts`, «Elvira arriva da dietro» (13 + 1 prove, `sguardoDaDietro` in `conversazione.ts`):
  Elvira a ±110° e ±150° mentre la testa guardava dall'altra parte; all'apertura del dialogo la testa è
  dalla sua parte (oltre 55°), non passa mai dalla parte opposta né all'altra spalla, e va sotto i 120°/s
  nella figura e nel mondo mentre il corpo si gira; a 170° col giro lungo dal lato della testa, idem; chi le
  passa dietro le spalle cambia spalla una volta sola, sotto i 120°/s.
- `parlare.test.ts`, «il giro ampio» (13 prove): a ±165° e 120° piedi a terra al 95° percentile sotto
  0,05 m/s e al più 0,25 m/s, torsione piede-bacino sotto i 27°, gambe sotto 320°/s e 6000°/s², petto e
  testa sotto i 120°/s; `conversazione.ts` misura anche la torsione dei piedi.
- `parlare.test.ts`, «Clelia»: il pacchetto si mette via e resta via mentre la figura si anima.
- `tests/popolamento/girarsi-dietro.test.ts` (2 prove, i personaggi veri nel paese vero): Bortolo con la
  testa girata da una parte ed Elvira a 170° dall'altra si gira dal lato della testa (185° invece di 165°)
  e la testa non cambia spalla, sotto i 120°/s. `girarsi.test.ts`: lo stesso per la figura procedurale.
- `tests/regia/catasto-abitanti.test.ts`: finito il dialogo Bortolo resta rivolto a Elvira per 30 s con lei
  lì (prima: a 11 s era già girato di 46°), si rigira con calma se lei, ferma, gli gira attorno, non la
  insegue col corpo se lei gli passa accanto camminando, torna al suo verso quando lei se ne va; Clelia,
  dato il dono, se ne va a piedi (al più 1,15 m/s, nessun salto) ed entra alla porta della Casa del Velo
  dopo più di 20 s (prima spariva dopo 0,5 s).

Sul codice di prima (`49e41d8`, con le stesse prove adattate alle API di allora) falliscono 21 delle prime
25 prove (le quattro che passano sono prove del popolamento che sul codice di allora, senza
`rivolgiVerso`, si riducono a controllare che niente si muova); le due aggiunte dopo (Ottavio sulla
passerella, i passi sul posto della figura procedurale) descrivono difetti misurati sul codice di prima
(h = −0,42 m nei provini; 120°/s e 5300°/s²).

### I numeri, prima e dopo

La conversazione simulata (in piedi, 13 modelli; seduti, 4; Togna china):

| misura | prima | dopo |
|---|---|---|
| osso più veloce, in piedi (esclusi i piedi) | 378-1257°/s | 60-135°/s |
| accelerazione più alta | 19 900-74 000°/s² | 118-908°/s² |
| petto, collo e testa | 163-277°/s | 60-67°/s (la testa che si volta) |
| mano o avambraccio dentro il busto (oltre il riposo) | fino a 10,1 cm (velata), 4,7 cm (Clelia) | 0-0,7 cm |
| polso rispetto all'avambraccio | fino a 35° | fino a 8° |
| piedi che scivolano mentre il corpo gira (95° perc.) | 0,14-0,26 m/s | 0,03-0,09 m/s (passi alti 3-5 cm) |
| seduti: osso più veloce / busto | 357-627 / 159-199°/s | 23-84 / 23-31°/s |
| Togna china: osso più veloce / busto | 701 / 210°/s | 39 / 10°/s |

(Nel «prima» simulato il corpo gira già con il profilo nuovo: il giro di colpo era nel popolamento e lo
misurano i provini e `girarsi.test.ts`.)

I provini del gioco vero (osso più veloce nello spazio della figura, giro del corpo):

| scena | prima | dopo |
|---|---|---|
| Ottavio in piedi | 759°/s, corpo +70° e −70° in un fotogramma | 130°/s (un passo), corpo al più 78°/s, nessun salto |
| Ottavio seduto | 561°/s, corpo ±61° due volte, nell'acqua | 109°/s, corpo fermo, sulle assi |
| Togna china | 774°/s, mano 5 cm nel busto | 40°/s, mani nella vasca |
| Bortolo | 1203°/s, ±75°, mano 11 cm nel busto | 162°/s (un passo), 78°/s, nessun salto |
| Annunciata seduta | 422°/s, ±55° sulla panca | 27°/s, ferma |
| Pina seduta | 430°/s, ±45° sulla soglia | 20°/s, ferma |
| Nando | 660°/s, ±80° | 132°/s (un passo), 78°/s |
| Clelia (2,6 m / 16 m) | 276 / 298°/s (il tremito della testa) | 11 / 111°/s (a 16 m si gira, 42°/s) |
| bambini | Lisa 825°/s, +60° | 133 e 136°/s (passi), 72°/s |
| velati | ≤ 9°/s | ≤ 49°/s (la testa che si volta) |
| dialogo lungo (6 battute) | 781°/s, 35 passi oltre 400°/s, 3 gesti | 138°/s, nessun passo oltre 400°/s, 1 gesto |
| figure procedurali (Ottavio, Bortolo, Togna) | 223-233°/s, corpo ±70-75° in un fotogramma | 98-107°/s (i passi sul posto), corpo al più 78°/s |

Nei provini «mano dentro il busto» è misurata in assoluto: Clelia (mani giunte, 3,6 cm), Pina (1,8-3 cm) e
il velato con la gerla (9 cm) ci stanno già a riposo, prima e dopo, senza parlare.

### I confronti (docs/migliorie/parlare/)

Prima tornata. Ogni foglio: a sinistra prima, a destra dopo; sopra dagli occhi di Elvira, sotto di lato; 4
fotogrammi al secondo; bordo rosso dove nei 100 ms prima un osso ha superato i 400°/s o il corpo i 90°/s.
`misure.jpg` raccoglie i grafici delle misure a 60 Hz di tre scene (Ottavio in piedi, Bortolo, il dialogo
lungo con Ottavio), prima sopra e dopo sotto.

- `ottavio-in-piedi.jpg` (e il primo grafico di `misure.jpg`): il giro di colpo e il ritorno (prima); il
  giro a passi in 1,4 s, la testa che rientra mentre il corpo gira, niente gesti rigidi (dopo).
- `ottavio-seduto.jpg`: prima nel riale e ruota sul posto; dopo sulle assi, fermo, un gesto lento della
  mano alla terza battuta.
- `togna-china.jpg`: prima la mano esce dalla vasca e va al petto; dopo resta al lavoro, gira la testa.
- `bortolo.jpg` (e il secondo grafico di `misure.jpg`): prima giro e ritorno, la mano attraverso il corpo, il braccio teso;
  dopo il giro a passi e le mani dietro la schiena per tutto il dialogo.
- `annunciata-seduta.jpg`, `pina-seduta.jpg`: prima ruotano sul sedile; dopo restano sedute e girano la
  testa.
- `nando-pietra.jpg`: prima il braccio sinistro teso di lato; dopo si gira e resta tranquillo con la
  pietra in mano.
- `bambini.jpg`: dopo si girano tutti e due, a passetti.
- `clelia-lontana.jpg`: da 16 m prima trema e non si gira; dopo si gira piano verso Elvira.
- `ottavio-gesti.jpg` (e il terzo grafico di `misure.jpg`): sei battute; prima tre gesti a scatto (uno ogni due
  battute), dopo un solo gesto alla quarta, lento, e piccoli cenni.
- `velati.jpg`: si voltano solo con la testa, prima e dopo.
- `procedurali.jpg`: Ottavio come figura di riserva (i GLB dei personaggi bloccati): prima giro e ritorno
  di colpo; dopo si gira in 1,4 s con i passi sul posto e la testa che lo precede.

Seconda tornata (`tools/personaggi/prova-dialoghi.mjs` e `prova-clelia.mjs`; «prima» sono le sequenze della
verifica su `f8a00fc`, girate con lo stesso copione; fogli e grafici con `tools/personaggi/prova_fogli.py`):

- `testa-da-dietro.jpg`: Ottavio al prato, Elvira da dietro a sinistra; sopra la testa dagli occhi di Elvira
  (prima la nuca fino all'apertura del dialogo, poi la testa che attraversa il collo; dopo il viso già
  girato verso di lei), sotto il giro del corpo e la velocità della testa (prima 163°/s, dopo 58°/s).
- `giro-ampio.jpg`: Bortolo da dietro (165°); sopra il giro visto di lato (i piedi si alzano e si posano,
  non strisciano), sotto il giro del corpo per tutta la scena (prima, 10 s dopo il dialogo, le voltava le
  spalle con lei ancora lì; dopo resta rivolto a lei finché se ne va) e la velocità dei piedi a terra (prima
  fino a 0,6 m/s a ogni passo, dopo sotto 0,1).
- `clelia-se-ne-va.jpg`: il dono alla Bacheca, a 1280×720 con l'interfaccia; prima, chiusa la lettera,
  Clelia non c'è più; dopo è ancora lì, si gira, cammina verso la Casa del Velo ed entra.

### Le prove di sempre e le prestazioni

- `npm run typecheck`, `npm test` (869 prove, 1 saltata come prima) e `npm run build`: verdi.
- `npm run e2e:fase1`: «prova ok» in 500 s (prologo e missione 1 con i dialoghi veri: Togna, Bortolo,
  Ottavio che atterra, Clelia, la passerella rimessa); le schermate rigenerate in `docs/shots/` non
  sono nel commit.
- **Prestazioni.** Niente geometria, materiali o draw call nuovi: cambia solo il lavoro dell'animatore per
  figura. Un banco in Node (8 personaggi veri in conversazione, 1200 fotogrammi, il minimo di 7 giri, con
  le altre tracce che usavano il computer) dà 7,3 µs per figura e per fotogramma contro 6,6 µs prima: una
  ventina di figure vicine aggiornate a ogni fotogramma costano 0,15 ms su 16,7 (quelle lontane la fabbrica
  le aggiorna di rado, come prima). Le molle fanno un sottopasso ogni 1/60 s, quindi anche a 30 fps il
  costo resta lo stesso per secondo di gioco.

## Che cosa resta

- Le **gonne** (`gonne.ts`) non sono state toccate: nei provini di Clelia, Togna e Lisa seguono il giro e i
  passi senza strappi, anche nel giro con cui Clelia si volta per andarsene (seconda tornata); con i giri
  ampi dei personaggi in gonna (165°) non le ho guardate fotogramma per fotogramma.
- Il **giro ampio** dura ancora 3,2 s a 160° (75°/s di punta, la curva di Hermite): è calmo, ma chi è alle
  spalle aspetta un po' prima di avere davanti la faccia. Si accorcia alzando `GIRO.vmax`; i passi seguono
  (la torsione dei piedi cresce con la velocità: a 75°/s sta entro ±20°).
- Quando Elvira passa davvero da una spalla all'altra di chi la guarda (gli gira dietro), la testa cambia
  spalla una volta, attraversando il collo a 110°/s (circa 1,5 s): è quello che fa una persona, ma è il
  movimento più svelto che resta.
- **Clelia che se ne va** cammina dritta dalla Bacheca alla Casa del Velo (la via è libera dai collisori del
  paese); se Elvira le si mette davanti, il collisore della novizia la sposta, non c'è un giro attorno. Il
  cammino del popolamento gira la figura verso la tappa a 240°/s (qui la novizia è già girata a passi
  prima di partire, ma chi cammina per gli orari o con la regia, come Ottavio, gira ancora così agli
  angoli del percorso).
- Il **pacchetto della Madre**: Clelia lo mette via quando il dialogo risulta finito (la lettera è aperta
  e copre la scena), non c'è un gesto del porgerlo.
- Il velato con la gerla tiene a riposo un polso 9 cm dentro l'ellisse del busto (le mani sulle cinghie):
  non c'entra con il parlare, ma va guardato con le prove di forma.
- I gesti sono due («apre», «mano al petto»): bastano per una conversazione tranquilla; un gesto «indica»
  vero richiederebbe che le battute dicano a che cosa.
- Le figure procedurali di riserva alla battuta fanno solo il cenno, niente gesti; quando si girano
  camminano sul posto (il ciclo della camminata a 0,45 m/s), non hanno i piedi piantati che seguono il
  corpo come i personaggi nuovi, e il loro ginocchio nel ciclo del passo ha ancora un piccolo gomito
  (`max(0, cos)` sullo stinco: ~100°/s che si fermano in un fotogramma).
- I provini sono lenti (dai 5 ai 25 minuti a scena con SwiftShader, secondo quanto è carico il computer;
  le scene di `prova-dialoghi.mjs` anche 20-40): per rifarli conviene `--solo=…`. `clelia-lontana` si gira
  in una pagina nuova (`nuova: true`): dopo il dono della scena `clelia` la novizia non è più alla Bacheca.
