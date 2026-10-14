# Idee per il nuovo gioco (open world in prima persona)

Fase di ideazione del 14 ottobre 2026: cinque concept in prima persona, open world con trama, missioni, build e segreti.
Questa cartella contiene solo documenti e bozzetti, nessun codice di gioco. La pagina pubblicata è
https://claude.ai/artifact/2J1MKBBmexkP1z1ovVxHCy (privata).

- `ricerca/`: la richiesta dell'utente, le tre ricerche (mercato, design, tecnica) e le istruzioni date ad autori, giurie e rifiniture.
- `concept/`: per ogni idea la prima versione (`<chiave>.json`), il piano e la seconda versione corretta dopo le giurie (`<chiave>-v2.json`).
  Chiavi: `sibilla` (Sibilla), `colapesce` (La Terza Colonna), `cielo` (Cielo di Terra), `libero` (Timavo), `disgelo` (Disgelo).
- `giurie/`: i giudizi delle tre giurie (critica, produzione, giocatore e mercato) sulla prima versione.
- `pagina/`: la pagina di confronto (`atlante.html`, generata da `genera.py` con `stile.css` e `note.json`) e le immagini.
  - `img/`: i 20 bozzetti nello stile scelto (misto fra campiture piatte e pittura a mano).
  - `img-semirealistiche/`: la prima serie, semi-realistica, scartata dall'utente.
  - `prove-stile/`: le prove dei cinque stili (100-109) e del misto scelto (110-111), con i fogli di confronto.

Rigenerare la pagina: `python3 pagina/genera.py` (legge `concept/`, `giurie/` e `pagina/note.json`).
