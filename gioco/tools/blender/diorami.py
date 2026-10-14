"""Diorami (GDD 5.5, 12.1, 12.5): 7 luoghi × 3 luci = 21 render 1024×768.

Presepe di laguna: case squadrate con coppi e camini a imbuto, pali, acqua piatta
e lucida, luce da teatro. Camera ortografica frontale dalla laguna, elevazione 30°,
soggetto principale dentro l'area sicura centrale 768×576 (controllata: lo script
fallisce se il soggetto ne esce). Mondo desaturato: sono saturi solo i dettagli di
filo (cime, nastri, festoni) nel colore dei personaggi.

Luci (ARCHITETTURA 12): ``alba`` (sole basso 8° #FFB38A 2,5 + cielo #D9C3B0),
``giorno`` (sole #FFE2B8 3,5 a 50° da sinistra + area fredda #A9BBD9 0,8),
``notte`` (luna #8FA6D9 0,6 + finestre emissive #FFB24A + lampioni).
Ogni luogo si costruisce una volta e si renderizza con le tre luci (dati persistenti).

Uso: ``$BLENDER_PY tools/blender/diorami.py [--only dio/molo,dio/faro/notte] [--out <cartella>]``
Con ``TRAMA_ANTEPRIMA=1`` rende a metà risoluzione con pochi campioni (solo per provare).
"""

from __future__ import annotations

import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import common as C  # noqa: E402  (importa bpy: deve venire prima di mathutils)
import scenografia as S  # noqa: E402
import bpy  # noqa: E402

W, H = 1024, 768
SAMPLES = 32
PLACES = ["molo", "forno", "piazza", "chiesa", "farmacia", "faro", "stanza"]
NAMES = [f"dio/{p}/{l}" for p in PLACES for l in C.LIGHTS]
PREVIEW = os.environ.get("TRAMA_ANTEPRIMA") == "1"
SAFE = (0.125, 0.125, 0.875, 0.875)  # area sicura 768×576 al centro di 1024×768


class Place:
    """Risultato della costruzione di un luogo."""

    def __init__(self, target, ortho: float = 13.0):
        self.target = target
        self.ortho = ortho
        self.main: list = []  # soggetto principale (area sicura)
        self.lamps: list[tuple[float, float, float]] = []  # lampade puntiformi accese di notte
        self.window_lights: list[tuple] = []  # (posizione, bersaglio, colore per luce)
        self.sky_card = None  # materiale del cielo visto dalla finestra (stanza)


def distant_island(name: str, x: float, y: float, w: float, coll) -> list:
    """Quinta lontana: profilo basso di case e un campanile, grigio-azzurro (prospettiva aerea)."""
    rr = C.rng(name)
    mat = C.mat_paint(f"{name}_lontano", "#9DA5A6", rough=0.9)
    objs = []
    xx = x - w / 2
    while xx < x + w / 2:
        bw = rr.uniform(0.8, 1.6)
        bh = rr.uniform(0.5, 1.2)
        objs.append(C.box(f"{name}_{len(objs)}", (bw, 0.6, bh), (xx + bw / 2, y, bh / 2), mat, coll=coll))
        xx += bw
    objs.append(C.box(f"{name}_campanile", (0.35, 0.35, 2.4), (x + w * 0.2, y, 1.2), mat, coll=coll))
    objs.append(C.cylinder(f"{name}_cuspide", 0.3, 0.6, (x + w * 0.2, y, 2.7), mat, r2=0.0, segments=4, coll=coll))
    return objs


def row_of_houses(prefix: str, x0: float, x1: float, y: float, specs: list[tuple], ground: float = 0.35) -> list:
    """Fila di case affiancate da x0 a x1: specs = [(larghezza, altezza, muro, finestre, righe, accese)]."""
    objs = []
    total = sum(s[0] for s in specs)
    scale = (x1 - x0) / total
    xx = x0
    for i, (w, h, wall, cols, rows, lit, *rest) in enumerate(specs):
        ww = w * scale
        opts = rest[0] if rest else {}
        objs += S.house(f"{prefix}{i}", xx + ww / 2, y + opts.pop("dy", 0.0), ww, opts.pop("d", 3.0), h, wall=wall, cols=cols, rows=rows, lit=lit, ground=ground, **opts)
        xx += ww
    return objs


def barrel(name: str, x: float, y: float, z: float) -> list:
    b = C.lathe(name, [(0.0, 0.0), (0.26, 0.0), (0.31, 0.25), (0.32, 0.4), (0.31, 0.55), (0.26, 0.8), (0.0, 0.8)], S.M("legno_vecchio"), segments=16, sharp_deg=50)
    C.place(b, (x, y, z))
    rings = [C.torus(f"{name}_cerchio{k}", r, 0.02, (x, y, z + zz), S.M("ferro"), seg=20, mseg=4) for k, (r, zz) in enumerate(((0.29, 0.12), (0.29, 0.68)))]
    return [b, *rings]


# --------------------------------------------------------------------------
# Luoghi
# --------------------------------------------------------------------------


def build_molo(nl) -> Place:
    pl = Place(target=(0.0, 0.6, 1.3))
    S.water(nl, size=(90, 90), y=15)
    S.quay("fondamenta", -11, 11, 1.0, 9.0)
    row_of_houses(
        "casa",
        -11,
        11,
        4.6,
        [
            (3.0, 4.2, "intonaco_ocra", 2, 2, {(1, 1)}),
            (2.6, 5.0, "intonaco_mattone", 2, 3, {(0, 2)}),
            (3.4, 4.4, "intonaco_grigio", 3, 2, {(2, 0), (0, 1)}),
            (2.8, 5.4, "intonaco_rosa", 2, 3, {(1, 1)}),
            (3.2, 4.0, "intonaco_chiaro", 3, 2, {(1, 1)}),
            (2.6, 4.8, "intonaco_ocra", 2, 3, {(0, 0)}),
        ],
    )
    S.altana("altana", 1.1, 5.0, 5.55)
    pl.main += S.pontoon("imbarcadero", 0.8, -0.35)
    C.box("passerella", (1.0, 1.2, 0.08), (0.8, 0.55, 0.36), S.M("assi"), rot=(-4, 0, 0))
    v = S.vaporetto("vaporetto")
    pl.main += v
    C.group("vaporetto_g", v, loc=(0.9, -2.15, 0.42))
    b = S.boat("barca_bepi", rope="bepi")
    C.group("barca_g", b, loc=(-5.4, -1.3, 0.42), rot=(0, 0, 4))
    S.bollard("bitta", -4.9, 1.45, 0.35, rope="bepi")
    C.tube("cima_bepi", [(-4.75, 1.3, 0.62), (-4.6, 0.6, 0.45), (-4.5, -0.2, 0.3), (-4.2, -1.0, 0.5)], 0.04, S.thread_mat("bepi"), resolution=8)
    S.briccola("briccola_a", -8.3, -3.4, seed="a")
    S.briccola("briccola_b", 7.6, -2.9, seed="b")
    S.briccola("briccola_c", 9.4, -5.6, h=2.6, seed="c")
    S.street_lamp("lampione", 4.2, 1.8)
    pl.lamps.append(S.lamp_light_pos(4.2, 1.8))
    barrel("botte1", -6.6, 2.0, 0.35)
    barrel("botte2", -7.2, 2.4, 0.35)
    return pl


def build_forno(nl) -> Place:
    pl = Place(target=(0.0, 1.6, 1.7))
    S.water(nl, size=(90, 90), y=15)
    S.quay("campo", -11, 11, -2.6, 11.0)
    # La casa del forno.
    x, y, w, d, h = 0.0, 3.8, 5.8, 3.2, 4.6
    yf = y - d / 2
    S.house("forno", x, y, w, d, h, wall="intonaco_ocra", cols=3, rows=2, door_at=None, lit={(0, 1), (2, 1)}, skip={(0, 0), (1, 0), (2, 0)}, chimney_at=-0.25)
    ground = 0.35
    aw, ah = 2.6, 2.2
    dark = C.mat_paint("bottega_buio", "#2B2420", rough=0.8)
    # Vano della bottega (fondo scuro appena davanti alla facciata), arco di pietra.
    pl.main.append(C.box("bottega_vano", (aw, 0.04, ah), (x, yf - 0.02, ground + ah / 2), dark))
    # Mezzo disco un filo dietro al vano (il disco intero sovrapposto al vano lo farebbe nero).
    C.cylinder("bottega_vano_arco", aw / 2, 0.04 - 2 * S.EPS, (x, yf - 0.02, ground + ah), dark, rot=(90, 0, 0), segments=24)
    for s_ in (-1, 1):
        pl.main.append(C.box(f"bottega_stipite{s_}", (0.2, 0.14, ah), (x + s_ * (aw / 2 + 0.1), yf - 0.06, ground + ah / 2), S.M("pietra_bianca")))
    pl.main.append(C.torus("bottega_arco", aw / 2 + 0.1, 0.1, (x, yf - 0.06, ground + ah), S.M("pietra_bianca"), rot=(90, 0, 0), arc_deg=180, seg=24, mseg=6))
    # Dentro: la fronte del forno di mattoni con la bocca accesa.
    C.box("forno_fronte", (1.8, 0.06, 1.6), (x, yf - 0.06, ground + 0.8), S.M("intonaco_mattone"))
    C.cylinder("forno_volta", 0.9, 0.06 - 2 * S.EPS, (x, yf - 0.06, ground + 1.6), S.M("intonaco_mattone"), rot=(90, 0, 0), segments=20)
    C.cylinder("forno_bocca", 0.42, 0.04 - 2 * S.EPS, (x, yf - 0.1, ground + 1.0), S.M("bocca_forno"), rot=(90, 0, 0), segments=20)
    C.box("forno_bocca_b", (0.84, 0.04, 0.42), (x, yf - 0.1, ground + 0.79), S.M("bocca_forno"))
    C.box("forno_soglia", (1.2, 0.2, 0.08), (x, yf - 0.16, ground + 0.56), S.M("pietra_bianca"))
    for s_ in (-1, 1):
        for k in range(3):
            C.sphere(f"pane_scaffale{s_}{k}", 0.15, (x + s_ * 1.05, yf - 0.14, ground + 0.6 + 0.45 * k), S.M("pane"), scale=(1.2, 0.8, 0.7))
    # Insegna con la pagnotta intagliata, appesa con il filo di Marta.
    C.box("insegna", (2.0, 0.1, 0.6), (x, yf - 0.25, ground + ah + 0.95), S.M("legno"), bevel=0.03)
    C.sphere("insegna_pane", 0.3, (x, yf - 0.32, ground + ah + 0.95), S.M("pane"), scale=(1.5, 0.4, 0.75))
    for s in (-1, 1):
        C.tube(f"insegna_filo{s}", [(x + s * 0.8, yf - 0.25, ground + ah + 1.22), (x + s * 0.75, yf - 0.2, ground + ah + 1.5), (x + s * 0.7, yf - 0.05, ground + ah + 1.75)], 0.03, S.thread_mat("marta"), resolution=4)
    # Pale del forno appoggiate al muro.
    for k, (px, ang) in enumerate(((-2.1, 8), (-1.75, -6))):
        C.cylinder(f"pala_manico{k}", 0.045, 2.6, (px, yf - 0.25, ground + 1.45), S.M("legno_vecchio"), rot=(10, ang, 0), segments=8)
        C.box(f"pala_lama{k}", (0.55, 0.05, 0.6), (px + math.sin(math.radians(ang)) * 1.25, yf - 0.47, ground + 2.75), S.M("legno"), rot=(10, ang, 0), bevel=0.02)
    # Banco con il pane e la cesta col nastro rosso.
    C.box("banco", (2.2, 0.8, 0.08), (2.1, yf - 1.0, ground + 0.9), S.M("assi"))
    for sx in (-1, 1):
        C.box(f"banco_gamba{sx}", (0.08, 0.7, 0.9), (2.1 + sx * 0.95, yf - 1.0, ground + 0.45), S.M("legno_vecchio"))
    rr = C.rng("forno/pane")
    for k in range(5):
        C.sphere(f"pagnotta{k}", 0.2, (1.4 + k * 0.33, yf - 1.0 + rr.uniform(-0.15, 0.15), ground + 1.05), S.M("pane"), scale=(1.3, 1.0, 0.7))
    basket = C.lathe("cesta", [(0.0, 0.0), (0.35, 0.0), (0.45, 0.35), (0.42, 0.38), (0.0, 0.05)], S.M("paglia"), segments=20, sharp_deg=None)
    C.place(basket, (-2.6, yf - 1.2, ground))
    for k in range(3):
        C.sphere(f"pane_cesta{k}", 0.16, (-2.6 + (k - 1) * 0.18, yf - 1.2, ground + 0.32), S.M("pane"), scale=(1.2, 1, 0.75))
    C.torus("cesta_nastro", 0.43, 0.035, (-2.6, yf - 1.2, ground + 0.3), S.thread_mat("marta"), seg=24, mseg=6)
    for k, (sx, sy) in enumerate(((3.6, -0.6), (4.1, -0.3), (3.85, -0.15))):
        C.box(f"sacco{k}", (0.55, 0.45, 0.7), (sx, yf + sy - 0.9, ground + 0.35 + (0.5 if k == 2 else 0)), S.M("farina"), bevel=0.15)
    # Vicini.
    S.house("vicino_s", -6.0, 4.4, 4.4, 3.0, 5.2, wall="intonaco_mattone", cols=2, rows=3, lit={(1, 2)})
    S.house("vicino_d", 6.1, 4.2, 4.6, 3.0, 4.2, wall="intonaco_grigio", cols=3, rows=2, lit={(0, 1)})
    S.house("vicino_ss", -10.4, 4.6, 3.0, 3.0, 4.6, wall="intonaco_rosa", cols=2, rows=2)
    S.house("vicino_dd", 10.3, 4.6, 2.8, 3.0, 5.0, wall="intonaco_chiaro", cols=2, rows=3)
    S.street_lamp("lampione", -3.6, -0.6)
    pl.lamps.append(S.lamp_light_pos(-3.6, -0.6))
    S.bench("panca", 5.6, -0.4)
    return pl


def build_piazza(nl) -> Place:
    pl = Place(target=(0.0, 2.2, 1.6))
    S.water(nl, size=(90, 90), y=15)
    S.quay("campo", -11, 11, -3.4, 12.0)
    row_of_houses(
        "fondo",
        -9.5,
        9.5,
        7.4,
        [
            (3.2, 4.6, "intonaco_rosa", 2, 2, {(0, 1)}),
            (3.6, 5.4, "intonaco_ocra", 3, 3, {(1, 2), (2, 0)}),
            (3.0, 4.4, "intonaco_chiaro", 2, 2, {(1, 1)}),
            (3.4, 5.0, "intonaco_mattone", 3, 2, {(0, 0)}),
        ],
    )
    for side, xx, wall in ((-1, -8.6, "intonaco_grigio"), (1, 8.6, "intonaco_ocra")):
        h = S.house(f"lato{side}", 0.0, 0.0, 6.0, 3.0, 4.4, wall=wall, cols=3, rows=2, lit={(1, 1)}, chimney_at=None)
        C.group(f"lato_g{side}", h, loc=(xx, 2.6, 0.0), rot=(0, 0, -90 * side))
    pl.main += S.wellhead("pozzo", 0.0, 2.0)
    S.bench("panca1", -3.4, 0.6, rot=18)
    S.bench("panca2", 3.6, 3.6, rot=-12)
    S.street_lamp("lampione", 2.4, -1.0)
    pl.lamps.append(S.lamp_light_pos(2.4, -1.0))
    S.stall("bancarella", 5.0, 0.9)
    S.tree("albero", -5.4, 4.0)
    S.bunting("festone1", (-7.4, 6.0, 4.6), (7.0, 6.0, 4.4), "teresa", flags=13, sag=0.7)
    S.bunting("festone2", (-7.6, 1.0, 3.8), (-1.2, 6.0, 4.3), "nina", flags=7, sag=0.5)
    S.bunting("festone3", (7.6, 1.2, 3.7), (1.4, 6.0, 4.4), "gino", flags=7, sag=0.5)
    return pl


def build_chiesa(nl) -> Place:
    pl = Place(target=(0.0, 2.8, 2.6))
    S.water(nl, size=(90, 90), y=15)
    S.quay("sagrato", -11, 11, -3.2, 13.0)
    pl.main += [o for o in S.church("chiesa", -0.9, 5.0, w=5.2, d=6.0, h=4.4) if not o.name.endswith(("_navata", "_tetto"))]
    # Nastro viola di Don Piero sul portale.
    for s in (-1, 1):
        C.tube(f"nastro{s}", [(-0.9 + s * 0.9, 1.86, 2.75), (-0.9 + s * 0.45, 1.84, 2.62), (-0.9, 1.84, 2.72)], 0.03, S.thread_mat("piero"), resolution=6)
        C.tube(f"nastro_coda{s}", [(-0.9 + s * 0.9, 1.86, 2.75), (-0.9 + s * 0.97, 1.84, 2.3), (-0.9 + s * 0.93, 1.84, 1.95)], 0.03, S.thread_mat("piero"), resolution=4)
    C.sphere("nastro_nodo", 0.07, (-0.9, 1.82, 2.72), S.thread_mat("piero"))
    S.bell_tower("campanile", 3.5, 4.4, side=1.5, h=4.8)
    S.cypress("cipresso1", -5.6, 4.0)
    S.cypress("cipresso2", -6.6, 5.2, h=3.0)
    S.house("canonica", 7.6, 5.0, 4.0, 3.0, 3.8, wall="intonaco_chiaro", cols=2, rows=2, lit={(0, 1)})
    S.house("casa_s", -9.6, 5.4, 3.4, 3.0, 4.2, wall="intonaco_ocra", cols=2, rows=2, lit={(1, 0)})
    S.bench("panca", -3.9, 1.0, rot=10)
    S.street_lamp("lampione", 5.6, 0.4)
    pl.lamps.append(S.lamp_light_pos(5.6, 0.4))
    pl.lamps.append((-0.9, 1.2, 1.5))  # luce davanti alla chiesa (messa della sera)
    return pl


def build_farmacia(nl) -> Place:
    pl = Place(target=(0.0, 1.6, 1.7))
    S.water(nl, size=(90, 90), y=15)
    S.quay("campo", -11, 11, -2.6, 11.0)
    x, y, w, d, h = 0.0, 3.8, 5.4, 3.0, 4.8
    yf = y - d / 2
    ground = 0.35
    S.house("farmacia", x, y, w, d, h, wall="intonaco_chiaro", cols=3, rows=2, door_at=None, lit={(1, 1)}, skip={(0, 0), (1, 0), (2, 0)}, chimney_at=0.3)
    # Porta a vetri e due vetrine con scaffali e vasi.
    pl.main += S.door("farmacia_porta", x, yf, w=0.9, h=2.0, mat_key="finestra_accesa")
    for o in pl.main[-2:]:
        o.location.z += ground
    jar_cols = ["#8FA39A", "#A39B86", "#9AA0A8", "#B7AF9A", "#8E8A80"]
    for s in (-1, 1):
        cx = x + s * 1.65
        pl.main.append(C.box(f"vetrina{s}_cornice", (1.6, 0.1, 1.9), (cx, yf - 0.03, ground + 1.25), C.mat_paint("vetrina_legno", "#4F4A44", rough=0.6)))
        pl.main.append(C.box(f"vetrina{s}_fondo", (1.4, 0.1, 1.7), (cx, yf + 0.02, ground + 1.25), S.M("finestra_accesa")))
        for k, zz in enumerate((0.75, 1.3, 1.85)):
            C.box(f"vetrina{s}_mensola{k}", (1.4, 0.3, 0.04), (cx, yf - 0.12, ground + zz - 0.05), S.M("legno"))
            for j in range(4):
                col = jar_cols[(k * 4 + j + (s > 0) * 2) % len(jar_cols)]
                jm = C.mat_paint(f"vaso{s}{k}{j}", col, rough=0.25, coat=0.5)
                jx = cx - 0.5 + j * 0.33
                C.cylinder(f"vaso{s}{k}{j}", 0.11, 0.3, (jx, yf - 0.14, ground + zz + 0.13), jm, segments=12)
                C.cylinder(f"vaso_tappo{s}{k}{j}", 0.12, 0.06, (jx, yf - 0.14, ground + zz + 0.31), S.M("legno_scuro"), segments=12)
    # Insegna col mortaio e il filo d'argento di Lunardi.
    C.box("insegna", (2.4, 0.1, 0.62), (x, yf - 0.1, ground + 2.65), C.mat_paint("insegna_v", "#5A5F5B", rough=0.6), bevel=0.03)
    mortar = C.lathe("mortaio", [(0.0, 0.0), (0.18, 0.0), (0.24, 0.1), (0.3, 0.32), (0.27, 0.35), (0.0, 0.2)], S.M("pietra_bianca"), segments=20)
    C.place(mortar, (x, yf - 0.22, ground + 2.42))
    C.cylinder("pestello", 0.05, 0.5, (x + 0.12, yf - 0.24, ground + 2.85), S.M("legno"), rot=(0, 25, 0), segments=8)
    C.torus("insegna_filo", 1.24, 0.03, (x, yf - 0.17, ground + 2.65), S.thread_mat("lunardi"), scale=(1.0, 0.25, 0.3), seg=40, mseg=6)
    S.house("vicino_s", -5.6, 4.3, 4.6, 3.0, 5.2, wall="intonaco_ocra", cols=2, rows=3, lit={(0, 2)})
    S.house("vicino_d", 5.4, 4.1, 4.2, 3.0, 4.0, wall="intonaco_mattone", cols=2, rows=2, lit={(1, 0)})
    S.house("vicino_ss", -10.2, 4.6, 3.4, 3.0, 4.4, wall="intonaco_grigio", cols=2, rows=2)
    S.house("vicino_dd", 10.0, 4.6, 3.2, 3.0, 5.4, wall="intonaco_rosa", cols=2, rows=3)
    S.bench("panca", -3.4, -0.4, rot=0)
    S.street_lamp("lampione", 3.4, -0.9)
    pl.lamps.append(S.lamp_light_pos(3.4, -0.9))
    S.briccola("briccola", -8.6, -5.6, h=2.6, seed="f")
    return pl


def build_faro(nl) -> Place:
    pl = Place(target=(0.8, 1.6, 3.7), ortho=13.5)
    S.water(nl, size=(90, 90), y=15)
    C.box("piattaforma", (6.8, 4.0, 0.9), (0.8, 3.4, 0.0), S.M("pietra"))
    S.rocks("scogli_a", 2.6, 1.4, n=10, spread=2.6, size=0.75)
    S.rocks("scogli_b", 5.6, 3.2, n=6, spread=1.4, size=0.6)
    S.rocks("scogli_c", -2.8, 1.6, n=5, spread=1.2, size=0.55)
    pl.main += S.lighthouse("faro", 2.6, 3.4, z=0.45, h=4.0)
    S.house("casa_guardiano", -1.2, 4.2, 2.8, 2.2, 2.3, wall="faro_bianco", cols=2, rows=1, lit={(0, 0)}, ground=0.45, door_at=0.6, chimney_at=-0.3, shutters=False)
    # Pontile di legno con la barca e la cima verde petrolio di Zeno.
    for k in range(6):
        C.box(f"pontile_asse{k}", (1.3, 0.62, 0.08), (-3.9, 1.6 - k * 0.66, 0.48), S.M("assi"))
    for k in range(4):
        for s in (-1, 1):
            C.cylinder(f"pontile_palo{k}{s}", 0.08, 1.2, (-3.9 + s * 0.6, 1.4 - k * 1.25, 0.3), S.M("pali"), segments=8)
    S.bollard("bitta", -3.4, -1.6, 0.52, rope="zeno")
    C.torus("matassa_zeno", 0.22, 0.05, (-4.2, -0.4, 0.57), S.thread_mat("zeno"), seg=20, mseg=6)
    C.torus("matassa_zeno2", 0.15, 0.05, (-4.2, -0.4, 0.64), S.thread_mat("zeno"), seg=20, mseg=6)
    b = S.boat("barca_zeno", length=2.8, width=1.0, color="#57605C", rope="zeno")
    C.group("barca_g", b, loc=(-6.0, -1.4, 0.42), rot=(0, 0, 84))
    S.briccola("briccola_a", -8.8, -3.2, seed="fa")
    S.briccola("briccola_b", 8.6, -2.0, h=2.6, seed="fb")
    pl.lamps.append((2.6, 2.3, 6.2))
    return pl


def build_stanza(nl) -> Place:
    pl = Place(target=(0.2, 1.6, 2.4), ortho=12.0)
    wall = C.mat_plaster("muro_stanza", "#B9AD9A", amount=0.05)
    floor = S.M("assi")
    C.box("pavimento", (16, 10, 0.3), (0, 0.5, -0.15), floor)
    # Fughe delle assi (un filo più corte del pavimento).
    for k in range(10):
        C.box(f"fuga{k}", (16 - 4 * S.EPS, 0.025, 0.01), (0, -4.0 + k * 0.95, 0.002), C.mat_paint("fuga", "#5E5142", rough=0.9))
    # Parete di fondo in un solo pezzo con il vano della finestrella.
    yb, th = 4.8, 0.4
    wx, wz, ww, wh = -2.8, 3.2, 1.4, 1.6
    S.wall_with_hole("parete", -8.0, 8.0, 0.0, 6.0, yb, th, S.rect_hole(wx, wz, ww, wh), wall)
    C.box("parete_lato", (0.4, 10, 6.0), (-8.2, 0.5, 3.0), wall)
    C.box("trave", (16, 0.5, 0.4), (0, 3.6, 6.0), S.M("legno_scuro"))
    C.box("battiscopa", (16, 0.06, 0.25), (0, yb - th / 2 - 0.03, 0.12), S.M("legno_scuro"))
    # Telaio a croce e davanzale (un filo sopra il fondo del vano); cielo dietro.
    S.window_frame("finestra", wx, yb - 0.1, wz, ww, wh, bar=0.1, depth=0.12, cross=0.06, cross_depth=0.08, cross_dz=0.1, mat=S.M("legno_scuro"))
    C.box("davanzale", (ww + 0.4, 0.5, 0.1), (wx, yb - 0.3, wz - wh / 2 - 0.05 + S.EPS), S.M("pietra_bianca"))
    sky = C.mat_emit("cielo_finestra", "#D9C3B0", 1.0)
    pl.sky_card = sky
    card = C.plane("cielo", (6, 6), (wx, yb + 1.5, wz), sky, rot=(90, 0, 0), coll=nl)
    card.visible_shadow = False
    pl.window_lights.append(((wx - 1.0, yb + 3.0, wz + 1.6), (0.5, 1.0, 1.0)))
    # Il tombolo sul cavalletto, la sedia vuota con lo scialle, la cassapanca.
    t = S.tombolo("tombolo_stanza", threads=["teresa", "marta", "piero", "clotilde", "clotilde", "gino"])
    roots = [o for o in t if o.parent is None]
    C.group("tombolo_g", roots, loc=(0.9, 1.6, 0.0), rot=(0, 0, -8), scale=0.95)
    pl.main += [o for o in t if o.type in {"MESH", "CURVE"}]
    ch = S.chair("sedia")
    C.group("sedia_g", ch, loc=(-2.3, 0.9, 0.0), rot=(0, 0, -32))
    pl.main += ch
    ce = S.chest("cassapanca")
    C.group("cassapanca_g", ce, loc=(4.0, 3.9, 0.0))
    # Tavolino con il lume e il Libro dei Punti.
    C.box("tavolino", (1.4, 1.0, 0.08), (-4.4, 3.2, 1.6), S.M("legno"), bevel=0.02)
    for sx in (-1, 1):
        for sy in (-1, 1):
            C.box(f"tavolino_gamba{sx}{sy}", (0.08, 0.08, 1.6), (-4.4 + sx * 0.6, 3.2 + sy * 0.4, 0.8), S.M("legno_scuro"))
    lamp = S.oil_lamp("lume")
    C.group("lume_g", lamp, loc=(-4.7, 3.2, 1.64))
    pl.lamps.append((-4.7, 3.0, 2.5))
    bk = S.book("libro_stanza")
    C.group("libro_g", bk, loc=(-4.0, 3.15, 1.64), rot=(0, 0, 12), scale=0.32)
    # Mensola con barattoli e un quadretto col merletto.
    C.box("mensola", (2.2, 0.4, 0.08), (2.6, yb - 0.4, 3.9), S.M("legno"))
    for k, col in enumerate(("#A39B86", "#8FA39A", "#B7AF9A")):
        C.cylinder(f"barattolo{k}", 0.16, 0.4, (1.9 + k * 0.6, yb - 0.4, 4.14), C.mat_paint(f"barattolo_v{k}", col, rough=0.3, coat=0.4), segments=12)
    C.box("quadretto", (1.0, 0.06, 0.8), (5.2, yb - 0.22, 3.6), S.M("legno_scuro"))
    C.box("quadretto_carta", (0.8, 0.06, 0.6), (5.2, yb - 0.25, 3.6), S.M("carta"))
    # Cesta di fuselli e matasse sul pavimento, vicino alla sedia.
    basket = C.lathe("cesta_fusi", [(0.0, 0.0), (0.42, 0.0), (0.5, 0.42), (0.47, 0.45), (0.0, 0.08)], S.M("paglia"), segments=20, sharp_deg=None)
    C.place(basket, (-3.6, 0.2, 0.0))
    for k, cid in enumerate(("ada", "clotilde", "lino")):
        b = S.bobbin(f"fuso_cesta{k}", cid, length=0.9)
        C.group(f"fuso_cesta_g{k}", b, loc=(-3.75 + k * 0.15, 0.25 - k * 0.05, 0.25), rot=(0, 35 + k * 12, 20 * k))
    C.sphere("matassa_ada", 0.17, (-3.45, 0.05, 0.42), S.thread_mat("ada"), scale=(1.2, 1.0, 0.8))
    # Tappeto sotto il tombolo.
    C.box("tappeto", (4.4, 3.0, 0.03), (0.6, 1.3, 0.015), C.mat_tiles("tappeto_v", "#8C7F72", rows=7.0))
    return pl


BUILDERS = {
    "molo": build_molo,
    "forno": build_forno,
    "piazza": build_piazza,
    "chiesa": build_chiesa,
    "farmacia": build_farmacia,
    "faro": build_faro,
    "stanza": build_stanza,
}

SKY_WINDOW = {"alba": "#E4C9B0", "giorno": "#CED6DA", "notte": "#26304A"}


def add_night_lights(pl: Place, coll) -> None:
    for i, pos in enumerate(pl.lamps):
        C.light("POINT", f"lampada{i}", C.LIGHT["finestra"], 160.0, loc=pos, size=0.25, coll=coll)


def add_window_light(pl: Place, light_name: str, coll) -> None:
    """Luce che entra dalla finestrella della stanza (alba calda, giorno chiaro, notte di luna)."""
    col = {"alba": C.LIGHT["sole_alba"], "giorno": C.LIGHT["sole_giorno"], "notte": C.LIGHT["luna"]}[light_name]
    energy = {"alba": 900.0, "giorno": 700.0, "notte": 120.0}[light_name]
    for i, (pos, target) in enumerate(pl.window_lights):
        C.light("AREA", f"finestra_luce{i}", col, energy, loc=pos, target=target, size=1.4, coll=coll)


def render_place(place: str, lights: list[str], out: str) -> None:
    t0 = time.time()
    C.rng(f"dio/{place}")
    scene = C.reset_scene()
    S.reset()
    if PREVIEW:
        C.setup_render(scene, W // 2, H // 2, 8, transparent=False, rgba=False)
    else:
        C.setup_render(scene, W, H, SAMPLES, transparent=False, rgba=False)
    nl = C.no_lines_collection(scene)
    if not PREVIEW:
        C.enable_freestyle(scene, thickness=1.2, exclude=nl)
    pl = BUILDERS[place](nl)
    cam = C.ortho_camera(scene, azimuth=0, elevation=30, target=pl.target, ortho_scale=pl.ortho)
    meshes = [o for o in pl.main if o.type in {"MESH", "CURVE"}]
    ext = C.projected_extent(scene, cam, meshes)
    if ext[0] < SAFE[0] or ext[1] < SAFE[1] or ext[2] > SAFE[2] or ext[3] > SAFE[3]:
        raise RuntimeError(f"dio/{place}: il soggetto esce dall'area sicura {tuple(round(e, 3) for e in ext)}")
    C.log(f"  dio/{place}: costruito in {time.time() - t0:.1f} s, soggetto in {tuple(round(e, 3) for e in ext)}")
    for light_name in lights:
        t = time.time()
        rig = bpy.data.collections.new(f"luci_{light_name}")
        scene.collection.children.link(rig)
        C.RIGS[light_name](scene, target=pl.target, coll=rig)
        S.set_glow(light_name)
        if light_name == "notte":
            add_night_lights(pl, rig)
        if pl.window_lights:
            add_window_light(pl, light_name, rig)
        if pl.sky_card is not None:
            for n in pl.sky_card.node_tree.nodes:
                if n.type == "EMISSION":
                    n.inputs["Color"].default_value = C.lin(SKY_WINDOW[light_name])
        name = f"dio/{place}/{light_name}"
        path = C.render_to(scene, C.out_path(out, name))
        C.write_meta(path, {"name": name, "w": W, "h": H, "safe": [round(e, 4) for e in ext]})
        C.log(f"  {name} ({time.time() - t:.1f} s)")
        C.remove_objects(list(rig.objects))
        bpy.data.collections.remove(rig)


def main() -> None:
    ns = C.parse_args("diorami", NAMES)
    t0 = time.time()
    C.log(f"diorami: {len(ns.selected)} render → {ns.out}")
    for place in PLACES:
        lights = [n.split("/")[2] for n in ns.selected if n.split("/")[1] == place]
        if not lights:
            continue
        try:
            render_place(place, lights, ns.out)
        except Exception:  # noqa: BLE001
            import traceback

            traceback.print_exc()
            C.log(f"ERRORE su dio/{place}")
            sys.exit(1)
    C.log(f"diorami: fatto in {time.time() - t0:.1f} s")


if __name__ == "__main__":
    main()
