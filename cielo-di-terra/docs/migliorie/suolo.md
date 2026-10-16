# Migliorie, traccia «suolo»

Ramo `migliorie/suolo`, partito da `49e41d8` (brief delle quattro tracce). Risponde a «la grafica del
suolo» della prova del 16 ottobre e alla schermata `segnalazione-suolo.webp`: prologo, strada del
paese sotto il campanile, prima mattina, qualità «Automatica».

Il foglio da guardare per primo è `suolo/foglio-strada-campanile.jpg`: la stessa vista della
segnalazione (6:30, strada della Cripta sotto il belvedere) prima | dopo | bozzetto, a Media e a Bassa,
con accanto la segnalazione e i bozzetti 1 e 2.

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
  conche, fresco, giallo-verde al sole), d'oro secco (paglia, ~30% della superficie) e di ruggine delle
  felci (più sui pendii), sulla luminosità del bioma. Le ottave piccole (4-11 m) sfumano con la distanza
  in pixel: dall'alto e da lontano erano un mimetico a macchioline.
- Zolle e ciuffi dipinti (0,2-0,75 m): macchie allungate a tocco di pennello con la cima chiara e gialla
  e il piede in ombra, fino a ~25 m (a Bassa ~10 m). Prima ho provato celle di Voronoi col bordo scuro:
  facevano un selciato.
- Fili d'erba dipinti vicino al giocatore al posto delle pennellate allungate; tocchi e chiazze di valore
  più leggeri (±10% invece di ±14%).
- Il riconoscimento del prato è più largo (`(g − max(r, b) + 0,05) × 8`): il prato del paese è prato
  pieno; l'ocra, le rive, la terra e la roccia restano fuori.
- `terrenoDipinto` restituisce quanto il punto è prato; sulla terra nuda la luce è quasi senza bande.

### Il materiale del mondo (`render/worldMaterial.ts`, `render/shaders/common.ts`)
- Il terreno si dipinge sul colore del bioma puro; il viraggio caldo viene dopo, più leggero (0,2
  invece di 0,35).
- **Colore locale** (`coloreLocale`, `quotaColoreLocale`): sul suolo la luminosità resta quella
  illuminata, ma la tinta torna verso quella dell'albedo per `(0,15 + 0,4·oro)·(1 − notte)` (fino a 0,55
  all'alba e al tramonto, niente di notte). Vale per il terreno (×1,6 sulla terra nuda), la terra battuta
  degli oggetti (×1,6), l'erba degli oggetti (×1) e la pietra in piano (selciati, lastre, facce dei
  gradini). I muri, le case, i personaggi e il cielo non lo usano.
- Vista di prova 2 (`__GAME__.game.uniforms.uDebugView.value = 2`): l'albedo dipinto, senza luce né
  aria, nel mondo e nella vegetazione.

### L'erba vera (`scene/sottobosco.ts`, `scene/sottoboscoForme.ts`, `render/shaders/natura.ts`, `render/naturaMateriali.ts`)
- Più fitta (4,2 candidati per m² invece di 3,3) e in paese quasi come fuori (−15% invece di −45%);
  ciuffi più stretti e più alti (larghi 0,72-1,14, alti 0,24-0,46 m, in paese −20% invece di −40%),
  cespo più dritto e raccolto.
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
  non nel campione di 3 m: sui gradoni un campione su quattro cadeva su un'alzata.
- Generazione più economica: i conti cari (quota, pendenza nel punto, sentieri) solo per i candidati che
  possono passare, e i collisori divisi per quadrati di 3 m (in paese erano centinaia per ogni ciuffo).

### La strada (`popolamento/sentieri.ts`, `popolamento/forme.ts`, `popolamento/mobili.ts`, `popolamento/ripiano.ts`, `render/terrainMesh.ts`, `render/superfici.ts`)
- Terra battuta grigio-bruna e polverosa (#9b8a70 in mezzo, #8a785e, #7a684e verso i bordi), più chiara
  dove si cammina, con l'orlo dove l'erba entra a tratti; otto vertici di traverso invece di cinque. I
  colori sono scelti perché la superficie automatica li legga come terra (`tests/suolo.test.ts`). Lo
  stesso colore per i sentieri del popolamento mobile (passerella, scorciatoia) e per i ripiani di terra.
- Nei vertici del terreno: terra solo fino a ~0,5 m dal bordo, poi erba calpestata che sfuma nel prato in
  1,5 m (era ocra fino a 2,5 m).
- `supTerra`: polvere chiara a chiazze e sassi di 8-15 cm, di forma irregolare, che si vedono fino a
  ~20 m; luce quasi senza bande (sulla strada appena bombata le tre bande facevano strisce).

### La post (`render/post/shaders.ts`, `render/post/pipeline.ts`)
- **Ginocchio della saturazione** dei colori caldi e d'erba (dove il blu è il canale più basso): sopra
  0,58 (HSV) la saturazione cresce la metà. Il cielo, le ombre viola, i lumi e la notte non cambiano.
- Kuwahara e pennellata **non** li ho toccati: dalle prove A/B non erano la causa, e a Bassa (dove non ci
  sono) il suolo era lo stesso.

## Come si regola
- Colore del prato: le tinte in `pratoColore` (verde scuro, fresco, al sole; paglia; ruggine) e le soglie
  delle chiazze (`secco = smoothstep(0.5, 0.64, m1)`).
- Quanto il suolo tiene il suo colore nella luce dorata: `quotaColoreLocale()` in `shaders/common.ts`
  (0,15 + 0,4·oro), e i pesi `kLocale` in `worldMaterial.ts`.
- Ginocchio della saturazione: `parametri.ginocchioSaturazione = [soglia, pendenza]`, vivo da console
  (`__GAME__.game.post.parametri`); `[1, 1]` lo spegne.
- Densità e misure dell'erba: `genera()` in `scene/sottobosco.ts` (candidati per m², riduzione in paese,
  bordi dei sentieri); il raggio e la densità per qualità restano in `preset()`.
- Colori della strada: `BATTUTO_*` e `ORLO_ERBA` in `popolamento/sentieri.ts` (devono restare terra per la
  superficie automatica: la prova lo controlla).

## Prove fatte
- `npm run typecheck`, `npm test` (64 file e uno saltato, 849 prove, comprese le 7 nuove di
  `tests/suolo.test.ts`: terra battuta sempre «terra» anche fra due vertici, meno satura di prima, shader
  con colore locale e ginocchio, erba alla quota di un ripiano finto e non fuori), `npm run build`: verdi.
- `npm run e2e:fase1 -- --senza-foto`: «prova ok in 94 s» (prologo e missione 1 interi). La traccia
  cambia solo il disegno (l'erba e i nastri dei sentieri non hanno collisori; gradini e muri restano
  com'erano), ma l'ho fatta girare una volta per esserne sicuro.
- Schermate (`suolo/inquadrature.mjs`, Chromium + SwiftShader, 1280×720), stesse ore e posizioni prima e
  dopo: strada sotto il campanile alle 6:30 a Media, Bassa e Alta; belvedere all'alba; terrazze a
  mezzogiorno; prato in pendio alle 17 (a Mane sopra il riale, 20-25°); gradoni sopra la botola alle
  17; sentiero dei Ronchi di notte. Fogli `suolo/prima-dopo-*.jpg` e `suolo/dettaglio-strada-prato.jpg`.
- Sequenza camminando sulla strada verso il paese (`suolo/cammina.mjs`, 8 fotogrammi a 1 m): l'erba non
  spunta a scatti, le zolle e i sassi non sfarfallano.
- `npm run shots` 1-7 e 11-14 (Alta): `suolo/shots-1-7-prima-dopo.jpg` e
  `suolo/shots-confronti-prima-dopo.jpg`. Cielo, case, personaggi, prima persona e notte non cambiano;
  cambia il suolo vicino.

Misure sulla vista della segnalazione (tinta / saturazione HSV / variazione locale / pixel verdi):

| | Prato prima | Prato dopo | Strada prima | Strada dopo | Terzo basso prima → dopo |
|---|---|---|---|---|---|
| Media | 38° / 0,73 / 0,025 / 0% | **58° / 0,62 / 0,052 / 36%** | 22° / 0,76 | **34° / 0,56** | 32° / 0,70 → 54° / 0,59 |
| Bassa | 38° / 0,74 / 0,030 / 0% | 59° / 0,63 / 0,055 / 43% | 22° / 0,77 | 34° / 0,57 | 33° / 0,74 → 54° / 0,61 |
| Alta | 38° / 0,73 / 0,029 / 0% | 58° / 0,62 / 0,053 / 35% | 22° / 0,76 | 35° / 0,56 | 32° / 0,70 → 54° / 0,59 |

Confronto 1 (alba sotto il castagno), terzo basso: da 34° / 0,65 a **47° / 0,57** (l'obiettivo ≤ 0,6
della rifinitura 2 ora è raggiunto; bozzetto 1: 0,52). Confronto 2 (mezzogiorno): 48° / 0,54 prima e
dopo (bozzetto 2: 43° / 0,51), con più variazione locale (0,051 → 0,057 nel terzo basso).

## Prestazioni
`suolo/prestazioni.mjs` (Media, SwiftShader su una macchina condivisa: i tempi valgono come confronto, e
oscillano del 10-20% da una corsa all'altra):

| Vista | Chiamate | Triangoli prima → dopo | Istanze del sottobosco | Generazione di una cella |
|---|---|---|---|---|
| strada | 163 = 163 | 1 479 317 → 1 600 446 (+8%) | 1 943 → 4 384 | 0,67 → 0,94-1,0 ms |
| prato in pendio | 208 → 209 | 1 810 608 → 1 872 808 (+3%) | 4 463 → 5 645 | 0,67-0,83 → 0,82-1,0 ms |
| terrazze | 231 → 230 | 1 840 730 → 1 936 439 (+5%) | 2 859 → 4 765 | 0,67-0,75 → 0,99-1,12 ms |

Il passo «mondo» in due corse alternate: strada 4 426 / 3 882 ms prima, 4 351 / 5 050 dopo; pendio
2 284 / 2 477 contro 2 331 / 2 304; terrazze 3 584 / 3 726 contro 3 838 / 3 721: nel rumore della misura,
al più qualche per cento in più dove l'erba è raddoppiata. Le chiamate di disegno non cambiano (l'erba
resta una InstancedMesh per tipo). Il frammento d'erba costa meno di prima (solo `pratoColore`); quello
del terreno ha due rumori in più (le zolle) e niente celle. In `npm run shots` i triangoli salgono
dell'1-2%.

## Che cosa resta
- **Una striscia salmone sul bordo sinistro della strada** nella vista della segnalazione: è la faccia
  di un gradino di pietra del sentiero (il profilo camminabile), alta 10-14 cm sopra il nastro, accesa
  dal sole radente come i muri delle case. C'era anche prima (sotto l'arancione non si notava). Si
  potrebbe abbassare il nastro sui gradini o dare ai gradini dei sentieri di terra la faccia di terra.
- Sui gradoni del paese il colore delle alzate (`terraceRiser`) sbava sui ripiani per la griglia di 3 m
  del terreno, e i fili scuri fra un tratto e l'altro dei riempimenti dei muri restano (`s06`).
- Il prato a mezzogiorno sulle terrazze (`s03`, confronto 2) è un poco più giallo e più contrastato di
  prima, con gli stessi valori medi: si potrebbe spegnere un poco il verde al sole.
- Le zolle dipinte tirano tutte nella stessa diagonale (un angolo fisso, come i tocchi: ruotarle con il
  luogo disegnerebbe anelli).
- Le misure dei tempi andrebbero rifatte su una Iris Xe vera a 1080p (qui solo SwiftShader).
