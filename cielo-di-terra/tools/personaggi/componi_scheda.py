"""
Compone la scheda del cast (tools/personaggi/scheda.mjs): un titolo e le fasce fotografate una sotto
l'altra (fronte, tre quarti, e gli abitanti di oggi per confronto), ridotte a 2400 px di larghezza.

    python3 -I tools/personaggi/componi_scheda.py uscita.png fronte.png tre-quarti.png [vecchi.png]
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

CARTA = (236, 228, 212)
INCHIOSTRO = (59, 44, 31)
LARGO = 2400


def carattere(px: int, corsivo: bool = False):
    nomi = ['DejaVuSerif-Italic.ttf' if corsivo else 'DejaVuSerif.ttf', 'DejaVuSans.ttf']
    for n in nomi:
        for d in ('/usr/share/fonts/truetype/dejavu', '/usr/share/fonts/dejavu', ''):
            p = os.path.join(d, n) if d else n
            try:
                return ImageFont.truetype(p, px)
            except OSError:
                continue
    return ImageFont.load_default()


def main():
    uscita, *fasce = sys.argv[1:]
    didascalie = ['di fronte', 'di tre quarti', 'oggi: gli abitanti procedurali a blocchi, stesso aspetto']
    ims = []
    for f in fasce:
        im = Image.open(f).convert('RGB')
        r = LARGO / im.width
        ims.append(im.resize((LARGO, round(im.height * r)), Image.LANCZOS))
    testa = 92
    fascia_testo = 34
    alto = testa + sum(im.height + fascia_testo for im in ims) + 10
    tela = Image.new('RGB', (LARGO, alto), CARTA)
    d = ImageDraw.Draw(tela)
    d.text((28, 18), 'Cielo di Terra · i personaggi della Fase 1', fill=INCHIOSTRO, font=carattere(34))
    d.text((30, 60), 'Higgsfield (immagine dipinta → 3D) · Blender (pulizia, scheletro di 17 ossa, pesi, LOD) · '
           'animatore procedurale three.js, materiale toon, luce calda', fill=(110, 88, 66), font=carattere(17, True))
    y = testa
    for k, im in enumerate(ims):
        d.text((28, y + 6), didascalie[k] if k < len(didascalie) else '', fill=INCHIOSTRO, font=carattere(20, True))
        y += fascia_testo
        tela.paste(im, (0, y))
        y += im.height
    tela.save(uscita, optimize=True)
    print('scritto', uscita, tela.size, f'{os.path.getsize(uscita) // 1024} KB')


if __name__ == '__main__':
    main()
