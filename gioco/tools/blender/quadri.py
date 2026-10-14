"""Quadri speciali L1 (GDD 12.5): ``tab/sedia_vuota``, ``tab/tempesta``, ``tab/secca``,
``tab/sacrestia_lettere``. 1024×768 opachi come i diorami: Cycles 32 campioni,
contorni Freestyle 1,2 px ``#2B2622`` (escluse acqua, cielo, pioggia e fasci di luce),
mondo desaturato con i soli dettagli di filo saturi.

- ``sedia_vuota`` (prologo): la sedia impagliata della nonna con lo scialle, vuota,
  accanto al tombolo; luce d'alba dalla finestrella, il gomitolo corallo di Ada a terra;
- ``tempesta`` (g15): notte di burrasca al Faro, onde, pioggia, il fascio della
  lanterna e la barca di Bepi (cima arancio) che rientra fra le onde;
- ``secca`` (g22): la secca più bassa dell'anno, barene e canali scoperti, barche in
  secco, la lingua di sabbia fino al Faro e una figura con lo scialle nero (Livia) che
  arriva a piedi lasciando le impronte;
- ``sacrestia_lettere`` (g14-g16): la sacrestia di Don Piero, l'armadio aperto pieno
  di lettere, la cassetta sul tavolo, il fascio legato col filo nero di Livia, la
  stola viola e la candela accesa.

I quadri si rendono da ``oggetti.py`` (``--only tab/secca``), che chiama ``render_tableau``.
"""

from __future__ import annotations

import math
import os
import time

import common as C  # importa bpy: deve venire prima di mathutils
import scenografia as S
import bpy

W, H = 1024, 768
SAMPLES = 32
TABLEAUX: list[str] = ["sedia_vuota", "tempesta", "secca", "sacrestia_lettere"]
SAFE = (0.125, 0.125, 0.875, 0.875)  # area sicura 768×576 (il gioco ritaglia a "cover")
PREVIEW = os.environ.get("TRAMA_ANTEPRIMA") == "1"  # metà risoluzione, pochi campioni, senza contorni


class Tableau:
    """Risultato della costruzione: camera, soggetto principale e collezione senza contorni."""

    def __init__(self, target, azimuth: float, elevation: float, ortho: float):
        self.target = target
        self.azimuth = azimuth
        self.elevation = elevation
        self.ortho = ortho
        self.main: list = []


# --------------------------------------------------------------------------
# Materiali particolari dei quadri
# --------------------------------------------------------------------------


def mat_veil(name: str, color: str, strength: float, alpha: float, fade: bool = False):
    """Velo emissivo semitrasparente (fasci di luce, pioggia): niente ombre, niente contorni.

    Con ``fade`` l'opacità cala lungo l'asse Z locale dell'oggetto (coordinate Generated),
    da ``alpha`` alla base a zero in cima: un fascio di luce che si perde nel buio."""
    mat, nodes, links, bsdf, out = C._new_material(name)
    nodes.remove(bsdf)
    em = nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = C.lin(color)
    em.inputs["Strength"].default_value = strength
    tr = nodes.new("ShaderNodeBsdfTransparent")
    mix = nodes.new("ShaderNodeMixShader")
    mix.inputs["Fac"].default_value = alpha
    if fade:
        tc = nodes.new("ShaderNodeTexCoord")
        sep = nodes.new("ShaderNodeSeparateXYZ")
        links.new(tc.outputs["Generated"], sep.inputs[0])
        inv = nodes.new("ShaderNodeMath")
        inv.operation = "SUBTRACT"
        inv.inputs[0].default_value = 1.0
        links.new(sep.outputs["Z"], inv.inputs[1])
        pw = nodes.new("ShaderNodeMath")
        pw.operation = "POWER"
        pw.inputs[1].default_value = 1.6
        links.new(inv.outputs[0], pw.inputs[0])
        mul = nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        mul.inputs[1].default_value = alpha
        links.new(pw.outputs[0], mul.inputs[0])
        links.new(mul.outputs[0], mix.inputs["Fac"])
    links.new(tr.outputs[0], mix.inputs[1])
    links.new(em.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], out.inputs["Surface"])
    mat.diffuse_color = C.lin(color, alpha)
    return mat


def mat_sky(name: str, low: str, high: str, clouds: float = 0.0, scale: float = 0.08):
    """Fondale del cielo: gradiente verticale (coordinate oggetto) con nuvole morbide facoltative."""
    mat, nodes, links, bsdf, out = C._new_material(name)
    nodes.remove(bsdf)
    tc = nodes.new("ShaderNodeTexCoord")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(tc.outputs["Generated"], sep.inputs[0])
    ramp = C._ramp(nodes, [(0.0, low), (1.0, high)])
    links.new(sep.outputs["Y"], ramp.inputs["Fac"])
    color_out = ramp.outputs["Color"]
    if clouds > 0:
        noise = nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 1.0 / scale
        noise.inputs["Detail"].default_value = 2.0
        noise.inputs["Roughness"].default_value = 0.45
        mp = nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (1.0, 2.6, 1.0)
        links.new(tc.outputs["Object"], mp.inputs["Vector"])
        links.new(mp.outputs["Vector"], noise.inputs["Vector"])
        cr = C._ramp(nodes, [(0.35, "#000000"), (0.75, "#FFFFFF")])
        links.new(noise.outputs["Fac"], cr.inputs["Fac"])
        mix = nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "SCREEN"
        mix.inputs["Factor"].default_value = clouds
        links.new(cr.outputs["Color"], mix.inputs["Factor"])
        links.new(ramp.outputs["Color"], mix.inputs[6])
        mix.inputs[7].default_value = C.lin(C.shade_hex(high, 0.12))
        color_out = mix.outputs[2]
    em = nodes.new("ShaderNodeEmission")
    links.new(color_out, em.inputs["Color"])
    em.inputs["Strength"].default_value = 1.0
    links.new(em.outputs[0], out.inputs["Surface"])
    mat.diffuse_color = C.lin(high)
    return mat


def sky_card(name: str, coll, loc, size, low: str, high: str, clouds: float = 0.0):
    card = C.plane(name, size, loc, mat_sky(f"{name}_m", low, high, clouds), rot=(90, 0, 0), coll=coll)
    card.visible_shadow = False
    card.visible_diffuse = False
    card.visible_glossy = True
    return card


# --------------------------------------------------------------------------
# sedia_vuota
# --------------------------------------------------------------------------


def build_sedia_vuota(nl) -> Tableau:
    tb = Tableau(target=(0.15, 0.6, 1.55), azimuth=14, elevation=16, ortho=7.0)
    wall = C.mat_plaster("q_muro", "#B9AD9A", amount=0.05)
    C.box("pavimento", (12, 8, 0.3), (0, 1.0, -0.15), S.M("assi"))
    for k in range(8):
        C.box(f"fuga{k}", (12, 0.022, 0.01), (0, -2.6 + k * 0.95, 0.002), C.mat_paint("q_fuga", "#5E5142", rough=0.9))
    yb, th = 3.2, 0.3
    wx, wz, ww, wh = -1.55, 2.75, 1.1, 1.3
    C.box("parete_sx", (6 + wx - ww / 2, th, 5.0), ((-6 + wx - ww / 2) / 2, yb, 2.5), wall)
    C.box("parete_dx", (6 - wx - ww / 2, th, 5.0), ((6 + wx + ww / 2) / 2, yb, 2.5), wall)
    C.box("parete_sotto", (ww, th, wz - wh / 2), (wx, yb, (wz - wh / 2) / 2), wall)
    C.box("parete_sopra", (ww, th, 5.0 - wz - wh / 2), (wx, yb, (5.0 + wz + wh / 2) / 2), wall)
    C.box("battiscopa", (12, 0.05, 0.22), (0, yb - th / 2 - 0.025, 0.11), S.M("legno_scuro"))
    fr = S.M("legno_scuro")
    for s in (-1, 1):
        C.box(f"telaio_v{s}", (0.09, 0.1, wh), (wx + s * (ww / 2 - 0.045), yb - 0.08, wz), fr)
        C.box(f"telaio_o{s}", (ww, 0.1, 0.09), (wx, yb - 0.08, wz + s * (wh / 2 - 0.045)), fr)
    C.box("croce_v", (0.05, 0.07, wh), (wx, yb - 0.08, wz), fr)
    C.box("croce_o", (ww, 0.07, 0.05), (wx, yb - 0.08, wz + 0.08), fr)
    C.box("davanzale", (ww + 0.3, 0.42, 0.08), (wx, yb - 0.24, wz - wh / 2 - 0.04), S.M("pietra_bianca"))
    sky = C.plane("cielo", (5, 5), (wx, yb + 1.2, wz), C.mat_emit("q_cielo_alba", "#E8CDB2", 1.0), rot=(90, 0, 0), coll=nl)
    sky.visible_shadow = False
    # Vasetto sul davanzale con un rametto secco.
    C.cylinder("vasetto", 0.09, 0.2, (wx + 0.32, yb - 0.24, wz - wh / 2 + 0.1), C.mat_paint("q_coccio", "#9A7A66", rough=0.7), r2=0.11, segments=12)
    C.tube("rametto", [(wx + 0.32, yb - 0.24, wz - wh / 2 + 0.18), (wx + 0.3, yb - 0.26, wz - wh / 2 + 0.42), (wx + 0.38, yb - 0.25, wz - wh / 2 + 0.62)], 0.012, S.M("legno_scuro"), resolution=4)
    # La sedia vuota, girata verso il tombolo; sulla seduta le forbici della nonna.
    ch = S.chair("sedia")
    C.group("sedia_g", ch, loc=(-0.15, 0.3, 0.0), rot=(0, 0, -24))
    tb.main += ch
    sc = S.scissors("forbici_sedia", open_deg=12.0)
    C.group("forbici_g", [o for o in sc if o.parent is None], loc=(-0.12, 0.05, 1.07), rot=(0, 0, 40), scale=0.22)
    # Il tombolo (di taglio, a destra) con il merletto lasciato a metà.
    t = S.tombolo("tombolo_sedia", threads=["clotilde", "clotilde", "teresa", "marta", "clotilde", "piero"])
    C.group("tombolo_g", [o for o in t if o.parent is None], loc=(2.95, 1.45, 0.0), rot=(0, 0, 66), scale=0.78)
    # Cesta con i fuselli e il gomitolo corallo di Ada rotolato a terra, col filo che si svolge.
    basket = C.lathe("cesta", [(0.0, 0.0), (0.36, 0.0), (0.44, 0.34), (0.41, 0.37), (0.0, 0.06)], S.M("paglia"), segments=20, sharp_deg=None)
    C.place(basket, (0.75, -0.35, 0.0))
    for k, cid in enumerate(("clotilde", "lino", "clotilde")):
        b = S.bobbin(f"fuso_cesta{k}", cid, length=0.75)
        C.group(f"fuso_cesta_g{k}", b, loc=(0.65 + k * 0.1, -0.33 + 0.04 * k, 0.2), rot=(0, 32 + k * 14, 25 * k))
    tb.main.append(C.sphere("gomitolo", 0.15, (0.15, -0.95, 0.15), S.thread_mat("ada"), scale=(1.0, 1.0, 0.95)))
    C.tube("gomitolo_filo", [(0.15, -0.95, 0.02), (-0.15, -0.8, 0.012), (-0.35, -0.55, 0.012), (-0.3, -0.2, 0.012), (-0.45, 0.05, 0.012)], 0.012, S.thread_mat("ada"), resolution=8)
    # Il lume spento e un quadretto alla parete.
    C.box("quadretto", (0.8, 0.05, 0.62), (1.0, yb - 0.18, 3.0), S.M("legno_scuro"))
    C.box("quadretto_carta", (0.64, 0.05, 0.46), (1.0, yb - 0.2, 3.0), S.M("carta"))
    C.box("mensola", (1.4, 0.32, 0.06), (1.9, yb - 0.32, 2.2), S.M("legno"))
    lamp = S.oil_lamp("lume")
    C.group("lume_g", lamp, loc=(1.6, yb - 0.32, 2.23))
    bk = S.book("libro_mensola")
    C.group("libro_g", [o for o in bk if o.parent is None], loc=(2.15, yb - 0.32, 2.23), rot=(0, 0, 8), scale=0.22)
    return tb


def light_sedia_vuota(scene, tb: Tableau, coll) -> None:
    # Alba dalla finestrella: lama di luce calda e bassa che entra dal fondo e cade sulla sedia.
    C.light("AREA", "finestra_luce", C.LIGHT["sole_alba"], 820.0, loc=(-1.55, 4.9, 3.4), target=(-0.6, 0.2, 0.8), size=1.0, coll=coll)
    C.sun("sole_basso", C.LIGHT["sole_alba"], 2.2, azimuth=-155, elevation=12, angle_deg=2, coll=coll)
    C.area_fill("riempimento", C.LIGHT["cielo_freddo"], 0.8, azimuth=25, elevation=30, target=tb.target, coll=coll)
    C.set_world(scene, C.LIGHT["cielo_alba"], 0.45)


# --------------------------------------------------------------------------
# tempesta
# --------------------------------------------------------------------------


def wave_height(x: float, y: float) -> float:
    return (
        0.22 * math.sin(0.9 * x + 0.55 * y)
        + 0.14 * math.sin(1.7 * x - 0.8 * y + 1.3)
        + 0.08 * math.sin(2.9 * x + 1.9 * y + 0.4)
        + 0.05 * math.sin(4.3 * x - 2.6 * y + 2.2)
    )


def rain(name: str, coll, area, n: int, length: float, slant: float, seed: str):
    """Pioggia: un'unica mesh di quadrilateri sottili inclinati (rivolti verso la camera)."""
    rr = C.rng(seed)
    x0, x1, y0, y1, z0, z1 = area
    verts: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for _ in range(n):
        x, y, z = rr.uniform(x0, x1), rr.uniform(y0, y1), rr.uniform(z0, z1)
        ln = length * rr.uniform(0.6, 1.2)
        w = 0.018
        dx, dz = math.sin(math.radians(slant)) * ln, math.cos(math.radians(slant)) * ln
        k = len(verts)
        verts += [(x - w, y, z), (x + w, y, z), (x + w + dx, y, z + dz), (x - w + dx, y, z + dz)]
        faces.append((k, k + 1, k + 2, k + 3))
    obj = C.mesh_from(name, verts, faces, mat_veil(f"{name}_m", "#B9C4D0", 0.55, 0.35))
    C.move_to(obj, coll)
    obj.visible_shadow = False
    return obj


def build_tempesta(nl) -> Tableau:
    tb = Tableau(target=(0.4, 1.8, 3.3), azimuth=0, elevation=14, ortho=15.2)
    sea = C.mat_water("q_mare_tempesta", "#3D4A4D", rough=0.12, ripple=0.6)

    def sea_fn(u: float, v: float):
        x = -22 + 44 * u
        y = -10 + 34 * v
        return (x, y, wave_height(x, y) * (0.6 + 0.4 * min(1.0, max(0.0, (y + 6) / 10))))

    water = C.surface("mare", 160, 90, sea_fn, sea, coll=nl)
    water.visible_shadow = False
    # Creste di schiuma: piccoli tori schiacciati sulle creste davanti.
    foam = C.mat_paint("q_schiuma", "#C9CFCC", rough=0.6)
    rr = C.rng("tempesta/schiuma")
    for i in range(18):
        x = rr.uniform(-10, 10)
        y = rr.uniform(-6.5, 3.0)
        C.sphere(f"schiuma{i}", 0.35, (x, y, wave_height(x, y) + 0.12), foam, scale=(rr.uniform(1.5, 3.0), 0.45, 0.16), coll=nl)
    # Isolotto del Faro con scogli e la casa del guardiano.
    fx, fy, fh = 4.2, 5.0, 3.8
    C.box("piattaforma", (6.0, 3.6, 1.0), (3.0, 4.8, 0.1), S.M("pietra"))
    S.rocks("scogli_a", 3.0, 2.7, n=10, spread=2.8, size=0.8)
    S.rocks("scogli_b", 6.2, 4.0, n=6, spread=1.5, size=0.65)
    tb.main += S.lighthouse("faro", fx, fy, z=0.6, h=fh)
    S.house("casa_guardiano", 1.2, 5.4, 2.6, 2.0, 2.2, wall="faro_bianco", cols=2, rows=1, lit={(0, 0), (1, 0)}, ground=0.6, door_at=0.6, chimney_at=-0.3, shutters=False)
    # La barca di Bepi fra le onde, inclinata, con la cima arancio.
    bx, by = -3.2, -1.6
    b = S.boat("barca_bepi", length=3.0, width=1.05, color="#4F4A45", rope="bepi")
    C.group("barca_g", b, loc=(bx, by, wave_height(bx, by) + 0.32), rot=(14, -8, -18), scale=1.2)
    tb.main += b
    lantern = C.sphere("lanterna_barca", 0.09, (bx + 1.0, by - 0.2, wave_height(bx, by) + 0.95), S.M("fiamma"))
    tb.main.append(lantern)
    C.cylinder("albero_barca", 0.04, 1.6, (bx + 0.6, by, wave_height(bx, by) + 0.9), S.M("legno_vecchio"), rot=(14, -8, 0), segments=8)
    S.briccola("briccola_a", -8.4, -2.6, h=2.8, seed="ta")
    S.briccola("briccola_b", 9.6, -4.4, h=2.4, seed="tb")
    # Fascio della lanterna: cono di luce semitrasparente verso sinistra, sopra il mare.
    zt = 0.6 + 0.6 + fh + 0.57
    beam = C.lathe("fascio", [(0.0, 0.0), (0.2, 0.0), (2.4, 14.0), (0.0, 14.0)], mat_veil("q_fascio", "#FFE6B0", 1.0, 0.13, fade=True), segments=24, sharp_deg=None)
    C.move_to(beam, nl)
    C.place(beam, (fx, fy, zt), rot=(0, -80, 12))
    beam.visible_shadow = False
    # Cielo di burrasca e pioggia.
    sky_card("cielo", nl, (0, 18, 6), (70, 30), "#1C2230", "#3A4458", clouds=0.55)
    rain("pioggia", nl, (-12, 12, -6, 8, -0.5, 10), 520, 0.9, 14, "tempesta/pioggia")
    return tb


def light_tempesta(scene, tb: Tableau, coll) -> None:
    C.sun("luna_velata", C.LIGHT["luna"], 0.35, azimuth=30, elevation=40, angle_deg=6, coll=coll)
    C.area_fill("cielo_notte", "#3A4766", 0.18, azimuth=-20, elevation=50, target=tb.target, coll=coll)
    C.light("POINT", "lanterna_faro", "#FFE2A8", 900.0, loc=(4.2, 5.0 - 0.9, 5.6), size=0.3, coll=coll)
    C.light("POINT", "lanterna_barca", C.LIGHT["finestra"], 60.0, loc=(-2.2, -1.95, 1.2), size=0.15, coll=coll)
    C.light("POINT", "finestra_guardiano", C.LIGHT["finestra"], 30.0, loc=(1.2, 3.9, 1.7), size=0.3, coll=coll)
    C.set_world(scene, "#1E2433", 0.3)
    S.set_glow("notte")


# --------------------------------------------------------------------------
# secca
# --------------------------------------------------------------------------


def mud_height(x: float, y: float) -> float:
    """Barena: piano di fango appena sopra l'acqua, solcato da due canali (sotto lo zero)."""
    base = 0.06 + 0.05 * math.sin(0.7 * x + 0.3 * y) + 0.03 * math.sin(1.9 * x - 1.3 * y + 0.7)
    if y > 6.5:
        base -= (y - 6.5) * 0.12  # verso il largo la barena scende sotto l'acqua
    c1 = abs(y - (-3.2 + 0.9 * math.sin(0.35 * x + 0.5)))
    c2 = abs(x - (-5.5 + 1.2 * math.sin(0.4 * y)))
    channel = -0.4 * math.exp(-(c1 * c1) / 1.6) - 0.36 * math.exp(-(c2 * c2) / 1.0) * (1.0 if y > -3.0 else 0.0)
    return base + channel


def sandbar_center(t: float) -> tuple[float, float]:
    """Lingua di sabbia: dal primo piano (t = 0) al Faro (t = 1)."""
    x = -3.0 + 7.6 * t + 1.2 * math.sin(math.pi * t)
    y = -6.0 + 11.0 * t
    return x, y


def build_secca(nl) -> Tableau:
    tb = Tableau(target=(3.0, 1.4, 3.3), azimuth=0, elevation=24, ortho=15.2)
    S.water(nl, size=(90, 90), y=15)
    mud = C.mat_plaster("q_fango", "#7B7B6E", amount=0.07, scale=1.2)

    def mud_fn(u: float, v: float):
        x = -14 + 28 * u
        y = -9 + 22 * v
        return (x, y, mud_height(x, y))

    C.surface("barena", 120, 90, mud_fn, mud)
    sand = S.M("sabbia")

    def bar_fn(u: float, v: float):
        cx, cy = sandbar_center(u)
        w = 0.9 + 0.5 * math.sin(3.0 * u + 0.4)
        ang = math.atan2(11.0, 7.6 + 1.2 * math.pi * math.cos(math.pi * u))
        nx, ny = math.sin(ang), -math.cos(ang)
        off = (v - 0.5) * 2 * w
        hump = 0.2 * (1 - (2 * v - 1) ** 2) + 0.02
        return (cx + nx * off, cy + ny * off, max(mud_height(cx + nx * off, cy + ny * off), 0.0) + hump)

    C.surface("lingua_sabbia", 60, 8, bar_fn, sand)
    # Il Faro sull'isolotto, in fondo a destra.
    C.cylinder("isolotto", 2.3, 0.9, (4.4, 6.6, 0.1), S.M("pietra"), segments=10, smooth=False, r2=2.0)
    S.rocks("scogli_a", 3.4, 5.0, n=9, spread=2.0, size=0.7)
    S.rocks("scogli_b", 6.4, 5.8, n=6, spread=1.4, size=0.6)
    tb.main += S.lighthouse("faro", 4.6, 6.6, z=0.55, h=2.6)
    # Briccole scoperte con la fascia d'alga, barche in secco inclinate sul fango.
    algae = C.mat_paint("q_alga", "#5F665C", rough=0.9)
    for k, (x, y, h) in enumerate(((-8.6, -1.2, 3.0), (-2.6, 2.6, 2.8), (8.8, -2.8, 2.6))):
        S.briccola(f"briccola{k}", x, y, h=h, seed=f"s{k}")
        C.cylinder(f"briccola_alga{k}", 0.42, 0.5, (x, y, 0.2), algae, segments=12)
    for k, (x, y, rot, col, rope) in enumerate(((-7.0, 2.2, (0, 16, 30), "#57605C", "zeno"), (-0.6, -1.4, (-12, 0, -64), "#4F4A45", "bepi"))):
        b = S.boat(f"barca{k}", length=2.8, width=1.0, color=col, rope=rope)
        C.group(f"barca_g{k}", b, loc=(x, y, mud_height(x, y) + 0.3), rot=rot)
    # Livia: figura con lo scialle nero che cammina sulla sabbia verso il Faro, con le impronte.
    lx, ly = sandbar_center(0.5)
    lz = 0.22
    dress = C.mat_paint("q_veste_livia", "#958C82", rough=0.7)
    shawl = C.mat_paint("q_scialle_livia", C.THREAD["livia"], rough=0.35, coat=0.6)
    fig = [
        C.lathe("livia_corpo", [(0.0, 0.0), (0.34, 0.0), (0.3, 0.5), (0.22, 1.0), (0.2, 1.2), (0.0, 1.25)], dress, segments=24),
        C.lathe("livia_scialle", [(0.12, 1.3), (0.27, 1.22), (0.33, 1.0), (0.36, 0.75), (0.3, 0.7)], shawl, segments=24, cap=False, sharp_deg=None),
        C.sphere("livia_testa", 0.16, (0.0, 0.0, 1.38), C.mat_paint("q_pelle", "#E0C9AC", rough=0.5)),
        C.sphere("livia_cappuccio", 0.19, (0.0, 0.04, 1.42), shawl, scale=(1.0, 1.0, 1.05)),
    ]
    C.group("livia_g", fig, loc=(lx, ly, lz), rot=(0, 0, -34), scale=1.25)
    tb.main += fig
    prints = C.mat_paint("q_impronta", "#8A7E68", rough=0.9)
    for k in range(11):
        t = 0.04 + k * 0.04
        px, py = sandbar_center(t)
        side = 0.13 if k % 2 else -0.13
        C.sphere(f"impronta{k}", 0.07, (px + side, py, 0.215), prints, scale=(0.8, 1.4, 0.15))
    # Quinta lontana a sinistra.
    rr = C.rng("secca/quinta")
    far = C.mat_paint("q_lontano", "#8F9898", rough=0.9)
    xx = -16.0
    while xx < -4.0:
        bw, bh = rr.uniform(0.8, 1.5), rr.uniform(0.5, 1.1)
        C.box(f"quinta{int(xx * 10)}", (bw, 0.6, bh), (xx + bw / 2, 13.0, bh / 2), far)
        xx += bw
    C.box("quinta_campanile", (0.35, 0.35, 2.2), (-9.0, 13.0, 1.1), far)
    sky_card("cielo", nl, (0, 30, 4), (90, 30), "#D9C3B0", "#C9D0D2", clouds=0.18)
    return tb


def light_secca(scene, tb: Tableau, coll) -> None:
    C.sun("sole", C.LIGHT["sole_alba"], 2.8, azimuth=-60, elevation=22, angle_deg=4, coll=coll)
    C.area_fill("cielo", C.LIGHT["cielo_freddo"], 0.6, azimuth=30, elevation=40, target=tb.target, coll=coll)
    C.set_world(scene, "#D2CCC2", 0.5)


# --------------------------------------------------------------------------
# sacrestia_lettere
# --------------------------------------------------------------------------


def letter_pile(prefix: str, x: float, y: float, z: float, n: int, w: float = 0.5, d: float = 0.32, rot: float = 0.0, seed: str = "") -> list:
    rr = C.rng(f"{prefix}/{seed}")
    tones = [S.M("carta"), S.M("carta_ombra"), C.mat_paint("q_busta3", "#E4DAC6", rough=0.85)]
    objs = []
    t = 0.022
    for i in range(n):
        objs.append(C.box(f"{prefix}{i}", (w + rr.uniform(-0.04, 0.02), d + rr.uniform(-0.03, 0.02), t), (x + rr.uniform(-0.03, 0.03), y + rr.uniform(-0.02, 0.02), z + t / 2 + i * t), tones[i % 3], rot=(0, 0, rot + rr.uniform(-6, 6))))
    return objs


def build_sacrestia(nl) -> Tableau:
    tb = Tableau(target=(0.2, 0.9, 1.95), azimuth=10, elevation=18, ortho=7.4)
    wall = C.mat_plaster("q_muro_sacrestia", "#B4AA9C", amount=0.05)
    C.box("pavimento", (12, 8, 0.3), (0, 1.0, -0.15), C.mat_tiles("q_lastre", "#A39C90", rows=6.0))
    yb, th = 3.0, 0.4
    # Finestra ad arco a sinistra (vano a pezzi) con il cielo dietro.
    wx, wz, ww, wh = -2.4, 2.9, 0.9, 1.5
    C.box("parete_sx", (6 + wx - ww / 2, th, 5.2), ((-6 + wx - ww / 2) / 2, yb, 2.6), wall)
    C.box("parete_dx", (6 - wx - ww / 2, th, 5.2), ((6 + wx + ww / 2) / 2, yb, 2.6), wall)
    C.box("parete_sotto", (ww, th, wz - wh / 2), (wx, yb, (wz - wh / 2) / 2), wall)
    C.box("parete_sopra", (ww, th, 5.2 - wz - wh / 2 - ww / 2), (wx, yb, (5.2 + wz + wh / 2 + ww / 2) / 2), wall)
    for s in (-1, 1):
        C.box(f"arco_spalla{s}", (0.06, th, ww / 2), (wx + s * (ww / 2 - 0.03), yb, wz + wh / 2 + ww / 4), wall)
    C.torus("arco", ww / 2, 0.06, (wx, yb - th / 2 - 0.02, wz + wh / 2), S.M("pietra_bianca"), rot=(90, 0, 0), arc_deg=180, seg=20, mseg=6)
    for s in (-1, 1):
        C.box(f"stipite{s}", (0.12, 0.1, wh), (wx + s * (ww / 2 + 0.06), yb - th / 2 - 0.02, wz), S.M("pietra_bianca"))
    sky = C.plane("cielo", (4, 5), (wx, yb + 1.0, wz + 0.4), C.mat_emit("q_cielo", "#DCD3C2", 1.0), rot=(90, 0, 0), coll=nl)
    sky.visible_shadow = False
    C.box("zoccolo", (12, 0.05, 0.4), (0, yb - th / 2 - 0.025, 0.2), C.mat_paint("q_zoccolo", "#8E8678", rough=0.8))
    # Crocifisso alla parete.
    C.box("croce_v", (0.08, 0.05, 0.9), (0.2, yb - th / 2 - 0.03, 3.9), S.M("legno_scuro"))
    C.box("croce_o", (0.5, 0.05, 0.08), (0.2, yb - th / 2 - 0.03, 4.1), S.M("legno_scuro"))
    # L'armadio dei paramenti, aperto: scaffali pieni di lettere legate.
    ax, ay, aw, ad, ah = 1.6, 2.35, 2.2, 0.8, 3.2
    wood = S.M("legno_scuro")
    C.box("armadio_fondo", (aw, 0.06, ah), (ax, ay + ad / 2 - 0.03, ah / 2 + 0.1), wood)
    for s in (-1, 1):
        C.box(f"armadio_fianco{s}", (0.08, ad, ah), (ax + s * (aw / 2 - 0.04), ay, ah / 2 + 0.1), wood)
    C.box("armadio_cielo", (aw + 0.12, ad + 0.1, 0.12), (ax, ay, ah + 0.16), wood, bevel=0.02)
    C.box("armadio_zoccolo", (aw + 0.08, ad + 0.06, 0.14), (ax, ay, 0.07), wood)
    # Ante aperte verso la camera.
    door_wood = C.mat_wood("q_anta", base=C.mix_hex(C.PALETTE["legno"], C.PALETTE["legno_scuro"], 0.55), seed_name="sacrestia/anta", scale=1.6, axis="Z")
    for s, ang in ((-1, 116), (1, 108)):
        # Anta costruita chiusa (dalla cerniera verso il centro), poi girata verso la camera.
        door_ = C.box(f"armadio_anta{s}", (aw / 2 - 0.02, 0.06, ah - 0.1), (-s * (aw / 4), 0, 0), door_wood)
        C.group(f"armadio_cerniera{s}", [door_], loc=(ax + s * (aw / 2), ay - ad / 2, ah / 2 + 0.12), rot=(0, 0, s * ang))
    shelves = (0.6, 1.4, 2.2, 2.95)
    rr = C.rng("sacrestia/lettere")
    stack_id = 0
    for k, zz in enumerate(shelves):
        C.box(f"armadio_ripiano{k}", (aw - 0.16, ad - 0.1, 0.05), (ax, ay, zz), wood)
        x = ax - aw / 2 + 0.38
        while x < ax + aw / 2 - 0.3:
            n = rr.randint(5, 14)
            tb.main += letter_pile(f"pila{stack_id}_", x, ay - 0.05, zz + 0.025, n, rot=rr.uniform(-8, 8), seed=str(stack_id))
            if rr.random() < 0.45:
                C.box(f"pila_spago{stack_id}", (0.04, 0.36, n * 0.022 + 0.01), (x, ay - 0.05, zz + 0.025 + n * 0.011), S.M("spago"))
            stack_id += 1
            x += rr.uniform(0.48, 0.56)
    # Il tavolo con la cassetta aperta delle lettere, la candela e la stola viola di Don Piero.
    tx, ty, tz = -0.5, 0.2, 1.2
    C.box("tavolo", (2.6, 1.3, 0.1), (tx, ty, tz), S.M("legno"), bevel=0.02)
    for sx in (-1, 1):
        for sy in (-1, 1):
            C.box(f"tavolo_gamba{sx}{sy}", (0.1, 0.1, tz - 0.05), (tx + sx * 1.18, ty + sy * 0.55, (tz - 0.05) / 2), S.M("legno_scuro"))
    box_c = (tx + 0.35, ty + 0.1, tz + 0.05)
    bw, bd, bh = 0.9, 0.6, 0.36
    case = [
        C.box("cassetta_fondo", (bw, bd, 0.04), (box_c[0], box_c[1], box_c[2] + 0.02), wood),
        C.box("cassetta_davanti", (bw, 0.04, bh), (box_c[0], box_c[1] - bd / 2, box_c[2] + bh / 2), wood),
        C.box("cassetta_dietro", (bw, 0.04, bh), (box_c[0], box_c[1] + bd / 2, box_c[2] + bh / 2), wood),
        C.box("cassetta_sx", (0.04, bd, bh), (box_c[0] - bw / 2, box_c[1], box_c[2] + bh / 2), wood),
        C.box("cassetta_dx", (0.04, bd, bh), (box_c[0] + bw / 2, box_c[1], box_c[2] + bh / 2), wood),
    ]
    lid = C.box("cassetta_coperchio", (bw + 0.04, bd + 0.04, 0.05), (0, bd / 2, 0), wood)
    C.group("cassetta_cerniera", [lid], loc=(box_c[0], box_c[1] + bd / 2, box_c[2] + bh), rot=(-105, 0, 0))
    tb.main += case + [lid]
    for k in range(9):
        C.box(f"cassetta_lettera{k}", (0.42, 0.03, 0.28), (box_c[0] - 0.36 + k * 0.09, box_c[1] + rr.uniform(-0.1, 0.1), box_c[2] + 0.2), S.M("carta" if k % 2 else "carta_ombra"), rot=(rr.uniform(-12, 12), 0, 90 + rr.uniform(-10, 10)))
    # Il fascio delle lettere di Livia, legato col filo nero, e una lettera aperta.
    fb = S.letters_bundle("fascio_livia", n=8, w=1.6, d=1.0)
    C.group("fascio_g", [o for o in fb if o.parent is None], loc=(tx - 0.65, ty - 0.2, tz + 0.05), rot=(0, 0, -12), scale=0.32)
    tb.main += fb
    C.torus("filo_nero", 0.2, 0.012, (tx - 0.65, ty - 0.2, tz + 0.14), S.thread_mat("livia"), scale=(1.5, 1.0, 0.4), seg=32, mseg=6)
    C.box("lettera_aperta", (0.44, 0.58, 0.006), (tx - 0.1, ty - 0.42, tz + 0.056), S.M("carta"), rot=(0, 0, 18))
    for i in range(6):
        C.box(f"riga{i}", (0.3, 0.012, 0.002), (tx - 0.1 - 0.04 * math.sin(math.radians(18)), ty - 0.58 + i * 0.06, tz + 0.06), C.mat_paint("q_inchiostro", "#5A4E66", rough=0.6), rot=(0, 0, 18))
    candle = [
        C.lathe("candeliere", [(0.0, 0.0), (0.16, 0.0), (0.16, 0.03), (0.05, 0.08), (0.04, 0.25), (0.09, 0.28), (0.09, 0.31), (0.0, 0.31)], S.M("ottone"), segments=16),
        C.cylinder("candela", 0.045, 0.42, (0, 0, 0.52), S.M("farina"), segments=12),
        C.sphere("fiamma_candela", 0.035, (0, 0, 0.78), S.M("fiamma"), scale=(1, 1, 1.9)),
    ]
    C.group("candela_g", candle, loc=(tx - 1.0, ty + 0.35, tz + 0.05))
    # Stola viola (il filo di Don Piero) che pende dal bordo del tavolo.
    stole = S.thread_mat("piero")

    def stole_fn(u: float, v: float):
        x = tx + 0.95 + (u - 0.5) * 0.18
        y = ty - 0.62 - 0.05 * math.sin(v * 3.0)
        z = tz + 0.06 - 0.95 * v
        return (x, y - 0.12 * v * v, z)

    C.surface("stola", 4, 12, stole_fn, stole)
    C.box("stola_sopra", (0.18, 0.7, 0.012), (tx + 0.95, ty - 0.3, tz + 0.056), stole)
    C.box("stola_croce", (0.1, 0.01, 0.025), (tx + 0.95, ty - 0.66, tz - 0.35), S.M("ottone"), rot=(0, 0, 0))
    # Sedia del parroco e inginocchiatoio.
    ch = S.chair("sedia", shawl=False)
    C.group("sedia_g", ch, loc=(-2.2, 0.9, 0.0), rot=(0, 0, 40), scale=0.95)
    return tb


def light_sacrestia(scene, tb: Tableau, coll) -> None:
    C.light("AREA", "finestra_luce", "#FFE8C8", 650.0, loc=(-2.4, 4.6, 3.6), target=(-0.4, 0.2, 1.2), size=0.9, coll=coll)
    C.sun("sole_finestra", C.LIGHT["sole_giorno"], 1.2, azimuth=-160, elevation=30, angle_deg=3, coll=coll)
    C.area_fill("riempimento", C.LIGHT["cielo_freddo"], 0.8, azimuth=30, elevation=25, target=tb.target, coll=coll)
    C.light("POINT", "candela_luce", "#FFC56E", 18.0, loc=(-1.5, 0.55, 2.15), size=0.06, coll=coll)
    C.set_world(scene, "#9C9488", 0.3)
    S.set_glow("giorno")


# --------------------------------------------------------------------------
# Render
# --------------------------------------------------------------------------

BUILDERS = {
    "sedia_vuota": (build_sedia_vuota, light_sedia_vuota),
    "tempesta": (build_tempesta, light_tempesta),
    "secca": (build_secca, light_secca),
    "sacrestia_lettere": (build_sacrestia, light_sacrestia),
}


def render_tableau(name: str, key: str, out: str) -> None:
    t0 = time.time()
    scene = C.reset_scene()
    S.reset()
    if PREVIEW:
        C.setup_render(scene, W // 2, H // 2, 8, transparent=False, rgba=False)
    else:
        C.setup_render(scene, W, H, SAMPLES, transparent=False, rgba=False)
    nl = C.no_lines_collection(scene)
    if not PREVIEW:
        C.enable_freestyle(scene, thickness=1.2, exclude=nl)
    build, lights = BUILDERS[key]
    tb = build(nl)
    cam = C.ortho_camera(scene, azimuth=tb.azimuth, elevation=tb.elevation, target=tb.target, ortho_scale=tb.ortho)
    meshes = [o for o in tb.main if o.type in {"MESH", "CURVE"}]
    ext = C.projected_extent(scene, cam, meshes)
    if ext[0] < SAFE[0] or ext[1] < SAFE[1] or ext[2] > SAFE[2] or ext[3] > SAFE[3]:
        raise RuntimeError(f"{name}: il soggetto esce dall'area sicura {tuple(round(e, 3) for e in ext)}")
    rig = bpy.data.collections.new("luci")
    scene.collection.children.link(rig)
    lights(scene, tb, rig)
    C.log(f"    {name}: costruito in {time.time() - t0:.1f} s, soggetto in {tuple(round(e, 3) for e in ext)}")
    path = C.render_to(scene, C.out_path(out, name))
    C.write_meta(path, {"name": name, "w": W, "h": H, "safe": [round(e, 4) for e in ext]})


__all__ = ["TABLEAUX", "render_tableau"]
