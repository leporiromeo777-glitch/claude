#!/usr/bin/env bash
# TRAMA: prova automatica degli script nativi (npm run native:test).
#
# Lavora su una copia del progetto in una cartella temporanea, con Gradle, npm, npx,
# xcodebuild e uname finti: non scarica nulla, non compila davvero e non tocca i file
# del repository. Gira in meno di un minuto, su Linux e sul Mac.
#
# Cosa prova:
#   - scripts/check-native.mjs: verde sul progetto vero, e ogni impostazione tolta
#     o sbagliata viene segnalata;
#   - scripts/android-build.sh: tentativi solo sugli errori di rete, attesa che
#     raddoppia, stop subito sugli errori di compilazione, SDK e Java mancanti;
#   - scripts/release-android.sh: variabili obbligatorie, keystore dentro il
#     repository rifiutato, numero di build, firma controllata davvero con jarsigner
#     (se c'è un JDK), versione scritta in build.gradle, AAB rinominato;
#   - scripts/release-ios.sh: solo su Mac, Xcode 26 o successivo, Team ID, versione
#     e numero di build nel progetto Xcode, .ipa rinominato, rilasci precedenti tenuti.
set -uo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/trama-native-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

PASSED=0
FAILED=0
LOG="$TMP/ultimo.log"

ok() { PASSED=$((PASSED + 1)); printf 'ok      %s\n' "$1"; }
ko() {
  FAILED=$((FAILED + 1))
  printf 'ERRORE  %s\n' "$1"
  [ -f "$LOG" ] && sed 's/^/          | /' "$LOG" | tail -n 15
}

# expect_ok "descrizione" comando...          il comando deve uscire con 0
expect_ok() {
  local label="$1"; shift
  if "$@" >"$LOG" 2>&1; then ok "$label"; else ko "$label (uscita $?)"; fi
}

# expect_fail "descrizione" "testo atteso" comando...   uscita ≠ 0 e messaggio atteso
expect_fail() {
  local label="$1" pattern="$2"; shift 2
  if "$@" >"$LOG" 2>&1; then
    ko "$label (doveva fallire)"
  elif grep -Eq -- "$pattern" "$LOG"; then
    ok "$label"
  else
    ko "$label (manca il messaggio «$pattern»)"
  fi
}

# --- Copia del progetto -------------------------------------------------------
# Struttura: $TMP/repo (repository git finto) / gioco (copia del progetto).
REPO="$TMP/repo"
P="$REPO/gioco"
mkdir -p "$P"
(cd "$SRC" && tar -cf - \
  --exclude='android/app/build' --exclude='android/build' --exclude='android/.gradle' \
  --exclude='android/app/src/main/assets/public' --exclude='android/app/release' \
  --exclude='android/capacitor-cordova-android-plugins/build' \
  --exclude='ios/App/App/public' --exclude='ios/App/output' --exclude='ios/App/build' \
  package.json capacitor.config.ts .gitignore scripts android ios) | (cd "$P" && tar -xf -)
rm -f "$P/android/local.properties"
if command -v git >/dev/null 2>&1; then
  git init -q "$REPO" >/dev/null 2>&1 || true
fi

# Strumenti finti.
BIN="$TMP/bin"
mkdir -p "$BIN"
cat >"$BIN/npm" <<'EOF'
#!/usr/bin/env bash
echo "[npm finto] $*"
EOF
cat >"$BIN/npx" <<'EOF'
#!/usr/bin/env bash
# npx cap build ios ... esporta un .ipa in ios/App/output, come il vero Capacitor.
echo "[npx finto] $*"
if [ "${1:-}" = "cap" ] && [ "${2:-}" = "build" ] && [ "${3:-}" = "ios" ]; then
  mkdir -p ios/App/output
  printf 'ipa finto' > ios/App/output/App.ipa
  printf 'riepilogo' > ios/App/output/DistributionSummary.plist
fi
EOF
chmod +x "$BIN/npm" "$BIN/npx"
FAKE_PATH="$BIN:$PATH"

SDK="$TMP/sdk"
mkdir -p "$SDK/platforms"

printf '\n--- check-native.mjs ---\n'
expect_ok "il progetto vero supera tutti i controlli" node "$SRC/scripts/check-native.mjs"
expect_ok "la copia di prova supera tutti i controlli" node "$P/scripts/check-native.mjs"

# mutate "descrizione" file 'espressione perl' "controllo atteso"
mutate() {
  local label="$1" file="$P/$2" expr="$3" pattern="$4"
  cp "$file" "$file.orig"
  perl -0pi -e "$expr" "$file"
  if cmp -s "$file" "$file.orig"; then
    ko "$label (la modifica di prova non ha cambiato $2)"
  else
    expect_fail "$label" "^ERRORE  .*$pattern" node "$P/scripts/check-native.mjs"
  fi
  mv "$file.orig" "$file"
}
mutate "manca appCategory" android/app/src/main/AndroidManifest.xml \
  's/\s*android:appCategory="game"//' 'AndroidManifest: android:appCategory'
mutate "orientamento Android sbagliato" android/app/src/main/AndroidManifest.xml \
  's/screenOrientation="fullUser"/screenOrientation="portrait"/' 'AndroidManifest: android:screenOrientation'
mutate "targetSdk vecchio" android/variables.gradle \
  's/targetSdkVersion = 36/targetSdkVersion = 34/' 'variables.gradle: targetSdk'
mutate "applicationId diverso" android/app/build.gradle \
  's/applicationId "it.trama.merletto"/applicationId "com.getcapacitor.app"/' 'app/build.gradle: applicationId'
mutate "password scritta in build.gradle" android/app/build.gradle \
  "s/storePassword providers[^\n]*/storePassword \"segreta\"/" 'firma di rilascio'
mutate "iPhone anche in orizzontale" ios/App/App/Info.plist \
  's|(<key>UISupportedInterfaceOrientations</key>\s*<array>)|$1<string>UIInterfaceOrientationLandscapeLeft</string>|' 'iPhone solo Portrait'
mutate "UIRequiresFullScreen presente" ios/App/App/Info.plist \
  's|<key>UIStatusBarHidden</key>|<key>UIRequiresFullScreen</key><true/><key>UIStatusBarHidden</key>|' 'nessun UIRequiresFullScreen'
mutate "barra di stato visibile" ios/App/App/Info.plist \
  's|(<key>UIStatusBarHidden</key>\s*)<true/>|$1<false/>|' 'UIStatusBarHidden'
mutate "tracciamento dichiarato" ios/App/App/PrivacyInfo.xcprivacy \
  's|(<key>NSPrivacyTracking</key>\s*)<false/>|$1<true/>|' 'NSPrivacyTracking'
mutate "motivo UserDefaults sbagliato" ios/App/App/PrivacyInfo.xcprivacy \
  's/CA92\.1/1C8F.1/g' 'UserDefaults con motivo CA92.1'
mutate "privacy manifest fuori dalle risorse" ios/App/App.xcodeproj/project.pbxproj \
  's/[^\n]*PrivacyInfo\.xcprivacy in Resources \*\/,\n//' 'PrivacyInfo.xcprivacy nelle risorse'
mutate "bundle id diverso" ios/App/App.xcodeproj/project.pbxproj \
  's/PRODUCT_BUNDLE_IDENTIFIER = it\.trama\.merletto;/PRODUCT_BUNDLE_IDENTIFIER = com.getcapacitor.App;/' 'PRODUCT_BUNDLE_IDENTIFIER'
mutate "keystore non escluso da .gitignore" .gitignore \
  's/^\*\.jks\n//m' '.gitignore: chiavi'

mkdir -p "$P/android/app/src/test/java/com/getcapacitor/myapp"
printf 'package com.getcapacitor.myapp;\n' >"$P/android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java"
expect_fail "residuo del modello di Capacitor" "^ERRORE  Android: nessun identificativo del modello" node "$P/scripts/check-native.mjs"
rm -rf "$P/android/app/src/test/java/com"

printf 'chiave' >"$P/trama-upload.jks"
expect_fail "keystore dentro gioco/" "^ERRORE  Nessun keystore" node "$P/scripts/check-native.mjs"
rm -f "$P/trama-upload.jks"
expect_ok "di nuovo verde dopo aver tolto le modifiche" node "$P/scripts/check-native.mjs"

printf '\n--- android-build.sh ---\n'
mkdir -p "$P/android/app/src/main/assets/public"
printf '<!doctype html>' >"$P/android/app/src/main/assets/public/index.html"
# Gradle finto: fallisce con l'errore scelto per i primi FAKE_FAILS giri, poi crea l'APK.
cat >"$P/android/gradlew" <<'EOF'
#!/usr/bin/env bash
count_file="$FAKE_STATE/giri"
n=$(( $(cat "$count_file" 2>/dev/null || echo 0) + 1 ))
echo "$n" >"$count_file"
echo "[gradle finto] giro $n: $*"
if [ "$n" -le "${FAKE_FAILS:-0}" ]; then
  echo "$FAKE_ERROR"
  exit 1
fi
mkdir -p app/build/outputs/apk/debug
printf 'apk finto' > app/build/outputs/apk/debug/app-debug.apk
EOF
chmod +x "$P/android/gradlew"
STATE="$TMP/stato"

gradle_run() {
  # gradle_run FALLIMENTI "errore" [variabili...]
  local fails="$1" error="$2"; shift 2
  rm -rf "$STATE" "$P/android/app/build"
  mkdir -p "$STATE"
  env FAKE_STATE="$STATE" FAKE_FAILS="$fails" FAKE_ERROR="$error" ANDROID_HOME="$SDK" \
    GRADLE_RETRY_WAIT=0 "$@" bash "$P/scripts/android-build.sh"
}
giri() { cat "$STATE/giri" 2>/dev/null || echo 0; }

expect_ok "APK al primo giro" gradle_run 0 ""
[ "$(giri)" = 1 ] && grep -q "app-debug.apk" "$LOG" && ok "un solo giro e APK elencato con la dimensione" || ko "un solo giro e APK elencato"
grep -q "sdk.dir=$SDK" "$P/android/local.properties" && ok "local.properties scritto con l'SDK" || ko "local.properties scritto con l'SDK"

expect_ok "due 429 e poi successo" gradle_run 2 "> Could not GET 'https://repo.maven.apache.org/x.pom'. Received status code 429 from server: Too Many Requests"
[ "$(giri)" = 3 ] && ok "tre giri in tutto" || ko "tre giri in tutto (giri: $(giri))"

expect_fail "429 continuo: si arrende dopo GRADLE_TRIES giri" "fallito 3 volte" \
  gradle_run 99 "Received status code 429 from server: Too Many Requests" GRADLE_TRIES=3
[ "$(giri)" = 3 ] && ok "esattamente 3 giri" || ko "esattamente 3 giri (giri: $(giri))"

expect_fail "errore di compilazione: nessun nuovo tentativo" "non è di rete" \
  gradle_run 99 "error: cannot find symbol MainActivity"
[ "$(giri)" = 1 ] && ok "un solo giro sull'errore di compilazione" || ko "un solo giro sull'errore di compilazione (giri: $(giri))"

# Attesa che raddoppia: con GRADLE_RETRY_WAIT=1 e due errori le attese sono 1 s e 2 s.
rm -rf "$STATE"; mkdir -p "$STATE"
start=$(date +%s)
env FAKE_STATE="$STATE" FAKE_FAILS=2 FAKE_ERROR="Connection reset" ANDROID_HOME="$SDK" GRADLE_RETRY_WAIT=1 \
  bash "$P/scripts/android-build.sh" >"$LOG" 2>&1
elapsed=$(( $(date +%s) - start ))
if grep -q "nuovo tentativo fra 1 s" "$LOG" && grep -q "nuovo tentativo fra 2 s" "$LOG" && [ "$elapsed" -ge 3 ]; then
  ok "attesa che raddoppia (1 s, poi 2 s)"
else
  ko "attesa che raddoppia (trascorsi ${elapsed} s)"
fi

expect_fail "SDK inesistente" "non esiste" env ANDROID_HOME="$TMP/nessuno" bash "$P/scripts/android-build.sh"
FAKE_JDK="$TMP/jdk-muto"
mkdir -p "$FAKE_JDK/bin"
printf '#!/usr/bin/env bash\necho "The operation couldn’t be completed. Unable to locate a Java Runtime." >&2\nexit 1\n' >"$FAKE_JDK/bin/java"
chmod +x "$FAKE_JDK/bin/java"
expect_fail "Java che non risponde (come /usr/bin/java del Mac senza JDK)" "Java non risponde" \
  env ANDROID_HOME="$SDK" JAVA_HOME="$FAKE_JDK" bash "$P/scripts/android-build.sh"
FAKE_JDK17="$TMP/jdk17"
mkdir -p "$FAKE_JDK17/bin"
printf '#!/usr/bin/env bash\necho "openjdk version \\"17.0.2\\" 2022-01-18" >&2\n' >"$FAKE_JDK17/bin/java"
chmod +x "$FAKE_JDK17/bin/java"
expect_fail "Java troppo vecchio" "serve Java 21" env ANDROID_HOME="$SDK" JAVA_HOME="$FAKE_JDK17" bash "$P/scripts/android-build.sh"
mv "$P/android/app/src/main/assets/public" "$TMP/public-da-parte"
expect_fail "gioco non ancora copiato nel progetto" "npm run app:sync" env ANDROID_HOME="$SDK" bash "$P/scripts/android-build.sh"
mv "$TMP/public-da-parte" "$P/android/app/src/main/assets/public"

printf '\n--- release-android.sh ---\n'
KEYS="$TMP/chiavi"
mkdir -p "$KEYS"
release_android() { env PATH="$FAKE_PATH" ANDROID_HOME="$SDK" GRADLE_RETRY_WAIT=0 FAKE_STATE="$STATE" "$@" bash "$P/scripts/release-android.sh"; }
expect_fail "manca KEYSTORE_PATH" "manca KEYSTORE_PATH" env -u KEYSTORE_PATH bash -c "PATH='$FAKE_PATH' bash '$P/scripts/release-android.sh'"
expect_fail "manca KEYSTORE_PASS" "manca KEYSTORE_PASS" release_android KEYSTORE_PATH="$KEYS/x.jks" KEYSTORE_PASS=
expect_fail "keystore inesistente" "non esiste" release_android KEYSTORE_PATH="$KEYS/nessuno.jks" KEYSTORE_PASS=x
printf 'chiave' >"$P/scripts/dentro.jks"
expect_fail "keystore dentro gioco/" "dentro il repository" release_android KEYSTORE_PATH="$P/scripts/dentro.jks" KEYSTORE_PASS=x
rm -f "$P/scripts/dentro.jks"
if [ -d "$REPO/.git" ]; then
  mkdir -p "$REPO/chiavi"
  printf 'chiave' >"$REPO/chiavi/fuori-da-gioco.jks"
  expect_fail "keystore nel repository ma fuori da gioco/" "dentro il repository" \
    release_android KEYSTORE_PATH="$REPO/chiavi/fuori-da-gioco.jks" KEYSTORE_PASS=x
  rm -rf "$REPO/chiavi"
fi
printf 'chiave' >"$KEYS/finta.jks"
expect_fail "APP_VERSION con caratteri pericolosi" "APP_VERSION non valida" \
  release_android KEYSTORE_PATH="$KEYS/finta.jks" KEYSTORE_PASS=x 'APP_VERSION=1.0"; rm -rf /'
cp "$P/android/app/build.gradle" "$TMP/build.gradle.orig"
perl -pi -e 's/versionCode 1\b/versionCode 500000/' "$P/android/app/build.gradle"
expect_fail "BUILD_NUMBER più basso dell'ultimo rilascio" "più basso del versionCode" \
  release_android KEYSTORE_PATH="$KEYS/finta.jks" KEYSTORE_PASS=x BUILD_NUMBER=400000
cp "$TMP/build.gradle.orig" "$P/android/app/build.gradle"

# Firma vera con gli strumenti del JDK, se ci sono.
JDK_BIN=""
for candidate in "${JAVA_HOME:-}" "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
  "$HOME/Applications/Android Studio.app/Contents/jbr/Contents/Home"; do
  if [ -n "$candidate" ] && [ -x "$candidate/bin/jarsigner" ] && [ -x "$candidate/bin/jar" ]; then JDK_BIN="$candidate/bin/"; break; fi
done
if [ -z "$JDK_BIN" ] && command -v jarsigner >/dev/null 2>&1 && command -v jar >/dev/null 2>&1 && jarsigner -help >/dev/null 2>&1; then
  JDK_BIN="$(dirname "$(command -v jarsigner)")/"
fi
if [ -n "$JDK_BIN" ]; then
  "${JDK_BIN}keytool" -genkeypair -keystore "$KEYS/prova.jks" -storepass prova123 -keypass prova123 \
    -alias upload -keyalg RSA -keysize 2048 -validity 2 -dname "CN=Prova TRAMA" >/dev/null 2>&1
  mkdir -p "$TMP/aab/base"
  printf 'contenuto' >"$TMP/aab/base/file.txt"
  (cd "$TMP/aab" && "${JDK_BIN}jar" cf "$TMP/unsigned.aab" base) 2>/dev/null
  cp "$TMP/unsigned.aab" "$TMP/signed.aab"
  "${JDK_BIN}jarsigner" -keystore "$KEYS/prova.jks" -storepass prova123 "$TMP/signed.aab" upload >/dev/null 2>&1
  # Gradle finto per bundleRelease: copia il pacchetto scelto al posto dell'AAB.
  cat >"$P/android/gradlew" <<'EOF'
#!/usr/bin/env bash
echo "[gradle finto] $* (KEYSTORE_PATH=${KEYSTORE_PATH:-} KEY_ALIAS=${KEY_ALIAS:-})"
[ -n "${KEYSTORE_PATH:-}" ] && [ -n "${KEYSTORE_PASS:-}" ] && [ "${KEY_ALIAS:-}" = "upload" ] || { echo "variabili della firma mancanti"; exit 1; }
mkdir -p app/build/outputs/bundle/release
cp "$FAKE_AAB" app/build/outputs/bundle/release/app-release.aab
EOF
  chmod +x "$P/android/gradlew"
  expect_fail "AAB non firmato rifiutato" "non risulta firmato" \
    release_android KEYSTORE_PATH="$KEYS/prova.jks" KEYSTORE_PASS=prova123 FAKE_AAB="$TMP/unsigned.aab" BUILD_NUMBER=777
  cp "$TMP/build.gradle.orig" "$P/android/app/build.gradle"
  expect_ok "AAB firmato: flusso completo" \
    release_android KEYSTORE_PATH="$KEYS/prova.jks" KEYSTORE_PASS=prova123 FAKE_AAB="$TMP/signed.aab" BUILD_NUMBER=778 APP_VERSION=1.2.3
  grep -q "Impronta SHA-256" "$LOG" && ok "impronta SHA-256 stampata" || ko "impronta SHA-256 stampata"
  [ -f "$P/android/app/release/trama-1.2.3-778.aab" ] && ok "AAB copiato in android/app/release/trama-1.2.3-778.aab" || ko "AAB rinominato"
  grep -q 'versionCode 778' "$P/android/app/build.gradle" && grep -q 'versionName "1.2.3"' "$P/android/app/build.gradle" \
    && ok "versionCode e versionName scritti in build.gradle" || ko "versionCode e versionName scritti in build.gradle"
  if grep -q 'prova123' "$LOG"; then ko "la password non deve comparire nel registro"; else ok "la password non compare nel registro"; fi
  cp "$TMP/build.gradle.orig" "$P/android/app/build.gradle"
else
  printf 'saltato  firma vera (nessun JDK con jarsigner e jar)\n'
fi

printf '\n--- release-ios.sh ---\n'
MAC="$TMP/bin-mac"
mkdir -p "$MAC"
printf '#!/usr/bin/env bash\necho Darwin\n' >"$MAC/uname"
printf '#!/usr/bin/env bash\necho "Xcode ${FAKE_XCODE:-27.0}"\necho "Build version 18A100"\n' >"$MAC/xcodebuild"
chmod +x "$MAC/uname" "$MAC/xcodebuild"
LINUX="$TMP/bin-linux"
mkdir -p "$LINUX"
printf '#!/usr/bin/env bash\necho Linux\n' >"$LINUX/uname"
chmod +x "$LINUX/uname"
release_ios() { env PATH="$MAC:$FAKE_PATH" "$@" bash "$P/scripts/release-ios.sh"; }
PBX="$P/ios/App/App.xcodeproj/project.pbxproj"
cp "$PBX" "$TMP/pbxproj.orig"

expect_fail "fuori dal Mac si ferma" "solo su un Mac" env PATH="$LINUX:$FAKE_PATH" APPLE_TEAM_ID=ABCDE12345 bash "$P/scripts/release-ios.sh"
expect_fail "Xcode troppo vecchio" "serve Xcode 26" release_ios FAKE_XCODE=16.4 APPLE_TEAM_ID=ABCDE12345
expect_fail "manca APPLE_TEAM_ID" "manca APPLE_TEAM_ID" release_ios APPLE_TEAM_ID=
expect_fail "Team ID non valido" "non sembra valido" release_ios APPLE_TEAM_ID=abc
expect_fail "versione non accettata dall'App Store" "APP_VERSION non valida" release_ios APPLE_TEAM_ID=ABCDE12345 APP_VERSION=1.0.0-beta
perl -pi -e 's/CURRENT_PROJECT_VERSION = 1;/CURRENT_PROJECT_VERSION = 500000;/' "$PBX"
expect_fail "BUILD_NUMBER più basso dell'ultimo caricamento" "più basso del numero di build" \
  release_ios APPLE_TEAM_ID=ABCDE12345 BUILD_NUMBER=400000
cp "$TMP/pbxproj.orig" "$PBX"

mkdir -p "$P/ios/App/output"
printf 'rilascio precedente' >"$P/ios/App/output/trama-1.0.0-100.ipa"
expect_ok "flusso completo con Xcode 26" release_ios FAKE_XCODE=26.3 APPLE_TEAM_ID=ABCDE12345 BUILD_NUMBER=101 APP_VERSION=1.0.1
grep -q -- "--xcode-team-id ABCDE12345 --xcode-export-method app-store-connect" "$LOG" \
  && ok "cap build ios con team id ed export method" || ko "cap build ios con team id ed export method"
[ -f "$P/ios/App/output/trama-1.0.1-101.ipa" ] && ok ".ipa rinominato in trama-1.0.1-101.ipa" || ko ".ipa rinominato"
[ -f "$P/ios/App/output/trama-1.0.0-100.ipa" ] && ok "il .ipa del rilascio precedente resta" || ko "il .ipa del rilascio precedente resta"
[ ! -f "$P/ios/App/output/App.ipa" ] && ok "nessun App.ipa lasciato in giro" || ko "nessun App.ipa lasciato in giro"
[ "$(grep -c 'CURRENT_PROJECT_VERSION = 101;' "$PBX")" = 2 ] && [ "$(grep -c 'MARKETING_VERSION = 1.0.1;' "$PBX")" = 2 ] \
  && ok "versione e build scritte in Debug e Release" || ko "versione e build scritte in Debug e Release"
expect_ok "secondo rilascio con Xcode 27" release_ios APPLE_TEAM_ID=ABCDE12345 BUILD_NUMBER=102 APP_VERSION=1.0.1
[ -f "$P/ios/App/output/trama-1.0.1-101.ipa" ] && [ -f "$P/ios/App/output/trama-1.0.1-102.ipa" ] \
  && ok "i due .ipa convivono" || ko "i due .ipa convivono"
cp "$TMP/pbxproj.orig" "$PBX"

printf '\n%d prove superate, %d fallite.\n' "$PASSED" "$FAILED"
[ "$FAILED" -eq 0 ]
