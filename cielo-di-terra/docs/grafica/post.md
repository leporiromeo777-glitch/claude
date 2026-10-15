# Traccia «post»: post-produzione pittorica, qualità grafica, cielo, comandi

Ramo `grafica/post`. Le schermate finali sono in `docs/grafica/post/` (elenco in fondo).

## In breve

- **Il mondo non va più dritto sul canvas.** Si disegna in un render target HDR (mezzo float), poi una
  catena di passate lo trasforma in un quadro: bagliore caldo, filtro di Kuwahara (pittura a mano),
  contorni morbidi colorati, tremolio della mano sui bordi, mappatura dei toni (ACES calibrato di
  giorno, spalla morbida di notte), correzione colore calda e ricca, pennellata, grana della carta,
  vignettatura. Anche il Velo e le sovrapposizioni della regia (lo squadro in mano) passano dalla
  stessa post; l'interfaccia HTML resta nitida sopra.
- **Qualità grafica** Bassa / Media / Alta / Automatica, nel menu *Esc → Impostazioni → Visione e
  comandi → Qualità grafica*. Automatica stima dal nome della scheda e misura i primi secondi di gioco
  (tempo GPU quando il browser lo dà), scendendo se il fotogramma è lento. Le ombre della traccia
  «luce» seguono la qualità da sole appena i due rami sono uniti (spente a Bassa).
- **Cielo.** Le nubi del Collare sono cumuli dipinti con la luce **della nube intera** (lato in luce
  verso la Linea, base piatta in ombra fredda, orlo d'argento solo sulla sagoma, sagome blu-viola di
  notte); la Linea è una riga di luce con un alone caldo stretto che il bagliore apre; le Finestre
  sono vetro profondo che di giorno, di taglio, rimanda un cielo ceruleo a velature morbide, con
  costoloni in toni spenti (niente più «griglia blu fredda») e stelle che scintillano.
- **Comandi («come mi muovo nel gioco?»).** Se il blocco del puntatore è vietato (iframe degli
  artifact) si guarda **trascinando col tasto sinistro** (o col dito); le **frecce** girano sempre lo
  sguardo; la prima volta compare un suggerimento. Si cammina con **W A S D**, si corre con Maiusc, si
  salta con Spazio, E per usare.

## Prima e dopo

Le quattro inquadrature di confronto (`npm run shots -- --only=11,12,13,14`, qualità Alta), stessa
scena e stessa ora del bozzetto. In `docs/grafica/post/` ci sono due serie:

- `prima-dopo-N-*.jpg`: bozzetto | prima (ramo principale) | dopo (questo ramo da solo). Il mondo è
  quello di prima della traccia «luce», in gran parte carta a matita: si vedono la pittura, i toni, i
  contorni, il bagliore, le nubi, la Linea e le Finestre;
- `insieme-luce-N-*.jpg`: bozzetto | prima | **questo ramo unito in prova a `grafica/luce`** (unione
  di prova fuori dal repository, non committata). È la vista più onesta del risultato: acquerello del
  non rilevato, luce radente e foschia di «luce», più la post e il cielo di questa traccia.

Che cosa si avvicina ai bozzetti grazie a questa traccia:

- pittura a mano: campiture piatte con pennellate larghe sul fondo e fini vicino (Kuwahara
  anisotropico/generalizzato), bordi tirati a mano (tremolio), tocchi caldi e freddi lungo le
  pennellate, grana della carta;
- valori e palette: ombre più profonde e luci morbide di giorno (ACES calibrato), saturazione ricca,
  luci calde e ombre fredde, notte blu-viola con le pozze calde dei lumi aperte dal bagliore;
- cielo: cumuli bianchi a volumi morbidi col lato in luce e la base in ombra (bozzetto 3), sagome di
  nubi blu-viola di notte (bozzetto 5), Linea come riga luminosa calda, Finestre che di giorno si
  fanno cielo invece di un nastro blu a griglia.

## A. Post-produzione pittorica

### Ordine di un fotogramma (`Game.render` e `src/render/post/pipeline.ts`)

1. I `sistemi` fanno il loro `render` (la traccia «luce» ci disegna la mappa delle ombre).
2. `garantisciMappaOmbre()` (vedi B), poi `post.inizioMondo()` lega il render target del mondo:
   RGBA mezzo float, profondità in una `DepthTexture`, MSAA ×2 ad Alta. Il mondo si disegna come prima.
3. `post.dopoMondo(camera)`: **contorni** dalla profondità del mondo; poi si pulisce la profondità.
4. Velo in prima persona e `SistemaGioco.overlay` (squadro) si disegnano **nello stesso target**:
   passano dal filtro e dai toni come il resto. La post sa se hanno disegnato (conta le chiamate) e
   ricava dalla loro profondità la sagoma della prima persona (contorno proprio, filtro più fine,
   niente tremolio).
5. `post.fine({ notte })`: bagliore → tensore di struttura (Alta) → Kuwahara → passata finale sul canvas.

### Spazio colore

Si resta nello schema di prima: `ColorManagement` spento, uscita `LinearSRGBColorSpace`, colori «da
pittore» già pensati in sRGB. Il render target HDR conserva quei valori anche sopra 1 (Linea, lumi,
finestre accese, la Meta, le stelle forti, il controluce delle nubi), la post lavora nello stesso
spazio e solo la mappatura dei toni riporta tutto in [0, 1]. ACES lavora in lineare: la shader
converte (potenza 2,2) prima e dopo, tarata perché il grigio medio resti dov'è e il bianco della
carta resti quasi bianco. Così i colori della traccia «luce», dell'interfaccia 3D e della prima
persona non cambiano di significato: i medi restano dove sono, le ombre si fanno un po' più profonde
di giorno, niente si sbiadisce (verificato sulle schermate: luminanza media della zona centrale
entro pochi punti, saturazione più alta).

### Le passate, che cosa fanno e quanto costano

Costi stimati su una integrata Iris Xe a 1080p (Media) e su una dedicata tipo GTX 1660 (Alta),
contando letture di texture e operazioni per pixel; nell'ultima colonna il tempo misurato su
SwiftShader a 1280×720 con `__GAME__.misuraPassi()`, in percentuale del disegno del mondo (solo come
**confronto relativo**: SwiftShader è un rasterizzatore su CPU, e la macchina era molto carica).

| passata | dove | lavoro per pixel | Iris Xe, 1080p | GTX 1660, 1080p | SwiftShader 720p (relativo) |
| --- | --- | --- | --- | --- | --- |
| mondo nel target HDR | tutte | come prima; niente più MSAA ×4 sul canvas (Media senza MSAA, Alta ×2) | ≈ uguale o meno | ≈ uguale | 100 % (riferimento) |
| contorni | Media, Alta | 9 letture di profondità, ~45 operazioni | ~0,4 ms | ~0,15 ms | 1-2 % del mondo |
| bagliore | tutte (3/5/6 livelli) | soglia a ½ ris. (4 letture), discesa e risalita a filtro duale | ~0,35 ms | ~0,12 ms | 3 % |
| tensore di struttura | Alta | Sobel e due sfocature a ½ ris. (19 letture) | — | ~0,15 ms | 2-3 % |
| Kuwahara generalizzato | Media | a ½ ris., raggio 2-2,7 px: ~13-23 campioni × ~125 operazioni | ~1-1,5 ms | — | 12 % |
| Kuwahara anisotropico | Alta | a ½ ris., raggio 3,3-4,4 px: ~33-60 campioni nell'ellisse × ~125 operazioni | ~3-4 ms | ~1-1,5 ms | 20 % (a piena risoluzione col raggio 5 era il 70 %) |
| finale | tutte | ~20 letture, ~350 operazioni (tremolio, rumori, toni, colore, FXAA a Bassa) | ~0,8 ms | ~0,3 ms | 12-13 % (a Bassa di più: gira sul canvas pieno, il mondo è al 49 %) |
| **totale post** | | | **Bassa ~1 ms, Media ~3 ms** | **Alta ~2,5 ms** | Bassa ~40 %, Media ~29 %, Alta ~40 % del mondo |

Misure di `__GAME__.misuraPassi(3)` sull'inquadratura dell'alba (macchina con carico 16 su 4 core:
i numeri assoluti ballano del ±40 %, le proporzioni reggono): Bassa mondo 2535 ms, bagliore 79,
finale 974; Media mondo 5027, contorni 120, bagliore 134, Kuwahara 606, finale 606; Alta mondo 7771,
contorni 85, bagliore 208, tensore 187, Kuwahara 1595, finale 1011.

A Bassa il mondo si disegna sul 49 % dei pixel (70 % per lato): il fotogramma costa meno di prima
anche con la post. A Media il mondo non ha più l'MSAA ×4 del canvas di prima, che pagava quasi tutta
la post. Alta è pensata per le schede dedicate; su una integrata la qualità automatica la evita già
dalla stima del nome della scheda.

- **Contorni** (`FRAG_CONTORNI`): derivata seconda di 1/z sui vicini (che per le superfici piane è
  nulla), presa solo dal lato più vicino della sagoma, così la linea appartiene all'oggetto e non al
  fondo; sfuma con la distanza. Nella passata finale si legge con 5 campioni bilineari (linea morbida) e
  si colora con la tinta del pixel, più scura e più satura, tirata verso un bruno-viola: mai nera.
- **Bagliore**: soglia morbida (1,0 di giorno, 0,7 di notte, ginocchio 0,3) con media di Karis per non
  avere lucciole, catena di discesa e risalita a filtro duale (Bjørge) da metà risoluzione in giù;
  nella finale è tinto di caldo di giorno (`tintaBagliore`): l'alone dorato della Linea.
- **Kuwahara**: pesi polinomiali a 8 settori (Kyprianidis 2010), a **metà risoluzione**, riportato su
  con un upsampling congiunto che segue i bordi del colore originale. Media: generalizzato. Alta:
  **anisotropico**, ellissi orientate dal tensore di struttura (calcolato e sfocato a metà
  risoluzione): le pennellate seguono le forme. In tutti e due il raggio si stringe sotto i 9 m e
  sulla prima persona (mani, Velo, squadro), **cresce sul fondo** (fino a 1,35 volte oltre i 450 m,
  come un pittore che dipinge il fondo a pennellate larghe), e **i dettagli forti e sottili tornano
  sopra la pittura** (tratti di matita, finestrelle, stelle, scritte): il filtro spiana solo le
  tessiture deboli.
- **Passata finale**: tremolio della mano (lo spostamento di un pixel e mezzo, a 1080p, con un rumore
  morbido: i bordi dritti dei poligoni ondeggiano appena, come tirati a pennello; niente sulla prima
  persona), pittura (con l'upsampling e i dettagli), contorni, bagliore, mappatura dei toni, correzione
  colore (saturazione con vibranza, contrasto a S, luci calde e ombre fredde, più viola di notte),
  pennellata (rilievo stirato lungo il tensore ad Alta, lungo un campo morbido quasi parallelo a Media,
  e una variazione calda/fredda del tono lungo le pennellate), grana della carta (puntini, fibre,
  macchie larghe: ferma sullo schermo, come un foglio), vignettatura calda, dithering. A Bassa fa anche
  un FXAA leggero.

### Mappatura dei toni

Quattro operatori, scelti con `parametri.tonemap`:

| valore | operatore | effetto sulla tavolozza del gioco |
| --- | --- | --- |
| 0 | spalla pittorica | identità fino a 0,82, poi spalla morbida che conserva la tinta; le luci molto forti vanno verso il bianco. Non tocca medi e ombre: il più fedele ai colori scelti, un po' piatto. |
| 1 | ACES calibrato | ACES (Narkowicz) in lineare, tarato perché il grigio medio resti 0,18 e il bianco della carta 0,95: ombre più profonde e contrasto da pellicola. Di giorno è il più vicino ai bozzetti; **di notte scurisce troppo** il blu-viola. |
| 2 | AgX | quello di three.js con esposizione 1,6: **sbiadisce** questa tavolozza (colori pastello, notte grigia). |
| **3 (predefinito)** | giorno e notte | ACES calibrato di giorno, la spalla di notte (dissolvenza con `notte` fra 0,15 e 0,75). |

### Come si regola

Tutte le manopole sono in `PostProduzione.parametri` (`src/render/post/pipeline.ts`,
`PARAMETRI_PREDEFINITI`) e sono vive: in sviluppo si cambiano dalla console con
`__GAME__.game.post.parametri.<nome> = …` e si vedono al fotogramma dopo.

| parametro | predefinito | che cosa fa |
| --- | --- | --- |
| `esposizione` | 1 | moltiplica il colore prima dei toni |
| `tonemap` | 3 | 0 spalla, 1 ACES calibrato, 2 AgX, 3 ACES di giorno e spalla di notte |
| `ginocchio` | 0,82 | da dove la spalla comincia a comprimere |
| `saturazione`, `vibranza` | 1,12, 0,16 | saturazione generale e spinta in più ai colori spenti |
| `contrasto`, `pernoContrasto` | 0,22, 0,42 | contrasto a S attorno al perno (di notte cala del 70 %) |
| `luci`, `ombre` | [1,03 1 0,955], [0,96 0,975 1,05] | viraggio caldo delle luci e freddo delle ombre, di giorno |
| `luciNotte`, `ombreNotte` | [1,05 1 0,93], [0,97 0,97 1,07] | lo stesso di notte (ombre verso il viola) |
| `bloom` | 0,5 | forza del bagliore |
| `tintaBagliore`, `tintaBaglioreNotte` | [1 0,88 0,7], [1 0,96 0,9] | tinta del bagliore: l'alone caldo della Linea di giorno |
| `sogliaGiorno`, `sogliaNotte`, `ginocchioSoglia` | 1,0, 0,7, 0,3 | da che luminosità si accende il bagliore |
| `contorni`, `contorniPrimoPiano` | 0,62, 0,5 | forza dei contorni del mondo e della sagoma della prima persona |
| `sogliaContorni` | [0,01 0,06] | soglie sulla derivata seconda relativa di 1/z (più alte = meno linee) |
| `distanzaContorni`, `contorniLontano` | [90 900] m, 0,25 | i contorni sfumano con la distanza fino a questa forza |
| `durezza`, `nitidezza` | 8, 8 | quanto il Kuwahara sceglie il settore più uniforme (più alte = pennellate più piatte e nette) |
| `alfa` | 2 | allungamento delle ellissi ad Alta (1 forte, 3 lieve) |
| `vicino` | [1,5 9] m | sotto questa distanza il raggio del filtro scende fino al 40 % |
| `lontano` | [80 450 1,35] | fra 80 e 450 m il raggio cresce fino a 1,35 volte: il fondo a pennellate larghe |
| `dettaglio` | [0,05 0,16 0,85] | contrasto dei dettagli che tornano sopra la pittura, e quanto |
| `tremolio` | [1,4 26] | tremolio della mano sui bordi: ampiezza e scala in pixel a 1080p (0 = spento) |
| `pennellata`, `pennellataColore` | 0,085, 0,05 | rilievo della pennellata e sua variazione calda/fredda |
| `grana`, `macchie` | 0,05, 0,035 | grana fine e macchie larghe della carta |
| `vignetta`, `forzaVignetta` | [0,74 0,66 0,7], 0,32 | colore (moltiplica) e forza della vignettatura calda |

Il raggio del filtro e la qualità si cambiano dai preset in `qualita.ts` (`raggio` è in pixel a
1080p e scala con l'altezza dell'immagine). La forza dell'HDR della Linea è `LINEA_HDR` in `linea.ts`.

## B. Qualità grafica

### Preset (`src/render/post/qualita.ts`)

| | Bassa | Media | Alta |
| --- | --- | --- | --- |
| risoluzione del mondo | 70 % (pixel CSS, massimo 1×) | 100 % (massimo 1×) | 100 % (fino a 1,25× sugli schermi densi) |
| MSAA del mondo | no (FXAA leggero nella finale) | no (il filtro e l'upsampling ammorbidiscono) | ×2 |
| bagliore | 3 livelli | 5 livelli | 6 livelli |
| filtro pittorico | **nessuno** | Kuwahara generalizzato a metà risoluzione, raggio 4 px a 1080p | Kuwahara **anisotropico** a metà risoluzione, raggio 6,5 px a 1080p |
| contorni | no | sì | sì |
| pennellata, tremolio | no (grana più leggera) | campo morbido | orientata dal tensore |
| ombre (traccia «luce») | **spente** | `'media'` | `'alta'` |
| draw call della post | 6 | 12 | 17 |

Il canvas resta sempre nitido (rapporto pixel fino a 2): la grana, la vignettatura e l'interfaccia
non perdono risoluzione anche quando il mondo si disegna più piccolo.

Alta filtrava a piena risoluzione col raggio 4; ora filtra a metà risoluzione col raggio 6,5 (in
pixel a 1080p): pennellate più larghe e orientate, che è proprio l'aspetto dei bozzetti, a circa un
settimo del costo (su SwiftShader la passata è scesa dal 70 % al 10 % del mondo). I bordi restano
netti grazie all'upsampling che segue i bordi del colore originale e ai dettagli salvati.

### Automatica

`stimaIniziale(nomeScheda)`: dedicate NVIDIA/AMD RX/Arc e Apple M → Alta; SwiftShader, llvmpipe,
Intel HD 2000-5000, Mali/Adreno vecchie → Bassa; il resto (Iris Xe, Radeon integrate, nome nascosto)
→ Media. Poi `MisuraQualita`: scarta 1,5 s di riscaldamento (compilazione delle shader), raccoglie
2,5 s di fotogrammi, e se la mediana supera 1/44 s scende di un livello e rimisura (al massimo due
volte). Se c'è `EXT_disjoint_timer_query_webgl2` giudica il **tempo GPU** e non l'intervallo fra
fotogrammi, così un browser che limita a 30 fps per risparmio energetico non fa scendere la qualità.
Fotogrammi più lunghi di 0,25 s (scheda nascosta) non contano. Il livello in uso si vede col pannello
statistiche (F3 o `?debug`) e nella nota sotto «Qualità grafica» («Adesso: Media (scelta automatica)»).

### API

- `game.setQualita('automatica' | 'bassa' | 'media' | 'alta')`, `game.qualita`, `game.livelloQualita`,
  `game.presetQualita`.
- `game.onQualita(fn)`: avvisa subito e a ogni cambio con il `PresetQualita` (restituisce la funzione
  per staccarsi).
- Debug: `__GAME__.setSetting('qualita', 'alta')`; `getStats()` riporta `qualita`,
  `sceltaQualita`, `risoluzioneInterna`; `__GAME__.misuraPassi(n)` dà i millisecondi del mondo e di
  ogni passata. `capture()` e `timedRender()` danno l'immagine e il tempo **dopo** la post.
- In modalità E2E «automatica» vale sempre **Media** e non misura (deterministica, e abbastanza
  leggera per `npm run e2e:fase1` su SwiftShader). `npm run shots` **forza Alta** per ogni
  inquadratura con `setSetting('qualita', 'alta')` e passa a Bassa per le verifiche di fisica finali,
  che disegnano più di cento fotogrammi (due righe in `scripts/shots.mjs`).
- Impostazione dell'interfaccia: `qualitaGrafica` in `StoreImpostazioni` (predefinita
  'automatica'); `src/main.ts` la collega a `game.setQualita` e scrive nella nota della riga il
  livello in uso. Non ho toccato `GameSettings` (settings.ts è della traccia «luce»).

### Le ombre della traccia «luce»: già collegate

`PresetQualita.ombre` è il livello delle ombre con gli stessi nomi di `QualitaOmbre`
(`'spente' | 'bassa' | 'media' | 'alta'`): Bassa `'spente'`, Media `'media'`, Alta `'alta'`.
`Game.applicaOmbre(preset)` (a ogni cambio di qualità e alla fine di `init`) cerca
`game.luce.ombre.impostaQualita` **senza dipenderne**: prima dell'unione non fa nulla, dopo
l'unione comanda le ombre senza toccare una riga. Il passaggio della mappa d'ombra della traccia
«luce» è un `SistemaGioco.render`, che `Game.render` chiama **prima** di `post.inizioMondo()`: va
bene così.

**Rete di sicurezza e un difetto trovato provando le due tracce insieme.** Lo shader del mondo di
«luce» legge `uOmbraMappa` come `sampler2DShadow`, ma `uOmbraMappa` parte a null e torna null quando
le ombre si spengono (`impostaQualita('spente')`), e di notte il passaggio d'ombra non si disegna. Con
null three.js lega una texture vuota a colori e **ogni draw del mondo fallisce**
(GL_INVALID_OPERATION «Mismatch between texture format and sampler type»): a Bassa, o partendo di
notte, restavano solo lumi, stelle e vetro. `Game.garantisciMappaOmbre()` lega in quel caso una mappa
di profondità 1×1 pulita (tutto in luce); il passaggio d'ombra la sostituisce appena disegna. Con la
rete il difetto non si vede più (provato a Bassa e di notte ad Alta). L'ho segnalato alla traccia
«luce» (compito «uOmbraMappa null su sampler2DShadow»), che l'ha corretto alla radice nella sua copia
di lavoro (`mappaOmbraVuota()` in uniforms.ts: `uOmbraMappa` non è mai null). Dopo l'unione la rete
di `game.ts` non scatta più (controlla solo se il valore è null) e si può togliere, ma è innocua.

## C. Cielo

- **Collare** (`src/render/collare.ts`): ogni cumulo è una base larga di sbuffi bassi più torri tonde
  verso l'asse; ogni sbuffo è uno sprite rivolto alla camera, con sagoma sfrangiata da un rumore nello
  spazio dello sprite (stabile mentre si gira). Novità: ogni sbuffo porta il **centro e il raggio del
  suo cumulo** (`aNube`), e luce, ombra e controluce sono calcolati per la **nube intera**:
  ellissoide schiacciato più un po' di rotondità del singolo sbuffo, lato in luce verso la Linea,
  **base piatta in ombra fredda** con un filo di luce riflessa calda dal suolo, **orlo luminoso e
  controluce d'argento solo sulla sagoma esterna** vista dalla camera (sopra 1: lo apre il bagliore).
  Prima ogni sbuffo aveva il suo orlo e, visti da sotto in controluce (cioè da terra, sempre), i
  cumuli sembravano grappoli di bolle ad anello. Di notte sono sagome blu-viola appena più chiare
  dell'aria, come nel bozzetto 5. Tre strati (veli alti, torri, basi), una chiamata ciascuno: gli
  sprite trasparenti non si ordinano fra loro, quindi `ordinaCollare(gruppo, camera)` mette le basi
  davanti alle torri quando la camera sta sotto il Collare e il contrario quando ci plana sopra.
  Circa 2.500 sprite, cumuli un po' più grandi di prima.
- **Linea** (`src/render/linea.ts`): nucleo a `LINEA_HDR = 2,6` volte il bianco (la post lo sbianca e
  il bagliore lo apre, tinto di caldo da `tintaBagliore`), un filo vivo che pulsa appena lungo l'asse;
  alone più stretto di prima (una riga di luce come nei bozzetti, non una colonna), bianco-oro sul
  filo e ambrato verso il bordo; la miccia dell'alba brilla più forte.
- **Finestre** (`src/render/windows.ts`): vetro oltremare profondo; riflessione di Fresnel
  **addolcita** (licenza pittorica): da vicino e dall'alto si vedono le stelle, da lontano e di taglio il
  vetro rimanda l'interno illuminato e di giorno si fa **cielo ceruleo** velato dalla foschia, con
  chiazze morbide (le terre dell'altra parte sfocate nel vetro); larghe **velature oblique** anche di
  fronte, più chiare verso le rive; il riflesso morbido del filo della Linea; brina leggera che da
  lontano non disegna più righe bianche lungo le rive; stelle più brillanti e scintillanti (le più
  forti sopra 1). Costoloni e passerelle in **toni spenti vicini al vetro** (acciaio grigio-azzurro,
  legno stagionato scuro), sempre dipinti (`noPencil`): da lontano non fanno più reticolo.

## D. Comandi: guardarsi intorno senza pointer lock

`src/core/input.ts`:

- al clic sul canvas si chiede il blocco del puntatore; se fallisce (manca `requestPointerLock`,
  eccezione, promessa rifiutata, `pointerlockerror`, o nessuna risposta entro **300 ms**) si passa al
  **trascinamento** per tutta la sessione e il clic non chiede più il blocco. Se il blocco era già
  arrivato una volta, un rifiuto dopo è passeggero (Chrome rifiuta per un attimo dopo Esc): si resta
  col blocco;
- il trascinamento col tasto sinistro funziona sempre quando il puntatore non è bloccato (anche prima
  del primo clic); col dito si «afferra» il mondo (verso opposto, un po' più veloce);
- **frecce**: ← → girano, ↑ ↓ alzano e abbassano lo sguardo (1,9 e 1,25 rad/s); ↑ alza sempre lo
  sguardo anche con «inverti asse Y» (che vale per il mouse). Non muovono più il corpo: si cammina
  con W A S D (sulla scala della Cripta ↑ ↓ fanno ancora salire, e intanto alzano lo sguardo:
  innocuo). Quando l'interfaccia ha la tastiera (menu, dialoghi, lettere, carte, schede, Pianta)
  `input.bloccoInterfaccia` è vero (lo collega `main.ts` all'evento `catturaInput`) e le frecce restano
  all'interfaccia; ← → non sono bloccate sui cursori e sulle scelte delle impostazioni;
- suggerimento (`src/core/suggerimentoSguardo.ts`): una riga a matita in alto, «Clic per guardare col
  mouse» o, dopo il ripiego, «Trascina col mouse per guardare intorno», con sotto «oppure le frecce
  ← → ↑ ↓ · W A S D per camminare». Compare dopo 2,5 s di gioco libero se lo sguardo non si è ancora
  mosso, sparisce al primo sguardo; quello del ripiego compare subito e resta 7 s. Non c'è nelle prove
  E2E, così le foto restano pulite.

Test: `tests/input.test.ts` (ripiego per assenza, eccezione, promessa rifiutata, `pointerlockerror`,
attesa scaduta; blocco riuscito; rifiuto passeggero; trascinamento col mouse e col dito; frecce e
blocco dell'interfaccia; `preventDefault` sulle frecce ma non sui cursori), `tests/qualita.test.ts`
(preset, stima dalla scheda, misura automatica con fotogrammi lenti, pause e tempo GPU) e
`tests/collare.test.ts` (ordine degli strati sotto e sopra il Collare).

## Prestazioni

Inquadrature di `npm run shots -- --only=11,12,13,14` (Alta, 1280×720), contro il ramo principale:

| inquadratura | draw call prima → dopo | triangoli prima → dopo |
| --- | --- | --- |
| confronto-1 alba | 134 → 153 | ~945 k → 885 k |
| confronto-2 terrazze | 158 → 177 | 879-884 k → 824 k |
| confronto-3 planata | 153 → 172 | ~499 k → 439 k |
| confronto-5 notte | 111 → 130 | ~890 k → 830 k |

- **+19 draw call ad Alta** (17 della post, 2 per gli strati in più del Collare); +14 a Media, +8
  a Bassa. Ben dentro il tetto di ~400.
- **−60 k triangoli**: il Collare passa da icosaedri (320 triangoli ciascuno) a sprite (2 triangoli),
  circa 2.500 sbuffi in 3 chiamate.
- Memoria dei render target a 1080p, canvas compreso: Bassa ~30 MB, Media ~60 MB, Alta ~85 MB
  (MSAA ×2, tensore; la pittura ora è a metà risoluzione). Prima il canvas con MSAA ×4 ne usava ~75.
- Simulazione invariata: le verifiche di `npm run shots` danno gli stessi numeri di prima (camminata
  8,21 m in 2 s, salto 1,31 m, planata 5,5:1).
- Tempi di SwiftShader (macchina condivisa e molto carica, quindi rumorosi): un fotogramma a 720p
  costa circa 1,4× a Bassa, 1,3× a Media, 1,4× ad Alta rispetto al mondo da solo (prima che Alta
  passasse a metà risoluzione era 2,4×).
- `npm run e2e:fase1` (che fa le foto a Media) è **passato** su questo ramo: «prova ok in 322 s»
  (macchina con carico 16-20 su 4 core).
- Un fotogramma vero su una GPU non l'ho potuto misurare qui: le stime per Iris Xe e GTX 1660 sopra
  vengono dal conto delle letture e delle operazioni per pixel e vanno verificate con
  `__GAME__.misuraPassi()` su una macchina vera.

## File

Miei: `src/game.ts`, `src/main.ts`, `src/core/input.ts`, `src/core/debug.ts`,
`src/core/suggerimentoSguardo.ts` (nuovo), `src/render/post/*` (nuovi: `pipeline.ts`, `shaders.ts`,
`qualita.ts`, `tempoGpu.ts`), `src/render/collare.ts`, `src/render/linea.ts`,
`src/render/windows.ts`, `src/ui/impostazioni/store.ts`, `src/ui/componenti/impostazioni.ts`,
`tests/input.test.ts`, `tests/qualita.test.ts`, `tests/collare.test.ts` (nuovi).

Condiviso, modifica piccola e additiva: `scripts/shots.mjs` (due righe: ogni inquadratura forza Alta,
le verifiche finali passano a Bassa). Si unisce senza conflitti con la modifica della traccia «luce»
allo stesso file (provato).

Non ho toccato `shaders/common.ts`, `worldMaterial.ts`, `uniforms.ts`, `sky.ts`, `settings.ts`. Le
shader del Collare e delle Finestre usano solo funzioni che ci sono anche nel ramo `grafica/luce`
(`cylUp`, `lineaLightDir`, `lineaReach`, `bandLight`, `applyHaze`, `vnoise2/3`, `cylThetaDeg`) e gli
uniform di sempre; `createWorldMaterial(..., { noPencil: true })` c'è in tutti e due i rami. L'unione
di prova con `grafica/luce` (patch del suo diff sopra questo ramo) si applica senza conflitti, passa il
controllo dei tipi e si costruisce.

## Schermate (`docs/grafica/post/`)

- `prima-dopo-1-alba.jpg`, `prima-dopo-2-terrazze.jpg`, `prima-dopo-3-planata.jpg`,
  `prima-dopo-5-notte.jpg`: bozzetto | prima | dopo (questo ramo da solo, Alta), inquadrature 11-14 di
  `npm run shots`. Il mondo è ancora quello di prima della traccia «luce» (gran parte a matita).
- `insieme-luce-*.jpg`: le stesse con questo ramo **unito in prova** alla copia di lavoro della
  traccia «luce» (fuori dal repository): il risultato che si vedrà dopo l'unione.
- `confronto-*.png`: le quattro inquadrature di confronto come le produce `npm run shots` su questo ramo.
- `qualita-alba.jpg`, `qualita-terrazze.jpg`: Bassa | Media | Alta nella stessa scena.
- `confronto-toni.jpg`: spalla | ACES calibrato | AgX | giorno e notte (il predefinito), di giorno
  e di notte.
- `cielo-finestra.jpg`, `cielo-nubi.jpg`, `cielo-notte.jpg`, `cielo-alba.jpg` (e le versioni
  `-luce`): il vetro con le stelle e il riflesso della Linea, i cumuli del Collare, la notte, la
  miccia dell'alba.
- `comandi-ripiego.jpg`: il gioco dentro un iframe con `sandbox` senza `allow-pointer-lock` (come un
  artifact): al clic compare «Trascina col mouse per guardare intorno», e trascinamento e frecce
  girano davvero la visuale.
- `e2e-alba-linea.jpg`, `e2e-squadro.jpg`, `e2e-velo.jpg`, `e2e-notte.jpg`: foto di
  `npm run e2e:fase1` prima | dopo, con l'interfaccia (Media): l'alba dalla botola, lo squadro in mano
  (sovrapposizione della regia dentro la post, testi HTML nitidi), la planata col Velo, il fienile di
  notte.

## Che cosa resta

- **Ritoccare dopo l'unione con «luce».** Le soglie dei contorni (`sogliaContorni`), dei dettagli
  salvati dal filtro (`dettaglio`) e il viraggio sono tarati sull'unione di prova: con la versione
  finale di «luce» conviene rifare le quattro inquadrature e ritoccare dalla console.
- **`uOmbraMappa`**: la traccia «luce» l'ha corretta alla radice (vedi B); la rete di sicurezza in
  `game.ts` (`garantisciMappaOmbre`) diventa inutile e si può togliere all'unione.
- **La Linea che scorre.** Se «luce» espone la posizione del nucleo più luminoso lungo l'asse (un
  uniform), `linea.ts` può farlo vedere anche nel filamento e nell'alone: oggi la Linea è uniforme
  (salvo la miccia). Parte della colonna luminosa attorno alla Linea viene dal bagliore della foschia
  di «luce» (`applyHaze`): se la si vuole più sottile, è lì.
- **Misure vere.** I costi sono stime e confronti su SwiftShader; vanno misurati su una Iris Xe (Media,
  1080p, obiettivo 60 fps) e su una dedicata (Alta), con `__GAME__.misuraPassi()` in sviluppo o con il
  pannello F3. Se Media non regge i 60 fps sulla Iris Xe, la prima leva è il bagliore (5 → 4 livelli),
  la seconda `lontano[2]` (1,35 → 1), la terza il raggio del filtro.
- Le nubi del Collare non sono ordinate per distanza dentro uno strato (una chiamata per strato): con
  sbuffi molto diversi fra loro un ordine sbagliato si vedrebbe; oggi la tinta è uniforme e non si nota.
- La grana della carta e il tremolio sono fermi sullo schermo (come un foglio): se in movimento
  disturbano, si abbassano `grana`/`macchie`/`tremolio[0]`.
