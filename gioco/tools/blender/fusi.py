"""Fusi (GDD 12.5): 12 fusi dei personaggi + 2 fusi intagliati (L1), 96×320 trasparenti.

Fuso di legno tornito: pomello in fondo, gambo con anelli, collo con il filo
avvolto del colore del personaggio, collarino, testa intagliata con un dettaglio
(vedi ``personaggi.py``). L'icona del personaggio la disegna il gioco sopra la testa.

Camera frontale ortografica, elevazione 8°, inquadratura sul bounding box di
riferimento (comune a tutti i fusi, così hanno la stessa scala) + 6%.
Ancora: centro della sommità della testa (dove si attacca il filo).

Uso: ``$BLENDER_PY tools/blender/fusi.py [--only fuso/teresa,fuso/stile_1] [--out <cartella>]``
"""

from __future__ import annotations

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import common as C  # noqa: E402  (importa bpy: deve venire prima di mathutils)
import personaggi as P  # noqa: E402
from mathutils import Vector  # noqa: E402

W, H = 96, 320
SAMPLES = 24
STYLES = ["stile_1", "stile_2"]
NAMES = [f"fuso/{c}" for c in P.CHARACTERS_FUSO] + [f"fuso/{s}" for s in STYLES]

HEAD_Z = 8.85
HEAD_R = 0.78
HEAD_TOP = HEAD_Z + HEAD_R
# Riquadro di riferimento comune (unità del modello): tutti i fusi ci stanno dentro.
REF_LO = Vector((-1.62, -1.0, 0.0))
REF_HI = Vector((1.62, 1.0, 10.6))


def shank_profile(neck_top: float = 7.45) -> list[tuple[float, float]]:
    """Profilo del corpo dal pomello in fondo al collo sotto la testa."""
    return [
        (0.0, 0.0),
        (0.16, 0.03),
        (0.30, 0.12),
        (0.40, 0.28),
        (0.43, 0.45),
        (0.40, 0.62),
        (0.30, 0.76),
        (0.21, 0.88),
        (0.21, 0.96),
        (0.31, 1.03),
        (0.34, 1.13),
        (0.31, 1.23),
        (0.24, 1.31),
        (0.26, 2.2),
        (0.30, 3.2),
        (0.34, 4.05),
        (0.36, 4.28),
        (0.47, 4.36),
        (0.48, 4.52),
        (0.38, 4.6),
        (0.41, 4.74),
        (0.51, 4.82),
        (0.51, 4.98),
        (0.40, 5.06),
        (0.32, 5.16),
        (0.29, 5.26),
        (0.27, neck_top),
        (0.42, neck_top + 0.08),
        (0.53, neck_top + 0.16),
        (0.53, neck_top + 0.3),
        (0.40, neck_top + 0.37),
        (0.24, neck_top + 0.48),
        (0.22, 8.12),
        *C.arc(0.0, HEAD_Z, HEAD_R, -72, 90, 14),
    ]


def thread_barrel(name: str, mat, fat: float = 1.0):
    r = 0.27
    prof = [
        (r, 5.3),
        (0.5 * fat + r * (1 - fat), 5.38),
        (0.62 * fat + r * (1 - fat), 5.68),
        (0.67 * fat + r * (1 - fat), 6.38),
        (0.62 * fat + r * (1 - fat), 7.1),
        (0.5 * fat + r * (1 - fat), 7.37),
        (r, 7.44),
    ]
    return C.lathe(name, prof, mat, segments=40, sharp_deg=None, cap=False)


def carved_mats(cid: str) -> P.HeadMats:
    wood = C.mat_wood(f"legno_{cid}", seed_name=f"fuso/{cid}", scale=2.4)
    carved = C.mat_wood(
        f"intaglio_{cid}",
        base=C.mix_hex(C.PALETTE["legno"], C.PALETTE["legno_scuro"], 0.38),
        seed_name=f"fuso/{cid}/intaglio",
        scale=3.0,
    )
    light = C.mat_wood(f"intaglio_chiaro_{cid}", base=C.shade_hex(C.PALETTE["legno"], 0.16), seed_name=f"fuso/{cid}/chiaro", scale=3.0)
    eye = C.mat_paint(f"occhi_{cid}", "#3E2E22", rough=0.5)
    metal = C.mat_wood(f"intaglio_scuro_{cid}", base=C.PALETTE["legno_scuro"], seed_name=f"fuso/{cid}/scuro", scale=3.0)
    return P.HeadMats(main=carved, hair=carved, detail=light, skin=wood, eye=eye, mouth=eye, metal=metal)


def build_character(cid: str) -> list:
    m = carved_mats(cid)
    body = C.lathe(f"fuso_{cid}", shank_profile(), m.skin, segments=36, sharp_deg=38)
    barrel = thread_barrel(f"filo_{cid}", P.thread_material(cid), fat=0.62 if cid == "lino" else 1.0)
    c = Vector((0.0, 0.0, HEAD_Z))
    objs = [body, barrel]
    objs += P.face(f"{cid}_", c, HEAD_R, m, mouth=False)
    objs += P.head_detail(cid, f"{cid}_", c, HEAD_R, m, carved=True)
    return objs


def build_style(style: str) -> list:
    if style == "stile_1":
        # Liscio: noce scuro lucidato, due anelli d'ottone, pomello semplice.
        wood = C.mat_wood("noce", base="#7B5B3E", dark="#4E3826", seed_name="fuso/stile_1", scale=2.2, rough=0.32)
        prof = [
            (0.0, 0.0),
            (0.18, 0.04),
            (0.32, 0.2),
            (0.36, 0.42),
            (0.30, 0.62),
            (0.22, 0.8),
            (0.24, 2.0),
            (0.29, 3.4),
            (0.33, 4.6),
            (0.33, 5.2),
            (0.28, 5.28),
            (0.27, 7.45),
            (0.40, 7.52),
            (0.47, 7.62),
            (0.47, 7.78),
            (0.36, 7.86),
            (0.22, 7.98),
            (0.2, 8.16),
            *C.arc(0.0, HEAD_Z, HEAD_R * 0.86, -70, 90, 14),
        ]
        body = C.lathe("fuso_stile_1", prof, wood, segments=36, sharp_deg=38)
        brass = C.mat_brass()
        rings = [C.torus(f"anello_{i}", 0.31 + 0.02 * i, 0.055, (0, 0, z), brass, seg=32, mseg=8) for i, z in enumerate((3.9, 4.35))]
        tip = C.sphere("goccia", 0.16, (0, 0, HEAD_Z + HEAD_R * 0.86 + 0.08), brass)
        barrel = thread_barrel("filo_stile_1", P.thread_material("lino"), fat=0.85)
        return [body, *rings, tip, barrel]
    if style == "stile_2":
        # A spirale: gambo e testa con scanalature elicoidali.
        wood = C.mat_wood("acero", base="#C4A77E", seed_name="fuso/stile_2", scale=2.6)

        def spiral(r: float, theta: float, z: float) -> float:
            if z < 1.3 or 5.2 < z < 7.5:
                return r
            k = 0.07 if z < 5.2 else 0.05
            return r * (1.0 + k * math.cos(4 * theta - z * 2.6))

        prof = shank_profile()
        dense: list[tuple[float, float]] = []
        for (r0, z0), (r1, z1) in zip(prof, prof[1:]):
            steps = max(1, int(abs(z1 - z0) / 0.12))
            for i in range(steps):
                t = i / steps
                dense.append((r0 + (r1 - r0) * t, z0 + (z1 - z0) * t))
        dense.append(prof[-1])
        body = C.lathe("fuso_stile_2", dense, wood, segments=48, sharp_deg=None, radius_fn=spiral)
        barrel = thread_barrel("filo_stile_2", P.thread_material("lino"), fat=0.85)
        knob = C.sphere("ghianda", 0.26, (0, 0, HEAD_TOP + 0.12), wood, scale=(1, 1, 1.3))
        return [body, barrel, knob]
    raise ValueError(style)


def render_one(name: str, out: str) -> None:
    key = name.split("/", 1)[1]
    C.rng(name)
    scene = C.reset_scene()
    C.setup_render(scene, W, H, SAMPLES, transparent=True)
    objs = build_style(key) if key in STYLES else build_character(key)
    C.rig_studio(scene, warm=3.2, fill=1.0, rim=2.0)
    cam = C.ortho_camera(scene, azimuth=0, elevation=8, target=(0, 0, 5.3))
    C.fit_camera(scene, cam, C.corners(REF_LO, REF_HI), margin=0.06)
    # Ogni fuso deve stare dentro l'inquadratura comune.
    C.assert_inside(scene, cam, objs, name, pad=0.004)
    ax, ay = C.project(scene, cam, (0.0, 0.0, HEAD_TOP))
    path = C.render_to(scene, C.out_path(out, name))
    C.write_meta(path, {"name": name, "w": W, "h": H, "ax": round(ax, 4), "ay": round(ay, 4)})


if __name__ == "__main__":
    C.run_batch("fusi", NAMES, render_one)
