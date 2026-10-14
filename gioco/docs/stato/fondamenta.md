# Stato del pacchetto: fondamenta

Costruito e verificato.

**Stato:** done

## Riepilogo

I checked the "fondamenta" package in /home/user/claude/gioco against its spec (PACCHETTI.json), the ARCHITETTURA sections it cites (1, 2, 3, 4, 5.1, 6-10, 13, 15.1, 16, 17) and the GDD sections (10.1-10.2, 11.3-11.4, 12.2, 14). I read every file rather than relying on the builder's report, and ran tests in Chromium with screenshots. The package was largely solid. I found and fixed 6 problems, verified the fixes and committed them as f066149.

Problems fixed:
1. `__GAME__.core.time.setSpeed(8)` only gave about 5× speed at 60 Hz (300 ticks/s measured), because of the 5-step-per-frame cap. In src/core/loop.ts the cap is now 5 × ⌈speed⌉. At speed 1 it stays 5. I measured 480 ticks/s at 8×.
2. Export followed by import did not give back an identical save: `stats.playMs` changed, because unwritten play time was added on the first write after the import. In src/core/bootstrap.ts that counter is now reset whenever the save data is replaced (load, import, wipe). The interfaccia package's acceptance test (deepEqual except `writtenAt`) depends on this.
3. Capacitor's native pause event did not stop the game loop; only the page's `visibilitychange` did. `platform.onPause` and `onResume` now also pause and resume the loop.
4. The `audio:unlocked` event was sent only once per session. If the first tap unlocked the placeholder audio before the audio package had registered, the real engine never got the event. src/core/input.ts now sends it once per audio engine and keeps calling `unlock()` on each gesture while the engine is not running.
5. If the storage backend threw while reading a save (for example a missing native plugin), the game failed to start. In src/core/save/save.ts that key is now treated as absent.
6. Pinch zoom and double-tap zoom were not blocked on iOS Safari, which ignores `user-scalable=no` (GDD 11.1). Added `touch-action: pan-x pan-y` on `html` and `body` in base.css, and blocked `gesturestart` in input.ts.

Other changes:
- New tests: 8× speed, backend that throws, audio unlock across two engines (tests/unit/core/audio-unlock.test.ts), the ARCHITETTURA 14 example data passing `validateContent` with no false errors, and an export/import identity test in tests/e2e/smoke.spec.ts.
- README notes: `setSpeed` now accelerates by the full factor, and a scene's `enter()` must not `await` a scene change (it would wait on itself forever).
- The comment on `onAudioRegistered` in services.ts was wrong and is corrected.

Checked and fine as built: types.ts is identical to ARCHITETTURA 4. capacitor.config.ts, package versions and npm scripts, tsconfig, vite and playwright configs, index.html and .gitignore follow the spec. Gesture thresholds, key map, modal input layers, Back-button chain, safe area, wide/narrow layout, 2 s save batching with checksums and alternating slots, i18n, rich text without innerHTML, settings, the core debug API, `validateContent` and the boot scene all behave as specified. In the browser I confirmed drag, wheel, right-click, long press (mouse and touch), Tab keeping focus inside the game, Esc closing an overlay, a save on hidden page, a live layout change from 1180×820 to 390×844, and a dev server with no console errors.

Screenshots are in /tmp/claude-0/-home-user-claude/c3e3ef47-6c71-52f7-905c-1c8a39dab6eb/scratchpad/verify-fondamenta/: iphone-boot.png, iphone-overlay.png, iphone-toast.png, desktop-en.png, android-hc.png.

## Decisioni prese

- Registrazione dei pacchetti: import.meta.glob('./*/register.ts') in modalità pigra (non eager), caricati in ordine alfabetico DOPO la creazione dei servizi. Ogni register.ts può esportare register(services) (o default, anche async) oppure lavorare al caricamento. Con eager gli import verrebbero eseguiti prima del corpo di main.ts, quando i servizi ancora non esistono.
- Safe area: il probe usa max(env(safe-area-inset-*), var(--safe-area-inset-*)) invece di env(…, var(…)), perché Chrome definisce sempre env() (anche a 0) e la riserva non verrebbe mai usata. Su <html> ci sono anche i token --safe-top/right/bottom/left.
- Gesti: il trascinamento parte oltre 8 px, quindi un tap riuscito si sposta al massimo 8 px (il limite di 10 px vale per la pressione lunga). Il tasto destro e il centrale del mouse danno solo un tap con il loro button, senza trascinamento.
- Sblocco audio: audio.unlock() si chiama in modo sincrono al pointerdown, al pointerup (per il tocco è l'evento che dà l'attivazione utente) e al keydown, finché audio.state() non è 'running'. Il core emette 'audio:unlocked' una volta.
- Tastiera: Invio → confirm, Spazio → crossL, Maiusc+Spazio → crossR, Tab → notebook, Maiusc+Tab → tab, Backspace/Z/Ctrl+Z → undo, Esc → back, P → pause, S → skip, A → auto, H, N, F, frecce e pagine ripetibili, 1-6 → select con index. Su un controllo con il fuoco Invio, Spazio e frecce restano al browser; nei campi di testo solo Esc. Se nessuno usa Tab, il fuoco gira dentro #ui-root (o dentro l'overlay o la conferma aperta) senza uscire dal gioco.
- Livelli modali: un gestore onAction/onGesture appartiene al livello in cima al momento della registrazione; quando il livello si chiude i suoi gestori sono scartati.
- Dissolvenza: 100 ms in uscita + 100 ms in entrata (200 ms in tutto), nessuna con velocità istantanea o movimento ridotto. Le scene ricevono update, render e resize solo dopo la fine di enter().
- openOverlay restituisce una Promise che si risolve alla chiusura dell'overlay; ogni overlay ha un pulsante di chiusura e un pannello non registrato mostra un segnaposto (anche mountPanel).
- Il manifest degli asset si chiede solo se public/assets/manifest.json esiste al momento della build o dell'avvio del server di sviluppo (costante __ASSET_MANIFEST__), così senza manifest non ci sono 404 in console. I percorsi nel manifest sono relativi a public/assets/.
- Debug: attivo in sviluppo, con VITE_E2E=1, e con ?debug=1 solo sul web (mai in nativo). Con il debug attivo ?lang=it|en sceglie la lingua all'avvio. Oltre a 15.1, core espone validate, flush, scenes, packages, version, overlays, openOverlay, closeOverlay, toast, time.now/ticks/paused/speed, input.tap/drag/action/layers/lastDevice.
- La conferma d'uscita (fine della catena di Indietro) compare solo su nativo e solo nelle scene 'titolo' o 'boot'.
- Entitlements: sul web sempre sbloccato; in nativo sbloccato finché non si registra un fornitore (setProvider) per gli acquisti.
- Lingua predefinita: italiano se il browser è in italiano o non dichiara lingue, inglese per tutte le altre (la storia ripiega sull'italiano). Playwright gira con locale it-IT.
- Aggiunte come dipendenze @capacitor/share 8.0.3 (share sheet nativo per il testo, GDD 8.3) e happy-dom (ambiente DOM per i test unitari, con il commento // @vitest-environment happy-dom).
- Validazione: messaggi per gli sviluppatori in inglese nella forma '<dove>: [<classe>] <descrizione>'. Con un database vuoto non segnala nulla. Un filo persona/avorio/nero senza personaggio è ammesso se ha un labelKey (fili d'Archivio come 'il fornaio').
- rngFromSeed: xmur3 → 4 semi → sfc32 con 15 estrazioni di riscaldamento; shuffle restituisce una copia mescolata (non modifica l'originale).
- webServer di Playwright: 'npm run build && npx vite preview --host 127.0.0.1 --port $E2E_PORT --strictPort' (4173 di default) invece di 'npm run preview', per la porta configurabile e strictPort.
- Attributi su <html>: data-contrast='alto|normale', data-motion='ridotto|normale', data-anim-speed, --text-scale, --anim-speed, lang.
- setSpeed(x) > 1: the per-frame step cap becomes 5 × ⌈x⌉, so the 8× speed tests use (ARCHITETTURA 6) is real. At speed 1 the cap stays 5, as in the doc.
- Unwritten play time (the stats.playMs accumulator) is reset when the save is replaced in bulk (load, import, wipe): time played before an import does not belong to the imported save, and export → import stays identical.
- audio:unlocked is sent once per audio engine rather than once per session: the placeholder and the real engine registered later each get their own event. unlock() is still called on every gesture while the engine is not running.
- Pinch zoom is blocked with touch-action: pan-x pan-y on html and body plus preventDefault on gesturestart, because iOS Safari ignores user-scalable=no. Scrolling and sliders still work.
- Native pause and resume also pause and resume the loop; resume only unpauses if the document is visible.

## Problemi noti

- The export string is not gzip-compressed. ARCHITETTURA 9 allows the uncompressed fallback, and SaveService.exportString/importString are synchronous by contract while CompressionStream is async only. Format: TRAMA-SAVE-1: + base64url of the {v,sum,data} envelope.
- npm run ci needs tools/levels/check.ts (motore package) and the other e2e suites (piattaforma-qa). Today only build, unit tests and the smoke test can run.
- A save is loaded from the valid slot with the latest writtenAt (ties go to 'ultimo'). If the device clock moves backwards between two writes, the older slot could be picked. The frozen format has no write counter to rule this out.
- Packages are registered with a lazy import.meta.glob('./*/register.ts') instead of eager as written in ARCHITETTURA 3.1. This is deliberate (packages are always loaded after the services exist) and is documented in the README.
- A scene that does `await services.scenes.go(...)` inside its own enter() blocks forever, because scene changes are queued. This is documented in the README; the right pattern is `void scenes.go(...)`.

## Richieste per altri pacchetti

- **audio**: Chiamare registerAudio(engine) da src/audio/register.ts (export function register(services)). Il core chiama engine.unlock() in modo sincrono a ogni pointerdown, pointerup e keydown finché engine.state() !== 'running': unlock() deve essere idempotente e deve riprendere un contesto sospeso. L'evento 'audio:unlocked' lo emette già il core (una volta): non riemetterlo. Le didascalie 'audio:caption' le mostra il core in basso a sinistra se settings.captions è attivo.
- **asset-blender**: La scena boot chiede esattamente EXPECTED_FRAMES/EXPECTED_IMAGES di src/core/assets.ts: fuso/{teresa,marta,piero,gino,bepi,nina,zeno,lunardi,livia,ada,clotilde,lino,stile_1,stile_2}, fig/{teresa,marta,piero,gino,bepi,nina,zeno,lunardi,livia,ada,lino}/{ferma,porge,saluta} (niente figurine di Clotilde), fig/ada/{ferma,porge,saluta}_grezza, obj/{tombolo,bottiglia,forbici,libro,fuso_faro,fascio_lettere}, dio/{7 luoghi}/{alba,giorno,notte}, tab/{sedia_vuota,tempesta,secca,sacrestia_lettere}. Nel manifest i percorsi (atlases[].image, images[].src) sono relativi a public/assets/; le immagini singole hanno group 'dio' o 'tab', gli atlas sono il gruppo 'core'. La presenza del manifest si legge alla build (o all'avvio del dev server): dopo averlo generato bisogna rifare la build. Se volete public/icons/favicon.png come favicon, chiedete a fondamenta di collegarlo in index.html (oggi c'è un SVG inline per non avere 404).
- **tutti**: Ogni src/<pacchetto>/register.ts va caricato dopo i servizi: esportare register(services) (o default) oppure lavorare al caricamento; usare services solo da lì in poi. Nei test unitari popolare i servizi con installServices({...}) (vedi tests/unit/core/helpers.ts). Nel DOM: #ui-root lascia passare i tocchi, quindi i contenitori che devono ricevere eventi vanno marcati con la classe core-solid (i controlli nativi li ricevono già); mettere il DOM delle scene in services.ui.sceneRoot (CoreUiLayer) o in ui.root; usare data-test stabili e i componenti di src/core/ui/components.ts (textOf si ritraduce da solo al cambio di lingua). Icone di personaggi e luoghi: src/core/ui/glyphs.ts (svgIcon per il DOM, drawGlyph/glyphPath per il canvas). Elenchi degli identificatori a runtime: src/core/ids.ts.
- **contenuti-atto1, contenuti-atti23**: validateContent (src/content/validate.ts) controlla anche: lettere con holder e to; spilli, bordi, maree e tutorial solo nelle righe giocabili (startHour+1…endHour); al massimo 14 righe; vignette con 0-3 figure, 1-2 righe e x fra 0 e 1; archive.recorded lungo endHour-startHour con hour = startHour+1+i; ogni filo in archive.faded ha una risposta, e la risposta è fra i candidati; i fili con nome senza CharacterId devono avere un labelKey; in condizioni e richieste dei bigliettini fili, perline (anche 'letta:<lettera>', 'nome', 'febbre') e luoghi devono esistere nel livello del giorno; ogni textKey/labelKey/titleKey deve esistere in italiano. Il file del livello deve chiamarsi come il suo id.
- **piattaforma-qa**: playwright.config.ts: E2E_PORT cambia porta (4173 di default), E2E_REUSE=1 riusa un server già avviato (altrimenti si rifà sempre la build con VITE_E2E=1, quindi __GAME__ è sempre attivo). baseURL è 'http://localhost:4173/?debug=1': page.goto('') mantiene la query, page.goto('/') no (ma il debug resta attivo con VITE_E2E). ?lang=en forza la lingua all'avvio. Helper utili in __GAME__.core: openOverlay, closeOverlay, overlays, toast, validate, flush, time.now/ticks, input.tap/drag/action/layers. Locale predefinito dei test: it-IT. Per simulare la safe area basta impostare --safe-area-inset-* su document.documentElement.style (il viewport si aggiorna da solo in circa 50 ms; core.viewport() rilegge subito).
- **motore**: Usare src/core/rng.ts (rngFromSeed con xmur3 → sfc32 e 15 estrazioni di riscaldamento; shuffle restituisce una copia). Il tsconfig unico include i tipi di Node, quindi tools/levels può importare 'node:fs'; tsx è installato.
- **contenuti-atto1, contenuti-atti23**: src/content/loader.ts expects these shapes: JSON arrays for characters.json, places.json, book.json, lines.json, endings.json (EndingDef[]), notes.*.json, diary.*.json and lettere.*.json; JSON objects for campaign.json, balance.json, credits.json, levels/<id>.json (LevelDef, file name equal to id) and levels/<id>.computed.json (LevelComputed, levelId equal to the file name). Every vignette needs at least one line (at most 2) and at most 3 figures.
- **audio**: The core sends 'audio:unlocked' once per engine: if the first tap arrives before registerAudio(), the real engine receives its own event on the first gesture after registration. The core calls unlock() synchronously on every pointerdown, pointerup and keydown while state() !== 'running', so unlock() must be idempotent and must resume a suspended context.
- **tutti**: Do not `await services.scenes.go(...)` inside a scene's enter(): changes are queued and it would block forever. Use `void scenes.go(...)`. In e2e tests, __GAME__.core.time.setSpeed(8) now really runs at 8×.

## Test

npx tsc --noEmit -p . → no errors
npx vitest run → 20 files, 174 tests passed (before the fixes: 19 files / 170 tests)
npm run build → tsc ok, vite build ok (index JS 116.14 kB / 41.20 kB gzip, CSS 15.8 kB)
E2E_PORT=5205 npx playwright test tests/e2e/smoke.spec.ts → 30/30 before the fixes; after the fixes 35/35 passed (7 tests × 5 projects)
npx cap config → exit 0
Manual Playwright script (vite preview on 5206) against the build before the fixes: confirmed setSpeed(8) = 300 ticks/s and export/import differing in stats.playMs. Against the build after the fixes: 480 ticks/s and only writtenAt differs. Also checked mouse/touch drag, wheel, right-click, long press, Tab focus staying in the game, Esc closing an overlay, hidden page → app:pause + save:written + loop paused, import of an invalid string → core.save.import.formato.
Dev server (vite on 5207): starts with no console errors; layout switches largo → stretto from 1180×820 to 390×844 without reload.
Screenshots checked: iphone-boot.png, iphone-overlay.png, iphone-toast.png, desktop-en.png, android-hc.png in scratchpad/verify-fondamenta/. All servers on 5205-5207 were stopped.

## Integrazione

Richieste di docs/stato/RICHIESTE.md per **fondamenta** e **tutti**, controllate sul codice attuale (14 ottobre 2026).

| Richiesta | Esito |
|---|---|
| audio: script `audio:verify` e funzioni di `__GAME__.audio` nel README | **Fatto.** Script in package.json; elenco delle funzioni nel README (sezione Debug). |
| tombolo: script `tombolo:verify` | **Fatto.** |
| interfaccia: script `screens:verify` | **Fatto.** Aggiunto anche `campaign:verify` (stesso schema; il file esiste già). |
| motore: opzioni di `levels:check` nel README (`--dir`, `--report`, `--only`, `--no-write`, `--voluta`, `npm_config_dir`, uscita 0 senza contenuti, coppie, `@filo`, `--voluta` che copre le combinazioni più grandi) | **Fatto.** Paragrafo «levels:check» nel README. |
| piattaforma-nativa: `native:check` e `native:test` nello script `ci`, rimando a docs/STORE.md e a Xcode 27 / 26.3 | **Fatto.** `ci` = build, test, levels:check, native:check, native:test, test:e2e. Il README rimanda a STORE.md 2.3 (Xcode 27 su macOS Tahoe 26.6+, Xcode 26.3 su Sequoia 15.6+). Gli script nativi non sono stati toccati. |
| asset-blender: favicon PNG in index.html, manifest web con icon-192/512 | **Fatto.** `<link rel="icon" type="image/png" href="/icons/favicon.png">` al posto dell'SVG in linea, `apple-touch-icon` (192) e `public/manifest.webmanifest` (nome, colori del velluto, `display: fullscreen`, icone 192 e 512). Vite riscrive i percorsi in `./…` (base relativa), quindi funziona anche nella WebView. |
| asset-blender: riga `core.boot.asset.segnaposto` anche senza asset mancanti | **Fatto.** In src/core/boot.scene.ts la riga (`data-test="boot-segnaposto"`) compare solo se `assets.missing()` non è vuoto; si aggiorna ogni secondo con l'elenco. Test: tests/unit/core/boot.test.ts. |
| asset-blender: ancora del fuso segnaposto `ay: 0.05` contro 0,125 del fuso vero | **Fatto.** `placeholderSpec('fuso/…')` dà `ay: 0.125` (`FUSO_ANCHOR_Y`) e il disegno del segnaposto è stato portato nella stessa fascia verticale del fuso vero (testa da circa 0,11, pomolo fino a circa 0,97): il filo si attacca in cima alla testa con e senza asset (confronto visivo nel browser). Test in tests/unit/core/assets.test.ts, anche contro le ancore del manifest vero. |
| interfaccia: `platform.share` in nativo ignora `file` | **Fatto.** Installato `@capacitor/filesystem` 8.1.4 (compatibile con Capacitor 8.5.x, porta con sé solo `@capacitor/synapse`; import dinamico, sul web non si scarica). In nativo `share()` usa il plugin Share: il PNG si scrive in base64 nella cache dell'app (`condivisi/<nome>`, la cartella si svuota a ogni condivisione) e si passa `files: [uri]`. Se Filesystem manca o la scrittura fallisce si condivide il testo; se il plugin Share non è registrato nel progetto nativo («not implemented») si prova la Web Share API della WebView; annullato → `false` (le schermate copiano il testo). Su Android il FileProvider `${applicationId}.fileprovider` con `cache-path` c'è già. Test: tests/unit/core/platform-native.test.ts (Capacitor finto). |
| audio (verifica:interfaccia): orologio nel titolo | **Fatto** (vedi docs/stato/audio.md). Richiede un'aggiunta compatibile a `types.ts`: `setAmbience(a, fadeMs?, o?: { clock?: boolean })`. È F che applica le modifiche a types.ts (ARCHITETTURA 3.2): il terzo parametro è facoltativo, quindi chiamanti e implementazioni esistenti (stub, motori finti dei test) restano validi senza modifiche. |
| tutti: register(services), core-solid, data-test, componenti, glifi, ids | Indicazioni generali, già seguite da audio e schermate. Niente da fare. |
| tutti: niente `await scenes.go(...)` dentro `enter()` | Controllato: in src/screens, src/audio e src/core l'unico `await scenes.go` è nella funzione di debug `ui.open` e nel `goto` del debug del core, fuori da `enter()`. |

**Nota sui progetti nativi.** I file generati da Capacitor in android/ e ios/ (capacitor.settings.gradle, capacitor.build.gradle, CapApp-SPM/Package.swift) non elencano ancora Filesystem: non sono di questo gruppo e non li ho toccati. Tutti gli script che compilano l'app (`app:*`, `android:apk`, `release:*`) fanno `cap sync` prima, quindi il plugin entra da solo; finché non succede, la condivisione nativa ripiega sul solo testo. Va fatto `npx cap sync` e il commit di quei file (richiesta a piattaforma-nativa).

**Test.** `npx tsc --noEmit -p .`: nessun errore. `npx vitest run`: 74 file, 1002 test verdi (di questo gruppo: core 22 file, audio 15, schermate 6, 433 test, compresi i nuovi). `npm run native:check`: 40/40; `npm run native:test`: 59/59 in 9 s. Build `VITE_E2E=1` servita da `vite preview` sulla porta 5400: `E2E_REUSE=1 E2E_PORT=5400 npx playwright test tests/e2e/smoke.spec.ts` 35/35 (avvio pulito, solo richieste locali, con il manifest); sonda Playwright (scratchpad/integ-core/probe.mjs) 13/13: favicon PNG, manifest e icone 192/512 servite con 200, nessun errore in console, nessuna risposta ≥ 400, scena boot senza la riga dei segnaposto con tutti gli asset. Confronto visivo fuso segnaposto / fuso vero sul server di sviluppo (porta 5401, chiuso subito): stessa ancora, stessa altezza.
