# TRAMA. Il merletto dei giorni

Puzzle narrativo a fuselli: TypeScript + Vite per il web, Capacitor per iOS e Android.
Il progetto vive tutto in questa cartella (`gioco/`); il resto del repository è un altro sito.

- Design, regole e storia: [`docs/GDD.md`](docs/GDD.md)
- Architettura, tipi condivisi, pipeline: [`docs/ARCHITETTURA.md`](docs/ARCHITETTURA.md)
- Ricerca e motivazioni: [`docs/RICERCA.md`](docs/RICERCA.md)

## Requisiti

- Node 22 o successivo, npm 10.
- Per i test end-to-end: Chromium di Playwright 1.56.1 (nel container è in `/opt/pw-browsers`).
- Per gli asset 3D: Blender 5.2 come modulo Python (`BLENDER_PY`), vedi `tools/blender/README.md`.
- Per le app native: Android Studio 2025.2.1+ e/o Xcode 26+. Guida completa agli store, dal
  Mac nuovo alla pubblicazione: [`docs/STORE.md`](docs/STORE.md). Per Xcode (sezione 2.3): la
  versione dell'App Store è Xcode 27 e vuole macOS Tahoe 26.6 o successivo; su macOS Sequoia
  15.6+ si usa Xcode 26.3 (dal sito Apple Developer), che basta perché Apple chiede Xcode 26.

## Comandi

```bash
npm install          # dipendenze
npm run dev          # server di sviluppo (vite --host)
npm run build        # typecheck (tsc) + build in dist/
npm test             # test unitari (Vitest)
npm run test:e2e     # test end-to-end (Playwright, 5 dispositivi)
npm run ci           # build + test + levels:check + native:check + native:test + test:e2e
```

| Script | Comando |
|---|---|
| `dev` | `vite --host` |
| `build` | `tsc --noEmit && vite build` |
| `preview` | `vite preview --host --port 4173` |
| `test` | `vitest run` |
| `test:e2e` | `playwright test` |
| `levels:check` | `tsx tools/levels/check.ts` (solver: verifica i livelli, scrive i `.computed.json`) |
| `audio:verify` | `tsx tests/unit/audio/browser-verify.ts` (prova dell'audio in Chromium) |
| `tombolo:verify` | `tsx tests/unit/tombolo/browser-verify.ts` (prova del tombolo in Chromium) |
| `screens:verify` | `tsx tests/unit/screens/browser-verify.ts` (prova delle schermate in Chromium) |
| `campaign:verify` | `tsx tests/unit/campaign/browser-verify.ts` (prova della campagna in Chromium) |
| `assets:render` | `bash tools/blender/render_all.sh` (Blender, Cycles su CPU) |
| `assets:native` | `capacitor-assets generate …` (icone e splash nativi da `assets/`) |
| `app:sync` | `npm run build && cap sync` |
| `app:android` / `app:ios` | build, sync e apertura in Android Studio / Xcode |
| `app:run:android` / `app:run:ios` | build e avvio su dispositivo o emulatore |
| `android:apk` | APK di debug (`scripts/android-build.sh assembleDebug`) |
| `release:android` / `release:ios` | pacchetti firmati per gli store |
| `native:check` | `node scripts/check-native.mjs` (impostazioni dei progetti nativi; né SDK né rete) |
| `native:test` | `bash scripts/test-native.sh` (script nativi con strumenti finti, meno di un minuto) |
| `ci` | verifica completa: `build`, `test`, `levels:check`, `native:check`, `native:test`, `test:e2e` |

**`levels:check`.** Opzioni: `npm run levels:check -- --dir <cartella> --report --only <id,id>
--no-write --voluta <livello>:<nota>+<nota>` (`--voluta` si ripete). Funziona anche
`npm run levels:check --dir X` (npm passa la cartella come `npm_config_dir`). Si calcolano
tutte le combinazioni di bigliettini da 2 fino al numero di spilli, coppie comprese; nel
`--report` il filo del nome si vede con `@filo`. Una `--voluta` su una coppia vale anche per
le combinazioni più grandi che la contengono. Senza contenuti esce con 0, quindi `npm run ci`
non si ferma lì.

**Prove nel browser (`*:verify`).** Non sono test Vitest: aprono Chromium di Playwright
(1.56.1, in `/opt/pw-browsers` nel container) e avviano da sé un server sulla loro porta
(audio 5220, tombolo 5241, schermate 5271, campagna 5281: si cambiano con
`<PACCHETTO>_VERIFY_PORT`). Con `<PACCHETTO>_VERIFY_URL=http://127.0.0.1:4173/` usano un server
già avviato: meglio una build `VITE_E2E=1 npx vite build` servita da `npx vite preview`,
perché il server di sviluppo ricarica la pagina quando qualcuno modifica i file.

**Build e budget.** `vite build` divide il pacchetto principale in `contenuti` (JSON dei livelli
e dei dati), `testi` (i18n e testi narrativi) e `motore` (`build.rolldownOptions.output.codeSplitting`
in `vite.config.ts`): nessun pezzo supera il limite di 600 KB e la build non dà avvisi del
gioco (un avviso che nomina il codice di un pacchetto in lavorazione è di quel pacchetto).
L'avviso `PLUGIN_TIMINGS` di Rolldown è spento (`checks.bundlerTimings: false`): misura solo la
lentezza della macchina (il plugin dei Worker di Vite), non il gioco.
Budget CSS: **al massimo 30 KB in gzip in tutto** (oggi circa 18 KB in cinque fogli: core,
tombolo, campagna, schermate, audio); si misura con `gzip -c dist/assets/*.css | wc -c`.

**Senza rete (service worker).** La build scrive `precache.json` (versione del gioco, un
identificativo della build, l'elenco dei file: index, chunk, CSS, font `.woff2`, Worker, file di
`public/` come `assets/manifest.json` con atlanti e diorami, icone) e mette l'identificativo in
`index.html` (`<meta name="trama-build">`). `src/main.ts` registra `sw.js?v=<versione>-<build>`
solo sul web e non in sviluppo (`src/core/sw.ts`); `public/sw.js` mette tutto nella cache
`trama-<versione>-<build>`, cancella le vecchie, risponde solo alla stessa origine: pagine prima
dalla rete, il resto prima dalla cache. Dopo il primo caricamento si gioca senza rete.

Test end-to-end: il server di prova è `npm run build && vite preview` sulla porta **4173**
(build con `VITE_E2E=1`, quindi `window.__GAME__` sempre attivo). Variabili utili:
`E2E_PORT=5201` per usare un'altra porta, `E2E_REUSE=1` per riusare un server già avviato.
Mai `--use-angle=swiftshader`.

## Struttura

```
src/main.ts            avvio (ARCHITETTURA 3.1)
src/core/              servizi condivisi (fondamenta)
  types.ts             contratto fra i pacchetti (congelato)
  ids.ts               elenchi a runtime degli identificatori di types.ts
  services.ts          `services` e `registerAudio`
  bootstrap.ts         creazione e collegamento dei servizi, API di debug `core`
  events.ts loop.ts input.ts gestures.ts keymap.ts viewport.ts canvas.ts scenes.ts
  save/                salvataggi (slot alternati, checksum, migrazioni, export/import)
  i18n.ts settings.ts platform.ts haptics.ts entitlements.ts assets.ts placeholders.ts
  rng.ts debug.ts fonts.ts audio-stub.ts boot.scene.ts
  ui/                  dom.ts, components.ts, richtext.ts, glyphs.ts, layer.ts, theme.css, base.css
src/content/           contenuti JSON + loader.ts e validate.ts
src/<pacchetto>/       engine, tombolo, campaign, screens, audio: ognuno con il suo register.ts
src/i18n/<it|en>/      testi d'interfaccia, un namespace per pacchetto
public/                icons/ (favicon, 192, 512), manifest.webmanifest, assets/ (pipeline Blender)
tests/unit/<pacchetto> test unitari; tests/e2e/ test end-to-end
```

## Come si aggancia un pacchetto

Ogni pacchetto ha `src/<pacchetto>/register.ts`. Il core lo carica **dopo** aver creato i
servizi (glob `./*/register.ts`, in ordine alfabetico) e chiama la funzione esportata:

```ts
// src/tombolo/register.ts
import type { Services } from '../core/types';
import './tombolo.css';
export function register(s: Services): void {
  s.scenes.register('tombolo', () => new TomboloScene(s));
  s.debug.register('night', { state: () => …, fix: () => … });
}
```

Si può esportare `register` (o `default`), anche asincrona. `services` (da `src/core/services.ts`)
si può importare ovunque, ma va usato da `register()` in poi: prima dell'avvio dà un errore chiaro.
Il pacchetto audio chiama `registerAudio(engine)` per sostituire lo stub.

## Contratti del core in breve

**Scene.** `services.scenes.register(id, factory)` e `go(id, params, { transition: 'fade' | 'none' })`.
La scena attiva riceve `update(dt)` a passo fisso (1/60 s), `render(alpha, host)` in px CSS,
`resize(vp)`, `onAction`, `onGesture`, `onBack`. Le scene senza `render` lasciano il canvas di
velluto. All'avvio si va a `titolo` se registrata, altrimenti alla scena diagnostica `boot`.
I cambi di scena sono in fila: dentro `enter()` di una scena si può chiedere un'altra scena
(`void scenes.go('tombolo', …)`), ma **non attenderla** con `await`, perché aspetterebbe la fine
dello stesso cambio che la contiene. `__GAME__.core.time.setSpeed(x)` accelera davvero di x volte
(il tetto di passi per fotogramma cresce con x).

**Input.** Gesti (`tap`, `longpress`, `dragstart/drag/dragend/dragcancel`, `wheel`) in px CSS
relativi al canvas; tastiera mappata in `ActionEvent` secondo GDD 11.3 (tabella in
`src/core/keymap.ts`: Invio → `confirm`, Spazio → `crossL`, Maiusc+Spazio → `crossR`,
Tab → `notebook`, Esc → `back`, 1-6 → `select` con `index`, Maiusc+Invio → `skipQuiet`, «Salta le
ore quiete»…). `KEY_HELP` nello stesso file descrive la mappa per la pagina dei comandi
(`sc-comandi`, dalla Pausa): un test controlla che ogni azione di `mapKey` ci sia. `input.pushLayer(nome)` apre un
livello modale: ricevono azioni e gesti solo i gestori registrati mentre quel livello è in cima.
Indietro (Esc, tasto Android): overlay in cima → `scene.onBack()` → nel titolo, su nativo,
conferma di uscita. L'audio si sblocca al primo `pointerdown`/`pointerup`/`keydown`.

**Interfaccia.** `#ui-root` sta sopra il canvas e lascia passare i tocchi: ricevono eventi solo
i controlli e gli elementi con la classe `core-solid`. Le scene mettono il loro DOM in
`ui.sceneRoot` (o in `ui.root`). `ui.registerPanel`, `mountPanel`, `openOverlay` (si chiude con
Indietro; la Promise si risolve alla chiusura; un pannello non registrato mostra un segnaposto),
`toast`, `confirm` (pulsante sicuro a sinistra). Componenti a tema in `src/core/ui/components.ts`
(`button`, `iconButton`, `panel`, `tabs`, `slider`, `toggle`, `paperCard`, `modal`, `menuList`,
`textOf`): bersagli ≥ 48 px, fuoco visibile, testi da chiavi i18n che si riscrivono da soli al
cambio di lingua. **Carta e calligrafia** (C17): `paperCard({ hand })` dà un foglio
`.core-carta--mano` che si inclina tutto, al massimo ±3° attorno al centro (un foglio molto
alto si inclina meno, `slantForHeight`: gli angoli non si spostano più di 12 px, così una
lettera lunga non esce dai lati del contenitore che la taglia); il testo
(`.core-carta-testo`) non ruota e non prende i tocchi, quindi i pulsanti vanno fuori dal foglio,
in un contenitore fratello; `core-carta--scorre` fa scorrere le lettere lunghe dentro il foglio
(70% dell'altezza). `inkOnPaper(hex, carta = '#EDE4D3')` in `src/core/ui/richtext.ts` scurisce un
colore (stessa tinta) fino a 4,5:1 sulla carta: lo usa `.core-pers` per il nome (`--pers-ink`), il
colore pieno resta nella sottolineatura e nell'icona. Gli avvisi brevi (`toast`) non prendono i
tocchi; le didascalie dei suoni si spostano se coprirebbero un pulsante (e, se c'è posto,
anche una nota da leggere, `role="note"`). I fogli dentro gli
overlay sono opachi (`--foglio-sovrapposto`, con un colore suo in alto contrasto) e un secondo
overlay mette un velo pieno su quello sotto. Glifi (icone dei personaggi e dei luoghi, icone d'interfaccia) in
`src/core/ui/glyphs.ts`, per il DOM (`svgIcon`) e per il canvas (`drawGlyph`). Usare
`data-test` stabili sugli elementi interattivi. Prefissi CSS: `core-`, `tb-`, `cp-`, `sc-`.

**Testi.** Chiave completa `<namespace>.<percorso>`; ogni pacchetto scrive solo il proprio
namespace (`src/i18n/<it|en>/<ns>.json`, testi narrativi in `src/content/text/<it|en>/`).
`{nome}`, `{n, plural, =0 {…} one {# …} other {# …}}`, `{x, select, …}`. Nel testo ricco
(`richText(key, params)`): `*corsivo*`, `**grassetto**`, `[[teresa]]`, a capo. Mai `innerHTML`.

**Impostazioni.** Dentro il salvataggio. Su `<html>`: `--text-scale`, `data-text-scale="grande|normale"` (grande da 130%), `data-contrast="alto|normale"`,
`data-motion="ridotto|normale"`, `data-anim-speed`, `--anim-speed`, `lang`. Evento `settings:change`.

**Salvataggi.** `save.update(mut, { immediate?, reason? })`: scritture raggruppate (una ogni 2 s),
immediate quando serve; slot `trama.v1.a`/`trama.v1.b` con checksum FNV-1a; export
`TRAMA-SAVE-1:` + base64url.

**Audio.** `setAmbience(id, fadeMs?, { clock? })`: l'orologio che ticchetta c'è di serie solo
nella notte (fermo nel prologo); `clock: true` lo aggiunge a qualunque ambiente (il titolo usa
`setAmbience('laguna', undefined, { clock: true })`, GDD 9), `clock: false` lo toglie. È
un'aggiunta compatibile a `types.ts`: chi chiama `setAmbience(id)` non cambia nulla.

**Condivisione.** `platform.share({ text, title?, file?, fileName? })`: sul web la Web Share API
(con il PNG se il browser lo accetta); in nativo il plugin Share, con il PNG scritto nella cache
dell'app da `@capacitor/filesystem` (il plugin Share vuole un file su disco). Se il file non
passa, si riprova con il solo testo; se il giocatore annulla, `share()` dà `false` e il foglio
dei risultati copia il testo. Dopo aver aggiunto un plugin Capacitor serve `npx cap sync` (gli
script `app:*` e `release:*` lo fanno da soli). `@capacitor/filesystem` su iOS chiede anche, in
`ios/App/App/PrivacyInfo.xcprivacy`, la voce `NSPrivacyAccessedAPICategoryFileTimestamp` con il
motivo `C617.1` (lo dice il README del plugin; senza, App Store Connect la segnala).

**Asset.** `public/assets/manifest.json` (formato `AssetManifest`, percorsi relativi a
`public/assets/`). `assets.frame(nome)` e `assets.image(nome)` danno sempre qualcosa: se
l'asset manca, un segnaposto disegnato in codice. `assets.missing()` elenca i mancanti.
Se il manifest non esiste al momento della build, il gioco non lo chiede nemmeno.

**Debug.** `window.__GAME__` (in sviluppo, con `?debug=1`, nelle build `VITE_E2E=1`):
`ready`, `namespaces()`, `core.*` (ARCHITETTURA 15.1: `scene`, `goto`, `save`, `setSettings`,
`wipe`, `exportSave`, `importSave`, `viewport`, `events`, `emit`, `perf`, `time.pause/resume/step/setSpeed`,
`missingAssets`, `missingKeys`, più `validate`, `flush`, `openOverlay`, `closeOverlay`, `overlays`,
`toast`, `scenes`, `packages`, `version`, `time.now/ticks`, `input.tap/drag/action/layers`).
Ogni pacchetto registra il suo namespace con `services.debug.register(ns, api)`.

`__GAME__.audio` (dettagli in testa a `src/audio/register.ts`): `state()`, `log()` (ultimi 200
suoni `{ id, t, detail? }`, anche prima dello sblocco), `mute(on)`, `stats()` (sorgenti attive e
picco, pre-render con `cpuMs`, musica, ambiente, `clock` dell'orologio), `captions()`, `sfx(id)`,
`bell(ora, s?)`, `note(chi)`, `crossing(sopra, sotto, rancore?)`, `babble(chi, testo)`,
`music(stato, seme?)`, `ambience(id, orologio?)`, `duck(on)`, `stress(n)` (limitatore: picco ≤ 48),
`verify(secondi?)` (rendering offline di ogni `SfxId`), `blocked()`, `interrupt()` (poi
`[data-test="audio-tocca"]` per «Tocca per continuare»), `stonatura()`.

Gli altri namespace: `engine` (motore), `night` (tombolo), `campaign` (campagna, vedi
`docs/stato/campagna.md`), `ui` (schermate, vedi `docs/stato/interfaccia.md`).

## Convenzioni

TypeScript `strict` con `noUncheckedIndexedAccess`, niente `any`. Nomi di dominio in italiano,
nomi tecnici in inglese, commenti in italiano. Nessuna stringa visibile nel codice: sempre i18n.
Nessuna richiesta di rete a runtime (tranne gli asset locali). Il motore non usa `Math.random()`
né `Date.now()`: usa `src/core/rng.ts`. Nel codice del browser i timer si tipizzano con
`ReturnType<typeof setTimeout>` (sono presenti anche i tipi di Node).

Font: Atkinson Hyperlegible, EB Garamond, Caveat (SIL Open Font License), inclusi nel bundle.
