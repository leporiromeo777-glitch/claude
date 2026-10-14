# TRAMA sugli store: guida passo passo

Questa guida spiega come trasformare il gioco in un'app per iPhone, iPad e Android e come pubblicarla sull'App Store e su Google Play. È scritta per chi ha un Mac ma non fa lo sviluppatore di mestiere: ogni passo dice cosa installare, quale comando scrivere nel Terminale e dove cliccare.

I progetti nativi sono già pronti nel repository (`gioco/android/` e `gioco/ios/`). Non serve crearli di nuovo: basta installare gli strumenti, aprire i progetti e, quando si decide di pubblicare, preparare i pacchetti firmati.

> **La regola che non si infrange mai.** L'identificativo dell'app è `it.trama.merletto`. Lo si sceglie una volta sola e **non si cambia mai più dopo la prima pubblicazione**, né in `capacitor.config.ts`, né in Android Studio, né in Xcode. Gli store riconoscono l'app da quel nome: cambiarlo vuol dire pubblicare un'app diversa. Inoltre i salvataggi dei giocatori stanno nella memoria legata a quell'identificativo, quindi con un nome nuovo chi aggiorna perde tutta la partita.

---

## Indice

1. [Cosa serve, in breve](#1-cosa-serve-in-breve)
2. [Installare gli strumenti sul Mac](#2-installare-gli-strumenti-sul-mac)
3. [Primo avvio del gioco come app](#3-primo-avvio-del-gioco-come-app)
4. [Tutti i comandi](#4-tutti-i-comandi)
5. [Account sviluppatore](#5-account-sviluppatore)
6. [Prima di pubblicare: prezzo, privacy, testi e immagini](#6-prima-di-pubblicare-prezzo-privacy-testi-e-immagini)
7. [Google Play](#7-google-play)
8. [App Store](#8-app-store)
9. [Aggiornamenti successivi](#9-aggiornamenti-successivi)
10. [Checklist per gli store](#10-checklist-per-gli-store)
11. [Se qualcosa non funziona](#11-se-qualcosa-non-funziona)
12. [Cosa c'è nel repository](#12-cosa-ce-nel-repository)

---

## 1. Cosa serve, in breve

| Cosa | Per quale store | Costo |
|---|---|---|
| Un Mac con macOS Sequoia 15.6 o successivo | entrambi (per iOS è obbligatorio) | - |
| Node.js 22 o successivo | entrambi | gratis |
| Xcode 26 o successivo | App Store | gratis |
| Android Studio 2025.2.1 o successivo | Google Play | gratis |
| Account Apple Developer Program | App Store | **99 USD all'anno** |
| Account Google Play Console | Google Play | **25 USD una tantum** |
| Un sito dove pubblicare la pagina della privacy | entrambi | - |
| Un iPhone e un telefono Android di fascia media per la prova finale | entrambi | - |

Dal 28 aprile 2026 Apple accetta solo app compilate con Xcode 26 o successivo. Per Google Play, se l'account è personale e nuovo, prima della pubblicazione serve un **test chiuso con almeno 12 persone per 14 giorni di fila**: conviene organizzarlo presto (vedi sezione 7.4).

---

## 2. Installare gli strumenti sul Mac

Si fa una volta sola. Tempo previsto: un'ora, quasi tutta di download.

### 2.1 Il Terminale

Il Terminale è l'app in cui si scrivono i comandi: Finder > Applicazioni > Utility > Terminale. Ogni comando di questa guida va copiato, incollato e confermato con Invio.

### 2.2 Node.js

1. Vai su <https://nodejs.org> e scarica la versione **LTS** (22 o successiva), il file `.pkg` per macOS.
2. Aprilo e segui l'installazione.
3. Controlla nel Terminale:
   ```bash
   node -v
   ```
   Deve rispondere `v22.qualcosa` o un numero più alto.

### 2.3 Xcode (per iPhone e iPad)

1. Apri l'App Store del Mac, cerca **Xcode** e installalo (è grande: 10-15 GB).
2. Aprilo una volta: accetta la licenza e lascia che installi i componenti aggiuntivi. Quando chiede quali piattaforme scaricare, scegli **iOS**.
3. In Xcode > Settings (Impostazioni) > Accounts premi **+** e accedi con il tuo Apple ID.
4. Nel Terminale:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app
   xcodebuild -version
   ```
   La seconda riga deve rispondere `Xcode 26` o un numero più alto.

Non serve installare CocoaPods: il progetto iOS usa Swift Package Manager, che è già dentro Xcode.

### 2.4 Android Studio (per Android)

1. Scarica Android Studio 2025.2.1 o successivo da <https://developer.android.com/studio> (scegli la versione per «Mac with Apple chip» se il Mac ha un processore M1/M2/M3/M4, altrimenti «Mac with Intel chip»).
2. Trascinalo in Applicazioni e aprilo. Scegli l'installazione **Standard**: scarica l'SDK Android in `~/Library/Android/sdk`.
3. Dalla schermata iniziale, More Actions > SDK Manager: nella scheda **SDK Platforms** spunta **Android 16 (API 36)**; nella scheda **SDK Tools** controlla che ci siano **Android SDK Build-Tools**, **Android SDK Platform-Tools** e **Android Emulator**. Premi Apply.
4. Nel Terminale, una volta sola, fai sapere agli strumenti dove sta l'SDK:
   ```bash
   echo 'export ANDROID_HOME="$HOME/Library/Android/sdk"' >> ~/.zprofile
   echo 'export PATH="$PATH:$ANDROID_HOME/platform-tools"' >> ~/.zprofile
   source ~/.zprofile
   ```

Android Studio contiene anche Java (il JDK 21) che serve a Gradle: gli script del progetto lo trovano da soli.

### 2.5 Scaricare il progetto

Se il progetto non è ancora sul Mac, scaricalo dal repository (con GitHub Desktop, oppure con `git clone` e l'indirizzo del repository). Poi, nel Terminale:

```bash
cd percorso/del/repository/gioco
npm ci
```

`npm ci` installa le librerie del gioco esattamente nelle versioni previste (qualche minuto la prima volta). Tutti i comandi che seguono si lanciano **dalla cartella `gioco/`**.

---

## 3. Primo avvio del gioco come app

### 3.1 Su iPhone o iPad

```bash
npm run app:ios
```

Il comando prepara il gioco, lo copia nel progetto iOS e apre Xcode. In Xcode:

1. Nella colonna di sinistra clicca sull'icona blu **App** in cima, poi sul target **App**, scheda **Signing & Capabilities**.
2. Lascia spuntato **Automatically manage signing** e in **Team** scegli il tuo nome o quello del tuo team. (Anche senza l'account a pagamento puoi provare l'app sul tuo iPhone con il tuo Apple ID: l'installazione dura 7 giorni.)
3. **Non toccare il Bundle Identifier**: deve restare `it.trama.merletto`.
4. In alto, accanto al pulsante ▶, scegli un simulatore (per esempio «iPhone 17») oppure il tuo iPhone collegato con il cavo.
5. Premi ▶ (Run).

Per provarlo sul tuo iPhone: collegalo al Mac, sbloccalo e conferma «Autorizza questo computer». La prima volta l'iPhone chiede di attivare la **Modalità sviluppatore** (Impostazioni > Privacy e sicurezza > Modalità sviluppatore) e di riavviarsi.

### 3.2 Su Android

```bash
npm run app:android
```

Il comando prepara il gioco e apre Android Studio. Aspetta che in basso finisca «Gradle sync» (la prima volta qualche minuto). Poi:

1. In alto scegli un dispositivo: un emulatore (Device Manager > **+** > Create Virtual Device, per esempio «Pixel 9») oppure il tuo telefono collegato con il cavo.
2. Premi ▶ (Run 'app').

Per usare il tuo telefono: Impostazioni > Info sul telefono > tocca 7 volte «Numero build» per attivare le Opzioni sviluppatore; poi Impostazioni > Sistema > Opzioni sviluppatore > attiva **Debug USB** e conferma sul telefono quando lo colleghi.

In alternativa, senza aprire Android Studio:

```bash
npm run android:apk
```

produce `android/app/build/outputs/apk/debug/app-debug.apk`, un file che si può copiare sul telefono e installare (il telefono chiede di consentire l'installazione da questa fonte).

### 3.3 Cosa controllare al primo avvio

- Il telefono resta in verticale anche se lo giri; sull'iPad e sui tablet Android il gioco ruota.
- La barra di stato in alto non si vede; il gioco non finisce sotto la tacca o i bordi arrotondati.
- La schermata d'avvio è blu notte con il fuso al centro e sparisce quando compare il titolo.
- Tenendo premuto un testo non compare il menu «Copia»; pizzicando con due dita non si ingrandisce nulla; trascinando oltre il bordo la pagina non «rimbalza».
- Il tasto Indietro di Android chiude prima i pannelli aperti, e solo dal titolo chiede se uscire.
- Uscendo dall'app e rientrando, il gioco riprende alla stessa riga.

---

## 4. Tutti i comandi

Da lanciare nel Terminale, nella cartella `gioco/`. In breve, dopo aver installato gli strumenti: `npm ci && npm run app:ios` (oppure `npm ci && npm run app:android`) apre il progetto pronto; `npm run release:ios` e `npm run release:android` producono i pacchetti firmati.

| Comando | Cosa fa | Dove |
|---|---|---|
| `npm ci` | installa le librerie (dopo ogni download del progetto) | ovunque |
| `npm run dev` | il gioco nel browser, per lavorarci (`vite --host`) | ovunque |
| `npm run build` | compila il gioco web in `dist/` (`tsc --noEmit && vite build`) | ovunque |
| `npm run preview` | prova la versione compilata nel browser (`vite preview --host --port 4173`) | ovunque |
| `npm test` | test unitari (`vitest run`) | ovunque |
| `npm run test:e2e` | test end-to-end nel browser (`playwright test`) | ovunque |
| `npm run levels:check` | verifica che ogni livello sia risolvibile (`tsx tools/levels/check.ts`) | ovunque |
| `npm run assets:render` | rifà le immagini con Blender (`bash tools/blender/render_all.sh`) | computer con Blender |
| `npm run app:sync` | compila e copia il gioco in entrambi i progetti nativi (`npm run build && cap sync`) | ovunque |
| `npm run app:ios` | compila, copia in iOS e apre Xcode (`npm run build && cap sync ios && cap open ios`) | Mac con Xcode |
| `npm run app:android` | compila, copia in Android e apre Android Studio (`npm run build && cap sync android && cap open android`) | Mac/PC con Android Studio |
| `npm run app:run:ios` | compila e avvia su simulatore o iPhone collegato (`npm run build && cap run ios`) | Mac con Xcode |
| `npm run app:run:android` | compila e avvia su emulatore o telefono collegato (`npm run build && cap run android`) | con Android Studio |
| `npm run android:apk` | APK di prova (`npm run app:sync && bash scripts/android-build.sh assembleDebug`) | ovunque ci sia l'SDK Android |
| `npm run release:android` | App Bundle firmato per Google Play (`bash scripts/release-android.sh`) | Mac/PC |
| `npm run release:ios` | pacchetto firmato per l'App Store (`bash scripts/release-ios.sh`) | Mac |
| `npm run assets:native` | rigenera icone e schermate d'avvio native da `assets/` | ovunque |
| `npm run native:check` | controlla le impostazioni native (orientamento, privacy, icone, appId) | ovunque |

Il comando completo di `assets:native` è:

```bash
capacitor-assets generate --ios --android --iconBackgroundColor '#1C2233' --iconBackgroundColorDark '#1C2233' --splashBackgroundColor '#1C2233' --splashBackgroundColorDark '#1C2233'
```

Le immagini di partenza sono `assets/logo.png` (1024×1024, senza trasparenza: l'App Store rifiuta le icone trasparenti), `assets/splash.png` e `assets/splash-dark.png` (2732×2732). Si rifanno con la pipeline di Blender (`npm run assets:render`); dopo averle cambiate si lancia `npm run assets:native` e si fa commit di `android/` e `ios/`.

`scripts/android-build.sh` ritenta Gradle fino a 5 volte con un'attesa che raddoppia (15, 30, 60, 120 secondi) quando Maven Central risponde «429, troppe richieste» o cade la rete; un errore vero di compilazione si ferma subito. Si possono cambiare: `ANDROID_HOME` (cartella dell'SDK), `JAVA_HOME`, `GRADLE_TRIES`, `GRADLE_RETRY_WAIT`, `GRADLE_MAX_WORKERS` (predefinito 2).

---

## 5. Account sviluppatore

### 5.1 Apple Developer Program: 99 USD all'anno

1. Vai su <https://developer.apple.com/programs/enroll/> e accedi con l'Apple ID (con l'autenticazione a due fattori attiva).
2. Scegli **Individual** (persona fisica: sullo store compare il tuo nome) oppure **Organization** (azienda: compare il nome dell'azienda; serve il numero **D-U-N-S**, che si chiede gratis e arriva in qualche giorno).
3. Paga i 99 USD. L'attivazione richiede da qualche ora a qualche giorno.
4. Annota il **Team ID**: developer.apple.com > Account > Membership details (10 caratteri, per esempio `ABCDE12345`). Serve a `npm run release:ios`.

L'abbonamento va rinnovato ogni anno: se scade, l'app sparisce dall'App Store.

### 5.2 Google Play Console: 25 USD una tantum

1. Vai su <https://play.google.com/console/signup> con un account Google (meglio uno dedicato al lavoro).
2. Scegli **Personale** oppure **Organizzazione** (per l'organizzazione serve il D-U-N-S).
3. Paga i 25 USD e completa la verifica dell'identità (documento) e del telefono Android richiesta da Google.

Per gli account **personali** creati dopo il 13 novembre 2023, Google chiede un test chiuso con almeno 12 tester per 14 giorni di fila prima di poter pubblicare (sezione 7.4). Per gli account di organizzazione di solito non serve.

### 5.3 Venditore nell'Unione Europea

Entrambi gli store chiedono, per distribuire nell'Unione Europea, di dichiarare se sei un «commerciante» (trader) secondo il Digital Services Act. Se vendi l'app o lo sblocco, quasi certamente lo sei: indirizzo, telefono ed email di contatto diventano visibili sulla pagina dell'app. Apple lo chiede in App Store Connect > Business; Google in Play Console > Impostazioni > Dettagli sviluppatore.

---

## 6. Prima di pubblicare: prezzo, privacy, testi e immagini

### 6.1 Prezzo

Il modello del gioco (GDD 15) è: prima parte gratuita (Prologo, Atto I, Merletto del giorno), poi uno sblocco unico; nessuna pubblicità e nessun tracciamento. Oggi il modulo degli acquisti nativi non è ancora collegato (è previsto nel livello L2): nell'app nativa **tutto è sbloccato**. Quindi, finché lo sblocco non è pronto, le scelte sono due:

- pubblicare l'app **gratuita** (tutto sbloccato) e aggiungere lo sblocco in un aggiornamento;
- oppure pubblicarla **a pagamento** (un prezzo unico al download).

Attenzione: su Google Play un'app pubblicata gratuita **non può più diventare a pagamento** (può però avere acquisti al suo interno). Sull'App Store il prezzo si cambia quando si vuole. Per vendere qualcosa serve firmare il contratto per le app a pagamento (App Store Connect > Business > Paid Apps Agreement) e creare il profilo pagamenti di Google (Play Console > Impostazioni > Profilo pagamenti).

### 6.2 Privacy: «Dati non raccolti»

Il gioco non raccoglie nulla: nessun account, nessuna pubblicità, nessuna statistica, nessuna richiesta di rete. I salvataggi restano sul telefono. Quindi:

- **App Store**, scheda «Privacy dell'app»: rispondi **No, non raccogliamo dati da questa app**. La scheda mostrerà **«Dati non raccolti»**. Il file `ios/App/App/PrivacyInfo.xcprivacy` lo dichiara già ad Apple: nessun tracciamento (`NSPrivacyTracking` = false), nessun dominio di tracciamento, e l'uso di UserDefaults (dove stanno salvataggi e impostazioni) con il motivo `CA92.1` («dati letti e scritti solo dall'app»).
- **Google Play**, modulo «Sicurezza dei dati»: alla domanda «La tua app raccoglie o condivide dati utente?» rispondi **No**. La pagina mostrerà «Nessun dato raccolto» e «Nessun dato condiviso con terze parti».

Entrambi gli store chiedono comunque l'**indirizzo di una pagina web con l'informativa sulla privacy**. Basta una pagina semplice, per esempio sul sito dell'azienda. Testo di partenza (da adattare con il nome del titolare e un contatto):

> **Trama. Il merletto dei giorni: informativa sulla privacy.** Trama non raccoglie, non conserva e non condivide alcun dato personale. Non ci sono account, pubblicità, statistiche o tracciamento, e il gioco non si collega a internet. I progressi e le impostazioni sono salvati soltanto sul dispositivo e si cancellano disinstallando l'app. Se condividi il risultato di una partita, sei tu a scegliere dove inviarlo con le funzioni del telefono. Titolare: [nome], [email di contatto].
>
> **Trama. Privacy policy.** Trama does not collect, store or share any personal data. There are no accounts, ads, analytics or tracking, and the game never connects to the internet. Progress and settings are saved only on your device and are deleted when you uninstall the app. If you share a result, you choose where to send it using your device's own sharing features. Contact: [name], [email].

### 6.3 Classificazione per età

Il gioco non ha violenza né linguaggio volgare, ma parla di lutto, malattia e temi familiari. La classificazione prevista è **PEGI 7 / 9+** (GDD 0). I questionari si compilano negli store (sezioni 7.2 e 8.2): rispondi con sincerità, «temi maturi o suggestivi: rari/lievi» se lo chiede, «no» a violenza, sesso, droghe, gioco d'azzardo, contenuti generati dagli utenti, chat e acquisti con denaro reale (finché lo sblocco non c'è). La classificazione la calcolano gli store dalle risposte.

### 6.4 Testi della scheda (proposta)

- **Nome**: Trama. Se sull'App Store è già preso, usa «Trama: il merletto dei giorni».
- **Sottotitolo** (App Store, 30 caratteri): «Quello che tessi accade domani».
- **Descrizione breve** (Google Play, 80 caratteri): «Un puzzle di fili e persone: quello che tessi stanotte accade domani.»
- **Categoria**: Giochi > Rompicapo (secondaria: Avventura).
- **Lingue**: italiano (principale) e inglese.

### 6.5 Immagini

| Immagine | Google Play | App Store |
|---|---|---|
| Icona | 512×512 PNG (`public/icons/icon-512.png`) | presa dal progetto, non si carica a parte |
| Grafica in evidenza | 1024×500, obbligatoria (da preparare) | - |
| Schermate telefono | da 2 a 8, verticali | iPhone 6,9": 1320×2868 o 1290×2796 |
| Schermate tablet | consigliate (7" e 10") | iPad 13": 2064×2752 o 2048×2732, obbligatorie perché l'app gira su iPad |

Le schermate si fanno dal simulatore iOS (File > Save Screen, oppure Cmd+S) e dall'emulatore Android (pulsante della fotocamera nella barra laterale). Anche la suite automatica `layout` dei test end-to-end (`npm run test:e2e`) salva screenshot di tutte le schermate in varie misure: sono utili per scegliere quali mostrare.

---

## 7. Google Play

### 7.1 La chiave di firma Android

Google Play accetta solo pacchetti firmati. La firma si fa con una **chiave di caricamento** che crei tu una volta sola e che **non va mai nel repository** (il `.gitignore` esclude già `*.jks` e `*.keystore`, e `npm run native:check` controlla che non ce ne siano).

1. Crea una cartella fuori dal progetto e la chiave (il comando chiede una password: sceglila lunga e annotala nel portachiavi o in un gestore di password):
   ```bash
   mkdir -p ~/chiavi-trama
   "/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool" -genkeypair -v \
     -keystore ~/chiavi-trama/trama-upload.jks -alias upload \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
   Alla domanda sul nome puoi rispondere con il tuo nome o quello dell'azienda; le altre domande si possono lasciare vuote.
2. Fai una **copia di sicurezza** del file `trama-upload.jks` e della password (per esempio su una chiavetta e nel gestore di password).

Con «Firma dell'app di Google Play» (attiva di default) la chiave definitiva dell'app la custodisce Google: la tua è solo la chiave di caricamento. Se la perdi, puoi chiedere a Google di sostituirla (Play Console > Test e rilascio > Integrità dell'app > Firma dell'app > Richiedi la reimpostazione della chiave di caricamento), ma ci vogliono alcuni giorni.

### 7.2 Creare l'app nella Play Console

1. Play Console > **Crea app**: nome «Trama», lingua predefinita **Italiano**, tipo **Gioco**, **Gratuita** o **A pagamento** (vedi 6.1), accetta le dichiarazioni.
2. Nella Dashboard, sezione **Configura la tua app**, completa ogni voce:
   - **Norme sulla privacy**: l'indirizzo della pagina della sezione 6.2.
   - **Accesso all'app**: «Tutte le funzionalità sono disponibili senza restrizioni».
   - **Annunci**: «No, la mia app non contiene annunci».
   - **Classificazione dei contenuti**: compila il questionario (6.3), categoria «Gioco».
   - **Destinatari**: fasce d'età **13 anni e più** (scegliere fasce sotto i 13 anni aggiunge i requisiti del programma Famiglie).
   - **Sicurezza dei dati**: nessun dato raccolto né condiviso (6.2).
   - **App governative**, **funzionalità finanziarie**, **salute**: No.
   - **Scheda dello store**: descrizioni, icona, grafica in evidenza, schermate (6.4 e 6.5).

### 7.3 Preparare il pacchetto firmato

```bash
export KEYSTORE_PATH="$HOME/chiavi-trama/trama-upload.jks"
export KEYSTORE_PASS='la-password-della-chiave'
npm run release:android
```

Lo script compila il gioco, lo copia nel progetto Android, scrive il numero di versione e produce `android/app/release/trama-<versione>-<build>.aab` firmato (circa 7 MB), poi stampa l'impronta SHA-256 del certificato (la stessa che Play Console mostra per la chiave di caricamento). Variabili facoltative: `KEY_ALIAS` (predefinito `upload`), `KEY_PASS` (predefinita uguale a `KEYSTORE_PASS`), `APP_VERSION` (predefinita la `version` di `package.json`), `BUILD_NUMBER`.

Il numero di build (`versionCode`) **cresce da solo**: sono i minuti passati dal 1° gennaio 2026, così ogni caricamento ha un numero più alto del precedente, come Google richiede. Lo script lo scrive in `android/app/build.gradle`: dopo ogni rilascio fai commit di quel file.

La firma la fa Gradle leggendo la chiave dalle variabili d'ambiente (`android/app/build.gradle`, `signingConfigs.release`); le password non compaiono mai nei file del progetto né sulla riga di comando di Gradle. In alternativa ci si può affidare ad Android Studio (Build > Generate Signed App Bundle or APK), ma in quel caso il numero di build va aumentato a mano in `android/app/build.gradle`.

### 7.4 Test chiuso: 12 tester per 14 giorni

Per gli account personali nuovi è obbligatorio prima della produzione.

1. Play Console > Test e rilascio > **Test** > **Test chiuso** > Crea canale (o usa «Alpha»).
2. Scheda **Tester**: crea un elenco con gli indirizzi Gmail di **almeno 12 persone** (meglio 15-20, perché qualcuno si dimentica). Salva e copia il **link di adesione**.
3. **Crea nuova release**, carica il file `.aab`, scrivi le note di versione e invia la release in revisione.
4. Manda il link ai tester: ognuno deve aprirlo, accettare l'invito e installare l'app da Google Play. **Devono restare iscritti per 14 giorni di fila**: chiedi loro di non disiscriversi e di aprire il gioco ogni tanto (Google guarda anche che l'app venga usata e chiede cosa è cambiato grazie ai loro commenti).
5. Dopo 14 giorni, nella Dashboard compare **Richiedi l'accesso alla produzione**: rispondi alle domande (come hai trovato i tester, cosa hai corretto). La risposta arriva in qualche giorno.

### 7.5 Pubblicare

1. Test e rilascio > **Produzione** > Paesi/regioni: scegli dove distribuire.
2. **Crea nuova release**, carica l'ultimo `.aab` (o promuovi quello del test chiuso), note di versione in italiano e inglese.
3. **Invia per la revisione**. La revisione richiede di solito da qualche ora a qualche giorno; puoi scegliere la pubblicazione gestita per decidere tu il momento dell'uscita.

---

## 8. App Store

### 8.1 Registrare l'app

1. Apri il progetto con `npm run app:ios` e, in Signing & Capabilities, scegli il Team dell'account a pagamento: Xcode registra da solo l'identificativo `it.trama.merletto` sul tuo account. (In alternativa: developer.apple.com > Certificates, Identifiers & Profiles > Identifiers > **+** > App IDs, Bundle ID esplicito `it.trama.merletto`.)
2. Vai su <https://appstoreconnect.apple.com> > App > **+** > Nuova app: piattaforma **iOS**, nome «Trama», lingua principale **Italiano**, Bundle ID `it.trama.merletto`, SKU a piacere (per esempio `trama-merletto`), accesso completo.

### 8.2 Compilare la scheda

- **Informazioni sull'app**: categoria Giochi > Rompicapo (secondaria Avventura); **Classificazione per età**: compila il questionario (6.3); diritti sui contenuti: l'app non contiene contenuti di terzi (i caratteri tipografici usati hanno licenza libera SIL OFL).
- **Privacy dell'app**: indirizzo dell'informativa (6.2) e «Non raccogliamo dati» → «Dati non raccolti».
- **Prezzi e disponibilità**: prezzo (6.1) e Paesi.
- **Pagina della versione**: schermate iPhone 6,9" e iPad 13" (6.5), testo promozionale, descrizione, parole chiave, URL di supporto (anche una pagina del sito con un indirizzo email), note per la revisione (per esempio: «Gioco offline, nessun account; il prologo dura circa 5 minuti»).
- **Crittografia**: non serve rispondere a ogni caricamento, perché `Info.plist` dichiara già `ITSAppUsesNonExemptEncryption = false` (l'app non usa crittografia propria).

### 8.3 Preparare e caricare il pacchetto

**Strada consigliata: da Xcode.**

1. `npm run app:ios`.
2. In Xcode, sul target App > General, controlla **Version** (per esempio 1.0.0) e aumenta **Build** di 1 rispetto all'ultimo caricamento.
3. In alto scegli come dispositivo **Any iOS Device (arm64)**.
4. Menu **Product > Archive**. Al termine si apre l'Organizer.
5. **Distribute App** > **App Store Connect** > Distribute. Xcode firma e carica tutto da solo.

**Strada alternativa: dal Terminale.**

```bash
export APPLE_TEAM_ID=ABCDE12345
npm run release:ios
```

Lo script controlla di essere su un Mac con Xcode 26 o successivo, compila il gioco, lo copia nel progetto iOS, scrive versione e numero di build (che cresce da solo, come per Android) nel progetto Xcode, e lancia `npx cap build ios --xcode-team-id $APPLE_TEAM_ID --xcode-export-method app-store-connect`. Il risultato è `ios/App/output/trama-<versione>-<build>.ipa`. Per caricarlo: app **Transporter** (gratuita, dal Mac App Store), accedi con l'Apple ID, trascina il file `.ipa` e premi **Consegna**. Dopo ogni rilascio fai commit di `ios/App/App.xcodeproj/project.pbxproj`. La prima volta conviene comunque aver aperto il progetto in Xcode e scelto il Team (8.1), altrimenti la firma automatica non trova il profilo.

### 8.4 TestFlight e revisione

1. Dopo 10-30 minuti la build compare in App Store Connect > **TestFlight**. Aggiungi te stesso (e chi vuoi) come tester interno e prova l'app sul tuo iPhone con l'app TestFlight. Qui si fa la prova su un iPhone vero richiesta dal GDD.
2. Nella pagina della versione, sezione **Build**, scegli la build.
3. **Aggiungi per la revisione** > **Invia**. La revisione di Apple richiede di solito uno o due giorni.

---

## 9. Aggiornamenti successivi

Ogni volta che il gioco cambia:

1. Scarica le modifiche e lancia `npm ci` se sono cambiate le librerie.
2. Se cambia la versione visibile, aggiorna `"version"` in `package.json` (per esempio da `1.0.0` a `1.0.1`) oppure passa `APP_VERSION=1.0.1` agli script.
3. `npm run release:android` e/o `npm run release:ios` (oppure Xcode > Archive), poi carica come nelle sezioni 7.5 e 8.3.
4. Fai commit di `android/` e `ios/`: devono restare allineati al gioco (`npm run app:sync` li aggiorna; le copie del gioco web dentro i progetti non vanno nel repository).

Quando si aggiorna Capacitor, dopo `npm ci` lancia `npm run app:sync` e poi `npm run native:check`: se qualche impostazione fatta a mano fosse sparita, il controllo lo dice.

---

## 10. Checklist per gli store

### 10.1 Definizione di fatto (GDD 17, pubblicazione sugli store)

| Voce | Come si controlla | Stato |
|---|---|---|
| `npm run app:sync` senza errori; `android/` e `ios/` aggiornati nel repository | `npm run app:sync`, poi `git status`: nessuna modifica dimenticata in `android/` e `ios/` | fatto |
| APK di debug compilato nel container (`npm run android:apk`) | il file `android/app/build/outputs/apk/debug/app-debug.apk` esiste (circa 8,5 MB) | fatto |
| Icone e splash generati; `appCategory="game"`; telefoni bloccati in verticale; privacy manifest presente | `npm run native:check` (36 controlli) | fatto |
| Nessun comportamento da browser: niente selezione del testo, zoom, menu del tocco prolungato, rimbalzo dello scroll | prova a mano su telefono (sezione 3.3) | da provare sui telefoni |
| `docs/STORE.md` con i passi sul Mac e sulle console degli store | questo documento | fatto |

### 10.2 Prima di ogni invio

- [ ] `npm run build`, `npm test` e `npm run levels:check` verdi; `npm run test:e2e` verde.
- [ ] `npm run native:check` verde.
- [ ] Prova su un **iPhone vero** e su un **Android di fascia media**: avvio, prologo con il dito, uscita e ripresa, rotazione (bloccata sul telefono), audio dopo il primo tocco, tasto Indietro su Android.
- [ ] Prova su un **iPad** in orizzontale e in verticale (Apple prova l'app anche su iPad).
- [ ] Numero di build più alto del precedente (gli script lo fanno da soli).
- [ ] Identificativo ancora `it.trama.merletto` (`npm run native:check` lo verifica).
- [ ] Commit di `android/` e `ios/` dopo il rilascio.

### 10.3 Google Play

- [ ] Account Play Console attivo e verificato (25 USD).
- [ ] Chiave di caricamento creata, fuori dal repository, con copia di sicurezza.
- [ ] Informativa sulla privacy online.
- [ ] Accesso all'app, annunci (no), classificazione, destinatari (13+), sicurezza dei dati (nessun dato), app governative/finanziarie/salute (no).
- [ ] Scheda: nome, descrizioni, icona 512×512, grafica 1024×500, almeno 2 schermate telefono.
- [ ] Dichiarazione di commerciante UE (se vendi).
- [ ] Test chiuso con almeno 12 tester per 14 giorni (account personali nuovi), poi richiesta di accesso alla produzione.
- [ ] Release di produzione con `.aab` firmato, inviata per la revisione.

### 10.4 App Store

- [ ] Apple Developer Program attivo (99 USD/anno) e Team ID annotato.
- [ ] Xcode 26 o successivo.
- [ ] App creata in App Store Connect con Bundle ID `it.trama.merletto`.
- [ ] Privacy dell'app: «Dati non raccolti»; informativa online; URL di supporto.
- [ ] Classificazione per età compilata.
- [ ] Schermate iPhone 6,9" e iPad 13".
- [ ] Contratto per le app a pagamento (se vendi) e dichiarazione di commerciante UE.
- [ ] Build caricata (Xcode > Archive oppure `npm run release:ios` + Transporter), provata con TestFlight.
- [ ] Inviata per la revisione.

---

## 11. Se qualcosa non funziona

| Messaggio o problema | Cosa fare |
|---|---|
| `SDK Android non trovato` | Apri Android Studio una volta (installa l'SDK), poi ripeti la sezione 2.4, punto 4. |
| `serve Java 21 o successivo` | Usa il Java di Android Studio: `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`. |
| Gradle si ferma con `429` o `Could not GET` | È la rete o Maven Central: lo script ritenta da solo 5 volte. Se fallisce ancora, aspetta qualche minuto e rilancia. |
| `il gioco non è ancora stato copiato nel progetto Android` | Lancia `npm run app:sync` prima di `scripts/android-build.sh`. |
| `manca KEYSTORE_PATH` / `keystore password was incorrect` | Ricontrolla le due righe `export` della sezione 7.3 (percorso del file e password). |
| Google Play: «Il codice di versione è già stato usato» | Rilancia `npm run release:android`: il numero di build si aggiorna da solo. |
| Xcode: «No account for team» o «No profiles for 'it.trama.merletto'» | Xcode > Settings > Accounts: accedi con l'Apple ID; poi nel target App > Signing & Capabilities scegli il Team. |
| Xcode: «Failed to resolve package dependencies» | Controlla la connessione, poi in Xcode File > Packages > Reset Package Caches. Se hai spostato la cartella, rilancia `npm ci` e `npm run app:sync`. |
| App Store Connect: «The bundle version must be higher» | Aumenta Build in Xcode (General) oppure rilancia `npm run release:ios`. |
| `cap open android` non apre Android Studio | Controlla che sia in Applicazioni; altrimenti `export CAPACITOR_ANDROID_STUDIO_PATH="/percorso/Android Studio.app"`. |
| Il telefono Android non compare in Android Studio | Riattiva il Debug USB, prova un altro cavo, conferma l'autorizzazione sul telefono. |
| Dopo un aggiornamento di Capacitor qualcosa è cambiato | `npm run native:check` dice quale impostazione manca; le impostazioni sono descritte in `docs/ARCHITETTURA.md`, sezione 13. |

---

## 12. Cosa c'è nel repository

| Percorso | Contenuto |
|---|---|
| `capacitor.config.ts` | configurazione di Capacitor: appId, nome, colore di fondo, barre di sistema, schermata d'avvio |
| `android/` | progetto Android Studio (minSdk 24, target e compile 36); `AndroidManifest.xml` con `android:appCategory="game"` e `android:screenOrientation="fullUser"` (i telefoni si bloccano in verticale dal gioco, `src/core/platform.ts`) |
| `android/app/build.gradle` | identificativo, versione, firma di rilascio letta dalle variabili d'ambiente |
| `ios/App/App.xcodeproj` | progetto Xcode (Swift Package Manager, nessun CocoaPods) |
| `ios/App/App/Info.plist` | iPhone solo verticale, iPad tutte e quattro le orientazioni, barra di stato nascosta, niente `UIRequiresFullScreen`, nessuna crittografia propria |
| `ios/App/App/PrivacyInfo.xcprivacy` | manifest della privacy (nessun tracciamento, UserDefaults con motivo CA92.1), incluso nelle risorse dell'app |
| `assets/` | immagini di partenza per icone e schermate d'avvio |
| `scripts/android-build.sh` | Gradle con 5 tentativi e attesa crescente |
| `scripts/release-android.sh` | App Bundle firmato per Google Play |
| `scripts/release-ios.sh` | pacchetto firmato per l'App Store |
| `scripts/check-native.mjs` | i controlli di `npm run native:check` |

Non entrano mai nel repository: chiavi e certificati (`*.jks`, `*.keystore`, `*.p12`, `*.p8`, `*.mobileprovision`), i pacchetti prodotti (`*.apk`, `*.aab`, `*.ipa`), le cartelle di build e la copia del gioco web dentro i progetti nativi (`android/app/src/main/assets/public`, `ios/App/App/public`), che `npm run app:sync` rigenera.
