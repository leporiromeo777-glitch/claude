#!/usr/bin/env bash
# TRAMA: pacchetto firmato per Google Play (Android App Bundle, .aab).
#
# Uso (sul Mac, dalla cartella gioco/):
#   export KEYSTORE_PATH="$HOME/chiavi-trama/trama-upload.jks"
#   export KEYSTORE_PASS='la-password-del-keystore'
#   npm run release:android
#
# Variabili d'ambiente:
#   KEYSTORE_PATH   (obbligatoria) file della chiave di caricamento, FUORI dal repository.
#   KEYSTORE_PASS   (obbligatoria) password del keystore.
#   KEY_ALIAS       alias della chiave (predefinito: upload).
#   KEY_PASS        password della chiave (predefinita: uguale a KEYSTORE_PASS).
#   BUILD_NUMBER    numero di build (versionCode). Predefinito: i minuti trascorsi dal
#                   1° gennaio 2026 (UTC), che crescono da soli a ogni pubblicazione.
#   APP_VERSION     versione visibile (versionName). Predefinita: "version" di package.json.
#   più quelle di scripts/android-build.sh (ANDROID_HOME, JAVA_HOME, ...).
#
# Passi: build del gioco, cap sync android, numero di versione in android/app/build.gradle,
# poi Gradle :app:bundleRelease (con i tentativi di scripts/android-build.sh). La firma
# la fa Gradle stesso: android/app/build.gradle legge la chiave da KEYSTORE_PATH,
# KEYSTORE_PASS, KEY_ALIAS e KEY_PASS. Le password passano per l'ambiente, mai per la
# riga di comando (non compaiono nell'elenco dei processi).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

say() { printf '\n[release-android] %s\n' "$*"; }
fail() { printf '\n[release-android] ERRORE: %s\n' "$*" >&2; exit 1; }

# --- Chiave di firma ----------------------------------------------------------
[ -n "${KEYSTORE_PATH:-}" ] || fail "manca KEYSTORE_PATH (il file .jks della chiave di caricamento). Vedi docs/STORE.md, «La chiave di firma Android»."
[ -n "${KEYSTORE_PASS:-}" ] || fail "manca KEYSTORE_PASS (la password del keystore)."
case "$KEYSTORE_PATH" in
  "~/"*) KEYSTORE_PATH="$HOME/${KEYSTORE_PATH#"~/"}" ;;
esac
[ -f "$KEYSTORE_PATH" ] || fail "il keystore non esiste: $KEYSTORE_PATH"
KEYSTORE_PATH="$(cd "$(dirname "$KEYSTORE_PATH")" && pwd -P)/$(basename "$KEYSTORE_PATH")"
# Il keystore non deve stare né dentro gioco/ né in nessun'altra cartella del
# repository (gioco/ è una sottocartella: il .gitignore di gioco/ non copre il resto).
REPO_TOP="$ROOT"
if command -v git >/dev/null 2>&1; then
  REPO_TOP="$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$ROOT")"
fi
REPO_TOP="$(cd "$REPO_TOP" && pwd -P)"
ROOT_REAL="$(cd "$ROOT" && pwd -P)"
for dir in "$ROOT_REAL" "$REPO_TOP"; do
  case "$KEYSTORE_PATH" in
    "$dir"/*) fail "il keystore è dentro il repository ($KEYSTORE_PATH). Spostalo fuori (per esempio in ~/chiavi-trama/): non deve mai finire nel repository." ;;
  esac
done
KEY_ALIAS="${KEY_ALIAS:-upload}"
KEY_PASS="${KEY_PASS:-$KEYSTORE_PASS}"

# --- Versione -----------------------------------------------------------------
APP_VERSION="${APP_VERSION:-$(node -p "require('./package.json').version")}"
# La versione finisce fra virgolette in build.gradle: solo cifre, lettere, punti e trattini.
case "$APP_VERSION" in
  ''|*[!0-9A-Za-z.-]*) fail "APP_VERSION non valida (attese cifre e punti, per esempio 1.0.1): $APP_VERSION" ;;
esac
BUILD_NUMBER="${BUILD_NUMBER:-$(( ($(date -u +%s) - 1767225600) / 60 ))}"
case "$BUILD_NUMBER" in
  ''|*[!0-9]*) fail "BUILD_NUMBER deve essere un numero intero positivo (trovato: $BUILD_NUMBER)." ;;
esac
[ "$BUILD_NUMBER" -ge 1 ] && [ "$BUILD_NUMBER" -le 2100000000 ] || fail "BUILD_NUMBER fuori dai limiti di Google Play (1-2100000000)."
# Google Play rifiuta un versionCode più basso di uno già caricato: quello scritto in
# build.gradle è l'ultimo rilascio (gli script lo aggiornano a ogni giro).
GRADLE_APP="$ROOT/android/app/build.gradle"
[ -f "$GRADLE_APP" ] || fail "manca android/app/build.gradle: il progetto Android non c'è."
CURRENT_CODE="$(sed -n 's/^[[:space:]]*versionCode[[:space:]]\{1,\}\([0-9][0-9]*\).*/\1/p' "$GRADLE_APP" | head -n 1)"
if [ -n "$CURRENT_CODE" ] && [ "$BUILD_NUMBER" -lt "$CURRENT_CODE" ]; then
  fail "BUILD_NUMBER $BUILD_NUMBER è più basso del versionCode attuale ($CURRENT_CODE in android/app/build.gradle): Google Play lo rifiuterebbe. Togli BUILD_NUMBER o usa un numero più alto."
fi

# --- Gioco e progetto nativo --------------------------------------------------
say "Build del gioco e copia nel progetto Android"
npm run build
npx cap sync android

say "Versione $APP_VERSION, build $BUILD_NUMBER (android/app/build.gradle)"
APP_VERSION="$APP_VERSION" BUILD_NUMBER="$BUILD_NUMBER" perl -0pi -e '
  s/versionCode\s+\d+/versionCode $ENV{BUILD_NUMBER}/;
  s/versionName\s+"[^"]*"/versionName "$ENV{APP_VERSION}"/;
' "$GRADLE_APP"
grep -q "versionCode $BUILD_NUMBER" "$GRADLE_APP" || fail "non riesco a scrivere versionCode in $GRADLE_APP"

# --- AAB firmato --------------------------------------------------------------
AAB="$ROOT/android/app/build/outputs/bundle/release/app-release.aab"
rm -f "$AAB"
say "Compilazione e firma dell'App Bundle"
# android/app/build.gradle legge la chiave da queste variabili (signingConfigs.release).
export KEYSTORE_PATH KEYSTORE_PASS KEY_ALIAS KEY_PASS
bash "$ROOT/scripts/android-build.sh" :app:bundleRelease

[ -f "$AAB" ] || fail "Gradle ha finito ma $AAB non c'è."

# Controllo: il pacchetto deve risultare firmato. jarsigner esce con 0 anche se il
# file non è firmato, quindi si legge il suo messaggio. Il JDK si cerca come in
# scripts/android-build.sh (JAVA_HOME, Android Studio, java_home del Mac, PATH).
JDK_BIN=""
for candidate in \
  "${JAVA_HOME:-}" \
  "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
  "$HOME/Applications/Android Studio.app/Contents/jbr/Contents/Home"; do
  if [ -n "$candidate" ] && [ -x "$candidate/bin/jarsigner" ]; then JDK_BIN="$candidate/bin/"; break; fi
done
if [ -z "$JDK_BIN" ] && [ -x /usr/libexec/java_home ]; then
  candidate="$(/usr/libexec/java_home -v 21 2>/dev/null || true)"
  [ -n "$candidate" ] && [ -x "$candidate/bin/jarsigner" ] && JDK_BIN="$candidate/bin/"
fi
JARSIGNER="${JDK_BIN}jarsigner"
KEYTOOL="${JDK_BIN}keytool"
if command -v "$JARSIGNER" >/dev/null 2>&1; then
  VERIFY="$("$JARSIGNER" -verify "$AAB" 2>&1 || true)"
  case "$VERIFY" in
    *"jar verified"*)
      FINGERPRINT="$("$KEYTOOL" -printcert -jarfile "$AAB" 2>/dev/null | sed -n 's/^[[:space:]]*SHA256: //p' | head -n 1)"
      if [ -n "$FINGERPRINT" ]; then
        say "Firmato. Impronta SHA-256 del certificato di caricamento: $FINGERPRINT"
      else
        say "Firmato."
      fi
      ;;
    *unsigned*|*"not signed"*)
      fail "l'App Bundle non risulta firmato: controlla KEYSTORE_PATH, KEY_ALIAS e le password." ;;
    *)
      say "ATTENZIONE: non riesco a controllare la firma con jarsigner (Java non risponde). Il pacchetto è stato firmato da Gradle; Play Console lo verifica al caricamento." ;;
  esac
else
  say "ATTENZIONE: jarsigner non trovato, firma non controllata. Il pacchetto è stato firmato da Gradle; Play Console lo verifica al caricamento."
fi

OUT_DIR="$ROOT/android/app/release"
mkdir -p "$OUT_DIR"
FINAL="$OUT_DIR/trama-$APP_VERSION-$BUILD_NUMBER.aab"
cp "$AAB" "$FINAL"
bytes="$(wc -c < "$FINAL" | tr -d ' ')"

say "Pronto: ${FINAL#"$ROOT"/} ($(awk -v b="$bytes" 'BEGIN { printf "%.1f", b / 1048576 }') MB)"
cat <<EOF

Prossimi passi (docs/STORE.md, «Google Play»):
  1. Play Console > Trama > Test e rilascio > scegli il canale (test chiuso o produzione).
  2. «Crea nuova release» e carica il file:
       $FINAL
  3. Ricordati di fare commit di android/app/build.gradle (versionCode $BUILD_NUMBER).
EOF
