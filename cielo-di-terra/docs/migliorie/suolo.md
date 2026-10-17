# Migliorie, traccia «suolo»

Ramo `migliorie/suolo`, partito da `49e41d8` (brief delle quattro tracce). Risponde a «la grafica del
suolo» della prova del 16 ottobre e alla schermata `segnalazione-suolo.webp`: prologo, strada del
paese sotto il campanile, prima mattina, qualità «Automatica».

Il foglio da guardare per primo è `suolo/foglio-strada-campanile.jpg`: la stessa vista della
segnalazione (6:30, strada della Cripta sotto il belvedere) prima | dopo | bozzetto, a Media e a Bassa,
con accanto la segnalazione e i bozzetti 1 e 2. Poi i fogli della correzione, `suolo/correzione-*.jpg`.

Il lavoro è in due tempi: il primo commit (prato verde a chiazze, strada di terra battuta, colore locale
nella luce dorata), poi una **correzione** dopo una verifica indipendente che gli aveva dato 6,5/10: la
sezione qui sotto dice che cosa restava e come è stato risolto; le sezioni seguenti descrivono il
lavoro intero, aggiornato.

## Correzione dopo la verifica indipendente

Ogni difetto l'ho prima riprodotto con le stesse inquadrature del verificatore (stesse ore, stesse
posizioni, 1280×720, SwiftShader), poi ne ho cercato la causa sul fotogramma, con un raggio dalla camera
al pixel (quale mesh, quale colore per vertice, quale superficie) e con prove A/B dal vivo.

| Difetto (gravità) | Causa trovata | Che cosa ho cambiato |
|---|---|---|
| **Strisce e triangoli salmone sulla strada** (media): sul bordo sinistro nella vista della segnalazione, grandi triangoli scendendo dal belvedere verso il paese | Non erano i gradini (come pensavo nel primo resoconto) ma il **nastro di terra stesso**. Il nastro non dichiarava la superficie: la deduceva la superficie automatica, che sulle «forme tonde» (dove la normale gira più di ~0,45 rad per metro: tronchi, sassi) toglie il motivo. Le normali lisce del nastro seguono il terreno e sulle sponde, sulle gobbe e vicino ai gradini girano: lì, a triangoli, il nastro perdeva la terra battuta, i sassi **e il colore locale**, e nella luce radente restava salmone liscio (tinta 19°, saturazione 0,63, contro 32° del resto della strada). Prova: forzando la superficie TERRA dal vivo la striscia spariva (19° → 31°). | I nastri dei sentieri dichiarano la loro superficie (`SUPERFICIE_NASTRO` in `popolamento/sentieri.ts`: terra battuta, lastre, prato pettinato), anche quelli del popolamento mobile (`mobili.ts`). |
| **Il prato «spalmato»** (media): macchie sfocate tutte nella stessa diagonale, «pennellate tirate o un mosso»; ciuffi radi, non un tappeto; a Bassa strisce stirate | Tutti i motivi del prato dipinto avevano lo stesso verso: le zolle (rumore ruotato di 37° e stirato 1,8:1), i tocchi di pennello (angolo fisso, e la deformazione dei bordi tirava lungo la stessa diagonale) e i «fili» (rumore stirato 9:26). Di scorcio diventavano strisce parallele; il filtro di Kuwahara, che segue la direzione della struttura, le allungava ancora. Fra un ciuffo e l'altro il prato era colore steso. | **Fili d'erba in piedi dipinti sul terreno** entro ~10 m (`filiErba`, `render/shaders/terreno.ts`): tre fili per cella di 15 cm, ancorati al mondo; ogni filo è disegnato steso sul suolo nella direzione che si allontana dalla camera, lungo quanto lo scorcio di un filo alto 7-22 cm visto dall'occhio (r·h/(H − h)): sullo schermo si legge dritto, in piedi, e quando si cammina gira appena attorno al suo piede, come un filo vero, senza scivolare. Fra i fili il prato è più scuro (l'ombra dentro l'erba), i fili sono chiari in punta, verdi o di paglia secondo la chiazza, uno su quattro in ombra. Zolle tonde (rumore uguale in tutte le direzioni, deformato); i tocchi di pennello hanno ognuno il suo verso. |
| **Niente oro secco né ruggine nel prologo; prati giallo limone a metà mattina; ciuffi pallidi al Ronco** (media) | Il prato del paese era prato solo al 50-70% per la pittura (il riconoscimento «verde sopra il rosso» era stretto), quindi le chiazze vi arrivavano a metà; la ruggine stava sopra 0,6 di un rumore di 26-33 m e arrivava al più al 42%. A metà mattina il verde «al sole» (0,58/0,6/0,38) con la luce piena e la mappatura dei toni diventava limone, e il verde scuro delle conche faceva il mimetico. | Riconoscimento del prato più largo (+0,07 invece di +0,05); oro secco su ~40% del prato con un'ottava di 4,5 m (si vede anche dentro un prato di 20 m), paglia un poco verso l'arancio (la mappatura dei toni porta i gialli chiari verso il limone); ruggine con un'ottava di 3 m e fino al 58-93% (più sui pendii); verdi meno gialli e verde scuro meno scuro. Dall'alto, a mezzogiorno, il prato del paese e quello del Ronco mostrano tutte e tre le chiazze (`correzione-colori.jpg`). |
| **Il ginocchio della saturazione spegneva gli alberi d'autunno e le vesti rosse** (regressione) | Stava nella passata finale e valeva per tutti i colori caldi. Misurando, sul prato faceva poco (0,69 → 0,64) e sui castagni molto (0,87 → 0,73). | Tolto dalla post. Ora è nello shader del suolo (`ginocchioSuolo`, `shaders/common.ts`): solo terreno, terra battuta, prato degli oggetti, pietra in piano ed erba; si misura sulla radice del colore (circa come la vede l'occhio dopo sRGB). Soglia e pendenza in `uSuolo` (0,2 e 0,5). Saturazione dei colori caldi (90° percentile) del terzo alto: Ronco 0,88 (prima della traccia) → 0,73 (primo commit) → **0,87**; Gra di Pian 0,93 → 0,76 → **0,92**. |
| **Scarpate delle terrazze senza erba** (bassa e regressione) | Due soglie diverse: l'erba vera si toglieva dalla pendenza nel punto da 35°, il prato dipinto si spegneva da 35° e la roccia dipinta cominciava a ~52°. Fra 35° e 52° restava una falda ocra liscia. | Una soglia sola: il prato dipinto tiene fino a ~48° e sfuma fino a ~65°, la roccia comincia a ~52°; l'erba vera si toglie da ~49° a ~63°. |
| **Suolo nudo khaki** al piede del muraglione Pedrazzini e sotto il muretto del belvedere (bassa) | Al Pedrazzini il terreno ha il colore dell'alzata (ocra 0,55/0,51/0,38, non prato): la pittura del terreno vi metteva solo tocchi leggeri. Sotto il belvedere era la stessa falda fra 35° e 52° del punto sopra. | **Terra nuda dipinta** (`terraDipinta`): chiazze d'umido e di polvere, grumi e sassolini con l'ombra da una parte, qualche filo d'erba rado. Vale per tutta la terra bruna del terreno: sentieri di campagna senza nastro, spalle dei sentieri, piedi dei muri, sponde. |
| **Prestazioni**: triangoli +8-12%, istanze del sottobosco ×2,3, generazione delle celle +25-130% | Il primo commit aveva reso i ciuffi più fitti (4,2 per m², in paese −15%) per fare il tappeto, e guardava la pendenza nel punto (quattro letture del terreno) per ogni ciuffo. | Il tappeto ora lo fa lo shader: ciuffi di nuovo a 3,4 per m² (in paese −25%), 13 fili per ciuffo invece di 16; la pendenza nel punto solo dove il campione o un suo vicino pende più di ~31°, e con due letture invece di quattro. Numeri sotto, in *Prestazioni*. |

Anche **la strada da vicino**: i sassi della terra battuta erano chiazze bianche con un anello scuro
tutto attorno (sembravano pozze o buchi) e i puntini del ghiaino erano neri e regolari. Ora il sasso è
chiaro dalla parte della luce e fa l'ombra dall'altra, il ghiaino ha meno contrasto, e la terra ha
impronte e solchi appena accennati.


## Che cosa non andava (la causa)

L'ho cercata con prove A/B sulla vista della segnalazione, spegnendo un passaggio alla volta
(`suolo/prove-ab.mjs`: post neutra, senza Kuwahara, senza pennellata, mappatura dei toni a spalla, vista
del solo albedo, ore 10 invece di 6:30, senza erba) e misurando le zone del prato e della strada
(tinta e saturazione HSV medie, variazione locale della luminanza su blocchi di 16 px).

| Prova (Media, 6:30) | Prato: tinta / saturazione / variazione | Strada |
|---|---|---|
| gioco com'era | 33° / 0,78 / 0,029 | 18° / 0,78 |
| post neutra (niente viraggio, saturazione 1, contrasto 0) | 34° / 0,66 / 0,025 | 19° / 0,68 |
| senza Kuwahara | 33° / 0,78 / 0,039 | 18° / 0,78 |
| senza pennellata e grana | 33° / 0,78 / 0,028 | 18° / 0,78 |
| solo albedo (vista di prova 2) | 50° / 0,67 / 0,022 | 33° / 0,67 |
| ore 10 | 52° / 0,66 / 0,019 | 35° / 0,66 |
| bozzetto 2, prato al sole | 45-57° / 0,46-0,53 / 0,10 | |

La causa è soprattutto nel colore del suolo e nella luce, poco nella post:

1. **L'albedo del prato era giallo-oliva e quasi uniforme.** Il prato del paese (#8e9259 mescolato al
   #7d8a4a) per la pittura del terreno era prato solo al 30% (la regola «verde sopra il rosso» lo
   perdeva, e il viraggio caldo fatto *prima* della pittura lo spostava ancora verso il giallo): niente
   chiazze verdi, la paglia dominava, e la variazione locale era un terzo di quella dei bozzetti.
2. **La luce dorata lo faceva arancione.** Dalle 5:40 alle 9 il prologo è tutto in «ore dorate»: sole
   arancione radente (`warmK`, `key` ×1,25) e riempimento lilla. Giallo-oliva × arancione-rosa =
   arancione (tinta 33°).
3. **La strada era un bruno saturo** (#9a7e58, saturazione 0,43) dentro una fascia d'ocra larga 2,5 m
   per lato dipinta nei vertici del terreno: nella luce radente, una fascia arancione piatta (18°, 0,78).
4. **I ciuffi d'erba erano pochi, bassi e larghi** (in paese 0,16-0,28 m d'altezza per 0,6 m di
   larghezza, la densità ridotta del 45%): fili aperti e quasi stesi, dello stesso colore del prato,
   che si leggevano solo dove la luce trasmessa (0,55) e il bordo luminoso (0,3) li accendevano: le
   «fiammelle gialle».
5. **La post aggiungeva un 0,12 di saturazione**: la mappatura ACES (il piede schiaccia il blu dei
   colori caldi) e la correzione. Il Kuwahara e la pennellata invece contano poco (senza Kuwahara la
   variazione sale da 0,029 a 0,039, ma tinta e saturazione non cambiano); a Bassa, senza filtro né
   pennellata, il suolo era identico.

## Che cosa ho cambiato

### Il prato (`render/shaders/terreno.ts`)
- `pratoColore` (nuova, la prima parte di `pratoDipinto`): chiazze grandi di verde d'oliva (scuro nelle
  conche, fresco, al sole), d'oro secco (paglia, ~40% della superficie, con un'ottava di 4,5 m) e di
  ruggine delle felci (anche in piano, di più sui pendii), sulla luminosità del bioma. Le ottave piccole
  sfumano con la distanza in pixel: dall'alto e da lontano erano un mimetico a macchioline.
- **Fili d'erba in piedi** vicino (`filiErba`, fino a ~10 m a Media e Alta, ~7 m a Bassa per la
  risoluzione al 70%): tre fili per cella di 15 cm, ancorati al mondo, disegnati stesi sul suolo nella
  direzione che si allontana dalla camera e lunghi quanto lo scorcio di un filo vero (r·h/(H − h)), così
  sullo schermo stanno in piedi. Le celle che possono mandare un filo fino al pixel si visitano dal pixel
  verso la camera (al più 5 celle, come un raggio in una griglia). Fra i fili il prato è più scuro.
- Cespi dipinti (0,25-0,6 m): macchie tonde e irregolari (rumore uguale in tutte le direzioni, deformato)
  con la cima chiara e il piede in ombra, fino a ~25 m. (Prima macchie allungate tutte in una diagonale;
  ancora prima celle di Voronoi col bordo scuro, che facevano un selciato.)
- Tocchi di pennello più leggeri, **ognuno nel suo verso** (un angolo a caso per cella, non per luogo:
  niente anelli).
- **Terra nuda** (`terraDipinta`): dove il terreno è bruno e non prato (sentieri di campagna, spalle dei
  sentieri, piedi dei muri, sponde) chiazze d'umido e di polvere, grumi, sassolini con l'ombra da una
  parte e qualche filo d'erba rado.
- Il riconoscimento del prato è più largo (`(g − max(r, b) + 0,07) × 8`): il prato del paese è prato
  pieno; l'ocra, le rive, la terra e la roccia restano fuori. Sui pendii il prato tiene fino a ~48°
  (dove comincia la roccia dipinta) e sfuma fino a ~65°.
- `terrenoDipinto` restituisce quanto il punto è prato; sulla terra nuda la luce è quasi senza bande.

### Il materiale del mondo (`render/worldMaterial.ts`, `render/shaders/common.ts`)
- Il terreno si dipinge sul colore del bioma puro; il viraggio caldo viene dopo, più leggero (0,2
  invece di 0,35).
- **Colore locale** (`coloreLocale`, `quotaColoreLocale`): sul suolo la luminosità resta quella
  illuminata, ma la tinta torna verso quella dell'albedo per `(0,15 + 0,4·oro)·(1 − notte)` (fino a 0,55
  all'alba e al tramonto, niente di notte). Vale per il terreno (×1,6 sulla terra nuda), la terra battuta
  degli oggetti (×1,6), l'erba degli oggetti (×1) e la pietra in piano (selciati, lastre, facce dei
  gradini). I muri, le case, i personaggi e il cielo non lo usano.
- **Ginocchio della saturazione del suolo** (`ginocchioSuolo`, correzione): sugli stessi materiali,
  dopo il colore locale, sopra 0,2 di saturazione (misurata sulla radice del colore) la saturazione cresce
  la metà. La mappatura dei toni (ACES di giorno) e la correzione portano un prato a 0,25-0,3 nello
  shader a 0,65-0,7 sullo schermo; con il ginocchio ~0,6, i bozzetti stanno fra 0,45 e 0,6.
- Vista di prova 2 (`__GAME__.game.uniforms.uDebugView.value = 2`): l'albedo dipinto, senza luce né
  aria, nel mondo e nella vegetazione.

### L'erba vera (`scene/sottobosco.ts`, `scene/sottoboscoForme.ts`, `render/shaders/natura.ts`, `render/naturaMateriali.ts`)
- Ciuffi più stretti e più alti (larghi 0,72-1,14, alti 0,24-0,46 m, in paese −20% invece di −40%),
  cespo più dritto e raccolto, 13 fili. Densità come prima della traccia (3,4 candidati per m²; in paese
  −25% invece di −45%): il primo commit li aveva portati a 4,2 per m² per fare il tappeto, che ora fa il
  terreno con i fili dipinti.
- I ciuffi hanno il piede in ombra e le punte più chiare e calde, un filo meno saturi del prato; luce
  trasmessa 0,28 e bordo 0,14 (erano 0,55 e 0,3: le fiammelle). Il colore viene da `pratoColore` (le sole
  chiazze), non più da tutto il prato dipinto: per un filo largo 3 cm zolle e tocchi erano rumore e
  costavano quanto il terreno per ogni frammento d'erba.
- **Bordi d'erba** lungo i sentieri: i ciuffi arrivano fin sul bordo e ci sporgono sopra, più fitti e
  più alti entro 1,4 m (l'erba non calpestata).
- **Sassi lungo i sentieri**, mezzi affondati, a gruppi, ogni tanto uno grande.
- Fiori un poco più fitti (0,12 per m²) e anche ai margini del paese.
- L'erba cresce anche **sopra i ripiani d'erba** (terrazze, belvederi) e sopra i **riempimenti dei muri
  delle terrazze**, alla loro quota (`RIPIANI_ERBOSI` in `popolamento/ripiano.ts`, registrati da
  `costruisciRipiano` e da `popolamento/terrazzi.ts`): prima si fermava al piede dei muri e dietro ogni
  muro restava una striscia nuda di 3 m.
- La roccia che toglie l'erba si guarda nel punto (la pendenza del triangolo del terreno sotto il ciuffo),
  non nel campione di 3 m: sui gradoni un campione su quattro cadeva su un'alzata. Comincia a ~49° e
  toglie tutto a ~63°, come la roccia dipinta; si guarda solo dove il campione o un suo vicino pende più
  di ~31°, con due letture del terreno.
- Generazione più economica: i conti cari (quota, pendenza nel punto, sentieri) solo per i candidati che
  possono passare, e i collisori divisi per quadrati di 3 m (in paese erano centinaia per ogni ciuffo).

### La strada (`popolamento/sentieri.ts`, `popolamento/forme.ts`, `popolamento/mobili.ts`, `popolamento/ripiano.ts`, `render/terrainMesh.ts`, `render/superfici.ts`)
- Terra battuta grigio-bruna e polverosa (#9b8a70 in mezzo, #8a785e, #7a684e verso i bordi), più chiara
  dove si cammina, con l'orlo dove l'erba entra a tratti; otto vertici di traverso invece di cinque. I
  colori sono scelti perché la superficie automatica li legga come terra (`tests/suolo.test.ts`). Lo
  stesso colore per i sentieri del popolamento mobile (passerella, scorciatoia) e per i ripiani di terra.
- Nei vertici del terreno: terra solo fino a ~0,5 m dal bordo, poi erba calpestata che sfuma nel prato in
  1,5 m (era ocra fino a 2,5 m).
- `supTerra`: polvere chiara a chiazze e sassi di 5-10 cm, di forma irregolare, chiari dalla parte della
  luce e con l'ombra dall'altra, che si vedono fino a ~20 m; impronte e solchi appena accennati; ghiaino
  con poco contrasto; luce quasi senza bande (sulla strada appena bombata le tre bande facevano strisce).
- **I nastri dichiarano la loro superficie** (`SUPERFICIE_NASTRO`): terra battuta, lastre, prato
  pettinato. Con la superficie automatica, dove le normali del nastro giravano, la terra diventava una
  «forma tonda» senza motivo né colore locale: le strisce e i triangoli salmone (vedi la correzione).

### La post (`render/post/shaders.ts`, `render/post/pipeline.ts`)
- Alla fine **non cambia**: il ginocchio della saturazione del primo commit (nella passata finale, per
  tutti i colori caldi) spegneva anche i castagni d'autunno e le vesti rosse, e l'ho spostato nello shader
  del suolo (sopra).
- Kuwahara e pennellata **non** li ho toccati: dalle prove A/B non erano la causa, e a Bassa (dove non ci
  sono) il suolo era lo stesso.

## Come si regola
- Colore del prato: le tinte in `pratoColore` (verde scuro, fresco, al sole; paglia; ruggine) e le soglie
  delle chiazze (`secco = smoothstep(0.47, 0.6, m1)`, `rug = smoothstep(0.58, 0.72, m2)`).
- Fili d'erba dipinti: `__GAME__.game.uniforms.uSuolo.value.z` (1 accesi, 0 spenti, vivo da console);
  densità (`cs` = 0,15 m, tre fili per cella), altezza (7-22 cm) e larghezza in `filiErba`; fin dove si
  vedono in `pratoDipinto` (`smoothstep(0.009, 0.02, pix)`, metri per pixel).
- Quanto il suolo tiene il suo colore nella luce dorata: `quotaColoreLocale()` in `shaders/common.ts`
  (0,15 + 0,4·oro), e i pesi `kLocale` in `worldMaterial.ts`.
- Ginocchio della saturazione del suolo: `__GAME__.game.uniforms.uSuolo.value.x` (soglia, 0,2) e `.y`
  (pendenza, 0,5), vivi da console; `.y = 1` lo spegne. Non tocca nient'altro che il suolo e l'erba.
- Densità e misure dell'erba: `genera()` in `scene/sottobosco.ts` (candidati per m², riduzione in paese,
  bordi dei sentieri, pendenza della roccia in `rocciaNelPunto`); il raggio e la densità per qualità
  restano in `preset()`; i fili per ciuffo in `geoCiuffoErba(11, 13)`.
- Superficie dei nastri dei sentieri: `SUPERFICIE_NASTRO` in `popolamento/sentieri.ts`.
- Colori della strada: `BATTUTO_*` e `ORLO_ERBA` in `popolamento/sentieri.ts` (devono restare terra per la
  superficie automatica: la prova lo controlla).

## Prove fatte
- `npm run typecheck`, `npm test` (64 file e uno saltato, 851 prove, comprese le 9 di
  `tests/suolo.test.ts`: terra battuta sempre «terra» anche fra due vertici e meno satura di prima; **il
  nastro di un sentiero costruito dichiara la superficie TERRA** (e la superficie automatica, su una forma
  «tonda», non la darebbe); shader con colore locale; **ginocchio solo nel suolo e nell'erba, non nella
  passata finale**; **fili d'erba e terra nuda nel terreno, tocchi con il verso per cella**; erba alla
  quota di un ripiano finto e non fuori), `npm run build`: verdi.
- `npm run e2e:fase1 -- --senza-foto`: «prova ok in 112 s» (prologo e missione 1 interi; nel primo
  commit 94 s, la macchina è condivisa). La correzione cambia solo il disegno: i nastri e l'erba non hanno
  collisori.
- **Il prologo giocato davvero** come lo gioca chi si era lamentato, con lo script del verificatore
  (`gioca.mjs`: Nuova partita, Cripta, botola, muretto, lettera, campane, poi la strada verso il paese),
  qualità lasciata su Automatica (su SwiftShader diventa Media): `correzione-strada-salmone.jpg` (riga
  sotto) e `correzione-terra-scarpate.jpg` (riga sotto), stessi punti e stesse ore del verificatore.
  Niente triangoli salmone a 6:14 sulla strada, il pendio sotto il belvedere ha l'erba.
- Le 20 inquadrature del verificatore (strada della segnalazione a Media, Bassa e Alta, più vicina e ai
  piedi; belvedere all'alba; terrazze a mezzogiorno; pendio alle 17; sentiero di notte; piazza; Ronco
  alle 9 a Media e a Bassa; Pedrazzini alle 16; tramonto; ripa; Gra di Pian alle 10; paese di notte),
  prima della traccia | primo commit | correzione. In `suolo/inquadrature.mjs` ci sono anche le sue
  (s07-s12). Fogli `suolo/correzione-*.jpg` e `suolo/prima-dopo-*.jpg`. Piazza, sentiero e paese di notte
  non cambiano.
- **Sequenze camminando** con W tenuto, come chi gioca, dalla vista della segnalazione: 24 fotogrammi
  ogni 0,1 s a Media e a Bassa (`suolo/cammina.mjs --w --n=24 --passi=6`), confrontate con quelle del
  verificatore sul primo commit: `suolo/correzione-prato-fili.jpg`. Niente strisce diagonali; i fili
  stanno fermi al loro posto da un fotogramma all'altro (girano appena attorno al piede), niente
  sfarfallio né erba che spunta a scatti.
- La causa delle strisce salmone l'ho trovata con un raggio dalla camera al pixel (quale mesh, quale
  colore e superficie per vertice) e con la superficie TERRA forzata dal vivo sul nastro.
- `npm run shots` 1-7 e 11-14 (Alta): `suolo/shots-1-7-prima-dopo.jpg` e
  `suolo/shots-confronti-prima-dopo.jpg`. Cielo, case, personaggi, prima persona e notte non cambiano;
  cambia il suolo vicino (all'alba sotto il castagno ora è oro secco a fili, come nel bozzetto 1).

Misure sulla vista della segnalazione, terzo basso (tinta / saturazione HSV / variazione locale della
luminanza su blocchi di 16 px / pixel verdi):

[MISURE]

Saturazione dei colori caldi (90° percentile, tinte 0-60° e 340-360°) nel terzo alto, dove ci sono i
castagni d'autunno: Ronco alle 9 **0,88 → 0,73 → 0,87**, Gra di Pian alle 10 **0,93 → 0,76 → 0,92**
(prima della traccia → primo commit → correzione): il ginocchio nella post li spegneva, ora no.

## Prestazioni
[PRESTAZIONI]

## Che cosa resta
- Le misure dei tempi andrebbero rifatte su una Iris Xe vera a 1080p (qui solo SwiftShader, che non
  distingue il costo dei fili dipinti dal rumore). A conti fatti i fili costano, per i pixel del suolo
  entro ~10 m, al più 15 prove (5 celle × 3 fili) di una ventina di operazioni l'una.
- Sui gradoni del paese il colore delle alzate (`terraceRiser`) sbava sui ripiani per la griglia di 3 m
  del terreno, e i fili scuri fra un tratto e l'altro dei riempimenti dei muri restano (`s06`).
- La terra battuta della strada nella luce dorata resta un bruno caldo (tinta ~32°, saturazione ~0,55):
  è terra, non più una fascia arancione liscia, ma è più calda del grigio-beige del bozzetto 1.
- Al Ronco alle 9 il prato è soprattutto oro secco (sta in una chiazza grande di paglia): è voluto, ma
  la fascia fra 10 e 20 m, dove i fili sfumano, è un poco più chiara e liscia del resto.
- I fili dipinti stanno sul suolo: guardando molto in giù da vicino si vedono raggiare dal punto sotto i
  piedi, come i fili veri visti dall'alto, e non hanno parallasse fra loro.
