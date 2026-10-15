"""
Anteprima rapida di un GLB con bpy (Cycles su CPU, senza GPU): fronte, fianco, retro, tre quarti
in un'unica striscia PNG. Serve a giudicare i GLB grezzi prima della pipeline.

Uso:  python3 -I tools/personaggi/anteprima.py modello.glb uscita.png [--opaco]

Le mesh vengono messe in piedi solo se l'asse più lungo non è Z (Blender, Z in alto) e
centrate; il metallico viene azzerato per l'anteprima (i GLB di sam_3_3d escono con metallic=1).
"""
import math
import sys

import bpy
from mathutils import Vector


def main(entrata: str, uscita: str) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=entrata)
    mesh = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    # ingombro globale
    pts = [o.matrix_world @ v.co for o in mesh for v in o.data.vertices]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centro = (mn + mx) / 2
    alt = mx.z - mn.z
    for m in bpy.data.materials:
        bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if m.node_tree else None
        if bsdf:
            bsdf.inputs['Metallic'].default_value = 0.0
            for l in list(bsdf.inputs['Metallic'].links):
                m.node_tree.links.remove(l)
            bsdf.inputs['Roughness'].default_value = 0.9
    scena = bpy.context.scene
    scena.render.engine = 'CYCLES'
    scena.cycles.device = 'CPU'
    scena.cycles.samples = 24
    scena.cycles.use_denoising = False
    scena.render.resolution_x = 360
    scena.render.resolution_y = 560
    scena.render.film_transparent = False
    mondo = bpy.data.worlds.new('m')
    scena.world = mondo
    mondo.use_nodes = True
    mondo.node_tree.nodes['Background'].inputs['Color'].default_value = (0.75, 0.74, 0.72, 1)
    mondo.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
    # luce calda principale
    sole = bpy.data.lights.new('sole', 'SUN')
    sole.energy = 2.5
    sole.color = (1.0, 0.9, 0.75)
    so = bpy.data.objects.new('sole', sole)
    so.rotation_euler = (math.radians(50), 0, math.radians(30))
    scena.collection.objects.link(so)
    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    cam.ortho_scale = alt * 1.12
    co = bpy.data.objects.new('cam', cam)
    scena.collection.objects.link(co)
    scena.camera = co
    import os
    import tempfile
    tmp = tempfile.mkdtemp()
    fotogrammi = []
    for i, ang in enumerate([0, 90, 180, 45]):
        a = math.radians(ang)
        # la camera guarda verso il centro da -Y ruotato (fronte glTF = +Z glTF = -Y Blender)
        d = Vector((math.sin(a), -math.cos(a), 0))
        co.location = centro + d * (alt * 3)
        co.rotation_euler = (math.radians(90), 0, a)
        f = os.path.join(tmp, f'v{i}.png')
        scena.render.filepath = f
        bpy.ops.render.render(write_still=True)
        fotogrammi.append(f)
    # incolla in striscia
    imgs = [bpy.data.images.load(f) for f in fotogrammi]
    w, h = imgs[0].size
    striscia = bpy.data.images.new('striscia', w * len(imgs), h)
    px = [0.0] * (w * len(imgs) * h * 4)
    for k, im in enumerate(imgs):
        src = list(im.pixels)
        for y in range(h):
            r0 = (y * w) * 4
            d0 = (y * w * len(imgs) + k * w) * 4
            px[d0:d0 + w * 4] = src[r0:r0 + w * 4]
    striscia.pixels = px
    striscia.filepath_raw = uscita
    striscia.file_format = 'PNG'
    striscia.save()
    print('scritto', uscita)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
