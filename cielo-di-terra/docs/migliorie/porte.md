# Migliorie: porte

Traccia «porte» (ramo `migliorie/porte`), dopo la prova del 16 ottobre:

> «alcune porte che non si vedono e sono incastrate»

**In breve.** Una verifica automatica misura ogni porta del mondo, cioè la soglia sul suolo, lo spazio davanti, il battente in vista, lo sfarfallio e la versione lontana.

| | porte | difettose |
|---|---:|---:|
| Prima | 184 (128 nella versione lontana) | **160** |
| Dopo la prima passata | 175 (111 nella versione lontana) | **0** |
| Dopo la correzione, Node | 176 (112 nella versione lontana) | **0**, anche con la verifica delle scalette |
| Dopo la correzione, browser | 177 | **0** |

Le porte che si usano nella Fase 1 sono la Cripta e la botola, il campanile, San Vigilio, il fienile di Ottavio, la Casa del Velo, il mulino, il capanno dei Messi e la casa di Nando. Sono state provate a piedi con i tasti veri, nel browser e in Node. Si vedono, si raggiungono e non tengono fermi sulla soglia. Uscendo dalla botola, invece, si restava chiusi in una fossa: anche questo è stato sistemato.

La prima passata aveva però creato porte «incastrate» di un altro tipo: scalette di gneiss dentro il muro di una terrazza o dentro la casa di fronte, e file di «denti» bianchi sui pendii di traverso. La correzione, nella sezione qui sotto:
- progetta la scaletta prima di scegliere la porta;
- sposta o gira le case che non hanno posto per la scaletta;
- gira la casupola dei Ronchi e la Casa del Velo, e dà al mulino una scaletta in diagonale;
- fa girare la verifica anche nel mondo del browser.

## Correzione dopo la verifica indipendente

Un verificatore indipendente ha rigiocato il ramo (voto 7/10, «non ancora risolto»). Il grosso della lamentela era sistemato: niente più porte sepolte, zoccoli sopra le porte, casupole senza vano o fosse sotto la botola. Le scalette nuove, però, avevano creato porte «incastrate» di un altro tipo.

### Che cosa aveva trovato
1. **Casupola 0 dei Ronchi**, vicino alla casa di Nando, nella missione 1. La porta guardava valle. La sua scaletta di 13 lastre scendeva 3 m giù per l'alzata del gradone, attraverso il muro a secco della terrazza. Dal prato di sotto si vedeva la scala uscire dalla faccia del muro. Chi camminava verso la porta si fermava contro il muro, 2,3 m più in basso.
2. **Scalette dentro le altre case.** Sei scalette entravano nella casa di fronte o sotto la sua gronda: rustico_15, 21, 22, 29, 30 e 86. Su nove porte, poi, i gradini stavano su un pendio di traverso e da un fianco uscivano come file di «denti» bianchi: il mulino, la Casa del Velo, rustico_86, 64, 67…
3. **Mondo di Node e mondo del browser.** Le prove giravano in Node, ma il paese del browser non è identico. Nel browser c'erano 29 annessi, in Node 32, e qualche casa stava altrove. Una regressione visibile solo nel browser sarebbe passata.
4. **Mulino e Casa del Velo.** Il fianco del pianerottolo era un blocco di pietra alto fino a 1,2 m. Chi arrivava di sbieco dal lato a valle ci sbatteva contro a un metro dalla porta.

E poi: 41 porte avevano scalette, fino a 13 gradini, e nei vicoli stretti le file di blocchi bianchi si vedevano. Davanti a porte e scale mancavano 37 m di muri delle terrazze, tolti a tratti interi.

Tutto è stato riprodotto prima di correggere, con script di prova fuori dal repository:
- le stesse inquadrature del verificatore;
- una mappa dall'alto del suolo, delle case e dei collider attorno a ogni porta;
- lo stesso conto del verificatore (vedi *Prove*).

### Le cause
1. **La scelta della porta non sapeva quanto sarebbe stata lunga la scaletta.** `scegliPorteEScale` guardava solo il metro e trenta davanti alla porta. Le case del paese «a grumo» stanno a file sui gradoni, con un vicolo di 3,2-4,4 m fra una fila e l'altra. Se il davanti di una casa dà sull'alzata, la scaletta scende 2,5-3 m. Servono 4,3 m, e in fondo c'è il muro di dietro della casa di sotto.
2. **I gradini seguivano il suolo più basso di traverso.** Sui pendii di traverso le pedate restavano sotto il prato dal fianco a monte e fuori dall'altro. Ogni blocco tagliato dal pendio diventava un triangolo bianco. La scaletta si fermava comunque dopo 12 gradini, anche se il prato era ancora sotto.
3. **Le casupole e i luoghi non segnavano lo spazio davanti alla porta.** I muri delle terrazze, costruiti dopo, ci passavano sopra. Dove invece lo spazio era segnato (le case), il muro si toglieva per tutto il tratto, fino a 4,2 m.
4. **Il paese dipende dall'ultima cifra di `Math.sin`, `Math.cos` e `Math.pow`.** In Node 22 e nel Chromium delle prove queste funzioni danno risultati diversi nell'ultimo bit: su 2000 valori a caso, `pow` differisce 228 volte, `cos` 77 e `sin` 63. Il paese si costruisce con `hash2` (un seno moltiplicato per 43758) e con molte soglie. Basta un confronto che cade dall'altra parte per far partire diversa la coda delle case, e da lì gli annessi.
5. **Mulino e Velo: il pianerottolo su un pendio di traverso.** Il suolo davanti alla porta del mulino scende di un metro sulla larghezza dei gradini (50%, sulla riva del riale). Quello del Velo scende di 1,4 m, e dopo due metri risale verso la piazza.

### Che cosa è cambiato

**La scaletta si progetta prima di posarla** (`src/popolamento/soglie.ts`)
- `progettaGradini` (e `progettaGradiniMondo`, con la soglia in coordinate mondo) dice dove vanno pianerottolo e gradini, senza costruire niente. La scelta delle porte, gli annessi e i luoghi lo usano per decidere.
- Le alzate sono tutte uguali, al più 21,5 cm, compreso l'ultimo scalino fino al prato. Ogni pedata sta almeno 2 cm sopra il suolo più alto sotto di sé (`SEPOLTO_MAX`): dal fianco a valle si vede la muratura, come nelle scale esterne dei rustici, e da nessun fianco spunta il prato.
- Si sceglie il numero di gradini più piccolo che arriva sul prato senza pedate sepolte e senza che, oltre la fine, il suolo scenda ancora ripido. Al più 13 gradini (`gradiniMax`).
- Il progetto dice se la scaletta va bene (`buona`) e quanto costa (`costo`). Chi sceglie la porta preferisce quella senza gradini o con meno gradini.
- **Versi.** Di serie la scaletta scende dritta davanti alla porta. Per i luoghi su un pendio di traverso (il mulino) può anche scendere a metà larghezza, di lato lungo la facciata o in diagonale (30°, 45°, 60°), da un pianerottolo più fondo. Lì dove sotto c'è un salto di più di 30 cm, il pianerottolo ha un muretto con la copertina.
- **Com'è fatta.** Ogni gradino è una pedata di gneiss caldo spessa 10 cm, che sporge un dito, sopra un blocco di muratura che scende fin sotto il suolo. Prima era un unico blocco di gneiss chiaro, che da lontano faceva una fila di blocchi bianchi. Il pianerottolo sta 1 cm sotto la soglia e 2 cm sopra il suolo più alto: `baseDaPorta` misura ora la striscia larga quanto il pianerottolo (la porta più 25 cm per parte), e sugli spigoli non spunta l'erba.
- **Registro.** `gradiniPorta` segna ogni scaletta nel cantiere (`ScalettaPosata`): pedate, muretti, dove si scende. La maniglia di Corbella le elenca con `scalette()`.
- **Spazio occupato.** `zoneGradini` dà lo spazio della porta e della scaletta, fino a 1-1,3 m dopo l'ultimo gradino. Diventa l'impronta `porta:nome`, che annessi, orti, alberi e muri delle terrazze lasciano libera. `gradiniLuogo` fa le due cose per i luoghi: casupole, mulino, fienile, grà, casa di Nando.

**Le case** (`src/popolamento/luoghi/case.ts`)
- `scegliPorteEScale` progetta la scaletta per ogni lato del fronte. Controlla tutto lo spazio che occupa contro:
  - i muri delle altre case, con mezzo metro per la gronda;
  - le loro lobbie: sul fronte o sul fianco, al primo piano (`piantaRustico` ora dice anche la lobbia);
  - le scale esterne e le scalette delle altre case;
  - i luoghi e i collider già posati.
- Se nessun lato va bene, `spostaCasa` sposta la casa un poco indietro (via dalla porta) o di lato, al più 3 m. Prima prova le distanze più piccole. Il posto nuovo deve essere nella stessa cella abitata, lontano dalle altre case come quando si pianificano, dai luoghi, dai sentieri, dalle visuali, dai punti d'interazione e dalla strada del prologo.
- Se non basta, la casa si gira con la porta verso monte, come le case della corona della piazza, e si riprova.
- Come ultima risorsa la casa non si costruirebbe. Oggi non succede a nessuna.
- Nel mondo di Node: 7 porte cambiano lato, 8 case si spostano, 6 si girano verso monte, nessuna si toglie. La pianta del paese è la stessa: 90 case, nelle stesse celle.
- **Annessi.** Lo spazio libero davanti alla porta comprende la scaletta. Una scaletta che non va bene non si posa: l'annesso prova l'altro lato, o non si costruisce.

**I luoghi**
- **Le casupole dei Ronchi** (`ronchi.ts`) possono girarsi: la porta verso valle come prima, di lato lungo la curva di livello, o verso monte. Si sceglie il verso con la scaletta più corta, che non va contro impronte, luoghi o sentieri. A parità di scaletta vince il verso di prima. La casupola 0 ha ora la porta sul fianco, lungo il gradone, sul prato: niente gradini, e il muro della terrazza davanti è intero.
- **La Casa del Velo** (`case.ts`) si gira un poco, al più 40°, finché davanti alla porta il suolo è quasi in piano. Il fianco alto del pianerottolo costa. Non deve toccare sentieri o luoghi più di prima. Ora guarda 27° a lato della piazza (prima 8° dall'altra parte): quattro gradini, in Node e nel browser, con il fianco al più 30 cm sopra il suolo (prima 1,35 m). Il velo nero e le grate seguono la casa, e anche i punti «apri» e «dormi» sulla porta.
- **Il mulino** (`ronchi.ts`) non si gira: il chiodo 7 sulla soglia deve vedere il campanile e il Sass dal Messo. Il pianerottolo della soglia del chiodo, profondo 1,27 m, resta in piano. Dalla parte a monte ci si sale dal prato senza gradino. La scaletta scende in diagonale (30°) verso il riale: 14 gradini, giù per la riva. Sul fianco del pianerottolo dove sotto c'è il salto c'è il muretto.

**Muri delle terrazze** (`terrazzi.ts`). Davanti a una porta, alla sua scaletta o a una scala esterna il muro si apre: il tratto si spezza in due e resta il varco, senza togliere tutto il tratto. Le giunture degli altri tratti restano dove erano, e così i varchi dei sentieri.

**La verifica nel browser.** Le differenze fra Node e browser non si tolgono senza riscrivere seno, coseno e potenze di tutto il motore. Allora la verifica gira anche nel browser, sul paese di chi gioca:
- `window.__GAME__.regia.verificaPorte()` (build di sviluppo ed E2E) dà il riassunto e l'inventario delle porte (`inventarioPorte`);
- `npm run e2e:fase1` la chiama appena il gioco è pronto, ed esce con errore se una porta è difettosa;
- `scripts/porte-a-piedi.mjs` usa l'inventario del browser e cammina anche di sbieco (±40°). Se dritti non si arriva, prova come farebbe chi gioca: prima al piede della scaletta, poi su. Con `--tutte` cammina fino a tutte le porte a terra;
- `scripts/porte-schermate.mjs --dal-browser` fotografa le porte dove stanno nel browser.

### La verifica estesa (`src/popolamento/verificaPorte.ts`)
Tre difetti nuovi, controllati su ogni scaletta del registro:

| difetto | regola |
|---|---|
| `gradini_ostruiti` | sopra il pianerottolo o un gradino, fino a 1,7 m, o nel metro dopo l'ultimo gradino, c'è un collider che non si calpesta: il muro o il tetto di un'altra casa, il muro di una terrazza. Oppure un gradino cade nell'impronta di un altro edificio |
| `gradini_sepolti` | una pedata sta sotto il suolo, da un fianco, più di 2 cm. Il pianerottolo, sul suo spigolo a monte, fino a 12 cm |
| `gradini_sospesi` | dall'ultimo gradino al prato c'è più di 30 cm |

Due correzioni alla verifica:
- le persone (Pina sulla sua soglia) non contano come ostacolo;
- con la scaletta di lato o in diagonale, lo spazio davanti si guarda solo sul pianerottolo, e il resto lo controlla la verifica della scaletta.

### Come si regola
| che cosa | dove | valore |
|---|---|---|
| alzata massima (anche l'ultimo scalino) | `soglie.ts` `ALZATA_MAX` | 21,5 cm |
| gradini al più | `soglie.ts` `GRADINI_MAX`, opzione `gradiniMax` | 13 (il mulino 16) |
| pedata sopra il suolo più alto | `soglie.ts` `SEPOLTO_MAX` | almeno 2 cm |
| pianerottolo sotto la soglia | `soglie.ts` `PIANEROTTOLO_TOP` | 1 cm |
| pianerottolo dei versi di lato | `soglie.ts` `PIANEROTTOLO_LATO` | 1,1 m |
| versi provati | opzione `versi` (`VERSI_TUTTI` per i luoghi in pendio) | solo dritta |
| salto che vuole il muretto | `soglie.ts` | 30 cm |
| spazio libero dopo la scaletta | `case.ts` `OLTRE_PORTA`, luoghi e annessi | 1,3 m, 1 m |
| gronda delle altre case | `case.ts`, `scegliPorteEScale` | 0,5 m |
| spostamento massimo di una casa | `case.ts`, `spostaCasa` | 3 m indietro, 1,5 m di lato |
| giro del Velo | `case.ts`, `costruisciCasaVelo` | al più 40° |
| soglie della verifica | `verificaPorte.ts` `GRADINO_SEPOLTO`, `PIANEROTTOLO_SEPOLTO`, `ULTIMO_SCALINO` | 2 cm, 12 cm, 30 cm |

### Prove
**Riproduzione.** Sul codice di partenza della correzione (4580845) uno script di prova fa lo stesso conto del verificatore:
- gradini visibili dentro un altro collider: **7 porte**. Sono la casupola 0, nel muro della terrazza; rustico_15, 21, 22, 29 e 86, dentro la casa di fronte o sotto la sua gronda; e rustico_30, contro la casa di sotto;
- pedate sepolte da un fianco e fuori di più di 25 cm dall'altro, i «denti»: **9 porte**;
- 41 porte con la scaletta, 296 gradini, 21 scalette di 8 o più gradini.

Le schermate prima della correzione, con le inquadrature del verificatore, sono a sinistra nelle schermate 16 e 17. La verifica estesa non poteva girare su quel codice, perché le scalette non erano nel registro. A metà lavoro, con le scalette già progettate ma le case ancora al loro posto, trovava 12 porte difettose: 8 con i gradini ostruiti e 6 con i gradini sepolti.

**Dopo.**

| | porte | difettose | con la scaletta | gradini | scalette di 8 o più gradini |
|---|---:|---:|---:|---:|---:|
| prima della correzione, Node | 175 | 0 (senza la verifica delle scalette) | 41 | 296 | 21 |
| dopo, Node | 176 | **0** | 30 | 115 | 6 |
| dopo, browser | 177 | **0** | 29 | 107 | 5 |

I gradini sono le pedate sotto il pianerottolo; la prima passata non aveva pianerottolo.

Con lo stesso conto del verificatore, dopo:
- gradini dentro altri collider: nessuno. Lo script segnala solo il mulino, perché trova il suo muretto, che fa parte della scaletta;
- «denti»: nessuno.

Le scalette di 8 o più gradini sono:
- il mulino, 14, giù per la riva;
- rustico_60, 13, sull'alzata di un gradone, con il vicolo libero sotto;
- rustico_59, 10;
- rustico_82, 9;
- un annesso, 9: è annesso_20 nel browser e annesso_21 in Node, perché i due mondi numerano gli annessi in modo diverso.

In Node c'è anche annesso_16, con 8 gradini. Nel browser quell'annesso non c'è.

**Prove automatiche**
- `tests/popolamento/porte.test.ts`: da 13 a 22 prove.
  - Nessuna scaletta ostruita, sepolta o sospesa.
  - Le scalette lunghe: nessuna oltre 13 gradini (il mulino 16), al più 8 porte oltre 7 gradini.
  - Ogni pedata sopra il suolo.
  - Le casupole dei Ronchi senza scalette lunghe.
  - Il mulino con la scaletta di lato e il muretto.
  - I muri delle terrazze non spariscono: più di 2600 m.
  - La Casa del Velo, il mulino e il fienile raggiunti da 4 m di sbieco (±40°), dritti o passando dal piede della scaletta, con il controller vero e alla quota della soglia.
- `npm run typecheck`, `npm test` (64 file e 864 prove passate, 1 file e 1 prova saltati; erano 855 prove) e `npm run build`: verdi.
- `node scripts/porte-a-piedi.mjs --no-build`, nel browser con i tasti veri, dice «porte a piedi: ok»:
  - verifica delle porte nel browser: 177, nessuna difettosa;
  - fuori dalla botola con W ed E, al muretto in 17,6 s, alla botola da 8 parti su 8;
  - le 7 porte della Fase 1 da 7 m dritti e da 4 m a ±40°, tutte fino alla soglia (resta al più 0,43 m, quota da −0,13 a +0,13 m), e indietro. Il mulino da +40° ci arriva passando dal piede della scaletta, da −40° dritto. La Casa del Velo da tutte e due le parti, dritta.
- `npm run e2e:fase1`: «prova ok in 316 s». All'inizio la verifica delle porte nel browser dice 177 porte, nessuna difettosa. Dopo la botola resta «camminato: fiato 0.43, luoghi —».

**Mondo di Node e mondo del browser.** Uno script di prova confronta `Math.sin`, `cos`, `pow`, `exp` e le altre funzioni su 2000 valori, in Node 22 e nel Chromium delle prove. Differiscono solo `pow`, `cos` e `sin`, nell'ultimo bit. Il paese resta un poco diverso:
- nel browser 32 annessi, in Node 34;
- qualche casa spostata di qualche centimetro, rustico_89 di 28 m.

Per questo la verifica gira in tutti e due i mondi.

### Prestazioni
Draw call e triangoli (`__GAME__.getStats()`, Media, 960×540, ore 10), stesse inquadrature prima e dopo la correzione:

| vista | draw call prima → dopo | triangoli prima → dopo |
|---|---|---|
| piazza | 167 → 167 | 1 255 350 → 1 250 101 |
| campanile | 184 → 186 | 1 350 458 → 1 361 955 |
| Ronchi | 151 → 151 | 913 065 → 914 420 |
| vicoli con le scalette | 153 → 153 | 1 199 480 → 1 197 103 |
| paese da 150 m | 209 → 209 | 1 891 620 → 1 888 158 |
| paese da 350 m | 214 → 214 | 1 606 015 → 1 607 410 |

I triangoli del paese, in Node, vanno da 1 013 247 a 1 012 190. I collider di Corbella da 3451 a 3314: le pedate davanti alle porte sono 115 invece di 296, più 30 pianerottoli e qualche muretto. Muri delle terrazze:
- in Node 2643 → 2658 m (su main erano 2680);
- nel browser 2647 → 2667 m (su main 2684).

### Schermate (`docs/migliorie/porte/`)
| file | che cosa mostra |
|---|---|
| `16-scalette-correzione.jpg` | Prima e dopo la correzione, con le stesse inquadrature del verificatore. La casupola 0 con la scaletta dentro il muro della terrazza; rustico_15, 86, 21 e 29 visti dalla soglia, con le scalette dentro le case di fronte e i «denti». Dopo, al loro posto il prato o il muro intero. |
| `17-mulino-velo-correzione.jpg` | Il mulino: prima i gradini sepolti dal fianco a monte, dopo la scaletta in diagonale verso il riale, con la muratura sotto le pedate. La Casa del Velo: prima il fianco del pianerottolo alto più di un metro, dopo la casa girata, con la porta (e il velo nero) che scende sul prato con quattro gradini bassi. |

### Che cosa resta
- **Il riempimento erboso dietro i muri delle terrazze** è un piano alla quota della testa del muro (`terrazzi.ts`). Dove il gradone di sopra non è in piano, dal vicolo si vede il suo bordo nell'aria, alla fine di un tratto di muro. Ora i tratti davanti alle porte si spezzano invece di sparire, e qualche fine di tratto in più si vede. Non è un difetto delle porte, e il riempimento è di tutto il paese: lo lascio com'è.
- **Il mondo di Node e quello del browser** restano un poco diversi. Renderli uguali vorrebbe dire scrivere a mano seno, coseno e potenze per tutto il motore (terreno, `hash2`). Intanto la verifica gira anche nel browser, nell'e2e.
- **La casupola 0, la Casa del Velo e sei rustici sono girati**, otto rustici spostati. La pianta del paese è la stessa, ma qualche facciata guarda a monte invece che a valle.
- **Orti e alberi da frutto.** Le case spostate prendono qualche posto: in Node gli alberi da frutto degli orti passano da 20 a 17 (su main erano 23), gli orti restano 19. Gli annessi invece tornano da 32 a 34 (su main 38).


---

Le sezioni da 1 a 7 raccontano la prima passata (commit 4580845). Dove la correzione ha cambiato qualcosa, c'è un rimando alla sezione qui sopra.

## 1. Che cosa non andava, e perché

### L'inventario
Prima nessuno sapeva dove fossero le porte: i generatori le disegnavano e basta. Ora ogni generatore che ha una porta la dichiara come `PortaOggetto` in `src/oggetti/tipi.ts`, con questi dati:
- il centro della soglia sul filo del muro;
- la normale;
- larghezza e altezza;
- dove sta il battente rispetto al muro;
- su che cosa poggia la soglia: suolo, scala o lobbia.

I generatori che dichiarano porte sono `rustico`, `annesso`, `fienile`, `campanile`, `chiesa`, `casupola`, `mulino`, `grà` e `capanno`.

I cantieri le portano in coordinate mondo come `PortaPosata`, e la maniglia di Corbella le elenca:
- `porte()`, varianti degli elementi mobili comprese;
- `porteLontane()`, le porte disegnate nel dettaglio lontano.

### La verifica (`src/popolamento/verificaPorte.ts`)
Gira in Node sul paese vero (`installaCorbella` sul banco dei test), in circa 2 secondi. Per ogni porta controlla:

| difetto | regola |
|---|---|
| `sotto_terra` | il suolo visivo (LOD 0), o una lastra, sta più di 15 cm sopra la soglia, fra 0,15 e 0,7 m davanti |
| `sospesa` | appena fuori (0,15-0,3 m) il suolo, o il pianerottolo, sta più di 15 cm sotto la soglia, o nel metro e sessanta davanti c'è un salto più alto di un gradino (26 cm) |
| `contro_pendio` | a 1,2 m davanti il suolo sale più di mezzo metro |
| `ostruita` | nel metro e venti davanti c'è un collider (muro, annesso, scala, tronco, panca…) che non è un gradino o una lastra alla quota della soglia |
| `dentro_impronta` | lo spazio davanti cade nell'impronta di un altro edificio, di un orto o di un albero |
| `coperta` | 9 raggi diretti al battente da 1,4 m incontrano altro prima del battente, entro 0,8 m dal muro: lo zoccolo, il muro di un annesso, il terreno… |
| `sfarfallio` | sul battente c'è un'altra superficie a meno di 1,2 cm, sullo stesso piano |
| `lod` | la casa ha una versione lontana, ma la porta lì non c'è o sta a più di 60 cm (la prova chiede meno di 30) |

I raggi attraversano le mesh cotte dei cantieri (il dettaglio vicino), con un indice dei soli triangoli attorno alle porte. La versione lontana si controlla con le porte che vi sono disegnate.

Le porte delle lobbie (`appoggio: 'balcone'`) e quelle in cima alle scale esterne (`'scala'`) hanno regole loro: la ringhiera della lobbia non è un ostacolo, e il suolo è il pianerottolo.

La porta della Casa del Velo è coperta apposta dal velo nero dei contenuti (`PORTE_VELATE`).

### Prima: 184 porte, 160 difettose
La verifica finale è stata fatta girare anche sul codice di partenza, con il solo registro delle porte aggiunto e la geometria invariata.

| difetto | porte |
|---|---:|
| sfarfallio | 119 |
| lod | 62 |
| coperta | 54 |
| sotto_terra | 39 |
| ostruita | 13 |
| contro_pendio | 6 |
| sospesa | 3 |
| dentro_impronta | 1 |

Le porte erano 146 dei rustici, 26 degli annessi, 5 delle casupole, 2 delle grà, e una ciascuno per campanile, chiesa, mulino, fienile e capanno.

### Le cause

1. **La base delle case era il suolo più basso della pianta, meno 12 cm.** La porta sta sempre sul davanti. Sul paese «a grumo», tutto a gradoni, le case con il davanti a monte avevano la porta sepolta:
   - la corona della piazza: `rustico_0`, `rustico_1` e `rustico_2` da 2,8 a 3,0 m;
   - la Casa del Velo 2,2 m;
   - il fienile di Ottavio 1,9 m, con il fieno del portellone a filo d'erba;
   - la casa di Nando 3,2 m: del prato usciva solo il tetto di frasche.

   Lo stesso valeva per la casupola 0 dei Ronchi, per la grà di Pian e per il mulino. Il mulino aveva mezza porta sepolta e l'altra metà sospesa, perché il suolo scende di traverso.
2. **Zoccoli che coprivano le porte.**
   - Lo zoccolo del campanile sporgeva 10 cm anche davanti alla porta e ne copriva il primo metro e venti: si vedeva solo l'arco.
   - Quello della chiesa copriva gli 80 cm più bassi del portale.
3. **Le casupole avevano il nucleo del muro pieno.** La porta stava 15 cm dentro il filo, e da fuori si vedeva un muro senza porta.
4. **Cose davanti alle porte.**
   - Annessi addossati con il muro, o la legnaia, a meno di un metro da una porta.
   - Scale esterne che finivano contro la casa vicina o davanti a una porta.
   - Tratti di muro a secco delle terrazze sulla soglia.
   - Alberi e orti.
   - Una panca della piazza a 80 cm dalla porta di una casa della corona.
5. **Sfarfallio.**
   - Le bandelle di ferro stavano 5 mm davanti al battente.
   - Il battente delle porte appoggiate sporgeva 3 cm dal muro.
   - Con near 0,3 e far 6000 la precisione della profondità è circa z²/5·10⁶: a 150 m bastano 5 mm per sfarfallare.
   - La porta della versione lontana delle case era un piano a 2 cm dal muro.
6. **Versione lontana sbagliata.** La porta lontana stava sempre al centro del fronte, mentre quella vera era spesso a un lato. Al cambio di dettaglio, a 310 m a Media, la porta saltava di un metro e mezzo.
7. **Edifici sospesi.**
   - La grà del Muraglione stava alla quota del ripiano, con la porta 3,4 m sopra il prato.
   - Il capanno dei Messi stava 6,2 m dietro il centro del Balcone, che è profondo 7 m: fuori dal ripiano, appeso 5,3 m sopra il pendio e con la porta contro il parapetto.
8. **Porte che non si leggevano.** Il battente di assi grigie delle casupole e del capanno non aveva una superficie dichiarata. La superficie dedotta dal colore era la pietra, e la porta sembrava un pezzo di muro.

   La verifica non lo vede: l'ha visto la passeggiata nel browser.
9. **La botola aperta.** Da chiusa la botola è una lastra calpestabile. Da aperta toglieva il suo unico collider, e il ripiano di lastre attorno non ne aveva (`collider: false`).

   Restava una fossa di 70 cm fra i muretti di sostegno, e `esciDallaBotola` posava Elvira proprio lì. Tutte le e2e precedenti lo dicevano senza saperlo: dopo 9 s di W verso il muretto la riga era sempre «camminato: luoghi botola, castagno_morto». La prova si salvava con il teletrasporto di `usa('muretto')`.
10. **Borgate segnaposto (`src/scene/village.ts`).** La porta partiva dalla base della casa, 60 cm sotto il punto più basso della pianta, ed era un quadrato a 3 cm dal muro.

## 2. Che cosa è cambiato

### Soglie e gradini (`src/popolamento/soglie.ts`, nuovo)
- `suoloPorta` misura il suolo attorno alla soglia: la striscia da 25 cm dentro il muro a 0,9 m fuori, larga quanto la porta più un palmo per parte.
- `baseDaPorta` mette la soglia 3 cm (`SOPRA_SOGLIA`) sopra il punto più alto di quella striscia. I muri scendono fin sotto il suolo più basso della pianta (`interrataPer`).
- `gradiniPorta` lavora quando davanti il suolo scende più di 15 cm (`SALTO_GRADINO`). Posa un pianerottolo e una scaletta fino al prato: pedata 32 cm, collider `gradino` che si sovrappongono di 2 cm. Nella prima passata i gradini seguivano il suolo più basso di traverso, con alzate fino a 19 cm e al più 12 gradini. Dopo la correzione la scaletta si progetta prima di posarla (`progettaGradini`, vedi sopra): alzate uguali fino a 21,5 cm, pedate sopra il suolo, pedate di gneiss su blocchi di muratura.
- `oggettoSullaSoglia` fa le due cose per un generatore qualsiasi: misura la porta, calcola la base, ricrea l'oggetto con l'interramento giusto.

### Case (`src/popolamento/luoghi/case.ts`, `src/oggetti/oggetti/rustico.ts`)
- **Due passate.** Prima si pianificano tutte le case, con le stesse regole, lo stesso ordine, le stesse piante e le stesse estrazioni di prima. Poi `scegliPorteEScale` sceglie la porta e la scala, e alla fine si posano.
  - La porta va a destra o a sinistra del fronte, nelle case larghe almeno 5,6 m.
  - La scala esterna va sul fianco destro, su quello sinistro, o non c'è.
  - Il criterio è che davanti non ci siano il muro di un'altra casa, un collider o un luogo, e che la soglia stia il più possibile alla quota del suolo.
- `rustico` ha tre opzioni nuove: `latoPorta`, `latoScala` e `senzaScala`. Le estrazioni del seme restano tutte, quindi il resto della casa non cambia. `piantaRustico(opz)` dà porta e scala senza costruire la casa.
- La porta in cima alla scala sta a 1,35 m dallo spigolo invece di 1,0: i cantonali lunghi entravano nella luce della porta.
- `posaRustico` mette la base dalla porta, posa i gradini e registra davanti alla porta e alla scala le impronte `porta:nome` e `scala:nome`.
- **Annessi.** Lo spazio davanti alla porta, 1,3 m, non deve toccare case, scale, altri annessi, luoghi o collider. Se lo tocca la porta passa all'altro lato del davanti; se non basta, l'annesso non si posa. La soglia sta sul suolo più alto, come nelle case, e un annesso non sale più di 1,2 m sopra il suo punto più alto. `rettLibero` controlla anche le impronte `porta:`/`scala:`, con il teorema degli assi separati (`src/popolamento/rettangoli.ts`, nuovo).
- **Muri delle terrazze** (`src/popolamento/terrazzi.ts`). Un tratto che passa davanti a una porta o a una scala non si costruisce, tutto intero. Le altre giunture restano dove erano, e così i varchi dei sentieri: la prova `sentieri-a-piedi` è ancora verde.

### Generatori
- `dettagli.ts`
  - `porta()`: battente spesso 10 cm a filo del muro, quindi sporge 5 cm. Le bandelle stanno 1,5 cm davanti al battente.
  - `portaIncassata`: le bandelle stanno 1,5 cm davanti al battente, prima erano a 5 mm.
  - Tutte e due restituiscono la `PortaOggetto`, e c'è `descriviPorta`.
- `campanile.ts`: lo zoccolo è in pezzi. Sul davanti è a filo del muro e sporge solo ai lati del vano, con due stipiti di pietra e la soglia. La porta ad arco sta a 5 cm dal muro.
- `edifici.ts`
  - Chiesa: lo zoccolo è a filo della facciata dietro il portale.
  - Casupola: il nucleo ha il vano vero (1,0 × 1,9 m), con l'architrave di legno, la soglia di pietra e il battente di assi dichiarate come legno. Quando il muro della porta manca, nella casa di Nando smontata, la porta resta appoggiata nel vano con la scritta.
  - Capanno: telaio scuro, bandelle, anello, assi di legno dichiarate e l'asse sopra l'architrave. Prima lì c'era un vuoto di mezzo metro.
  - Mulino e grà dichiarano la loro porta.
- `fienile.ts`: c'è l'opzione `scivolo`. Il fienile di Ottavio, ora con il retro due metri più in basso, non ha più la rampa appesa nel vuoto.
- `forme.ts`: nella versione lontana di case e annessi la porta è una lastra di 0,95 × 1,9 m che sporge 10 cm, dove sta quella vera (`portaU`). Le legnaie non ne hanno.

### Luoghi
- **Casa di Nando** (`mobili.ts`): sale sul gradone di sopra. Si sposta verso la porta, al più di 4,5 m, finché la pianta è quasi in piano. La soglia sta sul prato e ci sono i gradini; anche l'orto dei Ronchi si sposta di 2,5 m.
- **Casupole dei Ronchi, mulino, grà di Pian e fienile di Ottavio** (`ronchi.ts`, `capisaldi.ts`): soglia sul suolo davanti e gradini dove scende.
- **Grà del Muraglione** (`terrazze.ts`): al piede del Muraglione, con la porta sul prato.
- **Capanno dei Messi** (`capisaldi.ts`): sul retro del Balcone, dentro il parapetto, con la porta verso il Balcone.
- **Piazza** (`piazza.ts`): la terza panca va a −30° invece di −35°.
- **Botola** (`cripta.ts`, `castagno.ts`, `corbella.ts`)
  - Il ripiano della botola ha il suo collider calpestabile.
  - Da aperta la botola ha `colliderBotolaAperta()`: le quattro lastre del telaio, calpestabili, e il vano chiuso da un ingombro alto un metro. Non ci si cade dentro; nella Cripta si scende con «Scendi nella Cripta».
  - `apriBotola` scambia i due gruppi di collider.
- **Borgate segnaposto** (`village.ts`): la porta parte dal suolo davanti ed è una lastra che sporge 12 cm.

### Strumenti
- `npx tsx scripts/verifica-porte.ts [--json=…] [--tutte]` stampa l'inventario, il riassunto e le porte difettose. Con `--json` scrive anche l'inventario completo con l'inquadratura di ogni porta e i punti a 7, 3 e 0,6 m davanti.
- `node scripts/porte-schermate.mjs --json=… [--tutte] [--id=…] [--ora=…]` fa una schermata di ogni porta segnalata, o di tutte. È la build E2E con Chromium headless, guardata da 4,5 m all'altezza degli occhi.
- `node scripts/porte-a-piedi.mjs [--no-build]` gioca la partita vera:
  - esce dalla Cripta con la scala, W ed E;
  - va a piedi dalla botola al muretto;
  - torna alla botola da cinque metri, da otto parti;
  - poi, per ogni porta della Fase 1, parte a 7 m (3 m per il capanno), cammina con W fino alla soglia e torna indietro. Del campanile controlla anche il bersaglio.

  Fotografa tutto di giorno e di notte. Esce con 1 se qualcosa non va.

## 3. Come si regola
| che cosa | dove | valore |
|---|---|---|
| tolleranza della soglia sul suolo | `verificaPorte.ts` `TOLLERANZA_SOGLIA` | ±0,15 m |
| spazio libero davanti | `verificaPorte.ts` `SPAZIO_DAVANTI` | 1,2 m |
| soglia sopra il suolo più alto | `soglie.ts` `SOPRA_SOGLIA` | 3 cm |
| dislivello che chiede un gradino | `soglie.ts` `SALTO_GRADINO` | 15 cm |
| pedata / alzata massima | `soglie.ts` `PEDATA`, `ALZATA` | 32 / 19 cm |
| spazio davanti alla porta di un rustico (impronta `porta:`) | `case.ts` | 1,8 m di traverso, 1,3 m più i gradini |
| spazio davanti alla porta di un annesso | `case.ts` | 1,3 m |
| quanto un annesso può salire sopra il suo suolo più alto | `case.ts` | 1,2 m |
| battente / bandelle | `dettagli.ts` | +5 cm dal muro / +1,5 cm dal battente |
| porta lontana | `forme.ts` | lastra di 10 cm |
| porte velate apposta | `verificaPorte.ts` `PORTE_VELATE` | `casa_del_velo:porta` |

## 4. Prove
- `tests/popolamento/porte.test.ts` (nuovo, 13 prove)
  - **Inventario.** Ogni generatore con una porta la dichiara. Ogni casa e ogni annesso hanno la porta anche nella versione lontana, a meno di 30 cm.
  - **Verifica.** Nessuna porta difettosa, e le soglie a terra stanno a ±15 cm dal suolo.
  - **Punti d'interazione.** Nessun punto `apri:`/`entra:`/`dormi:` sta dentro un muro.
  - **A piedi, con il controller vero.**
    - Campanile, fienile di Ottavio, Casa del Velo, San Vigilio, mulino e capanno: da 6 m (3 per il capanno) fino alla soglia, alla quota della porta ±30 cm, e indietro senza restare incastrati.
    - La botola: dal muretto del belvedere, dalla fine della strada della Cripta e da almeno 4 direzioni su 8.
    - Uscendo dalla botola aperta non si cade fra i muretti, e si arriva al muretto.

    Sul codice di partenza quest'ultima prova fallisce: si scende a 45,50 m, nella fossa, contro i 46,01 m richiesti.
- `tests/popolamento/corbella.test.ts`: la prova della botola diceva «aperta, nessun collider». Ora dice «chiusa la lastra; aperta il telaio e il vano chiuso».
- `npm run typecheck`, `npm test` (64 file e 855 prove passate, 1 file e 1 prova saltati, come prima) e `npm run build`: verdi.
- `node scripts/porte-a-piedi.mjs`: «porte a piedi: ok».
  - Fuori dalla botola con W ed E.
  - Al muretto in 17,6 s.
  - Alla botola da 8 parti su 8.
  - Le 7 porte della Fase 1 dalla partenza alla soglia (resta da 0,23 a 0,43 m, quota da −0,13 a +0,13 m) e indietro.
  - Dalla soglia del campanile il bersaglio è «porta_campanile».
- `npm run e2e:fase1`: «prova ok in 772 s». Dopo l'uscita dalla botola, al passo «P0.4 Camminare» (9 s di W verso il muretto), la riga ora è «camminato: fiato 0.43, luoghi —»: Elvira cammina e si allontana. Prima era sempre «fiato 1.00, luoghi botola, castagno_morto»: era ferma nella fossa.

## 5. Prestazioni
Draw call e triangoli (`__GAME__.getStats()`, Media, 960×540, ore 10), stesse inquadrature prima e dopo:

| vista | draw call prima → dopo | triangoli prima → dopo |
|---|---|---|
| piazza | 130 → 130 | 1 156 160 → 1 133 330 |
| campanile | 131 → 131 | 1 271 832 → 1 255 075 |
| Ronchi | 143 → 143 | 1 012 203 → 1 008 608 |
| paese da 150 m | 253 → 255 | 1 833 968 → 1 814 357 |
| paese da 350 m (lontano) | 249 → 250 | 1 191 176 → 1 189 606 |

Il paese ha 1,7% di triangoli in meno: 1 030 720 → 1 013 247, perché ci sono 6 annessi in meno. I collider sono 251 in più (3215 → 3466): sono i 296 gradini nuovi e il ripiano della botola, meno i muri e i tetti dei 6 annessi, 4 scale esterne, 3 alberi e qualche tratto di muro a secco.

## 6. Schermate (`docs/migliorie/porte/`)
Ogni schermata è la build E2E con Chromium e SwiftShader, a qualità Media, alle ore 9:30, all'altezza degli occhi, da 4,5 m davanti alla porta e 0,8 m di lato. Le coppie mettono a sinistra il codice di partenza e a destra quello nuovo.

| file | che cosa mostra |
|---|---|
| `01-campanile.jpg` | Lo zoccolo copriva il primo metro e venti della porta; ora è a filo, con stipiti e soglia. |
| `02-san-vigilio.jpg` | Lo zoccolo sul portale. |
| `03-casa-del-velo.jpg` | La porta era sepolta 2,2 m; ora c'è la soglia con i gradini, e il velo nero dei contenuti. |
| `04-fienile-ottavio.jpg` | La stalla era sepolta 1,9 m, con il fieno a filo d'erba; ora la porta è sul prato. |
| `05-piazza-corona.jpg` | Le case della corona della piazza avevano la porta 3 m sotto il selciato. |
| `06-scala-esterna.jpg` | La scala esterna finiva contro la casa vicina; ora sta sull'altro fianco. |
| `07-annesso-davanti.jpg` | Una legnaia davanti alla porta; ora la porta è libera, con i gradini. |
| `08-gra-muraglione.jpg` | La grà stava sospesa sul ripiano; ora è al piede del Muraglione. |
| `09-capanno-messi.jpg` | Il capanno era fuori dal Balcone, contro il parapetto; ora è sul Balcone, di legno, con il telaio della porta. |
| `10-mulino.jpg` | Porta mezza sepolta e mezza sospesa; ora soglia e gradini. |
| `11-casupola-ronchi.jpg` | Il nucleo pieno nascondeva la porta; ora c'è il vano vero. |
| `12-casa-nando.jpg` | La casa era sepolta nel gradone; ora sta sul gradone di sopra. |
| `13-botola.jpg` | La botola da dentro, dove la si spinge con E, e da fuori aperta: il telaio si calpesta e il vano non inghiotte. Viene da `porte-a-piedi.mjs`. |
| `14-porte-fase1-notte.jpg` | Le porte della Fase 1 di notte, da 7 m, prese durante la passeggiata. |
| `15-tutte-le-porte-sepolte-o-coperte.jpg` | Mosaico prima/dopo delle 68 porte che avevano un difetto visibile da vicino. Le altre 92 sfarfallavano o mancavano solo nel dettaglio lontano. |

Il giro del paese all'altezza degli occhi copre di giorno tutte le 160 porte segnalate, prima e dopo, con `porte-schermate.mjs`. Di notte, alle 22, copre le porte della Fase 1 e dieci case del nucleo, dei Ronchi e delle grà, con una prima versione di `porte-a-piedi.mjs`. Nel nucleo si vedono le lanterne a braccio e le finestre accese accanto alle porte. Alla grà di Pian e al Muraglione le porte sono scure ma si leggono. Due inquadrature da 12 m, `rustico_43` e `casupola_1`, finiscono contro una casa o fuori campo, come di giorno nelle viuzze.

Le 160 porte segnalate prima hanno ciascuna la sua schermata prima e dopo, e si rifanno con gli script. Non sono nel commit, perché sono più di 300 file.

```
npx tsx scripts/verifica-porte.ts --json=…            # sul codice da fotografare
node scripts/porte-schermate.mjs --json=… [--tutte]
```

Nelle viuzze più strette, sotto i 4,5 m, la camera della schermata finisce dentro la casa di fronte, e si vede un muro. Queste porte sono 14, fra le 68 del mosaico, e sono state rifatte da 2,2 m. Da lì 12 si vedono intere, con la soglia e i gradini. Le altre due stanno in cima alla scala esterna (`rustico_5` e `rustico_71`): a 2,2 m la camera è sospesa accanto alla scala, dentro la falda di un tetto vicino, e dal pianerottolo (1,3 m) si vedono intere. La verifica, del resto, controlla la vista di ogni porta da 1,4 m.

## 7. Che cosa resta
- **I cancelli.** Il brief li mette fra le porte della Fase 1, ma nel mondo della Fase 1 non ce n'è nessuno. Il «Cancello dei Pellegrini» è solo un luogo dei contenuti, a z 1500, θ 88,5, nella zona `finestra_ponti`, senza geometria; `creaCancello` della libreria non è posato da nessuna parte. Quando verrà costruito, dovrà dichiarare la sua porta e passare dalla stessa verifica.
- **Inventario cambiato.** Le porte sono passate da 184 a 175:
  - 4 rustici hanno perso la scala esterna (e la porta in cima), perché non c'era posto su nessuno dei due fianchi;
  - 6 annessi non si posano più, perché ognuno avrebbe coperto una porta o avrebbe avuto la sua contro un muro.

  La pianta delle 90 case non è cambiata.
- **Dalla botola al muretto, e ritorno.** Dalla botola si scende al muretto a piedi. Per tornare dal muretto alla botola in linea retta, invece, ci sono i gradoni del versante: circa 4,5 m di dislivello in due salti, senza scale lì. Si torna con la strada della Cripta, provata nei test. Una scaletta fra il belvedere e la botola sarebbe un lavoro del percorso, non delle porte.
- **Versione lontana.** Oltre i 300 m sfarfallano ancora un poco le finestre della versione lontana: le cornici sono a 5 mm e i vetri a 12 mm dal muro. Le porte no. È fuori traccia.
- **Casa di Nando smontata.** La porta appoggiata nel vano è una scelta di regia da confermare.
- **Il limite della verifica.** Nella prima passata girava solo sul mondo di Node, che non è identico a quello del browser. Dopo la correzione gira anche nel browser: `regia.verificaPorte()`, l'inizio dell'e2e, `porte-a-piedi.mjs` e `porte-schermate.mjs --dal-browser`. Vedi la sezione della correzione.
