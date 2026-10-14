# Stato del pacchetto: asset-blender

Costruito e verificato.

**Stato:** done

## Riepilogo

Pipeline completa degli asset 3D (GDD 12.5, ARCHITETTURA 12): script Python con `bpy` 5.2
(Cycles su CPU, mai EEVEE né Workbench) in `tools/blender/`, impacchettamento e controlli
in `tools/atlas/`, prodotti versionati in `public/assets/`, `public/icons/` e `assets/`.

- `tools/blender/common.py`: reset della scena, palette sRGB→lineare, materiali (legno Wave+Noise,
  vernice, ottone, acqua, filo avvolto, velluto, vetro, emissione), primitive `bmesh`, camere
  ortografiche, rig di luci (studio, alba, giorno, notte), Cycles 4 thread (`TRAMA_THREADS` per
  cambiarli), 24/32 campioni, OIDN, dati persistenti, Standard, PNG RGBA 8 bit, Freestyle con
  lineset e linestyle espliciti, semi fissi per nome, `--only` / `--out` / `--list`.
- `personaggi.py`, `scenografia.py`: personaggi (abiti desaturati, teste con il dettaglio di
  ognuno) e pezzi di scena (tombolo, oggetti della sera, case, barche, chiesa, faro, interni).
- `fusi.py` (14), `figurine.py` (36), `oggetti.py` (6 oggetti + 4 quadri da `quadri.py`),
  `diorami.py` (7 luoghi × 3 luci), `icona.py` (logo opaco e fuso trasparente per gli splash).
- `render_all.sh` (`npm run assets:render`): ogni script in un sottoprocesso con controllo del
  codice d'uscita, poi `pack.py`, confronto dei rettangoli con l'esecuzione precedente, fogli di
  controllo e test. `--parallel` (due corsie bilanciate), `--pack-only`, `--no-tests`.
- `tools/atlas/pack.py`: atlas a scaffali (con colonne impilate) ≤ 2048², padding 2, estrusione 1;
  WebP qualità 80; `manifest.json`; `assets/logo.png`, `splash.png`, `splash-dark.png`; icone web.
- `tools/atlas/contact_sheet.py`: 8 fogli in `tools/blender/out/contact_*.png`.
- `tools/atlas/test_assets.py` (unittest, 17 test) e `tools/atlas/catalogo.py` (nomi e budget).
- `tools/blender/README.md`: venv, comandi, opzioni, tempi misurati.

**Cosa trovano gli altri pacchetti** (nomi esattamente quelli di `EXPECTED_FRAMES` /
`EXPECTED_IMAGES` di `src/core/assets.ts`):

| Nome | Misura del frame | Ancora (ax, ay) | Gruppo |
|---|---|---|---|
| `fuso/<id>` (12), `fuso/stile_1`, `fuso/stile_2` | 96×320 | centro della sommità della testa (0,5; 0,125): il filo parte da lì | `core` |
| `fig/<id>/<ferma\|porge\|saluta>` (10 personaggi + `lino`), `fig/ada/<posa>_grezza` | 256×256 | piede della basetta (0,5; 0,92) | `core` |
| `obj/tombolo` | 1024×1024 | centro | `core` |
| `obj/{bottiglia,forbici,libro,fuso_faro,fascio_lettere}` | 256×256 | centro | `core` |
| `dio/<luogo>/<alba\|giorno\|notte>` (7 luoghi) | 1024×768 WebP | area sicura centrale 768×576 | `dio` |
| `tab/{sedia_vuota,tempesta,secca,sacrestia_lettere}` | 1024×768 WebP | area sicura centrale 768×576 | `tab` |

Numeri finali: 2 pagine d'atlas (1824×1812 e 1824×784) per 1649 KB; 25 WebP per 574 KB (la più
pesante `tab/tempesta` 76 KB, tutte a qualità 80); `public/assets` 2232 KB in tutto; logo 174 KB,
splash 136 KB l'uno, icone 192/512/64.

**Revisione visiva dei fogli di controllo** (ispezionati tutti):
- *Fusi*: 14 sagome distinte già dalla testa (berretto da postina, cuffia, saturno, coppola,
  berretto col pompon, trecce, berretto e barba, bombetta e occhiali, scialle, treccia col nastro,
  crocchia e occhiali, testa liscia; noce con anelli d'ottone e spirale per gli stili). A 40 px di
  larghezza (tombolo da 8 colonne su 360 px) si distinguono dal colore del filo, che è l'unica
  parte satura; il dettaglio della testa resta leggibile come sagoma.
- *Figurine*: leggibili su velluto e su carta grazie al contorno Freestyle; a 72 px restano
  riconoscibili per sagoma (saturno di Don Piero, cuffia bianca di Marta, scialle nero di Livia,
  Gino più basso) e fascia colorata. Abiti desaturati, unica fascia satura in vita; `lino` e Ada
  grezza sono legno nudo senza vernice né occhi.
- *Palette* (`contact_palette.png`, colore misurato sul filo del fuso e sulla fascia): tinta
  sempre quella di GDD 5.4; il filo del fuso dista Δ17-49 (RGB) dal colore nominale per 9
  personaggi su 12, di più per azzurro, argento e avorio (gino Δ65, lunardi Δ71, clotilde Δ65)
  perché la luce chiave è calda (#FFE2B8, ARCHITETTURA 12); le fasce delle figurine sono più
  scure (ombra propria della figurina a tre quarti) ma della stessa tinta.
- *Diorami*: 21 render, soggetto sempre dentro l'area sicura (controllato dallo script); mondo
  desaturato (intonaci, pietra, laguna), saturi solo cime, nastri e festoni nei colori dei fili
  (cima arancio di Bepi al molo, nastro viola sul portale, filo rosso dell'insegna del forno,
  festoni blu/giallo/azzurro in piazza, cima verde petrolio al faro, gomitolo corallo nella
  stanza). Notte: finestre #FFB24A, lampioni, lanterna del faro.
- *Quadri*: sedia vuota con lo scialle e le forbici nella luce d'alba; burrasca al faro con
  pioggia, fascio della lanterna e la barca di Bepi; secca con barene, barche in secco, lingua
  di sabbia, Livia col suo scialle nero e le impronte; sacrestia con l'armadio delle lettere,
  il fascio legato di nero e la stola viola.
- *Oggetti, icone*: oggetti nitidi su velluto; logo leggibile anche a 48 px su fondo chiaro e scuro.

## Decisioni prese

- I frame dell'atlas **non sono ritagliati**: restano alla misura nominale di GDD 12.5 (fusi 96×320,
  figurine e oggetti 256², tombolo 1024²). Chi disegna un frame alla sua misura nominale (come la
  scena di avvio, che stira il fuso in un riquadro fisso) non lo deforma, le ancore restano quelle
  dei documenti e i rettangoli dipendono solo da nomi e misure (determinismo per costruzione).
- Atlas a scaffali con colonne impilate dentro lo scaffale (first fit, ordinamento per altezza,
  larghezza, nome): 2 pagine invece di 3.
- Pagine dell'atlas arrotondate al multiplo di 4 (non a potenze di 2: il gioco disegna con il
  canvas 2D).
- Nomi delle pagine: `atlas/atlas_0.png`, `atlas/atlas_1.png`; immagini `dio/<luogo>/<luce>.webp`,
  `tab/<nome>.webp`; manifest con `version: 1` e senza date (byte per byte identico fra esecuzioni).
- WebP qualità 80 `method=6`; se un'immagine superasse 90 KB la qualità scenderebbe a passi di 4
  (mai sotto 60) e il riepilogo lo direbbe. Oggi non succede.
- `assets/logo.png` è RGB senza canale alfa (l'App Store rifiuta le icone con trasparenza): il test
  lo legge come RGBA e verifica alfa sempre 255. Gli splash hanno il fuso trasparente (900 px)
  al centro di #1C2233; `splash-dark.png` è uguale perché il fondo è già scuro (GDD 12.5).
- `favicon.png` 64×64.
- `pack.py` svuota sempre `public/assets` prima di scrivere (nessun file orfano; un test lo verifica).
- Thread di Cycles: 4 come da documento, ma `TRAMA_THREADS` li cambia (usato a 2 in questo
  container condiviso). `--parallel` usa due corsie da 2 thread.
- Quadri: `quadri.py` è un modulo usato da `oggetti.py` (che già li elencava), così `--only tab/...`
  funziona come per gli oggetti.
- Il test degli asset è Python (`unittest`, serve solo Pillow) e confronta anche il catalogo con
  gli elenchi di `src/core/assets.ts`.

## Problemi noti

- I PNG delle pagine dell'atlas e qualche WebP cambiano di pochi bit fra due esecuzioni (il denoiser
  e il campionamento adattivo in parallelo non sono bit-esatti): il manifest e i rettangoli invece
  sono identici. Rigenerare gli asset quindi produce un diff binario anche senza modifiche.
- Il tempo del comando predefinito (4 thread, in sequenza) non è stato cronometrato: per regola di
  questo container ho usato al massimo 2 thread per processo. Misurati: 1148 s in sequenza a 2
  thread, 682 s con `--parallel`.
- Il percorso predefinito di `BLENDER_PY` è il venv di questa sessione: altrove va impostata la
  variabile (il README spiega come ricreare il venv).
- I quadri `merletto_in_chiesa` e `vaporetto_alba` e gli stili di fuso 3-6 sono del livello L2
  (GDD 12.5) e non sono fatti.

## Richieste per altri pacchetti

- **fondamenta**: se volete il favicon renderizzato, collegate `public/icons/favicon.png` in
  `index.html` (`<link rel="icon" type="image/png" href="./icons/favicon.png">`) e, per un manifest
  web, `icons/icon-192.png` e `icons/icon-512.png`. `npm run assets:native` (capacitor-assets in
  modalità semplice) trova `assets/logo.png`, `assets/splash.png` e `assets/splash-dark.png`.
- **tombolo, interfaccia, campagna**: i frame hanno la misura nominale e l'ancora normalizzata del
  manifest: per un fuso l'ancora è la sommità della testa (il filo parte da lì, l'icona del
  personaggio va disegnata sopra), per una figurina il piede della basetta (ay 0,92), per gli
  oggetti il centro. Disegnate con `drawImage(src, sx, sy, sw, sh, x - w*ax, y - h*ay, w, h)`
  mantenendo il rapporto sw:sh. Diorami e quadri sono 1024×768 con il soggetto nell'area centrale
  768×576: ritagliate a "cover". I personaggi d'Archivio usano `fig/lino/<posa>` con un viraggio
  e il loro nome. I gruppi `dio` e `tab` non si caricano all'avvio: usate `assets.loadNames([...])`
  o `assets.load(['dio'])` prima di mostrarli.

## Test

- `npm run assets:render -- --parallel` partendo da `public/assets` cancellata → exit 0 in 682 s;
  pack: atlas 1649 KB, 25 WebP 574 KB, totale 2232 KB; 17 test OK.
- `TRAMA_THREADS=2 npm run assets:render` subito dopo (in sequenza) → exit 0 in 1148 s (19,1 min);
  «manifest: stessi rettangoli dell'esecuzione precedente»; `cmp` dei due manifest: identici.
- `python3 tools/atlas/test_assets.py` → 17 test OK (forma `AssetManifest`, nomi esatti, percorsi e
  gruppi, frame senza sovrapposizioni, estrusione sui pixel, ancore, budget, nessun file estraneo,
  logo opaco, splash 2732², icone web, impaginazione deterministica, catalogo = `assets.ts`).
- Gioco: server di sviluppo (porta 5230) e build di produzione servita con `vite preview` (porta
  5231), Chromium via Playwright: scena `boot`, `__GAME__.core.missingAssets()` → `[]`, nessuna
  risposta HTTP ≥ 400, le 2 pagine d'atlas e i 25 WebP si scaricano e si decodificano nel browser
  con le misure del manifest; nello screenshot la scena di avvio mostra i fusi veri appesi ai fili.
- Fogli di controllo generati e ispezionati: `contact_fusi`, `contact_figurine`, `contact_oggetti`,
  `contact_diorami`, `contact_quadri`, `contact_atlas`, `contact_icone`, `contact_palette`.
