# Rifinitura 2, area «oggetti»: paese a grumo, prima persona, Cripta di rame, LOD a Media, lavatoio

Ramo `grafica/rifinitura-2-oggetti`, partito da `5f64bba` (Unione 3, uguale a
`claude/jolly-archimedes-cm54mt`). Corregge i sette problemi dell'area «oggetti» del giro 2 del
direttore artistico (media 4,3). Restano fuori quelli dell'area «mondo» (valori e atmosfera del terzo
alto, notte del versante, tasso nero, moiré, selciato e pietre a vetro rotto, castagni, Finestre).

Schermate in `docs/grafica/rifinitura-2-oggetti/` (JPEG, 1280×720, Chromium + SwiftShader, Alta se
non è detto altro):
- `foglio-<inquadratura>.jpg`: prima | dopo, stessa inquadratura e stessa ora (prima = `5f64bba`);
  per i quattro confronti c'è anche il bozzetto a sinistra;
- `dopo-<inquadratura>.jpg`: la schermata finale da sola.

Le inquadrature sono quelle del direttore artistico (`c1`, `c2`, `c3`, `c5`, `a01` … `a16`, `b01` …
`b07`, più `b05g`/`b06g`, lo squadro alla luce del giorno), più `p1` (il paese dal belvedere a metà
mattina), `p2` (planata verso il paese) e `m1` (la terrazza verso il paese a Media, come a20). Altre
inquadrature solo per le misure (`p5`-`p7`, `m2`-`m8`) sono nella tabella delle prestazioni. Come
rifarle: in fondo.

## In breve

| Problema (gravità) | Fatto | Schermate |
|---|---|---|
| 1. Il paese è «Monopoli» (alta) | sì: annessi addossati, altezze, casa lontana, orti e alberi da frutto, aie; in più 32 case nel nucleo (sotto) | `c1`, `a12`, `a16`, `a08`, `p1`, `p2`, `a01` |
| 2. Prima persona: tubo orizzontale, mano che fluttua, maniche fuori campo (alta) | sì | `b05`, `b06`, `b05g`, `b06g`, `b07`, `c3`, `a12`, `a13` |
| 3. Cripta spenta, capsule di legno, giunti neri, coperchio bianco (media) | sì | `b01`, `b02`, `b03`, `b04` |
| 4. LOD uguale a Media e ad Alta (media) | sì: Media 310 m; Alta resta 400 (sotto 2,5 M anche coi personaggi) | `m1` e la tabella delle prestazioni |
| 5. Lavatoio rialzato fuori ambito (media) | tolto (nessuna approvazione possibile): `DISLIVELLO_LAVATOIO = 0`, Togna al posto di prima, vasca sistemata solo nel visivo, prova a piedi dal chiodo 5 | `a03`, `b07` |
| 6. Allocazioni dello squadro a ogni fotogramma (bassa) | sì | — |
| 7. `colorSpace` del vetro delle capsule (bassa) | sì | `b01` |

## 1. Il paese «Monopoli» (alta)

**Problema.** Dal castagno (confronto 1, a16) e dal Velo (a12) le case erano scatole uguali, staccate,
sparse a distanza regolare; le finestre della versione lontana erano buchi neri; niente orti né alberi
fra le case.

**Fatto** (`src/popolamento/luoghi/case.ts`, `src/popolamento/forme.ts`, `src/popolamento/corbella.ts`,
`src/oggetti/oggetti/annesso.ts` e `orto.ts` nuovi, `src/oggetti/oggetti/rustico.ts`):
- **Annessi addossati** (`costruisciAnnessi`, 38 posati): stalle, legnaie e fienili di 3-5,5 m col
  tetto di piode a una falda che scende verso valle (`creaAnnesso`: corpo di pietra a trapezio, porta
  e finestrella, legnaia coi ceppi in vista e i pilastri, fienile ad assi di larice; collisori `muro`
  → `casa` e `tetto` come i rustici). Due passate: fra due case vicine (centro-centro < 18 m, basi a
  meno di 2,4 m, una di fianco all'altra lungo la curva di livello, vuoto fra i muri di 2,2-12 m:
  l'annesso chiude il vuoto o si appoggia alla prima), poi sui fianchi liberi delle case del nucleo
  (entro 90 m dal campanile tutti e due i fianchi, più in là uno su due). Mai su sentieri, visuali,
  punti d'interazione, davanti alle scale esterne o sotto le lobbie. Ognuno ha la sua versione
  lontana (`annessoLontano`).
- **Altezze variate** ×0,85-1,5 rispetto ai due piani di base: nel nucleo (< 70 m dal campanile)
  metà delle case ha tre piani (meno allontanandosi), qualcuna uno, e l'altezza del piano varia
  ×0,9-1,14 (`altezzaPiani` nuova in `creaRustico`, limitata a 0,85-1,2; la sequenza casuale del
  rustico non cambia, quindi le case esistenti restano dove sono e com'erano salvo l'altezza). Il
  nucleo sale verso il campanile. In più, dal seme e senza toccare la sequenza casuale, più case hanno
  le persiane colorate e il contorno di calce alle finestre (senza, le finestre erano buchi scuri).
- **Casa lontana** (`casaLontana`, la versione oltre la distanza di LOD): finestre con la cornice di
  calce `#d8cfc0` (8 cm attorno), il vetro (acceso di notte come prima) e le due persiane aperte,
  verde salvia `#5a6b48` o noce `#7a4a30` (una tinta per casa); sporgenza del tetto 0,6 m (prima
  0,4) con lo spessore chiaro di 0,15 m lungo le gronde e sui timpani.
- **Verde fra le case** (`costruisciVerdeDelPaese`): circa tre case su cinque provano a mettere
  davanti o di fianco un **orto** (terra vangata, solchi, file di cavoli, porri o bietole, qualche
  zucca, bordo di assi; 23) o un **albero da frutto** (melo, pero o fico di 3,5-5 m, tronco storto,
  chioma a masse con i ciuffi di foglie dei castagni sul contorno e qualche frutto; 23, col collider
  `tronco`): uno ogni due case circa, più i muretti delle terrazze che c'erano già.
- **Aie e cortili** (`cortiliDelleCase`): attorno a ogni rustico un'aia di terra battuta (e qualche
  lastra di gneiss davanti alla porta) col bordo irregolare che sfuma nel prato, senza collider; le
  aie delle case vicine si toccano e il nucleo diventa un tessuto unico invece di pedine sul verde.
- **32 case in più nel nucleo** (`costruisciCase(ctx, 90)`, prima 58). Con i soli annessi il grumo
  non si leggeva dal confronto 1: le case erano troppo poche e troppo lontane per avere vicini. Le
  nuove case vengono dopo le 58 di prima nella stessa coda (le 58 non si spostano né cambiano), con
  gli stessi controlli (niente sentieri, visuali, punti d'interazione, impronte dei luoghi) e in più
  lontane almeno 32 m dal belvedere, dalla botola e dal castagno morto, perché non coprano le
  inquadrature della missione. È più di quanto chiedeva la correzione: se non va, `costruisciCase(ctx,
  58)` torna al paese di prima (annessi e verde si adattano da soli).
- La corona della piazza ha il colore per vertice (`coronaSulSuolo` con `coloreVertice` nuovo,
  facoltativo): il bordo fra terra battuta e prato non fa più il dente di sega dei triangoli (a03).

**Come regolare:** `costruisciCase(ctx, quante)` e `LIBERI` (case.ts); `costruisciAnnessi(ctx, case_,
quanti = 52)` e le soglie della prima passata (18 m, 2,4 m, vuoto 2,2-12 m); in
`costruisciVerdeDelPaese` la soglia `h > 0.62` (quante case provano) e il raggio del dettaglio pieno
(orti 50 m, alberi 90 m dalla piazza); in `casaLontana` `sp` (sporgenza), `bordo`, `calce`,
`persiane`; `altezzaPiani` dei rustici.

## 2. Prima persona (alta)

**Problema.** Squadro piantato (b06): l'avambraccio sinistro era un tubo grigio orizzontale dal bordo
al centro e la destra fluttuava in basso. In mano (b05) la manica era un cilindro liscio, grigio al
buio. In planata le maniche uscivano dal campo: due guanti piatti senza braccia.

**Fatto** (`src/oggetti/oggetti/primaPersona.ts`, `src/oggetti/oggetti/mani.ts`,
`src/render/primoPiano.ts`):
- **Piantato** (bozzetto 2): avambracci girati di 35° verso il basso (`giuDi`), lunghezze 0,18 m,
  spalle per posa (`Posa.spalle`, nuove) più basse e larghe, così il braccio scende verso l'angolo
  basso a sinistra invece di attraversare lo schermo. Lo strumento si sposta a sinistra e più giù
  (`PUNTALE_PIANTATO` da (−0,12, −0,37, −0,72) a (−0,28, −0,56, −0,70)): la presa della sinistra cade
  nel terzo basso a sinistra come nel bozzetto. Con x fra −0,05 e +0,02, come proposto, la presa
  restava al centro dello schermo davanti alla mira. Lo strumento piantato vive solo nel primo piano
  (sovrapposto): dove stanno i piedi davanti al chiodo (`Squadro.piediDavantiAlChiodo`) non cambia. La destra non è più «appoggiata» nel vuoto: impugna l'asta
  20 cm più in basso della sinistra (più in alto di prima di circa 6 cm sullo schermo).
- **In mano**: avambraccio sinistro 30° più giù, lunghezze 0,20/0,22, spalle della posa; la manica
  entra dall'angolo, non più come tubo orizzontale.
- **Velo**: traversa più alta (`yT` −0,20, proposta −0,21) e più lontana (`zT` −0,54, `mezza` 0,76,
  prese a ±0,41) perché stia a tre quarti dello schermo come nel bozzetto 3; gomiti in basso verso
  gli angoli (`gomito` (0,47, −0,34, −0,31)) e un braccio fino alla spalla `VELO.spalla`
  (0,32, −0,42, 0,05, la x proposta): le maniche entrano dagli angoli bassi. Guanti `#573c2a` (prima
  `#684832`, che al sole sembrava pelle).
- **Manica**: verde oliva `#67624c` (invariato), maglia più grossa e più contrastata (±12%, sfuma dove
  i punti diventano più piccoli di un pixel), una piega diagonale netta che gira attorno all'avambraccio
  (scura `#3b3829` con la cresta chiara `#7d7759`) e il ventaglio di pieghe al gomito. Di notte la
  lana non va più al grigio neutro: nel materiale del primo piano, con `uNight`, la lana tende
  all'oliva scuro (×(1,3, 1,25, 0,5) all'85%: sotto la luce blu della notte resta verde, prima era
  grigio-viola, saturazione 0,15-0,2) e il cuoio resta bruno (×(1,35, 1,05, 0,6) al 70%).
- **Polsino** di cuoio alto 6 cm (prima 7-8) con la cucitura del giro dove si attacca al guanto.
  Colore `#7a5236` invece di `#7a5e45`: stesso valore ma più saturo, perché il bruno-rosa proposto,
  sotto il sole e accanto al guanto scuro, si leggeva come un polso nudo.
- **Guanti**: cuciture scure `#2e2018` lungo i fianchi di ogni dito, fra un dito e l'altro
  (`cucitureDito`), e luce sulle nocche `#8a6446` (più forte se il guanto è consumato).

**Come regolare:** `POSE` (`avambracci`, `lunghezze`, `spalle`), `PUNTALE_PIANTATO`, `VELO` (`yT`,
`zT`, `mezza`, `prese`, `gomito`, `spalla`), `COLORI_MANI` (`manopola`, `cucitura`, `nocche`,
`manicaPiega`, `manicaChiara`); in `primoPiano.ts` il contrasto della maglia (`0.12 * punto`) e le due
tinte notturne.

## 3. Cripta (media)

**Problema.** Saturazione 0,37 contro 0,83 del bozzetto 7: capsule come casse di legno marrone,
lastre del pavimento con le righe nere, coperchio aperto un rettangolo bianco opaco; le pozze di luce
cotte valevano solo con `uNight`.

**Fatto** (`src/regia/scena/cripta.ts`):
- **Una luce sua** (`materialeCripta`, nuova): lo stesso shader degli oggetti del mondo, con gli
  stessi uniform condivisi, ma con `uNight` 0 (sotto terra non arriva la notte che spegne i colori
  verso il blu), la luce principale calda dei lumi dall'alto senza le ombre del sole, il riempimento
  caldo e basso; e l'**emissione cotta sempre accesa** dentro la Cripta: la riga dell'emissione
  dello shader diventa `max(uNight, uEmissioneInterna)` con `uEmissioneInterna = 1`. Il materiale del
  mondo non cambia. Saturazione misurata: 0,67-0,80 (prima 0,37).
- **Capsule di rame** `#a0582c` con le **fasce d'ottone** `#b08a3a`, superfici `OTTONE` (il riflesso
  caldo del lume) per corpo, costole e fasce, `METALLO` per lo zoccolo.
- **Pavimento**: lastre a filo, ognuna una lastra e un giunto dipinto sul bordo (6%, due geometrie:
  `TESSERA_LASTRA` e `TESSERA_GIUNTO`), giunti a ×0,75 del colore della lastra, lastre variate ±10%,
  come proposto. Prima i giunti erano la malta scura fra scatole staccate di 3,5 cm e il contorno
  della post li ripassava di nero.
- **Pozze dei lumi**: sotto ogni lume una pozza calda di circa 1,5 m sul pavimento (e un quarto sulle
  facce verticali), oltre alla caduta morbida di prima: il pavimento non è più tutto uguale.
- **Coperchio di vetro** con alfa 0,3 (il centro della texture quasi trasparente, 0,04-0,2) e un
  **bordo di luce** `rgba(255,236,200,0,85)` più un riflesso diagonale leggero; i vetri gelati dei
  dormienti restano più coprenti. Quello della capsula 5, con la scritta, resta appannato da chiuso
  (la scritta si deve leggere da dentro) e si schiarisce mentre si apre (opacità fino a 0,45): da
  fuori è un vetro col bordo di luce, non un pannello bianco.
- **Tubo di rame lungo la volta** (raggio 6,5 cm, `OTTONE`), con le discese alle due testate, i
  manicotti d'ottone ogni 2,2 m e le staffe di ferro.
- La luce dipinta (`illuminaCripta`) è meno arancio e più a valori: caduta più lenta, occlusione
  minore vicino ai lumi.

**Come regolare:** in `materialeCripta` gli uniform propri (`uSunColor`, `uSunIntensity`,
`uAmbTop`/`uAmbBottom`, `uLuce`); `CAPSULA`, `FASCIA_OTTONE`, `TUBO_VOLTA`; nel pavimento `tinta(col, 0.75)` (giunto)
e `0.9 + r * 0.2` (lastre); in `illuminaCripta` la pozza (`0.5`, raggio 1,5 m); in `texturaVetro` le alfa del gradiente e il bordo.

## 4. LOD a Media (media)

`distanzaLodPerQualita`: Bassa 260 m, **Media 310 m** (prima 400), Alta 400 m. Ad Alta il caso
peggiore con i personaggi in piazza resta sotto i 2,5 M (vedi Prestazioni), quindi Alta non scende a
350. Il guadagno a Media è in buona parte assorbito dal paese più ricco (punto 1): vedi la tabella.

## 5. Lavatoio (media)

Non c'è modo, da qui, di chiedere un'approvazione esplicita a chi decide il gioco, quindi ho seguito
la seconda strada: **`DISLIVELLO_LAVATOIO = 0`** (piazza.ts; il commento spiega che 0,8 riporta la
soluzione di rifinitura 1), niente basamento né gradini, collisori e punto `esamina:lavatoio` come
prima di rifinitura 1, e **Togna al suo posto di prima** (`togna@lavatoio`: nord 3,73, est −1,51).
La vasca sepolta si risolve solo nel visivo, senza collisori nuovi (`lastricatoSulPendio`): dove il
pendio sale sopra il lastricato del lavatoio (oltre 0,42 m) il lastricato continua sul pendio come
un selciato in salita, e sopra la parte della vasca che resta sotto terra (oltre 1,06 m) ci sono le
lastre di copertura, come una vasca coperta a metà. La tettoia con l'assito chiaro di rifinitura 1
resta.

**Prova:** `tests/popolamento/lavatoio-a-piedi.test.ts` (nuova) cammina col `PlayerController` vero
dal chiodo 5 fino a `esamina:lavatoio` e fino a Togna (alle 10 del primo giorno), entro 1,8 m, con le
deviazioni laterali se il passo dritto è chiuso, e controlla che `DISLIVELLO_LAVATOIO` sia 0.

## 6. Allocazioni dello squadro (bassa)

`mDa(trasf, out)` scrive nell'uscita passata (quaternione e scala di lavoro del modulo);
`obiettivoMano(…, out)` usa `out.multiplyMatrices`; tre matrici di lavoro (`_mSt`, `_mMira`, `_mMano`)
al posto di `mDa(…)`, `mStrumento.clone()` e `new Matrix4().makeTranslation(…)`. Le spalle della posa
sono due vettori riusati. `update` non alloca più.

## 7. `colorSpace` del vetro (bassa)

`texturaVetro`: `t.colorSpace = NoColorSpace`, come gli altri oggetti e i personaggi. Il colore del
materiale del vetro passa da `#e4eef8` a `#d6dde4` (vetri con la scritta e gelati) e `#a8b2bc` (gli
altri), perché la texture non più linearizzata in lettura usciva più chiara; l'opacità ora viene
dall'alfa della texture (punto 3) invece che dallo 0,85-0,95 del materiale. «Non fidarti delle
campane» si legge scura sul vetro appannato, non più quasi nera (b01).

## File fuori dall'area toccati

- `src/render/primoPiano.ts` (area «mondo», materiale del primo piano): poche righe nei rami del
  cuoio e della lana. Maglia della lana più grossa e più contrastata (±12% invece di ±6%, con la
  sfumatura dove i punti diventano più piccoli di un pixel, per non fare moiré) e due tinte notturne
  (`uNight`): la lana non va al grigio neutro, il cuoio resta bruno. Gli altri materiali non
  cambiano.
- `tests/popolamento/lavatoio-a-piedi.test.ts`: prova nuova (punto 5).

Tutti gli altri file sono dell'area «oggetti»: `src/oggetti/oggetti/` (`annesso.ts` e `orto.ts`
nuovi, `mani.ts`, `primaPersona.ts`, `rustico.ts`), `src/popolamento/` (`cantiere.ts`, `corbella.ts`,
`forme.ts`, `abitanti.ts`, `luoghi/case.ts`, `luoghi/piazza.ts`), `src/regia/scena/cripta.ts`.

## API nuove o cambiate

- `oggetti/oggetti/annesso.ts`: `creaAnnesso(opz)`, `TipoAnnesso` (`'stalla' | 'legnaia' | 'fienile'`),
  `OpzioniAnnesso`.
- `oggetti/oggetti/orto.ts`: `creaOrto(opz)`, `creaAlberoFrutto(opz)`, `SpecieFrutto`.
- `oggetti/oggetti/rustico.ts`: `OpzioniRustico.altezzaPiani` (0,85-1,2, predefinito 1).
- `oggetti/oggetti/mani.ts`: `COLORI_MANI.cucitura`, `nocche`, `manicaPiega`, `manicaChiara`
  (`manopola` cambia valore).
- `oggetti/oggetti/primaPersona.ts`: `Posa.spalle` (facoltativo), `VELO.spalla`; cambiano i valori
  di `PUNTALE_PIANTATO` e di `VELO`.
- `popolamento/forme.ts`: `annessoLontano(…)`, `alberoLontano(…)`; `coronaSulSuolo(…, coloreVertice?)`
  (ultimo parametro, facoltativo).
- `popolamento/luoghi/case.ts`: `costruisciCase(ctx, quante = 90)`, `costruisciAnnessi(ctx, case_,
  quanti = 52)`, `costruisciVerdeDelPaese(ctx, case_)`, `cortiliDelleCase(ctx, case_)`;
  `CasaPosata.scala`, `CasaPosata.balcone` (facoltativi).
- `popolamento/corbella.ts`: `StatisticheCorbella.annessi`, `orti`, `alberiFrutto` (facoltativi).
- `popolamento/cantiere.ts`: `distanzaLodPerQualita('media')` = 310.
- `regia/scena/cripta.ts`: `materialeCripta(base)`; nello shader della Cripta l'uniform
  `uEmissioneInterna`.
- `popolamento/luoghi/piazza.ts`: `DISLIVELLO_LAVATOIO` = 0.
- Nessuna API di `window.__GAME__` è cambiata.

## Verifiche

`npm run typecheck` pulito; `npm test` 63 file, 835 prove passate (1 saltata, come prima), compresa
quella nuova del lavatoio; `npm run build` verde; `npm run e2e:fase1` (prologo e missione 1 coi tasti
veri, con le 32 case e gli annessi nuovi) «prova ok in 115 s».

## Prestazioni

`getStats()` nelle stesse inquadrature, prima (`5f64bba`) e dopo; Alta se non è detto altro. I tempi
di SwiftShader non dicono niente (le schermate giravano insieme ad altre prove) e non li riporto.

| Inquadratura | Draw call prima → dopo | Triangoli prima → dopo |
|---|---|---|
| c1 alba dal castagno | 216 → 216 | 1,73 M → 1,94 M |
| c2 terrazze verso il paese | 248 → 248 | 1,92 M → 2,13 M |
| c2m lo stesso, **Media** | 243 → 242 | 1,71 M → 1,92 M |
| c3 planata sull'asse | 170 → 170 | 0,66 M → 0,66 M |
| c5 notte, margine del paese | 175 → 175 | 1,51 M → 1,71 M |
| a01 piazza al mattino | 220 → 218 | 1,32 M → 1,52 M |
| a03 lavatoio | 232 → 232 | 1,47 M → 1,67 M |
| a08 belvedere al tramonto | 186 → 186 | 1,57 M → 1,78 M |
| a12 Velo sopra Corbella | 168 → 168 | 1,57 M → 1,76 M |
| a16 alba dal castagno morto | 210 → 210 | 1,80 M → 2,01 M |
| p2 planata verso il paese | 235 → 235 | 1,88 M → 2,09 M |
| p5 il paese da 190 m, nel bosco (caso peggiore) | 276 → 275 | 2,20 M → **2,43 M** |
| p6 lo stesso, **Media** | 271 → **255** | 2,02 M → **1,80 M** |
| m1 terrazza verso il paese, **Media** (come a20) | 245 → 244 | 1,70 M → 1,92 M |
| m2 belvedere verso il paese, **Media** | 176 → 176 | 1,47 M → 1,68 M |
| m4 terrazza alle 10, personaggi in piazza | 250 → 250 | 1,92 M → 2,14 M |
| m6 il paese da 190 m alle 10 | 276 → 276 | 2,22 M → 2,43 M |
| m7 in piazza alle 10, coi personaggi | 185 → 185 | 1,30 M → 1,51 M |
| b02 Cripta | 174 → 175 | 1,34 M → 1,54 M |
| b06 squadro piantato | 239 → 239 | 2,00 M → 2,21 M |

- **Alta**: il caso peggiore è 275 draw call e 2,43 M triangoli (il paese da 190 m dentro il bosco),
  sotto il tetto del brief (circa 400 e 2,5 M). Coi personaggi in piazza alle 10 (m4, m6, m7) non
  si supera: Alta resta a 400 m.
- **Media**: dove la distanza conta (il paese da 190 m, p6) il LOD a 310 m toglie 16 draw call e
  0,22 M triangoli, anche col paese più ricco. Dalla terrazza (m1, come a20) il paese è tutto entro
  100-200 m, quindi il LOD non cambia nulla e i triangoli salgono di 0,21 M: è il costo del paese
  nuovo (sotto). Se su Iris Xe non regge, la leva più forte è `costruisciCase(ctx, 58)` (circa
  −0,15 M dappertutto, ma si perde buona parte del grumo); una terza versione del paese, a dettaglio
  medio fra 120 m e la distanza del LOD, sarebbe il passo giusto (vedi «Cosa resta»).
- **Paese** (`statistiche` di `installaCorbella`): 737.521 → 945.972 triangoli (le 32 case nuove
  circa 150.000, 38 annessi circa 30.000, 23 alberi da frutto circa 35.000, 23 orti circa 8.000, aie
  e cortili il resto), collisori 2.974 → 3.200 (annessi `casa`/`tetto`, case nuove, tronchi), lumi
  434 → 682 (le finestre delle case nuove e degli annessi), 90 case, 38 annessi, 23 orti, 23
  alberi. Un rustico a due piani fa circa 4.100 triangoli (3.300 a dettaglio medio), una stalla o un
  fienile 300-500, una legnaia 1.400-1.600 (i ceppi), un albero da frutto 2.400 (600 lontano dalla
  piazza), un orto 570 (180).
- Prima persona: lo squadro con le mani e le maniche aumenta di qualche centinaio di triangoli (le
  cuciture delle dita, il polsino), il Velo di circa 2.000 (le braccia fino alla spalla); `update`
  dello squadro non alloca più.
- Cripta: un tubo, i manicotti e le staffe in più (circa 3.000 triangoli); il pavimento ha più
  vertici (le piastrelle 3 × 3) ma è sempre una mesh; il materiale della Cripta è un `ShaderMaterial`
  in più (un programma in più da compilare all'ingresso del prologo).

## Cosa resta

- **Media dalla terrazza.** Vedi sopra: il paese nuovo costa 0,21 M triangoli dove il LOD non
  arriva. Una versione intermedia del paese (rustici a dettaglio `basso` con le file di piode,
  annessi senza ceppi, alberi senza frutti) fra 120 m e la distanza del LOD dimezzerebbe quel costo.
- **Il campanile da qualche punto alto** (per esempio dalla terrazza sopra il nucleo, a 1130/44) ora
  è coperto da una delle case nuove: è il prezzo del grumo; se dà fastidio, si allarga `LIBERI` o
  si esclude un corridoio verso il campanile.
- **La vasca del lavatoio** resta in parte sotto il pendio (coperta da lastre): la soluzione vera
  (abbassare il terreno davanti o girare il lavatoio lungo la curva di livello) cambia il suolo o i
  collisori e va decisa da chi decide il gioco.
- **Cripta**: il bozzetto 7 è molto più rosso e contrastato (un lume rosso, ombre nere). Qui la
  luce resta quella calda dei lumi a olio; i valori ora ci sono (pozze e angoli scuri) ma il pavimento
  da lontano si legge ancora poco sotto il filtro pittorico.
- **Prima persona**: nel piantato le due mani impugnano l'asta (nel bozzetto 2 la destra è appoggiata
  sul muro); con lo squadro piantato davanti a un muro che sta a sinistra, come sulle terrazze, la
  mano appoggiata cadeva nel vuoto. Servirebbe sapere dove sta il muro (dalla regia) per appoggiarla
  davvero.
- **Tetti dal Velo**: più fitti e vari, ma ancora grigi dall'alto a mezzogiorno (materiale `PIODE`,
  area «mondo»).

## Come rifare le schermate

Build per le prove (`npm run build:e2e`), poi lo script delle schermate del direttore artistico
(Chromium + SwiftShader, 1280×720) con l'elenco di questa traccia: ogni voce è un `setup(g)` sopra
`window.__GAME__` (`setTime`, `teleport`, `lookAt`, `startGlide`, `setSetting('qualita', …)`); la
parte B gioca il prologo (`Nuova partita`, `regia.avanza`, `regia.mira`, `regia.premi('KeyE')`,
`regia.avvicina`) e prende lo squadro (`r.regia.squadro.prendi()`, `pianta('cs_3')`, `pianta('cs_5')`).
Posizioni (z, θ) e ore: c1 (1117, 26,6) alle 7 verso il campanile; c2 (965, 25) alle 12,30; c3 planata
da (700, 35, 330 m) alle 11; c5 (1085, 31,5) alle 22,24; a01 (1040, 36) alle 10,30; a03 (1035,5,
39,9) alle 11; a08 (1094, 29,8) alle 18,36; a12 (1110, 31, 55 m) alle 16 in planata; a13 (1010, 27,
45 m) alle 18,12; a16 (1123, 26,9) alle 7,12; p1 come a08 alle 10,30; p2 (1000, 46, 25 m) alle 14;
p5/p6 (860, 16) alle 11; m1/m2 come c2/a08 alle 11 a Media; m4-m6 come c2 e p5 alle 10; m7 (1040, 36)
alle 10.
