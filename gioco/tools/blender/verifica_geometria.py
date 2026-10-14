"""Controllo geometrico delle scene, senza render: facce complanari sovrapposte.

In Cycles due oggetti diversi con facce nello stesso piano, rivolte dalla stessa parte e
sovrapposte (per esempio due listelli di un telaio che si incrociano con la faccia davanti
allo stesso filo) danno **macchie nere**: il raggio d'ombra che parte da una faccia colpisce
subito l'altra, che sta esattamente lì (Cycles evita l'autointersezione solo sulla stessa
primitiva). Nei render sono quadratini neri agli incroci, difficili da vedere nei fogli di
controllo ridotti.

Lo script costruisce ogni scena come farebbe lo script di gruppo (fusi, figurine, oggetti e
quadri, diorami, icona, grafica in evidenza), senza renderizzarla, e cerca coppie di facce di oggetti diversi che:

- hanno la stessa normale (prodotto scalare > 0,9999) e lo stesso piano (distanza < 2e-5);
- sono rivolte verso la camera ortografica della scena (le facce che la camera non vede,
  come il fondo appoggiato a terra o il retro murato di una cornice, non danno macchie);
- si sovrappongono per un'area > 1e-5 unità² (triangoli intersecati nel piano).

Esce con 1 se ne trova (stampa oggetti, area e posizione), con 0 altrimenti.
``render_all.sh`` lo lancia prima dei render.

Uso: ``$BLENDER_PY tools/blender/verifica_geometria.py [--only dio/stanza,tab] [--list]``
"""

from __future__ import annotations

import math
import os
import sys
import time
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import common as C  # noqa: E402  (importa bpy: deve venire prima di mathutils)
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import diorami as D  # noqa: E402
import figurine as Fg  # noqa: E402
import grafica as Gr  # noqa: E402
import fusi as F  # noqa: E402
import icona as I  # noqa: E402
import oggetti as O  # noqa: E402
import quadri as Q  # noqa: E402
import scenografia as S  # noqa: E402

NORMAL_DOT = 0.9999
PLANE_TOL = 2e-5
AREA_MIN = 1e-5

# Una scena per gruppo di asset (le luci dei diorami non cambiano la geometria).
SCENES: list[str] = (
    [f"fuso/{c}" for c in F.P.CHARACTERS_FUSO]
    + [f"fuso/{s}" for s in F.STYLES]
    + [n for n in Fg.NAMES]
    + [f"obj/{o}" for o in O.OBJECTS]
    + [f"tab/{t}" for t in Q.TABLEAUX]
    + [f"dio/{p}" for p in D.PLACES]
    + ["icona/logo"]
    + list(Gr.NAMES)
)


def build(name: str) -> Vector:
    """Costruisce la scena di ``name`` esattamente come lo script che la rende e restituisce
    la direzione verso la camera (dal soggetto alla camera, come ``common.ortho_camera``)."""
    scene = C.reset_scene()
    S.reset()
    group, key = name.split("/", 1)
    C.rng(name if group != "dio" else f"dio/{key}")
    if group == "fuso":
        F.build_style(key) if key in F.STYLES else F.build_character(key)
        az, el = 0.0, 8.0
    elif group == "fig":
        cid, pose = key.split("/")
        Fg.build(cid, pose.replace("_grezza", ""), pose.endswith("_grezza"))
        az, el = 30.0, 20.0
    elif group == "obj":
        build_fn, rot, az, el = O.SPECS[key]
        objs = build_fn()
        C.group(f"{key}_radice", [o for o in objs if o.parent is None], rot=rot)
    elif group == "tab":
        tb = Q.BUILDERS[key][0](C.no_lines_collection(scene))
        az, el = tb.azimuth, tb.elevation
    elif group == "dio":
        D.BUILDERS[key](C.no_lines_collection(scene))
        az, el = 0.0, 30.0
    elif group == "icona":
        I.build_spindle()
        I.velvet_backdrop()
        az, el = 0.0, 0.0
    elif group == "store":
        Gr.build()
        az, el = Gr.AZIMUTH, Gr.ELEVATION
    else:
        raise ValueError(name)
    bpy.context.view_layer.update()
    return C.sun_dir(az, el)


def _basis(n: Vector) -> tuple[Vector, Vector]:
    a = Vector((1.0, 0.0, 0.0)) if abs(n.x) < 0.9 else Vector((0.0, 1.0, 0.0))
    u = n.cross(a).normalized()
    return u, n.cross(u)


def _area(poly: list[tuple[float, float]]) -> float:
    s = 0.0
    for (x0, y0), (x1, y1) in zip(poly, poly[1:] + poly[:1]):
        s += x0 * y1 - x1 * y0
    return s / 2.0


def _clip(subject: list[tuple[float, float]], clip: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Sutherland-Hodgman: intersezione di due poligoni convessi (clip in senso antiorario)."""
    out = subject
    for (ax, ay), (bx, by) in zip(clip, clip[1:] + clip[:1]):
        if not out:
            break
        inp, out = out, []

        def inside(p: tuple[float, float]) -> bool:
            return (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax) >= -1e-12

        def cut(p: tuple[float, float], q: tuple[float, float]) -> tuple[float, float]:
            dx, dy = q[0] - p[0], q[1] - p[1]
            den = (bx - ax) * dy - (by - ay) * dx
            if abs(den) < 1e-18:
                return q
            t = ((ax - p[0]) * (by - ay) - (ay - p[1]) * (bx - ax)) / -den
            return (p[0] + t * dx, p[1] + t * dy)

        for i, p in enumerate(inp):
            q = inp[i - 1]
            if inside(p):
                if not inside(q):
                    out.append(cut(q, p))
                out.append(p)
            elif inside(q):
                out.append(cut(q, p))
    return out


def _ccw(poly: list[tuple[float, float]]) -> list[tuple[float, float]]:
    return poly if _area(poly) >= 0 else list(reversed(poly))


def coplanar_overlaps(objs: list[bpy.types.Object], toward: Vector | None = None) -> list[tuple[str, str, float, tuple[float, float, float]]]:
    """Coppie (oggetto, oggetto, area, centro) di facce complanari sovrapposte fra oggetti diversi.

    Con ``toward`` (direzione verso la camera) si contano solo le facce che la camera vede."""
    deps = bpy.context.evaluated_depsgraph_get()
    # Triangoli in coordinate mondo, raggruppati per piano (normale e distanza quantizzate).
    buckets: dict[tuple, list] = defaultdict(list)
    for o in objs:
        ev = o.evaluated_get(deps)
        try:
            me = ev.to_mesh()
        except RuntimeError:
            continue
        if me is None:
            continue
        mw = o.matrix_world
        verts = [mw @ v.co for v in me.vertices]
        me.calc_loop_triangles()
        for tri in me.loop_triangles:
            a, b, c = (verts[i] for i in tri.vertices)
            n = (b - a).cross(c - a)
            if n.length < 1e-9:
                continue
            n.normalize()
            if toward is not None and n.dot(toward) <= 1e-6:
                continue
            d = n.dot(a)
            key = (round(n.x * 200), round(n.y * 200), round(n.z * 200), round(d * 1e4))
            buckets[key].append((o.name, n, d, (a, b, c)))
        ev.to_mesh_clear()
    found: dict[tuple[str, str], list] = {}
    keys = sorted(buckets)
    for key in keys:
        group = list(buckets[key])
        nxt = (key[0], key[1], key[2], key[3] + 1)
        group_n = buckets.get(nxt, [])
        cand = group + group_n
        if len({g[0] for g in cand}) < 2:
            continue
        for i, (na, nva, da, ta) in enumerate(group):
            for nb, nvb, db, tb in cand[i + 1 :]:
                if na == nb or nva.dot(nvb) < NORMAL_DOT or abs(da - db) > PLANE_TOL:
                    continue
                u, v = _basis(nva)
                pa = _ccw([(p.dot(u), p.dot(v)) for p in ta])
                pb = _ccw([(p.dot(u), p.dot(v)) for p in tb])
                inter = _clip(pa, pb)
                if len(inter) < 3:
                    continue
                area = abs(_area(inter))
                if area <= AREA_MIN:
                    continue
                cx = sum(p[0] for p in inter) / len(inter)
                cy = sum(p[1] for p in inter) / len(inter)
                center = u * cx + v * cy + nva * da
                pair = tuple(sorted((na, nb)))
                rec = found.setdefault(pair, [0.0, center])
                rec[0] += area
    return [(a, b, rec[0], tuple(round(c, 3) for c in rec[1])) for (a, b), rec in sorted(found.items())]


def main() -> int:
    ns = C.parse_args("verifica_geometria", SCENES)
    t0 = time.time()
    bad = 0
    for name in ns.selected:
        toward = build(name)
        objs = [o for o in bpy.context.scene.objects if o.type in {"MESH", "CURVE"}]
        hits = coplanar_overlaps(objs, toward)
        if hits:
            bad += 1
            C.log(f"{name}: {len(hits)} coppie di facce complanari sovrapposte")
            for a, b, area, center in hits:
                C.log(f"    {a} / {b}: area {area:.5f} vicino a {center}")
    C.log(f"verifica_geometria: {len(ns.selected)} scene in {time.time() - t0:.1f} s, {bad} con facce sovrapposte")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
