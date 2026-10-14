"""Test degli asset impacchettati (criteri di accettazione del pacchetto B).

Verifica su quello che il gioco riceve (``public/assets``, ``public/icons``, ``assets/``):

- ``manifest.json`` conforme ad ``AssetManifest`` (ARCHITETTURA 4) e con esattamente i nomi
  L1 (fusi, figurine, Ada grezza, oggetti, diorami, quadri), percorsi relativi esistenti e
  gruppi ``core`` / ``dio`` / ``tab``;
- frame alla misura nominale, dentro la pagina, senza sovrapposizioni (padding 2 px,
  estrusione 1 px verificata sui pixel), ancore sensate;
- budget: pagine ≤ 2048×2048 e ≤ 3 MB in tutto, ogni WebP ≤ 90 KB, totale ≤ 6 MB;
- ``assets/logo.png`` 1024×1024 senza pixel trasparenti, splash 2732×2732, icone web;
- impaginazione deterministica (stessi rettangoli a ogni esecuzione, qualunque sia l'ordine
  dei render) e catalogo allineato a ``EXPECTED_FRAMES`` / ``EXPECTED_IMAGES`` del gioco.

Uso: ``python3 tools/atlas/test_assets.py`` (oppure con ``$BLENDER_PY``); serve Pillow.
"""

from __future__ import annotations

import json
import os
import random
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import catalogo as K  # noqa: E402
import pack  # noqa: E402
from PIL import Image  # noqa: E402

MANIFEST = os.path.join(K.PUBLIC_ASSETS, "manifest.json")


def load_manifest() -> dict:
    with open(MANIFEST, encoding="utf-8") as f:
        return json.load(f)


def is_num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


class ManifestTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if not os.path.exists(MANIFEST):
            raise unittest.SkipTest("manca public/assets/manifest.json: eseguire npm run assets:render")
        cls.m = load_manifest()

    def test_forma_asset_manifest(self) -> None:
        m = self.m
        self.assertEqual(set(m.keys()), {"version", "atlases", "images"})
        self.assertTrue(is_num(m["version"]))
        self.assertIsInstance(m["atlases"], list)
        self.assertGreater(len(m["atlases"]), 0)
        for a in m["atlases"]:
            self.assertEqual(set(a.keys()), {"image", "width", "height", "frames"})
            self.assertIsInstance(a["image"], str)
            self.assertTrue(is_num(a["width"]) and is_num(a["height"]))
            self.assertIsInstance(a["frames"], dict)
            for name, f in a["frames"].items():
                self.assertEqual(set(f.keys()), {"x", "y", "w", "h", "ax", "ay"}, name)
                self.assertTrue(all(is_num(f[k]) for k in f), name)
        self.assertIsInstance(m["images"], dict)
        for name, i in m["images"].items():
            self.assertEqual(set(i.keys()), {"src", "w", "h", "group"}, name)
            self.assertIsInstance(i["src"], str)
            self.assertIsInstance(i["group"], str)
            self.assertTrue(is_num(i["w"]) and is_num(i["h"]))

    def test_nomi_esatti(self) -> None:
        frames: list[str] = []
        for a in self.m["atlases"]:
            frames.extend(a["frames"].keys())
        self.assertEqual(len(frames), len(set(frames)), "frame duplicati fra le pagine")
        self.assertEqual(sorted(frames), sorted(K.FRAMES))
        self.assertEqual(sorted(self.m["images"].keys()), sorted(K.IMAGES))
        self.assertEqual(len(K.FRAMES), 14 + 33 + 3 + 6)
        self.assertEqual(len(K.IMAGES), 21 + 4)

    def test_percorsi_e_gruppi(self) -> None:
        for a in self.m["atlases"]:
            self.assertFalse(a["image"].startswith(("/", "./", "public")), a["image"])
            self.assertTrue(os.path.exists(os.path.join(K.PUBLIC_ASSETS, a["image"])), a["image"])
        for name, i in self.m["images"].items():
            self.assertTrue(i["src"].endswith(".webp"), name)
            self.assertTrue(os.path.exists(os.path.join(K.PUBLIC_ASSETS, i["src"])), i["src"])
            self.assertEqual(i["group"], name.split("/")[0])
            self.assertEqual((i["w"], i["h"]), (1024, 768), name)

    def test_frame_nelle_pagine_senza_sovrapposizioni(self) -> None:
        e, pad = K.ATLAS_EXTRUDE, K.ATLAS_PADDING
        for a in self.m["atlases"]:
            cells = []
            for name, f in a["frames"].items():
                self.assertEqual((f["w"], f["h"]), K.nominal_size(name), name)
                self.assertGreaterEqual(f["x"] - e, pad, name)
                self.assertGreaterEqual(f["y"] - e, pad, name)
                self.assertLessEqual(f["x"] + f["w"] + e, a["width"], name)
                self.assertLessEqual(f["y"] + f["h"] + e, a["height"], name)
                cells.append((f["x"] - e, f["y"] - e, f["x"] + f["w"] + e, f["y"] + f["h"] + e, name))
            for i, c in enumerate(cells):
                for d in cells[i + 1 :]:
                    apart = c[2] + pad <= d[0] or d[2] + pad <= c[0] or c[3] + pad <= d[1] or d[3] + pad <= c[1]
                    self.assertTrue(apart, f"{c[4]} e {d[4]} si toccano")

    def test_ancore(self) -> None:
        for a in self.m["atlases"]:
            for name, f in a["frames"].items():
                if name.startswith("fig/"):
                    self.assertAlmostEqual(f["ax"], 0.5, delta=0.01, msg=name)
                    self.assertAlmostEqual(f["ay"], 0.92, delta=0.01, msg=name)
                elif name.startswith("fuso/"):
                    self.assertAlmostEqual(f["ax"], 0.5, delta=0.02, msg=name)
                    self.assertTrue(0.0 < f["ay"] < 0.2, name)
                else:
                    self.assertEqual((f["ax"], f["ay"]), (0.5, 0.5), name)

    def test_pagine_ed_estrusione(self) -> None:
        e = K.ATLAS_EXTRUDE
        for a in self.m["atlases"]:
            img = Image.open(os.path.join(K.PUBLIC_ASSETS, a["image"]))
            self.assertEqual(img.size, (a["width"], a["height"]))
            self.assertLessEqual(max(img.size), K.ATLAS_MAX)
            self.assertEqual(img.mode, "RGBA")
            px = img.load()
            for name, f in list(a["frames"].items())[:8]:
                x, y, w, h = f["x"], f["y"], f["w"], f["h"]
                for yy in (y, y + h // 2, y + h - 1):
                    self.assertEqual(px[x - e, yy], px[x, yy], f"{name}: estrusione a sinistra")
                    self.assertEqual(px[x + w - 1 + e, yy], px[x + w - 1, yy], f"{name}: estrusione a destra")
                for xx in (x, x + w // 2, x + w - 1):
                    self.assertEqual(px[xx, y - e], px[xx, y], f"{name}: estrusione in alto")
                    self.assertEqual(px[xx, y + h - 1 + e], px[xx, y + h - 1], f"{name}: estrusione in basso")
            # Gli sprite non sono vuoti.
            for name, f in a["frames"].items():
                alpha = img.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"])).getchannel("A")
                self.assertGreater(alpha.getextrema()[1], 200, f"{name}: frame vuoto")

    def test_budget(self) -> None:
        atlas_bytes = sum(os.path.getsize(os.path.join(K.PUBLIC_ASSETS, a["image"])) for a in self.m["atlases"])
        self.assertLessEqual(atlas_bytes, K.BUDGET_ATLAS_TOTAL)
        for name, i in self.m["images"].items():
            path = os.path.join(K.PUBLIC_ASSETS, i["src"])
            self.assertLessEqual(os.path.getsize(path), K.BUDGET_WEBP_EACH, name)
            with Image.open(path) as im:
                self.assertEqual(im.format, "WEBP", name)
                self.assertEqual(im.size, (1024, 768), name)
        total = 0
        for root, _dirs, files in os.walk(K.PUBLIC_ASSETS):
            total += sum(os.path.getsize(os.path.join(root, f)) for f in files)
        self.assertLessEqual(total, K.BUDGET_TOTAL)

    def test_nessun_file_estraneo(self) -> None:
        listed = {a["image"] for a in self.m["atlases"]} | {i["src"] for i in self.m["images"].values()} | {"manifest.json"}
        found = set()
        for root, _dirs, files in os.walk(K.PUBLIC_ASSETS):
            for f in files:
                found.add(os.path.relpath(os.path.join(root, f), K.PUBLIC_ASSETS).replace(os.sep, "/"))
        self.assertEqual(found, listed)


class PaletteTest(unittest.TestCase):
    """Il filo dei fusi e la fascia delle figurine hanno la tinta di GDD 5.4 (misurata sui pixel)."""

    #: Distanza RGB massima fra il colore medio misurato e quello nominale.
    MAX_FUSO = 45.0
    MAX_FASCIA = 70.0

    @classmethod
    def setUpClass(cls) -> None:
        if not os.path.exists(MANIFEST):
            raise unittest.SkipTest("manca public/assets/manifest.json")
        import contact_sheet as CS

        cls.CS = CS
        cls.assets = CS.Assets(K.PUBLIC_ASSETS)

    def test_fili_dei_fusi(self) -> None:
        CS = self.CS
        for cid in K.CHARACTERS_FUSO:
            target = CS.hex_rgb(CS.THREAD[cid])
            img, _ax, _ay = self.assets.frame(f"fuso/{cid}")
            col, dist = CS.band_color(img, 42, 54, 80, 200, target)
            self.assertLessEqual(dist, self.MAX_FUSO, f"fuso/{cid}: filo {col} lontano da {CS.THREAD[cid]}")

    def test_fasce_delle_figurine(self) -> None:
        CS = self.CS
        for cid in K.CHARACTERS_FIG:
            target = CS.hex_rgb(CS.THREAD[cid])
            img, _ax, _ay = self.assets.frame(f"fig/{cid}/ferma")
            col, dist = CS.band_color(img, 122, 134, 90, 200, target)
            self.assertLessEqual(dist, self.MAX_FASCIA, f"fig/{cid}: fascia {col} lontana da {CS.THREAD[cid]}")


class NativeTest(unittest.TestCase):
    def test_logo_opaco(self) -> None:
        path = os.path.join(K.NATIVE_ASSETS, "logo.png")
        self.assertTrue(os.path.exists(path), path)
        with Image.open(path) as im:
            self.assertEqual(im.size, (K.LOGO_SIZE, K.LOGO_SIZE))
            alpha = im.convert("RGBA").getchannel("A")
            self.assertEqual(alpha.getextrema(), (255, 255), "il logo ha pixel trasparenti")

    def test_splash(self) -> None:
        for f in ("splash.png", "splash-dark.png"):
            with Image.open(os.path.join(K.NATIVE_ASSETS, f)) as im:
                self.assertEqual(im.size, (K.SPLASH_SIZE, K.SPLASH_SIZE), f)
                self.assertEqual(im.convert("RGB").getpixel((5, 5)), pack.hex_rgb(K.SPLASH_BG), f)
                self.assertEqual(im.convert("RGBA").getchannel("A").getextrema(), (255, 255), f)

    def test_icone_web(self) -> None:
        for f, px in K.WEB_ICONS.items():
            with Image.open(os.path.join(K.PUBLIC_ICONS, f)) as im:
                self.assertEqual(im.size, (px, px), f)


class LayoutTest(unittest.TestCase):
    def items(self) -> list[tuple[str, int, int]]:
        return [(n, *K.nominal_size(n)) for n in K.FRAMES]

    def test_deterministico(self) -> None:
        a = pack.layout(self.items())
        shuffled = self.items()
        random.Random(7).shuffle(shuffled)
        b = pack.layout(shuffled)
        self.assertEqual(a, b)

    def test_rispetta_i_limiti(self) -> None:
        placed, sizes = pack.layout(self.items())
        self.assertEqual(len(placed), len(K.FRAMES))
        for w, h in sizes:
            self.assertLessEqual(w, K.ATLAS_MAX)
            self.assertLessEqual(h, K.ATLAS_MAX)
            self.assertEqual((w % 4, h % 4), (0, 0))

    def test_pagina_piccola(self) -> None:
        items = [("a", 100, 100), ("b", 100, 100), ("c", 100, 100), ("e", 100, 100), ("d", 100, 40)]
        placed, sizes = pack.layout(items, max_size=220)
        self.assertEqual(len(sizes), 2)
        self.assertEqual({p.name: p.page for p in placed}, {"a": 0, "b": 0, "c": 0, "e": 0, "d": 1})
        pos = {p.name: (p.x, p.y) for p in placed}
        # Celle di 102 px (estrusione 1) separate da 2 px di padding, anche dal bordo.
        self.assertEqual(pos["a"], (3, 3))
        self.assertEqual(pos["b"], (107, 3))
        self.assertEqual(pos["c"], (3, 107))
        self.assertEqual(sizes[0], (212, 212))
        with self.assertRaises(ValueError):
            pack.layout([("enorme", 300, 10)], max_size=220)

    def test_colonne_impilate(self) -> None:
        placed, _sizes = pack.layout([("grande", 100, 100), ("s1", 40, 40), ("s2", 40, 40)], max_size=220)
        pos = {p.name: (p.x, p.y) for p in placed}
        self.assertEqual(pos["s1"], (107, 3))
        self.assertEqual(pos["s2"], (107, 47))

    def test_manifest_stabile(self) -> None:
        """I rettangoli del manifest pubblicato sono quelli che l'impaginazione dà oggi."""
        if not os.path.exists(MANIFEST):
            self.skipTest("manca il manifest")
        m = load_manifest()
        placed, sizes = pack.layout(self.items())
        for p in placed:
            f = m["atlases"][p.page]["frames"][p.name]
            self.assertEqual((f["x"], f["y"], f["w"], f["h"]), (p.x, p.y, p.w, p.h), p.name)
        self.assertEqual([(a["width"], a["height"]) for a in m["atlases"]], sizes)


class CatalogoTest(unittest.TestCase):
    def test_allineato_al_gioco(self) -> None:
        """Il catalogo coincide con gli elenchi di ``src/core/assets.ts`` chiesti dalla scena di avvio."""
        path = os.path.join(K.GAME_ROOT, "src", "core", "assets.ts")
        with open(path, encoding="utf-8") as f:
            ts = f.read()

        def arr(const: str) -> list[str]:
            mt = re.search(rf"const {const} = \[([^\]]*)\]", ts)
            self.assertIsNotNone(mt, const)
            return re.findall(r"'([^']+)'", mt.group(1))  # type: ignore[union-attr]

        self.assertEqual(arr("CHARACTERS_WITH_FUSO"), K.CHARACTERS_FUSO)
        self.assertEqual(arr("CHARACTERS_WITH_FIG"), K.CHARACTERS_FIG)
        self.assertEqual(arr("POSES"), K.POSES)
        self.assertEqual(arr("DIO_PLACES"), K.PLACES)
        self.assertEqual(arr("LIGHTS"), K.LIGHTS)
        for word in K.OBJECTS + K.TABLEAUX + ["stile_1", "stile_2", "_grezza"]:
            self.assertIn(word, ts)

    def test_colori_dei_fili_allineati(self) -> None:
        """I colori dei fili della pipeline (``common.py`` e i fogli di controllo) sono quelli del
        gioco (``src/content/characters.json``, GDD 5.4)."""
        import contact_sheet as CS

        with open(os.path.join(K.GAME_ROOT, "tools", "blender", "common.py"), encoding="utf-8") as f:
            src = f.read()
        block = re.search(r"THREAD = \{(.*?)\}", src, re.S)
        self.assertIsNotNone(block)
        pipeline = dict(re.findall(r'"(\w+)": "(#[0-9A-Fa-f]{6})"', block.group(1)))  # type: ignore[union-attr]
        self.assertEqual(pipeline, CS.THREAD)
        chars = os.path.join(K.GAME_ROOT, "src", "content", "characters.json")
        if not os.path.exists(chars):
            self.skipTest("manca src/content/characters.json")
        with open(chars, encoding="utf-8") as f:
            game = {c["id"]: c["color"].upper() for c in json.load(f) if "color" in c}
        for cid in K.CHARACTERS_FUSO:
            if cid in game:
                self.assertEqual(pipeline[cid].upper(), game[cid], cid)


if __name__ == "__main__":
    unittest.main(verbosity=2)
