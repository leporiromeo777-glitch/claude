# Unione 4 del rifacimento grafico: rifinitura 2, «mondo» + «oggetti»

Ramo `claude/jolly-archimedes-cm54mt`, checkout principale. Prima dell'unione la copia di lavoro era
pulita (niente istantanea da salvare). Le due tracce erano partite tutte e due da `5f64bba` (unione 3),
che era ancora la punta del ramo principale. Rami uniti uno alla volta con `git merge --no-ff`:

| Ramo | Ultimo commit | Commit di unione | Resoconto |
|---|---|---|---|
| `grafica/rifinitura-2-mondo` | `0ec3107` | `8e95e97` | [rifinitura-2-mondo.md](rifinitura-2-mondo.md) |
| `grafica/rifinitura-2-oggetti` | `88088e3` | `07e10a1` | [rifinitura-2-oggetti.md](rifinitura-2-oggetti.md) |

## Che cosa è entrato

**Area «mondo»** (motore del disegno, cielo, terreno, vegetazione, qualità):
- **terzo alto pieno**: foschia più leggera (0,9/900, tetto 0,75), quinta lontana azzurro-lilla,
  azzurro dello zenit verso l'altra metà, `nearPaint` [400, 700] con la **migrazione delle
  impostazioni v2 → v3** (chiave `cielo-di-terra.settings.v3`);
- **niente nero puro sotto il tasso**: piede dell'ACES e contrasto a S non scendono più sotto lo zero;
  luce avvolgente del fogliame (campo GLSL `Sup.avvolge`);
- **niente moiré** delle curve di livello e delle stesure d'acquerello di scorcio;
- **notte coi monti scuri** (versante 0,78 volte il cielo, prima 1,74) e senza retino a puntini;
- **alba e tramonto** con la palette dorata del giudizio, meno arancione;
- superfici senza «vetro rotto» (pietre a una tinta, **selciato a ciottoli**, prato a pennellate),
  ombre oliva con la luce rimbalzata, **ombra a terra degli alberi lontani** (`uAlberiOmbra`),
  fusti lontani visibili, **castagni** con il guscio di foglie oliva e oro, larici in controluce;
- **Finestre** senza la fessura bianca (`MARGINE_VETRO` 30 m) e col bordo sfumato; `discard` solo
  nelle varianti `ARIA_VETRO` e `VETRO_TERRENO`;
- teste dei muri a cupola di calcare, nubi del Collare senza buchi, fondo scuro sotto i suggerimenti;
- **qualità automatica** che si riarma all'aperto e di giorno, sorveglianza lenta per 10 minuti,
  gradino «Media ridotta», `maxPixelRatioCanvas` per preset; Media con vegetazione 0,6;
- **collisori dei tronchi** solo dove si cammina (`COLLISORI_SOLO_DOVE_SI_CAMMINA`), stessi alberi;
- frecce: ↑ ↓ non spingono più né salgono la scala della Cripta; `preventDefault` solo quando il
  gioco ha la tastiera.

**Area «oggetti»** (paese, prima persona, Cripta):
- **paese a grumo**: 90 case (32 nuove nel nucleo, le 58 di prima ferme), **38 annessi** addossati
  (stalle, legnaie, fienili), altezze ×0,85-1,5, **23 orti e 23 alberi da frutto**, aie di terra
  battuta; la casa lontana ha cornici di calce, persiane e gronda chiara;
- **prima persona**: avambracci di scorcio nel piantato (la destra impugna l'asta), maniche dagli
  angoli nel Velo, polsino, maglia ±12% con la piega, cuciture e nocche dei guanti, manica oliva di
  notte;
- **Cripta di rame**: materiale proprio (luce calda, emissione cotta sempre accesa), capsule di rame
  con le fasce d'ottone, pavimento a lastre, pozze dei lumi, coperchio di vetro col bordo di luce,
  tubo lungo la volta; `NoColorSpace` sul vetro;
- **LOD del paese a Media 310 m**;
- **lavatoio** di nuovo a terra (`DISLIVELLO_LAVATOIO = 0`, Togna al posto di prima) con la prova
  nuova `tests/popolamento/lavatoio-a-piedi.test.ts`;
- lo squadro non alloca più a ogni fotogramma.

## Conflitti e punti d'incontro

**Nessun conflitto testuale.** Le due tracce non hanno file in comune (100 file toccati da «mondo»,
47 da «oggetti», intersezione vuota): le due unioni sono andate da sole, e nessun PNG di
`docs/shots/` era nei due rami.

**Punti d'incontro controllati a mano** (file o dati di un'area usati dall'altra):
- **Shader del mondo e materiale della Cripta.** «Oggetti» costruisce `materialeCripta` copiando
  uniform, `defines` e shader del materiale del mondo e sostituendo la riga dell'emissione
  (`RIGA_EMISSIONE`). «Mondo» ha cambiato quello shader (campo `Sup.avvolge`, `uAlberiOmbra`,
  `uAriaVetro` diventato il define `ARIA_VETRO`): la riga dell'emissione è rimasta identica
  (`worldMaterial.ts`), gli uniform nuovi passano con la copia, e i `defines` del materiale degli
  oggetti non hanno `ARIA_VETRO` né `VETRO_TERRENO`. Nessun errore di compilazione nel browser
  (e2e e schermate); la Cripta della foto e2e 02 è quella del ramo «oggetti».
- **Fogliame degli oggetti nuovi.** Gli alberi da frutto e gli orti di «oggetti» dichiarano
  `SUP.FOGLIAME`, quindi prendono da soli la luce avvolgente di «mondo» (`avvolge` = 1): sotto le
  chiome niente nero. Gli alberi da frutto non usano `castagno.ts` (che «mondo» ha cambiato) ma
  `geoCiuffo`/`geoMassa`: nessuna dipendenza rotta.
- **Collisori.** «Mondo» toglie il collisore ai tronchi lontani dai sentieri (23 275 → 5135 tronchi
  con collisore); «oggetti» aggiunge case, annessi e tronchi degli alberi da frutto (+226). Totale
  nella build unita: **8457 collisori** (solo «mondo» 8232, solo «oggetti» 26 598). Le prove
  `castagni-liberi` (fra 3000 e 8000 tronchi) e `lavatoio-a-piedi` (dal chiodo 5 al lavatoio e a
  Togna col `PlayerController` vero) passano insieme.
- **Alberi.** Lo stesso numero nelle due build da sole e nell'unione: 23 275 (la semina non cambia,
  e le case nuove stanno dove gli alberi erano già tolti dal popolamento).
- **Lumi e pozze.** Le finestre delle case nuove e degli annessi entrano fra i lumi del motore
  (580 → 835, come in «oggetti») e quindi fanno pozza (`uPozze`, «mondo») da sole: nel confronto 5 e
  nella piazza di notte le facciate nuove sono lavate di caldo, sotto un versante ora più scuro del
  cielo.
- **Primo piano.** «Oggetti» ha cambiato solo i rami del cuoio e della lana di `primoPiano.ts` (tinte
  notturne con `uNight`); «mondo» non tocca quel file. Di notte (foto e2e 21) la manica resta oliva
  sotto la notte blu di «mondo».
- **Notte e alba.** Le correzioni di «mondo» alle ore dorate (meno arancione) e alla notte valgono
  anche per il paese nuovo: la foto e2e 12 (il fienile alla sera) e il confronto 1 non hanno più
  l'arancione pieno dell'unione 3.

## Correzione fatta all'unione

**Distanza del dettaglio del paese ad Alta da 400 a 350 m** (`distanzaLodPerQualita` in
`src/popolamento/cantiere.ts`, più tre commenti in `corbella.ts`, `forme.ts` e `cantiere.ts`).
«Oggetti» aveva tenuto Alta a 400 m **a condizione** che il caso peggiore restasse sotto i 2,5 M
triangoli (il paese da 190 m nel bosco, 860/16: 2,43 M nel suo ramo). Nell'unione i fusti più grossi,
il guscio di foglie dei castagni e le teste dei muri di «mondo» lo portano a **2,51 M di sola scena**
(2,69 M con la passata delle ombre). Con 350 m: **2,26 M** di scena (2,45 M con le ombre). Da vicino
(terrazze, castagno morto, Velo sopra il paese) il paese è tutto entro 350 m e non cambia nulla; Media
(310) e Bassa (260) restano quelle di «oggetti», quindi **il gioco dell'e2e (Media) è identico**.

Nient'altro: nessuna prova toccata, nessun file delle due tracce cambiato oltre a questi.

## Esito dei test

- `npm run typecheck`: verde.
- `npm test`: verde, **63 file, 842 prove** (+1 file saltato di proposito, `misure.test.ts`). Sono le
  832 dell'unione 3 più le 7 di «mondo» (`qualita`, `luce`, `input`, `castagni-liberi`) e le 3 di
  «oggetti» (`lavatoio-a-piedi`). Nessuna prova indebolita.
- `npm run build`: verde (solo l'avviso solito sulla dimensione del pacchetto).
- **`npm run e2e:fase1`: verde, «prova ok»**, prologo e missione 1 completi con i tasti veri, nessun
  errore del browser, gli stessi passi dell'unione 3. Alla qualità che l'e2e usa di serie
  (Automatica, che in E2E vale Media, con post-produzione e ombre): **non è servito abbassarla a
  Bassa**. Girata due volte: subito dopo le due unioni (274 s) e sulla build finale, dopo la
  correzione del LOD (**267 s**, quella delle foto in `docs/shots/fase1/`). Unione 3: 250-258 s; il
  +3-10% viene dal paese più grande (case, annessi, 835 lumi) e dalla texture d'ombra degli alberi.
- `npm run shots` completo (inquadrature 1-7 e 11-14 ad Alta, poi le verifiche di gioco a Bassa):
  finito senza errori né messaggi d'errore del browser. Verifiche di fisica invariate: camminata
  8,21 m in 2 s, salto 1,31 m, planata 10 s con 21,4 m di perdita e rapporto 5,5:1.

## Schermate (docs/shots/, qualità Alta, 1280×720, SwiftShader)

Guardate tutte, accanto ai bozzetti `finale-1`, `-2`, `-3`, `-5`, alle schermate dell'unione 3 e alle
«dopo» dei due rami. **Nessuno schermo nero, nessun colore sballato, nessun oggetto sparito, nessun
artefatto nuovo.** Ogni schermata unita è la somma delle due tracce: l'atmosfera e le superfici di
«mondo» col paese e la prima persona di «oggetti».

| Inquadratura | Che cosa si vede | Contro il bozzetto / l'unione 3 |
|---|---|---|
| 01 paese a mezzogiorno | versante d'oliva e oro più saturo, campanile, tasso verde scuro, più tetti oltre la piazza | la parete pallida del versante non c'è più |
| 02 lungo l'asse | valle d'ottobre più satura, riale turchese | sparito il tratteggio bianco lungo la Finestra a sinistra (la fessura) |
| 03 planata alta | Velo con la traversa più alta e le maniche dagli angoli, Finestra senza bordo | il Tappo laggiù più grigio che azzurro (meno foschia) |
| 04 Finestra e stelle | stelle sotto il vetro, costolone di ferro | invariata |
| 05 notte in paese | versante **più scuro del cielo**, chiesa e casa accese | prima il versante era una carta chiara blu-viola |
| 06 matita e rivelazione | bosco rilevato a colori pieni, non rilevato ad acquerello | il non rilevato un po' più colorato (`nearPaint` e pigmento) |
| 07 notte e rilievo | rilievo in gesso chiaro, versanti scuri, più finestre accese nel nucleo | sparito il retino a puntini sui versanti |
| confronto 1, alba | castagno morto controluce, cielo blu, paese a grumo (case più fitte e alte) | bozzetto 1: stessa luce; niente più parete color carne |
| confronto 2, terrazze | prato oliva con paglia, muro a sassi, paese più denso attorno al campanile | bozzetto 2: terzo alto pieno |
| confronto 3, planata | Velo dei bozzetti con le maniche dagli angoli, terre lontane sotto il velo azzurro | bozzetto 3 |
| confronto 5, notte | facciate e strada lavate dalle pozze, versante scuro sotto il cielo | bozzetto 5: monti scuri sotto un cielo più chiaro |

Le foto della prova e2e (`docs/shots/fase1/`) sono rigenerate dall'ultima prova: Cripta di rame con le
fasce d'ottone e il coperchio di vetro (02), Velo con le maniche (08), Togna al lavatoio a terra (09),
squadro piantato con gli avambracci di scorcio (17, 18), fienile alla sera senza arancione pieno (12).

## Prestazioni (da docs/shots/shots.json)

Passaggio del mondo (`renderer.info`, post compresa), qualità Alta, 1280×720. «Unione 3» = le stesse
inquadrature in `unione-3.md`. Le schermate 03 e 04 non vedono il paese e restano uguali.

| Inquadratura | Draw call | Triangoli | Unione 3 (draw / tri) |
|---|---|---|---|
| 01 paese mezzogiorno | 206 | 1 522 k | 206 / 1 285 k |
| 02 asse verso il Sordo | **290** | 1 568 k | 290 / 1 533 k |
| 03 planata alta | 109 | 576 k | 108 / 572 k |
| 04 finestra e stelle | 92 | 599 k | 92 / 598 k |
| 05 notte in paese | 207 | 1 840 k | 207 / 1 579 k |
| 06 matita e rivelazione | 115 | 1 436 k | 115 / 1 435 k |
| 07 notte e rilievo | 172 | 1 549 k | 172 / 1 295 k |
| confronto 1, alba | 217 | 2 017 k | 216 / 1 728 k |
| confronto 2, terrazze | 249 | **2 211 k** | 248 / 1 921 k |
| confronto 3, planata | 170 | 660 k | 170 / 657 k |
| confronto 5, notte | 176 | 1 751 k | 175 / 1 507 k |

Le draw call non cambiano (il paese nuovo sta nelle stesse mesh cotte per zona); i triangoli crescono
di 0,2-0,3 M dove si vede il paese (+0,21 M di «oggetti», +0,03-0,08 M di «mondo»).

**Scena più passata delle ombre** (`__LUCE__.ombre.stats`, misurata a parte sulla build unita con le
stesse inquadrature; p5 = il paese da 190 m nel bosco, 860/16 alle 11; a12 = il Velo a 55 m sopra il
paese alle 16; a06 = la selva al mattino):

| Inquadratura | Bassa (scena) | Media (scena + ombre) | Alta (scena + ombre) |
|---|---|---|---|
| confronto 1 | 188 / 1,67 M | 199 / 1,74 M + 54 / 0,74 M = **2,48 M** | 217 / 2,02 M + 75 / 0,83 M = **2,84 M** |
| confronto 2 | 219 / 1,75 M | 231 / 1,85 M + 25 / 0,26 M = 2,11 M | 249 / 2,21 M + 34 / 0,43 M = 2,65 M |
| p5 paese da 190 m | 238 / 1,45 M | 249 / 1,63 M + 13 / 0,02 M = 1,66 M | 269 / 2,26 M + 20 / 0,18 M = 2,45 M (con 400 m: 2,69 M) |
| a12 Velo sul paese | — | 156 / 1,59 M + 63 / 0,77 M = 2,37 M | 168 / 1,82 M + 95 / 1,00 M = **2,82 M** |
| a06 selva | 267 / 1,37 M | 276 / 1,51 M + 9 / 0,02 M | **296** / 1,99 M + 10 / 0,03 M = 306 draw |
| confronto 5 (notte, niente ombre) | 155 / 1,47 M | 163 / 1,52 M | 176 / 1,75 M |

- **Draw call**: al più 306 per fotogramma (selva, Alta, scena più ombre), sotto il tetto di ~400.
- **Triangoli ad Alta: oltre il tetto di 2,5 M** dove la passata delle ombre vede il paese da vicino:
  2,84 M al confronto 1, 2,82 M dal Velo sopra il paese, 2,65 M al confronto 2 (all'unione 3 il caso
  peggiore misurato era 2,34 M). Nella passata delle ombre del confronto 1 contano le mesh cotte delle
  case (0,25 M; 0,38 M dal Velo), dei muri delle terrazze (0,25 M), della piazza, della chiesa e
  anche la Cripta sotto terra (0,05 M). La correzione del LOD sistema il caso del paese da lontano,
  non questi (vedi i problemi aperti).
- **Media** (il livello che deve reggere i 60 fps su Iris Xe): 2,48 M al confronto 1 e 2,37 M dal
  Velo, al limite; 285 draw call al più (selva, scena più ombre).
- Altri numeri di `shots.json`: gioco pronto in 10,8 s (8,7 all'unione 3: paese più grande, texture
  d'ombra degli alberi); simulazione 0,034 ms per passo; 23 275 alberi; **8457 collisori** (26 373
  all'unione 3: i tronchi lontani dai sentieri non l'hanno più); **835 lumi** (580). `renderCpuMs`
  (3,6 s a Bassa) resta non confrontabile, come spiegato in `unione-1.md`. I tempi di SwiftShader
  per fotogramma non sono significativi; quelli relativi dei due rami sono nei loro resoconti.

## Problemi aperti

- **Triangoli ad Alta oltre il tetto con le ombre** (2,8 M al confronto 1 e dal Velo sopra il paese,
  tabella sopra). Leve, nessuna applicata qui perché cambiano la resa delle ombre e vanno guardate
  inquadratura per inquadratura: disegnare nella passata delle ombre il livello `lontano` delle mesh
  cotte del paese (o un raggio più piccolo per loro); togliere la Cripta dalla passata delle ombre
  quando si è all'aperto (sta sotto terra: ~50 k triangoli, e con la luce radente e il terreno fuori
  dalla passata potrebbe proiettare ombre sul pendio); `PROFILI_OMBRE.alta.raggio` (85 m) e
  `DISTANZA` (160 m) in `render/ombre.ts`.
- **Media al limite** (2,48 M con le ombre al confronto 1): la misura vera su una Iris Xe a 1080p
  (`__GAME__.misuraPassi()`, pannello F3) resta da fare; c'è il gradino «Media ridotta» di «mondo» e,
  se non basta, `costruisciCase(ctx, 58)` o una versione intermedia del paese («oggetti»).
- **Increspature sull'altra metà all'alba** (foto e2e 05, e la stessa vista alle 6-7): strisce
  ondulate sul terreno lontano vicino al bagliore del sole. Ci sono anche a Bassa, senza filtro né
  pennellata, quindi vengono dal mondo (il rilievo dell'altra metà in luce radente sotto il velo),
  non dalla post; a Media il filtro generalizzato ci aggiunge archi attorno al bagliore della Linea.
  C'erano già all'unione 3 (più arancioni); non sono un effetto dell'unione.
- Da «mondo», non risolti nel ramo: confronto 1 col terzo alto a s 0,29 e 12% di pixel pallidi (zona
  grigio-beige in controluce a destra della Finestra) e il terzo basso a 0,66 (obiettivo ≤ 0,6);
  alberi a gruppi di 5-15 e coltre del bosco sui pendii oltre 25° (problema 7.3-7.4); montagne,
  cascate e nubi a strati del bozzetto 3; acqua del riale piatta.
- Da «oggetti»: da qualche punto alto (1130/44) una casa nuova copre il campanile; la vasca del
  lavatoio resta in parte sotto il pendio (coperta da lastre); nel piantato la destra impugna l'asta
  invece di appoggiarsi al muro, e le maniche chiare entrano larghe dal basso (foto e2e 17-18: da
  rivedere col direttore artistico); la Cripta resta meno rossa del bozzetto 7; tetti grigi dal Velo a
  mezzogiorno (materiale `PIODE`).
- **Decisioni di gioco in sospeso**: i collisori dei tronchi solo dove si cammina
  (`COLLISORI_SOLO_DOVE_SI_CAMMINA`, «mondo») e il lavatoio di nuovo a terra con Togna al posto di
  prima («oggetti») vanno approvati da chi decide il gioco; la prova e2e passa con tutti e due.
