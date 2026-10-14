"""Catalogo degli asset L1 e budget (GDD 12.5, ARCHITETTURA 12 e 16).

Unica fonte dei nomi per ``pack.py``, ``contact_sheet.py`` e ``test_assets.py``.
Deve restare allineato a ``EXPECTED_FRAMES`` / ``EXPECTED_IMAGES`` di
``src/core/assets.ts`` (la scena di avvio del gioco chiede esattamente questi nomi).
Solo libreria standard: si importa sia con il Python di sistema sia con ``BLENDER_PY``.
"""

from __future__ import annotations

import os

HERE = os.path.dirname(os.path.abspath(__file__))
GAME_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
RENDER_DIR = os.path.join(GAME_ROOT, "tools", "blender", "out", "render")
OUT_DIR = os.path.join(GAME_ROOT, "tools", "blender", "out")
PUBLIC_ASSETS = os.path.join(GAME_ROOT, "public", "assets")
PUBLIC_ICONS = os.path.join(GAME_ROOT, "public", "icons")
NATIVE_ASSETS = os.path.join(GAME_ROOT, "assets")

CHARACTERS_FUSO = ["teresa", "marta", "piero", "gino", "bepi", "nina", "zeno", "lunardi", "livia", "ada", "clotilde", "lino"]
CHARACTERS_FIG = ["teresa", "marta", "piero", "gino", "bepi", "nina", "zeno", "lunardi", "livia", "ada", "lino"]
POSES = ["ferma", "porge", "saluta"]
OBJECTS = ["tombolo", "bottiglia", "forbici", "libro", "fuso_faro", "fascio_lettere"]
PLACES = ["molo", "forno", "piazza", "chiesa", "farmacia", "faro", "stanza"]
LIGHTS = ["alba", "giorno", "notte"]
TABLEAUX = ["sedia_vuota", "tempesta", "secca", "sacrestia_lettere"]

#: Frame degli atlas (gruppo ``core``).
FRAMES: list[str] = (
    [f"fuso/{c}" for c in CHARACTERS_FUSO]
    + ["fuso/stile_1", "fuso/stile_2"]
    + [f"fig/{c}/{p}" for c in CHARACTERS_FIG for p in POSES]
    + [f"fig/ada/{p}_grezza" for p in POSES]
    + [f"obj/{o}" for o in OBJECTS]
)
#: Immagini singole: diorami (gruppo ``dio``) e quadri (gruppo ``tab``).
IMAGES: list[str] = [f"dio/{p}/{l}" for p in PLACES for l in LIGHTS] + [f"tab/{t}" for t in TABLEAUX]
#: Render dell'icona (non vanno nel manifest: diventano logo, splash e icone web).
ICON_RENDERS = ["icona/logo", "icona/fuso"]


def group_of(name: str) -> str:
    """Gruppo di caricamento (ARCHITETTURA 12): ``core`` per gli atlas, ``dio`` e ``tab`` per le immagini."""
    head = name.split("/", 1)[0]
    return head if head in {"dio", "tab"} else "core"


def nominal_size(name: str) -> tuple[int, int]:
    """Dimensione di render (e del frame nell'atlas) prevista da GDD 12.5."""
    head = name.split("/", 1)[0]
    if head == "fuso":
        return (96, 320)
    if head == "fig":
        return (256, 256)
    if head == "obj":
        return (1024, 1024) if name == "obj/tombolo" else (256, 256)
    if head in {"dio", "tab"}:
        return (1024, 768)
    if head == "icona":
        return (1024, 1024)
    raise ValueError(f"nome sconosciuto: {name}")


# Atlas (ARCHITETTURA 12): pagine a scaffali al massimo 2048×2048, padding 2 px, estrusione 1 px.
ATLAS_MAX = 2048
ATLAS_PADDING = 2
ATLAS_EXTRUDE = 1

# Immagini: WebP qualità 80 (scende solo se serve a stare nel budget, mai sotto 60).
WEBP_QUALITY = 80
WEBP_MIN_QUALITY = 60

# Budget (GDD 12.5, ARCHITETTURA 16).
BUDGET_ATLAS_TOTAL = 3 * 1024 * 1024
BUDGET_WEBP_EACH = 90 * 1024
BUDGET_TOTAL = 6 * 1024 * 1024

# Prodotti fuori dal manifest.
LOGO_SIZE = 1024
SPLASH_SIZE = 2732
SPLASH_BG = "#1C2233"
WEB_ICONS = {"icon-192.png": 192, "icon-512.png": 512, "favicon.png": 64}
