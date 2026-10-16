# Unione 3 del rifacimento grafico: rifinitura 1, «mondo» + «oggetti»

Ramo `claude/jolly-archimedes-cm54mt`, checkout principale. Prima dell'unione la copia di lavoro era
pulita (niente istantanea da salvare). Le due tracce erano partite tutte e due da `fea8391` (unione 2),
che era ancora la punta del ramo principale. Rami uniti, uno alla volta con `git merge --no-ff`:

| Ramo | Ultimo commit | Commit di unione | Resoconto |
|---|---|---|---|
| `grafica/rifinitura-1-mondo` | `d4ff554` | `70f86a9` | [rifinitura-1-mondo.md](rifinitura-1-mondo.md) |
| `grafica/rifinitura-1-oggetti` | `e918937` | `cee8811` | [rifinitura-1-oggetti.md](rifinitura-1-oggetti.md) |

## Che cosa è entrato

**Area «mondo»** (motore del disegno, cielo, terreno, vegetazione):
- **Finestre velate** di giorno dall'aria del cilindro (saturazione della striscia da 0,72 a 0,30),
  costoloni nella stessa aria e retinati via da lontano;
- **boschi lontani** a masse continue per gruppi di specie, senza più il «pluriball»;
- **sera**: ore dorate dalle 16, luce radente, viraggio dorato della post e **fase rosa**
  (19:40-20:40, e prima dell'alba);
- **altra metà** del cilindro leggibile sotto un velo azzurro, Linea in planata a filo sottile, nubi
  del Collare piene;
- **contorni** solo vicino (30-250 m) e leggeri, inchiostro pieno solo sul fronte della rivelazione;
- **prato** oliva d'ottobre, conche scure e cigli chiari dalla curvatura del terreno;
- **notte**: suolo più scuro del cielo, **pozze calde dei 24 lumi più vicini** (`uPozze`), rilievo
  leggibile anche di notte (inquadratura 7 nuova di `npm run shots`);
- **muri** a pietre smussate a corsi con la superficie `SASSO`; castagni a foglie lanceolate, larici
  a palchi; ombre degli alberi anche oltre il LOD 0; ridistribuzione della vegetazione a metà costo;
  qualità Automatica con il tempo GPU delle ombre e una nuova misura all'ingresso in gioco.

**Area «oggetti»** (prima persona, paese, Cripta):
- **prima persona di scorcio**: avambraccio e braccio fino alla spalla, guanti di cuoio scuro opaco,
  manica di lana a maglia oliva-cachi, ottone a strisce; lo strumento a sinistra col centro libero;
- **paese da lontano**: dettaglio pieno fino a 400 m (260 a Bassa), casa lontana nuova con piode,
  finestrelle e camino, tetti caldi con file contrastate e una tinta per casa;
- **notte**: più finestre accese e **dieci lanterne a braccio** alle porte della piazza;
- tasso scuro con ciuffi d'aghi, selciato grigio-beige con le linee color bronzo;
- **Cripta rifatta** (conci, volta a botte, capsule di rame-ottone, tubi, lumi caldi cotti);
- **Velo** con la traversa bassa e i montanti divergenti; **lavatoio** rialzato di 0,8 m su un
  basamento con quattro gradini (vasca fuori terra, chiodo 5 al suo posto, Togna davanti alla vasca);
- lo squadro si anima col tempo vero del fotogramma.

## Conflitti e punti d'incontro

**Nessun conflitto testuale.** Le due tracce non hanno nessun file in comune (98 file toccati da
«mondo», 50 da «oggetti», intersezione vuota): le due unioni sono andate da sole.

**Punti d'incontro controllati a mano** (file di un'area usati dall'altra):
- **Lumi e pozze.** «Oggetti» lamentava che il motore illuminasse solo con gli 8 lumi più vicini
  (`uLamps`) e che, con più finestre e le lanterne, la facciata lontana del confronto 5 perdesse il
  lavaggio caldo. «Mondo» ha aggiunto proprio le pozze dei **24** lumi più vicini entro 120 m
  (`LampGlows.updateNearest` → `uPozze`). Le lanterne di «oggetti» entrano fra i lumi del motore dal
  cantiere come le finestre (lumi del paese da 452 a 580), quindi fanno pozza da sole: nel confronto 5
  e nella piazza di notte le facciate e il selciato attorno alle porte sono di nuovo caldi, più di
  quanto mostrassero le due tracce da sole. Il problema aperto di «oggetti» è chiuso dall'unione.
- **Terra battuta della corona** (`coronaSulSuolo`, segnalata da «mondo» come problema dell'altra
  area): «oggetti» l'aveva già corretta (una variante sola, colore a chiazze larghe, niente toppe di
  ciottoli isolate). Verificato al lavatoio: niente più triangoli di tono diverso.
- **«Fuori area» visti da «oggetti»** (contorni neri, terreno a faccette sotto il lavatoio, Finestre
  di giorno, versanti a pluriball): li ha corretti «mondo»; nelle schermate unite non ci sono più.
- **Superfici condivise** (`render/superfici.ts`): «mondo» cambia ERBA, FOGLIAME e TERRA anche degli
  oggetti; le case, il tasso, la piazza e il lavatoio di «oggetti» le prendono senza artefatti.
- **`render/primoPiano.ts`**: «oggetti» ha cambiato solo i rami del cuoio, della lana e dei metalli;
  «mondo» non lo tocca. `lampLight` (usato dai personaggi) cambia in `common.ts` ma il primo piano ha
  il suo materiale.
- **Cripta**: i suoi lumi sono lumi del motore (`regia.ts` li aggiunge a `LampGlows`), quindi di
  notte fanno anche la pozza di «mondo» sopra la luce cotta di «oggetti». Resa confrontata con la
  build di `grafica/rifinitura-1-oggetti` da sola nella stessa inquadratura (dopo la sveglia, Media e
  Alta): praticamente identica.

**Correzione fatta all'unione** (piccola, solo visiva; il gioco non cambia):

1. **Finestra vista da vicino senza stelle e col ferro azzurro** (inquadratura 4, «A piedi su un
   costolone della Finestra dei Ponti: le stelle girano sotto il vetro»). Il velo d'aria che «mondo»
   ha messo sul vetro di giorno valeva a ogni distanza (almeno il 55%) e spegneva del tutto le stelle
   di giorno; anche i costoloni si velavano almeno al 70%. Da lontano è giusto (la striscia nel cielo
   dei bozzetti 1 e 3), ma in piedi sul costolone fra l'occhio e il vetro ci sono due metri d'aria: la
   schermata 4 era un lattiginoso azzurro, senza stelle, col costolone di ferro arrugginito diventato
   azzurro pallido. Il commento in testa a `windows.ts` diceva già «da vicino si vedono le stelle».
   Ora il velo, la desaturazione, il vetro neutro e lo spegnimento delle stelle di giorno crescono con
   la distanza: niente sotto 60 m, pieni da 240 m (`giornoAria` in `render/windows.ts`); il velo dei
   costoloni va da 0 a 40 m a pieno da 200 m (`render/worldMaterial.ts`, ramo `uAriaVetro`). Oltre
   250 m il risultato è identico a quello di «mondo»: confronti 1 e 3 e inquadratura 1 invariati
   (controllati prima e dopo).

File toccati all'unione: `src/render/windows.ts`, `src/render/worldMaterial.ts`, questo resoconto,
le schermate rigenerate in `docs/shots/` e `docs/shots/fase1/`.

## Esito dei test

- `npm run typecheck`: verde.
- `npm test`: verde, **62 file, 832 prove** (+1 file saltato di proposito: `misure.test.ts` gira solo
  con `MISURE=1`). Sono i numeri di «mondo» (che aggiunge `cielo-sera.test.ts`,
  `popolamento/castagni-liberi.test.ts` e prove in `qualita.test.ts` e `input.test.ts`); «oggetti»
  non aggiunge prove. Nessuna prova toccata all'unione.
- `npm run build`: verde (solo l'avviso solito sulla dimensione del pacchetto).
- **`npm run e2e:fase1`: verde, «prova ok»**, prologo e missione 1 completi con i tasti veri,
  nessun errore del browser, gli stessi passi dell'unione 2 (cambiano solo le note «animazioni ancora
  in corso» delle foto). Girato due volte: subito dopo le due unioni (250 s) e dopo la correzione
  della Finestra (258 s, quella delle foto in `docs/shots/fase1/`). Alla qualità che l'e2e usa di
  serie (Automatica, che in modalità E2E vale Media, post-produzione e ombre comprese): **non è
  servito abbassarla a Bassa**. La prova dura il 12-16% in più dell'unione 2 (221-224 s): è il costo
  delle notti in SwiftShader che «mondo» misura (+5-15%) più i triangoli del paese a 400 m.
- `npm run shots` completo (inquadrature 1-7 e 11-14, poi le verifiche di gioco a Bassa): finito senza
  errori né messaggi d'errore del browser. Verifiche di fisica invariate: camminata 8,21 m in 2 s,
  salto 1,31 m, planata 10 s con 21,4 m di perdita e rapporto 5,5:1.

## Schermate (docs/shots/, qualità Alta, 1280×720, SwiftShader)

Guardate tutte, accanto ai bozzetti `finale-1`, `-2`, `-3`, `-5`, alle schermate dell'unione 2 e ai
fogli prima/dopo delle due tracce. **Nessuno schermo nero, nessun colore sballato, nessun oggetto
sparito** (dopo la correzione della Finestra).

| Inquadratura | Che cosa si vede | Contro il bozzetto / l'unione 2 |
|---|---|---|
| 01 paese a mezzogiorno | Finestra velata nel cielo, versante a masse continue d'oliva e oro, tasso scuro, selciato beige con le linee bronzo, tetti caldi | niente più striscia d'oltremare né «pluriball» |
| 02 lungo l'asse | valle con boschi d'ottobre, riale turchese, larici a palchi | come l'unione 2, larici meno a candelotto |
| 03 planata alta | Velo nuovo (montanti divergenti, orlo cucito), Finestre velate | le maniche escono dal campo (vedi problemi aperti) |
| 04 Finestra e stelle | stelle sotto il vetro, costolone di ferro arrugginito, la Finestra lontana velata | corretta all'unione (sopra) |
| 05 notte in paese | suolo scuro, versante non rilevato in carta notturna chiara, chiesa e casa con le finestre accese | come «mondo» `s05` più le finestre di «oggetti» |
| 06 matita e rivelazione | bosco rilevato a colori pieni, non rilevato acquerello pallido | invariata |
| 07 notte e rilievo (nuova) | Corbella rilevata di notte vista dall'alto: gesso chiaro e lumi del paese | il rilievo si legge di notte |
| confronto 1, alba | castagno morto controluce, luce dorata radente, paese di pietra calda | bozzetto 1: stessa luce; la Finestra ora è cielo velato |
| confronto 2, terrazze | prato oliva con paglia, muro a sassi smussati, felce rossa, campanile | bozzetto 2: saturazione giusta, tinta ancora più verde |
| confronto 3, planata | Velo dei bozzetti (traversa bassa, montanti agli angoli, nappina), terre lontane leggibili sotto il velo azzurro | bozzetto 3 |
| confronto 5, notte | facciate e strada lavate dalle pozze calde di lanterne e finestre | bozzetto 5: atmosfera giusta, più lumi |

Le foto della prova e2e (`docs/shots/fase1/`) sono rigenerate dall'ultima prova: Cripta coi conci e
le capsule di rame (02), Velo nuovo in planata (08), Togna al lavatoio rialzato con la vasca piena
(09), squadro col braccio di scorcio (17, 18), alba rosa (05).

## Prestazioni (da docs/shots/shots.json)

Passaggio del mondo (`renderer.info`, post compresa), qualità Alta. «Unione 2» = le stesse
inquadrature in `unione-2.md`.

| Inquadratura | Draw call | Triangoli | Unione 2 (draw / tri) |
|---|---|---|---|
| 01 paese mezzogiorno | 206 | 1 285 k | 202 / 1 239 k |
| 02 asse verso il Sordo | **290** | 1 533 k | 290 / 1 469 k |
| 03 planata alta | 108 | 572 k | 109 / 571 k |
| 04 finestra e stelle | 92 | 598 k | 93 / 599 k |
| 05 notte in paese | 207 | 1 579 k | 200 / 1 498 k |
| 06 matita e rivelazione | 115 | 1 435 k | 116 / 1 386 k |
| 07 notte e rilievo (nuova) | 172 | 1 295 k | — |
| confronto 1, alba | 216 | 1 728 k | 206 / 1 600 k |
| confronto 2, terrazze | 248 | **1 921 k** | 229 / 1 606 k |
| confronto 3, planata | 170 | 657 k | 171 / 656 k |
| confronto 5, notte | 175 | 1 507 k | 170 / 1 436 k |

Passata delle ombre (`__LUCE__.ombre.stats`, con `scripts/shots-natura.mjs`) e scena per qualità:

| Inquadratura | Bassa (scena) | Media (scena + ombre) | Alta (scena + ombre) |
|---|---|---|---|
| confronto 1 | 187 / 1,38 M | 206 / 1,61 M + 53 / 524 k | 216 / 1,73 M + 75 / 609 k |
| confronto 2 | 218 / 1,47 M | 243 / 1,71 M + 26 / 227 k | 248 / 1,92 M + 35 / 314 k |
| 21 selva al mattino | 255 / 1,33 M | 288 / 1,94 M + 12 / 24 k | 293 / 2,13 M + 15 / 89 k |

**Caso peggiore ad Alta**: confronto 1 con 291 draw call e **2,34 M triangoli** per fotogramma (scena
più ombre; all'unione 2 erano 276 e 2,10 M); in draw call la selva (308) e l'inquadratura 02 (290 di
scena). Sotto il tetto del brief (~400 e 2,5 M), ma i triangoli sono ora al 94% del tetto. Da dove
viene l'aumento: il dettaglio pieno del paese fino a 400 m («oggetti»: +0,1-0,3 M dove si vede il
paese dalle terrazze, vedi `rifinitura-1-oggetti.md`, caso a19 2,04 M di scena) e le ombre degli
alberi oltre il LOD 0 con le carte del LOD 0 raddoppiate («mondo»). A Media il caso peggiore è il
confronto 1 con 259 draw call e 2,13 M; a Bassa (ombre spente) 255 e 1,47 M.

Altri numeri di `shots.json`: gioco pronto in 8,7 s (7,7 all'unione 2); simulazione 0,025 ms per
passo; 23 275 alberi; **26 373 collisori** (+3: basamento e gradini del lavatoio rialzato); **580
lumi** (452: finestre accese in più e lanterne di «oggetti»). `renderCpuMs` (3,1 s a Bassa) resta non
confrontabile, come spiegato in `unione-1.md`.

## Problemi aperti

- **Triangoli ad Alta al 94% del tetto** (2,34 M nel confronto 1 con le ombre). Leve pronte, nessuna
  applicata qui: `distanzaLodPerQualita` (per esempio Alta e Media a 320 m), `media.vegetazione` 0,6
  e le carte solo ai LOD 0-1 a Media («mondo»), il raggio delle ombre degli alberi
  (`Vegetation.impostaRaggioOmbre`).
- **Prestazioni vere da misurare** su una Iris Xe a Media (60 fps a 1080p) e a Bassa (30 fps); di
  notte il fotogramma costa il 5-15% in più in SwiftShader (pozze, raggio dipinto, bagliori lontani;
  leve in `rifinitura-1-mondo.md`).
- **Velo**: con la traversa bassa le maniche escono dal campo, nel bozzetto 3 si vedono negli angoli
  (`VELO.yT` a circa −0,21 le riporterebbe).
- **Squadro piantato**: l'avambraccio sinistro entra orizzontale e lungo dal bordo sinistro fino al
  centro (foto e2e 17): è la posa scelta da «oggetti» sul bozzetto 2, ma da certe pendenze si legge
  ancora come un tubo; da rivedere col direttore artistico.
- **Tetti visti dal Velo (60-150 m)**: colori caldi, ma le file di piode spariscono nel filtro
  pittorico (servirebbe un motivo `PIODE` in `superfici.ts` che si allarghi con la distanza).
- **Ciglio dei gradoni del terreno** senza la fascia scura (problema 6 di «mondo»); **ombre dei
  cespugli** senza vento (`userData.materialeOmbra`); **qualità Automatica** ancora quantizzata dal
  vsync.
- **Collisori dei castagni** (23 275 tronchi): la prova passa, la scelta resta da approvare.
- **Finestre**: la striscia lontana è a −17% di luminanza del cielo attorno (obiettivo ±15%).
- **Prato** più verde del bozzetto 2 (tinta 59° contro 44°); più paglia è una scelta da fare sul
  gioco intero.
- **Cripta di giorno**: le pozze cotte hanno l'emissione solo di notte (`uNight`); il prologo la
  mostra all'alba, quando è notte, quindi oggi non si vede.
- **Lavatoio** rialzato invece che girato: va rivisto se cambiano il caposaldo 5 o la vista 5-1.
