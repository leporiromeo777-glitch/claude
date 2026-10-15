# Cielo di Terra

Open world in prima persona dentro il Verbano, un cilindro di O'Neill: il terreno
sale ai lati e prosegue sopra la testa, la Linea lungo l'asse fa da sole, salendo
verso l'asse si pesa meno e con il Velo si può "cadere" nella valle opposta.

Questa cartella contiene il motore (fase 1A, il "kernel del cilindro") e, in
cartelle curate da altri agenti, design (`docs/design/`), contenuti (`content/`),
moduli (`moduli/`) e strumenti (`strumenti/`).

## Comandi

| Comando | Che cosa fa |
|---|---|
| `npm install` | installa le dipendenze (versioni bloccate esatte) |
| `npm run dev` | server di sviluppo Vite su http://127.0.0.1:5173 (`window.__GAME__` attivo) |
| `npm run build` | controllo dei tipi (`tsc --noEmit`) + build di produzione in `dist/` |
| `npm run build:e2e` | build con `VITE_E2E=1` (API di debug attiva, buffer conservato) in `dist-e2e/` |
| `npm test` | test unitari Vitest in Node (fisica, terreno, celle, controller, Velo...) |
| `npm run shots` | build E2E + Chromium headless + 6 screenshot in `docs/shots/` + verifiche di gioco |
| `npm run typecheck` | solo il controllo dei tipi |

Opzioni di `npm run shots` (dopo `--`): `--no-build`, `--only=1,3`, `--size=1280x720`.

Parametri URL: `?debug` mostra il pannello statistiche (anche F3); `?ora=21.5` imposta l'ora.

## Comandi di gioco

Clic sulla finestra per catturare il mouse. **WASD** muove, **Shift** corre,
**Spazio** salta e, **tenuto premuto in aria**, apre il Velo (rilasciandolo si
chiude), **E** interagisce (evento `player:interact`), **F3** statistiche.
In sviluppo/E2E: **F** camera libera (WASD, Spazio su, C giù, Shift veloce).

Planata attraverso il cielo: dagli alti alpeggi del Tappo Sud (sopra ~450 m, circa
0.3 g) il Velo sale nelle correnti calde della Linea; vicino all'asse si chiude il
Velo e ci si lascia portare oltre, lo si riapre e si scende in picchiata attraverso
la fascia delle correnti, poi si plana verso la valle voluta.

## Struttura del codice (`src/`)

```
src/
  main.ts            ingresso: controllo WebGL2, caricamento, API di debug
  game.ts            assembla mondo, rendering, giocatore e ciclo principale
  core/              infrastruttura senza grafica
    loop.ts          ciclo a passo fisso 60 Hz + rendering interpolato, pausa, stepFrames
    input.ts         tastiera, mouse, pointer lock, tasti simulati
    events.ts        bus di eventi tipizzato (GameEvents)
    settings.ts      impostazioni del giocatore (FOV, sensibilità, fisica piena...)
    debug.ts         window.__GAME__ (dev e VITE_E2E=1)
  world/             il mondo come dati e matematica (gira anche in Node)
    layout.json      FONTE UNICA: cilindro, strisce, Tappi, lago, paesi, celle, demo
    constants.ts     costanti tipizzate ricavate da layout.json (R, L, omega...)
    cylinder.ts      conversioni (z, theta, h) <-> xyz, terna locale, gravità, Coriolis
    terrain*.ts      quota h(z, theta), griglia della mesh, profili dei Tappi
    cells.ts         particelle (celle 40 m) e stati bianco/matita/dipinto
    colliders.ts     scatole e cilindri con indice spaziale
    sky.ts           orologio del giorno, accensione e brace della Linea
    world.ts         facciata World per gli altri sistemi + stato demo
    noise.ts         rumore e casualità deterministici
  player/            il corpo del giocatore (gira anche in Node)
    controller.ts    controller cinematico nel riferimento rotante
    velo.ts          aerodinamica del Velo e correnti calde
    cameraRig.ts     orientamento della camera (trasporto a terra, rollio in volo)
    tunables.ts      tutti i parametri regolabili
  render/            three.js
    shaders/common.ts GLSL condiviso: luce della Linea, bande, pennellata, foschia, matita
    worldMaterial.ts  materiale unico del mondo (terreno, oggetti)
    terrainMesh.ts    chunk con 4 LOD, gonne, costruzione progressiva
    linea.ts, windows.ts, collare.ts, water.ts, lamps.ts, firstPerson.ts
    palette.ts, geomBuilder.ts, placement.ts, uniforms.ts, cellTexture.ts
  scene/             contenuti segnaposto: paesi, castagni, Lanterna, barche
  ui/stats.ts        pannello statistiche
tests/               test Vitest (Node)
scripts/shots.mjs    screenshot automatici con Playwright
```

Regola: `world/` e `player/` non importano WebGL (si testano in Node); `render/` e
`scene/` costruiscono la grafica a partire da quei dati.

## Convenzioni

- Asse del cilindro = asse Z; z da 0 (Tappo Sud) a 3000 (Tappo Nord, il Sordo).
- theta in gradi 0-360, crescente nel verso della rotazione (Mane = est).
  Punto: `x = -r sin(theta)`, `y = -r cos(theta)`, con `r = 646 - h`.
- Terna locale: su = verso l'asse, est = verso della rotazione, nord = +z; est x nord = su.
- Direzioni del gergo: Mane +theta, Sera -theta, Mont -z, Lag +z, "in su" verso l'asse.
- Omega = (0, 0, -2 pi / 51) rad/s; 1 g sul fondo.
- Celle: id = floor(z/40) * 96 + floor(theta/3.75).
- Colori: spazio sRGB "da pittore" (il renderer non converte, `ColorManagement` spento).

## Chromium headless con WebGL2 (container)

Il Chromium 141 preinstallato in `/opt/pw-browsers` (Playwright **1.56.1**, non
eseguire `playwright install`) dà WebGL2 via ANGLE su Vulkan/SwiftShader già con i
flag predefiniti, sia con headless-shell sia con il nuovo headless. Lo script li
rende espliciti: `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
Renderer riportato: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)`;
disponibili `EXT_color_buffer_float` ed `EXT_clip_control`. Si usa `WebGLRenderer`
(WebGL2), non `WebGPURenderer`.

Gli screenshot si catturano dal canvas (`toDataURL`, buffer conservato in E2E) con
il ciclo rAF fermo: in SwiftShader un fotogramma costa alcuni secondi.

## Versioni

three 0.186.1, @types/three 0.186.0, TypeScript 7.0.2, Vite 8.3.3, Vitest 5.0.4,
@playwright/test 1.56.1, @types/node 22.20.5 (tutte esatte). Nota: `vitest@5.0.3`
fa fallire `npm install` con un errore di npm (`Cannot read properties of null
(reading 'edgesOut')`); 5.0.4 si installa correttamente.

Stato dettagliato, numeri misurati e API: [`docs/stato/fase1a.md`](docs/stato/fase1a.md).
