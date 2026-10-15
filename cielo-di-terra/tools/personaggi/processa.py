"""
Pipeline dei personaggi di «Cielo di Terra»: GLB grezzo (Higgsfield sam_3_3d / tripo) -> GLB del gioco.

    python3 -I tools/personaggi/processa.py --id togna
    python3 -I tools/personaggi/processa.py --entrata grezzo.glb --uscita out.glb --altezza 1.62 [opzioni]

Con --id legge i parametri da tools/personaggi/personaggi.json (sorgente, altezza, gonna, ruota...).

Passi (tutto in bpy, senza interfaccia):
 1. import, unione delle mesh, trasformazioni applicate, oggetti non mesh scartati;
 2. pulizia: fusione dei vertici doppi (le cuciture UV del glTF), briciole staccate, geometria degenere;
 3. in piedi: asse più lungo in alto, fronte verso -Y di Blender (= +Z del glTF, come gli abitanti
    del gioco), scelta della fronte dai piedi (sporgono in avanti) o da --ruota;
 4. scala all'altezza voluta, piedi a z=0, centrato sul bacino;
 5. analisi delle proporzioni per lo scheletro: piedi (due gruppi in basso), mani (estremi laterali),
    braccia (polso e gomito al centro dell'anello della manica, spalla dentro il bordo delle spalle,
    poi i due lati resi simmetrici: le sorgenti sono in A-pose simmetrica);
 6. armatura umanoide di 17 ossa: bacino, schiena, petto, collo, testa, braccio/avambraccio/mano,
    coscia/stinco/piede (S = sinistra del personaggio, D = destra);
 7. LOD0 e LOD1 per decimazione (collasso) del modello pulito;
 8. pesi: bone heat sul modello pulito ad alta risoluzione (dopo la fusione dei doppi tripo e sam
    sono un'isola sola); se lascia più del 2% dei vertici senza peso, bone heat su un PROXY chiuso
    (rimesh a voxel). Poi trasferimento dei pesi a ogni LOD (punto più vicino, baricentriche) e
    correzioni geometriche: braccia solo sui vertici del braccio, omero e gomito (maniche larghe,
    sbuffi) al braccio, gonne sfumate verso il bacino, testa rigida, piedi; massimo 4 influenze;
 9. materiale: metallico 0, ruvidità 1, una texture ridotta a --texture px (JPEG nel GLB), con i
    texel quasi neri dell'atlante riempiti dai vicini;
10. esportazione GLB: armatura + mesh «lod0» e «lod1» che condividono scheletro e materiale;
    poi KHR_mesh_quantization con gltf-transform (npx);
11. rapporto in tools/personaggi/rapporti/<id>.json.

Con --anteprima file.png fa anche una striscia Cycles: riposo fronte/fianco e due pose di prova.
Decisioni e problemi: docs/personaggi/PIPELINE.md.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import tempfile

import bpy  # prima di bmesh e mathutils
import bmesh
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.abspath(os.path.join(QUI, '..', '..'))


def log(*a):
    print('[processa]', *a, flush=True)


# --------------------------------------------------------------------------- contesto

def attivo(o):
    for x in bpy.context.view_layer.objects:
        if x is not None:
            x.select_set(False)
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


def applica_modificatore(o, nome):
    attivo(o)
    with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o], selected_editable_objects=[o]):
        bpy.ops.object.modifier_apply(modifier=nome)


def vertici(o) -> np.ndarray:
    n = len(o.data.vertices)
    a = np.empty(n * 3, dtype=np.float64)
    o.data.vertices.foreach_get('co', a)
    return a.reshape(n, 3)


def imposta_vertici(o, a: np.ndarray):
    o.data.vertices.foreach_set('co', a.reshape(-1).astype(np.float64))
    o.data.update()


def triangoli(o) -> int:
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


# --------------------------------------------------------------------------- 1-2 import e pulizia

def importa(percorso: str):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=percorso)
    for o in list(bpy.context.scene.objects):
        if o.type == 'MESH' and o.parent:
            mw = o.matrix_world.copy()
            o.parent = None
            o.matrix_world = mw
    for o in list(bpy.context.scene.objects):
        if o.type != 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)
    mesh = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not mesh:
        raise SystemExit('nessuna mesh nel GLB')
    for x in bpy.context.view_layer.objects:
        x.select_set(x in mesh)
    bpy.context.view_layer.objects.active = mesh[0]
    if len(mesh) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.name = 'modello'
    o.data.name = 'modello'
    # niente normali personalizzate: le ricalcola l'esportatore dalla geometria pulita
    if o.data.has_custom_normals:
        attivo(o)
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    return o


def pulisci(o, altezza_grezza: float):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    n0 = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=altezza_grezza * 2e-5)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges[:], dist=altezza_grezza * 1e-6)
    sciolti = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=sciolti, context='VERTS')
    # isole: via le briciole piccole e staccate (meno dello 0,15% dei vertici E più piccole del 3% dell'altezza)
    bm.verts.ensure_lookup_table()
    visti = np.zeros(len(bm.verts), dtype=bool)
    isole = []
    for v in bm.verts:
        if visti[v.index]:
            continue
        pila = [v]
        isola = []
        visti[v.index] = True
        while pila:
            x = pila.pop()
            isola.append(x)
            for e in x.link_edges:
                w = e.other_vert(x)
                if not visti[w.index]:
                    visti[w.index] = True
                    pila.append(w)
        isole.append(isola)
    tot = len(bm.verts)
    via = []
    tolte = 0
    for isola in isole:
        if len(isola) < tot * 0.0015:
            co = np.array([tuple(v.co) for v in isola])
            diag = float(np.linalg.norm(co.max(0) - co.min(0)))
            if diag < altezza_grezza * 0.03:
                via.extend(isola)
                tolte += 1
    if via:
        bmesh.ops.delete(bm, geom=via, context='VERTS')
    aperti = sum(1 for e in bm.edges if e.is_boundary)
    log(f'pulizia: vertici {n0} -> {len(bm.verts)}, isole {len(isole)} (tolte {tolte}), bordi aperti {aperti}')
    bm.to_mesh(o.data)
    bm.free()
    o.data.update()


# --------------------------------------------------------------------------- 3-4 orientamento e scala

def orienta_e_scala(o, altezza: float, ruota_gradi: float | None):
    v = vertici(o)
    dim = v.max(0) - v.min(0)
    asse = int(np.argmax(dim))
    if asse != 2:
        # porta l'asse più lungo su Z (con il verso che lascia la massa più larga in basso: i piedi/la gonna)
        if asse == 0:
            R = Matrix.Rotation(math.radians(90), 3, 'Y')
        else:
            R = Matrix.Rotation(math.radians(-90), 3, 'X')
        v = v @ np.array(R).T
        log(f'asse lungo era {"XYZ"[asse]}: ruotato in piedi')
    zmin, zmax = v[:, 2].min(), v[:, 2].max()
    h = zmax - zmin
    # testa in alto: la metà alta deve essere più stretta della metà bassa? Non sempre (braccia). Si
    # controlla solo il caso estremo: se la fascia in basso è vuota e quella in alto piena, capovolgi.
    banda = (v[:, 2] - zmin) / h
    if (banda < 0.1).sum() < (banda > 0.9).sum() * 0.2:
        log('ATTENZIONE: il modello sembra capovolto; lo raddrizzo')
        v[:, 2] = zmax - (v[:, 2] - zmin)
        v[:, 0] = -v[:, 0]
        banda = (v[:, 2] - v[:, 2].min()) / h
    # fronte: l'asse orizzontale più corto nella fascia busto-braccia (in A-pose le braccia allargano X)
    fascia = v[(banda > 0.35) & (banda < 0.75)]
    ex = np.ptp(fascia[:, 0])
    ey = np.ptp(fascia[:, 1])
    if ruota_gradi is None:
        if ex >= ey:
            prof = 1  # profondità su Y: la fronte è ±Y
        else:
            prof = 0
        # i piedi (fascia più bassa) sporgono in avanti rispetto ai fianchi
        piedi = v[banda < 0.04]
        fianchi = v[(banda > 0.4) & (banda < 0.6)]
        avanti = np.median(piedi[:, prof]) - np.median(fianchi[:, prof])
        # vogliamo la fronte su -Y
        # (euristica debole: con le vesti lunghe sbaglia spesso; per i generatori noti si usa --ruota)
        if prof == 1:
            ang = 0.0 if avanti < 0 else 180.0
        else:
            ang = 90.0 if avanti < 0 else -90.0  # fronte su -X: +90° attorno a Z la porta su -Y
        log(f'fronte automatica: asse {"XY"[prof]}, piedi avanti di {avanti:+.4f}, rotazione {ang:.0f}°')
    else:
        ang = ruota_gradi
        log(f'fronte da parametro: rotazione {ang:.0f}°')
    if ang:
        R = np.array(Matrix.Rotation(math.radians(ang), 3, 'Z'))
        v = v @ R.T
    # scala e posizione
    s = altezza / h
    v = v * s
    v[:, 2] -= v[:, 2].min()
    banda = v[:, 2] / altezza
    cx = (v[:, 0].min() + v[:, 0].max()) / 2
    fianchi = v[(banda > 0.42) & (banda < 0.62)]
    cy = float(np.median(fianchi[:, 1]))
    v[:, 0] -= cx
    v[:, 1] -= cy
    imposta_vertici(o, v)
    log(f'scala {s:.4f}: altezza {altezza} m, larghezza {np.ptp(v[:, 0]):.3f}, profondità {np.ptp(v[:, 1]):.3f}')


# --------------------------------------------------------------------------- 5 analisi

def analizza(o, H: float, prop: dict) -> dict:
    v = vertici(o)
    z = v[:, 2]
    J: dict[str, Vector] = {}

    def centro_y(z0, z1):
        m = (z >= z0) & (z < z1)
        sel = v[m & (np.abs(v[:, 0]) < 0.08 * H)]
        if len(sel) < 5:
            sel = v[m]
        return float((sel[:, 1].min() + sel[:, 1].max()) / 2) if len(sel) else 0.0

    # --- piedi
    piedi = v[z < 0.05 * H]
    lati = {}
    for nome, seg in (('S', 1), ('D', -1)):
        p = piedi[piedi[:, 0] * seg > 0.01 * H]
        if len(p) < 10:
            lati[nome] = None
            continue
        lati[nome] = p
    gambe = {}
    for nome, seg in (('S', 1), ('D', -1)):
        p = lati[nome]
        if p is None:
            xf = seg * 0.06 * H
            yc = 0.0
            ytoe = -0.10 * H
        else:
            xf = float(np.median(p[:, 0]))
            yc = float(np.percentile(p[:, 1], 70))  # tallone-caviglia: verso il dietro
            ytoe = float(p[:, 1].min())
        gambe[nome] = (xf, yc, ytoe)

    zb = prop['bacino'] * H
    yb = centro_y(zb - 0.04 * H, zb + 0.04 * H)
    for nome, seg in (('S', 1), ('D', -1)):
        xf, yc, ytoe = gambe[nome]
        xa = seg * max(abs(xf), 0.035 * H)
        xh = seg * min(max(abs(xf) * 0.9, 0.045 * H), 0.075 * H)
        zk = prop['ginocchio'] * H
        J[f'anca{nome}'] = Vector((xh, yb, zb - 0.025 * H))
        J[f'ginocchio{nome}'] = Vector(((xh + xa) / 2, yb - 0.012 * H, zk))
        J[f'caviglia{nome}'] = Vector((xa, yc, 0.05 * H))
        J[f'punta{nome}'] = Vector((xa, min(ytoe + 0.02 * H, yc - 0.06 * H), 0.012 * H))

    # --- braccia. Le sezioni orizzontali «gruppo più esterno» del pilota sbagliano con le maniche larghe
    # e le mesh rade (una sezione di manica cava si spezza in frammenti e il frammento più esterno tira il
    # gomito fuori dal braccio). Qui: punta delle dita misurata; polso e gomito come CENTRO DELL'ANELLO
    # della manica attorno a una retta di prima stima; spalla dalla larghezza delle spalle; infine le due
    # braccia si rendono simmetriche (le immagini sorgente sono in A-pose simmetrica), così un lato
    # disturbato da un velo o da uno scialle non storce lo scheletro.
    banda = 0.012 * H
    lati_b = {}
    for nome, seg in (('S', 1), ('D', -1)):
        lato = v[v[:, 0] * seg > 0]
        cand = lato[(lato[:, 2] > 0.25 * H) & (lato[:, 2] < 0.8 * H)]
        punta = cand[np.argmax(cand[:, 0] * seg)]
        # fondo della mano: il punto più basso vicino alla punta
        vicino = cand[(np.linalg.norm(cand - punta, axis=1) < 0.1 * H) & (cand[:, 0] * seg > punta[0] * seg - 0.05 * H)]
        zbasso = float(vicino[:, 2].min())
        zpolso = zbasso + prop['mano'] * H
        zsp = prop['spalla'] * H
        # spalla: un po' dentro il bordo esterno delle spalle (deltoide, o l'orlo di un velo che vi cade sopra)
        fascia = lato[np.abs(lato[:, 2] - (zsp - 0.03 * H)) < banda]
        bordo = float((fascia[:, 0] * seg).max()) if len(fascia) else 0.16 * H
        xs = min(max(bordo - 0.045 * H, 0.085 * H), 0.14 * H)

        def anello(zc, xc, larg):
            """Centro (x, y) e ampiezza dei vertici in una fascia orizzontale attorno a (zc, xc)."""
            m = (np.abs(lato[:, 2] - zc) < banda) & (np.abs(lato[:, 0] * seg - xc) < larg)
            s = lato[m]
            if len(s) < 4:
                return None
            return float(s[:, 0].mean()) * seg, float(s[:, 1].mean()), float(np.ptp(s[:, 0]))

        # polso: anello attorno al punto sopra la punta delle dita
        xp0 = float(punta[0] * seg) - 0.02 * H
        a = anello(zpolso, xp0, 0.05 * H)
        xp, yp = (a[0], a[1]) if a else (xp0, float(punta[1]))
        # gomito: anello attorno al punto a metà della retta spalla-polso (un po' più vicino alla spalla)
        zg = zsp + 0.52 * (zpolso - zsp)
        xg0 = xs + 0.52 * (xp - xs)
        a = anello(zg, xg0 + 0.01 * H, 0.055 * H)
        xg, yg = (a[0], a[1]) if a else (xg0, yp)
        # raggio dell'avambraccio (serve ai pesi): ampiezza dell'anello a metà avambraccio
        zm = (zg + zpolso) / 2
        a = anello(zm, (xg + xp) / 2, 0.055 * H)
        r = 0.55 * a[2] if a else 0.04 * H
        lati_b[nome] = dict(seg=seg, punta=punta, zbasso=zbasso, xs=xs, zsp=zsp, xg=xg, yg=yg, zg=zg,
                            xp=xp, yp=yp, zpolso=zpolso, r=r)
        log(f'braccio {nome}: punta {np.round(punta, 3)}, fondo mano z {zbasso:.3f}, spalla x {xs / H:.3f} H '
            f'(bordo {bordo / H:.3f} H), gomito x {xg / H:.3f} H, polso x {xp / H:.3f} H, raggio {r / H:.3f} H')
    # simmetria: media dei due lati (le y restano le proprie medie, x speculari)
    S_, D_ = lati_b['S'], lati_b['D']
    med = {k: (S_[k] + D_[k]) / 2 for k in ('xs', 'xg', 'yg', 'zg', 'xp', 'yp', 'zpolso', 'r')}
    diff = max(abs(S_[k] - D_[k]) for k in ('xs', 'xg', 'xp')) / H
    log(f'braccia: scarto fra i lati {diff:.3f} H (resi simmetrici)')
    for nome, b in lati_b.items():
        seg = b['seg']
        spalla = Vector((seg * med['xs'], 0.0, b['zsp']))
        spalla.y = centro_y(b['zsp'] - 0.03 * H, b['zsp'] + 0.03 * H)
        gomito = Vector((seg * med['xg'], med['yg'] + 0.008 * H, med['zg']))  # un filo indietro: la piega del gomito
        polso = Vector((seg * med['xp'], med['yp'], med['zpolso']))
        dita = Vector((float(b['punta'][0]), float(b['punta'][1]), float(b['zbasso']) + 0.01 * H))
        J[f'spalla{nome}'] = spalla
        J[f'gomito{nome}'] = gomito
        J[f'polso{nome}'] = polso
        J[f'dita{nome}'] = dita
        J[f'r{nome}'] = float(min(max(med['r'], 0.025 * H), 0.06 * H))

    # --- collo: per chi ha la testa scoperta (o un velo aderente) il collo è la sezione più stretta
    # fra le spalle e la testa; sotto un velo a mantellina non c'è restringimento e valgono le proporzioni
    fz = dict(prop)
    centrali = v[np.abs(v[:, 0]) < 0.16 * H]
    def larghezza(zc):
        s = centrali[np.abs(centrali[:, 2] - zc) < 0.006 * H]
        return float(np.ptp(s[:, 0])) if len(s) > 5 else 0.0
    zs = np.arange(prop['collo'] - 0.06, prop['testa'] + 0.05, 0.005) * H
    ws = np.array([larghezza(zc) for zc in zs])
    ws[ws <= 0] = np.inf  # fasce senza vertici (mesh rada): non sono un collo
    testa_l = max(larghezza(zc) for zc in np.arange(prop['testa'] + 0.03, prop['testa'] + 0.09, 0.01) * H)
    k = int(np.argmin(ws))
    if 0 < k < len(zs) - 1 and ws[k] < 0.8 * testa_l:
        zn = float(zs[k])
        # la sezione più stretta cade spesso sotto la mascella (barba, colletto): la testa ruota da lì
        fz['collo'] = (zn - 0.045 * H) / H
        fz['testa'] = (zn - 0.005 * H) / H
        log(f'collo trovato a {zn / H:.3f} H (largo {ws[k]:.3f}, testa {testa_l:.3f})')
    else:
        log(f'collo non visibile (velo o cappuccio): proporzioni {prop["collo"]:.2f}/{prop["testa"]:.2f} H')
    for k, f in (('bacino', fz['bacino']), ('schiena', fz['schiena']), ('petto', fz['petto']),
                 ('collo', fz['collo']), ('testa', fz['testa'])):
        zc = f * H
        J[k] = Vector((0.0, centro_y(zc - 0.03 * H, zc + 0.03 * H), zc))
    J['cima'] = Vector((0.0, J['testa'].y, H))
    return J


# --------------------------------------------------------------------------- 6 armatura

OSSA = [
    # nome, testa, coda, genitore, connesso
    ('bacino', 'bacino', 'schiena', None, False),
    ('schiena', 'schiena', 'petto', 'bacino', True),
    ('petto', 'petto', 'collo', 'schiena', True),
    ('collo', 'collo', 'testa', 'petto', True),
    ('testa', 'testa', 'cima', 'collo', True),
    ('braccioS', 'spallaS', 'gomitoS', 'petto', False),
    ('avambraccioS', 'gomitoS', 'polsoS', 'braccioS', True),
    ('manoS', 'polsoS', 'ditaS', 'avambraccioS', True),
    ('braccioD', 'spallaD', 'gomitoD', 'petto', False),
    ('avambraccioD', 'gomitoD', 'polsoD', 'braccioD', True),
    ('manoD', 'polsoD', 'ditaD', 'avambraccioD', True),
    ('cosciaS', 'ancaS', 'ginocchioS', 'bacino', False),
    ('stincoS', 'ginocchioS', 'cavigliaS', 'cosciaS', True),
    ('piedeS', 'cavigliaS', 'puntaS', 'stincoS', True),
    ('cosciaD', 'ancaD', 'ginocchioD', 'bacino', False),
    ('stincoD', 'ginocchioD', 'cavigliaD', 'cosciaD', True),
    ('piedeD', 'cavigliaD', 'puntaD', 'stincoD', True),
]


def crea_armatura(J: dict, nome: str):
    arm = bpy.data.armatures.new(nome)
    o = bpy.data.objects.new(nome, arm)
    bpy.context.scene.collection.objects.link(o)
    attivo(o)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.edit_bones
    for n, t, c, gen, conn in OSSA:
        b = eb.new(n)
        b.head = J[t]
        b.tail = J[c]
        if (b.tail - b.head).length < 1e-3:
            b.tail = b.head + Vector((0, 0, 0.02))
        if gen:
            b.parent = eb[gen]
            b.use_connect = conn and (eb[gen].tail - b.head).length < 1e-4
    # rollio coerente: asse Z locale delle ossa verso la fronte (-Y), utile solo a chi guarda in Blender;
    # il gioco anima in spazio modello e non dipende dal rollio.
    for b in eb:
        b.align_roll(Vector((0, -1, 0)))
    bpy.ops.object.mode_set(mode='OBJECT')
    return o


# --------------------------------------------------------------------------- 7 LOD

def copia(o, nome):
    c = o.copy()
    c.data = o.data.copy()
    c.name = nome
    c.data.name = nome
    bpy.context.scene.collection.objects.link(c)
    return c


def decima(o, bersaglio_tri: int):
    t0 = triangoli(o)
    if t0 > bersaglio_tri:
        m = o.modifiers.new('decima', 'DECIMATE')
        m.decimate_type = 'COLLAPSE'
        m.ratio = bersaglio_tri / t0
        m.use_collapse_triangulate = True
        applica_modificatore(o, m.name)
    log(f'{o.name}: triangoli {t0} -> {triangoli(o)}')


# --------------------------------------------------------------------------- 8 pesi

def gruppi_ossa(o):
    for n, *_ in OSSA:
        if n not in o.vertex_groups:
            o.vertex_groups.new(name=n)


def pesi_bone_heat(mesh, arm) -> float:
    """Bone heat di Blender. Ritorna la frazione di vertici rimasti senza peso."""
    for x in bpy.context.view_layer.objects:
        x.select_set(False)
    mesh.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    senza = 0
    for v in mesh.data.vertices:
        if not any(g.weight > 1e-4 for g in v.groups):
            senza += 1
    return senza / max(1, len(mesh.data.vertices))


def crea_proxy(o, H: float):
    p = copia(o, 'proxy')
    m = p.modifiers.new('voxel', 'REMESH')
    m.mode = 'VOXEL'
    m.voxel_size = H / 140
    m.use_smooth_shade = False
    applica_modificatore(p, m.name)
    decima(p, 24000)
    return p


def trasferisci_pesi(da, a):
    """Pesi dal proxy alla mesh: per ogni vertice il punto più vicino sulla superficie del proxy,
    pesi interpolati con le coordinate baricentriche del triangolo."""
    bm = bmesh.new()
    bm.from_mesh(da.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    albero = BVHTree.FromBMesh(bm)
    nomi = [g.name for g in da.vertex_groups]
    W = np.zeros((len(da.data.vertices), len(nomi)))
    for v in da.data.vertices:
        for g in v.groups:
            W[v.index, g.group] = g.weight
    gruppi_ossa(a)
    idx = {n: a.vertex_groups[n].index for n in nomi}
    for g in a.vertex_groups:
        g.remove([v.index for v in a.data.vertices])
    out = np.zeros((len(a.data.vertices), len(nomi)))
    for v in a.data.vertices:
        co, nor, fi, dist = albero.find_nearest(v.co)
        if fi is None:
            continue
        f = bm.faces[fi]
        p = [x.co for x in f.verts]
        # baricentriche
        v0, v1, v2 = p[1] - p[0], p[2] - p[0], co - p[0]
        d00, d01, d11 = v0.dot(v0), v0.dot(v1), v1.dot(v1)
        d20, d21 = v2.dot(v0), v2.dot(v1)
        den = d00 * d11 - d01 * d01
        if abs(den) < 1e-14:
            b = (1 / 3, 1 / 3, 1 / 3)
        else:
            bv = (d11 * d20 - d01 * d21) / den
            bw = (d00 * d21 - d01 * d20) / den
            b = (1 - bv - bw, bv, bw)
        out[v.index] = sum(b[k] * W[f.verts[k].index] for k in range(3))
    bm.free()
    return out, nomi, idx


def adiacenze(mesh) -> list:
    n = len(mesh.data.vertices)
    e = np.empty(len(mesh.data.edges) * 2, dtype=np.int64)
    mesh.data.edges.foreach_get('vertices', e)
    e = e.reshape(-1, 2)
    adiac = [[] for _ in range(n)]
    for a, b in e:
        adiac[a].append(b)
        adiac[b].append(a)
    return adiac


def dist_segmento(p: np.ndarray, a: np.ndarray, b: np.ndarray) -> np.ndarray:
    ab = b - a
    t = np.clip(((p - a) @ ab) / max(float(ab @ ab), 1e-12), 0, 1)
    return np.linalg.norm(p - (a + t[:, None] * ab), axis=1)


def smussa(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def ritocca_pesi(mesh, P: np.ndarray, nomi: list, J: dict, H: float, gonna: float | None):
    """Correzioni geometriche ai pesi del bone heat.
    - gonna: fra l'anca e l'orlo i pesi delle gambe sfumano verso il bacino (all'orlo restano al 55%),
      e destra/sinistra si scelgono per lato con una transizione morbida al centro;
    - testa: sopra il collo tutto alla testa (i veli e i cappelli non devono seguire le spalle);
    - piedi: sotto la caviglia almeno il 60% al piede del proprio lato."""
    v = vertici(mesh)
    i = {n: k for k, n in enumerate(nomi)}
    z = v[:, 2]
    x = v[:, 0]
    # braccia: le ossa del braccio valgono solo per i vertici del braccio vero. Il proxy a voxel fonde
    # le mani con la gonna o i fianchi quando sono vicini (A-pose stretta), e il bone heat dà allora
    # pesi del braccio a pezzi di gonna. Il braccio è: dentro una capsula attorno alla catena
    # spalla-gomito-polso-dita E raggiungibile dalla punta delle dita camminando sugli spigoli della
    # mesh senza uscire dalla capsula.
    adiac = adiacenze(mesh)
    braccia = {}
    togli = {}
    for n in ('S', 'D'):
        # t = posizione lungo l'asse spalla->polso (0 alla spalla, 1 al polso); d = distanza dalla catena
        S_, W_ = np.array(J['spalla' + n]), np.array(J['polso' + n])
        asse = W_ - S_
        t = ((v - S_) @ asse) / float(asse @ asse)
        d = np.minimum.reduce([
            dist_segmento(v, S_, np.array(J['gomito' + n])),
            dist_segmento(v, np.array(J['gomito' + n]), W_),
            dist_segmento(v, W_, np.array(J['dita' + n])),
        ])
        # il braccio: raggiungibile dalla punta delle dita lungo gli spigoli della mesh restando oltre
        # il primo quinto dell'asse e entro 0,12 H dalla catena (le dita piegate e i pollici stanno
        # anche a 10-12 cm dal segmento della mano)
        dentro = (t > 0.2) & (d < 0.12 * H)
        partenza = int(np.argmin(np.linalg.norm(v - np.array(J['dita' + n]), axis=1)))
        braccio = np.zeros(len(v), dtype=bool)
        if dentro[partenza]:
            pila = [partenza]
            braccio[partenza] = True
            while pila:
                k = pila.pop()
                for w in adiac[k]:
                    if dentro[w] and not braccio[w]:
                        braccio[w] = True
                        pila.append(w)
        braccia[n] = braccio
        # a chi si tolgono i pesi del braccio: oltre la spalla e fuori dal braccio, o lontano dalla catena
        togli[n] = ((t > 0.3) & ~braccio) | (d > 0.16 * H)
    tutte_braccia = braccia['S'] | braccia['D']
    if gonna is not None:
        zh = J['ancaS'].z
        zo = gonna * H
        m = (z < zh) & (z > zo) & ~tutte_braccia
        # sotto l'orlo (gambe visibili) nessun ritocco; dentro la gonna sfumatura
        t = np.clip((zh - z) / max(zh - zo, 1e-6), 0, 1)
        f = 0.15 + 0.4 * t  # quota alle gambe: 15% all'anca, 55% all'orlo
        lato = smussa(x, -0.05 * H, 0.05 * H)  # 0 = destra, 1 = sinistra
        zk = J['ginocchioS'].z
        for k in np.where(m)[0]:
            # quota per osso della gamba: coscia vicino all'anca, stinco verso l'orlo
            s_stinco = smussa(z[k], zk + 0.05 * H, zk - 0.05 * H) * 0.6
            nuovo = np.zeros(len(nomi))
            nuovo[i['bacino']] = 1 - f[k]
            for lato_n, peso_l in (('S', lato[k]), ('D', 1 - lato[k])):
                nuovo[i['coscia' + lato_n]] += f[k] * peso_l * (1 - s_stinco)
                nuovo[i['stinco' + lato_n]] += f[k] * peso_l * s_stinco
            P[k] = nuovo
    for n in ('S', 'D'):
        braccio = braccia[n]
        ossa_b = [i['braccio' + n], i['avambraccio' + n], i['mano' + n]]
        fuori = togli[n]
        tolto = P[fuori][:, ossa_b].sum(1)
        log(f'{mesh.name}: braccio {n} {braccio.sum()} vertici; pesi del braccio tolti a {(tolto > 0.01).sum()} vertici fuori')
        P[np.ix_(fuori, ossa_b)] = 0
        # sotto il gomito il braccio è solo braccio: pesi geometrici fra le tre ossa (inverso della
        # distanza dal segmento alla quarta), così una mano fusa alla gonna nel proxy non eredita le cosce
        rr = J['r' + n]
        lontano = braccio & (z < J['gomito' + n].z) & (
            np.minimum(dist_segmento(v, np.array(J['gomito' + n]), np.array(J['polso' + n])),
                       dist_segmento(v, np.array(J['polso' + n]), np.array(J['dita' + n]))) < rr)
        if lontano.any():
            pts = v[lontano]
            d = np.stack([
                dist_segmento(pts, np.array(J['spalla' + n]), np.array(J['gomito' + n])),
                dist_segmento(pts, np.array(J['gomito' + n]), np.array(J['polso' + n])),
                dist_segmento(pts, np.array(J['polso' + n]), np.array(J['dita' + n])),
            ], 1)
            g = 1 / np.maximum(d, 0.004 * H) ** 4
            g /= g.sum(1, keepdims=True)
            P[lontano] = 0
            P[np.ix_(lontano, ossa_b)] = g
        # Il braccio dalla metà dell'omero a metà dell'avambraccio è braccio: maniche a sbuffo, risvolti,
        # il dietro di una manica larga. Il bone heat li dava spesso al petto (il gomito è vicino al fianco
        # nella posa ad A): quando l'animatore abbassa le braccia restavano indietro e se ne vedeva l'interno
        # scuro. Criterio: vicino alla catena del braccio molto più che all'asse del busto.
        seg = 1 if n == 'S' else -1
        S_, W_ = np.array(J['spalla' + n]), np.array(J['polso' + n])
        asse = W_ - S_
        t = ((v - S_) @ asse) / float(asse @ asse)
        # (non solo l'insieme «braccio» raggiungibile dalle dita: i pezzi di manica staccati dal braccio
        # nella mesh, come gli sbuffi, non ci arrivano; sopra il bacino, così la gonna vicino alle mani resta)
        cand = ~lontano & (t > 0.25) & (t < 0.8) & (x * seg > 0) & (z > J['bacino'].z)
        if cand.any():
            pts = v[cand]
            d = np.stack([
                dist_segmento(pts, S_, np.array(J['gomito' + n])),
                dist_segmento(pts, np.array(J['gomito' + n]), W_),
                dist_segmento(pts, W_, np.array(J['dita' + n])),
            ], 1)
            dbr = d.min(1)
            yb = np.interp(pts[:, 2], [J['bacino'].z, J['schiena'].z, J['petto'].z, J['collo'].z],
                           [J['bacino'].y, J['schiena'].y, J['petto'].y, J['collo'].y])
            dasse = np.hypot(pts[:, 0], pts[:, 1] - yb)
            rapporto = dbr / np.maximum(dasse, 1e-6)
            a = smussa(rapporto, 0.45, 0.25) * smussa(t[cand], 0.25, 0.42)
            g = 1 / np.maximum(d, 0.004 * H) ** 4
            g /= g.sum(1, keepdims=True)
            nuovo = np.zeros((len(pts), len(nomi)))
            nuovo[:, ossa_b] = g
            prima = P[cand][:, ossa_b].sum(1)
            P[cand] = (1 - a[:, None]) * P[cand] + a[:, None] * nuovo
            log(f'{mesh.name}: braccio {n}, {int((a > 0.5).sum())} vertici di omero e gomito portati al braccio '
                f'({int(((prima < 0.5) & (a > 0.5)).sum())} pesavano meno di metà sul braccio)')
    # chi è rimasto senza peso: al petto sopra la vita, al bacino sotto
    vuoti = P.sum(1) < 1e-4
    P[vuoti & (z >= J['schiena'].z), i['petto']] = 1
    P[vuoti & (z < J['schiena'].z), i['bacino']] = 1
    # testa
    sopra = z > J['testa'].z + 0.02 * H
    lati = np.zeros(len(z), dtype=bool)
    for n in ('S', 'D'):
        lati |= (np.abs(x) > abs(J['spalla' + n].x) + 0.03 * H)
    m = sopra & ~lati & ~tutte_braccia
    P[m] = 0
    P[m, i['testa']] = 1
    # piedi
    for n, seg in (('S', 1), ('D', -1)):
        m = (z < J['caviglia' + n].z) & (x * seg > 0.01 * H)
        piede = P[m, i['piede' + n]]
        manca = np.clip(0.6 - piede, 0, None)
        P[m] *= (1 - manca)[:, None]
        P[m, i['piede' + n]] += manca
    return P


def scrivi_pesi(mesh, P: np.ndarray, nomi: list, max_infl: int = 4, soglia: float = 0.02):
    gruppi_ossa(mesh)
    for g in mesh.vertex_groups:
        g.remove([v.index for v in mesh.data.vertices])
    idx = [mesh.vertex_groups[n].index for n in nomi]
    senza = 0
    for k in range(len(P)):
        w = P[k]
        ordine = np.argsort(-w)[:max_infl]
        sel = [(j, w[j]) for j in ordine if w[j] > soglia]
        if not sel:
            sel = [(int(np.argmax(w)), 1.0)] if w.max() > 0 else [(nomi.index('bacino'), 1.0)]
            senza += 1 if w.max() <= 0 else 0
        s = sum(p for _, p in sel)
        for j, p in sel:
            mesh.vertex_groups[idx[j]].add([k], p / s, 'REPLACE')
    if senza:
        log(f'{mesh.name}: {senza} vertici senza peso, assegnati al bacino')


def lega(mesh, arm):
    mesh.parent = arm
    mod = mesh.modifiers.new('armatura', 'ARMATURE')
    mod.object = arm


# --------------------------------------------------------------------------- 9 materiale

def riempi_neri(im, soglia: float = 16 / 255, passi: int = 48):
    """I texel quasi neri dell'atlante (sam_3_3d lascia nero dove nessuna vista dell'immagine arriva:
    punte delle dita, risvolti delle maniche, l'interno dei veli) si vedono come macchie e buchi neri
    sui panni. Si riempiono dai vicini non neri (media dei vicini, a passi); nelle zone scure vere (la
    veste di Clelia, il feltro di Bortolo) i vicini sono scuri anch'essi e il colore non cambia."""
    w, h = im.size
    px = np.empty(w * h * 4, dtype=np.float32)
    im.pixels.foreach_get(px)
    a = px.reshape(h, w, 4)
    rgb = a[:, :, :3].copy()
    buco = rgb.max(2) < soglia
    n0 = int(buco.sum())
    if not n0:
        return
    for _ in range(passi):
        if not buco.any():
            break
        somma = np.zeros_like(rgb)
        conta = np.zeros(buco.shape, dtype=np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            pieno = np.roll(~buco, (dy, dx), (0, 1))
            somma += np.roll(rgb, (dy, dx), (0, 1)) * pieno[:, :, None]
            conta += pieno
        nuovi = buco & (conta > 0)
        rgb[nuovi] = somma[nuovi] / conta[nuovi][:, None]
        buco &= ~nuovi
    a[:, :, :3] = rgb
    im.pixels.foreach_set(a.reshape(-1))
    im.update()
    log(f'texture: {n0} texel quasi neri riempiti dai vicini ({n0 / (w * h) * 100:.1f}%)')


def prepara_materiale(o, lato_tex: int, nome: str):
    mats = [s.material for s in o.material_slots if s.material]
    for m in mats:
        m.name = f'{nome}'
        if not m.node_tree:
            continue
        bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf:
            for k in ('Metallic', 'Roughness'):
                for l in list(bsdf.inputs[k].links):
                    m.node_tree.links.remove(l)
            bsdf.inputs['Metallic'].default_value = 0.0
            bsdf.inputs['Roughness'].default_value = 1.0
            # via le texture non collegate al colore (metallic-roughness, normali): il gioco non le usa
            for n in list(m.node_tree.nodes):
                if n.type == 'TEX_IMAGE':
                    usata = any(l.to_socket.name == 'Base Color' for l in n.outputs[0].links)
                    if not usata:
                        m.node_tree.nodes.remove(n)
                    elif n.image:
                        im = n.image
                        if im.size[0] > lato_tex or im.size[1] > lato_tex:
                            im.scale(lato_tex, lato_tex)
                        im.name = f'{nome}_colore'
                        riempi_neri(im)
            nm = bsdf.inputs.get('Normal')
            if nm:
                for l in list(nm.links):
                    m.node_tree.links.remove(l)
    if len(mats) > 1:
        log(f'ATTENZIONE: {len(mats)} materiali (il gioco ne aspetta uno)')


# --------------------------------------------------------------------------- 10 esportazione

def esporta(arm, lods, uscita: str, qualita_jpeg: int, formato: str = 'jpeg'):
    for x in bpy.context.view_layer.objects:
        x.select_set(False)
    arm.select_set(True)
    for o in lods:
        o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    os.makedirs(os.path.dirname(os.path.abspath(uscita)), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=uscita,
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_skins=True,
        export_def_bones=False,
        export_leaf_bone=False,
        export_influence_nb=4,
        export_animations=False,
        export_morph=False,
        export_normals=True,
        export_tangents=False,
        # WEBP: EXT_texture_webp, letto da GLTFLoader di three.js senza estensioni aggiuntive
        export_image_format='WEBP' if formato == 'webp' else 'JPEG',
        export_jpeg_quality=qualita_jpeg,
        export_image_quality=qualita_jpeg,
        export_vertex_color='NONE',
        export_attributes=False,
        export_rest_position_armature=True,
    )
    log(f'scritto {uscita}: {os.path.getsize(uscita) / 1024:.0f} KB')


def quantizza(uscita: str):
    """KHR_mesh_quantization (posizioni e UV a 16 bit, normali e pesi a 8 bit): circa -35% sul GLB.
    L'esportatore glTF di Blender non quantizza (la sua compressione meshopt richiede un modulo che il
    pacchetto bpy non ha): lo fa gltf-transform via npx, senza toccare package.json. GLTFLoader di
    three.js legge l'estensione da solo."""
    import shutil
    import subprocess
    npx = shutil.which('npx')
    if not npx:
        log('npx non trovato: GLB non quantizzato')
        return
    prima = os.path.getsize(uscita)
    r = subprocess.run([npx, '-y', '@gltf-transform/cli@4.5.1', 'quantize', uscita, uscita], capture_output=True, text=True)
    if r.returncode != 0:
        log('quantizzazione fallita:', r.stderr[-400:])
        return
    log(f'quantizzato: {prima / 1024:.0f} -> {os.path.getsize(uscita) / 1024:.0f} KB')


# --------------------------------------------------------------------------- anteprima

def anteprima(arm, lod, uscita: str, H: float):
    """Striscia Cycles: riposo fronte, riposo fianco, posa «cammina», posa «saluta e gira la testa»."""
    scena = bpy.context.scene
    for o in bpy.context.scene.objects:
        if o.type == 'MESH':
            o.hide_render = o is not lod
    scena.render.engine = 'CYCLES'
    scena.cycles.device = 'CPU'
    scena.cycles.samples = 16
    scena.cycles.use_denoising = False
    scena.render.resolution_x = 300
    scena.render.resolution_y = 460
    mondo = bpy.data.worlds.new('m')
    scena.world = mondo
    mondo.use_nodes = True
    mondo.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.6, 0.7, 1)
    mondo.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
    sole = bpy.data.lights.new('sole', 'SUN')
    sole.energy = 3.0
    sole.color = (1.0, 0.85, 0.65)
    so = bpy.data.objects.new('sole', sole)
    so.rotation_euler = (math.radians(55), 0, math.radians(35))
    scena.collection.objects.link(so)
    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    cam.ortho_scale = H * 1.15
    co = bpy.data.objects.new('cam', cam)
    scena.collection.objects.link(co)
    scena.camera = co
    pb = arm.pose.bones

    def posa(diz):
        for b in pb:
            b.rotation_mode = 'XYZ'
            b.rotation_euler = (0, 0, 0)
        for n, (rx, ry, rz) in diz.items():
            # rotazione espressa nello spazio del MODELLO (X laterale, Y profondità, Z alto), come nel gioco
            b = pb[n]
            R = Matrix.Rotation(math.radians(rz), 4, 'Z') @ Matrix.Rotation(math.radians(ry), 4, 'Y') @ Matrix.Rotation(math.radians(rx), 4, 'X')
            Mr = b.bone.matrix_local.to_3x3().to_4x4()
            loc = Mr.inverted() @ R @ Mr
            b.rotation_euler = loc.to_euler('XYZ')
        bpy.context.view_layer.update()

    # segni (Blender, fronte -Y): +Y abbassa il braccio S e alza il D; -X porta avanti coscia/braccio
    pose = [
        ('riposo', {}, 0),
        ('riposo', {}, 90),
        ('cammina', {'cosciaS': (-30, 0, 0), 'stincoS': (25, 0, 0), 'cosciaD': (22, 0, 0), 'stincoD': (10, 0, 0),
                     'braccioS': (20, 28, 0), 'braccioD': (-20, -28, 0), 'avambraccioD': (-25, 0, 0)}, 90),
        ('saluta', {'braccioS': (0, 28, 0), 'braccioD': (0, 65, 0), 'avambraccioD': (0, 80, 0),
                    'testa': (8, 0, 35), 'schiena': (8, 0, 0), 'petto': (6, 0, 0)}, 25),
    ]
    # giunture come palline rosse (solo nella prima vista, in trasparenza sul modello)
    palline = []
    mat_p = bpy.data.materials.new('giuntura')
    mat_p.use_nodes = True
    em = mat_p.node_tree.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (1, 0.05, 0.02, 1)
    em.inputs['Strength'].default_value = 3
    mat_p.node_tree.links.new(em.outputs[0], mat_p.node_tree.nodes['Material Output'].inputs['Surface'])
    for b in arm.data.bones:
        for p in (b.head_local, b.tail_local):
            bpy.ops.mesh.primitive_uv_sphere_add(radius=H * 0.012, location=p - Vector((0, H, 0)), segments=8, ring_count=6)
            s = bpy.context.active_object
            s.data.materials.append(mat_p)
            palline.append(s)
    tmp = tempfile.mkdtemp()
    file = []
    for k, (nome, diz, ang) in enumerate(pose):
        for s in palline:
            s.hide_render = k != 0
        posa(diz)
        a = math.radians(ang)
        centro = Vector((0, 0, H / 2))
        d = Vector((math.sin(a), -math.cos(a), 0))
        co.location = centro + d * H * 3
        co.rotation_euler = (math.radians(90), 0, a)
        f = os.path.join(tmp, f'{k}.png')
        scena.render.filepath = f
        bpy.ops.render.render(write_still=True)
        file.append(f)
    posa({})
    imgs = [bpy.data.images.load(f) for f in file]
    w, h = imgs[0].size
    st = bpy.data.images.new('striscia', w * len(imgs), h)
    px = np.zeros((h, w * len(imgs), 4), dtype=np.float32)
    for k, im in enumerate(imgs):
        a = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)
        px[:, k * w:(k + 1) * w] = a
    st.pixels.foreach_set(px.reshape(-1))
    st.filepath_raw = uscita
    st.file_format = 'PNG'
    st.save()
    log(f'anteprima {uscita}')


# --------------------------------------------------------------------------- main

PROPORZIONI = {
    # frazioni dell'altezza: adulto stilizzato (testa ~1/7) e bambino (testa ~1/5)
    'adulto': {'bacino': 0.53, 'schiena': 0.61, 'petto': 0.70, 'collo': 0.83, 'testa': 0.87,
               'ginocchio': 0.28, 'spalla': 0.80, 'mano': 0.085},
    'bambino': {'bacino': 0.48, 'schiena': 0.56, 'petto': 0.64, 'collo': 0.77, 'testa': 0.80,
                'ginocchio': 0.25, 'spalla': 0.74, 'mano': 0.09},
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--id')
    ap.add_argument('--config', default=os.path.join(QUI, 'personaggi.json'))
    ap.add_argument('--entrata')
    ap.add_argument('--uscita')
    ap.add_argument('--altezza', type=float)
    ap.add_argument('--gonna', type=float, default=None, help="quota dell'orlo (frazione dell'altezza) per le vesti lunghe")
    ap.add_argument('--ruota', type=float, default=None, help='rotazione attorno all\'alto in gradi (salta la scelta automatica)')
    ap.add_argument('--proporzioni', default=None)
    ap.add_argument('--lod0', type=int, default=None)
    ap.add_argument('--lod1', type=int, default=None)
    ap.add_argument('--texture', type=int, default=None)
    ap.add_argument('--jpeg', type=int, default=None, help='qualità della texture (JPEG o WEBP)')
    ap.add_argument('--formato', choices=['jpeg', 'webp'], default=None)
    ap.add_argument('--quantizza', type=int, choices=[0, 1], default=None, help='1 (predefinito) = KHR_mesh_quantization con gltf-transform')
    ap.add_argument('--anteprima')
    ap.add_argument('--pesi', choices=['proxy', 'diretto'], default=None)
    a = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])

    cfg = {'lod0': 8000, 'lod1': 2000, 'texture': 1024, 'jpeg': 85, 'proporzioni': 'adulto', 'pesi': 'proxy'}
    if a.id:
        with open(a.config) as f:
            tutti = json.load(f)
        c = tutti['personaggi'][a.id]
        cfg.update(tutti.get('predefiniti', {}))
        cfg.update(c)
        cfg['id'] = a.id
        cfg.setdefault('uscita', os.path.join('public', 'personaggi', f'{a.id}.glb'))
    for k in ('entrata', 'uscita', 'altezza', 'gonna', 'ruota', 'proporzioni', 'lod0', 'lod1', 'texture', 'jpeg', 'pesi', 'formato', 'quantizza'):
        val = getattr(a, k)
        if val is not None:
            cfg[k] = val
    nome = cfg.get('id') or os.path.splitext(os.path.basename(cfg['uscita']))[0]
    entrata = cfg['entrata'] if os.path.isabs(cfg['entrata']) else os.path.join(RADICE, cfg['entrata'])
    uscita = cfg['uscita'] if os.path.isabs(cfg['uscita']) else os.path.join(RADICE, cfg['uscita'])
    H = float(cfg['altezza'])
    prop = dict(PROPORZIONI[cfg['proporzioni']])
    prop.update(cfg.get('ritocchi_proporzioni', {}))
    log(f'{nome}: {entrata} -> {uscita} (altezza {H} m, gonna {cfg.get("gonna")}, pesi {cfg["pesi"]})')

    o = importa(entrata)
    v = vertici(o)
    pulisci(o, float(np.ptp(v, axis=0).max()))
    orienta_e_scala(o, H, cfg.get('ruota'))
    J = analizza(o, H, prop)
    arm = crea_armatura(J, nome)
    prepara_materiale(o, int(cfg['texture']), nome)

    lod0 = copia(o, 'lod0')
    decima(lod0, int(cfg['lod0']))
    lod1 = copia(o, 'lod1')
    decima(lod1, int(cfg['lod1']))

    # pesi: «diretto» = bone heat sul modello pulito ad alta risoluzione (va bene quando il generatore
    # dà una mesh sola e quasi chiusa, come tripo); se lascia più del 2% di vertici senza peso si ripiega
    # sul proxy a voxel. «proxy» = sempre il proxy (mesh a brandelli, come sam_3_3d).
    if cfg['pesi'] == 'diretto':
        sorgente = copia(o, 'pesi')
        vuoti = pesi_bone_heat(sorgente, arm)
        log(f'bone heat diretto ({triangoli(sorgente)} tri): vertici senza peso {vuoti * 100:.1f}%')
        if vuoti > 0.02:
            bpy.data.objects.remove(sorgente, do_unlink=True)
            bpy.context.view_layer.update()
            sorgente = None
    else:
        sorgente = None
    if sorgente is None:
        sorgente = crea_proxy(o, H)
        vuoti = pesi_bone_heat(sorgente, arm)
        log(f'bone heat sul proxy ({triangoli(sorgente)} tri): vertici senza peso {vuoti * 100:.1f}%')
    for lod in (lod0, lod1):
        P, nomi, _ = trasferisci_pesi(sorgente, lod)
        P = ritocca_pesi(lod, P, nomi, J, H, cfg.get('gonna'))
        scrivi_pesi(lod, P, nomi)
        lega(lod, arm)
    bpy.data.objects.remove(sorgente, do_unlink=True)
    bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.view_layer.update()
    for lod in (lod0, lod1):
        attivo(lod)
        bpy.ops.object.shade_smooth()
    esporta(arm, [lod0, lod1], uscita, int(cfg['jpeg']), cfg.get('formato', 'jpeg'))
    if int(cfg.get('quantizza', 1)):
        quantizza(uscita)
    rapporto = {
        'id': nome,
        'altezza': H,
        'triangoli': {'lod0': triangoli(lod0), 'lod1': triangoli(lod1)},
        'kb': round(os.path.getsize(uscita) / 1024),
        'giunture': {k: [round(x, 4) for x in (v.x, v.z, -v.y)] for k, v in J.items() if isinstance(v, Vector)},  # in assi glTF (x, y alto, z avanti)
    }
    # il rapporto (giunture, triangoli, peso) sta fra gli strumenti, non in public/ (finirebbe nella build)
    cartella_rapporti = os.path.join(QUI, 'rapporti')
    os.makedirs(cartella_rapporti, exist_ok=True)
    with open(os.path.join(cartella_rapporti, f'{nome}.json'), 'w') as f:
        json.dump(rapporto, f, indent=1)
    if cfg.get('anteprima') or a.anteprima:
        anteprima(arm, lod0, a.anteprima or cfg['anteprima'], H)


if __name__ == '__main__':
    main()
