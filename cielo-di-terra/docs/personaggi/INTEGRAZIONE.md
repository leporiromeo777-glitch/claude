# Personaggi nuovi nel gioco: l'integrazione

I tredici modelli della Fase 1 ([PIPELINE.md](PIPELINE.md), ramo `personaggi/asset`) e il modulo di gioco ([MODULO.md](MODULO.md), ramo `personaggi/modulo`) sono collegati al gioco vero sul ramo `personaggi/integrazione`. Da ora gli abitanti di Corbella sono i modelli dipinti, con il materiale del mondo; dove un modello manca resta la figura procedurale di prima.

![il gioco vero con i personaggi nuovi: Togna al lavatoio, Ottavio in volo e a terra, Annunciata e Bortolo a San Vigilio, i bambini, Nando, Clelia, Pina, la piazza all'alba e di sera](gioco/tutte.jpg)

## Cosa cambia nel gioco

Pochi file del gioco, in punti piccoli e commentati. Tutto il resto sta in `src/personaggi/**`, `tests/personaggi/**`, `tools/personaggi/**` e `docs/personaggi/**`.

| dove | cosa |
|---|---|
| `src/main.ts`, `boot()` | (revisione finale) `precaricaPersonaggi(...)` parte appena caricati i caratteri, insieme al motore (se la pagina se ne va a metà, le richieste si interrompono e niente si analizza); prima di `installaCorbella` `collegaMotorePersonaggi({ uniforms, camera })` e l'attesa dei modelli, **al più 20 s** («la gente di Corbella», dallo 0,86 allo 0,90 della barra); dopo, `preriscaldaPersonaggi(renderer, camera)` (texture e programma sulla GPU). I 13 GLB si scaricano in parallelo, una volta sola. Senza indice o senza file non fallisce: la gente resta procedurale. |
| `src/main.ts`, `onQualita` | (revisione finale) le distanze dei personaggi seguono la qualità (`impostaDistanzePersonaggi`). |
| `src/popolamento/abitanti.ts`, `crea()` | `obj = creaPersonaggio(id, aspetto) ?? creaAbitante(aspetto);` |
| `abitanti.ts`, `update()` | per i modelli nuovi la posa (seduto, chino) passa nello stato e `posaOssa` non tocca le loro ossa: le sue rotazioni sono pensate per le ossa della figura procedurale (e per l'osso `radice`, che i modelli non hanno). Dalla revisione finale passano anche il luogo e, da seduti, il **profilo del suolo** (`profiloSeduta`: le quote con le panche ogni 10 cm lungo la direzione in cui la figura guarda, una volta per posto); `quota(z, θ, panche)` non conta più due volte il ripiano della chiesa sotto la panca. |
| `abitanti.ts`, `accessori()` | la pietra di Nando viene dall'indice (in mano) e non si aggiunge la seconda; anche il lume di Ottavio (dalla revisione finale: `lume@bacino` dell'indice; quello procedurale solo per la figura di ripiego). Il Velo da planata resta nel gruppo, `png.ts` lo trova per nome come prima; ha la barra di comando e i montanti che salgono fuori dalle spalle. |
| `abitanti.ts`, `PIAZZAMENTI` | (revisione finale) Togna al lavatoio sul lastricato davanti alla vasca. |
| `src/regia/png.ts`, `src/regia/dialoghi.ts` | (revisione finale) a ogni battuta `abitanti.battuta(chi)`: chi parla annuisce e gesticola. |

Una figura nuova si riconosce da `gruppo.userData.personaggio` (l'id del modello).

## Cosa viene dall'indice dei modelli

`public/personaggi/indice.json` (scritto da `tools/personaggi/indice.py`) ha più campi di quelli che il modulo leggeva. Ora `leggiIndice` (`src/personaggi/schede.ts`) legge anche:

- **`curvo`**: per i personaggi con un nome vale quello scelto in produzione sul modello (Annunciata 0,55, Pina 0,45); per i generici vale almeno quello (l'anziano con la maschera 0,35). Prima il modulo lo ricavava solo dalla postura procedurale.
- **`oggetti`**: gli oggetti di scena `nome@osso` di `src/personaggi/oggetti.ts`, attaccati dalla fabbrica nella posa di riposo: forbici e figura di cartone di Pina, pacchetto di Clelia, pietra di Nando, gerla dei velati che l'avevano (`gerla: true`; il generico con la gerla veste anche chi ha solo il cappello e quelli restano senza), cesto a metà delle donne velate con le mani libere. Il bastone resta quello della fabbrica, che va da terra alla mano (Annunciata, l'anziano con la maschera). Gli oggetti prendono il materiale del mondo, uno per colore, condiviso.
- **`proporzioni: "bambino"`**: passo e respiro dei bambini.

Le schede di riserva in `schede.ts` (senza indice) hanno ora gli stessi valori dell'indice (Pina 1,52, Annunciata 1,56, Lisa 1,25).

Le due versioni di «voce dell'indice» dei due rami restano entrambe: `VoceIndice` (`indice.ts`, la forma completa, per le pagine di prova) e `VoceModello` (`schede.ts`, la lettura tollerante che usa il gioco).

## Il gioco non cambia

- **Posizioni e presenze**: identiche. `tests/personaggi/integrazione.test.ts` monta due Corbella, una senza modelli e una con i 13 modelli registrati, e per otto momenti della Fase 1 (dall'alba del giorno 1 al giorno 3) controlla che ogni abitante sia presente o assente e nello stesso punto (z, θ, h).
- **Cilindri nel mondo**: stesso raggio (0,3 m, `aggiornaCollider`) e stessa base. L'altezza del cilindro è `ingombro.altezza`, che ora è quella della figura che si vede. Differenze rispetto alla figura procedurale:

  | | procedurale | nuovo |
  |---|---|---|
  | Pina | 1,68 | 1,52 |
  | Togna | 1,74 | 1,62 |
  | Clelia | 1,78 | 1,68 |
  | Lisa | 1,14 | 1,25 |
  | Gioanin | 1,17 | 1,12 |
  | Ottavio, Bortolo, Nando, Annunciata | 1,54-1,81 | entro 2 cm |
  | velati | 1,54-1,78 | 1,60-1,75 (±4%) |

  Il cilindro resta alto almeno 1 m: per i passi di Elvira e per gli urti non cambia nulla. Se un giorno servisse l'altezza di prima al centimetro, basta che `aggiornaCollider` usi un'altezza fissa per id.
- **Dialoghi e storia**: stessi punti «parla» (stanno a 1,3 m sopra la posizione, non dipendono dalla figura), stessa regia. La partita automatica `npm run e2e:fase1` passa con i modelli nuovi.
- **Ripiego**: in Node i modelli non ci sono e tutti i test del popolamento girano con le figure procedurali; nel browser `node tools/personaggi/gioco.mjs --procedurale` blocca le richieste a `personaggi/` e il gioco parte con le figure di prima (le schermate di confronto qui sotto). La Madre e Rosa, che non hanno un modello, restano procedurali anche oggi.

## Ritocchi fatti guardando il gioco

(Al tempo dell'integrazione; le voci 1 e 2 sono state rifatte nella revisione finale, più sotto.)

1. **Seduti più su**. Con la quota delle anche della figura procedurale (0,5 m dall'origine) la panca di Annunciata e i gradini dell'Ombrista tagliavano le cosce: le vesti dei modelli hanno spessore. Le anche stavano a 0,5 m più il 5% dell'altezza. Ora la seduta viene dal profilo del suolo (revisione finale, voce 1).
2. **Ottavio in volo si tiene al Velo**. Con il Velo da planata visibile le mani vanno sulla barra (`StatoPersonaggio.mani`, `PRESA_VELO` in `fabbrica.ts`); prima le braccia pendevano sotto l'ala. Ora anche il corpo è appeso e inclinato (revisione finale, voce 11).
3. **Oggetti in mano dall'indice**, con il materiale del mondo (vedi sopra).

Guardati e lasciati come sono:
- **Scala**: Bortolo davanti al portale di San Vigilio, i bambini accanto a Togna, Clelia alla bacheca: le altezze della Bibbia stanno bene con porte, bacheche e lampioni.
- **Piedi**: sul selciato, sul prato, sulla soglia di Pina, sulla pietra davanti al lavatoio. Nessuno affonda.
- **Orientamento**: tutti guardano dove dicono i piazzamenti (Togna verso il campanile, la gente all'alba verso la Linea).
- **Luce**: di giorno i colori caldi delle texture reggono accanto alle case; prima dell'alba e alla sera dell'Ombrista i personaggi si leggono in blu-viola, come nel bozzetto `finale-5`, grazie al riempimento del modulo.
- **Livelli di dettaglio**: il passaggio LOD0 → LOD1 a 25 m non si nota (sotto, lo stesso velato a 23,5 e a 27 m, ingrandito tre volte); l'isteresi di 2 m evita che sfarfalli sul confine.

![LOD0 a 23,5 m e LOD1 a 27 m, ingranditi tre volte](gioco/lod-confronto.png)

## Revisione finale (ramo `personaggi/finale`): i problemi, uno per uno

Le due revisioni (artistica e tecnica) dopo l'integrazione, ogni voce con quello che si è fatto e come si controlla. Le misure sono sui 13 modelli veri, caricati in Node con lo skinning sulla CPU (`tests/personaggi/forma.test.ts`, le soglie; `MISURE=tutti npx vitest run tests/personaggi/misure.test.ts --reporter=verbose`, i numeri); le pose si guardano nel laboratorio (`node tools/personaggi/laboratorio.mjs --scatti=seduti:fianco:2,terra:tre-quarti:2,…`, scene `in-piedi conserte giunte dietro seduti soglia terra chino cammina volo gesti`) e nel gioco (`node tools/personaggi/gioco.mjs`).

![le pose nel laboratorio (Togna, Pina, Annunciata, Clelia, Bortolo, Nando): seduti su un gradino di 0,45 m, per terra, braccia conserte, mani dietro, chini, camminata](finale/pose.jpg)

### Problemi alti e medi (revisione artistica)

| # | problema | cosa si è fatto | come si controlla |
|---|---|---|---|
| 1 | **Pose sedute rotte**: gonne a lastra con l'orlo sfilacciato che bucava i gradini, sedere sotto la seduta, piedi appesi | La seduta non è più «anche a 0,5 m»: il popolamento passa il **profilo del suolo** davanti e dietro alla figura (`profiloSeduta` in `abitanti.ts`, panche comprese; corretto il ripiano della chiesa contato due volte sotto la panca di Annunciata) e `sedute.ts` trova lo spigolo: anche sul sedile (+6% dell'altezza per le vesti), ginocchia oltre lo spigolo, piedi sul piano sotto (o stinchi a piombo se non ci arrivano). Senza spigolo vicino: **per terra**, gambe incrociate (calzoni) o distese avanti (vesti lunghe). Le **gonne da sedute** hanno un secondo insieme di pesi (`gonne.ts`: sotto l'anca la stoffa segue coscia e stinco del suo lato), scambiato con la geometria quando la figura è seduta: vale per ogni materiale e per l'ombra. Correzioni per posto in `CORREZIONI` (Annunciata girata di 27° verso la piazza; Pina sulla soglia, sedile 0,40) | `forma.test.ts`: seduti su un gradino di 0,45 m nessun modello ha più dello 0,2% dei vertici 12 cm dentro il gradino, strappi visibili ≤ 0,5% degli spigoli; per terra nessuna scarpa sotto il suolo. `modulo.test.ts`: anche alla quota del sedile, per terra, profili. Gioco: [Annunciata](gioco/annunciata-san-vigilio.jpg), [Pina](gioco/pina-soglia.jpg), [gradini dell'Ombrista](gioco/gradini-ombrista.jpg) |
| 2 | **Frammenti**: la «lama» del velato col cappuccio, dita sospese | Pipeline: **pesi plausibili** (un osso di arto vale solo nel suo tratto e vicino alla sua catena), **pesi ammorbiditi** fra vicini, per il cappuccio `braccia_morbide` (la regola di omero e gomito più larga). Il cappuccio tiene solo le mani giunte (`bracciaVietate`: con le braccia conserte o dietro il mantello si strappava). La **macchia scura sulla schiena** del cappuccio era il guscio interno del mantello che usciva da quello esterno in posa (pesi diversi): `gusci` gli dà i pesi del guscio esterno; le facce che la decimazione fa con le UV interne si girano e si ridipingono (`macchie_3d`); il materiale non scurisce più le facce con l'avvolgimento al contrario (normale geometrica, non `gl_FrontFacing`) | `forma.test.ts` (strappi in piedi ≤ 0,5%). Raggi verso la schiena del cappuccio fermo (una griglia di 11×10 fra 0,94 e 1,3 m): 10 colpivano per prime facce interne, ora nessuno; su tutta la figura, da quattro lati, 3 raggi su 2266. [Prima e dopo](finale/cappuccio.jpg) |
| 3 | **Braccia conserte da zombi**: braccia tese avanti, mani fuori dal petto | IK con un limite di estensione per posa (`ESTENSIONE_POSE`: conserte 0,7, giunte e dietro 0,84) e il davanti del busto misurato solo sui vertici del busto (`fronteBusto`, al più 7 cm davanti al petto), la schiena per le mani dietro (`retroBusto`) | `forma.test.ts`: conserte ≤ 0,75 della catena tesa (misurato 0,70-0,72; prima quasi 1), giunte e dietro ≤ 0,86 (0,66-0,84; la mano sul bastone 0,85-0,87, esclusa) |
| 4 | **Piedi che pattinano** | La fase del passo avanza con la **distanza percorsa davvero** dal gruppo (`avanzamento`), appoggio 60% con la punta ferma e il tallone che si alza nell'ultimo quarto, alzata in volo almeno 7% dell'altezza (9% i bambini), il bacino scende quanto serve perché la gamba arrivi | `forma.test.ts`: le suole a terra (entro 8 mm) scivolano meno di 0,08 m/s (Togna 0,02; tutti 0,005-0,05, Clelia 0,07 con le scarpe corte sotto la veste; prima 0,1-0,2), alzata ≥ 6% dell'altezza (misurata 13-17 cm) |
| 5 | **Fusione con la grafica nuova** | `grafica/luce` e `grafica/post` sono nel ramo: il materiale usa `shadeLit` di `common.ts` (riceve le ombre portate), le ombre di `ombre.ts` si disegnano con `overrideMaterial`, che three compila con lo skinning (seguono la posa). La notte e il controluce rifatti (voce 12) | `node tools/personaggi/compila.mjs` (compila); schermate nel gioco |
| 6 | **Stile non a campiture** | Pipeline: le **campiture** (macchie via, bordi tenuti, ombre cotte dimezzate, 8 toni per personaggio con tre quarti verso il tono, trama a pennello), volti di Nando e Ottavio per tre quarti com'erano | [scheda del cast](scheda-cast.jpg), schermate |
| 7 | **I veli di Bortolo e del velato con la gerla sembrano capelli lunghi** | Le strisce chiare e scure della texture (le ciocche) spariscono nel filtro e nei toni: il velo diventa una stoffa a due toni | [Bortolo sul sagrato](gioco/bortolo-sagrato.jpg) |
| 8 | **Macchie bianche** | Texel fuori dalle isole presi dall'isola vicina (mai lo sfondo bianco), macchie chiare piccole ridipinte | scheda, laboratorio |
| 9 | **La folla si ripete** | I quattro generici prendono una **variante** dal seme: tutta la figura gira di tinta (±20°), saturazione (±15%) e luce (±12%), e ogni **stoffa** un po' di più per conto suo (±8°): il colore della texture più vicino a uno degli 8 toni della tavolozza dice di che stoffa è, e i toni della stessa stoffa (tinta e luce vicine) girano insieme — la prima versione girava ogni tono per conto suo e le gonne venivano a chiazze, come una mimetica ([i gradini dell'Ombrista](gioco/gradini-ombrista.jpg)). La gerla solo a chi l'aveva, il cesto a metà delle donne con le mani libere | `modulo.test.ts` (la stessa stoffa gira tutta insieme, stoffe diverse no); [la piazza all'alba](gioco/piazza-alba.jpg) |
| 10 | **Togna non lava** | Piazzamento sul lastricato del lavatoio, 20 cm dal bordo della vasca (prima era 2,6 m indietro, china sul niente); da china il bacino va indietro e giù e le mani vanno nella vasca e strofinano (`maniAlLavoro`) | `integrazione.test.ts` (china: la testa avanti); [Togna al lavatoio](gioco/togna-lavatoio.jpg) |
| 11 | **Ottavio vola dritto, coi montanti dentro il corpo** | Appeso al Velo: corpo avanti di 24° con un dondolio, gambe indietro, mani sulla **barra di comando** (`PRESA_VELO`); nel Velo da planata (`abitanti.ts`) la barra a 1,25 m e 35 cm davanti e i due montanti che dai suoi capi salgono alla tela fuori dalle spalle | `integrazione.test.ts` (mani in alto col Velo, giù a terra); [Ottavio in volo](gioco/ottavio-in-volo.jpg) |
| 12 | **Di notte i colori brillano** | Di notte l'albedo va per metà verso la luminanza tinta dal cielo (niente rossi e gialli accesi al buio), il controluce solo entro 2-7 m da una lampada | [prima dell'alba](gioco/piazza-notte-prima-dell-alba.jpg), [sera](gioco/piazza-sera-ombrista.jpg) |
| 13 | **Dialoghi e gesti rigidi** | A ogni battuta chi parla annuisce e fa un gesto a giro (cenno, mano al petto, cenno, indica), il respiro si allarga mentre parla (`annunciaBattuta`, chiamato da `dialoghi.ts` per `png.ts`). Con un oggetto nella destra i gesti li fa la sinistra (`manoDOccupata`) | `modulo.test.ts` (a ogni battuta la testa si muove più che da ferma); [il dialogo con Togna](gioco/dialogo-togna.jpg) |
| 14 | **Oggetti di scena**: la pietra, il lume, il cartone | Pietra: un sasso grigio irregolare, tenuto dritto. Lume: una gabbia d'ottone col vetro acceso appesa dietro l'anca, dall'indice (`lume@bacino`). Cartone: la Santa velata con l'aureola su un bastoncino, dritto e davanti alla mano (non lo nasconde il mantello). Tutti costruiti con `Costruttore`, una mesh per colore | `oggetti.test.ts`, `integrazione.test.ts`; [Pina](gioco/pina-soglia.jpg), [Nando](gioco/nando-casa.jpg) |

### Problemi medi e bassi (revisione tecnica)

| # | problema | cosa si è fatto | come si controlla |
|---|---|---|---|
| 15 | **LOD che ignora lo zoom** | Le distanze valgono per 70° di campo visivo (`FOV_RIFERIMENTO`) e si moltiplicano per tan(fov/2)/tan(35°) | `modulo.test.ts`: col campo di 17,5° un personaggio a 200 m è LOD1, non sparito |
| 16 | **Precaricamento senza tempo massimo e in fila** | In `main.ts` il precaricamento parte subito dopo i caratteri, insieme al motore; la barra lo mostra al suo passo; al più 20 s, poi chi manca resta procedurale. Se la pagina si ricarica a metà (`pagehide`) le richieste si interrompono e niente si analizza: la prima corsa di `e2e:fase1`, che ricarica la pagina appena aperta, aveva trovato 6 «Couldn't load texture» di GLTFLoader | `npm run e2e:fase1`; `verifica-dist.mjs` |
| 17 | **Pina tiene l'indizio della missione (l'omino con la ruota)** | Il cartone è la Santa (BIBBIA.md corretta) | `oggetti.ts`, BIBBIA.md |
| 18 | `MODELLI_SENZA_INDICE` con 2 modelli | Tutti i 13 delle schede | `modulo.test.ts` |
| 19 | URL dei GLB senza versione | `indice.json` ha `versione` (SHA-1 del file, 10 cifre): `<id>.glb?v=…` | `modulo.test.ts` (versione e tavolozza dall'indice) |
| 20 | Scheletri non liberati, texture 1×1 per gli oggetti | `libera()` libera gli scheletri; gli oggetti prendono il materiale del mondo (`aColor`), niente `DataTexture` | — |
| 21 | Troppe chiamate di disegno per gli oggetti | Un `Costruttore` per oggetto: una mesh per canale (gerla 2, bastone 1, lume 2…) | — |
| 22 | Texture caricate al primo sguardo; 1024² anche per i generici | `preriscaldaPersonaggi` (texture e programma sulla GPU durante il caricamento); generici a 512² | `main.ts`; indice (4,9 MB in tutto) |
| 23 | Binari nel repository, `scheda-cast.png` da 1,6 MB | La scheda è un JPEG; i GLB restano nel repository (4,9 MB, servono alla build di Pages così come sono) e si rifanno solo con la pipeline | — |
| 24 | La qualità grafica non tocca i personaggi | Con «bassa» LOD1 da 15 m, animazione lenta da 80 m, niente oltre 160 m (`main.ts`, `onQualita`) | — |

### Rimasto (deciso, non dimenticato)

- **Bortolo con le mani dietro** stira il ponte fra manica e fianco della giacca (il modello generato li ha fusi sotto il gomito): l'1% degli spigoli, coperto dal braccio. Si toglie solo rifacendo il modello.
- **Clelia**: le suole scivolano 0,07 m/s (le altre 0,005-0,05): le scarpe sono corte e quasi tutte sotto la veste, che striscia come una veste vera.
- **Grembiule sopra la gonna, da sedute** (Annunciata, Pina, Togna, la velata generica): attorno al ginocchio piegato a 90° la gonna di sotto passa a chiazze davanti al grembiule (si vede nel laboratorio da vicino e, di sera, sui [gradini dell'Ombrista](gioco/gradini-ombrista.jpg)). I due strati vengono da altezze diverse della figura in piedi e lo skinning lineare li incrocia; restringere o spostare le bande di `gonne.ts` non cambia niente (provato). Servirebbe separare gli strati nella pipeline (il grembiule come guscio esterno con i pesi della gonna sotto, come `gusci` per i mantelli) o spingere indentro lo strato di sotto nella geometria da seduti.
- **Per terra** le anche piegate a 90° stirano le pieghe del sedere e dell'inguine (fino all'1,2% degli spigoli): stanno contro il suolo. La stoffa sotto le cosce scende sotto il suolo, che la copre.
- **Generici in più**: per la folla bastano le varianti; tre modelli velati nuovi costerebbero circa 4,5 crediti (gli ultimi sotto il tetto di 50) e non sono stati fatti.

## Le schermate

Fatte nel gioco vero (Vite in sviluppo, modalità e2e, Chromium con SwiftShader) con `node tools/personaggi/gioco.mjs --out=<cartella>`: partita nuova, fuori dalla capsula, per ogni inquadratura l'ora del giorno, gli orari dei contenuti che collocano la gente, la camera libera davanti a chi va guardato. Sono in [`gioco/`](gioco/).

| | |
|---|---|
| ![](gioco/togna-lavatoio.jpg) Togna china sulla vasca del lavatoio, le mani nell'acqua (giorno 1, 09:30) | ![](gioco/dialogo-togna.jpg) il dialogo con Togna, da Elvira (tasto E) |
| ![](gioco/ottavio-in-volo.jpg) Ottavio in volo col Velo verde (06:20), appeso alla barra | ![](gioco/ottavio-a-terra.jpg) Ottavio al prato del ronco (giorno 2, 15:00) |
| ![](gioco/annunciata-san-vigilio.jpg) Annunciata seduta sulla panca del portale, col bastone | ![](gioco/annunciata-di-fronte.jpg) Annunciata, di fronte |
| ![](gioco/bortolo-sagrato.jpg) Bortolo sul sagrato, le mani dietro la schiena | ![](gioco/gradini-ombrista.jpg) la gente seduta sui gradini dell'Ombrista (20:25) |
| ![](gioco/bambini-piazza.jpg) Lisa e Gioanin in piazza delle Ore | ![](gioco/clelia-bacheca.jpg) Clelia alla bacheca, col pacchetto (giorno 2) |
| ![](gioco/nando-ronchi-muro.jpg) Nando chino sul muro del ronco (09:00) | ![](gioco/nando-casa.jpg) Nando davanti a casa, la pietra in mano |
| ![](gioco/pina-soglia.jpg) Pina seduta sulla soglia, forbici e cartone | ![](gioco/piazza-alba-vicino.jpg) un velato con la gerla, all'alba |
| ![](gioco/piazza-notte-prima-dell-alba.jpg) la piazza prima dell'alba (05:36): la gente aspetta la Linea | ![](gioco/piazza-alba.jpg) all'alba (05:55) |
| ![](gioco/piazza-sera-ombrista.jpg) la sera dell'Ombrista (20:25): Togna, i bambini, Bortolo | |

Confronto con le figure procedurali di prima (stessa inquadratura, `--procedurale`):

![](gioco/confronto-togna.jpg)
![](gioco/confronto-bambini.jpg)
![](gioco/confronto-alba.jpg)
![](gioco/confronto-sera.jpg)

E tre foto della partita automatica (`npm run e2e:fase1`), con i dialoghi veri della missione 1:

| | | |
|---|---|---|
| ![](gioco/e2e-dialogo-togna.jpg) Togna, M1.6 | ![](gioco/e2e-dialogo-ottavio.jpg) Ottavio atterra in piazza, M1.7 | ![](gioco/e2e-ottavio-fienile.jpg) Ottavio al fienile |

## Build e caricamento

- `npm run build` copia `public/personaggi/` in `dist/personaggi/`: **13 GLB, 5 036 232 byte (4,80 MB)** (revisione finale: i generici con la texture a 512), più `indice.json` (17 KB, con tavolozze e versioni). La build intera pesa 9,5 MB.
- I percorsi sono relativi alla base del gioco (`import.meta.env.BASE_URL`, `./`) risolta su `document.baseURI`. `node tools/personaggi/verifica-dist.mjs` serve `dist/` sotto `/una/sottocartella/`, apre la build di produzione e controlla che `indice.json` e i 13 GLB siano chiesti lì e serviti (200) e che nessuno resti senza modello: passa (gioco pronto in 13 s).
- Durante il caricamento la barra dice «la gente di Corbella»; i 13 file arrivano in parallelo.

## Le prove

- `npm run typecheck`, `npx tsc -p tools/personaggi`.
- (revisione finale) `npm test`: 56 file, 772 prove passate, una saltata (`misure.test.ts`, gira con `MISURE=…`). Nuove: `tests/personaggi/forma.test.ts` (40 prove sui 13 modelli veri: braccia, strappi, seduti, per terra, piedi), in `modulo.test.ts` seduta dal profilo, per terra, LOD col campo visivo stretto, battuta, varianti per stoffa, versione e tavolozza dall'indice; in `oggetti.test.ts` la gerla dietro la schiena misurata (`retroBusto`) e il lume. I modelli veri si caricano in Node con `tests/personaggi/glbNode.ts` (`PROVA_GLB=<cartella>` per provare GLB nuovi della pipeline prima di copiarli).
- (integrazione) `npm test`: 46 file, 619 prove, tutte passate. Nuove: `tests/personaggi/integrazione.test.ts` (6 prove: chi usa quale modello, stesse posizioni e presenze in otto momenti, stessi cilindri, oggetti di scena, seduti e chini dallo stato, Ottavio appeso al Velo); in `modulo.test.ts` la quota delle anche da seduti segue `ancaSeduta`.
- `npm run build` e `node tools/personaggi/verifica-dist.mjs`.
- `npm run e2e:fase1`: la partita automatica completa (prologo e missione 1, 41 verifiche) passa con i modelli nuovi: «prova ok in 545 s» con la macchina carica (carico medio intorno a 15), e di nuovo sul commit finale in 192 s. Revisione finale: «prova ok in 298 s», nessun errore del browser (dopo la correzione del precaricamento, voce 16); le foto dei dialoghi qui sopra (`e2e-*.jpg`) vengono da questa corsa. `docs/shots/` ripristinato dopo ogni corsa.
- `node tools/personaggi/compila.mjs --ramo=grafica/luce`: il materiale si compila con `common.ts` di questo ramo e di `grafica/luce`.
- (revisione finale) `node tools/personaggi/compila.mjs`: compila con `common.ts` di questo ramo, che ora contiene `grafica/luce` e `grafica/post`. `node tools/personaggi/laboratorio.mjs`: le pose sui modelli veri, una figura per riquadro ([`finale/pose.jpg`](finale/pose.jpg), [`finale/cappuccio.jpg`](finale/cappuccio.jpg)).
- `node tools/personaggi/gioco.mjs` (tutte le schermate qui sopra) e `--procedurale` (il gioco parte in 8 s con le figure di prima e l'avviso «senza modello»). Con `--prova=<file.json>` fa inquadrature libere e misure (`js`), utili per ricontrollare dopo il rifacimento grafico.
- Crediti Higgsfield spesi per l'integrazione: nessuno. Per la revisione finale: nessuno (totale personaggi 45 su 50).

## Limiti noti e cose da fare

- ~~Gonne da sedute~~, ~~seduti per terra~~, ~~gesti con un oggetto nella destra~~, ~~ombre portate del rifacimento grafico~~: fatti nella revisione finale (sopra).
- **`grafica/natura` e `grafica/paese`** non sono ancora nel ramo: dopo la loro fusione vanno rifatte le schermate e ricontrollati i piazzamenti (Togna sul lastricato del lavatoio, le sedute dal profilo del suolo: se cambiano gradini e panche, le sedute seguono da sole).
- La Madre e Rosa non hanno un modello (stanno fuori scena nella Fase 1).
