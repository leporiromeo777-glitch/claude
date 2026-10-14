"""Figurine (GDD 12.1, 12.5): 10 personaggi + ``lino`` × 3 pose, più Ada di legno grezzo.

Figurine di legno tornito e dipinto: basetta tonda, corpo a fuso (gonna, giacca,
tonaca o bambino), fascia del colore del filo in vita (l'unico colore saturo),
testa sferica con pochi tratti dipinti e il dettaglio del personaggio, braccia a
pioli. Pose: ``ferma`` (braccia lungo il corpo), ``porge`` (un braccio avanti con
il suo oggetto), ``saluta`` (un braccio alzato).

- ``lino``: figura anonima non dipinta (legno, cordino di lino in vita), riusata
  dal gioco per i passanti e per i personaggi d'Archivio;
- ``ada/<posa>_grezza``: la stessa Ada in legno senza vernice (memoria 0): niente
  colori, niente fascia, niente occhi.

Camera ortografica a tre quarti (azimut 30°, elevazione 20°), 256×256, stessa
scala per tutte; il piede della basetta sta all'ancora ``ay = 0.92`` (``ax = 0.5``).
Contorni Freestyle 1,2 px ``#2B2622``.

Uso: ``$BLENDER_PY tools/blender/figurine.py [--only fig/teresa,fig/ada/ferma_grezza] [--out <cartella>]``
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import common as C  # noqa: E402  (importa bpy: deve venire prima di mathutils)
import personaggi as P  # noqa: E402
from mathutils import Vector  # noqa: E402

SIZE = 256
SAMPLES = 24
ANCHOR_Y = 0.92
ORTHO = 6.05
NAMES = [f"fig/{c}/{p}" for c in P.CHARACTERS_FIG for p in P.POSES] + [f"fig/ada/{p}_grezza" for p in P.POSES]

BASE_TOP = 0.2
BASE_R = 1.06
HEAD_R = 0.62

# Profili del corpo (raggio, z) per altezza 1, dalla basetta al collo.
BODY = {
    "gonna": [(0.0, 0.2), (0.80, 0.2), (0.82, 0.32), (0.76, 0.85), (0.64, 1.55), (0.52, 2.1), (0.47, 2.36), (0.52, 2.72), (0.56, 3.0), (0.54, 3.2), (0.44, 3.42), (0.27, 3.56), (0.2, 3.63), (0.2, 3.76), (0.0, 3.76)],
    "giacca": [(0.0, 0.2), (0.62, 0.2), (0.64, 0.3), (0.60, 0.95), (0.57, 1.6), (0.55, 2.15), (0.59, 2.7), (0.62, 3.02), (0.59, 3.24), (0.47, 3.44), (0.27, 3.56), (0.2, 3.63), (0.2, 3.76), (0.0, 3.76)],
    "tonaca": [(0.0, 0.2), (0.76, 0.2), (0.77, 0.3), (0.70, 1.0), (0.60, 1.9), (0.57, 2.35), (0.59, 2.75), (0.61, 3.02), (0.58, 3.24), (0.46, 3.44), (0.27, 3.56), (0.2, 3.63), (0.2, 3.76), (0.0, 3.76)],
    "bambino": [(0.0, 1.3), (0.48, 1.3), (0.54, 1.45), (0.56, 1.65), (0.53, 1.85), (0.52, 2.15), (0.57, 2.7), (0.60, 3.02), (0.57, 3.24), (0.46, 3.44), (0.27, 3.56), (0.2, 3.63), (0.2, 3.76), (0.0, 3.76)],
}
BAND = {"gonna": (2.08, 2.5), "giacca": (1.95, 2.33), "tonaca": (2.0, 2.4), "bambino": (1.92, 2.28)}


def zh(z: float, h: float) -> float:
    return BASE_TOP + (z - BASE_TOP) * h


def scaled(profile, h: float):
    return [(r, zh(z, h)) for r, z in profile]


def radius_at(profile, z: float) -> float:
    for (r0, z0), (r1, z1) in zip(profile, profile[1:]):
        if z0 <= z <= z1 and z1 > z0:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return profile[-2][0]


class Mats:
    def __init__(self, cid: str, raw: bool):
        look = P.LOOKS[cid]
        self.raw = raw or cid == "lino"
        wood = C.mat_wood(f"legno_{cid}_{raw}", seed_name=f"fig/{cid}", scale=1.6, contrast=0.55)
        self.wood = wood
        self.base = C.mat_wood(f"basetta_{cid}_{raw}", base=C.mix_hex(C.PALETTE["legno"], C.PALETTE["legno_scuro"], 0.55), seed_name=f"fig/{cid}/basetta", scale=2.5, axis="X")
        if self.raw:
            carved = C.mat_wood(f"intaglio_{cid}_{raw}", base=C.mix_hex(C.PALETTE["legno"], C.PALETTE["legno_scuro"], 0.3), seed_name=f"fig/{cid}/intaglio", scale=2.6)
            self.body = wood
            self.detail = carved
            self.skin = wood
            self.head = P.HeadMats(main=carved, hair=carved, detail=wood, skin=wood, eye=C.mat_paint("incisione", "#4A3828"), mouth=C.mat_paint("incisione_b", "#4A3828"), metal=carved)
            self.prop = carved
        else:
            self.body = C.mat_paint(f"abito_{cid}", look.body, rough=0.6, coat=0.08)
            self.detail = C.mat_paint(f"dettaglio_{cid}", look.detail, rough=0.6, coat=0.08)
            self.skin = C.mat_paint(f"pelle_{cid}", P.SKIN, rough=0.5, coat=0.15)
            self.head = P.HeadMats(
                main=C.mat_paint(f"cappello_{cid}", look.head_main, rough=0.6, coat=0.08),
                hair=C.mat_paint(f"capelli_{cid}", look.hair, rough=0.55, coat=0.1),
                detail=self.detail,
                skin=self.skin,
                eye=C.mat_paint(f"occhi_{cid}", P.EYE, rough=0.3, coat=0.4),
                mouth=C.mat_paint(f"bocca_{cid}", P.MOUTH, rough=0.5),
                metal=C.mat_metal(f"metallo_{cid}", "#8F8A80", rough=0.4),
            )
            self.prop = None
        if raw:
            self.band = None
        elif cid == "lino":
            self.band = C.mat_thread("cordino_lino", C.THREAD["lino"], windings=40)
        else:
            self.band = C.mat_paint(f"fascia_{cid}", C.THREAD[cid], rough=0.35 if cid != "livia" else 0.18, coat=0.3 if cid != "livia" else 0.8, glow=P.BAND_GLOW)


def paint(m: Mats, color: str, name: str, rough: float = 0.55):
    return m.prop if m.raw else C.mat_paint(name, color, rough=rough, coat=0.1)


def build_prop(kind: str, m: Mats, at: Vector) -> list:
    """Piccolo oggetto tenuto in mano nella posa ``porge``."""
    x, y, z = at.x, at.y, at.z
    o: list = []
    if kind in {"busta", "lettera"}:
        carta = paint(m, "#E6DECF" if kind == "busta" else "#D9CFC0", f"carta_{kind}")
        o.append(C.box(f"{kind}", (0.46, 0.05, 0.32), (x, y - 0.08, z + 0.12), carta, rot=(0, -12, 18)))
        o.append(C.sphere(f"{kind}_sigillo", 0.06, (x + 0.02, y - 0.12, z + 0.12), paint(m, "#8E4A40", f"sigillo_{kind}"), scale=(1, 0.5, 1)))
    elif kind == "pagnotta":
        o.append(C.sphere("pagnotta", 0.27, (x, y - 0.12, z + 0.14), paint(m, "#B89566", "crosta"), scale=(1.35, 1.0, 0.72)))
        o.append(C.box("taglio", (0.04, 0.3, 0.02), (x, y - 0.12, z + 0.33), paint(m, "#8E6C46", "taglio"), rot=(0, 0, 30)))
    elif kind in {"libretto", "libro"}:
        col = "#3A3436" if kind == "libretto" else "#6F6B5E"
        o.append(C.box(kind, (0.34, 0.1, 0.44), (x, y - 0.1, z + 0.16), paint(m, col, f"copertina_{kind}"), rot=(0, 0, 25), bevel=0.02))
        o.append(C.box(f"{kind}_pagine", (0.3, 0.11, 0.4), (x + 0.02, y - 0.1, z + 0.16), paint(m, "#E6DECF", f"pagine_{kind}"), rot=(0, 0, 25)))
        if kind == "libretto":
            o.append(C.box("croce_v", (0.04, 0.02, 0.18), (x - 0.02, y - 0.17, z + 0.18), paint(m, "#B8AE96", "croce"), rot=(0, 0, 25)))
            # Braccio orizzontale un filo più spesso: la sua faccia non sta nel piano di quello verticale.
            o.append(C.box("croce_o", (0.12, 0.024, 0.04), (x - 0.02, y - 0.17, z + 0.21), paint(m, "#B8AE96", "croce2"), rot=(0, 0, 25)))
    elif kind == "aquilone":
        tela = paint(m, "#C9C1AE", "tela")
        o.append(C.prism("aquilone", [(0, 0.45), (0.26, 0.05), (0, -0.3), (-0.26, 0.05)], 0.03, (x, y - 0.12, z + 0.35), tela, rot=(0, 15, 25)))
        o.append(C.tube("coda", [(x + 0.05, y - 0.12, z + 0.05), (x + 0.2, y - 0.2, z - 0.2), (x + 0.1, y - 0.25, z - 0.5), (x + 0.25, y - 0.3, z - 0.75)], 0.018, paint(m, "#8A8576", "coda")))
    elif kind == "pesce":
        argento = paint(m, "#9BA1A0", "squame", rough=0.35)
        o.append(C.sphere("pesce", 0.3, (x, y - 0.12, z + 0.02), argento, scale=(1.5, 0.38, 0.6), rot=(0, -20, 15)))
        o.append(C.cylinder("coda", 0.18, 0.2, (x - 0.48, y - 0.12, z + 0.2), argento, rot=(0, 70, 15), r2=0.0, segments=4))
    elif kind == "lanterna":
        ferro = paint(m, "#4A4A48", "ferro", rough=0.4)
        o.append(C.cylinder("lanterna_vetro", 0.15, 0.3, (x, y - 0.1, z - 0.12), paint(m, "#E8D9B0", "vetro_lanterna", rough=0.2)))
        o.append(C.cylinder("lanterna_tetto", 0.19, 0.12, (x, y - 0.1, z + 0.08), ferro, r2=0.05))
        o.append(C.cylinder("lanterna_fondo", 0.18, 0.06, (x, y - 0.1, z - 0.3), ferro))
        o.append(C.torus("lanterna_manico", 0.1, 0.022, (x, y - 0.1, z + 0.18), ferro, rot=(90, 0, 0), seg=16, mseg=6))
    elif kind == "ampolla":
        vetro = paint(m, "#B9C2BC", "vetro_ampolla", rough=0.15)
        o.append(C.sphere("ampolla", 0.17, (x, y - 0.12, z + 0.1), vetro))
        o.append(C.cylinder("ampolla_collo", 0.06, 0.2, (x, y - 0.12, z + 0.32), vetro))
        o.append(C.cylinder("ampolla_tappo", 0.07, 0.07, (x, y - 0.12, z + 0.44), paint(m, "#8A7458", "tappo")))
    elif kind == "fuso":
        legno = m.wood
        prof = [(0, 0), (0.05, 0.02), (0.05, 0.1), (0.035, 0.14), (0.045, 0.4), (0.05, 0.55), (0.035, 0.6), (0.06, 0.66), (0.0, 0.74)]
        f = C.lathe("fusino", prof, legno, segments=12, sharp_deg=None)
        C.place(f, (x, y - 0.1, z - 0.25), rot=(0, 18, 0))
        o.append(f)
        filo = m.prop if m.raw else P.thread_material("ada", "filo_fusino", windings=60)
        g = C.cylinder("fusino_filo", 0.085, 0.16, (x + 0.04, y - 0.1, z + 0.17), filo, rot=(0, 18, 0))
        o.append(g)
    elif kind == "pacco":
        o.append(C.box("pacco", (0.36, 0.3, 0.26), (x, y - 0.12, z + 0.12), m.prop if m.raw else paint(m, "#A08C6C", "carta_pacco"), rot=(0, 0, 20), bevel=0.02))
    return o


def arm(name: str, pts, mat, hand_mat, open_hand: bool = False) -> list:
    tube = C.tube(name, pts, 0.13, mat, resolution=8, bevel_res=3)
    hand = C.sphere(f"{name}_mano", 0.15, pts[-1], hand_mat, scale=(1.0, 0.7, 1.25) if open_hand else 1.0)
    shoulder = C.sphere(f"{name}_spalla", 0.15, pts[0], mat)
    return [tube, hand, shoulder]


def build(cid: str, pose: str, raw: bool) -> tuple[list, float]:
    look = P.LOOKS[cid]
    h = look.height
    m = Mats(cid, raw)
    objs: list = []
    base_prof = [(0.0, 0.0), (BASE_R - 0.08, 0.0), (BASE_R, 0.04), (BASE_R + 0.02, 0.1), (BASE_R, 0.16), (BASE_R - 0.08, BASE_TOP), (0.0, BASE_TOP)]
    objs.append(C.lathe("basetta", base_prof, m.base, segments=48, sharp_deg=50))
    shape = look.shape
    prof = scaled(BODY[shape], h)
    objs.append(C.lathe("corpo", prof, m.body, segments=40, sharp_deg=38))
    if shape == "bambino":
        # Gambe e calzoncini sotto la maglia.
        legs_mat = m.skin if not m.raw else m.wood
        for sx in (-1, 1):
            objs.append(C.cylinder(f"gamba{sx}", 0.15, zh(1.1, h) - BASE_TOP, (sx * 0.22, 0, (BASE_TOP + zh(1.1, h)) / 2), legs_mat))
            objs.append(C.cylinder(f"scarpa{sx}", 0.18, 0.12, (sx * 0.22, -0.05, BASE_TOP + 0.06), m.detail, r2=0.15))
        shorts = [(0.0, zh(0.95, h)), (0.4, zh(0.95, h)), (0.45, zh(1.1, h)), (0.47, zh(1.4, h)), (0.0, zh(1.4, h))]
        objs.append(C.lathe("calzoncini", shorts, m.detail, segments=32, sharp_deg=40))
    # Fascia del colore del filo.
    if m.band is not None:
        z0, z1 = BAND[shape]
        z0, z1 = zh(z0, h), zh(z1, h)
        r0, r1 = radius_at(prof, z0), radius_at(prof, z1)
        e = 0.035 if cid != "lino" else 0.02
        if cid == "lino":
            zc = (z0 + z1) / 2
            objs.append(C.torus("cordino", radius_at(prof, zc) + 0.01, 0.055, (0, 0, zc), m.band, seg=40, mseg=8))
        else:
            band_prof = [(r0 - 0.02, z0), (r0 + e, z0), (r0 + e + 0.01, z0 + 0.03), (r1 + e + 0.01, z1 - 0.03), (r1 + e, z1), (r1 - 0.02, z1)]
            objs.append(C.lathe("fascia", band_prof, m.band, segments=40, sharp_deg=30, cap=False))
    # Grembiule, colletto, bottoni, mantella, borsa…
    if "grembiule" in look.extras:
        zt = zh(2.15 if shape == "gonna" else 2.0, h)
        ap = [(radius_at(prof, z) + 0.03, z) for z in [zh(v, h) for v in (0.45, 0.8, 1.2, 1.6, 1.95)] + [zt]]
        objs.append(C.lathe("grembiule", ap, m.detail if not m.raw else m.wood, segments=20, sharp_deg=None, cap=False, sweep_deg=120, phase=-150))
    if "colletto" in look.extras:
        objs.append(C.torus("colletto", 0.29, 0.085, (0, 0, zh(3.56, h)), m.detail, seg=32, mseg=8, scale=(1, 1, 0.8)))
    if "bottoni" in look.extras:
        for i, z in enumerate((2.55, 2.8, 3.05)):
            zz = zh(z, h)
            rr = radius_at(prof, zz)
            objs.append(C.sphere(f"bottone{i}", 0.055, (0, -rr - 0.01, zz), m.head.metal if not m.raw else m.detail))
    if "farfallino" in look.extras:
        zz = zh(3.45, h)
        for sx in (-1, 1):
            objs.append(C.cylinder(f"farfallino{sx}", 0.09, 0.14, (sx * 0.07, -0.42, zz), m.detail, rot=(0, sx * 90, 0), r2=0.02, segments=10))
    if "mantella" in look.extras:
        cape = [(0.28, zh(3.62, h)), (0.52, zh(3.42, h)), (0.68, zh(3.05, h)), (0.76, zh(2.6, h)), (0.8, zh(2.3, h))]
        objs.append(C.lathe("mantella", cape, m.head.main, segments=40, sharp_deg=None, cap=False))
    if "borsa" in look.extras:
        leather = m.wood if m.raw else C.mat_paint("cuoio", "#6A5A48", rough=0.5, coat=0.15)
        zz = zh(2.05, h)
        objs.append(C.box("borsa", (0.22, 0.52, 0.42), (-0.62, -0.08, zz), leather, rot=(0, 8, -10), bevel=0.03))
        objs.append(C.tube("tracolla", [(-0.6, -0.25, zz + 0.2), (-0.35, -0.52, zh(2.75, h)), (0.0, -0.58, zh(3.1, h)), (0.32, -0.45, zh(3.4, h)), (0.42, 0.0, zh(3.45, h)), (0.2, 0.42, zh(3.2, h))], 0.035, leather))
    # Testa.
    neck_top = zh(3.76, h)
    hr = HEAD_R * (0.93 + 0.07 * h)
    hc = Vector((0.0, 0.0, neck_top + hr * 0.86))
    objs.append(C.sphere("testa", hr, tuple(hc), m.skin, segments=32, rings=16))
    if not raw:
        objs += P.face("viso_", hc, hr, m.head, mouth=True)
    objs += P.head_detail(cid, "testa_", hc, hr, m.head, carved=m.raw)
    # Braccia.
    sz = zh(3.28, h)
    ez = zh(2.72, h)
    hz = zh(2.2, h)

    def hanging(sx: int):
        return [(sx * 0.5, 0.0, sz), (sx * 0.64, 0.02, ez), (sx * 0.7, -0.06, hz)]

    arms = {-1: hanging(-1), 1: hanging(1)}
    open_hand = False
    if pose == "porge":
        arms[1] = [(0.5, 0.0, sz), (0.66, -0.12, ez + 0.02), (0.56, -0.78, zh(2.82, h))]
    elif pose == "saluta":
        arms[1] = [(0.5, 0.0, sz + 0.02), (0.98, -0.08, sz + 0.42), (1.06, -0.14, sz + 1.08)]
        open_hand = True
    sleeve = m.head.main if "mantella" in look.extras else m.body
    for sx, pts in arms.items():
        objs += arm(f"braccio{sx}", pts, sleeve, m.skin, open_hand=open_hand and sx == 1)
    if pose == "porge":
        objs += build_prop(look.prop, m, Vector(arms[1][-1]))
    return objs, h


def render_one(name: str, out: str) -> None:
    parts = name.split("/")
    cid, pose = parts[1], parts[2]
    raw = pose.endswith("_grezza")
    pose = pose.replace("_grezza", "")
    C.rng(name)
    scene = C.reset_scene()
    C.setup_render(scene, SIZE, SIZE, SAMPLES, transparent=True)
    C.enable_freestyle(scene, thickness=1.2)
    objs, _h = build(cid, pose, raw)
    C.rig_studio(scene, warm=3.0, fill=1.0, rim=1.8)
    cam = C.ortho_camera(scene, azimuth=30, elevation=20, target=(0, 0, 2.6), ortho_scale=ORTHO)
    # Piede della basetta (il punto più basso del disco verso la camera) sull'ancora.
    toward = Vector((cam.location.x, cam.location.y, 0.0)).normalized() * BASE_R
    foot = (toward.x, toward.y, 0.0)
    fx, fy = C.project(scene, cam, foot)
    C.shift_camera_px(scene, cam, (0.5 - fx) * SIZE, (ANCHOR_Y - fy) * SIZE)
    ax, ay = C.project(scene, cam, foot)
    ext = C.assert_inside(scene, cam, objs, name, pad=0.004)
    C.log(f"    estensione u {ext[0]:.3f}-{ext[2]:.3f}, v {ext[1]:.3f}-{ext[3]:.3f}")
    path = C.render_to(scene, C.out_path(out, name))
    C.write_meta(path, {"name": name, "w": SIZE, "h": SIZE, "ax": round(ax, 4), "ay": round(ay, 4)})


if __name__ == "__main__":
    C.run_batch("figurine", NAMES, render_one)
