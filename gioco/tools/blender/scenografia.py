"""Pezzi di scena riusabili: oggetti della sera, tombolo, arredi e architetture della laguna.

Usato da ``oggetti.py`` (oggetti e quadri), ``diorami.py`` e ``icona.py``.
Tutto è costruito attorno all'origine e poi raggruppato sotto un vuoto
(``common.group``) che si piazza nella scena. Mondo desaturato: i soli colori
saturi sono i fili (e gli spilli), come vuole GDD 12.1.

Regola di costruzione: due pezzi che si toccano non devono avere facce nello stesso
piano, rivolte dalla stessa parte e sovrapposte (in Cycles fanno macchie nere, vedi
``verifica_geometria.py``). Per questo molti pezzi sono più sottili, più corti o
spostati di ``EPS`` rispetto al vicino.
"""

from __future__ import annotations

import math

import common as C  # importa bpy: deve venire prima di numpy/mathutils
import bmesh
import numpy as np
from mathutils import Vector

P = C.PALETTE
#: Scarto minimo fra due facce che altrimenti sarebbero complanari (2 mm alla scala dei diorami).
EPS = 0.002

# --------------------------------------------------------------------------
# Materiali condivisi (cache per nome: una scena = una cache)
# --------------------------------------------------------------------------

_CACHE: dict[str, object] = {}


def M(key: str):
    """Materiale condiviso per chiave; la cache si svuota a ogni reset (vedi ``reset``)."""
    import bpy

    mat = _CACHE.get(key)
    if mat is not None:
        try:
            if bpy.data.materials.get(mat.name) is mat:
                return mat
        except ReferenceError:
            pass
    factory = MATERIALS[key]
    mat = factory()
    _CACHE[key] = mat
    return mat


def reset() -> None:
    _CACHE.clear()


MATERIALS = {
    "legno": lambda: C.mat_wood("s_legno", seed_name="scena/legno", scale=1.8, contrast=0.7),
    "legno_scuro": lambda: C.mat_wood("s_legno_scuro", base=C.mix_hex(P["legno"], P["legno_scuro"], 0.6), seed_name="scena/legno_scuro", scale=1.6, contrast=0.6),
    "legno_vecchio": lambda: C.mat_wood("s_legno_vecchio", base="#8C7A64", seed_name="scena/legno_vecchio", scale=1.4, contrast=0.6, axis="X"),
    "assi": lambda: C.mat_wood("s_assi", base="#8F7B62", seed_name="scena/assi", scale=1.2, contrast=0.55, axis="X"),
    "pali": lambda: C.mat_wood("s_pali", base="#6F6150", seed_name="scena/pali", scale=1.6, contrast=0.6),
    "velluto": lambda: C.mat_velvet("s_velluto", P["velluto"], noise_amt=0.06),
    "carta": lambda: C.mat_paint("s_carta", P["carta"], rough=0.8),
    "carta_ombra": lambda: C.mat_paint("s_carta_ombra", P["carta_ombra"], rough=0.8),
    "ottone": lambda: C.mat_brass("s_ottone"),
    "ferro": lambda: C.mat_metal("s_ferro", "#55524E", rough=0.45),
    "acciaio": lambda: C.mat_metal("s_acciaio", "#B4B5B2", rough=0.22),
    "pietra": lambda: C.mat_plaster("s_pietra", "#B3AEA4", amount=0.06),
    "pietra_scura": lambda: C.mat_plaster("s_pietra_scura", "#8E8A83", amount=0.06),
    "pietra_bianca": lambda: C.mat_plaster("s_pietra_bianca", "#D4CFC5", amount=0.04),
    "intonaco_ocra": lambda: C.mat_plaster("s_intonaco_ocra", P["ocra_spenta"], amount=0.05),
    "intonaco_mattone": lambda: C.mat_plaster("s_intonaco_mattone", P["mattone_spento"], amount=0.05),
    "intonaco_grigio": lambda: C.mat_plaster("s_intonaco_grigio", "#A39C90", amount=0.05),
    "intonaco_rosa": lambda: C.mat_plaster("s_intonaco_rosa", "#B39B8E", amount=0.05),
    "intonaco_chiaro": lambda: C.mat_plaster("s_intonaco_chiaro", "#C7BFAF", amount=0.04),
    "coppi": lambda: C.mat_tiles("s_coppi", "#8E6457", rows=10.0),
    "coppi_scuri": lambda: C.mat_tiles("s_coppi_scuri", "#7A5A4F", rows=10.0),
    "persiane": lambda: C.mat_paint("s_persiane", "#6F7A70", rough=0.7),
    "finestra_buia": lambda: C.mat_paint("s_finestra_buia", "#2C2A2B", rough=0.3),
    "porta": lambda: C.mat_paint("s_porta", "#5E5045", rough=0.7),
    "laguna": lambda: C.mat_water("s_laguna", P["laguna"], rough=0.06, ripple=0.15),
    "laguna_notte": lambda: C.mat_water("s_laguna_notte", "#55625F", rough=0.06, ripple=0.15),
    "sabbia": lambda: C.mat_plaster("s_sabbia", "#BDB29C", amount=0.05, scale=1.5),
    "scoglio": lambda: C.mat_plaster("s_scoglio", "#7E7A74", amount=0.08, scale=3.0),
    "faro_bianco": lambda: C.mat_paint("s_faro_bianco", "#DCD6CB", rough=0.6),
    "faro_rosso": lambda: C.mat_paint("s_faro_rosso", "#A2645A", rough=0.6),
    "vetro": lambda: C.mat_glass("s_vetro", "#C9D3CF", rough=0.05),
    "vetro_bottiglia": lambda: C.mat_glass("s_vetro_bottiglia", "#C3D3C8", rough=0.04, ior=1.35),
    "sughero": lambda: C.mat_paint("s_sughero", "#A68B66", rough=0.85),
    "cuoio": lambda: C.mat_paint("s_cuoio", "#66513F", rough=0.55, coat=0.2),
    "paglia": lambda: C.mat_tiles("s_paglia", "#B9A880", rows=40.0),
    "stoffa_scialle": lambda: C.mat_paint("s_scialle", "#57504B", rough=0.9, sheen=0.4),
    "pane": lambda: C.mat_paint("s_pane", "#B8935F", rough=0.7),
    "farina": lambda: C.mat_paint("s_farina", "#D9D2C4", rough=0.9),
    "nastro_seppia": lambda: C.mat_paint("s_nastro_seppia", C.LIVIA_SHEEN, rough=0.35, coat=0.4),
    "spago": lambda: C.mat_thread("s_spago", C.THREAD["lino"], windings=60),
}


# --------------------------------------------------------------------------
# Fusi piccoli (sul tombolo, nella stanza)
# --------------------------------------------------------------------------

BOBBIN_PROFILE = [
    (0.0, 0.0), (0.05, 0.01), (0.075, 0.05), (0.075, 0.1), (0.05, 0.14), (0.04, 0.17), (0.046, 0.4),
    (0.05, 0.56), (0.072, 0.58), (0.072, 0.62), (0.052, 0.64), (0.042, 0.66), (0.042, 0.86),
    (0.07, 0.88), (0.07, 0.91), (0.04, 0.93), (0.036, 0.97), (0.06, 1.0), (0.068, 1.04), (0.055, 1.08), (0.0, 1.1),
]


def bobbin(name: str, cid: str | None, length: float = 1.0, wood=None, fat: float = 1.0) -> list:
    """Fuso semplice lungo ``length`` (asse +Z, base all'origine) con filo avvolto del personaggio."""
    s = length / 1.1
    prof = [(r * s, z * s) for r, z in BOBBIN_PROFILE]
    objs = [C.lathe(name, prof, wood or M("legno"), segments=14, sharp_deg=40)]
    if cid is not None:
        thread = _thread_mat(cid)
        barrel = [(0.042 * s, 0.665 * s), (0.075 * s * fat, 0.69 * s), (0.085 * s * fat, 0.76 * s), (0.075 * s * fat, 0.83 * s), (0.042 * s, 0.855 * s)]
        objs.append(C.lathe(f"{name}_filo", barrel, thread, segments=16, sharp_deg=None, cap=False))
    return objs


def _thread_mat(cid: str):
    key = f"filo_{cid}"
    if key not in MATERIALS:
        col = C.THREAD[cid]
        MATERIALS[key] = (lambda c=col, k=key, g=(cid == "livia"): C.mat_thread("s_" + k, c, glossy=g, windings=70))
    return M(key)


def thread_mat(cid: str):
    """Materiale del filo (tinta unita lucida) per i fili tesi."""
    key = f"teso_{cid}"
    if key not in MATERIALS:
        col = C.THREAD[cid]
        MATERIALS[key] = (lambda c=col, k=key: C.mat_paint("s_" + k, c, rough=0.4, coat=0.2, sheen=0.3))
    return M(key)


# --------------------------------------------------------------------------
# Il tombolo
# --------------------------------------------------------------------------


def lace_image(name: str, w: int = 1024, h: int = 320, unfinished: float = 0.12, seed: str = "pizzo"):
    """Merletto a fuselli (fondo torchon con ragni e smerlo) come immagine RGBA; u lungo la striscia."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    s = 26.0
    t = 1.5

    def line_alpha(dist, thick):
        return np.clip(thick + 0.6 - dist, 0.0, 1.0)

    d1 = np.abs(((xx + yy) % s) - s / 2)
    d2 = np.abs(((xx - yy) % s) - s / 2)
    ground = np.maximum(line_alpha(np.minimum(d1, s - d1) if False else (s / 2 - d1), t), line_alpha(s / 2 - d2, t))
    # Ragni: anelli pieni a griglia larga.
    cx = (np.round((xx - s) / (2 * s)) * 2 * s) + s
    cy = (np.round((yy - s) / (2 * s)) * 2 * s) + s
    rr = np.hypot(xx - cx, yy - cy)
    spiders = np.clip(1.0 - np.abs(rr - 7.5) / 2.2, 0, 1) + np.clip(4.2 - rr, 0, 1)
    body = np.clip(np.maximum(ground, spiders), 0, 1)
    band = (yy > 28) & (yy < h - 46)
    alpha = np.where(band, body, 0.0)
    # Lato del piede: due cordoncini dritti.
    for y0 in (20.0, 27.0):
        alpha = np.maximum(alpha, line_alpha(np.abs(yy - y0), 1.6))
    # Smerlo del lato della testa.
    sc = 52.0
    ccx = np.round(xx / sc) * sc
    rs = np.hypot(xx - ccx, (yy - (h - 46)) * 1.15)
    scallop = np.clip(1.0 - np.abs(rs - 30.0) / 2.0, 0, 1) * (yy >= h - 50)
    alpha = np.maximum(alpha, scallop)
    alpha = np.maximum(alpha, line_alpha(np.abs(yy - (h - 46)), 1.4))
    # Parte non ancora lavorata (verso i fuselli): solo coppie di fili dritti.
    edge = int(w * unfinished)
    pairs = np.zeros_like(alpha)
    for k in range(int(h / 26)):
        y0 = 26 + k * 26
        pairs = np.maximum(pairs, line_alpha(np.abs(yy - y0), 1.1) + line_alpha(np.abs(yy - y0 - 5), 1.1))
    alpha[:, :edge] = np.clip(pairs[:, :edge] * (yy[:, :edge] > 16) * (yy[:, :edge] < h - 40), 0, 1)
    alpha = np.clip(alpha, 0.0, 1.0)
    ivory = np.array(C.hex_to_srgb(C.THREAD["clotilde"]), dtype=np.float32)
    shade = 0.92 + 0.08 * np.sin(xx * 0.7) * np.sin(yy * 0.7)
    rgb = ivory[None, None, :] * shade[..., None]
    rgba = np.dstack([rgb, alpha])
    return C.image_from_array(name, rgba[::-1, :, :])


PILLOW_R = 1.0
PILLOW_L = 3.0
PILLOW_Z = 2.55
TOMBOLO_THREADS = ["teresa", "marta", "clotilde", "piero", "gino", "clotilde", "nina", "zeno"]


def pillow_point(x: float, theta_deg: float, r: float = PILLOW_R) -> tuple[float, float, float]:
    """Punto sulla superficie del rullo: theta 0 = davanti (-Y), 90 = in cima."""
    t = math.radians(theta_deg)
    return (x, -r * math.cos(t), PILLOW_Z + r * math.sin(t))


def tombolo(prefix: str = "tombolo", threads: list[str] | None = None, lace: bool = True, stand: bool = True, pins: bool = True) -> list:
    """Tombolo a rullo di velluto sul cavalletto, con il merletto, gli spilli e i fuselli che pendono."""
    threads = TOMBOLO_THREADS if threads is None else threads
    objs: list = []
    pillow = C.cylinder(f"{prefix}_rullo", PILLOW_R, PILLOW_L, (0, 0, PILLOW_Z), M("velluto"), rot=(0, 90, 0), segments=48)
    objs.append(pillow)
    for sx in (-1, 1):
        objs.append(C.cylinder(f"{prefix}_disco{sx}", PILLOW_R + 0.1, 0.12, (sx * (PILLOW_L / 2 + 0.06), 0, PILLOW_Z), M("legno"), rot=(0, 90, 0), segments=40))
        objs.append(C.cylinder(f"{prefix}_perno{sx}", 0.12, 0.2, (sx * (PILLOW_L / 2 + 0.2), 0, PILLOW_Z), M("legno_scuro"), rot=(0, 90, 0), segments=16))
    if stand:
        for sx in (-1, 1):
            xx = sx * (PILLOW_L / 2 + 0.3)
            for sy in (-1, 1):
                objs.append(C.tube(f"{prefix}_gamba{sx}{sy}", [(xx, 0, PILLOW_Z), (xx + sx * 0.05, sy * 0.6, PILLOW_Z * 0.5), (xx + sx * 0.12, sy * 1.15, 0.0)], 0.075, M("legno_scuro"), resolution=2))
            objs.append(C.box(f"{prefix}_fianco{sx}", (0.12, 0.5, 0.5), (xx, 0, PILLOW_Z - 0.2), M("legno_scuro"), bevel=0.03))
            objs.append(C.cylinder(f"{prefix}_traversa{sx}", 0.05, 1.7, (xx + sx * 0.06, 0, 0.9), M("legno_scuro"), rot=(90, 0, 0), segments=10))
        objs.append(C.cylinder(f"{prefix}_asta", 0.06, PILLOW_L + 0.75, (0, 0.62, 0.95), M("legno_scuro"), rot=(0, 90, 0), segments=10))
        # Mensola davanti per i fuselli a riposo.
        objs.append(C.box(f"{prefix}_mensola", (PILLOW_L * 0.9, 0.5, 0.06), (0, -1.05, PILLOW_Z - 1.2), M("legno"), rot=(-12, 0, 0), bevel=0.02))
    lace_w = 1.5
    if lace:
        img = lace_image(f"{prefix}_pizzo_img")
        mat = C.mat_image(f"{prefix}_pizzo", img, rough=0.75)
        th0, th1 = 6.0, 150.0

        def lace_fn(u: float, v: float):
            th = th0 + (th1 - th0) * u
            return pillow_point(-lace_w / 2 + lace_w * v, th, PILLOW_R + 0.012)

        objs.append(C.surface(f"{prefix}_merletto", 64, 8, lace_fn, mat))
    # Fuselli e fili.
    n = len(threads)
    edge_th = 7.0
    for i, cid in enumerate(threads):
        fx = -lace_w / 2 + lace_w * (i + 0.5) / n
        start = pillow_point(fx * 0.92, edge_th, PILLOW_R + 0.01)
        bx = fx * 1.45
        top = (bx, -PILLOW_R - 0.55, PILLOW_Z - 1.0 + 0.04 * ((i * 7) % 3))
        mid = ((start[0] + top[0]) / 2, (start[1] + top[1]) / 2 - 0.08, (start[2] + top[2]) / 2 + 0.05)
        objs.append(C.tube(f"{prefix}_filo{i}", [start, mid, top], 0.008, thread_mat(cid), resolution=6, bevel_res=1))
        b = bobbin(f"{prefix}_fuso{i}", cid, length=1.0)
        # Il filo arriva al collo del fuso (dove è avvolto): la testa sporge appena sopra.
        g = C.group(f"{prefix}_fuso_g{i}", b, loc=(top[0], top[1], top[2] - 0.8), rot=(-6, 0, 0))
        objs.append(g)
        objs.extend(b)
    if pins:
        rr = C.rng(f"{prefix}/spilli")
        heads = ["ottone"] * 9 + ["rosso", "verde"]
        for i in range(11):
            x = -lace_w / 2 + 0.08 + (lace_w - 0.16) * i / 10
            th = edge_th + 8 + rr.uniform(-3, 9)
            base = Vector(pillow_point(x, th, PILLOW_R))
            normal = (base - Vector((x, 0, PILLOW_Z))).normalized()
            tip = base + normal * 0.26
            objs.append(C.tube(f"{prefix}_spillo{i}", [tuple(base), tuple(base + normal * 0.13), tuple(tip)], 0.012, M("acciaio"), resolution=1, bevel_res=1))
            kind = heads[(i * 5) % len(heads)]
            mat = M("ottone") if kind == "ottone" else (C.mat_paint(f"{prefix}_testa_{kind}{i}", P["spillo_rosso"] if kind == "rosso" else P["spillo_verde"], rough=0.25, coat=0.6))
            objs.append(C.sphere(f"{prefix}_capocchia{i}", 0.05, tuple(tip), mat, segments=12, rings=8))
    return objs


# --------------------------------------------------------------------------
# Oggetti della sera
# --------------------------------------------------------------------------


def bottle(prefix: str = "bottiglia") -> list:
    """Bottiglia di vetro con il tappo e una lettera arrotolata dentro, legata con lo spago."""
    outer = [(0.0, 0.0), (0.4, 0.0), (0.46, 0.05), (0.47, 0.2), (0.47, 1.3), (0.44, 1.46), (0.3, 1.66), (0.17, 1.82), (0.15, 2.18), (0.19, 2.22), (0.19, 2.3), (0.15, 2.33)]
    inner = [(0.115, 2.33), (0.115, 1.82), (0.26, 1.64), (0.42, 1.44), (0.43, 1.3), (0.43, 0.2), (0.4, 0.08), (0.0, 0.08)]
    glass = C.lathe(f"{prefix}_vetro", outer + inner, M("vetro_bottiglia"), segments=40, sharp_deg=60)
    glass.visible_shadow = False  # il rotolo dentro deve restare in luce
    cork = C.cylinder(f"{prefix}_tappo", 0.122, 0.34, (0, 0, 2.28), M("sughero"), segments=16, r2=0.135)
    scroll = C.cylinder(f"{prefix}_rotolo", 0.17, 0.95, (0.05, 0.0, 0.72), M("carta"), rot=(0, 8, 0), segments=20)
    roll_edge = C.cylinder(f"{prefix}_rotolo_b", 0.09, 0.96, (0.12, -0.08, 0.72), M("carta_ombra"), rot=(0, 8, 0), segments=12)
    tie = C.torus(f"{prefix}_spago", 0.175, 0.018, (0.05, 0.0, 0.75), M("spago"), rot=(0, 8, 0), seg=24, mseg=6)
    return [glass, cork, scroll, roll_edge, tie]


def scissors(prefix: str = "forbici", open_deg: float = 22.0) -> list:
    """Forbici da ricamo della nonna, distese (piano XY), lame d'acciaio e anelli d'ottone spento."""
    objs: list = []
    blade_outline = [(0.0, -0.12), (0.35, -0.15), (1.2, -0.08), (1.95, 0.0), (1.2, 0.04), (0.35, 0.09), (0.0, 0.1)]
    metal = M("acciaio")
    rings = C.mat_metal(f"{prefix}_ottone_spento", "#A39A82", rough=0.4)
    for k, sgn in enumerate((1, -1)):
        blade = C.prism(f"{prefix}_lama{k}", blade_outline, 0.045, (0, 0, 0.02 * k), metal, rot=(90, 0, sgn * open_deg / 2))
        objs.append(blade)
        ang = math.radians(sgn * open_deg / 2 + 180)
        sx, sy = math.cos(ang), math.sin(ang)
        shank_end = (0.55 * sx - sgn * 0.12 * sy, 0.55 * sy + sgn * 0.12 * sx, 0.02 * k)
        objs.append(C.tube(f"{prefix}_gambo{k}", [(0, 0, 0.02 * k), (0.3 * sx, 0.3 * sy, 0.02 * k), shank_end], 0.045, rings, resolution=4))
        ring_c = (shank_end[0] + 0.2 * sx - sgn * 0.12 * sy, shank_end[1] + 0.2 * sy + sgn * 0.12 * sx, 0.02 * k)
        objs.append(C.torus(f"{prefix}_anello{k}", 0.24, 0.055, ring_c, rings, scale=(1.0, 0.82, 1.0), rot=(0, 0, math.degrees(ang)), seg=32, mseg=10))
    objs.append(C.cylinder(f"{prefix}_vite", 0.07, 0.1, (0, 0, 0.03), rings, segments=16))
    return objs


def book(prefix: str = "libro", w: float = 2.0, d: float = 1.5, t: float = 0.42) -> list:
    """Il Libro dei Punti: rilegatura di cuoio con nervi sul dorso, angoli d'ottone e segnalibro d'avorio."""
    objs: list = []
    cuoio = M("cuoio")
    objs.append(C.box(f"{prefix}_piatto_giu", (w, d, 0.06), (0, 0, 0.03), cuoio, bevel=0.02))
    objs.append(C.box(f"{prefix}_piatto_su", (w, d, 0.06), (0, 0, t - 0.03), cuoio, bevel=0.02))
    pages = C.mat_tiles(f"{prefix}_pagine", "#E2D8C4", rows=90.0)
    objs.append(C.box(f"{prefix}_pagine", (w - 0.1, d - 0.12, t - 0.1), (0.04, 0.0, t / 2), pages))
    objs.append(C.box(f"{prefix}_dorso", (0.1, d - 2 * EPS, t - 2 * EPS), (-w / 2 + 0.02, 0, t / 2), cuoio, bevel=0.04))
    for i in range(4):
        y = -d / 2 + d * (i + 1) / 5
        objs.append(C.box(f"{prefix}_nervo{i}", (0.14 - 2 * EPS, 0.05, t + 0.02), (-w / 2 - EPS, y, t / 2), cuoio, bevel=0.015))
    ott = C.mat_metal(f"{prefix}_angoli", "#A8956A", rough=0.4)
    for sx in (1,):
        for sy in (-1, 1):
            objs.append(C.prism(f"{prefix}_angolo{sy}", [(0, 0), (0.3, 0), (0, 0.3)], 0.07, (sx * (w / 2 - 0.01), sy * (d / 2 - 0.01), t - 0.03), ott, rot=(90, 0, 180 if sy > 0 else 90)))
    # Fregio impresso sul piatto: un rombo di merletto.
    objs.append(C.prism(f"{prefix}_fregio", [(0, 0.32), (0.32, 0), (0, -0.32), (-0.32, 0)], 0.015, (0.08, 0, t + 0.002), C.mat_paint(f"{prefix}_impressione", "#544233", rough=0.5), rot=(90, 0, 0)))
    ribbon = C.mat_paint(f"{prefix}_nastro", C.THREAD["clotilde"], rough=0.35, coat=0.3, sheen=0.4)
    objs.append(C.box(f"{prefix}_segnalibro", (0.08, 0.5, 0.01), (0.35, -d / 2 - 0.2, 0.06), ribbon, rot=(0, 0, 8)))
    objs.append(C.box(f"{prefix}_segnalibro_in", (0.08, 0.3, 0.01), (0.33, -d / 2 + 0.05, t - 0.06), ribbon))
    return objs


def lighthouse_bobbin(prefix: str = "fuso_faro") -> list:
    """Il fuso intagliato a forma di faro (lo ha perso Zeno): torre a fasce, ballatoio, lanterna, filo verde petrolio."""
    objs: list = []
    wood = C.mat_wood(f"{prefix}_legno", seed_name=f"{prefix}/legno", scale=2.0, contrast=0.6)
    red = C.mat_paint(f"{prefix}_rosso", "#A2645A", rough=0.65)
    white = C.mat_paint(f"{prefix}_bianco", "#D8D0C2", rough=0.65)
    dark = C.mat_wood(f"{prefix}_scuro", base=P["legno_scuro"], seed_name=f"{prefix}/scuro", scale=2.0)
    objs.append(C.lathe(f"{prefix}_piede", [(0.0, 0.0), (0.14, 0.02), (0.2, 0.1), (0.2, 0.2), (0.12, 0.3), (0.1, 0.4), (0.15, 0.48), (0.1, 0.56), (0.0, 0.56)], wood, segments=24))
    # Torre: tronco di cono a fasce rosse e bianche.
    z = 0.55
    r_bot, r_top, hh = 0.2, 0.13, 1.6
    bands = 5
    for i in range(bands):
        z0 = z + hh * i / bands
        z1 = z + hh * (i + 1) / bands
        r0 = r_bot + (r_top - r_bot) * i / bands
        r1 = r_bot + (r_top - r_bot) * (i + 1) / bands
        objs.append(C.lathe(f"{prefix}_fascia{i}", [(0.0, z0), (r0, z0), (r1, z1), (0.0, z1)], red if i % 2 == 0 else white, segments=24, sharp_deg=30))
        objs.append(C.torus(f"{prefix}_solco{i}", r1 + 0.002, 0.012, (0, 0, z1), dark, seg=24, mseg=6))
    z += hh
    # Collo con il filo avvolto.
    objs.append(C.lathe(f"{prefix}_collo", [(0.0, z), (0.09, z), (0.08, z + 0.5), (0.0, z + 0.5)], wood, segments=20))
    objs.append(C.lathe(f"{prefix}_filo", [(0.08, z + 0.04), (0.14, z + 0.08), (0.16, z + 0.25), (0.14, z + 0.42), (0.08, z + 0.46)], C.mat_thread(f"{prefix}_filo_zeno", C.THREAD["zeno"], windings=90), segments=24, sharp_deg=None, cap=False))
    z += 0.5
    # Ballatoio, lanterna, cupola.
    objs.append(C.cylinder(f"{prefix}_ballatoio", 0.24, 0.05, (0, 0, z + 0.025), dark, segments=24))
    objs.append(C.torus(f"{prefix}_ringhiera", 0.22, 0.012, (0, 0, z + 0.12), dark, seg=24, mseg=6))
    objs.append(C.cylinder(f"{prefix}_lanterna", 0.15, 0.24, (0, 0, z + 0.17), C.mat_paint(f"{prefix}_vetri", "#CFC6A8", rough=0.25, coat=0.6), segments=8, smooth=False))
    for k in range(8):
        a = 2 * math.pi * k / 8 + math.pi / 8
        objs.append(C.cylinder(f"{prefix}_montante{k}", 0.012, 0.25, (0.152 * math.cos(a), 0.152 * math.sin(a), z + 0.17), dark, segments=6))
    objs.append(C.lathe(f"{prefix}_cupola", [(0.0, z + 0.29), (0.19, z + 0.29), (0.14, z + 0.36), (0.06, z + 0.43), (0.02, z + 0.5), (0.0, z + 0.52)], red, segments=24, sharp_deg=50))
    objs.append(C.sphere(f"{prefix}_pomo", 0.035, (0, 0, z + 0.54), dark))
    return objs


ENVELOPE_TONES = ["#EDE4D3", "#E4DAC6", "#D8CCB4", "#E9E2D6", "#DDD3C1", "#CFCCC2"]


def letters_bundle(prefix: str = "fascio", n: int = 16, w: float = 1.6, d: float = 1.0) -> list:
    """Fascio di lettere legate in croce con un nastro scuro (le lettere di Livia)."""
    rr = C.rng(f"{prefix}/buste")
    objs: list = []
    t = 0.045
    tones = [C.mat_paint(f"{prefix}_carta{i}", c, rough=0.85) for i, c in enumerate(ENVELOPE_TONES)]
    for i in range(n):
        objs.append(
            C.box(
                f"{prefix}_busta{i}",
                (w + rr.uniform(-0.08, 0.04), d + rr.uniform(-0.06, 0.03), t),
                (rr.uniform(-0.05, 0.05), rr.uniform(-0.04, 0.04), t / 2 + i * t),
                tones[i % len(tones)],
                rot=(0, 0, rr.uniform(-4, 4)),
            )
        )
    top = n * t
    # Francobollo e sigillo sulla busta in cima.
    objs.append(C.box(f"{prefix}_francobollo", (0.18, 0.22, 0.006), (0.55, 0.25, top + 0.003), C.mat_paint(f"{prefix}_bollo", "#8E8A7C", rough=0.7)))
    objs.append(C.cylinder(f"{prefix}_sigillo", 0.09, 0.02, (-0.5, -0.25, top + 0.01), C.mat_paint(f"{prefix}_ceralacca", "#7E3E36", rough=0.4, coat=0.4), segments=16))
    ribbon = M("nastro_seppia")
    hgt = top + 0.03
    rw = 0.08
    # Nastro lungo X e lungo Y (anelli rettangolari fatti di listelli).
    for axis in ("x", "y"):
        L = (w + 0.1) if axis == "y" else (d + 0.1)
        if axis == "x":
            objs.append(C.box(f"{prefix}_nastro_x_su", (rw, d + 0.1, 0.02), (0.15, 0, hgt), ribbon))
            objs.append(C.box(f"{prefix}_nastro_x_giu", (rw, d + 0.1, 0.02), (0.15, 0, -0.01 - EPS), ribbon))
            for s in (-1, 1):
                objs.append(C.box(f"{prefix}_nastro_x_lato{s}", (rw - 2 * EPS, 0.02, hgt + 0.02 - 2 * EPS), (0.15, s * (d / 2 + 0.05), hgt / 2), ribbon))
        else:
            objs.append(C.box(f"{prefix}_nastro_y_su", (w + 0.1, rw, 0.02), (0, 0.05, hgt + 0.005), ribbon))
            objs.append(C.box(f"{prefix}_nastro_y_giu", (w + 0.1, rw, 0.02), (0, 0.05, -0.012 - EPS), ribbon))
            for s in (-1, 1):
                objs.append(C.box(f"{prefix}_nastro_y_lato{s}", (0.02, rw - 2 * EPS, hgt + 0.02 - 2 * EPS), (s * (w / 2 + 0.05), 0.05, hgt / 2), ribbon))
        del L
    # Fiocco.
    for s in (-1, 1):
        objs.append(C.torus(f"{prefix}_fiocco{s}", 0.13, 0.03, (0.15 + s * 0.14, 0.05, hgt + 0.05), ribbon, rot=(70, 0, s * 25), scale=(1.2, 0.7, 1.0), seg=20, mseg=6))
        objs.append(C.box(f"{prefix}_coda{s}", (0.06, 0.32, 0.015), (0.15 + s * 0.08, 0.05 - 0.22, hgt + 0.01 + (s + 1) * EPS), ribbon, rot=(0, 0, s * 25)))
    objs.append(C.sphere(f"{prefix}_nodo", 0.06, (0.15, 0.05, hgt + 0.05), ribbon))
    return objs


# --------------------------------------------------------------------------
# Luci che cambiano con l'ora: finestre, lampioni, lanterne, bocca del forno
# --------------------------------------------------------------------------

GLOW_KEYS = ("finestra_accesa", "lampione_vetro", "lanterna_faro", "bocca_forno", "fiamma")
# Intensità dell'emissione per luce. Le finestre di notte sono #FFB24A (ARCHITETTURA 12);
# la superficie visibile resta entro il bianco (Standard taglia sopra 1), la luce vera la
# danno le lampade puntiformi del rig notturno.
GLOW = {
    "alba": {"finestra_accesa": 0.0, "lampione_vetro": 0.0, "lanterna_faro": 0.25, "bocca_forno": 1.4, "fiamma": 1.6},
    "giorno": {"finestra_accesa": 0.0, "lampione_vetro": 0.0, "lanterna_faro": 0.0, "bocca_forno": 0.8, "fiamma": 1.4},
    "notte": {"finestra_accesa": 1.25, "lampione_vetro": 1.4, "lanterna_faro": 1.6, "bocca_forno": 1.5, "fiamma": 1.8},
}
GLOW_COLOR = {
    "finestra_accesa": C.LIGHT["finestra"],
    "lampione_vetro": "#FFD08A",
    "lanterna_faro": "#FFE2A8",
    "bocca_forno": "#F09A4A",
    "fiamma": "#FFC56E",
}


def _glow_material(key: str):
    mat, nodes, links, bsdf, _ = C._new_material("s_" + key)
    base = {"finestra_accesa": "#2C2A2B", "lampione_vetro": "#CFC8B4", "lanterna_faro": "#CFC8B4", "bocca_forno": "#2A201B", "fiamma": "#FFE6B0"}[key]
    bsdf.inputs["Base Color"].default_value = C.lin(base)
    bsdf.inputs["Roughness"].default_value = 0.3
    bsdf.inputs["Emission Color"].default_value = C.lin(GLOW_COLOR[key])
    bsdf.inputs["Emission Strength"].default_value = 0.0
    mat.diffuse_color = C.lin(base)
    return mat


for _k in GLOW_KEYS:
    MATERIALS[_k] = (lambda k=_k: _glow_material(k))


def set_glow(light_name: str) -> None:
    """Accende o spegne le superfici emissive secondo la luce (alba, giorno, notte)."""
    for key, strength in GLOW[light_name].items():
        mat = _CACHE.get(key)
        if mat is None:
            continue
        for n in mat.node_tree.nodes:
            if n.type == "BSDF_PRINCIPLED":
                n.inputs["Emission Strength"].default_value = strength


# --------------------------------------------------------------------------
# Laguna, fondamenta, cielo
# --------------------------------------------------------------------------


def water(coll, size=(60.0, 40.0), y: float = -8.0, z: float = 0.0, night: bool = False):
    w = C.plane("laguna", size, (0, y, z), M("laguna"), coll=coll)
    return w


def quay(name: str, x0: float, x1: float, y_front: float, y_back: float, h: float = 0.35, mat_key: str = "pietra") -> list:
    """Fondamenta: lastricato con il cordolo di pietra d'Istria sul bordo verso l'acqua."""
    w = x1 - x0
    d = y_back - y_front
    objs = [C.box(f"{name}_piano", (w, d, h + 0.6), ((x0 + x1) / 2, (y_front + y_back) / 2, (h - 0.6) / 2), M(mat_key))]
    objs.append(C.box(f"{name}_cordolo", (w, 0.32, 0.14), ((x0 + x1) / 2, y_front + 0.14, h + 0.02), M("pietra_bianca")))
    # Fascia più scura dove batte l'acqua.
    objs.append(C.box(f"{name}_alga", (w + 0.01, 0.02, 0.22), ((x0 + x1) / 2, y_front - 0.005, 0.08), C.mat_paint(f"{name}_verde_spento", "#5F665C", rough=0.9)))
    return objs


def paving(name: str, x0: float, x1: float, y0: float, y1: float, h: float = 0.35, mat_key: str = "pietra") -> list:
    """Campo lastricato (masegni): piano con giunti in rilievo appena accennati."""
    objs = [C.box(f"{name}_piano", (x1 - x0, y1 - y0, h + 0.6), ((x0 + x1) / 2, (y0 + y1) / 2, (h - 0.6) / 2), M(mat_key))]
    return objs


# --------------------------------------------------------------------------
# Case veneziane
# --------------------------------------------------------------------------


def gable_roof(name: str, w: float, d: float, rise: float, loc, mat, overhang: float = 0.18, ridge: str = "x"):
    """Tetto a capanna su una pianta w×d. ``ridge='x'``: colmo lungo X (falda verso la camera);
    ``ridge='y'``: colmo lungo Y (timpano verso la camera, come una facciata di chiesa)."""
    if ridge == "x":
        outline = [(-d / 2 - overhang, -0.05), (d / 2 + overhang, -0.05), (d / 2 + overhang, 0.05), (0.0, rise + 0.05), (-d / 2 - overhang, 0.05)]
        return C.prism(name, outline, w + 2 * overhang, loc, mat, rot=(0, 0, 90))
    outline = [(-w / 2 - overhang, -0.05), (w / 2 + overhang, -0.05), (w / 2 + overhang, 0.05), (0.0, rise + 0.05), (-w / 2 - overhang, 0.05)]
    return C.prism(name, outline, d + 2 * overhang, loc, mat)


def chimney(name: str, loc) -> list:
    x, y, z = loc
    stem = C.box(f"{name}_canna", (0.26, 0.26, 0.9), (x, y, z + 0.45), M("intonaco_chiaro"))
    funnel = C.cylinder(f"{name}_imbuto", 0.12, 0.42, (x, y, z + 1.08), M("intonaco_mattone"), r2=0.3, segments=12)
    cap = C.cylinder(f"{name}_cappello", 0.31, 0.06, (x, y, z + 1.32), M("intonaco_chiaro"), segments=12)
    return [stem, funnel, cap]


def window(name: str, x: float, y_face: float, z: float, ww: float = 0.46, wh: float = 0.78, lit: bool = False, shutters: bool = True, arched: bool = False) -> list:
    objs = [
        C.box(f"{name}_cornice", (ww + 0.14, 0.06, wh + 0.14), (x, y_face - 0.02, z), M("pietra_bianca")),
        C.box(f"{name}_vetro", (ww, 0.06, wh), (x, y_face - 0.05, z), M("finestra_accesa" if lit else "finestra_buia")),
        C.box(f"{name}_davanzale", (ww + 0.26, 0.16, 0.06), (x, y_face - 0.07, z - wh / 2 - 0.07), M("pietra_bianca")),
    ]
    if arched:
        objs.append(C.cylinder(f"{name}_arco", ww / 2 + 0.07, 0.06 - 2 * EPS, (x, y_face - 0.02, z + wh / 2), M("pietra_bianca"), rot=(90, 0, 0), segments=16))
        objs.append(C.cylinder(f"{name}_arco_v", ww / 2, 0.07, (x, y_face - 0.05, z + wh / 2), M("finestra_accesa" if lit else "finestra_buia"), rot=(90, 0, 0), segments=16))
    if shutters:
        for s in (-1, 1):
            objs.append(C.box(f"{name}_scuro{s}", (ww * 0.5, 0.05, wh + 0.04), (x + s * (ww * 0.78 + 0.05), y_face - 0.04, z), M("persiane")))
    return objs


def wall_with_hole(name: str, x0: float, x1: float, z0: float, z1: float, y: float, th: float, hole: list[tuple[float, float]], mat, coll=None):
    """Parete piena (un solo pezzo) da ``x0`` a ``x1`` e da ``z0`` a ``z1``, spessa ``th`` attorno
    a ``y``, con un vano passante dal contorno ``hole`` [(x, z), …] (in senso antiorario visto
    dalla camera). Un pezzo solo: niente cuciture di Freestyle fra i pezzi del muro, intonaco
    continuo (la texture usa le coordinate dell'oggetto) e mazzette nette attorno al vano."""
    bm = bmesh.new()
    yf, yr = y - th / 2, y + th / 2
    outer = [(x0, z0), (x1, z0), (x1, z1), (x0, z1)]

    def ring(pts, yy):
        return [bm.verts.new((px, yy, pz)) for px, pz in pts]

    of, orr = ring(outer, yf), ring(outer, yr)
    hf, hr = ring(hole, yf), ring(hole, yr)
    # Fianchi esterni e mazzette del vano.
    for a, b in ((of, orr), (hf, hr)):
        n = len(a)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    # Fronte e retro: triangolazione vincolata della corona fra il contorno e il vano.
    for a, b in ((of, hf), (orr, hr)):
        edges = []
        for loop in (a, b):
            n = len(loop)
            for i in range(n):
                e = bm.edges.get((loop[i], loop[(i + 1) % n])) or bm.edges.new((loop[i], loop[(i + 1) % n]))
                edges.append(e)
        bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=edges, normal=Vector((0.0, -1.0, 0.0)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return C._finish(name, bm, mat, smooth=False, sharp_deg=None, coll=coll)


def arched_hole(cx: float, cz: float, ww: float, wh: float, segments: int = 16) -> list[tuple[float, float]]:
    """Contorno di un vano ad arco a tutto sesto: rettangolo ``ww``×``wh`` centrato in (cx, cz) e semicerchio sopra."""
    pts = [(cx - ww / 2, cz - wh / 2), (cx + ww / 2, cz - wh / 2), (cx + ww / 2, cz + wh / 2)]
    for k in range(1, segments):
        a = math.pi * k / segments
        pts.append((cx + ww / 2 * math.cos(a), cz + wh / 2 + ww / 2 * math.sin(a)))
    pts.append((cx - ww / 2, cz + wh / 2))
    return pts


def rect_hole(cx: float, cz: float, ww: float, wh: float) -> list[tuple[float, float]]:
    return [(cx - ww / 2, cz - wh / 2), (cx + ww / 2, cz - wh / 2), (cx + ww / 2, cz + wh / 2), (cx - ww / 2, cz + wh / 2)]


def window_frame(prefix: str, cx: float, y: float, cz: float, ww: float, wh: float, bar: float, depth: float, cross: float, cross_depth: float, cross_dz: float, mat) -> list:
    """Telaio di finestra a croce che riempie un vano ``ww``×``wh`` (centro ``cx``, ``y``, ``cz``).

    I pezzi non si sovrappongono mai con facce nello stesso piano: montanti a tutta altezza,
    traversi fra i montanti, croce fra i traversi; il braccio orizzontale della croce sta un
    filo dietro a quello verticale."""
    objs = []
    for s in (-1, 1):
        objs.append(C.box(f"{prefix}_telaio_v{s}", (bar, depth, wh), (cx + s * (ww / 2 - bar / 2), y, cz), mat))
        objs.append(C.box(f"{prefix}_telaio_o{s}", (ww - 2 * bar, depth, bar), (cx, y, cz + s * (wh / 2 - bar / 2)), mat))
    objs.append(C.box(f"{prefix}_croce_v", (cross, cross_depth, wh - 2 * bar), (cx, y, cz), mat))
    objs.append(C.box(f"{prefix}_croce_o", (ww - 2 * bar, cross_depth - 2 * EPS, cross), (cx, y, cz + cross_dz), mat))
    return objs


def door(name: str, x: float, y_face: float, w: float = 0.7, h: float = 1.35, mat_key: str = "porta") -> list:
    return [
        C.box(f"{name}_stipite", (w + 0.18, 0.07, h + 0.1), (x, y_face - 0.02, h / 2 + 0.05), M("pietra_bianca")),
        C.box(f"{name}_anta", (w, 0.08, h), (x, y_face - 0.05, h / 2), M(mat_key)),
    ]


def house(
    name: str,
    x: float,
    y: float,
    w: float,
    d: float,
    h: float,
    wall: str = "intonaco_ocra",
    roof: str = "coppi",
    cols: int = 2,
    rows: int = 2,
    door_at: float | None = 0.0,
    lit: set | tuple = (),
    chimney_at: float | None = 0.3,
    shutters: bool = True,
    ground: float = 0.35,
    rise: float | None = None,
    arched: bool = False,
    skip: set | tuple = (),
) -> list:
    """Casa a blocco con tetto a capanna (colmo lungo X), finestre con scuri, porta e camino a imbuto.

    ``lit``: indici (colonna, riga) delle finestre accese di notte; ``skip``: finestre da non fare."""
    objs = [C.box(f"{name}_muro", (w, d, h), (x, y, ground + h / 2), M(wall))]
    rise = rise if rise is not None else min(1.1, d * 0.32)
    objs.append(gable_roof(f"{name}_tetto", w, d, rise, (x, y, ground + h), M(roof)))
    objs.append(C.box(f"{name}_cornicione", (w + 0.12, d + 0.12, 0.1), (x, y, ground + h - 0.05 - EPS), M("pietra_bianca")))
    yf = y - d / 2
    row0 = 1 if door_at is not None else 0
    for j in range(rows):
        z = ground + h * (0.62 + j) / (rows + 0.25) + (0.25 if j == 0 and door_at is None else 0)
        for i in range(cols):
            if (i, j) in skip:
                continue
            wx = x - w / 2 + w * (i + 0.5) / cols
            if j == 0 and door_at is not None and abs(wx - (x + door_at)) < 0.6:
                continue
            objs += window(f"{name}_f{i}{j}", wx, yf, z, lit=(i, j) in lit, shutters=shutters, arched=arched and j == rows - 1)
    del row0
    if door_at is not None:
        objs += door(f"{name}_porta", x + door_at, yf)
        for o in objs[-2:]:
            o.location.z += ground
    if chimney_at is not None:
        objs += chimney(f"{name}_camino", (x + chimney_at * w, y + d * 0.15, ground + h + rise * 0.55))
    return objs


def altana(name: str, x: float, y: float, z: float, w: float = 1.4, d: float = 1.0) -> list:
    """Altana: terrazzino di legno sul tetto, su quattro pali."""
    objs = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            objs.append(C.cylinder(f"{name}_palo{sx}{sy}", 0.05, 0.7, (x + sx * w / 2, y + sy * d / 2, z + 0.35), M("legno_vecchio"), segments=8))
    objs.append(C.box(f"{name}_piano", (w + 0.1, d + 0.1, 0.06), (x, y, z + 0.7), M("assi")))
    objs.append(C.box(f"{name}_ringhiera", (w + 0.1, 0.04, 0.3), (x, y - d / 2, z + 0.9), M("legno_vecchio")))
    return objs


# --------------------------------------------------------------------------
# Laguna: pali, barche, vaporetto, pontile
# --------------------------------------------------------------------------


def briccola(name: str, x: float, y: float, h: float = 3.0, n: int = 3, seed: str = "") -> list:
    rr = C.rng(f"{name}/{seed}")
    objs = []
    for i in range(n):
        a = 2 * math.pi * i / n + rr.uniform(-0.3, 0.3)
        dx, dy = 0.22 * math.cos(a), 0.22 * math.sin(a)
        objs.append(C.cylinder(f"{name}_palo{i}", 0.12, h, (x + dx, y + dy, h / 2 - 0.3), M("pali"), rot=(math.degrees(-dy * 0.35), math.degrees(dx * 0.35), 0), segments=10))
    objs.append(C.torus(f"{name}_legatura", 0.32, 0.05, (x, y, h * 0.72), M("spago"), seg=20, mseg=6))
    return objs


def hull(name: str, length: float, width: float, depth: float, mat, sheer: float = 0.25):
    """Scafo aperto: sezione a mezza ellisse, prua e poppa rialzate."""

    def fn(u: float, v: float):
        x = (u - 0.5) * length
        t = abs(u - 0.5) * 2
        half = width / 2 * max(0.02, (1 - t ** 2.2)) ** 0.6
        phi = math.pi * v
        y = -half * math.cos(phi)
        z = -depth * math.sin(phi) * (1 - 0.5 * t ** 3) + sheer * t ** 2.5
        return (x, y, z)

    return C.surface(name, 28, 10, fn, mat)


def boat(name: str, length: float = 3.4, width: float = 1.1, color: str = "#4F4A45", rope: str | None = None) -> list:
    """Barca da pesca (sandolo): scafo, panche, remo e una cima colorata arrotolata."""
    paint = C.mat_paint(f"{name}_vernice", color, rough=0.6)
    objs = [hull(f"{name}_scafo", length, width, 0.45, paint)]
    objs.append(C.box(f"{name}_falca", (length * 0.86, 0.06, 0.08), (0, -width / 2 + 0.02, 0.02), M("legno_vecchio")))
    objs.append(C.box(f"{name}_falca2", (length * 0.86, 0.06, 0.08), (0, width / 2 - 0.02, 0.02), M("legno_vecchio")))
    for i, xx in enumerate((-0.6, 0.5)):
        objs.append(C.box(f"{name}_panca{i}", (0.22, width * 0.9, 0.06), (xx, 0, -0.12), M("assi")))
    objs.append(C.cylinder(f"{name}_remo", 0.035, 2.6, (0.3, 0.15, 0.1), M("legno_vecchio"), rot=(0, 82, 12), segments=8))
    if rope:
        objs.append(C.torus(f"{name}_cima", 0.18, 0.045, (-0.95, 0.05, -0.12), thread_mat(rope), seg=24, mseg=8))
        objs.append(C.torus(f"{name}_cima2", 0.12, 0.045, (-0.95, 0.05, -0.05), thread_mat(rope), seg=24, mseg=8))
    return objs


def vaporetto(name: str, length: float = 5.2) -> list:
    """Vaporetto della linea: scafo scuro, cabina chiara con i finestrini, tetto e fumaiolo."""
    hull_mat = C.mat_paint(f"{name}_scafo_vernice", "#4C5552", rough=0.55)
    objs = [hull(f"{name}_scafo", length, 1.7, 0.75, hull_mat, sheer=0.35)]
    objs.append(C.box(f"{name}_ponte", (length * 0.84, 1.52, 0.08), (0, 0, 0.02), M("assi")))
    objs.append(C.box(f"{name}_fascia", (length * 0.9, 1.72, 0.12), (0, 0, -0.05), C.mat_paint(f"{name}_fascia_v", "#D8D2C4", rough=0.6)))
    cab = C.mat_paint(f"{name}_cabina_v", "#D6CFBF", rough=0.6)
    objs.append(C.box(f"{name}_cabina", (length * 0.5, 1.3, 0.85), (-0.15, 0, 0.47), cab, bevel=0.04))
    for i in range(5):
        xx = -0.15 - length * 0.21 + i * length * 0.105
        objs.append(C.box(f"{name}_oblo{i}", (0.34, 1.32, 0.3), (xx, 0, 0.6), M("finestra_accesa")))
    objs.append(C.box(f"{name}_tetto", (length * 0.56, 1.42, 0.08), (-0.15, 0, 0.94), C.mat_paint(f"{name}_tetto_v", "#5D5F5A", rough=0.6)))
    objs.append(C.cylinder(f"{name}_fumaiolo", 0.16, 0.6, (length * 0.17, 0, 1.25), C.mat_paint(f"{name}_fumaiolo_v", "#3C3B3A", rough=0.5), r2=0.19, segments=14))
    objs.append(C.box(f"{name}_timoneria", (0.6, 0.9, 0.5), (length * 0.32, 0, 0.3), cab, bevel=0.03))
    return objs


def pontoon(name: str, x: float, y: float, w: float = 4.6, d: float = 1.4) -> list:
    """Imbarcadero galleggiante con la pensilina."""
    objs = [C.box(f"{name}_pontone", (w, d, 0.36), (x, y, 0.1), C.mat_paint(f"{name}_pontone_v", "#5E605B", rough=0.7))]
    objs.append(C.box(f"{name}_tavolato", (w - 0.1, d - 0.1, 0.06), (x, y, 0.3), M("assi")))
    for sx in (-1, 1):
        for sy in (-1, 1):
            objs.append(C.cylinder(f"{name}_sostegno{sx}{sy}", 0.05, 1.5, (x + sx * (w / 2 - 0.4), y + sy * (d / 2 - 0.15), 1.05), M("ferro"), segments=8))
    objs.append(C.box(f"{name}_pensilina", (w - 0.4, d + 0.25, 0.1), (x, y, 1.82), C.mat_paint(f"{name}_pensilina_v", "#7A7D78", rough=0.6), rot=(4, 0, 0)))
    objs.append(C.box(f"{name}_ringhiera", (w - 0.9, 0.04, 0.5), (x, y + d / 2 - 0.08, 0.6), M("ferro")))
    return objs


def bollard(name: str, x: float, y: float, z: float, rope: str | None = None) -> list:
    """Bitta d'ormeggio con la cima avvolta."""
    objs = [C.lathe(f"{name}", [(0.0, 0.0), (0.2, 0.0), (0.16, 0.2), (0.15, 0.42), (0.24, 0.5), (0.24, 0.58), (0.0, 0.6)], M("ferro"), segments=16)]
    C.place(objs[0], (x, y, z))
    if rope:
        objs.append(C.torus(f"{name}_cima", 0.2, 0.05, (x, y, z + 0.25), thread_mat(rope), seg=20, mseg=8))
        objs.append(C.torus(f"{name}_cima2", 0.21, 0.05, (x, y, z + 0.34), thread_mat(rope), seg=20, mseg=8))
    return objs


# --------------------------------------------------------------------------
# Piazza: pozzo, panchine, lampione, bancarella, festoni
# --------------------------------------------------------------------------


def wellhead(name: str, x: float, y: float, z: float = 0.35) -> list:
    """Vera da pozzo di pietra d'Istria, ottagonale, su due gradini, con l'archetto di ferro."""
    objs = []
    objs.append(C.cylinder(f"{name}_gradino1", 1.45, 0.16, (x, y, z + 0.08), M("pietra_bianca"), segments=8, smooth=False))
    objs.append(C.cylinder(f"{name}_gradino2", 1.15, 0.16, (x, y, z + 0.24), M("pietra_bianca"), segments=8, smooth=False))
    prof = [(0.0, 0.0), (0.92, 0.0), (0.98, 0.1), (0.84, 0.2), (0.8, 0.6), (0.86, 0.95), (0.96, 1.02), (0.96, 1.12), (0.6, 1.12), (0.6, 0.5), (0.0, 0.5)]
    v = C.lathe(f"{name}_vera", prof, M("pietra_bianca"), segments=8, smooth=False, phase=22.5)
    C.place(v, (x, y, z + 0.32))
    objs.append(v)
    objs.append(C.cylinder(f"{name}_acqua", 0.6, 0.02, (x, y, z + 0.9), C.mat_paint(f"{name}_buio", "#2F3436", rough=0.2), segments=16))
    for s in (-1, 1):
        objs.append(C.cylinder(f"{name}_ferro{s}", 0.04, 1.2, (x + s * 0.75, y, z + 1.95), M("ferro"), segments=8))
    objs.append(C.torus(f"{name}_arco", 0.75, 0.045, (x, y, z + 2.5), M("ferro"), rot=(90, 0, 0), arc_deg=180, seg=20, mseg=8))
    objs.append(C.cylinder(f"{name}_carrucola", 0.12, 0.08, (x, y, z + 3.2), M("ferro"), rot=(90, 0, 0), segments=14))
    return objs


def bench(name: str, x: float, y: float, z: float = 0.35, rot: float = 0.0, w: float = 1.6) -> list:
    objs = [
        C.box(f"{name}_piede1", (0.2, 0.42, 0.4), (-w / 2 + 0.2, 0, 0.2), M("pietra_bianca")),
        C.box(f"{name}_piede2", (0.2, 0.42, 0.4), (w / 2 - 0.2, 0, 0.2), M("pietra_bianca")),
        C.box(f"{name}_seduta", (w, 0.5, 0.1), (0, 0, 0.45), M("pietra_bianca"), bevel=0.02),
    ]
    C.group(f"{name}_g", objs, loc=(x, y, z), rot=(0, 0, rot))
    return objs


def street_lamp(name: str, x: float, y: float, z: float = 0.35, h: float = 3.0) -> list:
    objs = [
        C.cylinder(f"{name}_base", 0.16, 0.3, (x, y, z + 0.15), M("ferro"), segments=10),
        C.cylinder(f"{name}_palo", 0.06, h, (x, y, z + h / 2), M("ferro"), segments=10),
        C.cylinder(f"{name}_vetro", 0.2, 0.42, (x, y, z + h + 0.22), M("lampione_vetro"), segments=6, r2=0.26, smooth=False),
        C.cylinder(f"{name}_cappello", 0.3, 0.16, (x, y, z + h + 0.5), M("ferro"), segments=6, r2=0.05, smooth=False),
    ]
    return objs


def lamp_light_pos(x: float, y: float, z: float = 0.35, h: float = 3.0) -> tuple[float, float, float]:
    return (x, y - 0.05, z + h + 0.22)


def stall(name: str, x: float, y: float, z: float = 0.35) -> list:
    """Bancarella del mercato con la tenda a strisce spente e cassette di verdura."""
    objs = [C.box(f"{name}_banco", (2.0, 0.9, 0.08), (x, y, z + 0.85), M("assi"))]
    for sx in (-1, 1):
        for sy in (-1, 1):
            objs.append(C.cylinder(f"{name}_gamba{sx}{sy}", 0.04, 1.9 if sy > 0 else 0.85, (x + sx * 0.92, y + sy * 0.38, z + (0.95 if sy > 0 else 0.42)), M("legno_vecchio"), segments=6))
    stripes = C.mat_tiles(f"{name}_tenda", "#B8AE9C", rows=6.0)
    objs.append(C.box(f"{name}_tenda", (2.3, 1.3, 0.04), (x, y - 0.1, z + 1.95), stripes, rot=(-14, 0, 90 * 0)))
    rr = C.rng(name)
    cols = ["#8E8A62", "#9C7A5C", "#B39F7A", "#7E8466"]
    for i in range(5):
        cx = x - 0.75 + i * 0.37
        objs.append(C.box(f"{name}_cassetta{i}", (0.32, 0.5, 0.14), (cx, y - 0.1, z + 0.96), M("legno_vecchio")))
        for k in range(3):
            objs.append(C.sphere(f"{name}_frutto{i}{k}", 0.07, (cx + rr.uniform(-0.08, 0.08), y - 0.1 + rr.uniform(-0.15, 0.15), z + 1.07), C.mat_paint(f"{name}_ortaggi{i}", cols[i % len(cols)], rough=0.6), segments=10, rings=6))
    return objs


def bunting(name: str, a, b, cid: str, flags: int = 9, sag: float = 0.5) -> list:
    """Festone: un filo colorato (il dettaglio saturo) con bandierine di carta spenta."""
    pts = []
    for i in range(7):
        t = i / 6
        pts.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t - sag * 4 * t * (1 - t)))
    objs = [C.tube(f"{name}_filo", pts, 0.025, thread_mat(cid), resolution=6, bevel_res=1)]
    paper = [M("carta"), M("carta_ombra"), C.mat_paint(f"{name}_carta3", "#C9C3B6", rough=0.8)]
    for i in range(flags):
        t = (i + 0.5) / flags
        px = a[0] + (b[0] - a[0]) * t
        py = a[1] + (b[1] - a[1]) * t
        pz = a[2] + (b[2] - a[2]) * t - sag * 4 * t * (1 - t)
        ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
        objs.append(C.prism(f"{name}_bandierina{i}", [(-0.16, 0.0), (0.16, 0.0), (0.0, -0.34)], 0.01, (px, py, pz), paper[i % 3], rot=(0, 0, ang)))
    return objs


def tree(name: str, x: float, y: float, z: float = 0.35, h: float = 2.6) -> list:
    leaves = C.mat_paint(f"{name}_foglie", "#77806C", rough=0.8)
    return [
        C.cylinder(f"{name}_tronco", 0.14, h, (x, y, z + h / 2), M("legno_scuro"), segments=8),
        C.ico(f"{name}_chioma", 1.1, (x, y, z + h + 0.5), leaves, subdiv=2, scale=(1.0, 1.0, 0.9), jitter=0.08),
        C.ico(f"{name}_chioma2", 0.75, (x + 0.6, y - 0.2, z + h + 0.1), leaves, subdiv=2, jitter=0.08),
    ]


def cypress(name: str, x: float, y: float, z: float = 0.35, h: float = 3.6) -> list:
    dark = C.mat_paint(f"{name}_foglie", "#5D665A", rough=0.8)
    prof = [(0.0, 0.0), (0.42, 0.25 * h), (0.46, 0.45 * h), (0.36, 0.7 * h), (0.16, 0.92 * h), (0.0, h)]
    c = C.lathe(name, prof, dark, segments=10, smooth=False)
    C.place(c, (x, y, z + 0.3))
    return [c, C.cylinder(f"{name}_tronco", 0.08, 0.4, (x, y, z + 0.2), M("legno_scuro"), segments=6)]


# --------------------------------------------------------------------------
# Chiesa e campanile
# --------------------------------------------------------------------------


def clock_face(name: str, x: float, y_face: float, z: float, r: float = 0.42, hh: float = 5.0, mm: float = 59.0) -> list:
    """Quadrante dell'orologio (fermo alle 5:59, come la notte in cui morì Clotilde)."""
    objs = [
        C.cylinder(f"{name}_disco", r, 0.05, (x, y_face - 0.03, z), M("pietra_bianca"), rot=(90, 0, 0), segments=24),
        C.torus(f"{name}_bordo", r, 0.04, (x, y_face - 0.05, z), M("ferro"), rot=(90, 0, 0), seg=24, mseg=6),
    ]
    for k in range(12):
        a = 2 * math.pi * k / 12
        objs.append(C.box(f"{name}_tacca{k}", (0.03, 0.02, 0.08), (x + 0.82 * r * math.sin(a), y_face - 0.07, z + 0.82 * r * math.cos(a)), M("ferro"), rot=(0, math.degrees(a), 0)))
    a_h = 2 * math.pi * ((hh % 12) + mm / 60) / 12
    a_m = 2 * math.pi * mm / 60
    for nm, a, ln, wd in (("ore", a_h, 0.5 * r, 0.05), ("minuti", a_m, 0.78 * r, 0.035)):
        dy = 2 * EPS if nm == "minuti" else 0.0
        objs.append(C.box(f"{name}_{nm}", (wd, 0.02, ln), (x + ln / 2 * math.sin(a), y_face - 0.08 - dy, z + ln / 2 * math.cos(a)), M("ferro"), rot=(0, math.degrees(a), 0)))
    return objs


def church(name: str, x: float, y: float, w: float = 5.0, d: float = 6.0, h: float = 4.6, ground: float = 0.35, lit: bool = True) -> list:
    """Facciata a capanna con portale ad arco, rosone e gradini; navata dietro."""
    objs = [C.box(f"{name}_navata", (w, d, h), (x, y, ground + h / 2), M("intonaco_rosa"))]
    rise = 1.7
    objs.append(gable_roof(f"{name}_tetto", w, d, rise, (x, y, ground + h), M("coppi_scuri"), overhang=0.12, ridge="y"))
    yf = y - d / 2
    # Timpano in pietra.
    objs.append(C.prism(f"{name}_timpano", [(-w / 2 - 0.15, 0.0), (w / 2 + 0.15, 0.0), (0.0, rise + 0.2)], 0.14, (x, yf - 0.07, ground + h), M("pietra_bianca")))
    objs.append(C.box(f"{name}_cornice", (w + 0.3, 0.2, 0.18), (x, yf - 0.07, ground + h), M("pietra_bianca")))
    for s in (-1, 1):
        objs.append(C.box(f"{name}_lesena{s}", (0.36, 0.14 - 2 * EPS, h - 2 * EPS), (x + s * (w / 2 - 0.1), yf - 0.05, ground + h / 2 - EPS), M("pietra_bianca")))
    # Portale.
    pw, ph = 1.3, 2.0
    objs.append(C.box(f"{name}_portale_cornice", (pw + 0.36, 0.12, ph + 0.2), (x, yf - 0.05, ground + 0.36 + ph / 2), M("pietra_bianca")))
    objs.append(C.cylinder(f"{name}_portale_arco", pw / 2 + 0.18, 0.12 - 2 * EPS, (x, yf - 0.05, ground + 0.36 + ph), M("pietra_bianca"), rot=(90, 0, 0), segments=20))
    objs.append(C.box(f"{name}_porta", (pw, 0.14, ph), (x, yf - 0.07, ground + 0.36 + ph / 2), M("porta")))
    # Lunetta affrescata: mezzo disco sopra la porta (un disco intero coprirebbe la porta).
    half = [(pw / 2 * math.cos(math.pi * k / 16), pw / 2 * math.sin(math.pi * k / 16)) for k in range(17)]
    objs.append(C.prism(f"{name}_lunetta", half, 0.14, (x, yf - 0.07, ground + 0.36 + ph), C.mat_paint(f"{name}_affresco", "#8E8676", rough=0.8)))
    # Rosone.
    objs.append(C.torus(f"{name}_rosone", 0.55, 0.1, (x, yf - 0.08, ground + h - 0.85), M("pietra_bianca"), rot=(90, 0, 0), seg=28, mseg=8))
    objs.append(C.cylinder(f"{name}_rosone_v", 0.5, 0.06, (x, yf - 0.05, ground + h - 0.85), M("finestra_accesa" if lit else "finestra_buia"), rot=(90, 0, 0), segments=24))
    for k in range(4):
        objs.append(C.box(f"{name}_raggio{k}", (0.05, 0.04 + 2 * EPS * k, 1.0), (x, yf - 0.1, ground + h - 0.85), M("pietra_bianca"), rot=(0, 45 * k, 0)))
    # Gradini.
    for i in range(3):
        objs.append(C.box(f"{name}_gradino{i}", (2.6 - i * 0.3, 0.42, 0.12), (x, yf - 0.6 + i * 0.2, ground + 0.06 + i * 0.12), M("pietra_bianca")))
    # Finestre laterali alte.
    for s in (-1, 1):
        objs += window(f"{name}_fin{s}", x + s * 1.5, yf, ground + 2.6, ww=0.36, wh=1.0, lit=lit, shutters=False, arched=True)
    return objs


def bell_tower(name: str, x: float, y: float, side: float = 1.5, h: float = 6.2, ground: float = 0.35, clock: bool = True) -> list:
    objs = [C.box(f"{name}_fusto", (side, side, h), (x, y, ground + h / 2), M("intonaco_mattone"))]
    for s in (-1, 1):
        objs.append(C.box(f"{name}_spigolo{s}", (0.16, side + 0.04, h - 2 * EPS), (x + s * (side / 2 - 0.06), y, ground + h / 2 - EPS), M("pietra_bianca")))
    zc = ground + h
    objs.append(C.box(f"{name}_cella", (side + 0.1, side + 0.1, 1.3), (x, y, zc + 0.65), M("pietra_bianca")))
    for k, (dx, dy, rz) in enumerate(((0, -1, 0), (1, 0, 90))):
        objs.append(C.box(f"{name}_bifora{k}", (side * 0.5, 0.2, 0.85), (x + dx * (side / 2 + 0.02), y + dy * (side / 2 + 0.02), zc + 0.6), M("finestra_buia"), rot=(0, 0, rz)))
    objs.append(C.cylinder(f"{name}_campana", 0.22, 0.32, (x, y - 0.1, zc + 0.68), M("ottone"), r2=0.12, segments=14))
    objs.append(C.box(f"{name}_coronamento", (side + 0.3, side + 0.3, 0.16), (x, y, zc + 1.38), M("pietra_bianca")))
    objs.append(C.cylinder(f"{name}_cuspide", side * 0.72, 1.6, (x, y, zc + 2.25), M("coppi_scuri"), r2=0.0, segments=4, smooth=False, rot=(0, 0, 45)))
    objs.append(C.sphere(f"{name}_palla", 0.1, (x, y, zc + 3.1), M("ottone")))
    if clock:
        objs += clock_face(f"{name}_orologio", x, y - side / 2, ground + h - 0.9)
    return objs


# --------------------------------------------------------------------------
# Faro
# --------------------------------------------------------------------------


def lighthouse(name: str, x: float, y: float, z: float = 0.0, h: float = 5.2) -> list:
    """Faro a fasce bianche e rosse con ballatoio, lanterna e cupola."""
    objs = []
    objs.append(C.cylinder(f"{name}_basamento", 1.15, 0.6, (x, y, z + 0.3), M("pietra"), segments=24))
    bands = 6
    r0, r1 = 0.85, 0.58
    for i in range(bands):
        za = z + 0.6 + h * i / bands
        zb = z + 0.6 + h * (i + 1) / bands
        ra = r0 + (r1 - r0) * i / bands
        rb = r0 + (r1 - r0) * (i + 1) / bands
        band = C.lathe(f"{name}_fascia{i}", [(0.0, za), (ra, za), (rb, zb), (0.0, zb)], M("faro_rosso" if i % 2 else "faro_bianco"), segments=28, sharp_deg=30)
        C.place(band, (x, y, 0))
        objs.append(band)
    zt = z + 0.6 + h
    for k in range(2):
        objs += window(f"{name}_feritoia{k}", x, y - (r0 + (r1 - r0) * (0.3 + 0.35 * k)) - 0.02, z + 0.6 + h * (0.3 + 0.35 * k), ww=0.22, wh=0.42, shutters=False)
    objs.append(C.cylinder(f"{name}_ballatoio", r1 + 0.32, 0.14, (x, y, zt + 0.07), M("ferro"), segments=28))
    objs.append(C.torus(f"{name}_ringhiera", r1 + 0.28, 0.025, (x, y, zt + 0.45), M("ferro"), seg=28, mseg=6))
    for k in range(10):
        a = 2 * math.pi * k / 10
        objs.append(C.cylinder(f"{name}_colonnina{k}", 0.025, 0.32, (x + (r1 + 0.28) * math.cos(a), y + (r1 + 0.28) * math.sin(a), zt + 0.3), M("ferro"), segments=6))
    objs.append(C.cylinder(f"{name}_lanterna", r1 * 0.72, 0.85, (x, y, zt + 0.57), M("lanterna_faro"), segments=10, smooth=False))
    for k in range(10):
        a = 2 * math.pi * k / 10 + math.pi / 10
        objs.append(C.cylinder(f"{name}_montante{k}", 0.03, 0.86, (x + r1 * 0.72 * math.cos(a), y + r1 * 0.72 * math.sin(a), zt + 0.57), M("ferro"), segments=6))
    objs.append(C.lathe(f"{name}_cupola", [(0.0, 0.0), (r1 * 0.85, 0.0), (r1 * 0.7, 0.2), (r1 * 0.4, 0.42), (0.1, 0.55), (0.0, 0.6)], M("faro_rosso"), segments=20, sharp_deg=50))
    C.place(objs[-1], (x, y, zt + 1.0))
    objs.append(C.sphere(f"{name}_pomo", 0.08, (x, y, zt + 1.65), M("ferro")))
    return objs


def rocks(name: str, x: float, y: float, n: int = 9, spread: float = 2.2, size: float = 0.8, z: float = 0.0) -> list:
    rr = C.rng(name)
    objs = []
    for i in range(n):
        a = rr.uniform(0, 2 * math.pi)
        d = rr.uniform(0.2, 1.0) * spread
        s = size * rr.uniform(0.6, 1.25)
        objs.append(
            C.ico(
                f"{name}_{i}",
                s,
                (x + d * math.cos(a), y + d * math.sin(a) * 0.7, z + s * 0.2),
                M("scoglio") if i % 3 else M("pietra_scura"),
                subdiv=1,
                scale=(1.0 + rr.uniform(0, 0.4), 1.0, 0.65),
                rot=(0, 0, rr.uniform(0, 360)),
                jitter=0.18,
                seed_name=f"{name}/{i}",
            )
        )
    return objs


# --------------------------------------------------------------------------
# Interni: sedia, cassapanca, tavolino, lume, mensola
# --------------------------------------------------------------------------


def chair(name: str, shawl: bool = True) -> list:
    """Sedia impagliata della nonna, con lo scialle sullo schienale."""
    objs = []
    wood = M("legno_scuro")
    for sx in (-1, 1):
        objs.append(C.cylinder(f"{name}_gamba_a{sx}", 0.05, 1.0, (sx * 0.45, -0.42, 0.5), wood, segments=8))
        objs.append(C.cylinder(f"{name}_gamba_p{sx}", 0.055, 2.3, (sx * 0.43, 0.4, 1.15), wood, rot=(-6, 0, 0), segments=8))
        objs.append(C.sphere(f"{name}_pomolo{sx}", 0.08, (sx * 0.43, 0.52, 2.3), wood))
    objs.append(C.box(f"{name}_seduta", (1.0, 0.92, 0.1), (0, 0, 1.0), M("paglia"), bevel=0.03))
    for k, z in enumerate((1.55, 1.9, 2.18)):
        objs.append(C.box(f"{name}_traverso{k}", (0.86, 0.06, 0.14), (0, 0.46 + (z - 1.0) * 0.1, z), wood, rot=(-6, 0, 0)))
    for k, z in enumerate((0.35,)):
        objs.append(C.box(f"{name}_piolo{k}", (0.9, 0.04, 0.04), (0, -0.42, z), wood))
    if shawl:
        cloth = M("stoffa_scialle")

        def fn(u: float, v: float):
            x = (u - 0.5) * 1.05
            ang = math.pi * v
            y = 0.52 + 0.06 - 0.32 * math.cos(ang) * 0.0 + 0.2 * math.sin(ang)
            z = 2.32 - 1.1 * v + 0.07 * math.sin(u * 14) * v
            return (x * (1 + 0.15 * v), y - 0.42 * v * v, z)

        objs.append(C.surface(f"{name}_scialle", 18, 10, fn, cloth))
        for i in range(9):
            objs.append(C.cylinder(f"{name}_frangia{i}", 0.012, 0.18, (-0.55 + i * 0.137, 0.36, 1.12), cloth, segments=4))
    return objs


def chest(name: str, w: float = 2.2, d: float = 1.0, h: float = 1.0) -> list:
    """Cassapanca dell'Archivio: legno scuro con borchie e serratura d'ottone."""
    wood = M("legno_scuro")
    objs = [
        C.box(f"{name}_cassa", (w, d, h), (0, 0, h / 2 + 0.12), wood, bevel=0.03),
        C.box(f"{name}_coperchio", (w + 0.1, d + 0.1, 0.14), (0, 0, h + 0.19), wood, bevel=0.04),
        C.box(f"{name}_zoccolo", (w + 0.12, d + 0.12, 0.14), (0, 0, 0.07), wood),
        C.box(f"{name}_serratura", (0.18, 0.04, 0.24), (0, -d / 2 - 0.02, h - 0.05), M("ottone")),
    ]
    for s in (-1, 1):
        objs.append(C.box(f"{name}_fascia{s}", (0.1, d + 0.04, h + 0.02), (s * (w / 2 - 0.35), 0, h / 2 + 0.12), M("ferro")))
    objs.append(C.box(f"{name}_pannello", (w - 1.0, 0.03, h - 0.4), (0, -d / 2 - 0.01, h / 2 + 0.12), C.mat_wood(f"{name}_intarsio", base=C.mix_hex(P["legno"], P["legno_scuro"], 0.4), seed_name=f"{name}/intarsio", scale=2.0, axis="X")))
    return objs


def oil_lamp(name: str) -> list:
    return [
        C.lathe(f"{name}_base", [(0.0, 0.0), (0.2, 0.0), (0.22, 0.05), (0.08, 0.12), (0.06, 0.3), (0.16, 0.4), (0.17, 0.5), (0.06, 0.58), (0.0, 0.58)], M("ottone"), segments=16),
        C.lathe(f"{name}_vetro", [(0.0, 0.58), (0.09, 0.58), (0.13, 0.72), (0.1, 0.9), (0.07, 1.0), (0.0, 1.0)], M("lampione_vetro"), segments=16, sharp_deg=None),
        C.sphere(f"{name}_fiamma", 0.04, (0, 0, 0.74), M("fiamma"), scale=(1, 1, 1.8)),
    ]
