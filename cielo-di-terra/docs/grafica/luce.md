# Traccia «luce»: luce, atmosfera, matita, superfici

Ramo `grafica/luce`. È il cuore visivo su cui lavorano le altre tracce: il modello di luce del
materiale del mondo, la prospettiva aerea, il passaggio fra mondo rilevato e non rilevato, i
motivi delle superfici e la pittura del terreno. Schermate finali in `docs/grafica/luce/`
(prima e dopo, stesse inquadrature di `npm run shots`).

## In breve

| | Prima | Dopo |
|---|---|---|
| Non rilevato | carta bianca a matita oltre 150 m: l'altra metà del cilindro era un foglio | **abbozzo ad acquerello**: colori veri schiariti e desaturati (circa 60%), stese non uniformi con i bordi delle pozze, granulazione, carta risparmiata, matita sopra (tratteggio nelle ombre, curve di livello, contorni) |
| Rilevato | colore | **colore pieno** (un filo più saturo) con l'inchiostro del fronte durante la rivelazione |
| Raggio sempre dipinto | `nearPaint` [70, 150] | **[250, 450]**, con migrazione delle impostazioni salvate |
| Atmosfera | nebbia grigia uniforme, altra metà opaca | **prospettiva aerea dipinta**: densità che cala con la quota, «velo» dei raggi che attraversano il cilindro (l'altra metà è un cielo velato, le terre si leggono a piani), azzurro allo zenit e chiaro all'orizzonte, pesca e oro all'alba, blu-viola la notte, diffusione in avanti verso il nucleo della Linea, alone della Linea |
| Luce | dall'asse, sempre "mezzogiorno" | **nucleo della Linea che scorre lungo l'asse**: radente da sud al mattino, alta a mezzogiorno, bassa da nord la sera; calda dove è radente; riempimento emisferico freddo e rimbalzo caldo; banda calda sul terminatore |
| Ombre | nessuna | **ombre morbide** vicino alla camera (mappa d'ombra di una sorgente che segue la camera, disco di Poisson) |
| Notte | prato verde acido | blu-viola, colori che perdono saturazione, **pozze calde** dei lumi, aloni ambrati |
| Superfici | solo colore per vertice | canale **`aSuperficie`** con 13 motivi dipinti in spazio mondo (pietra, piode, legno, intonaco, corteccia, fogliame, tessuto, terra, metallo, ottone, roccia, erba, vetro) |
| Terreno | verde unico, pennellata stirata | prati caldi a chiazze, **erba secca dorata, felci ruggine**, tocchi di pennello ancorati al mondo, foglie nel sottobosco, **roccia a strati** con muschio sui pendii |

## A. Abbozzo ad acquerello e colore pieno

`schizzo()` in `src/render/shaders/common.ts` sostituisce la resa a sola matita per il non
rilevato (terreno, oggetti, lago). Parte dal colore vero già illuminato (`col`), quindi le forme,
le ombre e l'ora si leggono anche nell'abbozzo:

- pigmento = colore desaturato al 62% e schiarito; steso sulla carta con `uAcquerello.x` (0.74);
- stese non uniformi ancorate al mondo e stabili con la distanza (`rumoreStabile2`): il
  pigmento si raccoglie sul bordo delle pozze, la carta resta scoperta qua e là, granulazione;
- da lontano (oltre ~400 m) la carta si vede meno: resta una velatura di colore, così l'altra
  metà del cilindro non torna bianca;
- sopra, la matita di prima (`segniMatita`): tratteggio nelle ombre, curve di livello, contorni
  di taglio, più leggera;
- il foglio mai visto (`blank`) resta quasi carta, con il 16% della stesura.

Il rilevato è il colore pieno (`uLuce.w` = 1.06 di saturazione). Durante la rivelazione restano
la linea d'inchiostro del fronte, il bordo bagnato e l'acquerello che sborda. L'inquadratura 6
del provino (`nearPaint` [6, 14] e `revealCells`) mostra bene il passaggio.

Prestazioni: dentro il raggio sempre dipinto, se nessuna rivelazione è in corso
(`uCellAnim`, vedi sotto), lo shader salta del tutto la lettura delle celle; la frastagliatura del
fronte (4 rumori 3D) si calcola solo mentre una rivelazione può essere in corso.

## B. Atmosfera

`foschiaFrazione()` e `coloreFoschia()` in `common.ts` (usate da tutti i materiali tramite
`applyHaze`/`applyHazeK`, quindi anche dal lago, dalle nubi del Collare e dai vetri):

- spessore d'aria: densità relativa `densitaAria(h)` che cala con la quota (scala `uAria.y`,
  frazione in quota `uAria.z`), integrata fra camera, punto di mezzo e punto (Simpson);
- **velo**: i raggi che passano vicino all'asse (quelli che vanno all'altra metà) attraversano
  un'aria più spessa (`uHaze.w`): l'altra metà si legge come un cielo velato con le terre a
  piani. Chi vola alto vicino all'asse sta nell'aria limpida e il velo si assottiglia (bozzetto 3);
- colore: `uHazeColor` verso l'orizzonte (chiaro), `uHazeZenith` guardando in su (azzurro pieno),
  `uHazeSun` in controluce verso il nucleo (oro all'alba, più forte con `uGolden`);
- quinte teatrali a gradini morbidi (`uHaze.z`), alone della Linea (distanza minima del raggio
  dall'asse) anche di notte, color brace.

## C. Luce

- **Nucleo della Linea** (`src/world/sky.ts`): `coreZ` corre da z = 120 alle 06:00 a z = 2880
  alle 19:30 (all'alba sta sulla punta della miccia, al tramonto segue la brace che si ritira).
  La luce principale in un punto arriva dal nucleo, resa più radente nelle prime e ultime ore
  (`coreFlat` 0.5..1) e con la componente laterale dello schermo girevole (`coreSide`, da Mane
  al mattino, da Sera la sera). A Corbella alle 7 la luce viene da sud a ~25 gradi, alle 11:30 è
  a più di 55 gradi. `tiltAlpha`/`tiltBeta` restano come prima per chi li usa.
- Luce principale calda, più dorata quanto più è radente; **riempimento emisferico** freddo dal
  cielo e rimbalzo caldo dal suolo; banda calda sul terminatore; bande morbide (`Sup.bande`:
  terreno 0.32, oggetti 0.62).
- **Ombre portate** (`src/render/ombre.ts`): vedi l'API sotto.
- **Controluce e luce trasmessa** per FOGLIAME (e in parte TESSUTO, ERBA): `Sup.trasm` e bordo
  luminoso `Sup.bordo` dal lato del sole.
- **Occlusione ambientale**: `aSuperficie.y` (cotta per vertice) e quella dei motivi (giunti,
  solchi, interstizi delle chiome) scurisce solo il riempimento, non la luce diretta.
- **Notte**: brace dall'asse, colori che perdono saturazione e virano al blu-viola (i lumi invece
  mostrano i colori veri: pozze olivastre e dorate sul prato), aloni dei lumi più larghi e caldi
  (`src/render/lamps.ts`).

## D. Superfici

Tutti gli oggetti del mondo usano `createWorldMaterial(u, { kind: 'object' })` con `aColor`. Il
nuovo attributo **`aSuperficie`** dice che cosa si sta dipingendo; il motivo è procedurale, in
coordinate di faccia "srotolate" del cilindro (arco, z, quota): niente UV, niente stiramenti, i
corsi delle pietre restano orizzontali e allineati da un muro all'altro. Il colore di base resta
`aColor`: il motivo lo varia attorno al suo valore. I motivi fini spariscono con la distanza in
pixel (niente moiré) e le normali si perturbano dal campo d'altezza del motivo (derivate in
schermo), così ogni pietra, lastra o asse prende la luce.

Scena di prova: in sviluppo/E2E `await window.__LUCE__.provaSuperfici(1140, 30)` mette un
campionario sul prato sopra Corbella (rustico in pietra con tetto in piode e lobbia in legno,
torretta intonacata, castagno, tela su pali di ferro, aia in terra, ottone, masso, zolla, vetro,
e un blocco senza superficie per confronto). Schermate `superfici-*.png`.

I castagni segnaposto del motore (`materials.crown` / `materials.trunk`) usano già FOGLIAME e
CORTECCIA come superficie predefinita del materiale (in `installaLuce`).

## E. Terreno (base)

`src/render/shaders/terreno.ts` (`terrenoDipinto`), sopra il colore per vertice di
`palette.ts` (prati più caldi e meno acidi):

- chiazze di decine di metri fra verde profondo nelle conche, **erba secca dorata** e **felci
  color ruggine** (più sui pendii);
- **tocchi di pennello**: celle corte e sfumate, ognuna col suo tono caldo o freddo, su tre
  scale (5 m, 1.3 m, 0.3 m vicino), nella proiezione dominante del cilindro: nessuno stiramento
  sui pendii; fili d'erba vicino al giocatore;
- foglie cadute ocra e ruggine nel sottobosco;
- **roccia** grigio caldo sui pendii ripidi, a strati che seguono la quota, con spaccature e
  **muschio** sulle cenge (con normale perturbata).

La geometria del terreno e i dettagli (erba a ciuffi, sassi, sentieri) restano alla traccia
«natura» (round 2).

## API per le altre tracce

### Superfici: `src/render/superfici.ts`

```ts
import { SUPERFICIE, taggaSuperficie } from '../render/superfici';

taggaSuperficie(geo, SUPERFICIE.PIETRA);                                // tutti i vertici
taggaSuperficie(geo, SUPERFICIE.PIODE, { da: 120, a: 480 });           // un intervallo di vertici
taggaSuperficie(geo, SUPERFICIE.LEGNO, { variante: 0.6, occlusione: 0.2 });
```

| Valore | Nome | Motivo |
|---|---|---|
| 0 | `NESSUNA` | comportamento di prima (campitura con pennellata) |
| 1 | `PIETRA` | pietra a vista: blocchi irregolari a corsi, grigio caldo / ocra / bruno, giunti, licheni |
| 2 | `PIODE` | file di lastre spesse: bordo chiaro, ombra sotto la fila di sopra, fessure, muschio |
| 3 | `LEGNO` | assi con fessure, venature, nodi, legno vecchio argentato (variante >= 0.5: assi orizzontali) |
| 4 | `INTONACO` | macchie, colature, sbiaditure, intonaco caduto con la pietra sotto |
| 5 | `CORTECCIA` | solchi lungo il tronco, licheni, muschio |
| 6 | `FOGLIAME` | ciuffi a due toni, oro e ruggine a chiazze, interstizi scuri, bordo luminoso, controluce |
| 7 | `TESSUTO` | trama fine (da vicino), pieghe, un po' di luce trasmessa |
| 8 | `TERRA` | terra battuta: ghiaino chiaro e scuro, chiazze umide |
| 9 | `METALLO` | ferro: riflesso freddo, ruggine a chiazze |
| 10 | `OTTONE` | riflesso caldo e netto, riflesso dell'ambiente, patina negli incavi |
| 11 | `ROCCIA` | roccia naturale: crepe, strati, licheni arancio, muschio sulle facce in su |
| 12 | `ERBA` | zolle, tetti verdi: pennellate a ciuffi, punte secche dorate |
| 13 | `VETRO` | scuro, riflette cielo e foschia di taglio (di notte si accende con `aColor.a`) |

Attributo `aSuperficie` (float o vec2, per vertice):
- `x = tipo + variante` (variante in [0, 0.99]: seme del motivo; per LEGNO >= 0.5 = assi orizzontali);
- `y = occlusione` cotta (0 = nessuna, 1 = buio pieno): scurisce solo la luce ambiente.

Se manca vale (0, 0) (`defaultAttributeValues`), cioè il comportamento di prima. Funziona anche
con `InstancedMesh` (stesso valore per tutte le istanze) e con **`SkinnedMesh`** (il vertex shader
include le ossa di three.js: gli abitanti possono passare al materiale del mondo con `aColor`).
`leggiSuperficie(x)` decodifica il valore come lo shader.

### Materiale del mondo: `createWorldMaterial(u, opzioni)`

Opzione nuova `superficie` (tipo predefinito dove il vertice non lo dichiara) e funzione
`impostaSuperficieBase(mat, tipo)` (uniform per-materiale `uSuperficieBase`).

### Uniform nuovi (condivisi, `src/render/uniforms.ts`)

| Uniform | Tipo | Significato | Predefinito |
|---|---|---|---|
| `uSole` | vec4 | x = z del nucleo, y = radenza, z = componente laterale (da `applySky`); w = forza della luce principale | (1500, 1, 0, 1) |
| `uHazeSun` | vec3 | foschia in controluce verso il nucleo (da `applySky`) | |
| `uHazeZenith` | vec3 | foschia guardando in su (da `applySky`); `uHazeColor` è quella all'orizzonte | |
| `uGolden` | float | 0..1 alba/tramonto (da `applySky`) | |
| `uAria` | vec4 | x = densità al suolo (1/m, da `uHaze.x` × densità dell'ora), y = scala d'altezza (150 m), z = frazione in quota (0.32), w = diffusione in avanti (0.8) | |
| `uHaze` | vec4 | come prima, ma **w = velo dell'altra metà** (0.95) invece del bagliore della Linea | (1/900, 0.9, 0.5, 0.95) |
| `uLuce` | vec4 | x = forza delle ombre, y = forza dell'occlusione, z = luce trasmessa, w = saturazione del dipinto | (1, 1, 1, 1.06) |
| `uAcquerello` | vec4 | x = colore nel non rilevato, y = forza della matita, z = carta risparmiata, w = granulazione | (0.74, 1, 1, 1) |
| `uOmbraMatrice`, `uOmbraMappa`, `uOmbra`, `uOmbraCentro` | | ombre (scritti da `Ombre`); `uOmbra.x = 0` le spegne nello shader | |
| `uCellAnim` | float | istante dell'ultima rivelazione animata (da `CellTexture.ultimaRivelazione`, copiato da `installaLuce`); 1e9 = "sempre possibile" (sicuro, più lento) | 1e9 |
| `uDettaglio` | float | 1 = motivi pieni; < 0.5 = economici (niente tocchi fini e fili d'erba, motivi delle superfici solo da vicino) | 1 |

`SkyState` ha i campi nuovi `coreZ`, `coreFlat`, `coreSide`, `hazeZenith`, `hazeSun`,
`airDensity`. Per una luce CPU coerente con lo shader (prima persona, luci toon degli abitanti,
squadro) usare `keyLightDir(x, y, z, sky)` di `src/world/sky.ts`: oggi `game.ts` illumina il Velo
con `tiltAlpha/tiltBeta` (vecchio modello); la traccia «post» o chi tocca la prima persona può
passare a `keyLightDir` alla posizione della camera.

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
| bassa | 1024² | 38 m | un fotogramma su due |
| media (predefinita) | 2048² | 60 m | ogni fotogramma |
| alta | 3072² | 85 m | ogni fotogramma |

Il passaggio d'ombra è un `SistemaGioco` (metodo `render`, prima del disegno del mondo) e non è
contato in `renderer.info` del mondo: i suoi numeri sono in `ombre.stats` (`calls`,
`triangles`, `proiettori`). Proiettano ombra le Mesh opache (anche instanziate e con ossa) messe
sul layer `LAYER_OMBRE` (7) da una scansione ogni mezzo secondo; esclusioni: `userData.ombra =
false` (o `true` per forzare), materiali trasparenti, Linea, Collare, lago, vetri, castagni
`lod2+`. Il terreno non proietta (bordi a dente di sega dalle sue maglie di 3 m; si può
riaccendere con `PROFILI_OMBRE.*.terreno`). Di notte il passaggio non si disegna.

### `nearPaint` e migrazione delle impostazioni

`DEFAULT_SETTINGS.nearPaint` = **[250, 450]**. L'archivio passa a `cielo-di-terra.settings.v2`
con il campo `versione: 2`; `loadSettings()` legge la v2 oppure la v1
(`cielo-di-terra.settings.v1`), butta il vecchio `nearPaint` [70, 150], tiene il resto e
riscrive in v2. `migraImpostazioni(dati, versione)` è esportata (test in `tests/luce.test.ts`).
`scripts/shots.mjs`: l'inquadratura 6 ora rimette il raggio di prima invece di [70, 150].

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

PRESTAZIONI_QUI

## Che cosa resta

RESTA_QUI
