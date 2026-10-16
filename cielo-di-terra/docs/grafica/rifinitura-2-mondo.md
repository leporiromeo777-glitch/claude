# Rifinitura 2, area «mondo»

Ramo `grafica/rifinitura-2-mondo`, partito da `claude/jolly-archimedes-cm54mt` (5f64bba, unione 3).
Risponde al giudizio del direttore artistico sul giro 2 (media 4,3 su 24 scene): terzo alto
sbiadito, nero puro sotto il tasso, moiré delle curve di livello, notte coi valori invertiti, alba e
tramonto monocromi arancioni, superfici a «vetro rotto», alberi lontani a lecca-lecca, ombre fredde,
castagni a broccolo, Finestre a spigoli, teste dei muri a scaglie, nubi adesive, più le voci di
prestazioni, qualità automatica, collisori e ingresso.

Solo grafica e motore del disegno, salvo due voci dichiarate: i **collisori dei tronchi** (problema
17, tornano circa quanti erano prima del rifacimento) e le **frecce** sulla scala della Cripta e nel
percorso facile (problema 19, due righe). Quote, posizioni, contenuti, tempi e testi non cambiano; la
semina degli alberi è identica a prima (23 379 alberi dopo il popolamento, gli stessi).

Schermate in `docs/grafica/rifinitura-2-mondo/` (JPEG, 1280×720, Chromium + SwiftShader, qualità
Alta salvo dove scritto). Le inquadrature sono quelle del giudizio (a01-a16, b01-b08), i quattro
confronti (c1, c2, c3, c5) e qualche vista in più: a02b (a02 a Bassa), a08m (a08 a Media), m05, m17 e
m18 (Media, verso l'altra metà e i versanti lontani, per il moiré), s05 (provino 5, notte), n01 (notte
sulle terrazze). I setup sono in `inquadrature.mjs` (stessa API `__GAME__`). «Prima» è la build di
5f64bba con gli stessi setup.
- `foglio-c*.jpg`: bozzetto | prima | dopo (confronti 1, 2, 3, 5);
- `prima-dopo-*.jpg`: prima | dopo per le altre;
- `dopo-*.jpg`: la «dopo» a piena grandezza.

In breve (misure sui terzi dell'immagine: saturazione HSV media, pixel pallidi s<0,18 e v>0,7):

| | Prima | Dopo | Bozzetto |
|---|---|---|---|
| Confronto 1, terzo alto | s 0,22, 6% (parete color carne, 320°) | s 0,29, 12% (cielo blu, zona chiara in controluce) | s 0,39, 1% |
| Confronto 1, terzo basso | s 0,80 | s 0,66 | s 0,52 |
| Confronto 2, terzo alto | s 0,19, 44% | **s 0,41, 8%** | s 0,18, 64% (carta) |
| a08 tramonto, terzo basso | s 0,83 | s 0,70 | |
| Confronto 5, versante / cielo (luminanza) | 0,216 / 0,124: versante 1,74 volte il cielo | **0,091 / 0,116: 0,78 volte** | monti più scuri del cielo |
| a02, chioma del tasso a 1-2 m | (0, 0, 0) ad Alta e a Bassa | (14, 26, 15), a Bassa (15, 29, 16) | |
| a05, prato all'ombra dei castagni | (50, 59, 41) verde acqua | (97, 97, 49) oliva | oliva calda |
| Collisori dei tronchi | uno per albero (23 275 nel giudizio) | 5135, con gli stessi 23 379 alberi | 5140 prima del rifacimento |
| Curve di livello a Media (m05, m17, a08m) | anelli concentrici, increspature | spariti oltre ~5 px e 600 m | |
| Selciato, pietra, prato da vicino | vetrata, pelle di drago, mosaico | ciottoli 8-12 cm, giunti chiari, pennellate | |
| Finestre | strisce dagli spigoli dritti, riga bianca tratteggiata | niente fessura, bordo sfumato nella foschia | |

## Problema per problema

### 1. Terzo alto sbiadito (alta) — fatto

`render/uniforms.ts`, `render/shaders/common.ts`, `core/settings.ts`.
- Foschia: `DEFAULT_HAZE.density` da 1,4/900 a 0,9/900, `max` da 0,9 a 0,75 (come chiesto). Il velo
  dell'altra metà (`velo`) da 0,05 a 0,12, e in `applyHazeK` il tetto della copertura sale verso 0,82
  solo per i raggi che passano vicino all'asse (`raggioAlto`): con meno aria al suolo l'altra metà
  vista in su deve restare cielo blu, non terre nitide color crema.
- Quinte a piani: al posto del gradino `fract(dist/450)` (provato: sui versanti di scorcio disegnava
  fasce parallele nette, peggio delle «pareti») c'è una **quinta lontana** morbida: i raggi bassi
  sulla valle oltre 600-1400 m prendono fino al 42% di un azzurro-lilla `mix(uHazeColor,
  uHazeZenith, 0.45)`, anche all'alba e al tramonto (i monti a piani del bozzetto 1). Con le quinte a
  gradini che c'erano già (`uHaze.z`) i piani si leggono.
- Colore della foschia (`coloreFoschia`): di giorno i raggi verso l'altra metà prendono prima
  l'azzurro dello zenit (`alto` su 0,1-0,55 della distanza dall'asse invece di 0,2-0,75; di notte
  come prima). A metà strada il lilla-crema della foschia sopra le terre dipinte faceva la parete
  pallida; nel confronto 2 i pixel pallidi del terzo alto scendono da 14% a 8%.
- `schizzo()`: pigmento del non rilevato da `mix(0.6, 0.88, lontano)` a `mix(0.75, 1.0, lontano)`;
  carta virata all'aria da 0,3 a 0,12; i bordi delle pozze d'acquerello calano da lontano.
- `nearPaint` da [250, 450] a [400, 700] (`DEFAULT_SETTINGS` e `uPencil`), con la migrazione v2→v3
  sul modello di v1 (`SETTINGS_VERSION` 3, chiave `cielo-di-terra.settings.v3`, la v2 si legge e
  perde solo `nearPaint`). Prove in `tests/luce.test.ts`.
- Misure (terzo alto: saturazione HSV media / pixel pallidi s<0,18 e v>0,7):
  - confronto 2: prima 0,19 / 44%, dopo **0,41 / 8%** (obiettivo ≥ 0,32 e < 10%: raggiunto);
  - confronto 1: prima 0,22 / 6%, dopo **0,29 / 12%** (bozzetto 0,39 / 1%): migliora ma non arriva
    all'obiettivo. Il «prima» aveva pochi pixel pallidi perché la parete era color carne (tinta
    320°, saturazione appena sopra la soglia); ora la parete non c'è più, ma resta una zona chiara
    grigio-beige sopra il bagliore del sole, a destra della Finestra (terreno lontano in controluce,
    vedi «Che cosa resta»);
  - a16: prima 0,21 / 12%, dopo 0,27 / 24% (la stessa zona in controluce, più grande in questa
    inquadratura); a12: prima 0,32 / 27%, dopo 0,40 / 10%; m17 (Media): prima 0,34 / 45% nel terzo di
    mezzo, dopo 0,50 / 4%.
- Schermate: `foglio-c1`, `foglio-c2`, `prima-dopo-a05`, `-a12`, `-a15`, `-a16`.

### 2. Nero puro sotto il tasso (alta, bloccante) — fatto

`render/post/shaders.ts`, `render/shaders/common.ts`, `render/superfici.ts`, `render/shaders/natura.ts`,
`render/naturaMateriali.ts`.
- La causa non era un NaN: con una sonda sul pixel il valore del mondo sotto il tasso era sano
  (verde scuro ~0,05), e i controlli `isnan` non scattavano mai. Lo azzeravano la post: il piede
  dell'ACES (0,1 → 0,05, 0,05 → 0,01) e poi il contrasto a S attorno al perno, che sotto 0,02 portava
  il valore **sotto lo zero** (poi tagliato a 0). A Bassa c'è la stessa mappatura dei toni, per
  questo restava nero anche lì.
- Post: `acesSrgb` non scende sotto il 70% del valore dipinto (conta solo sotto ~0,2); il contrasto
  a S verso il nero si spegne (`piede = smoothstep(0.0, 0.22, l)` sul solo lato scuro).
- Fogliame (`Sup.avvolge`, campo nuovo): luce avvolgente come chiesto. In `shadeSup`, per avvolge
  = 1: `sh = mix(1.0, sh, 0.65)`, `hemi = 0.35 + 0.65*hemi`, albedo mai sotto 0,25 di luminanza (0,16
  era ancora troppo scuro dopo la post), più un poco di cielo filtrato fra le foglie
  (`uAmbTop * 0.26 * avvolge`). Avvolge vale 1 per `SUP.FOGLIAME` e per le chiome dipinte, 0,8 per le
  carte di foglie, 0,6 per l'erba, 0,5 per le masse dei boschi.
- Il punto (a), la normale girata sulle facce posteriori, c'era già (`worldMaterial.ts` riga 120).
  Non fatti (b) e (c): la protezione dai NaN non serviva (la causa era un'altra) e la dissolvenza
  vicino alla camera mette un `discard` in tutti i materiali del mondo con `FOGLIAME`, proprio quello
  che il problema 15 toglie.
- Misura (a02, la chioma a 1-2 m): prima (0, 0, 0) su un quarto dello schermo; dopo verde scuro
  (14, 26, 15) ad Alta e (15, 29, 16) a Bassa (luminanza 0,09-0,10: sotto il tasso c'è davvero poca
  luce, ma è verde). I sottosquadri delle chiome vicine in a04 salgono da 5-11/255 ad almeno
  16-18/255 (1° percentile della zona delle chiome).
- Schermate: `prima-dopo-a02`, `-a02b` (Bassa), `-a04`.

### 3. Anelli e moiré delle curve di livello (alta, bloccante) — fatto

`render/shaders/common.ts`.
- `segniMatita()`: `contour *= (1.0 - smoothstep(0.10, 0.25, fw)) * (1.0 - smoothstep(600.0, 1000.0,
  dist))`, e il tetto di `cstep` da 5 a 7.
- Restava un secondo moiré, le «increspature ondulate» di a08 e a09 ad Alta: non erano curve di
  livello ma le stesure d'acquerello (`rumoreStabile2` scalato con la sola distanza): di scorcio
  sull'altra metà l'impronta del pixel è molto più lunga che larga, e le macchie diventavano onde a
  pecorelle. Ora le stesure si misurano col lato lungo dell'impronta (`pixS = max(pix,
  length(fwidth(uv)) * 0.75)`), e i bordi delle pozze calano da lontano.
- Verifica a Media: `prima-dopo-m05` e `-m17` (come le foto e2e 05 e 17), `-m18`, `-a08m`; ad Alta
  `-a08`, `-a09`. Gli anelli concentrici spariscono; resta la grana di carta e pigmento.

### 4. Notte coi valori invertiti (alta, bloccante) — fatto

`render/shaders/common.ts`, `render/worldMaterial.ts`, `render/shaders/natura.ts`, `world/sky.ts`.
- `schizzo()`, i valori chiesti: `cartaBuio = uAmbTop*0.30 + sole*0.10 + uHazeColor*0.08`; il ramo
  vicino `uAmbTop*0.42 + uHazeColor*0.10` entro 80-150 m; gesso `wc*1.35 + 0.03`; il rinforzo
  notturno dell'inchiostro con `smoothstep(0.05, 0.25, ink)*0.08` invece di `0.12*step(0.02, ink)`
  (era lui il retino a puntini) e solo entro 120-200 m.
- Il non rilevato di notte stava «meno dietro l'aria» (`hazeK` 0,67): con la carta scura e il cielo
  chiaro ci vuole il contrario, i versanti fanno quinte più chiare con la distanza. Ora 0,95 (mondo e
  natura). Il velo dell'altra metà di notte è più spesso (×2,6) e la copertura arriva a 0,9: l'altra
  metà è il cielo. `hazeNight` e `zenithNight` un filo più chiari (0x434c94, 0x323f88).
- Misura (confronto 5): luminanza del versante a sinistra del campanile 0,091 contro 0,116 del cielo
  sopra il paese, rapporto **0,78** (obiettivo ≤ 0,8; prima 0,216 contro 0,124, cioè 1,74: il
  versante era più chiaro del cielo). Nel bozzetto 5 i monti sono sagome scure sotto un cielo più
  chiaro: ora anche da noi, e il paese acceso risalta.
- Schermate: `foglio-c5`, `prima-dopo-a10`, `-a11`, `-s05`, `-n01`, `-b05`, `-b06`, `-b07`.

### 5. Alba e tramonto monocromi arancioni (alta) — fatto

`world/sky.ts`, `render/post/pipeline.ts`, `render/shaders/common.ts`.
- I valori chiesti: `hazeGold` 0xc6bfd9, `zenithGold` 0x6688cc, `ambBotGold` 0x857a8e, `luciOro`
  [1,04, 1,0, 0,93], key `mix(1.0, 1.25, uGolden)`, fill `mix(1.0, 0.92, uGolden)`. `warmK` è sceso
  fino a 0,5 (con 0,6 il prato in luce radente restava arancione pieno).
- In più: `sunGold` da 0xffaa66 a 0xffc890 e `hazeSunGold` da 0xffa452 a 0xffb870 (meno saturi); il
  bagliore in avanti del sole più raccolto (lobo 9 invece di 7, forza 0,95 invece di 1,15): l'oro sta
  dal lato del sole. Nelle ore dorate la post toglie l'8% di saturazione e il 60% della vibranza (la
  luce scalda già tutto). La quinta lontana del problema 1 tiene lilla-azzurri i monti lontani, e
  nelle ore dorate è più spessa e più azzurra (0,6 invece di 0,42, 65% di zenit): la terra in luce
  radente è arancione, e un velo lilla leggero la ingrigiva invece di farne un monte azzurro. Sempre
  nelle ore dorate l'altra metà sta dietro almeno il 75% d'aria (per i raggi verso l'asse) e il
  bagliore del sole non sale verso lo zenit (0,2 invece di 0,55 del suo peso in alto): l'oro del sole
  mescolato all'azzurro faceva un grigio rosato.
  `hazeRosa` da 0xe0909a a 0xe88c86, perché partendo dalla foschia lilla la fase rosa restava viola
  (prova `cielo-sera`).
- Misure (saturazione HSV media dei terzi):
  - confronto 1: terzo basso 0,80 → **0,66** (bozzetto 0,52; l'obiettivo ≤ 0,6 non è raggiunto: è
    il prato in luce radente sotto il castagno). Il terzo alto passa da una tinta media di 320°
    (rosa-carne) a 33°; con la stessa misura il bozzetto 1 dà 25°, perché il suo terzo alto comprende
    il bagliore dorato e la chioma. Il solo cielo ora è blu (`foglio-c1`), la parete color carne non
    c'è più;
  - a08: 0,83 → **0,70** (uguale a Media, a08m); a13: 0,79 → **0,69**; a16: 0,72 → **0,58**;
  - a09 (fase rosa): il terzo alto resta rosa-viola (275°), il basso scende da 0,48 a 0,39.
- Schermate: `foglio-c1`, `prima-dopo-a08`, `-a09`, `-a13`, `-a16`.

### 6. Superfici a «vetro rotto» (alta) — fatto

`render/superfici.ts`, `render/shaders/terreno.ts`.
- `supPietra`: una tinta per pietra con ±10% di valore e appena un'ombra di caldo/freddo (prima
  quattro tinte: ocra, bruno, azzurrino, neutro, cioè la vetrata, blu di notte); giunto
  `smoothstep(0.008, 0.03)` e colore `c*0.72` col muschio leggero; incavo del giunto da 8 a 2 mm (le
  sue pareti ripide facevano il contorno scuro); occlusione del giunto 0,88 invece di 0,72.
- Selciato (`supSelciato`, nuovo): ciottoli a `uv*4.5` (8-12 cm), il disegno sfuma oltre ~6 m
  (`visMotivo(pix, 0.6)`) in una variazione di tono larga; rilievo più basso. Di notte nessuna cella
  vira più al blu (non ci sono più tinte fredde per pietra).
- `supIntonaco`: la pietra sotto le scrostature `c*vec3(0.68, 0.65, 0.6)` (grigio caldo), giunti a
  0,8 invece di 0,45, orlo 0,1. `supRoccia` (ponte, rocce): crepe sottili `c*0.72`.
- Prato (`terreno.ts`): `tocchi()` con `k = smoothstep(0.0, 0.8, vo.x)` (niente tessere a bordo
  netto), peso dei tocchi 0,3-0,45 invece di 0,42-0,58, tocchi fini sostituiti da pennellate di
  rumore di 20-40 cm appena allungate. Le pennellate lunghe `vec2(0.5, 5.0)` proposte, di scorcio,
  diventavano raggi verso l'orizzonte: le ho accorciate.
- Schermate: `prima-dopo-a02`, `-a10`, `-b07`, `-b08` (selciato), `-a03`, `-a05` (prato), `-a14`
  (ponte), `-b06` (muro), `-a01` (intonaco del campanile).

### 7. Alberi lontani a lecca-lecca (alta) — fatto in parte (1 e 2 sì, 3 e 4 no)

`scene/vegetation.ts`, `render/shaders/common.ts`, `render/worldMaterial.ts`, `render/uniforms.ts`,
`scene/alberi.ts`.
- (1) **Ombra degli alberi a terra**: `Vegetation.costruisciOmbraAlberi()` scrive una texture R8
  1024×768 su tutto il cilindro (~4 m per texel, u = θ/360, v = z/L) con un disco morbido per albero
  largo quanto la chioma (`RAGGIO_CHIOMA` per specie × scala dell'istanza); si rifà quando il
  popolamento toglie alberi. Il terreno la legge (`ombraAlberi()` in common.ts) spostata verso la
  luce di 5,5 m / elevazione (al più 24 m), cioè dove sta la chioma che fa ombra, e moltiplica
  l'albedo per `1 - densità * 0.45` di giorno, più un 12% d'occlusione proprio sotto. Vale solo
  oltre la zona delle ombre portate (lì le fa la mappa d'ombra), con il passaggio fra 0,8 e 1 del
  suo raggio. Uniform nuove `uAlberiOmbra`, `uAlberiInfo`.
- (2) Tronco visibile da lontano: i fusti degli impostori LOD 2-3 più grossi e un po' più alti
  (castagno ×1,7 e +2,4 m al LOD 3, ×1,45 al LOD 2; noce ×1,8 / ×1,4; betulla ×2; larice ×1,9).
- (3) Distribuzione a gruppi di 5-15 alberi: **non fatta**. Cambia posizioni degli alberi e quindi
  dei collisori (il test `castagni-liberi` e il percorso lo tengono d'occhio), e i prati hanno già i
  gruppi dal rumore `gruppi` della semina.
- (4) Coltre di `scene/bosco.ts` sui pendii oltre 25°: **non fatta** (file della traccia «natura»,
  fuori dall'elenco della mia area, e sposta il bilancio dei triangoli dei versanti). Resta da fare.
- Schermate: `foglio-c2`, `prima-dopo-a05`, `-a12`, `-a15`, `-a01`.

### 8. Ombre fredde e scure (media) — fatto

`render/post/pipeline.ts`, `render/shaders/common.ts`, `render/shaders/natura.ts`.
- `ombre` della post di giorno da [0,96, 0,975, 1,05] a [1,0, 0,99, 0,97] (notte invariata).
- `shadeSup`: luce rimbalzata dal suolo dove la luce principale non arriva, `uAmbBottom * 0.25 *
  occ * (1 - b) * (1 - uNight)` (b comprende già l'ombra portata).
- Ciuffi d'erba (`erbaDipinta`, il materiale del sottobosco): basi paglia `(0.96, 0.96, 0.9)` invece
  di fredde, luminanza minima 0,25, occlusione alla base 0,8 invece di 0,62, `trasm` 0,55 (era 0,85:
  in controluce la base si spegneva), avvolge 0,6.
- Misura (a05, prato all'ombra dei castagni): (50, 59, 41) verde acqua scuro prima, (97, 97, 49) oliva calda dopo (luminanza 0,22 → 0,37).
- Schermate: `prima-dopo-a05`, `-a04`, `-a11`, `-a14`, `-b05`.

### 9. Castagni a broccolo (media) — fatto

`oggetti/oggetti/castagno.ts`, `scene/vegetation.ts`, `scene/alberi.ts`, `render/naturaMateriali.ts`.
- Castagno (oggetto del paese e delle terrazze): al dettaglio alto il nucleo `geoMassa` è al 72% del
  raggio (era 86%) e più oliva; sopra, il guscio di carte di foglie: 700 ciuffi invece di 560,
  foglie più lunghe e larghe, attacco nel guscio fra 0,8 e 1 del raggio. Tinte d'autunno: più di
  metà verde oliva chiaro attorno a 0x8a8f45, un terzo oro 0xc8a040 e qualche ruggine (0x9a6234: la
  0xa0522d piena, sotto la luce calda, diventava rosso vivo). Il fogliame dichiara `SUP.FOGLIAME`
  (prende la luce avvolgente del problema 2).
- Castagni della vegetazione: le cinque tinte verdi più chiare, verso lo stesso oliva; chiome e
  carte con la luce avvolgente.
- Larici (a13): gli aghi trasmettono metà luce (`trasm` 0,5): in controluce erano candelotti arancioni.
- Schermate: `prima-dopo-a04`, `-a16`, `-a06`, `-a13`, `foglio-c2`.

### 10. Finestre a spigoli e trattini bianchi (media) — fatto

`render/windows.ts`, `render/worldMaterial.ts`, `render/terrainMesh.ts`.
- Il trattino bianco lungo il bordo non erano i costoloni: era una **fessura** fra il terreno e il
  vetro. Il terreno scarta i triangoli del vetro (alfa del vertice 1) a metà fra l'ultimo vertice di
  riva e il primo di vetro, e da lontano (celle di 24 m) fra i due restava una riga del colore di
  sfondo. Ora la striscia del vetro sborda di `MARGINE_VETRO` = 30 m sotto le rive.
- Bordo morbido: negli ultimi 35 m verso la riva il vetro si mescola per metà alla foschia del
  terreno di bordo (oltre 80-300 m di distanza); la brina sparisce quasi del tutto oltre 500 m.
- Costoloni (`ARIA_VETRO`): niente più retinatura; fra 350 e 600 m il ferro sfuma nel colore del vetro
  lontano (aria velata a mezza saturazione, di notte il vetro scuro), oltre 650 m non si disegna.
- Schermate: `foglio-c1`, `prima-dopo-a03`, `-a16`, `-a14`, `-a02`.

### 11. Teste dei muri a scaglie (media) — fatto

`oggetti/oggetti/muri.ts`.
- `sassoTesta` nuovo: una cupola irregolare a base piatta (anello di 8 vertici a terra, 8 a metà
  altezza, cima; 24 triangoli a vertici condivisi), con normali morbide. Era un icosaedro schiacciato
  (`geoMasso` a dettaglio 0, 20 facce) che di taglio sembrava una scaglia. Il dettaglio 2 proposto
  costa 180 triangoli per testa (il dettaglio 1, 80) su migliaia di teste: la cupola dà il dorso
  tondo con 24.
- Scala y da 0,6 a 0,75; sopra calcare caldo `mescola(0xb0a68e, …)` invece di gneiss ×0,8 (che di
  sera virava al lilla); niente macchie per vertice (disegnavano schegge dai bordi neri); superficie
  `SUP.SASSO` sulle teste, occlusione al piede; muschio su una testa su cinque.
- `pietraCuscino` (i conci sporgenti dei gradoni, che stanno in `muri.ts` e non in
  `popolamento/terrazzi.ts`): dorso tondo con i punti di mezzo dei lati lunghi sollevati (6
  triangoli; la prova dei triangoli del muro a dettaglio basso resta sotto 3000).
- La **scheggia triangolare dorata** sopra il muro in a09 nella «dopo» non c'è più: ingrandita, era
  una testa del muro a icosaedro vista di taglio e accesa dal tramonto, e sparisce con le teste nuove.
  (Una prima sonda sul pixel, a qualità Bassa, l'aveva attribuita alla mesh `corbella:cripta`: se
  ricomparisse in un'altra inquadratura, è lì che va cercata.)
- Schermate: `prima-dopo-a08`, `-a09`, `-a16`, `-b06`.

### 12. Nubi del Collare adesive, suggerimenti illeggibili (bassa) — fatto

`render/collare.ts`, `ui/componenti/indicazioni.css` (fuori area, modifica piccola).
- Nubi: base verso il blu da −30% a −15% (`ombra * 0.85 * vec3(0.96, 0.98, 1.04)`), lato in ombra
  0,7 invece di 0,55, la frangia del contorno solo sul bordo dello sbuffo (dentro pieno: niente buchi
  d'azzurro fra sbuffo e sbuffo), bordo della nube intera morbido in alfa sull'ultimo 20% del raggio,
  meno variazione di pennellata; all'alba e al tramonto la luce del lato verso la Linea è più calda
  (`mix(0.35, 0.1, uGolden)` di bianco).
- `.ui-hud-suggerimento`: fondo `rgba(20, 14, 8, 0.42)`, padding 2px 10px, raggio 4px, font-weight 500.
- Schermate: `prima-dopo-a01`, `-a03`, `-a16`, `foglio-c1`, `-b08` (interfaccia).

### 13. Qualità automatica decisa una volta sola (media) — fatto

`game.ts`, `render/post/qualita.ts`, `tests/qualita.test.ts`.
- Riarmo: in `Game.render`, la prima volta che la partita è in corso, non in pausa, con la camera
  all'aperto (`player.cyl.h > suolo - 1`, `heightAboveGround > -0.5`) e di giorno (`sky.night < 0.3`),
  la misura riparte dalla stima (`rimisuraQualita()`), una volta sola.
- Sorveglianza lenta (`OpzioniMisura.sorveglianza`, predefinita `{ durata: 600, periodo: 60,
  finestra: 5, soglia: 1/58 }`): dopo la misura iniziale, per 10 minuti, una finestra di 5 s ogni
  60 s; se la mediana del costo GPU misurato supera 1/58 s si scende di un gradino. Solo verso il
  basso e solo col costo GPU (con l'intervallo fra fotogrammi, quantizzato dal vsync, non giudica).
  Il cronometro GPU gira solo nelle finestre (`MisuraQualita.vuoleCosto`).
- Gradino **«Media ridotta»** (`GradinoQualita`, `PRESET_GRADINI.mediaRidotta`): Media con `scala`
  0,8, filtro, contorni e ombre accesi. Sta fra Media e Bassa nella misura (`gradinoSotto`); il suo
  `livello` resta 'media' (interfaccia, paese e personaggi la trattano come Media). `maxCambi` da 2 a
  3. Il pannello F3 scrive il gradino.
- Prove nuove in `tests/qualita.test.ts`: la scala dei gradini, Media ridotta, la sorveglianza
  (scende solo con la mediana sopra soglia, solo nelle finestre, mai sopra, mai dopo 10 minuti, mai
  sotto Bassa, ignora i campioni senza costo).

### 14. Margine dei 60 fps a Media (media) — fatto in parte

`render/post/qualita.ts`, `scene/vegetation.ts`.
- `PRESET_QUALITA.media.vegetazione` da 0,75 a 0,6, e sotto 0,8 niente carte di foglie ai LOD 2 e 3
  (`Vegetation.impostaQualita`: prima solo sotto 0,5, cioè a Bassa).
- La `scala` 0,85 a Media non l'ho messa: c'è ora il gradino «Media ridotta» (0,8) che l'automatica
  prende da sola se la Media non regge. La misura su una Iris Xe vera resta da fare (qui c'è solo
  SwiftShader): vedi «Prestazioni».

### 15. `discard` dei costoloni fuori da ogni `#ifdef` (media) — fatto

`render/worldMaterial.ts`, `render/terrainMesh.ts`, `game.ts`.
- `defines.ARIA_VETRO` quando `opts.ariaVetro`; il `discard` (ora solo oltre 650 m) e il blocco del
  velo stanno dentro `#ifdef ARIA_VETRO`. L'uniform `uAriaVetro` non c'è più.
- Anche il facoltativo: il `discard` del vetro nel terreno sta in `#ifdef VETRO_TERRENO` (opzione
  `vetro` di `createWorldMaterial`). `TerrainSystem` riceve due materiali e dà quello col discard
  solo ai chunk che contengono vertici di vetro (`haVetro`: alfa di `aColor` sopra 200). Gli altri
  chunk, il paese, i muri, gli oggetti, le nubi e i personaggi non hanno più `discard` nel programma.

### 16. Passata finale alla densità piena del canvas (media) — fatto

`render/post/qualita.ts`, `game.ts`.
- `PresetQualita.maxPixelRatioCanvas` (Bassa 1, Media 1,5, Alta 2; Media ridotta come Media);
  `Game.resize` usa `min(dpr, 2, preset.maxPixelRatioCanvas)`. A Bassa su uno schermo Retina la
  passata finale lavora ora sui pixel CSS (prima il quadruplo).
- `Game.seguiDensita()`: `matchMedia('(resolution: Xdppx)')`, ricreato a ogni cambio, chiama
  `resize()` (finestra spostata su un altro schermo). Spento in e2e.

### 17. Collisori dei tronchi 23 275 invece di 5140 (media) — fatto

`scene/vegetation.ts`, `scene/sottobosco.ts`, `tests/popolamento/castagni-liberi.test.ts`.
- In attesa dell'approvazione esplicita, il collisore ce l'hanno solo i tronchi **dove si cammina**
  (`COLLISORI_SOLO_DOVE_SI_CAMMINA = true`): tutti gli alberi sparsi (prati, filari, castagni da
  frutto, cipressi) e, nei boschi, quelli entro 450 m dal paese, entro `RAGGIO_CAMMINO` = 60 m da un
  sentiero o da un luogo del gioco (luoghi non interni né di cielo, capisaldi della rete di Corbella).
  Nel fitto lontano da tutto i tronchi restano senza collisore, come i rami.
- Risultato: **5135** tronchi con collisore (prima del rifacimento 5140, nel giro 2 23 275).
- La semina non cambia: i tronchi senza collisore finiscono in un `ColliderWorld` privato
  (`tronchiLiberi`) che la semina interroga come prima (gli alberi seguenti ne tengono la distanza) e
  che il sottobosco usa per non far crescere l'erba dentro i fusti. Né la camera né la fisica lo
  vedono. Stessi alberi, stesse posizioni (23 379 dopo il popolamento).
- `castagni-liberi` resta e controlla anche il nuovo conto (fra 3000 e 8000 collisori, più di 10 000
  alberi). Con `false` si torna a tutti i tronchi col collisore.

### 18. Due voronoi per frammento nelle masse dei boschi (bassa) — fatto

`render/naturaMateriali.ts`, ramo `BOSCO`.
- `voB` (6,5 m) solo se `lonB < 1`; quella dei gruppi (26 m) solo se `lonB > 0` **e** sul margine del
  bosco (copertura `vInfo.z < 0.68`: altrove il test del discard passa comunque). Il valore che manca
  vale 0,5.
- In più, da lontano i gruppi del bosco sono macchie di rumore e non celle: le celle di 26 m col filo
  scuro fra l'una e l'altra facevano sui versanti un selciato di ciottoli grandi (il «pluriball»
  tornato in forma di sassi). Anche la «valle» più scura è di rumore.

### 19. Frecce che spingono e salgono (bassa) — fatto

`regia/percorso.ts`, `regia/regia.ts` (fuori area, una riga ciascuno).
- `percorso.ts`: tolto `'ArrowUp'` da `spinge`.
- Scala della Cripta: W e Spazio salgono, S scende; ↑ ↓ girano solo lo sguardo, come altrove.

### 20. `preventDefault` di Spazio, ↑ e ↓ sui controlli (bassa) — fatto

`core/input.ts`, `tests/input.test.ts`.
- `preventDefault` su Spazio e su tutte le frecce solo quando il gioco ha la tastiera:
  `!bloccoInterfaccia && !campoDiTesto(e.target)`. Con un modale aperto o il fuoco su un cursore,
  ↑ ↓ muovono il cursore e Spazio preme il pulsante. Prova nuova in `tests/input.test.ts`.

## Come si regola

| Che cosa | Dove | Valore |
|---|---|---|
| Foschia: densità, copertura, piani, velo dell'altra metà | `DEFAULT_HAZE` in `render/uniforms.ts` (uniform `uHaze`) | 0,9/900, 0,75, 0,5, 0,12 |
| Quinta lontana azzurro-lilla | `applyHazeK` in `shaders/common.ts`: `qL` | 600-1400 m, 0,42 |
| Tetto del velo sui raggi verso l'altra metà | `applyHazeK`: `mix(uHaze.y, 0.82, rA)`, di notte 0,9 | |
| Ore dorate: quinta lontana e velo dell'altra metà | `applyHazeK`: `mix(0.42, 0.6, uGolden)`, `mix(0.45, 0.65, uGolden)` di zenit, `rA * 0.75 * uGolden` | |
| Azzurro dello zenit verso l'altra metà | `coloreFoschia`: `alto` su 0,1-0,55 di giorno (0,2-0,75 di notte); bagliore del sole in alto `mix(0.55, 0.2, uGolden)` | |
| Colore del non rilevato, carta virata all'aria | `schizzo()`: `mix(0.75, 1.0, lontano)`, `* 0.12` | |
| Raggio sempre dipinto | impostazione `nearPaint` (uniform `uPencil.xy`), archivio v3 | [400, 700] |
| Carta e gesso di notte | `schizzo()`: `cartaBuio`, `cartaVicina` (80-150 m), `lineC` | |
| Ore dorate | `PAL` in `world/sky.ts` (`hazeGold`, `zenithGold`, `ambBotGold`, `sunGold`, `hazeSunGold`, `hazeRosa`); `luciOro` in `PARAMETRI_PREDEFINITI` (post); `warmK`/`key`/`fill` in `shadeSup` | |
| Ombre della post (giorno) | `PARAMETRI_PREDEFINITI.ombre` | [1,0, 0,99, 0,97] |
| Piede dei toni | `acesSrgb` (post/shaders.ts): `max(a, c * 0.7)`; `correggi`: `piede` 0-0,22 | |
| Luce avvolgente del fogliame | campo `Sup.avvolge` (0..1), letto in `shadeSup` | FOGLIAME e chiome 1, carte 0,8, erba 0,6, boschi 0,5 |
| Rimbalzo nelle ombre | `shadeSup`: `uAmbBottom * 0.25 * …` | |
| Ombra degli alberi lontani | uniform `uAlberiOmbra` (texture R8 1024×768, `OMBRA_W/H`), `uAlberiInfo` (x acceso, **y forza**, 0,45); `RAGGIO_CHIOMA` per specie in `scene/vegetation.ts` | |
| Moiré delle curve di livello | `segniMatita()`: `smoothstep(0.10, 0.25, fw)`, 600-1000 m | |
| Stesure di scorcio | `schizzo()`: `pixS` (lato lungo dell'impronta × 0,75) | |
| Selciato | `supSelciato` in `render/superfici.ts`: `uv*4.5`, `visMotivo(pix, 0.6)` | |
| Bordo delle Finestre | `MARGINE_VETRO` (30 m) in `render/windows.ts`; `bordoMorbido` 35 m, 50% | |
| Costoloni | define `ARIA_VETRO` (`ariaVetro: true`): sfumano 350-600 m, oltre 650 m niente | |
| Discard del vetro nel terreno | define `VETRO_TERRENO` (`vetro: true`), solo nei chunk con vetro | |
| Collisori dei tronchi | `COLLISORI_SOLO_DOVE_SI_CAMMINA`, `RAGGIO_CAMMINO` (60 m) in `scene/vegetation.ts` | `true`, 60 |
| Qualità automatica | `MISURA_PREDEFINITA` (`maxCambi` 3, `sorveglianza`), `PRESET_GRADINI` (`mediaRidotta.scala` 0,8), `maxPixelRatioCanvas` per preset in `render/post/qualita.ts` | |
| Vegetazione a Media | `PRESET_QUALITA.media.vegetazione` 0,6; soglia delle carte lontane `k >= 0.8` in `Vegetation.impostaQualita` | |

API nuove (tutte additive, `window.__GAME__` invariata):
- `Game.gradinoQualita` (`'alta' | 'media' | 'mediaRidotta' | 'bassa'`); `livelloQualita` resta
  `'alta' | 'media' | 'bassa'` (Media ridotta vale 'media').
- `render/post/qualita.ts`: tipo `GradinoQualita`, `PRESET_GRADINI`, `gradinoSotto()`,
  `PresetQualita.maxPixelRatioCanvas`, `OpzioniMisura.sorveglianza`, `MisuraQualita.conclusa` e
  `.vuoleCosto` (`finita` resta: fine della misura iniziale).
- `render/uniforms.ts`: `uAlberiOmbra`, `uAlberiInfo`, `alberiOmbraVuota()`.
- `render/worldMaterial.ts`: opzione `vetro` (define `VETRO_TERRENO`); `ariaVetro` ora è il define
  `ARIA_VETRO` (l'uniform `uAriaVetro` non c'è più).
- `TerrainSystem(material, materialeVetro?)`.
- GLSL: `struct Sup` ha il campo `avvolge` (0 in `supBase`); `ombraAlberi(P, up)`.
- `Vegetation.collisoriTronchi`, `COLLISORI_SOLO_DOVE_SI_CAMMINA`; `Sottobosco` accetta un quarto
  argomento facoltativo (`tronchiLiberi`).
- Impostazioni: `SETTINGS_VERSION` 3, chiave `cielo-di-terra.settings.v3`, migrazione da v2.

## Prestazioni

SwiftShader (Chromium headless, 1280×720), `__GAME__.misuraPassi(3)`: le due build aperte in due
pagine, stesse inquadrature, misure alternate, il minimo di due prove. Valgono solo come confronto
relativo.

| Inquadratura (qualità) | Prima | Dopo | |
|---|---|---|---|
| c1 alba (Alta) | 7242 ms, 216 draw, 1,73 M tri | 7228 ms, 217 draw, 1,81 M tri | 0% |
| c2 terrazze (Alta) | 7706 ms, 248 draw, 1,92 M tri | 7901 ms, 249 draw, 2,00 M tri | +3% |
| c2 terrazze (Media) | 4034 ms, 243 draw, 1,71 M tri | 3820 ms, 232 draw, 1,64 M tri | −5% |
| c5 notte (Alta) | 7440 ms, 175 draw, 1,51 M tri | 7302 ms, 176 draw, 1,55 M tri | −2% |
| a07 selva (Alta) | 12548 ms, 284 draw, 1,85 M tri | 12596 ms, 284 draw, 1,88 M tri | 0% |
| a07 selva (Media) | 8388 ms, 277 draw, 1,68 M tri | 7457 ms, 269 draw, 1,52 M tri | −11% |
| a02 piazza (Bassa) | 2184 ms, 145 draw, 1,10 M tri | 2268 ms, 145 draw, 1,15 M tri | +4% |
| a12 planata (Media) | 3102 ms, 164 draw, 1,44 M tri | 2802 ms, 156 draw, 1,39 M tri | −10% |

- Ad Alta il costo resta quello di prima (da −2% a +3%): le shader fanno qualche conto in più
  (luce avvolgente, ombra degli alberi, quinta lontana), compensato dal `discard` tolto da quasi
  tutti i programmi e dalla voronoi dei gruppi calcolata solo sul margine dei boschi. I triangoli
  crescono di 0,03-0,08 M (guscio di foglie dei castagni vicini, fusti lontani, teste dei muri a 24
  triangoli invece di 20).
- A **Media** −5% … −11% e 0,05-0,16 M di triangoli in meno: vegetazione 0,6 e niente carte di
  foglie ai LOD 2-3. È il margine chiesto dal problema 14; con «Media ridotta» (−36% dei pixel del
  mondo) l'automatica ne ha un altro gradino prima di Bassa.
- A Bassa +4% (rumore della misura e i triangoli in più dei castagni; la passata finale a Bassa
  non cambia qui, perché in e2e il rapporto pixel è 1: il guadagno di `maxPixelRatioCanvas` si vede
  solo sugli schermi ad alta densità).
- Su tutte le schermate finali: al più **296 draw call** (a06, Alta) e **2,13 M triangoli** (n01, Alta),
  sotto il tetto di 400 e 2,5 M.
- La texture delle ombre degli alberi è 1024×768 R8 (0,75 MB), scritta una volta all'avvio e quando
  il popolamento toglie alberi.

## File fuori area

Modifiche piccole e localizzate, tutte segnate nel codice con «rifinitura 2»:
- `src/ui/componenti/indicazioni.css` (problema 12): sei righe di stile per `.ui-hud-suggerimento`.
- `src/regia/percorso.ts` (problema 19): `'ArrowUp'` tolto da `spinge`.
- `src/regia/regia.ts` (problema 19): una riga, la salita della scala della Cripta senza ↑ ↓.
- `src/scene/alberi.ts` (problemi 7 e 9, elencato nel problema 9): solo raggi e altezze dei fusti degli
  impostori.
- `src/scene/sottobosco.ts`: un argomento facoltativo nel costruttore e una riga nella generazione
  delle celle (i tronchi senza collisore, problema 17).
- Prove: `tests/qualita.test.ts`, `tests/luce.test.ts` (migrazione v3), `tests/input.test.ts`,
  `tests/popolamento/castagni-liberi.test.ts` (il conto dei collisori).

Non toccati: `src/popolamento/terrazzi.ts` (i conci a cuscino stanno in `muri.ts`), `scene/bosco.ts`.

## Che cosa resta

- **Coltre del bosco sui pendii** sopra le terrazze (problema 7.4) e **distribuzione a gruppi**
  (7.3): il versante dietro Corbella resta prato con alberi, ora appoggiati a terra con l'ombra.
- **Zona chiara in controluce all'alba** (confronto 1: 12% di pixel pallidi, a16: 24%): sopra il
  bagliore del sole, a destra della Finestra, il terreno lontano resta grigio-beige. Il colore della
  foschia ci incide poco (foschia azzurra, bagliore in avanti più stretto o spento, velo più spesso:
  misurato da 19% a 12% in tutto); conta l'intensità del sole su quel terreno, quindi va guardata la
  luce radente sulle terre lontane, non l'aria.
- **Terzo basso del confronto 1** ancora a 0,66 di saturazione (bozzetto 0,52): il prato in luce
  radente sotto il castagno. Si può scendere ancora con `warmK` o `sunGold`, ma le terrazze perdono
  l'oro del bozzetto.
- **Misura vera su Iris Xe** a 1080p Media (`__GAME__.misuraPassi()`, pannello F3) sulle
  inquadrature 12 e 21 e nella capsula: qui solo SwiftShader.
- Confronto 3: mancano ancora montagne, cascate e nubi a strati del bozzetto 3 (non erano in questo
  elenco); acqua del riale piatta (a14).
- Collisori dei tronchi: serve comunque l'approvazione del cambio di gioco; la regola attuale si
  spegne con una costante.
