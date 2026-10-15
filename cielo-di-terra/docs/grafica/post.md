# Traccia «post»: post-produzione pittorica, qualità grafica, cielo, comandi

Ramo `grafica/post`. Le schermate finali sono in `docs/grafica/post/` (sotto «Schermate»).

## In breve

- **Il mondo non va più dritto sul canvas.** Si disegna in un render target HDR (mezzo float), poi una
  catena di passate lo trasforma in un quadro: bagliore, filtro di Kuwahara (pittura a mano), contorni
  morbidi colorati, mappatura dei toni, correzione colore calda, pennellata, grana della carta,
  vignettatura. Anche il Velo e le sovrapposizioni della regia (lo squadro in mano) passano dalla stessa
  post; l'interfaccia HTML resta nitida sopra.
- **Qualità grafica** Bassa / Media / Alta / Automatica, nel menu *Esc → Impostazioni → Visione e
  comandi → Qualità grafica*. Automatica stima dal nome della scheda e misura i primi secondi di gioco
  (tempo GPU quando il browser lo dà), scendendo se il fotogramma è lento.
- **Cielo.** Il Collare è fatto di cumuli morbidi dipinti (sprite con sfera finta, base piatta in ombra,
  orlo d'argento in controluce, due strati); la Linea ha un nucleo HDR che il bagliore apre in un alone
  caldo; le Finestre sono vetro oltremare profondo con i riflessi morbidi dell'interno e del filo della
  Linea, costoloni scuri (niente più reticolo bianco) e stelle che scintillano.
- **Comandi («come mi muovo nel gioco?»).** Se il blocco del puntatore è vietato (iframe degli artifact)
  si guarda **trascinando col tasto sinistro** (o col dito); le **frecce** girano sempre lo sguardo;
  la prima volta compare un suggerimento. Si cammina con **W A S D**, si corre con Maiusc, si salta
  con Spazio, E per usare.

## A. Post-produzione pittorica

### Ordine di un fotogramma (`Game.render` e `src/render/post/pipeline.ts`)

1. `post.inizioMondo()` lega il render target del mondo: RGBA mezzo float, profondità in una
   `DepthTexture`, MSAA ×2 ad Alta. Il mondo si disegna come prima, con i suoi colori.
2. `post.dopoMondo(camera)`: **contorni** dalla profondità del mondo; poi si pulisce la profondità.
3. Velo in prima persona e `SistemaGioco.overlay` (squadro) si disegnano **nello stesso target**:
   passano dal filtro e dai toni come il resto. La post sa se hanno disegnato (conta le chiamate) e
   ricava dalla loro profondità la sagoma della prima persona (contorno proprio, filtro più fine).
4. `post.fine({ notte })`: bagliore → tensore di struttura (Alta) → Kuwahara → passata finale sul canvas.

### Spazio colore

Si resta nello schema di prima: `ColorManagement` spento, uscita `LinearSRGBColorSpace`, colori «da
pittore» già pensati in sRGB. Il render target HDR conserva quei valori anche sopra 1 (Linea, lumi,
finestre accese, la Meta, le stelle forti), la post lavora nello stesso spazio e solo la mappatura dei
toni riporta tutto in [0, 1]. Così le scelte di colore della traccia «luce», dell'interfaccia 3D e della
prima persona non cambiano di significato.

Verifica sulle schermate di confronto (zona centrale, stessa scena prima/dopo): di giorno la
luminanza media resta dov'era (+1…+4 %), la saturazione sale di circa il 30 % (voluto: «saturazione
ricca»); di notte, dopo la correzione del viraggio notturno, la luminanza resta entro pochi punti.
Niente si sbiadisce: le ombre restano dove erano, il bianco della carta resta bianco.

### Le passate, che cosa fanno e quanto costano

Costi stimati su una integrata Iris Xe a 1080p (Media) e su una dedicata tipo GTX 1660 (Alta),
contando letture di texture e operazioni per pixel; nell'ultima colonna il tempo misurato su
SwiftShader a 1280×720 con `__GAME__.misuraPassi()`, in percentuale del disegno del mondo (solo come
**confronto relativo**: SwiftShader è un rasterizzatore su CPU, e la macchina era molto carica).

| passata | dove | lavoro per pixel | Iris Xe, 1080p | GTX 1660, 1080p | SwiftShader 720p (relativo) |
| --- | --- | --- | --- | --- | --- |
| mondo nel target HDR | tutte | come prima; niente più MSAA ×4 sul canvas (Media senza MSAA, Alta ×2) | ≈ uguale o meno | ≈ uguale | 100 % (riferimento) |
| contorni | Media, Alta | 9 letture di profondità, ~45 operazioni | ~0,4 ms | ~0,15 ms | 2-3 % del mondo |
| bagliore | tutte (3/5/6 livelli) | soglia a ½ ris. (4 letture), discesa e risalita a filtro duale | ~0,35 ms | ~0,12 ms | 4-5 % |
| tensore di struttura | Alta | Sobel e due sfocature a ½ ris. (19 letture) | — | ~0,15 ms | 3 % |
| Kuwahara generalizzato | Media | a ½ ris., ~13 campioni × ~125 operazioni | ~1 ms | ~0,35 ms | 30 % |
| Kuwahara anisotropico | Alta | piena ris., ~50 campioni nell'ellisse × ~125 operazioni | ~13 ms (per questo non è Media) | ~5 ms | 110 % |
| finale | tutte | ~15 letture, ~300 operazioni (rumori, toni, colore, FXAA a Bassa) | ~0,7 ms | ~0,25 ms | 20-30 % |
| **totale post** | | | **Bassa ~1 ms, Media ~2,5 ms** | **Alta ~6 ms** | Bassa 31 %, Media 62 %, Alta 138 % del mondo |

A Bassa il mondo si disegna sul 49 % dei pixel (70 % per lato): il fotogramma costa meno di prima
anche con la post. A Media il mondo non ha più l'MSAA ×4 del canvas di prima, che pagava quasi tutta
la post. Alta è pensata per le schede dedicate; su una integrata la qualità automatica la evita già
dalla stima del nome della scheda.

- **Contorni** (`FRAG_CONTORNI`): derivata seconda di 1/z sui vicini (che per le superfici piane è
  nulla), presa solo dal lato più vicino della sagoma, così la linea appartiene all'oggetto e non al
  fondo; sfuma con la distanza. Nella passata finale si legge con 5 campioni bilineari (linea morbida) e
  si colora con la tinta del pixel, più scura e più satura, tirata verso un bruno-viola: mai nera.
- **Bagliore**: soglia morbida (1,0 di giorno, 0,7 di notte, ginocchio 0,3) con media di Karis per non
  avere lucciole, catena di discesa e risalita a filtro duale (Bjørge) da metà risoluzione in giù.
- **Kuwahara**: pesi polinomiali a 8 settori (Kyprianidis 2010). Media: generalizzato, a **metà
  risoluzione**, riportato su con un upsampling congiunto che segue i bordi del colore originale (circa
  16 volte meno lavoro che a piena risoluzione). Alta: **anisotropico**, ellissi orientate dal tensore
  di struttura (calcolato e sfocato a metà risoluzione), a piena risoluzione. In tutti e due il raggio
  si stringe sotto i 9 m e sulla prima persona (mani, Velo, squadro), e **i dettagli forti e sottili
  tornano sopra la pittura** (tratti di matita, finestrelle, stelle, scritte): il filtro spiana solo le
  tessiture deboli.
- **Passata finale**: pittura (con l'upsampling e i dettagli), contorni, bagliore, mappatura dei toni,
  correzione colore (saturazione con vibranza, contrasto a S, luci calde e ombre fredde, più viola di
  notte), pennellata (rumore stirato lungo il tensore ad Alta, lungo un campo morbido a Media), grana
  della carta (puntini, fibre, macchie larghe: ferma sullo schermo, come un foglio), vignettatura calda,
  dithering. A Bassa fa anche un FXAA leggero.

### Mappatura dei toni

Tre operatori, scelti con `parametri.tonemap`:

| valore | operatore | effetto sulla tavolozza del gioco |
| --- | --- | --- |
| **0 (predefinito)** | spalla pittorica | identità fino a 0,82, poi spalla morbida che conserva la tinta; le luci molto forti (Linea, Meta) vanno verso il bianco come sulla pellicola. Non tocca i medi né le ombre. |
| 1 | ACES calibrato | ACES (Narkowicz) in lineare, tarato perché il grigio medio resti 0,18 e il bianco della carta 0,95: ombre più profonde e contrasto da pellicola. Di giorno è bello, **di notte scurisce troppo** (vedi `confronto-toni.jpg`). |
| 2 | AgX | quello di three.js con esposizione 1,6: **sbiadisce** questa tavolozza (colori pastello, notte grigia). |

La spalla è il predefinito perché la traccia «luce» sta tarando colori e notte senza post: ACES
cambierebbe i suoi medi e le sue ombre. Quando le due tracce sono unite conviene riprovare
`tonemap = 1` (basta la console: `__GAME__.game.post.parametri.tonemap = 1`).

### Come si regola

Tutte le manopole sono in `PostProduzione.parametri` (`src/render/post/pipeline.ts`,
`PARAMETRI_PREDEFINITI`) e sono vive: in sviluppo si cambiano dalla console con
`__GAME__.game.post.parametri.<nome> = …` e si vedono al fotogramma dopo.

| parametro | predefinito | che cosa fa |
| --- | --- | --- |
| `esposizione` | 1 | moltiplica il colore prima dei toni |
| `tonemap` | 0 | 0 spalla pittorica, 1 ACES calibrato, 2 AgX |
| `ginocchio` | 0,82 | da dove la spalla comincia a comprimere |
| `saturazione`, `vibranza` | 1,08, 0,16 | saturazione generale e spinta in più ai colori spenti |
| `contrasto`, `pernoContrasto` | 0,15, 0,42 | contrasto a S attorno al perno (di notte cala del 70 %) |
| `luci`, `ombre` | [1,03 1 0,955], [0,96 0,975 1,05] | viraggio caldo delle luci e freddo delle ombre, di giorno |
| `luciNotte`, `ombreNotte` | [1,05 1 0,93], [0,97 0,97 1,07] | lo stesso di notte (ombre verso il viola) |
| `bloom` | 0,5 | forza del bagliore |
| `sogliaGiorno`, `sogliaNotte`, `ginocchioSoglia` | 1,0, 0,7, 0,3 | da che luminosità si accende il bagliore |
| `contorni`, `contorniPrimoPiano` | 0,62, 0,5 | forza dei contorni del mondo e della sagoma della prima persona |
| `sogliaContorni` | [0,01 0,06] | soglie sulla derivata seconda relativa di 1/z (più alte = meno linee) |
| `distanzaContorni`, `contorniLontano` | [90 900] m, 0,25 | i contorni sfumano con la distanza fino a questa forza |
| `durezza`, `nitidezza` | 8, 8 | quanto il Kuwahara sceglie il settore più uniforme (più alte = pennellate più piatte e nette) |
| `alfa` | 2 | allungamento delle ellissi ad Alta (1 forte, 3 lieve) |
| `vicino` | [1,5 9] m | sotto questa distanza il raggio del filtro scende fino al 40 % |
| `dettaglio` | [0,05 0,16 0,85] | contrasto dei dettagli che tornano sopra la pittura, e quanto |
| `pennellata`, `grana`, `macchie` | 0,085, 0,05, 0,035 | pennellata, grana fine e macchie larghe della carta |
| `vignetta`, `forzaVignetta` | [0,74 0,66 0,7], 0,32 | colore (moltiplica) e forza della vignettatura calda |

Il raggio del filtro e la qualità si cambiano dai preset in `qualita.ts` (`raggio` è in pixel a 1080p e
scala con l'altezza dell'immagine). La forza dell'HDR della Linea è `LINEA_HDR` in `linea.ts`.

## B. Qualità grafica

### Preset (`src/render/post/qualita.ts`)

| | Bassa | Media | Alta |
| --- | --- | --- | --- |
| risoluzione del mondo | 70 % (pixel CSS, massimo 1×) | 100 % (massimo 1×) | 100 % (fino a 1,25× sugli schermi densi) |
| MSAA del mondo | no (FXAA leggero nella finale) | no (il filtro e l'upsampling ammorbidiscono) | ×2 |
| bagliore | 3 livelli | 5 livelli | 6 livelli |
| filtro pittorico | **nessuno** | Kuwahara generalizzato a metà risoluzione, raggio 4 px a 1080p | Kuwahara anisotropico, raggio 4 px a 1080p |
| contorni | no | sì | sì |
| pennellata | no (grana più leggera) | campo morbido | orientata dal tensore |
| ombre (traccia «luce») | **no** | sì | sì |
| draw call della post | 6 | 12 | 17 |

Il canvas resta sempre nitido (rapporto pixel fino a 2): la grana, la vignettatura e l'interfaccia
non perdono risoluzione anche quando il mondo si disegna più piccolo.

### Automatica

`stimaIniziale(nomeScheda)`: dedicate NVIDIA/AMD RX/Arc e Apple M → Alta; SwiftShader, llvmpipe,
Intel HD 2000-5000, Mali/Adreno vecchie → Bassa; il resto (Iris Xe, Radeon integrate, nome nascosto)
→ Media. Poi `MisuraQualita`: scarta 1,5 s di riscaldamento (compilazione delle shader), raccoglie
2,5 s di fotogrammi, e se la mediana supera 1/44 s scende di un livello e rimisura (al massimo due
volte). Se c'è `EXT_disjoint_timer_query_webgl2` giudica il **tempo GPU** e non l'intervallo fra
fotogrammi, così un browser che limita a 30 fps per risparmio energetico non fa scendere la qualità.
Fotogrammi più lunghi di 0,25 s (scheda nascosta) non contano. Il livello in uso si vede col pannello
statistiche (F3 o `?debug`).

### API

- `game.setQualita('automatica' | 'bassa' | 'media' | 'alta')`, `game.qualita`, `game.livelloQualita`,
  `game.presetQualita`.
- `game.onQualita(fn)`: avvisa subito e a ogni cambio con il `PresetQualita` (restituisce la funzione
  per staccarsi).
- Debug: `__GAME__.setSetting('qualita', 'alta')`; `getStats()` riporta `qualita`,
  `sceltaQualita`, `risoluzioneInterna`; `__GAME__.misuraPassi(n)` dà i millisecondi del mondo e di
  ogni passata. `capture()` e `timedRender()` danno l'immagine e il tempo **dopo** la post.
- In modalità E2E «automatica» vale sempre **Media** e non misura (deterministica, e abbastanza
  leggera perché `npm run e2e:fase1` su SwiftShader non superi i 30 s di `page.screenshot`).
  `npm run shots` **forza Alta** per ogni inquadratura con `setSetting('qualita', 'alta')` e passa a
  Bassa per le verifiche di fisica finali, che disegnano più di cento fotogrammi (due righe in
  `scripts/shots.mjs`).
- Impostazione dell'interfaccia: `qualitaGrafica` in `StoreImpostazioni` (predefinita
  'automatica'); `src/main.ts` la collega a `game.setQualita` e scrive nella nota della riga il
  livello in uso («Adesso: Media (scelta automatica)»).

### Le ombre della traccia «luce»: dove collegarle

Il punto è `game.onQualita`. Nell'aggancio delle ombre in `game.ts` basta:

```ts
this.onQualita((p) => ombre.attiva(p.ombre)); // false a Bassa
```

Se l'aggancio disegna una shadow map con un `renderer.render` a parte, va messo **prima di
`this.post.inizioMondo()`** in `Game.render` (che lega il render target del mondo). Se invece usa le
shadow map di three.js (`renderer.shadowMap`), non serve altro: three.js le disegna dentro
`renderer.render(scene, camera)` e rimette da sé il target corrente.

## C. Cielo

- **Collare** (`src/render/collare.ts`): ogni cumulo è una base larga di sbuffi bassi più torri tonde
  verso l'asse; ogni sbuffo è uno sprite rivolto alla camera (una `InstancedBufferGeometry` per strato,
  una chiamata di disegno), con sagoma sfrangiata da un rumore nello spazio dello sprite (stabile mentre
  si gira), normale di sfera finta per la luce a bande della Linea, **base piatta in ombra fredda**,
  **orlo luminoso dalla parte della Linea**, **controluce d'argento** sopra 1 (lo apre il bagliore), una
  pennellata leggera e la stessa foschia del mondo. Secondo strato più alto, sottile e chiaro. Da
  vicino gli sbuffi svaniscono invece di riempire lo schermo (si planano attraverso). Circa 2.500
  sprite in 2 draw call.
- **Linea** (`src/render/linea.ts`): nucleo a `LINEA_HDR = 2,6` volte il bianco (la post lo sbianca e
  il bagliore lo apre), un filo vivo che pulsa appena lungo l'asse, alone in tre profili con il bordo
  ambrato; la miccia dell'alba brilla più forte.
- **Finestre** (`src/render/windows.ts`): vetro oltremare profondo, più denso di taglio; riflesso di
  Fresnel della foschia dell'altra parte del cielo; **riflesso morbido del filo della Linea** (il raggio
  riflesso che passa vicino all'asse); brina più leggera e quasi niente alone sui costoloni; stelle più
  brillanti e scintillanti, bagliore tenuto dentro la cella (spariscono i rombi tagliati), le più forti
  sopra 1. Costoloni e passerelle in acciaio brunito e legno scuro, e **sempre dipinti** (`noPencil`):
  sono parte del vetro, non terreno da rilevare; da lontano erano il reticolo bianco a matita.

## D. Comandi: guardarsi intorno senza pointer lock

`src/core/input.ts`:

- al clic sul canvas si chiede il blocco del puntatore; se fallisce (manca `requestPointerLock`,
  eccezione, promessa rifiutata, `pointerlockerror`, o nessuna risposta entro **300 ms**) si passa al
  **trascinamento** per tutta la sessione e il clic non chiede più il blocco. Se il blocco era già
  arrivato una volta, un rifiuto dopo è passeggero (Chrome rifiuta per un attimo dopo Esc): si resta
  col blocco;
- il trascinamento col tasto sinistro funziona sempre quando il puntatore non è bloccato (anche prima
  del primo clic); col dito si «afferra» il mondo (verso opposto, un po' più veloce);
- **frecce**: ← → girano, ↑ ↓ alzano e abbassano lo sguardo (1,9 e 1,25 rad/s). Non muovono più il
  corpo: si cammina con W A S D (sulla scala della Cripta ↑ ↓ fanno ancora salire, e intanto alzano lo
  sguardo: innocuo). Quando l'interfaccia ha la tastiera (menu, dialoghi, carte, schede, Pianta)
  `input.bloccoInterfaccia` è vero e le frecce restano all'interfaccia; ← → non sono più bloccate sui
  cursori e sulle scelte delle impostazioni;
- suggerimento (`src/core/suggerimentoSguardo.ts`): una riga a matita in alto, «Clic per guardare col
  mouse» o, dopo il ripiego, «Trascina col mouse per guardare intorno», con sotto «oppure le frecce
  ← → ↑ ↓ · W A S D per camminare». Compare dopo 2,5 s di gioco libero se lo sguardo non si è ancora
  mosso, sparisce al primo sguardo; quello del ripiego compare subito e resta 7 s. Non c'è nelle prove
  E2E, così le foto restano pulite.

Test: `tests/input.test.ts` (ripiego per assenza, eccezione, promessa rifiutata, `pointerlockerror`,
attesa scaduta; blocco riuscito; rifiuto passeggero; trascinamento col mouse e col dito; frecce e
blocco dell'interfaccia; `preventDefault` sulle frecce ma non sui cursori) e `tests/qualita.test.ts`
(preset, stima dalla scheda, misura automatica con fotogrammi lenti, pause e tempo GPU).

## Prestazioni

Inquadrature di `npm run shots` (Alta, 1280×720), contro lo stato di partenza:

| inquadratura | draw call prima → dopo | triangoli prima → dopo |
| --- | --- | --- |
| confronto-1 alba | 134 → 152 | ~945 k → 885 k |
| confronto-2 terrazze | 158 → 176 | 879-884 k → 824 k |
| confronto-3 planata | 153 → 171 | ~499 k → 439 k |
| confronto-5 notte | 111 → 129 | ~890 k → 830 k |

- **+18 draw call ad Alta** (17 della post, 1 per il secondo strato del Collare); +12 a Media, +6
  a Bassa. Ben dentro il tetto di ~400.
- **−60 k triangoli**: il Collare passa da icosaedri (320 triangoli ciascuno) a sprite (2 triangoli),
  circa 2.500 sbuffi in 2 chiamate.
- Memoria dei render target a 1080p, canvas compreso: Bassa ~30 MB, Media ~60 MB, Alta ~130 MB
  (MSAA ×2, tensore, pittura a piena risoluzione). Prima il canvas con MSAA ×4 ne usava ~75.
- Simulazione invariata: le verifiche di `npm run shots` danno gli stessi numeri di prima (camminata
  8,21 m in 2 s, salto 1,31 m, planata 5,5:1).
- Tempi di SwiftShader (macchina condivisa e molto carica, quindi rumorosi): un fotogramma a 720p
  costa circa 1,3× a Bassa, 1,6× a Media, 2,4× ad Alta rispetto al mondo da solo. `npm run shots`
  completo è passato da ~4 a ~9 minuti su questa macchina carica; le inquadrature 11-14 da sole
  stanno in 2-3 minuti. `npm run e2e:fase1` (che fa le foto a Media) è **passato**: «prova ok in 362
  s» (prima ~180 s su una macchina scarica).
- Un fotogramma vero su una GPU non l'ho potuto misurare qui: le stime per Iris Xe e GTX 1660 sopra
  vengono dal conto delle letture e delle operazioni per pixel e vanno verificate con
  `__GAME__.misuraPassi()` su una macchina vera.

## File

Miei: `src/game.ts`, `src/main.ts`, `src/core/input.ts`, `src/core/debug.ts`,
`src/core/suggerimentoSguardo.ts` (nuovo), `src/render/post/*` (nuovi: `pipeline.ts`, `shaders.ts`,
`qualita.ts`, `tempoGpu.ts`), `src/render/collare.ts`, `src/render/linea.ts`,
`src/render/windows.ts`, `src/ui/impostazioni/store.ts`, `src/ui/componenti/impostazioni.ts`,
`tests/input.test.ts`, `tests/qualita.test.ts` (nuovi).

Condiviso, modifica piccola e additiva: `scripts/shots.mjs` (due righe: ogni inquadratura forza Alta, le verifiche finali passano a Bassa).
Non ho toccato `shaders/common.ts`, `worldMaterial.ts`, `uniforms.ts`, `sky.ts`, `settings.ts`: le
shader del Collare e delle Finestre usano solo funzioni che c'erano già (`cylUp`, `lineaLightDir`,
`lineaReach`, `bandLight`, `applyHaze`, `vnoise2/3`, `cylThetaDeg`) e gli uniform di sempre. Se la
traccia «luce» le rinomina, quelle due shader vanno ritoccate.

## Schermate (`docs/grafica/post/`)

- `prima-dopo-1-alba.jpg`, `prima-dopo-2-terrazze.jpg`, `prima-dopo-3-planata.jpg`,
  `prima-dopo-5-notte.jpg`: bozzetto | prima | dopo, stessa scena e stessa ora (inquadrature 11-14 di
  `npm run shots`, ad Alta). Il mondo è ancora quello di prima della traccia «luce» (gran parte a
  matita): qui si vedono la pittura, i toni, i contorni, il bagliore e il cielo.
- `confronto-*.png`: le quattro inquadrature di confronto come le produce `npm run shots`.
- `qualita-alba.jpg`, `qualita-terrazze.jpg`: Bassa | Media | Alta nella stessa scena (mondo libero
  `?senza-titolo`, dove le celle dimostrative sono già dipinte).
- `confronto-toni.jpg`: spalla pittorica | ACES calibrato | AgX, di giorno e di notte.
- `cielo-finestre.jpg`, `cielo-nubi.jpg`, `cielo-alba.jpg`, `cielo-finestra.jpg`: Finestre da
  lontano col Collare, la Linea e le nubi in controluce, la miccia dell'alba, il vetro con le stelle e
  il riflesso della Linea.
- `e2e-alba-linea.jpg`, `e2e-squadro.jpg`, `e2e-velo.jpg`: foto di `npm run e2e:fase1` prima | dopo,
  con l'interfaccia (a Media): l'alba vista dalla botola, lo squadro in mano (sovrapposizione della
  regia dentro la post), la planata col Velo.

## Che cosa resta

- **Ritarare dopo l'unione con «luce».** Le soglie dei contorni (`sogliaContorni`), dei dettagli
  salvati dal filtro (`dettaglio`) e il viraggio sono stati tarati sul mondo di adesso, in gran parte
  a matita. Con l'acquerello del non rilevato, le ombre e la foschia nuove conviene rifare le quattro
  inquadrature e ritoccare: per esempio provare `tonemap = 1` (ACES calibrato), che di giorno dà ombre
  più profonde.
- **Collegare le ombre** a `game.onQualita` (vedi sopra) e mettere l'eventuale passata della shadow
  map prima di `post.inizioMondo()`.
- **La Linea che scorre.** Se «luce» espone la posizione del nucleo più luminoso lungo l'asse (un
  uniform), `linea.ts` può farlo vedere anche nel filamento e nell'alone: oggi la Linea è uniforme
  (salvo la miccia).
- **Misure vere.** I costi sono stime e confronti su SwiftShader; vanno misurati su una Iris Xe (Media,
  1080p, obiettivo 60 fps) e su una dedicata (Alta), con `__GAME__.misuraPassi()` in sviluppo o con il
  pannello F3. Se Media non regge i 60 fps sulla Iris Xe, la prima leva è il bagliore (5 → 4 livelli),
  la seconda il raggio del filtro.
- **E2E.** In modalità E2E «automatica» vale Media; `npm run e2e:fase1` fa quindi le foto a Media. Su
  una macchina molto carica uno `page.screenshot` può superare i 30 s di Playwright (lo script non è
  mio: si può alzare il timeout o forzare `setSetting('qualita', 'bassa')` all'inizio della prova).
- Le nubi del Collare non sono ordinate per distanza (una sola chiamata per strato): con sbuffi molto
  diversi fra loro un ordine sbagliato si vedrebbe; oggi la tinta è uniforme e non si nota.
- La grana della carta è ferma sullo schermo (come un foglio): se in movimento disturba, si abbassa
  `grana`/`macchie` o la si lega allo sguardo.
