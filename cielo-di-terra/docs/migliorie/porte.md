# Migliorie: porte

Traccia «porte» (ramo `migliorie/porte`), dopo la prova del 16 ottobre:

> «alcune porte che non si vedono e sono incastrate»

**In breve.** Una verifica automatica misura ogni porta del mondo, cioè la soglia sul suolo, lo spazio davanti, il battente in vista, lo sfarfallio e la versione lontana.

| | porte | difettose |
|---|---:|---:|
| Prima | 184 (128 nella versione lontana) | **160** |
| Dopo | 175 (111 nella versione lontana) | **0** |

Le porte che si usano nella Fase 1 sono la Cripta e la botola, il campanile, San Vigilio, il fienile di Ottavio, la Casa del Velo, il mulino, il capanno dei Messi e la casa di Nando. Sono state provate a piedi con i tasti veri, nel browser e in Node. Si vedono, si raggiungono e non tengono fermi sulla soglia. Uscendo dalla botola, invece, si restava chiusi in una fossa: anche questo è stato sistemato.

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
- `gradiniPorta` lavora quando davanti il suolo scende più di 15 cm (`SALTO_GRADINO`). Posa un pianerottolo e una scaletta di lastre di gneiss fino al prato: pedata 32 cm, alzata al più 19 cm, collider `gradino` che si sovrappongono di 2 cm.
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
- **Il limite della verifica.** Gira sul mondo di Node, dove la natura (sottobosco, rocce) ha meno collider che nel browser. Le porte della Fase 1 sono però provate anche nel browser.
