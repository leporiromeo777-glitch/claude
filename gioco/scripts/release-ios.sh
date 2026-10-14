#!/usr/bin/env bash
# TRAMA: pacchetto firmato per l'App Store (.ipa). Solo su Mac, con Xcode 26 o successivo.
#
# Uso (dalla cartella gioco/):
#   export APPLE_TEAM_ID=ABCDE12345        # Team ID: developer.apple.com > Account > Membership
#   npm run release:ios
#
# Variabili d'ambiente:
#   APPLE_TEAM_ID   (obbligatoria) identificativo del team Apple Developer (10 caratteri).
#   BUILD_NUMBER    numero di build (CFBundleVersion). Predefinito: i minuti trascorsi dal
#                   1° gennaio 2026 (UTC), che crescono da soli a ogni caricamento.
#   APP_VERSION     versione visibile (CFBundleShortVersionString). Predefinita:
#                   "version" di package.json.
#
# Passi: build del gioco, cap sync ios, numero di versione nel progetto Xcode, poi
#   npx cap build ios --xcode-team-id $APPLE_TEAM_ID --xcode-export-method app-store-connect
# (archivio firmato in automatico ed esportazione per App Store Connect).
# Prima volta: apri il progetto in Xcode (npm run app:ios), scegli il Team in
# «Signing & Capabilities» e accedi con l'Apple ID in Xcode > Settings > Accounts.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

say() { printf '\n[release-ios] %s\n' "$*"; }
fail() { printf '\n[release-ios] ERRORE: %s\n' "$*" >&2; exit 1; }

# --- Mac e Xcode --------------------------------------------------------------
[ "$(uname -s)" = "Darwin" ] || fail "il pacchetto iOS si prepara solo su un Mac con Xcode."
command -v xcodebuild >/dev/null 2>&1 || fail "xcodebuild non trovato: installa Xcode dall'App Store e aprilo una volta."
XCODE_VERSION="$(xcodebuild -version 2>/dev/null | sed -n 's/^Xcode \([0-9][0-9]*\).*/\1/p' | head -n 1)"
[ -n "$XCODE_VERSION" ] || fail "non riesco a leggere la versione di Xcode. Esegui: sudo xcode-select -s /Applications/Xcode.app"
[ "$XCODE_VERSION" -ge 26 ] || fail "serve Xcode 26 o successivo per caricare sull'App Store (trovato Xcode $XCODE_VERSION). Aggiornalo dall'App Store."

# --- Team e versione ----------------------------------------------------------
[ -n "${APPLE_TEAM_ID:-}" ] || fail "manca APPLE_TEAM_ID. Lo trovi su developer.apple.com > Account > Membership details (10 caratteri)."
case "$APPLE_TEAM_ID" in
  [A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9]) ;;
  *) fail "APPLE_TEAM_ID non sembra valido (attesi 10 caratteri fra lettere maiuscole e cifre): $APPLE_TEAM_ID" ;;
esac
APP_VERSION="${APP_VERSION:-$(node -p "require('./package.json').version")}"
# L'App Store accetta come versione da uno a tre numeri separati da punti (1.0.1).
printf '%s' "$APP_VERSION" | grep -Eq '^[0-9]+(\.[0-9]+){0,2}$' || \
  fail "APP_VERSION non valida per l'App Store (attesi fino a tre numeri separati da punti, per esempio 1.0.1): $APP_VERSION"
BUILD_NUMBER="${BUILD_NUMBER:-$(( ($(date -u +%s) - 1767225600) / 60 ))}"
case "$BUILD_NUMBER" in
  ''|*[!0-9]*) fail "BUILD_NUMBER deve essere un numero intero positivo (trovato: $BUILD_NUMBER)." ;;
esac
PBX="$ROOT/ios/App/App.xcodeproj/project.pbxproj"
[ -f "$PBX" ] || fail "manca ios/App/App.xcodeproj: il progetto iOS non c'è."
# App Store Connect rifiuta un numero di build più basso di uno già caricato per la
# stessa versione: quello scritto nel progetto è l'ultimo rilascio.
CURRENT_BUILD="$(sed -n 's/.*CURRENT_PROJECT_VERSION = \([0-9][0-9]*\);.*/\1/p' "$PBX" | sort -n | tail -n 1)"
if [ -n "$CURRENT_BUILD" ] && [ "$BUILD_NUMBER" -lt "$CURRENT_BUILD" ]; then
  fail "BUILD_NUMBER $BUILD_NUMBER è più basso del numero di build attuale ($CURRENT_BUILD nel progetto Xcode): App Store Connect lo rifiuterebbe. Togli BUILD_NUMBER o usa un numero più alto."
fi

# --- Gioco e progetto nativo --------------------------------------------------
say "Build del gioco e copia nel progetto iOS"
npm run build
npx cap sync ios

say "Versione $APP_VERSION, build $BUILD_NUMBER (progetto Xcode)"
APP_VERSION="$APP_VERSION" BUILD_NUMBER="$BUILD_NUMBER" perl -pi -e '
  s/CURRENT_PROJECT_VERSION = [^;]*;/CURRENT_PROJECT_VERSION = $ENV{BUILD_NUMBER};/;
  s/MARKETING_VERSION = [^;]*;/MARKETING_VERSION = $ENV{APP_VERSION};/;
' "$PBX"
grep -q "CURRENT_PROJECT_VERSION = $BUILD_NUMBER;" "$PBX" || fail "non riesco a scrivere il numero di build in $PBX"

# --- Archivio firmato ed esportazione -----------------------------------------
# cap build esporta in ios/App/output (App.ipa più qualche file di riepilogo). I
# pacchetti dei rilasci precedenti (trama-*.ipa) restano dove sono.
OUT_DIR="$ROOT/ios/App/output"
mkdir -p "$OUT_DIR"
find "$OUT_DIR" -maxdepth 1 -type f ! -name 'trama-*.ipa' -exec rm -f {} +
say "Archivio ed esportazione per App Store Connect (qualche minuto)"
npx cap build ios --xcode-team-id "$APPLE_TEAM_ID" --xcode-export-method app-store-connect

IPA=""
for candidate in "$OUT_DIR"/*.ipa; do
  case "$(basename "$candidate")" in trama-*) continue ;; esac
  if [ -f "$candidate" ]; then IPA="$candidate"; break; fi
done
[ -n "$IPA" ] || fail "xcodebuild ha finito ma in $OUT_DIR non c'è nessun .ipa nuovo."
FINAL="$OUT_DIR/trama-$APP_VERSION-$BUILD_NUMBER.ipa"
mv -f "$IPA" "$FINAL"
bytes="$(wc -c < "$FINAL" | tr -d ' ')"

say "Pronto: ${FINAL#"$ROOT"/} ($(awk -v b="$bytes" 'BEGIN { printf "%.1f", b / 1048576 }') MB)"
cat <<EOF

Prossimi passi (docs/STORE.md, «App Store»):
  1. Apri l'app Transporter (gratuita, dal Mac App Store) e accedi con l'Apple ID dello sviluppatore.
  2. Trascina dentro il file:
       $FINAL
     e premi «Consegna». Dopo 10-30 minuti la build compare in App Store Connect > TestFlight.
  3. Ricordati di fare commit di ios/App/App.xcodeproj/project.pbxproj (build $BUILD_NUMBER).
EOF
