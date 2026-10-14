#!/usr/bin/env bash
# TRAMA: compila il progetto Android (android/) con Gradle.
#
# Uso:   bash scripts/android-build.sh [task Gradle ...]      (predefinito: assembleDebug)
#        npm run android:apk                                   (sync del web + APK di debug)
#
# Variabili d'ambiente (tutte facoltative):
#   ANDROID_HOME         cartella dell'SDK Android. Se manca si prova ANDROID_SDK_ROOT,
#                        poi sdk.dir di android/local.properties, poi le cartelle usuali
#                        (~/Library/Android/sdk sul Mac, ~/Android/Sdk su Linux).
#   JAVA_HOME            JDK 21. Sul Mac, se manca, si usa quello di Android Studio.
#   GRADLE_TRIES         tentativi in tutto (predefinito 5).
#   GRADLE_RETRY_WAIT    attesa in secondi prima del secondo tentativo (predefinito 15);
#                        raddoppia a ogni nuovo tentativo (15, 30, 60, 120).
#   GRADLE_MAX_WORKERS   worker paralleli di Gradle (predefinito 2).
#
# Perché i tentativi: attraverso alcuni proxy Maven Central risponde a volte 429
# (troppe richieste) o chiude la connessione. Si ritenta solo quando il registro
# mostra un errore di rete; un errore di compilazione si ferma subito.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT/android"

TASKS=("$@")
if [ ${#TASKS[@]} -eq 0 ]; then
  TASKS=(assembleDebug)
fi

TRIES="${GRADLE_TRIES:-5}"
WAIT="${GRADLE_RETRY_WAIT:-15}"
WORKERS="${GRADLE_MAX_WORKERS:-2}"

say() { printf '\n[android-build] %s\n' "$*"; }
fail() { printf '\n[android-build] ERRORE: %s\n' "$*" >&2; exit 1; }

# --- Progetto -----------------------------------------------------------------
[ -f "$ANDROID_DIR/gradlew" ] || fail "manca android/gradlew: il progetto Android non c'è. Esegui 'npx cap add android' (vedi docs/STORE.md)."
[ -f "$ANDROID_DIR/app/src/main/assets/public/index.html" ] || \
  fail "il gioco non è ancora stato copiato nel progetto Android. Esegui prima 'npm run app:sync'."
chmod +x "$ANDROID_DIR/gradlew"

# --- SDK Android --------------------------------------------------------------
sdk_from_local_properties() {
  local f="$ANDROID_DIR/local.properties"
  [ -f "$f" ] || return 0
  # sdk.dir=/percorso (le eventuali barre di escape di Android Studio vengono tolte)
  sed -n 's/^sdk\.dir=//p' "$f" | tail -n 1 | sed 's/\\:/:/g; s/\\\\/\\/g'
}

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [ -z "$SDK" ]; then
  SDK="$(sdk_from_local_properties)"
fi
if [ -z "$SDK" ]; then
  for candidate in "$HOME/Library/Android/sdk" "$HOME/Android/Sdk" "$HOME/Android/sdk" "/opt/android-sdk"; do
    if [ -d "$candidate/platforms" ]; then SDK="$candidate"; break; fi
  done
fi
[ -n "$SDK" ] || fail "SDK Android non trovato. Installa Android Studio e aprilo una volta (scarica l'SDK), oppure imposta ANDROID_HOME, per esempio:
  export ANDROID_HOME=\"\$HOME/Library/Android/sdk\""
[ -d "$SDK" ] || fail "ANDROID_HOME punta a una cartella che non esiste: $SDK"
[ -d "$SDK/platforms" ] || fail "in $SDK non c'è la cartella platforms: non sembra un SDK Android completo."

export ANDROID_HOME="$SDK"
export ANDROID_SDK_ROOT="$SDK"

# local.properties dice a Gradle dove sta l'SDK (è nel .gitignore: ogni computer ha il suo).
if [ "$(sdk_from_local_properties)" != "$SDK" ]; then
  printf '## Generato da scripts/android-build.sh: percorso locale dell'"'"'SDK, non versionato.\nsdk.dir=%s\n' "$SDK" > "$ANDROID_DIR/local.properties"
fi

# --- JDK 21 -------------------------------------------------------------------
if [ -z "${JAVA_HOME:-}" ]; then
  for candidate in \
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
    "$HOME/Applications/Android Studio.app/Contents/jbr/Contents/Home"; do
    if [ -x "$candidate/bin/java" ]; then export JAVA_HOME="$candidate"; break; fi
  done
fi
if [ -z "${JAVA_HOME:-}" ] && [ -x /usr/libexec/java_home ]; then
  JAVA_HOME="$(/usr/libexec/java_home -v 21 2>/dev/null || true)"
  [ -n "$JAVA_HOME" ] && export JAVA_HOME || unset JAVA_HOME
fi
JAVA_BIN="java"
[ -n "${JAVA_HOME:-}" ] && JAVA_BIN="$JAVA_HOME/bin/java"
command -v "$JAVA_BIN" >/dev/null 2>&1 || fail "Java non trovato. Installa Android Studio (contiene il JDK) oppure un JDK 21 e imposta JAVA_HOME."
JAVA_MAJOR="$("$JAVA_BIN" -version 2>&1 | sed -n 's/.*version "\([0-9]*\).*/\1/p' | head -n 1)"
if [ -n "$JAVA_MAJOR" ] && [ "$JAVA_MAJOR" -lt 21 ]; then
  fail "serve Java 21 o successivo (trovato Java $JAVA_MAJOR). Usa il JDK di Android Studio:
  export JAVA_HOME=\"/Applications/Android Studio.app/Contents/jbr/Contents/Home\""
fi

# --- Gradle con tentativi -----------------------------------------------------
LOG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/trama-gradle.XXXXXX")"
trap 'rm -rf "$LOG_DIR"' EXIT

# Errori di rete o del repository remoto: questi meritano un nuovo tentativo.
NETWORK_ERRORS='429|Too Many Requests|Could not GET|Could not HEAD|Could not download|Could not resolve|Could not get resource|Connection reset|Connection refused|connect timed out|Read timed out|Remote host terminated|Premature end of Content-Length|SSLException|SocketException|SocketTimeoutException|Received status code 5[0-9][0-9]|status code 5[0-9][0-9]|Unable to tunnel through proxy|Exception in thread "main" java.net'

say "SDK: $ANDROID_HOME"
say "Java: $("$JAVA_BIN" -version 2>&1 | grep -m 1 ' version ')"
say "Task: ${TASKS[*]} (fino a $TRIES tentativi, $WORKERS worker)"

attempt=1
status=1
while :; do
  log="$LOG_DIR/tentativo-$attempt.log"
  say "Tentativo $attempt di $TRIES"
  set +e
  (cd "$ANDROID_DIR" && ./gradlew --daemon --max-workers="$WORKERS" "${TASKS[@]}") 2>&1 | tee "$log"
  status=${PIPESTATUS[0]}
  set -e
  if [ "$status" -eq 0 ]; then break; fi
  if [ "$attempt" -ge "$TRIES" ]; then
    say "Gradle è fallito $TRIES volte di seguito."
    break
  fi
  if ! grep -Eq "$NETWORK_ERRORS" "$log"; then
    say "L'errore non è di rete: inutile ritentare. Leggi il messaggio qui sopra."
    break
  fi
  say "Errore di rete o del repository remoto: nuovo tentativo fra $WAIT s."
  sleep "$WAIT"
  WAIT=$((WAIT * 2))
  attempt=$((attempt + 1))
done

[ "$status" -eq 0 ] || fail "compilazione Android non riuscita (codice $status)."

# --- Prodotti -----------------------------------------------------------------
say "Fatto. Pacchetti in android/app/build/outputs:"
found=0
while IFS= read -r -d '' file; do
  bytes="$(wc -c < "$file" | tr -d ' ')"
  printf '  %s  (%s byte, %s MB)\n' "${file#"$ROOT"/}" "$bytes" "$(awk -v b="$bytes" 'BEGIN { printf "%.1f", b / 1048576 }')"
  found=1
done < <(find "$ANDROID_DIR/app/build/outputs" -type f \( -name '*.apk' -o -name '*.aab' \) -print0 2>/dev/null)
[ "$found" -eq 1 ] || say "(nessun APK o AAB: i task richiesti non ne producono)"
