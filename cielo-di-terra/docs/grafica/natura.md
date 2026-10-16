# Traccia «natura»: castagni, boschi, sottobosco, terreno, muri a secco, acqua

Ramo `grafica/natura`. Tutto il verde e l'acqua del cilindro: gli alberi (castagni, noci, betulle,
larici, cipressi) e i boschi lontani, il sottobosco vicino al giocatore, i sentieri dipinti sul
terreno, i muri a secco delle terrazze, il lago Verbanetto, il riale e il lavatoio di Corbella.
Solo grafica: altezze del suolo, posizioni degli oggetti interattivi, contenuti, tempi e testi non
cambiano; i collisori nemmeno, salvo i cilindri dei tronchi degli alberi nuovi dei boschi (vedi
«Coerenza con il gioco»).

Schermate in `docs/grafica/natura/` (JPEG 1280×720, Chromium + SwiftShader, qualità Alta salvo dove
detto):
- `foglio-confronto-*.jpg`: **bozzetto | prima | dopo** per i quattro confronti del brief
  (inquadrature 11-14 di `npm run shots`);
- `prima-dopo-*.jpg`: **prima | dopo** per le inquadrature nuove a livello degli occhi (selva al
  mattino, muri e terrazze, castagno morto, riva del lago, riale, versanti boscosi, prato la sera,
  lago dall'alto, Terrazza Pedrazzini);
- `dopo-*.jpg`: le stesse inquadrature a piena grandezza;
- `qualita-*.jpg`: la stessa inquadratura a Bassa, Media e Alta (selva, versanti, confronto 1).

"Prima" è il ramo di partenza `claude/jolly-archimedes-cm54mt` (6c12b02), con le stesse
inquadrature (`scripts/shots-natura.mjs` fatto girare su quel codice).

Le inquadrature nuove si rifanno con

    node scripts/shots-natura.mjs [--no-build] [--only=21,25] [--qualita=bassa|media|alta] [--out=cartella]

(predefinito `docs/shots/natura`, che come le altre schermate rigenerate **non** si committa).
Stampa anche draw call e triangoli della scena e della mappa d'ombra.

## In breve

| | Prima | Dopo |
|---|---|---|
| Castagni | palloni bitorzoluti a tinta unita (arancio, verde, giallo), un albero un colore; i castagni del paese palloni lisci | da vicino (fino a ~130 m) la chioma è fatta di **carte di foglie** rivolte alla camera, con i buchi di cielo e i rami che si vedono; più lontano **masse con normali sferiche** sotto carte più grandi. Le foglie: rametti di foglie lanceolate seghettate, macchie fitte, bordo frastagliato contro il cielo; due toni, luce calda sul bordo, controluce, vento; ottobre mescolato (verde, giallo, oro, ruggine) per albero e per ramo |
| Specie | castagno solo | **castagno, noce, betulla** (tronco bianco a macchie nere, fogliolina tonda), **larice** (cono d'aghi dorati), **cipresso** (fuso scuro vicino alla chiesa e al cimitero) |
| Boschi | alberi radi a pois sui versanti (5149 in tutto il cilindro), da lontano puntini | **boschi fitti** (23 487 alberi) sui versanti (fino a ~45°) e nelle selve, 4 livelli di dettaglio con passaggio retinato; oltre ~280 m una **coltre di chiome** (`BoschiLontani`) dipinta a cupole d'ottobre a macchie: da lontano e sull'altra metà del cilindro i versanti si leggono come masse di bosco |
| Castagno morto | tronco a prisma con 7 rami a cono | tronco **scanalato e ritorto** con contrafforti e radici, cavità col labbro, rami ricorsivi che si assottigliano fino ai ramoscelli, monconi spezzati, corteccia a solchi con legno argentato, muschio e licheni (bozzetto 1) |
| Sottobosco | nessuno | vicino al giocatore: **ciuffi d'erba** che si piegano al vento e prendono il colore del prato sotto, erba secca dorata, felci ruggine, fiori, **cespugli**, **sassi con muschio** (grandi sui pendii rocciosi), **ricci e foglie di castagno** sotto i castagni; raggio e densità dalla qualità |
| Terreno | verde unico con i tracciati solo come nastri | **sentieri di terra battuta** dipinti nei vertici del terreno (tracciati di Corbella, via del riale, salita alle selve, traccia del Sass Grand), foglie cadute a gruppi |
| Muri a secco | lastre di copertina enormi, piatte e bianche | testa fatta di **sassi singoli** (lastre, cuscini, qualcuno di coltello) proporzionati alla pietra del muro, calcare grigio caldo con licheni e muschio; faccia con pietre leggibili; da lontano gradini verdi con l'alzata di pietra |
| Lago | turchese acceso quasi uniforme con trattini bianchi, blu cobalto al largo | **giada e turchese**: riva chiara di sabbia e ciottoli che si vede sotto l'acqua, fascia pallida, giada, fondo profondo; riflessi morbidi del cielo, increspature dipinte, schiuma sulla riva; da lontano resta giada (bozzetto 3) |
| Riale e lavatoio | il riale era solo il colore turchese del terreno nel letto, fermo; la vasca del lavatoio vuota | **acqua che scorre** nel letto del riale (nastro con la corrente, pennellate che scendono, schiuma sui salti); acqua anche nella vasca del lavatoio, che però il popolamento ha posato mezza dentro il suolo della piazza (vedi «Che cosa resta») |

## A. Alberi e boschi

File: `src/scene/alberi.ts` (nuovo), `src/scene/vegetation.ts`, `src/scene/bosco.ts` (nuovo),
`src/render/naturaMateriali.ts` (nuovo), `src/render/shaders/natura.ts` (nuovo).

**Geometrie** (`geometrieAlbero(specie, variante)`): per ogni specie 4 livelli di dettaglio, ognuno
con tre parti istanziate:
- *masse* della chioma (`chiomaAMasse`): ellissoidi bitorzoluti fusi, con la normale "sferica"
  (miscela fra la normale della massa e quella dell'ellissoide della chioma intera) e
  l'occlusione cotta nel colore. Sotto le carte le masse sono rimpicciolite e scurite: sono il
  **nucleo in ombra** della chioma (`impostaNucleo`, 0.66 / 0.78 / 0.92 per i LOD 0-2). Per le
  latifoglie (castagno, noce, betulla, `SOLO_CARTE` in `vegetation.ts`) ai LOD 0 e 1 le masse
  non si vedono: stanno solo sul layer delle ombre (`layers.disable(0)`) e danno l'ombra
  dell'albero, mentre la chioma la fanno le carte. Viste, in controluce, erano macchie quasi
  nere dentro la chioma; senza, la chioma ha i buchi di cielo e i rami dei bozzetti. Larice e
  cipresso le tengono (il cono e il fuso sono la loro forma);
- *carte di foglie* (`carteChioma`): quadrati sparsi sulla superficie delle masse (scartati se
  sepolti in un'altra massa), ognuno con il suo seme, la sua occlusione e il suo colore; il vertex
  shader li gira verso la camera e li tira avanti di 0.42 × lato, così le foglie stanno sopra il
  nucleo anche di taglio; il fragment shader disegna le foglie (`ciuffoFoglie`): per il castagno
  una carta su tre è una macchia fitta col bordo a punte, le altre due rametti di 5 foglie
  alterne lanceolate, seghettate, che pendono; il noce e la betulla 9 foglioline ovali, il larice
  rosette d'aghi, il cipresso scaglie; sotto ~14 px il disegno diventa una macchia lobata;
- *tronco* con i rami principali (castagno contorto, betulla bianca a macchie, larice dritto).

Triangoli per albero (masse + carte + tronco):

| | LOD 0 (< 40 m) | LOD 1 (< 130 m) | LOD 2 (< 280 m) | LOD 3 (statico) |
|---|---|---|---|---|
| castagno | 720 + 1240 + 315 | 160 + 380 + 70 | 80 + 56 + 12 | 88 + 28 |
| noce | 560 + 680 + 207 | 140 + 280 + 25 | 80 + 56 + 12 | 88 + 28 |
| betulla | 480 + 480 + 77 | 100 + 160 + 25 | 60 + 32 + 15 | 28 + 18 |
| larice | 320 + 520 + 63 | 180 + 180 + 12 | 80 + 32 + 12 | 88 + 20 |
| cipresso | 320 + 92 + 15 | 180 + 15 | 80 | 88 |

**Distribuzione** (`Vegetation`): gli alberi si piantano con `densitaBosco` (in `bosco.ts`): la
densità di bosco del terreno con i boschi che salgono sui versanti ripidi (taglio a ~55° invece
di ~32°), più fitti fuori dal paese (selve 0.95, lago 0.75, campi 0.45), mai sulla roccia nuda
(oltre ~45°), sui sentieri, sulle piazze, sui collisori e in acqua. Specie secondo il luogo
(castagni nelle selve e intorno al paese, noci vicino alle case, betulle e larici in alto, cipressi
vicino alla chiesa). Gli alberi isolati sono a gruppi. I livelli 0-2 sono `InstancedMesh` per
specie riempiti dalle celle di 64 m attorno alla camera (ogni 12 m di spostamento); il livello 3 è
statico (tutti gli alberi, masse + carte grandi, fuori dalle ombre). Il passaggio fra livelli è
**retinato in modo complementare** (stesso rumore: dove uno sparisce l'altro compare, pixel per
pixel), niente buchi né doppioni.

**Coltre dei boschi lontani** (`BoschiLontani`): un guscio sopra il terreno dove la densità di
bosco è alta, alto quanto le chiome e a gobbe, costruito a pezzi (≤ 2 ms per fotogramma) in una
mesh per valle (3 draw call). Lo shader `BOSCO` lo dipinge a cupole (una cella di Voronoi di
6.5 m = un albero, bordo frastagliato, normale a cupola, solchi d'ombra fra le chiome) con i
colori d'ottobre **a macchie** (gruppi di verde, oro, ruggine) che da lontano si fondono in
campiture. Compare retinando dove finisce il LOD 2.

**Castagni del popolamento** (`src/oggetti/oggetti/castagno.ts`, usati dal paese e dalle terrazze):
- `creaCastagno`: da vicino (`det: 'alto'`) le masse sono il nucleo verde oliva in ombra (il verde
  che prevale fa scegliere alla superficie AUTO il fogliame a ciuffi; il bruno-arancio diventava
  corteccia liscia) e sopra stanno i **ciuffi di foglie** d'ottobre sul bordo (400 ciuffi di 5
  foglie rivolti in fuori): la chioma si legge a foglie anche da vicino (5829 triangoli, sotto il
  tetto di 6000 del test);
- `creaCastagnoMorto` (castagno del prologo, della botola): rifatto come nel bozzetto 1, vedi la
  tabella (3870 triangoli, 4690 con la botola). Collisore e posizione della botola invariati.

## B. Sottobosco

File: `src/scene/sottobosco.ts`, `src/scene/sottoboscoForme.ts` (nuovi).

Celle di 12 m attorno alla camera, generate con un tempo massimo per fotogramma (3 ms) e tenute in
cache; si rigenerano se cambiano i collisori (il paese vero arriva dopo il motore) o la densità.
Ogni cella campiona il terreno su una griglia di 3 m (quota, pendenza, bosco, colore del prato,
acqua, piazze, paese, roccia, riva) e semina:

| | per m² (Alta) | dove | triangoli |
|---|---|---|---|
| ciuffi d'erba | 3.3 | prati, meno nel bosco e sulla roccia | 48 (16 lame) |
| fiori | 0.09 | prati soleggiati | 9 |
| felci | 0.16 | bosco, ombra, margini | 108 |
| sassi con muschio | 0.05 | ovunque, grandi e fitti sui pendii rocciosi, piccoli sulle rive | 80 |
| cespugli | 0.02 | margini del bosco | 620 |
| foglie cadute, ricci | sotto i castagni e nei boschi | | 24 / 492 |

Niente sottobosco sui sentieri (`sentieri.ts`), dentro i collisori (scatole e cilindri: case, muri,
tronchi), in acqua e sulle piazze. L'erba (`ERBA`): vento a raffiche condiviso con le chiome
(`ventoCondiviso`), colore preso dal prato sotto (`terrainColor` + `pratoDipinto`) con la punta
calda e la base fredda, così il ciuffo sfuma nel terreno; normale piegata verso l'alto (si
illumina come il prato); con la distanza il ciuffo si abbassa fino a sparire (niente bordo netto),
e oltre 18 m le celle tengono un ciuffo su due.

**Qualità** (`impostaQualita(k)`, k = `PresetQualita.vegetazione`): raggio 10 + 24·k m e
densità 0.3 + 0.7·k: Bassa (0.45) ~21 m e 62%, Media (0.75) ~28 m e 83%, Alta (1) 34 m e 100%.
La stessa k accorcia le distanze dei livelli degli alberi (fattore 0.55 + 0.45·k: Bassa 0.75,
Media 0.89, Alta 1).

## C. Terreno, sentieri, muri a secco

- `src/scene/sentieri.ts` (nuovo): i tratti dei sentieri in (z, arco). I tracciati di Corbella
  (`TRACCIATI`), la via del riale (13 m a monte del riale, fuori dal paese), la salita da Corbella
  a Pian dei Ricci e al Sentiero dei Nastri, la traccia dai Ronchi al Sass Grand. Solo colore:
  `render/terrainMesh.ts` mescola nei vertici del terreno la terra battuta (ocra, spalle consumate,
  meno sui pendii ripidi). Le altezze del terreno non cambiano.
- `src/render/shaders/terreno.ts` (della traccia luce, ritocco): le foglie di castagno cadute
  dipinte sul prato vanno a gruppi più radi (prima facevano un tappeto di puntini arancio).
- `src/oggetti/oggetti/muri.ts`: la testa del muro a secco è una fila di **sassi singoli**
  (`sassoTesta`: icosaedro schiacciato con il fondo piatto, normali morbide) di larghezza
  0.55-1.25 volte la pietra del muro, alti 0.09-0.36 m, alcuni di coltello, calcare grigio caldo
  più scuro sui fianchi, licheni gialli e muschio verso monte (`coloreTesta`). Le pietre della
  faccia senza retro e fondo (`pietraFaccia`, 8 triangoli) e i cuscini del muro basso
  (`pietraCuscino`). Stesso ingombro di prima: i collisori del muro non cambiano. Un muro di 14 m
  costa 3960 triangoli (tetto del test 4500), il basso 2300.
- `src/popolamento/terrazzi.ts` (solo la versione lontana): `muroLontanoErboso`, la faccia di
  pietra più scura al piede e la testa verde come il gradone: da lontano le terrazze sono gradini
  verdi con l'alzata di pietra, non righe bianche.

## D. Acqua

File: `src/render/water.ts`.

Un solo shader per tutte le acque con `uAcqua` (x = tipo: 0 lago, 1 riale/vasca; y = velocità della
corrente in m/s; z = profondità della fascia profonda in m):
- **colore dalla profondità** (quota dell'acqua meno `surfaceHeight` del fondo) a fasce morbide:
  sabbia chiara (0.66, 0.68, 0.52), acqua pallida (0.38, 0.62, 0.5), giada (0.15, 0.47, 0.39),
  profonda (0.08, 0.38, 0.4); da lontano tende alla giada (0.2, 0.6, 0.5) e la foschia la copre
  meno (`applyHazeK` 0.62-0.72), così il lago resta un gioiello verde come nel bozzetto 3;
- riflesso morbido del cielo con Fresnel (desaturato, ≤ 40%), increspature dipinte (pennellate
  allungate nel vento), schiuma e riva bagnata dove la profondità va a zero;
- **riale** (`createRiale`): prima era solo il colore turchese del terreno nel letto; ora un nastro
  d'acqua di 10 m che segue `rialeTheta(z)` nel letto (quota del pelo = minimo del fondo + 0.6 m); `aFlusso` dà la coordinata lungo la corrente, le pennellate
  scendono e la schiuma sbianca dove il letto scende;
- **lavatoio** (`aggiungiAcquaLavatoio`, chiamata da `main.ts` dopo `installaCorbella`): un
  pannello d'acqua di 5.1 × 1.75 m 1.5 cm sopra l'orlo della vasca di granito (nel modello del
  paese la vasca è un blocco pieno con l'acqua dipinta dentro), orientato con il chiodo 5, con la
  corrente lenta. Però la vasca, come la posa il popolamento (`luoghi/piazza.ts`, alla quota del
  chiodo 5), sta ~0.4 m sotto il suolo della piazza a monte: dell'acqua si vede solo l'estremità
  verso il gradino. Va sistemato nel popolamento (non in questa traccia).
Nessuna acqua nuova ha collisori; nomi `lago-*` (fuori dalle ombre).

## Come si regola

| Che cosa | Dove | Valori |
|---|---|---|
| Qualità della vegetazione | `PresetQualita.vegetazione` in `render/post/qualita.ts`; `Vegetation.impostaQualita(k)` | Bassa 0.45, Media 0.75, Alta 1 (0.2..1.3) |
| Distanze dei LOD degli alberi | `DISTANZE_ALTA` in `scene/vegetation.ts`; `impostaDistanze(f)` | [40, 130, 280] m × (0.55 + 0.45·k) |
| Raggio e densità del sottobosco | `preset()` in `scene/sottobosco.ts` | raggio 10 + 24·k m, densità 0.3 + 0.7·k; densità per tipo in `genera()` |
| Vento | `ventoCondiviso.value` in `render/naturaMateriali.ts` (uniform `uVento` di tutti i materiali della natura) | x forza 0.6 (0..1.5), y raffiche 0.7, zw direzione (est, nord) |
| Forma delle foglie, nucleo, erba a prato | uniform `uFoglia` | x forma (0 lanceolata, 1 tonda, 2 aghi, 3 squame), y nucleo (scurisce le masse, `impostaNucleo`), z = 1 erba col colore del prato |
| Comparsa / scomparsa con la distanza | uniform `uSfuma`, `impostaSfuma(mat, da0, a0, da1, a1)` | metri; retino complementare |
| Densità dei boschi | `densitaBosco` in `scene/bosco.ts` | temi, pendenza, distanza dal paese |
| Colori della coltre lontana | blocco `BOSCO` in `naturaMateriali.ts` | macchie `vnoise3(P·0.012)`, soglie oro 0.55-0.72, ruggine 0.74-0.88 |
| Acqua | `uAcqua` e le quattro tinte in `render/water.ts` | tipo, corrente, fascia profonda |
| Debug | `window.__GAME__.game.vegetation` | `counts()` = alberi per LOD + istanze del sottobosco; `getStats().treesByLod` |

## Prestazioni

Chromium + SwiftShader, 1280×720 (i tempi di SwiftShader valgono solo come confronto). Draw call e
triangoli della scena (`getStats()`), più la passata delle ombre (`__LUCE__.ombre.stats`).

Qualità **Alta**, stesse inquadrature prima (6c12b02) e dopo:

| Inquadratura | prima: draw / triangoli | dopo: draw / triangoli | ombre prima | ombre dopo |
|---|---|---|---|---|
| 11 confronto 1, alba al castagno | 153 / 0.89 M | 191 / 1.48 M | 74 / 403 k | 76 / 459 k |
| 12 confronto 2, terrazze | 177 / 0.82 M | 215 / 1.51 M | 46 / 258 k | 47 / 269 k |
| 13 confronto 3, planata | 172 / 0.44 M | 191 / 0.65 M | 24 / 23 k | 24 / 23 k |
| 14 confronto 5, notte | 130 / 0.83 M | 161 / 1.32 M | — | — |
| 21 selva al mattino | 217 / 0.77 M | **262 / 1.59 M** | 27 / 103 k | 34 / 114 k |
| 22 muri e terrazze | 121 / 0.63 M | 160 / 1.22 M | 55 / 334 k | 57 / 368 k |
| 23 castagno morto | 149 / 0.90 M | 188 / 1.54 M | 73 / 396 k | 75 / 449 k |
| 24 riva del lago | 94 / 0.40 M | 138 / 1.19 M | 24 / 26 k | 30 / 32 k |
| 25 riale | 126 / 0.54 M | 165 / 1.25 M | 42 / 151 k | 46 / 155 k |
| 26 versanti boscosi | 117 / 0.56 M | 149 / 1.14 M | 57 / 263 k | 58 / 286 k |
| 27 prato la sera | 161 / 0.83 M | 204 / 1.52 M | 79 / 407 k | 82 / 456 k |
| 29 lago dall'alto | 82 / 0.36 M | 111 / 0.66 M | 26 / 22 k | 24 / 20 k |
| 30 Terrazza Pedrazzini | 193 / 0.80 M | 233 / 1.55 M | 39 / 210 k | 42 / 196 k |

Il caso peggiore (dentro la selva) è 262 draw call e 1.6 M triangoli ad Alta, sotto il tetto del
brief (~400 e 2.5 M). Il grosso dei triangoli in più sono le carte di foglie dei LOD 0-1 e il
sottobosco; le draw call in più sono le mesh istanziate per specie × livello × parte (al più
5 × 3 × 3, quasi tutte vuote e quindi saltate) più gli 8 tipi del sottobosco e le 3 mesh della
coltre.

Per qualità, stesse inquadrature (dopo):

| Inquadratura | Bassa | Media | Alta |
|---|---|---|---|
| 11 confronto 1 | 172 / 1.22 M, senza ombre | 181 / 1.36 M + ombre 61 / 366 k | 191 / 1.48 M + ombre 76 / 459 k |
| 21 selva | 249 / 1.26 M, senza ombre | 257 / 1.42 M + ombre 32 / 75 k | 262 / 1.59 M + ombre 34 / 114 k |
| 26 versanti | 132 / 0.86 M, senza ombre | 140 / 0.97 M + ombre 49 / 280 k | 149 / 1.14 M + ombre 58 / 286 k |

Istanze del sottobosco (ultimo numero di `treesByLod`) nella selva: 1081 a Bassa, 2249 a Media,
3750 ad Alta; al prato fino a ~9000 ad Alta.

Costo di CPU: le celle del sottobosco si generano al più 3 ms per fotogramma (cache per cella,
si rifanno solo se cambia la densità o i collisori), la coltre dei boschi al più 2 ms finché non è
finita (all'avvio), la redistribuzione degli alberi fra i livelli ogni 12 m di cammino. La
generazione degli alberi all'avvio (23 487) prende ~1.5 s in Node (prima ~0.7 s).

A Bassa le leve sono già tirate (`vegetazione` 0.45: distanze dei LOD ×0.75, sottobosco entro
~21 m al 62%); se una Iris Xe non tiene i 60 fps a Media, il primo passo è abbassare
`PRESET_QUALITA.media.vegetazione` (0.75 → 0.6) e poi `CAPIENZA` dei LOD 1-2.

## File condivisi toccati (modifiche piccole e additive)

- `src/game.ts`: `createRiale(u)` aggiunto alla scena accanto al lago; dopo la vegetazione
  `this.onQualita((p) => this.vegetation.impostaQualita(p.vegetazione))`.
- `src/main.ts`: dopo `installaCorbella`, `aggiungiAcquaLavatoio(game, corbella.punto('esamina:lavatoio')?.pos, corbella.chiodo(5))`.
- `src/render/post/qualita.ts`: campo `vegetazione` in `PresetQualita` (0.45 / 0.75 / 1).
- `src/render/shaders/terreno.ts` (traccia luce): foglie cadute dipinte più rade e a gruppi.
- `src/popolamento/terrazzi.ts`: solo la versione lontana dei muri (`muroLontanoErboso`).
- `scripts/shots-natura.mjs` (nuovo): le inquadrature della traccia.

## Coerenza con il gioco

- Altezze del suolo (`groundHeight`/`surfaceHeight`), posizioni degli oggetti interattivi e
  collisori del paese, dei muri e degli oggetti: invariati. I sentieri sono solo colore dei
  vertici del terreno.
- **Alberi della vegetazione: l'unico cambiamento di collisori, voluto.** Come prima ogni albero
  della vegetazione ha il suo cilindro di tronco (tag `castagno`, raggio e altezza del fusto della
  specie), perché un tronco che si vede deve fermare il giocatore. Ma i boschi fitti chiesti dal
  brief sono molti più alberi: **5149 → 23 487** cilindri in tutto il cilindro; vicino a Corbella
  (prima che il popolamento tolga quelli dove costruisce, `liberaCastagni`) 37 → 75 entro 200 m,
  248 → 632 entro 300 m. Nessun albero nasce sui sentieri (`sentieri.ts`, tracciati di Corbella
  compresi), nelle piazze, nel riale, in acqua o dentro un altro collisore; nel paese quasi
  nessuno (7 entro 100 m dal centro, prima 5), e i castagni da frutto delle terrazze stanno fuori
  dal corridoio della Terrazza Pedrazzini (z 945-1060, θ 23-39). Le altezze del suolo e gli oggetti
  interattivi non cambiano. Se l'integrazione preferisce i collisori di prima alla lettera, basta
  non aggiungere il cilindro in `Vegetation.aggiungiAlbero` per gli alberi `bosco` lontani dal
  paese (ma allora si passa attraverso i tronchi).
- Il sottobosco non ha collisori ed è basso (erba, felci, fiori, sassi ≤ ~1 m sui pendii rocciosi,
  cespugli bassi) e non nasce dentro i collisori né sui sentieri.
- Castagno morto e muri a secco: stessa impronta del collisore (prove degli oggetti verdi).
- Le acque nuove non hanno collisori (il riale e la vasca erano già solchi del terreno/oggetti).

## Verifiche

- `npm run typecheck`: pulito. `npm test`: 50 file, 678 prove verdi (comprese quelle degli oggetti:
  tetti di triangoli del castagno vivo e morto e dei muri, collisori, punti). `npm run build`: ok.
- `npm run e2e:fase1 -- --no-build --senza-foto` (prologo e missione 1 con i tasti veri, con i
  boschi e i collisori nuovi): **ok** in 77 s.
- `npm run shots -- --no-build`: verifiche del movimento invariate (camminata 8.21 m in 2 s, salto
  1.31 m, planata 5.5:1); nel gioco 23 275 alberi (prima 5140) e 26 237 collisori in tutto (prima
  8102: la differenza sono i tronchi); al più 279 draw call (inquadratura 02, l'asse verso il
  Sordo, prima 246) e 1.51 M triangoli (confronto 2).
- Le schermate rigenerate in `docs/shots/` non sono nel commit (`git checkout -- docs/shots/`).

## Che cosa resta

- **Ombre delle chiome**: le carte non proiettano ombra (nella passata delle ombre degenerano);
  l'ombra dell'albero è quella delle masse nascoste, più piccola e più piena della chioma vista
  (niente macchie di luce fra le foglie). Una passata d'ombra che legga la forma delle carte
  (alpha test) le darebbe i buchi.
- **Castagni del popolamento da vicino** (Terrazza Pedrazzini, paese): sono oggetti cotti nel
  materiale del mondo, con masse e ciuffi di triangoli; più pesanti e meno ricchi degli alberi
  della vegetazione a carte. Si potrebbero posare come istanze della vegetazione (stesse carte)
  tenendo il loro collisore.
- **Lavatoio**: la vasca è mezza sotto il suolo della piazza (popolamento): l'acqua c'è ma si vede
  solo da un lato.
- **Coltre dei boschi lontani**: a Bassa, dove compare più vicino, le cupole a celle si leggono
  ancora un poco come un selciato; un impostore vero (carte d'albero dipinte in un atlante) la
  renderebbe più simile ai bozzetti anche a 300-500 m.
- **Larici dall'alto**: i coni dorati, visti dall'alto, sembrano spine; servirebbe un cono più
  morbido con le carte d'aghi anche al LOD 2-3.
- **Prato del paese**: il prato dei ripiani popolati (non di questa traccia) è giallo saturo a
  mezzogiorno (bozzetto 2); va tarato con chi tiene `terrainColor`/`pratoDipinto`.
- **Sassi del sottobosco**: grigi chiari e lisci; con la luce di mezzogiorno qualcuno resta troppo
  chiaro. Un motivo di roccia più scuro sui fianchi aiuterebbe.
- **Muri a secco da vicinissimo**: la faccia a pietre poligonali con i contorni del post è molto
  fitta a 1-2 m; i sassi di testa sono più leggibili ma un po' chiari a mezzogiorno.
- **Prestazioni su hardware vero**: i numeri sono di SwiftShader; resta da misurare su una Iris Xe
  a Media (60 fps) e a Bassa (30 fps). Le leve sono già esposte (`vegetazione` nel preset).
- **Collisori degli alberi**: vedi «Coerenza con il gioco»: da confermare con l'integrazione.
