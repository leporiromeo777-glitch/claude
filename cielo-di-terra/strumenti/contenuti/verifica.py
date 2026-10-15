#!/usr/bin/env python3
"""Verifica la validità JSON e i riferimenti incrociati dei contenuti della Fase 1."""
import json, re, sys, os
C = '/home/user/claude/cielo-di-terra/content'
err = []
def load(n):
    try:
        return json.load(open(os.path.join(C, n), encoding='utf-8'))
    except Exception as e:
        err.append(f'{n}: JSON non valido: {e}')
        return None

luoghi = load('luoghi.json'); cap = load('capisaldi.json'); pers = load('personaggi.json')
dia = load('dialoghi.json'); mis = load('missioni.json'); tac = load('taccuino.json')
tes = load('testi.json'); fade = load('fade_fase1.json')
if err:
    print('\n'.join(err)); sys.exit(1)

L = {l['id'] for l in luoghi}
assert len(L) == len(luoghi), 'id luoghi duplicati'
P = {p['id'] for p in pers}
D = set(dia.keys())
M = {m['id'] for m in mis}
PASSI = [p['id'] for m in mis for p in m['passi']]
assert len(PASSI) == len(set(PASSI)), 'id passi duplicati'
PASSI = set(PASSI)
TAC = set()
for sez in ('riga_del_cielo', 'domande', 'indizi', 'note', 'parole', 'proverbi', 'leggende'):
    for v in tac[sez]:
        if v['id'] in TAC: err.append(f'taccuino: id duplicato {v["id"]}')
        TAC.add(v['id'])
TESTI = set()
for sez, v in tes.items():
    if sez.startswith('_'): continue
    if isinstance(v, dict):
        for k in v:
            TESTI.add(k)
    elif isinstance(v, list):
        for x in v: TESTI.add(x['id'])
BATT = set(tes['battute'].keys()); SUGG = set(tes['suggerimenti'].keys())
CELLE = {p['id'] for p in fade['particelle']}
ELEM = {e['id'] for e in fade['elementi_mobili']}
CS = {c['id'] for c in cap['rete_corbella']} | {c['id'] for c in cap['lontani_di_notte']}
LATI = {l['id'] for l in cap['lati']}
CHI_OK = P | {'lisa', 'gioanin'}

ATOM = re.compile(r'!?\s*([a-z_]+):([^\s()]+)(\s+(raggiunto|rilevata|finito|completato|completata))?')
def check_cond(cond, where):
    if cond in (None, 'inizio'): return
    s = cond.replace('(', ' ').replace(')', ' ')
    toks = [t for t in re.split(r'\s+(?:e|o)\s+', s) if t.strip()]
    for t in toks:
        t = t.strip()
        if t == 'inizio': continue
        m = ATOM.fullmatch(t)
        if not m:
            err.append(f'{where}: condizione illeggibile «{t}»'); continue
        kind, val = m.group(1), m.group(2)
        if kind == 'luogo' and val not in L: err.append(f'{where}: luogo sconosciuto {val}')
        if kind == 'dialogo' and val not in D: err.append(f'{where}: dialogo sconosciuto {val}')
        if kind == 'passo' and val not in PASSI: err.append(f'{where}: passo sconosciuto {val}')
        if kind == 'cella' and int(val) not in CELLE: err.append(f'{where}: cella sconosciuta {val}')
        if kind == 'variante' and val.split('=')[0] not in ELEM: err.append(f'{where}: elemento sconosciuto {val}')
        if kind not in ('flag', 'luogo', 'ora', 'giorno', 'cella', 'dialogo', 'passo', 'contatore', 'oggetto', 'variante', 'missione'):
            err.append(f'{where}: tipo di condizione sconosciuto {kind}')

def check_eff(effs, where):
    for e in effs or []:
        k, _, v = e.partition(':')
        if k == 'taccuino' and v not in TAC: err.append(f'{where}: voce di taccuino sconosciuta {v}')
        elif k == 'dialogo' and v not in D: err.append(f'{where}: dialogo sconosciuto {v}')
        elif k == 'missione' and v.split()[0] not in M: err.append(f'{where}: missione sconosciuta {v}')
        elif k == 'testo' and v not in TESTI: err.append(f'{where}: testo sconosciuto {v}')
        elif k == 'battuta' and v not in BATT: err.append(f'{where}: battuta sconosciuta {v}')
        elif k == 'suggerimento' and v not in SUGG: err.append(f'{where}: suggerimento sconosciuto {v}')
        elif k == 'variante' and v.split('=')[0] not in ELEM: err.append(f'{where}: elemento sconosciuto {v}')
        elif k == 'npc' and v.split('->')[0] not in P: err.append(f'{where}: personaggio sconosciuto {v}')
        elif k not in ('taccuino', 'dialogo', 'missione', 'testo', 'battuta', 'suggerimento', 'variante', 'npc', 'flag', 'contatore', 'oggetto', 'orologio', 'germoglio', 'suono', 'musica', 'pianta', 'evento', 'dormi', 'scena'):
            err.append(f'{where}: tipo di effetto sconosciuto {k}')

# dialoghi
for did, d in dia.items():
    if d['personaggio'] not in P: err.append(f'{did}: personaggio sconosciuto {d["personaggio"]}')
    ids = [n['id'] for n in d['nodi']]
    if len(ids) != len(set(ids)): err.append(f'{did}: nodi duplicati')
    si = d.get('si_apre', {})
    check_cond(si.get('condizione'), did + '.si_apre')
    check_eff(d.get('alla_fine'), did + '.alla_fine')
    reach = {ids[0]}
    for n in d['nodi']:
        if n.get('chi') and n['chi'] not in CHI_OK: err.append(f'{did}.{n["id"]}: chi sconosciuto {n["chi"]}')
        if not n['risposte']: err.append(f'{did}.{n["id"]}: nessuna risposta')
        for r in n['risposte']:
            if r['vai_a'] != 'fine' and r['vai_a'] not in ids: err.append(f'{did}.{n["id"]}: vai_a sconosciuto {r["vai_a"]}')
            reach.add(r['vai_a'])
            check_cond(r.get('condizione'), f'{did}.{n["id"]}')
            check_eff(r.get('effetti'), f'{did}.{n["id"]}')
    for i in ids:
        if i not in reach: err.append(f'{did}: nodo irraggiungibile {i}')
    if 'fine' not in reach: err.append(f'{did}: non finisce mai')

# missioni
for m in mis:
    for p in m['passi']:
        w = f'{m["id"]}.{p["id"]}'
        for k in ('id', 'obiettivo_taccuino', 'attiva_quando', 'completa_quando', 'effetti'):
            if k not in p: err.append(f'{w}: manca {k}')
        check_cond(p['attiva_quando'], w + '.attiva')
        check_cond(p['completa_quando'], w + '.completa')
        check_eff(p['effetti'], w)
        check_eff(p.get('effetti_attivazione'), w)
        if p.get('luogo') and p['luogo'] not in L: err.append(f'{w}: luogo sconosciuto {p["luogo"]}')
        for ev in p.get('eventi', []):
            check_cond(ev['quando'], w + '.evento'); check_eff(ev['effetti'], w + '.evento')
        for a in p.get('aiuti', []):
            check_eff(a['effetti'], w + '.aiuto')
        ob = p['obiettivo_taccuino'] or ''
        if re.search(r'\b(vai|raggiungi|recati)\b', ob, re.I): err.append(f'{w}: obiettivo imperativo «{ob}»')

# taccuino interno
for q in tac['domande']:
    for i in q.get('indizi', []):
        if i not in TAC: err.append(f'taccuino {q["id"]}: indizio sconosciuto {i}')
    check_cond(q.get('chiusa_quando'), 'taccuino ' + q['id'])
for v in tac['indizi']:
    if v.get('domanda') and v['domanda'] not in TAC: err.append(f'taccuino {v["id"]}: domanda sconosciuta')
    if not v.get('fonte'): err.append(f'taccuino {v["id"]}: manca la fonte')
for r in tac['riga_del_cielo']:
    check_cond(r['quando'], 'riga ' + r['id'])

# testi: leggende
for k, lg in tes['leggende'].items():
    check_cond(lg.get('condizione'), 'leggenda ' + k); check_eff(lg.get('alla_fine'), 'leggenda ' + k)

# capisaldi e luoghi
for c in cap['rete_corbella']:
    if c['luogo'] not in L: err.append(f'{c["id"]}: luogo sconosciuto')
    for v in c['visibile_da']:
        if v not in CS: err.append(f'{c["id"]}: visibile_da sconosciuto {v}')
for c in cap['lontani_di_notte']:
    for v in c['visibile_da']:
        if v not in CS: err.append(f'{c["id"]}: visibile_da sconosciuto {v}')
for l in cap['lati']:
    for x in l['particelle']:
        if x not in CELLE: err.append(f'lato {l["id"]}: cella fuori area {x}')

# fade: elementi
for e in fade['elementi_mobili']:
    for x in e['particelle']:
        if x not in CELLE: err.append(f'{e["id"]}: cella sconosciuta {x}')
    if e.get('alternativa') and e['alternativa'] not in L: err.append(f'{e["id"]}: alternativa sconosciuta')
hub_mob = [p['id'] for p in fade['particelle'] if p['hub'] and p['mobile']]
if hub_mob: err.append(f'particelle hub e mobili insieme: {hub_mob}')

# celle chiave
need = {2214: 'terrazza', 2797: 'passerella', 2798: 'sentiero', 2311: 'scorciatoia', 2407: 'scorciatoia'}
L13 = next(l for l in cap['lati'] if l['id'] == '1-3')['particelle']
L78 = next(l for l in cap['lati'] if l['id'] == '7-8')['particelle']
for c in (2214, 2311, 2407):
    if c not in L13: err.append(f'il lato 1-3 non contiene {c}')
for c in (2797, 2798):
    if c not in L78: err.append(f'il lato 7-8 non contiene {c}')

print('luoghi', len(L), 'personaggi', len(P), 'dialoghi', len(D), 'missioni', len(M), 'passi', len(PASSI), 'taccuino', len(TAC), 'testi', len(TESTI), 'particelle', len(CELLE))
if err:
    print('\n'.join(err)); sys.exit(1)
print('TUTTO OK')
