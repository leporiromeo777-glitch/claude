"""Fogli di controllo degli asset (ARCHITETTURA 12): ``tools/blender/out/contact_*.png``.

Non sono pubblicati (``tools/blender/out/`` è ignorata da git): servono alla revisione
visiva di sagome, palette e inquadrature. Leggono quello che il gioco riceve davvero
(``public/assets/manifest.json``, le pagine dell'atlas, i WebP, il logo e le icone),
non i render grezzi, così l'estrusione e la compressione si vedono come in partita.

Fogli prodotti:

- ``contact_fusi.png``: i 14 fusi a grandezza naturale su velluto, con l'ancora marcata,
  e sotto la stessa fila a 40 px di larghezza (un tombolo da 8 colonne su 360 px);
- ``contact_figurine.png``: le 36 figurine su velluto e su carta, con l'ancora del piede,
  più una fila ridotta a 72 px (vignetta su telefono);
- ``contact_oggetti.png``: gli oggetti della sera e il tombolo su velluto e su scacchiera;
- ``contact_diorami.png``: i 21 diorami a 1/4 con l'area sicura 768×576 tratteggiata;
- ``contact_quadri.png``: i 4 quadri a 1/2 con l'area sicura;
- ``contact_atlas.png``: le pagine dell'atlas su scacchiera (trasparenza ed estrusione);
- ``contact_icone.png``: logo, splash e icone web alla loro misura (e il favicon ingrandito);
- ``contact_palette.png``: per ogni personaggio il colore del filo (GDD 5.4) accanto al
  colore medio misurato sulla fascia della figurina e sul filo del fuso.

Uso: ``$BLENDER_PY tools/atlas/contact_sheet.py [--assets public/assets] [--out tools/blender/out]``
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import catalogo as K  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

VELLUTO = (0x1C, 0x22, 0x33)
CARTA = (0xED, 0xE4, 0xD3)
INCHIOSTRO = (0x2B, 0x26, 0x22)
TESTO = (0xF3, 0xEE, 0xE4)
ERRORE = (0xE0, 0x60, 0x4F)

THREAD = {
    "teresa": "#2F5DA8",
    "marta": "#C0442C",
    "piero": "#6E3D96",
    "gino": "#4FB3E0",
    "bepi": "#E07B24",
    "nina": "#E8C12E",
    "zeno": "#1F8A78",
    "lunardi": "#D9DEE3",
    "livia": "#15110E",
    "ada": "#F07C6C",
    "clotilde": "#EFE3C8",
    "lino": "#8E8676",
}


def font(size: int = 13) -> ImageFont.ImageFont:
    """DejaVu Sans se c'è (ha ², × e Δ, che il carattere predefinito di Pillow non ha), altrimenti quello predefinito."""
    for name in ("DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # Pillow senza FreeType
        return ImageFont.load_default()


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


class Assets:
    """Accesso agli asset impacchettati, come li vede il gioco."""

    def __init__(self, root: str):
        self.root = root
        with open(os.path.join(root, "manifest.json"), encoding="utf-8") as f:
            self.manifest = json.load(f)
        self.pages = [Image.open(os.path.join(root, a["image"])).convert("RGBA") for a in self.manifest["atlases"]]
        self.index = {}
        for i, a in enumerate(self.manifest["atlases"]):
            for name, fr in a["frames"].items():
                self.index[name] = (i, fr)

    def frame(self, name: str) -> tuple[Image.Image, float, float]:
        i, fr = self.index[name]
        img = self.pages[i].crop((fr["x"], fr["y"], fr["x"] + fr["w"], fr["y"] + fr["h"]))
        return img, fr["ax"], fr["ay"]

    def image(self, name: str) -> Image.Image:
        info = self.manifest["images"][name]
        return Image.open(os.path.join(self.root, info["src"])).convert("RGB")


def checker(w: int, h: int, s: int = 12) -> Image.Image:
    img = Image.new("RGB", (w, h), (200, 200, 200))
    d = ImageDraw.Draw(img)
    for y in range(0, h, s):
        for x in range(0, w, s):
            if (x // s + y // s) % 2:
                d.rectangle((x, y, x + s - 1, y + s - 1), fill=(160, 160, 160))
    return img


def label(d: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, fill=TESTO, size: int = 13) -> None:
    d.text(xy, text, fill=fill, font=font(size))


def mark_anchor(d: ImageDraw.ImageDraw, x: float, y: float, r: int = 4) -> None:
    d.line((x - r, y, x + r, y), fill=ERRORE, width=1)
    d.line((x, y - r, x, y + r), fill=ERRORE, width=1)


def dashed_rect(d: ImageDraw.ImageDraw, box: tuple[float, float, float, float], fill, dash: int = 6) -> None:
    x0, y0, x1, y1 = box
    for x in range(int(x0), int(x1), dash * 2):
        d.line((x, y0, min(x + dash, x1), y0), fill=fill)
        d.line((x, y1, min(x + dash, x1), y1), fill=fill)
    for y in range(int(y0), int(y1), dash * 2):
        d.line((x0, y, x0, min(y + dash, y1)), fill=fill)
        d.line((x1, y, x1, min(y + dash, y1)), fill=fill)


def sheet_fusi(a: Assets, out: str) -> str:
    names = [f"fuso/{c}" for c in K.CHARACTERS_FUSO] + ["fuso/stile_1", "fuso/stile_2"]
    cw, pad = 112, 24
    small_w = 40
    small_h = round(320 * small_w / 96)
    W = pad * 2 + cw * len(names)
    H = pad + 20 + 320 + 30 + small_h + pad + 20
    img = Image.new("RGB", (W, H), VELLUTO)
    d = ImageDraw.Draw(img)
    for i, n in enumerate(names):
        fr, ax, ay = a.frame(n)
        x = pad + i * cw + (cw - 96) // 2
        y = pad + 20
        img.paste(fr, (x, y), fr)
        mark_anchor(d, x + ax * 96, y + ay * 320)
        label(d, (pad + i * cw + 4, pad), n.split("/")[1])
        sm = fr.resize((small_w, small_h), Image.LANCZOS)
        sx = pad + i * cw + (cw - small_w) // 2
        img.paste(sm, (sx, y + 320 + 30), sm)
    label(d, (pad, H - pad - 4), "sotto: 40 px di larghezza (tombolo da 8 colonne su uno schermo da 360 px)")
    path = os.path.join(out, "contact_fusi.png")
    img.save(path)
    return path


def sheet_figurine(a: Assets, out: str) -> str:
    names = [f"fig/{c}/{p}" for c in K.CHARACTERS_FIG for p in K.POSES] + [f"fig/ada/{p}_grezza" for p in K.POSES]
    cols = 9
    cell = 268
    rows = -(-len(names) // cols)
    small = 72
    W = cols * cell + 24
    H = rows * (cell + 18) * 2 + 40 + small + 60
    img = Image.new("RGB", (W, H), VELLUTO)
    d = ImageDraw.Draw(img)
    for half, bg in enumerate((VELLUTO, CARTA)):
        y_off = half * rows * (cell + 18)
        d.rectangle((0, y_off, W, y_off + rows * (cell + 18)), fill=bg)
        for i, n in enumerate(names):
            fr, ax, ay = a.frame(n)
            x = 12 + (i % cols) * cell + 6
            y = y_off + (i // cols) * (cell + 18) + 18
            img.paste(fr, (x, y), fr)
            mark_anchor(d, x + ax * 256, y + ay * 256)
            label(d, (x, y - 16), n[4:], fill=TESTO if half == 0 else INCHIOSTRO)
    y = rows * (cell + 18) * 2 + 20
    for i, n in enumerate(names):
        fr, _ax, _ay = a.frame(n)
        sm = fr.resize((small, small), Image.LANCZOS)
        img.paste(sm, (12 + i * (small - 6), y), sm)
    label(d, (12, H - 28), "fila in basso: 72 px (figurina in una vignetta su telefono); croce rossa = ancora (piede della basetta)")
    path = os.path.join(out, "contact_figurine.png")
    img.save(path)
    return path


def sheet_oggetti(a: Assets, out: str) -> str:
    small = [f"obj/{o}" for o in K.OBJECTS if o != "tombolo"]
    W = 512 + 24 + 2 * (256 + 12) + 24
    H = 24 + 512 + 24 + 256 + 40
    img = Image.new("RGB", (W, H), VELLUTO)
    d = ImageDraw.Draw(img)
    tomb, _ax, _ay = a.frame("obj/tombolo")
    t2 = tomb.resize((512, 512), Image.LANCZOS)
    img.paste(t2, (12, 24), t2)
    label(d, (12, 6), "obj/tombolo (1024², qui a 1/2)")
    for i, n in enumerate(small):
        fr, _ax, _ay = a.frame(n)
        col, row = i % 2, i // 2
        x = 512 + 36 + col * 268
        y = 24 + row * 262 if row < 2 else 24 + 512 + 24
        if row == 2:
            x = 12 + col * 268
        bg = checker(256, 256) if (i % 2) else None
        if bg is not None:
            img.paste(bg, (x, y))
        img.paste(fr, (x, y), fr)
        label(d, (x, y + 240), n)
    path = os.path.join(out, "contact_oggetti.png")
    img.save(path)
    return path


def sheet_images(a: Assets, out: str, names: list[str], cols: int, scale: float, fname: str) -> str:
    w, h = int(1024 * scale), int(768 * scale)
    rows = -(-len(names) // cols)
    W = cols * (w + 12) + 12
    H = rows * (h + 26) + 12
    img = Image.new("RGB", (W, H), VELLUTO)
    d = ImageDraw.Draw(img)
    for i, n in enumerate(names):
        x = 12 + (i % cols) * (w + 12)
        y = 24 + (i // cols) * (h + 26)
        im = a.image(n).resize((w, h), Image.LANCZOS)
        img.paste(im, (x, y))
        dashed_rect(d, (x + w * 0.125, y + h * 0.125, x + w * 0.875, y + h * 0.875), (255, 255, 255))
        size = os.path.getsize(os.path.join(a.root, a.manifest["images"][n]["src"]))
        label(d, (x, y - 16), f"{n}  ({size / 1024:.0f} KB)")
    path = os.path.join(out, fname)
    img.save(path)
    return path


def sheet_atlas(a: Assets, out: str) -> str:
    scale = 0.5
    pages = [p.resize((int(p.width * scale), int(p.height * scale)), Image.LANCZOS) for p in a.pages]
    W = sum(p.width for p in pages) + 12 * (len(pages) + 1)
    H = max(p.height for p in pages) + 36
    img = Image.new("RGB", (W, H), VELLUTO)
    d = ImageDraw.Draw(img)
    x = 12
    for i, p in enumerate(pages):
        img.paste(checker(p.width, p.height), (x, 24))
        img.paste(p, (x, 24), p)
        info = a.manifest["atlases"][i]
        size = os.path.getsize(os.path.join(a.root, info["image"]))
        label(d, (x, 6), f"{info['image']} {info['width']}×{info['height']} ({size / 1024:.0f} KB), a 1/2")
        x += p.width + 12
    path = os.path.join(out, "contact_atlas.png")
    img.save(path)
    return path


def sheet_icone(out: str) -> str:
    logo = Image.open(os.path.join(K.NATIVE_ASSETS, "logo.png")).convert("RGB")
    splash = Image.open(os.path.join(K.NATIVE_ASSETS, "splash.png")).convert("RGB").resize((512, 512), Image.LANCZOS)
    icons = [Image.open(os.path.join(K.PUBLIC_ICONS, f)).convert("RGB") for f in K.WEB_ICONS]
    W, H = 512 + 512 + 512 + 48, 512 + 60
    img = Image.new("RGB", (W, H), (60, 60, 64))
    d = ImageDraw.Draw(img)
    img.paste(logo.resize((512, 512), Image.LANCZOS), (12, 30))
    label(d, (12, 8), "assets/logo.png (1024, a 1/2)")
    img.paste(splash, (536, 30))
    label(d, (536, 8), "assets/splash.png (2732, ridotto)")
    x, y = 1060, 30
    for f, ic in zip(K.WEB_ICONS, icons):
        if ic.width > 256:
            ic = ic.resize((256, 256), Image.LANCZOS)
        img.paste(ic, (x, y))
        label(d, (x, y + ic.height + 2), f)
        y += ic.height + 24
    fav = icons[-1].resize((128, 128), Image.NEAREST)
    img.paste(fav, (x + 200, 30))
    label(d, (x + 200, 162), "favicon ×2")
    # Come appare l'icona in piccolo su sfondi chiari e scuri.
    for k, bg in enumerate(((240, 240, 240), (20, 20, 20))):
        box = Image.new("RGB", (80, 80), bg)
        box.paste(logo.resize((48, 48), Image.LANCZOS), (16, 16))
        img.paste(box, (x + 200 + k * 90, 200))
    path = os.path.join(out, "contact_icone.png")
    img.save(path)
    return path


def band_color(img: Image.Image, x0: int, x1: int, y0: int, y1: int, target: tuple[int, int, int], rows: int = 6) -> tuple[tuple[int, int, int], float]:
    """Colore medio della fascia di ``rows`` righe (fra y0 e y1, colonne x0-x1) più vicina al colore atteso.

    Serve a confrontare il filo dipinto o avvolto con il colore di GDD 5.4 senza sapere a che
    altezza cade la fascia (cambia con la statura della figurina). Restituisce il colore e la
    distanza RGB media dal colore atteso."""
    px = img.load()
    best: tuple[float, tuple[int, int, int]] | None = None
    for y in range(y0, y1 - rows):
        acc = [0, 0, 0]
        n = 0
        for yy in range(y, y + rows):
            for xx in range(x0, x1):
                r, g, b, al = px[xx, yy]
                if al > 200:
                    acc[0] += r
                    acc[1] += g
                    acc[2] += b
                    n += 1
        if n < (x1 - x0) * rows * 0.8:
            continue
        mean = (acc[0] // n, acc[1] // n, acc[2] // n)
        dist = sum((mean[i] - target[i]) ** 2 for i in range(3)) ** 0.5
        if best is None or dist < best[0]:
            best = (dist, mean)
    if best is None:
        return (0, 0, 0), 999.0
    return best[1], best[0]


def sheet_palette(a: Assets, out: str) -> str:
    rows = K.CHARACTERS_FUSO
    W, H = 760, 34 * len(rows) + 50
    img = Image.new("RGB", (W, H), VELLUTO)
    d = ImageDraw.Draw(img)
    label(d, (12, 8), "personaggio   filo GDD 5.4       filo del fuso (misurato)     fascia della figurina (misurata)")
    for i, cid in enumerate(rows):
        y = 34 + i * 34
        target = hex_rgb(THREAD[cid])
        label(d, (12, y + 6), cid)
        d.rectangle((120, y, 200, y + 26), fill=target)
        label(d, (206, y + 6), THREAD[cid])
        fuso, _ax, _ay = a.frame(f"fuso/{cid}")
        col, dist = band_color(fuso, 42, 54, 80, 200, target)
        d.rectangle((300, y, 380, y + 26), fill=col)
        label(d, (386, y + 6), f"Δ {dist:.0f}")
        if cid in K.CHARACTERS_FIG:
            fig, _ax, _ay = a.frame(f"fig/{cid}/ferma")
            col, dist = band_color(fig, 122, 134, 90, 200, target)
            d.rectangle((520, y, 600, y + 26), fill=col)
            label(d, (606, y + 6), f"Δ {dist:.0f}")
        else:
            label(d, (520, y + 6), "(nessuna figurina)")
    path = os.path.join(out, "contact_palette.png")
    img.save(path)
    return path


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Fogli di controllo degli asset impacchettati")
    p.add_argument("--assets", default=K.PUBLIC_ASSETS)
    p.add_argument("--out", default=K.OUT_DIR)
    ns = p.parse_args(argv)
    os.makedirs(ns.out, exist_ok=True)
    a = Assets(os.path.abspath(ns.assets))
    made = [
        sheet_fusi(a, ns.out),
        sheet_figurine(a, ns.out),
        sheet_oggetti(a, ns.out),
        sheet_images(a, ns.out, [n for n in K.IMAGES if n.startswith("dio/")], 3, 0.25, "contact_diorami.png"),
        sheet_images(a, ns.out, [n for n in K.IMAGES if n.startswith("tab/")], 2, 0.5, "contact_quadri.png"),
        sheet_atlas(a, ns.out),
        sheet_icone(ns.out),
        sheet_palette(a, ns.out),
    ]
    for m in made:
        print(f"[contact] {os.path.relpath(m, K.GAME_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
