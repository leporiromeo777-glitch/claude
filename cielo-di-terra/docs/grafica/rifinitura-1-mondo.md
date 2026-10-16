# Rifinitura 1, area «mondo»

Ramo `grafica/rifinitura-1-mondo`, partito da `claude/jolly-archimedes-cm54mt` (fea8391, unione 2).
Risponde al giudizio del direttore artistico sul giro 1 (media 3,6): Finestre di oltremare, boschi
lontani a «pluriball», niente tramonto, altra metà bianca, contorni neri, prato acido, notte piatta,
rilievo illeggibile di notte, muri a vetro rotto, chiome a girandola, più le voci di prestazioni,
qualità automatica, ombre e ingresso.

Solo grafica e motore del disegno. Gameplay, fisica, collisori, quote del suolo, posizioni,
contenuti, tempi e testi non cambiano (vedi «Fuori area» per le prove toccate e la nota sulle
termiche del Velo).

Schermate in `docs/grafica/rifinitura-1-mondo/` (JPEG, 1280×720, Chromium + SwiftShader, qualità
Alta salvo a16/a18 Media e a17 Bassa). Le inquadrature sono quelle del giudizio (a01-a18, b03,
b05), i quattro confronti (c1, c2, c3, c5), tre provini del motore (s01, s02, s05), tre per il
rilievo (n7 notte dall'alto, n9 notte da terra, n8 lo stesso di giorno) e due ore in più (t1 alba
presto 5:48, t2 sera 20:00); i setup sono in `inquadrature.mjs` (stessa forma di `scripts/shots.mjs`,
si girano con la stessa API `__GAME__`). «Prima» è la build di `fea8391` con gli stessi setup.
- `foglio-c*.jpg`: bozzetto | prima | dopo (confronti 1, 2, 3, 5);
- `prima-dopo-*.jpg`: prima | dopo per tutte le altre;
- `dopo-*.jpg`: la «dopo» a piena grandezza.

In breve:

| | Prima | Dopo |
|---|---|---|
| Finestre (giorno) | strisce di oltremare saturo (s 0,72) col reticolo blu dei costoloni | vetro velato dall'aria del cilindro, lilla-azzurro chiaro (s 0,30), costoloni nell'aria e retinati via da lontano |
| Boschi lontani | «pluriball»: una cupola d'ombra per albero fino all'orizzonte | masse continue a gruppi di specie (oliva, oro, ruggine) con fili più freddi fra gruppo e gruppo |
| Sera | identica al giorno fino al buio | ore dorate dalle 16, luce radente e +20%, foschia pesca, poi **fase rosa** (19:40-20:40) prima del blu |
| Altra metà / Linea | foglio bianco; banda bianca larga in planata | terre capovolte sotto un velo azzurro; la Linea è un filo di ~2 px con un alone stretto |
| Contorni | neri dappertutto, anche a 900 m | solo vicino (30-250 m) e leggeri; inchiostro pieno sul fronte della rivelazione e in prima persona |
| Prato | giallo-verde acido (s 0,66-0,71) | oliva d'ottobre con paglia (s 0,50-0,54; bozzetto 2: 0,50-0,55); conche più scure, cigli più chiari |
| Notte | selciato azzurro chiaro (L 0,20, più del cielo), nessuna pozza | suolo scuro (L 0,10; bozzetto 5: 0,12), pozze calde dei lumi su suolo e muri |
| Rilievo di notte | carta e foschia: le terrazze rilevate non si leggono | gesso chiaro di tratteggio e curve, carta notturna con un minimo di luce |
| Muri | schegge triangolari a vetro rotto | pietre smussate a corsi, un colore per pietra, giunti per incavo |
| Castagni / larici | «girandole» di foglie a stella; larici a candelotto | foglie lanceolate sparse, nucleo meno visibile; larici a palchi pendenti, oro spento |

## Problema per problema

### 1. Finestre di oltremare saturo (alta) — fatto

`render/windows.ts`, `render/worldMaterial.ts`.
- Vetro (`GLASS_FRAG`): di giorno `profondo` è un neutro scuro `vec3(0.07, 0.08, 0.11)` (di notte
  resta l'oltremare di prima); fra l'occhio e il vetro c'è l'aria illuminata del cilindro,
  `mix(col, mix(uHazeZenith, uHazeColor, 0.45) * 1.03, giorno * mix(0.55, 0.85, smoothstep(250, 1100, dist)))`;
  di giorno metà della saturazione; le stelle per `(1 - giorno)`; la brina sfuma su 10-80 m invece
  di 3-26 m.
- Costoloni e travi di bordo: erano loro, una volta schiarito il vetro, a disegnare il reticolo blu
  scuro sopra il cielo velato. Il loro materiale ha l'opzione nuova `ariaVetro` (uniform
  `uAriaVetro`): di giorno la stessa aria del vetro, e da lontano (350-600 m) spariscono retinati.
  Sopra il bastione facevano trattini chiari.
- Misura (confronto 1, alba): la striscia ha saturazione HSV 0,30 (prima 0,72) e luminanza a −17%
  del cielo attorno (obiettivo ±15%: ci siamo quasi). Di notte vetro e stelle sono quelli di prima.
- Schermate: `foglio-c1`, `prima-dopo-b05`, `-a01`, `-s01`, `foglio-c3` (di notte: `-a10`, `-a11`).

### 2. Coltre dei boschi a «pluriball» (alta, regressione) — fatto

`render/naturaMateriali.ts` (ramo `BOSCO`), `scene/bosco.ts`.
- La cupola per albero (cella di 6,5 m) vale solo da vicino: `vis *= 1 - smoothstep(220, 500, dist)`,
  normale mescolata a 0,3 invece di 0,8; lo scurimento fra le chiome (`gap`) è zero oltre 300 m.
- Da lontano le macchie di colore vengono da una seconda voronoi a 26 m (gruppi di specie: oliva,
  oro, ruggine) mescolata a un rumore morbido di 30 m, con un filo più scuro e freddo fra gruppo e
  gruppo (×0,9, non ×0,8: con ×0,8 e la cupola per gruppo veniva un selciato di ciottoli grandi,
  provato e scartato). La normale da lontano si ammorbidisce verso il su: masse continue.
- La retinatura del margine usa i gruppi da lontano (isole grandi e morbide, non coriandoli), e il
  margine (copertura bassa) sfuma nel colore del sottobosco.
- `bosco.ts`: rumore d'altezza fine da 1,6 a 0,5 m, soglia dei quadrilateri da 0,42 a 0,3.
- Schermate: `prima-dopo-a03` e `-a05` (versante dietro), `-a14`, `-s02`, `foglio-c2`.

### 3. Il tramonto non c'era (alta) — fatto

`world/sky.ts`, `render/uniforms.ts`, `render/post/pipeline.ts`, `game.ts`.
- Colori nuovi: `hazeGold` 0xf0c49a (pesca), `zenithGold` 0x7884c4, `ambTopGold` 0xa898c4,
  `hazeSunGold` 0xffa452, `sunGold` 0xffaa66.
- `golden` da `smoothstep(0.5, 1, fromMid)` a `smoothstep(0.3, 1, fromMid)`: la luce dorata comincia
  verso le 9 e dopo le 16.
- **Fase rosa** nuova (`SkyState.rosa`): mentre la Linea si accende o si ritira (lit fra ~0,9 e
  ~0,25: 19:40-20:40 e 5:35-5:55) foschia verso 0xe0909a, zenit verso 0x5a5aa0, riempimento lilla,
  luce rosata; in quella fase la notte vela il cielo il 60% in meno, così il blu arriva dopo.
- Nelle ore dorate `coreFlat` minimo da 0,5 a 0,3 (0,18 nella fase rosa: luce quasi di lato, ombre
  lunghe). La luce principale +20% nelle ore dorate passa da `SkyState.forzaLuce` a `uSole.w`
  **invece di moltiplicare `sunIntensity`**: `sunIntensity` decide anche le termiche del Velo
  (`game.ts`, soglia 0,5), quindi non si tocca.
- Post: viraggio `luciOro` [1.08, 1.0, 0.86] pesato con `StatoPost.oro = sky.golden` (spento di notte).
- Prove nuove: `tests/cielo-sera.test.ts` (oro alle 19:48, rosa alle 20:24 e alle 5:45, luce più
  radente, `sunIntensity` e `night` identici a prima, `uSole.w`).
- Schermate: `prima-dopo-a09` (19:48), `-t2` (20:00, rosa), `-a10` (20:24), `-a15`, `-t1` (alba, 5:48).

### 4. Altra metà bianca, valli senza foschia, campi a trapunta, nubi di carta, Linea larga (alta) — fatto

- `shaders/common.ts`, `schizzo()`: viraggio della carta verso l'aria da ×0,55 a ×0,3.
- `uniforms.ts`: velo dell'altra metà `uHaze.w` da 0,12 a **0,05** (0,07 non bastava insieme alla
  densità più alta); densità al suolo ×1,4 (`1.4 / 900`): fra 100 e 600 m la foschia sale dal 33% al
  42% a 300 m, le quinte si leggono. In più la frazione d'aria in quota `uAria.z` da 0,32 a **0,16**:
  con la densità ×1,4 l'altra metà sarebbe diventata *più* velata (88% di foschia invece di 80%);
  così i raggi che passano vicino all'asse attraversano aria rada e le terre capovolte si leggono
  sotto un velo azzurro (circa 65%), mentre le valli vicine hanno più foschia di prima. Il non
  rilevato sta dietro l'aria ×1,05 invece di ×1,12.
- `palette.ts`: campi solo ocra, oliva, salvia, stoppie e terra (niente verde acido, che sotto la
  foschia diventava verde acqua, né bruno che diventava lilla); i bordi degli appezzamenti deformati
  di ±3 m da un rumore.
- `collare.ts`: la forma della nube intera pesa più dello sbuffo (0,8 / 0,35), lato in luce +20%,
  base −30% e verso il blu. I lobi sovrapposti c'erano già (torri e basi).
- `linea.ts`: il nucleo resta largo circa 2 pixel a ogni distanza (il raggio del cilindro si stringe
  nel vertex shader, e il filo si accende un poco di più in compenso: l'alone lo fa il bagliore);
  l'alone stretto del nastro è misurato in pixel. La banda bianca larga in planata però veniva
  soprattutto dall'**aria accesa attorno alla Linea** in `coloreFoschia` (20 m d'aria luminosa, a
  300 m dall'asse, sono 40 pixel): ora quella riga è larga qualche pixel (`dminPx`), e resta il velo
  largo e debole in metri.
- `post/shaders.ts`: le luci HDR (sopra ~1,2: filo della Linea, lumi, stelle, Meta) escono dal
  Kuwahara attraverso la stessa maschera `dettaglio` della passata finale.
- Schermate: `foglio-c3`, `prima-dopo-s01`, `-a01`, `-s02`, `-a13`, `-a14`.

### 5. Contorni neri dappertutto (alta) — fatto

`render/post/pipeline.ts`, `render/post/qualita.ts`: `contorni` 0,62 → 0,35, `contorniLontano`
0,25 → 0,05, `distanzaContorni` [90, 900] → [30, 250], `sogliaContorni` [0,01, 0,06] →
[0,03, 0,12]. L'inchiostro pieno resta sul fronte della rivelazione (shader del mondo, `pi.ink`) e
sulla prima persona (`contorniPrimoPiano` invariato). Kuwahara `lontano` [80, 450, 1,35] →
[80, 450, 1,15]; raggio di Alta 6,5 → 5.
- Schermate: `foglio-c2`, `prima-dopo-a13`, `-b03`, `-a09`.

### 6. Prato acido, gradoni a lastre, faccette (alta) — fatto in gran parte

- `palette.ts`: prato #7d8a4a, chiaro #8e9259, ombra #5f6e40, erba secca e pascolo secco #b9a26a
  (paglia).
- `shaders/terreno.ts` (`pratoDipinto`): erba secca color paglia, «prato al sole» e tocchi caldi
  meno gialli; variazione di valore ±18% a chiazze di 7-15 m (spenta con la distanza in pixel:
  sull'altra metà, di scorcio, faceva increspature); il prato in fondo un filo più spento (−16% di
  saturazione) e più scuro (−10%); i tocchi di pennello sul prato pesano un terzo in più (il
  bozzetto 2 ha una deviazione di valore tre volte la nostra: il Kuwahara se ne mangia gran parte,
  la deviazione sale solo da 0,057 a 0,061).
- `superfici.ts` (`supErba`): l'erba degli oggetti (ripiani, zolle, i ripiani verdi del
  popolamento) va per l'80% verso lo stesso oliva #7d8a4a, con la sua luminosità: era il verde più
  acido delle schermate (a04, saturazione 0,88).
- `post/pipeline.ts`: saturazione 1,12 → 1,06, vibranza 0,16 → 0,12. Con l'albedo già spento
  questo basta; da solo (prova del direttore) non bastava.
- **Curvatura**: `terrainMesh.ts` scrive nell'alfa dei vertici del terreno quanto il vertice sta
  sotto (conca) o sopra (dosso) la media dei vicini (0..115, 57 = piano; 255 resta il vetro da
  scartare); `worldMaterial.ts` scurisce le conche e schiarisce i dossi (±12%, fino a ~500 m). I
  gradoni ora hanno il piede scuro e il ciglio chiaro anche senza ombre.
- Faccette: le normali del terreno sono già per vertice e calcolate con le differenze centrali sui
  campioni del bordo, quindi uguali fra chunk vicini. Le faccette di a03 sono della **terra
  battuta della corona della piazza** (`coronaSulSuolo` del popolamento: triangoli di 0,55 m, con
  colore e variante di superficie scelti per triangolo). Dalla parte del disegno: `supTerra` non
  sposta più il rumore con la variante (era lui a disegnare un motivo diverso in ogni triangolo);
  `applicaSuperficie`, per TERRA ed ERBA quasi in piano, usa il «su» del cilindro per il motivo e
  per la luce invece della faccetta; sul terreno nudo (sentieri, terra, campi) i tocchi di pennello
  di 1-2 m pesano il 40% (quelli di 5 m il 70%): a celle nette sembravano anch'essi faccette. Il
  colore per triangolo resta (è del popolamento: vedi «Che cosa resta»).
- Misura (confronto 2, tre zone di prato): saturazione HSV 0,66-0,71 → 0,50-0,54 (bozzetto 2:
  0,50-0,55); tinta 53-58° → 58-63° (bozzetto: 44-55°, più paglia).
- Non fatto: la fascia scura di 0,5 m e i ciuffi sul ciglio del gradone del *terreno* (i muri a
  secco del popolamento hanno già la copertina di sassi con i ciuffi).
- Schermate: `foglio-c2`, `prima-dopo-a13`, `-b03`, `-a04`, `-a03` (terra battuta).

### 7. Notte piatta e senza pozze (alta) — fatto

- `sky.ts`: `ambBotNight` 0x262848 → 0x141628, `ambTopNight` 0x5052a2 → 0x3e4088.
- `shaders/common.ts`: di notte il riempimento del cielo sul suolo cala del 28%
  (`fill *= mix(1, 0.72, uNight)`): il suolo resta più scuro del cielo anche dove guarda in su (la
  piazza, il prato), e le pozze si leggono.
- `lamps.ts` + `uniforms.ts` + `common.ts`: uniform nuovo **`uPozze` (vec4[24])**: i 24 lumi più
  vicini entro 120 m, scelti a ogni fotogramma senza allocazioni (inserimento ordinato in due
  array fissi), con `w` = 1 + distanza dalla camera. `lampLight` li disegna come pozze calde
  #ffb060, caduta `1/(1 + 0.1 d²)`, taglio fra 6 e 11 m, intensità 1,2: sul suolo e sui muri, anche
  attorno alle finestre (il lume della finestra sta 60 cm davanti al vetro). Un frammento guarda
  solo i lumi la cui distanza dalla camera differisce dalla sua meno di 11 m (l'elenco è in ordine:
  il ciclo salta i più vicini e si ferma al primo troppo lontano), e oltre 132 m non lo apre.
  `uLamps` (8) resta per chi lo usa (personaggi, Fade): lo shader del mondo ne prende solo le luci
  con w ≥ 2 (le Fade scritte dal popolamento).
- Bagliori delle finestre accettati anche di taglio (`smoothstep(-0.25, 0.12, …)` invece di
  `(-0.05, 0.3)`); i lumi fra 600 e 1100 m crescono fino al doppio della dimensione apparente.
- Schermate: `prima-dopo-a11`, `-a12`, `-s05`, `foglio-c5`.

### 8. Muri a vetro rotto (media) — fatto

`oggetti/oggetti/muri.ts`, `render/superfici.ts`.
- Dettaglio alto: `pietraSmussata`, blocco smussato (smusso 2-3 cm, anello sul corpo del muro,
  anello interno rientrato, faccia appena bombata, normali morbide, 10 triangoli), a corsi
  orizzontali con rapporto 1,7-3,1:1 e una zeppa su dieci.
- Dettaglio basso (i gradoni del paese: `terrazzi.ts` lo usa anche da vicino, ed era lui il «vetro
  rotto» di a06): `pietraCuscino` indicizzato, normali morbide invece delle quattro falde piatte.
- Un colore per pietra (prima il lichene era per vertice: triangoli di colore), gneiss chiaro
  #b8b2a4 mescolato al tono del muro (0,42 / 0,38), un valore proprio per pietra (±12%, da un hash
  della posizione: la posa non cambia), muschio #6f7a3e su una pietra su cinque, licheni ocra.
- Superficie nuova **`SUPERFICIE.SASSO` (16)**: faccia scagliata, licheni ocra e grigio-verdi,
  muschio sulle facce in su, **niente giunti disegnati dentro** (la PIETRA disegnava pietre nelle
  pietre). Il giunto è l'incavo: il corpo del muro (meno scuro di prima) fra un sasso e l'altro e
  l'occlusione cotta sullo smusso.
- Copertina di sassi tondi con i ciuffi: c'era già.
- Triangoli: muro di 14 m 4048 (limite della prova 4500).
- Schermate: `prima-dopo-a06`, `foglio-c2` (muro a destra).

### 9. Castagni a girandola, larici a candelotto (media) — fatto

- Carte di foglie (`shaders/natura.ts`, `ciuffoFoglie`): il castagno non ha più la «macchia» a
  stella né i due rametti a ventaglio: 10 foglie lanceolate seghettate sparse nel ciuffo, ognuna col
  suo centro, verso e inclinazione (pendono), lunghe 15-20 cm in una carta di ~60 cm.
- `scene/alberi.ts`: LOD 0 con carte doppie (1240) e grandi il 60% (0,63 m); nucleo ×0,8 (0,35 e
  0,51 ai LOD 0 e 1); `impostaNucleo` 0,85 / 0,88 / 0,92 (era 0,66 / 0,78 / 0,92). Provato a far
  vedere il nucleo anche al LOD 0: tornavano le palle scure fra le foglie; resta solo per l'ombra.
- `naturaMateriali.ts`: le carte si rimpiccioliscono fra 3 e 1,2 m dalla camera e sotto 1,2 m
  spariscono.
- Larici: oro d'ottobre spento (#a87a2a, anche nelle masse lontane di `bosco.ts`), quattro palchi
  pendenti (ogni palco più largo in basso), punta smussata, carte d'aghi su cinque livelli fino in
  cima.
- Castagni della Terrazza Pedrazzini (`oggetti/oggetti/castagno.ts`, dettaglio alto): più masse e
  più piccole, più bitorzolute, più della metà verdi (l'ottobre accostato, non palle arancioni),
  superficie FOGLIAME dichiarata; quattro foglie per ciuffo con verso e attacco propri (niente
  ventaglio), 32-48 cm (una foglia fa anche da gruppo di foglie). `supFogliame` da vicino dipinge
  ciuffetti di foglie di ~25 cm, ognuno col suo tono e un'ombra leggera fra l'uno e l'altro, su un
  dominio deformato (con celle regolari e il filo scuro netto la chioma sembrava un guscio di
  tartaruga: provato e corretto). Triangoli 5700-6700: il limite della prova del catalogo per
  «castagno vivo» passa da 6000 a 8000 (solo i sei castagni della Terrazza usano il dettaglio alto).
- Schermate: `prima-dopo-a05`, `-a17`, `-a18` (castagni della Terrazza), `-a07`, `-a08` (selva), `-s02` e `-a14` (larici).

### 10. Di notte il rilievo non si legge (alta, regressione) — fatto

`shaders/common.ts`, `worldMaterial.ts`, `shaders/natura.ts`, `scripts/shots.mjs`.
1. Di notte il raggio sempre dipinto si stringe: `np = mix(uPencil.xy, min(uPencil.xy, (70, 150)), uNight)`
   (il `min` lascia funzionare l'inquadratura 6, con `nearPaint` [6, 14]).
2. La carta notturna ha un minimo di luce `uAmbTop * 0.8 + uHazeColor * 0.25` e la stesura
   d'acquerello si fa leggera (la scena illuminata di notte è già buia: prima la carta era il buio
   per il buio); entro ~500 m, poi l'altra metà resta un fondale scuro.
3. Tratteggio e curve di livello in gesso chiaro, con un contrasto minimo entro ~500 m (oltre, le
   curve di livello dell'altra metà facevano cerchi concentrici nel cielo).
4. Sul non rilevato la foschia notturna è il 40% in meno (fino a ~650 m).
- Inquadratura nuova in `scripts/shots.mjs`: **7 «notte e rilievo»** (cerchio di 200 m attorno a
  Corbella rilevato con `setCellState`, ore 23:30, camera a 70 m; `after` rimette le celle com'erano).
- Misura (n7): prima rilevato e non rilevato avevano la stessa campitura blu-viola (L 0,12-0,15,
  il rilevato anzi un filo più chiaro); ora il non rilevato è carta chiara (L 0,21-0,23) e il
  dipinto scuro (L 0,10): circa il doppio, come chiedeva il giudizio (×1,5).
- Schermate: `prima-dopo-n7` (dall'alto), `-n9` (da terra), `-n8` (lo stesso di giorno, per confronto).

### 11. Prestazioni a Media su Iris Xe (media) — in parte

1. Fatto: `Vegetation.update` visita le celle dalla più vicina alla più lontana (spostamenti
   precalcolati e ordinati), quindi le istanze sono scritte più o meno dal davanti all'indietro;
   `Sottobosco` ordina le celle per distanza (prima la generazione e il disegno andavano a
   righe).
2. **Non fatto**: i settori angolari con `frustumCulled = true`. Costerebbero 30-60 draw call in
   più (5 specie × 3 parti × 4 settori ai LOD 1-2) contro un risparmio di vertici (fino a ~300 k
   triangoli fuori dallo schermo) che su una integrata pesa meno della sovrapposizione delle carte;
   resta la leva da provare con la scheda vera.
3. Fatto: `lampLight` esce subito di giorno (`uNight < 0.01`, ramo uniforme); di notte il ciclo
   delle pozze (nuovo, 24 lumi) guarda solo i lumi nella fascia di ±11 m attorno alla distanza del
   frammento e non parte oltre 132 m (vedi «Prestazioni»: di notte le pozze costano il 3-4%).
4. Leve pronte, non applicate: `media.vegetazione` 0,75 → 0,6; carte solo ai LOD 0-1 a Media (lo
   stesso meccanismo di Bassa, `carteLontane`).
5. Non misurabile qui (nessuna Iris Xe): i numeri di SwiftShader sono in «Prestazioni».
- Schermate: tabelle in «Prestazioni».

### 12. Picchi a ogni ridistribuzione (media) — fatto

`scene/vegetation.ts`, `scene/sottobosco.ts`: prima di `needsUpdate` si chiamano
`clearUpdateRanges()` e `addUpdateRange(0, count * 16)` (matrici) / `count * 4` (tinte): alla scheda
va solo la parte usata, non 11 MB di capienza (con zero istanze non si rimanda niente: senza
intervalli three.js rimanderebbe tutto). Tinte scritte per indice, niente `a.set([...])` né
`T2.set([...])`; `metti` è un metodo; contatori riusati. Tempi JS misurati in «Prestazioni».
- Schermate: tempi in «Prestazioni».

### 13. Qualità Automatica incompleta (media) — fatto

`game.ts`, `render/post/qualita.ts`, `tests/qualita.test.ts`.
- (a) `tempoGpu.inizio()` prima dei `sistemi.render`: la passata delle ombre è nel tempo GPU.
- (b) Soglia separata per il costo misurato: `sogliaCosto` 1/55 s (resta 1/44 s per l'intervallo fra
  i fotogrammi).
- (c) Il costo è `max(GPU, tempo CPU di render())`: un fotogramma lento per la CPU fa scendere.
- (d) `rimisuraQualita()` (pubblica): riparte dalla stima della scheda (anche verso l'alto) e rimisura.
  La chiama da sé il primo fotogramma in cui il ciclo esce dalla pausa del titolo, cioè l'ingresso
  in gioco (nuova partita o Continua), senza toccare la regia.
- (e) Non risolto: senza timer la mediana dell'intervallo resta quantizzata dal vsync.
- Tre prove nuove (soglia del costo, 20 ms senza timer, fotogramma lento per la CPU).
- Schermate: prove (`tests/qualita.test.ts`).

### 14. Le ombre degli alberi spariscono al LOD 1 (media) — fatto

`scene/vegetation.ts`, `game.ts`: proiettori d'ombra per specie (`alberi-<sp>-ombra` e
`alberi-<sp>-ombra-tronco`): masse e tronco del LOD 2 (la chioma intera, non il nucleo sotto le
carte), solo sul layer delle ombre (`layers.set(LAYER_OMBRE)`, `userData.ombra = true`), riempiti
nella stessa ridistribuzione con gli alberi entro `PROFILI_OMBRE[q].raggio + 14 m`
(`Vegetation.impostaRaggioOmbre`, chiamato da `Game.applicaOmbre`). Le masse e i tronchi dei LOD 0-2
non proiettano più. L'ombra di un albero ora sfuma con la zona d'ombra, non scatta al cambio di LOD;
e non è più quella del nucleo rimpicciolito.
- Schermate: `prima-dopo-a05` e `-a17` (ombre dei castagni a terra), `-a06`.

### 15. Collisori dei tronchi (media) — verificato, approvazione da chiedere

Prova nuova `tests/popolamento/castagni-liberi.test.ts`: costruisce vegetazione e paese come il
gioco (con `liberaCastagni`) e fallisce se un collisore `castagno` sta a meno di 1,5 m (dal bordo
del tronco) da un caposaldo della rete di Corbella o da un luogo delle missioni (esclusi interni,
cielo, montagne, alberi), o a meno di 4 m dal centro delle aree d'atterraggio del percorso facile
(Terrazza Pedrazzini, i Ronchi, il prato del Ronco, il balcone dei Messi sugli alpeggi). Passa: nessun
punto è ostruito, quindi in `aggiungiAlbero` non è servito saltare alberi. **Il cambio di gioco
(5140 → 23 275 tronchi) va comunque approvato esplicitamente** da chi decide il gioco.
- Schermate: prova `tests/popolamento/castagni-liberi.test.ts`.

### 16. Ombre del sottobosco (bassa) — in parte

`sottobosco.ts`: i sassi non proiettano più (`userData.ombra = false`). I cespugli sì, ancora con
l'override senza vento e senza la sfumatura: il supporto di `userData.materialeOmbra` in
`render/ombre.ts` (un materiale per oggetto nella passata d'ombra) non è fatto.
- Schermate: nessuna (differenza invisibile nelle inquadrature).

### 17. Vortici del Kuwahara (bassa) — fatto

`post/shaders.ts`: `A *= smoothstep(2e-5, 4e-4, l1 + l2)` nel Kuwahara anisotropo. Nella pennellata
orientata della passata finale la stessa guardia fece archi lunghi nel cielo (la direzione tornava
tutta al campo morbido): lì nelle zone piatte cala invece la forza della pennellata
(`mix(0.3, 0.6 + 0.4 A, energia)`).
- Schermate: il cielo e l'altra metà di `prima-dopo-a01`, `-s01`, `foglio-c2`.

### 18. Ripiego del mouse (bassa) — fatto

`core/input.ts`, `tests/input.test.ts`: se il blocco arriva dopo l'attesa si torna in modo
'blocco' (e si avvisa); un `pointermove` del mouse senza il tasto sinistro giù chiude il
trascinamento. Due prove nuove; l'aiuto `puntatore()` delle prove ora dà `buttons` come un mouse vero.
- Schermate: prove (`tests/input.test.ts`).

### 19. Bassa toglie poco (bassa) — fatto

`qualita.ts`, `vegetation.ts`, `sottobosco.ts`: a Bassa `vegetazione` 0,45 → 0,35; niente carte di
foglie ai LOD 2 e 3 (`carteLontane`); niente felci né fiori; fasce di passaggio fra i livelli larghe
×1,6 (senza Kuwahara la retinatura si vedeva a puntini).
- Schermate: `prima-dopo-a17` (triangoli −12%).

### 20. Perdite e allocazioni (bassa) — fatto

`m.dispose()` dopo `group.remove(m)` in `costruisciLontani`; `mix3` scrive in un `Vector3` (niente
tre array per fotogramma); `Ombre.render` usa un vettore di lavoro invece di `centro.clone()`;
`consumeMouse()` e `lookKeys()` restituiscono oggetti riusati; la chiusura di `stats.frame` è una
sola, creata una volta.
- Schermate: nessuna (codice).

## Come si regola

Dove stanno i numeri. Quelli in `post.parametri` e negli uniform si cambiano anche a gioco avviato,
dalla console di sviluppo (`__GAME__.game`); gli altri sono costanti nel codice o negli shader.

| Che cosa | Dove | Valore |
|---|---|---|
| Aria fra occhio e vetro delle Finestre (giorno) | `GLASS_FRAG` in `render/windows.ts` | 0,55 → 0,85 fra 250 e 1100 m; saturazione −50% |
| Costoloni nell'aria del vetro | `createWorldMaterial(u, { ariaVetro: true })`, uniform `uAriaVetro` | retinati via fra 350 e 600 m |
| Ore dorate, fase rosa, forza della luce | `computeSky` in `world/sky.ts` (`golden`, `rosa`, `forzaLuce` → `uSole.w`) | oro da `fromMid` 0,3; rosa con lit 0,22-0,95 |
| Viraggio dorato della post | `post.parametri.luciOro` | [1.08, 1.0, 0.86] × `sky.golden` |
| Foschia | `DEFAULT_HAZE` / `DEFAULT_ARIA` in `render/uniforms.ts` → `uHaze`, `uAria` | densità 1,4/900, velo 0,05, frazione in quota 0,16 |
| Contorni | `post.parametri.contorni`, `contorniLontano`, `distanzaContorni`, `sogliaContorni` | 0,35, 0,05, [30, 250], [0,03, 0,12] |
| Colore della post | `post.parametri.saturazione`, `vibranza` | 1,06, 0,12 |
| Pozze dei lumi | `uPozze` (scritto da `LampGlows.updateNearest`; `RAGGIO_POZZE` in `render/lamps.ts`), `POZZE_FORZA` e il raggio di 11 m in `lampLight` (`shaders/common.ts`) | 24 lumi entro 120 m, intensità 1,2 |
| Rilievo di notte | `paintState` e `schizzo` in `shaders/common.ts` | raggio dipinto (70, 150) di notte |
| Curvatura del terreno | alfa dei vertici (`terrainMesh.ts`), `curvT` in `worldMaterial.ts` | ±12%, fino a ~500 m |
| Sasso dei muri | `SUPERFICIE.SASSO` (16) in `render/superfici.ts` | — |
| Nucleo delle chiome | `impostaNucleo` in `scene/vegetation.ts` | 0,85 / 0,88 / 0,92 |
| Ombre degli alberi | `Vegetation.impostaRaggioOmbre(r)` | raggio di `PROFILI_OMBRE` + 14 m |
| Qualità automatica | `MISURA_PREDEFINITA.sogliaCosto`, `Game.rimisuraQualita()` | 1/55 s |
| Bassa | `PRESET_QUALITA.bassa.vegetazione`; sotto 0,5 niente carte lontane, felci, fiori | 0,35 |

## Prestazioni

Misure in Chromium + SwiftShader (rasterizzazione su CPU, 4 core, macchina condivisa con l'altra
area): valgono per il confronto fra le due build, non come millisecondi di una scheda vera. Il
tempo è quello di un fotogramma intero (`step(1)` + `readPixels`), mediana di 5, con le due build
aperte nello stesso browser e misurate alternate scena per scena; ripetendo la stessa scena la
differenza oscilla di ±3%.

**Tempo del fotogramma** (prima → dopo):

| Inquadratura | Qualità | ms prima → dopo | |
|---|---|---|---|
| c1 alba, castagno | Alta | 6851 → 6631 / 6579 → 6680 (due giri) | −3% / +2% |
| c2 terrazze | Alta | 6575 → 6395 | −3% |
| s02 asse verso il Sordo | Alta | 5853 → 5724 | −2% |
| a14 planata nella valle | Alta | 3801 → 3669 | −3% |
| a07 selva | Alta | 13939 → 11881 | −15% |
| a08 selva | Alta | 11905 → 12223 | +3% |
| a16 piazza | Media | 5576 → 5941 | +7% |
| a17 terrazza | Bassa | 2585 → 2289 | −11% |
| c5 notte, paese | Alta | 6029 → 6897 | +14% |
| s05 notte, paese | Alta | 7041 → 7381 | +5% |
| n9 notte, rilievo da terra | Alta | 6238 → 6870 | +10% |
| a11 notte, piazza | Alta | 9007 → 10328 | +15% |
| a12 notte, vicolo | Alta | 6355 → 7278 | +15% |

Di giorno siamo pari o un poco sotto (la foschia e la coltre più semplici da lontano, Bassa che
toglie davvero). **La notte costa il 5-15% in più**, ed è il prezzo di tre correzioni chieste dal
giudizio; misurate togliendole una alla volta (c5 / a11): le pozze dei lumi 4% / 3% (con il ciclo
già ristretto ai lumi nella fascia di ±11 m e spento oltre 132 m), il raggio dipinto più stretto di
notte (più carta, che costa più del dipinto) 2% / 5%, i bagliori dei lumi lontani più grandi e
accettati anche di taglio 0% / 2%; il resto (gesso, carta notturna) sta nel rumore della misura.
Le leve, se servono: `np` in `paintState` (70, 150), il numero di pozze (`MAX_POZZE`) e il loro
raggio.

**Draw call e triangoli** (passata principale, nelle stesse inquadrature delle schermate):

| Inquadratura | Qualità | Draw call prima → dopo | Triangoli prima → dopo |
|---|---|---|---|
| c1-alba-castagno | alta | 206 → 206 | 1,60 M → 1,61 M (+0,5%) |
| c2-terrazze | alta | 229 → 229 | 1,61 M → 1,61 M (+0,5%) |
| c3-planata-asse | alta | 171 → 171 | 0,66 M → 0,66 M (+0,2%) |
| c5-notte-paese | alta | 170 → 170 | 1,44 M → 1,44 M (+0,6%) |
| s02-asse-sordo | alta | 290 → 290 | 1,47 M → 1,49 M (+1,2%) |
| n7-notte-rilievo | alta | 164 → 164 | 1,20 M → 1,20 M (+0,8%) |
| a05-terrazza-castagni | alta | 141 → 141 | 1,25 M → 1,26 M (+0,6%) |
| a07-selva-ricci | alta | 284 → 284 | 1,66 M → 1,74 M (+5,0%) |
| a08-selva-nastri | alta | 280 → 280 | 1,68 M → 1,75 M (+4,5%) |
| a11-notte-piazza | alta | 211 → 211 | 1,17 M → 1,17 M (+0,1%) |
| a14-planata-valle | alta | 138 → 138 | 0,83 M → 0,83 M (−0,2%) |
| a16-piazza-media | media | 202 → 202 | 1,08 M → 1,08 M (+0,1%) |
| a17-terrazza-bassa | bassa | **125 → 117** | 0,88 M → 0,77 M (**−12,1%**) |
| a18-terrazza-media | media | 136 → 136 | 1,06 M → 1,07 M (+0,6%) |

Le draw call della passata principale non cambiano (a Bassa scendono: niente carte lontane, felci
e fiori). Nella passata delle ombre ogni specie ha due proiettori in più (`-ombra`,
`-ombra-tronco`) e perde le masse e i tronchi dei LOD 0-2. I triangoli crescono dello 0-1% (muri
smussati, castagni della Terrazza) e del 5% nella selva (carte del LOD 0 raddoppiate); a Bassa
scendono del 12%.

**Ridistribuzione della vegetazione** (JS, Media, undici passi di 13 m nella selva, come a piedi;
`Vegetation.update` e `Sottobosco.update` chiamati a mano):

| | prima | dopo |
|---|---|---|
| alberi, a ogni passo | 4,3-6,2 ms (picco 10,9) | 2,4-3,4 ms (picco 6,2) |
| sottobosco, a ogni cella nuova | 4,7-5,8 ms (prima cella 15,5) | 2,2-5,1 ms |

A questo si aggiunge il caricamento sulla scheda, che qui non si misura: ora va solo la parte usata
degli attributi delle istanze (intervalli di aggiornamento), non tutta la capienza.

## Fuori area e file condivisi

- **Vegetazione** (`src/scene/alberi.ts`, `bosco.ts`, `sottobosco.ts`): fanno parte dello stesso
  sistema di `vegetation.ts` (forme delle chiome, coltre dei boschi, sottobosco); nessun'altra area li
  tocca. Posizioni, numero e collisori degli alberi non cambiano.
- **`src/render/superfici.ts`** (motivi del materiale del mondo, usati anche dagli oggetti): tipo nuovo
  `SUPERFICIE.SASSO` (16) in coda (i valori esistenti non cambiano); `supErba`, `supFogliame`,
  `supTerra` e `applicaSuperficie` toccano l'aspetto delle superfici ERBA, FOGLIAME e TERRA anche
  degli oggetti dell'altra area (prato degli oggetti più vicino al terreno, ciuffi di foglie, niente
  faccette sulla terra battuta).
- **`scripts/shots.mjs`**: inquadratura 7 nuova («notte e rilievo»); dopo lo scatto rimette le
  celle com'erano (attorno a Corbella all'avvio ce ne sono di bianche, a matita e dipinte: rimetterle
  tutte a matita cambiava le inquadrature seguenti). Le schermate di `docs/shots/` rigenerate non
  sono nel commit.
- **Prove**: `tests/input.test.ts` (l'aiuto `puntatore()` dà `buttons` come un mouse vero; due prove
  nuove), `tests/qualita.test.ts` (tre prove nuove), `tests/oggetti/oggetti.test.ts` (limite dei
  triangoli del «castagno vivo» da 6000 a 8000: solo i sei castagni della Terrazza usano il dettaglio
  alto), nuove `tests/cielo-sera.test.ts` e `tests/popolamento/castagni-liberi.test.ts`.
- **Gameplay**: nulla. `SkyState.sunIntensity` e `night` sono identici a prima (le termiche del Velo
  in `game.ts` leggono `sunIntensity` con soglia 0,5; la luce dorata più forte passa da `forzaLuce`);
  orari, quote, collisori, posizioni e testi non cambiano. Il ripiego del mouse (`input.ts`) cambia
  solo come si entra e si esce dal trascinamento quando il blocco del puntatore arriva tardi.
- **API nuove** per chi lavora sugli shader o sulle impostazioni: uniform `uPozze` (vec4[24]) e
  `uAriaVetro`; opzione `ariaVetro` di `createWorldMaterial`; `SkyState.rosa` e `SkyState.forzaLuce`
  (in `uSole.w`); `StatoPost.oro` e il parametro `luciOro`; `OpzioniMisura.sogliaCosto` e il secondo
  argomento di `MisuraQualita.campione(dt, costo)`; `Game.rimisuraQualita()`;
  `Vegetation.impostaRaggioOmbre(r)`; l'esportazione `aggiorna(attr, quanti)` di `sottobosco.ts`;
  l'alfa dei vertici del terreno porta la curvatura (255 resta il vetro).

## Che cosa resta

1. **Prestazioni a Media su Iris Xe**: misurare con la scheda vera; poi, se serve, le leve pronte
   (`media.vegetazione` 0,6, carte solo ai LOD 0-1 a Media) e i settori angolari con il frustum
   culling (problema 11.2).
2. **Ombre dei cespugli** con il vento e la sfumatura: `userData.materialeOmbra` per oggetto in
   `render/ombre.ts` (problema 16).
3. **Qualità automatica senza timer**: la mediana dell'intervallo fra i fotogrammi resta quantizzata
   dal vsync (problema 13e).
4. **Ciglio dei gradoni del terreno**: la fascia scura di 0,5 m e i ciuffi che sporgono (problema 6;
   oggi c'è solo la luce della curvatura).
5. **Collisori dei castagni**: la prova passa (nessun punto ostruito), ma il passaggio da 5140 a
   23 275 tronchi va approvato da chi decide il gioco (problema 15).
6. **Per l'area «oggetti»** (visto nelle schermate, file non miei): la corona della piazza
   (`popolamento/forme.ts`, `coronaSulSuolo`) sceglie colore e variante per triangolo di 0,55 m:
   la terra battuta di a03 ha ancora triangoli di tono leggermente diverso, e i triangoli con
   `fine < 0.08` fanno la «toppa di ciottoli isolata» del giudizio. Basterebbe il colore per
   vertice (come `discoSulSuolo` con `piatto = false`) e i ciottoli a gruppi.
7. **Finestre**: la luminanza della striscia è a −17% del cielo attorno (obiettivo ±15%).
8. **Prato**: la saturazione è giusta, il tono resta più verde del bozzetto 2 (h ≈ 59° contro 44°):
   la palette chiesta dal giudizio (#7d8a4a) è verde oliva; per andare verso il bozzetto servirebbe
   più paglia nei prati al sole, scelta da fare guardando anche il resto del gioco.
