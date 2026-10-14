#!/usr/bin/env python3
"""Genera la pagina del concept definitivo (mix-finale) riusando i blocchi di genera.py."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import genera as g

BASE = g.BASE
OUT = os.path.join(BASE, 'pagina', 'cielo-di-terra.html')
e, paras = g.e, g.paras
ATLANTE = 'https://claude.ai/artifact/2J1MKBBmexkP1z1ovVxHCy'


def main():
    with open(os.path.join(BASE, 'concept', 'mix-finale.json')) as f:
        c = json.load(f)
    c['key'] = 'mix-finale'
    c['_giurie'] = {}
    c['_modifiche'] = c.pop('modifiche', [])  # le mostro sotto, insieme a dal_mix e tagli
    g.META['mix-finale'] = {'luogo': 'Il Verbano, un habitat cilindrico rotante', 'epoca': '2322',
                            'coord': 'tre valli prealpine, 3 km di lunghezza', 'quota': '', 'col': 'cie'}
    scene = c.get('scene_per_immagini', [])
    dida = json.load(open(os.path.join(BASE, 'pagina', 'didascalie-finale.json'))) if os.path.exists(os.path.join(BASE, 'pagina', 'didascalie-finale.json')) else []
    n_img = len([x for x in os.listdir(os.path.join(BASE, 'pagina', 'img')) if x.startswith('finale-')])
    g.DIDA['mix-finale'] = (dida + [''] * n_img)[:n_img]
    body_concept = g.concept_html(c).replace('img/mix-finale-', 'img/finale-').replace('href="#indice">Torna al confronto', 'href="#percorso">Come ci siamo arrivati')

    # come ci siamo arrivati: giudizi comparativi sul mix
    rows = []
    for gk, gl in g.GIURIE:
        p = os.path.join(BASE, 'giurie', f'mix-{gk}.json')
        if not os.path.exists(p):
            continue
        j = json.load(open(p))
        va = j['valutazioni']
        ma = sum(va['mix-a']['punteggi'].values()) / 9
        mb = sum(va['mix-b']['punteggi'].values()) / 9
        pref = 'A' if j['preferito'] == 'mix-a' else 'B'
        rows.append(f'<tr><th scope="row">{e(gl)}</th><td class="num">{g.fmt(ma)}</td><td class="num">{g.fmt(mb)}</td><td>{pref}</td><td>{e(j["perche"])}</td></tr>')
    storia = f'''<section class="indice" id="percorso" aria-labelledby="t-percorso">
<h2 id="t-percorso">Come ci siamo arrivati</h2>
<div class="blk"><p>Hai scelto un misto delle prime tre idee dell'<a href="{ATLANTE}">Atlante dei cinque mondi</a> (Sibilla, La Terza Colonna, Cielo di Terra) con Cielo di Terra come base. Due direttori hanno scritto due versioni: A, fedele alla base, che innesta soprattutto meccaniche; B, che fonde anche le storie. Tre giurie le hanno confrontate, e questa è la versione definitiva, partita da B con i pezzi migliori di A e le correzioni delle giurie.</p></div>
<div class="tbl"><table class="cmp"><thead><tr><th scope="col">Giuria</th><th scope="col" class="num">A</th><th scope="col" class="num">B</th><th scope="col">Preferita</th><th scope="col">Perché</th></tr></thead><tbody>{"".join(rows)}</tbody></table></div>
<div class="blk duo"><div><h3>Che cosa viene da dove</h3>{paras(c.get("dal_mix", []))}</div><div><h3>Che cosa è stato tagliato</h3>{paras(c.get("tagli", []))}</div></div>
<details class="blk"><summary>Le correzioni delle giurie applicate</summary>{paras(c.get("_modifiche", []))}</details>
</section>'''
    css = open(os.path.join(BASE, 'pagina', 'stile.css')).read()
    html = f'''<title>Cielo di Terra</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=JetBrains+Mono:wght@400;500&display=swap">
<style>{css}
.concept {{ margin-top: 8px; border-top: 0; padding-top: 0; }}
.concept .c-head h2 {{ font-size: clamp(44px, 9vw, 84px); }}
</style>
<div class="wrap">
<header class="hero">{g.contour_svg(11)}
<p class="eyebrow">Concept definitivo · prima persona · open world</p>
<nav class="nav" aria-label="Sezioni"><a class="chip cie" href="#mix-finale">Il concept</a><a class="chip cie" href="#percorso">Come ci siamo arrivati</a><a class="chip sib" href="{ATLANTE}">Atlante dei cinque mondi</a></nav>
</header>
{body_concept}
{storia}
<footer class="foot"><p>Concept definitivo del 14-15 ottobre 2026: misto di Cielo di Terra (base), Sibilla e La Terza Colonna. Bozzetti generati con Higgsfield nello stile scelto; non sono la grafica finale.</p></footer>
</div>'''
    with open(OUT, 'w') as f:
        f.write(html)
    print(OUT, len(html) // 1024, 'KB', 'immagini', n_img)


if __name__ == '__main__':
    main()
