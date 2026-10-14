# Stato del pacchetto: piattaforma-nativa

**Stato:** done (costruito, poi verificato e corretto dal verificatore il 14/10/2026)

Restano fuori solo le prove che richiedono un Mac o un telefono vero: compilare iOS con Xcode e avviare l'app sui dispositivi.

## Riepilogo

Progetti nativi generati con `npx cap add android` e `npx cap add ios` (Capacitor 8.5.3, iOS con Swift Package Manager, niente CocoaPods) e versionati in `android/` e `ios/`.

- **Android** (`android/app/src/main/AndroidManifest.xml`):
  - `android:appCategory="game"` su `<application>`;
  - `android:screenOrientation="fullUser"` su MainActivity;
  - minSdk 24, compile e target 36 (`variables.gradle`). Google Play chiede target 36 dal 31/08/2026;
  - schermata d'avvio di Android 12+ su fondo #1C2233 (`windowSplashScreenBackground` = `@color/trama_velluto`);
  - firma di rilascio in `app/build.gradle` letta solo da variabili d'ambiente: KEYSTORE_PATH, KEYSTORE_PASS, KEY_ALIAS (predefinito `upload`), KEY_PASS;
  - test Android nel pacchetto giusto `it.trama.merletto`:
    - `src/test/.../ManifestTest.java` (JVM): controlla appCategory e fullUser;
    - `src/androidTest/.../AppContextTest.java` (su dispositivo): controlla identificativo e categoria.
- **iOS**:
  - `ios/App/App/Info.plist`:
    - iPhone solo Portrait; iPad tutte e quattro le orientazioni;
    - `UIStatusBarHidden` true; nessun `UIRequiresFullScreen`;
    - `ITSAppUsesNonExemptEncryption` false; `CFBundleLocalizations` it/en.
  - `ios/App/App/PrivacyInfo.xcprivacy`:
    - `NSPrivacyTracking` false, nessun dominio di tracciamento, nessun dato raccolto;
    - UserDefaults con motivo CA92.1;
    - registrato nel pbxproj (PBXFileReference e fase Resources del target App).
  - LaunchScreen su fondo #1C2233. MARKETING_VERSION 1.0.0, CURRENT_PROJECT_VERSION 1.
- **Icone e splash**: `npm run assets:native` parte da `assets/logo.png` (RGB 1024, opaca) e da `assets/splash*.png` e produce:
  - 100 file Android (mipmap, icona adattiva, splash);
  - 7 file iOS (AppIcon 1024 senza alfa, Splash.imageset).

  Rigenerarli non cambia nessun file versionato: il comando è idempotente.
- **Script** (`scripts/`). Sono l'API pubblica del pacchetto e si lanciano tutti con `npm run`:
  - `android-build.sh [task…]` (predefinito `assembleDebug`):
    - SDK da ANDROID_HOME, ANDROID_SDK_ROOT, `local.properties` o dalle cartelle usuali;
    - JDK 21 da JAVA_HOME, da Android Studio o da `java_home`;
    - Gradle con demone e `--max-workers` 2;
    - fino a 5 tentativi (GRADLE_TRIES), con attesa che raddoppia da 15 s (GRADLE_RETRY_WAIT), solo sugli errori di rete;
    - elenca APK e AAB con la dimensione.
  - `release-android.sh`:
    - AAB firmato da Gradle in `android/app/release/trama-<versione>-<build>.aab`;
    - firma verificata con jarsigner e impronta SHA-256 stampata.
  - `release-ios.sh`:
    - solo su Mac con Xcode 26 o successivo, con APPLE_TEAM_ID;
    - lancia `npx cap build ios --xcode-team-id $APPLE_TEAM_ID --xcode-export-method app-store-connect`;
    - produce `ios/App/output/trama-<versione>-<build>.ipa`.
  - `check-native.mjs` (`npm run native:check`): 40 controlli sulle impostazioni native.
  - `test-native.sh` (`npm run native:test`): 59 prove automatiche degli script, con strumenti finti, in circa 8 s.
  - Numero di build: i minuti passati dal 2026-01-01 UTC, sovrascrivibile con BUILD_NUMBER. Versione da `package.json` oppure da APP_VERSION.
- **package.json**: gli script di ARCHITETTURA 13 c'erano già (fondamenta). Questo pacchetto ha aggiunto solo `native:check` e `native:test`.
- **docs/STORE.md**: guida in italiano per un utente con il Mac. Copre:
  - gli strumenti da installare;
  - il primo avvio;
  - tutti i comandi esatti di ARCHITETTURA 13;
  - gli account (Apple 99 USD l'anno, Google Play 25 USD una tantum) e lo stato di commerciante nell'UE;
  - il prezzo;
  - la privacy «Dati non raccolti», con il testo dell'informativa;
  - la classificazione d'età;
  - la chiave di firma;
  - il test chiuso con 12 tester per 14 giorni;
  - la pubblicazione su entrambi gli store e gli aggiornamenti;
  - la checklist GDD 17 e le checklist dei due store;
  - i problemi comuni;
  - la regola dell'appId, che non si cambia mai.

## Correzioni della verifica

1. **STORE.md, requisiti del Mac sbagliati.** La guida chiedeva macOS Sequoia 15.6 e diceva di installare Xcode dall'App Store. Ma oggi l'App Store distribuisce Xcode 27, che richiede macOS Tahoe 26.6 (fonte: developer.apple.com/xcode/system-requirements). Un utente con Sequoia sarebbe rimasto bloccato. Ora la guida dice:
   - Tahoe 26.6 o successivo per Xcode 27;
   - in alternativa, Xcode 26.3 da developer.apple.com/download/all, che funziona su Sequoia 15.6 ed è accettato perché Apple chiede Xcode 26 o successivo.

   Aggiunti anche:
   - il requisito di Google Play targetSdk 36 dal 31/08/2026 (già rispettato);
   - la risposta da dare quando Android Studio propone di aggiornare il plugin Gradle (AGP);
   - l'errore «Java non risponde».
2. **android-build.sh si chiudeva senza messaggio** se `java -version` usciva con errore. Succede con `/usr/bin/java` di un Mac senza JDK: la sostituzione con `pipefail` e `set -e` interrompeva lo script. Ora dice «Java non risponde» e spiega cosa installare. Inoltre l'elenco dei task non espande più un array vuoto: con `set -u` la bash 3.2 del Mac lo considera un errore.
3. **Test Android del modello di Capacitor.** Erano rimasti in `com.getcapacitor.myapp` e `ExampleInstrumentedTest` si aspettava il pacchetto `com.getcapacitor.app`, quindi falliva sul dispositivo. Sostituiti con test veri nel pacchetto `it.trama.merletto`:
   - `testDebugUnitTest` verde: 2 test;
   - il test strumentale compila.

   `native:check` ora segnala qualsiasi residuo `com.getcapacitor.(my)app`.
4. **release-android.sh**:
   - rifiuta un keystore in qualunque cartella del repository git, non solo dentro `gioco/`. `gioco/` è una sottocartella: il `.gitignore` di `gioco/` non copre il resto del repository;
   - rifiuta un BUILD_NUMBER più basso del versionCode attuale;
   - convalida APP_VERSION: la versione finisce fra virgolette in build.gradle, dove un `"` o un `$` la romperebbero;
   - cerca il JDK per jarsigner come android-build.sh (anche `~/Applications` e `java_home`);
   - distingue «non firmato» da «non riesco a controllare». Prima, con il jarsigner finto di un Mac senza JDK, segnalava un AAB non firmato anche quando era firmato.
5. **release-ios.sh**:
   - convalida APP_VERSION nel formato accettato dall'App Store (fino a tre numeri separati da punti);
   - rifiuta un BUILD_NUMBER più basso di quello nel progetto;
   - non cancella più i `.ipa` dei rilasci precedenti: toglie da `ios/App/output` solo i file d'esportazione di Capacitor.
6. **check-native.mjs**, passato da 36 a 40 controlli. Nuovi:
   - nome dell'app Android uguale ad appName;
   - nome visibile iOS uguale ad appName;
   - nessun residuo del modello di Capacitor;
   - `.gitignore` che esclude chiavi e certificati.

   Usa `lstat`, così un collegamento simbolico rotto non lo fa più fallire.
7. **Nuovo `scripts/test-native.sh`** (`npm run native:test`). Le prove del costruttore erano a mano e non salvate; ora girano da sole su una copia temporanea, con gradlew, npm, npx, xcodebuild e uname finti:
   - 15 difetti introdotti, tutti segnalati da check-native;
   - android-build: tentativi solo sugli errori di rete, attese di 1 e 2 s, stop immediato sull'errore di compilazione, SDK e Java mancanti o vecchi;
   - release-android: firma vera con keytool e jarsigner, AAB non firmato rifiutato, keystore dentro gioco/ e dentro il repository, password assente dal registro;
   - release-ios: Linux, Xcode vecchio, Team ID, versione, numero di build, .ipa rinominato, rilasci precedenti conservati.

## Verifiche (eseguite dal verificatore)

- `npm run app:sync`: exit 0. Build web, poi `cap sync` su android e ios: 7 plugin per piattaforma, nessun file versionato modificato.
- `ANDROID_HOME=<scratchpad>/techtest/android-sdk/sdk npm run android:apk`:
  - exit 0, BUILD SUCCESSFUL;
  - `android/app/build/outputs/apk/debug/app-debug.apk` pesa **8 872 925 byte (8,5 MB)**;
  - aapt2: `it.trama.merletto`, versionName 1.0.0, minSdk 24, targetSdk 36, appCategory=0 (game), screenOrientation=13 (fullUser), nessuna `.so`.
  - Senza ANDROID_HOME funziona lo stesso (da `local.properties`), anche senza argomenti (assembleDebug predefinito).
- `npm run release:android` con un keystore di prova nello scratchpad:
  - exit 0, AAB di 6,7 MB;
  - `jar verified`, SHA-256 / SHA256withRSA, impronta stampata;
  - `build.gradle` poi riportato a versionCode 1.
- `bash scripts/android-build.sh :app:testDebugUnitTest :app:compileDebugAndroidTestJavaWithJavac`: verde (ManifestTest 2/2, AppContextTest compilato).
- `npm run assets:native`: exit 0, 100 file Android e 13 scritture iOS. Nessuna differenza rispetto ai file versionati. Icone, icona adattiva e splash controllati a vista.
- `npm run native:check`: 40/40. `npm run native:test`: 59/59.
- Bundle web copiato nell'APK, servito su 127.0.0.1:5305 in Chromium (Pixel 7 e iPad orizzontale): `__GAME__.ready` true, nessun errore in console, nessuna richiesta esterna, `user-select: none` e `overscroll-behavior: none` attivi. Screenshot del titolo controllati.
- STORE.md: contiene tutti i comandi npm della tabella di ARCHITETTURA 13, più `npm ci && npm run app:ios` e `cap build ios --xcode-team-id $APPLE_TEAM_ID --xcode-export-method app-store-connect`. `cap build android --androidreleasetype AAB` è citato con il motivo per cui lo script usa invece la firma di Gradle.
- Server chiuso e demone Gradle fermato a fine lavoro.

## Decisioni

- **Firma Android con il signingConfig di Gradle invece di `cap build android`.**
  - `cap build android` firma con jarsigner e `-sigalg SHA1withRSA -digestalg SHA1` (verificato nel sorgente di @capacitor/cli 8.5.3). È un algoritmo che i JDK recenti considerano debole.
  - In alternativa usa apksigner, che non va bene per gli AAB.
  - Con Gradle la build passa invece per i 5 tentativi. Le variabili sono quelle di ARCHITETTURA 13 e le password non finiscono mai nei file né sulla riga di comando.
- **iOS con `cap build ios` come da ARCHITETTURA 13.** STORE.md propone come strada principale Xcode > Archive > Distribute (più semplice per un non sviluppatore); lo script, con Transporter, è l'alternativa.
- **Numero di build:** minuti passati dal 2026-01-01 UTC, sempre crescente, sovrascrivibile. Gli script lo scrivono nei file versionati e rifiutano un numero più basso dell'ultimo.
- **Test Android del modello sostituiti** da test nel pacchetto `it.trama.merletto`, invece che solo spostati: il test d'esempio «2+2» non controllava nulla.
- **Lasciati come nel modello di Capacitor:**
  - `UIRequiredDeviceCapabilities` = armv7: innocuo, i dispositivi arm64 lo dichiarano;
  - `CFBundleDevelopmentRegion` en;
  - `android:allowBackup` true: il backup automatico di Android conserva i salvataggi nel cambio di telefono e non conta come dato raccolto.

## Problemi noti

- **iOS non compilato.** Nel container non si può: serve un Mac con Xcode 26 o successivo. Info.plist, PrivacyInfo e pbxproj sono stati controllati solo con i parser, e release-ios.sh solo con strumenti finti.
- **APK mai avviato su un emulatore.** Nel container manca /dev/kvm. È stato provato in Chromium solo il bundle web contenuto nell'APK.
- **SDK Android nello scratchpad della sessione.** In un altro container `npm run android:apk` ha bisogno di ANDROID_HOME, oppure di un SDK in `~/Android/Sdk`.
- **Avvisi innocui della build Android:**
  - flatDir nel modello di Capacitor;
  - versione XML dell'SDK più nuova dei cmdline-tools;
  - `appCategory` vale da API 26 in su (con minSdk 24 viene ignorato sotto la 26).
- **Acquisti nativi ancora assenti.** Lo sblocco unico è L2: in nativo tutto è sbloccato. STORE.md 6.1 spiega cosa comporta per il prezzo.
- **Schede degli store incomplete.** Mancano la grafica in evidenza 1024×500 di Google Play e le schermate alle misure degli store (vedi le richieste).

## Richieste ad altri pacchetti

- **asset-blender**: una grafica in evidenza per Google Play, per esempio `assets/feature-graphic.png`:
  - 1024×500, PNG o JPEG senza trasparenza;
  - con il tombolo e il titolo «Trama»;
  - è obbligatoria nella scheda dello store.
- **piattaforma-qa**: nella suite `layout`, salvare in una cartella dedicata anche schermate alle misure degli store, da usare nelle schede:
  - iPhone 6,9": 1320×2868 o 1290×2796;
  - iPad 13": 2064×2752;
  - telefono Android: circa 1080×1920.
- **fondamenta**: aggiungere `npm run native:check && npm run native:test` allo script `ci` (non richiedono SDK né rete), o almeno citarli nel README insieme a `docs/STORE.md`. Il README dice anche «Xcode 26+»: va bene, ma conviene rimandare a STORE.md 2.3 per la scelta tra Xcode 27 (macOS Tahoe 26.6+) e Xcode 26.3 (macOS Sequoia).
