# Stato del pacchetto: asset-blender

Costruito, poi verificato e corretto da un secondo agente (verifica del 14 ottobre 2026).

**Stato:** done

## Riepilogo

Pipeline completa degli asset 3D (GDD 12.5, ARCHITETTURA 12): script Python con `bpy` 5.2
(Cycles su CPU, mai EEVEE né Workbench) in `tools/blender/`, impacchettamento e controlli
in `tools/atlas/`, prodotti versionati in `public/assets/`, `public/icons/` e `assets/`.

- `tools/blender/common.py`: reset della scena, palette sRGB→lineare, materiali (legno Wave+Noise,
  vernice, ottone, acqua, filo avvolto, velluto, vetro, emissione), primitive `bmesh`, camere
  ortografiche, rig di luci (studio, alba, giorno, notte), Cycles 4 thread (`TRAMA_THREADS` per
  cambiarli), 24/32 campioni, OIDN, dati persistenti, Standard, PNG RGBA 8 bit, Freestyle 1,2 px
  `#2B2622` con lineset e linestyle espliciti, semi fissi per nome, `--only` / `--out` / `--list`.
- `personaggi.py`, `scenografia.py`: personaggi (abiti desaturati, teste con il dettaglio di
  ognuno) e pezzi di scena; in `scenografia.py` anche `wall_with_hole` (parete in un pezzo con
  vano rettangolare o ad arco) e `window_frame` (telaio a croce senza sovrapposizioni).
- `fusi.py` (14), `figurine.py` (36), `oggetti.py` (6 oggetti + 4 quadri da `quadri.py`),
  `diorami.py` (7 luoghi × 3 luci), `icona.py` (logo opaco e fuso trasparente per gli splash).
- `verifica_geometria.py` (nuovo, verifica): costruisce tutte le 68 scene senza renderizzarle
  e fallisce se due oggetti hanno facce complanari, rivolte dalla stessa parte, sovrapposte e
  visibili dalla camera (in Cycles fanno macchie nere). `test_geometria.py` (7 test, `bpy`).
- `render_all.sh` (`npm run assets:render`): controlli geometrici, ogni script in un
  sottoprocesso con controllo del codice d'uscita, `pack.py`, confronto dei rettangoli con
  l'esecuzione precedente, fogli di controllo, test. `--parallel`, `--pack-only`, `--no-tests`.
- `tools/atlas/pack.py`: atlas a scaffali (con colonne impilate) ≤ 2048², padding 2, estrusione 1;
  WebP qualità 80; `manifest.json`; `assets/logo.png`, `splash.png`, `splash-dark.png`; icone web.
- `tools/atlas/contact_sheet.py`: 8 fogli in `tools/blender/out/contact_*.png` (non pubblicati).
- `tools/atlas/test_assets.py` (unittest, 20 test) e `tools/atlas/catalogo.py` (nomi e budget).
- `tools/blender/README.md`: venv, comandi, opzioni, regole di costruzione, tempi misurati.

**API per gli altri pacchetti** (nomi esattamente quelli di `EXPECTED_FRAMES` /
`EXPECTED_IMAGES` di `src/core/assets.ts`; manifest `public/assets/manifest.json` nel formato
`AssetManifest`, percorsi relativi a `public/assets/`, `version: 1`):

| Nome | Misura del frame | Ancora (ax, ay) | Gruppo |
|---|---|---|---|
| `fuso/<id>` (12), `fuso/stile_1`, `fuso/stile_2` | 96×320 | centro della sommità della testa (0,5; 0,125): il filo parte da lì | `core` |
| `fig/<id>/<ferma\|porge\|saluta>` (10 personaggi + `lino`), `fig/ada/<posa>_grezza` | 256×256 | piede della basetta (0,5; 0,92) | `core` |
| `obj/tombolo` | 1024×1024 | centro | `core` |
| `obj/{bottiglia,forbici,libro,fuso_faro,fascio_lettere}` | 256×256 | centro | `core` |
| `dio/<luogo>/<alba\|giorno\|notte>` (7 luoghi) | 1024×768 WebP | area sicura centrale 768×576 | `dio` |
| `tab/{sedia_vuota,tempesta,secca,sacrestia_lettere}` | 1024×768 WebP | area sicura centrale 768×576 | `tab` |

Numeri finali: 2 pagine d'atlas (1824×1812 e 1824×784) per 1649 KB; 25 WebP per 546 KB (la più
pesante `tab/tempesta` 48 KB, tutte a qualità 80); `public/assets` 2205 KB in tutto; logo 174 KB,
splash 136 KB l'uno, icone 192/512/64.

### Cosa ha trovato e corretto la verifica

1. **Macchie nere nei render** (Cycles, facce complanari sovrapposte fra oggetti diversi: il
   raggio d'ombra di una faccia colpisce l'altra). Visibili: una fascia nera sulla bocca accesa
   del forno e sopra il vano della bottega (`dio/forno/*`), quadratini neri agli angoli e al
   centro delle finestre (`tab/sedia_vuota`, `dio/stanza/*`), al centro del rosone e sugli archi
   delle finestre laterali (`dio/chiesa/*`), all'incrocio del crocifisso (`tab/sacrestia_lettere`),
   più casi minori (lancette dell'orologio, libro, nastro del fascio di lettere, cassetta,
   armadio, pile di lettere, croce sul libretto di Don Piero). Prima della correzione il
   controllo trovava 17 scene su 68 con facce sovrapposte; ora 0. Il controllo è un passo di
   `render_all.sh` e ha i suoi test.
2. **Cuciture sui muri**: le pareti con la finestrella (stanza, sedia vuota, sacrestia) erano
   fatte a pezzi: Freestyle disegnava le linee fra i pezzi (righe verticali dal davanzale al
   pavimento) e l'intonaco cambiava a ogni pezzo. Ora sono un pezzo solo con il vano.
3. **Arco della finestra della sacrestia** tagliato dal bordo alto del quadro: finestra abbassata.
4. **Cielo granuloso** in `tab/tempesta` (e appena in `tab/secca`): le "nuvole" avevano una
   scala di 0,08 unità, cioè grana fine; ora sono nuvole di 4 unità. La WebP della tempesta è
   scesa da 76 a 48 KB (il budget è 90).
5. **Aderenza alla palette**: sotto la chiave calda dello studio i fili freddi viravano
   (azzurro di Gino Δ65 verso il verde-grigio, argento di Lunardi Δ71 e avorio di Clotilde Δ65
   verso il beige; fasce delle figurine fino a Δ121). Ora filo dei fusi e fascia delle figurine
   hanno un velo di emissione del colore nominale (0,3): filo Δ 5-31, fasce Δ 19-51, verificato
   da un test. A 40 px argento (Lunardi), avorio (Clotilde) e lino ora si distinguono.
6. Fogli di controllo: il carattere predefinito di Pillow non ha ², × e Δ (quadratini): ora si
   usa DejaVu Sans quando c'è. `render_all.sh --help` stampava una riga di troppo.
7. Test aggiunti: tinta misurata dei fili e delle fasce, colori dei fili della pipeline uguali a
   `src/content/characters.json`, test della geometria.

**Revisione visiva dei fogli di controllo** (ispezionati tutti dopo la nuova esecuzione):
- *Fusi*: 14 sagome distinte già dalla testa (berretto da postina, cuffia, saturno, coppola,
  berretto col pompon, trecce, berretto e barba, bombetta e occhiali, scialle, treccia col nastro,
  crocchia e occhiali, testa liscia; noce con anelli d'ottone e spirale per gli stili). A 40 px
  di larghezza si distinguono dal colore del filo, unica parte satura, e dalla sagoma della testa.
  Nel tombolo del gioco (Chromium) il filo disegnato in codice e il filo avvolto sul fuso hanno
  la stessa tinta e il filo parte dall'ancora sulla testa.
- *Figurine*: leggibili su velluto e su carta grazie al contorno Freestyle; a 72 px restano
  riconoscibili per sagoma (saturno di Don Piero, cuffia bianca di Marta, scialle nero di Livia,
  Gino più basso) e fascia colorata. Abiti desaturati, unica fascia satura in vita; `lino` e Ada
  grezza sono legno nudo senza vernice né occhi.
- *Palette* (`contact_palette.png`, colore medio misurato sul filo del fuso e sulla fascia):
  tinta di GDD 5.4 ovunque; filo Δ 5-31, fasce Δ 19-51 (le fasce sono in parte in ombra).
- *Diorami*: 21 render, soggetto dentro l'area sicura (lo script lo controlla); mondo
  desaturato, saturi solo cime, nastri e festoni nei colori dei fili. Notte: finestre #FFB24A,
  lampioni, lanterna del faro, bocca del forno accesa (ora senza la fascia nera).
- *Quadri*: sedia vuota con lo scialle e le forbici nella luce d'alba; burrasca al faro con
  pioggia, nuvole, fascio della lanterna e la barca di Bepi; secca con barene, lingua di sabbia,
  Livia col suo scialle nero e le impronte; sacrestia con l'armadio delle lettere, il fascio
  legato di nero, la stola viola e la finestra ad arco intera.
- *Oggetti, icone*: oggetti nitidi su velluto; logo leggibile anche a 48 px su fondo chiaro e scuro.

## Decisioni prese

- I frame dell'atlas **non sono ritagliati**: restano alla misura nominale di GDD 12.5 (fusi 96×320,
  figurine e oggetti 256², tombolo 1024²); ancore dei documenti; rettangoli che dipendono solo da
  nomi e misure (determinismo per costruzione).
- Atlas a scaffali con colonne impilate (first fit, ordinamento per altezza, larghezza, nome):
  2 pagine; misure arrotondate al multiplo di 4 (il gioco disegna con il canvas 2D).
- Nomi: `atlas/atlas_<n>.png`, `dio/<luogo>/<luce>.webp`, `tab/<nome>.webp`; manifest senza date.
- WebP qualità 80 `method=6`; se un'immagine superasse 90 KB la qualità scenderebbe a passi di 4
  (mai sotto 60). Oggi non succede.
- `assets/logo.png` RGB senza canale alfa (l'App Store rifiuta le icone con trasparenza); splash
  con il fuso trasparente (900 px) al centro di #1C2233; `splash-dark.png` uguale (fondo già
  scuro); `favicon.png` 64×64.
- `pack.py` svuota sempre `public/assets` prima di scrivere (un test verifica che non ci siano
  file estranei).
- Thread di Cycles: 4 come da documento; `TRAMA_THREADS` li cambia. `--parallel`: due corsie da 2.
- Regola di costruzione (verifica): mai facce complanari sovrapposte fra pezzi che si toccano;
  si usa uno scarto `scenografia.EPS` = 2 mm. Il controllo conta solo le facce rivolte verso la
  camera ortografica della scena (il fondo appoggiato a terra o il retro murato di una cornice
  non fanno macchie), così resta severo senza costringere a geometrie innaturali.
- Velo di emissione 0,3 (`personaggi.THREAD_GLOW`, `BAND_GLOW`) solo su filo dei fusi e fascia
  delle figurine, gli unici elementi saturi di GDD 12.1: provati 0, 0,25 e 0,5; a 0,5 il filo
  sembra luminoso e piatto, a 0,3 tiene l'ombreggiatura e la tinta.
- Prova "da `public/assets` vuota" in un container condiviso: la cartella si cancella solo per il
  passo di impacchettamento (`--pack-only`, 10 s), non per tutti i 20 minuti di render, perché
  altri agenti avviano il gioco nel frattempo; `pack.py` svuota comunque la cartella da sé e i
  render non la leggono, quindi il risultato è lo stesso.

## Problemi noti

- Il tempo del comando predefinito (4 thread, in sequenza) non è stato cronometrato: nel container
  condiviso si usano al massimo 2 thread per processo. Misurati: 1187 s (19,8 min) in sequenza a
  2 thread con la macchina occupata da altri agenti, 682 s con `--parallel` (stessa CPU del
  predefinito). In sequenza a 2 thread si è vicini al limite di 20 minuti.
- I PNG delle pagine dell'atlas e le WebP cambiano di pochi bit fra due esecuzioni (denoiser e
  campionamento adattivo su più thread non sono bit-esatti): manifest e rettangoli identici.
- Il percorso predefinito di `BLENDER_PY` è il venv di questa sessione: altrove va impostata la
  variabile (il README spiega come ricreare il venv).
- I quadri `merletto_in_chiesa` e `vaporetto_alba` e gli stili di fuso 3-6 sono del livello L2
  (GDD 12.5) e non sono fatti.

## Richieste per altri pacchetti

- **fondamenta**:
  - nella scena di avvio la riga `core.boot.asset.segnaposto` («Placeholders drawn in code are
    shown instead.») compare anche quando non manca nessun asset, sotto «No missing assets»:
    andrebbe mostrata solo con almeno un asset mancante (`src/core/boot.scene.ts`, sezione asset);
  - `src/core/placeholders.ts`: il segnaposto del fuso ha `ay: 0.05`, il frame vero `0.125`
    (sommità della testa). Con `0.125` il filo si attacca nello stesso punto con e senza asset;
  - facoltativo: collegare `public/icons/favicon.png` in `index.html` al posto dello SVG in linea
    e, per un manifest web, `icons/icon-192.png` e `icons/icon-512.png`. `npm run assets:native`
    trova `assets/logo.png`, `assets/splash.png` e `assets/splash-dark.png`.
- **tombolo, interfaccia, campagna**: i frame hanno la misura nominale e l'ancora normalizzata del
  manifest: per un fuso l'ancora è la sommità della testa (il filo parte da lì, l'icona del
  personaggio va disegnata sopra), per una figurina il piede della basetta (ay 0,92), per gli
  oggetti il centro. Disegnate con `drawImage(src, sx, sy, sw, sh, x - w*ax, y - h*ay, w, h)`
  mantenendo il rapporto sw:sh. Diorami e quadri sono 1024×768 con il soggetto nell'area centrale
  768×576: ritagliate a "cover". I personaggi d'Archivio usano `fig/lino/<posa>` con un viraggio
  e il loro nome. I gruppi `dio` e `tab` non si caricano all'avvio: usate `assets.loadNames([...])`
  o `assets.load(['dio'])` prima di mostrarli.

## Test

- `TRAMA_THREADS=2 bash tools/blender/render_all.sh` (pipeline completa, in sequenza): exit 0 in
  1187 s; controlli geometrici 0 scene su 68 con facce sovrapposte; «manifest: stessi rettangoli
  dell'esecuzione precedente»; `cmp` con il manifest dell'esecuzione precedente (quella del
  costruttore): identico byte per byte; 20 test degli asset OK.
- `rm -rf public/assets && bash tools/blender/render_all.sh --pack-only`: exit 0 in 10 s;
  `public/assets`, `public/icons` e `assets/` identici byte per byte a quelli di prima.
- `python3 tools/atlas/test_assets.py` → 20 test OK (forma `AssetManifest`, nomi esatti, percorsi
  e gruppi, frame senza sovrapposizioni, estrusione sui pixel, ancore, budget, nessun file
  estraneo, tinta dei fili e delle fasce, logo opaco, splash 2732², icone web, impaginazione
  deterministica, catalogo = `assets.ts`, colori dei fili = `characters.json`).
- `$BLENDER_PY tools/blender/test_geometria.py` → 7 test OK; `verifica_geometria.py` → 0 scene
  con facce sovrapposte su 68 (prima della correzione: 17).
- Gioco in Chromium (Playwright): server di sviluppo (porta 5235) e build di produzione in una
  cartella temporanea servita con `vite preview` (porta 5236, `?debug=1`): scena `boot`,
  `__GAME__.core.missingAssets()` → `[]`, nessuna risposta HTTP ≥ 400, nessun errore in console,
  le 2 pagine d'atlas e le 25 WebP si scaricano e si decodificano con le misure del manifest.
  Scena `tombolo` (`__GAME__.night.start({ level: 'g02' })`): fusi veri appesi ai fili,
  `missingAssets()` → `[]`.
- Fogli di controllo rigenerati e ispezionati: `contact_fusi`, `contact_figurine`,
  `contact_oggetti`, `contact_diorami`, `contact_quadri`, `contact_atlas`, `contact_icone`,
  `contact_palette`.

## Integrazione

Richieste di `docs/stato/RICHIESTE.md` per questo pacchetto, controllate sul codice attuale (14 ottobre 2026).

| Richiesta | Esito |
|---|---|
| (piattaforma-nativa, costruzione e verifica) Grafica in evidenza per Google Play: 1024×500, PNG o JPEG senza trasparenza, con il tombolo e il titolo «Trama»; obbligatoria nella scheda | **Fatto**: `assets/feature-graphic.png` (scheda italiana, predefinita) e `assets/feature-graphic-en.png` (scheda inglese). |
| (fondamenta) La scena boot chiede esattamente `EXPECTED_FRAMES` / `EXPECTED_IMAGES`; percorsi del manifest relativi a `public/assets/`, gruppi `core` / `dio` / `tab` | Già fatto: `__GAME__.core.missingAssets()` → `[]` nella build di prova; `pack.py` rigenerato in una cartella temporanea dagli stessi render dà `public/assets`, `public/icons`, logo e splash identici byte per byte a quelli versionati. |

**La grafica in evidenza.**

- `tools/blender/grafica.py` (nuovo, Cycles su CPU come gli altri) rende `store/tombolo`: lo stesso tombolo di `obj/tombolo` (`scenografia.tombolo`) con otto fuselli dai colori del cast e il corallo di Ada vicino al centro, 2048×1000 trasparente, 64 campioni, denoiser accurato. Camera ortografica (azimut 26°, elevazione 28°: il merletto sul rullo si vede bene), tombolo alto 1,08 volte l'immagine, centrato al 71% della larghezza. Le gambe del cavalletto escono dal bordo basso, il resto resta dentro, e lo script lo controlla. Un pavimento *shadow catcher* lascia l'ombra a terra nell'alfa. Tempo: 264 s a 3 thread con la macchina occupata da altri agenti.
- `tools/atlas/grafica.py` (nuovo) compone a 2048×1000 e riduce a 1024×500 PNG RGB, senza alfa, circa 370 KB:
  - il fondo è velluto disegnato come in `src/screens/backdrop.ts` (due ottave, vignettatura, luce calda della lampada dietro il tombolo);
  - poi il render;
  - poi il titolo come nella schermata del titolo: «TRAMA» in EB Garamond color carta, spaziato 0,34 em, con l'ombra e l'alone caldo;
  - sotto, lo smerlo d'ottone di `laceEdge`, disegnato al doppio della risoluzione per l'antialias;
  - in fondo il sottotitolo in corsivo ottone: «Il merletto dei giorni» oppure «The Lace of Days».
- I caratteri vengono da `node_modules/@fontsource/eb-garamond` (licenza OFL, serve `npm install`). Lo script si ferma se il titolo arriva a meno del 3% dell'immagine dal tombolo, misurato sui pixel pieni del render nella fascia del titolo, o se si avvicina ai bordi. Due esecuzioni danno lo stesso file byte per byte.
- `render_all.sh` lancia `grafica.py` fra i render (in sequenza e nella corsia B di `--parallel`) e `tools/atlas/grafica.py` dopo `pack.py`. Anche `--pack-only` rigenera le due grafiche. I nomi stanno in `catalogo.py`: `STORE_RENDERS`, `FEATURE_GRAPHICS`, `FEATURE_SIZE`, `FEATURE_BUDGET`. Il README spiega tutto.
- Controllo visivo, sul PNG finale e su ritagli ingranditi: il titolo si legge bene anche ridotto a 384 px di larghezza. Il merletto è nitido, con smerlo, ragni e spilli d'ottone, rosso e verde. I fili colorati arrivano ai fuselli. Nessuna macchia nera né scalettatura visibile. Il blocco del titolo occupa x 0,075-0,435, il tombolo comincia a 0,475 nella stessa fascia.
- Test nuovi in `tools/atlas/test_assets.py` (classe `FeatureGraphicTest`, i test sono ora 25):
  - formato di Google Play: 1024×500, PNG, modo RGB senza alfa, ≤ 1 MB;
  - titolo leggibile sul velluto: contrasto ≥ 7:1 fra lettere e fondo, fondo blu;
  - fili saturi del tombolo nella metà destra, pochi a sinistra;
  - le due lingue cambiano solo nel sottotitolo;
  - composizione deterministica dal render grezzo; se il render manca, il test viene saltato.

  Prova di mutazione: con l'alfa, con il titolo coperto, senza il tombolo e alla misura sbagliata fallisce ogni volta il test giusto.

**Richiesta per piattaforma-nativa** (non è nei file di questo pacchetto): in `docs/STORE.md` 6.5 la riga «Grafica in evidenza | 1024×500, obbligatoria (da preparare)» può diventare `assets/feature-graphic.png` (scheda italiana) e `assets/feature-graphic-en.png` (scheda inglese). In `docs/stato/piattaforma-nativa.md` il problema noto «Manca la grafica in evidenza» non vale più.

Test: `python3 tools/atlas/test_assets.py` → 25 test OK (anche con `$BLENDER_PY`). `bash -n tools/blender/render_all.sh` è OK. `contact_sheet.py` funziona anche con il nuovo render grezzo `store/`. Nel browser (build `VITE_E2E=1` servita da `vite preview` sulla porta 5420) `missingAssets()` è vuoto e non ci sono errori in console.
