# Traccia «luce»: luce, atmosfera, matita, superfici

Ramo `grafica/luce`. È il cuore visivo su cui lavorano le altre tracce: il modello di luce del
materiale del mondo, la prospettiva aerea, il passaggio fra mondo rilevato e non rilevato, i
motivi delle superfici e la pittura del terreno.

Schermate in `docs/grafica/luce/` (JPEG, 1280×720, Chromium + SwiftShader, qualità ombre media):
- `foglio-confronto-*.jpg`: bozzetto | prima | dopo, per i quattro confronti del brief;
- `dopo-*.jpg`: le inquadrature di `npm run shots` (stessi nomi: `dopo-confronto-1-alba-castagno`,
  `dopo-01-paese-mezzogiorno`…) più quelle di lavoro: `dopo-superfici-campionario*` (scena di
  prova delle superfici), `dopo-ombre-piazza` (selciato AUTO e ombre), `dopo-chiome-controluce`,
  `dopo-tramonto-muro-a-secco`, `dopo-alba-controluce`, `dopo-notte-subito` (prima inquadratura
  del gioco già di notte: il mondo si vede);
- le schermate "prima" sono quelle di `docs/shots/` al commit 2770d89.

## In breve

| | Prima | Dopo |
|---|---|---|
| Non rilevato | carta bianca a matita oltre 150 m: l'altra metà del cilindro era un foglio | **abbozzo ad acquerello**: colori veri schiariti e desaturati (circa 60%), stese non uniformi, granulazione, carta risparmiata, matita sopra (tratteggio nelle ombre, curve di livello, contorni). Da lontano il colore torna e la carta si confonde con l'aria |
| Mai visto (bianco) | carta | abbozzo ancora più leggero e spento, ma **mai un foglio vuoto** |
| Rilevato | colore | **colore pieno** (un filo più saturo); durante la rivelazione inchiostro del fronte, bordo bagnato, acquerello che sborda |
| Raggio sempre dipinto | `nearPaint` [70, 150] | **[250, 450]**, con migrazione delle impostazioni salvate |
| Atmosfera | nebbia grigia uniforme, altra metà opaca | **prospettiva aerea dipinta**: densità che cala con la quota, velo leggero dei raggi che attraversano il cilindro (l'altra metà è un cielo azzurro con le terre a piani), azzurro allo zenit e chiaro all'orizzonte, lilla all'alba con il bagliore dorato basso verso la luce, blu-viola la notte, alone della Linea |
| Luce | dall'asse, sempre "mezzogiorno" | **nucleo della Linea che scorre lungo l'asse**: radente da sud al mattino, alta a mezzogiorno, bassa da nord la sera; dorata e contrastata nelle prime e ultime due ore; riempimento emisferico freddo e rimbalzo caldo; banda calda sul terminatore |
| Ombre | nessuna | **ombre morbide** vicino alla camera (mappa d'ombra di una sorgente che segue la camera, disco di Poisson), spegnibili |
| Notte | prato verde acido | blu-viola, colori che perdono saturazione, **pozze calde** dei lumi, aloni ambrati |
| Superfici | solo colore per vertice | canale **`aSuperficie`** con 13 motivi dipinti in spazio mondo e il tipo **AUTO** (dedotto dal colore): oggi case, muri, terrazzi e selciato di Corbella sono già pietra, piode, intonaco, legno, terra senza toccare le loro geometrie |
| Chiome | palloni lisci a faccette | masse di foglie in rilievo, normale "sferica" della chioma (volume morbido, bordo luminoso, controluce) |
| Terreno | verde unico, pennellata stirata | prati d'ottobre a chiazze (verde caldo, **erba secca dorata, felci ruggine**), tocchi di pennello irregolari ancorati al mondo, **foglie di castagno cadute**, foglie nel sottobosco, **roccia a strati** con licheni e muschio sui pendii |

## A. Abbozzo ad acquerello e colore pieno

`schizzo()` in `src/render/shaders/common.ts` sostituisce la resa a sola matita per il non
rilevato (terreno, oggetti, lago). Parte dal colore vero già illuminato, quindi le forme, le
ombre e l'ora si leggono anche nell'abbozzo:

- pigmento = colore desaturato al 60% (78-88% da lontano) e schiarito; steso sulla carta con
  `uAcquerello.x` (0.74);
- stese non uniformi ancorate al mondo e stabili con la distanza (`rumoreStabile2`): il pigmento
  si raccoglie sul bordo delle pozze, la carta resta scoperta qua e là, granulazione;
- da lontano (oltre ~300 m) la carta si vede sempre meno e prende il colore dell'aria: l'altra
  metà del cilindro si legge come un fondale velato, non come un foglio;
- sopra, la matita (`segniMatita`): tratteggio nelle ombre, curve di livello, contorni di taglio;
- **mai visto** (`blank`): stessa ricetta con il 72-94% della stesura e meno saturazione, e solo
  un accenno di matita. Il GDD voleva "carta avorio" oltre 200 m; il brief chiede che il mondo non
  sembri mai vuoto: la differenza con il non rilevato resta (più chiaro, più spento, quasi senza
  tratteggio) ma non c'è più il foglio bianco.

L'abbozzo sta un po' più dietro l'aria del dipinto (`hazeK` 1.12 contro 1.0). Il rilevato è il
colore pieno (`uLuce.w` = 1.06 di saturazione). L'inquadratura 6 del provino (`nearPaint` [6, 14]
e `revealCells`) mostra il passaggio: `dopo-06-matita-rivelazione.png`.

Prestazioni: dentro il raggio sempre dipinto, se nessuna rivelazione è in corso (`uCellAnim`),
lo shader salta la lettura delle celle; la frastagliatura del fronte si calcola solo mentre una
rivelazione può essere in corso.

## B. Atmosfera

`foschiaFrazione()` e `coloreFoschia()` in `common.ts` (usate da tutti i materiali tramite
`applyHaze`/`applyHazeK`: terreno, oggetti, lago, nubi del Collare, vetri):

- spessore d'aria: densità relativa `densitaAria(h)` che cala con la quota (scala `uAria.y`,
  frazione in quota `uAria.z`), integrata fra camera, punto di mezzo e punto (Simpson);
- **velo** dei raggi che passano vicino all'asse (quelli verso l'altra metà): `uHaze.w` = 0.12,
  più spesso all'alba e al tramonto, più sottile per chi vola alto vicino all'asse (bozzetto 3).
  Sull'altra metà la foschia copre circa il 60%: le terre restano leggibili a piani;
- colore: `uHazeColor` verso l'orizzonte, `uHazeZenith` guardando in su (azzurro pieno, anche
  sull'altra metà), `uHazeSun` verso la luce: il bagliore segue la direzione radente della luce,
  un po' più basso (si posa sulla valle come il sole basso dei bozzetti), più largo e più caldo
  all'alba e al tramonto (`uGolden`). All'alba la foschia è lilla-rosata, l'oro sta solo verso la luce;
- quinte teatrali a gradini morbidi (`uHaze.z`), **alone della Linea** nella foschia (distanza
  minima del raggio dall'asse) anche di notte, color brace.

## C. Luce

- **Nucleo della Linea** (`src/world/sky.ts`): `coreZ` corre da z = 120 alle 06:00 a z = 2880
  alle 19:30 (all'alba sta sulla punta della miccia, al tramonto segue la brace che si ritira).
  La luce principale arriva dal nucleo, più radente nelle prime e ultime ore (`coreFlat`
  0.5..1) e con la componente laterale dello schermo girevole (`coreSide`). A Corbella alle 7 la
  luce viene da sud a ~25 gradi, alle 11:30 a più di 55 gradi.
- **Luce dorata** (`golden`) nelle prime e ultime due ore: la luce principale è più forte e più
  calda (×1.5), il riempimento più basso (×0.78): contrasto fra luce dorata e ombra fredda.
- Taratura del modello: al sole pieno circa 1.15 volte l'albedo, in ombra circa 0.5 e più
  azzurro (riempimento emisferico freddo dal cielo, rimbalzo caldo dal suolo); banda calda sul
  terminatore; bande morbide (`Sup.bande`: terreno 0.32, oggetti 0.62, fogliame 0.5).
- **Ombre portate** (`src/render/ombre.ts`): vedi l'API sotto.
- **Controluce e luce trasmessa** per FOGLIAME (e in parte TESSUTO, ERBA): `Sup.trasm`; bordo
  luminoso `Sup.bordo` dal lato della luce, solo sui contorni della chioma.
- **Occlusione ambientale**: `aSuperficie.y` (cotta per vertice) e quella dei motivi (giunti,
  solchi, interstizi delle chiome) scuriscono solo il riempimento, non la luce diretta.
- **Notte**: brace dall'asse, colori che perdono saturazione e virano al blu-verde e al viola (il
  prato non è più verde acido), i lumi mostrano i colori veri: pozze dorate sul prato e sui muri,
  aloni dei lumi più larghi e caldi (`src/render/lamps.ts`).

## D. Superfici

Tutti gli oggetti del mondo usano `createWorldMaterial(u, { kind: 'object' })` con `aColor`. Il
nuovo attributo **`aSuperficie`** dice che cosa si sta dipingendo; il motivo è procedurale, in
coordinate "srotolate" del cilindro (arco, z, quota): niente UV, niente stiramenti, i corsi delle
pietre restano orizzontali e allineati da un muro all'altro. Il colore di base resta `aColor`: il
motivo lo varia attorno al suo valore. I motivi fini spariscono con la distanza in pixel (niente
moiré), a media distanza restano accennati a tocchi (le case si leggono di pietra anche a 100 m),
e le normali si perturbano dal campo d'altezza del motivo, così ogni pietra, lastra o asse prende
la luce.

Coordinate di superficie (`uvSuperficie`): sulle facce piane la terna esatta della faccia (i corsi
seguono anche i muri ruotati); sulle superfici lisce (normali interpolate: selciati ondulati,
sassi, tronchi) la proiezione dominante nella terna del cilindro, stabile.

**AUTO**: gli oggetti senza `aSuperficie` prendono il tipo dal colore per vertice, così tutto il
paese di oggi è già dipinto (vedi `dopo-ombre-piazza.png`: il selciato a meridiana di ciottoli,
le scale e i muri). La regola (`superficieAutomatica` in TS, `superficieAuto` in GLSL):

| Colore per vertice | Faccia | Tipo |
|---|---|---|
| finestra o lume (`aColor.a` > 0.02) | | VETRO |
| verde | in piano / altrove | ERBA / FOGLIAME |
| ardesia (scuro, poco saturo) | falda inclinata / in piedi o in piano | PIODE / PIETRA |
| calce (chiarissimo) | in piedi / in piano | INTONACO / PIETRA (selciato) |
| grigio (poco saturo) | | PIETRA |
| bruno (poco saturo, non chiaro) | in piano / in piedi | TERRA / LEGNO |
| forme tonde strette (tronchi, rami) | | CORTECCIA se scure, altrimenti nessuno |
| colori vivi (ottone, gerani, foglie d'autunno, palina) | | nessuno (restano come sono) |
| materiale a doppia faccia (tele, veli) | chiari | TESSUTO invece di INTONACO |

Superfici predefinite impostate da `installaLuce` (`src/render/luce.ts`) su materiali esistenti:
chiome dei castagni segnaposto FOGLIAME (con `impostaChioma`), tronchi CORTECCIA, costoloni delle
Finestre (mesh `costoloni`, materiale «iron» di `windows.ts`) METALLO.

Scena di prova: in sviluppo/E2E `await window.__LUCE__.provaSuperfici(1140, 30)` mette un
campionario sul prato sopra Corbella (rustico in pietra con tetto in piode e lobbia in legno,
torretta intonacata, castagno, tela su pali di ferro, aia in terra, ottone, masso, zolla, vetro,
e un blocco "NESSUNA" per confronto): `dopo-superfici-*.png`.

## E. Terreno (base)

`src/render/shaders/terreno.ts` (`terrenoDipinto`, `pratoDipinto`), sopra il colore per vertice di
`palette.ts` (prati d'ottobre: verde oliva caldo, meno acido):

- chiazze di decine di metri fra verde profondo nelle conche, verde-oliva al sole, **erba secca
  dorata** e **felci color ruggine** (più sui pendii);
- **tocchi di pennello**: celle irregolari (dominio deformato) con il bordo leggibile, ognuna col
  suo tono caldo o freddo, su tre scale (5 m, 1.3 m, 0.3 m vicino al giocatore), nella proiezione
  dominante del cilindro: nessuno stiramento sui pendii;
- **foglie di castagno cadute** sul prato, a gruppi (ottobre), foglie ocra e ruggine nel sottobosco;
- **roccia** grigio caldo sui pendii ripidi, a strati netti che seguono la quota (ogni strato una
  campitura, spigolo in luce sopra e ombra sotto), spaccature, licheni, **muschio** sulle cenge.

`pratoDipinto` dipinge anche la superficie ERBA degli oggetti (terrazzi, zolle): il prato degli
oggetti e quello del terreno si somigliano. La geometria del terreno e i dettagli (erba a ciuffi,
sassi, sentieri) restano alla traccia «natura» (round 2).

## API per le altre tracce

### Superfici: `src/render/superfici.ts`

```ts
import { SUPERFICIE, taggaSuperficie } from '../render/superfici';

taggaSuperficie(geo, SUPERFICIE.PIETRA);                                // tutti i vertici
taggaSuperficie(geo, SUPERFICIE.PIODE, { da: 120, a: 480 });           // un intervallo di vertici
taggaSuperficie(geo, SUPERFICIE.LEGNO, { variante: 0.6, occlusione: 0.2 });
taggaSuperficie(geo, SUPERFICIE.NESSUNA, { da: 0, a: 36 });            // "nessun motivo" dichiarato
```

| Valore | Nome | Motivo |
|---|---|---|
| 0 | `NESSUNA` | campitura con pennellata (comportamento di prima) |
| 1 | `PIETRA` | pietra a vista: pietre arrotondate a corsi, grigio caldo / ocra / bruno, giunti con muschio sulle facce in su, licheni gialli e grigio-verdi |
| 2 | `PIODE` | file di lastre spesse: bordo chiaro, ombra sotto la fila di sopra, fessure, muschio; da lontano file accennate |
| 3 | `LEGNO` | assi con fessure, venature, nodi, legno vecchio argentato (variante >= 0.5: assi orizzontali) |
| 4 | `INTONACO` | calce avorio: macchie, colature, sbiaditure, intonaco caduto con la pietra sotto |
| 5 | `CORTECCIA` | solchi lungo il tronco, licheni, muschio (motivo 3D: va bene su forme tonde) |
| 6 | `FOGLIAME` | masse di foglie in rilievo (luce sopra, cavità fredde), oro e ruggine a chiazze, tocchi di foglie, bordo luminoso, controluce (motivo 3D) |
| 7 | `TESSUTO` | trama fine (da vicino), pieghe, un po' di luce trasmessa |
| 8 | `TERRA` | terra battuta: ghiaino chiaro e scuro, chiazze umide |
| 9 | `METALLO` | ferro: riflesso freddo, ruggine a chiazze |
| 10 | `OTTONE` | riflesso caldo e netto, riflesso dell'ambiente, patina negli incavi |
| 11 | `ROCCIA` | roccia naturale: crepe, strati, licheni arancio, muschio sulle facce in su |
| 12 | `ERBA` | prato dipinto come il terreno (`pratoDipinto`): chiazze verdi, oro, ruggine, tocchi, foglie cadute |
| 13 | `VETRO` | scuro, riflette cielo e foschia di taglio (di notte si accende con `aColor.a`) |
| 14 | `AUTO` | il tipo dal colore per vertice (tabella sopra). **Predefinita degli oggetti** |

Attributo `aSuperficie` (float o vec2, per vertice):
- `x = tipo + variante` (variante in [0, 0.99]: seme del motivo; per LEGNO >= 0.5 = assi orizzontali);
  0 = non taggato (vale la superficie del materiale), `NESSUNA_DICHIARATA` = 0.5 = "nessun motivo";
- `y = occlusione` cotta (0 = nessuna, 1 = buio pieno): scurisce solo la luce ambiente.

Se manca vale (0, 0) (`defaultAttributeValues`). Funziona anche con `InstancedMesh` e con
**`SkinnedMesh`** (il vertex shader include le ossa di three.js). Altre funzioni:
`leggiSuperficie(x)` → `{ tipo, variante, dichiarata }` (come lo shader);
`superficieAutomatica(rgb, su, emissione, { curvo, doppia })` → il tipo che AUTO sceglierebbe.

Consigli: i motivi a coordinate di faccia (PIETRA, PIODE, LEGNO, INTONACO, TERRA, METALLO,
OTTONE, ROCCIA, TESSUTO) rendono meglio sulle facce piane (normali per faccia, come i box del
`Costruttore`); per forme tonde usare CORTECCIA e FOGLIAME (motivi 3D) o NESSUNA.

### Materiale del mondo: `createWorldMaterial(u, opzioni)` (`src/render/worldMaterial.ts`)

- opzione `superficie`: tipo predefinito dove il vertice non lo dichiara. **Novità: per
  `kind: 'object'` il predefinito è `SUPERFICIE.AUTO`** (prima: nessuno). Per il comportamento
  di prima: `createWorldMaterial(u, { kind: 'object', superficie: SUPERFICIE.NESSUNA })`;
- `impostaSuperficieBase(mat, tipo)`: cambia la superficie predefinita (uniform per-materiale
  `uSuperficieBase`);
- `impostaChioma(mat, forza, altezza = 5.5, schiaccia = 1.35)`: per le chiome **instanziate**
  piega la normale verso quella di una sfera attorno al centro della chioma (uniform
  per-materiale `uChioma`): la chioma si illumina come un unico volume morbido. Consigliato
  0.5-0.7; `altezza` = centro della chioma sopra l'origine dell'istanza, in unità locali. Oggi è
  acceso sui castagni segnaposto (`materials.crown`, 0.62);
- con `side: DoubleSide` il materiale ha il define `DOPPIA_FACCIA` (AUTO: i chiari sono tessuto).

### Uniform nuovi (condivisi, `src/render/uniforms.ts`)

| Uniform | Tipo | Significato | Predefinito |
|---|---|---|---|
| `uSole` | vec4 | x = z del nucleo, y = radenza, z = componente laterale (da `applySky`); w = forza della luce principale | (1500, 1, 0, 1) |
| `uHazeSun` | vec3 | foschia verso la luce (da `applySky`) | |
| `uHazeZenith` | vec3 | foschia guardando in su (da `applySky`); `uHazeColor` è quella all'orizzonte | |
| `uGolden` | float | 0..1 luce dorata, prime e ultime due ore (da `applySky`) | |
| `uAria` | vec4 | x = densità al suolo (1/m, da `uHaze.x` × densità dell'ora), y = scala d'altezza (150 m), z = frazione in quota (0.32), w = diffusione verso la luce (0.8) | |
| `uHaze` | vec4 | x = densità (1/900), y = massimo (0.9), z = quinte (0.5), **w = velo dell'altra metà (0.12)** (prima: bagliore della Linea) | |
| `uLuce` | vec4 | x = forza delle ombre, y = forza dell'occlusione, z = luce trasmessa, w = saturazione del dipinto | (1, 1, 1, 1.06) |
| `uAcquerello` | vec4 | x = colore nel non rilevato, y = forza della matita, z = carta risparmiata, w = granulazione | (0.74, 1, 1, 1) |
| `uOmbraMatrice`, `uOmbraMappa`, `uOmbra`, `uOmbraCentro` | | ombre (scritti da `Ombre`); `uOmbra.x = 0` le spegne nello shader. **`uOmbraMappa` non è mai null**: vale `mappaOmbraVuota()` (1×1, profondità con confronto) a ombre spente, di notte e prima del primo passaggio | |
| `uCellAnim` | float | istante dell'ultima rivelazione animata (da `CellTexture.ultimaRivelazione`, copiato da `installaLuce`); 1e9 = "sempre possibile" (sicuro, più lento) | 1e9 |
| `uDettaglio` | float | 1 = motivi pieni; < 0.5 = economici (niente tocchi fini né foglie cadute, motivi delle superfici solo da più vicino) | 1 |

`SkyState` ha i campi `coreZ`, `coreFlat`, `coreSide`, `hazeZenith`, `hazeSun`, `airDensity`.
Per una luce CPU coerente con lo shader (prima persona, abitanti, squadro) usare
`keyLightDir(x, y, z, sky)` di `src/world/sky.ts`: oggi `game.ts` illumina il Velo con
`tiltAlpha/tiltBeta` (vecchio modello); chi tocca la prima persona può passare a `keyLightDir`.

**Attenzione per chi scrive shader che includono `LIGHT_GLSL`** (il sampler `uOmbraMappa` è un
`sampler2DShadow`): non mettere mai `uOmbraMappa` a null, altrimenti three.js lega una texture
RGBA e WebGL2 rifiuta tutte le draw («Mismatch between texture format and sampler type»): il
mondo sparisce. Era il difetto segnalato dalla traccia «post» (mondo invisibile partendo di notte
o cambiando qualità di notte), corretto qui.

### Ombre: accendere, spegnere, qualità

`game.luce.ombre` (classe `Ombre`, `src/render/ombre.ts`):

```ts
game.luce.ombre.impostaQualita('spente' | 'bassa' | 'media' | 'alta'); // 'spente' libera la mappa
game.luce.ombre.attive = false;   // spegne senza cambiare la qualità
game.uniforms.uLuce.value.x = 0.6; // forza delle ombre nello shader
game.uniforms.uDettaglio.value = 0; // motivi economici (qualità bassa)
```

| Qualità | Mappa | Zona (mezzo lato) | Ridisegno |
|---|---|---|---|
| bassa | 1024² | 38 m | un fotogramma su tre |
| media (predefinita) | 2048² | 60 m | un fotogramma su due |
| alta | 3072² | 85 m | ogni fotogramma |

La mappa e la sua matrice si aggiornano insieme: ridisegnare a fotogrammi alterni non sposta le
ombre ferme; dopo un salto della camera (teletrasporto, taglio di regia) si ridisegna subito.
La sorgente virtuale sta a 160 m lungo la luce: chi è più a monte non proietta nella zona.

Il passaggio d'ombra è un `SistemaGioco` (metodo `render`, prima del disegno del mondo) e non è
contato in `renderer.info` del mondo: i suoi numeri sono in `ombre.stats` (`calls`, `triangles`,
`proiettori`). Proiettano ombra le Mesh opache (anche instanziate e con ossa) messe sul layer
`LAYER_OMBRE` (7) da una scansione ogni mezzo secondo; esclusioni: `userData.ombra = false` (o
`true` per forzare), materiali trasparenti, Linea, Collare, lago, vetri, e le **InstancedMesh con
nome che finisce in `lod1`…`lod9`** (stanno oltre la zona ma la loro sfera di contenimento copre
il mondo: non si scarterebbero mai). Il terreno non proietta (bordi a dente di sega dalle sue
maglie di 3 m; si può riaccendere con `PROFILI_OMBRE.*.terreno`). Di notte il passaggio non si
disegna.

### `nearPaint` e migrazione delle impostazioni

`DEFAULT_SETTINGS.nearPaint` = **[250, 450]** (prima [70, 150]). L'archivio passa a
`cielo-di-terra.settings.v2` con il campo `versione: 2`; `loadSettings()` legge la v2 oppure la
v1 (`cielo-di-terra.settings.v1`), butta il vecchio `nearPaint` [70, 150], tiene il resto e
riscrive in v2. `migraImpostazioni(dati, versione)` è esportata (test in `tests/luce.test.ts`).
`scripts/shots.mjs`: l'inquadratura 6 rimette il raggio di prima invece di [70, 150].

## File

Miei: `src/render/shaders/common.ts`, `src/render/worldMaterial.ts`, `src/render/uniforms.ts`,
`src/render/palette.ts`, `src/render/cellTexture.ts`, `src/render/lamps.ts`, `src/world/sky.ts`,
`src/core/settings.ts`; nuovi `src/render/superfici.ts`, `src/render/shaders/terreno.ts`,
`src/render/ombre.ts`, `src/render/luce.ts`, `src/render/provaSuperfici.ts`, `tests/luce.test.ts`.

Condivisi, modifiche piccole e localizzate:
- `src/game.ts`: import, campo `luce` e **una riga** in `init()` (`this.luce = installaLuce(this)`),
  commentata. Il percorso di rendering non cambia: le ombre si registrano fra i `sistemi`.
- `src/render/water.ts`: il lago non rilevato usa `schizzo()` invece di `pencilColor()` (3 righe).
- `scripts/shots.mjs`: l'inquadratura 6 rimette il `nearPaint` di prima (2 righe).

## Prestazioni

Misure con Chromium + SwiftShader (valgono solo come confronto relativo).

**Passaggio del mondo**: draw call e triangoli invariati (i motivi sono tutti nello shader, nessuna
geometria nuova): confronto 1 134 draw / 945k tri, confronto 2 158 / 884k, confronto 3 153 /
499k, confronto 5 111 / 890k, provino 2 227 / 817k, come prima.

**Passaggio d'ombra** (qualità media, non contato in `renderer.info`, vedi `ombre.stats`):

| Inquadratura | Draw | Triangoli |
|---|---|---|
| confronto 1 (alba, sopra il paese) | 59 | 310k |
| confronto 2 (terrazze) | 41 | 217k |
| confronto 3 (planata alta) | 24 | 23k |
| piazza (8:30) | 69 | 400k |
| alpeggi (provino 2) | 26 | 27k |
| notte | 0 | 0 |

A media si ridisegna un fotogramma su due (alta: sempre; bassa: uno su tre, 1024², 38 m). I
triangoli vengono quasi tutti dalle mesh unite del paese di Corbella (zone da 20-60k triangoli):
la traccia «paese» può abbassarli con mesh d'ombra semplificate (`userData.ombra = false` sulla
mesh piena e una versione povera solo sul layer `LAYER_OMBRE`). Costo misurato: +14% del
fotogramma in paese, nessuno negli alpeggi.

**Shader**: tempo per fotogramma rispetto al gioco prima del rifacimento, ombre spente, 640×360,
mediana di misure alternate A/B: confronto 2 ×1.68, confronto 5 ×1.95, provino 2 ×1.68. Il costo
in più è tutto nei frammenti (rumori e celle dei motivi, prato dipinto, acquerello, foschia). Su
una scheda vera il rapporto dovrebbe essere più basso (SwiftShader paga molto le funzioni
trascendenti e i rami), ma va misurato su Iris Xe. Leve già pronte per la qualità bassa:
`uDettaglio = 0` (niente tocchi fini né foglie cadute, motivi solo da vicino) e
`ombre.impostaQualita('spente')`. Già fatto per risparmiare: celle saltate nel raggio dipinto,
frastagliatura del fronte solo durante le rivelazioni, ottave fini solo da vicino, rumori di
deformazione dimezzati, istanze lontane fuori dal passaggio d'ombra.

## Che cosa resta

- **Prestazioni vere**: misurare su Iris Xe a 1080p (media) e, se serve, un ramo `uDettaglio`
  ancora più povero (acquerello senza granulazione, prato senza tocchi medi) per la qualità bassa.
- **Tag espliciti** (tracce «paese» e «natura»): AUTO è una deduzione dal colore; le geometrie
  nuove vanno taggate con `taggaSuperficie` e con l'occlusione cotta (`aSuperficie.y`) al piede dei
  muri, sotto le gronde, dentro le chiome. Il selciato a meridiana della piazza è colorato per
  triangolo: con la pietra sopra si vedono le tessere dei triangoli; in alcuni punti il terreno
  buca il selciato (geometria del popolamento).
- **Chiome vere** (traccia «natura»): il fogliame qui è un motivo su palloni; servono sagome a
  ciuffi, LOD e impostori. `impostaChioma` va acceso anche sulle chiome nuove instanziate.
- **Terreno**: sui pendii ripidi restano strisce che vengono dai triangoli lunghi e dai colori per
  vertice della mesh (non dallo shader): li sistema la traccia «natura».
- **Post-produzione** (traccia «post»): la taratura della luce (sole ~1.15, ombra ~0.5 dell'albedo)
  è pensata per l'uscita senza mappatura dei toni; con AgX/ACES e il bloom va rivista insieme
  (`uSole.w`, `uLuce`, `uAcquerello`, i colori di `sky.ts`).
- **Prima persona**: il Velo e lo squadro usano ancora `tiltAlpha/tiltBeta`; con `keyLightDir`
  avrebbero la stessa luce radente del mondo.
- **Bianco del GDD**: oggi il "mai visto" è un abbozzo leggero (il brief chiede che il mondo non
  sembri mai vuoto); se il design vuole di nuovo la carta, basta abbassare il fattore `blank` in
  `schizzo()` (`common.ts`).
