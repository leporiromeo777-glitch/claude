"""
Ispeziona uno o più GLB generati (Higgsfield: sam_3_3d, tripo...) con bpy.

Uso:  python3 -I tools/personaggi/ispeziona.py file1.glb [file2.glb ...]

Stampa per ogni file: oggetti, triangoli, vertici, materiali e texture (dimensioni),
ingombro (assi di Blender, Z in alto), isole sconnesse, bordi aperti (buchi), normali.
"""
import sys

import bpy  # prima di bmesh e mathutils: li rende importabili
import bmesh
from mathutils import Vector


def svuota():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def ispeziona(percorso: str) -> None:
    svuota()
    bpy.ops.import_scene.gltf(filepath=percorso)
    print(f"\n=== {percorso}")
    mesh = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    altri = [f"{o.name}:{o.type}" for o in bpy.context.scene.objects if o.type != 'MESH']
    print(f"oggetti mesh: {len(mesh)}  altri: {altri}")
    tmin = Vector((1e9, 1e9, 1e9))
    tmax = Vector((-1e9, -1e9, -1e9))
    for o in mesh:
        me = o.data
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        tri = len(bm.faces)
        aperti = sum(1 for e in bm.edges if e.is_boundary)
        nonmanifold = sum(1 for e in bm.edges if not e.is_manifold)
        # isole
        visti = set()
        isole = 0
        for v in bm.verts:
            if v.index in visti:
                continue
            isole += 1
            pila = [v]
            while pila:
                x = pila.pop()
                if x.index in visti:
                    continue
                visti.add(x.index)
                for e in x.link_edges:
                    w = e.other_vert(x)
                    if w.index not in visti:
                        pila.append(w)
        bm.free()
        mw = o.matrix_world
        for v in me.vertices:
            p = mw @ v.co
            tmin = Vector(map(min, tmin, p))
            tmax = Vector(map(max, tmax, p))
        print(f"- {o.name}: vertici {len(me.vertices)}, triangoli {tri}, isole {isole}, bordi aperti {aperti}, non-manifold {nonmanifold}")
        print(f"  uv: {[uv.name for uv in me.uv_layers]}  colori vertice: {[c.name for c in me.color_attributes]}")
        print(f"  matrice: loc {tuple(round(x,3) for x in o.location)} rot {tuple(round(x,3) for x in o.rotation_euler)} scala {tuple(round(x,3) for x in o.scale)}  genitore {o.parent.name if o.parent else None}")
        for s in o.material_slots:
            m = s.material
            if not m:
                continue
            tex = []
            if m.use_nodes:
                for n in m.node_tree.nodes:
                    if n.type == 'TEX_IMAGE' and n.image:
                        tex.append(f"{n.image.name} {n.image.size[0]}x{n.image.size[1]} -> {[l.to_socket.name for l in n.outputs[0].links]}")
                bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
                extra = ''
                if bsdf:
                    extra = f" metallic={bsdf.inputs['Metallic'].default_value:.2f} rough={bsdf.inputs['Roughness'].default_value:.2f}"
            print(f"  materiale {m.name}{extra}: {tex}")
    dim = tmax - tmin
    print(f"ingombro min {tuple(round(x,3) for x in tmin)} max {tuple(round(x,3) for x in tmax)} dim {tuple(round(x,3) for x in dim)}")


if __name__ == '__main__':
    for p in sys.argv[1:]:
        ispeziona(p)
