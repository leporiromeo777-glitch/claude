#!/usr/bin/env python3
"""Genera la pagina con i cinque concept (v2 se presenti, altrimenti v1) e i giudizi delle giurie."""
import html, json, math, os, random, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, 'pagina', 'atlante.html')
NOTE = os.path.join(BASE, 'pagina', 'note.json')  # testo mio: introduzione, confronto, raccomandazione

ORDER = ['sibilla', 'colapesce', 'cielo', 'libero', 'disgelo']
META = {
    'sibilla':   {'luogo': 'Monti Sibillini, Marche e Umbria', 'epoca': '1953', 'coord': '42°50′N 13°16′E', 'quota': 'Monte Vettore 2.476 m', 'col': 'sib'},
    'colapesce': {'luogo': 'Pelòridi, arcipelago immaginario fra le Eolie e lo Stretto', 'epoca': 'aprile 1950', 'coord': '38°15′N 15°38′E', 'quota': 'fondale dello Stretto −250 m', 'col': 'col'},
    'cielo':     {'luogo': 'Il Verbano, un habitat cilindrico rotante', 'epoca': 'duecento anni dopo la partenza', 'coord': 'orbita sconosciuta', 'quota': 'gravità da 1 g a quasi 0', 'col': 'cie'},
    'libero':    {'luogo': 'Carso, fra San Canziano e le Bocche del Timavo', 'epoca': 'novembre 1911', 'coord': '45°40′N 13°59′E', 'quota': 'abissi fino a −300 m', 'col': 'tim'},
    'disgelo':   {'luogo': 'Valle immaginaria fra Ticino e Valtellina', 'epoca': 'estate 1991', 'coord': '46°20′N 9°45′E (valle inventata)', 'quota': '1.700–3.412 m', 'col': 'dis'},
}
CRIT = [('originalita', 'Originalità'), ('mondo', 'Mondo'), ('trama', 'Trama'), ('missioni', 'Missioni'),
        ('build', 'Build'), ('segreti', 'Segreti'), ('divertimento', 'Divertimento'),
        ('fattibilita', 'Fattibilità'), ('mercato', 'Mercato')]
GIURIE = [('critica', 'Critica'), ('produzione', 'Produzione'), ('giocatore', 'Giocatore e mercato')]
DIDA = {
    'sibilla': ['La tavoletta in mano: dove non hai ancora misurato, il mondo è uno schizzo a matita; dove misuri, torna il colore.',
                'Montemonaco, il paese base, con il teodolite piazzato.',
                'Il Lago di Pilato di notte: le fiaccole delle fate e la luce rossa del campo americano sulla cresta.',
                'Il Piano Grande di Castelluccio nel cannocchiale: le persone si vedono solo così, da lontano.'],
    'colapesce': ['Altavilla, il borgo normanno-arabo sommerso: a venti metri il rosso delle cupole diventa bruno.',
                  'Calafarina, il paese della tonnara, dalla barca a remi. Sullo sfondo il vulcano.',
                  'La Fata Morgana: una città capovolta sopra il mare, che a certe ore diventa percorribile.',
                  'Le Tre Colonne che reggono l\'isola, a cento metri: la terza arde alla base.'],
    'cielo': ['Corbella, il paese base: il mondo sale ai lati e continua sopra la testa, con il lago dell\'altra valle appeso nel cielo.',
              'Le Finestre: sotto i piedi lo spazio e le stelle che girano.',
              'Il Fuso, l\'asse del cilindro, senza peso: tutto il mondo ti gira attorno.',
              'Il Verbanetto, gli abitanti velati e le api di rame.'],
    'libero': ['Sottoterra: la lampada a carburo, il lago nero, il telefono da campo e il verde della fluoresceina nell\'acqua.',
               'L\'altopiano del Carso a novembre: doline rosse di sommaco e, all\'orizzonte, la torre di trivellazione con la lampada rossa.',
               'La Gola di San Canziano, dove il fiume entra nella montagna, scendendo con la scala di corda.',
               'Le Bocche del Timavo d\'inverno con la bora: l\'idrofono per ascoltare il fiume sotto la roccia.'],
    'disgelo': ['Un eco: un alpino del 1916 fatto di brina, che il ghiacciaio sta restituendo. La neve è rosa di sabbia del Sahara.',
                'La Conca di Mezzaluna: il relitto del Piper del 1968, il teodolite e i reticolati della Grande Guerra.',
                'In parapendio sulla valle al tramonto.',
                'Il Bosco Vecchio: ceppi di larice di settemila anni, sotto il ghiaccio che si ritira.'],
}

LIVELLI = {1: 'Visto ma irraggiungibile', 2: 'Nascosto in piena vista', 3: 'Si trova usando le meccaniche', 4: 'Cifrato, da risolvere con appunti'}

e = html.escape


def paras(t):
    if not t:
        return ''
    if isinstance(t, list):
        return '<ul>' + ''.join(f'<li>{e(str(x))}</li>' for x in t) + '</ul>'
    out = []
    for p in str(t).split('\n'):
        p = p.strip()
        if p:
            out.append(f'<p>{e(p)}</p>')
    return ''.join(out)


def load(k):
    d = os.path.join(BASE, 'concept')
    v2 = os.path.join(d, f'{k}-v2.json')
    path = v2 if os.path.exists(v2) else os.path.join(d, f'{k}.json')
    with open(path) as f:
        c = json.load(f)
    c['_v2'] = path == v2
    c['_giurie'] = {}
    for g, _ in GIURIE:
        p = os.path.join(BASE, 'giurie', f'{k}-{g}.json')
        if os.path.exists(p):
            with open(p) as f:
                c['_giurie'][g] = json.load(f)
    return c


def media(c, crit=None):
    vals = []
    for j in c['_giurie'].values():
        p = j['punteggi']
        vals += [p[crit]] if crit else list(p.values())
    return sum(vals) / len(vals) if vals else 0


def fmt(x):
    return f'{x:.1f}'.replace('.', ',')


def contour_svg(seed):
    rnd = random.Random(seed)
    cx, cy = rnd.uniform(260, 420), rnd.uniform(60, 140)
    paths = []
    phase = [rnd.uniform(0, 6.28) for _ in range(4)]
    for i in range(1, 15):
        r = 22 * i
        pts = []
        for s in range(0, 73):
            a = s / 72 * 2 * math.pi
            w = 1 + 0.18 * math.sin(3 * a + phase[0] + i * 0.15) + 0.1 * math.sin(5 * a + phase[1]) + 0.06 * math.sin(7 * a + phase[2] - i * 0.2)
            pts.append((cx + r * 1.6 * w * math.cos(a), cy + r * w * math.sin(a)))
        d = 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in pts) + 'Z'
        paths.append(f'<path d="{d}" class="{"idx" if i % 5 == 0 else "ct"}"/>')
    return f'<svg class="contour" viewBox="0 0 640 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{"".join(paths)}</svg>'


def concept_html(c):
    k = c['key']
    m = META[k]
    tr, gp, b = c['trama'], c['come_si_gioca'], c['build']
    g = c['_giurie']
    s = []
    s.append(f'<section class="concept {m["col"]}" id="{k}" aria-labelledby="t-{k}">')
    s.append('<header class="c-head">')
    s.append(f'<div class="c-loc"><span>{e(m["luogo"])}</span><span>{e(m["epoca"])}</span><span class="mono">{e(m["coord"])}</span></div>')
    s.append(f'<h2 id="t-{k}">{e(c["titolo"])}</h2>')
    s.append(f'<p class="c-sub">{e(c["sottotitolo"])}</p>')
    s.append(f'<blockquote class="hook">{e(c["frase"])}</blockquote>')
    s.append('</header>')
    imgs = DIDA.get(k, [])
    if imgs:
        s.append(f'<figure class="hero-img"><img src="img/{k}-1.jpg" alt="{e(imgs[0])}" width="1600" height="905" loading="lazy"><figcaption>{e(imgs[0])}</figcaption></figure>')
    if c.get('scheda_breve'):
        s.append(f'<div class="scheda">{paras(c["scheda_breve"])}</div>')
    if len(imgs) > 1:
        s.append('<div class="galleria">')
        for i, cap in enumerate(imgs[1:], start=2):
            s.append(f'<figure><img src="img/{k}-{i}.jpg" alt="{e(cap)}" width="1600" height="905" loading="lazy"><figcaption>{e(cap)}</figcaption></figure>')
        s.append('</div>')
    # voti
    if g:
        s.append('<div class="voti"><h3>Voti delle giurie</h3><div class="tbl"><table><thead><tr><th scope="col">Criterio</th>')
        for gk, gl in GIURIE:
            if gk in g:
                s.append(f'<th scope="col">{e(gl)}</th>')
        s.append('<th scope="col">Media</th></tr></thead><tbody>')
        for ck, cl in CRIT:
            s.append(f'<tr><th scope="row">{cl}</th>')
            for gk, _ in GIURIE:
                if gk in g:
                    v = g[gk]['punteggi'][ck]
                    s.append(f'<td><span class="pip" style="--v:{v}">{v}</span></td>')
            s.append(f'<td class="avg">{fmt(media(c, ck))}</td></tr>')
        s.append(f'<tr class="tot"><th scope="row">Totale</th>')
        for gk, _ in GIURIE:
            if gk in g:
                p = g[gk]['punteggi']
                s.append(f'<td>{fmt(sum(p.values()) / len(p))}</td>')
        s.append(f'<td class="avg">{fmt(media(c))}</td></tr></tbody></table></div>')
        s.append('<div class="verdetti">')
        for gk, gl in GIURIE:
            if gk in g:
                s.append(f'<div class="verdetto"><h4>{e(gl)}</h4>{paras(g[gk]["verdetto"])}</div>')
        s.append('</div></div>')
    if c.get('modifiche'):
        s.append('<details class="blk"><summary>Cosa è cambiato dopo le giurie</summary>' + paras(c['modifiche']) + '</details>')
    # mondo
    s.append('<div class="blk"><h3>Il mondo</h3>' + paras(c['ambientazione']) + '</div>')
    s.append('<div class="blk"><h3>Le zone</h3><ol class="zone">')
    for z in c['zone']:
        s.append(f'<li><h4>{e(z["nome"])}</h4>{paras(z["descrizione"])}<p class="nuovo"><b>Cosa introduce.</b> {e(z["novita"])}</p></li>')
    s.append('</ol></div>')
    s.append('<div class="blk"><h3>Com\'è fatto, visivamente</h3>' + paras(c['direzione_artistica']) + '</div>')
    s.append('<div class="blk"><h3>Chi sei</h3>' + paras(c['protagonista']) + '</div>')
    s.append('<div class="blk"><h3>Personaggi</h3><div class="pers">')
    for p in c['personaggi']:
        s.append(f'<div class="p"><h4>{e(p["nome"])}</h4><p class="ruolo">{e(p["ruolo"])}</p><p class="appare"><b>Come lo vedi.</b> {e(p["come_appare"])}</p>'
                 f'<details class="spoiler"><summary>Segreto</summary>{paras(p["segreto"])}</details></div>')
    s.append('</div></div>')
    # trama
    s.append('<div class="blk"><h3>La trama</h3>')
    s.append(f'<h4>Premessa</h4>{paras(tr["premessa"])}<h4>Atto I</h4>{paras(tr["atto1"])}')
    s.append('<details class="spoiler"><summary>Svolta centrale, atti II e III (spoiler)</summary>')
    s.append(f'<h4>Svolta centrale</h4>{paras(tr["svolta_centrale"])}<h4>Atto II</h4>{paras(tr["atto2"])}<h4>Atto III</h4>{paras(tr["atto3"])}')
    s.append(f'<h4>Colpi di scena</h4>{paras(tr["colpi_di_scena"])}<h4>Finali</h4>{paras(tr["finali"])}</details>')
    s.append(f'<details class="spoiler"><summary>La verità nascosta, in ordine (spoiler)</summary>{paras(c["verita_nascosta"])}</details></div>')
    # gioco
    s.append('<div class="blk"><h3>Come si gioca</h3><dl class="gioco">')
    for fk, fl in [('verbi', 'Le azioni'), ('loop_minuto', 'Minuto per minuto'), ('loop_sessione', 'In una sessione'),
                   ('traversata', 'Come ci si muove'), ('sfida_e_combattimento', 'Sfida e pericoli'), ('navigazione_e_diario', 'Orientarsi e diario')]:
        s.append(f'<dt>{fl}</dt><dd>{paras(gp[fk])}</dd>')
    s.append('</dl></div>')
    # build
    s.append('<div class="blk"><h3>Upgrade e build</h3>' + paras(b['sistema']) + '<div class="rami">')
    for r in b['rami']:
        s.append(f'<div class="ramo"><h4>{e(r["nome"])}</h4><p class="fil">{e(r["filosofia"])}</p>{paras(r["abilita"])}</div>')
    s.append('</div>')
    s.append(f'<h4>Scelte che si escludono</h4>{paras(b["scelte_esclusive"])}<h4>Il prezzo dei poteri</h4>{paras(b["costo_nel_mondo"])}')
    s.append(f'<h4>Tre build a confronto</h4>{paras(b["tre_build_esempio"])}</div>')
    # missioni
    s.append(f'<div class="blk"><h3>Missioni principali <span class="n">{len(c["missioni_principali"])}</span></h3><ol class="miss">')
    for mm in c['missioni_principali']:
        s.append(f'<li><h4>{e(mm["nome"])} <span class="tipo">{e(mm["tipo"])}</span></h4>{paras(mm["descrizione"])}</li>')
    s.append('</ol></div>')
    s.append(f'<div class="blk"><h3>Missioni secondarie <span class="n">{len(c["missioni_secondarie"])}</span></h3><ul class="miss">')
    for mm in c['missioni_secondarie']:
        s.append(f'<li><h4>{e(mm["nome"])} <span class="tipo">{e(mm["tipo"])}</span></h4>{paras(mm["descrizione"])}'
                 f'<details class="spoiler"><summary>La svolta</summary>{paras(mm["svolta"])}</details></li>')
    s.append('</ul></div>')
    # segreti
    s.append(f'<div class="blk"><h3>Segreti <span class="n">{len(c["segreti"])}</span></h3><ul class="segreti">')
    for sg in sorted(c['segreti'], key=lambda x: x.get('livello', 0)):
        lv = sg.get('livello', 0)
        s.append(f'<li><span class="lv lv{lv}" title="{e(LIVELLI.get(lv, ""))}">Livello {lv}</span>{paras(sg["descrizione"])}</li>')
    s.append('</ul>')
    s.append(f'<details class="spoiler"><summary>Il finale segreto (spoiler)</summary>{paras(c["finale_segreto"])}</details></div>')
    s.append('<div class="blk"><h3>Easter egg</h3>' + paras(c['easter_egg']) + '</div>')
    s.append('<div class="blk duo"><div><h3>Perché funziona</h3>' + paras(c['perche_funziona']) + '</div><div><h3>Rischi</h3>' + paras(c['rischi']) + '</div></div>')
    s.append('<div class="blk"><h3>Durata</h3>' + paras(c['durata']) + '<h3>Come si costruisce</h3>' + paras(c['fattibilita']) + '</div>')
    if g:
        s.append('<details class="blk"><summary>I giudizi completi delle giurie</summary>')
        for gk, gl in GIURIE:
            if gk in g:
                j = g[gk]
                s.append(f'<h4>{e(gl)}</h4><p class="lbl">Punti forti</p>{paras(j["punti_forti"])}<p class="lbl">Problemi</p>{paras(j["problemi"])}<p class="lbl">Correzioni proposte</p>{paras(j["correzioni"])}')
        s.append('</details>')
    s.append('<p class="top"><a href="#indice">Torna al confronto</a></p></section>')
    return ''.join(s)


def main():
    cs = [load(k) for k in ORDER if os.path.exists(os.path.join(BASE, 'concept', f'{k}.json'))]
    note = {}
    if os.path.exists(NOTE):
        with open(NOTE) as f:
            note = json.load(f)
    nav = ''.join(f'<a class="chip {META[c["key"]]["col"]}" href="#{c["key"]}">{e(c["titolo"].split(".")[0].title() if c["titolo"].isupper() else c["titolo"])}</a>' for c in cs)
    rows = []
    for c in cs:
        m = META[c['key']]
        rows.append(f'<tr class="{m["col"]}"><th scope="row"><a href="#{c["key"]}">{e(c["titolo"])}</a><span class="sm">{e(c["sottotitolo"])}</span></th>'
                    f'<td>{e(m["luogo"])}<span class="sm">{e(m["epoca"])}</span></td><td class="num">{fmt(media(c))}</td>'
                    f'<td class="num">{fmt(media(c, "trama"))}</td><td class="num">{fmt(media(c, "divertimento"))}</td><td class="num">{fmt(media(c, "fattibilita"))}</td></tr>')
    css = open(os.path.join(BASE, 'pagina', 'stile.css')).read()
    intro = paras(note.get('intro', ''))
    confronto = note.get('confronto_html', '')
    body = f'''<title>Atlante dei cinque mondi</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=JetBrains+Mono:wght@400;500&display=swap">
<style>{css}</style>
<div class="wrap">
<header class="hero">{contour_svg(7)}
<p class="eyebrow">Nuovo gioco · prima persona · open world</p>
<h1>Atlante dei cinque mondi</h1>
<div class="intro">{intro}</div>
<nav class="nav" aria-label="Concept">{nav}</nav>
</header>
<section id="indice" class="indice" aria-labelledby="t-indice">
<h2 id="t-indice">Il confronto</h2>
<div class="tbl"><table class="cmp"><thead><tr><th scope="col">Concept</th><th scope="col">Luogo ed epoca</th><th scope="col" class="num">Media</th><th scope="col" class="num">Trama</th><th scope="col" class="num">Divertimento</th><th scope="col" class="num">Fattibilità</th></tr></thead>
<tbody>{"".join(rows)}</tbody></table></div>
<p class="nota">Voti da 1 a 10, media delle tre giurie (critica, produzione, giocatore e mercato) sulla prima versione di ogni concept. Scala fissa: 10 è il livello di Outer Wilds o Breath of the Wild, 8 un indie premiato, 5 nella media.</p>
{confronto}
</section>
{"".join(concept_html(c) for c in cs)}
<footer class="foot"><p>Ricerca di mercato, di design e tecnica del 14 ottobre 2026; concept scritti da cinque autori, valutati da tre giurie indipendenti e riscritti con le loro correzioni.</p></footer>
</div>'''
    with open(OUT, 'w') as f:
        f.write(body)
    print(OUT, len(body) // 1024, 'KB', [(c['key'], c['_v2']) for c in cs])


if __name__ == '__main__':
    main()
