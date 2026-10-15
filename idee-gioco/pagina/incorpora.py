#!/usr/bin/env python3
"""Incorpora le immagini img/*.jpg come data URI (1280 px) e toglie il caricamento pigro."""
import base64, io, os, re, sys
from PIL import Image

here = os.path.dirname(os.path.abspath(__file__))
cache = {}

def data_uri(rel):
    if rel not in cache:
        im = Image.open(os.path.join(here, rel)).convert('RGB')
        w = 1280
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, 'JPEG', quality=76, optimize=True, progressive=True)
        cache[rel] = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
    return cache[rel]

for path in sys.argv[1:]:
    s = open(path).read()
    s = re.sub(r'src="(img/[^"]+\.jpg)"', lambda m: f'src="{data_uri(m.group(1))}"', s)
    s = s.replace(' loading="lazy"', ' decoding="async"')
    open(path, 'w').write(s)
    print(path, round(len(s) / 1048576, 2), 'MB', 'immagini', s.count('data:image/jpeg'))
