# Pipeline degli asset (Blender, Cycles su CPU)

Gli asset 3D di TRAMA (GDD 12.5, ARCHITETTURA 12) si generano con script Python che usano
Blender come modulo (`bpy`), senza interfaccia. I prodotti sono **versionati**: la build del
gioco non ha bisogno di Blender. Si rigenerano solo quando cambiano gli script.

```
npm run assets:render            # tutto, in sequenza (Cycles a 4 thread)
npm run assets:render -- --parallel            # due corsie bilanciate in parallelo, 2 thread ciascuna
bash tools/blender/render_all.sh --pack-only   # solo impacchettamento, test e fogli di controllo
```

## L'interprete (`BLENDER_PY`)

Gli script girano con un Python che ha `bpy` 5.2.2, Pillow e numpy. Il percorso si passa
con la variabile `BLENDER_PY`; il valore predefinito è il venv di questo container:

```
/tmp/claude-0/-home-user-claude/c3e3ef47-6c71-52f7-905c-1c8a39dab6eb/scratchpad/bvenv/bin/python
```

È un percorso di sessione: su un'altra macchina il venv si ricrea così (serve Python 3.13,
la versione per cui è pubblicato il modulo `bpy` 5.2):

```
python3.13 -m venv bvenv
bvenv/bin/pip install bpy==5.2.2 pillow numpy
export BLENDER_PY="$PWD/bvenv/bin/python"
```

Il modulo `bpy` porta con sé Cycles (CPU) e OpenImageDenoise. **Mai EEVEE** (nel container
non ha un contesto GPU) **né Workbench** (dipende da Mesa): tutti i render sono Cycles.

## Cosa fa `render_all.sh`

1. controlla la geometria senza renderizzare: `test_geometria.py` (test dei pezzi condivisi e
   del controllo) e `verifica_geometria.py`, che costruisce ogni scena (fusi, figurine, oggetti,
   quadri, diorami, icona) e si ferma se due oggetti hanno facce **complanari, rivolte dalla
   stessa parte, sovrapposte e visibili dalla camera**: in Cycles fanno macchie nere (il raggio
   d'ombra che parte da una faccia colpisce subito l'altra). Pochi secondi; poi svuota i render
   grezzi in `tools/blender/out/render/` (ignorata da git);
2. lancia ogni script in un **sottoprocesso separato** (`fusi`, `figurine`, `oggetti`,
   `icona`, `diorami`) e ne controlla il codice d'uscita: un crash di Blender non solleva
   eccezioni Python, quindi conta solo l'exit code. Il log completo di ogni passo è in
   `tools/blender/out/logs/`; a schermo vanno solo le righe `[blender]`. Con `--parallel`
   i passi vanno su due corsie che girano insieme (una fa i diorami di molo, forno, piazza,
   chiesa e farmacia; l'altra fusi, figurine, oggetti e quadri, icona e i diorami di faro e
   stanza) e la pipeline fallisce se fallisce una delle due;
3. `tools/atlas/pack.py` svuota `public/assets/` e la rigenera: atlas, WebP, manifest; scrive
   anche `assets/logo.png`, `assets/splash.png`, `assets/splash-dark.png` e `public/icons/`;
4. confronta i rettangoli del nuovo manifest con quelli dell'esecuzione precedente
   (determinismo) e lo scrive a schermo;
5. `tools/atlas/contact_sheet.py` produce i fogli di controllo `tools/blender/out/contact_*.png`
   e `tools/atlas/test_assets.py` verifica nomi, formato, budget e prodotti nativi.

Esce con un codice diverso da zero al primo errore (script, budget o test).

## Gli script

| Script | Produce (nei render grezzi) | Note |
|---|---|---|
| `common.py` | — | reset della scena, palette sRGB→lineare, materiali (legno Wave+Noise, vernice, ottone, acqua, filo, velluto, vetro), primitive con `bmesh`, camere ortografiche, rig di luci (studio, alba, giorno, notte), impostazioni di render, Freestyle, semi fissi, `--only`/`--out` |
| `personaggi.py` | — | colori dei fili, abiti desaturati, teste intagliate o dipinte con il dettaglio di ogni personaggio |
| `scenografia.py` | — | pezzi di scena: tombolo, oggetti della sera, case, barche, vaporetto, pozzo, chiesa, campanile, faro, interni |
| `fusi.py` | `fuso/<id>` ×12, `fuso/stile_1`, `fuso/stile_2` | 96×320, camera frontale a 8°, riquadro comune +6%, ancora sulla sommità della testa |
| `figurine.py` | `fig/<id>/<posa>` ×33, `fig/ada/<posa>_grezza` ×3 | 256×256, tre quarti (30°, 20°), piede della basetta su `ay = 0.92`, Freestyle |
| `oggetti.py` | `obj/<nome>` ×6, `tab/<nome>` ×4 | oggetti 256² (tombolo 1024²) trasparenti; i quadri (da `quadri.py`) 1024×768 opachi con Freestyle |
| `quadri.py` | — | i 4 quadri L1: `sedia_vuota`, `tempesta`, `secca`, `sacrestia_lettere` |
| `diorami.py` | `dio/<luogo>/<luce>` ×21 | 1024×768, camera frontale a 30°, soggetto nell'area sicura 768×576 (lo script fallisce se ne esce), Freestyle; ogni luogo si costruisce una volta e si rende con le tre luci |
| `icona.py` | `icona/logo`, `icona/fuso` | 1024²: il fuso con il filo corallo su velluto `#1C2233` (opaco) e lo stesso fuso trasparente per gli splash |
| `verifica_geometria.py` | — | controllo delle facce complanari sovrapposte su tutte le scene, senza render (exit 1 se ne trova) |
| `test_geometria.py` | — | test (`unittest`, serve `bpy`) del controllo e dei pezzi condivisi: parete in un pezzo con vano rettangolare o ad arco, telaio a croce |

Ogni script accetta:

- `--only <nomi>`: solo alcuni asset, separati da virgola o ripetendo l'opzione; un prefisso
  vale per tutto il gruppo (`--only fig/teresa` fa le tre pose, `--only dio/faro` le tre luci,
  `--only tab` i quattro quadri);
- `--out <cartella>`: dove scrivere i render grezzi (predefinita `tools/blender/out/render`);
- `--list`: elenca i nomi che lo script sa fare.

Esempi:

```
$BLENDER_PY tools/blender/figurine.py --only fig/ada --out /tmp/prova
$BLENDER_PY tools/blender/diorami.py --only dio/molo/notte
$BLENDER_PY tools/blender/oggetti.py --only obj/libro,tab/secca
TRAMA_ANTEPRIMA=1 $BLENDER_PY tools/blender/diorami.py --only dio/faro   # metà risoluzione, 8 campioni, senza contorni
$BLENDER_PY tools/atlas/pack.py && $BLENDER_PY tools/atlas/contact_sheet.py && $BLENDER_PY tools/atlas/test_assets.py
```

Ogni render grezzo è un PNG con accanto un JSON di metadati (`w`, `h`, ancora `ax`/`ay`
calcolata proiettando la geometria, area occupata dal soggetto per diorami e quadri).

## Impostazioni di render

Cycles su CPU, 4 thread (`TRAMA_THREADS` li cambia, per esempio su una macchina condivisa),
24 campioni per sprite e oggetti, 32 per diorami, quadri e icona, campionamento adattivo,
denoiser OpenImageDenoise, `use_persistent_data`, view transform `Standard` (i colori della
palette escono esatti), PNG RGBA a 8 bit, `film_transparent` per sprite e oggetti. Contorni
Freestyle 1,2 px `#2B2622` su figurine, diorami e quadri, con lineset e linestyle creati
esplicitamente (acqua, cielo, pioggia e fasci di luce stanno in una collezione esclusa).
Semi fissi: `cycles.seed = 0` e `random.seed(nome)` per ogni asset, quindi due esecuzioni
danno la stessa geometria, le stesse inquadrature e lo stesso manifest; i pixel possono
differire di pochissimo (il denoiser e il campionamento adattivo su più thread non sono
bit-esatti).

Fili dei fusi e fasce delle figurine (gli unici elementi saturi, GDD 12.1) hanno un velo di
emissione del loro colore nominale (`personaggi.THREAD_GLOW`, `BAND_GLOW` = 0,3): sotto la
chiave calda dello studio l'azzurro di Gino, l'argento di Lunardi e l'avorio di Clotilde
virerebbero al grigio-beige. Con il velo la tinta misurata resta vicina a GDD 5.4
(`contact_palette.png`, controllata da `test_assets.py`).

Regola di costruzione (vedi `verifica_geometria.py`): due pezzi che si toccano non hanno mai
facce nello stesso piano rivolte dalla stessa parte; i pezzi si accorciano, si assottigliano o
si spostano di `scenografia.EPS` (2 mm). Le pareti con una finestra sono un pezzo solo
(`scenografia.wall_with_hole`): niente cuciture di Freestyle e intonaco continuo.

## Impacchettamento (`tools/atlas/pack.py`)

- **Atlas**: gli sprite restano alla misura nominale (il gioco li disegna alla loro misura e
  con la loro ancora), impaginati a scaffali con colonne impilate, padding 2 px, estrusione
  1 px, pagine `public/assets/atlas/atlas_<n>.png` ≤ 2048×2048. L'impaginazione dipende solo
  da nomi e misure: stessi rettangoli a ogni esecuzione.
- **Immagini**: diorami e quadri in WebP qualità 80 (`method=6`) in `public/assets/dio/` e
  `public/assets/tab/`; se un'immagine superasse 90 KB la qualità scende a passi di 4 (mai
  sotto 60) e il riepilogo lo dice.
- **Manifest** `public/assets/manifest.json` (`AssetManifest`, ARCHITETTURA 4): percorsi
  relativi a `public/assets/`, gruppi `core` (atlas), `dio`, `tab`, nessuna data.
- **Nativi**: `assets/logo.png` 1024² opaca (RGB, senza canale alfa: l'App Store rifiuta le
  icone con trasparenza), `assets/splash.png` e `assets/splash-dark.png` 2732² con il fuso al
  centro su `#1C2233`; `npm run assets:native` ne ricava icone e splash di iOS e Android.
- **Web**: `public/icons/icon-192.png`, `icon-512.png`, `favicon.png` (64²) dal logo.
- **Budget** controllati (e verificati dai test): atlas ≤ 3 MB, ogni WebP ≤ 90 KB, totale
  ≤ 6 MB. Il riepilogo va in `tools/blender/out/pack_report.json`.

Dopo aver rigenerato il manifest va rifatta la build del gioco (o riavviato il server di
sviluppo): la presenza del manifest si legge in `vite.config.ts` all'avvio.

## Tempi (misurati nel container, 4 CPU condivise con altri processi)

| Passo | sequenziale, 2 thread | Note |
|---|---|---|
| controlli geometrici | 11 s | `test_geometria.py` + `verifica_geometria.py` (68 scene, senza render) |
| fusi (14) | 11 s | ~0,8 s a fuso |
| figurine (36) | 85 s | ~2 s a figurina (costruzione, render, Freestyle) |
| oggetti (6) e quadri (4) | 203 s | il tombolo 1024² ~12 s, ogni quadro 35-46 s |
| icona (2) | 20 s | |
| diorami (21) | 846 s | 37-42 s a diorama |
| pack, fogli di controllo, test | 9 s | |

Esecuzioni complete: **1187 s** (19,8 min) in sequenza con `TRAMA_THREADS=2` e la macchina
occupata da altri processi; **682 s** (11 min) con `--parallel` (due corsie da 2 thread, cioè
la stessa CPU del valore predefinito a 4 thread). Il valore predefinito (4 thread, in
sequenza) non è stato cronometrato qui perché la macchina era condivisa. Due esecuzioni
consecutive danno un manifest identico byte per byte; i PNG delle pagine dell'atlas e
qualche WebP possono cambiare di pochi bit fra un'esecuzione e l'altra (rumore del denoiser
su più thread), i rettangoli no. Dagli stessi render grezzi, `--pack-only` rigenera una
`public/assets` cancellata identica byte per byte (in 10 s).

## Test

```
python3 tools/atlas/test_assets.py      # oppure $BLENDER_PY tools/atlas/test_assets.py
```

Controlla: manifest conforme ad `AssetManifest` con esattamente i nomi L1 (allineati a
`EXPECTED_FRAMES` / `EXPECTED_IMAGES` di `src/core/assets.ts`), frame dentro le pagine e
senza sovrapposizioni, estrusione sui pixel, ancore, budget, logo opaco, splash, icone web,
impaginazione deterministica, tinta del filo dei fusi (Δ RGB ≤ 40) e della fascia delle
figurine (Δ ≤ 60) misurata sui pixel, colori dei fili uguali a `src/content/characters.json`.

```
$BLENDER_PY tools/blender/test_geometria.py      # pezzi condivisi e controllo delle facce complanari
$BLENDER_PY tools/blender/verifica_geometria.py  # tutte le scene (o --only dio/stanza,tab)
```

Nel gioco, `__GAME__.core.missingAssets()` nella scena di avvio deve restituire un elenco vuoto.
