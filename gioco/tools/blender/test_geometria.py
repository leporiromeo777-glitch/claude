"""Test dei pezzi di geometria condivisi e del controllo delle facce complanari (serve ``bpy``).

Uso: ``$BLENDER_PY tools/blender/test_geometria.py`` (lo lancia anche ``render_all.sh``).
"""

from __future__ import annotations

import math
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import common as C  # noqa: E402  (importa bpy: deve venire prima di bmesh e mathutils)
import bmesh  # noqa: E402
import bpy  # noqa: E402
import scenografia as S  # noqa: E402
import verifica_geometria as V  # noqa: E402
from mathutils import Vector  # noqa: E402

FRONT = C.sun_dir(0.0, 30.0)  # camera dei diorami: frontale, 30° sopra


def fresh() -> None:
    C.reset_scene()
    S.reset()


def meshes() -> list:
    bpy.context.view_layer.update()
    return [o for o in bpy.context.scene.objects if o.type in {"MESH", "CURVE"}]


def front_area(obj) -> float:
    """Area delle facce rivolte verso -Y (la fronte di una parete)."""
    me = obj.data
    return sum(p.area for p in me.polygons if p.normal.y < -0.999)


class CoplanarTest(unittest.TestCase):
    def test_croce_sovrapposta_trovata(self) -> None:
        fresh()
        m = C.mat_paint("legno", "#8A6A4A")
        C.box("v", (0.2, 0.1, 2.0), (0, 0, 0), m)
        C.box("o", (2.0, 0.1, 0.2), (0, 0, 0), m)
        hits = V.coplanar_overlaps(meshes(), FRONT)
        self.assertEqual([(a, b) for a, b, _area, _c in hits], [("o", "v")])
        self.assertAlmostEqual(hits[0][2], 0.2 * 0.2, places=4)

    def test_croce_sfalsata_pulita(self) -> None:
        fresh()
        m = C.mat_paint("legno", "#8A6A4A")
        C.box("v", (0.2, 0.1, 2.0), (0, 0, 0), m)
        C.box("o", (2.0, 0.1 - 2 * S.EPS, 0.2), (0, 0, 0), m)
        self.assertEqual(V.coplanar_overlaps(meshes(), FRONT), [])

    def test_facce_nascoste_ignorate(self) -> None:
        # Due scatole appoggiate a terra con il fondo nello stesso piano: la camera non lo vede.
        fresh()
        m = C.mat_paint("pietra", "#A0A0A0")
        C.box("a", (1.0, 1.0, 1.0), (0, 0, 0.5), m)
        C.box("b", (0.5, 0.5, 0.3), (0.2, 0.2, 0.15), m)
        hits = V.coplanar_overlaps(meshes(), FRONT)
        self.assertEqual(hits, [])
        self.assertEqual(len(V.coplanar_overlaps(meshes(), None)), 1)

    def test_facce_solo_adiacenti(self) -> None:
        fresh()
        m = C.mat_paint("pietra", "#A0A0A0")
        C.box("a", (1.0, 0.2, 1.0), (0, 0, 0), m)
        C.box("b", (1.0, 0.2, 1.0), (1.0, 0, 0), m)
        self.assertEqual(V.coplanar_overlaps(meshes(), FRONT), [])


class WallTest(unittest.TestCase):
    def check_wall(self, hole: list[tuple[float, float]], hole_area: float) -> None:
        fresh()
        wall = S.wall_with_hole("parete", -3.0, 3.0, 0.0, 4.0, 1.0, 0.3, hole, C.mat_paint("muro", "#B9AD9A"))
        bm = bmesh.new()
        bm.from_mesh(wall.data)
        try:
            self.assertTrue(all(e.is_manifold for e in bm.edges), "la parete non è chiusa")
        finally:
            bm.free()
        self.assertAlmostEqual(front_area(wall), 6.0 * 4.0 - hole_area, places=3)
        # Il vano è davvero vuoto: un raggio dal centro del vano verso la parete non la colpisce.
        cx = sum(p[0] for p in hole) / len(hole)
        cz = sum(p[1] for p in hole) / len(hole)
        deps = bpy.context.evaluated_depsgraph_get()
        hit, *_ = bpy.context.scene.ray_cast(deps, Vector((cx, -5.0, cz)), Vector((0.0, 1.0, 0.0)))
        self.assertFalse(hit, "il vano è stato riempito")
        hit, *_ = bpy.context.scene.ray_cast(deps, Vector((2.5, -5.0, 0.5)), Vector((0.0, 1.0, 0.0)))
        self.assertTrue(hit, "la parete piena non c'è")

    def test_vano_rettangolare(self) -> None:
        self.check_wall(S.rect_hole(-1.0, 2.0, 1.2, 1.4), 1.2 * 1.4)

    def test_vano_ad_arco(self) -> None:
        n = 32
        pts = S.arched_hole(0.5, 1.8, 1.0, 1.2, segments=n)
        # Area del poligono (rettangolo più mezzo poligono regolare inscritto nel semicerchio).
        semi = 0.5 * n * 0.5 * 0.5 * math.sin(math.pi / n)
        self.check_wall(pts, 1.0 * 1.2 + semi)

    def test_telaio_senza_sovrapposizioni(self) -> None:
        fresh()
        S.window_frame("f", 0.0, 0.0, 2.0, 1.2, 1.4, bar=0.09, depth=0.1, cross=0.05, cross_depth=0.07, cross_dz=0.08, mat=C.mat_paint("legno", "#6E5539"))
        for az in (-30.0, 0.0, 14.0, 30.0):
            self.assertEqual(V.coplanar_overlaps(meshes(), C.sun_dir(az, 20.0)), [], az)


if __name__ == "__main__":
    argv = [sys.argv[0]] + [a for a in sys.argv[1:] if a.startswith("-v")]
    unittest.main(argv=argv, verbosity=2)
