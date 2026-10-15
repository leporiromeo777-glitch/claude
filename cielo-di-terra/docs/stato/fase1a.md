# Fase 1A — kernel del cilindro: stato

Data: 2026-10-15. Responsabile: motore (fase 1A). Questo documento dice che cosa
funziona, con quali numeri, che cosa manca e quali API usare per costruirci sopra.

## In breve

Si cammina, si salta e si plana dentro il cilindro con la direzione artistica
voluta. Il terreno sale ai lati e prosegue sopra la testa, le altre valli stanno
appese nel cielo velate d'azzurro, la Linea si accende all'alba e diventa brace
di notte, le Finestre mostrano le stelle che girano una volta ogni 51 s. Il mondo
non rilevato è disegnato a matita e una particella può essere rivelata con
l'inchiostro che si allarga. La fisica è nel riferimento rotante (centrifuga e
Coriolis), con test che la confrontano con la soluzione inerziale esatta.

Screenshot (generati da `npm run shots`, guardati e rifiniti uno per uno):

| File | Inquadratura |
|---|---|
| `docs/shots/01-paese-mezzogiorno.png` | Corbella a mezzogiorno: il campanile, il versante, la Finestra dei Ponti e il Verbanetto sopra la testa |
| `docs/shots/02-asse-verso-il-sordo.png` | dagli alpeggi del Tappo Sud lungo l'asse: la valle che si chiude a tubo, la Linea, il Sordo |
| `docs/shots/03-planata-alta.png` | in planata a 50 m dall'asse (0.08 g): il Velo, la nappina, il lago dall'altra parte del cielo |
| `docs/shots/04-finestra-stelle.png` | a piedi su un costolone-passerella della Finestra dei Ponti, le stelle sotto il vetro |
| `docs/shots/05-notte-paese.png` | notte blu-viola: campanile, finestre accese, lampioni, stelle, lumi delle frazioni nel cielo |
| `docs/shots/06-matita-rivelazione.png` | rivelazione in corso: il fronte d'inchiostro frastagliato avanza su un versante a matita |

## Che cosa funziona

1. **Progetto e nucleo**: Vite + TypeScript strict + three.js r186 (WebGLRenderer,
   WebGL2). Ciclo a passo fisso 60 Hz con disegno interpolato, input (pointer lock,
   WASD, Spazio, Shift, E, mouse), ridimensionamento, bus di eventi, impostazioni,
   pannello statistiche (`?debug` o F3), API `window.__GAME__` in dev e con `VITE_E2E=1`.
2. **Matematica del cilindro** (`src/world/cylinder.ts`): conversioni, terna locale
   destrorsa, gravità centrifuga, Coriolis, direzioni inerziali per il cielo.
3. **Terreno** (`src/world/terrain.ts`): quota analitica da `layout.json` + rumore.
   Le valli hanno colline e versanti che salgono a creste di 55-120 m, poi una
   cornice di terra scende dolce fino al telaio d'acciaio della Finestra. Valle 1
   ha il riale e Corbella su un versante a gradoni con la piazza piana. Valle 2 ha
   il lago (fondo a 18 m sotto il pelo) e due isole. Valle 3 è a campi. Le Finestre
   sono di vetro piatto con costoloni ogni 40 m (fisica). Il Tappo Sud sale a conca
   fino al mozzo con gli Alpeggi a gradoni, il Sordo è una parete di roccia con
   contrafforti e spalle asimmetriche. Mesh in 126 chunk (colonne di 30° allineate
   alle strisce, righe di ~306 m in lunghezza d'arco del profilo), 4 LOD con gonne,
   costruzione progressiva a tempo. Normali verso l'interno, colori per vertice per
   bioma (prato, selva, roccia, alpeggio, campi, paese, riva, riale).
4. **Rendering stilizzato** (un solo shader del mondo, `render/shaders/common.ts`):
   - la luce in ogni frammento punta all'asse, inclinata di 30-50° dallo schermo
     girevole (mattino da Mane, mezzogiorno da Lag, sera da Sera);
   - lambert a bande morbide, ambiente a emisfero, pennellata triplanare in
     (arco, z, quota) su tre scale, variazione calda/fredda;
   - foschia a "quinte teatrali" (gradini morbidi) in blu caldo, con il bagliore
     della Linea dove il raggio passa vicino all'asse;
   - la Linea: nucleo emissivo e alone additivo rivolto alla camera, miccia luminosa
     all'alba e al tramonto, brace blu di notte;
   - il Collare: grappoli di masse tonde traslucide (carta velina) a R - 300;
   - le Finestre: cielo inerziale procedurale (stelle di grandezze varie, velo di
     Via Lattea, la Meta), brina ai bordi, riflesso tenue; costoloni d'acciaio con
     passerella in assi, telaio d'acciaio sui bordi;
   - il lago: bande dalla giada al cobalto, pennellate sulle increspature, schiuma
     dipinta sulla riva;
   - giorno/notte: 24 ore in 40 minuti reali (configurabile), orari allineati a
     `docs/design/FASE1.md`; notte blu-viola, lumi caldi (bagliori additivi e luce
     locale degli 8 lumi più vicini).
5. **Matita/colore**: DataTexture RGBA32F 96 × 75 (una cella = 40 m × 3.75°). Per
   frammento: 4 campioni bilineari con dominio distorto, bordo frastagliato. MATITA
   = carta avorio, sfumato di grafite, tratteggio a macchie stabile con la distanza,
   curve di livello, contorni che tremano a 6 Hz. BIANCO = foglio quasi vuoto.
   DIPINTO = colore. La rivelazione dura 2.2 s: un fronte radiale dal caposaldo con
   bordo rumoroso, una linea d'inchiostro sottile, il bordo bagnato dietro, la
   velatura che sborda davanti e le linee della matita ripassate a inchiostro.
   "Il mondo vicino è sempre dipinto": raggio regolabile (`settings.nearPaint`,
   70-150 m). Stato demo da `layout.json → demo`.
6. **Controller** (`src/player/controller.ts`): cinematico nel riferimento rotante,
   gravità radiale, Coriolis al 40% a piedi (100% con `fullPhysics` e sempre in
   planata), passo/corsa, salto, limite di pendenza 47°, gradini 0.5 m, aggancio al
   suolo, scivolamento sui pendii ripidi, collisori a scatola e a cilindro (spinta
   fuori, salita sui bassi, appoggio sui tetti), costoloni delle finestre (si
   saltano). Camera (`cameraRig.ts`): a terra segue il suolo (trasporto parallelo),
   in aria conserva l'orientamento e livella l'orizzonte con un rollio lento quando
   il "giù" si capovolge. FOV, sensibilità, inversione Y, oscillazione della testa
   (spenta), fisica piena in `core/settings.ts`.
7. **Il Velo** (`player/velo.ts`): portanza e resistenza parabolica rispetto
   all'aria che ruota con il cilindro, incidenza dallo sguardo (autoregolata, niente
   stallo), virata verso lo sguardo, Coriolis pieno, correnti calde della Linea fra
   400 e 645 m di quota. Modello in prima persona: traversa, guanti, montanti, tela
   in alto ai bordi dello schermo, nappina rossa che pende dalla parte della
   gravità apparente (Coriolis incluso) e anticipa il rollio.
8. **Segnaposto**: Corbella con 30 rustici in gneiss e tetti in piode, il campanile
   bianco di San Vigilio con la palina bianca e rossa, la chiesa, ~600 tratti di
   muro a secco sui gradoni (con varchi), lampioni della piazza. Ci sono anche due
   frazioni e quattro gruppi di cascine sparse nelle altre valli (luci notturne),
   7 barche a vela rossa sul lago, la Lanterna di piombo sul Sordo e il Mozzo Sud.
   I castagni (5143) sono in 3 LOD istanziati, con collisori sui tronchi.
9. **Prestazioni**: 40-115 chiamate di disegno nelle inquadrature di prova (budget
   < 300), istanze per alberi e nubi, geometrie unite per paesi e costoloni, frustum
   culling per chunk, LOD per terreno e alberi.

## Numeri misurati

Fisica (test in `tests/`):

| Grandezza | Valore |
|---|---|
| gravità sul fondo | 9.805 m/s² = 0.9999 g (omega = 2π/51) |
| gravità a 300 m | 0.535 g (5.25 m/s²) |
| mezza g | a 322.9 m |
| salto da fermo a 1 g | 1.31 m (5.0 m/s), più del doppio a 0.3 g |
| Coriolis, palla lanciata in su | devia a Mane (est); correndo a Mane si pesa di più |
| caduta libera da 120 m (riferimento rotante) | coincide con la retta inerziale a 0.01° |
| salto verticale | atterra a Mane (corda inerziale 2β contro rotazione sin 2β), meno con il 40% |
| planata a 1 g | efficienza 5-10, 11-14 m/s (test); 10 s nella build: -21 m, +117 m, 11.8 m/s |
| attraversamento del cielo | da 470 m (0.27 g) sopra Valle 1 si atterra nel Verbanetto (test con pilota automatico) |
| camminata | 4.2 m/s (8.2 m in 2 s nella build), corsa 7.2 m/s |

Rendering e costi (build E2E in Chromium headless, SwiftShader, 1280 × 720):

| Inquadratura | Chiamate | Triangoli | LOD terreno (0/1/2/3) | Alberi (vicini/medi/lontani) |
|---|---|---|---|---|
| 01 paese | 71 | 519 k | 3/8/46/69 | 12/1572/3559 |
| 02 asse | 115 | 524 k | 5/12/34/75 | 9/743/4391 |
| 03 planata | 70 | 364 k | 0/4/73/49 | 0/0/5143 |
| 04 finestra | 39 | 381 k | 1/8/35/82 | 0/822/4321 |
| 05 notte | 51 | 507 k | 4/7/47/68 | 24/1416/3703 |
| 06 matita | 50 | 578 k | 3/7/42/74 | 233/1201/3709 |

- Avvio (build E2E, fino a `__GAME_READY__`): ~1.2-1.5 s; `ensureLoaded()` dalla piazza: ~290 ms.
- Costruzione di un chunk (Node): LOD0 ~150 ms (11 379 vertici, 23 k triangoli),
  LOD1 24 ms, LOD2 8 ms, LOD3 2 ms. Nel gioco si costruisce a fette con 5 ms per fotogramma.
- Quota del terreno: ~3 µs per campione analitico, ~0.6 µs per `groundHeight` (cache).
- Simulazione: < 0.01 ms per passo a 60 Hz. Preparazione CPU di un fotogramma: 12-19 ms
  in SwiftShader (comprende LOD, alberi e lumi; il tempo GPU reale va misurato su hardware vero).
- Mondo: 126 chunk di terreno, ~5 900 collisori, 228 lumi, bundle 647 kB (174 kB gzip).
- Test: 59 test in 7 file, tutti verdi (`npm test`, ~1 s).

## Problemi noti e limiti

- **Prestazioni su GPU vera non misurate**: SwiftShader non dice nulla sugli fps. Lo
  shader del mondo è pesante (4 letture della texture delle celle, rumori per la
  pennellata triplanare, matita). Se su Iris Xe non regge: abbassare `renderScale`,
  calcolare la matita solo dove `paint < 1` a bassa risoluzione, cuocere la
  pennellata in una texture di rumore, ridurre i LOD lontani.
- **Niente ombre**: la luce è radiale per frammento e una shadow map direzionale non
  va bene. Manca anche l'occlusione a macchia sotto alberi e case (è il prossimo
  passo economico).
- **Costruzione del terreno sul thread principale** (a fette): passarla a un Web
  Worker. La mesh dei Tappi vicino all'asse ha triangoli molto piccoli (spreco
  modesto).
- **Collisori semplici**: scatole e cilindri verticali, niente soffitti né falde
  inclinate. I tetti hanno collisori alti a metà falda. Si può salire sui muri bassi
  e sui tetti.
- **Velo**: l'attraversamento del cielo richiede la tecnica "chiudi vicino all'asse,
  riapri e picchia nella fascia delle correnti". Le correnti sono un campo radiale
  semplice (`VELO_TUNABLES`), da progettare meglio con il level design.
- **Matita**: il raggio "vicino sempre dipinto" (70-150 m) nasconde la matita
  vicina. Lo screenshot 06 lo riduce a 6-14 m solo per l'inquadratura ravvicinata.
  Ci sono stati bianco/matita/dipinto ma non ancora i "segnali vivi" a colori sulla
  matita, a parte i lumi notturni.
- **Lago**: niente inclinazione per Coriolis, niente riflesso dipinto del mondo
  rovesciato, niente sott'acqua né nuoto.
- **Finestre**: la Meta passa ma non c'è il "gobo" che spazza il mondo; la Luna è
  pronta ma spenta (`windows.uniforms.uMoonOn`).
- **Segnaposto**: case, campanile, muri, alberi, barche e cascine sono forme
  semplici da sostituire (modulo oggetti). Le frazioni e le cascine sparse sono
  definite in codice (`PLACEHOLDER_HAMLETS` in `scene/village.ts`), non in
  `layout.json`.
- I muri a secco seguono i gradoni in modo approssimato (segmenti sulle alzate).
  In qualche punto la pendenza del terreno affiora dal muro.
- In SwiftShader `gl.finish()` non blocca, quindi il "tempo di un fotogramma" negli
  screenshot misura solo la CPU.

## Su che cosa costruire (API esatte)

### Coordinate e fisica — `src/world/cylinder.ts`
```ts
cylToWorld(z, thetaDeg, h, out?) : Vector3        // punto a quota h sopra il fondo
worldToCyl(p, out?) : { z, theta, r, h }          // theta in [0,360)
localFrameAt(p, out?, fallbackTheta?) / localFrameTheta(theta) : { up, east, north }
upAt(theta), eastAt(theta), wrapDeg, deltaDeg, arcLength, surfaceDistance
centrifugal(p), coriolis(v), apparentAcceleration(p, v, coriolisFactor = 1)
gravityAtHeight(h), gravityInG(h), heightForGravity(g)
rotatingToInertialDir(d, t)                        // per cielo, Meta, Luna
```
Costanti in `src/world/constants.ts` (`R`, `L`, `OMEGA`, `G_FLOOR`, `LAYOUT`, `CELL_*`).

### Terreno — `src/world/terrain.ts`
```ts
surfaceHeight(z, theta, masks?)   // quota analitica (mesh); masks: paese, piazza, riale, lago, Tappi...
groundHeight(z, theta)            // quota della fisica (coerente con la mesh LOD0 + costoloni)
surfaceNormal(z, theta, out?)     // normale mondo
slopeAt(z, theta), forestDensity(...), stripAt(theta), isWindowTheta(theta), WATER_HEIGHT
```

### Mondo — `src/world/world.ts` (`game.world`)
```ts
world.setCellState(cellId, CellState.Painted | Pencil | Blank)   // subito
world.revealCells(ids, { z, theta })   // animazione dall'origine (caposaldo), ~2.2 s
world.cellAt(z, theta), world.cellsInRadius(z, theta, r)
world.cells.onChange(fn)               // oppure bus 'cells:changed'
world.colliders.add(boxAt(z, theta, hBase, yawDeg, width, height, depth, tag))
world.colliders.add(cylinderAt(z, theta, hBase, radius, height, tag))
world.heightAt(z, theta), world.groundAt(z, theta)
```

### Oggetti nuovi nello stile del gioco
- Materiale: `createWorldMaterial(game.uniforms, { kind: 'object', tint?, noPencil?, brush? })`.
  Riceve luce della Linea, bande, pennellata, foschia, matita/colore e notte.
- Geometria: attributo `aColor` vec4 (rgb in sRGB 0..1, a = emissione notturna 0..1
  per le finestre accese). `aTint` vec3 per istanza se `tint: true`.
- Piazzamento: `surfaceMatrix(z, theta, h, yawDeg, sx, sy, sz)` (locale +Y = su,
  -Z = davanti, yaw 0 = nord). Si possono unire più pezzi con `GeomBuilder` + `PRIMS`.
- Lumi: `game.lamps.addLamps([Vector3...])`.

### Giocatore — `src/player/`
```ts
game.player.teleport(z, theta, height = 0, absolute = false)
game.player.pos / vel / cyl / mode ('walk'|'air'|'glide') / grounded / veloOpen
game.player.options = { coriolisOnFoot: 0.4, fullPhysics: false, thermals: 0..1 }
PLAYER_TUNABLES, VELO_TUNABLES (tunables.ts)
game.rig (CameraRig): forward(), screenUp(), right(), look(dYaw, dPitch, up)
```

### Eventi — `game.bus` (`src/core/events.ts`)
`player:jump`, `player:land {speed, hard}`, `velo:toggle {open}`,
`player:interact {z, theta, h}` (tasto E), `cells:changed`, `sky:dawn`, `sky:dusk`,
`debug:freecam`.

### Tempo e cielo
`game.clock` (`WorldClock`: `hours`, `setHours`, `dayLengthMinutes`, `timeScale`,
`running`, `times`), `game.sky` (`SkyState`: `lineaIgnite`, `night`, `sunIntensity`,
`tiltAlpha`/`tiltBeta`...), `game.simTime` (orologio di simulazione per le animazioni).

### Debug — `window.__GAME__` (dev e `VITE_E2E=1`)
`teleport(z, θ, height?, absolute?)`, `look(yaw, pitch)`, `lookAt(z, θ, h)`,
`setTime(h)`, `getTime()`, `setTimeScale(k)`, `setClockRunning(on)`, `setSimTime(t)`,
`setFreeCamera(on)`, `toggleFreeCamera()`, `setCamera(z, θ, h, yaw, pitch)`,
`getPlayerState()`, `step(n)`, `pause()`, `resume()`, `stopLoop()`, `startLoop()`,
`startGlide(speed)`, `holdKey(code, down)`, `setCellState(id, s)`,
`revealCells(ids, origin)`, `cellAt(z, θ)`, `cellsInRadius(z, θ, r)`,
`ensureLoaded()`, `render()`, `timedRender()`, `capture()`, `getStats()`,
`setSetting(key, value)`, `game`.

## Prossimi passi consigliati

1. Misurare gli fps su un portatile con Iris Xe o Radeon 680M: guardare in su da
   Corbella con metà cielo a matita (è la soglia del concept) e regolare scala di
   rendering e LOD.
2. Spostare la costruzione dei chunk in un Web Worker.
3. Aggiungere l'occlusione a macchia sotto alberi e case, e il gobo della Meta.
4. Leggere i luoghi da `content/luoghi.json` per piazzare capisaldi e pilastri
   (segnali alti 8-10 m), il castagno morto, la Cripta e le varianti delle particelle mobili.
5. Mettere i segnali vivi a colori sulla matita (fumo, vele, lumi) e le Fade notturne
   (lumi che danzano).
6. Fare l'acqua giocabile (barca, nuoto) con la stessa funzione di quota condivisa
   fra shader e TypeScript.
