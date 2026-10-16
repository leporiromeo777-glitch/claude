"""
Mette in fila (o in griglia) alcune schermate in un'unica immagine, con una didascalia sotto ciascuna.

    python3 -I tools/personaggi/mosaico.py uscita.jpg --colonne 2 --larghezza 640 a.png:"didascalia" b.png ...
"""
import argparse
import re

from PIL import Image, ImageDraw, ImageFont


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('uscita')
    ap.add_argument('immagini', nargs='+')
    ap.add_argument('--colonne', type=int, default=2)
    ap.add_argument('--larghezza', type=int, default=640, help='larghezza di ogni riquadro')
    ap.add_argument('--ritaglio', default=None, help='x0,y0,x1,y1 in frazioni, applicato a ogni immagine')
    a = ap.parse_args()
    voci = []
    for s in a.immagini:
        # «percorso.png:didascalia» (il percorso finisce con l'estensione dell'immagine)
        m = re.match(r'^(.*?\.(?:png|jpe?g|webp))(?::(.*))?$', s, re.IGNORECASE)
        p, d = (m.group(1), m.group(2) or '') if m else (s, '')
        im = Image.open(p).convert('RGB')
        if a.ritaglio:
            x0, y0, x1, y1 = (float(x) for x in a.ritaglio.split(','))
            w, h = im.size
            im = im.crop((int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h)))
        r = a.larghezza / im.width
        im = im.resize((a.larghezza, round(im.height * r)), Image.LANCZOS)
        voci.append((im, d))
    alt = max(im.height for im, _ in voci)
    fascia = 28
    righe = (len(voci) + a.colonne - 1) // a.colonne
    tela = Image.new('RGB', (a.colonne * a.larghezza, righe * (alt + fascia)), (238, 230, 214))
    dis = ImageDraw.Draw(tela)
    try:
        font = ImageFont.truetype('DejaVuSans.ttf', 16)
    except OSError:
        font = ImageFont.load_default()
    for i, (im, d) in enumerate(voci):
        x = (i % a.colonne) * a.larghezza
        y = (i // a.colonne) * (alt + fascia)
        tela.paste(im, (x, y))
        dis.text((x + 8, y + alt + 5), d, fill=(60, 44, 30), font=font)
    tela.save(a.uscita, quality=88)
    print('scritto', a.uscita, tela.size)


if __name__ == '__main__':
    main()
