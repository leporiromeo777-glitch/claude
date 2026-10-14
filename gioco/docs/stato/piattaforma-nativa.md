# Stato del pacchetto: piattaforma-nativa

**Stato:** done

## Riepilogo

Progetti nativi generati con `npx cap add android` e `npx cap add ios` (Capacitor 8.5.3, iOS con Swift Package Manager, niente CocoaPods) e versionati in `android/` e `ios/`.

- **Android** (`android/app/src/main/AndroidManifest.xml`): `android:appCategory="game"` su `<application>`, `android:screenOrientation="fullUser"` su MainActivity. minSdk 24, compile/target 36 (variables.gradle). Schermata d'avvio di Android 12+ su fondo #1C2233 (`windowSplashScreenBackground` = `@color/trama_velluto`). Firma di rilascio in `app/build.gradle` letta solo da variabili d'ambiente (KEYSTORE_PATH, KEYSTORE_PASS, KEY_ALIAS predefinito `upload`, KEY_PASS); versionCode 1, versionName 1.0.0.
- **iOS** (`ios/App/App/Info.plist`): iPhone solo Portrait; iPad tutte e quattro le orientazioni; `UIStatusBarHidden` true; nessun `UIRequiresFullScreen`; in più `ITSAppUsesNonExemptEncryption` false (niente domanda sulla crittografia a ogni caricamento) e `CFBundleLocalizations` it/en (dialoghi di sistema come il foglio di condivisione nella lingua giusta). `ios/App/App/PrivacyInfo.xcprivacy`: `NSPrivacyTracking` false, nessun dominio di tracciamento, nessun dato raccolto, UserDefaults con motivo CA92.1; aggiunto al progetto Xcode (PBXFileReference + fase Resources del target App). LaunchScreen con fondo #1C2233. MARKETING_VERSION 1.0.0.
- **Icone e splash**: `npm run assets:native` da `assets/logo.png` (RGB 1024, opaca) e `assets/splash*.png`: 100 file Android (mipmap, icona adattiva, splash per orientamento/densità/notte) e 7 iOS (AppIcon 1024 unica, Splash.imageset). Tolti i tre splash del modello di Capacitor rimasti orfani nello Splash.imageset.
- **Script** (`scripts/`):
  - `android-build.sh [task…]` (predefinito assembleDebug): trova l'SDK (ANDROID_HOME, ANDROID_SDK_ROOT, local.properties, ~/Library/Android/sdk, ~/Android/Sdk), scrive `android/local.properties`, trova un JDK 21 (JAVA_HOME, JBR di Android Studio, /usr/libexec/java_home), Gradle con demone e `--max-workers` 2 (GRADLE_MAX_WORKERS), fino a 5 tentativi (GRADLE_TRIES) con attesa che raddoppia da 15 s (GRADLE_RETRY_WAIT) solo per errori di rete (429, Could not GET/resolve, reset, timeout…); un errore di compilazione si ferma subito. Alla fine elenca APK/AAB con la dimensione.
  - `release-android.sh`: controlla le variabili, rifiuta un keystore dentro il progetto, `npm run build` + `cap sync android`, scrive versionCode/versionName in app/build.gradle, `android-build.sh :app:bundleRelease`, verifica la firma con jarsigner e stampa l'impronta SHA-256, copia in `android/app/release/trama-<versione>-<build>.aab` (ignorato da git).
  - `release-ios.sh`: solo su Darwin con Xcode ≥ 26, APPLE_TEAM_ID obbligatorio (10 caratteri), `npm run build` + `cap sync ios`, scrive CURRENT_PROJECT_VERSION e MARKETING_VERSION nel pbxproj, `npx cap build ios --xcode-team-id $APPLE_TEAM_ID --xcode-export-method app-store-connect`, rinomina in `ios/App/output/trama-<versione>-<build>.ipa`.
  - `check-native.mjs` (`npm run native:check`): 36 controlli (appId coerente in capacitor.config.ts, build.gradle e pbxproj; manifest; SDK; icone e splash; Info.plist e PrivacyInfo letti con un parser plist; privacy manifest nelle risorse del target; SPM; icona iOS 1024 senza alfa; nessun keystore/certificato dentro gioco/). Esce con 1 se qualcosa manca.
- **package.json**: gli script nativi di ARCHITETTURA 13 c'erano già (fondamenta); aggiunto solo `native:check`.
- **docs/STORE.md**: guida in italiano per un utente con il Mac: strumenti (Node 22+, Xcode 26+, Android Studio 2025.2.1+), primo avvio su simulatore/telefono, tabella di tutti i comandi con i comandi esatti di ARCHITETTURA 13, account (Apple 99 USD/anno, Google Play 25 USD una tantum), stato di commerciante UE, prezzo e limiti (gratis su Play non diventa a pagamento), privacy «Dati non raccolti» con testo d'informativa it/en, classificazione d'età, testi e immagini della scheda, chiave di caricamento con keytool, test chiuso 12 tester × 14 giorni, pubblicazione su entrambi gli store, aggiornamenti, checklist GDD 17 e per ciascuno store, problemi comuni, regola dell'appId che non si cambia mai.

## Verifiche

- `npm run app:sync`: exit 0 (build web + cap sync android e ios).
- `npm run android:apk` (ANDROID_HOME = SDK della ricerca tecnica nello scratchpad): exit 0 in 37 s (45 s la prima volta), `android/app/build/outputs/apk/debug/app-debug.apk` **8 862 401 byte (8,5 MB)**; aapt2: it.trama.merletto, versionName 1.0.0, minSdk 24, targetSdk 36, appCategory=0 (game), screenOrientation=13 (fullUser); nessuna libreria .so (la regola delle pagine da 16 KB non si applica). Maven attraverso il proxy non ha dato 429 (cache Gradle già calda).
- `npm run release:android` con un keystore di prova nello scratchpad: AAB firmato 6,7 MB, `jar verified`, SHA256withRSA; password sbagliata → errore non di rete, nessun tentativo inutile; KEYSTORE_PATH mancante → messaggio chiaro.
- Tentativi di `android-build.sh` provati con un gradlew finto: due 429 e poi successo (3 tentativi, attese 1 s e 2 s); 429 continuo → 5 tentativi e uscita 1.
- `release-ios.sh` provato con uname/xcodebuild/npx finti: flusso completo, numero di build scritto e controllato, .ipa rinominato; su Linux si ferma con il messaggio «solo su un Mac»; Team ID non valido rifiutato.
- `npm run native:check`: 36/36; su una copia con errori introdotti segnala tutti e 7 i difetti.
- pbxproj letto con la libreria `xcode` (PrivacyInfo nella fase Resources, bundle id e versioni corretti); Info.plist e PrivacyInfo letti con `plist`.
- Il bundle web copiato nell'APK (`android/app/src/main/assets/public`) servito su localhost:5300 in Chromium con profilo Pixel 7: arriva al titolo, nessun errore in console, nessuna richiesta esterna.

## Decisioni

- Firma Android con il signingConfig di Gradle invece di `cap build android`: `cap build` firma l'AAB con jarsigner e `-sigalg SHA1withRSA -digestalg SHA1` (algoritmo che i JDK recenti considerano debole) o con apksigner (non adatto agli AAB e non nel PATH); inoltre così la build passa per i 5 tentativi di android-build.sh. Le proprietà `ORG_GRADLE_PROJECT_android.injected.signing.*` sono state provate: AGP non le legge (AAB non firmato), quindi il signingConfig legge le variabili con `providers.environmentVariable`. Le password non stanno mai nei file né sulla riga di comando.
- iOS con `cap build ios` come da ARCHITETTURA 13; STORE.md propone come strada principale Xcode > Product > Archive > Distribute (più semplice per un non sviluppatore) e lo script come alternativa, con caricamento via Transporter.
- Numero di build automatico per entrambi gli store: minuti trascorsi dal 2026-01-01 UTC (sempre crescente, < 2,1 miliardi per secoli), sovrascrivibile con BUILD_NUMBER; versione visibile da `package.json` o APP_VERSION. Gli script scrivono i numeri nei file versionati, così Android Studio/Xcode e git restano allineati.
- `UIRequiredDeviceCapabilities` lasciato `armv7` come nel modello di Capacitor; `CFBundleDevelopmentRegion` lasciato `en` (ripiego per le lingue non previste).
- Il demone Gradle viene fermato a mano dopo le build nel container (`./gradlew --stop`).

## Problemi noti

- Il progetto iOS non si può compilare nel container (serve un Mac con Xcode 26+): verificati solo struttura, plist e pbxproj con parser.
- L'APK non è stato avviato su un emulatore: nel container non c'è /dev/kvm. Il bundle web dentro l'APK è stato provato in Chromium.
- L'SDK Android usato sta nello scratchpad della sessione: in un altro container `npm run android:apk` richiede ANDROID_HOME (o un SDK in ~/Android/Sdk).
- Avvisi innocui della build Android: flatDir del modello di Capacitor, versione XML dell'SDK più nuova dei cmdline-tools; `appCategory` richiede API 26 (minSdk 24: sotto la 26 è ignorato).
- Gli acquisti nativi (sblocco unico) non esistono ancora (L2): in nativo tutto è sbloccato. STORE.md spiega le conseguenze sul prezzo.
- Mancano per le schede degli store: grafica in evidenza 1024×500 (Google Play) e schermate; vedi richieste.

## Richieste ad altri pacchetti

- **asset-blender**: una grafica in evidenza per Google Play, 1024×500 PNG/JPEG senza trasparenza (per esempio `assets/feature-graphic.png`), con il tombolo e il titolo «Trama».
- **piattaforma-qa**: nella suite `layout`, salvare anche schermate alle misure degli store (iPhone 6,9" 1320×2868 o 1290×2796; iPad 13" 2064×2752; telefono Android 1080×1920 o simile) in una cartella dedicata, da usare nelle schede.
- **fondamenta**: aggiungere `npm run native:check` allo script `ci` (o almeno citarlo nel README insieme a docs/STORE.md).
