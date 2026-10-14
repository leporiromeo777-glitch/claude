"""Personaggi: colori, abiti desaturati e teste intagliate (GDD 5.4, 12.1).

Usato da ``fusi.py`` (teste di legno intagliato, senza vernice) e da
``figurine.py`` (figurine di legno tornito e dipinto). Ogni personaggio ha un
dettaglio riconoscibile in testa, pensato per leggersi anche a 40 px:

- teresa: berretto da postina con visiera;   marta: cuffia da fornaia;
- piero: saturno (cappello da prete);        gino: coppola;
- bepi: berretto di lana floscio con pompon; nina: due trecce;
- zeno: berretto con visiera e barba;        lunardi: bombetta, occhiali, baffi;
- livia: scialle sulla testa;                ada: treccia sulla spalla con nastro;
- clotilde: crocchia e occhiali tondi;       lino: testa liscia, nessun dettaglio.

Gli abiti sono desaturati (saturazione HSV ≤ 0,35): l'unico strato saturo della
figurina è la fascia del colore del filo.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import common as C  # importa bpy: deve venire prima di mathutils
from mathutils import Vector

CHARACTERS_FUSO = ["teresa", "marta", "piero", "gino", "bepi", "nina", "zeno", "lunardi", "livia", "ada", "clotilde", "lino"]
CHARACTERS_FIG = ["teresa", "marta", "piero", "gino", "bepi", "nina", "zeno", "lunardi", "livia", "ada", "lino"]
POSES = ["ferma", "porge", "saluta"]

SKIN = "#E0C9AC"
EYE = "#2B2622"
MOUTH = "#8C6458"


@dataclass
class Look:
    """Abito e proporzioni di una figurina."""

    body: str  # colore principale dell'abito
    head_main: str  # cappello / cuffia / capelli
    hair: str = "#5A4636"
    detail: str = "#E3DDD2"  # colletto, grembiule, barba…
    shape: str = "gonna"  # gonna | giacca | tonaca | bambino
    height: float = 1.0
    prop: str = "nessuno"  # oggetto porto nella posa "porge"
    extras: list[str] = field(default_factory=list)


LOOKS: dict[str, Look] = {
    "teresa": Look(body="#6C7480", head_main="#5C646E", hair="#6A5848", shape="gonna", prop="busta", extras=["borsa"]),
    "marta": Look(body="#7E6F65", head_main="#E1DBCF", hair="#5A4636", detail="#DCD5C8", shape="gonna", height=0.97, prop="pagnotta", extras=["grembiule"]),
    "piero": Look(body="#2F2C2E", head_main="#272426", detail="#E8E4DA", shape="tonaca", height=1.0, prop="libretto", extras=["colletto"]),
    "gino": Look(body="#8A8576", head_main="#6C6860", detail="#5F5E58", shape="bambino", height=0.76, prop="aquilone"),
    "bepi": Look(body="#5B6064", head_main="#7A5F56", detail="#4C4F52", shape="giacca", height=1.02, prop="pesce"),
    "nina": Look(body="#8C9183", head_main="#5E4B3C", hair="#5E4B3C", detail="#E0DACE", shape="gonna", height=0.95, prop="libro", extras=["colletto"]),
    "zeno": Look(body="#464C55", head_main="#3D424A", detail="#9A958E", shape="giacca", height=1.03, prop="lanterna", extras=["bottoni"]),
    "lunardi": Look(body="#A29E97", head_main="#38343A", hair="#4A3C32", detail="#3A3536", shape="giacca", height=1.0, prop="ampolla", extras=["farfallino"]),
    "livia": Look(body="#958C82", head_main="#2A2421", hair="#3E322A", detail="#2A2421", shape="gonna", height=0.98, prop="lettera", extras=["mantella"]),
    "ada": Look(body="#8E8682", head_main="#5A4434", hair="#5A4434", detail="#E3DDD2", shape="gonna", height=0.93, prop="fuso", extras=["grembiule"]),
    "lino": Look(body=C.PALETTE["legno"], head_main=C.PALETTE["legno"], shape="giacca", height=0.98, prop="pacco"),
}


#: Velo di emissione del colore nominale sul filo dei fusi e sulla fascia delle figurine
#: (``common._add_glow``): con 0,3 la tinta misurata sui render resta entro Δ 40 RGB da GDD 5.4
#: anche per azzurro, argento e avorio, senza appiattire l'ombreggiatura (provati 0, 0,25, 0,5).
THREAD_GLOW = 0.3
BAND_GLOW = 0.3


def thread_material(cid: str, name: str | None = None, windings: float = 26.0, glow: float = 0.0):
    col = C.THREAD[cid]
    if cid == "livia":
        return C.mat_thread(name or f"filo_{cid}", col, glossy=True, windings=windings, sheen_color=C.LIVIA_SHEEN, glow=glow)
    return C.mat_thread(name or f"filo_{cid}", col, glossy=False, windings=windings, glow=glow)


# --------------------------------------------------------------------------
# Teste
# --------------------------------------------------------------------------


class HeadMats:
    """Materiali della testa: per i fusi è tutto legno, per le figurine è dipinto."""

    def __init__(self, main, hair, detail, skin, eye, mouth, metal=None):
        self.main = main
        self.hair = hair
        self.detail = detail
        self.skin = skin
        self.eye = eye
        self.mouth = mouth
        self.metal = metal or detail


def _v(c: Vector, x: float, y: float, z: float) -> tuple[float, float, float]:
    return (c.x + x, c.y + y, c.z + z)


def face(p: str, c: Vector, r: float, m: HeadMats, mouth: bool = True) -> list:
    """Occhi (due punti) e una piccola bocca, sul davanti (-Y) un po' girati verso la camera."""
    objs = []
    for sx in (-1, 1):
        objs.append(C.sphere(f"{p}occhio{sx}", r * 0.11, _v(c, sx * 0.33 * r, -0.9 * r, 0.06 * r), m.eye, scale=(1.0, 0.6, 1.25), segments=12, rings=6))
    if mouth:
        objs.append(C.sphere(f"{p}bocca", r * 0.1, _v(c, 0.0, -0.95 * r, -0.36 * r), m.mouth, scale=(1.5, 0.5, 0.55), segments=12, rings=6))
    return objs


def _hair_cap(p, c, r, mat, back=0.12, z=0.2, sz=0.86, grow=1.06):
    return C.sphere(f"{p}capelli", r * grow, _v(c, 0, back * r, z * r), mat, scale=(1.0, 1.0, sz))


def head_detail(cid: str, p: str, c: Vector, r: float, m: HeadMats, carved: bool) -> list:
    """Dettaglio intagliato o dipinto sulla testa (centro ``c``, raggio ``r``)."""
    o: list = []
    if cid == "teresa":
        o.append(_hair_cap(p, c, r, m.hair))
        o.append(C.sphere(f"{p}crocchia", r * 0.36, _v(c, 0, 0.82 * r, -0.12 * r), m.hair))
        o.append(C.cylinder(f"{p}kepi", r * 0.86, r * 0.62, _v(c, 0, 0.06 * r, 0.78 * r), m.main, rot=(-8, 0, 0), r2=r * 0.95))
        o.append(C.cylinder(f"{p}kepi_top", r * 0.97, r * 0.08, _v(c, 0, 0.1 * r, 1.1 * r), m.main, rot=(-8, 0, 0)))
        o.append(C.sphere(f"{p}visiera", r * 0.72, _v(c, 0, -0.62 * r, 0.52 * r), m.main, scale=(1.0, 0.62, 0.09), rot=(-16, 0, 0)))
        o.append(C.sphere(f"{p}stemma", r * 0.13, _v(c, 0, -0.84 * r, 0.82 * r), m.metal, scale=(1, 0.5, 1)))
    elif cid == "marta":
        o.append(C.sphere(f"{p}cuffia", r * 1.08, _v(c, 0, 0.1 * r, 0.42 * r), m.main, scale=(1.06, 1.06, 0.68)))
        o.append(C.torus(f"{p}cuffia_orlo", r * 0.93, r * 0.11, _v(c, 0, 0.04 * r, 0.3 * r), m.detail, rot=(-6, 0, 0)))
        o.append(C.sphere(f"{p}fiocco", r * 0.28, _v(c, 0, 0.95 * r, 0.25 * r), m.detail, scale=(1.4, 0.7, 0.8)))
    elif cid == "piero":
        o.append(C.cylinder(f"{p}tesa", r * 1.62, r * 0.1, _v(c, 0, 0, 0.66 * r), m.main, rot=(-5, 0, 0), segments=40))
        o.append(C.torus(f"{p}tesa_orlo", r * 1.6, r * 0.07, _v(c, 0, 0, 0.66 * r), m.main, rot=(-5, 0, 0), seg=40, mseg=8))
        o.append(C.sphere(f"{p}cupola", r * 0.8, _v(c, 0, 0.03 * r, 0.72 * r), m.main, scale=(1, 1, 0.78)))
    elif cid == "gino":
        o.append(C.sphere(f"{p}coppola", r * 1.02, _v(c, 0, 0.06 * r, 0.42 * r), m.main, scale=(1.04, 1.1, 0.56)))
        o.append(C.sphere(f"{p}visiera", r * 0.62, _v(c, 0, -0.84 * r, 0.36 * r), m.main, scale=(1.0, 0.7, 0.11), rot=(-10, 0, 0)))
        o.append(C.sphere(f"{p}bottone", r * 0.12, _v(c, 0, 0.0, 0.98 * r), m.main))
        for sx in (-1, 1):
            o.append(C.sphere(f"{p}orecchio{sx}", r * 0.2, _v(c, sx * 0.98 * r, 0.05 * r, -0.05 * r), m.skin, scale=(0.5, 1, 1.2)))
    elif cid == "bepi":
        cap = C.lathe(
            f"{p}berretto",
            [(0.0, 0.0), (r * 0.98, 0.0), (r * 0.9, r * 0.45), (r * 0.66, r * 0.82), (r * 0.36, r * 1.05), (r * 0.12, r * 1.18), (0.0, r * 1.2)],
            m.main,
            segments=28,
            sharp_deg=None,
        )
        C.place(cap, _v(c, 0.05 * r, 0.04 * r, 0.28 * r), rot=(0, 24, 0))
        o.append(cap)
        o.append(C.torus(f"{p}risvolto", r * 0.94, r * 0.17, _v(c, 0, 0.02 * r, 0.32 * r), m.main, rot=(-4, 6, 0)))
        o.append(C.sphere(f"{p}pompon", r * 0.24, _v(c, 0.62 * r, 0.04 * r, 1.34 * r), m.detail if carved else m.main))
    elif cid == "nina":
        o.append(_hair_cap(p, c, r, m.hair, back=0.1, z=0.18, sz=0.88))
        for sx in (-1, 1):
            for i in range(4):
                rr = r * (0.24 - i * 0.025)
                o.append(C.sphere(f"{p}treccia{sx}_{i}", rr, _v(c, sx * (0.86 - i * 0.02) * r, 0.08 * r, (-0.3 - i * 0.36) * r), m.hair))
            o.append(C.sphere(f"{p}nastro{sx}", r * 0.16, _v(c, sx * 0.8 * r, 0.05 * r, -1.68 * r), m.detail, scale=(1.6, 0.8, 0.8)))
        o.append(C.sphere(f"{p}frangia", r * 0.6, _v(c, 0, -0.62 * r, 0.62 * r), m.hair, scale=(1.3, 0.55, 0.5)))
    elif cid == "zeno":
        o.append(C.cylinder(f"{p}berretto", r * 0.9, r * 0.42, _v(c, 0, 0.04 * r, 0.75 * r), m.main, rot=(-6, 0, 0), r2=r * 1.0))
        o.append(C.cylinder(f"{p}berretto_top", r * 1.04, r * 0.1, _v(c, 0, 0.06 * r, 0.98 * r), m.main, rot=(-6, 0, 0)))
        o.append(C.sphere(f"{p}visiera", r * 0.66, _v(c, 0, -0.7 * r, 0.56 * r), m.main, scale=(1.0, 0.62, 0.1), rot=(-14, 0, 0)))
        o.append(C.sphere(f"{p}barba", r * 0.86, _v(c, 0, -0.26 * r, -0.5 * r), m.detail, scale=(1.12, 0.82, 0.9)))
        o.append(C.sphere(f"{p}baffi", r * 0.34, _v(c, 0, -0.9 * r, -0.2 * r), m.detail, scale=(1.5, 0.5, 0.45)))
        for sx in (-1, 1):
            o.append(C.sphere(f"{p}basetta{sx}", r * 0.3, _v(c, sx * 0.86 * r, -0.05 * r, -0.12 * r), m.detail, scale=(0.6, 0.9, 1.3)))
    elif cid == "lunardi":
        o.append(C.sphere(f"{p}bombetta", r * 0.82, _v(c, 0, 0.02 * r, 0.6 * r), m.main, scale=(1.0, 1.0, 0.9)))
        o.append(C.torus(f"{p}tesa", r * 1.0, r * 0.12, _v(c, 0, 0.02 * r, 0.5 * r), m.main, scale=(1.0, 1.0, 0.55)))
        o.append(C.cylinder(f"{p}tesa_piatta", r * 1.02, r * 0.05, _v(c, 0, 0.02 * r, 0.5 * r), m.main))
        for sx in (-1, 1):
            o.append(C.torus(f"{p}lente{sx}", r * 0.17, r * 0.028, _v(c, sx * 0.33 * r, -0.96 * r, 0.06 * r), m.metal, rot=(90, 0, 0), seg=20, mseg=6))
        o.append(C.sphere(f"{p}baffi", r * 0.26, _v(c, 0, -0.93 * r, -0.24 * r), m.hair, scale=(1.5, 0.4, 0.34)))
    elif cid == "livia":
        o.append(C.sphere(f"{p}scialle", r * 1.12, _v(c, 0, 0.3 * r, 0.14 * r), m.main, scale=(1.06, 1.0, 1.08)))
        drape = C.lathe(
            f"{p}scialle_giu",
            [(r * 1.04, 0.0), (r * 1.06, -0.45 * r), (r * 1.0, -0.85 * r), (r * 0.92, -1.1 * r), (r * 1.02, -1.3 * r)],
            m.main,
            segments=32,
            sharp_deg=None,
            cap=False,
            sweep_deg=230,
            phase=-25,
        )
        C.place(drape, _v(c, 0, 0.16 * r, 0.0))
        o.append(drape)
        o.append(C.sphere(f"{p}scriminatura", r * 0.5, _v(c, 0, -0.66 * r, 0.6 * r), m.hair, scale=(1.5, 0.5, 0.42)))
    elif cid == "ada":
        o.append(_hair_cap(p, c, r, m.hair, back=0.1, z=0.18, sz=0.88))
        o.append(C.sphere(f"{p}frangia", r * 0.55, _v(c, 0.15 * r, -0.66 * r, 0.6 * r), m.hair, scale=(1.4, 0.55, 0.45), rot=(0, -12, 0)))
        pts = [(0.78, 0.25, -0.25), (0.86, -0.1, -0.6), (0.8, -0.32, -0.95), (0.7, -0.45, -1.3)]
        for i, (x, y, z) in enumerate(pts):
            o.append(C.sphere(f"{p}treccia_{i}", r * (0.27 - i * 0.03), _v(c, x * r, y * r, z * r), m.hair))
        o.append(C.sphere(f"{p}nastro", r * 0.17, _v(c, 0.68 * r, -0.5 * r, -1.55 * r), m.detail, scale=(1.7, 0.8, 0.8)))
    elif cid == "clotilde":
        o.append(_hair_cap(p, c, r, m.hair, back=0.05, z=0.18, sz=0.8))
        o.append(C.sphere(f"{p}crocchia", r * 0.44, _v(c, 0, 0.18 * r, 1.0 * r), m.hair, scale=(1, 1, 0.85)))
        o.append(C.torus(f"{p}forcina", r * 0.3, r * 0.06, _v(c, 0, 0.18 * r, 1.0 * r), m.metal, rot=(0, 90, 0), seg=16, mseg=6))
        for sx in (-1, 1):
            o.append(C.torus(f"{p}lente{sx}", r * 0.26, r * 0.055, _v(c, sx * 0.34 * r, -0.92 * r, 0.04 * r), m.metal, rot=(90, 0, 0), seg=20, mseg=6))
        o.append(C.cylinder(f"{p}ponte", r * 0.04, r * 0.18, _v(c, 0, -0.97 * r, 0.06 * r), m.metal, rot=(0, 90, 0), segments=8))
    elif cid == "lino":
        pass
    else:
        raise ValueError(f"personaggio sconosciuto: {cid}")
    return o
