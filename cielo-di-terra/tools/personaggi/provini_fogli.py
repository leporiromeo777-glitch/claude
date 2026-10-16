"""
Fogli dei provini e grafici delle misure per la traccia «parlare» (vedi tools/personaggi/provini-parlare.mjs).

    python3 -I tools/personaggi/provini_fogli.py <cartella dei provini> [--uscita <cartella>] [--colonne 10]
    python3 -I tools/personaggi/provini_fogli.py --confronta <prima> <dopo> --uscita <cartella> [--scene a,b]

Per ogni scena (sottocartella con misure.json):
  - <scena>-occhi.jpg e <scena>-lato.jpg: tutti i fotogrammi (10 al secondo) in griglia, con il tempo, gli
    eventi del dialogo (apri, avanti, chiudi) e un bordo rosso dove nei 100 ms prima un osso ha superato
    i 400°/s o il corpo ha girato più di 90°/s;
  - <scena>-misure.png: il giro del corpo, la testa rispetto al corpo, la velocità angolare più alta fra
    le ossa (con il nome), l'altezza delle mani, il bacino; le righe verticali sono gli eventi;
  - una riga di riepilogo in riepilogo.json.
Con --confronta: per ogni scena un foglio prima | dopo (a fotogrammi alterni, 5 al secondo) e il grafico
delle misure delle due versioni una sopra l'altra.
"""
import argparse
import json
import math
import os

from PIL import Image, ImageDraw, ImageFont

CARTA = (238, 230, 214)
INCHIOSTRO = (40, 34, 28)
ROSSO = (200, 40, 30)
SOGLIA_OSSO = 400.0  # °/s: oltre, uno scatto (un cenno vivace sta sotto i 150°/s)
SOGLIA_CORPO = 90.0  # °/s del corpo intero


def font(n):
    for nome in ('DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        try:
            return ImageFont.truetype(nome, n)
        except OSError:
            pass
    return ImageFont.load_default()


def leggi(cartella):
    with open(os.path.join(cartella, 'misure.json'), encoding='utf8') as f:
        return json.load(f)


def penetrazione(m):
    """Profondità (m) della mano o del mezzo avambraccio dentro il busto (ellisse attorno alla spina), 0 se fuori."""
    b = m.get('busto')
    sp = m.get('spina')
    if not b or not sp or not sp[0] or not sp[1]:
        return 0.0
    H = b['H']
    A = sp[0]
    B = sp[1]
    ax = [B[i] - A[i] for i in range(3)]
    L = math.sqrt(sum(x * x for x in ax)) or 1
    ax = [x / L for x in ax]
    peggio = 0.0
    for lato in ('S', 'D'):
        mm = m['mani'].get(lato)
        if not mm:
            continue
        punti = [mm['polso']]
        if 'gomito' in mm:
            punti.append([(mm['gomito'][i] + mm['polso'][i]) / 2 for i in range(3)])
        for P in punti:
            d = [P[i] - A[i] for i in range(3)]
            t = sum(d[i] * ax[i] for i in range(3))
            if t < 0.05 * H or t > L:
                continue
            perp = [d[i] - t * ax[i] for i in range(3)]
            lat = perp[0]
            fr = math.sqrt(max(0.0, sum(x * x for x in perp) - lat * lat))
            e = (lat / (0.12 * H)) ** 2 + (fr / (0.07 * H)) ** 2
            if e < 1:
                peggio = max(peggio, (1 - math.sqrt(e)) * 0.07 * H)
    return peggio


def serie(dati, chi):
    out = {'t': [], 'yaw': [], 'vyaw': [], 'testa': [], 'vmax': [], 'osso': [], 'maniS': [], 'maniD': [], 'bacino': [], 'pen': [], 'cam': [], 'vpetto': [], 'vtesta': []}
    prec = None
    for m in dati['misure']:
        x = m.get(chi)
        if not x:
            continue
        out['t'].append(m['t'])
        out['yaw'].append(x['yaw'])
        out['vyaw'].append(0 if prec is None else (x['yaw'] - prec) * 60)
        prec = x['yaw']
        out['testa'].append(x['testa'][0] if x['testa'] and x['testa'][0] is not None else 0)
        vel = x.get('vel') or {}
        # le gambe dei seduti e dei chini non contano per lo scatto «di dialogo»; si misurano tutte comunque
        if vel:
            nome, v = max(vel.items(), key=lambda kv: kv[1])
        else:
            nome, v = '', 0
        out['vmax'].append(v)
        out['osso'].append(nome)
        out['vpetto'].append(vel.get('petto', 0))
        out['vtesta'].append(vel.get('testa', 0))
        out['maniS'].append(x['mani'].get('S', {}).get('polso', [0, 0, 0])[1])
        out['maniD'].append(x['mani'].get('D', {}).get('polso', [0, 0, 0])[1])
        out['bacino'].append(x['bacinoY'] or 0)
        out['pen'].append(penetrazione(x))
        out['cam'].append(m.get('camYaw', 0))
    return out


def riepilogo(dati, chi):
    s = serie(dati, chi)
    if not s['t']:
        return {}
    n = len(s['t'])
    vm = s['vmax']
    scatti = sum(1 for v in vm if v > SOGLIA_OSSO)
    giro = [abs(v) for v in s['vyaw']]
    salti = [(s['t'][i], round(s['vyaw'][i] / 60, 1)) for i in range(n) if abs(s['vyaw'][i]) > 600]
    imax = max(range(n), key=lambda i: vm[i])
    return {
        'passi': n,
        'osso_piu_veloce': {'t': s['t'][imax], 'osso': s['osso'][imax], 'gradi_al_s': vm[imax]},
        'passi_oltre_400': scatti,
        'corpo_max_gradi_al_s': round(max(giro), 1),
        'salti_del_corpo': salti[:12],
        'mano_nel_busto_max_cm': round(max(s['pen']) * 100, 1),
        'passi_con_mano_nel_busto': sum(1 for p in s['pen'] if p > 0.01),
        'bacino_min': round(min(s['bacino']), 3),
        'bacino_max': round(max(s['bacino']), 3),
    }


def eventi_per_foto(dati):
    fps = dati['fps']
    t0 = dati['t0']
    out = {}
    for e in dati['eventi']:
        k = round((e['t'] - t0) * fps)
        out.setdefault(k, []).extend(e['ev'])
    return out


def scatti_per_foto(dati, chi):
    """Indici dei fotogrammi con uno scatto nei 100 ms prima (osso > 400°/s o corpo > 90°/s)."""
    fps = dati['fps']
    t0 = dati['t0']
    s = serie(dati, chi)
    out = set()
    for i, t in enumerate(s['t']):
        if s['vmax'][i] > SOGLIA_OSSO or abs(s['vyaw'][i]) > SOGLIA_CORPO:
            out.add(math.ceil((t - t0) * fps - 1e-6))
    return out


def foglio(cartella, vista, uscita, colonne=10, larg=150, passo=1, titolo=''):
    dati = leggi(cartella)
    chi = dati['scena']['chi']
    file = sorted(f for f in os.listdir(cartella) if f.startswith(vista + '_') and f.endswith('.jpg'))
    file = file[::passo]
    ev = eventi_per_foto(dati)
    sc = scatti_per_foto(dati, chi)
    imgs = []
    for f in file:
        im = Image.open(os.path.join(cartella, f)).convert('RGB')
        im = im.resize((larg, round(im.height * larg / im.width)), Image.LANCZOS)
        imgs.append((int(f[2:5]), im))
    if not imgs:
        return None
    alt = max(im.height for _, im in imgs)
    fascia = 16
    testa = 26
    righe = (len(imgs) + colonne - 1) // colonne
    tela = Image.new('RGB', (colonne * (larg + 4) + 4, testa + righe * (alt + fascia + 4) + 4), CARTA)
    d = ImageDraw.Draw(tela)
    d.text((6, 5), titolo or f"{dati['scena']['nome']} — {'occhi di Elvira' if vista == 'a' else 'di lato'} — {dati['fps']} fotogrammi/s", fill=INCHIOSTRO, font=font(15))
    f11 = font(11)
    for k, (n, im) in enumerate(imgs):
        r, c = divmod(k, colonne)
        x = 4 + c * (larg + 4)
        y = testa + r * (alt + fascia + 4)
        tela.paste(im, (x, y))
        rosso = any(j in sc for j in range(n - passo + 1, n + 1))
        if rosso:
            d.rectangle([x - 2, y - 2, x + larg + 1, y + im.height + 1], outline=ROSSO, width=3)
        t = dati['t0'] + n / dati['fps']
        e = []
        for j in range(n - passo + 1, n + 1):
            e += ev.get(j, [])
        etichetta = f'{t:+.1f}s'
        if e:
            etichetta += ' ' + ' '.join(x.split(' ')[0] for x in e)
        d.text((x + 2, y + im.height + 1), etichetta, fill=ROSSO if e else INCHIOSTRO, font=f11)
    tela.save(uscita, quality=86)
    return uscita


def grafico(dati_lista, chi, uscita, etichette=None, larg=1400):
    """Le misure di una o più versioni della stessa scena (prima/dopo) una sotto l'altra."""
    pannelli = [
        ('giro del corpo (°)', 'yaw', None),
        ('testa rispetto al corpo (°)', 'testa', None),
        ('osso più veloce (°/s)', 'vmax', (0, 900)),
        ('petto (nero) e testa (blu): velocità (°/s)', 'busto', (0, 150)),
        ('polso S (blu) / D (rosso): altezza (m)', 'mani', None),
        ('mano dentro il busto (cm)', 'pen', (0, 8)),
    ]
    h1 = 120
    blocco = len(pannelli) * (h1 + 26) + 30
    tela = Image.new('RGB', (larg, blocco * len(dati_lista)), CARTA)
    d = ImageDraw.Draw(tela)
    f12 = font(12)
    f14 = font(14)
    for k, dati in enumerate(dati_lista):
        s = serie(dati, chi)
        if not s['t']:
            continue
        y0 = k * blocco
        nome = (etichette[k] if etichette else '') + ' ' + dati['scena']['nome']
        d.text((10, y0 + 6), nome, fill=INCHIOSTRO, font=f14)
        t0, t1 = s['t'][0], s['t'][-1]
        X = lambda t: 70 + (t - t0) / (t1 - t0 or 1) * (larg - 90)
        for j, (tit, chiave, rng) in enumerate(pannelli):
            top = y0 + 30 + j * (h1 + 26)
            d.rectangle([70, top, larg - 20, top + h1], outline=(150, 140, 120))
            d.text((74, top + 2), tit, fill=INCHIOSTRO, font=f12)
            if chiave == 'mani':
                linee = [(s['maniS'], (40, 90, 160)), (s['maniD'], (170, 70, 40))]
            elif chiave == 'busto':
                linee = [(s['vpetto'], (40, 40, 40)), (s['vtesta'], (40, 90, 160))]
            elif chiave == 'pen':
                linee = [([p * 100 for p in s['pen']], ROSSO)]
            else:
                linee = [(s[chiave], (40, 40, 40))]
            tutti = [v for l, _ in linee for v in l]
            lo, hi = rng if rng else (min(tutti), max(tutti))
            if hi - lo < 1e-6:
                hi = lo + 1
            Y = lambda v: top + h1 - (min(max(v, lo), hi) - lo) / (hi - lo) * (h1 - 4) - 2
            d.text((8, top), f'{hi:.3g}', fill=INCHIOSTRO, font=f12)
            d.text((8, top + h1 - 14), f'{lo:.3g}', fill=INCHIOSTRO, font=f12)
            if chiave == 'vmax':
                yy = Y(SOGLIA_OSSO)
                d.line([70, yy, larg - 20, yy], fill=(230, 150, 140), width=1)
            for e in dati['eventi']:
                xx = X(e['t'])
                d.line([xx, top, xx, top + h1], fill=(120, 160, 120), width=1)
                if j == 0:
                    d.text((xx + 2, top + h1 - 14), e['ev'][0].split(' ')[0], fill=(60, 110, 60), font=f12)
            for vals, col in linee:
                pts = [(X(s['t'][i]), Y(vals[i])) for i in range(len(vals))]
                d.line(pts, fill=col, width=2)
            if chiave == 'vmax':
                # i nomi delle ossa ai picchi oltre la soglia (al più otto)
                picchi = sorted(range(len(s['vmax'])), key=lambda i: -s['vmax'][i])
                fatti = []
                for i in picchi:
                    if s['vmax'][i] < SOGLIA_OSSO or len(fatti) >= 8:
                        break
                    if any(abs(s['t'][i] - s['t'][q]) < 0.4 for q in fatti):
                        continue
                    fatti.append(i)
                    d.text((X(s['t'][i]) + 2, top + 14), f"{s['osso'][i]} {s['vmax'][i]:.0f}", fill=ROSSO, font=f12)
    tela.save(uscita)
    return uscita


def affianca(a, b, uscita, etichette=('prima', 'dopo')):
    A = Image.open(a).convert('RGB')
    B = Image.open(b).convert('RGB')
    h = max(A.height, B.height)
    tela = Image.new('RGB', (A.width + B.width + 30, h + 30), CARTA)
    d = ImageDraw.Draw(tela)
    tela.paste(A, (0, 30))
    tela.paste(B, (A.width + 30, 30))
    d.line([A.width + 15, 0, A.width + 15, h + 30], fill=INCHIOSTRO, width=2)
    f = font(20)
    d.text((10, 4), etichette[0], fill=INCHIOSTRO, font=f)
    d.text((A.width + 40, 4), etichette[1], fill=INCHIOSTRO, font=f)
    tela.save(uscita, quality=85)
    return uscita


def impila(file, uscita, qualita=82):
    """Le immagini una sotto l'altra (stessa larghezza: la più larga), JPEG."""
    imgs = [Image.open(f).convert('RGB') for f in file]
    L = max(i.width for i in imgs)
    tela = Image.new('RGB', (L, sum(i.height for i in imgs) + 8 * (len(imgs) - 1)), CARTA)
    y = 0
    for i in imgs:
        tela.paste(i, (0, y))
        y += i.height + 8
    tela.save(uscita, quality=qualita)
    return uscita


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cartelle', nargs='+')
    ap.add_argument('--uscita', default=None)
    ap.add_argument('--colonne', type=int, default=10)
    ap.add_argument('--confronta', action='store_true')
    ap.add_argument('--scene', default=None)
    ap.add_argument('--grafici', default=None, help='scene di cui tenere anche il grafico delle misure (JPEG), separate da virgole')
    a = ap.parse_args()
    if a.confronta:
        prima, dopo = a.cartelle
        os.makedirs(a.uscita, exist_ok=True)
        scene = sorted(x for x in os.listdir(dopo) if os.path.exists(os.path.join(dopo, x, 'misure.json')))
        if a.scene:
            scene = [s for s in scene if s in a.scene.split(',')]
        tmp = os.path.join(a.uscita, '_tmp')
        os.makedirs(tmp, exist_ok=True)
        grafici = set((a.grafici or '').split(',')) - {''}
        for s in scene:
            if not os.path.exists(os.path.join(prima, s, 'misure.json')):
                continue
            # un foglio per scena: gli occhi di Elvira sopra, di lato sotto; prima a sinistra, dopo a destra (4 al secondo)
            righe = []
            for vista in ('a', 'b'):
                nome = 'occhi di Elvira' if vista == 'a' else 'di lato'
                fa = foglio(os.path.join(prima, s), vista, os.path.join(tmp, f'p-{s}-{vista}.jpg'), colonne=6, larg=118, passo=2, titolo=f'{s}: {nome}, prima')
                fb = foglio(os.path.join(dopo, s), vista, os.path.join(tmp, f'd-{s}-{vista}.jpg'), colonne=6, larg=118, passo=2, titolo=f'{s}: {nome}, dopo')
                if fa and fb:
                    righe.append(affianca(fa, fb, os.path.join(tmp, f'c-{s}-{vista}.jpg')))
            if righe:
                impila(righe, os.path.join(a.uscita, f'{s}.jpg'))
            dp = leggi(os.path.join(prima, s))
            dd = leggi(os.path.join(dopo, s))
            g = grafico([dp, dd], dd['scena']['chi'], os.path.join(tmp, f'{s}-misure.png'), etichette=['PRIMA', 'DOPO'])
            if s in grafici:
                Image.open(g).convert('RGB').save(os.path.join(a.uscita, f'{s}-misure.jpg'), quality=85)
            print('confronto', s)
        return
    for cart in a.cartelle:
        uscita = a.uscita or cart
        os.makedirs(uscita, exist_ok=True)
        rie = {}
        for s in sorted(os.listdir(cart)):
            c = os.path.join(cart, s)
            if not os.path.exists(os.path.join(c, 'misure.json')):
                continue
            dati = leggi(c)
            chi = dati['scena']['chi']
            foglio(c, 'a', os.path.join(uscita, f'{s}-occhi.jpg'), colonne=a.colonne)
            foglio(c, 'b', os.path.join(uscita, f'{s}-lato.jpg'), colonne=a.colonne)
            grafico([dati], chi, os.path.join(uscita, f'{s}-misure.png'))
            rie[s] = {chi: riepilogo(dati, chi)}
            for altro in dati['scena'].get('altri') or []:
                rie[s][altro] = riepilogo(dati, altro)
            print(s, json.dumps(rie[s], ensure_ascii=False))
        with open(os.path.join(uscita, 'riepilogo.json'), 'w', encoding='utf8') as f:
            json.dump(rie, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
