"""
Scrive l'indice dei personaggi del gioco, public/personaggi/indice.json, dai GLB prodotti da processa.py
(tools/personaggi/personaggi.json + tools/personaggi/rapporti/<id>.json) e dalle indicazioni per il gioco
qui sotto (GIOCO). Controlla anche i limiti di peso: ogni GLB sotto 1,5 MB, tutti insieme sotto 18 MB.

    python3 -I tools/personaggi/indice.py

Il formato è descritto in docs/personaggi/PIPELINE.md («L'indice») e tipizzato in src/personaggi/indice.ts.
"""
from __future__ import annotations

import json
import os
import struct
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.abspath(os.path.join(QUI, '..', '..'))
CARTELLA = os.path.join(RADICE, 'public', 'personaggi')
LIMITE_FILE = 1.5 * 1024 * 1024
LIMITE_TOTALE = 18 * 1024 * 1024

# l'ordine delle 17 ossa (come src/personaggi/ossa.ts, NOMI_OSSA)
OSSA = ['bacino', 'schiena', 'petto', 'collo', 'testa',
        'braccioS', 'avambraccioS', 'manoS', 'braccioD', 'avambraccioD', 'manoD',
        'cosciaS', 'stincoS', 'piedeS', 'cosciaD', 'stincoD', 'piedeD']

# Indicazioni per il gioco (non vengono dal GLB):
#  volto: 'velo' | 'maschera' | 'scoperto';  gonna: veste lunga per l'animatore (passo corto);
#  apertura: gradi delle braccia a riposo dalla verticale (abbastanza da non entrare nelle vesti);
#  curvo: postura di riposo 0..1 (StatoPersonaggio.curvo);
#  oggetti: oggetti di scena procedurali da attaccare alle ossa (nome@osso), non sono nel modello.
GIOCO = {
    'ottavio': dict(volto='scoperto', gonna=False, apertura=10, curvo=0.0,
                    oggetti=['lume@bacino', 'velo-da-planata (oggetto a parte)'],
                    note='Il Messo, 17 anni; volto dipinto e stilizzato, fascia verde sulla fronte, borsa a tracolla nel modello. Tripo: il più dettagliato, si vede da vicino.'),
    'togna': dict(volto='velo', gonna=True, apertura=13, curvo=0.0,
                  oggetti=[],
                  note='La lavandaia; curvo 1 quando è china sulla vasca (raggiungi() per le mani nell\'acqua). Tripo, dal pilota.'),
    'bortolo': dict(volto='velo', gonna=False, apertura=13, curvo=0.0,
                    oggetti=[],
                    note='Il campanaro: cappello di feltro nero sopra il velo, martello e chiavi d\'ottone alla cintura (nel modello).'),
    'pina': dict(volto='velo', gonna=True, apertura=12, curvo=0.45,
                 oggetti=['forbici@manoD', 'figura-di-cartone@manoS'],
                 note='L\'Ombrista, 81 anni: cappuccio di lana grigia, scialle, grembiule ocra; piccola (1,52 m) e curva.'),
    'annunciata': dict(volto='velo', gonna=True, apertura=11, curvo=0.55,
                       oggetti=['bastone@manoD'],
                       note='Vecchia, velo noce scuro fino ai gomiti; curva (la curva la fa l\'animatore), 1,56 m.'),
    'nando': dict(volto='scoperto', gonna=False, apertura=10, curvo=0.0,
                  oggetti=['pietra@manoD'],
                  note='Lo Smascherato: testa scoperta, volto dipinto e stilizzato, barba grigia corta.'),
    'clelia': dict(volto='maschera', gonna=True, apertura=12, curvo=0.0,
                   oggetti=['pacchetto@manoS'],
                   note='Novizia della Confraternita: veste di garza nero-viola fino a terra, maschera ovale di castagno senza tratti.'),
    'lisa': dict(volto='velo', gonna=True, apertura=12, curvo=0.0,
                 oggetti=[],
                 note='Nove anni: garza bianca annodata storta, nastro vermiglio al polso sinistro. Proporzioni da bambina (testa 1/5).'),
    'gioanin': dict(volto='velo', gonna=False, apertura=12, curvo=0.0,
                    oggetti=[],
                    note='Sei anni: garza bianca troppo lunga, calzoncini con le bretelle, zoccoli. Proporzioni da bambino.'),
    'velata_donna': dict(volto='velo', gonna=True, apertura=12, curvo=0.0,
                         oggetti=['cesto@manoS (facoltativo)'],
                         note='Velata generica: garza noce, scialle verde salvia, gonna noce, grembiule ocra. Varianti con tinta/scala/posa.'),
    'velato_gerla': dict(volto='velo', gonna=False, apertura=12, curvo=0.1,
                         oggetti=['gerla@petto'],
                         note='Velato generico: cappello di feltro bruno, giacca ocra, fasce alle gambe. La gerla l\'ha tolta sam_3_3d (ritaglia la persona): va attaccata come oggetto di scena all\'osso petto, sulla schiena.'),
    'velato_maschera': dict(volto='maschera', gonna=True, apertura=11, curvo=0.35,
                            oggetti=['bastone@manoD'],
                            note='Anziano generico: cappuccio noce, maschera di castagno con due tagli per gli occhi, mantellina grigio-viola, cappotto lungo.'),
    'velato_cappuccio': dict(volto='velo', gonna=True, apertura=12, curvo=0.0,
                             oggetti=[],
                             note='Figura incappucciata generica: cappuccio e mantello grigio-viola aperto davanti, tunica ocra, velo noce dentro il cappuccio.'),
}


def leggi_glb(percorso: str) -> dict:
    with open(percorso, 'rb') as f:
        dati = f.read()
    magia, _versione, _lung = struct.unpack_from('<III', dati, 0)
    if magia != 0x46546C67:
        raise ValueError(f'{percorso}: non è un GLB')
    lung, tipo = struct.unpack_from('<II', dati, 12)
    if tipo != 0x4E4F534A:
        raise ValueError(f'{percorso}: manca il blocco JSON')
    return json.loads(dati[20:20 + lung])


def main() -> int:
    cfg = json.load(open(os.path.join(QUI, 'personaggi.json'), encoding='utf-8'))['personaggi']
    voci = []
    totale = 0
    errori = []
    for pid, c in cfg.items():
        uscita = os.path.join(RADICE, c['uscita'])
        g = leggi_glb(uscita)
        nodi = g['nodes']
        ossa = [nodi[j]['name'] for j in g['skins'][0]['joints']]
        mesh = sorted(m['name'] for m in g['meshes'])
        kb = os.path.getsize(uscita)
        totale += kb
        rap = json.load(open(os.path.join(QUI, 'rapporti', f'{pid}.json'), encoding='utf-8'))
        if sorted(ossa) != sorted(OSSA):
            errori.append(f'{pid}: ossa {ossa}')
        if mesh != ['lod0', 'lod1']:
            errori.append(f'{pid}: mesh {mesh}')
        if kb > LIMITE_FILE:
            errori.append(f'{pid}: {kb / 1024:.0f} KB oltre 1,5 MB')
        gioco = GIOCO[pid]
        voci.append({
            'id': pid,
            'file': os.path.basename(uscita),
            'lod1': {'file': os.path.basename(uscita), 'mesh': 'lod1', 'triangoli': rap['triangoli']['lod1']},
            'lod0': {'mesh': 'lod0', 'triangoli': rap['triangoli']['lod0']},
            'altezza': c['altezza'],
            'ossa': OSSA,
            'kb': round(kb / 1024),
            'generatore': c.get('generatore'),
            'proporzioni': c.get('proporzioni', 'adulto'),
            'volto': gioco['volto'],
            'gonna': gioco['gonna'],
            'apertura': gioco['apertura'],
            'curvo': gioco['curvo'],
            'oggetti': gioco['oggetti'],
            'note': gioco['note'],
        })
    if totale > LIMITE_TOTALE:
        errori.append(f'totale {totale / 1024 / 1024:.1f} MB oltre 18 MB')
    indice = {
        'versione': 1,
        'descrizione': 'Personaggi della Fase 1 generati (Higgsfield -> Blender -> GLB skinned). '
                       'Prodotto da tools/personaggi/indice.py; vedi docs/personaggi/PIPELINE.md.',
        'unita': 'metri (scala 1 = 1 m; altezza = cima della testa o del cappello)',
        'orientamento': 'glTF: +Y in alto, il personaggio guarda +Z, la sua sinistra è +X; piedi a y = 0, centrato sui fianchi',
        'posa_di_riposo': 'A-pose (braccia a circa 25-30 gradi dal corpo): le abbassa l\'animatore (apertura)',
        'ossa': OSSA,
        'lod': 'un GLB per personaggio con due SkinnedMesh sullo stesso scheletro e lo stesso materiale: lod0 (8000 tri) e lod1 (2000 tri)',
        'texture': 'una texture di colore JPEG 1024 px per personaggio, materiale opaco (metallic 0, roughness 1)',
        'totale_kb': round(totale / 1024),
        'personaggi': voci,
    }
    out = os.path.join(CARTELLA, 'indice.json')
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(indice, f, indent=1, ensure_ascii=False)
        f.write('\n')
    for v in voci:
        print(f"{v['id']:18s} {v['altezza']:.2f} m  {v['kb']:4d} KB  lod {v['lod0']['triangoli']}/{v['lod1']['triangoli']}")
    print(f'totale {totale / 1024:.0f} KB -> {out}')
    for e in errori:
        print('ERRORE', e)
    return 1 if errori else 0


if __name__ == '__main__':
    sys.exit(main())
