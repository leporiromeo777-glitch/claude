#!/usr/bin/env bash
# Pipeline completa degli asset (ARCHITETTURA 12): `npm run assets:render`.
#
# 1. controlla la geometria delle scene senza renderizzarle (tools/blender/test_geometria.py e
#    tools/blender/verifica_geometria.py: niente facce complanari sovrapposte, che in Cycles
#    fanno macchie nere) e svuota i render grezzi (tools/blender/out/render);
# 2. lancia ogni script Blender in un sottoprocesso separato e ne controlla il codice
#    d'uscita (un crash di Blender non solleva eccezioni Python);
# 3. tools/atlas/pack.py: atlas, WebP, manifest, logo, splash, icone (svuota public/assets);
# 4. confronta i rettangoli del manifest con quelli dell'esecuzione precedente;
# 5. tools/atlas/contact_sheet.py (fogli di controllo) e tools/atlas/test_assets.py.
#
# Opzioni:
#   --parallel    due corsie in parallelo, bilanciate (diorami di molo, forno, piazza,
#                 chiesa, farmacia | fusi, figurine, oggetti e quadri, icona, diorami di
#                 faro e stanza), 2 thread di Cycles ciascuna salvo TRAMA_THREADS;
#   --pack-only   salta i render e riusa quelli già in tools/blender/out/render;
#   --no-tests    salta fogli di controllo e test.
# Variabili: BLENDER_PY (interprete con bpy), TRAMA_THREADS (thread di Cycles, 4 di base).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME="$(cd "$HERE/../.." && pwd)"
DEFAULT_PY="/tmp/claude-0/-home-user-claude/c3e3ef47-6c71-52f7-905c-1c8a39dab6eb/scratchpad/bvenv/bin/python"
PY="${BLENDER_PY:-$DEFAULT_PY}"
OUT="$GAME/tools/blender/out"
RAW="$OUT/render"
LOGS="$OUT/logs"
# Passi: "script" oppure "script:nomi per --only" (il log prende il nome del passo).
SEQUENTIAL=(fusi figurine oggetti icona diorami)
LANE_A=("diorami:dio/molo,dio/forno,dio/piazza,dio/chiesa,dio/farmacia")
LANE_B=(fusi figurine oggetti icona "diorami:dio/faro,dio/stanza")

PARALLEL=0
PACK_ONLY=0
TESTS=1
for arg in "$@"; do
  case "$arg" in
    --parallel) PARALLEL=1 ;;
    --pack-only) PACK_ONLY=1 ;;
    --no-tests) TESTS=0 ;;
    -h|--help) sed -n '2,19p' "$0"; exit 0 ;;
    *) echo "render_all: opzione sconosciuta: $arg" >&2; exit 2 ;;
  esac
done

if [ ! -x "$PY" ]; then
  echo "render_all: interprete non trovato: $PY" >&2
  echo "  imposta BLENDER_PY oppure ricrea il venv (vedi tools/blender/README.md)" >&2
  exit 1
fi
if ! "$PY" -c "import bpy, PIL, numpy" >/dev/null 2>&1; then
  echo "render_all: $PY non ha bpy, Pillow e numpy (vedi tools/blender/README.md)" >&2
  exit 1
fi

T0=$(date +%s)
mkdir -p "$OUT" "$LOGS"

# Esegue un passo (uno script Blender in un sottoprocesso): log completo in out/logs,
# a schermo solo le righe [blender]; conta il codice d'uscita del processo Python.
run_script() {
  local step="$1" name only tag t rc
  name="${step%%:*}"
  only=()
  tag="$name"
  if [ "$step" != "$name" ]; then
    only=(--only "${step#*:}")
    tag="$name-$(printf '%s' "${step#*:}" | cut -d, -f1 | tr '/' '_')"
  fi
  t=$(date +%s)
  set +e
  "$PY" "$HERE/$name.py" --out "$RAW" ${only[@]+"${only[@]}"} 2>&1 | tee "$LOGS/$tag.log" | grep --line-buffered -E '^\[blender\]|^Traceback|^[A-Za-z]*Error:' | sed -u "s/^/[$tag] /"
  rc=${PIPESTATUS[0]}
  set -e
  if [ "$rc" -ne 0 ]; then
    echo "render_all: $name.py è uscito con $rc (log: $LOGS/$tag.log)" >&2
    tail -n 30 "$LOGS/$tag.log" >&2 || true
    return "$rc"
  fi
  echo "[$tag] fatto in $(( $(date +%s) - t )) s"
}

run_lane() {
  local s
  for s in "$@"; do
    run_script "$s" || return 1
  done
}

if [ "$PACK_ONLY" -eq 0 ]; then
  # Controlli geometrici (pochi secondi): meglio fermarsi prima di 15 minuti di render.
  if ! "$PY" "$HERE/test_geometria.py" > "$LOGS/test_geometria.log" 2>&1; then
    tail -n 40 "$LOGS/test_geometria.log" >&2
    echo "render_all: test della geometria falliti" >&2
    exit 1
  fi
  if ! "$PY" "$HERE/verifica_geometria.py" > "$LOGS/verifica_geometria.log" 2>&1; then
    grep -E '^\[blender\]|Error' "$LOGS/verifica_geometria.log" >&2 || true
    echo "render_all: facce complanari sovrapposte (macchie nere in Cycles), vedi $LOGS/verifica_geometria.log" >&2
    exit 1
  fi
  echo "[geometria] $(grep -E 'verifica_geometria:' "$LOGS/verifica_geometria.log" | sed 's/^\[blender\] //')"
  rm -rf "$RAW"
  mkdir -p "$RAW"
  if [ "$PARALLEL" -eq 1 ]; then
    export TRAMA_THREADS="${TRAMA_THREADS:-2}"
    run_lane "${LANE_A[@]}" & PID_A=$!
    run_lane "${LANE_B[@]}" & PID_B=$!
    RC=0
    wait "$PID_A" || RC=1
    wait "$PID_B" || RC=1
    if [ "$RC" -ne 0 ]; then
      echo "render_all: una corsia di render è fallita" >&2
      exit 1
    fi
  else
    run_lane "${SEQUENTIAL[@]}"
  fi
fi
T_RENDER=$(date +%s)

# Rettangoli dell'esecuzione precedente, per il controllo di determinismo.
PREV="$OUT/manifest.prev.json"
rm -f "$PREV"
if [ -f "$GAME/public/assets/manifest.json" ]; then
  cp "$GAME/public/assets/manifest.json" "$PREV"
fi

"$PY" "$GAME/tools/atlas/pack.py" --src "$RAW"

if [ -f "$PREV" ]; then
  "$PY" - "$PREV" "$GAME/public/assets/manifest.json" <<'EOF'
import json, sys
def rects(p):
    m = json.load(open(p, encoding="utf-8"))
    return [(a["image"], a["width"], a["height"], sorted((k, v["x"], v["y"], v["w"], v["h"], v["ax"], v["ay"]) for k, v in a["frames"].items())) for a in m["atlases"]], sorted(m["images"].items())
same = rects(sys.argv[1]) == rects(sys.argv[2])
print("[pack] manifest: " + ("stessi rettangoli dell'esecuzione precedente" if same else "rettangoli DIVERSI dall'esecuzione precedente"))
EOF
fi

if [ "$TESTS" -eq 1 ]; then
  "$PY" "$GAME/tools/atlas/contact_sheet.py"
  if ! "$PY" "$GAME/tools/atlas/test_assets.py" > "$LOGS/test_assets.log" 2>&1; then
    tail -n 40 "$LOGS/test_assets.log" >&2
    echo "render_all: test degli asset falliti" >&2
    exit 1
  fi
  echo "[test] $(tail -n 3 "$LOGS/test_assets.log" | tr '\n' ' ')"
fi

T1=$(date +%s)
echo "render_all: render $(( T_RENDER - T0 )) s, totale $(( T1 - T0 )) s"
