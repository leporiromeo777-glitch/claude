"""Icona dell'app (GDD 12.5): un fuso sul velluto blu ``#1C2233``.

Produce due render 1024×1024 per ``tools/atlas/pack.py``:

- ``icona/logo``: opaco, fuso con il filo corallo di Ada su velluto (fondo emissivo
  con una vignettatura radiale morbida, colori esatti con view transform Standard);
- ``icona/fuso``: lo stesso fuso su fondo trasparente, da centrare sugli splash.

Uso: ``$BLENDER_PY tools/blender/icona.py [--only icona/logo] [--out <cartella>]``
"""

from __future__ import annotations

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import common as C  # noqa: E402  (importa bpy: deve venire prima di mathutils)
import fusi as F  # noqa: E402
import personaggi as P  # noqa: E402

SIZE = 1024
SAMPLES = 32
NAMES = ["icona/logo", "icona/fuso"]
TILT = 36.0
THICK = 1.2
CENTER_Z = 5.3


def velvet_backdrop() -> None:
    """Piano emissivo con gradiente radiale: centro --velluto-luce, bordi --velluto, angoli --velluto-ombra."""
    mat, nodes, links, bsdf, out = C._new_material("velluto_logo")
    nodes.remove(bsdf)
    tc = nodes.new("ShaderNodeTexCoord")
    grad = nodes.new("ShaderNodeTexGradient")
    grad.gradient_type = "SPHERICAL"
    mp = nodes.new("ShaderNodeMapping")
    mp.inputs["Location"].default_value = (0.0, 0.08, 0.0)
    mp.inputs["Scale"].default_value = (0.105, 0.105, 0.105)
    links.new(tc.outputs["Object"], mp.inputs["Vector"])
    links.new(mp.outputs["Vector"], grad.inputs["Vector"])
    ramp = C._ramp(nodes, [(0.0, C.PALETTE["velluto_ombra"]), (0.42, C.PALETTE["velluto"]), (1.0, "#283047")])
    links.new(grad.outputs["Fac"], ramp.inputs["Fac"])
    em = nodes.new("ShaderNodeEmission")
    links.new(ramp.outputs["Color"], em.inputs["Color"])
    em.inputs["Strength"].default_value = 1.0
    links.new(em.outputs[0], out.inputs["Surface"])
    plane = C.plane("velluto", (30, 30), (0, 6, 5.3), mat, rot=(90, 0, 0))
    plane.visible_shadow = False


def build_spindle() -> list:
    """Fuso inclinato (testa in alto a destra), un po' più grosso del vero perché si legga a 48 px."""
    wood = C.mat_wood("legno_logo", base="#C2A57B", seed_name="icona/legno", scale=1.6, contrast=0.6)
    body = C.lathe("fuso_logo", F.shank_profile(), wood, segments=48, sharp_deg=38)
    barrel = F.thread_barrel("filo_logo", P.thread_material("ada", "filo_ada_logo", windings=22))
    knob = C.sphere("pomolo_logo", 0.2, (0, 0, F.HEAD_TOP + 0.08), wood)
    parts = [body, barrel, knob]
    th = math.radians(TILT)
    mid = F.HEAD_TOP / 2
    loc = (-mid * math.sin(th), 0.0, CENTER_Z - mid * math.cos(th))
    C.group("logo", parts, loc=loc, rot=(0, TILT, 0), scale=(THICK, THICK, 1.0))

    def world(x: float, z: float) -> tuple[float, float, float]:
        return (loc[0] + x * math.cos(th) + z * math.sin(th), -0.9, loc[2] - x * math.sin(th) + z * math.cos(th))

    nx, nz = world(-0.55, 7.2)[0], world(-0.55, 7.2)[2]
    thread = C.tube(
        "filo_libero",
        [(nx, -0.9, nz), (nx - 0.5, -0.9, nz + 0.9), (nx - 1.7, -0.9, nz + 1.7), (nx - 3.2, -0.9, nz + 1.9), (nx - 4.4, -0.9, nz + 2.9), (nx - 4.9, -0.9, nz + 5.5)],
        0.1,
        C.mat_paint("filo_libero_ada", C.THREAD["ada"], rough=0.4, coat=0.3, sheen=0.3),
        resolution=12,
        bevel_res=3,
    )
    return [*parts, thread]


def render_one(name: str, out: str) -> None:
    C.rng(name)
    scene = C.reset_scene()
    logo = name == "icona/logo"
    C.setup_render(scene, SIZE, SIZE, SAMPLES, transparent=not logo, rgba=not logo)
    objs = build_spindle()
    if logo:
        velvet_backdrop()
    C.rig_studio(scene, warm=3.4, fill=1.1, rim=2.4, world=0.3)
    cam = C.ortho_camera(scene, azimuth=0, elevation=0, target=(0, 0, 5.3), ortho_scale=11.6)
    if not logo:
        C.assert_inside(scene, cam, [o for o in objs if o.name != "filo_libero"], name)
    path = C.render_to(scene, C.out_path(out, name))
    C.write_meta(path, {"name": name, "w": SIZE, "h": SIZE, "ax": 0.5, "ay": 0.5})


if __name__ == "__main__":
    C.run_batch("icona", NAMES, render_one)
