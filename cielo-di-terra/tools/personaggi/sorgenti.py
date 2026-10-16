"""
Copia compressa (JPEG) delle immagini sorgente scelte in docs/personaggi/sorgenti/<id>.jpg e un mosaico
di tutte (docs/personaggi/sorgenti/tutte.jpg).

    python3 -I tools/personaggi/sorgenti.py --da <cartella con <id>-a.png, <id>-b.png>

La variante scelta per ogni personaggio è in tools/personaggi/produzione.json («scelta»); Togna viene
dal pilota (tools/personaggi/pilota/togna-sorgente.jpg).
"""
from __future__ import annotations

import argparse
import json
import os

from PIL import Image, ImageDraw, ImageFont

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.abspath(os.path.join(QUI, '..', '..'))
ORDINE = ['ottavio', 'togna', 'bortolo', 'pina', 'annunciata', 'nando', 'clelia', 'lisa', 'gioanin',
          'velata_donna', 'velato_gerla', 'velato_maschera', 'velato_cappuccio']


def carattere(px: int):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, px)
    return ImageFont.load_default()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--da', required=True)
    ap.add_argument('--qualita', type=int, default=82)
    a = ap.parse_args()
    prod = json.load(open(os.path.join(QUI, 'produzione.json'), encoding='utf-8'))['personaggi']
    dest = os.path.join(RADICE, 'docs', 'personaggi', 'sorgenti')
    os.makedirs(dest, exist_ok=True)
    immagini = {}
    for pid in ORDINE:
        if pid == 'togna':
            src = os.path.join(QUI, 'pilota', 'togna-sorgente.jpg')
        else:
            src = os.path.join(a.da, f'{pid}-{prod[pid]["scelta"]}.png')
        im = Image.open(src).convert('RGB')
        out = os.path.join(dest, f'{pid}.jpg')
        im.save(out, quality=a.qualita, optimize=True, progressive=True)
        immagini[pid] = im
        print(pid, os.path.getsize(out) // 1024, 'KB')
    # mosaico: 13 in fila su due righe (7 + 6), ridotte
    w, h = 300, 446
    cols = 7
    righe = 2
    tela = Image.new('RGB', (cols * w, righe * (h + 28)), (236, 229, 216))
    d = ImageDraw.Draw(tela)
    f = carattere(17)
    for k, pid in enumerate(ORDINE):
        r, c = divmod(k, cols)
        im = immagini[pid].resize((w, h), Image.LANCZOS)
        tela.paste(im, (c * w, r * (h + 28)))
        d.text((c * w + 8, r * (h + 28) + h + 5), pid, fill=(60, 42, 28), font=f)
    out = os.path.join(dest, 'tutte.jpg')
    tela.save(out, quality=80, optimize=True, progressive=True)
    print('mosaico', os.path.getsize(out) // 1024, 'KB')


if __name__ == '__main__':
    main()
