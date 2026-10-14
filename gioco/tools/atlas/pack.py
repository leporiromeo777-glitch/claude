"""Impacchetta i render grezzi della pipeline Blender negli asset del gioco (ARCHITETTURA 12).

Legge ``tools/blender/out/render`` (un PNG e un JSON di metadati per asset, scritti dagli
script di ``tools/blender``) e produce, partendo da una ``public/assets`` vuota:

- ``public/assets/atlas/atlas_<n>.png``: gli sprite (fusi, figurine, oggetti) in pagine
  al massimo 2048×2048, algoritmo a scaffali (con colonne impilate dentro lo scaffale),
  padding 2 px fra le celle e dal bordo, estrusione dei bordi di 1 px. I frame restano
  alla loro misura nominale (GDD 12.5: fusi 96×320, figurine 256×256, oggetti 256² e
  tombolo 1024²) con l'ancora (ax, ay) normalizzata calcolata dalla geometria;
- ``public/assets/dio/<luogo>/<luce>.webp`` e ``public/assets/tab/<nome>.webp``: diorami e
  quadri in WebP qualità 80 (scende a passi di 4 solo se un'immagine supera 90 KB);
- ``public/assets/manifest.json`` (formato ``AssetManifest``): gruppi ``core`` (atlas),
  ``dio`` e ``tab``; percorsi relativi a ``public/assets/``; nessun dato variabile
  (niente date), così due esecuzioni danno lo stesso manifest;
- ``assets/logo.png`` 1024×1024 opaca (RGB, senza canale alfa), ``assets/splash.png`` e
  ``assets/splash-dark.png`` 2732×2732 (il fuso centrato su ``#1C2233``);
- ``public/icons/icon-192.png``, ``icon-512.png``, ``favicon.png`` (64×64) dal logo.

Controlla i budget (atlas ≤ 3 MB, ogni WebP ≤ 90 KB, totale ≤ 6 MB) ed esce con 1 se uno
non è rispettato o se manca un render. Un riepilogo va in ``tools/blender/out/pack_report.json``.

Uso: ``$BLENDER_PY tools/atlas/pack.py [--src <render grezzi>] [--assets <public/assets>]``
(serve Pillow: c'è nel venv di Blender e di solito anche nel Python di sistema).
"""

from __future__ import annotations

import argparse
import io
import json
import os
import shutil
import sys
import time
from dataclasses import dataclass, field

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import catalogo as K  # noqa: E402
from PIL import Image  # noqa: E402

# --------------------------------------------------------------------------
# Impaginazione a scaffali (pura e deterministica: dipende solo da nomi e misure)
# --------------------------------------------------------------------------


@dataclass
class Placed:
    name: str
    page: int
    x: int  # angolo in alto a sinistra del frame (dentro la cella, dopo l'estrusione)
    y: int
    w: int
    h: int


@dataclass
class _Column:
    x: int
    w: int
    next_y: int


@dataclass
class _Shelf:
    y: int
    h: int
    next_x: int
    columns: list[_Column] = field(default_factory=list)


@dataclass
class _Page:
    shelves: list[_Shelf] = field(default_factory=list)
    next_y: int = 0


def layout(
    items: list[tuple[str, int, int]],
    max_size: int = K.ATLAS_MAX,
    padding: int = K.ATLAS_PADDING,
    extrude: int = K.ATLAS_EXTRUDE,
) -> tuple[list[Placed], list[tuple[int, int]]]:
    """Dispone ``(nome, w, h)`` in pagine ≤ ``max_size``.

    Ogni cella è il frame più ``extrude`` px per lato; fra due celle e verso il bordo ci
    sono ``padding`` px. Gli elementi si ordinano per altezza, larghezza e nome; ciascuno
    va nel primo posto libero (prima colonna di uno scaffale esistente in cui c'è spazio
    sotto, poi una nuova colonna in fondo allo scaffale, poi un nuovo scaffale, poi una
    nuova pagina). Restituisce i frame piazzati e la misura (w, h) di ogni pagina,
    arrotondata al multiplo di 4."""
    order = sorted(items, key=lambda it: (-it[2], -it[1], it[0]))
    pages: list[_Page] = []
    placed: list[Placed] = []
    limit = max_size - padding
    for name, w, h in order:
        cw, ch = w + 2 * extrude, h + 2 * extrude
        if cw + 2 * padding > max_size or ch + 2 * padding > max_size:
            raise ValueError(f"{name}: {w}×{h} non entra in una pagina di {max_size}")
        spot: tuple[int, int, int] | None = None
        for pi, page in enumerate(pages):
            for shelf in page.shelves:
                for col in shelf.columns:
                    if cw <= col.w and col.next_y + ch <= shelf.y + shelf.h:
                        spot = (pi, col.x, col.next_y)
                        col.next_y += ch + padding
                        break
                if spot:
                    break
                if ch <= shelf.h and shelf.next_x + cw <= limit:
                    col = _Column(shelf.next_x, cw, shelf.y + ch + padding)
                    shelf.columns.append(col)
                    shelf.next_x += cw + padding
                    spot = (pi, col.x, shelf.y)
                    break
            if spot:
                break
            if page.next_y + ch <= limit:
                shelf = _Shelf(page.next_y, ch, padding + cw + padding, [_Column(padding, cw, page.next_y + ch + padding)])
                page.shelves.append(shelf)
                page.next_y += ch + padding
                spot = (pi, padding, shelf.y)
                break
        if spot is None:
            page = _Page(next_y=padding)
            pages.append(page)
            shelf = _Shelf(padding, ch, padding + cw + padding, [_Column(padding, cw, padding + ch + padding)])
            page.shelves.append(shelf)
            page.next_y = padding + ch + padding
            spot = (len(pages) - 1, padding, padding)
        pi, cx, cy = spot
        placed.append(Placed(name, pi, cx + extrude, cy + extrude, w, h))
    sizes: list[tuple[int, int]] = []
    for pi in range(len(pages)):
        mine = [p for p in placed if p.page == pi]
        pw = max(p.x + p.w + extrude for p in mine) + padding
        ph = max(p.y + p.h + extrude for p in mine) + padding
        sizes.append((min(max_size, -(-pw // 4) * 4), min(max_size, -(-ph // 4) * 4)))
    placed.sort(key=lambda p: (p.page, p.y, p.x, p.name))
    return placed, sizes


def extrude_paste(page: Image.Image, sprite: Image.Image, x: int, y: int, e: int) -> None:
    """Incolla lo sprite e ne ripete i pixel di bordo per ``e`` px all'esterno (niente aloni col filtro)."""
    w, h = sprite.size
    page.paste(sprite, (x, y))
    if e <= 0:
        return
    left = sprite.crop((0, 0, 1, h)).resize((e, h))
    right = sprite.crop((w - 1, 0, w, h)).resize((e, h))
    page.paste(left, (x - e, y))
    page.paste(right, (x + w, y))
    top = page.crop((x - e, y, x + w + e, y + 1)).resize((w + 2 * e, e))
    bottom = page.crop((x - e, y + h - 1, x + w + e, y + h)).resize((w + 2 * e, e))
    page.paste(top, (x - e, y - e))
    page.paste(bottom, (x - e, y + h))


# --------------------------------------------------------------------------
# Lettura dei render grezzi
# --------------------------------------------------------------------------


class PackError(RuntimeError):
    pass


def raw_path(src: str, name: str, ext: str) -> str:
    return os.path.join(src, *name.split("/")) + ext


def load_render(src: str, name: str) -> tuple[Image.Image, dict]:
    png, meta_path = raw_path(src, name, ".png"), raw_path(src, name, ".json")
    if not os.path.exists(png) or not os.path.exists(meta_path):
        raise PackError(f"manca il render di {name} ({png})")
    with open(meta_path, encoding="utf-8") as f:
        meta = json.load(f)
    img = Image.open(png)
    img.load()
    want = K.nominal_size(name)
    if img.size != want:
        raise PackError(f"{name}: il render è {img.size[0]}×{img.size[1]}, atteso {want[0]}×{want[1]}")
    return img, meta


def png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True, compress_level=9)
    return buf.getvalue()


def webp_bytes(img: Image.Image, budget: int) -> tuple[bytes, int]:
    """WebP qualità 80; se supera il budget scende a passi di 4 fino a ``WEBP_MIN_QUALITY``."""
    q = K.WEBP_QUALITY
    while True:
        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=q, method=6)
        data = buf.getvalue()
        if len(data) <= budget or q <= K.WEBP_MIN_QUALITY:
            return data, q
        q -= 4


def write(path: str, data: bytes) -> int:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    return len(data)


def clear_dir(path: str) -> None:
    """Svuota la cartella (la crea se manca): si parte sempre da una ``public/assets`` vuota."""
    if os.path.isdir(path):
        for entry in os.listdir(path):
            full = os.path.join(path, entry)
            if os.path.isdir(full) and not os.path.islink(full):
                shutil.rmtree(full)
            else:
                os.remove(full)
    os.makedirs(path, exist_ok=True)


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


# --------------------------------------------------------------------------
# Pacchetto
# --------------------------------------------------------------------------


def pack(src: str, assets_dir: str, icons_dir: str, native_dir: str, report_path: str | None) -> dict:
    t0 = time.time()
    errors: list[str] = []
    missing = [n for n in K.FRAMES + K.IMAGES + K.ICON_RENDERS if not os.path.exists(raw_path(src, n, ".png"))]
    if missing:
        raise PackError("render mancanti: " + ", ".join(missing))

    clear_dir(assets_dir)
    manifest: dict = {"version": 1, "atlases": [], "images": {}}
    report: dict = {"atlas": [], "images": {}, "native": {}, "icons": {}}

    # Atlas.
    sprites: dict[str, tuple[Image.Image, dict]] = {}
    for name in K.FRAMES:
        img, meta = load_render(src, name)
        sprites[name] = (img.convert("RGBA"), meta)
    placed, sizes = layout([(n, im.size[0], im.size[1]) for n, (im, _m) in sprites.items()])
    atlas_total = 0
    for pi, (pw, ph) in enumerate(sizes):
        page = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
        frames: dict[str, dict] = {}
        for p in (p for p in placed if p.page == pi):
            img, meta = sprites[p.name]
            extrude_paste(page, img, p.x, p.y, K.ATLAS_EXTRUDE)
            frames[p.name] = {
                "x": p.x,
                "y": p.y,
                "w": p.w,
                "h": p.h,
                "ax": round(float(meta.get("ax", 0.5)), 4),
                "ay": round(float(meta.get("ay", 0.5)), 4),
            }
        rel = f"atlas/atlas_{pi}.png"
        size = write(os.path.join(assets_dir, *rel.split("/")), png_bytes(page))
        atlas_total += size
        manifest["atlases"].append({"image": rel, "width": pw, "height": ph, "frames": dict(sorted(frames.items()))})
        report["atlas"].append({"image": rel, "width": pw, "height": ph, "frames": len(frames), "bytes": size})
    if atlas_total > K.BUDGET_ATLAS_TOTAL:
        errors.append(f"atlas: {atlas_total} byte > budget {K.BUDGET_ATLAS_TOTAL}")

    # Diorami e quadri.
    images_total = 0
    for name in K.IMAGES:
        img, _meta = load_render(src, name)
        data, q = webp_bytes(img.convert("RGB"), K.BUDGET_WEBP_EACH)
        rel = f"{name}.webp"
        size = write(os.path.join(assets_dir, *rel.split("/")), data)
        images_total += size
        manifest["images"][name] = {"src": rel, "w": img.size[0], "h": img.size[1], "group": K.group_of(name)}
        report["images"][name] = {"bytes": size, "quality": q}
        if size > K.BUDGET_WEBP_EACH:
            errors.append(f"{name}: {size} byte > budget {K.BUDGET_WEBP_EACH} anche a qualità {q}")
    manifest["images"] = dict(sorted(manifest["images"].items()))

    manifest_text = json.dumps(manifest, indent=1, sort_keys=True, ensure_ascii=False) + "\n"
    manifest_size = write(os.path.join(assets_dir, "manifest.json"), manifest_text.encode("utf-8"))

    # Logo, splash e icone web.
    logo_img, _ = load_render(src, "icona/logo")
    logo = logo_img.convert("RGB")
    report["native"]["logo.png"] = write(os.path.join(native_dir, "logo.png"), png_bytes(logo))
    spindle, _ = load_render(src, "icona/fuso")
    spindle = spindle.convert("RGBA")
    mark = 900
    spindle_small = spindle.resize((mark, mark), Image.LANCZOS)
    for fname in ("splash.png", "splash-dark.png"):
        splash = Image.new("RGB", (K.SPLASH_SIZE, K.SPLASH_SIZE), hex_rgb(K.SPLASH_BG))
        off = (K.SPLASH_SIZE - mark) // 2
        splash.paste(spindle_small, (off, off), spindle_small)
        report["native"][fname] = write(os.path.join(native_dir, fname), png_bytes(splash))
    for fname, px in K.WEB_ICONS.items():
        icon = logo.resize((px, px), Image.LANCZOS)
        report["icons"][fname] = write(os.path.join(icons_dir, fname), png_bytes(icon))

    total = atlas_total + images_total + manifest_size
    if total > K.BUDGET_TOTAL:
        errors.append(f"asset del gioco: {total} byte > budget {K.BUDGET_TOTAL}")
    report.update(
        {
            "atlas_bytes": atlas_total,
            "images_bytes": images_total,
            "manifest_bytes": manifest_size,
            "total_bytes": total,
            "seconds": round(time.time() - t0, 1),
            "errors": errors,
        }
    )
    if report_path:
        os.makedirs(os.path.dirname(report_path), exist_ok=True)
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=1, sort_keys=True)
            f.write("\n")
    return report


def kb(n: int) -> str:
    return f"{n / 1024:.1f} KB"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Impacchetta i render Blender negli asset del gioco")
    p.add_argument("--src", default=K.RENDER_DIR, help="cartella dei render grezzi (PNG + JSON)")
    p.add_argument("--assets", default=K.PUBLIC_ASSETS, help="cartella public/assets da rigenerare")
    p.add_argument("--icons", default=K.PUBLIC_ICONS, help="cartella delle icone web")
    p.add_argument("--native", default=K.NATIVE_ASSETS, help="cartella di logo e splash per Capacitor")
    p.add_argument("--report", default=os.path.join(K.OUT_DIR, "pack_report.json"), help="riepilogo JSON (non pubblicato)")
    ns = p.parse_args(argv)
    try:
        rep = pack(os.path.abspath(ns.src), os.path.abspath(ns.assets), os.path.abspath(ns.icons), os.path.abspath(ns.native), ns.report)
    except PackError as err:
        print(f"[pack] ERRORE: {err}", file=sys.stderr)
        return 1
    for a in rep["atlas"]:
        print(f"[pack] {a['image']}: {a['width']}×{a['height']}, {a['frames']} frame, {kb(a['bytes'])}")
    worst = max(rep["images"].items(), key=lambda kv: kv[1]["bytes"])
    lowered = {k: v["quality"] for k, v in rep["images"].items() if v["quality"] != K.WEBP_QUALITY}
    print(f"[pack] {len(rep['images'])} WebP, {kb(rep['images_bytes'])} (la più pesante: {worst[0]} {kb(worst[1]['bytes'])})")
    if lowered:
        print(f"[pack] qualità ridotta per stare in 90 KB: {lowered}")
    print(f"[pack] atlas {kb(rep['atlas_bytes'])} / {kb(K.BUDGET_ATLAS_TOTAL)}; totale {kb(rep['total_bytes'])} / {kb(K.BUDGET_TOTAL)}; {rep['seconds']} s")
    if rep["errors"]:
        for e in rep["errors"]:
            print(f"[pack] FUORI BUDGET: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
