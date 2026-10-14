"""Oggetti (GDD 5.6, 12.5) e quadri speciali L1.

Oggetti trasparenti a tre quarti: ``obj/tombolo`` 1024×1024, ``obj/bottiglia``,
``obj/forbici``, ``obj/libro``, ``obj/fuso_faro``, ``obj/fascio_lettere`` 256×256
(24 campioni, ancora al centro). Quadri ``tab/<nome>`` 1024×768 opachi come i
diorami (32 campioni, contorni Freestyle): ``sedia_vuota``, ``tempesta``,
``secca``, ``sacrestia_lettere``.

Uso: ``$BLENDER_PY tools/blender/oggetti.py [--only obj/libro,tab/secca] [--out <cartella>]``
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import common as C  # noqa: E402  (importa bpy: deve venire prima di mathutils)
import quadri as Q  # noqa: E402
import scenografia as S  # noqa: E402

SPRITE_SAMPLES = 24
OBJECTS = ["tombolo", "bottiglia", "forbici", "libro", "fuso_faro", "fascio_lettere"]
NAMES = [f"obj/{o}" for o in OBJECTS] + [f"tab/{t}" for t in Q.TABLEAUX]

# (costruttore, rotazione dell'oggetto in gradi, azimut, elevazione della camera)
SPECS = {
    "tombolo": (lambda: S.tombolo("tombolo"), (0, 0, 0), 28, 24),
    "bottiglia": (lambda: S.bottle("bottiglia"), (0, -58, 0), 20, 22),
    "forbici": (lambda: S.scissors("forbici", open_deg=30.0), (0, 0, 52), 20, 58),
    "libro": (lambda: S.book("libro"), (0, 0, -18), 25, 38),
    "fuso_faro": (lambda: S.lighthouse_bobbin("fuso_faro"), (0, -48, 0), 22, 18),
    "fascio_lettere": (lambda: S.letters_bundle("fascio"), (0, 0, 14), 25, 40),
}


# Ambiente per gli oggetti riflettenti: (colore del mondo, intensità, vetro trasparente nell'alfa).
ENV = {
    "bottiglia": ("#D6D8D0", 1.1, False),
    "forbici": ("#C9CCC8", 1.0, True),
}


def render_object(name: str, key: str, out: str) -> None:
    size = 1024 if key == "tombolo" else 256
    scene = C.reset_scene()
    S.reset()
    C.setup_render(scene, size, size, SPRITE_SAMPLES, transparent=True)
    build, rot, az, el = SPECS[key]
    objs = build()
    meshes = [o for o in objs if o.type in {"MESH", "CURVE"}]
    roots = [o for o in objs if o.parent is None]
    C.group(f"{key}_radice", roots, rot=rot)
    C.rig_studio(scene, warm=3.0, fill=1.0, rim=1.8)
    if key in ENV:
        # Vetro e metallo riflettono l'ambiente: serve un mondo chiaro perché si leggano.
        color, strength, glass_alpha = ENV[key]
        C.set_world(scene, color, strength)
        scene.cycles.film_transparent_glass = glass_alpha
    lo, hi = C.world_bbox(meshes)
    center = (lo + hi) / 2
    cam = C.ortho_camera(scene, azimuth=az, elevation=el, target=tuple(center))
    C.fit_camera(scene, cam, C.object_points(meshes), margin=0.06)
    C.assert_inside(scene, cam, meshes, name)
    path = C.render_to(scene, C.out_path(out, name))
    C.write_meta(path, {"name": name, "w": size, "h": size, "ax": 0.5, "ay": 0.5})


def render_one(name: str, out: str) -> None:
    group, key = name.split("/", 1)
    C.rng(name)
    if group == "obj":
        render_object(name, key, out)
    else:
        Q.render_tableau(name, key, out)


if __name__ == "__main__":
    C.run_batch("oggetti", NAMES, render_one)
