"""
Compone il prompt dell'immagine sorgente di un personaggio dalla Bibbia (docs/personaggi/BIBBIA.md):
STILE + RIFERIMENTO + personaggio + VELO | VOLTO + POSA.

    python3 -I tools/personaggi/prompt.py --id bortolo          # stampa il prompt
    python3 -I tools/personaggi/prompt.py --tutti --json out.json

RIFERIMENTO: le immagini della produzione si generano con l'immagine sorgente di Togna (pilota) come
riferimento di stile (`medias: [{role: image_references}]` di gpt_image_2_5), così i 13 modelli hanno la
stessa resa, la stessa luce e lo stesso fondo. La frase dice al generatore di prendere dal riferimento
solo lo stile e non i vestiti.
"""
from __future__ import annotations

import argparse
import json
import os
import re

QUI = os.path.dirname(os.path.abspath(__file__))
BIBBIA = os.path.join(QUI, '..', '..', 'docs', 'personaggi', 'BIBBIA.md')

# chi ha il volto scoperto (frase VOLTO), chi la maschera di castagno (frase MASCHERA);
# tutti gli altri sono velati (frase VELO)
SCOPERTI = {'ottavio', 'nando'}
GIOVANI = {'ottavio'}  # niente rughe dipinte
MASCHERATI = {'clelia', 'velato_maschera'}


def frasi() -> dict:
    t = open(BIBBIA, encoding='utf-8').read()
    out = {
        'STILE': re.search(r'\*\*STILE\*\*\n> (.+)', t).group(1).strip(),
        'POSA': re.search(r'\*\*POSA\*\*\n> (.+)', t).group(1).strip(),
        'VOLTO': re.search(r'aggiunge \*\*VOLTO\*\*.*?\n> (.+)', t).group(1).strip(),
        'VELO': re.search(r'aggiunge sempre \*\*VELO\*\*:\n> (.+)', t).group(1).strip(),
        'MASCHERA': re.search(r'si usa \*\*MASCHERA\*\*.*?\n> (.+)', t).group(1).strip(),
        'RIFERIMENTO': re.search(r'\*\*RIFERIMENTO\*\*.*?\n> (.+)', t).group(1).strip(),
        'personaggi': {},
    }
    for m in re.finditer(r'### \d+\. [^\n]*?`(\w+)`.*?\*\*Prompt\*\*:\n> (.+?)\n', t, re.S):
        out['personaggi'][m.group(1)] = m.group(2).strip()
    return out


def prompt(id_: str, f: dict | None = None, riferimento: bool = True) -> str:
    f = f or frasi()
    parti = [f['STILE']]
    if riferimento:
        parti.append(f['RIFERIMENTO'])
    parti.append(f['personaggi'][id_])
    if id_ in SCOPERTI:
        volto = f['VOLTO']
        if id_ in GIOVANI:
            volto = volto.replace(', a few painted lines for wrinkles', '')
        parti.append(volto)
    elif id_ in MASCHERATI:
        parti.append(f['MASCHERA'])
    else:
        parti.append(f['VELO'])
    parti.append(f['POSA'])
    return ' '.join(parti)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--id')
    ap.add_argument('--tutti', action='store_true')
    ap.add_argument('--senza-riferimento', action='store_true')
    ap.add_argument('--json')
    a = ap.parse_args()
    f = frasi()
    ids = list(f['personaggi']) if a.tutti else [a.id]
    tutti = {i: prompt(i, f, not a.senza_riferimento) for i in ids}
    if a.json:
        with open(a.json, 'w', encoding='utf-8') as h:
            json.dump(tutti, h, indent=1, ensure_ascii=False)
    for i, p in tutti.items():
        print(f'== {i} ({len(p)} caratteri)\n{p}\n')


if __name__ == '__main__':
    main()
