"""Grafica in evidenza di Google Play (docs/STORE.md 6.5): il render del tombolo.

Produce ``store/tombolo``: il tombolo sul cavalletto con il merletto d'avorio, gli spilli
e otto fuselli (fra cui il corallo di Ada), su fondo trasparente con l'ombra a terra
(shadow catcher), a 2048×1000 (il doppio di 1024×500, per un ricampionamento pulito
dei fili sottili del merletto). Il tombolo sta nella metà destra: a sinistra resta il
velluto per il titolo. ``tools/atlas/grafica.py`` compone il fondo di velluto, il titolo
«TRAMA» e il sottotitolo e scrive ``assets/feature-graphic.png`` (e la variante inglese).

Nei metadati del render c'è il riquadro occupato dal tombolo (frazioni dell'immagine),
che la composizione usa per controllare che il titolo non lo tocchi.

Uso: ``$BLENDER_PY tools/blender/grafica.py [--out <cartella>]``
(``TRAMA_ANTEPRIMA=1``: metà risoluzione e pochi campioni, solo per provare).
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import common as C  # noqa: E402  (importa bpy: deve venire prima di mathutils)
import scenografia as S  # noqa: E402

PREVIEW = os.environ.get("TRAMA_ANTEPRIMA") == "1"
W, H = (1024, 500) if PREVIEW else (2048, 1000)
SAMPLES = 12 if PREVIEW else 64
NAMES = ["store/tombolo"]

# Fili dei fuselli, da sinistra: colori vari e il corallo di Ada vicino al centro.
THREADS = ["teresa", "bepi", "piero", "ada", "zeno", "nina", "marta", "gino"]
# Inquadratura (camera ortografica come gli altri render del gioco).
# Dall'alto quanto basta per vedere il merletto sul rullo; le gambe del cavalletto escono
# dal bordo basso (il soggetto sono merletto e fuselli), il resto sta tutto nell'immagine.
AZIMUTH = 26.0
ELEVATION = 28.0
FIT_H = 1.08  # altezza del tombolo in frazioni dell'immagine
CENTER = (0.71, 0.555)  # centro del tombolo nell'immagine (x da sinistra, y dall'alto)
PAD = 0.012  # margine minimo in alto, a sinistra e a destra


def shadow_floor() -> None:
    """Pavimento invisibile che raccoglie solo l'ombra del cavalletto (alfa del render)."""
    floor = C.plane("pavimento", (40, 40), (0, 0, 0), C.mat_paint("pavimento", "#000000"))
    floor.is_shadow_catcher = True


def build() -> list:
    """La geometria della scena (anche per ``verifica_geometria.py``): tombolo e pavimento d'ombra.

    Restituisce le mesh del tombolo (il pavimento non conta per l'inquadratura)."""
    objs = S.tombolo("tombolo", threads=THREADS)
    shadow_floor()
    return [o for o in objs if o.type in {"MESH", "CURVE"}]


def render_one(name: str, out: str) -> None:
    C.rng(name)
    scene = C.reset_scene()
    S.reset()
    C.setup_render(scene, W, H, SAMPLES, transparent=True)
    # Immagine di vetrina: denoiser accurato e soglia adattiva fine anche se è grande.
    scene.cycles.denoising_prefilter = "ACCURATE"
    scene.cycles.adaptive_threshold = 0.015
    meshes = build()
    C.rig_studio(scene, warm=3.2, fill=0.9, rim=2.2, world=0.3)
    lo, hi = C.world_bbox(meshes)
    center = (lo + hi) / 2
    cam = C.ortho_camera(scene, azimuth=AZIMUTH, elevation=ELEVATION, target=tuple(center))
    C.fit_camera(scene, cam, C.object_points(meshes), margin=0.0)
    u0, v0, u1, v1 = C.projected_extent(scene, cam, meshes)
    cam.data.ortho_scale *= (v1 - v0) / FIT_H
    u0, v0, u1, v1 = C.projected_extent(scene, cam, meshes)
    C.shift_camera_px(scene, cam, (CENTER[0] - (u0 + u1) / 2) * W, (CENTER[1] - (v0 + v1) / 2) * H)
    box = C.projected_extent(scene, cam, meshes)
    if box[0] < PAD or box[1] < PAD or box[2] > 1.0 - PAD:
        raise RuntimeError(f"{name}: il tombolo esce dall'inquadratura {tuple(round(b, 3) for b in box)}")
    path = C.render_to(scene, C.out_path(out, name))
    C.write_meta(path, {"name": name, "w": W, "h": H, "ax": 0.5, "ay": 0.5, "box": [round(b, 4) for b in box]})


if __name__ == "__main__":
    C.run_batch("grafica", NAMES, render_one)
