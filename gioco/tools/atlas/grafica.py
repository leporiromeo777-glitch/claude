"""Grafica in evidenza di Google Play (docs/STORE.md 6.5): 1024×500, PNG senza trasparenza.

Compone il render ``store/tombolo`` di ``tools/blender/grafica.py`` (il tombolo con il
merletto, a destra) su un fondo di velluto disegnato come quello delle schermate del gioco
(``src/screens/backdrop.ts``: velluto a due ottave, vignettatura, luce calda della lampada)
e ci scrive il titolo come nella schermata del titolo (``src/screens/screens.css``):

- «TRAMA» in EB Garamond, colore ``--carta``, spaziatura 0,34 em, ombra scura e alone caldo;
- lo smerlo in ottone (lo stesso disegno di ``laceEdge`` in ``src/screens/icons.ts``);
- il sottotitolo in corsivo, colore ``--ottone``: «Il merletto dei giorni» (scheda italiana,
  lingua predefinita dello store) e «The Lace of Days» (scheda inglese).

Prodotti: ``assets/feature-graphic.png`` (italiano) e ``assets/feature-graphic-en.png``.
Si lavora al doppio della risoluzione (2048×1000, come il render) e si riduce alla fine.
I caratteri sono quelli del gioco (``node_modules/@fontsource``, licenza OFL).

Uso: ``$BLENDER_PY tools/atlas/grafica.py [--src <render grezzi>] [--out <cartella>]``
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import catalogo as K  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw, ImageFilter, ImageFont  # noqa: E402

SIZE = K.FEATURE_SIZE
SCALE = 2
RENDER = K.STORE_RENDERS[0]
FONTS = os.path.join(K.GAME_ROOT, "node_modules", "@fontsource", "eb-garamond", "files")
FONT_TITLE = "eb-garamond-latin-500-normal.woff2"
FONT_SUB = "eb-garamond-latin-500-italic.woff2"

VELLUTO = "#1C2233"
VELLUTO_OMBRA = "#121622"
CARTA = "#EDE4D3"
OTTONE = "#C9A24A"
LAMPADA = (255, 178, 74)

TITLE = "TRAMA"
SUBTITLES = {"it": "Il merletto dei giorni", "en": "The Lace of Days"}
OUTPUTS = K.FEATURE_GRAPHICS

# Impaginazione (frazioni dell'immagine finale).
TITLE_CX = 0.255  # centro orizzontale del blocco del titolo
TITLE_W = 0.36  # larghezza del nome «TRAMA» (spaziatura compresa)
BLOCK_CY = 0.5  # centro verticale del blocco (nome, smerlo, sottotitolo)
TRACKING = 0.34  # spaziatura delle lettere in em, come nel gioco
SUB_RATIO = 0.33  # corpo del sottotitolo rispetto al nome
GLOW = {"x": 0.7, "y": 0.34, "r": 0.5, "alpha": 0.2}  # luce calda dietro il tombolo
TITLE_MARGIN = 0.03  # spazio minimo fra il blocco del titolo e il tombolo
K_SEED = 0x7E1A  # seme fisso del velluto: due esecuzioni danno la stessa immagine


class GraficaError(RuntimeError):
    pass


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def font(name: str, px: int) -> ImageFont.FreeTypeFont:
    path = os.path.join(FONTS, name)
    if not os.path.exists(path):
        raise GraficaError(f"carattere non trovato: {path} (serve `npm install`)")
    return ImageFont.truetype(path, px)


# --------------------------------------------------------------------------
# Fondo di velluto (come src/screens/backdrop.ts e makeVelvetTile)
# --------------------------------------------------------------------------


def _octave(rng: np.random.Generator, cells: int, w: int, h: int, tile: int) -> np.ndarray:
    g = rng.random((cells, cells), dtype=np.float32)
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    fx = (xs % tile) / tile * cells
    fy = (ys % tile) / tile * cells
    x0 = np.floor(fx).astype(int) % cells
    y0 = np.floor(fy).astype(int) % cells
    x1, y1 = (x0 + 1) % cells, (y0 + 1) % cells
    tx, ty = fx - np.floor(fx), fy - np.floor(fy)
    sx, sy = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    a, b, c, d = g[y0, x0], g[y0, x1], g[y1, x0], g[y1, x1]
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy


def velvet(w: int, h: int) -> Image.Image:
    rng = np.random.default_rng(K_SEED)
    tile = 256 * SCALE
    v = _octave(rng, 16, w, h, tile) * 0.65 + _octave(rng, 64, w, h, tile) * 0.35 - 0.5
    k = 1.0 + v * 0.16
    base = np.array(hex_rgb(VELLUTO), dtype=np.float32)
    rgb = np.clip(base[None, None, :] * k[..., None], 0, 255)
    # Vignettatura (centro un po' sopra la metà, come le schermate).
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = 0.5 * w, 0.42 * h
    far = math.hypot(max(cx, w - cx), max(cy, h - cy))
    t = np.clip((np.hypot(xs - cx, ys - cy) - far * 0.25) / (far * 0.75), 0, 1)
    a = np.interp(t, [0.0, (0.7 - 0.25) / 0.75, 1.0], [0.0, 0.45, 0.9])[..., None]
    shadow = np.array(hex_rgb(VELLUTO_OMBRA), dtype=np.float32)
    rgb = rgb * (1 - a) + shadow[None, None, :] * a
    # Luce calda della lampada, sommata («lighter»).
    gx, gy, r = GLOW["x"] * w, GLOW["y"] * h, GLOW["r"] * max(w, h)
    d = np.clip(np.hypot(xs - gx, ys - gy) / r, 0, 1)
    ga = np.interp(d, [0.0, 0.45, 1.0], [GLOW["alpha"], GLOW["alpha"] * 0.35, 0.0])[..., None]
    rgb = rgb + np.array(LAMPADA, dtype=np.float32)[None, None, :] * ga
    return Image.fromarray(np.clip(rgb + 0.5, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


# --------------------------------------------------------------------------
# Tipografia
# --------------------------------------------------------------------------


def tracked_width(f: ImageFont.FreeTypeFont, text: str, track: float) -> float:
    adv = [f.getlength(ch) for ch in text]
    return sum(adv) + track * (len(text) - 1)


def draw_tracked(draw: ImageDraw.ImageDraw, xy: tuple[float, float], text: str, f: ImageFont.FreeTypeFont, track: float, fill) -> None:
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=f, fill=fill, anchor="ls")
        x += f.getlength(ch) + track


def smerlo(draw: ImageDraw.ImageDraw, x0: float, y0: float, width: float, scallops: int, color, stroke: float) -> float:
    """Lo smerlo di ``laceEdge``: una riga e ``scallops`` archi con un puntino (viewBox 24 per arco × 18)."""
    unit = width / (scallops * 24)
    sw = max(1, round(stroke))
    draw.line([(x0, y0 + 3 * unit), (x0 + width, y0 + 3 * unit)], fill=color, width=sw)
    for i in range(scallops):
        bx = x0 + i * 24 * unit
        # Curva cubica «c3 11 21 11 24 0» a partire da (bx, 3).
        p0, p1, p2, p3 = (0, 3), (3, 14), (21, 14), (24, 3)
        pts = []
        for s in range(41):
            t = s / 40
            u = 1 - t
            px = u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0]
            py = u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]
            pts.append((bx + px * unit, y0 + py * unit))
        draw.line(pts, fill=color, width=sw, joint="curve")
        cx, cy, rr = bx + 12 * unit, y0 + 9.5 * unit, 2 * unit
        draw.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=color, width=sw)
    return 18 * unit


def title_layer(w: int, h: int, subtitle: str) -> tuple[Image.Image, tuple[float, float, float, float]]:
    """Blocco del titolo su un livello trasparente; restituisce anche il suo riquadro (frazioni)."""
    target_w = TITLE_W * w
    # Corpo del nome tale che «TRAMA» spaziato sia largo target_w.
    probe = font(FONT_TITLE, 200)
    k = target_w / tracked_width(probe, TITLE, TRACKING * 200)
    size = max(8, int(200 * k))
    f_title = font(FONT_TITLE, size)
    track = TRACKING * size
    tw = tracked_width(f_title, TITLE, track)
    f_sub = font(FONT_SUB, max(8, int(size * SUB_RATIO)))
    sub_w = f_sub.getlength(subtitle)
    asc = f_title.getbbox("T", anchor="ls")[1]  # negativo: altezza delle maiuscole sopra la linea di base
    cap_h = -asc
    edge_w = tw * 0.78
    edge_h = edge_w / (9 * 24) * 18
    gap1, gap2 = cap_h * 0.32, cap_h * 0.22
    sub_asc = -f_sub.getbbox("I", anchor="ls")[1]
    block_h = cap_h + gap1 + edge_h + gap2 + sub_asc
    top = BLOCK_CY * h - block_h / 2
    cx = TITLE_CX * w
    base_title = top + cap_h
    edge_y = base_title + gap1
    base_sub = edge_y + edge_h + gap2 + sub_asc

    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    # Alone caldo (text-shadow 0 0 30px rgba(255,178,74,.22)) e ombra (0 2px 0 rgba(8,10,16,.55)).
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    x_start = cx - tw / 2
    draw_tracked(ImageDraw.Draw(glow), (x_start, base_title), TITLE, f_title, track, (*LAMPADA, 140))
    glow = glow.filter(ImageFilter.GaussianBlur(30 * SCALE * 0.5))
    layer = Image.alpha_composite(layer, glow)
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw_tracked(ImageDraw.Draw(shadow), (x_start, base_title + 2 * SCALE), TITLE, f_title, track, (8, 10, 16, 150))
    sd = ImageDraw.Draw(shadow)
    sd.text((cx, base_sub + 2 * SCALE), subtitle, font=f_sub, fill=(8, 10, 16, 150), anchor="ms")
    layer = Image.alpha_composite(layer, shadow.filter(ImageFilter.GaussianBlur(1.2 * SCALE)))
    d = ImageDraw.Draw(layer)
    # Come nel gioco (padding-left uguale alla spaziatura) il nome è centrato sulle lettere.
    draw_tracked(d, (x_start, base_title), TITLE, f_title, track, (*hex_rgb(CARTA), 255))
    # Lo smerlo è fatto di linee sottili: si disegna a una risoluzione doppia e si riduce (antialias).
    edge = Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))
    smerlo(ImageDraw.Draw(edge), (cx - edge_w / 2) * 2, edge_y * 2, edge_w * 2, 9, (*hex_rgb(OTTONE), 225), stroke=1.7 * SCALE * 2)
    layer = Image.alpha_composite(layer, edge.resize((w, h), Image.LANCZOS))
    d = ImageDraw.Draw(layer)
    d.text((cx, base_sub), subtitle, font=f_sub, fill=(*hex_rgb(OTTONE), 255), anchor="ms")
    x0 = min(cx - tw / 2, cx - sub_w / 2, cx - edge_w / 2)
    x1 = max(cx + tw / 2, cx + sub_w / 2, cx + edge_w / 2)
    box = (x0 / w, top / h, x1 / w, (base_sub + f_sub.getbbox("g", anchor="ls")[3]) / h)
    return layer, box


# --------------------------------------------------------------------------
# Composizione
# --------------------------------------------------------------------------


def load_render(src: str) -> tuple[Image.Image, dict]:
    png = os.path.join(src, *RENDER.split("/")) + ".png"
    meta_path = os.path.splitext(png)[0] + ".json"
    if not os.path.exists(png) or not os.path.exists(meta_path):
        raise GraficaError(f"manca il render {RENDER} in {src} (tools/blender/grafica.py)")
    with open(meta_path, encoding="utf-8") as f:
        meta = json.load(f)
    return Image.open(png).convert("RGBA"), meta


def compose(src: str, lang: str) -> tuple[Image.Image, dict]:
    render, meta = load_render(src)
    w, h = SIZE[0] * SCALE, SIZE[1] * SCALE
    if render.size != (w, h):
        render = render.resize((w, h), Image.LANCZOS)
    img = velvet(w, h)
    img = Image.alpha_composite(img, render)
    layer, tbox = title_layer(w, h, SUBTITLES[lang])
    img = Image.alpha_composite(img, layer)
    out = img.convert("RGB").resize(SIZE, Image.LANCZOS)
    # Il tombolo (pixel pieni del render, non l'ombra a terra) accanto al titolo: dove comincia
    # nella fascia orizzontale occupata dal titolo, più un margine.
    alpha = np.asarray(render.getchannel("A"))
    band = alpha[int(tbox[1] * h) : int(math.ceil(tbox[3] * h)), :]
    cols = np.nonzero((band >= 128).any(axis=0))[0]
    left = float(cols[0]) / w if cols.size else 1.0
    info = {"title_box": [round(v, 4) for v in tbox], "tombolo_box": meta.get("box"), "tombolo_left_at_title": round(left, 4)}
    if tbox[2] + TITLE_MARGIN > left:
        raise GraficaError(f"il titolo ({tbox}) è troppo vicino al tombolo (che comincia a {left:.3f})")
    if tbox[0] < 0.04 or tbox[1] < 0.08 or tbox[3] > 0.92:
        raise GraficaError(f"il titolo ({tbox}) è troppo vicino al bordo")
    return out, info


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Grafica in evidenza di Google Play (1024×500)")
    p.add_argument("--src", default=K.RENDER_DIR, help="cartella dei render grezzi")
    p.add_argument("--out", default=K.NATIVE_ASSETS, help="cartella di destinazione (assets/)")
    ns = p.parse_args(argv)
    os.makedirs(ns.out, exist_ok=True)
    try:
        for lang, fname in OUTPUTS.items():
            img, info = compose(os.path.abspath(ns.src), lang)
            path = os.path.join(ns.out, fname)
            img.save(path, format="PNG", optimize=True)
            print(f"[grafica] {fname}: {img.size[0]}×{img.size[1]} RGB, {os.path.getsize(path) / 1024:.1f} KB, titolo {info['title_box']}, tombolo da x = {info['tombolo_left_at_title']} accanto al titolo")
    except GraficaError as err:
        print(f"[grafica] ERRORE: {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
