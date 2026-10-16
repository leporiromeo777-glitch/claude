# Rifinitura 1, area «oggetti»: prima persona, paese da lontano, notte, Cripta, Velo, lavatoio

Ramo `grafica/rifinitura-1-oggetti`, partito da `fea8391` (Unione 2, uguale a
`claude/jolly-archimedes-cm54mt`). Corregge i sette problemi dell'area «oggetti» segnalati dal
direttore artistico dopo il giro 1 (voto medio 3,6). Restano fuori i problemi dell'area «mondo»
(Finestre, coltre dei boschi, tramonto, altra metà, contorni, terreno, pozze di luce del motore).

Schermate in `docs/grafica/rifinitura-1-oggetti/` (JPEG, 1280×720, Chromium + SwiftShader, Alta se
non è detto altro):
- `foglio-<inquadratura>.jpg`: prima | dopo, stessa inquadratura e stessa ora (prima = `fea8391`);
- `dopo-<inquadratura>.jpg`: la schermata finale da sola.

Le inquadrature sono quelle del direttore artistico (`a01` … `b05`) più `b06` (squadro piantato
sotto la tettoia del lavatoio), `a19`/`a20` (il paese dalla terrazza ad Alta e a Media) e `d1` (il
paese da 190 m). Per rifarle: lo script delle schermate del direttore artistico con l'elenco di
questa traccia (vedi «Come rifare le schermate» in fondo).

## In breve

| Problema (gravità) | Fatto | Schermate |
|---|---|---|
| 1. Squadro in mano: braccio a tubo, guanti di pelle nuda, ottone di plastica (alta) | sì, con una posa diversa da quella proposta (sotto) | `b03`, `b04`, `b05`, `b06` |
| 2. Il paese da lontano «Monopoli» (alta) | sì | `a13`, `a15`, `a19`, `a20`, `d1`, `c1`, `c2` |
| 3. Notte: poche finestre accese, niente lanterne (media) | sì | `c5`, `a11`, `a12` |
| 4. Tasso a broccolo, selciato bianco a righe nere (media) | sì | `a01`, `a02`, `a16`, `a11` |
| 5. Cripta a scatola, tutta dello stesso motivo (media) | sì, rifatta | `b01`, `b02` |
| 6. Velo a cornice da televisore; lavatoio sepolto e tettoia nera (media) | sì; il lavatoio in un altro modo (sotto) | `c3`, `a13`, `a15`, `a03`, `a04` |
| 7. Animazione dello squadro a passo fisso (bassa) | sì | — |

## 1. Prima persona con lo squadro (alta)

**Problema.** Il braccio sinistro era un tubo verde a coste lungo mezzo schermo, dal bordo basso al
centro; i guanti sembravano pelle nuda rossiccia e lucida; l'ottone era giallo piatto.

**Fatto** (`src/oggetti/oggetti/primaPersona.ts`, `src/oggetti/oggetti/mani.ts`,
`src/render/primoPiano.ts`):
- **Braccio vero, di scorcio.** La proposta (spostare i «gomiti») non bastava: il gomito era un punto
  a quasi un metro dal polso e la manica restava un tubo lungo. Ora l'avambraccio ha la sua lunghezza
  (`AVAMBRACCIO` = 0,27 m, o `lunghezze` per posa) nella direzione `avambracci` della posa, e dal
  gomito un secondo pezzo (`braccio()`, la parte alta della manica, più larga) va alla spalla, dietro
  la camera. Le prese delle due mani sono girate in modo che il polso stia dalla parte del braccio
  (prima il polso puntava verso il centro e la manica, che andava verso il bordo, lo spezzava: si
  vedeva bene nell'anteprima della posa).
- **Pose come nei bozzetti 1 e 2.** «In mano»: lo strumento sta a sinistra, il **centro dello schermo
  resta libero** (si mira lì); la sinistra impugna l'asta sotto la squadra col dorso del guanto verso
  l'occhio e l'avambraccio che entra dal bordo sinistro; la destra regge l'asta in basso, vicino al
  puntale, quasi fuori campo. «Piantato»: come il bozzetto 2, l'avambraccio sinistro orizzontale dal
  bordo sinistro e la destra appoggiata sul muro. Cambiando posa la presa scorre lungo l'asta
  (aggancio smorzato) invece di scattare.
- **Manica di lana a maglia**, senza coste: `LANA_MAGLIA` (maglia fitta a basso contrasto nel
  materiale del primo piano), pieghe di sbieco larghe, stretta al polso e più larga verso il gomito;
  verde oliva quasi cachi (`manica` 0x67624c): in luce viene (123, 112, 69), il bozzetto 2 ha
  (126, 111, 70).
- **Guanti di cuoio scuro e opaco**: `#4b3426` con le luci `#6e4c34` come proposto, cuciture
  **scure** sul dorso e lungo le dita, niente riflesso né bordo luminoso (`opaco` nel materiale), più
  riempimento frontale e meno occlusione del resto, perché in ombra non diventino una sagoma nera;
  la manopola di cuoio più chiaro (`#7a5e45`), 7-8 cm, sopra la lana. La cinghia con la fibbia
  d'ottone non c'è più (da lontano erano puntini gialli).
- **Ottone con luci e scuri**: base `#b08a3a`, cavità `#5e4520`, una striscia di riflesso lungo i
  tubi e il riflesso del cielo in alto (`ottoneStriato`), giunti più scuri; nel materiale il riflesso
  della luce è caldo ma mai giallo pieno (`mix(alb·1,6, (1, 0,93, 0,8), 0,35)`).

**Prima/dopo:** `foglio-b03-squadro-terrazza.jpg`, `foglio-b05-squadro-mattino-paese.jpg`,
`foglio-b04-squadro-tramonto.jpg`, `foglio-b06-squadro-piantato-lavatoio.jpg`.

**Come regolare.** In `primaPersona.ts`: `POSE.<posa>.strumento` (posizione e giro dello strumento
in spazio camera), `sinistra`/`destra` (quota della presa sull'asta e giro attorno all'asta),
`avambracci` (direzione dal polso al gomito), `lunghezze` (lunghezza della manica visibile),
`SPALLE`. In `mani.ts`: `COLORI_MANI`. Nel materiale (`primoPiano.ts`): ramo `cuoio` e `lana`.

## 2. Il paese da lontano (alta)

**Problema.** Dal Velo e dalle terrazze il paese erano cubetti grigio-blu col tetto liscio; oltre
210 m le case diventavano scatole.

**Fatto:**
- **Distanza del dettaglio lontano** (`src/popolamento/cantiere.ts`): da 210 m a **400 m a Media e
  Alta, 260 m a Bassa** (`distanzaLodPerQualita`), aggiornata quando cambia la qualità
  (`impostaDistanzaLod`, iscritta con `game.onQualita` in `installaCorbella`).
- **Casa lontana** (`casaLontana` in `src/popolamento/forme.ts`, circa 200 triangoli): tetto di
  piode che sporge 0,4 m con l'ombra di gronda sul muro, timpani di pietra, due falde in **tre file
  di lastre a gradino** alternate chiare e scure con la riga scura sotto ogni fila, licheni ocra su
  qualche fila, colmo, **camino** con la lastra, **due finestrelle per facciata** (accese di notte),
  la porta.
- **Piode calde** (`src/oggetti/palette.ts`): `piode` 0x6c6258 (prima 0x6f6c6d, che sotto il cielo
  diventava ardesia blu), `piodeChiare` 0x8c8274, `piodeScure` 0x4f4740, nuovi `piodeLichene`
  0x9a8a5a (circa il 15% delle lastre) e `piodeGiunti` 0x3a332d (la lastra di base che si vede fra le
  lastre).
- **Contrasto delle file ×2** (`tettoPiode` in `dettagli.ts`, opzione `contrasto`; i rustici usano
  2): file alternate più chiare e più scure e ombra sotto ogni fila più forte. Ogni rustico ha anche
  la sua tinta di tetto (`TINTE_TETTI` in `rustico.ts`: più bruno, più freddo, più chiaro, col
  muschio), così il paese non è di un grigio solo. Le finestre del retro ci sono a ogni piano (di
  notte la casa si accende anche dietro), appoggiate senza foro per restare nel budget di triangoli.

**Prima/dopo:** `foglio-a13-planata-paese.jpg`, `foglio-a15-planata-tramonto.jpg`,
`foglio-a19-terrazza-alta-paese.jpg`, `foglio-a20-terrazza-media-paese.jpg`,
`foglio-d1-paese-lontano.jpg`, `foglio-c1-alba-castagno.jpg`, `foglio-c2-terrazze.jpg`.

Da 60-150 m (il Velo sopra il paese) i tetti ora sono masse grigio-brune calde con le falde chiare e
scure, ma le singole file di lastre (30-40 cm, un pixel a quella distanza) non sopravvivono al
filtro pittorico: vedi «Cosa resta».

**Come regolare:** `distanzaLodPerQualita` (cantiere), `casaLontana` (forme: `sp` sporgenza, `pend`,
colori delle file), `PALETTE.piode*`, `contrasto`/`tinta` di `tettoPiode`, `TINTE_TETTI`.

## 3. Notte: finestre accese e lanterne (media)

**Problema** (regressione dell'unione 1): con i bagliori orientati c'era una sola finestra accesa
per lato visto.

**Fatto:**
- `finestreAccese` da `0.4 + m.r * 0.35` a **`0.65 + m.r * 0.25`** (`luoghi/case.ts`).
- **Dieci lanterne a braccio** (`lanterneDellePorte` in `luoghi/case.ts`, `creaLanterna` tipo
  'muro' della libreria): accanto alle porte dei rustici della corona della piazza e sui vicoli
  vicini (entro il raggio della piazza + 45 m), a 2,4 m dal suolo, almeno 5 m l'una dall'altra.
  Sono lumi del paese come le finestre: si accendono col buio (il vetro segue
  `impostaIntensitaLumi(notte del cielo)`, il bagliore `uNight`, quindi dopo il tramonto, verso le
  20) e fanno la loro pozza quando il motore li sceglie fra gli 8 lumi più vicini alla camera. Senza collisore (stanno
  sul muro sopra la testa). Il loro numero è in `statistiche.lanterne`.
- Il bagliore delle finestre resta contenuto (0,42): provato a 0,5, copriva il riquadro della
  finestra e la finestra non si leggeva più come finestra.

**Prima/dopo:** `foglio-c5-notte-paese.jpg`, `foglio-a11-notte-piazza.jpg`,
`foglio-a12-notte-vicolo.jpg`. Lumi del paese da 304 a 434.

## 4. Tasso e selciato (media)

**Fatto:**
- **Tasso** (`creaTasso` in `popolamento/edifici.ts`): verdi scuri
  `[0x223428, 0x2a3e30, 0x324a38, 0x1c2c22, 0x3a523c]`, gradiente in alto 0,95 (prima 1,12), e
  **undici ciuffi d'aghi** (tre coni sottili ciascuno) che escono dalla sagoma: la massa scura a fiamma
  dell'unione 1, non più un broccolo.
- **Selciato** (`luoghi/piazza.ts`): `CIOTTOLO_CHIARO` 0xa89e8c, `CIOTTOLO_GRIGIO` 0x857d70,
  `CIOTTOLO_SCURO` 0x5a4a3a (bruno-bronzo), linee delle ore da 0,11 a **0,06 m** e linea di Lag da
  0,17 a **0,09 m**, color bronzo scuro (`LINEA_LAG` 0x4a3a2c) invece del nero; la fascia di selciato
  della corona sfuma nel colore del suolo.

**Prima/dopo:** `foglio-a01-piazza-mattino.jpg`, `foglio-a02-piazza-case.jpg`,
`foglio-a16-piazza-media.jpg`, `foglio-a11-notte-piazza.jpg`.

## 5. Cripta (media)

**Problema.** Pareti, pavimento, soffitto e coperchi con lo stesso motivo a lastre poligonali coi
giunti neri; capsule grigie con un rettangolo arancione; luce lilla piatta.

**Fatto** (`src/regia/scena/cripta.ts`, rifatta la costruzione; stessa interfaccia `Cripta`, stessi
punti, collisori, lumi e animazioni del vetro, dell'anta e della botola):
- **Pareti a conci squadrati** a corsi (0,5 × 0,25 m) con la malta dipinta: tessere a filo del muro
  (`TESSERA`, 3×3 conci per tessera) invece di scatole sporgenti, perché ogni gradino di profondità
  diventava un contorno nero nel post.
- **Pavimento a lastre grandi** (0,8-1,2 m), **volta a botte intonacata** (ellittica, con le macchie
  d'umido e le lunette), tre sottarchi; il corridoio con i conci, le lastre e il soffitto intonacato.
- **Capsule di metallo**: zoccolo di patina verde, corpo di rame-ottone con le costole, i chiodi e le
  cinghie, il bordo d'ottone del vetro, il fondo scuro, il tubo che scende nel pavimento, il
  **display ambrato piccolo** nella sua cornice; il vetro brinato com'era.
- **Tubi lungo le pareti** con le staffe e le valvole.
- **Lumi caldi** (`#ffb060`): due a braccio e due appesi in gabbie di ferro, tre accesi. La luce è
  cotta nei colori (`illuminaCripta`): pozze calde che schiariscono attorno ai lumi accesi, con un
  filo d'emissione notturna perché si leggano sotto l'ambiente freddo; angoli scuri e freddi, chiarore
  azzurrino attorno alle capsule, piede delle pareti umido. Tutto con le superfici dichiarate
  (pietra, intonaco, metallo, ottone, vetro).
- La corona secca sulla capsula 3 ora è un anello di rami con ciuffi di foglie secche e qualche bacca
  (prima un disco marrone sospeso).
- La mesh della Cripta ha la sfera di contorno vera: fuori campo non si disegna (prima
  `frustumCulled = false`).

**Prima/dopo:** `foglio-b01-cripta-capsule.jpg`, `foglio-b02-cripta-altra.jpg`. Triangoli della
Cripta da 1.514 a 36.060 (12 mesh, come prima).

## 6. Velo e lavatoio (media)

**Velo** (`VELO` e `creaVeloPrimaPersona` in `primaPersona.ts`):
- traversa più bassa e più vicina (`yT` −0,25, `zT` −0,42, come proposto);
- **montanti divergenti**: partono dalla traversa vicino alle mani, legati con la corda, e si aprono
  verso gli angoli in alto, dove reggono l'orlo della tela (traversini solo agli angoli; l'asta dritta
  in alto non c'è più);
- della tela si vede solo l'**orlo cucito e curvo** (`quotaOrlo`: più alto al centro, più basso agli
  angoli), lino caldo che in controluce passa color miele;
- **mani che stringono la traversa** (`posaAvvolta` con le dita sotto), più vicine al centro
  (`prese` −0,34 / 0,32), guanti di cuoio un filo più chiaro (sulla traversa sono quasi sempre in
  controluce).

**Lavatoio** (`creaLavatoio` in `popolamento/edifici.ts`, `luoghi/piazza.ts`). La correzione proposta
(girare il lavatoio lungo la curva di livello) non si poteva fare: il pendio sotto la vasca è di 21°
(il suolo sale di 2 m), girandolo la tettoia non coprirebbe più la vista 5-1 del caposaldo (lo
verifica `tests/popolamento/corbella.test.ts`), l'acqua non seguirebbe più il riale e Togna finirebbe
fuori posto. Invece:
- il lavatoio resta dov'è ma **sale di 0,8 m** (`DISLIVELLO_LAVATOIO`) su un **basamento di pietra**:
  il lastricato è un piano rialzato che scende fino nel pendio, con **quattro gradini** davanti;
  la **vasca sta tutta fuori terra** e si vede con l'acqua; il chiodo 5 resta alla sua quota;
- collisori: il lastricato è calpestabile e i gradini sono `gradino` (si sale camminando); punti
  `gradino`, `vasca`, `lume`; Togna sposta il suo posto di 1,6 m, davanti alla vasca sul
  nuovo lastricato (`abitanti.ts`);
- **tettoia da sotto**: assito di larice chiaro (`#8a6a48`, opzione `assito` di `tettoPiode`),
  occlusione al massimo 0,15 (`occlusioneMassima`), travi di larice: si leggono le assi.
- La terra battuta della corona della piazza non ha più le faccette triangolari (la variante del
  motivo e il colore cambiavano da un triangolo all'altro; ora la variante è una sola e il colore
  cambia a chiazze larghe) né le toppe di ciottoli isolate.

**Prima/dopo:** `foglio-c3-planata-asse.jpg`, `foglio-a13-planata-paese.jpg`,
`foglio-a15-planata-tramonto.jpg`, `foglio-a03-lavatoio.jpg`, `foglio-a04-lavatoio-retro.jpg`,
`foglio-b06-squadro-piantato-lavatoio.jpg`.

**Come regolare:** `VELO` (quota, profondità, attacco e cima dei montanti, arco dell'orlo, prese,
gomiti); `DISLIVELLO_LAVATOIO` (piazza.ts; 0 = il lavatoio di prima).

## 7. Squadro col tempo vero (bassa)

`src/regia/squadro.ts`: il sistema riceve il tempo del fotogramma in `render(frameDt)` (lo chiama il
motore prima del disegno, come per gli altri sistemi) e l'overlay usa quello, limitato a 0,1 s:
`fp.update?.(dt, …)` e `passo += (obiettivo − passo) · (1 − e^(−6·dt))`. Prima avanzava di 1/60 per
fotogramma, quindi più lento a 30 fps e più veloce a 120.

## File fuori dall'area toccati

- `src/render/primoPiano.ts` (area «mondo», materiale del primo piano). Modifiche piccole e
  additive, solo nei rami del cuoio e della lana e nel riflesso dei metalli: nuova costante
  `LANA_MAGLIA` (= `MATERIA.LANA + 0,25`, maglia fitta senza coste); cuoio opaco (riflesso 0,035,
  niente bordo luminoso con la nuova variabile `opaco`, meno occlusione e più riempimento frontale);
  cuciture scure; il riflesso dei metalli caldo ma non giallo pieno. Gli altri materiali non
  cambiano.

Tutti gli altri file sono dell'area «oggetti»: `src/oggetti/**` (`palette.ts`, `dettagli.ts`,
`rustico.ts`, `mani.ts`, `primaPersona.ts`), `src/popolamento/**` (`cantiere.ts`, `corbella.ts`,
`tipi.ts`, `forme.ts`, `edifici.ts`, `abitanti.ts`, `luoghi/case.ts`, `luoghi/piazza.ts`),
`src/regia/scena/cripta.ts`, `src/regia/squadro.ts`.

## API nuove o cambiate

- `render/primoPiano.ts`: `LANA_MAGLIA`.
- `oggetti/oggetti/mani.ts`: `braccio(f, gomito, spalla, o)`; `COLORI_MANI` con `manopola`,
  `manopolaOrlo`; `OpzioniMano.cinghia` (predefinito no).
- `oggetti/oggetti/dettagli.ts`, `OpzioniTetto`: `contrasto`, `assito`, `occlusioneMassima`, `tinta`.
- `oggetti/palette.ts`: `piodeLichene`, `piodeGiunti`.
- `popolamento/cantiere.ts`: `distanzaLodPerQualita(livello)`, `impostaDistanzaLod(radice, d)`;
  `distanzaLod` predefinita 400.
- `popolamento/tipi.ts`: `GiocoCorbella.onQualita?` (facoltativo; il `Game` vero ce l'ha).
- `popolamento/corbella.ts`: `StatisticheCorbella.lanterne`.
- `popolamento/luoghi/case.ts`: `lanterneDellePorte(ctx, case_, quante = 10)`.
- `popolamento/luoghi/piazza.ts`: `DISLIVELLO_LAVATOIO`; `popolamento/edifici.ts`:
  `creaLavatoio(seme, dislivello = 0)`.
- `regia/squadro.ts`: `Squadro.render(frameDt)`.
- Nessuna API di `window.__GAME__` è cambiata.

## Prestazioni

`getStats()` nelle stesse inquadrature, prima (`fea8391`) e dopo; Alta se non è detto altro. I tempi
di SwiftShader qui non dicono niente (le schermate giravano insieme ad altre prove) e non li riporto.

| Inquadratura | Draw call prima → dopo | Triangoli prima → dopo |
|---|---|---|
| c1 alba, castagno | 206 → 216 | 1,60 M → 1,73 M |
| c2 terrazze | 229 → 248 | 1,61 M → 1,92 M |
| c3 planata sull'asse | 171 → 170 | 0,66 M → 0,66 M |
| c5 notte, margine del paese | 170 → 175 | 1,44 M → 1,50 M |
| a01 piazza al mattino | 213 → 219 | 1,18 M → 1,26 M |
| a02 piazza verso le case | 168 → 174 | 1,22 M → 1,32 M |
| a03 lavatoio | 150 → 152 | 1,16 M → 1,19 M |
| a04 sotto il lavatoio | 160 → 164 | 1,28 M → 1,38 M |
| a11 notte in piazza | 211 → 217 | 1,17 M → 1,25 M |
| a12 notte nel vicolo | 186 → 190 | 1,16 M → 1,24 M |
| a13 planata sopra il paese | 196 → 207 | 1,28 M → 1,44 M |
| a15 planata al tramonto | 169 → 179 | 1,28 M → 1,40 M |
| a16 piazza, **Media** | 202 → 208 | 1,08 M → 1,17 M |
| a18 terrazza, **Media** | 136 → 135 | 1,06 M → 1,06 M |
| a19 terrazza verso il paese | 241 → **262** | 1,68 M → **2,04 M** |
| a20 terrazza verso il paese, **Media** | 236 → 257 | 1,49 M → 1,85 M |
| d1 il paese da 190 m | 231 → 248 | 1,74 M → 2,03 M |
| b01 Cripta | 169 → 174 | 1,25 M → 1,35 M |
| b02 Cripta | 125 → 127 | 1,08 M → 1,13 M |
| b03 squadro sulla terrazza | 228 → 251 | 1,64 M → 2,01 M |
| b04 squadro al tramonto | 187 → 195 | 1,49 M → 1,58 M |
| b05 squadro sotto il castagno | 198 → 210 | 1,57 M → 1,70 M |
| b06 squadro piantato al lavatoio | 234 → 238 | 1,28 M → 1,43 M |

- Quasi tutto l'aumento viene dalla **distanza del dettaglio lontano** (210 → 400 m): dalle terrazze
  e dal belvedere il paese intero è a dettaglio pieno. Il caso peggiore (a19, Alta) è 262 draw call e
  2,04 M triangoli, sotto il tetto del brief (circa 400 e 2,5 M). A Media lo stesso punto fa 257 e
  1,85 M (+21 draw, +0,37 M triangoli): se su Iris Xe non regge i 60 fps, basta abbassare Media in
  `distanzaLodPerQualita` (per esempio a 320 m); Bassa è già a 260.
- Paese (`statistiche` di `installaCorbella`): 731.213 → 735.069 triangoli (+0,5%: le finestre del
  retro appoggiate, le lanterne, il lavatoio rialzato, il tasso; il rustico più grande resta sotto i
  6.000 triangoli del suo test), lumi 304 → 434 (finestre accese e lanterne), 10 lanterne.
- Casa lontana: circa 200 triangoli (prima poche decine), ma si usa solo oltre 400 m (260 a Bassa).
- Cripta: 1.514 → 36.060 triangoli, sempre 12 mesh; ora fuori campo non si disegna.
- Prima persona: squadro con mani e maniche circa 13.000 triangoli visibili, Velo circa 24.000, in
  mesh unite come prima; lo squadro ha due draw call in più (il pezzo alto delle due maniche).

## Cosa resta

- **Tetti dal Velo (60-150 m).** I colori ora sono caldi e le falde chiare e scure si leggono, ma le
  file di lastre sono troppo fitte per sopravvivere al filtro pittorico a quella distanza. Servirebbe
  un dettaglio intermedio del rustico con meno file più grandi, oppure un motivo a file nel materiale
  `PIODE` che si allarga con la distanza (area «mondo», `superfici.ts`).
- **Pozze di luce di notte.** Il motore illumina con gli 8 lumi più vicini alla camera
  (`render/lamps.ts`, area «mondo»): con più finestre accese e le lanterne, gli 8 lumi vanno ai più
  vicini e la facciata lontana che prima era lavata di caldo (c5) ora ha solo il bagliore della
  lanterna. Proposta per l'area «mondo»: dare la precedenza ai lumi senza direzione (lanterne) e a
  quelli davanti alla camera, o alzare `MAX_LAMPS`.
- **Maniche nel Velo.** Con la traversa bassa e vicina (come chiesto) le maniche escono dal campo:
  nel bozzetto 3 si vedono negli angoli in basso. Alzando `VELO.yT` a circa −0,21 tornerebbero.
- **Cripta di giorno.** Le pozze calde hanno un filo d'emissione che il materiale del mondo accende
  solo di notte (`uNight`); di giorno restano i colori cotti, più tenui. Il prologo la mostra
  all'alba, quando è notte.
- **Lavatoio** rialzato invece che girato lungo la curva di livello (la ragione è sopra). Va
  rivisto se cambia il caposaldo 5 o la vista 5-1.
- Fuori area, visti nelle schermate: contorni neri, terreno a faccette sotto il lavatoio (a04),
  Finestre di giorno, versanti a pluriball.

## Come rifare le schermate

Build per le prove (`npm run build:e2e`), poi lo script delle schermate del direttore artistico
(Chromium + SwiftShader, 1280×720) con l'elenco di questa traccia: ogni voce è un `setup(g)` sopra
`window.__GAME__` (`setTime`, `teleport`, `lookAt`, `regia.vai`, `regia.mira`, `startGlide`, e per
lo squadro `r.squadro.disponibile = true; r.squadro.prendi()` o `r.piantaSquadro('cs_5')`). Le
inquadrature e gli orari sono nei nomi dei file.
