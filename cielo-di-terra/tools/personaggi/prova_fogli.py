"""
Fogli e grafici delle prove dei dialoghi (tools/personaggi/prova-dialoghi.mjs, prova-clelia.mjs), per il
resoconto della traccia «parlare» (docs/migliorie/parlare.md, seconda tornata). Solo PIL.

  python3 -I tools/personaggi/prova_fogli.py striscia <prima> <dopo> <uscita.jpg> t0 t1 passo a|b "titolo" [x0,y0,x1,y1] [larghezza]
      prima sopra e dopo sotto, gli stessi istanti in colonna (a = dagli occhi di Elvira, b = di lato);
      il ritaglio è in frazioni del fotogramma
  python3 -I tools/personaggi/prova_fogli.py grafico <prima> <dopo> <uscita.jpg> <chi> t0 t1 yaw,testa,piedi "titolo"
      le misure a 60 Hz: giro del corpo (gradi), velocità della testa nello spazio della figura (°/s),
      velocità dei piedi a terra (m/s); rosso prima, verde dopo, in blu la soglia delle prove
  python3 -I tools/personaggi/prova_fogli.py schermate <cartella> <uscita.jpg> [colonne] [larghezza]
      le schermate di prova-clelia.mjs con il loro stato (log.json)
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont


def carattere(px=12):
    """DejaVu Sans se c'è (le lettere accentate), se no il carattere di PIL."""
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'DejaVuSans.ttf'):
        try:
            return ImageFont.truetype(f, px)
        except OSError:
            pass
    return ImageFont.load_default()


def foto_t(d):
    return json.load(open(os.path.join(d, 'misure.json')))['fotoT']


def striscia(prima, dopo, out, t0, t1, passo, lato, titolo, crop=None, W=150):
    def trova(f, t):
        c = [x for x in f if lato == 'a' or x['lato']]
        return min(c, key=lambda x: abs(x['t'] - t))

    ts = []
    t = t0
    while t <= t1 + 1e-6:
        ts.append(round(t, 2))
        t += passo
    righe = []
    for d in (prima, dopo):
        f = foto_t(d)
        r = []
        for t in ts:
            x = trova(f, t)
            im = Image.open(os.path.join(d, f"{lato}_{x['n']:03d}.jpg")).convert('RGB')
            if crop:
                im = im.crop((int(crop[0] * im.width), int(crop[1] * im.height), int(crop[2] * im.width), int(crop[3] * im.height)))
            r.append(im.resize((W, int(im.height * W / im.width)), Image.LANCZOS))
        righe.append(r)
    h = righe[0][0].height
    F = Image.new('RGB', (70 + len(ts) * (W + 2), 24 + 2 * (h + 18)), (245, 240, 228))
    dr = ImageDraw.Draw(F)
    dr.font = carattere()
    dr.text((70, 5), titolo, fill=(30, 30, 30))
    for k, (nome, col) in enumerate((('PRIMA', (170, 30, 30)), ('DOPO', (20, 110, 40)))):
        y = 24 + k * (h + 18)
        dr.text((6, y + h // 2 - 6), nome, fill=col)
        for j, im in enumerate(righe[k]):
            x = 70 + j * (W + 2)
            F.paste(im, (x, y))
            dr.text((x + 3, y + h + 2), f"t={ts[j]:.1f}", fill=(80, 60, 60))
    F.save(out, quality=86)
    return F


UNITA = {
    'yaw': ('giro del corpo (gradi)', None),
    'testa': ('testa, velocità nello spazio della figura (gradi/s)', 120),
    'piedi': ('piedi a terra (entro 1,5 cm), velocità (m/s)', 0.12),
}


def serie(d, chi, p, t0, t1):
    M = json.load(open(os.path.join(d, 'misure.json')))
    rows = [(x['t'], x[chi]) for x in M['misure'] if chi in x and t0 <= x['t'] <= t1]
    ev = [(e['t'], e['ev']) for e in M['eventi'] if t0 <= e['t'] <= t1]
    if p == 'yaw':
        return [(t, r['yaw']) for t, r in rows], ev
    if p == 'testa':
        return [(t, r['vel'].get('testa', 0)) for t, r in rows], ev
    amin = {L: min(r['piedi'][L][0] for _, r in rows if L in r['piedi']) for L in 'SD'}
    out = []
    for t, r in rows:
        v = 0
        for L in 'SD':
            a, s = r['piedi'].get(L, (9, 0))
            if a - amin[L] < 0.015:
                v = max(v, s)
        out.append((t, v))
    return out, ev


def grafico(prima, dopo, out, chi, t0, t1, pannelli, titolo):
    W, Hp, ML, MT = 1100, 200, 70, 34
    F = Image.new('RGB', (W, MT + len(pannelli) * (Hp + 40) + 10), (250, 247, 240))
    dr = ImageDraw.Draw(F)
    dr.font = carattere()
    dr.text((ML, 8), f"{titolo}   (rosso = prima, verde = dopo; in blu la soglia delle prove)", fill=(30, 30, 30))
    for k, p in enumerate(pannelli):
        y0 = MT + k * (Hp + 40)
        sp, _ = serie(prima, chi, p, t0, t1)
        sd, ev = serie(dopo, chi, p, t0, t1)
        vals = [v for _, v in sp + sd]
        lo, hi = min(vals + [0]), max(vals + [1e-6])
        soglia = UNITA[p][1]
        if soglia:
            hi = max(hi, soglia * 1.1)
        pad = (hi - lo) * 0.05 or 1
        lo -= pad
        hi += pad

        def X(t):
            return ML + (t - t0) / (t1 - t0) * (W - ML - 20)

        def Y(v):
            return y0 + Hp - (v - lo) / (hi - lo) * Hp

        dr.rectangle((ML, y0, W - 20, y0 + Hp), outline=(180, 170, 150))
        dr.text((ML + 4, y0 + 2), UNITA[p][0], fill=(60, 60, 60))
        for i in range(5):
            v = lo + (hi - lo) * i / 4
            dr.text((4, Y(v) - 6), f"{v:.2f}" if hi < 5 else f"{v:.0f}", fill=(90, 90, 90))
        for t in range(int(t0), int(t1) + 1):
            dr.line((X(t), y0 + Hp, X(t), y0 + Hp + 4), fill=(120, 120, 120))
            if t % 2 == 0:
                dr.text((X(t) - 6, y0 + Hp + 6), str(t), fill=(90, 90, 90))
        if soglia:
            dr.line((ML, Y(soglia), W - 20, Y(soglia)), fill=(120, 120, 220))
        for i, (t, e) in enumerate(ev):
            dr.line((X(t), y0, X(t), y0 + Hp), fill=(205, 205, 205))
            dr.text((X(t) + 2, y0 + 14 + (i % 3) * 12), e[:30], fill=(120, 120, 120))
        for s, col in ((sp, (200, 40, 40)), (sd, (30, 140, 50))):
            pts = [(X(t), Y(v)) for t, v in s]
            if len(pts) > 1:
                dr.line(pts, fill=col, width=2)
    F.save(out, quality=88)
    return F


def schermate(d, out, col=4, W=480):
    fs = sorted(f for f in os.listdir(d) if f.endswith('.png'))
    log = {x['nome']: x for x in json.load(open(os.path.join(d, 'log.json')))}
    ims = []
    for f in fs:
        im = Image.open(os.path.join(d, f)).convert('RGB')
        ims.append((f, im.resize((W, int(im.height * W / im.width)), Image.LANCZOS)))
    h = ims[0][1].height
    rows = (len(ims) + col - 1) // col
    F = Image.new('RGB', (col * W, rows * (h + 16)), (240, 235, 220))
    dr = ImageDraw.Draw(F)
    dr.font = carattere()
    for i, (f, im) in enumerate(ims):
        x, y = (i % col) * W, (i // col) * (h + 16)
        F.paste(im, (x, y))
        n = f[3:-4]
        L = log.get(n, {})
        dr.text((x + 3, y + h + 2), f"{n}  visibile={L.get('visibile')} cammina={L.get('cammina')} distanza={L.get('distanza')} m", fill=(80, 20, 20))
    F.save(out, quality=85)
    return F


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[0] == 'striscia':
        crop = [float(x) for x in a[9].split(',')] if len(a) > 9 and a[9] != '-' else None
        striscia(a[1], a[2], a[3], float(a[4]), float(a[5]), float(a[6]), a[7], a[8], crop, int(a[10]) if len(a) > 10 else 150)
    elif a[0] == 'grafico':
        grafico(a[1], a[2], a[3], a[4], float(a[5]), float(a[6]), a[7].split(','), a[8] if len(a) > 8 else '')
    elif a[0] == 'schermate':
        schermate(a[1], a[2], int(a[3]) if len(a) > 3 else 4, int(a[4]) if len(a) > 4 else 480)
    else:
        sys.exit(__doc__)
    print(a[3] if a[0] != 'schermate' else a[2])
