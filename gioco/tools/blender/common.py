"""Strumenti condivisi della pipeline Blender di TRAMA (ARCHITETTURA 12, GDD 12).

Ogni script di gruppo (fusi, figurine, diorami, oggetti, icona) gira in un
processo Python separato con il modulo ``bpy`` (Blender 5.2) e importa questo
file. Qui stanno:

- reset della scena (``read_factory_settings(use_empty=True)``);
- palette del GDD in sRGB, convertita in lineare per i materiali;
- materiali procedurali: legno (Wave + Noise), vernice opaca, ottone, acqua
  lucida, filo avvolto, velluto, vetro, emissione;
- primitive costruite con ``bmesh`` (niente operatori: nessun contesto UI),
  tornio (``lathe``) per i pezzi di legno tornito;
- camera ortografica e inquadratura sul bounding box;
- rig di luci: studio (sprite), giorno, alba, notte;
- impostazioni di render: Cycles su CPU, 4 thread, OIDN, dati persistenti,
  view transform Standard, PNG a 8 bit; contorni Freestyle con lineset e
  linestyle creati esplicitamente;
- semi casuali fissi per nome e argomenti ``--only`` / ``--out``.

Mai EEVEE (nel container non funziona) e mai Workbench (dipende da Mesa).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import random
import sys
import time
import traceback
import warnings
from typing import Callable, Iterable, Sequence

import bpy  # noqa: I001  (bpy va importato prima di bmesh e mathutils)
import bmesh
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Euler, Matrix, Vector

# --------------------------------------------------------------------------
# Percorsi
# --------------------------------------------------------------------------

HERE = os.path.dirname(os.path.abspath(__file__))
GAME_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
DEFAULT_OUT = os.path.join(GAME_ROOT, "tools", "blender", "out", "render")

# --------------------------------------------------------------------------
# Palette (GDD 12.2 e 5.4), in esadecimale sRGB
# --------------------------------------------------------------------------

PALETTE = {
    "velluto": "#1C2233",
    "velluto_luce": "#2A3247",
    "velluto_ombra": "#121622",
    "legno": "#B89B72",
    "legno_scuro": "#6E5539",
    "carta": "#EDE4D3",
    "carta_ombra": "#D8CCB4",
    "inchiostro": "#2B2622",
    "seppia": "#6B4A2F",
    "laguna": "#7F918C",
    "mattone_spento": "#9A6B5A",
    "ocra_spenta": "#B59A6A",
    "alba": "#D9C3B0",
    "ottone": "#C9A24A",
    "spillo_rosso": "#C8372D",
    "spillo_verde": "#4E9A5B",
    "testo_chiaro": "#F3EEE4",
    "sigillo": "#B3261E",
}

# Colori dei fili (GDD 5.4): l'unico strato saturo del mondo.
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
LIVIA_SHEEN = "#3B2F27"

# Luci (ARCHITETTURA 12)
LIGHT = {
    "sole_giorno": "#FFE2B8",
    "cielo_freddo": "#A9BBD9",
    "sole_alba": "#FFB38A",
    "cielo_alba": "#D9C3B0",
    "luna": "#8FA6D9",
    "finestra": "#FFB24A",
}

LIGHTS = ("alba", "giorno", "notte")


def hex_to_srgb(h: str) -> tuple[float, float, float]:
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4))  # type: ignore[return-value]


def srgb_to_linear_channel(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lin(h: str, a: float = 1.0) -> tuple[float, float, float, float]:
    """Colore esadecimale sRGB → RGBA lineare (per i socket dei materiali)."""
    r, g, b = hex_to_srgb(h)
    return (srgb_to_linear_channel(r), srgb_to_linear_channel(g), srgb_to_linear_channel(b), a)


def lin3(h: str) -> tuple[float, float, float]:
    r, g, b, _ = lin(h)
    return (r, g, b)


def to_hex(rgb: Sequence[float]) -> str:
    return "#" + "".join(f"{max(0, min(255, round(c * 255))):02X}" for c in rgb[:3])


def mix_hex(a: str, b: str, t: float) -> str:
    ca, cb = hex_to_srgb(a), hex_to_srgb(b)
    return to_hex([ca[i] + (cb[i] - ca[i]) * t for i in range(3)])


def shade_hex(h: str, f: float) -> str:
    """f > 0 schiarisce verso il bianco, f < 0 scurisce verso il nero."""
    return mix_hex(h, "#FFFFFF", f) if f >= 0 else mix_hex(h, "#000000", -f)


def desat(h: str, amount: float) -> str:
    """Desatura verso la luminanza (amount 0 = invariato, 1 = grigio)."""
    r, g, b = hex_to_srgb(h)
    y = 0.299 * r + 0.587 * g + 0.114 * b
    return to_hex([c + (y - c) * amount for c in (r, g, b)])


def saturation(h: str) -> float:
    r, g, b = hex_to_srgb(h)
    mx, mn = max(r, g, b), min(r, g, b)
    return 0.0 if mx == 0 else (mx - mn) / mx


# --------------------------------------------------------------------------
# Semi fissi
# --------------------------------------------------------------------------


def seed_int(name: str) -> int:
    return int(hashlib.sha1(name.encode("utf-8")).hexdigest()[:8], 16)


def rng(name: str) -> random.Random:
    """Seme fisso per nome: ``random.seed(nome)`` più un generatore dedicato."""
    random.seed(name)
    return random.Random(seed_int(name))


# --------------------------------------------------------------------------
# Argomenti e log
# --------------------------------------------------------------------------


def parse_args(description: str, names: Sequence[str]) -> argparse.Namespace:
    """``--only a,b`` (ripetibile) e ``--out <cartella>``; i nomi si validano."""
    argv = sys.argv[1:]
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    p = argparse.ArgumentParser(description=description)
    p.add_argument("--only", action="append", default=[], help="nomi da generare (separati da virgola)")
    p.add_argument("--out", default=DEFAULT_OUT, help="cartella dei render grezzi")
    p.add_argument("--list", action="store_true", help="elenca i nomi e termina")
    ns = p.parse_args(argv)
    if ns.list:
        print("\n".join(names))
        sys.exit(0)
    only: list[str] = []
    for chunk in ns.only:
        only.extend(x.strip() for x in chunk.split(",") if x.strip())
    unknown = [o for o in only if not any(n == o or n.startswith(o + "/") for n in names)]
    if unknown:
        p.error(f"nomi sconosciuti per --only: {', '.join(unknown)} (vedi --list)")
    ns.selected = [n for n in names if not only or any(n == o or n.startswith(o + "/") for o in only)]
    ns.out = os.path.abspath(ns.out)
    return ns


def log(msg: str) -> None:
    print(f"[blender] {msg}", flush=True)


def run_batch(title: str, names: Sequence[str], render_one: Callable[[str, str], None]) -> None:
    """Esegue ``render_one(nome, out)`` per ogni nome selezionato; esce con 1 al primo errore."""
    ns = parse_args(title, names)
    t0 = time.time()
    log(f"{title}: {len(ns.selected)} asset → {ns.out}")
    for name in ns.selected:
        t = time.time()
        try:
            render_one(name, ns.out)
        except Exception:  # noqa: BLE001 - qualsiasi errore ferma la pipeline
            traceback.print_exc()
            log(f"ERRORE su {name}")
            sys.exit(1)
        log(f"  {name} ({time.time() - t:.1f} s)")
    log(f"{title}: fatto in {time.time() - t0:.1f} s")


# --------------------------------------------------------------------------
# Scena e render
# --------------------------------------------------------------------------


def reset_scene() -> bpy.types.Scene:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    return scene


def setup_render(
    scene: bpy.types.Scene,
    width: int,
    height: int,
    samples: int,
    transparent: bool,
    rgba: bool = True,
) -> None:
    r = scene.render
    r.engine = "CYCLES"
    r.resolution_x = width
    r.resolution_y = height
    r.resolution_percentage = 100
    r.pixel_aspect_x = 1
    r.pixel_aspect_y = 1
    r.threads_mode = "FIXED"
    r.threads = 4
    r.use_persistent_data = True
    r.film_transparent = transparent
    r.use_border = False
    r.dither_intensity = 0.0
    cy = scene.cycles
    cy.device = "CPU"
    cy.samples = samples
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.02
    cy.use_denoising = True
    cy.denoiser = "OPENIMAGEDENOISE"
    cy.denoising_input_passes = "RGB_ALBEDO_NORMAL"
    cy.denoising_prefilter = "ACCURATE"
    cy.seed = 0
    cy.use_animated_seed = False
    cy.max_bounces = 6
    cy.diffuse_bounces = 2
    cy.glossy_bounces = 2
    cy.transmission_bounces = 4
    cy.transparent_max_bounces = 8
    cy.volume_bounces = 0
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    cy.blur_glossy = 1.0
    cy.film_transparent_glass = transparent
    cy.pixel_filter_type = "BLACKMAN_HARRIS"
    cy.filter_width = 1.5
    vs = scene.view_settings
    vs.view_transform = "Standard"
    vs.look = "None"
    vs.exposure = 0.0
    vs.gamma = 1.0
    scene.display_settings.display_device = "sRGB"
    scene.sequencer_colorspace_settings.name = "sRGB"
    im = r.image_settings
    im.file_format = "PNG"
    im.color_mode = "RGBA" if rgba else "RGB"
    im.color_depth = "8"
    im.compression = 15
    r.use_freestyle = False
    if width * height > 512 * 512:
        # Immagini grandi (diorami, quadri): il prefiltro FAST dimezza il tempo del denoiser
        # e la differenza non si vede dopo la WebP a qualità 80.
        cy.denoising_prefilter = "FAST"
        cy.adaptive_threshold = 0.04


def enable_freestyle(
    scene: bpy.types.Scene,
    thickness: float = 1.2,
    color: str = PALETTE["inchiostro"],
    crease_deg: float = 128.0,
    exclude: bpy.types.Collection | None = None,
) -> None:
    """Contorni Freestyle con lineset e linestyle espliciti (il lineset di default non ha linestyle)."""
    r = scene.render
    r.use_freestyle = True
    r.line_thickness_mode = "ABSOLUTE"
    r.line_thickness = 1.0
    vl = scene.view_layers[0]
    vl.use_freestyle = True
    fs = vl.freestyle_settings
    fs.mode = "EDITOR"
    fs.crease_angle = math.radians(crease_deg)
    fs.use_culling = False
    fs.use_smoothness = False
    for old in list(fs.linesets):
        fs.linesets.remove(old)
    ls = fs.linesets.new("contorni")
    ls.show_render = True
    ls.select_by_visibility = True
    ls.visibility = "VISIBLE"
    ls.select_by_edge_types = True
    ls.select_by_face_marks = False
    ls.select_silhouette = True
    ls.select_border = True
    ls.select_crease = True
    ls.select_external_contour = True
    ls.select_contour = False
    ls.select_material_boundary = False
    if exclude is not None:
        ls.select_by_collection = True
        ls.collection = exclude
        ls.collection_negation = "EXCLUSIVE"
    style = bpy.data.linestyles.new("inchiostro")
    style.color = lin3(color)
    style.alpha = 1.0
    style.thickness = thickness
    style.thickness_position = "CENTER"
    style.caps = "ROUND"
    style.use_chaining = True
    style.chaining = "PLAIN"
    ls.linestyle = style


def no_lines_collection(scene: bpy.types.Scene) -> bpy.types.Collection:
    """Collezione degli oggetti senza contorni (acqua, cielo, fondali)."""
    coll = bpy.data.collections.get("senza_contorni")
    if coll is None:
        coll = bpy.data.collections.new("senza_contorni")
        scene.collection.children.link(coll)
    return coll


def move_to(obj: bpy.types.Object, coll: bpy.types.Collection) -> bpy.types.Object:
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)
    return obj


def set_world(scene: bpy.types.Scene, color: str, strength: float) -> None:
    world = scene.world or bpy.data.worlds.new("mondo")
    scene.world = world
    if world.node_tree is None:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg is None:
        bg = world.node_tree.nodes.new("ShaderNodeBackground")
        out = world.node_tree.nodes.get("World Output") or world.node_tree.nodes.new("ShaderNodeOutputWorld")
        world.node_tree.links.new(bg.outputs[0], out.inputs[0])
    bg.inputs["Color"].default_value = lin(color)
    bg.inputs["Strength"].default_value = strength


def render_to(scene: bpy.types.Scene, path: str) -> str:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path):
        os.remove(path)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    if not os.path.exists(path):
        raise RuntimeError(f"il render non ha prodotto {path}")
    return path


def write_meta(png_path: str, meta: dict) -> None:
    with open(os.path.splitext(png_path)[0] + ".json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=1, sort_keys=True)


def out_path(out: str, name: str) -> str:
    return os.path.join(out, *name.split("/")) + ".png"


# --------------------------------------------------------------------------
# Materiali
# --------------------------------------------------------------------------


def _new_material(name: str):
    mat = bpy.data.materials.new(name)
    if mat.node_tree is None:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            mat.use_nodes = True
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    for n in list(nodes):
        nodes.remove(n)
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    links.new(bsdf.outputs[0], out.inputs["Surface"])
    return mat, nodes, links, bsdf, out


def _ramp(nodes, stops: Sequence[tuple[float, str]]):
    ramp = nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    while len(els) > 2:
        els.remove(els[-1])
    els[0].position, els[0].color = stops[0][0], lin(stops[0][1])
    els[1].position, els[1].color = stops[1][0], lin(stops[1][1])
    for pos, col in stops[2:]:
        e = els.new(pos)
        e.color = lin(col)
    return ramp


def mat_paint(name: str, color: str, rough: float = 0.62, coat: float = 0.0, sheen: float = 0.0):
    """Vernice opaca (figurine, case, oggetti)."""
    mat, nodes, links, bsdf, _ = _new_material(name)
    bsdf.inputs["Base Color"].default_value = lin(color)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Specular IOR Level"].default_value = 0.35
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["Coat Roughness"].default_value = 0.25
    bsdf.inputs["Sheen Weight"].default_value = sheen
    mat.diffuse_color = lin(color)
    return mat


def mat_wood(
    name: str,
    base: str = PALETTE["legno"],
    dark: str | None = None,
    scale: float = 3.0,
    seed_name: str | None = None,
    rough: float = 0.55,
    axis: str = "Z",
    contrast: float = 1.0,
):
    """Legno procedurale: venature Wave (bande lungo l'asse) disturbate da Noise."""
    dark = dark or mix_hex(base, PALETTE["legno_scuro"], 0.3 * contrast)
    light = mix_hex(base, "#FFFFFF", 0.06 * contrast)
    mat, nodes, links, bsdf, _ = _new_material(name)
    r = rng(seed_name or name)
    tc = nodes.new("ShaderNodeTexCoord")
    mp = nodes.new("ShaderNodeMapping")
    mp.inputs["Location"].default_value = (r.uniform(-50, 50), r.uniform(-50, 50), r.uniform(-50, 50))
    # Venature allungate lungo l'asse del pezzo: si comprime quell'asse.
    sx, sy, sz = 1.0, 1.0, 1.0
    if axis == "Z":
        sz = 0.12
    elif axis == "X":
        sx = 0.12
    else:
        sy = 0.12
    mp.inputs["Scale"].default_value = (sx, sy, sz)
    links.new(tc.outputs["Object"], mp.inputs["Vector"])
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale * 1.7
    noise.inputs["Detail"].default_value = 3.0
    noise.inputs["Roughness"].default_value = 0.5
    links.new(mp.outputs["Vector"], noise.inputs["Vector"])
    wave = nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "X" if axis != "X" else "Y"
    wave.inputs["Scale"].default_value = scale
    wave.inputs["Distortion"].default_value = 9.0
    wave.inputs["Detail"].default_value = 1.0
    wave.inputs["Detail Scale"].default_value = 1.2
    links.new(mp.outputs["Vector"], wave.inputs["Vector"])
    mix = nodes.new("ShaderNodeMath")
    mix.operation = "MULTIPLY_ADD"
    mix.inputs[1].default_value = 0.55
    links.new(wave.outputs["Fac"], mix.inputs[0])
    links.new(noise.outputs["Fac"], mix.inputs[2])
    ramp = _ramp(nodes, [(0.25, light), (0.62, base), (1.0, dark)])
    links.new(mix.outputs[0], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Specular IOR Level"].default_value = 0.4
    bsdf.inputs["Coat Weight"].default_value = 0.12
    bsdf.inputs["Coat Roughness"].default_value = 0.35
    mat.diffuse_color = lin(base)
    return mat


def mat_thread(name: str, color: str, glossy: bool = False, windings: float = 26.0, sheen_color: str | None = None):
    """Filo avvolto: bande sottili (le spire) leggermente inclinate, con un velo di lucentezza."""
    mat, nodes, links, bsdf, _ = _new_material(name)
    tc = nodes.new("ShaderNodeTexCoord")
    mp = nodes.new("ShaderNodeMapping")
    mp.inputs["Rotation"].default_value = (0.0, math.radians(4.0), 0.0)
    links.new(tc.outputs["Object"], mp.inputs["Vector"])
    wave = nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "Z"
    wave.wave_profile = "SIN"
    wave.inputs["Scale"].default_value = windings
    wave.inputs["Distortion"].default_value = 0.4
    wave.inputs["Detail"].default_value = 0.0
    links.new(mp.outputs["Vector"], wave.inputs["Vector"])
    hi = sheen_color or shade_hex(color, 0.18)
    lo = shade_hex(color, -0.28)
    ramp = _ramp(nodes, [(0.0, lo), (0.55, color), (1.0, hi)])
    links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.22 if glossy else 0.5
    bsdf.inputs["Specular IOR Level"].default_value = 0.6 if glossy else 0.35
    bsdf.inputs["Sheen Weight"].default_value = 0.25
    bsdf.inputs["Sheen Tint"].default_value = lin(hi)
    if glossy:
        bsdf.inputs["Coat Weight"].default_value = 0.6
        bsdf.inputs["Coat Roughness"].default_value = 0.12
    mat.diffuse_color = lin(color)
    return mat


def mat_brass(name: str = "ottone", rough: float = 0.28):
    mat, nodes, links, bsdf, _ = _new_material(name)
    bsdf.inputs["Base Color"].default_value = lin(PALETTE["ottone"])
    bsdf.inputs["Metallic"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = rough
    mat.diffuse_color = lin(PALETTE["ottone"])
    return mat


def mat_metal(name: str, color: str, rough: float = 0.35):
    mat, nodes, links, bsdf, _ = _new_material(name)
    bsdf.inputs["Base Color"].default_value = lin(color)
    bsdf.inputs["Metallic"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = rough
    mat.diffuse_color = lin(color)
    return mat


def mat_water(name: str, color: str = PALETTE["laguna"], rough: float = 0.07, ripple: float = 0.0):
    """Acqua del presepe: superficie piatta lucida, appena increspata."""
    mat, nodes, links, bsdf, _ = _new_material(name)
    bsdf.inputs["Base Color"].default_value = lin(color)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Specular IOR Level"].default_value = 0.7
    bsdf.inputs["Coat Weight"].default_value = 0.5
    bsdf.inputs["Coat Roughness"].default_value = 0.05
    if ripple > 0:
        tc = nodes.new("ShaderNodeTexCoord")
        mp = nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (0.6, 2.2, 1.0)
        links.new(tc.outputs["Object"], mp.inputs["Vector"])
        noise = nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 1.6
        noise.inputs["Detail"].default_value = 1.0
        links.new(mp.outputs["Vector"], noise.inputs["Vector"])
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = ripple
        bump.inputs["Distance"].default_value = 0.05
        links.new(noise.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Coat Normal"])
    mat.diffuse_color = lin(color)
    return mat


def mat_velvet(name: str, color: str = PALETTE["velluto"], noise_amt: float = 0.0):
    """Velluto: diffuso scuro con sheen chiaro ai bordi."""
    mat, nodes, links, bsdf, _ = _new_material(name)
    bsdf.inputs["Roughness"].default_value = 0.9
    bsdf.inputs["Specular IOR Level"].default_value = 0.1
    bsdf.inputs["Sheen Weight"].default_value = 0.8
    bsdf.inputs["Sheen Roughness"].default_value = 0.35
    bsdf.inputs["Sheen Tint"].default_value = lin(shade_hex(color, 0.45))
    if noise_amt > 0:
        tc = nodes.new("ShaderNodeTexCoord")
        noise = nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 6.0
        noise.inputs["Detail"].default_value = 2.0
        links.new(tc.outputs["Object"], noise.inputs["Vector"])
        ramp = _ramp(nodes, [(0.3, shade_hex(color, -noise_amt)), (0.7, shade_hex(color, noise_amt * 0.6))])
        links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
        links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = lin(color)
    mat.diffuse_color = lin(color)
    return mat


def mat_glass(name: str, color: str, rough: float = 0.05, ior: float = 1.45):
    mat, nodes, links, bsdf, _ = _new_material(name)
    bsdf.inputs["Base Color"].default_value = lin(color)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["IOR"].default_value = ior
    bsdf.inputs["Transmission Weight"].default_value = 1.0
    mat.diffuse_color = lin(color, 0.5)
    return mat


def mat_emit(name: str, color: str, strength: float = 4.0):
    mat, nodes, links, bsdf, out = _new_material(name)
    nodes.remove(bsdf)
    em = nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = lin(color)
    em.inputs["Strength"].default_value = strength
    links.new(em.outputs[0], out.inputs["Surface"])
    mat.diffuse_color = lin(color)
    return mat


def mat_flat(name: str, color: str):
    """Colore piatto non illuminato (fondali dipinti, cielo del teatrino)."""
    return mat_emit(name, color, 1.0)


def mat_tiles(name: str, color: str, rows: float = 9.0):
    """Coppi del tetto: bande regolari più scure."""
    mat, nodes, links, bsdf, _ = _new_material(name)
    tc = nodes.new("ShaderNodeTexCoord")
    wave = nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "Y"
    wave.wave_profile = "SAW"
    wave.inputs["Scale"].default_value = rows
    wave.inputs["Distortion"].default_value = 0.0
    wave.inputs["Detail"].default_value = 0.0
    links.new(tc.outputs["Object"], wave.inputs["Vector"])
    ramp = _ramp(nodes, [(0.0, shade_hex(color, -0.25)), (0.35, color), (1.0, shade_hex(color, 0.08))])
    links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.8
    mat.diffuse_color = lin(color)
    return mat


def mat_plaster(name: str, color: str, amount: float = 0.05, scale: float = 2.5):
    """Intonaco: colore desaturato con macchie larghe e morbide (comprime bene in WebP)."""
    mat, nodes, links, bsdf, _ = _new_material(name)
    r = rng(name)
    tc = nodes.new("ShaderNodeTexCoord")
    mp = nodes.new("ShaderNodeMapping")
    mp.inputs["Location"].default_value = (r.uniform(-20, 20), r.uniform(-20, 20), r.uniform(-20, 20))
    links.new(tc.outputs["Object"], mp.inputs["Vector"])
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = 1.0
    links.new(mp.outputs["Vector"], noise.inputs["Vector"])
    ramp = _ramp(nodes, [(0.35, shade_hex(color, -amount)), (0.65, shade_hex(color, amount * 0.5))])
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.85
    bsdf.inputs["Specular IOR Level"].default_value = 0.25
    mat.diffuse_color = lin(color)
    return mat


# --------------------------------------------------------------------------
# Geometria (bmesh, senza operatori)
# --------------------------------------------------------------------------


def _scene_collection() -> bpy.types.Collection:
    return bpy.context.scene.collection


def link(obj: bpy.types.Object, coll: bpy.types.Collection | None = None) -> bpy.types.Object:
    (coll or _scene_collection()).objects.link(obj)
    return obj


def _finish(name: str, bm: bmesh.types.BMesh, mat, smooth: bool, sharp_deg: float | None, coll=None):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    if smooth:
        me.shade_smooth()
        if sharp_deg is not None:
            me.set_sharp_from_angle(angle=math.radians(sharp_deg))
    else:
        me.shade_flat()
    if mat is not None:
        me.materials.append(mat)
    obj = bpy.data.objects.new(name, me)
    return link(obj, coll)


def place(
    obj: bpy.types.Object,
    loc: Sequence[float] = (0, 0, 0),
    rot: Sequence[float] = (0, 0, 0),
    scale: Sequence[float] | float = 1.0,
) -> bpy.types.Object:
    """Posizione, rotazione in gradi (XYZ) e scala."""
    obj.location = Vector(loc)
    obj.rotation_euler = Euler([math.radians(a) for a in rot], "XYZ")
    obj.scale = (scale, scale, scale) if isinstance(scale, (int, float)) else tuple(scale)
    return obj


def surface(
    name: str,
    nu: int,
    nv: int,
    fn: Callable[[float, float], Sequence[float]],
    mat=None,
    smooth: bool = True,
    coll=None,
) -> bpy.types.Object:
    """Superficie parametrica con UV: ``fn(u, v)`` → punto, con u, v in [0, 1]."""
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    grid = [[bm.verts.new(fn(i / nu, j / nv)) for j in range(nv + 1)] for i in range(nu + 1)]
    for i in range(nu):
        for j in range(nv):
            f = bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
            for loop, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                loop[uv_layer].uv = (a / nu, b / nv)
    return _finish(name, bm, mat, smooth, None, coll)


def image_from_array(name: str, rgba) -> bpy.types.Image:
    """Immagine Blender da un array numpy (h, w, 4) in [0, 1], sRGB, origine in basso a sinistra."""
    h, w = rgba.shape[0], rgba.shape[1]
    img = bpy.data.images.new(name, width=w, height=h, alpha=True)
    img.colorspace_settings.name = "sRGB"
    img.pixels.foreach_set(rgba.astype("float32").ravel())
    img.alpha_mode = "STRAIGHT"
    return img


def mat_image(name: str, img: bpy.types.Image, rough: float = 0.6, use_alpha: bool = True, interpolation: str = "Linear"):
    mat, nodes, links, bsdf, _ = _new_material(name)
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = interpolation
    links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if use_alpha:
        links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Sheen Weight"].default_value = 0.3
    return mat


def mesh_from(name: str, verts, faces, mat=None, smooth: bool = False, sharp_deg: float | None = None):
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in verts]
    for f in faces:
        bm.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(name, bm, mat, smooth, sharp_deg)


def lathe(
    name: str,
    profile: Sequence[tuple[float, float]],
    mat=None,
    segments: int = 32,
    smooth: bool = True,
    sharp_deg: float | None = 40.0,
    phase: float = 0.0,
    cap: bool = True,
    sweep_deg: float = 360.0,
    radius_fn: Callable[[float, float, float], float] | None = None,
) -> bpy.types.Object:
    """Pezzo tornito: rivoluzione del profilo [(raggio, z), …] dal basso in alto attorno a Z.

    ``sweep_deg`` < 360 dà un guscio aperto (grembiule, scialle); ``radius_fn(r, theta, z)``
    deforma il raggio (scanalature a spirale, intagli)."""
    bm = bmesh.new()
    full = sweep_deg >= 359.999
    n = segments
    count = n if full else n + 1
    angles = [math.radians(phase) + math.radians(sweep_deg) * i / n for i in range(count)]
    rings: list[list[bmesh.types.BMVert]] = []
    for r, z in profile:
        if r <= 1e-6:
            rings.append([bm.verts.new((0.0, 0.0, z))])
        else:
            ring = []
            for a in angles:
                rr = radius_fn(r, a, z) if radius_fn else r
                ring.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), z)))
            rings.append(ring)
    steps = n if full else n
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        for j in range(steps):
            j2 = (j + 1) % count
            if len(a) == 1:
                bm.faces.new((a[0], b[j], b[j2]))
            elif len(b) == 1:
                bm.faces.new((a[j], a[j2], b[0]))
            else:
                bm.faces.new((a[j], a[j2], b[j2], b[j]))
    if cap and full:
        if len(rings[0]) > 1:
            bm.faces.new(list(reversed(rings[0])))
        if len(rings[-1]) > 1:
            bm.faces.new(rings[-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(name, bm, mat, smooth, sharp_deg)


def arc(cr: float, cz: float, radius: float, a0: float, a1: float, n: int, sx: float = 1.0, sz: float = 1.0):
    """Punti di profilo su un arco (angoli in gradi, 0 = equatore esterno, 90 = polo alto)."""
    pts = []
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        pts.append((max(0.0, cr + radius * math.cos(a) * sx), cz + radius * math.sin(a) * sz))
    return pts


def box(
    name: str,
    size: Sequence[float],
    loc: Sequence[float] = (0, 0, 0),
    mat=None,
    rot: Sequence[float] = (0, 0, 0),
    bevel: float = 0.0,
    coll=None,
) -> bpy.types.Object:
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect="EDGES", profile=0.5)
    obj = _finish(name, bm, mat, smooth=bevel > 0, sharp_deg=50.0 if bevel > 0 else None, coll=coll)
    return place(obj, loc, rot)


def cylinder(
    name: str,
    r: float,
    depth: float,
    loc: Sequence[float] = (0, 0, 0),
    mat=None,
    rot: Sequence[float] = (0, 0, 0),
    segments: int = 24,
    r2: float | None = None,
    smooth: bool = True,
    coll=None,
) -> bpy.types.Object:
    """Cilindro (o tronco di cono con ``r2``) centrato in loc, asse Z locale."""
    top = r if r2 is None else r2
    prof = [(0.0, -depth / 2), (r, -depth / 2), (top, depth / 2), (0.0, depth / 2)]
    if top <= 1e-6:
        prof = [(0.0, -depth / 2), (r, -depth / 2), (0.0, depth / 2)]
    obj = lathe(name, prof, mat, segments=segments, smooth=smooth, sharp_deg=45.0, cap=False)
    if coll is not None:
        move_to(obj, coll)
    return place(obj, loc, rot)


def sphere(
    name: str,
    r: float,
    loc: Sequence[float] = (0, 0, 0),
    mat=None,
    scale: Sequence[float] | float = 1.0,
    segments: int = 24,
    rings: int = 12,
    rot: Sequence[float] = (0, 0, 0),
    smooth: bool = True,
    coll=None,
) -> bpy.types.Object:
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=r)
    obj = _finish(name, bm, mat, smooth=smooth, sharp_deg=None, coll=coll)
    return place(obj, loc, rot, scale)


def ico(
    name: str,
    r: float,
    loc: Sequence[float] = (0, 0, 0),
    mat=None,
    subdiv: int = 1,
    scale: Sequence[float] | float = 1.0,
    rot: Sequence[float] = (0, 0, 0),
    jitter: float = 0.0,
    seed_name: str | None = None,
    coll=None,
) -> bpy.types.Object:
    """Icosfera sfaccettata (scogli, pietre); ``jitter`` sposta i vertici in modo deterministico."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=r)
    if jitter > 0:
        rr = rng(seed_name or name)
        for v in bm.verts:
            v.co *= 1.0 + rr.uniform(-jitter, jitter)
    obj = _finish(name, bm, mat, smooth=False, sharp_deg=None, coll=coll)
    return place(obj, loc, rot, scale)


def torus(
    name: str,
    major: float,
    minor: float,
    loc: Sequence[float] = (0, 0, 0),
    mat=None,
    rot: Sequence[float] = (0, 0, 0),
    seg: int = 32,
    mseg: int = 10,
    scale: Sequence[float] | float = 1.0,
    arc_deg: float = 360.0,
    coll=None,
) -> bpy.types.Object:
    bm = bmesh.new()
    full = arc_deg >= 359.999
    nseg = seg if full else seg + 1
    rings = []
    for i in range(nseg):
        u = math.radians(arc_deg) * i / (seg if not full else seg)
        cu, su = math.cos(u), math.sin(u)
        ring = []
        for j in range(mseg):
            v = 2 * math.pi * j / mseg
            rr = major + minor * math.cos(v)
            ring.append(bm.verts.new((rr * cu, rr * su, minor * math.sin(v))))
        rings.append(ring)
    count = len(rings) if full else len(rings) - 1
    for i in range(count):
        a, b = rings[i], rings[(i + 1) % len(rings)]
        for j in range(mseg):
            bm.faces.new((a[j], b[j], b[(j + 1) % mseg], a[(j + 1) % mseg]))
    if not full:
        bm.faces.new(rings[0])
        bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = _finish(name, bm, mat, smooth=True, sharp_deg=None, coll=coll)
    return place(obj, loc, rot, scale)


def plane(
    name: str,
    size: Sequence[float],
    loc: Sequence[float] = (0, 0, 0),
    mat=None,
    rot: Sequence[float] = (0, 0, 0),
    coll=None,
) -> bpy.types.Object:
    w, h = size[0] / 2, size[1] / 2
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in ((-w, -h, 0), (w, -h, 0), (w, h, 0), (-w, h, 0))]
    bm.faces.new(vs)
    obj = _finish(name, bm, mat, smooth=False, sharp_deg=None, coll=coll)
    return place(obj, loc, rot)


def prism(
    name: str,
    outline: Sequence[tuple[float, float]],
    depth: float,
    loc: Sequence[float] = (0, 0, 0),
    mat=None,
    rot: Sequence[float] = (0, 0, 0),
    coll=None,
) -> bpy.types.Object:
    """Estrusione di un contorno 2D (piano XZ) lungo Y per ``depth`` (centrata)."""
    bm = bmesh.new()
    d = depth / 2
    front = [bm.verts.new((x, -d, z)) for x, z in outline]
    back = [bm.verts.new((x, d, z)) for x, z in outline]
    n = len(outline)
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((front[i], back[i], back[j], front[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = _finish(name, bm, mat, smooth=False, sharp_deg=None, coll=coll)
    return place(obj, loc, rot)


def tube(
    name: str,
    points: Sequence[Sequence[float]],
    radius: float,
    mat=None,
    resolution: int = 6,
    bevel_res: int = 3,
    coll=None,
) -> bpy.types.Object:
    """Filo, corda o tubo lungo una polilinea liscia (curva NURBS con smusso)."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.resolution_u = resolution
    cu.bevel_depth = radius
    cu.bevel_resolution = bevel_res
    cu.use_fill_caps = True
    sp = cu.splines.new("NURBS")
    sp.points.add(len(points) - 1)
    for p, co in zip(sp.points, points):
        p.co = (co[0], co[1], co[2], 1.0)
    sp.use_endpoint_u = True
    sp.order_u = min(4, len(points))
    if mat is not None:
        cu.materials.append(mat)
    obj = bpy.data.objects.new(name, cu)
    return link(obj, coll)


def empty(name: str, loc: Sequence[float] = (0, 0, 0), rot: Sequence[float] = (0, 0, 0), scale=1.0):
    obj = bpy.data.objects.new(name, None)
    link(obj)
    return place(obj, loc, rot, scale)


def parent_all(children: Iterable[bpy.types.Object], parent: bpy.types.Object) -> None:
    for c in children:
        c.parent = parent


def group(name: str, objs: Iterable[bpy.types.Object], loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0):
    """Raggruppa oggetti costruiti attorno all'origine sotto un vuoto, poi lo piazza."""
    g = empty(name)
    parent_all(objs, g)
    return place(g, loc, rot, scale)


def all_mesh_objects() -> list[bpy.types.Object]:
    return [o for o in bpy.context.scene.objects if o.type in {"MESH", "CURVE"}]


def world_bbox(objs: Iterable[bpy.types.Object]) -> tuple[Vector, Vector]:
    bpy.context.view_layer.update()
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            lo = Vector((min(lo.x, p.x), min(lo.y, p.y), min(lo.z, p.z)))
            hi = Vector((max(hi.x, p.x), max(hi.y, p.y), max(hi.z, p.z)))
    return lo, hi


def corners(lo: Vector, hi: Vector) -> list[Vector]:
    return [Vector((x, y, z)) for x in (lo.x, hi.x) for y in (lo.y, hi.y) for z in (lo.z, hi.z)]


# --------------------------------------------------------------------------
# Camera
# --------------------------------------------------------------------------


def ortho_camera(
    scene: bpy.types.Scene,
    azimuth: float,
    elevation: float,
    target: Sequence[float] = (0, 0, 0),
    ortho_scale: float = 10.0,
    distance: float = 60.0,
) -> bpy.types.Object:
    """Camera ortografica. Azimut 0° = davanti (da -Y verso +Y), positivo verso destra (+X)."""
    cam = bpy.data.cameras.new("camera")
    cam.type = "ORTHO"
    cam.ortho_scale = ortho_scale
    cam.clip_start = 0.1
    cam.clip_end = distance * 3
    cam.sensor_fit = "AUTO"
    obj = bpy.data.objects.new("camera", cam)
    link(obj)
    az, el = math.radians(azimuth), math.radians(elevation)
    t = Vector(target)
    d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    obj.location = t + d * distance
    obj.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    scene.camera = obj
    bpy.context.view_layer.update()
    return obj


def cam_space(cam: bpy.types.Object, p: Vector) -> Vector:
    return cam.matrix_world.inverted() @ p


def fit_camera(
    scene: bpy.types.Scene,
    cam: bpy.types.Object,
    points: Sequence[Vector],
    margin: float = 0.06,
    center: bool = True,
) -> None:
    """Inquadra i punti (spazio mondo): ortho_scale sul bounding box + ``margin`` e centratura."""
    bpy.context.view_layer.update()
    loc = [cam_space(cam, p) for p in points]
    xs, ys = [p.x for p in loc], [p.y for p in loc]
    bw, bh = max(xs) - min(xs), max(ys) - min(ys)
    rx, ry = scene.render.resolution_x, scene.render.resolution_y
    big = max(rx, ry)
    fw, fh = rx / big, ry / big  # frazioni dell'ortho_scale lungo x e y
    scale = max(bw / fw, bh / fh) * (1.0 + margin)
    cam.data.ortho_scale = scale
    if center:
        cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
        shift = cam.matrix_world.to_3x3() @ Vector((cx, cy, 0.0))
        cam.location = cam.location + shift
    bpy.context.view_layer.update()


def project(scene: bpy.types.Scene, cam: bpy.types.Object, p: Sequence[float]) -> tuple[float, float]:
    """Punto mondo → coordinate normalizzate dell'immagine (x da sinistra, y dall'alto)."""
    bpy.context.view_layer.update()
    v = world_to_camera_view(scene, cam, Vector(p))
    return (v.x, 1.0 - v.y)


def object_points(objs: Iterable[bpy.types.Object]) -> list[Vector]:
    """Vertici reali (mesh) e angoli del bounding box (curve) in coordinate mondo."""
    bpy.context.view_layer.update()
    pts: list[Vector] = []
    for o in objs:
        if o.type == "MESH":
            mw = o.matrix_world
            pts.extend(mw @ v.co for v in o.data.vertices)
        elif o.type == "CURVE":
            pts.extend(o.matrix_world @ Vector(c) for c in o.bound_box)
    return pts


def projected_extent(scene: bpy.types.Scene, cam: bpy.types.Object, objs: Iterable[bpy.types.Object]) -> tuple[float, float, float, float]:
    """(u_min, v_min, u_max, v_max) dei vertici reali degli oggetti nell'immagine (y dall'alto)."""
    bpy.context.view_layer.update()
    us: list[float] = []
    vs: list[float] = []
    for o in objs:
        if o.type == "MESH":
            pts = [o.matrix_world @ v.co for v in o.data.vertices]
        elif o.type == "CURVE":
            pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
        else:
            continue
        for p in pts:
            v = world_to_camera_view(scene, cam, p)
            us.append(v.x)
            vs.append(1.0 - v.y)
    return (min(us), min(vs), max(us), max(vs))


def assert_inside(scene: bpy.types.Scene, cam: bpy.types.Object, objs: Iterable[bpy.types.Object], name: str, pad: float = 0.0) -> tuple[float, float, float, float]:
    ext = projected_extent(scene, cam, objs)
    if ext[0] < pad or ext[1] < pad or ext[2] > 1.0 - pad or ext[3] > 1.0 - pad:
        raise RuntimeError(f"{name}: la geometria esce dall'inquadratura {tuple(round(e, 3) for e in ext)}")
    return ext


def shift_camera_px(scene: bpy.types.Scene, cam: bpy.types.Object, dx_px: float, dy_px: float) -> None:
    """Sposta l'inquadratura in modo che il contenuto si muova di (dx, dy) pixel (y verso il basso)."""
    big = max(scene.render.resolution_x, scene.render.resolution_y)
    unit = cam.data.ortho_scale / big
    shift = cam.matrix_world.to_3x3() @ Vector((-dx_px * unit, dy_px * unit, 0.0))
    cam.location = cam.location + shift
    bpy.context.view_layer.update()


# --------------------------------------------------------------------------
# Luci
# --------------------------------------------------------------------------


def light(
    kind: str,
    name: str,
    color: str,
    energy: float,
    loc: Sequence[float] = (0, 0, 10),
    rot: Sequence[float] | None = None,
    target: Sequence[float] | None = None,
    size: float = 1.0,
    angle_deg: float = 4.0,
    shadow_soft: float | None = None,
    coll=None,
) -> bpy.types.Object:
    data = bpy.data.lights.new(name, kind)
    data.color = lin3(color)
    data.energy = energy
    if kind == "SUN":
        data.angle = math.radians(angle_deg)
    elif kind == "AREA":
        data.shape = "DISK"
        data.size = size
    elif kind in {"POINT", "SPOT"}:
        data.shadow_soft_size = shadow_soft if shadow_soft is not None else size
    obj = bpy.data.objects.new(name, data)
    link(obj, coll)
    obj.location = Vector(loc)
    if target is not None:
        d = Vector(target) - Vector(loc)
        obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    elif rot is not None:
        obj.rotation_euler = Euler([math.radians(a) for a in rot], "XYZ")
    return obj


def sun_dir(azimuth: float, elevation: float) -> Vector:
    """Direzione da cui arriva il sole: azimut 0 = davanti, -90 = da sinistra, +90 = da destra."""
    az, el = math.radians(azimuth), math.radians(elevation)
    return Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))


def sun(name: str, color: str, strength: float, azimuth: float, elevation: float, angle_deg: float = 3.0, coll=None):
    d = sun_dir(azimuth, elevation)
    obj = light("SUN", name, color, strength, loc=tuple(d * 30), target=(0, 0, 0), angle_deg=angle_deg, coll=coll)
    return obj


def area_fill(name: str, color: str, strength: float, azimuth: float, elevation: float, target=(0, 0, 0), dist: float = 25.0, size: float = 18.0, coll=None):
    """Riempimento ad area. ``strength`` è l'irradianza voluta al bersaglio (come per un sole):
    l'energia in watt si ricava da E ≈ P / (π d²) per un disco grande e lontano."""
    d = sun_dir(azimuth, elevation)
    pos = Vector(target) + d * dist
    energy = strength * math.pi * dist * dist
    return light("AREA", name, color, energy, loc=tuple(pos), target=target, size=size, coll=coll)


def rig_studio(scene: bpy.types.Scene, warm: float = 3.0, fill: float = 0.9, rim: float = 1.6, world: float = 0.35) -> list:
    """Luce da teatro per sprite e oggetti: chiave calda da sinistra, riempimento freddo, controluce."""
    objs = [
        sun("chiave", LIGHT["sole_giorno"], warm, azimuth=-40, elevation=48, angle_deg=6),
        area_fill("riempimento", LIGHT["cielo_freddo"], fill, azimuth=60, elevation=15),
        sun("controluce", "#FFF1DD", rim, azimuth=150, elevation=35, angle_deg=8),
    ]
    set_world(scene, "#8A8F99", world)
    return objs


def rig_day(scene: bpy.types.Scene, target=(0, 0, 0), sky: str = "#C9CDD0", coll=None) -> list:
    """Giorno: sole caldo #FFE2B8 3,5 a 50° da sinistra + area fredda #A9BBD9 0,8."""
    objs = [
        sun("sole", LIGHT["sole_giorno"], 3.5, azimuth=-50, elevation=50, angle_deg=3, coll=coll),
        area_fill("cielo_freddo", LIGHT["cielo_freddo"], 0.8, azimuth=35, elevation=30, target=target, coll=coll),
    ]
    set_world(scene, sky, 0.55)
    return objs


def rig_dawn(scene: bpy.types.Scene, target=(0, 0, 0), coll=None) -> list:
    """Alba: sole basso (8°) #FFB38A 2,5 + cielo #D9C3B0."""
    objs = [
        sun("sole_basso", LIGHT["sole_alba"], 2.5, azimuth=-65, elevation=8, angle_deg=4, coll=coll),
        area_fill("cielo_alba", LIGHT["cielo_alba"], 0.45, azimuth=25, elevation=40, target=target, coll=coll),
    ]
    set_world(scene, LIGHT["cielo_alba"], 0.6)
    return objs


def rig_night(scene: bpy.types.Scene, target=(0, 0, 0), coll=None) -> list:
    """Notte: luna #8FA6D9 0,6 (le finestre emissive #FFB24A 4,0 e il lampione stanno nella scena)."""
    objs = [
        sun("luna", LIGHT["luna"], 0.6, azimuth=40, elevation=35, angle_deg=2, coll=coll),
        area_fill("cielo_notte", "#3A4766", 0.12, azimuth=-20, elevation=50, target=target, coll=coll),
    ]
    set_world(scene, "#2A3247", 0.25)
    return objs


RIGS = {"alba": rig_dawn, "giorno": rig_day, "notte": rig_night}


def remove_objects(objs: Iterable[bpy.types.Object]) -> None:
    for o in list(objs):
        data = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if data is not None and data.users == 0:
            if isinstance(data, bpy.types.Light):
                bpy.data.lights.remove(data)


__all__ = [name for name in dir() if not name.startswith("_")]
