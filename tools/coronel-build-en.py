#!/usr/bin/env python3
"""Genera le pagine inglesi del sito Coronel (coronel/en/*.html) da quelle italiane.

Uso:  python3 tools/coronel-build-en.py
- aggiunge (una volta sola) il selettore IT/EN alle pagine italiane;
- crea coronel/en/<pagina>.html traducendo i testi con il dizionario qui sotto;
- segnala i testi italiani rimasti senza traduzione.
Quando si cambia un testo italiano, aggiungere la sua traduzione in TEXT e rilanciare.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "coronel"
PAGES = ["index.html", "servizi.html", "studio.html", "orari.html", "collaborazioni.html"]

# Blocchi HTML riscritti interi (titoli spezzati per le animazioni)
BLOCKS = [
    ('''        <h1 aria-label="Il tuo stile, tagliato su misura">
          <span class="w"><span style="--i:0">Il</span></span> <span class="w"><span style="--i:1">tuo</span></span>
          <span class="w"><span style="--i:2" class="rotator" id="rotator"><span class="cur">stile,</span><span>taglio,</span><span>fade,</span><span>look,</span></span></span><br>
          <span class="w"><span style="--i:3" class="b">tagliato</span></span>
          <span class="w"><span style="--i:4" class="r">su</span></span> <span class="w"><span style="--i:5" class="r">misura</span></span>
        </h1>''',
     '''        <h1 aria-label="Your style, made for you">
          <span class="w"><span style="--i:0">Your</span></span>
          <span class="w"><span style="--i:1" class="rotator" id="rotator"><span class="cur">style,</span><span>cut,</span><span>fade,</span><span>look,</span></span></span><br>
          <span class="w"><span style="--i:2" class="b">made</span></span>
          <span class="w"><span style="--i:3" class="r">for</span></span> <span class="w"><span style="--i:4" class="r">you</span></span>
        </h1>'''),
    ("Coronel ★ Taglio &amp; stile ★ Tesserete ★", "Coronel ★ Cut &amp; style ★ Tesserete ★"),
    ("<h2>Prenota il<br>tuo posto</h2>", "<h2>Book<br>your spot</h2>"),
    ("Prima il benessere.<br>Poi il taglio.", "Wellbeing first.<br>Then the cut."),
    ('<blockquote id="chile-quote">Taglio da <em>titolare</em>, trattamento da <em>nazionale</em>.</blockquote>',
     '<blockquote id="chile-quote">A <em>starter\'s</em> cut, <em>national-team</em> treatment.</blockquote>'),
    ("Il tuo brand<br>da Coronel.", "Your brand<br>at Coronel."),
    ("Quattro modi<br>per esserci", "Four ways<br>to be here"),
    ("Attenzione vera,<br>non di passaggio", "Real attention,<br>not a glance"),
    # valori del modulo collaborazioni (finiscono nel messaggio Instagram)
    ('value="Scaffale prodotti"', 'value="Product shelf"'), ('value="Prodotti in vetrina"', 'value="Display products"'),
    ('value="Evento"', 'value="Event"'), ('value="Altro"', 'value="Other"'),
    ('<html lang="it">', '<html lang="en">'),
]

# Testi (spazi normalizzati) → inglese
TEXT = {
    # titoli e descrizioni
    "Coronel · Tagli di capelli a Tesserete": "Coronel · Haircuts in Tesserete",
    "Coronel: tagli di capelli, barba e decolorazione a Tesserete, con radici cilene. Su appuntamento. Via Luigi Canonica 7, Tesserete. Mar–Ven 9–19, Sab 9–18.":
        "Coronel: haircuts, beard and bleaching in Tesserete, with Chilean roots. By appointment. Via Luigi Canonica 7, Tesserete. Tue–Fri 9–19, Sat 9–18.",
    "Servizi e prezzi · Coronel": "Services & prices · Coronel",
    "Listino di Coronel a Tesserete: Taglio Uomo 32€, Taglio studente 25€, Barba 15€, Decolorazione 80€, Lavaggio 5€.":
        "Coronel price list in Tesserete: Men's Cut €32, Student Cut €25, Beard €15, Bleaching €80, Wash €5.",
    "Lo studio · Coronel": "The studio · Coronel",
    "Coronel, tagli di capelli a Tesserete con radici cilene: prima il benessere, poi il taglio.":
        "Coronel, haircuts in Tesserete with Chilean roots: wellbeing first, then the cut.",
    "Orari e indirizzo · Coronel": "Hours & address · Coronel",
    "Orari di Coronel: Mar–Ven 9–19, Sab 9–18, domenica e lunedì chiuso. Via Luigi Canonica 7, 6950 Tesserete.":
        "Coronel opening hours: Tue–Fri 9–19, Sat 9–18, closed Sunday and Monday. Via Luigi Canonica 7, 6950 Tesserete.",
    "Collaborazioni · Coronel": "Collaborations · Coronel",
    "Collabora con Coronel a Tesserete: prodotti sullo scaffale e in vetrina, merchandise in collaborazione ed eventi nello studio.":
        "Collaborate with Coronel in Tesserete: products on the shelf and on display, co-branded merchandise and events in the studio.",
    # menu e comuni
    "Home": "Home", "Servizi": "Services", "Lo studio": "The studio", "Orari & dove": "Hours & location", "Collaborazioni": "Collaborations",
    "Prenota": "Book", "Prenota appuntamento": "Book an appointment", "Prenota ora": "Book now", "Prenota il tuo appuntamento": "Book your appointment",
    "Apri il menu": "Open the menu", "Menu": "Menu", "Coronel, home": "Coronel, home", "Percorso": "Breadcrumb", "Pagine": "Pages",
    "Coronel · Via Luigi Canonica 7, 6950 Tesserete ·": "Coronel · Via Luigi Canonica 7, 6950 Tesserete ·",
    "Su appuntamento": "By appointment", "Scegli servizio e orario online in pochi secondi. Ti aspettiamo in studio.":
        "Choose your service and time online in seconds. See you in the studio.",
    "Le pagine": "The pages", "Continua": "Keep exploring", "Scopri Coronel": "Discover Coronel", "Apri": "Open",
    "Il listino": "The price list", "Calor chileno": "Chilean warmth", "Vieni a trovarci": "Come and see us", "Lavora con Coronel": "Work with Coronel",
    "Servizi & prezzi": "Services & prices", "Servizi &amp; prezzi": "Services &amp; prices", "Orari &amp; dove": "Hours &amp; location",
    "Taglio, barba, decolorazione: prezzi reali e durata di ogni servizio.": "Cut, beard, bleaching: real prices and length of every service.",
    "La filosofia di Coronel: prima il benessere, poi il taglio.": "The Coronel philosophy: wellbeing first, then the cut.",
    "Orari di apertura, indirizzo a Tesserete e indicazioni.": "Opening hours, address in Tesserete and directions.",
    "Prodotti in vetrina, merchandise ed eventi: porta il tuo brand nello studio.": "Display products, merchandise and events: bring your brand into the studio.",
    # home
    "Radici cilene · Tesserete": "Chilean roots · Tesserete",
    "Tagli di capelli a Tesserete, con radici cilene. Taglio, barba e decolorazione curati nei dettagli, con tutto il tempo che serve — solo su appuntamento.":
        "Haircuts in Tesserete, with Chilean roots. Cut, beard and bleaching with attention to every detail, taking all the time it needs — by appointment only.",
    "Vedi il listino": "See the price list", "Mar–Ven 9–19 · Sab 9–18": "Tue–Fri 9–19 · Sat 9–18",
    "Taglio": "Cut", "Fade": "Fade", "Barba": "Beard", "Decolorazione": "Bleaching", "Lavaggio": "Wash",
    # servizi
    "Tocca i servizi che ti interessano: calcoliamo subito prezzo e durata del tuo appuntamento.":
        "Tap the services you want: we instantly work out the price and length of your appointment.",
    "Ogni servizio include accoglienza e consulenza.": "Every service includes a warm welcome and a consultation.",
    "Svuota selezione": "Clear selection", "0 min": "0 min",
    # studio
    "In Cile chi ti taglia i capelli è una persona di fiducia. Coronel porta quella cultura a Tesserete: tempo, cura e un po' di calor chileno.":
        "In Chile, the person who cuts your hair is someone you trust. Coronel brings that culture to Tesserete: time, care and a little Chilean warmth.",
    "Tempo, non fretta": "Time, not rush", "Si lavora solo su appuntamento: quando sei sulla sedia, ci sei solo tu.":
        "We work by appointment only: when you're in the chair, it's all about you.",
    "Cura del dettaglio": "Attention to detail",
    "Dalla consulenza alla rifinitura, ogni linea è curata. Un taglio fatto bene si vede — e si sente.":
        "From the consultation to the finish, every line is taken care of. A good cut shows — and you can feel it.",
    "Accoglienza vera, come a casa. Due parole, un mate e il tuo momento di relax.":
        "A real welcome, like at home. A chat, a mate and your moment to relax.",
    "Bienvenido a Coronel": "Bienvenido a Coronel",
    "Cliente rilassato sulla poltrona": "Client relaxing in the chair", "Forbici e pettine durante un taglio": "Scissors and comb during a cut",
    "Interno accogliente dello studio Coronel": "The welcoming interior of the Coronel studio",
    # orari
    "Via Luigi Canonica 7, Tesserete. Si lavora solo su appuntamento.": "Via Luigi Canonica 7, Tesserete. By appointment only.",
    "Orari di apertura": "Opening hours", "Lunedì": "Monday", "Martedì": "Tuesday", "Mercoledì": "Wednesday", "Giovedì": "Thursday",
    "Venerdì": "Friday", "Sabato": "Saturday", "Domenica": "Sunday", "Chiuso": "Closed", "Indirizzo": "Address",
    "6950 Tesserete · Ticino": "6950 Tesserete · Ticino", "Via Luigi Canonica 7": "Via Luigi Canonica 7",
    "Mappa Coronel": "Coronel map", "Indicazioni": "Directions", "Copia indirizzo": "Copy address", "Scrivici in DM": "Message us on Instagram",
    # collaborazioni
    "Prodotti sullo scaffale, oggetti in vetrina, merchandise in collaborazione ed eventi nello studio. Coronel è uno spazio dove brand e persone si incontrano.":
        "Products on the shelf, items on display, co-branded merchandise and events in the studio. Coronel is a space where brands and people meet.",
    "Scrivici su Instagram": "Message us on Instagram", "Cosa possiamo fare insieme": "What we can do together",
    "Ogni collaborazione è pensata su misura: formato, durata e compenso si decidono insieme.":
        "Every collaboration is tailor-made: format, length and fee are agreed together.",
    "Lo scaffale Coronel": "The Coronel shelf",
    "Nello studio arriva uno scaffale dedicato alla vendita di prodotti selezionati: cura dei capelli e della barba, accessori, oggetti. Se il tuo prodotto è in linea con lo stile Coronel, può trovare posto qui ed essere venduto direttamente ai clienti.":
        "A shelf dedicated to selling selected products is coming to the studio: hair and beard care, accessories, objects. If your product fits the Coronel style, it can find a place here and be sold directly to clients.",
    "Vendita diretta in studio": "Direct sales in the studio", "Prodotti scelti e consigliati": "Chosen and recommended products",
    "Spazio limitato, selezione curata": "Limited space, curated selection", "Prodotti in vetrina": "Products on display",
    "Libri, riviste, oggetti di design o piccole installazioni esposti nello studio, dove i clienti li vedono e li sfogliano mentre aspettano o durante il servizio. Uno spazio espositivo a pagamento, per un periodo concordato.":
        "Books, magazines, design objects or small installations displayed in the studio, where clients see and browse them while they wait or during their service. A paid display space for an agreed period.",
    "Esposizione per un periodo concordato": "Display for an agreed period", "Visibilità durante tutto l'appuntamento": "Visibility for the whole appointment",
    "Materiale informativo o QR verso il tuo sito": "Leaflets or a QR code to your website", "Merchandise in collaborazione": "Co-branded merchandise",
    "Capsule e oggetti co-firmati con Coronel: magliette, cappellini, borse, accessori. Pensati insieme, prodotti in quantità limitate e venduti in studio e attraverso i canali Coronel.":
        "Capsules and items co-signed with Coronel: t-shirts, caps, bags, accessories. Designed together, made in limited runs and sold in the studio and through Coronel's channels.",
    "Prodotti co-firmati": "Co-signed products", "Edizioni limitate": "Limited editions", "Lancio raccontato su Instagram": "Launch shared on Instagram",
    "Eventi nello studio": "Events in the studio",
    "Presentazioni di prodotto, serate con musica, degustazioni, giornate a tema: lo studio Coronel può diventare il luogo del tuo evento, fuori dagli orari di apertura o in date speciali.":
        "Product launches, evenings with music, tastings, themed days: the Coronel studio can become the venue for your event, outside opening hours or on special dates.",
    "Lanci e presentazioni": "Launches and presentations", "Serate e giornate a tema": "Themed evenings and days", "Organizzazione condivisa": "Shared organisation",
    "Perché Coronel": "Why Coronel", "Tempo di qualità": "Quality time",
    "Ogni appuntamento dura dai 10 ai 120 minuti: il tuo prodotto viene visto, toccato e provato, non solo notato di sfuggita.":
        "Every appointment lasts from 10 to 120 minutes: your product is seen, touched and tried, not just glimpsed.",
    "Uno spazio curato": "A curated space",
    "Nello studio entra solo ciò che sta bene con lo stile Coronel. Essere qui significa essere scelti.":
        "Only what fits the Coronel style makes it into the studio. Being here means being chosen.",
    "Anche online": "Online too", "Le collaborazioni possono essere raccontate sul profilo Instagram": "Collaborations can be shared on the Instagram profile",
    "Come funziona": "How it works", "Tre passi": "Three steps", "Scrivici": "Get in touch",
    "Raccontaci chi sei e che tipo di collaborazione hai in mente, con il modulo qui sotto o in DM.":
        "Tell us who you are and what kind of collaboration you have in mind, with the form below or by DM.",
    "Ne parliamo": "We talk it through", "Definiamo insieme formato, durata, spazio e compenso.": "Together we agree on format, length, space and fee.",
    "Si parte": "We get started", "Il tuo prodotto, la tua capsule o il tuo evento entrano nello studio Coronel.":
        "Your product, your capsule or your event comes into the Coronel studio.",
    "Proponi una collaborazione": "Propose a collaboration", "Parliamone": "Let's talk",
    "Compila il modulo: prepariamo il messaggio e si apre la chat Instagram di @_coro.nel con il testo già copiato. Basta incollarlo e inviarlo.":
        "Fill in the form: we prepare the message and the Instagram chat with @_coro.nel opens with the text already copied. Just paste and send.",
    "Nome e brand": "Name and brand", "Es. Laura · Studio Verde": "E.g. Laura · Studio Verde", "Tipo di collaborazione": "Type of collaboration",
    "Scaffale prodotti": "Product shelf", "Merchandise": "Merchandise", "Evento": "Event", "Altro": "Other",
    "La tua idea": "Your idea", "Che prodotto o evento proponi? Per quanto tempo?": "Which product or event are you proposing? For how long?",
    "Contatto": "Contact", "(email o telefono, facoltativo)": "(email or phone, optional)", "nome@brand.ch": "name@brand.ch",
    "Prepara il messaggio e apri Instagram": "Prepare the message and open Instagram",
    "Scaffale con prodotti esposti nello studio": "Shelf with products on display in the studio",
    "Merchandise: t-shirt, cappellino, borsa": "Merchandise: t-shirt, cap, bag", "Serata con musica e persone nello studio": "Evening with music and people in the studio",
    # scritte decorative
    "LISTINO": "PRICES", "CALOR": "CALOR", "TESSERETE": "TESSERETE", "COLLAB": "COLLAB",
}

ATTRS = ("alt", "placeholder", "aria-label", "title", "data-mark")
# testi già inglesi (traduzioni e pezzi dei titoli riscritti): non vanno segnalati
ENGLISH = set(TEXT.values()) | {" ".join(t.split()) for _, b in BLOCKS for t in __import__("re").split(r"<[^>]+>", b) if t.strip()} \
    | {"Your style, made for you", "Language", "Coronel"}
META_CONTENT = re.compile(r'(<meta (?:name="description"|property="og:(?:title|description)") content=")([^"]*)(")')


def norm(t):
    return " ".join(t.split())


def switcher(page, lang):
    it_href = page if lang == "it" else f"../{page}"
    en_href = f"en/{page}" if lang == "it" else page
    return (f'<div class="lang-switch" role="group" aria-label="{"Lingua" if lang == "it" else "Language"}">'
            f'<a href="{it_href}" hreflang="it" lang="it" data-lang="it"{" class=\"on\"" if lang == "it" else ""}>IT</a>'
            f'<a href="{en_href}" hreflang="en" lang="en" data-lang="en"{" class=\"on\"" if lang == "en" else ""}>EN</a></div>')


def add_switcher(html, page, lang):
    html = re.sub(r'<div class="lang-switch".*?</div>', "", html)
    html = html.replace('    <div class="nav-right">\n', f'    <div class="nav-right">\n      {switcher(page, lang)}\n', 1)
    html = html.replace('<nav class="mobile-menu" id="mobile-menu" aria-label="Menu">\n',
                        f'<nav class="mobile-menu" id="mobile-menu" aria-label="Menu">\n  {switcher(page, lang)}\n', 1)
    return html


def translate(html, missing, page):
    for a, b in BLOCKS:
        html = html.replace(a, b)

    def text_node(m):
        raw = m.group(1)
        core = norm(raw)
        if not core or not re.search(r"[A-Za-zÀ-ÿ]", core):
            return m.group(0)
        if core in TEXT:
            lead = raw[: len(raw) - len(raw.lstrip())]
            trail = raw[len(raw.rstrip()):]
            return ">" + lead + TEXT[core] + trail + "<"
        if core not in ENGLISH:
            missing.add((page, core))
        return m.group(0)

    # testo tra i tag; script/style/svg/template vengono messi da parte e poi rimessi
    saved = []
    def hide(m):
        saved.append(m.group(0))
        return f"<!--KEEP{len(saved) - 1}-->"
    html = re.sub(r"<script.*?</script>|<style.*?</style>|<svg.*?</svg>|<template.*?</template>", hide, html, flags=re.S)
    html = re.sub(r">([^<>]+)<", text_node, html)
    html = re.sub(r"<!--KEEP(\d+)-->", lambda m: saved[int(m.group(1))], html)

    for attr in ATTRS:
        def attr_sub(m):
            v = norm(m.group(2))
            if v in TEXT:
                return f'{m.group(1)}{TEXT[v]}"'
            if re.search(r"[a-zà-ù]{3}", v, re.I) and v not in ENGLISH:
                missing.add((page, f"[{attr}] {v}"))
            return m.group(0)
        html = re.sub(rf'(\s{attr}=")([^"]*)"', attr_sub, html)
    html = META_CONTENT.sub(lambda m: m.group(1) + TEXT.get(norm(m.group(2)), m.group(2)) + m.group(3), html)

    # percorsi delle risorse (le pagine inglesi stanno una cartella più in basso)
    html = re.sub(r'(href|src|content)="(css|js|img)/', r'\1="../\2/', html)
    html = html.replace("url('img/", "url('../img/")
    return html


def main():
    (ROOT / "en").mkdir(exist_ok=True)
    missing = set()
    for page in PAGES:
        src = ROOT / page
        it_html = add_switcher(src.read_text(encoding="utf-8"), page, "it")
        src.write_text(it_html, encoding="utf-8")
        en_html = translate(add_switcher(it_html, page, "en"), missing, page)
        (ROOT / "en" / page).write_text(en_html, encoding="utf-8")
        print("ok", f"en/{page}")
    ignore = {"Coronel", "Instagram", "@_coro.nel", "CO", "ro", "NEL", "C", "O", "IT", "EN", "·", "→"}
    left = sorted(m for m in missing if m[1] not in ignore and not re.fullmatch(r"[\d€%:–\s·+-]+", m[1]))
    if left:
        print("\nTesti senza traduzione:")
        for p, t in left:
            print(f"  {p}: {t}")
        sys.exit(1)


if __name__ == "__main__":
    main()
